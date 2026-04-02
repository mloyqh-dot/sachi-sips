import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import type {
  Product,
  CartItem,
  PaymentMethod,
  MilkOption,
  SugarOption,
  ProductOptions,
  Order,
} from '../../types';

// ── Styles ────────────────────────────────────────────────────────────────────

const PRODUCT_BTN_BG = 'rgba(255, 255, 255, 0.58)';
const CATEGORY_ORDER = ['Matcha', 'Coffee', 'Specials', 'Savory', 'Bakery'] as const;
const CATEGORY_META = {
  Matcha: {
    label: 'Matcha & Hojicha Lattes',
    description: 'Signature tea drinks and fruit-led matcha blends.',
  },
  Coffee: {
    label: 'Specialty Coffee',
    description: 'Single-origin pours served hot or iced.',
  },
  Specials: {
    label: 'Featured Drinks',
    description: 'Flights and limited-format pours for curious guests.',
  },
  Savory: {
    label: 'Savory Bites',
    description: 'Quick hot snacks suited for event service.',
  },
  Bakery: {
    label: 'Bakery & Sweets',
    description: 'Pastries and small baked treats.',
  },
} as const;
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

function isCustomizableLatte(product: Product) {
  return /matcha latte|hojicha latte/i.test(product.name);
}

function isOatOnlyLatte(product: Product) {
  return /banana hojicha latte/i.test(product.name);
}

function optionsMatch(a?: ProductOptions, b?: ProductOptions) {
  return a?.milk === b?.milk && a?.sugar === b?.sugar;
}

function getCartItemKey(item: CartItem) {
  const milk = item.options?.milk ?? 'none';
  const sugar = item.options?.sugar ?? 'none';
  return `${item.product_id}::${milk}::${sugar}`;
}

function formatOptionLabel(item: CartItem) {
  if (!item.options) return null;

  const milkLabel = MILK_OPTIONS.find(option => option.value === item.options?.milk)?.label;
  const sugarLabel = SUGAR_OPTIONS.find(option => option.value === item.options?.sugar)?.label;
  return [milkLabel, sugarLabel].filter(Boolean).join(' · ');
}

