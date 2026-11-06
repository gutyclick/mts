import test from "node:test";
import assert from "node:assert/strict";
import { catalogPreviewEnabled } from "../src/lib/catalog-preview.ts";
test("catalog redesign is explicit and cannot activate on a deployed environment", () => {
  assert.equal(catalogPreviewEnabled({}), false);
  assert.equal(
    catalogPreviewEnabled({
      CATALOG_REDESIGN_PREVIEW: "true",
      NODE_ENV: "development",
    }),
    true,
  );
  for (const extra of [
    { VERCEL: "1" },
    { VERCEL_ENV: "production" },
    { VERCEL_ENV: "preview" },
    { CI: "true" },
  ])
    assert.equal(
      catalogPreviewEnabled({ CATALOG_REDESIGN_PREVIEW: "true", ...extra }),
      false,
    );
});
