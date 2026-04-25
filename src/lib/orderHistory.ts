import type { Order, OrderItem, OrderRecord, OrderType, PaymentMethod } from '../types';

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

export async function fetchCompletedOrders() {
  const response = await fetch('/api/orders-history');
  const result = await response.json().catch(() => null) as { error?: string; orders?: OrderRecord[] } | null;

  if (!response.ok) {
    throw new Error(result?.error || 'Unable to load completed orders');
  }

  return (result?.orders ?? []).map(normalizeOrder);
}

export function normalizeOrder(order: OrderRecord): Order {
  return {
    ...order,
    items: order.order_items ?? [],
  };
}

export function formatCurrency(value: number) {
  return `$${Number(value).toFixed(2)}`;
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return 'Not recorded';

  return new Date(value).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatPaymentMethod(paymentMethod: PaymentMethod) {
  return paymentMethod.charAt(0).toUpperCase() + paymentMethod.slice(1);
}

export function formatOrderType(orderType: OrderType) {
  return orderType === 'takeaway' ? 'Takeaway' : 'Dine In';
}

export function formatOptions(options: OrderItem['options']) {
  if (!options) return null;

  const labels = [
    options.milk ? MILK_LABELS[options.milk] ?? options.milk : null,
    options.sugar ? SUGAR_LABELS[options.sugar] ?? options.sugar : null,
  ].filter(Boolean);

  return labels.length > 0 ? labels.join(' / ') : null;
}

export function getOrderItemCount(order: Order) {
  return order.items.reduce((sum, item) => sum + Number(item.quantity), 0);
}

export function getOrderSearchText(order: Order) {
  return [
    order.ticket_number,
    order.staff_name,
    order.payment_method,
    order.order_type,
    order.notes,
    ...order.items.flatMap(item => [item.name, formatOptions(item.options)]),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}
