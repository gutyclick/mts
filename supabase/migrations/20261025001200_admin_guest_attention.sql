begin;
-- Guests do not have a customer_esims row; use the provider state as well as
-- the account cache when determining whether data/expiry needs attention.
create or replace view public.admin_plan_overview with(security_invoker=true) as
select f.id,f.order_id,o.user_id,coalesce(u.email,o.billing_email,o.recipient_email) as email,
 o.recipient_email,i.plan_name,i.destination_name,i.data_gb,i.days,f.state as delivery_state,
 case when f.provider_status='IN_USE' then 'active' when f.provider_status='SUSPENDED' then 'suspended'
  when f.provider_status in ('USED_UP','UNUSED_EXPIRED','USED_EXPIRED','CANCEL','REVOKE') then 'expired'
  when f.provider_esim_id is not null then coalesce(e.status,'ready') else f.state end as status,
 f.volume_bytes,f.used_bytes,f.expires_at,f.provider_checked_at,f.provider_usage_updated_at,
 o.livemode,f.qa_authorized,f.created_at,coalesce(n.note,'') as note,coalesce(n.resolved,false) as resolved,
 case when f.state='review' then 'delivery_review' when f.provider_status='SUSPENDED' then 'suspended'
  when f.used_bytes is not null and f.used_bytes>=f.volume_bytes*0.85 and coalesce(e.status,'ready')<>'expired'
   and coalesce(f.provider_status,'') not in ('USED_UP','UNUSED_EXPIRED','USED_EXPIRED','CANCEL','REVOKE') then 'low_data'
  when (f.provider_status='IN_USE' or e.status='active') and f.expires_at>now() and f.expires_at<now()+interval '48 hours' then 'expiry_soon'
  when n.unit_id is not null and not n.resolved then 'followup' else null end as attention,
 (f.provider_esim_id is not null) as can_sync
from public.esim_fulfillments f join public.checkout_orders o on o.id=f.order_id
join public.checkout_order_items i on i.order_id=f.order_id and i.plan_id=f.plan_id
left join auth.users u on u.id=o.user_id left join public.customer_esims e on e.id=f.id
left join public.admin_followups n on n.unit_id=f.id;
commit;
