# Google Ads — Consent Mode avanzado

Tag: AW-653792266. El propietario autorizó expresamente pasar a modo avanzado, incluida la posibilidad de señales sin cookies antes de aceptar.

Inicialización: Next Script beforeInteractive establece ad_storage, ad_user_data, ad_personalization y analytics_storage en denied, activa ads_data_redaction y encola js. Solo después, el componente público configura la etiqueta con el estado permitido. next/script carga gtag.js afterInteractive independientemente de la elección previa en rutas públicas admitidas. Las rutas privadas no cargan ni configuran el destino. Una navegación desde una página pública a una privada comunica denied; un script ya descargado no puede deshacerse.

Aceptar expresamente la opción de cookies publicitarias concede únicamente ad_storage/ad_user_data. Personalización y almacenamiento analítico permanecen denegados, sin conversiones mejoradas. DNT/GPC impiden conceder permisos. Rechazo o retirada vuelve a denied: el modo avanzado puede seguir transmitiendo señales sin cookies. Configuración de página: URL sin query/hash, título genérico y referrer vacío; no se envían correo, QR, instalación, tarjeta, saldo ni usuario.

La elección se guarda por hasta 180 días en mts_google_ads_consent_v1, sin identificador personal y sincronizada entre pestañas. No se reutiliza el consentimiento estadístico o comercial. Avisos ES/EN versión 2026-10-27-v5, sin modificar aceptaciones de pedidos históricos.

La etiqueta base no configura una acción de compra: faltan su etiqueta de conversión y una integración verificada con pagos. No se disparan conversiones por redirecciones del navegador.

Verificación previa: 11 pruebas de configuración/consentimiento/avisos legales aprobadas. La comprobación de Google Ads puede tardar o verse afectada por bloqueadores; la presencia del script no certifica su detección en la cuenta. Sustituye el modo básico documentado en la revisión anterior.

Fuente: https://developers.google.com/tag-platform/security/concepts/consent-mode
