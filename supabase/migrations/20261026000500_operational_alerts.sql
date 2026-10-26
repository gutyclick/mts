begin;
create table public.operations_settings (
 id boolean primary key default true check(id), enabled boolean not null default false,
 recipient text not null default 'gustavo@mytripsim.com' check(length(recipient) between 3 and 254 and recipient like '%@%'),
 balance_threshold_units bigint not null default 200000 check(balance_threshold_units between 0 and 1000000000000),
 balance_units bigint,last_balance_at timestamptz,balance_ok boolean not null default false,
 last_run_at timestamptz,run_token uuid,run_until timestamptz
);
insert into public.operations_settings(id) values(true);
create table public.operational_email_events (
 id text primary key check(length(id) between 1 and 200), email_id uuid not null,
 kind text not null check(kind in ('email.delivered','email.delivery_delayed','email.bounced','email.complained','email.failed','email.suppressed')),
 occurred_at timestamptz not null,received_at timestamptz not null default now()
);
create index operational_email_latest_idx on public.operational_email_events(email_id,occurred_at desc);
create table public.operational_alerts (
 id uuid primary key default gen_random_uuid(),
 kind text not null check(kind in ('paid_without_delivery','email_bounced','email_failed','email_complained','email_delayed','provider_low_balance','provider_check_failed')),
 subject text not null check(length(subject) between 1 and 200),
 order_id uuid references public.checkout_orders(id) on delete cascade,
 unit_id uuid references public.esim_fulfillments(id) on delete cascade,
 state text not null default 'open' check(state in ('open','acknowledged','resolved')),
 opened_at timestamptz not null default now(),last_seen_at timestamptz not null default now(),resolved_at timestamptz,
 balance_units bigint,notified_at timestamptz,
 notification_state text not null default 'pending' check(notification_state in ('pending','sent','review')),
 attempts integer not null default 0 check(attempts>=0),first_attempt_at timestamptz,
 next_attempt_at timestamptz not null default now(),lease_token uuid,lease_until timestamptz,
 email_id text,notification_payload jsonb check(notification_payload is null or jsonb_typeof(notification_payload)='object'),
 check((state='resolved')=(resolved_at is not null))
);
create unique index operational_alert_episode_idx on public.operational_alerts(kind,subject) where resolved_at is null;
create index operational_alert_notifications_idx on public.operational_alerts(next_attempt_at) where notification_state='pending' and state='open';
create table public.operations_audit (
 id bigint generated always as identity primary key,actor uuid,action text not null check(length(action) between 1 and 80),
 object_id uuid,created_at timestamptz not null default now()
);
alter table public.operations_settings enable row level security;
alter table public.operational_email_events enable row level security;
alter table public.operational_alerts enable row level security;
alter table public.operations_audit enable row level security;
revoke all on public.operations_settings,public.operational_email_events,public.operational_alerts,public.operations_audit from public,anon,authenticated;
grant all on public.operations_settings,public.operational_email_events,public.operational_alerts,public.operations_audit to service_role;
grant usage,select on sequence public.operations_audit_id_seq to service_role;

create function public.operations_claim_run() returns uuid language plpgsql security definer set search_path='' as $$
declare token uuid:=gen_random_uuid();
begin
 update public.operations_settings set run_token=token,run_until=now()+interval '90 seconds'
 where id and enabled and (run_until is null or run_until<now()) and (last_run_at is null or last_run_at<now()-interval '4 minutes') returning run_token into token;
 if not found then return null;end if;return token;
end;$$;

