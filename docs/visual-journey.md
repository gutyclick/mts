# Recorrido visual antes de Supabase

La fase visual conecta el catálogo existente con la ficha completa de un plan, un recorrido de compra de ejemplo, una cartera de eSIM ficticias, instrucciones de instalación y un panel de administración de muestra. No hay integración de base de datos, pagos, cuentas, correo ni aprovisionamiento.

## Pantallas y rutas

| Pantalla              | Inglés                                      | Español                                   |
| --------------------- | ------------------------------------------- | ----------------------------------------- |
| Ficha del plan        | `/en/plan/[slug]/[planId]`                  | `/es/plan/[slug]/[planId]`                |
| Compra de ejemplo     | `/en/checkout?destination=[slug]&plan=[id]` | `/es/compra?destination=[slug]&plan=[id]` |
| Mis eSIM              | `/en/my-esims`                              | `/es/mis-esim`                            |
| Detalle de muestra    | `/en/my-esims?esim=trip-japan`              | `/es/mis-esim?esim=trip-japan`            |
| Instalación           | `/en/install`                               | `/es/instalar`                            |
| Administración visual | `/en/studio`                                | `/es/estudio`                             |

El destino y los enlaces existentes a un plan abren un único selector: filas compactas de GB/días, ordenación ascendente por GB o duración, filtros combinables y ficha completa visible desde el inicio. Elegir otro plan actualiza datos, duración, condiciones y enlace de compra de ejemplo sin abrir un diálogo ni cambiar de pantalla. Los detalles y la cobertura están juntos. El enlace conserva el identificador elegido mediante `?plan=…` y la duración filtrada, también al cambiar de idioma. Los antiguos enlaces `/plan/[slug]/[planId]` siguen funcionando con el plan correspondiente seleccionado. No se inventan operadores, países de un regional o reglas de activación.

La compra de ejemplo muestra resumen, diseño de pago y confirmación de demostración. Los datos del viajero son ficticios y de solo lectura; el formulario de tarjeta es una ilustración sin campos. Las casillas son controles de muestra, no una validación de compra. Avanzar no envía información ni crea pedidos. La confirmación declara que no hubo pago ni emisión de eSIM.

Mis eSIM muestra tres perfiles ficticios (por instalar, activo y finalizado), filtros, detalle de consumo de ejemplo, vigencia, instalación manual pendiente y un dibujo no escaneable en lugar de un QR real. La guía permite alternar entre iPhone y Android. Los controles de demostración de la cartera muestran estados normal, vacío, carga y error, con recuperación al ejemplo.

La administración visual es una muestra pública, claramente identificada como tal, con búsqueda de los 241 destinos, revisión de planes fijos, pedidos ficticios y acceso al contenido del FAQ. No pretende ofrecer autenticación, permisos ni edición real. La navegación de escritorio, móvil y el pie de página permiten acceder a las nuevas pantallas. El cambio de idioma conserva ruta, plan seleccionado y parámetros de contexto.

## Límites de esta fase

- Continúa el catálogo sin precios publicados; no se utilizan costes del CSV.
- Compra, cartera, instalación de muestra y administración tienen `noindex, nofollow` y no aparecen en el sitemap.
- El catálogo completo de planes permanece en rutas servidor. Los componentes de compra reciben un solo plan; la administración recibe únicamente doce muestras para revisar fichas.
- No se generan códigos de activación, credenciales, ICCID, QR funcionales, pedidos ni información personal real.
- Los estados de consumo y fechas de la cartera son ejemplos visibles, sin conexión a servicios externos.
- Los nuevos banners de México, Paraguay y Uruguay se vinculan mediante la sincronización de imágenes existente.
- También se vincularon las imágenes añadidas después de Australia, Canadá, China, Egipto, Noruega, Puerto Rico y Alemania. Hay 19 banners vinculados.

## Verificación prevista

Los recorridos de Playwright comprueban selección exacta del plan, compra sin peticiones de modificación, confirmación honesta, cartera y estados, guía por dispositivo y búsqueda administrativa. También verifican 404 para planes de otro destino, parámetros inválidos, equivalencias de idioma y exclusión de indexación. La auditoría cubre las nuevas pantallas entre 320 y 1440px e incluye estados de compra y cartera. Las capturas muestran escritorio y teléfono para revisar el diseño antes de conectar servicios.
