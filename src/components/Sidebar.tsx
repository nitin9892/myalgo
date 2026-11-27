'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Cpu, 
  Wallet, 
  Terminal, 
  Activity, 
  Lock, 
  ShieldCheck, 
  ShieldAlert,
  X,
  AlertOctagon,
  PlayCircle,
  History,
  BarChart2,
  Sun,
  Moon,
  LogOut
} from 'lucide-react';
import { useModal } from '@/context/ModalContext';
import { useTheme } from '@/context/ThemeContext';

const navItems = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Live Chart', href: '/chart', icon: BarChart2 },
  { name: 'Backtesting', href: '/backtest', icon: History },
  { name: 'Forward Testing', href: '/forward-test', icon: PlayCircle },
  { name: 'Brokers & APIs', href: '/brokers', icon: Wallet },
  { name: 'Logs & Audit', href: '/logs', icon: Terminal },
];

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const [killSwitchActive, setKillSwitchActive] = useState(false);
  const { showConfirm, showAlert } = useModal();
  const { theme, toggleTheme } = useTheme();

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

  const handleLockTerminal = () => {
    localStorage.removeItem('myalgo_access_token');
    document.cookie = 'myalgo_access_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
    window.location.reload();
  };

  const handleTriggerKillSwitch = async () => {
    const confirmed = await showConfirm({
      title: 'EMERGENCY KILL SWITCH',
      message: 'Immediately close all open trades, square off all positions across all brokers, and freeze trading engine?',
      type: 'danger',
      confirmText: 'TRIGGER KILL SWITCH',
    });
    if (!confirmed) return;

    const reason = 'Manual emergency kill switch triggered by user';
    try {
      localStorage.setItem('myalgo_kill_switch', JSON.stringify({ active: true, reason, timestamp: Date.now() }));
    } catch {}
    setKillSwitchActive(true);
    try {
      await fetch('/api/risk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ triggerEmergencyKill: true }),
      });
      await showAlert({
        title: 'Kill Switch Activated',
        message: 'All positions squared off & trading halted immediately.',
        type: 'danger',
      });
      window.location.reload();
    } catch {}
  };

  const handleResetKillSwitch = async () => {
    const confirmed = await showConfirm({
      title: 'Disarm Kill Switch',
      message: 'Are you sure you want to disarm the Kill Switch and resume normal algorithmic trading?',
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
        message: 'Normal algorithmic trading has been resumed.',
        type: 'success',
      });
      window.location.reload();
    } catch {}
  };

  const content = (
    <div className="flex flex-col justify-between h-full p-4">
      <div>
        {/* Brand / Logo */}
        <div className="flex items-center justify-between px-2 py-4 mb-5 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Activity className="w-5 h-5 text-slate-950 font-bold" />
            </div>
            <div>
              <h1 className="font-bold text-lg text-white tracking-wide">MyAlgo</h1>
              <p className="text-xs text-emerald-400 font-medium flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                Live Crypto Engine
              </p>
            </div>
          </div>
          {onClose && (
            <button 
              onClick={onClose} 
              className="md:hidden text-slate-400 hover:text-white p-2 rounded-lg bg-slate-800/60"
              aria-label="Close navigation"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Navigation Links (No Risk page link) */}
        <nav className="space-y-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={onClose}
                className={`flex items-center gap-3 px-3.5 py-3 sm:py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  isActive
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-sm shadow-emerald-500/10'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 active:bg-slate-800'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer Controls, Theme Toggle & Sign Out */}
      <div className="pt-4 border-t border-slate-800 text-xs text-slate-500 space-y-2.5 px-1">
        {/* Theme Switcher Button */}
        <button
          onClick={toggleTheme}
          className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-slate-950/80 hover:bg-slate-800/80 text-slate-300 hover:text-white border border-slate-800 transition-all text-xs font-semibold"
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          <div className="flex items-center gap-2">
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-cyan-400" />
            )}
            <span>{theme === 'dark' ? 'Light Theme' : 'Dark Theme'}</span>
          </div>
          <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400 font-bold">
            {theme}
          </span>
        </button>

        {/* Sign Out Button (Switch Access Code) */}
        <button
          onClick={handleSignOut}
          className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-slate-950/80 hover:bg-rose-500/15 text-slate-300 hover:text-rose-300 border border-slate-800 hover:border-rose-500/30 transition-all text-xs font-semibold group"
          title="Sign out of current access code"
        >
          <div className="flex items-center gap-2">
            <LogOut className="w-4 h-4 text-slate-400 group-hover:text-rose-400 transition-colors" />
            <span>Sign Out</span>
          </div>
          <span className="text-[10px] text-slate-500 group-hover:text-rose-400 font-mono transition-colors">
            Switch Code &rarr;
          </span>
        </button>

        <div className="flex items-center justify-between text-slate-400 pt-1">
          <Link 
            href="/admin" 
            onClick={onClose}
            className="flex items-center gap-1.5 text-cyan-400 hover:underline font-semibold py-0.5 text-[11px]"
          >
            <ShieldCheck className="w-3.5 h-3.5" /> Admin Portal
          </Link>
          <button
            onClick={handleLockTerminal}
            className="flex items-center gap-1 text-slate-500 hover:text-rose-400 transition-colors font-medium py-0.5 text-[11px]"
            title="Lock Terminal"
          >
            <Lock className="w-3 h-3" /> Lock
          </button>
        </div>

        {/* Emergency Kill Switch Control Shifted to Sidebar Footer */}
        {killSwitchActive ? (
          <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-500/60 space-y-2">
            <div className="flex items-center justify-between text-[11px] text-rose-300">
              <span className="font-bold flex items-center gap-1.5">
                <AlertOctagon className="w-3.5 h-3.5 text-rose-400 animate-bounce" />
                Kill Switch
              </span>
              <span className="text-rose-400 font-extrabold text-[10px] px-1.5 py-0.5 rounded bg-rose-500/30 uppercase">
                HALTED
              </span>
            </div>
            <button
              onClick={handleResetKillSwitch}
              className="w-full py-1.5 rounded-lg bg-rose-500 hover:bg-rose-600 text-white font-bold text-[11px] transition-colors shadow text-center"
            >
              Disarm Kill Switch
            </button>
          </div>
        ) : (
          <div className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800/80 space-y-2">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>Capital Shield</span>
              <span className="text-emerald-400 font-semibold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                Armed
              </span>
            </div>
            <button
              onClick={handleTriggerKillSwitch}
              className="w-full py-1 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[10px] font-bold transition-all text-center"
            >
              🚨 Emergency Kill Switch
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden md:flex w-64 bg-slate-900 border-r border-slate-800 flex-col shrink-0">
        {content}
      </aside>

      {/* Mobile Slide-out Drawer */}
      {isOpen && (
        <div className="fixed inset-0 z-50 md:hidden bg-slate-950/80 backdrop-blur-sm flex">
          <div className="w-72 max-w-[85vw] bg-slate-900 border-r border-slate-800 h-full shadow-2xl">
            {content}
          </div>
          <div className="flex-1" onClick={onClose} />
        </div>
      )}
    </>
  );
}
