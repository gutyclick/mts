import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";

// Import only the isolated worker. Production adapters stay lazy; every provider
// and database operation below is an in-memory fake, with no purchases or email.
const source = readFileSync(
  new URL("../src/lib/portal/fulfillment-server.ts", import.meta.url),
  "utf8",
);
const { runBusinessFulfillmentWorker: run } = await import(
  `data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(source.replace('import "server-only";', ""))).toString("base64")}`
);
const unit = () => ({
  id: "unit1",
  order_id: "order1",
  state: "queued",
  attempts: 1,
  provider_transaction_id: "b2b_fixed_unit1",
  provider_order_no: null,
  provider_slug: "PA_1_7",
  package_code: "PKG_PA_001",
  volume_bytes: 1073741824,
  days: 7,
  lease_token: "lease1",
});
const profile = {
  transactionId: "TRAN1",
  orderNo: "ORDER1",
  iccid: "89852245280001354019",
  smdpAddress: "rsp.example.com",
  activationCode: "SECRET",
  status: "GOT_RESOURCE",
  smdpStatus: "RELEASED",
  volumeBytes: 1073741824,
  usedBytes: 0,
  expiresAt: null,
  packageSlug: "PA_1_7",
  days: 7,
  apn: null,
};
function fixture(rows = [unit()]) {
  const calls = { claims: 0, buys: [], profiles: [], saves: [] };
  const deps = {
    claim: async () => {
      calls.claims++;
      return rows;
    },
    buy: async (slug, id) => {
      calls.buys.push([slug, id]);
      return "ORDER1";
    },
    profiles: async (id) => {
      calls.profiles.push(id);
      return [profile];
    },
    save: async (row, patch) => {
      calls.saves.push(patch);
      Object.assign(row, patch);
    },
  };
  return { rows, calls, deps };
}

test("missing or false global flag fails closed before claim", async () => {
  const f = fixture();
  for (const flag of [undefined, "false", "TRUE"]) {
    if (flag === undefined) delete process.env.B2B_ISSUANCE_ENABLED;
    else process.env.B2B_ISSUANCE_ENABLED = flag;
    assert.equal((await run(f.deps)).disabled, true);
  }
  assert.equal(f.calls.claims, 0);
  assert.equal(f.calls.buys.length, 0);
});

test("stable purchase transaction retries after timeout, pending only queries, ready never rebuys", async () => {
  process.env.B2B_ISSUANCE_ENABLED = "true";
  const f = fixture();
  let attempted = false;
  const buy = f.deps.buy;
  f.deps.buy = async (...args) => {
    const value = await buy(...args);
    if (!attempted) {
      attempted = true;
      throw Error("timeout with private data");
    }
    return value;
  };
  assert.equal((await run(f.deps)).failed, 1);
  assert.equal(f.rows[0].state, "queued");
  assert.equal(f.rows[0].last_error, "provider_unavailable");
  await run(f.deps);
  assert.equal(f.rows[0].state, "provider_pending");
  assert.deepEqual(f.calls.buys, [
    ["PKG_PA_001", "b2b_fixed_unit1"],
    ["PKG_PA_001", "b2b_fixed_unit1"],
  ]);
  await run(f.deps);
  assert.equal(f.rows[0].state, "ready");
  assert.equal(f.rows[0].iccid, profile.iccid);
  assert.equal(f.rows[0].provider_profile_id, profile.transactionId);
  // A real claim excludes terminal rows.
  f.deps.claim = async () => [];
  await run(f.deps);
  assert.equal(f.calls.buys.length, 2);
  assert.deepEqual(f.calls.profiles, ["ORDER1"]);
});

test("empty provider allocation waits and strict mismatches require review", async () => {
  process.env.B2B_ISSUANCE_ENABLED = "true";
  for (const patch of [
    null,
    { orderNo: "OTHER" },
    { packageSlug: "OTHER" },
    { volumeBytes: 1 },
    { days: 1 },
    { iccid: "invalid" },
    { activationCode: null },
    { smdpAddress: "evil/$" },
    { status: "CANCELLED" },
    { transactionId: "!" },
  ]) {
    const f = fixture([
      { ...unit(), state: "provider_pending", provider_order_no: "ORDER1" },
    ]);
    f.deps.profiles = async () =>
      patch === null ? [] : [{ ...profile, ...patch }];
    await run(f.deps);
    assert.equal(
      f.rows[0].state,
      patch === null ? "provider_pending" : "review",
    );
    assert.equal(f.calls.buys.length, 0);
    assert.equal(f.rows[0].iccid, undefined);
  }
  const f = fixture([
    { ...unit(), state: "provider_pending", provider_order_no: "ORDER1" },
  ]);
  f.deps.profiles = async () => [profile, profile];
  await run(f.deps);
  assert.equal(f.rows[0].state, "review");
});

test("one unit failure does not stop siblings; lost lease cannot publish credentials", async () => {
  process.env.B2B_ISSUANCE_ENABLED = "true";
  const f = fixture([
    unit(),
    { ...unit(), id: "unit2", provider_transaction_id: "b2b_unit2" },
  ]);
  const buy = f.deps.buy;
  f.deps.buy = async (...args) => {
    if (args[1] === "b2b_fixed_unit1") throw Error("timeout");
    return buy(...args);
  };
  assert.deepEqual(await run(f.deps), { processed: 2, failed: 1 });
  assert.equal(f.rows[1].state, "provider_pending");
  const stale = fixture([
    { ...unit(), state: "provider_pending", provider_order_no: "ORDER1" },
  ]);
  stale.deps.save = async () => {
    throw Error("lease lost");
  };
  assert.equal((await run(stale.deps)).failed, 1);
  assert.equal(stale.rows[0].iccid, undefined);
});

test("production adapter uses only service RPCs and no retail delivery or email", () => {
  assert.match(source, /rpc\("claim_b2b_units"/);
  assert.match(source, /rpc\("update_b2b_unit"/);
  assert.doesNotMatch(
    source,
    /sendDelivery|sendDeliveryEmail|resend|esim_fulfillments|checkout_order_items|fetch\(/,
  );
});

test("allocation polling eventually requires review without another purchase", async () => {
  process.env.B2B_ISSUANCE_ENABLED = "true";
  const f = fixture([
    {
      ...unit(),
      attempts: 24,
      state: "provider_pending",
      provider_order_no: "ORDER1",
    },
  ]);
  f.deps.profiles = async () => [];
  assert.equal((await run(f.deps)).failed, 1);
  assert.equal(f.rows[0].state, "review");
  assert.equal(f.rows[0].last_error, "allocation_timeout");
  assert.equal(f.calls.buys.length, 0);
});
