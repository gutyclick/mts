"use client";
import { ShoppingBag } from "lucide-react";
import { useCart } from "./cart-provider";
import type { Locale } from "@/lib/i18n";

export function AddToCart({
  locale,
  destination,
  planId,
}: {
  locale: Locale;
  destination: string;
  planId: string;
}) {
  const cart = useCart();
  return (
    <button
      type="button"
      className="button button-primary"
      onClick={() => cart.add({ destination, planId, quantity: 1 })}
    >
      <ShoppingBag size={18} aria-hidden="true" />
      {locale === "es" ? "Añadir al carrito" : "Add to cart"}
    </button>
  );
}
