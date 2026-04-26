import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { CATEGORY_META, CATEGORY_ORDER } from '../../lib/constants';
import type {
  Product,
  CartItem,
  CartEntry,
  BestieSetCartItem,
  BestieSetSubItem,
  PaymentMethod,
  OrderType,
  MilkOption,
  SugarOption,
  WarmUpOption,
  ProductOptions,
  Order,
} from '../../types';

// ── Styles ────────────────────────────────────────────────────────────────────

const PRODUCT_BTN_BG = 'rgba(255, 255, 255, 0.58)';
const MILK_OPTIONS: { value: MilkOption; label: string }[] = [
  { value: 'dairy', label: 'Dairy' },
  { value: 'oat', label: 'Oat' },
];
const SUGAR_OPTIONS: { value: SugarOption; label: string }[] = [
  { value: 'no_sugar', label: 'No Sugar' },
  { value: 'less_sweet', label: 'Less Sweet' },
  { value: 'normal', label: 'Normal Sugar' },
  { value: 'more_sweet', label: 'More Sweet' },
];
const WARM_UP_OPTIONS: { value: WarmUpOption; label: string }[] = [
  { value: 'warm_up', label: 'Warm Up' },
  { value: 'no_warm_up', label: 'No Warm Up' },
];

function isPostcard(product: Product) {
  return product.name === "Sachi's Postcard";
}

function requiresMilkOption(product: Product) {
  return /matcha latte|hojicha latte/i.test(product.name);
}

function requiresSugarOption(product: Product) {
  return requiresMilkOption(product) && !/strawberry matcha|lychee matcha/i.test(product.name);
}

function requiresWarmUpOption(product: Product, orderType: OrderType) {
  return orderType === 'dine_in' && /shio pan|spam musubi/i.test(product.name);
}

function isCustomizable(product: Product, orderType: OrderType) {
  return isPostcard(product) || requiresMilkOption(product) || requiresWarmUpOption(product, orderType);
}

function isOatOnlyLatte(product: Product) {
  return /banana hojicha latte/i.test(product.name);
}

function optionsMatch(a?: ProductOptions, b?: ProductOptions) {
  return a?.milk === b?.milk && a?.sugar === b?.sugar && a?.warm_up === b?.warm_up;
}

function isBestieSetCartItem(item: CartEntry): item is BestieSetCartItem {
  return 'type' in item && item.type === 'bestie_set';
}

function getCartItemKey(item: CartItem) {
  const milk = item.options?.milk ?? 'none';
  const sugar = item.options?.sugar ?? 'none';
  const warmUp = item.options?.warm_up ?? 'none';
  const setLabel = item.setLabel ?? 'none';
  return `${item.product_id}::${milk}::${sugar}::${warmUp}::${setLabel}`;
}

function formatOptionLabel(item: CartItem) {
  if (!item.options) return null;

  const milkLabel = MILK_OPTIONS.find(option => option.value === item.options?.milk)?.label;
  const sugarLabel = SUGAR_OPTIONS.find(option => option.value === item.options?.sugar)?.label;
  const warmUpLabel = WARM_UP_OPTIONS.find(option => option.value === item.options?.warm_up)?.label;
  return [milkLabel, sugarLabel, warmUpLabel].filter(Boolean).join(' · ');
}

function formatSubItemOptions(item: BestieSetSubItem) {
  if (!item.options) return item.name;

  const milkLabel = MILK_OPTIONS.find(option => option.value === item.options?.milk)?.label;
  const sugarLabel = SUGAR_OPTIONS.find(option => option.value === item.options?.sugar)?.label;
  const warmUpLabel = WARM_UP_OPTIONS.find(option => option.value === item.options?.warm_up)?.label;
  const optionLabel = [milkLabel, sugarLabel, warmUpLabel].filter(Boolean).join(' - ');
  return optionLabel ? `${item.name} (${optionLabel})` : item.name;
}

function roundPrice(value: number) {
  return Math.round(Math.max(0, value) * 100) / 100;
}

function explodeCartEntries(entries: CartEntry[]): CartItem[] {
  return entries.flatMap(entry => {
    if (!isBestieSetCartItem(entry)) return [entry];

    const total = entry.drink1.price + entry.drink2.price + entry.bite.price;
    const p1 = total > 0 ? Math.round((entry.setPrice * entry.drink1.price / total) * 100) / 100 : 0;
    const p2 = total > 0 ? Math.round((entry.setPrice * entry.drink2.price / total) * 100) / 100 : 0;
    const p3 = Math.round((entry.setPrice - p1 - p2) * 100) / 100;

    return [
      {
        product_id: entry.drink1.product_id,
        name: entry.drink1.name,
        price: p1,
        options: entry.drink1.options,
        quantity: 1,
      },
      {
        product_id: entry.drink2.product_id,
        name: entry.drink2.name,
        price: p2,
        options: entry.drink2.options,
        quantity: 1,
      },
      {
        product_id: entry.bite.product_id,
        name: entry.bite.name,
        price: p3,
        quantity: 1,
      },
    ];
  });
}

async function createOrder(payload: {
  p_staff_name: string;
  p_customer_name: string;
  p_payment_method: PaymentMethod;
  p_order_type: OrderType;
  p_notes: string | null;
  p_subtotal: number;
  p_total: number;
  p_items: Array<{
    product_id: string;
    name: string;
    quantity: number;
    unit_price: number;
    options?: ProductOptions;
  }>;
}) {
  const response = await fetch('/api/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      staffName: payload.p_staff_name,
      customerName: payload.p_customer_name,
      paymentMethod: payload.p_payment_method,
      order_type: payload.p_order_type,
      notes: payload.p_notes,
      subtotal: payload.p_subtotal,
      total: payload.p_total,
      items: payload.p_items,
    }),
  });

  const result = await response.json().catch(() => null) as { error?: string; order?: unknown } | null;

  if (!response.ok) {
    throw new Error(result?.error || 'Unable to create order');
  }

  if (!result?.order) {
    throw new Error('Order API did not return an order. Run the app with the Vercel API available for checkout.');
  }

  return result.order;
}

