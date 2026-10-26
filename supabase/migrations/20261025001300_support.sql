begin;
create table public.support_threads(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 subject text not null check(length(subject) between 1 and 120),status text not null default 'chat' check(status in ('chat','open','waiting_customer','resolved')),
 language text not null default 'auto' check(language in ('auto','es','en','pt','fr','de','it')),locale text not null check(locale in ('es','en')),
 order_id uuid references public.checkout_orders(id),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),escalated_at timestamptz,
 chat_token uuid,chat_until timestamptz
);
create table public.support_messages(
 id uuid primary key default gen_random_uuid(),thread_id uuid not null references public.support_threads(id) on delete cascade,
 author text not null check(author in ('user','assistant','agent','system')),author_id uuid references auth.users(id) on delete set null,
 body text not null check(length(body) between 1 and 8000),citations jsonb not null default '[]' check(jsonb_typeof(citations)='array' and jsonb_array_length(citations)<=4),
 reply_to uuid unique references public.support_messages(id),created_at timestamptz not null default now()
);
create index support_owner_idx on public.support_threads(user_id,updated_at desc);
create index support_status_idx on public.support_threads(status,updated_at desc) where status<>'chat';
create index support_message_idx on public.support_messages(thread_id,created_at desc,id desc);
create table public.support_quotas(key text primary key,window_start timestamptz not null,hits integer not null check(hits>=0));
create table public.support_settings(id boolean primary key default true check(id),inbox text not null check(length(inbox) between 3 and 254));
insert into public.support_settings(id,inbox) values(true,'hello@mytripsim.com');
create table public.support_notifications(
 id uuid primary key default gen_random_uuid(),event_key text not null unique,thread_id uuid not null references public.support_threads(id) on delete cascade,
 recipient text not null,locale text not null check(locale in ('es','en')),kind text not null check(kind in ('new_ticket','customer_reply','agent_reply')),
 subject text not null,state text not null default 'pending' check(state in ('pending','sent','failed')),attempts integer not null default 0,
 next_attempt_at timestamptz not null default now(),lease_token uuid,lease_until timestamptz,first_attempt_at timestamptz,email_id text,sent_at timestamptz,
 created_at timestamptz not null default now(),last_error text check(last_error in ('temporary','permanent','uncertain'))
);
create index support_notification_due on public.support_notifications(next_attempt_at) where state='pending';
alter table public.support_threads enable row level security;alter table public.support_messages enable row level security;
alter table public.support_quotas enable row level security;alter table public.support_settings enable row level security;alter table public.support_notifications enable row level security;
revoke all on public.support_threads,public.support_messages,public.support_quotas,public.support_settings,public.support_notifications from public,anon,authenticated;
grant all on public.support_threads,public.support_messages,public.support_quotas,public.support_settings,public.support_notifications to service_role;
grant select(id,user_id,subject,status,language,order_id,created_at,updated_at,escalated_at) on public.support_threads to authenticated;
grant select(id,thread_id,author,body,citations,created_at) on public.support_messages to authenticated;
create policy own_support_threads on public.support_threads for select to authenticated using(user_id=(select auth.uid()));
create policy own_support_messages on public.support_messages for select to authenticated using(exists(select 1 from public.support_threads t where t.id=thread_id and t.user_id=(select auth.uid())));

create function public.support_take_quota(p_key text,p_limit integer,p_period text default 'hour') returns boolean language plpgsql security definer set search_path='' as $$
declare n integer;bucket timestamptz;
begin
 if length(p_key)>200 or p_limit not between 1 and 1000 or p_period not in ('hour','day') then raise exception 'invalid_quota'; end if;
 bucket:=date_trunc(p_period,now());
 insert into public.support_quotas(key,window_start,hits)values(p_key,bucket,1)
 on conflict(key) do update set hits=case when public.support_quotas.window_start=bucket then public.support_quotas.hits+1 else 1 end,window_start=bucket returning hits into n;
 return n<=p_limit;
end;$$;

