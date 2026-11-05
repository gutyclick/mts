begin;

create table public.b2b_organizations (
 id uuid primary key default gen_random_uuid(), name text not null check(length(btrim(name)) between 1 and 120 and name !~ '[[:cntrl:]]'),
 status text not null default 'active' check(status in ('active','suspended')), created_at timestamptz not null default now()
);
create table public.b2b_memberships (
 company_id uuid not null references public.b2b_organizations(id), user_id uuid not null references auth.users(id) on delete cascade,
 role text not null check(role in ('owner','coordinator','finance')), created_at timestamptz not null default now(), primary key(company_id,user_id)
);
create index b2b_memberships_user on public.b2b_memberships(user_id,created_at);
create table public.b2b_applications (
 id uuid primary key default gen_random_uuid(), user_id uuid not null unique references auth.users(id) on delete cascade,
 name text not null check(length(btrim(name)) between 1 and 120 and name !~ '[[:cntrl:]]'), website text not null default '' check(length(website)<=300 and (website='' or website~'^https?://')),
 note text not null default '' check(length(note)<=1000), status text not null default 'pending' check(status in ('pending','approved','rejected')),
 company_id uuid references public.b2b_organizations(id), review_note text check(length(review_note)<=1000), reviewed_by uuid references auth.users(id) on delete set null,
 reviewed_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.b2b_invitations (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.b2b_organizations(id),
 email text not null check(email=lower(btrim(email)) and length(email)<=254 and email~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
 role text not null check(role in ('coordinator','finance')), status text not null default 'pending' check(status in ('pending','accepted','revoked','expired')),
 expires_at timestamptz not null default(now()+interval '7 days'), created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now()
);
create unique index b2b_invitation_pending on public.b2b_invitations(company_id,email) where status='pending';
create index b2b_invitation_recipient on public.b2b_invitations(email,status,expires_at);
create table public.b2b_trips (
 id uuid primary key, company_id uuid not null references public.b2b_organizations(id), created_by uuid references auth.users(id) on delete set null,
 name text not null check(length(btrim(name)) between 1 and 90 and name !~ '[[:cntrl:]]'), destination_slug text not null references public.catalog_destinations(slug),
 departure date not null, return_date date not null check(return_date>=departure), travelers integer not null check(travelers between 1 and 10000),
 mode text not null check(mode in ('individual','package')), version integer not null default 1 check(version>0), created_at timestamptz not null default now(),
 unique(company_id,id)
);
create index b2b_trips_company on public.b2b_trips(company_id,departure,id);
create table public.b2b_order_requests (
 id uuid primary key default gen_random_uuid(), company_id uuid not null, trip_id uuid not null unique,
 attempt_id uuid not null unique, created_by uuid references auth.users(id) on delete set null,
 plan_id text not null references public.catalog_plans(id), plan_name text not null, data_gb numeric not null check(data_gb>0), days integer not null check(days>0),
 quantity integer not null check(quantity between 1 and 10000), status text not null default 'pending' check(status in ('pending','approved','changes')),
 version integer not null default 1 check(version>0), review_note text check(length(review_note)<=1000), reviewed_by uuid references auth.users(id) on delete set null,
 reviewed_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key(company_id,trip_id) references public.b2b_trips(company_id,id)
);
create index b2b_requests_queue on public.b2b_order_requests(status,created_at);
create table public.b2b_audit_logs (
 id bigint generated always as identity primary key, company_id uuid references public.b2b_organizations(id),
 actor uuid references auth.users(id) on delete set null, action text not null, entity_id uuid,
 before_value jsonb, after_value jsonb, created_at timestamptz not null default now()
);
create index b2b_audit_actor_time on public.b2b_audit_logs(actor,created_at);
create table public.b2b_auth_limits (key_hash text primary key check(key_hash~'^[0-9a-f]{64}$'), window_at timestamptz not null default now(), attempts integer not null default 1);

alter table public.b2b_organizations enable row level security;
alter table public.b2b_memberships enable row level security;
alter table public.b2b_applications enable row level security;
alter table public.b2b_invitations enable row level security;
alter table public.b2b_trips enable row level security;
alter table public.b2b_order_requests enable row level security;
alter table public.b2b_audit_logs enable row level security;
alter table public.b2b_auth_limits enable row level security;
revoke all on public.b2b_organizations,public.b2b_memberships,public.b2b_applications,public.b2b_invitations,public.b2b_trips,public.b2b_order_requests,public.b2b_audit_logs,public.b2b_auth_limits from public,anon,authenticated;
grant all on public.b2b_organizations,public.b2b_memberships,public.b2b_applications,public.b2b_invitations,public.b2b_trips,public.b2b_order_requests,public.b2b_audit_logs,public.b2b_auth_limits to service_role;
revoke update,delete,truncate on public.b2b_audit_logs from service_role;
grant usage,select on sequence public.b2b_audit_logs_id_seq to service_role;
grant select on public.b2b_organizations,public.b2b_memberships,public.b2b_applications,public.b2b_invitations,public.b2b_trips,public.b2b_order_requests to authenticated;

create function public.b2b_actor() returns uuid language plpgsql stable security definer set search_path='' as $$
declare actor_id uuid:=auth.uid();
begin
 if actor_id is null or not exists(select 1 from auth.users where id=actor_id and email_confirmed_at is not null) then raise exception 'verified_account_required';end if;
 if exists(select 1 from auth.mfa_factors where user_id=actor_id and status='verified') and coalesce(auth.jwt()->>'aal','aal1')<>'aal2' then raise exception 'mfa_required';end if;
 return actor_id;
end;$$;
create function public.b2b_email() returns text language sql stable security definer set search_path='' as $$select lower(email) from auth.users where id=public.b2b_actor();$$;
create function public.b2b_role(p_company uuid) returns text language sql stable security definer set search_path='' as $$
 select m.role from public.b2b_memberships m join public.b2b_organizations o on o.id=m.company_id where m.user_id=public.b2b_actor() and m.company_id=p_company and o.status='active';
$$;
create policy b2b_company_read on public.b2b_organizations for select to authenticated using(public.b2b_role(id) is not null);
create policy b2b_member_read on public.b2b_memberships for select to authenticated using(public.b2b_role(company_id) is not null and(user_id=auth.uid() or public.b2b_role(company_id)='owner'));
create policy b2b_application_read on public.b2b_applications for select to authenticated using(user_id=public.b2b_actor());
create policy b2b_invitation_read on public.b2b_invitations for select to authenticated using(public.b2b_role(company_id)='owner' or(email=public.b2b_email() and status='pending' and expires_at>now()));
create policy b2b_trip_read on public.b2b_trips for select to authenticated using(public.b2b_role(company_id) is not null);
create policy b2b_request_read on public.b2b_order_requests for select to authenticated using(public.b2b_role(company_id) is not null);

create function public.b2b_guard(p_company uuid,p_roles text[]) returns uuid language plpgsql security definer set search_path='' as $$
declare actor_id uuid:=public.b2b_actor();v_role text;
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('b2b:'||actor_id::text,0));
 if(select count(*) from public.b2b_audit_logs where actor=actor_id and created_at>now()-interval '1 minute')>=60 then raise exception 'rate_limited';end if;
 perform 1 from public.b2b_organizations where id=p_company and status='active' for share;
 if not found then raise exception 'company_required';end if;
 v_role:=public.b2b_role(p_company);
 if v_role is null then raise exception 'company_required';end if;
 if not(v_role=any(p_roles)) then raise exception 'role_required';end if;
 return actor_id;
end;$$;

create function public.b2b_apply(p_name text,p_website text,p_note text) returns uuid language plpgsql security definer set search_path='' as $$
declare actor_id uuid:=public.b2b_actor();result_id uuid;previous public.b2b_applications;
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('b2b:'||actor_id::text,0));
 if exists(select 1 from public.b2b_memberships where user_id=actor_id) then raise exception 'invalid_state';end if;
 select * into previous from public.b2b_applications where user_id=actor_id for update;
 if previous.status in ('approved','pending') then return previous.id;end if;
 insert into public.b2b_applications(user_id,name,website,note) values(actor_id,btrim(p_name),coalesce(p_website,''),coalesce(p_note,''))
 on conflict(user_id) do update set name=excluded.name,website=excluded.website,note=excluded.note,status='pending',review_note=null,reviewed_at=null,reviewed_by=null,updated_at=now() returning id into result_id;
 insert into public.b2b_audit_logs(actor,action,entity_id,before_value) values(actor_id,'application',result_id,case when previous.id is null then null else to_jsonb(previous) end);
 return result_id;
