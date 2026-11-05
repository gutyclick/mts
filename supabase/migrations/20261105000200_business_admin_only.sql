begin;
-- Preserve historical applications/invitations but close every self-service entry.
create or replace function public.b2b_apply(p_name text,p_website text,p_note text) returns uuid language plpgsql security definer set search_path='' as $$begin raise exception 'admin_only';end;$$;
create or replace function public.b2b_invite(p_company uuid,p_email text,p_role text) returns uuid language plpgsql security definer set search_path='' as $$begin raise exception 'admin_only';end;$$;
create or replace function public.b2b_accept_invitation(p_id uuid) returns uuid language plpgsql security definer set search_path='' as $$begin raise exception 'admin_only';end;$$;
revoke all on function public.b2b_apply(text,text,text),public.b2b_invite(uuid,text,text),public.b2b_accept_invitation(uuid) from public,anon,authenticated,service_role;

create function public.b2b_admin_company_create(p_actor uuid,p_id uuid,p_name text,p_email text) returns uuid language plpgsql security definer set search_path='' as $$
declare owner_id uuid;previous public.b2b_organizations;
begin
 if not exists(select 1 from public.admin_memberships where user_id=p_actor) then raise exception 'admin_required';end if;
 select id into owner_id from auth.users where lower(email)=lower(btrim(p_email)) and email_confirmed_at is not null;
 if owner_id is null then raise exception 'verified_account_required';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('b2b-company:'||p_id::text,0));
 select * into previous from public.b2b_organizations where id=p_id for update;
 if previous.id is not null then
  if previous.name<>btrim(p_name) or not exists(select 1 from public.b2b_memberships where company_id=p_id and user_id=owner_id and role='owner') then raise exception 'conflict';end if;return p_id;
 end if;
 insert into public.b2b_organizations(id,name) values(p_id,btrim(p_name));
 insert into public.b2b_memberships(company_id,user_id,role) values(p_id,owner_id,'owner');
 insert into public.b2b_audit_logs(company_id,actor,action,entity_id,after_value) values(p_id,p_actor,'admin_create_company',p_id,jsonb_build_object('owner_id',owner_id,'name',btrim(p_name)));
 return p_id;
end;$$;
create function public.b2b_admin_member_add(p_actor uuid,p_company uuid,p_email text,p_role text) returns uuid language plpgsql security definer set search_path='' as $$
declare member_id uuid;previous_role text;
begin
 if not exists(select 1 from public.admin_memberships where user_id=p_actor) then raise exception 'admin_required';end if;
 if p_role is null or p_role not in ('owner','coordinator','finance') then raise exception 'role_required';end if;
 perform 1 from public.b2b_organizations where id=p_company and status='active' for update;
 if not found then raise exception 'company_required';end if;
 select id into member_id from auth.users where lower(email)=lower(btrim(p_email)) and email_confirmed_at is not null;
 if member_id is null then raise exception 'verified_account_required';end if;
 select role into previous_role from public.b2b_memberships where company_id=p_company and user_id=member_id;
 if previous_role is not null then if previous_role<>p_role then raise exception 'conflict';end if;return member_id;end if;
 insert into public.b2b_memberships(company_id,user_id,role) values(p_company,member_id,p_role);
 insert into public.b2b_audit_logs(company_id,actor,action,entity_id,after_value) values(p_company,p_actor,'admin_add_member',member_id,jsonb_build_object('role',p_role));
 return member_id;
end;$$;
alter function public.b2b_admin_action(uuid,text,jsonb) rename to b2b_admin_legacy_action;
revoke all on function public.b2b_admin_legacy_action(uuid,text,jsonb) from public,anon,authenticated,service_role;
create function public.b2b_admin_action(p_actor uuid,p_action text,p_value jsonb) returns uuid language plpgsql security definer set search_path='' as $$
begin
 if p_action='create_company' then return public.b2b_admin_company_create(p_actor,(p_value->>'id')::uuid,p_value->>'name',p_value->>'email');
 elsif p_action='add_member' then return public.b2b_admin_member_add(p_actor,(p_value->>'companyId')::uuid,p_value->>'email',p_value->>'role');
 elsif p_action in ('review_request','company_status') then return public.b2b_admin_legacy_action(p_actor,p_action,p_value);
 else raise exception 'admin_only';end if;
end;$$;
alter function public.b2b_admin_records(uuid) rename to b2b_admin_legacy_records;
revoke all on function public.b2b_admin_legacy_records(uuid) from public,anon,authenticated,service_role;
create function public.b2b_admin_records(p_actor uuid) returns jsonb language sql stable security definer set search_path='' as $$select public.b2b_admin_legacy_records(p_actor)-'applications';$$;
revoke all on function public.b2b_admin_company_create(uuid,uuid,text,text),public.b2b_admin_member_add(uuid,uuid,text,text),public.b2b_admin_action(uuid,text,jsonb),public.b2b_admin_records(uuid) from public,anon,authenticated;
grant execute on function public.b2b_admin_company_create(uuid,uuid,text,text),public.b2b_admin_member_add(uuid,uuid,text,text),public.b2b_admin_action(uuid,text,jsonb),public.b2b_admin_records(uuid) to service_role;
commit;
