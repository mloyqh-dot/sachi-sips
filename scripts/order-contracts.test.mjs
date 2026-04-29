import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const apiOrders = readFileSync(new URL('../api/orders.ts', import.meta.url), 'utf8');
const apiOrdersHistory = readFileSync(new URL('../api/orders-history.ts', import.meta.url), 'utf8');
const apiLiveOrders = readFileSync(new URL('../api/live-orders.ts', import.meta.url), 'utf8');
const apiPreorders = readFileSync(new URL('../api/preorders.ts', import.meta.url), 'utf8');
const apiCollectPreorder = readFileSync(new URL('../api/collect-preorder.ts', import.meta.url), 'utf8');
const apiDonations = readFileSync(new URL('../api/donations.ts', import.meta.url), 'utf8');
const apiDonationsHistory = readFileSync(new URL('../api/donations-history.ts', import.meta.url), 'utf8');
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
const preorderMigration = readFileSync(new URL('../supabase/migrations/015_add_preorder_workflow.sql', import.meta.url), 'utf8');
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

assert.match(
  apiOrders,
  /p_total:\s*submittedTotal/,
  'api/orders.ts should pass the submitted final total to the create_order RPC'
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
  takeappNormalizer,
  /Question 1|parseOrderType/,
  'TakeApp importer should parse column AP dine-in/takeaway into order_type'
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
  /Record Donation|createDonation|paymentMethod|staffName/,
  'DonationsPage should record custom-amount donations with payment method and staff attribution'
);

assert.match(
  dashboardPage,
  /fetchCompletedOrders/,
  'DashboardPage should load completed order history'
);

assert.match(
  dashboardPage,
  /fetchDonations|donationTotal|Combined Collected/,
  'DashboardPage should include donation totals separately from sales revenue'
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

assert.doesNotMatch(
  receiptsPage,
  /TODO: Display list of receipts/,
  'ReceiptsPage should not remain a stub'
);

for (const apiPath of ['/api/orders', '/api/orders-history', '/api/donations', '/api/donations-history', '/api/live-orders', '/api/preorders', '/api/complete-order', '/api/collect-preorder', '/api/mark-station-ready']) {
  assert.match(
    viteConfig,
    new RegExp(apiPath.replace(/\//g, '\\/')),
    `vite.config.ts should serve ${apiPath} during local Vite development`
  );
}
