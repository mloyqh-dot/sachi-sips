import { createClient } from '@supabase/supabase-js';

type MilkOption = 'dairy' | 'oat';
type SugarOption = 'no_sugar' | 'less_sweet' | 'normal' | 'more_sweet';
type WarmUpOption = 'warm_up' | 'no_warm_up';
type OrderType = 'dine_in' | 'takeaway';

type ProductOptions = {
  milk?: MilkOption;
  sugar?: SugarOption;
  warm_up?: WarmUpOption;
};

type EditOrderItemPayload = {
  id?: string;
  product_id?: string;
  quantity?: number;
  options?: ProductOptions | null;
};

type EditOrderItemsRequest = {
  orderId?: string;
  staffName?: string;
  orderType?: OrderType;
  total?: number;
  items?: EditOrderItemPayload[];
};

type VercelRequest = {
  method?: string;
  body?: EditOrderItemsRequest;
};

type VercelResponse = {
  status: (code: number) => VercelResponse;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string | string[]) => void;
};

type ProductRow = {
  id: string;
  name: string;
  price: number;
  category: string;
  is_available: boolean;
  stock_quantity: number | null;
};

type ExistingOrderRow = {
  id: string;
  ticket_number: string;
  status: string;
  order_type: OrderType;
  total: number;
  notes: string | null;
};

type ExistingOrderItemRow = {
  id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  options: ProductOptions | null;
  ready_at: string | null;
};

type CanonicalItem = {
  id?: string;
  product: ProductRow;
  quantity: number;
  options: ProductOptions | null;
  line_total: number;
};

type StockAdjustment = {
  product_id: string;
  delta: number;
};

type StockRpcClient = {
  rpc: (
    fn: 'apply_product_stock_adjustments',
    args: { p_adjustments: StockAdjustment[] }
  ) => Promise<{ error: { message: string } | null }>;
};

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SOLD_OUT_PRODUCT_NAMES = new Set([
  'Iced Matcha Latte',
  'Iced Strawberry Matcha Latte',
  'Iced Lychee Matcha Latte',
  'Momotarō - Hot',
  'Momotarō - Iced',
  'Tater Tots',
  'Iced Banana Hojicha Latte',
  'Mocktail Flight (Set of 3 mini drinks)',
]);

function roundCurrency(value: number) {
  return Number(value.toFixed(2));
}

function isMilkOption(value: unknown): value is MilkOption {
  return value === 'dairy' || value === 'oat';
}

function isSugarOption(value: unknown): value is SugarOption {
  return value === 'no_sugar' || value === 'less_sweet' || value === 'normal' || value === 'more_sweet';
}

function isWarmUpOption(value: unknown): value is WarmUpOption {
  return value === 'warm_up' || value === 'no_warm_up';
}

function isOrderType(value: unknown): value is OrderType {
  return value === 'dine_in' || value === 'takeaway';
}

function normalizeOptions(options: ProductOptions | null | undefined): ProductOptions | null {
  if (!options) return null;

  const normalized: ProductOptions = {};

  if (options.milk !== undefined) {
    if (!isMilkOption(options.milk)) throw new Error('Invalid milk option');
    normalized.milk = options.milk;
  }

  if (options.sugar !== undefined) {
    if (!isSugarOption(options.sugar)) throw new Error('Invalid sugar option');
    normalized.sugar = options.sugar;
  }

  if (options.warm_up !== undefined) {
    if (!isWarmUpOption(options.warm_up)) throw new Error('Invalid warm-up option');
    normalized.warm_up = options.warm_up;
  }

  return Object.keys(normalized).length > 0 ? normalized : null;
}

function optionsEqual(left: ProductOptions | null, right: ProductOptions | null) {
  return JSON.stringify(normalizeOptions(left)) === JSON.stringify(normalizeOptions(right));
}

function isSoldOutProduct(product: ProductRow) {
  return SOLD_OUT_PRODUCT_NAMES.has(product.name);
}

function isPrepRequired(product: ProductRow) {
  return product.category !== 'Merch';
}

