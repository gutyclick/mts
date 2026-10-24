// Explicitly fictional UI records. No ICCID, activation code, QR payload or customer data.
export const demoEsims = [
  {
    id: "trip-japan",
    destination: "japan",
    status: "ready",
    allowance: 5,
    used: 0,
    days: 15,
    dates: "12–26 Nov 2026",
  },
  {
    id: "trip-france",
    destination: "france",
    status: "active",
    allowance: 10,
    used: 3.2,
    days: 30,
    dates: "01–30 Nov 2026",
  },
  {
    id: "trip-usa",
    destination: "united-states",
    status: "ended",
    allowance: 3,
    used: 3,
    days: 7,
    dates: "01–07 Oct 2026",
  },
] as const;
export type DemoEsim = (typeof demoEsims)[number];
