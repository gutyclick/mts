begin;
alter table public.support_threads alter column user_id drop not null;
alter table public.support_threads
 add column guest_hash text check(guest_hash is null or guest_hash ~ '^[a-f0-9]{64}$'),
 add column topic text not null default 'general' check(topic in ('general','installation','connection','plans','orders','compatibility')),
 add column closed_at timestamptz,
 add column close_reason text check(close_reason in ('resolved','inactivity')),
 add column rating integer check(rating between 1 and 5),
 add column rating_comment text check(length(rating_comment)<=600),
 add column rated_at timestamptz,
 add constraint support_thread_owner check((user_id is not null and guest_hash is null) or (user_id is null and guest_hash is not null and order_id is null)),
 add constraint support_rating_closed check(rating is null or (status='resolved' and rated_at is not null));
alter table public.support_settings add column idle_minutes integer not null default 10 check(idle_minutes between 5 and 120);
create index support_guest_history_idx on public.support_threads(guest_hash,updated_at desc) where guest_hash is not null;
create index support_idle_chat_idx on public.support_threads(updated_at) where status='chat';

create function public.support_conversation_owned(t public.support_threads,p_user uuid,p_guest text) returns boolean language sql stable set search_path='' as $$
 select coalesce((p_user is not null and (t).user_id=p_user) or (p_user is null and p_guest ~ '^[a-f0-9]{64}$' and (t).guest_hash=p_guest),false)
$$;
create function public.support_close_stamp() returns trigger language plpgsql set search_path='' as $$
begin
 if new.status='resolved' then new.closed_at:=coalesce(new.closed_at,now());new.close_reason:=coalesce(new.close_reason,'resolved');new.chat_token:=null;new.chat_until:=null;
 elsif old.status='resolved' then raise exception 'conversation_closed';end if;
 return new;
end;$$;
create trigger support_close_stamp before update on public.support_threads for each row execute function public.support_close_stamp();
update public.support_threads set closed_at=updated_at,close_reason='resolved' where status='resolved';

create function public.support_conversation_close(p_user uuid,p_guest text,p_thread uuid,p_reason text) returns jsonb language plpgsql security definer set search_path='' as $$
declare t public.support_threads; minutes integer;
begin
 if p_reason not in ('resolved','inactivity') then raise exception 'invalid_close';end if;
 select * into t from public.support_threads s where s.id=p_thread and public.support_conversation_owned(s,p_user,p_guest) for update;
 if not found then raise exception 'thread_unavailable';end if;
 if t.status='resolved' then return to_jsonb(t);end if;
 if p_reason='inactivity' then
  select idle_minutes into minutes from public.support_settings where id=true;
  if t.status<>'chat' or t.updated_at>now()-make_interval(mins=>minutes) then return to_jsonb(t);end if;
 end if;
 update public.support_threads set status='resolved',closed_at=now(),close_reason=p_reason,updated_at=now(),chat_token=null,chat_until=null where id=t.id returning * into t;
 insert into public.support_messages(thread_id,author,body) values(t.id,'system',case when p_reason='inactivity' then case when t.locale='es' then 'Conversación finalizada por inactividad.' else 'Conversation ended due to inactivity.' end else case when t.locale='es' then 'Incidencia cerrada.' else 'Issue closed.' end end);
 return to_jsonb(t);
end;$$;

create function public.support_conversation_open(p_user uuid,p_guest text,p_id uuid,p_topic text,p_subject text,p_locale text,p_language text) returns jsonb language plpgsql security definer set search_path='' as $$
declare t public.support_threads;
begin
 if p_user is null and (p_guest is null or p_guest !~ '^[a-f0-9]{64}$') then raise exception 'account_required';end if;
 if p_user is not null and not exists(select 1 from auth.users where id=p_user and email_confirmed_at is not null) then raise exception 'account_required';end if;
 if length(p_subject) not between 1 and 120 then raise exception 'invalid_subject';end if;
 perform pg_advisory_xact_lock(hashtextextended(coalesce(p_user::text,p_guest),17));
 select * into t from public.support_threads where id=p_id;
 if found then if not public.support_conversation_owned(t,p_user,p_guest) then raise exception 'thread_unavailable';end if;return to_jsonb(t);end if;
 for t in select * from public.support_threads s where s.status='chat' and public.support_conversation_owned(s,p_user,p_guest) for update loop
  perform public.support_conversation_close(p_user,p_guest,t.id,'inactivity');
 end loop;
 if exists(select 1 from public.support_threads s where s.status='chat' and public.support_conversation_owned(s,p_user,p_guest)) then raise exception 'active_conversation';end if;
 insert into public.support_threads(id,user_id,guest_hash,topic,subject,locale,language) values(p_id,p_user,case when p_user is null then p_guest else null end,p_topic,p_subject,p_locale,p_language) returning * into t;
 return to_jsonb(t);
