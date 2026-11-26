import type { Metadata } from 'next';
import './globals.css';
import { AppShell } from '@/components/AppShell';
import { ModalProvider } from '@/context/ModalContext';

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
      <body className="bg-slate-950 text-slate-100 min-h-screen antialiased">
        <ModalProvider>
          <AppShell>
            {children}
          </AppShell>
        </ModalProvider>
      </body>
    </html>
  );
}
