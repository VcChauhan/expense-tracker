'use client';

import { useMemo } from 'react';
import { Expense, formatINR, CreditCard as CreditCardType } from '@/lib/types';
import { PaymentMethodBadge } from './PaymentMethodSelector';
import { CreditCard } from 'lucide-react';

interface PaymentMethodBreakdownCardProps {
  expenses: Expense[];
  selectedMonth?: number; // 0-indexed (0=Jan, 8=Sept)
  selectedYear?: number;
  viewMode?: 'monthly' | 'annual';
  creditCards?: CreditCardType[];
}

function normalizeMethod(raw: string, cards: CreditCardType[] = []): string {
  if (!raw) return 'upi';
  if (raw === 'cash') return 'cash';
  if (raw.startsWith('credit_card')) {
    const rawSuffix = raw.includes(':') ? raw.split(':')[1].trim() : '';
    const digits = rawSuffix.replace(/^xx/i, '');

    if (cards.length > 0) {
      const matched = cards.find(c =>
        (c.last4 && digits && c.last4 === digits) ||
        (c.id && (c.id === rawSuffix || c.id === digits))
      );
      if (matched) {
        return `credit_card:${matched.last4 || matched.id}`;
      }
      if (cards.length === 1) {
        return `credit_card:${cards[0].last4 || cards[0].id}`;
      }
    }
    if (digits) {
      return `credit_card:${digits}`;
    }
    return 'credit_card';
  }
  return 'upi';
}

export function PaymentMethodBreakdownCard({ expenses, selectedMonth, selectedYear, viewMode = 'monthly', creditCards = [] }: PaymentMethodBreakdownCardProps) {
  const { breakdown, total } = useMemo(() => {
    const map: Record<string, number> = {};
    let grandTotal = 0;

    // Filter expenses by selected month / year if provided
    const filteredExpenses = expenses.filter(exp => {
      if (!exp.date) return false;
      const parts = exp.date.split('-');
      if (parts.length < 3) return false;
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1; // Convert YYYY-MM-DD MM to 0-indexed

      if (selectedYear !== undefined && y !== selectedYear) return false;
      if (viewMode === 'monthly' && selectedMonth !== undefined && m !== selectedMonth) return false;
      return true;
    });

    filteredExpenses.forEach(exp => {
      const methodKey = normalizeMethod(exp.paymentMethod || 'upi', creditCards);
      map[methodKey] = (map[methodKey] ?? 0) + exp.amount;
      grandTotal += exp.amount;
    });

    const list = Object.entries(map)
      .map(([method, amount]) => ({
        method,
        amount,
        pct: grandTotal > 0 ? (amount / grandTotal) * 100 : 0
      }))
      .filter(item => item.amount > 0)
      .sort((a, b) => b.amount - a.amount);

    return { breakdown: list, total: grandTotal };
  }, [expenses, selectedMonth, selectedYear, viewMode, creditCards]);

  if (breakdown.length === 0) return null;

  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 20, padding: 20, marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'color-mix(in srgb, var(--accent) 15%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
            <CreditCard size={18} />
          </div>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Payment Breakdown</h3>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>
              {viewMode === 'annual' ? 'Annual accumulated total' : 'Monthly accumulated total'}
            </p>
          </div>
        </div>
        <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--accent)' }}>
          {formatINR(total)}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {breakdown.map(item => {
          const matchedCard = creditCards.find(c => item.method === `credit_card:${c.last4}` || item.method === `credit_card:${c.id}`);
          const color = matchedCard?.color || (item.method.startsWith('credit_card') ? '#3B82F6' : item.method === 'cash' ? '#EC4899' : '#10B981');

          return (
            <div key={item.method} style={{
              background: 'var(--bg-elevated)',
              borderRadius: 14,
              padding: '12px 14px',
              border: '1px solid var(--border)',
              borderLeft: `3.5px solid ${color}`,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              transition: 'all 0.2s ease',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <PaymentMethodBadge method={item.method} creditCards={creditCards} />
                <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--text-primary)' }}>
                  {formatINR(item.amount)} <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>({item.pct.toFixed(0)}%)</span>
                </div>
              </div>
              <div style={{ height: 5, background: 'var(--bg-card)', borderRadius: 99, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${item.pct}%`, background: color, borderRadius: 99, transition: 'width 0.5s ease' }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
