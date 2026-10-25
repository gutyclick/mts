import { test } from "node:test";
import assert from "node:assert/strict";
import { addCartLine, cartSchema, readCart } from "../src/lib/cart.ts";

const line = { destination: "japan", planId: "JP_5_30", quantity: 1 };
test("cart storage rejects personal data, forged prices, duplicate references and invalid quantities", () => {
  for (const value of [
    "invalid",
    JSON.stringify([{ ...line, email: "private@example.invalid" }]),
    JSON.stringify([{ ...line, price: 1 }]),
    JSON.stringify([line, line]),
    JSON.stringify([{ ...line, quantity: 100 }]),
    JSON.stringify([{ ...line, quantity: 1.5 }]),
  ])
    assert.deepEqual(readCart(value), []);
  assert.deepEqual(readCart(JSON.stringify([line])), [line]);
});
test("repeated additions merge quantities and enforce cart limits", () => {
  let lines = [];
  for (let i = 0; i < 15; i++) lines = addCartLine(lines, line);
  assert.equal(lines.length, 1);
  assert.equal(lines[0].quantity, 10);
  for (let i = 0; i < 25; i++)
    lines = addCartLine(lines, { ...line, planId: `plan-${i}` });
  assert.equal(lines.length, 20);
  assert.equal(cartSchema.safeParse(lines).success, true);
});
