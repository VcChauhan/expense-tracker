'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { formatINR, MONTHS, SHORT_MONTHS, Expense, Settings, Category } from '@/lib/types';
import { CalendarDays, Edit2, Trash2, CheckCircle2, XCircle } from 'lucide-react';
import { CategoryIcon } from '@/components/CategoryIcon';
import { ConfirmModal } from '@/components/ConfirmModal';

type ViewMode = 'monthly' | 'annual';
type SortField = 'date' | 'amount';
type SortDir = 'asc' | 'desc';

export default function ExpensesPage() {
  const now = new Date();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ isOpen: boolean; id: string } | null>(null);

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

  function handleDeleteClick(id: string) {
    setConfirmDialog({ isOpen: true, id });
  }

  async function confirmDelete() {
    if (!confirmDialog) return;
    const id = confirmDialog.id;
    setConfirmDialog(null);
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
      <div key={exp._id} className="card card-sm" style={{ padding: '14px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          {/* Category icon */}
          <div style={{
            width: 40, height: 40, borderRadius: 10, flexShrink: 0,
            background: cat?.color ? `${cat.color}22` : 'var(--bg-input)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
          }}>
            <CategoryIcon name={cat?.name ?? ''} note={exp.note} size={20} />
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
                onClick={() => setEditingExp({ ...exp })}
                className="btn-text"
                style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', fontSize: 13, borderRadius: 16, cursor: 'pointer', border: 'none', fontWeight: 500 }}
              ><Edit2 size={14} /> Edit</button>
              <button
                onClick={() => handleDeleteClick(exp._id!)}
                className="btn-text"
                style={{ display: 'flex', alignItems: 'center', padding: '4px 8px', fontSize: 13, borderRadius: 16, cursor: 'pointer', border: 'none', color: 'var(--md-sys-color-error)', fontWeight: 500 }}
              ><Trash2 size={14} /></button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">Expense Log</h1>
        <p className="page-subtitle">All your recorded expenses</p>
      </div>

      {/* Controls Area (2x2 Grid) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
        
        {/* Top Left: Period */}
        <div className="period-selector" style={{ display: 'flex', width: '100%', overflow: 'hidden' }}>
          {(['monthly', 'annual'] as ViewMode[]).map(v => (
            <button
              key={v}
              onClick={() => setViewMode(v)}
              className={`period-btn ${viewMode === v ? 'active' : ''}`}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, flex: 1, padding: '8px 4px', fontSize: 13, textAlign: 'center' }}
            >
              <CalendarDays size={14} /> {v === 'monthly' ? 'M' : 'Y'}
            </button>
          ))}
        </div>

        {/* Top Right: Month */}
        <div className="month-nav" style={{ background: 'var(--md-sys-color-surface-container-high)', borderRadius: 'var(--shape-full)', padding: '4px 8px', display: 'flex', justifyContent: 'space-between', width: '100%' }}>
          {viewMode === 'monthly' ? (
            <>
              <button className="month-nav-btn" style={{ width: 32, height: 32 }} onClick={() => navigateMonth(-1)}>‹</button>
              <span className="month-label" style={{ fontWeight: 700, fontSize: 13, minWidth: 'auto', flex: 1, textAlign: 'center' }}>{MONTHS[selectedMonth - 1].substring(0,3)} {selectedYear.toString().substring(2)}</span>
              <button className="month-nav-btn" style={{ width: 32, height: 32 }} onClick={() => navigateMonth(1)}>›</button>
            </>
          ) : (
            <>
              <button className="month-nav-btn" style={{ width: 32, height: 32 }} onClick={() => setSelectedYear(y => y - 1)}>‹</button>
              <span className="month-label" style={{ fontWeight: 700, fontSize: 13, minWidth: 'auto', flex: 1, textAlign: 'center' }}>{selectedYear}</span>
              <button className="month-nav-btn" style={{ width: 32, height: 32 }} onClick={() => setSelectedYear(y => y + 1)}>›</button>
            </>
          )}
        </div>

        {/* Bottom Left: Filter */}
        <select
          className="form-select"
          style={{ width: '100%', margin: 0, fontSize: 13, padding: '10px 30px 10px 12px' }}
          value={filterCategory}
          onChange={e => setFilterCategory(e.target.value)}
        >
          <option value="">All Cat</option>
          {(settings?.categories ?? []).map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        {/* Bottom Right: Total */}
        <div className="card card-sm" style={{ padding: '8px 12px', background: 'var(--md-sys-color-surface-container-high)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{filtered.length} entries</span>
          <span style={{ fontWeight: 700, color: 'var(--danger)', fontSize: 14 }}>{formatINR(totalSpent)}</span>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="loading-overlay"><div className="spinner" /> Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <img src="/empty-box.jpg" alt="Empty" style={{ width: 140, height: 140, objectFit: 'cover', borderRadius: 24, marginBottom: 20, mixBlendMode: 'screen' }} />
          <span className="empty-state-title">No expenses found</span>
          <span className="empty-state-sub">
            Add your first expense using the + Add tab
          </span>
        </div>
      ) : viewMode === 'monthly' ? (
        /* ── Monthly flat list ── */
        <div className="animate-list" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', gap: 16, padding: '0 4px', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>
             <span style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => toggleSort('date')}>DATE {sortIcon('date')}</span>
             <span style={{ cursor: 'pointer', userSelect: 'none', marginLeft: 'auto' }} onClick={() => toggleSort('amount')}>AMOUNT {sortIcon('amount')}</span>
          </div>
          {filtered.map(exp => <ExpenseRow key={exp._id} exp={exp} />)}
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
                  borderBottom: 'none',
                }}>
                  <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>
                    {MONTHS[parseInt(m) - 1]} {y}
                  </span>
                  <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{exps.length} entries</span>
                    <span style={{ fontWeight: 700, color: 'var(--danger)', fontSize: 15 }}>{formatINR(monthTotal)}</span>
                  </div>
                </div>
                <div className="animate-list" style={{ padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {exps.map(exp => <ExpenseRow key={exp._id} exp={exp} />)}
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
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, color: 'var(--text-primary)' }}>Edit Expense</h3>
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
                  <option key={c.id} value={c.id}>{c.name}</option>
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
