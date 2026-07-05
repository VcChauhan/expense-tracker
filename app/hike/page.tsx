'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { formatINR, Settings } from '@/lib/types';
import { computeSalaryBreakdown } from '@/lib/taxUtils';

interface HikeCategory {
  id: string;
  name: string;
  emoji: string;
  color: string;
  previousBudget: number;
  proposedBudget: number; // auto-computed
  newBudget: number;      // user-editable
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
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 100,
      background: diff > 0 ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
      color: diff > 0 ? 'var(--success)' : 'var(--danger)',
      marginLeft: 8,
    }}>
      {diff > 0 ? '+' : ''}{formatINR(diff)}
    </span>
  );
}

export default function HikePage() {
  const router = useRouter();
  const now    = new Date();

  const [settings, setSettings]         = useState<Settings | null>(null);
  const [loading, setLoading]           = useState(true);
  const [applying, setApplying]         = useState(false);
  const [history, setHistory]           = useState<HikeRecord[]>([]);
  const [toast, setToast]               = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  // Hike inputs
  const [hikePercent, setHikePercent]   = useState<string>('20');
  const [hikeYear, setHikeYear]         = useState(now.getFullYear());

  // Editable category budgets
  const [hikeCategories, setHikeCategories] = useState<HikeCategory[]>([]);

  useEffect(() => {
    Promise.all([
      fetch('/api/settings').then(r => r.json()),
      fetch('/api/hike').then(r => r.json()),
    ]).then(([s, h]) => {
      if (s && !s.error) setSettings(s);
      setHistory(Array.isArray(h) ? h : []);
      setLoading(false);
    });
  }, []);

  // Recompute proposed budgets whenever hike% or settings change
  useEffect(() => {
    if (!settings) return;
    const pct = parseFloat(hikePercent) || 0;
    setHikeCategories(
      (settings.categories ?? []).map(cat => ({
        id: cat.id,
        name: cat.name,
        emoji: cat.emoji,
        color: cat.color,
        previousBudget: cat.monthlyBudget,
        proposedBudget: Math.round(cat.monthlyBudget * (1 + pct / 100)),
        newBudget: Math.round(cat.monthlyBudget * (1 + pct / 100)),
      }))
    );
  }, [settings, hikePercent]);

  // Salary computations
  const currentSalary = settings?.annualSalary ?? 0;
  const pct           = parseFloat(hikePercent) || 0;
  const newSalary     = Math.round(currentSalary * (1 + pct / 100));

  const taxRegime    = settings?.taxRegime    ?? 'new';
  const basicPercent = settings?.basicPercent ?? 50;
  const ded80C       = settings?.deductions80C ?? 0;
  const ded80D       = settings?.deductions80D ?? 0;
  const otherDeds    = settings?.otherDeductions ?? 0;

  const currentBreakdown = useMemo(() =>
    computeSalaryBreakdown(currentSalary, taxRegime, basicPercent, ded80C, ded80D, otherDeds)
  , [currentSalary, taxRegime, basicPercent, ded80C, ded80D, otherDeds]);

  const newBreakdown = useMemo(() =>
    computeSalaryBreakdown(newSalary, taxRegime, basicPercent, ded80C, ded80D, otherDeds)
  , [newSalary, taxRegime, basicPercent, ded80C, ded80D, otherDeds]);

  // Budget totals
  const currentTotal  = hikeCategories.reduce((s, c) => s + c.previousBudget, 0);
  const newTotal      = hikeCategories.reduce((s, c) => s + c.newBudget, 0);

  function updateCategoryBudget(id: string, val: number) {
    setHikeCategories(cats => cats.map(c => c.id === id ? { ...c, newBudget: val } : c));
  }

  function resetToProposed() {
    setHikeCategories(cats => cats.map(c => ({ ...c, newBudget: c.proposedBudget })));
  }

  function showToast(msg: string, type: 'success' | 'error') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  }

  async function handleApply() {
    if (!settings || pct <= 0) return;
    if (!confirm(`Apply ${pct}% hike? This will update your salary and all category budgets in the Budget Planner.`)) return;
    setApplying(true);
    try {
      const res = await fetch('/api/hike', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          year: hikeYear,
          hikePercent: pct,
          previousAnnualSalary: currentSalary,
          newAnnualSalary: newSalary,
          categories: hikeCategories.map(c => ({
            id: c.id, name: c.name, emoji: c.emoji,
            previousBudget: c.previousBudget,
            newBudget: c.newBudget,
          })),
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      showToast(`🎉 ${pct}% hike applied! New in-hand: ${formatINR(data.newMonthlyInhand)}/mo`, 'success');
      // Refresh data
      const [s, h] = await Promise.all([
        fetch('/api/settings').then(r => r.json()),
        fetch('/api/hike').then(r => r.json()),
      ]);
      if (s && !s.error) setSettings(s);
      setHistory(Array.isArray(h) ? h : []);
      setTimeout(() => router.refresh(), 1500);
    } catch (e) {
      console.error(e);
      showToast('Failed to apply hike', 'error');
    } finally {
      setApplying(false);
    }
  }

  if (loading) return <div className="page-container"><div className="loading-overlay"><div className="spinner" /></div></div>;

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">💹 Salary Hike Planner</h1>
        <p className="page-subtitle">Model your salary hike and update budgets automatically</p>
      </div>

      {/* ── Hike Input ── */}
      <div className="card mb-24">
        <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 20 }}>
          📊 Hike Details
        </h2>
        <div className="grid-2" style={{ gap: 20 }}>
          {/* Hike % */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Hike Percentage</label>
            <div className="flex items-center gap-12">
              <input
                type="range" min={1} max={100} step={0.5}
                value={parseFloat(hikePercent) || 0}
                onChange={e => setHikePercent(e.target.value)}
                style={{ flex: 1, accentColor: 'var(--success)' }}
              />
              <div style={{ display: 'flex', alignItems: 'center', position: 'relative', flexShrink: 0 }}>
                <input
                  type="number" min={0} max={200} step={0.5}
                  value={hikePercent}
                  onChange={e => setHikePercent(e.target.value)}
                  className="form-input"
                  style={{ width: 90, textAlign: 'right', paddingRight: 28 }}
                />
                <span style={{ position: 'absolute', right: 12, color: 'var(--text-muted)', fontSize: 16, pointerEvents: 'none' }}>%</span>
              </div>
            </div>
          </div>

          {/* Hike year */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Hike Year</label>
            <div className="flex items-center gap-8">
              <button className="month-nav-btn" onClick={() => setHikeYear(y => y - 1)}>‹</button>
              <span className="month-label">{hikeYear}</span>
              <button className="month-nav-btn" onClick={() => setHikeYear(y => y + 1)}>›</button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Salary Comparison ── */}
      <div className="card mb-24">
        {/* Header summary */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            💵 Salary Comparison
          </h2>
          <span style={{
            background: 'rgba(16,185,129,0.15)', color: 'var(--success)',
            borderRadius: 100, padding: '5px 14px', fontSize: 14, fontWeight: 800,
          }}>+{pct}% hike</span>
        </div>

        {/* In-hand hero row */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20,
          padding: '14px 16px', background: 'var(--bg-input)', borderRadius: 'var(--radius-md)',
          border: '1px solid rgba(16,185,129,0.25)',
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Current In-Hand</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', fontFamily: "'Space Grotesk', sans-serif" }}>
              {formatINR(currentBreakdown.monthlyInhand)}<span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 400 }}>/mo</span>
            </div>
          </div>
          <div style={{ fontSize: 22, color: 'var(--success)' }}>→</div>
          <div style={{ flex: 1, textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: 'var(--success)', marginBottom: 2 }}>After Hike ({hikeYear})</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--success)', fontFamily: "'Space Grotesk', sans-serif" }}>
              {formatINR(newBreakdown.monthlyInhand)}<span style={{ fontSize: 12, fontWeight: 400 }}>/mo</span>
            </div>
          </div>
        </div>

        {/* Comparison rows */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {[
            { label: 'Annual CTC',     curr: currentBreakdown.annualGross,          next: newBreakdown.annualGross },
            { label: 'Basic/year',     curr: currentBreakdown.basicAnnual,           next: newBreakdown.basicAnnual, dim: true },
            { label: 'EPF/month',      curr: currentBreakdown.epfEmployeeMonthly,    next: newBreakdown.epfEmployeeMonthly, neg: true, dim: true },
            { label: 'Tax/year',       curr: currentBreakdown.annualTax,             next: newBreakdown.annualTax, neg: true },
            { label: 'Monthly In-Hand',curr: currentBreakdown.monthlyInhand,         next: newBreakdown.monthlyInhand, highlight: true },
          ].map(r => {
            const diff = r.next - r.curr;
            return (
              <div key={r.label} style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr 80px', gap: 8, alignItems: 'center',
                padding: '10px 0', borderBottom: '1px solid var(--border)',
              }}>
                <span style={{ fontSize: 13, color: r.dim ? 'var(--text-muted)' : 'var(--text-secondary)' }}>{r.label}</span>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 1 }}>{formatINR(r.curr)}</div>
                  <div style={{
                    fontSize: 14, fontWeight: 700,
                    color: r.highlight ? 'var(--success)' : r.dim ? 'var(--text-muted)' : 'var(--text-primary)',
                  }}>{formatINR(r.next)}</div>
                </div>
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 100, textAlign: 'center',
                  background: diff > 0 ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.12)',
                  color: diff > 0 ? 'var(--success)' : 'var(--danger)',
                }}>
                  {r.neg ? (diff > 0 ? '−' : '+') : (diff >= 0 ? '+' : '')}{formatINR(Math.abs(diff))}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Category Budget Distribution ── */}
      <div className="card mb-24">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            📂 Budget Distribution
          </h2>
          <div className="flex gap-8" style={{ flexWrap: 'wrap' }}>
            <button className="btn btn-secondary btn-sm" onClick={resetToProposed}>
              ↺ Reset to {pct}% proposed
            </button>
            <button
              className="btn btn-primary"
              onClick={handleApply}
              disabled={applying || pct <= 0}
              style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}
            >
              {applying ? <span className="spinner" style={{ width: 15, height: 15 }} /> : '✅'}
              Apply Hike to Budget Planner
            </button>
          </div>
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Category</th>
                <th className="text-right">Current Budget</th>
                <th className="text-right">Proposed (+{pct}%)</th>
                <th style={{ width: 160 }}>New Budget (Edit)</th>
                <th className="text-right">Δ Change</th>
              </tr>
            </thead>
            <tbody>
              {hikeCategories.map(cat => {
                const diff = cat.newBudget - cat.previousBudget;
                return (
                  <tr key={cat.id}>
                    <td>
                      <span className="flex items-center gap-8">
                        <span style={{ width: 10, height: 10, borderRadius: '50%', background: cat.color, display: 'inline-block', flexShrink: 0 }} />
                        <span style={{ fontSize: 16 }}>{cat.emoji}</span>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{cat.name}</span>
                      </span>
                    </td>
                    <td className="text-right" style={{ color: 'var(--text-secondary)' }}>{formatINR(cat.previousBudget)}</td>
                    <td className="text-right" style={{ color: 'var(--text-muted)' }}>{formatINR(cat.proposedBudget)}</td>
                    <td>
                      <input
                        type="number"
                        className="form-input"
                        style={{ padding: '6px 10px', fontSize: 13, width: '100%' }}
                        value={cat.newBudget}
                        onChange={e => updateCategoryBudget(cat.id, Math.round(parseFloat(e.target.value) || 0))}
                      />
                    </td>
                    <td className="text-right">
                      <span style={{
                        fontSize: 13, fontWeight: 600,
                        color: diff > 0 ? 'var(--success)' : diff < 0 ? 'var(--danger)' : 'var(--text-muted)',
                      }}>
                        {diff > 0 ? '+' : ''}{formatINR(diff)}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {/* Totals row */}
              <tr style={{ background: 'var(--bg-secondary)', borderTop: '2px solid var(--border-light)' }}>
                <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>TOTAL</td>
                <td className="text-right" style={{ fontWeight: 700, color: 'var(--warning)' }}>{formatINR(currentTotal)}</td>
                <td className="text-right" style={{ color: 'var(--text-muted)', fontWeight: 600 }}>
                  {formatINR(hikeCategories.reduce((s, c) => s + c.proposedBudget, 0))}
                </td>
                <td style={{ fontWeight: 700, color: 'var(--success)' }}>
                  <span style={{ paddingLeft: 10 }}>{formatINR(newTotal)}</span>
                </td>
                <td className="text-right" style={{ fontWeight: 700, color: 'var(--success)' }}>
                  +{formatINR(newTotal - currentTotal)}
                </td>
              </tr>
              {/* In-hand check row */}
              <tr style={{ background: 'var(--bg-secondary)' }}>
                <td colSpan={3} style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                  New monthly in-hand: {formatINR(newBreakdown.monthlyInhand)}
                </td>
                <td colSpan={2} style={{
                  fontSize: 12, fontWeight: 600,
                  color: newTotal <= newBreakdown.monthlyInhand ? 'var(--success)' : 'var(--danger)',
                }}>
                  {newTotal <= newBreakdown.monthlyInhand
                    ? `✅ Within budget (${formatINR(newBreakdown.monthlyInhand - newTotal)} remaining)`
                    : `⚠️ Exceeds in-hand by ${formatINR(newTotal - newBreakdown.monthlyInhand)}`}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Hike History ── */}
      {history.length > 0 && (
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>
            📜 Hike History
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {history.map(h => (
              <div key={h._id} className="card card-sm" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
                <div style={{
                  background: 'rgba(16,185,129,0.15)', color: 'var(--success)',
                  borderRadius: 'var(--radius-sm)', padding: '6px 14px', fontWeight: 800, fontSize: 18, flexShrink: 0,
                }}>
                  +{h.hikePercent}%
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 15 }}>
                    {h.year} Hike
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    Applied {new Date(h.appliedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {formatINR(h.previousAnnualSalary)} → {formatINR(h.newAnnualSalary)}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--success)', marginTop: 2 }}>
                    In-hand: {formatINR(h.previousMonthlyInhand)} → {formatINR(h.newMonthlyInhand)}/mo
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {toast && (
        <div className="toast-container">
          <div className={`toast ${toast.type}`}>{toast.type === 'success' ? '✅' : '❌'} {toast.msg}</div>
        </div>
      )}
    </div>
  );
}

// Helper sub-components
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

// Keep DeltaBadge export-compatible
export { DeltaBadge };
