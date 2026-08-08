'use client';

import { useState, useMemo, useDeferredValue } from 'react';
import { Category, formatINR } from '@/lib/types';
import { Clock } from 'lucide-react';

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
    // If not current month, projections don't make sense, but we'll simulate it based on end of that month.
    const isCurrentMonth = today.getMonth() === selectedMonth && today.getFullYear() === selectedYear;
    
    const currentDay = isCurrentMonth ? today.getDate() : 30; // approx
    
    // Determine max days forward for the slider
    const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    let maxDaysForward = 0;
    if (isCurrentMonth) {
      maxDaysForward = daysInMonth - today.getDate();
    } else if (today.getFullYear() < selectedYear || (today.getFullYear() === selectedYear && today.getMonth() < selectedMonth)) {
      maxDaysForward = daysInMonth; // full future month
    }

    // Ensure we don't project past the end of the month based on the slider limit
    // 1. Separate Fixed vs Variable
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

    // 2. Variable Projection (Smoothed)
    const variablePerDay = currentDay > 0 ? currentVariableSpent / currentDay : 0;
    const projectedVariableFuture = variablePerDay * deferredDays;

    // 3. Final Projected Numbers
    const totalProjectedSpend = spent + projectedVariableFuture + expectedFixedFuture;
    const totalProjectedIncome = income + (deferredDays > (30 - currentDay) ? income : 0); // If we cross a month, we get another paycheck
    
    return {
      projectedSpend: totalProjectedSpend,
      projectedIncome: totalProjectedIncome,
      projectedSavings: totalProjectedIncome - totalProjectedSpend,
      projectedRemainingBudget: Math.max(0, budget - totalProjectedSpend)
    };

  }, [deferredDays, spent, budget, income, categories, activeTotalsMap, selectedMonth, selectedYear]);

  // Compute max days forward for rendering the slider
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
    return null; // Don't show projection for past months or the very last day of the month
  }

  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 20, padding: 24, marginBottom: 24, position: 'relative', overflow: 'hidden' }}>
      
      {/* Background Glow when active */}
      {deferredDays > 0 && (
        <div style={{ position: 'absolute', top: -50, right: -50, width: 200, height: 200, background: 'var(--accent)', filter: 'blur(80px)', opacity: 0.15, borderRadius: '50%', pointerEvents: 'none' }} />
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <Clock size={18} color="var(--accent)" />
        <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Time Travel Projection</h3>
      </div>

      <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 24 }}>
        Drag to see your projected cash flow in the future based on your current burn rate and upcoming fixed bills.
      </p>

      {/* The Slider */}
      <div style={{ marginBottom: 24 }}>
        <input 
          type="range" 
          min="0" 
          max={maxDaysForwardRender} 
          step="1"
          value={daysForward}
          onChange={(e) => setDaysForward(parseInt(e.target.value))}
          style={{ width: '100%', accentColor: 'var(--accent)', cursor: 'pointer' }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginTop: 8 }}>
          <span>{isCurrentMonthRender ? 'Today' : 'Start of Month'}</span>
          <span>End of Month (+{maxDaysForwardRender}d)</span>
        </div>
      </div>

      {/* The Projection Data */}
      {projection && deferredDays > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, animation: 'fadeIn 0.3s ease-out' }}>
          
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>In {deferredDays} days, your total spent will be roughly:</span>
          </div>
          
          <div style={{ fontSize: 40, fontWeight: 800, color: projection.projectedSpend > budget ? 'var(--danger)' : 'var(--text-primary)', letterSpacing: '-1px', lineHeight: 1 }}>
            {formatINR(projection.projectedSpend)}
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1, background: 'var(--bg-elevated)', borderRadius: 12, padding: 12, border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Projected Savings</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: projection.projectedSavings > 0 ? 'var(--success)' : 'var(--danger)' }}>
                {formatINR(projection.projectedSavings)}
              </div>
            </div>
            <div style={{ flex: 1, background: 'var(--bg-elevated)', borderRadius: 12, padding: 12, border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Budget Remaining</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
                {formatINR(projection.projectedRemainingBudget)}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ height: 116, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px dashed var(--border)', borderRadius: 16 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-muted)' }}>Drag the slider to project the future</span>
        </div>
      )}

    </div>
  );
}
