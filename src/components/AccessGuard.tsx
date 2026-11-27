'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { ShieldCheck, Lock, KeyRound, ArrowRight, AlertCircle, ShieldAlert, AlertTriangle } from 'lucide-react';
import Link from 'next/link';

export function AccessGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isUnlocked, setIsUnlocked] = useState<boolean | null>(null);
  const [accessCode, setAccessCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const revokeAccessLocally = (reasonMsg?: string) => {
    try {
      localStorage.removeItem('myalgo_access_token');
      localStorage.removeItem('myalgo_access_permissions');
      document.cookie = 'myalgo_access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT;';
    } catch {}
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
        if (data.token) {
          try {
            localStorage.setItem('myalgo_access_permissions', JSON.stringify(data.token));
          } catch {}
        }
        setIsUnlocked(true);
      } else {
        revokeAccessLocally(
          data.message || 'Access revoked: This access code has been paused or disabled by the administrator.'
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

    const checkTokenNow = () => {
      const savedToken = localStorage.getItem('myalgo_access_token');
      if (!savedToken) {
        setIsUnlocked(false);
        return;
      }
      verifySessionStatus(savedToken.trim().toUpperCase(), false);
    };

    checkTokenNow();

    // Active heartbeat check every 3.5 seconds to enforce immediate revocation on admin pause/disable
    const interval = setInterval(() => {
      const currentToken = localStorage.getItem('myalgo_access_token');
      if (!currentToken) {
        setIsUnlocked(false);
        return;
      }
      verifySessionStatus(currentToken.trim().toUpperCase(), true);
    }, 3500);

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'myalgo_access_token' && !e.newValue) {
        setIsUnlocked(false);
      }
    };

    // Re-verify immediately whenever user switches back to the tab
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkTokenNow();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', handleStorageChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
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
        if (data.token) {
          try {
            localStorage.setItem('myalgo_access_permissions', JSON.stringify(data.token));
          } catch {}
        }
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

      <div className="max-w-md w-full bg-slate-900/95 border border-slate-800 rounded-3xl p-7 sm:p-8 shadow-2xl relative backdrop-blur-xl space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 mx-auto flex items-center justify-center shadow-lg shadow-emerald-500/20 mb-3">
            <Lock className="w-7 h-7 text-slate-950" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            MyAlgo Private Terminal
          </h1>
          <p className="text-xs text-slate-400">
            Automated trading terminal is access-restricted. Please enter your authorized Access Code to proceed.
          </p>
        </div>

        {/* Revocation Warning Alert if administrator disabled the token */}
        {error && (
          <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5 shadow-md">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5 animate-pulse" />
            <div>
              <p className="font-bold text-white">Access Notice</p>
              <p className="mt-0.5 text-rose-300 leading-relaxed">{error}</p>
            </div>
          </div>
        )}

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
              placeholder="e.g. VIP-ACCESS-2026"
              className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-600 font-mono tracking-wider text-center text-sm focus:outline-none focus:border-emerald-500 transition-colors uppercase"
              autoFocus
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black text-sm tracking-wide transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 disabled:opacity-50 active:scale-98"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></span>
                Verifying Code...
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
