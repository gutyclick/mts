import { createHmac, timingSafeEqual } from "node:crypto";

// Backend-only adapter. Never expose configuration or trust browser success events.
export type YappyConfig = {
  live: boolean;
  merchantId: string;
  secret: string;
  domain: string;
  origin: string;
  aliasYappy?: string;
};

const endpoints = {
  live: "https://apipagosbg.bgeneral.cloud",
  test: "https://api-comecom-uat.yappycloud.com",
};
const orderPattern = /^[a-zA-Z0-9]{1,15}$/;
const safeString = (v: unknown, max = 4096): v is string =>
  typeof v === "string" &&
  v.length > 0 &&
  v.length <= max &&
  !/[\u0000-\u001f\u007f]/.test(v);

function secretKey(secret: unknown): string | null {
  if (
    typeof secret !== "string" ||
    secret.length > 8192 ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
      secret,
    ) ||
    !secret
  )
    return null;
  const bytes = Buffer.from(secret, "base64");
  if (bytes.toString("base64") !== secret) return null;
  const decoded = bytes.toString("utf8");
  if (!Buffer.from(decoded).equals(bytes)) return null;
  const key = decoded.split(".")[0];
  return safeString(key) ? key : null;
}

function httpsUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.hash
      ? url
      : null;
  } catch {
    return null;
  }
}

export function yappyConfig(
  env: Record<string, string | undefined>,
  live: boolean,
): YappyConfig | null {
  const prefix = live ? "YAPPY_LIVE_" : "YAPPY_TEST_";
  const merchantId = env[`${prefix}MERCHANT_ID`];
  const secret = env[`${prefix}SECRET`];
  const domain = env.YAPPY_DOMAIN ?? "https://portal.mytripsim.com";
  const url = httpsUrl(domain);
  const aliasYappy = env[`${prefix}ALIAS_YAPPY`];
  if (
    !safeString(merchantId, 256) ||
    !secretKey(secret) ||
    !url ||
    url.pathname !== "/" ||
    url.search ||
    (aliasYappy !== undefined && !/^\d{8}$/.test(aliasYappy))
  )
    return null;
  return {
    live,
    merchantId,
    secret: secret!,
    domain,
    origin: url.origin,
    ...(aliasYappy ? { aliasYappy } : {}),
  };
}

export function yappyScriptUrl(live: boolean): string {
  return live
    ? "https://bt-cdn.yappy.cloud/v1/cdn/web-component-btn-yappy.js"
    : "https://bt-cdn-uat.yappycloud.com/v1/cdn/web-component-btn-yappy.js";
}

async function post(
  live: boolean,
  path: string,
  body: unknown,
  fetchImpl: typeof fetch,
  token?: string,
): Promise<Record<string, unknown>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetchImpl(
      `${live ? endpoints.live : endpoints.test}${path}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: token } : {}),
        },
        body: JSON.stringify(body),
        cache: "no-store",
        redirect: "error",
        signal: controller.signal,
      },
    );
    if (!response.ok || !response.body) throw new Error();
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        size += part.value.byteLength;
        if (size > 32_768) {
          await reader.cancel();
          throw new Error();
        }
        chunks.push(part.value);
      }
    } finally {
      reader.releaseLock();
    }
    const json = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (
      !json ||
      typeof json.body !== "object" ||
      !json.body ||
      Array.isArray(json.body)
    )
      throw new Error();
    return json.body;
  } catch {
    throw new Error("Yappy service request failed");
  } finally {
    clearTimeout(timeout);
  }
}

export async function createYappyOrder(
  config: YappyConfig,
  input: {
    orderId: string;
    totalCents: number;
    taxCents: number;
    ipnUrl: string;
  },
  fetchImpl: typeof fetch = fetch,
): Promise<{ transactionId: string; token: string; documentName: string }> {
  const validated = yappyConfig(
    {
      [`YAPPY_${config.live ? "LIVE" : "TEST"}_MERCHANT_ID`]: config.merchantId,
      [`YAPPY_${config.live ? "LIVE" : "TEST"}_SECRET`]: config.secret,
      YAPPY_DOMAIN: config.domain,
    },
    config.live,
  );
  const ipn = httpsUrl(input.ipnUrl);
  if (
    !validated ||
    typeof input.orderId !== "string" ||
    !orderPattern.test(input.orderId) ||
    !Number.isSafeInteger(input.totalCents) ||
    input.totalCents < 1 ||
    !Number.isSafeInteger(input.taxCents) ||
    input.taxCents < 0 ||
    input.taxCents > input.totalCents ||
    !ipn ||
    ipn.origin !== validated.origin ||
    (config.aliasYappy !== undefined && !/^\d{8}$/.test(config.aliasYappy))
  )
    throw new Error("Invalid Yappy order configuration");
  const money = (cents: number) =>
    `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
  const auth = await post(
    config.live,
    "/payments/validate/merchant",
    { merchantId: config.merchantId, urlDomain: config.domain },
    fetchImpl,
  );
  if (
    !safeString(auth.token) ||
    !Number.isSafeInteger(auth.epochTime) ||
    (auth.epochTime as number) <= 0
  )
    throw new Error("Invalid Yappy authorization response");
  const result = await post(
    config.live,
    "/payments/payment-wc",
    {
      merchantId: config.merchantId,
      orderId: input.orderId,
      domain: config.domain,
      paymentDate: auth.epochTime,
      ipnUrl: input.ipnUrl,
      discount: "0.00",
      taxes: money(input.taxCents),
      subtotal: money(input.totalCents - input.taxCents),
      total: money(input.totalCents),
      ...(config.aliasYappy ? { aliasYappy: config.aliasYappy } : {}),
    },
    fetchImpl,
    auth.token,
  );
  if (
    !safeString(result.transactionId, 256) ||
    !safeString(result.token) ||
    !safeString(result.documentName, 1024)
  )
    throw new Error("Invalid Yappy order response");
  return {
    transactionId: result.transactionId,
    token: result.token,
    documentName: result.documentName,
  };
}

export function verifyYappyIpn(
  config: YappyConfig,
  input: { orderId: unknown; status: unknown; hash: unknown; domain: unknown },
): boolean {
  const key = secretKey(config.secret);
  if (
    !key ||
    typeof input.orderId !== "string" ||
    !orderPattern.test(input.orderId) ||
    typeof input.status !== "string" ||
    !/^[ERCX]$/.test(input.status) ||
    input.domain !== config.domain ||
    typeof input.hash !== "string" ||
    !/^[a-fA-F0-9]{64}$/.test(input.hash)
  )
    return false;
  const expected = createHmac("sha256", key)
    .update(input.orderId + input.status + input.domain)
    .digest();
  return timingSafeEqual(expected, Buffer.from(input.hash, "hex"));
}
