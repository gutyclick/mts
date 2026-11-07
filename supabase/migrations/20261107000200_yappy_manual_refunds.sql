-- Record a Yappy refund already completed outside MyTripSim. Never transfers funds.
begin;
alter table public.refund_requests add column payment_provider text not null default 'stripe' check(payment_provider in ('stripe','yappy'));
alter table public.refund_requests alter column payment_intent drop not null;
alter table public.refund_requests add constraint refund_provider_identity check (
 (payment_provider='stripe' and payment_intent is not null)
 or (payment_provider='yappy' and payment_intent is null and stripe_refund_id is null and state in ('approved','succeeded'))
);
create table public.checkout_yappy_refund_receipts (
 refund_id uuid primary key references public.refund_requests(id),
 provider_reference text not null unique check(length(btrim(provider_reference)) between 3 and 200),
 recorded_by uuid not null,recorded_at timestamptz not null default now()
);
alter table public.checkout_yappy_refund_receipts enable row level security;
revoke all on public.checkout_yappy_refund_receipts from public,anon,authenticated;
grant select,insert on public.checkout_yappy_refund_receipts to service_role;
create function public.admin_record_yappy_refund(p_actor uuid,p_order uuid,p_units uuid[],p_reason text,p_reference text,p_ack boolean)returns uuid
language plpgsql security definer set search_path='' as $$
declare o public.checkout_orders;a public.checkout_yappy_attempts;r public.refund_requests;rid uuid:=gen_random_uuid();n integer;total bigint;prior_total bigint;
begin
 if not exists(select 1 from public.admin_memberships where user_id=p_actor) then raise exception 'admin_required';end if;
 if p_ack is distinct from true or coalesce(length(btrim(p_reference)),0) not between 3 and 200 or p_reference~'[[:cntrl:]]'
 or coalesce(length(btrim(p_reason)),0) not between 10 and 1000 then raise exception 'refund_confirmation_required';end if;
 if coalesce(cardinality(p_units),0) not between 1 and 200 or (select count(distinct x)from unnest(p_units)x)<>cardinality(p_units)then raise exception 'invalid_units';end if;
 select * into o from public.checkout_orders where id=p_order for update;
 select * into a from public.checkout_yappy_attempts where order_id=o.id;
 if o.id is null or o.status<>'paid' or a.state is distinct from 'paid' or o.payment_currency is distinct from 'USD' or a.expected_amount_cents is distinct from o.payment_total then raise exception 'paid_yappy_order_required';end if;
 select rr.* into r from public.checkout_yappy_refund_receipts yr join public.refund_requests rr on rr.id=yr.refund_id where yr.provider_reference=btrim(p_reference);
 if found then
  if r.order_id<>o.id or r.reason<>btrim(p_reason) or r.state<>'succeeded' or
   (select array_agg(unit_id order by unit_id)from public.refund_units where request_id=r.id) is distinct from (select array_agg(x order by x)from unnest(p_units)x)then raise exception 'refund_reference_conflict';end if;
  return r.id;
 end if;
 perform 1 from public.esim_fulfillments where id=any(p_units) order by id for update;
 if exists(select 1 from public.esim_fulfillments where id=any(p_units) and lease_until>now())then raise exception 'fulfillment_busy';end if;
 if exists(select 1 from public.refund_units where unit_id=any(p_units) and active)then raise exception 'unit_already_refunded';end if;
 select count(*),sum(coalesce(i.payment_unit_amount,i.unit_amount))into n,total
 from public.esim_fulfillments f join public.checkout_order_items i on i.order_id=f.order_id and i.plan_id=f.plan_id where f.id=any(p_units)and f.order_id=o.id;
 select coalesce(sum(amount),0)into prior_total from public.refund_requests where order_id=o.id and state='succeeded';
 if n<>cardinality(p_units) or total is null or total<=0 or total+prior_total>o.payment_total then raise exception 'refund_amount_mismatch';end if;
 insert into public.refund_requests(id,order_id,amount,currency,livemode,payment_intent,payment_provider,reason,requested_by,approved_by,approved_at,state)
 values(rid,o.id,total,'usd',o.livemode,null,'yappy',btrim(p_reason),p_actor,p_actor,now(),'approved');
 insert into public.refund_units(request_id,unit_id,amount,active,held)
 select rid,f.id,coalesce(i.payment_unit_amount,i.unit_amount),true,true from public.esim_fulfillments f join public.checkout_order_items i on i.order_id=f.order_id and i.plan_id=f.plan_id where f.id=any(p_units);
 insert into public.checkout_yappy_refund_receipts(refund_id,provider_reference,recorded_by)values(rid,btrim(p_reference),p_actor);
 insert into public.refund_audit(request_id,actor,action)values(rid,p_actor,'yappy_external_refund_verified');
 -- Existing transition hooks reverse rewards/progress and preserve the unit audit.
 update public.refund_requests set state='succeeded',updated_at=now() where id=rid;
 return rid;
end;$$;
revoke all on function public.admin_record_yappy_refund(uuid,uuid,uuid[],text,text,boolean) from public,anon,authenticated;
grant execute on function public.admin_record_yappy_refund(uuid,uuid,uuid[],text,text,boolean) to service_role;
commit;
