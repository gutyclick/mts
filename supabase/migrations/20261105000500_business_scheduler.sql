begin;
-- Separate HTTP executions preserve the existing retail worker's time budget.
create function public.run_b2b_commercial_job() returns void language plpgsql security definer set search_path='' as $$
declare token text;issued bigint;nonce uuid;signature text;task text;
begin
 if not exists(select 1 from public.b2b_commerce_settings where id and issuance_enabled) then return;end if;
 for task in select 'units' where exists(select 1 from public.b2b_units u join public.b2b_orders o on o.id=u.order_id where o.state='provisioning' and o.paid_at is not null and o.released_at is not null and u.state in ('queued','provider_pending') and (u.next_attempt_at is null or u.next_attempt_at<=now()) and (u.lease_until is null or u.lease_until<now())) union all select 'notifications' where exists(select 1 from public.b2b_notifications where state='queued' and next_attempt_at<=now() and (lease_until is null or lease_until<now())) loop
  select decrypted_secret into token from vault.decrypted_secrets where name='mts_checkout_expiry_token';
  if token is null then return;end if;
  issued:=floor(extract(epoch from now()));nonce:=gen_random_uuid();
  signature:=encode(extensions.hmac(issued::text||'.'||nonce::text,token,'sha256'),'hex');
  insert into public.checkout_expiry_tickets(id,issued_at) values(nonce,to_timestamp(issued));
  perform net.http_post(url:='https://www.mytripsim.com/api/internal/business/run?task='||task,headers:=jsonb_build_object('Content-Type','application/json','X-Checkout-Expiry-Signature',signature),body:=jsonb_build_object('issued',issued,'nonce',nonce),timeout_milliseconds:=60000);
 end loop;
end;$$;
revoke all on function public.run_b2b_commercial_job() from public,anon,authenticated;
grant execute on function public.run_b2b_commercial_job() to service_role;
select cron.schedule('mts-b2b-commercial','30 seconds','select public.run_b2b_commercial_job()');
commit;
