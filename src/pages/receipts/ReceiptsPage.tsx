import React, { useEffect, useMemo, useState } from 'react';
import type { Order, PaymentMethod } from '../../types';
import {
  fetchCompletedOrders,
  formatCurrency,
  formatDateTime,
  formatOrderType,
  formatPaymentMethod,
  formatOptions,
  getOrderItemCount,
  getOrderSearchText,
} from '../../lib/orderHistory';
import { getPickupSlotLabel, getPreorderLabel } from '../../lib/orderFormatting';

type PaymentFilter = 'all' | PaymentMethod;

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
    borderRadius: '22px',
    background: 'rgba(255, 250, 240, 0.72)',
    border: '1px solid rgba(104, 40, 55, 0.12)',
    boxShadow: '0 10px 24px rgba(82, 48, 26, 0.08)',
  },
  titleBlock: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.35rem',
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
    lineHeight: 1.55,
    color: 'var(--color-brown)',
    opacity: 0.82,
    margin: 0,
    maxWidth: '620px',
  },
  controls: {
    display: 'grid',
    gridTemplateColumns: 'minmax(220px, 1fr) minmax(140px, 180px)',
    gap: '0.75rem',
    alignItems: 'end',
  },
  field: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.3rem',
  },
  label: {
    fontFamily: "'Public Sans', sans-serif",
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
    color: 'var(--color-brown)',
    opacity: 0.72,
  },
  input: {
    width: '100%',
    minHeight: '38px',
    boxSizing: 'border-box' as const,
    borderRadius: '12px',
    border: '1px solid rgba(104, 40, 55, 0.18)',
    background: 'rgba(255, 255, 255, 0.68)',
    color: 'var(--color-burgundy)',
    fontFamily: "'Public Sans', sans-serif",
    fontSize: '13px',
    padding: '0.55rem 0.75rem',
  },
  layout: {
    display: 'grid',
    gridTemplateColumns: 'minmax(280px, 420px) minmax(320px, 1fr)',
    gap: '1rem',
    alignItems: 'start' as const,
  },
  list: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.55rem',
  },
  listButton: (active: boolean) => ({
    width: '100%',
    border: `1px solid ${active ? 'rgba(104, 40, 55, 0.34)' : 'rgba(104, 40, 55, 0.12)'}`,
    borderRadius: '16px',
    background: active ? 'rgba(229, 144, 144, 0.16)' : 'rgba(255, 252, 246, 0.82)',
    padding: '0.85rem',
    textAlign: 'left' as const,
    cursor: 'pointer',
    boxShadow: active ? '0 8px 18px rgba(229, 144, 144, 0.12)' : '0 6px 16px rgba(82, 48, 26, 0.06)',
  }),
  listTop: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '0.75rem',
    alignItems: 'baseline',
  },
  ticket: {
    fontFamily: "'Public Sans', sans-serif",
    fontSize: '13px',
    fontWeight: 800,
    color: 'var(--color-burgundy)',
  },
  total: {
    fontFamily: "'Public Sans', sans-serif",
    fontSize: '13px',
    fontWeight: 800,
    color: 'var(--color-pink)',
  },
  listMeta: {
    marginTop: '0.35rem',
    fontFamily: "'Public Sans', sans-serif",
    fontSize: '12px',
    lineHeight: 1.45,
    color: 'var(--color-brown)',
    opacity: 0.78,
  },
  receipt: {
    borderRadius: '22px',
    background: 'rgba(255, 252, 246, 0.9)',
    border: '1px solid rgba(104, 40, 55, 0.14)',
    boxShadow: '0 12px 30px rgba(82, 48, 26, 0.08)',
    overflow: 'hidden',
  },
  receiptHeader: {
    padding: '1rem 1.1rem',
    background: 'rgba(240, 228, 191, 0.64)',
    borderBottom: '1px solid rgba(104, 40, 55, 0.1)',
    display: 'flex',
    justifyContent: 'space-between',
    gap: '1rem',
    flexWrap: 'wrap' as const,
  },
  receiptTitle: {
    margin: 0,
    fontFamily: "'Alice', serif",
    fontSize: '1.5rem',
    color: 'var(--color-burgundy)',
  },
  receiptBody: {
    padding: '1rem 1.1rem',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '1rem',
  },
  metaGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: '0.65rem',
  },
  metaCell: {
    padding: '0.75rem',
    borderRadius: '14px',
    background: 'rgba(240, 228, 191, 0.34)',
    border: '1px solid rgba(104, 40, 55, 0.08)',
  },
  metaValue: {
    display: 'block',
    marginTop: '0.25rem',
    fontFamily: "'Public Sans', sans-serif",
    fontSize: '13px',
    fontWeight: 700,
    color: 'var(--color-burgundy)',
  },
  items: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.55rem',
  },
  itemRow: {
    display: 'grid',
    gridTemplateColumns: '44px minmax(0, 1fr) auto',
    gap: '0.75rem',
    alignItems: 'start',
    padding: '0.75rem 0',
    borderBottom: '1px solid rgba(104, 40, 55, 0.08)',
    fontFamily: "'Public Sans', sans-serif",
  },
  itemQty: {
    fontSize: '13px',
    fontWeight: 800,
    color: 'var(--color-burgundy)',
  },
  itemName: {
    fontSize: '13px',
    fontWeight: 700,
    color: 'var(--color-burgundy)',
  },
  itemMeta: {
    display: 'block',
    marginTop: '0.2rem',
    fontSize: '12px',
    color: 'var(--color-brown)',
    opacity: 0.76,
  },
  itemTotal: {
    fontSize: '13px',
    color: 'var(--color-brown)',
    fontWeight: 700,
  },
  totalRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    fontFamily: "'Public Sans', sans-serif",
    fontSize: '14px',
    color: 'var(--color-brown)',
  },
  grandTotal: {
    fontFamily: "'Alice', serif",
    fontSize: '1.6rem',
    color: 'var(--color-burgundy)',
  },
  alert: {
    padding: '0.875rem 1rem',
    borderRadius: '16px',
    border: '1px solid rgba(104, 40, 55, 0.14)',
    background: 'rgba(255, 255, 255, 0.66)',
    color: 'var(--color-brown)',
    fontFamily: "'Public Sans', sans-serif",
    fontSize: '14px',
  },
};

