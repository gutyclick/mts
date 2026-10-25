begin;
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
create or replace function public.run_checkout_expiry_job() returns void language plpgsql security definer set search_path='' as $$
declare token text;
begin
  perform public.start_stale_checkout_holds();
  if not exists(select 1 from public.checkout_orders where status='pending' and not payment_in_progress and payment_hold_expires_at<=now() and (expiry_lease_until is null or expiry_lease_until<=now())) then return; end if;
  select decrypted_secret into token from vault.decrypted_secrets where name='mts_checkout_expiry_token';
  if token is null then return; end if;
  perform net.http_post(url:='https://www.mytripsim.com/api/internal/checkout/expire',
    headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||token),
    body:='{}'::jsonb,timeout_milliseconds:=60000);
end;
$$;
revoke all on function public.run_checkout_expiry_job() from public,anon,authenticated;
grant execute on function public.run_checkout_expiry_job() to service_role;
create function public.configure_checkout_expiry_worker(p_token text) returns boolean language plpgsql security definer set search_path='' as $$
declare secret_id uuid;
begin
  if p_token is null or p_token !~ '^[a-f0-9]{64}$' then raise exception 'invalid_worker_token'; end if;
  select id into secret_id from vault.secrets where name='mts_checkout_expiry_token';
  if secret_id is null then perform vault.create_secret(p_token,'mts_checkout_expiry_token');
  else perform vault.update_secret(secret_id,p_token); end if;
  perform cron.schedule('mts-checkout-expiry','15 seconds','select public.run_checkout_expiry_job()');
  return true;
end;
$$;
revoke all on function public.configure_checkout_expiry_worker(text) from public,anon,authenticated;
grant execute on function public.configure_checkout_expiry_worker(text) to service_role;
commit;
