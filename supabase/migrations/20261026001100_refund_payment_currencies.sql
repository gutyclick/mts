begin;
alter table public.refund_requests drop constraint refund_requests_currency_check;
alter table public.refund_requests add constraint refund_requests_currency_check check(public.fx_currency(upper(currency)));
create or replace function public.admin_refund_request(p_actor uuid,p_order uuid,p_units uuid[],p_reason text) returns uuid language plpgsql security definer set search_path='' as $$
declare o public.checkout_orders;total bigint;n integer;rid uuid:=gen_random_uuid();
begin
 if not exists(select 1 from public.admin_memberships where user_id=p_actor) then raise exception 'admin_required';end if;
 if coalesce(cardinality(p_units),0) not between 1 and 200 or (select count(distinct x) from unnest(p_units)x)<>cardinality(p_units) then raise exception 'invalid_units';end if;
 select * into o from public.checkout_orders where id=p_order for update;
 if not found or o.status<>'paid' or o.stripe_payment_intent is null then raise exception 'paid_order_required';end if;
 perform 1 from public.esim_fulfillments where id=any(p_units) order by id for update;
 select count(*),sum(coalesce(i.payment_unit_amount,i.unit_amount)) into n,total from public.esim_fulfillments f join public.checkout_order_items i on i.order_id=f.order_id and i.plan_id=f.plan_id where f.id=any(p_units) and f.order_id=o.id;
 if n<>cardinality(p_units) or total is null or total>coalesce(o.payment_total,o.amount_total) then raise exception 'invalid_units';end if;
 insert into public.refund_requests(id,order_id,amount,currency,livemode,payment_intent,reason,requested_by)values(rid,o.id,total,lower(coalesce(o.payment_currency,o.currency)),o.livemode,o.stripe_payment_intent,btrim(p_reason),p_actor);
 insert into public.refund_units(request_id,unit_id,amount)select rid,f.id,coalesce(i.payment_unit_amount,i.unit_amount) from public.esim_fulfillments f join public.checkout_order_items i on i.order_id=f.order_id and i.plan_id=f.plan_id where f.id=any(p_units);
 insert into public.refund_audit(request_id,actor,action)values(rid,p_actor,'requested');return rid;
end;$$;

create or replace function public.admin_refund_view(p_actor uuid,p_order uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.admin_memberships where user_id=p_actor) then raise exception 'admin_required';end if;
 return jsonb_build_object(
 'audit',(select coalesce(jsonb_agg(to_jsonb(a)),'[]')from(select a.request_id,a.actor,a.action,a.created_at from public.refund_audit a join public.refund_requests r on r.id=a.request_id where p_order is null or r.order_id=p_order order by a.id desc limit 200)a),
 'recent',(select coalesce(jsonb_agg(to_jsonb(r)),'[]')from(select id,order_id,amount,currency,livemode,state,reason,created_at,updated_at,stripe_refund_id from public.refund_requests where p_order is null or order_id=p_order order by (state in ('requested','approved','processing','pending','review'))desc,created_at desc limit case when p_order is null then 50 else 250 end)r),
 'order',(select jsonb_build_object('id',o.id,'status',o.status,'amount',coalesce(o.payment_total,o.amount_total),'currency',lower(coalesce(o.payment_currency,o.currency)),'livemode',o.livemode,
 'units',(select coalesce(jsonb_agg(jsonb_build_object('id',f.id,'plan',i.plan_name,'destination',i.destination_name,'dataGb',i.data_gb,'days',i.days,'amount',coalesce(i.payment_unit_amount,i.unit_amount),'state',f.state,'issued',f.provider_order_no is not null,'reserved',(select u.request_id from public.refund_units u where u.unit_id=f.id and u.active))order by f.plan_id,f.unit_index),'[]')from public.esim_fulfillments f join public.checkout_order_items i on i.order_id=f.order_id and i.plan_id=f.plan_id where f.order_id=o.id))from public.checkout_orders o where o.id=p_order));
end;$$;


revoke all on function public.admin_refund_request(uuid,uuid,uuid[],text),public.admin_refund_view(uuid,uuid)from public,anon,authenticated;
grant execute on function public.admin_refund_request(uuid,uuid,uuid[],text),public.admin_refund_view(uuid,uuid)to service_role;
commit;
