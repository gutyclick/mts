-- Additive, deliberately disabled. No historical order enrollment or financial backfill.
begin;
create table public.simcoins_program_settings (
 id boolean primary key default true check(id), policy_version integer not null default 1 check(policy_version>0),
 enabled boolean not null default false, earn_enabled boolean not null default false,
 redeem_enabled boolean not null default false, admin_enabled boolean not null default false,
 public_enabled boolean not null default false,
 coins_per_usd integer not null default 100 check(coins_per_usd=100),
 max_redeem_bps integer not null default 500 check(max_redeem_bps between 0 and 500),
 min_contribution_bps integer not null default 2000 check(min_contribution_bps between 2000 and 10000),
 stripe_bps integer not null default 440 check(stripe_bps between 440 and 10000),
 stripe_fx_bps integer not null default 540 check(stripe_fx_bps between 540 and 10000),
 fixed_fee_units integer not null default 3000 check(fixed_fee_units between 3000 and 99999999),
 affiliate_bps integer not null default 800 check(affiliate_bps between 800 and 10000),
 max_promotion_bps integer not null default 500 check(max_promotion_bps between 0 and 500),
 other_variable_units integer not null default 0 check(other_variable_units between 0 and 99999999),
 release_delay_seconds integer not null default 604800 check(release_delay_seconds between 0 and 31536000),
 costs_max_age_seconds integer not null default 900 check(costs_max_age_seconds between 60 and 604800),
 eligibility_starts_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
insert into public.simcoins_program_settings(id)values(true);
create table public.simcoins_levels (
 id text primary key, name text not null, rate_bps integer not null check(rate_bps between 0 and 600),
 threshold_cents bigint not null unique check(threshold_cents>=0)
);
insert into public.simcoins_levels values ('traveler','Traveler',0,0),('explorer','Explorer',300,1),('adventurer','Adventurer',400,6000),('globetrotter','Globetrotter',500,12500),('legend','Legend',600,30000);
create table public.simcoins_accounts (
 id uuid primary key default gen_random_uuid(),user_id uuid not null unique references auth.users(id),
 created_at timestamptz not null default now()
);
create table public.simcoins_private_costs (
 plan_id text primary key references public.catalog_plans(id),
 wholesale_unit_units bigint not null check(wholesale_unit_units between 0 and 999999999999),
 observed_at timestamptz not null check(observed_at<=now()+interval '1 minute'),
 source_ref text check(length(source_ref)<=200)
);
create table public.simcoins_cost_refresh(id boolean primary key default true check(id),lease_token uuid,lease_until timestamptz,last_started_at timestamptz);
insert into public.simcoins_cost_refresh(id)values(true);
create function public.simcoins_claim_cost_refresh()returns uuid language plpgsql security definer set search_path='' as $$
declare r public.simcoins_cost_refresh;t uuid:=gen_random_uuid();begin
 if not exists(select 1 from public.simcoins_program_settings where id and enabled and(earn_enabled or redeem_enabled))then return null;end if;
 select * into r from public.simcoins_cost_refresh where id for update;
 if r.lease_until>now()or r.last_started_at>now()-interval '1 minute'then return null;end if;
 update public.simcoins_cost_refresh set lease_token=t,lease_until=now()+interval '60 seconds',last_started_at=now()where id;return t;
end;$$;
create function public.simcoins_release_cost_refresh(p_token uuid)returns void language sql security definer set search_path='' as $$update public.simcoins_cost_refresh set lease_token=null,lease_until=null where id and lease_token=p_token$$;
comment on column public.simcoins_private_costs.wholesale_unit_units is 'Private wholesale cost in units of 1/10000 USD; never customer-readable.';
create table public.simcoins_product_eligibility (
 plan_id text primary key references public.catalog_plans(id),
 earn_enabled boolean not null default false,redeem_enabled boolean not null default false,
 updated_at timestamptz not null default now()
);
create table public.simcoins_quotes (
 id uuid primary key default gen_random_uuid(),account_id uuid not null references public.simcoins_accounts(id),
 cart_hash text not null check(cart_hash~'^[a-f0-9]{64}$'),currency text not null check(public.fx_currency(currency)),
 fx_quote_id uuid references public.fx_snapshots(id),snapshot jsonb not null,
 created_at timestamptz not null default now(),expires_at timestamptz not null default now()+interval '5 minutes'
);
create table public.simcoins_order_snapshots (
 order_id uuid primary key references public.checkout_orders(id), account_id uuid not null references public.simcoins_accounts(id),
 quote_id uuid not null unique references public.simcoins_quotes(id), policy_version integer not null,
 snapshot jsonb not null,release_delay_seconds integer not null,
 created_at timestamptz not null default now()
);
create table public.simcoins_unit_snapshots (
 order_id uuid not null references public.simcoins_order_snapshots(order_id),plan_id text not null,unit_index integer not null,
 gross_cents integer not null check(gross_cents>0), net_cents integer not null check(net_cents>0),paid_cents integer not null check(paid_cents>0 and paid_cents<=net_cents),
 redeemed_coins integer not null check(redeemed_coins>=0),earned_coins integer not null check(earned_coins>=0),
 eligible_spend_cents integer not null check(eligible_spend_cents>=0),wholesale_units bigint not null check(wholesale_units>=0),
 earn_eligible boolean not null,fixed_fee_units integer not null check(fixed_fee_units between 0 and 99999999),
 primary key(order_id,plan_id,unit_index),foreign key(order_id,plan_id)references public.checkout_order_items(order_id,plan_id),
 check(gross_cents=net_cents+redeemed_coins)
);
create table public.simcoins_checkout_reservations (
 id uuid primary key default gen_random_uuid(),order_id uuid not null unique references public.simcoins_order_snapshots(order_id),
 account_id uuid not null references public.simcoins_accounts(id),coins bigint not null check(coins>0),
 state text not null default 'reserved' check(state in ('reserved','consumed','released','late_consumed')),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table public.simcoins_redemptions (
 order_id uuid primary key references public.simcoins_order_snapshots(order_id),account_id uuid not null references public.simcoins_accounts(id),
 coins bigint not null check(coins>0),created_at timestamptz not null default now()
);
create table public.simcoins_transactions (
 id bigint generated always as identity primary key,account_id uuid not null references public.simcoins_accounts(id),
 source_key text not null unique check(length(source_key)between 1 and 300),
 kind text not null check(kind in ('EARN','RESERVE','RELEASE_RESERVATION','CONSUME','RELEASE_EARN','REFUND_EARN','REFUND_REDEEM','ADJUST')),
 bucket text not null check(bucket in ('pending','available','reserved')),
 coin_delta bigint not null check(abs(coin_delta)<=999999999999),
 spend_delta_cents bigint not null default 0 check(abs(spend_delta_cents)<=999999999999),
 order_id uuid references public.checkout_orders(id),plan_id text,unit_index integer,refund_id uuid references public.refund_requests(id),
 created_at timestamptz not null default now(),
 check(kind in ('EARN','REFUND_EARN')or spend_delta_cents=0),
 check(coin_delta<>0 or spend_delta_cents<>0)
);
create index simcoins_transactions_account_idx on public.simcoins_transactions(account_id,id desc);
create index simcoins_transactions_order_idx on public.simcoins_transactions(order_id,plan_id,unit_index);
create table public.simcoins_audit_logs (
 id bigint generated always as identity primary key,request_id uuid not null unique,actor uuid not null references auth.users(id),
 action text not null,reason text not null check(length(btrim(reason))between 10 and 1000),target_user uuid,
 before_value jsonb,after_value jsonb,created_at timestamptz not null default now()
);

create function public.simcoins_immutable()returns trigger language plpgsql set search_path='' as $$begin raise exception 'simcoins_immutable';end;$$;
create trigger simcoins_transactions_immutable before update or delete on public.simcoins_transactions for each row execute function public.simcoins_immutable();
create trigger simcoins_audit_immutable before update or delete on public.simcoins_audit_logs for each row execute function public.simcoins_immutable();
create trigger simcoins_quote_immutable before update or delete on public.simcoins_quotes for each row execute function public.simcoins_immutable();
create trigger simcoins_order_immutable before update or delete on public.simcoins_order_snapshots for each row execute function public.simcoins_immutable();
create trigger simcoins_unit_immutable before update or delete on public.simcoins_unit_snapshots for each row execute function public.simcoins_immutable();
create trigger simcoins_redemption_immutable before update or delete on public.simcoins_redemptions for each row execute function public.simcoins_immutable();

-- Internal helpers are service-only too. Account locks are always acquired after existing order locks.
create function public.simcoins_account(p_user uuid)returns uuid language plpgsql security definer set search_path='' as $$
declare a uuid;begin
 if p_user is null then raise exception 'simcoins_user_required';end if;
 insert into public.simcoins_accounts(user_id)values(p_user)on conflict(user_id)do nothing;
 select id into a from public.simcoins_accounts where user_id=p_user;return a;
end;$$;
create function public.simcoins_wallet(p_user uuid)returns jsonb language plpgsql security definer set search_path='' as $$
declare a uuid;av bigint;pe bigint;re bigint;sp bigint;l public.simcoins_levels;n public.simcoins_levels;
begin
 a:=public.simcoins_account(p_user);
 select coalesce(sum(coin_delta)filter(where bucket='available'),0),coalesce(sum(coin_delta)filter(where bucket='pending'),0),coalesce(sum(coin_delta)filter(where bucket='reserved'),0),greatest(coalesce(sum(spend_delta_cents),0),0)into av,pe,re,sp from public.simcoins_transactions where account_id=a;
 select * into l from public.simcoins_levels where threshold_cents<=sp order by threshold_cents desc limit 1;
 select * into n from public.simcoins_levels where threshold_cents>sp order by threshold_cents limit 1;
 return jsonb_build_object('availableCoins',greatest(av,0),'pendingCoins',greatest(pe,0),'reservedCoins',greatest(re,0),'debtCoins',greatest(-av,0),'eligibleSpendCents',sp,
 'level',jsonb_build_object('id',l.id,'name',l.name,'rateBps',l.rate_bps,'thresholdCents',l.threshold_cents),
 'nextLevel',case when n.id is null then null else jsonb_build_object('id',n.id,'name',n.name,'rateBps',n.rate_bps,'thresholdCents',n.threshold_cents)end,
 'history',(select coalesce(jsonb_agg(x),'[]')from(select kind,bucket,coin_delta as "coinDelta",spend_delta_cents as "spendDeltaCents",order_id as "orderId",created_at as "createdAt"from public.simcoins_transactions where account_id=a order by id desc limit 100)x),
 'pending',(select coalesce(jsonb_agg(x),'[]')from(select t.order_id as "orderId",sum(t.coin_delta)as coins,
 (select case when count(*)=count(d.ready_at)then max(d.ready_at)else null end from public.simcoins_unit_snapshots u join public.simcoins_order_snapshots ss on ss.order_id=u.order_id left join public.esim_fulfillments f on f.order_id=u.order_id and f.plan_id=u.plan_id and f.unit_index=u.unit_index left join lateral(select min(greatest(e.occurred_at,f.sent_at))+make_interval(secs=>ss.release_delay_seconds)as ready_at from public.operational_email_events e where e.email_id::text=f.email_id and e.kind='email.delivered'and f.state='sent'and f.sent_at is not null and not f.qa_authorized and f.provider_order_no is not null and f.provider_esim_id is not null and f.iccid is not null and f.smdp_address is not null and f.activation_code is not null)d on true where u.order_id=t.order_id and(select coalesce(sum(pt.coin_delta),0)from public.simcoins_transactions pt where pt.order_id=u.order_id and pt.plan_id=u.plan_id and pt.unit_index=u.unit_index and pt.bucket='pending')>0)as "releaseAt"
 from public.simcoins_transactions t where t.account_id=a and t.bucket='pending'group by t.order_id having sum(t.coin_delta)>0)x));
end;$$;

-- Revalidates a server-generated quote against the database. Prices/costs/tiers can change between quotes and reservation.
-- Private, bounded explanation of excluded offers; this never posts coins or creates an order snapshot.
create function public.simcoins_record_exclusion(p_user uuid,p_cart_hash text,p_snapshot jsonb)returns void language plpgsql security definer set search_path='' as $$
declare why text;
begin
 if not exists(select 1 from public.simcoins_program_settings where id and enabled)then return;end if;
 if p_user is null or p_cart_hash is null or p_cart_hash!~'^[a-f0-9]{64}$'or p_snapshot is null or pg_column_size(p_snapshot)>262144 then return;end if;
 why:=p_snapshot->>'reason';
 if why is null or why not in('unverified_cost','unverified_fx','promotion_restricted','insufficient_contribution','promotion_excludes_redemption','product_ineligible')then return;end if;
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,8761));
 if(select count(*)from public.simcoins_audit_logs where actor=p_user and action='quote_excluded'and created_at>now()-interval '1 hour')>=60 or exists(select 1 from public.simcoins_audit_logs where actor=p_user and action='quote_excluded'and reason=why and after_value->>'cartHash'=p_cart_hash and created_at>now()-interval '1 hour')then return;end if;
 insert into public.simcoins_audit_logs(request_id,actor,action,reason,target_user,after_value)values(gen_random_uuid(),p_user,'quote_excluded',why,p_user,jsonb_build_object('cartHash',p_cart_hash,'policyVersion',p_snapshot->'policyVersion','currency',p_snapshot->'currency','lines',p_snapshot->'lines','contributionUnits',p_snapshot->'contributionUnits'));
