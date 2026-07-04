'use client';

import { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { formatINR, Settings, Category } from '@/lib/types';

const PRESET_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f97316',
  '#f59e0b', '#10b981', '#14b8a6', '#3b82f6', '#06b6d4',
];

const PRESET_EMOJIS = ['🏠', '⚡', '🚗', '🛒', '📈', '👨‍👩‍👧', '📱', '🎲', '🍔', '🎓', '💊', '✈️', '🎮', '👕', '🏋️'];

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [annualSalary, setAnnualSalary] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newCat, setNewCat] = useState<Omit<Category, 'id'>>({
    name: '', emoji: '💰', monthlyBudget: 0, notes: '', color: '#6366f1'
  });

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(s => {
      setSettings(s);
      setAnnualSalary(String(s.annualSalary));
      setCategories(s.categories ?? []);
      setLoading(false);
    });
  }, []);

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
        body: JSON.stringify({ annualSalary: parseFloat(annualSalary), categories }),
      });
      const updated = await res.json();
      setSettings(updated);
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
    if (!confirm('Delete this category? Existing expenses in this category will still be stored but may show as "Unknown".')) return;
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

  const monthlySalary = parseFloat(annualSalary) > 0 ? Math.round(parseFloat(annualSalary) / 12) : 0;
  const totalBudget = categories.reduce((s, c) => s + Number(c.monthlyBudget), 0);
  const budgetPct = monthlySalary > 0 ? (totalBudget / monthlySalary) * 100 : 0;
  const remaining = monthlySalary - totalBudget;

  if (loading) return <div className="page-container"><div className="loading-overlay"><div className="spinner" /></div></div>;

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1 className="page-title">⚙️ Budget Planner</h1>
            <p className="page-subtitle">Set your salary and monthly category budgets</p>
          </div>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? <span className="spinner" style={{ width: 16, height: 16 }} /> : '💾'}
            Save All Changes
          </button>
        </div>
      </div>

      {/* Salary Section */}
      <div className="card mb-32">
        <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 20 }}>
          💵 Salary Configuration
        </h2>
        <div className="grid-2" style={{ alignItems: 'end' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor="annual-salary">Annual Salary (₹)</label>
            <input
              id="annual-salary"
              type="number"
              className="form-input"
              value={annualSalary}
              onChange={e => setAnnualSalary(e.target.value)}
              placeholder="e.g. 1574604"
            />
          </div>
          <div className="card card-sm" style={{ background: 'var(--bg-input)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Monthly Salary (Auto-calculated)</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--success)' }}>{formatINR(monthlySalary)}</div>
          </div>
        </div>

        {/* Budget Summary */}
        {monthlySalary > 0 && (
          <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between mb-8">
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                Total budgeted: <strong style={{ color: budgetPct > 100 ? 'var(--danger)' : 'var(--text-primary)' }}>{formatINR(totalBudget)}</strong>
                <span style={{ color: 'var(--text-muted)', marginLeft: 6 }}>({budgetPct.toFixed(1)}% of monthly salary)</span>
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

      {/* Categories */}
      <div>
        <div className="page-header-row mb-16">
          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>📂 Expense Categories</h2>
          <button className="btn btn-primary btn-sm" onClick={() => setShowAddForm(s => !s)}>
            {showAddForm ? '✕ Cancel' : '➕ Add Category'}
          </button>
        </div>

        {/* Add Category Form */}
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
            {/* Emoji picker */}
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
            {/* Color picker */}
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

        {/* Category Table */}
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th style={{ width: 40 }}>#</th>
                <th>Category</th>
                <th>Monthly Budget</th>
                <th>% of Salary</th>
                <th>Notes</th>
                <th style={{ width: 120 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((cat, idx) => (
                <tr key={cat.id}>
                  <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>{idx + 1}</td>
                  <td>
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
                  <td>
                    {editingCat?.id === cat.id ? (
                      <input type="number" className="form-input" style={{ width: 110, padding: '6px 10px', fontSize: 13 }}
                        value={editingCat.monthlyBudget} onChange={e => setEditingCat({ ...editingCat, monthlyBudget: parseFloat(e.target.value) || 0 })} />
                    ) : (
                      <span style={{ fontWeight: 600, color: 'var(--warning)' }}>{formatINR(cat.monthlyBudget)}</span>
                    )}
                  </td>
                  <td style={{ color: 'var(--text-secondary)' }}>
                    {monthlySalary > 0 ? ((cat.monthlyBudget / monthlySalary) * 100).toFixed(1) : 0}%
                  </td>
                  <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                    {editingCat?.id === cat.id ? (
                      <input type="text" className="form-input" style={{ padding: '6px 10px', fontSize: 13 }}
                        value={editingCat.notes} onChange={e => setEditingCat({ ...editingCat, notes: e.target.value })} />
                    ) : cat.notes || '—'}
                  </td>
                  <td>
                    <div className="flex gap-8">
                      {editingCat?.id === cat.id ? (
                        <>
                          <button className="btn btn-primary btn-sm" onClick={() => { updateCategory(cat.id, editingCat); setEditingCat(null); }}>✓</button>
                          <button className="btn btn-secondary btn-sm" onClick={() => setEditingCat(null)}>✕</button>
                        </>
                      ) : (
                        <>
                          <button className="btn btn-secondary btn-icon btn-sm" onClick={() => setEditingCat({ ...cat })} title="Edit">✏️</button>
                          <button className="btn btn-secondary btn-icon btn-sm" onClick={() => moveCat(cat.id, -1)} disabled={idx === 0} title="Move up">↑</button>
                          <button className="btn btn-secondary btn-icon btn-sm" onClick={() => moveCat(cat.id, 1)} disabled={idx === categories.length - 1} title="Move down">↓</button>
                          <button className="btn btn-danger btn-icon btn-sm" onClick={() => deleteCategory(cat.id)} title="Delete">🗑️</button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {/* Totals row */}
              <tr style={{ background: 'var(--bg-secondary)', borderTop: '2px solid var(--border-light)' }}>
                <td colSpan={2} style={{ fontWeight: 700, color: 'var(--text-primary)' }}>TOTAL EXPENSES</td>
                <td style={{ fontWeight: 700, color: budgetPct > 100 ? 'var(--danger)' : 'var(--warning)' }}>{formatINR(totalBudget)}</td>
                <td style={{ fontWeight: 700, color: budgetPct > 100 ? 'var(--danger)' : 'var(--text-secondary)' }}>{budgetPct.toFixed(1)}%</td>
                <td colSpan={2} />
              </tr>
              {/* Savings row */}
              <tr style={{ background: 'var(--bg-secondary)' }}>
                <td colSpan={2} style={{ fontWeight: 700, color: 'var(--success)' }}>💰 EXPECTED SAVINGS</td>
                <td style={{ fontWeight: 700, color: remaining >= 0 ? 'var(--success)' : 'var(--danger)' }}>{formatINR(remaining)}</td>
                <td style={{ color: 'var(--text-muted)' }}>{monthlySalary > 0 ? (100 - budgetPct).toFixed(1) : 0}%</td>
                <td colSpan={2} style={{ color: 'var(--text-muted)', fontSize: 12 }}>Monthly Salary − Total</td>
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
