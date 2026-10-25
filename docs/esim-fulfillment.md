# Emisión y entrega de eSIM

MyTripSim obtiene los perfiles mediante la API de eSIM Access y envía el correo transaccional con Resend. El proveedor no recibe el correo del comprador o beneficiario. Sus ejemplos de integración separan emisión y envío: [referencia oficial](https://esimaccess.com/sell-esims-on-shopify-with-make-com/).

## Recorrido

1. El webhook firmado de Stripe verifica el pago y registra `paid`. Un trigger crea una unidad de emisión por cada eSIM comprada dentro de la misma transacción; repetir el evento no duplica unidades.
2. La cola conserva la referencia exacta del plan y un `transactionId` inmutable por unidad. Un reintento por respuesta perdida utiliza la misma referencia. La compra admite una única eSIM y no incluye precios de venta ni correos.
3. El trabajador consulta únicamente ese pedido hasta recibir el perfil correcto. Compara pedido, plan, volumen y duración. El QR se genera localmente a partir del código LPA; no se descargan imágenes del proveedor.
4. Guardar el perfil y publicarlo en las tablas de Mis eSIM es una transacción atómica. El usuario sólo puede consultar sus filas mediante RLS. Los invitados utilizan el enlace privado del correo y no necesitan registrarse.
5. El correo incluye QR inline, datos manuales, guía y enlace privado. Se envía exclusivamente al beneficiario, con clave idempotente por unidad. No incluye promociones ni activa suscripciones. `sent` significa aceptado por Resend, no garantiza que se haya leído o instalado.

## Seguridad y reintentos

La cola y las referencias privadas son accesibles sólo por `service_role`. No se admiten compras ni reintentos desde el navegador. Cada reclamación usa un token y una reserva de 120 segundos. El worker ejecuta dos fases en paralelo, sin esperar dentro de la petición a que el proveedor termine. Las fases de compra, consulta y envío son independientes; un correo fallido nunca recompra el perfil. Los errores guardados son categorías sin cuerpos del proveedor, claves o códigos de instalación.

Los errores temporales tienen espera creciente y límite de 24 intentos por fase. Las respuestas incompatibles y errores permanentes pasan a `review`. La ventana de reintentos de correo se limita a 23 horas desde el primer envío, inferior a la retención de 24 horas de [idempotencia de Resend](https://resend.com/docs/dashboard/emails/idempotency-keys); fuera de ella se exige revisar el resultado antes de reenviar.

Los enlaces llevan un token HMAC específico por unidad y nonce. El secreto se configura sólo en Vercel y `.env.local`. El token viaja en el fragmento de la URL y se consulta mediante POST del mismo origen; no entra en parámetros de consulta, rutas de servidor, referrers ni localStorage. Rotar `access_nonce` revoca un enlace. Los enlaces y QR deben tratarse como credenciales de instalación y no publicarse.

Supabase Cron ejecuta `mts-esim-fulfillment` cada 30 segundos. Sólo llama a Vercel si hay trabajo elegible y firma solicitudes de un solo uso, utilizando Vault. No se modifica el webhook global de eSIM Access; las consultas periódicas recuperan trabajo incluso sin notificaciones externas.

## Configuración

```powershell
npm.cmd run fulfillment:configure
npx.cmd supabase db push --linked --yes
# Desplegar las rutas de Vercel antes de activar Cron.
npm.cmd run fulfillment:start
npm.cmd run test:fulfillment
```

La configuración comprueba el dominio verificado en la cuenta de Resend conectada por CLI, crea una clave de sólo envío limitada a `mytripsim.com` y la transmite por stdin a Vercel como secreto. No modifica DNS ni la clave SMTP de Supabase Auth. Migraciones `20261025000900` y `20261025001000`.

## Stripe test y prueba real controlada

El checkout público permanece en Stripe test. Esos pagos crean unidades `test_skipped`, sin llamadas de compra o correo. No se convierten automáticamente en compras reales al activar la cola. Antes de vender hay que conectar Stripe live, su catálogo, restricciones de base de datos y webhook de producción por separado.

Una única unidad puede recibir `qa_authorized=true` desde administración privada después de autorización expresa del usuario para una prueba real. Ese campo no se concede al navegador ni a clientes autenticados. La prueba autorizada en esta sesión es un solo paquete Panamá 100 MB/7 días. El resultado y las referencias sensibles se mantienen en `private-data/fulfillment/`, excluido de Git. No se compra un paquete alternativo ni se automatiza esta excepción para otros pedidos.

## Verificaciones

`test:fulfillment` comprueba pago confirmado, separación test/live, unidades únicas, reservas, reintentos con referencia fija, coincidencia de perfiles, publicación atómica, RLS, tokens privados y HTML escapado. Las pruebas Playwright de `esim-delivery.spec.ts` verifican QR, descarga, instalación manual, enlaces inválidos y ausencia de desbordamiento en móvil y escritorio.
