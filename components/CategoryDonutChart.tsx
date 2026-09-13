'use client';

import { useMemo, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { PieChart as PieChartIcon } from 'lucide-react';
import { CategoryIcon } from '@/components/CategoryIcon';
import { formatINR, Category } from '@/lib/types';

interface CategoryDonutChartProps {
  categories: Category[];
  categoryTotals: { _id: string; total: number }[];
  totalSpent: number;
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

export function CategoryDonutChart({ categories, categoryTotals, totalSpent }: CategoryDonutChartProps) {
  const [activeIdx, setActiveIdx] = useState<number | null>(null);

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
                onClick={(_, i) => setActiveIdx(activeIdx === i ? null : i)}
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
              onClick={() => setActiveIdx(activeIdx === i ? null : i)}
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
    </div>
  );
}
