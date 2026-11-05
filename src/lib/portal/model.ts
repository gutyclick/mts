export type TripMode = "individual" | "package";
export type TripStatus = "draft" | "pending" | "approved" | "changes" | "ready";
export type PortalTrip = {
  id: string;
  name: string;
  destination: string;
  departure: string;
  returning: string;
  travelers: number;
  mode: TripMode;
  status: TripStatus;
  assigned: number;
  delivered: number;
  activated: number;
  sold: number;
  version?: number;
  destinationSlug?: string;
  request?: {
    id: string;
    quantity: number;
    plan: string;
    planName?: string;
    days?: number;
    dataGb?: number;
    version?: number;
    reviewNote?: string | null;
  };
};
export type NewTrip = Pick<
  PortalTrip,
  "name" | "destination" | "departure" | "returning" | "travelers" | "mode"
>;

const validDate = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(value)) &&
  new Date(value).toISOString().slice(0, 10) === value;
export function createTrip(input: NewTrip, id: string): PortalTrip {
  if (
    !input.name.trim() ||
    input.name.length > 90 ||
    !input.destination.trim() ||
    input.destination.length > 80 ||
    !validDate(input.departure) ||
    !validDate(input.returning) ||
    input.returning < input.departure ||
    !Number.isInteger(input.travelers) ||
    input.travelers < 1 ||
    input.travelers > 10000 ||
    !["individual", "package"].includes(input.mode)
  )
    throw new Error("invalid_trip");
  return {
    ...input,
    name: input.name.trim(),
    destination: input.destination.trim(),
    id,
    status: "draft",
    assigned: 0,
    delivered: 0,
    activated: 0,
    sold: 0,
  };
}
export function requestTrip(
  trip: PortalTrip,
  quantity: number,
  plan: string,
  id: string,
): PortalTrip {
  if (
    !["draft", "changes"].includes(trip.status) ||
    !Number.isInteger(quantity) ||
    quantity < 1 ||
    quantity > trip.travelers ||
    (trip.mode === "package" && quantity !== trip.travelers) ||
    !["1gb", "5gb", "10gb", "20gb"].includes(plan)
  )
    throw new Error("invalid_request");
  return { ...trip, status: "pending", request: { id, quantity, plan } };
}
export function reviewRequest(
  trip: PortalTrip,
  decision: "approved" | "changes",
): PortalTrip {
  if (
    trip.status !== "pending" ||
    !trip.request ||
    !["approved", "changes"].includes(decision)
  )
    throw new Error("invalid_review");
  return { ...trip, status: decision };
}
export function summarizeTrips(trips: PortalTrip[]) {
  return trips.reduce(
    (total, trip) => ({
      travelers: total.travelers + trip.travelers,
      assigned: total.assigned + trip.assigned,
      delivered: total.delivered + trip.delivered,
      activated: total.activated + trip.activated,
      pending: total.pending + Number(trip.status === "pending"),
    }),
    { travelers: 0, assigned: 0, delivered: 0, activated: 0, pending: 0 },
  );
}

/** Fictional fixtures only. Never hydrate this prototype from retail orders. */
export const exampleTrips: PortalTrip[] = [
  {
    id: "europe-december",
    name: "Europa en diciembre",
    destination: "Europa",
    departure: "2026-12-20",
    returning: "2026-12-30",
    travelers: 30,
    mode: "individual",
    status: "ready",
    assigned: 25,
    delivered: 23,
    activated: 20,
    sold: 25,
    request: { id: "EX-001", quantity: 25, plan: "10gb" },
  },
  {
    id: "japan-discovery",
    name: "Descubre Japón",
    destination: "Japón",
    departure: "2027-01-12",
    returning: "2027-01-24",
    travelers: 18,
    mode: "package",
    status: "pending",
    assigned: 0,
    delivered: 0,
    activated: 0,
    sold: 0,
    request: { id: "EX-002", quantity: 18, plan: "5gb" },
  },
  {
    id: "mexico-team",
    name: "Encuentro en México",
    destination: "México",
    departure: "2027-02-05",
    returning: "2027-02-09",
    travelers: 12,
    mode: "package",
    status: "draft",
    assigned: 0,
    delivered: 0,
    activated: 0,
    sold: 0,
  },
];