const s = {
  root: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
    textAlign: 'left' as const,
  },
  // Product panel
  productPanel: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '1rem 1.25rem',
    background: 'var(--bg)',
  },
  categoryList: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '1rem',
    alignContent: 'start' as const,
  },
  categoryHeading: {
    fontFamily: "'Alice', serif",
    fontSize: '20px',
    fontWeight: 400,
    color: 'var(--color-burgundy)',
    margin: 0,
    lineHeight: 1.1,
  },
  categorySection: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.875rem',
    padding: '1rem',
    borderRadius: '22px',
    background: 'rgba(240, 228, 191, 0.34)',
    border: '1px solid rgba(104, 40, 55, 0.12)',
    boxShadow: '0 6px 18px rgba(82, 48, 26, 0.06)',
  },
  categoryIntro: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.35rem',
  },
  categoryEyebrow: {
    fontFamily: "'Public Sans', sans-serif",
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '0.09em',
    textTransform: 'uppercase' as const,
    color: 'var(--color-pink)',
  },
  categoryDescription: {
    fontFamily: "'Public Sans', sans-serif",
    fontSize: '12px',
    color: 'var(--color-brown)',
    opacity: 0.78,
    lineHeight: 1.45,
    margin: 0,
  },
  subcategoryBlock: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.5rem',
  },
  subcategoryHeading: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '0.25rem 0.65rem',
    borderRadius: '999px',
    background: 'rgba(255, 255, 255, 0.72)',
    border: '1px solid rgba(104, 40, 55, 0.12)',
    color: 'var(--color-brown)',
    fontFamily: "'Public Sans', sans-serif",
    fontSize: '11px',
    fontWeight: 600,
    letterSpacing: '0.06em',
    textTransform: 'uppercase' as const,
  },
  productGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(145px, 1fr))',
    gap: '0.5rem',
  },
  productBtn: {
    background: PRODUCT_BTN_BG,
    border: '1px solid rgba(104, 40, 55, 0.14)',
    borderRadius: '14px',
    padding: '0.75rem',
    cursor: 'pointer',
    textAlign: 'left' as const,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
    minHeight: '68px',
    boxShadow: '0 1px 6px rgba(82, 48, 26, 0.08)',
    transition: 'border-color 0.15s, background 0.15s, box-shadow 0.15s',
  },
  productName: {
    fontFamily: "'Public Sans', sans-serif",
    fontSize: '14px',
    fontWeight: 500,
    color: 'var(--color-burgundy)',
    lineHeight: 1.25,
  },
  productPrice: {
    fontFamily: "'Public Sans', sans-serif",
    fontSize: '13px',
    color: 'var(--color-pink)',
    fontWeight: 600,
  },
  bestieSetBtn: {
    width: '100%',
    marginBottom: '1rem',
    padding: '0.95rem 1rem',
    borderRadius: '18px',
    border: '1px solid rgba(104, 40, 55, 0.18)',
    background: '#682837',
    color: '#F0E4BF',
    fontFamily: "'Alice', serif",
    fontSize: '22px',
    cursor: 'pointer',
    boxShadow: '0 8px 20px rgba(104, 40, 55, 0.18)',
  },
  setBtn: {
    marginTop: '0.35rem',
    padding: '6px 8px',
    borderRadius: '999px',
    border: '1px solid rgba(104, 40, 55, 0.18)',
    background: '#F0E4BF',
    color: '#682837',
    fontFamily: "'Public Sans', sans-serif",
    fontSize: '12px',
    fontWeight: 700,
    cursor: 'pointer',
  },
  // Cart panel
  cartPanel: {
    width: '320px',
    minWidth: '320px',
    borderLeft: '1px solid rgba(104, 40, 55, 0.14)',
    display: 'flex',
    flexDirection: 'column' as const,
    background: 'rgba(255, 255, 255, 0.32)',
  },
  cartHeader: {
    padding: '0.875rem 1.25rem',
    borderBottom: '1px solid rgba(104, 40, 55, 0.12)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cartTitle: {
    fontFamily: "'Alice', serif",
    fontSize: '15px',
    fontWeight: 400,
    color: 'var(--color-burgundy)',
  },
  cartItems: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '0.5rem 0',
  },
  cartItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.5rem 1.25rem',
  },
  cartItemName: {
    flex: 1,
    fontFamily: "'Public Sans', sans-serif",
    fontSize: '13px',
    color: 'var(--color-burgundy)',
    lineHeight: 1.3,
  },
  cartItemMeta: {
    display: 'block',
    marginTop: '3px',
    fontFamily: "'Public Sans', sans-serif",
    fontSize: '11px',
    color: 'var(--color-brown)',
    opacity: 0.72,
    lineHeight: 1.4,
  },
  qtyBtn: {
    width: '26px',
    height: '26px',
    borderRadius: '999px',
    border: '1px solid rgba(104, 40, 55, 0.2)',
    background: 'rgba(255, 255, 255, 0.55)',
    cursor: 'pointer',
    fontSize: '14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--color-burgundy)',
    flexShrink: 0,
    padding: 0,
    lineHeight: 1,
  },
  qtyNum: {
    width: '22px',
    textAlign: 'center' as const,
    fontFamily: "'Public Sans', sans-serif",
    fontSize: '13px',
    fontWeight: 600,
    color: 'var(--color-burgundy)',
  },
  cartItemPrice: {
    fontFamily: "'Public Sans', sans-serif",
    fontSize: '13px',
    color: 'var(--color-brown)',
    minWidth: '44px',
    textAlign: 'right' as const,
    opacity: 0.8,
  },
  cartPriceBtn: {
    border: 'none',
    background: 'transparent',
    color: 'var(--color-brown)',
    cursor: 'pointer',
    fontFamily: "'Public Sans', sans-serif",
    fontSize: '13px',
    padding: '2px 0',
    minWidth: '58px',
    textAlign: 'right' as const,
  },
  cartPriceInput: {
    width: '66px',
    padding: '4px 6px',
    borderRadius: '8px',
    border: '1px solid rgba(104, 40, 55, 0.2)',
    background: 'rgba(255, 255, 255, 0.72)',
    color: 'var(--color-burgundy)',
    fontFamily: "'Public Sans', sans-serif",
    fontSize: '12px',
    boxSizing: 'border-box' as const,
  },
  bestieCartItem: {
    margin: '0.35rem 1rem',
    padding: '0.75rem',
    borderRadius: '16px',
    border: '1px solid rgba(104, 40, 55, 0.14)',
    background: 'rgba(240, 228, 191, 0.42)',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.5rem',
  },
  bestieCartHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '0.75rem',
  },
  bestieSubItem: {
    fontFamily: "'Public Sans', sans-serif",
    fontSize: '11px',
    color: 'var(--color-brown)',
    opacity: 0.75,
    lineHeight: 1.4,
  },
  cartFooter: {
    borderTop: '1px solid rgba(104, 40, 55, 0.12)',
    padding: '0.875rem 1rem',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.625rem',
  },
  totalRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  totalLabel: {
    fontFamily: "'Alice', serif",
    fontSize: '14px',
    fontWeight: 400,
    color: 'var(--color-brown)',
  },
  totalAmount: {
    fontFamily: "'Public Sans', sans-serif",
    fontSize: '1.375rem',
    fontWeight: 600,
    color: 'var(--color-burgundy)',
    letterSpacing: '-0.02em',
  },
  label: {
    fontFamily: "'Public Sans', sans-serif",
    fontSize: '11px',
    fontWeight: 600,
    letterSpacing: '0.07em',
    textTransform: 'uppercase' as const,
    color: 'var(--color-brown)',
    opacity: 0.7,
    marginBottom: '4px',
    display: 'block',
  },
  input: {
    width: '100%',
    padding: '8px 12px',
    borderRadius: '10px',
    border: '1px solid rgba(104, 40, 55, 0.2)',
    background: 'rgba(255, 255, 255, 0.55)',
    color: 'var(--color-burgundy)',
    fontFamily: "'Public Sans', sans-serif",
    fontSize: '13px',
    boxSizing: 'border-box' as const,
    outline: 'none',
  },
  paymentGroup: {
    display: 'flex',
    gap: '0.375rem',
  },
  orderTypeGroup: {
    display: 'flex',
    gap: '0.5rem',
  },
  orderTypeBtn: (active: boolean) => ({
    flex: 1,
    padding: '9px 10px',
    borderRadius: '999px',
    border: `1px solid ${active ? '#682837' : 'rgba(104, 40, 55, 0.45)'}`,
    background: active ? '#682837' : '#F0E4BF',
    color: active ? '#FFFFFF' : '#52301A',
    fontFamily: "'Public Sans', sans-serif",
    fontSize: '12px',
    fontWeight: active ? 600 : 500,
    cursor: 'pointer',
    transition: 'all 0.15s',
    letterSpacing: '0.01em',
  }),
  paymentBtn: (active: boolean) => ({
    flex: 1,
    padding: '7px 4px',
    borderRadius: '999px',
    border: `1px solid ${active ? '#E59090' : 'rgba(104, 40, 55, 0.2)'}`,
    background: active ? '#E59090' : 'rgba(255, 255, 255, 0.5)',
    color: active ? '#FAF6EB' : '#52301A',
    fontFamily: "'Public Sans', sans-serif",
    fontWeight: active ? 600 : 400,
    fontSize: '12px',
    cursor: 'pointer',
    transition: 'all 0.15s',
    letterSpacing: '0.01em',
  }),
  submitBtn: (disabled: boolean) => ({
    width: '100%',
    padding: '12px',
    borderRadius: '999px',
    border: 'none',
    background: disabled ? 'rgba(104, 40, 55, 0.12)' : '#E59090',
    color: disabled ? 'rgba(82, 48, 26, 0.45)' : '#FAF6EB',
    fontFamily: "'Public Sans', sans-serif",
    fontSize: '14px',
    fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
    marginTop: '0.125rem',
    transition: 'background 0.15s, color 0.15s',
    letterSpacing: '0.01em',
  }),
  clearBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: 'var(--color-brown)',
    fontFamily: "'Public Sans', sans-serif",
    fontSize: '12px',
    opacity: 0.6,
    padding: 0,
    letterSpacing: '0.01em',
  },
  emptyCart: {
    padding: '2.5rem 1.25rem',
    textAlign: 'center' as const,
    color: 'var(--color-brown)',
    fontFamily: "'Public Sans', sans-serif",
    fontSize: '13px',
    opacity: 0.6,
    lineHeight: 1.5,
  },
  alert: (type: 'error' | 'success') => ({
    padding: '8px 12px',
    borderRadius: '10px',
    fontFamily: "'Public Sans', sans-serif",
    fontSize: '13px',
    background: type === 'error'
      ? 'rgba(139, 0, 0, 0.07)'
      : 'rgba(77, 72, 35, 0.08)',
    color: type === 'error' ? '#8B0000' : '#4D4823',
    border: `1px solid ${type === 'error' ? 'rgba(139,0,0,0.2)' : 'rgba(77,72,35,0.25)'}`,
  }),
  // Mobile toggle bar
  mobileToggle: {
    display: 'flex',
    borderBottom: '1px solid rgba(104, 40, 55, 0.14)',
    padding: '0.625rem 1rem',
    gap: '0.5rem',
    background: 'var(--bg)',
    flexShrink: 0,
  },
  mobileTabBtn: (active: boolean) => ({
    flex: 1,
    padding: '8px',
    borderRadius: '999px',
    border: `1px solid ${active ? '#E59090' : 'rgba(104, 40, 55, 0.18)'}`,
    background: active ? '#E59090' : 'transparent',
    color: active ? '#FAF6EB' : '#52301A',
    fontFamily: "'Public Sans', sans-serif",
    fontWeight: active ? 600 : 400,
    fontSize: '13px',
    cursor: 'pointer',
    transition: 'all 0.15s',
  }),
  modalOverlay: {
    position: 'fixed' as const,
    inset: 0,
    background: 'rgba(82, 48, 26, 0.24)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1rem',
    zIndex: 40,
  },
  modalCard: {
    width: 'min(480px, 100%)',
    background: '#FAF6EB',
    borderRadius: '24px',
    border: '1px solid rgba(104, 40, 55, 0.14)',
    boxShadow: '0 18px 40px rgba(82, 48, 26, 0.18)',
    padding: '1.1rem',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '1rem',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '0.75rem',
  },
  modalTitleWrap: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.3rem',
  },
  modalEyebrow: {
    fontFamily: "'Public Sans', sans-serif",
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
    color: 'var(--color-pink)',
  },
  modalTitle: {
    margin: 0,
    fontFamily: "'Alice', serif",
    fontSize: '26px',
    fontWeight: 400,
    lineHeight: 1.05,
    color: 'var(--color-burgundy)',
  },
  modalText: {
    margin: 0,
    fontFamily: "'Public Sans', sans-serif",
    fontSize: '13px',
    lineHeight: 1.5,
    color: 'var(--color-brown)',
    opacity: 0.8,
  },
  modalCloseBtn: {
    border: 'none',
    background: 'rgba(255, 255, 255, 0.7)',
    borderRadius: '999px',
    width: '32px',
    height: '32px',
    color: 'var(--color-burgundy)',
    cursor: 'pointer',
    fontSize: '16px',
    flexShrink: 0,
  },
  optionGroup: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.5rem',
  },
  optionRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '0.5rem',
  },
  optionBtn: (active: boolean) => ({
    padding: '0.75rem',
    borderRadius: '14px',
    border: `1px solid ${active ? '#E59090' : 'rgba(104, 40, 55, 0.16)'}`,
    background: active ? 'rgba(229, 144, 144, 0.18)' : 'rgba(255, 255, 255, 0.72)',
    color: 'var(--color-burgundy)',
    fontFamily: "'Public Sans', sans-serif",
    fontSize: '13px',
    fontWeight: active ? 600 : 500,
    cursor: 'pointer',
    textAlign: 'left' as const,
    boxShadow: active ? '0 4px 12px rgba(229, 144, 144, 0.18)' : 'none',
  }),
  optionBtnDisabled: {
    opacity: 0.42,
    cursor: 'not-allowed',
    background: 'rgba(82, 48, 26, 0.06)',
    color: 'rgba(82, 48, 26, 0.7)',
    boxShadow: 'none',
  },
  modalFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '0.75rem',
  },
  ghostBtn: {
    flex: 1,
    padding: '11px 12px',
    borderRadius: '999px',
    border: '1px solid rgba(104, 40, 55, 0.18)',
    background: 'rgba(255, 255, 255, 0.7)',
    color: 'var(--color-brown)',
    fontFamily: "'Public Sans', sans-serif",
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
  },
};

