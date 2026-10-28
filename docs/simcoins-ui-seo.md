# SimCoins: revisión visual y SEO

## Cambios de presentación

- Calculadora y enlace eliminados, junto con su componente, textos y estilos asociados.
- Hero más breve, pasos resumidos y tarjetas de rango con las insignias aportadas por el propietario.
- Bloque de canje compacto con `simcoins_pile`, equivalencia, límite de ahorro y acceso a condiciones desplegables. El enlace abre las condiciones antes de llevar al lector a ellas.
- Moneda individual pequeña: 32 px en el saldo, 26 px en el checkout y 24 px en administración. La insignia del nivel actual aparece en la billetera a 60 px.
- Insignias Viajero, Explorer, Adventurer y Legend convertidas a WebP de 320 × 320, conservando proporciones y transparencia. Tamaños: 19–31 KB. Los PNG originales se conservan.
- Globetrotter incorpora la insignia aportada, optimizada a WebP de 320 × 320 (29,8 KB).

La dirección visual mantiene Jakarta e Inter, el azul de interfaz, el naranja de marca, superficies blancas y azul suave, y bordes redondeados. Las insignias son el foco de las tarjetas; las condiciones extensas permanecen en desplegables. Se respeta la preferencia de movimiento reducido.

## SEO implementado

- Títulos y descripciones propios en ES/EN, centrados en SimCoins y recompensas por compras eSIM.
- Canonical, hreflang recíprocos y Open Graph mediante el sistema SEO existente.
- Un H1 por página, jerarquía de encabezados, navegación visible de Inicio a SimCoins y enlaces internos descriptivos.
- JSON-LD de `WebPage` y `BreadcrumbList`, consistente con las URL públicas y el idioma. No se inventan ofertas, precios ni valoraciones del programa.
- Ilustraciones decorativas con alternativa vacía cuando el texto adyacente ya aporta el significado; hero con descripción propia. Dimensiones explícitas e imágenes optimizadas.
- El estado de prelanzamiento continúa visible mientras el programa esté desactivado.

Se aplicaron `frontend-design` y la referencia local `seo-page` de claude-seo. El detector de plantillas de metadatos se ejecutó para ambos idiomas: sin indicadores de plantilla ni alertas. No se atribuye a esta revisión una mejora de posición o una medición de Core Web Vitals de campo.

Referencias: [títulos descriptivos de Google Search Central](https://developers.google.com/search/docs/appearance/title-link), [guía SEO de Google](https://developers.google.com/search/docs/fundamentals/seo-starter-guide).

## Verificación

- 37 pruebas SimCoins y 5 pruebas SEO enfocadas aprobadas.
- TypeScript, ESLint y compilación de producción verificados.
- Navegador local: ES/EN, 1440 px y 390 px, sin calculadora ni desbordamiento horizontal; insignias e ilustración de monedas cargadas; condiciones abiertas desde su enlace.
- Billetera y checkout revisados con datos ficticios en un servidor local independiente. No se consultaron ni modificaron saldos reales.

Esta revisión visual inicial no aplicó migraciones ni activó acumulación o canje. El lanzamiento posterior autorizado está activo en producción; consulta [evidencia de lanzamiento](simcoins-launch.md).

## FAQ de SimCoins

- Categoría propia con diez respuestas en ES/EN, rutas localizadas y enlace al programa.
- Landing con seis respuestas esenciales y condiciones, tarjetas táctiles de 64 px, foco visible y acordeón exclusivo para móvil.
- Contenido compartido entre la landing y el centro de preguntas frecuentes.
- Verificación adicional: 18 pruebas del catálogo, TypeScript y ESLint aprobados; móvil de 390 px sin desbordamiento, insignia cargada y condiciones abiertas desde su enlace.
