import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { parseOrderType } from './preorders/takeappNormalizer.mjs';

const apiOrders = readFileSync(new URL('../api/orders.ts', import.meta.url), 'utf8');
const apiOrdersHistory = readFileSync(new URL('../api/orders-history.ts', import.meta.url), 'utf8');
const apiLiveOrders = readFileSync(new URL('../api/live-orders.ts', import.meta.url), 'utf8');
const apiPreorders = readFileSync(new URL('../api/preorders.ts', import.meta.url), 'utf8');
const apiCollectPreorder = readFileSync(new URL('../api/collect-preorder.ts', import.meta.url), 'utf8');
const apiDonations = readFileSync(new URL('../api/donations.ts', import.meta.url), 'utf8');
const apiDonationsHistory = readFileSync(new URL('../api/donations-history.ts', import.meta.url), 'utf8');
const apiReceiptNotes = readFileSync(new URL('../api/receipt-notes.ts', import.meta.url), 'utf8');
const apiEditOrderItems = readFileSync(new URL('../api/edit-order-items.ts', import.meta.url), 'utf8');
const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
const posPage = readFileSync(new URL('../src/pages/pos/POSPage.tsx', import.meta.url), 'utf8');
const dashboardPage = readFileSync(new URL('../src/pages/dashboard/DashboardPage.tsx', import.meta.url), 'utf8');
const liveOrdersPage = readFileSync(new URL('../src/pages/live-orders/LiveOrdersPage.tsx', import.meta.url), 'utf8');
const preorderPage = readFileSync(new URL('../src/pages/preorders/PreordersPage.tsx', import.meta.url), 'utf8');
const donationsPage = readFileSync(new URL('../src/pages/donations/DonationsPage.tsx', import.meta.url), 'utf8');
const receiptsPage = readFileSync(new URL('../src/pages/receipts/ReceiptsPage.tsx', import.meta.url), 'utf8');
const stationApi = readFileSync(new URL('../api/mark-station-ready.ts', import.meta.url), 'utf8');
const stationConstants = readFileSync(new URL('../src/lib/constants.ts', import.meta.url), 'utf8');
const stationPage = readFileSync(new URL('../src/pages/stations/StationPage.tsx', import.meta.url), 'utf8');
const customerNameMigration = readFileSync(new URL('../supabase/migrations/013_add_customer_name_to_orders.sql', import.meta.url), 'utf8');
const donationsMigration = readFileSync(new URL('../supabase/migrations/012_create_donations.sql', import.meta.url), 'utf8');
const preorderMigration = readFileSync(new URL('../supabase/migrations/015_add_preorder_workflow.sql', import.meta.url), 'utf8');
const snackStockMigration = readFileSync(new URL('../supabase/migrations/018_add_snack_stock_tracking.sql', import.meta.url), 'utf8');
const snackSoldOutMigration = readFileSync(new URL('../supabase/migrations/019_mark_spam_musubi_banana_hojicha_sold_out.sql', import.meta.url), 'utf8');
const mocktailSoldOutMigration = readFileSync(new URL('../supabase/migrations/020_mark_mocktails_sold_out.sql', import.meta.url), 'utf8');
const hojichaStockMigration = readFileSync(new URL('../supabase/migrations/021_set_hojicha_stock.sql', import.meta.url), 'utf8');
const taterTotsSoldOutMigration = readFileSync(new URL('../supabase/migrations/022_mark_tater_tots_sold_out.sql', import.meta.url), 'utf8');
const matchaSoldOutMigration = readFileSync(new URL('../supabase/migrations/023_mark_matcha_lattes_sold_out.sql', import.meta.url), 'utf8');
const momotaroStickerSoldOutMigration = readFileSync(new URL('../supabase/migrations/024_mark_momotaro_and_sticker_sheet_sold_out.sql', import.meta.url), 'utf8');
const takeappNormalizer = readFileSync(new URL('../scripts/preorders/takeappNormalizer.mjs', import.meta.url), 'utf8');
const viteConfig = readFileSync(new URL('../vite.config.ts', import.meta.url), 'utf8');

assert.match(
  apiOrders,
  /unit_price:\s*roundCurrency\(item\.unit_price\)/,
  'api/orders.ts should preserve validated POS unit_price values instead of canonical product prices'
);

