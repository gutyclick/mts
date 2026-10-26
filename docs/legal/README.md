# Legal de MyTripSim: fuentes y mantenimiento

Versión inicial: 2026-10-26-v1. Contacto: hello@mytripsim.com.

## Datos confirmados por el titular

- Vendedor y responsable: YellowCat Enterprises LLC.
- Dirección publicable: 1209 Mountain Road Pl NE, Albuquerque, NM 87110, United States. El titular confirmó que no lleva suite.
- Jurisdicción de referencia: Nuevo México, Estados Unidos, preservando derechos imperativos aplicables al cliente.
- Devolución comercial por error de compra o cancelación del viaje: revisión individual, sin plazo general ni aprobación automática. Se preservan las devoluciones exigidas por ley.

## Fuentes de contenido

Los ocho archivos Markdown ES/EN de esta carpeta son la fuente editorial de las cuatro páginas públicas. `npm.cmd run legal:build` genera `src/content/legal.json`; el prebuild también lo ejecuta. El componente `LegalPage` añade identidad, fecha, versión, navegación e índice. Para cambios materiales, actualizar `src/lib/legal-version.ts` y conservar las versiones previas en Git.

No se promete cobertura, velocidad o entrega instantánea universales; no se confunde emisión del QR con renuncia automática al desistimiento. No se incluye arbitraje obligatorio ni una exclusión general de responsabilidad o reembolsos.

## Correspondencia con el servicio

- Cuenta o invitado, correo del comprador y beneficiario, compatibilidad y activación por plan.
- Pago por Stripe y emisión después de pago confirmado; QR por Resend. La API de emisión de eSIM Access recibe código de plan y referencia, sin correo del beneficiario en esa llamada.
- Supabase para datos y autenticación; Vercel para alojamiento; Zoho para el contacto; OpenAI para SIM con contexto de pedido autorizado, filtrado, sin herramientas y `store:false`.
- Consentimiento de marketing opcional y desmarcado, con su propia fecha/versión. No se autoriza marketing de terceros.
- Cookie visitante de siete días y limpieza de chats cerrados tras treinta días sin actividad; cierre del chat IA a los diez minutos, sin cerrar tickets humanos pendientes.
- Carrito y referencias técnicas en almacenamiento local, sin conversaciones ni QR del chat.
- Conservación de pedidos/cuentas/tickets expresada por necesidades y obligaciones; no se ha inventado un borrado automático a un número arbitrario de días.

## Evidencia contractual

El checkout exige la versión actual y aceptación explícita de términos/reembolsos, con aviso de privacidad enlazado. `checkout_legal_acceptances` conserva pedido, versión, idioma y fecha del servidor antes de solicitar la sesión de pago. Los reintentos no modifican la fecha anterior; no se retrorellenan pedidos históricos ni se presenta este registro como consentimiento de marketing o privacidad. Los nuevos avisos también se enlazan en el correo al beneficiario.

## Fuentes oficiales consultadas el 26 de octubre de 2026

- [New Mexico DOJ, Consumer Affairs](https://nmdoj.gov/about-the-office/consumer-affairs/).
- [New Mexico, documentación oficial sobre Data Breach Notification Act](https://www.nmlegis.gov/handouts/STTC%20112918%20Item%206%20Attorney%20General%20Report%20on%20Data%20Breach%20Statute.pdf).
- [FTC, información publicitaria clara](https://www.ftc.gov/business-guidance/resources/advertising-faqs-guide-small-business).
- [FTC, promesas de privacidad y seguridad](https://www.ftc.gov/business-guidance/privacy-security).
- [FTC, seguridad y minimización](https://www.ftc.gov/business-guidance/resources/protecting-personal-information-guide-business).
- [FTC, CAN-SPAM](https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business).
- [Your Europe, venta a distancia](https://europa.eu/youreurope/business/selling-in-eu/selling-goods-services/ecommerce-distance-selling/index_en.htm).
- [Comisión Europea, guía de la Directiva 2011/83/UE](https://eur-lex.europa.eu/legal-content/EN/ALL/?uri=CELEX%3A52021XC1229%2804%29): diferencias entre servicios y contenido digital y requisitos de inicio anticipado; no clasificar automáticamente una eSIM como una descarga digital.
- [RGPD, información y derechos cuando resulte aplicable](https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng/).
- [Your Europe, cookies](https://europa.eu/youreurope/business/growing/digitalising/online-privacy/index_en.htm).
- [Stripe](https://stripe.com/privacy), [Supabase](https://supabase.com/privacy), [Resend](https://resend.com/legal/privacy-policy), [Vercel](https://vercel.com/legal/privacy-notice), [eSIM Access](https://esimaccess.com/privacy-policy/), [Zoho](https://www.zoho.com/privacy.html), [OpenAI API](https://developers.openai.com/api/docs/guides/your-data).

## Revisiones operativas a mantener

Estos textos no certifican por sí solos cumplimiento universal ni sustituyen asesoramiento jurídico individual. Revisar con asesoría de Nuevo México el régimen fiscal y de reventa de telecomunicaciones, los mercados de destino y las obligaciones internacionales aplicables. La normativa de consumo puede depender de la residencia del comprador, no solo del destino de viaje.

Mantener un calendario de conservación y borrado, acuerdos con proveedores y mecanismos de transferencia; atender solicitudes de privacidad y preparar el procedimiento de respuesta a incidentes. Verificar la configuración real de infraestructura antes de afirmar que una región concreta es exclusiva. El documento no afirma alojamiento exclusivo por país ni una retención cero de OpenAI.

No enviar campañas comerciales sin dirección postal y mecanismo de baja operativo. El permiso de marketing recogido por checkout no sustituye esas obligaciones. Cualquier integración futura de analítica/publicidad que requiera consentimiento debe bloquearse hasta la elección del usuario. Revisar específicamente la valoración FAQ si se amplía su finalidad.

Las páginas legales se mantienen accesibles desde footer/checkout y con `noindex,follow`: no son páginas de captación ni contienen promesas SEO.

## Validación de esta versión

- 23 pruebas de lógica/seguridad: legal, checkout, emisión, SEO y soporte; sin pagos, emisiones o correos reales.
- Ocho pruebas de navegador en escritorio/móvil y ES/EN: lectura y navegación de las cuatro páginas, aceptación contractual, privacidad del correo y beneficiario opcional.
- Compilación de producción correcta (571 páginas). ESLint de src/tests y de los archivos modificados correcto.
- Revisión visual a 390 y 1440 px, sin desbordamiento horizontal. Tabla de cookies apilada en móvil.
- Aplicada la migración 20261026000300_checkout_legal_acceptance, después de comprobar que era la única pendiente.
- Fuentes complementarias: [EDPB, bases jurídicas](https://www.edpb.europa.eu/topics/key-gdpr-concepts/legal-basis_en), [Comisión Europea, derechos individuales](https://commission.europa.eu/law/law-topic/data-protection/information-individuals_en) y [gestión de solicitudes](https://commission.europa.eu/law/law-topic/data-protection/information-business-and-organisations/dealing-requests-individuals_en).
