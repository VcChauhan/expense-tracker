'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';

import { LayoutDashboard, PlusCircle, List, BarChart2, Settings, TrendingUp, Sparkles } from 'lucide-react';

const mainItems = [
  { href: '/',         icon: <LayoutDashboard size={24} strokeWidth={1.5} />, label: 'Home'    },
  { href: '/add',      icon: <PlusCircle size={24} strokeWidth={1.5} />,      label: 'Add'     },
  { href: '/chat',     icon: <Sparkles size={24} strokeWidth={1.5} />,        label: 'AI'      },
  { href: '/expenses', icon: <List size={24} strokeWidth={1.5} />,            label: 'Log'     },
  { href: '/reports',  icon: <BarChart2 size={24} strokeWidth={1.5} />,       label: 'Reports' },
];

const planItems = [
  { href: '/settings', icon: <Settings size={24} strokeWidth={1.5} />,        label: 'Planner' },
  { href: '/hike',     icon: <TrendingUp size={24} strokeWidth={1.5} />,      label: 'Hikes'   },
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
            <div className="bottom-nav-icon-wrapper">
              <span className="bottom-nav-icon" style={{ display: 'flex', alignItems: 'center' }}>{item.icon}</span>
            </div>
          </Link>
        ))}

        {/* Plan button — opens popup */}
        <div ref={ref} style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <button
            onClick={() => setOpen(v => !v)}
            className={`bottom-nav-item ${isPlanActive ? 'active' : ''}`}
            style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            <div className="bottom-nav-icon-wrapper">
              <span className="bottom-nav-icon" style={{ display: 'flex', alignItems: 'center' }}>
                {isPlanActive ? (pathname === '/hike' ? <TrendingUp size={24} strokeWidth={1.5} /> : <Settings size={24} strokeWidth={1.5} />) : <Settings size={24} strokeWidth={1.5} />}
              </span>
            </div>
          </button>

          {/* Popup menu — anchored to RIGHT edge of button */}
          {open && (
            <div style={{
              position: 'absolute',
              bottom: 'calc(100% + 16px)',
              right: 0,
              background: 'var(--md-sys-color-surface-container-high)',
              borderRadius: 'var(--shape-large)',
              boxShadow: 'var(--elevation-3)',
              width: 180,
              overflow: 'hidden',
              zIndex: 300,
            }}>
              <div style={{ padding: '12px 16px 8px', fontSize: 12, fontWeight: 500, color: 'var(--md-sys-color-on-surface-variant)' }}>
                Plan
              </div>
              {planItems.map(item => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 16,
                    padding: '12px 16px', textDecoration: 'none',
                    color: pathname === item.href ? 'var(--md-sys-color-on-secondary-container)' : 'var(--md-sys-color-on-surface)',
                    background: pathname === item.href ? 'var(--md-sys-color-secondary-container)' : 'transparent',
                    fontSize: 14, fontWeight: 500,
                  }}
                >
                  <span style={{ fontSize: 20, display: 'flex', alignItems: 'center' }}>{item.icon}</span>
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
