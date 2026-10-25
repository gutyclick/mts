-- Public product data only. No prices, supplier credentials or customer records.
begin;

create table public.catalog_destinations (
  slug text primary key check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name jsonb not null check (
    coalesce(jsonb_typeof(name) = 'object' and
    jsonb_typeof(name->'es') = 'string' and
    jsonb_typeof(name->'en') = 'string' and
    length(name->>'es') > 0 and length(name->>'en') > 0 and
    name - array['es', 'en'] = '{}'::jsonb, false)
  ),
  code text not null check (length(code) between 1 and 100),
  type text not null check (type in ('country', 'region')),
  aliases text[] not null default '{}',
  image text not null check (image ~* '^/(images/|illustrations/|flags/)[^?#:%\\]+\.(png|jpg|jpeg|webp|avif|svg)$' and image !~ '\.\.' and image !~ '[[:cntrl:]]'),
  artwork_kind text not null check (artwork_kind in ('banner', 'illustration', 'flag')),
  is_published boolean not null default false
);

create table public.catalog_plans (
  id text primary key check (length(id) between 1 and 200),
  destination_slug text not null references public.catalog_destinations(slug),
  name text not null check (length(name) between 1 and 300),
  allowance text not null check (length(allowance) between 1 and 50),
  data_gb numeric not null check (data_gb > 0 and data_gb <= 100000),
  days integer not null check (days > 0 and days <= 3650),
  kind text not null default 'fixed' check (kind = 'fixed'),
  coverage_code text not null check (length(coverage_code) between 1 and 100),
  details jsonb check (details is null or coalesce((
    jsonb_typeof(details) = 'object' and
    details - array['dataGb','days','coverage','technologies','activation','topUp','networks','apn','fairUse'] = '{}'::jsonb and
    (details->>'dataGb')::numeric = data_gb and
    (details->>'days')::integer = days and
    details->>'activation' in ('network','installation','purchase') and
    details->>'topUp' in ('same-area-data','none') and
    jsonb_typeof(details->'coverage') = 'array' and
    jsonb_typeof(details->'technologies') = 'array' and
    jsonb_typeof(details->'networks') = 'array'
  ), false)),
  is_published boolean not null default false
);

create index catalog_plans_destination_idx on public.catalog_plans(destination_slug, data_gb, days, id);
alter table public.catalog_destinations enable row level security;
alter table public.catalog_plans enable row level security;

revoke all on public.catalog_destinations, public.catalog_plans from public, anon, authenticated;
grant select on public.catalog_destinations, public.catalog_plans to anon, authenticated;
create policy published_destinations on public.catalog_destinations
  for select to anon, authenticated using (is_published);
create policy published_plans on public.catalog_plans
  for select to anon, authenticated using (
    is_published and exists (
      select 1 from public.catalog_destinations d
      where d.slug = destination_slug and d.is_published
    )
  );

-- Derived counts/ranges always follow the current published plans, including RLS.
create view public.published_catalog_destinations with (security_invoker = true) as
select d.slug, d.name, d.code, d.type, d.aliases, d.image, d.artwork_kind,
       count(p.id)::integer as plan_count,
       min(p.data_gb) as data_min_gb, max(p.data_gb) as data_max_gb
from public.catalog_destinations d
join public.catalog_plans p on p.destination_slug = d.slug
where d.is_published and p.is_published
group by d.slug;
revoke all on public.published_catalog_destinations from public, anon, authenticated;
grant select on public.published_catalog_destinations to anon, authenticated;
commit;