// ── Component ─────────────────────────────────────────────────────────────────

const POSPage: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartEntry[]>([]);
  const [customizingProduct, setCustomizingProduct] = useState<Product | null>(null);
  const [selectedMilk, setSelectedMilk] = useState<MilkOption | null>(null);
  const [selectedSugar, setSelectedSugar] = useState<SugarOption | null>(null);
  const [selectedWarmUp, setSelectedWarmUp] = useState<WarmUpOption | null>(null);
  const [selectedPostcardVariant, setSelectedPostcardVariant] = useState<'bw' | 'colour' | null>(null);
  const [makingSetForProduct, setMakingSetForProduct] = useState<CartItem | null>(null);
  const [bestieSetStep, setBestieSetStep] = useState<0 | 1 | 2 | 3>(0);
  const [bestieSetDraft, setBestieSetDraft] = useState<Partial<BestieSetCartItem>>({ type: 'bestie_set' });
  const [bestieCustomizingProduct, setBestieCustomizingProduct] = useState<Product | null>(null);
  const [bestieSelectedMilk, setBestieSelectedMilk] = useState<MilkOption | null>(null);
  const [bestieSelectedSugar, setBestieSelectedSugar] = useState<SugarOption | null>(null);
  const [editingPriceKey, setEditingPriceKey] = useState<string | null>(null);
  const [editingPriceValue, setEditingPriceValue] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [orderType, setOrderType] = useState<OrderType>('dine_in');
  const [staffName, setStaffName] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSubmittedOrder, setLastSubmittedOrder] = useState<Pick<Order, 'ticket_number' | 'created_at' | 'total'> | null>(null);
  const [mobileView, setMobileView] = useState<'products' | 'cart'>('products');
  const [isMobile, setIsMobile] = useState(window.innerWidth < 640);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('is_available', true)
        .order('category')
        .order('subcategory')
        .order('sort_order')
        .order('name');
      if (error) setError(error.message);
      else setProducts(data ?? []);
      setLoading(false);
    })();
  }, []);

  const commitCartItem = useCallback((item: Omit<CartItem, 'quantity'>) => {
    setLastSubmittedOrder(null);
    setCart(prev => {
      const idx = prev.findIndex(existing =>
        !isBestieSetCartItem(existing) &&
        existing.product_id === item.product_id &&
        existing.setLabel === item.setLabel &&
        optionsMatch(existing.options, item.options)
      );
      if (idx >= 0) {
        const next = [...prev];
        const existing = next[idx];
        next[idx] = isBestieSetCartItem(existing) ? existing : { ...existing, quantity: existing.quantity + 1 };
        return next;
      }
      return [...prev, { ...item, quantity: 1 }];
    });
    if (isMobile) setMobileView('cart');
  }, [isMobile]);

  const closeCustomization = useCallback(() => {
    setCustomizingProduct(null);
    setSelectedMilk(null);
    setSelectedSugar(null);
    setSelectedWarmUp(null);
    setSelectedPostcardVariant(null);
  }, []);

  const addToCart = useCallback((product: Product) => {
    if (isCustomizable(product, orderType)) {
      setCustomizingProduct(product);
      setSelectedMilk(null);
      setSelectedSugar(null);
      setSelectedWarmUp(null);
      return;
    }

    commitCartItem({
      product_id: product.id,
      name: product.name,
      price: product.price,
    });
  }, [commitCartItem, orderType]);

  const confirmCustomization = useCallback(() => {
    if (!customizingProduct) return;

    if (isPostcard(customizingProduct)) {
      if (!selectedPostcardVariant) return;
      commitCartItem({
        product_id: customizingProduct.id,
        name: customizingProduct.name,
        price: selectedPostcardVariant === 'colour' ? 2.50 : 2.00,
        setLabel: selectedPostcardVariant === 'colour' ? 'Colour' : 'B&W',
      });
      closeCustomization();
      return;
    }

    if (requiresWarmUpOption(customizingProduct, orderType)) {
      if (!selectedWarmUp) return;
      commitCartItem({
        product_id: customizingProduct.id,
        name: customizingProduct.name,
        price: customizingProduct.price,
        options: { warm_up: selectedWarmUp },
      });
      closeCustomization();
      return;
    }

    if (!selectedMilk || (requiresSugarOption(customizingProduct) && !selectedSugar)) return;
    commitCartItem({
      product_id: customizingProduct.id,
      name: customizingProduct.name,
      price: customizingProduct.price,
      options: {
        milk: selectedMilk,
        ...(requiresSugarOption(customizingProduct) && selectedSugar ? { sugar: selectedSugar } : {}),
      },
    });
    closeCustomization();
  }, [closeCustomization, commitCartItem, customizingProduct, orderType, selectedMilk, selectedSugar, selectedWarmUp, selectedPostcardVariant]);

  const updateQty = useCallback((itemKey: string, delta: number) => {
    setLastSubmittedOrder(null);
    setCart(prev =>
      prev
        .map(i => !isBestieSetCartItem(i) && getCartItemKey(i) === itemKey ? { ...i, quantity: i.quantity + delta } : i)
        .filter(i => isBestieSetCartItem(i) || i.quantity > 0)
    );
  }, []);

  const handleMakeSet = useCallback((product: Product) => {
    setLastSubmittedOrder(null);
    const existing = cart.find(item => !isBestieSetCartItem(item) && item.product_id === product.id);
    const targetItem: CartItem = existing && !isBestieSetCartItem(existing)
      ? existing
      : {
        product_id: product.id,
        name: product.name,
        price: product.price,
        quantity: 1,
      };

    setCart(prev => {
      if (existing) return prev;
      return [...prev, targetItem];
    });

    setMakingSetForProduct(targetItem);
    if (isMobile) setMobileView('cart');
  }, [cart, isMobile]);

  const addMakeItASetBite = useCallback((product: Product) => {
    commitCartItem({
      product_id: product.id,
      name: product.name,
      price: 3.50,
      setLabel: 'Make it a Set',
    });
    setMakingSetForProduct(null);
  }, [commitCartItem]);

  const closeBestieSet = useCallback(() => {
    setBestieSetStep(0);
    setBestieSetDraft({ type: 'bestie_set' });
    setBestieCustomizingProduct(null);
    setBestieSelectedMilk(null);
    setBestieSelectedSugar(null);
  }, []);

  const productToBestieSubItem = useCallback((product: Product, options?: ProductOptions): BestieSetSubItem => ({
    product_id: product.id,
    name: product.name,
    price: product.price,
    category: product.category,
    options,
  }), []);

  const commitBestieDrink = useCallback((product: Product, options?: ProductOptions) => {
    const subItem = productToBestieSubItem(product, options);
    setBestieSetDraft(prev => {
      if (bestieSetStep === 1) return { ...prev, drink1: subItem };
      return { ...prev, drink2: subItem };
    });
    setBestieSetStep(bestieSetStep === 1 ? 2 : 3);
    setBestieCustomizingProduct(null);
    setBestieSelectedMilk(null);
    setBestieSelectedSugar(null);
  }, [bestieSetStep, productToBestieSubItem]);

  const selectBestieDrink = useCallback((product: Product) => {
    if (requiresMilkOption(product)) {
      setBestieCustomizingProduct(product);
      setBestieSelectedMilk(null);
      setBestieSelectedSugar(null);
      return;
    }

    commitBestieDrink(product);
  }, [commitBestieDrink]);

  const confirmBestieCustomization = useCallback(() => {
    if (
      !bestieCustomizingProduct ||
      !bestieSelectedMilk ||
      (requiresSugarOption(bestieCustomizingProduct) && !bestieSelectedSugar)
    ) return;

    commitBestieDrink(bestieCustomizingProduct, {
      milk: bestieSelectedMilk,
      ...(requiresSugarOption(bestieCustomizingProduct) && bestieSelectedSugar ? { sugar: bestieSelectedSugar } : {}),
    });
  }, [bestieCustomizingProduct, bestieSelectedMilk, bestieSelectedSugar, commitBestieDrink]);

  const completeBestieSet = useCallback((product: Product) => {
    if (!bestieSetDraft.drink1 || !bestieSetDraft.drink2) return;

    const setItem: BestieSetCartItem = {
      type: 'bestie_set',
      cartKey: `bestie_set::${Date.now()}`,
      setPrice: 18,
      drink1: bestieSetDraft.drink1,
      drink2: bestieSetDraft.drink2,
      bite: productToBestieSubItem(product),
    };

    setLastSubmittedOrder(null);
    setCart(prev => [...prev, setItem]);
    closeBestieSet();
    if (isMobile) setMobileView('cart');
  }, [bestieSetDraft.drink1, bestieSetDraft.drink2, closeBestieSet, isMobile, productToBestieSubItem]);

  const updateCartEntryPrice = useCallback((itemKey: string, price: number) => {
    setLastSubmittedOrder(null);
    setCart(prev => prev.map(item => {
      if (isBestieSetCartItem(item)) {
        return item.cartKey === itemKey ? { ...item, setPrice: price } : item;
      }
      return getCartItemKey(item) === itemKey ? { ...item, price } : item;
    }));
  }, []);

  const commitEditedPrice = useCallback((itemKey: string, quantity = 1) => {
    const parsed = Number.parseFloat(editingPriceValue);
    const nextPrice = Number.isFinite(parsed) ? parsed / quantity : 0;
    updateCartEntryPrice(itemKey, roundPrice(nextPrice));
    setEditingPriceKey(null);
    setEditingPriceValue('');
  }, [editingPriceValue, updateCartEntryPrice]);

  // Derived
  const total = cart.reduce((sum, i) => sum + (isBestieSetCartItem(i) ? i.setPrice : i.price * i.quantity), 0);
  const cartCount = cart.reduce((sum, i) => sum + (isBestieSetCartItem(i) ? 1 : i.quantity), 0);
  const canSubmit = cart.length > 0 && staffName.trim().length > 0 && customerName.trim().length > 0 && !submitting;
  const canConfirmCustomization = customizingProduct && (
    isPostcard(customizingProduct)
      ? selectedPostcardVariant !== null
      : requiresWarmUpOption(customizingProduct, orderType)
        ? selectedWarmUp !== null
        : Boolean(selectedMilk && (!requiresSugarOption(customizingProduct) || selectedSugar))
  );
  const dairyDisabled = customizingProduct ? isOatOnlyLatte(customizingProduct) : false;
  const canConfirmBestieCustomization = Boolean(
    bestieCustomizingProduct &&
    bestieSelectedMilk &&
    (!requiresSugarOption(bestieCustomizingProduct) || bestieSelectedSugar)
  );
  const bestieDairyDisabled = bestieCustomizingProduct ? isOatOnlyLatte(bestieCustomizingProduct) : false;
  const makeItASetBites = products.filter(product => product.category === 'Bites');
  const bestieDrinkProducts = products.filter(product => product.category === 'Matcha' || product.category === 'Filter Coffee');
  const bestieBiteProducts = products.filter(product => product.category === 'Bites');

  const grouped = products.reduce<Record<string, Record<string, Product[]>>>((acc, p) => {
    const subcategory = p.subcategory?.trim() || 'Menu';
    (acc[p.category] ??= {});
    (acc[p.category][subcategory] ??= []).push(p);
    return acc;
  }, {});

  async function handleSubmit() {
    if (!canSubmit) {
      if (!staffName.trim()) setError('Enter your name before completing the sale.');
      else if (!customerName.trim()) setError('Enter the customer name before completing the sale.');
      return;
    }
    setError(null);
    setLastSubmittedOrder(null);
    setSubmitting(true);

    try {
      const orderItems = explodeCartEntries(cart);
      const orderTotal = orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
      const payload = {
        p_staff_name: staffName.trim(),
        p_customer_name: customerName.trim(),
        p_payment_method: paymentMethod,
        p_order_type: orderType,
        p_notes: notes.trim() || null,
        p_subtotal: orderTotal,
        p_total: orderTotal,
        p_items: orderItems.map(item => ({
          product_id: item.product_id,
          name: item.name,
          quantity: item.quantity,
          unit_price: item.price,
          options: item.options,
        })),
      };
      const order = await createOrder(payload);

      if (!order) {
        throw new Error('Unable to create order');
      }

      setCart([]);
      setCustomerName('');
      setNotes('');
      setPaymentMethod('cash');
      setOrderType('dine_in');
      setLastSubmittedOrder(order as Pick<Order, 'ticket_number' | 'created_at' | 'total'>);
      if (isMobile) setMobileView('products');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to create order');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Render helpers ──────────────────────────────────────────────────────────

  const renderEditablePrice = (itemKey: string, value: number, quantity = 1) => (
    editingPriceKey === itemKey ? (
      <input
        style={s.cartPriceInput}
        type="number"
        min="0"
        step="0.01"
        value={editingPriceValue}
        autoFocus
        onChange={e => setEditingPriceValue(e.target.value)}
        onBlur={() => commitEditedPrice(itemKey, quantity)}
        onKeyDown={e => {
          if (e.key === 'Enter') commitEditedPrice(itemKey, quantity);
          if (e.key === 'Escape') {
            setEditingPriceKey(null);
            setEditingPriceValue('');
          }
        }}
      />
    ) : (
      <button
        style={s.cartPriceBtn}
        onClick={() => {
          setEditingPriceKey(itemKey);
          setEditingPriceValue(value.toFixed(2));
        }}
        aria-label="Edit price"
      >
        ${value.toFixed(2)} ✎
      </button>
    )
  );

  const productPanel = (
    <div style={s.productPanel}>
      {loading && <p style={{ color: 'var(--color-brown)', opacity: 0.6, fontFamily: "'Public Sans', sans-serif", fontSize: '14px' }}>Loading menu…</p>}
      {!loading && products.length === 0 && (
        <p style={{ color: 'var(--color-brown)', opacity: 0.6, fontFamily: "'Public Sans', sans-serif", fontSize: '14px' }}>No available products. Add some in Supabase.</p>
      )}
      {!loading && products.length > 0 && (
        <button
          style={s.bestieSetBtn}
          onClick={() => {
            setBestieSetStep(1);
            setBestieSetDraft({ type: 'bestie_set' });
            setBestieCustomizingProduct(null);
            setBestieSelectedMilk(null);
            setBestieSelectedSugar(null);
          }}
        >
          Bestie Set - $18
        </button>
      )}
      <div style={s.categoryList}>
        {CATEGORY_ORDER.filter(category => grouped[category]).map(category => (
          <div key={category} style={s.categorySection}>
            <div style={s.categoryIntro}>
              <span style={s.categoryEyebrow}>Menu Section</span>
              <p style={s.categoryHeading}>{CATEGORY_META[category].label}</p>
              <p style={s.categoryDescription}>{CATEGORY_META[category].description}</p>
            </div>
            {Object.entries(grouped[category]).map(([subcategory, items]) => (
              <div key={subcategory} style={s.subcategoryBlock}>
                <div style={s.subcategoryHeading}>{subcategory}</div>
                <div style={s.productGrid}>
                  {items.map(p => (
                    <div key={p.id}>
                      <button
                        style={s.productBtn}
                        onClick={() => addToCart(p)}
                        onMouseEnter={e => {
                          (e.currentTarget as HTMLButtonElement).style.borderColor = '#E59090';
                          (e.currentTarget as HTMLButtonElement).style.background = 'rgba(229, 144, 144, 0.15)';
                          (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 2px 10px rgba(229, 144, 144, 0.25)';
                        }}
                        onMouseLeave={e => {
                          (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(104, 40, 55, 0.14)';
                          (e.currentTarget as HTMLButtonElement).style.background = PRODUCT_BTN_BG;
                          (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 1px 6px rgba(82, 48, 26, 0.08)';
                        }}
                      >
                        <span style={s.productName}>{p.name}</span>
                        <span style={s.productPrice}>${p.price.toFixed(2)}</span>
                      </button>
                      {(p.category === 'Matcha' || p.category === 'Filter Coffee') && (
                        <button style={s.setBtn} onClick={() => handleMakeSet(p)}>+ Set</button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
      {customizingProduct && (
        <div style={s.modalOverlay} onClick={closeCustomization}>
          <div style={s.modalCard} onClick={e => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <div style={s.modalTitleWrap}>
                <span style={s.modalEyebrow}>{isPostcard(customizingProduct) ? 'Choose Version' : 'Customize Drink'}</span>
                <h2 style={s.modalTitle}>{customizingProduct.name}</h2>
                <p style={s.modalText}>
                  {isPostcard(customizingProduct)
                    ? 'Select a postcard version to add to cart.'
                    : requiresWarmUpOption(customizingProduct, orderType)
                      ? 'Choose whether this dine-in item should be warmed.'
                      : requiresSugarOption(customizingProduct)
                        ? 'Choose milk and sugar before adding this latte to the cart.'
                        : 'Choose milk before adding this item to the cart.'}
                </p>
              </div>
              <button style={s.modalCloseBtn} onClick={closeCustomization} aria-label="Close customization">x</button>
            </div>

            {isPostcard(customizingProduct) ? (
              <div style={s.optionGroup}>
                <label style={s.label}>Version *</label>
                <div style={s.optionRow}>
                  {([{ value: 'bw', label: 'Black & White', price: 2.00 }, { value: 'colour', label: 'Colour', price: 2.50 }] as const).map(opt => (
                    <button
                      key={opt.value}
                      style={s.optionBtn(selectedPostcardVariant === opt.value)}
                      onClick={() => setSelectedPostcardVariant(opt.value)}
                    >
                      {opt.label} · ${opt.price.toFixed(2)}
                    </button>
                  ))}
                </div>
              </div>
            ) : requiresWarmUpOption(customizingProduct, orderType) ? (
              <div style={s.optionGroup}>
                <label style={s.label}>Warm Up *</label>
                <div style={s.optionRow}>
                  {WARM_UP_OPTIONS.map(option => (
                    <button
                      key={option.value}
                      style={s.optionBtn(selectedWarmUp === option.value)}
                      onClick={() => setSelectedWarmUp(option.value)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                <div style={s.optionGroup}>
                  <label style={s.label}>Milk Type *</label>
                  <div style={s.optionRow}>
                    {MILK_OPTIONS.map(option => (
                      <button
                        key={option.value}
                        style={
                          option.value === 'dairy' && dairyDisabled
                            ? { ...s.optionBtn(false), ...s.optionBtnDisabled }
                            : s.optionBtn(selectedMilk === option.value)
                        }
                        disabled={option.value === 'dairy' && dairyDisabled}
                        onClick={() => {
                          if (option.value === 'dairy' && dairyDisabled) return;
                          setSelectedMilk(option.value);
                        }}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
                {requiresSugarOption(customizingProduct) && (
                  <div style={s.optionGroup}>
                    <label style={s.label}>Sugar Level *</label>
                    <div style={s.optionRow}>
                      {SUGAR_OPTIONS.map(option => (
                        <button
                          key={option.value}
                          style={s.optionBtn(selectedSugar === option.value)}
                          onClick={() => setSelectedSugar(option.value)}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            <div style={s.modalFooter}>
              <button style={s.ghostBtn} onClick={closeCustomization}>Cancel</button>
              <button
                style={s.submitBtn(!canConfirmCustomization)}
                disabled={!canConfirmCustomization}
                onClick={confirmCustomization}
              >
                {isPostcard(customizingProduct) && selectedPostcardVariant
                  ? `Add to Cart · $${(selectedPostcardVariant === 'colour' ? 2.50 : 2.00).toFixed(2)}`
                  : `Add to Cart · $${customizingProduct.price.toFixed(2)}`}
              </button>
            </div>
          </div>
        </div>
      )}
      {makingSetForProduct && (
        <div style={s.modalOverlay} onClick={() => setMakingSetForProduct(null)}>
          <div style={s.modalCard} onClick={e => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <div style={s.modalTitleWrap}>
                <span style={s.modalEyebrow}>Make it a Set</span>
                <h2 style={s.modalTitle}>Make it a Set add a bite for +$3.50</h2>
                <p style={s.modalText}>{makingSetForProduct.name}</p>
              </div>
              <button style={s.modalCloseBtn} onClick={() => setMakingSetForProduct(null)} aria-label="Close make it a set">
                x
              </button>
            </div>
            <div style={s.optionGroup}>
              {makeItASetBites.map(product => (
                <button key={product.id} style={s.optionBtn(false)} onClick={() => addMakeItASetBite(product)}>
                  {product.name} - $3.50
                </button>
              ))}
            </div>
            <div style={s.modalFooter}>
              <button style={s.ghostBtn} onClick={() => setMakingSetForProduct(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
      {bestieSetStep > 0 && (
        <div style={s.modalOverlay} onClick={closeBestieSet}>
          <div style={s.modalCard} onClick={e => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <div style={s.modalTitleWrap}>
                <span style={s.modalEyebrow}>Bestie Set</span>
                <h2 style={s.modalTitle}>
                  {bestieSetStep === 1 ? 'Pick drink 1' : bestieSetStep === 2 ? 'Pick drink 2' : 'Pick a bite'}
                </h2>
                <p style={s.modalText}>Bestie Set - $18</p>
              </div>
              <button style={s.modalCloseBtn} onClick={closeBestieSet} aria-label="Close bestie set">
                x
              </button>
            </div>

            {bestieSetStep < 3 && (
              <div style={s.optionGroup}>
                <div style={s.optionRow}>
                  {bestieDrinkProducts.map(product => (
                    <button key={product.id} style={s.optionBtn(bestieCustomizingProduct?.id === product.id)} onClick={() => selectBestieDrink(product)}>
                      {product.name} - ${product.price.toFixed(2)}
                    </button>
                  ))}
                </div>
                {bestieCustomizingProduct && (
                  <>
                    <div style={s.optionGroup}>
                      <label style={s.label}>Milk Type *</label>
                      <div style={s.optionRow}>
                        {MILK_OPTIONS.map(option => (
                          <button
                            key={option.value}
                            style={
                              option.value === 'dairy' && bestieDairyDisabled
                                ? { ...s.optionBtn(false), ...s.optionBtnDisabled }
                                : s.optionBtn(bestieSelectedMilk === option.value)
                            }
                            disabled={option.value === 'dairy' && bestieDairyDisabled}
                            onClick={() => {
                              if (option.value === 'dairy' && bestieDairyDisabled) return;
                              setBestieSelectedMilk(option.value);
                            }}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    {requiresSugarOption(bestieCustomizingProduct) && (
                      <div style={s.optionGroup}>
                        <label style={s.label}>Sugar Level *</label>
                        <div style={s.optionRow}>
                          {SUGAR_OPTIONS.map(option => (
                            <button
                              key={option.value}
                              style={s.optionBtn(bestieSelectedSugar === option.value)}
                              onClick={() => setBestieSelectedSugar(option.value)}
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    <button
                      style={s.submitBtn(!canConfirmBestieCustomization)}
                      disabled={!canConfirmBestieCustomization}
                      onClick={confirmBestieCustomization}
                    >
                      Confirm Drink
                    </button>
                  </>
                )}
              </div>
            )}

            {bestieSetStep === 3 && (
              <div style={s.optionGroup}>
                {bestieBiteProducts.map(product => (
                  <button key={product.id} style={s.optionBtn(false)} onClick={() => completeBestieSet(product)}>
                    {product.name} - ${product.price.toFixed(2)}
                  </button>
                ))}
              </div>
            )}

            <div style={s.modalFooter}>
              <button
                style={s.ghostBtn}
                onClick={() => {
                  setBestieCustomizingProduct(null);
                  setBestieSelectedMilk(null);
                  setBestieSelectedSugar(null);
                  if (bestieSetStep === 1) closeBestieSet();
                  else setBestieSetStep((bestieSetStep - 1) as 0 | 1 | 2 | 3);
                }}
              >
                Back
              </button>
              <button style={s.ghostBtn} onClick={closeBestieSet}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const cartPanel = (
    <div style={isMobile ? { ...s.cartPanel, width: '100%', minWidth: 0 } : s.cartPanel}>
      <div style={s.cartHeader}>
        <span style={s.cartTitle}>Cart{cartCount > 0 ? ` (${cartCount})` : ''}</span>
        {cart.length > 0 && (
          <button
            style={s.clearBtn}
            onClick={() => {
              setLastSubmittedOrder(null);
              setCart([]);
            }}
          >
            Clear all
          </button>
        )}
      </div>

      <div style={s.cartItems}>
        {cart.length === 0
          ? <p style={s.emptyCart}>Tap a product to add it.</p>
          : cart.map(item => {
            if (isBestieSetCartItem(item)) {
              return (
                <div key={item.cartKey} style={s.bestieCartItem}>
                  <div style={s.bestieCartHeader}>
                    <span style={s.cartItemName}>Bestie Set</span>
                    {renderEditablePrice(item.cartKey, item.setPrice)}
                    <button
                      style={s.qtyBtn}
                      onClick={() => {
                        setLastSubmittedOrder(null);
                        setCart(prev => prev.filter(entry => !isBestieSetCartItem(entry) || entry.cartKey !== item.cartKey));
                      }}
                    >
                      x
                    </button>
                  </div>
                  <span style={s.bestieSubItem}>{formatSubItemOptions(item.drink1)}</span>
                  <span style={s.bestieSubItem}>{formatSubItemOptions(item.drink2)}</span>
                  <span style={s.bestieSubItem}>{item.bite.name}</span>
                </div>
              );
            }

            const itemKey = getCartItemKey(item);
            return (
              <div key={itemKey} style={s.cartItem}>
                <span style={s.cartItemName}>
                  {item.name}
                  {item.setLabel && (
                    <span style={s.cartItemMeta}>{item.setLabel}</span>
                  )}
                  {formatOptionLabel(item) && (
                    <span style={s.cartItemMeta}>{formatOptionLabel(item)}</span>
                  )}
                </span>
                <button style={s.qtyBtn} onClick={() => updateQty(itemKey, -1)}>-</button>
                <span style={s.qtyNum}>{item.quantity}</span>
                <button style={s.qtyBtn} onClick={() => updateQty(itemKey, 1)}>+</button>
                {renderEditablePrice(itemKey, item.price * item.quantity, item.quantity)}
              </div>
            );
          })
        }
      </div>

      <div style={s.cartFooter}>
        <div style={s.totalRow}>
          <span style={s.totalLabel}>Total</span>
          <span style={s.totalAmount}>${total.toFixed(2)}</span>
        </div>

        <div>
          <label style={s.label}>Order Type</label>
          <div style={s.orderTypeGroup}>
            <button
              style={s.orderTypeBtn(orderType === 'dine_in')}
              onClick={() => setOrderType('dine_in')}
            >
              Dine In
            </button>
            <button
              style={s.orderTypeBtn(orderType === 'takeaway')}
              onClick={() => setOrderType('takeaway')}
            >
              Takeaway
            </button>
          </div>
        </div>

        <div>
          <label style={s.label}>Payment</label>
          <div style={s.paymentGroup}>
            {(['cash', 'card', 'other'] as PaymentMethod[]).map(m => (
              <button
                key={m}
                style={s.paymentBtn(paymentMethod === m)}
                onClick={() => setPaymentMethod(m)}
              >
                {m.charAt(0).toUpperCase() + m.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label style={s.label} htmlFor="customer-name">Customer name *</label>
          <input
            id="customer-name"
            style={s.input}
            value={customerName}
            onChange={e => setCustomerName(e.target.value)}
            placeholder="e.g. Marcus"
          />
        </div>

        <div>
          <label style={s.label} htmlFor="staff-name">Your name *</label>
          <input
            id="staff-name"
            style={s.input}
            value={staffName}
            onChange={e => setStaffName(e.target.value)}
            placeholder="e.g. Joy"
          />
        </div>

        <div>
          <label style={s.label} htmlFor="notes">Notes</label>
          <input
            id="notes"
            style={s.input}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="e.g. discount applied"
          />
        </div>

        {error && <div style={s.alert('error')}>{error}</div>}
        {lastSubmittedOrder && (
          <div style={s.alert('success')}>
            Order {lastSubmittedOrder.ticket_number} created for ${Number(lastSubmittedOrder.total).toFixed(2)}.
            {' '}
            {new Date(lastSubmittedOrder.created_at).toLocaleString()}
          </div>
        )}

        <button
          style={s.submitBtn(!canSubmit)}
          disabled={!canSubmit}
          onClick={handleSubmit}
        >
          {submitting ? 'Creating Order…' : `Create Order · $${total.toFixed(2)}`}
        </button>
      </div>
    </div>
  );

  // ── Layout ──────────────────────────────────────────────────────────────────

  if (isMobile) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', textAlign: 'left' }}>
        <div style={s.mobileToggle}>
          <button style={s.mobileTabBtn(mobileView === 'products')} onClick={() => setMobileView('products')}>
            Menu
          </button>
          <button style={s.mobileTabBtn(mobileView === 'cart')} onClick={() => setMobileView('cart')}>
            Cart{cartCount > 0 ? ` · ${cartCount}` : ''}
          </button>
        </div>
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
          {mobileView === 'products' ? productPanel : cartPanel}
        </div>
      </div>
    );
  }

  return (
    <div style={s.root}>
      {productPanel}
      {cartPanel}
    </div>
  );
};

export default POSPage;
