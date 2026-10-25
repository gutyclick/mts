begin;
alter table public.checkout_orders
  add column billing_email text check (billing_email is null or length(billing_email) between 3 and 254),
  add column marketing_opt_in boolean not null default false,
  add column marketing_opt_in_at timestamptz,
  add column marketing_consent_version text,
  add column checkout_ui_mode text not null default 'hosted_page' check (checkout_ui_mode in ('hosted_page','elements')),
  add constraint checkout_marketing_consent_consistent check (
    (not marketing_opt_in and marketing_opt_in_at is null and marketing_consent_version is null) or
    (marketing_opt_in and marketing_opt_in_at is not null and marketing_consent_version='mytripsim-news-v1')
  );
-- Existing orders used the same address for billing and delivery. Keep their semantics intact.
update public.checkout_orders set billing_email=recipient_email where billing_email is null;
-- New columns inherit no client column-level SELECT grants. They remain server-only.
create function public.create_test_checkout_v2(
  p_id uuid,p_user_id uuid,p_billing_email text,p_recipient_email text,p_marketing_opt_in boolean,
  p_browser_hash text,p_ip_hash text,p_fingerprint text,p_locale text,p_expected_total integer,p_lines jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
  if p_billing_email is null or length(p_billing_email) not between 3 and 254 or p_marketing_opt_in is null then
    raise exception 'invalid_contact';
  end if;
  result := public.create_test_checkout(p_id,p_user_id,p_recipient_email,p_browser_hash,p_ip_hash,p_fingerprint,p_locale,p_expected_total,p_lines);
  -- Only the initial request can set these values. The underlying function locks the
  -- order and validates the fingerprint and browser on every duplicate request.
  update public.checkout_orders set billing_email=p_billing_email,
    marketing_opt_in=p_marketing_opt_in,
    marketing_opt_in_at=case when p_marketing_opt_in then now() else null end,
    marketing_consent_version=case when p_marketing_opt_in then 'mytripsim-news-v1' else null end,
    checkout_ui_mode='elements'
    where id=p_id and billing_email is null and status='pending';
  select to_jsonb(o) into result from public.checkout_orders o where id=p_id;
  if result->>'checkout_ui_mode'<>'elements' then raise exception 'attempt_conflict'; end if;
  if result->>'billing_email' is distinct from p_billing_email or
     result->>'recipient_email' is distinct from p_recipient_email or
     (result->>'marketing_opt_in')::boolean is distinct from p_marketing_opt_in then raise exception 'attempt_conflict'; end if;
  return result;
end;
$$;
revoke all on function public.create_test_checkout_v2(uuid,uuid,text,text,boolean,text,text,text,text,integer,jsonb) from public,anon,authenticated;
grant execute on function public.create_test_checkout_v2(uuid,uuid,text,text,boolean,text,text,text,text,integer,jsonb) to service_role;
commit;