end;$$;

create function public.support_conversation_chat_start(p_user uuid,p_guest text,p_thread uuid,p_request uuid,p_body text,p_language text,p_order uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare t public.support_threads;m public.support_messages;a public.support_messages;token uuid;
begin
 if p_body is null or length(p_body) not between 1 and 3000 then raise exception 'invalid_message';end if;
 perform pg_advisory_xact_lock(hashtextextended(coalesce(p_user::text,p_guest),17));
 perform public.support_conversation_close(p_user,p_guest,p_thread,'inactivity');
 select * into t from public.support_threads s where s.id=p_thread and public.support_conversation_owned(s,p_user,p_guest) for update;
 if not found then raise exception 'thread_unavailable';end if;
 if t.status='resolved' then return jsonb_build_object('closed',true,'thread',to_jsonb(t));end if;
 if t.status<>'chat' then raise exception 'thread_escalated';end if;
 if p_order is not null and (p_user is null or not exists(select 1 from public.checkout_orders where id=p_order and user_id=p_user)) then raise exception 'order_unavailable';end if;
 select * into m from public.support_messages where id=p_request;
 if found then
  if m.thread_id<>t.id or m.body<>p_body or m.author<>'user' then raise exception 'request_conflict';end if;
  select * into a from public.support_messages where reply_to=m.id;
  if a.id is not null then return jsonb_build_object('id',t.id,'replay',true,'answer',jsonb_build_object('id',a.id,'thread_id',a.thread_id,'author',a.author,'body',a.body,'citations',a.citations,'created_at',a.created_at));end if;
  if t.chat_until>now() then raise exception 'chat_busy';end if;
 else
  if t.chat_until>now() then raise exception 'chat_busy';end if;
  insert into public.support_messages(id,thread_id,author,author_id,body)values(p_request,t.id,'user',p_user,p_body);
 end if;
 token:=gen_random_uuid();
 update public.support_threads set chat_token=token,chat_until=now()+interval '60 seconds',updated_at=now(),language=p_language,order_id=p_order where id=t.id;
 return jsonb_build_object('id',t.id,'token',token,'replay',false);
end;$$;

create function public.support_conversation_chat_finish(p_user uuid,p_guest text,p_thread uuid,p_token uuid,p_request uuid,p_body text,p_citations jsonb,p_ai boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare t public.support_threads;m public.support_messages;
begin
 select * into t from public.support_threads s where s.id=p_thread and public.support_conversation_owned(s,p_user,p_guest) for update;
 if not found or t.status<>'chat' or t.chat_token is distinct from p_token then return null;end if;
 if not exists(select 1 from public.support_messages where id=p_request and thread_id=t.id and author='user') then raise exception 'request_unavailable';end if;
 insert into public.support_messages(thread_id,author,body,citations,reply_to) values(t.id,case when p_ai then 'assistant' else 'system' end,p_body,p_citations,p_request) returning * into m;
 update public.support_threads set chat_token=null,chat_until=null,updated_at=now() where id=t.id;
 return jsonb_build_object('id',m.id,'thread_id',m.thread_id,'author',m.author,'body',m.body,'citations',m.citations,'created_at',m.created_at);
end;$$;

create function public.support_conversation_rate(p_user uuid,p_guest text,p_thread uuid,p_rating integer,p_comment text) returns jsonb language plpgsql security definer set search_path='' as $$
declare t public.support_threads;
begin
 if p_rating is null or p_rating not between 1 and 5 or p_comment is null or length(p_comment)>600 then raise exception 'invalid_rating';end if;
 select * into t from public.support_threads s where s.id=p_thread and public.support_conversation_owned(s,p_user,p_guest) for update;
 if not found then raise exception 'thread_unavailable';end if;
 if t.status<>'resolved' then raise exception 'conversation_active';end if;
 if not exists(select 1 from public.support_messages where thread_id=t.id and author='user') then raise exception 'rating_unavailable';end if;
 if t.rating is not null then
  if t.rating=p_rating and coalesce(t.rating_comment,'')=p_comment then return to_jsonb(t);end if;
  raise exception 'already_rated';
 end if;
 update public.support_threads set rating=p_rating,rating_comment=p_comment,rated_at=now() where id=t.id returning * into t;
 return to_jsonb(t);
end;$$;

create function public.support_expire_conversations() returns integer language plpgsql security definer set search_path='' as $$
declare t public.support_threads; n integer:=0; minutes integer;
begin
 select idle_minutes into minutes from public.support_settings where id=true;
 for t in select * from public.support_threads where status='chat' and updated_at<=now()-make_interval(mins=>minutes) order by updated_at limit 100 for update skip locked loop
  perform public.support_conversation_close(t.user_id,t.guest_hash,t.id,'inactivity');n:=n+1;
 end loop;
 delete from public.support_threads where guest_hash is not null and status='resolved' and updated_at<now()-interval '30 days';
 return n;
end;$$;

revoke all on function public.support_conversation_owned(public.support_threads,uuid,text),public.support_conversation_close(uuid,text,uuid,text),public.support_conversation_open(uuid,text,uuid,text,text,text,text),public.support_conversation_chat_start(uuid,text,uuid,uuid,text,text,uuid),public.support_conversation_chat_finish(uuid,text,uuid,uuid,uuid,text,jsonb,boolean),public.support_conversation_rate(uuid,text,uuid,integer,text),public.support_expire_conversations() from public,anon,authenticated;
grant execute on function public.support_conversation_owned(public.support_threads,uuid,text),public.support_conversation_close(uuid,text,uuid,text),public.support_conversation_open(uuid,text,uuid,text,text,text,text),public.support_conversation_chat_start(uuid,text,uuid,uuid,text,text,uuid),public.support_conversation_chat_finish(uuid,text,uuid,uuid,uuid,text,jsonb,boolean),public.support_conversation_rate(uuid,text,uuid,integer,text),public.support_expire_conversations() to service_role;
do $$ begin if to_regnamespace('cron') is not null then perform cron.schedule('mts-support-conversation-expiry','* * * * *','select public.support_expire_conversations()');end if;end $$;
create or replace function public.support_ticket_list(p_actor uuid,p_staff boolean,p_status text,p_query text,p_page integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;term text;
begin
 if p_staff and not exists(select 1 from public.admin_memberships where user_id=p_actor)then raise exception 'admin_required';end if;
 if length(p_query)>80 or p_page not between 1 and 10000 then raise exception 'invalid_filter';end if;
 term:='%'||replace(replace(replace(p_query,E'\\',E'\\\\'),'%',E'\\%'),'_',E'\\_')||'%';
 with records as(
  select t.id,t.subject,t.status,t.language,t.order_id,t.created_at,t.updated_at,t.escalated_at,t.topic,t.closed_at,t.close_reason,t.rating,t.rating_comment,t.rated_at,
   case when p_staff then u.email else null end as customer_email,
   case when p_staff then(select n.state from public.support_notifications n where n.thread_id=t.id order by n.created_at desc limit 1)else null end as notification_status
  from public.support_threads t left join auth.users u on u.id=t.user_id where t.status<>'chat'and(p_staff or t.user_id=p_actor)
   and(p_status=''or t.status=p_status)and(t.subject ilike term or t.id::text ilike term or(p_staff and u.email ilike term))
 )select jsonb_build_object('total',(select count(*)from records),'page',p_page,'rows',(select coalesce(jsonb_agg(to_jsonb(x)),'[]')from(select * from records order by updated_at desc,id limit 20 offset(p_page-1)*20)x))into result;
 return result;
end;$$;


revoke all on function public.support_close_stamp() from public,anon,authenticated;
commit;
