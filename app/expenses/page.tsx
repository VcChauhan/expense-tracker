'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { formatINR, MONTHS, SHORT_MONTHS, Expense, Settings, Category, Suggestion } from '@/lib/types';
import { CalendarDays, Edit2, Trash2, CheckCircle2, XCircle, ChevronLeft, ChevronRight, Sparkles, MoreVertical, LayoutList, GitCommit, Search } from 'lucide-react';
import { CategoryIcon } from '@/components/CategoryIcon';
import { ConfirmModal } from '@/components/ConfirmModal';
import { ExpenseTimelineView } from '@/components/ExpenseTimelineView';

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
  const [viewLayout, setViewLayout]       = useState<'list' | 'timeline'>('list');
  const [menuOpen, setMenuOpen]           = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('expenseViewLayout');
      if (saved === 'list' || saved === 'timeline') setViewLayout(saved);
    }
  }, []);

  function handleSetViewLayout(layout: 'list' | 'timeline') {
    setViewLayout(layout);
    if (typeof window !== 'undefined') localStorage.setItem('expenseViewLayout', layout);
    setMenuOpen(false);
    fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expenseViewLayout: layout })
    }).catch(err => console.error('Failed to sync layout preference', err));
  }

  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear]   = useState(now.getFullYear());
  const [filterCategory, setFilterCategory] = useState('');
  const [searchQuery, setSearchQuery]       = useState('');

  const [sortBy, setSortBy]               = useState<SortField>('date');
  const [sortDir, setSortDir]             = useState<SortDir>('desc');

  const [filterTag, setFilterTag]         = useState('');

  // Edit modal
  const [editingExp, setEditingExp]     = useState<Expense | null>(null);
  const [saving, setSaving]             = useState(false);

  // Suggestions
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [reviewSuggestion, setReviewSuggestion] = useState<Suggestion | null>(null);
  const [reviewForm, setReviewForm] = useState({ date: new Date().toISOString().split('T')[0], categoryId: '', amount: '', note: '' });
  const [reviewSplitWays, setReviewSplitWays] = useState<number>(1);

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(s => {
      if (s && !s.error) {
        setSettings(s);
        if (s.expenseViewLayout) {
          setViewLayout(s.expenseViewLayout);
          if (typeof window !== 'undefined') localStorage.setItem('expenseViewLayout', s.expenseViewLayout);
        }
      }
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

  // Fetch suggestions
  async function fetchSuggestions() {
    try {
      const res = await fetch('/api/suggestions');
      const data = await res.json();
      setSuggestions(Array.isArray(data) ? data : []);
    } catch { setSuggestions([]); }
  }

  useEffect(() => { fetchSuggestions(); }, []);

  useEffect(() => {
    if (reviewSuggestion || editingExp) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; }
  }, [reviewSuggestion, editingExp]);

  // Client-side sort and filter
  const filtered = useMemo(() => {
    let list = [...expenses];
    
    if (filterTag) {
      list = list.filter(exp => exp.note?.toLowerCase().includes(filterTag.toLowerCase()));
    }
    
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(exp => {
        const cat = settings?.categories?.find(c => c.id === exp.categoryId);
        return exp.note?.toLowerCase().includes(q) || cat?.name?.toLowerCase().includes(q) || String(exp.amount).includes(q);
      });
    }
    const mul = sortDir === 'asc' ? 1 : -1;
    list.sort((a, b) => {
      if (sortBy === 'date') return mul * a.date.localeCompare(b.date);
      return mul * (a.amount - b.amount);
    });
    return list;
  }, [expenses, sortBy, sortDir, searchQuery, settings]);

  // Group by day for monthly view
  const groupedByDay = useMemo(() => {
    if (viewMode !== 'monthly') return null;
    const groups: Record<string, Expense[]> = {};
    filtered.forEach(exp => {
      const key = exp.date;
      if (!groups[key]) groups[key] = [];
      groups[key].push(exp);
    });
    return Object.entries(groups).sort(([a], [b]) => sortDir === 'asc' ? a.localeCompare(b) : b.localeCompare(a));
  }, [filtered, viewMode, sortDir]);

  // Group by month for annual view
  const groupedByMonth = useMemo(() => {
    if (viewMode !== 'annual') return null;
    const groups: Record<string, Expense[]> = {};
    filtered.forEach(exp => {
      const key = exp.date.substring(0, 7);
      if (!groups[key]) groups[key] = [];
      groups[key].push(exp);
    });
    return Object.entries(groups).sort(([a], [b]) => sortDir === 'asc' ? a.localeCompare(b) : b.localeCompare(a));
  }, [filtered, viewMode, sortDir]);

  const totalSpent = useMemo(() => filtered.reduce((s, e) => s + e.amount, 0), [filtered]);

  function showToast(msg: string, type: 'success' | 'error') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  // Extract all unique tags from expenses
  const allTags = useMemo(() => {
    const tags = new Set<string>();
    expenses.forEach(exp => {
      const matches = exp.note?.match(/#[a-zA-Z0-9_-]+/g);
      if (matches) matches.forEach(m => tags.add(m.toLowerCase()));
    });
    return Array.from(tags).sort();
  }, [expenses]);

  function downloadCSV() {
    const headers = ['Date', 'Category', 'Amount', 'Note'];
    const rows = filtered.map(exp => {
      const cat = getCategoryById(exp.categoryId)?.name || 'Unknown';
      return [
        exp.date,
        `"${cat}"`,
        exp.amount,
        `"${(exp.note || '').replace(/"/g, '""')}"`
      ].join(',');
    });
    
    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `ExpenseIQ_Export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Download started', 'success');
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

  async function handleActionSuggestion(sug: Suggestion, action: 'approve' | 'reject') {
    if (action === 'reject') {
      try {
        await fetch(`/api/suggestions/${sug._id}`, { method: 'DELETE' });
        fetchSuggestions();
      } catch {}
      return;
    }
    setReviewForm({
      date: sug.date,
      categoryId: sug.suggestedCategory || settings?.categories[0]?.id || '',

      amount: String(sug.amount),
      note: sug.suggestedLabel || `SMS: ${sug.smsBody.substring(0, 30)}...`,
    });
    setReviewSplitWays(1);
    setReviewSuggestion(sug);
  }

  async function submitReviewForm(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!reviewSuggestion || !reviewForm.amount || parseFloat(reviewForm.amount) <= 0) return;
    setSaving(true);
    try {
      const parsedAmount = parseFloat(reviewForm.amount);
      const finalAmount = reviewSplitWays > 1 ? Math.round((parsedAmount / reviewSplitWays) * 100) / 100 : parsedAmount;
      const splitNote = reviewSplitWays > 1 ? ` (Split: ₹${parsedAmount} / ${reviewSplitWays})` : '';
      const finalNote = (reviewForm.note || '') + splitNote;

      await fetch('/api/expenses', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...reviewForm, amount: finalAmount, note: finalNote }),
      });
      await fetch(`/api/suggestions/${reviewSuggestion._id}`, { method: 'DELETE' });
      showToast('Expense added!', 'success');
      setReviewSuggestion(null);
      fetchExpenses();
      fetchSuggestions();
    } catch { showToast('Failed to add suggestion', 'error'); }
    finally { setSaving(false); }
  }

  function formatDateHeader(dateStr: string) {
    const d = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return 'Today';
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return `${d.getDate()} ${SHORT_MONTHS[d.getMonth()]}`;
  }

  function ExpenseRow({ exp }: { exp: Expense }) {
    const cat = getCategoryById(exp.categoryId);

    return (
      <div key={exp._id} className="expense-row" style={{ display: 'flex', alignItems: 'center', padding: '14px 16px', background: 'transparent' }}>
        <div style={{
          width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
          background: cat?.color ? `${cat.color}15` : 'var(--bg-elevated)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: cat?.color || 'var(--text-secondary)', marginRight: 12
        }}>
          <CategoryIcon name={cat?.name ?? ''} note={exp.note} size={18} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {exp.note || cat?.name || 'Unknown'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
            <span>{cat?.name}</span>

          </div>
        </div>
        <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', marginLeft: 12 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--danger)' }}>
            {formatINR(exp.amount)}
          </span>
          <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
            <button onClick={() => setEditingExp({ ...exp })} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}><Edit2 size={13} /></button>
            <button onClick={() => handleDeleteClick(exp._id!)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}><Trash2 size={13} /></button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', paddingBottom: 80 }}>
      {/* Header */}
      <div style={{ padding: '24px 16px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Expense Log</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ background: 'var(--accent)', color: '#fff', padding: '4px 12px', borderRadius: 9999, fontSize: 13, fontWeight: 600 }}>
            {filtered.length} • {formatINR(totalSpent)}
          </div>
          
          <button 
            onClick={downloadCSV}
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', cursor: 'pointer', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 6, borderRadius: 9999, color: 'var(--text-primary)', fontSize: 12, fontWeight: 600 }}
          >
            Export
          </button>
          
          <div style={{ position: 'relative' }}>
            <button 
              onClick={() => setMenuOpen(!menuOpen)} 
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', cursor: 'pointer', padding: 8, display: 'flex', borderRadius: '50%', color: 'var(--text-primary)' }}
            >
              <MoreVertical size={16} />
            </button>
            
            {menuOpen && (
              <>
                <div onClick={() => setMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
                <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 8, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.1)', padding: 8, minWidth: 160, zIndex: 50 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', padding: '8px 12px 4px' }}>View Layout</div>
                  <button 
                    onClick={() => handleSetViewLayout('list')}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: viewLayout === 'list' ? 'var(--bg-elevated)' : 'transparent', border: 'none', borderRadius: 8, color: viewLayout === 'list' ? 'var(--accent)' : 'var(--text-primary)', fontWeight: 600, fontSize: 14, cursor: 'pointer', textAlign: 'left' }}
                  >
                    <LayoutList size={16} />
                    List
                  </button>
                  <button 
                    onClick={() => handleSetViewLayout('timeline')}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: viewLayout === 'timeline' ? 'var(--bg-elevated)' : 'transparent', border: 'none', borderRadius: 8, color: viewLayout === 'timeline' ? 'var(--accent)' : 'var(--text-primary)', fontWeight: 600, fontSize: 14, cursor: 'pointer', textAlign: 'left' }}
                  >
                    <GitCommit size={16} />
                    Winding
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Pending SMS Suggestions ── */}
      {suggestions.length > 0 && (
        <div style={{ padding: '0 16px', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Sparkles size={18} color="var(--accent)" />
            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              AI Suggestions
            </h2>
          </div>
          <div style={{ display: 'flex', overflowX: 'auto', gap: 12, paddingBottom: 8, scrollbarWidth: 'none', margin: '0 -16px', paddingLeft: 16, paddingRight: 16 }}>
            {suggestions.map(sug => (
              <div key={sug._id} style={{ 
                background: 'var(--bg-card)', borderRadius: 20, padding: 16, border: '1px solid var(--border)', 
                minWidth: 280, maxWidth: 320, flexShrink: 0, boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                display: 'flex', flexDirection: 'column'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--accent-dim)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Sparkles size={16} />
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{sug.suggestedLabel || sug.sender}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{sug.date}</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{formatINR(sug.amount)}</div>
                </div>
                
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  "{sug.smsBody}"
                </div>

                <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
                  <button onClick={() => handleActionSuggestion(sug, 'approve')} style={{ flex: 1, padding: '8px', borderRadius: 12, background: 'var(--accent)', color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Review</button>
                  <button onClick={() => handleActionSuggestion(sug, 'reject')} style={{ padding: '8px 16px', borderRadius: 12, background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Dismiss</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Controls */}
      <div style={{ padding: '0 16px', display: 'flex', gap: 12, marginBottom: 16 }}>
        <div style={{ display: 'flex', background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
          <button onClick={() => setViewMode('monthly')} style={{ padding: '8px 12px', background: viewMode === 'monthly' ? 'var(--border)' : 'transparent', border: 'none', color: 'var(--text-primary)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>M</button>
          <button onClick={() => setViewMode('annual')} style={{ padding: '8px 12px', background: viewMode === 'annual' ? 'var(--border)' : 'transparent', border: 'none', color: 'var(--text-primary)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Y</button>
        </div>
        <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border)', padding: '0 8px' }}>
          {viewMode === 'monthly' ? (
            <>
              <button onClick={() => navigateMonth(-1)} style={{ background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', padding: '8px' }}><ChevronLeft size={18} /></button>
              <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>{MONTHS[selectedMonth - 1].substring(0,3)} {selectedYear}</span>
              <button onClick={() => navigateMonth(1)} style={{ background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', padding: '8px' }}><ChevronRight size={18} /></button>
            </>
          ) : (
            <>
              <button onClick={() => setSelectedYear(y => y - 1)} style={{ background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', padding: '8px' }}><ChevronLeft size={18} /></button>
              <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>{selectedYear}</span>
              <button onClick={() => setSelectedYear(y => y + 1)} style={{ background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', padding: '8px' }}><ChevronRight size={18} /></button>
            </>
          )}
        </div>
      </div>

      {/* Search */}
      <div style={{ padding: '0 16px', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: '0 12px' }}>
          <Search size={18} color="var(--text-secondary)" />
          <input 
            type="text" 
            placeholder="Search notes, categories, or amounts..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ flex: 1, border: 'none', background: 'transparent', padding: '12px 8px', fontSize: 14, color: 'var(--text-primary)', outline: 'none' }}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', padding: 4 }}>
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', overflowX: 'auto', gap: 8, padding: '0 16px 16px', scrollbarWidth: 'none' }}>
        <button
          onClick={() => { setFilterCategory(''); setFilterTag(''); }}
          style={{ whiteSpace: 'nowrap', padding: '6px 16px', borderRadius: 9999, border: '1px solid var(--border)', background: (!filterCategory && !filterTag) ? 'var(--text-primary)' : 'var(--bg-card)', color: (!filterCategory && !filterTag) ? 'var(--bg-card)' : 'var(--text-primary)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
        >All</button>
        {allTags.map(tag => (
          <button
            key={tag}
            onClick={() => { setFilterTag(filterTag === tag ? '' : tag); setFilterCategory(''); }}
            style={{ whiteSpace: 'nowrap', padding: '6px 16px', borderRadius: 9999, border: `1px solid ${filterTag === tag ? 'var(--accent)' : 'var(--border)'}`, background: filterTag === tag ? 'var(--accent)' : 'var(--bg-card)', color: filterTag === tag ? '#fff' : 'var(--text-primary)', fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}
          >{tag}</button>
        ))}
        {settings?.categories?.map(c => (
          <button
            key={c.id}
            onClick={() => { setFilterCategory(c.id); setFilterTag(''); }}
            style={{ whiteSpace: 'nowrap', padding: '6px 16px', borderRadius: 9999, border: '1px solid var(--border)', background: filterCategory === c.id ? 'var(--text-primary)' : 'var(--bg-card)', color: filterCategory === c.id ? 'var(--bg-card)' : 'var(--text-primary)', fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}
          >{c.name}</button>
        ))}
      </div>

      {/* List / Timeline */}
      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: '60px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📭</div>
          <h3 style={{ fontSize: 18, color: 'var(--text-primary)', marginBottom: 8 }}>No expenses found</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Try changing filters or add a new expense.</p>
        </div>
      ) : viewLayout === 'timeline' ? (
        <ExpenseTimelineView 
          expenses={filtered} 
          viewMode={viewMode} 
          categories={settings?.categories || []} 

          onEdit={setEditingExp}
          onDelete={handleDeleteClick}
        />
      ) : viewMode === 'monthly' ? (
        <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--r-xl)', border: '1px solid var(--border)', overflow: 'hidden', margin: '0 16px' }}>
          <div style={{ padding: '16px 20px', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{MONTHS[selectedMonth - 1]} {selectedYear}</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--danger)' }}>{formatINR(totalSpent)}</div>
          </div>
          {groupedByDay?.map(([dateStr, exps], groupIdx) => {
            const d = new Date(dateStr);
            const day = String(d.getDate()).padStart(2, '0');
            const yearMonth = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}`;
            const weekday = d.toLocaleDateString('en-US', { weekday: 'short' });
            
            return (
              <div key={dateStr} style={{ display: 'flex', borderBottom: groupIdx === groupedByDay.length - 1 ? 'none' : '1px solid var(--border)' }}>
                {/* Date Column */}
                <div style={{ width: 90, padding: '16px 12px', display: 'flex', gap: 8, flexShrink: 0, alignItems: 'flex-start', background: 'var(--bg-input)' }}>
                  <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 0.9 }}>
                    {day}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', lineHeight: 1 }}>{yearMonth}</span>
                    <span style={{ fontSize: 9, fontWeight: 700, background: 'var(--bg-elevated)', color: 'var(--text-secondary)', padding: '2px 4px', borderRadius: 4, display: 'inline-block', textAlign: 'center' }}>
                      {weekday}
                    </span>
                  </div>
                </div>
                {/* Expenses Column */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  {exps.map((exp, i) => (
                    <div key={exp._id} style={{ borderBottom: i === exps.length - 1 ? 'none' : '1px solid var(--border)' }}>
                      <ExpenseRow exp={exp} />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {groupedByMonth?.map(([monthKey, exps]) => {
            const [y, m] = monthKey.split('-');
            const monthName = MONTHS[parseInt(m) - 1];
            const groupTotal = exps.reduce((s, e) => s + e.amount, 0);
            return (
              <div key={monthKey} style={{ background: 'var(--bg-card)', borderRadius: 'var(--r-xl)', border: '1px solid var(--border)', overflow: 'hidden', margin: '0 16px' }}>
                {/* Month Header */}
                <div style={{ padding: '16px 20px', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{monthName} {y}</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--danger)' }}>{formatINR(groupTotal)}</div>
                </div>
                {/* Expenses List */}
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {Object.entries(exps.reduce((acc, e) => {
                    if (!acc[e.date]) acc[e.date] = [];
                    acc[e.date].push(e);
                    return acc;
                  }, {} as Record<string, Expense[]>))
                  .sort(([a], [b]) => sortDir === 'asc' ? a.localeCompare(b) : b.localeCompare(a))
                  .map(([dateStr, dayExps], dayGroupIdx, arr) => {
                    const d = new Date(dateStr);
                    const day = String(d.getDate()).padStart(2, '0');
                    const weekday = d.toLocaleDateString('en-US', { weekday: 'short' });
                    return (
                      <div key={dateStr} style={{ display: 'flex', borderBottom: dayGroupIdx === arr.length - 1 ? 'none' : '1px solid var(--border)' }}>
                        <div style={{ width: 64, padding: '14px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'var(--bg-input)', borderRight: '1px solid var(--border)', flexShrink: 0 }}>
                          <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)' }}>{day}</span>
                          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)' }}>{weekday}</span>
                        </div>
                        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                          {dayExps.map((exp, i) => (
                            <div key={exp._id} style={{ borderBottom: i === dayExps.length - 1 ? 'none' : '1px solid var(--border)' }}>
                              <ExpenseRow exp={exp} />
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Bottom Sheet */}
      {editingExp && (
        <>
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 999, backdropFilter: 'blur(4px)' }} onClick={() => setEditingExp(null)} />
          <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'var(--bg-card)', borderRadius: '24px 24px 0 0', padding: 24, zIndex: 1000, boxShadow: '0 -10px 40px rgba(0,0,0,0.3)' }}>
            <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20, color: 'var(--text-primary)' }}>Edit Expense</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, color: 'var(--text-muted)', marginBottom: 6 }}>Date</label>
                <input type="date" style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '12px 16px', borderRadius: 12, fontSize: 16 }} value={editingExp.date} onChange={e => setEditingExp({ ...editingExp, date: e.target.value })} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, color: 'var(--text-muted)', marginBottom: 6 }}>Category</label>
                <select style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '12px 16px', borderRadius: 12, fontSize: 16, appearance: 'none' }} value={editingExp.categoryId} onChange={e => setEditingExp({ ...editingExp, categoryId: e.target.value })}>
                  {(settings?.categories ?? []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, color: 'var(--text-muted)', marginBottom: 6 }}>Amount (₹)</label>
                <input type="number" style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '12px 16px', borderRadius: 12, fontSize: 16 }} value={editingExp.amount} onChange={e => setEditingExp({ ...editingExp, amount: parseFloat(e.target.value) || 0 })} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, color: 'var(--text-muted)', marginBottom: 6 }}>Note</label>
                <input type="text" style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '12px 16px', borderRadius: 12, fontSize: 16 }} value={editingExp.note || ''} onChange={e => setEditingExp({ ...editingExp, note: e.target.value })} />
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                <button style={{ flex: 1, padding: 14, borderRadius: 12, border: 'none', background: 'var(--border)', color: 'var(--text-primary)', fontWeight: 600, fontSize: 16, cursor: 'pointer' }} onClick={() => setEditingExp(null)}>Cancel</button>
                <button style={{ flex: 1, padding: 14, borderRadius: 12, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 600, fontSize: 16, cursor: 'pointer', opacity: saving ? 0.7 : 1 }} onClick={handleUpdate} disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Review Suggestion Bottom Sheet */}
      {reviewSuggestion && (
        <>
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 999, backdropFilter: 'blur(4px)' }} onClick={() => setReviewSuggestion(null)} />
          <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'var(--bg-card)', borderRadius: '24px 24px 0 0', padding: 24, zIndex: 1000, boxShadow: '0 -10px 40px rgba(0,0,0,0.3)' }}>
            <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20, color: 'var(--text-primary)' }}>Review AI Suggestion</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, color: 'var(--text-muted)', marginBottom: 6 }}>Date</label>
                <input type="date" style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '12px 16px', borderRadius: 12, fontSize: 16 }} value={reviewForm.date} onChange={e => setReviewForm({ ...reviewForm, date: e.target.value })} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>Category</label>
                <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 8, scrollbarWidth: 'none', margin: '0 -4px', padding: '0 4px 8px 4px' }}>
                  {(() => {
                    const sortedCategories = [...(settings?.categories ?? [])].sort((a, b) => {
                      if (a.id === reviewForm.categoryId) return -1;
                      if (b.id === reviewForm.categoryId) return 1;
                      return 0;
                    });
                    return sortedCategories.map(cat => {
                      const isSelected = reviewForm.categoryId === cat.id;
                      return (
                        <button 
                          key={cat.id} type="button"
                          onClick={() => setReviewForm({ ...reviewForm, categoryId: cat.id })}
                          style={{ 
                            padding: '10px 16px', borderRadius: 9999, fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap',
                            background: isSelected ? 'var(--accent)' : 'var(--bg-elevated)',
                            border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                            color: isSelected ? '#fff' : 'var(--text-secondary)',
                            display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', flexShrink: 0,
                            transition: 'all 0.2s'
                          }}
                        >
                          <CategoryIcon name={cat.name} size={14} /> {cat.name}
                        </button>
                      );
                    });
                  })()}
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, color: 'var(--text-muted)', marginBottom: 6 }}>Amount (₹)</label>
                <input type="number" step="0.01" style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '12px 16px', borderRadius: 12, fontSize: 16 }} value={reviewForm.amount} onChange={e => setReviewForm({ ...reviewForm, amount: e.target.value })} />
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Split ways</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {reviewSplitWays > 1 && reviewForm.amount && (
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>
                      = ₹{Math.round((parseFloat(reviewForm.amount) / reviewSplitWays) * 100) / 100} / person
                    </span>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg)', borderRadius: 20, border: '1px solid var(--border)' }}>
                    <button type="button" onClick={() => setReviewSplitWays(Math.max(1, reviewSplitWays - 1))} style={{ background: 'none', border: 'none', padding: '4px 12px', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 16 }}>-</button>
                    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', minWidth: 20, textAlign: 'center' }}>{reviewSplitWays}</span>
                    <button type="button" onClick={() => setReviewSplitWays(reviewSplitWays + 1)} style={{ background: 'none', border: 'none', padding: '4px 12px', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 16 }}>+</button>
                  </div>
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, color: 'var(--text-muted)', marginBottom: 6 }}>Note</label>
                <input type="text" style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '12px 16px', borderRadius: 12, fontSize: 16, marginBottom: allTags.length > 0 ? 12 : 0 }} value={reviewForm.note || ''} onChange={e => setReviewForm({ ...reviewForm, note: e.target.value })} />
                
                {allTags.length > 0 && (
                  <div style={{ display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 4 }}>
                    {allTags.slice(0, 8).map(tag => (
                      <button 
                        key={tag} type="button"
                        onClick={() => {
                          const currentNote = (reviewForm.note || '').trim();
                          if (!currentNote.includes(tag)) {
                            setReviewForm(f => ({ ...f, note: currentNote ? `${currentNote} ${tag}` : tag }));
                          }
                        }}
                        style={{ padding: '6px 12px', borderRadius: 9999, background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                <button style={{ flex: 1, padding: 14, borderRadius: 12, border: 'none', background: 'var(--border)', color: 'var(--text-primary)', fontWeight: 600, fontSize: 16, cursor: 'pointer' }} onClick={() => setReviewSuggestion(null)}>Cancel</button>
                <button style={{ flex: 1, padding: 14, borderRadius: 12, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 600, fontSize: 16, cursor: 'pointer', opacity: saving ? 0.7 : 1 }} onClick={() => submitReviewForm()} disabled={saving}>{saving ? 'Saving...' : 'Confirm'}</button>
              </div>
            </div>
          </div>
        </>
      )}

      {toast && (
        <div style={{ position: 'fixed', bottom: 100, left: '50%', transform: 'translateX(-50%)', background: toast.type === 'success' ? 'var(--success)' : 'var(--danger)', color: '#fff', padding: '12px 24px', borderRadius: 9999, fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, zIndex: 1000, boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
          {toast.type === 'success' ? <CheckCircle2 size={18} /> : <XCircle size={18} />} {toast.msg}
        </div>
      )}

      <ConfirmModal
        isOpen={!!confirmDialog?.isOpen}
        message="Are you sure you want to delete this expense?"
        onConfirm={confirmDelete}
        onCancel={() => setConfirmDialog(null)}
      />
    </div>
  );
}
