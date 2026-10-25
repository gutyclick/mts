begin;
create function public.run_esim_fulfillment_job() returns void language plpgsql security definer set search_path='' as $$
declare token text;issued bigint;nonce uuid;signature text;
begin
 if not exists(select 1 from public.esim_fulfillments f join public.checkout_orders o on o.id=f.order_id
  where o.status='paid' and (o.livemode or f.qa_authorized) and f.state in ('queued','provider_pending','ready')
   and f.next_attempt_at<=now() and (f.lease_until is null or f.lease_until<now())) then return; end if;
 select decrypted_secret into token from vault.decrypted_secrets where name='mts_checkout_expiry_token';
 if token is null then return; end if;
 issued:=floor(extract(epoch from now()));nonce:=gen_random_uuid();
 signature:=encode(extensions.hmac(issued::text||'.'||nonce::text,token,'sha256'),'hex');
 insert into public.checkout_expiry_tickets(id,issued_at) values(nonce,to_timestamp(issued));
 perform net.http_post(url:='https://www.mytripsim.com/api/internal/fulfillment/run',
  headers:=jsonb_build_object('Content-Type','application/json','X-Checkout-Expiry-Signature',signature),
  body:=jsonb_build_object('issued',issued,'nonce',nonce),timeout_milliseconds:=60000);
end;
$$;
revoke all on function public.run_esim_fulfillment_job() from public,anon,authenticated;
grant execute on function public.run_esim_fulfillment_job() to service_role;
create function public.configure_esim_fulfillment_worker() returns boolean language plpgsql security definer set search_path='' as $$
begin
 perform cron.schedule('mts-esim-fulfillment','30 seconds','select public.run_esim_fulfillment_job()');return true;
end;
$$;
revoke all on function public.configure_esim_fulfillment_worker() from public,anon,authenticated;
grant execute on function public.configure_esim_fulfillment_worker() to service_role;
commit;
