-- Additive coupon infrastructure. Does not enroll or reprice historical orders.
begin;
create table public.coupon_definitions (
 id uuid primary key default gen_random_uuid(), code text not null unique check(code ~ '^[A-Z0-9][A-Z0-9_-]{2,39}$'),
 name text not null check(length(btrim(name)) between 1 and 100), kind text not null check(kind in ('percent','fixed')),
 value integer not null check(value>0 and value<=99999999), starts_at timestamptz, ends_at timestamptz,
 max_uses integer check(max_uses>0), max_uses_per_customer integer check(max_uses_per_customer>0),
 minimum_cents integer not null default 0 check(minimum_cents between 0 and 99999999),
 active boolean not null default true, archived boolean not null default false,
 version integer not null default 1 check(version>0), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(kind<>'percent' or value<=10000),check(starts_at is null or ends_at is null or ends_at>starts_at),check(not archived or not active)
);
create table public.coupon_quotes (
 id uuid primary key default gen_random_uuid(), coupon_id uuid not null references public.coupon_definitions,
 coupon_version integer not null, identity_hash text not null check(identity_hash ~ '^[a-f0-9]{64}$'),user_id uuid references auth.users,
 currency text not null check(public.fx_currency(currency)),fx_quote_id uuid references public.fx_snapshots,
 cart jsonb not null,snapshot jsonb not null,created_at timestamptz not null default now(),expires_at timestamptz not null default now()+interval '10 minutes'
);
create table public.coupon_order_snapshots (
 order_id uuid primary key references public.checkout_orders,quote_id uuid not null unique references public.coupon_quotes,
 coupon_id uuid not null references public.coupon_definitions,coupon_version integer not null,code text not null,
 identity_hash text not null check(identity_hash ~ '^[a-f0-9]{64}$'),snapshot jsonb not null,created_at timestamptz not null default now()
);
create table public.coupon_usage_reservations (
 order_id uuid primary key references public.coupon_order_snapshots,coupon_id uuid not null references public.coupon_definitions,
 identity_hash text not null check(identity_hash ~ '^[a-f0-9]{64}$'),user_id uuid references auth.users,state text not null default 'reserved' check(state in ('reserved','redeemed','released')),
 discount_usd_cents integer not null check(discount_usd_cents>0),created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create index coupon_usage_limits_idx on public.coupon_usage_reservations(coupon_id,identity_hash,state);
create table public.coupon_rate_limits (bucket_key text primary key check(bucket_key~'^[a-f0-9]{64}$'),window_start timestamptz not null default now(),attempts integer not null default 0 check(attempts>=0));
create table public.coupon_audit_logs (
 id bigint generated always as identity primary key,request_id uuid unique,actor uuid references auth.users,action text not null,
 coupon_id uuid not null references public.coupon_definitions,order_id uuid references public.checkout_orders,
 input jsonb,before_value jsonb,after_value jsonb,created_at timestamptz not null default now()
);

-- All calls run only through the trusted server. The buyer hash is a server HMAC,
-- computed from the persisted billing email when attaching a quote to an order.
create function public.coupon_assert_available(p_coupon uuid,p_identity text,p_user uuid) returns void language plpgsql security definer set search_path='' as $$
declare c public.coupon_definitions;n bigint;customer_n bigint;
begin
 select * into c from public.coupon_definitions where id=p_coupon;
 if not found or not c.active or c.archived or c.starts_at>now() or c.ends_at<=now() then raise exception 'coupon_unavailable';end if;
 select count(*),count(*)filter(where identity_hash=p_identity or(p_user is not null and user_id=p_user)) into n,customer_n from public.coupon_usage_reservations where coupon_id=c.id and state in ('reserved','redeemed');
 if n>=c.max_uses or customer_n>=c.max_uses_per_customer then raise exception 'coupon_limit_reached';end if;
end;$$;

create function public.coupon_financial_snapshot(p_coupon uuid,p_lines jsonb,p_currency text,p_fx_quote uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.coupon_definitions;s public.simcoins_program_settings;p public.catalog_plans;cost public.simcoins_private_costs;
 l jsonb;lines jsonb:='[]';gross bigint:=0;net bigint:=0;payment bigint:=0;gross_payment bigint:=0;costs numeric:=0;cash numeric:=0;fee_basis numeric:=0;
 target_discount numeric;g integer;n integer;qty integer;paid integer;rate text;minor integer;units integer:=0;fees numeric;
begin
 select * into c from public.coupon_definitions where id=p_coupon;
 select * into s from public.simcoins_program_settings where id;
 if not found or s.min_contribution_bps<2000 or s.stripe_bps<440 or s.stripe_fx_bps<540 or s.affiliate_bps<800 or s.fixed_fee_units<3000 then raise exception 'coupon_policy_unavailable';end if;
 if p_currency is null or not public.fx_currency(p_currency) then raise exception 'invalid_currency';end if;
 if p_currency='USD' then if p_fx_quote is not null then raise exception 'invalid_quote';end if;rate:='10000000000';
 else select rates->>p_currency into rate from public.fx_snapshots where id=p_fx_quote and expires_at>now() for share;if not found or rate is null then raise exception 'quote_expired';end if;end if;
 minor:=case when p_currency in ('JPY','KRW','CLP') then 1 else 100 end;
 if p_lines is null or jsonb_typeof(p_lines)<>'array' or jsonb_array_length(p_lines)not between 1 and 20 then raise exception 'invalid_cart';end if;
 if exists(select 1 from jsonb_array_elements(p_lines)x where jsonb_typeof(x)<>'object' or x-array['destination','planId','quantity']<>'{}'::jsonb or not(x?&array['destination','planId','quantity'])or jsonb_typeof(x->'quantity')is distinct from 'number' or (x->>'quantity')!~'^[0-9]+$'or (x->>'quantity')::numeric not between 1 and 10)
 or(select count(distinct x->>'planId')from jsonb_array_elements(p_lines)x)<>jsonb_array_length(p_lines) then raise exception 'invalid_cart';end if;
 for l in select * from jsonb_array_elements(p_lines) loop
  select * into p from public.catalog_plans where id=l->>'planId' and destination_slug=l->>'destination' and is_published and kind='fixed' for share;
  if not found or p.retail_price_cents is null or not exists(select 1 from public.catalog_destinations where slug=p.destination_slug and is_published)then raise exception 'coupon_unavailable_plan';end if;
  gross:=gross+p.retail_price_cents::bigint*(l->>'quantity')::integer;
 end loop;
 if gross<c.minimum_cents or gross not between 1 and 99999999 then raise exception 'coupon_minimum';end if;
 target_discount:=case when c.kind='percent' then floor(gross::numeric*c.value/10000) else least(c.value,gross) end;
 for l in select * from jsonb_array_elements(p_lines) order by value->>'planId' loop
  select * into p from public.catalog_plans where id=l->>'planId';g:=p.retail_price_cents;qty:=(l->>'quantity')::integer;
  -- Equal Stripe unit prices: round each unit's discount down, never over-discount.
  n:=g-floor(target_discount*g/gross)::integer;
  if n<=0 then raise exception 'coupon_insufficient_margin';end if;
  select * into cost from public.simcoins_private_costs where plan_id=p.id for share;
  if not found or cost.observed_at<now()-make_interval(secs=>s.costs_max_age_seconds) then raise exception 'coupon_cost_unavailable';end if;
  paid:=public.fx_convert_minor(n,p_currency,rate);if paid<=0 then raise exception 'coupon_insufficient_margin';end if;
  cash:=cash+least(n::numeric*100,floor(paid::numeric*10000*10000000000/(rate::numeric*minor)))*qty;
  fee_basis:=fee_basis+greatest(n::numeric*100,ceil(paid::numeric*10000*10000000000/(rate::numeric*minor)))*qty;
  costs:=costs+cost.wholesale_unit_units::numeric*qty;units:=units+qty;
  net:=net+n::bigint*qty;payment:=payment+paid::bigint*qty;gross_payment:=gross_payment+public.fx_convert_minor(g,p_currency,rate)::bigint*qty;
  lines:=lines||jsonb_build_array(jsonb_build_object('planId',p.id,'destination',p.destination_slug,'quantity',qty,'grossUnitCents',g,'netUnitCents',n,'paymentUnitAmount',paid,'wholesaleUnitUnits',cost.wholesale_unit_units));
 end loop;
 fees:=ceil(fee_basis*(case when p_currency='USD'then s.stripe_bps else s.stripe_fx_bps end)/10000)+ceil(fee_basis*s.affiliate_bps/10000)+s.fixed_fee_units+s.other_variable_units::numeric*units;
 if payment not between 1 and 99999999 or gross-net<=0 or gross_payment<=payment or(cash-costs-fees)*10000<cash*s.min_contribution_bps then raise exception 'coupon_insufficient_margin';end if;
 return jsonb_build_object('lines',lines,'currency',p_currency,'fxRate',rate,'grossCents',gross,'netCents',net,'paymentTotal',payment,'discountTotal',gross_payment-payment,'discountUsdCents',gross-net,'costUnits',costs,'feeUnits',fees,'cashUnits',cash,'policyVersion',s.policy_version);
end;$$;

create function public.coupon_create_quote(p_code text,p_identity text,p_user uuid,p_lines jsonb,p_currency text,p_fx_quote uuid,p_rate_key text) returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.coupon_definitions;q public.coupon_quotes;snapshot jsonb;cart jsonb;attempts integer;
begin
 if p_identity is null or p_identity!~'^[a-f0-9]{64}$'or p_rate_key is null or p_rate_key!~'^[a-f0-9]{64}$' then raise exception 'coupon_identity';end if;
 insert into public.coupon_rate_limits(bucket_key,attempts)values(p_rate_key,1)on conflict(bucket_key)do update set attempts=case when coupon_rate_limits.window_start<=now()-interval '10 minutes'then 1 else coupon_rate_limits.attempts+1 end,window_start=case when coupon_rate_limits.window_start<=now()-interval '10 minutes'then now()else coupon_rate_limits.window_start end returning coupon_rate_limits.attempts into attempts;
 if attempts>20 then return jsonb_build_object('error','rate_limit');end if;
 perform pg_advisory_xact_lock(hashtextextended(p_identity,8872));
 if(select count(*)from public.coupon_quotes where identity_hash=p_identity and created_at>now()-interval '1 hour')>=60 then return jsonb_build_object('error','rate_limit');end if;
 -- Expected rejection returns NULL so the outer attempt counter commits even
 -- for guessed codes, unavailable stock, exhausted caps or margin failures.
 begin
 select * into c from public.coupon_definitions where code=upper(btrim(p_code)) for share;
 perform public.coupon_assert_available(c.id,p_identity,p_user);
 snapshot:=public.coupon_financial_snapshot(c.id,p_lines,p_currency,p_fx_quote);
 select jsonb_agg(x order by x->>'planId')into cart from jsonb_array_elements(p_lines)x;
 insert into public.coupon_quotes(coupon_id,coupon_version,identity_hash,user_id,currency,fx_quote_id,cart,snapshot)values(c.id,c.version,p_identity,p_user,p_currency,p_fx_quote,cart,snapshot)returning * into q;
 return jsonb_build_object('id',q.id,'code',c.code,'currency',q.currency,'paymentTotal',snapshot->'paymentTotal','discountTotal',snapshot->'discountTotal','discountUsdCents',snapshot->'discountUsdCents','expiresAt',q.expires_at);
 exception when raise_exception or check_violation or invalid_text_representation or numeric_value_out_of_range then
  return jsonb_build_object('error',case SQLERRM when 'coupon_cost_unavailable'then 'coupon_cost_unavailable' when 'coupon_insufficient_margin'then 'coupon_margin' when 'coupon_limit_reached'then 'coupon_limit' when 'quote_expired'then 'coupon_expired' else 'invalid_coupon'end);
 end;
end;$$;

create function public.coupon_prepare_payment(p_order uuid,p_identity text,p_quote uuid,p_currency text,p_fx_quote uuid,p_expected integer)returns jsonb language plpgsql security definer set search_path='' as $$
declare o public.checkout_orders;q public.coupon_quotes;c public.coupon_definitions;ss public.coupon_order_snapshots;s jsonb;cart jsonb;
begin
 select * into o from public.checkout_orders where id=p_order for update;
 if not found then raise exception 'pending_order_required';end if;
 select * into ss from public.coupon_order_snapshots where order_id=o.id;
 if found then
  if ss.quote_id is distinct from p_quote or ss.identity_hash is distinct from p_identity or o.payment_currency is distinct from p_currency or o.fx_snapshot_id is distinct from p_fx_quote or o.payment_total is distinct from p_expected then raise exception 'coupon_attempt_conflict';end if;
  return to_jsonb(o);
 end if;
 if o.status<>'pending' or o.payment_currency is not null or o.stripe_session_id is not null or exists(select 1 from public.simcoins_order_snapshots where order_id=o.id)then raise exception 'coupon_order_ineligible';end if;
 select * into q from public.coupon_quotes where id=p_quote and expires_at>now();
 if not found then raise exception 'coupon_quote_expired';end if;
 if q.identity_hash is distinct from p_identity or q.user_id is distinct from o.user_id or q.currency is distinct from p_currency or q.fx_quote_id is distinct from p_fx_quote then raise exception 'coupon_identity';end if;
 -- All cap decisions serialize on this coupon, after the order lock.
 select * into c from public.coupon_definitions where id=q.coupon_id for update;
 perform public.coupon_assert_available(c.id,p_identity,o.user_id);
 if c.version<>q.coupon_version then raise exception 'coupon_quote_changed';end if;
 perform 1 from public.checkout_order_items where order_id=o.id for update;
 select jsonb_agg(jsonb_build_object('destination',destination_slug,'planId',plan_id,'quantity',quantity)order by plan_id)into cart from public.checkout_order_items where order_id=o.id;
 if cart is distinct from q.cart then raise exception 'coupon_cart_changed';end if;
 s:=public.coupon_financial_snapshot(c.id,cart,p_currency,p_fx_quote);
 if s->'lines' is distinct from q.snapshot->'lines' or(s->>'paymentTotal')::integer is distinct from p_expected or o.amount_total is distinct from(s->>'grossCents')::integer
 or exists(select 1 from public.checkout_order_items i join jsonb_array_elements(s->'lines')l on l->>'planId'=i.plan_id where i.order_id=o.id and i.unit_amount<>(l->>'grossUnitCents')::integer)then raise exception 'price_changed';end if;
 insert into public.coupon_order_snapshots(order_id,quote_id,coupon_id,coupon_version,code,identity_hash,snapshot)values(o.id,q.id,c.id,c.version,c.code,p_identity,s);
 insert into public.coupon_usage_reservations(order_id,coupon_id,identity_hash,user_id,discount_usd_cents)values(o.id,c.id,p_identity,o.user_id,(s->>'discountUsdCents')::integer);
 insert into public.coupon_audit_logs(action,coupon_id,order_id,after_value)values('reserved',c.id,o.id,jsonb_build_object('state','reserved','discountUsdCents',s->'discountUsdCents'));
 update public.checkout_order_items i set payment_unit_amount=(l->>'paymentUnitAmount')::integer from jsonb_array_elements(s->'lines')l where i.order_id=o.id and i.plan_id=l->>'planId';
 update public.checkout_orders set payment_currency=p_currency,payment_total=p_expected,fx_snapshot_id=p_fx_quote where id=o.id returning * into o;
 return to_jsonb(o);
end;$$;

create function public.coupon_order_transition()returns trigger language plpgsql security definer set search_path='' as $$
declare r public.coupon_usage_reservations;next_state text;
begin
 select * into r from public.coupon_usage_reservations where order_id=new.id;
 if not found then return new;end if;
 perform 1 from public.coupon_definitions where id=r.coupon_id for update;
 next_state:=case when new.status='paid' then 'redeemed' when new.status in ('failed','cancelled','expired')and not new.payment_in_progress and r.state='reserved' then 'released' else r.state end;
 -- A late authoritative paid event always remains visible as redeemed, including
 -- after a terminal release. Never silently discard a real payment's usage.
 if next_state<>r.state then
  update public.coupon_usage_reservations set state=next_state,updated_at=now()where order_id=new.id;
  insert into public.coupon_audit_logs(action,coupon_id,order_id,before_value,after_value)values(next_state,r.coupon_id,new.id,jsonb_build_object('state',r.state),jsonb_build_object('state',next_state));
 end if;
 return new;
end;$$;
create trigger coupon_order_status after update of status,payment_in_progress on public.checkout_orders for each row execute function public.coupon_order_transition();

create function public.coupon_admin_save(p_actor uuid,p_value jsonb,p_action text,p_request uuid)returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.coupon_definitions;before_v jsonb;result jsonb;a public.coupon_audit_logs;cid uuid;
begin
 if not exists(select 1 from public.admin_memberships where user_id=p_actor)then raise exception 'admin_required';end if;
 if p_request is null or p_action is null or p_action not in ('save','archive')or p_value is null or jsonb_typeof(p_value)<>'object' or p_value-array['id','code','name','kind','value','starts_at','ends_at','max_uses','max_uses_per_customer','minimum_cents','active']<>'{}'::jsonb then raise exception 'coupon_invalid_configuration';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_request::text,8873));
 select * into a from public.coupon_audit_logs where request_id=p_request;
 if found then if a.actor is distinct from p_actor or a.action<>p_action or a.input is distinct from p_value then raise exception 'coupon_request_conflict';end if;return a.after_value;end if;
 cid:=(p_value->>'id')::uuid;
 if cid is not null then select * into c from public.coupon_definitions where id=cid for update;if not found or c.archived then raise exception 'coupon_unavailable';end if;before_v:=to_jsonb(c);
 else if p_action='archive'then raise exception 'coupon_invalid_configuration';end if;c.id:=gen_random_uuid();c.minimum_cents:=0;c.active:=true;end if;
 if p_action='archive' then update public.coupon_definitions set archived=true,active=false,version=version+1,updated_at=now()where id=c.id returning to_jsonb(coupon_definitions.*)into result;
 else
  c:=jsonb_populate_record(c,p_value);c.code:=upper(btrim(c.code));c.name:=btrim(c.name);
  if c.max_uses<(select count(*)from public.coupon_usage_reservations where coupon_id=c.id and state in ('reserved','redeemed'))or exists(select 1 from public.coupon_usage_reservations anchor where anchor.coupon_id=c.id and anchor.state in ('reserved','redeemed')and(select count(*)from public.coupon_usage_reservations uses where uses.coupon_id=c.id and uses.state in ('reserved','redeemed')and(uses.identity_hash=anchor.identity_hash or(anchor.user_id is not null and uses.user_id=anchor.user_id)))>c.max_uses_per_customer)then raise exception 'coupon_limit_below_usage';end if;
  if cid is null then insert into public.coupon_definitions(id,code,name,kind,value,starts_at,ends_at,max_uses,max_uses_per_customer,minimum_cents,active)values(c.id,c.code,c.name,c.kind,c.value,c.starts_at,c.ends_at,c.max_uses,c.max_uses_per_customer,c.minimum_cents,c.active)returning to_jsonb(coupon_definitions.*)into result;
  else
   if c.code is distinct from before_v->>'code' then raise exception 'coupon_code_immutable';end if;
   update public.coupon_definitions set name=c.name,kind=c.kind,value=c.value,starts_at=c.starts_at,ends_at=c.ends_at,max_uses=c.max_uses,max_uses_per_customer=c.max_uses_per_customer,minimum_cents=c.minimum_cents,active=c.active,version=version+1,updated_at=now()where id=c.id returning to_jsonb(coupon_definitions.*)into result;
  end if;
 end if;
 insert into public.coupon_audit_logs(request_id,actor,action,coupon_id,input,before_value,after_value)values(p_request,p_actor,p_action,c.id,p_value,before_v,result);
 return result;
