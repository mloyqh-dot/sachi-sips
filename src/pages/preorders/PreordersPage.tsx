import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Order, OrderItem, OrderRecord } from '../../types';
import { formatOptions, getOrderTypeLabel, getPickupSlotLabel, getPreorderLabel } from '../../lib/orderFormatting';

const POLL_INTERVAL_MS = 5000;
const READY_GREEN = '#3a7d44';

function normalizeOrder(order: OrderRecord): Order {
  return {
    ...order,
    items: order.order_items ?? [],
  };
}

async function fetchPreorders() {
  const response = await fetch('/api/preorders');
  const result = await response.json().catch(() => null) as { error?: string; orders?: OrderRecord[] } | null;

  if (!response.ok) {
    throw new Error(result?.error || 'Unable to load preorders');
  }

  return (result?.orders ?? []).map(normalizeOrder);
}

async function collectPreorder(orderId: string) {
  const response = await fetch('/api/collect-preorder', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderId }),
  });
  const result = await response.json().catch(() => null) as { error?: string } | null;

  if (!response.ok) {
    throw new Error(result?.error || 'Unable to collect preorder');
  }
}

function getPrepItems(order: Order) {
  return order.items.filter(item => item.prep_required !== false);
}

function getPrepackedItems(order: Order) {
  return order.items.filter(item => item.prep_required === false);
}

function isReadyToCollect(order: Order) {
  const prepItems = getPrepItems(order);
  return prepItems.length === 0 || prepItems.every(item => item.ready_at !== null);
}

function isReleased(order: Order) {
  return Boolean(order.release_at && new Date(order.release_at).getTime() <= Date.now());
}

function isNearWindow(order: Order) {
  if (!order.release_at) return false;

  const releaseTime = new Date(order.release_at).getTime();
  const now = Date.now();
  return releaseTime > now && releaseTime <= now + 45 * 60 * 1000;
}

function getSlotKey(order: Order) {
  return order.scheduled_for ?? 'unscheduled';
}