function buildStockAdjustments(
  existingItems: ExistingOrderItemRow[],
  canonicalItems: CanonicalItem[],
  productMap: Map<string, ProductRow>
) {
  const existingQuantities = new Map<string, number>();
  const nextQuantities = new Map<string, number>();
  const productIds = new Set<string>();

  for (const item of existingItems) {
    productIds.add(item.product_id);
    existingQuantities.set(item.product_id, (existingQuantities.get(item.product_id) ?? 0) + item.quantity);
  }

  for (const item of canonicalItems) {
    productIds.add(item.product.id);
    nextQuantities.set(item.product.id, (nextQuantities.get(item.product.id) ?? 0) + item.quantity);
  }

  const stockAdjustments: StockAdjustment[] = [];

  for (const productId of productIds) {
    const product = productMap.get(productId);
    if (product?.stock_quantity === null || product?.stock_quantity === undefined) continue;

    const delta = (existingQuantities.get(productId) ?? 0) - (nextQuantities.get(productId) ?? 0);
    if (delta !== 0) stockAdjustments.push({ product_id: productId, delta });
  }

  return stockAdjustments;
}

async function applyStockAdjustments(
  supabase: unknown,
  stockAdjustments: StockAdjustment[]
) {
  if (stockAdjustments.length === 0) return null;

  return (supabase as StockRpcClient).rpc('apply_product_stock_adjustments', {
    p_adjustments: stockAdjustments,
  });
}

function reverseStockAdjustments(stockAdjustments: StockAdjustment[]) {
  return stockAdjustments.map(adjustment => ({
    product_id: adjustment.product_id,
    delta: -adjustment.delta,
  }));
}

