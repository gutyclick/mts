# Consulta técnica preparada: Botón de Pago Yappy

Destinatario: botondepagoyappy@bgeneral.com
Asunto: Botón de Pago en producción — validate/merchant correcto, payment-wc devuelve YAPPY-004

Hola, equipo de integración:

Estamos conectando el Botón de Pago V2 de https://www.mytripsim.com.

El 7 de noviembre de 2026, la validación POST /payments/validate/merchant devolvió HTTP 200 y status.code 0000, con token string y epochTime number. Al utilizar esa autorización en POST /payments/payment-wc, el servidor devolvió HTTP 400, status.code YAPPY-004 y ningún objeto body utilizable. No se confirmó ningún pago.

La solicitud de diagnóstico autorizada utiliza orderId alfanumérico único de 15 caracteres, el dominio del comercio, paymentDate procedente de epochTime, ipnUrl HTTPS del mismo dominio, y montos string con dos decimales: subtotal y total 1.00, taxes y discount 0.00. Authorization contiene el token recibido, conforme a la guía pública.

¿Pueden indicar el significado de YAPPY-004 y qué validación lo genera? ¿Requiere alguna activación adicional el comercio aunque validate/merchant sea correcto? Confirmen también si aliasYappy es opcional en producción y si hay requisitos adicionales del endpoint IPN o del esquema de la orden que no aparezcan en la guía pública.

Podemos facilitar la referencia de la solicitud y el ID de comercio por su canal seguro. Este mensaje no incluye tokens ni claves.

Gracias.

---
Borrador preparado; no enviado. Referencia técnica: https://www.yappy.com.pa/comercial/desarrolladores/boton-de-pago-yappy-nueva-integracion/
