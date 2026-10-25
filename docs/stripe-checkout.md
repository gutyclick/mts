# Stripe Checkout: entorno de pruebas

El carrito está conectado a Stripe Checkout con Payment Element integrado. En la misma página se revisan los datos del pedido y después se introducen número de tarjeta, vencimiento, CVC y país. Los campos de tarjeta son iframes de Stripe: sus datos se envían directamente a Stripe y nunca pasan por el servidor de MyTripSim.

## Configuración y despliegue

- Migración: `20261025000300_test_checkout.sql`. Crea los enlaces privados de precios, pedidos, líneas y registro de eventos. Sólo admite `livemode=false`.
- Migración `20261025000400_checkout_recipient_and_elements.sql`: separa el correo del comprador y el del beneficiario, conserva el consentimiento opcional de novedades con fecha y versión, e incorpora el modo `elements`. Mantiene las sesiones alojadas antiguas para no interrumpir compras de prueba ya iniciadas.
- `npm.cmd run stripe:setup:test`: verifica los enlaces exportados contra Stripe, guarda 1.730 precios en la tabla privada y registra el webhook de pruebas. Usa la autenticación existente del CLI de Supabase para configurar el acceso privado del servidor. Los valores se guardan en `.env.local`, fuera de Git, y nunca se imprimen.
- `npm.cmd run stripe:deploy:test-env`: transmite los secretos por stdin al almacenamiento cifrado de Vercel, proyecto `mts`. Configura `CHECKOUT_SITE_URL=https://www.mytripsim.com` y mantiene `STRIPE_TEST_CHECKOUT_ENABLED=false` para las ventas públicas.
- Para habilitar el checkout de pruebas en la web pública, ejecuta `npm.cmd run stripe:deploy:test-env -- --enable-public-test` y despliega de nuevo. Esta opción se activó para revisar la compra directamente en `www.mytripsim.com`; la UI muestra «Modo de pruebas» y sigue rechazando claves live y emisión de eSIM reales. El comando sin la opción vuelve a desactivar el checkout público.
- En local, `CHECKOUT_SITE_URL=http://localhost:3000` y `STRIPE_TEST_CHECKOUT_ENABLED=true`. Reinicia el servidor después de cambiar variables.
- Stripe Elements usa `STRIPE_TEST_PUBLISHABLE_KEY`, una clave pública `pk_test_…` del mismo entorno y cuenta. `/api/checkout/config` devuelve sólo esta clave pública cuando el checkout está habilitado. Las claves secretas siguen siendo exclusivas del servidor.
- La URL del webhook es `https://www.mytripsim.com/api/payments/stripe/webhook`. El endpoint público puede confirmar las sesiones de prueba creadas localmente porque todos los pedidos se guardan en Supabase.

## Seguridad y comportamiento

El navegador sólo envía referencias del carrito, cantidades, correo, consentimientos, un identificador de intento y el total que vio. La función privada de la base de datos vuelve a calcular el importe con planes publicados y precios enlazados. Un precio cambiado obliga a revisar el total. El servidor comprueba además el precio real de Stripe antes de crear la sesión. No acepta IDs de precio o importes por línea del cliente.

Los intentos repetidos con el mismo contenido reutilizan el pedido y la sesión. Los pedidos conservan una instantánea de los planes y precios. El límite de 15 intentos nuevos por red y hora se aplica en una transacción, entre instancias del servidor. La IP se guarda únicamente como HMAC, con una clave privada. No se guardan tarjetas.

Los clientes con sesión usan el correo confirmado de su cuenta. Un invitado no necesita cuenta y sólo consulta su pedido con la cookie privada HttpOnly del navegador que inició la compra. Conocer el UUID no da acceso. La respuesta de estado no incluye correo, claves, IDs de pago ni datos de instalación. Las cuentas sólo ven sus propios pedidos mediante RLS; los campos de correo y autorización no se conceden al cliente autenticado.

La opción «Enviar la eSIM a un correo electrónico diferente» muestra un campo obligatorio sólo al seleccionarla. El correo del comprador se usa en el pago; el del beneficiario queda reservado para la futura entrega de la eSIM. Desmarcar la opción vuelve a usar el correo del comprador, aunque antes se hubiera escrito otro destinatario. La casilla de novedades está desmarcada por defecto, es independiente de las condiciones y guarda su consentimiento para el correo del comprador, con fecha y versión `mytripsim-news-v1`. No se activan campañas de correo ni se comparte el consentimiento con terceros.

El primer paso valida los correos, las condiciones y el carrito; el segundo monta Payment Element en la misma página. Se puede volver a editar los datos. Cambiar el contenido del pedido invalida el formulario anterior para revisar el importe de nuevo. Las nuevas sesiones usan `ui_mode=elements` y sólo devuelven su `client_secret` al navegador autorizado que las creó. Este valor permanece en memoria, no se guarda en la base de datos, localStorage ni URLs. El pago se confirma mediante `checkout.confirm()` y vuelve a la pantalla de resultado; el webhook sigue siendo el único que registra el pago como confirmado. Link no solicita registro adicional en este formulario, para mantener los campos esenciales.

El webhook verifica la firma sobre el cuerpo original y su antigüedad. Consulta de nuevo la sesión y las líneas a Stripe y compara sesión, pedido, moneda, total, precios y cantidades con la instantánea almacenada. Registra cada evento una sola vez dentro de la misma transacción que actualiza el pago. Un aviso antiguo de vencimiento o fallo no rebaja un pago confirmado. Los errores de infraestructura devuelven 503 para que Stripe reintente. La página de regreso nunca marca pedidos como pagados.

La confirmación limpia sólo las cantidades compradas y conserva otras adiciones al carrito. Cancelar o fallar conserva el carrito. La pantalla de resultado espera la confirmación y ofrece reintentar la consulta si tarda. Los pedidos de prueba con cuenta aparecen en «Mis eSIM», identificados como pruebas y sin inventar un QR.

## Pruebas

`npm.cmd run test:checkout` verifica validación, firmas, privacidad, aislamiento, importes, idempotencia, transacciones y límites en PostgreSQL local. `npx.cmd playwright test tests/e2e/checkout.spec.ts tests/e2e/cart.spec.ts` revisa los estados y el carrito en escritorio y móvil. Los ensayos con Stripe deben usar exclusivamente sus [datos de prueba oficiales](https://docs.stripe.com/testing).

Verificado el 25 de octubre de 2026: compra de invitado con dos planes y tres eSIM, rechazo de tarjeta seguido de pago de prueba correcto, confirmación por el webhook público de Vercel, un único evento registrado y limpieza del carrito. Dos reenvíos del aviso no duplicaron la confirmación y un cuerpo alterado obtuvo HTTP 400. Un ensayo con cuenta temporal confirmó el correo verificado, la aparición del pedido en «Mis eSIM», el acceso del propietario sin cookie de invitado y el rechazo de columnas privadas. La cuenta de ensayo se eliminó sin enviar correos. Los 36 archivos estáticos del navegador se comprobaron sin encontrar las claves del servidor.

## Antes de vender

Esta fase no procesa cobros reales ni compra, activa o envía eSIM. Las claves live se rechazan y la base de datos rechaza pedidos live. La siguiente fase necesita configurar precios y claves de producción por separado, habilitar una cola de emisión idempotente para pagos reales, gestionar reintentos y fallos del proveedor, y probar la entrega segura por correo. También deben decidirse los impuestos y las condiciones comerciales antes de habilitar ventas.