async function createOrder(payload: {
  p_staff_name: string;
  p_payment_method: PaymentMethod;
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
  const isLocalDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

  if (!isLocalDev) {
    const response = await fetch('/api/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        staffName: payload.p_staff_name,
        paymentMethod: payload.p_payment_method,
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

    return result?.order;
  }

  const { data, error } = await supabase.rpc('create_order', payload);

  if (error) {
    throw new Error(error.message || 'Unable to create order');
  }

  return Array.isArray(data) ? data[0] : data;
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
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customizingProduct, setCustomizingProduct] = useState<Product | null>(null);
  const [selectedMilk, setSelectedMilk] = useState<MilkOption | null>(null);
  const [selectedSugar, setSelectedSugar] = useState<SugarOption | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [staffName, setStaffName] = useState('');
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
        existing.product_id === item.product_id && optionsMatch(existing.options, item.options)
      );
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 };
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
  }, []);

  const addToCart = useCallback((product: Product) => {
    if (isCustomizableLatte(product)) {
      setCustomizingProduct(product);
      setSelectedMilk(null);
      setSelectedSugar(null);
      return;
    }

    commitCartItem({
      product_id: product.id,
      name: product.name,
      price: product.price,
    });
  }, [commitCartItem]);

  const confirmCustomization = useCallback(() => {
    if (!customizingProduct || !selectedMilk || !selectedSugar) return;

    commitCartItem({
      product_id: customizingProduct.id,
      name: customizingProduct.name,
      price: customizingProduct.price,
      options: {
        milk: selectedMilk,
        sugar: selectedSugar,
      },
    });
    closeCustomization();
  }, [closeCustomization, commitCartItem, customizingProduct, selectedMilk, selectedSugar]);

  const updateQty = useCallback((itemKey: string, delta: number) => {
    setLastSubmittedOrder(null);
    setCart(prev =>
      prev
        .map(i => getCartItemKey(i) === itemKey ? { ...i, quantity: i.quantity + delta } : i)
        .filter(i => i.quantity > 0)
    );
  }, []);

  // Derived
  const total = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const cartCount = cart.reduce((sum, i) => sum + i.quantity, 0);
  const canSubmit = cart.length > 0 && staffName.trim().length > 0 && !submitting;
  const canConfirmCustomization = Boolean(selectedMilk && selectedSugar);
  const dairyDisabled = customizingProduct ? isOatOnlyLatte(customizingProduct) : false;

  const grouped = products.reduce<Record<string, Record<string, Product[]>>>((acc, p) => {
    const subcategory = p.subcategory?.trim() || 'Menu';
    (acc[p.category] ??= {});
    (acc[p.category][subcategory] ??= []).push(p);
    return acc;
  }, {});

  async function handleSubmit() {
    if (!canSubmit) {
      if (!staffName.trim()) setError('Enter your name before completing the sale.');
      return;
    }
    setError(null);
    setLastSubmittedOrder(null);
    setSubmitting(true);

    try {
      const payload = {
        p_staff_name: staffName.trim(),
        p_payment_method: paymentMethod,
        p_notes: notes.trim() || null,
        p_subtotal: total,
        p_total: total,
        p_items: cart.map(item => ({
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
      setNotes('');
      setPaymentMethod('cash');
      setLastSubmittedOrder(order as Pick<Order, 'ticket_number' | 'created_at' | 'total'>);
      if (isMobile) setMobileView('products');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to create order');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Render helpers ──────────────────────────────────────────────────────────

  const productPanel = (
    <div style={s.productPanel}>
      {loading && <p style={{ color: 'var(--color-brown)', opacity: 0.6, fontFamily: "'Public Sans', sans-serif", fontSize: '14px' }}>Loading menu…</p>}
      {!loading && products.length === 0 && (
        <p style={{ color: 'var(--color-brown)', opacity: 0.6, fontFamily: "'Public Sans', sans-serif", fontSize: '14px' }}>No available products. Add some in Supabase.</p>
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
                    <button
                      key={p.id}
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
                <span style={s.modalEyebrow}>Customize Drink</span>
                <h2 style={s.modalTitle}>{customizingProduct.name}</h2>
                <p style={s.modalText}>Choose milk and sugar before adding this latte to the cart.</p>
              </div>
              <button style={s.modalCloseBtn} onClick={closeCustomization} aria-label="Close customization">
                x
              </button>
            </div>

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

            <div style={s.modalFooter}>
              <button style={s.ghostBtn} onClick={closeCustomization}>Cancel</button>
              <button
                style={s.submitBtn(!canConfirmCustomization)}
                disabled={!canConfirmCustomization}
                onClick={confirmCustomization}
              >
                Add to Cart · ${customizingProduct.price.toFixed(2)}
              </button>
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
          : cart.map(item => (
            <div key={getCartItemKey(item)} style={s.cartItem}>
              <span style={s.cartItemName}>
                {item.name}
                {formatOptionLabel(item) && (
                  <span style={s.cartItemMeta}>{formatOptionLabel(item)}</span>
                )}
              </span>
              <button style={s.qtyBtn} onClick={() => updateQty(getCartItemKey(item), -1)}>-</button>
              <span style={s.qtyNum}>{item.quantity}</span>
              <button style={s.qtyBtn} onClick={() => updateQty(getCartItemKey(item), 1)}>+</button>
              <span style={s.cartItemPrice}>${(item.price * item.quantity).toFixed(2)}</span>
            </div>
          ))
        }
      </div>

      <div style={s.cartFooter}>
        <div style={s.totalRow}>
          <span style={s.totalLabel}>Total</span>
          <span style={s.totalAmount}>${total.toFixed(2)}</span>
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
