begin;
create table public.admin_memberships(user_id uuid primary key references auth.users(id) on delete cascade,created_at timestamptz not null default now());
alter table public.admin_memberships enable row level security;
revoke all on public.admin_memberships from public,anon,authenticated;
grant select(user_id) on public.admin_memberships to authenticated;
grant all on public.admin_memberships to service_role;
create policy own_admin_membership on public.admin_memberships for select to authenticated using(user_id=(select auth.uid()));
create table public.admin_followups(unit_id uuid primary key references public.esim_fulfillments(id),note text not null default '' check(length(note)<=1000),resolved boolean not null default false,updated_by uuid not null references auth.users(id),updated_at timestamptz not null default now());
create table public.admin_audit(id bigint generated always as identity primary key,actor_id uuid not null references auth.users(id),action text not null check(action in ('followup_saved','provider_checked','provider_check_failed')),unit_id uuid not null references public.esim_fulfillments(id),created_at timestamptz not null default now());
alter table public.admin_followups enable row level security;
alter table public.admin_audit enable row level security;
revoke all on public.admin_followups,public.admin_audit from public,anon,authenticated;
grant all on public.admin_followups,public.admin_audit to service_role;
grant usage,select on sequence public.admin_audit_id_seq to service_role;
alter table public.esim_fulfillments add column provider_status text,add column provider_smdp_status text,add column provider_checked_at timestamptz,add column provider_usage_updated_at timestamptz,add column sync_token uuid,add column sync_until timestamptz;
alter table public.customer_esims drop constraint customer_esims_status_check;
alter table public.customer_esims add constraint customer_esims_status_check check(status in ('ready','active','expired','suspended'));

create view public.admin_plan_overview with(security_invoker=true) as
select f.id,f.order_id,o.user_id,coalesce(u.email,o.billing_email,o.recipient_email) as email,
 o.recipient_email,i.plan_name,i.destination_name,i.data_gb,i.days,f.state as delivery_state,
 case when f.provider_status='IN_USE' then 'active' when f.provider_status='SUSPENDED' then 'suspended'
  when f.provider_status in ('USED_UP','UNUSED_EXPIRED','USED_EXPIRED','CANCEL','REVOKE') then 'expired'
  when f.provider_esim_id is not null then coalesce(e.status,'ready') else f.state end as status,
 f.volume_bytes,f.used_bytes,f.expires_at,f.provider_checked_at,f.provider_usage_updated_at,
 o.livemode,f.qa_authorized,f.created_at,coalesce(n.note,'') as note,coalesce(n.resolved,false) as resolved,
 case when f.state='review' then 'delivery_review' when f.provider_status='SUSPENDED' then 'suspended'
  when f.used_bytes is not null and f.used_bytes>=f.volume_bytes*0.85 and coalesce(e.status,'ready')<>'expired' then 'low_data'
  when coalesce(e.status,'ready')='active' and f.expires_at>now() and f.expires_at<now()+interval '48 hours' then 'expiry_soon'
  when n.unit_id is not null and not n.resolved then 'followup' else null end as attention,
 (f.provider_esim_id is not null) as can_sync
from public.esim_fulfillments f join public.checkout_orders o on o.id=f.order_id
join public.checkout_order_items i on i.order_id=f.order_id and i.plan_id=f.plan_id
left join auth.users u on u.id=o.user_id left join public.customer_esims e on e.id=f.id
left join public.admin_followups n on n.unit_id=f.id;
revoke all on public.admin_plan_overview from public,anon,authenticated;
grant select on public.admin_plan_overview to service_role;

create function public.admin_overview(p_actor uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if not exists(select 1 from public.admin_memberships where user_id=p_actor) then raise exception 'admin_required'; end if;
 select jsonb_build_object(
  'users',(select count(*) from auth.users),
  'activePlans',(select count(*) from public.admin_plan_overview where status='active'),
  'readyPlans',(select count(*) from public.admin_plan_overview where status='ready'),
  'attention',(select count(*) from public.admin_plan_overview where attention is not null),
  'liveRevenueCents',coalesce((select sum(amount_total) from public.checkout_orders where livemode and status='paid'),0),
  'testOrders',(select count(*) from public.checkout_orders where not livemode),
  'recentPlans',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from (select * from public.admin_plan_overview where can_sync order by created_at desc limit 5)x),
  'activity',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from (
   select a.action,a.unit_id,a.created_at from public.admin_audit a order by a.created_at desc limit 8)x),
  'daily',(select jsonb_agg(jsonb_build_object('day',d::date,'orders',(select count(*) from public.checkout_orders o where o.created_at>=d and o.created_at<d+interval '1 day' and o.livemode and o.status='paid')) order by d)
   from generate_series(date_trunc('day',now())-interval '6 days',date_trunc('day',now()),interval '1 day')d)
 ) into result;return result;
