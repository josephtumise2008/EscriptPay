# Testing

## Backend unit tests (no database, no network)

```bash
cd backend
npm test
```

Covers configuration safety guards, Paystack request/response handling
(with a fake HTTP layer), webhook signature verification (including through
the real Express app), and the order lifecycle state machine (duplicate and
concurrent webhooks, amount/currency/reference mismatches, fulfilment before
payment, supplier timeout / failure / ambiguous responses).

## Backend integration tests (real MongoDB, fake Paystack)

These need a running MongoDB and a **separate** database whose name ends in
`_test`. The tests DROP that database before and after. They never read
`MONGO_URI` or `.env`.

Start the project's local MongoDB first (it runs in the background; your
existing dev data in `.local/mongodb/data/db` is not touched by the tests,
which only use the separate `escriptpay_test` database):

```bash
cd ~/Desktop/EscriptPay
./.local/mongodb/mongodb-macos-x86_64-7.0.14/bin/mongod \
  --dbpath .local/mongodb/data/db --bind_ip 127.0.0.1 --port 27017 \
  --fork --logpath .local/mongodb/logs/mongod.log --logappend
```

Then:

```bash
cd backend
MONGO_URI_TEST=mongodb://127.0.0.1:27017/escriptpay_test npm run test:integration
```

Without `MONGO_URI_TEST` every integration test is reported as skipped.

Covers: unauthenticated requests, phone/network/amount/plan validation,
inactive plans, server-side pricing, the original test-mode purchase flow,
idempotent repeat submits, transaction ownership, regex-safe search, Paystack
initialization (kobo, NGN, account email), owner-only verification,
abandoned/failed/mismatched payments, duplicate and concurrent
webhook/callback processing against real MongoDB atomic updates, and
initialization failure.

## Frontend

```bash
cd frontend
npm run lint
npm run build
```

## Manual end-to-end (Paystack test mode)

See docs/PAYMENTS.md → "Setting up Paystack TEST mode". Check:

1. Buy data → redirected to Paystack checkout; history shows the order as
   Pending / Awaiting payment.
2. Close checkout without paying → order stays "Awaiting payment"; nothing
   delivered.
3. Pay with a Paystack test card → callback page → "Purchase Successful!"
   (test-mode banner still shown: delivery is simulated).
4. Refresh the success page and revisit the callback URL → no second
   delivery (`fulfillmentAttempts` stays 1).
5. Receipt shows the transaction ID, payment reference and amount.
