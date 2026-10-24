import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { helpTopicIcons } from "./help-topic-icons";
import { helpContent } from "@/lib/help-content";
import { faqTopicPath, type Locale } from "@/lib/i18n";
import type { FAQTopic } from "@/lib/faq-topics";
export function HelpHub({ locale }: { locale: Locale }) {
  return (
    <div className="help-topic-grid">
      {helpContent[locale].categories.map((category) => {
        const Icon = helpTopicIcons[category.id as keyof typeof helpTopicIcons];
        return (
          <Link
            key={category.id}
            href={faqTopicPath(locale, category.id as FAQTopic)}
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
