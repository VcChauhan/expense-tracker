'use client';

import { PaymentMethod } from '@/lib/types';
import { Zap, CreditCard, Landmark, DollarSign, Globe, HelpCircle } from 'lucide-react';

interface PaymentMethodSelectorProps {
  value: PaymentMethod;
  onChange: (method: PaymentMethod) => void;
}

export const PAYMENT_METHODS: { id: PaymentMethod; label: string; icon: any; color: string }[] = [
  { id: 'upi', label: 'UPI', icon: Zap, color: '#10B981' },
  { id: 'credit_card', label: 'Credit Card', icon: CreditCard, color: '#3B82F6' },
  { id: 'debit_card', label: 'Debit Card', icon: Landmark, color: '#8B5CF6' },
  { id: 'netbanking', label: 'NetBanking', icon: Globe, color: '#F59E0B' },
  { id: 'cash', label: 'Cash', icon: DollarSign, color: '#EC4899' },
];

export function PaymentMethodSelector({ value, onChange }: PaymentMethodSelectorProps) {
  return (
    <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
      {PAYMENT_METHODS.map(m => {
        const Icon = m.icon;
        const isSelected = value === m.id;
        return (
          <button
            key={m.id}
            type="button"
            onClick={() => onChange(m.id)}
            style={{
              padding: '6px 12px',
              borderRadius: 9999,
              border: `1px solid ${isSelected ? m.color : 'var(--border)'}`,
              background: isSelected ? `color-mix(in srgb, ${m.color} 15%, transparent)` : 'var(--bg-elevated)',
              color: isSelected ? m.color : 'var(--text-secondary)',
              fontSize: 12,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.2s'
            }}
          >
            <Icon size={14} />
            {m.label}
          </button>
        );
      })}
    </div>
  );
}

export function PaymentMethodBadge({ method }: { method?: PaymentMethod }) {
  const item = PAYMENT_METHODS.find(m => m.id === method) || { id: 'upi', label: 'UPI', icon: Zap, color: '#10B981' };
  const Icon = item.icon;

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      padding: '2px 8px',
      borderRadius: 6,
      background: `color-mix(in srgb, ${item.color} 15%, transparent)`,
      color: item.color,
      fontSize: 11,
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.3px'
    }}>
      <Icon size={11} />
      {item.label}
    </span>
  );
}
