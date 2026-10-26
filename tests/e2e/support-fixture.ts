import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import type {
  SupportMessage,
  SupportThread,
} from "../../src/lib/support/model";
type Thread = SupportThread & { messages: SupportMessage[] };
export async function mockMessenger(page: Page, authenticated = true) {
  const threads: Thread[] = [];
  let clock: number | null = null;
  const now = () => clock ?? Date.now();
  const stamp = () => new Date(now()).toISOString();
  const expire = () => {
    for (const t of threads)
      if (t.status === "chat" && Date.parse(t.updated_at) + 600000 <= now())
        Object.assign(t, {
          status: "resolved",
          close_reason: "inactivity",
          closed_at: stamp(),
        });
  };
  const detail = (t: Thread) => ({
    thread: t,
    messages: t.messages,
    idleSeconds: 600,
  });
  await page.route("**/api/support/session", (route) => {
    expire();
    return route.fulfill({
      json: {
        authenticated,
        identity: authenticated
          ? "12345678-1234-4234-9234-123456789def"
          : "guest:fixture",
        ai: true,
        orders: [],
        chatId: threads.find((t) => t.status === "chat")?.id ?? null,
        conversations: threads,
        idleSeconds: 600,
      },
    });
  });
  await page.route("**/api/support/conversations**", async (route) => {
    expire();
    if (route.request().method() === "GET") {
      const t = threads.find(
        (t) => t.id === new URL(route.request().url()).searchParams.get("id"),
      );
      return route.fulfill(
        t ? { json: detail(t) } : { status: 404, json: { error: "not_found" } },
      );
    }
    const d = route.request().postDataJSON();
    if (d.action === "start") {
      const t: Thread = {
        id: d.requestId,
        subject: d.topic,
        topic: d.topic,
        status: "chat",
        language: "auto",
        order_id: null,
        escalated_at: null,
        created_at: stamp(),
        updated_at: stamp(),
        rating: null,
        closed_at: null,
        close_reason: null,
        messages: [],
      };
      threads.unshift(t);
      return route.fulfill({ json: detail(t) });
    }
    const t = threads.find((t) => t.id === d.threadId);
    if (!t) return route.fulfill({ status: 404, json: { error: "not_found" } });
    if (d.action === "close") {
      if (
        d.reason === "resolved" ||
        (t.status === "chat" && Date.parse(t.updated_at) + 600000 <= now())
      )
        Object.assign(t, {
          status: "resolved",
          closed_at: stamp(),
          close_reason: d.reason,
        });
    }
    if (d.action === "rate")
      Object.assign(t, {
        rating: d.rating,
        rating_comment: d.comment,
        rated_at: stamp(),
      });
    return route.fulfill({ json: { thread: t } });
  });
  await page.route("**/api/support/chat", (route) => {
    const d = route.request().postDataJSON(),
      t = threads.find((t) => t.id === d.threadId)!;
    const reply: SupportMessage = {
      id: randomUUID(),
      thread_id: t.id,
      author: "assistant",
      body: "Use a Wi-Fi connection to install your eSIM.",
      citations: [],
      created_at: stamp(),
    };
    t.messages.push(
      { ...reply, id: d.requestId, author: "user", body: d.message },
      reply,
    );
    t.updated_at = stamp();
    return route.fulfill({
      json: { threadId: t.id, thread: t, message: reply, ai: true },
    });
  });
  return {
    threads,
    advance: (ms: number) => {
      clock = now() + ms;
    },
  };
}