create function public.support_chat_start(p_user uuid,p_thread uuid,p_request uuid,p_body text,p_language text,p_locale text,p_order uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare t public.support_threads;m public.support_messages;a public.support_messages;token uuid;
begin
 if p_user is null or not exists(select 1 from auth.users where id=p_user and email_confirmed_at is not null) then raise exception 'account_required'; end if;
 if length(p_body) not between 1 and 3000 then raise exception 'invalid_message'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,7));
 select * into m from public.support_messages where id=p_request;
 if found then
  select * into t from public.support_threads where id=m.thread_id and user_id=p_user;
  if not found or m.body<>p_body or m.author<>'user' then raise exception 'request_conflict'; end if;
  select * into a from public.support_messages where reply_to=m.id;
  if a.id is null and(t.chat_until is null or t.chat_until<=now())then
   if t.status<>'chat'then raise exception 'thread_escalated';end if;
   token:=gen_random_uuid();update public.support_threads set chat_token=token,chat_until=now()+interval '60 seconds'where id=t.id;
   return jsonb_build_object('id',t.id,'token',token,'replay',false);
  end if;
  return jsonb_build_object('id',t.id,'replay',true,'answer',case when a.id is not null then jsonb_build_object('id',a.id,'thread_id',a.thread_id,'author',a.author,'body',a.body,'citations',a.citations,'created_at',a.created_at) else null end);
 end if;
 if p_order is not null and not exists(select 1 from public.checkout_orders where id=p_order and user_id=p_user) then raise exception 'order_unavailable'; end if;
 if p_thread is null then
  insert into public.support_threads(user_id,subject,language,locale,order_id)values(p_user,left(p_body,120),p_language,p_locale,p_order) returning * into t;
 else
  select * into t from public.support_threads where id=p_thread and user_id=p_user for update;
  if not found then raise exception 'thread_unavailable'; end if;
 end if;
 if t.status<>'chat' then raise exception 'thread_escalated'; end if;
 if t.chat_until>now() then raise exception 'chat_busy'; end if;
 token:=gen_random_uuid();
 update public.support_threads set chat_token=token,chat_until=now()+interval '60 seconds',updated_at=now(),order_id=coalesce(p_order,order_id),language=p_language where id=t.id;
 insert into public.support_messages(id,thread_id,author,author_id,body)values(p_request,t.id,'user',p_user,p_body);
 return jsonb_build_object('id',t.id,'token',token,'replay',false);
end;$$;

create function public.support_chat_finish(p_user uuid,p_thread uuid,p_token uuid,p_request uuid,p_body text,p_citations jsonb,p_ai boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare t public.support_threads;m public.support_messages;
begin
 select * into t from public.support_threads where id=p_thread and user_id=p_user for update;
 if not found or t.status<>'chat' or t.chat_token is distinct from p_token then return null; end if;
 if not exists(select 1 from public.support_messages where id=p_request and thread_id=t.id and author='user') then raise exception 'request_unavailable'; end if;
 insert into public.support_messages(thread_id,author,body,citations,reply_to)values(t.id,case when p_ai then 'assistant' else 'system' end,p_body,p_citations,p_request) returning * into m;
 update public.support_threads set chat_token=null,chat_until=null,updated_at=now() where id=t.id;
 return jsonb_build_object('id',m.id,'thread_id',m.thread_id,'author',m.author,'body',m.body,'citations',m.citations,'created_at',m.created_at);
end;$$;

create function public.support_ticket_create(p_user uuid,p_thread uuid,p_request uuid,p_subject text,p_body text,p_language text,p_locale text,p_order uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare t public.support_threads;m public.support_messages;inbox text;
begin
 if p_user is null or not exists(select 1 from auth.users where id=p_user and email_confirmed_at is not null) then raise exception 'account_required'; end if;
 if length(p_subject) not between 3 and 120 or length(p_body) not between 3 and 4000 then raise exception 'invalid_ticket'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,7));
 select * into m from public.support_messages where id=p_request;
 if found then
  select * into t from public.support_threads where id=m.thread_id and user_id=p_user;
  if not found or m.body<>p_body or t.status='chat' then raise exception 'request_conflict'; end if;return t.id;
 end if;
 if p_order is not null and not exists(select 1 from public.checkout_orders where id=p_order and user_id=p_user) then raise exception 'order_unavailable'; end if;
 if p_thread is null then
  insert into public.support_threads(user_id,subject,status,language,locale,order_id,escalated_at)values(p_user,p_subject,'open',p_language,p_locale,p_order,now())returning * into t;
 else
  select * into t from public.support_threads where id=p_thread and user_id=p_user for update;
  if not found then raise exception 'thread_unavailable'; end if;
  if t.status<>'chat' then return t.id; end if;
  update public.support_threads set subject=p_subject,status='open',escalated_at=now(),updated_at=now(),chat_token=null,chat_until=null,order_id=coalesce(p_order,order_id)where id=t.id;
 end if;
 insert into public.support_messages(id,thread_id,author,author_id,body)values(p_request,t.id,'user',p_user,p_body);
 select s.inbox into inbox from public.support_settings s where id=true;
 insert into public.support_notifications(event_key,thread_id,recipient,locale,kind,subject)values('ticket:'||t.id,t.id,inbox,p_locale,'new_ticket',p_subject)on conflict(event_key)do nothing;
 return t.id;
end;$$;

