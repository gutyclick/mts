begin;
-- pg_net's request queue contains authorization headers until requests are sent.
-- Cron runs as the database owner; customer roles never need to read this queue.
revoke all on net.http_request_queue,net._http_response from public,anon,authenticated;
commit;
