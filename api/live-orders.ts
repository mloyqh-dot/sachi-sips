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

function getProjectRef(url: string | undefined) {
  if (!url) return null;

  try {
    return new URL(url).hostname.split('.')[0] ?? null;
  } catch {
    return null;
  }
}

function decodeJwtPayload(token: string | undefined) {
  if (!token) return null;

  const segments = token.split('.');
  if (segments.length < 2) return null;

  try {
    const normalized = segments[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    return JSON.parse(Buffer.from(padded, 'base64').toString('utf8')) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Allow', ['GET']);

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    res.status(500).json({
      error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY',
      diagnostics: {
        hasSupabaseUrl: Boolean(supabaseUrl),
        hasServiceRoleKey: Boolean(supabaseServiceRoleKey),
        projectRef: getProjectRef(supabaseUrl),
      },
    });
    return;
  }

  const keyPayload = decodeJwtPayload(supabaseServiceRoleKey);
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
    .eq('status', 'live')
    .order('created_at', { ascending: true })
    .order('created_at', { foreignTable: 'order_items', ascending: true });

  if (error) {
    res.status(500).json({
      error: error.message,
      diagnostics: {
        projectRef: getProjectRef(supabaseUrl),
        jwtRole: typeof keyPayload?.role === 'string' ? keyPayload.role : null,
        jwtIss: typeof keyPayload?.iss === 'string' ? keyPayload.iss : null,
        hasServiceRoleKey: true,
        hint: error.hint ?? null,
        details: error.details ?? null,
        code: error.code ?? null,
      },
    });
    return;
  }

  res.status(200).json({ orders: data ?? [] });
}
