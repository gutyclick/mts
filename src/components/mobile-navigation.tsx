"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { BookOpen, Compass, House, LifeBuoy, WalletCards } from "lucide-react";
import { experiencePath } from "@/lib/experience-routes";
import { experienceCopy } from "@/lib/experience-copy";
import { dictionaries, pathFor, type Locale } from "@/lib/i18n";

export function MobileNavigation({ locale }: { locale: Locale }) {
  const pathname = usePathname();
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  useEffect(() => {
    const viewport = window.visualViewport;
    let width = window.innerWidth;
    let fullHeight = viewport?.height ?? window.innerHeight;
    const update = () => {
      const height = viewport?.height ?? window.innerHeight;
      if (width !== window.innerWidth) {
        width = window.innerWidth;
        fullHeight = height;
      }
      fullHeight = Math.max(fullHeight, height);
      const editing = document.activeElement?.matches("input, textarea");
      setKeyboardOpen(
        Boolean(
          editing && fullHeight - height > Math.max(120, fullHeight * 0.2),
        ),
      );
    };
    viewport?.addEventListener("resize", update);
    window.addEventListener("resize", update);
    document.addEventListener("focusin", update);
    document.addEventListener("focusout", update);
    return () => {
      viewport?.removeEventListener("resize", update);
      window.removeEventListener("resize", update);
      document.removeEventListener("focusin", update);
      document.removeEventListener("focusout", update);
    };
  }, []);
  const t = dictionaries[locale].mobile;
  const items = [
    {
      label: t.home,
      href: pathFor(locale),
      icon: House,
      active: pathname === pathFor(locale),
    },
    {
      label: t.destinations,
      href: pathFor(locale, "destinations"),
      icon: Compass,
      active:
        pathname === pathFor(locale, "destinations") ||
        pathname.startsWith(`/${locale}/esim/`) ||
        pathname.startsWith(`/${locale}/plan/`) ||
        pathname === experiencePath(locale, "checkout"),
    },
    {
      label: t.guide,
      href: pathFor(locale, "how"),
      icon: BookOpen,
      active: [
        pathFor(locale, "how"),
        pathFor(locale, "compatibility"),
        experiencePath(locale, "install"),
      ].includes(pathname),
    },
    {
      label: experienceCopy[locale].wallet,
      href: experiencePath(locale, "wallet"),
      icon: WalletCards,
      active: pathname === experiencePath(locale, "wallet"),
    },
    {
      label: t.help,
      href: pathFor(locale, "help"),
      icon: LifeBuoy,
      active:
        pathname.startsWith(`${pathFor(locale, "faq")}/`) ||
        [pathFor(locale, "help"), pathFor(locale, "faq")].includes(pathname),
    },
  ];
  return (
    <nav
      className="mobile-bottom-nav"
      aria-label={t.navigation}
      data-keyboard-open={keyboardOpen || undefined}
    >
      {items.map(({ label, href, icon: Icon, active }) => (
        <Link
          key={href}
          href={href}
          aria-current={
            active ? (pathname === href ? "page" : "location") : undefined
          }
        >
          <span className="mobile-tab-icon">
            <Icon
              size={21}
              strokeWidth={active ? 2.2 : 1.8}
              aria-hidden="true"
            />
          </span>
          <span>{label}</span>
        </Link>
      ))}
    </nav>
  );
}
