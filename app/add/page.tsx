'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { formatINR, Settings, Expense, Suggestion } from '@/lib/types';
import { Edit2, Trash2, FileText, CheckCircle2, XCircle } from 'lucide-react';
import { CategoryIcon } from '@/components/CategoryIcon';
import { ConfirmModal } from '@/components/ConfirmModal';

export default function AddExpensePage() {
  const [settings, setSettings]             = useState<Settings | null>(null);
  const [recentExpenses, setRecentExpenses] = useState<Expense[]>([]);
  const [suggestions, setSuggestions]       = useState<Suggestion[]>([]);
  const [loading, setLoading]               = useState(false);
  const [toast, setToast]                   = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [editingId, setEditingId]           = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog]   = useState<{ isOpen: boolean; id: string } | null>(null);

  const today = new Date().toISOString().split('T')[0];
  const [form, setForm] = useState({ date: today, categoryId: '', amount: '', note: '' });

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(s => {
      setSettings(s);
      if (s.categories?.length) setForm(f => ({ ...f, categoryId: s.categories[0].id }));
    });
    fetchRecent();
    fetchSuggestions();
  }, []);

  async function fetchSuggestions() {
    try {
      const res = await fetch('/api/suggestions');
      const data = await res.json();
      setSuggestions(Array.isArray(data) ? data : []);
    } catch { setSuggestions([]); }
  }

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

  function handleDeleteClick(id: string) {
    setConfirmDialog({ isOpen: true, id });
  }

  async function confirmDelete() {
    if (!confirmDialog) return;
    const id = confirmDialog.id;
    setConfirmDialog(null);
    await fetch(`/api/expenses/${id}`, { method: 'DELETE' });
    showToast('Expense deleted', 'success');
    fetchRecent();
  }

  function cancelEdit() {
    setEditingId(null);
    setForm({ date: today, categoryId: settings?.categories[0]?.id ?? '', amount: '', note: '' });
  }

  async function handleActionSuggestion(sug: Suggestion, action: 'approve' | 'reject') {
    if (action === 'reject') {
      try {
        await fetch(`/api/suggestions/${sug._id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'rejected' }),
        });
        fetchSuggestions();
      } catch {}
      return;
    }
    
    // approve populates the form and removes it from suggestions list
    setForm({
      date: sug.date,
      categoryId: sug.suggestedCategory || settings?.categories[0]?.id || '',
      amount: String(sug.amount),
      note: sug.suggestedLabel || `SMS: ${sug.smsBody.substring(0, 30)}...`,
    });
    
    try {
       await fetch(`/api/suggestions/${sug._id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'approved' }),
       });
       fetchSuggestions();
       window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {}
  }

  const getCat = (id: string) => settings?.categories.find(c => c.id === id);

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">{editingId ? 'Edit Expense' : 'Add Expense'}</h1>
        <p className="page-subtitle">Log a new expense entry</p>
      </div>

      {/* ── Pending SMS Suggestions ── */}
      {suggestions.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--warning)', margin: '0 0 14px' }}>
            Suggested from SMS
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {suggestions.map(sug => (
              <div key={sug._id} className="card card-sm" style={{ padding: '14px', border: 'none' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                      {sug.suggestedLabel ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          ✨ {sug.suggestedLabel}
                          {sug.suggestedCategory && getCat(sug.suggestedCategory) && (
                            <span style={{ fontSize: 11, background: 'var(--bg-input)', padding: '2px 6px', borderRadius: 4, color: 'var(--text-secondary)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}>
                              <CategoryIcon name={getCat(sug.suggestedCategory)?.name ?? ''} size={11} /> {getCat(sug.suggestedCategory)?.name}
                            </span>
                          )}
                        </span>
                      ) : (
                        sug.sender
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4, wordBreak: 'break-word' }}>
                      {sug.suggestedLabel ? (
                        <span style={{ opacity: 0.8 }}>From {sug.sender}: "{sug.smsBody}"</span>
                      ) : (
                        `"${sug.smsBody}"`
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>{sug.date}</div>
                  </div>
                  <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                    <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
                      {formatINR(sug.amount)}
                    </span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        type="button"
                        onClick={() => handleActionSuggestion(sug, 'approve')}
                        className="btn-text"
                        style={{ padding: '4px 8px', fontSize: 13, borderRadius: 16, cursor: 'pointer', border: 'none', color: 'var(--success)', fontWeight: 500 }}
                      >✓ Add</button>
                      <button
                        type="button"
                        onClick={() => handleActionSuggestion(sug, 'reject')}
                        className="btn-text"
                        style={{ padding: '4px 8px', fontSize: 13, borderRadius: 16, cursor: 'pointer', border: 'none', color: 'var(--text-secondary)', fontWeight: 500 }}
                      >✕</button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
                <option key={cat.id} value={cat.id}>{cat.name}</option>
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
              marginTop: 20, paddingTop: 16, borderTop: 'none',
              display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 4,
              fontSize: 13, color: 'var(--text-secondary)',
            }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><CategoryIcon name={cat.name} size={14} /> Monthly budget for <strong style={{ color: 'var(--text-primary)' }}>{cat.name}</strong></span>
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
            <div className="empty-state-icon" style={{ display: 'flex', justifyContent: 'center', marginBottom: 12, color: 'var(--text-muted)' }}><FileText size={32} strokeWidth={1.5} /></div>
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
                      <CategoryIcon name={cat?.name ?? ''} size={20} />
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
                          className="btn-text"
                          style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', fontSize: 13, borderRadius: 16, cursor: 'pointer', border: 'none', fontWeight: 500 }}
                        ><Edit2 size={14} /> Edit</button>
                        <button
                          onClick={() => handleDeleteClick(exp._id)}
                          className="btn-text"
                          style={{ display: 'flex', alignItems: 'center', padding: '4px 8px', fontSize: 13, borderRadius: 16, cursor: 'pointer', border: 'none', color: 'var(--md-sys-color-error)', fontWeight: 500 }}
                        ><Trash2 size={14} /></button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

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
        message="Are you sure you want to delete this expense? This action cannot be undone."
        onConfirm={confirmDelete}
        onCancel={() => setConfirmDialog(null)}
      />
    </div>
  );
}
