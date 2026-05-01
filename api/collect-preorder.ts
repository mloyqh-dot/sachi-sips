import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

type CollectPreorderRequest = {
  orderId?: string;
  order_id?: string;
  id?: string;
  ticketNumber?: string;
  ticket_number?: string;
  externalOrderNumber?: string;
  external_order_number?: string;
  externalOrderName?: string;
  external_order_name?: string;
};

type VercelRequest = {
  method?: string;
  body?: CollectPreorderRequest | string | Uint8Array;
  headers?: Record<string, string | string[] | undefined> | Headers;
  query?: Record<string, string | string[] | undefined>;
  url?: string;
};

type VercelResponse = {
  status: (code: number) => VercelResponse;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string | string[]) => void;
};

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i.test(value);
}

function normalizeLookupValue(value?: string) {
  return (value ?? '').trim();
}

function parseCollectPreorderJson(rawBody: string): CollectPreorderRequest {
  try {
    return JSON.parse(rawBody) as CollectPreorderRequest;
  } catch {
    return {};
  }
}

function parseCollectPreorderBody(body: VercelRequest['body']): CollectPreorderRequest {
  if (!body) return {};

  if (typeof body === 'string') {
    return parseCollectPreorderJson(body);
  }

  if (body instanceof Uint8Array) {
    return parseCollectPreorderJson(Buffer.from(body).toString('utf8'));
  }

  return body;
}

function firstQueryValue(value: string | string[] | null | undefined) {
  if (Array.isArray(value)) return value[0];
  return value ?? undefined;
}

function firstHeaderValue(
  headers: VercelRequest['headers'],
  headerName: string
) {
  if (headers && typeof (headers as Headers).get === 'function') {
    return (headers as Headers).get(headerName) ?? undefined;
  }

  const entry = Object.entries(headers ?? {}).find(([key]) => key.toLowerCase() === headerName);
  return firstQueryValue(entry?.[1]);
}

function parseCollectPreorderQuery(req: VercelRequest): CollectPreorderRequest {
  const params = new URLSearchParams(req.url?.split('?')[1] ?? '');

  return {
    orderId: firstQueryValue(req.query?.orderId) ?? params.get('orderId') ?? undefined,
    order_id: firstQueryValue(req.query?.order_id) ?? params.get('order_id') ?? undefined,
    id: firstQueryValue(req.query?.id) ?? params.get('id') ?? undefined,
    ticketNumber: firstQueryValue(req.query?.ticketNumber) ?? params.get('ticketNumber') ?? undefined,
    ticket_number: firstQueryValue(req.query?.ticket_number) ?? params.get('ticket_number') ?? undefined,
    externalOrderNumber: firstQueryValue(req.query?.externalOrderNumber) ?? params.get('externalOrderNumber') ?? undefined,
    external_order_number: firstQueryValue(req.query?.external_order_number) ?? params.get('external_order_number') ?? undefined,
    externalOrderName: firstQueryValue(req.query?.externalOrderName) ?? params.get('externalOrderName') ?? undefined,
    external_order_name: firstQueryValue(req.query?.external_order_name) ?? params.get('external_order_name') ?? undefined,
  };
}

function parseCollectPreorderHeaders(req: VercelRequest): CollectPreorderRequest {
  return {
    orderId: firstHeaderValue(req.headers, 'x-sachi-order-id'),
    ticketNumber: firstHeaderValue(req.headers, 'x-sachi-ticket-number'),
    externalOrderNumber: firstHeaderValue(req.headers, 'x-sachi-external-order-number'),
    externalOrderName: firstHeaderValue(req.headers, 'x-sachi-external-order-name'),
  };
}

async function findLivePreorderId(
  supabase: SupabaseClient,
  column: string,
  value: string
): Promise<string | null> {
  if (!value) return null;

  const { data, error } = await supabase
    .from('orders')
    .select('id')
    .eq('status', 'live')
    .eq('order_source', 'preorder')
    .eq(column, value)
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  return typeof data?.id === 'string' && isUuid(data.id) ? data.id : null;
}

async function resolveCollectPreorderId(
  supabase: SupabaseClient,
  body: CollectPreorderRequest
): Promise<string | null> {
  const suppliedOrderId = normalizeLookupValue(body.orderId ?? body.order_id ?? body.id);

  if (isUuid(suppliedOrderId)) return suppliedOrderId;

  const ticketNumber = normalizeLookupValue(body.ticketNumber ?? body.ticket_number);
  const externalOrderNumber = normalizeLookupValue(
    body.externalOrderNumber ?? body.external_order_number
  ).replace(/^#/, '');
  const externalOrderName = normalizeLookupValue(body.externalOrderName ?? body.external_order_name);

  const lookupAttempts: Array<[string, string]> = [
    ['ticket_number', suppliedOrderId],
    ['external_order_number', suppliedOrderId.replace(/^#/, '')],
    ['external_order_name', suppliedOrderId],
    ['ticket_number', ticketNumber],
    ['external_order_number', externalOrderNumber],
    ['external_order_name', externalOrderName],
    ['external_order_name', externalOrderNumber ? `#${externalOrderNumber}` : ''],
  ];

  for (const [column, value] of lookupAttempts) {
    const orderId = await findLivePreorderId(supabase, column, value);
    if (orderId) return orderId;
  }

  return null;
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

  const body = {
    ...parseCollectPreorderBody(req.body),
    ...parseCollectPreorderQuery(req),
    ...parseCollectPreorderHeaders(req),
  };
  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
  let orderId: string | null;

  try {
    orderId = await resolveCollectPreorderId(supabase, body);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unable to resolve preorder' });
    return;
  }

  if (!orderId) {
    res.status(400).json({ error: 'A valid orderId is required' });
    return;
  }

  const { data, error } = await supabase.rpc('collect_preorder', {
    p_order_id: orderId,
  });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  const order = Array.isArray(data) ? data[0] : data;

  if (!order) {
    res.status(409).json({ error: 'Preorder is no longer live or could not be found' });
    return;
  }

  res.status(200).json({ order });
}
