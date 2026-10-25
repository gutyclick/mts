begin;
create table public.customer_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  status text not null check (status in ('pending','processing','completed','cancelled','refunded')),
  destination_name jsonb not null check (jsonb_typeof(destination_name) = 'object' and destination_name ?& array['es','en']),
  destination_slug text not null,
  plan_id text not null,
  plan_name text not null,
  data_gb numeric not null check (data_gb > 0),
  days integer not null check (days > 0),
  unique (id, user_id)
);
create index customer_orders_owner_idx on public.customer_orders(user_id, created_at desc);
create table public.customer_esims (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  order_id uuid not null,
  created_at timestamptz not null default now(),
  status text not null check (status in ('ready','active','expired')),
  used_gb numeric check (used_gb >= 0),
  usage_updated_at timestamptz,
  expires_at timestamptz,
  iccid text,
  smdp_address text check (smdp_address is null or smdp_address ~ '^[a-zA-Z0-9.-]+$'),
  activation_code text check (activation_code is null or activation_code ~ '^[a-zA-Z0-9_-]+$'),
  foreign key (order_id,user_id) references public.customer_orders(id,user_id) on delete cascade
);
create index customer_esims_owner_idx on public.customer_esims(user_id, created_at desc);
create index customer_esims_order_idx on public.customer_esims(order_id,user_id);
alter table public.customer_orders enable row level security;
alter table public.customer_esims enable row level security;
revoke all on public.customer_orders, public.customer_esims from public,anon,authenticated;
grant select on public.customer_orders, public.customer_esims to authenticated;
create policy own_orders on public.customer_orders for select to authenticated
  using (user_id = (select auth.uid()));
create policy own_esims on public.customer_esims for select to authenticated
  using (user_id = (select auth.uid()));
commit;
