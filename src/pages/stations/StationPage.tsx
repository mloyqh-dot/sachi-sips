import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { getPickupSlotLabel, getPreorderLabel } from '../../lib/orderFormatting';
import type { Category, Order, OrderItem, OrderRecord, Product } from '../../types';

export interface StationPageProps {
  stationName: string;
  station: 'hojicha' | 'coffee' | 'kitchen' | 'merch';
  categories: Category[];
}

const POLL_INTERVAL_MS = 5000;
const READY_GREEN = '#3a7d44';

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

const WARM_UP_LABELS: Record<string, string> = {
  warm_up: 'Warm Up',
  no_warm_up: 'No Warm Up',
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
    options.warm_up ? WARM_UP_LABELS[options.warm_up] ?? options.warm_up : null,
  ].filter(Boolean);

  return labels.length > 0 ? labels.join(' / ') : null;
}

function normalizeOrder(order: OrderRecord): Order {
  return {
    ...order,
    items: order.order_items ?? [],
  };
}

function getOrderTypeLabel(orderType: Order['order_type']) {
  return orderType === 'takeaway' ? 'Takeaway' : 'Dine In';
}

function getOrderTypeBadgeStyle(orderType: Order['order_type']) {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0.28rem 0.7rem',
    borderRadius: '999px',
    background: orderType === 'takeaway' ? 'rgba(255, 227, 115, 0.24)' : 'rgba(214, 229, 240, 0.72)',
    border: orderType === 'takeaway' ? '1px solid rgba(210, 153, 45, 0.3)' : '1px solid rgba(101, 135, 160, 0.28)',
    fontFamily: "'Public Sans', sans-serif",
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '0.04em',
    color: '#52301A',
  } as const;
}

async function fetchLiveOrders() {
  const response = await fetch('/api/live-orders');
  const result = await response.json().catch(() => null) as { error?: string; orders?: OrderRecord[] } | null;

  if (!response.ok) {
    throw new Error(result?.error || 'Unable to load live orders');
  }

  return (result?.orders ?? []).map(normalizeOrder);
}

