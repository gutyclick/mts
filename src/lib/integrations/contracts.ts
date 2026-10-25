// Payment and fulfillment contracts for the next stage. The read-only supplier
// integration is implemented in esimaccess-api.ts; costs are never projected here.
export interface SupplierPlan {
  providerPackageId: string;
  destinationSlug: string;
  dataGb: number;
  validityDays: number;
  coveredCountries: string[];
  networks: string[];
  activationRule: string;
  topUpEligible: boolean;
}
export interface CatalogProvider {
  syncCatalog(): Promise<SupplierPlan[]>;
}
export interface CheckoutProvider {
  createCheckout(input: {
    planId: string;
    locale: "en" | "es";
    idempotencyKey: string;
  }): Promise<{ url: string }>;
}
export interface EsimProvisioner {
  provision(input: {
    paidOrderId: string;
    providerPackageId: string;
    idempotencyKey: string;
  }): Promise<{ provisioningId: string }>;
}
export interface DeliveryProvider {
  sendInstallationGuide(input: {
    orderId: string;
    recipient: string;
  }): Promise<void>;
}
