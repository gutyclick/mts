import "server-only";
import { z } from "zod";
import { checkoutDatabase } from "../payments/checkout-server";
import {
  defaultSimcoinsLevels,
  defaultSimcoinsSettings,
  simcoinsFlags,
} from "./config";
import { levelForSpend } from "./engine";
import type {
  SimcoinsLevel,
  SimcoinsPublicProgram,
  SimcoinsSettings,
  SimcoinsWallet,
} from "./model";

const integer = z.coerce.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const levelSchema = z.object({
  id: z.string().min(1).max(50),
  name: z.string().min(1).max(80),
  rate_bps: integer.max(600),
  threshold_cents: integer,
});
const settingKeys = {
  policyVersion: "policy_version",
  coinsPerUsd: "coins_per_usd",
  maxRedeemBps: "max_redeem_bps",
  minContributionBps: "min_contribution_bps",
  stripeBps: "stripe_bps",
  stripeFxBps: "stripe_fx_bps",
  fixedFeeUnits: "fixed_fee_units",
  affiliateBps: "affiliate_bps",
  maxPromotionBps: "max_promotion_bps",
  otherVariableUnits: "other_variable_units",
  costsMaxAgeSeconds: "costs_max_age_seconds",
  releaseDelaySeconds: "release_delay_seconds",
} as const;

async function configuration() {
  if (!simcoinsFlags().persistenceReady) return null;
  const db = checkoutDatabase();
  const [policy, levels] = await Promise.all([
    db.from("simcoins_program_settings").select("*").eq("id", true).single(),
    db
      .from("simcoins_levels")
      .select("id,name,rate_bps,threshold_cents")
      .order("threshold_cents"),
  ]);
  if (policy.error || levels.error || !policy.data)
    throw Error("simcoins_unavailable");
  const settings = Object.fromEntries(
    Object.entries(settingKeys).map(([key, field]) => [
      key,
      integer.parse(policy.data[field]),
    ]),
  ) as SimcoinsSettings;
  if (
    settings.coinsPerUsd !== 100 ||
    settings.minContributionBps < 2000 ||
    settings.maxRedeemBps > 500 ||
    settings.stripeBps < 440 ||
    settings.stripeFxBps < 540 ||
    settings.fixedFeeUnits < 3000 ||
    settings.affiliateBps < 800
  )
    throw Error("simcoins_invalid_policy");
  const tiers = z
    .array(levelSchema)
    .min(5)
    .max(5)
    .parse(levels.data)
    .map((l) => ({
      id: l.id,
      name: l.name,
      rateBps: l.rate_bps,
      thresholdCents: l.threshold_cents,
    }));
  levelForSpend(0, tiers);
  const flags = z
    .object({
      enabled: z.boolean(),
      earn_enabled: z.boolean(),
      redeem_enabled: z.boolean(),
      public_enabled: z.boolean(),
    })
    .parse(policy.data);
  return { settings, levels: tiers, flags };
}

export async function getSimcoinsSettings(): Promise<{
  settings: SimcoinsSettings;
  levels: SimcoinsLevel[];
}> {
  const config = await configuration();
  return (
    config ?? {
      settings: defaultSimcoinsSettings,
      levels: defaultSimcoinsLevels,
    }
  );
}

function publicProgram(
  config: Awaited<ReturnType<typeof configuration>>,
): SimcoinsPublicProgram {
  const flags = simcoinsFlags(),
    enabled = flags.enabled && config?.flags.enabled === true;
  const { settings, levels } = config ?? {
    settings: defaultSimcoinsSettings,
    levels: defaultSimcoinsLevels,
  };
  return {
    publicEnabled:
      flags.publicEnabled &&
      (config ? config.flags.public_enabled : !flags.persistenceReady),
    enabled,
    earnEnabled:
      enabled && flags.earnEnabled && config?.flags.earn_enabled === true,
    redeemEnabled:
      enabled && flags.redeemEnabled && config?.flags.redeem_enabled === true,
    levels,
    releaseDelaySeconds: settings.releaseDelaySeconds,
    coinsPerUsd: settings.coinsPerUsd,
    maxRedeemBps: settings.maxRedeemBps,
  };
}

export async function getSimcoinsPublicProgram() {
  try {
    return publicProgram(await configuration());
  } catch {
    return publicProgram(null);
  }
}

function emptyWallet(levels: SimcoinsLevel[]): SimcoinsWallet {
  return {
    availableCoins: 0,
    pendingCoins: 0,
    reservedCoins: 0,
    debtCoins: 0,
    eligibleSpendCents: 0,
    level: levels[0],
    nextLevel: levels[1] ?? null,
    history: [],
    pending: [],
  };
}

const walletLevel = z.object({
  id: z.string(),
  name: z.string(),
  rateBps: integer.max(600),
  thresholdCents: integer,
});
const walletSchema = z.object({
  availableCoins: integer,
  pendingCoins: integer,
  reservedCoins: integer,
  debtCoins: integer,
  eligibleSpendCents: integer,
  level: walletLevel,
  nextLevel: walletLevel.nullable(),
  history: z
    .array(
      z.object({
        kind: z.string(),
        bucket: z.string(),
        coinDelta: z.coerce.number().int().safe(),
        orderId: z.uuid().nullable(),
        createdAt: z.iso.datetime({ offset: true }),
      }),
    )
    .max(100),
  pending: z
    .array(
      z.object({
        orderId: z.uuid(),
        coins: integer,
        releaseAt: z.string().nullable().optional(),
      }),
    )
    .max(1000),
});

// Caller obtains userId from the authenticated server session, never request JSON.
export async function getCustomerSimcoins(userId: string) {
  z.uuid().parse(userId);
  let program = publicProgram(null);
  try {
    const config = await configuration();
    program = publicProgram(config);
    if (!config)
      return {
        configured: false,
        program,
        wallet: emptyWallet(program.levels),
      };
    const result = await checkoutDatabase().rpc("simcoins_wallet", {
      p_user: userId,
    });
    if (result.error) throw Error("simcoins_unavailable");
    const value = walletSchema.parse(result.data);
    const wallet: SimcoinsWallet = {
      ...value,
      history: value.history.map((entry, i) => ({
        id: `${entry.createdAt}:${i}`,
        type: entry.kind,
        amountCoins: entry.coinDelta,
        status: entry.bucket,
        createdAt: entry.createdAt,
        reason: "",
        ...(entry.orderId
          ? { orderReference: entry.orderId.slice(0, 8).toUpperCase() }
          : {}),
      })),
      pending: value.pending.map((entry) => ({
        orderReference: entry.orderId.slice(0, 8).toUpperCase(),
        coins: entry.coins,
        releaseAt: entry.releaseAt ?? null,
      })),
    };
    return { configured: true, program, wallet };
  } catch {
    return {
      configured: false,
      program: {
        ...program,
        enabled: false,
        earnEnabled: false,
        redeemEnabled: false,
      },
      wallet: emptyWallet(program.levels),
    };
  }
}
