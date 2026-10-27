begin;
create table public.refund_requests (
 id uuid primary key default gen_random_uuid(),order_id uuid not null references public.checkout_orders(id),
 amount integer not null check(amount>0),currency text not null check(currency='usd'),livemode boolean not null,
 payment_intent text not null check(payment_intent ~ '^pi_[A-Za-z0-9_]+$'),
 reason text not null check(length(btrim(reason)) between 10 and 1000),requested_by uuid not null,
 approved_by uuid,approved_at timestamptz,
 state text not null default 'requested' check(state in ('requested','approved','processing','pending','succeeded','failed','rejected','review')),
 stripe_refund_id text unique, stripe_checked_at timestamptz,
 first_attempt_at timestamptz,attempts integer not null default 0,lease_token uuid,lease_until timestamptz,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table public.refund_units (
 request_id uuid not null references public.refund_requests(id),unit_id uuid not null references public.esim_fulfillments(id),
 amount integer not null check(amount>0),active boolean not null default true,held boolean not null default false,
 primary key(request_id,unit_id),check(not held or active)
);
create unique index refund_active_unit_idx on public.refund_units(unit_id) where active;
create table public.refund_audit (
 id bigint generated always as identity primary key,request_id uuid not null references public.refund_requests(id),
 actor uuid,action text not null,created_at timestamptz not null default now()
);
alter table public.refund_requests enable row level security;
alter table public.refund_units enable row level security;
alter table public.refund_audit enable row level security;
revoke all on public.refund_requests,public.refund_units,public.refund_audit from public,anon,authenticated;
grant all on public.refund_requests,public.refund_units,public.refund_audit to service_role;
grant usage,select on sequence public.refund_audit_id_seq to service_role;

create function public.admin_refund_request(p_actor uuid,p_order uuid,p_units uuid[],p_reason text) returns uuid language plpgsql security definer set search_path='' as $$
declare o public.checkout_orders;total bigint;n integer;rid uuid:=gen_random_uuid();
begin
 if not exists(select 1 from public.admin_memberships where user_id=p_actor) then raise exception 'admin_required';end if;
 if coalesce(cardinality(p_units),0) not between 1 and 50 or (select count(distinct x) from unnest(p_units)x)<>cardinality(p_units) then raise exception 'invalid_units';end if;
 select * into o from public.checkout_orders where id=p_order for update;
 if not found or o.status<>'paid' or o.stripe_payment_intent is null then raise exception 'paid_order_required';end if;
 perform 1 from public.esim_fulfillments where id=any(p_units) order by id for update;
 select count(*),sum(i.unit_amount) into n,total from public.esim_fulfillments f join public.checkout_order_items i on i.order_id=f.order_id and i.plan_id=f.plan_id where f.id=any(p_units) and f.order_id=o.id;
 if n<>cardinality(p_units) or total is null or total>o.amount_total then raise exception 'invalid_units';end if;
 insert into public.refund_requests(id,order_id,amount,currency,livemode,payment_intent,reason,requested_by)values(rid,o.id,total,o.currency,o.livemode,o.stripe_payment_intent,btrim(p_reason),p_actor);
 insert into public.refund_units(request_id,unit_id,amount)select rid,f.id,i.unit_amount from public.esim_fulfillments f join public.checkout_order_items i on i.order_id=f.order_id and i.plan_id=f.plan_id where f.id=any(p_units);
 insert into public.refund_audit(request_id,actor,action)values(rid,p_actor,'requested');return rid;
end;$$;
create function public.admin_refund_approve(p_actor uuid,p_id uuid,p_ack boolean) returns boolean language plpgsql security definer set search_path='' as $$
declare r public.refund_requests;
begin
 if not exists(select 1 from public.admin_memberships where user_id=p_actor) then raise exception 'admin_required';end if;
 if p_ack is distinct from true then raise exception 'acknowledgement_required';end if;
 perform 1 from public.checkout_orders where id=(select order_id from public.refund_requests where id=p_id) for update;
 select * into r from public.refund_requests where id=p_id for update;
 if not found or r.state<>'requested' then raise exception 'invalid_refund_state';end if;
 perform 1 from public.esim_fulfillments f join public.refund_units u on u.unit_id=f.id where u.request_id=r.id order by f.id for update of f;
 if exists(select 1 from public.esim_fulfillments f join public.refund_units u on u.unit_id=f.id where u.request_id=r.id and f.lease_until>now()) then raise exception 'fulfillment_busy';end if;
 update public.refund_units set held=true where request_id=r.id and active;
 update public.refund_requests set state='approved',approved_by=p_actor,approved_at=now(),updated_at=now() where id=r.id;
 insert into public.refund_audit(request_id,actor,action)values(r.id,p_actor,'approved_provider_cancellation_not_included');return true;
end;$$;
create function public.admin_refund_reject(p_actor uuid,p_id uuid) returns boolean language plpgsql security definer set search_path='' as $$
declare r public.refund_requests;
begin
 if not exists(select 1 from public.admin_memberships where user_id=p_actor) then raise exception 'admin_required';end if;
 perform 1 from public.checkout_orders where id=(select order_id from public.refund_requests where id=p_id) for update;
 select * into r from public.refund_requests where id=p_id for update;
 if not found or r.state<>'requested' then raise exception 'invalid_refund_state';end if;
 update public.refund_requests set state='rejected',updated_at=now() where id=r.id;
 update public.refund_units set active=false,held=false where request_id=r.id;
 insert into public.refund_audit(request_id,actor,action)values(r.id,p_actor,'rejected');return true;
end;$$;
create function public.admin_refund_claim(p_actor uuid,p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.refund_requests;
begin
 if not exists(select 1 from public.admin_memberships where user_id=p_actor) then raise exception 'admin_required';end if;
 perform 1 from public.checkout_orders where id=(select order_id from public.refund_requests where id=p_id) for update;
 select * into r from public.refund_requests where id=p_id for update;
 if not found or r.state not in ('approved','processing','pending','review') or r.lease_until>now() then return null;end if;
 if r.approved_by is null or not exists(select 1 from public.refund_units where request_id=r.id and active and held) then raise exception 'approval_required';end if;
 update public.refund_requests set state='processing',attempts=attempts+1,first_attempt_at=coalesce(first_attempt_at,now()),lease_token=gen_random_uuid(),lease_until=now()+interval '90 seconds',updated_at=now() where id=r.id returning * into r;
 insert into public.refund_audit(request_id,actor,action)values(r.id,p_actor,'execution_claimed');return to_jsonb(r);
end;$$;
create function public.refund_record_stripe(p_id uuid,p_refund text,p_intent text,p_amount integer,p_currency text,p_live boolean,p_status text,p_checked_at timestamptz) returns boolean language plpgsql security definer set search_path='' as $$
declare r public.refund_requests;next_state text;
begin
 perform 1 from public.checkout_orders where id=(select order_id from public.refund_requests where id=p_id) for update;
 select * into r from public.refund_requests where id=p_id for update;
 if not found then return false;end if;
 if r.approved_by is null or r.state in ('requested','rejected') or r.payment_intent is distinct from p_intent or r.amount is distinct from p_amount or r.currency is distinct from p_currency or r.livemode is distinct from p_live or p_refund is null or p_refund !~ '^re_[A-Za-z0-9_]+$' or length(p_refund)>200 or (r.stripe_refund_id is not null and r.stripe_refund_id<>p_refund) then raise exception 'refund_mismatch';end if;
 if p_status is null or p_status not in ('succeeded','pending','failed','canceled','requires_action') or p_checked_at is null or p_checked_at>now()+interval '1 minute' then raise exception 'invalid_refund_status';end if;
 -- A terminal response can arrive from an earlier-started request after a newer pending snapshot.
 -- Terminal progression wins; timestamps only order nonterminal snapshots.
 if p_status in ('pending','requires_action') and r.stripe_checked_at is not null and p_checked_at<=r.stripe_checked_at then return false;end if;
 -- Stripe terminal failures cannot revert to a pending state; fresh success/failure snapshots remain authoritative.
 if r.state in ('succeeded','failed') and p_status in ('pending','requires_action') then return false;end if;
 if r.state='failed' and p_status='succeeded' then return false;end if;
 next_state:=case p_status when 'requires_action' then 'review' when 'canceled' then 'failed' else p_status end;
 update public.refund_requests set stripe_refund_id=p_refund,stripe_checked_at=greatest(r.stripe_checked_at,p_checked_at),state=next_state,lease_token=null,lease_until=null,updated_at=now() where id=r.id;
 if next_state='failed' then update public.refund_units set active=false,held=false where request_id=r.id;end if;
 if r.state is distinct from next_state or r.stripe_refund_id is null then insert into public.refund_audit(request_id,action)values(r.id,'stripe_'||next_state);end if;
 return true;
end;$$;
create function public.admin_refund_issue(p_actor uuid,p_id uuid,p_lease uuid,p_definitive boolean) returns boolean language plpgsql security definer set search_path='' as $$
declare rid uuid;next_state text;
begin
 if not exists(select 1 from public.admin_memberships where user_id=p_actor) then raise exception 'admin_required';end if;
 update public.refund_requests set state=case when p_definitive and stripe_refund_id is null then 'failed' else 'review' end,lease_token=null,lease_until=null,updated_at=now()
 where id=p_id and lease_token=p_lease and state='processing' returning id,state into rid,next_state;
 if not found then return false;end if;
 if next_state='failed' then update public.refund_units set active=false,held=false where request_id=rid;end if;
 insert into public.refund_audit(request_id,actor,action)values(rid,p_actor,case when next_state='failed' then 'execution_rejected' else 'execution_uncertain_review' end);return true;
end;$$;
create function public.admin_refund_view(p_actor uuid,p_order uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.admin_memberships where user_id=p_actor) then raise exception 'admin_required';end if;
 return jsonb_build_object(
 'audit',(select coalesce(jsonb_agg(to_jsonb(a)),'[]')from(select a.request_id,a.actor,a.action,a.created_at from public.refund_audit a join public.refund_requests r on r.id=a.request_id where p_order is null or r.order_id=p_order order by a.id desc limit 200)a),
 'recent',(select coalesce(jsonb_agg(to_jsonb(r)),'[]')from(select id,order_id,amount,currency,livemode,state,reason,created_at,updated_at,stripe_refund_id from public.refund_requests where p_order is null or order_id=p_order order by (state in ('requested','approved','processing','pending','review'))desc,created_at desc limit case when p_order is null then 50 else 250 end)r),
 'order',(select jsonb_build_object('id',o.id,'status',o.status,'amount',o.amount_total,'currency',o.currency,'livemode',o.livemode,
 'units',(select coalesce(jsonb_agg(jsonb_build_object('id',f.id,'plan',i.plan_name,'destination',i.destination_name,'dataGb',i.data_gb,'days',i.days,'amount',i.unit_amount,'state',f.state,'issued',f.provider_order_no is not null,'reserved',(select u.request_id from public.refund_units u where u.unit_id=f.id and u.active))order by f.plan_id,f.unit_index),'[]')from public.esim_fulfillments f join public.checkout_order_items i on i.order_id=f.order_id and i.plan_id=f.plan_id where f.order_id=o.id))from public.checkout_orders o where o.id=p_order));
end;$$;

create or replace function public.claim_esim_fulfillments(p_limit integer default 2) returns setof public.esim_fulfillments language plpgsql security definer set search_path='' as $$
begin
 update public.esim_fulfillments set state='review',last_error='retry_exhausted',lease_token=null,lease_until=null
 where state in ('queued','provider_pending','ready') and attempts>=24 and (lease_until is null or lease_until<now()) and not exists(select 1 from public.refund_units u where u.unit_id=esim_fulfillments.id and u.active and u.held);
 return query with due as (
  select f.id from public.esim_fulfillments f join public.checkout_orders o on o.id=f.order_id
  where o.status='paid' and (o.livemode or f.qa_authorized) and f.state in ('queued','provider_pending','ready')
   and f.next_attempt_at<=now() and (f.lease_until is null or f.lease_until<now()) and f.attempts<24
   and not exists(select 1 from public.refund_units u where u.unit_id=f.id and u.active and u.held)
  order by f.next_attempt_at limit least(greatest(p_limit,1),5) for update of f skip locked
 ) update public.esim_fulfillments f set lease_until=now()+interval '120 seconds',lease_token=gen_random_uuid(),attempts=attempts+1,updated_at=now()
 from due where f.id=due.id returning f.*;
end;$$;
revoke all on function public.admin_refund_request(uuid,uuid,uuid[],text),public.admin_refund_approve(uuid,uuid,boolean),public.admin_refund_reject(uuid,uuid),public.admin_refund_claim(uuid,uuid),public.refund_record_stripe(uuid,text,text,integer,text,boolean,text,timestamptz),public.admin_refund_issue(uuid,uuid,uuid,boolean),public.admin_refund_view(uuid,uuid),public.claim_esim_fulfillments(integer) from public,anon,authenticated;
grant execute on function public.admin_refund_request(uuid,uuid,uuid[],text),public.admin_refund_approve(uuid,uuid,boolean),public.admin_refund_reject(uuid,uuid),public.admin_refund_claim(uuid,uuid),public.refund_record_stripe(uuid,text,text,integer,text,boolean,text,timestamptz),public.admin_refund_issue(uuid,uuid,uuid,boolean),public.admin_refund_view(uuid,uuid),public.claim_esim_fulfillments(integer) to service_role;

-- Financially resolved units no longer represent overdue delivery incidents.
create or replace function public.operations_reconcile(p_token uuid,p_balance bigint,p_ok boolean) returns integer language plpgsql security definer set search_path='' as $$
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
  and not exists(select 1 from public.refund_units ru join public.refund_requests rr on rr.id=ru.request_id where ru.unit_id=f.id and rr.state='succeeded')
  and coalesce(o.paid_at,o.created_at)<now()-interval '10 minutes';
 insert into current_operation_issues
 select case e.kind when 'email.bounced' then 'email_bounced' when 'email.complained' then 'email_complained' when 'email.delivery_delayed' then 'email_delayed' else 'email_failed' end,
 f.id::text,o.id,f.id,null::bigint
 from public.esim_fulfillments f join public.checkout_orders o on o.id=f.order_id
 join lateral(select kind,occurred_at from public.operational_email_events e where e.email_id::text=f.email_id order by occurred_at desc,case when kind='email.delivered' then 0 else 1 end desc limit 1)e on true
 where o.livemode and not f.qa_authorized and o.status='paid' and not exists(select 1 from public.refund_units ru join public.refund_requests rr on rr.id=ru.request_id where ru.unit_id=f.id and rr.state='succeeded') and e.kind<>'email.delivered'
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
commit;