end;$$;

create function public.b2b_invite(p_company uuid,p_email text,p_role text) returns uuid language plpgsql security definer set search_path='' as $$
declare actor_id uuid:=public.b2b_guard(p_company,array['owner']);result_id uuid;
begin
 if p_role is null or p_role not in ('coordinator','finance') then raise exception 'role_required';end if;
 if exists(select 1 from public.b2b_memberships m join auth.users u on u.id=m.user_id where m.company_id=p_company and lower(u.email)=lower(btrim(p_email))) then raise exception 'invalid_state';end if;
 update public.b2b_invitations set status='expired' where company_id=p_company and status='pending' and expires_at<=now();
 select id into result_id from public.b2b_invitations where company_id=p_company and email=lower(btrim(p_email)) and status='pending';
 if result_id is not null then return result_id;end if;
 if(select count(*) from public.b2b_invitations where company_id=p_company and status='pending')>=50 then raise exception 'rate_limited';end if;
 insert into public.b2b_invitations(company_id,email,role,created_by) values(p_company,lower(btrim(p_email)),p_role,actor_id) returning id into result_id;
 insert into public.b2b_audit_logs(company_id,actor,action,entity_id) values(p_company,actor_id,'invite',result_id);
 return result_id;
end;$$;
create function public.b2b_accept_invitation(p_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare actor_id uuid:=public.b2b_actor();invitation public.b2b_invitations;
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('b2b:'||actor_id::text,0));
 select * into invitation from public.b2b_invitations where id=p_id and email=public.b2b_email() for update;
 if invitation.id is null or invitation.status<>'pending' or invitation.expires_at<=now() then raise exception 'invitation_unavailable';end if;
 perform 1 from public.b2b_organizations where id=invitation.company_id and status='active' for share;
 if not found then raise exception 'company_required';end if;
 insert into public.b2b_memberships(company_id,user_id,role) values(invitation.company_id,actor_id,invitation.role) on conflict do nothing;
 update public.b2b_invitations set status='accepted' where id=invitation.id;
 insert into public.b2b_audit_logs(company_id,actor,action,entity_id) values(invitation.company_id,actor_id,'accept_invitation',p_id);
 return invitation.company_id;
