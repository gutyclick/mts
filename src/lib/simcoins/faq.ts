import type { FAQCategory } from "../help-content.ts";
const questions = {
  es: [
    {
      id: "simcoins-what-are",
      question: "¿Qué son SimCoins?",
      answer:
        "Son créditos promocionales internos de MyTripSim. No son una criptomoneda ni dinero retirable: 100 SimCoins equivalen a USD 1 de descuento en futuras compras elegibles.",
      related: ["simcoins-levels", "simcoins-redeeming"],
      links: [
        {
          label: "Conoce el programa SimCoins",
          href: "/es/simcoins",
        },
      ],
    },
    {
      id: "simcoins-availability",
      question: "¿Ya puedo ganar SimCoins?",
      answer:
        "La página de SimCoins muestra si la acumulación y el canje están activos. Solo las compras elegibles realizadas con tu cuenta, con el programa habilitado, pueden generar progreso y recompensas. No se aplican a pedidos anteriores al programa.",
      related: ["simcoins-levels", "simcoins-redeeming"],
      links: [
        {
          label: "Conoce el programa SimCoins",
          href: "/es/simcoins",
        },
      ],
    },
    {
      id: "simcoins-earning",
      question: "¿Cómo se calculan?",
      answer:
        "Se calculan sobre el importe elegible realmente pagado, sin impuestos, descuentos ni saldo canjeado. Se usa tu nivel anterior a la compra y se redondea hacia abajo a monedas enteras. Tu primera compra elegible empieza en Viajero, con 0%, y desbloquea Explorer o un nivel superior para las siguientes.",
      related: ["simcoins-levels", "simcoins-redeeming"],
      links: [
        {
          label: "Conoce el programa SimCoins",
          href: "/es/simcoins",
        },
      ],
    },
    {
      id: "simcoins-pending",
      question: "¿Cuándo estarán disponibles?",
      answer:
        "Después de la entrega verificada y del período de espera del programa. Tu cuenta mostrará la fecha prevista cuando corresponda.",
      related: ["simcoins-levels", "simcoins-redeeming"],
      links: [
        {
          label: "Conoce el programa SimCoins",
          href: "/es/simcoins",
        },
      ],
    },
    {
      id: "simcoins-refunds",
      question: "¿Qué ocurre con un reembolso?",
      answer:
        "Se ajustan las monedas ganadas y el gasto elegible de la compra original. Las monedas canjeadas se restituyen proporcionalmente como crédito promocional.",
      related: ["simcoins-levels", "simcoins-redeeming"],
      links: [
        {
          label: "Conoce el programa SimCoins",
          href: "/es/simcoins",
        },
      ],
    },
    {
      id: "simcoins-levels",
      question: "¿Qué pasa al subir de nivel?",
      answer:
        "Después de tu primera compra elegible se desbloquea Explorer (3%). El gasto elegible acumulado permite alcanzar Adventurer (USD 60, 4%), Globetrotter (USD 125, 5%) y Legend (USD 300, 6%). Una compra que cambia tu nivel conserva su porcentaje inicial; el nuevo nivel se aplica después. Los reembolsos descuentan el progreso correspondiente.",
      related: ["simcoins-redeeming"],
      links: [
        {
          label: "Conoce el programa SimCoins",
          href: "/es/simcoins",
        },
      ],
    },
    {
      id: "simcoins-redeeming",
      question: "¿Cómo uso mis monedas?",
      answer:
        "Cuando el canje esté habilitado, inicia sesión y activa SimCoins en una compra elegible. Puedes aplicar hasta el 5% del importe elegible, sin superar tu saldo disponible. Las monedas reservadas para otra compra no se pueden usar a la vez. El checkout muestra el descuento validado antes de pagar.",
      related: ["simcoins-levels"],
      links: [
        {
          label: "Conoce el programa SimCoins",
          href: "/es/simcoins",
        },
      ],
    },
    {
      id: "simcoins-expiry",
      question: "¿Tienen vencimiento?",
      answer:
        "Las monedas ordinarias no vencen durante la etapa inicial del programa. Los niveles tampoco tienen vencimiento inicial.",
      related: ["simcoins-levels", "simcoins-redeeming"],
      links: [
        {
          label: "Conoce el programa SimCoins",
          href: "/es/simcoins",
        },
      ],
    },
    {
      id: "simcoins-promotions",
      question: "¿Puedo combinarlas con cupones?",
      answer:
        "El canje no se combina automáticamente con cupones de afiliados u otras promociones. Las restricciones aplicables se indican antes de pagar.",
      related: ["simcoins-levels", "simcoins-redeeming"],
      links: [
        {
          label: "Conoce el programa SimCoins",
          href: "/es/simcoins",
        },
      ],
    },
    {
      id: "simcoins-transfer",
      question: "¿Puedo transferirlas o cambiarlas por dinero?",
      answer:
        "No. Las monedas pertenecen a tu cuenta, no se transfieren y solo pueden utilizarse como crédito promocional en MyTripSim.",
      related: ["simcoins-levels", "simcoins-redeeming"],
      links: [
        {
          label: "Conoce el programa SimCoins",
          href: "/es/simcoins",
        },
      ],
    },
  ],
  en: [
    {
      id: "simcoins-what-are",
      question: "What are SimCoins?",
      answer:
        "They are internal MyTripSim promotional credits. They are not cryptocurrency or withdrawable cash: 100 SimCoins equal USD 1 off future eligible purchases.",
      related: ["simcoins-levels", "simcoins-redeeming"],
      links: [
        {
          label: "Explore the SimCoins program",
          href: "/en/simcoins",
        },
      ],
    },
    {
      id: "simcoins-availability",
      question: "Can I earn SimCoins now?",
      answer:
        "The SimCoins page shows whether earning and redemption are active. Only eligible purchases made with your account while the program is enabled can earn progress and rewards. Orders placed before the program are not enrolled retroactively.",
      related: ["simcoins-levels", "simcoins-redeeming"],
      links: [
        {
          label: "Explore the SimCoins program",
          href: "/en/simcoins",
        },
      ],
    },
    {
      id: "simcoins-earning",
      question: "How are coins calculated?",
      answer:
        "Coins are calculated on the eligible amount actually paid, excluding taxes, discounts and redeemed credit. Your level before the purchase applies, and coins round down to whole units. Your first eligible purchase starts as Traveler at 0% and unlocks Explorer or a higher level for later purchases.",
      related: ["simcoins-levels", "simcoins-redeeming"],
      links: [
        {
          label: "Explore the SimCoins program",
          href: "/en/simcoins",
        },
      ],
    },
    {
      id: "simcoins-pending",
      question: "When do they become available?",
      answer:
        "After verified delivery and the program waiting period. Your account will show the expected date where applicable.",
      related: ["simcoins-levels", "simcoins-redeeming"],
      links: [
        {
          label: "Explore the SimCoins program",
          href: "/en/simcoins",
        },
      ],
    },
    {
      id: "simcoins-refunds",
      question: "What happens after a refund?",
      answer:
        "Earned coins and eligible spending are adjusted using the original purchase. Redeemed coins are restored proportionally as promotional credit.",
      related: ["simcoins-levels", "simcoins-redeeming"],
      links: [
        {
          label: "Explore the SimCoins program",
          href: "/en/simcoins",
        },
      ],
    },
    {
      id: "simcoins-levels",
      question: "What happens when I reach a new level?",
      answer:
        "Your first eligible purchase unlocks Explorer (3%). Cumulative eligible spending unlocks Adventurer (USD 60, 4%), Globetrotter (USD 125, 5%) and Legend (USD 300, 6%). A purchase that changes your level retains its starting rate; the new rate applies later. Refunds reverse the corresponding progress.",
      related: ["simcoins-redeeming"],
      links: [
        {
          label: "Explore the SimCoins program",
          href: "/en/simcoins",
        },
      ],
    },
    {
      id: "simcoins-redeeming",
      question: "How do I use my coins?",
      answer:
        "When redemption is enabled, sign in and select SimCoins on an eligible purchase. You can apply up to 5% of the eligible amount, within your available balance. Coins reserved for another purchase cannot be spent simultaneously. Checkout shows the validated discount before payment.",
      related: ["simcoins-levels"],
      links: [
        {
          label: "Explore the SimCoins program",
          href: "/en/simcoins",
        },
      ],
    },
    {
      id: "simcoins-expiry",
      question: "Do they expire?",
      answer:
        "Ordinary coins do not expire during the initial program. Levels also have no initial expiration.",
      related: ["simcoins-levels", "simcoins-redeeming"],
      links: [
        {
          label: "Explore the SimCoins program",
          href: "/en/simcoins",
        },
      ],
    },
    {
      id: "simcoins-promotions",
      question: "Can I combine them with coupons?",
      answer:
        "Redemption does not automatically combine with affiliate coupons or other promotions. Applicable restrictions are shown before payment.",
      related: ["simcoins-levels", "simcoins-redeeming"],
      links: [
        {
          label: "Explore the SimCoins program",
          href: "/en/simcoins",
        },
      ],
    },
    {
      id: "simcoins-transfer",
      question: "Can I transfer them or exchange them for cash?",
      answer:
        "No. Coins belong to your account, cannot be transferred and can only be used as MyTripSim promotional credit.",
      related: ["simcoins-levels", "simcoins-redeeming"],
      links: [
        {
          label: "Explore the SimCoins program",
          href: "/en/simcoins",
        },
      ],
    },
  ],
};
export function simcoinsFAQ(locale: "es" | "en"): FAQCategory {
  return {
    id: "simcoins",
    title: "SimCoins",
    description:
      locale === "es"
        ? "Monedas, niveles, saldo y condiciones del programa de recompensas."
        : "Coins, levels, balance and rewards program conditions.",
    questions: questions[locale],
  };
}
