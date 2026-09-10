'use client';

import { useState, useMemo } from 'react';
import { Category, formatINR } from '@/lib/types';
import { ChevronDown, ChevronUp, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';

interface HealthScoreCardProps {
  spent: number;
  budget: number;
  income: number;
  safePerDay: number;
  categories: Category[];
  activeTotalsMap: Record<string, number>;
  historicalAverage?: number;
  isAnnual: boolean;
}

type CatalogItem = {
  id: string;
  aspect: string;
  status: 'good' | 'warning' | 'bad';
  message: string;
  impact: number;
};

function ScoreRing({ score, color }: { score: number; color: string }) {
  const size = 72;
  const strokeWidth = 7;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(100, Math.max(0, score));
  const dashOffset = circumference - (progress / 100) * circumference;

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        {/* Track */}
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none"
          stroke="var(--bg-elevated)"
          strokeWidth={strokeWidth}
        />
        {/* Progress */}
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.16, 1, 0.3, 1)' }}
        />
      </svg>
      {/* Score label */}
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column',
      }}>
        <span style={{ fontSize: 20, fontWeight: 900, color, lineHeight: 1, letterSpacing: '-0.5px' }}>{score}</span>
      </div>
    </div>
  );
}

export function HealthScoreCard({ spent, budget, income, safePerDay, categories, activeTotalsMap, historicalAverage, isAnnual }: HealthScoreCardProps) {
  const [expanded, setExpanded] = useState(false);

  const { score, catalog } = useMemo(() => {
    let totalScore = 0;
    const items: CatalogItem[] = [];

    // 1. Overall Budget Utilization (Max 40 pts)
    let budgetScore = 0;
    let budgetStatus: 'good' | 'warning' | 'bad' = 'good';
    let budgetMsg = '';

    if (budget === 0) {
      budgetScore = 40;
      budgetMsg = 'No budget limit set.';
    } else {
      const pct = (spent / budget) * 100;
      if (pct <= 80) {
        budgetScore = 40;
        budgetMsg = `Great! You've only used ${pct.toFixed(0)}% of your total budget.`;
      } else if (pct <= 100) {
        budgetScore = Math.max(0, 40 - ((pct - 80) / 20 * 40));
        budgetStatus = 'warning';
        budgetMsg = `You are nearing your total budget limit (${pct.toFixed(0)}% used).`;
      } else {
        budgetScore = 0;
        budgetStatus = 'bad';
        budgetMsg = `You have exceeded your total budget by ${formatINR(spent - budget)}.`;
      }
    }
    items.push({ id: 'budget', aspect: 'Total Budget', status: budgetStatus, message: budgetMsg, impact: budgetScore });
    totalScore += budgetScore;

    // 2. Savings Target (Max 30 pts)
    let savingsScore = 0;
    let savingsStatus: 'good' | 'warning' | 'bad' = 'good';
    let savingsMsg = '';
    const savings = income - spent;
    const targetSavings = income * 0.20;

    if (income === 0) {
      savingsScore = 30;
      savingsMsg = 'No income set to calculate savings.';
    } else if (savings >= targetSavings) {
      savingsScore = 30;
      savingsMsg = `Excellent! You are saving over 20% of your income (${formatINR(savings)}).`;
    } else if (savings > 0) {
      savingsScore = (savings / targetSavings) * 30;
      savingsStatus = 'warning';
      savingsMsg = `You are saving money, but below the 20% target.`;
    } else {
      savingsScore = 0;
      savingsStatus = 'bad';
      savingsMsg = `You are spending more than you earn!`;
    }
    items.push({ id: 'savings', aspect: 'Savings Goal', status: savingsStatus, message: savingsMsg, impact: savingsScore });
    totalScore += savingsScore;

    // 3. Category Discipline (Max 30 pts)
    let catScore = 30;
    const overageCategories = [];

    for (const cat of categories) {
      const catSpent = activeTotalsMap[cat.id] ?? 0;
      const catLimit = isAnnual ? cat.monthlyBudget * 12 : cat.monthlyBudget;

      if (catLimit > 0 && catSpent > catLimit) {
        overageCategories.push(cat.name);
        catScore -= 10;
      }
    }

    catScore = Math.max(0, catScore);
    let catStatus: 'good' | 'warning' | 'bad' = 'good';
    let catMsg = 'All categories are within their limits.';

    if (overageCategories.length > 0) {
      catStatus = overageCategories.length > 2 ? 'bad' : 'warning';
      catMsg = `Over budget in: ${overageCategories.join(', ')}.`;
    }
    items.push({ id: 'categories', aspect: 'Category Discipline', status: catStatus, message: catMsg, impact: catScore });
    totalScore += catScore;

    // 4. Historical Momentum (Bonus up to 10 pts)
    if (!isAnnual && historicalAverage && historicalAverage > 0) {
      let momentumScore = 0;
      let momentumStatus: 'good' | 'warning' | 'bad' = 'good';
      let momentumMsg = '';

      if (spent < historicalAverage) {
        momentumScore = 10;
        momentumMsg = `Awesome! You are spending less than your 3-month average of ${formatINR(historicalAverage)}.`;
      } else {
        momentumStatus = 'warning';
        momentumMsg = `You are spending more than your 3-month average of ${formatINR(historicalAverage)}.`;
      }
      items.push({ id: 'momentum', aspect: 'Historical Momentum', status: momentumStatus, message: momentumMsg, impact: momentumScore });
      totalScore += momentumScore;
    }

    return {
      score: Math.min(100, Math.round(totalScore)),
      catalog: items
    };
  }, [spent, budget, income, categories, activeTotalsMap, isAnnual, historicalAverage]);

  let scoreColor = 'var(--success)';
  let scoreBg = 'var(--success-dim)';
  let scoreLabel = 'Looking Great!';
  let scoreEmoji = '🟢';
  if (score < 50) {
    scoreColor = 'var(--danger)';
    scoreBg = 'var(--danger-dim)';
    scoreLabel = 'Critical Warning';
    scoreEmoji = '🔴';
  } else if (score < 80) {
    scoreColor = 'var(--warning)';
    scoreBg = 'var(--warning-dim)';
    scoreLabel = 'Needs Attention';
    scoreEmoji = '🟡';
  }

  const statusConfig = {
    good:    { Icon: CheckCircle2, color: 'var(--success)', bg: 'var(--success-dim)', label: 'Good' },
    warning: { Icon: AlertTriangle, color: 'var(--warning)', bg: 'var(--warning-dim)', label: 'Warning' },
    bad:     { Icon: XCircle,      color: 'var(--danger)',  bg: 'var(--danger-dim)',  label: 'Issue' },
  };

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 24,
      marginBottom: 20,
      overflow: 'hidden',
    }}>
      {/* Header / Summary */}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          padding: '20px 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          cursor: 'pointer',
          transition: 'background 0.2s',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-elevated)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <ScoreRing score={score} color={scoreColor} />
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 4 }}>
              Financial Health
            </div>
            <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.3px', marginBottom: 4 }}>
              {scoreLabel}
            </div>
            {/* Mini progress bar */}
            <div style={{ width: 120, height: 4, background: 'var(--bg-elevated)', borderRadius: 99, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${score}%`,
                background: scoreColor,
                borderRadius: 99,
                transition: 'width 0.8s var(--ease)',
              }} />
            </div>
          </div>
        </div>
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          background: 'var(--bg-elevated)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: '1px solid var(--border)',
          flexShrink: 0,
        }}>
          {expanded ? <ChevronUp size={16} color="var(--text-muted)" /> : <ChevronDown size={16} color="var(--text-muted)" />}
        </div>
      </div>

      {/* Expandable Catalog */}
      {expanded && (
        <div style={{ padding: '0 20px 20px 20px', borderTop: '1px solid var(--border)' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.6px', margin: '18px 0 14px' }}>
            Score Breakdown
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {catalog.map(item => {
              const { Icon, color, bg } = statusConfig[item.status];

              return (
                <div key={item.id} style={{
                  display: 'flex', gap: 12, alignItems: 'flex-start',
                  background: 'var(--bg-elevated)',
                  borderRadius: 14, padding: '12px 14px',
                  border: `1px solid ${item.status === 'good' ? 'var(--border)' : color + '33'}`,
                  borderLeft: `3px solid ${color}`,
                }}>
                  <div style={{
                    width: 30, height: 30, borderRadius: 8,
                    background: bg, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    marginTop: 1,
                  }}>
                    <Icon size={16} color={color} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{item.aspect}</span>
                      <span style={{
                        fontSize: 12, fontWeight: 800, color,
                        background: bg, padding: '2px 8px', borderRadius: 99,
                      }}>{Math.round(item.impact)} pts</span>
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      {item.message}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
