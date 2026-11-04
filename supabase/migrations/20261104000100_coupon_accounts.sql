-- Account eligibility is checked before quote/details work and before replaying any payment snapshot.
-- Keep the email HMAC and user ID limit checks intact so historical usage still counts.
begin;
create function public.coupon_assert_account(p_user uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 if p_user is null or not exists(select 1 from auth.users where id=p_user and email_confirmed_at is not null and nullif(trim(email),'') is not null) then
  raise exception 'account_required';
 end if;
end;$$;
revoke all on function public.coupon_assert_account(uuid) from public,anon,authenticated,service_role;
alter function public.coupon_create_quote(text,text,uuid,jsonb,text,uuid,text) rename to accounts_original_coupon_create_quote;
revoke all on function public.accounts_original_coupon_create_quote(text,text,uuid,jsonb,text,uuid,text) from public,anon,authenticated,service_role;
create function public.coupon_create_quote(p_code text,p_identity text,p_user uuid,p_lines jsonb,p_currency text,p_fx_quote uuid,p_rate_key text) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 perform public.coupon_assert_account(p_user);
 return public.accounts_original_coupon_create_quote(p_code,p_identity,p_user,p_lines,p_currency,p_fx_quote,p_rate_key);
end;$$;
alter function public.coupon_lookup_details(text,text,uuid,text) rename to accounts_original_coupon_lookup_details;
revoke all on function public.accounts_original_coupon_lookup_details(text,text,uuid,text) from public,anon,authenticated,service_role;
create function public.coupon_lookup_details(p_code text,p_identity text,p_user uuid,p_rate_key text) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 perform public.coupon_assert_account(p_user);
 return public.accounts_original_coupon_lookup_details(p_code,p_identity,p_user,p_rate_key);
end;$$;
alter function public.coupon_prepare_payment(uuid,text,uuid,text,uuid,integer) rename to accounts_original_coupon_prepare_payment;
revoke all on function public.accounts_original_coupon_prepare_payment(uuid,text,uuid,text,uuid,integer) from public,anon,authenticated,service_role;
create function public.coupon_prepare_payment(p_order uuid,p_identity text,p_quote uuid,p_currency text,p_fx_quote uuid,p_expected integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare account_id uuid; quote_user uuid;
begin
 select user_id into account_id from public.checkout_orders where id=p_order for update;
 perform public.coupon_assert_account(account_id);
 select user_id into quote_user from public.coupon_quotes where id=p_quote;
 if quote_user is distinct from account_id then raise exception 'account_required';end if;
 return public.accounts_original_coupon_prepare_payment(p_order,p_identity,p_quote,p_currency,p_fx_quote,p_expected);
end;$$;
revoke all on function public.coupon_create_quote(text,text,uuid,jsonb,text,uuid,text),public.coupon_lookup_details(text,text,uuid,text),public.coupon_prepare_payment(uuid,text,uuid,text,uuid,integer) from public,anon,authenticated;
grant execute on function public.coupon_create_quote(text,text,uuid,jsonb,text,uuid,text),public.coupon_lookup_details(text,text,uuid,text),public.coupon_prepare_payment(uuid,text,uuid,text,uuid,integer) to service_role;
commit;
