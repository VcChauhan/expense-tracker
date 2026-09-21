'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  TrendingUp, Camera, Trash2, ArrowLeft, Check,
  RefreshCw, AlertCircle, ArrowUpRight, ArrowDownRight,
  X, Cpu, Layers, Tag, ChevronRight
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid
} from 'recharts';
import { formatINR, InvestmentFund, Expense, Settings, SHORT_MONTHS, PortfolioType } from '@/lib/types';
import { parseGrowwOcrText } from '@/lib/parseGrowwOcr';
import { lightTap, successBuzz, mediumTap } from '@/lib/haptics';

type ReviewData = {
  holdingName: string;
  date: string;
  totalInvested: number;
  currentValue: number;
  portfolioType: PortfolioType;
  funds: InvestmentFund[];
};

type OcrStatus = 'idle' | 'preprocessing' | 'loading-worker' | 'ocr' | 'parsing' | 'done' | 'error';

// ── Portfolio types config ───────────────────────────────────────────────
const PORTFOLIO_TYPES: { value: PortfolioType; label: string; icon: string; color: string; netWorthCategory: string }[] = [
  { value: 'mutual_funds', label: 'Mutual Funds', icon: '📊', color: '#8B5CF6', netWorthCategory: 'Mutual Funds' },
  { value: 'stocks',       label: 'Stocks',        icon: '📈', color: '#10B981', netWorthCategory: 'Stocks & Equity' },
  { value: 'combined',     label: 'Combined',      icon: '🗂️', color: '#3B82F6', netWorthCategory: 'Investments' },
];

function getTypeCfg(type: PortfolioType) {
  return PORTFOLIO_TYPES.find((t) => t.value === type) || PORTFOLIO_TYPES[0];
}

