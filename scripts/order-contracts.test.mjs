import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const apiOrders = readFileSync(new URL('../api/orders.ts', import.meta.url), 'utf8');
const apiOrdersHistory = readFileSync(new URL('../api/orders-history.ts', import.meta.url), 'utf8');
const apiDonations = readFileSync(new URL('../api/donations.ts', import.meta.url), 'utf8');
const apiDonationsHistory = readFileSync(new URL('../api/donations-history.ts', import.meta.url), 'utf8');
const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
const posPage = readFileSync(new URL('../src/pages/pos/POSPage.tsx', import.meta.url), 'utf8');
const dashboardPage = readFileSync(new URL('../src/pages/dashboard/DashboardPage.tsx', import.meta.url), 'utf8');
const donationsPage = readFileSync(new URL('../src/pages/donations/DonationsPage.tsx', import.meta.url), 'utf8');
const receiptsPage = readFileSync(new URL('../src/pages/receipts/ReceiptsPage.tsx', import.meta.url), 'utf8');
const stationApi = readFileSync(new URL('../api/mark-station-ready.ts', import.meta.url), 'utf8');
const viteConfig = readFileSync(new URL('../vite.config.ts', import.meta.url), 'utf8');

assert.match(
  apiOrders,
  /unit_price:\s*roundCurrency\(item\.unit_price\)/,
  'api/orders.ts should preserve validated POS unit_price values instead of canonical product prices'
);

assert.doesNotMatch(
  posPage,
  /supabase\.rpc\('create_order'/,
  'POS order creation should not use the anon Supabase create_order RPC path locally'
);

for (const category of ['Filter Coffee', 'Mocktail', 'Bites', 'Bakes']) {
  assert.match(
    stationApi,
    new RegExp(category),
    `api/mark-station-ready.ts should use current menu category "${category}"`
  );
}

assert.doesNotMatch(
  stationApi,
  /'Coffee'|'Specials'|'Savory'|'Bakery'/,
  'api/mark-station-ready.ts should not use old menu category names'
);

assert.match(
  apiOrdersHistory,
  /\.eq\('status', 'completed'\)/,
  'api/orders-history.ts should query completed orders only for owner reporting'
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

for (const apiPath of ['/api/orders', '/api/orders-history', '/api/donations', '/api/donations-history', '/api/live-orders', '/api/complete-order', '/api/mark-station-ready']) {
  assert.match(
    viteConfig,
    new RegExp(apiPath.replace(/\//g, '\\/')),
    `vite.config.ts should serve ${apiPath} during local Vite development`
  );
}
