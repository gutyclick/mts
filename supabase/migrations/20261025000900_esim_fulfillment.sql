begin;
alter table public.customer_orders add column checkout_order_id uuid references public.checkout_orders(id);
create table public.esim_fulfillments (
 id uuid primary key default gen_random_uuid(),
 order_id uuid not null,plan_id text not null,unit_index integer not null check(unit_index between 1 and 10),
 state text not null check(state in ('queued','provider_pending','ready','sent','review','test_skipped')),
 -- Operator-only authorization for one explicitly approved real provisioning QA.
 qa_authorized boolean not null default false,
 provider_slug text,volume_bytes bigint not null check(volume_bytes>0),days integer not null check(days>0),
 provider_transaction_id text not null unique,
 provider_order_no text unique,provider_esim_id text unique,iccid text unique check(iccid is null or iccid ~ '^[0-9]{15,25}$'),
 smdp_address text check(smdp_address is null or smdp_address ~ '^[a-zA-Z0-9.-]+$'),
 activation_code text check(activation_code is null or activation_code ~ '^[a-zA-Z0-9_-]+$'),
 apn text,expires_at timestamptz,used_bytes bigint check(used_bytes>=0),
 access_nonce uuid not null default gen_random_uuid(),
 attempts integer not null default 0,next_attempt_at timestamptz not null default now(),
 lease_token uuid,lease_until timestamptz,last_error text check(last_error in ('provider_unavailable','unavailable_plan','invalid_allocation','email_unavailable','email_uncertain','retry_exhausted','configuration')),
 email_started_at timestamptz,email_id text unique,sent_at timestamptz,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(order_id,plan_id,unit_index),
 foreign key(order_id,plan_id) references public.checkout_order_items(order_id,plan_id),
 check(state not in ('ready','sent') or (provider_order_no is not null and provider_esim_id is not null and iccid is not null and smdp_address is not null and activation_code is not null)),
 check(state<>'sent' or (email_id is not null and sent_at is not null))
);
alter table public.esim_fulfillments enable row level security;
revoke all on public.esim_fulfillments from public,anon,authenticated;
grant all on public.esim_fulfillments to service_role;
grant all on public.customer_orders,public.customer_esims to service_role;
create index fulfillment_due_idx on public.esim_fulfillments(next_attempt_at) where state in ('queued','provider_pending','ready');

create function public.enqueue_paid_esims() returns trigger language plpgsql security definer set search_path='' as $$
declare line record;unit integer;unit_id uuid;
begin
 if new.status<>'paid' or old.status='paid' then return new; end if;
 for line in select i.*,b.provider_slug,b.volume_bytes,b.is_available from public.checkout_order_items i
  left join public.provider_package_bindings b on b.plan_id=i.plan_id where i.order_id=new.id loop
  for unit in 1..line.quantity loop
   unit_id:=gen_random_uuid();
   insert into public.esim_fulfillments(id,order_id,plan_id,unit_index,state,provider_slug,volume_bytes,days,provider_transaction_id,last_error)
   values(unit_id,new.id,line.plan_id,unit,
    case when not new.livemode then 'test_skipped' when line.is_available is true then 'queued' else 'review' end,
    line.provider_slug,coalesce(line.volume_bytes,(line.data_gb*1073741824)::bigint),line.days,'mts_'||replace(unit_id::text,'-',''),
    case when new.livemode and line.is_available is distinct from true then 'unavailable_plan' else null end)
   on conflict(order_id,plan_id,unit_index) do nothing;
  end loop;
 end loop;
 return new;
end;
$$;
revoke all on function public.enqueue_paid_esims() from public,anon,authenticated;
create trigger enqueue_paid_esims after update of status on public.checkout_orders for each row execute function public.enqueue_paid_esims();

