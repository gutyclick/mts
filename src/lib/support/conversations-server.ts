import "server-only";
import { randomBytes } from "node:crypto";
import type { NextRequest } from "next/server";
import type { z } from "zod";
import { checkoutDatabase } from "../payments/checkout-server";
import { privateHash, validBrowserToken } from "../payments/checkout-core";
import {
  rpc,
  supportUser,
  supportOrders,
  supportQuota,
  SupportError,
} from "./server";
import {
  supportMessageSchema,
  supportThreadSchema,
  redactSupportText,
} from "./model";
import {
  conversationTopicNames,
  guestSupportCookie,
  type conversationRequest,
} from "./conversations";

export type ConversationActor = {
  user: string | null;
  guest: string | null;
  identity: string;
};
export async function conversationActor(
  request: NextRequest,
  token = request.cookies.get(guestSupportCookie)?.value,
): Promise<ConversationActor> {
  try {
    const user = await supportUser();
    return { user: user.id, guest: null, identity: user.id };
  } catch (e) {
    if (!(e instanceof SupportError && e.code === "auth_required")) throw e;
  }
  const secret = process.env.CHECKOUT_REQUEST_SECRET;
  if (!validBrowserToken(token) || !secret)
    throw new SupportError("auth_required");
  const hash = privateHash(`support-guest:${token}`, secret);
  return { user: null, guest: hash, identity: `guest:${hash.slice(0, 16)}` };
}
export function conversationToken(request: NextRequest) {
  const current = request.cookies.get(guestSupportCookie)?.value;
  return validBrowserToken(current) ? current : randomBytes(32).toString("hex");
}
export const actorArgs = (actor: ConversationActor) => ({
  p_user: actor.user,
  p_guest: actor.guest,
});
function owned(actor: ConversationActor) {
  const query = checkoutDatabase().from("support_threads").select("*");
  return actor.user
    ? query.eq("user_id", actor.user)
    : query.is("user_id", null).eq("guest_hash", actor.guest!);
}
export async function conversationPolicy() {
  const { data, error } = await checkoutDatabase()
    .from("support_settings")
    .select("idle_minutes")
    .eq("id", true)
    .single();
  if (error || !data) throw new SupportError("unavailable");
  return data.idle_minutes * 60;
}
export async function conversationDetail(actor: ConversationActor, id: string) {
  // The database decides if the deadline has passed, including requests from old tabs.
  const raw = await rpc("support_conversation_close", {
    ...actorArgs(actor),
    p_thread: id,
    p_reason: "inactivity",
  });
  const thread = supportThreadSchema.parse(raw);
  const { data, error } = await checkoutDatabase()
    .from("support_messages")
    .select("id,thread_id,author,body,citations,created_at")
    .eq("thread_id", thread.id)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(50);
  if (error) throw new SupportError("unavailable");
  return {
    thread,
    messages: data.map((m) => supportMessageSchema.parse(m)).reverse(),
    idleSeconds: await conversationPolicy(),
    serverTime: new Date().toISOString(),
  };
}
export async function conversationSession(request: NextRequest, token: string) {
  const actor = await conversationActor(request, token),
    idleSeconds = await conversationPolicy();
  let result = await owned(actor)
    .order("updated_at", { ascending: false })
    .limit(20);
  if (result.error) throw new SupportError("unavailable");
  const expired = (result.data ?? []).filter(
    (t) =>
      t.status === "chat" &&
      new Date(t.updated_at).getTime() + idleSeconds * 1000 <= Date.now(),
  );
  for (const t of expired)
    await rpc("support_conversation_close", {
      ...actorArgs(actor),
      p_thread: t.id,
      p_reason: "inactivity",
    });
  if (expired.length)
    result = await owned(actor)
      .order("updated_at", { ascending: false })
      .limit(20);
  if (result.error) throw new SupportError("unavailable");
  const conversations = (result.data ?? []).map((t) =>
    supportThreadSchema.parse(t),
  );
  return {
    authenticated: !!actor.user,
    identity: actor.identity,
    ai:
      process.env.SUPPORT_AI_ENABLED === "true" && !!process.env.OPENAI_API_KEY,
    orders: actor.user ? await supportOrders(actor.user) : [],
    chatId: conversations.find((t) => t.status === "chat")?.id ?? null,
    conversations,
    idleSeconds,
    serverTime: new Date().toISOString(),
  };
}
export async function mutateConversation(
  actor: ConversationActor,
  body: z.infer<typeof conversationRequest>,
  request: NextRequest,
) {
  const ip = (
    request.headers.get("x-vercel-forwarded-for") ??
    request.headers.get("x-forwarded-for") ??
    "local"
  ).slice(0, 200);
  await supportQuota(actor.user ?? ip, "conversation-write", 60);
  if (body.action === "start") {
    await supportQuota(actor.user ?? ip, "conversation-start", 20);
    const raw = await rpc("support_conversation_open", {
      ...actorArgs(actor),
      p_id: body.requestId,
      p_topic: body.topic,
      p_subject: conversationTopicNames[body.locale][body.topic],
      p_locale: body.locale,
      p_language: body.language,
    });
    return conversationDetail(actor, supportThreadSchema.parse(raw).id);
  }
  const raw =
    body.action === "close"
      ? await rpc("support_conversation_close", {
          ...actorArgs(actor),
          p_thread: body.threadId,
          p_reason: body.reason,
        })
      : await rpc("support_conversation_rate", {
          ...actorArgs(actor),
          p_thread: body.threadId,
          p_rating: body.rating,
          p_comment: redactSupportText(body.comment),
        });
  return { thread: supportThreadSchema.parse(raw) };
}