function formatTime(value?: string | null) {
  if (!value) return 'Not scheduled';

  return new Date(value).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-SG', {
    style: 'currency',
    currency: 'SGD',
  }).format(Number(value));
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
    maxWidth: '700px',
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
  metrics: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(120px, 1fr))',
    gap: '0.65rem',
    minWidth: '360px',
  },
  metric: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.3rem',
    padding: '0.85rem 0.95rem',
    borderRadius: '18px',
    background: 'rgba(229, 144, 144, 0.12)',
    border: '1px solid rgba(229, 144, 144, 0.28)',
  },
  metricLabel: {
    fontFamily: "'Public Sans', sans-serif",
    fontSize: '10px',
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
    color: 'var(--color-brown)',
    opacity: 0.72,
  },
  metricValue: {
    fontFamily: "'Alice', serif",
    fontSize: '1.55rem',
    color: 'var(--color-burgundy)',
    lineHeight: 1,
  },
  section: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.8rem',
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: '1rem',
  },
  sectionTitle: {
    fontFamily: "'Alice', serif",
    fontSize: '1.45rem',
    color: 'var(--color-burgundy)',
    margin: 0,
  },
  sectionMeta: {
    fontFamily: "'Public Sans', sans-serif",
    fontSize: '12px',
    color: 'var(--color-brown)',
    opacity: 0.72,
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
  slotGroup: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.65rem',
    padding: '0.9rem',
    borderRadius: '20px',
    background: 'rgba(255, 250, 240, 0.52)',
    border: '1px solid rgba(104, 40, 55, 0.1)',
  },
  slotTitle: {
    fontFamily: "'Public Sans', sans-serif",
    fontSize: '12px',
    fontWeight: 800,
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
    color: 'var(--color-burgundy)',
  },
  card: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.9rem',
    padding: '1rem',
    borderRadius: '20px',
    background: 'rgba(255, 252, 246, 0.9)',
    border: '1px solid rgba(104, 40, 55, 0.14)',
    boxShadow: '0 10px 24px rgba(82, 48, 26, 0.07)',
  },
  readyCard: {
    background: 'linear-gradient(180deg, rgba(58, 125, 68, 0.12) 0%, rgba(255, 252, 246, 0.96) 100%)',
    border: '1px solid rgba(58, 125, 68, 0.34)',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '0.75rem',
    alignItems: 'flex-start',
  },
  identity: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.35rem',
  },
  badgeRow: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '0.45rem',
    alignItems: 'center',
  },
  badge: (tone: 'preorder' | 'ready' | 'neutral' | 'payment') => ({
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0.28rem 0.62rem',
    borderRadius: '999px',
    background: tone === 'ready'
      ? 'rgba(58, 125, 68, 0.14)'
      : tone === 'payment'
        ? 'rgba(255, 227, 115, 0.22)'
        : tone === 'preorder'
          ? 'rgba(229, 144, 144, 0.18)'
          : 'rgba(82, 48, 26, 0.07)',
    border: tone === 'ready'
      ? '1px solid rgba(58, 125, 68, 0.28)'
      : tone === 'payment'
        ? '1px solid rgba(210, 153, 45, 0.26)'
        : '1px solid rgba(104, 40, 55, 0.12)',
    color: tone === 'ready' ? READY_GREEN : 'var(--color-brown)',
    fontFamily: "'Public Sans', sans-serif",
    fontSize: '10px',
    fontWeight: 800,
    letterSpacing: '0.05em',
    textTransform: 'uppercase' as const,
  }),
  ticket: {
    fontFamily: "'Alice', serif",
    fontSize: '1.35rem',
    color: 'var(--color-burgundy)',
    lineHeight: 1.05,
  },
  customer: {
    fontFamily: "'Public Sans', sans-serif",
    fontSize: '1rem',
    fontWeight: 700,
    color: 'var(--color-brown)',
    lineHeight: 1.25,
  },
  meta: {
    fontFamily: "'Public Sans', sans-serif",
    fontSize: '12px',
    lineHeight: 1.45,
    color: 'var(--color-brown)',
    opacity: 0.78,
  },
  timeBlock: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.25rem',
    alignItems: 'flex-end',
    textAlign: 'right' as const,
    minWidth: '112px',
  },
  timeValue: {
    fontFamily: "'Alice', serif",
    fontSize: '1.35rem',
    color: 'var(--color-burgundy)',
    lineHeight: 1,
  },
  itemGroup: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.5rem',
  },
  groupLabel: {
    fontFamily: "'Public Sans', sans-serif",
    fontSize: '10px',
    fontWeight: 800,
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
    color: 'var(--color-brown)',
    opacity: 0.66,
  },
  itemRow: {
    display: 'grid',
    gridTemplateColumns: '42px minmax(0, 1fr)',
    gap: '0.6rem',
    alignItems: 'start',
    padding: '0.65rem 0.75rem',
    borderRadius: '14px',
    background: 'rgba(240, 228, 191, 0.32)',
    border: '1px solid rgba(104, 40, 55, 0.09)',
  },
  quantity: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '36px',
    borderRadius: '12px',
    background: 'rgba(104, 40, 55, 0.08)',
    color: 'var(--color-burgundy)',
    fontFamily: "'Public Sans', sans-serif",
    fontSize: '15px',
    fontWeight: 800,
  },
  itemText: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.25rem',
    minWidth: 0,
  },
  itemName: {
    fontFamily: "'Public Sans', sans-serif",
    fontSize: '13px',
    fontWeight: 700,
    color: 'var(--color-burgundy)',
    lineHeight: 1.35,
  },
  actionButton: (disabled: boolean) => ({
    border: 'none',
    borderRadius: '999px',
    padding: '0.8rem 1rem',
    background: disabled ? 'rgba(104, 40, 55, 0.2)' : 'var(--color-burgundy)',
    color: '#FFF9F2',
    fontFamily: "'Public Sans', sans-serif",
    fontSize: '13px',
    fontWeight: 800,
    cursor: disabled ? 'not-allowed' as const : 'pointer' as const,
    opacity: disabled ? 0.72 : 1,
  }),
  inlineError: {
    fontFamily: "'Public Sans', sans-serif",
    fontSize: '12px',
    color: '#8B0000',
  },
};

