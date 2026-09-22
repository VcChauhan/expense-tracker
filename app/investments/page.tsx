'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  TrendingUp, Camera, Trash2, ArrowLeft, Check,
  RefreshCw, AlertCircle, ArrowUpRight, ArrowDownRight,
  X, Cpu, Layers, Tag, Globe, Sparkles, Pencil,
  Repeat, Plus, Calendar, CheckCircle2, Eye, EyeOff,
  SlidersHorizontal, BarChart2, PieChart as PieIcon,
  ShieldCheck, Brain, Target, Info, Flame, ChevronRight,
  Coins, LineChart as LineIcon, ArrowDown, ArrowUp,
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, AreaChart, Area,
} from 'recharts';

import { formatINR, InvestmentFund, Expense, Settings, SHORT_MONTHS, PortfolioType, RecurringExpense } from '@/lib/types';
import { parseGrowwOcrText } from '@/lib/parseGrowwOcr';
import { lightTap, successBuzz, mediumTap } from '@/lib/haptics';

type ReviewData = {
  holdingName: string;
  date: string;
  totalInvested: number;
  currentValue: number;
  portfolioType: PortfolioType;
  oneDayGain: number;
  oneDayGainPercent: number;
  units?: number;
  buyPrice?: number;
  funds: InvestmentFund[];
};

type EditHoldingData = {
  id: string;
  originalName: string;
  holdingName: string;
  fundName?: string;
  totalInvested: number;
  currentValue: number;
  portfolioType: PortfolioType;
  units?: number;
  buyPrice?: number;
  purchaseTime?: string;
  tag?: string;
};

type OcrStatus = 'idle' | 'preprocessing' | 'loading-worker' | 'ocr' | 'parsing' | 'done' | 'error';

// ── Portfolio types config ───────────────────────────────────────────────
const PORTFOLIO_TYPES: { value: PortfolioType; label: string; icon: string; color: string; netWorthCategory: string }[] = [
  { value: 'mutual_funds', label: 'Mutual Funds', icon: '📊', color: '#8B5CF6', netWorthCategory: 'Mutual Funds' },
  { value: 'stocks',       label: 'Stocks',        icon: '📈', color: '#10B981', netWorthCategory: 'Stocks & Equity' },
  { value: 'gold',         label: 'Gold',          icon: '🪙', color: '#F59E0B', netWorthCategory: 'Gold & Precious Metals' },
  { value: 'combined',     label: 'Combined',      icon: '🗂️', color: '#3B82F6', netWorthCategory: 'Investments' },
];

function getTypeCfg(type: PortfolioType) {
  return PORTFOLIO_TYPES.find((t) => t.value === type) || PORTFOLIO_TYPES[0];
}

// ── Client-side image preprocessor for crisp OCR ─────────────────────────
async function preprocessImageForOcr(file: File): Promise<Blob> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const scale = Math.max(1, 1400 / img.width);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(file);

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const d = imgData.data;

        // Red channel thresholding
        for (let i = 0; i < d.length; i += 4) {
          const r = d[i];
          const v = r < 215 ? 0 : 255;
          d[i] = v;
          d[i + 1] = v;
          d[i + 2] = v;
        }
        ctx.putImageData(imgData, 0, 0);

        canvas.toBlob((blob) => {
          resolve(blob || file);
        }, 'image/png');
      } catch {
        resolve(file);
      }
    };
    img.onerror = () => resolve(file);
    img.src = URL.createObjectURL(file);
  });
}

