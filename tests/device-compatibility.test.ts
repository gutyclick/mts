import { test } from "node:test";
import assert from "node:assert/strict";
import {
  assessDevice,
  deviceBrands,
  deviceSources,
} from "../src/lib/device-compatibility.ts";
const iphone = deviceBrands[0].models.find(
  (model) => model.name === "iPhone 16",
)!;
const pixel = deviceBrands.find((brand) => brand.name === "Google Pixel")!;
test("only documented models with affirmative checks can receive a qualified result", () => {
  assert.equal(
    assessDevice("Apple · iPhone", iphone, "es", "yes", "yes"),
    "ready",
  );
  assert.equal(
    assessDevice("Apple · iPhone", iphone, "cn", "yes", "yes"),
    "review",
  );
  assert.equal(
    assessDevice("Apple · iPhone", iphone, "hk", "yes", "yes"),
    "review",
  );
  assert.equal(
    assessDevice("Apple · iPhone", iphone, "unknown", "yes", "yes"),
    "review",
  );
  assert.equal(assessDevice("Other", undefined, "es", "yes", "yes"), "review");
  assert.equal(
    assessDevice("Other", { name: "Candidate" }, "es", "yes", "yes"),
    "review",
  );
  assert.equal(
    assessDevice("Apple · iPhone", iphone, "es", "unknown", "yes"),
    "review",
  );
  assert.equal(
    assessDevice("Apple · iPhone", iphone, "es", "yes", "no"),
    "review",
  );
  assert.equal(
    assessDevice("Apple · iPhone", iphone, "es", "no", "yes"),
    "locked",
  );
});
test("Google country and carrier exceptions are not lost", () => {
  const model = (name: string) =>
    pixel.models.find((model) => model.name === name)!;
  for (const region of ["au", "jp", "tw"])
    assert.equal(
      assessDevice(pixel.name, model("Pixel 3"), region, "yes", "yes"),
      "excluded",
    );
  assert.equal(
    assessDevice(pixel.name, model("Pixel 3a"), "jp", "yes", "yes"),
    "excluded",
  );
  assert.equal(
    assessDevice(pixel.name, model("Pixel 3a"), "us", "yes", "yes"),
    "review",
  );
  assert.equal(
    assessDevice(pixel.name, model("Pixel 9"), "hk", "yes", "yes"),
    "ready",
  );
});
test("regional evidence cannot approve unreviewed markets or contradictory supplier entries", () => {
  const samsung = deviceBrands.find((brand) => brand.name === "Samsung")!;
  const model = samsung.models.find((model) => model.name === "Galaxy A56 5G")!;
  assert.equal(assessDevice(samsung.name, model, "uk", "yes", "yes"), "ready");
  assert.equal(assessDevice(samsung.name, model, "cn", "yes", "yes"), "review");
  const oneplus = deviceBrands
    .find((brand) => brand.name === "OnePlus")!
    .models.find((model) => model.name === "OnePlus 13R");
  assert.equal(assessDevice("OnePlus", oneplus, "us", "yes", "yes"), "review");
  for (const brand of deviceBrands) {
    assert.equal(
      new Set(brand.models.map((model) => model.name)).size,
      brand.models.length,
    );
    for (const model of brand.models)
      if (model.source)
        assert.ok(deviceSources[model.source].url.startsWith("https://"));
  }
});
