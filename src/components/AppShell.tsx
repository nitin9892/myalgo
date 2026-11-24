'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from '@/components/Sidebar';
import { AccessGuard } from '@/components/AccessGuard';
import { Menu, Activity } from 'lucide-react';

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isAdminPath = pathname.startsWith('/admin');

  if (isAdminPath) {
    return (
      <main className="min-h-screen w-full bg-slate-950 p-6 md:p-10">
        {children}
      </main>
    );
  }

  return (
    <AccessGuard>
      <div className="flex flex-col md:flex-row w-full min-h-screen bg-slate-950">
        {/* Mobile Header */}
        <header className="md:hidden flex items-center justify-between p-4 bg-slate-900 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center">
              <Activity className="w-4 h-4 text-slate-950 font-bold" />
            </div>
            <span className="font-bold text-white text-base">MyAlgo</span>
          </div>

          <button
            onClick={() => setMobileMenuOpen(true)}
            className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white"
            aria-label="Open navigation menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        </header>

        {/* Sidebar Component */}
        <Sidebar
          isOpen={mobileMenuOpen}
          onClose={() => setMobileMenuOpen(false)}
        />

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto max-h-screen p-4 sm:p-6 md:p-8">
          {children}
        </main>
      </div>
    </AccessGuard>
  );
}
