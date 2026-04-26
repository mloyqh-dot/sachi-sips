import { createClient } from '@supabase/supabase-js';

type PaymentMethod = 'cash' | 'card' | 'other';
type OrderType = 'dine_in' | 'takeaway';
type MilkOption = 'dairy' | 'oat';
type SugarOption = 'no_sugar' | 'less_sweet' | 'normal' | 'more_sweet';

type OrderItemPayload = {
  product_id: string;
  name: string;
  quantity: number;
  unit_price: number;
  options?: {
    milk?: MilkOption;
    sugar?: SugarOption;
    warm_up?: 'warm_up' | 'no_warm_up';
  };
};

type CreateOrderRequest = {
  staffName?: string;
  customerName?: string;
  paymentMethod?: PaymentMethod;
  order_type?: OrderType;
  notes?: string;
  subtotal?: number;
  total?: number;
  items?: OrderItemPayload[];
};

type VercelRequest = {
  method?: string;
  body?: CreateOrderRequest;
};

type VercelResponse = {
  status: (code: number) => VercelResponse;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string | string[]) => void;
};

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type ProductRow = {
  id: string;
  name: string;
  is_available: boolean;
};

type CanonicalOrderItemPayload = {
  product_id: string;
  name: string;
  quantity: number;
  unit_price: number;
  options?: {
    milk?: MilkOption;
    sugar?: SugarOption;
    warm_up?: 'warm_up' | 'no_warm_up';
  };
};

function isPaymentMethod(value: unknown): value is PaymentMethod {
  return value === 'cash' || value === 'card' || value === 'other';
}

function isOrderType(value: unknown): value is OrderType {
  return value === 'dine_in' || value === 'takeaway';
}

function isValidItem(item: OrderItemPayload) {
  return Boolean(
    item.product_id &&
    item.name &&
    Number.isInteger(item.quantity) &&
    item.quantity > 0 &&
    typeof item.unit_price === 'number' &&
    item.unit_price >= 0
  );
}

function isMilkOption(value: unknown): value is MilkOption {
  return value === 'dairy' || value === 'oat';
}

function isSugarOption(value: unknown): value is SugarOption {
  return value === 'no_sugar' || value === 'less_sweet' || value === 'normal' || value === 'more_sweet';
}

function isWarmUpOption(value: unknown) {
  return value === 'warm_up' || value === 'no_warm_up';
}

function hasValidOptions(item: OrderItemPayload) {
  if (!item.options) return true;

  return (
    (item.options.milk === undefined || isMilkOption(item.options.milk)) &&
    (item.options.sugar === undefined || isSugarOption(item.options.sugar)) &&
    (item.options.warm_up === undefined || isWarmUpOption(item.options.warm_up))
  );
}

function roundCurrency(value: number) {
  return Number(value.toFixed(2));
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
  const staffName = body.staffName?.trim() ?? '';
  const customerName = body.customerName?.trim() ?? '';
  const notes = body.notes?.trim() ?? '';
  const items = body.items ?? [];
  const orderType = body.order_type ?? 'dine_in';

  if (!staffName) {
    res.status(400).json({ error: 'Staff name is required' });
    return;
  }

  if (!customerName) {
    res.status(400).json({ error: 'Customer name is required' });
    return;
  }

  if (!isPaymentMethod(body.paymentMethod)) {
    res.status(400).json({ error: 'Invalid payment method' });
    return;
  }

  if (!isOrderType(orderType)) {
    res.status(400).json({ error: 'Invalid order type' });
    return;
  }

  if (!Array.isArray(items) || items.length === 0 || !items.every(isValidItem) || !items.every(hasValidOptions)) {
    res.status(400).json({ error: 'At least one valid item is required' });
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
  const productIds = Array.from(new Set(items.map(item => item.product_id)));
  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('id, name, is_available')
    .in('id', productIds);

  if (productsError) {
    res.status(500).json({ error: productsError.message });
    return;
  }

  const productMap = new Map((products ?? []).map(product => [product.id, product as ProductRow]));
  const canonicalItems: CanonicalOrderItemPayload[] = [];

  for (const item of items) {
    const product = productMap.get(item.product_id);

    if (!product) {
      res.status(400).json({ error: `Product not found: ${item.product_id}` });
      return;
    }

    if (!product.is_available) {
      res.status(400).json({ error: `${product.name} is no longer available` });
      return;
    }

    canonicalItems.push({
      product_id: product.id,
      name: product.name,
      quantity: item.quantity,
      unit_price: roundCurrency(item.unit_price),
      options: item.options,
    });
  }

  const computedSubtotal = roundCurrency(
    canonicalItems.reduce((sum, item) => sum + item.unit_price * item.quantity, 0)
  );
  const submittedSubtotal = typeof body.subtotal === 'number' ? roundCurrency(body.subtotal) : computedSubtotal;
  const submittedTotal = typeof body.total === 'number' ? roundCurrency(body.total) : computedSubtotal;

  if (submittedSubtotal !== computedSubtotal || submittedTotal !== computedSubtotal) {
    res.status(400).json({ error: 'Order totals do not match item totals' });
    return;
  }

  const { data, error } = await supabase.rpc('create_order', {
    p_staff_name: staffName,
    p_customer_name: customerName,
    p_payment_method: body.paymentMethod,
    p_notes: notes || null,
    p_subtotal: computedSubtotal,
    p_total: computedSubtotal,
    p_items: canonicalItems,
    p_order_type: orderType,
  });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  const order = Array.isArray(data) ? data[0] : data;
  res.status(201).json({ order });
}
