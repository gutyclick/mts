/** Compare exact destination/variant and full registered service conditions.
 * A commercial ordering rule, not a claim that equal prices are technically impossible.
 */
export function commercialKey(plan, variant) {
  const d = plan.details ?? {};
  return JSON.stringify({
    destination: plan.destinationSlug,
    variant,
    activation: d.activation,
    coverage: [...(d.coverage ?? [])].sort(),
    technologies: [...(d.technologies ?? [])].sort(),
    networks: (d.networks ?? [])
      .map((n) => [
        n.countryCode,
        n.operators
          .map((o) => [o.name, [...(o.technologies ?? [])].sort()])
          .sort(),
      ])
      .sort(),
    apn: d.apn,
    topUp: d.topUp,
    fairUse: d.fairUse,
  });
}

export function coherencePairs(plans, key) {
  const pairs = [];
  const keys = new Map(plans.map((plan) => [plan, key(plan)]));
  for (let i = 0; i < plans.length; i++) {
    for (let j = i + 1; j < plans.length; j++) {
      let a = plans[i],
        b = plans[j];
      if (keys.get(a) !== keys.get(b)) continue;
      let type;
      if (a.dataGb === b.dataGb && a.days !== b.days) {
        if (a.days > b.days) [a, b] = [b, a];
        type = "DURACION";
      } else if (a.days === b.days && a.dataGb !== b.dataGb) {
        if (a.dataGb > b.dataGb) [a, b] = [b, a];
        type = "CAPACIDAD";
      } else if (
        (a.dataGb < b.dataGb && a.days < b.days) ||
        (b.dataGb < a.dataGb && b.days < a.days)
      ) {
        if (a.dataGb > b.dataGb) [a, b] = [b, a];
        type = "CAPACIDAD_Y_DURACION";
      }
      if (type)
        pairs.push({
          a,
          b,
          type,
          flagged: b.retailPriceCents <= a.retailPriceCents,
        });
    }
  }
  return pairs;
}

export function suggestedMinimum(a, b, type, lowerPriceCents) {
  if (type === "DURACION" && a.days === 15 && b.days === 30)
    return Math.max(
      lowerPriceCents + 200,
      Math.ceil((lowerPriceCents * 125) / 10000) * 100,
    );
  return lowerPriceCents + 100;
}
