import "server-only";
import { supportCatalog } from "./catalog-server";
import {
  planReferences,
  directPlanRecommendation,
  catalogPlanRecommendation,
} from "./chat-catalog";
import { z } from "zod";
import type { NextRequest } from "next/server";
import { chatRequest, redactSupportText, supportMessageSchema } from "./model";
import { supportAnswer } from "./ai";
import { rpc, supportQuota, ownedOrderContext, SupportError } from "./server";
import {
  actorArgs,
  conversationActor,
  conversationDetail,
} from "./conversations-server";

export async function chatSupport(
  body: z.infer<typeof chatRequest>,
  request: NextRequest,
) {
  const actor = await conversationActor(request);
  if (body.orderId && !actor.user) throw new SupportError("auth_required");
  const ip = (
    request.headers.get("x-vercel-forwarded-for") ??
    request.headers.get("x-forwarded-for") ??
    "local"
  ).slice(0, 200);
  await supportQuota(actor.user ?? ip, "chat", actor.user ? 60 : 12);
  await supportQuota(
    "global",
    "chat-budget",
    Math.max(
      1,
      Math.min(1000, Number(process.env.SUPPORT_DAILY_CHAT_LIMIT) || 300),
    ),
    "day",
  );
  const message = redactSupportText(body.message);
  let id = body.threadId;
  if (!id) {
    const opened = await rpc("support_conversation_open", {
      ...actorArgs(actor),
      p_id: body.requestId,
      p_topic: "general",
      p_subject: message.slice(0, 120),
      p_locale: body.locale,
      p_language: body.language,
    });
    id = z.uuid().parse(opened.id);
  }
  const start = await rpc("support_conversation_chat_start", {
    ...actorArgs(actor),
    p_thread: id,
    p_request: body.requestId,
    p_body: message,
    p_language: body.language,
    p_order: body.orderId ?? null,
  });
  if (start.closed) throw new SupportError("conversation_closed");
  if (start.replay) {
    if (!start.answer) throw new SupportError("busy");
    const detail = await conversationDetail(actor, id);
    return {
      threadId: id,
      thread: detail.thread,
      message: supportMessageSchema.parse(start.answer),
      escalate: false,
      ai: start.answer.author === "assistant",
    };
  }
  const token = z.uuid().parse(start.token);
  const detail = await conversationDetail(actor, id);
  const history = detail.messages
    .filter(
      (m) =>
        m.id !== body.requestId &&
        (m.author === "user" || m.author === "assistant"),
    )
    .slice(-6)
    .map((m) => ({
      role: m.author,
      body:
        m.body +
        (m.author === "assistant" &&
        m.citations.some((c) => "kind" in c && c.kind === "plan")
          ? "\nPlan cards shown in order: " +
            JSON.stringify(
              m.citations.filter((c) => "kind" in c && c.kind === "plan"),
            )
          : ""),
    }));

  let answer,
    ai = true;
  try {
    const order =
      detail.thread.order_id && actor.user
        ? await ownedOrderContext(actor.user, detail.thread.order_id)
        : null;
    const catalog = await supportCatalog(
      [...history.filter((m) => m.role === "user").map((m) => m.body), message],
      detail.thread.topic ?? "general",
    ).catch(() => null);
    const direct =
      !order && catalog
        ? directPlanRecommendation(message, catalog.plans, body.locale)
        : null;
    answer = direct
      ? { ...direct, references: [], escalate: false }
      : await supportAnswer(
          {
            message,
            language: body.language,
            locale: body.locale,
            history,
            order,
            topic: detail.thread.topic,
            catalog: catalog
              ? {
                  destination: catalog.destination.name[body.locale],
                  plans: catalog.plans,
                }
              : null,
          },
          process.env,
        );
    const wantsPlans =
      /\bplans?\b|paquet|recom|compr|buy|precio|price|\bgb\b|opci[oó]n|option|segund|second/i.test(
        message,
      );
    // Never expose a model-written recommendation when we can state verified catalog facts.
    const recommendedId = answer.planIds[0];
    const recommended =
      !order && catalog && wantsPlans
        ? catalog.plans.find((plan) => plan.id === recommendedId)
        : undefined;
    if (!direct && recommended)
      answer = {
        ...answer,
        ...catalogPlanRecommendation(recommended, body.locale),
      };
    const cards =
      catalog && wantsPlans
        ? planReferences(
            answer.planIds,
            catalog.plans,
            catalog.destination,
            body.locale,
          )
        : [];
    answer = {
      ...answer,
      references: [...cards, ...answer.references].slice(0, 4),
    };
  } catch {
    ai = false;
    answer = {
      answer:
        body.locale === "es"
          ? "SIM no puede responder ahora. Puedes consultar la ayuda o enviar tu consulta al equipo; todavía no se ha creado un ticket."
          : "SIM cannot respond right now. Browse our help or send your request to the team; no ticket has been created yet.",
      references: [],
      escalate: true,
    };
  }
  const saved = await rpc("support_conversation_chat_finish", {
    ...actorArgs(actor),
    p_thread: id,
    p_token: token,
    p_request: body.requestId,
    p_body: answer.answer,
    p_citations: answer.references,
    p_ai: ai,
  });
  if (!saved) throw new SupportError("conversation_closed");
  const updated = await conversationDetail(actor, id);
  return {
    threadId: id,
    thread: updated.thread,
    message: supportMessageSchema.parse(saved),
    escalate: answer.escalate,
    ai,
  };
}
