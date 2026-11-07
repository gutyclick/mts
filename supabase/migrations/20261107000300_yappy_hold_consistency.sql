-- Preserve the checkout hold constraint; no historical orders or amounts change.
begin;
create or replace function public.retail_yappy_claim(p_order uuid,p_ref text,p_amount integer,p_domain text,p_live boolean) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare o public.checkout_orders;a public.checkout_yappy_attempts;
begin
 select * into o from public.checkout_orders where id=p_order for update;
 if not found or o.status<>'pending' or o.stripe_session_id is not null or o.livemode is distinct from p_live or o.payment_currency is distinct from 'USD' or o.payment_total is distinct from p_amount
 or (o.expires_at is not null and o.expires_at<=now()) then raise exception 'yappy_order_ineligible';end if;
 if not exists(select 1 from public.checkout_legal_acceptances where order_id=o.id) then raise exception 'terms_required';end if;
 select * into a from public.checkout_yappy_attempts where order_id=o.id;
 if found then raise exception 'yappy_payment_pending';end if;
 insert into public.checkout_yappy_attempts(order_id,provider_ref,expected_amount_cents,livemode,domain)
 values(o.id,p_ref,p_amount,p_live,p_domain) returning * into a;
 update public.checkout_orders set payment_in_progress=true,payment_hold_started_at=now(),payment_hold_expires_at=now()+interval '5 minutes' where id=o.id;
 return to_jsonb(a);
end;$$;

commit;