end;$$;
create function public.coupon_admin_snapshot(p_actor uuid)returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.admin_memberships where user_id=p_actor)then raise exception 'admin_required';end if;
 return jsonb_build_object('coupons',(select coalesce(jsonb_agg(to_jsonb(x)order by x.created_at desc),'[]')from(select c.*,(select count(*)from public.coupon_usage_reservations r where r.coupon_id=c.id and r.state='redeemed')used,(select count(*)from public.coupon_usage_reservations r where r.coupon_id=c.id and r.state='reserved')reserved from public.coupon_definitions c order by c.created_at desc limit 500)x),
 'summary',jsonb_build_object('active',(select count(*)from public.coupon_definitions where active and not archived and(starts_at is null or starts_at<=now())and(ends_at is null or ends_at>now())),'scheduled',(select count(*)from public.coupon_definitions where active and not archived and starts_at>now()),'redeemed',(select count(*)from public.coupon_usage_reservations where state='redeemed'),'discountUsdCents',(select coalesce(sum(discount_usd_cents),0)from public.coupon_usage_reservations where state='redeemed')));
end;$$;

create function public.coupon_snapshot_immutable()returns trigger language plpgsql security definer set search_path='' as $$begin raise exception 'coupon_snapshot_immutable';end;$$;
create trigger coupon_snapshot_immutable before update or delete on public.coupon_order_snapshots for each row execute function public.coupon_snapshot_immutable();
do $$declare t text;f record;begin
 foreach t in array array['coupon_definitions','coupon_quotes','coupon_order_snapshots','coupon_usage_reservations','coupon_audit_logs','coupon_rate_limits']loop
  execute format('alter table public.%I enable row level security',t);execute format('revoke all on public.%I from public,anon,authenticated',t);execute format('grant select,insert,update on public.%I to service_role',t);
 end loop;
 for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'and p.proname like 'coupon_%'loop
  execute format('revoke all on function %s from public,anon,authenticated',f.signature);execute format('grant execute on function %s to service_role',f.signature);
 end loop;
end;$$;
grant usage,select on sequence public.coupon_audit_logs_id_seq to service_role;
commit;
