# Pagos de producción — MyTripSim

Fecha: 26 de octubre de 2026. Sitio: https://www.mytripsim.com.

La cuenta de Stripe fue confirmada como activada por el propietario y comprobada mediante `charges_enabled`. Se sincronizaron **1.730 productos/precios reales** desde los precios minoristas publicados en Supabase. La sincronización no realiza compras ni emite eSIM.

## Configuración

- `CHECKOUT_PAYMENT_MODE=live` selecciona los cobros reales.
- Las claves `STRIPE_LIVE_SECRET_KEY`, `STRIPE_LIVE_PUBLISHABLE_KEY` y `STRIPE_LIVE_WEBHOOK_SECRET` se configuran únicamente en el entorno de producción de Vercel. La clave secreta y la firma del webhook nunca salen del servidor.
- `STRIPE_LIVE_CHECKOUT_ENABLED=true` habilita el checkout cuando están presentes sus requisitos. Los despliegues Preview no habilitan cobros reales.
- `STRIPE_TEST_CHECKOUT_ENABLED=false` retira el checkout público de pruebas. Las credenciales y los datos históricos de pruebas permanecen separados para reconciliar pedidos anteriores.
- Apple Pay, Google Pay y Link tienen dominio activo en Stripe para `www.mytripsim.com` y `mytripsim.com`. La interfaz de Stripe decide qué opciones mostrar según dispositivo, navegador, cuenta y disponibilidad.

Las credenciales se introdujeron en una entrada oculta y se guardaron fuera de Git. No deben copiarse al chat, documentación o registros.

## Separación de entornos e integridad

La migración `20261026000100_live_checkout.sql` permite precios separados por `(plan_id, livemode)`, conservando los registros anteriores. Las nuevas funciones sólo pueden ejecutarse desde el servidor. La creación de pedidos comprueba precios, cantidades, disponibilidad del proveedor, consentimiento y reintentos; el navegador no decide el precio ni el entorno.

Los eventos firmados de Stripe se validan con el secreto de su entorno. Antes de confirmar un pedido se comprueban sesión, entorno, moneda, importe, referencia y cada línea. Los eventos repetidos no duplican la confirmación. Un pago de prueba no puede confirmar un pedido real.

El pago confirmado en modo real activa la cola existente de emisión y entrega. El proveedor y Resend conservan sus identificadores de idempotencia. La expiración de cinco minutos usa las credenciales del entorno de cada pedido, evitando mezclar sesiones anteriores de prueba con las nuevas sesiones reales.

## Textos públicos

Se retiraron los avisos antiguos de demostración de la portada y se actualizaron catálogo, guía, FAQ, información del servicio y respuestas de SIM. El checkout y los recibos describen el estado real del pedido. No se han convertido pedidos históricos de prueba en compras reales ni se han borrado sus registros.

Las páginas del servicio incluyen información factual de compra, privacidad y un canal para solicitar asistencia o revisión de reembolsos. No se ha inventado un porcentaje de impuestos, un plazo universal de devolución ni una garantía de aprobación del reembolso. Las condiciones específicas de cada plan y los derechos aplicables siguen siendo relevantes.

## Operación

- `npm.cmd run stripe:configure -- --live`: entrada oculta de claves reales.
- `npm.cmd run stripe:sync:live`: sincronización idempotente del catálogo real.
- `npm.cmd run stripe:setup:live`: verifica precios, guarda vínculos privados y registra el webhook real; no habilita cobros por sí solo.
- `npm.cmd run stripe:domains:live`: verifica los dominios de las carteras de pago.
- `npm.cmd run stripe:deploy:live-env`: configura el entorno real de Vercel; requiere un nuevo despliegue para publicarlo.
- `npm.cmd run test:live`: pruebas locales de aislamiento entre entornos, precios, stock, privacidad e idempotencia. No realiza cargos ni consume saldo del proveedor.

La verificación de salida debe abrir una sesión real sin introducir ni confirmar tarjeta, comprobar el formulario de Stripe y expirar la sesión después. Eso valida la integración hasta el pago, pero no equivale a un cobro real aprobado. No se debe marcar un pedido como pagado manualmente para probar el proveedor.
