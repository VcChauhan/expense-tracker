import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Sidebar from '@/components/Sidebar';
import BottomNav from '@/components/BottomNav';
import QuickAddSheet from '@/components/QuickAddSheet';

const inter = Inter({
  weight: ['300', '400', '500', '600', '700', '800', '900'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'ExpenseIQ — Personal Finance Tracker',
  description: 'Track your daily expenses, manage budgets by category, and visualize your spending trends monthly and annually.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'ExpenseIQ',
  },
  icons: {
    apple: '/icons/apple-touch-icon.png',
    icon:  '/icons/icon-192.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  themeColor: '#0A0A0F',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.variable} style={{ fontFamily: "'Inter', system-ui, sans-serif", backgroundColor: 'var(--bg)', color: 'var(--text-primary)', position: 'relative', minHeight: '100vh', overflowX: 'hidden' }}>
        
        {/* Global Ambient Glow (Mesh Gradient) */}
        <div style={{ position: 'fixed', top: '-20%', left: '-10%', width: '60vw', height: '60vw', background: 'var(--accent)', filter: 'blur(140px)', opacity: 0.12, borderRadius: '50%', pointerEvents: 'none', zIndex: 0 }} />
        <div style={{ position: 'fixed', bottom: '-20%', right: '-10%', width: '70vw', height: '70vw', background: '#A594FF', filter: 'blur(160px)', opacity: 0.08, borderRadius: '50%', pointerEvents: 'none', zIndex: 0 }} />

        <div className="app-layout" style={{ position: 'relative', zIndex: 1 }}>
          <Sidebar />
          <div className="main-content">
            <main>
              {children}
            </main>
          </div>
          <BottomNav />
          <QuickAddSheet />
        </div>
      </body>
    </html>
  );
}
