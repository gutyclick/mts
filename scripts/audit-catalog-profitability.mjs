import fs from "node:fs";
import { compareProviderCatalog } from "../src/lib/integrations/esimaccess-catalog.ts";
import {
  connectivityMode,
  curateCatalog,
  isCommerciallyAllowed,
} from "../src/lib/catalog-curation.ts";
import { applyRegionalPolicy } from "../src/lib/regional-catalog-policy.ts";
import {
  auditContribution,
  minimumWholeUsd,
} from "./lib/profitability-audit.mjs";
const read = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const snapshot = read("private-data/catalog-redesign/snapshot.json"),
  finance = read("private-data/catalog-redesign/finance.json");
const evidence = read("src/data/catalog-connectivity-evidence.json"),
  settings = finance.settings;
const available = new Set(snapshot.merchandising.availableIds),
  remote = new Map(snapshot.provider.map((p) => [p.slug, p]));
// Reuse canonical GB/MB identity validation: 100MB is not 0.1 GiB.
const checked = compareProviderCatalog(
  snapshot.plans.map((p) => ({
    id: p.id,
    allowance: p.allowance,
    days: p.days,
    coverageCode: p.coverageCode,
  })),
  snapshot.provider,
);
const matched = new Set(checked.matches.map((p) => p.planId));
const visibleIds = new Set(),
  localDestinations = new Set(
    applyRegionalPolicy(snapshot.destinations).map((d) => d.slug),
  );
for (const dest of snapshot.destinations) {
  const config = snapshot.merchandising.destinations.find(
    (d) => d.destination_slug === dest.slug,
  );
  const result = curateCatalog({
    plans: snapshot.plans.filter(
      (p) => p.destinationSlug === dest.slug && available.has(p.id),
    ),
    destinationCode: dest.code,
    destinationType: dest.type,
    overrides: snapshot.merchandising.overrides,
    approvedModes: config?.approval_verified
      ? config.approved_modalities
      : undefined,
    evidence,
  });
  for (const mode of result.modes)
    for (const p of [...mode.plans.map((x) => x.plan), ...mode.secondaryPlans])
      visibleIds.add(p.id);
}
const radarFees = (finance.stripe.transactions ?? []).filter(
  (t) =>
    t.type === "stripe_fee" &&
    t.feeCategory === "radar" &&
    t.currency === "usd" &&
    t.amount < 0,
);
const radarUnits = radarFees.length
  ? Math.max(...radarFees.map((t) => -t.amount)) * 100
  : 0;
const common = {
  fixedFeeUnits: settings.fixed_fee_units,
  radarUnits,
  otherUnits: settings.other_variable_units,
  minContributionBps: settings.min_contribution_bps,
};
const maximumEarn = Math.max(...finance.levels.map((x) => x.rate_bps));
const scenarios = {
  usd: { ...common, feeBps: settings.stripe_bps },
  fx: { ...common, feeBps: settings.stripe_fx_bps },
  affiliate_fx: {
    ...common,
    feeBps: settings.stripe_fx_bps,
    affiliateBps: settings.affiliate_bps,
  },
  coupon_fx: {
    ...common,
    feeBps: settings.stripe_fx_bps,
    affiliateBps: settings.affiliate_bps,
    discountBps: settings.max_promotion_bps,
  },
  loyalty_fx: {
    ...common,
    feeBps: settings.stripe_fx_bps,
    affiliateBps: settings.affiliate_bps,
    redeemBps: settings.max_redeem_bps,
    earnBps: maximumEarn,
  },
  fx_extra_1pct: { ...common, feeBps: settings.stripe_fx_bps + 100 },
};
const destinationIndex = new Map(snapshot.destinations.map((d) => [d.slug, d]));
const technicalKey = (p) =>
  JSON.stringify({
    activation: p.details?.activation,
    coverage: [...(p.details?.coverage ?? [])].sort(),
    networks: (p.details?.networks ?? [])
      .map((n) => [
        n.countryCode ?? n.countryName,
        n.operators.map((o) => o.name).sort(),
      ])
      .sort(),
  });