end;$$;
create function public.simcoins_validate_snapshot(p_user uuid,p_currency text,p_snapshot jsonb,p_fx_quote uuid default null)returns void language plpgsql security definer set search_path='' as $$
declare s public.simcoins_program_settings;w jsonb;l jsonb;u jsonb;p public.catalog_plans;c public.simcoins_private_costs;e public.simcoins_product_eligibility;
 gross bigint:=0;net bigint:=0;redeemed bigint:=0;earned bigint:=0;spend bigint:=0;qty integer;nu integer;g integer;n integer;r integer;ec integer;sc integer;cost bigint;total_cost bigint:=0;rate integer;earn_ok boolean;redeem_ok boolean;unit_earn bigint;line_earn bigint;line_spend bigint;unit_fee bigint;fees bigint:=0;unit_count integer;fixed_fee bigint;ordinal integer;unit_eligible boolean;fx_rate text;minor integer;paid integer;paid_total bigint:=0;
begin
 select * into s from public.simcoins_program_settings where id;
 if not s.enabled then raise exception 'simcoins_disabled';end if;
 if p_snapshot is null or jsonb_typeof(p_snapshot)<>'object' or (p_snapshot->>'version')::integer is distinct from 1 or(p_snapshot->>'policyVersion')::integer is distinct from s.policy_version or p_snapshot->>'currency' is distinct from p_currency or p_currency is null or not public.fx_currency(p_currency)or coalesce((p_snapshot->>'promoCents')::integer,-1)<>0 or coalesce((p_snapshot->>'taxCents')::integer,-1)<>0 then raise exception 'simcoins_invalid_snapshot';end if;
 if p_currency='USD'then if p_fx_quote is not null then raise exception 'simcoins_fx_quote';end if;fx_rate:='10000000000';else select rates->>p_currency into fx_rate from public.fx_snapshots where id=p_fx_quote and expires_at>now();if not found then raise exception 'simcoins_fx_quote';end if;end if;
 minor:=case when p_currency in('JPY','KRW','CLP')then 1 else 100 end;
 if p_snapshot->>'fxRate' is distinct from fx_rate or(p_snapshot->>'currencyDecimals')::integer is distinct from(case when minor=1 then 0 else 2 end)then raise exception 'simcoins_fx_quote';end if;
 w:=public.simcoins_wallet(p_user);rate:=(w->'level'->>'rateBps')::integer;
 if p_snapshot->>'levelId' is distinct from w->'level'->>'id'or(p_snapshot->>'rateBps')::integer is distinct from rate then raise exception 'simcoins_level_changed';end if;
 if jsonb_typeof(p_snapshot->'lines')is distinct from 'array'or jsonb_array_length(p_snapshot->'lines')not between 1 and 20 or jsonb_typeof(p_snapshot->'units')is distinct from 'array'or jsonb_array_length(p_snapshot->'units')not between 1 and 200 then raise exception 'simcoins_invalid_snapshot';end if;
 if(select count(distinct x->>'planId')from jsonb_array_elements(p_snapshot->'lines')x)<>jsonb_array_length(p_snapshot->'lines')then raise exception 'simcoins_invalid_snapshot';end if;
 unit_count:=jsonb_array_length(p_snapshot->'units');
 for l in select * from jsonb_array_elements(p_snapshot->'lines')loop
  select * into p from public.catalog_plans where id=l->>'planId'for share;
  if not found or not p.is_published or p.kind<>'fixed'then raise exception 'simcoins_unavailable_plan';end if;
  qty:=(l->>'quantity')::integer;g:=(l->>'grossUnitCents')::integer;n:=(l->>'netUnitCents')::integer;r:=(l->>'redeemUnitCoins')::integer;
  if qty is null or qty not between 1 and 10 or g is distinct from p.retail_price_cents or n is null or n<=0 or r is null or r<0 or n+r<>g or r*10000::bigint>g::bigint*s.max_redeem_bps then raise exception 'simcoins_invalid_amount';end if;
  paid:=least(n,floor(public.fx_convert_minor(n,p_currency,fx_rate)::numeric*100*10000000000/(fx_rate::numeric*minor))::integer);
  if paid<=0 then raise exception 'simcoins_invalid_amount';end if;
  select * into c from public.simcoins_private_costs where plan_id=p.id for share;
  if not found or c.observed_at<now()-make_interval(secs=>s.costs_max_age_seconds)then raise exception 'simcoins_cost_unavailable';end if;
  select * into e from public.simcoins_product_eligibility where plan_id=p.id for share;
  earn_ok:=s.earn_enabled and coalesce(e.earn_enabled,false)and c.plan_id is not null and c.observed_at>=now()-make_interval(secs=>s.costs_max_age_seconds);
  redeem_ok:=s.redeem_enabled and coalesce(e.redeem_enabled,false)and c.plan_id is not null and c.observed_at>=now()-make_interval(secs=>s.costs_max_age_seconds);
  if(l->>'redeemEligible')::boolean is null or((l->>'redeemEligible')::boolean and not redeem_ok)then raise exception 'simcoins_eligibility_changed';end if;
  if r>0 and not redeem_ok then raise exception 'simcoins_product_ineligible';end if;
  cost:=coalesce(c.wholesale_unit_units,0);
  if(l->>'wholesaleUnitUnits')::bigint is distinct from cost then raise exception 'simcoins_cost_changed';end if;
  -- Per-line equal unit allocation is required by the existing Stripe quantity contract.
  select count(*)into nu from jsonb_array_elements(p_snapshot->'units')x where x->>'planId'=p.id;
  if nu<>qty or(select count(distinct (x->>'unitIndex')::integer)from jsonb_array_elements(p_snapshot->'units')x where x->>'planId'=p.id)<>qty then raise exception 'simcoins_invalid_units';end if;
  line_earn:=0;line_spend:=0;
  for u in select * from jsonb_array_elements(p_snapshot->'units')x where x->>'planId'=p.id loop
   select count(*)into ordinal from jsonb_array_elements(p_snapshot->'units')x where (x->>'planId' collate "C",(x->>'unitIndex')::integer)<(u->>'planId' collate "C",(u->>'unitIndex')::integer);
   fixed_fee:=s.fixed_fee_units/unit_count+case when ordinal<s.fixed_fee_units%unit_count then 1 else 0 end;
   if(u->>'fixedFeeUnits')::bigint is distinct from fixed_fee then raise exception 'simcoins_invalid_fee';end if;
   unit_fee:=ceil(n::numeric*100*(case when p_currency='USD'then s.stripe_bps else s.stripe_fx_bps end)/10000)+ceil(n::numeric*100*s.affiliate_bps/10000)+fixed_fee+s.other_variable_units;
   unit_eligible:=(u->>'earnEligible')::boolean;
   if unit_eligible is null or(unit_eligible and not earn_ok)then raise exception 'simcoins_eligibility_changed';end if;
   if unit_eligible and(paid*100-cost-unit_fee-ceil(paid::numeric*rate/10000)*100)*10000<paid::bigint*100*s.min_contribution_bps then raise exception 'simcoins_insufficient_margin';end if;
   ec:=case when unit_eligible then floor(paid::numeric*rate/10000)::integer else 0 end;
   sc:=case when unit_eligible then paid else 0 end;
   unit_earn:=(u->>'earnedCoins')::bigint;
   if(u->>'unitIndex')::integer is null or(u->>'unitIndex')::integer not between 1 and qty or(u->>'grossCents')::integer is distinct from g or(u->>'netCents')::integer is distinct from n or(u->>'paidCents')::integer is distinct from paid or(u->>'redeemedCoins')::integer is distinct from r or unit_earn is null or unit_earn<ec or unit_earn>(case when unit_eligible then ceil(paid::numeric*rate/10000)else 0 end)or(u->>'eligibleSpendCents')::integer is distinct from sc or(u->>'wholesaleUnits')::bigint is distinct from cost or(u->>'earnEligible')::boolean is distinct from unit_eligible or(u->>'taxCents')::integer is distinct from 0 or(u->>'promotionCents')::integer is distinct from 0 then raise exception 'simcoins_invalid_units';end if;
   if(unit_eligible or r>0)and(paid*100-cost-unit_fee-unit_earn*100)*10000<paid::bigint*100*s.min_contribution_bps then raise exception 'simcoins_insufficient_margin';end if;
   fees:=fees+unit_fee;line_earn:=line_earn+unit_earn;line_spend:=line_spend+sc;
  end loop;
  if(l->>'earnedCoins')::bigint is distinct from line_earn or(l->>'eligibleSpendCents')::bigint is distinct from line_spend then raise exception 'simcoins_invalid_earn';end if;
  gross:=gross+g*qty;net:=net+n*qty;paid_total:=paid_total+paid*qty;redeemed:=redeemed+r*qty;earned:=earned+line_earn;spend:=spend+line_spend;total_cost:=total_cost+cost*qty;
 end loop;
 if(select sum((x->>'quantity')::integer)from jsonb_array_elements(p_snapshot->'lines')x)<>jsonb_array_length(p_snapshot->'units')then raise exception 'simcoins_invalid_units';end if;
 if gross not between 1 and 99999999 or net not between 1 and 99999999 or(p_snapshot->>'grossCents')::bigint is distinct from gross or(p_snapshot->>'netCents')::bigint is distinct from net or(p_snapshot->>'redeemedCoins')::bigint is distinct from redeemed or(p_snapshot->>'earnedCoins')::bigint is distinct from earned or(p_snapshot->>'eligibleSpendCents')::bigint is distinct from spend then raise exception 'simcoins_invalid_totals';end if;
 if earned<>floor(spend::numeric*rate/10000)then raise exception 'simcoins_invalid_earn';end if;
 if redeemed>coalesce((w->>'availableCoins')::bigint,0)or(w->>'debtCoins')::bigint>0 and redeemed>0 then raise exception 'insufficient_coins';end if;
 -- Cent costs round up, transaction fee once; compare exact integer contribution against cash collected.
 if (paid_total*100-total_cost-fees-earned*100)*10000<paid_total*100*s.min_contribution_bps then raise exception 'simcoins_insufficient_margin';end if;
