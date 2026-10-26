import "server-only";
import { NextRequest } from "next/server";
import { z } from "zod";
import { authClient } from "../supabase/auth-server";
import { adminSession } from "../admin/server";
import { checkoutDatabase, paymentOrigin } from "../payments/checkout-server";
import { privateHash } from "../payments/checkout-core";
import {
  redactSupportText,
  supportMessageSchema,
  supportThreadSchema,
  type ticketRequest,
} from "./model";
export class SupportError extends Error {
  code: string;
  constructor(code: string) {
    super("Support request failed");
    this.code = code;
  }
}
export const supportStatus = (e: unknown) =>
  e instanceof SupportError
    ? ((
        {
          auth_required: 401,
          forbidden: 403,
          not_found: 404,
          invalid: 400,
          busy: 409,
          ticket_active: 409,
          conversation_closed: 409,
          conversation_active: 409,
          active_conversation: 409,
          already_rated: 409,
          rating_unavailable: 409,
          rate_limited: 429,
        } as Record<string, number>
      )[e.code] ?? 503)
    : 503;
export async function supportUser(staff = false) {
  if (staff) {
    const s = await adminSession();
    if (!s.user) throw new SupportError("auth_required");
    if (!s.admin) throw new SupportError("forbidden");
    return s.user;
  }
  const {
    data: { user },
    error,
  } = await (await authClient()).auth.getUser();
  if (error && error.status && error.status >= 500)
    throw new SupportError("unavailable");
  if (!user?.email_confirmed_at) throw new SupportError("auth_required");
  return user;
}
export function supportOrigin(request: NextRequest) {
  if (request.headers.get("origin") !== paymentOrigin())
    throw new SupportError("forbidden");
}
export async function supportJSON(request: NextRequest, max = 32000) {
  if (Number(request.headers.get("content-length")) > max)
    throw new SupportError("invalid");
  const text = await request.text();
  if (text.length > max) throw new SupportError("invalid");
  try {
    return JSON.parse(text);
  } catch {
    throw new SupportError("invalid");
  }
}
export async function rpc(name: string, args: Record<string, unknown>) {
  const { data, error } = await checkoutDatabase().rpc(name, args);
  if (error) {
    const message = error.message ?? "";
    if (/(?:order|thread|ticket|request)_unavailable/.test(message))
      throw new SupportError("not_found");
    if (/thread_escalated/.test(message))
      throw new SupportError("ticket_active");
    for (const code of [
      "conversation_closed",
      "conversation_active",
      "already_rated",
      "active_conversation",
      "rating_unavailable",
    ])
      if (message.includes(code)) throw new SupportError(code);
    if (/chat_busy|request_conflict/.test(message))
      throw new SupportError("busy");
    throw new SupportError("unavailable");
  }
  return data;
}
export async function supportQuota(
  identity: string,
  kind: string,
  limit: number,
  period = "hour",
) {
  const secret = process.env.CHECKOUT_REQUEST_SECRET;
  if (!secret) throw new SupportError("unavailable");
  const result = await rpc("support_take_quota", {
    p_key: privateHash(`${kind}:${identity}`, secret),
    p_limit: limit,
    p_period: period,
  });
  if (result !== true) throw new SupportError("rate_limited");
}
export async function supportOrders(userId: string) {
  const { data, error } = await checkoutDatabase()
    .from("checkout_orders")
    .select("id,status,created_at,items:checkout_order_items(plan_name)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw new SupportError("unavailable");
  return data ?? [];
}
export async function ownedOrderContext(userId: string, id: string) {
  const db = checkoutDatabase();
  const { data: order, error } = await db
    .from("checkout_orders")
    .select("id,status,livemode,created_at")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new SupportError("unavailable");
  if (!order) throw new SupportError("not_found");
  const [items, units] = await Promise.all([
    db
      .from("checkout_order_items")
      .select("plan_name,data_gb,days,quantity,destination_slug")
      .eq("order_id", id),
    db
      .from("esim_fulfillments")
      .select(
        "state,provider_status,volume_bytes,used_bytes,provider_checked_at,provider_usage_updated_at,expires_at",
      )
      .eq("order_id", id),
  ]);
  if (items.error || units.error) throw new SupportError("unavailable");
  return {
    reference: order.id.slice(0, 8).toUpperCase(),
    paymentStatus: order.status,
    test: !order.livemode,
    plans: items.data,
    esims: units.data,
    emailMeaning:
      "sent means accepted for sending, not proof of delivery or installation",
  };
}
export async function readSupportThread(
  actor: string,
  id: string,
  staff: boolean,
  page = 1,
) {
  const db = checkoutDatabase();
  let q = db
    .from("support_threads")
    .select(
      "id,subject,status,language,order_id,created_at,updated_at,escalated_at,user_id,topic,closed_at,close_reason,rating,rating_comment,rated_at",
    )
    .eq("id", id);
  if (!staff) q = q.eq("user_id", actor);
  const { data: thread, error } = await q.maybeSingle();
  if (error) throw new SupportError("unavailable");
  if (!thread) throw new SupportError("not_found");
  const {
    data: messages,
    error: messageError,
    count,
  } = await db
    .from("support_messages")
    .select("id,thread_id,author,body,citations,created_at", { count: "exact" })
    .eq("thread_id", id)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range((page - 1) * 50, page * 50 - 1);
  if (messageError) throw new SupportError("unavailable");
  return {
    thread: supportThreadSchema.parse(thread),
    messages: z.array(supportMessageSchema).parse(messages).reverse(),
    total: count ?? 0,
    page,
    order: thread.order_id
      ? await ownedOrderContext(thread.user_id, thread.order_id)
      : null,
  };
}
export async function listSupport(
  actor: string,
  staff: boolean,
  status: string,
  q: string,
  page: number,
) {
  const data = await rpc("support_ticket_list", {
    p_actor: actor,
    p_staff: staff,
    p_status: status,
    p_query: q,
    p_page: page,
  });
  return z
    .object({
      total: z.number().nonnegative(),
      page: z.number(),
      rows: z.array(supportThreadSchema),
    })
    .parse(data);
}
export async function mutateSupport(
  actor: string,
  body: z.infer<typeof ticketRequest>,
  staff: boolean,
  locale: "es" | "en",
) {
  await supportQuota(actor, "support-write", 40);
  if (body.action === "create") {
    if (staff) throw new SupportError("invalid");
    await supportQuota(actor, "ticket-create", 5);
    const id = await rpc("support_ticket_create", {
      p_user: actor,
      p_thread: body.threadId ?? null,
      p_request: body.requestId,
      p_subject: redactSupportText(body.subject),
      p_body: redactSupportText(body.body),
      p_language: body.language,
      p_locale: locale,
      p_order: body.orderId ?? null,
    });
    return { id: z.uuid().parse(id) };
  }
  const data =
    body.action === "reply"
      ? await rpc("support_ticket_reply", {
          p_actor: actor,
          p_thread: body.threadId,
          p_request: body.requestId,
          p_body: redactSupportText(body.body),
          p_staff: staff,
        })
      : await rpc("support_ticket_resolve", {
          p_actor: actor,
          p_thread: body.threadId,
          p_staff: staff,
        });
  if (data !== true) throw new SupportError("unavailable");
  return { id: body.threadId };
}
