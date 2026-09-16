'use client';

import { useMemo } from 'react';
import { Category, Expense, SavingsGoal, formatINR } from '@/lib/types';
import { auditFinancialHealth } from '@/lib/localAiCoach';
import { ShieldCheck, Compass, Award, CheckCircle2, AlertTriangle, Lightbulb } from 'lucide-react';

interface AiCoachCardProps {
  salary: number;
  expenses: Expense[];
  categories: Category[];
  savingsGoals?: SavingsGoal[];
}

export function AiCoachCard({ salary, expenses, categories, savingsGoals = [] }: AiCoachCardProps) {
  const audit = useMemo(() => {
    return auditFinancialHealth(salary, expenses, categories, savingsGoals);
  }, [salary, expenses, categories, savingsGoals]);

  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 24, padding: 24, marginBottom: 24,
      animation: 'fade-in-up 0.4s var(--ease) both', position: 'relative', overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', top: -60, left: -40, width: 180, height: 180,
        background: 'radial-gradient(circle, color-mix(in srgb, var(--accent) 12%, transparent) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 13, flexShrink: 0,
            background: 'var(--accent-grad)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
            boxShadow: '0 6px 16px -4px color-mix(in srgb, var(--accent) 55%, transparent)',
          }}>
            <Compass size={20} />
          </div>
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>AI CFO Health Coach</h2>
            <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>50/30/20 Wealth Rule & Financial Audit</p>
          </div>
        </div>
        <div style={{
          padding: '6px 12px', borderRadius: 9999, background: 'var(--accent-dim)', color: 'var(--accent-2)',
          fontSize: 12.5, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0,
        }}>
          <Award size={14} /> {audit.wealthVelocityScore}
        </div>
      </div>

      <div style={{ background: 'var(--bg-elevated)', borderRadius: 16, padding: 16, border: '1px solid var(--border)', marginBottom: 16, position: 'relative' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 14 }}>
          50/30/20 Rule Allocation Audit
        </div>

        {[
          { emoji: '🏠', label: 'Needs', target: 'Target ≤ 50%', pct: audit.rule503020.needsPct, amount: audit.rule503020.needsSpent, limit: 50, overColor: 'var(--warning)', okColor: '#3B82F6' },
          { emoji: '🛍️', label: 'Wants', target: 'Target ≤ 30%', pct: audit.rule503020.wantsPct, amount: audit.rule503020.wantsSpent, limit: 30, overColor: 'var(--danger)', okColor: '#EC4899' },
        ].map((row, i) => {
          const isOver = row.pct > row.limit;
          return (
            <div key={row.label} style={{ marginBottom: 12, animation: `fade-in-up 0.35s var(--ease) ${i * 0.06}s both` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 600, marginBottom: 5 }}>
                <span style={{ color: 'var(--text-primary)' }}>{row.emoji} {row.label} <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>({row.target})</span></span>
                <span style={{ color: isOver ? row.overColor : 'var(--success)', fontWeight: 700 }}>{formatINR(row.amount)} ({row.pct}%)</span>
              </div>
              <div style={{ height: 7, background: 'var(--bg-card)', borderRadius: 99, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.min(100, row.pct)}%`, background: isOver ? row.overColor : row.okColor, borderRadius: 99, transition: 'width 0.7s var(--ease)' }} />
              </div>
            </div>
          );
        })}

        <div style={{ animation: 'fade-in-up 0.35s var(--ease) 0.12s both' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 600, marginBottom: 5 }}>
            <span style={{ color: 'var(--text-primary)' }}>🎯 Savings Retained <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>(Target ≥ 20%)</span></span>
            <span style={{ color: audit.rule503020.savingsPct >= 20 ? 'var(--success)' : 'var(--warning)', fontWeight: 700 }}>{formatINR(audit.rule503020.savingsRetained)} ({audit.rule503020.savingsPct}%)</span>
          </div>
          <div style={{ height: 7, background: 'var(--bg-card)', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.min(100, audit.rule503020.savingsPct)}%`, background: audit.rule503020.savingsPct >= 20 ? 'var(--success)' : 'var(--warning)', borderRadius: 99, transition: 'width 0.7s var(--ease)' }} />
          </div>
        </div>
      </div>

      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderRadius: 16, marginBottom: 20, position: 'relative',
        background: 'var(--accent-dim)', border: '1px solid var(--border-glow)',
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: 11, flexShrink: 0,
          background: 'color-mix(in srgb, var(--accent) 22%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-2)',
        }}>
          <ShieldCheck size={19} />
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Emergency Runway: {audit.emergencyRunwayMonths} Months</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Liquid savings cover {audit.emergencyRunwayMonths} months of mandatory bills</div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, position: 'relative' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>AI Recommended Action Items</div>
        {audit.weeklyActionCards.map((card, idx) => {
          const color = card.type === 'success' ? 'var(--success)' : card.type === 'warning' ? 'var(--warning)' : 'var(--accent-2)';
          const bg = card.type === 'success' ? 'var(--success-dim)' : card.type === 'warning' ? 'var(--warning-dim)' : 'var(--accent-dim)';
          return (
            <div
              key={idx}
              style={{
                padding: '12px 14px', borderRadius: 14, background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                display: 'flex', gap: 12, alignItems: 'flex-start',
                animation: `fade-in-up 0.3s var(--ease) ${0.15 + idx * 0.06}s both`,
              }}
            >
              <div style={{
                width: 30, height: 30, borderRadius: 9, flexShrink: 0, marginTop: 1,
                background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color,
              }}>
                {card.type === 'success' ? <CheckCircle2 size={16} /> : card.type === 'warning' ? <AlertTriangle size={16} /> : <Lightbulb size={16} />}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>{card.title}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4 }}>{card.desc}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
