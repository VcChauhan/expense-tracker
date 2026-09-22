'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  AreaChart, Area, Tooltip, ResponsiveContainer,
  XAxis, YAxis, CartesianGrid
} from 'recharts';
import { Target, Bell, TrendingUp, TrendingDown, Minus, Sparkles, ArrowRight, Repeat } from 'lucide-react';
import { formatINR, MONTHS, SHORT_MONTHS, Settings, Expense } from '@/lib/types';

import { HealthScoreCard } from '@/components/HealthScoreCard';
import { TimeTravelSlider } from '@/components/TimeTravelSlider';
import { CategoryIcon } from '@/components/CategoryIcon';
import { FocusWheel } from '@/components/FocusWheel';
import { MonthlyRecapCard } from '@/components/MonthlyRecapCard';
import { AiBudgetAnomalyCard } from '@/components/AiBudgetAnomalyCard';
import { AffordabilityChecker } from '@/components/AffordabilityChecker';
import { RebalanceModal } from '@/components/RebalanceModal';
import { SubscriptionAudit } from '@/components/SubscriptionAudit';
import { CreditCardTracker } from '@/components/CreditCardTracker';
import { OnboardingWizard } from '@/components/OnboardingWizard';

interface CategoryTotal { _id: string; total: number; count: number; }
interface MonthTotal    { _id: string; total: number; count: number; }
type ViewMode = 'monthly' | 'annual';

