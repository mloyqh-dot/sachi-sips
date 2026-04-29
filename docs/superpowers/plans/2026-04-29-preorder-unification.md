# Preorder Unification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a unified preorder workflow where finalized TakeApp preorders import into the existing order system, release to stations 30 minutes before pickup, and are collected from a dedicated preorder IC page.

**Architecture:** Extend `orders` and `order_items` with explicit preorder/source metadata, keep live/station queues source-aware through `/api/live-orders`, and add `/preorders` plus local import scripts. The database remains the single source of truth for readiness, completion, receipts, and dashboard reporting.

**Tech Stack:** Vite, React 19, TypeScript, Vercel serverless functions, Supabase Postgres/RPC, Node.js ESM scripts.

---

## File Structure

- Create `supabase/migrations/015_add_preorder_workflow.sql`: preorder schema fields, import batch table, source constraints, indexes, `complete_order` return update, `collect_preorder`, and prep-required station readiness.
- Modify `src/types/index.ts`: add source/preorder fields to `Order`, `OrderItem`, and `OrderRecord`.
- Modify `api/live-orders.ts`: filter unreleased preorders and return preorder fields.
- Modify `api/orders-history.ts`: return preorder fields for receipts/dashboard.
- Modify `api/mark-station-ready.ts`: no type-level API shape change, but contract expects database RPC to ignore `prep_required = false`.
- Create `api/preorders.ts`: return all live preorder orders for the IC page.
- Create `api/collect-preorder.ts`: complete a preorder and set `preorder_collected_at`.
- Modify `vite.config.ts`: wire local dev mirrors for new API routes.
- Create `src/lib/orderFormatting.ts`: shared preorder/date/option labels used by queue pages.
- Create `src/pages/preorders/PreordersPage.tsx`: full preorder IC surface.
- Modify `src/App.tsx`: add `Preorders` nav and route.
- Modify `src/pages/live-orders/LiveOrdersPage.tsx`: show preorder labels and use prep-required readiness.
- Modify `src/pages/stations/StationPage.tsx`: show preorder labels and hide non-prep-required items from stations.
- Modify `src/pages/receipts/ReceiptsPage.tsx`: display preorder source/TakeApp metadata.
- Modify `src/pages/dashboard/DashboardPage.tsx`: preserve source metadata and add POS/preorder source metrics.
- Create `scripts/preorders/takeappNormalizer.mjs`: parse/group/normalize CSV rows into order payloads.
- Create `scripts/import-takeapp-preorders.mjs`: preview/final import CLI.
- Modify `scripts/order-contracts.test.mjs`: add static checks for preorder release, routes, collection, and importer invariants.

---

### Task 1: Database Preorder Schema And RPCs

**Files:**
- Create: `supabase/migrations/015_add_preorder_workflow.sql`

- [ ] **Step 1: Add the preorder migration**

Create `supabase/migrations/015_add_preorder_workflow.sql` with this structure:

```sql
begin;

create table if not exists order_import_batches (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('takeapp')),
  filename text not null,
  imported_at timestamptz not null default now(),
  finalized_at timestamptz,
  row_count integer not null check (row_count >= 0),
  order_count integer not null check (order_count >= 0),
  summary jsonb not null default '{}'::jsonb
);

alter table orders
  add column if not exists order_source text not null default 'pos',
  add column if not exists external_order_number text,
  add column if not exists external_order_name text,
  add column if not exists scheduled_for timestamptz,
  add column if not exists release_at timestamptz,
  add column if not exists prep_due_at timestamptz,
  add column if not exists preorder_payment_status text,
  add column if not exists preorder_fulfillment_status text,
  add column if not exists preorder_collected_at timestamptz,
  add column if not exists import_batch_id uuid references order_import_batches(id),
  add column if not exists external_raw jsonb;

alter table order_items
  add column if not exists external_lineitem_name text,
  add column if not exists external_lineitem_options text,
  add column if not exists external_lineitem_raw jsonb,
  add column if not exists prep_required boolean not null default true;

alter table orders
  drop constraint if exists orders_order_source_check;

alter table orders
  add constraint orders_order_source_check
  check (order_source in ('pos', 'preorder'));

alter table orders
  drop constraint if exists orders_preorder_required_fields_check;

alter table orders
  add constraint orders_preorder_required_fields_check
  check (
    order_source = 'pos'
    or (
      external_order_number is not null
      and scheduled_for is not null
      and release_at is not null
      and prep_due_at is not null
    )
  );

create unique index if not exists idx_orders_preorder_external_number
  on orders (external_order_number)
  where order_source = 'preorder';

create index if not exists idx_orders_live_source_release
  on orders (status, order_source, release_at, created_at);

create index if not exists idx_orders_preorder_schedule
  on orders (order_source, scheduled_for);
```

- [ ] **Step 2: Update station readiness RPC to ignore prepacked items**

In the same migration, replace `mark_station_ready`:

