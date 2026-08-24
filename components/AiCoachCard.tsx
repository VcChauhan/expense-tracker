'use client';

import { useMemo } from 'react';
import { Category, Expense, SavingsGoal, formatINR } from '@/lib/types';
import { auditFinancialHealth } from '@/lib/localAiCoach';
import { ShieldCheck, TrendingUp, Compass, Award, CheckCircle2, AlertTriangle, Lightbulb } from 'lucide-react';

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
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 24, padding: 24, marginBottom: 24, boxShadow: '0 8px 32px rgba(0,0,0,0.04)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 14, background: 'color-mix(in srgb, var(--accent) 15%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
            <Compass size={22} />
          </div>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>AI CFO Health Coach</h2>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>50/30/20 Wealth Rule & Financial Audit</p>
          </div>
        </div>
        <div style={{ padding: '6px 14px', borderRadius: 9999, background: 'color-mix(in srgb, var(--accent) 15%, transparent)', color: 'var(--accent)', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Award size={16} /> Velocity {audit.wealthVelocityScore}/100
        </div>
      </div>

      {/* 50/30/20 Rule Progress Bars */}
      <div style={{ background: 'var(--bg-elevated)', borderRadius: 16, padding: 16, border: '1px solid var(--border)', marginBottom: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>
          50/30/20 Rule Allocation Audit
        </div>

        {/* Needs (50%) */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
            <span style={{ color: 'var(--text-primary)' }}>🏠 Needs (Target ≤ 50%)</span>
            <span style={{ color: audit.rule503020.needsPct > 50 ? 'var(--warning)' : 'var(--success)' }}>{formatINR(audit.rule503020.needsSpent)} ({audit.rule503020.needsPct}%)</span>
          </div>
          <div style={{ height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.min(100, audit.rule503020.needsPct)}%`, background: audit.rule503020.needsPct > 50 ? 'var(--warning)' : '#3B82F6', borderRadius: 3, transition: 'width 0.5s ease' }} />
          </div>
        </div>

        {/* Wants (30%) */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
            <span style={{ color: 'var(--text-primary)' }}>🛍️ Wants (Target ≤ 30%)</span>
            <span style={{ color: audit.rule503020.wantsPct > 30 ? 'var(--danger)' : 'var(--success)' }}>{formatINR(audit.rule503020.wantsSpent)} ({audit.rule503020.wantsPct}%)</span>
          </div>
          <div style={{ height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.min(100, audit.rule503020.wantsPct)}%`, background: audit.rule503020.wantsPct > 30 ? 'var(--danger)' : '#EC4899', borderRadius: 3, transition: 'width 0.5s ease' }} />
          </div>
        </div>

        {/* Savings (20%) */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
            <span style={{ color: 'var(--text-primary)' }}>🎯 Savings Retained (Target ≥ 20%)</span>
            <span style={{ color: audit.rule503020.savingsPct >= 20 ? 'var(--success)' : 'var(--warning)' }}>{formatINR(audit.rule503020.savingsRetained)} ({audit.rule503020.savingsPct}%)</span>
          </div>
          <div style={{ height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.min(100, audit.rule503020.savingsPct)}%`, background: audit.rule503020.savingsPct >= 20 ? 'var(--success)' : 'var(--warning)', borderRadius: 3, transition: 'width 0.5s ease' }} />
          </div>
        </div>
      </div>

      {/* Emergency Runway Metric */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: 'color-mix(in srgb, var(--accent) 8%, transparent)', borderRadius: 16, border: '1px solid color-mix(in srgb, var(--accent) 25%, transparent)', marginBottom: 20 }}>
        <ShieldCheck size={24} color="var(--accent)" />
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Emergency Runway: {audit.emergencyRunwayMonths} Months</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Liquid savings cover {audit.emergencyRunwayMonths} months of mandatory bills</div>
        </div>
      </div>

      {/* Weekly Action Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>AI Recommended Action Items</div>
        {audit.weeklyActionCards.map((card, idx) => (
          <div key={idx} style={{ padding: '12px 16px', borderRadius: 14, background: 'var(--bg-elevated)', border: '1px solid var(--border)', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div style={{ marginTop: 2, color: card.type === 'success' ? 'var(--success)' : card.type === 'warning' ? 'var(--warning)' : 'var(--accent)' }}>
              {card.type === 'success' ? <CheckCircle2 size={18} /> : card.type === 'warning' ? <AlertTriangle size={18} /> : <Lightbulb size={18} />}
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>{card.title}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4 }}>{card.desc}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