create function public.support_ticket_reply(p_actor uuid,p_thread uuid,p_request uuid,p_body text,p_staff boolean) returns boolean language plpgsql security definer set search_path='' as $$
declare t public.support_threads;m public.support_messages;address text;kind text;
begin
 if p_staff and not exists(select 1 from public.admin_memberships where user_id=p_actor)then raise exception 'admin_required';end if;
 select * into t from public.support_threads where id=p_thread and(p_staff or user_id=p_actor)for update;
 if not found or t.status='chat' then raise exception 'ticket_unavailable';end if;
 if length(p_body)not between 1 and 4000 then raise exception 'invalid_message';end if;
 select * into m from public.support_messages where id=p_request;
 if found then
  if m.thread_id<>t.id or m.author_id is distinct from p_actor or m.body<>p_body or m.author<>(case when p_staff then 'agent'else 'user'end) then raise exception 'request_conflict';end if;return true;
 end if;
 insert into public.support_messages(id,thread_id,author,author_id,body)values(p_request,t.id,case when p_staff then 'agent' else 'user' end,p_actor,p_body);
 update public.support_threads set status=case when p_staff then 'waiting_customer' else 'open' end,updated_at=now()where id=t.id;
 if p_staff then select email into address from auth.users where id=t.user_id and email_confirmed_at is not null;kind:='agent_reply';
 else select inbox into address from public.support_settings where id=true;kind:='customer_reply';end if;
 insert into public.support_notifications(event_key,thread_id,recipient,locale,kind,subject)values('reply:'||p_request,t.id,address,t.locale,kind,t.subject)on conflict(event_key)do nothing;
 return true;
end;$$;

create function public.support_ticket_resolve(p_actor uuid,p_thread uuid,p_staff boolean) returns boolean language plpgsql security definer set search_path='' as $$
declare t public.support_threads;
begin
 if p_staff and not exists(select 1 from public.admin_memberships where user_id=p_actor)then raise exception 'admin_required';end if;
 select * into t from public.support_threads where id=p_thread and(p_staff or user_id=p_actor)for update;
 if not found or t.status='chat'then raise exception 'ticket_unavailable';end if;
 if t.status='resolved'then return true;end if;
 update public.support_threads set status='resolved',updated_at=now()where id=t.id;
 insert into public.support_messages(thread_id,author,author_id,body)values(t.id,'system',p_actor,case when t.locale='es'then 'Ticket marcado como resuelto.'else 'Ticket marked as resolved.'end);return true;
end;$$;

create function public.support_ticket_list(p_actor uuid,p_staff boolean,p_status text,p_query text,p_page integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;term text;
begin
 if p_staff and not exists(select 1 from public.admin_memberships where user_id=p_actor)then raise exception 'admin_required';end if;
 if length(p_query)>80 or p_page not between 1 and 10000 then raise exception 'invalid_filter';end if;
 term:='%'||replace(replace(replace(p_query,E'\\',E'\\\\'),'%',E'\\%'),'_',E'\\_')||'%';
 with records as(
  select t.id,t.subject,t.status,t.language,t.order_id,t.created_at,t.updated_at,t.escalated_at,
   case when p_staff then u.email else null end as customer_email,
   case when p_staff then(select n.state from public.support_notifications n where n.thread_id=t.id order by n.created_at desc limit 1)else null end as notification_status
  from public.support_threads t join auth.users u on u.id=t.user_id where t.status<>'chat'and(p_staff or t.user_id=p_actor)
   and(p_status=''or t.status=p_status)and(t.subject ilike term or t.id::text ilike term or(p_staff and u.email ilike term))
 )select jsonb_build_object('total',(select count(*)from records),'page',p_page,'rows',(select coalesce(jsonb_agg(to_jsonb(x)),'[]')from(select * from records order by updated_at desc,id limit 20 offset(p_page-1)*20)x))into result;
 return result;
end;$$;

create function public.support_claim_notifications(p_limit integer default 2) returns setof public.support_notifications language plpgsql security definer set search_path='' as $$
begin
 update public.support_notifications set state='failed',last_error='uncertain',lease_token=null,lease_until=null where state='pending'and(first_attempt_at<now()-interval '23 hours'or attempts>=12)and(lease_until is null or lease_until<now());
 return query with due as(select id from public.support_notifications where state='pending'and next_attempt_at<=now()and(lease_until is null or lease_until<now())order by next_attempt_at limit least(greatest(p_limit,1),5)for update skip locked)
 update public.support_notifications n set lease_token=gen_random_uuid(),lease_until=now()+interval '90 seconds',attempts=attempts+1,first_attempt_at=coalesce(first_attempt_at,now())from due where n.id=due.id returning n.*;
end;$$;
revoke all on function public.support_take_quota(text,integer,text),public.support_chat_start(uuid,uuid,uuid,text,text,text,uuid),public.support_chat_finish(uuid,uuid,uuid,uuid,text,jsonb,boolean),public.support_ticket_create(uuid,uuid,uuid,text,text,text,text,uuid),public.support_ticket_reply(uuid,uuid,uuid,text,boolean),public.support_ticket_resolve(uuid,uuid,boolean),public.support_ticket_list(uuid,boolean,text,text,integer),public.support_claim_notifications(integer) from public,anon,authenticated;
grant execute on function public.support_take_quota(text,integer,text),public.support_chat_start(uuid,uuid,uuid,text,text,text,uuid),public.support_chat_finish(uuid,uuid,uuid,uuid,text,jsonb,boolean),public.support_ticket_create(uuid,uuid,uuid,text,text,text,text,uuid),public.support_ticket_reply(uuid,uuid,uuid,text,boolean),public.support_ticket_resolve(uuid,uuid,boolean),public.support_ticket_list(uuid,boolean,text,text,integer),public.support_claim_notifications(integer) to service_role;
commit;
