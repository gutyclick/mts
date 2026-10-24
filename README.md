# MyTripSim

Repositorio: [gutyclick/mts](https://github.com/gutyclick/mts). Alojamiento previsto: **Vercel**. Persistencia prevista: **Supabase/PostgreSQL**. Consulta la [guía de despliegue y credenciales](docs/deployment.md).

Primera versión del sitio público de **MyTripSim**, marca de **YellowCat Enterprises LLC**. Catálogo local ilustrativo, inglés y español, sin pagos ni aprovisionamiento real de eSIM.

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

No se necesitan variables de entorno ni credenciales para esta fase. `.env.example` contiene únicamente variables futuras de Supabase con valores vacíos. Nunca colocar claves secretas de Stripe, eSIM Access, Supabase o Resend en variables `NEXT_PUBLIC_*`, archivos versionados o registros. `.env.local`, `.vercel/` y los metadatos locales de Supabase están excluidos de Git.

## Implementado

- Next.js App Router, TypeScript estricto, Tailwind CSS 4, Lucide, ESLint y Prettier. Componentes nativos accesibles en lugar de agregar una biblioteca de UI sin necesidad.
- Portada con héroe, búsqueda, duración opcional, beneficios, seis destinos, pasos, ventajas, FAQ y pie de página.
- Identidad azul/naranja, Plus Jakarta Sans e Inter mediante `next/font`, sistema de tokens, gato viajero SVG original reemplazable y fotografía local optimizada por `next/image`.
- Diccionarios centralizados, rutas traducidas y cambio de idioma que conserva la página equivalente. El cambio de idioma realiza navegación de documento para actualizar correctamente `<html lang>`; el resto utiliza navegación de Next.js.
- Búsqueda local insensible a mayúsculas y tildes, alias en ambos idiomas, teclado, cierre con Escape y estados vacíos.
- Directorio filtrable; páginas de Japón, Estados Unidos, Europa, Tailandia, Reino Unido y Australia.
- Cuatro planes de prueba por destino, filtros combinables de datos y vigencia, diálogo nativo con contención de foco y detalle de precio, red, activación, recarga y cobertura. La duración de la portada se conserva como filtro inicial.
- Acción de checkout que explica que no está activa y no crea pedidos ni simula cobros.
- Guías de funcionamiento, compatibilidad y ayuda. Términos, privacidad y reembolsos como borradores claramente señalados y con `noindex`.
- Metadata localizada, canonical, hreflang, Open Graph, imagen social, sitemap, robots y datos estructurados veraces de la organización. Sin reseñas ni ofertas estructuradas ficticias.
- Diseño adaptable, menú móvil, foco visible, enlace para saltar al contenido, FAQ nativa y respeto a movimiento reducido.

## Rutas

| Página           | Inglés              | Español              |
| ---------------- | ------------------- | -------------------- |
| Inicio           | `/en`               | `/es`                |
| Destinos         | `/en/destinations`  | `/es/destinos`       |
| Destino y planes | `/en/esim/[slug]`   | `/es/esim/[slug]`    |
| Funcionamiento   | `/en/how-it-works`  | `/es/como-funciona`  |
| Compatibilidad   | `/en/compatibility` | `/es/compatibilidad` |
| Ayuda            | `/en/help`          | `/es/ayuda`          |
| Términos         | `/en/terms`         | `/es/terminos`       |
| Privacidad       | `/en/privacy`       | `/es/privacidad`     |
| Reembolsos       | `/en/refunds`       | `/es/reembolsos`     |

Slugs compartidos: `japan`, `united-states`, `europe`, `thailand`, `united-kingdom`, `australia`. Idiomas, páginas y destinos desconocidos devuelven 404.

## Arquitectura

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
    plan-browser.tsx         Filtros y diálogo de detalle
    faq.tsx                  Accordion nativo, sin JavaScript
    site-navigation.tsx      Menú e idioma
    footer.tsx
    ui.tsx                   Marca, botones y encabezados compartidos
  lib/
    catalog.ts               Tipos, catálogo, búsqueda, filtros y moneda
    i18n.ts                  Diccionarios y equivalencias de rutas
    seo.ts                   URLs y constructor de metadata
    integrations/contracts.ts Contratos futuros, sin implementaciones
  proxy.ts                   Idioma del documento en solicitudes SSR
public/images/               Fotografías y placeholder de mascota
tests/                       Tests de lógica y recorridos reales
scripts/                     Capturas y auditoría de UI
```

Las páginas de contenido son Server Components. Búsqueda, filtros, diálogo y menú son islas cliente. El idioma de documento se obtiene de una cabecera interna sobrescrita por el proxy; las páginas públicas se renderizan en servidor por solicitud. Sitemap, robots e imagen social son estáticos. No se depende de servicios externos durante la navegación. `next/font` descarga fuentes durante la compilación; el entorno de build necesita acceso a Google Fonts.

El catálogo de prueba tiene `source: "mock"`; los datos no verificados del proveedor permanecen en `null`. Las interfaces futuras separan el catálogo mayorista de las ofertas de venta. Las credenciales, validación de precios y aprovisionamiento pertenecerán exclusivamente al servidor.

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

La auditoría usa axe-core, comprueba reglas WCAG A/AA seleccionadas en 360 y 1440 px, y busca desbordamiento horizontal en 360, 768, 1024 y 1440 px. No sustituye una auditoría manual completa ni mediciones de Core Web Vitals en usuarios reales. Las capturas se guardan en `docs/previews/`.

La búsqueda por alias, rutas equivalentes, precios de prueba y filtros tienen tests unitarios. Los recorridos cubren teclado, duración, cambio de idioma, FAQ, filtros vacíos, detalle y checkout desactivado, recuperación de foco, respuestas HTTP, SEO, imágenes y navegación móvil.

## Assets

`public/images/traveler-cat.svg` es una ilustración original provisional, construida para esta fase. Sustituir este archivo por la mascota final conservando el espacio del componente `Hero`. No es la identidad final aprobada.

Fotografías descargadas de Unsplash y servidas localmente. Procedencia:

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
3. Persistir catálogo y pedidos en PostgreSQL/Supabase con permisos apropiados.
4. Implementar Stripe Checkout con validación de precios en servidor, webhooks firmados, estados de pedido e idempotencia.
5. Aprovisionar eSIM únicamente tras confirmar el pago, gestionar reintentos y entregar instrucciones mediante Resend sin exponer secretos en el cliente.
6. Incorporar administración privada y controles de acceso en una fase posterior.
7. Medir rendimiento en despliegue real, revisar accesibilidad con dispositivos y lectores de pantalla y configurar monitorización.

Compatible con Vercel mediante el preset Next.js. Este trabajo no despliega ni publica el sitio. El dominio canónico configurado es `https://mytripsim.com`.

Documentación oficial consultada: [instalación de Next.js](https://nextjs.org/docs/app/getting-started/installation) y [Tailwind con Next.js](https://tailwindcss.com/docs/installation/framework-guides/nextjs).
