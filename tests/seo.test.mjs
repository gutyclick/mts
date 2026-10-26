import test from "node:test";
import assert from "node:assert/strict";
import {
  metadata,
  localizedMetadata,
  breadcrumbSchema,
  siteIdentity,
  siteUrl,
} from "../src/lib/seo.ts";
import { destinationContent } from "../src/lib/destination-content.ts";
import { relatedCoverageDestinations } from "../src/lib/destination-links.ts";

test("public metadata uses the final host and reciprocal language URLs", () => {
  assert.equal(siteUrl, "https://www.mytripsim.com");
  for (const locale of ["es", "en"]) {
    const meta = metadata(
      locale,
      "Panama eSIM",
      "Actual coverage",
      undefined,
      "panama",
    );
    assert.equal(meta.alternates.canonical, `${siteUrl}/${locale}/esim/panama`);
    assert.equal(meta.alternates.languages.es, `${siteUrl}/es/esim/panama`);
    assert.equal(meta.alternates.languages.en, `${siteUrl}/en/esim/panama`);
    assert.equal(meta.openGraph.url, meta.alternates.canonical);
    assert.equal(
      meta.alternates.languages["x-default"],
      meta.alternates.languages.en,
    );
  }
  const install = localizedMetadata("es", "Installation", "Guide", {
    en: "/en/install",
    es: "/es/instalar",
  });
  assert.equal(install.alternates.canonical, `${siteUrl}/es/instalar`);
});

test("brand and breadcrumb entities describe actual navigation without invented offers or ratings", () => {
  const schema = breadcrumbSchema([
    { name: "Inicio", path: "/es" },
    { name: "Panamá", path: "/es/esim/panama" },
  ]);
  assert.deepEqual(
    schema.itemListElement.map((x) => x.position),
    [1, 2],
  );
  assert.equal(schema.itemListElement[1].item, `${siteUrl}/es/esim/panama`);
  const organization = siteIdentity["@graph"].find(
    (x) => x["@type"] === "Organization",
  );
  assert.equal(organization.logo, `${siteUrl}/icons/icon-512.png`);
  assert.equal(organization.email, "hello@mytripsim.com");
  assert.ok(
    !JSON.stringify(siteIdentity).match(/aggregateRating|InStock|Offer/),
  );
});

const country = {
  slug: "panama",
  code: "PA",
  name: { es: "Panamá", en: "Panama" },
  type: "country",
  planCount: 1,
};
const plan = {
  id: "test",
  name: "Panama 1GB",
  dataGb: 1,
  days: 7,
  details: {
    activation: "network",
    coverage: ["PA"],
    networks: [{ countryCode: "PA", operators: [{ name: "Test operator" }] }],
  },
};
test("destination content never invents activation or networks for missing variants", () => {
  const missing = { ...plan, details: undefined };
  const result = destinationContent("es", country, [plan, missing]);
  assert.match(result.activation, /no está confirmado/);
  assert.ok(!result.activation.includes("al comprar"));
  assert.match(result.networkSummary, /Test operator/);
  assert.match(
    destinationContent("en", country, []).description,
    /availability/,
  );
  assert.match(
    destinationContent("en", country, [plan]).activation,
    /first connection/,
  );
});

test("regional related links only recommend explicitly covered published countries", () => {
  const region = { ...country, slug: "regional", code: "REG", type: "region" };
  const unrelated = { ...country, slug: "japan", code: "JP" };
  const unpublished = { ...country, slug: "unpublished", planCount: 0 };
  const result = relatedCoverageDestinations(
    region,
    [plan],
    [country, unrelated, unpublished],
    "es",
  );
  assert.deepEqual(
    result.map((x) => x.slug),
    ["panama"],
  );
});
