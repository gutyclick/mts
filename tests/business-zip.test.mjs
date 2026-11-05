import test from "node:test";
import assert from "node:assert/strict";
import { createStoredZip } from "../src/lib/portal/zip.ts";

function crc(bytes) {
  let n = 0xffffffff;
  for (const b of bytes) {
    n ^= b;
    for (let j = 0; j < 8; j++) n = (n >>> 1) ^ (n & 1 ? 0xedb88320 : 0);
  }
  return (n ^ 0xffffffff) >>> 0;
}
test("ZIP central directory points at stored UTF8 names and exact bytes with valid CRC", () => {
  const entries = [
    { name: "abc.png", data: Uint8Array.of(137, 80, 78, 71, 0, 255) },
    { name: "café.svg", data: new TextEncoder().encode("<svg/>") },
  ];
  const zip = createStoredZip(entries),
    v = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  const end = zip.length - 22;
  assert.equal(v.getUint32(end, true), 0x06054b50);
  assert.equal(v.getUint16(end + 10, true), 2);
  let cursor = v.getUint32(end + 16, true),
    start = cursor;
  for (const entry of entries) {
    assert.equal(v.getUint32(cursor, true), 0x02014b50);
    const n = v.getUint16(cursor + 28, true),
      local = v.getUint32(cursor + 42, true);
    assert.equal(
      new TextDecoder().decode(zip.subarray(cursor + 46, cursor + 46 + n)),
      entry.name,
    );
    assert.equal(v.getUint16(cursor + 10, true), 0);
    assert.equal(v.getUint16(cursor + 8, true), 0x800);
    assert.equal(v.getUint32(local, true), 0x04034b50);
    assert.equal(v.getUint32(local + 14, true), crc(entry.data));
    assert.equal(v.getUint32(cursor + 16, true), crc(entry.data));
    assert.equal(v.getUint32(cursor + 24, true), entry.data.length);
    const body = local + 30 + v.getUint16(local + 26, true);
    assert.deepEqual(zip.subarray(body, body + entry.data.length), entry.data);
    cursor += 46 + n;
  }
  assert.equal(cursor, end);
  assert.equal(v.getUint32(end + 12, true), end - start);
});
test("rejects unsafe, duplicate names and oversized archives", () => {
  for (const name of [
    "",
    "../x.png",
    "a/b.png",
    "a\\b.svg",
    "a..png",
    "a\u0000.png",
    "a\u007f.png",
  ])
    assert.throws(() => createStoredZip([{ name, data: new Uint8Array() }]));
  assert.throws(() =>
    createStoredZip([
      { name: "a.png", data: new Uint8Array() },
      { name: "a.png", data: new Uint8Array() },
    ]),
  );
  assert.throws(() =>
    createStoredZip(
      Array.from({ length: 1001 }, (_, i) => ({
        name: `${i}.png`,
        data: new Uint8Array(),
      })),
    ),
  );
  assert.throws(() =>
    createStoredZip([
      { name: "big.png", data: new Uint8Array(64 * 1024 * 1024) },
    ]),
  );
  assert.equal(createStoredZip([]).length, 22);
});
