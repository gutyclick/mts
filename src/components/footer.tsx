import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { dictionaries, pathFor, type Locale, type PageKey } from "@/lib/i18n";
import { Brand } from "./ui";
import { LanguageSwitcher } from "./site-navigation";

export function Footer({ locale }: { locale: Locale }) {
  const t = dictionaries[locale];
  const columns: { title: string; pages: PageKey[] }[] = [
    { title: t.explore, pages: ["destinations", "how"] },
    { title: t.useful, pages: ["compatibility", "help"] },
    { title: t.legal, pages: ["terms", "privacy", "refunds"] },
  ];
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-main">
          <div className="footer-brand">
            <Link href={pathFor(locale)} aria-label="MyTripSim">
              <Brand />
            </Link>
            <p>{t.footerDescription}</p>
            <span className="footer-tag">
              <span />
              {t.footerTag}
            </span>
          </div>
          {columns.map((column) => (
            <div className="footer-column" key={column.title}>
              <h2>{column.title}</h2>
              {column.pages.map((page) => (
                <Link key={page} href={pathFor(locale, page)}>
                  {t.nav[page]}
                  {page === "help" && <ArrowUpRight size={13} />}
                </Link>
              ))}
            </div>
          ))}
        </div>
        <div className="footer-bottom">
          <p>
            © {new Date().getUTCFullYear()} MyTripSim. {t.rights}
            <span>{t.company}</span>
          </p>
          <LanguageSwitcher locale={locale} />
        </div>
      </div>
    </footer>
  );
}
