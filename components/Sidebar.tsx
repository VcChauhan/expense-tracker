'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { LayoutDashboard, PlusCircle, List, BarChart2, Settings, TrendingUp, LogOut, Sparkles, Lightbulb } from 'lucide-react';

const navItems = [
  { href: '/',         icon: <LayoutDashboard size={18} strokeWidth={1.8} />, label: 'Dashboard'   },
  { action: 'add',     icon: <PlusCircle size={18} strokeWidth={1.8} />,      label: 'Add Expense' },
  { href: '/expenses', icon: <List size={18} strokeWidth={1.8} />,            label: 'Expense Log' },
  { href: '/reports',  icon: <BarChart2 size={18} strokeWidth={1.8} />,       label: 'Reports'     },
  { href: '/insights', icon: <Lightbulb size={18} strokeWidth={1.8} />,       label: 'Insights'    },
];

const settingsItems = [
  { href: '/settings', icon: <Settings size={18} strokeWidth={1.8} />,        label: 'Settings' },
  { href: '/hike',     icon: <TrendingUp size={18} strokeWidth={1.8} />,      label: 'Hike Planner'   },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router   = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  if (pathname === '/login') return null;

  async function handleLogout() {
    setLoggingOut(true);
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">
          <Sparkles size={18} strokeWidth={2.5} />
        </div>
        <div>
          <div className="sidebar-logo-text" style={{ background: 'linear-gradient(135deg, var(--accent) 0%, #A594FF 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>ExpenseIQ</div>
          <div className="sidebar-logo-sub">Finance Tracker</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        <span className="sidebar-section-label">Main</span>
        {navItems.map((item) => {
          if (item.action === 'add') {
            return (
              <button
                key={item.label}
                onClick={() => window.dispatchEvent(new Event('open-quick-add'))}
                className="nav-item"
                style={{ background: 'transparent', border: 'none', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'inherit', width: '100%' }}
              >
                <span className="nav-item-icon">{item.icon}</span>
                {item.label}
              </button>
            );
          }
          return (
            <Link
              key={item.href}
              href={item.href!}
              className={`nav-item ${pathname === item.href ? 'active' : ''}`}
            >
              <span className="nav-item-icon">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}

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
          className="btn btn-outline btn-sm"
          style={{ width: '100%', justifyContent: 'center' }}
        >
          {loggingOut ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Signing out…</> : <><LogOut size={14} /> Sign Out</>}
        </button>
      </div>
    </aside>
  );
}