const PreorderCard: React.FC<{
  order: Order;
  collecting: boolean;
  error?: string;
  onCollect: (order: Order) => void;
}> = ({ order, collecting, error, onCollect }) => {
  const prepItems = getPrepItems(order);
  const prepackedItems = getPrepackedItems(order);
  const ready = isReadyToCollect(order);

  function renderItems(label: string, items: OrderItem[]) {
    if (items.length === 0) return null;

    return (
      <div style={s.itemGroup}>
        <span style={s.groupLabel}>{label}</span>
        {items.map(item => {
          const optionText = formatOptions(item.options);

          return (
            <div key={item.id} style={s.itemRow}>
              <span style={s.quantity}>x{item.quantity}</span>
              <div style={s.itemText}>
                <span style={s.itemName}>{item.name}</span>
                {optionText && <span style={s.meta}>{optionText}</span>}
                {item.ready_at && <span style={s.badge('ready')}>Ready</span>}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <article style={ready ? { ...s.card, ...s.readyCard } : s.card}>
      <div style={s.cardHeader}>
        <div style={s.identity}>
          <div style={s.badgeRow}>
            <span style={s.badge('preorder')}>Preorder</span>
            {ready && <span style={s.badge('ready')}>Ready to Collect</span>}
            <span style={s.badge('payment')}>{order.preorder_payment_status ?? 'Payment unknown'}</span>
          </div>
          <span style={s.ticket}>{getPreorderLabel(order)} / {order.ticket_number}</span>
          {order.customer_name && <span style={s.customer}>{order.customer_name}</span>}
          <span style={s.meta}>
            {getOrderTypeLabel(order.order_type)} | {formatCurrency(order.total)}
          </span>
        </div>
        <div style={s.timeBlock}>
          <span style={s.metricLabel}>Pickup</span>
          <span style={s.timeValue}>{formatTime(order.scheduled_for)}</span>
          <span style={s.meta}>Prep due {formatTime(order.prep_due_at)}</span>
          <span style={s.meta}>{isReleased(order) ? 'Released to stations' : `Releases ${formatTime(order.release_at)}`}</span>
        </div>
      </div>

      {renderItems('Prep Required', prepItems)}
      {renderItems('Prepacked', prepackedItems)}

      <button
        type="button"
        style={s.actionButton(!ready || collecting)}
        disabled={!ready || collecting}
        onClick={() => onCollect(order)}
      >
        {collecting ? 'Marking Collected...' : ready ? 'Mark Collected' : 'Waiting on stations'}
      </button>
      {error && <span style={s.inlineError}>{error}</span>}
    </article>
  );
};

const PreordersPage: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [collectingOrderIds, setCollectingOrderIds] = useState<Record<string, boolean>>({});
  const [orderErrors, setOrderErrors] = useState<Record<string, string>>({});
  const isFetchingRef = useRef(false);
  const hasResolvedInitialLoadRef = useRef(false);

  useEffect(() => {
    let active = true;

    async function loadOrders(isInitialLoad = false) {
      if (isFetchingRef.current) return;
      if (!isInitialLoad && typeof document !== 'undefined' && document.visibilityState !== 'visible') return;

      isFetchingRef.current = true;

      try {
        const normalized = await fetchPreorders();
        if (!active) return;

        setOrders(normalized);
        setError(null);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        if (active && (isInitialLoad || !hasResolvedInitialLoadRef.current)) {
          hasResolvedInitialLoadRef.current = true;
          setLoading(false);
        }

        isFetchingRef.current = false;
      }
    }

    void loadOrders(true);
    const intervalId = window.setInterval(() => {
      void loadOrders(false);
    }, POLL_INTERVAL_MS);

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        void loadOrders(false);
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      active = false;
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  async function handleCollect(order: Order) {
    if (collectingOrderIds[order.id] || !isReadyToCollect(order)) return;

    setOrderErrors(current => {
      if (!current[order.id]) return current;

      const next = { ...current };
      delete next[order.id];
      return next;
    });
    setCollectingOrderIds(current => ({ ...current, [order.id]: true }));

    try {
      await collectPreorder(order.id);
      setOrders(current => current.filter(entry => entry.id !== order.id));
    } catch (err) {
      setOrderErrors(current => ({
        ...current,
        [order.id]: err instanceof Error ? err.message : 'Unknown error',
      }));
    } finally {
      setCollectingOrderIds(current => {
        const next = { ...current };
        delete next[order.id];
        return next;
      });
    }
  }

  const readyCount = orders.filter(isReadyToCollect).length;
  const releasedCount = orders.filter(isReleased).length;
  const nextUpOrders = useMemo(
    () => orders.filter(order => isReleased(order) || isNearWindow(order)),
    [orders]
  );
  const groupedOrders = useMemo(() => {
    const groups = new Map<string, Order[]>();

    for (const order of orders) {
      const key = getSlotKey(order);
      groups.set(key, [...(groups.get(key) ?? []), order]);
    }

    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [orders]);

  return (
    <div style={s.page}>
      <div style={s.shell}>
        <section style={s.hero}>
          <div style={s.heroCopy}>
            <span style={s.eyebrow}>Preorder IC</span>
            <h1 style={s.title}>Preorders</h1>
            <p style={s.subtitle}>
              Track the whole TakeApp day, watch released windows, and mark collected once prep-required items are ready.
            </p>
          </div>
          <div style={s.metrics}>
            <div style={s.metric}>
              <span style={s.metricLabel}>Open</span>
              <span style={s.metricValue}>{orders.length}</span>
            </div>
            <div style={s.metric}>
              <span style={s.metricLabel}>Released</span>
              <span style={s.metricValue}>{releasedCount}</span>
            </div>
            <div style={s.metric}>
              <span style={s.metricLabel}>Ready</span>
              <span style={s.metricValue}>{readyCount}</span>
            </div>
          </div>
        </section>

        {loading && <div style={s.alert('info')}>Loading preorders...</div>}
        {!loading && error && <div style={s.alert('error')}>Unable to load preorders: {error}</div>}
        {!loading && !error && orders.length === 0 && (
          <div style={s.alert('info')}>No live preorders imported yet.</div>
        )}

        {!loading && !error && orders.length > 0 && (
          <>
            <section style={s.section}>
              <div style={s.sectionHeader}>
                <h2 style={s.sectionTitle}>Now / Next Up</h2>
                <span style={s.sectionMeta}>{nextUpOrders.length} orders released or releasing soon</span>
              </div>
              {nextUpOrders.length === 0 ? (
                <div style={s.alert('info')}>No preorder windows need attention yet.</div>
              ) : (
                <div style={s.grid}>
                  {nextUpOrders.map(order => (
                    <PreorderCard
                      key={order.id}
                      order={order}
                      collecting={Boolean(collectingOrderIds[order.id])}
                      error={orderErrors[order.id]}
                      onCollect={handleCollect}
                    />
                  ))}
                </div>
              )}
            </section>

            <section style={s.section}>
              <div style={s.sectionHeader}>
                <h2 style={s.sectionTitle}>Full Day</h2>
                <span style={s.sectionMeta}>Grouped by pickup slot</span>
              </div>
              <div style={s.grid}>
                {groupedOrders.map(([slot, slotOrders]) => (
                  <div key={slot} style={s.slotGroup}>
                    <span style={s.slotTitle}>
                      {getPickupSlotLabel(slotOrders[0]) ?? 'Unscheduled'} ({slotOrders.length})
                    </span>
                    {slotOrders.map(order => (
                      <PreorderCard
                        key={order.id}
                        order={order}
                        collecting={Boolean(collectingOrderIds[order.id])}
                        error={orderErrors[order.id]}
                        onCollect={handleCollect}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
};

export default PreordersPage;
