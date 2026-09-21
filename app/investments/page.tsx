'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  TrendingUp, TrendingDown, Upload, Camera, Plus, Trash2, ArrowLeft,
  Sparkles, Check, RefreshCw, AlertCircle, BarChart3, ShieldCheck,
  Calendar, ChevronRight, Layers, ArrowUpRight, ArrowDownRight, Edit3, X
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid
} from 'recharts';
import { formatINR, InvestmentSnapshot, InvestmentFund, Expense, Settings, SHORT_MONTHS } from '@/lib/types';
import { lightTap, successBuzz, mediumTap } from '@/lib/haptics';

export default function InvestmentsPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [snapshots, setSnapshots] = useState<InvestmentSnapshot[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);

  // Upload & parse state
  const [isUploading, setIsUploading] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewData, setReviewData] = useState<{
    date: string;
    totalInvested: number;
    currentValue: number;
    totalGain: number;
    gainPercent: number;
    funds: InvestmentFund[];
  }>({
    date: new Date().toISOString().split('T')[0],
    totalInvested: 0,
    currentValue: 0,
    totalGain: 0,
    gainPercent: 0,
    funds: [],
  });
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [syncNetWorth, setSyncNetWorth] = useState(true);
  const [savingSnapshot, setSavingSnapshot] = useState(false);

  // Fetch initial data
  const loadData = async () => {
    setLoading(true);
    try {
      const [snapRes, expRes, setRes] = await Promise.all([
        fetch('/api/investments/snapshots'),
        fetch('/api/expenses?limit=500'),
        fetch('/api/settings'),
      ]);

      const [snaps, exps, sets] = await Promise.all([
        snapRes.json(),
        expRes.json(),
        setRes.json(),
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

  useEffect(() => {
    loadData();
  }, []);

  // Identify Investment category
  const investmentCategory = useMemo(() => {
    if (!settings?.categories) return null;
    return (
      settings.categories.find(
        (c) =>
          c.name.toLowerCase().includes('invest') ||
          c.name.toLowerCase().includes('mutual') ||
          c.name.toLowerCase().includes('sip') ||
          c.name.toLowerCase().includes('stock')
      ) || null
    );
  }, [settings]);

  // Filter expenses matching Investment category
  const investmentExpenses = useMemo(() => {
    if (!investmentCategory) {
      return expenses.filter((e) =>
        (e.note || '').toLowerCase().includes('sip') ||
        (e.note || '').toLowerCase().includes('groww') ||
        (e.note || '').toLowerCase().includes('mutual')
      );
    }
    return expenses.filter(
      (e) =>
        e.categoryId === investmentCategory.id ||
        (e.note || '').toLowerCase().includes('sip') ||
        (e.note || '').toLowerCase().includes('groww')
    );
  }, [expenses, investmentCategory]);

  // Total Invested accumulated from expense log
  const accumulatedFromExpenses = useMemo(() => {
    return investmentExpenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
  }, [investmentExpenses]);

  // Monthly investment breakdown from expenses
  const monthlySipData = useMemo(() => {
    const map: Record<string, number> = {};
    investmentExpenses.forEach((exp) => {
      if (!exp.date) return;
      const monthKey = exp.date.substring(0, 7); // YYYY-MM
      map[monthKey] = (map[monthKey] || 0) + exp.amount;
    });

    return Object.entries(map)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-6)
      .map(([key, total]) => {
        const [y, m] = key.split('-');
        const monthName = SHORT_MONTHS[parseInt(m, 10) - 1] || m;
        return {
          label: `${monthName} ${y.slice(2)}`,
          amount: total,
        };
      });
  }, [investmentExpenses]);

  // Latest snapshot
  const latestSnapshot = snapshots[0] || null;

  // Key metrics
  const displayInvested =
    latestSnapshot?.totalInvested && latestSnapshot.totalInvested > 0
      ? latestSnapshot.totalInvested
      : accumulatedFromExpenses;

  const displayCurrent =
    latestSnapshot?.currentValue ||
    settings?.netWorthEntries?.find(
      (e) =>
        e.type === 'asset' &&
        (e.category === 'Mutual Funds' || e.name.toLowerCase().includes('mutual fund'))
    )?.amount ||
    displayInvested;

  const displayGain =
    latestSnapshot?.totalGain !== undefined
      ? latestSnapshot.totalGain
      : displayCurrent - displayInvested;

  const displayGainPct =
    latestSnapshot?.gainPercent !== undefined
      ? latestSnapshot.gainPercent
      : displayInvested > 0
      ? Number(((displayGain / displayInvested) * 100).toFixed(2))
      : 0;

  const isPositive = displayGain >= 0;

  // Handle file select
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    mediumTap();
    setIsUploading(true);
    setParseError(null);

    const reader = new FileReader();
    reader.onload = async () => {
      const base64Data = reader.result as string;
      setPreviewImage(base64Data);

      try {
        const res = await fetch('/api/investments/parse-screenshot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image: base64Data,
            mimeType: file.type || 'image/png',
          }),
        });

        const json = await res.json();

        if (!res.ok || json.error) {
          throw new Error(json.message || json.error || 'Failed to parse image');
        }

        const data = json.data;
        setReviewData({
          date: new Date().toISOString().split('T')[0],
          totalInvested: data.totalInvested || accumulatedFromExpenses,
          currentValue: data.currentValue || 0,
          totalGain: data.totalGain || 0,
          gainPercent: data.gainPercent || 0,
          funds: data.funds || [],
        });
        setShowReviewModal(true);
        successBuzz();
      } catch (err: any) {
        console.error('Screenshot parse failed:', err);
        setParseError(err.message || 'Could not parse screenshot.');
        // Still allow manual review with prefilled values
        setReviewData({
          date: new Date().toISOString().split('T')[0],
          totalInvested: accumulatedFromExpenses || 0,
          currentValue: 0,
          totalGain: 0,
          gainPercent: 0,
          funds: [],
        });
        setShowReviewModal(true);
      } finally {
        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsDataURL(file);
  };

  // Save reviewed snapshot
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
        setPreviewImage(null);
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

  // Delete snapshot
  const handleDeleteSnapshot = async (id: string) => {
    if (!confirm('Are you sure you want to delete this snapshot?')) return;
    lightTap();
    try {
      const res = await fetch(`/api/investments/snapshots?id=${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setSnapshots((prev) => prev.filter((s) => s._id !== id));
      }
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
        Loading investments…
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', paddingBottom: 90 }}>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {/* Header */}
      <div
        style={{
          padding: '20px 16px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => router.push('/reports')}
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
              width: 36,
              height: 36,
              borderRadius: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1
              style={{
                fontSize: 20,
                fontWeight: 800,
                color: 'var(--text-primary)',
                margin: 0,
                letterSpacing: '-0.3px',
              }}
            >
              Investments & Groww
            </h1>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
              Mutual Funds & Stocks Portfolio
            </p>
          </div>
        </div>

        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: 'var(--accent-grad)',
            color: '#fff',
            border: 'none',
            padding: '8px 14px',
            borderRadius: 12,
            fontWeight: 700,
            fontSize: 13,
            cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(124,92,252,0.3)',
            transition: 'all 0.2s',
          }}
        >
          {isUploading ? (
            <>
              <RefreshCw size={15} className="animate-spin" />
              <span>Parsing…</span>
            </>
          ) : (
            <>
              <Camera size={15} />
              <span>Upload Groww</span>
            </>
          )}
        </button>
      </div>

      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* ── Portfolio Hero Card ── */}
        <div
          style={{
            background: 'linear-gradient(145deg, var(--bg-card) 0%, rgba(26,26,42,0.85) 100%)',
            border: '1px solid var(--border)',
            borderRadius: 20,
            padding: '20px',
            position: 'relative',
            overflow: 'hidden',
            boxShadow: '0 8px 30px rgba(0,0,0,0.25)',
          }}
        >
          {/* Subtle glow orb */}
          <div
            style={{
              position: 'absolute',
              top: -40,
              right: -40,
              width: 140,
              height: 140,
              borderRadius: '50%',
              background: isPositive
                ? 'radial-gradient(circle, rgba(16,185,129,0.25) 0%, transparent 70%)'
                : 'radial-gradient(circle, rgba(239,68,68,0.25) 0%, transparent 70%)',
              pointerEvents: 'none',
            }}
          />

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 10,
                  background: 'rgba(16,185,129,0.15)',
                  color: '#10B981',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <TrendingUp size={18} />
              </div>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: 'var(--text-secondary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                Portfolio Value
              </span>
            </div>

            {latestSnapshot ? (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: 'var(--text-muted)',
                  background: 'var(--bg-elevated)',
                  padding: '3px 8px',
                  borderRadius: 8,
                }}
              >
                As of {latestSnapshot.date}
              </span>
            ) : (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: 'var(--accent-2)',
                  background: 'var(--accent-dim)',
                  padding: '3px 8px',
                  borderRadius: 8,
                }}
              >
                Auto-Accumulated
              </span>
            )}
          </div>

          {/* Big Current Value */}
          <div style={{ marginBottom: 14 }}>
            <div
              style={{
                fontSize: 32,
                fontWeight: 900,
                color: 'var(--text-primary)',
                letterSpacing: '-0.8px',
              }}
            >
              {formatINR(displayCurrent)}
            </div>

            {/* P&L Pill */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                marginTop: 6,
                padding: '4px 10px',
                borderRadius: 999,
                background: isPositive ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
                color: isPositive ? 'var(--success)' : 'var(--danger)',
                fontWeight: 700,
                fontSize: 13,
                border: `1px solid ${isPositive ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`,
              }}
            >
              {isPositive ? <ArrowUpRight size={15} /> : <ArrowDownRight size={15} />}
              <span>
                {isPositive ? '+' : ''}
                {formatINR(displayGain)} ({isPositive ? '+' : ''}
                {displayGainPct}%)
              </span>
              <span style={{ fontSize: 11, opacity: 0.75 }}>Total Returns</span>
            </div>
          </div>

          <div
            style={{
              height: 1,
              background: 'var(--border)',
              margin: '14px 0',
            }}
          />

          {/* 3 Metric Columns */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>
                Invested
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                {formatINR(displayInvested)}
              </div>
            </div>

            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>
                From Expense Log
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#A78BFA' }}>
                {formatINR(accumulatedFromExpenses)}
              </div>
            </div>

            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>
                SIPs Tracked
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                {investmentExpenses.length} entries
              </div>
            </div>
          </div>
        </div>

        {/* ── Quick Action: Upload Groww Screenshot Banner ── */}
        <div
          onClick={() => fileInputRef.current?.click()}
          style={{
            background: 'var(--bg-card)',
            border: '1.5px dashed var(--accent)',
            borderRadius: 16,
            padding: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: 'var(--accent-dim)',
                color: 'var(--accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Camera size={22} />
            </div>
            <div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 800,
                  color: 'var(--text-primary)',
                  marginBottom: 2,
                }}
              >
                Upload Groww Portfolio Screenshot
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Gemini Vision AI auto-reads current value & P&L
              </div>
            </div>
          </div>
          <ChevronRight size={18} color="var(--text-muted)" />
        </div>

        {/* ── Monthly SIP Investment Activity Chart ── */}
        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 18,
            padding: '16px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 16,
            }}
          >
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>
                Monthly SIP Investments
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Auto-aggregated from your Investment expense logs
              </div>
            </div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: 'var(--accent-2)',
                background: 'var(--accent-dim)',
                padding: '4px 10px',
                borderRadius: 10,
              }}
            >
              {investmentExpenses.length} Debits
            </div>
          </div>

          {monthlySipData.length > 0 ? (
            <div style={{ height: 160, width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlySipData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="label" stroke="var(--text-muted)" fontSize={11} tickLine={false} />
                  <YAxis stroke="var(--text-muted)" fontSize={10} tickLine={false} tickFormatter={(v) => `₹${v / 1000}k`} />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      return (
                        <div
                          style={{
                            background: 'rgba(20, 20, 30, 0.95)',
                            border: '1px solid var(--border)',
                            borderRadius: 10,
                            padding: '8px 12px',
                            color: '#fff',
                            fontSize: 12,
                          }}
                        >
                          <div style={{ fontWeight: 600, color: 'var(--text-muted)' }}>{label}</div>
                          <div style={{ fontWeight: 800, color: 'var(--accent-2)', fontSize: 14 }}>
                            {formatINR(Number(payload[0].value))}
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="amount" fill="#8B5CF6" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              No investment expenses logged yet. When you log SIPs under the &quot;Investment&quot; category, they will appear here!
            </div>
          )}
        </div>

        {/* ── Recent Investment Expenses from Log ── */}
        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 18,
            padding: '16px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 14,
            }}
          >
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>
              Logged Investment Debits
            </div>
            <Link
              href="/expenses"
              style={{
                fontSize: 12,
                color: 'var(--accent-2)',
                textDecoration: 'none',
                fontWeight: 600,
              }}
            >
              View in Log →
            </Link>
          </div>

          {investmentExpenses.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: '16px' }}>
              No investment transactions found.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {investmentExpenses.slice(0, 5).map((exp) => (
                <div
                  key={exp._id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    borderRadius: 12,
                    background: 'var(--bg-elevated)',
                    borderLeft: '3.5px solid #8B5CF6',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                      {exp.note || 'Mutual Fund / SIP'}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{exp.date}</div>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>
                    {formatINR(exp.amount)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Snapshot History ── */}
        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 18,
            padding: '16px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 14,
            }}
          >
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>
              Groww Snapshot History
            </div>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {snapshots.length} saved
            </span>
          </div>

          {snapshots.length === 0 ? (
            <div
              style={{
                padding: '24px',
                textAlign: 'center',
                color: 'var(--text-muted)',
                fontSize: 13,
              }}
            >
              No screenshots uploaded yet. Tap &quot;Upload Groww&quot; to save your first snapshot.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {snapshots.map((snap) => {
                const pos = snap.totalGain >= 0;
                return (
                  <div
                    key={snap._id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 14px',
                      borderRadius: 14,
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 800,
                          color: 'var(--text-primary)',
                        }}
                      >
                        {formatINR(snap.currentValue)}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: 'var(--text-muted)',
                          marginTop: 2,
                        }}
                      >
                        Invested: {formatINR(snap.totalInvested)} • {snap.date}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div
                        style={{
                          textAlign: 'right',
                          fontWeight: 700,
                          fontSize: 12.5,
                          color: pos ? 'var(--success)' : 'var(--danger)',
                        }}
                      >
                        {pos ? '+' : ''}
                        {formatINR(snap.totalGain)}
                        <div style={{ fontSize: 10.5, opacity: 0.8 }}>
                          {pos ? '+' : ''}
                          {snap.gainPercent}%
                        </div>
                      </div>

                      <button
                        onClick={() => snap._id && handleDeleteSnapshot(snap._id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-muted)',
                          padding: 6,
                          borderRadius: 8,
                          cursor: 'pointer',
                        }}
                      >
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

      {/* ── Modal: Review & Confirm Screenshot Parse ── */}
      {showReviewModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
          }}
          onClick={() => setShowReviewModal(false)}
        >
          <div
            style={{
              background: 'var(--bg-card)',
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              border: '1px solid var(--border)',
              borderBottom: 'none',
              width: '100%',
              maxWidth: 520,
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '20px 20px 32px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                width: 36,
                height: 4,
                borderRadius: 2,
                background: 'var(--border-strong)',
                margin: '0 auto 16px',
              }}
            />

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 16,
              }}
            >
              <div>
                <h3
                  style={{
                    fontSize: 18,
                    fontWeight: 800,
                    color: 'var(--text-primary)',
                    margin: 0,
                  }}
                >
                  Review Groww Snapshot
                </h3>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                  Verify the parsed portfolio values before saving
                </p>
              </div>
              <button
                onClick={() => setShowReviewModal(false)}
                style={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border)',
                  borderRadius: '50%',
                  width: 30,
                  height: 30,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                }}
              >
                <X size={16} />
              </button>
            </div>

            {parseError && (
              <div
                style={{
                  background: 'rgba(245,158,11,0.1)',
                  border: '1px solid rgba(245,158,11,0.25)',
                  borderRadius: 12,
                  padding: '10px 14px',
                  marginBottom: 14,
                  fontSize: 12,
                  color: 'var(--warning)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <AlertCircle size={16} flexShrink={0} />
                <span>{parseError} Enter or adjust the values below:</span>
              </div>
            )}

            {/* Inputs */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: 'var(--text-muted)',
                    display: 'block',
                    marginBottom: 6,
                  }}
                >
                  Date
                </label>
                <input
                  type="date"
                  value={reviewData.date}
                  onChange={(e) => setReviewData({ ...reviewData, date: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 12,
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-primary)',
                    fontSize: 14,
                    fontWeight: 600,
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: 'var(--text-muted)',
                      display: 'block',
                      marginBottom: 6,
                    }}
                  >
                    Invested Amount (₹)
                  </label>
                  <input
                    type="number"
                    value={reviewData.totalInvested || ''}
                    onChange={(e) =>
                      setReviewData({
                        ...reviewData,
                        totalInvested: Number(e.target.value),
                      })
                    }
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: 12,
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border)',
                      color: 'var(--text-primary)',
                      fontSize: 15,
                      fontWeight: 700,
                    }}
                  />
                </div>

                <div>
                  <label
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: 'var(--text-muted)',
                      display: 'block',
                      marginBottom: 6,
                    }}
                  >
                    Current Value (₹)
                  </label>
                  <input
                    type="number"
                    value={reviewData.currentValue || ''}
                    onChange={(e) =>
                      setReviewData({
                        ...reviewData,
                        currentValue: Number(e.target.value),
                      })
                    }
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: 12,
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border)',
                      color: 'var(--text-primary)',
                      fontSize: 15,
                      fontWeight: 700,
                    }}
                  />
                </div>
              </div>

              {/* Computed P&L preview */}
              {reviewData.currentValue > 0 && (
                <div
                  style={{
                    padding: '12px 14px',
                    borderRadius: 12,
                    background:
                      reviewData.currentValue >= reviewData.totalInvested
                        ? 'rgba(16,185,129,0.1)'
                        : 'rgba(239,68,68,0.1)',
                    border: `1px solid ${
                      reviewData.currentValue >= reviewData.totalInvested
                        ? 'rgba(16,185,129,0.25)'
                        : 'rgba(239,68,68,0.25)'
                    }`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)' }}>
                    Calculated P&L:
                  </span>
                  <span
                    style={{
                      fontSize: 15,
                      fontWeight: 800,
                      color:
                        reviewData.currentValue >= reviewData.totalInvested
                          ? 'var(--success)'
                          : 'var(--danger)',
                    }}
                  >
                    {reviewData.currentValue >= reviewData.totalInvested ? '+' : ''}
                    {formatINR(reviewData.currentValue - reviewData.totalInvested)} (
                    {reviewData.totalInvested > 0
                      ? (
                          ((reviewData.currentValue - reviewData.totalInvested) /
                            reviewData.totalInvested) *
                          100
                        ).toFixed(2)
                      : 0}
                    %)
                  </span>
                </div>
              )}

              {/* Checkbox: Sync with Net Worth */}
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  cursor: 'pointer',
                  padding: '8px 0',
                }}
              >
                <input
                  type="checkbox"
                  checked={syncNetWorth}
                  onChange={(e) => setSyncNetWorth(e.target.checked)}
                  style={{ width: 18, height: 18, accentColor: 'var(--accent)' }}
                />
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                  Auto-update Net Worth &quot;Mutual Funds&quot; asset
                </span>
              </label>

              <button
                onClick={handleSaveSnapshot}
                disabled={savingSnapshot || reviewData.currentValue <= 0}
                style={{
                  background: 'var(--accent-grad)',
                  color: '#fff',
                  border: 'none',
                  padding: '14px',
                  borderRadius: 14,
                  fontWeight: 800,
                  fontSize: 15,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  boxShadow: '0 6px 20px rgba(124,92,252,0.4)',
                  marginTop: 8,
                }}
              >
                {savingSnapshot ? (
                  <>
                    <RefreshCw size={18} className="animate-spin" />
                    <span>Saving…</span>
                  </>
                ) : (
                  <>
                    <Check size={18} />
                    <span>Save Snapshot</span>
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
