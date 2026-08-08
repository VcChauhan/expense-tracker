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
  const dialogRef = useRef<HTMLDialogElement>(null);

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
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      dialog.showModal();
      document.body.style.overflow = 'hidden';
    } else {
      dialog.close();
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

  // Handle light dismiss and keyboard events
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    
    const handleCancel = (e: Event) => {
      e.preventDefault();
      setIsOpen(false);
    };
    
    const handleClick = (e: MouseEvent) => {
      if (e.target === dialog) {
        setIsOpen(false); // clicked backdrop
      }
    };
    
    const handleGlobalOpen = () => {
      setIsOpen(true);
    };

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
      }
    };

    window.addEventListener('open-quick-add', handleGlobalOpen);
    window.addEventListener('keydown', handleKeyDown);
    dialog.addEventListener('cancel', handleCancel);
    dialog.addEventListener('click', handleClick);
    return () => {
      window.removeEventListener('open-quick-add', handleGlobalOpen);
      window.removeEventListener('keydown', handleKeyDown);
      dialog.removeEventListener('cancel', handleCancel);
      dialog.removeEventListener('click', handleClick);
    };
  }, [isOpen]);

  async function handleSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!form.amount || parseFloat(form.amount) <= 0) return;
    setLoading(true);
    try {
      await fetch('/api/expenses', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, amount: parseFloat(form.amount) }),
      });
      setForm({ date: today, categoryId: settings?.categories[0]?.id ?? '', amount: '', note: '' });
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
      await fetch('/api/expenses', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
           date: today, 
           categoryId: suggestion.categoryId || settings?.categories[0]?.id || '', 
           amount: parseFloat(suggestion.amount), 
           note: suggestion.note || '' 
        }),
      });
      setForm({ date: today, categoryId: settings?.categories[0]?.id ?? '', amount: '', note: '' });
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

  if (isLoginPage) return null;

  return (
    <>
      <dialog 
        ref={dialogRef}
        style={{
          margin: 'auto auto 0 auto',
          width: '100%',
          maxWidth: '500px',
          border: 'none',
          borderRadius: '24px 24px 0 0',
          background: 'var(--bg-card)',
          padding: '24px 20px',
          color: 'var(--text-primary)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--border)', margin: '0 auto 24px auto' }} />

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
            display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24, gap: 8, background: 'var(--bg-elevated)', padding: '16px', borderRadius: 'var(--r-lg)', 
            border: '1px solid var(--border)',
            transition: 'border 0.3s'
          }}>
            <span style={{ fontSize: 24, fontWeight: 500, color: 'var(--text-secondary)' }}>₹</span>
            <div style={{ fontSize: 40, fontWeight: 700, color: 'var(--text-primary)' }}>
              {form.amount || '0'}
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

          <button onClick={() => handleSubmit()} style={{ width: '100%', background: 'linear-gradient(135deg, var(--accent), #5B4FE0)', color: '#fff', border: 'none', borderRadius: 'var(--r-full)', padding: '16px', fontSize: 16, fontWeight: 600, cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8 }} disabled={loading || !form.amount}>
            {loading ? <span className="spinner" style={{ width: 16, height: 16, borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff' }} /> : 'Save Expense'}
          </button>
        </div>
        )}
      </dialog>
    </>
  );
}
