import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { STATION_CATEGORIES } from '../../lib/constants';
import { getPickupSlotLabel, getPreorderLabel } from '../../lib/orderFormatting';
import type { Category, MilkOption, Order, OrderItem, OrderRecord, Product, ProductOptions, SugarOption, WarmUpOption } from '../../types';

const POLL_INTERVAL_MS = 5000;
const READY_GREEN = '#3a7d44';
const STATION_CATEGORY_MAP = {
  Hojicha: STATION_CATEGORIES.hojicha,
  Coffee: STATION_CATEGORIES.coffee,
  Kitchen: STATION_CATEGORIES.kitchen,
} as const satisfies Record<string, Category[]>;
const STATION_READY_CATEGORIES = new Set<Category>(Object.values(STATION_CATEGORY_MAP).flat());
const SOLD_OUT_PRODUCT_NAMES = new Set([
  'Classic Shio Pan',
  'Scallion Cream Cheese Onion Shio Pan',
  'Spam Musubi',
  'Iced Banana Hojicha Latte',
]);

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

type EditableOrderItem = {
  rowKey: string;
  id?: string;
  product_id: string;
  quantity: number;
  options: ProductOptions | null;
};

function isSoldOutProduct(product: Product) {
  return SOLD_OUT_PRODUCT_NAMES.has(product.name);
}

function getExistingProductQuantity(order: Order | null, productId: string) {
  return order?.items.reduce((sum, item) => (
    item.product_id === productId ? sum + item.quantity : sum
  ), 0) ?? 0;
}

function getEditedProductQuantity(items: EditableOrderItem[], productId: string) {
  return items.reduce((sum, item) => (
    item.product_id === productId ? sum + item.quantity : sum
  ), 0);
}

function getAvailableStock(product: Product, editItems: EditableOrderItem[], editingOrder: Order | null) {
  if (product.stock_quantity === null) return Number.POSITIVE_INFINITY;
  return product.stock_quantity + getExistingProductQuantity(editingOrder, product.id) - getEditedProductQuantity(editItems, product.id);
}

function formatRemainingStock(remainingStock: number) {
  return Number.isFinite(remainingStock) ? `${Math.max(0, remainingStock)} left` : null;
}

function buildEditedProductStockDeltas(order: Order, items: EditableOrderItem[]) {
  const productIds = new Set([
    ...order.items.map(item => item.product_id),
    ...items.map(item => item.product_id),
  ]);
  const deltas = new Map<string, number>();

  for (const productId of productIds) {
    deltas.set(
      productId,
      getExistingProductQuantity(order, productId) - getEditedProductQuantity(items, productId)
    );
  }

  return deltas;
}

function requiresMilkOption(product: Product) {
  return /matcha latte|hojicha latte/i.test(product.name);
}

function requiresSugarOption(product: Product) {
  return requiresMilkOption(product) && !/strawberry matcha|lychee matcha|banana hojicha/i.test(product.name);
}

function requiresWarmUpOption(product: Product, orderType: Order['order_type']) {
  return orderType === 'dine_in' && /shio pan|spam musubi/i.test(product.name);
}

function isOatOnlyLatte(product: Product) {
  return /banana hojicha latte/i.test(product.name);
}

function getDefaultOptions(product: Product, orderType: Order['order_type']): ProductOptions | null {
  const options: ProductOptions = {};

  if (requiresMilkOption(product)) {
    options.milk = isOatOnlyLatte(product) ? 'oat' : 'dairy';
  }

  if (requiresSugarOption(product)) {
    options.sugar = 'normal';
  }

  if (requiresWarmUpOption(product, orderType)) {
    options.warm_up = 'warm_up';
  }

  return Object.keys(options).length > 0 ? options : null;
}

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

function getStationStatus(
  order: Order,
  stationName: keyof typeof STATION_CATEGORY_MAP,
  productCategoryMap: Map<string, Category>
) {
  const categories = STATION_CATEGORY_MAP[stationName] as readonly Category[];
  const stationItems = order.items.filter(item => {
    if (item.prep_required === false) return false;

    const category = productCategoryMap.get(item.product_id);
    return category ? categories.includes(category) : false;
  });

  if (stationItems.length === 0) {
    return 'na' as const;
  }

  return stationItems.every(item => item.ready_at !== null) ? 'done' as const : 'pending' as const;
}

