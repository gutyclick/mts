import { notFound } from "next/navigation";
import { isLocale, locales } from "@/lib/i18n";
import { simcoinsMetadata, simcoinsPageSchema } from "@/lib/simcoins/seo";
import {
  getCustomerSimcoins,
  getSimcoinsPublicProgram,
} from "@/lib/simcoins/server";
import { simcoinsFlags } from "@/lib/simcoins/config";
import { authClient } from "@/lib/supabase/auth-server";
import { SimcoinsLanding } from "@/components/simcoins/landing";
import "@/styles/simcoins.css";
export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return simcoinsMetadata(locale);
}
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  if (!simcoinsFlags().publicEnabled) notFound();
  const program = await getSimcoinsPublicProgram();
  if (!program.publicEnabled) notFound();
  let currentLevelId: string | undefined;
  let authenticated = false;
  try {
    const client = await authClient();
    const {
      data: { user },
    } = await client.auth.getUser();
    if (user) {
      authenticated = true;
      currentLevelId = (await getCustomerSimcoins(user.id)).wallet.level.id;
    }
  } catch {
    /* Public program information remains available during an auth outage. */
  }
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(simcoinsPageSchema(locale)).replace(
            /</g,
            "\\u003c",
          ),
        }}
      />
      <SimcoinsLanding
        locale={locale}
        program={program}
        authenticated={authenticated}
        currentLevelId={currentLevelId}
      />
    </>
  );
}
