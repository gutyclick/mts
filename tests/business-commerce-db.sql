begin;
-- Run against a disposable migrated database as migration owner; all fixtures roll back.
do $$
#variable_conflict use_variable
declare admin_id uuid:=gen_random_uuid();owner_id uuid:=gen_random_uuid();outsider uuid:=gen_random_uuid();company uuid:=gen_random_uuid();trip uuid:=gen_random_uuid();request uuid:=gen_random_uuid();attempt uuid:=gen_random_uuid();order_id uuid;plan public.catalog_plans;binding public.provider_package_bindings;v jsonb;v2 jsonb;failure text;unit public.b2b_units;
begin
 if has_function_privilege('authenticated','public.b2b_commerce_admin(uuid,text,jsonb)','EXECUTE') or has_function_privilege('anon','public.b2b_commerce_payment(text,jsonb)','EXECUTE') or has_function_privilege('authenticated','public.claim_b2b_units(integer)','EXECUTE') then raise exception 'privilege_leak';end if;
 if has_table_privilege('authenticated','public.b2b_orders','SELECT') or has_table_privilege('authenticated','public.b2b_units','UPDATE') or has_table_privilege('service_role','public.b2b_orders','UPDATE') then raise exception 'table_privilege_leak';end if;
 if exists(select 1 from public.b2b_commerce_settings where stripe_enabled or bank_enabled or yappy_enabled or issuance_enabled) then raise exception 'test_requires_default_disabled_settings';end if;
 select p.* into plan from public.catalog_plans p join public.catalog_available_plan_ids a on a.id=p.id join public.provider_package_bindings b on b.plan_id=p.id join public.catalog_destinations d on d.slug=p.destination_slug where p.is_published and p.kind='fixed' and b.is_available and d.is_published and lower(p.id)!~'_(premium|iij|usip|nonhkip|myip)$' limit 1;
 if plan.id is null then raise exception 'available_catalog_fixture_required';end if;
 select * into binding from public.provider_package_bindings where plan_id=plan.id;
 -- Make merchandising deterministic inside this rollback-only test.
 delete from public.catalog_plan_merchandising where plan_id=plan.id;
 delete from public.catalog_destination_merchandising where destination_slug=plan.destination_slug;
 insert into auth.users(id,email,email_confirmed_at) values(admin_id,admin_id::text||'@example.invalid',now()),(owner_id,owner_id::text||'@example.invalid',now()),(outsider,outsider::text||'@example.invalid',now());
 insert into public.admin_memberships(user_id) values(admin_id);
 insert into public.b2b_organizations(id,name) values(company,'Commerce rollback fixture');
 insert into public.b2b_memberships(company_id,user_id,role) values(company,owner_id,'owner');
 insert into public.b2b_trips(id,company_id,created_by,name,destination_slug,departure,return_date,travelers,mode) values(trip,company,owner_id,'Fixture',plan.destination_slug,current_date+1,current_date+1,2,'package');
 insert into public.b2b_order_requests(id,company_id,trip_id,attempt_id,created_by,plan_id,plan_name,data_gb,days,quantity) values(request,company,trip,gen_random_uuid(),owner_id,plan.id,plan.name,plan.data_gb,plan.days,2);
 failure:=null;begin perform public.b2b_commerce_admin(outsider,'save_settings','{}');exception when others then failure:=sqlerrm;end;if failure is distinct from 'admin_required' then raise exception 'admin_gate';end if;
 perform public.b2b_commerce_admin(admin_id,'save_settings','{"stripe_enabled":true,"bank_enabled":true,"bank_instructions":"Fixture bank only","issuance_enabled":true}');
 insert into public.simcoins_private_costs(plan_id,wholesale_unit_units,observed_at) values(plan.id,10000,now()-interval '16 minutes') on conflict(plan_id) do update set wholesale_unit_units=10000,observed_at=excluded.observed_at;
 failure:=null;begin perform public.b2b_commerce_admin(admin_id,'publish_quote',jsonb_build_object('request_id',request,'version',1,'unit_cents',1000));exception when others then failure:=sqlerrm;end;if failure is distinct from 'fresh_cost_required' then raise exception 'stale_cost_guard: %',failure;end if;
 update public.simcoins_private_costs set observed_at=now() where plan_id=plan.id;
 failure:=null;begin perform public.b2b_commerce_admin(admin_id,'publish_quote',jsonb_build_object('request_id',request,'version',2,'unit_cents',1000));exception when others then failure:=sqlerrm;end;if failure is distinct from 'request_conflict' then raise exception 'stale_version_guard';end if;
 failure:=null;begin perform public.b2b_commerce_admin(admin_id,'publish_quote',jsonb_build_object('request_id',request,'version',1,'unit_cents',100));exception when others then failure:=sqlerrm;end;if failure is distinct from 'insufficient_margin' then raise exception 'margin_guard: %',failure;end if;
 order_id:=public.b2b_commerce_admin(admin_id,'publish_quote',jsonb_build_object('request_id',request,'version',1,'unit_cents',1000,'tax_cents',10));
 if order_id is distinct from public.b2b_commerce_admin(admin_id,'publish_quote',jsonb_build_object('request_id',request,'version',1,'unit_cents',2000)) then raise exception 'quote_not_idempotent';end if;
 if (select total_cents from public.b2b_orders where id=order_id)<>2010 then raise exception 'quote_mutated';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',outsider,'role','authenticated')::text,true);
 failure:=null;begin perform public.b2b_commerce_workspace(trip);exception when others then failure:=sqlerrm;end;if failure is distinct from 'company_required' then raise exception 'tenant_read_guard';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'role','authenticated')::text,true);
 v:=public.b2b_commerce_workspace(trip);if v::text~'wholesale|activation_code|smdp_address|package_code' then raise exception 'workspace_secret';end if;
 failure:=null;begin perform public.b2b_commerce_admin(admin_id,'release',jsonb_build_object('order_id',order_id));exception when others then failure:=sqlerrm;end;if failure is distinct from 'payment_required' then raise exception 'unpaid_release';end if;
 v:=jsonb_build_object('id',attempt,'order_id',order_id,'actor',owner_id,'method','stripe','expected_amount_cents',2010,'livemode',false,'provider_ref',attempt::text,'locale','en');
 v2:=public.b2b_commerce_payment('begin',v);
 if v2->>'id' is distinct from(public.b2b_commerce_payment('begin',v||jsonb_build_object('id',gen_random_uuid())))->>'id' then raise exception 'duplicate_attempt';end if;
 failure:=null;begin perform public.b2b_commerce_admin(admin_id,'confirm_transfer',jsonb_build_object('order_id',order_id,'amount_cents',2010,'reference','fixture'));exception when others then failure:=sqlerrm;end;if failure is distinct from 'active_payment_attempt' then raise exception 'competing_transfer';end if;
 failure:=null;begin perform public.b2b_commerce_payment('settle',jsonb_build_object('id',attempt,'provider_ref',attempt::text,'amount_cents',2011,'currency','USD','livemode',false,'status','succeeded'));exception when others then failure:=sqlerrm;end;if failure is distinct from 'payment_mismatch' then raise exception 'payment_amount_guard';end if;
 v:=jsonb_build_object('id',attempt,'provider_ref',attempt::text,'amount_cents',2010,'currency','USD','livemode',false,'status','succeeded');
 perform public.b2b_commerce_payment('settle',v);perform public.b2b_commerce_payment('settle',v);
 failure:=null;begin perform public.b2b_commerce_admin(admin_id,'release',jsonb_build_object('order_id',order_id));exception when others then failure:=sqlerrm;end;if failure is distinct from 'test_payment_not_fulfillable' then raise exception 'test_mode_release_guard';end if;
 -- Synthetic DB-only live fixture; no provider or payment APIs are called by this test.
 update public.b2b_payment_attempts set livemode=true where id=attempt;
 perform public.b2b_commerce_admin(admin_id,'release',jsonb_build_object('order_id',order_id));perform public.b2b_commerce_admin(admin_id,'release',jsonb_build_object('order_id',order_id));
 if(select count(*) from public.b2b_units where b2b_units.order_id=order_id)<>2 then raise exception 'duplicate_unit_slots';end if;
 v:=public.claim_b2b_units(1);if jsonb_array_length(v)<>1 then raise exception 'unit_claim';end if;
 select * into unit from public.b2b_units where id=(v->0->>'id')::uuid;
 if public.update_b2b_unit(unit.id,gen_random_uuid(),'{"state":"review"}') then raise exception 'lease_fencing';end if;
 if not public.update_b2b_unit(unit.id,unit.lease_token,'{"state":"provider_pending","provider_order_no":"fixture-provider-order","attempts":0}') then raise exception 'lease_update';end if;
 if public.update_b2b_unit(unit.id,unit.lease_token,'{"state":"review"}') then raise exception 'lease_replay';end if;
 perform public.b2b_commerce_payment('refund',jsonb_build_object('id',attempt,'provider_ref',attempt::text,'amount_cents',1,'livemode',true));
 if jsonb_array_length(public.claim_b2b_units(100))<>0 then raise exception 'refund_claim_guard';end if;
 failure:=null;begin perform public.b2b_commerce_admin(admin_id,'release',jsonb_build_object('order_id',order_id));exception when others then failure:=sqlerrm;end;if failure is distinct from 'manual_review_required' then raise exception 'refund_release_guard';end if;
end;$$;
rollback;
