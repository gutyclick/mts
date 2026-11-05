begin;
-- All cents are USD; cost units are 1/10000 USD. No default prices or taxes.
-- Contract: service_role RPC b2b_commerce_admin(actor,action,payload) -> uuid (settings returns null).
-- save_settings accepts only snake_case setting columns; save_tariff upserts nullable scope.
-- publish_quote {request_id,version,unit_cents?,tax_cents?,valid_hours?}; one immutable quote/request.
-- confirm_transfer {order_id,amount_cents,reference}; release {order_id} allocates stable slots only.
-- b2b_commerce_payment(action,payload) -> attempt JSON (transfer_notice -> acknowledgement).
-- begin {actor,id,order_id,method,expected_amount_cents,livemode,provider_ref,locale?};
-- bind {id,provider_ref,session_id}; settle {id,provider_ref,amount_cents,currency:'USD',livemode,status,event_id?};
-- refund {id,provider_ref,amount_cents,livemode,event_id?} blocks release and future claims.
-- Only verified server callbacks may call settle/refund; cancelling in browser is never settlement.
-- b2b_commerce_workspace(trip) is authenticated and returns a deliberately safe tenant projection.
-- claim_b2b_units(limit) -> JSON array with 5-minute fenced leases; update_b2b_unit(id,lease,patch) -> boolean.
-- No function performs a provider call. Disabled issuance is the default.
create table public.b2b_commerce_settings (
 id boolean primary key default true check(id), stripe_enabled boolean not null default false,
 bank_enabled boolean not null default false,yappy_enabled boolean not null default false,
 yappy_fee_bps integer check(yappy_fee_bps between 0 and 7999),yappy_fixed_cents integer not null default 0 check(yappy_fixed_cents between 0 and 99999999),other_reserve_cents integer not null default 0 check(other_reserve_cents between 0 and 99999999),issuance_enabled boolean not null default false,
 bank_instructions text not null default '' check(length(bank_instructions)<=2000),updated_at timestamptz not null default now()
);
insert into public.b2b_commerce_settings(id) values(true);
create table public.b2b_tariffs (
 id uuid primary key default gen_random_uuid(),plan_id text references public.catalog_plans(id),company_id uuid references public.b2b_organizations(id),
 unit_cents integer not null check(unit_cents between 100 and 99999900 and unit_cents%100=0),active boolean not null default true,updated_at timestamptz not null default now()
);
create unique index b2b_tariff_scope on public.b2b_tariffs(coalesce(plan_id,''),coalesce(company_id,'00000000-0000-0000-0000-000000000000'::uuid));
create table public.b2b_orders (
 id uuid primary key default gen_random_uuid(),request_id uuid not null references public.b2b_order_requests(id),request_version integer not null,
 company_id uuid not null references public.b2b_organizations(id),trip_id uuid not null references public.b2b_trips(id),
 plan_id text not null references public.catalog_plans(id),plan_name text not null,provider_slug text not null,package_code text not null,volume_bytes bigint not null,days integer not null,quantity integer not null check(quantity between 1 and 1000),
 unit_cents integer not null check(unit_cents>0 and unit_cents%100=0),total_cents bigint not null check(total_cents between 1 and 99999999),
 subtotal_cents bigint generated always as (unit_cents::bigint*quantity) stored,tax_cents bigint not null default 0 check(tax_cents between 0 and 99999999),currency text not null default 'USD' check(currency='USD'),tariff_id uuid references public.b2b_tariffs(id),
 wholesale_unit_units bigint not null,cost_observed_at timestamptz not null,worst_fee_bps integer not null,worst_fee_fixed_cents integer not null,
 state text not null default 'awaiting_payment' check(state in ('awaiting_payment','awaiting_release','provisioning','ready','review','expired')),
 payment_method text check(payment_method in ('stripe','transfer','yappy')),paid_reference text,paid_at timestamptz,released_at timestamptz,quote_expires_at timestamptz not null default(now()+interval '7 days'),created_at timestamptz not null default now(),
 check(total_cents=unit_cents::bigint*quantity+tax_cents)
);
create unique index b2b_active_order_request on public.b2b_orders(request_id) where state<>'expired';
create unique index b2b_active_order_trip on public.b2b_orders(trip_id) where state<>'expired';
create table public.b2b_payment_attempts (
 id uuid primary key,order_id uuid not null references public.b2b_orders(id),method text not null check(method in ('stripe','yappy')),
 expected_amount_cents bigint not null check(expected_amount_cents>0),provider_ref text not null unique check(length(btrim(provider_ref)) between 1 and 200),
 status text not null default 'creating' check(status in ('creating','pending','succeeded','failed','cancelled')),livemode boolean not null,locale text not null default 'es' check(locale in ('es','en')),session_id text unique,created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create unique index b2b_payment_pending on public.b2b_payment_attempts(order_id) where status in ('creating','pending','succeeded');
create table public.b2b_payment_events (event_id text primary key check(length(event_id) between 1 and 300),attempt_id uuid not null references public.b2b_payment_attempts(id),action text not null,payload jsonb not null,created_at timestamptz not null default now());
create table public.b2b_units (
 id uuid primary key default gen_random_uuid(),order_id uuid not null references public.b2b_orders(id),slot integer not null check(slot between 1 and 1000),
 state text not null default 'queued' check(state in ('queued','provider_pending','ready','review')),attempts integer not null default 0,provider_transaction_id text not null unique,provider_order_no text,provider_slug text not null,package_code text not null,volume_bytes bigint not null,days integer not null,lease_token uuid,lease_until timestamptz,iccid text unique,smdp_address text,activation_code text,provider_profile_id text unique,apn text,last_error text,next_attempt_at timestamptz,created_at timestamptz not null default now(),unique(order_id,slot)
);
-- RPC-only access deliberately avoids exposing private costs or future fulfillment secrets.
do $$declare t text;begin foreach t in array array['b2b_commerce_settings','b2b_tariffs','b2b_orders','b2b_payment_attempts','b2b_payment_events','b2b_units'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);
 execute format('grant select on public.%I to service_role',t);
end loop;end$$;
create function public.b2b_commerce_immutable() returns trigger language plpgsql set search_path='' as $$begin
 if tg_op='DELETE' or (to_jsonb(new)-array['state','payment_method','paid_reference','paid_at','released_at','subtotal_cents']) is distinct from (to_jsonb(old)-array['state','payment_method','paid_reference','paid_at','released_at','subtotal_cents']) then raise exception 'immutable_quote';end if;
 if new.state='review' then return new;end if;
 if old.state='awaiting_payment' and new.state='expired' and old.quote_expires_at<=now() then return new;end if;
 if old.state in ('ready','review') or (old.state='provisioning' and new.state<>'ready') or (old.state='awaiting_release' and new.state<>'provisioning') or (old.state='awaiting_payment' and new.state<>'awaiting_release') then raise exception 'invalid_state';end if;
 return new;end;$$;
create trigger b2b_order_immutable before update or delete on public.b2b_orders for each row execute function public.b2b_commerce_immutable();
-- Shared live pre-payment validation. Published commercial amounts remain immutable.
create function public.b2b_commerce_validate(p_order uuid) returns void language plpgsql security definer set search_path='' as $$
declare o public.b2b_orders;c public.simcoins_private_costs;begin
 select * into o from public.b2b_orders where id=p_order;
 if o.id is null then raise exception 'order_required';end if;
 perform 1 from public.b2b_organizations where id=o.company_id and status='active' for share;if not found then raise exception 'company_required';end if;
 perform 1 from public.provider_package_bindings b join public.catalog_plans p on p.id=b.plan_id join public.catalog_destinations d on d.slug=p.destination_slug join public.catalog_available_plan_ids a on a.id=p.id left join public.catalog_plan_merchandising m on m.plan_id=p.id left join public.catalog_destination_merchandising dm on dm.destination_slug=d.slug
 where b.plan_id=o.plan_id and b.is_available and p.is_published and d.is_published and p.kind='fixed' and coalesce(m.visibility,'auto')<>'hide' and not coalesce(m.incident_block,false)
 and (case when lower(p.id)~'_(premium|iij|usip|nonhkip|myip)$' then regexp_replace(lower(p.id),'.*_(premium|iij|usip|nonhkip|myip)$','\1') else 'standard' end)=any(coalesce(dm.approved_modalities,array['standard']))
 and b.provider_slug=o.provider_slug and b.package_code=o.package_code and b.volume_bytes=o.volume_bytes and b.days=o.days for share of b,p,d;
 if not found then raise exception 'plan_unavailable';end if;
 select * into c from public.simcoins_private_costs where plan_id=o.plan_id for share;
 if c.plan_id is null or c.observed_at<now()-interval '15 minutes' or c.observed_at>now() then raise exception 'fresh_cost_required';end if;
 if (o.subtotal_cents::numeric*100-c.wholesale_unit_units::numeric*o.quantity-ceil(o.total_cents::numeric*100*o.worst_fee_bps/10000)-o.worst_fee_fixed_cents::numeric*100)*10000<o.subtotal_cents::numeric*100*2000 then raise exception 'insufficient_margin';end if;
end;$$;
create function public.b2b_commerce_admin(p_actor uuid,p_action text,p_value jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare s public.b2b_commerce_settings;r public.b2b_order_requests;o public.b2b_orders;t public.b2b_tariffs;c public.simcoins_private_costs;v_id uuid;v_before jsonb;v_company uuid;v_bps integer;v_fixed integer;v_price integer;v_tax bigint;v_binding public.provider_package_bindings;
begin
 if not exists(select 1 from public.admin_memberships where user_id=p_actor) then raise exception 'admin_required';end if;
 if jsonb_typeof(p_value) is distinct from 'object' then raise exception 'invalid_payload';end if;
 if p_action='save_settings' then
  select * into s from public.b2b_commerce_settings where id for update;v_before:=to_jsonb(s);
  if p_value-array['stripe_enabled','bank_enabled','yappy_enabled','yappy_fee_bps','yappy_fixed_cents','other_reserve_cents','issuance_enabled','bank_instructions']<>'{}'::jsonb then raise exception 'invalid_payload';end if;
  select * into s from jsonb_populate_record(s,p_value);
  if s.yappy_enabled and (s.yappy_fee_bps is null or s.yappy_fixed_cents is null) then raise exception 'fee_configuration_required';end if;
  if s.bank_enabled and length(btrim(s.bank_instructions))<1 then raise exception 'bank_instructions_required';end if;
  update public.b2b_commerce_settings set stripe_enabled=s.stripe_enabled,bank_enabled=s.bank_enabled,yappy_enabled=s.yappy_enabled,yappy_fee_bps=s.yappy_fee_bps,yappy_fixed_cents=s.yappy_fixed_cents,other_reserve_cents=s.other_reserve_cents,issuance_enabled=s.issuance_enabled,bank_instructions=s.bank_instructions,updated_at=now() where id;
 elsif p_action='save_tariff' then
  select id into v_id from public.b2b_tariffs where plan_id is not distinct from p_value->>'plan_id' and company_id is not distinct from (p_value->>'company_id')::uuid for update;
  v_id:=coalesce((p_value->>'id')::uuid,v_id,gen_random_uuid());select to_jsonb(x) into v_before from public.b2b_tariffs x where id=v_id for update;
  insert into public.b2b_tariffs(id,plan_id,company_id,unit_cents,active) values(v_id,p_value->>'plan_id',(p_value->>'company_id')::uuid,(p_value->>'unit_cents')::integer,coalesce((p_value->>'active')::boolean,true))
  on conflict(id) do update set plan_id=excluded.plan_id,company_id=excluded.company_id,unit_cents=excluded.unit_cents,active=excluded.active,updated_at=now();
 elsif p_action='publish_quote' then
  select * into r from public.b2b_order_requests where id=(p_value->>'request_id')::uuid for update;
  if r.id is null or r.version is distinct from (p_value->>'version')::integer or r.status not in ('pending','approved') then raise exception 'request_conflict';end if;
  v_company:=r.company_id;select * into o from public.b2b_orders where request_id=r.id and state<>'expired' for update;
  if o.id is not null then
   if o.request_version<>r.version then raise exception 'immutable_quote';end if;
   if o.state='awaiting_payment' and o.quote_expires_at<=now() then
    if exists(select 1 from public.b2b_payment_attempts where order_id=o.id and status in ('creating','pending','succeeded')) then raise exception 'active_payment_attempt';end if;
    update public.b2b_orders set state='expired' where id=o.id;
   else return o.id;end if;
  end if;
  perform 1 from public.b2b_organizations where id=r.company_id and status='active' for share;if not found then raise exception 'company_required';end if;
  if r.quantity>1000 then raise exception 'quantity_limit';end if;
  if not exists(select 1 from public.catalog_plans p join public.catalog_destinations d on d.slug=p.destination_slug join public.catalog_available_plan_ids a on a.id=p.id join public.provider_package_bindings b on b.plan_id=p.id left join public.catalog_plan_merchandising m on m.plan_id=p.id left join public.catalog_destination_merchandising dm on dm.destination_slug=d.slug where p.id=r.plan_id and p.is_published and d.is_published and p.kind='fixed' and b.is_available and coalesce(m.visibility,'auto')<>'hide' and not coalesce(m.incident_block,false) and (case when lower(p.id)~'_(premium|iij|usip|nonhkip|myip)$' then regexp_replace(lower(p.id),'.*_(premium|iij|usip|nonhkip|myip)$','\1') else 'standard' end)=any(coalesce(dm.approved_modalities,array['standard']))) then raise exception 'plan_unavailable';end if;
  select * into v_binding from public.provider_package_bindings where plan_id=r.plan_id and is_available for share;
  if v_binding.days<>r.days then raise exception 'provider_identity_mismatch';end if;
  select * into c from public.simcoins_private_costs where plan_id=r.plan_id for share;
  if c.plan_id is null or c.observed_at<now()-interval '15 minutes' or c.observed_at>now() then raise exception 'fresh_cost_required';end if;
  select * into s from public.b2b_commerce_settings where id for share;
  if not(s.stripe_enabled or s.bank_enabled or s.yappy_enabled) then raise exception 'method_disabled';end if;
  if s.yappy_enabled and (s.yappy_fee_bps is null or s.yappy_fixed_cents is null) then raise exception 'fee_configuration_required';end if;
  v_bps:=greatest(case when s.stripe_enabled then 440 else 0 end,case when s.yappy_enabled then s.yappy_fee_bps else 0 end);v_fixed:=greatest(case when s.stripe_enabled then 30 else 0 end,case when s.yappy_enabled then s.yappy_fixed_cents else 0 end)+s.other_reserve_cents;
  select * into t from public.b2b_tariffs where active and (plan_id is null or plan_id=r.plan_id) and (company_id is null or company_id=r.company_id) order by (company_id is not null) desc,(plan_id is not null) desc,id limit 1 for share;
  if t.id is null and p_value->>'unit_cents' is null then raise exception 'tariff_required';end if;
  v_price:=coalesce((p_value->>'unit_cents')::integer,t.unit_cents);
  v_tax:=coalesce((p_value->>'tax_cents')::bigint,0);
  if v_price not between 100 and 99999900 or v_price%100<>0 or v_tax not between 0 and 99999999 then raise exception 'invalid_price_or_tax';end if;
  if coalesce((p_value->>'valid_hours')::integer,168) not between 1 and 720 then raise exception 'invalid_expiry';end if;
  -- Exact numeric arithmetic, rounding fees upward; contribution >=20% of revenue.
  if (v_price::numeric*r.quantity*100-c.wholesale_unit_units::numeric*r.quantity-ceil((v_price::numeric*r.quantity+v_tax)*100*v_bps/10000)-v_fixed::numeric*100)*10000 < v_price::numeric*r.quantity*100*2000 then raise exception 'insufficient_margin';end if;
  insert into public.b2b_orders(request_id,request_version,company_id,trip_id,plan_id,plan_name,provider_slug,package_code,volume_bytes,days,quantity,unit_cents,total_cents,tax_cents,tariff_id,wholesale_unit_units,cost_observed_at,worst_fee_bps,worst_fee_fixed_cents,quote_expires_at) values(r.id,r.version,r.company_id,r.trip_id,r.plan_id,r.plan_name,v_binding.provider_slug,v_binding.package_code,v_binding.volume_bytes,v_binding.days,r.quantity,v_price,v_price::bigint*r.quantity+v_tax,v_tax,t.id,c.wholesale_unit_units,c.observed_at,v_bps,v_fixed,now()+make_interval(hours=>coalesce((p_value->>'valid_hours')::integer,168))) returning id into v_id;
  update public.b2b_order_requests set status='approved',reviewed_by=p_actor,reviewed_at=now(),updated_at=now() where id=r.id and status='pending';
 elsif p_action in ('confirm_transfer','release') then
  select * into o from public.b2b_orders where id=(p_value->>'order_id')::uuid for update;
  if o.id is null then raise exception 'order_required';end if;v_id:=o.id;v_company:=o.company_id;v_before:=to_jsonb(o);
  if p_action='confirm_transfer' then
   if (p_value->>'amount_cents')::bigint is distinct from o.total_cents or length(btrim(coalesce(p_value->>'reference',''))) not between 1 and 200 then raise exception 'payment_mismatch';end if;
   if o.state<>'awaiting_payment' then if o.state<>'review' and o.payment_method='transfer' and o.paid_reference=p_value->>'reference' then return o.id;end if;raise exception 'invalid_state';end if;
   if o.quote_expires_at<=now() then raise exception 'quote_unavailable';end if;
   perform public.b2b_commerce_validate(o.id);
   if not exists(select 1 from public.b2b_commerce_settings where id and bank_enabled) then raise exception 'method_disabled';end if;
   if exists(select 1 from public.b2b_payment_attempts where order_id=o.id and status in ('creating','pending','succeeded')) then raise exception 'active_payment_attempt';end if;
   if exists(select 1 from public.b2b_orders where payment_method='transfer' and paid_reference=p_value->>'reference') then raise exception 'reference_used';end if;
   perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('b2b-transfer:'||(p_value->>'reference'),0));
   if exists(select 1 from public.b2b_orders where payment_method='transfer' and paid_reference=p_value->>'reference') then raise exception 'reference_used';end if;
   update public.b2b_orders set state='awaiting_release',payment_method='transfer',paid_reference=p_value->>'reference',paid_at=now() where id=o.id;
  else
   if o.state='review' then raise exception 'manual_review_required';end if;
   if o.released_at is not null then return o.id;end if;
   if o.state<>'awaiting_release' or o.paid_at is null then raise exception 'payment_required';end if;
   if o.payment_method<>'transfer' and not exists(select 1 from public.b2b_payment_attempts where order_id=o.id and status='succeeded' and livemode) then raise exception 'test_payment_not_fulfillable';end if;
   perform public.b2b_commerce_validate(o.id);
   perform 1 from public.b2b_commerce_settings where id and issuance_enabled for share;if not found then raise exception 'issuance_disabled';end if;
   perform 1 from public.b2b_organizations where id=o.company_id and status='active' for share;if not found then raise exception 'company_required';end if;
   perform 1 from public.provider_package_bindings b join public.catalog_plans p on p.id=b.plan_id join public.catalog_available_plan_ids a on a.id=p.id where b.plan_id=o.plan_id and b.is_available and p.is_published and b.provider_slug=o.provider_slug and b.package_code=o.package_code and b.volume_bytes=o.volume_bytes and b.days=o.days for share of b,p;if not found then raise exception 'plan_unavailable';end if;
   select * into c from public.simcoins_private_costs where plan_id=o.plan_id for share;
   if c.plan_id is null or c.observed_at<now()-interval '15 minutes' or c.observed_at>now() then raise exception 'fresh_cost_required';end if;
   if (o.subtotal_cents::numeric*100-c.wholesale_unit_units::numeric*o.quantity-ceil(o.total_cents::numeric*100*o.worst_fee_bps/10000)-o.worst_fee_fixed_cents::numeric*100)*10000<o.subtotal_cents::numeric*100*2000 then raise exception 'insufficient_margin';end if;
   insert into public.b2b_units(order_id,slot,provider_transaction_id,provider_slug,package_code,volume_bytes,days) select o.id,n,gen_random_uuid()::text,o.provider_slug,o.package_code,o.volume_bytes,o.days from generate_series(1,o.quantity) n on conflict(order_id,slot) do nothing;
   update public.b2b_orders set state='provisioning',released_at=now() where id=o.id;
  end if;
 else raise exception 'invalid_action';end if;
 insert into public.b2b_audit_logs(company_id,actor,action,entity_id,before_value,after_value) values(v_company,p_actor,'commerce_'||p_action,v_id,v_before,p_value);
 return v_id;
end;$$;
create function public.b2b_commerce_payment(p_action text,p_value jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare o public.b2b_orders;a public.b2b_payment_attempts;s public.b2b_commerce_settings;v_order uuid;v_actor uuid;
begin
 if p_action in ('begin','transfer_notice') then v_order:=(p_value->>'order_id')::uuid;
 else select order_id into v_order from public.b2b_payment_attempts where id=(p_value->>'id')::uuid;end if;
 select * into o from public.b2b_orders where id=v_order for update;if o.id is null then raise exception 'order_required';end if;
 if p_action in ('begin','transfer_notice') then
  v_actor:=(p_value->>'actor')::uuid;
  if not exists(select 1 from public.b2b_memberships m join public.b2b_organizations c on c.id=m.company_id join auth.users u on u.id=m.user_id where m.company_id=o.company_id and m.user_id=v_actor and m.role in ('owner','finance') and c.status='active' and u.email_confirmed_at is not null) then raise exception 'role_required';end if;
  if o.state<>'awaiting_payment' or o.quote_expires_at<=now() then raise exception 'quote_unavailable';end if;
 end if;
 select * into s from public.b2b_commerce_settings where id for share;
 if p_action='begin' then
  perform public.b2b_commerce_validate(o.id);
  if not exists(select 1 from public.b2b_organizations where id=o.company_id and status='active') then raise exception 'company_required';end if;
  if o.quote_expires_at<now()+interval '36 minutes' then raise exception 'quote_unavailable';end if;
  if p_value->>'method'='stripe' and (o.worst_fee_bps<440 or o.worst_fee_fixed_cents<30) or p_value->>'method'='yappy' and (s.yappy_fee_bps is null or s.yappy_fixed_cents is null or o.worst_fee_bps<s.yappy_fee_bps or o.worst_fee_fixed_cents<s.yappy_fixed_cents+s.other_reserve_cents) then raise exception 'quote_fee_mismatch';end if;
  if p_value->>'method' is null or p_value->>'method' not in ('stripe','yappy') or not(case p_value->>'method' when 'stripe' then s.stripe_enabled when 'yappy' then s.yappy_enabled else false end) then raise exception 'method_disabled';end if;
  if (p_value->>'expected_amount_cents')::bigint is distinct from o.total_cents or (p_value->>'livemode')::boolean is null then raise exception 'payment_mismatch';end if;
  select * into a from public.b2b_payment_attempts where order_id=o.id and status in ('creating','pending','succeeded') for update;
  if a.id is not null then
   if a.method is distinct from p_value->>'method' or a.livemode is distinct from (p_value->>'livemode')::boolean then raise exception 'active_payment_attempt';end if;return to_jsonb(a);
  end if;
  insert into public.b2b_payment_attempts(id,order_id,method,expected_amount_cents,provider_ref,livemode,locale) values((p_value->>'id')::uuid,o.id,p_value->>'method',o.total_cents,p_value->>'provider_ref',(p_value->>'livemode')::boolean,coalesce(p_value->>'locale','es')) returning * into a;
 elsif p_action='transfer_notice' then
  if not s.bank_enabled then raise exception 'method_disabled';end if;
  if exists(select 1 from public.b2b_payment_attempts where order_id=o.id and status in ('creating','pending','succeeded')) then raise exception 'active_payment_attempt';end if;
  if length(btrim(coalesce(p_value->>'reference',''))) not between 1 and 200 then raise exception 'reference_required';end if;
 elsif p_action in ('bind','settle','refund') then
  select * into a from public.b2b_payment_attempts where id=(p_value->>'id')::uuid and order_id=o.id for update;
  if a.id is null or a.provider_ref is distinct from p_value->>'provider_ref' then raise exception 'payment_mismatch';end if;
  if p_action in ('settle','refund') and p_value->>'event_id' is not null then
   perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('b2b-event:'||(p_value->>'event_id'),0));
   if exists(select 1 from public.b2b_payment_events where event_id=p_value->>'event_id' and (attempt_id<>a.id or action<>p_action)) then raise exception 'event_conflict';end if;
   if exists(select 1 from public.b2b_payment_events where event_id=p_value->>'event_id') then return to_jsonb(a);end if;
   insert into public.b2b_payment_events(event_id,attempt_id,action,payload) values(p_value->>'event_id',a.id,p_action,p_value);
  end if;
  if p_action='refund' then
   if a.status<>'succeeded' or a.livemode is distinct from (p_value->>'livemode')::boolean or coalesce((p_value->>'amount_cents')::bigint,0) not between 1 and a.expected_amount_cents then raise exception 'payment_mismatch';end if;
   if o.state<>'review' then update public.b2b_orders set state='review' where id=o.id;end if;
  elsif p_action='bind' then
   if length(coalesce(p_value->>'session_id','')) not between 1 and 300 or a.session_id is not null and a.session_id<>p_value->>'session_id' then raise exception 'payment_mismatch';end if;
   if a.status not in ('creating','pending') then return to_jsonb(a);end if;
   update public.b2b_payment_attempts set session_id=p_value->>'session_id',status='pending',updated_at=now() where id=a.id returning * into a;
  else
   if (p_value->>'amount_cents')::bigint is distinct from a.expected_amount_cents or a.expected_amount_cents<>o.total_cents or p_value->>'currency' is distinct from 'USD' or (p_value->>'livemode')::boolean is distinct from a.livemode or p_value->>'status' is null or p_value->>'status' not in ('succeeded','failed','cancelled') then raise exception 'payment_mismatch';end if;
   if a.status='succeeded' then if p_value->>'status'='succeeded' then return to_jsonb(a);end if;raise exception 'payment_already_succeeded';end if;
   if a.status in ('failed','cancelled') then if a.status=p_value->>'status' then return to_jsonb(a);end if;raise exception 'invalid_state';end if;
   if o.state<>'awaiting_payment' then raise exception 'invalid_state';end if;
   update public.b2b_payment_attempts set status=p_value->>'status',updated_at=now() where id=a.id returning * into a;
   if a.status='succeeded' then update public.b2b_orders set state='awaiting_release',payment_method=a.method,paid_reference=a.provider_ref,paid_at=now() where id=o.id;end if;
  end if;
 else raise exception 'invalid_action';end if;
 insert into public.b2b_audit_logs(company_id,actor,action,entity_id,after_value) values(o.company_id,v_actor,'commerce_payment_'||p_action,coalesce(a.id,o.id),p_value);
 return case when a.id is null then jsonb_build_object('order_id',o.id,'recorded',true) else to_jsonb(a) end;
end;$$;
create function public.b2b_commerce_workspace(p_trip uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_company uuid;v_order uuid;begin
 select company_id into v_company from public.b2b_trips where id=p_trip;
 if v_company is null or public.b2b_role(v_company) is null then raise exception 'company_required';end if;
 select id into v_order from public.b2b_orders where trip_id=p_trip and company_id=v_company and state<>'expired';
 return jsonb_build_object('order',(select to_jsonb(x) from(select o.id,o.request_id,o.company_id,o.trip_id,o.plan_id,o.plan_name,o.quantity,o.unit_cents,o.subtotal_cents,o.tax_cents,o.total_cents,o.currency,o.state,o.payment_method,o.paid_at,o.released_at,o.quote_expires_at,o.created_at,(select count(*) from public.b2b_units u where u.order_id=o.id and u.state='ready') as ready_units,(select count(*) from public.b2b_units u where u.order_id=o.id and u.state='ready') as issued_units from public.b2b_orders o where id=v_order) x),
 'units',coalesce((select jsonb_agg(jsonb_build_object('id',u.id,'slot',u.slot,'state',u.state) order by u.slot) from public.b2b_units u where order_id=v_order),'[]'::jsonb),
 'payment_methods',(select jsonb_build_object('stripe',stripe_enabled,'transfer',bank_enabled,'yappy',yappy_enabled) from public.b2b_commerce_settings where id),
 'bank_instructions',(select case when bank_enabled then bank_instructions else '' end from public.b2b_commerce_settings where id));
end;$$;
create function public.b2b_commerce_records(p_actor uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$begin
 if not exists(select 1 from public.admin_memberships where user_id=p_actor) then raise exception 'admin_required';end if;
 return jsonb_build_object('settings',(select to_jsonb(s) from public.b2b_commerce_settings s where id),
 'tariffs',coalesce((select jsonb_agg(to_jsonb(t)||jsonb_build_object('plan_name',p.name,'company_name',c.name)) from public.b2b_tariffs t left join public.catalog_plans p on p.id=t.plan_id left join public.b2b_organizations c on c.id=t.company_id),'[]'::jsonb),
 'orders',coalesce((select jsonb_agg(to_jsonb(o)) from(select o.*,c.name as company_name,t.name as trip_name,(select count(*) from public.b2b_units u where u.order_id=o.id and u.state='ready') as issued_units,(select count(*) from public.b2b_units u where u.order_id=o.id and u.state='ready') as ready_units from public.b2b_orders o join public.b2b_organizations c on c.id=o.company_id join public.b2b_trips t on t.id=o.trip_id order by o.created_at desc limit 500) o),'[]'::jsonb),
 'attempts',coalesce((select jsonb_agg(to_jsonb(a)) from(select * from public.b2b_payment_attempts order by created_at desc limit 500) a),'[]'::jsonb),
 'requests',public.b2b_admin_records(p_actor)->'requests','companies',public.b2b_admin_records(p_actor)->'companies');end;$$;
create function public.claim_b2b_units(p_limit integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_result jsonb;begin
 if p_limit is null or p_limit not between 1 and 100 then raise exception 'invalid_limit';end if;
 perform 1 from public.b2b_commerce_settings where id and issuance_enabled for share;if not found then return '[]'::jsonb;end if;
 with candidates as (select u.id from public.b2b_units u join public.b2b_orders o on o.id=u.order_id join public.b2b_organizations c on c.id=o.company_id where u.state in ('queued','provider_pending') and o.paid_at is not null and o.released_at is not null and o.state='provisioning' and (o.payment_method='transfer' or exists(select 1 from public.b2b_payment_attempts pa where pa.order_id=o.id and pa.status='succeeded' and pa.livemode)) and c.status='active' and (u.lease_until is null or u.lease_until<now()) and (u.next_attempt_at is null or u.next_attempt_at<=now()) order by u.created_at,u.slot limit p_limit for update of u skip locked),
 claimed as(update public.b2b_units u set lease_token=gen_random_uuid(),lease_until=now()+interval '5 minutes',attempts=attempts+1 from candidates c where u.id=c.id returning u.*)
 select coalesce(jsonb_agg(to_jsonb(c)||jsonb_build_object('payment_status','paid','released_at',o.released_at)),'[]'::jsonb) into v_result from claimed c join public.b2b_orders o on o.id=c.order_id;
 return v_result;end;$$;
create function public.update_b2b_unit(p_id uuid,p_lease uuid,p_patch jsonb) returns boolean language plpgsql security definer set search_path='' as $$
declare u public.b2b_units;n public.b2b_units;v_company uuid;v_order uuid;begin
 if jsonb_typeof(p_patch) is distinct from 'object' or p_patch-array['state','provider_order_no','attempts','last_error','next_attempt_at','iccid','smdp_address','activation_code','provider_profile_id','apn']<>'{}'::jsonb then raise exception 'invalid_patch';end if;
 select order_id into v_order from public.b2b_units where id=p_id;
 perform 1 from public.b2b_orders where id=v_order for update;
 select * into u from public.b2b_units where id=p_id for update;
 if u.id is null or u.lease_token is distinct from p_lease or p_lease is null or u.lease_until<now() then return false;end if;
 select * into n from jsonb_populate_record(u,p_patch);
 if u.state not in ('queued','provider_pending') or n.state not in ('queued','provider_pending','ready','review') or u.state='provider_pending' and n.state='queued' or (u.provider_order_no is not null and n.provider_order_no is distinct from u.provider_order_no) or (n.attempts<u.attempts and not(u.state='queued' and n.state in ('provider_pending','ready') or u.state='provider_pending' and n.state='ready')) then raise exception 'invalid_state';end if;
 if n.state='ready' and (length(coalesce(n.iccid,''))<1 or length(coalesce(n.activation_code,''))<1 or length(coalesce(n.smdp_address,''))<1) then raise exception 'profile_required';end if;
 update public.b2b_units set state=n.state,provider_order_no=n.provider_order_no,attempts=n.attempts,last_error=left(n.last_error,1000),next_attempt_at=n.next_attempt_at,iccid=n.iccid,smdp_address=n.smdp_address,activation_code=n.activation_code,provider_profile_id=n.provider_profile_id,apn=n.apn,lease_token=null,lease_until=null where id=p_id;
 select company_id into v_company from public.b2b_orders where id=u.order_id;
 insert into public.b2b_audit_logs(company_id,action,entity_id,before_value,after_value) values(v_company,'commerce_unit_updated',p_id,jsonb_build_object('state',u.state),jsonb_build_object('state',n.state,'attempts',n.attempts));
 if n.state='ready' and not exists(select 1 from public.b2b_units where order_id=u.order_id and state<>'ready') then update public.b2b_orders set state='ready' where id=u.order_id and state='provisioning';end if;
 return true;end;$$;
revoke all on function public.b2b_commerce_validate(uuid),public.b2b_commerce_immutable(),public.b2b_commerce_admin(uuid,text,jsonb),public.b2b_commerce_payment(text,jsonb),public.b2b_commerce_workspace(uuid),public.b2b_commerce_records(uuid),public.claim_b2b_units(integer),public.update_b2b_unit(uuid,uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.b2b_commerce_workspace(uuid) to authenticated;
grant execute on function public.b2b_commerce_admin(uuid,text,jsonb),public.b2b_commerce_payment(text,jsonb),public.b2b_commerce_records(uuid),public.claim_b2b_units(integer),public.update_b2b_unit(uuid,uuid,jsonb) to service_role;
commit;