end;$$;

create function public.admin_records(p_actor uuid,p_tab text,p_query text default '',p_status text default '',p_environment text default 'all',p_page integer default 1,p_user uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare payload jsonb;term text;offset_rows integer;
begin
 if not exists(select 1 from public.admin_memberships where user_id=p_actor) then raise exception 'admin_required'; end if;
 if p_tab not in ('users','plans','orders','attention') or length(p_query)>80 or p_environment not in ('all','live','test','qa') or p_page not between 1 and 100000 then raise exception 'invalid_filter'; end if;
 term:='%'||replace(replace(replace(p_query,E'\\',E'\\\\'),'%',E'\\%'),'_',E'\\_')||'%';offset_rows:=(p_page-1)*20;
 if p_tab='users' then
  with records as (
   select u.id,u.email,left(coalesce(u.raw_user_meta_data->>'first_name','')||' '||coalesce(u.raw_user_meta_data->>'last_name',''),150) as name,u.created_at,u.email_confirmed_at is not null as confirmed,
    (select count(*) from public.admin_plan_overview p where p.user_id=u.id and p.status='active') as active_plans,
    (select count(*) from public.admin_plan_overview p where p.user_id=u.id and p.can_sync) as issued_plans,
    (select count(*) from public.checkout_orders o where o.user_id=u.id and o.status='paid') as paid_orders
   from auth.users u where (u.email ilike term or coalesce(u.raw_user_meta_data->>'first_name','') ilike term or coalesce(u.raw_user_meta_data->>'last_name','') ilike term)
   and (p_status<>'active' or exists(select 1 from public.admin_plan_overview p where p.user_id=u.id and p.status='active'))
  ) select jsonb_build_object('total',(select count(*) from records),'rows',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from (select * from records order by created_at desc,id limit 20 offset offset_rows)x)) into payload;
 elsif p_tab='orders' then
  with records as (
   select o.id,o.user_id,coalesce(u.email,o.billing_email,o.recipient_email) as email,o.status,o.amount_total,o.livemode,o.created_at,
    (select jsonb_agg(jsonb_build_object('name',i.plan_name,'quantity',i.quantity) order by i.plan_id) from public.checkout_order_items i where i.order_id=o.id) as items
   from public.checkout_orders o left join auth.users u on u.id=o.user_id
   where (coalesce(u.email,o.billing_email,o.recipient_email) ilike term or o.id::text ilike term)
    and (p_status='' or o.status=p_status) and (p_user is null or o.user_id=p_user)
    and (p_environment='all' or (p_environment='live' and o.livemode) or (p_environment='test' and not o.livemode) or (p_environment='qa' and exists(select 1 from public.esim_fulfillments f where f.order_id=o.id and f.qa_authorized)))
  ) select jsonb_build_object('total',(select count(*) from records),'rows',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from (select * from records order by created_at desc,id limit 20 offset offset_rows)x)) into payload;
 else
  with records as (
   select * from public.admin_plan_overview p where (p_tab<>'attention' or p.attention is not null)
    and (p.email ilike term or p.plan_name ilike term or p.order_id::text ilike term)
    and (p_status='' or p.status=p_status) and (p_user is null or p.user_id=p_user)
    and (p_environment='all' or (p_environment='live' and p.livemode) or (p_environment='test' and not p.livemode and not p.qa_authorized) or (p_environment='qa' and p.qa_authorized))
  ) select jsonb_build_object('total',(select count(*) from records),'rows',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from (select * from records order by (attention is not null) desc,created_at desc,id limit 20 offset offset_rows)x)) into payload;
 end if;
 return payload||jsonb_build_object('page',p_page,'pageSize',20);
end;$$;

