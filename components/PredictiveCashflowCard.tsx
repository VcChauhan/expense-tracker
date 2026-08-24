'use client';

import { useMemo } from 'react';
import { Category, Expense, formatINR } from '@/lib/types';
import { predictCashflowAndBudget } from '@/lib/localForecaster';
import { TrendingUp, Calendar, Zap, Sparkles } from 'lucide-react';

interface PredictiveCashflowCardProps {
  salary: number;
  expenses: Expense[];
  categories: Category[];
}

export function PredictiveCashflowCard({ salary, expenses, categories }: PredictiveCashflowCardProps) {
  const forecast = useMemo(() => {
    return predictCashflowAndBudget(salary, expenses, categories);
  }, [salary, expenses, categories]);

  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 24, padding: 24, marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: 'color-mix(in srgb, var(--accent) 15%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
          <TrendingUp size={20} />
        </div>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>30/60/90 Day Cashflow Forecast</h3>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>On-device time-series prediction</p>
        </div>
      </div>

      {/* Burn Rate Velocity Split */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 16 }}>
        <div style={{ padding: 14, background: 'var(--bg-elevated)', borderRadius: 14, border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Weekday Burn Rate</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', marginTop: 4 }}>{formatINR(forecast.weekdayBurnRate)}/day</div>
        </div>
        <div style={{ padding: 14, background: 'var(--bg-elevated)', borderRadius: 14, border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Weekend Burn Rate</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--warning)', marginTop: 4 }}>{formatINR(forecast.weekendBurnRate)}/day</div>
        </div>
      </div>

      {/* 30/60/90 Day Surplus Projections */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: 'var(--bg-elevated)', borderRadius: 12, border: '1px solid var(--border)' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>📅 Projected 30-Day Surplus</span>
          <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--success)' }}>{formatINR(forecast.projectedSurplus30d)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: 'var(--bg-elevated)', borderRadius: 12, border: '1px solid var(--border)' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>📅 Projected 60-Day Surplus</span>
          <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--success)' }}>{formatINR(forecast.projectedSurplus60d)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: 'var(--bg-elevated)', borderRadius: 12, border: '1px solid var(--border)' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>📅 Projected 90-Day Surplus</span>
          <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--success)' }}>{formatINR(forecast.projectedSurplus90d)}</span>
        </div>
      </div>
    </div>
  );
}
