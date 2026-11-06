# Publicación del catálogo y tarifas — 6 de noviembre de 2026

## Alcance aprobado

355 ajustes de precios por `plan_id`, con importes enteros en USD, selector de GB/días/variante y descubrimiento de 11 familias regionales en lugar de 39 entradas. Europa selecciona EU-33 (incluye Francia); Asia selecciona AS-14 por precio, sin afirmar cobertura de China continental o Singapur.

Los precios proceden del CSV aprobado, identificado por SHA-256 en `src/data/catalog-preview-prices.json`. El fichero contiene únicamente precios de venta anteriores/propuestos; nunca costes del proveedor. El catálogo público y el carrito leen las tarifas de Supabase. El fichero de tarifas incluido en el repositorio se actualiza como respaldo.

## Publicación financiera

`scripts/release-coherent-prices.mjs` verifica el precio anterior, identidad del proveedor y coste actual de todos los cambios antes de preparar precios inmutables en Stripe. Reutiliza `apply_commercial_price_revision` para cambiar catálogo y referencias Stripe de pruebas/producción en una sola transacción. No ejecuta migraciones ni modifica costes, publicaciones o pedidos.

Campaña: `coherence-2026-11-06-approved`. Trazabilidad en `commercial_price_revision_batches` y `pricing_campaign_changes`. La comprobación posterior preservó los 25 registros históricos de artículos existentes antes del cambio. No se realizaron compras ni emisiones de prueba.

La contribución mínima calculada de los productos ajustados es 28,85%, presupuestando conversión 5,4%, fijo USD 0,30, Radar USD 0,05 y afiliado 8%. No incluye cupón, cashback, impuestos absorbidos, costes fijos o devoluciones; las promociones requieren su validación independiente. No constituye garantía de beneficio neto.

## Selector y protección comercial

Producción presenta todas las combinaciones estándar reales de GB/días con identidad técnica y disponibilidad registradas. Las modalidades especiales conservan las aprobaciones comerciales y los SKU que ya superaban la selección anterior. No se publican automáticamente modalidades pendientes.

Los enlaces y carritos antiguos conservan la identidad/cobertura exacta, aunque sus familias ya no aparezcan en el descubrimiento. No se sustituyen silenciosamente por otro SKU. La previsualización local puede mostrar combinaciones pendientes para revisión, pero permanece bloqueada para pagos y nunca se activa en Vercel/CI.

## Recuperación

La evidencia privada se conserva en `private-data/pricing-audit/release-2026-11-06/`: estado previo, referencias de precios antiguas/nuevas, resultado de publicación, verificación histórica, CSV aplicado y `rollback-bindings.json`. El payload de reversión no se ejecutó. Para revertir, verificar primero el estado actual y usar una campaña nueva con la misma operación atómica; conservar el registro original y los precios Stripe antiguos. No modificar pedidos históricos ni borrar el libro de cambios.

La reversión del código en Vercel es independiente de la de tarifas. Desactivar el indicador local ya no revierte los precios publicados.

## Verificación y despliegue

Publicación desde una copia aislada del último commit con solo los archivos de esta tarea, excluyendo cambios de imágenes, analítica y entrega que estaban pendientes en el directorio compartido. Se conservan las claves exclusivamente en el entorno del servidor y en el fichero local ignorado.

El SKU MY_20_15_myip continúa pendiente de verificación del proveedor según la auditoría anterior; no forma parte de estos 355 cambios. Tampoco se añade aquí un control universal de margen al checkout ordinario: esa mejora sigue siendo una tarea separada.