end;$$;
create function public.b2b_revoke_invitation(p_company uuid,p_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare actor_id uuid:=public.b2b_guard(p_company,array['owner']);
begin
 update public.b2b_invitations set status='revoked' where id=p_id and company_id=p_company and status='pending';
 if not found then raise exception 'invitation_unavailable';end if;
 insert into public.b2b_audit_logs(company_id,actor,action,entity_id) values(p_company,actor_id,'revoke_invitation',p_id);
end;$$;
create function public.b2b_remove_member(p_company uuid,p_user uuid) returns void language plpgsql security definer set search_path='' as $$
declare actor_id uuid:=public.b2b_guard(p_company,array['owner']);previous public.b2b_memberships;
begin
 select * into previous from public.b2b_memberships where company_id=p_company and user_id=p_user for update;
 if previous.user_id is null or previous.role='owner' then raise exception 'role_required';end if;
 delete from public.b2b_memberships where company_id=p_company and user_id=p_user;
 update public.b2b_invitations set status='revoked' where company_id=p_company and status='pending' and email=(select lower(email) from auth.users where id=p_user);
 insert into public.b2b_audit_logs(company_id,actor,action,entity_id,before_value) values(p_company,actor_id,'remove_member',p_user,to_jsonb(previous));
end;$$;

create function public.b2b_create_trip(p_company uuid,p_id uuid,p_value jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare actor_id uuid:=public.b2b_guard(p_company,array['owner','coordinator']);previous public.b2b_trips;existing_value jsonb;
begin
 if p_value is null or jsonb_typeof(p_value)<>'object' or p_value-array['name','destination','departure','returning','travelers','mode']<>'{}'::jsonb then raise exception 'invalid_trip';end if;
 select * into previous from public.b2b_trips where id=p_id for update;
 if previous.id is not null then
  existing_value:=jsonb_build_object('name',previous.name,'destination',previous.destination_slug,'departure',previous.departure,'returning',previous.return_date,'travelers',previous.travelers,'mode',previous.mode);
  if previous.company_id<>p_company or previous.created_by<>actor_id or existing_value<>p_value then raise exception 'conflict';end if;return p_id;
 end if;
 if(select count(*) from public.b2b_trips where company_id=p_company)>=500 then raise exception 'trip_limit';end if;
 if not exists(select 1 from public.catalog_destinations where slug=p_value->>'destination' and is_published) then raise exception 'invalid_trip';end if;
 insert into public.b2b_trips(id,company_id,created_by,name,destination_slug,departure,return_date,travelers,mode)
 values(p_id,p_company,actor_id,btrim(p_value->>'name'),p_value->>'destination',(p_value->>'departure')::date,(p_value->>'returning')::date,(p_value->>'travelers')::integer,p_value->>'mode');
 insert into public.b2b_audit_logs(company_id,actor,action,entity_id,after_value) values(p_company,actor_id,'create_trip',p_id,p_value);
 return p_id;
end;$$;

create function public.b2b_catalog(p_company uuid,p_destination text) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if public.b2b_role(p_company) is null then raise exception 'company_required';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'data_gb',p.data_gb,'days',p.days) order by p.data_gb,p.days,p.id)
 from public.catalog_plans p join public.catalog_destinations d on d.slug=p.destination_slug join public.catalog_available_plan_ids a on a.id=p.id
 left join public.catalog_plan_merchandising m on m.plan_id=p.id
 left join public.catalog_destination_merchandising dm on dm.destination_slug=d.slug
 where p.destination_slug=p_destination and p.is_published and d.is_published and p.kind='fixed' and coalesce(m.visibility,'auto')<>'hide' and not coalesce(m.incident_block,false)
 and (case when lower(p.id)~'_(premium|iij|usip|nonhkip|myip)$' then regexp_replace(lower(p.id),'.*_(premium|iij|usip|nonhkip|myip)$','\1') else 'standard' end)=any(coalesce(dm.approved_modalities,array['standard']))),'[]'::jsonb);
