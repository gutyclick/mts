begin;
create function public.run_support_notifications_job() returns void language plpgsql security definer set search_path='' as $$
declare token text;issued bigint;nonce uuid;signature text;
begin
 delete from public.support_quotas where window_start<now()-interval '2 days';
 if not exists(select 1 from public.support_notifications where state='pending' and next_attempt_at<=now() and(lease_until is null or lease_until<now()))then return;end if;
 select decrypted_secret into token from vault.decrypted_secrets where name='mts_checkout_expiry_token';
 if token is null then return;end if;
 issued:=floor(extract(epoch from now()));nonce:=gen_random_uuid();
 signature:=encode(extensions.hmac(issued::text||'.'||nonce::text,token,'sha256'),'hex');
 insert into public.checkout_expiry_tickets(id,issued_at)values(nonce,to_timestamp(issued));
 perform net.http_post(url:='https://www.mytripsim.com/api/internal/support/notify',headers:=jsonb_build_object('Content-Type','application/json','X-Checkout-Expiry-Signature',signature),body:=jsonb_build_object('issued',issued,'nonce',nonce),timeout_milliseconds:=60000);
end;$$;
create function public.configure_support_worker()returns boolean language plpgsql security definer set search_path='' as $$
begin perform cron.schedule('mts-support-notifications','30 seconds','select public.run_support_notifications_job()');return true;end;$$;
revoke all on function public.run_support_notifications_job(),public.configure_support_worker() from public,anon,authenticated;
grant execute on function public.run_support_notifications_job(),public.configure_support_worker() to service_role;
commit;
