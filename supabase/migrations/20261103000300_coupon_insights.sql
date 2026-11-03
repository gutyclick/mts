-- Safe, code-specific buyer conditions and private historical promotion reporting.
begin;
create function public.coupon_lookup_details(p_code text,p_identity text,p_user uuid,p_rate_key text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.coupon_definitions;attempts integer;
begin
 if p_identity is null or p_identity!~'^[a-f0-9]{64}$' or p_rate_key is null or p_rate_key!~'^[a-f0-9]{64}$' then raise exception 'coupon_identity';end if;
 -- Shared with quote attempts: failed guesses must commit the rate counter too.
 insert into public.coupon_rate_limits(bucket_key,attempts)values(p_rate_key,1)
 on conflict(bucket_key)do update set attempts=case when coupon_rate_limits.window_start<=now()-interval '10 minutes'then 1 else coupon_rate_limits.attempts+1 end,
 window_start=case when coupon_rate_limits.window_start<=now()-interval '10 minutes'then now()else coupon_rate_limits.window_start end
 returning coupon_rate_limits.attempts into attempts;
 if attempts>20 then return jsonb_build_object('error','rate_limit');end if;
 begin
  select * into c from public.coupon_definitions where code=upper(btrim(p_code)) for share;
  perform public.coupon_assert_available(c.id,p_identity,p_user);
  return jsonb_build_object('code',c.code,'minimumUsdCents',c.minimum_cents,'startsAt',c.starts_at,'endsAt',c.ends_at,
   'eligiblePlans','published_fixed','eligibility','not_evaluated');
 exception when raise_exception then
  return jsonb_build_object('error',case when SQLERRM='coupon_limit_reached' then 'coupon_limit' else 'invalid_coupon' end);
 end;
end;$$;
revoke all on function public.coupon_lookup_details(text,text,uuid,text) from public,anon,authenticated;
grant execute on function public.coupon_lookup_details(text,text,uuid,text) to service_role;

create function public.coupon_admin_insights(p_actor uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.admin_memberships where user_id=p_actor)then raise exception 'admin_required';end if;
 return (with paid as (
  select s.coupon_id,s.snapshot,
   exists(select 1 from public.refund_requests r where r.order_id=o.id and r.state not in ('failed','rejected')) refund_excluded
  from public.coupon_order_snapshots s join public.checkout_orders o on o.id=s.order_id
  where o.status='paid' and o.livemode
 ), totals as (
  select coupon_id,
   count(*)filter(where not refund_excluded) paid_orders,
   count(*)filter(where refund_excluded) refund_excluded_orders,
   coalesce(sum((snapshot->>'netCents')::numeric)filter(where refund_excluded),0) refund_excluded_sales,
   coalesce(sum((snapshot->>'netCents')::numeric)filter(where not refund_excluded),0) sales,
   coalesce(sum((snapshot->>'discountUsdCents')::numeric)filter(where not refund_excluded),0) discounts,
   count(*)filter(where not refund_excluded and jsonb_typeof(snapshot->'cashUnits')='number' and jsonb_typeof(snapshot->'costUnits')='number' and jsonb_typeof(snapshot->'feeUnits')='number') estimated_orders,
   coalesce(sum((snapshot->>'cashUnits')::numeric-(snapshot->>'costUnits')::numeric-(snapshot->>'feeUnits')::numeric)
    filter(where not refund_excluded and jsonb_typeof(snapshot->'cashUnits')='number' and jsonb_typeof(snapshot->'costUnits')='number' and jsonb_typeof(snapshot->'feeUnits')='number'),0) contribution_units
  from paid group by coupon_id
 ) select coalesce(jsonb_object_agg(coupon_id,jsonb_build_object(
  'paidOrders',paid_orders,'refundExcludedOrders',refund_excluded_orders,'refundExcludedSalesUsdCents',refund_excluded_sales,
  'salesUsdCents',sales,'discountUsdCents',discounts,
  'estimatedOrders',estimated_orders,'estimatedContributionUsdCents',case when estimated_orders=0 then null else floor(contribution_units/100) end)), '{}') from totals);
end;$$;
revoke all on function public.coupon_admin_insights(uuid) from public,anon,authenticated;
grant execute on function public.coupon_admin_insights(uuid) to service_role;
-- Preserve quote guards while exposing a safe minimum-spend rejection.
create or replace function public.coupon_create_quote(p_code text,p_identity text,p_user uuid,p_lines jsonb,p_currency text,p_fx_quote uuid,p_rate_key text) returns jsonb language plpgsql security definer set search_path='' as $$
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
  return jsonb_build_object('error',case SQLERRM when 'coupon_minimum'then 'coupon_minimum' when 'coupon_cost_unavailable'then 'coupon_cost_unavailable' when 'coupon_insufficient_margin'then 'coupon_margin' when 'coupon_limit_reached'then 'coupon_limit' when 'quote_expired'then 'coupon_expired' else 'invalid_coupon'end);
 end;
end;$$;
commit;


