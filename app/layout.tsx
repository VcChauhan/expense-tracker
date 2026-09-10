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
  themeColor: '#07070D',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${dmSans.variable} ${inter.variable}`} style={{ fontFamily: "'DM Sans', 'Inter', system-ui, sans-serif", backgroundColor: 'var(--bg)', color: 'var(--text-primary)', position: 'relative', minHeight: '100dvh', overflowX: 'hidden' }}>

        {/* Global Ambient Mesh — animated blobs */}
        <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }}>
          <div style={{
            position: 'absolute', top: '-15%', left: '-5%',
            width: '55vw', height: '55vw',
            background: 'radial-gradient(circle, var(--accent) 0%, transparent 65%)',
            filter: 'blur(100px)', opacity: 0.09, borderRadius: '50%',
            animation: 'blob-float 18s ease-in-out infinite',
          }} />
          <div style={{
            position: 'absolute', bottom: '-20%', right: '-10%',
            width: '65vw', height: '65vw',
            background: 'radial-gradient(circle, #A462F5 0%, transparent 65%)',
            filter: 'blur(120px)', opacity: 0.07, borderRadius: '50%',
            animation: 'blob-float 24s ease-in-out infinite reverse',
            animationDelay: '-8s',
          }} />
          <div style={{
            position: 'absolute', top: '40%', left: '30%',
            width: '40vw', height: '40vw',
            background: 'radial-gradient(circle, #4ADE80 0%, transparent 65%)',
            filter: 'blur(130px)', opacity: 0.04, borderRadius: '50%',
            animation: 'blob-float 30s ease-in-out infinite',
            animationDelay: '-14s',
          }} />
        </div>

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
