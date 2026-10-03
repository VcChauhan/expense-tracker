'use client';

import { useMemo } from 'react';
import { formatINR } from '@/lib/types';
import { TrendingDown, TrendingUp, Minus, ShieldCheck, Flame, Scale, PiggyBank } from 'lucide-react';

interface CfoPulseMetricsProps {
  currentSpent: number;
  prevMonthSpent: number;
  trailing3MonthAvg: number;
  salary: number;
  normalizedSpent: number;
  totalAnomalySpent: number;
  daysElapsed: number;
  totalDays: number;
}

export function CfoPulseMetrics({
  currentSpent,
  prevMonthSpent,
  trailing3MonthAvg,
  salary,
  normalizedSpent,
  totalAnomalySpent,
  daysElapsed,
  totalDays,
}: CfoPulseMetricsProps) {
  // Month-over-Month comparison
  const momDiff = currentSpent - prevMonthSpent;
  const momPct = prevMonthSpent > 0 ? (Math.abs(momDiff) / prevMonthSpent) * 100 : 0;
  const isMomBetter = momDiff <= 0;

  // Trailing 3-month comparison
  const trailingDiff = currentSpent - trailing3MonthAvg;
  const isTrailingBetter = trailingDiff <= 0;

  // Projected Month-End spend
  const projectedMonthEnd = daysElapsed > 0 ? Math.round((currentSpent / daysElapsed) * totalDays) : currentSpent;
  const projectedVsLastMonthDiff = projectedMonthEnd - prevMonthSpent;

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 10 }}>
        Month-Over-Month Performance Pulse
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: 10,
      }}>
        {/* Card 1: vs Last Month Spent */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 18,
          padding: '14px 14px',
          boxShadow: 'var(--shadow-xs)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>
              vs Last Month
            </div>
            <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>
              {formatINR(currentSpent)}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10 }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 3,
              fontSize: 11,
              fontWeight: 800,
              padding: '2px 7px',
              borderRadius: 99,
              background: isMomBetter ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
              color: isMomBetter ? 'var(--success)' : 'var(--danger)',
            }}>
              {isMomBetter ? <TrendingDown size={12} /> : <TrendingUp size={12} />}
              {momPct.toFixed(0)}% {isMomBetter ? 'lower' : 'higher'}
            </span>
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
              (was {formatINR(prevMonthSpent)})
            </span>
          </div>
        </div>

        {/* Card 2: 3-Month Trailing Benchmark */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 18,
          padding: '14px 14px',
          boxShadow: 'var(--shadow-xs)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>
              3-Month Benchmark
            </div>
            <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>
              {formatINR(trailing3MonthAvg)}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10 }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 3,
              fontSize: 11,
              fontWeight: 800,
              padding: '2px 7px',
              borderRadius: 99,
              background: isTrailingBetter ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
              color: isTrailingBetter ? 'var(--success)' : 'var(--warning)',
            }}>
              <Scale size={12} />
              {isTrailingBetter ? 'Under baseline' : 'Pacing above'}
            </span>
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
              {Math.abs(trailingDiff) > 0 ? `${formatINR(Math.abs(trailingDiff))} delta` : 'Equal'}
            </span>
          </div>
        </div>

        {/* Card 3: True Recurring Burn (Normalized) */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 18,
          padding: '14px 14px',
          boxShadow: 'var(--shadow-xs)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>
              Baseline Lifestyle Burn
            </div>
            <div style={{ fontSize: 20, fontWeight: 900, color: '#3B82F6', letterSpacing: '-0.5px' }}>
              {formatINR(normalizedSpent)}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10 }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 3,
              fontSize: 11,
              fontWeight: 800,
              padding: '2px 7px',
              borderRadius: 99,
              background: 'rgba(59,130,246,0.15)',
              color: '#3B82F6',
            }}>
              <ShieldCheck size={12} />
              {totalAnomalySpent > 0 ? `₹${(totalAnomalySpent/1000).toFixed(1)}k one-offs stripped` : 'Clean burn'}
            </span>
          </div>
        </div>

        {/* Card 4: Month-End Projected Pace */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 18,
          padding: '14px 14px',
          boxShadow: 'var(--shadow-xs)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>
              Projected Month-End
            </div>
            <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>
              {formatINR(projectedMonthEnd)}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10 }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 3,
              fontSize: 11,
              fontWeight: 800,
              padding: '2px 7px',
              borderRadius: 99,
              background: projectedVsLastMonthDiff <= 0 ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
              color: projectedVsLastMonthDiff <= 0 ? 'var(--success)' : 'var(--danger)',
            }}>
              <Flame size={12} />
              {projectedVsLastMonthDiff <= 0 ? 'Beating last month' : 'Exceeding last month'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