end;$$;

create function public.simcoins_create_quote(p_user uuid,p_cart_hash text,p_currency text,p_fx_quote uuid,p_snapshot jsonb)returns jsonb language plpgsql security definer set search_path='' as $$
declare a uuid;q public.simcoins_quotes;
begin
 a:=public.simcoins_account(p_user);perform 1 from public.simcoins_accounts where id=a for update;
 if(select count(*)from public.simcoins_quotes where account_id=a and created_at>now()-interval '1 hour')>=60 then raise exception 'simcoins_quote_rate_limit';end if;
 perform public.simcoins_validate_snapshot(p_user,p_currency,p_snapshot,p_fx_quote);
 if(p_currency='USD'and p_fx_quote is not null)or(p_currency<>'USD'and not exists(select 1 from public.fx_snapshots where id=p_fx_quote and expires_at>now()and rates?p_currency))then raise exception 'simcoins_fx_quote';end if;
 insert into public.simcoins_quotes(account_id,cart_hash,currency,fx_quote_id,snapshot)values(a,p_cart_hash,p_currency,p_fx_quote,p_snapshot)returning * into q;
 return jsonb_build_object('id',q.id,'expiresAt',q.expires_at);
end;$$;

create function public.simcoins_prepare_order(p_order uuid,p_user uuid,p_quote uuid)returns jsonb language plpgsql security definer set search_path='' as $$
declare o public.checkout_orders;a uuid;q public.simcoins_quotes;ss public.simcoins_order_snapshots;u jsonb;r bigint;s public.simcoins_program_settings;
begin
 select * into o from public.checkout_orders where id=p_order for update;
 if not found or o.user_id is distinct from p_user then raise exception 'simcoins_order_owner';end if;
 a:=public.simcoins_account(p_user);perform 1 from public.simcoins_accounts where id=a for update;
 select * into ss from public.simcoins_order_snapshots where order_id=p_order;
 if found then if ss.quote_id<>p_quote then raise exception 'simcoins_attempt_conflict';end if;return to_jsonb(o)||jsonb_build_object('simcoins',ss.snapshot);end if;
 select * into s from public.simcoins_program_settings where id;
 if o.status<>'pending'or not o.livemode or o.created_at<s.eligibility_starts_at or o.payment_currency is not null or o.stripe_session_id is not null then raise exception 'simcoins_order_ineligible';end if;
 select * into q from public.simcoins_quotes where id=p_quote and account_id=a and expires_at>now();
 if not found then raise exception 'simcoins_quote_expired';end if;
 perform public.simcoins_validate_snapshot(p_user,q.currency,q.snapshot,q.fx_quote_id);
 if o.amount_total is distinct from(q.snapshot->>'grossCents')::integer or(select count(*)from public.checkout_order_items where order_id=o.id)<>jsonb_array_length(q.snapshot->'lines')or exists(select 1 from public.checkout_order_items i left join jsonb_array_elements(q.snapshot->'lines')l on l->>'planId'=i.plan_id where i.order_id=o.id and(l is null or i.quantity<>(l->>'quantity')::integer or i.unit_amount<>(l->>'grossUnitCents')::integer))then raise exception 'simcoins_cart_changed';end if;
 insert into public.simcoins_order_snapshots(order_id,account_id,quote_id,policy_version,snapshot,release_delay_seconds)values(o.id,a,q.id,s.policy_version,q.snapshot,s.release_delay_seconds);
 for u in select * from jsonb_array_elements(q.snapshot->'units')loop
  insert into public.simcoins_unit_snapshots values(o.id,u->>'planId',(u->>'unitIndex')::integer,(u->>'grossCents')::integer,(u->>'netCents')::integer,(u->>'paidCents')::integer,(u->>'redeemedCoins')::integer,(u->>'earnedCoins')::integer,(u->>'eligibleSpendCents')::integer,(u->>'wholesaleUnits')::bigint,(u->>'earnEligible')::boolean,(u->>'fixedFeeUnits')::integer);
 end loop;
 r:=(q.snapshot->>'redeemedCoins')::bigint;
 if r>0 then
  insert into public.simcoins_checkout_reservations(order_id,account_id,coins)values(o.id,a,r);
  insert into public.simcoins_transactions(account_id,source_key,kind,bucket,coin_delta,order_id)values(a,'reserve:available:'||o.id,'RESERVE','available',-r,o.id),(a,'reserve:reserved:'||o.id,'RESERVE','reserved',r,o.id);
 end if;
 return to_jsonb(o)||jsonb_build_object('simcoins',q.snapshot);
