'use client';

import { useState, useEffect, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { formatINR, Settings, Category, SavingsGoal } from '@/lib/types';
import { computeSalaryBreakdown } from '@/lib/taxUtils';
import { Save, Wallet, Folder, Edit2, ArrowUp, ArrowDown, Trash2, CheckCircle2, XCircle, Sparkles, CreditCard, Bell, Repeat, Compass } from 'lucide-react';
import { CategoryIcon } from '@/components/CategoryIcon';
import { ConfirmModal } from '@/components/ConfirmModal';
import { PushNotificationSetup } from '@/components/PushNotificationSetup';
import { RecurringExpenseManager } from '@/components/RecurringExpenseManager';
import { CreditCardTracker } from '@/components/CreditCardTracker';
import { OnboardingWizard } from '@/components/OnboardingWizard';

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
  const [savingsGoals, setSavingsGoals] = useState<SavingsGoal[]>([]);
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [editingGoal, setEditingGoal] = useState<SavingsGoal | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showAddGoalForm, setShowAddGoalForm] = useState(false);
  const [newCat, setNewCat] = useState<{ name: string; emoji: string; monthlyBudget: number; notes: string; color: string }>({
    name: '', emoji: '🏷️', monthlyBudget: 0, notes: '', color: PRESET_COLORS[0],
  });
  const [newGoal, setNewGoal] = useState<Omit<SavingsGoal, 'id'>>({
    name: '', targetAmount: 0, currentAmount: 0, targetDate: new Date().toISOString().split('T')[0], icon: '🎯', color: '#10b981'
  });
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ isOpen: boolean; type: 'category' | 'goal'; id: string } | null>(null);
  const [rawSettings, setRawSettings] = useState<Settings | null>(null);
  const [showTour, setShowTour] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      if (!res.ok) throw new Error('Failed to fetch settings');
      const data: Settings = await res.json();
      setRawSettings(data);
      setAnnualSalary(String(data.annualSalary || 0));
      setTaxRegime(data.taxRegime || 'new');
      setBasicPercent(data.basicPercent ?? 50);
      setDeductions80C(data.deductions80C || 0);
      setDeductions80D(data.deductions80D || 0);
      setOtherDeductions(data.otherDeductions || 0);
      setCategories(data.categories || []);
      setSavingsGoals(data.savingsGoals || []);
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
        savingsGoals,
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

  const handleDeleteClick = (type: 'category' | 'goal', id: string) => {
    setConfirmDialog({ isOpen: true, type, id });
  };

  const confirmDelete = async () => {
    if (!confirmDialog) return;
    if (confirmDialog.type === 'category') {
      const updated = categories.filter(c => c.id !== confirmDialog.id);
      setCategories(updated);
      await fetch('/api/settings', { method: 'PATCH', body: JSON.stringify({ categories: updated }) });
    } else if (confirmDialog.type === 'goal') {
      const updated = savingsGoals.filter(g => g.id !== confirmDialog.id);
      setSavingsGoals(updated);
      await fetch('/api/settings', { method: 'PATCH', body: JSON.stringify({ savingsGoals: updated }) });
    }
    setConfirmDialog(null);
    showToast('Deleted successfully', 'success');
  };

  const addGoal = async () => {
    if (!newGoal.name || newGoal.targetAmount <= 0) { showToast('Name and Target Amount are required', 'error'); return; }
    const updated = [...savingsGoals, { id: uuidv4(), ...newGoal }];
    setSavingsGoals(updated);
    setNewGoal({ name: '', targetAmount: 0, currentAmount: 0, targetDate: new Date().toISOString().split('T')[0], icon: '🎯', color: '#10b981' });
    setShowAddGoalForm(false);
    
    try {
      await fetch('/api/settings', { method: 'PATCH', body: JSON.stringify({ savingsGoals: updated }) });
      showToast('Goal saved successfully', 'success');
    } catch (e) {
      showToast('Failed to save goal', 'error');
    }
  };

  const updateGoal = async (id: string, updatedGoal: SavingsGoal) => {
    const updated = savingsGoals.map(g => g.id === id ? updatedGoal : g);
    setSavingsGoals(updated);
    try {
      await fetch('/api/settings', { method: 'PATCH', body: JSON.stringify({ savingsGoals: updated }) });
      showToast('Goal updated successfully', 'success');
    } catch (e) {
      showToast('Failed to update goal', 'error');
    }
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

      {/* ── Savings Goals Section ── */}
      <div className="card mb-32" style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 8 }}>
            <Folder size={20} /> Savings Goals
          </h2>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowAddGoalForm(!showAddGoalForm)}>
            {showAddGoalForm ? 'Cancel' : '+ Add Goal'}
          </button>
        </div>

        {showAddGoalForm && (
          <div style={{ background: "var(--bg-secondary)", padding: 16, borderRadius: "var(--radius-md)", marginBottom: 16, border: "1px solid var(--border)" }}>
            <div className="grid-2" style={{ marginBottom: 16 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Goal Name</label>
                <input type="text" className="form-input" value={newGoal.name} onChange={e => setNewGoal({ ...newGoal, name: e.target.value })} placeholder="e.g. Vacation Fund" />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Target Amount</label>
                <input type="number" className="form-input" value={newGoal.targetAmount || ''} onChange={e => setNewGoal({ ...newGoal, targetAmount: parseFloat(e.target.value) || 0 })} placeholder="50000" />
              </div>
            </div>
            <div className="grid-2" style={{ marginBottom: 16 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Current Saved Amount</label>
                <input type="number" className="form-input" value={newGoal.currentAmount || ''} onChange={e => setNewGoal({ ...newGoal, currentAmount: parseFloat(e.target.value) || 0 })} placeholder="0" />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Target Date</label>
                <input type="date" className="form-input" value={newGoal.targetDate} onChange={e => setNewGoal({ ...newGoal, targetDate: e.target.value })} />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-primary" onClick={addGoal}>Add Goal</button>
            </div>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {savingsGoals.length === 0 && !showAddGoalForm && (
            <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: 14 }}>
              No savings goals yet. Add one to start tracking!
            </div>
          )}
          {savingsGoals.map(goal => {
            const progress = goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0;
            return (
              <div key={goal.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px", background: "var(--bg-secondary)", borderRadius: "var(--radius-md)", border: "1px solid var(--border)" }}>
                <div style={{ width: 40, height: 40, borderRadius: "50%", background: `${goal.color}22`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 20 }}>
                  {goal.icon}
                </div>
                <div style={{ flex: 1 }}>
                  {editingGoal?.id === goal.id ? (
                    <input type="text" className="form-input" style={{ width: "100%", marginBottom: 4 }} value={editingGoal.name} onChange={e => setEditingGoal({ ...editingGoal, name: e.target.value })} />
                  ) : (
                    <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{goal.name}</div>
                  )}
                  {editingGoal?.id === goal.id ? (
                    <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                       <input type="number" className="form-input" style={{ width: 100 }} value={editingGoal.currentAmount} onChange={e => setEditingGoal({ ...editingGoal, currentAmount: parseFloat(e.target.value) || 0 })} placeholder="Current" />
                       <span style={{ alignSelf: 'center', color: 'var(--text-muted)' }}>/</span>
                       <input type="number" className="form-input" style={{ width: 100 }} value={editingGoal.targetAmount} onChange={e => setEditingGoal({ ...editingGoal, targetAmount: parseFloat(e.target.value) || 0 })} placeholder="Target" />
                    </div>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                      <span style={{ fontWeight: 700, color: "var(--success)", fontSize: 14 }}>{formatINR(goal.currentAmount)}</span>
                      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>of {formatINR(goal.targetAmount)}</span>
                      <span style={{ fontSize: 11, background: "var(--bg-input)", padding: "2px 6px", borderRadius: 4, color: "var(--text-muted)" }}>{progress.toFixed(1)}%</span>
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <div className="flex gap-4">
                    {editingGoal?.id === goal.id ? (
                      <>
                        <button className="btn btn-primary btn-sm" onClick={() => { updateGoal(goal.id, editingGoal); setEditingGoal(null); }}>✓</button>
                        <button className="btn btn-secondary btn-sm" onClick={() => setEditingGoal(null)}>✕</button>
                      </>
                    ) : (
                      <>
                        <button className="btn-text" style={{ cursor: "pointer", border: "none", padding: "4px", display: "flex", alignItems: "center" }} onClick={() => setEditingGoal({ ...goal })} title="Edit"><Edit2 size={16} /></button>
                        <button className="btn-text" style={{ cursor: "pointer", border: "none", padding: "4px", display: "flex", alignItems: "center", color: "var(--danger)" }} onClick={() => handleDeleteClick('goal', goal.id)} title="Delete"><Trash2 size={16} /></button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Push Notifications ── */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 12, letterSpacing: '-0.3px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Bell size={18} color="var(--accent)" />
          Notifications & Alerts
        </h2>
        <PushNotificationSetup />
      </div>

      {/* ── Recurring Expenses ── */}
      {rawSettings && (
        <div style={{ marginBottom: 24 }}>
          <RecurringExpenseManager settings={rawSettings} onUpdate={setRawSettings} />
        </div>
      )}

      {/* ── Credit Cards & Billing Cycles ── */}
      {rawSettings && (
        <div style={{ marginBottom: 24 }}>
          <CreditCardTracker settings={rawSettings} onUpdate={setRawSettings} />
        </div>
      )}

      {/* ── Guided Setup Tour Trigger ── */}
      <div style={{ margin: '32px 0 24px', textAlign: 'center' }}>
        <button
          onClick={() => setShowTour(true)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '12px 20px', borderRadius: 99,
            background: 'var(--bg-elevated)', border: '1.5px solid var(--border)',
            color: 'var(--text-primary)', fontSize: 13, fontWeight: 700,
            cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
            boxShadow: 'var(--shadow-xs)',
          }}
        >
          <Compass size={16} color="var(--accent)" />
          Launch Guided Setup Wizard
        </button>
      </div>

      {showTour && rawSettings && (
        <OnboardingWizard
          initialSettings={rawSettings}
          onComplete={(updated) => { setRawSettings(updated); fetchSettings(); }}
          onClose={() => setShowTour(false)}
        />
      )}

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
