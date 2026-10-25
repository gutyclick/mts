# Carrito y checkout

El cliente añade cualquier plan fijo al carrito, cambia cantidades y continúa en una única página de compra. El carrito se conserva entre visitas e idiomas. La cabecera abre un panel con animación discreta, foco contenido, cierre por Escape y controles táctiles. Se respeta la preferencia de movimiento reducido.

El checkout solicita correo y aceptación de compatibilidad/condiciones. No solicita dirección ni teléfono para un producto digital. La cuenta es opcional; se puede iniciar sesión o crear una cuenta y volver a la compra. Una sesión existente rellena el correo verificado. Las tarjetas y credenciales de pago no se almacenan en el carrito ni en la aplicación.

Mientras el pago esté desactivado, el correo solo se mantiene en el campo del formulario: no se envía ni se guarda. Las páginas de checkout no se cachean ni se indexan.

Se conserva únicamente la referencia de destino/plan y cantidad en almacenamiento local, nunca datos del cliente. El servidor vuelve a consultar el catálogo publicado para mostrar los planes; no confía en nombres, redes ni importes enviados por el navegador. Referencias retiradas aparecen como no disponibles y deben eliminarse antes de continuar. Los errores de conexión se distinguen de un carrito vacío.

El propietario eligió preparar primero carrito y checkout, y conectar los cobros después. Los precios finales aún no existen en el catálogo. No se importan precios de los CSV del proveedor, no se inventan importes y un precio pendiente nunca se interpreta como cero. El pago permanece bloqueado hasta disponer de precios finales y de las conexiones de cobro y emisión. No se muestra una confirmación de compra ficticia.

Implementación: modelo y límites compartidos; resolución servidor y API; contexto global con persistencia, panel y acceso desde la cabecera; botones en cada selector; checkout localizado y sesión opcional; retorno seguro desde acceso/registro; pruebas de persistencia, cantidades, referencias manipuladas, idioma, teclado y móvil. La entrega real se conectará a un pago confirmado por webhook, con idempotencia y reintentos, nunca al mero retorno del navegador.

## Verificación

Se comprobaron compilación, tipos, lint, formato, tests de catálogo/carrito, aislamiento RLS y recorridos de navegador de escritorio y móvil. La auditoría de comercio verifica desbordamientos de 320 a 1440 px y accesibilidad automática con el panel abierto y en el checkout. La prueba de cuentas confirma que el acceso retorna a la compra, conserva el carrito y rellena el correo verificado. No se enviaron correos ni se crearon pagos durante las pruebas; las cuentas desechables se eliminan al finalizar.

El carrito admite hasta 20 referencias distintas y 10 eSIM por referencia. Si el navegador bloquea el almacenamiento, permanece disponible en memoria durante la visita. La API distingue referencias retiradas de errores de servicio y rechaza importes, campos personales y cantidades inválidas enviados como parte del carrito.

Referencias consultadas: [Checkout Sessions de Stripe](https://docs.stripe.com/api/checkout/sessions/create), [entrega tras el pago](https://docs.stripe.com/checkout/fulfillment).
