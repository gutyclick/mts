begin;
alter table public.stripe_catalog_prices drop constraint stripe_catalog_prices_livemode_check;
alter table public.checkout_orders drop constraint checkout_orders_livemode_check;
alter table public.stripe_catalog_prices drop constraint stripe_catalog_prices_pkey;
alter table public.stripe_catalog_prices drop constraint stripe_catalog_prices_product_id_key;
alter table public.stripe_catalog_prices drop constraint stripe_catalog_prices_price_id_key;
alter table public.stripe_catalog_prices add primary key(plan_id,livemode), add unique(product_id,livemode), add unique(price_id,livemode);
create function public.create_checkout_v3(
  p_livemode boolean,p_id uuid,p_user_id uuid,p_billing_email text,p_recipient_email text,p_marketing_opt_in boolean,p_browser_hash text,p_ip_hash text,
  p_fingerprint text,p_locale text,p_expected_total integer,p_lines jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare existing public.checkout_orders; line_count integer; matched integer; total bigint;
begin
  if p_livemode is null or p_billing_email is null or length(p_billing_email) not between 3 and 254 or p_marketing_opt_in is null then raise exception 'invalid_contact'; end if;
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
    if existing.livemode is distinct from p_livemode or existing.billing_email is distinct from p_billing_email or existing.recipient_email is distinct from p_recipient_email or existing.marketing_opt_in is distinct from p_marketing_opt_in or existing.browser_hash<>p_browser_hash or existing.fingerprint<>p_fingerprint or
       existing.user_id is distinct from p_user_id then raise exception 'attempt_conflict'; end if;
    return to_jsonb(existing);
  end if;
  if (select count(*) from public.checkout_orders where ip_hash=p_ip_hash and created_at>now()-interval '1 hour')>=15 then
    raise exception 'checkout_rate_limit';
  end if;
  perform p.id from jsonb_array_elements(p_lines) l
  join public.catalog_plans p on p.id=l->>'planId' and p.destination_slug=l->>'destination'
  join public.catalog_destinations d on d.slug=p.destination_slug
  join public.stripe_catalog_prices s on s.plan_id=p.id and s.livemode=p_livemode
  for share of p,d,s;
  select count(*),sum(p.retail_price_cents * (l->>'quantity')::bigint) into matched,total
  from jsonb_array_elements(p_lines) l
  join public.catalog_plans p on p.id=l->>'planId' and p.destination_slug=l->>'destination'
  join public.catalog_destinations d on d.slug=p.destination_slug
  join public.stripe_catalog_prices s on s.plan_id=p.id and s.livemode=p_livemode and s.amount_cents=p.retail_price_cents
  where p.is_published and d.is_published and p.kind='fixed';
  if matched<>line_count or total is null then raise exception 'unavailable_plan'; end if;
  if total<>p_expected_total or total>99999999 then raise exception 'price_changed'; end if;
  if p_livemode and exists (
    select 1 from jsonb_array_elements(p_lines) l left join public.provider_package_bindings b on b.plan_id=l->>'planId'
    where b.plan_id is null or b.is_available is not true
  ) then raise exception 'unavailable_plan'; end if;
  insert into public.checkout_orders(id,user_id,recipient_email,browser_hash,ip_hash,fingerprint,locale,amount_total,livemode,billing_email,marketing_opt_in,marketing_opt_in_at,marketing_consent_version,checkout_ui_mode)
    values(p_id,p_user_id,p_recipient_email,p_browser_hash,p_ip_hash,p_fingerprint,p_locale,total,p_livemode,p_billing_email,p_marketing_opt_in,case when p_marketing_opt_in then now() else null end,case when p_marketing_opt_in then 'mytripsim-news-v1' else null end,'elements');
  insert into public.checkout_order_items(order_id,plan_id,destination_slug,destination_name,plan_name,data_gb,days,quantity,unit_amount,stripe_price_id)
  select p_id,p.id,p.destination_slug,d.name,p.name,p.data_gb,p.days,(l->>'quantity')::integer,p.retail_price_cents,s.price_id
  from jsonb_array_elements(p_lines) l
  join public.catalog_plans p on p.id=l->>'planId' and p.destination_slug=l->>'destination'
  join public.catalog_destinations d on d.slug=p.destination_slug
  join public.stripe_catalog_prices s on s.plan_id=p.id and s.livemode=p_livemode;
  select * into existing from public.checkout_orders where id=p_id;
  return to_jsonb(existing);
end;
$$;

revoke all on function public.create_checkout_v3(boolean,uuid,uuid,text,text,boolean,text,text,text,text,integer,jsonb) from public,anon,authenticated;
grant execute on function public.create_checkout_v3(boolean,uuid,uuid,text,text,boolean,text,text,text,text,integer,jsonb) to service_role;
-- Legacy test RPCs must remain isolated after introducing a second price binding per plan.
create or replace function public.create_test_checkout(
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
  join public.stripe_catalog_prices s on s.plan_id=p.id and not s.livemode
  for share of p,d,s;
  select count(*),sum(p.retail_price_cents * (l->>'quantity')::bigint) into matched,total
  from jsonb_array_elements(p_lines) l
  join public.catalog_plans p on p.id=l->>'planId' and p.destination_slug=l->>'destination'
  join public.catalog_destinations d on d.slug=p.destination_slug
  join public.stripe_catalog_prices s on s.plan_id=p.id and not s.livemode and s.amount_cents=p.retail_price_cents and not s.livemode
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
  join public.stripe_catalog_prices s on s.plan_id=p.id and not s.livemode;
  select * into existing from public.checkout_orders where id=p_id;
  return to_jsonb(existing);
end;
$$;

create function public.record_checkout_event_v2(p_livemode boolean,p_event_id text,p_event_type text,p_order_id uuid,p_session_id text,p_status text,p_amount integer,p_currency text,p_payment_intent text) returns text language plpgsql security definer set search_path='' as $$
declare existing public.checkout_orders;
begin
 select * into existing from public.checkout_orders where id=p_order_id for update;
 if not found or p_livemode is null or existing.livemode is distinct from p_livemode then raise exception 'payment_mismatch'; end if;
 return public.record_test_checkout_event(p_event_id,p_event_type,p_order_id,p_session_id,p_status,p_amount,p_currency,p_payment_intent);
end;
$$;
revoke all on function public.record_checkout_event_v2(boolean,text,text,uuid,text,text,integer,text,text) from public,anon,authenticated;
grant execute on function public.record_checkout_event_v2(boolean,text,text,uuid,text,text,integer,text,text) to service_role;
commit;