```sql
create or replace function mark_station_ready(
  p_order_id uuid,
  p_categories text[]
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_count integer := 0;
begin
  update order_items as oi
  set ready_at = now()
  from products as p
  where oi.order_id = p_order_id
    and oi.ready_at is null
    and oi.prep_required = true
    and oi.product_id = p.id
    and p.category = any(p_categories);

  get diagnostics updated_count = row_count;
  return updated_count;
end;
$$;

revoke all on function mark_station_ready(uuid, text[]) from public;
revoke all on function mark_station_ready(uuid, text[]) from anon;
revoke all on function mark_station_ready(uuid, text[]) from authenticated;
grant execute on function mark_station_ready(uuid, text[]) to service_role;
```

- [ ] **Step 3: Replace completion RPC and add preorder collection RPC**

Append to the migration:

```sql
create or replace function complete_order(
  p_order_id uuid
)
returns table (
  id uuid,
  ticket_number text,
  created_at timestamptz,
  completed_at timestamptz,
  status text,
  subtotal numeric,
  total numeric,
  payment_method text,
  notes text,
  staff_name text,
  order_type text,
  customer_name text,
  order_source text,
  external_order_number text,
  external_order_name text,
  scheduled_for timestamptz,
  release_at timestamptz,
  prep_due_at timestamptz,
  preorder_payment_status text,
  preorder_fulfillment_status text,
  preorder_collected_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_order orders%rowtype;
begin
  update orders as o
  set
    status = 'completed',
    completed_at = now()
  where o.id = p_order_id
    and o.status = 'live'
  returning * into updated_order;

  if not found then
    return;
  end if;

  return query
  select
    updated_order.id,
    updated_order.ticket_number,
    updated_order.created_at,
    updated_order.completed_at,
    updated_order.status,
    updated_order.subtotal,
    updated_order.total,
    updated_order.payment_method,
    updated_order.notes,
    updated_order.staff_name,
    updated_order.order_type,
    updated_order.customer_name,
    updated_order.order_source,
    updated_order.external_order_number,
    updated_order.external_order_name,
    updated_order.scheduled_for,
    updated_order.release_at,
    updated_order.prep_due_at,
    updated_order.preorder_payment_status,
    updated_order.preorder_fulfillment_status,
    updated_order.preorder_collected_at;
end;
$$;

create or replace function collect_preorder(
  p_order_id uuid
)
returns table (
  id uuid,
  ticket_number text,
  created_at timestamptz,
  completed_at timestamptz,
  status text,
  subtotal numeric,
  total numeric,
  payment_method text,
  notes text,
  staff_name text,
  order_type text,
  customer_name text,
  order_source text,
  external_order_number text,
  external_order_name text,
  scheduled_for timestamptz,
  release_at timestamptz,
  prep_due_at timestamptz,
  preorder_payment_status text,
  preorder_fulfillment_status text,
  preorder_collected_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_order orders%rowtype;
begin
  update orders as o
  set
    status = 'completed',
    completed_at = now(),
    preorder_collected_at = now()
  where o.id = p_order_id
    and o.status = 'live'
    and o.order_source = 'preorder'
  returning * into updated_order;

  if not found then
    return;
  end if;

  return query
  select
    updated_order.id,
    updated_order.ticket_number,
    updated_order.created_at,
    updated_order.completed_at,
    updated_order.status,
    updated_order.subtotal,
    updated_order.total,
    updated_order.payment_method,
    updated_order.notes,
    updated_order.staff_name,
    updated_order.order_type,
    updated_order.customer_name,
    updated_order.order_source,
    updated_order.external_order_number,
    updated_order.external_order_name,
    updated_order.scheduled_for,
    updated_order.release_at,
    updated_order.prep_due_at,
    updated_order.preorder_payment_status,
    updated_order.preorder_fulfillment_status,
    updated_order.preorder_collected_at;
end;
$$;

grant update (
  status,
  completed_at,
  preorder_collected_at
) on table orders to service_role;

grant execute on function complete_order(uuid) to service_role;
grant execute on function collect_preorder(uuid) to service_role;

notify pgrst, 'reload schema';

commit;
```

- [ ] **Step 4: Run static SQL sanity checks**

Run:

```powershell
rg "order_source|collect_preorder|prep_required|idx_orders_preorder_external_number" supabase\migrations\015_add_preorder_workflow.sql
```

Expected: matches for every searched token.

- [ ] **Step 5: Commit**

```powershell
git add supabase\migrations\015_add_preorder_workflow.sql
git commit -m "Add preorder workflow schema"
```

---

### Task 2: Shared Types And Formatting Helpers

**Files:**
- Modify: `src/types/index.ts`
- Create: `src/lib/orderFormatting.ts`

- [ ] **Step 1: Extend domain types**

In `src/types/index.ts`, add:

```ts
export type OrderSource = 'pos' | 'preorder';
```

Update `OrderItem`:

