'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { ShieldCheck, Lock, KeyRound, ArrowRight, CheckCircle2, AlertCircle, ShieldAlert } from 'lucide-react';
import Link from 'next/link';

export function AccessGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isUnlocked, setIsUnlocked] = useState<boolean | null>(null);
  const [accessCode, setAccessCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const revokeAccessLocally = (reasonMsg?: string) => {
    localStorage.removeItem('myalgo_access_token');
    document.cookie = 'myalgo_access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT;';
    setIsUnlocked(false);
    if (reasonMsg) {
      setError(reasonMsg);
    }
  };

  const verifySessionStatus = async (token: string, isSilentCheck: boolean = false) => {
    try {
      const res = await fetch('/api/access/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: token, checkOnly: true }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setIsUnlocked(true);
      } else {
        revokeAccessLocally(
          data.message || 'Access revoked: This access code has been disabled by the administrator.'
        );
      }
    } catch (err) {
      // If network fails during initial check, allow if saved token exists; if silent heartbeat, keep existing state
      if (!isSilentCheck) {
        setIsUnlocked(true);
      }
    }
  };

  useEffect(() => {
    // Admin routes handle their own authentication
    if (pathname.startsWith('/admin')) {
      setIsUnlocked(true);
      return;
    }

    const savedToken = localStorage.getItem('myalgo_access_token');
    if (!savedToken) {
      setIsUnlocked(false);
      return;
    }

    // Immediately verify token active status with backend on load/navigation
    verifySessionStatus(savedToken.trim().toUpperCase(), false);

    // Active heartbeat check every 8 seconds to enforce immediate revocation
    const interval = setInterval(() => {
      const currentToken = localStorage.getItem('myalgo_access_token');
      if (!currentToken) {
        setIsUnlocked(false);
        return;
      }
      verifySessionStatus(currentToken.trim().toUpperCase(), true);
    }, 8000);

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'myalgo_access_token' && !e.newValue) {
        setIsUnlocked(false);
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [pathname]);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessCode.trim()) {
      setError('Please enter your access code');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/access/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: accessCode.trim() }),
      });

      const data = await res.json();
      if (data.success) {
        localStorage.setItem('myalgo_access_token', accessCode.trim().toUpperCase());
        setIsUnlocked(true);
      } else {
        setError(data.message || 'Invalid or revoked access code');
      }
    } catch (err: any) {
      setError('Failed to verify access code. Try again.');
    } finally {
      setLoading(false);
    }
  };

  // While checking initial state, show a clean loader
  if (isUnlocked === null) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // If unlocked or admin path, render children
  if (isUnlocked) {
    return <>{children}</>;
  }

  // Access Lock Screen
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="max-w-md w-full bg-slate-900/90 border border-slate-800 rounded-3xl p-8 shadow-2xl relative backdrop-blur-xl space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 mx-auto flex items-center justify-center shadow-lg shadow-emerald-500/20 mb-4">
            <Lock className="w-7 h-7 text-slate-950" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            MyAlgo Private Terminal
          </h1>
          <p className="text-xs text-slate-400">
            Automated trading terminal is access-restricted. Please enter your authorized Access Code to proceed.
          </p>
        </div>

        {/* Input Form */}
        <form onSubmit={handleUnlock} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-emerald-400" /> Enter Access Code
            </label>
            <input
              type="text"
              value={accessCode}
              onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
              placeholder="e.g. ALGO-XXXX-XXXX"
              className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-600 font-mono tracking-wider text-center text-sm focus:outline-none focus:border-emerald-500 transition-colors uppercase"
              autoFocus
            />
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-sm transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></span>
                Verifying...
              </span>
            ) : (
              <>
                Unlock Terminal <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Footer Admin Link */}
        <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-500">
          <span>Need an access code? Contact Admin</span>
          <Link
            href="/admin"
            className="text-emerald-400 hover:underline flex items-center gap-1 font-semibold"
          >
            <ShieldCheck className="w-3.5 h-3.5" /> Admin Portal
          </Link>
        </div>
      </div>
    </div>
  );
}