create function public.admin_followup_save(p_actor uuid,p_unit uuid,p_note text,p_resolved boolean) returns boolean language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.admin_memberships where user_id=p_actor) then raise exception 'admin_required'; end if;
 if p_note is null or length(p_note)>1000 or p_resolved is null then raise exception 'invalid_note'; end if;
 insert into public.admin_followups(unit_id,note,resolved,updated_by) values(p_unit,p_note,p_resolved,p_actor)
 on conflict(unit_id) do update set note=excluded.note,resolved=excluded.resolved,updated_by=p_actor,updated_at=now();
 insert into public.admin_audit(actor_id,action,unit_id) values(p_actor,'followup_saved',p_unit);return true;
end;$$;

create function public.admin_sync_claim(p_actor uuid,p_unit uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare f public.esim_fulfillments;
begin
 if not exists(select 1 from public.admin_memberships where user_id=p_actor) then raise exception 'admin_required'; end if;
 select * into f from public.esim_fulfillments where id=p_unit for update;
 if not found or f.provider_esim_id is null or f.provider_order_no is null then raise exception 'unavailable_esim'; end if;
 if f.sync_until>now() or f.provider_checked_at>now()-interval '60 seconds' then return null; end if;
 update public.esim_fulfillments set sync_token=gen_random_uuid(),sync_until=now()+interval '90 seconds' where id=p_unit returning * into f;
 return jsonb_build_object('token',f.sync_token,'orderNo',f.provider_order_no,'esimId',f.provider_esim_id,'iccid',f.iccid,'volume',f.volume_bytes);
end;$$;

create function public.admin_sync_finish(p_actor uuid,p_unit uuid,p_token uuid,p_status text,p_smdp text,p_used bigint,p_expiry timestamptz,p_usage_at timestamptz,p_ok boolean) returns boolean language plpgsql security definer set search_path='' as $$
declare f public.esim_fulfillments;customer_state text;
begin
 if not exists(select 1 from public.admin_memberships where user_id=p_actor) then raise exception 'admin_required'; end if;
 select * into f from public.esim_fulfillments where id=p_unit for update;
 if not found or f.sync_token is distinct from p_token or f.sync_until<now() then return false; end if;
 if p_ok then
  if p_status is null or length(p_status)>100 or length(p_smdp)>100 or p_used<0 then raise exception 'invalid_profile'; end if;
  customer_state:=case when p_status='IN_USE' then 'active' when p_status='SUSPENDED' then 'suspended'
   when p_status in ('USED_UP','UNUSED_EXPIRED','USED_EXPIRED','CANCEL','REVOKE') then 'expired' when p_status='GOT_RESOURCE' then 'ready' else null end;
  update public.esim_fulfillments set provider_status=p_status,provider_smdp_status=p_smdp,provider_checked_at=now(),
   used_bytes=coalesce(p_used,used_bytes),expires_at=coalesce(p_expiry,expires_at),provider_usage_updated_at=coalesce(p_usage_at,provider_usage_updated_at),sync_token=null,sync_until=null where id=p_unit;
  update public.customer_esims set status=coalesce(customer_state,status),used_gb=coalesce(p_used::numeric/1073741824,used_gb),
   usage_updated_at=coalesce(p_usage_at,usage_updated_at),expires_at=coalesce(p_expiry,expires_at) where id=p_unit;
 else update public.esim_fulfillments set sync_token=null,sync_until=now()+interval '60 seconds' where id=p_unit; end if;
 insert into public.admin_audit(actor_id,action,unit_id) values(p_actor,case when p_ok then 'provider_checked' else 'provider_check_failed' end,p_unit);return true;
end;$$;
revoke all on function public.admin_overview(uuid),public.admin_records(uuid,text,text,text,text,integer,uuid),public.admin_followup_save(uuid,uuid,text,boolean),public.admin_sync_claim(uuid,uuid),public.admin_sync_finish(uuid,uuid,uuid,text,text,bigint,timestamptz,timestamptz,boolean) from public,anon,authenticated;
grant execute on function public.admin_overview(uuid),public.admin_records(uuid,text,text,text,text,integer,uuid),public.admin_followup_save(uuid,uuid,text,boolean),public.admin_sync_claim(uuid,uuid),public.admin_sync_finish(uuid,uuid,uuid,text,text,bigint,timestamptz,timestamptz,boolean) to service_role;
commit;
