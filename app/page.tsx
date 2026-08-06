'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  AreaChart, Area, PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  XAxis, YAxis, CartesianGrid, BarChart, Bar, Legend,
} from 'recharts';
import { CalendarDays, PlusCircle, Wallet, CreditCard, PiggyBank, Target, TrendingUp, TrendingDown } from 'lucide-react';
import { formatINR, MONTHS, SHORT_MONTHS, getBudgetStatus, Settings, Expense } from '@/lib/types';
import AiInsights from '@/components/AiInsights';
import { CategoryIcon } from '@/components/CategoryIcon';

interface CategoryTotal { _id: string; total: number; count: number; }
interface MonthTotal    { _id: string; total: number; count: number; }
type ViewMode = 'monthly' | 'annual';

// ── Custom Tooltip for area/bar charts ──────────────────────────────────────
const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'rgba(22,22,31,0.95)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 12,
      padding: '10px 16px',
      backdropFilter: 'blur(16px)',
    }}>
      <p style={{ color: 'rgba(240,240,255,0.5)', fontSize: 11, marginBottom: 6, fontWeight: 600 }}>{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color, fontWeight: 700, fontSize: 13 }}>
          {p.name}: {formatINR(p.value)}
        </p>
      ))}
    </div>
  );
};

// ── Donut chart tooltip ─────────────────────────────────────────────────────
const PieTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'rgba(22,22,31,0.95)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 12,
      padding: '10px 16px',
      backdropFilter: 'blur(16px)',
    }}>
      <p style={{ color: payload[0].payload.color, fontWeight: 700, fontSize: 13 }}>{payload[0].name}</p>
      <p style={{ color: '#F0F0FF', fontWeight: 800, fontSize: 16 }}>{formatINR(payload[0].value)}</p>
    </div>
  );
};