```ts
export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  name: string;
  quantity: number;
  unit_price: number;
  options: ProductOptions | null;
  line_total: number;
  created_at: string;
  ready_at: string | null;
  prep_required: boolean;
  external_lineitem_name?: string | null;
  external_lineitem_options?: string | null;
  external_lineitem_raw?: Record<string, unknown> | null;
}
```

Update `Order`:

```ts
export interface Order {
  id: string;
  ticket_number: string;
  created_at: string;
  completed_at?: string | null;
  status: OrderStatus;
  order_type: OrderType;
  subtotal: number;
  total: number;
  payment_method: PaymentMethod;
  notes?: string | null;
  staff_name: string;
  customer_name?: string | null;
  order_source: OrderSource;
  external_order_number?: string | null;
  external_order_name?: string | null;
  scheduled_for?: string | null;
  release_at?: string | null;
  prep_due_at?: string | null;
  preorder_payment_status?: string | null;
  preorder_fulfillment_status?: string | null;
  preorder_collected_at?: string | null;
  external_raw?: Record<string, unknown> | null;
  items: OrderItem[];
}
```

- [ ] **Step 2: Create shared formatting helper**

Create `src/lib/orderFormatting.ts`:

```ts
import type { Order, OrderItem } from '../types';

export const MILK_LABELS: Record<string, string> = {
  dairy: 'Dairy',
  oat: 'Oat',
};

export const SUGAR_LABELS: Record<string, string> = {
  no_sugar: 'No Sugar',
  less_sweet: 'Less Sweet',
  normal: 'Normal Sugar',
  more_sweet: 'More Sweet',
};

export const WARM_UP_LABELS: Record<string, string> = {
  warm_up: 'Warm Up',
  no_warm_up: 'No Warm Up',
};

export function formatOrderTime(value: string) {
  return new Date(value).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatOrderDateTime(value: string) {
  return new Date(value).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatOptions(options: OrderItem['options']) {
  if (!options) return null;

  const labels = [
    options.milk ? MILK_LABELS[options.milk] ?? options.milk : null,
    options.sugar ? SUGAR_LABELS[options.sugar] ?? options.sugar : null,
    options.warm_up ? WARM_UP_LABELS[options.warm_up] ?? options.warm_up : null,
  ].filter(Boolean);

  return labels.length > 0 ? labels.join(' / ') : null;
}

export function getOrderTypeLabel(orderType: Order['order_type']) {
  return orderType === 'takeaway' ? 'Takeaway' : 'Dine In';
}

export function isPreorder(order: Pick<Order, 'order_source'>) {
  return order.order_source === 'preorder';
}

export function getPreorderLabel(order: Pick<Order, 'external_order_number' | 'external_order_name'>) {
  return `TakeApp ${order.external_order_name || `#${order.external_order_number ?? ''}`}`.trim();
}

export function getPickupSlotLabel(order: Pick<Order, 'scheduled_for'>) {
  if (!order.scheduled_for) return null;

  return new Date(order.scheduled_for).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
```

- [ ] **Step 3: Run typecheck**

Run:

```powershell
cmd /c npm.cmd run build
```

Expected initially: it may fail because APIs/pages do not yet return new required fields. If it fails only on missing `order_source`/`prep_required`, continue to Task 3. If it fails elsewhere, fix before continuing.

- [ ] **Step 4: Commit**

```powershell
git add src\types\index.ts src\lib\orderFormatting.ts
git commit -m "Add preorder order types"
```

---

### Task 3: Source-Aware Order APIs

**Files:**
- Modify: `api/live-orders.ts`
- Modify: `api/orders-history.ts`
- Create: `api/preorders.ts`
- Create: `api/collect-preorder.ts`
- Modify: `api/complete-order.ts`
- Modify: `vite.config.ts`

- [ ] **Step 1: Update selected columns in live/history APIs**

In both `api/live-orders.ts` and `api/orders-history.ts`, include these order fields in the Supabase select:

```ts
      order_source,
      external_order_number,
      external_order_name,
      scheduled_for,
      release_at,
      prep_due_at,
      preorder_payment_status,
      preorder_fulfillment_status,
      preorder_collected_at,
      external_raw,
```

Include these item fields inside `order_items`:

```ts
        prep_required,
        external_lineitem_name,
        external_lineitem_options,
        external_lineitem_raw
```

- [ ] **Step 2: Add release filtering to live orders**

In `api/live-orders.ts`, replace the simple `.eq('status', 'live')` chain with:

```ts
    .eq('status', 'live')
    .or(`order_source.eq.pos,and(order_source.eq.preorder,release_at.lte.${new Date().toISOString()})`)
    .order('created_at', { ascending: true })
```

Keep the existing foreign table ordering for `order_items`.

- [ ] **Step 3: Create preorder list API**

Create `api/preorders.ts` by copying the validated environment handling from `api/live-orders.ts`, then query:

