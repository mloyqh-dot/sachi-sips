# Repository Guidelines

## Project Structure & Module Organization
This is a Vite + React + TypeScript app for the Sachi Sips POS dashboard. Keep application code in `src/`. Routing lives in `src/App.tsx`, the entry point is `src/main.tsx`, and shared types belong in `src/types/index.ts`. Page-level screens are organized under `src/pages/` (`pos/`, `receipts/`, `dashboard/`). Use `src/lib/supabase.ts` as the single Supabase client entry point. Static assets live in `public/` and `src/assets/`. Database schema work belongs in `supabase/migrations/`; seed data belongs in `supabase/seed/`.

## Build, Test, and Development Commands
- `npm run dev`: start the local Vite server with HMR.
- `npm run build`: run TypeScript project builds, then create the production bundle in `dist/`.
- `npm run lint`: run ESLint across the repo.
- `npm run preview`: serve the built app locally for smoke checks.

Run commands from the repository root: `C:\projects\sachi-sips`.

## Coding Style & Naming Conventions
Follow the existing TypeScript + React style:
- Use functional components and typed props/state.
- Prefer PascalCase for components (`POSPage.tsx`), camelCase for functions/variables, and UPPER_SNAKE_CASE for constants.
- Keep domain types centralized in `src/types/index.ts`.
- Reuse the shared Supabase client instead of creating new clients.

The current codebase uses semicolons and inline style objects extensively; match that style unless you are refactoring a full area. Linting is configured in `eslint.config.js` with `@eslint/js`, `typescript-eslint`, `react-hooks`, and `react-refresh`.

## UI Design & Brand Consistency
Preserve the existing Sachi Sips visual system. Use the established palette: pink `#E59090`, burgundy `#682837`, brown `#52301A`, green `#4D4823`, butter `#F0E4BF`, and yellow `#FFE373`. Prefer butter panels on pink or warm neutral surfaces, burgundy for headings, and brown for body text.

Typography should stay consistent with the current app: `Pinyon Script` for decorative brand moments only, `Alice` for headings, and `Public Sans` for UI/body text. Favor rounded corners, soft shadows, warm borders, and approachable spacing over stark enterprise styling. Reuse the existing inline-style patterns and avoid introducing a conflicting visual language.

For new UI, keep interactions simple, mobile-friendly, and event-staff oriented. Avoid adding multiple competing accent colors in one view; use yellow or green sparingly for emphasis, not both as primary highlights.

## Testing Guidelines
There is no automated test suite committed yet. Until one is added, treat `npm run lint` and `npm run build` as required pre-PR checks. For data-flow changes, verify the main routes manually: `/`, `/receipts`, and `/dashboard`. If you add tests, place them beside the feature or under `src/__tests__/` and use `*.test.ts` or `*.test.tsx`.

## React & Data Patterns
When extending React code, favor clear composition over piling on boolean mode props. Extract explicit variants or shared subcomponents when a component starts carrying multiple visual or behavioral modes. Keep render logic straightforward and avoid unnecessary abstraction in this small app.

For async work, avoid serial client-side waterfalls when requests are independent. For Supabase changes, route all access through `src/lib/supabase.ts`, put schema updates in `supabase/migrations/`, and consider RLS, constraints, and indexes whenever adding new tables or queries.

## Commit & Pull Request Guidelines
Local `.git` history is not available in this workspace, so use clear imperative commit subjects such as `Add receipt filtering` or `Fix dashboard totals`. Keep commits focused and avoid mixing UI, schema, and config changes.

PRs should include a concise summary, note any Supabase migration or environment variable changes, and attach screenshots for UI updates. Link the relevant issue or task when one exists.

## Security & Configuration Tips
Keep secrets in `.env.local` only. Required variables are `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Never hardcode credentials, and apply schema changes through migration files rather than ad hoc database edits.

## POS → Kitchen Order Workflow (Overview)

This project extends a basic POS system into a simple end-to-end order workflow:

* Cashier creates order from cart
* Order is stored persistently
* Kitchen views orders on a **Live Orders** page
* Kitchen marks orders as **completed/served**
* Completed orders are stored for history/dashboard

The system is built for a **Vercel + Supabase architecture**, and should remain lightweight, modular, and extensible (e.g. for future printing and analytics).

---

## Phases

### Phase 1 — Persistent Orders (Completed)

* Convert cart checkout into server-side order creation
* Store orders and line items in DB
* Generate ticket number, timestamp, and default `live` status
* Clear cart only after successful submission
* Show confirmation state

---

### Phase 2 — Live Orders Page

* Create `/live-orders` page for kitchen staff
* Display all orders with status `live`
* Show:

  * ticket number
  * time
  * items + quantities
  * modifiers (e.g. milk/sugar)
* Sort oldest first
* Display-only (no actions yet)

---

### Phase 3 — Auto Refresh

* Add polling to `/live-orders` (e.g. every few seconds)
* New orders should appear automatically
* Avoid full page reloads or UI flicker

---

### Phase 4 — Complete/Serve Orders

* Add “Mark as Served/Completed” action
* Update order status → `completed`
* Remove completed orders from live view
* Persist completion timestamp

---

### Phase 5 — Order History Foundation

* Enable querying completed orders separately
* Optionally add a simple history page
* Structure data for future dashboards/analytics

---

### Phase 6 — Hardening

* Prevent duplicate submissions
* Add loading/error/empty states
* Ensure safe status updates
* Improve kitchen readability
* Prepare for future extensions (printing, roles, notifications)

---

## Key Constraints

* Preserve existing POS/cart behavior
* Keep implementation MVP-level (avoid overengineering)
* Maintain clean separation:

  * cashier flow
  * order storage
  * kitchen view
* Ensure all order data is persistently stored (no frontend-only state)