end;$$;

create function public.b2b_submit_request(p_company uuid,p_trip uuid,p_attempt uuid,p_plan text,p_quantity integer,p_version integer) returns uuid language plpgsql security definer set search_path='' as $$
declare actor_id uuid:=public.b2b_guard(p_company,array['owner','coordinator']);trip public.b2b_trips;previous public.b2b_order_requests;plan public.catalog_plans;result_id uuid;
begin
 select * into trip from public.b2b_trips where id=p_trip and company_id=p_company for update;
 if trip.id is null then raise exception 'company_required';end if;
 select * into previous from public.b2b_order_requests where trip_id=p_trip for update;
 if previous.attempt_id=p_attempt then
  if previous.created_by=actor_id and previous.plan_id=p_plan and previous.quantity=p_quantity then return previous.id;end if;raise exception 'conflict';
 end if;
 if trip.version is distinct from p_version then raise exception 'conflict';end if;
 if previous.id is not null and previous.status<>'changes' then raise exception 'invalid_state';end if;
 if p_quantity is null or p_quantity<1 or p_quantity>trip.travelers or(trip.mode='package' and p_quantity<>trip.travelers) then raise exception 'invalid_quantity';end if;
 if not exists(select 1 from jsonb_array_elements(public.b2b_catalog(p_company,trip.destination_slug)) p where p->>'id'=p_plan) then raise exception 'plan_unavailable';end if;
 select * into plan from public.catalog_plans where id=p_plan and destination_slug=trip.destination_slug and is_published for share;
 if plan.id is null then raise exception 'plan_unavailable';end if;
 if plan.days<(trip.return_date-trip.departure+1) then raise exception 'plan_too_short';end if;
 insert into public.b2b_order_requests(company_id,trip_id,attempt_id,created_by,plan_id,plan_name,data_gb,days,quantity)
 values(p_company,p_trip,p_attempt,actor_id,plan.id,plan.name,plan.data_gb,plan.days,p_quantity)
 on conflict(trip_id) do update set attempt_id=excluded.attempt_id,created_by=excluded.created_by,plan_id=excluded.plan_id,plan_name=excluded.plan_name,data_gb=excluded.data_gb,days=excluded.days,quantity=excluded.quantity,status='pending',version=b2b_order_requests.version+1,review_note=null,reviewed_by=null,reviewed_at=null,updated_at=now() returning id into result_id;
 update public.b2b_trips set version=version+1 where id=p_trip;
 insert into public.b2b_audit_logs(company_id,actor,action,entity_id,before_value,after_value) values(p_company,actor_id,'submit_request',result_id,case when previous.id is null then null else to_jsonb(previous) end,jsonb_build_object('plan_id',p_plan,'quantity',p_quantity));
 return result_id;
