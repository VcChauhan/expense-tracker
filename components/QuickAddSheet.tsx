'use client';

import { useState, useEffect, useRef } from 'react';
import { Settings } from '@/lib/types';
import { useRouter, usePathname } from 'next/navigation';
import { CategoryIcon } from './CategoryIcon';
import { Sparkles } from 'lucide-react';

export default function QuickAddSheet() {
  const router = useRouter();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [voiceSuggestion, setVoiceSuggestion] = useState<{ transcript: string; amount: string; categoryId: string; note: string; } | null>(null);
  
  const today = new Date().toISOString().split('T')[0];
  const [form, setForm] = useState({ date: today, categoryId: '', amount: '', note: '' });
  const [splitWays, setSplitWays] = useState<number>(1);
  const [categoryTotals, setCategoryTotals] = useState<{_id: string; total: number}[]>([]);

  // If on the /login page, hide the FAB
  const isLoginPage = pathname === '/login';

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(s => {
      setSettings(s);
      if (s.categories?.length) setForm(f => ({ ...f, categoryId: s.categories[0].id }));
    });
    if (typeof window !== 'undefined') {
      setVoiceSupported('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      const now = new Date();
      fetch(`/api/analytics/monthly?month=${now.getMonth() + 1}&year=${now.getFullYear()}`)
        .then(r => r.json())
        .then(data => setCategoryTotals(data.categoryTotals || []))
        .catch(console.error);
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const latestForm = useRef(form);
  useEffect(() => {
    latestForm.current = form;
  }, [form]);

  const latestSubmit = useRef(handleSubmit);
  useEffect(() => {
    latestSubmit.current = handleSubmit;
  }, [handleSubmit]);

  // Handle keyboard events
  useEffect(() => {
    const handleGlobalOpen = () => setIsOpen(true);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      
      const currentAmount = latestForm.current.amount;
      if (e.key >= '0' && e.key <= '9') {
        setForm(f => ({ ...f, amount: f.amount + e.key }));
      } else if (e.key === 'Backspace') {
        setForm(f => ({ ...f, amount: f.amount.slice(0, -1) }));
      } else if (e.key === '.' || e.key === ',') {
        setForm(f => ({ ...f, amount: f.amount.includes('.') ? f.amount : (f.amount ? f.amount + '.' : '0.') }));
      } else if (e.key === 'Enter') {
        latestSubmit.current();
      } else if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    window.addEventListener('open-quick-add', handleGlobalOpen);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('open-quick-add', handleGlobalOpen);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  async function handleSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!form.amount || parseFloat(form.amount) <= 0) return;
    setLoading(true);
    try {
      const parsedAmount = parseFloat(form.amount);
      const finalAmount = splitWays > 1 ? Math.round((parsedAmount / splitWays) * 100) / 100 : parsedAmount;
      const splitNote = splitWays > 1 ? ` (Split: ₹${parsedAmount} / ${splitWays})` : '';
      const finalNote = form.note + splitNote;

      await fetch('/api/expenses', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, amount: finalAmount, note: finalNote }),
      });
      setForm({ date: today, categoryId: settings?.categories[0]?.id ?? '', amount: '', note: '' });
      setSplitWays(1);
      setIsOpen(false);
      router.refresh();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirmVoice(suggestion: any) {
    if (!suggestion.amount || parseFloat(suggestion.amount) <= 0) return;
    setLoading(true);
    try {
      const parsedAmount = parseFloat(suggestion.amount);
      const finalAmount = splitWays > 1 ? Math.round((parsedAmount / splitWays) * 100) / 100 : parsedAmount;
      const splitNote = splitWays > 1 ? ` (Split: ₹${parsedAmount} / ${splitWays})` : '';
      const finalNote = (suggestion.note || '') + splitNote;

      await fetch('/api/expenses', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
           date: today, 
           categoryId: suggestion.categoryId || settings?.categories[0]?.id || '', 
           amount: finalAmount, 
           note: finalNote 
        }),
      });
      setForm({ date: today, categoryId: settings?.categories[0]?.id ?? '', amount: '', note: '' });
      setSplitWays(1);
      setVoiceSuggestion(null);
      setIsOpen(false);
      router.refresh();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleVoiceInput() {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListening(true);
    
    recognition.onresult = async (event: any) => {
      const transcript = event.results[0][0].transcript;
      setIsListening(false);
      setLoading(true);

      try {
        const res = await fetch('/api/voice-parse', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: transcript }),
        });
        if (res.ok) {
          const data = await res.json();
          setVoiceSuggestion({
            transcript,
            amount: data.amount ? String(data.amount) : '',
            categoryId: data.categoryId || '',
            note: data.note || ''
          });
        }
      } catch (err) {
        console.error('Voice parsing error', err);
      } finally {
        setLoading(false);
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error', event.error);
      setIsListening(false);
    };

    recognition.start();
  }

  function handleKey(key: string) {
    if (key === 'backspace') {
      setForm(f => ({ ...f, amount: f.amount.slice(0, -1) }));
    } else if (key === '.') {
      if (!form.amount.includes('.')) {
        setForm(f => ({ ...f, amount: f.amount ? f.amount + '.' : '0.' }));
      }
    } else {
      setForm(f => ({ ...f, amount: f.amount + key }));
    }
  }

  if (isLoginPage || !isOpen) return null;

  return (
    <>
      <div 
        onClick={() => setIsOpen(false)}
        style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          zIndex: 9999,
          backdropFilter: 'blur(2px)'
        }} 
      />
      <div 
        style={{
          position: 'fixed',
          bottom: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          width: '100%',
          maxWidth: '500px',
          maxHeight: '85%',
          boxSizing: 'border-box',
          overflowY: 'auto',
          background: 'var(--bg-card)',
          padding: '24px 20px',
          color: 'var(--text-primary)',
          boxShadow: 'var(--shadow-lg)',
          borderRadius: '24px 24px 0 0',
          zIndex: 10000,
        }}
      >
        <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--border)', margin: '0 auto 24px auto', flexShrink: 0 }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Quick Add</h2>
            {voiceSupported && (
              <button
                type="button"
                onClick={handleVoiceInput}
                style={{ 
                  background: isListening ? 'var(--danger)' : 'var(--accent)', 
                  border: 'none', color: '#fff', width: 32, height: 32, borderRadius: '50%', cursor: 'pointer', 
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: isListening ? '0 0 12px var(--danger)' : 'none',
                  animation: isListening ? 'pulse 1.5s infinite' : 'none'
                }}
                title="Voice Add"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>
              </button>
            )}
          </div>
          <button 
            type="button"
            onClick={() => setIsOpen(false)}
            style={{ background: 'var(--bg-elevated)', border: 'none', color: 'var(--text-secondary)', width: 32, height: 32, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600 }}
          >
            ✕
          </button>
        </div>

        {voiceSuggestion ? (
          <div>
             <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
               <Sparkles size={18} color="var(--accent)" />
               <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Review AI Suggestion</h3>
             </div>
             
             <div style={{ background: 'var(--bg-elevated)', borderRadius: 12, padding: 16, marginBottom: 24, border: '1px solid var(--border)' }}>
               <div style={{ fontSize: 14, color: 'var(--text-secondary)', fontStyle: 'italic', marginBottom: 16, lineHeight: 1.4 }}>
                 "{voiceSuggestion.transcript}"
               </div>
               
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
                 <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Amount</span>
                 <span style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>₹{voiceSuggestion.amount || '0'}</span>
               </div>
               
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
                 <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Split ways</span>
                 <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                   {splitWays > 1 && voiceSuggestion.amount && (
                     <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>
                       = ₹{Math.round((parseFloat(voiceSuggestion.amount) / splitWays) * 100) / 100} / person
                     </span>
                   )}
                   <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-card)', borderRadius: 20, border: '1px solid var(--border)' }}>
                     <button type="button" onClick={() => setSplitWays(Math.max(1, splitWays - 1))} style={{ background: 'none', border: 'none', padding: '4px 12px', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 16 }}>-</button>
                     <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', minWidth: 20, textAlign: 'center' }}>{splitWays}</span>
                     <button type="button" onClick={() => setSplitWays(splitWays + 1)} style={{ background: 'none', border: 'none', padding: '4px 12px', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 16 }}>+</button>
                   </div>
                 </div>
               </div>
               
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
                 <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Category</span>
                 <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                   {voiceSuggestion.categoryId && (
                     <CategoryIcon name={settings?.categories?.find(c => c.id === voiceSuggestion.categoryId)?.name || ''} size={14} color="var(--accent)" />
                   )}
                   <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
                     {settings?.categories?.find(c => c.id === voiceSuggestion.categoryId)?.name || 'None'}
                   </span>
                 </div>
               </div>
               
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                 <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Note</span>
                 <span style={{ fontSize: 15, color: 'var(--text-primary)' }}>{voiceSuggestion.note || 'None'}</span>
               </div>
             </div>
             
             <div style={{ display: 'flex', gap: 12 }}>
                <button 
                  onClick={() => {
                     setForm(prev => ({
                        ...prev,
                        amount: voiceSuggestion.amount || prev.amount,
                        categoryId: voiceSuggestion.categoryId || prev.categoryId,
                        note: voiceSuggestion.note || prev.note
                     }));
                     setVoiceSuggestion(null);
                  }}
                  style={{ flex: 1, padding: 14, borderRadius: 12, background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontWeight: 600, cursor: 'pointer', fontSize: 15 }}
                >
                  Edit Manually
                </button>
                <button
                  onClick={() => handleConfirmVoice(voiceSuggestion)}
                  disabled={loading || !voiceSuggestion.amount}
                  style={{ flex: 1, padding: 14, borderRadius: 12, background: 'linear-gradient(135deg, var(--accent), #5B4FE0)', color: '#fff', border: 'none', fontWeight: 600, cursor: 'pointer', fontSize: 15, display: 'flex', justifyContent: 'center', alignItems: 'center' }}
                >
                  {loading ? <span className="spinner" style={{ width: 16, height: 16, borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff' }} /> : 'Confirm & Save'}
                </button>
             </div>
          </div>
        ) : (
          <div>
          {/* Amount Display */}
          <div style={{ 
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', marginBottom: 24, background: 'var(--bg-elevated)', padding: '16px', borderRadius: 'var(--r-lg)', 
            border: '1px solid var(--border)',
            transition: 'border 0.3s'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
               <span style={{ fontSize: 24, fontWeight: 500, color: 'var(--text-secondary)' }}>₹</span>
               <div style={{ fontSize: 40, fontWeight: 700, color: 'var(--text-primary)' }}>
                 {form.amount || '0'}
               </div>
            </div>
            
            {/* Split UI */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
               <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Split ways:</span>
               <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-card)', borderRadius: 20, border: '1px solid var(--border)' }}>
                 <button type="button" onClick={() => setSplitWays(Math.max(1, splitWays - 1))} style={{ background: 'none', border: 'none', padding: '4px 12px', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 16 }}>-</button>
                 <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', minWidth: 20, textAlign: 'center' }}>{splitWays}</span>
                 <button type="button" onClick={() => setSplitWays(splitWays + 1)} style={{ background: 'none', border: 'none', padding: '4px 12px', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 16 }}>+</button>
               </div>
               {splitWays > 1 && form.amount && (
                 <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>
                   = ₹{Math.round((parseFloat(form.amount) / splitWays) * 100) / 100} / person
                 </span>
               )}
            </div>
          </div>

          {/* Category Chips */}
          <div style={{ 
            marginBottom: 20,
            padding: 8, borderRadius: 'var(--r-lg)',
            border: '2px solid transparent',
            transition: 'border 0.3s'
          }}>
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8, scrollbarWidth: 'none', margin: '0 -4px', paddingLeft: 4, paddingRight: 4 }}>
              {(settings?.categories ?? []).map(cat => {
                const isSelected = form.categoryId === cat.id;
                return (
                  <button 
                    key={cat.id} type="button"
                    onClick={() => setForm(f => ({ ...f, categoryId: cat.id }))}
                    style={{ 
                      padding: '8px 12px', borderRadius: 'var(--r-full)', fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap',
                      background: isSelected ? 'var(--accent)' : 'var(--bg-elevated)',
                      border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                      color: isSelected ? '#fff' : 'var(--text-secondary)',
                      display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', flexShrink: 0
                    }}
                  >
                    <span><CategoryIcon name={cat.name} size={14} color={isSelected ? '#fff' : 'var(--text-secondary)'} /></span>
                    {cat.name}
                  </button>
                )
              })}
            </div>
          </div>


          {/* Note and Date Inputs */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            <input 
              type="date"
              value={form.date}
              onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
              style={{
                flexShrink: 0, padding: '12px', borderRadius: 'var(--r-md)', background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                color: 'var(--text-primary)', fontSize: 14, outline: 'none'
              }}
            />
              <input 
              type="text"
              placeholder="Notes (optional)"
              value={form.note}
              onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
              style={{
                flex: 1, padding: '12px', borderRadius: 'var(--r-md)', background: 'var(--bg-elevated)', 
                border: '1px solid var(--border)',
                color: 'var(--text-primary)', fontSize: 14, outline: 'none', minWidth: 0,
                transition: 'border 0.3s'
              }}
            />
          </div>

          {/* Keypad */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 24 }}>
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'backspace'].map(key => (
              <button
                key={key} type="button"
                onClick={() => handleKey(key)}
                style={{
                  height: 48, borderRadius: 'var(--r-lg)', background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                  color: 'var(--text-primary)', fontSize: 20, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
                }}
              >
                {key === 'backspace' ? '⌫' : key}
              </button>
            ))}
          </div>

          {(() => {
            const activeCategory = settings?.categories?.find(c => c.id === form.categoryId);
            const activeTotal = categoryTotals.find(c => c._id === form.categoryId)?.total || 0;
            const parsedAmount = parseFloat(form.amount) || 0;
            const finalAmount = splitWays > 1 ? Math.round((parsedAmount / splitWays) * 100) / 100 : parsedAmount;
            const budget = activeCategory?.monthlyBudget || 0;
            const newTotal = activeTotal + finalAmount;
            
            if (budget > 0 && newTotal > budget && finalAmount > 0) {
              const overBudgetPct = ((newTotal - budget) / budget * 100).toFixed(0);
              return (
                <div style={{ marginBottom: 16, padding: '8px 12px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 8, fontSize: 13, color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>⚠️</span> This will put you {overBudgetPct}% over your {activeCategory?.name} budget.
                </div>
              );
            }
            return null;
          })()}

          <button onClick={() => handleSubmit()} style={{ width: '100%', background: 'linear-gradient(135deg, var(--accent), #5B4FE0)', color: '#fff', border: 'none', borderRadius: 'var(--r-full)', padding: '16px', fontSize: 16, fontWeight: 600, cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8 }} disabled={loading || !form.amount}>
            {loading ? <span className="spinner" style={{ width: 16, height: 16, borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff' }} /> : 'Save Expense'}
          </button>
        </div>
        )}
      </div>
    </>
  );
}