end;$$;

create function public.simcoins_prepare_payment(p_order uuid,p_currency text,p_quote uuid,p_expected integer)returns jsonb language plpgsql security definer set search_path='' as $$
declare o public.checkout_orders;ss public.simcoins_order_snapshots;q public.simcoins_quotes;fx public.fx_snapshots;rate text;total bigint;
begin
 select * into o from public.checkout_orders where id=p_order for update;
 select * into ss from public.simcoins_order_snapshots where order_id=p_order;
 if not found then return public.prepare_checkout_payment(p_order,p_currency,p_quote,p_expected);end if;
 if o.status<>'pending'then raise exception 'pending_order_required';end if;
 select * into q from public.simcoins_quotes where id=ss.quote_id;
 if q.currency is distinct from p_currency or q.fx_quote_id is distinct from p_quote then raise exception 'attempt_conflict';end if;
 if o.payment_currency is not null then
  if o.payment_currency is distinct from p_currency or o.fx_snapshot_id is distinct from p_quote or o.payment_total is distinct from p_expected then raise exception 'attempt_conflict';end if;return to_jsonb(o);
 end if;
 if p_currency='USD'then rate:='10000000000';else select * into fx from public.fx_snapshots where id=p_quote and expires_at>now()for share;if not found then raise exception 'quote_expired';end if;rate:=fx.rates->>p_currency;end if;
 select sum(public.fx_convert_minor((l->>'netUnitCents')::integer,p_currency,rate)::bigint*(l->>'quantity')::integer)into total from jsonb_array_elements(ss.snapshot->'lines')l;
 if total not between 1 and 99999999 or total is distinct from p_expected::bigint then raise exception 'price_changed';end if;
 update public.checkout_order_items i set payment_unit_amount=public.fx_convert_minor((l->>'netUnitCents')::integer,p_currency,rate),payment_stripe_price_id=null from jsonb_array_elements(ss.snapshot->'lines')l where i.order_id=o.id and i.plan_id=l->>'planId';
 update public.checkout_orders set payment_currency=p_currency,payment_total=total,fx_snapshot_id=p_quote where id=o.id returning * into o;return to_jsonb(o);
