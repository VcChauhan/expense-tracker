'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, Legend,
} from 'recharts';
import { formatINR, SHORT_MONTHS, MONTHS, Settings, AnnualAnalytics } from '@/lib/types';

const ChartTooltip = ({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) => {
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

export default function ReportsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [analytics, setAnalytics] = useState<AnnualAnalytics | null>(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [sRes, aRes] = await Promise.all([
        fetch('/api/settings'),
        fetch(`/api/analytics/annual?year=${selectedYear}`),
      ]);
      const [s, a] = await Promise.all([sRes.json(), aRes.json()]);
      setSettings(s);
      setAnalytics(a);
    } finally {
      setLoading(false);
    }
  }, [selectedYear]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) return (
    <div className="page-container">
      <div className="loading-overlay"><div className="spinner" /> Loading reports…</div>
    </div>
  );

  const months = SHORT_MONTHS;

  // Per-month totals bar data
  const monthBarData = months.map((m, i) => {
    const mm = String(i + 1).padStart(2, '0');
    const mt = (analytics?.monthTotals ?? []).find(x => x._id === mm);
    return { month: m, Total: mt?.total ?? 0, Salary: settings?.monthlySalary ?? 0 };
  });

  // Get spend for a category in a given month
  function getCatMonthSpend(catId: string, monthIdx: number): number {
    const mm = String(monthIdx + 1).padStart(2, '0');
    return (analytics?.categoryMonthly ?? []).find(r => r._id.categoryId === catId && r._id.month === mm)?.total ?? 0;
  }

  // Annual total per category
  function getCatAnnualTotal(catId: string): number {
    return (analytics?.categoryMonthly ?? [])
      .filter(r => r._id.categoryId === catId)
      .reduce((s, r) => s + r.total, 0);
  }

  // Line chart data: one line per category (filtered if activeCategory)
  const categoriesToShow = activeCategory
    ? (settings?.categories ?? []).filter(c => c.id === activeCategory)
    : (settings?.categories ?? []);

  const lineData = months.map((m, i) => {
    const row: Record<string, number | string> = { month: m };
    categoriesToShow.forEach(cat => {
      row[cat.name] = getCatMonthSpend(cat.id, i);
    });
    return row;
  });

  const grandTotal = (analytics?.monthTotals ?? []).reduce((s, m) => s + m.total, 0);
  const annualSalary = settings?.annualSalary ?? 0;
  const annualSavings = annualSalary - grandTotal;

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1 className="page-title">📈 Reports</h1>
            <p className="page-subtitle">Annual spending analysis and trends</p>
          </div>
          <div className="flex items-center gap-8">
            <button className="month-nav-btn" onClick={() => setSelectedYear(y => y - 1)}>‹</button>
            <span className="month-label" style={{ minWidth: 60 }}>{selectedYear}</span>
            <button className="month-nav-btn" onClick={() => setSelectedYear(y => y + 1)}>›</button>
          </div>
        </div>
      </div>

      {/* Annual Summary Cards */}
      <div className="summary-grid mb-32">
        <div className="summary-card income">
          <span className="summary-card-icon">💵</span>
          <div className="summary-card-label">Annual Income</div>
          <div className="summary-card-value income">{formatINR(annualSalary)}</div>
        </div>
        <div className="summary-card spent">
          <span className="summary-card-icon">💸</span>
          <div className="summary-card-label">Total Spent ({selectedYear})</div>
          <div className="summary-card-value spent">{formatINR(grandTotal)}</div>
          <div className="summary-card-sub">{annualSalary > 0 ? ((grandTotal / annualSalary) * 100).toFixed(1) : 0}% of income</div>
        </div>
        <div className="summary-card savings">
          <span className="summary-card-icon">🏦</span>
          <div className="summary-card-label">Annual Savings</div>
          <div className={`summary-card-value ${annualSavings >= 0 ? 'savings' : 'spent'}`}>{formatINR(annualSavings)}</div>
        </div>
        <div className="summary-card budget">
          <span className="summary-card-icon">📅</span>
          <div className="summary-card-label">Avg Monthly Spend</div>
          <div className="summary-card-value" style={{ color: 'var(--warning)' }}>
            {formatINR(grandTotal / 12)}
          </div>
        </div>
      </div>

      {/* Monthly Totals Bar */}
      <div className="chart-wrapper mb-24">
        <h2 className="chart-title">Monthly Spending vs Income</h2>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={monthBarData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} />
            <YAxis tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} width={55} />
            <Tooltip content={<ChartTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="Total" name="Spent" fill="#6366f1" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Salary" name="Income" fill="#818cf8" radius={[4, 4, 0, 0]} opacity={0.35} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Category Line Chart */}
      <div className="chart-wrapper mb-32">
        <div className="flex items-center justify-between mb-16" style={{ gap: 8 }}>
          <h2 className="chart-title" style={{ margin: 0, flexShrink: 0 }}>Category Trends</h2>
        </div>
        <div className="filter-scroll mb-16">
            <button
              className={`btn btn-sm ${!activeCategory ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveCategory(null)}
            >All</button>
            {(settings?.categories ?? []).map(c => (
              <button
                key={c.id}
                className={`btn btn-sm ${activeCategory === c.id ? 'btn-primary' : 'btn-secondary'}`}
                style={activeCategory === c.id ? { background: c.color } : {}}
                onClick={() => setActiveCategory(activeCategory === c.id ? null : c.id)}
              >
                {c.emoji} {c.name}
              </button>
            ))}
        </div>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={lineData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} />
            <YAxis tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} width={55} />
            <Tooltip content={<ChartTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {categoriesToShow.map(cat => (
              <Line key={cat.id} type="monotone" dataKey={cat.name} stroke={cat.color}
                strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Annual Table */}
      <div>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>
          Annual Breakdown by Category
        </h2>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Category</th>
                {SHORT_MONTHS.map(m => <th key={m} className="text-right" style={{ minWidth: 70 }}>{m}</th>)}
                <th className="text-right" style={{ minWidth: 90 }}>Annual</th>
                <th className="text-right">Budget/mo</th>
              </tr>
            </thead>
            <tbody>
              {(settings?.categories ?? []).map(cat => {
                const annual = getCatAnnualTotal(cat.id);
                const annualBudget = cat.monthlyBudget * 12;
                const overBudget = annual > annualBudget;
                return (
                  <tr key={cat.id}>
                    <td className="primary">
                      <span className="flex items-center gap-8">
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: cat.color, flexShrink: 0, display: 'inline-block' }} />
                        {cat.emoji} {cat.name}
                      </span>
                    </td>
                    {SHORT_MONTHS.map((_, i) => {
                      const v = getCatMonthSpend(cat.id, i);
                      return (
                        <td key={i} className="text-right" style={{ fontSize: 13, color: v > 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                          {v > 0 ? `₹${(v / 1000).toFixed(1)}k` : '—'}
                        </td>
                      );
                    })}
                    <td className="text-right" style={{ fontWeight: 700, color: overBudget ? 'var(--danger)' : 'var(--success)' }}>
                      {formatINR(annual)}
                    </td>
                    <td className="text-right" style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                      {formatINR(cat.monthlyBudget)}
                    </td>
                  </tr>
                );
              })}
              {/* Totals row */}
              <tr style={{ background: 'var(--bg-secondary)', borderTop: '2px solid var(--border-light)' }}>
                <td className="primary" style={{ fontWeight: 700 }}>TOTAL</td>
                {SHORT_MONTHS.map((_, i) => {
                  const mm = String(i + 1).padStart(2, '0');
                  const v = (analytics?.monthTotals ?? []).find(x => x._id === mm)?.total ?? 0;
                  return (
                    <td key={i} className="text-right" style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 13 }}>
                      {v > 0 ? `₹${(v / 1000).toFixed(1)}k` : '—'}
                    </td>
                  );
                })}
                <td className="text-right" style={{ fontWeight: 700, color: 'var(--danger)', fontSize: 15 }}>
                  {formatINR(grandTotal)}
                </td>
                <td className="text-right" style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  {formatINR((settings?.categories ?? []).reduce((s, c) => s + c.monthlyBudget, 0))}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Month Summary below table */}
        <div className="grid-3" style={{ marginTop: 24 }}>
          {MONTHS.map((m, i) => {
            const mm = String(i + 1).padStart(2, '0');
            const mt = (analytics?.monthTotals ?? []).find(x => x._id === mm);
            if (!mt) return null;
            const salary = settings?.monthlySalary ?? 0;
            const pct = salary > 0 ? (mt.total / salary) * 100 : 0;
            return (
              <div key={m} className="card card-sm" style={{ padding: '14px 18px' }}>
                <div className="flex items-center justify-between mb-8">
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>{m}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{mt.count} entries</span>
                </div>
                <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
                  {formatINR(mt.total)}
                </div>
                <div className="budget-track">
                  <div className={`budget-fill ${pct > 100 ? 'danger' : pct > 80 ? 'warning' : 'safe'}`}
                    style={{ width: `${Math.min(pct, 100)}%` }} />
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{pct.toFixed(1)}% of salary</div>
              </div>
            );
          }).filter(Boolean)}
        </div>
      </div>
    </div>
  );
}
