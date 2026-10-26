# Soporte SIM y tickets

## Recorrido

- El widget naranja abre SIM Help. Ofrece ayuda general a visitantes en el idioma de su consulta (o español, inglés, portugués, francés, alemán e italiano seleccionados).
- Una cuenta confirmada puede seleccionar uno de sus pedidos. El servidor vuelve a verificar el propietario antes de leerlo; no acepta identidades ni destinatarios enviados por el navegador.
- El modelo recibe artículos de `src/lib/help-content.ts` y un resumen del pedido: planes, estado y lecturas guardadas de consumo. No recibe QR, ICCID, códigos de instalación, credenciales de pago ni referencias internas del proveedor. El consumo puede estar desactualizado.
- «Necesito ayuda humana» requiere enviar una consulta explícitamente. Conserva el chat, crea un ticket y detiene las respuestas automáticas de ese hilo.
- El recuadro de ayuda humana tiene un único mensaje y su propio botón «Crear ticket». El asunto se toma de la primera línea de la consulta. Mientras se completa, el compositor del chat queda bloqueado y lo explica. Volver al chat recupera su borrador; un error de envío conserva la consulta y reutiliza la misma petición al reintentar. El enlace de confirmación lleva a la conversación del ticket.
- Perfil: `/es/support` o `/en/support`. Administración: `/es/admin/tickets` o `/en/admin/tickets`; accesible únicamente a miembros administrativos existentes.
- Los clientes pueden responder y marcar resuelto. Una respuesta del equipo cambia a «Respuesta del equipo»; una respuesta posterior del cliente reabre el ticket. Los mensajes anteriores se conservan.

## Correo

Los avisos de consultas nuevas y respuestas de clientes van a **hello@mytripsim.com**. Las respuestas del equipo generan un aviso al correo confirmado del titular de la cuenta. Los mensajes se responden desde la web para mantener el historial; este sistema no ingiere respuestas recibidas directamente por email.

Resend recibe sólo el asunto y un enlace privado al ticket, sin transcripción ni datos de instalación. La cola conserva estado pendiente/enviado/fallido. «Enviado» significa aceptado por Resend, no prueba de lectura ni entrega en bandeja. En administración se muestra el último estado de notificación.

El trabajador procesa dos avisos por invocación, usa claves estables de idempotencia y reintenta dentro de 23 horas, con un máximo de 12 intentos. Las tareas con resultado incierto quedan fallidas para revisión. No se deben reenviar manualmente sin revisar el registro en Resend. Supabase invoca el trabajador cada 30 segundos con un ticket firmado de un solo uso, reutilizando la infraestructura privada del checkout.

## Configuración

```powershell
npm.cmd run support:configure
npm.cmd run support:deploy-env
# Aplicar migraciones, desplegar y verificar que la bandeja exista antes de activar:
npm.cmd run support:start
```

La entrada de OpenAI está oculta y se guarda en `.env.local`, ignorado por Git. El despliegue configura secretos de servidor en Vercel; ninguna clave se incluye en variables `NEXT_PUBLIC`. Se reutilizan Supabase y la clave de envío de Resend ya configuradas. La bandeja oficial se define en `support_settings`, accesible sólo al servidor.

Modelo fijado: `gpt-5.4-mini-2026-03-17`, Responses API, salida estructurada, sin herramientas y con `store:false`. Esto no equivale a retención cero: OpenAI puede conservar datos para supervisar abusos. La interfaz avisa del uso de IA y de no compartir datos sensibles. La redacción de texto es una protección adicional y no reemplaza esa recomendación. El aviso de privacidad describe los servicios utilizados; la política comercial definitiva sigue pendiente de revisión.

Límites: 12 consultas por hora para visitantes, 60 para cuentas, 300 globales por día por defecto; 5 tickets nuevos y 40 escrituras por cuenta/hora. Las cuotas de visitantes usan un hash de la dirección de red, no su valor original. No hay analítica publicitaria añadida.

## Validación

`npm.cmd run test:support` verifica permisos SQL/RLS, aislamiento, transición a soporte, idempotencia, bloqueo de respuestas tardías, destinatarios, cuotas y leases de notificación. También verifica redacción, transporte de IA, referencias permitidas y escapes del correo.

`npm.cmd run test:support:web` usa cuentas y pedidos temporales contra Supabase y un servidor local en el puerto 3008 (`SUPPORT_TEST_BASE` permite cambiarlo). Comprueba el recorrido y accesibilidad móvil/escritorio. Antes de crear fixtures verifica que el trabajador esté detenido; si está activo, rechaza la prueba y exige una base aislada. Las notificaciones de prueba se eliminan al finalizar. No se solicita ninguna eSIM ni se realiza ningún pago.

No hay promesas automáticas de reembolso ni modificaciones de pedidos. La IA sólo orienta; las incidencias comerciales se escalan al equipo.

## Verificación en producción — 25 de octubre de 2026

- Publicados el widget, las APIs privadas y las vistas de perfil y administración. OpenAI respondió desde Vercel con referencias aprobadas. Comprobadas respuestas en español, inglés y portugués, y rechazo de solicitudes de datos ajenos o reembolsos inventados.
- Pruebas SQL de soporte: 5 aprobadas. Administración: 3 aprobadas. Catálogo/carrito: 18 aprobadas. Prueba real de cuentas aprobada sin enviar correos. Recorrido web de soporte aprobado en escritorio/móvil, incluidas comprobaciones de accesibilidad, continuidad del chat, propietarios, cierre/reapertura y destinatarios de la cola.
- Build de Next.js, tipos, lint de los cambios, formato y escaneo de secretos aprobados. Las cuentas y pedidos temporales se eliminaron; permanece únicamente el ticket de verificación del propietario.
- Probados el trabajador y su invocación firmada desde Supabase. El reintento de la misma notificación conservó el mismo ID de Resend, sin generar otro correo.
- La primera prueba fue rechazada por Zoho con **550 5.1.1 User does not exist** para `hello@mytripsim.com`; se pausaron los avisos conservando la cola. Después de que el propietario confirmó la creación de la bandeja, se retiró únicamente la supresión producida por ese rebote y se realizó una nueva prueba.
- **Entrega final confirmada por Resend (`delivered`) a `hello@mytripsim.com`**, con enlace privado correcto al ticket. La tarea automática procesó la notificación en un solo intento. `support_settings.delivery_enabled=true` y el programador están activos. El ticket de verificación está resuelto y conserva ambos resultados. No se borró ni se reintentó automáticamente el aviso anterior fallido.

Referencias: [Responses y datos de OpenAI](https://developers.openai.com/api/docs/guides/your-data), [salidas estructuradas](https://developers.openai.com/api/docs/guides/structured-outputs), [modelo](https://developers.openai.com/api/docs/models/gpt-5.4-mini).
