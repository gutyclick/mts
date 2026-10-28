# Revisión móvil, proveedor y Search Console — 27 octubre 2026

Fecha local: America/Panama. Revisión de producción mediante sesión autenticada; proveedor consultado en modo de solo lectura. No se emitieron eSIM, enviaron mensajes ni modificaron saldos, catálogo o pedidos.

## Móvil

- Resumen real de Mis TripSim revisado a 390 px: nivel Viajero, saldo disponible y acceso a la billetera legibles; sin desbordamiento horizontal.
- Billetera: saldo disponible, pendiente, nivel, progreso e historial vacío presentes. La cuenta revisada tiene saldo cero; no se certifican visualmente estados con saldo elevado, pendientes o Legend a partir de esta sesión.
- A 320 px se reprodujo un desbordamiento de cabecera: ancho de documento 339 px. Causa: logo de ancho fijo junto a controles de idioma, carrito y menú.
- Corrección local: el contenedor del logo admite contracción bajo 380 px y la imagen respeta su ancho. Se mantienen los controles táctiles. Comprobación local posterior: sin desbordamiento horizontal a 320 px. Esta corrección no está publicada.

## Proveedor

Consulta actual de `package/list`, exclusivamente lectura, a las 20:16 del 27 de octubre en Panamá:

| Campo | Europa 20 GB / 90 días |
| --- | --- |
| slug | EU-42_20_90 |
| duration / durationUnit | 90 / DAY |
| activeType | 2: primera conexión a red |
| unusedValidTime | 180 |
| APN en respuesta de catálogo | Ausente |
| destinos de red | 41 |

Los 90 días de uso comienzan al conectarse a una red admitida. Los 180 días sin activar son otro plazo, no días adicionales de datos. La FAQ del proveedor declara actualmente 180 días antes de activar y su anuncio de producto los cuenta desde la compra. Para una eSIM concreta debe utilizarse la caducidad del perfil emitido y su estado; no calcular una fecha contractual únicamente a partir de un CSV antiguo.

El contrato API ofrece `apn` y `expiredTime` en `esim/query`. Un `expiredTime` debe interpretarse con el estado y la activación del perfil; no confundir caducidad sin usar con fin del período activo.

El proveedor explica que muchos APN se configuran automáticamente. En caso de configuración manual debe utilizarse el APN de la eSIM concreta. Su guía general menciona `vmobile.jp` para Japón, pero no prueba que corresponda a todas las variantes actuales. No se modificó `drei.at` ni se presentó como operador o red europea.

**Pendiente específico:** confirmar el APN de EU-42_20_90 y el operador de origen con el proveedor, o consultar ese dato en un perfil europeo ya emitido. No se compró un perfil para despejar esta duda. Pregunta preparada en `provider-questions-2026-10-27.md`.

Fuentes primarias:
- https://docs.esimaccess.com/
- https://esimaccess.com/faq/
- https://esimaccess.com/product-updates-for-august/
- https://esimaccess.com/docs/what-is-apn-in-esim/
- https://esimaccess.com/docs/what-are-the-apn-settings/
- https://esimaccess.com/docs/when-does-the-billing-period-validity-start-to-count/

## Search Console

Propiedad: sc-domain:mytripsim.com. Lectura directa de informes autenticados.

- Rendimiento: rango seleccionado 3 meses, pero el gráfico solo dispone del 25 de octubre de 2026; 0 clics y 0 impresiones, tabla sin consultas. La posición 0 mostrada no es una posición real: no hay impresiones que permitan evaluar ranking.
- Indexación agregada: aún procesando datos. No se dispone de un total fiable de páginas indexadas.
- Sitemap: Correcto; enviado y leído el 26 de octubre; 508 páginas descubiertas. Descubiertas no significa indexadas. No se reenvió el sitemap.
- HTTPS: 20 URL HTTPS, 0 no HTTPS, sin problemas críticos; última actualización 26 de octubre. No equivale a 20 páginas indexadas.
- Rutas de exploración: resumen de 7 válidas y 0 no válidas.
- Inspección individual: `/es/esim/japan`, `/es/esim/united-states` y `/es/esim/panama`: **URL en Google / página indexada**, HTTPS y 1 Breadcrumb válido en cada ficha. Las tres estaban descubiertas sin indexar en la revisión del 26 de octubre. No se repitieron solicitudes.
- Core Web Vitals: sin datos de campo para móvil y ordenador en el resumen.

Siguiente evaluación: esperar datos de consultas/impresiones para priorizar contenido por demanda real. No se cambian palabras clave a ciegas ni se promete ranking por estar indexado.
