import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  businessBody,
  businessHeaders,
  businessIdentity,
  businessWorkspace,
} from "@/lib/portal/server";
import {
  commerceCustomerAction,
  commerceError,
} from "@/lib/portal/commerce-validation";
import {
  commerceReadiness,
  commercialOrder,
} from "@/lib/portal/commerce-server";
import { paymentMode } from "@/lib/payments/checkout-server";
import {
  beginBusinessPayment,
  recordBusinessPayment,
} from "@/lib/portal/commerce-payments";
export const runtime = "nodejs";
export const maxDuration = 60;
const reply = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: businessHeaders });
export async function GET(request: NextRequest) {
  try {
    const { client, user, needsMfa } = await businessIdentity();
    if (!user) return reply({ error: "unauthorized" }, 401);
    if (needsMfa) return reply({ error: "mfa_required" }, 428);
    const trip = z.uuid().safeParse(request.nextUrl.searchParams.get("tripId"));
    if (!trip.success) return reply({ error: "invalid" }, 400);
    const result = await client.rpc("b2b_commerce_workspace", {
      p_trip: trip.data,
    });
    if (result.error) return reply({ error: "forbidden" }, 403);
    const snapshot = z
      .object({
        order: z.record(z.string(), z.unknown()).nullable(),
        units: z.array(z.object({ id: z.uuid(), state: z.string() })),
        payment_methods: z.object({
          stripe: z.boolean(),
          transfer: z.boolean(),
          yappy: z.boolean(),
        }),
        bank_instructions: z.string(),
      })
      .parse(result.data);
    const readiness = commerceReadiness();
    return reply({
      order: snapshot.order
        ? {
            ...snapshot.order,
            units: snapshot.units.map((u) => ({ id: u.id, status: u.state })),
          }
        : null,
      methods: {
        stripe: snapshot.payment_methods.stripe && readiness.stripe,
        transfer: snapshot.payment_methods.transfer,
        yappy: snapshot.payment_methods.yappy && readiness.yappy,
      },
      bankInstructions: snapshot.bank_instructions,
      yappyLive: paymentMode(process.env) === "live",
    });
  } catch {
    return reply({ error: "unavailable" }, 503);
  }
}
export async function POST(request: NextRequest) {
  try {
    const input = commerceCustomerAction.safeParse(await businessBody(request));
    if (!input.success) return reply({ error: "invalid" }, 400);
    const { client, user, needsMfa } = await businessIdentity();
    if (!user) return reply({ error: "unauthorized" }, 401);
    if (needsMfa) return reply({ error: "mfa_required" }, 428);
    const workspace = await businessWorkspace(client),
      order = await commercialOrder(input.data.orderId);
    const membership = workspace.companies.find(
      (c) => c.id === order.company_id,
    );
    if (
      !membership ||
      !["owner", "finance"].includes(membership.role) ||
      workspace.restricted
    )
      return reply({ error: "forbidden" }, 403);
    const scoped = await client.rpc("b2b_commerce_workspace", {
      p_trip: order.trip_id,
    });
    if (scoped.error) return reply({ error: "forbidden" }, 403);
    if (input.data.action === "transfer_notice") {
      if (!input.data.reference) return reply({ error: "invalid" }, 400);
      await recordBusinessPayment("transfer_notice", {
        actor: user.id,
        order_id: order.id,
        reference: input.data.reference,
      });
      return reply({ ok: true });
    }
    const locale = request.headers.get("referer")?.includes("/en/")
      ? "en"
      : "es";
    return reply(
      await beginBusinessPayment(order.id, user.id, input.data.action, locale),
    );
  } catch (error) {
    const code = commerceError(error);
    return reply({ error: code }, code === "unavailable" ? 503 : 409);
  }
}
