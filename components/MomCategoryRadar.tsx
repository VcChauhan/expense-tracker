'use client';

import { useMemo, useState } from 'react';
import { formatINR, Category } from '@/lib/types';
import { TrendingUp, TrendingDown, Minus, ChevronRight, Layers } from 'lucide-react';
import { CategoryIcon } from './CategoryIcon';

interface CategoryComparison {
  name: string;
  actualSpent: number;
  spentLastMonth: number;
  historical3MonthAverage: number;
  budgetLimit: number;
}

interface MomCategoryRadarProps {
  categories: CategoryComparison[];
  allSettingsCategories?: Category[];
}

export function MomCategoryRadar({ categories, allSettingsCategories = [] }: MomCategoryRadarProps) {
  const [expandedCat, setExpandedCat] = useState<string | null>(null);

  const sortedCategories = useMemo(() => {
    return [...categories]
      .filter(c => c.actualSpent > 0 || c.spentLastMonth > 0)
      .sort((a, b) => b.actualSpent - a.actualSpent);
  }, [categories]);

  if (sortedCategories.length === 0) return null;

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 22,
      padding: '20px 18px',
      marginBottom: 20,
      boxShadow: 'var(--shadow-xs)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: 'var(--accent-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--accent-2)',
          }}>
            <Layers size={15} />
          </div>
          <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.3px' }}>
            Month-Over-Month Category Radar
          </h3>
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>
          This Month vs Last Month
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {sortedCategories.map(cat => {
          const diff = cat.actualSpent - cat.spentLastMonth;
          const pctChange = cat.spentLastMonth > 0 ? (Math.abs(diff) / cat.spentLastMonth) * 100 : 0;
          const isHigher = diff > 0;
          const isFlat = diff === 0;

          // Find settings color
          const catMeta = allSettingsCategories.find(c => c.name.toLowerCase() === cat.name.toLowerCase());
          const color = catMeta?.color || 'var(--accent)';

          // Max value for comparative bar scaling
          const maxVal = Math.max(cat.actualSpent, cat.spentLastMonth, cat.budgetLimit, 1);
          const currentPct = (cat.actualSpent / maxVal) * 100;
          const lastPct = (cat.spentLastMonth / maxVal) * 100;

          const isExpanded = expandedCat === cat.name;

          return (
            <div
              key={cat.name}
              onClick={() => setExpandedCat(isExpanded ? null : cat.name)}
              style={{
                background: 'var(--bg-elevated)',
                border: `1px solid ${isExpanded ? 'var(--border-glow)' : 'var(--border)'}`,
                borderRadius: 16,
                padding: '12px 14px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 10,
                    background: `${color}18`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <CategoryIcon name={cat.name} color={color} size={16} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {cat.name}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      Now: <strong style={{ color: 'var(--text-primary)' }}>{formatINR(cat.actualSpent)}</strong> • Last: {formatINR(cat.spentLastMonth)}
                    </div>
                  </div>
                </div>

                {/* Delta Pill */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  fontSize: 11, fontWeight: 800, padding: '3px 8px', borderRadius: 99, flexShrink: 0,
                  background: isFlat ? 'var(--bg-card)' : isHigher ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.12)',
                  color: isFlat ? 'var(--text-muted)' : isHigher ? 'var(--danger)' : 'var(--success)',
                  border: `1px solid ${isFlat ? 'var(--border)' : isHigher ? 'rgba(239,68,68,0.25)' : 'rgba(16,185,129,0.25)'}`,
                }}>
                  {isFlat ? (
                    <span>~ Flat</span>
                  ) : isHigher ? (
                    <>
                      <TrendingUp size={12} />
                      <span>+{formatINR(diff)} ({pctChange.toFixed(0)}%)</span>
                    </>
                  ) : (
                    <>
                      <TrendingDown size={12} />
                      <span>-{formatINR(Math.abs(diff))} ({pctChange.toFixed(0)}%)</span>
                    </>
                  )}
                </div>
              </div>

              {/* Dual comparative mini-bar */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 4 }}>
                {/* This month bar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 9.5, color: 'var(--text-muted)', width: 28, flexShrink: 0 }}>Now</span>
                  <div style={{ flex: 1, height: 5, background: 'var(--bg-card)', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${currentPct}%`, background: color, borderRadius: 99 }} />
                  </div>
                </div>
                {/* Last month bar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 9.5, color: 'var(--text-muted)', width: 28, flexShrink: 0 }}>Prev</span>
                  <div style={{ flex: 1, height: 5, background: 'var(--bg-card)', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${lastPct}%`, background: 'var(--border-strong)', borderRadius: 99 }} />
                  </div>
                </div>
              </div>

              {/* Expanded detail */}
              {isExpanded && (
                <div style={{
                  marginTop: 10,
                  paddingTop: 10,
                  borderTop: '1px solid var(--border)',
                  fontSize: 12,
                  color: 'var(--text-secondary)',
                  lineHeight: 1.4,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                  <span>
                    3-Month Trailing Avg: <strong>{formatINR(cat.historical3MonthAverage)}</strong>
                  </span>
                  <span>
                    Budget: <strong>{formatINR(cat.budgetLimit)}</strong>
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
