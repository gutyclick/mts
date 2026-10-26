import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { paymentHeaders } from "../payments/checkout-server";
import {
  supportUser,
  supportStatus,
  supportOrigin,
  supportJSON,
  SupportError,
  listSupport,
  readSupportThread,
  mutateSupport,
} from "./server";
import { ticketRequest } from "./model";
export function supportFailure(e: unknown) {
  return NextResponse.json(
    { error: e instanceof SupportError ? e.code : "unavailable" },
    { status: supportStatus(e), headers: paymentHeaders },
  );
}
export async function ticketGET(request: NextRequest, staff: boolean) {
  try {
    const user = await supportUser(staff);
    const filters = z
      .object({
        id: z.uuid().optional(),
        status: z
          .enum(["", "open", "waiting_customer", "resolved"])
          .default(""),
        q: z.string().max(80).default(""),
        page: z.coerce.number().int().min(1).max(10000).default(1),
      })
      .safeParse(Object.fromEntries(request.nextUrl.searchParams));
    if (!filters.success) throw new SupportError("invalid");
    const f = filters.data;
    const result = f.id
      ? await readSupportThread(user.id, f.id, staff, f.page)
      : await listSupport(user.id, staff, f.status, f.q, f.page);
    return NextResponse.json(result, { headers: paymentHeaders });
  } catch (e) {
    return supportFailure(e);
  }
}
export async function ticketPOST(request: NextRequest, staff: boolean) {
  try {
    supportOrigin(request);
    const user = await supportUser(staff);
    const parsed = z
      .object({ locale: z.enum(["es", "en"]), request: ticketRequest })
      .strict()
      .safeParse(await supportJSON(request, 20000));
    if (!parsed.success) throw new SupportError("invalid");
    return NextResponse.json(
      await mutateSupport(
        user.id,
        parsed.data.request,
        staff,
        parsed.data.locale,
      ),
      { headers: paymentHeaders },
    );
  } catch (e) {
    return supportFailure(e);
  }
}
