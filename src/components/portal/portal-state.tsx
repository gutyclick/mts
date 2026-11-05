"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { exampleTrips, type PortalTrip } from "@/lib/portal/model";

const PortalContext = createContext<{
  trips: PortalTrip[];
  update: (trip: PortalTrip) => void;
} | null>(null);

export function PortalProvider({ children }: { children: ReactNode }) {
  const [trips, setTrips] = useState<PortalTrip[]>(exampleTrips);
  function update(trip: PortalTrip) {
    setTrips((current) =>
      current.some((value) => value.id === trip.id)
        ? current.map((value) => (value.id === trip.id ? trip : value))
        : [trip, ...current],
    );
  }
  return (
    <PortalContext.Provider value={{ trips, update }}>
      {children}
    </PortalContext.Provider>
  );
}

export function usePortal() {
  const context = useContext(PortalContext);
  if (!context) throw new Error("PortalProvider required");
  return context;
}
