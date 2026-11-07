-- Additive, server-only Yappy payment channel. Never backfills historical orders.
begin;
create table public.checkout_yappy_attempts (
 order_id uuid primary key references public.checkout_orders(id),
 provider_ref text not null unique check(provider_ref ~ '^[A-Za-z0-9]{15}$'),
 transaction_id text unique,
 expected_amount_cents integer not null check(expected_amount_cents>0),
 livemode boolean not null,domain text not null check(domain ~ '^https://[^/]+/?$'),
 state text not null default 'creating' check(state in ('creating','pending','paid','failed','cancelled','expired','review')),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table public.checkout_yappy_events (
 provider_ref text not null references public.checkout_yappy_attempts(provider_ref),
 status text not null check(status in ('E','R','C','X')),
 received_at timestamptz not null default now(),
 primary key(provider_ref,status)
);
alter table public.checkout_yappy_attempts enable row level security;
alter table public.checkout_yappy_events enable row level security;
revoke all on public.checkout_yappy_attempts,public.checkout_yappy_events from public,anon,authenticated;
grant select,insert,update on public.checkout_yappy_attempts to service_role;
grant select,insert on public.checkout_yappy_events to service_role;

create function public.retail_yappy_claim(p_order uuid,p_ref text,p_amount integer,p_domain text,p_live boolean) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare o public.checkout_orders;a public.checkout_yappy_attempts;
begin
 select * into o from public.checkout_orders where id=p_order for update;
 if not found or o.status<>'pending' or o.stripe_session_id is not null or o.livemode is distinct from p_live or o.payment_currency is distinct from 'USD' or o.payment_total is distinct from p_amount
 or (o.expires_at is not null and o.expires_at<=now()) then raise exception 'yappy_order_ineligible';end if;
 if not exists(select 1 from public.checkout_legal_acceptances where order_id=o.id) then raise exception 'terms_required';end if;
 select * into a from public.checkout_yappy_attempts where order_id=o.id;
 if found then raise exception 'yappy_payment_pending';end if;
 insert into public.checkout_yappy_attempts(order_id,provider_ref,expected_amount_cents,livemode,domain)
 values(o.id,p_ref,p_amount,p_live,p_domain) returning * into a;
 update public.checkout_orders set payment_in_progress=true,payment_hold_expires_at=now()+interval '5 minutes' where id=o.id;
 return to_jsonb(a);
end;$$;

create function public.retail_yappy_bind(p_order uuid,p_ref text,p_transaction text) returns boolean
language plpgsql security invoker set search_path='' as $$
declare a public.checkout_yappy_attempts;
begin
 select * into a from public.checkout_yappy_attempts where order_id=p_order for update;
 if not found or a.provider_ref is distinct from p_ref or coalesce(length(p_transaction),0) not between 1 and 256
 or (a.transaction_id is not null and a.transaction_id<>p_transaction) then raise exception 'yappy_binding_conflict';end if;
 update public.checkout_yappy_attempts set transaction_id=p_transaction,state=case when state='creating' then 'pending' else state end,updated_at=now() where order_id=p_order;
 return true;
end;$$;

-- Callable only after the backend verifies the provider's domain-specific HMAC.
create function public.retail_yappy_settle(p_ref text,p_status text,p_domain text,p_live boolean) returns text
language plpgsql security invoker set search_path='' as $$
declare a public.checkout_yappy_attempts;o public.checkout_orders;n integer;next_state text;
begin
 -- Order-before-attempt lock order matches claim and preparation paths.
 select * into a from public.checkout_yappy_attempts where provider_ref=p_ref;
 if not found then raise exception 'yappy_unknown_order';end if;
 select * into o from public.checkout_orders where id=a.order_id for update;
 select * into a from public.checkout_yappy_attempts where provider_ref=p_ref for update;
 if p_status is null or p_status not in ('E','R','C','X') or a.domain is distinct from p_domain or a.livemode is distinct from p_live or o.livemode is distinct from a.livemode
 or o.payment_currency is distinct from 'USD' or o.payment_total is distinct from a.expected_amount_cents or o.stripe_session_id is not null then raise exception 'yappy_payment_mismatch';end if;
 insert into public.checkout_yappy_events(provider_ref,status) values(p_ref,p_status) on conflict do nothing;
 get diagnostics n=row_count;if n=0 then return 'duplicate';end if;
 -- A signed success wins over an earlier rejection/expiry, never the reverse.
 if a.state='paid' or o.status='paid' then return 'already_paid';end if;
 next_state:=case p_status when 'E' then 'paid' when 'R' then 'failed' when 'C' then 'cancelled' else 'expired' end;
 update public.checkout_yappy_attempts set state=next_state,updated_at=now() where order_id=a.order_id;
 update public.checkout_orders set status=next_state,payment_in_progress=false,
 paid_at=case when next_state='paid' then now() else paid_at end where id=a.order_id;
 -- Existing paid-order triggers enqueue delivery and settle promotional reservations.
 return next_state;
end;$$;

create function public.retail_yappy_review(p_order uuid) returns boolean
language plpgsql security invoker set search_path='' as $$
begin
 update public.checkout_yappy_attempts set state='review',updated_at=now() where order_id=p_order and state='creating';
 return found;
end;$$;

create function public.retail_yappy_preparation_failed(p_order uuid) returns boolean
language plpgsql security invoker set search_path='' as $$
declare o public.checkout_orders;
begin
 select * into o from public.checkout_orders where id=p_order for update;
 if not found or o.status<>'pending' or o.stripe_session_id is not null or exists(select 1 from public.checkout_yappy_attempts where order_id=o.id) then return false;end if;
 update public.checkout_orders set status='failed',payment_in_progress=false where id=o.id;
 return true;
end;$$;
revoke all on function public.retail_yappy_claim(uuid,text,integer,text,boolean),public.retail_yappy_bind(uuid,text,text),public.retail_yappy_settle(text,text,text,boolean),public.retail_yappy_review(uuid),public.retail_yappy_preparation_failed(uuid) from public,anon,authenticated;
grant execute on function public.retail_yappy_claim(uuid,text,integer,text,boolean),public.retail_yappy_bind(uuid,text,text),public.retail_yappy_settle(text,text,text,boolean),public.retail_yappy_review(uuid),public.retail_yappy_preparation_failed(uuid) to service_role;
commit;