end;$$;

create function public.simcoins_reconcile_order(p_order uuid)returns void language plpgsql security definer set search_path='' as $$
declare o public.checkout_orders;ss public.simcoins_order_snapshots;r public.simcoins_checkout_reservations;u public.simcoins_unit_snapshots;k text;
begin
 select * into o from public.checkout_orders where id=p_order for update;
 select * into ss from public.simcoins_order_snapshots where order_id=p_order;if not found then return;end if;
 perform 1 from public.simcoins_accounts where id=ss.account_id for update;
 select * into r from public.simcoins_checkout_reservations where order_id=p_order for update;
 if o.status='paid'then
  if r.id is not null and r.state in ('reserved','released')then
   insert into public.simcoins_transactions(account_id,source_key,kind,bucket,coin_delta,order_id)values(ss.account_id,'consume:'||o.id,'CONSUME',case when r.state='reserved'then 'reserved'else 'available'end,-r.coins,o.id)on conflict(source_key)do nothing;
   update public.simcoins_checkout_reservations set state=case when r.state='released'then 'late_consumed'else 'consumed'end,updated_at=now()where id=r.id;
   insert into public.simcoins_redemptions(order_id,account_id,coins)values(o.id,ss.account_id,r.coins)on conflict(order_id)do nothing;
  end if;
  for u in select * from public.simcoins_unit_snapshots where order_id=o.id loop
   if u.earned_coins>0 or u.eligible_spend_cents>0 then
    k:='earn:'||o.id||':'||u.plan_id||':'||u.unit_index;
    insert into public.simcoins_transactions(account_id,source_key,kind,bucket,coin_delta,spend_delta_cents,order_id,plan_id,unit_index)values(ss.account_id,k,'EARN','pending',u.earned_coins,u.eligible_spend_cents,o.id,u.plan_id,u.unit_index)on conflict(source_key)do nothing;
   end if;
  end loop;
 elsif o.status in ('failed','expired','cancelled')and not o.payment_in_progress and r.state='reserved'then
  insert into public.simcoins_transactions(account_id,source_key,kind,bucket,coin_delta,order_id)values(ss.account_id,'unreserve:reserved:'||o.id,'RELEASE_RESERVATION','reserved',-r.coins,o.id),(ss.account_id,'unreserve:available:'||o.id,'RELEASE_RESERVATION','available',r.coins,o.id)on conflict(source_key)do nothing;
  update public.simcoins_checkout_reservations set state='released',updated_at=now()where id=r.id;
 end if;
