'use client';

import { useState, useEffect, useCallback } from 'react';
import { formatINR, MONTHS, Settings, Expense } from '@/lib/types';

export default function ExpensesPage() {
  const now = new Date();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [filterCategory, setFilterCategory] = useState('');
  const [editingExp, setEditingExp] = useState<Expense | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [sortBy, setSortBy] = useState<'date' | 'amount'>('date');
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(setSettings);
  }, []);

  const fetchExpenses = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        month: String(selectedMonth),
        year: String(selectedYear),
        limit: '500',
      });
      if (filterCategory) params.set('categoryId', filterCategory);
      const res = await fetch(`/api/expenses?${params}`);
      const data = await res.json();
      setExpenses(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }, [selectedMonth, selectedYear, filterCategory]);

  useEffect(() => { fetchExpenses(); }, [fetchExpenses]);

  function showToast(msg: string, type: 'success' | 'error') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this expense?')) return;
    await fetch(`/api/expenses/${id}`, { method: 'DELETE' });
    showToast('Expense deleted', 'success');
    fetchExpenses();
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!editingExp) return;
    await fetch(`/api/expenses/${editingExp._id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editingExp),
    });
    showToast('Updated!', 'success');
    setEditingExp(null);
    fetchExpenses();
  }

  function navigateMonth(dir: number) {
    let m = selectedMonth + dir;
    let y = selectedYear;
    if (m < 1) { m = 12; y--; }
    if (m > 12) { m = 1; y++; }
    setSelectedMonth(m);
    setSelectedYear(y);
  }

  function toggleSort(col: 'date' | 'amount') {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('desc'); }
  }

  const getCategoryById = (id: string) => settings?.categories.find(c => c.id === id);

  const sorted = [...expenses].sort((a, b) => {
    const mul = sortDir === 'asc' ? 1 : -1;
    if (sortBy === 'date') return mul * a.date.localeCompare(b.date);
    return mul * (a.amount - b.amount);
  });

  const totalSpent = expenses.reduce((s, e) => s + e.amount, 0);

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">📋 Expense Log</h1>
        <p className="page-subtitle">All your recorded expenses</p>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 20 }}>
        <div className="month-nav">
          <button className="month-nav-btn" onClick={() => navigateMonth(-1)}>‹</button>
          <span className="month-label">{MONTHS[selectedMonth - 1]} {selectedYear}</span>
          <button className="month-nav-btn" onClick={() => navigateMonth(1)}>›</button>
        </div>
        <div className="flex items-center gap-8" style={{ flexWrap: 'wrap' }}>
          <select
            className="form-select"
            style={{ minWidth: 150, flex: 1 }}
            value={filterCategory}
            onChange={e => setFilterCategory(e.target.value)}
          >
            <option value="">All Categories</option>
            {(settings?.categories ?? []).map(c => (
              <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>
            ))}
          </select>
          <div className="card card-sm" style={{ padding: '8px 16px', flexShrink: 0 }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Total: </span>
            <span style={{ fontWeight: 700, color: 'var(--danger)', fontSize: 15 }}>{formatINR(totalSpent)}</span>
          </div>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="loading-overlay"><div className="spinner" /> Loading…</div>
      ) : sorted.length === 0 ? (
        <div className="empty-state card">
          <span className="empty-state-icon">📭</span>
          <span className="empty-state-title">No expenses found</span>
          <span className="empty-state-sub">Try a different month or add some expenses</span>
        </div>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('date')}>
                  Date {sortBy === 'date' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th>Category</th>
                <th>Note</th>
                <th className="text-right" style={{ cursor: 'pointer' }} onClick={() => toggleSort('amount')}>
                  Amount {sortBy === 'amount' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th style={{ width: 100 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(exp => {
                const cat = getCategoryById(exp.categoryId);
                return (
                  <tr key={exp._id}>
                    <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>{exp.date}</td>
                    <td>
                      {cat ? (
                        <span className="flex items-center gap-8">
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: cat.color, display: 'inline-block', flexShrink: 0 }} />
                          {cat.emoji} {cat.name}
                        </span>
                      ) : <span className="text-muted">—</span>}
                    </td>
                    <td style={{ color: 'var(--text-muted)', maxWidth: 200 }}>
                      <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {exp.note || '—'}
                      </span>
                    </td>
                    <td className="text-right primary" style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                      {formatINR(exp.amount)}
                    </td>
                    <td>
                      <div className="flex gap-8">
                        <button className="btn btn-secondary btn-icon btn-sm" onClick={() => setEditingExp({ ...exp })} title="Edit">✏️</button>
                        <button className="btn btn-danger btn-icon btn-sm" onClick={() => handleDelete(exp._id)} title="Delete">🗑️</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit Modal */}
      {editingExp && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 20
        }}>
          <div className="card" style={{ width: '100%', maxWidth: 480 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 24 }}>✏️ Edit Expense</h2>
            <form onSubmit={handleUpdate}>
              <div className="form-group">
                <label className="form-label">Date</label>
                <input type="date" className="form-input" value={editingExp.date}
                  onChange={e => setEditingExp({ ...editingExp, date: e.target.value })} required />
              </div>
              <div className="form-group">
                <label className="form-label">Category</label>
                <select className="form-select" value={editingExp.categoryId}
                  onChange={e => setEditingExp({ ...editingExp, categoryId: e.target.value })}>
                  {(settings?.categories ?? []).map(c => (
                    <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Amount (₹)</label>
                <input type="number" className="form-input" value={editingExp.amount}
                  onChange={e => setEditingExp({ ...editingExp, amount: parseFloat(e.target.value) })} required />
              </div>
              <div className="form-group">
                <label className="form-label">Note</label>
                <input type="text" className="form-input" value={editingExp.note}
                  onChange={e => setEditingExp({ ...editingExp, note: e.target.value })} />
              </div>
              <div className="flex gap-8">
                <button type="submit" className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }}>Save Changes</button>
                <button type="button" className="btn btn-secondary" onClick={() => setEditingExp(null)}>Cancel</button>
              </div>
            </form>
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
