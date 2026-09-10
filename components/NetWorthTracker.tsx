'use client';

import { useState } from 'react';
import { NetWorthEntry, Settings, formatINR } from '@/lib/types';
import { Landmark, TrendingUp, TrendingDown, Plus, Trash2, ShieldCheck, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { lightTap, successBuzz } from '@/lib/haptics';

interface Props {
  settings: Settings;
  onUpdate?: (updatedSettings: Settings) => void;
}

const PRESET_CATEGORIES = [
  'Savings Bank',
  'Fixed Deposits',
  'Mutual Funds',
  'Stocks & Equity',
  'EPF / PPF',
  'Gold & Precious Metals',
  'Real Estate',
  'Credit Card Due',
  'Personal / Home Loan',
  'Other',
];

export function NetWorthTracker({ settings, onUpdate }: Props) {
  const [entries, setEntries] = useState<NetWorthEntry[]>(settings.netWorthEntries || []);
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [type, setType] = useState<'asset' | 'liability'>('asset');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState(PRESET_CATEGORIES[0]);

  const totalAssets = entries.filter(e => e.type === 'asset').reduce((s, e) => s + e.amount, 0);
  const totalLiabilities = entries.filter(e => e.type === 'liability').reduce((s, e) => s + e.amount, 0);
  const netWorth = totalAssets - totalLiabilities;
  const debtToAssetRatio = totalAssets > 0 ? (totalLiabilities / totalAssets) * 100 : 0;

  async function saveEntries(newEntries: NetWorthEntry[]) {
    setLoading(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ netWorthEntries: newEntries }),
      });
      if (res.ok) {
        const updated = await res.json();
        setEntries(newEntries);
        if (onUpdate) onUpdate(updated);
      }
    } catch (e) {
      console.error('Failed to update net worth entries:', e);
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !amount || parseFloat(amount) <= 0) return;
    lightTap();

    const newEntry: NetWorthEntry = {
      id: 'nw_' + Date.now(),
      name: name.trim(),
      type,
      amount: parseFloat(amount),
      category,
      lastUpdated: new Date().toISOString().split('T')[0],
    };

    const nextList = [...entries, newEntry];
    await saveEntries(nextList);
    successBuzz();
    setName('');
    setAmount('');
    setShowAddModal(false);
  }

  async function handleDelete(id: string) {
    lightTap();
    const nextList = entries.filter(e => e.id !== id);
    await saveEntries(nextList);
  }

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 24,
      padding: '24px 20px',
      marginBottom: 24,
      boxShadow: 'var(--shadow-sm)',
    }}>
      {/* Hero Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
              Total Net Worth
            </span>
            <ShieldCheck size={16} color="var(--success)" />
          </div>
          <h2 style={{
            fontSize: 32, fontWeight: 900, margin: '4px 0 0 0',
            color: netWorth >= 0 ? 'var(--text-primary)' : 'var(--danger)',
            letterSpacing: '-1px',
          }}>
            {formatINR(netWorth)}
          </h2>
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
          <Plus size={15} /> Add Asset
        </button>
      </div>

      {/* Assets vs Liabilities Quick Tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
        <div style={{
          background: 'var(--bg-elevated)', borderRadius: 16, padding: '14px',
          border: '1px solid rgba(74, 222, 128, 0.2)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--success)', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
            <ArrowUpRight size={14} /> Total Assets
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>
            {formatINR(totalAssets)}
          </div>
        </div>

        <div style={{
          background: 'var(--bg-elevated)', borderRadius: 16, padding: '14px',
          border: '1px solid rgba(248, 113, 113, 0.2)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--danger)', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
            <ArrowDownRight size={14} /> Total Liabilities
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>
            {formatINR(totalLiabilities)}
          </div>
        </div>
      </div>

      {/* Ratio Bar */}
      {totalAssets > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>
            <span>Debt-to-Asset Ratio</span>
            <span style={{ color: debtToAssetRatio > 40 ? 'var(--warning)' : 'var(--success)', fontWeight: 700 }}>
              {debtToAssetRatio.toFixed(1)}% {debtToAssetRatio <= 30 ? '(Healthy)' : ''}
            </span>
          </div>
          <div style={{ height: 6, background: 'var(--bg-elevated)', borderRadius: 99, overflow: 'hidden', display: 'flex' }}>
            <div style={{
              width: `${Math.max(0, 100 - debtToAssetRatio)}%`,
              background: 'var(--success)',
              borderRadius: '99px 0 0 99px',
            }} />
            <div style={{
              width: `${Math.min(100, debtToAssetRatio)}%`,
              background: 'var(--danger)',
              borderRadius: '0 99px 99px 0',
            }} />
          </div>
        </div>
      )}

      {/* Entries List */}
      {entries.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '20px 16px',
          background: 'var(--bg-elevated)', borderRadius: 16,
          color: 'var(--text-muted)', fontSize: 13,
        }}>
          Track your complete financial standing. Add bank balances, investments, gold, and loans.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {entries.map(entry => {
            const isAsset = entry.type === 'asset';
            return (
              <div
                key={entry.id}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: 'var(--bg-elevated)', borderRadius: 14, padding: '12px 14px',
                  border: '1px solid var(--border)',
                }}
              >
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                    {entry.name}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                    <span>{entry.category}</span>
                    <span>•</span>
                    <span style={{ color: isAsset ? 'var(--success)' : 'var(--danger)', fontWeight: 600 }}>
                      {isAsset ? 'Asset' : 'Liability'}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{
                    fontSize: 15, fontWeight: 800,
                    color: isAsset ? 'var(--text-primary)' : 'var(--danger)',
                  }}>
                    {isAsset ? '+' : '-'}{formatINR(entry.amount)}
                  </span>
                  <button
                    onClick={() => handleDelete(entry.id)}
                    style={{
                      background: 'none', border: 'none', color: 'var(--text-muted)',
                      cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center',
                    }}
                  >
                    <Trash2 size={14} />
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
              Add Net Worth Entry
            </h3>

            <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Type Switcher */}
              <div style={{ display: 'flex', background: 'var(--bg-elevated)', borderRadius: 12, padding: 4, gap: 4 }}>
                <button
                  type="button"
                  onClick={() => setType('asset')}
                  style={{
                    flex: 1, padding: '8px', borderRadius: 8, border: 'none',
                    background: type === 'asset' ? 'var(--success-dim)' : 'transparent',
                    color: type === 'asset' ? 'var(--success)' : 'var(--text-muted)',
                    fontWeight: 700, fontSize: 13, cursor: 'pointer',
                  }}
                >
                  + Asset
                </button>
                <button
                  type="button"
                  onClick={() => setType('liability')}
                  style={{
                    flex: 1, padding: '8px', borderRadius: 8, border: 'none',
                    background: type === 'liability' ? 'var(--danger-dim)' : 'transparent',
                    color: type === 'liability' ? 'var(--danger)' : 'var(--text-muted)',
                    fontWeight: 700, fontSize: 13, cursor: 'pointer',
                  }}
                >
                  - Liability (Debt)
                </button>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                  ACCOUNT / ASSET NAME
                </label>
                <input
                  type="text"
                  placeholder="e.g. HDFC Salary, Zerodha MF, Car Loan"
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
                  placeholder="e.g. 150000"
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
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  style={{
                    width: '100%', padding: '12px 14px', borderRadius: 12,
                    background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                    color: 'var(--text-primary)', fontSize: 14, boxSizing: 'border-box',
                  }}
                >
                  {PRESET_CATEGORIES.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
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
                  Save Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
