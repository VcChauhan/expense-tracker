'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { formatINR, MONTHS, SHORT_MONTHS, Expense, Settings, Category, Suggestion, PaymentMethod } from '@/lib/types';
import { CalendarDays, Edit2, Trash2, CheckCircle2, XCircle, ChevronLeft, ChevronRight, Sparkles, LayoutList, GitCommit, Search, Download, SlidersHorizontal, X, Calendar } from 'lucide-react';
import { CategoryIcon } from '@/components/CategoryIcon';
import { TagSelector } from '@/components/TagSelector';
import { ConfirmModal } from '@/components/ConfirmModal';
import { ExpenseTimelineView } from '@/components/ExpenseTimelineView';
import { ExpenseCalendarView } from '@/components/ExpenseCalendarView';
import { PaymentMethodBadge, PaymentMethodSelector } from '@/components/PaymentMethodSelector';
import { semanticFilterExpenses } from '@/lib/semanticSearch';

type ViewMode = 'monthly' | 'annual';
type SortField = 'date' | 'amount';
type SortDir = 'asc' | 'desc';

export default function ExpensesPage() {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const [settings, setSettings] = useState<Settings | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ isOpen: boolean; id: string } | null>(null);

  // Filters
  const [viewMode, setViewMode]           = useState<ViewMode>('monthly');
  const [viewLayout, setViewLayout]       = useState<'list' | 'timeline' | 'calendar'>('list');
  const [menuOpen, setMenuOpen]           = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('expenseViewLayout');
      if (saved === 'list' || saved === 'timeline' || saved === 'calendar') setViewLayout(saved);
    }
  }, []);

  function handleSetViewLayout(layout: 'list' | 'timeline' | 'calendar') {
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
  const [filterPaymentMethod, setFilterPaymentMethod] = useState('');
  const [filterCardKey, setFilterCardKey] = useState(''); // last4 (or id) of a specific saved credit card
  const [minAmount, setMinAmount]         = useState('');
  const [maxAmount, setMaxAmount]         = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Edit modal
  const [editingExp, setEditingExp]     = useState<Expense | null>(null);
  const [saving, setSaving]             = useState(false);

  // Suggestions
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [reviewSuggestion, setReviewSuggestion] = useState<Suggestion | null>(null);
  const [reviewForm, setReviewForm]     = useState({ date: today, categoryId: '', amount: '', note: '', tags: [] as string[] });
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
      list = list.filter(exp => (exp.tags || []).some(t => t.toLowerCase() === filterTag.toLowerCase()));
    }

    if (filterPaymentMethod === 'credit_card') {
      // Matches both the bare "credit_card" value and card-specific values
      // like "credit_card:1234" — the generic chip should catch all of them.
      list = list.filter(exp => (exp.paymentMethod || 'upi').startsWith('credit_card'));
    } else if (filterPaymentMethod) {
      list = list.filter(exp => (exp.paymentMethod || 'upi') === filterPaymentMethod);
    }

    if (filterCardKey) {
      list = list.filter(exp => exp.paymentMethod === `credit_card:${filterCardKey}`);
    }

    if (minAmount && !isNaN(parseFloat(minAmount))) {
      list = list.filter(exp => exp.amount >= parseFloat(minAmount));
    }

    if (maxAmount && !isNaN(parseFloat(maxAmount))) {
      list = list.filter(exp => exp.amount <= parseFloat(maxAmount));
    }
    
    if (searchQuery.trim()) {
      list = semanticFilterExpenses(list, searchQuery, settings?.categories || []);
    }
    const mul = sortDir === 'asc' ? 1 : -1;
    list.sort((a, b) => {
      if (sortBy === 'date') return mul * a.date.localeCompare(b.date);
      return mul * (a.amount - b.amount);
    });
    return list;
  }, [expenses, sortBy, sortDir, searchQuery, settings, filterTag, filterPaymentMethod, filterCardKey, minAmount, maxAmount]);

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
      if (exp.tags && Array.isArray(exp.tags)) {
        exp.tags.forEach(t => tags.add(t.toLowerCase()));
      }
    });
    return Array.from(tags).sort();
  }, [expenses]);

  function downloadCSV() {
    const headers = ['Date', 'Category', 'Amount', 'Note', 'Tags'];
    const rows = filtered.map(exp => {
      const cat = getCategoryById(exp.categoryId)?.name || 'Unknown';
      const tagsStr = exp.tags ? exp.tags.join(', ') : '';
      return [
        exp.date,
        `"${cat}"`,
        exp.amount,
        `"${(exp.note || '').replace(/"/g, '""')}"`,
        `"${tagsStr.replace(/"/g, '""')}"`
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
        date: sug.date || today, 
        categoryId: sug.suggestedCategory || settings?.categories[0]?.id || '', 
        amount: sug.amount ? String(sug.amount) : '', 
        note: sug.suggestedLabel || '',
        tags: (sug as any).suggestedTags || [],
        paymentMethod: (sug as any).suggestedPaymentMethod || 'upi'
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
        body: JSON.stringify({ ...reviewForm, amount: finalAmount, note: finalNote, tags: reviewForm.tags }),
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
            <span>•</span>
            <PaymentMethodBadge method={exp.paymentMethod || 'upi'} />
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
      <div style={{ padding: '24px 16px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Expense Log</h1>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
            <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{filtered.length} entries</span> • <span style={{ color: 'var(--accent-2)', fontWeight: 800 }}>{formatINR(totalSpent)}</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* CSV Download Button */}
          <button 
            onClick={downloadCSV}
            style={{
              background: 'var(--bg-elevated)', border: '1px solid var(--border)',
              cursor: 'pointer', padding: '7px 14px', display: 'flex', alignItems: 'center', gap: 6,
              borderRadius: 9999, color: 'var(--text-primary)', fontSize: 12, fontWeight: 700,
              boxShadow: 'var(--shadow-xs)', fontFamily: "'DM Sans', sans-serif",
            }}
          >
            <Download size={13} color="var(--accent-2)" />
            Export CSV
          </button>
        </div>
      </div>

      {/* ── View Layout Segmented Control ── */}
      <div style={{ padding: '0 16px', marginBottom: 16 }}>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 14, padding: 3, gap: 4,
        }}>
          <button
            onClick={() => handleSetViewLayout('list')}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              padding: '8px 0', borderRadius: 11, border: 'none',
              background: viewLayout === 'list' ? 'var(--accent)' : 'transparent',
              color: viewLayout === 'list' ? '#fff' : 'var(--text-secondary)',
              fontWeight: 700, fontSize: 13, cursor: 'pointer',
              transition: 'all 0.2s ease',
              fontFamily: "'DM Sans', sans-serif",
              boxShadow: viewLayout === 'list' ? '0 2px 10px rgba(124,92,252,0.3)' : 'none',
            }}
          >
            <LayoutList size={15} />
            <span>List</span>
          </button>

          <button
            onClick={() => handleSetViewLayout('timeline')}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              padding: '8px 0', borderRadius: 11, border: 'none',
              background: viewLayout === 'timeline' ? 'var(--accent)' : 'transparent',
              color: viewLayout === 'timeline' ? '#fff' : 'var(--text-secondary)',
              fontWeight: 700, fontSize: 13, cursor: 'pointer',
              transition: 'all 0.2s ease',
              fontFamily: "'DM Sans', sans-serif",
              boxShadow: viewLayout === 'timeline' ? '0 2px 10px rgba(124,92,252,0.3)' : 'none',
            }}
          >
            <GitCommit size={15} />
            <span>Timeline</span>
          </button>

          <button
            onClick={() => handleSetViewLayout('calendar')}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              padding: '8px 0', borderRadius: 11, border: 'none',
              background: viewLayout === 'calendar' ? 'var(--accent)' : 'transparent',
              color: viewLayout === 'calendar' ? '#fff' : 'var(--text-secondary)',
              fontWeight: 700, fontSize: 13, cursor: 'pointer',
              transition: 'all 0.2s ease',
              fontFamily: "'DM Sans', sans-serif",
              boxShadow: viewLayout === 'calendar' ? '0 2px 10px rgba(124,92,252,0.3)' : 'none',
            }}
          >
            <Calendar size={15} />
            <span>Calendar</span>
          </button>
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
                  &quot;{sug.smsBody}&quot;
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

      {/* Period Navigator Controls */}
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

      {/* Search & Filter Trigger */}
      <div style={{ padding: '0 16px', marginBottom: 12, display: 'flex', gap: 8 }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: '0 12px' }}>
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

        <button
          onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            padding: '0 14px', borderRadius: 16,
            background: showAdvancedFilters || filterPaymentMethod || minAmount || maxAmount ? 'var(--accent)' : 'var(--bg-card)',
            border: '1px solid var(--border)',
            color: showAdvancedFilters || filterPaymentMethod || minAmount || maxAmount ? '#fff' : 'var(--text-primary)',
            cursor: 'pointer', fontSize: 13, fontWeight: 700,
          }}
          title="Advanced Filters"
        >
          <SlidersHorizontal size={16} />
        </button>
      </div>

      {/* Advanced Filters Expandable Drawer */}
      {showAdvancedFilters && (
        <div style={{
          margin: '0 16px 14px', padding: '16px', borderRadius: 18,
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          display: 'flex', flexDirection: 'column', gap: 12,
          animation: 'fadeIn 0.2s ease',
        }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
              Payment Method
            </label>
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 4 }}>
              {['', 'upi', 'credit_card', 'debit_card', 'cash', 'netbanking'].map((pm) => (
                <button
                  key={pm}
                  onClick={() => { setFilterPaymentMethod(filterPaymentMethod === pm ? '' : pm); setFilterCardKey(''); }}
                  style={{
                    padding: '6px 12px', borderRadius: 99, fontSize: 12, fontWeight: 700,
                    border: '1px solid var(--border)',
                    background: filterPaymentMethod === pm ? 'var(--accent)' : 'var(--bg-elevated)',
                    color: filterPaymentMethod === pm ? '#fff' : 'var(--text-secondary)',
                    cursor: 'pointer', whiteSpace: 'nowrap',
                  }}
                >
                  {pm === '' ? 'All Methods' : pm === 'upi' ? 'UPI' : pm === 'credit_card' ? 'Credit Card' : pm === 'debit_card' ? 'Debit Card' : pm === 'cash' ? 'Cash' : 'NetBanking'}
                </button>
              ))}
            </div>
            {/* Narrow down to one specific saved card */}
            {filterPaymentMethod === 'credit_card' && (settings?.creditCards?.length ?? 0) > 0 && (
              <div style={{ display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none', marginTop: 8, paddingBottom: 4 }}>
                {(settings?.creditCards ?? []).map(card => {
                  const cardKey = card.last4 || card.id;
                  const isActive = filterCardKey === cardKey;
                  return (
                    <button
                      key={card.id}
                      onClick={() => setFilterCardKey(isActive ? '' : cardKey)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
                        padding: '5px 11px', borderRadius: 99, fontSize: 11.5, fontWeight: 700,
                        border: `1.5px solid ${isActive ? (card.color || 'var(--accent)') : 'var(--border)'}`,
                        background: isActive ? `color-mix(in srgb, ${card.color || 'var(--accent)'} 16%, transparent)` : 'var(--bg-elevated)',
                        color: isActive ? (card.color || 'var(--accent)') : 'var(--text-secondary)',
                        cursor: 'pointer', whiteSpace: 'nowrap',
                      }}
                    >
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: card.color || 'var(--accent)', flexShrink: 0 }} />
                      {card.name} {card.last4 ? `••${card.last4}` : ''}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                Min Amount (₹)
              </label>
              <input
                type="number"
                placeholder="0"
                value={minAmount}
                onChange={e => setMinAmount(e.target.value)}
                style={{
                  width: '100%', padding: '8px 10px', borderRadius: 10,
                  background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                  color: 'var(--text-primary)', fontSize: 13, boxSizing: 'border-box',
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                Max Amount (₹)
              </label>
              <input
                type="number"
                placeholder="No limit"
                value={maxAmount}
                onChange={e => setMaxAmount(e.target.value)}
                style={{
                  width: '100%', padding: '8px 10px', borderRadius: 10,
                  background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                  color: 'var(--text-primary)', fontSize: 13, boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          {(filterPaymentMethod || filterCardKey || minAmount || maxAmount) && (
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setFilterPaymentMethod(''); setFilterCardKey(''); setMinAmount(''); setMaxAmount(''); }}
                style={{ background: 'none', border: 'none', color: 'var(--danger)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
              >
                Reset Filters
              </button>
            </div>
          )}
        </div>
      )}

      {/* Active Filter Dismissible Chips */}
      {(filterCategory || filterTag || filterPaymentMethod || filterCardKey || minAmount || maxAmount) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '0 16px 12px' }}>
          {filterCategory && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '4px 10px', borderRadius: 99, background: 'var(--accent-dim)',
              color: 'var(--accent-2)', fontSize: 12, fontWeight: 700,
            }}>
              {getCategoryById(filterCategory)?.name || 'Category'}
              <button onClick={() => setFilterCategory('')} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0, display: 'flex' }}>
                <X size={12} />
              </button>
            </span>
          )}

          {filterTag && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '4px 10px', borderRadius: 99, background: 'var(--accent-dim)',
              color: 'var(--accent-2)', fontSize: 12, fontWeight: 700,
            }}>
              #{filterTag}
              <button onClick={() => setFilterTag('')} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0, display: 'flex' }}>
                <X size={12} />
              </button>
            </span>
          )}

          {filterPaymentMethod && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '4px 10px', borderRadius: 99, background: 'var(--accent-dim)',
              color: 'var(--accent-2)', fontSize: 12, fontWeight: 700,
            }}>
              Method: {filterPaymentMethod.replace('_', ' ').toUpperCase()}
              <button onClick={() => { setFilterPaymentMethod(''); setFilterCardKey(''); }} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0, display: 'flex' }}>
                <X size={12} />
              </button>
            </span>
          )}

          {filterCardKey && (() => {
            const card = settings?.creditCards?.find(c => (c.last4 || c.id) === filterCardKey);
            return (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '4px 10px', borderRadius: 99, background: 'var(--accent-dim)',
                color: 'var(--accent-2)', fontSize: 12, fontWeight: 700,
              }}>
                Card: {card ? `${card.name} ••${card.last4 || ''}` : filterCardKey}
                <button onClick={() => setFilterCardKey('')} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0, display: 'flex' }}>
                  <X size={12} />
                </button>
              </span>
            );
          })()}

          {minAmount && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '4px 10px', borderRadius: 99, background: 'var(--accent-dim)',
              color: 'var(--accent-2)', fontSize: 12, fontWeight: 700,
            }}>
              ≥ ₹{minAmount}
              <button onClick={() => setMinAmount('')} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0, display: 'flex' }}>
                <X size={12} />
              </button>
            </span>
          )}

          {maxAmount && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '4px 10px', borderRadius: 99, background: 'var(--accent-dim)',
              color: 'var(--accent-2)', fontSize: 12, fontWeight: 700,
            }}>
              ≤ ₹{maxAmount}
              <button onClick={() => setMaxAmount('')} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0, display: 'flex' }}>
                <X size={12} />
              </button>
            </span>
          )}

          <button
            onClick={() => { setFilterCategory(''); setFilterTag(''); setFilterPaymentMethod(''); setFilterCardKey(''); setMinAmount(''); setMaxAmount(''); }}
            style={{
              padding: '4px 8px', borderRadius: 99, background: 'transparent',
              border: 'none', color: 'var(--text-muted)', fontSize: 11, fontWeight: 700, cursor: 'pointer',
            }}
          >
            Clear All
          </button>
        </div>
      )}

      {/* Category Pills Row */}
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
      ) : viewLayout === 'calendar' ? (
        <div style={{ padding: '0 16px' }}>
          <ExpenseCalendarView
            expenses={filtered}
            selectedMonth={selectedMonth}
            selectedYear={selectedYear}
            categories={settings?.categories || []}
            onEdit={setEditingExp}
            onDelete={handleDeleteClick}
          />
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
      {editingExp && (() => {
        const editActiveCategory = settings?.categories?.find(c => c.id === editingExp.categoryId);
        const editColor = editActiveCategory?.color ?? 'var(--accent)';
        return (
          <div
            style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              zIndex: 99999,
              display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center',
              background: 'rgba(0,0,0,0.65)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              animation: 'fadeIn 0.2s ease-out',
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget) setEditingExp(null);
            }}
          >
            <div
              style={{
                width: '100%', maxWidth: '500px', maxHeight: '88vh',
                boxSizing: 'border-box', overflowY: 'auto',
                background: 'var(--bg-card)', color: 'var(--text-primary)',
                borderRadius: '28px 28px 0 0',
                border: '1px solid var(--border-strong)', borderBottom: 'none',
                boxShadow: '0 -10px 40px rgba(0,0,0,0.5)',
                padding: '24px 20px',
                animation: 'slide-up-fast 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
                paddingBottom: 'calc(16px + env(safe-area-inset-bottom))',
              }}
            >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, position: 'relative' }}>
              <div style={{
                position: 'absolute', top: -24, left: -24, right: -24, height: 80,
                background: `linear-gradient(135deg, ${editColor}1a 0%, transparent 75%)`,
                pointerEvents: 'none',
              }} />
              <div style={{
                width: 34, height: 34, borderRadius: 11, flexShrink: 0, position: 'relative',
                background: `linear-gradient(135deg, ${editColor} 0%, var(--accent-2) 100%)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: `0 4px 14px ${editColor}55`,
              }}>
                <Edit2 size={16} color="#fff" />
              </div>
              <h3 style={{ fontSize: 19, fontWeight: 800, margin: 0, color: 'var(--text-primary)', position: 'relative' }}>Edit Expense</h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, color: 'var(--text-muted)', marginBottom: 6 }}>Amount (₹)</label>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: 'var(--bg)', borderRadius: 14, padding: '4px 16px',
                  border: `1.5px solid ${editColor}`,
                  boxShadow: `0 6px 18px -8px ${editColor}66`,
                  transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
                }}>
                  <span style={{ fontSize: 16, fontWeight: 700, color: editColor }}>₹</span>
                  <input
                    type="number"
                    style={{ flex: 1, width: '100%', background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-primary)', padding: '10px 0', fontSize: 20, fontWeight: 800 }}
                    value={editingExp.amount}
                    onChange={e => setEditingExp({ ...editingExp, amount: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>Category</label>
                <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 6, scrollbarWidth: 'none', margin: '0 -24px', padding: '0 24px 6px' }}>
                  {(() => {
                    const sorted = [...(settings?.categories ?? [])].sort((a, b) => {
                      if (a.id === editingExp.categoryId) return -1;
                      if (b.id === editingExp.categoryId) return 1;
                      return 0;
                    });
                    return sorted.map(cat => {
                      const isSelected = editingExp.categoryId === cat.id;
                      return (
                        <button
                          key={cat.id} type="button"
                          onClick={() => setEditingExp({ ...editingExp, categoryId: cat.id })}
                          style={{
                            padding: isSelected ? '8px 16px 8px 8px' : '10px 16px', borderRadius: 9999, fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap',
                            background: isSelected ? cat.color : 'var(--bg-elevated)',
                            border: `1.5px solid ${isSelected ? cat.color : 'var(--border)'}`,
                            color: isSelected ? '#fff' : 'var(--text-secondary)',
                            display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', flexShrink: 0,
                            transition: 'all 0.2s',
                            transform: isSelected ? 'scale(1.03)' : 'scale(1)',
                            boxShadow: isSelected ? `0 4px 14px ${cat.color}55` : 'none',
                          }}
                        >
                          {isSelected ? (
                            <span style={{ width: 22, height: 22, borderRadius: '50%', flexShrink: 0, background: 'rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <CategoryIcon name={cat.name} size={12} color="#fff" />
                            </span>
                          ) : (
                            <CategoryIcon name={cat.name} size={14} />
                          )}
                          {cat.name}
                        </button>
                      );
                    });
                  })()}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, color: 'var(--text-muted)', marginBottom: 6 }}>Date</label>
                <input type="date" style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '12px 16px', borderRadius: 12, fontSize: 16 }} value={editingExp.date} onChange={e => setEditingExp({ ...editingExp, date: e.target.value })} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, color: 'var(--text-muted)', marginBottom: 6 }}>Note</label>
                <input type="text" style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '12px 16px', borderRadius: 12, fontSize: 16 }} value={editingExp.note || ''} onChange={e => setEditingExp({ ...editingExp, note: e.target.value })} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, color: 'var(--text-muted)', marginBottom: 6 }}>Payment Method</label>
                <PaymentMethodSelector 
                  value={editingExp.paymentMethod || 'upi'} 
                  onChange={paymentMethod => setEditingExp({ ...editingExp, paymentMethod })}
                  creditCards={settings?.creditCards || []}
                />
              </div>
              <div>
                <TagSelector 
                  selectedTags={editingExp.tags || []} 
                  onChange={tags => setEditingExp({ ...editingExp, tags })}
                  suggestedTags={allTags.slice(0, 8)} 
                />
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                <button style={{ flex: 1, padding: 14, borderRadius: 12, border: 'none', background: 'var(--border)', color: 'var(--text-primary)', fontWeight: 600, fontSize: 16, cursor: 'pointer' }} onClick={() => setEditingExp(null)}>Cancel</button>
                <button
                  style={{
                    flex: 1, padding: 14, borderRadius: 12, border: 'none',
                    background: `linear-gradient(135deg, ${editColor} 0%, var(--accent-2) 100%)`,
                    color: '#fff', fontWeight: 700, fontSize: 16, cursor: 'pointer',
                    opacity: saving ? 0.7 : 1,
                    boxShadow: `0 8px 20px -8px ${editColor}88`,
                  }}
                  onClick={handleUpdate} disabled={saving}
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
        );
      })()}

      {/* Review Suggestion Bottom Sheet */}
      {reviewSuggestion && (() => {
        const reviewActiveCategory = settings?.categories?.find(c => c.id === reviewForm.categoryId);
        const reviewColor = reviewActiveCategory?.color ?? 'var(--accent)';
        return (
          <div
            style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              zIndex: 99999,
              display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center',
              background: 'rgba(0,0,0,0.65)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              animation: 'fadeIn 0.2s ease-out',
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget) setReviewSuggestion(null);
            }}
          >
            <div
              style={{
                width: '100%', maxWidth: '500px', maxHeight: '85vh', maxHeight: '85dvh',
                display: 'flex', flexDirection: 'column',
                background: 'var(--bg-card)', color: 'var(--text-primary)',
                borderRadius: '28px 28px 0 0',
                border: '1px solid var(--border-strong)', borderBottom: 'none',
                boxShadow: '0 -10px 40px rgba(0,0,0,0.5)',
                overflow: 'hidden',
              }}
            >
              <div style={{
                overflowY: 'auto', WebkitOverflowScrolling: 'touch',
                padding: '24px 20px calc(40px + env(safe-area-inset-bottom, 16px))',
                display: 'flex', flexDirection: 'column',
              }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, position: 'relative' }}>
              <div style={{
                position: 'absolute', top: -24, left: -24, right: -24, height: 80,
                background: `linear-gradient(135deg, ${reviewColor}1a 0%, transparent 75%)`,
                pointerEvents: 'none',
              }} />
              <div style={{
                width: 34, height: 34, borderRadius: 11, flexShrink: 0, position: 'relative',
                background: `linear-gradient(135deg, ${reviewColor} 0%, var(--accent-2) 100%)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: `0 4px 14px ${reviewColor}55`,
              }}>
                <Sparkles size={16} color="#fff" />
              </div>
              <h3 style={{ fontSize: 19, fontWeight: 800, margin: 0, color: 'var(--text-primary)', position: 'relative' }}>Review AI Suggestion</h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, color: 'var(--text-muted)', marginBottom: 6 }}>Amount (₹)</label>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: 'var(--bg)', borderRadius: 14, padding: '4px 16px',
                  border: `1.5px solid ${reviewColor}`,
                  boxShadow: `0 6px 18px -8px ${reviewColor}66`,
                  transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
                }}>
                  <span style={{ fontSize: 16, fontWeight: 700, color: reviewColor }}>₹</span>
                  <input
                    type="number" step="0.01"
                    style={{ flex: 1, width: '100%', background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-primary)', padding: '10px 0', fontSize: 20, fontWeight: 800 }}
                    value={reviewForm.amount}
                    onChange={e => setReviewForm({ ...reviewForm, amount: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, color: 'var(--text-muted)', marginBottom: 6 }}>Date</label>
                <input type="date" style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '12px 16px', borderRadius: 12, fontSize: 16 }} value={reviewForm.date} onChange={e => setReviewForm({ ...reviewForm, date: e.target.value })} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>Category</label>
                <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8, scrollbarWidth: 'none', margin: '0 -24px', padding: '0 24px 8px' }}>
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
                            padding: isSelected ? '8px 16px 8px 8px' : '10px 16px', borderRadius: 9999, fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap',
                            background: isSelected ? cat.color : 'var(--bg-elevated)',
                            border: `1.5px solid ${isSelected ? cat.color : 'var(--border)'}`,
                            color: isSelected ? '#fff' : 'var(--text-secondary)',
                            display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', flexShrink: 0,
                            transition: 'all 0.2s',
                            transform: isSelected ? 'scale(1.03)' : 'scale(1)',
                            boxShadow: isSelected ? `0 4px 14px ${cat.color}55` : 'none',
                          }}
                        >
                          {isSelected ? (
                            <span style={{ width: 22, height: 22, borderRadius: '50%', flexShrink: 0, background: 'rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <CategoryIcon name={cat.name} size={12} color="#fff" />
                            </span>
                          ) : (
                            <CategoryIcon name={cat.name} size={14} />
                          )}
                          {cat.name}
                        </button>
                      );
                    });
                  })()}
                </div>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Split ways</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {reviewSplitWays > 1 && reviewForm.amount && (
                    <span style={{ fontSize: 13, fontWeight: 700, color: reviewColor }}>
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
                <input type="text" style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '12px 16px', borderRadius: 12, fontSize: 16 }} value={reviewForm.note || ''} onChange={e => setReviewForm({ ...reviewForm, note: e.target.value })} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, color: 'var(--text-muted)', marginBottom: 6 }}>Payment Method</label>
                <PaymentMethodSelector 
                  value={reviewForm.paymentMethod || 'upi'} 
                  onChange={paymentMethod => setReviewForm({ ...reviewForm, paymentMethod })}
                  creditCards={settings?.creditCards || []}
                />
              </div>
              <div>
                <TagSelector 
                  selectedTags={reviewForm.tags} 
                  onChange={tags => setReviewForm({ ...reviewForm, tags })}
                  suggestedTags={allTags.slice(0, 8)} 
                />
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                <button style={{ flex: 1, padding: 14, borderRadius: 12, border: 'none', background: 'var(--border)', color: 'var(--text-primary)', fontWeight: 600, fontSize: 16, cursor: 'pointer' }} onClick={() => setReviewSuggestion(null)}>Cancel</button>
                <button
                  style={{
                    flex: 1, padding: 14, borderRadius: 12, border: 'none',
                    background: `linear-gradient(135deg, ${reviewColor} 0%, var(--accent-2) 100%)`,
                    color: '#fff', fontWeight: 700, fontSize: 16, cursor: 'pointer',
                    opacity: saving ? 0.7 : 1,
                    boxShadow: `0 8px 20px -8px ${reviewColor}88`,
                  }}
                  onClick={() => submitReviewForm()} disabled={saving}
                >
                  {saving ? 'Saving...' : 'Confirm'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
        );
      })()}

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