function isOrderReadyToServe(order: Order, productCategoryMap: Map<string, Category>) {
  if (productCategoryMap.size === 0) return false;

  const stationItems = order.items.filter(item => {
    if (item.prep_required === false) return false;

    const category = productCategoryMap.get(item.product_id);
    return category ? STATION_READY_CATEGORIES.has(category) : true;
  });

  return stationItems.length === 0 || stationItems.every(item => item.ready_at !== null);
}

async function fetchLiveOrders() {
  const response = await fetch('/api/live-orders');
  const result = await response.json().catch(() => null) as { error?: string; orders?: OrderRecord[] } | null;

  if (!response.ok) {
    throw new Error(result?.error || 'Unable to load live orders');
  }

  return (result?.orders ?? []).map(normalizeOrder);
}

async function completeOrder(orderId: string) {
  const response = await fetch('/api/complete-order', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ orderId }),
  });
  const result = await response.json().catch(() => null) as { error?: string } | null;

  if (!response.ok) {
    throw new Error(result?.error || 'Unable to complete order');
  }
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
  queueControls: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.8rem 0.9rem',
    borderRadius: '18px',
    background: 'rgba(255, 252, 246, 0.78)',
    border: '1px solid rgba(104, 40, 55, 0.12)',
    boxShadow: '0 6px 16px rgba(82, 48, 26, 0.06)',
  },
  filterToggle: (active: boolean) => ({
    minHeight: '38px',
    padding: '0.45rem 0.8rem',
    borderRadius: '999px',
    border: `1px solid ${active ? 'rgba(104, 40, 55, 0.34)' : 'rgba(104, 40, 55, 0.16)'}`,
    background: active ? 'var(--color-burgundy)' : 'rgba(255, 255, 255, 0.62)',
    color: active ? '#FFF7E8' : 'var(--color-brown)',
    fontFamily: "'Public Sans', sans-serif",
    fontSize: '12px',
    fontWeight: 800,
    cursor: 'pointer',
  }),
  filterNote: {
    fontFamily: "'Public Sans', sans-serif",
    fontSize: '12px',
    color: 'var(--color-brown)',
    opacity: 0.76,
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
  readyCard: {
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
  ticketMetaRow: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    alignItems: 'center',
    gap: '0.5rem',
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
  customerName: {
    fontFamily: "'Public Sans', sans-serif",
    fontSize: '1.05rem',
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
    color: READY_GREEN,
  },
  readyServeBadge: {
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
  stationRow: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '0.5rem',
  },
  stationChip: (status: 'done' | 'pending' | 'na') => ({
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0.42rem 0.72rem',
    borderRadius: '999px',
    border: status === 'done'
      ? '1px solid rgba(58, 125, 68, 0.28)'
      : status === 'pending'
        ? '1px solid rgba(104, 40, 55, 0.16)'
        : '1px solid rgba(82, 48, 26, 0.12)',
    background: status === 'done'
      ? 'rgba(58, 125, 68, 0.12)'
      : status === 'pending'
        ? 'rgba(240, 228, 191, 0.5)'
        : 'rgba(82, 48, 26, 0.06)',
    color: status === 'done' ? READY_GREEN : status === 'pending' ? '#682837' : 'rgba(82, 48, 26, 0.56)',
    fontFamily: "'Public Sans', sans-serif",
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '0.02em',
  }),
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
  secondaryActionButton: {
    border: '1px solid rgba(104, 40, 55, 0.18)',
    borderRadius: '999px',
    padding: '0.78rem 1rem',
    background: 'rgba(255, 255, 255, 0.7)',
    color: 'var(--color-burgundy)',
    fontFamily: "'Public Sans', sans-serif",
    fontSize: '13px',
    fontWeight: 800,
    cursor: 'pointer',
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
  modalOverlay: {
    position: 'fixed' as const,
    inset: 0,
    zIndex: 50,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1rem',
    background: 'rgba(82, 48, 26, 0.32)',
  },
  modalCard: {
    width: 'min(760px, 100%)',
    maxHeight: '92vh',
    overflowY: 'auto' as const,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '1rem',
    padding: '1.1rem',
    borderRadius: '22px',
    background: '#fffaf0',
    border: '1px solid rgba(104, 40, 55, 0.18)',
    boxShadow: '0 18px 42px rgba(82, 48, 26, 0.2)',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '1rem',
    alignItems: 'flex-start',
  },
  modalTitle: {
    margin: 0,
    fontFamily: "'Alice', serif",
    fontSize: '1.75rem',
    color: 'var(--color-burgundy)',
  },
  modalCloseBtn: {
    width: '34px',
    height: '34px',
    borderRadius: '999px',
    border: '1px solid rgba(104, 40, 55, 0.18)',
    background: 'rgba(255, 255, 255, 0.72)',
    color: 'var(--color-burgundy)',
    fontWeight: 800,
    cursor: 'pointer',
  },
  editItemsList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.75rem',
  },
  editItemRow: {
    display: 'grid',
    gridTemplateColumns: 'minmax(220px, 1fr) 88px auto',
    gap: '0.6rem',
    alignItems: 'start',
    padding: '0.85rem',
    borderRadius: '16px',
    background: 'rgba(240, 228, 191, 0.32)',
    border: '1px solid rgba(104, 40, 55, 0.1)',
  },
  editField: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.35rem',
  },
  editLabel: {
    fontFamily: "'Public Sans', sans-serif",
    fontSize: '11px',
    fontWeight: 800,
    letterSpacing: '0.06em',
    textTransform: 'uppercase' as const,
    color: 'var(--color-brown)',
    opacity: 0.72,
  },
  editInput: {
    width: '100%',
    minHeight: '40px',
    borderRadius: '12px',
    border: '1px solid rgba(104, 40, 55, 0.18)',
    background: 'rgba(255, 255, 255, 0.76)',
    color: 'var(--color-brown)',
    fontFamily: "'Public Sans', sans-serif",
    fontSize: '14px',
    padding: '0.5rem 0.65rem',
  },
  optionRow: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '0.5rem',
    gridColumn: '1 / -1',
  },
  optionSelect: {
    minWidth: '150px',
    minHeight: '38px',
    borderRadius: '999px',
    border: '1px solid rgba(104, 40, 55, 0.16)',
    background: 'rgba(255, 255, 255, 0.76)',
    color: 'var(--color-brown)',
    fontFamily: "'Public Sans', sans-serif",
    fontSize: '13px',
    padding: '0.35rem 0.65rem',
  },
  removeBtn: {
    minHeight: '40px',
    borderRadius: '999px',
    border: '1px solid rgba(139, 0, 0, 0.2)',
    background: 'rgba(139, 0, 0, 0.06)',
    color: '#8B0000',
    fontFamily: "'Public Sans', sans-serif",
    fontSize: '12px',
    fontWeight: 800,
    cursor: 'pointer',
  },
  modalActions: {
    display: 'flex',
    justifyContent: 'space-between',
    flexWrap: 'wrap' as const,
    gap: '0.65rem',
  },
  modalPrimaryActions: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '0.65rem',
  },
};

