# Repository Guidelines

## Project Structure & Module Organization
Vite + React 19 + TypeScript SPA with Vercel serverless API routes for the order workflow.

- `src/` — application code. Routing in `src/App.tsx`, entry in `src/main.tsx`.
- `src/pages/` — one folder per top-level route: `pos/`, `live-orders/`, `stations/`, `receipts/`, `donations/`, `dashboard/`, `merch/`. The three station pages share `StationPage.tsx`.
- `src/lib/` — `supabase.ts` (single anon client), `constants.ts` (categories + station map), `orderHistory.ts`, `donations.ts`.
- `src/types/index.ts` — all domain types (Product, Order, OrderItem, CartEntry, BestieSetCartItem, Donation, …).
- `api/` — Vercel serverless functions. Mirrored locally by `vite.config.ts` so `/api/*` works in `npm run dev`.
- `supabase/migrations/` — numbered SQL migrations. Apply in order. The latest migration is `013_add_customer_name_to_orders.sql`.
- `supabase/seed/` — optional product seed scripts.
- `scripts/order-contracts.test.mjs` — static contract assertions over key API + page files.
- `public/`, `src/assets/` — static assets.

## Build, Test, and Development Commands
Run from `C:\Projects\sachi-sips`.

- `npm run dev` — Vite dev server with HMR on http://localhost:5173. Local API routes are wired via `vite.config.ts`.
- `npm run build` — `tsc -b` then Vite production build into `dist/`.
- `npm run lint` — ESLint over the repo.
- `npm run test:contracts` — runs `scripts/order-contracts.test.mjs`. Static checks; no runtime, no DB.
- `npm run preview` — serve the built bundle locally.

`npm run lint`, `npm run build`, and `npm run test:contracts` are required pre-push checks.

## Coding Style & Naming Conventions
- Functional components with typed props/state.
- PascalCase for components (`POSPage.tsx`), camelCase for functions/variables, UPPER_SNAKE_CASE for constants.
- Domain types live in `src/types/index.ts`. Import them from there rather than redefining.
- Reuse the shared `supabase` client; never instantiate a second one.
- The codebase uses semicolons and inline style objects (typed `as const` where needed). Match the existing style unless refactoring a whole area.
- ESLint is configured in `eslint.config.js` with `@eslint/js`, `typescript-eslint`, `react-hooks`, and `react-refresh`.

## UI Design & Brand Consistency
Preserve the existing Sachi Sips visual system. Palette: pink `#E59090`, burgundy `#682837`, brown `#52301A`, green `#4D4823`, butter `#F0E4BF`, yellow `#FFE373`. Burgundy for headings, brown for body, butter panels on pink/warm surfaces.

Typography: `Pinyon Script` for the wordmark only, `Alice` for headings, `Public Sans` for UI/body text.

Soft borders, rounded corners, warm shadows. Never use yellow and green together as primary accents in the same view. Full guidance is in the `sachi-sips-brand` skill — load it when building or restyling UI.

## React & Data Patterns
- Favour clear composition over piling boolean mode props on a single component. The station page already factors three station variants through `StationPage.tsx` props rather than three forks.
- Avoid serial waterfalls when requests are independent (`DashboardPage` uses `Promise.all` for orders + donations).
- All polling pages (Live Orders, stations) use a `isFetchingRef` guard plus an `active` flag for unmount safety. Follow this pattern when adding new polled views.
- For Supabase: route all access through `src/lib/supabase.ts`, put schema updates in `supabase/migrations/`, and consider RLS, constraints, and indexes whenever adding new tables or queries.

## Order Workflow (Reference)
Cashier creates a cart on `/`, submits it to `/api/orders` (service role) which calls the `create_order` RPC and returns a persisted ticket. The kitchen sees live tickets at `/live-orders` (5s polling) and per-station queues under `/stations/*`. Stations mark their categories ready via `/api/mark-station-ready`; the master queue badges them. `/api/complete-order` retires a ticket to `status='completed'`. Receipts and the owner dashboard read completed orders from `/api/orders-history`. Donations have an independent flow at `/donations` writing to a separate `donations` table.

`POSPage` enforces customization on the way in:
- Matcha + Hojicha lattes require `milk`. Strawberry/Lychee Matcha skip `sugar`. Banana Hojicha is oat-only.
- Dine-in Shio Pan and Spam Musubi prompt for `warm_up`.
- Postcards prompt for B&W vs Colour.
- The "+ Set" shortcut on a customizable drink chains through the customization modal before opening the bite picker, so set-bundled drinks always carry their milk/sugar option.

## Testing Guidelines
- Static checks: `npm run lint`, `npm run build`, `npm run test:contracts`.
- No runtime test suite yet. For data-flow changes, manually verify the smoke path:
  1. Open `/`, create an order with a customized latte and a bite, customer name set.
  2. Confirm it appears on `/live-orders` and on the matching station pages only.
  3. Mark each station ready; confirm the master queue chips flip and the "Ready to Serve" badge appears.
  4. Mark served; confirm it shows on `/receipts` and `/dashboard`.
  5. Record a donation on `/donations`; confirm it lands in the dashboard's donation panels (not in sales revenue).
- If you add tests, place them beside the feature or under `src/__tests__/` and use `*.test.ts` / `*.test.tsx`.
- When adding new API routes or critical UI invariants, also add an assertion to `scripts/order-contracts.test.mjs`.

## Commit & Pull Request Guidelines
- Use clear imperative commit subjects (`Add receipt filtering`, `Fix dashboard totals`).
- Keep commits focused; don't mix UI, schema, and config changes.
- PRs should include a concise summary, note any Supabase migration or environment variable changes, and attach screenshots for UI updates.

## Security & Configuration Tips
- Secrets live in `.env.local` only. Required:
  - `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (frontend)
  - `SUPABASE_URL` (or fall back to `VITE_SUPABASE_URL` locally), `SUPABASE_SERVICE_ROLE_KEY` (server-only)
- Never prefix the service role key with `VITE_`. It must not be reachable from the browser bundle.
- Never hardcode credentials. Apply schema changes through migration files only.
- All write paths for orders, completion, station readiness, and donations go through service-role API routes. Anon clients only read `products`.
