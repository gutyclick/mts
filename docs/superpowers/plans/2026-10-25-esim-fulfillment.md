# eSIM Fulfillment Implementation Plan

**Goal:** Pago confirmado → emisión idempotente → QR privado → correo al beneficiario y Mis eSIM.

**Architecture:** Cola transaccional por unidad en Supabase, trabajador por fases en Vercel, eSIM Access y Resend. Cron firmado con tickets de un solo uso. Stripe test queda aislado del saldo real.

**Tech Stack:** Next.js 16, TypeScript, PostgreSQL, Stripe, eSIM Access, Resend, qrcode.

**Spec:** `docs/superpowers/specs/2026-10-25-esim-fulfillment-design.md`

## Tareas

- [x] Adaptador de compra y consulta estricta en `src/lib/integrations/esimaccess-api.ts`, pruebas `tests/fulfillment.test.mjs`.
- [x] Migración `20261025000900_esim_fulfillment.sql`: cola privada, trigger paid, reclamación con lease, publicación atómica, cron firmado; pruebas PostgreSQL.
- [x] Núcleo de fases y adaptador servidor en `src/lib/fulfillment/`, envío Resend idempotente y plantilla transaccional, pruebas de errores y efectos duplicados.
- [x] Worker privado y acceso de propietario/invitado en `src/app/api/`, página privada ES/EN y panel de entrega reutilizable; QR local e instrucciones.
- [x] Integrar panel en resultado de compra y estado en Mis eSIM sin exponer referencias privadas.
- [x] Configurar secretos y correo sin imprimir claves, aplicar migraciones, comprobar build, lint, seguridad y UI; publicar y comprobar endpoints.
- [x] Probar emisión real sólo con destinatario y gasto autorizados. Documentar claramente lo que se haya verificado y lo pendiente antes de live.

## Riesgos que deben quedar probados

Compra con timeout y respuesta perdida mantiene el transactionId. Reclamación vencida no permite sobrescribir resultados de otro trabajador. Pago test nunca llama al proveedor o correo. Correos fallidos no recompran perfiles. Un enlace ajeno no entrega QR y las cadenas externas se escapan antes del HTML. Las cantidades del carrito generan unidades distintas y únicas.
