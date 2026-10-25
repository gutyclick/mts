# Administración privada

Entrada: `/es/admin` o `/en/admin`. La cuenta autorizada encuentra también «Abrir administración» en Mis eSIM. Se utiliza el inicio de sesión normal, sin otra contraseña. Las rutas antiguas de administración de muestra redirigen al acceso protegido; se retiró el enlace público del pie de página.

## Funciones

- Resumen de usuarios, planes en uso, eSIM listas para instalar, atención y ventas reales. Los importes de Stripe test no se suman como ingresos. La emisión real autorizada para QA se identifica de forma independiente.
- Usuarios con búsqueda por correo/nombre y filtro de planes activos; acceso a los planes del cliente seleccionado.
- Planes con estado, datos disponibles, duración, fecha de consulta y entorno. Pedidos paginados con estados y cantidades.
- Atención por entrega en revisión, suspensión, pocos datos, vencimiento próximo o seguimiento manual abierto.
- Consulta individual de estado/consumo a eSIM Access. No compra, suspende, recarga, cancela ni envía mensajes. Actualiza también el estado conocido en Mis eSIM. El [proveedor documenta un retraso de 2–3 horas en consumo](https://docs.esimaccess.com/); la fecha de consulta y la fecha de consumo son distintas.
- Notas internas de hasta 1.000 caracteres y marca de revisado por eSIM. Guardar un seguimiento no modifica el pedido ni corrige por sí solo una alerta automática.

## Acceso y protección

`admin_memberships` concede acceso mediante UUID de una cuenta confirmada. No se confía en nombres, correos enviados desde el cliente ni metadatos de perfil editables. La sesión y la membresía se verifican en cada API. Las consultas privilegiadas sólo se ejecutan después de esa comprobación. La membresía propia se puede leer mediante RLS; ningún cliente puede añadir o modificar roles.

Las APIs son privadas y sin caché. Las escrituras comprueban el origen y validan tamaño y campos. Las consultas paginadas devuelven exclusivamente una proyección explícita: no incluyen contraseñas, tokens, claves, QR, códigos de activación ni referencias privadas de Stripe/proveedor. Las funciones SQL sólo se conceden a `service_role` y vuelven a comprobar al administrador indicado por el servidor.

Las consultas al proveedor tienen bloqueo temporal y un minuto de espera entre comprobaciones; un resultado fallido conserva los datos anteriores. Las actualizaciones de estado y su copia en Mis eSIM son atómicas. Las notas y las comprobaciones quedan registradas en `admin_audit`. La UI no permite eliminar usuarios, conceder roles, emitir planes o efectuar reembolsos.

## Operación

Aplicar las migraciones `20261025001100` y `20261025001200`. Desde una terminal autorizada, `npm.cmd run admin:grant -- --email CORREO_DEL_PROPIETARIO` concede acceso a una cuenta existente y confirmada usando la clave privada local. El script no crea cuentas, cambia contraseñas ni envía correos. Las altas adicionales deben revisarse fuera de la UI. Eliminar la fila de membresía revoca el acceso en la siguiente petición.

## Verificación

`npm.cmd run test:admin` comprueba la autorización, RLS, imposibilidad de autoconcederse permisos, proyecciones sin secretos, filtros literales, separación de ingresos test y actualizaciones con token de bloqueo. Las pruebas Playwright comprueban el acceso anónimo y las rutas antiguas. La comprobación privada de integración usa una cuenta temporal, verifica que `user_metadata.role=admin` no concede permisos, prueba datos, búsqueda, consulta real del proveedor, notas, móvil/escritorio y revocación, y elimina sus propias cuentas y registros de prueba. No emite eSIM ni envía mensajes.
