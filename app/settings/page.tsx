'use client';

import { useState, useEffect, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { formatINR, Settings, Category } from '@/lib/types';
import { computeSalaryBreakdown } from '@/lib/taxUtils';

const PRESET_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f97316',
  '#f59e0b', '#10b981', '#14b8a6', '#3b82f6', '#06b6d4',
];

const PRESET_EMOJIS = ['🏠', '⚡', '🚗', '🛒', '📈', '👨‍👩‍👧', '📱', '🎲', '🍔', '🎓', '💊', '✈️', '🎮', '👕', '🏋️'];

function Row({ label, value, highlight, muted }: { label: string; value: string; highlight?: string; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between" style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: 13, color: muted ? 'var(--text-muted)' : 'var(--text-secondary)' }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 600, color: highlight ?? 'var(--text-primary)' }}>{value}</span>
    </div>
  );
}

export default function SettingsPage() {
  const [settings, setSettings]   = useState<Settings | null>(null);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [toast, setToast]         = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  // Salary fields
  const [annualSalary, setAnnualSalary]       = useState('');
  const [taxRegime, setTaxRegime]             = useState<'new' | 'old'>('new');
  const [basicPercent, setBasicPercent]       = useState(50);
  const [deductions80C, setDeductions80C]     = useState(0);
  const [deductions80D, setDeductions80D]     = useState(0);
  const [otherDeductions, setOtherDeductions] = useState(0);

  // UI state
  const [showBreakdown, setShowBreakdown] = useState(false);

  // Category fields
  const [categories, setCategories] = useState<Category[]>([]);
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newCat, setNewCat] = useState<Omit<Category, 'id'>>({
    name: '', emoji: '💰', monthlyBudget: 0, notes: '', color: '#6366f1'
  });

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(s => {
      if (s && !s.error) {
        setSettings(s);
        setAnnualSalary(String(s.annualSalary ?? ''));
        setTaxRegime(s.taxRegime ?? 'new');
        setBasicPercent(s.basicPercent ?? 50);
        setDeductions80C(s.deductions80C ?? 0);
        setDeductions80D(s.deductions80D ?? 0);
        setOtherDeductions(s.otherDeductions ?? 0);
        setCategories(s.categories ?? []);
      }
      setLoading(false);
    });
  }, []);

  // Live salary breakdown computed client-side for instant feedback
  const breakdown = useMemo(() =>
    computeSalaryBreakdown(
      parseFloat(annualSalary) || 0,
      taxRegime,
      basicPercent,
      deductions80C,
      deductions80D,
      otherDeductions,
    )
  , [annualSalary, taxRegime, basicPercent, deductions80C, deductions80D, otherDeductions]);

  const totalBudget = categories.reduce((s, c) => s + Number(c.monthlyBudget), 0);
  const budgetPct   = breakdown.monthlyInhand > 0 ? (totalBudget / breakdown.monthlyInhand) * 100 : 0;
  const remaining   = breakdown.monthlyInhand - totalBudget;

  function showToast(msg: string, type: 'success' | 'error') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          annualSalary: parseFloat(annualSalary) || 0,
          taxRegime, basicPercent,
          deductions80C, deductions80D, otherDeductions,
          categories,
        }),
      });
      const updated = await res.json();
      if (!updated.error) setSettings(updated);
      showToast('Settings saved!', 'success');
    } catch {
      showToast('Failed to save', 'error');
    } finally {
      setSaving(false);
    }
  }

  function addCategory() {
    if (!newCat.name.trim()) return;
    setCategories(cats => [...cats, { ...newCat, id: uuidv4(), monthlyBudget: Number(newCat.monthlyBudget) }]);
    setNewCat({ name: '', emoji: '💰', monthlyBudget: 0, notes: '', color: '#6366f1' });
    setShowAddForm(false);
  }

  function updateCategory(id: string, changes: Partial<Category>) {
    setCategories(cats => cats.map(c => c.id === id ? { ...c, ...changes } : c));
  }

  function deleteCategory(id: string) {
    if (!confirm('Delete this category? Existing expenses will still be stored but may show as "Unknown".')) return;
    setCategories(cats => cats.filter(c => c.id !== id));
  }

  function moveCat(id: string, dir: -1 | 1) {
    setCategories(cats => {
      const idx = cats.findIndex(c => c.id === id);
      if (idx + dir < 0 || idx + dir >= cats.length) return cats;
      const arr = [...cats];
      [arr[idx], arr[idx + dir]] = [arr[idx + dir], arr[idx]];
      return arr;
    });
  }

  if (loading) return <div className="page-container"><div className="loading-overlay"><div className="spinner" /></div></div>;

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1 className="page-title">⚙️ Budget Planner</h1>
            <p className="page-subtitle">Set your salary, tax regime, and monthly budgets</p>
          </div>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? <span className="spinner" style={{ width: 16, height: 16 }} /> : '💾'}
            Save All Changes
          </button>
        </div>
      </div>

      {/* ── Salary Section ── */}
      <div className="card mb-32">
        <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 20 }}>
          💵 Salary & Tax Configuration
        </h2>

        <div className="grid-2" style={{ marginBottom: 20 }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor="annual-salary">Annual Gross Salary (₹ CTC)</label>
            <input
              id="annual-salary" type="number" className="form-input"
              value={annualSalary} onChange={e => setAnnualSalary(e.target.value)}
              placeholder="e.g. 1574604"
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Tax Regime</label>
            <div className="flex gap-8">
              {(['new', 'old'] as const).map(r => (
                <button
                  key={r}
                  className={`btn ${taxRegime === r ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ flex: 1 }}
                  onClick={() => setTaxRegime(r)}
                >
                  {r === 'new' ? '🆕 New (FY25-26)' : '📋 Old Regime'}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid-2" style={{ marginBottom: 20 }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Basic Salary % of CTC</label>
            <div className="flex items-center gap-12">
              <input
                type="range" min={30} max={80} step={5}
                value={basicPercent} onChange={e => setBasicPercent(Number(e.target.value))}
                style={{ flex: 1, accentColor: 'var(--accent-primary)' }}
              />
              <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent-primary)', minWidth: 40 }}>{basicPercent}%</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
              EPF deducted on full basic: {formatINR(Math.round((basicPercent / 100) * (parseFloat(annualSalary) || 0) / 12 * 0.12))}/mo
              &nbsp;(12% of basic, regulatory rate)
            </div>
          </div>

          {taxRegime === 'old' && (
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Old Regime Deductions</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div className="flex items-center gap-8">
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', width: 120, flexShrink: 0 }}>80C (max ₹1.5L)</span>
                  <input type="number" className="form-input" style={{ padding: '8px 12px' }}
                    value={deductions80C || ''} placeholder="150000"
                    onChange={e => setDeductions80C(Math.min(parseFloat(e.target.value) || 0, 150000))} />
                </div>
                <div className="flex items-center gap-8">
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', width: 120, flexShrink: 0 }}>80D (max ₹25K)</span>
                  <input type="number" className="form-input" style={{ padding: '8px 12px' }}
                    value={deductions80D || ''} placeholder="25000"
                    onChange={e => setDeductions80D(Math.min(parseFloat(e.target.value) || 0, 25000))} />
                </div>
                <div className="flex items-center gap-8">
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', width: 120, flexShrink: 0 }}>Other deductions</span>
                  <input type="number" className="form-input" style={{ padding: '8px 12px' }}
                    value={otherDeductions || ''} placeholder="0"
                    onChange={e => setOtherDeductions(parseFloat(e.target.value) || 0)} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Live Tax Breakdown (collapsible) ── */}
        {breakdown.annualGross > 0 && (
          <div style={{ marginTop: 4 }}>
            {/* Always-visible summary chip — click to expand */}
            <button
              onClick={() => setShowBreakdown(v => !v)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: 'var(--bg-input)', border: '1px solid var(--border)',
                borderRadius: showBreakdown ? 'var(--radius-md) var(--radius-md) 0 0' : 'var(--radius-md)',
                padding: '12px 20px', cursor: 'pointer', transition: 'border-radius 0.2s',
              }}
            >
              <div className="flex items-center gap-12">
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>📊 Salary Breakdown</span>
                <span style={{
                  fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 100,
                  background: 'rgba(16,185,129,0.15)', color: 'var(--success)',
                }}>🏦 {formatINR(breakdown.monthlyInhand)}/mo in-hand</span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Tax: {breakdown.effectiveTaxRate}%</span>
              </div>
              <span style={{ fontSize: 16, color: 'var(--text-muted)', transition: 'transform 0.2s', transform: showBreakdown ? 'rotate(180deg)' : 'none' }}>▾</span>
            </button>

            {/* Expandable detail panel */}
            {showBreakdown && (
              <div style={{
                background: 'var(--bg-input)', borderRadius: '0 0 var(--radius-md) var(--radius-md)',
                padding: '0 20px 16px', borderTop: '1px solid var(--border)',
                border: '1px solid var(--border)', borderTopColor: 'transparent',
              }}>
                <div style={{ paddingTop: 12 }}>
                  <Row label="Annual Gross (CTC)"        value={formatINR(breakdown.annualGross)} />
                  <Row label={`Basic (${basicPercent}% of CTC)`} value={formatINR(breakdown.basicAnnual)} muted />
                  <Row label={`Employee EPF (12% of basic)`} value={`− ${formatINR(breakdown.epfEmployee)}`} highlight="var(--warning)" />
                  <Row label={`Standard Deduction (${taxRegime === 'new' ? '₹75,000' : '₹50,000'})`}
                       value={`− ${formatINR(breakdown.standardDeduction)}`} muted />
                  {taxRegime === 'old' && breakdown.deductionsApplied > 0 &&
                    <Row label="80C / 80D / Other Deductions" value={`− ${formatINR(breakdown.deductionsApplied)}`} muted />
                  }
                  <Row label="Taxable Income"             value={formatINR(breakdown.taxableIncome)} />
                  <Row label="Income Tax + Cess (4%)"     value={`− ${formatINR(breakdown.annualTax)}`} highlight="var(--danger)" />
                  <Row label="Professional Tax"           value={`− ${formatINR(breakdown.professionalTax)}`} muted />
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12, marginTop: 4 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>🏦 Monthly In-Hand</span>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--success)', fontFamily: "'Space Grotesk', sans-serif" }}>
                        {formatINR(breakdown.monthlyInhand)}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Effective tax rate: {breakdown.effectiveTaxRate}%</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Budget vs In-hand bar */}
        {breakdown.monthlyInhand > 0 && (
          <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between mb-8">
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                Total budgeted: <strong style={{ color: budgetPct > 100 ? 'var(--danger)' : 'var(--text-primary)' }}>{formatINR(totalBudget)}</strong>
                <span style={{ color: 'var(--text-muted)', marginLeft: 6 }}>({budgetPct.toFixed(1)}% of in-hand)</span>
              </span>
              <span style={{ fontSize: 13, color: remaining >= 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 600 }}>
                {remaining >= 0 ? '✅' : '⚠️'} Remaining: {formatINR(remaining)}
              </span>
            </div>
            <div className="budget-track">
              <div
                className={`budget-fill ${budgetPct >= 100 ? 'danger' : budgetPct >= 90 ? 'warning' : 'safe'}`}
                style={{ width: `${Math.min(budgetPct, 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── Categories ── */}
      <div>
        <div className="page-header-row mb-16">
          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>📂 Expense Categories</h2>
          <button className="btn btn-primary btn-sm" onClick={() => setShowAddForm(s => !s)}>
            {showAddForm ? '✕ Cancel' : '➕ Add Category'}
          </button>
        </div>

        {showAddForm && (
          <div className="card mb-16" style={{ borderColor: 'var(--accent-primary)' }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, color: 'var(--accent-primary)' }}>New Category</h3>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Name</label>
                <input type="text" className="form-input" placeholder="e.g. Dining Out"
                  value={newCat.name} onChange={e => setNewCat(n => ({ ...n, name: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Monthly Budget (₹)</label>
                <input type="number" className="form-input" placeholder="5000"
                  value={newCat.monthlyBudget || ''} onChange={e => setNewCat(n => ({ ...n, monthlyBudget: parseFloat(e.target.value) || 0 }))} />
              </div>
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Notes</label>
                <input type="text" className="form-input" placeholder="Optional description"
                  value={newCat.notes} onChange={e => setNewCat(n => ({ ...n, notes: e.target.value }))} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Emoji</label>
              <div className="flex gap-8" style={{ flexWrap: 'wrap' }}>
                {PRESET_EMOJIS.map(em => (
                  <button key={em} type="button"
                    style={{ fontSize: 22, padding: '6px 8px', borderRadius: 8, border: newCat.emoji === em ? '2px solid var(--accent-primary)' : '2px solid transparent', background: 'var(--bg-input)', cursor: 'pointer' }}
                    onClick={() => setNewCat(n => ({ ...n, emoji: em }))}>{em}</button>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Color</label>
              <div className="flex gap-8" style={{ flexWrap: 'wrap' }}>
                {PRESET_COLORS.map(col => (
                  <button key={col} type="button"
                    style={{ width: 28, height: 28, borderRadius: '50%', background: col, border: newCat.color === col ? '3px solid white' : '3px solid transparent', cursor: 'pointer', boxShadow: newCat.color === col ? `0 0 0 2px ${col}` : 'none' }}
                    onClick={() => setNewCat(n => ({ ...n, color: col }))} />
                ))}
              </div>
            </div>
            <button className="btn btn-primary" onClick={addCategory}>Add Category</button>
          </div>
        )}

        <div className="table-wrapper mobile-card-table">
          <table>
            <thead>
              <tr>
                <th style={{ width: 40 }}>#</th>
                <th>Category</th>
                <th>Monthly Budget</th>
                <th>% of In-Hand</th>
                <th>Notes</th>
                <th style={{ width: 120 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((cat, idx) => (
                <tr key={cat.id}>
                  <td data-label="#" className="hide-on-mobile" style={{ color: 'var(--text-muted)', fontSize: 13 }}>{idx + 1}</td>
                  <td data-label="Category">
                    {editingCat?.id === cat.id ? (
                      <div className="flex items-center gap-8">
                        <input type="text" className="form-input" style={{ width: 130, padding: '6px 10px', fontSize: 13 }}
                          value={editingCat.name} onChange={e => setEditingCat({ ...editingCat, name: e.target.value })} />
                        <select className="form-input" style={{ width: 60, padding: '6px 8px', fontSize: 18, textAlign: 'center' }}
                          value={editingCat.emoji} onChange={e => setEditingCat({ ...editingCat, emoji: e.target.value })}>
                          {PRESET_EMOJIS.map(em => <option key={em} value={em}>{em}</option>)}
                        </select>
                      </div>
                    ) : (
                      <span className="flex items-center gap-8">
                        <span style={{ width: 10, height: 10, borderRadius: '50%', background: cat.color, display: 'inline-block', flexShrink: 0 }} />
                        <span style={{ fontSize: 18 }}>{cat.emoji}</span>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{cat.name}</span>
                      </span>
                    )}
                  </td>
                  <td data-label="Budget">
                    {editingCat?.id === cat.id ? (
                      <input type="number" className="form-input" style={{ width: 110, padding: '6px 10px', fontSize: 13 }}
                        value={editingCat.monthlyBudget} onChange={e => setEditingCat({ ...editingCat, monthlyBudget: parseFloat(e.target.value) || 0 })} />
                    ) : (
                      <span style={{ fontWeight: 600, color: 'var(--warning)' }}>{formatINR(cat.monthlyBudget)}</span>
                    )}
                  </td>
                  <td data-label="% of In-Hand" style={{ color: 'var(--text-secondary)' }}>
                    {breakdown.monthlyInhand > 0 ? ((cat.monthlyBudget / breakdown.monthlyInhand) * 100).toFixed(1) : 0}%
                  </td>
                  <td data-label="Notes" className="hide-on-mobile" style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                    {editingCat?.id === cat.id ? (
                      <input type="text" className="form-input" style={{ padding: '6px 10px', fontSize: 13 }}
                        value={editingCat.notes} onChange={e => setEditingCat({ ...editingCat, notes: e.target.value })} />
                    ) : cat.notes || '—'}
                  </td>
                  <td data-label="Actions">
                    <div className="flex gap-8">
                      {editingCat?.id === cat.id ? (
                        <>
                          <button className="btn btn-primary btn-sm" onClick={() => { updateCategory(cat.id, editingCat); setEditingCat(null); }}>✓</button>
                          <button className="btn btn-secondary btn-sm" onClick={() => setEditingCat(null)}>✕</button>
                        </>
                      ) : (
                        <>
                          <button className="btn btn-secondary btn-icon btn-sm" onClick={() => setEditingCat({ ...cat })} title="Edit">✏️</button>
                          <button className="btn btn-secondary btn-icon btn-sm hide-on-mobile" onClick={() => moveCat(cat.id, -1)} disabled={idx === 0} title="Move up">↑</button>
                          <button className="btn btn-secondary btn-icon btn-sm hide-on-mobile" onClick={() => moveCat(cat.id, 1)} disabled={idx === categories.length - 1} title="Move down">↓</button>
                          <button className="btn btn-danger btn-icon btn-sm" onClick={() => deleteCategory(cat.id)} title="Delete">🗑️</button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              <tr style={{ background: 'var(--bg-secondary)', borderTop: '2px solid var(--border-light)' }}>
                <td data-label="Summary" className="hide-on-mobile" colSpan={2} style={{ fontWeight: 700, color: 'var(--text-primary)' }}>TOTAL BUDGETED</td>
                <td data-label="Total Budgeted" style={{ fontWeight: 700, color: budgetPct > 100 ? 'var(--danger)' : 'var(--warning)' }}>{formatINR(totalBudget)}</td>
                <td data-label="% of In-Hand" style={{ fontWeight: 700, color: budgetPct > 100 ? 'var(--danger)' : 'var(--text-secondary)' }}>{budgetPct.toFixed(1)}%</td>
                <td className="hide-on-mobile" colSpan={2} />
              </tr>
              <tr style={{ background: 'var(--bg-secondary)' }}>
                <td data-label="Summary" className="hide-on-mobile" colSpan={2} style={{ fontWeight: 700, color: 'var(--success)' }}>💰 EXPECTED SAVINGS</td>
                <td data-label="Expected Savings" style={{ fontWeight: 700, color: remaining >= 0 ? 'var(--success)' : 'var(--danger)' }}>{formatINR(remaining)}</td>
                <td data-label="% Savings" style={{ color: 'var(--text-muted)' }}>{breakdown.monthlyInhand > 0 ? (100 - budgetPct).toFixed(1) : 0}%</td>
                <td className="hide-on-mobile" colSpan={2} style={{ color: 'var(--text-muted)', fontSize: 12 }}>In-hand − Total Budget</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? <span className="spinner" style={{ width: 16, height: 16 }} /> : '💾'}
            Save All Changes
          </button>
        </div>
      </div>

      {toast && (
        <div className="toast-container">
          <div className={`toast ${toast.type}`}>{toast.type === 'success' ? '✅' : '❌'} {toast.msg}</div>
        </div>
      )}
    </div>
  );
}
