'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  TrendingUp, Camera, Trash2, ArrowLeft, Check,
  RefreshCw, AlertCircle, ArrowUpRight, ArrowDownRight,
  X, Cpu, Layers, Tag, Globe, Sparkles, Pencil,
  Repeat, Plus, Calendar, CheckCircle2
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid
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
  const [liveGoldRate, setLiveGoldRate] = useState<{ ratePerGram: number; goldBeesPrice: number; prevClose: number } | null>(null);
  const [isLoadingLiveGold, setIsLoadingLiveGold] = useState(false);

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
        const key = s.holdingName.trim();
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
    setNewSipAmount(investmentCategory?.budget ? String(investmentCategory.budget) : '25000');
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
    <div style={{ minHeight: '100vh', background: 'var(--bg)', paddingBottom: 90 }}>
      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />

      {/* ── Toast Banner ─────────────────────────────────────────────── */}
      {syncToast && (
        <div style={{
          position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)',
          zIndex: 2000, background: 'rgba(16,185,129,0.95)', backdropFilter: 'blur(10px)',
          color: '#fff', padding: '10px 20px', borderRadius: 12, fontWeight: 700,
          fontSize: 13, display: 'flex', alignItems: 'center', gap: 8,
          boxShadow: '0 8px 30px rgba(0,0,0,0.3)',
        }}>
          <Sparkles size={16} />
          <span>{syncToast}</span>
        </div>
      )}

      {/* ── Header ───────────────────────────────────────────────────── */}
      <div style={{ padding: '20px 16px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => router.push('/reports')} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)', width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Investments & Groww</h1>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>Live Market NAVs · On-device OCR</p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Manual Add Holding Button */}
          <button
            onClick={() => {
              setManualType('gold');
              setManualName('24K Digital Gold');
              setManualUnits('');
              setManualBuyPrice('');
              setManualInvested('');
              setManualCurrent('');
              setManualDate(new Date().toISOString().split('T')[0]);
              setManualTime(new Date().toTimeString().slice(0, 5));
              setShowManualModal(true);
              fetchLiveGold();
            }}
            title="Manually add a stock, mutual fund or gold holding"
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              background: 'rgba(245,158,11,0.12)',
              color: '#F59E0B', border: '1px solid rgba(245,158,11,0.3)',
              padding: '8px 12px', borderRadius: 12, fontWeight: 700, fontSize: 12.5,
              cursor: 'pointer',
            }}
          >
            <Plus size={15} />
            <span>+ Add</span>
          </button>

          {/* Live Sync Button */}
          <button
            onClick={handleSyncLive}
            disabled={isSyncingLive || distinctHoldings.length === 0}
            title="Fetch today's live NAV, Stock & Gold prices"
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'rgba(16,185,129,0.12)',
              color: '#10B981', border: '1px solid rgba(16,185,129,0.25)',
              padding: '8px 12px', borderRadius: 12, fontWeight: 700, fontSize: 12.5,
              cursor: isSyncingLive ? 'not-allowed' : 'pointer',
            }}
          >
            {isSyncingLive ? (
              <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} />
            ) : (
              <Globe size={14} />
            )}
            <span>{isSyncingLive ? 'Syncing…' : 'Live Sync'}</span>
          </button>

          {/* Upload Button */}
          <button onClick={() => fileInputRef.current?.click()} disabled={isOcrRunning} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: isOcrRunning ? 'var(--bg-elevated)' : 'var(--accent-grad)',
            color: isOcrRunning ? 'var(--text-muted)' : '#fff',
            border: isOcrRunning ? '1px solid var(--border)' : 'none',
            padding: '8px 14px', borderRadius: 12, fontWeight: 700, fontSize: 13,
            cursor: isOcrRunning ? 'not-allowed' : 'pointer',
            boxShadow: isOcrRunning ? 'none' : '0 4px 14px rgba(124,92,252,0.3)',
          }}>
            {isOcrRunning
              ? <><RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /><span style={{ fontSize: 11 }}>{ocrStatusLabel[ocrStatus]}</span></>
              : <><Camera size={15} /><span>Upload</span></>}
          </button>
        </div>
      </div>

      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* ── Live Market Auto-Sync Banner ─────────────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '9px 14px', borderRadius: 12, background: 'rgba(16,185,129,0.08)',
          border: '1px solid rgba(16,185,129,0.2)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10B981', boxShadow: '0 0 8px #10B981' }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: '#10B981' }}>
              Live Market Sync Enabled (AMFI, NSE &amp; Gold)
            </span>
          </div>
          <button
            onClick={handleSyncLive}
            disabled={isSyncingLive}
            style={{
              background: 'none', border: 'none', color: '#10B981',
              fontSize: 11.5, fontWeight: 800, cursor: 'pointer', padding: 0,
              textDecoration: 'underline',
            }}
          >
            Refresh Now
          </button>
        </div>

        {/* ── Overall Portfolio Hero ────────────────────────────────── */}
        <div style={{
          background: 'linear-gradient(145deg, var(--bg-card) 0%, rgba(26,26,42,0.9) 100%)',
          border: '1px solid var(--border)', borderRadius: 20, padding: '20px',
          position: 'relative', overflow: 'hidden', boxShadow: '0 8px 28px rgba(0,0,0,0.22)',
        }}>
          <div style={{ position: 'absolute', top: -40, right: -40, width: 140, height: 140, borderRadius: '50%', background: isPositive ? 'radial-gradient(circle, rgba(16,185,129,0.22) 0%, transparent 70%)' : 'radial-gradient(circle, rgba(239,68,68,0.22) 0%, transparent 70%)', pointerEvents: 'none' }} />

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(139,92,246,0.15)', color: '#8B5CF6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Layers size={18} />
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Portfolio Value</span>
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent-2)', background: 'var(--accent-dim)', padding: '3px 8px', borderRadius: 8 }}>
              {distinctHoldings.length} holding{distinctHoldings.length !== 1 ? 's' : ''}
            </span>
          </div>

          <div style={{ fontSize: 32, fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.8px' }}>
            {formatINR(totalCurrentValue)}
          </div>

          {/* Returns Badges (Total & Today's 1D) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '3px 9px', borderRadius: 999, fontWeight: 700, fontSize: 12,
              background: isPositive ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
              color: isPositive ? 'var(--success)' : 'var(--danger)',
              border: `1px solid ${isPositive ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`,
            }}>
              {isPositive ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
              {isPositive ? '+' : ''}{formatINR(totalGain)} ({isPositive ? '+' : ''}{totalGainPct}%) Total
            </div>

            {(latest1D.gain !== 0 || latest1D.percent !== 0) && (
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '3px 9px', borderRadius: 999, fontWeight: 700, fontSize: 12,
                background: latest1D.gain >= 0 ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
                color: latest1D.gain >= 0 ? 'var(--success)' : 'var(--danger)',
                border: `1px solid ${latest1D.gain >= 0 ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`,
              }}>
                {latest1D.gain >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                {latest1D.gain >= 0 ? '+' : ''}{latest1D.gain ? formatINR(latest1D.gain) + ' ' : ''}
                ({latest1D.gain >= 0 ? '+' : ''}{latest1D.percent}%) 1D Today
              </div>
            )}
          </div>

          <div style={{ height: 1, background: 'var(--border)', margin: '14px 0' }} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8 }}>
            <div>
              <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginBottom: 2 }}>Invested</div>
              <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--text-primary)' }}>{formatINR(totalInvested)}</div>
            </div>
            <div>
              <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginBottom: 2 }}>MF</div>
              <div style={{ fontSize: 13.5, fontWeight: 800, color: '#8B5CF6' }}>{mfHoldings.length}</div>
            </div>
            <div>
              <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginBottom: 2 }}>Stocks</div>
              <div style={{ fontSize: 13.5, fontWeight: 800, color: '#10B981' }}>{stockHoldings.length}</div>
            </div>
            <div>
              <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginBottom: 2 }}>Gold</div>
              <div style={{ fontSize: 13.5, fontWeight: 800, color: '#F59E0B' }}>{goldHoldings.length}</div>
            </div>
          </div>
        </div>

        {/* ── Upload & Manual Bar ───────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 10 }}>
          <div onClick={() => !isOcrRunning && fileInputRef.current?.click()} style={{
            background: 'var(--bg-card)', border: '1.5px dashed var(--accent)', borderRadius: 16,
            padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10,
            cursor: isOcrRunning ? 'not-allowed' : 'pointer',
          }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--accent-dim)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {isOcrRunning ? <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <Camera size={18} />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {isOcrRunning ? ocrStatusLabel[ocrStatus] : 'Upload Groww'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Scan screenshot</div>
            </div>
          </div>

          <button
            onClick={() => {
              setManualType('gold');
              setManualName('24K Digital Gold');
              setManualUnits('');
              setManualBuyPrice('');
              setManualInvested('');
              setManualCurrent('');
              setManualDate(new Date().toISOString().split('T')[0]);
              setManualTime(new Date().toTimeString().slice(0, 5));
              setShowManualModal(true);
              fetchLiveGold();
            }}
            style={{
              background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)',
              borderRadius: 16, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10,
              cursor: 'pointer', textAlign: 'left',
            }}
          >
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(245,158,11,0.18)', color: '#F59E0B', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 18 }}>
              🪙
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)' }}>+ Add Manual</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Gold, MF, Stock</div>
            </div>
          </button>
        </div>

        {/* ── Tracked Individual Holdings Section ───────────────────── */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 18, padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(139,92,246,0.15)', color: '#8B5CF6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Tag size={15} />
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>Tracked Holdings</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>AMFI, NSE &amp; Live Gold Market</div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{distinctHoldings.length} total</span>
              {distinctHoldings.length > 0 && (
                <button
                  onClick={handleClearAll}
                  style={{
                    background: 'none', border: 'none', color: 'var(--danger)',
                    fontSize: 11.5, fontWeight: 700, cursor: 'pointer', padding: 0,
                  }}
                >
                  Clear All
                </button>
              )}
            </div>
          </div>

          {distinctHoldings.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              No holdings added yet. Tap &quot;+ Add&quot; or &quot;Upload&quot; to begin tracking!
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {distinctHoldings.map((h) => {
                const pos = h.totalGain >= 0;
                const isStock = h.portfolioType === 'stocks';
                const isGold = h.portfolioType === 'gold';
                const typeCfg = PORTFOLIO_TYPES.find((t) => t.value === h.portfolioType) || PORTFOLIO_TYPES[0];
                const unitLabel = isGold ? 'g' : isStock ? 'shares' : 'units';

                return (
                  <div key={h.holdingName || h._id} style={{
                    padding: '14px', borderRadius: 14,
                    background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                    borderLeft: `4px solid ${typeCfg.color}`,
                  }}>
                    {/* Header: Name + Edit + Delete */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.3 }}>
                          {h.holdingName || (isStock ? 'Stock Holding' : isGold ? 'Gold Investment' : 'Mutual Fund Scheme')}
                        </div>
                        <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 700, color: typeCfg.color }}>{typeCfg.icon} {typeCfg.label}</span>
                          {h.units && h.units > 0 && (
                            <span>• {h.units} {unitLabel}</span>
                          )}
                          {h.buyPrice && h.buyPrice > 0 && (
                            <span>@ {formatINR(h.buyPrice)}{isGold ? '/g' : ''}</span>
                          )}
                          {h.purchaseTime && (
                            <span>• {h.purchaseTime}</span>
                          )}
                          {!h.purchaseTime && h.date && (
                            <span>• Synced {h.date}</span>
                          )}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
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
                          })}
                          style={{
                            background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)',
                            color: 'var(--text-secondary)', padding: '6px 8px', cursor: 'pointer',
                            borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}
                          title="Edit holding"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => setHoldingToDelete({ id: h._id, name: h.holdingName || 'Holding', fundName: h.fundName })}
                          style={{
                            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                            color: 'var(--danger)', padding: '6px 8px', cursor: 'pointer',
                            borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}
                          title="Delete holding"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>

                    {/* Metrics grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, paddingTop: 6, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                      <div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Invested</div>
                        <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', marginTop: 1 }}>{formatINR(h.totalInvested)}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Current</div>
                        <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', marginTop: 1 }}>{formatINR(h.currentValue)}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Returns</div>
                        <div style={{ fontSize: 12.5, fontWeight: 800, color: pos ? 'var(--success)' : 'var(--danger)', marginTop: 1 }}>
                          {pos ? '+' : ''}{formatINR(h.totalGain)}
                          <span style={{ fontSize: 10.5, opacity: 0.85, marginLeft: 2 }}>({pos ? '+' : ''}{h.gainPercent}%)</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Monthly SIP & Auto-Deduct Section ─────────────────────────── */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 18, padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: 'rgba(139,92,246,0.15)', color: '#8B5CF6',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Repeat size={18} />
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>
                  Monthly SIP Plan &amp; Auto-Log
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                  {investmentCategory?.budget
                    ? `Fixed budget: ${formatINR(investmentCategory.budget)}/month`
                    : 'Track recurring SIP deductions in history'}
                </div>
              </div>
            </div>
            <button
              onClick={() => openSipModal()}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '7px 12px', borderRadius: 10,
                background: 'var(--accent)', color: '#fff', border: 'none',
                fontSize: 12, fontWeight: 700, cursor: 'pointer',
              }}
            >
              <Plus size={14} />
              <span>Add SIP</span>
            </button>
          </div>

          {/* Prompt if any SIP is due this month */}
          {(() => {
            const dueSips = investmentSips.filter(s => s.isActive && s.lastLoggedMonth !== currentYM);
            if (dueSips.length === 0) return null;
            return (
              <div style={{
                marginBottom: 12, padding: '12px 14px', borderRadius: 12,
                background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
              }}>
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: '#F59E0B' }}>
                    ⚡ Money deducted this month?
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                    {dueSips.length} SIP{dueSips.length > 1 ? 's' : ''} ready to log into expense history
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

          {/* SIP list */}
          {investmentSips.length === 0 ? (
            <div style={{
              padding: '18px 14px', textAlign: 'center', background: 'var(--bg-elevated)',
              borderRadius: 14, color: 'var(--text-muted)', fontSize: 12.5,
            }}>
              <p style={{ margin: '0 0 10px' }}>
                No recurring SIPs added yet. Set your fixed monthly SIP (e.g. ₹25,000) so you can record it in expense history with 1 tap once money deducts.
              </p>
              <button
                onClick={() => openSipModal()}
                style={{
                  padding: '8px 14px', borderRadius: 10, border: '1px solid var(--accent)',
                  background: 'rgba(139,92,246,0.12)', color: 'var(--accent-2)',
                  fontSize: 12, fontWeight: 700, cursor: 'pointer',
                }}
              >
                + Set Up ₹{investmentCategory?.budget ? investmentCategory.budget.toLocaleString('en-IN') : '25,000'} Monthly SIP
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {investmentSips.map((sip) => {
                const isLoggedThisMonth = sip.lastLoggedMonth === currentYM;
                const isLogging = loggingSipId === sip.id;
                return (
                  <div key={sip.id} style={{
                    padding: '11px 14px', borderRadius: 12,
                    background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                  }}>
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
                          <span style={{ color: '#F59E0B', fontWeight: 600 }}>
                            Due this month
                          </span>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>
                        {formatINR(sip.amount)}
                      </span>
                      {!isLoggedThisMonth ? (
                        <button
                          onClick={() => handleLogSip(sip)}
                          disabled={isLogging}
                          title="Record deduction to history"
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

        {/* ── Monthly SIP Chart ─────────────────────────────────────── */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 18, padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>Monthly SIP Debits</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>From your Investment expense category</div>
            </div>
            <Link href="/expenses" style={{ fontSize: 12, color: 'var(--accent-2)', textDecoration: 'none', fontWeight: 600 }}>View Log →</Link>
          </div>
          {monthlySipData.length > 0 ? (
            <div style={{ height: 150, width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlySipData} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="label" stroke="var(--text-muted)" fontSize={11} tickLine={false} />
                  <YAxis stroke="var(--text-muted)" fontSize={10} tickLine={false} tickFormatter={(v) => `₹${v / 1000}k`} />
                  <Tooltip content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    return (
                      <div style={{ background: 'rgba(20,20,30,0.95)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 12px', fontSize: 12 }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-muted)' }}>{label}</div>
                        <div style={{ fontWeight: 800, color: 'var(--accent-2)', fontSize: 14 }}>{formatINR(Number(payload[0].value))}</div>
                      </div>
                    );
                  }} />
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

        {/* ── Recent Logged SIPs ────────────────────────────────────── */}
        {investmentExpenses.length > 0 && (
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 18, padding: '16px' }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 12 }}>Recent Investment Debits</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {investmentExpenses.slice(0, 5).map((exp) => (
                <div key={exp._id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: 12, background: 'var(--bg-elevated)', borderLeft: '3.5px solid #8B5CF6' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{exp.note || 'Mutual Fund / SIP'}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{exp.date}</div>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>{formatINR(exp.amount)}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Review Modal ──────────────────────────────────────────────────── */}
      {showReviewModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
          onClick={() => { setShowReviewModal(false); setOcrStatus('idle'); }}>
          <div style={{ background: 'var(--bg-card)', borderTopLeftRadius: 28, borderTopRightRadius: 28, border: '1px solid var(--border)', borderBottom: 'none', width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto', padding: '20px 20px 40px' }}
            onClick={(e) => e.stopPropagation()}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border-strong)', margin: '0 auto 16px' }} />

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

      {/* ── Custom Delete Confirmation Modal ── */}
      {holdingToDelete && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 1100,
            background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
          }}
          onClick={() => !isDeleting && setHoldingToDelete(null)}
        >
          <div
            style={{
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 20, padding: 22, width: '100%', maxWidth: 360,
              boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: 'rgba(239,68,68,0.12)', color: 'var(--danger)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: 14,
            }}>
              <Trash2 size={22} />
            </div>
            <h3 style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 6px' }}>
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
                  padding: '11px', borderRadius: 12, border: '1px solid var(--border)',
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
                  padding: '11px', borderRadius: 12, border: 'none',
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

      {/* ── Custom Edit Holding Modal ── */}
      {editingHolding && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 1100,
            background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
          }}
          onClick={() => !isSavingEdit && setEditingHolding(null)}
        >
          <div
            style={{
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 20, padding: 22, width: '100%', maxWidth: 420,
              boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
              display: 'flex', flexDirection: 'column', gap: 14,
            }}
            onClick={(e) => e.stopPropagation()}
          >
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

      {/* ── Add SIP Modal ── */}
      {showAddSipModal && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 1100,
            background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
          }}
          onClick={() => !isSavingSip && setShowAddSipModal(false)}
        >
          <div
            style={{
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 20, padding: 22, width: '100%', maxWidth: 380,
              boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
              display: 'flex', flexDirection: 'column', gap: 14,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: 'rgba(139,92,246,0.15)', color: '#8B5CF6',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Repeat size={18} />
                </div>
                <div>
                  <h3 style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                    Add Monthly SIP
                  </h3>
                  <p style={{ fontSize: 11.5, color: 'var(--text-muted)', margin: 0 }}>
                    Auto-tracked in Investment category
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAddSipModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateSip} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Dropdown to pick from tracked Mutual Funds, Stocks, or Gold */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>
                  LINK TO INVESTED ASSET (MUTUAL FUND / STOCK / GOLD)
                </label>
                <select
                  value={selectedSipHoldingKey}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedSipHoldingKey(val);
                    if (val === 'custom') {
                      setNewSipName('');
                    } else {
                      const found = distinctHoldings.find((h) => (h._id || h.holdingName) === val);
                      if (found) {
                        setNewSipName(`${found.holdingName} SIP`);
                      }
                    }
                  }}
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: 10,
                    background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                    color: 'var(--text-primary)', fontSize: 13.5, fontWeight: 700, outline: 'none',
                    boxSizing: 'border-box', cursor: 'pointer',
                  }}
                >
                  <option value="" disabled>-- Select a Mutual Fund, Stock, or Gold --</option>
                  {mfHoldings.length > 0 && (
                    <optgroup label="📊 Mutual Funds">
                      {mfHoldings.map((h) => (
                        <option key={h._id || h.holdingName} value={h._id || h.holdingName}>
                          {h.holdingName} ({formatINR(h.currentValue || h.totalInvested)})
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {stockHoldings.length > 0 && (
                    <optgroup label="📈 Stocks &amp; Equity">
                      {stockHoldings.map((h) => (
                        <option key={h._id || h.holdingName} value={h._id || h.holdingName}>
                          {h.holdingName} ({formatINR(h.currentValue || h.totalInvested)})
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {goldHoldings.length > 0 && (
                    <optgroup label="🪙 Gold">
                      {goldHoldings.map((h) => (
                        <option key={h._id || h.holdingName} value={h._id || h.holdingName}>
                          {h.holdingName} ({formatINR(h.currentValue || h.totalInvested)})
                        </option>
                      ))}
                    </optgroup>
                  )}
                  <option value="custom">✍️ Custom Name (Other / New SIP)</option>
                </select>
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>
                    SIP / SCHEME NAME
                  </label>
                  <span style={{ fontSize: 10, color: 'var(--accent-2)', fontWeight: 600 }}>Editable</span>
                </div>
                <input
                  type="text"
                  value={newSipName}
                  onChange={(e) => setNewSipName(e.target.value)}
                  placeholder="e.g. SBI ELSS SIP or Monthly SIP"
                  required
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: 10,
                    background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                    color: 'var(--text-primary)', fontSize: 13.5, fontWeight: 600, outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>
                    MONTHLY AMOUNT (₹)
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={newSipAmount}
                    onChange={(e) => setNewSipAmount(e.target.value)}
                    placeholder="25000"
                    required
                    style={{
                      width: '100%', padding: '10px 12px', borderRadius: 10,
                      background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                      color: 'var(--text-primary)', fontSize: 14, fontWeight: 700, outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>
                    DEDUCT DAY (1-31)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={newSipDay}
                    onChange={(e) => setNewSipDay(e.target.value)}
                    placeholder="3"
                    required
                    style={{
                      width: '100%', padding: '10px 12px', borderRadius: 10,
                      background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                      color: 'var(--text-primary)', fontSize: 14, fontWeight: 700, outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>

              {/* Quick tap chips for all tracked holdings */}
              {distinctHoldings.length > 0 && (
                <div>
                  <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginBottom: 5 }}>
                    Or tap to select:
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 110, overflowY: 'auto', paddingBottom: 2 }}>
                    {distinctHoldings.map((h) => {
                      const isSelected = selectedSipHoldingKey === (h._id || h.holdingName);
                      const icon = h.portfolioType === 'gold' ? '🪙' : h.portfolioType === 'stocks' ? '📈' : '📊';
                      return (
                        <button
                          key={h.holdingName || h._id}
                          type="button"
                          onClick={() => {
                            const key = h._id || h.holdingName;
                            setSelectedSipHoldingKey(key);
                            setNewSipName(`${h.holdingName} SIP`);
                          }}
                          style={{
                            padding: '5px 9px', borderRadius: 8, fontSize: 11,
                            fontWeight: isSelected ? 700 : 500,
                            background: isSelected ? 'var(--accent)' : 'var(--bg-elevated)',
                            color: isSelected ? '#fff' : 'var(--text-secondary)',
                            border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                            cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4,
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <span>{icon}</span>
                          <span>{h.holdingName}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: 10, marginTop: 6 }}>
                <button
                  type="button"
                  onClick={() => setShowAddSipModal(false)}
                  disabled={isSavingSip}
                  style={{
                    padding: '11px', borderRadius: 12, border: '1px solid var(--border)',
                    background: 'var(--bg-elevated)', color: 'var(--text-primary)',
                    fontWeight: 700, fontSize: 13.5, cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingSip || !newSipName.trim() || !newSipAmount}
                  style={{
                    padding: '11px', borderRadius: 12, border: 'none',
                    background: 'var(--accent-grad)', color: '#fff',
                    fontWeight: 800, fontSize: 13.5, cursor: isSavingSip ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    boxShadow: '0 4px 15px rgba(124,92,252,0.3)',
                  }}
                >
                  {isSavingSip ? (
                    <>
                      <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} />
                      <span>Saving…</span>
                    </>
                  ) : (
                    <>
                      <Check size={15} />
                      <span>Save SIP</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Manual Add Holding Modal ── */}
      {showManualModal && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 1100,
            background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
          }}
          onClick={() => !isSavingManual && setShowManualModal(false)}
        >
          <div
            style={{
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 22, padding: 22, width: '100%', maxWidth: 440,
              maxHeight: '92vh', overflowY: 'auto',
              boxShadow: '0 12px 48px rgba(0,0,0,0.5)',
              display: 'flex', flexDirection: 'column', gap: 14,
            }}
            onClick={(e) => e.stopPropagation()}
          >
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
