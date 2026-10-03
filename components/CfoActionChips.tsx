'use client';

import { Sparkles, CheckCircle2, AlertTriangle, Lightbulb, ShieldCheck } from 'lucide-react';

interface ActionItem {
  id: string;
  badge: string;
  title: string;
  detail: string;
  type: 'success' | 'warning' | 'tip';
}

interface CfoActionChipsProps {
  items: ActionItem[];
  isLlmActive?: boolean;
}

export function CfoActionChips({ items, isLlmActive = true }: CfoActionChipsProps) {
  if (!items || items.length === 0) return null;

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>
          Tactical AI Action Plan
        </div>
        <span style={{ fontSize: 10, fontWeight: 800, color: '#10b981', display: 'flex', alignItems: 'center', gap: 3 }}>
          <ShieldCheck size={11} /> {isLlmActive ? 'Gemma 2B' : 'Local Engine'}
        </span>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: 10,
      }}>
        {items.map((item) => {
          const isSuccess = item.type === 'success';
          const isWarning = item.type === 'warning';
          const accentColor = isSuccess ? 'var(--success)' : isWarning ? 'var(--warning)' : 'var(--accent-2)';
          const bgDim = isSuccess ? 'rgba(16,185,129,0.12)' : isWarning ? 'rgba(245,158,11,0.12)' : 'var(--accent-dim)';

          return (
            <div
              key={item.id}
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderLeft: `3px solid ${accentColor}`,
                borderRadius: 16,
                padding: '12px 14px',
                boxShadow: 'var(--shadow-xs)',
                display: 'flex',
                gap: 10,
                alignItems: 'flex-start',
              }}
            >
              <div style={{
                width: 28, height: 28, borderRadius: 8,
                background: bgDim, color: accentColor,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, marginTop: 1,
              }}>
                {isSuccess ? <CheckCircle2 size={15} /> : isWarning ? <AlertTriangle size={15} /> : <Lightbulb size={15} />}
              </div>

              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <span style={{
                    fontSize: 9.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.4px',
                    padding: '1px 6px', borderRadius: 99, background: bgDim, color: accentColor,
                  }}>
                    {item.badge}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {item.title}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  {item.detail}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
