'use client';

import { useState, useMemo, useDeferredValue } from 'react';
import { Category, formatINR } from '@/lib/types';
import { Clock, PiggyBank, Wallet } from 'lucide-react';

interface TimeTravelSliderProps {
  spent: number;
  budget: number;
  income: number;
  categories: Category[];
  activeTotalsMap: Record<string, number>;
  selectedMonth: number;
  selectedYear: number;
}

export function TimeTravelSlider({ spent, budget, income, categories, activeTotalsMap, selectedMonth, selectedYear }: TimeTravelSliderProps) {
  const [daysForward, setDaysForward] = useState(0);
  const deferredDays = useDeferredValue(daysForward);

  const projection = useMemo(() => {
    if (deferredDays === 0) return null;

    const today = new Date();
    const isCurrentMonth = today.getMonth() === selectedMonth && today.getFullYear() === selectedYear;
    
    const currentDay = isCurrentMonth ? today.getDate() : 30;
    
    const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    let maxDaysForward = 0;
    if (isCurrentMonth) {
      maxDaysForward = daysInMonth - today.getDate();
    } else if (today.getFullYear() < selectedYear || (today.getFullYear() === selectedYear && today.getMonth() < selectedMonth)) {
      maxDaysForward = daysInMonth;
    }

    const FIXED_CATEGORIES = ['Rent', 'Family', 'Investment', 'Subscriptions', 'Electricity', 'Internet', 'Insurance'];
    
    let currentVariableSpent = 0;
    let expectedFixedFuture = 0;
    
    categories.forEach(cat => {
      const catSpent = activeTotalsMap[cat.id] ?? 0;
      const isFixed = FIXED_CATEGORIES.some(f => cat.name.toLowerCase().includes(f.toLowerCase()));
      
      if (isFixed) {
        const currentMonthRemainingDays = daysInMonth - currentDay;
        if (deferredDays > currentMonthRemainingDays) {
          expectedFixedFuture += cat.monthlyBudget;
        }
      } else {
        currentVariableSpent += catSpent;
      }
    });

    const variablePerDay = currentDay > 0 ? currentVariableSpent / currentDay : 0;
    const projectedVariableFuture = variablePerDay * deferredDays;

    const totalProjectedSpend = spent + projectedVariableFuture + expectedFixedFuture;
    const totalProjectedIncome = income;
    
    return {
      projectedSpend: totalProjectedSpend,
      projectedIncome: totalProjectedIncome,
      projectedSavings: totalProjectedIncome - totalProjectedSpend,
      projectedRemainingBudget: Math.max(0, budget - totalProjectedSpend)
    };

  }, [deferredDays, spent, budget, income, categories, activeTotalsMap, selectedMonth, selectedYear]);

  const todayForRender = new Date();
  const isCurrentMonthRender = todayForRender.getMonth() === selectedMonth && todayForRender.getFullYear() === selectedYear;
  const daysInMonthRender = new Date(selectedYear, selectedMonth + 1, 0).getDate();
  let maxDaysForwardRender = 0;
  if (isCurrentMonthRender) {
    maxDaysForwardRender = daysInMonthRender - todayForRender.getDate();
  } else if (todayForRender.getFullYear() < selectedYear || (todayForRender.getFullYear() === selectedYear && todayForRender.getMonth() < selectedMonth)) {
    maxDaysForwardRender = daysInMonthRender;
  }

  if (maxDaysForwardRender <= 0) {
    return null;
  }

  const sliderPct = maxDaysForwardRender > 0 ? (daysForward / maxDaysForwardRender) * 100 : 0;
  const isOverBudget = !!projection && projection.projectedSpend > budget;

  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 20, padding: 24, marginBottom: 24, position: 'relative', overflow: 'hidden', animation: 'fade-in-up 0.4s var(--ease) both' }}>
      
      {deferredDays > 0 && (
        <div style={{
          position: 'absolute', top: -50, right: -50, width: 200, height: 200,
          background: isOverBudget ? 'var(--danger)' : 'var(--accent)',
          filter: 'blur(80px)', opacity: 0.15, borderRadius: '50%', pointerEvents: 'none',
          transition: 'background 0.3s ease',
        }} />
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, position: 'relative' }}>
        <div style={{
          width: 36, height: 36, borderRadius: 11, flexShrink: 0,
          background: 'var(--accent-grad)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
          boxShadow: '0 6px 16px -4px color-mix(in srgb, var(--accent) 55%, transparent)',
        }}>
          <Clock size={17} />
        </div>
        <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Time Travel Projection</h3>
      </div>

      <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 24, position: 'relative' }}>
        Drag to see your projected cash flow in the future based on your current burn rate and upcoming fixed bills.
      </p>

      <div style={{ marginBottom: 24, position: 'relative' }}>
        <input 
          type="range" 
          min="0" 
          max={maxDaysForwardRender} 
          step="1"
          value={daysForward}
          onChange={(e) => setDaysForward(parseInt(e.target.value))}
          className="styled-range"
          style={{
            background: `linear-gradient(to right, ${isOverBudget ? 'var(--danger)' : 'var(--accent)'} 0%, ${isOverBudget ? 'var(--danger)' : 'var(--accent)'} ${sliderPct}%, var(--bg-elevated) ${sliderPct}%, var(--bg-elevated) 100%)`,
            animation: daysForward === 0 ? 'invite-pulse 2s ease-in-out infinite' : 'none',
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginTop: 10 }}>
          <span>{isCurrentMonthRender ? 'Today' : 'Start of Month'}</span>
          <span>End of Month (+{maxDaysForwardRender}d)</span>
        </div>
      </div>

      {projection && deferredDays > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, animation: 'fade-in-up 0.35s var(--ease) both', position: 'relative' }}>
          
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>In {deferredDays} days, your total spent will be roughly:</span>
          </div>
          
          <div style={{ fontSize: 40, fontWeight: 800, color: isOverBudget ? 'var(--danger)' : 'var(--text-primary)', letterSpacing: '-1px', lineHeight: 1, transition: 'color 0.3s' }}>
            {formatINR(projection.projectedSpend)}
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg-elevated)', borderRadius: 14, padding: 12, border: '1px solid var(--border)' }}>
              <div style={{
                width: 30, height: 30, borderRadius: 9, flexShrink: 0,
                background: projection.projectedSavings > 0 ? 'var(--success-dim)' : 'var(--danger-dim)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: projection.projectedSavings > 0 ? 'var(--success)' : 'var(--danger)',
              }}>
                <PiggyBank size={15} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Savings</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: projection.projectedSavings > 0 ? 'var(--success)' : 'var(--danger)' }}>
                  {formatINR(projection.projectedSavings)}
                </div>
              </div>
            </div>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg-elevated)', borderRadius: 14, padding: 12, border: '1px solid var(--border)' }}>
              <div style={{
                width: 30, height: 30, borderRadius: 9, flexShrink: 0,
                background: 'var(--accent-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-2)',
              }}>
                <Wallet size={15} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Budget Left</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                  {formatINR(projection.projectedRemainingBudget)}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ height: 116, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px dashed var(--border)', borderRadius: 16, position: 'relative' }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-muted)' }}>Drag the slider to project the future</span>
        </div>
      )}

    </div>
  );
}