create function public.operations_reconcile(p_token uuid,p_balance bigint,p_ok boolean) returns integer language plpgsql security definer set search_path='' as $$
declare setting public.operations_settings;issue record;count_new integer:=0;affected integer;
begin
 select * into setting from public.operations_settings where id and run_token=p_token and run_until>now() for update;
 if not found then raise exception 'operations_lease_lost';end if;
 if p_ok is null then raise exception 'invalid_balance';end if;
 if p_ok and (p_balance is null or abs(p_balance::numeric)>9007199254740991) then raise exception 'invalid_balance';end if;
 create temporary table current_operation_issues(kind text,subject text,order_id uuid,unit_id uuid,balance_units bigint) on commit drop;
 insert into current_operation_issues
 select 'paid_without_delivery',f.id::text,o.id,f.id,null::bigint
 from public.esim_fulfillments f join public.checkout_orders o on o.id=f.order_id
 where o.status='paid' and o.livemode and not f.qa_authorized and f.state<>'sent'
  and coalesce(o.paid_at,o.created_at)<now()-interval '10 minutes';
 insert into current_operation_issues
 select case e.kind when 'email.bounced' then 'email_bounced' when 'email.complained' then 'email_complained' when 'email.delivery_delayed' then 'email_delayed' else 'email_failed' end,
 f.id::text,o.id,f.id,null::bigint
 from public.esim_fulfillments f join public.checkout_orders o on o.id=f.order_id
 join lateral(select kind,occurred_at from public.operational_email_events e where e.email_id::text=f.email_id order by occurred_at desc,case when kind='email.delivered' then 0 else 1 end desc limit 1)e on true
 where o.livemode and not f.qa_authorized and o.status='paid' and e.kind<>'email.delivered'
  and (e.kind<>'email.delivery_delayed' or e.occurred_at<now()-interval '15 minutes');
 if p_ok and p_balance<setting.balance_threshold_units then
  insert into current_operation_issues values('provider_low_balance','provider',null,null,p_balance);
 elsif not p_ok then
  insert into current_operation_issues values('provider_check_failed','provider',null,null,null);
 end if;
 for issue in select * from current_operation_issues loop
  insert into public.operational_alerts(kind,subject,order_id,unit_id,balance_units)
   values(issue.kind,issue.subject,issue.order_id,issue.unit_id,issue.balance_units)
   on conflict(kind,subject) where resolved_at is null do nothing;
  get diagnostics affected=row_count;count_new:=count_new+affected;
  update public.operational_alerts a set last_seen_at=now(),balance_units=issue.balance_units
   where a.kind=issue.kind and a.subject=issue.subject and a.resolved_at is null;
 end loop;
 update public.operational_alerts a set state='resolved',resolved_at=now(),lease_token=null,lease_until=null
 where a.resolved_at is null and not exists(select 1 from current_operation_issues i where i.kind=a.kind and i.subject=a.subject)
  and not(a.kind='provider_low_balance' and not p_ok);
 update public.operations_settings set balance_ok=p_ok,balance_units=case when p_ok then p_balance else balance_units end,
  last_balance_at=case when p_ok then now() else last_balance_at end,last_run_at=now(),run_token=null,run_until=null where id;
 -- Surface a failed alert channel in the panel without recursively emailing another alert.
 update public.operational_alerts a set notification_state='review'
 where a.email_id is not null and a.notification_state='sent' and (
  select e.kind from public.operational_email_events e where e.email_id::text=a.email_id
  order by e.occurred_at desc,case when e.kind='email.delivered' then 0 else 1 end desc limit 1
 ) in ('email.bounced','email.complained','email.failed','email.suppressed');
 -- Only unassociated old events are removed; incident evidence stays with the order.
 delete from public.operational_email_events e where received_at<now()-interval '30 days'
  and not exists(select 1 from public.esim_fulfillments f where f.email_id=e.email_id::text)
  and not exists(select 1 from public.operational_alerts a where a.email_id=e.email_id::text);
 return count_new;
end;$$;

