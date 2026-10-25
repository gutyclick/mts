# Integración de Supabase: catálogo

## Alcance

Primera etapa autorizada: migrar el catálogo existente y conectar su lectura sin cambiar la fachada. Conservamos 241 destinos y 1.730 planes fijos, operadores, redes, cobertura y condiciones. No incorporamos precios ni credenciales del proveedor. Cuentas de clientes, pagos y emisión de eSIM corresponden a etapas posteriores.

La opción elegida es PostgreSQL administrado por Supabase, migraciones versionadas y lectura desde el servidor Next.js mediante la Data API con clave publicable y RLS. Evita introducir una segunda API o un ORM para este catálogo. Los archivos JSON continúan siendo el origen de la importación inicial y el modo local explícito; nunca se usan como recuperación silenciosa de una base conectada.

## Datos y seguridad

- `catalog_destinations`: identidad, nombres ES/EN, alias, imagen local y publicación.
- `catalog_plans`: identidad estable, destino, GB, días, tipo fijo, información técnica y publicación. Sin columnas comerciales.
- Lectura anónima: solamente destinos publicados con planes publicados y sus planes.
- Sin escrituras desde la web pública. La edición inicial se realiza desde el Dashboard autenticado de Supabase. El panel privado dentro de MyTripSim requiere una siguiente etapa de autenticación y autorización.
- Importación inicial mediante SQL revisable, transaccional e idempotente: no elimina registros ni sobrescribe registros existentes al repetirla.
- Clave publicable exclusivamente en configuración del servidor. No hace falta una clave secret/service-role para consultar el catálogo.
- Con configuración incompleta se produce un error explícito. Una base conectada vacía permanece vacía; un destino retirado devuelve 404.

## Plan de ejecución

1. Crear migración, generador del catálogo inicial y pruebas SQL que verifiquen lectura/publicación y denegación de escritura.
2. Añadir lector servidor con paginación, tiempo límite, selección explícita de campos y validación. Probar errores, datos inválidos y ausencia de precios.
3. Conectar portada, búsqueda, directorio, destinos, enlaces de plan, compra de muestra y sitemap a la misma fuente.
4. Ejecutar pruebas de datos, seguridad SQL, tipos, lint y build. Documentar conexión y comprobación remota. No declarar la conexión real completada hasta verificar el proyecto del usuario.

## Pendiente de acceso

La CLI dispone de una sesión guardada, pero los proyectos visibles pertenecen a otras aplicaciones. No hay un proyecto MyTripSim identificado/enlazado ni variables locales. La aplicación remota de migraciones y la configuración de Vercel quedan pendientes de definir el proyecto de destino. Nunca pegar claves secretas en documentos, Git o chat.

## Verificación realizada

- 16 pruebas existentes de catálogo/compatibilidad/datos técnicos y 4 pruebas nuevas de API/PostgreSQL pasaron.
- La migración y el seed completos se ejecutaron dos veces en PostgreSQL embebido; RLS y denegación de escrituras se comprobaron con ambos roles públicos.
- Un servidor Next de producción conectado a una Data API local respaldada por PostgreSQL confirmó ediciones en vivo, retirada de planes/destinos, enlaces 404, búsqueda, directorio, sitemap y pantalla de error sin recuperación del catálogo local.
- Build conectado y build sin configuración, TypeScript, ESLint, formato y 56 escenarios de navegador en escritorio/móvil pasaron.
- Esta evidencia local no equivale a una conexión verificada contra el proyecto remoto del usuario.
