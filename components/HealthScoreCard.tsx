'use client';

import { useState, useMemo } from 'react';
import { Category, formatINR } from '@/lib/types';
import { ChevronDown, ChevronUp, Activity, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';

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
    const targetSavings = income * 0.20; // 20% savings goal
    
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
        catScore -= 10; // Lose 10 pts per overage category
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
      score: Math.min(100, Math.round(totalScore)), // Cap at 100
      catalog: items 
    };
  }, [spent, budget, income, categories, activeTotalsMap, isAnnual, historicalAverage]);

  let scoreColor = 'var(--success)';
  if (score < 50) scoreColor = 'var(--danger)';
  else if (score < 80) scoreColor = 'var(--warning)';

  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 20, marginBottom: 24, overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
      {/* Header / Summary */}
      <div 
        onClick={() => setExpanded(!expanded)}
        style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', background: expanded ? 'var(--bg-elevated)' : 'transparent', transition: 'background 0.2s' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {/* Score Circle */}
          <div style={{ position: 'relative', width: 64, height: 64, borderRadius: '50%', background: `color-mix(in srgb, ${scoreColor} 15%, transparent)`, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `2px solid ${scoreColor}` }}>
            <span style={{ fontSize: 22, fontWeight: 800, color: scoreColor }}>{score}</span>
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <Activity size={16} color="var(--text-secondary)" />
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Financial Health</span>
            </div>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>
              {score >= 80 ? 'Looking Great!' : score >= 50 ? 'Needs Attention' : 'Critical Warning'}
            </div>
          </div>
        </div>
        <div>
          {expanded ? <ChevronUp color="var(--text-muted)" /> : <ChevronDown color="var(--text-muted)" />}
        </div>
      </div>

      {/* Expandable Catalog */}
      {expanded && (
        <div style={{ padding: '0 24px 24px 24px', borderTop: '1px solid var(--border)' }}>
          <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: '20px 0 16px 0' }}>Score Breakdown</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {catalog.map(item => {
              const Icon = item.status === 'good' ? CheckCircle2 : item.status === 'warning' ? AlertTriangle : XCircle;
              const color = item.status === 'good' ? 'var(--success)' : item.status === 'warning' ? 'var(--warning)' : 'var(--danger)';
              
              return (
                <div key={item.id} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{ marginTop: 2 }}>
                    <Icon size={18} color={color} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{item.aspect}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color }}>{Math.round(item.impact)} pts</span>
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
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
