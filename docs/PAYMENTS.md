# Payments and delivery

Status: **Paystack is implemented for TEST mode only. Live payments and real
airtime/data delivery are disabled.** Nothing in this document means EscriptPay
is approved by Paystack, a supplier, or any regulator.

## Order lifecycle

```
customer clicks Buy
  -> POST /api/transactions/data | /airtime   (price computed on the server)
       creates Transaction: paymentStatus=pending, providerStatus=pending
       Paystack initialize (amount in kobo, NGN, reference = transactionId,
       email from the logged-in account)
  -> browser goes to checkout.paystack.com
  -> Paystack redirects to /payment/callback?reference=...
       POST /api/transactions/verify  (owner only)
  -> and/or Paystack sends charge.success to /api/payments/paystack/webhook
       (HMAC SHA512 signature over the raw body, checked before anything else)

Both paths call the same idempotent steps:
  confirmPayment: GET /transaction/verify/:reference from Paystack, require
    status=success AND same reference AND currency NGN AND exact kobo amount,
    then one atomic update pending|expired|failed -> successful.
  fulfillOrder: one atomic claim providerStatus pending -> processing, then
    exactly one supplier request. Never retried automatically.
```

| Field | Values | Meaning |
|---|---|---|
| `paymentStatus` | `not_required` | test mode, no gateway |
| | `pending` | checkout started, not paid |
| | `successful` | verified with Paystack (amount, currency, reference match) |
| | `failed` | Paystack said failed, init failed, or mismatch (`needsReview`) |
| | `expired` | unpaid after `PAYMENT_EXPIRY_MINUTES`; a later verified payment still completes it |
| `providerStatus` | `pending` | delivery not started |
| | `processing` | claimed / supplier accepted, not yet confirmed |
| | `successful` | supplier confirmed delivery |
| | `failed` | supplier definitively failed (`needsReview` if paid → refund) |
| | `unknown` | timeout / ambiguous — **reconcile manually, do not re-send** |
| `status` | `pending` / `successful` / `failed` | what the customer sees |
| `needsReview` | boolean | a person must act; blocks delivery |

Safety rules enforced in code:

- No delivery unless `paymentStatus=successful` (verified server-side). The
  only exception is pure test mode: `PAYMENT_SERVICE=test` **and** simulated
  delivery.
- The server refuses to start if: a live key is set without
  `LIVE_PAYMENTS_ENABLED=true`; live payments are paired with simulated
  delivery; a real supplier is paired with test payments; an unknown provider
  is configured.
- The browser redirect is never proof of payment.
- Duplicate webhooks, repeat callbacks and concurrent requests are safe: every
  transition is a conditional single-document update, so only one caller wins.

## Setting up Paystack TEST mode (local)

1. Create/log in to your Paystack account and switch the dashboard to **Test
   mode**. Copy the **test secret key** (`sk_test_...`). Do not paste it in chat.
2. Add to `backend/.env` (yourself, in your editor):
   `PAYMENT_SERVICE=paystack`, `PAYSTACK_SECRET_KEY=sk_test_...`,
   `APP_URL=http://localhost:3000`.
3. Restart the backend. `GET http://localhost:5001/api/config` should show
   `"paymentProvider":"paystack","paymentMode":"test"`.
4. Buy a plan. You are sent to Paystack checkout; use one of Paystack's
   documented **test cards**. After paying you return to `/payment/callback`,
   which verifies and shows the order.

Webhooks cannot reach `localhost`. Locally the callback verification is
enough to test the flow. To test webhooks, deploy a preview (below) or use a
tunnelling tool you trust.

## Webhook configuration

- URL: `https://<your-domain>/api/payments/paystack/webhook`
- Set it in Paystack Dashboard → Settings → API Keys & Webhooks (test mode
  section for testing).
- Paystack documents its webhook source IPs as 52.31.139.75, 52.49.173.169
  and 52.214.14.220. The signature check is the real protection; IP filtering
  is optional extra.
- Paystack retries until it gets HTTP 200 (live: every 3 minutes for the
  first 4 tries, then hourly for 72 hours; test: hourly for 10 hours). The
  handler is idempotent, so retries are harmless.

### Must verify after the first deployment

The signature is computed over the raw request bytes. The app reads the raw
body for this route only. Confirm on the deployed site that a real Paystack
test webhook is accepted (the order moves to `successful` with
`paymentVerifiedVia: "webhook"`). If every webhook returns 401, the platform
altered the body before Express saw it — stop and report the deployment logs.

## Real airtime/data supplier (not implemented)

`VTU_SERVICE` only accepts `test`. Before adding a supplier (e.g. ClubKonnect):

- Open a reseller account, complete their verification, fund the wallet.
- Get their **official** API documentation, price list, network coverage,
  transaction-status/query endpoint and duplicate-request rules.
- Implement `services/vtu/<name>VtuService.js` with `purchase()` returning
  `delivered | accepted | failed | unknown` and `queryStatus()`; send our
  `transactionId` as the supplier request ID if they support one.
- Add it to `SUPPORTED_VTU_PROVIDERS` and `services/index.js`, test against the
  supplier's sandbox (if any) with tiny amounts, and only then set
  `LIVE_DELIVERY_ENABLED=true` with your approval.

## Operations queries (MongoDB shell / Atlas Data Explorer)

