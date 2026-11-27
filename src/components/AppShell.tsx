'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from '@/components/Sidebar';
import { AccessGuard } from '@/components/AccessGuard';
import { Menu, Activity, AlertOctagon, Sun, Moon, LogOut } from 'lucide-react';
import Link from 'next/link';
import { useModal } from '@/context/ModalContext';
import { useTheme } from '@/context/ThemeContext';

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [killSwitchActive, setKillSwitchActive] = useState(false);
  const isAdminPath = pathname.startsWith('/admin');
  const { showConfirm, showAlert } = useModal();
  const { theme, toggleTheme } = useTheme();

  const handleSignOut = async () => {
    const confirmed = await showConfirm({
      title: 'Sign Out / Switch Access Code',
      message: 'Are you sure you want to sign out? You will be prompted to enter an access code to re-open the terminal.',
      type: 'warning',
      confirmText: 'Sign Out',
    });
    if (!confirmed) return;

    localStorage.removeItem('myalgo_access_token');
    document.cookie = 'myalgo_access_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
    window.location.reload();
  };

  useEffect(() => {
    const checkKill = () => {
      try {
        const item = localStorage.getItem('myalgo_kill_switch');
        if (item) {
          const parsed = JSON.parse(item);
          setKillSwitchActive(!!parsed.active);
        } else {
          setKillSwitchActive(false);
        }
      } catch {}
    };

    checkKill();
    window.addEventListener('storage', checkKill);
    const interval = setInterval(checkKill, 3000);
    return () => {
      window.removeEventListener('storage', checkKill);
      clearInterval(interval);
    };
  }, []);

  const handleResetKillSwitch = async () => {
    const confirmed = await showConfirm({
      title: 'Disarm Kill Switch',
      message: 'Are you sure you want to disarm the Kill Switch and resume normal trading?',
      type: 'warning',
      confirmText: 'Disarm Kill Switch',
    });
    if (!confirmed) return;
    try {
      localStorage.removeItem('myalgo_kill_switch');
    } catch {}
    setKillSwitchActive(false);
    try {
      await fetch('/api/risk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resetKillSwitch: true }),
      });
      await showAlert({
        title: 'Kill Switch Disarmed',
        message: 'Normal trading has resumed successfully.',
        type: 'success',
      });
      window.location.reload();
    } catch {}
  };

  if (isAdminPath) {
    return (
      <main className="min-h-screen w-full bg-slate-950 p-4 sm:p-6 md:p-10">
        {children}
      </main>
    );
  }

  return (
    <AccessGuard>
      <div className="flex flex-col md:flex-row w-full min-h-screen bg-slate-950 text-slate-100">
        {/* Mobile Header */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-800 shrink-0 sticky top-0 z-30 shadow-md">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow">
              <Activity className="w-4 h-4 text-slate-950 font-bold" />
            </div>
            <div>
              <span className="font-bold text-white text-base">MyAlgo</span>
              <span className="text-[10px] text-emerald-400 block -mt-1 font-medium">Auto Engine</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {killSwitchActive && (
              <button
                onClick={handleResetKillSwitch}
                className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-rose-500 text-white flex items-center gap-1 animate-pulse shadow"
              >
                <AlertOctagon className="w-3 h-3 text-white" />
                KILL SWITCH
              </button>
            )}

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl bg-slate-800/80 text-slate-300 hover:text-white"
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-cyan-400" />}
            </button>

            {/* Sign Out Button */}
            <button
              onClick={handleSignOut}
              className="p-2 rounded-xl bg-slate-800/80 text-slate-300 hover:text-rose-400"
              title="Sign Out / Switch Access Code"
            >
              <LogOut className="w-4 h-4" />
            </button>

            <button
              onClick={() => setMobileMenuOpen(true)}
              className="p-2.5 rounded-xl bg-slate-800/80 text-slate-300 hover:text-white active:bg-slate-700 transition-colors"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Sidebar Component */}
        <Sidebar
          isOpen={mobileMenuOpen}
          onClose={() => setMobileMenuOpen(false)}
        />

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto max-h-screen p-3.5 sm:p-6 md:p-8">
          {children}
        </main>
      </div>
    </AccessGuard>
  );
}
