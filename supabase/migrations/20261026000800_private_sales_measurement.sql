begin;
create table public.analytics_cohorts(hash text primary key check(hash ~ '^[a-f0-9]{64}$'),consent_version text not null default 'v1' check(consent_version='v1'),created_at timestamptz not null default now());
create table public.analytics_events(
 id bigint generated always as identity primary key,cohort_hash text not null references public.analytics_cohorts(hash) on delete cascade,
 kind text not null check(kind in ('destination_view','add_to_cart','begin_checkout','paid')),
 destination text references public.catalog_destinations(slug),order_key uuid,created_at timestamptz not null default now(),
 unique nulls not distinct(cohort_hash,kind,destination,order_key),
 check((kind in ('destination_view','add_to_cart') and destination is not null and order_key is null)or(kind in ('begin_checkout','paid') and destination is null and order_key is not null))
);
create table public.analytics_rate_limits(bucket text primary key check(bucket ~ '^[a-f0-9]{64}$'),hits integer not null check(hits>0),expires_at timestamptz not null);
create table public.analytics_revoked(hash text primary key check(hash ~ '^[a-f0-9]{64}$'),expires_at timestamptz not null);
alter table public.analytics_revoked enable row level security;
revoke all on public.analytics_revoked from public,anon,authenticated;
grant all on public.analytics_revoked to service_role;
create index analytics_cohorts_created_idx on public.analytics_cohorts(created_at);
create index analytics_rate_expiry_idx on public.analytics_rate_limits(expires_at);
alter table public.checkout_orders add analytics_cohort text references public.analytics_cohorts(hash) on delete set null,add analytics_order_key uuid;
create unique index checkout_analytics_order_key_idx on public.checkout_orders(analytics_order_key) where analytics_order_key is not null;
alter table public.analytics_cohorts enable row level security;
alter table public.analytics_events enable row level security;
alter table public.analytics_rate_limits enable row level security;
revoke all on public.analytics_cohorts,public.analytics_events,public.analytics_rate_limits from public,anon,authenticated;
grant all on public.analytics_cohorts,public.analytics_events,public.analytics_rate_limits to service_role;
grant usage,select on sequence public.analytics_events_id_seq to service_role;

create function public.analytics_start(p_hash text,p_bucket text) returns boolean language plpgsql security definer set search_path='' as $$
declare created timestamptz;hits_now integer;
begin
 if p_hash is null or p_hash !~ '^[a-f0-9]{64}$' or p_bucket is null or p_bucket !~ '^[a-f0-9]{64}$' then return false;end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_hash,0));
 if exists(select 1 from public.analytics_revoked where hash=p_hash and expires_at>now())then return false;end if;
 select created_at into created from public.analytics_cohorts where hash=p_hash;
 if found then return created>now()-interval '30 minutes';end if;
 insert into public.analytics_rate_limits(bucket,hits,expires_at)values(p_bucket,1,now()+interval '1 hour')
 on conflict(bucket)do update set hits=case when analytics_rate_limits.expires_at<now() then 1 else analytics_rate_limits.hits+1 end,
 expires_at=case when analytics_rate_limits.expires_at<now() then now()+interval '1 hour' else analytics_rate_limits.expires_at end returning hits into hits_now;
 if hits_now>120 then return false;end if;
 insert into public.analytics_cohorts(hash)values(p_hash)on conflict do nothing;return true;
end;$$;
create function public.analytics_record_client(p_hash text,p_kind text,p_destination text) returns boolean language plpgsql security definer set search_path='' as $$
begin
 if p_kind is null or p_kind not in ('destination_view','add_to_cart') then return false;end if;
 perform 1 from public.analytics_cohorts where hash=p_hash and created_at>now()-interval '30 minutes' for update;
 if not found then return false;end if;
 if not exists(select 1 from public.catalog_destinations where slug=p_destination and is_published)then return false;end if;
 if(select count(*)from public.analytics_events where cohort_hash=p_hash)>=120 then return false;end if;
 insert into public.analytics_events(cohort_hash,kind,destination)values(p_hash,p_kind,p_destination)on conflict do nothing;
 return found;
end;$$;
create function public.analytics_attach_checkout(p_order uuid,p_hash text,p_started_at timestamptz default now()) returns boolean language plpgsql security definer set search_path='' as $$
declare o public.checkout_orders;
begin
 select * into o from public.checkout_orders where id=p_order for update;
 if not found or o.status not in ('pending','paid') or not o.livemode or (o.analytics_cohort is not null and o.analytics_cohort<>p_hash)then return false;end if;
 if p_started_at is null or p_started_at>now()+interval '5 seconds' or (o.status='paid' and coalesce(o.paid_at,o.created_at)<p_started_at)then return false;end if;
 if not exists(select 1 from public.analytics_cohorts where hash=p_hash and created_at>now()-interval '30 minutes' and created_at<=p_started_at)then return false;end if;
 update public.checkout_orders set analytics_cohort=p_hash,analytics_order_key=coalesce(analytics_order_key,gen_random_uuid())where id=o.id returning * into o;
 insert into public.analytics_events(cohort_hash,kind,order_key)values(p_hash,'begin_checkout',o.analytics_order_key)on conflict do nothing;
 -- The after-response task can race a fast signed callback; only a payment after this attempt is eligible.
 if o.status='paid' then insert into public.analytics_events(cohort_hash,kind,order_key)values(p_hash,'paid',o.analytics_order_key)on conflict do nothing;end if;
 return true;
