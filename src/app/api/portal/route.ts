import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { cookies } from "next/headers";
import {
  businessAction,
  businessError,
  workspaceSchema,
} from "@/lib/portal/business";
import {
  businessIdentity,
  businessWorkspace,
  businessSupport,
  businessBody,
  businessHeaders,
} from "@/lib/portal/server";
export const runtime = "nodejs";
const reply = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: businessHeaders });
export async function GET(request: NextRequest) {
  try {
    const { client, user, needsMfa } = await businessIdentity();
    if (!user) return reply({ error: "unauthorized" }, 401);
    if (needsMfa) return reply({ error: "mfa_required" }, 428);
    if (request.nextUrl.searchParams.get("catalog")) {
      const company = z
        .uuid()
        .safeParse(request.nextUrl.searchParams.get("company"));
      const destination = z
        .string()
        .min(1)
        .max(100)
        .safeParse(request.nextUrl.searchParams.get("catalog"));
      if (!company.success || !destination.success)
        return reply({ error: "invalid" }, 400);
      const result = await client.rpc("b2b_catalog", {
        p_company: company.data,
        p_destination: destination.data,
      });
      if (result.error)
        return reply({ error: businessError(result.error) }, 403);
      const plans = z
        .array(
          z.object({
            id: z.string(),
            name: z.string(),
            data_gb: z.coerce.number().positive(),
            days: z.number().int().positive(),
          }),
        )
        .parse(result.data);
      return reply({ plans });
    }
    const workspace = await businessWorkspace(client);
    return reply({
      workspace,
      support: workspace.company ? businessSupport() : null,
    });
  } catch {
    return reply({ error: "unavailable" }, 503);
  }
}
export async function POST(request: NextRequest) {
  try {
    const raw = await businessBody(request);
    const { client, user, needsMfa } = await businessIdentity();
    if (!user) return reply({ error: "unauthorized" }, 401);
    if (needsMfa) return reply({ error: "mfa_required" }, 428);
    const selection = z
      .object({ action: z.literal("select_company"), companyId: z.uuid() })
      .strict()
      .safeParse(raw);
    if (selection.success) {
      const result = await client.rpc("b2b_workspace", {
        p_company: selection.data.companyId,
      });
      if (result.error || !workspaceSchema.safeParse(result.data).success)
        return reply({ error: "company_required" }, 403);
      (await cookies()).set("mts_business_company", selection.data.companyId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      });
      return reply({ ok: true });
    }
    const input = businessAction.safeParse(raw);
    if (!input.success) return reply({ error: "invalid" }, 400);
    const body = input.data;
    let name: string;
    let args: Record<string, unknown>;
    switch (body.action) {
      case "revoke_invitation":
        name = "b2b_revoke_invitation";
        args = { p_company: body.companyId, p_id: body.id };
        break;
      case "remove_member":
        name = "b2b_remove_member";
        args = { p_company: body.companyId, p_user: body.id };
        break;
      case "create_trip":
        name = "b2b_create_trip";
        args = {
          p_company: body.companyId,
          p_id: body.id,
          p_value: {
            name: body.name,
            destination: body.destination,
            departure: body.departure,
            returning: body.returning,
            travelers: body.travelers,
            mode: body.mode,
          },
        };
        break;
      case "request":
        name = "b2b_submit_request";
        args = {
          p_company: body.companyId,
          p_trip: body.tripId,
          p_attempt: body.attemptId,
          p_plan: body.planId,
          p_quantity: body.quantity,
          p_version: body.version,
        };
        break;
    }
    const result = await client.rpc(name, args);
    if (result.error) {
      const error = businessError(result.error);
      return reply(
        { error },
        error === "rate_limited"
          ? 429
          : ["company_required", "role_required"].includes(error)
            ? 403
            : 409,
      );
    }
    return reply({ ok: true, id: result.data });
  } catch (error) {
    const code = error instanceof Error ? error.message : "unavailable";
    return reply(
      { error: ["forbidden", "invalid"].includes(code) ? code : "unavailable" },
      code === "forbidden" ? 403 : code === "invalid" ? 400 : 503,
    );
  }
}
