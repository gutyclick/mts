# Recuperación de carritos: propuesta concreta

Estado: diseño revisado contra la arquitectura existente; todavía no implementado ni activado. No se han programado ni enviado correos de recuperación.

## Qué se puede recuperar

El carrito actual se guarda en el navegador. Los pedidos de checkout sí guardan, del lado del servidor, comprador, beneficiario, idioma, productos, moneda y preferencia opcional de marketing. La primera versión puede recuperar compras iniciadas que ya tengan un pedido y un comprador con permiso válido; no permite contactar a visitantes anónimos ni conoce el correo de quien solo añade un producto al carrito.

Para recuperar abandonos anteriores a crear un pedido hace falta incorporar un guardado protegido del carrito después de identificar al cliente y obtener permiso para estos recordatorios. No basta con observar una visita en el embudo estadístico: ese permiso y sus identificadores son distintos del permiso de correo.

## Configuración en administración

- Interruptor general y modo previsualización; desactivado inicialmente.
- Primer recordatorio a los 30 minutos; segundo opcional a las 24 horas. Máximo dos por carrito y un recordatorio por persona en 24 horas, configurables con límites.
- Caducidad del enlace de recuperación, por defecto 7 días; conservación limitada de borradores, por ejemplo 30 días, seguida de purga.
- Asunto, texto y botón en ES/EN, con vista previa móvil y envío de prueba solo a una dirección propia expresamente indicada.
- Segmentación por cuenta/invitado, destino y mínimo de carrito. Solo destinatario comprador; el correo del beneficiario no autoriza marketing.
- Sin descuento automático de entrada. Un cupón opcional posterior debe seguir las restricciones de cuenta, límites y contribución mínima del motor actual. No emitir un descuento nuevo para cada abandono.
- Panel de elegibles, pendientes, enviados, entregados, recuperados, bajas y rebotes. Separar ventas atribuidas de beneficio incremental; no asumir que un clic causó la compra.

## Flujo seguro

1. Detectar inactividad de un carrito guardado o pedido incompleto y comprobar permiso, supresiones, límites y estado de pago.
2. Encolar con una referencia única por carrito y paso. Reservar el trabajo con transacción/lease para evitar duplicados y reintentos simultáneos.
3. Justo antes del envío, verificar de nuevo pago confirmado o en procesamiento, compras posteriores, retirada del permiso, rebotes y quejas. No recordar pagos cuyo resultado sea incierto.
4. Enviar mediante la integración existente con Resend, con idempotencia, remitente propio, identidad de empresa y baja visible/de un clic. Registrar el resultado del proveedor y procesar rebotes/quejas mediante webhook.
5. Un enlace firmado y limitado permite reconstruir únicamente las líneas del carrito. No concede acceso a pedidos, cuentas ni QR. Revalidar publicación, disponibilidad, precios, moneda y cupones al restaurarlo.
6. Crear un checkout nuevo. El recordatorio no reactiva el pedido que venció a los cinco minutos ni reutiliza un PaymentIntent expirado. No se cobra ni se aprovisiona ninguna eSIM por abrir el enlace.
7. Cancelar los pasos restantes al pagar o darse de baja. No mezclar bajas comerciales con correos necesarios de instalación o recuperación de cuenta.

## Consentimiento y correo

La casilla actual está desmarcada por defecto y permite novedades/ofertas; para incorporar recordatorios debe actualizarse de forma clara el texto y la versión del permiso, junto con privacidad. No se reinterpretarán los permisos históricos como una autorización automática de una finalidad nueva. El visitante debe poder comprar sin aceptar recordatorios y retirarlos sin iniciar sesión.

Resend permite enviar por su API con baja gestionada por la aplicación. Para este flujo se requieren el enlace de baja visible y las cabeceras `List-Unsubscribe` y `List-Unsubscribe-Post`, además de un endpoint POST de baja de un clic.

Documentación de referencia:
- https://resend.com/docs/dashboard/emails/add-unsubscribe-to-transactional-emails
- https://resend.com/pricing

## Pruebas antes de activarlo

Consentimiento denegado/retirado, comprador distinto del beneficiario, pago completado justo antes del envío, pago pendiente o incierto, rebote/queja, webhook y cron duplicados, enlace caducado/manipulado, SKU retirado, precio actualizado, moneda distinta, cupón no aplicable, dos pestañas, y restauración en móvil. Stripe/eSIM Access se simulan en automatización; no se realizan cargos ni emisiones reales.