// Custom Tooltip
const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border-strong)',
      borderRadius: 14,
      padding: '10px 16px',
      boxShadow: 'var(--shadow-md)',
    }}>
      <p style={{ color: 'var(--text-muted)', fontSize: 11, marginBottom: 6, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color, fontWeight: 800, fontSize: 14, margin: 0, letterSpacing: '-0.3px' }}>
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
  const [dailyTotals, setDailyTotals]     = useState<{_id: string; total: number}[]>([]);
  const [prevCategoryTotals, setPrevCategoryTotals] = useState<CategoryTotal[]>([]);
  const [recentExpenses, setRecentExpenses] = useState<Expense[]>([]);
  const [allExpenses, setAllExpenses]       = useState<Expense[]>([]);
  const [historicalAverage, setHistoricalAverage] = useState(0);
  const [showRebalanceModal, setShowRebalanceModal] = useState(false);
  const [pendingSuggestionsCount, setPendingSuggestionsCount] = useState(0);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [loading, setLoading]             = useState(true);
  const [loggingRecurringId, setLoggingRecurringId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      let prevMonth = selectedMonth - 1;
      let prevYear = selectedYear;
      if (prevMonth < 0) { prevMonth = 11; prevYear -= 1; }
      const [settingsRes, monthlyRes, annualRes, suggestionsRes, prevMonthlyRes, expRes] = await Promise.all([
        fetch('/api/settings'),
        fetch(`/api/analytics/monthly?month=${selectedMonth + 1}&year=${selectedYear}`),
        fetch(`/api/analytics/annual?year=${selectedYear}`),
        fetch('/api/suggestions'),
        fetch(`/api/analytics/monthly?month=${prevMonth + 1}&year=${prevYear}`),
        fetch('/api/expenses?limit=300'),
      ]);
      const [s, m, a, sugs, prevM, exps] = await Promise.all([
        settingsRes.json(),
        monthlyRes.json(),
        annualRes.json(),
        suggestionsRes.json(),
        prevMonthlyRes.json(),
        expRes.json(),
      ]);
      if (s && !s.error) {
        setSettings(s);
        if ((!s.annualSalary || s.annualSalary === 0) && typeof window !== 'undefined' && !localStorage.getItem('onboardingDismissed')) {
          setShowOnboarding(true);
        }
      }
      if (Array.isArray(sugs)) {
        setPendingSuggestionsCount(sugs.length);
      }
      if (Array.isArray(exps)) {
        setAllExpenses(exps);
      }
      setCategoryTotals(Array.isArray(m.categoryTotals) ? m.categoryTotals : []);
      setPrevCategoryTotals(Array.isArray(prevM.categoryTotals) ? prevM.categoryTotals : []);
      setRecentExpenses(Array.isArray(m.recent) ? m.recent : []);
      setDailyTotals(Array.isArray(m.dailyTotals) ? m.dailyTotals : []);
      setHistoricalAverage(m.historicalAverage || 0);
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

  const handleLogRecurring = async (item: any) => {
    setLoggingRecurringId(item.id);
    try {
      const today = new Date().toISOString().split('T')[0];
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: today,
          categoryId: item.categoryId,
          amount: item.amount,
          note: `${item.name} (Recurring)`,
          tags: ['recurring'],
          paymentMethod: 'upi',
        }),
      });

      if (res.ok) {
        const currentYM = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;
        const nextList = (settings?.recurringExpenses || []).map((r: any) =>
          r.id === item.id ? { ...r, lastLoggedMonth: currentYM } : r
        );
        await fetch('/api/settings', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ recurringExpenses: nextList }),
        });
        await fetchData();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoggingRecurringId(null);
    }
  };

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
  const remainingDays  = isAnnual
    ? Math.max(1, Math.floor((new Date(selectedYear, 11, 31).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) + 1)
    : Math.max(1, new Date(selectedYear, selectedMonth + 1, 0).getDate() - now.getDate() + 1);
  const safePerDay     = displayBudget > 0 ? ((displayBudget - displaySpent) / remainingDays) : 0;

  const activeTotalsMap: Record<string, number> = {};
  activeTotals.forEach(t => activeTotalsMap[t._id] = t.total);

  const overBudgetCategories = useMemo(() => {
    if (viewMode !== 'monthly' || !settings) return [];
    return categoryTotals.filter(ct => {
      const cat = settings.categories.find(c => c.id === ct._id);
      return cat && ct.total > cat.monthlyBudget && cat.monthlyBudget > 0;
    }).map(ct => {
      const cat = settings.categories.find(c => c.id === ct._id)!;
      return { ...cat, spent: ct.total };
    });
  }, [categoryTotals, settings, viewMode]);

  // Trend chart data
  const areaData = useMemo(() =>
    SHORT_MONTHS.map((m, i) => {
      const mm = String(i + 1).padStart(2, '0');
      const t  = monthTotals.find(x => x._id === mm);
      return { month: m, Spent: t?.total ?? 0 };
    }),
  [monthTotals]);

  // Expenses for the selected month (for On-Device Anomaly Analysis)
  const selectedMonthExpenses = useMemo(() => {
    const ym = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;
    return allExpenses.filter(e => e.date && e.date.startsWith(ym));
  }, [allExpenses, selectedMonth, selectedYear]);

  function navigateMonth(dir: number) {
    let m = selectedMonth + dir, y = selectedYear;
    if (m < 0)  { m = 11; y--; }
    if (m > 11) { m = 0;  y++; }
    setSelectedMonth(m); setSelectedYear(y);
  }

  const getCategoryById = (id: string) => settings?.categories?.find(c => c.id === id);

  // Savings trend vs historical
  const savingsTrend = historicalAverage > 0
    ? monthlySpent < historicalAverage ? 'up' : monthlySpent > historicalAverage ? 'down' : 'neutral'
    : 'neutral';

  return (
    <div style={{ padding: '20px 16px calc(var(--nav-height) + 40px) 16px', maxWidth: 540, margin: '0 auto' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 2px 0', fontWeight: 500 }}>{getGreeting()} 👋</p>
          <h1 style={{ fontSize: 26, fontWeight: 900, margin: 0, color: 'var(--text-primary)', letterSpacing: '-0.6px' }}>
            Vivek
          </h1>
        </div>
        {historicalAverage > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: savingsTrend === 'up' ? 'var(--success-dim)' : savingsTrend === 'down' ? 'var(--danger-dim)' : 'var(--bg-elevated)',
            border: `1px solid ${savingsTrend === 'up' ? 'rgba(74,222,128,0.25)' : savingsTrend === 'down' ? 'rgba(248,113,113,0.25)' : 'var(--border)'}`,
            borderRadius: 99, padding: '6px 12px',
          }}>
            {savingsTrend === 'up'
              ? <TrendingDown size={14} color="var(--success)" />
              : savingsTrend === 'down'
              ? <TrendingUp size={14} color="var(--danger)" />
              : <Minus size={14} color="var(--text-muted)" />}
            <span style={{ fontSize: 12, fontWeight: 700, color: savingsTrend === 'up' ? 'var(--success)' : savingsTrend === 'down' ? 'var(--danger)' : 'var(--text-muted)' }}>
              vs avg
            </span>
          </div>
        )}
      </div>

      {/* ── SMS Review Banner ── */}
      {pendingSuggestionsCount > 0 && (
        <Link
          href="/expenses"
          style={{
            textDecoration: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(135deg, rgba(124, 92, 252, 0.18) 0%, rgba(167, 139, 250, 0.12) 100%)',
            border: '1.5px solid rgba(124, 92, 252, 0.35)',
            borderRadius: 18,
            padding: '12px 16px',
            marginBottom: 16,
            boxShadow: '0 4px 14px rgba(124, 92, 252, 0.15)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 10,
              background: 'var(--accent)', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <Sparkles size={16} />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)' }}>
                {pendingSuggestionsCount} UPI / Bank Transaction{pendingSuggestionsCount > 1 ? 's' : ''} Awaiting Review
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                Auto-detected on device • Tap to review or split
              </div>
            </div>
          </div>
          <div style={{ color: 'var(--accent-2)', display: 'flex', alignItems: 'center' }}>
            <ArrowRight size={16} />
          </div>
        </Link>
      )}

      {/* ── Budget Alert ── */}
      {overBudgetCategories.length > 0 && (
        <div style={{
          background: 'var(--danger-dim)',
          border: '1px solid rgba(248,113,113,0.3)',
          borderRadius: 18, padding: '14px 16px', marginBottom: 16,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: 10,
          animation: 'fade-in-up 0.3s var(--ease) both',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 10,
              background: 'rgba(248,113,113,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <Bell size={16} color="var(--danger)" />
            </div>
            <div>
              <h3 style={{ fontSize: 14, fontWeight: 800, margin: '0 0 2px 0', color: 'var(--danger)' }}>Budget Alert</h3>
              <p style={{ fontSize: 12, margin: 0, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                Over budget: <strong style={{ color: 'var(--text-primary)' }}>{overBudgetCategories.map(c => c.name).join(', ')}</strong>
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowRebalanceModal(true)}
            style={{
              padding: '8px 14px', borderRadius: 99,
              background: 'var(--danger)', color: '#fff',
              border: 'none', fontWeight: 700, fontSize: 13,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
              fontFamily: "'DM Sans', sans-serif",
              boxShadow: '0 4px 14px rgba(248,113,113,0.4)',
            }}
          >
            ⚡ Rebalance
          </button>
        </div>
      )}

      {/* ── Controls ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        {/* View Mode Toggle */}
        <div style={{
          display: 'flex', background: 'var(--bg-elevated)',
          border: '1px solid var(--border)', borderRadius: 99, padding: 3,
        }}>
          {(['monthly', 'annual'] as ViewMode[]).map(v => (
            <button key={v} onClick={() => setViewMode(v)}
              style={{
                padding: '7px 14px', fontSize: 13, fontWeight: 700, borderRadius: 99, border: 'none',
                background: viewMode === v ? 'var(--accent)' : 'transparent',
                color: viewMode === v ? 'white' : 'var(--text-secondary)',
                cursor: 'pointer', transition: 'all 0.2s ease',
                boxShadow: viewMode === v ? '0 2px 10px rgba(124,92,252,0.4)' : 'none',
                fontFamily: "'DM Sans', sans-serif",
              }}>
              {v === 'monthly' ? 'Monthly' : 'Annual'}
            </button>
          ))}
        </div>

        {/* Period Navigator */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 2,
          background: 'var(--bg-elevated)', border: '1px solid var(--border)',
          borderRadius: 99, padding: '3px 4px',
        }}>
          <button
            style={{ background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', padding: '5px 10px', borderRadius: 99, fontSize: 16 }}
            onClick={() => isAnnual ? setSelectedYear(y => y - 1) : navigateMonth(-1)}
          >‹</button>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', padding: '0 4px', whiteSpace: 'nowrap' }}>
            {isAnnual ? selectedYear : `${MONTHS[selectedMonth].slice(0, 3)} ${selectedYear}`}
          </span>
          <button
            style={{ background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', padding: '5px 10px', borderRadius: 99, fontSize: 16 }}
            onClick={() => isAnnual ? setSelectedYear(y => y + 1) : navigateMonth(1)}
          >›</button>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 0', gap: 12 }}>
          <div className="spinner" style={{ width: 28, height: 28, borderColor: 'var(--border-strong)', borderTopColor: 'var(--accent)' }} />
          <span style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 500 }}>Loading your data...</span>
        </div>
      ) : (
        <>
          {/* ── Section: Overview ── */}
          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', margin: '4px 2px 10px' }}>
            {isAnnual ? `${selectedYear} Overview` : 'This Month'}
          </div>

          {/* ── On-Device AI Budget Normalization & Anomaly Card ── */}
          {!isAnnual && (
            <AiBudgetAnomalyCard
              expenses={selectedMonthExpenses}
              categories={settings?.categories ?? []}
              selectedMonth={selectedMonth}
              selectedYear={selectedYear}
              monthName={MONTHS[selectedMonth]}
              settings={settings}
              onSettingsUpdate={s => setSettings(s)}
            />
          )}

          {/* ── Monthly Recap Card ── */}
          {!isAnnual && monthlySalary > 0 && (
            <MonthlyRecapCard
              spent={monthlySpent}
              income={monthlySalary}
              budget={monthlyBudget}
              categories={settings?.categories ?? []}
              categoryTotals={categoryTotals}
              prevCategoryTotals={prevCategoryTotals}
              historicalAverage={historicalAverage}
              savingsGoals={settings?.savingsGoals}
              month={selectedMonth}
              year={selectedYear}
            />
          )}

          {/* ── Hero FocusWheel Card ── */}
                    {/* ── Hero FocusWheel Card ── */}
          {displayBudget === 0 ? (
            <div style={{
              background: 'var(--bg-card)',
              border: '1px dashed var(--border-strong)',
              borderRadius: 24,
              padding: '36px 24px',
              marginBottom: 16,
              display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
            }}>
              <div style={{
                width: 52, height: 52, borderRadius: 16, marginBottom: 14,
                background: 'var(--accent-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Target size={24} color="var(--accent-2)" />
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                Your spending wheel is empty
              </h3>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '6px 0 18px', maxWidth: 280, lineHeight: 1.5 }}>
                {monthlySalary === 0
                  ? 'Set your monthly income and at least one category budget to see spending broken down here.'
                  : 'Set a budget for at least one category to see it show up in your spending wheel.'}
              </p>
              <Link href="/settings" style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: 'var(--accent-grad)', color: '#fff', fontWeight: 700, fontSize: 13.5,
                padding: '10px 18px', borderRadius: 99, textDecoration: 'none',
              }}>
                Set up budgets <ArrowRight size={14} />
              </Link>
            </div>
          ) : (
          <div style={{
            position: 'relative',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-glow)',
            borderRadius: 24,
            padding: '52px 20px 28px',
            marginBottom: 16,
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            boxShadow: 'var(--shadow-glow)',
            overflow: 'hidden',
          }}>
            {/* Subtle gradient overlay at top */}
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, height: 80,
              background: 'linear-gradient(180deg, var(--accent-dim) 0%, transparent 100%)',
              pointerEvents: 'none',
            }} />

            {/* Top Left — Income */}
            <div style={{ position: 'absolute', top: 20, left: 20, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
              <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', fontWeight: 700 }}>Income</span>
              <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--success)', letterSpacing: '-0.4px' }}>{formatINR(displayIncome)}</span>
            </div>

            {/* Top Right — Safe/Day */}
            <div style={{ position: 'absolute', top: 20, right: 20, display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', fontWeight: 700 }}>Safe/Day</span>
              <span style={{ fontSize: 15, fontWeight: 800, color: safePerDay > 0 ? 'var(--success)' : 'var(--danger)', letterSpacing: '-0.4px' }}>₹{Math.max(0, safePerDay).toFixed(0)}</span>
            </div>

            <FocusWheel
              data={(settings?.categories ?? []).map(cat => ({
                label: cat.name,
                icon: cat.name,
                color: cat.color,
                current: activeTotalsMap[cat.id] ?? 0,
                limit: isAnnual ? cat.monthlyBudget * 12 : cat.monthlyBudget
              }))}
              size={300}
              strokeWidth={52}
            >
              <span style={{ fontSize: 32, fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-1px' }}>{formatINR(displaySpent)}</span>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2, fontWeight: 500 }}>of {formatINR(displayBudget)} budget</span>
              <span style={{
                fontSize: 14, fontWeight: 800, marginTop: 6,
                color: budgetPct >= 100 ? 'var(--danger)' : budgetPct >= 80 ? 'var(--warning)' : 'var(--success)',
                background: budgetPct >= 100 ? 'var(--danger-dim)' : budgetPct >= 80 ? 'var(--warning-dim)' : 'var(--success-dim)',
                padding: '3px 10px', borderRadius: 99,
              }}>{budgetPct.toFixed(0)}% used</span>
            </FocusWheel>

            {/* Bottom stats row */}
            <div style={{ display: 'flex', gap: 0, width: '100%', marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
              {[
                { label: 'Saved', value: formatINR(displaySavings), color: displaySavings >= 0 ? 'var(--accent-2)' : 'var(--danger)' },
                { label: 'Budget', value: formatINR(displayBudget), color: 'var(--text-primary)' },
                { label: 'Remaining', value: `${Math.max(remainingDays, 0)}d`, color: 'var(--text-secondary)' },
              ].map((stat, i) => (
                <div key={i} style={{ flex: 1, textAlign: 'center', borderRight: i < 2 ? '1px solid var(--border)' : 'none' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', fontWeight: 700, marginBottom: 3 }}>{stat.label}</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: stat.color, letterSpacing: '-0.4px' }}>{stat.value}</div>
                </div>
              ))}
            </div>
          </div>
          )}
           {/* ── Section: Planning Tools ── */}
          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', margin: '20px 2px 10px' }}>
            Planning Tools
          </div>
          
          {/* ── "Can I Afford This?" ── */}
          <AffordabilityChecker
            monthlySalary={monthlySalary}
            monthlySpent={monthlySpent}
            monthlyBudget={monthlyBudget}
            categories={settings?.categories ?? []}
            activeTotalsMap={activeTotalsMap}
          />

          {/* ── Savings Goals ── */}
          {settings?.savingsGoals && settings.savingsGoals.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--accent-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Target size={14} color="var(--accent-2)" />
                </div>
                <h2 style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.3px' }}>Savings Goals</h2>
              </div>
              <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 6, margin: '0 -16px', paddingLeft: 16, paddingRight: 16, scrollbarWidth: 'none' }}>
                {settings.savingsGoals.map(goal => {
                  const progress = goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0;
                  return (
                    <div key={goal.id} style={{
                      minWidth: 220, background: 'var(--bg-card)',
                      border: '1px solid var(--border)', borderRadius: 20, padding: 16,
                      flexShrink: 0, boxShadow: 'var(--shadow-xs)',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                        <div style={{
                          width: 38, height: 38, borderRadius: 12,
                          background: `${goal.color}22`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 18, border: `1px solid ${goal.color}33`,
                        }}>
                          {goal.icon}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>{goal.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>Target: {formatINR(goal.targetAmount)}</div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 8 }}>
                        <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--success)', letterSpacing: '-0.5px' }}>{formatINR(goal.currentAmount)}</div>
                        <div style={{
                          fontSize: 12, fontWeight: 800,
                          background: 'var(--bg-elevated)',
                          padding: '2px 8px', borderRadius: 99,
                          color: 'var(--text-secondary)',
                        }}>{progress.toFixed(0)}%</div>
                      </div>

                      {/* Progress Bar */}
                      <div style={{ width: '100%', height: 6, background: 'var(--bg-elevated)', borderRadius: 99, overflow: 'hidden' }}>
                        <div style={{
                          height: '100%',
                          background: goal.color,
                          width: `${Math.min(100, progress)}%`,
                          borderRadius: 99,
                          transition: 'width 0.7s var(--ease)',
                        }} />
                      </div>

                      {/* Projection */}
                      {(() => {
                        const avgMonthlySavings = monthlySalary > 0
                          ? (historicalAverage > 0 ? monthlySalary - historicalAverage : monthlySavings)
                          : 0;
                        const remaining = goal.targetAmount - goal.currentAmount;
                        if (remaining <= 0) return (
                          <div style={{ marginTop: 8, fontSize: 12, color: 'var(--success)', fontWeight: 700 }}>🎉 Goal reached!</div>
                        );
                        if (avgMonthlySavings <= 0) return (
                          <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>Set income to see projection</div>
                        );
                        const monthsToGoal = Math.ceil(remaining / avgMonthlySavings);
                        const projectedDate = new Date();
                        projectedDate.setMonth(projectedDate.getMonth() + monthsToGoal);
                        const projectedStr = `${MONTHS[projectedDate.getMonth()].slice(0, 3)} ${projectedDate.getFullYear()}`;
                        const targetDate = goal.targetDate ? new Date(goal.targetDate) : null;
                        const isOnTrack = targetDate ? projectedDate <= targetDate : true;
                        return (
                          <div style={{ marginTop: 8, fontSize: 12, fontWeight: 700, color: isOnTrack ? 'var(--success)' : 'var(--warning)' }}>
                            {isOnTrack ? '🎯 On track' : '⏳ At current pace'} — {projectedStr}
                          </div>
                        );
                      })()}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Financial Health Score ── */}
          <HealthScoreCard
            spent={displaySpent}
            budget={displayBudget}
            income={displayIncome}
            safePerDay={safePerDay}
            categories={settings?.categories ?? []}
            activeTotalsMap={activeTotalsMap}
            historicalAverage={historicalAverage}
            isAnnual={isAnnual}
          />

          {/* ── Time Travel Slider ── */}
          <TimeTravelSlider
            spent={displaySpent}
            budget={displayBudget}
            income={displayIncome}
            categories={settings?.categories ?? []}
            activeTotalsMap={activeTotalsMap}
            selectedMonth={selectedMonth}
            selectedYear={selectedYear}
          />

          {/* ── Annual Trend Chart (shown in annual mode) ── */}
          {isAnnual && (
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 20, padding: '20px 16px', marginBottom: 16 }}>
              <h2 style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 16px 0', letterSpacing: '-0.3px' }}>
                Monthly Spending — {selectedYear}
              </h2>
              <ResponsiveContainer width="100%" height={160}>
                <AreaChart data={areaData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="spentGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'var(--text-muted)', fontWeight: 600 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area type="monotone" dataKey="Spent" stroke="var(--accent)" strokeWidth={2.5} fill="url(#spentGrad)" dot={false} activeDot={{ r: 5, fill: 'var(--accent)', strokeWidth: 0 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* ── Category Budget Cards ── */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h2 style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.3px' }}>Category Budgets</h2>
              <Link href="/settings" style={{ fontSize: 13, color: 'var(--accent-2)', textDecoration: 'none', fontWeight: 700 }}>Manage →</Link>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {(settings?.categories ?? []).map(cat => {
                const spent  = activeTotalsMap[cat.id] ?? 0;
                const cap    = isAnnual ? cat.monthlyBudget * 12 : cat.monthlyBudget;
                const pct    = cap > 0 ? Math.min((spent / cap) * 100, 100) : 0;
                const rawPct = cap > 0 ? (spent / cap) * 100 : 0;
                const isOver = rawPct >= 100;
                const isWarn = rawPct >= 80 && !isOver;
                const barColor = isOver ? 'var(--danger)' : isWarn ? 'var(--warning)' : cat.color;
                const badgeColor = isOver ? 'var(--danger)' : isWarn ? 'var(--warning)' : 'var(--success)';
                const badgeBg = isOver ? 'var(--danger-dim)' : isWarn ? 'var(--warning-dim)' : 'var(--success-dim)';

                return (
                  <div key={cat.id} style={{
                    background: 'var(--bg-card)',
                    border: `1px solid ${isOver ? 'rgba(248,113,113,0.25)' : 'var(--border)'}`,
                    borderRadius: 18, padding: '14px 16px',
                    borderLeft: `3px solid ${barColor}`,
                    transition: 'all 0.2s ease',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: 10,
                        background: `${cat.color}18`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0,
                      }}>
                        <CategoryIcon name={cat.name} color={cat.color} size={18} inList={true} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{cat.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>
                          {formatINR(spent)} <span style={{ color: 'var(--text-muted)' }}>/ {formatINR(cap)}</span>
                        </div>
                      </div>
                      <div style={{ padding: '4px 10px', borderRadius: 99, background: badgeBg, color: badgeColor, fontSize: 12, fontWeight: 800, flexShrink: 0 }}>
                        {cap > 0 ? rawPct.toFixed(0) : 0}%
                      </div>
                    </div>
                    <div style={{ height: 5, background: 'var(--bg-elevated)', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', width: `${pct}%`, background: barColor,
                        borderRadius: 99, transition: 'width 0.7s var(--ease)',
                      }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Section: Bills & Accounts ── */}
          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', margin: '4px 2px 10px' }}>
            Bills &amp; Accounts
          </div>
          
          {/* ── Subscription & Leak Audit ── */}
          <SubscriptionAudit />

          {/* ── Recurring Due This Month Widget ── */}
          {(() => {
            const currentYM = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;
            const dueRecurring = (settings?.recurringExpenses || []).filter(r => r.isActive && r.lastLoggedMonth !== currentYM);
            if (dueRecurring.length === 0) return null;
            return (
              <div style={{
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: 20, padding: '16px 18px', marginBottom: 20,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Repeat size={16} color="var(--accent)" />
                    <h3 style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                      Recurring Due This Month ({dueRecurring.length})
                    </h3>
                  </div>
                  <Link href="/settings" style={{ fontSize: 12, color: 'var(--accent-2)', textDecoration: 'none', fontWeight: 700 }}>
                    Manage →
                  </Link>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {dueRecurring.slice(0, 3).map(item => (
                    <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-elevated)', borderRadius: 12, padding: '10px 12px' }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                          {item.name}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                          Due Day {item.dayOfMonth}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>
                          {formatINR(item.amount)}
                        </div>
                        <button
                          onClick={() => handleLogRecurring(item)}
                          disabled={loggingRecurringId === item.id}
                          style={{
                            padding: '5px 11px', borderRadius: 8,
                            background: 'var(--accent)', color: '#fff', border: 'none',
                            fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
                          }}
                        >
                          {loggingRecurringId === item.id ? 'Logging…' : 'Log'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* ── Credit Card Tracker ── */}
          {settings && (
            <CreditCardTracker
              settings={settings}
              expenses={allExpenses}
              onUpdate={setSettings}
            />
          )}

          {showRebalanceModal && (
            <RebalanceModal
              categories={settings?.categories ?? []}
              activeTotalsMap={activeTotalsMap}
              onClose={() => setShowRebalanceModal(false)}
              onApprove={async (updatedCategories) => {
                try {
                  const res = await fetch('/api/settings', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ categories: updatedCategories })
                  });
                  if (res.ok) {
                    const s = await res.json();
                    setSettings(s);
                    setShowRebalanceModal(false);
                  }
                } catch (err) {
                  console.error('Failed to approve rebalance:', err);
                }
              }}
            />
          )}
        </>
      )}

      {showOnboarding && settings && (
        <OnboardingWizard
          initialSettings={settings}
          onComplete={(updated) => { setSettings(updated); setShowOnboarding(false); }}
          onClose={() => {
            if (typeof window !== 'undefined') localStorage.setItem('onboardingDismissed', 'true');
            setShowOnboarding(false);
          }}
        />
      )}
    </div>
  );
}
