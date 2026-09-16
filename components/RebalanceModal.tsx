'use client';

import { useMemo } from 'react';
import { Category, formatINR } from '@/lib/types';
import { RefreshCcw, Check, X, ArrowRight } from 'lucide-react';
import { CategoryIcon } from './CategoryIcon';

interface RebalanceModalProps {
  categories: Category[];
  activeTotalsMap: Record<string, number>;
  onClose: () => void;
  onApprove: (updatedCategories: Category[]) => void;
}

export function RebalanceModal({ categories, activeTotalsMap, onClose, onApprove }: RebalanceModalProps) {
  const proposal = useMemo(() => {
    const updated = categories.map(c => ({ ...c }));
    const overbudget: { index: number; cat: Category; overage: number }[] = [];
    const underbudget: { index: number; cat: Category; surplus: number }[] = [];

    updated.forEach((c, idx) => {
      const spent = activeTotalsMap[c.id] ?? 0;
      if (c.monthlyBudget > 0 && spent > c.monthlyBudget) {
        overbudget.push({ index: idx, cat: c, overage: spent - c.monthlyBudget });
      } else if (c.monthlyBudget > 0 && spent < c.monthlyBudget * 0.8) {
        underbudget.push({ index: idx, cat: c, surplus: c.monthlyBudget - spent });
      }
    });

    let totalNeeded = overbudget.reduce((sum, o) => sum + o.overage, 0);

    for (const item of overbudget) {
      updated[item.index].monthlyBudget += item.overage;
    }

    for (const item of underbudget) {
      if (totalNeeded <= 0) break;
      const reduction = Math.min(totalNeeded, item.surplus * 0.5);
      updated[item.index].monthlyBudget = Math.max(0, Math.round(updated[item.index].monthlyBudget - reduction));
      totalNeeded -= reduction;
    }

    const changes = updated.filter((c, idx) => c.monthlyBudget !== categories[idx].monthlyBudget).map((c, idx) => ({
      name: c.name,
      color: c.color,
      oldBudget: categories.find(orig => orig.id === c.id)?.monthlyBudget ?? 0,
      newBudget: c.monthlyBudget,
      delta: c.monthlyBudget - (categories.find(orig => orig.id === c.id)?.monthlyBudget ?? 0),
    }));

    return { updated, changes };
  }, [categories, activeTotalsMap]);

  return (
    <>
      <div 
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999, backdropFilter: 'blur(4px)', animation: 'fadeIn 0.2s ease-out' }} 
      />
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        background: 'var(--bg-card)',
        borderRadius: '24px 24px 0 0',
        padding: 24,
        zIndex: 10000,
        maxWidth: 550,
        margin: '0 auto',
        boxShadow: '0 -10px 40px rgba(0,0,0,0.3)',
        borderTop: '1px solid var(--border)',
        animation: 'slide-up-fast 0.3s var(--ease) both',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, position: 'relative' }}>
          <div style={{
            position: 'absolute', top: -24, left: -24, right: -24, height: 74,
            background: 'linear-gradient(135deg, color-mix(in srgb, var(--accent) 12%, transparent) 0%, transparent 75%)',
            pointerEvents: 'none',
          }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, position: 'relative' }}>
            <div style={{
              width: 38, height: 38, borderRadius: 12, flexShrink: 0,
              background: 'var(--accent-grad)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
              boxShadow: '0 6px 16px -4px color-mix(in srgb, var(--accent) 55%, transparent)',
            }}>
              <RefreshCcw size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>Approve Budget Rebalance</h3>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>Review proposed budget changes</p>
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-muted)',
            cursor: 'pointer', width: 32, height: 32, borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, position: 'relative',
          }}>
            <X size={16} />
          </button>
        </div>

        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.4 }}>
          The local AI calculated the following adjustments to cover over-budget categories using surplus capacity:
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24, maxHeight: 250, overflowY: 'auto' }}>
          {proposal.changes.map((c, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px',
                background: 'var(--bg-elevated)', borderRadius: 14, border: '1px solid var(--border)',
                animation: `fade-in-up 0.3s var(--ease) ${idx * 0.05}s both`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 10, flexShrink: 0,
                  background: `${c.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: c.color,
                }}>
                  <CategoryIcon name={c.name} color={c.color} size={16} />
                </div>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{c.name}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{formatINR(c.oldBudget)}</span>
                <ArrowRight size={14} color="var(--text-muted)" />
                <span style={{
                  fontSize: 13, fontWeight: 800, padding: '3px 9px', borderRadius: 99,
                  color: c.delta > 0 ? 'var(--success)' : 'var(--warning)',
                  background: c.delta > 0 ? 'var(--success-dim)' : 'var(--warning-dim)',
                }}>
                  {formatINR(c.newBudget)}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <button 
            onClick={onClose} 
            style={{ flex: 1, padding: 14, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-primary)', fontWeight: 600, fontSize: 15, cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button 
            onClick={() => onApprove(proposal.updated)} 
            style={{
              flex: 1, padding: 14, borderRadius: 12, border: 'none',
              background: 'var(--accent-grad)', color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              boxShadow: '0 8px 20px -8px color-mix(in srgb, var(--accent) 60%, transparent)',
            }}
          >
            <Check size={18} /> Approve & Update
          </button>
        </div>
      </div>
    </>
  );
}
