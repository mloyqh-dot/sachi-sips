import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { groupRowsByOrderNumber, normalizeTakeappRows, parseCsv } from './preorders/takeappNormalizer.mjs';

const args = new Map(process.argv.slice(2).map(arg => {
  const [key, ...rest] = arg.split('=');
  return [key, rest.join('=') || 'true'];
}));

const csvPath = args.get('--csv');
const mode = args.get('--mode') ?? 'preview';

if (!csvPath) {
  throw new Error('Usage: node scripts/import-takeapp-preorders.mjs --csv=path/to/file.csv --mode=preview|import');
}

if (!['preview', 'import'].includes(mode)) {
  throw new Error('--mode must be preview or import');
}

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing SUPABASE_URL/VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

const supabase = createClient(supabaseUrl, serviceRoleKey);
const csvText = readFileSync(csvPath, 'utf8');
const rows = parseCsv(csvText);
const groups = groupRowsByOrderNumber(rows);

const { data: products, error: productsError } = await supabase
  .from('products')
  .select('id, name, price, category, subcategory, sort_order, is_available');

if (productsError) throw new Error(productsError.message);

const normalized = normalizeTakeappRows(rows, products ?? []);
const preview = {
  mode,
  filename: basename(csvPath),
  rowCount: rows.length,
  groupedOrderCount: groups.length,
  normalizedOrderCount: normalized.orders.length,
  summary: normalized.summary,
};

console.log(JSON.stringify(preview, null, 2));

if (normalized.summary.errorCount > 0) {
  process.exitCode = 1;
  throw new Error('Import preview has blocking normalization errors.');
}

if (mode === 'preview') process.exit(0);

const externalKeys = normalized.orders.map(order => order.external_order_key);
const { data: existing, error: existingError } = await supabase
  .from('orders')
  .select('external_order_key, external_order_number')
  .eq('order_source', 'preorder')
  .in('external_order_key', externalKeys);

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
