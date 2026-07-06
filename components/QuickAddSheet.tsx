'use client';

import { useState, useEffect, useRef } from 'react';
import { Settings } from '@/lib/types';
import { useRouter, usePathname } from 'next/navigation';

export default function QuickAddSheet() {
  const router = useRouter();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<Settings | null>(null);
  
  const today = new Date().toISOString().split('T')[0];
  const [form, setForm] = useState({ date: today, categoryId: '', amount: '', note: '' });
  const dialogRef = useRef<HTMLDialogElement>(null);

  // If on the /add page, hide the FAB because they are already there
  const isAddPage = pathname === '/add';

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(s => {
      setSettings(s);
      if (s.categories?.length) setForm(f => ({ ...f, categoryId: s.categories[0].id }));
    });
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      dialog.showModal();
    } else {
      dialog.close();
    }
  }, [isOpen]);

  // Handle light dismiss
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

    dialog.addEventListener('cancel', handleCancel);
    dialog.addEventListener('click', handleClick);
    return () => {
      dialog.removeEventListener('cancel', handleCancel);
      dialog.removeEventListener('click', handleClick);
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.amount || parseFloat(form.amount) <= 0) return;
    setLoading(true);
    try {
      await fetch('/api/expenses', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, amount: parseFloat(form.amount) }),
      });
      setForm({ date: today, categoryId: settings?.categories[0]?.id ?? '', amount: '', note: '' });
      setIsOpen(false);
      // Trigger a soft refresh to update current page data
      router.refresh();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  if (isAddPage) return null;

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="fab"
        style={{
          position: 'fixed',
          bottom: '100px', // Above bottom nav
          right: '24px',
        }}
      >
        +
      </button>

      <dialog 
        ref={dialogRef}
        style={{
          margin: 'auto auto 0 auto',
          width: '100%',
          maxWidth: '500px',
          border: 'none',
          borderRadius: '28px 28px 0 0',
          background: 'var(--md-sys-color-surface-container-low)',
          padding: '24px',
          color: 'var(--md-sys-color-on-surface)',
          boxShadow: 'var(--elevation-5)',
        }}
      >
        {/* M3 Drag Handle (visual only) */}
        <div style={{ width: 32, height: 4, borderRadius: 2, background: 'var(--md-sys-color-outline-variant)', margin: '0 auto 24px auto' }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 22, fontWeight: 400, margin: 0, color: 'var(--md-sys-color-on-surface)' }}>Quick Add</h2>
          <button 
            type="button"
            onClick={() => setIsOpen(false)}
            style={{ background: 'transparent', border: 'none', color: 'var(--md-sys-color-on-surface-variant)', fontSize: 24, cursor: 'pointer' }}
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
            <div className="form-group" style={{ margin: 0, flex: 1 }}>
              <input type="number" step="0.01" className="form-input" style={{ fontSize: 24, fontWeight: 700, padding: '16px' }}
                placeholder="₹ 0.00" value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} required autoFocus />
            </div>
          </div>
          
          <div className="form-group" style={{ marginBottom: 16 }}>
            <select className="form-select"
              value={form.categoryId}
              onChange={e => setForm(f => ({ ...f, categoryId: e.target.value }))} required>
              {(settings?.categories ?? []).map(cat => (
                <option key={cat.id} value={cat.id}>{cat.emoji} {cat.name}</option>
              ))}
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 24 }}>
            <input type="text" className="form-input"
              placeholder="Note (optional)" value={form.note}
              onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '14px' }} disabled={loading}>
            {loading ? <span className="spinner" style={{ width: 16, height: 16 }} /> : 'Add Expense'}
          </button>
        </form>
      </dialog>
    </>
  );
}
