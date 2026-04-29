import type { Order, OrderItem } from '../types';

export const MILK_LABELS: Record<string, string> = {
  dairy: 'Dairy',
  oat: 'Oat',
};

export const SUGAR_LABELS: Record<string, string> = {
  no_sugar: 'No Sugar',
  less_sweet: 'Less Sweet',
  normal: 'Normal Sugar',
  more_sweet: 'More Sweet',
};

export const WARM_UP_LABELS: Record<string, string> = {
  warm_up: 'Warm Up',
  no_warm_up: 'No Warm Up',
};

export function formatOrderTime(value: string) {
  return new Date(value).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatOrderDateTime(value: string) {
  return new Date(value).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatOptions(options: OrderItem['options']) {
  if (!options) return null;

  const labels = [
    options.milk ? MILK_LABELS[options.milk] ?? options.milk : null,
    options.sugar ? SUGAR_LABELS[options.sugar] ?? options.sugar : null,
    options.warm_up ? WARM_UP_LABELS[options.warm_up] ?? options.warm_up : null,
  ].filter(Boolean);

  return labels.length > 0 ? labels.join(' / ') : null;
}

export function getOrderTypeLabel(orderType: Order['order_type']) {
  return orderType === 'takeaway' ? 'Takeaway' : 'Dine In';
}

export function isPreorder(order: Pick<Order, 'order_source'>) {
  return order.order_source === 'preorder';
}

export function getPreorderLabel(order: Pick<Order, 'external_order_number' | 'external_order_name'>) {
  return `TakeApp ${order.external_order_name || `#${order.external_order_number ?? ''}`}`.trim();
}

export function getPickupSlotLabel(order: Pick<Order, 'scheduled_for'>) {
  if (!order.scheduled_for) return null;

  return new Date(order.scheduled_for).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
