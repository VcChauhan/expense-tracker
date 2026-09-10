'use client';

import { useState } from 'react';
import { Settings, formatINR } from '@/lib/types';
import { Sparkles, ArrowRight, Check, ChevronLeft, ShieldCheck, Bell, Target, Wallet } from 'lucide-react';
import { lightTap, successBuzz } from '@/lib/haptics';

interface Props {
  initialSettings: Settings;
  onComplete: (updated: Settings) => void;
  onClose: () => void;
}

export function OnboardingWizard({ initialSettings, onComplete, onClose }: Props) {
  const [step, setStep] = useState(1);
  const [salary, setSalary] = useState(initialSettings.annualSalary ? String(initialSettings.annualSalary) : '1500000');
  const [categories, setCategories] = useState(initialSettings.categories || []);
  const [saving, setSaving] = useState(false);

  const parsedSalary = parseFloat(salary) || 0;
  const approxMonthlyInHand = Math.round((parsedSalary * 0.78) / 12);

  function nextStep() {
    lightTap();
    setStep(s => s + 1);
  }

  function prevStep() {
    lightTap();
    setStep(s => Math.max(1, s - 1));
  }

  function updateCategoryBudget(id: string, budget: number) {
    setCategories(cats => cats.map(c => c.id === id ? { ...c, monthlyBudget: budget } : c));
  }

  async function handleFinish() {
    lightTap();
    setSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          annualSalary: parsedSalary,
          monthlySalary: approxMonthlyInHand,
          categories,
        }),
      });

      if (res.ok) {
        const updated = await res.json();
        successBuzz();
        onComplete(updated);
        onClose();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 99999,
      background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(12px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16,
    }}>
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border-strong)',
        borderRadius: 28, width: '100%', maxWidth: 460,
        boxShadow: 'var(--shadow-xl)', overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Step progress bar */}
        <div style={{ display: 'flex', height: 4, background: 'var(--bg-elevated)' }}>
          {[1, 2, 3].map(s => (
            <div
              key={s}
              style={{
                flex: 1,
                background: s <= step ? 'var(--accent)' : 'transparent',
                transition: 'background 0.3s ease',
              }}
            />
          ))}
        </div>

        {/* Modal Body */}
        <div style={{ padding: '24px 24px 20px' }}>
          {step === 1 && (
            <div>
              <div style={{
                width: 48, height: 48, borderRadius: 16, background: 'var(--accent-dim)',
                color: 'var(--accent-2)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 16,
              }}>
                <Wallet size={24} />
              </div>

              <h2 style={{ fontSize: 22, fontWeight: 900, color: 'var(--text-primary)', margin: '0 0 6px 0', letterSpacing: '-0.5px' }}>
                Welcome to ExpenseIQ!
              </h2>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 20px 0', lineHeight: 1.5 }}>
                Let&apos;s personalize your financial radar. What is your approximate annual salary?
              </p>

              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 8 }}>
                  ANNUAL CTC / INCOME (₹)
                </label>
                <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-elevated)', borderRadius: 14, border: '1.5px solid var(--border)', padding: '0 14px' }}>
                  <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-muted)', marginRight: 6 }}>₹</span>
                  <input
                    type="number"
                    value={salary}
                    onChange={e => setSalary(e.target.value)}
                    style={{
                      width: '100%', padding: '14px 0', background: 'transparent',
                      border: 'none', color: 'var(--text-primary)', fontSize: 20,
                      fontWeight: 800, outline: 'none',
                    }}
                  />
                </div>
              </div>

              {parsedSalary > 0 && (
                <div style={{
                  background: 'var(--bg-elevated)', borderRadius: 14, padding: '12px 16px',
                  border: '1px solid var(--border)', marginBottom: 20,
                }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                    Estimated In-Hand Monthly
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--success)', marginTop: 2 }}>
                    {formatINR(approxMonthlyInHand)}/month
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div>
              <div style={{
                width: 48, height: 48, borderRadius: 16, background: 'var(--accent-dim)',
                color: 'var(--accent-2)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 16,
              }}>
                <Target size={24} />
              </div>

              <h2 style={{ fontSize: 22, fontWeight: 900, color: 'var(--text-primary)', margin: '0 0 6px 0', letterSpacing: '-0.5px' }}>
                Set Monthly Budgets
              </h2>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 16px 0', lineHeight: 1.5 }}>
                Review or adjust monthly spending targets for your top categories:
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 260, overflowY: 'auto', paddingRight: 4 }}>
                {categories.slice(0, 6).map(cat => (
                  <div
                    key={cat.id}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      background: 'var(--bg-elevated)', borderRadius: 14, padding: '10px 14px',
                      border: '1px solid var(--border)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: cat.color }} />
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{cat.name}</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, width: 120 }}>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>₹</span>
                      <input
                        type="number"
                        value={cat.monthlyBudget || ''}
                        onChange={e => updateCategoryBudget(cat.id, parseFloat(e.target.value) || 0)}
                        style={{
                          width: '100%', padding: '6px 8px', borderRadius: 8,
                          background: 'var(--bg-card)', border: '1px solid var(--border)',
                          color: 'var(--text-primary)', fontSize: 13, fontWeight: 700,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div style={{ textAlign: 'center', padding: '10px 0' }}>
              <div style={{
                width: 56, height: 56, borderRadius: 20, background: 'var(--success-dim)',
                color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 16px',
              }}>
                <Sparkles size={28} />
              </div>

              <h2 style={{ fontSize: 24, fontWeight: 900, color: 'var(--text-primary)', margin: '0 0 8px 0', letterSpacing: '-0.5px' }}>
                You&apos;re All Set!
              </h2>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '0 0 24px 0', lineHeight: 1.5 }}>
                ExpenseIQ is primed with your income, category targets, and smart spending intelligence.
              </p>

              <div style={{
                background: 'var(--bg-elevated)', borderRadius: 16, padding: '14px',
                textAlign: 'left', border: '1px solid var(--border)', marginBottom: 20,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--text-primary)', fontWeight: 600, marginBottom: 8 }}>
                  <Check size={16} color="var(--success)" /> Income & Tax Engine configured
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--text-primary)', fontWeight: 600, marginBottom: 8 }}>
                  <Check size={16} color="var(--success)" /> Category spending limits active
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--text-primary)', fontWeight: 600 }}>
                  <Check size={16} color="var(--success)" /> Real-time leak & price hike audit ready
                </div>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 }}>
            {step > 1 ? (
              <button
                type="button"
                onClick={prevStep}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: 'none', border: 'none', color: 'var(--text-secondary)',
                  fontSize: 13, fontWeight: 700, cursor: 'pointer',
                }}
              >
                <ChevronLeft size={16} /> Back
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                style={{
                  background: 'none', border: 'none', color: 'var(--text-muted)',
                  fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}
              >
                Skip for now
              </button>
            )}

            {step < 3 ? (
              <button
                type="button"
                onClick={nextStep}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '12px 20px', borderRadius: 99,
                  background: 'var(--accent)', color: '#fff',
                  border: 'none', fontWeight: 800, fontSize: 14,
                  cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
                  boxShadow: '0 4px 14px rgba(124, 92, 252, 0.4)',
                }}
              >
                Continue <ArrowRight size={16} />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleFinish}
                disabled={saving}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '12px 24px', borderRadius: 99,
                  background: 'var(--accent-grad)', color: '#fff',
                  border: 'none', fontWeight: 800, fontSize: 14,
                  cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
                  boxShadow: 'var(--shadow-accent)',
                }}
              >
                {saving ? 'Launching...' : 'Start Exploring 🚀'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