const entries = snapshot.plans.map((p) => {
  const supplier = remote.get(p.id),
    verified =
      matched.has(p.id) &&
      supplier?.wholesaleUnitUnits != null &&
      Number.isSafeInteger(supplier.wholesaleUnitUnits) &&
      supplier.wholesaleUnitUnits >= 0;
  const vendible =
    available.has(p.id) &&
    isCommerciallyAllowed(p.id, snapshot.merchandising.overrides);
  const dest = destinationIndex.get(p.destinationSlug);
  const inPreview =
    vendible &&
    localDestinations.has(p.destinationSlug) &&
    p.details?.dataGb === p.dataGb &&
    p.details.days === p.days &&
    p.coverageCode === dest?.code &&
    (dest.type === "region" || p.details.coverage.includes(dest.code)) &&
    p.details.networks.some(
      (n) =>
        n.operators.length > 0 &&
        (dest.type === "region" || n.countryCode === dest.code),
    );
  const validPrice =
    Number.isSafeInteger(p.retailPriceCents) && p.retailPriceCents > 0;
  const results =
    verified && validPrice
      ? Object.fromEntries(
          Object.entries(scenarios).map(([name, scenario]) => [
            name,
            auditContribution(
              p.retailPriceCents,
              supplier.wholesaleUnitUnits,
              scenario,
            ),
          ]),
        )
      : null;
  const minimums = verified
    ? Object.fromEntries(
        Object.entries(scenarios).map(([name, scenario]) => [
          name,
          minimumWholeUsd(supplier.wholesaleUnitUnits, scenario),
        ]),
      )
    : null;
  return {
    plan: p,
    dest: dest?.name.es ?? p.destinationSlug,
    variant: connectivityMode(p) + (/_FIFA$/i.test(p.id) ? "_fifa" : ""),
    vendible,
    visible: visibleIds.has(p.id),
    inPreview,
    verified,
    cost: verified ? supplier.wholesaleUnitUnits : null,
    results,
    minimums,
  };
});
const active = entries.filter((x) => x.vendible),
  verified = active.filter((x) => x.results);
