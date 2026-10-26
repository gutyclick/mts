begin;
-- Preserve queued notices until the receiving mailbox has been verified.
alter table public.support_settings add column delivery_enabled boolean not null default false;
create or replace function public.support_claim_notifications(p_limit integer default 2) returns setof public.support_notifications language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.support_settings where id=true and delivery_enabled)then return;end if;
 update public.support_notifications set state='failed',last_error='uncertain',lease_token=null,lease_until=null where state='pending'and(first_attempt_at<now()-interval '23 hours'or attempts>=12)and(lease_until is null or lease_until<now());
 return query with due as(select id from public.support_notifications where state='pending'and next_attempt_at<=now()and(lease_until is null or lease_until<now())order by next_attempt_at limit least(greatest(p_limit,1),5)for update skip locked)
 update public.support_notifications n set lease_token=gen_random_uuid(),lease_until=now()+interval '90 seconds',attempts=attempts+1,first_attempt_at=coalesce(first_attempt_at,now())from due where n.id=due.id returning n.*;
end;$$;
create or replace function public.run_support_notifications_job() returns void language plpgsql security definer set search_path='' as $$
declare token text;issued bigint;nonce uuid;signature text;
begin
 delete from public.support_quotas where window_start<now()-interval '2 days';
 if not exists(select 1 from public.support_settings where id=true and delivery_enabled)then return;end if;
 if not exists(select 1 from public.support_notifications where state='pending' and next_attempt_at<=now() and(lease_until is null or lease_until<now()))then return;end if;
 select decrypted_secret into token from vault.decrypted_secrets where name='mts_checkout_expiry_token';
 if token is null then return;end if;
 issued:=floor(extract(epoch from now()));nonce:=gen_random_uuid();
 signature:=encode(extensions.hmac(issued::text||'.'||nonce::text,token,'sha256'),'hex');
 insert into public.checkout_expiry_tickets(id,issued_at)values(nonce,to_timestamp(issued));
 perform net.http_post(url:='https://www.mytripsim.com/api/internal/support/notify',headers:=jsonb_build_object('Content-Type','application/json','X-Checkout-Expiry-Signature',signature),body:=jsonb_build_object('issued',issued,'nonce',nonce),timeout_milliseconds:=60000);
end;$$;
create or replace function public.configure_support_worker()returns boolean language plpgsql security definer set search_path='' as $$
begin
 update public.support_settings set delivery_enabled=true where id=true;
 perform cron.schedule('mts-support-notifications','30 seconds','select public.run_support_notifications_job()');return true;
end;$$;
commit;
