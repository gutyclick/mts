import Link from "next/link";
import {
  ArrowUpRight,
  BookOpen,
  MessageCircleQuestion,
  Smartphone,
} from "lucide-react";
import { catalogCopy } from "@/lib/catalog-copy";
import { pathFor, type Locale } from "@/lib/i18n";
import { IconBadge, SectionHeading } from "./ui";
export function LearningLinks({ locale }: { locale: Locale }) {
  const c = catalogCopy[locale];
  const links = [
    {
      key: "how" as const,
      title: c.how,
      body: c.howDescription,
      icon: BookOpen,
    },
    {
      key: "compatibility" as const,
      title: c.compatibility,
      body: c.compatibilityDescription,
      icon: Smartphone,
    },
    {
      key: "faq" as const,
      title: c.faq,
      body: c.faqDescription,
      icon: MessageCircleQuestion,
    },
  ];
  return (
    <section className="container learning-section">
      <SectionHeading title={c.prepare} description={c.prepareDescription} />
      <div className="learning-grid">
        {links.map(({ key, title, body, icon }) => (
          <Link href={pathFor(locale, key)} key={key}>
            <IconBadge icon={icon} />
            <div>
              <h3>{title}</h3>
              <p>{body}</p>
            </div>
            <ArrowUpRight size={18} />
          </Link>
        ))}
      </div>
    </section>
  );
}
