# Sachi Sips POS

Sachi Sips POS is a Vite + React + TypeScript point-of-sale dashboard for event staff, backed by Supabase and prepared for deployment on Vercel.

Current MVP scope:
- POS checkout flow at `/`
- Live kitchen queue at `/live-orders`
- Station queues at `/stations/hojicha`, `/stations/coffee`, and `/stations/kitchen`
- Completed receipt lookup at `/receipts`
- Owner dashboard at `/dashboard`
- Standalone donations at `/donations`
- Persistent order storage in Supabase
- Auto-refreshing live orders view for kitchen staff

## Tech Stack

- React 19
- TypeScript
- Vite
- React Router
- Supabase
- Vercel

## Local Development

Install dependencies:

```bash
npm install
```

Create `\.env.local` with:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

`SUPABASE_SERVICE_ROLE_KEY` is required for local checkout and kitchen API routes. Keep it server-side only; do not expose it with a `VITE_` prefix.

Start the app:

```bash
npm run dev
```

## Scripts

- `npm run dev` starts the local Vite dev server
- `npm run build` runs TypeScript project builds and creates the production bundle
- `npm run lint` runs ESLint across the repo
- `npm run test:contracts` checks key POS/API contract assumptions
- `npm run preview` serves the built app locally

## Supabase Setup

Apply migrations in order:

- Apply every file in `supabase/migrations/` in numeric order.
- The latest order workflow migration is `013_add_customer_name_to_orders.sql`; it is required before customer-name checkout will work.

Optional seed files are in `supabase/seed/`.

Required frontend environment variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Required API environment variables:

- `SUPABASE_URL` (local dev falls back to `VITE_SUPABASE_URL`)
- `SUPABASE_SERVICE_ROLE_KEY`

## Deployment

This repo is prepared for Vercel deployment as a Vite SPA with an `api/orders.ts` serverless function.

Recommended Vercel settings:

- Framework Preset: `Vite`
- Build Command: `npm run build`
- Output Directory: `dist`

The project includes `vercel.json` so client-side routes like `/live-orders` rewrite correctly to `index.html`.

## Route Map

- `/` POS checkout
- `/live-orders` kitchen live queue
- `/stations/hojicha` hojicha/matcha station queue
- `/stations/coffee` coffee/mocktail station queue
- `/stations/kitchen` bites/bakes station queue
- `/receipts` completed receipt lookup
- `/donations` standalone donation recording
- `/dashboard` owner dashboard

## Pre-Push Checks

Run these before pushing:

```bash
npm run lint
npm run build
```

Manual smoke checks:

- Open `/`
- Create an order
- Confirm it appears on `/live-orders`
- Confirm station pages show only their assigned items
- Mark station items ready and confirm Live Orders station status updates
- Mark the order served and confirm it appears on `/receipts` and `/dashboard`

## Notes

- This is currently an MVP for trusted staff testing, not a locked-down production staff portal.
- Order creation uses the `/api/orders` API route in deployed and local Vite development environments.
