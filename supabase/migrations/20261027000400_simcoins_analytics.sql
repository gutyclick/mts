-- Optional consent-bound measurement; financial postings remain authoritative.
begin;
create table public.simcoins_analytics_events (
 id bigint generated always as identity primary key,
 cohort_hash text not null references public.analytics_cohorts(hash) on delete cascade,
 kind text not null check(kind in ('simcoins_landing_view','simcoins_join','simcoins_checkout_redeem','simcoins_earned','simcoins_redeemed','simcoins_level_up','simcoins_return_purchase')),
 event_nonce uuid,order_key uuid,created_at timestamptz not null default now(),
 unique nulls not distinct(cohort_hash,kind,event_nonce,order_key),
 check((kind in ('simcoins_landing_view','simcoins_join','simcoins_checkout_redeem') and event_nonce is not null and order_key is null)or(kind in ('simcoins_earned','simcoins_redeemed','simcoins_level_up','simcoins_return_purchase') and event_nonce is null and order_key is not null))
);
create index simcoins_analytics_created_idx on public.simcoins_analytics_events(created_at);
alter table public.simcoins_analytics_events enable row level security;
revoke all on public.simcoins_analytics_events from public,anon,authenticated;
grant select on public.simcoins_analytics_events to service_role;

create function public.simcoins_record_client_event(p_hash text,p_kind text,p_nonce uuid)returns boolean language plpgsql security definer set search_path='' as $$
begin
 if p_nonce is null or p_kind is null or p_kind not in ('simcoins_landing_view','simcoins_join','simcoins_checkout_redeem')then return false;end if;
 perform 1 from public.analytics_cohorts where hash=p_hash and created_at>now()-interval '30 minutes'for update;
 if not found or exists(select 1 from public.analytics_revoked where hash=p_hash and expires_at>now())then return false;end if;
 if(select count(*)from public.simcoins_analytics_events where cohort_hash=p_hash)>=120 then return false;end if;
 insert into public.simcoins_analytics_events(cohort_hash,kind,event_nonce)values(p_hash,p_kind,p_nonce)on conflict do nothing;
 return found;
end;$$;

create function public.simcoins_record_financial_event()returns trigger language plpgsql security definer set search_path='' as $$
declare o public.checkout_orders;spend bigint;prior_spend bigint;
begin
 if new.order_id is null or new.kind not in ('EARN','CONSUME')then return new;end if;
 select * into o from public.checkout_orders where id=new.order_id;
 if o.status<>'paid'or not o.livemode or o.analytics_cohort is null or o.analytics_order_key is null then return new;end if;
 -- Match the existing paid-event lock order: no cohort row lock while order/account locks are held.
 if not exists(select 1 from public.analytics_cohorts where hash=o.analytics_cohort and created_at>now()-interval '30 days')then return new;end if;
 if new.kind='CONSUME'and new.coin_delta<0 then
  insert into public.simcoins_analytics_events(cohort_hash,kind,order_key)values(o.analytics_cohort,'simcoins_redeemed',o.analytics_order_key)on conflict do nothing;
 elsif new.kind='EARN'then
  if new.coin_delta>0 then insert into public.simcoins_analytics_events(cohort_hash,kind,order_key)values(o.analytics_cohort,'simcoins_earned',o.analytics_order_key)on conflict do nothing;end if;
  if new.spend_delta_cents>0 then
   select greatest(coalesce(sum(spend_delta_cents),0),0)into spend from public.simcoins_transactions where account_id=new.account_id;
   prior_spend:=greatest(spend-new.spend_delta_cents,0);
   if exists(select 1 from public.simcoins_levels where threshold_cents>prior_spend and threshold_cents<=spend)then
    insert into public.simcoins_analytics_events(cohort_hash,kind,order_key)values(o.analytics_cohort,'simcoins_level_up',o.analytics_order_key)on conflict do nothing;
   end if;
   if exists(select 1 from public.simcoins_transactions t join public.checkout_orders previous on previous.id=t.order_id where t.account_id=new.account_id and t.kind='EARN'and t.spend_delta_cents>0 and t.order_id<>new.order_id and previous.livemode and previous.status='paid')then
    insert into public.simcoins_analytics_events(cohort_hash,kind,order_key)values(o.analytics_cohort,'simcoins_return_purchase',o.analytics_order_key)on conflict do nothing;
   end if;
  end if;
 end if;
 return new;
exception when others then
 -- Optional measurement cannot interrupt payment, refund, or ledger ownership.
 return new;
end;$$;
create trigger simcoins_financial_measurement after insert on public.simcoins_transactions for each row execute function public.simcoins_record_financial_event();
revoke all on function public.simcoins_record_client_event(text,text,uuid),public.simcoins_record_financial_event()from public,anon,authenticated;
grant execute on function public.simcoins_record_client_event(text,text,uuid)to service_role;
commit;
