# SEO de MyTripSim — implementación y próximos pasos

Fecha: **26 de octubre de 2026**, America/Panama. Dominio principal: **https://www.mytripsim.com**.

## Qué se ha corregido

| Área           | Resultado                                                                                                                                                                               |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dominio        | Canonical, hreflang, Open Graph, sitemap, robots y entidades usan el host final con `www`. El dominio alternativo conserva su redirección.                                              |
| Metadatos      | Títulos y descripciones ES/EN orientados a eSIM de viaje, destinos, compatibilidad y ayuda. Las fichas usan los GB, duraciones y número de planes publicados.                           |
| Contenido      | H1 de la portada explica el producto. Las fichas incorporan información específica del catálogo sobre operadores, activación y cobertura, distinguiendo variantes y datos pendientes.   |
| Descubrimiento | Directorio A–Z renderizado en servidor con enlaces a los 241 destinos; se conserva la búsqueda visual. Las regiones enlazan a países expresamente incluidos en su cobertura.            |
| Duplicados     | Las antiguas rutas `/plan/...` redirigen permanentemente al selector del destino. Los parámetros de plan y campaña mantienen canonical en la ficha base.                                |
| Guía           | `/es/instalar` y `/en/install` son públicas, indexables y están en el sitemap. Los enlaces de instalación personales siguen protegidos y llevan `noindex`.                              |
| Entidades      | Organization, WebSite, BreadcrumbList, CollectionPage e ItemList describen la marca, navegación y catálogo reales. No se publican reseñas ni ofertas inventadas.                        |
| Iconos         | `sim_icon_.png` se usa para favicon ICO, icono PNG, Apple touch icon y manifest con tamaños 192/512.                                                                                    |
| Imagen móvil   | La ficha declara su ancho real de imagen: 88 px en móvil y 270 px en escritorio, evitando solicitar una variante sobredimensionada.                                                     |
| Carga inicial  | El botón de ayuda se mantiene visible; el panel, la conversación y la validación del chat se cargan al abrirlo mediante un módulo diferido.                                             |
| Privacidad     | Cuentas, checkout, pedidos, administración y soporte personal permanecen excluidos de indexación. Las condiciones legales siguen como borrador y `noindex` hasta su revisión comercial. |

