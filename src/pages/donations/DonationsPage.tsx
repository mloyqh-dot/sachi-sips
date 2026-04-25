import React, { useMemo, useState } from 'react';
import type { PaymentMethod } from '../../types';
import { createDonation } from '../../lib/donations';
import { formatCurrency, formatPaymentMethod } from '../../lib/orderHistory';

const paymentMethods: PaymentMethod[] = ['cash', 'card', 'other'];

const s = {
  page: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '1.25rem',
    background: 'linear-gradient(180deg, rgba(240, 228, 191, 0.72) 0%, rgba(250, 246, 235, 0.96) 100%)',
  },
  shell: {
    display: 'grid',
    gridTemplateColumns: 'minmax(280px, 520px) minmax(260px, 1fr)',
    gap: '1rem',
    alignItems: 'start' as const,
  },
  hero: {
    gridColumn: '1 / -1',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.35rem',
    padding: '1.1rem 1.2rem',
    borderRadius: '22px',
    background: 'rgba(255, 250, 240, 0.72)',
    border: '1px solid rgba(104, 40, 55, 0.12)',
    boxShadow: '0 10px 24px rgba(82, 48, 26, 0.08)',
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
    maxWidth: '660px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.9rem',
    padding: '1rem',
    borderRadius: '22px',
    background: 'rgba(255, 252, 246, 0.86)',
    border: '1px solid rgba(104, 40, 55, 0.12)',
    boxShadow: '0 8px 22px rgba(82, 48, 26, 0.07)',
  },
  panel: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.8rem',
    padding: '1rem',
    borderRadius: '22px',
    background: 'rgba(255, 252, 246, 0.76)',
    border: '1px solid rgba(104, 40, 55, 0.12)',
    boxShadow: '0 8px 22px rgba(82, 48, 26, 0.07)',
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
    minHeight: '42px',
    boxSizing: 'border-box' as const,
    borderRadius: '12px',
    border: '1px solid rgba(104, 40, 55, 0.18)',
    background: 'rgba(255, 255, 255, 0.68)',
    color: 'var(--color-burgundy)',
    fontFamily: "'Public Sans', sans-serif",
    fontSize: '15px',
    padding: '0.6rem 0.75rem',
  },
  amountInput: {
    width: '100%',
    minHeight: '64px',
    boxSizing: 'border-box' as const,
    borderRadius: '16px',
    border: '1px solid rgba(104, 40, 55, 0.2)',
    background: 'rgba(255, 255, 255, 0.74)',
    color: 'var(--color-burgundy)',
    fontFamily: "'Alice', serif",
    fontSize: '2rem',
    padding: '0.55rem 0.85rem',
  },
  segmented: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '0.5rem',
  },
  segment: (active: boolean) => ({
    minHeight: '42px',
    borderRadius: '13px',
    border: `1px solid ${active ? 'rgba(104, 40, 55, 0.32)' : 'rgba(104, 40, 55, 0.14)'}`,
    background: active ? 'rgba(229, 144, 144, 0.2)' : 'rgba(255, 255, 255, 0.54)',
    color: active ? 'var(--color-burgundy)' : 'var(--color-brown)',
    fontFamily: "'Public Sans', sans-serif",
    fontSize: '13px',
    fontWeight: 700,
    cursor: 'pointer',
  }),
  button: {
    minHeight: '48px',
    border: 'none',
    borderRadius: '16px',
    background: 'var(--color-burgundy)',
    color: '#FFF7E8',
    fontFamily: "'Public Sans', sans-serif",
    fontSize: '14px',
    fontWeight: 800,
    cursor: 'pointer',
    boxShadow: '0 10px 20px rgba(104, 40, 55, 0.18)',
  },
  buttonDisabled: {
    opacity: 0.48,
    cursor: 'not-allowed',
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
  previewAmount: {
    fontFamily: "'Alice', serif",
    fontSize: '2.4rem',
    color: 'var(--color-burgundy)',
    lineHeight: 1,
  },
  meta: {
    fontFamily: "'Public Sans', sans-serif",
    fontSize: '13px',
    lineHeight: 1.5,
    color: 'var(--color-brown)',
    opacity: 0.82,
  },
};

const DonationsPage: React.FC = () => {
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [staffName, setStaffName] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const numericAmount = useMemo(() => Number(amount), [amount]);
  const canSubmit = Number.isFinite(numericAmount) && numericAmount > 0 && staffName.trim().length > 0 && !submitting;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canSubmit) return;

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const donation = await createDonation({
        amount: numericAmount,
        payment_method: paymentMethod,
        staff_name: staffName.trim(),
        note: note.trim() || null,
      });

      setSuccess(`${formatCurrency(Number(donation.amount))} ${formatPaymentMethod(donation.payment_method)} donation recorded.`);
      setAmount('');
      setNote('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to record donation');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={s.page}>
      <div style={s.shell}>
        <section style={s.hero}>
          <span style={s.eyebrow}>Standalone Gifts</span>
          <h1 style={s.title}>Record Donation</h1>
          <p style={s.subtitle}>
            Capture custom donation amounts separately from sales so the owner dashboard can reconcile them without mixing them into order revenue.
          </p>
        </section>

        <form style={s.form} onSubmit={handleSubmit}>
          <label style={s.field}>
            <span style={s.label}>Amount</span>
            <input
              style={s.amountInput}
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={amount}
              onChange={event => setAmount(event.target.value)}
              placeholder="0.00"
            />
          </label>

          <div style={s.field}>
            <span style={s.label}>Payment</span>
            <div style={s.segmented}>
              {paymentMethods.map(method => (
                <button
                  key={method}
                  type="button"
                  style={s.segment(paymentMethod === method)}
                  onClick={() => setPaymentMethod(method)}
                >
                  {formatPaymentMethod(method)}
                </button>
              ))}
            </div>
          </div>

          <label style={s.field}>
            <span style={s.label}>Staff</span>
            <input
              style={s.input}
              value={staffName}
              onChange={event => setStaffName(event.target.value)}
              placeholder="Who recorded this?"
            />
          </label>

          <label style={s.field}>
            <span style={s.label}>Note</span>
            <input
              style={s.input}
              value={note}
              onChange={event => setNote(event.target.value)}
              placeholder="Optional"
            />
          </label>

          {error && <div style={s.alert}>{error}</div>}
          {success && <div style={s.alert}>{success}</div>}

          <button
            type="submit"
            disabled={!canSubmit}
            style={{ ...s.button, ...(!canSubmit ? s.buttonDisabled : {}) }}
          >
            {submitting ? 'Recording...' : 'Record Donation'}
          </button>
        </form>

        <aside style={s.panel}>
          <span style={s.label}>Current Entry</span>
          <span style={s.previewAmount}>{formatCurrency(Number.isFinite(numericAmount) ? Math.max(numericAmount, 0) : 0)}</span>
          <span style={s.meta}>{formatPaymentMethod(paymentMethod)} donation</span>
          <span style={s.meta}>Staff: {staffName.trim() || 'Not set'}</span>
          {note.trim() && <span style={s.meta}>Note: {note.trim()}</span>}
        </aside>
      </div>
    </div>
  );
};

export default DonationsPage;
