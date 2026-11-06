import fs from "node:fs";
import {
  commercialKey,
  coherencePairs,
  suggestedMinimum,
} from "./lib/price-coherence.mjs";
import {
  minimumWholeUsd,
  auditContribution,
} from "./lib/profitability-audit.mjs";
import { connectivityMode } from "../src/lib/catalog-curation.ts";
import { compareProviderCatalog } from "../src/lib/integrations/esimaccess-catalog.ts";
import { applyRegionalPolicy } from "../src/lib/regional-catalog-policy.ts";
const read = (path) => JSON.parse(fs.readFileSync(path, "utf8"));
const snapshot = read("private-data/catalog-redesign/snapshot.json");
const finance = read("private-data/catalog-redesign/finance.json");
const available = new Set(snapshot.merchandising.availableIds);
const hidden = new Set(
  snapshot.merchandising.overrides
    .filter((o) => o.visibility === "hide" || o.incident_block)
    .map((o) => o.plan_id),
);
const matches = new Set(
  compareProviderCatalog(
    snapshot.plans.map((p) => ({
      id: p.id,
      allowance: p.allowance,
      days: p.days,
      coverageCode: p.coverageCode,
    })),
    snapshot.provider,
  ).matches.map((x) => x.planId),
);
const costs = new Map(
  snapshot.provider.map((p) => [p.slug, p.wholesaleUnitUnits]),
);
const selected = new Set(
  applyRegionalPolicy(snapshot.destinations).map((d) => d.slug),
);
const plans = snapshot.plans.filter(
  (p) =>
    p.kind === "fixed" &&
    available.has(p.id) &&
    !hidden.has(p.id) &&
    Number.isSafeInteger(p.retailPriceCents) &&
    p.retailPriceCents > 0,
);
const comparable = plans.filter(
  (p) =>
    p.details?.activation &&
    p.details?.coverage?.length &&
    p.details?.networks?.length,
);
const pairs = coherencePairs(comparable, (p) =>
  commercialKey(p, connectivityMode(p)),
);
const flags = pairs.filter((x) => x.flagged);
const scenario = {
  feeBps: finance.settings.stripe_fx_bps,
  fixedFeeUnits: finance.settings.fixed_fee_units,
  radarUnits: 500,
  otherUnits: finance.settings.other_variable_units,
  affiliateBps: finance.settings.affiliate_bps,
  minContributionBps: finance.settings.min_contribution_bps,
};
const proposed = new Map(plans.map((p) => [p.id, p.retailPriceCents]));
const verified = (p) =>
  matches.has(p.id) &&
  Number.isSafeInteger(costs.get(p.id)) &&
  costs.get(p.id) >= 0;
// Only increases. Iterate the monotone partial order so a correction never creates
// another capacity/duration inversion. No prices, accounts or orders are mutated.
let changed = true,
  rounds = 0;
while (changed && rounds++ <= plans.length) {
  changed = false;
  for (const { a, b, type } of pairs) {
    if (!verified(a) || !verified(b)) continue;
    const priceA = proposed.get(a.id),
      priceB = proposed.get(b.id);
    const floor = minimumWholeUsd(costs.get(b.id), scenario) * 100;
    const premium = type === "DURACION" && a.days === 15 && b.days === 30;
    const target =
      priceB <= priceA || premium
        ? suggestedMinimum(a, b, type, priceA)
        : priceB;
    const next = Math.max(priceB, target, floor);
    if (next !== priceB) {
      proposed.set(b.id, next);
      changed = true;
    }
  }
}
if (changed) throw Error("Price proposal did not converge");
const remaining = pairs.filter(
  ({ a, b }) =>
    verified(a) && verified(b) && proposed.get(b.id) <= proposed.get(a.id),
);
if (remaining.length)
  throw Error(
    `Proposal still has ${remaining.length} comparable ordering violations`,
  );
const quote = (v) => '"' + String(v ?? "").replaceAll('"', '""') + '"';
const folder = "private-data/pricing-audit";
const csv = (name, rows) =>
  fs.writeFileSync(
    `${folder}/${name}`,
    rows.map((r) => r.map(quote).join(",")).join("\n") + "\n",
  );
