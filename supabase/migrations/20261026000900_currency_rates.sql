begin;
create table public.fx_snapshots(id uuid primary key default gen_random_uuid(),provider_ref text not null unique,rates jsonb not null,sampled_at timestamptz not null,created_at timestamptz not null default now(),expires_at timestamptz not null default(now()+interval '24 hours'));
create index fx_snapshots_latest_idx on public.fx_snapshots(created_at desc);
create table public.fx_refresh(id boolean primary key default true check(id),lease_token uuid,lease_until timestamptz,last_started_at timestamptz);
insert into public.fx_refresh(id)values(true);
alter table public.fx_snapshots enable row level security;alter table public.fx_refresh enable row level security;
revoke all on public.fx_snapshots,public.fx_refresh from public,anon,authenticated,service_role;
grant select on public.fx_snapshots to service_role;
create function public.fx_currency(p_currency text)returns boolean language sql immutable set search_path='' as $$select p_currency=any(array['USD','EUR','GBP','CAD','CHF','AUD','MXN','COP','ARS','CLP','DOP','UYU','BRL','KRW','CNY','JPY','PEN','DKK'])$$;
create function public.fx_convert_minor(p_usd integer,p_currency text,p_rate text)returns integer language plpgsql immutable set search_path='' as $$
declare amount numeric;minor integer;
begin
 if p_currency is null or not public.fx_currency(p_currency)then raise exception 'invalid_currency';end if;
 if p_usd is null or p_usd<0 or p_rate is null or p_rate!~'^[0-9]{1,16}$' then raise exception 'invalid_rate';end if;
 if p_rate::numeric not between 1 and 1000000000000000 or(p_currency='USD'and p_rate<>'10000000000')then raise exception 'invalid_rate';end if;
 minor:=case when p_currency in('JPY','KRW','CLP')then 1 else 100 end;
 amount:=round(p_usd::numeric*p_rate::numeric*minor/100/10000000000);
 if amount>99999999 then raise exception 'amount_out_of_bounds';end if;return amount::integer;
end;$$;
create function public.fx_claim_refresh()returns uuid language plpgsql security definer set search_path='' as $$
declare setting public.fx_refresh;t uuid:=gen_random_uuid();
begin
 select * into setting from public.fx_refresh where id for update;
 if setting.lease_until>now()or setting.last_started_at>now()-interval '1 minute'or exists(select 1 from public.fx_snapshots where created_at>now()-interval '1 hour')then return null;end if;
 update public.fx_refresh set lease_token=t,lease_until=now()+interval '30 seconds',last_started_at=now()where id;return t;
end;$$;
create function public.fx_release_refresh(p_token uuid)returns void language sql security definer set search_path='' as $$update public.fx_refresh set lease_token=null,lease_until=null where id and lease_token=p_token$$;
create function public.fx_store_snapshot(p_token uuid,p_provider text,p_sampled timestamptz,p_rates jsonb)returns uuid language plpgsql security definer set search_path='' as $$
declare pair record;new_id uuid;
begin
 perform 1 from public.fx_refresh where id and lease_token=p_token and lease_until>now()for update;if not found then raise exception 'lease_expired';end if;
 if p_provider is null or p_provider!~'^fxq_[A-Za-z0-9]+$'or p_sampled is null or p_sampled>now()+interval '5 minutes'or p_sampled<now()-interval '10 minutes'then raise exception 'invalid_quote';end if;
 if p_rates is null or jsonb_typeof(p_rates)<>'object'or(select count(*)from jsonb_object_keys(p_rates))<>18 or p_rates->>'USD'<>'10000000000'then raise exception 'invalid_rates';end if;
 for pair in select key,value from jsonb_each(p_rates)loop
  if not public.fx_currency(pair.key)or jsonb_typeof(pair.value)<>'string'or(pair.value#>>'{}')!~'^[0-9]{1,16}$'then raise exception 'invalid_rates';end if;
  if(pair.value#>>'{}')::numeric not between 1 and 1000000000000000 then raise exception 'invalid_rates';end if;
 end loop;
 insert into public.fx_snapshots(provider_ref,rates,sampled_at)values(p_provider,p_rates,p_sampled)on conflict(provider_ref)do nothing returning id into new_id;
 if new_id is null then select id into new_id from public.fx_snapshots where provider_ref=p_provider;end if;
 perform public.fx_release_refresh(p_token);return new_id;
end;$$;
revoke all on function public.fx_currency(text),public.fx_convert_minor(integer,text,text),public.fx_claim_refresh(),public.fx_release_refresh(uuid),public.fx_store_snapshot(uuid,text,timestamptz,jsonb)from public,anon,authenticated;
grant execute on function public.fx_currency(text),public.fx_convert_minor(integer,text,text),public.fx_claim_refresh(),public.fx_release_refresh(uuid),public.fx_store_snapshot(uuid,text,timestamptz,jsonb)to service_role;
commit;