const summary = {
  observedAt: snapshot.observedAt,
  financialObservedAt: finance.observedAt,
  published: entries.length,
  vendible: active.length,
  verified: verified.length,
  unverified: active.filter((x) => !x.results).map((x) => x.plan.id),
  visible: active.filter((x) => x.visible).length,
  localPreview: active.filter((x) => x.inPreview).length,
  radarUnits,
  scenarios: {},
  monotonic: [],
  stripeEvidence: {
    country: finance.stripe.country,
    currency: finance.stripe.settlementCurrency,
    samplePayments: (finance.stripe.transactions ?? []).filter(
      (t) => ["charge", "payment"].includes(t.type) && t.amount > 0,
    ).length,
    radarEntries: radarFees.length,
    radarBudgetPresent: settings.other_variable_units >= radarUnits,
  },
  programDatabaseFlags: {
    enabled: settings.enabled,
    earnEnabled: settings.earn_enabled,
    redeemEnabled: settings.redeem_enabled,
  },
  activeCoupons: finance.coupons.map((c) => ({
    code: c.code,
    kind: c.kind,
    value: c.value,
    minimumCents: c.minimum_cents,
  })),
  assumptions: scenarios,
};
for (const scenario of Object.keys(scenarios)) {
  const below = verified.filter((x) => !x.results[scenario].meetsFloor),
    loss = verified.filter((x) => x.results[scenario].loss);
  summary.scenarios[scenario] = {
    losses: loss.length,
    belowFloor: below.length,
    visibleBelowFloor: below.filter((x) => x.visible).length,
    previewBelowFloor: below.filter((x) => x.inPreview).length,
    worst: verified
      .slice()
      .sort(
        (a, b) => a.results[scenario].marginBps - b.results[scenario].marginBps,
      )
      .slice(0, 10)
      .map((x) => ({
        planId: x.plan.id,
        destination: x.dest,
        priceUsd: x.plan.retailPriceCents / 100,
        costUsd: x.cost / 10000,
        marginBps: x.results[scenario].marginBps,
        contributionUsd: x.results[scenario].contributionUnits / 10000,
        minimumWholeUsd: x.minimums[scenario],
      })),
  };
}
for (const left of verified)
  for (const right of verified) {
    if (
      left.plan.destinationSlug !== right.plan.destinationSlug ||
      left.variant !== right.variant ||
      left.plan.id >= right.plan.id
    )
      continue;
    let a = left,
      b = right,
      kind;
    if (a.plan.days === b.plan.days && a.plan.dataGb !== b.plan.dataGb) {
      if (a.plan.dataGb > b.plan.dataGb) [a, b] = [b, a];
      if (b.plan.retailPriceCents <= a.plan.retailPriceCents)
        kind =
          b.plan.retailPriceCents === a.plan.retailPriceCents
            ? "MAS_DATOS_MISMO_PRECIO"
            : "MAS_DATOS_MENOR_PRECIO";
    }
    if (a.plan.dataGb === b.plan.dataGb && a.plan.days !== b.plan.days) {
      if (a.plan.days > b.plan.days) [a, b] = [b, a];
      if (b.plan.retailPriceCents < a.plan.retailPriceCents)
        kind = "MAS_DIAS_MENOR_PRECIO";
    }
    if (kind)
      summary.monotonic.push({
        kind,
        first: a.plan.id,
        second: b.plan.id,
        firstPriceUsd: a.plan.retailPriceCents / 100,
        secondPriceUsd: b.plan.retailPriceCents / 100,
        sameTechnicalConditions: technicalKey(a.plan) === technicalKey(b.plan),
      });
  }
