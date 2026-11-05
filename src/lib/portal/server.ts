import "server-only";
import { cookies } from "next/headers";
import { z } from "zod";
import { authClient } from "@/lib/supabase/auth-server";
import {
  workspaceSchema,
  businessOrigin,
  type BusinessSupport,
} from "./business";

export async function businessIdentity() {
  const client = await authClient();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error?.status && error.status >= 500) throw Error("unavailable");
  if (!user?.email_confirmed_at || !user.email)
    return { client, user: null, needsMfa: false };
  const verifiedFactor = user.factors?.some(
    (factor) => factor.status === "verified",
  );
  if (verifiedFactor) {
    const { data, error: assuranceError } =
      await client.auth.mfa.getAuthenticatorAssuranceLevel();
    if (assuranceError) throw Error("unavailable");
    return { client, user, needsMfa: data.currentLevel !== "aal2" };
  }
  return { client, user, needsMfa: false };
}
export async function businessWorkspace(
  client: Awaited<ReturnType<typeof authClient>>,
) {
  const value = (await cookies()).get("mts_business_company")?.value;
  const company = z.uuid().safeParse(value);
  let result = await client.rpc("b2b_workspace", {
    p_company: company.success ? company.data : null,
  });
  if (result.error?.message === "company_required" && company.success)
    result = await client.rpc("b2b_workspace", { p_company: null });
  if (result.error) throw Error("unavailable");
  return workspaceSchema.parse(result.data);
}
export function businessSupport(): BusinessSupport {
  const email = z.email().safeParse(process.env.B2B_SUPPORT_EMAIL);
  const phone = z
    .string()
    .regex(/^\+[1-9][0-9]{7,14}$/)
    .safeParse(process.env.B2B_SUPPORT_WHATSAPP);
  return email.success && phone.success
    ? { email: email.data, whatsapp: phone.data }
    : null;
}
export async function businessBody(request: Request) {
  if (
    !businessOrigin(
      request.headers.get("origin"),
      request.headers.get("host"),
      process.env.NODE_ENV === "production",
    )
  )
    throw Error("forbidden");
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    throw Error("invalid");
  if (Number(request.headers.get("content-length")) > 8192)
    throw Error("invalid");
  const reader = request.body?.getReader();
  if (!reader) throw Error("invalid");
  let length = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 8192) {
        await reader.cancel();
        throw Error("invalid");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const body = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder().decode(body));
  } catch {
    throw Error("invalid");
  }
}
export const businessHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow",
};
