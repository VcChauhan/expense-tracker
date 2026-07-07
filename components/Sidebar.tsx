'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';

import { LayoutDashboard, PlusCircle, List, BarChart2, Settings, TrendingUp, LogOut, Wallet, Sparkles } from 'lucide-react';

const navItems = [
  { href: '/',         icon: <LayoutDashboard size={20} strokeWidth={1.5} />, label: 'Dashboard'   },
  { href: '/chat',     icon: <Sparkles size={20} strokeWidth={1.5} />,        label: 'AI Assistant' },
  { href: '/add',      icon: <PlusCircle size={20} strokeWidth={1.5} />,      label: 'Add Expense' },
  { href: '/expenses', icon: <List size={20} strokeWidth={1.5} />,            label: 'Expense Log' },
  { href: '/reports',  icon: <BarChart2 size={20} strokeWidth={1.5} />,       label: 'Reports'     },
];

const settingsItems = [
  { href: '/settings', icon: <Settings size={20} strokeWidth={1.5} />,        label: 'Budget Planner' },
  { href: '/hike',     icon: <TrendingUp size={20} strokeWidth={1.5} />,      label: 'Hike Planner'   },
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
        <div className="sidebar-logo-icon"><Wallet size={18} strokeWidth={2} /></div>
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
            <span className="nav-item-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{item.icon}</span>
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
            <span className="nav-item-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="sidebar-footer">
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="btn btn-danger"
          style={{ width: '100%', justifyContent: 'center' }}
        >
          {loggingOut ? '⏳ Signing out…' : <><LogOut size={16} style={{ marginRight: 6 }} /> Sign Out</>}
        </button>
      </div>
    </aside>
  );
}
