import type { Metadata } from "next";
import { PortalProvider } from "@/components/portal/portal-state";
import "@/styles/portal.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://portal.mytripsim.com"),
  title: {
    default: "MyTripSim · Business portal",
    template: "%s | MyTripSim Business",
  },
  description:
    "Travel connectivity for teams and groups. / Conectividad para viajes de empresas y grupos.",
  robots: { index: false, follow: false },
};

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PortalProvider>{children}</PortalProvider>;
}
