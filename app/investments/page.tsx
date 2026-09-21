'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  TrendingUp, Camera, Trash2, ArrowLeft,
  Check, RefreshCw, AlertCircle,
  ArrowUpRight, ArrowDownRight, X, Cpu
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid
} from 'recharts';
import { formatINR, InvestmentFund, Expense, Settings, SHORT_MONTHS } from '@/lib/types';
import { parseGrowwOcrText } from '@/lib/parseGrowwOcr';
import { lightTap, successBuzz, mediumTap } from '@/lib/haptics';

type ReviewData = {
  date: string;
  totalInvested: number;
  currentValue: number;
  funds: InvestmentFund[];
};

type OcrStatus = 'idle' | 'loading-worker' | 'ocr' | 'parsing' | 'done' | 'error';

export default function InvestmentsPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [snapshots, setSnapshots] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);

  // OCR & review state
  const [ocrStatus, setOcrStatus] = useState<OcrStatus>('idle');
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewData, setReviewData] = useState<ReviewData>({
    date: new Date().toISOString().split('T')[0],
    totalInvested: 0,
    currentValue: 0,
    funds: [],
  });
  const [syncNetWorth, setSyncNetWorth] = useState(true);
  const [savingSnapshot, setSavingSnapshot] = useState(false);

  // ── Load data ────────────────────────────────────────────────────────
  const loadData = async () => {
    setLoading(true);
    try {
      const [snapRes, expRes, setRes] = await Promise.all([
        fetch('/api/investments/snapshots'),
        fetch('/api/expenses?limit=500'),
        fetch('/api/settings'),
      ]);
      const [snaps, exps, sets] = await Promise.all([
        snapRes.json(), expRes.json(), setRes.json(),
      ]);
      if (Array.isArray(snaps)) setSnapshots(snaps);
      if (Array.isArray(exps)) setExpenses(exps);
      if (sets && !sets.error) setSettings(sets);
    } catch (err) {
      console.error('Failed to load investment data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  // ── Derived: Investment category ──────────────────────────────────────
  const investmentCatId = useMemo(() => {
    return settings?.categories?.find((c) =>
      c.name.toLowerCase().includes('invest') ||
      c.name.toLowerCase().includes('sip') ||
      c.name.toLowerCase().includes('mutual')
    )?.id ?? null;
  }, [settings]);

  const investmentExpenses = useMemo(() =>
    expenses.filter((e) =>
      e.categoryId === investmentCatId ||
      (e.note || '').toLowerCase().includes('sip') ||
      (e.note || '').toLowerCase().includes('groww')
    ), [expenses, investmentCatId]);

  const accumulatedFromExpenses = useMemo(() =>
    investmentExpenses.reduce((s, e) => s + (e.amount || 0), 0),
    [investmentExpenses]);

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

  const latestSnapshot = snapshots[0] || null;
  const displayInvested = latestSnapshot?.totalInvested > 0 ? latestSnapshot.totalInvested : accumulatedFromExpenses;
  const displayCurrent = latestSnapshot?.currentValue || displayInvested;
  const displayGain = latestSnapshot?.totalGain !== undefined ? latestSnapshot.totalGain : (displayCurrent - displayInvested);
  const displayGainPct = latestSnapshot?.gainPercent !== undefined ? latestSnapshot.gainPercent
    : displayInvested > 0 ? Number(((displayGain / displayInvested) * 100).toFixed(2)) : 0;
  const isPositive = displayGain >= 0;

  // ── On-Device OCR with Tesseract.js ──────────────────────────────────
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    mediumTap();
    setOcrError(null);
    setOcrStatus('loading-worker');
    setOcrProgress(0);

    try {
      // Dynamic import so Tesseract.js WASM only loads when needed
      const { createWorker } = await import('tesseract.js');

      setOcrStatus('ocr');
      const worker = await createWorker('eng', 1, {
        logger: (m: any) => {
          if (m.status === 'recognizing text') {
            setOcrProgress(Math.round((m.progress || 0) * 100));
          }
        },
      });

      setOcrStatus('ocr');
      const { data: { text } } = await worker.recognize(file);
      await worker.terminate();

      setOcrStatus('parsing');

      // Parse the raw OCR text with our Groww-specific parser
      const parsed = parseGrowwOcrText(text);

      setReviewData({
        date: new Date().toISOString().split('T')[0],
        totalInvested: parsed.totalInvested || accumulatedFromExpenses,
        currentValue: parsed.currentValue || 0,
        funds: parsed.funds || [],
      });

      if (!parsed.currentValue) {
        setOcrError('Could not auto-read portfolio value from screenshot. Enter values manually below:');
      }

      setOcrStatus('done');
      setShowReviewModal(true);
      successBuzz();
    } catch (err: any) {
      console.error('Tesseract OCR failed:', err);
      setOcrError('OCR failed. You can enter portfolio values manually:');
      setReviewData({
        date: new Date().toISOString().split('T')[0],
        totalInvested: accumulatedFromExpenses,
        currentValue: 0,
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
          date: reviewData.date,
          totalInvested: inv,
          currentValue: cur,
          totalGain: gain,
          gainPercent: pct,
          source: 'groww',
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
    } catch (e) {
      console.error(e);
      alert('Failed to save snapshot');
    } finally {
      setSavingSnapshot(false);
    }
  };

  // ── Delete snapshot ───────────────────────────────────────────────────
  const handleDeleteSnapshot = async (id: string) => {
    if (!confirm('Delete this snapshot?')) return;
    lightTap();
    try {
      await fetch(`/api/investments/snapshots?id=${id}`, { method: 'DELETE' });
      setSnapshots((prev) => prev.filter((s) => s._id !== id));
    } catch (err) { console.error(err); }
  };

  // OCR status label
  const ocrStatusLabel: Record<OcrStatus, string> = {
    idle: '',
    'loading-worker': 'Loading OCR engine…',
    ocr: `Reading screenshot… ${ocrProgress}%`,
    parsing: 'Parsing portfolio values…',
    done: 'Done!',
    error: 'OCR error',
  };

  const isOcrRunning = ['loading-worker', 'ocr', 'parsing'].includes(ocrStatus);

  if (loading) return (
    <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
      Loading investments…
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', paddingBottom: 90 }}>
      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div style={{
        padding: '20px 16px 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => router.push('/reports')} style={{
            background: 'var(--bg-elevated)', border: '1px solid var(--border)',
            color: 'var(--text-primary)', width: 36, height: 36,
            borderRadius: 10, display: 'flex', alignItems: 'center',
            justifyContent: 'center', cursor: 'pointer',
          }}>
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.3px' }}>
              Investments & Groww
            </h1>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
              On-device OCR • No API key needed
            </p>
          </div>
        </div>

        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isOcrRunning}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: isOcrRunning ? 'var(--bg-elevated)' : 'var(--accent-grad)',
            color: isOcrRunning ? 'var(--text-muted)' : '#fff',
            border: isOcrRunning ? '1px solid var(--border)' : 'none',
            padding: '8px 14px', borderRadius: 12,
            fontWeight: 700, fontSize: 13, cursor: isOcrRunning ? 'not-allowed' : 'pointer',
            boxShadow: isOcrRunning ? 'none' : '0 4px 14px rgba(124,92,252,0.3)',
            transition: 'all 0.2s', minWidth: 130,
          }}
        >
          {isOcrRunning ? (
            <><RefreshCw size={15} style={{ animation: 'spin 1s linear infinite' }} /><span style={{ fontSize: 12 }}>{ocrStatusLabel[ocrStatus]}</span></>
          ) : (
            <><Camera size={15} /><span>Upload Groww</span></>
          )}
        </button>
      </div>

      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* ── On-device badge ─────────────────────────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 14px', borderRadius: 12,
          background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)',
        }}>
          <Cpu size={14} color="#10B981" />
          <span style={{ fontSize: 12, fontWeight: 600, color: '#10B981' }}>
            OCR runs entirely on your device — no API key, no data leaves your phone
          </span>
        </div>

        {/* ── Portfolio Hero Card ─────────────────────────────────── */}
        <div style={{
          background: 'linear-gradient(145deg, var(--bg-card) 0%, rgba(26,26,42,0.85) 100%)',
          border: '1px solid var(--border)', borderRadius: 20, padding: '20px',
          position: 'relative', overflow: 'hidden', boxShadow: '0 8px 30px rgba(0,0,0,0.25)',
        }}>
          <div style={{
            position: 'absolute', top: -40, right: -40, width: 140, height: 140, borderRadius: '50%',
            background: isPositive
              ? 'radial-gradient(circle, rgba(16,185,129,0.25) 0%, transparent 70%)'
              : 'radial-gradient(circle, rgba(239,68,68,0.25) 0%, transparent 70%)',
            pointerEvents: 'none',
          }} />

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 10,
                background: 'rgba(16,185,129,0.15)', color: '#10B981',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <TrendingUp size={18} />
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Portfolio Value
              </span>
            </div>
            {latestSnapshot ? (
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', background: 'var(--bg-elevated)', padding: '3px 8px', borderRadius: 8 }}>
                As of {latestSnapshot.date}
              </span>
            ) : (
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent-2)', background: 'var(--accent-dim)', padding: '3px 8px', borderRadius: 8 }}>
                From Expense Log
              </span>
            )}
          </div>

          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 32, fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.8px' }}>
              {formatINR(displayCurrent)}
            </div>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 6,
              padding: '4px 10px', borderRadius: 999,
              background: isPositive ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
              color: isPositive ? 'var(--success)' : 'var(--danger)',
              fontWeight: 700, fontSize: 13,
              border: `1px solid ${isPositive ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`,
            }}>
              {isPositive ? <ArrowUpRight size={15} /> : <ArrowDownRight size={15} />}
              <span>{isPositive ? '+' : ''}{formatINR(displayGain)} ({isPositive ? '+' : ''}{displayGainPct}%)</span>
              <span style={{ fontSize: 11, opacity: 0.75 }}>Total Returns</span>
            </div>
          </div>

          <div style={{ height: 1, background: 'var(--border)', margin: '14px 0' }} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Invested</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{formatINR(displayInvested)}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>From Expense Log</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#A78BFA' }}>{formatINR(accumulatedFromExpenses)}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>SIPs Tracked</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{investmentExpenses.length} entries</div>
            </div>
          </div>
        </div>

        {/* ── Upload Banner ───────────────────────────────────────── */}
        <div
          onClick={() => !isOcrRunning && fileInputRef.current?.click()}
          style={{
            background: 'var(--bg-card)', border: '1.5px dashed var(--accent)',
            borderRadius: 16, padding: '16px',
            display: 'flex', alignItems: 'center', gap: 14,
            cursor: isOcrRunning ? 'not-allowed' : 'pointer', transition: 'all 0.2s',
          }}
        >
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: 'var(--accent-dim)', color: 'var(--accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            {isOcrRunning ? <RefreshCw size={20} style={{ animation: 'spin 1s linear infinite' }} /> : <Camera size={22} />}
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 2 }}>
              {isOcrRunning ? ocrStatusLabel[ocrStatus] : 'Upload Groww Portfolio Screenshot'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {isOcrRunning
                ? 'Processing on your device…'
                : 'Tesseract.js reads portfolio values locally — fully private'}
            </div>
            {ocrStatus === 'ocr' && (
              <div style={{ marginTop: 6, height: 4, borderRadius: 2, background: 'var(--border)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${ocrProgress}%`, background: 'var(--accent)', transition: 'width 0.3s', borderRadius: 2 }} />
              </div>
            )}
          </div>
        </div>

        {/* ── Monthly SIP Chart ───────────────────────────────────── */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 18, padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>Monthly SIP Investments</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Auto-aggregated from your Investment category</div>
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-2)', background: 'var(--accent-dim)', padding: '4px 10px', borderRadius: 10 }}>
              {investmentExpenses.length} debits
            </div>
          </div>
          {monthlySipData.length > 0 ? (
            <div style={{ height: 160, width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlySipData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              No investment expenses logged yet. Log SIPs under the &quot;Investment&quot; category to see them here.
            </div>
          )}
        </div>

        {/* ── Recent Investment Expenses ──────────────────────────── */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 18, padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>Logged Investment Debits</div>
            <Link href="/expenses" style={{ fontSize: 12, color: 'var(--accent-2)', textDecoration: 'none', fontWeight: 600 }}>View in Log →</Link>
          </div>
          {investmentExpenses.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: 16 }}>No investment transactions found.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {investmentExpenses.slice(0, 5).map((exp) => (
                <div key={exp._id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 12px', borderRadius: 12,
                  background: 'var(--bg-elevated)', borderLeft: '3.5px solid #8B5CF6',
                }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{exp.note || 'Mutual Fund / SIP'}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{exp.date}</div>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>{formatINR(exp.amount)}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Snapshot History ────────────────────────────────────── */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 18, padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>Groww Snapshot History</div>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{snapshots.length} saved</span>
          </div>
          {snapshots.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              No screenshots uploaded yet. Tap &quot;Upload Groww&quot; to save your first snapshot.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {snapshots.map((snap) => {
                const pos = snap.totalGain >= 0;
                return (
                  <div key={snap._id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '12px 14px', borderRadius: 14,
                    background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                  }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>{formatINR(snap.currentValue)}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                        Invested: {formatINR(snap.totalInvested)} • {snap.date}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ textAlign: 'right', fontWeight: 700, fontSize: 12.5, color: pos ? 'var(--success)' : 'var(--danger)' }}>
                        {pos ? '+' : ''}{formatINR(snap.totalGain)}
                        <div style={{ fontSize: 10.5, opacity: 0.8 }}>{pos ? '+' : ''}{snap.gainPercent}%</div>
                      </div>
                      <button onClick={() => snap._id && handleDeleteSnapshot(snap._id)} style={{
                        background: 'none', border: 'none', color: 'var(--text-muted)', padding: 6, borderRadius: 8, cursor: 'pointer',
                      }}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Review Modal ────────────────────────────────────────────────── */}
      {showReviewModal && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
          onClick={() => { setShowReviewModal(false); setOcrStatus('idle'); }}
        >
          <div
            style={{ background: 'var(--bg-card)', borderTopLeftRadius: 28, borderTopRightRadius: 28, border: '1px solid var(--border)', borderBottom: 'none', width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto', padding: '20px 20px 40px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border-strong)', margin: '0 auto 16px' }} />

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Review Portfolio Snapshot</h3>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0' }}>
                  {ocrError ? 'Enter values manually' : 'Verify the OCR-parsed values before saving'}
                </p>
              </div>
              <button onClick={() => { setShowReviewModal(false); setOcrStatus('idle'); }} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '50%', width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <X size={16} />
              </button>
            </div>

            {ocrError && (
              <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 12, padding: '10px 14px', marginBottom: 14, fontSize: 12, color: 'var(--warning)', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>{ocrError}</span>
              </div>
            )}

            {!ocrError && (
              <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 12, padding: '8px 14px', marginBottom: 14, fontSize: 12, color: '#10B981', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Cpu size={14} />
                <span>Values auto-extracted by on-device OCR — adjust if needed</span>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Date</label>
                <input type="date" value={reviewData.date}
                  onChange={(e) => setReviewData({ ...reviewData, date: e.target.value })}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 12, background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 14, fontWeight: 600 }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Invested Amount (₹)</label>
                  <input type="number" value={reviewData.totalInvested || ''}
                    onChange={(e) => setReviewData({ ...reviewData, totalInvested: Number(e.target.value) })}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 12, background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 15, fontWeight: 700 }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Current Value (₹)</label>
                  <input type="number" value={reviewData.currentValue || ''}
                    onChange={(e) => setReviewData({ ...reviewData, currentValue: Number(e.target.value) })}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 12, background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 15, fontWeight: 700 }} />
                </div>
              </div>

              {/* Live P&L preview */}
              {reviewData.currentValue > 0 && (() => {
                const g = reviewData.currentValue - reviewData.totalInvested;
                const pos = g >= 0;
                const pct = reviewData.totalInvested > 0 ? ((g / reviewData.totalInvested) * 100).toFixed(2) : '0';
                return (
                  <div style={{ padding: '12px 14px', borderRadius: 12, background: pos ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${pos ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)' }}>Calculated P&amp;L:</span>
                    <span style={{ fontSize: 15, fontWeight: 800, color: pos ? 'var(--success)' : 'var(--danger)' }}>
                      {pos ? '+' : ''}{formatINR(g)} ({pos ? '+' : ''}{pct}%)
                    </span>
                  </div>
                );
              })()}

              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '8px 0' }}>
                <input type="checkbox" checked={syncNetWorth} onChange={(e) => setSyncNetWorth(e.target.checked)}
                  style={{ width: 18, height: 18, accentColor: 'var(--accent)' }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                  Auto-update Net Worth &quot;Mutual Funds&quot; asset
                </span>
              </label>

              <button
                onClick={handleSaveSnapshot}
                disabled={savingSnapshot || reviewData.currentValue <= 0}
                style={{ background: reviewData.currentValue > 0 ? 'var(--accent-grad)' : 'var(--bg-elevated)', color: reviewData.currentValue > 0 ? '#fff' : 'var(--text-muted)', border: 'none', padding: '14px', borderRadius: 14, fontWeight: 800, fontSize: 15, cursor: reviewData.currentValue > 0 ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: reviewData.currentValue > 0 ? '0 6px 20px rgba(124,92,252,0.4)' : 'none', marginTop: 8 }}
              >
                {savingSnapshot ? <><RefreshCw size={18} style={{ animation: 'spin 1s linear infinite' }} /><span>Saving…</span></> : <><Check size={18} /><span>Save Snapshot</span></>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
