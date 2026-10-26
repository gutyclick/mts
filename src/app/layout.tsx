import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import "@/styles/marketing.css";
import "@/styles/mobile.css";
import "@/styles/catalog.css";
import "@/styles/experience.css";
import "@/styles/compatibility.css";
import "@/styles/plan-selection.css";
import "@/styles/how-it-works.css";
import "@/styles/sim-mascot.css";
import "@/styles/account.css";
import "@/styles/commerce.css";
import "@/styles/admin.css";
import "@/styles/support.css";
import "@/styles/destination-editorial.css";
import "@/styles/seo.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: "#fcfdfe",
};
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
});
export const metadata: Metadata = {
  metadataBase: new URL("https://www.mytripsim.com"),
  title: {
    default: "MyTripSim — Stay connected, wherever you go",
    template: "%s | MyTripSim",
  },
  description: "Explore travel eSIM plans with MyTripSim.",
  robots: { index: true, follow: true },
};
export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale =
    (await headers()).get("x-mytripsim-locale") === "es" ? "es" : "en";
  return (
    <html lang={locale} className={`${inter.variable} ${jakarta.variable}`}>
      <body>{children}</body>
    </html>
  );
}
