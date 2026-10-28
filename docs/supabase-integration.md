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

## Conexión remota completada

Proyecto **MyTrip Sim**, referencia `xfdwqalkkjclburzcwlv`, región `us-east-1`. La migración `20261024000100` y el seed ya están aplicados, con 241 destinos y 1.730 planes fijos enriquecidos. El historial local/remoto coincide. No se modificaron otros proyectos.

Vercel `mts` tiene las dos variables en Production, Preview y Development. La clave publicable está marcada como sensible en Production/Preview y no se incluye en el código ni en el HTML público. La web de producción es [www.mytripsim.com](https://www.mytripsim.com/es). La configuración local y los metadatos de ambos servicios están excluidos de Git.

## Verificación realizada

- 16 pruebas existentes de catálogo/compatibilidad/datos técnicos y 4 pruebas nuevas de API/PostgreSQL pasaron.
- La migración y el seed completos se ejecutaron dos veces en PostgreSQL embebido; RLS y denegación de escrituras se comprobaron con ambos roles públicos.
- Un servidor Next de producción conectado a una Data API local respaldada por PostgreSQL confirmó ediciones en vivo, retirada de planes/destinos, enlaces 404, búsqueda, directorio, sitemap y pantalla de error sin recuperación del catálogo local.
- Build conectado y build sin configuración, TypeScript, ESLint, formato y 56 escenarios de navegador en escritorio/móvil pasaron.
- El comprobador real recorrió los 241 destinos y validó sus 1.730 planes. Ambos roles carecen de permisos UPDATE. Una consulta con la clave publicable devolvió HTTP 200; un intento de actualizar un identificador inexistente fue rechazado con HTTP 401 y código PostgreSQL `42501`.
- El asesor de seguridad de Supabase no encontró incidencias tras la importación.
- El build con `.env.local` y los 56 escenarios de navegador pasaron contra la base real.
- Producción: portada ES/EN, directorio, Japón, Afganistán, FAQ y sitemap devolvieron HTTP 200, sin la clave publicable en el HTML.
- Un marcador temporal en el nombre de `AF_1_7` apareció en producción sin desplegar de nuevo. El nombre original se restauró en `finally`; una comprobación posterior confirmó que el marcador ya no aparece. No se cambiaron datos, duración, redes ni disponibilidad.
- En producción móvil (390 px), Japón mostró 23 planes y Afganistán 6, con selección visible y sin desbordamiento horizontal.

La administración web privada, cuentas de clientes, Stripe live y entrega de eSIM están conectados. El propietario confirmó compras reales satisfactorias el 27 de octubre de 2026. Las secciones anteriores describen la integración inicial; el estado operativo está en [pagos de producción](production-payments.md) y [SimCoins](simcoins.md).
