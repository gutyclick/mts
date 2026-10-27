begin;
-- The existing catalog uses explicit mts_<sha256-prefix> Stripe Product IDs.
-- Keep exact product binding/price checks; recognize both imported and native IDs.
create or replace function public.bind_checkout_payment(p_id uuid,p_session text,p_bindings jsonb,p_expires timestamptz,p_touch boolean)returns boolean language plpgsql security definer set search_path='' as $$
declare o public.checkout_orders;n integer;
begin
 select * into o from public.checkout_orders where id=p_id for update;
 if not found or o.status<>'pending'or o.payment_currency is null or p_session is null or p_session!~(case when o.livemode then '^cs_live_[A-Za-z0-9]+$'else '^cs_test_[A-Za-z0-9]+$'end)or(o.stripe_session_id is not null and o.stripe_session_id<>p_session)then raise exception 'payment_mismatch';end if;
 if p_expires is null or p_expires<=now()or p_expires>now()+interval '25 hours'or p_touch is null then raise exception 'payment_mismatch';end if;
 if p_bindings is null or jsonb_typeof(p_bindings)<>'array'or jsonb_array_length(p_bindings)not between 1 and 20 then raise exception 'payment_mismatch';end if;
 n:=jsonb_array_length(p_bindings);
 if(select count(*)from public.checkout_order_items where order_id=o.id)<>n or(select count(distinct b->>'planId')from jsonb_array_elements(p_bindings)b)<>n or(select count(distinct b->>'priceId')from jsonb_array_elements(p_bindings)b)<>n then raise exception 'payment_mismatch';end if;
 if exists(select 1 from jsonb_array_elements(p_bindings)b left join public.checkout_order_items i on i.order_id=o.id and i.plan_id=b->>'planId'where i.plan_id is null or i.payment_unit_amount is null or jsonb_typeof(b->'priceId')is distinct from 'string'or jsonb_typeof(b->'productId')is distinct from 'string'or jsonb_typeof(b->'unitAmount')is distinct from 'number'or jsonb_typeof(b->'quantity')is distinct from 'number'or jsonb_typeof(b)<>'object'or b-array['planId','priceId','unitAmount','quantity','productId']<>'{}'::jsonb or not(b?&array['planId','priceId','unitAmount','quantity','productId'])or(b->>'priceId')!~'^price_[A-Za-z0-9]+$'or(b->>'productId')!~'^(prod_[A-Za-z0-9]+|mts_[a-f0-9]{32})$'or(b->>'quantity')::integer<>i.quantity or(b->>'unitAmount')::integer<>i.payment_unit_amount)then raise exception 'payment_mismatch';end if;
 update public.checkout_order_items i set payment_stripe_price_id=b->>'priceId',payment_product_id=b->>'productId'from jsonb_array_elements(p_bindings)b where i.order_id=o.id and i.plan_id=b->>'planId';
 update public.checkout_orders set stripe_session_id=p_session,expires_at=p_expires,payment_last_seen_at=case when p_touch then now()else payment_last_seen_at end where id=o.id;return true;
end;$$;
revoke all on function public.bind_checkout_payment(uuid,text,jsonb,timestamptz,boolean)from public,anon,authenticated;
grant execute on function public.bind_checkout_payment(uuid,text,jsonb,timestamptz,boolean)to service_role;
commit;