function buildEditNote(staffName: string | undefined) {
  const editedAt = new Date().toLocaleString('en-SG', {
    timeZone: 'Asia/Singapore',
    hour: 'numeric',
    minute: '2-digit',
  });
  const actor = staffName?.trim() || 'FOH';

  return `Edited ${editedAt}: live order items updated by ${actor}.`;
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

  const body = req.body ?? {};
  const orderId = body.orderId?.trim();
  const items = body.items ?? [];
  const orderType = body.orderType;

  if (!orderId) {
    res.status(400).json({ error: 'Order id is required' });
    return;
  }

  if (!Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: 'At least one item is required' });
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('id, ticket_number, status, order_type, total, notes')
    .eq('id', orderId)
    .eq('status', 'live')
    .single();

  if (orderError || !order) {
    res.status(404).json({ error: 'Live order not found' });
    return;
  }

  if (orderType !== undefined && !isOrderType(orderType)) {
    res.status(400).json({ error: 'Order type must be dine_in or takeaway' });
    return;
  }

  const { data: existingItems, error: existingItemsError } = await supabase
    .from('order_items')
    .select('id, product_id, quantity, unit_price, options, ready_at')
    .eq('order_id', orderId);

  if (existingItemsError) {
    res.status(500).json({ error: existingItemsError.message });
    return;
  }

  if (items.some(item => !item.product_id)) {
    res.status(400).json({ error: 'Every item must include a product id' });
    return;
  }

  const productIds = Array.from(new Set([
    ...items.map(item => item.product_id),
    ...(existingItems ?? []).map(item => item.product_id),
  ])) as string[];

  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('id, name, price, category, is_available, stock_quantity')
    .in('id', productIds);

  if (productsError) {
    res.status(500).json({ error: productsError.message });
    return;
  }

  const productMap = new Map((products ?? []).map(product => [product.id, product as ProductRow]));
  const existingItemMap = new Map((existingItems ?? []).map(item => [item.id, item as ExistingOrderItemRow]));
  const seenExistingItemIds = new Set<string>();
  const canonicalItems: CanonicalItem[] = [];

  try {
    for (const item of items) {
      const product = item.product_id ? productMap.get(item.product_id) : null;

      if (!product) {
        res.status(400).json({ error: `Product not found: ${item.product_id}` });
        return;
      }

      if (!product.is_available || isSoldOutProduct(product)) {
        res.status(400).json({ error: `${product.name} is sold out or unavailable` });
        return;
      }

      if (!Number.isInteger(item.quantity) || !item.quantity || item.quantity <= 0) {
        res.status(400).json({ error: 'Item quantity must be a positive whole number' });
        return;
      }

      if (item.id) {
        if (seenExistingItemIds.has(item.id)) {
          res.status(400).json({ error: 'Duplicate order item id in edit payload' });
          return;
        }

        if (!existingItemMap.has(item.id)) {
          res.status(400).json({ error: 'Order item does not belong to this live order' });
          return;
        }

        seenExistingItemIds.add(item.id);
      }

      const unitPrice = roundCurrency(product.price);

      canonicalItems.push({
        id: item.id,
        product,
        quantity: item.quantity,
        options: normalizeOptions(item.options),
        line_total: roundCurrency(unitPrice * item.quantity),
      });
    }
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Invalid item options' });
    return;
  }

  const subtotal = roundCurrency(canonicalItems.reduce((sum, item) => sum + item.line_total, 0));
  const total = typeof body.total === 'number' ? roundCurrency(body.total) : roundCurrency((order as ExistingOrderRow).total);

  if (!Number.isFinite(total) || total < 0) {
    res.status(400).json({ error: 'Order total must be a non-negative amount' });
    return;
  }

  const idsToKeep = new Set(canonicalItems.map(item => item.id).filter(Boolean));
  const idsToDelete = [...existingItemMap.keys()].filter(id => !idsToKeep.has(id));
  const stockAdjustments = buildStockAdjustments((existingItems ?? []) as ExistingOrderItemRow[], canonicalItems, productMap);
  const stockResult = await applyStockAdjustments(supabase, stockAdjustments);

  if (stockResult?.error) {
    res.status(400).json({ error: stockResult.error.message });
    return;
  }

  if (idsToDelete.length > 0) {
    const { error: deleteError } = await supabase
      .from('order_items')
      .delete()
      .eq('order_id', orderId)
      .in('id', idsToDelete);

    if (deleteError) {
      await applyStockAdjustments(supabase, reverseStockAdjustments(stockAdjustments));
      res.status(500).json({ error: deleteError.message });
      return;
    }
  }

  for (const item of canonicalItems) {
    if (!item.id) continue;

    const existingItem = existingItemMap.get(item.id);
    const unitPrice = roundCurrency(item.product.price);
    const keepReadyAt = Boolean(
      existingItem &&
      existingItem.product_id === item.product.id &&
      existingItem.quantity === item.quantity &&
      roundCurrency(existingItem.unit_price) === unitPrice &&
      optionsEqual(existingItem.options, item.options)
    );
    const updatePayload: Record<string, unknown> = {
      product_id: item.product.id,
      name: item.product.name,
      quantity: item.quantity,
      unit_price: unitPrice,
      options: item.options,
      line_total: item.line_total,
      prep_required: isPrepRequired(item.product),
      ready_at: keepReadyAt ? existingItem?.ready_at ?? null : null,
    };

    if (existingItem?.product_id !== item.product.id) {
      updatePayload.external_lineitem_name = null;
      updatePayload.external_lineitem_options = null;
      updatePayload.external_lineitem_raw = null;
    }

    const { error: updateError } = await supabase
      .from('order_items')
      .update(updatePayload)
      .eq('order_id', orderId)
      .eq('id', item.id);

    if (updateError) {
      await applyStockAdjustments(supabase, reverseStockAdjustments(stockAdjustments));
      res.status(500).json({ error: updateError.message });
      return;
    }
  }

  const newItems = canonicalItems.filter(item => !item.id);

  if (newItems.length > 0) {
    const { error: insertError } = await supabase
      .from('order_items')
      .insert(newItems.map(item => ({
        order_id: orderId,
        product_id: item.product.id,
        name: item.product.name,
        quantity: item.quantity,
        unit_price: roundCurrency(item.product.price),
        options: item.options,
        line_total: item.line_total,
        prep_required: isPrepRequired(item.product),
        ready_at: null,
      })));

    if (insertError) {
      await applyStockAdjustments(supabase, reverseStockAdjustments(stockAdjustments));
      res.status(500).json({ error: insertError.message });
      return;
    }
  }

  const existingNotes = (order as ExistingOrderRow).notes?.trim();
  const nextNotes = [existingNotes, buildEditNote(body.staffName)].filter(Boolean).join('\n');
  const { error: orderUpdateError } = await supabase
    .from('orders')
    .update({
      order_type: orderType ?? (order as ExistingOrderRow).order_type,
      subtotal,
      total,
      notes: nextNotes,
    })
    .eq('id', orderId)
    .eq('status', 'live');

  if (orderUpdateError) {
    res.status(500).json({ error: orderUpdateError.message });
    return;
  }

  const { data: updatedOrder, error: fetchError } = await supabase
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
      external_order_key,
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
    .eq('id', orderId)
    .eq('status', 'live')
    .order('created_at', { foreignTable: 'order_items', ascending: true })
    .single();

  if (fetchError) {
    res.status(500).json({ error: fetchError.message });
    return;
  }

  res.status(200).json({ order: updatedOrder });
}
