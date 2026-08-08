'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { LayoutDashboard, List, Plus, BarChart2, Lightbulb, Settings, TrendingUp, LogOut, Menu, X } from 'lucide-react';

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const triggerQuickAdd = () => {
    window.dispatchEvent(new Event('open-quick-add'));
  };

  async function handleLogout() {
    setLoggingOut(true);
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  const navItems = [
    { href: '/', icon: <LayoutDashboard size={22} strokeWidth={1.8} />, label: 'Home' },
    { href: '/expenses', icon: <List size={22} strokeWidth={1.8} />, label: 'Log' },
    { isFab: true },
    { href: '/reports', icon: <BarChart2 size={22} strokeWidth={1.8} />, label: 'Reports' },
    { isMenu: true, icon: <Menu size={22} strokeWidth={1.8} />, label: 'Menu' }
  ];

  return (
    <>
      <nav className="bottom-nav hide-on-desktop" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {navItems.map((item, idx) => {
          if (item.isFab) {
            return (
              <div key="fab" className="bottom-nav-item" style={{ flex: 1, display: 'flex', justifyContent: 'center', pointerEvents: 'none', position: 'relative' }}>
                <button 
                  onClick={triggerQuickAdd} 
                  style={{ 
                    pointerEvents: 'auto',
                    position: 'absolute',
                    top: -20,
                    width: 56,
                    height: 56,
                    borderRadius: '50%',
                    background: 'var(--accent)',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: 'none',
                    boxShadow: '0 8px 24px rgba(139, 124, 246, 0.4)',
                    cursor: 'pointer'
                  }}
                >
                  <Plus size={28} strokeWidth={2.5} />
                </button>
              </div>
            );
          }

          if (item.isMenu) {
            return (
              <button
                key="menu"
                onClick={() => setMenuOpen(true)}
                className={`bottom-nav-item`}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
              >
                <div className="bottom-nav-icon-wrapper">
                  <span className="bottom-nav-icon">{item.icon}</span>
                </div>
                <span className="bottom-nav-label" style={{ opacity: 0.7 }}>{item.label}</span>
              </button>
            )
          }

          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href!}
              className={`bottom-nav-item ${isActive ? 'active' : ''}`}
              style={{ background: isActive ? 'transparent' : 'transparent', border: 'none' }} // Remove weird active borders if any
            >
              <div className="bottom-nav-icon-wrapper">
                <span className="bottom-nav-icon" style={{ color: isActive ? 'var(--accent)' : 'var(--text-secondary)' }}>{item.icon}</span>
              </div>
              <span className="bottom-nav-label" style={{ opacity: isActive ? 1 : 0.7, color: isActive ? 'var(--accent)' : 'var(--text-secondary)' }}>{item.label}</span>
            </Link>
          );
        })}
      </nav>

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
              <Link href="/insights" onClick={() => setMenuOpen(false)} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '16px', borderRadius: 16,
                background: pathname === '/insights' ? 'var(--accent-dim)' : 'var(--bg-elevated)',
                color: pathname === '/insights' ? 'var(--accent)' : 'var(--text-primary)',
                textDecoration: 'none', fontWeight: 600, fontSize: 16
              }}>
                <Lightbulb size={20} />
                AI Insights
              </Link>
              <Link href="/settings" onClick={() => setMenuOpen(false)} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '16px', borderRadius: 16,
                background: pathname === '/settings' ? 'var(--accent-dim)' : 'var(--bg-elevated)',
                color: pathname === '/settings' ? 'var(--accent)' : 'var(--text-primary)',
                textDecoration: 'none', fontWeight: 600, fontSize: 16
              }}>
                <Settings size={20} />
                Settings
              </Link>
              <Link href="/hike" onClick={() => setMenuOpen(false)} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '16px', borderRadius: 16,
                background: pathname === '/hike' ? 'var(--accent-dim)' : 'var(--bg-elevated)',
                color: pathname === '/hike' ? 'var(--accent)' : 'var(--text-primary)',
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