```ts
  const { data, error } = await supabase
    .from('orders')
    .select(`
      id,
      ticket_number,
      created_at,
      completed_at,
      status,
      order_type,
      subtotal,
      total,
      payment_method,
      notes,
      staff_name,
      customer_name,
      order_source,
      external_order_number,
      external_order_name,
      scheduled_for,
      release_at,
      prep_due_at,
      preorder_payment_status,
      preorder_fulfillment_status,
      preorder_collected_at,
      external_raw,
      order_items (
        id,
        order_id,
        product_id,
        name,
        quantity,
        unit_price,
        options,
        line_total,
        created_at,
        ready_at,
        prep_required,
        external_lineitem_name,
        external_lineitem_options,
        external_lineitem_raw
      )
    `)
    .eq('status', 'live')
    .eq('order_source', 'preorder')
    .order('scheduled_for', { ascending: true })
    .order('created_at', { foreignTable: 'order_items', ascending: true });
```

Return `{ orders: data ?? [] }`.

- [ ] **Step 4: Create collect preorder API**

Create `api/collect-preorder.ts`:

```ts
import { createClient } from '@supabase/supabase-js';

type CollectPreorderRequest = {
  orderId?: string;
};

type VercelRequest = {
  method?: string;
  body?: CollectPreorderRequest;
};

type VercelResponse = {
  status: (code: number) => VercelResponse;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string | string[]) => void;
};

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i.test(value);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Allow', ['POST']);

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    res.status(500).json({ error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' });
    return;
  }

  const orderId = req.body?.orderId?.trim() ?? '';

  if (!isUuid(orderId)) {
    res.status(400).json({ error: 'A valid orderId is required' });
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
  const { data, error } = await supabase.rpc('collect_preorder', {
    p_order_id: orderId,
  });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  const order = Array.isArray(data) ? data[0] : data;

  if (!order) {
    res.status(409).json({ error: 'Preorder is no longer live or could not be found' });
    return;
  }

  res.status(200).json({ order });
}
```

- [ ] **Step 5: Update complete-order response typing**

In `api/complete-order.ts`, no request behavior changes are needed. Ensure the response can pass through the wider RPC return shape by keeping `order` typed as unknown/inferred from Supabase RPC data.

- [ ] **Step 6: Mirror new APIs in Vite**

In `vite.config.ts`, add local API mirrors for:

```ts
'/api/preorders'
'/api/collect-preorder'
```

Follow the same existing pattern used for `/api/live-orders` and `/api/complete-order`.

- [ ] **Step 7: Run contract and build checks**

Run:

```powershell
cmd /c npm.cmd run test:contracts
cmd /c npm.cmd run build
```

Expected: existing contracts pass. Build passes after type fields are returned consistently.

- [ ] **Step 8: Commit**

```powershell
git add api\live-orders.ts api\orders-history.ts api\preorders.ts api\collect-preorder.ts api\complete-order.ts vite.config.ts
git commit -m "Add preorder order APIs"
```

---

### Task 4: TakeApp Import Normalizer And CLI

**Files:**
- Create: `scripts/preorders/takeappNormalizer.mjs`
- Create: `scripts/import-takeapp-preorders.mjs`

- [ ] **Step 1: Create CSV parser and grouping helpers**

Create `scripts/preorders/takeappNormalizer.mjs` with a small RFC4180-style parser:

```js
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (inQuotes && char === '"' && next === '"') {
      field += '"';
      i += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (!inQuotes && char === ',') {
      row.push(field);
      field = '';
    } else if (!inQuotes && (char === '\n' || char === '\r')) {
      if (char === '\r' && next === '\n') i += 1;
      row.push(field);
      if (row.some(value => value !== '')) rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }

  row.push(field);
  if (row.some(value => value !== '')) rows.push(row);

  const [headers, ...dataRows] = rows;
  return dataRows.map(values =>
    Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']))
  );
}

export function groupRowsByOrderNumber(rows) {
  const groups = new Map();

  for (const row of rows) {
    const orderNumber = row['Order number']?.trim();
    if (!orderNumber) throw new Error('CSV row is missing Order number');
    if (!groups.has(orderNumber)) groups.set(orderNumber, []);
    groups.get(orderNumber).push(row);
  }

  return Array.from(groups.entries()).map(([orderNumber, orderRows]) => ({
    orderNumber,
    rows: orderRows,
  }));
}
```

- [ ] **Step 2: Add date/order-type/option parsing helpers**

In the same file, add:

