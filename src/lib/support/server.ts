import "server-only";
import { NextRequest } from "next/server";
import { z } from "zod";
import { authClient } from "../supabase/auth-server";
import { adminSession } from "../admin/server";
import { checkoutDatabase, paymentOrigin } from "../payments/checkout-server";
import { privateHash } from "../payments/checkout-core";
import { supportAnswer } from "./ai";
import {
  redactSupportText,
  supportMessageSchema,
  supportThreadSchema,
  type SupportMessage,
  type chatRequest,
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
async function rpc(name: string, args: Record<string, unknown>) {
  const { data, error } = await checkoutDatabase().rpc(name, args);
  if (error) {
    const message = error.message ?? "";
    if (/(?:order|thread|ticket|request)_unavailable/.test(message))
      throw new SupportError("not_found");
    if (/thread_escalated/.test(message))
      throw new SupportError("ticket_active");
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
      "id,subject,status,language,order_id,created_at,updated_at,escalated_at,user_id",
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
export async function supportSession() {
  let user;
  try {
    user = await supportUser();
  } catch (e) {
    if (e instanceof SupportError && e.code === "auth_required")
      return {
        authenticated: false,
        ai:
          process.env.SUPPORT_AI_ENABLED === "true" &&
          !!process.env.OPENAI_API_KEY,
      };
    throw e;
  }
  const [orders, chat] = await Promise.all([
    supportOrders(user.id),
    checkoutDatabase()
      .from("support_threads")
      .select("id")
      .eq("user_id", user.id)
      .eq("status", "chat")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (chat.error) throw new SupportError("unavailable");
  return {
    authenticated: true,
    identity: user.id,
    ai:
      process.env.SUPPORT_AI_ENABLED === "true" && !!process.env.OPENAI_API_KEY,
    orders,
    chatId: chat.data?.id ?? null,
  };
}
export async function chatSupport(
  body: z.infer<typeof chatRequest>,
  request: NextRequest,
) {
  let user = null;
  try {
    user = await supportUser();
  } catch (e) {
    if (!(e instanceof SupportError && e.code === "auth_required")) throw e;
  }
  if ((body.threadId || body.orderId) && !user)
    throw new SupportError("auth_required");
  const ip = (
    request.headers.get("x-vercel-forwarded-for") ??
    request.headers.get("x-forwarded-for") ??
    "local"
  ).slice(0, 200);
  await supportQuota(user?.id ?? ip, "chat", user ? 60 : 12);
  const dayLimit = Math.max(
    1,
    Math.min(1000, Number(process.env.SUPPORT_DAILY_CHAT_LIMIT) || 300),
  );
  await supportQuota("global", "chat-budget", dayLimit, "day");
  let history = body.history,
    threadId: string | undefined,
    token: string | undefined;
  const message = redactSupportText(body.message);
  let order =
    body.orderId && user
      ? await ownedOrderContext(user.id, body.orderId)
      : null;
  if (user) {
    const start = z
      .object({
        id: z.uuid(),
        token: z.uuid().optional(),
        replay: z.boolean(),
        answer: supportMessageSchema.nullable().optional(),
      })
      .parse(
        await rpc("support_chat_start", {
          p_user: user.id,
          p_thread: body.threadId ?? null,
          p_request: body.requestId,
          p_body: message,
          p_language: body.language,
          p_locale: body.locale,
          p_order: body.orderId ?? null,
        }),
      );
    threadId = start.id;
    token = start.token;
    if (start.replay) {
      if (!start.answer) throw new SupportError("busy");
      return {
        threadId,
        message: start.answer,
        escalate: false,
        ai: start.answer.author === "assistant",
      };
    }
    const thread = await readSupportThread(user.id, threadId, false);
    history = thread.messages
      .filter((m) => m.id !== body.requestId)
      .slice(-6)
      .map((m) => ({
        role: m.author === "user" ? ("user" as const) : ("assistant" as const),
        body: m.body,
      }));
    order = thread.order;
  }
  let answer,
    ai = true;
  try {
    answer = await supportAnswer(
      { message, language: body.language, locale: body.locale, history, order },
      process.env,
    );
  } catch {
    ai = false;
    answer = {
      answer:
        body.locale === "es"
          ? "SIM no puede generar una respuesta ahora. Puedes consultar nuestra ayuda o enviar tu consulta al equipo; no se ha creado un ticket todavía."
          : "SIM can’t generate an answer right now. Browse our help or send your question to the team; no ticket has been created yet.",
      references: [],
      escalate: true,
    };
  }
  let saved: SupportMessage;
  if (user && threadId && token) {
    const result = await rpc("support_chat_finish", {
      p_user: user.id,
      p_thread: threadId,
      p_token: token,
      p_request: body.requestId,
      p_body: answer.answer,
      p_citations: answer.references,
      p_ai: ai,
    });
    if (!result) throw new SupportError("ticket_active");
    saved = supportMessageSchema.parse(result);
  } else
    saved = {
      id: crypto.randomUUID(),
      thread_id: crypto.randomUUID(),
      author: ai ? "assistant" : "system",
      body: answer.answer,
      citations: answer.references,
      created_at: new Date().toISOString(),
    };
  return {
    threadId: threadId ?? null,
    message: saved,
    escalate: answer.escalate,
    ai,
  };
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