async function markStationReady(orderId: string, station: StationPageProps['station']) {
  const response = await fetch('/api/mark-station-ready', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ orderId, station }),
  });
  const result = await response.json().catch(() => null) as { error?: string; updated?: number } | null;

  if (!response.ok) {
    throw new Error(result?.error || 'Unable to update station readiness');
  }

  return result?.updated ?? 0;
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
  liveWrap: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.55rem',
    padding: '0.7rem 0.95rem',
    borderRadius: '999px',
    background: 'rgba(255, 255, 255, 0.68)',
    border: '1px solid rgba(104, 40, 55, 0.12)',
  },
  liveDot: {
    width: '10px',
    height: '10px',
    borderRadius: '999px',
    background: '#E59090',
    boxShadow: '0 0 0 5px rgba(229, 144, 144, 0.14)',
  },
  liveLabel: {
    fontFamily: "'Public Sans', sans-serif",
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
    color: 'var(--color-burgundy)',
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
  doneCard: {
    background: 'linear-gradient(180deg, rgba(58, 125, 68, 0.12) 0%, rgba(255, 252, 246, 0.96) 100%)',
    border: '1px solid rgba(58, 125, 68, 0.38)',
    boxShadow: '0 12px 30px rgba(58, 125, 68, 0.12)',
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
  ticketMetaRow: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    alignItems: 'center',
    gap: '0.5rem',
  },
  ticketNumber: {
    fontFamily: "'Alice', serif",
    fontSize: '1.55rem',
    lineHeight: 1.05,
    color: 'var(--color-burgundy)',
  },
  customerName: {
    fontFamily: "'Public Sans', sans-serif",
    fontSize: '1rem',
    fontWeight: 700,
    color: 'var(--color-brown)',
    lineHeight: 1.25,
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
  doneBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0.34rem 0.78rem',
    borderRadius: '999px',
    background: 'rgba(58, 125, 68, 0.14)',
    border: '1px solid rgba(58, 125, 68, 0.28)',
    fontFamily: "'Public Sans', sans-serif",
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '0.05em',
    textTransform: 'uppercase' as const,
    color: READY_GREEN,
  },
  preorderBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0.3rem 0.7rem',
    borderRadius: '999px',
    background: 'rgba(229, 144, 144, 0.18)',
    border: '1px solid rgba(229, 144, 144, 0.32)',
    fontFamily: "'Public Sans', sans-serif",
    fontSize: '11px',
    fontWeight: 800,
    letterSpacing: '0.05em',
    textTransform: 'uppercase' as const,
    color: 'var(--color-burgundy)',
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
  readyItemRow: {
    background: 'rgba(58, 125, 68, 0.08)',
    border: '1px solid rgba(58, 125, 68, 0.18)',
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
  itemReadyBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    width: 'fit-content',
    padding: '0.26rem 0.55rem',
    borderRadius: '999px',
    background: 'rgba(58, 125, 68, 0.12)',
    border: '1px solid rgba(58, 125, 68, 0.22)',
    color: READY_GREEN,
    fontFamily: "'Public Sans', sans-serif",
    fontSize: '10px',
    fontWeight: 700,
    letterSpacing: '0.04em',
    textTransform: 'uppercase' as const,
  },
  actions: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.5rem',
    paddingTop: '0.25rem',
  },
  actionButton: (disabled: boolean) => ({
    border: 'none',
    borderRadius: '999px',
    padding: '0.85rem 1rem',
    background: disabled ? 'rgba(104, 40, 55, 0.2)' : 'var(--color-burgundy)',
    color: '#FFF9F2',
    fontFamily: "'Public Sans', sans-serif",
    fontSize: '13px',
    fontWeight: 700,
    letterSpacing: '0.02em',
    cursor: disabled ? 'wait' as const : 'pointer' as const,
    opacity: disabled ? 0.7 : 1,
  }),
  doneState: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0.85rem 1rem',
    borderRadius: '999px',
    background: 'rgba(58, 125, 68, 0.14)',
    border: '1px solid rgba(58, 125, 68, 0.24)',
    color: READY_GREEN,
    fontFamily: "'Public Sans', sans-serif",
    fontSize: '13px',
    fontWeight: 700,
    letterSpacing: '0.03em',
    textTransform: 'uppercase' as const,
  },
  actionHint: {
    fontFamily: "'Public Sans', sans-serif",
    fontSize: '12px',
    lineHeight: 1.5,
    color: 'var(--color-brown)',
    opacity: 0.75,
  },
  inlineError: {
    fontFamily: "'Public Sans', sans-serif",
    fontSize: '12px',
    lineHeight: 1.5,
    color: '#8B0000',
  },
};

