# Auditoría técnica de referencia — MyTripSim

Capturada el **25 de octubre de 2026 (America/Panama)**, antes de publicar los cambios SEO. Sitio revisado: `https://www.mytripsim.com`. La evidencia bruta local está en `private-data/seo/`; contiene HTML público, resultados HTTP y dos auditorías Lighthouse. No se consultaron datos privados de clientes.

## Alcance y límites

- 16 páginas públicas y privadas de distintos tipos, el sitemap, robots.txt, un alias de plan y tres variantes de protocolo/host.
- Revisión de rutas, metadatos, renderizado del directorio, catálogo y markup del código vigente.
- Dos mediciones móviles de laboratorio con Lighthouse **13.5.0**, navegador Edge sin interfaz. Son muestras puntuales; no son métricas CrUX, percentiles de usuarios reales ni mediciones de INP.
- No se encontraron nombres de configuración Google/GSC/GA4/PageSpeed en `.env.local`, ni el archivo `~/.config/claude-seo/google-api.json`. Esto no descarta una sesión de Search Console abierta en un navegador. No se accedió a Search Console desde esta auditoría, ni se conocen clics, impresiones, CTR, posiciones o estado real de indexación.
- No se asigna una puntuación SEO global inventada. El 100 de la categoría SEO de Lighthouse sólo cubre sus comprobaciones automáticas y no contradice los problemas de arquitectura encontrados.

## Hallazgos priorizados

| Prioridad | Hallazgo y evidencia anterior                                                                                                                                                                                                                                | Acción                                                                                                                                                                                       | Comprobación de éxito                                                                                                                                              |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Alta      | Las **506 URL** del sitemap usaban `mytripsim.com`. La respuesta HTTPS de ese host redirige con **308** a `www.mytripsim.com`. Canonical y hreflang de todas las páginas 200 muestreadas también apuntaban al host que redirige.                             | Usar `https://www.mytripsim.com` en metadataBase, canonical, hreflang, sitemap, robots, JSON-LD e imágenes compartidas. Mantener la redirección del host alternativo.                        | URL del sitemap y sus canonical/hreflang responden 200 directamente en el mismo host. En Search Console, comprobar posteriormente la canonical elegida por Google. |
| Alta      | `/es/destinos` y `/en/destinations` contienen **sólo 24 enlaces HTML a destinos**. El resto se añade mediante un botón JavaScript; no hay enlaces de paginación. El catálogo publicado tiene 241 destinos.                                                   | Mantener la búsqueda visual, pero añadir un índice HTML accesible de todos los destinos o paginación enlazada y renderizada en servidor.                                                     | Crawler sin ejecutar JavaScript alcanza todos los destinos publicados a poca profundidad, a través de enlaces `<a href>`.                                          |
| Alta      | `/es/plan/panama/PA_0.1_7` devuelve **200**, `index, follow` y canonical propio, pero representa la misma ficha y selector que `/es/esim/panama?plan=PA_0.1_7`. El patrón existe para las variantes del catálogo.                                            | Consolidar la ruta antigua con una redirección permanente al selector de destino, conservando el plan seleccionado. Canonical de los parámetros del selector a la URL base del destino.      | Alias válido redirige a la selección correspondiente; no quedan fichas duplicadas autocanónicas; alias inválidos siguen siendo 404.                                |
| Media     | `/es/instalar` devuelve 200 pero declara **noindex, nofollow**, por heredar la rama de páginas de experiencia. Ni `/es/instalar` ni `/en/install` aparecen en el sitemap.                                                                                    | Tratar esta guía pública como contenido informativo indexable con título, descripción, canonical, hreflang y enlaces contextualizados. Mantener excluidas las páginas privadas de esa rama.  | La guía es 200, indexable, enlazada y está en el sitemap. Wallet, checkout y credenciales permanecen protegidos.                                                   |
| Media     | Home usa un título de marca emocional, sin mencionar claramente la categoría: «Sigue conectado, dondequiera que vayas». El directorio usa «Explora el catálogo de planes».                                                                                   | Añadir intención comercial natural: eSIM de viaje, datos móviles, destinos y comparación de GB/días. Conservar la voz de marca y evitar promesas no comprobables.                            | Title y H1 explican el producto y la tarea; descripciones diferenciadas por idioma y datos del destino, sin repetir listas artificiales de keywords.               |
| Media     | JSON-LD únicamente de Organization en la home; fichas y directorio sin BreadcrumbList, CollectionPage ni ItemList. Organization también usa el host alternativo y el icono antiguo como logo.                                                                | Modelar las entidades y la navegación reales. El catálogo puede describirse con CollectionPage/ItemList y planes reales. No inventar ratings, reviews, disponibilidad comercial o políticas. | JSON válido, IDs/URL absolutos consistentes, datos coincidentes con el contenido visible y sin ofertas ficticias.                                                  |
| Media     | Banner de Panamá renderizado a **88 × 100 px** en móvil, pero su `sizes` declara `90vw`; Lighthouse descargó una variante `w=750` de **36.302 bytes** y estima unos **33.833 bytes** evitables. CSS fija la columna a 88 px en móvil y 270 px en escritorio. | Corregir `sizes` de esa imagen a dimensiones de layout reales, por ejemplo `(max-width:650px) 88px, 270px`, manteniendo calidad y recorte.                                                   | El navegador selecciona una fuente adecuada al DPR y disminuye transferencia/LCP sin degradar la ilustración.                                                      |
| Media     | Importación global de CSS de administración, comercio y otras vistas: Lighthouse estima **22 KiB** de CSS no utilizado en home y **12 KiB** en la ficha. Hay unos **21 KiB** de JavaScript no utilizado en cada muestra.                                     | Considerar carga por ruta y carga diferida de funciones auxiliares. No romper el shell compartido ni sacrificar accesibilidad por una puntuación.                                            | Comparar mismas páginas/condiciones tras cambios; medir bytes y métricas, no sólo el score.                                                                        |

