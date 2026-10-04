import type { Metadata, Viewport } from 'next';
import { DM_Sans, Inter } from 'next/font/google';
import './globals.css';
import Sidebar from '@/components/Sidebar';
import BottomNav from '@/components/BottomNav';
import QuickAddSheet from '@/components/QuickAddSheet';

const dmSans = DM_Sans({
  weight: ['300', '400', '500', '600', '700', '800', '900'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-dm-sans',
});

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
    icon: [
      { url: '/icon-dark.png', media: '(prefers-color-scheme: dark)' },
      { url: '/icon-light.png', media: '(prefers-color-scheme: light)' },
    ],
    apple: '/apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  interactiveWidget: 'resizes-visual',
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F4F5F9' },
    { media: '(prefers-color-scheme: dark)', color: '#07070D' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${dmSans.variable} ${inter.variable}`} style={{ fontFamily: "'DM Sans', 'Inter', system-ui, sans-serif", backgroundColor: 'var(--bg)', color: 'var(--text-primary)', position: 'relative', minHeight: '100dvh', overflowX: 'hidden' }}>

        {/* Global Ambient Mesh — lightweight static radial gradients for buttery 120Hz scrolling */}
        <div
          aria-hidden="true"
          style={{
            position: 'fixed',
            inset: 0,
            pointerEvents: 'none',
            zIndex: 0,
            overflow: 'hidden',
            background: `
              radial-gradient(circle at 10% 0%, rgba(124, 92, 252, 0.08) 0%, transparent 45%),
              radial-gradient(circle at 90% 100%, rgba(164, 98, 245, 0.06) 0%, transparent 45%),
              radial-gradient(circle at 50% 40%, rgba(74, 222, 128, 0.03) 0%, transparent 35%)
            `,
          }}
        />

        <div className="app-layout" style={{ position: 'relative', zIndex: 1 }}>
          <Sidebar />
          <div className="main-content">
            <main>
              {children}
            </main>
          </div>
          <BottomNav />
        </div>
        <QuickAddSheet />
      </body>
    </html>
  );
}
