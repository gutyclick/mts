# Consulta de variantes para eSIM Access

Preparada para copiar al soporte del proveedor. No enviada. No incluye credenciales, datos de clientes ni precios. Referencias cotejadas con la consulta de catálogo realizada el 3 de noviembre de 2026.

Su página pública describe `_IIJ` como IP japonesa, `_usip` como IP estadounidense y `_premium` como multired. Esta descripción general no sustituye las condiciones del SKU contratado.

Fuente: https://esimaccess.com/esim-pricing-coverage/

## Mensaje listo para enviar

Subject: Please confirm technical conditions for fixed Japan IIJ, Canada Premium and USIP packages

Hello eSIM Access support,

We are reviewing the fixed-data packages listed below for MyTripSim. Please confirm the following information per SKU, or identify explicitly which SKUs share identical conditions. Please do not substitute information from daily/FUP products.

| Destination | Fixed SKU | Current packageCode reference |
|---|---|---|
| Japan | JP_1_7_IIJ | PK3VHQ9T6 |
| Japan | JP_5_30_IIJ | PYTKZG843 |
| Japan | JP_10_30_IIJ | PAK783GRS |
| Japan | JP_20_30_IIJ | PMR7KU23C |
| Canada | CA_1_7_Premium | PJX7F06LT |
| Canada | CA_5_30_Premium | P7R6DFSG9 |
| Canada | CA_10_30_Premium | P8Y62PNZU |
| Canada | CA_20_30_Premium | PTRLH2A81 |
| United States | US_1_7_usip | PZ7QK2HLM |
| United States | US_5_30_usip | PQ3H8XKLT |
| United States | US_10_30_usip | PVB9R6NQM |
| United States | US_20_30_usip | PY1G7FDKC |

1. **Networks and access:** Which operators are currently allowed for each package? Which technologies are available per operator? Is network selection automatic, can the customer select an operator manually, and are there specific coverage exclusions? We will describe 5G as conditional, never guaranteed.
2. **Internet breakout IP:** Is the breakout IP Japanese for every listed IIJ package and US-based for every listed USIP package? What breakout country or possible countries apply to Canada Premium? Are these fixed characteristics or can routing vary? A local IP alone does not imply better coverage or guaranteed latency.
3. **Exact differences from standard:** What is technically different from the corresponding standard fixed-data SKU? For Canada Premium, please confirm the exact operator set rather than a general "better coverage" statement. For Japan IIJ, confirm the NTT docomo network and Japanese routing. For USIP, clarify routing versus radio-network differences.
4. **Activation and expiration:** What exact `activeType` applies to each SKU? Does validity begin on purchase, installation, or first destination-network connection? What is the deadline to install or activate an unused eSIM, and from which event does that deadline run? Are "days" elapsed 24-hour periods or calendar days in a particular time zone?
5. **APN and hotspot:** Confirm the current APN and whether it is automatic on iOS/Android or needs manual entry. In particular, please confirm `vmobile.jp` for IIJ, `internet` for Canada Premium and `bicsapn` for USIP. Confirm tethering support and any device/network restrictions.
6. **Allowance and restrictions:** Are these a fixed full-speed allowance for the entire validity period? Is there any fair-use threshold, throttling, traffic restriction, or network-specific exception? Does connectivity stop when the allowance is exhausted?
7. **Top-ups:** Which matching top-up packages apply? Can top-ups be bought before or after expiration, and do they add data, extend validity, or both? Please identify SKU-specific exceptions.
8. **Status and support:** Are eSIM installation, activation, status and usage available through the API for all these packages? How frequently is usage updated, and are any fields unavailable or delayed?
9. **Supplier cancellation conditions:** What cancellation/refund conditions apply before purchase, after installation and after activation? Please distinguish fixed roaming packages from prepaid local products. We will keep our consumer policy separate from supplier reimbursement conditions.

Please include the date of confirmation and a current source/export identifying each SKU and packageCode. We will use this information to approve the connectivity options shown to customers.

Thank you,
MyTripSim

## Criterio de aprobación interna

- Japón IIJ: IP japonesa y operador/APN/activación confirmados para los SKUs fijos seleccionados.
- Canadá Premium: diferencias reales de operadores y condiciones confirmadas; no prometer superioridad ni cobertura garantizada.
- USIP: confirmar las características de cada SKU fijo; si comparte operadores con el estándar, describir la diferencia como salida IP, no como mejor red.
- Guardar respuesta/fecha como evidencia de la modalidad en administración; mantener los precios vigentes.