```js
const SGT_OFFSET = '+08:00';

export function parseOrderType(value) {
  const normalized = value.toLowerCase();
  if (normalized.includes('takeaway')) return 'takeaway';
  if (normalized.includes('dine-in') || normalized.includes('dine in')) return 'dine_in';
  throw new Error(`Unsupported dine-in/takeaway value: ${value}`);
}

export function parseServiceStart({ serviceDate, serviceTime }) {
  const start = serviceTime.split('~')[0]?.trim();
  if (!serviceDate || !start) throw new Error(`Malformed service date/time: ${serviceDate} ${serviceTime}`);

  const date = new Date(`${serviceDate} ${start} GMT+0800`);
  if (Number.isNaN(date.getTime())) throw new Error(`Unable to parse service date/time: ${serviceDate} ${serviceTime}`);

  return date;
}

export function minutesBefore(date, minutes) {
  return new Date(date.getTime() - minutes * 60 * 1000);
}

export function parseOptions(text) {
  const normalized = text.toLowerCase();
  const options = {};

  if (normalized.includes('oat')) options.milk = 'oat';
  if (normalized.includes('dairy')) options.milk = 'dairy';
  if (normalized.includes('less sugar')) options.sugar = 'less_sweet';
  if (normalized.includes('no sugar')) options.sugar = 'no_sugar';
  if (normalized.includes('normal sugar')) options.sugar = 'normal';
  if (normalized.includes('more sugar')) options.sugar = 'more_sweet';

  return options;
}
```

- [ ] **Step 3: Add product matching and item explosion**

Add exact matching maps based on current product names:

```js
const PRODUCT_ALIASES = new Map([
  ['Iced Matcha Latte', 'Iced Matcha Latte'],
  ['Iced Strawberry Matcha', 'Iced Strawberry Matcha Latte'],
  ['Iced Strawberry Matcha Latte', 'Iced Strawberry Matcha Latte'],
  ['Iced Lychee Matcha', 'Iced Lychee Matcha Latte'],
  ['Iced Lychee Matcha Latte', 'Iced Lychee Matcha Latte'],
  ['Iced Hojicha Latte', 'Iced Hojicha Latte'],
  ['Iced Banana Hojicha', 'Iced Banana Hojicha Latte'],
  ['Iced Banana Hojicha Latte', 'Iced Banana Hojicha Latte'],
  ['Momotarō (hot)', 'Momotarō - Hot'],
  ['Momotarō (iced)', 'Momotarō - Iced'],
  ['Orthodox (hot)', 'Orthodox - Hot'],
  ['Orthodox (iced)', 'Orthodox - Iced'],
  ['Mocktail Flight', 'Mocktail Flight (Set of 3 mini drinks)'],
  ['Tater Tots', 'Tater Tots'],
  ['Spam Musubi', 'Spam Musubi'],
  ['Classic Shio Pan', 'Classic Shio Pan'],
  ['Scallion Cream Cheese Onion Shio Pan', 'Scallion Cream Cheese Onion Shio Pan'],
  ["Sachi's Postcard", "Sachi's Postcard"],
  ["Sachi's Sticker", "Sachi's Sticker"],
  ["Sachi's Starter Pack", "Sachi's Starter Pack"],
  ["Sachi's Tote", "Sachi's Tote"],
  ['Friends of Sachi Merch Collection', 'Sticker Sheet'],
]);

function normalizeLineName(name) {
  return name
    .replace(/\s+-\s+Drink Only\s*$/i, '')
    .replace(/\s+by\s+thenoobcooks\s*$/i, '')
    .replace(/\s+by\s+ONO\s*$/i, '')
    .trim();
}

export function resolveProduct(productsByName, sourceName) {
  const normalized = normalizeLineName(sourceName);
  const canonical = PRODUCT_ALIASES.get(normalized) ?? normalized;
  const product = productsByName.get(canonical);
  if (!product) throw new Error(`No product mapping for "${sourceName}" -> "${canonical}"`);
  return product;
}
```

Then implement `normalizeTakeappRows(rows, products)` that returns:

```js
{
  orders: [
    {
      external_order_number,
      external_order_name,
      customer_name,
      order_type,
      scheduled_for,
      release_at,
      prep_due_at,
      preorder_payment_status,
      preorder_fulfillment_status,
      subtotal,
      total,
      payment_method: 'other',
      staff_name: 'TakeApp Import',
      notes,
      external_raw,
      items,
    }
  ],
  summary: { rowCount, orderCount, errors: [] }
}
```

For `Bestie Set`, parse `Drink #1`, `Drink #2`, and `Bites` from `Lineitem option`. For `Make It A Set (...)`, split the base drink from the parenthesized bite. Allocate source row price proportionally:

```js
export function allocateSetPrice(sourceTotal, products) {
  const normalTotal = products.reduce((sum, product) => sum + Number(product.price), 0);
  let allocated = products.map(product => Math.round((sourceTotal * Number(product.price) / normalTotal) * 100) / 100);
  const allocatedWithoutLast = allocated.slice(0, -1).reduce((sum, value) => sum + value, 0);
  allocated[allocated.length - 1] = Math.round((sourceTotal - allocatedWithoutLast) * 100) / 100;
  return allocated;
}
```

- [ ] **Step 4: Create import CLI**

Create `scripts/import-takeapp-preorders.mjs`:

