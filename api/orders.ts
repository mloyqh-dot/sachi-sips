import { createClient } from '@supabase/supabase-js';

type PaymentMethod = 'cash' | 'card' | 'other';
type MilkOption = 'dairy' | 'oat';
type SugarOption = 'no_sugar' | 'less_sweet' | 'normal' | 'more_sweet';

type OrderItemPayload = {
  product_id: string;
  name: string;
  quantity: number;
  unit_price: number;
  options?: {
    milk: MilkOption;
    sugar: SugarOption;
  };
};

type CreateOrderRequest = {
  staffName?: string;
  paymentMethod?: PaymentMethod;
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

function isPaymentMethod(value: unknown): value is PaymentMethod {
  return value === 'cash' || value === 'card' || value === 'other';
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
  const notes = body.notes?.trim() ?? '';
  const items = body.items ?? [];

  if (!staffName) {
    res.status(400).json({ error: 'Staff name is required' });
    return;
  }

  if (!isPaymentMethod(body.paymentMethod)) {
    res.status(400).json({ error: 'Invalid payment method' });
    return;
  }

  if (!Array.isArray(items) || items.length === 0 || !items.every(isValidItem)) {
    res.status(400).json({ error: 'At least one valid item is required' });
    return;
  }

  const computedSubtotal = Number(
    items.reduce((sum, item) => sum + item.unit_price * item.quantity, 0).toFixed(2)
  );
  const submittedSubtotal = typeof body.subtotal === 'number' ? Number(body.subtotal.toFixed(2)) : computedSubtotal;
  const submittedTotal = typeof body.total === 'number' ? Number(body.total.toFixed(2)) : computedSubtotal;

  if (submittedSubtotal !== computedSubtotal || submittedTotal !== computedSubtotal) {
    res.status(400).json({ error: 'Order totals do not match item totals' });
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
  const { data, error } = await supabase.rpc('create_order', {
    p_staff_name: staffName,
    p_payment_method: body.paymentMethod,
    p_notes: notes || null,
    p_subtotal: computedSubtotal,
    p_total: computedSubtotal,
    p_items: items,
  });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  const order = Array.isArray(data) ? data[0] : data;
  res.status(201).json({ order });
}
