'use client';

import { useState, useMemo } from 'react';
import { formatINR, Category, SavingsGoal } from '@/lib/types';
import { ShoppingBag, CheckCircle2, AlertTriangle, XCircle, Calculator } from 'lucide-react';

interface AffordabilityCheckerProps {
  monthlySalary: number;
  monthlySpent: number;
  monthlyBudget: number;
  categories: Category[];
  activeTotalsMap: Record<string, number>;
}

export function AffordabilityChecker({
  monthlySalary,
  monthlySpent,
  monthlyBudget,
  categories,
  activeTotalsMap,
}: AffordabilityCheckerProps) {
  const [amountStr, setAmountStr] = useState('');
  const [selectedCatId, setSelectedCatId] = useState('');

  const purchaseAmount = parseFloat(amountStr) || 0;

  const analysis = useMemo(() => {
    if (purchaseAmount <= 0) return null;

    const remainingBudget = Math.max(0, monthlyBudget - monthlySpent);
    const surplusBefore = monthlySalary - monthlySpent;
    const surplusAfter = surplusBefore - purchaseAmount;

    let targetCatName = '';
    let catRemaining = 0;
    let catWillExceed = false;
    let catOverage = 0;

    if (selectedCatId) {
      const cat = categories.find(c => c.id === selectedCatId);
      if (cat) {
        targetCatName = cat.name;
        const catSpent = activeTotalsMap[cat.id] ?? 0;
        catRemaining = cat.monthlyBudget - catSpent;
        if (purchaseAmount > catRemaining && cat.monthlyBudget > 0) {
          catWillExceed = true;
          catOverage = Math.round(purchaseAmount - catRemaining);
        }
      }
    }

    let status: 'safe' | 'warning' | 'danger' = 'safe';
    let title = '';
    let message = '';

    if (monthlySalary > 0 && surplusAfter < 0) {
      status = 'danger';
      title = 'Unsafe Purchase';
      message = `This ₹${purchaseAmount} purchase will put you ${formatINR(Math.abs(surplusAfter))} over your monthly income!`;
    } else if (catWillExceed) {
      status = 'warning';
      title = 'Category Overage Warning';
      message = `You have the cash, but this will push ${targetCatName} budget ₹${catOverage} over limit.`;
    } else if (purchaseAmount > remainingBudget && monthlyBudget > 0) {
      status = 'warning';
      title = 'Budget Stretch';
      message = `Affordable from income, but uses more than your remaining monthly budget (${formatINR(remainingBudget)} left).`;
    } else {
      status = 'safe';
      title = 'Safe Purchase!';
      message = `You can comfortably afford this! You'll still have ${formatINR(surplusAfter)} surplus at month end.`;
    }

    return {
      status,
      title,
      message,
      surplusAfter,
      remainingBudget,
      catWillExceed,
      targetCatName,
    };
  }, [purchaseAmount, monthlySalary, monthlySpent, monthlyBudget, selectedCatId, categories, activeTotalsMap]);

  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 20, padding: 24, marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'color-mix(in srgb, var(--accent) 15%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
          <Calculator size={18} />
        </div>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>"Can I Afford This?" Analyzer</h3>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>Check budget impact before buying</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
        <div style={{ flex: 1, minWidth: 140, position: 'relative' }}>
          <span style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-muted)', fontWeight: 600 }}>₹</span>
          <input
            type="number"
            placeholder="Amount (e.g. 15000)"
            value={amountStr}
            onChange={e => setAmountStr(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px 10px 28px',
              borderRadius: 12,
              border: '1px solid var(--border)',
              background: 'var(--bg)',
              color: 'var(--text-primary)',
              fontSize: 14,
              outline: 'none',
              boxSizing: 'border-box'
            }}
          />
        </div>

        <select
          value={selectedCatId}
          onChange={e => setSelectedCatId(e.target.value)}
          style={{
            flex: 1,
            minWidth: 140,
            padding: '10px 12px',
            borderRadius: 12,
            border: '1px solid var(--border)',
            background: 'var(--bg)',
            color: 'var(--text-primary)',
            fontSize: 14,
            outline: 'none',
            appearance: 'none',
            boxSizing: 'border-box'
          }}
        >
          <option value="">Select Category (Optional)</option>
          {categories.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {analysis && (
        <div style={{
          padding: 16,
          borderRadius: 14,
          background: analysis.status === 'safe' 
            ? 'color-mix(in srgb, var(--success) 10%, transparent)' 
            : analysis.status === 'warning'
            ? 'color-mix(in srgb, var(--warning) 10%, transparent)'
            : 'color-mix(in srgb, var(--danger) 10%, transparent)',
          border: `1px solid ${analysis.status === 'safe' ? 'var(--success)' : analysis.status === 'warning' ? 'var(--warning)' : 'var(--danger)'}`,
          display: 'flex',
          gap: 12,
          alignItems: 'flex-start',
          animation: 'fadeIn 0.3s ease-in-out'
        }}>
          <div style={{ marginTop: 2, color: analysis.status === 'safe' ? 'var(--success)' : analysis.status === 'warning' ? 'var(--warning)' : 'var(--danger)' }}>
            {analysis.status === 'safe' ? <CheckCircle2 size={20} /> : analysis.status === 'warning' ? <AlertTriangle size={20} /> : <XCircle size={20} />}
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>{analysis.title}</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.4 }}>{analysis.message}</div>
          </div>
        </div>
      )}
    </div>
  );
}
