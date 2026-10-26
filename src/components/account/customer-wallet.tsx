import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Globe2,
  LogOut,
  Package,
  QrCode,
  ShieldCheck,
  Wifi,
} from "lucide-react";
import {
  customerEsim,
  customerRecords,
  customerSession,
  customerCheckoutOrders,
} from "@/lib/customer-data";
import { signOut } from "@/lib/account-actions";
import { experiencePath } from "@/lib/experience-routes";
import { pathFor, type Locale } from "@/lib/i18n";
import { CopyValue } from "./copy-value";
import { formatUSD } from "@/lib/retail-prices";
import { CustomerSupportSummary } from "./support-summary";
const dataLabel = (gb: number) =>
  gb < 1 ? `${Math.round(gb * 1000)} MB` : `${gb} GB`;
function fulfillmentLabel(states: string[], live: boolean, es: boolean) {
  if (states.includes("review"))
    return es ? "Entrega en revisión" : "Delivery under review";
  if (states.some((s) => ["queued", "provider_pending"].includes(s)))
    return es ? "Preparando tus eSIM" : "Preparing your eSIMs";
  if (states.includes("ready"))
    return es
      ? "eSIM lista para instalar · Correo pendiente"
      : "eSIM ready to install · Email pending";
  if (states.length && states.every((s) => s === "sent"))
    return es ? "eSIM preparada · Correo enviado" : "eSIM ready · Email sent";
  return !live
    ? es
      ? "Compra de prueba"
      : "Test purchase"
    : es
      ? "Pedido recibido"
      : "Order received";
}