export default function InvestmentsPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [snapshots, setSnapshots] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);

  // Live market sync state
  const [isSyncingLive, setIsSyncingLive] = useState(false);
  const [syncToast, setSyncToast] = useState<string | null>(null);

  // Deletion modal state
  const [holdingToDelete, setHoldingToDelete] = useState<{ id: string; name: string; fundName?: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Edit modal state
  const [editingHolding, setEditingHolding] = useState<EditHoldingData | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Monthly SIP management state
  const [showAddSipModal, setShowAddSipModal] = useState(false);
  const [selectedSipHoldingKey, setSelectedSipHoldingKey] = useState<string>('');
  const [newSipName, setNewSipName] = useState('');
  const [newSipAmount, setNewSipAmount] = useState('');
  const [newSipDay, setNewSipDay] = useState('3');
  const [isSavingSip, setIsSavingSip] = useState(false);
  const [loggingSipId, setLoggingSipId] = useState<string | null>(null);

  // Manual Investment state
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualType, setManualType] = useState<PortfolioType>('gold');
  const [manualName, setManualName] = useState('24K Digital Gold');
  const [manualUnits, setManualUnits] = useState('');
  const [manualBuyPrice, setManualBuyPrice] = useState('');
  const [manualInvested, setManualInvested] = useState('');
  const [manualCurrent, setManualCurrent] = useState('');
  const [manualDate, setManualDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [manualTime, setManualTime] = useState(() => new Date().toTimeString().slice(0, 5));
  const [manualSyncNetWorth, setManualSyncNetWorth] = useState(true);
  const [isSavingManual, setIsSavingManual] = useState(false);
  const [liveGoldRate, setLiveGoldRate] = useState<{ ratePerGram: number; mmtcPampRatePerGram?: number; goldBeesPrice: number; prevClose: number } | null>(null);
  const [isManualMmtc, setIsManualMmtc] = useState(false);
  const [isLoadingLiveGold, setIsLoadingLiveGold] = useState(false);

  // ── UI Masking / Privacy state (like Groww) ──
  const [isMasked, setIsMasked] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('expenseiq_invest_masked');
      if (stored === 'true') setIsMasked(true);
    } catch (_) {}
  }, []);

  const toggleMask = () => {
    setIsMasked((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('expenseiq_invest_masked', String(next));
      } catch (_) {}
      lightTap();
      return next;
    });
  };

  // ── Segmented Navigation, Filter & Projection state ──
  const [activeView, setActiveView] = useState<'holdings' | 'analytics' | 'sip'>('holdings');
  const [activeFilter, setActiveFilter] = useState<'all' | 'mutual_funds' | 'stocks' | 'gold'>('all');
  const [sortBy, setSortBy] = useState<'invested' | 'returns' | 'name' | 'gainPct'>('invested');
  const [projectionHorizon, setProjectionHorizon] = useState<'1Y' | '3Y' | '5Y' | '10Y'>('5Y');
  const [projectionCagr, setProjectionCagr] = useState<number>(13); // 13% CAGR moderate default
  const [activeAnalyticsSection, setActiveAnalyticsSection] = useState<'projection' | 'allocation' | 'returns'>('projection');

  const fetchLiveGold = async () => {
    setIsLoadingLiveGold(true);
    try {
      const res = await fetch('/api/investments/sync-live');
      const data = await res.json();
      if (data.success && data.gold) {
        setLiveGoldRate(data.gold);
      }
    } catch (e) {
      console.error('Failed to fetch live gold rate:', e);
    } finally {
      setIsLoadingLiveGold(false);
    }
  };

  // OCR state
  const [ocrStatus, setOcrStatus] = useState<OcrStatus>('idle');
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewData, setReviewData] = useState<ReviewData>({
    holdingName: '',
    date: new Date().toISOString().split('T')[0],
    totalInvested: 0,
    currentValue: 0,
    portfolioType: 'mutual_funds',
    oneDayGain: 0,
    oneDayGainPercent: 0,
    funds: [],
  });
  const [syncNetWorth, setSyncNetWorth] = useState(true);
  const [savingSnapshot, setSavingSnapshot] = useState(false);

  const isOcrRunning = ['preprocessing', 'loading-worker', 'ocr', 'parsing'].includes(ocrStatus);

  // ── Load data ─────────────────────────────────────────────────────────
  const loadData = async () => {
    setLoading(true);
    try {
      const [snapRes, expRes, setRes] = await Promise.all([
        fetch('/api/investments/snapshots'),
        fetch('/api/expenses?limit=500'),
        fetch('/api/settings'),
      ]);
      const [snaps, exps, sets] = await Promise.all([snapRes.json(), expRes.json(), setRes.json()]);
      if (Array.isArray(snaps)) setSnapshots(snaps);
      if (Array.isArray(exps)) setExpenses(exps);
      if (sets && !sets.error) setSettings(sets);
      fetchLiveGold();
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  // ── Derived stats ─────────────────────────────────────────────────────
  const investmentCatId = useMemo(() =>
    settings?.categories?.find((c) =>
      c.name.toLowerCase().includes('invest') || c.name.toLowerCase().includes('sip')
    )?.id ?? null, [settings]);

  const investmentCategory = useMemo(() =>
    settings?.categories?.find((c) =>
      c.id === investmentCatId ||
      c.name.toLowerCase().includes('invest') ||
      c.name.toLowerCase().includes('sip')
    ) ?? null, [settings, investmentCatId]);

  const currentYM = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  const investmentSips = useMemo(() => {
    return (settings?.recurringExpenses || []).filter((r) =>
      (investmentCatId && r.categoryId === investmentCatId) ||
      r.name.toLowerCase().includes('sip') ||
      r.name.toLowerCase().includes('groww') ||
      r.name.toLowerCase().includes('mutual') ||
      r.name.toLowerCase().includes('fund') ||
      r.name.toLowerCase().includes('elss')
    );
  }, [settings, investmentCatId]);

  const investmentExpenses = useMemo(() => {
    if (!investmentCatId) return [];
    return expenses.filter((e) => e.categoryId === investmentCatId);
  }, [expenses, investmentCatId]);

  const accumulatedFromExpenses = useMemo(() => {
    return investmentExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  }, [investmentExpenses]);

  // Monthly SIP aggregated amounts for chart
  const monthlySipData = useMemo(() => {
    const map: Record<string, number> = {};
    investmentExpenses.forEach((e) => {
      const ym = e.date?.slice(0, 7);
      if (ym) map[ym] = (map[ym] || 0) + (e.amount || 0);
    });
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0])).slice(-6).map(([key, total]) => {
      const [y, m] = key.split('-');
      return { label: `${SHORT_MONTHS[parseInt(m, 10) - 1]} ${y.slice(2)}`, amount: total };
    });
  }, [investmentExpenses]);

  // Group snapshots: distinct latest holdings
  const distinctHoldings = useMemo(() => {
    const map = new Map<string, any>();
    snapshots.forEach((s) => {
      if (Array.isArray(s.funds) && s.funds.length > 0) {
        s.funds.forEach((f: any) => {
          const key = f.name?.trim();
          if (key && !map.has(key)) {
            map.set(key, {
              _id: s._id,
              fundName: f.name,
              holdingName: f.name,
              portfolioType: s.portfolioType,
              totalInvested: f.invested || 0,
              currentValue: f.current || 0,
              totalGain: f.gain || (f.current - f.invested),
              gainPercent: f.gainPercent || 0,
              units: f.units !== undefined ? f.units : s.units,
              buyPrice: f.buyPrice !== undefined ? f.buyPrice : s.buyPrice,
              purchaseTime: f.purchaseTime || s.purchaseTime,
              date: s.date,
            });
          }
        });
      } else if (s.holdingName?.trim()) {
        // For gold assets (or manual entries), each purchase lot/bar has its own ID and can share the same scheme name
        const isGold = s.portfolioType === 'gold';
        const key = isGold ? `gold_${s._id || s.holdingName + '_' + (s.purchaseTime || s.date || '') + '_' + s.totalInvested}` : s.holdingName.trim();
        if (!map.has(key)) {
          map.set(key, {
            ...s,
            fundName: '',
            units: s.units,
            buyPrice: s.buyPrice,
            purchaseTime: s.purchaseTime,
          });
        }
      } else if (s._id) {
        const key = `snapshot_${s._id}`;
        if (!map.has(key)) {
          map.set(key, {
            ...s,
            holdingName: s.portfolioType === 'stocks'
              ? 'Stock Portfolio'
              : s.portfolioType === 'gold'
              ? 'Gold Investment'
              : 'Mutual Fund Portfolio',
            units: s.units,
            buyPrice: s.buyPrice,
            purchaseTime: s.purchaseTime,
          });
        }
      }
    });
    return Array.from(map.values());
  }, [snapshots]);

  // Total Portfolio Metrics
  const totalCurrentValue = useMemo(() => {
    const latestOverall = snapshots.find((s) => !s.holdingName && s.currentValue > 0);
    if (latestOverall) return latestOverall.currentValue;
    if (distinctHoldings.length > 0) {
      return distinctHoldings.reduce((sum, h) => sum + (h.currentValue || 0), 0);
    }
    return accumulatedFromExpenses;
  }, [snapshots, distinctHoldings, accumulatedFromExpenses]);

  const totalInvested = useMemo(() => {
    const latestOverall = snapshots.find((s) => !s.holdingName && s.totalInvested > 0);
    if (latestOverall) return latestOverall.totalInvested;
    if (distinctHoldings.length > 0) {
      return distinctHoldings.reduce((sum, h) => sum + (h.totalInvested || 0), 0);
    }
    return accumulatedFromExpenses;
  }, [snapshots, distinctHoldings, accumulatedFromExpenses]);

  const totalGain = totalCurrentValue - totalInvested;
  const totalGainPct = totalInvested > 0 ? Number(((totalGain / totalInvested) * 100).toFixed(2)) : 0;
  const isPositive = totalGain >= 0;

  // 1D returns from latest snapshot or sum of holdings
  const latest1D = useMemo(() => {
    const latest = snapshots[0];
    if (latest && (latest.oneDayGain || latest.oneDayGainPercent)) {
      return { gain: latest.oneDayGain || 0, percent: latest.oneDayGainPercent || 0 };
    }
    const sumDay = distinctHoldings.reduce((s, h) => s + (h.oneDayGain || 0), 0);
    if (sumDay !== 0) {
      const pct = totalCurrentValue > 0 ? Number(((sumDay / totalCurrentValue) * 100).toFixed(2)) : 0;
      return { gain: sumDay, percent: pct };
    }
    return { gain: 0, percent: 0 };
  }, [snapshots, distinctHoldings, totalCurrentValue]);

  // Split by category
  const mfHoldings = distinctHoldings.filter((h) => h.portfolioType === 'mutual_funds');
  const stockHoldings = distinctHoldings.filter((h) => h.portfolioType === 'stocks');
  const goldHoldings = distinctHoldings.filter((h) => h.portfolioType === 'gold');

  // Filtered + sorted holdings for display
  const displayHoldings = useMemo(() => {
    let list = [...distinctHoldings];
    if (activeFilter !== 'all') {
      list = list.filter((h) => h.portfolioType === activeFilter);
    }
    list.sort((a, b) => {
      if (sortBy === 'invested') return (b.totalInvested || 0) - (a.totalInvested || 0);
      if (sortBy === 'returns') return (b.totalGain || 0) - (a.totalGain || 0);
      if (sortBy === 'gainPct') return (b.gainPercent || 0) - (a.gainPercent || 0);
      if (sortBy === 'name') return (a.holdingName || '').localeCompare(b.holdingName || '');
      return 0;
    });
    return list;
  }, [distinctHoldings, activeFilter, sortBy]);

  // Pie chart — portfolio allocation by category
  const allocationChartData = useMemo(() => {
    const mfVal = mfHoldings.reduce((s, h) => s + (h.currentValue || 0), 0);
    const stockVal = stockHoldings.reduce((s, h) => s + (h.currentValue || 0), 0);
    const goldVal = goldHoldings.reduce((s, h) => s + (h.currentValue || 0), 0);
    const result: { name: string; value: number; color: string }[] = [];
    if (mfVal > 0) result.push({ name: 'Mutual Funds', value: mfVal, color: '#8B5CF6' });
    if (stockVal > 0) result.push({ name: 'Stocks', value: stockVal, color: '#10B981' });
    if (goldVal > 0) result.push({ name: 'Gold', value: goldVal, color: '#F59E0B' });
    return result;
  }, [mfHoldings, stockHoldings, goldHoldings]);

  // Returns % bar chart — top 8 holdings
  const returnsChartData = useMemo(() => {
    return distinctHoldings
      .filter((h) => h.totalInvested > 0)
      .map((h) => ({
        name: (h.holdingName || 'Fund').split(' ').slice(0, 2).join(' '),
        fullName: h.holdingName || 'Fund',
        gainPct: Number((h.gainPercent || 0).toFixed(2)),
        color: (h.gainPercent || 0) >= 0 ? '#10B981' : '#EF4444',
      }))
      .sort((a, b) => b.gainPct - a.gainPct)
      .slice(0, 8);
  }, [distinctHoldings]);

  // Monthly active SIP sum
  const monthlySipTotal = useMemo(() => {
    return investmentSips.filter((s) => s.isActive).reduce((sum, s) => sum + (s.amount || 0), 0);
  }, [investmentSips]);

  // 100% On-Device AI Compounding Projections (FV of lump sum + FV of monthly SIP annuity)
  const projectionCurves = useMemo(() => {
    const P = totalCurrentValue || 0;
    const PMT = monthlySipTotal || 0;
    const r = projectionCagr / 100;
    const monthlyRate = r / 12;

    const maxYears = projectionHorizon === '1Y' ? 1 : projectionHorizon === '3Y' ? 3 : projectionHorizon === '5Y' ? 5 : 10;
    const steps = maxYears === 1 ? 12 : maxYears * 4;
    const points: { label: string; year: number; projected: number; invested: number; gains: number }[] = [];

    for (let i = 0; i <= steps; i++) {
      const tMonths = maxYears === 1 ? i : (i * (maxYears * 12)) / steps;
      const tYears = tMonths / 12;
      const fvLump = P * Math.pow(1 + r, tYears);
      const fvSip = monthlyRate > 0 && tMonths > 0
        ? PMT * ((Math.pow(1 + monthlyRate, tMonths) - 1) / monthlyRate) * (1 + monthlyRate)
        : PMT * tMonths;

      const totalProjected = Math.round(fvLump + fvSip);
      const totalInvestedPrincipal = Math.round(totalInvested + (PMT * tMonths));
      const gains = Math.max(0, totalProjected - totalInvestedPrincipal);

      const label = maxYears === 1
        ? `M${Math.round(tMonths)}`
        : `Y${tYears.toFixed(tYears % 1 === 0 ? 0 : 1)}`;

      points.push({
        label,
        year: tYears,
        projected: totalProjected,
        invested: totalInvestedPrincipal,
        gains,
      });
    }

    const endPoint = points[points.length - 1];
    const multiplier = endPoint && endPoint.invested > 0 ? (endPoint.projected / endPoint.invested).toFixed(1) : '1.0';

    return {
      points,
      endProjected: endPoint?.projected || P,
      endInvested: endPoint?.invested || totalInvested,
      endGains: endPoint?.gains || 0,
      multiplier,
    };
  }, [totalCurrentValue, totalInvested, monthlySipTotal, projectionCagr, projectionHorizon]);

  // 100% On-Device Portfolio Health Score & Diversification Engine
  const portfolioHealth = useMemo(() => {
    const total = totalCurrentValue || 1;
    const mfVal = mfHoldings.reduce((s, h) => s + (h.currentValue || 0), 0);
    const stockVal = stockHoldings.reduce((s, h) => s + (h.currentValue || 0), 0);
    const goldVal = goldHoldings.reduce((s, h) => s + (h.currentValue || 0), 0);

    const equityVal = mfVal + stockVal;
    const equityPct = Math.round((equityVal / total) * 100);
    const goldPct = Math.round((goldVal / total) * 100);
    const otherPct = Math.max(0, 100 - equityPct - goldPct);

    let score = 70;
    const insights: { title: string; desc: string; type: 'success' | 'info' | 'warning' }[] = [];

    if (goldPct >= 8 && goldPct <= 25) {
      score += 15;
      insights.push({
        title: 'Balanced Inflation Hedge',
        desc: `Gold makes up ${goldPct}% of your portfolio, acting as a strong risk cushion against equity swings.`,
        type: 'success',
      });
    } else if (goldPct > 25) {
      score += 6;
      insights.push({
        title: 'High Defensive Weight',
        desc: `Gold is ${goldPct}%. Consider routing upcoming SIPs into broad-market index/flexicap funds.`,
        type: 'info',
      });
    } else {
      score += 5;
      insights.push({
        title: 'Light Gold Exposure',
        desc: `Gold is ${goldPct}%. Retaining 10-15% in Digital Gold/Gold ETFs offers optimal stability.`,
        type: 'info',
      });
    }

    if (equityPct >= 60 && equityPct <= 85) {
      score += 15;
      insights.push({
        title: 'Prime Growth Allocation',
        desc: `Equity allocation (${equityPct}%) provides compound growth targeting 12-15% long-term CAGR.`,
        type: 'success',
      });
    }

    const hasElss = distinctHoldings.some(
      (h) => (h.holdingName || '').toLowerCase().includes('elss') || (h.holdingName || '').toLowerCase().includes('tax')
    );
    if (hasElss) {
      insights.push({
        title: 'Tax-Advantaged Compounding',
        desc: 'ELSS tax-saver schemes detected, optimizing 80C exemptions while compounding in diversified equities.',
        type: 'success',
      });
    }

    if (monthlySipTotal > 0) {
      insights.push({
        title: 'Active SIP Momentum',
        desc: `Deploying ₹${monthlySipTotal.toLocaleString('en-IN')}/month will dollar-cost-average across market corrections.`,
        type: 'success',
      });
    }

    return {
      score: Math.min(98, score),
      equityPct,
      goldPct,
      otherPct,
      equityVal,
      goldVal,
      insights,
    };
  }, [totalCurrentValue, mfHoldings, stockHoldings, goldHoldings, distinctHoldings, monthlySipTotal]);


  // ── Live Internet Sync ────────────────────────────────────────────────
  const handleSyncLive = async () => {
    setIsSyncingLive(true);
    lightTap();
    try {
      const res = await fetch('/api/investments/sync-live', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        successBuzz();
        setSyncToast(data.message || 'Live prices updated!');
        setTimeout(() => setSyncToast(null), 4500);
        await loadData();
      } else {
        alert(data.error || 'Failed to sync live prices');
      }
    } catch (e) {
      console.error(e);
      alert('Error syncing live prices');
    } finally {
      setIsSyncingLive(false);
    }
  };

  // ── Deletion logic ────────────────────────────────────────────────────
  const confirmDelete = async () => {
    if (!holdingToDelete) return;
    setIsDeleting(true);
    lightTap();
    try {
      const q = `holdingName=${encodeURIComponent(holdingToDelete.name)}&id=${encodeURIComponent(holdingToDelete.id)}` +
        (holdingToDelete.fundName ? `&fundName=${encodeURIComponent(holdingToDelete.fundName)}` : '');
      const res = await fetch(`/api/investments/snapshots?${q}`, { method: 'DELETE' });
      if (res.ok) {
        successBuzz();
        setHoldingToDelete(null);
        await loadData();
      } else {
        alert('Failed to delete item');
      }
    } catch (err) {
      console.error(err);
      alert('Error deleting item');
    } finally {
      setIsDeleting(false);
    }
  };

  // ── Edit logic ────────────────────────────────────────────────────────
  const handleSaveEdit = async () => {
    if (!editingHolding) return;
    setIsSavingEdit(true);
    lightTap();
    try {
      const res = await fetch('/api/investments/snapshots', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingHolding.id,
          originalName: editingHolding.originalName,
          holdingName: editingHolding.holdingName,
          fundName: editingHolding.fundName,
          totalInvested: editingHolding.totalInvested,
          currentValue: editingHolding.currentValue,
          portfolioType: editingHolding.portfolioType,
          units: editingHolding.units,
          buyPrice: editingHolding.buyPrice,
          purchaseTime: editingHolding.purchaseTime,
          tag: editingHolding.tag || (/mmt[cp]\s*pamp/i.test(editingHolding.holdingName) ? 'mmtc_pamp' : ''),
        }),
      });

      if (res.ok) {
        successBuzz();
        setEditingHolding(null);
        setSyncToast('Holding updated successfully!');
        setTimeout(() => setSyncToast(null), 3500);
        await loadData();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to update holding');
      }
    } catch (e) {
      console.error(e);
      alert('Error updating holding');
    } finally {
      setIsSavingEdit(false);
    }
  };

  // ── Manual Investment Save ──────────────────────────────────────────
  const handleSaveManual = async () => {
    if (!manualName.trim()) {
      alert('Please enter a holding name');
      return;
    }
    const inv = Number(manualInvested) || 0;
    const cur = Number(manualCurrent) || inv;
    const gain = cur - inv;
    const pct = inv > 0 ? Number(((gain / inv) * 100).toFixed(2)) : 0;

    setIsSavingManual(true);
    lightTap();
    try {
      const res = await fetch('/api/investments/snapshots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          holdingName: manualName.trim(),
          portfolioType: manualType,
          totalInvested: inv,
          currentValue: cur,
          totalGain: gain,
          gainPercent: pct,
          units: Number(manualUnits) || 0,
          buyPrice: Number(manualBuyPrice) || 0,
          purchaseTime: `${manualDate} ${manualTime}`.trim(),
          date: manualDate,
          source: 'manual',
          syncNetWorth: manualSyncNetWorth,
        }),
      });

      if (res.ok) {
        successBuzz();
        setShowManualModal(false);
        setSyncToast(`${manualName} added successfully!`);
        setTimeout(() => setSyncToast(null), 3500);
        await loadData();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to add investment');
      }
    } catch (e) {
      console.error(e);
      alert('Error adding investment');
    } finally {
      setIsSavingManual(false);
    }
  };

  // ── Monthly SIP Handlers ─────────────────────────────────────────────
  const handleLogSip = async (item: RecurringExpense) => {
    if (!item) return;
    const catId = investmentCatId || item.categoryId || settings?.categories?.[0]?.id;
    if (!catId) return;

    setLoggingSipId(item.id);
    lightTap();
    try {
      const today = new Date().toISOString().split('T')[0];
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: today,
          categoryId: catId,
          amount: item.amount,
          note: `${item.name} (Monthly SIP)`,
          tags: ['investment', 'sip', 'recurring'],
          paymentMethod: 'upi',
        }),
      });

      if (res.ok) {
        // Auto-increment matched holding's invested amount if linked to a tracked fund
        const cleanSipName = (item.name || '').toLowerCase().replace(/\s*sip\s*/i, '').trim();
        const matchedHolding = distinctHoldings.find((h) => {
          const hName = (h.holdingName || h.fundName || '').toLowerCase().trim();
          return hName && (hName.includes(cleanSipName) || cleanSipName.includes(hName));
        });

        if (matchedHolding) {
          const newInvested = (matchedHolding.totalInvested || 0) + item.amount;
          const newCurrent = (matchedHolding.currentValue || 0) + item.amount;
          try {
            await fetch('/api/investments/snapshots', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                id: matchedHolding._id,
                originalName: matchedHolding.holdingName,
                holdingName: matchedHolding.holdingName,
                totalInvested: newInvested,
                currentValue: newCurrent,
                portfolioType: matchedHolding.portfolioType,
                units: matchedHolding.units,
                buyPrice: matchedHolding.buyPrice,
              }),
            });
          } catch (e) {
            console.warn('Could not auto-increment holding from SIP log:', e);
          }
        }

        const nextList = (settings?.recurringExpenses || []).map((r) =>
          r.id === item.id ? { ...r, lastLoggedMonth: currentYM } : r
        );
        await fetch('/api/settings', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ recurringExpenses: nextList }),
        });

        successBuzz();
        setSyncToast(`Logged ₹${item.amount.toLocaleString('en-IN')} SIP to expenses${matchedHolding ? ` & added to ${matchedHolding.holdingName}` : ''}!`);
        setTimeout(() => setSyncToast(null), 3500);
        await loadData();
      } else {
        alert('Failed to log SIP expense');
      }
    } catch (err) {
      console.error(err);
      alert('Error logging SIP expense');
    } finally {
      setLoggingSipId(null);
    }
  };

  const handleCreateSip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSipName.trim() || !newSipAmount || parseFloat(newSipAmount) <= 0) return;
    setIsSavingSip(true);
    lightTap();
    try {
      const catId = investmentCatId || settings?.categories?.[0]?.id || 'cat_invest';
      const newSip: RecurringExpense = {
        id: 'rec_sip_' + Date.now(),
        name: newSipName.trim(),
        amount: parseFloat(newSipAmount),
        categoryId: catId,
        dayOfMonth: Math.min(31, Math.max(1, parseInt(newSipDay, 10) || 1)),
        isActive: true,
      };

      const nextList = [...(settings?.recurringExpenses || []), newSip];
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recurringExpenses: nextList }),
      });

      if (res.ok) {
        successBuzz();
        setShowAddSipModal(false);
        setNewSipName('');
        setNewSipAmount('');
        setSyncToast('SIP added to monthly plan!');
        setTimeout(() => setSyncToast(null), 3000);
        await loadData();
      } else {
        alert('Failed to save SIP');
      }
    } catch (e) {
      console.error(e);
      alert('Error saving SIP');
    } finally {
      setIsSavingSip(false);
    }
  };

  const openSipModal = (preselectedHolding?: any) => {
    const target = preselectedHolding || (mfHoldings[0] || distinctHoldings[0]);
    if (target) {
      const key = target._id || target.holdingName;
      setSelectedSipHoldingKey(key);
      setNewSipName(`${target.holdingName} SIP`);
    } else {
      setSelectedSipHoldingKey('custom');
      setNewSipName('Monthly SIP');
    }
    setNewSipAmount(investmentCategory?.monthlyBudget ? String(investmentCategory.monthlyBudget) : '25000');
    setShowAddSipModal(true);
  };

  const handleDeleteSip = async (id: string) => {
    if (!confirm('Remove this SIP from monthly recurring plan?')) return;
    lightTap();
    try {
      const nextList = (settings?.recurringExpenses || []).filter((r) => r.id !== id);
      await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recurringExpenses: nextList }),
      });
      successBuzz();
      await loadData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleClearAll = async () => {
    if (!confirm('Clear all tracked investment snapshots and start fresh?')) return;
    setIsDeleting(true);
    lightTap();
    try {
      await fetch('/api/investments/snapshots?id=all', { method: 'DELETE' });
      successBuzz();
      await loadData();
    } catch (e) {
      console.error(e);
    } finally {
      setIsDeleting(false);
    }
  };

  // ── On-Device OCR ─────────────────────────────────────────────────────
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    mediumTap();
    setOcrError(null);
    setOcrStatus('preprocessing');
    setOcrProgress(15);

    try {
      // 1. Try Cloud Vision API first (if API key configured on server)
      try {
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve) => {
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
        const dataUri = await base64Promise;

        setOcrStatus('ocr');
        setOcrProgress(40);

        const apiRes = await fetch('/api/investments/parse-screenshot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: dataUri }),
        });

        if (apiRes.ok) {
          const json = await apiRes.json();
          if (json.success && json.data && (json.data.currentValue > 0 || json.data.totalInvested > 0)) {
            setReviewData({
              holdingName: json.data.holdingName || json.data.funds?.[0]?.name || '',
              date: new Date().toISOString().split('T')[0],
              totalInvested: json.data.totalInvested || accumulatedFromExpenses,
              currentValue: json.data.currentValue || 0,
              portfolioType: json.data.portfolioType || 'mutual_funds',
              oneDayGain: json.data.totalGain || 0,
              oneDayGainPercent: json.data.gainPercent || 0,
              units: json.data.units,
              buyPrice: json.data.buyPrice,
              funds: json.data.funds || [],
            });
            setOcrStatus('done');
            setShowReviewModal(true);
            successBuzz();
            return;
          }
        }
      } catch (cloudErr) {
        console.warn('Cloud Vision parsing unavailable, falling back to local OCR:', cloudErr);
      }

      // 2. Fallback to On-Device Tesseract OCR
      const processedBlob = await preprocessImageForOcr(file);

      setOcrStatus('loading-worker');
      const { createWorker } = await import('tesseract.js');

      setOcrStatus('ocr');
      const worker = await createWorker('eng', 1, {
        logger: (m: any) => {
          if (m.status === 'recognizing text') {
            setOcrProgress(Math.round((m.progress || 0) * 100));
          }
        },
      });

      const { data: { text } } = await worker.recognize(processedBlob);
      await worker.terminate();

      setOcrStatus('parsing');
      const parsed = parseGrowwOcrText(text);

      setReviewData({
        holdingName: parsed.holdingName || '',
        date: new Date().toISOString().split('T')[0],
        totalInvested: parsed.totalInvested || accumulatedFromExpenses,
        currentValue: parsed.currentValue || 0,
        portfolioType: parsed.portfolioType,
        oneDayGain: parsed.oneDayGain || 0,
        oneDayGainPercent: parsed.oneDayGainPercent || 0,
        units: parsed.units,
        buyPrice: parsed.buyPrice,
        funds: parsed.funds || [],
      });

      if (!parsed.currentValue) {
        setOcrError('Could not auto-read all numbers. Please verify and fill missing values:');
      }

      setOcrStatus('done');
      setShowReviewModal(true);
      successBuzz();
    } catch (err: any) {
      console.error('OCR processing failed:', err);
      setOcrError('OCR encountered an issue. Enter portfolio values manually:');
      setReviewData({
        holdingName: '',
        date: new Date().toISOString().split('T')[0],
        totalInvested: accumulatedFromExpenses,
        currentValue: 0,
        portfolioType: 'mutual_funds',
        oneDayGain: 0,
        oneDayGainPercent: 0,
        funds: [],
      });
      setOcrStatus('error');
      setShowReviewModal(true);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // ── Save snapshot ─────────────────────────────────────────────────────
  const handleSaveSnapshot = async () => {
    setSavingSnapshot(true);
    lightTap();
    try {
      const inv = Number(reviewData.totalInvested) || 0;
      const cur = Number(reviewData.currentValue) || 0;
      const gain = cur - inv;
      const pct = inv > 0 ? Number(((gain / inv) * 100).toFixed(2)) : 0;

      const res = await fetch('/api/investments/snapshots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          holdingName: reviewData.holdingName,
          date: reviewData.date,
          totalInvested: inv,
          currentValue: cur,
          totalGain: gain,
          gainPercent: pct,
          oneDayGain: reviewData.oneDayGain || 0,
          oneDayGainPercent: reviewData.oneDayGainPercent || 0,
          source: 'groww',
          portfolioType: reviewData.portfolioType,
          funds: reviewData.funds,
          units: reviewData.units,
          buyPrice: reviewData.buyPrice,
          syncNetWorth,
        }),
      });

      if (res.ok) {
        successBuzz();
        setShowReviewModal(false);
        setOcrStatus('idle');
        await loadData();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to save snapshot');
      }
    } catch (e) { console.error(e); alert('Failed to save snapshot'); }
    finally { setSavingSnapshot(false); }
  };

  const ocrStatusLabel: Record<OcrStatus, string> = {
    idle: '',
    preprocessing: 'Enhancing image contrast…',
    'loading-worker': 'Loading OCR engine…',
    ocr: `Reading screenshot… ${ocrProgress}%`,
    parsing: 'Extracting holding & numbers…',
    done: 'Done!',
    error: 'OCR error',
  };

  if (loading) return (
    <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading investments…</div>
  );

  const typeCfg = getTypeCfg(reviewData.portfolioType);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', paddingBottom: 100, color: 'var(--text-primary)' }}>
      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />

      {/* ── Global Styles & Animations ────────────────────────────── */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulseGlow { 0%,100%{opacity:1} 50%{opacity:0.35} }
        @keyframes slideInUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes shimmer { 0%{background-position: -200% 0;} 100%{background-position: 200% 0;} }
        @keyframes slideUpSheet { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

        .inv-seg-tab {
          flex: 1;
          padding: 9px 12px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          border: 1px solid transparent;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          color: var(--text-muted);
          background: transparent;
        }
        .inv-seg-tab.active {
          background: var(--bg-card);
          color: var(--text-primary);
          border-color: rgba(255,255,255,0.08);
          box-shadow: 0 4px 14px rgba(0,0,0,0.25);
        }

        .inv-filter-chip {
          padding: 6px 13px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          border: 1px solid transparent;
          transition: all 0.15s ease;
          display: flex;
          align-items: center;
          gap: 5px;
          white-space: nowrap;
        }

        .inv-card-hover {
          transition: transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
        }
        .inv-card-hover:hover {
          transform: translateY(-2px);
          border-color: rgba(139,92,246,0.3) !important;
          box-shadow: 0 8px 24px rgba(0,0,0,0.25) !important;
        }
      `}</style>

      {/* ── Toast Notification ───────────────────────────────────────── */}
      {syncToast && (
        <div style={{
          position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)',
          zIndex: 2000, background: 'rgba(16,185,129,0.95)', backdropFilter: 'blur(12px)',
          color: '#fff', padding: '10px 20px', borderRadius: 14, fontWeight: 700,
          fontSize: 13, display: 'flex', alignItems: 'center', gap: 8,
          boxShadow: '0 10px 32px rgba(0,0,0,0.35)',
        }}>
          <Sparkles size={16} />
          <span>{syncToast}</span>
        </div>
      )}

      {/* ══ ULTRA-PREMIUM HEADER ════════════════════════════════════════ */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 120,
        background: 'rgba(11, 15, 25, 0.85)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
      }}>
        {/* Row 1: Back + Title + Live Market Status + Action Controls */}
        <div style={{
          padding: '12px 16px 8px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={() => router.push('/reports')}
              style={{
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)',
                color: 'var(--text-primary)', width: 36, height: 36, borderRadius: 10,
                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
              }}
              title="Back to Reports"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <h1 style={{ fontSize: 18, fontWeight: 800, margin: 0, letterSpacing: '-0.3px' }}>
                  Portfolio
                </h1>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '2px 7px', borderRadius: 20,
                  background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)',
                }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981', boxShadow: '0 0 6px #10B981', animation: 'pulseGlow 2s infinite' }} />
                  <span style={{ fontSize: 10, fontWeight: 800, color: '#10B981', letterSpacing: '0.4px' }}>LIVE</span>
                </div>
              </div>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '2px 0 0', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span>AMFI · NSE</span>
                <span>·</span>
                <span>24K: <strong>{liveGoldRate ? `₹${liveGoldRate.ratePerGram.toLocaleString('en-IN')}/g` : '₹15,795/g'}</strong></span>
                {liveGoldRate?.mmtcPampRatePerGram && (
                  <>
                    <span>·</span>
                    <span style={{ color: '#FACC15', fontWeight: 700 }}>MMTC-PAMP: ₹{liveGoldRate.mmtcPampRatePerGram.toLocaleString('en-IN')}/g</span>
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Quick Action controls on Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {/* Privacy mask toggle button */}
            <button
              onClick={toggleMask}
              title={isMasked ? 'Show amounts' : 'Hide / Mask portfolio'}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                background: isMasked ? 'rgba(139,92,246,0.18)' : 'rgba(255,255,255,0.06)',
                color: isMasked ? '#A78BFA' : 'var(--text-secondary)',
                border: `1px solid ${isMasked ? 'rgba(139,92,246,0.45)' : 'rgba(255,255,255,0.09)'}`,
                padding: '7px 11px', borderRadius: 10, fontWeight: 700, fontSize: 12,
                cursor: 'pointer', transition: 'all 0.18s ease',
              }}
            >
              {isMasked ? <EyeOff size={14} /> : <Eye size={14} />}
              <span>{isMasked ? 'Hidden' : 'Hide'}</span>
            </button>

            {/* Live Sync button */}
            <button
              onClick={handleSyncLive}
              disabled={isSyncingLive || distinctHoldings.length === 0}
              title="Sync latest live NAVs & stock prices"
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                background: 'rgba(16,185,129,0.12)', color: '#10B981',
                border: '1px solid rgba(16,185,129,0.28)',
                padding: '7px 11px', borderRadius: 10, fontWeight: 700, fontSize: 12,
                cursor: isSyncingLive ? 'not-allowed' : 'pointer',
              }}
            >
              <RefreshCw size={13} style={{ animation: isSyncingLive ? 'spin 1s linear infinite' : 'none' }} />
              <span>{isSyncingLive ? 'Syncing…' : 'Sync'}</span>
            </button>
          </div>
        </div>

        {/* Row 2: Header Quick Action Buttons (No overflow!) */}
        <div style={{
          padding: '0 16px 12px',
          display: 'flex', alignItems: 'center', gap: 8, overflowX: 'auto',
        }}>
          {/* + Add Manual */}
          <button
            onClick={() => {
              setManualType('gold');
              setManualName('24K Digital Gold');
              setManualUnits(''); setManualBuyPrice('');
              setManualInvested(''); setManualCurrent('');
              setManualDate(new Date().toISOString().split('T')[0]);
              setManualTime(new Date().toTimeString().slice(0, 5));
              setShowManualModal(true);
              fetchLiveGold();
            }}
            style={{
              display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0,
              background: 'rgba(245,158,11,0.12)', color: '#F59E0B',
              border: '1px solid rgba(245,158,11,0.3)',
              padding: '6px 12px', borderRadius: 10, fontWeight: 700, fontSize: 12,
              cursor: 'pointer',
            }}
          >
            <Plus size={13} />
            <span>+ Add Holding</span>
          </button>

          {/* Upload Groww Screenshot */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isOcrRunning}
            style={{
              display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0,
              background: isOcrRunning ? 'var(--bg-elevated)' : 'var(--accent-grad)',
              color: isOcrRunning ? 'var(--text-muted)' : '#fff',
              border: isOcrRunning ? '1px solid var(--border)' : 'none',
              padding: '6px 12px', borderRadius: 10, fontWeight: 700, fontSize: 12,
              cursor: isOcrRunning ? 'not-allowed' : 'pointer',
              boxShadow: isOcrRunning ? 'none' : '0 3px 12px rgba(124,92,252,0.3)',
            }}
          >
            {isOcrRunning ? (
              <>
                <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} />
                <span>{ocrStatusLabel[ocrStatus]}</span>
              </>
            ) : (
              <>
                <Camera size={13} />
                <span>Upload Groww</span>
              </>
            )}
          </button>

          {/* Add SIP */}
          <button
            onClick={() => openSipModal()}
            style={{
              display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0,
              background: 'rgba(139,92,246,0.12)', color: '#A78BFA',
              border: '1px solid rgba(139,92,246,0.3)',
              padding: '6px 12px', borderRadius: 10, fontWeight: 700, fontSize: 12,
              cursor: 'pointer',
            }}
          >
            <Repeat size={13} />
            <span>Add SIP</span>
          </button>
        </div>
      </header>

      {/* ══ MAIN BODY WRAPPER ════════════════════════════════════════ */}
      <main style={{ padding: '16px 16px 0', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* ══ FLAGSHIP HERO CARD ════════════════════════════════════ */}
        <div style={{
          background: 'linear-gradient(145deg, #090e1a 0%, #101726 50%, #151e36 100%)',
          borderRadius: 24, padding: '24px 20px 20px', position: 'relative',
          overflow: 'hidden', boxShadow: '0 16px 44px rgba(0,0,0,0.45)',
          border: '1px solid rgba(255,255,255,0.08)',
        }}>
          {/* Subtle Ambient Radial Glow */}
          <div style={{
            position: 'absolute', top: -50, right: -40, width: 200, height: 200, borderRadius: '50%',
            background: isPositive
              ? 'radial-gradient(circle, rgba(16,185,129,0.2) 0%, transparent 70%)'
              : 'radial-gradient(circle, rgba(239,68,68,0.2) 0%, transparent 70%)',
            pointerEvents: 'none',
          }} />
          <div style={{
            position: 'absolute', bottom: -50, left: -40, width: 160, height: 160, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(139,92,246,0.18) 0%, transparent 70%)',
            pointerEvents: 'none',
          }} />

          {/* Top Label & Overall Return Badge */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 10,
                background: 'rgba(139,92,246,0.2)', color: '#A78BFA',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 0 12px rgba(139,92,246,0.25)',
              }}>
                <Layers size={16} />
              </div>
              <div>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                  Total Portfolio Value
                </span>
              </div>
            </div>

            <div style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '4px 10px', borderRadius: 999, fontSize: 11.5, fontWeight: 800,
              background: isPositive ? 'rgba(16,185,129,0.18)' : 'rgba(239,68,68,0.18)',
              color: isPositive ? '#34D399' : '#F87171',
              border: `1px solid ${isPositive ? 'rgba(16,185,129,0.35)' : 'rgba(239,68,68,0.35)'}`,
            }}>
              {isPositive ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
              <span>{isPositive ? '+' : ''}{totalGainPct}% Overall</span>
            </div>
          </div>

          {/* Primary Amount Display */}
          <div style={{
            fontSize: 38, fontWeight: 900, color: '#FFFFFF',
            letterSpacing: '-1.2px', lineHeight: 1.1, marginBottom: 12,
            textShadow: '0 2px 24px rgba(255,255,255,0.12)',
          }}>
            {isMasked ? '₹ ••••••••' : formatINR(totalCurrentValue)}
          </div>

          {/* P&L Badges: Total Return & Today's 1D */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '4px 11px', borderRadius: 20, fontWeight: 700, fontSize: 12,
              background: isPositive ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
              color: isPositive ? '#34D399' : '#F87171',
              border: `1px solid ${isPositive ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
            }}>
              {isMasked ? (
                <span>•••••• Total Gain</span>
              ) : (
                <>
                  <span>Total P&amp;L:</span>
                  <strong>{isPositive ? '+' : ''}{formatINR(totalGain)}</strong>
                </>
              )}
            </div>

            {(latest1D.gain !== 0 || latest1D.percent !== 0) && (
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '4px 11px', borderRadius: 20, fontWeight: 700, fontSize: 12,
                background: latest1D.gain >= 0 ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
                color: latest1D.gain >= 0 ? '#34D399' : '#F87171',
                border: `1px solid ${latest1D.gain >= 0 ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`,
              }}>
                {isMasked ? (
                  <span>•••••• 1D</span>
                ) : (
                  <>
                    <span>1D Today:</span>
                    <strong>{latest1D.gain >= 0 ? '+' : ''}{formatINR(latest1D.gain)} ({latest1D.gain >= 0 ? '+' : ''}{latest1D.percent}%)</strong>
                  </>
                )}
              </div>
            )}
          </div>

          {/* 4-Cell Portfolio Breakdown Grid */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
            background: 'rgba(255,255,255,0.04)', borderRadius: 16,
            border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden',
          }}>
            {[
              { label: 'Invested', val: isMasked ? '₹••••' : formatINR(totalInvested), color: '#DDD6FE' },
              { label: 'Mutual Funds', val: `${mfHoldings.length}`, color: '#A78BFA' },
              { label: 'Stocks', val: `${stockHoldings.length}`, color: '#34D399' },
              { label: 'Gold', val: `${goldHoldings.length}`, color: '#FBBF24' },
            ].map((item, idx) => (
              <div
                key={idx}
                style={{
                  padding: '12px 8px', textAlign: 'center',
                  borderLeft: idx > 0 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                }}
              >
                <div style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>
                  {item.label}
                </div>
                <div style={{ fontSize: 13.5, fontWeight: 800, color: item.color, lineHeight: 1.2 }}>
                  {item.val}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ══ SEGMENTED CONTROLLER (Holdings vs Analytics & Projections vs SIP) ═══════════════════════ */}
        <div style={{
          background: 'rgba(255,255,255,0.04)',
          borderRadius: 16, padding: 4,
          border: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', alignItems: 'center', gap: 4,
        }}>
          <button
            className={`inv-seg-tab${activeView === 'holdings' ? ' active' : ''}`}
            onClick={() => { setActiveView('holdings'); lightTap(); }}
          >
            <Tag size={14} />
            <span>Holdings ({distinctHoldings.length})</span>
          </button>
          <button
            className={`inv-seg-tab${activeView === 'analytics' ? ' active' : ''}`}
            onClick={() => { setActiveView('analytics'); lightTap(); }}
          >
            <Brain size={14} />
            <span>AI Analytics</span>
          </button>
          <button
            className={`inv-seg-tab${activeView === 'sip' ? ' active' : ''}`}
            onClick={() => { setActiveView('sip'); lightTap(); }}
          >
            <Repeat size={14} />
            <span>SIP Plan ({investmentSips.length})</span>
          </button>
        </div>

        {/* ════════════════════════════════════════════════════════════
            VIEW 1: HOLDINGS LIST WITH FILTER & SORT
        ════════════════════════════════════════════════════════════ */}
        {activeView === 'holdings' && (
          <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Filter Tabs & Count Badges */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
              {([
                { key: 'all', label: 'All', icon: '🗂️', count: distinctHoldings.length, col: '#3B82F6' },
                { key: 'mutual_funds', label: 'Mutual Funds', icon: '📊', count: mfHoldings.length, col: '#8B5CF6' },
                { key: 'stocks', label: 'Stocks', icon: '📈', count: stockHoldings.length, col: '#10B981' },
                { key: 'gold', label: 'Gold', icon: '🪙', count: goldHoldings.length, col: '#F59E0B' },
              ] as const).map((tab) => {
                const isSelected = activeFilter === tab.key;
                return (
                  <button
                    key={tab.key}
                    className="inv-filter-chip"
                    onClick={() => { setActiveFilter(tab.key); lightTap(); }}
                    style={{
                      background: isSelected ? `${tab.col}22` : 'var(--bg-card)',
                      color: isSelected ? tab.col : 'var(--text-secondary)',
                      border: `1.5px solid ${isSelected ? `${tab.col}66` : 'var(--border)'}`,
                    }}
                  >
                    <span>{tab.icon}</span>
                    <span>{tab.label}</span>
                    <span style={{
                      fontSize: 10, fontWeight: 800, padding: '1px 6px', borderRadius: 8,
                      background: isSelected ? `${tab.col}33` : 'var(--bg-elevated)',
                      color: isSelected ? tab.col : 'var(--text-muted)',
                    }}>
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Sort Dropdown / Bar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflowX: 'auto' }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <SlidersHorizontal size={12} /> Sort:
                </span>
                {([
                  { key: 'invested', label: 'Invested' },
                  { key: 'returns', label: 'Returns ₹' },
                  { key: 'gainPct', label: 'Returns %' },
                  { key: 'name', label: 'Name' },
                ] as const).map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => { setSortBy(opt.key); lightTap(); }}
                    style={{
                      padding: '5px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700,
                      cursor: 'pointer',
                      border: `1px solid ${sortBy === opt.key ? 'rgba(139,92,246,0.45)' : 'var(--border)'}`,
                      background: sortBy === opt.key ? 'rgba(139,92,246,0.15)' : 'var(--bg-elevated)',
                      color: sortBy === opt.key ? '#A78BFA' : 'var(--text-secondary)',
                    }}
                  >
                    {opt.label}{sortBy === opt.key ? ' ▾' : ''}
                  </button>
                ))}
              </div>

              {distinctHoldings.length > 0 && (
                <button
                  onClick={handleClearAll}
                  style={{
                    background: 'none', border: 'none', color: 'var(--danger)',
                    fontSize: 11, fontWeight: 700, cursor: 'pointer', padding: 0,
                  }}
                >
                  Clear All
                </button>
              )}
            </div>

            {/* Holdings Cards List */}
            {distinctHoldings.length === 0 ? (
              <div style={{
                padding: '40px 20px', textAlign: 'center',
                background: 'var(--bg-card)', borderRadius: 20,
                border: '1.5px dashed var(--border)',
              }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>🪙</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 6 }}>
                  No Investments Added Yet
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 auto 16px', maxWidth: 280 }}>
                  Upload a Groww portfolio screenshot or manually add Digital Gold, Mutual Funds, or Stocks.
                </p>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 10 }}>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      padding: '10px 18px', borderRadius: 12, border: 'none',
                      background: 'var(--accent-grad)', color: '#fff',
                      fontSize: 13, fontWeight: 800, cursor: 'pointer',
                    }}
                  >
                    Upload Groww
                  </button>
                </div>
              </div>
            ) : displayHoldings.length === 0 ? (
              <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                No holdings match the selected filter.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {displayHoldings.map((h, idx) => {
                  const pos = (h.totalGain || 0) >= 0;
                  const isStock = h.portfolioType === 'stocks';
                  const isGold = h.portfolioType === 'gold';
                  const isMmtcPamp = isGold && (
                    h.tag === 'mmtc_pamp' ||
                    /mmt[cp]\s*pamp/i.test(h.holdingName || '') ||
                    /pamp/i.test(h.holdingName || '')
                  );
                  const typeCfg = PORTFOLIO_TYPES.find((t) => t.value === h.portfolioType) || PORTFOLIO_TYPES[0];
                  const unitLabel = isGold ? 'g' : isStock ? 'shares' : 'units';
                  const gainPct = Number((h.gainPercent || 0).toFixed(2));

                  return (
                    <div
                      key={h._id ? String(h._id) : `${h.holdingName}_${idx}`}
                      className="inv-card-hover"
                      style={{
                        borderRadius: 18,
                        background: 'var(--bg-card)',
                        border: '1px solid rgba(255,255,255,0.07)',
                        borderLeft: `4px solid ${typeCfg.color}`,
                        overflow: 'hidden',
                        boxShadow: '0 4px 18px rgba(0,0,0,0.18)',
                        animation: 'slideInUp 0.25s ease both',
                        animationDelay: `${idx * 0.03}s`,
                      }}
                    >
                      {/* Top Row: Tag, Name, Actions */}
                      <div style={{ padding: '14px 16px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            {/* Type Pill + MMTC-PAMP 999.9 Tag */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5, flexWrap: 'wrap' }}>
                              <span style={{
                                fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 6,
                                background: `${typeCfg.color}18`,
                                color: typeCfg.color,
                                border: `1px solid ${typeCfg.color}35`,
                                textTransform: 'uppercase', letterSpacing: '0.5px',
                              }}>
                                {typeCfg.icon} {typeCfg.label}
                              </span>
                              {isMmtcPamp && (
                                <span style={{
                                  fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 6,
                                  background: 'rgba(234,179,8,0.18)', color: '#FACC15',
                                  border: '1px solid rgba(234,179,8,0.4)',
                                  display: 'inline-flex', alignItems: 'center', gap: 3,
                                  boxShadow: '0 0 10px rgba(234,179,8,0.2)',
                                  letterSpacing: '0.3px',
                                }}>
                                  <span>💎</span>
                                  <span>MMTC-PAMP 999.9</span>
                                </span>
                              )}
                              {h.units && h.units > 0 && (
                                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>
                                  {h.units} {unitLabel}
                                </span>
                              )}
                            </div>

                            {/* Fund Name */}
                            <div style={{
                              fontSize: 14.5, fontWeight: 800, color: 'var(--text-primary)',
                              lineHeight: 1.35, wordBreak: 'break-word',
                            }}>
                              {h.holdingName || (isStock ? 'Stock Holding' : isGold ? 'Gold Investment' : 'Mutual Fund')}
                            </div>

                            {/* Details: Purchase time / Buy rate */}
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                              {h.buyPrice && h.buyPrice > 0 && (
                                <span>
                                  Avg: {isMasked ? '₹•••' : formatINR(h.buyPrice)}{isGold ? (isMmtcPamp ? '/g (MMTC-PAMP)' : '/g') : '/NAV'}
                                </span>
                              )}
                              {h.purchaseTime && <span>· {h.purchaseTime}</span>}
                              {!h.purchaseTime && h.date && <span>· Synced {h.date}</span>}
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                            <button
                              onClick={() => setEditingHolding({
                                id: h._id,
                                originalName: h.holdingName || '',
                                holdingName: h.holdingName || '',
                                fundName: h.fundName,
                                totalInvested: h.totalInvested || 0,
                                currentValue: h.currentValue || 0,
                                portfolioType: h.portfolioType || 'mutual_funds',
                                units: h.units,
                                buyPrice: h.buyPrice,
                                purchaseTime: h.purchaseTime,
                                tag: h.tag || (/mmt[cp]\s*pamp/i.test(h.holdingName || '') ? 'mmtc_pamp' : ''),
                              })}
                              style={{
                                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
                                color: 'var(--text-secondary)', padding: '7px 8px', cursor: 'pointer',
                                borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                              }}
                              title="Edit holding"
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              onClick={() => setHoldingToDelete({ id: h._id, name: h.holdingName || 'Holding', fundName: h.fundName })}
                              style={{
                                background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                                color: 'var(--danger)', padding: '7px 8px', cursor: 'pointer',
                                borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                              }}
                              title="Delete holding"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Bottom Metrics Bar */}
                      <div style={{
                        display: 'grid', gridTemplateColumns: '1.1fr 1.1fr 1.2fr',
                        borderTop: '1px solid rgba(255,255,255,0.06)',
                        background: 'rgba(0,0,0,0.22)',
                      }}>
                        <div style={{ padding: '10px 14px' }}>
                          <div style={{ fontSize: 9.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 2 }}>
                            Invested
                          </div>
                          <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)' }}>
                            {isMasked ? '₹••••••' : formatINR(h.totalInvested)}
                          </div>
                        </div>

                        <div style={{ padding: '10px 14px', borderLeft: '1px solid rgba(255,255,255,0.04)' }}>
                          <div style={{ fontSize: 9.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 2 }}>
                            Current Value
                          </div>
                          <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)' }}>
                            {isMasked ? '₹••••••' : formatINR(h.currentValue)}
                          </div>
                        </div>

                        <div style={{ padding: '10px 14px', borderLeft: '1px solid rgba(255,255,255,0.04)' }}>
                          <div style={{ fontSize: 9.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 2 }}>
                            Returns
                          </div>
                          <div style={{ fontSize: 13, fontWeight: 800, color: pos ? 'var(--success)' : 'var(--danger)' }}>
                            {isMasked ? (
                              <span>••••••</span>
                            ) : (
                              <>
                                {pos ? '+' : ''}{formatINR(h.totalGain)}
                                <span style={{ fontSize: 11, opacity: 0.85, marginLeft: 3 }}>
                                  ({pos ? '+' : ''}{gainPct}%)
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* ════════════════════════════════════════════════════════════
            VIEW 2: AI ANALYTICS, CHARTS & PROJECTIONS (100% ON-DEVICE)
        ════════════════════════════════════════════════════════════ */}
        {activeView === 'analytics' && (
          <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* ── 1. On-Device Portfolio Health Scorecard ──────────── */}
            <div style={{
              background: 'var(--bg-card)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 20, padding: 18, boxShadow: '0 8px 30px rgba(0,0,0,0.22)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 10,
                    background: 'rgba(16,185,129,0.15)', color: '#10B981',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <ShieldCheck size={18} />
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 800 }}>Portfolio Health &amp; Diversification</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Computed locally on your device</div>
                  </div>
                </div>

                <div style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '4px 10px', borderRadius: 12,
                  background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)',
                }}>
                  <span style={{ fontSize: 16, fontWeight: 900, color: '#10B981' }}>{portfolioHealth.score}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>/100</span>
                </div>
              </div>

              {/* Progress Distribution Bar */}
              <div style={{ marginBottom: 16 }}>
                <div style={{
                  height: 10, borderRadius: 8, background: 'rgba(255,255,255,0.06)',
                  display: 'flex', overflow: 'hidden', gap: 2,
                }}>
                  <div style={{ width: `${portfolioHealth.equityPct}%`, background: '#8B5CF6', borderRadius: 4 }} title={`Equity: ${portfolioHealth.equityPct}%`} />
                  <div style={{ width: `${portfolioHealth.goldPct}%`, background: '#F59E0B', borderRadius: 4 }} title={`Gold: ${portfolioHealth.goldPct}%`} />
                  {portfolioHealth.otherPct > 0 && (
                    <div style={{ width: `${portfolioHealth.otherPct}%`, background: '#3B82F6', borderRadius: 4 }} title={`Others: ${portfolioHealth.otherPct}%`} />
                  )}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                  <span style={{ color: '#A78BFA', fontWeight: 700 }}>📊 Equity {portfolioHealth.equityPct}%</span>
                  <span style={{ color: '#FBBF24', fontWeight: 700 }}>🪙 Gold {portfolioHealth.goldPct}%</span>
                  {portfolioHealth.otherPct > 0 && (
                    <span style={{ color: '#60A5FA', fontWeight: 700 }}>🗂️ Other {portfolioHealth.otherPct}%</span>
                  )}
                </div>
              </div>

              {/* On-Device Actionable Smart Insights */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {portfolioHealth.insights.map((ins, i) => (
                  <div
                    key={i}
                    style={{
                      padding: '10px 12px', borderRadius: 12,
                      background: ins.type === 'success' ? 'rgba(16,185,129,0.06)' : 'rgba(59,130,246,0.06)',
                      border: `1px solid ${ins.type === 'success' ? 'rgba(16,185,129,0.18)' : 'rgba(59,130,246,0.18)'}`,
                      display: 'flex', alignItems: 'flex-start', gap: 8,
                    }}
                  >
                    <div style={{
                      color: ins.type === 'success' ? '#10B981' : '#3B82F6',
                      marginTop: 2, flexShrink: 0,
                    }}>
                      {ins.type === 'success' ? <CheckCircle2 size={14} /> : <Info size={14} />}
                    </div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-primary)' }}>{ins.title}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.35 }}>{ins.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Sub-tabs for Analytics ───────────────────────────── */}
            <div style={{ display: 'flex', gap: 8 }}>
              {[
                { key: 'projection', label: '📈 Wealth Projections' },
                { key: 'allocation', label: '🥧 Asset Allocation' },
                { key: 'returns', label: '📊 Holdings Returns' },
              ].map((sub) => (
                <button
                  key={sub.key}
                  onClick={() => setActiveAnalyticsSection(sub.key as any)}
                  style={{
                    flex: 1, padding: '8px 10px', borderRadius: 12, fontSize: 11.5, fontWeight: 700,
                    border: `1px solid ${activeAnalyticsSection === sub.key ? 'rgba(139,92,246,0.45)' : 'rgba(255,255,255,0.07)'}`,
                    background: activeAnalyticsSection === sub.key ? 'rgba(139,92,246,0.15)' : 'var(--bg-card)',
                    color: activeAnalyticsSection === sub.key ? '#A78BFA' : 'var(--text-muted)',
                    cursor: 'pointer', transition: 'all 0.15s ease',
                  }}
                >
                  {sub.label}
                </button>
              ))}
            </div>

            {/* ── 2. AI Wealth Compounding Projection Chart ────────── */}
            {activeAnalyticsSection === 'projection' && (
              <div style={{
                background: 'var(--bg-card)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 20, padding: 18, boxShadow: '0 8px 30px rgba(0,0,0,0.22)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 800 }}>Simulated Wealth Compounding</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      Current portfolio + ₹{monthlySipTotal.toLocaleString('en-IN')}/mo SIP
                    </div>
                  </div>

                  {/* Horizon Pill Switcher */}
                  <div style={{ display: 'flex', gap: 4, background: 'var(--bg-elevated)', padding: 3, borderRadius: 10 }}>
                    {(['1Y', '3Y', '5Y', '10Y'] as const).map((h) => (
                      <button
                        key={h}
                        onClick={() => setProjectionHorizon(h)}
                        style={{
                          padding: '3px 8px', borderRadius: 7, border: 'none',
                          fontSize: 11, fontWeight: 800, cursor: 'pointer',
                          background: projectionHorizon === h ? 'var(--accent)' : 'transparent',
                          color: projectionHorizon === h ? '#fff' : 'var(--text-muted)',
                        }}
                      >
                        {h}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Scenario CAGR Switcher */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, overflowX: 'auto' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700 }}>Expected CAGR:</span>
                  {[
                    { cagr: 10, label: 'Conservative (10%)' },
                    { cagr: 13, label: 'Moderate (13%)' },
                    { cagr: 16, label: 'Aggressive (16%)' },
                  ].map((sc) => (
                    <button
                      key={sc.cagr}
                      onClick={() => setProjectionCagr(sc.cagr)}
                      style={{
                        padding: '4px 9px', borderRadius: 8, fontSize: 10.5, fontWeight: 700, cursor: 'pointer',
                        border: `1px solid ${projectionCagr === sc.cagr ? '#10B981' : 'rgba(255,255,255,0.08)'}`,
                        background: projectionCagr === sc.cagr ? 'rgba(16,185,129,0.15)' : 'transparent',
                        color: projectionCagr === sc.cagr ? '#34D399' : 'var(--text-muted)',
                      }}
                    >
                      {sc.label}
                    </button>
                  ))}
                </div>

                {/* Metric Highlights in Chart */}
                <div style={{
                  display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8,
                  padding: '10px 12px', borderRadius: 14, background: 'rgba(0,0,0,0.22)',
                  marginBottom: 14, border: '1px solid rgba(255,255,255,0.05)',
                }}>
                  <div>
                    <div style={{ fontSize: 9.5, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Projected Value</div>
                    <div style={{ fontSize: 14, fontWeight: 900, color: '#10B981', marginTop: 2 }}>
                      {isMasked ? '₹••••••' : formatINR(projectionCurves.endProjected)}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 9.5, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Principal Invested</div>
                    <div style={{ fontSize: 14, fontWeight: 900, color: 'var(--text-primary)', marginTop: 2 }}>
                      {isMasked ? '₹••••••' : formatINR(projectionCurves.endInvested)}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 9.5, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Growth Multiplier</div>
                    <div style={{ fontSize: 14, fontWeight: 900, color: '#A78BFA', marginTop: 2 }}>
                      {projectionCurves.multiplier}x Return
                    </div>
                  </div>
                </div>

                {/* Area Compounding Chart */}
                <div style={{ height: 210, width: '100%' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={projectionCurves.points} margin={{ top: 8, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="projGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10B981" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                        </linearGradient>
                        <linearGradient id="invGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                      <XAxis dataKey="label" stroke="var(--text-muted)" fontSize={10} tickLine={false} />
                      <YAxis stroke="var(--text-muted)" fontSize={9} tickLine={false} tickFormatter={(v) => `₹${Math.round(v / 1000)}k`} />
                      <Tooltip
                        formatter={(val: any, name: any) => [
                          isMasked ? '₹••••••' : formatINR(Number(val)),
                          name === 'projected' ? 'Projected Total' : 'Principal Invested',
                        ]}
                        contentStyle={{
                          background: 'rgba(15,20,32,0.95)', border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: 10, fontSize: 12, color: '#fff',
                        }}
                      />
                      <Area type="monotone" dataKey="projected" stroke="#10B981" strokeWidth={2.5} fillOpacity={1} fill="url(#projGrad)" />
                      <Area type="monotone" dataKey="invested" stroke="#8B5CF6" strokeWidth={1.5} strokeDasharray="4 4" fillOpacity={1} fill="url(#invGrad)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* ── 3. Asset Allocation Donut ────────────────────────── */}
            {activeAnalyticsSection === 'allocation' && (
              <div style={{
                background: 'var(--bg-card)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 20, padding: 18, boxShadow: '0 8px 30px rgba(0,0,0,0.22)',
              }}>
                <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 4 }}>Asset Allocation Breakdown</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>
                  Portfolio split across asset classes
                </div>

                <ResponsiveContainer width="100%" height={190}>
                  <PieChart>
                    <Pie data={allocationChartData} cx="50%" cy="50%" innerRadius={54} outerRadius={82} paddingAngle={4} dataKey="value">
                      {allocationChartData.map((entry, index) => (
                        <Cell key={`c-${index}`} fill={entry.color} stroke="transparent" />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: any) => [isMasked ? '₹••••••' : formatINR(Number(value)), '']}
                      contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 12 }}
                    />
                  </PieChart>
                </ResponsiveContainer>

                <div style={{ display: 'flex', justifyContent: 'center', gap: 16, flexWrap: 'wrap', marginTop: 6 }}>
                  {allocationChartData.map((entry) => {
                    const total = allocationChartData.reduce((s, e) => s + e.value, 0);
                    const pct = total > 0 ? ((entry.value / total) * 100).toFixed(1) : '0';
                    return (
                      <div key={entry.name} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 10, height: 10, borderRadius: 3, background: entry.color, flexShrink: 0 }} />
                        <span style={{ fontSize: 11.5, color: 'var(--text-secondary)', fontWeight: 600 }}>
                          {entry.name} · {pct}% ({isMasked ? '₹•••' : formatINR(entry.value)})
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── 4. Holdings Returns Distribution ─────────────────── */}
            {activeAnalyticsSection === 'returns' && (
              <div style={{
                background: 'var(--bg-card)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 20, padding: 18, boxShadow: '0 8px 30px rgba(0,0,0,0.22)',
              }}>
                <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 4 }}>Top Holdings Performance (% Gain)</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 14 }}>
                  Compare returns across individual schemes &amp; stocks
                </div>

                <ResponsiveContainer width="100%" height={Math.max(160, returnsChartData.length * 36)}>
                  <BarChart data={returnsChartData} layout="vertical" margin={{ left: 0, right: 16, top: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickFormatter={(v) => `${v}%`} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" width={75} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                    <Tooltip
                      formatter={(val: any, _n: any, props: any) => [
                        `${val > 0 ? '+' : ''}${val}%`,
                        props.payload?.fullName || props.payload?.name,
                      ]}
                      contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 12 }}
                    />
                    <Bar dataKey="gainPct" radius={[0, 6, 6, 0]} maxBarSize={18}>
                      {returnsChartData.map((entry, index) => (
                        <Cell key={`c-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>
        )}

        {/* ════════════════════════════════════════════════════════════
            VIEW 3: MONTHLY SIP & AUTO-DEDUCTION PLAN
        ════════════════════════════════════════════════════════════ */}
        {activeView === 'sip' && (
          <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Header / Add Button */}
            <div style={{
              background: 'var(--bg-card)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 20, padding: 18,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800 }}>Monthly SIP Planner</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                    Total active SIP: <strong>₹{monthlySipTotal.toLocaleString('en-IN')}/month</strong>
                  </div>
                </div>
                <button
                  onClick={() => openSipModal()}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '7px 13px', borderRadius: 10,
                    background: 'var(--accent)', color: '#fff', border: 'none',
                    fontSize: 12, fontWeight: 800, cursor: 'pointer',
                  }}
                >
                  <Plus size={14} />
                  <span>Add SIP</span>
                </button>
              </div>

              {/* Due SIP notification */}
              {(() => {
                const dueSips = investmentSips.filter((s) => s.isActive && s.lastLoggedMonth !== currentYM);
                if (dueSips.length === 0) return null;
                return (
                  <div style={{
                    marginBottom: 12, padding: '12px 14px', borderRadius: 12,
                    background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                  }}>
                    <div>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: '#F59E0B' }}>
                        ⚡ SIP Deducted this month?
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                        {dueSips.length} SIP{dueSips.length > 1 ? 's' : ''} ready to log with 1-tap
                      </div>
                    </div>
                    {dueSips.length === 1 && (
                      <button
                        onClick={() => handleLogSip(dueSips[0])}
                        disabled={loggingSipId === dueSips[0].id}
                        style={{
                          padding: '6px 12px', borderRadius: 8,
                          background: '#F59E0B', color: '#000', border: 'none',
                          fontWeight: 800, fontSize: 12, cursor: 'pointer', flexShrink: 0,
                          display: 'flex', alignItems: 'center', gap: 5,
                        }}
                      >
                        {loggingSipId === dueSips[0].id ? <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={13} />}
                        <span>Log {formatINR(dueSips[0].amount)}</span>
                      </button>
                    )}
                  </div>
                );
              })()}

              {/* SIP List */}
              {investmentSips.length === 0 ? (
                <div style={{
                  padding: '24px 16px', textAlign: 'center', background: 'var(--bg-elevated)',
                  borderRadius: 14, color: 'var(--text-muted)', fontSize: 12.5,
                }}>
                  No recurring SIPs set up yet. Add your monthly mutual fund or stock SIPs to log them in 1 tap.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {investmentSips.map((sip) => {
                    const isLoggedThisMonth = sip.lastLoggedMonth === currentYM;
                    const isLogging = loggingSipId === sip.id;
                    return (
                      <div
                        key={sip.id}
                        style={{
                          padding: '12px 14px', borderRadius: 14,
                          background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {sip.name}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span>Deducts on Day {sip.dayOfMonth}</span>
                            <span>•</span>
                            {isLoggedThisMonth ? (
                              <span style={{ color: 'var(--success)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}>
                                <CheckCircle2 size={12} /> Logged this month
                              </span>
                            ) : (
                              <span style={{ color: '#F59E0B', fontWeight: 600 }}>Due this month</span>
                            )}
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                          <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>
                            {isMasked ? '₹••••••' : formatINR(sip.amount)}
                          </span>
                          {!isLoggedThisMonth ? (
                            <button
                              onClick={() => handleLogSip(sip)}
                              disabled={isLogging}
                              title="Record deduction and increment portfolio holding"
                              style={{
                                padding: '6px 10px', borderRadius: 8,
                                background: 'var(--accent-grad)', color: '#fff', border: 'none',
                                fontSize: 11.5, fontWeight: 700, cursor: isLogging ? 'not-allowed' : 'pointer',
                                display: 'flex', alignItems: 'center', gap: 4,
                              }}
                            >
                              {isLogging ? (
                                <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} />
                              ) : (
                                <Check size={13} />
                              )}
                              <span>Log</span>
                            </button>
                          ) : (
                            <span style={{ fontSize: 11, color: 'var(--success)', padding: '4px 8px', borderRadius: 6, background: 'rgba(16,185,129,0.1)' }}>
                              Done
                            </span>
                          )}
                          <button
                            onClick={() => handleDeleteSip(sip.id)}
                            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', padding: 4, cursor: 'pointer' }}
                            title="Remove SIP"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Monthly SIP Debits Chart */}
            <div style={{
              background: 'var(--bg-card)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 20, padding: 18,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800 }}>Historical SIP Deductions</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>From your Investment expense category</div>
                </div>
                <Link href="/expenses" style={{ fontSize: 12, color: 'var(--accent-2)', textDecoration: 'none', fontWeight: 600 }}>
                  View All Log →
                </Link>
              </div>

              {monthlySipData.length > 0 ? (
                <div style={{ height: 160, width: '100%' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlySipData} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="label" stroke="var(--text-muted)" fontSize={11} tickLine={false} />
                      <YAxis stroke="var(--text-muted)" fontSize={10} tickLine={false} tickFormatter={(v) => `₹${v / 1000}k`} />
                      <Tooltip
                        content={({ active, payload, label }) => {
                          if (!active || !payload?.length) return null;
                          return (
                            <div style={{ background: 'rgba(20,20,30,0.95)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 12px', fontSize: 12 }}>
                              <div style={{ fontWeight: 600, color: 'var(--text-muted)' }}>{label}</div>
                              <div style={{ fontWeight: 800, color: 'var(--accent-2)', fontSize: 14 }}>{formatINR(Number(payload[0].value))}</div>
                            </div>
                          );
                        }}
                      />
                      <Bar dataKey="amount" fill="#8B5CF6" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                  No investment expenses logged yet.
                </div>
              )}
            </div>
          </section>
        )}

      </main>

      {/* ── Review Modal (Bottom Sheet) ──────────────────────────────────────────────────── */}
      {showReviewModal && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 1100,
            background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
            display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center',
            animation: 'fadeIn 0.2s ease-out',
          }}
          onClick={() => { setShowReviewModal(false); setOcrStatus('idle'); }}
        >
          <div
            style={{
              width: '100%', maxWidth: 500, maxHeight: 'calc(100% - 24px)',
              display: 'flex', flexDirection: 'column',
              background: 'var(--bg-card)', color: 'var(--text-primary)',
              borderRadius: '28px 28px 0 0',
              border: '1px solid var(--border-strong)', borderBottom: 'none',
              boxShadow: '0 -10px 50px rgba(0,0,0,0.55)',
              overflowY: 'auto', WebkitOverflowScrolling: 'touch',
              padding: '0 20px calc(36px + env(safe-area-inset-bottom, 16px))',
              animation: 'slideUpSheet 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Grab Handle */}
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border-strong)', margin: '12px auto 16px auto', flexShrink: 0 }} />

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Review Portfolio Snapshot</h3>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '3px 0 0' }}>
                  {ocrError ? 'Enter values manually' : 'Values auto-extracted from Groww screenshot'}
                </p>
              </div>
              <button onClick={() => { setShowReviewModal(false); setOcrStatus('idle'); }} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '50%', width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <X size={16} />
              </button>
            </div>

            {ocrError && (
              <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 12, padding: '10px 14px', marginBottom: 14, fontSize: 12, color: 'var(--warning)', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} /><span>{ocrError}</span>
              </div>
            )}
            {!ocrError && (
              <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 12, padding: '8px 14px', marginBottom: 14, fontSize: 12, color: '#10B981', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Cpu size={13} /><span>High-contrast OCR auto-extracted holding name &amp; numbers</span>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* ── Scheme / Holding Name Field ── */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                  Fund / Stock Name (auto-detected)
                </label>
                <input
                  type="text"
                  placeholder="e.g. SBI ELSS Tax Saver Fund Direct Growth"
                  value={reviewData.holdingName}
                  onChange={(e) => setReviewData({ ...reviewData, holdingName: e.target.value })}
                  style={{
                    width: '100%', padding: '10px 14px', borderRadius: 12,
                    background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                    color: 'var(--text-primary)', fontSize: 13.5, fontWeight: 700,
                  }}
                />
              </div>

              {/* ── Portfolio Type Picker ── */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 8 }}>Portfolio Type</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {PORTFOLIO_TYPES.map((t) => (
                    <button key={t.value} onClick={() => setReviewData({ ...reviewData, portfolioType: t.value })}
                      style={{
                        flex: 1, padding: '9px 6px', borderRadius: 12, border: `2px solid ${reviewData.portfolioType === t.value ? t.color : 'var(--border)'}`,
                        background: reviewData.portfolioType === t.value ? `${t.color}18` : 'var(--bg-elevated)',
                        color: reviewData.portfolioType === t.value ? t.color : 'var(--text-secondary)',
                        fontWeight: 700, fontSize: 11.5, cursor: 'pointer', textAlign: 'center',
                        transition: 'all 0.18s',
                      }}>
                      <div style={{ fontSize: 18, marginBottom: 2 }}>{t.icon}</div>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Date</label>
                <input type="date" value={reviewData.date} onChange={(e) => setReviewData({ ...reviewData, date: e.target.value })}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 12, background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 14, fontWeight: 600 }} />
              </div>

              {/* Units & Avg NAV (Auto-populates Invested) */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                    {reviewData.portfolioType === 'gold' ? 'Weight (Grams)' : reviewData.portfolioType === 'stocks' ? 'Shares / Qty' : 'Redeemable Units'}
                  </label>
                  <input
                    type="number"
                    step="any"
                    placeholder="e.g. 66.224"
                    value={reviewData.units !== undefined ? reviewData.units : ''}
                    onChange={(e) => {
                      const u = parseFloat(e.target.value) || 0;
                      const b = reviewData.buyPrice || 0;
                      const inv = (u > 0 && b > 0) ? Math.round(u * b) : reviewData.totalInvested;
                      setReviewData({ ...reviewData, units: u, totalInvested: inv });
                    }}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 12, background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 14, fontWeight: 600 }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                    {reviewData.portfolioType === 'gold' ? 'Buy Rate (₹/g)' : reviewData.portfolioType === 'stocks' ? 'Buy Price (₹)' : 'Avg NAV (₹)'}
                  </label>
                  <input
                    type="number"
                    step="any"
                    placeholder="e.g. 458.52"
                    value={reviewData.buyPrice !== undefined ? reviewData.buyPrice : ''}
                    onChange={(e) => {
                      const b = parseFloat(e.target.value) || 0;
                      const u = reviewData.units || 0;
                      const inv = (u > 0 && b > 0) ? Math.round(u * b) : reviewData.totalInvested;
                      setReviewData({ ...reviewData, buyPrice: b, totalInvested: inv });
                    }}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 12, background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 14, fontWeight: 600 }}
                  />
                </div>
              </div>

              {/* Invested + Current */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>Invested (₹)</label>
                    <span style={{ fontSize: 10, color: 'var(--accent-2)', fontWeight: 600 }}>Editable</span>
                  </div>
                  <input type="number" value={reviewData.totalInvested || ''} onChange={(e) => setReviewData({ ...reviewData, totalInvested: Number(e.target.value) })}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 12, background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 15, fontWeight: 700 }} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>Current Value (₹)</label>
                    <span style={{ fontSize: 10, color: 'var(--accent-2)', fontWeight: 600 }}>Editable</span>
                  </div>
                  <input type="number" value={reviewData.currentValue || ''} onChange={(e) => setReviewData({ ...reviewData, currentValue: Number(e.target.value) })}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 12, background: 'var(--bg-elevated)', border: `2px solid ${typeCfg.color}40`, color: 'var(--text-primary)', fontSize: 15, fontWeight: 700 }} />
                </div>
              </div>

              {/* Live P&L preview */}
              {reviewData.currentValue > 0 && (() => {
                const g = reviewData.currentValue - reviewData.totalInvested;
                const pos = g >= 0;
                const pct = reviewData.totalInvested > 0 ? ((g / reviewData.totalInvested) * 100).toFixed(2) : '0';
                return (
                  <div style={{ padding: '12px 14px', borderRadius: 12, background: pos ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${pos ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{typeCfg.icon} {reviewData.holdingName || typeCfg.label} P&amp;L</div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: pos ? 'var(--success)' : 'var(--danger)', marginTop: 2 }}>
                        {pos ? '+' : ''}{formatINR(g)} ({pos ? '+' : ''}{pct}%)
                      </div>
                    </div>
                    <div style={{ fontSize: 24 }}>{pos ? '🚀' : '📉'}</div>
                  </div>
                );
              })()}

              {/* Net Worth sync info */}
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '6px 0' }}>
                <input type="checkbox" checked={syncNetWorth} onChange={(e) => setSyncNetWorth(e.target.checked)} style={{ width: 18, height: 18, accentColor: 'var(--accent)' }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                    Auto-update Net Worth
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    → Updates &quot;{typeCfg.netWorthCategory}&quot; asset
                  </div>
                </div>
              </label>

              <button onClick={handleSaveSnapshot} disabled={savingSnapshot || reviewData.currentValue <= 0}
                style={{ background: reviewData.currentValue > 0 ? 'var(--accent-grad)' : 'var(--bg-elevated)', color: reviewData.currentValue > 0 ? '#fff' : 'var(--text-muted)', border: 'none', padding: '14px', borderRadius: 14, fontWeight: 800, fontSize: 15, cursor: reviewData.currentValue > 0 ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: reviewData.currentValue > 0 ? '0 6px 20px rgba(124,92,252,0.4)' : 'none', marginTop: 6 }}>
                {savingSnapshot
                  ? <><RefreshCw size={18} style={{ animation: 'spin 1s linear infinite' }} /><span>Saving…</span></>
                  : <><Check size={18} /><span>Save Snapshot</span></>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Custom Delete Confirmation (Bottom Sheet) ── */}
      {holdingToDelete && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 1100,
            background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
            display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center',
            animation: 'fadeIn 0.2s ease-out',
          }}
          onClick={() => !isDeleting && setHoldingToDelete(null)}
        >
          <div
            style={{
              width: '100%', maxWidth: 440,
              background: 'var(--bg-card)', color: 'var(--text-primary)',
              borderRadius: '28px 28px 0 0',
              border: '1px solid var(--border-strong)', borderBottom: 'none',
              boxShadow: '0 -10px 50px rgba(0,0,0,0.55)',
              padding: '0 22px calc(34px + env(safe-area-inset-bottom, 16px))',
              animation: 'slideUpSheet 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Grab Handle */}
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border-strong)', margin: '12px auto 18px auto' }} />

            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: 'rgba(239,68,68,0.12)', color: 'var(--danger)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: 12,
            }}>
              <Trash2 size={22} />
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 6px' }}>
              Delete Holding?
            </h3>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 20px', lineHeight: 1.4 }}>
              Are you sure you want to remove <strong style={{ color: 'var(--text-primary)' }}>{holdingToDelete.name}</strong> from your tracked investments?
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <button
                onClick={() => setHoldingToDelete(null)}
                disabled={isDeleting}
                style={{
                  padding: '12px', borderRadius: 14, border: '1px solid var(--border)',
                  background: 'var(--bg-elevated)', color: 'var(--text-primary)',
                  fontWeight: 700, fontSize: 14, cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={isDeleting}
                style={{
                  padding: '12px', borderRadius: 14, border: 'none',
                  background: 'var(--danger)', color: '#fff',
                  fontWeight: 800, fontSize: 14, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
              >
                {isDeleting ? <RefreshCw size={15} style={{ animation: 'spin 1s linear infinite' }} /> : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Custom Edit Holding (Bottom Sheet) ── */}
      {editingHolding && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 1100,
            background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
            display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center',
            animation: 'fadeIn 0.2s ease-out',
          }}
          onClick={() => !isSavingEdit && setEditingHolding(null)}
        >
          <div
            style={{
              width: '100%', maxWidth: 500, maxHeight: 'calc(100% - 24px)',
              display: 'flex', flexDirection: 'column', gap: 14,
              background: 'var(--bg-card)', color: 'var(--text-primary)',
              borderRadius: '28px 28px 0 0',
              border: '1px solid var(--border-strong)', borderBottom: 'none',
              boxShadow: '0 -10px 50px rgba(0,0,0,0.55)',
              overflowY: 'auto', WebkitOverflowScrolling: 'touch',
              padding: '0 20px calc(36px + env(safe-area-inset-bottom, 16px))',
              animation: 'slideUpSheet 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Grab Handle */}
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border-strong)', margin: '12px auto 8px auto', flexShrink: 0 }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 10,
                  background: 'rgba(139,92,246,0.15)', color: '#8B5CF6',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Pencil size={18} />
                </div>
                <div>
                  <h3 style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                    Edit Holding
                  </h3>
                  <p style={{ fontSize: 11.5, color: 'var(--text-muted)', margin: 0 }}>
                    Modify name, invested amount or value
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditingHolding(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Holding Name input */}
            <div>
              <label style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                HOLDING / SCHEME NAME
              </label>
              <input
                type="text"
                value={editingHolding.holdingName}
                onChange={(e) => setEditingHolding({ ...editingHolding, holdingName: e.target.value })}
                placeholder="e.g. Parag Parikh Flexi Cap Fund"
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: 10,
                  background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                  color: 'var(--text-primary)', fontSize: 13.5, fontWeight: 600, outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Portfolio Type Toggle */}
            <div>
              <label style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                ASSET TYPE
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                {([
                  { type: 'mutual_funds' as PortfolioType, label: '📊 Mutual Fund', color: '#8B5CF6' },
                  { type: 'stocks' as PortfolioType, label: '📈 Stock', color: '#10B981' },
                  { type: 'gold' as PortfolioType, label: '🪙 Gold', color: '#F59E0B' },
                ]).map((item) => {
                  const active = editingHolding.portfolioType === item.type;
                  return (
                    <button
                      key={item.type}
                      type="button"
                      onClick={() => setEditingHolding({ ...editingHolding, portfolioType: item.type })}
                      style={{
                        padding: '9px 8px', borderRadius: 10,
                        border: active ? `1.5px solid ${item.color}` : '1px solid var(--border)',
                        background: active ? `${item.color}18` : 'var(--bg-elevated)',
                        color: active ? item.color : 'var(--text-muted)',
                        fontWeight: active ? 700 : 500, fontSize: 11.5, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                      }}
                    >
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* MMTC-PAMP Tag Toggle if Gold */}
            {manualType === 'gold' && (
              <label style={{
                display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
                padding: '10px 14px', borderRadius: 12,
                background: isManualMmtc ? 'rgba(234,179,8,0.14)' : 'var(--bg-elevated)',
                border: `1.5px solid ${isManualMmtc ? '#EAB308' : 'var(--border)'}`,
                transition: 'all 0.15s ease',
              }}>
                <input
                  type="checkbox"
                  checked={isManualMmtc}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setIsManualMmtc(checked);
                    if (checked) {
                      if (!manualName || manualName === '24K Digital Gold') {
                        setManualName('MMTC PAMP Physical Gold (24K)');
                      }
                      if (liveGoldRate?.mmtcPampRatePerGram) {
                        setManualBuyPrice(String(liveGoldRate.mmtcPampRatePerGram));
                        const u = parseFloat(manualUnits) || 0;
                        if (u > 0) {
                          const total = Math.round(u * liveGoldRate.mmtcPampRatePerGram);
                          setManualInvested(String(total));
                          setManualCurrent(String(total));
                        }
                      }
                    }
                  }}
                  style={{ width: 17, height: 17, accentColor: '#EAB308', cursor: 'pointer' }}
                />
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 800, color: '#FACC15', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span>💎 MMTC-PAMP 999.9 CertiCard Purest Gold</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                    Tracks live MMTC-PAMP retail rate ({liveGoldRate?.mmtcPampRatePerGram ? `₹${liveGoldRate.mmtcPampRatePerGram.toLocaleString('en-IN')}/g` : '~₹16,814/g'}) with minting charges.
                  </div>
                </div>
              </label>
            )}

            {/* Units / Grams & Buy Price inputs */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                  {editingHolding.portfolioType === 'gold' ? 'WEIGHT (GRAMS)' : editingHolding.portfolioType === 'stocks' ? 'SHARES / QTY' : 'REDEEMABLE UNITS'}
                </label>
                <input
                  type="number"
                  step="any"
                  value={editingHolding.units || ''}
                  onChange={(e) => {
                    const u = parseFloat(e.target.value) || 0;
                    const b = editingHolding.buyPrice || 0;
                    setEditingHolding({
                      ...editingHolding,
                      units: u,
                      ...(b > 0 && u > 0 ? { totalInvested: Math.round(u * b) } : {}),
                    });
                  }}
                  placeholder={editingHolding.portfolioType === 'gold' ? 'e.g. 5.00' : 'e.g. 10'}
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: 10,
                    background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                    color: 'var(--text-primary)', fontSize: 13.5, fontWeight: 600, outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                  {editingHolding.portfolioType === 'gold' ? 'BUY RATE (₹/g)' : editingHolding.portfolioType === 'stocks' ? 'BUY PRICE / SHARE (₹)' : 'AVG NAV (₹)'}
                </label>
                <input
                  type="number"
                  step="any"
                  value={editingHolding.buyPrice || ''}
                  onChange={(e) => {
                    const b = parseFloat(e.target.value) || 0;
                    const u = editingHolding.units || 0;
                    setEditingHolding({
                      ...editingHolding,
                      buyPrice: b,
                      ...(u > 0 && b > 0 ? { totalInvested: Math.round(u * b) } : {}),
                    });
                  }}
                  placeholder="0"
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: 10,
                    background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                    color: 'var(--text-primary)', fontSize: 13.5, fontWeight: 600, outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            {/* Invested & Current Value inputs */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <label style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)' }}>
                    INVESTED (₹)
                  </label>
                  <span style={{ fontSize: 10, color: 'var(--accent-2)', fontWeight: 600 }}>Editable</span>
                </div>
                <input
                  type="number"
                  step="any"
                  value={editingHolding.totalInvested || ''}
                  onChange={(e) => setEditingHolding({ ...editingHolding, totalInvested: parseFloat(e.target.value) || 0 })}
                  placeholder="0"
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: 10,
                    background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                    color: 'var(--text-primary)', fontSize: 14, fontWeight: 700, outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>
                  Auto-calculated: Units × Avg NAV (feel free to edit)
                </div>
              </div>
              <div>
                <label style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                  CURRENT VALUE (₹)
                </label>
                <input
                  type="number"
                  step="any"
                  value={editingHolding.currentValue || ''}
                  onChange={(e) => setEditingHolding({ ...editingHolding, currentValue: parseFloat(e.target.value) || 0 })}
                  placeholder="0"
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: 10,
                    background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                    color: 'var(--text-primary)', fontSize: 14, fontWeight: 700, outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            {/* Purchase Date & Time */}
            <div>
              <label style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                PURCHASE TIME / DATE (OPTIONAL)
              </label>
              <input
                type="text"
                value={editingHolding.purchaseTime || ''}
                onChange={(e) => setEditingHolding({ ...editingHolding, purchaseTime: e.target.value })}
                placeholder="e.g. 2026-09-20 14:30"
                style={{
                  width: '100%', padding: '9px 12px', borderRadius: 10,
                  background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                  color: 'var(--text-primary)', fontSize: 12.5, outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Calculated Return preview */}
            {(() => {
              const diff = editingHolding.currentValue - editingHolding.totalInvested;
              const pct = editingHolding.totalInvested > 0
                ? ((diff / editingHolding.totalInvested) * 100).toFixed(2)
                : '0.00';
              const pos = diff >= 0;
              return (
                <div style={{
                  padding: '10px 14px', borderRadius: 12,
                  background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Computed Returns</span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: pos ? 'var(--success)' : 'var(--danger)' }}>
                    {pos ? '+' : ''}{formatINR(diff)} ({pos ? '+' : ''}{pct}%)
                  </span>
                </div>
              );
            })()}

            {/* Action buttons */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 10, marginTop: 4 }}>
              <button
                onClick={() => setEditingHolding(null)}
                disabled={isSavingEdit}
                style={{
                  padding: '11px', borderRadius: 12, border: '1px solid var(--border)',
                  background: 'var(--bg-elevated)', color: 'var(--text-primary)',
                  fontWeight: 700, fontSize: 14, cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={isSavingEdit || !editingHolding.holdingName.trim()}
                style={{
                  padding: '11px', borderRadius: 12, border: 'none',
                  background: 'var(--accent-grad)', color: '#fff',
                  fontWeight: 800, fontSize: 14, cursor: isSavingEdit ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  boxShadow: '0 4px 15px rgba(124,92,252,0.3)',
                }}
              >
                {isSavingEdit ? (
                  <>
                    <RefreshCw size={15} style={{ animation: 'spin 1s linear infinite' }} />
                    <span>Saving…</span>
                  </>
                ) : (
                  <>
                    <Check size={16} />
                    <span>Save Changes</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add SIP Modal (Bottom Sheet) ── */}
      {showAddSipModal && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 1100,
            background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
            display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center',
            animation: 'fadeIn 0.2s ease-out',
          }}
          onClick={() => !isSavingSip && setShowAddSipModal(false)}
        >
          <div
            style={{
              width: '100%', maxWidth: 500, maxHeight: 'calc(100% - 24px)',
              display: 'flex', flexDirection: 'column', gap: 14,
              background: 'var(--bg-card)', color: 'var(--text-primary)',
              borderRadius: '28px 28px 0 0',
              border: '1px solid var(--border-strong)', borderBottom: 'none',
              boxShadow: '0 -10px 50px rgba(0,0,0,0.55)',
              overflowY: 'auto', WebkitOverflowScrolling: 'touch',
              padding: '0 20px calc(36px + env(safe-area-inset-bottom, 16px))',
              animation: 'slideUpSheet 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Grab Handle */}
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border-strong)', margin: '12px auto 8px auto', flexShrink: 0 }} />
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 12,
                  background: 'rgba(139,92,246,0.18)', color: '#A78BFA',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 0 16px rgba(139,92,246,0.25)',
                }}>
                  <Repeat size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0, letterSpacing: '-0.3px', color: '#fff' }}>
                    Set Up Monthly SIP
                  </h3>
                  <p style={{ fontSize: 11.5, color: 'var(--text-muted)', margin: '2px 0 0' }}>
                    Auto-increments holding value when logged
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAddSipModal(false)}
                style={{
                  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 10, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--text-secondary)', cursor: 'pointer',
                }}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateSip} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              
              {/* Asset Selector */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.6px', display: 'block', marginBottom: 6 }}>
                  Select Linked Investment Asset
                </label>
                
                {/* Scrollable interactive asset cards */}
                <div style={{
                  display: 'flex', flexDirection: 'column', gap: 6,
                  maxHeight: 145, overflowY: 'auto', paddingRight: 4,
                }}>
                  {distinctHoldings.map((h) => {
                    const key = h._id || h.holdingName;
                    const isSelected = selectedSipHoldingKey === key;
                    const typeCfg = PORTFOLIO_TYPES.find((t) => t.value === h.portfolioType) || PORTFOLIO_TYPES[0];
                    return (
                      <div
                        key={key}
                        onClick={() => {
                          setSelectedSipHoldingKey(key);
                          setNewSipName(`${h.holdingName} SIP`);
                          lightTap();
                        }}
                        style={{
                          padding: '9px 12px', borderRadius: 12, cursor: 'pointer',
                          background: isSelected ? 'rgba(139,92,246,0.18)' : 'rgba(255,255,255,0.04)',
                          border: `1.5px solid ${isSelected ? '#8B5CF6' : 'rgba(255,255,255,0.06)'}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                          <span style={{ fontSize: 14 }}>{typeCfg.icon}</span>
                          <div style={{ minWidth: 0 }}>
                            <div style={{
                              fontSize: 12.5, fontWeight: isSelected ? 800 : 600,
                              color: isSelected ? '#fff' : 'var(--text-secondary)',
                              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                            }}>
                              {h.holdingName}
                            </div>
                            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                              {typeCfg.label} · {formatINR(h.currentValue || h.totalInvested)}
                            </div>
                          </div>
                        </div>
                        {isSelected && (
                          <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#8B5CF6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <Check size={11} color="#fff" />
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Custom Option */}
                  <div
                    onClick={() => {
                      setSelectedSipHoldingKey('custom');
                      setNewSipName('Monthly SIP');
                      lightTap();
                    }}
                    style={{
                      padding: '9px 12px', borderRadius: 12, cursor: 'pointer',
                      background: selectedSipHoldingKey === 'custom' ? 'rgba(139,92,246,0.18)' : 'rgba(255,255,255,0.04)',
                      border: `1.5px solid ${selectedSipHoldingKey === 'custom' ? '#8B5CF6' : 'rgba(255,255,255,0.06)'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 14 }}>✍️</span>
                      <div>
                        <div style={{ fontSize: 12.5, fontWeight: 700, color: selectedSipHoldingKey === 'custom' ? '#fff' : 'var(--text-secondary)' }}>
                          Custom / Other Scheme
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                          Specify a custom fund or recurring investment
                        </div>
                      </div>
                    </div>
                    {selectedSipHoldingKey === 'custom' && (
                      <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#8B5CF6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Check size={11} color="#fff" />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* SIP Name Input (Compact) */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.6px', display: 'block', marginBottom: 5 }}>
                  SIP Label / Name
                </label>
                <input
                  type="text"
                  value={newSipName}
                  onChange={(e) => setNewSipName(e.target.value)}
                  placeholder="e.g. Parag Parikh Flexi Cap SIP"
                  required
                  style={{
                    width: '100%', padding: '10px 14px', borderRadius: 12,
                    background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)',
                    color: '#fff', fontSize: 13, fontWeight: 700, outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Monthly Amount with Hero Input & Quick Presets */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.6px', display: 'block', marginBottom: 6 }}>
                  Monthly SIP Amount
                </label>
                <div style={{
                  display: 'flex', alignItems: 'center',
                  background: 'rgba(0,0,0,0.35)', border: '1.5px solid rgba(139,92,246,0.4)',
                  borderRadius: 14, padding: '4px 14px',
                }}>
                  <span style={{ fontSize: 20, fontWeight: 900, color: '#A78BFA', marginRight: 8 }}>₹</span>
                  <input
                    type="number"
                    step="any"
                    value={newSipAmount}
                    onChange={(e) => setNewSipAmount(e.target.value)}
                    placeholder="25000"
                    required
                    style={{
                      width: '100%', padding: '8px 0', background: 'transparent',
                      border: 'none', color: '#fff', fontSize: 22, fontWeight: 900,
                      outline: 'none', letterSpacing: '-0.5px',
                    }}
                  />
                </div>

                {/* Quick Amount Chips */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                  {[2500, 5000, 10000, 25000, 50000].map((amt) => {
                    const active = Number(newSipAmount) === amt;
                    return (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => { setNewSipAmount(String(amt)); lightTap(); }}
                        style={{
                          padding: '5px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700,
                          cursor: 'pointer',
                          background: active ? '#8B5CF6' : 'rgba(255,255,255,0.06)',
                          color: active ? '#fff' : 'var(--text-secondary)',
                          border: `1px solid ${active ? '#8B5CF6' : 'rgba(255,255,255,0.08)'}`,
                          transition: 'all 0.15s ease',
                        }}
                      >
                        ₹{amt >= 1000 ? `${amt / 1000}k` : amt}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Day of Month Selector */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.6px', display: 'block', marginBottom: 6 }}>
                  Debit Day of Month
                </label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                  {[1, 3, 5, 10, 15, 20, 28].map((day) => {
                    const active = parseInt(newSipDay, 10) === day;
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => { setNewSipDay(String(day)); lightTap(); }}
                        style={{
                          flex: 1, minWidth: 42, padding: '7px 0', borderRadius: 10,
                          fontSize: 11.5, fontWeight: 800, cursor: 'pointer', textAlign: 'center',
                          background: active ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.05)',
                          color: active ? '#34D399' : 'var(--text-secondary)',
                          border: `1.5px solid ${active ? '#10B981' : 'rgba(255,255,255,0.08)'}`,
                        }}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Custom Day:</span>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={newSipDay}
                    onChange={(e) => setNewSipDay(e.target.value)}
                    style={{
                      width: 54, padding: '4px 8px', borderRadius: 8,
                      background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)',
                      color: '#fff', fontSize: 12, fontWeight: 800, textAlign: 'center', outline: 'none',
                    }}
                  />
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>of every month</span>
                </div>
              </div>

              {/* Dynamic Compounding Micro-Preview (Fintech Delight) */}
              {(() => {
                const amt = parseFloat(newSipAmount) || 0;
                if (amt <= 0) return null;
                // 5-year compounding estimate at 13% CAGR
                const r = 0.13 / 12;
                const fv = Math.round(amt * ((Math.pow(1 + r, 60) - 1) / r) * (1 + r));
                const totalInv = amt * 60;
                const gains = fv - totalInv;
                return (
                  <div style={{
                    padding: '10px 14px', borderRadius: 14,
                    background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.22)',
                    display: 'flex', alignItems: 'center', gap: 10,
                  }}>
                    <span style={{ fontSize: 18 }}>⚡</span>
                    <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.85)', lineHeight: 1.35 }}>
                      At 13% CAGR, this SIP will compound to <strong style={{ color: '#34D399' }}>{formatINR(fv)}</strong> in 5 years (<strong style={{ color: '#fff' }}>{formatINR(totalInv)}</strong> invested + <strong style={{ color: '#34D399' }}>+{formatINR(gains)}</strong> gains).
                    </div>
                  </div>
                );
              })()}

              {/* Actions Footer */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: 10, marginTop: 4 }}>
                <button
                  type="button"
                  onClick={() => setShowAddSipModal(false)}
                  disabled={isSavingSip}
                  style={{
                    padding: '12px', borderRadius: 14, border: '1px solid rgba(255,255,255,0.1)',
                    background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)',
                    fontWeight: 700, fontSize: 13.5, cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingSip || !newSipName.trim() || !newSipAmount}
                  style={{
                    padding: '12px', borderRadius: 14, border: 'none',
                    background: 'var(--accent-grad)', color: '#fff',
                    fontWeight: 800, fontSize: 13.5, cursor: isSavingSip ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    boxShadow: '0 6px 20px rgba(124,92,252,0.4)',
                  }}
                >
                  {isSavingSip ? (
                    <>
                      <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} />
                      <span>Saving…</span>
                    </>
                  ) : (
                    <>
                      <Check size={16} />
                      <span>Confirm SIP</span>
                    </>
                  )}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* ── Manual Add Holding (Bottom Sheet) ── */}
      {showManualModal && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 1100,
            background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
            display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center',
            animation: 'fadeIn 0.2s ease-out',
          }}
          onClick={() => !isSavingManual && setShowManualModal(false)}
        >
          <div
            style={{
              width: '100%', maxWidth: 500, maxHeight: 'calc(100% - 24px)',
              display: 'flex', flexDirection: 'column', gap: 14,
              background: 'var(--bg-card)', color: 'var(--text-primary)',
              borderRadius: '28px 28px 0 0',
              border: '1px solid var(--border-strong)', borderBottom: 'none',
              boxShadow: '0 -10px 50px rgba(0,0,0,0.55)',
              overflowY: 'auto', WebkitOverflowScrolling: 'touch',
              padding: '0 20px calc(36px + env(safe-area-inset-bottom, 16px))',
              animation: 'slideUpSheet 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Grab Handle */}
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border-strong)', margin: '12px auto 8px auto', flexShrink: 0 }} />
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 12,
                  background: manualType === 'gold' ? 'rgba(245,158,11,0.18)' : manualType === 'stocks' ? 'rgba(16,185,129,0.18)' : 'rgba(139,92,246,0.18)',
                  color: manualType === 'gold' ? '#F59E0B' : manualType === 'stocks' ? '#10B981' : '#8B5CF6',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
                }}>
                  {manualType === 'gold' ? '🪙' : manualType === 'stocks' ? '📈' : '📊'}
                </div>
                <div>
                  <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                    Add Investment
                  </h3>
                  <p style={{ fontSize: 11.5, color: 'var(--text-muted)', margin: 0 }}>
                    Manual entry with live market rate tracking
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowManualModal(false)}
                disabled={isSavingManual}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Asset Type Selector */}
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                PORTFOLIO TYPE
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                {([
                  { type: 'gold' as PortfolioType, label: '🪙 Gold', color: '#F59E0B' },
                  { type: 'mutual_funds' as PortfolioType, label: '📊 Mutual Fund', color: '#8B5CF6' },
                  { type: 'stocks' as PortfolioType, label: '📈 Stock', color: '#10B981' },
                ]).map((item) => {
                  const active = manualType === item.type;
                  return (
                    <button
                      key={item.type}
                      type="button"
                      onClick={() => {
                        setManualType(item.type);
                        if (item.type === 'gold' && (!manualName || manualName.includes('Fund') || manualName.includes('Stock'))) {
                          setManualName('24K Digital Gold');
                        }
                      }}
                      style={{
                        padding: '10px 6px', borderRadius: 12,
                        border: active ? `2px solid ${item.color}` : '1px solid var(--border)',
                        background: active ? `${item.color}18` : 'var(--bg-elevated)',
                        color: active ? item.color : 'var(--text-muted)',
                        fontWeight: active ? 800 : 500, fontSize: 12, cursor: 'pointer',
                        textAlign: 'center', transition: 'all 0.15s',
                      }}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Live Gold Rate Banner */}
            {manualType === 'gold' && (
              <div style={{
                background: 'rgba(245,158,11,0.09)', border: '1px solid rgba(245,158,11,0.25)',
                borderRadius: 12, padding: '9px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Sparkles size={14} style={{ color: '#F59E0B', flexShrink: 0 }} />
                  <span style={{ fontSize: 11.5, color: 'var(--text-primary)', fontWeight: 600 }}>
                    Live 24K Gold:{' '}
                    <strong style={{ color: '#F59E0B' }}>
                      {liveGoldRate?.ratePerGram ? formatINR(liveGoldRate.ratePerGram) + '/g' : 'Fetching…'}
                    </strong>
                    {liveGoldRate?.goldBeesPrice ? ` · ETF ₹${liveGoldRate.goldBeesPrice}` : ''}
                  </span>
                </div>
                {liveGoldRate && (
                  <button
                    type="button"
                    onClick={() => {
                      if (manualUnits && liveGoldRate.ratePerGram) {
                        const cur = Math.round(Number(manualUnits) * liveGoldRate.ratePerGram);
                        setManualCurrent(String(cur));
                      }
                    }}
                    style={{
                      background: 'none', border: 'none', color: '#F59E0B',
                      fontSize: 11, fontWeight: 700, cursor: 'pointer', textDecoration: 'underline', padding: 0,
                    }}
                  >
                    Apply Rate
                  </button>
                )}
              </div>
            )}

            {/* Holding Name & Quick Presets */}
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>
                {manualType === 'gold' ? 'GOLD ASSET NAME' : manualType === 'stocks' ? 'COMPANY / STOCK NAME' : 'MUTUAL FUND SCHEME NAME'}
              </label>
              <input
                type="text"
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
                placeholder={manualType === 'gold' ? 'e.g. 24K Digital Gold or SGB' : manualType === 'stocks' ? 'e.g. Tata Motors' : 'e.g. Parag Parikh Flexi Cap'}
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: 10,
                  background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                  color: 'var(--text-primary)', fontSize: 13.5, fontWeight: 600, outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              {/* Quick suggestion chips */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 6 }}>
                {(manualType === 'gold'
                  ? ['24K Digital Gold', 'Physical Gold (24K)', 'Gold BeES ETF', 'Sovereign Gold Bond (SGB)']
                  : manualType === 'stocks'
                  ? ['Tata Motors', 'Reliance Industries', 'HDFC Bank', 'Infosys', 'ITC']
                  : ['Parag Parikh Flexi Cap', 'Quant Small Cap', 'Nippon India Small Cap', 'SBI ELSS']
                ).map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      setManualName(preset);
                      if (preset === 'Gold BeES ETF' && liveGoldRate?.goldBeesPrice) {
                        setManualBuyPrice(String(liveGoldRate.goldBeesPrice));
                      }
                    }}
                    style={{
                      padding: '3px 8px', borderRadius: 8, fontSize: 10.5,
                      background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                      color: 'var(--text-secondary)', cursor: 'pointer',
                    }}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            {/* MMTC-PAMP Tag Toggle if Gold */}
            {manualType === 'gold' && (
              <label style={{
                display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
                padding: '10px 14px', borderRadius: 12,
                background: isManualMmtc ? 'rgba(234,179,8,0.14)' : 'var(--bg-elevated)',
                border: `1.5px solid ${isManualMmtc ? '#EAB308' : 'var(--border)'}`,
                transition: 'all 0.15s ease',
              }}>
                <input
                  type="checkbox"
                  checked={isManualMmtc}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setIsManualMmtc(checked);
                    if (checked) {
                      if (!manualName || manualName === '24K Digital Gold') {
                        setManualName('MMTC PAMP Physical Gold (24K)');
                      }
                      if (liveGoldRate?.mmtcPampRatePerGram) {
                        setManualBuyPrice(String(liveGoldRate.mmtcPampRatePerGram));
                        const u = parseFloat(manualUnits) || 0;
                        if (u > 0) {
                          const total = Math.round(u * liveGoldRate.mmtcPampRatePerGram);
                          setManualInvested(String(total));
                          setManualCurrent(String(total));
                        }
                      }
                    }
                  }}
                  style={{ width: 17, height: 17, accentColor: '#EAB308', cursor: 'pointer' }}
                />
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 800, color: '#FACC15', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span>💎 MMTC-PAMP 999.9 CertiCard Purest Gold</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                    Tracks live MMTC-PAMP retail rate ({liveGoldRate?.mmtcPampRatePerGram ? `₹${liveGoldRate.mmtcPampRatePerGram.toLocaleString('en-IN')}/g` : '~₹16,814/g'}) with minting charges.
                  </div>
                </div>
              </label>
            )}

            {/* Units / Grams & Buy Price inputs */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>
                  {manualType === 'gold' ? 'WEIGHT (GRAMS)' : manualType === 'stocks' ? 'SHARES / QUANTITY' : 'REDEEMABLE UNITS'}
                </label>
                <input
                  type="number"
                  step="any"
                  value={manualUnits}
                  onChange={(e) => {
                    const u = e.target.value;
                    setManualUnits(u);
                    const numU = parseFloat(u);
                    const numB = parseFloat(manualBuyPrice);
                    if (!isNaN(numU) && !isNaN(numB) && numU > 0 && numB > 0) {
                      const totalInv = Math.round(numU * numB);
                      setManualInvested(String(totalInv));
                      if (manualType === 'gold' && liveGoldRate?.ratePerGram) {
                        setManualCurrent(String(Math.round(numU * liveGoldRate.ratePerGram)));
                      }
                    }
                  }}
                  placeholder={manualType === 'gold' ? 'e.g. 5.00' : 'e.g. 10'}
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: 10,
                    background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                    color: 'var(--text-primary)', fontSize: 13.5, fontWeight: 700, outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>
                  {manualType === 'gold' ? 'PURCHASE RATE (₹/g)' : manualType === 'stocks' ? 'BUY PRICE / SHARE (₹)' : 'AVG NAV (₹)'}
                </label>
                <input
                  type="number"
                  step="any"
                  value={manualBuyPrice}
                  onChange={(e) => {
                    const b = e.target.value;
                    setManualBuyPrice(b);
                    const numB = parseFloat(b);
                    const numU = parseFloat(manualUnits);
                    if (!isNaN(numU) && !isNaN(numB) && numU > 0 && numB > 0) {
                      const totalInv = Math.round(numU * numB);
                      setManualInvested(String(totalInv));
                      if (manualType === 'gold' && liveGoldRate?.ratePerGram) {
                        setManualCurrent(String(Math.round(numU * liveGoldRate.ratePerGram)));
                      }
                    }
                  }}
                  placeholder={manualType === 'gold' ? (liveGoldRate?.ratePerGram ? String(liveGoldRate.ratePerGram) : '15795') : '0'}
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: 10,
                    background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                    color: 'var(--text-primary)', fontSize: 13.5, fontWeight: 700, outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            {/* Total Invested & Current Value */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>
                    TOTAL INVESTED (₹) *
                  </label>
                  <span style={{ fontSize: 10, color: 'var(--accent-2)', fontWeight: 600 }}>Editable</span>
                </div>
                <input
                  type="number"
                  step="any"
                  value={manualInvested}
                  onChange={(e) => setManualInvested(e.target.value)}
                  placeholder="0"
                  required
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: 10,
                    background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                    color: 'var(--text-primary)', fontSize: 14, fontWeight: 700, outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>
                  Auto-calculated: Units × Avg NAV (feel free to edit)
                </div>
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>
                  CURRENT VALUE (₹) *
                </label>
                <input
                  type="number"
                  step="any"
                  value={manualCurrent}
                  onChange={(e) => setManualCurrent(e.target.value)}
                  placeholder={manualInvested || '0'}
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: 10,
                    background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                    color: 'var(--text-primary)', fontSize: 14, fontWeight: 700, outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            {/* Purchase Date and Purchase Time */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 10 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>
                  PURCHASE DATE
                </label>
                <input
                  type="date"
                  value={manualDate}
                  onChange={(e) => setManualDate(e.target.value)}
                  style={{
                    width: '100%', padding: '9px 10px', borderRadius: 10,
                    background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                    color: 'var(--text-primary)', fontSize: 13, outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>
                  TIME (HH:MM)
                </label>
                <input
                  type="time"
                  value={manualTime}
                  onChange={(e) => setManualTime(e.target.value)}
                  style={{
                    width: '100%', padding: '9px 10px', borderRadius: 10,
                    background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                    color: 'var(--text-primary)', fontSize: 13, outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            {/* Computed Gain preview */}
            {manualInvested && manualCurrent && (() => {
              const inv = Number(manualInvested) || 0;
              const cur = Number(manualCurrent) || 0;
              const diff = cur - inv;
              const pct = inv > 0 ? ((diff / inv) * 100).toFixed(2) : '0.00';
              const pos = diff >= 0;
              return (
                <div style={{
                  padding: '9px 12px', borderRadius: 10,
                  background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Estimated P&amp;L</span>
                  <span style={{ fontSize: 12.5, fontWeight: 800, color: pos ? 'var(--success)' : 'var(--danger)' }}>
                    {pos ? '+' : ''}{formatINR(diff)} ({pos ? '+' : ''}{pct}%)
                  </span>
                </div>
              );
            })()}

            {/* Sync Net Worth Toggle */}
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, color: 'var(--text-secondary)' }}>
              <input
                type="checkbox"
                checked={manualSyncNetWorth}
                onChange={(e) => setManualSyncNetWorth(e.target.checked)}
                style={{ accentColor: 'var(--accent)', width: 16, height: 16 }}
              />
              <span>Automatically update Net Worth under &quot;{getTypeCfg(manualType).netWorthCategory}&quot;</span>
            </label>

            {/* Modal Actions */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 10, marginTop: 4 }}>
              <button
                type="button"
                onClick={() => setShowManualModal(false)}
                disabled={isSavingManual}
                style={{
                  padding: '11px', borderRadius: 12, border: '1px solid var(--border)',
                  background: 'var(--bg-elevated)', color: 'var(--text-primary)',
                  fontWeight: 700, fontSize: 13.5, cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveManual}
                disabled={isSavingManual || !manualName.trim() || !manualInvested}
                style={{
                  padding: '11px', borderRadius: 12, border: 'none',
                  background: manualType === 'gold'
                    ? 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)'
                    : 'var(--accent-grad)',
                  color: '#fff',
                  fontWeight: 800, fontSize: 13.5, cursor: isSavingManual ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  boxShadow: manualType === 'gold' ? '0 4px 15px rgba(245,158,11,0.3)' : '0 4px 15px rgba(124,92,252,0.3)',
                }}
              >
                {isSavingManual ? (
                  <>
                    <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} />
                    <span>Adding…</span>
                  </>
                ) : (
                  <>
                    <Check size={15} />
                    <span>Save Investment</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