csv("incongruencias_duracion_capacidad.csv", [
  [
    "tipo",
    "plan_id_menor",
    "nombre_menor",
    "precio_menor_usd",
    "plan_id_mayor",
    "nombre_mayor",
    "precio_mayor_usd",
    "motivo",
    "visible_region_local",
  ],
  ...flags.map(({ a, b, type }) => [
    type,
    a.id,
    a.name,
    a.retailPriceCents / 100,
    b.id,
    b.name,
    b.retailPriceCents / 100,
    b.retailPriceCents === a.retailPriceCents
      ? "MISMO_PRECIO"
      : "MAS_POR_MENOS",
    selected.has(a.destinationSlug) ? "SI" : "NO",
  ]),
]);
const changes = plans.filter((p) => proposed.get(p.id) !== p.retailPriceCents);
csv("propuesta_coherencia_precios.csv", [
  [
    "plan_id",
    "nombre_exacto",
    "precio_web_usd",
    "precio_propuesto_usd",
    "incremento_usd",
    "incremento_porcentaje",
    "coste_mayorista_usd",
    "contribucion_propuesta_porcentaje",
    "visible_region_local",
    "requiere_revision",
    "aplicado",
  ],
  ...changes.map((p) => {
    const price = proposed.get(p.id);
    return [
      p.id,
      p.name,
      p.retailPriceCents / 100,
      price / 100,
      (price - p.retailPriceCents) / 100,
      ((price / p.retailPriceCents - 1) * 100).toFixed(2),
      costs.get(p.id) / 10000,
      (
        auditContribution(price, costs.get(p.id), scenario).marginBps / 100
      ).toFixed(2),
      selected.has(p.destinationSlug) ? "SI" : "NO",
      "SI",
      "NO",
    ];
  }),
]);
const duration = flags.filter((x) => x.type === "DURACION"),
  capacity = flags.filter((x) => x.type === "CAPACIDAD");
const brazil = changes.find((p) => p.id === "BR_3_30");
const report = `# Coherencia de capacidades y duración\n\nInstantánea: ${snapshot.observedAt}. Revisión ampliada: incluye empates entre duraciones que la auditoría anterior omitía. No consulta en vivo ni modificación de precios.\n\n${plans.length} planes vendibles; ${comparable.length} con condiciones suficientes para comparar. ${flags.length} relaciones detectadas: ${duration.length} de duración (${duration.filter((x) => x.a.retailPriceCents === x.b.retailPriceCents).length} empates), ${capacity.length} de capacidad. ${flags.filter((x) => selected.has(x.a.destinationSlug)).length} corresponden a destinos de la selección local. Son relaciones, no pérdidas ni productos únicos.\n\n## Propuesta para revisión\n\nBrasil BR_3_15 permanece en USD 8 y BR_3_30 se propone en USD ${brazil ? proposed.get(brazil.id) / 100 : 8}. Regla comercial provisional para 15 a 30 días: al menos 25% y USD 2 adicionales, redondeados hacia arriba a dólares enteros. Otras duraciones y capacidades: si hay empate o inversión, escalón mínimo USD 1. Estas reglas necesitan aprobación, no son una ley de costes ni prueban competitividad. Se comparan destino, variante, redes/tecnología, cobertura, activación, APN, recarga y fairUse registrados; cualquier condición omitida por el proveedor sigue pendiente.\n\nSe proponen ${changes.length} aumentos, ninguna rebaja. Incluye ajustes propagados para no crear nuevas inversiones, incluso donde el precio original ya era creciente. Revisar las subidas elevadas antes de aprobar: podría ser mejor ocultar una opción redundante. El coste mayorista debe estar verificado; los casos no verificables no se corrigen. Los pisos de contribución usan FX ${(scenario.feeBps / 100).toFixed(1)}%, fijo USD 0.30, Radar USD 0.05, afiliado 8% y objetivo 20%, sin cupón ni cashback. Las promociones continúan requiriendo validación propia. No se revalidaron competidores ni todas las cotizaciones de moneda.\n\nLos CSV son privados. Precio anterior conservado por plan_id. No se aplicó la propuesta al catálogo local, Stripe, Supabase ni producción; no se alteraron pedidos históricos.\n`;
fs.writeFileSync(
  `${folder}/informe_coherencia_ampliada.md`,
  report +
    `\n## Comprobación cruzada final\n\nSe incluyen ${flags.filter((x) => x.type === "CAPACIDAD_Y_DURACION").length} relaciones donde aumentan a la vez GB y días. Se verifican todas las capacidades, no solo 3 GB. La propuesta conserva ${remaining.length} inversiones o empates entre pares comparables de coste verificado. Hay ${pairs.filter(({ a, b }) => !verified(a) || !verified(b)).length} comparaciones excluidas de corrección por coste no verificado; no se afirma resolver esos casos. Más GB con menos días es un intercambio de atributos, no una dominancia automática.\n`,
);
console.log(
  JSON.stringify(
    {
      snapshot: snapshot.observedAt,
      plans: plans.length,
      comparisons: flags.length,
      duration: duration.length,
      durationTies: duration.filter(
        (x) => x.a.retailPriceCents === x.b.retailPriceCents,
      ).length,
      capacity: capacity.length,
      bothDimensions: flags.filter((x) => x.type === "CAPACIDAD_Y_DURACION")
        .length,
      remainingVerifiedViolations: remaining.length,
      unverifiedComparisonsExcluded: pairs.filter(
        ({ a, b }) => !verified(a) || !verified(b),
      ).length,
      selectedComparisons: flags.filter((x) =>
        selected.has(x.a.destinationSlug),
      ).length,
      proposedChanges: changes.length,
      brazilProposed: brazil ? proposed.get(brazil.id) / 100 : null,
    },
    null,
    2,
  ),
);
