import React, { useEffect, useMemo, useState } from 'react';
import type { Donation, Order, OrderType, PaymentMethod } from '../../types';
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
import { fetchDonations } from '../../lib/donations';

type SortKey = 'completed_at' | 'ticket_number' | 'total' | 'payment_method' | 'staff_name' | 'item_count';
type SortDirection = 'asc' | 'desc';
type PaymentFilter = 'all' | PaymentMethod;
type OrderTypeFilter = 'all' | OrderType;

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
    maxWidth: '680px',
  },
  controls: {
    display: 'grid',
    gridTemplateColumns: 'minmax(220px, 1fr) repeat(2, minmax(150px, 190px))',
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
  metrics: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
    gap: '0.75rem',
  },
  metric: {
    padding: '0.95rem 1rem',
    borderRadius: '18px',
    background: 'rgba(255, 252, 246, 0.82)',
    border: '1px solid rgba(104, 40, 55, 0.12)',
    boxShadow: '0 8px 22px rgba(82, 48, 26, 0.07)',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.4rem',
  },
  metricValue: {
    fontFamily: "'Alice', serif",
    fontSize: '1.75rem',
    color: 'var(--color-burgundy)',
    lineHeight: 1,
  },
  metricNote: {
    fontFamily: "'Public Sans', sans-serif",
    fontSize: '12px',
    color: 'var(--color-brown)',
    opacity: 0.75,
  },
  sectionGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '1rem',
  },
  panel: {
    padding: '1rem',
    borderRadius: '20px',
    background: 'rgba(255, 252, 246, 0.82)',
    border: '1px solid rgba(104, 40, 55, 0.12)',
    boxShadow: '0 8px 22px rgba(82, 48, 26, 0.07)',
  },
  panelTitle: {
    margin: '0 0 0.75rem',
    fontFamily: "'Alice', serif",
    fontSize: '1.25rem',
    color: 'var(--color-burgundy)',
  },
  rankedList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.55rem',
  },
  rankedRow: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) auto',
    gap: '0.75rem',
    alignItems: 'baseline',
    fontFamily: "'Public Sans', sans-serif",
    fontSize: '13px',
    color: 'var(--color-brown)',
  },
  rankedName: {
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
    color: 'var(--color-burgundy)',
    fontWeight: 700,
  },
  ledgerRow: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.25rem',
    fontFamily: "'Public Sans', sans-serif",
    fontSize: '13px',
    color: 'var(--color-brown)',
  },
  ledgerTop: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '0.75rem',
    alignItems: 'baseline',
  },
  tableWrap: {
    overflowX: 'auto' as const,
    borderRadius: '18px',
    border: '1px solid rgba(104, 40, 55, 0.12)',
    background: 'rgba(255, 252, 246, 0.84)',
  },
  table: {
    width: '100%',
    minWidth: '900px',
    borderCollapse: 'collapse' as const,
    fontFamily: "'Public Sans', sans-serif",
  },
  th: {
    padding: '0.75rem',
    textAlign: 'left' as const,
    fontSize: '11px',
    letterSpacing: '0.07em',
    textTransform: 'uppercase' as const,
    color: 'var(--color-brown)',
    background: 'rgba(240, 228, 191, 0.62)',
    borderBottom: '1px solid rgba(104, 40, 55, 0.12)',
  },
  sortButton: {
    border: 'none',
    background: 'transparent',
    padding: 0,
    color: 'inherit',
    font: 'inherit',
    cursor: 'pointer',
  },
  td: {
    padding: '0.75rem',
    borderBottom: '1px solid rgba(104, 40, 55, 0.08)',
    fontSize: '13px',
    color: 'var(--color-brown)',
    verticalAlign: 'top' as const,
  },
  ticket: {
    fontWeight: 800,
    color: 'var(--color-burgundy)',
  },
  detail: {
    marginTop: '0.55rem',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.35rem',
  },
  itemLine: {
    fontSize: '12px',
    lineHeight: 1.45,
    color: 'var(--color-brown)',
    opacity: 0.82,
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

function getSortValue(order: Order, key: SortKey) {
  if (key === 'item_count') return getOrderItemCount(order);
  if (key === 'completed_at') return order.completed_at ? new Date(order.completed_at).getTime() : 0;
  return order[key];
}

const DashboardPage: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [donations, setDonations] = useState<Donation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>('all');
  const [orderTypeFilter, setOrderTypeFilter] = useState<OrderTypeFilter>('all');
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection }>({
    key: 'completed_at',
    direction: 'desc',
  });

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const [completedOrders, donationRecords] = await Promise.all([
          fetchCompletedOrders(),
          fetchDonations(),
        ]);

        if (!active) return;

        setOrders(completedOrders);
        setDonations(donationRecords);
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
      .filter(order => orderTypeFilter === 'all' || order.order_type === orderTypeFilter)
      .filter(order => !query || getOrderSearchText(order).includes(query))
      .toSorted((a, b) => {
        const aValue = getSortValue(a, sortConfig.key);
        const bValue = getSortValue(b, sortConfig.key);
        const direction = sortConfig.direction === 'asc' ? 1 : -1;

        if (typeof aValue === 'number' && typeof bValue === 'number') {
          return (aValue - bValue) * direction;
        }

        return String(aValue ?? '').localeCompare(String(bValue ?? '')) * direction;
      });
  }, [orderTypeFilter, orders, paymentFilter, search, sortConfig]);

  const metrics = useMemo(() => {
    const salesRevenue = filteredOrders.reduce((sum, order) => sum + Number(order.total), 0);
    const donationTotal = donations.reduce((sum, donation) => sum + Number(donation.amount), 0);
    const itemCount = filteredOrders.reduce((sum, order) => sum + getOrderItemCount(order), 0);
    const paymentTotals = new Map<PaymentMethod, number>();
    const donationPaymentTotals = new Map<PaymentMethod, number>();
    const itemTotals = new Map<string, { quantity: number; revenue: number }>();
    const staffTotals = new Map<string, { orders: number; revenue: number }>();
    const donationStaffTotals = new Map<string, { count: number; amount: number }>();

    filteredOrders.forEach(order => {
      paymentTotals.set(order.payment_method, (paymentTotals.get(order.payment_method) ?? 0) + Number(order.total));

      const staff = order.staff_name || 'Unknown';
      const staffValue = staffTotals.get(staff) ?? { orders: 0, revenue: 0 };
      staffTotals.set(staff, {
        orders: staffValue.orders + 1,
        revenue: staffValue.revenue + Number(order.total),
      });

      order.items.forEach(item => {
        const current = itemTotals.get(item.name) ?? { quantity: 0, revenue: 0 };
        itemTotals.set(item.name, {
          quantity: current.quantity + Number(item.quantity),
          revenue: current.revenue + Number(item.line_total),
        });
      });
    });

    donations.forEach(donation => {
      donationPaymentTotals.set(
        donation.payment_method,
        (donationPaymentTotals.get(donation.payment_method) ?? 0) + Number(donation.amount)
      );

      const staff = donation.staff_name || 'Unknown';
      const staffValue = donationStaffTotals.get(staff) ?? { count: 0, amount: 0 };
      donationStaffTotals.set(staff, {
        count: staffValue.count + 1,
        amount: staffValue.amount + Number(donation.amount),
      });
    });

    return {
      salesRevenue,
      donationTotal,
      combinedCollected: salesRevenue + donationTotal,
      itemCount,
      averageTicket: filteredOrders.length > 0 ? salesRevenue / filteredOrders.length : 0,
      paymentTotals: Array.from(paymentTotals.entries()).toSorted((a, b) => b[1] - a[1]),
      topItems: Array.from(itemTotals.entries()).toSorted((a, b) => b[1].quantity - a[1].quantity).slice(0, 6),
      staffTotals: Array.from(staffTotals.entries()).toSorted((a, b) => b[1].revenue - a[1].revenue).slice(0, 6),
      donationPaymentTotals: Array.from(donationPaymentTotals.entries()).toSorted((a, b) => b[1] - a[1]),
      donationStaffTotals: Array.from(donationStaffTotals.entries()).toSorted((a, b) => b[1].amount - a[1].amount).slice(0, 6),
      recentDonations: donations.slice(0, 8),
    };
  }, [donations, filteredOrders]);

  function toggleSort(key: SortKey) {
    setSortConfig(current => ({
      key,
      direction: current.key === key && current.direction === 'desc' ? 'asc' : 'desc',
    }));
  }

  function sortLabel(key: SortKey) {
    if (sortConfig.key !== key) return '';
    return sortConfig.direction === 'asc' ? ' ↑' : ' ↓';
  }

  const hasActivity = orders.length > 0 || donations.length > 0;

  return (
    <div style={s.page}>
      <div style={s.shell}>
        <section style={s.hero}>
          <div style={s.titleBlock}>
            <span style={s.eyebrow}>Owner Review</span>
            <h1 style={s.title}>Dashboard</h1>
            <p style={s.subtitle}>
              Completed orders only, tuned for post-event sales review, reconciliation, and planning what to prep next time.
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
            <label style={s.field}>
              <span style={s.label}>Order Type</span>
              <select style={s.input} value={orderTypeFilter} onChange={event => setOrderTypeFilter(event.target.value as OrderTypeFilter)}>
                <option value="all">All types</option>
                <option value="dine_in">Dine In</option>
                <option value="takeaway">Takeaway</option>
              </select>
            </label>
          </div>
        </section>

        {loading && <div style={s.alert}>Loading completed orders and donations...</div>}
        {!loading && error && <div style={s.alert}>Unable to load dashboard: {error}</div>}
        {!loading && !error && !hasActivity && <div style={s.alert}>No completed orders or donations found yet.</div>}

        {!loading && !error && hasActivity && (
          <>
            <section style={s.metrics}>
              <div style={s.metric}>
                <span style={s.label}>Sales Revenue</span>
                <span style={s.metricValue}>{formatCurrency(metrics.salesRevenue)}</span>
                <span style={s.metricNote}>{filteredOrders.length} completed orders in view</span>
              </div>
              <div style={s.metric}>
                <span style={s.label}>Donation Total</span>
                <span style={s.metricValue}>{formatCurrency(metrics.donationTotal)}</span>
                <span style={s.metricNote}>{donations.length} standalone donations</span>
              </div>
              <div style={s.metric}>
                <span style={s.label}>Combined Collected</span>
                <span style={s.metricValue}>{formatCurrency(metrics.combinedCollected)}</span>
                <span style={s.metricNote}>Sales plus donations, kept separate below</span>
              </div>
              <div style={s.metric}>
                <span style={s.label}>Average Ticket</span>
                <span style={s.metricValue}>{formatCurrency(metrics.averageTicket)}</span>
                <span style={s.metricNote}>Based on filtered completed orders</span>
              </div>
              <div style={s.metric}>
                <span style={s.label}>Items Sold</span>
                <span style={s.metricValue}>{metrics.itemCount}</span>
                <span style={s.metricNote}>Quantities across all order lines</span>
              </div>
              <div style={s.metric}>
                <span style={s.label}>Largest Order</span>
                <span style={s.metricValue}>{formatCurrency(Math.max(...filteredOrders.map(order => Number(order.total)), 0))}</span>
                <span style={s.metricNote}>Highest ticket in current view</span>
              </div>
            </section>

            <section style={s.sectionGrid}>
              <div style={s.panel}>
                <h2 style={s.panelTitle}>Top Items</h2>
                <div style={s.rankedList}>
                  {metrics.topItems.length > 0 ? metrics.topItems.map(([name, value]) => (
                    <div key={name} style={s.rankedRow}>
                      <span style={s.rankedName}>{name}</span>
                      <span>{value.quantity} sold · {formatCurrency(value.revenue)}</span>
                    </div>
                  )) : <span style={s.itemLine}>No completed order items in view.</span>}
                </div>
              </div>
              <div style={s.panel}>
                <h2 style={s.panelTitle}>Payment Mix</h2>
                <div style={s.rankedList}>
                  {metrics.paymentTotals.length > 0 ? metrics.paymentTotals.map(([method, total]) => (
                    <div key={method} style={s.rankedRow}>
                      <span style={s.rankedName}>{formatPaymentMethod(method)}</span>
                      <span>{formatCurrency(total)}</span>
                    </div>
                  )) : <span style={s.itemLine}>No completed order payments in view.</span>}
                </div>
              </div>
              <div style={s.panel}>
                <h2 style={s.panelTitle}>Staff Totals</h2>
                <div style={s.rankedList}>
                  {metrics.staffTotals.length > 0 ? metrics.staffTotals.map(([staff, value]) => (
                    <div key={staff} style={s.rankedRow}>
                      <span style={s.rankedName}>{staff}</span>
                      <span>{value.orders} orders · {formatCurrency(value.revenue)}</span>
                    </div>
                  )) : <span style={s.itemLine}>No completed order staff totals in view.</span>}
                </div>
              </div>
            </section>

            <section style={s.sectionGrid}>
              <div style={s.panel}>
                <h2 style={s.panelTitle}>Donation Payment Mix</h2>
                <div style={s.rankedList}>
                  {metrics.donationPaymentTotals.length > 0 ? metrics.donationPaymentTotals.map(([method, total]) => (
                    <div key={method} style={s.rankedRow}>
                      <span style={s.rankedName}>{formatPaymentMethod(method)}</span>
                      <span>{formatCurrency(total)}</span>
                    </div>
                  )) : <span style={s.itemLine}>No donations recorded yet.</span>}
                </div>
              </div>
              <div style={s.panel}>
                <h2 style={s.panelTitle}>Donation Staff Totals</h2>
                <div style={s.rankedList}>
                  {metrics.donationStaffTotals.length > 0 ? metrics.donationStaffTotals.map(([staff, value]) => (
                    <div key={staff} style={s.rankedRow}>
                      <span style={s.rankedName}>{staff}</span>
                      <span>{value.count} donations · {formatCurrency(value.amount)}</span>
                    </div>
                  )) : <span style={s.itemLine}>No donation staff totals yet.</span>}
                </div>
              </div>
              <div style={s.panel}>
                <h2 style={s.panelTitle}>Donation Ledger</h2>
                <div style={s.rankedList}>
                  {metrics.recentDonations.length > 0 ? metrics.recentDonations.map(donation => (
                    <div key={donation.id} style={s.ledgerRow}>
                      <span style={s.ledgerTop}>
                        <span style={s.rankedName}>{formatDateTime(donation.created_at)}</span>
                        <span>{formatCurrency(Number(donation.amount))} · {formatPaymentMethod(donation.payment_method)}</span>
                      </span>
                      <span style={s.itemLine}>{donation.staff_name}{donation.note ? ` · ${donation.note}` : ''}</span>
                    </div>
                  )) : <span style={s.itemLine}>No recent donations yet.</span>}
                </div>
              </div>
            </section>

            {filteredOrders.length > 0 ? (
              <section style={s.tableWrap}>
                <table style={s.table}>
                  <thead>
                    <tr>
                      <th style={s.th}><button type="button" style={s.sortButton} onClick={() => toggleSort('ticket_number')}>Ticket{sortLabel('ticket_number')}</button></th>
                      <th style={s.th}><button type="button" style={s.sortButton} onClick={() => toggleSort('completed_at')}>Completed{sortLabel('completed_at')}</button></th>
                      <th style={s.th}><button type="button" style={s.sortButton} onClick={() => toggleSort('total')}>Total{sortLabel('total')}</button></th>
                      <th style={s.th}><button type="button" style={s.sortButton} onClick={() => toggleSort('payment_method')}>Payment{sortLabel('payment_method')}</button></th>
                      <th style={s.th}>Type</th>
                      <th style={s.th}>Customer</th>
                      <th style={s.th}><button type="button" style={s.sortButton} onClick={() => toggleSort('staff_name')}>Staff{sortLabel('staff_name')}</button></th>
                      <th style={s.th}><button type="button" style={s.sortButton} onClick={() => toggleSort('item_count')}>Items{sortLabel('item_count')}</button></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOrders.map(order => (
                      <tr key={order.id}>
                        <td style={s.td}>
                          <span style={s.ticket}>{order.ticket_number}</span>
                          {order.notes && <div style={s.itemLine}>Note: {order.notes}</div>}
                        </td>
                        <td style={s.td}>{formatDateTime(order.completed_at)}</td>
                        <td style={s.td}>{formatCurrency(order.total)}</td>
                        <td style={s.td}>{formatPaymentMethod(order.payment_method)}</td>
                        <td style={s.td}>{formatOrderType(order.order_type)}</td>
                        <td style={s.td}>{order.customer_name || 'Not recorded'}</td>
                        <td style={s.td}>{order.staff_name}</td>
                        <td style={s.td}>
                          {getOrderItemCount(order)}
                          <div style={s.detail}>
                            {order.items.map(item => {
                              const optionText = formatOptions(item.options);

                              return (
                                <span key={item.id} style={s.itemLine}>
                                  x{item.quantity} {item.name}{optionText ? ` (${optionText})` : ''}
                                </span>
                              );
                            })}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            ) : (
              <div style={s.alert}>No completed orders match the current filters.</div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default DashboardPage;
