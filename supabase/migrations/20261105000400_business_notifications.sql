begin;
create table public.b2b_notifications (
 id uuid primary key default gen_random_uuid(),order_id uuid not null unique references public.b2b_orders(id),
 recipient_id uuid not null references auth.users(id),recipient_email text not null,
 locale text not null default 'es' check(locale in ('es','en')),
 state text not null default 'queued' check(state in ('queued','sent','review')),
 attempts integer not null default 0,first_attempt_at timestamptz,next_attempt_at timestamptz not null default now(),
 lease_token uuid,lease_until timestamptz,email_id text,last_error text,created_at timestamptz not null default now(),sent_at timestamptz
);
alter table public.b2b_notifications enable row level security;
revoke all on public.b2b_notifications from public,anon,authenticated,service_role;
grant select on public.b2b_notifications to service_role;

create function public.b2b_notification_enqueue(p_actor uuid,p_order uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare o public.b2b_orders;r public.b2b_order_requests;v_user uuid;v_email text;v_locale text;v_id uuid;
begin
 if not exists(select 1 from public.admin_memberships where user_id=p_actor) then raise exception 'admin_required';end if;
 select * into o from public.b2b_orders where id=p_order for update;
 if o.id is null or o.state<>'ready' or o.paid_at is null or o.released_at is null then raise exception 'ready_order_required';end if;
 if not exists(select 1 from public.b2b_organizations where id=o.company_id and status='active') then raise exception 'company_required';end if;
 if (select count(*) from public.b2b_units where order_id=o.id and state='ready')<>o.quantity or exists(select 1 from public.b2b_units where order_id=o.id and state<>'ready') then raise exception 'ready_units_required';end if;
 select id into v_id from public.b2b_notifications where order_id=o.id;
 if v_id is not null then return v_id;end if;
 select * into r from public.b2b_order_requests where id=o.request_id;
 select u.id,lower(u.email),case when u.raw_user_meta_data->>'locale'='en' then 'en' else 'es' end into v_user,v_email,v_locale
 from public.b2b_memberships m join auth.users u on u.id=m.user_id
 where m.company_id=o.company_id and m.role in ('owner','coordinator') and u.email_confirmed_at is not null
 and u.email~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' and length(u.email)<=254
 and (coalesce(to_jsonb(u)->>'banned_until','')='' or (to_jsonb(u)->>'banned_until')::timestamptz<=now())
 and nullif(to_jsonb(u)->>'deleted_at','') is null
 and (u.id=r.created_by or m.role='owner')
 order by (u.id=r.created_by) desc,m.created_at,u.id limit 1;
 if v_user is null then raise exception 'verified_recipient_required';end if;
 insert into public.b2b_notifications(order_id,recipient_id,recipient_email,locale) values(o.id,v_user,v_email,v_locale) returning id into v_id;
 insert into public.b2b_audit_logs(company_id,actor,action,entity_id,after_value) values(o.company_id,p_actor,'notification_enqueued',o.id,jsonb_build_object('notification_id',v_id));
 return v_id;
end;$$;

create function public.claim_b2b_notifications(p_limit integer default 2) returns jsonb language plpgsql security definer set search_path='' as $$
declare n public.b2b_notifications;v_rows jsonb:='[]';v_trip uuid;v_company uuid;
begin
 for n in select x.* from public.b2b_notifications x where x.state='queued' and x.next_attempt_at<=now() and (x.lease_until is null or x.lease_until<=now()) order by x.created_at,x.id for update skip locked limit greatest(0,least(coalesce(p_limit,2),2)) loop
  select trip_id,company_id into v_trip,v_company from public.b2b_orders where id=n.order_id;
  if n.first_attempt_at<=now()-interval '23 hours' or n.attempts>=24 or not exists(
   select 1 from public.b2b_orders o join public.b2b_organizations c on c.id=o.company_id
   join public.b2b_memberships m on m.company_id=c.id and m.user_id=n.recipient_id
   join auth.users u on u.id=m.user_id where o.id=n.order_id and o.state='ready' and o.paid_at is not null and o.released_at is not null
   and c.status='active' and m.role in ('owner','coordinator') and u.email_confirmed_at is not null and lower(u.email)=n.recipient_email
   and nullif(to_jsonb(u)->>'deleted_at','') is null
   and (coalesce(to_jsonb(u)->>'banned_until','')='' or (to_jsonb(u)->>'banned_until')::timestamptz<=now())
   and (select count(*) from public.b2b_units where order_id=o.id and state='ready')=o.quantity
   and not exists(select 1 from public.b2b_units where order_id=o.id and state<>'ready')
  ) then
   update public.b2b_notifications set state='review',last_error='notification_review',lease_token=null,lease_until=null where id=n.id;
   insert into public.b2b_audit_logs(company_id,action,entity_id,after_value) values(v_company,'notification_review',n.order_id,jsonb_build_object('notification_id',n.id));
   continue;
  end if;
  update public.b2b_notifications set first_attempt_at=coalesce(first_attempt_at,now()),attempts=attempts+1,lease_token=gen_random_uuid(),lease_until=now()+interval '5 minutes' where id=n.id returning * into n;
  insert into public.b2b_audit_logs(company_id,action,entity_id,after_value) values(v_company,'notification_claimed',n.order_id,jsonb_build_object('notification_id',n.id,'attempt',n.attempts));
  v_rows:=v_rows||jsonb_build_array(jsonb_build_object('id',n.id,'order_id',n.order_id,'trip_id',v_trip,'recipient_email',n.recipient_email,'locale',n.locale,'first_attempt_at',n.first_attempt_at,'attempts',n.attempts,'lease_token',n.lease_token));
 end loop;
 return v_rows;
end;$$;

create function public.complete_b2b_notification(p_id uuid,p_lease uuid,p_email_id text default null,p_error text default null) returns boolean language plpgsql security definer set search_path='' as $$
declare n public.b2b_notifications;v_company uuid;v_state text;
begin
 select * into n from public.b2b_notifications where id=p_id and lease_token=p_lease and lease_until>now() and state='queued' for update;
 if n.id is null then return false;end if;
 if p_email_id is not null then
  if p_email_id!~'^[A-Za-z0-9_-]{1,100}$' or p_error is not null then raise exception 'invalid_result';end if;
  v_state:='sent';
 else
  if p_error is null or p_error not in ('transient','permanent','configuration','uncertain') then raise exception 'invalid_error';end if;
  v_state:=case when p_error<>'transient' or n.attempts>=24 or n.first_attempt_at<=now()-interval '23 hours' then 'review' else 'queued' end;
 end if;
 update public.b2b_notifications set state=v_state,email_id=p_email_id,last_error=p_error,sent_at=case when v_state='sent' then now() else null end,
  next_attempt_at=now()+make_interval(secs=>least(3600,30*power(2,least(n.attempts,7)))::integer),lease_token=null,lease_until=null where id=n.id;
 select company_id into v_company from public.b2b_orders where id=n.order_id;
 insert into public.b2b_audit_logs(company_id,action,entity_id,after_value) values(v_company,'notification_'||v_state,n.order_id,jsonb_build_object('notification_id',n.id,'state',v_state,'error',p_error));
 return true;
end;$$;
revoke all on function public.b2b_notification_enqueue(uuid,uuid),public.claim_b2b_notifications(integer),public.complete_b2b_notification(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.b2b_notification_enqueue(uuid,uuid),public.claim_b2b_notifications(integer),public.complete_b2b_notification(uuid,uuid,text,text) to service_role;
commit;
