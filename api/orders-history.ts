import { createClient } from '@supabase/supabase-js';

type VercelRequest = {
  method?: string;
};

type VercelResponse = {
  status: (code: number) => VercelResponse;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string | string[]) => void;
};

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Allow', ['GET']);

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    res.status(500).json({ error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' });
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
  const { data, error } = await supabase
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
        ready_at
      )
    `)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .order('created_at', { foreignTable: 'order_items', ascending: true });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.status(200).json({ orders: data ?? [] });
}