```js
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { groupRowsByOrderNumber, normalizeTakeappRows, parseCsv } from './preorders/takeappNormalizer.mjs';

const args = new Map(process.argv.slice(2).map(arg => {
  const [key, value = 'true'] = arg.split('=');
  return [key, value];
}));

const csvPath = args.get('--csv');
const mode = args.get('--mode') ?? 'preview';

if (!csvPath) throw new Error('Usage: node scripts/import-takeapp-preorders.mjs --csv=path/to/file.csv --mode=preview|import');
if (!['preview', 'import'].includes(mode)) throw new Error('--mode must be preview or import');

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) throw new Error('Missing SUPABASE_URL/VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');

const supabase = createClient(supabaseUrl, serviceRoleKey);
const csvText = readFileSync(csvPath, 'utf8');
const rows = parseCsv(csvText);
const groups = groupRowsByOrderNumber(rows);

const { data: products, error: productsError } = await supabase
  .from('products')
  .select('id, name, price, category, subcategory, sort_order, is_available');

if (productsError) throw new Error(productsError.message);

const normalized = normalizeTakeappRows(rows, products ?? []);

console.log(JSON.stringify({
  mode,
  filename: basename(csvPath),
  rowCount: rows.length,
  groupedOrderCount: groups.length,
  normalizedOrderCount: normalized.orders.length,
  summary: normalized.summary,
}, null, 2));

if (mode === 'preview') process.exit(0);

const externalNumbers = normalized.orders.map(order => order.external_order_number);
const { data: existing, error: existingError } = await supabase
  .from('orders')
  .select('external_order_number')
  .eq('order_source', 'preorder')
  .in('external_order_number', externalNumbers);

if (existingError) throw new Error(existingError.message);
if ((existing ?? []).length > 0) {
  throw new Error(`Refusing duplicate TakeApp orders: ${(existing ?? []).map(order => order.external_order_number).join(', ')}`);
}

const { data: batch, error: batchError } = await supabase
  .from('order_import_batches')
  .insert({
    source: 'takeapp',
    filename: basename(csvPath),
    row_count: rows.length,
    order_count: normalized.orders.length,
    summary: normalized.summary,
  })
  .select('id')
  .single();

if (batchError) throw new Error(batchError.message);

for (const order of normalized.orders) {
  const { items, ...orderRow } = order;
  const { data: insertedOrder, error: orderError } = await supabase
    .from('orders')
    .insert({
      ...orderRow,
      order_source: 'preorder',
      import_batch_id: batch.id,
    })
    .select('id')
    .single();

  if (orderError) throw new Error(orderError.message);

  const { error: itemsError } = await supabase
    .from('order_items')
    .insert(items.map(item => ({
      ...item,
      order_id: insertedOrder.id,
    })));

  if (itemsError) throw new Error(itemsError.message);
}

const { error: finalizeError } = await supabase
  .from('order_import_batches')
  .update({ finalized_at: new Date().toISOString() })
  .eq('id', batch.id);

if (finalizeError) throw new Error(finalizeError.message);

console.log(`Imported ${normalized.orders.length} preorder orders from ${basename(csvPath)}.`);
```

Use direct inserts rather than `/api/orders` because preorder metadata is server-only import data.

- [ ] **Step 5: Preview against the current sample CSV**

Run:

```powershell
$env:SUPABASE_URL=$env:VITE_SUPABASE_URL; node scripts\import-takeapp-preorders.mjs --csv="C:\Users\Marcus\Downloads\Telegram Desktop\TakeOrders_2026_04_29 (2).csv" --mode=preview
```

Expected:

- `rowCount` equals `82` for the current sample.
- `groupedOrderCount` equals `34`.
- no unmapped product errors.

- [ ] **Step 6: Commit**

```powershell
git add scripts\preorders\takeappNormalizer.mjs scripts\import-takeapp-preorders.mjs
git commit -m "Add TakeApp preorder importer"
```

---

### Task 5: Preorder IC Page

**Files:**
- Create: `src/pages/preorders/PreordersPage.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Create the Preorders page**

Create `src/pages/preorders/PreordersPage.tsx` with:

```tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Order, OrderRecord } from '../../types';
import { formatOptions, getOrderTypeLabel, getPickupSlotLabel, getPreorderLabel } from '../../lib/orderFormatting';

const POLL_INTERVAL_MS = 5000;

function normalizeOrder(order: OrderRecord): Order {
  return {
    ...order,
    items: order.order_items ?? [],
  };
}

async function fetchPreorders() {
  const response = await fetch('/api/preorders');
  const result = await response.json().catch(() => null) as { error?: string; orders?: OrderRecord[] } | null;

  if (!response.ok) {
    throw new Error(result?.error || 'Unable to load preorders');
  }

  return (result?.orders ?? []).map(normalizeOrder);
}

async function collectPreorder(orderId: string) {
  const response = await fetch('/api/collect-preorder', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderId }),
  });
  const result = await response.json().catch(() => null) as { error?: string } | null;

  if (!response.ok) {
    throw new Error(result?.error || 'Unable to collect preorder');
  }
}
```

Implement page state with the existing polling pattern: `isFetchingRef`, `active`, visibility guard, and 5 second interval.

- [ ] **Step 2: Add readiness helpers**

In the page file, add:

```ts
function getPrepItems(order: Order) {
  return order.items.filter(item => item.prep_required !== false);
}

