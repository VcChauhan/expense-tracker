'use client';

import { useMemo } from 'react';
import { Expense, formatINR } from '@/lib/types';
import { PaymentMethodBadge } from './PaymentMethodSelector';
import { CreditCard } from 'lucide-react';

interface PaymentMethodBreakdownCardProps {
  expenses: Expense[];
}

export function PaymentMethodBreakdownCard({ expenses }: PaymentMethodBreakdownCardProps) {
  const { breakdown, total } = useMemo(() => {
    const map: Record<string, number> = {};
    let grandTotal = 0;

    expenses.forEach(exp => {
      let rawMethod = exp.paymentMethod || 'upi';
      if (!rawMethod.startsWith('credit_card') && rawMethod !== 'cash') {
        rawMethod = 'upi';
      }
      map[rawMethod] = (map[rawMethod] ?? 0) + exp.amount;
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
  }, [expenses]);

  if (breakdown.length === 0) return null;

  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 20, padding: 20, marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'color-mix(in srgb, var(--accent) 15%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
          <CreditCard size={18} />
        </div>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Payment Breakdown</h3>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>Credit Cards vs UPI Default</p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {breakdown.map(item => {
          const color = item.method.startsWith('credit_card') ? '#3B82F6' : item.method === 'cash' ? '#EC4899' : '#10B981';
          return (
            <div key={item.method}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <PaymentMethodBadge method={item.method} />
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                  {formatINR(item.amount)} <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-muted)' }}>({item.pct.toFixed(0)}%)</span>
                </div>
              </div>
              <div style={{ height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${item.pct}%`, background: color, borderRadius: 3, transition: 'width 0.5s ease' }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
