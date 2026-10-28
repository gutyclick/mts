# MyTripSim

Repositorio: [gutyclick/mts](https://github.com/gutyclick/mts). Alojamiento: **Vercel**. Catálogo conectado a **Supabase/PostgreSQL**. Producción: [www.mytripsim.com](https://www.mytripsim.com/es). Consulta la [guía de despliegue y credenciales](docs/deployment.md).

Sitio público de **MyTripSim**, marca de **YellowCat Enterprises LLC**. Catálogo de planes de datos fijos en inglés y español, con precios y cobros en 18 monedas. Stripe live y el aprovisionamiento están operativos; el propietario confirmó compras reales satisfactorias el 27 de octubre de 2026.

## Ejecutar

Requisitos: Node.js 22.18+ o 24 LTS recomendado y npm. La aplicación Next.js requiere Node 20.9+; los tests TypeScript sin compilación usan las funciones de Node 22.18+.

```sh
npm ci
npm run dev
```

Abrir <http://localhost:3000/en> o <http://localhost:3000/es>. `/` redirige a inglés. En PowerShell con scripts deshabilitados, usar `npm.cmd` en lugar de `npm`.

Producción local:

```sh
npm run build
npm start
```

El catálogo admite desarrollo local sin configuración remota. Las cuentas requieren `SUPABASE_URL` y `SUPABASE_PUBLISHABLE_KEY`; `AUTH_SITE_URL` fija el origen de autenticación (producción por defecto; usar `http://localhost:3000` para desarrollo local). Consulta `.env.example` y [cuentas y correo](docs/accounts.md). Nunca colocar claves secretas de Stripe, eSIM Access, Supabase o Resend en variables `NEXT_PUBLIC_*`, archivos versionados o registros. `.env.local`, `.vercel/` y los metadatos locales de Supabase están excluidos de Git.

## Implementado

- Next.js App Router, TypeScript estricto, Tailwind CSS 4, Lucide, ESLint y Prettier. Componentes nativos accesibles en lugar de agregar una biblioteca de UI sin necesidad.
- Portada breve con búsqueda, duración opcional, seis destinos destacados y enlaces a páginas independientes de guías y FAQ.
- Identidad azul/naranja, Plus Jakarta Sans e Inter mediante `next/font`, sistema de tokens y mascota SIM: Traveler en la portada, Help en el índice FAQ y Adventurer en Cómo funciona. Las imágenes originales de `public/images/sim/` conservan su transparencia y se sirven mediante `next/image` con tamaños adaptables.
- Diccionarios centralizados, rutas traducidas y cambio de idioma que conserva la página equivalente. El cambio de idioma realiza navegación de documento para actualizar correctamente `<html lang>`; el resto utiliza navegación de Next.js.
- Búsqueda local insensible a mayúsculas y tildes, alias en ambos idiomas, teclado, cierre con Escape y estados vacíos.
- Directorio buscable con categorías y carga progresiva: 202 países/territorios y 39 regiones. Cada destino tiene todos sus planes fijos.
- Selección de planes en filas compactas de GB/días, precio final y nombre de variante, con ordenación numérica y filtros combinables. La ficha completa se actualiza en la misma pantalla, sin diálogo intermedio ni pestañas. La duración de la portada se conserva como filtro inicial; el plan seleccionado se conserva al compartir y traducir el enlace. Consulta [precios y variantes](docs/retail-prices.md).
- Guías de funcionamiento, compatibilidad, centro de ayuda por temas y FAQ con 29 preguntas buscables por idioma. Términos, privacidad y reembolsos como borradores claramente señalados y con `noindex`.
- Metadata localizada, canonical, hreflang, Open Graph, imagen social, sitemap, robots y datos estructurados veraces de la organización. Sin reseñas ni ofertas estructuradas ficticias.
- Diseño adaptable, menú móvil, foco visible, enlace para saltar al contenido, FAQ nativa y respeto a movimiento reducido.
- Experiencia móvil con navegación inferior localizada, controles táctiles amplios, buscador adaptado al teclado, áreas seguras de pantalla y detalle de plan en hoja inferior. La barra inferior responde a cambios del viewport al abrir/cerrar el teclado. Ver [diseño móvil](docs/mobile-experience.md).

## Rutas

Los planes incluyen operadores, redes, países cubiertos, inicio de vigencia, recarga y APN extraídos del segundo CSV, con exclusión de precios y campos comerciales. Consulta [importación de datos técnicos](docs/plan-enrichment.md).

Las páginas de destino reúnen selección, GB/días, red, operadores e inicio de vigencia en un único bloque para continuar. Los datos técnicos secundarios se despliegan dentro de ese bloque; debajo quedan las políticas generales, guías y FAQ por destino. Consulta la [estructura y criterios de contenido](docs/destination-experience.md).

La FAQ principal es un índice de seis temas, cada uno con página propia y rutas traducidas, buscador y valoraciones por respuesta. Los enlaces antiguos siguen dirigiendo al tema y respuesta correspondientes. Consulta las [rutas y estructura de FAQ](docs/faq-experience.md).

La ficha del plan muestra detalles, cobertura y condiciones juntos e incluye un verificador de compatibilidad por marca, modelo y región de compra. Los modelos con documentación oficial se distinguen de los pendientes de confirmar. Consulta [fuentes y criterios del verificador](docs/device-compatibility.md).

Registro, confirmación, acceso, recuperación y Mis eSIM usan Supabase Auth y datos privados protegidos por RLS. Las cuentas nuevas empiezan vacías; cada cliente ve únicamente sus pedidos e instrucciones. Consulta [cuentas y correo](docs/accounts.md). El [carrito y checkout](docs/checkout.md) conservan planes entre visitas, permiten cambiar cantidades y ofrecen correo de invitado o acceso a una cuenta. Stripe live, entrega de eSIM, reembolsos y administración privada con MFA están conectados. SimCoins incorpora saldo, niveles y recompensas para nuevas compras elegibles; consulta [operación y condiciones](docs/simcoins.md).

| Página           | Inglés              | Español                    |
| ---------------- | ------------------- | -------------------------- |
| Inicio           | `/en`               | `/es`                      |
| Destinos         | `/en/destinations`  | `/es/destinos`             |
| Destino y planes | `/en/esim/[slug]`   | `/es/esim/[slug]`          |
| Funcionamiento   | `/en/how-it-works`  | `/es/como-funciona`        |
| Compatibilidad   | `/en/compatibility` | `/es/compatibilidad`       |
| Ayuda            | `/en/help`          | `/es/ayuda`                |
| FAQ              | `/en/faq`           | `/es/preguntas-frecuentes` |
| Términos         | `/en/terms`         | `/es/terminos`             |
| Privacidad       | `/en/privacy`       | `/es/privacidad`           |
| Reembolsos       | `/en/refunds`       | `/es/reembolsos`           |

Los 241 slugs se encuentran en `src/data/destinations.json` y se comparten entre idiomas. Idiomas, páginas y destinos desconocidos devuelven 404.

## Arquitectura

Supabase mantiene catálogo, precios y datos privados con RLS y lectura desde el servidor. La conexión requiere configurar el proyecto y las variables de entorno: [instrucciones y verificación](docs/supabase-setup.md). La administración web utiliza membresía privada y MFA; las operaciones sensibles dejan auditoría.

La [integración de eSIM Access](docs/esimaccess.md) consulta el catálogo firmado desde el servidor y mantiene el enlace privado de los planes publicados con los códigos del proveedor. No importa precios ni emite eSIM. Incluye herramientas de configuración segura, comprobación y sincronización, más adaptadores privados de consulta de perfiles y consumo.

```text
src/
  app/                       Rutas, layouts, metadata y CSS/tokens
    [locale]/                Contenido inglés/español
      [page]/                Páginas informativas y directorio
      esim/[slug]/           Destino y planes
  components/
    home/                    Secciones independientes de portada
    destination-search.tsx   Combobox y navegación del catálogo
    destination-directory.tsx
    plan-browser.tsx         Selector, filtros, ordenación y ficha en la misma pantalla
    faq-center.tsx           Búsqueda por tema y acordeones nativos
    site-navigation.tsx      Menú e idioma
    mobile-navigation.tsx    Navegación inferior y respuesta al teclado
    footer.tsx
    ui.tsx                   Marca, botones y encabezados compartidos
  lib/
    catalog.ts               Destinos, imágenes y búsqueda
    plans.ts                 Catálogo completo, importado en rutas servidor
    plan-utils.ts            Tipos y filtros sin datos del catálogo
    i18n.ts                  Diccionarios y equivalencias de rutas
    seo.ts                   URLs y constructor de metadata
    integrations/contracts.ts Contratos futuros, sin implementaciones
  proxy.ts                   Idioma del documento en solicitudes SSR
public/images/               Fotografías y placeholder de mascota
tests/                       Tests de lógica y recorridos reales
scripts/                     Capturas y auditoría de UI
```

Las páginas de contenido son Server Components. Búsqueda, filtros, diálogo y menú son islas cliente. El idioma de documento se obtiene de una cabecera interna sobrescrita por el proxy; las páginas públicas se renderizan en servidor por solicitud. Sitemap, robots e imagen social son estáticos. No se depende de servicios externos durante la navegación. `next/font` descarga fuentes durante la compilación; el entorno de build necesita acceso a Google Fonts.

El importador usa una lista explícita de campos permitidos: identificador, nombre original, datos, duración, tipo y código de cobertura. No conserva precios, historial, IP ni campos operativos. Los planes completos se leen en las rutas servidor; cada navegador recibe solamente los planes del destino abierto. No se infiere la cobertura exacta de un plan regional por su nombre. Ver [catálogo e imágenes](docs/catalog-architecture.md).

## Comprobaciones

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

Los tests de navegador utilizan Microsoft Edge instalado, con perfiles de escritorio y móvil. En otros sistemas, cambiar `channel: "msedge"` en `playwright.config.ts` y los scripts a un navegador instalado, o instalar Chromium con `npx playwright install chromium` y omitir el canal.

Con el servidor de producción activo:

```sh
npm run audit:ui
npm run capture
```

La auditoría usa axe-core, comprueba reglas WCAG A/AA seleccionadas en 360 y 1440 px, y busca desbordamiento horizontal en 320, 360, 390, 430, 768, 1024 y 1440 px. Los recorridos móviles también cubren orientación horizontal, una altura reducida con campo enfocado para simular teclado, navegación activa, hoja inferior y recuperación de foco. No sustituye una auditoría manual completa ni pruebas en teclados y dispositivos físicos o mediciones de Core Web Vitals en usuarios reales. Las capturas se guardan en `docs/previews/`, con vistas de pantalla móvil, tablet y detalle de plan.

La importación exclusiva de planes fijos, los 1.730 identificadores únicos, los campos permitidos, los filtros y las rutas equivalentes tienen tests unitarios. Los recorridos cubren teclado, duración, cambio de idioma, búsqueda del FAQ, filtros vacíos, detalle con precios finales, recuperación de foco, respuestas HTTP, SEO, imágenes y navegación móvil.

## Assets

### Refinamiento visual

La portada usa un header fijo con fondo translúcido, controles de relieve discreto, buscador elevado con dos campos y CTA completo, cuatro beneficios, miniaturas ilustradas, secciones más compactas y FAQ con transiciones nativas progresivas. Se conservan las rutas, el catálogo, las traducciones y el comportamiento de compra desactivado.

El azul de marca es `#1677FF`, con `#126DE8` para botones con texto blanco y `#0D5BD7` para hover y texto. El naranja `#FF8A3D` y su superficie `#FFE7D6` aportan personalidad; el titular usa un derivado de naranja con contraste suficiente. Los estilos de marketing viven en `src/styles/marketing.css`; las bases y páginas informativas/planes permanecen en `src/app/globals.css`.

`IconBadge` unifica los iconos de confianza y ventajas. `MascotIllustration` y `DestinationArtwork` separan el asset de su composición. Las seis ilustraciones provisionales originales de `public/illustrations/` comparten geometría, proporción y paleta; se reemplazan mediante `Destination.illustration` en el catálogo. Si se omite esa propiedad, el componente admite la fotografía original como alternativa. La mascota se usa únicamente en el hero.

`public/images/traveler-cat.svg` es una ilustración original provisional, construida para esta fase. Sustituir este archivo por la mascota final conservando el espacio del componente `Hero`. No es la identidad final aprobada.

Fotografías originales conservadas como alternativas locales. Procedencia:

| Destino        | Recurso de origen                                                                                         |
| -------------- | --------------------------------------------------------------------------------------------------------- |
| Japón          | [Unsplash photo-1493976040374-85c8e12f0c0e](https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e) |
| Estados Unidos | [Unsplash photo-1485871981521-5b1fd3805eee](https://images.unsplash.com/photo-1485871981521-5b1fd3805eee) |
| Europa         | [Unsplash photo-1502602898657-3e91760cbb34](https://images.unsplash.com/photo-1502602898657-3e91760cbb34) |
| Tailandia      | [Unsplash photo-1528181304800-259b08848526](https://images.unsplash.com/photo-1528181304800-259b08848526) |
| Reino Unido    | [Unsplash photo-1513635269975-59663e0ac1ad](https://images.unsplash.com/photo-1513635269975-59663e0ac1ad) |
| Australia      | [Unsplash photo-1506973035872-a4ec16b8e8d9](https://images.unsplash.com/photo-1506973035872-a4ec16b8e8d9) |

## Pendiente antes del lanzamiento comercial

1. Confirmar branding definitivo, contenidos comerciales, soporte y políticas legales revisadas.
2. Integrar sincronización del catálogo eSIM Access, cobertura, operadores, activación, recargas y precios finales verificados en el servidor.
3. Conectar el flujo de compra a las tablas privadas de pedidos y eSIM ya creadas en Supabase.
4. Implementar Stripe Checkout con validación de precios en servidor, webhooks firmados, estados de pedido e idempotencia.
5. Aprovisionar eSIM únicamente tras confirmar el pago, gestionar reintentos y entregar instrucciones mediante Resend sin exponer secretos en el cliente.
6. Incorporar administración privada y controles de acceso en una fase posterior.
7. Medir rendimiento en despliegue real, revisar accesibilidad con dispositivos y lectores de pantalla y configurar monitorización.

Compatible con Vercel mediante el preset Next.js; los cambios en `main` se despliegan mediante la integración de GitHub. El dominio canónico configurado es `https://mytripsim.com`.

Documentación oficial consultada: [instalación de Next.js](https://nextjs.org/docs/app/getting-started/installation) y [Tailwind con Next.js](https://tailwindcss.com/docs/installation/framework-guides/nextjs).
