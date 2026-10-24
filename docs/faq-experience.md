# FAQ y valoración de respuestas

## Diseño

El centro de ayuda conserva Plus Jakarta Sans para títulos, Inter para texto, el azul de marca `#1677FF`, azul accesible `#175CA6`, fondo celeste `#EDF5FF`, tinta `#14213D` y notas cálidas `#FFF5E9`. Seis tarjetas con iconos de viaje permiten elegir tema; el buscador consulta preguntas, respuestas, pasos y notas. Un segundo toque sobre el tema activo vuelve a todos los temas. Las respuestas mantienen acordeones nativos y convierten procedimientos en pasos numerados. La sección de valoración se integra al final de cada respuesta.

Las 29 respuestas por idioma se organizan en primeros pasos, compatibilidad, instalación, datos, viaje y conexión. Los IDs son estables y compartidos entre idiomas. Los enlaces `#faq-hotspot`, `#faq-data-roaming` y equivalentes abren y enfocan una respuesta concreta. Los enlaces relacionados limpian filtros para no ocultar el destino y mantienen el foco de teclado en su encabezado.

El catálogo ofrece únicamente datos fijos. La respuesta con ID estable `daily-fup` ahora aclara que no se ofrecen paquetes diarios; se conserva el ID para mantener los enlaces existentes.

## Información del proveedor

Las políticas sobre datos sin llamadas/SMS salvo indicación expresa, roaming obligatorio en la eSIM de viaje, QR vinculado a un solo dispositivo y soporte de hotspot proceden de las respuestas entregadas por el usuario. No se atribuyen esas políticas a todos los proveedores de eSIM.

La configuración APN se revisó con el segundo CSV: `vmobile.jp` corresponde a variantes IIJ de Japón; otras variantes del mismo destino utilizan APN diferentes. Se remite a la ficha y las instrucciones del producto concreto en lugar de aplicar una configuración universal por país. No se incluyen contraseñas reales ni códigos de activación.

La capacidad de almacenar perfiles se describe según modelo y software, evitando cifras universales. Wi-Fi Calling queda condicionado al equipo y operador habitual, incluyendo posibles restricciones y cargos. Referencias oficiales consultadas:

- [Apple: configurar eSIM](https://support.apple.com/en-us/118669).
- [Apple: dual SIM](https://support.apple.com/en-us/109317).
- [Apple: compartir internet](https://support.apple.com/en-us/111785).
- [Google: hotspot en Android](https://support.google.com/android/answer/9059108?hl=en).

## Valoraciones y más ayuda

Cada artículo permite elegir «Sí, me ayudó» o «Necesito más ayuda», cambiar la elección y conservarla al recargar o cambiar de idioma. Se guarda únicamente un valor permitido (`helpful` o `more-help`) con el ID del artículo, en almacenamiento local del navegador. No se guardan datos personales ni se transmiten valoraciones a un servidor. El usuario confirmó que todavía no dispone de canal de contacto ni Supabase conectado; por ello no se simulan solicitudes recibidas, tickets ni envíos.

La interfaz informa del alcance local. Si el almacenamiento está bloqueado, la elección sigue funcionando durante la visita y lo indica. La lectura ignora valores desconocidos. Los cambios se sincronizan entre pestañas del mismo origen mediante el evento de almacenamiento.

«Necesito más ayuda» abre respuestas relacionadas y un resumen copiable de la consulta con espacios para modelo, destino/plan y error. El resumen es de solo lectura y no recoge datos del visitante. El portapapeles se usa solo al pulsar Copiar; si falla, se mantiene disponible el texto para copiarlo manualmente. No se envía nada automáticamente. Se recuerda mantener privados QR y credenciales.

Cuando exista un canal oficial y almacenamiento central, podrán añadirse sin cambiar los IDs de las preguntas. Hasta entonces, estas valoraciones no constituyen métricas agregadas ni solicitudes de soporte.

## Verificación

Playwright comprueba temas, búsqueda de APN, apertura de enlaces directos, foco al navegar entre respuestas, persistencia entre idiomas, almacenamiento bloqueado, copiado y alternativa manual. Los tests de catálogo verifican IDs únicos, equivalencia entre idiomas, enlaces relacionados válidos y las 29 preguntas. Las capturas incluyen la página, respuesta expandida y siguientes pasos en escritorio y teléfono. La auditoría axe cubre el FAQ y sus estados interactivos.
