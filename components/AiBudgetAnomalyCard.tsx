'use client';

import { useState, useEffect, useMemo } from 'react';
import { Sparkles, ShieldCheck, Cpu, ChevronDown, ChevronUp, AlertCircle, CheckCircle, Edit3, X, Info } from 'lucide-react';
import { Expense, Category, formatINR, Settings } from '@/lib/types';
import { runOnDeviceAnomalyAudit, BudgetNormalizationResult, ONE_OFF_TYPES } from '@/lib/onDeviceAi';

interface AiBudgetAnomalyCardProps {
  expenses: Expense[];
  categories: Category[];
  selectedMonth: number; // 0-indexed
  selectedYear: number;
  monthName: string;
  settings: Settings | null;
  onSettingsUpdate?: (updated: Settings) => void;
}

export function AiBudgetAnomalyCard({
  expenses,
  categories,
  selectedMonth,
  selectedYear,
  monthName,
  settings,
  onSettingsUpdate,
}: AiBudgetAnomalyCardProps) {
  const [auditResult, setAuditResult] = useState<BudgetNormalizationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAnomaliesList, setShowAnomaliesList] = useState(false);
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [noteInput, setNoteInput] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  const monthKey = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;
  const currentMonthNote = useMemo(() => {
    return settings?.monthNotes?.find(mn => mn.month === monthKey)?.note || '';
  }, [settings?.monthNotes, monthKey]);

  useEffect(() => {
    setNoteInput(currentMonthNote);
  }, [currentMonthNote]);

  // Run On-Device AI analysis when expenses, categories, or monthNote change
  useEffect(() => {
    let active = true;
    setLoading(true);

    runOnDeviceAnomalyAudit(expenses, categories, currentMonthNote, `${monthName} ${selectedYear}`)
      .then(res => {
        if (active) {
          setAuditResult(res);
          setLoading(false);
        }
      })
      .catch(err => {
        console.error('On-device anomaly audit error:', err);
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [expenses, categories, currentMonthNote, monthName, selectedYear]);

  async function handleSaveMonthNote() {
    setSavingNote(true);
    try {
      const existingNotes = settings?.monthNotes || [];
      const updatedNotes = existingNotes.filter(n => n.month !== monthKey);
      if (noteInput.trim()) {
        updatedNotes.push({ month: monthKey, note: noteInput.trim() });
      }

      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ monthNotes: updatedNotes }),
      });

      if (res.ok) {
        const updatedSettings = await res.json();
        onSettingsUpdate?.(updatedSettings);
        setIsEditingNote(false);
      }
    } catch (err) {
      console.error('Failed to save month note:', err);
    } finally {
      setSavingNote(false);
    }
  }

  if (loading && !auditResult) {
    return (
      <div style={{
        background: 'var(--bg-card)',
        borderRadius: 24,
        padding: 20,
        border: '1px solid var(--border)',
        marginBottom: 20,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}>
        <div className="spinner" style={{ width: 20, height: 20, borderColor: 'var(--border)', borderTopColor: 'var(--accent)' }} />
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Running on-device AI budget reconciliation...</span>
      </div>
    );
  }

  if (!auditResult) return null;

  const hasAnomalies = auditResult.anomalies.length > 0;
  const isReassuring = auditResult.healthStatus === 'reassuring';
  const overCats = auditResult.overBudgetBeforeNormalization;

  return (
    <div style={{
      background: 'var(--bg-card)',
      borderRadius: 24,
      border: '1px solid var(--border-glow)',
      padding: '22px 20px',
      marginBottom: 20,
      boxShadow: 'var(--shadow-glow)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Background radial accent glow */}
      <div style={{
        position: 'absolute',
        top: -40,
        right: -40,
        width: 140,
        height: 140,
        background: isReassuring
          ? 'radial-gradient(circle, rgba(16,185,129,0.15) 0%, transparent 70%)'
          : 'radial-gradient(circle, color-mix(in srgb, var(--accent) 18%, transparent) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* Header bar: Engine badge & Privacy indicator */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 32,
            height: 32,
            borderRadius: 10,
            background: 'var(--accent-dim)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--accent-2)',
          }}>
            <Sparkles size={16} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>AI Budget Normalization</span>
              {auditResult.hasGeminiNano ? (
                <span style={{
                  fontSize: 10, fontWeight: 800,
                  padding: '2px 7px', borderRadius: 99,
                  background: 'rgba(16,185,129,0.15)', color: '#10b981',
                  border: '1px solid rgba(16,185,129,0.3)',
                  display: 'flex', alignItems: 'center', gap: 4,
                }}>
                  <Cpu size={10} /> Gemini Nano
                </span>
              ) : (
                <span style={{
                  fontSize: 10, fontWeight: 800,
                  padding: '2px 7px', borderRadius: 99,
                  background: 'var(--bg-elevated)', color: 'var(--text-muted)',
                  border: '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', gap: 4,
                }}>
                  <Cpu size={10} /> On-Device Engine
                </span>
              )}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 1 }}>
              <ShieldCheck size={12} color="#10b981" /> 100% Private • 0 bytes sent to external cloud
            </div>
          </div>
        </div>

        {/* Edit Month Note Trigger */}
        <button
          onClick={() => setIsEditingNote(!isEditingNote)}
          style={{
            background: currentMonthNote ? 'var(--accent-dim)' : 'var(--bg-elevated)',
            border: `1px solid ${currentMonthNote ? 'var(--accent)' : 'var(--border)'}`,
            borderRadius: 99,
            padding: '5px 11px',
            fontSize: 11.5,
            fontWeight: 700,
            color: currentMonthNote ? 'var(--accent-2)' : 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            cursor: 'pointer',
          }}
        >
          <Edit3 size={12} />
          {currentMonthNote ? 'AI Note Set' : '+ Month Note'}
        </button>
      </div>

      {/* Month Note Editor Drawer */}
      {isEditingNote && (
        <div style={{
          marginBottom: 16,
          padding: 14,
          borderRadius: 16,
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          animation: 'fadeIn 0.2s ease',
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>Context for {monthName} {selectedYear}</span>
            <button onClick={() => setIsEditingNote(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2 }}>
              <X size={14} />
            </button>
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '0 0 10px 0' }}>
            Tell your on-device AI about seasonal events, trips, or one-off renewals so it normalizes your burn rate.
          </p>
          <textarea
            rows={2}
            value={noteInput}
            onChange={e => setNoteInput(e.target.value)}
            placeholder="e.g. Annual Jio data recharge, Diwali travel & festival sweets this month."
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: 10,
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
              fontSize: 13,
              outline: 'none',
              fontFamily: "'DM Sans', sans-serif",
              marginBottom: 10,
              resize: 'none',
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button
              onClick={() => setIsEditingNote(false)}
              style={{
                padding: '6px 12px', borderRadius: 8,
                background: 'transparent', border: 'none',
                color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSaveMonthNote}
              disabled={savingNote}
              style={{
                padding: '6px 14px', borderRadius: 8,
                background: 'var(--accent-grad)', border: 'none',
                color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer',
              }}
            >
              {savingNote ? 'Saving...' : 'Save Context'}
            </button>
          </div>
        </div>
      )}

      {/* Metric Cards Comparison: Total vs Normalized */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 10,
        marginBottom: 16,
      }}>
        <div style={{
          background: 'var(--bg-elevated)',
          borderRadius: 16,
          padding: '12px 14px',
          border: '1px solid var(--border)',
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
            Total Outflow
          </div>
          <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--text-primary)', marginTop: 2, letterSpacing: '-0.4px' }}>
            {formatINR(auditResult.totalSpent)}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
            Unfiltered spend
          </div>
        </div>

        <div style={{
          background: isReassuring ? 'rgba(16, 185, 129, 0.08)' : 'var(--bg-elevated)',
          borderRadius: 16,
          padding: '12px 14px',
          border: isReassuring ? '1.5px solid rgba(16, 185, 129, 0.35)' : '1px solid var(--border)',
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: isReassuring ? '#10b981' : 'var(--accent-2)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
            True Recurring Burn
          </div>
          <div style={{ fontSize: 20, fontWeight: 900, color: isReassuring ? '#10b981' : 'var(--text-primary)', marginTop: 2, letterSpacing: '-0.4px' }}>
            {formatINR(auditResult.normalizedSpent)}
          </div>
          <div style={{ fontSize: 11, color: isReassuring ? '#10b981' : 'var(--text-muted)', marginTop: 2, fontWeight: 600 }}>
            {hasAnomalies ? `-₹${auditResult.totalAnomalySpent.toLocaleString('en-IN')} one-offs` : 'No anomalies'}
          </div>
        </div>
      </div>

      {/* Reconciled Categories Pill Callout */}
      {overCats.length > 0 && (
        <div style={{
          marginBottom: 14,
          padding: '10px 12px',
          borderRadius: 14,
          background: isReassuring ? 'rgba(16, 185, 129, 0.1)' : 'rgba(234, 179, 8, 0.1)',
          border: `1px solid ${isReassuring ? 'rgba(16, 185, 129, 0.25)' : 'rgba(234, 179, 8, 0.25)'}`,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}>
          <div style={{ fontSize: 11.5, fontWeight: 800, color: isReassuring ? '#10b981' : '#eab308', display: 'flex', alignItems: 'center', gap: 6 }}>
            {isReassuring ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
            {isReassuring
              ? 'Category budgets reconciled: Safe on recurring baseline!'
              : 'Budget warning breakdown:'}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {overCats.map((cat, idx) => (
              <span
                key={idx}
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '3px 8px',
                  borderRadius: 8,
                  background: cat.isNormalizedSafe ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                  color: cat.isNormalizedSafe ? '#10b981' : '#ef4444',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <span>{cat.emoji}</span>
                <span>{cat.categoryName}</span>
                <span>• {cat.isNormalizedSafe ? 'Safe Normalized' : `₹${cat.overage.toLocaleString('en-IN')} Over`}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* AI Executive Briefing */}
      <div style={{
        background: 'var(--bg-elevated)',
        borderRadius: 16,
        padding: '14px 16px',
        border: '1px solid var(--border)',
        marginBottom: 12,
        position: 'relative',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>💡</span>
          <div style={{ fontSize: 13.5, color: 'var(--text-primary)', lineHeight: 1.5, fontWeight: 500 }}>
            {auditResult.executiveBriefing}
          </div>
        </div>
      </div>

      {/* Tagged Anomalies Accordion */}
      {hasAnomalies && (
        <div>
          <button
            onClick={() => setShowAnomaliesList(!showAnomaliesList)}
            style={{
              width: '100%',
              background: 'none',
              border: 'none',
              padding: '6px 0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              color: 'var(--text-muted)',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <span>⚡ Tagged Anomalies ({auditResult.anomalies.length})</span>
            {showAnomaliesList ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {showAnomaliesList && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8, animation: 'fadeIn 0.2s ease' }}>
              {auditResult.anomalies.map(a => {
                const typeObj = ONE_OFF_TYPES.find(t => t.type === a.oneOffType);
                return (
                  <div
                    key={a.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 12px',
                      borderRadius: 12,
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 18 }}>{typeObj?.icon || '⚡'}</span>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{a.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {a.categoryName} • Amortized: ₹{a.amortizedMonthly}/mo
                        </div>
                      </div>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--danger)' }}>
                      {formatINR(a.amount)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
