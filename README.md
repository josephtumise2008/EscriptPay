# EscriptPay

Airtime and mobile data for Nigerian networks — MTN, Airtel, Glo and 9mobile —
with clear prices and a receipt for every order.

> **Status:** test mode. Payments and delivery are simulated; no real money is
> charged and no airtime or data is delivered yet.

## Features

- Account sign-up, login and password reset (secure httpOnly cookie sessions)
- Data plans per network with server-side pricing
- Airtime top-ups from ₦100 to ₦10,000
- Paystack checkout (test mode) with server-side payment verification and
  signed webhooks
- Transaction history with search, filters, receipts and CSV export
- Light, dark and system themes; responsive layout with a mobile tab bar

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
