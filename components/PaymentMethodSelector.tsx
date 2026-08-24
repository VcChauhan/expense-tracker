'use client';

import { PaymentMethod } from '@/lib/types';
import { Zap, CreditCard, DollarSign } from 'lucide-react';

interface PaymentMethodSelectorProps {
  value: string; // can be 'upi' | 'credit_card' | 'credit_card:xx1234'
  onChange: (method: PaymentMethod) => void;
}

export const PRIMARY_PAYMENT_METHODS: { id: PaymentMethod; label: string; icon: any; color: string }[] = [
  { id: 'upi', label: 'UPI (Default)', icon: Zap, color: '#10B981' },
  { id: 'credit_card', label: 'Credit Card', icon: CreditCard, color: '#3B82F6' },
  { id: 'cash', label: 'Cash', icon: DollarSign, color: '#EC4899' },
];

export function PaymentMethodSelector({ value, onChange }: PaymentMethodSelectorProps) {
  const selectedBase = value?.startsWith('credit_card') ? 'credit_card' : value === 'cash' ? 'cash' : 'upi';

  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
      {PRIMARY_PAYMENT_METHODS.map(m => {
        const Icon = m.icon;
        const isSelected = selectedBase === m.id;
        return (
          <button
            key={m.id}
            type="button"
            onClick={() => onChange(m.id)}
            style={{
              flex: 1,
              minWidth: 110,
              padding: '10px 14px',
              borderRadius: 14,
              border: `1px solid ${isSelected ? m.color : 'var(--border)'}`,
              background: isSelected ? `color-mix(in srgb, ${m.color} 15%, transparent)` : 'var(--bg-elevated)',
              color: isSelected ? m.color : 'var(--text-secondary)',
              fontSize: 13,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justify: 'center',
              gap: 8,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.2s'
            }}
          >
            <Icon size={16} />
            {m.label}
          </button>
        );
      })}
    </div>
  );
}

export function PaymentMethodBadge({ method }: { method?: string }) {
  const str = method || 'upi';

  if (str.startsWith('credit_card')) {
    const cardDigits = str.includes(':') ? str.split(':')[1] : '';
    return (
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 8px',
        borderRadius: 6,
        background: 'color-mix(in srgb, #3B82F6 15%, transparent)',
        color: '#3B82F6',
        fontSize: 11,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.3px'
      }}>
        <CreditCard size={11} />
        Credit Card {cardDigits ? `(${cardDigits})` : ''}
      </span>
    );
  }

  if (str === 'cash') {
    return (
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 8px',
        borderRadius: 6,
        background: 'color-mix(in srgb, #EC4899 15%, transparent)',
        color: '#EC4899',
        fontSize: 11,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.3px'
      }}>
        <DollarSign size={11} />
        Cash
      </span>
    );
  }

  // Default for all other transactions
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      padding: '2px 8px',
      borderRadius: 6,
      background: 'color-mix(in srgb, #10B981 15%, transparent)',
      color: '#10B981',
      fontSize: 11,
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.3px'
    }}>
      <Zap size={11} />
      UPI
    </span>
  );
}