create function public.claim_esim_fulfillments(p_limit integer default 2) returns setof public.esim_fulfillments language plpgsql security definer set search_path='' as $$
begin
 update public.esim_fulfillments set state='review',last_error='retry_exhausted',lease_token=null,lease_until=null
 where state in ('queued','provider_pending','ready') and attempts>=24 and (lease_until is null or lease_until<now());
 return query with due as (
  select f.id from public.esim_fulfillments f join public.checkout_orders o on o.id=f.order_id
  where o.status='paid' and (o.livemode or f.qa_authorized) and f.state in ('queued','provider_pending','ready')
   and f.next_attempt_at<=now() and (f.lease_until is null or f.lease_until<now()) and f.attempts<24
  order by f.next_attempt_at limit least(greatest(p_limit,1),5) for update of f skip locked
 ) update public.esim_fulfillments f set lease_until=now()+interval '120 seconds',lease_token=gen_random_uuid(),attempts=attempts+1,updated_at=now()
 from due where f.id=due.id returning f.*;
end;
$$;
revoke all on function public.claim_esim_fulfillments(integer) from public,anon,authenticated;
grant execute on function public.claim_esim_fulfillments(integer) to service_role;

create function public.publish_esim_profile(p_id uuid,p_lease uuid,p_profile jsonb) returns boolean language plpgsql security definer set search_path='' as $$
declare f public.esim_fulfillments;o public.checkout_orders;i public.checkout_order_items;esim_state text;
begin
 select * into f from public.esim_fulfillments where id=p_id for update;
 if not found or f.lease_token is distinct from p_lease or f.lease_until<now() or f.state<>'provider_pending' then return false; end if;
 select * into o from public.checkout_orders where id=f.order_id;
 if o.status<>'paid' or (not o.livemode and not f.qa_authorized) then raise exception 'unpaid_order'; end if;
 if p_profile->>'orderNo' is distinct from f.provider_order_no or p_profile->>'packageSlug' is distinct from f.provider_slug
  or (p_profile->>'volumeBytes')::bigint is distinct from f.volume_bytes or (p_profile->>'days')::integer is distinct from f.days
  or p_profile->>'status' not in ('GOT_RESOURCE','IN_USE')
  or coalesce(p_profile->>'iccid','') !~ '^[0-9]{15,25}$'
  or coalesce(p_profile->>'smdpAddress','') !~ '^[a-zA-Z0-9.-]+$'
  or coalesce(p_profile->>'activationCode','') !~ '^[a-zA-Z0-9_-]+$'
  or coalesce(length(p_profile->>'transactionId'),0) not between 1 and 200 then raise exception 'invalid_allocation'; end if;
 update public.esim_fulfillments set state='ready',provider_esim_id=p_profile->>'transactionId',iccid=p_profile->>'iccid',
  smdp_address=p_profile->>'smdpAddress',activation_code=p_profile->>'activationCode',apn=left(p_profile->>'apn',200),
  expires_at=(p_profile->>'expiresAt')::timestamptz,used_bytes=(p_profile->>'usedBytes')::bigint,
  attempts=0,next_attempt_at=now(),lease_token=null,lease_until=null,last_error=null,updated_at=now() where id=p_id;
 if o.user_id is not null then
  select * into i from public.checkout_order_items where order_id=o.id and plan_id=f.plan_id;
  insert into public.customer_orders(id,user_id,status,destination_name,destination_slug,plan_id,plan_name,data_gb,days,checkout_order_id)
  values(f.id,o.user_id,'completed',i.destination_name,i.destination_slug,i.plan_id,i.plan_name,i.data_gb,i.days,o.id);
  esim_state:=case when p_profile->>'status'='IN_USE' then 'active' else 'ready' end;
  insert into public.customer_esims(id,user_id,order_id,status,used_gb,usage_updated_at,expires_at,iccid,smdp_address,activation_code)
  values(f.id,o.user_id,f.id,esim_state,(p_profile->>'usedBytes')::numeric/1073741824,
   case when p_profile->>'usedBytes' is not null then now() else null end,(p_profile->>'expiresAt')::timestamptz,p_profile->>'iccid',p_profile->>'smdpAddress',p_profile->>'activationCode');
 end if;
 return true;
end;
$$;
revoke all on function public.publish_esim_profile(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.publish_esim_profile(uuid,uuid,jsonb) to service_role;
commit;