export async function CustomerWallet({
  locale,
  selectedId,
}: {
  locale: Locale;
  selectedId?: string;
}) {
  const es = locale === "es";
  const { client, user } = await customerSession(
    locale,
    experiencePath(
      locale,
      "wallet",
      selectedId ? { esim: selectedId } : undefined,
    ),
  );
  const [{ orders, esims }, checkouts] = await Promise.all([
    customerRecords(client, user.id),
    customerCheckoutOrders(client, user.id),
  ]);
  const { data: adminMembership } = await client
    .from("admin_memberships")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  const labels = es
    ? {
        ready: "Lista para instalar",
        active: "Activa",
        expired: "Finalizada",
        suspended: "Suspendida",
        pending: "Pendiente",
        processing: "En preparación",
        completed: "Completado",
        cancelled: "Cancelado",
        refunded: "Reembolsado",
      }
    : {
        ready: "Ready to install",
        active: "Active",
        expired: "Expired",
        suspended: "Suspended",
        pending: "Pending",
        processing: "Preparing",
        completed: "Completed",
        cancelled: "Cancelled",
        refunded: "Refunded",
      };
  const selected = selectedId
    ? await customerEsim(client, user.id, selectedId)
    : null;
  if (selectedId && !selected) notFound();
  const order = selected
    ? orders.find((o) => o.id === selected.order_id)
    : undefined;
  if (selected && !order) notFound();
  const formatDate = (value: string) =>
    new Intl.DateTimeFormat(es ? "es-PA" : "en-US", {
      dateStyle: "medium",
      timeZone: "America/Panama",
    }).format(new Date(value));
  const qr =
    selected?.smdp_address && selected.activation_code
      ? await QRCode.toDataURL(
          `LPA:1$${selected.smdp_address}$${selected.activation_code}`,
          { width: 256, margin: 2, errorCorrectionLevel: "M" },
        )
      : null;
  return (
    <div className="container customer-account">
      <header className="customer-heading">
        <div>
          <p className="eyebrow">
            <ShieldCheck size={15} />
            {es ? "TU ESPACIO PRIVADO" : "YOUR PRIVATE SPACE"}
          </p>
          <h1>{es ? "Mis eSIM" : "My eSIMs"}</h1>
          <p>{user.email}</p>
          {adminMembership && (
            <Link className="account-back" href={`/${locale}/admin`}>
              <ShieldCheck size={16} />
              {es ? "Abrir administración" : "Open administration"}
              <ArrowRight size={15} />
            </Link>
          )}
          <Link className="account-back" href={`/${locale}/support`}>
            <Package size={17} />
            {es ? "Mis tickets de ayuda" : "My support tickets"}
          </Link>
        </div>
        <form action={signOut}>
          <input type="hidden" name="locale" value={locale} />
          <button className="button button-secondary">
            <LogOut size={17} />
            {es ? "Cerrar sesión" : "Sign out"}
          </button>
        </form>
      </header>
      {selected && order ? (
        <>
          <Link
            className="account-back"
            href={experiencePath(locale, "wallet")}
          >
            <ArrowLeft size={17} />
            {es ? "Todas mis eSIM" : "All my eSIMs"}
          </Link>
          <div className="customer-detail-grid">
            <section className="customer-card">
              <p className="eyebrow">{labels[selected.status]}</p>
              <h2>{order.destination_name[locale]}</h2>
              <p>{order.plan_name}</p>
              <div className="customer-plan-facts">
                <span>
                  <Wifi size={19} />
                  <strong>{dataLabel(order.data_gb)}</strong>
                </span>
                <span>
                  <CalendarDays size={19} />
                  {order.days} {es ? "días" : "days"}
                </span>
              </div>
              <dl className="customer-facts">
                <div>
                  <dt>{es ? "Consumo" : "Data usage"}</dt>
                  <dd>
                    {selected.used_gb === null
                      ? es
                        ? "Sin lectura de consumo"
                        : "No usage reading"
                      : `${selected.used_gb} / ${order.data_gb} GB`}
                  </dd>
                </div>
                {selected.usage_updated_at && (
                  <div>
                    <dt>{es ? "Actualizado" : "Updated"}</dt>
                    <dd>{formatDate(selected.usage_updated_at)}</dd>
                  </div>
                )}
                {selected.expires_at && (
                  <div>
                    <dt>{es ? "Vence" : "Expires"}</dt>
                    <dd>{formatDate(selected.expires_at)}</dd>
                  </div>
                )}
              </dl>
              {selected.iccid && (
                <details className="customer-disclosure">
                  <summary>ICCID</summary>
                  <CopyValue
                    value={selected.iccid}
                    locale={locale}
                    label="ICCID"
                  />
                </details>
              )}
              <Link
                className="button button-primary"
                href={experiencePath(locale, "install", { esim: selected.id })}
              >
                {es
                  ? "Ver instrucciones de instalación"
                  : "View installation instructions"}
                <ArrowRight size={17} />
              </Link>
            </section>
            <section className="customer-card">
              <QrCode className="customer-section-icon" size={25} />
              <h2>{es ? "Instala tu eSIM" : "Install your eSIM"}</h2>
              {qr ? (
                <>
                  <p>
                    {es
                      ? "Abre esta página en otra pantalla para escanear el QR con tu teléfono. También puedes instalarla manualmente."
                      : "Open this page on another screen to scan the QR with your phone. You can also install it manually."}
                  </p>
                  <details className="customer-disclosure">
                    <summary>
                      {es
                        ? "Mostrar QR y datos de instalación"
                        : "Show QR and installation details"}
                    </summary>
                    <Image
                      className="customer-qr"
                      unoptimized
                      src={qr}
                      width={256}
                      height={256}
                      alt={
                        es
                          ? "QR privado de instalación de tu eSIM"
                          : "Private eSIM installation QR"
                      }
                    />
                    <h3>{es ? "Dirección SM-DP+" : "SM-DP+ address"}</h3>
                    <CopyValue
                      value={selected.smdp_address!}
                      locale={locale}
                      label="SM-DP+"
                    />
                    <h3>{es ? "Código de activación" : "Activation code"}</h3>
                    <CopyValue
                      value={selected.activation_code!}
                      locale={locale}
                      label={es ? "código de activación" : "activation code"}
                    />
                    <p className="account-hint">
                      {es
                        ? "No compartas estos datos. El código está destinado a tu dispositivo; no borres la eSIM sin revisar las condiciones."
                        : "Keep these details private. The code is intended for your device; check the conditions before deleting your eSIM."}
                    </p>
                  </details>
                </>
              ) : (
                <p>
                  {es
                    ? "Los datos de instalación aparecerán aquí cuando tu eSIM esté preparada."
                    : "Installation details will appear here once your eSIM is ready."}
                </p>
              )}
            </section>
          </div>
        </>
      ) : (
        <>
          <section aria-labelledby="customer-esims-title">
            <h2 className="customer-section-title" id="customer-esims-title">
              <Wifi size={23} />
              {es ? "Tus conexiones" : "Your connections"}
              <span>{esims.length}</span>
            </h2>
            {!esims.length ? (
              <div className="customer-empty">
                <Globe2 size={35} />
                <h3>
                  {es ? "Tu próximo viaje te espera" : "Your next trip awaits"}
                </h3>
                <p>
                  {es
                    ? "Aquí encontrarás tus eSIM y sus instrucciones cuando tengas una. Por ahora, puedes explorar los destinos disponibles."
                    : "Your eSIMs and their instructions will appear here when you have one. For now, you can explore available destinations."}
                </p>
                <Link
                  className="button button-primary"
                  href={pathFor(locale, "destinations")}
                >
                  {es ? "Explorar destinos" : "Explore destinations"}
                  <ArrowRight size={17} />
                </Link>
              </div>
            ) : (
              <div className="customer-esim-grid">
                {esims.map((record) => {
                  const item = orders.find((o) => o.id === record.order_id);
                  if (!item) return null;
                  return (
                    <article className="customer-card" key={record.id}>
                      <span
                        className={`customer-status status-${record.status}`}
                      >
                        {labels[record.status]}
                      </span>
                      <h3>{item.destination_name[locale]}</h3>
                      <p>{item.plan_name}</p>
                      <div className="customer-plan-facts">
                        <span>
                          <Wifi size={18} />
                          {dataLabel(item.data_gb)}
                        </span>
                        <span>
                          <CalendarDays size={18} />
                          {item.days} {es ? "días" : "days"}
                        </span>
                      </div>
                      <Link
                        className="button button-secondary"
                        href={experiencePath(locale, "wallet", {
                          esim: record.id,
                        })}
                      >
                        {es ? "Ver mi eSIM" : "View my eSIM"}
                        <ArrowRight size={16} />
                      </Link>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
          <section
            className="customer-orders"
            aria-labelledby="customer-orders-title"
          >
            <h2 className="customer-section-title" id="customer-orders-title">
              <Package size={23} />
              {es ? "Mis pedidos" : "My orders"}
              <span>
                {orders.filter((o) => !o.checkout_order_id).length +
                  checkouts.length}
              </span>
            </h2>
            {!orders.length && !checkouts.length ? (
              <p className="customer-card">
                {es
                  ? "Todavía no tienes pedidos. Cuando hagas uno, podrás seguirlo desde aquí."
                  : "You don’t have any orders yet. When you place one, you can follow it here."}
              </p>
            ) : (
              <div className="customer-order-list">
                {checkouts.map((item) => (
                  <article
                    className="customer-card customer-order"
                    key={item.id}
                  >
                    <div>
                      <h3>
                        {es ? "Pedido" : "Order"} #
                        {item.id.slice(0, 8).toUpperCase()}
                      </h3>
                      {item.items.map((line) => (
                        <p key={line.plan_id}>
                          {line.plan_name} × {line.quantity}
                        </p>
                      ))}
                      <small>
                        {formatDate(item.created_at)} ·{" "}
                        {fulfillmentLabel(
                          item.fulfillmentStates,
                          item.livemode,
                          es,
                        )}
                      </small>
                    </div>
                    <div>
                      <span className="customer-status">
                        {item.status === "paid"
                          ? es
                            ? "Pago confirmado"
                            : "Payment confirmed"
                          : item.status === "pending"
                            ? es
                              ? "Pago pendiente"
                              : "Payment pending"
                            : item.status === "cancelled"
                              ? es
                                ? "Pedido cancelado"
                                : "Order cancelled"
                              : item.status === "expired"
                                ? es
                                  ? "Sesión vencida"
                                  : "Session expired"
                                : es
                                  ? "Pago fallido"
                                  : "Payment failed"}
                      </span>
                      <p>{formatUSD(item.amount_total, locale)}</p>
                      <Link
                        href={`/${locale}/checkout/result?order=${item.id}`}
                      >
                        {item.status === "pending"
                          ? es
                            ? "Completar el pago"
                            : "Complete payment"
                          : es
                            ? "Ver pedido"
                            : "View order"}{" "}
                        <ArrowRight size={14} />
                      </Link>
                    </div>
                  </article>
                ))}
                {orders
                  .filter((o) => !o.checkout_order_id)
                  .map((item) => (
                    <article
                      className="customer-card customer-order"
                      key={item.id}
                    >
                      <div>
                        <h3>{item.destination_name[locale]}</h3>
                        <p>{item.plan_name}</p>
                        <small>
                          {formatDate(item.created_at)} ·{" "}
                          {es ? "Pedido" : "Order"}{" "}
                          {item.id.slice(0, 8).toUpperCase()}
                        </small>
                      </div>
                      <span className="customer-status">
                        {labels[item.status]}
                      </span>
                    </article>
                  ))}
              </div>
            )}
          </section>
          <aside className="customer-help">
            <div>
              <h2>{es ? "Todo listo para instalar" : "Ready to install"}</h2>
              <p>
                {es
                  ? "Consulta la guía paso a paso para iPhone y Android."
                  : "Follow the step-by-step guide for iPhone and Android."}
              </p>
            </div>
            <Link
              className="button button-secondary"
              href={experiencePath(locale, "install")}
            >
              {es ? "Ver guía" : "View guide"}
              <ArrowRight size={17} />
            </Link>
          </aside>
        </>
      )}
      <CustomerSupportSummary locale={locale} userId={user.id} />
    </div>
  );
}
