# Reestructuración del catálogo — revisión local

Estado posterior: el 6 de noviembre se aprobó completar la publicación. Véase [registro de publicación](catalog-release-2026-11-06.md). Las notas siguientes describen la fase local previa; desactivar su indicador ya no revierte las tarifas publicadas.

## Precios aprobados — 6 de noviembre de 2026

La propuesta de coherencia de 355 precios se aplica exclusivamente con la vista local habilitada. `src/data/catalog-preview-prices.json` contiene solo `plan_id`, precio anterior y propuesto, más fecha de instantánea y hash del CSV aprobado; no contiene costes mayoristas. `getPublishedPlans` alimenta tanto las fichas como el carrito con esos precios. Si el precio de origen cambió desde la aprobación, la vista falla explícitamente en vez de sobrescribir una tarifa nueva sin revisión.

Brasil 3 GB/15 días conserva USD 8 y 3 GB/30 días muestra USD 10. La copia privada `private-data/pricing-audit/propuesta_aprobada_local.csv` conserva el cambio autorizado y los precios anteriores. Para revertir la visualización basta desactivar `CATALOG_REDESIGN_PREVIEW`; no hay cambios de base de datos que revertir. Vercel y CI ignoran siempre este interruptor.

La creación de sesiones de pago está bloqueada en esta vista: las tarifas aprobadas aún no están sincronizadas en Supabase/Stripe. El mensaje de bloqueo está traducido a ES/EN y solo puede activarse localmente. No se ejecutó ningún pago, migración, cambio mayorista o despliegue.

Ejecutar `npm.cmd run dev:catalog`. La vista queda en http://127.0.0.1:3004/es/destinos; ejemplo de selector: http://127.0.0.1:3004/es/esim/japan?plan=JP_3_15.

## Cambios

- Se muestra una sola familia por región: 11 entradas frente a las 39 originales. Se ocultan del descubrimiento las rutas combinadas y subregiones adicionales. Europa usa EU-33 (incluye Francia); Asia usa AS-14, priorizando precio. No se mezclan coberturas ni SKU.
- El selector agrupa por GB, muestra «Desde N días» y permite elegir las duraciones reales. Los paquetes pequeños están en un desplegable. Se conservan las estancias largas.
- Los interruptores de variantes son excluyentes: cada selección cambia al SKU correspondiente, con su precio, operadores y activación. Se muestran únicamente variantes existentes para esos GB y días. No se suman eSIM ni cargos ficticios.
- El precio cambia con la tarifa registrada de la combinación. No se prorratean precios ni se modifican tablas comerciales.
- El resumen móvil respeta la navegación inferior y el botón de soporte. Se probaron móvil de 390px, escritorio, EN/ES y adición al carrito del SKU correcto; el producto de la comprobación se retiró después, sin pedido ni pago.

## Límites antes de publicar

La oferta actual no tiene 15 días para todos los GB. Por ejemplo, Japón tiene 3 GB/15 días pero no 10 GB/15 días. Esas combinaciones se muestran desactivadas; habilitarlas requiere un paquete real del proveedor y su tarifa aprobada. En Europa elegida, 3 GB/15 días cuesta USD 4 y 3 GB/30 días USD 5 según el registro consultado.

Esta vista permite revisar las variantes disponibles; no cambia las aprobaciones comerciales de modalidades en producción. Antes de publicarlas deben confirmarse sus condiciones y elegibilidad.

Las coberturas regionales no son equivalentes. Asia elegida cubre 14 zonas y prioriza precio: 10 GB/30 días a USD 13 frente a USD 26 de AS-20. No incluye China continental ni Singapur. Europa EU-33 incluye Francia; EU-35 la omite en el registro y por eso ya no es la seleccionada. Sudamérica propuesta cubre seis zonas, frente a veinte de otra opción. Golfo elegido incluye Irak y no Omán; GCC incluye Omán y no Irak. Revisar estas diferencias antes de retirar ofertas en producción. La [comparativa completa](catalog-regional-review.md) y `reports/catalog-regional-review.csv` dejan el criterio y los precios visibles para revisión.

La activación exige `CATALOG_REDESIGN_PREVIEW=true` y se bloquea en Vercel/CI. No se desplegó código, no se ejecutaron migraciones ni se cambiaron precios, publicaciones, pedidos o costes mayoristas en producción. La consulta al proveedor fue de solo lectura.

Pruebas: selector exacto GB/días/variante, ausencia de combinaciones inventadas, enlaces antiguos, aislamiento de producción, precios deterministas y consolidación regional. Lint, TypeScript y compilación de Next.js verificados.

Actualización 6 de noviembre de 2026: la política de selección v2 sustituye las decisiones de la comparativa anterior donde difieran. Solo local; los enlaces antiguos conservan su ficha y cobertura originales para no sustituir silenciosamente un producto.
