# Deploying EscriptPay (test mode)

Goal of this stage: the site running on the internet on a Vercel URL, with a
real MongoDB Atlas database, still in **test mode** (no real money, no real
delivery). Paystack, the supplier and the domain come in later stages.

```
Browser ──► https://<project>.vercel.app
              ├─ /api/*  → backend service (Express, backend/)   ─► MongoDB Atlas
              └─ /*      → frontend service (Next.js, frontend/)
```

Both apps deploy together as one Vercel project using **Vercel Services**
(configured in `vercel.json`; Services is currently a Beta feature). Frontend
and API share one domain, so login cookies and API calls are same-origin.

---

## 0. Before you start (on your Mac)

```bash
cd ~/Desktop/EscriptPay/backend && npm test
cd ../frontend && npm run lint && npm run build
```

All must pass. Then merge `feature/ui-overhaul` into `main` on GitHub
(Pull Request → Merge). Vercel deploys `main` to production.

---

## 1. MongoDB Atlas

1. Create a free account at <https://www.mongodb.com/cloud/atlas/register>.
2. **Create a cluster** → choose the free tier (M0) and the region nearest
   Nigeria that is offered (e.g. Europe or South Africa).
3. **Database Access → Add New Database User**
   - Username: `escriptpay_app`
   - Password: click *Autogenerate* (letters and numbers only avoids URL-encoding
     problems). Save it in your password manager — **never paste it into chat or Git**.
   - Role: *Read and write to any database* (or `readWrite` on `escriptpay`).
4. **Network Access → Add IP Address → Allow access from anywhere** (`0.0.0.0/0`).
   Vercel functions don't have fixed IP addresses, so this is required; the
   strong database password is what protects the database.
5. **Connect → Drivers** → copy the connection string. It looks like
   `mongodb+srv://escriptpay_app:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority`
   - Replace `<password>` with the real password.
   - Add the database name before the `?`: `...mongodb.net/escriptpay?retryWrites=...`

### Load the data plans into Atlas (one time)

Run this on your Mac. `read -rs` lets you paste the connection string without it
showing on screen or being saved in your shell history:

```bash
cd ~/Desktop/EscriptPay/backend
read -rs ATLAS_URI        # paste the connection string, press Enter
MONGO_URI="$ATLAS_URI" npm run import:plans
unset ATLAS_URI
```

Expected: `Imported 54 plans into database "escriptpay".`
The script refuses to run if the database already has plans, so it can never
overwrite anything. (Do **not** use `npm run seed:plans` on Atlas — that one
deletes all plans first and is for local development only.)

---

## 2. Vercel

1. Sign in at <https://vercel.com> with GitHub.
2. **Add New → Project** → import the `EscriptPay` repository.
   Leave *Root Directory* as the repository root — `vercel.json` defines both services.
3. Before clicking Deploy, open **Environment Variables** and add the values
   below (tick *Production* and *Preview*).
4. **Deploy.** Note the URL Vercel gives you (e.g. `https://escriptpay.vercel.app`).
5. Go back to **Settings → Environment Variables**, set `CLIENT_ORIGIN` and
   `APP_URL` to that exact URL, then **Deployments → ⋯ → Redeploy**
   (environment changes only apply to new deployments).

### Environment variables

| Name | Value | Secret? | Used by |
|---|---|---|---|
| `MONGO_URI` | Atlas connection string from step 1 | **Yes** | backend |
| `JWT_SECRET` | output of `openssl rand -hex 32` (run on your Mac) | **Yes** | backend |
| `JWT_EXPIRES_IN` | `7d` | no | backend |
| `COOKIE_SECURE` | `true` | no | backend |
| `CLIENT_ORIGIN` | `https://<your-project>.vercel.app` | no | backend |
| `APP_URL` | `https://<your-project>.vercel.app` | no | backend |
| `PAYMENT_SERVICE` | `test` | no | backend |
| `VTU_SERVICE` | `test` | no | backend |

Do **not** set:
- `NODE_ENV` — Vercel sets it.
- `NEXT_PUBLIC_API_URL` — in production the frontend calls `/api` on the same
  domain automatically. Anything starting with `NEXT_PUBLIC_` is visible to
  everyone, so it must never hold a secret.
- `PAYSTACK_SECRET_KEY`, `LIVE_PAYMENTS_ENABLED`, `LIVE_DELIVERY_ENABLED` — later stages.

Changing `JWT_SECRET` later logs everyone out (existing sessions become invalid).

---

## 3. Check the live site

| Check | Expected |
|---|---|
| `https://<url>/api/health` | `{"success":true,…,"mode":"test"}` |
| `https://<url>/api/plans` | a list with 54 plans |
| Homepage | loads; the hero phone shows prices |
| Sign up, then log in | dashboard opens |
| Buy data / airtime | order completes as a test purchase, receipt shows |
| Transactions, Back, theme switch, logout | all work |

### If something fails

| Symptom | Likely cause | Fix |
|---|---|---|
| Every page/API returns 500 right after deploy | `MONGO_URI` or `JWT_SECRET` missing | add them, then Redeploy |
| API returns *"Database unavailable"* (503) | wrong password/URI, or Atlas Network Access not open | re-check step 1.3–1.5, Redeploy |
| `/api/plans` returns `[]` | plans not imported | run the import in step 1 |
| Login succeeds but you're logged straight out | `COOKIE_SECURE` / URL mismatch | `COOKIE_SECURE=true`, site opened via `https://` |
| Build fails | read the build log | send the error text (never the env values) |

Vercel shows function logs under **Project → Logs**; the API logs only
identifiers and status codes, never passwords, tokens or connection strings.

---

## Later stages

1. **Paystack (test keys)** — set `PAYMENT_SERVICE=paystack` and `PAYSTACK_SECRET_KEY=sk_test_…`
   in Vercel, set the webhook URL `https://<url>/api/payments/paystack/webhook`
   in the Paystack dashboard, and verify a real test payment end-to-end
   (see `docs/PAYMENTS.md`).
2. **Supplier integration** (real airtime/data) — needs your supplier account and API docs.
3. **Domain** — add it in Vercel → Domains, then update `CLIENT_ORIGIN`, `APP_URL`
   and the Paystack callback/webhook URLs.
4. **Go live** — only after test runs pass and you approve: live keys,
   `LIVE_PAYMENTS_ENABLED=true`, `LIVE_DELIVERY_ENABLED=true`.
