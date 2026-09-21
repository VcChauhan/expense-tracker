'use client';

import { PaymentMethod, PaymentMethodValue, CreditCard } from '@/lib/types';
import { Zap, CreditCard as CreditCardIcon, DollarSign } from 'lucide-react';

interface PaymentMethodSelectorProps {
  value: string; // 'upi' | 'credit_card' | 'credit_card:xx1234' | ...
  onChange: (method: PaymentMethodValue) => void;
  creditCards?: CreditCard[];
}

export const PRIMARY_PAYMENT_METHODS: { id: PaymentMethod; label: string; icon: any; color: string }[] = [
  { id: 'upi', label: 'UPI (Default)', icon: Zap, color: '#10B981' },
  { id: 'credit_card', label: 'Credit Card', icon: CreditCardIcon, color: '#3B82F6' },
];

export function PaymentMethodSelector({ value, onChange, creditCards = [] }: PaymentMethodSelectorProps) {
  const selectedBase = value?.startsWith('credit_card') ? 'credit_card' : 'upi';
  const selectedCardLast4 = value?.includes(':') ? value.split(':')[1] : null;

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {PRIMARY_PAYMENT_METHODS.map(m => {
          const Icon = m.icon;
          const isSelected = selectedBase === m.id;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => onChange(m.id === 'credit_card' && creditCards.length > 0 ? `credit_card:${creditCards[0].last4 || creditCards[0].id}` : m.id)}
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
                justifyContent: 'center',
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

      {/* Which saved card? — only shown once Credit Card is the active method */}
      {selectedBase === 'credit_card' && (
        <div style={{ marginTop: 10 }}>
          {creditCards.length === 0 ? (
            <div style={{
              padding: '10px 12px', borderRadius: 12, background: 'var(--bg-elevated)',
              border: '1px dashed var(--border-strong)', fontSize: 12, color: 'var(--text-muted)',
            }}>
              No saved cards yet — add one in Settings to tag this to a specific card.
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 2 }}>
              {creditCards.map(card => {
                const cardKey = card.last4 || card.id;
                const isActive = selectedCardLast4 === cardKey;
                return (
                  <button
                    key={card.id}
                    type="button"
                    onClick={() => onChange(`credit_card:${cardKey}`)}
                    style={{
                      flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6,
                      padding: '8px 12px', borderRadius: 12,
                      border: `1.5px solid ${isActive ? (card.color || '#3B82F6') : 'var(--border)'}`,
                      background: isActive ? `color-mix(in srgb, ${card.color || '#3B82F6'} 14%, transparent)` : 'var(--bg-elevated)',
                      color: isActive ? (card.color || '#3B82F6') : 'var(--text-secondary)',
                      fontSize: 12.5, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
                    }}
                  >
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: card.color || '#3B82F6', flexShrink: 0 }} />
                    {card.name} {card.last4 ? `••${card.last4}` : ''}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function PaymentMethodBadge({ method, creditCards = [] }: { method?: string; creditCards?: CreditCard[] }) {
  const str = method || 'upi';

  if (str.startsWith('credit_card')) {
    const rawSuffix = str.includes(':') ? str.split(':')[1] : '';
    const digits = rawSuffix.replace(/^xx/i, '');

    const matched = creditCards.find(c =>
      (c.last4 && digits && c.last4 === digits) ||
      (c.id && (c.id === rawSuffix || c.id === digits))
    );

    const displayName = matched
      ? `${matched.name} (••${matched.last4})`
      : digits
      ? `Credit Card (••${digits})`
      : 'Credit Card';

    const cardColor = matched?.color || '#3B82F6';

    return (
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '2px 8px',
        borderRadius: 6,
        background: `color-mix(in srgb, ${cardColor} 15%, transparent)`,
        color: cardColor,
        fontSize: 11,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.3px'
      }}>
        <CreditCardIcon size={11} />
        {displayName}
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
