import { helpContent } from "./help-content.ts";
import { faqTopicPath, pathFor, type Locale } from "./i18n.ts";
import { isFAQTopic } from "./faq-topics.ts";

export function faqQuestionPath(locale: Locale, questionId: string) {
  const category = helpContent[locale].categories.find((category) =>
    category.questions.some((question) => question.id === questionId),
  );
  return category && isFAQTopic(category.id)
    ? `${faqTopicPath(locale, category.id)}#faq-${questionId}`
    : pathFor(locale, "faq");
}
