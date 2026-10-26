import test from "node:test";
import assert from "node:assert/strict";
import { supportAnswer } from "../src/lib/support/ai.ts";
import { supportEmail } from "../src/lib/support/email.ts";
import { safeAccountNext } from "../src/lib/auth-routes.ts";
import {
  redactSupportText,
  chatRequest,
  visibleReferences,
} from "../src/lib/support/model.ts";
test("support strips installation credentials, API keys and long card/ICCID strings from free text", () => {
  const value = redactSupportText(
    "LPA:1$rsp.example.com$PRIVATECODE sk-proj-" +
      "a".repeat(40) +
      " 4242424242424242",
  );
  assert.ok(!value.includes("PRIVATECODE"));
  assert.ok(!value.includes("4242424242424242"));
  assert.ok(!value.includes("sk-proj-"));
  assert.equal(
    redactSupportText("Mi plan de 5 GB dura 30 días."),
    "Mi plan de 5 GB dura 30 días.",
  );
});
test("AI transport uses no tools or stored responses, redacts text and only resolves known citations", async () => {
  let payload;
  const answer = await supportAnswer(
    {
      message: "Install LPA:1$rsp.example.com$PRIVATE",
      language: "pt",
      locale: "es",
      history: [],
      order: { reference: "12345678", test: true },
    },
    { OPENAI_API_KEY: "sk-fixture", SUPPORT_AI_ENABLED: "true" },
    async (url, init) => {
      assert.equal(url, "https://api.openai.com/v1/responses");
      payload = JSON.parse(init.body);
      assert.equal(payload.store, false);
      assert.equal(payload.tools, undefined);
      assert.equal(payload.text.format.strict, true);
      assert.equal(payload.reasoning.effort, "none");
      assert.ok(!payload.input.includes("PRIVATE"));
      return new Response(
        JSON.stringify({
          status: "completed",
          output: [
            {
              type: "message",
              content: [
                {
                  type: "output_text",
                  text: JSON.stringify({
                    answer: "Consulte o guia de instalação.",
                    references: ["install-esim", "https://evil.invalid"],
                    escalate: false,
                  }),
                },
              ],
            },
          ],
        }),
        { status: 200 },
      );
    },
  );
  assert.ok(payload.instructions.includes("pt"));
  assert.equal(answer.references.length, 1);
  assert.ok(!JSON.stringify(answer).includes("evil.invalid"));
  await assert.rejects(
    supportAnswer(
      {
        message: "hi",
        language: "auto",
        locale: "en",
        history: [],
        order: null,
      },
      { SUPPORT_AI_ENABLED: "false" },
      async () => {
        throw new Error("must not call");
      },
    ),
    /AI unavailable/,
  );
});
test("support mail escapes untrusted subject and redirects preserve only known private ticket routes", () => {
  const id = "12345678-1234-4234-9234-123456789abc",
    mail = supportEmail({
      locale: "en",
      reference: "MTS-12345678",
      subject: "<img src=x onerror=alert(1)>",
      customer: false,
      link: `https://www.mytripsim.com/en/admin/tickets?ticket=${id}`,
    });
  assert.ok(!mail.html.includes("<img"));
  assert.ok(mail.html.includes("&lt;img"));
  assert.ok(mail.text.includes("Sign-in required"));
  assert.equal(
    safeAccountNext(
      `/es/support?ticket=${id}&redirect=https://evil.invalid`,
      "es",
    ),
    `/es/support?ticket=${id}`,
  );
  assert.equal(safeAccountNext("//evil.invalid", "es"), "/es/mis-esim");
  assert.equal(
    safeAccountNext("/es/admin/tickets?ticket=bad", "es"),
    "/es/admin/tickets",
  );
});
test("chat payloads are bounded and citations resolve only to approved local help", () => {
  assert.equal(
    chatRequest.safeParse({
      message: "a".repeat(3001),
      requestId: "bad",
      language: "es",
    }).success,
    false,
  );
  const refs = visibleReferences(
    ["data-roaming", "https://evil.invalid", "activation-start"],
    "es",
  );
  assert.ok(refs.length > 0);
  assert.ok(refs.every((r) => r.href.startsWith("/es/preguntas-frecuentes/")));
  assert.ok(!JSON.stringify(refs).includes("evil.invalid"));
});
