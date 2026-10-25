# Catálogo de Stripe: fase de pruebas

Este paso prepara los productos y precios. No activa pagos, no crea sesiones de Checkout, no compra eSIM y no modifica la web de producción.

## Preparación

1. En Stripe, selecciona el entorno de pruebas de MyTripSim. Obtén su clave secreta de pruebas. También se admite una clave restringida de pruebas con lectura y escritura de Products y Prices.
2. Ejecuta `npm.cmd run stripe:configure` desde la carpeta del proyecto. La entrada está oculta y se guarda únicamente en `.env.local`, ignorado por Git. Nunca pegues claves en el chat. Se rechazan claves de producción y claves públicas.
3. Ejecuta `npm.cmd run stripe:preview`. Lee los planes publicados y precios finales de Supabase cuando está configurado; un fallo remoto detiene el proceso. Sin configuración utiliza el catálogo incluido en el repositorio.
4. Revisa `private-data/stripe/catalog.csv` y `catalog.json`. Los importes `unitAmount` están en **centavos USD** (900 significa USD 9,00). Son archivos de revisión; no requieren un importador CSV externo.
5. Ejecuta `npm.cmd run stripe:sync:test` para sincronizar mediante la API oficial. Comprueba el catálogo en el mismo entorno de Stripe. `private-data/stripe/test-bindings.json` contiene la relación plan/producto/precio para ese entorno y cuenta.

## Comportamiento

Un producto por ID de plan, con destino, GB, días y nombre de variante. Un precio de pago único por importe en USD. Los campos se proyectan explícitamente: no se importan costes del proveedor, márgenes ni columnas arbitrarias.

Los productos usan un ID determinista y los precios una clave de búsqueda por plan e importe. Se verifican las identidades existentes antes de escribir. Se pueden repetir importaciones y reanudar fallos parciales; los conflictos o elementos archivados detienen el proceso. Se procesan hasta cuatro planes en paralelo; ante un fallo se detiene la programación de nuevos planes y se espera a que terminen las operaciones en curso. Si cambia un precio se crea otro precio y se actualiza el predeterminado, conservando el anterior para el historial. No se borran ni archivan elementos automáticamente. No ejecutes dos sincronizaciones a la vez.

Las claves de pruebas sólo se usan en este comando local. No se suben a Vercel ni se exponen al navegador. Los archivos generados no contienen claves y se guardan fuera de Git. El comando imprime resúmenes; nunca errores completos del SDK.

## Siguiente fase

La importación de pruebas está verificada. Los enlaces privados, pedidos con múltiples líneas, invitados, Checkout y webhooks se describen en [Stripe Checkout](./stripe-checkout.md). Sólo un pago confirmado podrá iniciar la emisión y entrega de eSIM en una futura fase de producción. Los IDs de pruebas no sirven en producción; ésta necesitará una sincronización y configuración independientes.

Referencias oficiales: [gestión del catálogo](https://docs.stripe.com/products-prices/manage-prices), [productos](https://docs.stripe.com/api/products/create), [precios](https://docs.stripe.com/api/prices/create), [idempotencia](https://docs.stripe.com/api/idempotent_requests).
