'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
} from 'recharts';
import { formatINR, MONTHS, SHORT_MONTHS, getBudgetStatus, Settings, Expense } from '@/lib/types';

interface CategoryTotal { _id: string; total: number; count: number; }
interface MonthTotal    { _id: string; total: number; count: number; }

type ViewMode = 'monthly' | 'annual';

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: {name: string; value: number; color: string}[]; label?: string }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: 8, padding: '10px 14px' }}>
        <p style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 6 }}>{label}</p>
        {payload.map((p, i) => (
          <p key={i} style={{ color: p.color, fontWeight: 600, fontSize: 14 }}>
            {p.name}: {formatINR(p.value)}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

const PieTooltip = ({ active, payload }: { active?: boolean; payload?: {name: string; value: number; payload: {color: string}}[] }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: 8, padding: '10px 14px' }}>
        <p style={{ color: payload[0].payload.color, fontWeight: 600, fontSize: 14 }}>{payload[0].name}</p>
        <p style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: 16 }}>{formatINR(payload[0].value)}</p>
      </div>
    );
  }
  return null;
};

export default function DashboardPage() {
  const now = new Date();
  const [viewMode, setViewMode]           = useState<ViewMode>('monthly');
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedYear, setSelectedYear]   = useState(now.getFullYear());
  const [settings, setSettings]           = useState<Settings | null>(null);
  const [categoryTotals, setCategoryTotals] = useState<CategoryTotal[]>([]);
  const [annualCategoryTotals, setAnnualCategoryTotals] = useState<CategoryTotal[]>([]);
  const [monthTotals, setMonthTotals]     = useState<MonthTotal[]>([]);
  const [recentExpenses, setRecentExpenses] = useState<Expense[]>([]);
  const [loading, setLoading]             = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [settingsRes, monthlyRes, annualRes] = await Promise.all([
        fetch('/api/settings'),
        fetch(`/api/analytics/monthly?month=${selectedMonth + 1}&year=${selectedYear}`),
        fetch(`/api/analytics/annual?year=${selectedYear}`),
      ]);
      const [s, m, a] = await Promise.all([settingsRes.json(), monthlyRes.json(), annualRes.json()]);
      if (s && !s.error) setSettings(s);
      setCategoryTotals(Array.isArray(m.categoryTotals) ? m.categoryTotals : []);
      setRecentExpenses(Array.isArray(m.recent) ? m.recent : []);
      const mt = Array.isArray(a.monthTotals) ? a.monthTotals : [];
      setMonthTotals(mt);
      // Aggregate annual category totals from categoryMonthly
      const catMonthly = Array.isArray(a.categoryMonthly) ? a.categoryMonthly : [];
      const annualMap: Record<string, number> = {};
      catMonthly.forEach((r: { _id: { categoryId: string }; total: number }) => {
        annualMap[r._id.categoryId] = (annualMap[r._id.categoryId] ?? 0) + r.total;
      });
      setAnnualCategoryTotals(Object.entries(annualMap).map(([_id, total]) => ({ _id, total, count: 0 })));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [selectedMonth, selectedYear]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Derived values ──
  const monthlySalary  = settings?.monthlySalary  ?? 0;
  const annualSalary   = settings?.annualSalary   ?? 0;

  // Monthly view values
  const monthlySpent   = categoryTotals.reduce((s, c) => s + c.total, 0);
  const monthlySavings = monthlySalary - monthlySpent;
  const monthlyBudget  = (settings?.categories ?? []).reduce((s, c) => s + c.monthlyBudget, 0);

  // Annual view values
  const annualSpent    = monthTotals.reduce((s, m) => s + m.total, 0);
  const annualSavings  = annualSalary - annualSpent;
  const annualBudget   = (settings?.categories ?? []).reduce((s, c) => s + c.monthlyBudget * 12, 0);

  const isAnnual = viewMode === 'annual';
  const displaySpent   = isAnnual ? annualSpent   : monthlySpent;
  const displayIncome  = isAnnual ? annualSalary  : monthlySalary;
  const displaySavings = isAnnual ? annualSavings : monthlySavings;
  const displayBudget  = isAnnual ? annualBudget  : monthlyBudget;
  const activeTotals   = isAnnual ? annualCategoryTotals : categoryTotals;

  // Pie chart — memoized
  const pieData = useMemo(() =>
    (settings?.categories ?? []).map(cat => {
      const total = activeTotals.find(c => c._id === cat.id)?.total ?? 0;
      return { name: cat.name, value: total, color: cat.color, emoji: cat.emoji };
    }).filter(d => d.value > 0)
  , [settings, activeTotals]);

  // Bar chart — memoized
  const barData = useMemo(() =>
    SHORT_MONTHS.map((m, i) => {
      const mm = String(i + 1).padStart(2, '0');
      const t  = monthTotals.find(x => x._id === mm);
      return { month: m, Spent: t?.total ?? 0, Salary: monthlySalary };
    })
  , [monthTotals, monthlySalary]);

  function navigateMonth(dir: number) {
    let m = selectedMonth + dir;
    let y = selectedYear;
    if (m < 0)  { m = 11; y--; }
    if (m > 11) { m = 0;  y++; }
    setSelectedMonth(m);
    setSelectedYear(y);
  }

  const getCategoryById = (id: string) => settings?.categories?.find(c => c.id === id);

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1 className="page-title">Dashboard</h1>
            <p className="page-subtitle">Your financial overview at a glance</p>
          </div>
          <div className="flex items-center gap-8" style={{ flexWrap: 'wrap', width: '100%' }}>
            {/* View mode toggle */}
            <div style={{ display: 'flex', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 4 }}>
              {(['monthly', 'annual'] as ViewMode[]).map(v => (
                <button
                  key={v}
                  onClick={() => setViewMode(v)}
                  style={{
                    padding: '6px 16px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                    background: viewMode === v ? 'var(--accent-gradient)' : 'transparent',
                    color: viewMode === v ? 'white' : 'var(--text-secondary)',
                    transition: 'all 0.2s',
                  }}
                >
                  {v === 'monthly' ? '📅 Monthly' : '📆 Annual'}
                </button>
              ))}
            </div>

            {/* Navigator */}
            {isAnnual ? (
              <div className="month-nav" style={{ flex: 1 }}>
                <button className="month-nav-btn" onClick={() => setSelectedYear(y => y - 1)}>‹</button>
                <span className="month-label">{selectedYear}</span>
                <button className="month-nav-btn" onClick={() => setSelectedYear(y => y + 1)}>›</button>
              </div>
            ) : (
              <div className="month-nav" style={{ flex: 1 }}>
                <button className="month-nav-btn" onClick={() => navigateMonth(-1)}>‹</button>
                <span className="month-label">{MONTHS[selectedMonth]} {selectedYear}</span>
                <button className="month-nav-btn" onClick={() => navigateMonth(1)}>›</button>
              </div>
            )}

            <Link href="/add" className="btn btn-primary" style={{ flexShrink: 0 }}>
              ➕ Add Expense
            </Link>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="loading-overlay"><div className="spinner" />Loading your data…</div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="summary-grid">
            <div className="summary-card income">
              <span className="summary-card-icon">💵</span>
              <div className="summary-card-label">{isAnnual ? 'Annual' : 'Monthly'} Income</div>
              <div className="summary-card-value income">{formatINR(displayIncome)}</div>
              <div className="summary-card-sub">
                {isAnnual ? `Monthly: ${formatINR(monthlySalary)}` : `Annual: ${formatINR(annualSalary)}`}
              </div>
            </div>
            <div className="summary-card spent">
              <span className="summary-card-icon">💸</span>
              <div className="summary-card-label">Total Spent</div>
              <div className="summary-card-value spent">{formatINR(displaySpent)}</div>
              <div className="summary-card-sub">
                {displayIncome > 0 ? ((displaySpent / displayIncome) * 100).toFixed(1) : 0}% of income
              </div>
            </div>
            <div className="summary-card savings">
              <span className="summary-card-icon">🏦</span>
              <div className="summary-card-label">Savings</div>
              <div className={`summary-card-value ${displaySavings >= 0 ? 'savings' : 'spent'}`}>{formatINR(displaySavings)}</div>
              <div className="summary-card-sub">
                {displayIncome > 0 ? ((displaySavings / displayIncome) * 100).toFixed(1) : 0}% saved
              </div>
            </div>
            <div className="summary-card budget">
              <span className="summary-card-icon">🎯</span>
              <div className="summary-card-label">Budget Used</div>
              <div className="summary-card-value" style={{ color: displaySpent > displayBudget ? 'var(--danger)' : 'var(--warning)' }}>
                {displayBudget > 0 ? ((displaySpent / displayBudget) * 100).toFixed(1) : 0}%
              </div>
              <div className="summary-card-sub">Budget cap: {formatINR(displayBudget)}</div>
            </div>
          </div>

          {/* Charts */}
          <div className="charts-grid mb-32">
            {/* Pie chart */}
            <div className="chart-wrapper">
              <h2 className="chart-title">
                {isAnnual ? `${selectedYear} Category Breakdown` : 'Monthly Spending Breakdown'}
              </h2>
              {pieData.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={3} dataKey="value">
                        {pieData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<PieTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12 }}>
                    {pieData.map((d, i) => (
                      <div key={i} className="flex items-center justify-between" style={{ fontSize: 13 }}>
                        <div className="flex items-center gap-8">
                          <span style={{ width: 10, height: 10, borderRadius: '50%', background: d.color, display: 'inline-block' }} />
                          <span style={{ color: 'var(--text-secondary)' }}>{d.emoji} {d.name}</span>
                        </div>
                        <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{formatINR(d.value)}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="empty-state" style={{ padding: '40px 0' }}>
                  <span className="empty-state-icon">🥧</span>
                  <span className="empty-state-sub">No expenses {isAnnual ? 'this year' : 'this month'}</span>
                </div>
              )}
            </div>

            {/* Bar chart — always shows annual monthly breakdown */}
            <div className="chart-wrapper">
              <h2 className="chart-title">Monthly Spending vs In-Hand ({selectedYear})</h2>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={barData} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12, color: 'var(--text-secondary)' }} />
                  <Bar dataKey="Spent" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Salary" name="In-Hand" fill="#818cf8" radius={[4, 4, 0, 0]} opacity={0.35} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Category Budget Bars */}
          <div className="mb-32">
            <div className="page-header-row mb-16">
              <h2 className="chart-title" style={{ margin: 0 }}>
                Category Budget Status {isAnnual ? `(${selectedYear})` : ''}
              </h2>
              <Link href="/settings" style={{ fontSize: 13, color: 'var(--accent-primary)', textDecoration: 'none' }}>
                Manage categories →
              </Link>
            </div>
            <div className="budget-grid">
              {(settings?.categories ?? []).map(cat => {
                const spent    = activeTotals.find(c => c._id === cat.id)?.total ?? 0;
                const cap      = isAnnual ? cat.monthlyBudget * 12 : cat.monthlyBudget;
                const pct      = cap > 0 ? Math.min((spent / cap) * 100, 100) : 0;
                const status   = getBudgetStatus(cap > 0 ? (spent / cap) * 100 : 0);
                return (
                  <div key={cat.id} className="budget-bar-card">
                    <div className="budget-bar-header">
                      <div className="budget-bar-name">
                        <span className="budget-bar-emoji">{cat.emoji}</span>
                        {cat.name}
                      </div>
                      <span className={`budget-pct-badge ${status}`}>
                        {cap > 0 ? ((spent / cap) * 100).toFixed(0) : 0}%
                      </span>
                    </div>
                    <div className="budget-track">
                      <div className={`budget-fill ${status}`} style={{ width: `${pct}%` }} />
                    </div>
                    <div className="budget-bar-footer">
                      <span>Spent: <strong style={{ color: 'var(--text-primary)' }}>{formatINR(spent)}</strong></span>
                      <span>Budget: {formatINR(cap)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recent Expenses — monthly mode only */}
          {!isAnnual && recentExpenses.length > 0 && (
            <div>
              <div className="page-header-row mb-16">
                <h2 className="chart-title" style={{ margin: 0 }}>Recent Expenses</h2>
                <Link href="/expenses" style={{ fontSize: 13, color: 'var(--accent-primary)', textDecoration: 'none' }}>
                  View all →
                </Link>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {recentExpenses.map(exp => {
                  const cat = getCategoryById(exp.categoryId);
                  return (
                    <div key={exp._id} className="card card-sm" style={{ padding: '14px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                        {/* Category icon */}
                        <div style={{
                          width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                          background: cat?.color ? `${cat.color}22` : 'var(--bg-input)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
                        }}>
                          {cat?.emoji ?? '💰'}
                        </div>

                        {/* Text info */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                            {cat?.name ?? 'Unknown'}
                          </div>
                          {exp.note ? (
                            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2, wordBreak: 'break-word' }}>
                              {exp.note}
                            </div>
                          ) : null}
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>{exp.date}</div>
                        </div>

                        {/* Amount */}
                        <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                          <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
                            {formatINR(exp.amount)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
