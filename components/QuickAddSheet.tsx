'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Settings } from '@/lib/types';
import { useRouter, usePathname } from 'next/navigation';
import { CategoryIcon } from './CategoryIcon';
import { Sparkles, X, Mic, MicOff, ChevronRight, Zap, Delete } from 'lucide-react';
import { TagSelector } from './TagSelector';
import { QuickTemplates } from './QuickTemplates';
import { PaymentMethodSelector } from './PaymentMethodSelector';
import { PaymentMethod, PaymentMethodValue } from '@/lib/types';
import { QuickTemplate } from '@/lib/types';
import { successBuzz, errorShake } from '@/lib/haptics';

export default function QuickAddSheet() {
  const router = useRouter();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [voiceSuggestion, setVoiceSuggestion] = useState<{ transcript: string; amount: string; categoryId: string; note: string; } | null>(null);

  /* Drag-to-dismiss state */
  const dragStartY = useRef(0);
  const [dragDelta, setDragDelta] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const today = new Date().toISOString().split('T')[0];
  const [form, setForm] = useState<{ date: string, categoryId: string, amount: string, note: string, tags: string[], paymentMethod: PaymentMethodValue }>({ date: today, categoryId: '', amount: '', note: '', tags: [], paymentMethod: 'upi' });
  const [splitWays, setSplitWays] = useState<number>(1);
  const [categoryTotals, setCategoryTotals] = useState<{_id: string; total: number}[]>([]);
  const [recentTags, setRecentTags] = useState<string[]>([]);

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

  function handleNoteChange(text: string) {
    setForm(f => {
      const updated = { ...f, note: text };
      if (f.tags.length === 0) {
        const lower = text.toLowerCase();
        if (lower.includes('swiggy') || lower.includes('zomato') || lower.includes('chai') || lower.includes('lunch')) {
          updated.tags = ['lunch'];
        } else if (lower.includes('uber') || lower.includes('ola') || lower.includes('auto') || lower.includes('petrol')) {
          updated.tags = ['commute'];
        } else if (lower.includes('badminton') || lower.includes('turf') || lower.includes('gym')) {
          updated.tags = ['badminton'];
        } else if (lower.includes('blinkit') || lower.includes('zepto') || lower.includes('grocery')) {
          updated.tags = ['grocery'];
        }
      }
      return updated;
    });
  }

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      const now = new Date();
      fetch(`/api/analytics/monthly?month=${now.getMonth() + 1}&year=${now.getFullYear()}`)
        .then(r => r.json())
        .then(data => {
           setCategoryTotals(data.categoryTotals || []);
           if (data.recent && Array.isArray(data.recent)) {
             const tags = new Set<string>();
             data.recent.forEach((exp: any) => {
               if (exp.tags && Array.isArray(exp.tags)) exp.tags.forEach((t: string) => tags.add(t.toLowerCase()));
             });
             setRecentTags(Array.from(tags).slice(0, 8));
           }
        }).catch(console.error);
    } else {
      document.body.style.overflow = '';
      setDragDelta(0);
      setIsDragging(false);
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  useEffect(() => {
    const handleGlobalOpen = () => setIsOpen(true);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Enter') { latestSubmit.current(); }
      else if (e.key === 'Escape') { setIsOpen(false); }
    };
    window.addEventListener('open-quick-add', handleGlobalOpen);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('open-quick-add', handleGlobalOpen);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  /* Numpad press handler */
  function handleNumpad(key: string) {
    setForm(f => {
      let current = f.amount;
      if (key === '⌫') {
        return { ...f, amount: current.slice(0, -1) };
      }
      if (key === '.') {
        if (current.includes('.')) return f;
        return { ...f, amount: (current || '0') + '.' };
      }
      if (key === '0' && current === '0') return f;
      if (current === '0' && key !== '.') {
        return { ...f, amount: key };
      }
      // Max 8 digits + 2 decimal places
      const parts = (current + key).split('.');
      if (parts[0].length > 8) return f;
      if (parts[1] && parts[1].length > 2) return f;
      return { ...f, amount: current + key };
    });
  }

  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
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
      successBuzz();
      setForm({ date: today, categoryId: settings?.categories[0]?.id ?? '', amount: '', note: '', tags: [], paymentMethod: 'upi' });
      setSplitWays(1);
      setIsOpen(false);
      router.refresh();
    } catch (err) { errorShake(); console.error(err); }
    finally { setLoading(false); }
  }, [form, splitWays, settings, today, router]);

  const latestSubmit = useRef(handleSubmit);
  useEffect(() => { latestSubmit.current = handleSubmit; }, [handleSubmit]);

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
        body: JSON.stringify({ date: today, categoryId: suggestion.categoryId || settings?.categories[0]?.id || '', amount: finalAmount, note: finalNote }),
      });
      setForm({ date: today, categoryId: settings?.categories[0]?.id ?? '', amount: '', note: '', tags: [], paymentMethod: 'upi' });
      setSplitWays(1); setVoiceSuggestion(null); setIsOpen(false);
      router.refresh();
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  async function handleVoiceInput() {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US'; recognition.interimResults = false; recognition.maxAlternatives = 1;
    recognition.onstart = () => setIsListening(true);
    recognition.onresult = async (event: any) => {
      const transcript = event.results[0][0].transcript;
      setIsListening(false); setLoading(true);
      try {
        const res = await fetch('/api/voice-parse', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: transcript }) });
        if (res.ok) {
          const data = await res.json();
          setVoiceSuggestion({ transcript, amount: data.amount ? String(data.amount) : '', categoryId: data.categoryId || '', note: data.note || '' });
        }
      } catch (err) { console.error('Voice parsing error', err); }
      finally { setLoading(false); }
    };
    recognition.onerror = (event: any) => { console.error(event.error); setIsListening(false); };
    recognition.start();
  }

  /* Drag to dismiss */
  function handleDragStart(e: React.TouchEvent) {
    dragStartY.current = e.touches[0].clientY;
    setIsDragging(true);
  }
  function handleDragMove(e: React.TouchEvent) {
    if (!isDragging) return;
    const dy = e.touches[0].clientY - dragStartY.current;
    if (dy > 0) setDragDelta(dy);
  }
  function handleDragEnd() {
    setIsDragging(false);
    if (dragDelta > 100) { setIsOpen(false); }
    else { setDragDelta(0); }
  }

  const hasAmount = form.amount && parseFloat(form.amount) > 0;
  const activeCategory = settings?.categories?.find(c => c.id === form.categoryId);

  const numpadKeys = ['1','2','3','4','5','6','7','8','9','.','0','⌫'];

  if (isLoginPage || !isOpen) return null;

  return (
    <div
      id="quick-add-backdrop"
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99999,
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center',
        background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
        animation: 'fadeIn 0.2s ease-out',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) setIsOpen(false); }}
    >
      {/* Sheet */}
      <div
        id="quick-add-sheet"
        style={{
          width: '100%', maxWidth: '500px', maxHeight: 'calc(100% - 20px)',
          display: 'flex', flexDirection: 'column',
          background: 'var(--bg-card)', color: 'var(--text-primary)',
          borderRadius: '28px 28px 0 0',
          border: '1px solid var(--border-strong)', borderBottom: 'none',
          boxShadow: '0 -8px 60px rgba(0,0,0,0.5)',
          overflow: 'hidden',
          transform: `translateY(${dragDelta}px)`,
          transition: isDragging ? 'none' : 'transform 0.38s cubic-bezier(0.34,1.56,0.64,1)',
        }}
      >
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: 'calc(40px + env(safe-area-inset-bottom, 16px))', display: 'flex', flexDirection: 'column' }}>

          {/* Drag Handle — triggers drag-to-dismiss */}
          <div
            style={{ padding: '14px 20px 0', cursor: 'grab', flexShrink: 0 }}
            onTouchStart={handleDragStart}
            onTouchMove={handleDragMove}
            onTouchEnd={handleDragEnd}
          >
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border-strong)', margin: '0 auto' }} />
          </div>

          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px 0', position: 'relative' }}>
            <div style={{ position: 'absolute', top: -4, left: -4, right: -4, height: 90, background: `linear-gradient(135deg, ${activeCategory?.color ?? 'var(--accent)'}1a 0%, transparent 75%)`, pointerEvents: 'none', borderRadius: '28px 28px 0 0' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, position: 'relative' }}>
              <div style={{ width: 34, height: 34, borderRadius: 11, flexShrink: 0, background: `linear-gradient(135deg, ${activeCategory?.color ?? 'var(--accent)'} 0%, var(--accent-2) 100%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 4px 14px ${activeCategory?.color ?? 'var(--accent)'}55` }}>
                <Zap size={16} color="#fff" fill="#fff" />
              </div>
              <div>
                <h2 style={{ fontSize: 19, fontWeight: 800, margin: 0, color: 'var(--text-primary)', letterSpacing: '-0.4px' }}>Quick Log</h2>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500, marginTop: -1 }}>Log an expense in seconds</div>
              </div>
              {voiceSupported && (
                <button type="button" onClick={handleVoiceInput} style={{ background: isListening ? 'var(--danger)' : 'var(--accent-dim)', border: `1px solid ${isListening ? 'rgba(248,113,113,0.4)' : 'var(--border-glow)'}`, color: isListening ? '#fff' : 'var(--accent-2)', width: 34, height: 34, borderRadius: '50%', flexShrink: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: isListening ? 'ring-pulse 1.2s infinite' : 'none', transition: 'all 0.2s ease' }} title="Voice Add">
                  {isListening ? <MicOff size={15} /> : <Mic size={15} />}
                </button>
              )}
            </div>
            <button type="button" onClick={() => setIsOpen(false)} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-secondary)', width: 34, height: 34, borderRadius: '50%', flexShrink: 0, cursor: 'pointer', display: 'flex', position: 'relative', alignItems: 'center', justifyContent: 'center' }}>
              <X size={16} />
            </button>
          </div>

          <div style={{ padding: '12px 20px 0' }}>
            {voiceSuggestion ? (
              /* ── Voice suggestion review ── */
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--accent-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Sparkles size={14} color="var(--accent-2)" /></div>
                  <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Review AI Suggestion</h3>
                </div>
                <div style={{ background: 'var(--bg-elevated)', borderRadius: 16, padding: '14px 16px', marginBottom: 20, border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontStyle: 'italic', marginBottom: 16, lineHeight: 1.5, borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>"{voiceSuggestion.transcript}"</div>
                  {[
                    { label: 'Amount', value: `₹${voiceSuggestion.amount || '0'}`, large: true },
                    { label: 'Category', value: settings?.categories?.find(c => c.id === voiceSuggestion.categoryId)?.name || 'None', large: false },
                    { label: 'Note', value: voiceSuggestion.note || 'None', large: false },
                  ].map((row, i, arr) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: i < arr.length - 1 ? 12 : 0, marginBottom: i < arr.length - 1 ? 12 : 0, borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
                      <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{row.label}</span>
                      <span style={{ fontSize: row.large ? 22 : 15, fontWeight: row.large ? 800 : 600, color: 'var(--text-primary)', letterSpacing: row.large ? '-0.5px' : '0' }}>{row.value}</span>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => { setForm(prev => ({ ...prev, amount: voiceSuggestion.amount || prev.amount, categoryId: voiceSuggestion.categoryId || prev.categoryId, note: voiceSuggestion.note || prev.note })); setVoiceSuggestion(null); }} style={{ flex: 1, padding: 14, borderRadius: 14, background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontWeight: 700, cursor: 'pointer', fontSize: 14, fontFamily: "'DM Sans', sans-serif" }}>Edit</button>
                  <button onClick={() => handleConfirmVoice(voiceSuggestion)} disabled={loading || !voiceSuggestion.amount} style={{ flex: 2, padding: 14, borderRadius: 14, background: 'var(--accent-grad)', color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: 14, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, fontFamily: "'DM Sans', sans-serif" }}>
                    {loading ? <span className="spinner" /> : <><span>Confirm & Save</span><ChevronRight size={16} /></>}
                  </button>
                </div>
              </div>
            ) : (
              /* ── Main numpad form ── */
              <div>
                {/* Quick Templates */}
                {settings && (
                  <QuickTemplates
                    templates={settings.quickTemplates || []}
                    categories={settings.categories || []}
                    onSelect={(t: QuickTemplate) => setForm(f => ({ ...f, amount: String(t.amount), categoryId: t.categoryId, tags: t.tags || [] }))}
                    onSave={async (templates: QuickTemplate[]) => {
                      try {
                        const res = await fetch('/api/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ quickTemplates: templates }) });
                        if (res.ok) { const s = await res.json(); setSettings(s); }
                      } catch (e) { console.error(e); }
                    }}
                  />
                )}

                {/* ── Large ₹ display ── */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: '20px 0 12px',
                  animation: 'count-up 0.2s var(--ease) both',
                }}>
                  <span style={{ fontSize: 26, fontWeight: 600, color: hasAmount ? (activeCategory?.color ?? 'var(--accent-2)') : 'var(--text-muted)', marginRight: 4, lineHeight: 1.6, transition: 'color 0.2s' }}>₹</span>
                  <span style={{ fontSize: 58, fontWeight: 900, letterSpacing: '-2px', lineHeight: 1, color: hasAmount ? 'var(--text-primary)' : 'var(--text-muted)', transition: 'color 0.2s', minWidth: '1ch', textAlign: 'center' }}>
                    {form.amount || '0'}
                  </span>
                </div>

                {/* Split info */}
                {splitWays > 1 && form.amount && (
                  <div style={{ textAlign: 'center', marginBottom: 8, fontSize: 13, fontWeight: 700, color: 'var(--accent-2)' }}>
                    = ₹{Math.round((parseFloat(form.amount) / splitWays) * 100) / 100}/person (÷{splitWays})
                  </div>
                )}

                {/* ── Category pills ── */}
                <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none', margin: '0 -20px', paddingLeft: 20, paddingRight: 20, marginBottom: 14 }}>
                  {(settings?.categories ?? []).map(cat => {
                    const isSelected = form.categoryId === cat.id;
                    return (
                      <button key={cat.id} type="button"
                        onClick={() => setForm(f => ({ ...f, categoryId: cat.id }))}
                        style={{
                          padding: isSelected ? '6px 14px 6px 6px' : '8px 14px', borderRadius: 99, fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap',
                          background: isSelected ? cat.color : 'var(--bg-elevated)',
                          border: `1.5px solid ${isSelected ? cat.color : 'var(--border)'}`,
                          color: isSelected ? '#fff' : 'var(--text-secondary)',
                          display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', flexShrink: 0,
                          transition: 'all 0.15s ease', transform: isSelected ? 'scale(1.03)' : 'scale(1)',
                          boxShadow: isSelected ? `0 4px 14px ${cat.color}55` : 'none',
                          fontFamily: "'DM Sans', sans-serif",
                        }}
                      >
                        {isSelected ? (
                          <span style={{ width: 22, height: 22, borderRadius: '50%', flexShrink: 0, background: 'rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <CategoryIcon name={cat.name} size={12} color="#fff" />
                          </span>
                        ) : (
                          <CategoryIcon name={cat.name} size={13} color="var(--text-secondary)" />
                        )}
                        {cat.name}
                      </button>
                    );
                  })}
                </div>

                {/* ── NUMPAD ── */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
                  {numpadKeys.map(key => (
                    <button
                      key={key}
                      type="button"
                      className={`numpad-key${key === '⌫' ? ' numpad-backspace' : key === '.' ? ' numpad-decimal' : ''}`}
                      onTouchStart={e => { e.currentTarget.style.transform = 'scale(0.92)'; e.currentTarget.style.boxShadow = 'var(--neuro-shadow-inset)'; }}
                      onTouchEnd={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'var(--neuro-shadow-sm)'; handleNumpad(key); }}
                      onClick={() => handleNumpad(key)}
                    >
                      {key === '⌫' ? <Delete size={20} /> : key}
                    </button>
                  ))}
                </div>

                {/* Split */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, padding: '10px 14px', background: 'var(--bg-elevated)', borderRadius: 14 }}>
                  <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600, flex: 1 }}>Split between</span>
                  <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-card)', borderRadius: 99, border: '1px solid var(--border)', overflow: 'hidden' }}>
                    <button type="button" onClick={() => setSplitWays(Math.max(1, splitWays - 1))} style={{ background: 'none', border: 'none', padding: '5px 12px', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 18, fontWeight: 700 }}>−</button>
                    <span style={{ fontSize: 14, fontWeight: 700, color: splitWays > 1 ? 'var(--accent-2)' : 'var(--text-secondary)', minWidth: 22, textAlign: 'center' }}>{splitWays}</span>
                    <button type="button" onClick={() => setSplitWays(splitWays + 1)} style={{ background: 'none', border: 'none', padding: '5px 12px', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 18, fontWeight: 700 }}>+</button>
                  </div>
                </div>

                {/* Note + Date */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                  <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} style={{ flexShrink: 0, padding: '11px 12px', borderRadius: 12, background: 'var(--bg-elevated)', border: '1.5px solid var(--border)', color: 'var(--text-primary)', fontSize: 13, outline: 'none', fontFamily: "'DM Sans', sans-serif" }} />
                  <input type="text" placeholder="Note (optional)" value={form.note} onChange={e => handleNoteChange(e.target.value)} style={{ flex: 1, padding: '11px 14px', borderRadius: 12, background: 'var(--bg-elevated)', border: '1.5px solid var(--border)', color: 'var(--text-primary)', fontSize: 14, outline: 'none', minWidth: 0, fontFamily: "'DM Sans', sans-serif" }} onFocus={e => { (e.target as HTMLInputElement).style.borderColor = 'var(--accent)'; }} onBlur={e => { (e.target as HTMLInputElement).style.borderColor = 'var(--border)'; }} />
                </div>

                {/* Payment Method */}
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.6px' }}>Payment Method</div>
                  <PaymentMethodSelector value={form.paymentMethod} onChange={paymentMethod => setForm(f => ({ ...f, paymentMethod }))} creditCards={settings?.creditCards || []} />
                </div>

                {/* Tags */}
                <div style={{ marginBottom: 16 }}>
                  <TagSelector selectedTags={form.tags} suggestedTags={recentTags} onChange={tags => setForm(f => ({ ...f, tags }))} />
                </div>

                {/* Over-budget warning */}
                {(() => {
                  const activeTotal = categoryTotals.find(c => c._id === form.categoryId)?.total || 0;
                  const parsedAmount = parseFloat(form.amount) || 0;
                  const finalAmount = splitWays > 1 ? Math.round((parsedAmount / splitWays) * 100) / 100 : parsedAmount;
                  const budget = activeCategory?.monthlyBudget || 0;
                  const newTotal = activeTotal + finalAmount;
                  if (budget > 0 && newTotal > budget && finalAmount > 0) {
                    const overBudgetPct = ((newTotal - budget) / budget * 100).toFixed(0);
                    return (
                      <div style={{ marginBottom: 14, padding: '10px 14px', background: 'var(--danger-dim)', border: '1px solid rgba(248,113,113,0.25)', borderRadius: 12, fontSize: 13, color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
                        <span style={{ fontSize: 16 }}>⚠️</span>
                        This will put you {overBudgetPct}% over your {activeCategory?.name} budget.
                      </div>
                    );
                  }
                  return null;
                })()}

                {/* Save button */}
                <button
                  onClick={() => handleSubmit()}
                  disabled={loading || !hasAmount}
                  style={{
                    width: '100%',
                    background: hasAmount ? `linear-gradient(135deg, ${activeCategory?.color ?? 'var(--accent)'} 0%, var(--accent-2) 100%)` : 'var(--bg-elevated)',
                    color: hasAmount ? '#fff' : 'var(--text-muted)',
                    border: 'none', borderRadius: 99, padding: '17px',
                    fontSize: 16, fontWeight: 800, cursor: hasAmount ? 'pointer' : 'not-allowed',
                    display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10,
                    boxShadow: hasAmount ? `0 10px 26px -8px ${activeCategory?.color ?? 'var(--accent)'}88` : 'none',
                    transition: 'all 0.2s ease', letterSpacing: '-0.2px', fontFamily: "'DM Sans', sans-serif",
                  }}
                >
                  {loading ? <span className="spinner" /> : (
                    <>
                      ⚡ Save Expense
                      {activeCategory && <span style={{ opacity: 0.85, fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}><ChevronRight size={14} /> {activeCategory.name}</span>}
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
