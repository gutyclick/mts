# Cookies and local storage

## 1. What they do

Cookies are small browser records. MyTripSim also uses local storage to preserve certain functions between visits. Different storage purposes can have different consent requirements.

Contact hello@mytripsim.com. Our privacy policy explains associated personal-data processing.

## 2. Storage inventory

| Item                                          | Purpose                                                                  | Duration                                                                                       |
| --------------------------------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| Supabase authentication cookies sb-*          | Maintain and refresh account sessions and access mechanisms              | Depends on the session and authentication renewal; may renew when you use the account          |
| mts_checkout_browser                          | Securely link the browser to a payment attempt and its status            | One day in the current configuration                                                           |
| mts_support_guest                             | Recover and protect a visitor's chat in that browser                     | Seven days, renewed when using the function                                                    |
| mytripsim.cart.v1 in local storage            | Keep cart plan identifiers and quantities                                | Until updated or removed; no general automatic expiry                                          |
| mytripsim.completed-carts.v1 in local storage | Avoid restoring completed carts                                          | Up to twenty completed-order references, replaced by new ones or cleared in the browser        |
| mytripsim.pending-payment.v1 in local storage | Recover a pending-payment notice and access                              | Removed when the attempt is resolved or cleared; storage is not the banking session's validity |
| Local FAQ ratings                             | Remember the rating made in that browser                                 | Until updated or cleared; saved only after using the rating function                           |
| Stripe and payment-method identifiers         | Payment authentication, fraud prevention and requested payment functions | Varies by identifier and method; consult Stripe's cookie policy                                |

Third-party names and durations can vary. The inventory is updated with integrations. Our chat does not store whole conversations or eSIM installation credentials in its own browser local storage.

## 3. Necessary functions and optional processing

Account sessions, a requested cart, payment security and recovering a chat you open serve specific functional purposes. Their legal classification depends on actual use and applicable rules.

Our first-party statistics are optional and remain off until you accept. “Necessary only” and “Accept statistics” are equally accessible; change your choice through “Privacy preferences” in the footer. Refusal does not prevent purchases or support. Email marketing permission is separate.

The necessary `mts_stats_consent` cookie remembers a signed yes/no preference (version v1) for 180 days without an individual identifier. Only acceptance creates `mts_stats_session`, an HttpOnly random cookie with an absolute 30-minute lifetime. The server stores its HMAC to count sessions viewing destinations, adding to cart, starting payment and completing a live purchase. No third-party analytics or pixels are used. Events do not include full URLs, email, QR codes or installation credentials.

We honor Do Not Track and Global Privacy Control by disabling collection. Withdrawal stops new events and clears the optional cookie when server cleanup is confirmed; on failure, the identifier is retained only to retry deletion until its original 30-minute expiry; when the database is available, it also removes the current session’s events and order association. Pseudonymous session and event data are retained for 30 days and purged daily (up to 24 additional hours). Separate abuse-limiting hashes expire after one hour and markers preventing withdrawn-session revival after 30 minutes; both are purged daily. Removing a current session does not automatically identify earlier sessions. See the privacy policy for further details.

## 4. Controls

You can inspect and clear cookies and site data through your browser. Blocking necessary storage may sign you out, empty your cart, prevent recovery of guest chat or make tracking payment in that browser harder.

Clearing the browser does not cancel an order, necessarily erase records in MyTripSim's systems or reverse a Stripe payment. To exercise rights concerning server-held data, contact hello@mytripsim.com.

Payment methods and digital wallets may provide their own controls. Consult their information when interacting directly with those services.

## 5. Changes

The policy carries an update date. A new optional purpose will be accompanied by the appropriate information and choice before activation.