## Lo que ya funciona

- Las páginas de destino muestreadas incluyen el selector, contenido de redes/condiciones y FAQ en el HTML inicial; no dependen sólo de un contenedor vacío renderizado con JavaScript.
- Los parámetros de selección ya apuntan, mediante canonical, a la ficha base del destino; debe conservarse ese comportamiento al unificar el host.
- Las páginas privadas muestreadas respetan `noindex, nofollow`. `support` y `admin` redirigen al login sin exponer la información privada, y añaden `X-Robots-Tag` y política de referencia privada.
- No se encontraron errores de formato JSON-LD en el Organization existente. Sí falta ampliar entidades útiles y actualizar sus URL.
- HTTPS y redirección del host alternativo están activos. Las respuestas incluyen HSTS. El sitio permite rastreo público y declara su sitemap en robots.txt.
- El HTML público medido tiene entre aproximadamente **27 y 139 KB**. No hay evidencia de una página desmesuradamente grande que oculte el contenido principal al crawler.
- No se detectó movimiento acumulado del layout en las dos muestras Lighthouse.

## Rendimiento móvil medido — laboratorio

| URL               | Rendimiento | Accesibilidad | Buenas prácticas | SEO automático |   FCP |   LCP |    TBT | CLS |
| ----------------- | ----------: | ------------: | ---------------: | -------------: | ----: | ----: | -----: | --: |
| `/es`             |          92 |           100 |              100 |            100 | 1,3 s | 3,0 s | 130 ms |   0 |
| `/es/esim/panama` |          93 |           100 |              100 |            100 | 1,1 s | 2,9 s | 150 ms |   0 |

En home, el elemento LCP medido fue el H1, no la mascota. En Panamá fue el banner de destino. El ahorro de imagen debe aplicarse a la ficha concreta; no justificaría atribuir todo el LCP de home a su ilustración. Las pruebas observan compresión y respuesta rápida del documento en esa ejecución; no son prueba de un SLA global. No se debe interpretar TBT como INP.

## Datos estructurados y disponibilidad comercial

El checkout sigue configurado para Stripe TEST en la implementación auditada. Por eso no conviene publicar `InStock` ni prometer que una oferta se puede comprar en producción. Organization, WebSite, WebPage/CollectionPage, BreadcrumbList e ItemList son apropiados ahora. Un Product sin Offer ni reseñas puede ser vocabulario Schema.org válido, pero no satisface por sí solo el requisito mínimo del Product snippet de Google. Implementar rich results comerciales y feeds sólo con precios, disponibilidad y condiciones reales de venta. No hay base para publicar AggregateRating ni reseñas ficticias.

## Indexación y seguimiento

Después de publicar, enviar el sitemap canónico actualizado mediante la propiedad correcta de Search Console y usar Inspección de URL para una muestra de home, destinos prioritarios y guía de instalación. Validar acceso, canonical elegida, renderizado y cambios de cobertura. La solicitud no obliga a Google a indexar ni ofrece una fecha o ranking garantizado.

La **Indexing API de Google no corresponde a este catálogo**: está limitada a JobPosting y BroadcastEvent dentro de VideoObject. No emplearla para enviar las fichas de eSIM. Tampoco crear páginas de empleo o eventos falsas para eludir esa restricción.

Revisar semanalmente consultas/páginas por idioma, impresiones, clics y CTR; comparar periodos equivalentes y registrar cambios. Si no se dispone de acceso a GSC, indicar «no medido», en vez de asignar posiciones o volúmenes de búsqueda supuestos.

## Fuentes primarias consultadas

- [Google: canonicalización](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls).
- [Google: estructura de URL para ecommerce](https://developers.google.com/search/docs/specialty/ecommerce/designing-a-url-structure-for-ecommerce-sites).
- [Google: paginación y carga incremental](https://developers.google.com/search/docs/specialty/ecommerce/pagination-and-incremental-page-loading).
- [Google: construir y enviar sitemaps](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap).
- [Google: datos de Product snippet](https://developers.google.com/search/docs/appearance/structured-data/product-snippet).
- [Google: alcance de Indexing API](https://developers.google.com/search/apis/indexing-api/v3/quickstart).

Esta es una referencia anterior a la intervención. Los hallazgos que ya se hayan corregido deben contrastarse con la verificación posterior, no presentarse como fallos todavía vigentes.
