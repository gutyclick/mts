begin;
alter table public.checkout_orders add payment_currency text,add payment_total integer,add fx_snapshot_id uuid references public.fx_snapshots(id);
alter table public.checkout_orders add constraint checkout_payment_snapshot_complete check(
 (payment_currency is null and payment_total is null and fx_snapshot_id is null)or
 (payment_currency is not null and public.fx_currency(payment_currency)and payment_total is not null and payment_total between 1 and 99999999 and((payment_currency='USD'and fx_snapshot_id is null)or(payment_currency<>'USD'and fx_snapshot_id is not null)))
);
alter table public.checkout_order_items add payment_unit_amount integer check(payment_unit_amount between 1 and 99999999),add payment_stripe_price_id text,add payment_product_id text;
-- Existing owner-only RLS remains the boundary; reveal only that customer's money.
grant select(payment_currency,payment_total)on public.checkout_orders to authenticated;
create function public.protect_checkout_payment_snapshot()returns trigger language plpgsql set search_path='' as $$
begin
 if old.payment_currency is not null and(new.payment_currency is distinct from old.payment_currency or new.payment_total is distinct from old.payment_total or new.fx_snapshot_id is distinct from old.fx_snapshot_id)then raise exception 'immutable_payment_snapshot';end if;return new;
end;$$;
create trigger protect_checkout_payment_snapshot before update on public.checkout_orders for each row execute function public.protect_checkout_payment_snapshot();
create function public.protect_checkout_payment_item()returns trigger language plpgsql set search_path='' as $$
begin
 if(old.payment_unit_amount is not null and new.payment_unit_amount is distinct from old.payment_unit_amount)or(old.payment_stripe_price_id is not null and new.payment_stripe_price_id is distinct from old.payment_stripe_price_id)or(old.payment_product_id is not null and new.payment_product_id is distinct from old.payment_product_id)then raise exception 'immutable_payment_snapshot';end if;return new;
end;$$;
create trigger protect_checkout_payment_item before update on public.checkout_order_items for each row execute function public.protect_checkout_payment_item();
create function public.prepare_checkout_payment(p_id uuid,p_currency text,p_quote uuid,p_expected integer)returns jsonb language plpgsql security definer set search_path='' as $$
declare o public.checkout_orders;q public.fx_snapshots;rate text;total bigint;
begin
 select * into o from public.checkout_orders where id=p_id for update;if not found or o.status<>'pending'then raise exception 'pending_order_required';end if;
 if p_currency is null or not public.fx_currency(p_currency)then raise exception 'invalid_currency';end if;
 if o.payment_currency is not null then
  if o.payment_currency<>p_currency or o.fx_snapshot_id is distinct from p_quote or o.payment_total is distinct from p_expected then raise exception 'attempt_conflict';end if;
  return to_jsonb(o);
 end if;
 if o.stripe_session_id is not null and p_currency<>'USD'then raise exception 'attempt_conflict';end if;
 if p_currency='USD'then if p_quote is not null then raise exception 'invalid_quote';end if;rate:='10000000000';
 else select * into q from public.fx_snapshots where id=p_quote and expires_at>now()for share;if not found then raise exception 'quote_expired';end if;rate:=q.rates->>p_currency;end if;
 perform 1 from public.checkout_order_items where order_id=o.id for update;
 select sum(public.fx_convert_minor(unit_amount,p_currency,rate)::bigint*quantity)into total from public.checkout_order_items where order_id=o.id;
 if total is null or total not between 1 and 99999999 or total is distinct from p_expected::bigint then raise exception 'price_changed';end if;
 update public.checkout_order_items set payment_unit_amount=public.fx_convert_minor(unit_amount,p_currency,rate),payment_stripe_price_id=case when p_currency='USD'then stripe_price_id else null end where order_id=o.id;
 update public.checkout_orders set payment_currency=p_currency,payment_total=total,fx_snapshot_id=p_quote where id=o.id returning * into o;
 return to_jsonb(o);
end;$$;
create function public.bind_checkout_payment(p_id uuid,p_session text,p_bindings jsonb,p_expires timestamptz,p_touch boolean)returns boolean language plpgsql security definer set search_path='' as $$
declare o public.checkout_orders;n integer;
begin
 select * into o from public.checkout_orders where id=p_id for update;
 if not found or o.status<>'pending'or o.payment_currency is null or p_session is null or p_session!~(case when o.livemode then '^cs_live_[A-Za-z0-9]+$'else '^cs_test_[A-Za-z0-9]+$'end)or(o.stripe_session_id is not null and o.stripe_session_id<>p_session)then raise exception 'payment_mismatch';end if;
 if p_expires is null or p_expires<=now()or p_expires>now()+interval '25 hours'or p_touch is null then raise exception 'payment_mismatch';end if;
 if p_bindings is null or jsonb_typeof(p_bindings)<>'array'or jsonb_array_length(p_bindings)not between 1 and 20 then raise exception 'payment_mismatch';end if;
 n:=jsonb_array_length(p_bindings);
 if(select count(*)from public.checkout_order_items where order_id=o.id)<>n or(select count(distinct b->>'planId')from jsonb_array_elements(p_bindings)b)<>n or(select count(distinct b->>'priceId')from jsonb_array_elements(p_bindings)b)<>n then raise exception 'payment_mismatch';end if;
 if exists(select 1 from jsonb_array_elements(p_bindings)b left join public.checkout_order_items i on i.order_id=o.id and i.plan_id=b->>'planId'where i.plan_id is null or i.payment_unit_amount is null or jsonb_typeof(b->'priceId')is distinct from 'string'or jsonb_typeof(b->'productId')is distinct from 'string'or jsonb_typeof(b->'unitAmount')is distinct from 'number'or jsonb_typeof(b->'quantity')is distinct from 'number'or jsonb_typeof(b)<>'object'or b-array['planId','priceId','unitAmount','quantity','productId']<>'{}'::jsonb or not(b?&array['planId','priceId','unitAmount','quantity','productId'])or(b->>'priceId')!~'^price_[A-Za-z0-9]+$'or(b->>'productId')!~'^prod_[A-Za-z0-9]+$'or(b->>'quantity')::integer<>i.quantity or(b->>'unitAmount')::integer<>i.payment_unit_amount)then raise exception 'payment_mismatch';end if;
 update public.checkout_order_items i set payment_stripe_price_id=b->>'priceId',payment_product_id=b->>'productId'from jsonb_array_elements(p_bindings)b where i.order_id=o.id and i.plan_id=b->>'planId';
 update public.checkout_orders set stripe_session_id=p_session,expires_at=p_expires,payment_last_seen_at=case when p_touch then now()else payment_last_seen_at end where id=o.id;return true;
end;$$;
revoke all on function public.protect_checkout_payment_snapshot(),public.protect_checkout_payment_item(),public.prepare_checkout_payment(uuid,text,uuid,integer),public.bind_checkout_payment(uuid,text,jsonb,timestamptz,boolean)from public,anon,authenticated;
grant execute on function public.prepare_checkout_payment(uuid,text,uuid,integer),public.bind_checkout_payment(uuid,text,jsonb,timestamptz,boolean)to service_role;
commit;
