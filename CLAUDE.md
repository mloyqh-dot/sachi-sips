# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Sachi Sips Dashboard** — A POS + kitchen-queue system for the nonprofit Sachi Sips (owner: Joy). Used by event staff on tablets/phones; primary users are non-technical.

Tech stack: React 19 + TypeScript (Vite SPA), React Router 7, Supabase (Postgres + RLS), Vercel serverless functions for the order workflow, Vercel hosting.

## Commands

```bash
npm run dev            # Vite dev server (http://localhost:5173)
npm run build          # tsc -b && vite build (production bundle in dist/)
npm run lint           # ESLint
npm run test:contracts # Static contract assertions over key API + page files
npm run preview        # Serve the built app locally
```

`npm run lint`, `npm run build`, and `npm run test:contracts` are all required before pushing.

## Environment Variables

`.env.local` for dev; mirror these in Vercel project settings for production.

Frontend (Vite-exposed, public):
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Server-side only (do NOT prefix with `VITE_`):
- `SUPABASE_URL` (falls back to `VITE_SUPABASE_URL` locally)
- `SUPABASE_SERVICE_ROLE_KEY`

The API routes under `api/` use the service role key. Anon clients can only read `products`; orders, donations, completion, and station readiness all flow through service-role API routes. Never expose the service role key client-side.

## Architecture

### Folder Structure
```
api/                              # Vercel serverless functions (also served locally via vite.config.ts)
  orders.ts                       # POST /api/orders — create_order RPC
  complete-order.ts               # POST /api/complete-order
  mark-station-ready.ts           # POST /api/mark-station-ready
  live-orders.ts                  # GET  /api/live-orders
  orders-history.ts               # GET  /api/orders-history (completed)
  donations.ts                    # POST /api/donations
  donations-history.ts            # GET  /api/donations-history

src/
  lib/
    supabase.ts                   # Single anon Supabase client (read-only paths)
    constants.ts                  # CATEGORY_ORDER, CATEGORY_META, STATION_CATEGORIES
    orderHistory.ts               # fetchCompletedOrders + formatters
    donations.ts                  # fetchDonations + createDonation
  types/index.ts                  # Domain types (Product, Order, OrderItem, Donation, CartEntry…)
  pages/
    pos/POSPage.tsx               # Cashier checkout (cart, customization, Bestie Set, Make-it-a-Set)
    live-orders/LiveOrdersPage.tsx# Kitchen master queue with station-status chips
    stations/                     # Per-station queues (Hojicha, Coffee, Kitchen) sharing StationPage.tsx
    receipts/ReceiptsPage.tsx     # Completed-order lookup
    donations/DonationsPage.tsx   # Standalone donation entry
    dashboard/DashboardPage.tsx   # Owner analytics (sales + donations + filters/sort)
    merch/MerchPage.tsx           # Read-only merch catalogue

scripts/order-contracts.test.mjs  # Static contract assertions (no runtime, no DB)
supabase/
  migrations/                     # Numbered SQL migrations — apply in order
  seed/                           # Optional product seed scripts
```

### Routing (`src/App.tsx`)
- `/` → POS
- `/live-orders` → kitchen master queue
- `/stations/hojicha`, `/stations/coffee`, `/stations/kitchen` → per-station queues
- `/receipts` → completed-order lookup
- `/donations` → standalone donation entry
- `/dashboard` → owner analytics
- `/merch` → merch catalogue (read-only reference)

### Data Flow
1. **POS** builds a cart locally and POSTs to `/api/orders`. The API resolves canonical product names/availability against the DB, recomputes the subtotal, and calls the `create_order` RPC. RPC re-validates totals, inserts orders + order_items in one transaction, returns the persisted order.
2. **Live Orders** + station pages poll `/api/live-orders` every 5s. `isFetchingRef` prevents overlapping fetches; `active` flags guard against stale state on unmount.
3. **Stations** mark only their own categories ready via `/api/mark-station-ready`. The RPC only touches items where `ready_at IS NULL` (idempotent).
4. **Live Orders** completes a ticket via `/api/complete-order`. `complete_order` only succeeds when status is still `live` (idempotent).
5. **Receipts** + **Dashboard** read completed orders from `/api/orders-history`. Dashboard also pulls `/api/donations-history`.

### Supabase Conventions
- All client DB access goes through `src/lib/supabase.ts`. Never instantiate a second client.
- Schema changes belong in numbered files under `supabase/migrations/`. The latest is `013_add_customer_name_to_orders.sql`. Apply in order.
- All write paths for orders/donations are RPCs or service-role inserts. Anon does not have write permission on those tables.
- `order_items.options` is JSONB shaped as `{ milk?, sugar?, warm_up? }`.
- Every new table needs RLS enabled and a deliberate decision about anon access.

### Domain Model
- **Product**: menu item (`category` ∈ Matcha / Filter Coffee / Mocktail / Bites / Bakes / Merch), with `subcategory`, `sort_order`, `is_available`.
- **Order**: persistent ticket with `ticket_number` (`SS-YYYYMMDD-NNNNNN`), `order_type` (`dine_in` | `takeaway`), `status` (`live` | `completed`), `customer_name` (required), `staff_name`, totals, payment method.
- **OrderItem**: line on an order. `ready_at` tracks per-item kitchen readiness; stations mark these.
- **Donation**: standalone gift, separate from sales revenue.

### Customization Rules (POS)
Encoded in `src/pages/pos/POSPage.tsx`:
- Matcha + Hojicha lattes require `milk`. Strawberry/Lychee Matcha skip `sugar` (pre-sweetened). Banana Hojicha is oat-only.
- Dine-in Shio Pan + Spam Musubi prompt for `warm_up`.
- Postcards prompt for B&W ($2.00) vs Colour ($2.50) variant.
- The "+ Set" button (Make-it-a-Set) on a customizable drink routes through customization first, then opens the bite picker so kitchen tickets always carry the milk/sugar option.

## Design Principles
- Simplicity first — primary users are nonprofit staff, not technical users.
- Mobile-friendly POS: tablets and phones at events, dual-pane on desktop.
- Brand: warm palette + soft shadows, never enterprise-grey. Use the `sachi-sips-brand` skill for the palette and typography rules.
- Don't add features beyond MVP scope without checking with Joy first. This is a trusted-staff tool, not a locked-down portal.
