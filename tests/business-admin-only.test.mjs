import test from "node:test";
import assert from "node:assert/strict";
import {
  businessAction,
  businessAdminAction,
} from "../src/lib/portal/business.ts";
const id = "11111111-1111-4111-8111-111111111111";
test("business account creation and access assignment are administrator-only", () => {
  for (const body of [
    { action: "apply", name: "Company", website: "", note: "" },
    {
      action: "invite",
      companyId: id,
      email: "person@example.invalid",
      role: "finance",
    },
    { action: "accept_invitation", id },
  ])
    assert.equal(businessAction.safeParse(body).success, false);
  assert.equal(
    businessAdminAction.safeParse({
      action: "create_company",
      id,
      name: "Company",
      email: "owner@example.invalid",
    }).success,
    true,
  );
  assert.equal(
    businessAdminAction.safeParse({
      action: "add_member",
      companyId: id,
      email: "member@example.invalid",
      role: "finance",
    }).success,
    true,
  );
  assert.equal(
    businessAdminAction.safeParse({
      action: "create_company",
      id,
      name: "Company",
      email: "owner@example.invalid",
      actor: id,
    }).success,
    false,
  );
});
