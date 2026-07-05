'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';

const navItems = [
  { href: '/',         icon: '📊', label: 'Dashboard'   },
  { href: '/add',      icon: '➕', label: 'Add Expense' },
  { href: '/expenses', icon: '📋', label: 'Expense Log' },
  { href: '/reports',  icon: '📈', label: 'Reports'     },
];

const settingsItems = [
  { href: '/settings', icon: '⚙️', label: 'Budget Planner' },
  { href: '/hike',     icon: '💹', label: 'Hike Planner'   },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router   = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">💰</div>
        <div>
          <div className="sidebar-logo-text">ExpenseIQ</div>
          <div className="sidebar-logo-sub">Finance Tracker</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        <span className="sidebar-section-label">Main</span>
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`nav-item ${pathname === item.href ? 'active' : ''}`}
          >
            <span className="nav-item-icon">{item.icon}</span>
            {item.label}
          </Link>
        ))}

        <span className="sidebar-section-label">Configure</span>
        {settingsItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`nav-item ${pathname === item.href ? 'active' : ''}`}
          >
            <span className="nav-item-icon">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="sidebar-footer">
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, width: '100%',
            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
            borderRadius: 'var(--radius-sm)', padding: '8px 12px',
            color: 'var(--danger)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            transition: 'all 0.15s',
          }}
        >
          {loggingOut ? '⏳' : '🚪'} {loggingOut ? 'Signing out…' : 'Sign Out'}
        </button>
      </div>
    </aside>
  );
}
