# Soporte SIM y tickets

## Recorrido

- El widget naranja abre SIM Help. Ofrece ayuda general a visitantes en el idioma de su consulta (o español, inglés, portugués, francés, alemán e italiano seleccionados).
- Una cuenta confirmada puede seleccionar uno de sus pedidos. El servidor vuelve a verificar el propietario antes de leerlo; no acepta identidades ni destinatarios enviados por el navegador.
- El modelo recibe artículos de `src/lib/help-content.ts` y un resumen del pedido: planes, estado y lecturas guardadas de consumo. No recibe QR, ICCID, códigos de instalación, credenciales de pago ni referencias internas del proveedor. El consumo puede estar desactualizado.
- «Necesito ayuda humana» requiere enviar una consulta explícitamente. Conserva el chat, crea un ticket y detiene las respuestas automáticas de ese hilo.
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
# Aplicar migraciones y desplegar antes de activar el trabajador:
npm.cmd run support:start
```

La entrada de OpenAI está oculta y se guarda en `.env.local`, ignorado por Git. El despliegue configura secretos de servidor en Vercel; ninguna clave se incluye en variables `NEXT_PUBLIC`. Se reutilizan Supabase y la clave de envío de Resend ya configuradas. La bandeja oficial se define en `support_settings`, accesible sólo al servidor.

Modelo fijado: `gpt-5.4-mini-2026-03-17`, Responses API, salida estructurada, sin herramientas y con `store:false`. Esto no equivale a retención cero: OpenAI puede conservar datos para supervisar abusos. La interfaz avisa del uso de IA y de no compartir datos sensibles. La redacción de texto es una protección adicional y no reemplaza esa recomendación. El aviso de privacidad describe los servicios utilizados; la política comercial definitiva sigue pendiente de revisión.

Límites: 12 consultas por hora para visitantes, 60 para cuentas, 300 globales por día por defecto; 5 tickets nuevos y 40 escrituras por cuenta/hora. Las cuotas de visitantes usan un hash de la dirección de red, no su valor original. No hay analítica publicitaria añadida.

## Validación

`npm.cmd run test:support` verifica permisos SQL/RLS, aislamiento, transición a soporte, idempotencia, bloqueo de respuestas tardías, destinatarios, cuotas y leases de notificación. También verifica redacción, transporte de IA, referencias permitidas y escapes del correo.

`npm.cmd run test:support:web` usa cuentas y pedidos temporales contra Supabase y un servidor local en el puerto 3008 (`SUPPORT_TEST_BASE` permite cambiarlo). Comprueba el recorrido y accesibilidad móvil/escritorio. Antes de crear fixtures verifica que el trabajador esté detenido; si está activo, rechaza la prueba y exige una base aislada. Las notificaciones de prueba se eliminan al finalizar. No se solicita ninguna eSIM ni se realiza ningún pago.

No hay promesas automáticas de reembolso ni modificaciones de pedidos. La IA sólo orienta; las incidencias comerciales se escalan al equipo.

Referencias: [Responses y datos de OpenAI](https://developers.openai.com/api/docs/guides/your-data), [salidas estructuradas](https://developers.openai.com/api/docs/guides/structured-outputs), [modelo](https://developers.openai.com/api/docs/models/gpt-5.4-mini).
