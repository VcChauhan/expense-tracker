'use client';

import { useState, useEffect, useMemo } from 'react';
import { formatINR, Settings, MonthlyAnalytics, Category } from '@/lib/types';
import { CategoryIcon } from '@/components/CategoryIcon';
import { PieChart, TrendingUp, TrendingDown, Minus, AlertTriangle, Activity, Calendar } from 'lucide-react';

export default function InsightsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [currentMonthData, setCurrentMonthData] = useState<MonthlyAnalytics | null>(null);
  const [prevMonthData, setPrevMonthData] = useState<MonthlyAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  
  const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonth = prevDate.getMonth() + 1;
  const prevYear = prevDate.getFullYear();

  const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
  const currentDay = now.getDate();
  const daysRemaining = daysInMonth - currentDay;

  useEffect(() => {
    Promise.all([
      fetch('/api/settings').then(r => r.json()),
      fetch(`/api/analytics/monthly?month=${currentMonth}&year=${currentYear}`).then(r => r.json()),
      fetch(`/api/analytics/monthly?month=${prevMonth}&year=${prevYear}`).then(r => r.json()),
    ]).then(([s, curr, prev]) => {
      if (s && !s.error) setSettings(s);
      if (curr && !curr.error) setCurrentMonthData(curr);
      if (prev && !prev.error) setPrevMonthData(prev);
      setLoading(false);
    });
  }, [currentMonth, currentYear, prevMonth, prevYear]);

  // Derived calculations
  const totalBudget = useMemo(() => {
    return (settings?.categories || []).reduce((sum, cat) => sum + cat.monthlyBudget, 0);
  }, [settings]);

  const totalSpent = currentMonthData?.overall || 0;
  const prevSpent = prevMonthData?.overall || 0;
  
  const budgetUsedPct = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;
  
  let scoreColor = 'var(--success)';
  if (budgetUsedPct > 85) scoreColor = 'var(--danger)';
  else if (budgetUsedPct > 60) scoreColor = 'var(--warning)';

  const dailyAvg = currentDay > 0 ? totalSpent / currentDay : 0;
  const safeToSpend = daysRemaining > 0 ? Math.max(0, totalBudget - totalSpent) / daysRemaining : 0;
  const projectedEnd = dailyAvg * daysInMonth;

  const categoryHealth = useMemo(() => {
    if (!settings || !currentMonthData) return [];
    
    return settings.categories.map(cat => {
      const spent = currentMonthData.categoryTotals.find(c => c._id === cat.id)?.total || 0;
      const prevCatSpent = prevMonthData?.categoryTotals.find(c => c._id === cat.id)?.total || 0;
      
      const pct = cat.monthlyBudget > 0 ? (spent / cat.monthlyBudget) * 100 : (spent > 0 ? 100 : 0);
      
      let status: 'track' | 'watch' | 'over' = 'track';
      if (pct > 100) status = 'over';
      else if (pct > 80) status = 'watch';

      let trend: 'up' | 'down' | 'flat' = 'flat';
      if (spent > prevCatSpent * 1.05) trend = 'up';
      else if (spent < prevCatSpent * 0.95) trend = 'down';

      return {
        ...cat,
        spent,
        prevSpent: prevCatSpent,
        pct,
        status,
        trend
      };
    }).filter(c => c.spent > 0 || c.monthlyBudget > 0).sort((a, b) => b.spent - a.spent);
  }, [settings, currentMonthData, prevMonthData]);

  const overspendAlerts = categoryHealth.filter(c => c.pct > 90);

  // Spending Pace Chart Data (Cumulative)
  const paceData = useMemo(() => {
    if (!currentMonthData) return { ideal: [], actual: [], maxVal: 0 };
    
    // Compute daily actuals
    const dailySpend = new Array(daysInMonth).fill(0);
    currentMonthData.recent.forEach(exp => {
      const d = new Date(exp.date).getDate();
      if (d >= 1 && d <= daysInMonth) {
        dailySpend[d - 1] += exp.amount;
      }
    });

    const actual = [];
    let runTotal = 0;
    for (let i = 0; i < currentDay; i++) {
      runTotal += dailySpend[i];
      actual.push(runTotal);
    }

    const ideal = [];
    for (let i = 1; i <= daysInMonth; i++) {
      ideal.push((totalBudget / daysInMonth) * i);
    }

    const maxVal = Math.max(totalBudget, runTotal) * 1.1;
    return { ideal, actual, maxVal };
  }, [currentMonthData, totalBudget, daysInMonth, currentDay]);

  if (loading) return <div className="page-container"><div className="loading-overlay"><div className="spinner" /></div></div>;

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <PieChart size={28} /> Insights & Analytics
        </h1>
        <p className="page-subtitle">Track your spending patterns and category health</p>
      </div>

      {/* Overspend Alerts */}
      {overspendAlerts.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
          {overspendAlerts.map(alert => (
            <div key={alert.id} style={{ 
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', 
              borderRadius: 'var(--radius-md)', padding: '16px', display: 'flex', alignItems: 'flex-start', gap: 12 
            }}>
              <AlertTriangle size={24} color="var(--danger)" style={{ flexShrink: 0 }} />
              <div>
                <div style={{ fontWeight: 700, color: 'var(--danger)', fontSize: 15, marginBottom: 4 }}>
                  {alert.status === 'over' ? 'Over Budget!' : 'Approaching Budget Limit'}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  You have spent <strong>{formatINR(alert.spent)}</strong> in <strong>{alert.name}</strong>, which is {alert.pct.toFixed(0)}% of your {formatINR(alert.monthlyBudget)} budget.
                  {alert.status === 'over' ? ' Consider adjusting your spending.' : ' Keep an eye on it.'}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Spending Scorecard */}
      <div className="card mb-24" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '32px 16px' }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 24 }}>Current Month Budget Used</h2>
        
        {/* Circular Ring */}
        <div style={{ position: 'relative', width: 200, height: 200, marginBottom: 24 }}>
          <svg width="200" height="200" viewBox="0 0 200 200">
            <circle cx="100" cy="100" r="90" fill="none" stroke="var(--bg-input)" strokeWidth="16" />
            <circle cx="100" cy="100" r="90" fill="none" stroke={scoreColor} strokeWidth="16" 
              strokeDasharray={`${Math.min(budgetUsedPct, 100) / 100 * 565.48} 565.48`} 
              strokeLinecap="round" transform="rotate(-90 100 100)" 
              style={{ transition: 'stroke-dasharray 1s ease-out' }}
            />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 42, fontWeight: 800, color: scoreColor, fontFamily: "'Space Grotesk', sans-serif" }}>
              {Math.min(budgetUsedPct, 100).toFixed(0)}%
            </span>
            <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>USED</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>{formatINR(totalSpent)}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Spent so far</div>
          </div>
          <div style={{ width: 1, height: 32, background: 'var(--border)' }} />
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>{formatINR(totalBudget)}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Total Budget</div>
          </div>
        </div>
        
        <div style={{ marginTop: 20, display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--bg-secondary)', padding: '6px 12px', borderRadius: 100, fontSize: 13, color: 'var(--text-secondary)' }}>
          <Calendar size={14} /> {daysRemaining} days remaining in {now.toLocaleDateString('default', { month: 'long' })}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid-3 mb-24" style={{ gap: 16 }}>
        <div className="card" style={{ padding: '16px' }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>Daily Average Spent</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>{formatINR(dailyAvg)}</div>
        </div>
        <div className="card" style={{ padding: '16px' }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>Daily Safe to Spend</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: safeToSpend > dailyAvg ? 'var(--success)' : 'var(--warning)' }}>
            {formatINR(safeToSpend)}
          </div>
        </div>
        <div className="card" style={{ padding: '16px' }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>Projected Month-End</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: projectedEnd > totalBudget ? 'var(--danger)' : 'var(--text-primary)' }}>
            {formatINR(projectedEnd)}
          </div>
        </div>
      </div>

      {/* Month Comparison */}
      <div className="card mb-24">
        <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Activity size={20} /> MoM Comparison
        </h2>
        
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>This Month</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>{formatINR(totalSpent)}</div>
          </div>
          <div style={{ paddingBottom: 6 }}>
            <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>vs {formatINR(prevSpent)}</span>
          </div>
          <div style={{ paddingBottom: 6 }}>
            {totalSpent !== prevSpent && (
              <span style={{
                fontSize: 12, fontWeight: 600, padding: '2px 8px', borderRadius: 100,
                background: totalSpent > prevSpent ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)',
                color: totalSpent > prevSpent ? 'var(--danger)' : 'var(--success)',
                display: 'inline-flex', alignItems: 'center', gap: 2
              }}>
                {totalSpent > prevSpent ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                {Math.abs(((totalSpent - prevSpent) / (prevSpent || 1)) * 100).toFixed(1)}%
              </span>
            )}
          </div>
        </div>

        {/* Stacked comparison bars */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {categoryHealth.slice(0, 5).map(cat => {
            const maxVal = Math.max(cat.spent, cat.prevSpent, 1);
            return (
              <div key={cat.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{cat.name}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: '60px', fontSize: 11, color: 'var(--text-muted)', textAlign: 'right' }}>Now</div>
                    <div style={{ flex: 1, height: 8, background: 'var(--bg-input)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${(cat.spent / maxVal) * 100}%`, background: cat.color, borderRadius: 4 }} />
                    </div>
                    <div style={{ width: '60px', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{formatINR(cat.spent)}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: '60px', fontSize: 11, color: 'var(--text-muted)', textAlign: 'right' }}>Prev</div>
                    <div style={{ flex: 1, height: 8, background: 'var(--bg-input)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${(cat.prevSpent / maxVal) * 100}%`, background: 'var(--text-muted)', opacity: 0.5, borderRadius: 4 }} />
                    </div>
                    <div style={{ width: '60px', fontSize: 12, color: 'var(--text-muted)' }}>{formatINR(cat.prevSpent)}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Category Health Grid */}
      <div className="mb-24">
        <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>Category Health</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {categoryHealth.map(cat => (
            <div key={cat.id} className="card" style={{ padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: `${cat.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <CategoryIcon name={cat.name} size={18} color={cat.color} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{cat.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      {cat.trend === 'up' ? <TrendingUp size={12} color="var(--danger)" /> : 
                       cat.trend === 'down' ? <TrendingDown size={12} color="var(--success)" /> : 
                       <Minus size={12} />}
                      vs last mo
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{formatINR(cat.spent)}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>of {formatINR(cat.monthlyBudget)}</div>
                </div>
              </div>
              
              <div style={{ height: 6, background: 'var(--bg-input)', borderRadius: 3, overflow: 'hidden', marginBottom: 8 }}>
                <div style={{ 
                  height: '100%', 
                  width: `${Math.min(cat.pct, 100)}%`, 
                  background: cat.status === 'over' ? 'var(--danger)' : cat.status === 'watch' ? 'var(--warning)' : 'var(--success)',
                  borderRadius: 3
                }} />
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 600 }}>
                <span style={{ 
                  color: cat.status === 'over' ? 'var(--danger)' : cat.status === 'watch' ? 'var(--warning)' : 'var(--success)' 
                }}>
                  {cat.status === 'over' ? '🚨 Over Budget' : cat.status === 'watch' ? '⚠️ Watch' : '✅ On Track'}
                </span>
                <span style={{ color: 'var(--text-secondary)' }}>{cat.pct.toFixed(1)}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Spending Pace */}
      <div className="card mb-32">
        <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 20 }}>Pace: Actual vs Ideal</h2>
        
        {paceData.maxVal > 0 ? (
          <div style={{ width: '100%', height: 200, position: 'relative' }}>
            <svg viewBox={`0 0 ${daysInMonth * 10} 100`} style={{ width: '100%', height: '100%', overflow: 'visible' }} preserveAspectRatio="none">
              {/* Ideal line */}
              <polyline 
                fill="none" 
                stroke="var(--border)" 
                strokeWidth="2" 
                strokeDasharray="4 4"
                points={paceData.ideal.map((val, i) => `${(i + 1) * 10},${100 - (val / paceData.maxVal) * 100}`).join(' ')} 
              />
              {/* Actual line */}
              <polyline 
                fill="none" 
                stroke="var(--accent-primary)" 
                strokeWidth="3" 
                points={paceData.actual.map((val, i) => `${(i + 1) * 10},${100 - (val / paceData.maxVal) * 100}`).join(' ')} 
              />
              {/* Data point at current day */}
              {paceData.actual.length > 0 && (
                <circle 
                  cx={paceData.actual.length * 10} 
                  cy={100 - (paceData.actual[paceData.actual.length - 1] / paceData.maxVal) * 100} 
                  r="3" 
                  fill="var(--accent-primary)" 
                />
              )}
            </svg>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 11, color: 'var(--text-muted)' }}>
              <span>Day 1</span>
              <span>Day {currentDay}</span>
              <span>Day {daysInMonth}</span>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 0' }}>Not enough data for this month.</div>
        )}
      </div>
    </div>
  );
}
