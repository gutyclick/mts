import { planVariant } from "../plan-variants.ts";
const normalized = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
type Destination = {
  slug: string;
  name: { es: string; en: string };
  aliases?: string[];
  code?: string;
};
type Candidate = {
  id: string;
  name: string;
  kind: string;
  dataGb: number;
  days: number;
  retailPriceCents?: number;
  details?: {
    technologies: string[];
    networks: { operators: { name: string }[] }[];
  };
};
export function mergeMessages<T extends { id: string; created_at: string }>(
  current: T[],
  incoming: T[],
) {
  return [
    ...new Map([...current, ...incoming].map((m) => [m.id, m])).values(),
  ].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
}
export function findChatDestination<T extends Destination>(
  texts: string[],
  destinations: T[],
) {
  for (const text of [...texts].reverse()) {
    const query = ` ${normalized(text)} `;
    const matches = destinations.filter((d) =>
      [d.name.es, d.name.en, ...(d.aliases ?? [])].some((name) =>
        query.includes(` ${normalized(name)} `),
      ),
    );
    // Multiple named destinations need clarification rather than choosing one country silently.
    if (matches.length) return matches.length === 1 ? matches[0] : null;
  }
  return null;
}
export function selectChatPlans(plans: Candidate[], text: string) {
  const days = Number(
    [...normalized(text).matchAll(/(\d+)\s*(?:dias?|days?|jours?)\b/gi)].at(
      -1,
    )?.[1] ?? 0,
  );
  const gb = Number(
    [...text.matchAll(/(\d+(?:[.,]\d+)?)\s*gb\b/gi)]
      .at(-1)?.[1]
      ?.replace(",", ".") ?? 0,
  );
  const sorted = plans
    .filter(
      (p) =>
        p.kind === "fixed" &&
        /^[A-Za-z0-9_.-]{1,100}$/.test(p.id) &&
        Number.isSafeInteger(p.retailPriceCents) &&
        p.retailPriceCents! > 0 &&
        p.days >= days &&
        p.dataGb >= (gb || 1) &&
        (!gb || p.dataGb >= gb),
    )
    .sort(
      (a, b) =>
        (gb
          ? Math.abs(a.dataGb - gb) - Math.abs(b.dataGb - gb)
          : a.dataGb - b.dataGb) ||
        a.days - b.days ||
        a.retailPriceCents! - b.retailPriceCents!,
    );
  // Preserve allowance/duration choices before filling the budget with network variants.
  const primary = [
    ...new Map(sorted.map((p) => [`${p.dataGb}:${p.days}`, p])).keys(),
  ].map((key) => sorted.find((p) => `${p.dataGb}:${p.days}` === key)!);
  const candidates = [
    ...primary,
    ...sorted.filter((p) => !primary.includes(p)),
  ];
  return candidates.slice(0, 12).map((p) => ({
    id: p.id,
    name: p.name,
    dataGb: p.dataGb,
    days: p.days,
    priceCents: p.retailPriceCents!,
    variant: planVariant(p, "en").label,
    variantDescription: planVariant(p, "en").description,
    technologies: p.details?.technologies ?? [],
    operators: [
      ...new Set(
        p.details?.networks.flatMap((n) => n.operators.map((o) => o.name)) ??
          [],
      ),
    ].slice(0, 8),
  }));
}
export function planReferences(
  ids: string[],
  plans: ReturnType<typeof selectChatPlans>,
  destination: Destination,
  locale: "es" | "en",
) {
  return [...new Set(ids)].slice(0, 3).flatMap((id) => {
    const p = plans.find((p) => p.id === id);
    return p
      ? [
          {
            kind: "plan" as const,
            id: `plan:${p.id}`,
            title: `${destination.name[locale]} · ${p.dataGb} GB · ${p.days} ${locale === "es" ? "días" : "days"} · ${planVariant(p, locale).label}`,
            href: `/${locale}/esim/${destination.slug}?plan=${encodeURIComponent(p.id)}`,
            priceCents: p.priceCents,
          },
        ]
      : [];
  });
}

export function directPlanRecommendation(
  message: string,
  plans: ReturnType<typeof selectChatPlans>,
  locale: "es" | "en",
) {
  if (
    !/recom|quiero|busco|buy|compr|looking for|which plan/i.test(message) ||
    !/\d+(?:[.,]\d+)?\s*gb\b/i.test(message) ||
    !/\d+\s*(?:días?|dias?|days?)\b/i.test(message) ||
    /compar|difer|why|por qu[eé]|operador|network|refund|reembolso|fall|problem|not work|no funciona|error/i.test(
      message,
    ) ||
    !plans.length
  )
    return null;
  const plan = plans[0];
  return {
    planIds: [plan.id],
    answer:
      locale === "es"
        ? `Te recomiendo esta opción: incluye ${plan.dataGb} GB y ${plan.days} días de vigencia, suficientes para el viaje que indicas. Puedes ver sus redes y condiciones en la ficha antes de añadirla al carrito.`
        : `I recommend this option: it includes ${plan.dataGb} GB with ${plan.days} days of validity, enough for the trip you described. Check its networks and conditions on the plan page before adding it to your cart.`,
  };
}
