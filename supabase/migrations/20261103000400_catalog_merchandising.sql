begin;
-- Merchandising is independent of provider catalog refreshes; no SKU or price mutation.
create table public.catalog_plan_merchandising (
 plan_id text primary key references public.catalog_plans(id) on delete restrict,
 visibility text not null default 'auto' check (visibility in ('auto','show','hide')),
 commercial_category text check (commercial_category in ('basic','essential','plus','max')),
 recommendation_eligible boolean not null default true,
 incident_block boolean not null default false,
 main_priority integer check(main_priority between 1 and 100),
 updated_at timestamptz not null default now(), updated_by uuid references auth.users(id)
);
create table public.catalog_destination_merchandising (
 destination_slug text primary key references public.catalog_destinations(slug) on delete restrict,
 approved_modalities text[] not null default array['standard'] check (
 cardinality(approved_modalities) between 1 and 3 and
 approved_modalities <@ array['standard','premium','iij','usip','nonhkip','myip']::text[] and
 array_position(approved_modalities,null) is null),
 approval_evidence text not null check(length(trim(approval_evidence)) between 10 and 2000),
 updated_at timestamptz not null default now(), updated_by uuid references auth.users(id)
);
create table public.catalog_merchandising_audit (
 id bigint generated always as identity primary key, actor uuid not null references auth.users(id),
 entity text not null, entity_id text not null, before_value jsonb, after_value jsonb not null,
 created_at timestamptz not null default now()
);
alter table public.catalog_plan_merchandising enable row level security;
alter table public.catalog_destination_merchandising enable row level security;
alter table public.catalog_merchandising_audit enable row level security;
revoke all on public.catalog_plan_merchandising,public.catalog_destination_merchandising,public.catalog_merchandising_audit from public,anon,authenticated,service_role;
grant select on public.catalog_plan_merchandising,public.catalog_destination_merchandising to service_role;
grant select(plan_id,visibility,commercial_category,recommendation_eligible,incident_block,main_priority) on public.catalog_plan_merchandising to anon,authenticated;
create view public.catalog_destination_merchandising_public with (security_barrier=true) as
select m.destination_slug,m.approved_modalities,true as approval_verified
from public.catalog_destination_merchandising m join public.catalog_destinations d on d.slug=m.destination_slug where d.is_published;
revoke all on public.catalog_destination_merchandising_public from public,anon,authenticated;
grant select on public.catalog_destination_merchandising_public to anon,authenticated,service_role;
grant select on public.catalog_merchandising_audit to service_role;
create policy published_plan_merchandising on public.catalog_plan_merchandising for select to anon,authenticated using(exists(select 1 from public.catalog_plans p where p.id=plan_id and p.is_published));
create policy published_destination_merchandising on public.catalog_destination_merchandising for select to anon,authenticated using(exists(select 1 from public.catalog_destinations d where d.slug=destination_slug and d.is_published));
create function public.catalog_merchandising_save(p_actor uuid,p_entity text,p_value jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare before_v jsonb; after_v jsonb; entity_id text;
begin
 if not exists(select 1 from public.admin_memberships where user_id=p_actor) then raise exception 'admin_required'; end if;
 if p_value is null or jsonb_typeof(p_value)<>'object' then raise exception 'invalid_configuration'; end if;
 if p_entity='plan' then
  if p_value-array['plan_id','visibility','commercial_category','recommendation_eligible','incident_block','main_priority'] <> '{}'::jsonb then raise exception 'invalid_configuration'; end if;
  entity_id:=p_value->>'plan_id';
  perform 1 from public.catalog_plans where id=entity_id for update;
  if not found then raise exception 'unknown_plan'; end if;
  select to_jsonb(m) into before_v from public.catalog_plan_merchandising m where plan_id=entity_id;
  insert into public.catalog_plan_merchandising(plan_id,visibility,commercial_category,recommendation_eligible,incident_block,main_priority,updated_by)
  values(entity_id,p_value->>'visibility',p_value->>'commercial_category',(p_value->>'recommendation_eligible')::boolean,(p_value->>'incident_block')::boolean,(p_value->>'main_priority')::integer,p_actor)
  on conflict(plan_id) do update set visibility=excluded.visibility,commercial_category=excluded.commercial_category,recommendation_eligible=excluded.recommendation_eligible,incident_block=excluded.incident_block,main_priority=excluded.main_priority,updated_at=now(),updated_by=p_actor
  returning to_jsonb(catalog_plan_merchandising.*) into after_v;
 elsif p_entity='destination' then
  if p_value-array['destination_slug','approved_modalities','approval_evidence'] <> '{}'::jsonb then raise exception 'invalid_configuration'; end if;
  entity_id:=p_value->>'destination_slug';
  perform 1 from public.catalog_destinations where slug=entity_id for update;
  if not found then raise exception 'unknown_destination'; end if;
  select to_jsonb(m) into before_v from public.catalog_destination_merchandising m where destination_slug=entity_id;
  if jsonb_typeof(p_value->'approved_modalities') is distinct from 'array' then raise exception 'invalid_modalities'; end if;
  if (select count(*)<>count(distinct value) from jsonb_array_elements_text(p_value->'approved_modalities')) then raise exception 'duplicate_modalities'; end if;
  insert into public.catalog_destination_merchandising(destination_slug,approved_modalities,approval_evidence,updated_by)
  values(entity_id,array(select jsonb_array_elements_text(p_value->'approved_modalities')),p_value->>'approval_evidence',p_actor)
  on conflict(destination_slug) do update set approved_modalities=excluded.approved_modalities,approval_evidence=excluded.approval_evidence,updated_at=now(),updated_by=p_actor
  returning to_jsonb(catalog_destination_merchandising.*) into after_v;
 else raise exception 'invalid_entity'; end if;
 insert into public.catalog_merchandising_audit(actor,entity,entity_id,before_value,after_value) values(p_actor,p_entity,entity_id,before_v,after_v);
 return after_v;
end;$$;
revoke all on function public.catalog_merchandising_save(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.catalog_merchandising_save(uuid,text,jsonb) to service_role;
-- Block explicit commercial withdrawals at new-order creation and payment preparation.
create function public.catalog_assert_order_available(p_order uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.checkout_order_items i join public.catalog_plan_merchandising m on m.plan_id=i.plan_id where i.order_id=p_order and (m.incident_block or m.visibility='hide')) then raise exception 'catalog_plan_unavailable'; end if;
end;$$;
create function public.catalog_guard_new_item() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.catalog_plan_merchandising m where m.plan_id=new.plan_id and(m.incident_block or m.visibility='hide')) then raise exception 'catalog_plan_unavailable';end if;
 return new;
end;$$;
create trigger catalog_guard_new_item before insert on public.checkout_order_items for each row execute function public.catalog_guard_new_item();
alter function public.prepare_checkout_payment(uuid,text,uuid,integer) rename to catalog_original_prepare_checkout_payment;
revoke all on function public.catalog_original_prepare_checkout_payment(uuid,text,uuid,integer) from public,anon,authenticated,service_role;
create function public.prepare_checkout_payment(p_id uuid,p_currency text,p_quote uuid,p_expected integer) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform public.catalog_assert_order_available(p_id);
 return public.catalog_original_prepare_checkout_payment(p_id,p_currency,p_quote,p_expected);
end;$$;
alter function public.coupon_prepare_payment(uuid,text,uuid,text,uuid,integer) rename to catalog_original_coupon_prepare_payment;
revoke all on function public.catalog_original_coupon_prepare_payment(uuid,text,uuid,text,uuid,integer) from public,anon,authenticated,service_role;
create function public.coupon_prepare_payment(p_order uuid,p_identity text,p_quote uuid,p_currency text,p_fx_quote uuid,p_expected integer) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform public.catalog_assert_order_available(p_order);
 return public.catalog_original_coupon_prepare_payment(p_order,p_identity,p_quote,p_currency,p_fx_quote,p_expected);
end;$$;
revoke all on function public.catalog_assert_order_available(uuid),public.catalog_guard_new_item(),public.prepare_checkout_payment(uuid,text,uuid,integer),public.coupon_prepare_payment(uuid,text,uuid,text,uuid,integer) from public,anon,authenticated;
grant execute on function public.prepare_checkout_payment(uuid,text,uuid,integer),public.coupon_prepare_payment(uuid,text,uuid,text,uuid,integer) to service_role;
-- Owner-executed security-barrier projection deliberately releases only a public SKU.
create view public.catalog_available_plan_ids with (security_barrier=true) as
select p.id from public.catalog_plans p
join public.provider_package_bindings b on b.plan_id=p.id
where p.is_published and b.is_available and b.provider_slug=p.id and b.days=p.days;
revoke all on public.catalog_available_plan_ids from public,anon,authenticated;
grant select on public.catalog_available_plan_ids to anon,authenticated,service_role;
commit;




