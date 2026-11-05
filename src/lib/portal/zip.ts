export type ZipEntry = { name: string; data: Uint8Array };
const MAX_BYTES = 64 * 1024 * 1024;

function crc32(data: Uint8Array): number {
  let value = 0xffffffff;
  for (const byte of data) {
    value ^= byte;
    for (let bit = 0; bit < 8; bit++)
      value = (value >>> 1) ^ (value & 1 ? 0xedb88320 : 0);
  }
  return (value ^ 0xffffffff) >>> 0;
}

/** Deterministic stored ZIP for precompressed image assets; cap includes archive metadata. */
export function createStoredZip(entries: ZipEntry[]): Uint8Array {
  if (!Array.isArray(entries) || entries.length > 1000)
    throw new RangeError("ZIP entry limit exceeded");
  const encoder = new TextEncoder();
  const names = new Set<string>();
  let size = 22;
  const prepared = entries.map((entry) => {
    const name = entry.name;
    if (
      typeof name !== "string" ||
      !name ||
      /[\/\\\u0000-\u001f\u007f-\u009f]/u.test(name) ||
      name.includes("..") ||
      name === "." ||
      name.trim() !== name ||
      /[:<>"|?*]/u.test(name) ||
      name.endsWith(".")
    )
      throw new Error("Unsafe ZIP filename");
    // Reject malformed UTF16 instead of silently substituting a different name.
    const bytes = encoder.encode(name);
    if (
      new TextDecoder().decode(bytes) !== name ||
      bytes.length > 65535 ||
      names.has(name.normalize("NFC").toLowerCase())
    )
      throw new Error("Invalid or duplicate ZIP filename");
    names.add(name.normalize("NFC").toLowerCase());
    if (!(entry.data instanceof Uint8Array))
      throw new TypeError("ZIP data must be Uint8Array");
    size += 30 + bytes.length + entry.data.length + 46 + bytes.length;
    if (size > MAX_BYTES) throw new RangeError("ZIP size limit exceeded");
    return { bytes, data: entry.data, crc: crc32(entry.data), offset: 0 };
  });
  const output = new Uint8Array(size);
  const view = new DataView(output.buffer);
  let cursor = 0;
  const u16 = (offset: number, value: number) =>
    view.setUint16(offset, value, true);
  const u32 = (offset: number, value: number) =>
    view.setUint32(offset, value, true);
  for (const entry of prepared) {
    entry.offset = cursor;
    u32(cursor, 0x04034b50);
    u16(cursor + 4, 20);
    u16(cursor + 6, 0x800);
    u16(cursor + 12, 33); // DOS date: 1980-01-01; time and method remain zero.
    u32(cursor + 14, entry.crc);
    u32(cursor + 18, entry.data.length);
    u32(cursor + 22, entry.data.length);
    u16(cursor + 26, entry.bytes.length);
    output.set(entry.bytes, cursor + 30);
    output.set(entry.data, cursor + 30 + entry.bytes.length);
    cursor += 30 + entry.bytes.length + entry.data.length;
  }
  const directoryOffset = cursor;
  for (const entry of prepared) {
    u32(cursor, 0x02014b50);
    u16(cursor + 4, 20);
    u16(cursor + 6, 20);
    u16(cursor + 8, 0x800);
    u16(cursor + 14, 33);
    u32(cursor + 16, entry.crc);
    u32(cursor + 20, entry.data.length);
    u32(cursor + 24, entry.data.length);
    u16(cursor + 28, entry.bytes.length);
    u32(cursor + 42, entry.offset);
    output.set(entry.bytes, cursor + 46);
    cursor += 46 + entry.bytes.length;
  }
  u32(cursor, 0x06054b50);
  u16(cursor + 8, prepared.length);
  u16(cursor + 10, prepared.length);
  u32(cursor + 12, cursor - directoryOffset);
  u32(cursor + 16, directoryOffset);
  return output;
}
