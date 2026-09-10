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
    { href: '/', icon: <LayoutDashboard size={20} strokeWidth={2} />, label: 'Home' },
    { href: '/expenses', icon: <List size={20} strokeWidth={2} />, label: 'Log' },
    { isFab: true },
    { href: '/reports', icon: <BarChart2 size={20} strokeWidth={2} />, label: 'Reports' },
    { isMenu: true, icon: <Menu size={20} strokeWidth={2} />, label: 'More' }
  ];

  const menuLinks = [
    { href: '/insights', icon: <Lightbulb size={20} />, label: 'AI Insights', color: '#FBBF24' },
    { href: '/settings', icon: <Settings size={20} />, label: 'Settings', color: 'var(--accent-2)' },
    { href: '/hike', icon: <TrendingUp size={20} />, label: 'Hike Planner', color: 'var(--success)' },
  ];

  if (pathname === '/login') return null;

  return (
    <>
      <nav className="bottom-nav hide-on-desktop" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {navItems.map((item, idx) => {
          if (item.isFab) {
            return (
              <div key="fab" style={{ flex: 1, display: 'flex', justifyContent: 'center', position: 'relative', pointerEvents: 'none' }}>
                <button
                  onClick={triggerQuickAdd}
                  style={{
                    pointerEvents: 'auto',
                    position: 'absolute',
                    top: -22,
                    width: 60,
                    height: 60,
                    borderRadius: '50%',
                    background: 'var(--accent-grad)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '3px solid var(--bg)',
                    boxShadow: '0 6px 28px rgba(124,92,252,0.55), 0 2px 8px rgba(0,0,0,0.3)',
                    cursor: 'pointer',
                    transition: 'all 0.18s cubic-bezier(0.34, 1.56, 0.64, 1)',
                  }}
                  onMouseDown={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.88)'; }}
                  onMouseUp={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                  onTouchStart={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.88)'; }}
                  onTouchEnd={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                >
                  <Plus size={26} strokeWidth={2.8} />
                </button>
              </div>
            );
          }

          if (item.isMenu) {
            return (
              <button
                key="menu"
                onClick={() => setMenuOpen(true)}
                className="bottom-nav-item"
                style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
              >
                <div className="bottom-nav-icon-wrapper">
                  <span className="bottom-nav-icon">{item.icon}</span>
                </div>
                <span className="bottom-nav-label">{item.label}</span>
              </button>
            );
          }

          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href!}
              className={`bottom-nav-item ${isActive ? 'active' : ''}`}
            >
              <div className="bottom-nav-icon-wrapper">
                <span className="bottom-nav-icon" style={{ color: isActive ? 'var(--accent-2)' : 'var(--text-muted)' }}>
                  {item.icon}
                </span>
              </div>
              <span className="bottom-nav-label" style={{ color: isActive ? 'var(--accent-2)' : 'var(--text-muted)' }}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Mobile Menu Overlay */}
      {menuOpen && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 999,
            background: 'rgba(0,0,0,0.55)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            display: 'flex', flexDirection: 'column',
            justifyContent: 'flex-end',
            animation: 'fadeIn 0.2s ease-out',
          }}
          onClick={() => setMenuOpen(false)}
        >
          <div
            style={{
              background: 'var(--bg-card)',
              padding: '8px 16px 32px',
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              animation: 'slide-up-fast 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
              border: '1px solid var(--border)',
              borderBottom: 'none',
              paddingBottom: 'calc(32px + env(safe-area-inset-bottom))',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Drag Handle */}
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border-strong)', margin: '12px auto 20px auto' }} />

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.4px' }}>More Options</h2>
              <button
                onClick={() => setMenuOpen(false)}
                style={{
                  background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                  color: 'var(--text-secondary)', width: 32, height: 32,
                  borderRadius: '50%', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', cursor: 'pointer',
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Menu Items */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {menuLinks.map(link => {
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMenuOpen(false)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 14,
                      padding: '14px 16px', borderRadius: 16,
                      background: isActive ? 'var(--accent-dim)' : 'var(--bg-elevated)',
                      border: `1px solid ${isActive ? 'var(--border-glow)' : 'transparent'}`,
                      color: isActive ? 'var(--accent-2)' : 'var(--text-primary)',
                      textDecoration: 'none', fontWeight: 700, fontSize: 15,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{
                      width: 36, height: 36, borderRadius: 10,
                      background: isActive ? 'var(--accent-dim)' : `${link.color}18`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: isActive ? 'var(--accent-2)' : link.color,
                      flexShrink: 0,
                    }}>
                      {link.icon}
                    </div>
                    {link.label}
                  </Link>
                );
              })}
            </div>

            <div style={{ height: 1, background: 'var(--border)', margin: '20px 0' }} />

            <button
              onClick={handleLogout}
              disabled={loggingOut}
              style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '14px 16px', borderRadius: 16, width: '100%',
                background: 'var(--danger-dim)',
                border: '1px solid rgba(248,113,113,0.15)',
                color: 'var(--danger)',
                fontWeight: 700, fontSize: 15, cursor: 'pointer',
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: 'rgba(248,113,113,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <LogOut size={20} />
              </div>
              {loggingOut ? 'Signing out...' : 'Sign Out'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
