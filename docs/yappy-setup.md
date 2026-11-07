# Yappy: operación y despliegue

Actualizado: 7 de noviembre de 2026.

## Verificación

Ambos comercios autorizaron correctamente sus dominios: `https://www.mytripsim.com` y `https://portal.mytripsim.com`. La verificación no creó pagos. Las credenciales independientes están fuera de Git y se transfieren a Vercel por entrada privada.

La reserva de costes es 1,10% + USD 0,03, sin recargo al cliente. Es un presupuesto conservador basado en la [tarifa pública Yappy](https://www.yappy.com.pa/faq-items/cuanto-cuesta-cobrar-por-yappy-comercial/) (1% + ITBMS, mínimo USD 0,02) y la [información de ITBMS](https://dgi.mef.gob.pa/itbms/Generalidades). No representa una confirmación del contrato privado. Puede actualizarse mediante `npm.cmd run yappy:fees` y la configuración B2B.

## Configuración

- `npm.cmd run yappy:configure -- --live --site retail`
- `npm.cmd run yappy:configure -- --live --site business`
- `npm.cmd run yappy:check -- --live --retail`
- `npm.cmd run yappy:check -- --live`
- `npm.cmd run yappy:setup -- --apply`
- `npm.cmd run yappy:deploy -- --retail --enable`
- `npm.cmd run yappy:deploy -- --business --enable`

El instalador aplica exclusivamente las migraciones aditivas `20261107000100_checkout_yappy.sql` y `20261107000200_yappy_manual_refunds.sql`, sin ejecutar migraciones pendientes ajenas. No modifica importes históricos ni habilita pagos por sí solo. Los comandos de variables requieren un despliegue posterior. B2B conserva además su interruptor administrativo y sus tarifas.

## Compra y seguridad

Yappy se ofrece en USD para cualquier destino a usuarios de Yappy Panamá. El servidor comprueba consentimiento, identidad, catálogo, precios, costes recientes, cupones y reservas SimCoins. Exige contribución mínima del 20% incluyendo comisión y reservas conservadoras de afiliado 8% y recompensa 6%, sin descontar dos veces los créditos. No cambia precios del catálogo.

Se utiliza el botón oficial. Los eventos del navegador nunca confirman pagos. El IPN firmado valida referencia, dominio, entorno y pedido; su importe esperado se guarda en el servidor. Los duplicados no duplican emisión y un éxito tardío tiene prioridad sobre una expiración anterior. El pago confirmado reutiliza la cola existente de emisión y entrega. B2B conserva la autorización administrativa para liberar las unidades.

IPN retail: `https://www.mytripsim.com/api/payments/yappy/ipn`.

IPN B2B: `https://portal.mytripsim.com/api/portal/commerce/yappy-ipn`.

Las tablas de intentos, eventos y comprobantes son privadas, con RLS y funciones restringidas al servidor. No se crean identificadores ficticios de Stripe.

## Incertidumbre y reembolsos

Una creación incierta se marca para revisión y no genera otro intento automático. Consultar Yappy Comercial antes de solicitar otro pago. La falta de IPN no autoriza emitir una eSIM ni asumir que no hubo cobro.

Para reembolsar retail, tramitar primero la devolución por el canal del comercio y verificarla. En administración se registra referencia externa única, motivo, unidades y confirmación explícita; requiere acceso administrativo protegido. El registro utiliza el libro común y los ajustes de recompensas existentes. No realiza transferencias ni invoca una supuesta API de devolución Yappy. La devolución por unidad utiliza el importe neto realmente pagado.

## Aceptación pendiente

Las pruebas automatizadas usan mocks y bases efímeras: no consumen saldo ni eSIM reales. Cubren aislamiento de credenciales, firma, importes, consentimiento, margen, roles, concurrencia, callbacks duplicados, éxitos tardíos y reembolsos.

Todavía se necesita una transacción de aceptación autorizada del comercio para verificar el botón en el dispositivo del cliente, el IPN real y la entrega completa. Una autorización de comercio correcta no prueba ese recorrido.

Documentación técnica: [integración oficial Yappy](https://www.yappy.com.pa/comercial/desarrolladores/boton-de-pago-yappy-nueva-integracion/).

## Corrección de la espera (7 de noviembre de 2026)

La migración `20261107000300_yappy_hold_consistency.sql` conserva la restricción existente de espera: guarda inicio y vencimiento conjuntamente. No modifica pedidos existentes. El instalador comprueba y aplica también esta corrección. La prueba de base de datos carga la migración real de esperas para detectar incompatibilidades. Un rechazo de preparación anterior al contacto con Yappy ya no se etiqueta como pago incierto; los casos realmente inciertos mantienen la protección contra duplicados.