const csv = (v) => '"' + String(v ?? "").replaceAll('"', '""') + '"';
const headers = [
  "plan_id",
  "destino",
  "nombre_exacto",
  "variante",
  "gb",
  "dias",
  "inicio_vigencia",
  "operadores",
  "vendible",
  "mostrado_web_actual",
  "propuesto_local",
  "coste_verificado",
  "precio_web_usd",
  "coste_mayorista_usd",
  ...Object.keys(scenarios).flatMap((k) => [
    `margen_${k}_porcentaje`,
    `contribucion_${k}_usd`,
    `minimo_20pct_${k}_usd`,
  ]),
  "accion",
];
const rows = entries.map((x) => [
  x.plan.id,
  x.dest,
  x.plan.name,
  x.variant,
  x.plan.dataGb,
  x.plan.days,
  x.plan.details?.activation ?? "",
  (x.plan.details?.networks ?? [])
    .flatMap((n) => n.operators.map((o) => o.name))
    .join(";"),
  x.vendible ? "SI" : "NO",
  x.visible ? "SI" : "NO",
  x.inPreview ? "SI" : "NO",
  x.verified ? "SI" : "NO",
  (x.plan.retailPriceCents / 100).toFixed(2),
  x.cost == null ? "" : (x.cost / 10000).toFixed(4),
  ...Object.keys(scenarios).flatMap((k) =>
    x.results
      ? [
          ((x.results[k].marginBps ?? 0) / 100).toFixed(2),
          (x.results[k].contributionUnits / 10000).toFixed(4),
          x.minimums[k],
        ]
      : ["", "", ""],
  ),
  !x.vendible
    ? "NO_VENDIBLE"
    : !x.results
      ? "VERIFICAR_COSTE_IDENTIDAD"
      : x.results.fx.loss
        ? "BLOQUEAR_PERDIDA"
        : !x.results.fx.meetsFloor
          ? "REVISAR_PRECIO_BASE"
          : !x.results.coupon_fx.meetsFloor || !x.results.loyalty_fx.meetsFloor
            ? "SOLO_PROMOCIONES_RENTABLES"
            : "CUMPLE_ESCENARIOS",
]);
const folder = "private-data/pricing-audit";
fs.mkdirSync(folder, { recursive: true });
fs.writeFileSync(
  `${folder}/MyTripSim_rentabilidad_completa.csv`,
  [headers, ...rows].map((r) => r.map(csv).join(",")).join("\n") + "\n",
);
fs.writeFileSync(`${folder}/summary.json`, JSON.stringify(summary, null, 2));
fs.writeFileSync(
  `${folder}/inconsistencias.csv`,
  [
    [
      "tipo",
      "plan_menor",
      "plan_mayor",
      "precio_menor_usd",
      "precio_mayor_usd",
      "condiciones_tecnicas_iguales",
    ],
    ...summary.monotonic.map((x) => [
      x.kind,
      x.first,
      x.second,
      x.firstPriceUsd,
      x.secondPriceUsd,
      x.sameTechnicalConditions ? "SI" : "NO",
    ]),
  ]
    .map((r) => r.map(csv).join(","))
    .join("\n") + "\n",
);
fs.writeFileSync(
  `${folder}/bloqueos_propuestos.csv`,
  [
    ["plan_id", "nombre_exacto", "motivo", "accion_propuesta", "aplicado"],
    ...active
      .filter((x) => !x.results)
      .map((x) => [
        x.plan.id,
        x.plan.name,
        "No aparece una identidad y coste mayorista verificables en el catálogo fijo consultado",
        "Suspender venta hasta confirmar proveedor",
        "NO",
      ]),
  ]
    .map((r) => r.map(csv).join(","))
    .join("\n") + "\n",
);
const scenarioNames = {
  usd: "USD sin promoción",
  fx: "Divisa con conversión sin promoción",
  affiliate_fx: "Divisa y reserva de afiliado",
  coupon_fx: "Cupón 5% + afiliado + divisa",
  loyalty_fx: "Canje 5% + recompensa máxima + reserva de afiliado (sin cupón)",
  fx_extra_1pct: "Sensibilidad: 1 punto adicional de comisión FX",
};
let report = `# Auditoría de contribución MyTripSim\n\nCostes del proveedor consultados: ${snapshot.observedAt}. Configuración/Stripe consultados: ${finance.observedAt}. Sin cambios de precio, costes registrados, pedidos o producción. Los CSV contienen datos comerciales privados y quedan fuera de Git.\n\n## Alcance\n\n${entries.length} SKU publicados, ${active.length} vendibles, ${verified.length} con identidad y coste verificados. ${summary.visible} aparecen en la selección actual; ${summary.localPreview} quedan en la propuesta local. Comparación por plan_id, capacidad real GB/MB, duración y cobertura; no por nombre.\n\n## Hipótesis\n\nUna eSIM por transacción; precio sin impuestos añadidos. Stripe presupuestado: ${settings.stripe_bps / 100}% USD / ${settings.stripe_fx_bps / 100}% FX, fijo USD ${settings.fixed_fee_units / 10000}; afiliado ${settings.affiliate_bps / 100}%; cupón ${settings.max_promotion_bps / 100}%; canje ${settings.max_redeem_bps / 100}%; recompensa máxima ${maximumEarn / 100}%. Radar adicional observado: USD ${radarUnits / 10000} por evento; se reserva una unidad por operación, no se afirma que el número futuro de eventos coincida con las ventas. Reserva variable registrada: USD ${settings.other_variable_units / 10000}. Fees redondeadas hacia arriba a céntimos, monedas ganadas hacia abajo, sin descontar dos veces el canje.\n\n## Resultados\n\n| Escenario | Pérdida unitaria | Bajo margen objetivo ${settings.min_contribution_bps / 100}% | De ellos, en vista local |\n|---|---:|---:|---:|\n`;
for (const [k, v] of Object.entries(summary.scenarios))
  report += `|${scenarioNames[k]}|${v.losses}|${v.belowFloor}|${v.previewBelowFloor}|\n`;
