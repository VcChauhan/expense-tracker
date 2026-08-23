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

    // Build a lookup of categoryId -> total spent
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
    });

    // 2. vs Last Month (using historicalAverage as comparison)
    if (historicalAverage > 0) {
      const diff = historicalAverage - spent;
      const diffPct = (Math.abs(diff) / historicalAverage) * 100;
      const isLess = diff > 0;
      rows.push({
        emoji: '📊',
        label: 'vs 3-Month Avg',
        value: formatINR(Math.abs(diff)),
        badge: isLess
          ? `Spent ${diffPct.toFixed(0)}% less`
          : `Spent ${diffPct.toFixed(0)}% more`,
        badgeColor: isLess ? 'var(--success)' : diffPct > 20 ? 'var(--danger)' : 'var(--warning)',
      });
    } else {
      rows.push({
        emoji: '📊',
        label: 'vs 3-Month Avg',
        value: '—',
        badge: 'No historical data',
        badgeColor: 'var(--text-muted)',
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
        label: 'Top Saver',
        value: `${topSaverCat.emoji} ${topSaverCat.name}`,
        badge: `${formatINR(topSaverAmount)} saved`,
        badgeColor: 'var(--success)',
      });
    } else {
      rows.push({
        emoji: '🏆',
        label: 'Top Saver',
        value: 'No data',
        badge: 'Set budgets to track',
        badgeColor: 'var(--text-muted)',
      });
    }

    // 4. Watch Out — most over-budget category (highest spent/budget ratio)
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
        value: `${worstCat.emoji} ${worstCat.name}`,
        badge: `${formatINR(worstOverage)} over budget`,
        badgeColor: 'var(--danger)',
      });
    } else {
      rows.push({
        emoji: '🎉',
        label: 'Watch Out',
        value: 'All clear!',
        badge: 'Every category is within budget',
        badgeColor: 'var(--success)',
      });
    }

    return rows;
  }, [spent, income, budget, categories, categoryTotals, historicalAverage]);

  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 20,
        padding: 24,
        marginBottom: 24,
        position: 'relative',
        overflow: 'hidden',
        animation: 'mrcFadeIn 0.5s ease-out',
      }}
    >
      {/* Gradient accent top border */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          background: 'linear-gradient(90deg, var(--accent), #5B4FE0)',
          borderRadius: '20px 20px 0 0',
        }}
      />

      {/* Title */}
      <div style={{ marginBottom: 20 }}>
        <h3
          style={{
            fontSize: 18,
            fontWeight: 800,
            color: 'var(--text-primary)',
            margin: 0,
          }}
        >
          {MONTHS[month]} Recap
        </h3>
        <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>
          {year} · Financial Summary
        </span>
      </div>

      {/* Metric Rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {metrics.map((row, idx) => (
          <div
            key={row.label}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 0',
              borderTop: idx > 0 ? '1px solid var(--border)' : 'none',
              animation: `mrcFadeIn 0.4s ease-out ${idx * 0.08}s both`,
            }}
          >
            {/* Left: Emoji + Label */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
              <span style={{ fontSize: 20 }}>{row.emoji}</span>
              <div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: 'var(--text-secondary)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.4px',
                    marginBottom: 2,
                  }}
                >
                  {row.label}
                </div>
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                  }}
                >
                  {row.value}
                </div>
              </div>
            </div>

            {/* Right: Badge */}
            {row.badge && (
              <div
                style={{
                  padding: '4px 10px',
                  borderRadius: 9999,
                  fontSize: 11,
                  fontWeight: 700,
                  color: row.badgeColor,
                  background: `color-mix(in srgb, ${row.badgeColor} 12%, transparent)`,
                  whiteSpace: 'nowrap',
                  letterSpacing: '0.2px',
                }}
              >
                {row.badge}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Keyframe styles */}
      <style>{`
        @keyframes mrcFadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
