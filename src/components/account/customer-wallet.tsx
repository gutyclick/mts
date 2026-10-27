import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { isPreparingDelivery } from "@/lib/esim-installation";
import { QuickInstall } from "./quick-install";
import { DeliveryRefresh } from "./delivery-refresh";
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
  UserRound,
  Headphones,
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
import { formatMoney, currencyCode } from "@/lib/currency";
import { DashboardShell } from "./dashboard-shell";
import { SupportWidget } from "../support/widget";
import {
  dashboardSection,
  dashboardFilter,
  filterDashboardEsims,
  dashboardFilters,
} from "@/lib/customer-dashboard";
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
  section: sectionValue,
  filter: filterValue,
}: {
  locale: Locale;
  selectedId?: string;
  section?: string;
  filter?: string;
}) {
  const es = locale === "es";
  const section = dashboardSection(sectionValue, selectedId);
  const filter = dashboardFilter(filterValue);
  const { client, user } = await customerSession(
    locale,
    experiencePath(
      locale,
      "wallet",
      selectedId
        ? { esim: selectedId }
        : section !== "esims"
          ? { section }
          : filter !== "all"
            ? { filter }
            : undefined,
    ),
  );
  const [{ orders, esims }, checkouts] = await Promise.all([
    customerRecords(client, user.id),
    customerCheckoutOrders(client, user.id),
  ]);
  const { data: adminMembership } =
    section === "account"
      ? await client
          .from("admin_memberships")
          .select("user_id")
          .eq("user_id", user.id)
          .maybeSingle()
      : { data: null };
  const preparing = checkouts.filter(
    (o) =>
      o.status === "paid" &&
      isPreparingDelivery(
        o.fulfillmentStates,
        esims.filter((e) =>
          orders.some(
            (order) =>
              order.id === e.order_id && order.checkout_order_id === o.id,
          ),
        ).length,
      ),
  );
  const refreshing =
    preparing.length > 0 || checkouts.some((o) => o.recentPending);
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
  const visibleEsims = filterDashboardEsims(esims, filter);
  const firstName =
    typeof user.user_metadata?.first_name === "string"
      ? user.user_metadata.first_name
      : es
        ? "viajero"
        : "traveler";
  const lastName =
    typeof user.user_metadata?.last_name === "string"
      ? user.user_metadata.last_name
      : "";
  const orderCount =
    orders.filter((o) => !o.checkout_order_id).length + checkouts.length;
  return (
    <DashboardShell
      locale={locale}
      section={section}
      name={firstName}
      esimCount={esims.length}
      orderCount={orderCount}
    >
      {!selected &&
        (section === "esims" || section === "orders") &&
        refreshing && <DeliveryRefresh locale={locale} />}
      {selected && order ? (
        <>
          <Link
            className="account-back"
            href={experiencePath(locale, "wallet")}
          >
            <ArrowLeft size={17} />
            {es ? "Todas mis TripSim" : "All my TripSim"}
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
                  <QuickInstall
                    smdp={selected.smdp_address!}
                    code={selected.activation_code!}
                    locale={locale}
                  />
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
          {section === "esims" && (
            <section aria-labelledby="customer-esims-title">
              <h2 className="customer-section-title" id="customer-esims-title">
                <Wifi size={23} />
                {es ? "Tus TripSim" : "Your TripSim"}
                <span>{esims.length}</span>
              </h2>
              <p className="trip-section-description">
                {es
                  ? "Instala tu eSIM, consulta su estado y lleva tus datos contigo."
                  : "Install your eSIM, check its status and take your data with you."}
              </p>
              <nav
                className="trip-status-filters"
                aria-label={es ? "Filtrar TripSim" : "Filter TripSim"}
              >
                {dashboardFilters.map((value) => (
                  <Link
                    key={value}
                    href={experiencePath(
                      locale,
                      "wallet",
                      value === "all" ? undefined : { filter: value },
                    )}
                    aria-current={filter === value ? "page" : undefined}
                  >
                    {
                      {
                        all: es ? "Todas" : "All",
                        ready: es ? "Para instalar" : "Ready to install",
                        active: es ? "En uso" : "In use",
                        ended: es ? "Finalizadas" : "Past",
                      }[value]
                    }
                    <small>
                      {value === "all"
                        ? esims.length
                        : filterDashboardEsims(esims, value).length}
                    </small>
                  </Link>
                ))}
              </nav>
              {filter === "all" && preparing.length > 0 && (
                <div className="customer-esim-grid">
                  {preparing.map((item) => (
                    <article
                      className="customer-card customer-preparing"
                      key={item.id}
                    >
                      <span className="customer-status status-processing">
                        {es
                          ? "Pago confirmado · eSIM en preparación"
                          : "Payment confirmed · Preparing eSIM"}
                      </span>
                      <h3>
                        {es
                          ? "Tu conexión está en camino"
                          : "Your connection is on its way"}
                      </h3>
                      {item.items.map((line) => (
                        <p key={line.plan_id}>
                          {line.plan_name} × {line.quantity}
                        </p>
                      ))}
                      <p>
                        {es
                          ? "Aquí aparecerá tu eSIM cuando termine la emisión. Te avisaremos también por correo. No necesitas repetir el pago."
                          : "Your eSIM will appear here once issued. We’ll also email you. You don’t need to pay again."}
                      </p>
                      <Link
                        className="button button-secondary"
                        href={`/${locale}/checkout/result?order=${item.id}`}
                      >
                        {es ? "Seguir preparación" : "Track preparation"}
                        <ArrowRight size={16} />
                      </Link>
                    </article>
                  ))}
                </div>
              )}
              {!esims.length && !preparing.length ? (
                <div className="customer-empty">
                  <Globe2 size={35} />
                  <h3>
                    {es
                      ? "Tu próximo viaje te espera"
                      : "Your next trip awaits"}
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
                  {!visibleEsims.length &&
                    !(filter === "all" && preparing.length) && (
                      <div className="customer-empty trip-filter-empty">
                        <Wifi size={28} />
                        <h3>
                          {es
                            ? "Ninguna TripSim en esta sección"
                            : "No TripSim in this section"}
                        </h3>
                        <p>
                          {es
                            ? "Tus otras conexiones siguen disponibles en Todas."
                            : "Your other connections are still available under All."}
                        </p>
                        <Link
                          className="button button-secondary"
                          href={experiencePath(locale, "wallet")}
                        >
                          {es ? "Ver todas" : "View all"}
                        </Link>
                      </div>
                    )}
                  {visibleEsims.map((record) => {
                    const item = orders.find((o) => o.id === record.order_id);
                    if (!item) return null;
                    return (
                      <article
                        className={`customer-card trip-esim-card trip-esim-${record.status}`}
                        key={record.id}
                      >
                        <span
                          className={`customer-status status-${record.status}`}
                        >
                          {labels[record.status]}
                        </span>
                        <div className="trip-esim-destination">
                          <span>
                            <Globe2 size={22} />
                          </span>
                          <h3>{item.destination_name[locale]}</h3>
                        </div>
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
                        {record.used_gb !== null && (
                          <div className="trip-usage">
                            <div>
                              <span>
                                {es ? "Datos utilizados" : "Data used"}
                              </span>
                              <strong>
                                {dataLabel(record.used_gb)} /{" "}
                                {dataLabel(item.data_gb)}
                              </strong>
                            </div>
                            <progress
                              max={item.data_gb}
                              value={Math.min(record.used_gb, item.data_gb)}
                              aria-label={
                                es
                                  ? "Consumo de datos registrado"
                                  : "Recorded data usage"
                              }
                            />
                            <small>
                              {es
                                ? "Última lectura disponible"
                                : "Latest available reading"}
                            </small>
                          </div>
                        )}
                        <Link
                          className={
                            record.status === "ready"
                              ? "button button-primary"
                              : "button button-secondary"
                          }
                          href={experiencePath(locale, "wallet", {
                            esim: record.id,
                          })}
                        >
                          {record.status === "ready"
                            ? es
                              ? "Instalar TripSim"
                              : "Install TripSim"
                            : es
                              ? "Ver TripSim"
                              : "View TripSim"}
                          <ArrowRight size={16} />
                        </Link>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          )}
          {section === "orders" && (
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
                        <p>
                          {formatMoney(
                            item.amount_total,
                            currencyCode(item.currency) ?? "USD",
                            locale,
                          )}
                        </p>
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
          )}
          {section === "support" && (
            <>
              <div className="trip-section-heading">
                <span>
                  <Headphones size={23} />
                </span>
                <div>
                  <h2>{es ? "Tu centro de soporte" : "Your support center"}</h2>
                  <p>
                    {es
                      ? "Habla con SIM o consulta las respuestas del equipo."
                      : "Talk to SIM or read replies from our team."}
                  </p>
                </div>
              </div>
              <div className="trip-support-actions">
                <SupportWidget locale={locale} inline />
                <Link
                  className="button button-secondary"
                  href={pathFor(locale, "faq")}
                >
                  {es ? "Preguntas frecuentes" : "Frequently asked questions"}
                  <ArrowRight size={16} />
                </Link>
              </div>
              <CustomerSupportSummary locale={locale} userId={user.id} />
              <aside className="customer-help">
                <div>
                  <h2>
                    {es ? "Todo listo para instalar" : "Ready to install"}
                  </h2>
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
          {section === "account" && (
            <section className="trip-profile">
              <div className="trip-section-heading">
                <span>
                  <UserRound size={23} />
                </span>
                <div>
                  <h2>{es ? "Tu cuenta" : "Your account"}</h2>
                  <p>
                    {es
                      ? "Los datos con los que gestionas tus viajes."
                      : "The details you use to manage your trips."}
                  </p>
                </div>
              </div>
              <div className="customer-card">
                <dl className="trip-profile-details">
                  <div>
                    <dt>{es ? "Nombre" : "First name"}</dt>
                    <dd>{firstName}</dd>
                  </div>
                  <div>
                    <dt>{es ? "Apellido" : "Last name"}</dt>
                    <dd>{lastName || "—"}</dd>
                  </div>
                  <div>
                    <dt>{es ? "Correo electrónico" : "Email address"}</dt>
                    <dd>{user.email}</dd>
                  </div>
                </dl>
                <form action={signOut}>
                  <input type="hidden" name="locale" value={locale} />
                  <button className="button button-secondary">
                    <LogOut size={17} />
                    {es ? "Cerrar sesión" : "Sign out"}
                  </button>
                </form>
              </div>
              {adminMembership && (
                <Link className="trip-admin-link" href={`/${locale}/admin`}>
                  <ShieldCheck size={18} />
                  {es ? "Abrir administración" : "Open administration"}
                  <ArrowRight size={16} />
                </Link>
              )}
            </section>
          )}
        </>
      )}
    </DashboardShell>
  );
}
