# Cuentas y Mis eSIM

## Diseño y alcance

Registro con correo y contraseña, confirmación de correo, acceso, cierre de sesión y recuperación. Supabase Auth mantiene las credenciales; Next.js utiliza sesiones SSR con cookies HttpOnly y verifica al usuario en el servidor. Se conserva ES/EN y la interfaz actual: tarjeta de acceso clara, SIM como acompañante y controles cómodos en móvil.

Mis eSIM pasa a ser un área privada con pedidos, eSIM e instrucciones reales. Una cuenta nueva empieza vacía. El catálogo, la guía general y el checkout de muestra siguen siendo públicos. No se generan compras, consumos ni códigos ficticios en cuentas reales. Pagos y emisión automática del proveedor quedan fuera de esta etapa.

## Implementación

1. Clientes SSR y renovación de cookies en Proxy; acciones de registro, acceso, recuperación, nueva contraseña y salida. Rutas localizadas y redirecciones limitadas al área privada.
2. Tablas de pedidos/eSIM con propiedad inmutable para clientes y RLS. Solo el servidor de aprovisionamiento futuro podrá escribir. Referencia compuesta entre eSIM y pedido para impedir mezclar propietarios.
3. Área privada: listas, detalle, QR generado localmente a partir de los datos reales, instalación manual, instrucciones y estado vacío. Las credenciales de instalación se consultan únicamente para la eSIM solicitada por su propietario.
4. URLs y plantillas de Supabase Auth. Los correos públicos requieren SMTP propio; no se desactiva la confirmación como sustituto.
5. Verificar acceso anónimo, dos cuentas aisladas, códigos privados, sesión y salida, enlaces de confirmación/recuperación usados o caducados, redirecciones y móvil. No enviar correos a destinatarios de prueba ni guardar credenciales de QA en Git.

## Seguridad

- Ninguna contraseña o token se incluye en URLs de formularios, logs o mensajes de error. Los enlaces de correo contienen tokens de un solo uso y terminan en una redirección a una URL limpia.
- Los formularios usan acciones servidor con comprobación de origen de Next.js. Registro y recuperación usan respuestas que no revelan si un correo ya existe.
- Las páginas con sesión y las rutas de autenticación no se cachean ni se indexan. No hay cliente privilegiado en las rutas de la aplicación.
- Los pedidos no incorporan precios en esta etapa. No hay permisos INSERT/UPDATE/DELETE para clientes en pedidos o eSIM.
- No se autentica con `getSession()`; se comprueba la identidad mediante `getUser()` antes de consultar información privada.

## Correo y verificación

Resend tiene `mytripsim.com` verificado con envío habilitado y seguimiento de clics desactivado. Supabase utiliza SMTP TLS, el remitente `MyTripSim <cuentas@mytripsim.com>` y una credencial restringida al envío desde ese dominio. La credencial no se instala en Vercel ni en el navegador. Las plantillas de confirmación y recuperación están localizadas y sus enlaces caducan en una hora.

`npm run test:supabase` comprueba RLS, permisos de escritura, propiedad de pedidos y redirecciones. `npm run test:accounts` requiere una CLI de Supabase autenticada: crea cuentas desechables, verifica acceso, cookies HttpOnly, dos propietarios aislados, QR privado, cierre de sesión, cuenta vacía, confirmación y recuperación con enlaces de un solo uso. Limpia las cuentas al terminar y no envía correos. Para producción, establecer `ACCOUNTS_TEST_BASE=https://www.mytripsim.com`.

Las pruebas cubren escritorio y móvil; la auditoría de cuentas comprueba accesibilidad automática y anchuras de 320 a 1440 px. Queda pendiente comprobar la entrega en una bandeja real con un registro del propietario. No se han enviado mensajes a terceros durante las pruebas.

Verificación del 24 de octubre de 2026: versión `685ba3d` publicada en `https://www.mytripsim.com`. El recorrido completo de cuentas pasó en producción, la conexión SMTP TLS autenticó correctamente y el asesor de seguridad de Supabase no encontró incidencias. Las cuentas desechables quedaron eliminadas (consulta de limpieza: cero restantes). Registro y recuperación responden con `no-store` y `noindex`; Mis eSIM redirige a acceso cuando no hay sesión.
