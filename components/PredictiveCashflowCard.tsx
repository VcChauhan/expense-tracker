'use client';

import { useMemo } from 'react';
import { Category, Expense, formatINR } from '@/lib/types';
import { predictCashflowAndBudget } from '@/lib/localForecaster';
import { TrendingUp, Calendar } from 'lucide-react';

interface PredictiveCashflowCardProps {
  salary: number;
  expenses: Expense[];
  categories: Category[];
}

export function PredictiveCashflowCard({ salary, expenses, categories }: PredictiveCashflowCardProps) {
  const forecast = useMemo(() => {
    return predictCashflowAndBudget(salary, expenses, categories);
  }, [salary, expenses, categories]);

  const maxBurn = Math.max(forecast.weekdayBurnRate, forecast.weekendBurnRate, 1);

  const surplusRows = [
    { label: '30-Day Surplus', value: forecast.projectedSurplus30d, pct: 33 },
    { label: '60-Day Surplus', value: forecast.projectedSurplus60d, pct: 66 },
    { label: '90-Day Surplus', value: forecast.projectedSurplus90d, pct: 100 },
  ];
  const maxSurplus = Math.max(...surplusRows.map(r => Math.abs(r.value)), 1);

  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 24, padding: 24, marginBottom: 24,
      animation: 'fade-in-up 0.4s var(--ease) both', position: 'relative', overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', top: -60, right: -60, width: 160, height: 160,
        background: 'radial-gradient(circle, color-mix(in srgb, var(--accent) 14%, transparent) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, position: 'relative' }}>
        <div style={{
          width: 40, height: 40, borderRadius: 13, flexShrink: 0,
          background: 'var(--accent-grad)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
          boxShadow: '0 6px 16px -4px color-mix(in srgb, var(--accent) 55%, transparent)',
        }}>
          <TrendingUp size={20} />
        </div>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>30/60/90 Day Cashflow Forecast</h3>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>On-device time-series prediction</p>
        </div>
      </div>

      {/* Burn Rate Comparison — visual bars instead of two flat boxes */}
      <div style={{ marginBottom: 22, position: 'relative' }}>
        {[
          { label: 'Weekday Burn Rate', value: forecast.weekdayBurnRate, color: 'var(--accent-2)' },
          { label: 'Weekend Burn Rate', value: forecast.weekendBurnRate, color: 'var(--warning)' },
        ].map((row, i) => (
          <div key={row.label} style={{ marginBottom: i === 0 ? 12 : 0, animation: `fade-in-up 0.4s var(--ease) ${0.05 + i * 0.07}s both` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{row.label}</span>
              <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>{formatINR(row.value)}<span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>/day</span></span>
            </div>
            <div style={{ height: 8, background: 'var(--bg-elevated)', borderRadius: 99, overflow: 'hidden' }}>
              <div style={{
                height: '100%', width: `${(row.value / maxBurn) * 100}%`, background: row.color, borderRadius: 99,
                transition: 'width 0.8s var(--ease)',
              }} />
            </div>
          </div>
        ))}
      </div>

      {/* 30/60/90 Day Surplus Projections */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, position: 'relative' }}>
        {surplusRows.map((row, i) => {
          const isPositive = row.value >= 0;
          return (
            <div
              key={row.label}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 14px', background: 'var(--bg-elevated)', borderRadius: 14, border: '1px solid var(--border)',
                animation: `fade-in-up 0.35s var(--ease) ${0.2 + i * 0.07}s both`,
              }}
            >
              <div style={{
                width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                background: isPositive ? 'var(--success-dim)' : 'var(--danger-dim)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: isPositive ? 'var(--success)' : 'var(--danger)',
              }}>
                <Calendar size={16} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)' }}>{row.label}</div>
                <div style={{ height: 4, background: 'var(--bg-card)', borderRadius: 99, marginTop: 5, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', width: `${Math.min(100, (Math.abs(row.value) / maxSurplus) * 100)}%`,
                    background: isPositive ? 'var(--success)' : 'var(--danger)', borderRadius: 99,
                    transition: 'width 0.8s var(--ease)',
                  }} />
                </div>
              </div>
              <span style={{ fontSize: 15, fontWeight: 800, color: isPositive ? 'var(--success)' : 'var(--danger)', flexShrink: 0 }}>
                {formatINR(row.value)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
