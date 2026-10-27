import test from "node:test";
import assert from "node:assert/strict";
import {
  simcoinsMetadata,
  simcoinsPageSchema,
} from "../src/lib/simcoins/seo.ts";

test("rewards metadata and breadcrumbs agree on the public localized canonical without inventing commercial offers", () => {
  for (const locale of ["es", "en"]) {
    const metadata = simcoinsMetadata(locale),
      schema = simcoinsPageSchema(locale);
    const page = schema["@graph"][0],
      breadcrumb = schema["@graph"][1];
    assert.equal(
      metadata.alternates.canonical,
      `https://www.mytripsim.com/${locale}/simcoins`,
    );
    assert.equal(metadata.openGraph.url, page.url);
    assert.equal(page.inLanguage, locale);
    assert.equal(breadcrumb.itemListElement[1].item, page.url);
    assert.equal(
      metadata.alternates.languages.es,
      "https://www.mytripsim.com/es/simcoins",
    );
    assert.equal(
      metadata.alternates.languages.en,
      "https://www.mytripsim.com/en/simcoins",
    );
    assert.match(metadata.title, /SimCoins.*eSIM/);
    assert.ok(
      !/calculator|calculadora|Offer|AggregateRating|FAQPage/.test(
        JSON.stringify({ metadata, schema }),
      ),
    );
  }
});
