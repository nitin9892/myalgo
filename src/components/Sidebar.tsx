'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  Cpu, 
  Wallet, 
  Terminal, 
  Activity, 
  Lock, 
  ShieldCheck, 
  ShieldAlert,
  X
} from 'lucide-react';

const navItems = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Strategies', href: '/strategies', icon: Cpu },
  { name: 'Risk & Capital', href: '/risk', icon: ShieldAlert },
  { name: 'Brokers & APIs', href: '/brokers', icon: Wallet },
  { name: 'Logs & Audit', href: '/logs', icon: Terminal },
];

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();

  const handleLockTerminal = () => {
    localStorage.removeItem('myalgo_access_token');
    document.cookie = 'myalgo_access_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
    window.location.reload();
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
                Auto Trading Engine
              </p>
            </div>
          </div>
          {onClose && (
            <button onClick={onClose} className="md:hidden text-slate-400 hover:text-white p-1">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Navigation Links */}
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={onClose}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  isActive
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-sm shadow-emerald-500/10'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`} />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer Controls & Admin Link */}
      <div className="pt-4 border-t border-slate-800 text-xs text-slate-500 space-y-3 px-2">
        <div className="flex items-center justify-between text-slate-400">
          <Link 
            href="/admin" 
            onClick={onClose}
            className="flex items-center gap-1.5 text-cyan-400 hover:underline font-semibold"
          >
            <ShieldCheck className="w-4 h-4" /> Admin Portal
          </Link>
          <button
            onClick={handleLockTerminal}
            className="flex items-center gap-1 text-slate-500 hover:text-rose-400 transition-colors font-medium"
            title="Lock Terminal"
          >
            <Lock className="w-3.5 h-3.5" /> Lock
          </button>
        </div>

        <div className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800/80 space-y-1">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>Capital Shield</span>
            <span className="text-emerald-400 font-semibold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              Armed
            </span>
          </div>
          <p className="text-[10px] text-slate-500 leading-tight">Auto-Kill Switch on Daily Loss Breach</p>
        </div>
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
          <div className="w-72 bg-slate-900 border-r border-slate-800 h-full shadow-2xl">
            {content}
          </div>
          <div className="flex-1" onClick={onClose} />
        </div>
      )}
    </>
  );
}
