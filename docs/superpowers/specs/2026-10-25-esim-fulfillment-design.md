# Emisión y entrega de eSIM

## Alcance autorizado

Stripe confirma el pago; MyTripSim emite cada eSIM, guarda el QR y los datos de instalación y envía un correo transaccional al beneficiario. Las cuentas lo encuentran en Mis eSIM; los invitados reciben un enlace privado sin registro. Se conserva la UI ES/EN existente. No se activan cobros live como parte de este cambio.

## Decisiones

Se utiliza una cola persistente en Supabase y un worker en Vercel, con Cron y solicitudes firmadas de un solo uso. Hacer la compra dentro del webhook de Stripe mezclaría confirmación y emisión y haría frágiles los reintentos; depender sólo de notificaciones del proveedor no resolvería caídas ni correos fallidos. El webhook sólo registra el pago: un trigger en la misma transacción crea las unidades pendientes. Una unidad corresponde a una eSIM y a una transacción determinista del proveedor.

La API de eSIM Access devuelve el perfil; el envío lo realiza MyTripSim mediante Resend, con QR generado localmente, adjunto e instrucciones y enlace privado. No se modifica el webhook global del proveedor: la cola consulta sus pedidos concretos. No se usan URLs de QR externas ni se publican costes del proveedor.

## Garantías

- Sólo pagos confirmados pueden generar unidades. Las transacciones de Stripe test se registran como omitidas y nunca consumen saldo ni envían correos reales.
- Identificador fijo por unidad en eSIM Access; una respuesta perdida se reintenta con el mismo identificador, nunca uno nuevo. Una compra completada no se repite por un fallo del correo.
- Reservas temporales con token de reclamación, reintentos limitados y errores clasificados sin datos privados. Agotar reintentos exige revisión, no nueva compra automática.
- El perfil debe pertenecer al pedido y plan solicitado. Guardado y publicación en Mis eSIM son atómicos; ICCID y referencias del proveedor son únicas.
- RLS y APIs de propietario para cuentas, cookie privada del checkout para invitados y enlaces de entrega con secreto no enumerable. Los secretos no entran en rutas, logs, Git ni localStorage.
- Idempotencia de Resend y límite de reintento inferior a sus 24 horas; resultado incierto fuera de ese plazo pasa a revisión.
- Una prueba real que consuma saldo y envíe correo requiere destinatario y límite de gasto autorizados; se prepara todo antes de realizarla.

## Validación

Pruebas de estados, reintentos, compra aceptada con respuesta perdida, múltiples unidades, aislamiento entre cuentas e invitados, QR y enlaces privados, HTML escapado, simulación sin efectos externos, migraciones transaccionales, compilación y revisión móvil/escritorio. Verificar configuración de Resend en la cuenta CLI correcta, sin cambiar DNS existentes.