```js
// Orders a person must act on (refund, mismatch, unconfirmed delivery)
db.transactions.find({ needsReview: true }).sort({ updatedAt: -1 })

// Deliveries stuck in processing for more than 15 minutes
db.transactions.find({ providerStatus: "processing",
  updatedAt: { $lt: new Date(Date.now() - 15 * 60 * 1000) } })

// Paid but not delivered
db.transactions.find({ paymentStatus: "successful", providerStatus: { $ne: "successful" } })
```

Never "fix" an `unknown` delivery by re-sending: check the supplier dashboard
or status API first, then update the record.

## Wallet

Customers can top up a wallet and pay for data/airtime from it.

- **Balances** are integers in kobo on `User.walletBalances.test` / `.live`,
  chosen by the payment mode. Money added with test payments can never pay for
  live orders.
- **Funding** (`POST /api/wallet/fund`, ₦100 – ₦500,000):
  - `PAYMENT_SERVICE=test`: credited instantly, no real money.
  - `PAYMENT_SERVICE=paystack`: returns a Paystack checkout URL (reference
    `ESCW-…`). The wallet is credited only after the server verifies the
    reference, exact amount and currency with Paystack — from the callback page
    (`POST /api/wallet/verify`) or the `charge.success` webhook. Credits are
    idempotent (callback + webhook races and retries credit once).
- **Paying from the wallet**: send `payWith: "wallet"` to
  `/api/transactions/data` or `/airtime`. The amount is taken with one atomic
  conditional update (never below zero, safe under concurrent purchases), the
  order is created as paid, and delivery uses the normal guarded fulfilment.
- **Refunds**: if the supplier definitively fails a wallet-paid order, the
  amount is returned to the wallet automatically (once, keyed by `RF-<order id>`).
  Ambiguous supplier results (`unknown`) are *not* refunded — they are flagged
  `needsReview`, because the airtime/data may have been delivered.
- **Ledger**: every balance change has a `WalletEntry` (funding / purchase /
  refund) shown on the Wallet page. Entries stuck in `crediting` or with
  `needsReview: true` need a person to check them.

## Real delivery: ClubKonnect

Adapter: `backend/src/services/vtu/clubkonnectVtuService.js`, built from
ClubKonnect's official API docs (https://www.clubkonnect.com/APIDocs).

- **Requests** (HTTPS GET to `https://www.nellobytesystems.com/`):
  `APIAirtimeV1.asp` (airtime), `APIDatabundleV1.asp` (data, `DataPlan` = the
  plan's `providerPlanId`), `APIQueryV1.asp` (status by OrderID or RequestID),
  `APIWalletBalanceV1.asp`, `APIDatabundlePlansV2.asp`. Network codes:
  MTN 01, Glo 02, 9mobile 03, Airtel 04. `RequestID` = our transaction ID.
- **Asynchronous results.** A purchase normally returns `100 ORDER_RECEIVED`
  (the order stays "processing"). The final result comes from:
  - the order page, which polls the order; the server asks ClubKonnect at most
    every 20 s (`VTU_STATUS_CHECK_INTERVAL_SECONDS`);
  - ClubKonnect's callback `GET/POST /api/vtu/clubkonnect/callback`. Its
    content is never trusted: it only triggers an authenticated status query.
- **Status mapping:** 200 → delivered. 100 / 201 / 300 / 412 / 600–606
  (except 602) → still processing. 400–418, 500–598, 602, 899 → failed (not
  delivered). Unspecified codes (x99) and timeouts → `unknown` +
  `needsReview`; they are re-queried by RequestID and **never re-sent**.
- **Failures after payment:** wallet orders are refunded to the wallet
  automatically. Paystack orders are flagged `needsReview` for a manual refund.
- **Data plans** must be linked to a ClubKonnect plan code; unlinked plans and
  plans priced below `costPrice` cannot be bought. The supplier code and cost
  are never sent to browsers.
- **Safety:** `VTU_SERVICE=clubkonnect` needs `CLUBKONNECT_USER_ID`,
  `CLUBKONNECT_API_KEY`, `LIVE_DELIVERY_ENABLED=true` **and live Paystack
  payments**. Any other combination refuses to start.
- **Credentials** travel in ClubKonnect's query string, so request URLs are
  never logged.

### Admin scripts (run on your computer)

Put your credentials in `backend/.env.clubkonnect` (Git ignores it):

```
CLUBKONNECT_USER_ID=...
CLUBKONNECT_API_KEY=...
```

| Command | What it does | Spends money? |
| --- | --- | --- |
| `npm run vtu:balance` | Checks the credentials and shows your ClubKonnect balance | No |
| `npm run vtu:plans` | Lists ClubKonnect data plans with your cost | No |
| `npm run vtu:plans -- --apply --markup 30` | Adds/refreshes plans in the database (asks first, never deletes) | No |
| `npm run vtu:test-order -- --network MTN --amount 50 --phone 080…` | Sends ONE real airtime order (asks first) | **Yes** |

### Open questions before going live

- **IP whitelisting:** ClubKonnect's API page has a "whitelist server IP"
  option. Vercel functions do not have a fixed IP, so if ClubKonnect requires
  whitelisting for your account, calls from Vercel will be refused and a fixed
  outbound IP (e.g. a paid static-IP option or a small proxy) is needed. Check
  `npm run vtu:balance` from your computer first, then from the deployed site.
