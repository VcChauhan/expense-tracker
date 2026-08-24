'use client';

import { useMemo } from 'react';
import { Expense, formatINR } from '@/lib/types';
import { PAYMENT_METHODS, PaymentMethodBadge } from './PaymentMethodSelector';
import { CreditCard } from 'lucide-react';

interface PaymentMethodBreakdownCardProps {
  expenses: Expense[];
}

export function PaymentMethodBreakdownCard({ expenses }: PaymentMethodBreakdownCardProps) {
  const { breakdown, total } = useMemo(() => {
    const map: Record<string, number> = {
      upi: 0,
      credit_card: 0,
      debit_card: 0,
      netbanking: 0,
      cash: 0,
      other: 0,
    };

    let grandTotal = 0;
    expenses.forEach(exp => {
      const method = exp.paymentMethod || 'upi';
      map[method] = (map[method] ?? 0) + exp.amount;
      grandTotal += exp.amount;
    });

    const list = Object.entries(map)
      .map(([method, amount]) => ({
        method: method as any,
        amount,
        pct: grandTotal > 0 ? (amount / grandTotal) * 100 : 0
      }))
      .filter(item => item.amount > 0)
      .sort((a, b) => b.amount - a.amount);

    return { breakdown: list, total: grandTotal };
  }, [expenses]);

  if (breakdown.length === 0) return null;

  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 20, padding: 20, marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'color-mix(in srgb, var(--accent) 15%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
          <CreditCard size={18} />
        </div>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Payment Method Breakdown</h3>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>Credit Card vs UPI vs Debit Card split</p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {breakdown.map(item => {
          const info = PAYMENT_METHODS.find(m => m.id === item.method) || { label: item.method, color: 'var(--accent)' };
          return (
            <div key={item.method}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <PaymentMethodBadge method={item.method} />
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                  {formatINR(item.amount)} <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-muted)' }}>({item.pct.toFixed(0)}%)</span>
                </div>
              </div>
              <div style={{ height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${item.pct}%`, background: info.color, borderRadius: 3, transition: 'width 0.5s ease' }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
