"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { PortalTrip } from "@/lib/portal/model";
import type { BusinessWorkspace, BusinessSupport } from "@/lib/portal/business";

const PortalContext = createContext<{
  trips: PortalTrip[];
  workspace: BusinessWorkspace;
  company: NonNullable<BusinessWorkspace["company"]>;
  support: BusinessSupport;
  mutate: (body: unknown) => Promise<string | null>;
} | null>(null);

export function PortalProvider({
  children,
  trips,
  workspace,
  support,
}: {
  children: ReactNode;
  trips: PortalTrip[];
  workspace: BusinessWorkspace;
  support: BusinessSupport;
}) {
  if (!workspace.company) throw Error("Company required");
  async function mutate(body: unknown): Promise<string | null> {
    const response = await fetch("/api/portal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const value = await response.json();
    if (!response.ok) throw Error(value.error ?? "unavailable");
    return typeof value.id === "string" ? value.id : null;
  }
  return (
    <PortalContext.Provider
      value={{ trips, workspace, company: workspace.company, support, mutate }}
    >
      {children}
    </PortalContext.Provider>
  );
}

export function usePortal() {
  const context = useContext(PortalContext);
  if (!context) throw new Error("PortalProvider required");
  return context;
}
