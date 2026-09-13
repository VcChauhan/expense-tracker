'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, BarChart, Bar
} from 'recharts';
import { formatINR, SHORT_MONTHS, MONTHS, Settings, AnnualAnalytics } from '@/lib/types';
import { Wallet, CreditCard, PiggyBank, CalendarDays, ChevronLeft, ChevronRight, TrendingUp, Store } from 'lucide-react';
import { CategoryIcon } from '@/components/CategoryIcon';
import AiInsights from '@/components/AiInsights';
import { SubscriptionAudit } from '@/components/SubscriptionAudit';
import { PredictiveCashflowCard } from '@/components/PredictiveCashflowCard';
import { PaymentMethodBreakdownCard } from '@/components/PaymentMethodBreakdownCard';
import { NetWorthTracker } from '@/components/NetWorthTracker';
import { CategoryDonutChart } from '@/components/CategoryDonutChart';

type ViewMode = 'monthly' | 'annual';

const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'rgba(20, 20, 30, 0.85)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '12px 16px', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
      <p style={{ color: 'var(--text-muted)', fontSize: 11, marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color || 'var(--text-primary)', fontWeight: 700, fontSize: 14, margin: '4px 0', display: 'flex', justifyContent: 'space-between', gap: 24 }}>
          <span>{p.name}</span>
          <span>{formatINR(p.value)}</span>
        </p>
      ))}
    </div>
  );
};