end;$$;
create function public.simcoins_order_trigger()returns trigger language plpgsql security definer set search_path='' as $$begin perform public.simcoins_reconcile_order(new.id);return new;end;$$;
create trigger simcoins_order_transition after update of status,payment_in_progress on public.checkout_orders for each row execute function public.simcoins_order_trigger();

create function public.simcoins_release_due(p_limit integer default 20)returns integer language plpgsql security definer set search_path='' as $$
declare v record;n integer:=0;pending bigint;k text;candidates jsonb;
begin
 -- Disabling new enrollment must not strand already committed customer entitlements.
 select coalesce(jsonb_agg(to_jsonb(d)),'[]')into candidates from(select o.id as oid,u.plan_id,u.unit_index,ss.account_id from public.checkout_orders o join public.simcoins_order_snapshots ss on ss.order_id=o.id join public.simcoins_unit_snapshots u on u.order_id=o.id join public.esim_fulfillments f on f.order_id=u.order_id and f.plan_id=u.plan_id and f.unit_index=u.unit_index
  where o.status='paid'and o.livemode and not f.qa_authorized and u.earn_eligible and f.state='sent'and f.sent_at is not null and f.provider_order_no is not null and f.provider_esim_id is not null and f.iccid is not null and f.smdp_address is not null and f.activation_code is not null
  and exists(select 1 from public.operational_email_events e where e.email_id::text=f.email_id and e.kind='email.delivered'and greatest(e.occurred_at,f.sent_at)+make_interval(secs=>ss.release_delay_seconds)<=now())
  -- Refunds already append proportional pending reversals under this same order lock.
  -- The net pending amount below excludes refunded entitlement and preserves an unrefunded remainder.
  and(select coalesce(sum(t.coin_delta),0)from public.simcoins_transactions t where t.order_id=o.id and t.plan_id=u.plan_id and t.unit_index=u.unit_index and t.bucket='pending')>0
  and not exists(select 1 from public.simcoins_transactions t where t.source_key='release:pending:'||o.id||':'||u.plan_id||':'||u.unit_index)
  order by o.id,u.plan_id,u.unit_index limit least(greatest(p_limit,1),100)for update of o skip locked)d;
 -- Materialize and lock every order first, then every account in a stable order.
 -- Acquiring another order after an account would invert the refund/reservation lock order.
 perform a.id from public.simcoins_accounts a where a.id in(select(x->>'account_id')::uuid from jsonb_array_elements(candidates)x)order by a.id for update;
 for v in select(x->>'oid')::uuid as oid,x->>'plan_id'as plan_id,(x->>'unit_index')::integer as unit_index,(x->>'account_id')::uuid as account_id from jsonb_array_elements(candidates)x loop
  select coalesce(sum(coin_delta),0)into pending from public.simcoins_transactions where order_id=v.oid and plan_id=v.plan_id and unit_index=v.unit_index and bucket='pending';
  if pending>0 then
   k:=v.oid||':'||v.plan_id||':'||v.unit_index;
   insert into public.simcoins_transactions(account_id,source_key,kind,bucket,coin_delta,order_id,plan_id,unit_index)values(v.account_id,'release:pending:'||k,'RELEASE_EARN','pending',-pending,v.oid,v.plan_id,v.unit_index),(v.account_id,'release:available:'||k,'RELEASE_EARN','available',pending,v.oid,v.plan_id,v.unit_index)on conflict(source_key)do nothing;n:=n+1;
  end if;
 end loop;return n;
end;$$;

create function public.simcoins_refund_order(p_refund uuid)returns void language plpgsql security definer set search_path='' as $$
declare r public.refund_requests;ss public.simcoins_order_snapshots;u record;k text;pending bigint;prior_earn bigint;prior_spend bigint;prior_redeem bigint;cash_refunded bigint;target_earn bigint;target_spend bigint;target_redeem bigint;earn_delta bigint;spend_delta bigint;redeem_delta bigint;pending_debit bigint;available_debit bigint;
begin
 -- Existing refund RPCs lock order before refund. Preserve that global ordering here too.
 perform 1 from public.checkout_orders where id=(select order_id from public.refund_requests where id=p_refund)for update;
 select * into r from public.refund_requests where id=p_refund for update;if not found or r.state<>'succeeded'then return;end if;
 select * into ss from public.simcoins_order_snapshots where order_id=r.order_id;if not found then return;end if;
 perform 1 from public.simcoins_accounts where id=ss.account_id for update;
 for u in select us.*,f.id as fulfillment_id,coalesce(i.payment_unit_amount,public.fx_convert_minor(us.net_cents,ss.snapshot->>'currency',ss.snapshot->>'fxRate'))as payment_cents from public.refund_units ru join public.esim_fulfillments f on f.id=ru.unit_id join public.simcoins_unit_snapshots us on us.order_id=f.order_id and us.plan_id=f.plan_id and us.unit_index=f.unit_index join public.checkout_order_items i on i.order_id=us.order_id and i.plan_id=us.plan_id where ru.request_id=r.id and us.order_id=r.order_id loop
  k:=r.id||':'||u.plan_id||':'||u.unit_index;
  select coalesce(sum(ru.amount),0)into cash_refunded from public.refund_units ru join public.refund_requests rr on rr.id=ru.request_id where ru.unit_id=u.fulfillment_id and rr.order_id=r.order_id and rr.state='succeeded';
  if cash_refunded<0 or cash_refunded>u.payment_cents or u.payment_cents<=0 then raise exception 'simcoins_refund_amount_mismatch';end if;
  target_earn:=floor(u.earned_coins::numeric*cash_refunded/u.payment_cents);target_spend:=floor(u.eligible_spend_cents::numeric*cash_refunded/u.payment_cents);target_redeem:=floor(u.redeemed_coins::numeric*cash_refunded/u.payment_cents);
  select coalesce(sum(coin_delta)filter(where bucket='pending'),0),-coalesce(sum(coin_delta)filter(where kind='REFUND_EARN'),0),-coalesce(sum(spend_delta_cents)filter(where kind='REFUND_EARN'),0),coalesce(sum(coin_delta)filter(where kind='REFUND_REDEEM'),0)into pending,prior_earn,prior_spend,prior_redeem from public.simcoins_transactions where order_id=r.order_id and plan_id=u.plan_id and unit_index=u.unit_index;
  earn_delta:=greatest(target_earn-prior_earn,0);spend_delta:=greatest(target_spend-prior_spend,0);redeem_delta:=greatest(target_redeem-prior_redeem,0);pending_debit:=least(greatest(pending,0),earn_delta);available_debit:=earn_delta-pending_debit;
  if pending_debit>0 then
   insert into public.simcoins_transactions(account_id,source_key,kind,bucket,coin_delta,spend_delta_cents,order_id,plan_id,unit_index,refund_id)values(ss.account_id,'refund:pending:'||k,'REFUND_EARN','pending',-pending_debit,-spend_delta,r.order_id,u.plan_id,u.unit_index,r.id)on conflict(source_key)do nothing;
   spend_delta:=0;
  end if;
  if available_debit>0 or spend_delta>0 then
   insert into public.simcoins_transactions(account_id,source_key,kind,bucket,coin_delta,spend_delta_cents,order_id,plan_id,unit_index,refund_id)values(ss.account_id,'refund:available:'||k,'REFUND_EARN','available',-available_debit,-spend_delta,r.order_id,u.plan_id,u.unit_index,r.id)on conflict(source_key)do nothing;
  end if;
  if redeem_delta>0 and exists(select 1 from public.simcoins_redemptions where order_id=r.order_id)then
   insert into public.simcoins_transactions(account_id,source_key,kind,bucket,coin_delta,order_id,plan_id,unit_index,refund_id)values(ss.account_id,'refund:redeem:'||k,'REFUND_REDEEM','available',redeem_delta,r.order_id,u.plan_id,u.unit_index,r.id)on conflict(source_key)do nothing;
  end if;
 end loop;
