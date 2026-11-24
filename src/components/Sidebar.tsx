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
  ShieldCheck
} from 'lucide-react';

const navItems = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Strategies', href: '/strategies', icon: Cpu },
  { name: 'Brokers & APIs', href: '/brokers', icon: Wallet },
  { name: 'Logs & Audit', href: '/logs', icon: Terminal },
];

export function Sidebar() {
  const pathname = usePathname();

  const handleLockTerminal = () => {
    localStorage.removeItem('myalgo_access_token');
    document.cookie = 'myalgo_access_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
    window.location.reload();
  };

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col justify-between p-4 shrink-0">
      <div>
        {/* Brand / Logo */}
        <div className="flex items-center gap-3 px-3 py-4 mb-6 border-b border-slate-800">
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

        {/* Navigation Links */}
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
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
            className="flex items-center gap-1.5 text-cyan-400 hover:underline font-semibold"
          >
            <ShieldCheck className="w-4 h-4" /> Admin Portal
          </Link>
          <button
            onClick={handleLockTerminal}
            className="flex items-center gap-1 text-slate-500 hover:text-rose-400 transition-colors"
            title="Lock Terminal"
          >
            <Lock className="w-3.5 h-3.5" /> Lock
          </button>
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-600">
          <span>Protected Terminal</span>
          <span className="text-emerald-500 font-medium">Access Code Mode</span>
        </div>
      </div>
    </aside>
  );
}
