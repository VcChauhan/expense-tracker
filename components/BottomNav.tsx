'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';

const mainItems = [
  { href: '/',         icon: '📊', label: 'Home'    },
  { href: '/add',      icon: '➕', label: 'Add'     },
  { href: '/expenses', icon: '📋', label: 'Log'     },
  { href: '/reports',  icon: '📈', label: 'Reports' },
];

const planItems = [
  { href: '/settings', icon: '⚙️', label: 'Budget Planner' },
  { href: '/hike',     icon: '💹', label: 'Hike Planner'   },
];

export default function BottomNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const isPlanActive = planItems.some(i => pathname === i.href);

  // Close when clicking or touching outside
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent | TouchEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [open]);

  return (
    <>
      <nav className="bottom-nav">
        {mainItems.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className={`bottom-nav-item ${pathname === item.href ? 'active' : ''}`}
            onClick={() => setOpen(false)}
          >
            <span className="bottom-nav-icon">{item.icon}</span>
            <span className="bottom-nav-label">{item.label}</span>
          </Link>
        ))}

        {/* Plan button — opens popup */}
        <div ref={ref} style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <button
            onClick={() => setOpen(v => !v)}
            className={`bottom-nav-item ${isPlanActive ? 'active' : ''}`}
            style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            <span className="bottom-nav-icon" style={{ fontSize: 18 }}>
              {isPlanActive
                ? (pathname === '/hike' ? '💹' : '⚙️')
                : '⚙️'}
            </span>
            <span className="bottom-nav-label">Plan</span>
          </button>

          {/* Popup menu — anchored to RIGHT edge of button so it never overflows */}
          {open && (
            <div style={{
              position: 'absolute',
              bottom: 'calc(100% + 12px)',
              right: 0,               /* flush with right edge of button */
              background: 'var(--bg-card)',
              border: '1px solid var(--border-light)',
              borderRadius: 'var(--radius-md)',
              boxShadow: '0 -8px 32px rgba(0,0,0,0.4)',
              width: 210,
              overflow: 'hidden',
              zIndex: 300,
            }}>
              <div style={{ padding: '8px 14px 6px', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Plan
              </div>
              {planItems.map(item => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 16px', textDecoration: 'none',
                    color: pathname === item.href ? 'var(--accent-primary)' : 'var(--text-primary)',
                    background: pathname === item.href ? 'rgba(99,102,241,0.1)' : 'transparent',
                    fontSize: 14, fontWeight: 500,
                    borderBottom: '1px solid var(--border)',
                    WebkitTapHighlightColor: 'transparent',
                  }}
                >
                  <span style={{ fontSize: 20 }}>{item.icon}</span>
                  {item.label}
                </Link>
              ))}
            </div>
          )}
        </div>
      </nav>
    </>
  );
}
