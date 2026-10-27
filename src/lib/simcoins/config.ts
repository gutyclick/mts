import type { SimcoinsLevel, SimcoinsSettings } from "./model.ts";
export const defaultSimcoinsLevels: SimcoinsLevel[] = [
  { id: "traveler", name: "Traveler", thresholdCents: 0, rateBps: 0 },
  { id: "explorer", name: "Explorer", thresholdCents: 1, rateBps: 300 },
  { id: "adventurer", name: "Adventurer", thresholdCents: 6000, rateBps: 400 },
  {
    id: "globetrotter",
    name: "Globetrotter",
    thresholdCents: 12500,
    rateBps: 500,
  },
  { id: "legend", name: "Legend", thresholdCents: 30000, rateBps: 600 },
];
export const defaultSimcoinsSettings: SimcoinsSettings = {
  policyVersion: 1,
  coinsPerUsd: 100,
  maxRedeemBps: 500,
  minContributionBps: 2000,
  stripeBps: 440,
  stripeFxBps: 540,
  fixedFeeUnits: 3000,
  affiliateBps: 800,
  maxPromotionBps: 500,
  otherVariableUnits: 0,
  costsMaxAgeSeconds: 900,
  releaseDelaySeconds: 604800,
};
export function simcoinsFlags(
  env: Record<string, string | undefined> = process.env,
) {
  const enabled = env.SIMCOINS_ENABLED === "true";
  return {
    enabled,
    earnEnabled: enabled && env.SIMCOINS_EARN_ENABLED === "true",
    redeemEnabled: enabled && env.SIMCOINS_REDEEM_ENABLED === "true",
    publicEnabled: env.SIMCOINS_PUBLIC_ENABLED !== "false",
    adminEnabled: env.SIMCOINS_ADMIN_ENABLED === "true",
    persistenceReady: env.SIMCOINS_PERSISTENCE_READY === "true",
  };
}
