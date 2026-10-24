import Link from "next/link";
import {
  ArrowUpRight,
  Compass,
  Smartphone,
  QrCode,
  Wifi,
  Plane,
  LifeBuoy,
} from "lucide-react";
import { helpContent } from "@/lib/help-content";
import { pathFor, type Locale } from "@/lib/i18n";
const icons = [Compass, Smartphone, QrCode, Wifi, Plane, LifeBuoy];
export function HelpHub({ locale }: { locale: Locale }) {
  return (
    <div className="help-topic-grid">
      {helpContent[locale].categories.map((category, index) => {
        const Icon = icons[index];
        return (
          <Link
            key={category.id}
            href={`${pathFor(locale, "faq")}#${category.id}`}
          >
            <span className="learning-icon">
              <Icon size={25} />
            </span>
            <h2>{category.title}</h2>
            <p>{category.description}</p>
            <ArrowUpRight size={20} />
          </Link>
        );
      })}
    </div>
  );
}
