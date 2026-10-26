begin;
-- Read-only operational status also prevents isolated fixture tests from
-- queuing test messages while production notifications are running.
create function public.support_worker_running() returns boolean language sql security definer set search_path='' as $$
 select exists(select 1 from cron.job where jobname='mts-support-notifications' and active);
$$;
revoke all on function public.support_worker_running() from public,anon,authenticated;
grant execute on function public.support_worker_running() to service_role;
commit;
