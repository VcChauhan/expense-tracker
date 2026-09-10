'use client';

import { useMemo } from 'react';
import { formatINR, MONTHS, Category, SavingsGoal } from '@/lib/types';

interface MonthlyRecapCardProps {
  spent: number;
  income: number;
  budget: number;
  categories: Category[];
  categoryTotals: { _id: string; total: number }[];
  historicalAverage: number;
  savingsGoals?: SavingsGoal[];
  month: number; // 0-indexed
  year: number;
}

interface MetricRow {
  emoji: string;
  label: string;
  value: string;
  badge?: string;
  badgeColor?: string;
  badgeBg?: string;
}

export function MonthlyRecapCard({
  spent,
  income,
  budget,
  categories,
  categoryTotals,
  historicalAverage,
  savingsGoals,
  month,
  year,
}: MonthlyRecapCardProps) {
  const metrics = useMemo(() => {
    const rows: MetricRow[] = [];

    const totalsMap: Record<string, number> = {};
    for (const ct of categoryTotals) {
      totalsMap[ct._id] = ct.total;
    }

    // 1. Saved
    const saved = income - spent;
    const savingsPct = income > 0 ? (saved / income) * 100 : 0;
    rows.push({
      emoji: '💰',
      label: 'Saved',
      value: formatINR(Math.abs(saved)),
      badge: saved >= 0
        ? `${savingsPct.toFixed(0)}% of income`
        : `−${Math.abs(savingsPct).toFixed(0)}% of income`,
      badgeColor: saved >= 0 ? 'var(--success)' : 'var(--danger)',
      badgeBg: saved >= 0 ? 'var(--success-dim)' : 'var(--danger-dim)',
    });

    // 2. vs Historical Average
    if (historicalAverage > 0) {
      const diff = historicalAverage - spent;
      const diffPct = (Math.abs(diff) / historicalAverage) * 100;
      const isLess = diff > 0;
      rows.push({
        emoji: '📊',
        label: 'vs 3-Month Avg',
        value: formatINR(Math.abs(diff)),
        badge: isLess ? `${diffPct.toFixed(0)}% less ↓` : `${diffPct.toFixed(0)}% more ↑`,
        badgeColor: isLess ? 'var(--success)' : diffPct > 20 ? 'var(--danger)' : 'var(--warning)',
        badgeBg: isLess ? 'var(--success-dim)' : diffPct > 20 ? 'var(--danger-dim)' : 'var(--warning-dim)',
      });
    } else {
      rows.push({
        emoji: '📊',
        label: 'vs 3-Month Avg',
        value: '—',
        badge: 'No history yet',
        badgeColor: 'var(--text-muted)',
        badgeBg: 'var(--bg-elevated)',
      });
    }

    // 3. Top Saver — category with most remaining budget
    let topSaverCat: Category | null = null;
    let topSaverAmount = -Infinity;
    for (const cat of categories) {
      if (cat.monthlyBudget <= 0) continue;
      const catSpent = totalsMap[cat.id] ?? 0;
      const remaining = cat.monthlyBudget - catSpent;
      if (remaining > topSaverAmount) {
        topSaverAmount = remaining;
        topSaverCat = cat;
      }
    }
    if (topSaverCat && topSaverAmount > 0) {
      rows.push({
        emoji: '🏆',
        label: 'Best Category',
        value: `${topSaverCat.name}`,
        badge: `${formatINR(topSaverAmount)} left`,
        badgeColor: 'var(--success)',
        badgeBg: 'var(--success-dim)',
      });
    } else {
      rows.push({
        emoji: '🏆',
        label: 'Best Category',
        value: 'No data',
        badge: 'Set budgets first',
        badgeColor: 'var(--text-muted)',
        badgeBg: 'var(--bg-elevated)',
      });
    }

    // 4. Watch Out — most over-budget category
    let worstCat: Category | null = null;
    let worstRatio = 0;
    let worstOverage = 0;
    for (const cat of categories) {
      if (cat.monthlyBudget <= 0) continue;
      const catSpent = totalsMap[cat.id] ?? 0;
      const ratio = catSpent / cat.monthlyBudget;
      if (ratio > 1 && ratio > worstRatio) {
        worstRatio = ratio;
        worstCat = cat;
        worstOverage = catSpent - cat.monthlyBudget;
      }
    }
    if (worstCat) {
      rows.push({
        emoji: '⚠️',
        label: 'Watch Out',
        value: `${worstCat.name}`,
        badge: `${formatINR(worstOverage)} over`,
        badgeColor: 'var(--danger)',
        badgeBg: 'var(--danger-dim)',
      });
    } else {
      rows.push({
        emoji: '🎉',
        label: 'Watch Out',
        value: 'All clear!',
        badge: 'All within budget',
        badgeColor: 'var(--success)',
        badgeBg: 'var(--success-dim)',
      });
    }

    return rows;
  }, [spent, income, budget, categories, categoryTotals, historicalAverage]);

  const savingsPct = income > 0 ? Math.max(0, Math.min(100, ((income - spent) / income) * 100)) : 0;
  const budgetPct  = budget > 0 ? Math.min(100, (spent / budget) * 100) : 0;

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 22,
      marginBottom: 16,
      overflow: 'hidden',
      animation: 'fade-in-up 0.4s var(--ease) both',
    }}>
      {/* Gradient header band */}
      <div style={{
        background: 'linear-gradient(135deg, var(--accent) 0%, #A462F5 50%, #C070F0 100%)',
        padding: '18px 20px 20px',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Radial glow */}
        <div style={{
          position: 'absolute', top: '-30%', right: '-10%',
          width: '60%', height: '200%',
          background: 'radial-gradient(circle, rgba(255,255,255,0.15) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative' }}>
          <div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 4 }}>
              {year} · Financial Summary
            </div>
            <h3 style={{ fontSize: 22, fontWeight: 900, color: '#fff', margin: 0, letterSpacing: '-0.5px' }}>
              {MONTHS[month]} Recap
            </h3>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.65)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 3 }}>Saved</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: '#fff', letterSpacing: '-0.5px' }}>{formatINR(Math.max(0, income - spent))}</div>
          </div>
        </div>

        {/* Savings progress bar */}
        <div style={{ marginTop: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>Budget used</span>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.9)', fontWeight: 800 }}>{budgetPct.toFixed(0)}%</span>
          </div>
          <div style={{ height: 5, background: 'rgba(255,255,255,0.2)', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${budgetPct}%`,
              background: 'rgba(255,255,255,0.85)',
              borderRadius: 99,
              transition: 'width 0.8s var(--ease)',
            }} />
          </div>
        </div>
      </div>

      {/* Metric Rows */}
      <div style={{ padding: '4px 0' }}>
        {metrics.map((row, idx) => (
          <div
            key={row.label}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '13px 18px',
              borderBottom: idx < metrics.length - 1 ? '1px solid var(--border)' : 'none',
              animation: `fade-in-up 0.35s var(--ease) ${idx * 0.07}s both`,
            }}
          >
            {/* Left */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: 'var(--bg-elevated)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 17, flexShrink: 0,
              }}>
                {row.emoji}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{
                  fontSize: 11, fontWeight: 700,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase', letterSpacing: '0.6px',
                  marginBottom: 2,
                }}>
                  {row.label}
                </div>
                <div style={{
                  fontSize: 15, fontWeight: 800,
                  color: 'var(--text-primary)',
                  letterSpacing: '-0.3px',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {row.value}
                </div>
              </div>
            </div>

            {/* Badge */}
            {row.badge && (
              <div style={{
                padding: '4px 10px', borderRadius: 99,
                fontSize: 11, fontWeight: 800,
                color: row.badgeColor,
                background: row.badgeBg,
                whiteSpace: 'nowrap', flexShrink: 0,
                marginLeft: 10,
              }}>
                {row.badge}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
