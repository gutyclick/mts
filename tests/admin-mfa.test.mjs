import test from "node:test";
import assert from "node:assert/strict";
import { adminAssurance } from "../src/lib/admin/security-model.ts";
test("admin access needs real membership, confirmed MFA and AAL2; metadata and stale levels do not suffice", () => {
  assert.deepEqual(adminAssurance(false, "aal2", true), {
    admin: false,
    member: false,
    needsMfa: false,
  });
  assert.deepEqual(adminAssurance(true, "aal1", true), {
    admin: false,
    member: true,
    needsMfa: true,
  });
  assert.equal(adminAssurance(true, "aal2", false).admin, false);
  assert.equal(adminAssurance(true, null, true).admin, false);
  assert.equal(adminAssurance(true, "aal2", true).admin, true);
});
