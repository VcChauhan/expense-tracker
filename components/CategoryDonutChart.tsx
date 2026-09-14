'use client';

import { useMemo, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { PieChart as PieChartIcon, ArrowLeft, Store } from 'lucide-react';
import { CategoryIcon } from '@/components/CategoryIcon';
import { formatINR, Category } from '@/lib/types';

interface RawExpense {
  categoryId: string;
  amount: number;
  note?: string;
}

interface CategoryDonutChartProps {
  categories: Category[];
  categoryTotals: { _id: string; total: number }[];
  totalSpent: number;
  /** Optional — when provided, clicking a category drills into its top merchants. */
  expenses?: RawExpense[];
}

interface Slice {
  id: string;
  name: string;
  color: string;
  value: number;
  pct: number;
}

const FALLBACK_COLOR = '#9CA3AF';

const DonutTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d: Slice = payload[0].payload;
  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border-strong)',
      borderRadius: 12,
      padding: '8px 12px',
      boxShadow: 'var(--shadow-md)',
    }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: d.color, margin: 0, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
        {d.name}
      </p>
      <p style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', margin: '2px 0 0 0' }}>
        {formatINR(d.value)} <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>({d.pct.toFixed(0)}%)</span>
      </p>
    </div>
  );
};

export function CategoryDonutChart({ categories, categoryTotals, totalSpent, expenses }: CategoryDonutChartProps) {
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const [drilledId, setDrilledId] = useState<string | null>(null);

  const slices: Slice[] = useMemo(() => {
    const totalsMap: Record<string, number> = {};
    for (const ct of categoryTotals) totalsMap[ct._id] = ct.total;

    const rows = categories
      .map(cat => {
        const value = totalsMap[cat.id] ?? 0;
        return {
          id: cat.id,
          name: cat.name,
          color: cat.color || FALLBACK_COLOR,
          value,
          pct: totalSpent > 0 ? (value / totalSpent) * 100 : 0,
        };
      })
      .filter(s => s.value > 0)
      .sort((a, b) => b.value - a.value);

    return rows;
  }, [categories, categoryTotals, totalSpent]);

  const drilledCategory = drilledId ? slices.find(s => s.id === drilledId) ?? null : null;

  const drilledMerchants = useMemo(() => {
    if (!drilledId || !expenses) return [];
    const map: Record<string, { total: number; count: number }> = {};
    for (const exp of expenses) {
      if (exp.categoryId !== drilledId) continue;
      let merchant = (exp.note || '').trim();
      if (!merchant) continue;
      merchant = merchant.replace(/\s*\(Split:.*?\)/i, '').trim();
      merchant = merchant.replace(/\s*\(Recurring\)/i, '').trim();
      if (!merchant) continue;
      const clean = merchant.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
      if (!map[clean]) map[clean] = { total: 0, count: 0 };
      map[clean].total += exp.amount;
      map[clean].count += 1;
    }
    return Object.entries(map)
      .map(([name, d]) => ({ name, ...d }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);
  }, [drilledId, expenses]);

  if (slices.length === 0) {
    return null;
  }

  const centerSlice = activeIdx !== null ? slices[activeIdx] : null;

  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: 20, padding: '20px 16px', marginBottom: 16,
      boxShadow: 'var(--shadow-xs)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <PieChartIcon size={18} color="var(--accent)" />
        <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
          Spending by Category
        </h2>
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 12px 0' }}>Where your money went, by share of total spend</p>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ width: 140, height: 140, position: 'relative', flexShrink: 0 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={slices}
                dataKey="value"
                nameKey="name"
                innerRadius={44}
                outerRadius={68}
                paddingAngle={2}
                cornerRadius={4}
                stroke="none"
                onMouseEnter={(_, i) => setActiveIdx(i)}
                onMouseLeave={() => setActiveIdx(null)}
                onClick={(_, i) => expenses ? setDrilledId(slices[i].id) : setActiveIdx(activeIdx === i ? null : i)}
              >
                {slices.map((s, i) => (
                  <Cell
                    key={s.id}
                    fill={s.color}
                    opacity={activeIdx === null || activeIdx === i ? 1 : 0.35}
                    style={{ cursor: 'pointer', transition: 'opacity 0.2s ease' }}
                  />
                ))}
              </Pie>
              <Tooltip content={<DonutTooltip />} />
            </PieChart>
          </ResponsiveContainer>

          {/* Center label */}
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', pointerEvents: 'none',
          }}>
            {centerSlice ? (
              <>
                <span style={{ fontSize: 10, fontWeight: 700, color: centerSlice.color, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                  {centerSlice.name}
                </span>
                <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', marginTop: 2 }}>
                  {centerSlice.pct.toFixed(0)}%
                </span>
              </>
            ) : (
              <>
                <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>
                  {formatINR(totalSpent)}
                </span>
                <span style={{ fontSize: 9.5, color: 'var(--text-muted)', marginTop: 2 }}>Total Spent</span>
              </>
            )}
          </div>
        </div>

        {/* Legend */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 9, minWidth: 0 }}>
          {slices.slice(0, 6).map((s, i) => (
            <div
              key={s.id}
              onClick={() => expenses ? setDrilledId(s.id) : setActiveIdx(activeIdx === i ? null : i)}
              onMouseEnter={() => setActiveIdx(i)}
              onMouseLeave={() => setActiveIdx(null)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
                opacity: activeIdx === null || activeIdx === i ? 1 : 0.45,
                transition: 'opacity 0.2s ease',
              }}
            >
              <div style={{
                width: 8, height: 8, borderRadius: 2.5, background: s.color, flexShrink: 0,
              }} />
              <span style={{ fontSize: 12, color: 'var(--text-secondary)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {s.name} <span style={{ color: 'var(--text-muted)' }}>{s.pct.toFixed(0)}%</span>
              </span>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', flexShrink: 0 }}>
                {formatINR(s.value)}
              </span>
            </div>
          ))}
          {slices.length > 6 && (
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>+{slices.length - 6} more</span>
          )}
        </div>
      </div>

      {/* Drill-down panel — top merchants within the selected category */}
      {expenses && (
        <div style={{
          marginTop: drilledCategory ? 16 : 0,
          maxHeight: drilledCategory ? 400 : 0,
          overflow: 'hidden',
          transition: 'max-height 0.25s ease, margin-top 0.25s ease',
        }}>
          {drilledCategory && (
            <div style={{ paddingTop: 16, borderTop: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Store size={15} color={drilledCategory.color} />
                  <h3 style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                    Top spends in {drilledCategory.name}
                  </h3>
                </div>
                <button
                  onClick={() => setDrilledId(null)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                    borderRadius: 99, padding: '4px 10px', fontSize: 11, fontWeight: 700,
                    color: 'var(--text-secondary)', cursor: 'pointer',
                  }}
                >
                  <ArrowLeft size={12} /> Back
                </button>
              </div>

              {drilledMerchants.length === 0 ? (
                <div style={{ fontSize: 12.5, color: 'var(--text-muted)', textAlign: 'center', padding: '12px 0' }}>
                  No named merchants logged in this category yet.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {drilledMerchants.map((m, idx) => {
                    const maxSpend = drilledMerchants[0].total;
                    const pctOfTop = maxSpend > 0 ? (m.total / maxSpend) * 100 : 0;
                    return (
                      <div key={m.name}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)' }}>
                            {idx + 1}. {m.name} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>· {m.count} txn{m.count > 1 ? 's' : ''}</span>
                          </span>
                          <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)' }}>{formatINR(m.total)}</span>
                        </div>
                        <div style={{ height: 4, background: 'var(--bg-elevated)', borderRadius: 99, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pctOfTop}%`, background: drilledCategory.color, borderRadius: 99 }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
