'use client';

import { usePathname } from 'next/navigation';
import { Sidebar } from '@/components/Sidebar';
import { AccessGuard } from '@/components/AccessGuard';

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
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
      <div className="flex w-full min-h-screen bg-slate-950">
        <Sidebar />
        <main className="flex-1 overflow-y-auto max-h-screen p-6 md:p-8">
          {children}
        </main>
      </div>
    </AccessGuard>
  );
}