report +=
  "\nLos escenarios de promoción son pruebas de capacidad financiera, no cobros que se hayan realizado: el servidor bloquea cupones sin margen y limita o excluye SimCoins. No se acumulan cupón y SimCoins. El escenario de afiliados reserva el 8% incluso cuando no exista afiliación efectiva; es conservador.\n\n## Riesgos y acciones\n\n1. La compra normal no impone un margen mayorista universal antes del cobro. Los controles actuales de integridad del pago no sustituyen ese control. Preparar un control de coste fresco y contribución antes de publicar cambios.\n2. Hay cargos separados de Radar de USD 0.05 en la muestra de Stripe y la reserva variable actual es cero. La auditoría los incluye, la política del motor necesita presupuestarlos expresamente.\n3. Canadá CA_50_30 es la tarifa más ajustada. Consultar los pisos de cada escenario en el CSV; el piso es una restricción matemática, no un precio ya aprobado ni validado contra competidores.\n4. Revisar las inconsistencias de capacidad/duración en el CSV separado. Un paquete mayor más barato puede ser una oferta válida del proveedor; no se cambia automáticamente.\n5. No prometer recompensas/cupones a todos los planes: conservar la validación financiera por compra.\n\n## Límites\n\nEsto mide contribución estimada, no beneficio neto garantizado. No incluye impuesto sobre beneficios, IVA absorbido, soporte, publicidad, hosting, coste del capital, contracargos o costes mayoristas consumidos tras una devolución. La muestra de pagos reales de Stripe es pequeña y no confirma el coste efectivo futuro de todas las divisas/métodos. Los pagos fallidos pueden generar costes adicionales de control antifraude. El escenario de +1 punto FX es sensibilidad, no una comisión afirmada del contrato. No usar costes no verificados como cero. No se modificó ni publicó nada.\n\nFuente oficial para contrastar comisiones efectivamente liquidadas: https://docs.stripe.com/api/balance_transactions/object.\n";
report += `\n## Productos pendientes de verificación\n\n${active
  .filter((x) => !x.results)
  .map(
    (x) =>
      `- ${x.plan.id}: ${x.plan.name}. Propuesta: suspender temporalmente hasta confirmar identidad y coste con el proveedor. No se ha aplicado el bloqueo.`,
  )
  .join(
    "\n",
  )}\n\n## Coherencia comercial\n\nSe encontraron ${summary.monotonic.length} relaciones de capacidad/duración para revisar; no equivalen automáticamente a errores. Canadá CA_50_30 cuesta USD 89 con coste mayorista USD 65.92 y contribución estimada del 20.13% en divisa sin promoción. CA_75_30 cuesta USD 46, pero las condiciones difieren: Rogers/activación en red frente a Telus/activación en compra. Comparar las condiciones antes de retirar o cambiar cualquiera de ellos.\n\nNo se simularon individualmente todas las cotizaciones de divisa y sus redondeos. La configuración de SimCoins consultada en la base de datos no verifica por sí sola los interruptores efectivos del despliegue.\n`;
fs.writeFileSync(`${folder}/informe.md`, report);
console.log(
  JSON.stringify(
    {
      published: summary.published,
      vendible: summary.vendible,
      verified: summary.verified,
      unverified: summary.unverified.length,
      scenarios: Object.fromEntries(
        Object.entries(summary.scenarios).map(([k, v]) => [
          k,
          {
            losses: v.losses,
            belowFloor: v.belowFloor,
            previewBelowFloor: v.previewBelowFloor,
          },
        ]),
      ),
      inconsistencies: summary.monotonic.length,
      radarUnits,
    },
    null,
    2,
  ),
);
