# Integración de eSIM Access

Conexión servidor verificada el 24 de octubre de 2026: 1.731 planes fijos del proveedor, 1.730 planes publicados y 1.730 coincidencias exactas por alias, datos y duración. No hay conflictos ni planes publicados ausentes. El plan nuevo no se publica automáticamente.

## Credenciales

```powershell
npm.cmd run provider:configure
npm.cmd run provider:check
```

El primer comando solicita AccessCode y SecretKey con entrada oculta y actualiza `.env.local`, excluido de Git. El cliente firma el cuerpo exacto con HMAC SHA-256. El destino HTTPS está fijado en código; no sigue redirecciones. Las respuestas tienen límite de tamaño y tiempo. Los errores no incluyen credenciales, mensajes privados del proveedor ni cuerpos de respuesta.

`npm.cmd run provider:deploy-env` configura `ESIM_ACCESS_CODE`, `ESIM_ACCESS_SECRET_KEY` y el token independiente `ESIM_ACCESS_SYNC_SECRET` como secretos de producción en el proyecto `mts` de Vercel. Los valores viajan por stdin a la CLI autenticada, no como argumentos. No se configuran en previews ni en variables `NEXT_PUBLIC_*`. Volver a desplegar después de rotarlos. El token de comprobación se genera localmente; no debe incluirse en URLs ni compartirse en el chat.

## Mapeo del catálogo

```powershell
npm.cmd run provider:sync
```

Requiere la CLI de Supabase autenticada. Obtiene el cliente privilegiado únicamente en memoria, para invocar una operación transaccional de sincronización; esa credencial no se guarda ni se instala en Vercel. Las migraciones `20261024000300_provider_bindings.sql` y `20261024000400_provider_safe_refresh.sql` crean la tabla privada `provider_package_bindings` y la operación restringida a `service_role`.

La sincronización cruza el alias exacto con el identificador publicado y valida GB/MB, duración y cobertura de país. No hace asociaciones por parecido de nombres. Los errores de identidad bloquean la operación. Un fallo revierte la actualización completa. Las referencias retiradas quedan marcadas como no disponibles dentro del mapeo privado; el catálogo público no se modifica automáticamente. Los códigos internos no se entregan al navegador.

Se solicitan productos BASE de datos fijos y también se filtra el resultado por `dataType=1`. La proyección elimina costes, precios sugeridos y otros campos comerciales antes de guardar o devolver datos. El informe local `.supabase/esimaccess-catalog-report.json` queda fuera de Git.

## Comprobación en Vercel

`POST /api/internal/esim-access/check` requiere `Authorization: Bearer` con el token interno independiente. Solo devuelve recuentos del catálogo y coincidencias, con `no-store`. No acepta filtros, códigos de cliente o referencias de eSIM. Las peticiones anónimas son rechazadas antes de consultar al proveedor. No es un proxy público de la API.

## Perfiles, consumo y emisión

El adaptador también puede consultar perfiles de un pedido concreto y consumo por identificador de transacción del proveedor. Rechaza perfiles o consumos que no pertenezcan a las referencias solicitadas. Interpreta el código LPA para generar nuestro QR local; no descarga QR desde URLs externas. Estas operaciones no tienen rutas públicas y el futuro trabajador debe comprobar propiedad antes de actualizar una cuenta.

La compra idempotente, la consulta de asignación y el envío con Resend están implementados en la [cola de emisión y entrega](esim-fulfillment.md). Los pagos públicos siguen en Stripe test y no emiten productos reales automáticamente. Se verificó una única eSIM real de Panamá 100 MB/7 días con autorización privada expresa, entrega confirmada por correo y acceso en Mis eSIM. No se implementaron recargas, cancelaciones del proveedor ni cambios de su webhook global. La actualización periódica de consumo queda pendiente; el consumo del proveedor puede llegar con retraso y no debe presentarse como tiempo real.

## Pruebas

`npm.cmd run test:provider` comprueba firma exacta, proyección sin precios, rechazo de planes diarios y respuestas defectuosas, errores sin secretos, identidad de planes, perfiles limitados al pedido, consumo limitado a las referencias solicitadas, permisos privados y rollback. La consulta real del catálogo y el mapeo privado se han verificado sin emitir productos.

Fuentes: [documentación oficial de eSIM Access](https://docs.esimaccess.com/) y [notificaciones del proveedor](https://esimaccess.com/docs/what-webhook-notifications-do-you-send/).
