'use client';

import React, { useState, useEffect, useRef } from 'react';
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
  const [form, setForm] = useState({ date: today, categoryId: '', accountId: '', amount: '', note: '' });
  
  // For reviewing a suggestion in a popup
  const [reviewSuggestion, setReviewSuggestion] = useState<Suggestion | null>(null);
  const [reviewForm, setReviewForm] = useState({ date: today, categoryId: '', accountId: '', amount: '', note: '' });
  const reviewDialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(s => {
      setSettings(s);
      if (s.categories?.length) {
        setForm(f => ({ ...f, categoryId: s.categories[0].id }));
        setReviewForm(f => ({ ...f, categoryId: s.categories[0].id }));
      }
      if (s.accounts?.length) {
        setForm(f => ({ ...f, accountId: s.accounts[0].id }));
        setReviewForm(f => ({ ...f, accountId: s.accounts[0].id }));
      }
    });
    fetchRecent();
    fetchSuggestions();
  }, []);

  useEffect(() => {
    const dialog = reviewDialogRef.current;
    if (!dialog) return;
    if (reviewSuggestion) dialog.showModal();
    else dialog.close();
  }, [reviewSuggestion]);

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
      setForm({ date: today, categoryId: settings?.categories[0]?.id ?? '', accountId: settings?.accounts?.[0]?.id ?? '', amount: '', note: '' });
      fetchRecent();
    } catch { showToast('Something went wrong', 'error'); }
    finally   { setLoading(false); }
  }

  function handleEdit(exp: Expense) {
    setEditingId(exp._id);
    setForm({ date: exp.date, categoryId: exp.categoryId, accountId: exp.accountId || '', amount: String(exp.amount), note: exp.note });
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
    setForm({ date: today, categoryId: settings?.categories[0]?.id ?? '', accountId: settings?.accounts?.[0]?.id ?? '', amount: '', note: '' });
  }

  async function handleActionSuggestion(sug: Suggestion, action: 'approve' | 'reject') {
    if (action === 'reject') {
      try {
        await fetch(`/api/suggestions/${sug._id}`, {
          method: 'DELETE',
        });
        fetchSuggestions();
      } catch {}
      return;
    }
    
    // approve opens the popup modal
    setReviewForm({
      date: sug.date,
      categoryId: sug.suggestedCategory || settings?.categories[0]?.id || '',
      accountId: settings?.accounts?.[0]?.id || '',
      amount: String(sug.amount),
      note: sug.suggestedLabel || `SMS: ${sug.smsBody.substring(0, 30)}...`,
    });
    setReviewSuggestion(sug);
  }

  async function submitReviewForm(e: React.FormEvent) {
    e.preventDefault();
    if (!reviewSuggestion || !reviewForm.amount || parseFloat(reviewForm.amount) <= 0) return;
    setLoading(true);
    try {
      // 1. Add Expense
      await fetch('/api/expenses', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...reviewForm, amount: parseFloat(reviewForm.amount) }),
      });
      // 2. Delete the suggestion from DB
      await fetch(`/api/suggestions/${reviewSuggestion._id}`, {
        method: 'DELETE',
      });
      showToast('Expense added!', 'success');
      setReviewSuggestion(null);
      fetchRecent();
      fetchSuggestions();
    } catch { showToast('Something went wrong', 'error'); }
    finally { setLoading(false); }
  }

  const getCat = (id: string) => settings?.categories.find(c => c.id === id);

  return (
    <div style={{ padding: '24px 16px', paddingBottom: '120px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: '700', color: 'var(--text-primary)', margin: '0 0 4px 0' }}>{editingId ? 'Edit Expense' : 'Add Expense'}</h1>
        <p style={{ fontSize: '15px', color: 'var(--text-secondary)', margin: 0 }}>Log your transactions</p>
      </div>

      {/* ── Pending SMS Suggestions ── */}
      {suggestions.length > 0 && (
        <div style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '16px' }}>
            Suggested from SMS
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {suggestions.map(sug => (
              <div key={sug._id} style={{ background: 'var(--bg-card)', borderRadius: '20px', padding: '16px', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)' }}>
                      {sug.suggestedLabel ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          ✨ {sug.suggestedLabel}
                          {sug.suggestedCategory && getCat(sug.suggestedCategory) && (
                            <span style={{ fontSize: '11px', background: 'var(--bg-elevated)', padding: '2px 6px', borderRadius: '6px', color: 'var(--text-secondary)', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '4px', border: '1px solid var(--border)' }}>
                              <CategoryIcon name={getCat(sug.suggestedCategory)?.name ?? ''} size={11} /> {getCat(sug.suggestedCategory)?.name}
                            </span>
                          )}
                        </span>
                      ) : (
                        sug.sender
                      )}
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px', wordBreak: 'break-word', lineHeight: '1.4' }}>
                      {sug.suggestedLabel ? (
                        <span style={{ opacity: 0.8 }}>From {sug.sender}: "{sug.smsBody}"</span>
                      ) : (
                        `"${sug.smsBody}"`
                      )}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>{sug.date}</div>
                  </div>
                  <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '12px' }}>
                    <span style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)' }}>
                      {formatINR(sug.amount)}
                    </span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => handleActionSuggestion(sug, 'approve')}
                        style={{ padding: '6px 12px', fontSize: '13px', borderRadius: 'var(--r-full)', cursor: 'pointer', border: 'none', background: 'var(--success)', color: '#fff', fontWeight: '600' }}
                      >Accept</button>
                      <button
                        type="button"
                        onClick={() => handleActionSuggestion(sug, 'reject')}
                        style={{ padding: '6px 12px', fontSize: '13px', borderRadius: 'var(--r-full)', cursor: 'pointer', border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-secondary)', fontWeight: '600' }}
                      >Reject</button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Form card ── */}
      <div style={{ background: 'var(--bg-card)', borderRadius: '24px', padding: '24px 20px', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border)', marginBottom: '32px' }}>
        <form onSubmit={handleSubmit}>
          {/* Date Pill */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
            <input 
              type="date" 
              value={form.date} 
              onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
              style={{ 
                background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--r-full)', 
                padding: '8px 16px', fontSize: '14px', color: 'var(--text-secondary)', fontWeight: '600', outline: 'none'
              }} 
              required 
            />
          </div>

          {/* Amount Display */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '32px', gap: '8px' }}>
            <span style={{ fontSize: '32px', fontWeight: '500', color: 'var(--text-secondary)' }}>₹</span>
            <input 
              type="number" step="0.01" min="0"
              value={form.amount}
              onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
              placeholder="0.00"
              style={{ 
                fontSize: '48px', fontWeight: '700', color: 'var(--text-primary)', background: 'transparent', 
                border: 'none', width: '100%', textAlign: 'center', outline: 'none', padding: 0
              }} 
              required 
            />
          </div>

          {/* Category Chips */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '12px' }}>Category</label>
            <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '8px', scrollbarWidth: 'none', margin: '0 -4px', padding: '0 4px 8px 4px' }}>
              {(settings?.categories ?? []).map(cat => {
                const isSelected = form.categoryId === cat.id;
                return (
                  <button 
                    key={cat.id} type="button"
                    onClick={() => setForm(f => ({ ...f, categoryId: cat.id }))}
                    style={{ 
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', minWidth: '72px',
                      background: isSelected ? 'var(--accent)' : 'var(--bg-elevated)', 
                      border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`, 
                      borderRadius: '16px', padding: '12px 8px', cursor: 'pointer', transition: 'all 0.2s', flexShrink: 0
                    }}
                  >
                    <div style={{ 
                      width: '32px', height: '32px', borderRadius: '50%', 
                      background: isSelected ? 'rgba(255,255,255,0.2)' : `${cat.color}22`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px'
                    }}>
                      <CategoryIcon name={cat.name} size={16} />
                    </div>
                    <span style={{ fontSize: '12px', fontWeight: isSelected ? '600' : '500', color: isSelected ? '#fff' : 'var(--text-secondary)' }}>
                      {cat.name}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Account Chips */}
          {(settings?.accounts?.length ?? 0) > 0 && (
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '12px' }}>Payment Method</label>
              <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '8px', scrollbarWidth: 'none', margin: '0 -4px', padding: '0 4px 8px 4px' }}>
                <button 
                  type="button"
                  onClick={() => setForm(f => ({ ...f, accountId: '' }))}
                  style={{
                    padding: '10px 16px', borderRadius: 'var(--r-full)', fontSize: '13px', fontWeight: '500', whiteSpace: 'nowrap',
                    background: form.accountId === '' ? 'var(--accent)' : 'var(--bg-elevated)',
                    border: `1px solid ${form.accountId === '' ? 'var(--accent)' : 'var(--border)'}`,
                    color: form.accountId === '' ? '#fff' : 'var(--text-secondary)', cursor: 'pointer', flexShrink: 0
                  }}
                >Cash / None</button>
                {settings?.accounts?.map(acc => (
                  <button 
                    key={acc.id} type="button"
                    onClick={() => setForm(f => ({ ...f, accountId: acc.id }))}
                    style={{
                      padding: '10px 16px', borderRadius: 'var(--r-full)', fontSize: '13px', fontWeight: '500', whiteSpace: 'nowrap',
                      background: form.accountId === acc.id ? 'var(--accent)' : 'var(--bg-elevated)',
                      border: `1px solid ${form.accountId === acc.id ? 'var(--accent)' : 'var(--border)'}`,
                      color: form.accountId === acc.id ? '#fff' : 'var(--text-secondary)',
                      display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', flexShrink: 0
                    }}
                  >
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: form.accountId === acc.id ? '#fff' : acc.color }}></span>
                    {acc.name} {acc.last4Digits ? `(..${acc.last4Digits})` : ''}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Note Input */}
          <div style={{ marginBottom: '32px' }}>
            <input 
              type="text" 
              value={form.note} 
              onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
              placeholder="What was this for?" 
              style={{ 
                width: '100%', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', 
                padding: '16px', fontSize: '15px', color: 'var(--text-primary)', outline: 'none'
              }} 
            />
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button 
              type="submit" 
              disabled={loading}
              style={{ 
                flex: 1, background: 'linear-gradient(135deg, var(--accent), #5B4FE0)', 
                color: '#fff', border: 'none', borderRadius: 'var(--r-full)', padding: '16px', 
                fontSize: '16px', fontWeight: '600', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px'
              }}
            >
              {loading ? <span className="spinner" style={{ width: '20px', height: '20px', borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff' }} /> : null}
              {editingId ? 'Update Expense' : 'Save Expense'}
            </button>
            {editingId && (
              <button 
                type="button" onClick={cancelEdit}
                style={{ 
                  background: 'var(--bg-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border)', 
                  borderRadius: 'var(--r-full)', padding: '16px 24px', fontSize: '16px', fontWeight: '600', cursor: 'pointer'
                }}
              >
                Cancel
              </button>
            )}
          </div>
        </form>

        {/* Budget hint */}
        {form.categoryId && settings && (() => {
          const cat = getCat(form.categoryId);
          if (!cat) return null;
          return (
            <div style={{
              marginTop: '24px', paddingTop: '16px', borderTop: '1px dashed var(--border)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              fontSize: '13px', color: 'var(--text-secondary)'
            }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><CategoryIcon name={cat.name} size={14} /> Budget for <strong style={{ color: 'var(--text-primary)', fontWeight: '600' }}>{cat.name}</strong></span>
              <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{formatINR(cat.monthlyBudget)}</span>
            </div>
          );
        })()}
      </div>

      {/* ── Recent Entries ── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
            Recent Entries
          </h2>
          <Link href="/expenses" style={{ fontSize: '14px', color: 'var(--accent)', textDecoration: 'none', fontWeight: '600' }}>
            View all
          </Link>
        </div>

        {recentExpenses.length === 0 ? (
          <div style={{ background: 'var(--bg-card)', borderRadius: '20px', padding: '32px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <FileText size={32} color="var(--text-muted)" strokeWidth={1.5} />
            <span style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)' }}>No expenses yet</span>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Add your first expense using the form above</span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {recentExpenses.map(exp => {
              const cat = getCat(exp.categoryId);
              return (
                <div key={exp._id} style={{ background: 'var(--bg-card)', borderRadius: '20px', padding: '16px', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{
                      width: '48px', height: '48px', borderRadius: '50%', flexShrink: 0,
                      background: cat?.color ? `${cat.color}22` : 'var(--bg-elevated)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', color: cat?.color || 'var(--text-primary)'
                    }}>
                      <CategoryIcon name={cat?.name ?? ''} size={24} />
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)' }}>
                        {cat?.name ?? 'Unknown'}
                      </div>
                      {exp.note ? (
                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {exp.note}
                        </div>
                      ) : null}
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '4px' }}>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{exp.date}</div>
                        {exp.accountId && settings?.accounts?.find(a => a.id === exp.accountId) && (
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', background: 'var(--bg-elevated)', padding: '2px 8px', borderRadius: 'var(--r-full)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: settings.accounts.find(a => a.id === exp.accountId)!.color }} />
                            {settings.accounts.find(a => a.id === exp.accountId)!.name}
                          </div>
                        )}
                      </div>
                    </div>

                    <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                      <span style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)' }}>
                        {formatINR(exp.amount)}
                      </span>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={() => handleEdit(exp)}
                          style={{ padding: '6px', borderRadius: '50%', background: 'var(--bg-elevated)', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
                        ><Edit2 size={16} /></button>
                        <button
                          onClick={() => handleDeleteClick(exp._id)}
                          style={{ padding: '6px', borderRadius: '50%', background: 'var(--danger)22', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}
                        ><Trash2 size={16} /></button>
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
        <div style={{
          position: 'fixed', bottom: '100px', left: '50%', transform: 'translateX(-50%)', zIndex: 50,
          background: toast.type === 'success' ? 'var(--success)' : 'var(--danger)',
          color: '#fff', padding: '12px 24px', borderRadius: 'var(--r-full)', fontSize: '14px', fontWeight: '600',
          boxShadow: 'var(--shadow-sm)', display: 'flex', alignItems: 'center', gap: '8px'
        }}>
          {toast.type === 'success' ? <CheckCircle2 size={18} /> : <XCircle size={18} />} {toast.msg}
        </div>
      )}

      <ConfirmModal
        isOpen={!!confirmDialog?.isOpen}
        message="Are you sure you want to delete this expense? This action cannot be undone."
        onConfirm={confirmDelete}
        onCancel={() => setConfirmDialog(null)}
      />

      {/* ── Review Suggestion Modal ── */}
      <dialog 
        ref={reviewDialogRef}
        style={{
          margin: 'auto auto 0 auto',
          width: '100%',
          maxWidth: '500px',
          border: 'none',
          borderRadius: '24px 24px 0 0',
          background: 'var(--bg-card)',
          padding: '24px',
          color: 'var(--text-primary)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: '700', margin: 0 }}>Review Suggestion</h2>
          <button 
            type="button"
            onClick={() => setReviewSuggestion(null)}
            style={{ background: 'var(--bg-elevated)', border: 'none', color: 'var(--text-secondary)', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'center' }}
          >
            <XCircle size={20} />
          </button>
        </div>

        <form onSubmit={submitReviewForm}>
          <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
            <div style={{ flex: 1 }}>
              <input type="number" step="0.01" 
                style={{ width: '100%', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', fontSize: '24px', fontWeight: '700', padding: '16px', color: 'var(--text-primary)', outline: 'none' }}
                placeholder="₹ 0.00" value={reviewForm.amount}
                onChange={e => setReviewForm(f => ({ ...f, amount: e.target.value }))} required autoFocus />
            </div>
            <div style={{ width: '140px' }}>
              <input type="date" 
                style={{ width: '100%', height: '100%', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '0 12px', color: 'var(--text-primary)', outline: 'none' }}
                value={reviewForm.date}
                onChange={e => setReviewForm(f => ({ ...f, date: e.target.value }))} required />
            </div>
          </div>
          
          <div style={{ marginBottom: '16px' }}>
            <select 
              style={{ width: '100%', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '16px', color: 'var(--text-primary)', fontSize: '15px', outline: 'none' }}
              value={reviewForm.categoryId}
              onChange={e => setReviewForm(f => ({ ...f, categoryId: e.target.value }))} required>
              {(settings?.categories ?? []).map(cat => (
                <option key={cat.id} value={cat.id}>{cat.emoji} {cat.name}</option>
              ))}
            </select>
          </div>

          {(settings?.accounts?.length ?? 0) > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <select 
                style={{ width: '100%', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '16px', color: 'var(--text-primary)', fontSize: '15px', outline: 'none' }}
                value={reviewForm.accountId}
                onChange={e => setReviewForm(f => ({ ...f, accountId: e.target.value }))}>
                <option value="">Cash / None</option>
                {settings?.accounts?.map(acc => (
                  <option key={acc.id} value={acc.id}>{acc.name} {acc.last4Digits ? `(..${acc.last4Digits})` : ''}</option>
                ))}
              </select>
            </div>
          )}

          <div style={{ marginBottom: '24px' }}>
            <input type="text" 
              style={{ width: '100%', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '16px', color: 'var(--text-primary)', fontSize: '15px', outline: 'none' }}
              placeholder="Note (optional)" value={reviewForm.note}
              onChange={e => setReviewForm(f => ({ ...f, note: e.target.value }))} />
          </div>

          <button type="submit" 
            style={{ width: '100%', background: 'linear-gradient(135deg, var(--accent), #5B4FE0)', color: '#fff', border: 'none', borderRadius: 'var(--r-full)', padding: '16px', fontSize: '16px', fontWeight: '600', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }} 
            disabled={loading}>
            {loading ? <span className="spinner" style={{ width: 16, height: 16, borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff' }} /> : 'Confirm & Add Expense'}
          </button>
        </form>
      </dialog>
    </div>
  );
}
