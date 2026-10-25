# Correo de cuentas: DNS verificados

`mytripsim.com` está verificado en la cuenta de Resend conectada por CLI. Los DNS autoritativos están en Spaceship (`launch1.spaceship.net`, `launch2.spaceship.net`). Estos son los registros que Resend confirma como verificados; no es necesario volver a modificarlos.

| Tipo  | Nombre              | Valor                                                                      |
| ----- | ------------------- | -------------------------------------------------------------------------- |
| TXT   | `resend._domainkey` | Consultar el DKIM vigente en [Resend Domains](https://resend.com/domains). |
| CNAME | `rsend`             | `rsend.forge.rmta.net`                                                     |
| CNAME | `send`              | `send.forge.rmta.net`                                                      |

La tabla inicial pertenecía a otro equipo de Resend y queda sustituida por esta referencia. No aplicar el DKIM anterior ni mezclar los CNAME actuales con los antiguos registros MX/TXT de `send`. No cambiar los registros de la web ni del correo raíz.

El TXT DKIM es público. La clave SMTP es privada y se conserva fuera de Git; Supabase Auth la utiliza para confirmar cuentas y recuperar contraseñas. El seguimiento de enlaces está desactivado para conservar intactos los enlaces de autenticación.