Se aplicó como referencia la skill solicitada [claude-seo](https://github.com/AgriciDaniel/claude-seo). Se contrastaron sus recomendaciones con la documentación de Next instalada y fuentes oficiales de Google. No se ejecutaron sus instaladores remotos ni se añadieron servicios de pago.

## Verificación reproducible

- `npx.cmd next build`: compilación de producción.
- `npm.cmd test`: 18 pruebas de catálogo, compatibilidad, navegación y carrito.
- `npm.cmd run test:seo`: 4 pruebas de metadatos, entidades, activación e interenlaces de cobertura.
- `npm.cmd run audit:seo`: rastrea el sitemap público completo, comprueba HTTP 200, canonical, indexabilidad, título único, descripción, H1 único, hreflang recíproco, JSON válido y enlaces del directorio; también revisa redirección de plan, iconos y exclusiones privadas.
- Para ejecutar el rastreo contra una compilación local: configurar `SEO_AUDIT_BASE=http://localhost:3008`. `SEO_AUDIT_OUTPUT` permite guardar el informe JSON. Ninguna prueba de SEO realiza compras ni emite eSIM.

La referencia anterior está en [findings-baseline.md](./findings-baseline.md). Las pruebas iniciales móviles de Lighthouse fueron 92/93 de rendimiento para portada/Panamá, con CLS 0 y LCP 3,0/2,9 s. Son mediciones de laboratorio, no datos reales de Core Web Vitals. La categoría SEO automática de Lighthouse no mide posiciones en Google.

La compilación local de producción pasó el rastreo completo de **508/508 URL sin fallos**, incluyendo títulos únicos y alternativas de idioma recíprocas. También pasaron TypeScript, ESLint y las 22 pruebas indicadas. Se revisaron portada, directorio, Panamá y Europa a 390 px de ancho sin desbordamiento horizontal. Una repetición anterior encontró errores temporales de conexión al catálogo; la comprobación directa de producción y Supabase y el rastreo completo posterior respondieron correctamente. El script usa dos solicitudes simultáneas para limitar la carga de auditoría.

La versión publicada del cambio SEO (`078f745`) pasó también el rastreo completo de **508/508 URL** en `www.mytripsim.com`. El favicon, el manifest y robots.txt respondieron 200; se confirmó la redirección 308 de las antiguas fichas de plan. En un navegador móvil DPR 2, el banner de Panamá pasó a solicitar `w=256`, con 22.029 bytes, frente a los 36.302 bytes de la muestra anterior `w=750`.

La medición posterior de Lighthouse anterior a diferir el chat obtuvo 75/87 de rendimiento para portada/Panamá, LCP 3,4/3,2 s y CLS 0; accesibilidad, buenas prácticas y SEO automático fueron 100 en ambas. Algunas ejecuciones fallaron por cierre del navegador. Por tanto, **no se ha demostrado una mejora del LCP** y estos resultados no equivalen a Core Web Vitals de usuarios reales. El JavaScript transferido en esas dos muestras fue prácticamente igual al anterior; la variación se observó principalmente en tiempo de ejecución del navegador.

Como mejora adicional se separó el panel de chat de la carga inicial. La compilación y las seis pruebas de interfaz de soporte (móvil/escritorio, ES/EN) pasaron, junto a las cinco pruebas de soporte/seguridad. La comprobación de red local confirmó que el módulo del chat se solicita al abrirlo. Se requiere una medición posterior estable y seguimiento de campo para cuantificar su efecto sobre la velocidad; no se atribuye un aumento de ranking a este cambio.

## Enviar el sitemap en Search Console

El usuario enviará el sitemap desde su sesión:

1. Seleccionar la propiedad de dominio `mytripsim.com` o la propiedad de prefijo **`https://www.mytripsim.com/`**. Una propiedad de prefijo sin `www` no equivale a la de `www`.
2. Abrir **Sitemaps**, introducir **`https://www.mytripsim.com/sitemap.xml`** y enviar. Contiene **508 URL**, con sus alternativas ES/EN; no incluye checkout ni cuentas.
3. Confirmar que el estado pasa a «Correcto». Si hay un sitemap anterior sin `www`, sustituir su envío por el actual después de comprobar que el nuevo se ha procesado.
4. En **Inspección de URL**, probar en directo la portada ES/EN, el directorio, Panamá y una ficha regional. Solicitar indexación de una pequeña selección prioritaria; el sitemap sirve para descubrir el catálogo completo.
5. En las inspecciones posteriores, comparar canonical declarada y canonical elegida por Google. Revisar páginas excluidas, duplicadas o «Rastreada: actualmente sin indexar» según la causa concreta.

No se ha accedido a Search Console ni se ha enviado una solicitud desde este entorno. [Enviar el sitemap facilita el descubrimiento](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap); [solicitar un rastreo no garantiza indexación ni una fecha](https://developers.google.com/search/docs/crawling-indexing/ask-google-to-recrawl). La Indexing API no corresponde a este catálogo de eSIM.

## Plan de crecimiento orgánico de 30 días

Las siguientes prioridades son hipótesis comerciales para empezar; **no representan volúmenes de búsqueda, posiciones ni demanda medidos**. Reordenarlas al disponer de los datos de Search Console.

| Periodo  | Trabajo                                                                                                                                                                                                                   | Evidencia de avance                                                                                                                   |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Días 1–3 | Enviar sitemap e inspeccionar las páginas de `prioridades-indexacion.csv`. Revisar posibles errores y canonical elegida.                                                                                                  | Sitemap procesado, URL accesibles y resultados de inspección registrados.                                                             |
| Semana 1 | Cerrar impuestos, reembolsos y condiciones; revisar el paso de Stripe TEST a producción mediante una tarea específica. Crear una página de marca con datos legales y contacto verificados.                                | Información comercial publicada y flujo real probado antes de invertir en captación.                                                  |
| Semana 2 | Preparar una guía original sobre cuántos GB necesita un viajero y otra sobre instalar una eSIM antes de viajar. Usar ejemplos propios y capturas revisadas, fecha de actualización y enlaces al catálogo y a fabricantes. | Contenido útil publicado en ES/EN y enlaces internos contextualizados.                                                                |
| Semana 3 | Profundizar en 3 destinos con impresiones reales: condiciones por variante, dudas locales verificadas, operadores y escenarios de viaje. Revisar con el proveedor cualquier dato pendiente.                               | Respuestas específicas que ayuden a elegir un plan; evitar artículos idénticos cambiando sólo el país.                                |
| Semana 4 | Revisar consultas, páginas e idiomas en GSC. Ajustar títulos de páginas con impresiones y CTR débil, conservando la intención. Identificar colaboradores turísticos relevantes y preparar propuestas editoriales útiles.  | Registro de cambios, clics e impresiones comparados en periodos equivalentes; colaboraciones reales, sin enlaces comprados o masivos. |

Para dar a conocer la marca: reservar perfiles oficiales coherentes, publicar demostraciones propias y ofrecer guías a creadores o negocios turísticos con audiencia pertinente. Los perfiles, testimonios y colaboraciones deben ser reales. No se han creado cuentas externas ni enviado mensajes a terceros como parte de este trabajo.

## Qué medir

- **Search Console:** indexación por plantilla, consultas/páginas ES/EN, impresiones, clics, CTR y posición media como tendencia. Comparar periodos completos, no cambios diarios aislados.
- **Conversión:** visita de ficha → añadir al carrito → inicio del checkout → pago confirmado. Definir medición y consentimiento aplicable antes de instalar analítica; no registrar correos, QR o secretos como eventos.
- **Experiencia:** Core Web Vitals de usuarios reales cuando exista una muestra suficiente. Lighthouse sirve para diagnóstico repetible; TBT no equivale a INP.
- **Mantenimiento:** ejecutar `audit:seo` tras cambios de rutas o catálogo. Actualizar precios, redes y coberturas desde sus fuentes reales. No añadir fechas `lastmod` ficticias cada vez que se genera el sitemap.

Con los cobros reales habilitados y las condiciones cerradas, valorar `Product`/`Offer` y su elegibilidad en Merchant Center según el producto. El estado actual no justifica anunciar disponibilidad comercial `InStock` ni resultados enriquecidos de precio.
