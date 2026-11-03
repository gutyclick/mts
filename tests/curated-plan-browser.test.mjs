import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import ts from "typescript";
import { readFileSync } from "node:fs";
const source = ts.transpileModule(
  readFileSync("src/components/plan-browser.tsx", "utf8"),
  {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  },
).outputText;
const plan = (id, gb, days, price) => ({
  id,
  allowance: gb + " GB",
  dataGb: gb,
  days,
  retailPriceCents: price,
});
const entry = (id, category, recommended = false) => ({
  plan: plan(id, category === "basic" ? 1 : 5, 30, 1399),
  category,
  recommended,
  reasons: [],
});
const catalog = {
  defaultMode: "standard",
  modes: [
    {
      id: "standard",
      label: { es: "Datos", en: "Data" },
      description: { es: "Para tu viaje", en: "For your trip" },
      plans: [entry("a", "basic"), entry("b", "essential", true)],
    },
    {
      id: "daily",
      label: { es: "Diario", en: "Daily" },
      description: { es: "Datos cada día", en: "Data every day" },
      plans: [entry("c", "basic"), entry("d", "essential", true)],
    },
  ],
};
function nodes(node) {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!node || typeof node !== "object") return [];
  return [node, ...nodes(node.props?.children)];
}
function harness(initialPlanId = "", curatedCatalog = catalog) {
  let cursor = 0,
    tree;
  const slots = [];
  const urls = [];
  const cart = [];
  const react = {
    useId: () => "test",
    useState(initial) {
      const i = cursor++;
      if (!(i in slots)) slots[i] = initial;
      return [
        slots[i],
        (value) => {
          slots[i] = value;
        },
      ];
    },
  };
  const jsx = (type, props) => ({ type, props });
  const Summary = (props) => ({
    type: "summary",
    props: { ...props, onAdd: () => cart.push(props.plan.id) },
  });
  const exports = {};
  vm.runInNewContext(source, {
    exports,
    URLSearchParams,
    window: {
      location: { search: "" },
      history: { replaceState: (_a, _b, url) => urls.push(url) },
    },
    require(name) {
      if (name === "react") return react;
      if (name === "react/jsx-runtime") return { jsx, jsxs: jsx };
      if (name.includes("plan-purchase-summary"))
        return { PlanPurchaseSummary: Summary };
      if (name.includes("i18n")) return { pathFor: () => "/es/esim/japan" };
      if (name.includes("catalog-copy")) return { catalogCopy: { es: {} } };
      return {};
    },
  });
  function render() {
    cursor = 0;
    const wrapper = exports.PlanBrowser({
      locale: "es",
      destination: { slug: "japan" },
      availablePlans: [],
      initialPlanId,
      curatedCatalog,
    });
    tree = wrapper.type(wrapper.props);
    return nodes(tree);
  }
  const find = (predicate) => render().find(predicate);
  return {
    render,
    urls,
    cart,
    choose(id) {
      find((n) => n.type === "input" && n.props.value === id).props.onChange();
    },
    selected() {
      return find((n) => n.type === Summary).props.plan;
    },
    add() {
      const summary = find((n) => n.type === Summary);
      Summary(summary.props).props.onAdd();
    },
  };
}
test("curated cards keep actual SKU and existing price in summary and cart", () => {
  const h = harness();
  assert.equal(h.selected().id, "a");
  h.choose("b");
  assert.equal(h.selected().retailPriceCents, 1399);
  h.add();
  assert.deepEqual(h.cart, ["b"]);
  assert.match(h.urls.at(-1), /plan=b/);
  assert.equal(
    h.render().filter((n) => n.props?.className === "curated-plan-card").length,
    2,
  );
  assert.equal(h.render().filter((n) => n.type === "select").length, 0);
});
test("mode switch selects equivalent category then first available and never purchases stale SKU", () => {
  const h = harness("b");
  h.choose("daily");
  assert.equal(h.selected().id, "d");
  h.add();
  assert.deepEqual(h.cart, ["d"]);
  const reduced = structuredClone(catalog);
  reduced.modes[1].plans.pop();
  const fallback = harness("b", reduced);
  fallback.choose("daily");
  assert.equal(fallback.selected().id, "c");
});
test("only curated deep links survive and a single mode hides mode controls", () => {
  assert.equal(harness("d").selected().id, "d");
  assert.equal(harness("excluded-provider-sku").selected().id, "a");
  const one = { ...catalog, modes: [catalog.modes[0]] };
  assert.equal(
    harness("", one)
      .render()
      .filter((n) => n.props?.className === "curated-mode-switch").length,
    0,
  );
});

test("long stays sit inside a collapsed disclosure and select the exact SKU", () => {
  const extended = structuredClone(catalog);
  const longPlan = plan("long-20-90", 20, 90, 4599);
  extended.modes[0].secondaryPlans = [longPlan];
  const h = harness("", extended);
  const disclosure = h.render().find((n) => n.type === "details");
  assert.equal(disclosure.props.open, undefined);
  assert.equal(
    nodes(disclosure).find((n) => n.type === "summary").props.children,
    "Estancias largas",
  );
  assert.equal(
    nodes(disclosure).filter(
      (n) => n.type === "input" && n.props.value === longPlan.id,
    ).length,
    1,
  );
  assert.equal(
    h.render().filter((n) => n.props?.className === "curated-plan-card").length,
    2,
  );
  h.choose(longPlan.id);
  assert.equal(h.selected().id, longPlan.id);
  assert.equal(h.selected().days, 90);
  assert.equal(h.selected().retailPriceCents, 4599);
  h.add();
  assert.deepEqual(h.cart, [longPlan.id]);
  h.choose("daily");
  assert.equal(h.selected().id, "c");
  assert.equal(harness(longPlan.id, extended).selected().id, longPlan.id);
});
