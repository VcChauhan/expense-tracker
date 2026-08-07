'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { LayoutDashboard, List, Plus, BarChart2, Lightbulb, Settings, TrendingUp, LogOut, MoreHorizontal } from 'lucide-react';

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const triggerQuickAdd = () => {
    window.dispatchEvent(new Event('open-quick-add'));
  };

  const navItems = [
    { href: '/', icon: <LayoutDashboard size={24} strokeWidth={1.5} />, label: 'Home' },
    { href: '/expenses', icon: <List size={24} strokeWidth={1.5} />, label: 'Log' },
    { isFab: true },
    { href: '/reports', icon: <BarChart2 size={24} strokeWidth={1.5} />, label: 'Reports' },
    { href: '/insights', icon: <Lightbulb size={24} strokeWidth={1.5} />, label: 'Insights' }
  ];

  return (
    <>
      <nav className="bottom-nav" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {navItems.map((item, idx) => {
          if (item.isFab) {
            return (
              <div key="fab" className="bottom-nav-item" style={{ flex: 1, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
                <button onClick={triggerQuickAdd} className="fab-button" style={{ pointerEvents: 'auto' }}>
                  <Plus size={28} strokeWidth={2} />
                </button>
              </div>
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
                <span className="bottom-nav-icon">{item.icon}</span>
              </div>
              <span className="bottom-nav-label" style={{ opacity: isActive ? 1 : 0.7 }}>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
