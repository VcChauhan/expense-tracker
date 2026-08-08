'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { formatINR, Settings } from '@/lib/types';
import { computeSalaryBreakdown } from '@/lib/taxUtils';
import { TrendingUp, Wallet, Folder, RefreshCw, Check, History, CheckCircle2, XCircle } from 'lucide-react';
import { ConfirmModal } from '@/components/ConfirmModal';
import { CategoryIcon } from '@/components/CategoryIcon';
import AiInsights from '@/components/AiInsights';

interface HikeCategory {
  id: string;
  name: string;
  emoji: string;
  color: string;
  previousBudget: number;
  proposedBudget: number;
  newBudget: number;
}

interface HikeRecord {
  _id: string;
  year: number;
  hikePercent: number;
  previousAnnualSalary: number;
  newAnnualSalary: number;
  previousMonthlyInhand: number;
  newMonthlyInhand: number;
  appliedAt: string;
  categories: { id: string; name: string; emoji: string; previousBudget: number; newBudget: number }[];
}

function DeltaBadge({ current, next }: { current: number; next: number }) {
  const diff = next - current;
  if (diff === 0) return null;
  const isPos = diff > 0;
  return (
    <span style={{
      fontSize: 12, fontWeight: 700,
      color: isPos ? 'var(--success)' : 'var(--danger)',
      background: isPos ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
      padding: '2px 8px', borderRadius: 100, marginLeft: 6
    }}>
      {isPos ? '+' : ''}{formatINR(diff)}
    </span>
  );
}

function SalaryRow({ label, value, green, dim, delta }: {
  label: string; value: string; green?: boolean; dim?: boolean; delta?: number;
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: 12, color: dim ? 'var(--text-muted)' : 'var(--text-secondary)' }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{
          fontSize: 13, fontWeight: 700,
          color: green ? 'var(--success)' : dim ? 'var(--text-muted)' : 'var(--text-primary)',
        }}>{value}</span>
        {delta !== undefined && delta !== 0 && (
          <span style={{
            fontSize: 10, fontWeight: 600, padding: '1px 5px', borderRadius: 100,
            background: delta > 0 ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
            color: delta > 0 ? 'var(--success)' : 'var(--danger)',
          }}>
            {delta > 0 ? '+' : ''}{formatINR(Math.abs(delta))}
          </span>
        )}
      </div>
    </div>
  );
}

