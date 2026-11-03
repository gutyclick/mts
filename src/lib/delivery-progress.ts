export type DeliveryUnit = {
  state: string;
  installationReady?: boolean;
  qr?: string;
  smdpAddress?: string;
  activationCode?: string;
};

// The API's credential availability is authoritative, independently of email state.
export function canInstallDelivery(unit: DeliveryUnit) {
  if (unit.state === "test_skipped") return false;
  return (
    unit.installationReady === true ||
    (unit.installationReady === undefined &&
      !!unit.qr &&
      !!unit.smdpAddress &&
      !!unit.activationCode)
  );
}

export function deliveryProgress(
  units: DeliveryUnit[],
  expectedUnits?: number,
) {
  const total = Math.max(expectedUnits ?? 0, units.length);
  const ready = units.filter(canInstallDelivery).length;
  const review = units.filter(
    (unit) => unit.state === "review" && !canInstallDelivery(unit),
  ).length;
  const tests = units.filter((unit) => unit.state === "test_skipped").length;
  return {
    total,
    ready,
    review,
    testOnly: total > 0 && tests === total,
    complete: total > 0 && ready === total,
    partial: ready > 0 && ready < total,
  };
}
