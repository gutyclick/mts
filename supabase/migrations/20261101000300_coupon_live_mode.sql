-- Test-mode checkouts must never reserve or redeem live coupon capacity.
begin;
create or replace function public.coupon_prepare_payment(p_order uuid,p_identity text,p_quote uuid,p_currency text,p_fx_quote uuid,p_expected integer)returns jsonb language plpgsql security definer set search_path='' as $$
declare o public.checkout_orders;q public.coupon_quotes;c public.coupon_definitions;ss public.coupon_order_snapshots;s jsonb;cart jsonb;
begin
 select * into o from public.checkout_orders where id=p_order for update;
 if not found then raise exception 'pending_order_required';end if;
 if not o.livemode then raise exception 'coupon_live_mode_required';end if;
 select * into ss from public.coupon_order_snapshots where order_id=o.id;
 if found then
  if ss.quote_id is distinct from p_quote or ss.identity_hash is distinct from p_identity or o.payment_currency is distinct from p_currency or o.fx_snapshot_id is distinct from p_fx_quote or o.payment_total is distinct from p_expected then raise exception 'coupon_attempt_conflict';end if;
  return to_jsonb(o);
 end if;
 if o.status<>'pending' or o.payment_currency is not null or o.stripe_session_id is not null or exists(select 1 from public.simcoins_order_snapshots where order_id=o.id)then raise exception 'coupon_order_ineligible';end if;
 select * into q from public.coupon_quotes where id=p_quote and expires_at>now();
 if not found then raise exception 'coupon_quote_expired';end if;
 if q.identity_hash is distinct from p_identity or q.user_id is distinct from o.user_id or q.currency is distinct from p_currency or q.fx_quote_id is distinct from p_fx_quote then raise exception 'coupon_identity';end if;
 -- All cap decisions serialize on this coupon, after the order lock.
 select * into c from public.coupon_definitions where id=q.coupon_id for update;
 perform public.coupon_assert_available(c.id,p_identity,o.user_id);
 if c.version<>q.coupon_version then raise exception 'coupon_quote_changed';end if;
 perform 1 from public.checkout_order_items where order_id=o.id for update;
 select jsonb_agg(jsonb_build_object('destination',destination_slug,'planId',plan_id,'quantity',quantity)order by plan_id)into cart from public.checkout_order_items where order_id=o.id;
 if cart is distinct from q.cart then raise exception 'coupon_cart_changed';end if;
 s:=public.coupon_financial_snapshot(c.id,cart,p_currency,p_fx_quote);
 if s->'lines' is distinct from q.snapshot->'lines' or(s->>'paymentTotal')::integer is distinct from p_expected or o.amount_total is distinct from(s->>'grossCents')::integer
 or exists(select 1 from public.checkout_order_items i join jsonb_array_elements(s->'lines')l on l->>'planId'=i.plan_id where i.order_id=o.id and i.unit_amount<>(l->>'grossUnitCents')::integer)then raise exception 'price_changed';end if;
 insert into public.coupon_order_snapshots(order_id,quote_id,coupon_id,coupon_version,code,identity_hash,snapshot)values(o.id,q.id,c.id,c.version,c.code,p_identity,s);
 insert into public.coupon_usage_reservations(order_id,coupon_id,identity_hash,user_id,discount_usd_cents)values(o.id,c.id,p_identity,o.user_id,(s->>'discountUsdCents')::integer);
 insert into public.coupon_audit_logs(action,coupon_id,order_id,after_value)values('reserved',c.id,o.id,jsonb_build_object('state','reserved','discountUsdCents',s->'discountUsdCents'));
 update public.checkout_order_items i set payment_unit_amount=(l->>'paymentUnitAmount')::integer from jsonb_array_elements(s->'lines')l where i.order_id=o.id and i.plan_id=l->>'planId';
 update public.checkout_orders set payment_currency=p_currency,payment_total=p_expected,fx_snapshot_id=p_fx_quote where id=o.id returning * into o;
 return to_jsonb(o);
end;$$;
commit;

