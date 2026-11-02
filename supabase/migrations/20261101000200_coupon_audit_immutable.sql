-- Keep the coupon administrative and reservation journal append-only.
begin;
create function public.coupon_audit_immutable()returns trigger language plpgsql security definer set search_path='' as $$begin raise exception 'coupon_audit_immutable';end;$$;
create trigger coupon_audit_immutable before update or delete on public.coupon_audit_logs for each row execute function public.coupon_audit_immutable();
revoke update,delete on public.coupon_audit_logs from public,anon,authenticated,service_role;
revoke all on function public.coupon_audit_immutable()from public,anon,authenticated;
grant execute on function public.coupon_audit_immutable()to service_role;
commit;
