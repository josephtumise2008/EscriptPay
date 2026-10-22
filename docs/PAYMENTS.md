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