const StationPage: React.FC<StationPageProps> = ({ stationName, station, categories }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [markingOrderIds, setMarkingOrderIds] = useState<Record<string, boolean>>({});
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

  useEffect(() => {
    let active = true;

    (async () => {
      const { data } = await supabase
        .from('products')
        .select('id, name, price, category, subcategory, sort_order, is_available');

      if (!active) return;

      setProducts(data ?? []);
    })();

    return () => {
      active = false;
    };
  }, []);

  const productCategoryMap = new Map(products.map(product => [product.id, product.category]));

  const stationOrders = orders
    .map(order => ({
      ...order,
      items: order.items.filter(item => {
        if (item.prep_required === false) return false;

        const category = productCategoryMap.get(item.product_id);
        return category ? categories.includes(category) : false;
      }),
    }))
    .filter(order => order.items.length > 0);

  async function handleMarkReady(order: Order) {
    if (markingOrderIds[order.id]) return;

    setOrderErrors(current => {
      if (!current[order.id]) return current;

      const next = { ...current };
      delete next[order.id];
      return next;
    });
    setMarkingOrderIds(current => ({ ...current, [order.id]: true }));

    try {
      await markStationReady(order.id, station);
      const readyTimestamp = new Date().toISOString();

      setOrders(current =>
        current.map(entry => {
          if (entry.id !== order.id) return entry;

          return {
            ...entry,
            items: entry.items.map(item => {
              const category = productCategoryMap.get(item.product_id);

              if (item.prep_required === false || !category || !categories.includes(category)) {
                return item;
              }

              return {
                ...item,
                ready_at: item.ready_at ?? readyTimestamp,
              };
            }),
          };
        })
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setOrderErrors(current => ({ ...current, [order.id]: message }));
    } finally {
      setMarkingOrderIds(current => {
        const next = { ...current };
        delete next[order.id];
        return next;
      });
    }
  }

  return (
    <div style={s.page}>
      <div style={s.shell}>
        <section style={s.hero}>
          <div style={s.heroCopy}>
            <span style={s.eyebrow}>Station Queue</span>
            <h1 style={s.title}>{stationName}</h1>
            <p style={s.subtitle}>
              This queue shows only the items assigned to this station. Mark an order ready when all visible items for
              this station have been completed.
            </p>
          </div>
          <div style={s.liveWrap}>
            <span style={s.liveDot} />
            <span style={s.liveLabel}>Live Refresh</span>
          </div>
        </section>

        {loading && <div style={s.alert('info')}>Loading station orders...</div>}
        {!loading && error && <div style={s.alert('error')}>Unable to load station orders: {error}</div>}
        {!loading && !error && stationOrders.length === 0 && (
          <div style={s.alert('info')}>No matching live orders for this station right now.</div>
        )}

        {!loading && !error && stationOrders.length > 0 && (
          <section style={s.grid}>
            {stationOrders.map(order => {
              const isDone = order.items.every(item => item.ready_at !== null);

              return (
                <article key={order.id} style={isDone ? { ...s.card, ...s.doneCard } : s.card}>
                  <div style={s.cardHeader}>
                    <div style={s.ticketBlock}>
                      <span style={s.ticketLabel}>Order Number</span>
                      <div style={s.ticketMetaRow}>
                        <span style={s.ticketNumber}>{order.ticket_number}</span>
                        <span style={getOrderTypeBadgeStyle(order.order_type)}>{getOrderTypeLabel(order.order_type)}</span>
                        {order.order_source === 'preorder' && <span style={s.preorderBadge}>Preorder</span>}
                      </div>
                      {order.customer_name && (
                        <span style={s.customerName}>Customer: {order.customer_name}</span>
                      )}
                      {order.order_source === 'preorder' && (
                        <span style={s.itemMeta}>
                          {getPreorderLabel(order)} | Pickup {getPickupSlotLabel(order)} | {order.preorder_payment_status ?? 'Payment unknown'}
                        </span>
                      )}
                    </div>
                    <div style={s.metaBlock}>
                      {isDone && <span style={s.doneBadge}>Done</span>}
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
                      const isItemReady = item.ready_at !== null;

                      return (
                        <div key={item.id} style={isItemReady ? { ...s.itemRow, ...s.readyItemRow } : s.itemRow}>
                          <div style={s.quantityBox}>x{item.quantity}</div>
                          <div style={s.itemDetails}>
                            <span style={s.itemName}>{item.name}</span>
                            {optionText && <span style={s.itemMeta}>{optionText}</span>}
                            {isItemReady && <span style={s.itemReadyBadge}>Ready</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div style={s.actions}>
                    {isDone ? (
                      <span style={s.doneState}>Done</span>
                    ) : (
                      <button
                        type="button"
                        style={s.actionButton(Boolean(markingOrderIds[order.id]))}
                        disabled={Boolean(markingOrderIds[order.id])}
                        onClick={() => {
                          void handleMarkReady(order);
                        }}
                      >
                        {markingOrderIds[order.id] ? 'Updating...' : 'Ready'}
                      </button>
                    )}
                    <span style={s.actionHint}>Marks only this station&apos;s items as ready for the selected order.</span>
                    {orderErrors[order.id] && <span style={s.inlineError}>{orderErrors[order.id]}</span>}
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </div>
    </div>
  );
};

export default StationPage;
