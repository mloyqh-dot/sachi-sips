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

function isMissingDonationsTable(error: { code?: string; message?: string }) {
  return error.code === 'PGRST205' || error.message?.includes("table 'public.donations'");
}

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
    .from('donations')
    .select('id, created_at, amount, payment_method, staff_name, note')
    .order('created_at', { ascending: false });

  if (error) {
    if (isMissingDonationsTable(error)) {
      res.status(200).json({
        donations: [],
        warning: 'Donations table has not been migrated yet',
      });
      return;
    }

    res.status(500).json({ error: error.message });
    return;
  }

  res.status(200).json({ donations: data ?? [] });
}
