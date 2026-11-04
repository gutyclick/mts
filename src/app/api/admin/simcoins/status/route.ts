import { NextResponse } from "next/server";
import { adminSession } from "@/lib/admin/server";
import {
  checkoutDatabase,
  paymentHeaders,
  paymentMode,
} from "@/lib/payments/checkout-server";
import { simcoinsFlags } from "@/lib/simcoins/config";

// An explicit boolean projection: never export environment variables or credentials.
export async function GET() {
  const reply = (body: unknown, status = 200) =>
    NextResponse.json(body, { status, headers: paymentHeaders });
  try {
    const session = await adminSession();
    if (!session.user) return reply({ error: "unauthorized" }, 401);
    if (session.needsMfa) return reply({ error: "mfa_required" }, 428);
    if (!session.admin) return reply({ error: "forbidden" }, 403);
    const flags = simcoinsFlags();
    const livePaymentMode = paymentMode(process.env) === "live";
    const { data, error } = await checkoutDatabase()
      .from("simcoins_program_settings")
      .select(
        "enabled,earn_enabled,redeem_enabled,public_enabled,admin_enabled",
      )
      .eq("id", true)
      .single();
    if (error || !data) return reply({ error: "unavailable" }, 503);
    return reply({
      runtime: {
        enabled: flags.enabled,
        earnEnabled: flags.earnEnabled,
        redeemEnabled: flags.redeemEnabled,
        publicEnabled: flags.publicEnabled,
        adminEnabled: flags.adminEnabled,
        persistenceReady: flags.persistenceReady,
        livePaymentMode,
      },
      effective: {
        earning:
          livePaymentMode &&
          flags.persistenceReady &&
          flags.earnEnabled &&
          data.enabled &&
          data.earn_enabled,
        redemption:
          livePaymentMode &&
          flags.persistenceReady &&
          flags.redeemEnabled &&
          data.enabled &&
          data.redeem_enabled,
      },
    });
  } catch {
    return reply({ error: "unavailable" }, 503);
  }
}
