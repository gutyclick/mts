# Cookies y almacenamiento local

## 1. Qué son y para qué se utilizan

Las cookies son pequeños registros que guarda el navegador. MyTripSim también utiliza almacenamiento local para conservar determinadas funciones entre visitas. No todo almacenamiento tiene la misma finalidad ni el mismo régimen de consentimiento.

Contacto: **hello@mytripsim.com**. La política de privacidad explica el tratamiento de datos asociado a estas funciones.

## 2. Inventario identificado en el código

| Elemento                                                   | Finalidad                                                                          | Duración identificada                                                                                                         |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Cookies de autenticación Supabase `sb-*`                   | Mantener y renovar la sesión de la cuenta, incluyendo sus mecanismos de acceso     | Según la sesión y renovación del sistema de autenticación; puede renovarse al utilizar la cuenta                              |
| `mts_checkout_browser`                                     | Vincular de forma segura el navegador con un intento de pago y consultar su estado | Un día en la configuración actual                                                                                             |
| `mts_support_guest`                                        | Recuperar el chat de un visitante en ese navegador y proteger su acceso            | Siete días, con renovación al utilizar la función                                                                             |
| `mytripsim.cart.v1` en almacenamiento local                | Guardar los identificadores y cantidades del carrito                               | Hasta que se actualice o elimine; no tiene un vencimiento automático general                                                  |
| `mytripsim.completed-carts.v1` en almacenamiento local     | Evitar restaurar carritos ya completados                                           | Se conservan hasta veinte referencias de pedidos completados, que se sustituyen por las nuevas o se borran desde el navegador |
| `mytripsim.pending-payment.v1` en almacenamiento local     | Recuperar el aviso y acceso al pago en curso                                       | Se retira al resolver o limpiar el intento; el almacenamiento no equivale a la vigencia de la sesión bancaria                 |
| Valoraciones locales de preguntas frecuentes               | Recordar la valoración realizada desde ese navegador                               | Hasta su actualización o borrado; únicamente se guarda tras usar la valoración                                                |
| Identificadores del formulario de Stripe y métodos de pago | Autenticación, prevención del fraude y funcionamiento del pago solicitado          | Duración variable según el identificador y el método utilizado; consulta la política de cookies de Stripe                     |
| `mytripsim.currency.v1` en almacenamiento local | Recordar la moneda que eliges para mostrar precios y pagar | Hasta que la cambies o borres los datos del sitio; se guarda una elección de moneda, sin identificador de persona |

Los nombres y las duraciones de terceros pueden variar. El inventario debe actualizarse cuando cambien las integraciones. No se almacenan conversaciones completas ni códigos de instalación de eSIM en el almacenamiento local propio del chat.

## 3. Cookies necesarias y tratamientos opcionales

La sesión de cuenta, el carrito solicitado, la seguridad del pago y la recuperación del chat que abres tienen finalidades funcionales concretas. Su consideración jurídica debe evaluarse según su uso real y las reglas que te sean aplicables.

Las estadísticas propias son opcionales y permanecen desactivadas hasta que aceptes. Puedes elegir «Solo necesarias» o «Aceptar estadísticas» con la misma facilidad y cambiarlo en «Preferencias de privacidad» del pie de página. Rechazar no impide comprar ni usar el soporte. El permiso para ofertas por correo es independiente.

La cookie necesaria `mts_stats_consent` guarda una elección firmada (sí o no, versión v1) durante 180 días, sin identificador individual. Solo al aceptar se crea `mts_stats_session`, una cookie HttpOnly con un valor aleatorio y una duración absoluta de 30 minutos. El servidor guarda una huella HMAC de ese valor para contar sesiones que consultan destinos, añaden al carrito, empiezan el pago y completan una compra real; no utiliza píxeles ni analítica de terceros. No registra URLs completas, correos, QR ni códigos de instalación en los eventos.

Respetamos Do Not Track y Global Privacy Control desactivando la medición. Retirar el permiso detiene los nuevos eventos y borra la cookie opcional al confirmar la retirada en el servidor; si hay un fallo, el identificador se conserva solo para reintentar el borrado hasta su vencimiento original de 30 minutos; cuando la base de datos está disponible, también elimina los eventos y la asociación del pedido de la sesión actual. Los datos seudónimos de sesiones y eventos se conservan 30 días y se purgan diariamente (hasta 24 horas adicionales). Las huellas separadas para limitar abusos caducan en una hora y los marcadores que evitan reactivar sesiones retiradas en 30 minutos; se purgan diariamente. El borrado de una sesión actual no identifica automáticamente sesiones anteriores. La política de privacidad amplía esta información.

## 4. Cómo gestionar el almacenamiento

Puedes consultar y borrar las cookies y los datos del sitio desde la configuración de tu navegador. Eliminar o bloquear los elementos necesarios puede cerrar tu sesión, vaciar el carrito, impedir recuperar un chat de visitante o dificultar el seguimiento de un pago en ese navegador.

Borrar datos del navegador no cancela un pedido, no elimina necesariamente los registros de MyTripSim y no revoca por sí solo un pago en Stripe. Para ejercer derechos sobre los datos conservados en nuestros sistemas, escribe a **hello@mytripsim.com**.

Los métodos de pago y carteras digitales pueden ofrecer controles propios. Consulta la información del proveedor cuando interactúes directamente con esos servicios.

## 5. Cambios

La versión definitiva mostrará fecha de actualización. Cuando se introduzca una finalidad opcional nueva, se facilitará la información y la elección que correspondan antes de activarla.
