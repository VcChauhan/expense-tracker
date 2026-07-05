'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { formatINR, Settings, Expense } from '@/lib/types';

export default function AddExpensePage() {
  const [settings, setSettings]             = useState<Settings | null>(null);
  const [recentExpenses, setRecentExpenses] = useState<Expense[]>([]);
  const [loading, setLoading]               = useState(false);
  const [toast, setToast]                   = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [editingId, setEditingId]           = useState<string | null>(null);

  const today = new Date().toISOString().split('T')[0];
  const [form, setForm] = useState({ date: today, categoryId: '', amount: '', note: '' });

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(s => {
      setSettings(s);
      if (s.categories?.length) setForm(f => ({ ...f, categoryId: s.categories[0].id }));
    });
    fetchRecent();
  }, []);

  async function fetchRecent() {
    try {
      const res  = await fetch('/api/expenses?limit=10');
      const data = await res.json();
      setRecentExpenses(Array.isArray(data) ? data : []);
    } catch { setRecentExpenses([]); }
  }

  function showToast(msg: string, type: 'success' | 'error') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.amount || parseFloat(form.amount) <= 0) {
      showToast('Please enter a valid amount', 'error');
      return;
    }
    setLoading(true);
    try {
      if (editingId) {
        await fetch(`/api/expenses/${editingId}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...form, amount: parseFloat(form.amount) }),
        });
        showToast('Expense updated!', 'success');
        setEditingId(null);
      } else {
        await fetch('/api/expenses', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...form, amount: parseFloat(form.amount) }),
        });
        showToast('Expense added!', 'success');
      }
      setForm({ date: today, categoryId: settings?.categories[0]?.id ?? '', amount: '', note: '' });
      fetchRecent();
    } catch { showToast('Something went wrong', 'error'); }
    finally   { setLoading(false); }
  }

  function handleEdit(exp: Expense) {
    setEditingId(exp._id);
    setForm({ date: exp.date, categoryId: exp.categoryId, amount: String(exp.amount), note: exp.note });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this expense?')) return;
    await fetch(`/api/expenses/${id}`, { method: 'DELETE' });
    showToast('Expense deleted', 'success');
    fetchRecent();
  }

  function cancelEdit() {
    setEditingId(null);
    setForm({ date: today, categoryId: settings?.categories[0]?.id ?? '', amount: '', note: '' });
  }

  const getCat = (id: string) => settings?.categories.find(c => c.id === id);

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">{editingId ? '✏️ Edit Expense' : '➕ Add Expense'}</h1>
        <p className="page-subtitle">Log a new expense entry</p>
      </div>

      {/* ── Form card ── */}
      <div className="card mb-24">
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="expense-date">Date</label>
            <input id="expense-date" type="date" className="form-input"
              value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="expense-category">Category</label>
            <select id="expense-category" className="form-select"
              value={form.categoryId}
              onChange={e => setForm(f => ({ ...f, categoryId: e.target.value }))} required>
              {(settings?.categories ?? []).map(cat => (
                <option key={cat.id} value={cat.id}>{cat.emoji} {cat.name}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="expense-amount">Amount (₹)</label>
            <input id="expense-amount" type="number" min="0" step="0.01" className="form-input"
              placeholder="0.00" value={form.amount}
              onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} required />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="expense-note">Note (optional)</label>
            <input id="expense-note" type="text" className="form-input"
              placeholder="What was this for?" value={form.note}
              onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
          </div>

          <div className="flex gap-8">
            <button type="submit" className="btn btn-primary"
              disabled={loading} style={{ flex: 1, justifyContent: 'center' }}>
              {loading ? <span className="spinner" style={{ width: 16, height: 16 }} /> : null}
              {editingId ? 'Update Expense' : 'Add Expense'}
            </button>
            {editingId && (
              <button type="button" className="btn btn-secondary" onClick={cancelEdit}>Cancel</button>
            )}
          </div>
        </form>

        {/* Budget hint for selected category */}
        {form.categoryId && settings && (() => {
          const cat = getCat(form.categoryId);
          if (!cat) return null;
          return (
            <div style={{
              marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)',
              display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 4,
              fontSize: 13, color: 'var(--text-secondary)',
            }}>
              <span>{cat.emoji} Monthly budget for <strong style={{ color: 'var(--text-primary)' }}>{cat.name}</strong></span>
              <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{formatINR(cat.monthlyBudget)}</span>
            </div>
          );
        })()}
      </div>

      {/* ── Recent Entries ── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
            Recent Entries
          </h2>
          <Link href="/expenses" style={{ fontSize: 13, color: 'var(--accent-primary)', textDecoration: 'none', fontWeight: 500 }}>
            View all →
          </Link>
        </div>

        {recentExpenses.length === 0 ? (
          <div className="empty-state card">
            <span className="empty-state-icon">📝</span>
            <span className="empty-state-title">No expenses yet</span>
            <span className="empty-state-sub">Add your first expense using the form above</span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {recentExpenses.map(exp => {
              const cat = getCat(exp.categoryId);
              return (
                <div key={exp._id} className="card card-sm" style={{ padding: '14px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    {/* Category icon */}
                    <div style={{
                      width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                      background: cat?.color ? `${cat.color}22` : 'var(--bg-input)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
                    }}>
                      {cat?.emoji ?? '💰'}
                    </div>

                    {/* Text info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                        {cat?.name ?? 'Unknown'}
                      </div>
                      {exp.note ? (
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2, wordBreak: 'break-word' }}>
                          {exp.note}
                        </div>
                      ) : null}
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>{exp.date}</div>
                    </div>

                    {/* Amount + actions stacked on right */}
                    <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                      <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
                        {formatINR(exp.amount)}
                      </span>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          onClick={() => handleEdit(exp)}
                          style={{
                            padding: '4px 10px', fontSize: 11, fontWeight: 600, borderRadius: 6, cursor: 'pointer',
                            background: 'var(--bg-input)', border: '1px solid var(--border)',
                            color: 'var(--text-secondary)',
                          }}
                        >✏️ Edit</button>
                        <button
                          onClick={() => handleDelete(exp._id)}
                          style={{
                            padding: '4px 8px', fontSize: 11, borderRadius: 6, cursor: 'pointer',
                            background: 'var(--danger-bg)', border: '1px solid rgba(239,68,68,0.3)',
                            color: 'var(--danger)',
                          }}
                        >🗑️</button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className="toast-container">
          <div className={`toast ${toast.type}`}>
            {toast.type === 'success' ? '✅' : '❌'} {toast.msg}
          </div>
        </div>
      )}
    </div>
  );
}
