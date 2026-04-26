# Sachi Sips POS

Sachi Sips POS is a Vite + React 19 + TypeScript point-of-sale dashboard for event staff, backed by Supabase and deployed on Vercel.

## Feature Map

- POS checkout at `/` — cart, customization, Bestie Set, Make-it-a-Set
- Live kitchen queue at `/live-orders` (5-second polling)
- Station queues at `/stations/hojicha`, `/stations/coffee`, `/stations/kitchen`
- Completed receipts at `/receipts`
- Owner dashboard at `/dashboard` — sales + standalone donations, filters, sortable order table
- Standalone donation entry at `/donations`
- Merch reference catalogue at `/merch`
- Persistent order workflow in Supabase (orders → live → completed) with per-item readiness tracking

## Tech Stack

- React 19 + React Router 7
- TypeScript
- Vite (SPA)
- Vercel serverless API routes (`/api/*`)
- Supabase (Postgres + RLS)

## Local Development

Install dependencies:

```bash
npm install
```

Create `.env.local` with:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

`SUPABASE_SERVICE_ROLE_KEY` is required for the order, donation, and kitchen API routes during local dev. Keep it server-side only — never prefix it with `VITE_` or it will leak into the client bundle.

Start the app:

```bash
npm run dev
```

The Vite dev server (`vite.config.ts`) wires `/api/*` routes locally, so the same paths used in production work in development.

## Scripts

- `npm run dev` — Vite dev server with HMR
- `npm run build` — `tsc -b` then Vite production build into `dist/`
- `npm run lint` — ESLint
- `npm run test:contracts` — static contract assertions over key API + page files (no runtime, no DB)
- `npm run preview` — serve the built bundle locally

## Supabase Setup

Apply migrations in `supabase/migrations/` in numeric order. The latest required migration is `013_add_customer_name_to_orders.sql`.

Optional product seed scripts are in `supabase/seed/`.

Required environment variables:

Frontend (`VITE_`-prefixed, exposed to the client):
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Server-only (used by `api/*` and `vite.config.ts`):
- `SUPABASE_URL` (falls back to `VITE_SUPABASE_URL` in local dev)
- `SUPABASE_SERVICE_ROLE_KEY`

All write paths for orders, completion, station readiness, and donations go through service-role API routes. Anon clients only read `products`.

## Deployment

This repo is prepared for Vercel deployment as a Vite SPA plus the serverless functions in `api/`.

Recommended Vercel settings:

- Framework Preset: **Vite**
- Build Command: `npm run build`
- Output Directory: `dist`

`vercel.json` rewrites client-side routes (e.g. `/live-orders`, `/stations/coffee`) to `index.html` while leaving `/api/*` to the serverless functions.

## Route Map

- `/` — POS checkout
- `/live-orders` — kitchen master queue
- `/stations/hojicha` — hojicha + matcha drinks
- `/stations/coffee` — filter coffee + mocktail drinks
- `/stations/kitchen` — bites + bakes
- `/receipts` — completed-order lookup
- `/donations` — standalone donation entry
- `/dashboard` — owner sales + donation analytics
- `/merch` — merch catalogue (read-only)

## API Routes

All under `api/`, served by Vercel in production and by `vite.config.ts` in development:

- `POST /api/orders` — create an order (calls `create_order` RPC)
- `POST /api/complete-order` — mark a live order completed
- `POST /api/mark-station-ready` — mark a station's items ready on a given order
- `GET  /api/live-orders` — current live tickets
- `GET  /api/orders-history` — completed tickets (for receipts + dashboard)
- `POST /api/donations` — record a standalone donation
- `GET  /api/donations-history` — donation ledger (for dashboard)

## Pre-Push Checks

Run all three before pushing:

```bash
npm run lint
npm run build
npm run test:contracts
```

Manual smoke checks:

1. Open `/` and create an order with a customized latte (verify milk + sugar prompts) and a bite, with customer name set.
2. Confirm it appears on `/live-orders` and on the matching station pages only.
3. Mark each station ready; confirm the master queue station chips flip and the "Ready to Serve" badge appears.
4. Mark the order served; confirm it appears in `/receipts` and `/dashboard`.
5. Record a donation on `/donations`; confirm it lands in the dashboard's donation panels and is not mixed into sales revenue.

## Notes

- This is an MVP for trusted staff testing, not a locked-down public storefront.
- Order creation, completion, station readiness, and donation entry all require `/api/*` — running the app without the service role key will block checkout.
