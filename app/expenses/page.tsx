'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { formatINR, MONTHS, Settings, Expense } from '@/lib/types';

type ViewMode = 'monthly' | 'annual';
type SortField = 'date' | 'amount';
type SortDir = 'asc' | 'desc';

export default function ExpensesPage() {
  const now = new Date();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  // Filters
  const [viewMode, setViewMode]           = useState<ViewMode>('monthly');
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear]   = useState(now.getFullYear());
  const [filterCategory, setFilterCategory] = useState('');
  const [sortBy, setSortBy]               = useState<SortField>('date');
  const [sortDir, setSortDir]             = useState<SortDir>('desc');

  // Edit modal
  const [editingExp, setEditingExp]     = useState<Expense | null>(null);
  const [saving, setSaving]             = useState(false);

  // Fetch settings
  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(s => {
      if (s && !s.error) setSettings(s);
    });
  }, []);

  // Fetch expenses from API
  const fetchExpenses = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        year: String(selectedYear),
        limit: '1000',
      });
      // For monthly view, add month param
      if (viewMode === 'monthly') params.set('month', String(selectedMonth));
      if (filterCategory) params.set('categoryId', filterCategory);

      const res  = await fetch(`/api/expenses?${params}`);
      const data = await res.json();
      setExpenses(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }, [viewMode, selectedMonth, selectedYear, filterCategory]);

  useEffect(() => { fetchExpenses(); }, [fetchExpenses]);

  // Client-side sort (search removed)
  const filtered = useMemo(() => {
    let list = [...expenses];
    // Sort
    const mul = sortDir === 'asc' ? 1 : -1;
    list.sort((a, b) => {
      if (sortBy === 'date') return mul * a.date.localeCompare(b.date);
      return mul * (a.amount - b.amount);
    });
    return list;
  }, [expenses, sortBy, sortDir]);

  // Group by month for annual view
  const groupedByMonth = useMemo(() => {
    if (viewMode !== 'annual') return null;
    const groups: Record<string, Expense[]> = {};
    filtered.forEach(exp => {
      const key = exp.date.substring(0, 7); // YYYY-MM
      if (!groups[key]) groups[key] = [];
      groups[key].push(exp);
    });
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
  }, [filtered, viewMode]);

  const totalSpent = useMemo(() => filtered.reduce((s, e) => s + e.amount, 0), [filtered]);

  function showToast(msg: string, type: 'success' | 'error') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  function navigateMonth(dir: number) {
    let m = selectedMonth + dir;
    let y = selectedYear;
    if (m < 1) { m = 12; y--; }
    if (m > 12) { m = 1; y++; }
    setSelectedMonth(m);
    setSelectedYear(y);
  }

  const getCategoryById = (id: string) => settings?.categories?.find(c => c.id === id);

  function toggleSort(field: SortField) {
    if (sortBy === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(field); setSortDir('desc'); }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this expense?')) return;
    await fetch(`/api/expenses/${id}`, { method: 'DELETE' });
    setExpenses(exps => exps.filter(e => e._id !== id));
    showToast('Expense deleted', 'success');
  }

  async function handleUpdate() {
    if (!editingExp) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/expenses/${editingExp._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingExp),
      });
      const updated = await res.json();
      setExpenses(exps => exps.map(e => e._id === updated._id ? updated : e));
      setEditingExp(null);
      showToast('Expense updated', 'success');
    } catch {
      showToast('Failed to update', 'error');
    } finally {
      setSaving(false);
    }
  }

  const sortIcon = (field: SortField) =>
    sortBy === field ? (sortDir === 'desc' ? ' ↓' : ' ↑') : '';

  // Expense row component (reused in both views)
  function ExpenseRow({ exp }: { exp: Expense }) {
    const cat = getCategoryById(exp.categoryId);
    return (
      <tr key={exp._id}>
        <td style={{ color: 'var(--text-muted)', fontSize: 13, whiteSpace: 'nowrap' }}>{exp.date}</td>
        <td>
          {cat ? (
            <span className="flex items-center gap-8">
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: cat.color, display: 'inline-block', flexShrink: 0 }} />
              {cat.emoji} {cat.name}
            </span>
          ) : <span style={{ color: 'var(--text-muted)' }}>Unknown</span>}
        </td>
        <td style={{ color: 'var(--text-secondary)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {exp.note || '—'}
        </td>
        <td className="text-right" style={{ fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
          {formatINR(exp.amount)}
        </td>
        <td>
          <div className="flex gap-8">
            <button className="btn btn-secondary btn-icon btn-sm" title="Edit" onClick={() => setEditingExp({ ...exp })}>✏️</button>
            <button className="btn btn-danger btn-icon btn-sm" title="Delete" onClick={() => handleDelete(exp._id!)}>🗑️</button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">📋 Expense Log</h1>
        <p className="page-subtitle">All your recorded expenses</p>
      </div>

      {/* View mode toggle */}
      <div className="flex gap-8 mb-16" style={{ flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 4 }}>
          {(['monthly', 'annual'] as ViewMode[]).map(v => (
            <button
              key={v}
              onClick={() => setViewMode(v)}
              style={{
                padding: '7px 18px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                background: viewMode === v ? 'var(--accent-gradient)' : 'transparent',
                color: viewMode === v ? 'white' : 'var(--text-secondary)',
                transition: 'all 0.2s',
              }}
            >
              {v === 'monthly' ? '📅 Monthly' : '📆 Annual'}
            </button>
          ))}
        </div>

        {/* Month/Year nav — only for monthly */}
        {viewMode === 'monthly' ? (
          <div className="month-nav">
            <button className="month-nav-btn" onClick={() => navigateMonth(-1)}>‹</button>
            <span className="month-label">{MONTHS[selectedMonth - 1]} {selectedYear}</span>
            <button className="month-nav-btn" onClick={() => navigateMonth(1)}>›</button>
          </div>
        ) : (
          /* Year nav for annual */
          <div className="month-nav">
            <button className="month-nav-btn" onClick={() => setSelectedYear(y => y - 1)}>‹</button>
            <span className="month-label">{selectedYear}</span>
            <button className="month-nav-btn" onClick={() => setSelectedYear(y => y + 1)}>›</button>
          </div>
        )}
      </div>

      {/* Search + filters row */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16, alignItems: 'center' }}>
        {/* Category filter */}
        <select
          className="form-select"
          style={{ flex: '0 1 200px', minWidth: 160 }}
          value={filterCategory}
          onChange={e => setFilterCategory(e.target.value)}
        >
          <option value="">All Categories</option>
          {(settings?.categories ?? []).map(c => (
            <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>
          ))}
        </select>

        {/* Total */}
        <div className="card card-sm" style={{ padding: '8px 16px', flexShrink: 0, whiteSpace: 'nowrap', marginLeft: 'auto' }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {filtered.length} entries · Total:{' '}
          </span>
          <span style={{ fontWeight: 700, color: 'var(--danger)', fontSize: 15 }}>{formatINR(totalSpent)}</span>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="loading-overlay"><div className="spinner" /> Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <span className="empty-state-icon">🔍</span>
          <span className="empty-state-title">No expenses found</span>
          <span className="empty-state-sub">
            Add your first expense using the + Add tab
          </span>
        </div>
      ) : viewMode === 'monthly' ? (
        /* ── Monthly flat table ── */
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => toggleSort('date')}>DATE{sortIcon('date')}</th>
                <th>CATEGORY</th>
                <th>NOTE</th>
                <th className="text-right" style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => toggleSort('amount')}>AMOUNT{sortIcon('amount')}</th>
                <th>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(exp => <ExpenseRow key={exp._id} exp={exp} />)}
            </tbody>
          </table>
        </div>
      ) : (
        /* ── Annual grouped view ── */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {(groupedByMonth ?? []).map(([monthKey, exps]) => {
            const [y, m] = monthKey.split('-');
            const monthTotal = exps.reduce((s, e) => s + e.amount, 0);
            return (
              <div key={monthKey} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                {/* Month header */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '14px 20px', background: 'var(--bg-secondary)',
                  borderBottom: '1px solid var(--border)',
                }}>
                  <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>
                    📅 {MONTHS[parseInt(m) - 1]} {y}
                  </span>
                  <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{exps.length} entries</span>
                    <span style={{ fontWeight: 700, color: 'var(--danger)', fontSize: 15 }}>{formatINR(monthTotal)}</span>
                  </div>
                </div>
                <div className="table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
                  <table>
                    <thead>
                      <tr>
                        <th>DATE</th>
                        <th>CATEGORY</th>
                        <th>NOTE</th>
                        <th className="text-right">AMOUNT</th>
                        <th>ACTIONS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {exps.map(exp => <ExpenseRow key={exp._id} exp={exp} />)}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Modal */}
      {editingExp && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div className="card" style={{ width: '100%', maxWidth: 460 }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, color: 'var(--text-primary)' }}>✏️ Edit Expense</h3>
            <div className="form-group">
              <label className="form-label">Date</label>
              <input type="date" className="form-input" value={editingExp.date}
                onChange={e => setEditingExp({ ...editingExp, date: e.target.value })} />
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
                onChange={e => setEditingExp({ ...editingExp, amount: parseFloat(e.target.value) || 0 })} />
            </div>
            <div className="form-group">
              <label className="form-label">Note</label>
              <input type="text" className="form-input" value={editingExp.note || ''}
                onChange={e => setEditingExp({ ...editingExp, note: e.target.value })} />
            </div>
            <div className="flex gap-8">
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleUpdate} disabled={saving}>
                {saving ? <span className="spinner" style={{ width: 16, height: 16 }} /> : '✓'} Save
              </button>
              <button className="btn btn-secondary" onClick={() => setEditingExp(null)}>Cancel</button>
            </div>
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
