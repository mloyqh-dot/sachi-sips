import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { Product } from '../../types';

const MERCH_SUBCATEGORIES = [
  'Sachi Sips Collection',
  'Esther House Collection',
  'Friends of Sachi Collection',
] as const;

const s = {
  page: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '1.5rem',
    background: 'linear-gradient(135deg, rgba(229, 144, 144, 0.18), rgba(240, 228, 191, 0.96) 42%, rgba(255, 227, 115, 0.18))',
  },
  shell: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '1.25rem',
    maxWidth: '1120px',
    margin: '0 auto',
  },
  hero: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.3rem',
    padding: '1.15rem 1.25rem',
    borderRadius: '26px',
    background: 'rgba(240, 228, 191, 0.76)',
    border: '1px solid rgba(104, 40, 55, 0.14)',
    boxShadow: '0 14px 34px rgba(82, 48, 26, 0.1)',
  },
  title: {
    fontFamily: "'Alice', serif",
    fontSize: '34px',
    fontWeight: 400,
    color: 'var(--color-burgundy)',
    margin: 0,
    lineHeight: 1,
  },
  subtitle: {
    fontFamily: "'Public Sans', sans-serif",
    fontSize: '14px',
    color: 'var(--color-brown)',
    opacity: 0.82,
  },
  helper: {
    marginTop: '0.4rem',
    fontFamily: "'Public Sans', sans-serif",
    fontSize: '12px',
    color: 'var(--color-brown)',
    opacity: 0.72,
  },
  section: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.85rem',
    padding: '1rem',
    borderRadius: '24px',
    background: 'rgba(255, 255, 255, 0.36)',
    border: '1px solid rgba(104, 40, 55, 0.12)',
    boxShadow: '0 8px 22px rgba(82, 48, 26, 0.07)',
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: '0.75rem',
    flexWrap: 'wrap' as const,
  },
  sectionTitle: {
    fontFamily: "'Alice', serif",
    fontSize: '22px',
    fontWeight: 400,
    color: 'var(--color-burgundy)',
    margin: 0,
  },
  count: {
    fontFamily: "'Public Sans', sans-serif",
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
    color: 'var(--color-pink)',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
    gap: '0.75rem',
  },
  card: {
    minHeight: '112px',
    display: 'flex',
    flexDirection: 'column' as const,
    justifyContent: 'space-between',
    gap: '0.8rem',
    padding: '0.9rem',
    borderRadius: '18px',
    background: 'rgba(240, 228, 191, 0.72)',
    border: '1px solid rgba(104, 40, 55, 0.13)',
    boxShadow: '0 2px 10px rgba(82, 48, 26, 0.08)',
  },
  label: {
    alignSelf: 'flex-start',
    padding: '0.23rem 0.58rem',
    borderRadius: '999px',
    background: 'rgba(229, 144, 144, 0.18)',
    color: 'var(--color-burgundy)',
    fontFamily: "'Public Sans', sans-serif",
    fontSize: '10px',
    fontWeight: 700,
    letterSpacing: '0.05em',
    textTransform: 'uppercase' as const,
  },
  itemName: {
    fontFamily: "'Public Sans', sans-serif",
    fontSize: '15px',
    fontWeight: 700,
    color: 'var(--color-burgundy)',
    lineHeight: 1.25,
  },
  price: {
    fontFamily: "'Public Sans', sans-serif",
    fontSize: '15px',
    fontWeight: 700,
    color: 'var(--color-pink)',
  },
  state: {
    padding: '1rem 1.25rem',
    borderRadius: '20px',
    background: 'rgba(240, 228, 191, 0.72)',
    border: '1px solid rgba(104, 40, 55, 0.12)',
    fontFamily: "'Public Sans', sans-serif",
    fontSize: '14px',
    color: 'var(--color-brown)',
  },
};

function formatPrice(price: number) {
  return `$${Number(price).toFixed(2)}`;
}

const MerchPage: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchMerch() {
      setIsLoading(true);
      setError(null);

      const { data, error: merchError } = await supabase
        .from('products')
        .select('id, name, price, category, subcategory, sort_order, is_available')
        .eq('category', 'Merch')
        .eq('is_available', true)
        .order('subcategory')
        .order('sort_order')
        .order('name');

      if (!isMounted) return;

      if (merchError) {
        setProducts([]);
        setError(merchError.message);
      } else {
        setProducts((data ?? []) as Product[]);
      }

      setIsLoading(false);
    }

    void fetchMerch();

    return () => {
      isMounted = false;
    };
  }, []);

  const groupedProducts = useMemo(() => {
    return MERCH_SUBCATEGORIES.reduce<Record<string, Product[]>>((acc, subcategory) => {
      acc[subcategory] = products.filter(product => product.subcategory === subcategory);
      return acc;
    }, {});
  }, [products]);

  return (
    <div style={s.page}>
      <div style={s.shell}>
        <header style={s.hero}>
          <h1 style={s.title}>Merch</h1>
          <p style={s.subtitle}>Available collections</p>
          <p style={s.helper}>Reference catalogue only. Add merch from the POS when a customer is ready to purchase.</p>
        </header>

        {isLoading && <div style={s.state}>Loading merch catalogue...</div>}
        {error && <div style={s.state}>Unable to load merch: {error}</div>}
        {!isLoading && !error && products.length === 0 && <div style={s.state}>No merch is currently available.</div>}

        {!isLoading && !error && MERCH_SUBCATEGORIES.map(subcategory => {
          const items = groupedProducts[subcategory] ?? [];

          return (
            <section key={subcategory} style={s.section}>
              <div style={s.sectionHeader}>
                <h2 style={s.sectionTitle}>{subcategory}</h2>
                <span style={s.count}>{items.length} items</span>
              </div>

              {items.length === 0 ? (
                <div style={s.state}>No items in this collection yet.</div>
              ) : (
                <div style={s.grid}>
                  {items.map(product => (
                    <article key={product.id} style={s.card}>
                      <span style={s.label}>{subcategory}</span>
                      <div>
                        <div style={s.itemName}>{product.name}</div>
                        <div style={s.price}>{formatPrice(product.price)}</div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
};

export default MerchPage;
