import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const apiOrders = readFileSync(new URL('../api/orders.ts', import.meta.url), 'utf8');
const posPage = readFileSync(new URL('../src/pages/pos/POSPage.tsx', import.meta.url), 'utf8');
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

for (const apiPath of ['/api/orders', '/api/live-orders', '/api/complete-order', '/api/mark-station-ready']) {
  assert.match(
    viteConfig,
    new RegExp(apiPath.replace(/\//g, '\\/')),
    `vite.config.ts should serve ${apiPath} during local Vite development`
  );
}
