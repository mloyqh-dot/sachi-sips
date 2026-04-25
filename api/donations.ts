import { createClient } from '@supabase/supabase-js';

type PaymentMethod = 'cash' | 'card' | 'other';

type CreateDonationRequest = {
  amount?: number;
  payment_method?: PaymentMethod;
  staff_name?: string;
  note?: string | null;
};

type VercelRequest = {
  method?: string;
  body?: CreateDonationRequest;
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
  const amount = typeof body.amount === 'number' ? roundCurrency(body.amount) : 0;
  const staffName = body.staff_name?.trim() ?? '';
  const note = body.note?.trim() ?? '';

  if (!Number.isFinite(amount) || amount <= 0) {
    res.status(400).json({ error: 'Donation amount must be greater than 0' });
    return;
  }

  if (!isPaymentMethod(body.payment_method)) {
    res.status(400).json({ error: 'Invalid payment method' });
    return;
  }

  if (!staffName) {
    res.status(400).json({ error: 'Staff name is required' });
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
  const { data, error } = await supabase
    .from('donations')
    .insert({
      amount,
      payment_method: body.payment_method,
      staff_name: staffName,
      note: note || null,
    })
    .select('id, created_at, amount, payment_method, staff_name, note')
    .single();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.status(201).json({ donation: data });
}