// ── Budget ring (SVG arc) ───────────────────────────────────────────────────
function BudgetRing({ pct, color }: { pct: number; color: string }) {
  const r = 54; const c = 2 * Math.PI * r;
  const clampedPct = Math.min(pct, 100);
  const dash = (clampedPct / 100) * c;
  return (
    <svg width={128} height={128} viewBox="0 0 128 128" style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={64} cy={64} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={10} />
      <circle cx={64} cy={64} r={r} fill="none" stroke={color} strokeWidth={10}
        strokeDasharray={`${dash} ${c}`} strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.8s cubic-bezier(0.16,1,0.3,1)', filter: `drop-shadow(0 0 6px ${color})` }} />
    </svg>
  );
}

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
      const catMonthly = Array.isArray(a.categoryMonthly) ? a.categoryMonthly : [];
      const annualMap: Record<string, number> = {};
      catMonthly.forEach((r: any) => { annualMap[r._id.categoryId] = (annualMap[r._id.categoryId] ?? 0) + r.total; });
      setAnnualCategoryTotals(Object.entries(annualMap).map(([_id, total]) => ({ _id, total, count: 0 })));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [selectedMonth, selectedYear]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const monthlySalary  = settings?.monthlySalary  ?? 0;
  const annualSalary   = settings?.annualSalary   ?? 0;
  const monthlySpent   = categoryTotals.reduce((s, c) => s + c.total, 0);
  const monthlySavings = monthlySalary - monthlySpent;
  const monthlyBudget  = (settings?.categories ?? []).reduce((s, c) => s + c.monthlyBudget, 0);
  const annualSpent    = monthTotals.reduce((s, m) => s + m.total, 0);
  const annualSavings  = annualSalary - annualSpent;
  const annualBudget   = (settings?.categories ?? []).reduce((s, c) => s + c.monthlyBudget * 12, 0);

  const isAnnual       = viewMode === 'annual';
  const displaySpent   = isAnnual ? annualSpent   : monthlySpent;
  const displayIncome  = isAnnual ? annualSalary  : monthlySalary;
  const displaySavings = isAnnual ? annualSavings : monthlySavings;
  const displayBudget  = isAnnual ? annualBudget  : monthlyBudget;
  const activeTotals   = isAnnual ? annualCategoryTotals : categoryTotals;
  const budgetPct      = displayBudget > 0 ? (displaySpent / displayBudget) * 100 : 0;
  const budgetStatus   = budgetPct >= 100 ? '#F43F5E' : budgetPct >= 80 ? '#FBBF24' : '#22C55E';
  const safePerDay     = monthlySalary > 0 ? ((monthlySalary - monthlySpent) / (new Date(selectedYear, selectedMonth + 1, 0).getDate() - now.getDate() + 1)) : 0;

  // Donut data
  const pieData = useMemo(() =>
    (settings?.categories ?? []).map(cat => ({
      name: cat.name, value: activeTotals.find(c => c._id === cat.id)?.total ?? 0,
      color: cat.color, emoji: '',
    })).filter(d => d.value > 0),
  [settings, activeTotals]);

  // Area chart — 12 months spending trend
  const areaData = useMemo(() =>
    SHORT_MONTHS.map((m, i) => {
      const mm = String(i + 1).padStart(2, '0');
      const t  = monthTotals.find(x => x._id === mm);
      return { month: m, Spent: t?.total ?? 0, Income: monthlySalary };
    }),
  [monthTotals, monthlySalary]);

  function navigateMonth(dir: number) {
    let m = selectedMonth + dir, y = selectedYear;
    if (m < 0)  { m = 11; y--; }
    if (m > 11) { m = 0;  y++; }
    setSelectedMonth(m); setSelectedYear(y);
  }

  const getCategoryById = (id: string) => settings?.categories?.find(c => c.id === id);

  return (
    <div className="page-container">
      {/* ── Header ── */}
      <div className="page-header">
        <div className="page-header-row" style={{ marginBottom: 16 }}>
          <div>
            <h1 className="page-title">Dashboard</h1>
            <p className="page-subtitle">Your financial overview at a glance</p>
          </div>
          <Link href="/add" className="btn btn-primary" style={{ gap: 8 }}>
            <PlusCircle size={16} /> Add Expense
          </Link>
        </div>

        {/* Controls row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div className="period-selector">
            {(['monthly', 'annual'] as ViewMode[]).map(v => (
              <button key={v} onClick={() => setViewMode(v)} className={`period-btn ${viewMode === v ? 'active' : ''}`}
                style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <CalendarDays size={13} /> {v === 'monthly' ? 'Monthly' : 'Annual'}
              </button>
            ))}
          </div>
          {isAnnual ? (
            <div className="month-nav">
              <button className="month-nav-btn" onClick={() => setSelectedYear(y => y - 1)}>‹</button>
              <span className="month-label">{selectedYear}</span>
              <button className="month-nav-btn" onClick={() => setSelectedYear(y => y + 1)}>›</button>
            </div>
          ) : (
            <div className="month-nav">
              <button className="month-nav-btn" onClick={() => navigateMonth(-1)}>‹</button>
              <span className="month-label">{MONTHS[selectedMonth]} {selectedYear}</span>
              <button className="month-nav-btn" onClick={() => navigateMonth(1)}>›</button>
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="loading-overlay"><div className="spinner" style={{ width: 32, height: 32 }} /> Loading your data…</div>
      ) : (
        <>
          {/* ── Hero Card ── */}
          <div className="hero-card mb-24 fade-up">
            <div style={{ display: 'flex', gap: 32, alignItems: 'center', flexWrap: 'wrap' }}>
              {/* Budget ring */}
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <BudgetRing pct={budgetPct} color={budgetStatus} />
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: 18, fontWeight: 800, color: budgetStatus }}>
                    {budgetPct.toFixed(0)}%
                  </span>
                  <span style={{ fontSize: 9, color: 'rgba(240,240,255,0.4)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>budget</span>
                </div>
              </div>

              {/* Main spend number */}
              <div style={{ flex: 1, minWidth: 160 }}>
                <div className="hero-label">
                  {isAnnual ? `${selectedYear} Total Spent` : `Spent in ${MONTHS[selectedMonth]}`}
                </div>
                <div className="hero-amount">{formatINR(displaySpent)}</div>
                {!isAnnual && safePerDay > 0 && (
                  <div style={{ marginTop: 8, fontSize: 12, color: 'rgba(240,240,255,0.4)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ color: '#22C55E', fontWeight: 600 }}>₹{safePerDay.toFixed(0)}/day</span>
                    <span>safe to spend</span>
                  </div>
                )}
              </div>
            </div>

            <div className="hero-stats">
              <div className="hero-stat">
                <div className="hero-stat-label">Income</div>
                <div className="hero-stat-value" style={{ color: '#22C55E' }}>{formatINR(displayIncome)}</div>
              </div>
              <div className="hero-stat">
                <div className="hero-stat-label">Budget Cap</div>
                <div className="hero-stat-value">{formatINR(displayBudget)}</div>
              </div>
              <div className="hero-stat">
                <div className="hero-stat-label">Savings</div>
                <div className="hero-stat-value" style={{ color: displaySavings >= 0 ? '#7C5CFC' : '#F43F5E' }}>
                  {formatINR(displaySavings)}
                </div>
              </div>
            </div>
          </div>

          {/* ── Summary cards ── */}
          <div className="summary-grid mb-24">
            {[
              { label: 'Income',    value: formatINR(displayIncome),  sub: `${isAnnual ? 'Annual' : 'Monthly'}`, cls: 'income',  Icon: Wallet,      iconCls: 'income' },
              { label: 'Spent',     value: formatINR(displaySpent),   sub: `${displayIncome > 0 ? ((displaySpent/displayIncome)*100).toFixed(1) : 0}% of income`, cls: 'spent',   Icon: CreditCard,  iconCls: 'spent'  },
              { label: 'Savings',   value: formatINR(displaySavings), sub: `${displayIncome > 0 ? ((displaySavings/displayIncome)*100).toFixed(1) : 0}% saved`,   cls: 'savings', Icon: PiggyBank,   iconCls: 'savings'},
              { label: 'Budget %',  value: `${budgetPct.toFixed(1)}%`,sub: `Cap: ${formatINR(displayBudget)}`,                                                    cls: 'budget',  Icon: Target,      iconCls: 'budget' },
            ].map(({ label, value, sub, cls, Icon, iconCls }) => (
              <div key={label} className={`summary-card ${cls} fade-up`}>
                <div className={`summary-card-icon ${iconCls}`}><Icon size={18} strokeWidth={2} /></div>
                <div className="summary-card-label">{label}</div>
                <div className={`summary-card-value ${iconCls === 'savings' ? (displaySavings >= 0 ? 'savings' : 'spent') : ''}`}>{value}</div>
                <div className="summary-card-sub">{sub}</div>
              </div>
            ))}
          </div>

          {/* ── AI Insights ── */}
          <AiInsights month={selectedMonth} year={selectedYear} scope={viewMode} />

          {/* ── Charts ── */}
          <div className="charts-grid mb-24">
            {/* Donut breakdown */}
            <div className="chart-wrapper">
              <h2 className="chart-title">{isAnnual ? `${selectedYear}` : MONTHS[selectedMonth]} Breakdown</h2>
              {pieData.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80}
                        paddingAngle={3} dataKey="value" strokeWidth={0}>
                        {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Pie>
                      <Tooltip content={<PieTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
                    {pieData.slice(0, 5).map((d, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: d.color, display: 'inline-block', flexShrink: 0 }} />
                          <span style={{ color: 'rgba(240,240,255,0.6)', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <CategoryIcon name={d.name} size={13} /> {d.name}
                          </span>
                        </div>
                        <span style={{ color: '#F0F0FF', fontWeight: 700 }}>{formatINR(d.value)}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="empty-state" style={{ padding: '32px 0' }}>
                  <span className="empty-state-sub">No expenses {isAnnual ? 'this year' : 'this month'}</span>
                </div>
              )}
            </div>

            {/* Area chart — monthly trend */}
            <div className="chart-wrapper">
              <h2 className="chart-title">Spending vs Income — {selectedYear}</h2>
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={areaData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradSpent" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#7C5CFC" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#7C5CFC" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="gradIncome" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#22C55E" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#22C55E" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'rgba(240,240,255,0.35)' }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: 'rgba(240,240,255,0.35)' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12, color: 'rgba(240,240,255,0.5)' }} />
                  <Area type="monotone" dataKey="Income" stroke="#22C55E" strokeWidth={2} fill="url(#gradIncome)" dot={false} name="Income" />
                  <Area type="monotone" dataKey="Spent"  stroke="#7C5CFC" strokeWidth={2} fill="url(#gradSpent)"  dot={false} name="Spent" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ── Category Budget Cards ── */}
          <div className="mb-32">
            <div className="page-header-row mb-16">
              <h2 className="chart-title" style={{ margin: 0 }}>Category Budget Status</h2>
              <Link href="/settings" style={{ fontSize: 13, color: 'var(--accent-light)', textDecoration: 'none', fontWeight: 600 }}>
                Manage →
              </Link>
            </div>
            <div className="budget-grid animate-list">
              {(settings?.categories ?? []).map(cat => {
                const spent  = activeTotals.find(c => c._id === cat.id)?.total ?? 0;
                const cap    = isAnnual ? cat.monthlyBudget * 12 : cat.monthlyBudget;
                const pct    = cap > 0 ? Math.min((spent / cap) * 100, 100) : 0;
                const status = getBudgetStatus(cap > 0 ? (spent / cap) * 100 : 0);
                return (
                  <div key={cat.id} className="budget-bar-card">
                    <div className="budget-bar-header">
                      <div className="budget-bar-name">
                        <div className="cat-icon-pill" style={{ background: `${cat.color}20`, color: cat.color }}>
                          <CategoryIcon name={cat.name} size={16} />
                        </div>
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

          {/* ── Recent Expenses ── */}
          {!isAnnual && recentExpenses.length > 0 && (
            <div>
              <div className="page-header-row mb-16">
                <h2 className="chart-title" style={{ margin: 0 }}>Recent Expenses</h2>
                <Link href="/expenses" style={{ fontSize: 13, color: 'var(--accent-light)', textDecoration: 'none', fontWeight: 600 }}>
                  View all →
                </Link>
              </div>
              <div className="animate-list" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {recentExpenses.map(exp => {
                  const cat = getCategoryById(exp.categoryId);
                  return (
                    <div key={exp._id} className="card card-sm" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px' }}>
                      <div className="cat-icon-pill" style={{ background: cat?.color ? `${cat.color}20` : 'rgba(255,255,255,0.05)', color: cat?.color ?? '#7C5CFC' }}>
                        <CategoryIcon name={cat?.name ?? ''} note={exp.note} size={16} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{cat?.name ?? 'Unknown'}</div>
                        {exp.note && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{exp.note}</div>}
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{exp.date}</div>
                      </div>
                      <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>{formatINR(exp.amount)}</div>
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
