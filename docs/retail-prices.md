# Precios finales, variantes e imágenes

Los 1.730 precios de venta en USD fueron autorizados por el propietario mediante su CSV de precios finales. La importación toma únicamente ID, cantidad de datos y duración para verificar identidad, y `Precio final (USD)` como importe público. No importa costes del proveedor, márgenes, comisiones, contribuciones ni notas de publicación del archivo. El CSV original permanece fuera del repositorio.

```powershell
npm.cmd run prices:import -- C:/ruta/privada/MyTripSim_Planes_Con_Precios_Finales.csv
npm.cmd run prices:sync
```

La importación exige una fila por cada plan, sin duplicados ni cambios de GB/días, y convierte los importes exactamente a centavos enteros, sin redondear. `src/data/retail-prices.json` solo contiene ID y precio final en centavos. Supabase utiliza la columna pública `catalog_plans.retail_price_cents`; su actualización transaccional está restringida a `service_role`. No se envían claves privilegiadas a Vercel o al navegador para esta operación.

El catálogo, ficha, carrito y checkout muestran el importe correspondiente al identificador exacto, también entre variantes de los mismos GB/días. Los totales se calculan con centavos enteros y cantidad; la falta de precio se muestra como pendiente, nunca como cero. El pago sigue desactivado: mostrar precios no habilita cobros ni emisión.

Las variantes se identifican por su etiqueta real: USIP, nonhkip, Premium, IIJ, MYIP y USIP · FIFA. El plan base se distingue como Estándar cuando hay alternativas. La ficha incluye una explicación accesible por clic, teclado y hover; se cierra con Escape, al pulsar fuera o al desplazar la página. USIP indica salida a internet con IP estadounidense; no modifica la ubicación del dispositivo. La etiqueta FIFA se conserva como aparece en el catálogo, sin atribuirle prestaciones adicionales no verificadas.

Las explicaciones de IP local, multired y salida fuera de Hong Kong se basan en la [clasificación oficial del proveedor](https://esimaccess.com/esim-pricing-coverage/) y su [explicación de nonhkip](https://esimaccess.com/docs/what-are-nonhkip-plans/). No se prometen velocidades mínimas ni acceso garantizado a aplicaciones.

Se incorporaron 30 archivos de destinos y el mapa contiene 60 banners. Los originales se conservan. Las erratas de nombre de archivo de Bulgaria y Bosnia y Herzegovina se asocian explícitamente al destino correcto. Todos los archivos se validaron como imágenes y respondieron correctamente en Vercel antes de activar las nuevas rutas en Supabase. `npm.cmd run sync:images` mantiene el mapa local; la migración de banners actualiza las referencias públicas.

`npm.cmd run test:retail` comprueba proyección sin costes, precisión monetaria, identidad de variantes, permisos y rollback. Los recorridos de navegador comprueban etiqueta, tooltip, precio, cantidad y total, manteniendo los pagos desactivados.