end;$$;
create function public.simcoins_refund_trigger()returns trigger language plpgsql security definer set search_path='' as $$begin if new.state='succeeded'then perform public.simcoins_refund_order(new.id);end if;return new;end;$$;
create trigger simcoins_refund_transition after update of state on public.refund_requests for each row execute function public.simcoins_refund_trigger();

create function public.simcoins_admin_adjust(p_actor uuid,p_user uuid,p_coins bigint,p_reason text,p_request uuid)returns jsonb language plpgsql security definer set search_path='' as $$
declare a uuid;before_w jsonb;existing public.simcoins_audit_logs;
begin
 if not exists(select 1 from public.admin_memberships where user_id=p_actor)then raise exception 'admin_required';end if;
 if not exists(select 1 from public.simcoins_program_settings where id and admin_enabled)then raise exception 'simcoins_admin_disabled';end if;
 if p_request is null or p_reason is null or length(btrim(p_reason))not between 10 and 1000 or p_coins is null or p_coins=0 or abs(p_coins)>99999999 then raise exception 'simcoins_invalid_adjustment';end if;
 a:=public.simcoins_account(p_user);perform 1 from public.simcoins_accounts where id=a for update;
 select * into existing from public.simcoins_audit_logs where request_id=p_request;
 if found then if existing.actor<>p_actor or existing.target_user is distinct from p_user or existing.action<>'adjust'or(existing.after_value->>'delta')::bigint is distinct from p_coins or existing.reason<>btrim(p_reason)then raise exception 'simcoins_request_conflict';end if;return public.simcoins_wallet(p_user);end if;
 before_w:=public.simcoins_wallet(p_user);
 insert into public.simcoins_transactions(account_id,source_key,kind,bucket,coin_delta)values(a,'adjust:'||p_request,'ADJUST','available',p_coins);
 insert into public.simcoins_audit_logs(request_id,actor,action,reason,target_user,before_value,after_value)values(p_request,p_actor,'adjust',btrim(p_reason),p_user,before_w,jsonb_build_object('delta',p_coins,'wallet',public.simcoins_wallet(p_user)));
 return public.simcoins_wallet(p_user);
end;$$;

create function public.simcoins_admin_snapshot(p_actor uuid)returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.admin_memberships where user_id=p_actor)then raise exception 'admin_required';end if;
 return jsonb_build_object('settings',(select to_jsonb(s)from public.simcoins_program_settings s where id),
 'levels',(select jsonb_agg(to_jsonb(l)order by threshold_cents)from public.simcoins_levels l),
 'products',(select coalesce(jsonb_agg(to_jsonb(e)),'[]')from public.simcoins_product_eligibility e),
 'audit',(select coalesce(jsonb_agg(x),'[]')from(select request_id,actor,action,reason,target_user,created_at,before_value,after_value from public.simcoins_audit_logs order by id desc limit 100)x),
 'accounts',(select coalesce(jsonb_agg(x),'[]')from(select a.user_id,a.created_at,coalesce(sum(t.coin_delta)filter(where t.bucket='available'),0)as available_coins,coalesce(sum(t.coin_delta)filter(where t.bucket='pending'),0)as pending_coins,coalesce(sum(t.coin_delta)filter(where t.bucket='reserved'),0)as reserved_coins,coalesce(sum(t.spend_delta_cents),0)as eligible_spend_cents from public.simcoins_accounts a left join public.simcoins_transactions t on t.account_id=a.id group by a.id order by a.created_at desc limit 100)x),
 'transactions',(select coalesce(jsonb_agg(x),'[]')from(select t.id,a.user_id,t.kind,t.bucket,t.coin_delta,t.spend_delta_cents,t.order_id,t.refund_id,t.created_at from public.simcoins_transactions t join public.simcoins_accounts a on a.id=t.account_id order by t.id desc limit 200)x),
 'aggregate',(select jsonb_build_object('accounts',(select count(*)from public.simcoins_accounts),'availableCoins',coalesce(sum(coin_delta)filter(where bucket='available'),0),'pendingCoins',coalesce(sum(coin_delta)filter(where bucket='pending'),0),'reservedCoins',coalesce(sum(coin_delta)filter(where bucket='reserved'),0),'eligibleSpendCents',coalesce(sum(spend_delta_cents),0),'earnedCoins',coalesce(sum(coin_delta)filter(where kind='EARN'),0),'refundedEarnCoins',-coalesce(sum(coin_delta)filter(where kind='REFUND_EARN'),0),'redeemedCoins',(select coalesce(sum(coins),0)from public.simcoins_redemptions),'debtCoins',(select coalesce(sum(greatest(-balance,0)),0)from(select sum(coin_delta)as balance from public.simcoins_transactions where bucket='available'group by account_id)d))from public.simcoins_transactions),
 'errors',(select coalesce(jsonb_agg(x),'[]')from(select r.order_id,'unresolved_reservation'::text as code,r.created_at from public.simcoins_checkout_reservations r join public.checkout_orders o on o.id=r.order_id where r.state='reserved'and r.created_at<now()-interval '1 day'and o.status<>'paid'order by r.created_at limit 100)x));
