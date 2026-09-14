'use client';

import { useMemo } from 'react';
import { arc, pie, PieArcDatum } from 'd3-shape';
import { Clock } from 'lucide-react';
import { formatINR } from '@/lib/types';

interface SpendClockChartProps {
  expenses: { amount: number; createdAt: string }[];
}

interface HourBucket {
  hour: number;
  total: number;
}

const SIZE = 240;
const RADIUS = SIZE / 2;
const INNER_R = 46;
const OUTER_R_MAX = RADIUS - 18;

export function SpendClockChart({ expenses }: SpendClockChartProps) {
  const { buckets, peak, maxTotal } = useMemo(() => {
    const hours: HourBucket[] = Array.from({ length: 24 }, (_, h) => ({ hour: h, total: 0 }));
    for (const exp of expenses) {
      const d = new Date(exp.createdAt);
      if (isNaN(d.getTime())) continue;
      hours[d.getHours()].total += exp.amount;
    }
    const max = Math.max(...hours.map(h => h.total), 1);
    const peakBucket = hours.reduce((a, b) => (b.total > a.total ? b : a), hours[0]);
    return { buckets: hours, peak: peakBucket, maxTotal: max };
  }, [expenses]);

  const totalTracked = buckets.reduce((s, b) => s + b.total, 0);
  if (totalTracked === 0) {
    return (
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 20, padding: '20px 16px', marginBottom: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
        Not enough data yet to see a spending-by-hour pattern.
      </div>
    );
  }

  const pieGen = pie<HourBucket>().value(1).padAngle(0.012).sort(null);
  const arcs = pieGen(buckets);

  const trackArc = arc<PieArcDatum<HourBucket>>().innerRadius(INNER_R).outerRadius(RADIUS).cornerRadius(2);

  function hourLabel(h: number) {
    if (h === 0) return '12am';
    if (h === 12) return '12pm';
    return h < 12 ? `${h}am` : `${h - 12}pm`;
  }

  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 20, padding: '20px 16px', marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <Clock size={18} color="var(--accent)" />
        <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>When You Spend</h2>
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 16px 0' }}>
        By time of day it was logged, across all your expenses
      </p>

      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: SIZE, height: SIZE, position: 'relative' }}>
          <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
            <g transform={`translate(${RADIUS}, ${RADIUS})`}>
              {arcs.map((d, i) => {
                const bucket = d.data;
                const pct = bucket.total / maxTotal;
                const outerR = INNER_R + (OUTER_R_MAX - INNER_R) * Math.max(pct, bucket.total > 0 ? 0.12 : 0);
                const isPeak = bucket.hour === peak.hour && peak.total > 0;

                const segArc = arc<any>().innerRadius(INNER_R).outerRadius(outerR).cornerRadius(2)({
                  startAngle: d.startAngle, endAngle: d.endAngle, padAngle: d.padAngle,
                });
                const trackPath = trackArc(d) as string;

                return (
                  <g key={bucket.hour}>
                    <path d={trackPath} fill="var(--bg-elevated)" />
                    {bucket.total > 0 && (
                      <path
                        d={segArc as string}
                        fill={isPeak ? 'var(--accent)' : 'var(--accent-2)'}
                        opacity={isPeak ? 1 : 0.55 + pct * 0.4}
                      />
                    )}
                  </g>
                );
              })}
              {/* Cardinal hour labels */}
              {[0, 6, 12, 18].map(h => {
                const angle = (h / 24) * Math.PI * 2 - Math.PI / 2;
                const lx = Math.cos(angle) * (RADIUS + 2);
                const ly = Math.sin(angle) * (RADIUS + 2);
                return (
                  <text key={h} x={lx} y={ly} fontSize={9} fontWeight={700} fill="var(--text-muted)" textAnchor="middle" dominantBaseline="middle">
                    {hourLabel(h)}
                  </text>
                );
              })}
            </g>
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent-2)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Peak Hour</span>
            <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', marginTop: 2 }}>{hourLabel(peak.hour)}</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{formatINR(peak.total)}</span>
          </div>
        </div>
      </div>
      <p style={{ fontSize: 10.5, color: 'var(--text-muted)', textAlign: 'center', marginTop: 12, lineHeight: 1.4 }}>
        Based on when each expense was logged in the app, not necessarily the exact purchase time.
      </p>
    </div>
  );
}
