-- Direct database scheduling avoids forwarding a bearer credential through HTTP.
-- Configuration is explicit after deployment; migrations never enable a worker.
begin;
create function public.configure_simcoins_worker() returns boolean
language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.simcoins_program_settings where id and enabled) then
  raise exception 'simcoins_disabled';
 end if;
 perform cron.schedule('mts-simcoins-release','*/5 * * * *','select public.simcoins_release_due(100)');
 return true;
end;$$;
revoke all on function public.configure_simcoins_worker() from public,anon,authenticated;
grant execute on function public.configure_simcoins_worker() to service_role;
commit;