function isReadyToCollect(order: Order) {
  const prepItems = getPrepItems(order);
  return prepItems.length === 0 || prepItems.every(item => item.ready_at !== null);
}

function isReleased(order: Order) {
  return Boolean(order.release_at && new Date(order.release_at).getTime() <= Date.now());
}

function getSlotKey(order: Order) {
  return order.scheduled_for ?? 'unscheduled';
}
```

- [ ] **Step 3: Render Now / Next Up and Full Day sections**

Render:

- hero with open preorder count and ready-to-collect count.
- `Now / Next Up`: released orders and orders within the next 45 minutes.
- `Full Day`: grouped by `scheduled_for`.
- card metadata: `PREORDER`, `TakeApp #`, ticket number, customer name, order type, pickup slot, payment status.
- items separated into prep items and prepacked items.
- `Mark Collected` button enabled only when `isReadyToCollect(order)` is true.

Use the existing brand palette and inline-style pattern from `LiveOrdersPage.tsx`.

- [ ] **Step 4: Add navigation route**

In `src/App.tsx`, import the page:

```ts
import PreordersPage from './pages/preorders/PreordersPage';
```

Add nav link near Live Orders:

```tsx
<NavLink to="/preorders" style={navLinkStyle}>Preorders</NavLink>
```

Add route:

```tsx
<Route path="/preorders" element={<PreordersPage />} />
```

- [ ] **Step 5: Build**

Run:

```powershell
cmd /c npm.cmd run build
```

Expected: build passes.

- [ ] **Step 6: Commit**

```powershell
git add src\pages\preorders\PreordersPage.tsx src\App.tsx
git commit -m "Add preorder IC page"
```

---

### Task 6: Queue Cards And Readiness Rules

**Files:**
- Modify: `src/pages/live-orders/LiveOrdersPage.tsx`
- Modify: `src/pages/stations/StationPage.tsx`

- [ ] **Step 1: Update live-order ready-to-serve logic**

In `LiveOrdersPage.tsx`, update `isOrderReadyToServe` so merch/prepacked items do not block:

```ts
  const stationItems = order.items.filter(item => {
    if (item.prep_required === false) return false;

    const category = productCategoryMap.get(item.product_id);
    return category ? STATION_READY_CATEGORIES.has(category) : true;
  });
```

Return true when there are no prep-required station items:

```ts
  return stationItems.length === 0 || stationItems.every(item => item.ready_at !== null);
```

- [ ] **Step 2: Add preorder metadata to live-order cards**

In the card header, after order type badge, render:

```tsx
{order.order_source === 'preorder' && (
  <span style={s.preorderBadge}>PREORDER</span>
)}
```

Below customer name, render:

```tsx
{order.order_source === 'preorder' && (
  <span style={s.itemMeta}>
    {getPreorderLabel(order)} · Pickup {getPickupSlotLabel(order)} · {order.preorder_payment_status ?? 'Payment unknown'}
  </span>
)}
```

Import `getPickupSlotLabel` and `getPreorderLabel` from `../../lib/orderFormatting`.

- [ ] **Step 3: Hide non-prep-required items from station pages**

In `StationPage.tsx`, update station item filtering:

```ts
items: order.items.filter(item => {
  if (item.prep_required === false) return false;

  const category = productCategoryMap.get(item.product_id);
  return category ? categories.includes(category) : false;
}),
```

- [ ] **Step 4: Add preorder metadata to station cards**

As in the live-order page, add a `PREORDER` badge and TakeApp/pickup/payment metadata in the station card header.

- [ ] **Step 5: Build**

Run:

```powershell
cmd /c npm.cmd run build
```

Expected: build passes.

- [ ] **Step 6: Commit**

```powershell
git add src\pages\live-orders\LiveOrdersPage.tsx src\pages\stations\StationPage.tsx
git commit -m "Show released preorders in queues"
```

---

### Task 7: Receipts, Dashboard, And Contracts

**Files:**
- Modify: `src/pages/receipts/ReceiptsPage.tsx`
- Modify: `src/pages/dashboard/DashboardPage.tsx`
- Modify: `scripts/order-contracts.test.mjs`

- [ ] **Step 1: Show preorder metadata in receipts**

In `ReceiptsPage.tsx`, where selected order details render, show a source badge when:

```tsx
selectedOrder.order_source === 'preorder'
```

Display:

```tsx
Preorder · TakeApp #... · Pickup ...
```

Use helper functions from `src/lib/orderFormatting.ts`.

- [ ] **Step 2: Add dashboard source visibility**

In `DashboardPage.tsx`, add either:

- source filter: `all | pos | preorder`, or
- summary metrics: POS sales and preorder sales.

Minimum required implementation:

```ts
const preorderOrders = filteredOrders.filter(order => order.order_source === 'preorder');
const posOrders = filteredOrders.filter(order => order.order_source !== 'preorder');
```

