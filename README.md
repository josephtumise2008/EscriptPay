# EscriptPay

Airtime and mobile data for Nigerian networks — MTN, Airtel, Glo and 9mobile —
with clear prices and a receipt for every order.

> **Status:** live at [escriptpay.com](https://escriptpay.com). Real payments
> through Paystack and real airtime/data delivery through ClubKonnect.

## Features

- Account sign-up, email verification, login and password reset (secure
  httpOnly cookie sessions)
- Data plans per network with server-side pricing; airtime from ₦100 to ₦10,000
- Wallet: top up with OPay/bank app, transfer, USSD or card (Paystack popup,
  stays inside the installed app), optional saved card for one-tap top-ups
- Server-side payment verification and signed webhooks; card payments from
  outside Nigeria are blocked and refunded automatically
- Reliable delivery: instant retries on connection failures, re-send when the
  supplier never received an order, automatic wallet refunds otherwise
- Scheduled background checks and owner email alerts (orders needing review,
  low supplier balance)
- Owner Business page: sales, profit, wallet balances, supplier balance
- Transaction history with search, filters, receipts and CSV export
- Installable app (PWA), light/dark themes, mobile tab bar

## Tech stack

| Part | Technology |
|---|---|
| Frontend | Next.js 16, React 19, Tailwind CSS 4 |
| Backend | Node.js, Express 5, Mongoose 9 |
| Database | MongoDB (Atlas in production) |
| Hosting | Vercel (Services: frontend + backend on one domain) |

## Project structure

```
EscriptPay/
├── frontend/   Next.js app
├── backend/    Express API (src/), scripts/, tests/
├── docs/       Payments, testing and deployment guides
└── vercel.json Vercel Services configuration
```

## Running locally

```bash
# backend (http://localhost:5001)
cd backend
cp .env.example .env      # then fill in your own values
npm install
npm run dev

# frontend (http://localhost:3000)
cd frontend
npm install
npm run dev
```

## Tests

```bash
cd backend && npm test                     # unit tests
cd frontend && npm run lint && npm run build
```

See `docs/TESTING.md` for the integration tests.

## Deployment

See `docs/DEPLOYMENT.md`.

## Author

Built by **Joseph** ([@josephtumise2008](https://github.com/josephtumise2008)).
