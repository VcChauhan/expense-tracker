'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { Sparkles, Settings, TrendingUp, LogOut, Menu, X } from 'lucide-react';

export default function MobileHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  if (pathname === '/login') return null;

  async function handleLogout() {
    setLoggingOut(true);
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  return (
    <>
      <header className="mobile-header hide-on-desktop" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 20px', background: 'var(--nav-bg)',
        backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
        borderBottom: '1px solid var(--border)',
        position: 'sticky', top: 0, zIndex: 100
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, background: 'linear-gradient(135deg, var(--accent) 0%, #B06FFF 100%)',
            borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff'
          }}>
            <Sparkles size={16} strokeWidth={2.5} style={{ margin: 'auto' }} />
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>
            ExpenseIQ
          </div>
        </div>
        
        <button onClick={() => setMenuOpen(true)} style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer' }}>
          <Menu size={24} />
        </button>
      </header>

      {/* Mobile Menu Overlay */}
      {menuOpen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(8px)', display: 'flex', flexDirection: 'column',
          justifyContent: 'flex-end', animation: 'fadeIn 0.2s ease-out'
        }} onClick={() => setMenuOpen(false)}>
          <div style={{
            background: 'var(--bg-card)', padding: '24px 20px 40px',
            borderTopLeftRadius: 24, borderTopRightRadius: 24,
            animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Menu</h2>
              <button onClick={() => setMenuOpen(false)} style={{ background: 'var(--bg-elevated)', border: 'none', color: 'var(--text-secondary)', width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Link href="/settings" onClick={() => setMenuOpen(false)} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '16px', borderRadius: 16,
                background: pathname === '/settings' ? 'var(--accent-dim)' : 'var(--bg-elevated)',
                color: pathname === '/settings' ? 'var(--accent-light)' : 'var(--text-primary)',
                textDecoration: 'none', fontWeight: 600, fontSize: 16
              }}>
                <Settings size={20} />
                Budget Planner
              </Link>
              <Link href="/hike" onClick={() => setMenuOpen(false)} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '16px', borderRadius: 16,
                background: pathname === '/hike' ? 'var(--accent-dim)' : 'var(--bg-elevated)',
                color: pathname === '/hike' ? 'var(--accent-light)' : 'var(--text-primary)',
                textDecoration: 'none', fontWeight: 600, fontSize: 16
              }}>
                <TrendingUp size={20} />
                Hike Planner
              </Link>
            </div>
            
            <div style={{ height: 1, background: 'var(--border)', margin: '24px 0' }} />
            
            <button onClick={handleLogout} disabled={loggingOut} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '16px', borderRadius: 16, width: '100%',
              background: 'var(--danger-dim)', border: 'none', color: 'var(--danger)',
              fontWeight: 600, fontSize: 16, cursor: 'pointer'
            }}>
              <LogOut size={20} />
              {loggingOut ? 'Signing out...' : 'Sign Out'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
