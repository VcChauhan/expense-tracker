'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line,
} from 'recharts';
import { formatINR, SHORT_MONTHS, MONTHS, Settings, AnnualAnalytics } from '@/lib/types';
import { Wallet, CreditCard, PiggyBank, CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { CategoryIcon } from '@/components/CategoryIcon';
import AiInsights from '@/components/AiInsights';

const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '10px 16px', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
      <p style={{ color: 'var(--text-muted)', fontSize: 11, marginBottom: 6, fontWeight: 600 }}>{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color || 'var(--text-primary)', fontWeight: 700, fontSize: 13 }}>{p.name}: {formatINR(p.value)}</p>
      ))}
    </div>
  );
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
      setSettings(s); setAnalytics(a);
    } finally { setLoading(false); }
  }, [selectedYear]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) return (
    <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading reports…</div>
  );

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

  const grandTotal   = (analytics?.monthTotals ?? []).reduce((s, m) => s + m.total, 0);
  const annualSalary  = settings?.annualSalary ?? 0;
  const annualSavings = annualSalary - grandTotal;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', paddingBottom: 80 }}>
      {/* Header */}
      <div style={{ padding: '24px 16px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Reports</h1>
        <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-card)', borderRadius: 9999, border: '1px solid var(--border)', padding: '2px 8px' }}>
          <button onClick={() => setSelectedYear(y => y - 1)} style={{ background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', padding: '4px 8px' }}><ChevronLeft size={16} /></button>
          <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)', margin: '0 8px' }}>{selectedYear}</span>
          <button onClick={() => setSelectedYear(y => y + 1)} style={{ background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', padding: '4px 8px' }}><ChevronRight size={16} /></button>
        </div>
      </div>

      {/* 2x2 Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, padding: '0 16px 24px' }}>
        <div style={{ background: 'var(--bg-card)', padding: 16, borderRadius: 16, border: '1px solid var(--border)' }}>
          <div style={{ color: 'var(--success)', marginBottom: 8 }}><Wallet size={20} /></div>
          <div style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 4 }}>Annual Income</div>
          <div style={{ color: 'var(--text-primary)', fontSize: 18, fontWeight: 700 }}>{formatINR(annualSalary)}</div>
        </div>
        <div style={{ background: 'var(--bg-card)', padding: 16, borderRadius: 16, border: '1px solid var(--border)' }}>
          <div style={{ color: 'var(--danger)', marginBottom: 8 }}><CreditCard size={20} /></div>
          <div style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 4 }}>Total Spent</div>
          <div style={{ color: 'var(--text-primary)', fontSize: 18, fontWeight: 700 }}>{formatINR(grandTotal)}</div>
        </div>
        <div style={{ background: 'var(--bg-card)', padding: 16, borderRadius: 16, border: '1px solid var(--border)' }}>
          <div style={{ color: 'var(--accent)', marginBottom: 8 }}><PiggyBank size={20} /></div>
          <div style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 4 }}>Annual Savings</div>
          <div style={{ color: 'var(--text-primary)', fontSize: 18, fontWeight: 700 }}>{formatINR(annualSavings)}</div>
        </div>
        <div style={{ background: 'var(--bg-card)', padding: 16, borderRadius: 16, border: '1px solid var(--border)' }}>
          <div style={{ color: 'var(--warning)', marginBottom: 8 }}><CalendarDays size={20} /></div>
          <div style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 4 }}>Avg Monthly</div>
          <div style={{ color: 'var(--text-primary)', fontSize: 18, fontWeight: 700 }}>{formatINR(grandTotal / 12)}</div>
        </div>
      </div>

      {/* Cash Flow Chart */}
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
                  <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="var(--accent)" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="month" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip />} />
              <Area type="monotone" dataKey="Income" stroke="var(--success)" strokeWidth={2} fillOpacity={1} fill="url(#colorIncome)" />
              <Area type="monotone" dataKey="Spent" stroke="var(--accent)" strokeWidth={2} fillOpacity={1} fill="url(#colorSpent)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Category Trends */}
      <div style={{ padding: '0 16px 24px' }}>
        <div style={{ background: 'var(--bg-card)', borderRadius: 20, padding: '20px 16px', border: '1px solid var(--border)' }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>Category Trends</h2>
          
          <div style={{ marginBottom: 16 }}>
            <AiInsights context="reports" scope="annual" year={selectedYear} />
          </div>

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
            <LineChart data={lineData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="month" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip />} />
              {categoriesToShow.map(cat => (
                <Line key={cat.id} type="monotone" dataKey={cat.name} stroke={cat.color} strokeWidth={2} dot={false} activeDot={{ r: 6 }} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Annual Breakdown */}
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
    </div>
  );
}
