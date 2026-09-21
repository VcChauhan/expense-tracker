'use client';

import { useState } from 'react';
import { CreditCard, Settings, formatINR, Expense } from '@/lib/types';
import { CreditCard as CardIcon, Plus, Trash2, AlertCircle, Calendar, ShieldAlert, Check } from 'lucide-react';
import { lightTap, successBuzz } from '@/lib/haptics';

interface Props {
  settings: Settings;
  expenses?: Expense[];
  onUpdate?: (updatedSettings: Settings) => void;
}

const CARD_COLORS = [
  '#7c5cfc', // Purple
  '#3b82f6', // Blue
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#ec4899', // Pink
  '#1e293b', // Midnight
];

export function CreditCardTracker({ settings, expenses = [], onUpdate }: Props) {
  const [cards, setCards] = useState<CreditCard[]>(settings.creditCards || []);
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [last4, setLast4] = useState('');
  const [limit, setLimit] = useState('');
  const [billingDay, setBillingDay] = useState('15');
  const [paymentDueDays, setPaymentDueDays] = useState('20');
  const [color, setColor] = useState(CARD_COLORS[0]);

  const now = new Date();
  const currentDay = now.getDate();

  async function saveCards(newCards: CreditCard[]) {
    setLoading(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creditCards: newCards }),
      });
      if (res.ok) {
        const updated = await res.json();
        setCards(newCards);
        if (onUpdate) onUpdate(updated);
      }
    } catch (e) {
      console.error('Failed to update cards:', e);
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !limit || parseFloat(limit) <= 0) return;
    lightTap();

    const newCard: CreditCard = {
      id: 'cc_' + Date.now(),
      name: name.trim(),
      last4: last4.trim().slice(-4),
      limit: parseFloat(limit),
      billingDay: Math.min(31, Math.max(1, parseInt(billingDay) || 1)),
      paymentDueDays: parseInt(paymentDueDays) || 20,
      color,
    };

    const nextList = [...cards, newCard];
    await saveCards(nextList);
    successBuzz();
    setName('');
    setLast4('');
    setLimit('');
    setShowAddModal(false);
  }

  async function handleDelete(id: string) {
    lightTap();
    const nextList = cards.filter(c => c.id !== id);
    await saveCards(nextList);
  }

  // Calculate current billing cycle card spend
  function getCardSpend(card: CreditCard): number {
    const isSingleCard = cards.length === 1;
    const cardLast4 = (card.last4 || '').trim();
    const cardId = (card.id || '').trim();

    // Determine current billing cycle start & end
    const today = new Date();
    const curYear = today.getFullYear();
    const curMonth = today.getMonth(); // 0-indexed
    const curDate = today.getDate();

    let cycleStartYear = curYear;
    let cycleStartMonth = curMonth;
    let cycleEndYear = curYear;
    let cycleEndMonth = curMonth;

    if (curDate >= card.billingDay) {
      cycleStartMonth = curMonth;
      cycleEndMonth = curMonth + 1;
      if (cycleEndMonth > 11) {
        cycleEndMonth = 0;
        cycleEndYear += 1;
      }
    } else {
      cycleStartMonth = curMonth - 1;
      if (cycleStartMonth < 0) {
        cycleStartMonth = 11;
        cycleStartYear -= 1;
      }
      cycleEndMonth = curMonth;
    }

    const maxStartDay = new Date(cycleStartYear, cycleStartMonth + 1, 0).getDate();
    const startDay = Math.min(card.billingDay, maxStartDay);
    const startDateStr = `${cycleStartYear}-${String(cycleStartMonth + 1).padStart(2, '0')}-${String(startDay).padStart(2, '0')}`;

    const maxEndDay = new Date(cycleEndYear, cycleEndMonth + 1, 0).getDate();
    const endDay = Math.min(card.billingDay, maxEndDay);
    const endDateStr = `${cycleEndYear}-${String(cycleEndMonth + 1).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;

    const matchingExpenses = expenses.filter(e => {
      // Date filter: within cycle
      if (e.date) {
        if (e.date < startDateStr || e.date > endDateStr) return false;
      }

      const pm = (e.paymentMethod || '').toLowerCase();
      if (!pm.startsWith('credit_card')) return false;

      // Extract card identifier if present (e.g. credit_card:3249 or credit_card:xx3249)
      const parts = pm.split(':');
      const suffix = parts.length > 1 ? parts[1].replace(/^xx/i, '').trim() : '';

      if (suffix) {
        if (cardLast4 && suffix === cardLast4.toLowerCase()) return true;
        if (cardId && suffix === cardId.toLowerCase()) return true;
        return false;
      }

      // If generic credit_card (no suffix)
      if (cardLast4 && e.note && e.note.includes(cardLast4)) return true;
      if (isSingleCard) return true;

      return false;
    });

    return matchingExpenses.reduce((sum, e) => sum + e.amount, 0);
  }

  if (cards.length === 0 && !showAddModal) {
    return (
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 20, padding: '20px', marginBottom: 24,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 10, background: 'rgba(124, 92, 252, 0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)',
            }}>
              <CardIcon size={18} />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Credit Card Cycle Tracker</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Track billing dates & utilization across cards</div>
            </div>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            style={{
              padding: '6px 14px', borderRadius: 99, background: 'var(--accent)',
              color: '#fff', border: 'none', fontWeight: 700, fontSize: 12, cursor: 'pointer',
            }}
          >
            + Add Card
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <CardIcon size={18} color="var(--accent)" />
          <h3 style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.3px' }}>
            Credit Cards & Cycles
          </h3>
        </div>
        <button
          onClick={() => { lightTap(); setShowAddModal(true); }}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '6px 12px', borderRadius: 99, background: 'var(--bg-elevated)',
            border: '1px solid var(--border)', color: 'var(--text-primary)',
            fontSize: 12, fontWeight: 700, cursor: 'pointer',
          }}
        >
          <Plus size={13} /> Add Card
        </button>
      </div>

      <div style={{ display: 'flex', gap: 14, overflowX: 'auto', paddingBottom: 6, margin: '0 -16px', paddingLeft: 16, paddingRight: 16, scrollbarWidth: 'none' }}>
        {cards.map(card => {
          const spend = getCardSpend(card);
          const utilPct = card.limit > 0 ? (spend / card.limit) * 100 : 0;
          const isHighUtil = utilPct > 30;

          // Days to statement
          let daysToBill = card.billingDay - currentDay;
          if (daysToBill < 0) {
            const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
            daysToBill += daysInMonth;
          }

          return (
            <div
              key={card.id}
              style={{
                minWidth: 260, maxWidth: 300, flexShrink: 0,
                background: `linear-gradient(135deg, ${card.color} 0%, color-mix(in srgb, ${card.color} 80%, #000) 100%)`,
                borderRadius: 20, padding: '18px 20px', color: '#fff',
                boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                position: 'relative', overflow: 'hidden',
              }}
            >
              {/* Subtle background card decoration */}
              <div style={{
                position: 'absolute', right: -20, top: -20, width: 100, height: 100,
                borderRadius: '50%', background: 'rgba(255,255,255,0.08)', pointerEvents: 'none',
              }} />

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-0.3px' }}>{card.name}</div>
                    <div style={{ fontSize: 12, opacity: 0.85, fontWeight: 600 }}>
                      {card.last4 ? `•••• •••• •••• ${card.last4}` : 'Credit Card'}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(card.id)}
                    style={{ background: 'rgba(0,0,0,0.2)', border: 'none', color: '#fff', borderRadius: '50%', padding: 6, cursor: 'pointer' }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 11, textTransform: 'uppercase', opacity: 0.8, fontWeight: 700 }}>Cycle Spend</div>
                    <div style={{ fontSize: 20, fontWeight: 900 }}>{formatINR(spend)}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 11, opacity: 0.8 }}>Limit: {formatINR(card.limit)}</div>
                    <div style={{
                      fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 99,
                      background: isHighUtil ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.2)',
                      display: 'inline-block', marginTop: 2,
                    }}>
                      {utilPct.toFixed(0)}% Utilized
                    </div>
                  </div>
                </div>

                {/* Utilization bar */}
                <div style={{ height: 4, background: 'rgba(255,255,255,0.25)', borderRadius: 99, overflow: 'hidden', marginBottom: 12 }}>
                  <div style={{
                    height: '100%', width: `${Math.min(100, utilPct)}%`,
                    background: isHighUtil ? '#f87171' : '#fff',
                    borderRadius: 99,
                  }} />
                </div>
              </div>

              {/* Cycle Date info */}
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.2)', fontSize: 11, fontWeight: 600,
              }}>
                <span>Bill: {card.billingDay}th of month</span>
                <span style={{ background: 'rgba(255,255,255,0.2)', padding: '2px 8px', borderRadius: 99 }}>
                  {daysToBill === 0 ? '⚡ Bill today!' : `In ${daysToBill} days`}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Card Modal */}
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
              Add Credit Card
            </h3>

            <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                  CARD NAME
                </label>
                <input
                  type="text"
                  placeholder="e.g. HDFC Regalia, ICICI Amazon Pay"
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

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                    LAST 4 DIGITS
                  </label>
                  <input
                    type="text"
                    maxLength={4}
                    placeholder="e.g. 4821"
                    value={last4}
                    onChange={e => setLast4(e.target.value)}
                    style={{
                      width: '100%', padding: '12px 14px', borderRadius: 12,
                      background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                      color: 'var(--text-primary)', fontSize: 14, boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                    CREDIT LIMIT (₹)
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 250000"
                    value={limit}
                    onChange={e => setLimit(e.target.value)}
                    required
                    style={{
                      width: '100%', padding: '12px 14px', borderRadius: 12,
                      background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                      color: 'var(--text-primary)', fontSize: 14, boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                    BILLING DAY (1-31)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={billingDay}
                    onChange={e => setBillingDay(e.target.value)}
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
                    DUE IN (DAYS)
                  </label>
                  <input
                    type="number"
                    value={paymentDueDays}
                    onChange={e => setPaymentDueDays(e.target.value)}
                    required
                    style={{
                      width: '100%', padding: '12px 14px', borderRadius: 12,
                      background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                      color: 'var(--text-primary)', fontSize: 14, boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>

              {/* Color picker */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                  CARD THEME
                </label>
                <div style={{ display: 'flex', gap: 10 }}>
                  {CARD_COLORS.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      style={{
                        width: 32, height: 32, borderRadius: '50%', background: c,
                        border: color === c ? '3px solid #fff' : 'none',
                        outline: color === c ? '2px solid var(--accent)' : 'none',
                        cursor: 'pointer',
                      }}
                    />
                  ))}
                </div>
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
                  Save Card
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
