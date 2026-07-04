'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { href: '/', icon: '📊', label: 'Dashboard' },
  { href: '/add', icon: '➕', label: 'Add' },
  { href: '/expenses', icon: '📋', label: 'Log' },
  { href: '/reports', icon: '📈', label: 'Reports' },
  { href: '/settings', icon: '⚙️', label: 'Settings' },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="bottom-nav">
      {navItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`bottom-nav-item ${pathname === item.href ? 'active' : ''}`}
        >
          <span className="bottom-nav-icon">{item.icon}</span>
          <span className="bottom-nav-label">{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}
