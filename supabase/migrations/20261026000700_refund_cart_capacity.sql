begin;
-- Support a full cart: at most 20 plans × 10 units. Keep applied migration 006 immutable.
create or replace function public.admin_refund_request(p_actor uuid,p_order uuid,p_units uuid[],p_reason text) returns uuid language plpgsql security definer set search_path='' as $$
declare o public.checkout_orders;total bigint;n integer;rid uuid:=gen_random_uuid();
begin
 if not exists(select 1 from public.admin_memberships where user_id=p_actor) then raise exception 'admin_required';end if;
 if coalesce(cardinality(p_units),0) not between 1 and 200 or (select count(distinct x) from unnest(p_units)x)<>cardinality(p_units) then raise exception 'invalid_units';end if;
 select * into o from public.checkout_orders where id=p_order for update;
 if not found or o.status<>'paid' or o.stripe_payment_intent is null then raise exception 'paid_order_required';end if;
 perform 1 from public.esim_fulfillments where id=any(p_units) order by id for update;
 select count(*),sum(i.unit_amount) into n,total from public.esim_fulfillments f join public.checkout_order_items i on i.order_id=f.order_id and i.plan_id=f.plan_id where f.id=any(p_units) and f.order_id=o.id;
 if n<>cardinality(p_units) or total is null or total>o.amount_total then raise exception 'invalid_units';end if;
 insert into public.refund_requests(id,order_id,amount,currency,livemode,payment_intent,reason,requested_by)values(rid,o.id,total,o.currency,o.livemode,o.stripe_payment_intent,btrim(p_reason),p_actor);
 insert into public.refund_units(request_id,unit_id,amount)select rid,f.id,i.unit_amount from public.esim_fulfillments f join public.checkout_order_items i on i.order_id=f.order_id and i.plan_id=f.plan_id where f.id=any(p_units);
 insert into public.refund_audit(request_id,actor,action)values(rid,p_actor,'requested');return rid;
end;$$;
revoke all on function public.admin_refund_request(uuid,uuid,uuid[],text) from public,anon,authenticated;
grant execute on function public.admin_refund_request(uuid,uuid,uuid[],text) to service_role;
commit;
