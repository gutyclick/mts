begin;
create table public.checkout_legal_acceptances (
  order_id uuid not null references public.checkout_orders(id) on delete cascade,
  version text not null check (version ~ '^20[0-9]{2}-[01][0-9]-[0-3][0-9]-v[1-9][0-9]*$'),
  locale text not null check (locale in ('es','en')),
  accepted_at timestamptz not null default now(),
  primary key (order_id,version)
);
comment on table public.checkout_legal_acceptances is 'Explicit checkout acceptance of a versioned terms/refund document set and acknowledgement of the associated privacy notice. Not marketing or privacy consent. No retrospective backfill.';
alter table public.checkout_legal_acceptances enable row level security;
revoke all on public.checkout_legal_acceptances from public,anon,authenticated;
grant select,insert on public.checkout_legal_acceptances to service_role;
create function public.protect_checkout_legal_acceptance() returns trigger
language plpgsql set search_path='' as $$
begin
 raise exception 'legal_acceptance_immutable';
end;$$;
create trigger protect_checkout_legal_acceptance before update on public.checkout_legal_acceptances
for each row execute function public.protect_checkout_legal_acceptance();
revoke all on function public.protect_checkout_legal_acceptance() from public,anon,authenticated;
commit;
