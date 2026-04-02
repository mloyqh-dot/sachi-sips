import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { Order, OrderItem, OrderRecord } from '../../types';

const POLL_INTERVAL_MS = 5000;

const MILK_LABELS: Record<string, string> = {
  dairy: 'Dairy',
  oat: 'Oat',
};

const SUGAR_LABELS: Record<string, string> = {
  no_sugar: 'No Sugar',
  less_sweet: 'Less Sweet',
  normal: 'Normal Sugar',
  more_sweet: 'More Sweet',
};

function formatCreatedTime(value: string) {
  return new Date(value).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatCreatedDateTime(value: string) {
  return new Date(value).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatOptions(options: OrderItem['options']) {
  if (!options) return null;

  const labels = [
    options.milk ? MILK_LABELS[options.milk] ?? options.milk : null,
    options.sugar ? SUGAR_LABELS[options.sugar] ?? options.sugar : null,
  ].filter(Boolean);

  return labels.length > 0 ? labels.join(' · ') : null;
}

function normalizeOrder(order: OrderRecord): Order {
  return {
    ...order,
    items: order.order_items ?? [],
  };
}

async function fetchLiveOrders() {
  const isLocalDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

  if (!isLocalDev) {
    const response = await fetch('/api/live-orders');
    const result = await response.json().catch(() => null) as { error?: string; orders?: OrderRecord[] } | null;

    if (!response.ok) {
      throw new Error(result?.error || 'Unable to load live orders');
    }

    return (result?.orders ?? []).map(normalizeOrder);
  }

  const { data, error } = await supabase
    .from('orders')
    .select(`
      id,
      ticket_number,
      created_at,
      status,
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
        created_at
      )
    `)
    .eq('status', 'live')
    .order('created_at', { ascending: true })
    .order('created_at', { foreignTable: 'order_items', ascending: true });

  if (error) {
    throw new Error(error.message || 'Unable to load live orders');
  }

  return ((data ?? []) as OrderRecord[]).map(normalizeOrder);
}

const s = {
  page: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '1.25rem',
    background: 'linear-gradient(180deg, rgba(240, 228, 191, 0.72) 0%, rgba(250, 246, 235, 0.96) 100%)',
  },
  shell: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '1rem',
  },
  hero: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '1rem',
    padding: '1.1rem 1.2rem',
    borderRadius: '24px',
    background: 'rgba(255, 250, 240, 0.72)',
    border: '1px solid rgba(104, 40, 55, 0.12)',
    boxShadow: '0 10px 24px rgba(82, 48, 26, 0.08)',
  },
  heroCopy: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.35rem',
    maxWidth: '680px',
  },
  eyebrow: {
    fontFamily: "'Public Sans', sans-serif",
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '0.09em',
    textTransform: 'uppercase' as const,
    color: 'var(--color-pink)',
  },
  title: {
    fontFamily: "'Alice', serif",
    fontSize: '2rem',
    color: 'var(--color-burgundy)',
    lineHeight: 1.05,
    margin: 0,
  },
  subtitle: {
    fontFamily: "'Public Sans', sans-serif",
    fontSize: '14px',
    lineHeight: 1.6,
    color: 'var(--color-brown)',
    opacity: 0.82,
    margin: 0,
  },
  statusPanel: {
    minWidth: '180px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.5rem',
    padding: '0.95rem 1rem',
    borderRadius: '18px',
    background: 'rgba(229, 144, 144, 0.12)',
    border: '1px solid rgba(229, 144, 144, 0.28)',
  },
  statusLabel: {
    fontFamily: "'Public Sans', sans-serif",
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
    color: 'var(--color-brown)',
    opacity: 0.72,
  },
  statusValue: {
    fontFamily: "'Alice', serif",
    fontSize: '1.75rem',
    color: 'var(--color-burgundy)',
    lineHeight: 1,
  },
  statusNote: {
    fontFamily: "'Public Sans', sans-serif",
    fontSize: '12px',
    lineHeight: 1.5,
    color: 'var(--color-brown)',
    opacity: 0.74,
  },
  alert: (tone: 'error' | 'info') => ({
    padding: '0.875rem 1rem',
    borderRadius: '16px',
    border: `1px solid ${tone === 'error' ? 'rgba(139, 0, 0, 0.22)' : 'rgba(104, 40, 55, 0.14)'}`,
    background: tone === 'error' ? 'rgba(139, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.66)',
    color: tone === 'error' ? '#8B0000' : 'var(--color-brown)',
    fontFamily: "'Public Sans', sans-serif",
    fontSize: '14px',
    lineHeight: 1.55,
  }),
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: '1rem',
    alignItems: 'start' as const,
  },
  card: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '1rem',
    padding: '1rem',
    borderRadius: '22px',
    background: 'rgba(255, 252, 246, 0.88)',
    border: '1px solid rgba(104, 40, 55, 0.14)',
    boxShadow: '0 10px 28px rgba(82, 48, 26, 0.08)',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '0.75rem',
    alignItems: 'flex-start',
  },
  ticketBlock: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.35rem',
  },
  ticketLabel: {
    fontFamily: "'Public Sans', sans-serif",
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
    color: 'var(--color-pink)',
  },
  ticketNumber: {
    fontFamily: "'Alice', serif",
    fontSize: '1.55rem',
    lineHeight: 1.05,
    color: 'var(--color-burgundy)',
  },
  metaBlock: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'flex-end',
    gap: '0.35rem',
  },
  timeText: {
    fontFamily: "'Public Sans', sans-serif",
    fontSize: '13px',
    fontWeight: 600,
    color: 'var(--color-brown)',
  },
  subTimeText: {
    fontFamily: "'Public Sans', sans-serif",
    fontSize: '11px',
    color: 'var(--color-brown)',
    opacity: 0.72,
  },
  statusBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0.3rem 0.7rem',
    borderRadius: '999px',
    background: 'rgba(77, 72, 35, 0.1)',
    border: '1px solid rgba(77, 72, 35, 0.18)',
    fontFamily: "'Public Sans', sans-serif",
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase' as const,
    color: 'var(--color-green)',
  },
  notesBlock: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.35rem',
    padding: '0.85rem 0.95rem',
    borderRadius: '16px',
    background: 'rgba(255, 227, 115, 0.18)',
    border: '1px solid rgba(255, 227, 115, 0.34)',
  },
  sectionLabel: {
    fontFamily: "'Public Sans', sans-serif",
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
    color: 'var(--color-brown)',
    opacity: 0.7,
  },
  notesText: {
    fontFamily: "'Public Sans', sans-serif",
    fontSize: '13px',
    lineHeight: 1.55,
    color: 'var(--color-brown)',
  },
  itemsList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.75rem',
  },
  itemRow: {
    display: 'grid',
    gridTemplateColumns: '56px minmax(0, 1fr)',
    gap: '0.75rem',
    alignItems: 'start',
    padding: '0.85rem 0.9rem',
    borderRadius: '16px',
    background: 'rgba(240, 228, 191, 0.3)',
    border: '1px solid rgba(104, 40, 55, 0.1)',
  },
  quantityBox: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '44px',
    borderRadius: '14px',
    background: 'rgba(104, 40, 55, 0.08)',
    color: 'var(--color-burgundy)',
    fontFamily: "'Public Sans', sans-serif",
    fontSize: '18px',
    fontWeight: 700,
  },
  itemDetails: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.3rem',
    minWidth: 0,
  },
  itemName: {
    fontFamily: "'Public Sans', sans-serif",
    fontSize: '15px',
    fontWeight: 600,
    color: 'var(--color-burgundy)',
    lineHeight: 1.35,
  },
  itemMeta: {
    fontFamily: "'Public Sans', sans-serif",
    fontSize: '12px',
    lineHeight: 1.5,
    color: 'var(--color-brown)',
    opacity: 0.78,
  },
};