export default function ReportsPage() {
  const now = new Date();
  const [viewMode, setViewMode] = useState<ViewMode>('monthly');
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  
  const [settings, setSettings] = useState<Settings | null>(null);
  const [analytics, setAnalytics] = useState<AnnualAnalytics | null>(null);
  const [monthlyAnalytics, setMonthlyAnalytics] = useState<any>(null);
  const [expenses, setExpenses] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [sRes, aRes, mRes, expRes] = await Promise.all([
        fetch('/api/settings'),
        fetch(`/api/analytics/annual?year=${selectedYear}`),
        fetch(`/api/analytics/monthly?month=${selectedMonth + 1}&year=${selectedYear}`),
        fetch('/api/expenses?limit=300')
      ]);
      const [s, a, m, exps] = await Promise.all([sRes.json(), aRes.json(), mRes.json(), expRes.json()]);
      if (s && !s.error) setSettings(s);
      setAnalytics(a);
      setMonthlyAnalytics(m);
      if (Array.isArray(exps)) setExpenses(exps);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [selectedMonth, selectedYear]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Monthly data derivations
  const dailyChartData = useMemo(() => {
    if (!monthlyAnalytics?.dailyTotals) return [];
    const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    const data = Array.from({ length: daysInMonth }, (_, i) => {
      const dateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`;
      const found = monthlyAnalytics.dailyTotals.find((d: any) => d._id === dateStr);
      return {
        day: String(i + 1).padStart(2, '0'),
        spent: found ? found.total : 0,
        name: `${SHORT_MONTHS[selectedMonth]} ${i + 1}`
      };
    });
    
    let cumulative = 0;
    return data.map(d => {
      cumulative += d.spent;
      return { ...d, totalSpent: cumulative };
    });
  }, [monthlyAnalytics, selectedMonth, selectedYear]);

  const dayOfWeekData = useMemo(() => {
    if (!monthlyAnalytics?.dailyTotals) return [];
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const data = days.map(d => ({ name: d, spent: 0 }));
    
    monthlyAnalytics.dailyTotals.forEach((d: any) => {
      const date = new Date(d._id);
      if (date.getMonth() === selectedMonth && date.getFullYear() === selectedYear) {
        data[date.getDay()].spent += d.total;
      }
    });
    return data;
  }, [monthlyAnalytics, selectedMonth, selectedYear]);

  // Top Merchants derivation
  const topMerchants = useMemo(() => {
    const map: Record<string, { total: number; count: number; categoryId: string }> = {};
    expenses.forEach((exp: any) => {
      let merchant = (exp.note || '').trim();
      if (!merchant) return;
      merchant = merchant.replace(/\s*\(Split:.*?\)/i, '').trim();
      merchant = merchant.replace(/\s*\(Recurring\)/i, '').trim();
      if (!merchant) return;
      const cleanName = merchant.split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
      if (!map[cleanName]) map[cleanName] = { total: 0, count: 0, categoryId: exp.categoryId };
      map[cleanName].total += exp.amount;
      map[cleanName].count += 1;
    });

    return Object.entries(map)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [expenses]);

  function navigateMonth(dir: number) {
    let m = selectedMonth + dir, y = selectedYear;
    if (m < 0)  { m = 11; y--; }
    if (m > 11) { m = 0;  y++; }
    setSelectedMonth(m); setSelectedYear(y);
  }

  // Annual data derivations
  const months = SHORT_MONTHS;
  const monthBarData = months.map((m, i) => {
    const mm = String(i + 1).padStart(2, '0');
    const mt = (analytics?.monthTotals ?? []).find(x => x._id === mm);
    return { month: m, Spent: mt?.total ?? 0, Income: settings?.monthlySalary ?? 0 };
  });

  function getCatMonthSpend(catId: string, monthIdx: number): number {
    const mm = String(monthIdx + 1).padStart(2, '0');
    return (analytics?.categoryMonthly ?? []).find(r => r._id.categoryId === catId && r._id.month === mm)?.total ?? 0;
  }

  function getCatAnnualTotal(catId: string): number {
    return (analytics?.categoryMonthly ?? []).filter(r => r._id.categoryId === catId).reduce((s, r) => s + r.total, 0);
  }

  const categoriesToShow = activeCategory
    ? (settings?.categories ?? []).filter(c => c.id === activeCategory)
    : (settings?.categories ?? []);

  const lineData = months.map((m, i) => {
    const row: Record<string, number | string> = { month: m };
    categoriesToShow.forEach(cat => { row[cat.name] = getCatMonthSpend(cat.id, i); });
    return row;
  });

  const annualSpent   = (analytics?.monthTotals ?? []).reduce((s, m) => s + m.total, 0);
  const annualSalary  = settings?.annualSalary ?? 0;
  const annualSavings = annualSalary - annualSpent;
  const monthlySalary = settings?.monthlySalary ?? 0;
  const monthlySpent  = monthlyAnalytics?.overall ?? 0;

  if (loading) return (
    <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading reports…</div>
  );

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', paddingBottom: 80 }}>
      {/* Header */}
      <div style={{ padding: '24px 16px 16px' }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 16px 0' }}>Reports</h1>
        
        {/* Controls row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
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
          
          {viewMode === 'annual' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '4px 8px' }}>
              <button onClick={() => setSelectedYear(y => y - 1)} style={{ background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', padding: '4px 8px' }}><ChevronLeft size={16} /></button>
              <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)', margin: '0 4px' }}>{selectedYear}</span>
              <button onClick={() => setSelectedYear(y => y + 1)} style={{ background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', padding: '4px 8px' }}><ChevronRight size={16} /></button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '4px 8px' }}>
              <button onClick={() => navigateMonth(-1)} style={{ background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', padding: '4px 8px' }}><ChevronLeft size={16} /></button>
              <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)', margin: '0 4px' }}>{MONTHS[selectedMonth]} {selectedYear}</span>
              <button onClick={() => navigateMonth(1)} style={{ background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', padding: '4px 8px' }}><ChevronRight size={16} /></button>
            </div>
          )}
        </div>
      </div>

      {/* ── Net Worth Tracker Hero Card ── */}
      {settings && (
        <div style={{ padding: '0 16px 20px' }}>
          <NetWorthTracker settings={settings} onUpdate={setSettings} />
        </div>
      )}

      {/* 2x2 Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, padding: '0 16px 24px' }}>
        <div style={{ background: 'var(--bg-card)', padding: 16, borderRadius: 16, border: '1px solid var(--border)' }}>
          <div style={{ color: 'var(--success)', marginBottom: 8 }}><Wallet size={20} /></div>
          <div style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 4 }}>{viewMode === 'annual' ? 'Annual Income' : 'Monthly Income'}</div>
          <div style={{ color: 'var(--text-primary)', fontSize: 18, fontWeight: 700 }}>{formatINR(viewMode === 'annual' ? annualSalary : monthlySalary)}</div>
        </div>
        <div style={{ background: 'var(--bg-card)', padding: 16, borderRadius: 16, border: '1px solid var(--border)' }}>
          <div style={{ color: 'var(--danger)', marginBottom: 8 }}><CreditCard size={20} /></div>
          <div style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 4 }}>Total Spent</div>
          <div style={{ color: 'var(--text-primary)', fontSize: 18, fontWeight: 700 }}>{formatINR(viewMode === 'annual' ? annualSpent : monthlySpent)}</div>
        </div>
        <div style={{ background: 'var(--bg-card)', padding: 16, borderRadius: 16, border: '1px solid var(--border)' }}>
          <div style={{ color: 'var(--accent)', marginBottom: 8 }}><PiggyBank size={20} /></div>
          <div style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 4 }}>{viewMode === 'annual' ? 'Annual Savings' : 'Monthly Savings'}</div>
          <div style={{ color: 'var(--text-primary)', fontSize: 18, fontWeight: 700 }}>{formatINR(viewMode === 'annual' ? annualSavings : (monthlySalary - monthlySpent))}</div>
        </div>
        <div style={{ background: 'var(--bg-card)', padding: 16, borderRadius: 16, border: '1px solid var(--border)' }}>
          <div style={{ color: 'var(--warning)', marginBottom: 8 }}><CalendarDays size={20} /></div>
          <div style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 4 }}>{viewMode === 'annual' ? 'Avg Monthly' : 'Avg Daily'}</div>
          <div style={{ color: 'var(--text-primary)', fontSize: 18, fontWeight: 700 }}>{formatINR(viewMode === 'annual' ? (annualSpent / 12) : (monthlySpent / Math.max(1, now.getDate())))}</div>
        </div>
      </div>

      {viewMode === 'monthly' ? (
        <>
          <div style={{ padding: '0 16px' }}>
            <PredictiveCashflowCard
              salary={settings?.monthlyIncome || 0}
              expenses={expenses}
              categories={settings?.categories || []}
            />
          </div>

          <div style={{ padding: '0 16px 24px' }}>
            <SubscriptionAudit />
          </div>

          <div style={{ padding: '0 16px' }}>
            <PaymentMethodBreakdownCard expenses={expenses} />
          </div>

          <div style={{ padding: '0 16px' }}>
            <CategoryDonutChart
              categories={settings?.categories ?? []}
              categoryTotals={monthlyAnalytics?.categoryTotals ?? []}
              totalSpent={monthlySpent}
            />
          </div>

          <div style={{ padding: '0 16px 24px' }}>
            <AiInsights month={selectedMonth} year={selectedYear} scope="monthly" context="reports" />
          </div>

          <div style={{ padding: '0 16px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <TrendingUp size={18} color="var(--accent)" />
              <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Spending Velocity</h2>
            </div>
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: '20px 20px 0px', marginBottom: 16 }}>
              <h3 style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 16px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Cumulative Monthly Spend</h3>
              <div style={{ height: 200, marginLeft: -20, marginBottom: -10 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dailyChartData} margin={{ top: 5, right: 0, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                    <YAxis hide domain={['auto', 'auto']} />
                    <Tooltip content={<ChartTooltip />} />
                    <Line type="monotone" dataKey="totalSpent" name="Total Spent" stroke="var(--accent)" strokeWidth={3} dot={false} activeDot={{ r: 6, fill: 'var(--accent)', stroke: 'var(--bg-card)', strokeWidth: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: 16 }}>
               <h3 style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 16px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Day of Week Breakdown</h3>
               <div style={{ height: 120, marginLeft: -20, marginBottom: -10 }}>
                 <ResponsiveContainer width="100%" height="100%">
                   <BarChart data={dayOfWeekData}>
                     <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                     <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--border)', opacity: 0.4 }} />
                     <Bar dataKey="spent" name="Spent" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                   </BarChart>
                 </ResponsiveContainer>
               </div>
            </div>
          </div>
        </>
      ) : (
        <>
          <div style={{ padding: '0 16px 24px' }}>
            <AiInsights scope="annual" year={selectedYear} context="reports" />
          </div>

          <div style={{ padding: '0 16px 24px' }}>
            <div style={{ background: 'var(--bg-card)', borderRadius: 20, padding: '20px 16px', border: '1px solid var(--border)' }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>Cash Flow</h2>
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={monthBarData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--success)" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="var(--success)" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorSpent" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="var(--accent)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="4 4" stroke="rgba(255,255,255,0.03)" vertical={false} />
                  <XAxis dataKey="month" tick={{ fill: 'var(--text-muted)', fontSize: 11, fontWeight: 500 }} axisLine={false} tickLine={false} dy={10} />
                  <YAxis tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} tick={{ fill: 'var(--text-muted)', fontSize: 11, fontWeight: 500 }} axisLine={false} tickLine={false} dx={-10} />
                  <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1, strokeDasharray: '4 4' }} />
                  <Area type="monotone" dataKey="Income" stroke="var(--success)" strokeWidth={3} fillOpacity={1} fill="url(#colorIncome)" style={{ filter: 'drop-shadow(0 4px 6px rgba(16,185,129,0.2))' }} />
                  <Area type="monotone" dataKey="Spent" stroke="var(--accent)" strokeWidth={3} fillOpacity={1} fill="url(#colorSpent)" style={{ filter: 'drop-shadow(0 4px 8px rgba(139,124,246,0.4))' }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div style={{ padding: '0 16px 24px' }}>
            <div style={{ background: 'var(--bg-card)', borderRadius: 20, padding: '20px 16px', border: '1px solid var(--border)' }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>Category Trends</h2>
              
              <div style={{ display: 'flex', overflowX: 'auto', gap: 8, paddingBottom: 16, scrollbarWidth: 'none' }}>
                <button
                  onClick={() => setActiveCategory(null)}
                  style={{ whiteSpace: 'nowrap', padding: '6px 16px', borderRadius: 9999, border: '1px solid var(--border)', background: !activeCategory ? 'var(--text-primary)' : 'var(--bg-card)', color: !activeCategory ? 'var(--bg-card)' : 'var(--text-primary)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                >All Categories</button>
                {(settings?.categories ?? []).map(c => (
                  <button
                    key={c.id}
                    onClick={() => setActiveCategory(activeCategory === c.id ? null : c.id)}
                    style={{ whiteSpace: 'nowrap', padding: '6px 16px', borderRadius: 9999, border: '1px solid var(--border)', background: activeCategory === c.id ? c.color : 'var(--bg-card)', color: activeCategory === c.id ? '#fff' : 'var(--text-primary)', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                  ><CategoryIcon name={c.name} size={12} /> {c.name}</button>
                ))}
              </div>

              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={lineData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                  <defs>
                    <filter id="line-shadow" x="-20%" y="-20%" width="140%" height="140%">
                      <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#000" floodOpacity="0.4"/>
                    </filter>
                  </defs>
                  <CartesianGrid strokeDasharray="4 4" stroke="rgba(255,255,255,0.03)" vertical={false} />
                  <XAxis dataKey="month" tick={{ fill: 'var(--text-muted)', fontSize: 11, fontWeight: 500 }} axisLine={false} tickLine={false} dy={10} />
                  <YAxis tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} tick={{ fill: 'var(--text-muted)', fontSize: 11, fontWeight: 500 }} axisLine={false} tickLine={false} dx={-10} />
                  <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1, strokeDasharray: '4 4' }} />
                  {categoriesToShow.map(cat => (
                    <Line key={cat.id} type="monotone" dataKey={cat.name} stroke={cat.color} strokeWidth={3} dot={false} activeDot={{ r: 6, fill: cat.color, stroke: 'var(--bg-card)', strokeWidth: 2 }} style={{ filter: 'url(#line-shadow)' }} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div style={{ padding: '0 16px 40px' }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>Annual Breakdown</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {(settings?.categories ?? []).map(cat => {
                const annual = getCatAnnualTotal(cat.id);
                const overBudget = annual > cat.monthlyBudget * 12;
                return (
                  <div key={cat.id} style={{ background: 'var(--bg-card)', borderRadius: 16, padding: 16, border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 40, height: 40, borderRadius: '50%', background: `${cat.color}26`, color: cat.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <CategoryIcon name={cat.name} size={20} />
                        </div>
                        <div>
                          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{cat.name}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Budget: {formatINR(cat.monthlyBudget)}/mo</div>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 16, fontWeight: 700, color: overBudget ? 'var(--danger)' : 'var(--text-primary)' }}>{formatINR(annual)}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Total Year</div>
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', overflowX: 'auto', gap: 8, scrollbarWidth: 'none', paddingBottom: 4 }}>
                      {SHORT_MONTHS.map((m, i) => {
                        const v = getCatMonthSpend(cat.id, i);
                        return (
                          <div key={m} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'var(--bg)', borderRadius: 12, padding: '8px 12px', minWidth: 64, border: '1px solid var(--border)' }}>
                            <span style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{m}</span>
                            <span style={{ fontSize: 13, fontWeight: 600, color: v > 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}>{v > 0 ? `₹${(v/1000).toFixed(1)}k` : '-'}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* ── Top Merchants Section ── */}
      {topMerchants.length > 0 && (
        <div style={{ padding: '0 16px 32px' }}>
          <div style={{
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 20, padding: '20px 16px',
            boxShadow: 'var(--shadow-xs)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <Store size={18} color="var(--accent)" />
              <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                Top Merchants & Vendors
              </h2>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {topMerchants.map((m, idx) => {
                const maxSpend = topMerchants[0].total;
                const pctOfTop = maxSpend > 0 ? (m.total / maxSpend) * 100 : 0;
                const cat = settings?.categories.find(c => c.id === m.categoryId);

                return (
                  <div key={m.name} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{
                          fontSize: 11, fontWeight: 800, color: 'var(--accent-2)',
                          width: 20, height: 20, borderRadius: '50%',
                          background: 'var(--accent-dim)', display: 'flex',
                          alignItems: 'center', justifyContent: 'center'
                        }}>
                          {idx + 1}
                        </span>
                        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                          {m.name}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          • {m.count} txn{m.count > 1 ? 's' : ''}
                        </span>
                      </div>
                      <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>
                        {formatINR(m.total)}
                      </span>
                    </div>
                    <div style={{ height: 5, background: 'var(--bg-elevated)', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', width: `${pctOfTop}%`,
                        background: cat?.color || 'var(--accent)',
                        borderRadius: 99, transition: 'width 0.6s ease',
                      }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