end;$$;
create function public.simcoins_admin_configure(p_actor uuid,p_action text,p_value jsonb,p_reason text,p_request uuid)returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.simcoins_program_settings;a public.simcoins_audit_logs;before_v jsonb;after_v jsonb;pid text;cfg public.simcoins_program_settings;
begin
 if not exists(select 1 from public.admin_memberships where user_id=p_actor)then raise exception 'admin_required';end if;
 select * into s from public.simcoins_program_settings where id for update;
 if not s.admin_enabled then raise exception 'simcoins_admin_disabled';end if;
 if p_request is null or p_reason is null or length(btrim(p_reason))not between 10 and 1000 or p_value is null or jsonb_typeof(p_value)<>'object'or p_action not in ('settings','level','product')then raise exception 'simcoins_invalid_configuration';end if;
 select * into a from public.simcoins_audit_logs where request_id=p_request;
 if found then
  if a.actor<>p_actor or a.action<>p_action or a.reason<>btrim(p_reason)or a.after_value->'input' is distinct from p_value then raise exception 'simcoins_request_conflict';end if;
  return a.after_value->'result';
 end if;
 if p_action='settings'then
  if p_value='{}'::jsonb or p_value-array['enabled','earn_enabled','redeem_enabled','admin_enabled','public_enabled','release_delay_seconds','costs_max_age_seconds','coins_per_usd','max_redeem_bps','min_contribution_bps','stripe_bps','stripe_fx_bps','fixed_fee_units','affiliate_bps','max_promotion_bps','other_variable_units']<>'{}'::jsonb then raise exception 'simcoins_invalid_configuration';end if;
  before_v:=to_jsonb(s);
  update public.simcoins_program_settings set enabled=coalesce((p_value->>'enabled')::boolean,enabled),earn_enabled=coalesce((p_value->>'earn_enabled')::boolean,earn_enabled),redeem_enabled=coalesce((p_value->>'redeem_enabled')::boolean,redeem_enabled),admin_enabled=coalesce((p_value->>'admin_enabled')::boolean,admin_enabled),public_enabled=coalesce((p_value->>'public_enabled')::boolean,public_enabled),release_delay_seconds=coalesce((p_value->>'release_delay_seconds')::integer,release_delay_seconds),costs_max_age_seconds=coalesce((p_value->>'costs_max_age_seconds')::integer,costs_max_age_seconds),policy_version=policy_version+1,updated_at=now()where id returning to_jsonb(simcoins_program_settings.*)into after_v;
  cfg:=jsonb_populate_record(s,p_value);
  update public.simcoins_program_settings set coins_per_usd=cfg.coins_per_usd,max_redeem_bps=cfg.max_redeem_bps,min_contribution_bps=cfg.min_contribution_bps,stripe_bps=cfg.stripe_bps,stripe_fx_bps=cfg.stripe_fx_bps,fixed_fee_units=cfg.fixed_fee_units,affiliate_bps=cfg.affiliate_bps,max_promotion_bps=cfg.max_promotion_bps,other_variable_units=cfg.other_variable_units where id returning to_jsonb(simcoins_program_settings.*)into after_v;
 elsif p_action='level'then
  if p_value-array['id','name','rate_bps','threshold_cents']<>'{}'::jsonb or not(p_value?'id')then raise exception 'simcoins_invalid_configuration';end if;
  select to_jsonb(l)into before_v from public.simcoins_levels l where id=p_value->>'id';if not found then raise exception 'simcoins_invalid_configuration';end if;
  update public.simcoins_levels set name=coalesce(p_value->>'name',name),rate_bps=coalesce((p_value->>'rate_bps')::integer,rate_bps),threshold_cents=coalesce((p_value->>'threshold_cents')::bigint,threshold_cents)where id=p_value->>'id'returning to_jsonb(simcoins_levels.*)into after_v;
  if exists(select 1 from public.simcoins_levels where id='traveler'and(rate_bps<>0 or threshold_cents<>0))or exists(select 1 from public.simcoins_levels where id='explorer'and threshold_cents<>1)or exists(select 1 from public.simcoins_levels a join public.simcoins_levels b on a.threshold_cents<b.threshold_cents where a.rate_bps>b.rate_bps)then raise exception 'simcoins_invalid_configuration';end if;
  update public.simcoins_program_settings set policy_version=policy_version+1,updated_at=now()where id;
 else
  if p_value-array['plan_id','earn_enabled','redeem_enabled']<>'{}'::jsonb or not(p_value?'plan_id')then raise exception 'simcoins_invalid_configuration';end if;
  pid:=p_value->>'plan_id';select to_jsonb(e)into before_v from public.simcoins_product_eligibility e where plan_id=pid;
  insert into public.simcoins_product_eligibility(plan_id,earn_enabled,redeem_enabled)values(pid,coalesce((p_value->>'earn_enabled')::boolean,false),coalesce((p_value->>'redeem_enabled')::boolean,false))on conflict(plan_id)do update set earn_enabled=coalesce((p_value->>'earn_enabled')::boolean,simcoins_product_eligibility.earn_enabled),redeem_enabled=coalesce((p_value->>'redeem_enabled')::boolean,simcoins_product_eligibility.redeem_enabled),updated_at=now()returning to_jsonb(simcoins_product_eligibility.*)into after_v;
  update public.simcoins_program_settings set policy_version=policy_version+1,updated_at=now()where id;
 end if;
 insert into public.simcoins_audit_logs(request_id,actor,action,reason,before_value,after_value)values(p_request,p_actor,p_action,btrim(p_reason),before_v,jsonb_build_object('input',p_value,'result',after_v));
 return after_v;
end;$$;

-- RLS plus narrow grants: clients cannot access supplier costs, quotes or mutate money/configuration.
do $$declare t text;begin
 foreach t in array array['simcoins_program_settings','simcoins_levels','simcoins_accounts','simcoins_private_costs','simcoins_cost_refresh','simcoins_product_eligibility','simcoins_quotes','simcoins_order_snapshots','simcoins_unit_snapshots','simcoins_checkout_reservations','simcoins_redemptions','simcoins_transactions','simcoins_audit_logs']loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant select,insert,update,delete on public.%I to service_role',t);
 end loop;
end;$$;
grant usage,select on sequence public.simcoins_transactions_id_seq,public.simcoins_audit_logs_id_seq to service_role;
-- Safe customer projections are supplied by the authenticated server through simcoins_wallet.
-- No browser EXECUTE privileges, including security-definer helpers.
do $$declare f record;begin
 for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'and p.proname like 'simcoins_%'loop
  execute format('revoke all on function %s from public,anon,authenticated',f.signature);
  execute format('grant execute on function %s to service_role',f.signature);
 end loop;
end;$$;
commit;
