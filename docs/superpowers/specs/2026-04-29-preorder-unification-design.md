# Preorder Unification Design

## Context

Joy opened TakeApp preorders for the 1 May 2026 event. Those preorders must be prepared while normal POS orders continue to flow through the Sachi Sips order management system. Running preorders as a separate operational system would create station confusion, duplicate reconciliation work, and a high chance that prep or collection is missed.

The current TakeApp CSV is itemized by row. Multiple rows can belong to the same customer order via `Order number`. Orders are scheduled into half-hour pickup slots from 11:30 AM to 5:30 PM Singapore time. Stations should see a preorder 30 minutes before the slot starts, and the prep target is 15 minutes before the slot starts.

## Goals

- Import finalized TakeApp preorders into the same order workflow used by POS orders.
- Keep preorder data clearly segregated from POS data through explicit source fields.
- Hide unreleased preorders from station and live-order queues.
- Give the preorder IC a dedicated page for full-day overview, current/next-up monitoring, and collection.
- Preserve accurate revenue, item counts, payment status, TakeApp identifiers, and raw import metadata for reconciliation.
- Normalize preorder items into the same station-visible order items that live POS orders use.

## Non-Goals

- Do not build a fully reusable public CSV upload UI before the finalized CSV arrives.
- Do not let stations manage collection. Stations only mark prep readiness.
- Do not import only paid orders. All pending TakeApp orders are imported; payment is settled separately.
- Do not update finalized imported orders from subsequent CSVs. Once the final import is accepted, duplicate TakeApp order numbers are refused.

## Data Model

Extend `orders` as the unified source of truth.

New `orders` fields:

- `order_source text not null default 'pos'`, constrained to `pos` or `preorder`.
- `external_order_number text`, the TakeApp order number, for example `34`.
- `external_order_name text`, the TakeApp display name, for example `#34`.
- `scheduled_for timestamptz`, the pickup slot start in Singapore local time converted to an absolute timestamp.
- `release_at timestamptz`, always `scheduled_for - interval '30 minutes'` for preorders.
- `prep_due_at timestamptz`, always `scheduled_for - interval '15 minutes'` for preorders.
- `preorder_payment_status text`, raw TakeApp payment status such as `Paid`, `Confirming Payment`, or `Unpaid`.
- `preorder_fulfillment_status text`, raw TakeApp fulfillment status.
- `preorder_collected_at timestamptz`, set when the preorder IC marks the order collected.
- `import_batch_id uuid`, references the import batch that created the preorder.
- `external_raw jsonb`, order-level TakeApp metadata retained for audit.

Constraints and indexes:

- `order_source` is required for every order.
- POS orders keep `external_order_number`, schedule fields, and preorder fields null.
- Preorders require `external_order_number`, `scheduled_for`, `release_at`, and `prep_due_at`.
- Unique preorder identity is enforced by a partial unique index over `external_order_number where order_source = 'preorder'`.
- Add indexes for active queue reads: `(status, order_source, release_at, created_at)` and preorder page reads: `(order_source, scheduled_for)`.

Extend `order_items` for import traceability and readiness control:

- `external_lineitem_name text`.
- `external_lineitem_options text`.
- `external_lineitem_raw jsonb`.
- `prep_required boolean not null default true`.

`prep_required = false` is used for prepacked merch and postcards so those items appear on the preorder IC page but do not block readiness.

Add `order_import_batches`:

- `id uuid primary key default gen_random_uuid()`.
- `source text not null`, initially `takeapp`.
- `filename text not null`.
- `imported_at timestamptz not null default now()`.
- `finalized_at timestamptz`.
- `row_count integer not null`.
- `order_count integer not null`.
- `summary jsonb not null`.

This table gives the import an audit trail and records finalization.

## CSV Normalization

The importer groups CSV rows by `Order number` and creates one order per TakeApp order group.

Order-level mapping:

- `Customer name` -> `orders.customer_name`.
- `Question 1` / column AP -> `orders.order_type`, normalized from `Dine-in/Takeaway: Dine-in` or `Dine-in/Takeaway: Takeaway` to `dine_in` or `takeaway`.
- `Payment Status` -> `orders.preorder_payment_status`.
- `Fulfillment Status` -> `orders.preorder_fulfillment_status`.
- `Service date` plus the start of `Service time` -> `orders.scheduled_for`.
- `release_at = scheduled_for - 30 minutes`.
- `prep_due_at = scheduled_for - 15 minutes`.
- `Latest payment method` is preserved in raw metadata. The app-level `payment_method` is set to `other` for PayNow imports.
- `staff_name = 'TakeApp Import'`.
- `external_raw` stores relevant order-level TakeApp fields for audit.

Item-level mapping:

- Regular drink rows map to existing product rows and options parsed from `Lineitem option`.
- `Drink Only` suffixes are stripped for product matching.
- `Make It A Set (...)` rows split into the drink plus the named bite, matching POS station behavior.
- `Bestie Set` rows split into drink 1, drink 2, and bite from `Lineitem option`, matching POS station behavior.
- Dine-in warmable food defaults to `warm_up`.
- Takeaway warmable food defaults to `no_warm_up`.
- Merch and postcards import as order items with `prep_required = false`.
- `external_lineitem_name`, `external_lineitem_options`, and `external_lineitem_raw` preserve source row data.

