'use client';

import { useState, useMemo } from 'react';
import { formatINR, Category, SavingsGoal } from '@/lib/types';
import { ShoppingBag, CheckCircle2, AlertTriangle, XCircle, Calculator, TrendingUp, Sparkles } from 'lucide-react';
import { CategoryIcon } from './CategoryIcon';
import { calculateOpportunityCost } from '@/lib/onDeviceAi';

interface AffordabilityCheckerProps {
  monthlySalary: number;
  monthlySpent: number;
  monthlyBudget: number;
  categories: Category[];
  activeTotalsMap: Record<string, number>;
}

export function AffordabilityChecker({
  monthlySalary,
  monthlySpent,
  monthlyBudget,
  categories,
  activeTotalsMap,
}: AffordabilityCheckerProps) {
  const [amountStr, setAmountStr] = useState('');
  const [selectedCatId, setSelectedCatId] = useState('');
  const [focused, setFocused] = useState(false);

  const purchaseAmount = parseFloat(amountStr) || 0;
  const selectedCat = categories.find(c => c.id === selectedCatId);
  const accentColor = selectedCat?.color ?? 'var(--accent)';

  const analysis = useMemo(() => {
    if (purchaseAmount <= 0) return null;

    const remainingBudget = Math.max(0, monthlyBudget - monthlySpent);
    const surplusBefore = monthlySalary - monthlySpent;
    const surplusAfter = surplusBefore - purchaseAmount;

    let targetCatName = '';
    let catRemaining = 0;
    let catWillExceed = false;
    let catOverage = 0;

    if (selectedCatId) {
      const cat = categories.find(c => c.id === selectedCatId);
      if (cat) {
        targetCatName = cat.name;
        const catSpent = activeTotalsMap[cat.id] ?? 0;
        catRemaining = cat.monthlyBudget - catSpent;
        if (purchaseAmount > catRemaining && cat.monthlyBudget > 0) {
          catWillExceed = true;
          catOverage = Math.round(purchaseAmount - catRemaining);
        }
      }
    }

    let status: 'safe' | 'warning' | 'danger' = 'safe';
    let title = '';
    let message = '';

    if (monthlySalary > 0 && surplusAfter < 0) {
      status = 'danger';
      title = 'Unsafe Purchase';
      message = `This ₹${purchaseAmount} purchase will put you ${formatINR(Math.abs(surplusAfter))} over your monthly income!`;
    } else if (catWillExceed) {
      status = 'warning';
      title = 'Category Overage Warning';
      message = `You have the cash, but this will push ${targetCatName} budget ₹${catOverage} over limit.`;
    } else if (purchaseAmount > remainingBudget && monthlyBudget > 0) {
      status = 'warning';
      title = 'Budget Stretch';
      message = `Affordable from income, but uses more than your remaining monthly budget (${formatINR(remainingBudget)} left).`;
    } else {
      status = 'safe';
      title = 'Safe Purchase!';
      message = `You can comfortably afford this! You'll still have ${formatINR(surplusAfter)} surplus at month end.`;
    }

    // How much of income-after-spend this single purchase would consume —
    // drives the little context bar under the result.
    const referenceBase = Math.max(monthlySalary - monthlySpent, purchaseAmount, 1);
    const impactPct = Math.min(100, (purchaseAmount / referenceBase) * 100);

    return { status, title, message, surplusAfter, remainingBudget, catWillExceed, targetCatName, impactPct };
  }, [purchaseAmount, monthlySalary, monthlySpent, monthlyBudget, selectedCatId, categories, activeTotalsMap]);

  const statusColor = analysis?.status === 'safe' ? 'var(--success)' : analysis?.status === 'warning' ? 'var(--warning)' : 'var(--danger)';

  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 20, padding: 24, marginBottom: 24,
      animation: 'fade-in-up 0.4s var(--ease) both', position: 'relative', overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', top: -50, right: -50, width: 140, height: 140,
        background: `radial-gradient(circle, ${accentColor}20 0%, transparent 70%)`,
        pointerEvents: 'none', transition: 'background 0.3s ease',
      }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, position: 'relative' }}>
        <div style={{
          width: 38, height: 38, borderRadius: 12, flexShrink: 0,
          background: `linear-gradient(135deg, ${accentColor} 0%, var(--accent-2) 100%)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
          boxShadow: `0 6px 16px -4px ${accentColor}66`,
          transition: 'background 0.3s ease, box-shadow 0.3s ease',
        }}>
          <Calculator size={18} />
        </div>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>"Can I Afford This?" Analyzer</h3>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>Check budget impact before buying</p>
        </div>
      </div>

      <div style={{ marginBottom: 14, position: 'relative' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'var(--bg)', borderRadius: 14, padding: '2px 14px',
          border: `1.5px solid ${focused ? accentColor : 'var(--border)'}`,
          boxShadow: focused ? `0 6px 18px -8px ${accentColor}66` : 'none',
          transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
        }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: focused ? accentColor : 'var(--text-muted)', transition: 'color 0.2s' }}>₹</span>
          <input
            type="number"
            placeholder="Amount (e.g. 15000)"
            value={amountStr}
            onChange={e => setAmountStr(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            style={{
              flex: 1, width: '100%', padding: '12px 0', border: 'none', outline: 'none',
              background: 'transparent', color: 'var(--text-primary)', fontSize: 17, fontWeight: 700,
            }}
          />
        </div>
      </div>

      <div style={{ marginBottom: 16, position: 'relative' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
          Category (optional)
        </div>
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 2 }}>
          <button
            type="button"
            onClick={() => setSelectedCatId('')}
            style={{
              flexShrink: 0, padding: '8px 14px', borderRadius: 99, fontSize: 12.5, fontWeight: 700,
              background: selectedCatId === '' ? 'var(--accent-dim)' : 'var(--bg-elevated)',
              border: `1.5px solid ${selectedCatId === '' ? 'var(--border-glow)' : 'var(--border)'}`,
              color: selectedCatId === '' ? 'var(--accent-2)' : 'var(--text-secondary)',
              cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s ease',
            }}
          >
            Any
          </button>
          {categories.map(cat => {
            const isSelected = selectedCatId === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCatId(cat.id)}
                style={{
                  flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6,
                  padding: isSelected ? '8px 14px 8px 8px' : '8px 14px', borderRadius: 99, fontSize: 12.5, fontWeight: 700,
                  background: isSelected ? cat.color : 'var(--bg-elevated)',
                  border: `1.5px solid ${isSelected ? cat.color : 'var(--border)'}`,
                  color: isSelected ? '#fff' : 'var(--text-secondary)',
                  cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s ease',
                  transform: isSelected ? 'scale(1.03)' : 'scale(1)',
                }}
              >
                {isSelected && (
                  <span style={{ width: 18, height: 18, borderRadius: '50%', background: 'rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <CategoryIcon name={cat.name} size={10} color="#fff" />
                  </span>
                )}
                {cat.name}
              </button>
            );
          })}
        </div>
      </div>

      {analysis && (
        <div style={{
          padding: 16,
          borderRadius: 14,
          background: `color-mix(in srgb, ${statusColor} 10%, transparent)`,
          border: `1px solid ${statusColor}`,
          animation: 'fade-in-up 0.3s var(--ease) both',
        }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div style={{
              width: 32, height: 32, borderRadius: 10, flexShrink: 0,
              background: `color-mix(in srgb, ${statusColor} 20%, transparent)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: statusColor,
            }}>
              {analysis.status === 'safe' ? <CheckCircle2 size={18} /> : analysis.status === 'warning' ? <AlertTriangle size={18} /> : <XCircle size={18} />}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>{analysis.title}</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.4 }}>{analysis.message}</div>
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <div style={{ height: 6, background: 'var(--bg-card)', borderRadius: 99, overflow: 'hidden' }}>
              <div style={{
                height: '100%', width: `${analysis.impactPct}%`, background: statusColor, borderRadius: 99,
                transition: 'width 0.7s var(--ease)',
              }} />
            </div>
            <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 5 }}>
              {analysis.impactPct.toFixed(0)}% of what you have left this month
            </div>
          </div>

          {/* 🔮 Opportunity Cost & Compounding Perspective */}
          {(() => {
            const opp = calculateOpportunityCost(purchaseAmount, 13);
            return (
              <div style={{
                marginTop: 14,
                padding: '10px 12px',
                borderRadius: 12,
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--accent-2)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Sparkles size={12} /> Wealth Opportunity Cost (13% CAGR)
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--success)' }}>
                    ₹{opp.years5.toLocaleString('en-IN')} in 5Y
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, textAlign: 'center', marginTop: 2 }}>
                  <div style={{ background: 'var(--bg-elevated)', padding: '6px 4px', borderRadius: 8 }}>
                    <div style={{ fontSize: 9.5, color: 'var(--text-muted)', fontWeight: 600 }}>3 Years</div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-primary)' }}>₹{opp.years3.toLocaleString('en-IN')}</div>
                  </div>
                  <div style={{ background: 'var(--bg-elevated)', padding: '6px 4px', borderRadius: 8 }}>
                    <div style={{ fontSize: 9.5, color: 'var(--text-muted)', fontWeight: 600 }}>5 Years</div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--success)' }}>₹{opp.years5.toLocaleString('en-IN')}</div>
                  </div>
                  <div style={{ background: 'var(--bg-elevated)', padding: '6px 4px', borderRadius: 8 }}>
                    <div style={{ fontSize: 9.5, color: 'var(--text-muted)', fontWeight: 600 }}>10 Years</div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--accent-2)' }}>₹{opp.years10.toLocaleString('en-IN')}</div>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
