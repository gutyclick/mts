# Consulta preparada para eSIM Access — no enviada

Subject: EU-42_20_90: APN, home operator and pre-activation expiry clarification

Hello eSIM Access team,

Please confirm the following for the exact package slug EU-42_20_90 (Europe 20GB 90Days):

1. Does the current profile require drei.at, another APN, or automatic APN configuration? Is the APN fixed for this package or dependent on the allocated profile? Please identify the authoritative field in esim/query and any manual settings required for iOS/Android/tethering.
2. Who is the home/profile operator? We understand locationNetworkList lists destination roaming networks and an APN or breakout IP does not identify the home operator.
3. package/list returns activeType=2, duration=90 DAY and unusedValidTime=180. Please confirm the 90 days start on first supported network connection, and whether the 180-day unused period starts at order payment, profile allocation or another event.
4. Before activation, does expiredTime represent the unused deadline? After first connection, is it replaced by the active-plan expiry? Which field distinguishes these dates, and what time zone applies?
5. Does expiry permanently prevent download/activation or permit an extension/top-up, and are there exceptions for this exact package?

We will not advertise a universal manual APN or an inferred activation deadline until confirmed.

Thank you,
MyTripSim
hello@mytripsim.com