end;$$;
create function public.analytics_record_paid() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status='paid' and old.status is distinct from 'paid' and new.livemode and new.analytics_cohort is not null and new.analytics_order_key is not null then
  insert into public.analytics_events(cohort_hash,kind,order_key)select hash,'paid',new.analytics_order_key from public.analytics_cohorts where hash=new.analytics_cohort and created_at>now()-interval '30 minutes' on conflict do nothing;
 end if;
 return new;
exception when others then
 -- Optional measurement must never fail a confirmed financial transaction.
 return new;
end;$$;
create trigger analytics_paid_order after update of status on public.checkout_orders for each row execute function public.analytics_record_paid();
create function public.analytics_forget(p_hash text) returns boolean language plpgsql security definer set search_path='' as $$
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_hash,0));
 insert into public.analytics_revoked(hash,expires_at)values(p_hash,now()+interval '30 minutes')on conflict(hash)do update set expires_at=excluded.expires_at;
 -- Lock financial rows before deleting the cohort; never invert payment-trigger lock order.
 update public.checkout_orders set analytics_cohort=null,analytics_order_key=null where analytics_cohort=p_hash;
 delete from public.analytics_cohorts where hash=p_hash;return true;
end;$$;
create function public.analytics_cleanup() returns void language plpgsql security definer set search_path='' as $$
begin
 update public.checkout_orders set analytics_cohort=null,analytics_order_key=null where analytics_cohort in(select hash from public.analytics_cohorts where created_at<now()-interval '30 days');
 delete from public.analytics_cohorts where created_at<now()-interval '30 days';
 delete from public.analytics_rate_limits where expires_at<now();
 delete from public.analytics_revoked where expires_at<now();
end;$$;
create function public.admin_analytics(p_actor uuid,p_days integer default 30) returns jsonb language plpgsql security definer set search_path='' as $$
declare since_time timestamptz:=now()-make_interval(days=>greatest(1,least(coalesce(p_days,30),30)));
begin
 if not exists(select 1 from public.admin_memberships where user_id=p_actor)then raise exception 'admin_required';end if;
 return jsonb_build_object(
 'days',greatest(1,least(coalesce(p_days,30),30)),
 'funnel',(select jsonb_build_object('sessions',count(distinct c.hash),'view',count(distinct c.hash)filter(where e.kind='destination_view'),'cart',count(distinct c.hash)filter(where e.kind='add_to_cart'),'checkout',count(distinct c.hash)filter(where e.kind='begin_checkout'),'paid',count(distinct c.hash)filter(where e.kind='paid'))from public.analytics_cohorts c left join public.analytics_events e on e.cohort_hash=c.hash where c.created_at>=since_time),
 'destinations',(select coalesce(jsonb_agg(to_jsonb(x)),'[]')from(select d.slug,d.name,count(distinct e.cohort_hash)filter(where e.kind='destination_view')as views,count(distinct e.cohort_hash)filter(where e.kind='add_to_cart')as carts from public.analytics_events e join public.analytics_cohorts c on c.hash=e.cohort_hash join public.catalog_destinations d on d.slug=e.destination where c.created_at>=since_time group by d.slug,d.name order by views desc,carts desc,d.slug limit 10)x),
 'financial',(select jsonb_build_object('orders',count(*),'grossCents',coalesce(sum(amount_total),0))from public.checkout_orders where livemode and status='paid' and coalesce(paid_at,created_at)>=since_time));
end;$$;
create function public.configure_analytics_retention() returns boolean language plpgsql security definer set search_path='' as $$
begin perform cron.schedule('mts-analytics-retention','15 4 * * *','select public.analytics_cleanup()');return true;end;$$;
revoke all on function public.analytics_start(text,text),public.analytics_record_client(text,text,text),public.analytics_attach_checkout(uuid,text,timestamptz),public.analytics_record_paid(),public.analytics_forget(text),public.analytics_cleanup(),public.admin_analytics(uuid,integer),public.configure_analytics_retention() from public,anon,authenticated;
grant execute on function public.analytics_start(text,text),public.analytics_record_client(text,text,text),public.analytics_attach_checkout(uuid,text,timestamptz),public.analytics_forget(text),public.analytics_cleanup(),public.admin_analytics(uuid,integer),public.configure_analytics_retention() to service_role;
commit;