Pricing:

- Split set rows preserve the TakeApp row total by allocating the source row price proportionally across the exploded prep items, the same way current POS Bestie Set logic allocates a set price across sub-items.
- Order totals must match the sum of imported line totals.
- Dashboard revenue and receipts use the normalized order items but retain TakeApp traceability.

## Queue Visibility

`/api/live-orders` returns:

- all live POS orders.
- live preorder orders only when `release_at <= now()`.

Station pages continue using `/api/live-orders`, so unreleased preorders are hidden from stations without duplicating release logic in every station page.

The live-order and station cards should visibly identify released preorders with:

- `PREORDER`.
- `TakeApp #...`.
- pickup slot.
- payment status.
- dine-in/takeaway.

The card's primary prep items are the normalized station-visible items. Prepacked items should either be omitted from station views or shown only as non-blocking context if the page design has room. They must not appear as required station work.

## Preorder IC Page

Add a new route: `/preorders`.

The page polls `/api/preorders` and shows two views:

- **Now / Next Up:** released orders, overdue prep, ready-to-collect orders, and near-future slots.
- **Full Day:** all imported preorders grouped by pickup slot.

Cards show:

- `PREORDER`.
- TakeApp order number, for example `TakeApp #34`.
- native POS ticket number.
- customer name.
- dine-in/takeaway.
- pickup slot.
- payment status.
- prep due time.
- station readiness.
- prep-required items.
- prepacked merch/postcard items.

The preorder IC action is `Mark Collected`.

When clicked:

- set `orders.preorder_collected_at = now()`.
- complete the order through the same completion semantics used by normal served orders.
- remove it from live/station queues.
- keep it visible in receipts and dashboard as completed preorder revenue.

Readiness:

- Prep-required items block `Ready to Collect`.
- `prep_required = false` items do not block `Ready to Collect`.
- A preorder containing only prepacked merch/postcards can be ready to collect without station readiness.

## API Design

Update existing APIs:

- `/api/live-orders`: add source-aware release filtering and select preorder metadata fields.
- `/api/orders-history`: select preorder metadata so receipts/dashboard can display and filter by source.
- `/api/complete-order`: allow completing preorder orders and, when called by the preorder collection endpoint, set `preorder_collected_at`.
- `/api/mark-station-ready`: only marks `prep_required = true` items for station categories.

Add new APIs:

- `/api/preorders`: returns all live preorder orders for the preorder IC page, regardless of release time, ordered by `scheduled_for`.
- `/api/collect-preorder`: validates that the target order is a live preorder, sets `preorder_collected_at`, completes the order, and returns the updated record.

Import tooling:

- A local script imports the finalized CSV after the preorder window closes.
- The script first supports a preview mode that groups rows, normalizes items, detects unmapped products/options, and reports created/skipped/errors without writing.
- The final import writes one `order_import_batches` row and creates preorder orders/items.
- Duplicate TakeApp order numbers are refused after finalization.

## UI Design

Keep the existing Sachi Sips visual language:

- Pink `#E59090`, burgundy `#682837`, brown `#52301A`, green `#4D4823`, butter `#F0E4BF`, yellow `#FFE373`.
- `Pinyon Script` wordmark only.
- `Alice` headings.
- `Public Sans` UI/body text.
- Warm panels, soft borders, and existing card style.

Navigation adds a `Preorders` link near `Live Orders` because it is an operations page.

Station and live-order cards should keep their current structure but add small source metadata for released preorders. The preorder IC page can use denser grouped cards because that user needs scanning and reconciliation more than a station-style prep surface.

## Error Handling

Import preview must fail clearly on:

- unmapped product names.
- malformed service time.
- missing `Order number`.
- missing customer name.
- unsupported dine-in/takeaway value.
- item option formats that cannot be parsed.
- totals that do not reconcile after normalization.

Runtime APIs return normal JSON errors and should not partially complete collection. `collect-preorder` should be atomic: either `preorder_collected_at` and completion both happen, or neither does.

## Testing

Required checks before shipping:

- `npm run lint`.
- `npm run build`.
- `npm run test:contracts`.

Add contract assertions for:

- `/api/live-orders` filters unreleased preorder orders.
- `/api/live-orders` includes released preorder metadata.
- `mark_station_ready` only updates prep-required station items.
- preorder collection completes the order and sets `preorder_collected_at`.
- import normalization parses `Question 1` into `order_type`.
- import normalization splits `Bestie Set` and `Make It A Set` rows.
- import normalization marks merch/postcards as non-prep-required.

Manual smoke test after final CSV import:

1. Import finalized CSV in preview mode and confirm row/order counts.
2. Run final import.
3. Confirm `/preorders` shows the full day grouped by slot.
4. Before a release time, confirm stations do not show that preorder.
5. At or after `release_at`, confirm stations show only relevant prep items.
6. Mark stations ready and confirm preorder page shows ready to collect.
7. Mark collected on `/preorders`.
8. Confirm the order disappears from live/station queues and appears in receipts/dashboard as a completed preorder.

## Implementation Decisions

- The first importer is a local script under `scripts/`, not a browser upload UI.
- `/preorders` uses the approved information architecture above. Detailed visual polish happens during implementation while preserving the existing Sachi Sips brand system.
