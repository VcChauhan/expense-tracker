'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import {
  AreaChart, Area, Tooltip, ResponsiveContainer, XAxis
} from 'recharts';
import { Bell, Sparkles, ArrowRight, TrendingDown, TrendingUp, ChevronRight, Target } from 'lucide-react';
import { formatINR, MONTHS, SHORT_MONTHS, Settings, Expense } from '@/lib/types';

import { FocusWheel } from '@/components/FocusWheel';
import { CategoryIcon } from '@/components/CategoryIcon';
import { OnboardingWizard } from '@/components/OnboardingWizard';
import { RebalanceModal } from '@/components/RebalanceModal';

interface CategoryTotal { _id: string; total: number; count: number; }
interface MonthTotal    { _id: string; total: number; count: number; }

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

/* Animated count-up hook */
function useCountUp(target: number, duration = 1000) {
  const [value, setValue] = useState(0);
  const prev = useRef(0);
  useEffect(() => {
    const start = prev.current;
    const delta = target - start;
    if (delta === 0) return;
    const startTime = performance.now();
    let raf: number;
    const step = (now: number) => {
      const elapsed = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - elapsed, 3);
      setValue(Math.round(start + delta * eased));
      if (elapsed < 1) raf = requestAnimationFrame(step);
      else { setValue(target); prev.current = target; }
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}

/* Swipeable transaction row */
function SwipeRow({ expense, onDelete, delay = 0 }: {
  expense: any;
  onDelete: (id: string) => void;
  delay?: number;
}) {
  const touchStartX = useRef(0);
  const [swipeX, setSwipeX] = useState(0);
  const [revealed, setRevealed] = useState(false);

  const handleTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX; };
  const handleTouchMove  = (e: React.TouchEvent) => {
    const dx = e.touches[0].clientX - touchStartX.current;
    if (dx < 0) setSwipeX(Math.max(dx, -110));
  };
  const handleTouchEnd = () => {
    if (swipeX < -60) { setSwipeX(-104); setRevealed(true); }
    else { setSwipeX(0); setRevealed(false); }
  };

  const formatDate = (d: string) => {
    try {
      const dt = new Date(d);
      return `${dt.getDate()} ${MONTHS[dt.getMonth()].slice(0, 3)}`;
    } catch { return d; }
  };

  const rowClasses = ['txn-row-1','txn-row-2','txn-row-3','txn-row-4','txn-row-5'];

  return (
    <div className={`swipe-row-container ${rowClasses[delay] ?? 'txn-row-1'}`} style={{ marginBottom: 8 }}>
      {/* Behind: action buttons */}
      <div className="swipe-row-actions">
        <button className="swipe-action-btn" style={{ background: 'var(--danger-dim)', color: 'var(--danger)' }}
          onClick={() => onDelete(expense._id)}>🗑️</button>
        <Link href="/expenses" className="swipe-action-btn" style={{ background: 'var(--accent-dim)', color: 'var(--accent-2)', textDecoration: 'none', width: 44, height: 44, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>✏️</Link>
      </div>
      {/* Front: row content */}
      <div className="swipe-row-content"
        style={{ transform: `translateX(${swipeX}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={() => { if (revealed) { setSwipeX(0); setRevealed(false); } }}
      >
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '13px 14px',
          background: 'var(--bg-card)',
          borderRadius: 18,
          border: '1px solid var(--border)',
          borderLeftWidth: 4,
          borderLeftColor: expense.categoryColor ?? 'var(--accent)',
        }}>
          <div style={{
            width: 42, height: 42, borderRadius: 13, flexShrink: 0,
            background: `linear-gradient(135deg, ${expense.categoryColor ?? 'var(--accent)'}cc 0%, ${expense.categoryColor ?? 'var(--accent)'}88 100%)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 4px 12px ${expense.categoryColor ?? 'var(--accent)'}44`,
          }}>
            <CategoryIcon name={expense.categoryName ?? ''} size={18} color="#fff" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {expense.note || expense.categoryName}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500, marginTop: 1 }}>
              {expense.categoryName} · {formatDate(expense.date)}
            </div>
          </div>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.3px', flexShrink: 0 }}>
            {formatINR(expense.amount)}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedYear,  setSelectedYear]  = useState(now.getFullYear());
  const [settings, setSettings]           = useState<Settings | null>(null);
  const [categoryTotals, setCategoryTotals] = useState<CategoryTotal[]>([]);
  const [monthTotals, setMonthTotals]     = useState<MonthTotal[]>([]);
  const [recentExpenses, setRecentExpenses] = useState<any[]>([]);
  const [historicalAverage, setHistoricalAverage] = useState(0);
  const [showRebalanceModal, setShowRebalanceModal] = useState(false);
  const [pendingSuggestionsCount, setPendingSuggestionsCount] = useState(0);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [loading, setLoading] = useState(true);
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [settingsRes, monthlyRes, annualRes, suggestionsRes] = await Promise.all([
        fetch('/api/settings'),
        fetch(`/api/analytics/monthly?month=${selectedMonth + 1}&year=${selectedYear}`),
        fetch(`/api/analytics/annual?year=${selectedYear}`),
        fetch('/api/suggestions'),
      ]);
      const [s, m, a, sugs] = await Promise.all([
        settingsRes.json(), monthlyRes.json(), annualRes.json(), suggestionsRes.json(),
      ]);
      if (s && !s.error) {
        setSettings(s);
        if ((!s.annualSalary || s.annualSalary === 0) && typeof window !== 'undefined' && !localStorage.getItem('onboardingDismissed')) {
          setShowOnboarding(true);
        }
      }
      if (Array.isArray(sugs)) setPendingSuggestionsCount(sugs.length);
      setCategoryTotals(Array.isArray(m.categoryTotals) ? m.categoryTotals : []);
      setRecentExpenses(Array.isArray(m.recent) ? m.recent : []);
      setHistoricalAverage(m.historicalAverage || 0);
      setMonthTotals(Array.isArray(a.monthTotals) ? a.monthTotals : []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [selectedMonth, selectedYear]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const monthlySalary  = settings?.monthlySalary ?? 0;
  const monthlySpent   = categoryTotals.reduce((s, c) => s + c.total, 0);
  const monthlyBudget  = (settings?.categories ?? []).reduce((s, c) => s + c.monthlyBudget, 0);
  const budgetPct      = monthlyBudget > 0 ? (monthlySpent / monthlyBudget) * 100 : 0;
  const remainingDays  = Math.max(1, new Date(selectedYear, selectedMonth + 1, 0).getDate() - now.getDate() + 1);
  const safePerDay     = monthlyBudget > 0 ? ((monthlyBudget - monthlySpent) / remainingDays) : 0;
  const monthlySavings = monthlySalary - monthlySpent;

  const activeTotalsMap: Record<string, number> = {};
  categoryTotals.forEach(t => activeTotalsMap[t._id] = t.total);

  const animatedSpent = useCountUp(monthlySpent, 1000);

  const overBudgetCategories = useMemo(() => {
    if (!settings) return [];
    return categoryTotals.filter(ct => {
      const cat = settings.categories.find(c => c.id === ct._id);
      return cat && ct.total > cat.monthlyBudget && cat.monthlyBudget > 0;
    }).map(ct => {
      const cat = settings.categories.find(c => c.id === ct._id)!;
      return { ...cat, spent: ct.total };
    });
  }, [categoryTotals, settings]);

  const sparkData = useMemo(() =>
    SHORT_MONTHS.map((m, i) => {
      const mm = String(i + 1).padStart(2, '0');
      const t = monthTotals.find(x => x._id === mm);
      return { month: m, v: t?.total ?? 0 };
    }),
  [monthTotals]);

  const savingsTrend = historicalAverage > 0
    ? monthlySpent < historicalAverage ? 'up' : monthlySpent > historicalAverage ? 'down' : 'neutral'
    : 'neutral';

  function navigateMonth(dir: number) {
    let m = selectedMonth + dir, y = selectedYear;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    setSelectedMonth(m); setSelectedYear(y);
  }

  async function handleDeleteExpense(id: string) {
    try {
      await fetch(`/api/expenses/${id}`, { method: 'DELETE' });
      setRecentExpenses(prev => prev.filter(e => e._id !== id));
    } catch (e) { console.error(e); }
  }

  const compactHeaderVisible = scrollY > 180;

  return (
    <>
      {/* Parallax compact sticky header */}
      {compactHeaderVisible && (
        <div className="sticky-compact-header">
          <div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>
              {MONTHS[selectedMonth].slice(0, 3)} {selectedYear}
            </div>
            <div style={{ fontSize: 20, fontWeight: 900, color: '#fff', letterSpacing: '-0.5px' }}>
              {formatINR(monthlySpent)}
            </div>
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: budgetPct >= 100 ? '#F87171' : budgetPct >= 80 ? '#FBBF24' : '#4ADE80' }}>
            {budgetPct.toFixed(0)}% of budget
          </div>
        </div>
      )}

      <div style={{ padding: '20px 16px calc(var(--nav-height) + 40px) 16px', maxWidth: 540, margin: '0 auto' }}>

        {/* ── Dark Hero Card ── */}
        <div className="hero-card">
          {/* Avatar + greeting row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                background: 'linear-gradient(135deg, #7C5CFC 0%, #A462F5 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16, fontWeight: 800, color: '#fff',
                boxShadow: '0 4px 14px rgba(124,92,252,0.5)',
              }}>V</div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--hero-muted)', fontWeight: 500 }}>{getGreeting()} 👋</div>
                <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--hero-text)', letterSpacing: '-0.3px' }}>Vivek</div>
              </div>
            </div>
            <div style={{ position: 'relative' }}>
              <Link href="/expenses" style={{
                width: 38, height: 38, borderRadius: '50%',
                background: 'var(--hero-pill-bg)', border: '1px solid var(--hero-pill-border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
              }}>
                <Bell size={16} />
              </Link>
              {pendingSuggestionsCount > 0 && (
                <div style={{
                  position: 'absolute', top: 0, right: 0,
                  width: 14, height: 14, borderRadius: '50%',
                  background: '#F87171', border: '2px solid var(--hero-bg)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 8, fontWeight: 900, color: '#fff',
                  animation: 'pulse-glow 2s infinite',
                }}>{pendingSuggestionsCount > 9 ? '9+' : pendingSuggestionsCount}</div>
              )}
            </div>
          </div>

          {/* ₹ Amount + mini sparkline */}
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--hero-muted)', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 4 }}>
                spent this month
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--hero-muted)', lineHeight: 1.8 }}>₹</span>
                <span style={{ fontSize: 42, fontWeight: 900, color: '#fff', letterSpacing: '-1.5px', lineHeight: 1, animation: 'count-up 0.5s var(--ease) both' }}>
                  {animatedSpent.toLocaleString('en-IN')}
                </span>
              </div>
            </div>
            {sparkData.some(d => d.v > 0) && (
              <div style={{ width: 96, height: 44, opacity: 0.75, flexShrink: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={sparkData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="heroGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#7C5CFC" stopOpacity={0.6} />
                        <stop offset="95%" stopColor="#7C5CFC" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="month" hide />
                    <Tooltip content={() => null} />
                    <Area type="monotone" dataKey="v" stroke="#A594FF" strokeWidth={2} fill="url(#heroGrad)" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Budget progress */}
          {monthlyBudget > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: 'var(--hero-muted)', fontWeight: 600 }}>Budget used</span>
                <span style={{ fontSize: 11, fontWeight: 800, color: budgetPct >= 100 ? '#F87171' : budgetPct >= 80 ? '#FBBF24' : '#4ADE80' }}>
                  {budgetPct.toFixed(0)}%
                </span>
              </div>
              <div style={{ height: 5, background: 'rgba(255,255,255,0.12)', borderRadius: 99, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', width: `${Math.min(budgetPct, 100)}%`,
                  background: budgetPct >= 100 ? '#F87171' : budgetPct >= 80 ? '#FBBF24' : 'linear-gradient(90deg, #7C5CFC, #A594FF)',
                  borderRadius: 99, transition: 'width 1s var(--ease)',
                  animation: 'progress-grow 1s var(--ease) both',
                }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5 }}>
                <span style={{ fontSize: 11, color: 'var(--hero-muted)', fontWeight: 500 }}>
                  Remaining {formatINR(Math.max(0, monthlyBudget - monthlySpent))}
                </span>
                <span style={{ fontSize: 11, color: 'var(--hero-muted)', fontWeight: 500 }}>
                  Monthly {formatINR(monthlySalary)}
                </span>
              </div>
            </div>
          )}

          {/* 3-pill metrics */}
          <div style={{ display: 'flex', gap: 8 }}>
            {[
              { label: 'Incoming', value: formatINR(monthlySalary), color: '#4ADE80' },
              { label: 'Invested', value: '₹0', color: 'rgba(255,255,255,0.55)' },
              { label: 'Outgoing', value: formatINR(monthlySpent), color: '#F87171' },
            ].map((pill, i) => (
              <div key={i} style={{
                flex: 1, padding: '9px 8px',
                background: 'var(--hero-pill-bg)', border: '1px solid var(--hero-pill-border)',
                borderRadius: 14, textAlign: 'center',
              }}>
                <div style={{ fontSize: 9, color: 'var(--hero-muted)', fontWeight: 600, letterSpacing: '0.3px', marginBottom: 3, textTransform: 'uppercase' }}>{pill.label}</div>
                <div style={{ fontSize: 12, fontWeight: 800, color: pill.color, letterSpacing: '-0.2px' }}>{pill.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Period Navigator ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 2, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 99, padding: '3px 4px' }}>
            <button style={{ background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', padding: '5px 10px', borderRadius: 99, fontSize: 16 }} onClick={() => navigateMonth(-1)}>‹</button>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', padding: '0 4px', whiteSpace: 'nowrap' }}>
              {MONTHS[selectedMonth].slice(0, 3)} {selectedYear}
            </span>
            <button style={{ background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', padding: '5px 10px', borderRadius: 99, fontSize: 16 }} onClick={() => navigateMonth(1)}>›</button>
          </div>
          {historicalAverage > 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: savingsTrend === 'up' ? 'var(--success-dim)' : savingsTrend === 'down' ? 'var(--danger-dim)' : 'var(--bg-elevated)',
              border: `1px solid ${savingsTrend === 'up' ? 'rgba(74,222,128,0.25)' : savingsTrend === 'down' ? 'rgba(248,113,113,0.25)' : 'var(--border)'}`,
              borderRadius: 99, padding: '6px 12px',
            }}>
              {savingsTrend === 'up' ? <TrendingDown size={13} color="var(--success)" /> : savingsTrend === 'down' ? <TrendingUp size={13} color="var(--danger)" /> : null}
              <span style={{ fontSize: 12, fontWeight: 700, color: savingsTrend === 'up' ? 'var(--success)' : savingsTrend === 'down' ? 'var(--danger)' : 'var(--text-muted)' }}>
                {savingsTrend === 'up' ? 'Below avg' : savingsTrend === 'down' ? 'Above avg' : 'vs avg'}
              </span>
            </div>
          )}
        </div>

        {/* ── SMS Review Banner ── */}
        {pendingSuggestionsCount > 0 && (
          <Link href="/expenses" style={{
            textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: 'linear-gradient(135deg, rgba(124,92,252,0.18) 0%, rgba(167,139,250,0.12) 100%)',
            border: '1.5px solid rgba(124,92,252,0.35)',
            borderRadius: 18, padding: '12px 16px', marginBottom: 16,
            boxShadow: '0 4px 14px rgba(124,92,252,0.15)',
            animation: 'fade-in-up 0.3s var(--ease) both',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Sparkles size={16} />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)' }}>
                  {pendingSuggestionsCount} Transaction{pendingSuggestionsCount > 1 ? 's' : ''} Awaiting Review
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Auto-detected · Tap to review</div>
              </div>
            </div>
            <ArrowRight size={16} color="var(--accent-2)" />
          </Link>
        )}

        {/* ── Budget Alert ── */}
        {overBudgetCategories.length > 0 && (
          <div style={{
            background: 'linear-gradient(135deg, rgba(245,158,11,0.12), rgba(252,211,77,0.06))',
            border: '1.5px solid rgba(245,158,11,0.35)',
            borderRadius: 18, padding: '14px 16px', marginBottom: 16,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
            animation: 'fade-in-up 0.3s var(--ease) both',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(245,158,11,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ fontSize: 16 }}>⚠️</span>
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#B45309', marginBottom: 4 }}>Over budget</div>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  {overBudgetCategories.map(c => (
                    <span key={c.id} style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: `${c.color}22`, color: c.color, border: `1px solid ${c.color}44` }}>
                      {c.name}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <button onClick={() => setShowRebalanceModal(true)} style={{
              padding: '8px 14px', borderRadius: 99, background: '#F59E0B', color: '#fff',
              border: 'none', fontWeight: 700, fontSize: 12, cursor: 'pointer', flexShrink: 0,
              fontFamily: "'DM Sans', sans-serif", boxShadow: '0 4px 12px rgba(245,158,11,0.4)',
            }}>FIX →</button>
          </div>
        )}

        {/* ── FocusWheel — UNTOUCHED ── */}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 0', gap: 12 }}>
            <div className="spinner" style={{ width: 28, height: 28, borderColor: 'var(--border-strong)', borderTopColor: 'var(--accent)' }} />
            <span style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 500 }}>Loading...</span>
          </div>
        ) : (
          <>
            {monthlyBudget === 0 ? (
              <div style={{
                background: 'var(--bg-card)', border: '1px dashed var(--border-strong)',
                borderRadius: 24, padding: '36px 24px', marginBottom: 16,
                display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
              }}>
                <div style={{ width: 52, height: 52, borderRadius: 16, marginBottom: 14, background: 'var(--accent-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Target size={24} color="var(--accent-2)" />
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Set up your spending wheel</h3>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '6px 0 18px', maxWidth: 280, lineHeight: 1.5 }}>
                  Set your monthly income and at least one category budget to see spending here.
                </p>
                <Link href="/settings" style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--accent-grad)', color: '#fff', fontWeight: 700, fontSize: 13.5, padding: '10px 18px', borderRadius: 99, textDecoration: 'none' }}>
                  Set up budgets <ArrowRight size={14} />
                </Link>
              </div>
            ) : (
              <div style={{
                position: 'relative', background: 'var(--bg-card)', border: '1px solid var(--border-glow)',
                borderRadius: 24, padding: '52px 20px 28px', marginBottom: 16,
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                boxShadow: 'var(--shadow-glow)', overflow: 'hidden',
              }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 80, background: 'linear-gradient(180deg, var(--accent-dim) 0%, transparent 100%)', pointerEvents: 'none' }} />
                <div style={{ position: 'absolute', top: 20, left: 20, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', fontWeight: 700 }}>Income</span>
                  <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--success)', letterSpacing: '-0.4px' }}>{formatINR(monthlySalary)}</span>
                </div>
                <div style={{ position: 'absolute', top: 20, right: 20, display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', fontWeight: 700 }}>Safe/Day</span>
                  <span style={{ fontSize: 15, fontWeight: 800, color: safePerDay > 0 ? 'var(--success)' : 'var(--danger)', letterSpacing: '-0.4px' }}>₹{Math.max(0, safePerDay).toFixed(0)}</span>
                </div>
                <FocusWheel
                  data={(settings?.categories ?? []).map(cat => ({
                    label: cat.name, icon: cat.name, color: cat.color,
                    current: activeTotalsMap[cat.id] ?? 0,
                    limit: cat.monthlyBudget,
                  }))}
                  size={300} strokeWidth={52}
                >
                  <span style={{ fontSize: 32, fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-1px' }}>{formatINR(monthlySpent)}</span>
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2, fontWeight: 500 }}>of {formatINR(monthlyBudget)} budget</span>
                  <span style={{
                    fontSize: 14, fontWeight: 800, marginTop: 6,
                    color: budgetPct >= 100 ? 'var(--danger)' : budgetPct >= 80 ? 'var(--warning)' : 'var(--success)',
                    background: budgetPct >= 100 ? 'var(--danger-dim)' : budgetPct >= 80 ? 'var(--warning-dim)' : 'var(--success-dim)',
                    padding: '3px 10px', borderRadius: 99,
                  }}>{budgetPct.toFixed(0)}% used</span>
                </FocusWheel>
                <div style={{ display: 'flex', gap: 0, width: '100%', marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                  {[
                    { label: 'Saved', value: formatINR(monthlySavings), color: monthlySavings >= 0 ? 'var(--accent-2)' : 'var(--danger)' },
                    { label: 'Budget', value: formatINR(monthlyBudget), color: 'var(--text-primary)' },
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

            {/* ── Recent Transactions ── */}
            {recentExpenses.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <h2 style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.3px' }}>Recent</h2>
                  <Link href="/expenses" style={{ fontSize: 13, color: 'var(--accent-2)', textDecoration: 'none', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 3 }}>
                    View All <ChevronRight size={14} />
                  </Link>
                </div>
                {recentExpenses.slice(0, 5).map((exp, i) => (
                  <SwipeRow key={exp._id ?? i} expense={exp} delay={i} onDelete={handleDeleteExpense} />
                ))}
              </div>
            )}

            {/* ── Quick navigation cards ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
              {[
                { href: '/reports', icon: '📊', label: 'Analytics & Reports', sub: 'Charts, health score, monthly recap', color: 'var(--accent-dim)' },
                { href: '/insights', icon: '🧠', label: 'AI Insights & Goals', sub: 'Savings goals, affordability, AI coach', color: 'rgba(251,191,36,0.12)' },
              ].map(item => (
                <Link key={item.href} href={item.href} style={{
                  textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: 'var(--bg-card)', border: '1px solid var(--border)',
                  borderRadius: 20, padding: '14px 16px',
                  transition: 'all 0.15s ease',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 38, height: 38, borderRadius: 12, background: item.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                      {item.icon}
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{item.label}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{item.sub}</div>
                    </div>
                  </div>
                  <ChevronRight size={16} color="var(--text-muted)" />
                </Link>
              ))}
            </div>
          </>
        )}

        {showRebalanceModal && (
          <RebalanceModal
            categories={settings?.categories ?? []}
            activeTotalsMap={activeTotalsMap}
            onClose={() => setShowRebalanceModal(false)}
            onApprove={async (updatedCategories) => {
              try {
                const res = await fetch('/api/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ categories: updatedCategories }) });
                if (res.ok) { const s = await res.json(); setSettings(s); setShowRebalanceModal(false); }
              } catch (err) { console.error(err); }
            }}
          />
        )}
      </div>

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
    </>
  );
}