const LiveOrdersPage: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [completingOrderIds, setCompletingOrderIds] = useState<Record<string, boolean>>({});
  const [orderErrors, setOrderErrors] = useState<Record<string, string>>({});
  const [showPosOnly, setShowPosOnly] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [editItems, setEditItems] = useState<EditableOrderItem[]>([]);
  const [editError, setEditError] = useState<string | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
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
        .select('id, name, price, category, subcategory, sort_order, is_available, stock_quantity');

      if (!active) return;

      setProducts(data ?? []);
    })();

    return () => {
      active = false;
    };
  }, []);

  async function handleCompleteOrder(order: Order) {
    if (completingOrderIds[order.id]) return;

    setSuccessMessage(null);
    setOrderErrors(current => {
      if (!current[order.id]) return current;

      const next = { ...current };
      delete next[order.id];
      return next;
    });
    setCompletingOrderIds(current => ({ ...current, [order.id]: true }));

    try {
      await completeOrder(order.id);
      setOrders(current => current.filter(entry => entry.id !== order.id));
      setSuccessMessage(`Order ${order.ticket_number} marked as served.`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setOrderErrors(current => ({ ...current, [order.id]: message }));
    } finally {
      setCompletingOrderIds(current => {
        const next = { ...current };
        delete next[order.id];
        return next;
      });
    }
  }

  const productCategoryMap = new Map(products.map(product => [product.id, product.category]));
  const productMap = new Map(products.map(product => [product.id, product]));
  const selectableProducts = products.filter(product => (
    product.is_available &&
    !isSoldOutProduct(product) &&
    (product.stock_quantity === null || product.stock_quantity > 0)
  ));
  const visibleOrders = showPosOnly
    ? orders.filter(order => order.order_source !== 'preorder')
    : orders;
  const preorderCount = orders.filter(order => order.order_source === 'preorder').length;
  const posOrderCount = orders.length - preorderCount;
  const editSubtotal = editItems.reduce((sum, item) => {
    const product = productMap.get(item.product_id);
    return sum + (product?.price ?? 0) * item.quantity;
  }, 0);
  const hasInvalidEditItems = editItems.length === 0 || editItems.some(item => {
    const product = productMap.get(item.product_id);
    return !product ||
      !product.is_available ||
      isSoldOutProduct(product) ||
      item.quantity <= 0 ||
      getAvailableStock(product, editItems, editingOrder) < 0;
  });

  function openEditOrder(order: Order) {
    setEditingOrder(order);
    setEditItems(order.items.map(item => ({
      rowKey: item.id,
      id: item.id,
      product_id: item.product_id,
      quantity: item.quantity,
      options: item.options,
    })));
    setEditError(null);
  }

  function closeEditOrder() {
    if (isSavingEdit) return;

    setEditingOrder(null);
    setEditItems([]);
    setEditError(null);
  }

  function updateEditItemProduct(rowKey: string, productId: string) {
    const product = productMap.get(productId);
    if (!product || !editingOrder) return;

    setEditItems(current => current.map(item => (
      item.rowKey === rowKey
        ? { ...item, product_id: productId, options: getDefaultOptions(product, editingOrder.order_type) }
        : item
    )));
  }

  function updateEditItemQuantity(rowKey: string, quantity: number) {
    setEditItems(current => current.map(item => (
      item.rowKey === rowKey
        ? { ...item, quantity: Number.isFinite(quantity) ? Math.max(1, Math.floor(quantity)) : 1 }
        : item
    )));
  }

  function updateEditItemOptions(rowKey: string, patch: ProductOptions) {
    setEditItems(current => current.map(item => {
      if (item.rowKey !== rowKey) return item;

      return {
        ...item,
        options: {
          ...(item.options ?? {}),
          ...patch,
        },
      };
    }));
  }

  function addEditItem() {
    const product = selectableProducts[0];
    if (!product || !editingOrder) return;

    setEditItems(current => [
      ...current,
      {
        rowKey: `new-${Date.now()}-${current.length}`,
        product_id: product.id,
        quantity: 1,
        options: getDefaultOptions(product, editingOrder.order_type),
      },
    ]);
  }

  function removeEditItem(rowKey: string) {
    setEditItems(current => current.filter(item => item.rowKey !== rowKey));
  }

  async function saveEditOrder() {
    if (!editingOrder || isSavingEdit || hasInvalidEditItems) return;

    setIsSavingEdit(true);
    setEditError(null);

    try {
      const response = await fetch('/api/edit-order-items', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orderId: editingOrder.id,
          staffName: 'FOH',
          total: editingOrder.total,
          items: editItems.map(item => ({
            id: item.id,
            product_id: item.product_id,
            quantity: item.quantity,
            options: item.options,
          })),
        }),
      });
      const result = await response.json().catch(() => null) as { error?: string; order?: OrderRecord } | null;

      if (!response.ok || !result?.order) {
        throw new Error(result?.error || 'Unable to edit order items');
      }

      const updatedOrder = normalizeOrder(result.order);
      const stockDeltas = buildEditedProductStockDeltas(editingOrder, editItems);

      setProducts(current => current.map(product => {
        const delta = stockDeltas.get(product.id);
        if (!delta || product.stock_quantity === null) return product;

        return {
          ...product,
          stock_quantity: Math.max(0, product.stock_quantity + delta),
        };
      }));
      setOrders(current => current.map(order => order.id === updatedOrder.id ? updatedOrder : order));
      setSuccessMessage(`Order ${updatedOrder.ticket_number} items updated.`);
      setEditingOrder(null);
      setEditItems([]);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsSavingEdit(false);
    }
  }

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
            <span style={s.statusLabel}>{showPosOnly ? 'POS Tickets' : 'Open Tickets'}</span>
            <span style={s.statusValue}>{visibleOrders.length}</span>
            <span style={s.statusNote}>
              {showPosOnly
                ? `${preorderCount} preorder${preorderCount === 1 ? '' : 's'} hidden from this FOH view.`
                : 'Mark tickets as served to clear them from the live kitchen queue.'}
            </span>
          </div>
        </section>

        <section style={s.queueControls}>
          <button
            type="button"
            style={s.filterToggle(showPosOnly)}
            onClick={() => setShowPosOnly(current => !current)}
            aria-pressed={showPosOnly}
          >
            {showPosOnly ? 'Showing POS only' : 'Show POS only'}
          </button>
          <span style={s.filterNote}>
            View-only FOH filter: {posOrderCount} POS / {preorderCount} preorder. Stations still receive all released prep tickets.
          </span>
        </section>

        {loading && <div style={s.alert('info')}>Loading live orders...</div>}
        {!loading && error && <div style={s.alert('error')}>Unable to load live orders: {error}</div>}
        {!loading && !error && successMessage && <div style={s.alert('info')}>{successMessage}</div>}
        {!loading && !error && visibleOrders.length === 0 && (
          <div style={s.alert('info')}>
            {orders.length === 0
              ? 'No live orders right now. New tickets will appear here after refresh.'
              : 'No POS orders in this filtered view. Toggle back to see released preorders.'}
          </div>
        )}

        {!loading && !error && visibleOrders.length > 0 && (
          <section style={s.grid}>
            {visibleOrders.map(order => {
              const isFullyReady = isOrderReadyToServe(order, productCategoryMap);

              return (
              <article key={order.id} style={isFullyReady ? { ...s.card, ...s.readyCard } : s.card}>
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
                    {isFullyReady && <span style={s.readyServeBadge}>Ready to Serve</span>}
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

                <div>
                  <span style={s.sectionLabel}>Station Status</span>
                  <div style={s.stationRow}>
                    {(Object.keys(STATION_CATEGORY_MAP) as Array<keyof typeof STATION_CATEGORY_MAP>).map(stationName => {
                      const status = getStationStatus(order, stationName, productCategoryMap);
                      const label = status === 'done' ? 'Done' : status === 'pending' ? 'Pending' : 'N/A';

                      return (
                        <span key={stationName} style={s.stationChip(status)}>
                          {stationName} {label}
                        </span>
                      );
                    })}
                  </div>
                </div>

                <div style={s.actions}>
                  <button
                    type="button"
                    style={s.secondaryActionButton}
                    onClick={() => openEditOrder(order)}
                  >
                    Edit Items
                  </button>
                  <button
                    type="button"
                    style={s.actionButton(Boolean(completingOrderIds[order.id]) || !isFullyReady)}
                    disabled={Boolean(completingOrderIds[order.id]) || !isFullyReady}
                    onClick={() => {
                      void handleCompleteOrder(order);
                    }}
                  >
                    {completingOrderIds[order.id]
                      ? 'Marking as Served...'
                      : isFullyReady
                        ? 'Mark as Served'
                        : 'Waiting on stations'}
                  </button>
                  <span style={s.actionHint}>
                    {isFullyReady
                      ? 'Completing a ticket removes it from the live queue but keeps it stored for reporting.'
                      : 'All station items must be marked ready before this ticket can be served.'}
                  </span>
                  {orderErrors[order.id] && <span style={s.inlineError}>{orderErrors[order.id]}</span>}
                </div>
              </article>
            )})}
          </section>
        )}

        {editingOrder && (
          <div style={s.modalOverlay} onClick={closeEditOrder}>
            <div style={s.modalCard} onClick={event => event.stopPropagation()}>
              <div style={s.modalHeader}>
                <div>
                  <span style={s.ticketLabel}>Order {editingOrder.ticket_number}</span>
                  <h2 style={s.modalTitle}>Edit Items</h2>
                  <p style={s.statusNote}>
                    Item subtotal becomes ${editSubtotal.toFixed(2)}. Ticket total remains ${editingOrder.total.toFixed(2)}.
                  </p>
                </div>
                <button type="button" style={s.modalCloseBtn} onClick={closeEditOrder} aria-label="Close edit items">x</button>
              </div>

              <div style={s.editItemsList}>
                {editItems.map(item => {
                  const product = productMap.get(item.product_id);
                  const isInvalidProduct = !product || !product.is_available || isSoldOutProduct(product);

                  return (
                    <div key={item.rowKey} style={s.editItemRow}>
                      <label style={s.editField}>
                        <span style={s.editLabel}>Item</span>
                        <select
                          style={s.editInput}
                          value={item.product_id}
                          onChange={event => updateEditItemProduct(item.rowKey, event.target.value)}
                        >
                          {products.map(productOption => {
                            const remainingStock = getAvailableStock(productOption, editItems, editingOrder);
                            const unavailable = !productOption.is_available || isSoldOutProduct(productOption) || (
                              productOption.id !== item.product_id &&
                              remainingStock <= 0
                            );
                            const stockLabel = formatRemainingStock(remainingStock);

                            return (
                              <option
                                key={productOption.id}
                                value={productOption.id}
                                disabled={unavailable}
                              >
                                {productOption.name}{unavailable ? ' - SOLD OUT' : stockLabel ? ` - ${stockLabel}` : ''}
                              </option>
                            );
                          })}
                        </select>
                      </label>

                      <label style={s.editField}>
                        <span style={s.editLabel}>Qty</span>
                        <input
                          style={s.editInput}
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={event => updateEditItemQuantity(item.rowKey, Number(event.target.value))}
                        />
                      </label>

                      <button type="button" style={s.removeBtn} onClick={() => removeEditItem(item.rowKey)}>
                        Remove
                      </button>

                      {product && !isInvalidProduct && (
                        <div style={s.optionRow}>
                          {requiresMilkOption(product) && (
                            <select
                              style={s.optionSelect}
                              value={item.options?.milk ?? (isOatOnlyLatte(product) ? 'oat' : 'dairy')}
                              onChange={event => updateEditItemOptions(item.rowKey, { milk: event.target.value as MilkOption })}
                              disabled={isOatOnlyLatte(product)}
                            >
                              <option value="dairy">Dairy</option>
                              <option value="oat">Oat</option>
                            </select>
                          )}

                          {requiresSugarOption(product) && (
                            <select
                              style={s.optionSelect}
                              value={item.options?.sugar ?? 'normal'}
                              onChange={event => updateEditItemOptions(item.rowKey, { sugar: event.target.value as SugarOption })}
                            >
                              <option value="no_sugar">No Sugar</option>
                              <option value="less_sweet">Less Sweet</option>
                              <option value="normal">Normal Sugar</option>
                              <option value="more_sweet">More Sweet</option>
                            </select>
                          )}

                          {requiresWarmUpOption(product, editingOrder.order_type) && (
                            <select
                              style={s.optionSelect}
                              value={item.options?.warm_up ?? 'warm_up'}
                              onChange={event => updateEditItemOptions(item.rowKey, { warm_up: event.target.value as WarmUpOption })}
                            >
                              <option value="warm_up">Warm Up</option>
                              <option value="no_warm_up">No Warm Up</option>
                            </select>
                          )}
                        </div>
                      )}

                      {isInvalidProduct && (
                        <span style={{ ...s.inlineError, gridColumn: '1 / -1' }}>
                          Choose an available replacement before saving.
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {editError && <div style={s.alert('error')}>{editError}</div>}

              <div style={s.modalActions}>
                <button
                  type="button"
                  style={s.secondaryActionButton}
                  onClick={addEditItem}
                  disabled={selectableProducts.length === 0}
                >
                  Add Item
                </button>
                <div style={s.modalPrimaryActions}>
                  <button type="button" style={s.secondaryActionButton} onClick={closeEditOrder}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    style={s.actionButton(isSavingEdit || hasInvalidEditItems)}
                    disabled={isSavingEdit || hasInvalidEditItems}
                    onClick={() => {
                      void saveEditOrder();
                    }}
                  >
                    {isSavingEdit ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LiveOrdersPage;
