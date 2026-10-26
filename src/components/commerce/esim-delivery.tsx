"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  QrCode,
  Mail,
  ShieldCheck,
  LoaderCircle,
  ArrowRight,
  RefreshCw,
} from "lucide-react";
import { z } from "zod";
import type { Locale } from "@/lib/i18n";
import { experiencePath } from "@/lib/experience-routes";
import { CopyValue } from "@/components/account/copy-value";
const unitSchema = z.object({
  id: z.uuid(),
  state: z.enum([
    "queued",
    "provider_pending",
    "ready",
    "sent",
    "review",
    "test_skipped",
  ]),
  name: z.string(),
  unitIndex: z.number().int(),
  qa: z.boolean().optional(),
  installationReady: z.boolean().optional(),
  qr: z.string().startsWith("data:image/png;base64,").optional(),
  smdpAddress: z.string().optional(),
  activationCode: z.string().optional(),
  apn: z.string().nullable().optional(),
});
type Unit = z.infer<typeof unitSchema>;
export function EsimDelivery({
  locale,
  orderId,
  guest = false,
}: {
  locale: Locale;
  orderId?: string;
  guest?: boolean;
}) {
  const es = locale === "es";
  const [units, setUnits] = useState<Unit[]>([]),
    [error, setError] = useState(false),
    [loading, setLoading] = useState(true),
    [retry, setRetry] = useState(0),
    [opening, setOpening] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>,
      attempts = 0;
    async function load() {
      try {
        let response;
        if (guest) {
          const match = /^#([a-f0-9-]{36})\.([a-f0-9]{64})$/.exec(
            window.location.hash,
          );
          if (!match) throw new Error("Missing link");
          response = await fetch("/api/esims/access", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: match[1], token: match[2] }),
            signal: controller.signal,
          });
        } else
          response = await fetch(`/api/checkout/esims?order=${orderId}`, {
            cache: "no-store",
            signal: controller.signal,
          });
        if (!response.ok) throw new Error("Unavailable");
        const data = z
          .object({ units: z.array(unitSchema) })
          .parse(await response.json());
        if (controller.signal.aborted) return;
        setUnits(data.units);
        setError(false);
        setLoading(false);
        if (
          ++attempts < 120 &&
          data.units.some((u) =>
            ["queued", "provider_pending", "ready"].includes(u.state),
          )
        )
          timer = setTimeout(load, 5000);
      } catch {
        if (!controller.signal.aborted) {
          setError(true);
          setLoading(false);
        }
      }
    }
    void load();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [orderId, guest, retry]);
  async function open(unit: Unit) {
    setOpening(unit.id);
    try {
      const r = await fetch(
        `/api/checkout/esims?order=${orderId}&unit=${unit.id}`,
        { cache: "no-store" },
      );
      if (!r.ok) throw new Error("Unavailable");
      const data = z
        .object({ units: z.array(unitSchema) })
        .parse(await r.json());
      setUnits((current) =>
        current.map((u) => data.units.find((d) => d.id === u.id) ?? u),
      );
      setError(false);
    } catch {
      setError(true);
    } finally {
      setOpening(null);
    }
  }
  return (
    <section className="esim-delivery" aria-labelledby="esim-delivery-title">
      <div className="esim-delivery-title">
        <span className="esim-delivery-icon">
          <QrCode size={24} />
        </span>
        <div>
          <h2 id="esim-delivery-title">
            {es
              ? "Tus eSIM, listas para viajar"
              : "Your eSIMs, ready to travel"}
          </h2>
          <p>
            {es
              ? "El QR y las instrucciones, siempre a mano."
              : "Your QR code and instructions, close at hand."}
          </p>
        </div>
      </div>
      {loading && (
        <p role="status">
          <LoaderCircle size={18} className="payment-spinner" />{" "}
          {es ? "Consultando tu eSIM…" : "Checking your eSIM…"}
        </p>
      )}
      {error && (
        <div className="checkout-error" role="alert">
          <p>
            {es
              ? "No pudimos abrir la eSIM. Utiliza el enlace completo del correo o el navegador donde hiciste la compra. Si tienes cuenta, inicia sesión."
              : "We couldn’t open your eSIM. Use the complete email link or your purchase browser. Sign in if you have an account."}
          </p>
          <button
            className="button button-secondary"
            onClick={() => setRetry((v) => v + 1)}
          >
            <RefreshCw size={16} />
            {es ? "Reintentar" : "Try again"}
          </button>
        </div>
      )}
      {!loading && !error && !units.length && (
        <p>
          {es
            ? "Aquí aparecerá el progreso de preparación y entrega de las eSIM de tu pedido."
            : "Your order’s eSIM preparation and delivery progress will appear here."}
        </p>
      )}
      <div className="esim-delivery-list">
        {units.map((unit) => (
          <article className="esim-delivery-unit" key={unit.id}>
            <div className="esim-delivery-unit-heading">
              <div>
                <h3>{unit.name}</h3>
                <small>
                  eSIM {unit.unitIndex}
                  {unit.qa
                    ? es
                      ? " · Prueba autorizada"
                      : " · Authorized test"
                    : ""}
                </small>
              </div>
              <span className={`esim-delivery-badge delivery-${unit.state}`}>
                {
                  {
                    queued: es ? "En preparación" : "Preparing",
                    provider_pending: es ? "Preparando QR" : "Preparing QR",
                    ready: es ? "Lista para instalar" : "Ready to install",
                    sent: es ? "Correo enviado" : "Email sent",
                    review: es ? "Requiere revisión" : "Needs review",
                    test_skipped: es ? "Pago de prueba" : "Test payment",
                  }[unit.state]
                }
              </span>
            </div>
            {unit.state === "test_skipped" ? (
              <p>
                {es
                  ? "Esta compra de prueba no consume saldo ni emite una eSIM real."
                  : "This test purchase does not consume balance or issue a real eSIM."}
              </p>
            ) : unit.state === "review" && !unit.installationReady ? (
              <p>
                {es
                  ? "Tu pedido está guardado y necesita una revisión. No vuelvas a comprar el mismo plan."
                  : "Your order is saved and needs review. Do not purchase the same plan again."}
              </p>
            ) : ["queued", "provider_pending"].includes(unit.state) ? (
              <p role="status">
                {es
                  ? "Estamos preparando tu eSIM. Aparecerá aquí y la enviaremos al correo del beneficiario."
                  : "We’re preparing your eSIM. It will appear here and be sent to the recipient’s email."}
              </p>
            ) : (
              <>
                {!unit.qr ? (
                  <button
                    type="button"
                    className="button button-secondary"
                    disabled={opening === unit.id}
                    onClick={() => open(unit)}
                  >
                    <QrCode size={18} />
                    {es
                      ? "Mostrar QR e instalación"
                      : "Show QR and installation"}
                  </button>
                ) : (
                  <div className="esim-delivery-install">
                    <div>
                      <Image
                        src={unit.qr}
                        alt={
                          es
                            ? "QR privado de instalación de tu eSIM"
                            : "Private eSIM installation QR"
                        }
                        width={256}
                        height={256}
                        unoptimized
                        className="customer-qr"
                      />
                      <p>
                        {es
                          ? "Escanéalo desde otra pantalla o utiliza los datos manuales."
                          : "Scan from another screen or use the manual details."}
                      </p>
                      <a
                        className="button button-secondary"
                        href={unit.qr}
                        download={`MyTripSim-${unit.id.slice(0, 8)}.png`}
                      >
                        {es ? "Descargar QR" : "Download QR"}
                      </a>
                    </div>
                    <div>
                      <h4>
                        {es ? "Instalación manual" : "Manual installation"}
                      </h4>
                      <p>SM-DP+</p>
                      <CopyValue
                        locale={locale}
                        value={unit.smdpAddress!}
                        label="SM-DP+"
                      />
                      <p>{es ? "Código de activación" : "Activation code"}</p>
                      <CopyValue
                        locale={locale}
                        value={unit.activationCode!}
                        label={es ? "código de activación" : "activation code"}
                      />
                      {unit.apn && (
                        <>
                          <p>APN</p>
                          <CopyValue
                            locale={locale}
                            value={unit.apn}
                            label="APN"
                          />
                        </>
                      )}
                      <Link
                        className="button button-primary"
                        href={experiencePath(locale, "install")}
                      >
                        {es
                          ? "Ver guía de instalación"
                          : "View installation guide"}
                        <ArrowRight size={16} />
                      </Link>
                    </div>
                  </div>
                )}
                <p className="esim-delivery-note">
                  <Mail size={16} />
                  {unit.state === "sent"
                    ? es
                      ? "Enviada al correo del beneficiario."
                      : "Sent to the recipient’s email."
                    : es
                      ? unit.state === "review"
                        ? "Tu QR está disponible. El envío del correo necesita revisión."
                        : "Tu QR ya está disponible. Estamos preparando el correo."
                      : unit.state === "review"
                        ? "Your QR is available. Email delivery needs review."
                        : "Your QR is available. We’re preparing your email."}
                </p>
              </>
            )}
          </article>
        ))}
      </div>
      <p className="esim-delivery-note">
        <ShieldCheck size={16} />
        {es
          ? "Guarda tus códigos en privado. El QR es para un único dispositivo; no borres la eSIM sin consultar la guía."
          : "Keep your codes private. The QR is for one device; check the guide before deleting your eSIM."}
      </p>
    </section>
  );
}