assert.doesNotMatch(
  apiOrders,
  /submittedSubtotal !== computedSubtotal \|\| submittedTotal !== computedSubtotal/,
  'api/orders.ts should allow an edited final total while still validating item subtotal'
);

assert.doesNotMatch(
  customerNameMigration,
  /p_subtotal is distinct from computed_subtotal or p_total is distinct from computed_subtotal/,
  'create_order RPC should allow an edited final total while still validating item subtotal'
);

assert.match(
  customerNameMigration,
  /p_subtotal is distinct from computed_subtotal/,
  'create_order RPC should still validate submitted subtotal against item totals'
);

assert.match(
  customerNameMigration,
  /computed_subtotal,\s*p_total,/,
  'create_order RPC should store computed subtotal and submitted final total separately'
);

assert.match(
  apiOrders,
  /total:\s*submittedTotal/,
  'api/orders.ts should persist the submitted final total'
);

assert.doesNotMatch(
  apiOrders,
  /rpc\('create_order'/,
  'api/orders.ts should not depend on the create_order RPC for discounted totals'
);

assert.match(
  posPage,
  /finalTotal/,
  'POS cart should track an editable final total separate from the computed item subtotal'
);

assert.match(
  posPage,
  /p_subtotal:\s*orderSubtotal[\s\S]*p_total:\s*finalTotal/,
  'POS checkout should submit computed subtotal and editable final total separately'
);

assert.match(
  posPage,
  /useState<PaymentMethod>\('card'\)[\s\S]*setPaymentMethod\('card'\)/,
  'POS payment method should default and reset to card'
);

assert.match(
  posPage,
  /Classic Shio Pan[\s\S]*Scallion Cream Cheese Onion Shio Pan[\s\S]*isSoldOutProduct[\s\S]*disabled=\{soldOut\}[\s\S]*SOLD OUT/,
  'POS should keep both Shio Pan variants visible but marked sold out'
);

assert.match(
  snackStockMigration,
  /stock_quantity[\s\S]*Spam Musubi[\s\S]*11[\s\S]*Tater Tots[\s\S]*20[\s\S]*apply_product_stock_adjustments/,
  'snack stock migration should track remaining stock and seed current Spam Musubi/Tater Tots counts'
);

assert.match(
  snackSoldOutMigration,
  /stock_quantity\s*=\s*0[\s\S]*Spam Musubi[\s\S]*Iced Banana Hojicha Latte/,
  'sold-out migration should mark Spam Musubi and Banana Hojicha with zero stock'
);

assert.match(
  mocktailSoldOutMigration,
  /stock_quantity\s*=\s*0[\s\S]*category\s*=\s*'Mocktail'/,
  'mocktail sold-out migration should zero stock for the Mocktail category'
);

assert.match(
  hojichaStockMigration,
  /stock_quantity\s*=\s*8[\s\S]*Iced Hojicha Latte/,
  'hojicha stock migration should seed Iced Hojicha Latte at 8 remaining'
);

assert.match(
  taterTotsSoldOutMigration,
  /stock_quantity\s*=\s*0[\s\S]*Tater Tots/,
  'tater tots sold-out migration should zero stock for Tater Tots'
);

assert.match(
  matchaSoldOutMigration,
  /stock_quantity\s*=\s*0[\s\S]*subcategory\s*=\s*'Matcha Latte'/,
  'matcha sold-out migration should zero stock for Matcha Latte products without touching Hojicha Latte products'
);

assert.match(
  momotaroStickerSoldOutMigration,
  /stock_quantity\s*=\s*0[\s\S]*Momotarō - Hot[\s\S]*Momotarō - Iced[\s\S]*Sticker Sheet/,
  'Momotaro coffee and sticker sheet sold-out migration should zero their stock'
);

assert.match(
  apiOrders,
  /SOLD_OUT_PRODUCT_NAMES[\s\S]*Iced Matcha Latte[\s\S]*Iced Strawberry Matcha Latte[\s\S]*Iced Lychee Matcha Latte[\s\S]*Momotarō - Hot[\s\S]*Momotarō - Iced[\s\S]*Spam Musubi[\s\S]*Tater Tots[\s\S]*Iced Banana Hojicha Latte[\s\S]*Mocktail Flight \(Set of 3 mini drinks\)[\s\S]*Sticker Sheet[\s\S]*stock_quantity[\s\S]*apply_product_stock_adjustments[\s\S]*stockAdjustments/,
  'api/orders.ts should reject hard sold-out items and atomically consume tracked product stock during POS checkout'
);

assert.match(
  apiEditOrderItems,
  /stock_quantity[\s\S]*buildStockAdjustments[\s\S]*apply_product_stock_adjustments/,
  'api/edit-order-items.ts should apply live-order edit stock deltas'
);

assert.match(
  posPage,
  /stock_quantity[\s\S]*getAvailableStock[\s\S]*remainingStock[\s\S]*SOLD OUT/,
  'POS should show tracked snack stock and mark zero-stock snacks sold out'
);

assert.match(
  liveOrdersPage,
  /stock_quantity[\s\S]*getAvailableStock[\s\S]*remainingStock[\s\S]*SOLD OUT/,
  'Live order item edits should respect tracked snack stock in the picker'
);

assert.doesNotMatch(
  posPage,
  /supabase\.rpc\('create_order'/,
  'POS order creation should not use the anon Supabase create_order RPC path locally'
);

assert.match(
  posPage,
  /customerName|Customer name/,
  'POS checkout should collect and submit customer name for handoff'
);

assert.match(
  posPage,
  /pendingSetForProduct/,
  'POS "+ Set" flow should route customizable drinks through the customization modal before opening the bite picker'
);

assert.match(
  posPage,
  /banana hojicha/i,
  'POS customization should recognize Banana Hojicha as a special-case drink'
);

assert.match(
  posPage,
  /function requiresSugarOption\(product: Product\) \{\s*return requiresMilkOption\(product\) && !\/[^/]*banana hojicha/i,
  'POS customization should skip sugar selection for Banana Hojicha'
);

assert.match(
  posPage,
  /handlePickSetBite/,
  'Make-it-a-Set bite picker should gate dine-in warm-up before committing the bite'
);

assert.match(
  posPage,
  /handlePickBestieBite/,
  'Bestie Set bite picker should gate dine-in warm-up before completing the set'
);

assert.match(
  posPage,
  /bestieBiteWarmUpProduct/,
  'Bestie Set modal should render a warm-up sub-step driven by bestieBiteWarmUpProduct'
);

assert.match(
  apiOrders,
  /customerName|p_customer_name/,
  'api/orders.ts should require and submit customer name to the order RPC'
);

assert.match(
  apiLiveOrders,
  /customer_name/,
  'api/live-orders.ts should return customer_name for kitchen and station handoff'
);

assert.match(
  apiLiveOrders,
  /release_at\.lte|order_source\.eq\.preorder/,
  'api/live-orders.ts should hide unreleased preorders'
);

assert.match(
  apiLiveOrders,
  /order_source[\s\S]*external_order_number[\s\S]*scheduled_for/,
  'api/live-orders.ts should return preorder metadata'
);

assert.match(
  liveOrdersPage,
  /showPosOnly|visibleOrders|order_source !== 'preorder'/,
  'LiveOrdersPage should offer a view-only filter that hides preorders for FOH'
);

assert.match(
  apiPreorders,
  /\.eq\('order_source', 'preorder'\)/,
  'api/preorders.ts should return preorder orders only'
);

assert.match(
  apiCollectPreorder,
  /collect_preorder/,
  'api/collect-preorder.ts should use the preorder collection RPC'
);

assert.match(
  apiCollectPreorder,
  /parseCollectPreorderJson[\s\S]*JSON\.parse[\s\S]*parseCollectPreorderBody[\s\S]*order_id[\s\S]*A valid orderId is required/,
  'api/collect-preorder.ts should robustly parse preorder collection payloads before validating orderId'
);

assert.match(
  apiCollectPreorder,
  /resolveCollectPreorderId[\s\S]*ticketNumber[\s\S]*externalOrderNumber[\s\S]*externalOrderName[\s\S]*collect_preorder/,
  'api/collect-preorder.ts should resolve preorder collection by UUID or preorder identifiers'
);

assert.match(
  preorderPage,
  /getCollectableOrderId[\s\S]*order\.items\.find\(item => isUuid\(item\.order_id\)\)\?\.order_id[\s\S]*ticketNumber[\s\S]*externalOrderNumber[\s\S]*externalOrderName/,
  'PreordersPage should send UUID fallback and preorder identifiers when marking a preorder collected'
);

assert.match(
  preorderMigration,
  /oi\.prep_required = true/,
  'mark_station_ready should update prep-required items only'
);

assert.match(
  preorderMigration,
  /create or replace function collect_preorder/,
  'migration should define atomic preorder collection'
);

assert.match(
  preorderMigration,
  /drop function if exists complete_order\(uuid\);[\s\S]*create or replace function complete_order/,
  'preorder migration should drop complete_order before changing its return table'
);

assert.match(
  preorderMigration,
  /drop function if exists collect_preorder\(uuid\);[\s\S]*create or replace function collect_preorder/,
  'preorder migration should drop collect_preorder before creating it'
);

assert.match(
  takeappNormalizer,
  /Question 1|parseOrderType/,
  'TakeApp importer should parse column AP dine-in/takeaway into order_type'
);

assert.match(
  takeappNormalizer,
  /created_at:\s*releaseAt\.toISOString\(\)/,
  'TakeApp importer should use release_at as preorder created_at so station queues sort by release time'
);

assert.equal(
  parseOrderType('Dine-in/Takeaway: Dine-in'),
  'dine_in',
  'TakeApp importer should parse AP column Dine-in selections as dine_in'
);

assert.equal(
  parseOrderType('Dine-in/Takeaway: Takeaway'),
  'takeaway',
  'TakeApp importer should parse AP column Takeaway selections as takeaway'
);

assert.match(
  takeappNormalizer,
  /less sugar[\s\S]*less sweet[\s\S]*less_sweet/,
  'TakeApp importer should parse Less Sweet sugar customization labels'
);

assert.match(
  takeappNormalizer,
  /Bestie Set|Make It A Set|allocateSetPrice/,
  'TakeApp importer should split set rows and preserve price allocation'
);

assert.match(
  takeappNormalizer,
  /PREPACKED_CATEGORY[\s\S]*Merch[\s\S]*prep_required:\s*!isPrepacked\(product\)/,
  'TakeApp importer should mark merch and postcards as non-prep-required'
);

assert.match(
  preorderPage,
  /Mark Collected|collectPreorder|Ready to Collect/,
  'PreordersPage should support collection from the IC page'
);

assert.doesNotMatch(
  liveOrdersPage,
  /order\.items\.every\(item => item\.ready_at !== null\)/,
  'Live Orders ready-to-serve logic should not require non-station items such as merch to have ready_at'
);

assert.match(
  stationPage,
  /Customer:/,
  'Station pages should show customer name alongside ticket details'
);

assert.match(
  customerNameMigration,
  /drop function if exists create_order\(text, text, text, numeric, numeric, jsonb, text\)/,
  'Customer-name migration should drop the old create_order overload before installing the new RPC signature'
);

assert.match(
  customerNameMigration,
  /notify pgrst, 'reload schema'/,
  'Customer-name migration should refresh the PostgREST schema cache after changing the RPC signature'
);

assert.doesNotMatch(
  stationApi,
  /from\s+['"]\.\.\/src\/lib\/constants['"]/,
  'api/mark-station-ready.ts should not import frontend source modules that are absent from the Vercel function bundle'
);

for (const stationCategory of ['Matcha', 'Filter Coffee', 'Bites', 'Bakes', 'Mocktail']) {
  assert.match(
    stationApi,
    new RegExp(stationCategory),
    `api/mark-station-ready.ts should map station readiness category "${stationCategory}" locally`
  );
}

for (const category of ['Filter Coffee', 'Mocktail', 'Bites', 'Bakes', 'Matcha']) {
  assert.match(
    stationConstants,
    new RegExp(category),
    `src/lib/constants.ts should map current menu category "${category}" to a station`
  );
}

assert.doesNotMatch(
  stationConstants,
  /'Coffee'|'Specials'|'Savory'|'Bakery'/,
  'src/lib/constants.ts should not use old menu category names'
);

assert.match(
  apiOrdersHistory,
  /\.eq\('status', 'completed'\)/,
  'api/orders-history.ts should query completed orders only for owner reporting'
);

assert.match(
  apiOrdersHistory,
  /customer_name/,
  'api/orders-history.ts should return customer_name for receipt and dashboard lookup'
);

assert.match(
  apiDonations,
  /\.from\('donations'\)/,
  'api/donations.ts should create standalone donation records'
);

assert.match(
  donationsMigration,
  /donor_name/,
  'donations migration should track donor names'
);

assert.match(
  apiDonations,
  /donor_name/,
  'api/donations.ts should write donor_name'
);

assert.match(
  apiDonationsHistory,
  /donor_name/,
  'api/donations-history.ts should return donor_name'
);

assert.match(
  apiDonations,
  /amount\s*<=\s*0/,
  'api/donations.ts should reject non-positive donation amounts'
);

assert.match(
  apiDonationsHistory,
  /\.from\('donations'\)/,
  'api/donations-history.ts should read standalone donation records for dashboard reporting'
);

assert.match(
  app,
  /DonationsPage|\/donations/,
  'App should expose a standalone Donations page'
);

assert.match(
  app,
  /PreordersPage|\/preorders/,
  'App should expose the preorder IC page'
);

assert.match(
  donationsPage,
  /Record Donation|createDonation|paymentMethod|staffName|donorName/,
  'DonationsPage should record custom-amount donations with donor name, payment method, and staff attribution'
);

assert.match(
  posPage,
  /openDonationModal|submitDonation|createDonation/,
  'POSPage should expose a custom-amount donation flow backed by standalone donation records'
);

assert.match(
  dashboardPage,
  /fetchCompletedOrders/,
  'DashboardPage should load completed order history'
);

assert.match(
  dashboardPage,
  /fetchDonations|donationTotal|Combined Collected|donor_name/,
  'DashboardPage should include donation totals and donor names separately from sales revenue'
);

assert.match(
  dashboardPage,
  /sortConfig|filteredOrders|paymentFilter/,
  'DashboardPage should expose sortable and filterable order investigation'
);

assert.doesNotMatch(
  dashboardPage,
  /TODO: Show sales dashboard/,
  'DashboardPage should not remain a stub'
);

assert.match(
  receiptsPage,
  /fetchCompletedOrders/,
  'ReceiptsPage should load completed order history'
);

assert.match(
  apiReceiptNotes,
  /\.eq\('status', 'completed'\)/,
  'api/receipt-notes.ts should only update notes on completed receipt orders'
);

assert.match(
  apiReceiptNotes,
  /notes/,
  'api/receipt-notes.ts should update the orders.notes field'
);

assert.match(
  apiEditOrderItems,
  /\.eq\('status', 'live'\)[\s\S]*\.from\('order_items'\)[\s\S]*ready_at:\s*null[\s\S]*subtotal[\s\S]*notes/,
  'api/edit-order-items.ts should edit live order items, reset changed station readiness, and audit the order'
);

assert.match(
  apiEditOrderItems,
  /orderType[\s\S]*isOrderType[\s\S]*order_type:\s*orderType/,
  'api/edit-order-items.ts should allow FOH to edit a live order dine-in/takeaway value'
);

assert.match(
  receiptsPage,
  /noteDraft|saveReceiptNote|receipt-notes/,
  'ReceiptsPage should edit and save receipt notes for reconciliation'
);

assert.match(
  liveOrdersPage,
  /edit-order-items[\s\S]*setOrders[\s\S]*Edit Items/,
  'LiveOrdersPage should let FOH edit live order items and refresh station-backed order data'
);

assert.match(
  liveOrdersPage,
  /editOrderType[\s\S]*orderType:\s*editOrderType[\s\S]*Dine In[\s\S]*Takeaway/,
  'LiveOrdersPage should let FOH edit dine-in/takeaway on live orders'
);

assert.doesNotMatch(
  receiptsPage,
  /TODO: Display list of receipts/,
  'ReceiptsPage should not remain a stub'
);

for (const apiPath of ['/api/orders', '/api/orders-history', '/api/donations', '/api/donations-history', '/api/live-orders', '/api/preorders', '/api/complete-order', '/api/collect-preorder', '/api/mark-station-ready', '/api/receipt-notes', '/api/edit-order-items']) {
  assert.match(
    viteConfig,
    new RegExp(apiPath.replace(/\//g, '\\/')),
    `vite.config.ts should serve ${apiPath} during local Vite development`
  );
}
