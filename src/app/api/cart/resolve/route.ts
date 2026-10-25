import { cartSchema } from "@/lib/cart";
import { resolveCart } from "@/lib/cart-server";

export async function POST(request: Request) {
  const headers = { "Cache-Control": "private, no-store" };
  if (Number(request.headers.get("content-length")) > 32768)
    return Response.json({ error: "invalid_cart" }, { status: 413, headers });
  try {
    const text = await request.text();
    if (text.length > 32768)
      return Response.json({ error: "invalid_cart" }, { status: 413, headers });
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      return Response.json({ error: "invalid_cart" }, { status: 400, headers });
    }
    const parsed = cartSchema.safeParse(body);
    if (!parsed.success)
      return Response.json({ error: "invalid_cart" }, { status: 400, headers });
    return Response.json(await resolveCart(parsed.data), { headers });
  } catch {
    return Response.json(
      { error: "cart_unavailable" },
      { status: 503, headers },
    );
  }
}
