-- Payment infrastructure is deliberately restricted to Stripe test mode.
begin;
create table public.stripe_catalog_prices (
  plan_id text primary key references public.catalog_plans(id),
  product_id text not null unique,
  price_id text not null unique,
  amount_cents integer not null check (amount_cents between 1 and 99999999),
  currency text not null default 'usd' check (currency = 'usd'),
  livemode boolean not null default false check (not livemode),
  updated_at timestamptz not null default now()
);
create table public.checkout_orders (
  id uuid primary key,
  user_id uuid references auth.users(id) on delete set null,
  recipient_email text not null check (length(recipient_email) between 3 and 254),
  browser_hash text not null check (browser_hash ~ '^[a-f0-9]{64}$'),
  ip_hash text not null check (ip_hash ~ '^[a-f0-9]{64}$'),
  fingerprint text not null check (fingerprint ~ '^[a-f0-9]{64}$'),
  locale text not null check (locale in ('es','en')),
  status text not null default 'pending' check (status in ('pending','paid','expired','failed')),
  amount_total integer not null check (amount_total between 1 and 99999999),
  currency text not null default 'usd' check (currency = 'usd'),
  livemode boolean not null default false check (not livemode),
  stripe_session_id text unique,
  stripe_payment_intent text unique,
  checkout_url text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
create index checkout_orders_owner_idx on public.checkout_orders(user_id,created_at desc);
create index checkout_orders_rate_idx on public.checkout_orders(ip_hash,created_at);
create table public.checkout_order_items (
  order_id uuid not null references public.checkout_orders(id),
  plan_id text not null,
  destination_slug text not null,
  destination_name jsonb not null,
  plan_name text not null,
  data_gb numeric not null check (data_gb > 0),
  days integer not null check (days > 0),
  quantity integer not null check (quantity between 1 and 10),
  unit_amount integer not null check (unit_amount between 1 and 99999999),
  stripe_price_id text not null,
  primary key (order_id,plan_id)
);
create table public.checkout_stripe_events (
  id text primary key,
  order_id uuid not null references public.checkout_orders(id),
  event_type text not null,
  created_at timestamptz not null default now()
);
alter table public.stripe_catalog_prices enable row level security;
alter table public.checkout_orders enable row level security;
alter table public.checkout_order_items enable row level security;
alter table public.checkout_stripe_events enable row level security;
revoke all on public.stripe_catalog_prices,public.checkout_orders,public.checkout_order_items,public.checkout_stripe_events from public,anon,authenticated;
grant all on public.stripe_catalog_prices,public.checkout_orders,public.checkout_order_items,public.checkout_stripe_events to service_role;
grant select(id,user_id,locale,status,amount_total,currency,livemode,created_at,paid_at) on public.checkout_orders to authenticated;
grant select(order_id,plan_id,destination_slug,destination_name,plan_name,data_gb,days,quantity,unit_amount) on public.checkout_order_items to authenticated;
create policy own_checkout_orders on public.checkout_orders for select to authenticated using (user_id = (select auth.uid()));
create policy own_checkout_items on public.checkout_order_items for select to authenticated using (
  exists(select 1 from public.checkout_orders o where o.id=order_id and o.user_id=(select auth.uid()))
);

create function public.create_test_checkout(
  p_id uuid,p_user_id uuid,p_email text,p_browser_hash text,p_ip_hash text,
  p_fingerprint text,p_locale text,p_expected_total integer,p_lines jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare existing public.checkout_orders; line_count integer; matched integer; total bigint;
begin
  if p_lines is null or jsonb_typeof(p_lines)<>'array' or jsonb_array_length(p_lines) not between 1 and 20 then
    raise exception 'invalid_cart';
  end if;
  if exists(select 1 from jsonb_array_elements(p_lines) l where
    jsonb_typeof(l)<>'object' or l - array['destination','planId','quantity'] <> '{}'::jsonb or
    not (l ?& array['destination','planId','quantity']) or
    jsonb_typeof(l->'quantity')<>'number' or (l->>'quantity') !~ '^[0-9]+$' or
    (l->>'quantity')::numeric not between 1 and 10) then raise exception 'invalid_cart'; end if;
  line_count := jsonb_array_length(p_lines);
  if (select count(distinct l->>'planId') from jsonb_array_elements(p_lines) l) <> line_count then raise exception 'invalid_cart'; end if;
  -- Serializes attempts from one network, and duplicate retries, across application instances.
  perform pg_advisory_xact_lock(hashtextextended(p_ip_hash,0));
  select * into existing from public.checkout_orders where id=p_id for update;
  if found then
    if existing.browser_hash<>p_browser_hash or existing.fingerprint<>p_fingerprint or
       existing.user_id is distinct from p_user_id then raise exception 'attempt_conflict'; end if;
    return to_jsonb(existing);
  end if;
  if (select count(*) from public.checkout_orders where ip_hash=p_ip_hash and created_at>now()-interval '1 hour')>=15 then
    raise exception 'checkout_rate_limit';
  end if;
  perform p.id from jsonb_array_elements(p_lines) l
  join public.catalog_plans p on p.id=l->>'planId' and p.destination_slug=l->>'destination'
  join public.catalog_destinations d on d.slug=p.destination_slug
  join public.stripe_catalog_prices s on s.plan_id=p.id
  for share of p,d,s;
  select count(*),sum(p.retail_price_cents * (l->>'quantity')::bigint) into matched,total
  from jsonb_array_elements(p_lines) l
  join public.catalog_plans p on p.id=l->>'planId' and p.destination_slug=l->>'destination'
  join public.catalog_destinations d on d.slug=p.destination_slug
  join public.stripe_catalog_prices s on s.plan_id=p.id and s.amount_cents=p.retail_price_cents and not s.livemode
  where p.is_published and d.is_published and p.kind='fixed';
  if matched<>line_count or total is null then raise exception 'unavailable_plan'; end if;
  if total<>p_expected_total or total>99999999 then raise exception 'price_changed'; end if;
  insert into public.checkout_orders(id,user_id,recipient_email,browser_hash,ip_hash,fingerprint,locale,amount_total)
    values(p_id,p_user_id,p_email,p_browser_hash,p_ip_hash,p_fingerprint,p_locale,total);
  insert into public.checkout_order_items(order_id,plan_id,destination_slug,destination_name,plan_name,data_gb,days,quantity,unit_amount,stripe_price_id)
  select p_id,p.id,p.destination_slug,d.name,p.name,p.data_gb,p.days,(l->>'quantity')::integer,p.retail_price_cents,s.price_id
  from jsonb_array_elements(p_lines) l
  join public.catalog_plans p on p.id=l->>'planId' and p.destination_slug=l->>'destination'
  join public.catalog_destinations d on d.slug=p.destination_slug
  join public.stripe_catalog_prices s on s.plan_id=p.id;
  select * into existing from public.checkout_orders where id=p_id;
  return to_jsonb(existing);
end;
$$;
revoke all on function public.create_test_checkout(uuid,uuid,text,text,text,text,text,integer,jsonb) from public,anon,authenticated;
grant execute on function public.create_test_checkout(uuid,uuid,text,text,text,text,text,integer,jsonb) to service_role;

create function public.record_test_checkout_event(
  p_event_id text,p_event_type text,p_order_id uuid,p_session_id text,
  p_status text,p_amount integer,p_currency text,p_payment_intent text
) returns text language plpgsql security definer set search_path = '' as $$
declare existing public.checkout_orders; affected integer;
begin
  if p_status not in ('pending','paid','expired','failed') or
     p_event_type not in ('checkout.session.completed','checkout.session.async_payment_succeeded','checkout.session.async_payment_failed','checkout.session.expired') then raise exception 'invalid_event'; end if;
  select * into existing from public.checkout_orders where id=p_order_id for update;
  if not found or existing.stripe_session_id is distinct from p_session_id or
     existing.amount_total is distinct from p_amount or p_currency is distinct from 'usd' then raise exception 'payment_mismatch'; end if;
  insert into public.checkout_stripe_events(id,order_id,event_type) values(p_event_id,p_order_id,p_event_type) on conflict(id) do nothing;
  get diagnostics affected = row_count;
  if affected=0 then return 'duplicate'; end if;
  if existing.status<>'paid' then
    update public.checkout_orders set status=p_status,
      paid_at=case when p_status='paid' then now() else paid_at end,
      stripe_payment_intent=coalesce(p_payment_intent,stripe_payment_intent)
      where id=p_order_id;
  end if;
  -- Test payments deliberately never create a provider order, QR or delivery job.
  return 'recorded';
end;
$$;
revoke all on function public.record_test_checkout_event(text,text,uuid,text,text,integer,text,text) from public,anon,authenticated;
grant execute on function public.record_test_checkout_event(text,text,uuid,text,text,integer,text,text) to service_role;
commit;
