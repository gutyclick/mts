begin;
alter table public.pricing_campaign_changes drop constraint pricing_campaign_changes_check;
alter table public.pricing_campaign_changes add constraint pricing_campaign_changes_whole_changed_price check(new_cents<>old_cents and new_cents>0 and new_cents%100=0);
create table public.commercial_price_revision_batches(campaign text primary key,source_sha256 text not null check(source_sha256~'^[a-f0-9]{64}$'),excluded_ids text[] not null,expected_count integer not null check(expected_count between 1 and 2000),created_at timestamptz not null default now());
alter table public.commercial_price_revision_batches enable row level security;
revoke all on public.commercial_price_revision_batches from public,anon,authenticated;
grant select,insert on public.commercial_price_revision_batches to service_role;
create function public.apply_commercial_price_revision(p_campaign text,p_changes jsonb,p_excluded text[],p_source_sha256 text) returns integer
language plpgsql security invoker set search_path='' as $$
declare e jsonb;r record;prior public.pricing_campaign_changes%rowtype;n integer:=0;old_live text;old_test text;
begin
 if p_source_sha256 is null or p_source_sha256 !~ '^[a-f0-9]{64}$' or p_excluded is null or exists(select 1 from unnest(p_excluded) x where x is null or length(x) not between 1 and 200) then raise exception 'Invalid approval';end if;
 perform pg_advisory_xact_lock(hashtext(p_campaign));
 if exists(select 1 from public.commercial_price_revision_batches where campaign=p_campaign and (source_sha256<>p_source_sha256 or excluded_ids is distinct from p_excluded or expected_count<>jsonb_array_length(p_changes)))then raise exception 'Approval replay mismatch';end if;
 if exists(select 1 from jsonb_array_elements(p_changes) v where v->>'plan_id'=any(p_excluded))then raise exception 'Excluded plan';end if;
 insert into public.commercial_price_revision_batches(campaign,source_sha256,excluded_ids,expected_count)values(p_campaign,p_source_sha256,p_excluded,jsonb_array_length(p_changes))on conflict(campaign)do nothing;
 if p_campaign is null or p_campaign!~'^[a-z0-9-]{1,80}$' or jsonb_typeof(p_changes) is distinct from 'array' or jsonb_array_length(p_changes) not between 1 and 2000 then raise exception 'Invalid campaign';end if;
 if exists(select 1 from jsonb_array_elements(p_changes) v where jsonb_typeof(v) is distinct from 'object' or v-array['plan_id','old_cents','new_cents','product_id','live_price_id','test_price_id']<>'{}'::jsonb or not(v?&array['plan_id','old_cents','new_cents','product_id','live_price_id','test_price_id'])) then raise exception 'Invalid campaign fields';end if;
 if (select count(distinct v->>'plan_id') from jsonb_array_elements(p_changes) v)<>jsonb_array_length(p_changes) then raise exception 'Duplicate plan';end if;
 for e in select value from jsonb_array_elements(p_changes) order by value->>'plan_id' loop
  if (e->>'old_cents')!~'^[0-9]{1,9}$' or (e->>'new_cents')!~'^[0-9]{1,9}$' or (e->>'old_cents')::integer not between 1 and 99999999 or (e->>'new_cents')::integer not between 1 and 99999999 or (e->>'new_cents')::integer=(e->>'old_cents')::integer or (e->>'new_cents')::integer%100<>0 or coalesce(e->>'live_price_id','')!~'^price_[A-Za-z0-9]+$' or coalesce(e->>'test_price_id','')!~'^price_[A-Za-z0-9]+$' then raise exception 'Invalid campaign prices';end if;
  select * into r from public.catalog_plans where id=e->>'plan_id' for update;
  if not found or r.kind<>'fixed' or not r.is_published then raise exception 'Invalid campaign plan';end if;
  select * into prior from public.pricing_campaign_changes where campaign=p_campaign and plan_id=r.id;
  if found then
   if prior.old_cents<>(e->>'old_cents')::integer or prior.new_cents<>(e->>'new_cents')::integer or prior.live_price_id<>e->>'live_price_id' or prior.test_price_id<>e->>'test_price_id' or prior.product_id<>e->>'product_id' then raise exception 'Campaign replay mismatch';end if;
   continue;
  end if;
  if r.retail_price_cents<>(e->>'old_cents')::integer then raise exception 'Campaign baseline changed';end if;
  perform 1 from public.stripe_catalog_prices where plan_id=r.id order by livemode for update;
  if (select count(*) from public.stripe_catalog_prices where plan_id=r.id and product_id=e->>'product_id' and currency='usd' and amount_cents=r.retail_price_cents)<>2 then raise exception 'Campaign binding mismatch';end if;
  select price_id into old_live from public.stripe_catalog_prices where plan_id=r.id and livemode;
  select price_id into old_test from public.stripe_catalog_prices where plan_id=r.id and not livemode;
  update public.catalog_plans set retail_price_cents=(e->>'new_cents')::integer where id=r.id;
  update public.stripe_catalog_prices set amount_cents=(e->>'new_cents')::integer,price_id=case when livemode then e->>'live_price_id' else e->>'test_price_id' end,updated_at=now() where plan_id=r.id;
  insert into public.pricing_campaign_changes(campaign,plan_id,old_cents,new_cents,product_id,old_live_price_id,old_test_price_id,live_price_id,test_price_id) values(p_campaign,r.id,(e->>'old_cents')::integer,(e->>'new_cents')::integer,e->>'product_id',old_live,old_test,e->>'live_price_id',e->>'test_price_id');
  n:=n+1;
 end loop;
 return n;
end;$$;
revoke all on function public.apply_commercial_price_revision(text,jsonb,text[],text) from public,anon,authenticated;
grant execute on function public.apply_commercial_price_revision(text,jsonb,text[],text) to service_role;
commit;
