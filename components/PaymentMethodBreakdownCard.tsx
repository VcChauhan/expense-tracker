'use client';

import { useMemo } from 'react';
import { Expense, formatINR } from '@/lib/types';
import { PaymentMethodBadge } from './PaymentMethodSelector';
import { CreditCard } from 'lucide-react';

interface PaymentMethodBreakdownCardProps {
  expenses: Expense[];
  selectedMonth?: number; // 0-indexed (0=Jan, 8=Sept)
  selectedYear?: number;
  viewMode?: 'monthly' | 'annual';
}

export function PaymentMethodBreakdownCard({ expenses, selectedMonth, selectedYear, viewMode = 'monthly' }: PaymentMethodBreakdownCardProps) {
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
  }, [expenses, selectedMonth, selectedYear, viewMode]);

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
