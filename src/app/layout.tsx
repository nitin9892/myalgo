import type { Metadata } from 'next';
import './globals.css';
import { Sidebar } from '@/components/Sidebar';

export const metadata: Metadata = {
  title: 'MyAlgo | Automated Trading Engine',
  description: 'Multi-Broker Algorithmic Trading Platform for Dhan, Delta Exchange, and MetaTrader 5',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-slate-950 text-slate-100 min-h-screen flex antialiased">
        <Sidebar />
        <main className="flex-1 overflow-y-auto max-h-screen p-8">
          {children}
        </main>
      </body>
    </html>
  );
}
