# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Sachi Sips Dashboard** — A POS/Receipt system dashboard for the nonprofit Sachi Sips (owner: Joy).

Tech stack: React + TypeScript (Vite), Supabase (database/auth), React Router, Vercel (hosting).

## Commands

```bash
npm run dev      # Start local dev server (http://localhost:5173)
npm run build    # Production build
npm run lint     # ESLint
npm run preview  # Preview production build locally
```

## Environment Variables

Copy `.env.local` and fill in your Supabase project values:
- `VITE_SUPABASE_URL` — Supabase project URL
- `VITE_SUPABASE_ANON_KEY` — Supabase anon/public key

These must also be set in Vercel project settings for production.

## Architecture

### Folder Structure
```
src/
  lib/supabase.ts        # Supabase client (single import point for all DB access)
  types/index.ts         # Domain types: Product, CartItem, Transaction, Receipt
  pages/
    pos/POSPage.tsx      # Point-of-sale interface
    receipts/ReceiptsPage.tsx  # Transaction/receipt history
    dashboard/DashboardPage.tsx # Sales summary for Joy/staff
  components/ui/         # Shared presentational components
```

### Routing
React Router DOM with three top-level routes defined in `App.tsx`:
- `/` → POSPage
- `/receipts` → ReceiptsPage
- `/dashboard` → DashboardPage

### Supabase Conventions
- All DB access goes through `src/lib/supabase.ts` — never create a second client
- Schema changes belong in migration files, not applied ad-hoc
- Always consider Row Level Security (RLS) for any client-exposed table
- `CartItem.items` is stored as JSONB in Supabase (not a relational join)

### Domain Model
- **Product**: menu items with price and availability toggle
- **Transaction**: a completed sale — contains serialized cart items + total + payment method
- **Receipt**: a view/printable record linked to a Transaction

## Design Principles
- Simplicity first — primary users are nonprofit staff, not technical users
- Mobile-friendly layouts for POS (staff use tablets/phones at events)
