# Vercel y Supabase

Repositorio: [gutyclick/mts](https://github.com/gutyclick/mts). Alojamiento en Vercel e integración del catálogo con Supabase/PostgreSQL. La conexión remota depende de configurar el proyecto; consulta [migración, variables y verificación](supabase-setup.md).

## Vercel

1. Importar `gutyclick/mts`, preset Next.js y directorio raíz `.`. Usar Node.js 24.x.
2. Mantener instalación `npm ci`, build `npm run build` y rama de producción `main`.
3. Sin variables de Supabase, la web usa el catálogo local. Con ambas variables, lee el catálogo publicado desde la base de datos.
4. Configurar `SUPABASE_URL` y `SUPABASE_PUBLISHABLE_KEY` en Settings → Environment Variables para los entornos deseados. Volver a desplegar tras cambiar variables. No se necesita una clave secret/service-role para esta etapa.
5. Verificar `/en`, `/es`, `/sitemap.xml`, buscador, directorio, selección de plan y traducción. El checkout sigue siendo de ejemplo, sin pagos ni emisión de eSIM.
6. Configurar `mytripsim.com` en Domains cuando corresponda; las URLs canónicas ya usan ese dominio.

`vercel.json` no contiene credenciales. `.vercel/` está excluido de Git. Las variables actuales se leen exclusivamente en el servidor, sin `NEXT_PUBLIC_`.

## Supabase

Seguir la [guía de conexión](supabase-setup.md): identificar el proyecto, revisar/aplicar la migración y el seed sin precios, configurar la clave publicable y ejecutar `npm run supabase:check`. No conectar automáticamente proyectos de otras aplicaciones ni restablecer bases remotas.

RLS limita las consultas a registros publicados. Ni visitantes ni cuentas normales tienen permisos de escritura. El panel dentro de la web sigue siendo una muestra; la edición inicial se realiza desde el Dashboard autenticado de Supabase.

La futura implementación de pedidos, pagos y aprovisionamiento necesitará sus propias tablas, políticas y operaciones de servidor. No añadir claves del proveedor a la configuración de esta etapa.

## Credenciales y archivos locales

Copiar `.env.example` a `.env.local`. Los archivos `.env*` están excluidos de Git, salvo la plantilla vacía; también se excluyen metadatos locales de Supabase, claves privadas, logs y builds. Nunca pegar secretos en el chat, código o documentos.

Antes de un commit, preparar únicamente los archivos revisados y ejecutar:

```sh
npm run check:secrets
git diff --cached --stat
```

El comprobador examina los bytes del índice y señala archivos sensibles o patrones de credenciales sin imprimir sus valores. No sustituye la revisión de los cambios.

Referencias oficiales: [Git con Vercel](https://vercel.com/docs/git), [variables de Vercel](https://vercel.com/docs/environment-variables), [claves de Supabase](https://supabase.com/docs/guides/getting-started/api-keys), [seguridad y RLS](https://supabase.com/docs/guides/database/secure-data).