end;$$;

create function public.b2b_workspace(p_company uuid default null) returns jsonb language plpgsql stable security definer set search_path='' as $$
#variable_conflict use_variable
declare actor_id uuid:=public.b2b_actor();company_id uuid:=p_company;v_role text;result_value jsonb;
begin
 if company_id is null then select m.company_id into company_id from public.b2b_memberships m join public.b2b_organizations o on o.id=m.company_id where m.user_id=actor_id and o.status='active' order by m.created_at,m.company_id limit 1;end if;
 if company_id is not null then v_role:=public.b2b_role(company_id);if v_role is null then raise exception 'company_required';end if;end if;
 result_value:=jsonb_build_object('restricted',exists(select 1 from public.b2b_memberships m join public.b2b_organizations o on o.id=m.company_id where m.user_id=actor_id and o.status='suspended'),
 'company',(select jsonb_build_object('id',o.id,'name',o.name,'role',v_role) from public.b2b_organizations o where o.id=company_id),
 'companies',coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'name',o.name,'role',m.role) order by m.created_at,m.company_id) from public.b2b_memberships m join public.b2b_organizations o on o.id=m.company_id where m.user_id=actor_id and o.status='active'),'[]'::jsonb),
 'trips',coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'name',t.name,'destination_slug',t.destination_slug,'departure',t.departure,'returning',t.return_date,'travelers',t.travelers,'mode',t.mode,'version',t.version,'request',case when r.id is null then null else jsonb_build_object('id',r.id,'plan_id',r.plan_id,'plan_name',r.plan_name,'data_gb',r.data_gb,'days',r.days,'quantity',r.quantity,'status',r.status,'version',r.version,'review_note',r.review_note) end) order by t.departure,t.created_at) from public.b2b_trips t left join public.b2b_order_requests r on r.trip_id=t.id and r.company_id=t.company_id where t.company_id=company_id),'[]'::jsonb),
 'members',case when v_role='owner' then coalesce((select jsonb_agg(jsonb_build_object('user_id',m.user_id,'email',u.email,'role',m.role) order by m.created_at) from public.b2b_memberships m join auth.users u on u.id=m.user_id where m.company_id=company_id),'[]'::jsonb) else '[]'::jsonb end,
 'invitations',case when v_role='owner' then coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'email',i.email,'role',i.role,'expires_at',i.expires_at,'status',i.status) order by i.created_at desc) from public.b2b_invitations i where i.company_id=company_id and i.status='pending' and i.expires_at>now()),'[]'::jsonb) else '[]'::jsonb end,
 'application',(select jsonb_build_object('id',a.id,'name',a.name,'status',a.status,'review_note',a.review_note) from public.b2b_applications a where a.user_id=actor_id),
 'incoming',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'company_name',o.name,'role',i.role,'expires_at',i.expires_at)) from public.b2b_invitations i join public.b2b_organizations o on o.id=i.company_id where i.email=public.b2b_email() and i.status='pending' and i.expires_at>now() and o.status='active'),'[]'::jsonb));
 return result_value;
