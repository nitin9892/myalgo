import type { Metadata } from 'next';
import './globals.css';
import { AppShell } from '@/components/AppShell';
import { ModalProvider } from '@/context/ModalContext';
import { ThemeProvider } from '@/context/ThemeContext';

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
      <body className="bg-slate-950 text-slate-100 min-h-screen antialiased transition-colors duration-200">
        <ThemeProvider>
          <ModalProvider>
            <AppShell>
              {children}
            </AppShell>
          </ModalProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
