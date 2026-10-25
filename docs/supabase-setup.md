# Conectar el catálogo a Supabase

## Estado de esta entrega

El repositorio contiene la migración, los datos iniciales y el lector servidor. No implica que un proyecto remoto ya esté creado o conectado. El modo conectado se activa solamente cuando existen las dos variables de entorno. El panel «Administración de muestra» sigue siendo una demostración y no administra la base de datos.

## 1. Preparar el proyecto

Crear o elegir un proyecto de MyTripSim desde el Dashboard. Mantener su contraseña de base de datos en el gestor de contraseñas. En el proyecto debe estar habilitada la Data API para el esquema `public` (configuración habitual). No conectar una base con tablas de otro producto sin revisar antes la migración.

Desde la raíz del repositorio, con la CLI oficial:

```sh
npx supabase login
npx supabase link --project-ref TU_PROJECT_REF
npx supabase db push --dry-run
npx supabase db push --include-seed
```

Introducir la contraseña en el diálogo de la CLI, nunca como argumento del comando ni en un archivo versionado. No ejecutar `db reset --linked`: no es necesario para esta integración.

La migración crea `catalog_destinations`, `catalog_plans` y la vista `published_catalog_destinations`. El seed inserta 241 destinos y 1.730 planes fijos en una transacción. Si se repite, conserva cualquier fila existente, incluidas sus ediciones y estado de publicación. Una futura actualización masiva necesitará una migración revisada, no sobreescribir el catálogo.

Alternativa manual: ejecutar primero `supabase/migrations/20261024000100_catalog.sql` y después `supabase/seed.sql` en el SQL Editor del proyecto. No mezclar esta alternativa con `db push` sin reconciliar el historial de migraciones.

## 2. Configurar la web

Copiar `.env.example` a `.env.local` e introducir los valores desde el Dashboard → Connect / API Keys:

```dotenv
SUPABASE_URL=https://TU_PROJECT_REF.supabase.co
SUPABASE_PUBLISHABLE_KEY=
```

Usar la clave **publishable** que empieza por `sb_publishable_`. No usar `secret`, `service_role` ni una contraseña. Estas variables se leen exclusivamente en el servidor; no llevan `NEXT_PUBLIC_`. `.env.local` está excluido de Git. No hace falta una clave privilegiada para leer este catálogo.

```sh
npm run supabase:check
npm run dev
```

El comprobador consulta los destinos y sus planes, valida los campos y confirma que los recuentos coinciden. Imprime cantidades, nunca claves. Un catálogo conectado vacío o inválido es un fallo de configuración que debe resolverse antes de desplegar.

## 3. Vercel

Añadir las mismas dos variables en Settings → Environment Variables, en los entornos que deban utilizar ese proyecto. Volver a desplegar. No agregar credenciales al repositorio. La web solicita el catálogo por petición; no requiere otro despliegue para publicar o retirar un plan.

Sin ambas variables, se utiliza el catálogo local. Con solo una, la configuración falla. Con ambas, los errores no recuperan silenciosamente datos locales ni vuelven a publicar planes retirados.

## 4. Verificar un cambio real

1. Comprobar portada, buscador, directorio, ficha y sitemap con la base conectada.
2. En Table Editor, despublicar temporalmente un plan con `is_published = false`.
3. Confirmar que desaparece del selector, se actualiza el recuento del destino y su enlace directo/compra de muestra devuelve 404.
4. Restaurar `is_published = true` y comprobar que regresa.

La vista calcula GB mínimos/máximos y cantidad de planes publicados. Un destino sin planes publicados desaparece del directorio, buscador y sitemap. Para retirar un destino completo, despublicarlo en `catalog_destinations`; sus planes dejan de ser visibles por RLS.

## Edición y permisos

Por ahora, editar desde el Dashboard autenticado de Supabase. Los roles anónimo y usuario autenticado solo pueden leer registros publicados; ninguno puede insertar, modificar o borrar. Una cuenta de cliente no recibe permisos de administración.

Las imágenes se conservan como rutas locales de los recursos actuales. Subir imágenes a Storage requiere una fase adicional con sus políticas; no se habilita un bucket público de escritura. La información técnica debe conservar `dataGb`/`days` coherentes con el plan; las redes declaradas distintas de las del operador mantienen sus avisos actuales.

## Pruebas

```sh
npm run test:supabase
npm test
npm run typecheck
npm run lint
npm run build
```

Las pruebas SQL usan PostgreSQL embebido (PGlite), ejecutan la migración y el seed completos y prueban ambos roles, RLS, denegación de escrituras y repetición de importaciones. No sustituyen `supabase:check` y la prueba real de publicación en el proyecto remoto.

Referencias oficiales: [migraciones y seed](https://supabase.com/docs/guides/local-development/cli-workflows), [claves de API](https://supabase.com/docs/guides/getting-started/api-keys), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).