const ReceiptsPage: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>('all');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const completedOrders = await fetchCompletedOrders();

        if (!active) return;

        setOrders(completedOrders);
        setSelectedOrderId(completedOrders[0]?.id ?? null);
        setError(null);
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : 'Unknown error');
        }
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const filteredOrders = useMemo(() => {
    const query = search.trim().toLowerCase();

    return orders
      .filter(order => paymentFilter === 'all' || order.payment_method === paymentFilter)
      .filter(order => !query || getOrderSearchText(order).includes(query));
  }, [orders, paymentFilter, search]);

  const selectedOrder = filteredOrders.find(order => order.id === selectedOrderId) ?? filteredOrders[0] ?? null;

  return (
    <div style={s.page}>
      <div style={s.shell}>
        <section style={s.hero}>
          <div style={s.titleBlock}>
            <span style={s.eyebrow}>Order Archive</span>
            <h1 style={s.title}>Receipts</h1>
            <p style={s.subtitle}>
              Look up completed tickets and inspect the exact itemized receipt for reconciliation or customer follow-up.
            </p>
          </div>
          <div style={s.controls}>
            <label style={s.field}>
              <span style={s.label}>Search</span>
              <input
                style={s.input}
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="Ticket, customer, staff, item, notes"
              />
            </label>
            <label style={s.field}>
              <span style={s.label}>Payment</span>
              <select style={s.input} value={paymentFilter} onChange={event => setPaymentFilter(event.target.value as PaymentFilter)}>
                <option value="all">All payments</option>
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="other">Other</option>
              </select>
            </label>
          </div>
        </section>

        {loading && <div style={s.alert}>Loading receipts...</div>}
        {!loading && error && <div style={s.alert}>Unable to load receipts: {error}</div>}
        {!loading && !error && filteredOrders.length === 0 && <div style={s.alert}>No matching completed receipts found.</div>}

        {!loading && !error && filteredOrders.length > 0 && (
          <section style={s.layout}>
            <div style={s.list}>
              {filteredOrders.map(order => (
                <button
                  key={order.id}
                  type="button"
                  style={s.listButton(selectedOrder?.id === order.id)}
                  onClick={() => setSelectedOrderId(order.id)}
                >
                  <div style={s.listTop}>
                    <span style={s.ticket}>{order.ticket_number}</span>
                    <span style={s.total}>{formatCurrency(order.total)}</span>
                  </div>
                  {order.customer_name && (
                    <div style={s.listMeta}>Customer: {order.customer_name}</div>
                  )}
                  {order.order_source === 'preorder' && (
                    <div style={s.listMeta}>Preorder: {getPreorderLabel(order)}</div>
                  )}
                  <div style={s.listMeta}>
                    {formatDateTime(order.completed_at)} · {formatPaymentMethod(order.payment_method)} · {getOrderItemCount(order)} items
                  </div>
                </button>
              ))}
            </div>

            {selectedOrder && (
              <article style={s.receipt}>
                <header style={s.receiptHeader}>
                  <div>
                    <span style={s.eyebrow}>Sachi Sips</span>
                    <h2 style={s.receiptTitle}>{selectedOrder.ticket_number}</h2>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={s.label}>Total</span>
                    <span style={s.grandTotal}>{formatCurrency(selectedOrder.total)}</span>
                  </div>
                </header>
                <div style={s.receiptBody}>
                  <div style={s.metaGrid}>
                    <div style={s.metaCell}>
                      <span style={s.label}>Completed</span>
                      <span style={s.metaValue}>{formatDateTime(selectedOrder.completed_at)}</span>
                    </div>
                    <div style={s.metaCell}>
                      <span style={s.label}>Payment</span>
                      <span style={s.metaValue}>{formatPaymentMethod(selectedOrder.payment_method)}</span>
                    </div>
                    <div style={s.metaCell}>
                      <span style={s.label}>Order Type</span>
                      <span style={s.metaValue}>{formatOrderType(selectedOrder.order_type)}</span>
                    </div>
                    <div style={s.metaCell}>
                      <span style={s.label}>Customer</span>
                      <span style={s.metaValue}>{selectedOrder.customer_name || 'Not recorded'}</span>
                    </div>
                    <div style={s.metaCell}>
                      <span style={s.label}>Staff</span>
                      <span style={s.metaValue}>{selectedOrder.staff_name}</span>
                    </div>
                    {selectedOrder.order_source === 'preorder' && (
                      <div style={s.metaCell}>
                        <span style={s.label}>Preorder</span>
                        <span style={s.metaValue}>
                          {getPreorderLabel(selectedOrder)} | Pickup {getPickupSlotLabel(selectedOrder)} | {selectedOrder.preorder_payment_status ?? 'Payment unknown'}
                        </span>
                      </div>
                    )}
                  </div>

                  {selectedOrder.notes && (
                    <div style={s.metaCell}>
                      <span style={s.label}>Notes</span>
                      <span style={s.metaValue}>{selectedOrder.notes}</span>
                    </div>
                  )}

                  <div style={s.items}>
                    {selectedOrder.items.map(item => {
                      const optionText = formatOptions(item.options);

                      return (
                        <div key={item.id} style={s.itemRow}>
                          <span style={s.itemQty}>x{item.quantity}</span>
                          <span>
                            <span style={s.itemName}>{item.name}</span>
                            {optionText && <span style={s.itemMeta}>{optionText}</span>}
                            <span style={s.itemMeta}>{formatCurrency(item.unit_price)} each</span>
                          </span>
                          <span style={s.itemTotal}>{formatCurrency(item.line_total)}</span>
                        </div>
                      );
                    })}
                  </div>

                  <div>
                    <div style={s.totalRow}>
                      <span>Subtotal</span>
                      <span>{formatCurrency(selectedOrder.subtotal)}</span>
                    </div>
                    <div style={s.totalRow}>
                      <span>Total</span>
                      <span style={s.grandTotal}>{formatCurrency(selectedOrder.total)}</span>
                    </div>
                  </div>
                </div>
              </article>
            )}
          </section>
        )}
      </div>
    </div>
  );
};

export default ReceiptsPage;