export default function HikePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [hikePercent, setHikePercent] = useState<string>('15');
  const [hikeYear, setHikeYear] = useState<number>(new Date().getFullYear());
  const [hikeCategories, setHikeCategories] = useState<HikeCategory[]>([]);
  const [history, setHistory] = useState<HikeRecord[]>([]);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ isOpen: boolean; pct: number } | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [resSettings, resHistory] = await Promise.all([
        fetch('/api/settings'),
        fetch('/api/hike'),
      ]);
      if (resSettings.ok) {
        const s: Settings = await resSettings.json();
        setSettings(s);
        const pct = parseFloat(hikePercent) || 0;
        const cats: HikeCategory[] = (s.categories || []).map(c => {
          const prev = c.monthlyBudget || 0;
          const proposed = Math.round(prev * (1 + pct / 100));
          return {
            id: c.id,
            name: c.name,
            emoji: c.emoji,
            color: c.color,
            previousBudget: prev,
            proposedBudget: proposed,
            newBudget: proposed,
          };
        });
        setHikeCategories(cats);
      }
      if (resHistory.ok) {
        const h = await resHistory.json();
        setHistory(h || []);
      }
    } catch (err) {
      showToast('Error loading hike data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const pct = parseFloat(hikePercent) || 0;

  const currentBreakdown = useMemo(() => {
    const gross = settings?.annualSalary || 0;
    return computeSalaryBreakdown(gross, settings?.taxRegime || 'new', settings?.basicPercent || 50, settings?.deductions80C, settings?.deductions80D, settings?.otherDeductions);
  }, [settings]);

  const newAnnualSalary = useMemo(() => {
    return Math.round((settings?.annualSalary || 0) * (1 + pct / 100));
  }, [settings, pct]);

  const newBreakdown = useMemo(() => {
    return computeSalaryBreakdown(newAnnualSalary, settings?.taxRegime || 'new', settings?.basicPercent || 50, settings?.deductions80C, settings?.deductions80D, settings?.otherDeductions);
  }, [newAnnualSalary, settings]);

  const currentTotal = useMemo(() => {
    return hikeCategories.reduce((sum, c) => sum + c.previousBudget, 0);
  }, [hikeCategories]);

  const newTotal = useMemo(() => {
    return hikeCategories.reduce((sum, c) => sum + c.newBudget, 0);
  }, [hikeCategories]);

  const updateCategoryBudget = (id: string, val: number) => {
    setHikeCategories(prev => prev.map(c => c.id === id ? { ...c, newBudget: val } : c));
  };

  const resetToProposed = () => {
    setHikeCategories(prev => prev.map(c => {
      const proposed = Math.round(c.previousBudget * (1 + pct / 100));
      return { ...c, proposedBudget: proposed, newBudget: proposed };
    }));
  };

  const handleApplyClick = (p: number) => {
    setConfirmDialog({ isOpen: true, pct: p });
  };

  const confirmApply = async () => {
    if (!confirmDialog || !settings) return;
    setApplying(true);
    try {
      const payload = {
        year: hikeYear,
        hikePercent: confirmDialog.pct,
        previousAnnualSalary: settings.annualSalary,
        newAnnualSalary,
        previousMonthlyInhand: currentBreakdown.monthlyInhand,
        newMonthlyInhand: newBreakdown.monthlyInhand,
        categories: hikeCategories.map(c => ({
          id: c.id,
          name: c.name,
          emoji: c.emoji,
          previousBudget: c.previousBudget,
          newBudget: c.newBudget,
        })),
      };
      const res = await fetch('/api/hike', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to apply hike');
      showToast('Hike applied to settings successfully!', 'success');
      fetchData();
    } catch (err) {
      showToast('Failed to apply hike', 'error');
    } finally {
      setApplying(false);
      setConfirmDialog(null);
    }
  };

  if (loading) {
    return <div className="page-container" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading hike planner...</div>;
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><TrendingUp size={28} /> Hike Planner</h1>
        <p className="page-subtitle">Model your salary hike and update budgets automatically</p>
      </div>

      {/* ── Hike Input ── */}
      <div className="card mb-24" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
          <TrendingUp size={20} /> Hike Details
        </h2>
        <div className="grid-2" style={{ gap: 20 }}>
          {/* Hike % */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Hike Percentage</label>
            <div className="flex items-center gap-12">
              <input
                type="range" min={1} max={100} step={0.5}
                value={pct}
                onChange={e => {
                  setHikePercent(e.target.value);
                  const p = parseFloat(e.target.value) || 0;
                  setHikeCategories(prev => prev.map(c => {
                    const proposed = Math.round(c.previousBudget * (1 + p / 100));
                    return { ...c, proposedBudget: proposed, newBudget: proposed };
                  }));
                }}
                style={{ flex: 1, accentColor: 'var(--accent-primary)' }}
              />
              <div style={{ display: 'flex', alignItems: 'center', position: 'relative', flexShrink: 0 }}>
                <input
                  type="number" min={0} max={200} step={0.5}
                  value={hikePercent}
                  onChange={e => {
                    setHikePercent(e.target.value);
                    const p = parseFloat(e.target.value) || 0;
                    setHikeCategories(prev => prev.map(c => {
                      const proposed = Math.round(c.previousBudget * (1 + p / 100));
                      return { ...c, proposedBudget: proposed, newBudget: proposed };
                    }));
                  }}
                  className="form-input"
                  style={{ width: 90, textAlign: 'right', paddingRight: 28, color: 'var(--accent-primary)', fontWeight: 700 }}
                />
                <span style={{ position: 'absolute', right: 12, color: 'var(--accent-primary)', fontSize: 16, pointerEvents: 'none' }}>%</span>
              </div>
            </div>
          </div>

          {/* Hike year */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Hike Year</label>
            <div className="flex items-center gap-8">
              <button className="btn btn-secondary btn-sm" onClick={() => setHikeYear(y => y - 1)}>‹</button>
              <span style={{ fontWeight: 700, fontSize: 16, minWidth: 60, textAlign: 'center' }}>{hikeYear}</span>
              <button className="btn btn-secondary btn-sm" onClick={() => setHikeYear(y => y + 1)}>›</button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Side-by-side Salary Comparison Cards ── */}
      <div className="grid-2 mb-24" style={{ gap: 20 }}>
        {/* Current Salary Card */}
        <div className="card" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12, fontWeight: 600 }}>CURRENT</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 20 }}>
            {formatINR(currentBreakdown.monthlyInhand)}<span style={{ fontSize: 14, fontWeight: 400, color: 'var(--text-muted)' }}>/mo</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <SalaryRow label="Annual CTC" value={formatINR(currentBreakdown.annualGross)} />
            <SalaryRow label="Basic/year" value={formatINR(currentBreakdown.basicAnnual)} dim />
            <SalaryRow label="EPF/month" value={formatINR(currentBreakdown.epfEmployeeMonthly)} dim />
            <SalaryRow label="Tax/year" value={formatINR(currentBreakdown.annualTax)} />
          </div>
        </div>

        {/* Post-Hike Salary Card */}
        <div className="card" style={{ background: 'var(--bg-card)', border: '1px solid var(--accent-primary)', borderRadius: 'var(--radius-lg)', boxShadow: '0 4px 20px var(--accent-dim)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 13, color: 'var(--accent-primary)', fontWeight: 700 }}>POST-HIKE ({pct}%)</span>
            <DeltaBadge current={currentBreakdown.monthlyInhand} next={newBreakdown.monthlyInhand} />
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--success)', marginBottom: 20 }}>
            {formatINR(newBreakdown.monthlyInhand)}<span style={{ fontSize: 14, fontWeight: 400, color: 'var(--text-muted)' }}>/mo</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <SalaryRow label="Annual CTC" value={formatINR(newBreakdown.annualGross)} green delta={newBreakdown.annualGross - currentBreakdown.annualGross} />
            <SalaryRow label="Basic/year" value={formatINR(newBreakdown.basicAnnual)} dim delta={newBreakdown.basicAnnual - currentBreakdown.basicAnnual} />
            <SalaryRow label="EPF/month" value={formatINR(newBreakdown.epfEmployeeMonthly)} dim delta={newBreakdown.epfEmployeeMonthly - currentBreakdown.epfEmployeeMonthly} />
            <SalaryRow label="Tax/year" value={formatINR(newBreakdown.annualTax)} delta={newBreakdown.annualTax - currentBreakdown.annualTax} />
          </div>
        </div>
      </div>

      {/* AI Advice Banner */}
      <AiInsights year={hikeYear} context="hike" hikePercent={pct} />

      {/* ── Category Budget Proportional Distribution ── */}
      <div className="card mb-24" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', marginTop: 24 }}>
        <div className="page-header-row mb-16">
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Folder size={20} /> Proposed Category Budgets
            </h2>
            <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Auto-scaled by {pct}%. Edit any budget manually if needed.</p>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={resetToProposed} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <RefreshCw size={14} /> Reset
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {hikeCategories.map(cat => (
            <div key={cat.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--bg-input)', borderRadius: 'var(--radius-md)', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
                <CategoryIcon name={cat.name} color={cat.color} size={18} inList />
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{cat.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Prev: {formatINR(cat.previousBudget)}</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="number"
                  className="form-input"
                  style={{ width: 110, textAlign: 'right', padding: '6px 10px', fontSize: 14, fontWeight: 700 }}
                  value={cat.newBudget || ''}
                  onChange={e => updateCategoryBudget(cat.id, parseFloat(e.target.value) || 0)}
                />
                {cat.newBudget !== cat.previousBudget && (
                  <span style={{ fontSize: 11, fontWeight: 600, color: cat.newBudget > cat.previousBudget ? 'var(--success)' : 'var(--danger)' }}>
                    {cat.newBudget > cat.previousBudget ? '+' : ''}{Math.round(((cat.newBudget - cat.previousBudget) / (cat.previousBudget || 1)) * 100)}%
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Total proposed vs in-hand check */}
        <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)', display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Total New Budget: </span>
            <strong style={{ fontSize: 15, color: newTotal > newBreakdown.monthlyInhand ? 'var(--danger)' : 'var(--text-primary)' }}>{formatINR(newTotal)}</strong>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 6 }}>/ {formatINR(newBreakdown.monthlyInhand)} in-hand</span>
          </div>
          <button className="btn btn-primary" onClick={() => handleApplyClick(pct)} disabled={applying}>
            {applying ? 'Applying...' : 'Apply Hike to Budget Planner'}
          </button>
        </div>
      </div>

      {/* ── Hike History ── */}
      {history.length > 0 && (
        <div className="card" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <History size={18} /> Hike History
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {history.map(h => (
              <div key={h._id} style={{ padding: '12px 16px', background: 'var(--bg-input)', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{h.year} — {h.hikePercent}% Hike</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Applied on {new Date(h.appliedAt).toLocaleDateString()}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{formatINR(h.previousAnnualSalary)} → <strong style={{ color: 'var(--success)' }}>{formatINR(h.newAnnualSalary)}</strong></div>
                  <div style={{ fontSize: 12, color: 'var(--success)', fontWeight: 600 }}>In-hand: {formatINR(h.newMonthlyInhand)}/mo</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {toast && (
        <div className="toast-container">
          <div className={`toast ${toast.type}`}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {toast.type === 'success' ? <CheckCircle2 size={18} /> : <XCircle size={18} />} {toast.msg}
            </span>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={!!confirmDialog?.isOpen}
        title="Apply Hike?"
        message={`Are you sure you want to apply a ${confirmDialog?.pct}% hike? This will permanently update your annual salary and proportionately increase all your category budgets in the Budget Planner.`}
        onConfirm={confirmApply}
        onCancel={() => setConfirmDialog(null)}
      />
    </div>
  );
}


