'use client';

import { useState } from 'react';
import { RecurringExpense, Settings, Category, formatINR } from '@/lib/types';
import { CategoryIcon } from './CategoryIcon';
import { Repeat, Plus, Trash2, Check, Calendar, AlertCircle, Sparkles } from 'lucide-react';
import { lightTap, successBuzz } from '@/lib/haptics';

interface Props {
  settings: Settings;
  onUpdate: (updatedSettings: Settings) => void;
}

export function RecurringExpenseManager({ settings, onUpdate }: Props) {
  const [items, setItems] = useState<RecurringExpense[]>(settings.recurringExpenses || []);
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState(settings.categories?.[0]?.id || '');
  const [dayOfMonth, setDayOfMonth] = useState('1');

  const now = new Date();
  const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  function triggerToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  async function saveRecurring(newItems: RecurringExpense[]) {
    setLoading(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recurringExpenses: newItems }),
      });
      if (res.ok) {
        const updated = await res.json();
        setItems(newItems);
        onUpdate(updated);
      }
    } catch (e) {
      console.error('Failed to update recurring expenses:', e);
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !amount || parseFloat(amount) <= 0) return;
    lightTap();

    const newItem: RecurringExpense = {
      id: 'rec_' + Date.now(),
      name: name.trim(),
      amount: parseFloat(amount),
      categoryId: categoryId || settings.categories[0]?.id,
      dayOfMonth: Math.min(31, Math.max(1, parseInt(dayOfMonth) || 1)),
      isActive: true,
    };

    const nextList = [...items, newItem];
    await saveRecurring(nextList);
    successBuzz();
    triggerToast('Added recurring expense');
    setName('');
    setAmount('');
    setShowAddModal(false);
  }

  async function handleDelete(id: string) {
    lightTap();
    const nextList = items.filter(it => it.id !== id);
    await saveRecurring(nextList);
    triggerToast('Deleted recurring expense');
  }

  async function handleToggle(id: string) {
    lightTap();
    const nextList = items.map(it => it.id === id ? { ...it, isActive: !it.isActive } : it);
    await saveRecurring(nextList);
  }

  async function handleLogExpense(item: RecurringExpense) {
    lightTap();
    setLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: today,
          categoryId: item.categoryId,
          amount: item.amount,
          note: `${item.name} (Recurring)`,
          tags: ['recurring', 'subscription'],
          paymentMethod: 'upi',
        }),
      });

      if (res.ok) {
        successBuzz();
        const nextList = items.map(it => it.id === item.id ? { ...it, lastLoggedMonth: currentYearMonth } : it);
        await saveRecurring(nextList);
        triggerToast(`Logged ${item.name} for this month!`);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const activeTotal = items.filter(i => i.isActive).reduce((s, i) => s + i.amount, 0);

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 20,
      padding: '20px',
      marginBottom: 24,
      boxShadow: 'var(--shadow-sm)',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12,
            background: 'rgba(124, 92, 252, 0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--accent)',
          }}>
            <Repeat size={20} />
          </div>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.3px' }}>
              Recurring Expenses
            </h3>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
              Fixed monthly: <strong style={{ color: 'var(--accent-2)' }}>{formatINR(activeTotal)}</strong>/month
            </div>
          </div>
        </div>

        <button
          onClick={() => { lightTap(); setShowAddModal(true); }}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 14px', borderRadius: 99,
            background: 'var(--accent)', color: '#fff',
            border: 'none', fontWeight: 700, fontSize: 13,
            cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
            boxShadow: '0 2px 10px rgba(124, 92, 252, 0.3)',
          }}
        >
          <Plus size={15} /> Add
        </button>
      </div>

      {toast && (
        <div style={{
          background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)',
          borderRadius: 12, padding: '8px 14px', fontSize: 12, fontWeight: 600,
          color: 'var(--accent-2)', marginBottom: 12, animation: 'fadeIn 0.2s ease',
        }}>
          {toast}
        </div>
      )}

      {/* List */}
      {items.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '24px 16px',
          background: 'var(--bg-elevated)', borderRadius: 16,
          color: 'var(--text-muted)', fontSize: 13,
        }}>
          No recurring expenses configured yet. Add Rent, WiFi, Netflix, SIP, or utilities!
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {items.map(item => {
            const cat = settings.categories.find(c => c.id === item.categoryId);
            const isLoggedThisMonth = item.lastLoggedMonth === currentYearMonth;

            return (
              <div
                key={item.id}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border)',
                  borderRadius: 16, padding: '12px 14px',
                  opacity: item.isActive ? 1 : 0.6,
                  transition: 'all 0.2s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: cat?.color ? `${cat.color}20` : 'var(--bg-card)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <CategoryIcon name={cat?.name || ''} color={cat?.color || 'var(--accent)'} size={18} inList={true} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{
                      fontSize: 14, fontWeight: 700, color: 'var(--text-primary)',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {item.name}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                      <span>Day {item.dayOfMonth} of month</span>
                      <span>•</span>
                      <span>{cat?.name || 'General'}</span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>
                      {formatINR(item.amount)}
                    </div>
                    {isLoggedThisMonth ? (
                      <span style={{ fontSize: 11, color: 'var(--success)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 3, justifyContent: 'flex-end' }}>
                        <Check size={11} /> Logged
                      </span>
                    ) : item.isActive ? (
                      <button
                        onClick={() => handleLogExpense(item)}
                        disabled={loading}
                        style={{
                          background: 'none', border: 'none', padding: 0,
                          fontSize: 11, color: 'var(--accent-2)', fontWeight: 700,
                          cursor: 'pointer', textDecoration: 'underline',
                        }}
                      >
                        Log Now
                      </button>
                    ) : (
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Paused</span>
                    )}
                  </div>

                  {/* Toggle active switch */}
                  <button
                    onClick={() => handleToggle(item.id)}
                    style={{
                      width: 38, height: 22, borderRadius: 99,
                      background: item.isActive ? 'var(--accent)' : 'var(--border-strong)',
                      border: 'none', cursor: 'pointer', position: 'relative',
                      padding: 2, transition: 'background 0.2s ease',
                    }}
                    title={item.isActive ? 'Pause' : 'Activate'}
                  >
                    <div style={{
                      width: 18, height: 18, borderRadius: '50%', background: '#fff',
                      transform: item.isActive ? 'translateX(16px)' : 'translateX(0px)',
                      transition: 'transform 0.2s ease',
                    }} />
                  </button>

                  {/* Delete button */}
                  <button
                    onClick={() => handleDelete(item.id)}
                    style={{
                      background: 'none', border: 'none', color: 'var(--text-muted)',
                      cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center',
                    }}
                    title="Delete"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 16,
        }}>
          <div style={{
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 24, padding: 24, width: '100%', maxWidth: 400,
            boxShadow: 'var(--shadow-lg)',
          }}>
            <h3 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 16px 0', color: 'var(--text-primary)' }}>
              Add Recurring Expense
            </h3>

            <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                  NAME
                </label>
                <input
                  type="text"
                  placeholder="e.g., Netflix, House Rent, Gym"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                  style={{
                    width: '100%', padding: '12px 14px', borderRadius: 12,
                    background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                    color: 'var(--text-primary)', fontSize: 14, boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                  AMOUNT (₹)
                </label>
                <input
                  type="number"
                  placeholder="e.g., 649"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  required
                  style={{
                    width: '100%', padding: '12px 14px', borderRadius: 12,
                    background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                    color: 'var(--text-primary)', fontSize: 14, boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                  CATEGORY
                </label>
                <select
                  value={categoryId}
                  onChange={e => setCategoryId(e.target.value)}
                  style={{
                    width: '100%', padding: '12px 14px', borderRadius: 12,
                    background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                    color: 'var(--text-primary)', fontSize: 14, boxSizing: 'border-box',
                  }}
                >
                  {(settings.categories || []).map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                  DAY OF MONTH (1 - 31)
                </label>
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={dayOfMonth}
                  onChange={e => setDayOfMonth(e.target.value)}
                  required
                  style={{
                    width: '100%', padding: '12px 14px', borderRadius: 12,
                    background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                    color: 'var(--text-primary)', fontSize: 14, boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  style={{
                    flex: 1, padding: '12px', borderRadius: 12,
                    border: '1px solid var(--border)', background: 'var(--bg-elevated)',
                    color: 'var(--text-primary)', fontWeight: 700, fontSize: 14, cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    flex: 1, padding: '12px', borderRadius: 12,
                    border: 'none', background: 'var(--accent)',
                    color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer',
                    boxShadow: '0 2px 10px rgba(124, 92, 252, 0.4)',
                  }}
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
