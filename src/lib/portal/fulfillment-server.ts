import "server-only";
import type { AllocatedProfile } from "../fulfillment/core";

/** Claims and writes are service-only, lease-fenced RPCs; no retail delivery path. */
export type BusinessFulfillmentUnit = {
  id: string;
  order_id: string;
  state: string;
  attempts: number;
  provider_transaction_id: string;
  provider_order_no: string | null;
  provider_slug: string;
  package_code: string;
  volume_bytes: number;
  days: number;
  lease_token: string;
};

export type BusinessFulfillmentDependencies = {
  claim: () => Promise<BusinessFulfillmentUnit[]>;
  save: (
    unit: BusinessFulfillmentUnit,
    patch: Record<string, unknown>,
  ) => Promise<void>;
  buy: (slug: string, transactionId: string) => Promise<string>;
  profiles: (orderNo: string) => Promise<AllocatedProfile[]>;
};

class AllocationError extends Error {}

function validateAllocation(
  unit: BusinessFulfillmentUnit,
  profiles: AllocatedProfile[],
) {
  const p = profiles[0];
  if (
    profiles.length !== 1 ||
    !p ||
    p.orderNo !== unit.provider_order_no ||
    p.packageSlug !== unit.provider_slug ||
    p.volumeBytes !== Number(unit.volume_bytes) ||
    p.days !== unit.days ||
    !/^[A-Za-z0-9_-]{1,100}$/.test(p.transactionId) ||
    !/^\d{15,25}$/.test(p.iccid) ||
    !p.smdpAddress ||
    !/^[A-Za-z0-9.-]+$/.test(p.smdpAddress) ||
    !p.activationCode ||
    !/^[A-Za-z0-9_-]+$/.test(p.activationCode) ||
    !["GOT_RESOURCE", "IN_USE"].includes(p.status)
  ) {
    throw new AllocationError("invalid_allocation");
  }
  return p;
}

async function productionDependencies(): Promise<BusinessFulfillmentDependencies> {
  const [{ checkoutDatabase }, { esimAccess }] = await Promise.all([
    import("../payments/checkout-server"),
    import("../integrations/esimaccess-server"),
  ]);
  const db = checkoutDatabase();
  return {
    claim: async () => {
      const { data, error } = await db.rpc("claim_b2b_units", { p_limit: 2 });
      if (error || !Array.isArray(data))
        throw new Error("Business queue unavailable");
      return data as BusinessFulfillmentUnit[];
    },
    save: async (unit, patch) => {
      const { data, error } = await db.rpc("update_b2b_unit", {
        p_id: unit.id,
        p_lease: unit.lease_token,
        p_patch: patch,
      });
      if (error || data !== true) throw new Error("Business lease lost");
    },
    buy: (slug, id) => esimAccess().purchaseProfile(slug, id),
    profiles: (id) => esimAccess().allocatedProfile(id),
  };
}

/** Only an explicit admin release makes paid orders claimable. Never sends email.
 * A timeout retries the SAME persisted transaction ID. Never mint a replacement ID.
 * DB RPCs also fail closed on missing/disabled issuance settings and enforce paid,
 * released order eligibility and lease ownership. Secrets never enter audit errors.
 */
export async function runBusinessFulfillmentWorker(
  injected?: BusinessFulfillmentDependencies,
) {
  if (process.env.B2B_ISSUANCE_ENABLED !== "true")
    return { processed: 0, failed: 0, disabled: true };
  const deps = injected ?? (await productionDependencies());
  const units = await deps.claim();
  let failed = 0;
  // Bounded claim and sequential provider operations keep spend and retries controlled.
  for (const unit of units) {
    try {
      if (unit.state === "queued") {
        if (
          !/^[A-Za-z0-9_.-]{1,200}$/.test(unit.package_code) ||
          !/^[A-Za-z0-9_.-]{1,200}$/.test(unit.provider_slug) ||
          !/^[A-Za-z0-9_-]{1,50}$/.test(unit.provider_transaction_id)
        )
          throw new AllocationError("invalid_plan");
        const orderNo = await deps.buy(
          unit.package_code,
          unit.provider_transaction_id,
        );
        if (!/^[A-Za-z0-9_-]{1,100}$/.test(orderNo))
          throw new AllocationError("invalid_provider_order");
        await deps.save(unit, {
          state: "provider_pending",
          provider_order_no: orderNo,
          attempts: 0,
          last_error: null,
          next_attempt_at: new Date(Date.now() + 15000).toISOString(),
        });
      } else if (unit.state === "provider_pending") {
        if (!unit.provider_order_no)
          throw new AllocationError("invalid_allocation");
        const profiles = await deps.profiles(unit.provider_order_no);
        if (!profiles.length) {
          if (unit.attempts >= 24)
            throw new AllocationError("allocation_timeout");
          await deps.save(unit, {
            next_attempt_at: new Date(Date.now() + 30000).toISOString(),
            last_error: null,
          });
          continue;
        }
        const p = validateAllocation(unit, profiles);
        await deps.save(unit, {
          state: "ready",
          iccid: p.iccid,
          smdp_address: p.smdpAddress,
          activation_code: p.activationCode,
          provider_profile_id: p.transactionId,
          apn: p.apn,
          attempts: 0,
          last_error: null,
        });
      } else {
        throw new AllocationError("invalid_state");
      }
    } catch (error) {
      failed++;
      const kind =
        error && typeof error === "object" && "kind" in error
          ? error.kind
          : null;
      const permanent =
        error instanceof AllocationError ||
        kind === "configuration" ||
        (kind === "response" && unit.state === "provider_pending") ||
        unit.attempts >= 24;
      await deps
        .save(unit, {
          state: permanent ? "review" : unit.state,
          last_error:
            error instanceof AllocationError
              ? error.message
              : kind === "configuration"
                ? "configuration"
                : "provider_unavailable",
          next_attempt_at: new Date(
            Date.now() +
              Math.min(3600000, 30000 * 2 ** Math.min(unit.attempts, 7)),
          ).toISOString(),
        })
        .catch(() => {
          // A stale lease must never overwrite the next owner's state. The queue
          // lease expires automatically; a failed persistence is safe to replay.
        });
    }
  }
  return { processed: units.length, failed };
}
