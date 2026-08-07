'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  AreaChart, Area, Tooltip, ResponsiveContainer,
  XAxis, YAxis, CartesianGrid, BarChart, Bar, Legend,
} from 'recharts';
import { CalendarDays, PlusCircle, Wallet, CreditCard, PiggyBank, Target, TrendingUp, Bell, Sparkles } from 'lucide-react';
import { formatINR, MONTHS, SHORT_MONTHS, getBudgetStatus, Settings, Expense } from '@/lib/types';
import AiInsights from '@/components/AiInsights';
import { CategoryIcon } from '@/components/CategoryIcon';
import { FocusWheel, WheelData } from '@/components/FocusWheel';

interface CategoryTotal { _id: string; total: number; count: number; }
interface MonthTotal    { _id: string; total: number; count: number; }
type ViewMode = 'monthly' | 'annual';

// ── Custom Tooltip for area/bar charts ──────────────────────────────────────
const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      padding: '10px 16px',
      boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
    }}>
      <p style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 6, fontWeight: 600 }}>{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color, fontWeight: 700, fontSize: 13, margin: 0 }}>
          {p.name}: {formatINR(p.value)}
        </p>
      ))}
    </div>
  );
};

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
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
  const safePerDay     = monthlySalary > 0 ? ((monthlySalary - monthlySpent) / (new Date(selectedYear, selectedMonth + 1, 0).getDate() - now.getDate() + 1)) : 0;

  const activeTotalsMap: Record<string, number> = {};
  activeTotals.forEach(t => activeTotalsMap[t._id] = t.total);

  // Donut data
  const pieData = useMemo(() =>
    (settings?.categories ?? []).map(cat => ({
      name: cat.name, value: activeTotalsMap[cat.id] ?? 0,
      color: cat.color, emoji: '',
    })).filter(d => d.value > 0).sort((a, b) => b.value - a.value),
  [settings, activeTotalsMap]);

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
    <div style={{ padding: '20px 20px calc(var(--nav-height) + 24px) 20px', maxWidth: 800, margin: '0 auto' }}>
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>{getGreeting()}, Vivek</h1>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>Here's your financial overview</p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--bg-card)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-primary)', cursor: 'pointer' }}>
            <Bell size={20} />
          </button>
        </div>
      </div>

      {/* Controls row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
        <div style={{ display: 'flex', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 4 }}>
          {(['monthly', 'annual'] as ViewMode[]).map(v => (
            <button key={v} onClick={() => setViewMode(v)} 
              style={{ 
                padding: '6px 12px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none',
                background: viewMode === v ? 'var(--accent)' : 'transparent',
                color: viewMode === v ? 'white' : 'var(--text-secondary)',
                cursor: 'pointer', transition: 'all 0.2s'
              }}>
              {v === 'monthly' ? 'Monthly' : 'Annual'}
            </button>
          ))}
        </div>
        {isAnnual ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '4px 8px' }}>
            <button style={{ background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', padding: '4px 8px' }} onClick={() => setSelectedYear(y => y - 1)}>‹</button>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{selectedYear}</span>
            <button style={{ background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', padding: '4px 8px' }} onClick={() => setSelectedYear(y => y + 1)}>›</button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '4px 8px' }}>
            <button style={{ background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', padding: '4px 8px' }} onClick={() => navigateMonth(-1)}>‹</button>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{MONTHS[selectedMonth]} {selectedYear}</span>
            <button style={{ background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', padding: '4px 8px' }} onClick={() => navigateMonth(1)}>›</button>
          </div>
        )}
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0', color: 'var(--text-secondary)' }}>Loading...</div>
      ) : (
        <>
          {/* ── Hero FocusWheel Card ── */}
          {/* ── Hero FocusWheel Card ── */}
          <div style={{ position: 'relative', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 20, padding: '48px 24px', marginBottom: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
            
            {/* Top Left Complication */}
            <div style={{ position: 'absolute', top: 24, left: 24, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Income</span>
              <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--success)' }}>{formatINR(displayIncome)}</span>
            </div>

            {/* Top Right Complication */}
            <div style={{ position: 'absolute', top: 24, right: 24, display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Safe/Day</span>
              <span style={{ fontSize: 16, fontWeight: 700, color: safePerDay > 0 ? 'var(--success)' : 'var(--danger)' }}>₹{Math.max(0, safePerDay).toFixed(0)}</span>
            </div>

            {/* Bottom Left Complication */}
            <div style={{ position: 'absolute', bottom: 24, left: 24, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Saved</span>
              <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent)' }}>{formatINR(displaySavings)}</span>
            </div>

            {/* Bottom Right Complication */}
            <div style={{ position: 'absolute', bottom: 24, right: 24, display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Limit</span>
              <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{formatINR(displayBudget)}</span>
            </div>

            <FocusWheel 
              data={(settings?.categories ?? []).map(cat => ({
                label: cat.name,
                icon: cat.name,
                color: cat.color,
                current: activeTotalsMap[cat.id] ?? 0,
                limit: isAnnual ? cat.monthlyBudget * 12 : cat.monthlyBudget
              }))} 
              size={320}
              strokeWidth={60}
            >
              <span style={{ fontSize: 36, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>{formatINR(displaySpent)}</span>
              <span style={{ fontSize: 16, color: 'var(--text-secondary)', marginTop: 4 }}>of {formatINR(displayBudget)} budget</span>
              <span style={{ fontSize: 16, fontWeight: 600, color: budgetPct >= 100 ? 'var(--danger)' : budgetPct >= 80 ? 'var(--warning)' : 'var(--success)', marginTop: 8 }}>{budgetPct.toFixed(0)}% used</span>
            </FocusWheel>
          </div>

          {/* ── AI Insights Section ── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Sparkles size={18} color="var(--accent)" />
            <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>AI Insights</h2>
          </div>
          <AiInsights month={selectedMonth} year={selectedYear} scope={viewMode} context="dashboard" />

          {/* ── Category Budget Cards ── */}
          <div style={{ marginBottom: 32 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Category Budgets</h2>
              <Link href="/settings" style={{ fontSize: 13, color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>Manage →</Link>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {(settings?.categories ?? []).map(cat => {
                const spent  = activeTotalsMap[cat.id] ?? 0;
                const cap    = isAnnual ? cat.monthlyBudget * 12 : cat.monthlyBudget;
                const pct    = cap > 0 ? Math.min((spent / cap) * 100, 100) : 0;
                let badgeColor = 'var(--success)';
                let badgeBg = 'color-mix(in srgb, var(--success) 15%, transparent)';
                if (pct >= 100) { badgeColor = 'var(--danger)'; badgeBg = 'color-mix(in srgb, var(--danger) 15%, transparent)'; }
                else if (pct >= 80) { badgeColor = 'var(--warning)'; badgeBg = 'color-mix(in srgb, var(--warning) 15%, transparent)'; }
                
                return (
                  <div key={cat.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                      <CategoryIcon name={cat.name} color={cat.color} size={20} inList={true} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{cat.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{formatINR(spent)} of {formatINR(cap)}</div>
                      </div>
                      <div style={{ padding: '4px 8px', borderRadius: 12, background: badgeBg, color: badgeColor, fontSize: 12, fontWeight: 700 }}>
                        {cap > 0 ? ((spent / cap) * 100).toFixed(0) : 0}%
                      </div>
                    </div>
                    <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: cat.color, borderRadius: 2, transition: 'width 0.5s ease' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Recent Expenses ── */}
          {!isAnnual && recentExpenses.length > 0 && (
            <div style={{ marginBottom: 32 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Recent</h2>
                <Link href="/expenses" style={{ fontSize: 13, color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>View all →</Link>
              </div>
              <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
                {recentExpenses.slice(0, 5).map((exp, i) => {
                  const cat = getCategoryById(exp.categoryId);
                  return (
                    <div key={exp._id}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 16 }}>
                        <CategoryIcon name={cat?.name ?? ''} note={exp.note} color={cat?.color ?? 'var(--accent)'} size={20} inList={true} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cat?.name ?? 'Unknown'} {exp.note && `- ${exp.note}`}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{exp.date}</div>
                        </div>
                        <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>{formatINR(exp.amount)}</div>
                      </div>
                      {i < Math.min(recentExpenses.length, 5) - 1 && <div style={{ height: 1, background: 'var(--border)', marginLeft: 60 }} />}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Charts ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24, marginBottom: 32 }}>

            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: 20 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 16px 0' }}>Spending Trend</h2>
              <ResponsiveContainer width="100%" height={240}>
                {isAnnual ? (
                  <BarChart data={areaData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--border)', opacity: 0.4 }} />
                    <Bar dataKey="Spent" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                ) : (
                  <AreaChart data={areaData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradSpent" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="var(--accent)" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="var(--accent)" stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="gradIncome" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="var(--success)" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="var(--success)" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 12, color: 'var(--text-secondary)' }} />
                    <Area type="monotone" dataKey="Income" stroke="var(--success)" strokeWidth={2} fill="url(#gradIncome)" dot={false} />
                    <Area type="monotone" dataKey="Spent"  stroke="var(--accent)" strokeWidth={2} fill="url(#gradSpent)"  dot={false} />
                  </AreaChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
