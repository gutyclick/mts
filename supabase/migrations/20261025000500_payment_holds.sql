begin;
alter table public.checkout_orders drop constraint checkout_orders_status_check;
alter table public.checkout_orders add constraint checkout_orders_status_check check(status in ('pending','paid','expired','failed','cancelled'));
alter table public.checkout_orders
  add column payment_last_seen_at timestamptz,
  add column payment_hold_started_at timestamptz,
  add column payment_hold_expires_at timestamptz,
  add column payment_in_progress boolean not null default false,
  add column expiry_lease_until timestamptz,
  add constraint payment_hold_consistent check (
    (payment_hold_started_at is null and payment_hold_expires_at is null) or
    (payment_hold_started_at is not null and payment_hold_expires_at=payment_hold_started_at+interval '5 minutes')
  );
create index checkout_expiry_idx on public.checkout_orders(payment_hold_expires_at) where status='pending' and not payment_in_progress;
grant select(payment_hold_expires_at,payment_in_progress) on public.checkout_orders to authenticated;

create function public.touch_checkout_payment(p_id uuid,p_action text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result public.checkout_orders;
begin
  if p_action not in ('active','leave') then raise exception 'invalid_presence'; end if;
  select * into result from public.checkout_orders where id=p_id for update;
  if not found then raise exception 'order_unavailable'; end if;
  if result.status='pending' and not result.payment_in_progress then
    if p_action='leave' and result.payment_hold_expires_at is null then
      update public.checkout_orders set payment_hold_started_at=now(),payment_hold_expires_at=now()+interval '5 minutes' where id=p_id;
    elsif p_action='active' then
      update public.checkout_orders set payment_last_seen_at=now() where id=p_id;
    end if;
  end if;
  select * into result from public.checkout_orders where id=p_id;
  return to_jsonb(result);
end;
$$;
revoke all on function public.touch_checkout_payment(uuid,text) from public,anon,authenticated;
grant execute on function public.touch_checkout_payment(uuid,text) to service_role;

create function public.start_stale_checkout_holds() returns integer language plpgsql security definer set search_path='' as $$
declare affected integer;
begin
  -- Missing beacon fallback: allow 45 seconds for an active tab's next heartbeat.
  update public.checkout_orders set payment_hold_started_at=payment_last_seen_at+interval '45 seconds',
    payment_hold_expires_at=payment_last_seen_at+interval '345 seconds'
  where status='pending' and not payment_in_progress and payment_hold_expires_at is null
    and payment_last_seen_at is not null and payment_last_seen_at<=now()-interval '45 seconds';
  get diagnostics affected=row_count; return affected;
end;
$$;
revoke all on function public.start_stale_checkout_holds() from public,anon,authenticated;
grant execute on function public.start_stale_checkout_holds() to service_role;

create function public.claim_checkout_expirations(p_limit integer default 20) returns setof uuid language plpgsql security definer set search_path='' as $$
begin
  perform public.start_stale_checkout_holds();
  return query with due as (
    select id from public.checkout_orders where status='pending' and not payment_in_progress and
      payment_hold_expires_at<=now() and (expiry_lease_until is null or expiry_lease_until<=now())
    order by payment_hold_expires_at limit least(greatest(p_limit,1),50) for update skip locked
  ) update public.checkout_orders o set expiry_lease_until=now()+interval '90 seconds'
    from due where o.id=due.id returning o.id;
end;
$$;
revoke all on function public.claim_checkout_expirations(integer) from public,anon,authenticated;
grant execute on function public.claim_checkout_expirations(integer) to service_role;

create or replace function public.record_test_checkout_event(
  p_event_id text,p_event_type text,p_order_id uuid,p_session_id text,
  p_status text,p_amount integer,p_currency text,p_payment_intent text
) returns text language plpgsql security definer set search_path='' as $$
declare existing public.checkout_orders; affected integer;
begin
  if p_status not in ('pending','paid','expired','failed') or p_event_type not in
    ('checkout.session.completed','checkout.session.async_payment_succeeded','checkout.session.async_payment_failed','checkout.session.expired') then raise exception 'invalid_event'; end if;
  select * into existing from public.checkout_orders where id=p_order_id for update;
  if not found or existing.stripe_session_id is distinct from p_session_id or
    existing.amount_total is distinct from p_amount or p_currency is distinct from 'usd' then raise exception 'payment_mismatch'; end if;
  insert into public.checkout_stripe_events(id,order_id,event_type) values(p_event_id,p_order_id,p_event_type) on conflict(id) do nothing;
  get diagnostics affected=row_count; if affected=0 then return 'duplicate'; end if;
  if existing.status<>'paid' and (existing.status<>'cancelled' or p_status='paid') then
    update public.checkout_orders set status=case when p_status='expired' and payment_hold_expires_at<=now() then 'cancelled' else p_status end,
      payment_in_progress=(p_status='pending'), expiry_lease_until=null,
      paid_at=case when p_status='paid' then now() else paid_at end,
      stripe_payment_intent=coalesce(p_payment_intent,stripe_payment_intent) where id=p_order_id;
  end if;
  return 'recorded';
end;
$$;
commit;