// ── Client-side image preprocessor for crisp OCR ─────────────────────────
// Groww uses teal (#00D09C) on white for fund names and returns.
// In the red channel, white is 255 and teal is 0, giving extreme contrast!
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
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  // ── Derived stats ─────────────────────────────────────────────────────
  const investmentCatId = useMemo(() =>
    settings?.categories?.find((c) =>
      c.name.toLowerCase().includes('invest') || c.name.toLowerCase().includes('sip')
    )?.id ?? null, [settings]);

  const investmentExpenses = useMemo(() =>
    expenses.filter((e) =>
      e.categoryId === investmentCatId ||
      (e.note || '').toLowerCase().includes('sip') ||
      (e.note || '').toLowerCase().includes('groww')
    ), [expenses, investmentCatId]);

  const accumulatedFromExpenses = useMemo(() =>
    investmentExpenses.reduce((s, e) => s + (e.amount || 0), 0), [investmentExpenses]);

  const monthlySipData = useMemo(() => {
    const map: Record<string, number> = {};
    investmentExpenses.forEach((exp) => {
      if (!exp.date) return;
      const key = exp.date.substring(0, 7);
      map[key] = (map[key] || 0) + exp.amount;
    });
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0])).slice(-6).map(([key, total]) => {
      const [y, m] = key.split('-');
      return { label: `${SHORT_MONTHS[parseInt(m, 10) - 1]} ${y.slice(2)}`, amount: total };
    });
  }, [investmentExpenses]);

  // Group snapshots: distinct latest holdings
  // If user uploaded SBI ELSS multiple times, pick the latest one for each holdingName
  const distinctHoldings = useMemo(() => {
    const map = new Map<string, any>();
    snapshots.forEach((s) => {
      const key = s.holdingName?.trim() || `unnamed_${s._id}`;
      if (!map.has(key)) {
        map.set(key, s);
      }
    });
    return Array.from(map.values());
  }, [snapshots]);

  // Total Portfolio Metrics
  const totalCurrentValue = useMemo(() => {
    if (distinctHoldings.length > 0) {
      return distinctHoldings.reduce((sum, h) => sum + (h.currentValue || 0), 0);
    }
    return accumulatedFromExpenses;
  }, [distinctHoldings, accumulatedFromExpenses]);

  const totalInvested = useMemo(() => {
    if (distinctHoldings.length > 0) {
      return distinctHoldings.reduce((sum, h) => sum + (h.totalInvested || 0), 0);
    }
    return accumulatedFromExpenses;
  }, [distinctHoldings, accumulatedFromExpenses]);

  const totalGain = totalCurrentValue - totalInvested;
  const totalGainPct = totalInvested > 0 ? Number(((totalGain / totalInvested) * 100).toFixed(2)) : 0;
  const isPositive = totalGain >= 0;

  // Split by category
  const mfHoldings = distinctHoldings.filter((h) => h.portfolioType === 'mutual_funds');
  const stockHoldings = distinctHoldings.filter((h) => h.portfolioType === 'stocks');

  // ── On-Device OCR with Preprocessing ──────────────────────────────────
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    mediumTap();
    setOcrError(null);
    setOcrStatus('preprocessing');
    setOcrProgress(0);

    try {
      // 1. High contrast red-channel separation
      const processedBlob = await preprocessImageForOcr(file);

      // 2. Load Tesseract.js WASM
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

      // 3. Smart Regex Parsing
      setOcrStatus('parsing');
      const parsed = parseGrowwOcrText(text);

      setReviewData({
        holdingName: parsed.holdingName || '',
        date: new Date().toISOString().split('T')[0],
        totalInvested: parsed.totalInvested || accumulatedFromExpenses,
        currentValue: parsed.currentValue || 0,
        portfolioType: parsed.portfolioType,
        funds: parsed.funds || [],
      });

      if (!parsed.currentValue) {
        setOcrError('Could not auto-read all numbers. Please verify and fill missing values:');
      }

      setOcrStatus('done');
      setShowReviewModal(true);
      successBuzz();
    } catch (err: any) {
      console.error('Tesseract OCR failed:', err);
      setOcrError('OCR encountered an issue. Enter portfolio values manually:');
      setReviewData({
        holdingName: '',
        date: new Date().toISOString().split('T')[0],
        totalInvested: accumulatedFromExpenses,
        currentValue: 0,
        portfolioType: 'mutual_funds',
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
          source: 'groww',
          portfolioType: reviewData.portfolioType,
          funds: reviewData.funds,
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

  const handleDeleteSnapshot = async (id: string) => {
    if (!confirm('Delete this holding snapshot?')) return;
    lightTap();
    try {
      await fetch(`/api/investments/snapshots?id=${id}`, { method: 'DELETE' });
      setSnapshots((prev) => prev.filter((s) => s._id !== id));
    } catch (err) { console.error(err); }
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

      {/* ── Header ───────────────────────────────────────────────────── */}
      <div style={{ padding: '20px 16px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => router.push('/reports')} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)', width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Investments & Groww</h1>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>Auto-detects MF & Stocks · On-device OCR</p>
          </div>
        </div>
        <button onClick={() => fileInputRef.current?.click()} disabled={isOcrRunning} style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: isOcrRunning ? 'var(--bg-elevated)' : 'var(--accent-grad)',
          color: isOcrRunning ? 'var(--text-muted)' : '#fff',
          border: isOcrRunning ? '1px solid var(--border)' : 'none',
          padding: '8px 14px', borderRadius: 12, fontWeight: 700, fontSize: 13,
          cursor: isOcrRunning ? 'not-allowed' : 'pointer',
          boxShadow: isOcrRunning ? 'none' : '0 4px 14px rgba(124,92,252,0.3)',
          minWidth: 140,
        }}>
          {isOcrRunning
            ? <><RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /><span style={{ fontSize: 11 }}>{ocrStatusLabel[ocrStatus]}</span></>
            : <><Camera size={15} /><span>Upload Groww</span></>}
        </button>
      </div>

      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* ── On-device badge ───────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', borderRadius: 10, background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.18)' }}>
          <Cpu size={13} color="#10B981" />
          <span style={{ fontSize: 11.5, fontWeight: 600, color: '#10B981' }}>On-device OCR · Zero API key · Data stays 100% private</span>
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
              {distinctHoldings.length} holding{distinctHoldings.length !== 1 ? 's' : ''} tracked
            </span>
          </div>

          <div style={{ fontSize: 32, fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.8px' }}>
            {formatINR(totalCurrentValue)}
          </div>

          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 6,
            padding: '3px 9px', borderRadius: 999, fontWeight: 700, fontSize: 12.5,
            background: isPositive ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
            color: isPositive ? 'var(--success)' : 'var(--danger)',
            border: `1px solid ${isPositive ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`,
          }}>
            {isPositive ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
            {isPositive ? '+' : ''}{formatINR(totalGain)} ({isPositive ? '+' : ''}{totalGainPct}%) Total Returns
          </div>

          <div style={{ height: 1, background: 'var(--border)', margin: '14px 0' }} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Invested</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>{formatINR(totalInvested)}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>MF Holdings</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#8B5CF6' }}>{mfHoldings.length}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Stock Holdings</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#10B981' }}>{stockHoldings.length}</div>
            </div>
          </div>
        </div>

        {/* ── Upload Banner ─────────────────────────────────────────── */}
        <div onClick={() => !isOcrRunning && fileInputRef.current?.click()} style={{
          background: 'var(--bg-card)', border: '1.5px dashed var(--accent)', borderRadius: 16,
          padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14,
          cursor: isOcrRunning ? 'not-allowed' : 'pointer',
        }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: 'var(--accent-dim)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {isOcrRunning ? <RefreshCw size={20} style={{ animation: 'spin 1s linear infinite' }} /> : <Camera size={22} />}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 2 }}>
              {isOcrRunning ? ocrStatusLabel[ocrStatus] : 'Upload Groww Fund / Stock Screenshot'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {isOcrRunning ? 'High-contrast OCR processing on device…' : 'Reads Fund Name, Invested, Current & Returns automatically'}
            </div>
            {ocrStatus === 'ocr' && (
              <div style={{ marginTop: 6, height: 4, borderRadius: 2, background: 'var(--border)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${ocrProgress}%`, background: 'var(--accent)', transition: 'width 0.3s', borderRadius: 2 }} />
              </div>
            )}
          </div>
        </div>

        {/* ── Tracked Individual Holdings Section ───────────────────── */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 18, padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(139,92,246,0.15)', color: '#8B5CF6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Tag size={15} />
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>Tracked Funds & Stocks</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Identified from your Groww screenshots</div>
              </div>
            </div>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{distinctHoldings.length} total</span>
          </div>

          {distinctHoldings.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              No holdings uploaded yet. Tap &quot;Upload Groww&quot; to scan any fund or stock screen.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {distinctHoldings.map((h) => {
                const pos = h.totalGain >= 0;
                const isStock = h.portfolioType === 'stocks';
                return (
                  <div key={h._id} style={{
                    padding: '14px', borderRadius: 14,
                    background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                    borderLeft: `4px solid ${isStock ? '#10B981' : '#8B5CF6'}`,
                  }}>
                    {/* Header: Name + Badge */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.3 }}>
                          {h.holdingName || (isStock ? 'Stock Holding' : 'Mutual Fund Scheme')}
                        </div>
                        <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 2 }}>
                          {isStock ? '📈 Stock' : '📊 Mutual Fund'} • Synced {h.date}
                        </div>
                      </div>
                      <button onClick={() => handleDeleteSnapshot(h._id)} style={{
                        background: 'none', border: 'none', color: 'var(--text-muted)',
                        padding: 4, cursor: 'pointer', flexShrink: 0,
                      }}>
                        <Trash2 size={14} />
                      </button>
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

              {/* Invested + Current */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Invested (₹)</label>
                  <input type="number" value={reviewData.totalInvested || ''} onChange={(e) => setReviewData({ ...reviewData, totalInvested: Number(e.target.value) })}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 12, background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 15, fontWeight: 700 }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Current Value (₹)</label>
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
    </div>
  );
}
