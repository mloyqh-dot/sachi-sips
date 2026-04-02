import { createClient } from '@supabase/supabase-js';

type CompleteOrderRequest = {
  orderId?: string;
};

type VercelRequest = {
  method?: string;
  body?: CompleteOrderRequest;
};

type VercelResponse = {
  status: (code: number) => VercelResponse;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string | string[]) => void;
};

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
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

  const orderId = req.body?.orderId?.trim() ?? '';

  if (!isUuid(orderId)) {
    res.status(400).json({ error: 'A valid orderId is required' });
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
  const { data, error } = await supabase.rpc('complete_order', {
    p_order_id: orderId,
  });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  const order = Array.isArray(data) ? data[0] : data;

  if (!order) {
    res.status(409).json({ error: 'Order is no longer live or could not be found' });
    return;
  }

  res.status(200).json({ order });
}
