"use client";
import {
  forwardRef,
  useImperativeHandle,
  useMemo,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Elements,
  PaymentElement,
  ExpressCheckoutElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import {
  loadStripe,
  type Stripe,
  type StripeExpressCheckoutElementConfirmEvent,
} from "@stripe/stripe-js";
import type { Locale } from "@/lib/i18n";
import type { Currency } from "@/lib/currency";
import {
  expressWalletOptions,
  hasExpressWallet,
} from "@/lib/payments/wallet-options";
export class PaymentDetailsError extends Error {}
export type PaymentFieldsHandle = {
  collect: () => Promise<{
    stripe: Stripe;
    paymentMethod: string;
    fail: () => void;
  }>;
};
type Props = {
  publishableKey: string;
  locale: Locale;
  total: number;
  currency: Currency;
  email: string;
  canPay: boolean;
  onReady: (ready: boolean) => void;
  onSubmit: () => boolean;
};
export const CheckoutPaymentFields = forwardRef<PaymentFieldsHandle, Props>(
  function CheckoutPaymentFields(props, ref) {
    const stripe = useMemo(
      () => loadStripe(props.publishableKey, { locale: props.locale }),
      [props.publishableKey, props.locale],
    );
    return (
      <Elements
        stripe={stripe}
        options={{
          mode: "payment",
          amount: props.total,
          currency: props.currency.toLowerCase(),
          paymentMethodCreation: "manual",
          appearance: {
            theme: "stripe",
            variables: {
              colorPrimary: "#126de8",
              colorText: "#0f172a",
              borderRadius: "12px",
              fontFamily: "Inter, system-ui, sans-serif",
              fontSizeBase: "16px",
            },
          },
        }}
      >
        <Fields {...props} ref={ref} />
      </Elements>
    );
  },
);
const Fields = forwardRef<PaymentFieldsHandle, Props>(
  function Fields(props, ref) {
    const stripe = useStripe(),
      elements = useElements();
    const [wallets, setWallets] = useState(false);
    const express = useRef<StripeExpressCheckoutElementConfirmEvent | null>(
      null,
    );
    const { onReady } = props;
    useEffect(() => {
      onReady(false);
    }, [onReady]);
    useImperativeHandle(ref, () => ({
      collect: async () => {
        if (!stripe || !elements || !props.canPay)
          throw Error(
            props.locale === "es"
              ? "Revisa tus datos y acepta las condiciones antes de pagar."
              : "Review your details and accept the terms before paying.",
          );
        const fail = () => express.current?.paymentFailed({ reason: "fail" });
        const submitted = await elements.submit();
        if (submitted.error) {
          fail();
          throw new PaymentDetailsError(submitted.error.message);
        }
        const result = await stripe.createPaymentMethod({
          elements,
          params: { billing_details: { email: props.email.trim() } },
        });
        if (result.error) {
          fail();
          throw new PaymentDetailsError(result.error.message);
        }
        return { stripe, paymentMethod: result.paymentMethod.id, fail };
      },
    }));
    return (
      <div className="checkout-inline-payment">
        <div
          className="checkout-express"
          data-visible={wallets}
          aria-hidden={!wallets}
          inert={!props.canPay}
        >
          <h3>{props.locale === "es" ? "Pago exprés" : "Express payment"}</h3>
          <ExpressCheckoutElement
            options={expressWalletOptions}
            onReady={(event) =>
              setWallets(hasExpressWallet(event.availablePaymentMethods))
            }
            onLoadError={() => setWallets(false)}
            onCancel={() => {
              express.current = null;
            }}
            onConfirm={(event) => {
              if (!props.canPay) {
                event.paymentFailed({ reason: "fail" });
                return;
              }
              express.current = event;
              if (!props.onSubmit()) {
                event.paymentFailed({ reason: "fail" });
                express.current = null;
              }
            }}
          />
        </div>
        {wallets && !props.canPay && (
          <p className="commerce-muted">
            {props.locale === "es"
              ? "Acepta las condiciones para habilitar el pago exprés."
              : "Accept the terms to enable express payment."}
          </p>
        )}
        <PaymentElement
          options={{
            layout: {
              type: "accordion",
              defaultCollapsed: false,
              radios: "always",
            },
          }}
          onReady={() => props.onReady(true)}
          onLoadError={() => props.onReady(false)}
        />
      </div>
    );
  },
);
