# Información técnica del proveedor — 2026-10-24

El segundo CSV se utiliza únicamente como fuente de datos complementarios. Se cruzaron sus 3.187 filas con el identificador exacto de los 1.730 planes fijos existentes. Se omiten 1.457 filas ajenas a ese conjunto, incluidos los productos diarios. No se añaden productos, importes ni campos comerciales.

```sh
npm run import:details -- /ruta/privada/Price.csv
```

El CSV original permanece fuera del repositorio; `Price.csv` está ignorado. El importador proyecta una lista explícita de campos públicos en `src/data/plan-details.json`, sin copiar filas completas ni propagar columnas desconocidas. No guarda precios, precios de variantes, ID interno del proveedor, IP de salida ni instrucciones contenidas en columnas adicionales. El archivo no se publica en `public/`; `getPlans` lo une en el servidor y entrega al cliente solo los planes del destino consultado.

## Datos incorporados

- Operadores y tecnología declarada de cada operador, por destino en los regionales.
- Tecnologías declaradas para el plan: 3G, 4G y/o 5G, sin prometer velocidades o señal.
- Códigos de cobertura suministrados, con nombres localizados y banderas locales. El número se calcula de la lista explícita, no del nombre comercial.
- Inicio del plan según `Billing starts`: primera conexión a la red (1.663 planes), instalación (64) o después de la compra (3).
- Compatibilidad con recargas de datos para la misma zona dentro de la vigencia, o ausencia de recarga. No se habilita recarga real.
- APN por producto, visible al desplegar configuración técnica; no se inventan usuarios ni contraseñas.
- Política de uso justo cuando existe: el plan fijo de Canadá 75 GB indica 128 Kbps, sin explicar el momento de aplicación; se señala esa limitación.

La ficha mantiene cobertura, condiciones y selección en una pantalla. Solo los países/redes regionales y la configuración técnica requieren desplegar información secundaria. El FAQ de APN se corrigió para no aplicar `vmobile.jp` a todas las variantes de Japón: el nuevo CSV lo especifica para IIJ y proporciona otros APN para otros productos.

## Validación y límites de la fuente

La identidad se comprueba por slug, tipo fijo, duración y cantidad extraída del nombre. La columna `GBs` del segundo archivo redondea a cero 120 planes sub-GB; se conservan los 100/500 MB correctos del catálogo base. Los detalles guardan GB/días de referencia; el cargador no adjunta detalles si esos datos dejan de coincidir tras una futura actualización del catálogo.

Se distinguen las tecnologías del plan de las de sus operadores: 229 registros indican tecnologías adicionales en las redes frente al campo general del plan. Ambas declaraciones se conservan y se muestra una nota de confirmación pendiente. No se presenta 5G como prestación garantizada si el plan no la declara.

El código heredado `AN` conserva la etiqueta «Antillas Neerlandesas» del proveedor con una indicación pendiente de confirmar. No se convierte automáticamente a Curazao mediante `Intl.DisplayNames`. La referencia obsoleta `TP` en etiquetas de operadores de Timor-Leste se normaliza a `TL`, coincidente con la cobertura explícita. Operadores mapeados fuera de la cobertura declarada, identidades duplicadas, productos diarios y políticas desconocidas abortan la importación.

`Validity` contiene valores como 180, pero su significado no se define en el archivo. Se omite en lugar de confundirlo con los días de datos o con un plazo de instalación. Las redes se presentan como información entregada por el proveedor, no como una auditoría independiente de acuerdos actuales de roaming.
