import { createHmac, randomUUID } from "node:crypto";
import { z } from "zod";

const BASE_URL = "https://api.esimaccess.com/api/v1/open/";
const MAX_RESPONSE_BYTES = 16 * 1024 * 1024;
const credential = z
  .string()
  .trim()
  .min(8)
  .max(4096)
  .regex(/^[^\s\u0000-\u001f\u007f]+$/u);
export type EsimAccessConfig = { accessCode: string; secretKey: string };
export class EsimAccessError extends Error {
  readonly kind: "configuration" | "network" | "http" | "upstream" | "response";
  readonly code?: string;
  constructor(kind: EsimAccessError["kind"], code?: string) {
    super(`eSIM Access ${kind} error${code ? ` (${code})` : ""}`);
    this.name = "EsimAccessError";
    this.kind = kind;
    this.code = code;
  }
}
export function esimAccessConfig(
  env: Record<string, string | undefined>,
): EsimAccessConfig | null {
  if (!env.ESIM_ACCESS_CODE && !env.ESIM_ACCESS_SECRET_KEY) return null;
  const accessCode = credential.safeParse(env.ESIM_ACCESS_CODE);
  const secretKey = credential.safeParse(env.ESIM_ACCESS_SECRET_KEY);
  if (!accessCode.success || !secretKey.success)
    throw new EsimAccessError("configuration");
  return { accessCode: accessCode.data, secretKey: secretKey.data };
}
const identifier = z.string().min(1).max(200);
const bytes = z.coerce
  .number()
  .int()
  .nonnegative()
  .max(Number.MAX_SAFE_INTEGER);
