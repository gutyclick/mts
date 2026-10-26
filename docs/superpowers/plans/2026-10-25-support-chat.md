# Chat SIM y tickets de ayuda

**Objetivo:** Asistente multilingüe basado en la documentación de MyTripSim, consulta de pedidos propios y escalamiento humano con historial compartido entre perfil y administración.

**Diseño:** Widget naranja `#ff873c` con acentos azules `#1269ed`, mascota SIM Help, texto oscuro `#15223b`, superficies `#f4f8fc` y tarjetas redondeadas. En móvil, panel completo con cabecera y compositor fijos y mensajes desplazables; en escritorio, ventana compacta. La documentación y los pedidos se presentan como fuentes, sin promesas de políticas pendientes.

## Decisiones

- Visitantes: ayuda general sin acceso a pedidos. Cuenta confirmada: conversación persistente, pedidos y eSIM propios, tickets y respuestas. El modelo recibe sólo contexto autorizado y mínimo; nunca QR, claves o códigos de activación.
- Respuestas de IA con referencias permitidas del centro de ayuda. No ejecuta compras, cambios de eSIM, reembolsos o mensajes. El usuario confirma explícitamente el envío a soporte mediante un botón.
- Un mismo hilo conserva preguntas, respuestas y transición a soporte. Una vez escalado, el chat automático no reemplaza al equipo humano. El usuario consulta y responde desde su perfil; el equipo responde desde Administración → Tickets.
- Correo transaccional mediante cola persistente, reintentos limitados e idempotencia. Avisos a la bandeja oficial y respuestas al correo verificado del cliente, nunca a destinatarios suministrados en la petición.
- RLS, validación de origen, autorización por propietario y rol administrativo en cada API, límites de frecuencia/coste y redacción de credenciales en texto libre.
- El proveedor de IA y el correo receptor se confirman con el propietario. Las claves se introducen sólo en terminal y se configuran como secretos de servidor.

## Tareas

- [x] Actualizar respuestas desfasadas y crear una base de conocimiento permitida con referencias.
- [x] Modelo de conversaciones, mensajes, tickets, notificaciones y límites; pruebas RLS e idempotencia.
- [x] APIs protegidas de contexto, chat, tickets y respuestas administrativas.
- [x] Widget accesible y multilingüe; vista de tickets del perfil y panel administrativo.
- [ ] Configuración privada de IA y correo, cola de avisos y pruebas de integración.
- [ ] Verificación móvil/escritorio, publicación y documentación de límites y operación.
