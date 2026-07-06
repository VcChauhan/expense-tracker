import type { Metadata, Viewport } from 'next';
import { Roboto } from 'next/font/google';
import './globals.css';
import Sidebar from '@/components/Sidebar';
import BottomNav from '@/components/BottomNav';
import QuickAddSheet from '@/components/QuickAddSheet';

const roboto = Roboto({
  weight: ['400', '500', '700'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-roboto',
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
  themeColor: '#6366f1',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={roboto.variable}>
        <div className="app-layout">
          <Sidebar />
          <main className="main-content">
            {children}
          </main>
          <BottomNav />
          <QuickAddSheet />
        </div>
      </body>
    </html>
  );
}
