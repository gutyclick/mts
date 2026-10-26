begin;
-- The current selection is authoritative, including clearing order context.
create or replace function public.support_chat_start(p_user uuid,p_thread uuid,p_request uuid,p_body text,p_language text,p_locale text,p_order uuid) returns jsonb language plpgsql security definer set search_path='' as $$
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
 update public.support_threads set chat_token=token,chat_until=now()+interval '60 seconds',updated_at=now(),order_id=p_order ,language=p_language where id=t.id;
 insert into public.support_messages(id,thread_id,author,author_id,body)values(p_request,t.id,'user',p_user,p_body);
 return jsonb_build_object('id',t.id,'token',token,'replay',false);
end;$$;
create or replace function public.support_ticket_create(p_user uuid,p_thread uuid,p_request uuid,p_subject text,p_body text,p_language text,p_locale text,p_order uuid) returns uuid language plpgsql security definer set search_path='' as $$
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
  update public.support_threads set subject=p_subject,status='open',escalated_at=now(),updated_at=now(),chat_token=null,chat_until=null,order_id=p_order where id=t.id;
 end if;
 insert into public.support_messages(id,thread_id,author,author_id,body)values(p_request,t.id,'user',p_user,p_body);
 select s.inbox into inbox from public.support_settings s where id=true;
 insert into public.support_notifications(event_key,thread_id,recipient,locale,kind,subject)values('ticket:'||t.id,t.id,inbox,p_locale,'new_ticket',p_subject)on conflict(event_key)do nothing;
 return t.id;
end;$$;
commit;
