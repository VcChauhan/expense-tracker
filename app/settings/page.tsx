'use client';

import { useState, useEffect, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { formatINR, Settings, Category, Account } from '@/lib/types';
import { computeSalaryBreakdown } from '@/lib/taxUtils';
import { Save, Wallet, Folder, Edit2, ArrowUp, ArrowDown, Trash2, CheckCircle2, XCircle, Sparkles, CreditCard } from 'lucide-react';
import { CategoryIcon } from '@/components/CategoryIcon';
import { ConfirmModal } from '@/components/ConfirmModal';

interface BudgetInsight {
  categoryId: string;
  message: string;
}

const PRESET_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f97316',
  '#f59e0b', '#10b981', '#14b8a6', '#3b82f6', '#06b6d4',
];

function Row({ label, value, highlight, muted }: { label: string; value: string; highlight?: string; muted?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
      <span style={{ color: muted ? 'var(--text-muted)' : 'var(--text-secondary)' }}>{label}</span>
      <span style={{ fontWeight: 600, color: highlight || 'var(--text-primary)' }}>{value}</span>
    </div>
  );
}

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [annualSalary, setAnnualSalary] = useState<string>('0');
  const [taxRegime, setTaxRegime] = useState<'new' | 'old'>('new');
  const [basicPercent, setBasicPercent] = useState<number>(50);
  const [deductions80C, setDeductions80C] = useState<number>(0);
  const [deductions80D, setDeductions80D] = useState<number>(0);
  const [otherDeductions, setOtherDeductions] = useState<number>(0);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [editingAcc, setEditingAcc] = useState<Account | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showAddAccForm, setShowAddAccForm] = useState(false);
  const [newCat, setNewCat] = useState<{ name: string; emoji: string; monthlyBudget: number; notes: string; color: string }>({
    name: '', emoji: '🏷️', monthlyBudget: 0, notes: '', color: PRESET_COLORS[0],
  });
  const [newAcc, setNewAcc] = useState<{ name: string; type: 'credit_card' | 'bank' | 'cash'; last4Digits: string; color: string }>({
    name: '', type: 'credit_card', last4Digits: '', color: PRESET_COLORS[0],
  });
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ isOpen: boolean; type: 'category' | 'account'; id: string } | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      if (!res.ok) throw new Error('Failed to fetch settings');
      const data: Settings = await res.json();
      setAnnualSalary(String(data.annualSalary || 0));
      setTaxRegime(data.taxRegime || 'new');
      setBasicPercent(data.basicPercent ?? 50);
      setDeductions80C(data.deductions80C || 0);
      setDeductions80D(data.deductions80D || 0);
      setOtherDeductions(data.otherDeductions || 0);
      setCategories(data.categories || []);
      setAccounts(data.accounts || []);
    } catch (err) {
      showToast('Error loading settings', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const breakdown = useMemo(() => {
    const gross = parseFloat(annualSalary) || 0;
    return computeSalaryBreakdown(gross, taxRegime, basicPercent, deductions80C, deductions80D, otherDeductions);
  }, [annualSalary, taxRegime, basicPercent, deductions80C, deductions80D, otherDeductions]);

  const totalBudget = useMemo(() => {
    return categories.reduce((sum, c) => sum + (c.monthlyBudget || 0), 0);
  }, [categories]);

  const budgetPct = breakdown.monthlyInhand > 0 ? (totalBudget / breakdown.monthlyInhand) * 100 : 0;
  const remaining = breakdown.monthlyInhand - totalBudget;

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: Partial<Settings> = {
        annualSalary: parseFloat(annualSalary) || 0,
        taxRegime,
        basicPercent,
        deductions80C,
        deductions80D,
        otherDeductions,
        categories,
        accounts,
      };
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to save settings');
      showToast('Settings saved successfully', 'success');
    } catch (err) {
      showToast('Failed to save settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  const addCategory = () => {
    if (!newCat.name.trim()) return;
    const cat: Category = {
      id: uuidv4(),
      name: newCat.name.trim(),
      emoji: newCat.emoji || '🏷️',
      monthlyBudget: newCat.monthlyBudget || 0,
      notes: newCat.notes.trim(),
      color: newCat.color || PRESET_COLORS[0],
    };
    setCategories(prev => [...prev, cat]);
    setNewCat({ name: '', emoji: '🏷️', monthlyBudget: 0, notes: '', color: PRESET_COLORS[0] });
    setShowAddForm(false);
  };

  const updateCategory = (id: string, updated: Partial<Category>) => {
    setCategories(prev => prev.map(c => c.id === id ? { ...c, ...updated } : c));
  };

  const moveCat = (index: number, dir: 'up' | 'down') => {
    const target = dir === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= categories.length) return;
    const updated = [...categories];
    const temp = updated[index];
    updated[index] = updated[target];
    updated[target] = temp;
    setCategories(updated);
  };

  const addAccount = () => {
    if (!newAcc.name.trim()) return;
    const acc: Account = {
      id: uuidv4(),
      name: newAcc.name.trim(),
      type: newAcc.type,
      last4Digits: newAcc.last4Digits.trim(),
      color: newAcc.color || PRESET_COLORS[0],
    };
    setAccounts(prev => [...prev, acc]);
    setNewAcc({ name: '', type: 'credit_card', last4Digits: '', color: PRESET_COLORS[0] });
    setShowAddAccForm(false);
  };

  const updateAccount = (id: string, updated: Partial<Account>) => {
    setAccounts(prev => prev.map(a => a.id === id ? { ...a, ...updated } : a));
  };

  const handleDeleteClick = (type: 'category' | 'account', id: string) => {
    setConfirmDialog({ isOpen: true, type, id });
  };

  const confirmDelete = () => {
    if (!confirmDialog) return;
    if (confirmDialog.type === 'category') {
      setCategories(prev => prev.filter(c => c.id !== confirmDialog.id));
    } else {
      setAccounts(prev => prev.filter(a => a.id !== confirmDialog.id));
    }
    setConfirmDialog(null);
    showToast('Deleted successfully', 'success');
  };

  if (loading) {
    return <div className="page-container" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading settings...</div>;
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1 className="page-title">Settings</h1>
            <p className="page-subtitle">Configure your app and monthly budgets</p>
          </div>
          <button className="btn btn-primary" style={{ display: "flex", alignItems: "center", gap: 6 }} onClick={handleSave} disabled={saving}>
            {saving ? <span className="spinner" style={{ width: 16, height: 16 }} /> : <Save size={16} />}
            Save All
          </button>
        </div>
      </div>

      {/* ── Salary Section ── */}
      <div className="card mb-32" style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)" }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}>
          <Wallet size={20} /> Salary & Tax Configuration
        </h2>

        <div className="grid-2" style={{ marginBottom: 20 }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor="annual-salary">Annual Gross Salary (₹ CTC)</label>
            <input
              id="annual-salary" type="number" className="form-input"
              style={{ color: "var(--success)", fontWeight: 700, fontSize: 18 }}
              value={annualSalary} onChange={e => setAnnualSalary(e.target.value)}
              placeholder="e.g. 1574604"
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Monthly In-Hand</label>
            <div style={{ display: "flex", alignItems: "center", gap: 12, height: 42, padding: "0 12px", background: "var(--bg-input)", borderRadius: "var(--radius-md)", border: "1px solid var(--border)" }}>
              <span style={{ color: "var(--success)", fontWeight: 800, fontSize: 18 }}>{formatINR(breakdown.monthlyInhand)}</span>
              <span style={{ fontSize: 11, fontWeight: 700, background: "rgba(16,185,129,0.15)", color: "var(--success)", padding: "2px 8px", borderRadius: 100 }}>AUTO</span>
            </div>
          </div>
        </div>

        <div className="grid-2" style={{ marginBottom: 20 }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Tax Regime</label>
            <div className="flex gap-8">
              {(["new", "old"] as const).map(r => (
                <button
                  key={r}
                  className={`btn ${taxRegime === r ? "btn-primary" : "btn-secondary"}`}
                  style={{ flex: 1 }}
                  onClick={() => setTaxRegime(r)}
                >
                  {r === "new" ? "New (FY25-26)" : "Old Regime"}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Basic Salary % of CTC</label>
            <div className="flex items-center gap-12">
              <input
                type="range" min={30} max={80} step={5}
                value={basicPercent} onChange={e => setBasicPercent(Number(e.target.value))}
                style={{ flex: 1, accentColor: "var(--accent-primary)" }}
              />
              <span style={{ fontSize: 16, fontWeight: 700, color: "var(--accent-primary)", minWidth: 40 }}>{basicPercent}%</span>
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
              EPF deducted: {formatINR(Math.round((basicPercent / 100) * (parseFloat(annualSalary) || 0) / 12 * 0.12))}/mo
            </div>
          </div>
        </div>

        {taxRegime === "old" && (
          <div className="grid-2" style={{ marginBottom: 20 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Old Regime Deductions</label>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div className="flex items-center gap-8">
                  <span style={{ fontSize: 12, color: "var(--text-muted)", width: 120, flexShrink: 0 }}>80C (max ₹1.5L)</span>
                  <input type="number" className="form-input" style={{ padding: "8px 12px" }}
                    value={deductions80C || ""} placeholder="150000"
                    onChange={e => setDeductions80C(Math.min(parseFloat(e.target.value) || 0, 150000))} />
                </div>
                <div className="flex items-center gap-8">
                  <span style={{ fontSize: 12, color: "var(--text-muted)", width: 120, flexShrink: 0 }}>80D (max ₹25K)</span>
                  <input type="number" className="form-input" style={{ padding: "8px 12px" }}
                    value={deductions80D || ""} placeholder="25000"
                    onChange={e => setDeductions80D(Math.min(parseFloat(e.target.value) || 0, 25000))} />
                </div>
                <div className="flex items-center gap-8">
                  <span style={{ fontSize: 12, color: "var(--text-muted)", width: 120, flexShrink: 0 }}>Other</span>
                  <input type="number" className="form-input" style={{ padding: "8px 12px" }}
                    value={otherDeductions || ""} placeholder="0"
                    onChange={e => setOtherDeductions(parseFloat(e.target.value) || 0)} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Live Tax Breakdown (collapsible) ── */}
        {breakdown.annualGross > 0 && (
          <div style={{ marginTop: 4 }}>
            <button
              onClick={() => setShowBreakdown(v => !v)}
              style={{
                width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                background: "var(--bg-input)", border: "none",
                borderRadius: showBreakdown ? "var(--radius-md) var(--radius-md) 0 0" : "var(--radius-md)",
                padding: "12px 20px", cursor: "pointer", transition: "border-radius 0.2s",
              }}
            >
              <div className="flex items-center gap-12">
                <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Salary Breakdown</span>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Tax: {breakdown.effectiveTaxRate}%</span>
              </div>
              <span style={{ fontSize: 16, color: "var(--text-muted)", transition: "transform 0.2s", transform: showBreakdown ? "rotate(180deg)" : "none" }}>▾</span>
            </button>

            {showBreakdown && (
              <div style={{
                background: "var(--bg-input)", borderRadius: "0 0 var(--radius-md) var(--radius-md)",
                padding: "0 20px 16px", borderTop: "none",
              }}>
                <div style={{ paddingTop: 12 }}>
                  <Row label="Annual Gross (CTC)"        value={formatINR(breakdown.annualGross)} />
                  <Row label={`Basic (${basicPercent}% of CTC)`} value={formatINR(breakdown.basicAnnual)} muted />
                  <Row label={`Employee EPF (12% of basic)`} value={`− ${formatINR(breakdown.epfEmployee)}`} highlight="var(--warning)" />
                  <Row label={`Standard Deduction`}      value={`− ${formatINR(breakdown.standardDeduction)}`} muted />
                  {taxRegime === "old" && breakdown.deductionsApplied > 0 &&
                    <Row label="80C / 80D / Other Deductions" value={`− ${formatINR(breakdown.deductionsApplied)}`} muted />
                  }
                  <Row label="Taxable Income"             value={formatINR(breakdown.taxableIncome)} />
                  <Row label="Income Tax + Cess (4%)"     value={`− ${formatINR(breakdown.annualTax)}`} highlight="var(--danger)" />
                  <Row label="Professional Tax"           value={`− ${formatINR(breakdown.professionalTax)}`} muted />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Budget vs In-hand bar */}
        {breakdown.monthlyInhand > 0 && (
          <div style={{ marginTop: 20, paddingTop: 20, borderTop: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between mb-8">
              <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                Total budgeted: <strong style={{ color: budgetPct > 100 ? "var(--danger)" : "var(--text-primary)" }}>{formatINR(totalBudget)}</strong>
                <span style={{ color: "var(--text-muted)", marginLeft: 6 }}>({budgetPct.toFixed(1)}% of in-hand)</span>
              </span>
              <span style={{ fontSize: 13, color: remaining >= 0 ? "var(--success)" : "var(--danger)", fontWeight: 600 }}>
                {remaining >= 0 ? "✅" : "⚠️"} Remaining: {formatINR(remaining)}
              </span>
            </div>
            <div className="budget-track">
              <div
                className={`budget-fill ${budgetPct >= 100 ? "danger" : budgetPct >= 90 ? "warning" : "safe"}`}
                style={{ width: `${Math.min(budgetPct, 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      <div className="card mb-32" style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)" }}>
        <div className="page-header-row mb-16">
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 8 }}>
            <Folder size={20} /> Expense Categories
          </h2>
          <button className="btn btn-primary btn-sm" onClick={() => setShowAddForm(s => !s)}>
            {showAddForm ? "Cancel" : "Add Category"}
          </button>
        </div>

        {showAddForm && (
          <div className="card mb-16" style={{ borderColor: "var(--accent-primary)" }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, color: "var(--accent-primary)" }}>New Category</h3>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Name</label>
                <input type="text" className="form-input" placeholder="e.g. Dining Out"
                  value={newCat.name} onChange={e => setNewCat(n => ({ ...n, name: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Monthly Budget (₹)</label>
                <input type="number" className="form-input" placeholder="5000"
                  value={newCat.monthlyBudget || ""} onChange={e => setNewCat(n => ({ ...n, monthlyBudget: parseFloat(e.target.value) || 0 }))} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Color</label>
              <div className="flex gap-8" style={{ flexWrap: "wrap" }}>
                {PRESET_COLORS.map(col => (
                  <button key={col} type="button"
                    style={{ width: 28, height: 28, borderRadius: "50%", background: col, border: newCat.color === col ? "3px solid white" : "3px solid transparent", cursor: "pointer", boxShadow: newCat.color === col ? `0 0 0 2px ${col}` : "none" }}
                    onClick={() => setNewCat(n => ({ ...n, color: col }))} />
                ))}
              </div>
            </div>
            <button className="btn btn-primary" onClick={addCategory}>Add Category</button>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {categories.map((cat, idx) => {
            const pct = breakdown.monthlyInhand > 0 ? ((cat.monthlyBudget / breakdown.monthlyInhand) * 100) : 0;
            return (
              <div key={cat.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px", background: "var(--bg-secondary)", borderRadius: "var(--radius-md)", border: "1px solid var(--border)" }}>
                <div style={{ width: 40, height: 40, borderRadius: "50%", background: `${cat.color}22`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <CategoryIcon name={cat.name} size={20} color={cat.color} />
                </div>
                <div style={{ flex: 1 }}>
                  {editingCat?.id === cat.id ? (
                    <input type="text" className="form-input" style={{ width: "100%", marginBottom: 4 }} value={editingCat.name} onChange={e => setEditingCat({ ...editingCat, name: e.target.value })} />
                  ) : (
                    <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{cat.name}</div>
                  )}
                  {editingCat?.id === cat.id ? (
                    <input type="number" className="form-input" style={{ width: 120 }} value={editingCat.monthlyBudget} onChange={e => setEditingCat({ ...editingCat, monthlyBudget: parseFloat(e.target.value) || 0 })} />
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                      <span style={{ fontWeight: 700, color: "var(--warning)", fontSize: 14 }}>{formatINR(cat.monthlyBudget)}</span>
                      <span style={{ fontSize: 11, background: "var(--bg-input)", padding: "2px 6px", borderRadius: 4, color: "var(--text-muted)" }}>{pct.toFixed(1)}%</span>
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <div className="flex gap-4">
                    {editingCat?.id === cat.id ? (
                      <>
                        <button className="btn btn-primary btn-sm" onClick={() => { updateCategory(cat.id, editingCat); setEditingCat(null); }}>✓</button>
                        <button className="btn btn-secondary btn-sm" onClick={() => setEditingCat(null)}>✕</button>
                      </>
                    ) : (
                      <>
                        <button className="btn-text" style={{ cursor: "pointer", border: "none", padding: "4px", display: "flex", alignItems: "center" }} onClick={() => setEditingCat({ ...cat })} title="Edit"><Edit2 size={16} /></button>
                        <button className="btn-text" style={{ cursor: "pointer", border: "none", padding: "4px", display: "flex", alignItems: "center" }} onClick={() => moveCat(idx, 'up')} disabled={idx === 0} title="Move up"><ArrowUp size={16} /></button>
                        <button className="btn-text" style={{ cursor: "pointer", border: "none", padding: "4px", display: "flex", alignItems: "center" }} onClick={() => moveCat(idx, 'down')} disabled={idx === categories.length - 1} title="Move down"><ArrowDown size={16} /></button>
                        <button className="btn-text" style={{ cursor: "pointer", border: "none", padding: "4px", display: "flex", alignItems: "center", color: "var(--danger)" }} onClick={() => handleDeleteClick('category', cat.id)} title="Delete"><Trash2 size={16} /></button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card mb-32" style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)" }}>
        <div className="page-header-row mb-16">
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 8 }}>
            <CreditCard size={20} /> Accounts & Cards
          </h2>
          <button className="btn btn-primary btn-sm" onClick={() => setShowAddAccForm(s => !s)}>
            {showAddAccForm ? "Cancel" : "Add Account"}
          </button>
        </div>

        {showAddAccForm && (
          <div className="card mb-16" style={{ borderColor: "var(--accent-primary)" }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, color: "var(--accent-primary)" }}>New Account / Card</h3>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Name</label>
                <input type="text" className="form-input" placeholder="Name"
                  value={newAcc.name} onChange={e => setNewAcc(n => ({ ...n, name: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Type</label>
                <select className="form-select" value={newAcc.type} onChange={e => setNewAcc(n => ({ ...n, type: e.target.value as any }))}>
                  <option value="credit_card">Credit Card</option>
                  <option value="bank">Bank Account</option>
                  <option value="cash">Cash / Wallet</option>
                </select>
              </div>
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Last 4 Digits (Optional)</label>
                <input type="text" className="form-input" placeholder="e.g. 3249" maxLength={4}
                  value={newAcc.last4Digits} onChange={e => setNewAcc(n => ({ ...n, last4Digits: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Color</label>
                <div className="flex gap-8" style={{ flexWrap: "wrap" }}>
                  {PRESET_COLORS.map(col => (
                    <button key={col} type="button"
                      style={{ width: 28, height: 28, borderRadius: "50%", background: col, border: newAcc.color === col ? "3px solid white" : "3px solid transparent", cursor: "pointer", boxShadow: newAcc.color === col ? `0 0 0 2px ${col}` : "none" }}
                      onClick={() => setNewAcc(n => ({ ...n, color: col }))} />
                  ))}
                </div>
              </div>
            </div>
            <button className="btn btn-primary" onClick={addAccount}>Add Account</button>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {accounts.map((acc) => (
            <div key={acc.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px", background: "var(--bg-secondary)", borderRadius: "var(--radius-md)", border: "1px solid var(--border)" }}>
              <div style={{ width: 40, height: 40, borderRadius: "50%", background: `${acc.color}22`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Wallet size={20} color={acc.color} />
              </div>
              <div style={{ flex: 1 }}>
                {editingAcc?.id === acc.id ? (
                  <input type="text" className="form-input" style={{ width: "100%", marginBottom: 4 }} value={editingAcc.name} onChange={e => setEditingAcc({ ...editingAcc, name: e.target.value })} />
                ) : (
                  <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{acc.name}</div>
                )}
                {editingAcc?.id === acc.id ? (
                  <select className="form-select" style={{ width: 120 }} value={editingAcc.type} onChange={e => setEditingAcc({ ...editingAcc, type: e.target.value as any })}>
                    <option value="credit_card">Credit Card</option>
                    <option value="bank">Bank Account</option>
                    <option value="cash">Cash / Wallet</option>
                  </select>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                    <span style={{ fontSize: 11, background: "var(--bg-input)", padding: "2px 6px", borderRadius: 4, color: "var(--text-muted)", textTransform: "capitalize" }}>{acc.type.replace("_", " ")}</span>
                    {acc.last4Digits && <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>•••• {acc.last4Digits}</span>}
                  </div>
                )}
              </div>
              <div style={{ display: "flex", gap: 4 }}>
                {editingAcc?.id === acc.id ? (
                  <>
                    <button className="btn btn-primary btn-sm" onClick={() => { updateAccount(acc.id, editingAcc); setEditingAcc(null); }}>✓</button>
                    <button className="btn btn-secondary btn-sm" onClick={() => setEditingAcc(null)}>✕</button>
                  </>
                ) : (
                  <>
                    <button className="btn-text" style={{ cursor: "pointer", border: "none", padding: "4px", display: "flex", alignItems: "center" }} onClick={() => setEditingAcc({ ...acc })} title="Edit"><Edit2 size={16} /></button>
                    <button className="btn-text" style={{ cursor: "pointer", border: "none", padding: "4px", display: "flex", alignItems: "center", color: "var(--danger)" }} onClick={() => handleDeleteClick('account', acc.id)} title="Delete"><Trash2 size={16} /></button>
                  </>
                )}
              </div>
            </div>
          ))}
          {accounts.length === 0 && (
            <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "20px 0" }}>No accounts added yet.</div>
          )}
        </div>
      </div>

      {toast && (
        <div className="toast-container">
          <div className={`toast ${toast.type}`}>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {toast.type === "success" ? <CheckCircle2 size={18} /> : <XCircle size={18} />} {toast.msg}
            </span>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={!!confirmDialog?.isOpen}
        message='Delete this? Existing expenses will still be stored but may show as "Unknown".'
        onConfirm={confirmDelete}
        onCancel={() => setConfirmDialog(null)}
      />
    </div>
  );
}