const LiveOrdersPage: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isFetchingRef = useRef(false);
  const hasResolvedInitialLoadRef = useRef(false);

  useEffect(() => {
    let active = true;

    async function loadOrders(isInitialLoad = false) {
      if (isFetchingRef.current) return;

      isFetchingRef.current = true;

      try {
        const normalized = await fetchLiveOrders();

        if (!active) return;

        setOrders(normalized);
        setError(null);
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : 'Unknown error');
        }
      } finally {
        if (active && (isInitialLoad || !hasResolvedInitialLoadRef.current)) {
          hasResolvedInitialLoadRef.current = true;
          setLoading(false);
        }

        isFetchingRef.current = false;
      }
    }

    loadOrders(true);
    const intervalId = window.setInterval(() => {
      void loadOrders(false);
    }, POLL_INTERVAL_MS);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, []);

  return (
    <div style={s.page}>
      <div style={s.shell}>
        <section style={s.hero}>
          <div style={s.heroCopy}>
            <span style={s.eyebrow}>Kitchen Queue</span>
            <h1 style={s.title}>Live Orders</h1>
            <p style={s.subtitle}>
              Active tickets are shown oldest first so the kitchen can work the queue in order.
              The queue refreshes automatically every 5 seconds so newly created orders appear without a manual reload.
            </p>
          </div>
          <div style={s.statusPanel}>
            <span style={s.statusLabel}>Open Tickets</span>
            <span style={s.statusValue}>{orders.length}</span>
            <span style={s.statusNote}>Display-only for now. Completion controls come in the next phase.</span>
          </div>
        </section>

        {loading && <div style={s.alert('info')}>Loading live orders…</div>}
        {!loading && error && <div style={s.alert('error')}>Unable to load live orders: {error}</div>}
        {!loading && !error && orders.length === 0 && (
          <div style={s.alert('info')}>No live orders right now. New tickets will appear here after refresh.</div>
        )}

        {!loading && !error && orders.length > 0 && (
          <section style={s.grid}>
            {orders.map(order => (
              <article key={order.id} style={s.card}>
                <div style={s.cardHeader}>
                  <div style={s.ticketBlock}>
                    <span style={s.ticketLabel}>Order Number</span>
                    <span style={s.ticketNumber}>{order.ticket_number}</span>
                  </div>
                  <div style={s.metaBlock}>
                    <span style={s.statusBadge}>{order.status}</span>
                    <span style={s.timeText}>{formatCreatedTime(order.created_at)}</span>
                    <span style={s.subTimeText}>{formatCreatedDateTime(order.created_at)}</span>
                  </div>
                </div>

                {order.notes && (
                  <div style={s.notesBlock}>
                    <span style={s.sectionLabel}>Notes</span>
                    <p style={s.notesText}>{order.notes}</p>
                  </div>
                )}

                <div style={s.itemsList}>
                  {order.items.map(item => {
                    const optionText = formatOptions(item.options);

                    return (
                      <div key={item.id} style={s.itemRow}>
                        <div style={s.quantityBox}>x{item.quantity}</div>
                        <div style={s.itemDetails}>
                          <span style={s.itemName}>{item.name}</span>
                          {optionText && <span style={s.itemMeta}>{optionText}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </article>
            ))}
          </section>
        )}
      </div>
    </div>
  );
};

export default LiveOrdersPage;
