-- Internal supplier identities only. No supplier prices or credentials.
begin;
create table public.provider_package_bindings (
  plan_id text primary key references public.catalog_plans(id) on delete cascade,
  provider_slug text not null unique check (provider_slug = plan_id),
  package_code text not null unique check (length(package_code) between 1 and 200),
  volume_bytes bigint not null check (volume_bytes > 0),
  days integer not null check (days > 0 and days <= 3650),
  is_available boolean not null default true,
  last_checked_at timestamptz not null default now()
);
alter table public.provider_package_bindings enable row level security;
revoke all on public.provider_package_bindings from public,anon,authenticated;
grant select,insert,update,delete on public.provider_package_bindings to service_role;
grant select on public.catalog_plans to service_role;

create function public.sync_esim_access_bindings(bindings jsonb)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare updated_count integer;
        missing_count integer;
begin
  if jsonb_typeof(bindings) is distinct from 'array' then
    raise exception 'Invalid binding payload';
  end if;
  if jsonb_array_length(bindings) = 0 or jsonb_array_length(bindings) > 20000 then
    raise exception 'Invalid binding count';
  end if;
  if exists (select 1 from jsonb_array_elements(bindings) e
    where jsonb_typeof(e) is distinct from 'object'
      or e - array['plan_id','provider_slug','package_code','volume_bytes','days'] <> '{}'::jsonb
      or not (e ?& array['plan_id','provider_slug','package_code','volume_bytes','days'])) then
    raise exception 'Invalid binding fields';
  end if;
  if exists (
    select 1 from jsonb_to_recordset(bindings) as b(plan_id text, provider_slug text, package_code text, volume_bytes bigint, days integer)
    left join public.catalog_plans p on p.id = b.plan_id
    where p.id is null or not p.is_published or p.kind <> 'fixed'
      or b.provider_slug is distinct from p.id or b.days is distinct from p.days
      or b.package_code is null or length(b.package_code) not between 1 and 200
      or b.volume_bytes is null or b.volume_bytes <= 0
  ) then raise exception 'Catalog identity mismatch'; end if;
  perform pg_advisory_xact_lock(hashtext('mytripsim-esimaccess-bindings'));
  update public.provider_package_bindings set is_available = false, last_checked_at = now();
  insert into public.provider_package_bindings(plan_id,provider_slug,package_code,volume_bytes,days,is_available,last_checked_at)
    select b.plan_id,b.provider_slug,b.package_code,b.volume_bytes,b.days,true,now()
    from jsonb_to_recordset(bindings) as b(plan_id text, provider_slug text, package_code text, volume_bytes bigint, days integer)
    on conflict (plan_id) do update set provider_slug = excluded.provider_slug,
      package_code = excluded.package_code, volume_bytes = excluded.volume_bytes,
      days = excluded.days, is_available = true, last_checked_at = now();
  get diagnostics updated_count = row_count;
  select count(*) into missing_count from public.provider_package_bindings where not is_available;
  return jsonb_build_object('available',updated_count,'unavailable',missing_count);
end;
$$;
revoke all on function public.sync_esim_access_bindings(jsonb) from public,anon,authenticated;
grant execute on function public.sync_esim_access_bindings(jsonb) to service_role;
commit;
