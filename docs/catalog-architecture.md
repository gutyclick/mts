# Catálogo, páginas y banners

## Contenido

La portada presenta la búsqueda y destinos destacados. Las guías de funcionamiento, compatibilidad, ayuda y FAQ tienen rutas propias en inglés y español. El FAQ contiene 29 preguntas en seis temas, búsqueda por pregunta/respuesta, filtros de tema y enlaces oficiales de Apple y Google.

El directorio contiene 244 destinos: 202 países/territorios y 42 regiones. Presenta 24 tarjetas a la vez con botón para cargar más, búsqueda localizada y categorías. Cada página de destino muestra todos sus planes, agrupados en datos fijos y datos diarios, con filtros acumulables por cantidad, días y tipo. Las opciones se obtienen de los planes reales de cada destino.

## Importación

```sh
npm run import:catalog -- /ruta/privada/al/archivo.csv
npm run sync:images
```

El CSV original se mantiene fuera del repositorio. `.gitignore` excluye `esim-prices-*.csv` y `private-data/`. El archivo se procesa como datos, sin ejecutar contenido. El importador valida identificadores únicos, categorías, datos y días, y exporta solamente los campos permitidos:

- `id`: identificador del producto.
- `name`: nombre original, normalizando espacios.
- `allowance` y `dataGb`: unidad original y valor para filtros.
- `days`, `kind` y `coverageCode`: duración, clasificación y código original.

No se exportan precios, tarifas, historial ni otros campos operativos. Tampoco hay precios en las tarjetas, detalle o datos estructurados. Los 3.186 planes originales se conservan, incluso variantes con nombres similares. El módulo `plans.ts` se importa únicamente desde rutas servidor; los componentes cliente reciben los planes del destino consultado.

Los países se agrupan por código ISO para reunir nombres truncados o con errores (United/United States, Philippine/Philippines y Cayman lslands/Cayman Islands). Se utiliza el nombre más frecuente y se conservan las variantes como alias de búsqueda. Las regiones se agrupan por código y nombre canónico, uniendo variantes del mismo nombre sin eliminar sus planes.

La lista no establece todos los países incluidos en cada producto regional, redes, hotspot ni condiciones de activación. No se inventan esas características ni se adjuntan regionales a países sin cobertura verificada. Los planes de origen `Unlimited FUP` se presentan como datos diarios con aviso de uso justo; no como datos a máxima velocidad sin límites.

## Imágenes y banderas

Coloca los mini banners en `public/images/destinations/`, en PNG, JPEG, WebP o AVIF. Nombra cada archivo con el slug, código ISO, nombre inglés/español o un alias del destino. Ejemplos: `japon.png`, `france.png`, `italy.png`, `usa.png`, `pa.webp` o `panama.webp`.

`sync:images` se ejecuta automáticamente antes de desarrollo y build y genera `src/data/destination-images.json`. Las cuatro imágenes entregadas (Japón, Estados Unidos, Francia e Italia) ya están conectadas. `next/image` sirve tamaños adaptados y optimizados; las tarjetas y banners reutilizan el mismo recurso. Si hay varias coincidencias, se usa la primera en orden alfabético; conserva una imagen por destino.

Las banderas son SVG redondas de [Circle Flags](https://hatscripts.github.io/circle-flags/), de HatScripts, distribuidas localmente con licencia MIT en `public/flags/LICENSE.md`. No requieren CDN, claves ni JavaScript adicional de una biblioteca. Los países sin banner utilizan una ilustración existente o la bandera local; las regiones usan ilustraciones de mapa/globo y no se representan como países.

## Validación

Los tests comprueban los 244 destinos, 3.186 identificadores únicos, ausencia de campos ajenos a la lista permitida, correspondencia de códigos de país, imágenes existentes, variantes de búsqueda, filtros reales y 29 preguntas por idioma. Playwright verifica escritorio/móvil, páginas independientes, ausencia de importes en planes, navegación y detalle accesible. La auditoría visual incluye FAQ y ayuda además del catálogo.
