'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { href: '/', icon: '📊', label: 'Dashboard' },
  { href: '/add', icon: '➕', label: 'Add Expense' },
  { href: '/expenses', icon: '📋', label: 'Expense Log' },
  { href: '/reports', icon: '📈', label: 'Reports' },
];

const settingsItems = [
  { href: '/settings', icon: '⚙️', label: 'Budget Planner' },
];

export default function Sidebar() {
  const pathname = usePathname();

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
        Personal use only
      </div>
    </aside>
  );
}
