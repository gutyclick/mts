-- Additive follow-up: existing SimCoins snapshots have their own preparation path.
begin;
alter function public.simcoins_prepare_payment(uuid,text,uuid,integer) rename to catalog_original_simcoins_prepare_payment;
revoke all on function public.catalog_original_simcoins_prepare_payment(uuid,text,uuid,integer) from public,anon,authenticated,service_role;
create function public.simcoins_prepare_payment(p_order uuid,p_currency text,p_quote uuid,p_expected integer) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform public.catalog_assert_order_available(p_order);
 return public.catalog_original_simcoins_prepare_payment(p_order,p_currency,p_quote,p_expected);
end;$$;
revoke all on function public.simcoins_prepare_payment(uuid,text,uuid,integer) from public,anon,authenticated;
grant execute on function public.simcoins_prepare_payment(uuid,text,uuid,integer) to service_role;
-- Match the allowance's actual units, including MB SKUs, with provider import tolerance.
-- Only the public SKU is exposed; provider bytes/package codes remain private.
create or replace view public.catalog_available_plan_ids with (security_barrier=true) as
select p.id from public.catalog_plans p
join public.provider_package_bindings b on b.plan_id=p.id
cross join lateral regexp_match(trim(p.allowance),'^([0-9]+(?:\.[0-9]+)?)[[:space:]]*(GB|MB)$','i') amount
where p.is_published and b.is_available and b.provider_slug=p.id and b.days=p.days
and (
 abs(b.volume_bytes::numeric - (amount[1])::numeric * case when upper(amount[2])='GB' then 1073741824 else 1048576 end)<1
 or abs(b.volume_bytes::numeric - (amount[1])::numeric * case when upper(amount[2])='GB' then 1000000000 else 1000000 end)<1
);
revoke all on public.catalog_available_plan_ids from public,anon,authenticated;
grant select on public.catalog_available_plan_ids to anon,authenticated,service_role;
commit;