Render counts/totals alongside existing sales metrics.

- [ ] **Step 3: Add contract assertions**

In `scripts/order-contracts.test.mjs`, read the new files:

```js
const apiPreorders = readFileSync(new URL('../api/preorders.ts', import.meta.url), 'utf8');
const apiCollectPreorder = readFileSync(new URL('../api/collect-preorder.ts', import.meta.url), 'utf8');
const preorderPage = readFileSync(new URL('../src/pages/preorders/PreordersPage.tsx', import.meta.url), 'utf8');
const preorderMigration = readFileSync(new URL('../supabase/migrations/015_add_preorder_workflow.sql', import.meta.url), 'utf8');
const takeappNormalizer = readFileSync(new URL('../scripts/preorders/takeappNormalizer.mjs', import.meta.url), 'utf8');
```

Add assertions:

```js
assert.match(apiLiveOrders, /release_at\.lte|order_source\.eq\.preorder/, 'api/live-orders.ts should hide unreleased preorders');
assert.match(apiLiveOrders, /order_source[\s\S]*external_order_number[\s\S]*scheduled_for/, 'api/live-orders.ts should return preorder metadata');
assert.match(apiPreorders, /\.eq\('order_source', 'preorder'\)/, 'api/preorders.ts should return preorder orders only');
assert.match(apiCollectPreorder, /collect_preorder/, 'api/collect-preorder.ts should use the preorder collection RPC');
assert.match(preorderMigration, /oi\.prep_required = true/, 'mark_station_ready should update prep-required items only');
assert.match(preorderMigration, /create or replace function collect_preorder/, 'migration should define atomic preorder collection');
assert.match(takeappNormalizer, /Question 1|parseOrderType/, 'TakeApp importer should parse column AP dine-in\/takeaway into order_type');
assert.match(takeappNormalizer, /Bestie Set|Make It A Set|allocateSetPrice/, 'TakeApp importer should split set rows and preserve price allocation');
assert.match(takeappNormalizer, /prep_required:\s*false|prep_required.*false/s, 'TakeApp importer should mark merch and postcards as non-prep-required');
assert.match(preorderPage, /Mark Collected|collectPreorder|Ready to Collect/, 'PreordersPage should support collection from the IC page');
assert.match(app, /PreordersPage|\/preorders/, 'App should expose the preorder IC page');
```

- [ ] **Step 4: Run checks**

Run:

```powershell
cmd /c npm.cmd run test:contracts
cmd /c npm.cmd run lint
cmd /c npm.cmd run build
```

Expected: all pass.

- [ ] **Step 5: Commit**

```powershell
git add src\pages\receipts\ReceiptsPage.tsx src\pages\dashboard\DashboardPage.tsx scripts\order-contracts.test.mjs
git commit -m "Add preorder reporting contracts"
```

---

### Task 8: Final Import Runbook

**Files:**
- Create: `docs/preorder-import-runbook.md`

- [ ] **Step 1: Write operator runbook**

Create `docs/preorder-import-runbook.md`:

```md
# Preorder Import Runbook

## Before Import

1. Confirm preorders are closed in TakeApp.
2. Export the final CSV.
3. Save the CSV path.
4. Confirm `.env.local` contains `VITE_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.

## Preview

Run:

```powershell
node scripts\import-takeapp-preorders.mjs --csv="C:\path\to\final.csv" --mode=preview
```

Confirm:

- row count matches the CSV.
- order count matches TakeApp.
- no unmapped products.
- no malformed times.
- totals reconcile.

## Import

Run:

```powershell
node scripts\import-takeapp-preorders.mjs --csv="C:\path\to\final.csv" --mode=import
```

## Smoke Test

1. Open `/preorders`.
2. Confirm full-day grouping by pickup slot.
3. Confirm unreleased preorders do not appear on stations.
4. Confirm released preorders appear 30 minutes before pickup.
5. Mark stations ready.
6. Mark collected from `/preorders`.
7. Confirm receipts/dashboard include the completed preorder.
```

- [ ] **Step 2: Commit**

```powershell
git add docs\preorder-import-runbook.md
git commit -m "Document preorder import runbook"
```

---

## Final Verification

- [ ] Run all required checks:

```powershell
cmd /c npm.cmd run lint
cmd /c npm.cmd run build
cmd /c npm.cmd run test:contracts
```

- [ ] Start the dev server:

```powershell
cmd /c npm.cmd run dev
```

- [ ] Verify in browser:

Open `http://localhost:5173/preorders`, `http://localhost:5173/live-orders`, and station pages. Confirm the pages load without console/runtime errors.

- [ ] Preview the latest CSV:

```powershell
node scripts\import-takeapp-preorders.mjs --csv="C:\Users\Marcus\Downloads\Telegram Desktop\TakeOrders_2026_04_29 (2).csv" --mode=preview
```

Expected for the current sample: 82 rows, 34 grouped orders, and zero blocking normalization errors.
