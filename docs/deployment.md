# Vercel y Supabase

Repositorio: [gutyclick/mts](https://github.com/gutyclick/mts). La aplicación usa Vercel para alojamiento y está preparada para integrar Supabase como PostgreSQL en la siguiente fase. Esta entrega no crea recursos remotos ni conecta una base de datos.

## Vercel

1. Importar `gutyclick/mts` como proyecto de Vercel.
2. Seleccionar el preset **Next.js**, directorio raíz `.` y Node.js **24.x**. Se incluye `.nvmrc` para desarrollo local.
3. Conservar instalación `npm ci`, compilación `npm run build` y salida automática de Next.js. La rama de producción será `main`.
4. El catálogo importado y saneado funciona sin variables de entorno. No añadir claves de pago ni del proveedor de eSIM para esta fase.
5. Cuando se integre Supabase, añadir las variables desde **Project Settings → Environment Variables**, separando Development, Preview y Production. Los cambios de variables requieren un nuevo despliegue.
6. Verificar `/en`, `/es`, `/sitemap.xml`, cambio de idioma, FAQ y consulta de planes sin precios. No hay checkout habilitado.
7. Configurar `mytripsim.com` en Domains cuando corresponda; las URLs canónicas ya usan ese dominio.

`vercel.json` declara el framework y no contiene IDs de cuentas, tokens ni credenciales. `.vercel/` está excluido de Git.

## Supabase

La primera fase usa `src/lib/catalog.ts`; no existe una conexión activa, migración aplicada ni acceso a datos reales. Las siguientes variables son una convención futura y no son consumidas por la aplicación actual:

| Variable                   | Uso previsto                                     | Ubicación                                      |
| -------------------------- | ------------------------------------------------ | ---------------------------------------------- |
| `SUPABASE_URL`             | URL del proyecto                                 | Entorno del servidor                           |
| `SUPABASE_PUBLISHABLE_KEY` | Acceso sujeto a permisos y RLS                   | Entorno del servidor en la arquitectura actual |
| `SUPABASE_SECRET_KEY`      | Operaciones privilegiadas cuando sean necesarias | Exclusivamente servidor                        |

La clave publicable está diseñada para usos públicos, pero en esta fase no se necesita ninguna clave en el navegador. Las claves secretas y la antigua `service_role` pueden saltarse RLS: nunca incluirlas en el frontend, en variables `NEXT_PUBLIC_*`, en commits o en registros.

Al implementar la persistencia:

- Crear esquemas y migraciones versionadas para catálogo y pedidos, sin datos personales ni credenciales en los archivos SQL.
- Habilitar RLS en las tablas expuestas y definir políticas explícitas; impedir que clientes públicos lean o modifiquen pedidos de otras personas.
- Leer precios y registrar pedidos desde código de servidor. No confiar en importes enviados por el navegador.
- Crear un cliente privilegiado solo para operaciones de backend concretas; importar los módulos que usan secretos a través de una frontera `server-only`.
- Usar recursos o datos separados para pruebas y producción. No aplicar migraciones contra producción de forma implícita.

## Credenciales y archivos locales

Copiar `.env.example` a `.env.local` cuando haga falta. La plantilla solo contiene nombres de variables con valores vacíos. Los archivos `.env*` están excluidos, salvo `.env.example`; también se excluyen `.vercel/`, metadatos locales de Supabase, claves privadas, logs, builds y reportes de tests.

Antes de un commit:

```sh
git add .
npm run check:secrets
git diff --cached --stat
```

`check:secrets` revisa el contenido preparado en el índice de Git y bloquea archivos sensibles o patrones habituales de credenciales sin imprimir los valores. Es una comprobación preventiva de alcance limitado; no reemplaza las funciones de detección de secretos de GitHub ni una revisión de los cambios.

Referencias oficiales: [Git con Vercel](https://vercel.com/docs/git), [variables de entorno en Vercel](https://vercel.com/docs/environment-variables), [claves de Supabase](https://supabase.com/docs/guides/api-keys), [seguridad de datos y RLS](https://supabase.com/docs/guides/database/secure-data).