create function public.operations_claim_notifications(p_limit integer default 3) returns setof public.operational_alerts language plpgsql security definer set search_path='' as $$
begin
 update public.operational_alerts set notification_state='review',lease_token=null,lease_until=null
 where notification_state='pending' and (attempts>=8 or first_attempt_at<now()-interval '23 hours') and (lease_until is null or lease_until<now());
 return query with due as (
  select id from public.operational_alerts where state='open' and notification_state='pending' and next_attempt_at<=now()
   and (lease_until is null or lease_until<now()) order by opened_at limit least(greatest(p_limit,1),5) for update skip locked
 )update public.operational_alerts a set attempts=attempts+1,first_attempt_at=coalesce(first_attempt_at,now()),lease_token=gen_random_uuid(),lease_until=now()+interval '60 seconds'
 from due where a.id=due.id returning a.*;
end;$$;

create function public.operations_snapshot(p_actor uuid) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.admin_memberships where user_id=p_actor) then raise exception 'admin_required';end if;
 return jsonb_build_object(
 'settings',(select jsonb_build_object('enabled',enabled,'recipient',recipient,'thresholdUnits',balance_threshold_units,'balanceUnits',balance_units,'balanceOk',balance_ok,'lastBalanceAt',last_balance_at,'lastRunAt',last_run_at)from public.operations_settings where id),
 'alerts',(select coalesce(jsonb_agg(to_jsonb(x)),'[]')from(select id,kind,order_id,unit_id,state,opened_at,last_seen_at,resolved_at,notified_at,notification_state,balance_units from public.operational_alerts order by (state<>'resolved')desc,opened_at desc limit 100)x));
end;$$;
create function public.operations_ack_alert(p_actor uuid,p_id uuid) returns boolean language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.admin_memberships where user_id=p_actor) then raise exception 'admin_required';end if;
 update public.operational_alerts set state='acknowledged',lease_token=null,lease_until=null where id=p_id and state='open';
 if not found then return false;end if;
 insert into public.operations_audit(actor,action,object_id)values(p_actor,'alert_acknowledged',p_id);return true;
end;$$;
revoke all on function public.operations_claim_run(),public.operations_reconcile(uuid,bigint,boolean),public.operations_claim_notifications(integer),public.operations_snapshot(uuid),public.operations_ack_alert(uuid,uuid) from public,anon,authenticated;
grant execute on function public.operations_claim_run(),public.operations_reconcile(uuid,bigint,boolean),public.operations_claim_notifications(integer),public.operations_snapshot(uuid),public.operations_ack_alert(uuid,uuid) to service_role;

create function public.run_operations_job() returns void language plpgsql security definer set search_path='' as $$
declare token text;issued bigint;nonce uuid;signature text;
begin
 if not exists(select 1 from public.operations_settings where id and enabled) then return;end if;
 select decrypted_secret into token from vault.decrypted_secrets where name='mts_checkout_expiry_token';if token is null then return;end if;
 issued:=floor(extract(epoch from now()));nonce:=gen_random_uuid();signature:=encode(extensions.hmac(issued::text||'.'||nonce::text,token,'sha256'),'hex');
 insert into public.checkout_expiry_tickets(id,issued_at)values(nonce,to_timestamp(issued));
 perform net.http_post(url:='https://www.mytripsim.com/api/internal/operations/run',headers:=jsonb_build_object('Content-Type','application/json','X-Checkout-Expiry-Signature',signature),body:=jsonb_build_object('issued',issued,'nonce',nonce),timeout_milliseconds:=60000);
end;$$;
create function public.configure_operations_worker(p_recipient text,p_threshold bigint default 200000) returns boolean language plpgsql security definer set search_path='' as $$
begin
 update public.operations_settings set enabled=true,recipient=p_recipient,balance_threshold_units=p_threshold where id;
 perform cron.schedule('mts-operations','*/5 * * * *','select public.run_operations_job()');return true;
end;$$;
revoke all on function public.run_operations_job(),public.configure_operations_worker(text,bigint) from public,anon,authenticated;
grant execute on function public.run_operations_job(),public.configure_operations_worker(text,bigint) to service_role;
commit;
