import { createClient } from '@supabase/supabase-js';

type Station = 'hojicha' | 'coffee' | 'kitchen';

type MarkStationReadyRequest = {
  orderId?: string;
  station?: Station;
};

type VercelRequest = {
  method?: string;
  body?: MarkStationReadyRequest;
};

type VercelResponse = {
  status: (code: number) => VercelResponse;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string | string[]) => void;
};

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const STATION_CATEGORIES: Record<Station, string[]> = {
  hojicha: ['Matcha'],
  coffee: ['Filter Coffee'],
  kitchen: ['Bites', 'Bakes', 'Mocktail'],
};

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isStation(value: unknown): value is Station {
  return value === 'hojicha' || value === 'coffee' || value === 'kitchen';
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
  const station = req.body?.station;

  if (!isUuid(orderId) || !isStation(station)) {
    res.status(400).json({ error: 'A valid orderId and station are required' });
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
  const { data, error } = await supabase.rpc('mark_station_ready', {
    p_order_id: orderId,
    p_categories: STATION_CATEGORIES[station],
  });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.status(200).json({ updated: typeof data === 'number' ? data : 0 });
}
