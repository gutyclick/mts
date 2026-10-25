begin;
create table public.checkout_expiry_tickets(id uuid primary key,issued_at timestamptz not null,consumed_at timestamptz);
alter table public.checkout_expiry_tickets enable row level security;
revoke all on public.checkout_expiry_tickets from public,anon,authenticated;
grant all on public.checkout_expiry_tickets to service_role;
create function public.consume_checkout_expiry_ticket(p_id uuid,p_issued bigint) returns boolean language plpgsql security definer set search_path='' as $$
declare affected integer;
begin
  update public.checkout_expiry_tickets set consumed_at=now() where id=p_id and issued_at=to_timestamp(p_issued)
    and consumed_at is null and issued_at>=now()-interval '60 seconds' and issued_at<=now()+interval '5 seconds';
  get diagnostics affected=row_count; return affected=1;
end;
$$;
revoke all on function public.consume_checkout_expiry_ticket(uuid,bigint) from public,anon,authenticated;
grant execute on function public.consume_checkout_expiry_ticket(uuid,bigint) to service_role;
create or replace function public.run_checkout_expiry_job() returns void language plpgsql security definer set search_path='' as $$
declare token text; issued bigint; nonce uuid; signature text;
begin
  perform public.start_stale_checkout_holds();
  delete from public.checkout_expiry_tickets where issued_at<now()-interval '10 minutes';
  if not exists(select 1 from public.checkout_orders where status='pending' and not payment_in_progress and payment_hold_expires_at<=now() and (expiry_lease_until is null or expiry_lease_until<=now())) then return; end if;
  select decrypted_secret into token from vault.decrypted_secrets where name='mts_checkout_expiry_token';
  if token is null then return; end if;
  issued:=floor(extract(epoch from now())); nonce:=gen_random_uuid();
  signature:=encode(extensions.hmac(issued::text||'.'||nonce::text,token,'sha256'),'hex');
  insert into public.checkout_expiry_tickets(id,issued_at) values(nonce,to_timestamp(issued));
  -- No reusable secret enters pg_net's managed request queue. Each signature is
  -- short-lived, single-use and can only trigger processing of already-due orders.
  perform net.http_post(url:='https://www.mytripsim.com/api/internal/checkout/expire',
    headers:=jsonb_build_object('Content-Type','application/json','X-Checkout-Expiry-Signature',signature),
    body:=jsonb_build_object('issued',issued,'nonce',nonce),timeout_milliseconds:=60000);
end;
$$;
revoke all on function public.run_checkout_expiry_job() from public,anon,authenticated;
grant execute on function public.run_checkout_expiry_job() to service_role;
commit;