const packageSchema = z.object({
  packageCode: identifier,
  slug: identifier,
  name: z.string().min(1).max(300),
  dataType: z.coerce.number().refine((value) => value === 1),
  volume: bytes.refine((value) => value > 0),
  duration: z.coerce.number().int().min(1).max(3650),
  durationUnit: z.literal("DAY"),
  location: z.string().min(1).max(5000),
  speed: z.string().max(200).nullish(),
  activeType: z.coerce.number().int().nullish(),
});
export type ProviderPackage = {
  packageCode: string;
  slug: string;
  name: string;
  volumeBytes: number;
  days: number;
  coverage: string[];
  network: string;
  activation: "installation" | "network" | null;
};
export function projectFixedPackages(value: unknown): ProviderPackage[] {
  try {
    const entries = z.array(z.unknown()).max(20000).parse(value);
    const packages = entries
      .filter(
        (entry) =>
          typeof entry === "object" &&
          entry !== null &&
          "dataType" in entry &&
          (entry.dataType === 1 || entry.dataType === "1"),
      )
      .map((entry) => {
        const p = packageSchema.parse(entry);
        return {
          packageCode: p.packageCode,
          slug: p.slug,
          name: p.name,
          volumeBytes: p.volume,
          days: p.duration,
          coverage: [
            ...new Set(
              p.location
                .split(",")
                .map((code) => code.trim())
                .filter(Boolean),
            ),
          ],
          network: p.speed ?? "",
          activation:
            p.activeType === 1
              ? ("installation" as const)
              : p.activeType === 2
                ? ("network" as const)
                : null,
        };
      });
    if (
      !packages.length ||
      new Set(packages.map((p) => p.slug)).size !== packages.length ||
      new Set(packages.map((p) => p.packageCode)).size !== packages.length
    )
      throw new Error("Invalid catalog identity");
    return packages;
  } catch {
    throw new EsimAccessError("response");
  }
}
const envelopeSchema = z.object({
  success: z.union([z.boolean(), z.literal("true"), z.literal("false")]),
  errorCode: z.union([z.string(), z.number()]).nullish(),
  obj: z.unknown(),
});
async function jsonResponse(response: Response) {
  if (
    !response.body ||
    Number(response.headers.get("content-length")) > MAX_RESPONSE_BYTES
  )
    throw new EsimAccessError("response");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_RESPONSE_BYTES) {
        await reader.cancel();
        throw new EsimAccessError("response");
      }
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  } catch {
    throw new EsimAccessError("response");
  } finally {
    reader.releaseLock();
  }
}
export function createEsimAccessAPI(
  config: EsimAccessConfig,
  transport: typeof fetch = fetch,
) {
  async function request(
    path: "package/list" | "esim/query" | "esim/usage/query" | "esim/order" | "balance/query",
    payload: unknown,
  ) {
    const body = JSON.stringify(payload);
    const timestamp = String(Date.now());
    const requestId = randomUUID();
    const signature = createHmac("sha256", config.secretKey)
      .update(timestamp + requestId + config.accessCode + body)
      .digest("hex");
    let response: Response;
    try {
      response = await transport(BASE_URL + path, {
        method: "POST",
        redirect: "error",
        signal: AbortSignal.timeout(20000),
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          "RT-AccessCode": config.accessCode,
          "RT-RequestID": requestId,
          "RT-Timestamp": timestamp,
          "RT-Signature": signature,
        },
        body,
      });
    } catch {
      throw new EsimAccessError("network");
    }
    if (!response.ok)
      throw new EsimAccessError("http", String(response.status));
    const parsed = envelopeSchema.safeParse(await jsonResponse(response));
    if (!parsed.success) throw new EsimAccessError("response");
    const envelope = parsed.data;
    if (
      (envelope.success !== true && envelope.success !== "true") ||
      (envelope.errorCode != null && String(envelope.errorCode) !== "0")
    ) {
      const code = String(envelope.errorCode ?? "");
      throw new EsimAccessError(
        "upstream",
        /^\d{1,12}$/.test(code) ? code : undefined,
      );
    }
    return envelope.obj;
  }
  return {
    async balance() {
      const value = z
        .object({
          balance: z.coerce
            .number()
            .int()
            .min(-Number.MAX_SAFE_INTEGER)
            .max(Number.MAX_SAFE_INTEGER),
          currencyCode: z.literal("USD").optional(),
        })
        .parse(await request("balance/query", {}));
      // Provider contract: 10,000 integer units = USD 1, not cents.
      return { balanceUnits: value.balance, currency: "USD" as const };
    },
    async countryFixedPackages(locationCode: string) {
      if (!/^[A-Z]{2}$/.test(locationCode))
        throw new EsimAccessError("configuration");
      const object = await request("package/list", {
        type: "BASE",
        dataType: "1",
        locationCode,
      });
      if (typeof object !== "object" || !object || !("packageList" in object))
        throw new EsimAccessError("response");
      return projectFixedPackages(object.packageList);
    },
    async purchaseProfile(slug: string, transactionId: string) {
      if (
        !/^[A-Za-z0-9_.-]{1,200}$/.test(slug) ||
        !/^[A-Za-z0-9_-]{1,50}$/.test(transactionId)
      )
        throw new EsimAccessError("configuration");
      const result = z
        .object({
          orderNo: z.string().regex(/^[A-Za-z0-9_-]{1,100}$/),
          transactionId: z.string().optional(),
        })
        .safeParse(
          await request("esim/order", {
            transactionId,
            packageInfoList: [{ packageCode: slug, count: 1 }],
          }),
        );
      if (
        !result.success ||
        (result.data.transactionId &&
          result.data.transactionId !== transactionId)
      )
        throw new EsimAccessError("response");
      return result.data.orderNo;
    },
    async allocatedProfile(orderNo: string) {
      if (!/^[A-Za-z0-9_-]{1,100}$/.test(orderNo))
        throw new EsimAccessError("configuration");
      const object = await request("esim/query", {
        orderNo,
        pager: { pageNum: 1, pageSize: 5 },
      });
      const pending = z
        .object({
          esimList: z
            .array(z.object({ orderNo: identifier, esimStatus: z.string() }))
            .max(1),
        })
        .safeParse(object);
      if (
        pending.success &&
        pending.data.esimList.every(
          (p) =>
            p.orderNo === orderNo &&
            ["CREATE", "PAYING", "PAID", "GETTING_RESOURCE"].includes(
              p.esimStatus,
            ),
        )
      )
        return [];
      const result = z
        .object({
          esimList: z
            .array(
              z.object({
                esimTranNo: identifier,
                orderNo: identifier,
                iccid: z.string().regex(/^\d{15,25}$/),
                ac: z.string().max(2000).nullish(),
                esimStatus: z.string(),
                smdpStatus: z.string(),
                totalVolume: bytes,
                orderUsage: bytes.nullish(),
                expiredTime: z.string().max(60).nullish(),
                apn: z.string().max(200).nullish(),
                packageList: z
                  .array(
                    z.object({
                      slug: identifier,
                      duration: z.coerce.number().int().positive(),
                      volume: bytes,
                    }),
                  )
                  .length(1),
              }),
            )
            .max(1),
        })
        .safeParse(object);
      if (!result.success) throw new EsimAccessError("response");
      return result.data.esimList.map((p) => {
        const installation = p.ac
          ? /^LPA:1\$([A-Za-z0-9.-]+)\$([A-Za-z0-9_-]+)$/.exec(p.ac)
          : null;
        if (
          p.orderNo !== orderNo ||
          !installation ||
          p.totalVolume !== p.packageList[0].volume
        )
          throw new EsimAccessError("response");
        return {
          transactionId: p.esimTranNo,
          orderNo: p.orderNo,
          iccid: p.iccid,
          smdpAddress: installation[1],
          activationCode: installation[2],
          status: p.esimStatus,
          smdpStatus: p.smdpStatus,
          volumeBytes: p.totalVolume,
          usedBytes: p.orderUsage ?? null,
          expiresAt: p.expiredTime ?? null,
          packageSlug: p.packageList[0].slug,
          days: p.packageList[0].duration,
          apn: p.apn ?? null,
        };
      });
    },
    async listFixedPackages() {
      const object = await request("package/list", {
        type: "BASE",
        dataType: "1",
      });
      if (typeof object !== "object" || !object || !("packageList" in object))
        throw new EsimAccessError("response");
      return projectFixedPackages(object.packageList);
    },
    async orderProfiles(orderNo: string) {
      if (!/^[A-Za-z0-9_-]{1,100}$/.test(orderNo))
        throw new EsimAccessError("configuration");
      const object = await request("esim/query", {
        orderNo,
        pager: { pageNum: 1, pageSize: 100 },
      });
      const result = z
        .object({
          esimList: z
            .array(
              z.object({
                esimTranNo: identifier,
                orderNo: identifier,
                iccid: z.string().regex(/^\d{15,25}$/),
                ac: z.string().max(2000).nullish(),
                esimStatus: z.string().max(100),
                smdpStatus: z.string().max(100),
                totalVolume: bytes,
                orderUsage: bytes.nullish(),
                expiredTime: z.string().max(60).nullish(),
              }),
            )
            .max(100),
        })
        .safeParse(object);
      if (
        !result.success ||
        result.data.esimList.some((p) => p.orderNo !== orderNo)
      )
        throw new EsimAccessError("response");
      return result.data.esimList.map((profile) => {
        const installation = profile.ac
          ? /^LPA:1\$([A-Za-z0-9.-]+)\$([A-Za-z0-9_-]+)$/.exec(profile.ac)
          : null;
        if (profile.ac && !installation) throw new EsimAccessError("response");
        return {
          transactionId: profile.esimTranNo,
          orderNo: profile.orderNo,
          iccid: profile.iccid,
          smdpAddress: installation?.[1] ?? null,
          activationCode: installation?.[2] ?? null,
          status: profile.esimStatus,
          smdpStatus: profile.smdpStatus,
          volumeBytes: profile.totalVolume,
          usedBytes: profile.orderUsage ?? null,
          expiresAt: profile.expiredTime ?? null,
        };
      });
    },
    async usage(transactionIds: string[]) {
      if (
        !transactionIds.length ||
        transactionIds.length > 10 ||
        transactionIds.some((id) => !/^[A-Za-z0-9_-]{1,100}$/.test(id))
      )
        throw new EsimAccessError("configuration");
      const object = await request("esim/usage/query", {
        esimTranNoList: transactionIds,
      });
      const result = z
        .object({
          esimUsageList: z
            .array(
              z.object({
                esimTranNo: identifier,
                dataUsage: bytes,
                totalData: bytes,
                lastUpdateTime: z.string().max(60),
              }),
            )
            .max(10),
        })
        .safeParse(object);
      if (
        !result.success ||
        result.data.esimUsageList.some(
          (item) => !transactionIds.includes(item.esimTranNo),
        )
      )
        throw new EsimAccessError("response");
      return result.data.esimUsageList.map((item) => ({
        transactionId: item.esimTranNo,
        usedBytes: item.dataUsage,
        totalBytes: item.totalData,
        updatedAt: item.lastUpdateTime,
      }));
    },
  };
}
