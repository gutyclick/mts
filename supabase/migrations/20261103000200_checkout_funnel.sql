-- Fixed stage names only. Existing consent, revocation and retention apply.
begin;
create table public.checkout_analytics_stages (
 cohort_hash text not null references public.analytics_cohorts(hash) on delete cascade,
 kind text not null check(kind in ('checkout_entry','contact_ready','payment_ready','coupon_attempted','coupon_applied','coupon_rejected','payment_attempt','payment_error')),
 created_at timestamptz not null default now(),
 primary key(cohort_hash,kind)
);
alter table public.checkout_analytics_stages enable row level security;
revoke all on public.checkout_analytics_stages from public,anon,authenticated;
grant select on public.checkout_analytics_stages to service_role;
create function public.analytics_record_checkout_stage(p_hash text,p_kind text) returns boolean
language plpgsql security definer set search_path='' as $$
begin
 if p_kind is null or p_kind not in ('checkout_entry','contact_ready','payment_ready','coupon_attempted','coupon_applied','coupon_rejected','payment_attempt','payment_error') then return false;end if;
 perform 1 from public.analytics_cohorts where hash=p_hash and created_at>now()-interval '30 minutes' for update;
 if not found or exists(select 1 from public.analytics_revoked where hash=p_hash and expires_at>now())then return false;end if;
 insert into public.checkout_analytics_stages(cohort_hash,kind)values(p_hash,p_kind)on conflict do nothing;
 return found;
end;$$;
revoke all on function public.analytics_record_checkout_stage(text,text) from public,anon,authenticated;
grant execute on function public.analytics_record_checkout_stage(text,text) to service_role;

create function public.admin_checkout_analytics(p_actor uuid,p_days integer default 30) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.admin_memberships where user_id=p_actor)then raise exception 'admin_required';end if;
 return (with stages as (
 select c.hash,entry.created_at as entry_at,
 coalesce(bool_or(s.kind='contact_ready'),false) as contact,
 coalesce(bool_or(s.kind='payment_ready'),false) as ready,
 coalesce(bool_or(s.kind='coupon_attempted'),false) as coupon_attempted,
 coalesce(bool_or(s.kind='coupon_applied'),false) as coupon_applied,
 coalesce(bool_or(s.kind='coupon_rejected'),false) as coupon_rejected,
 coalesce(bool_or(s.kind='payment_attempt'),false) as attempted,
 coalesce(bool_or(s.kind='payment_error'),false) as payment_error,
 exists(select 1 from public.analytics_events e
   join public.checkout_orders o on o.analytics_order_key=e.order_key
   where e.cohort_hash=c.hash and e.kind='paid' and o.livemode
   and e.created_at>=entry.created_at
   and coalesce(o.paid_at,o.created_at)>=entry.created_at
   and coalesce(o.paid_at,o.created_at)<entry.created_at+interval '30 minutes') as paid
 from public.analytics_cohorts c
 join public.checkout_analytics_stages entry on entry.cohort_hash=c.hash and entry.kind='checkout_entry'
 left join public.checkout_analytics_stages s on s.cohort_hash=c.hash
 where entry.created_at>=now()-make_interval(days=>greatest(1,least(coalesce(p_days,30),30))) group by c.hash,entry.created_at
 ) select jsonb_build_object(
 'entry',count(*),'contactReady',count(*)filter(where contact),
 'paymentReady',count(*)filter(where ready),'paymentAttempt',count(*)filter(where attempted),
 'paymentError',count(*)filter(where payment_error),'couponAttempted',count(*)filter(where coupon_attempted),
 'couponApplied',count(*)filter(where coupon_applied),'couponRejected',count(*)filter(where coupon_rejected),
 'paid',count(*)filter(where paid),
 'incomplete',count(*)filter(where not paid and entry_at>now()-interval '30 minutes'),
 'matured',count(*)filter(where entry_at<=now()-interval '30 minutes'),
 'maturedUnpaid',count(*)filter(where not paid and entry_at<=now()-interval '30 minutes'),
 'stopped',jsonb_build_object(
   'afterAttempt',count(*)filter(where not paid and entry_at<=now()-interval '30 minutes' and attempted),
   'beforeContact',count(*)filter(where not paid and entry_at<=now()-interval '30 minutes' and not attempted and not contact),
   'formUnavailable',count(*)filter(where not paid and entry_at<=now()-interval '30 minutes' and not attempted and contact and not ready),
   'beforeAttempt',count(*)filter(where not paid and entry_at<=now()-interval '30 minutes' and not attempted and contact and ready)
 )
 )from stages);
end;$$;
revoke all on function public.admin_checkout_analytics(uuid,integer) from public,anon,authenticated;
grant execute on function public.admin_checkout_analytics(uuid,integer) to service_role;
commit;
