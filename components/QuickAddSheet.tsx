'use client';

import { useState, useEffect, useRef } from 'react';
import { Settings } from '@/lib/types';
import { useRouter, usePathname } from 'next/navigation';
import { CategoryIcon } from './CategoryIcon';

export default function QuickAddSheet() {
  const router = useRouter();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [aiParsedFields, setAiParsedFields] = useState<string[]>([]);
  
  const today = new Date().toISOString().split('T')[0];
  const [form, setForm] = useState({ date: today, categoryId: '', accountId: '', amount: '', note: '' });
  const dialogRef = useRef<HTMLDialogElement>(null);

  // If on the /login page, hide the FAB
  const isLoginPage = pathname === '/login';

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(s => {
      setSettings(s);
      if (s.categories?.length) setForm(f => ({ ...f, categoryId: s.categories[0].id }));
      if (s.accounts?.length) setForm(f => ({ ...f, accountId: s.accounts[0].id }));
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
      setForm({ date: today, categoryId: settings?.categories[0]?.id ?? '', accountId: settings?.accounts?.[0]?.id ?? '', amount: '', note: '' });
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
          const parsed: string[] = [];
          setForm(prev => {
            const next = { ...prev };
            if (data.amount) { next.amount = String(data.amount); parsed.push('amount'); }
            if (data.categoryId) { next.categoryId = data.categoryId; parsed.push('categoryId'); }
            if (data.note) { next.note = data.note; parsed.push('note'); }
            return next;
          });
          setAiParsedFields(parsed);
          setTimeout(() => setAiParsedFields([]), 3000);
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

        <div>
          {/* Amount Display */}
          <div style={{ 
            display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24, gap: 8, background: 'var(--bg-elevated)', padding: '16px', borderRadius: 'var(--r-lg)', 
            border: aiParsedFields.includes('amount') ? '2px solid var(--success)' : '1px solid var(--border)',
            transition: 'border 0.3s'
          }}>
            <span style={{ fontSize: 24, fontWeight: 500, color: 'var(--text-secondary)' }}>₹</span>
            <div style={{ fontSize: 40, fontWeight: 700, color: 'var(--text-primary)' }}>
              {form.amount || '0'}
            </div>
            {aiParsedFields.includes('amount') && <span style={{ fontSize: 16 }}>✨</span>}
          </div>

          {/* Category Chips */}
          <div style={{ 
            marginBottom: 20,
            padding: 8, borderRadius: 'var(--r-lg)',
            border: aiParsedFields.includes('categoryId') ? '2px solid var(--success)' : '2px solid transparent',
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

          {/* Account Chips */}
          {(settings?.accounts?.length ?? 0) > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8, scrollbarWidth: 'none', margin: '0 -4px', paddingLeft: 4, paddingRight: 4 }}>
                <button 
                  type="button"
                  onClick={() => setForm(f => ({ ...f, accountId: '' }))}
                  style={{
                    padding: '8px 12px', borderRadius: 'var(--r-full)', fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap',
                    background: form.accountId === '' ? 'var(--accent)' : 'var(--bg-elevated)',
                    border: `1px solid ${form.accountId === '' ? 'var(--accent)' : 'var(--border)'}`,
                    color: form.accountId === '' ? '#fff' : 'var(--text-secondary)', cursor: 'pointer', flexShrink: 0
                  }}
                >Cash</button>
                {settings?.accounts?.map(acc => (
                  <button 
                    key={acc.id} type="button"
                    onClick={() => setForm(f => ({ ...f, accountId: acc.id }))}
                    style={{
                      padding: '8px 12px', borderRadius: 'var(--r-full)', fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap',
                      background: form.accountId === acc.id ? 'var(--accent)' : 'var(--bg-elevated)',
                      border: `1px solid ${form.accountId === acc.id ? 'var(--accent)' : 'var(--border)'}`,
                      color: form.accountId === acc.id ? '#fff' : 'var(--text-secondary)',
                      display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', flexShrink: 0
                    }}
                  >
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: form.accountId === acc.id ? '#fff' : acc.color }}></span>
                    {acc.name}
                  </button>
                ))}
              </div>
            </div>
          )}

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
                border: aiParsedFields.includes('note') ? '2px solid var(--success)' : '1px solid var(--border)',
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
      </dialog>
    </>
  );
}
