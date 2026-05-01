import { createClient } from '@supabase/supabase-js';

type ReceiptNotesRequest = {
  order_id?: string;
  notes?: string | null;
};

type VercelRequest = {
  method?: string;
  body?: ReceiptNotesRequest;
};

type VercelResponse = {
  status: (code: number) => VercelResponse;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string | string[]) => void;
};

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Allow', ['PATCH']);

  if (req.method !== 'PATCH') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    res.status(500).json({ error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' });
    return;
  }

  const body = req.body ?? {};
  const orderId = body.order_id?.trim() ?? '';
  const notes = body.notes?.trim() ?? '';

  if (!orderId) {
    res.status(400).json({ error: 'Order id is required' });
    return;
  }

  if (notes.length > 1000) {
    res.status(400).json({ error: 'Receipt note must be 1000 characters or fewer' });
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
  const { data, error } = await supabase
    .from('orders')
    .update({ notes: notes || null })
    .eq('id', orderId)
    .eq('status', 'completed')
    .select('id, notes')
    .single();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.status(200).json({ order: data });
}
