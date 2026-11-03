-- Coupons must be independent of the SimCoins activation flags. Share the
-- existing provider lease/cooldown without enabling rewards or altering prices.
begin;
create function public.promotion_claim_cost_refresh() returns uuid
language plpgsql security definer set search_path='' as $$
declare r public.simcoins_cost_refresh;t uuid:=gen_random_uuid();
begin
 select * into r from public.simcoins_cost_refresh where id for update;
 if not found or r.lease_until>now() or r.last_started_at>now()-interval '1 minute' then return null;end if;
 update public.simcoins_cost_refresh set lease_token=t,lease_until=now()+interval '60 seconds',last_started_at=now() where id;
 return t;
end;$$;
revoke all on function public.promotion_claim_cost_refresh() from public,anon,authenticated;
grant execute on function public.promotion_claim_cost_refresh() to service_role;
commit;
