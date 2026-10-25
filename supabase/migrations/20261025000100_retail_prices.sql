begin;
alter table public.catalog_plans add column retail_price_cents integer check (retail_price_cents between 1 and 100000000);
comment on column public.catalog_plans.retail_price_cents is 'Owner-approved final selling price in USD cents. Never supplier cost.';
create function public.apply_retail_prices(prices jsonb) returns integer
language plpgsql security invoker set search_path=public as $$
declare updated_count integer;
begin
  if jsonb_typeof(prices) is distinct from 'array' then raise exception 'Invalid retail prices'; end if;
  if jsonb_array_length(prices) = 0 or jsonb_array_length(prices) > 20000 then raise exception 'Invalid retail price count'; end if;
  if exists(select 1 from jsonb_array_elements(prices) e where jsonb_typeof(e) is distinct from 'object' or e - array['plan_id','amount_cents'] <> '{}'::jsonb or not(e ?& array['plan_id','amount_cents'])) then raise exception 'Invalid retail price fields'; end if;
  if (select count(distinct b.plan_id) from jsonb_to_recordset(prices) as b(plan_id text,amount_cents integer)) <> jsonb_array_length(prices) then raise exception 'Duplicate retail plan'; end if;
  if exists(select 1 from jsonb_to_recordset(prices) as b(plan_id text,amount_cents integer) left join public.catalog_plans p on p.id=b.plan_id where p.id is null or p.kind<>'fixed' or b.amount_cents is null or b.amount_cents not between 1 and 100000000) then raise exception 'Invalid retail plan identity'; end if;
  update public.catalog_plans p set retail_price_cents=b.amount_cents
    from jsonb_to_recordset(prices) as b(plan_id text,amount_cents integer)
    where p.id=b.plan_id;
  get diagnostics updated_count=row_count;
  if updated_count <> jsonb_array_length(prices) then raise exception 'Incomplete retail update'; end if;
  return updated_count;
end;
$$;
revoke all on function public.apply_retail_prices(jsonb) from public,anon,authenticated;
grant execute on function public.apply_retail_prices(jsonb) to service_role;
grant update(retail_price_cents) on public.catalog_plans to service_role;
commit;
