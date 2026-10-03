'use client';

import { useState, useEffect, useMemo } from 'react';
import { Settings, Expense, MONTHS } from '@/lib/types';
import { BrainCircuit, ShieldCheck, Sparkles, RefreshCw } from 'lucide-react';
import { OnDeviceCopilot } from '@/components/OnDeviceCopilot';
import { CfoPulseMetrics } from '@/components/CfoPulseMetrics';
import { MomCategoryRadar } from '@/components/MomCategoryRadar';
import { CfoActionChips } from '@/components/CfoActionChips';
import { AiBudgetAnomalyCard } from '@/components/AiBudgetAnomalyCard';
import { runOnDeviceAnomalyAudit, BudgetNormalizationResult } from '@/lib/onDeviceAi';
import { checkOnDeviceAi, OnDeviceAiStatus } from '@/lib/onDeviceAiClient';

export default function InsightsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [fullInsightsData, setFullInsightsData] = useState<any>(null);
  const [anomalyResult, setAnomalyResult] = useState<BudgetNormalizationResult | null>(null);
  const [aiStatus, setAiStatus] = useState<OnDeviceAiStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  const fetchData = async () => {
    setLoading(true);
    try {
      const [sRes, expRes, fullRes, aiCheck] = await Promise.all([
        fetch('/api/settings').then(r => r.json()),
        fetch('/api/expenses?limit=600').then(r => r.json()),
        fetch(`/api/insights/full?month=${currentMonth}&year=${currentYear}`).then(r => r.json()),
        checkOnDeviceAi(),
      ]);

      if (sRes && !sRes.error) setSettings(sRes);
      if (Array.isArray(expRes)) setExpenses(expRes);
      if (fullRes?.rawData) setFullInsightsData(fullRes.rawData);
      setAiStatus(aiCheck);
    } catch (e) {
      console.error('Failed to load insights data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filter current month expenses
  const currentMonthExpenses = useMemo(() => {
    const ym = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
    return expenses.filter(e => e.date && e.date.startsWith(ym));
  }, [expenses, currentMonth, currentYear]);

  // Run anomaly audit client-side
  useEffect(() => {
    if (currentMonthExpenses.length > 0 && settings?.categories) {
      const monthKey = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
      const note = settings.monthNotes?.find(mn => mn.month === monthKey)?.note || '';
      runOnDeviceAnomalyAudit(
        currentMonthExpenses,
        settings.categories,
        note,
        MONTHS[now.getMonth()]
      ).then(setAnomalyResult);
    }
  }, [currentMonthExpenses, settings, currentMonth, currentYear]);

  // Metrics derived from live data & full insights endpoint
  const rawCur = fullInsightsData?.currentMonth;
  const totalSpent = rawCur?.totalSpent ?? currentMonthExpenses.reduce((s, e) => s + (e.amount || 0), 0);
  const prevMonthSpent = rawCur?.prevMonthTotalSpent ?? 0;
  const daysElapsed = rawCur?.daysElapsed ?? now.getDate();
  const totalDays = rawCur?.totalDays ?? new Date(currentYear, currentMonth, 0).getDate();

  // Trailing 3-month average calculation
  const trailing3MonthAvg = useMemo(() => {
    if (!rawCur?.categories) return 0;
    return rawCur.categories.reduce((s: number, c: any) => s + (c.historical3MonthAverage || 0), 0);
  }, [rawCur]);

  // Normalized spend (after removing one-off anomalies)
  const normalizedSpent = anomalyResult?.normalizedSpent ?? totalSpent;
  const totalAnomalySpent = anomalyResult?.totalAnomalySpent ?? 0;

  // Categories comparison (This Month vs Previous Month)
  const categoryComparisons = useMemo(() => {
    if (rawCur?.categories && Array.isArray(rawCur.categories)) {
      return rawCur.categories;
    }
    return (settings?.categories || []).map(cat => ({
      name: cat.name,
      actualSpent: currentMonthExpenses.filter(e => e.categoryId === cat.id).reduce((s, e) => s + e.amount, 0),
      spentLastMonth: 0,
      historical3MonthAverage: 0,
      budgetLimit: cat.monthlyBudget || 0,
    }));
  }, [rawCur, settings, currentMonthExpenses]);

  // Generate compact, punchy tactical action chips
  const actionItems = useMemo(() => {
    const items: any[] = [];
    const diff = totalSpent - prevMonthSpent;

    if (prevMonthSpent > 0) {
      if (diff <= 0) {
        items.push({
          id: 'mom-win',
          badge: 'MoM Trajectory',
          title: 'Lower Spend vs Last Month',
          detail: `You've spent ₹${Math.abs(diff).toLocaleString('en-IN')} less than last month at this stage. Excellent burn discipline!`,
          type: 'success',
        });
      } else {
        items.push({
          id: 'mom-alert',
          badge: 'MoM Watch',
          title: 'Higher Spend vs Last Month',
          detail: `Spending is currently ₹${diff.toLocaleString('en-IN')} higher than last month. Check category shifts below.`,
          type: 'warning',
        });
      }
    }

    // Top Category Shift
    const highestIncreased = [...categoryComparisons]
      .filter(c => c.spentLastMonth > 0 && c.actualSpent > c.spentLastMonth)
      .sort((a, b) => (b.actualSpent - b.spentLastMonth) - (a.actualSpent - a.spentLastMonth))[0];

    if (highestIncreased) {
      const catDiff = highestIncreased.actualSpent - highestIncreased.spentLastMonth;
      items.push({
        id: 'cat-surge',
        badge: 'Category Surge',
        title: `${highestIncreased.name} +₹${catDiff.toLocaleString('en-IN')}`,
        detail: `Pacing higher than last month (${highestIncreased.spentLastMonth.toLocaleString('en-IN')}). Consider a cap for the remaining days.`,
        type: 'warning',
      });
    }

    // One-Off Anomaly Reassurance
    if (totalAnomalySpent > 0) {
      items.push({
        id: 'anomaly-safe',
        badge: 'One-Off Normalization',
        title: `₹${totalAnomalySpent.toLocaleString('en-IN')} in Outliers`,
        detail: `Excluding one-off anomalies, your recurring lifestyle burn is ₹${normalizedSpent.toLocaleString('en-IN')}. No structural budget alarm.`,
        type: 'tip',
      });
    }

    // Savings Velocity
    const salary = settings?.monthlySalary || 0;
    if (salary > 0) {
      const retained = salary - totalSpent;
      const savingsPct = Math.round((retained / salary) * 100);
      if (savingsPct >= 20) {
        items.push({
          id: 'savings-goal',
          badge: 'Wealth Velocity',
          title: `${savingsPct}% Savings Retained`,
          detail: `Holding ${savingsPct}% of monthly income. Surplus can be channeled into your top savings goal.`,
          type: 'success',
        });
      }
    }

    return items;
  }, [totalSpent, prevMonthSpent, categoryComparisons, totalAnomalySpent, normalizedSpent, settings]);

  if (loading) {
    return (
      <div className="page-container">
        <div className="loading-overlay">
          <div className="spinner" />
        </div>
      </div>
    );
  }

  return (
    <div className="page-container" style={{ paddingBottom: 60 }}>
      {/* Header */}
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 22, margin: 0 }}>
            <div style={{ background: 'var(--accent-grad)', padding: 7, borderRadius: 10, color: '#fff', display: 'flex' }}>
              <BrainCircuit size={20} />
            </div>
            AI CFO Command Center
          </h1>
          <button
            onClick={fetchData}
            title="Refresh on-device insights"
            style={{
              background: 'var(--bg-elevated)', border: '1px solid var(--border)',
              color: 'var(--text-secondary)', padding: '6px 10px', borderRadius: 10,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700,
            }}
          >
            <RefreshCw size={13} /> Refresh
          </button>
        </div>
        <p className="page-subtitle" style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
          <ShieldCheck size={14} color="#10b981" />
          <span>Comparing performance with previous months • 100% On-Device GPU</span>
        </p>
      </div>

      {/* ── 1. Interactive On-Device Copilot ── */}
      <OnDeviceCopilot
        salary={settings?.monthlySalary || 0}
        totalSpent={totalSpent}
        budget={settings?.categories?.reduce((s, c) => s + (c.monthlyBudget || 0), 0) || 0}
        categories={settings?.categories || []}
        expenses={currentMonthExpenses}
      />

      {/* ── 2. Small Meaningful Month-Over-Month Pulse Cards ── */}
      <CfoPulseMetrics
        currentSpent={totalSpent}
        prevMonthSpent={prevMonthSpent}
        trailing3MonthAvg={trailing3MonthAvg}
        salary={settings?.monthlySalary || 0}
        normalizedSpent={normalizedSpent}
        totalAnomalySpent={totalAnomalySpent}
        daysElapsed={daysElapsed}
        totalDays={totalDays}
      />

      {/* ── 3. Tactical Action Plan (Compact 2-Line Chips) ── */}
      <CfoActionChips
        items={actionItems}
        isLlmActive={Boolean(aiStatus?.available)}
      />

      {/* ── 4. Month-Over-Month Category Radar (Comparing with Previous Month) ── */}
      <MomCategoryRadar
        categories={categoryComparisons}
        allSettingsCategories={settings?.categories || []}
      />

      {/* ── 5. On-Device Budget Anomaly & Normalization Audit ── */}
      <AiBudgetAnomalyCard
        expenses={currentMonthExpenses}
        categories={settings?.categories || []}
        selectedMonth={now.getMonth()}
        selectedYear={currentYear}
        monthName={MONTHS[now.getMonth()]}
        settings={settings}
        onSettingsUpdate={s => setSettings(s)}
      />
    </div>
  );
}