end;$$;

create function public.b2b_admin_records(p_actor uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not exists(select 1 from public.admin_memberships where user_id=p_actor) then raise exception 'admin_required';end if;
 return jsonb_build_object(
 'applications',coalesce((select jsonb_agg(to_jsonb(a)) from(select a.id,a.name,a.website,a.note,a.status,a.created_at,u.email from public.b2b_applications a join auth.users u on u.id=a.user_id where a.status='pending' order by a.created_at limit 200) a),'[]'::jsonb),
 'companies',coalesce((select jsonb_agg(to_jsonb(o)) from(select o.id,o.name,o.status,o.created_at,(select count(*) from public.b2b_memberships m where m.company_id=o.id) as members from public.b2b_organizations o order by o.created_at desc limit 500) o),'[]'::jsonb),
 'requests',coalesce((select jsonb_agg(to_jsonb(r)) from(select r.id,r.company_id,o.name as company_name,t.name as trip_name,t.departure,t.return_date as "returning",t.travelers,t.mode,r.plan_id,r.plan_name,r.days,r.data_gb,r.quantity,r.version,r.status,r.review_note,r.created_at from public.b2b_order_requests r join public.b2b_organizations o on o.id=r.company_id join public.b2b_trips t on t.id=r.trip_id order by(r.status='pending') desc,r.created_at desc limit 200) r),'[]'::jsonb));
end;$$;
create function public.b2b_admin_action(p_actor uuid,p_action text,p_value jsonb) returns uuid language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare application public.b2b_applications;request_value public.b2b_order_requests;company_id uuid;old_status text;result_id uuid;
begin
 if not exists(select 1 from public.admin_memberships where user_id=p_actor) then raise exception 'admin_required';end if;
 if p_value is null or jsonb_typeof(p_value)<>'object' then raise exception 'invalid_state';end if;
 if p_action in ('approve_application','reject_application') then
  select * into application from public.b2b_applications where id=(p_value->>'id')::uuid for update;
  if application.id is null then raise exception 'invalid_state';end if;
  if application.status='approved' and p_action='approve_application' then return application.company_id;end if;
  if application.status<>'pending' then raise exception 'conflict';end if;
  if p_action='approve_application' then
   if not exists(select 1 from auth.users where id=application.user_id and email_confirmed_at is not null) then raise exception 'verified_account_required';end if;
   insert into public.b2b_organizations(name) values(application.name) returning id into company_id;
   insert into public.b2b_memberships(company_id,user_id,role) values(company_id,application.user_id,'owner');
  end if;
  update public.b2b_applications set status=case when p_action='approve_application' then 'approved' else 'rejected' end,company_id=company_id,review_note=p_value->>'note',reviewed_by=p_actor,reviewed_at=now(),updated_at=now() where id=application.id;
  result_id:=coalesce(company_id,application.id);
  insert into public.b2b_audit_logs(company_id,actor,action,entity_id,before_value,after_value) values(company_id,p_actor,p_action,application.id,to_jsonb(application),p_value);
 elsif p_action='company_status' then
  if p_value->>'status' is null or p_value->>'status' not in ('active','suspended') or length(btrim(coalesce(p_value->>'note','')))<1 or length(p_value->>'note')>1000 then raise exception 'invalid_state';end if;
  company_id:=(p_value->>'id')::uuid;
  select status into old_status from public.b2b_organizations where id=company_id for update;
  if old_status is null then raise exception 'company_required';end if;
  update public.b2b_organizations set status=p_value->>'status' where id=company_id;
  result_id:=company_id;
  insert into public.b2b_audit_logs(company_id,actor,action,entity_id,before_value,after_value) values(company_id,p_actor,p_action,company_id,jsonb_build_object('status',old_status),p_value);
 elsif p_action='review_request' then
  select * into request_value from public.b2b_order_requests where id=(p_value->>'id')::uuid;
  if request_value.id is null then raise exception 'conflict';end if;
  perform 1 from public.b2b_organizations where id=request_value.company_id and status='active' for share;
  if not found then raise exception 'company_required';end if;
  perform 1 from public.b2b_trips where id=request_value.trip_id for update;
  select * into request_value from public.b2b_order_requests where id=(p_value->>'id')::uuid for update;
  if request_value.version is distinct from (p_value->>'version')::integer or request_value.status<>'pending' then raise exception 'conflict';end if;
  if p_value->>'decision' is null or p_value->>'decision' not in ('approved','changes') or length(coalesce(p_value->>'note',''))>1000 or(p_value->>'decision'='changes' and length(btrim(coalesce(p_value->>'note','')))<5) then raise exception 'invalid_state';end if;
  update public.b2b_order_requests set status=p_value->>'decision',review_note=p_value->>'note',reviewed_by=p_actor,reviewed_at=now(),updated_at=now(),version=version+1 where id=request_value.id;
  update public.b2b_trips set version=version+1 where id=request_value.trip_id;
  result_id:=request_value.id;
  insert into public.b2b_audit_logs(company_id,actor,action,entity_id,before_value,after_value) values(request_value.company_id,p_actor,p_action,request_value.id,to_jsonb(request_value),p_value);
 else raise exception 'invalid_state';end if;
 return result_id;
end;$$;

create function public.b2b_auth_rate(p_hash text) returns boolean language plpgsql security definer set search_path='' as $$
declare attempts_value integer;
begin
 delete from public.b2b_auth_limits where key_hash in(select key_hash from public.b2b_auth_limits where window_at<now()-interval '2 days' limit 500);
 insert into public.b2b_auth_limits(key_hash) values(p_hash) on conflict(key_hash) do update set attempts=case when b2b_auth_limits.window_at<now()-interval '10 minutes' then 1 else b2b_auth_limits.attempts+1 end,window_at=case when b2b_auth_limits.window_at<now()-interval '10 minutes' then now() else b2b_auth_limits.window_at end returning attempts into attempts_value;
 return attempts_value<=15;
end;$$;

revoke all on function public.b2b_actor(),public.b2b_email(),public.b2b_role(uuid),public.b2b_guard(uuid,text[]),public.b2b_apply(text,text,text),public.b2b_invite(uuid,text,text),public.b2b_accept_invitation(uuid),public.b2b_revoke_invitation(uuid,uuid),public.b2b_remove_member(uuid,uuid),public.b2b_create_trip(uuid,uuid,jsonb),public.b2b_catalog(uuid,text),public.b2b_submit_request(uuid,uuid,uuid,text,integer,integer),public.b2b_workspace(uuid),public.b2b_admin_records(uuid),public.b2b_admin_action(uuid,text,jsonb),public.b2b_auth_rate(text) from public,anon,authenticated;
grant execute on function public.b2b_actor(),public.b2b_email(),public.b2b_role(uuid),public.b2b_apply(text,text,text),public.b2b_invite(uuid,text,text),public.b2b_accept_invitation(uuid),public.b2b_revoke_invitation(uuid,uuid),public.b2b_remove_member(uuid,uuid),public.b2b_create_trip(uuid,uuid,jsonb),public.b2b_catalog(uuid,text),public.b2b_submit_request(uuid,uuid,uuid,text,integer,integer),public.b2b_workspace(uuid) to authenticated;
grant execute on function public.b2b_admin_records(uuid),public.b2b_admin_action(uuid,text,jsonb),public.b2b_auth_rate(text) to service_role;

commit;
