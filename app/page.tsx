'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
} from 'recharts';
import { formatINR, MONTHS, SHORT_MONTHS, getBudgetStatus, Settings, Expense } from '@/lib/types';

interface CategoryTotal { _id: string; total: number; count: number; }
interface MonthTotal { _id: string; total: number; count: number; }

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
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [settings, setSettings] = useState<Settings | null>(null);
  const [categoryTotals, setCategoryTotals] = useState<CategoryTotal[]>([]);
  const [monthTotals, setMonthTotals] = useState<MonthTotal[]>([]);
  const [recentExpenses, setRecentExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [settingsRes, monthlyRes, annualRes] = await Promise.all([
        fetch('/api/settings'),
        fetch(`/api/analytics/monthly?month=${selectedMonth + 1}&year=${selectedYear}`),
        fetch(`/api/analytics/annual?year=${selectedYear}`),
      ]);
      const [s, m, a] = await Promise.all([settingsRes.json(), monthlyRes.json(), annualRes.json()]);
      // Guard against error responses
      if (s && !s.error) setSettings(s);
      setCategoryTotals(Array.isArray(m.categoryTotals) ? m.categoryTotals : []);
      setRecentExpenses(Array.isArray(m.recent) ? m.recent : []);
      setMonthTotals(Array.isArray(a.monthTotals) ? a.monthTotals : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [selectedMonth, selectedYear]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totalSpent = categoryTotals.reduce((s, c) => s + c.total, 0);
  const monthlySalary = settings?.monthlySalary ?? 0;
  const savings = monthlySalary - totalSpent;
  const totalBudget = (settings?.categories ?? []).reduce((s, c) => s + c.monthlyBudget, 0);

  // Pie chart data — memoized to prevent re-render loops
  const pieData = useMemo(() =>
    (settings?.categories ?? []).map(cat => {
      const total = categoryTotals.find(c => c._id === cat.id)?.total ?? 0;
      return { name: cat.name, value: total, color: cat.color, emoji: cat.emoji };
    }).filter(d => d.value > 0)
  , [settings, categoryTotals]);

  // Bar chart — memoized to prevent re-render loops
  const barData = useMemo(() =>
    SHORT_MONTHS.map((m, i) => {
      const mm = String(i + 1).padStart(2, '0');
      const t = monthTotals.find(x => x._id === mm);
      return { month: m, Spent: t?.total ?? 0, Salary: monthlySalary };
    })
  , [monthTotals, monthlySalary]);

  function navigateMonth(dir: number) {
    let m = selectedMonth + dir;
    let y = selectedYear;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    setSelectedMonth(m);
    setSelectedYear(y);
  }

  const getCategoryById = (id: string) => settings?.categories.find(c => c.id === id);

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
            <div className="month-nav" style={{ flex: 1 }}>
              <button className="month-nav-btn" onClick={() => navigateMonth(-1)}>‹</button>
              <span className="month-label">{MONTHS[selectedMonth]} {selectedYear}</span>
              <button className="month-nav-btn" onClick={() => navigateMonth(1)}>›</button>
            </div>
            <Link href="/add" className="btn btn-primary" style={{ flexShrink: 0 }}>
              ➕ Add Expense
            </Link>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="loading-overlay">
          <div className="spinner" />
          Loading your data…
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="summary-grid">
            <div className="summary-card income">
              <span className="summary-card-icon">💵</span>
              <div className="summary-card-label">Monthly Income</div>
              <div className="summary-card-value income">{formatINR(monthlySalary)}</div>
              <div className="summary-card-sub">Annual: {formatINR(settings?.annualSalary ?? 0)}</div>
            </div>
            <div className="summary-card spent">
              <span className="summary-card-icon">💸</span>
              <div className="summary-card-label">Total Spent</div>
              <div className="summary-card-value spent">{formatINR(totalSpent)}</div>
              <div className="summary-card-sub">{monthlySalary > 0 ? ((totalSpent / monthlySalary) * 100).toFixed(1) : 0}% of income</div>
            </div>
            <div className="summary-card savings">
              <span className="summary-card-icon">🏦</span>
              <div className="summary-card-label">Savings</div>
              <div className={`summary-card-value ${savings >= 0 ? 'savings' : 'spent'}`}>{formatINR(savings)}</div>
              <div className="summary-card-sub">{monthlySalary > 0 ? ((savings / monthlySalary) * 100).toFixed(1) : 0}% saved</div>
            </div>
            <div className="summary-card budget">
              <span className="summary-card-icon">🎯</span>
              <div className="summary-card-label">Budget Used</div>
              <div className="summary-card-value" style={{ color: totalSpent > totalBudget ? 'var(--danger)' : 'var(--warning)' }}>
                {totalBudget > 0 ? ((totalSpent / totalBudget) * 100).toFixed(1) : 0}%
              </div>
              <div className="summary-card-sub">Budget cap: {formatINR(totalBudget)}</div>
            </div>
          </div>

          {/* Charts */}
          <div className="charts-grid mb-32">
            {/* Pie chart */}
            <div className="chart-wrapper">
              <h2 className="chart-title">Spending Breakdown</h2>
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
                  <span className="empty-state-sub">No expenses this month</span>
                </div>
              )}
            </div>

            {/* Bar chart */}
            <div className="chart-wrapper">
              <h2 className="chart-title">Annual Spending vs Income ({selectedYear})</h2>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={barData} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12, color: 'var(--text-secondary)' }} />
                  <Bar dataKey="Spent" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Salary" fill="#1e2230" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Category Budget Bars */}
          <div className="mb-32">
            <div className="page-header-row mb-16">
              <h2 className="chart-title" style={{ margin: 0 }}>Category Budget Status</h2>
              <Link href="/settings" style={{ fontSize: 13, color: 'var(--accent-primary)', textDecoration: 'none' }}>
                Manage categories →
              </Link>
            </div>
            <div className="budget-grid">
              {(settings?.categories ?? []).map(cat => {
                const spent = categoryTotals.find(c => c._id === cat.id)?.total ?? 0;
                const pct = cat.monthlyBudget > 0 ? Math.min((spent / cat.monthlyBudget) * 100, 100) : 0;
                const status = getBudgetStatus(cat.monthlyBudget > 0 ? (spent / cat.monthlyBudget) * 100 : 0);
                return (
                  <div key={cat.id} className="budget-bar-card">
                    <div className="budget-bar-header">
                      <div className="budget-bar-name">
                        <span className="budget-bar-emoji">{cat.emoji}</span>
                        {cat.name}
                      </div>
                      <span className={`budget-pct-badge ${status}`}>
                        {cat.monthlyBudget > 0 ? ((spent / cat.monthlyBudget) * 100).toFixed(0) : 0}%
                      </span>
                    </div>
                    <div className="budget-track">
                      <div className={`budget-fill ${status}`} style={{ width: `${pct}%` }} />
                    </div>
                    <div className="budget-bar-footer">
                      <span>Spent: <strong style={{ color: 'var(--text-primary)' }}>{formatINR(spent)}</strong></span>
                      <span>Budget: {formatINR(cat.monthlyBudget)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recent Expenses */}
          {recentExpenses.length > 0 && (
            <div>
              <div className="page-header-row mb-16">
                <h2 className="chart-title" style={{ margin: 0 }}>Recent Expenses</h2>
                <Link href="/expenses" style={{ fontSize: 13, color: 'var(--accent-primary)', textDecoration: 'none' }}>
                  View all →
                </Link>
              </div>
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Category</th>
                      <th>Note</th>
                      <th className="text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentExpenses.map(exp => {
                      const cat = getCategoryById(exp.categoryId);
                      return (
                        <tr key={exp._id}>
                          <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>{exp.date}</td>
                          <td>
                            {cat ? (
                              <span className="flex items-center gap-8">
                                <span style={{ width: 8, height: 8, borderRadius: '50%', background: cat.color, display: 'inline-block' }} />
                                {cat.emoji} {cat.name}
                              </span>
                            ) : <span className="text-muted">Unknown</span>}
                          </td>
                          <td style={{ color: 'var(--text-muted)' }}>{exp.note || '—'}</td>
                          <td className="text-right primary" style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                            {formatINR(exp.amount)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
