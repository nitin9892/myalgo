'use client';

import { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Key, 
  Plus, 
  Trash2, 
  Power, 
  Copy, 
  Check, 
  LogOut, 
  Users, 
  Calendar,
  Lock,
  ArrowRight,
  AlertCircle
} from 'lucide-react';
import Link from 'next/link';

interface TokenItem {
  id: string;
  code: string;
  label: string;
  is_active: boolean;
  max_uses: number;
  used_count: number;
  expires_at: string | null;
  created_at: string;
}

export default function AdminPage() {
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [passcode, setPasscode] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);

  // Token Management State
  const [tokens, setTokens] = useState<TokenItem[]>([]);
  const [loadingTokens, setLoadingTokens] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // New Token Form State
  const [newTokenCode, setNewTokenCode] = useState('');
  const [newTokenLabel, setNewTokenLabel] = useState('');
  const [maxUses, setMaxUses] = useState(10);
  const [expiryDays, setExpiryDays] = useState(30);
  const [creatingToken, setCreatingToken] = useState(false);

  useEffect(() => {
    // Check saved admin session
    const savedAdmin = localStorage.getItem('myalgo_admin_email');
    if (savedAdmin) {
      setIsAdminLoggedIn(true);
      setAdminEmail(savedAdmin);
      fetchTokens();
    }
  }, []);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoggingIn(true);

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: adminEmail.trim(), passcode }),
      });
      const data = await res.json();
      if (data.success) {
        localStorage.setItem('myalgo_admin_email', adminEmail.trim());
        setIsAdminLoggedIn(true);
        fetchTokens();
      } else {
        setLoginError(data.message || 'Login failed');
      }
    } catch {
      setLoginError('Server connection error');
    } finally {
      setLoggingIn(false);
    }
  };

  const handleAdminLogout = () => {
    localStorage.removeItem('myalgo_admin_email');
    document.cookie = 'myalgo_admin_session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
    setIsAdminLoggedIn(false);
  };

  const fetchTokens = async () => {
    setLoadingTokens(true);
    try {
      const res = await fetch('/api/admin/tokens');
      const data = await res.json();
      if (data.tokens) {
        setTokens(data.tokens);
      }
    } catch (err) {
      console.error('Failed to load tokens', err);
    } finally {
      setLoadingTokens(false);
    }
  };

  const generateRandomCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = 'ALGO-';
    for (let i = 0; i < 4; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
    code += '-';
    for (let i = 0; i < 4; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
    setNewTokenCode(code);
  };

  const handleCreateToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTokenCode) return;
    setCreatingToken(true);
    try {
      const res = await fetch('/api/admin/tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: newTokenCode,
          label: newTokenLabel || 'Trader Access',
          max_uses: maxUses,
          expires_in_days: expiryDays,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setNewTokenCode('');
        setNewTokenLabel('');
        fetchTokens();
      } else {
        alert(data.error || 'Failed to create token');
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setCreatingToken(false);
    }
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    try {
      const res = await fetch('/api/admin/tokens', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, is_active: !currentStatus }),
      });
      if (res.ok) {
        setTokens((prev) =>
          prev.map((t) => (t.id === id ? { ...t, is_active: !currentStatus } : t))
        );
      }
    } catch (err) {
      console.error(err);
    }
  };

  const copyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // 1. Admin Login Screen
  if (!isAdminLoggedIn) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 mx-auto flex items-center justify-center shadow-lg shadow-cyan-500/20 mb-3">
              <ShieldCheck className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">Master Admin Portal</h1>
            <p className="text-xs text-slate-400">
              Restricted portal. Authorized personnel and verified administrators only.
            </p>
          </div>

          <form onSubmit={handleAdminLogin} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Admin Email</label>
              <input
                type="email"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                placeholder="Enter authorized admin email"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:border-cyan-500 focus:outline-none"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Admin Passcode</label>
              <input
                type="password"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                placeholder="Enter admin passcode"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:border-cyan-500 focus:outline-none"
                required
              />
            </div>

            {loginError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loggingIn}
              className="w-full py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-bold text-sm transition-all shadow-lg shadow-cyan-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loggingIn ? 'Authenticating...' : 'Sign In as Admin'}
            </button>
          </form>

          <div className="text-center pt-2">
            <Link href="/" className="text-xs text-slate-400 hover:text-white">
              &larr; Back to Trading Terminal
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 2. Admin Management Dashboard
  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-cyan-400" />
            <h1 className="text-2xl font-bold text-white">Access Code Command Center</h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Logged in as <span className="text-cyan-400 font-semibold">{adminEmail}</span>. Full authority to create, revoke, and monitor trader access codes.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700"
          >
            Open Terminal &rarr;
          </Link>
          <button
            onClick={handleAdminLogout}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-semibold border border-rose-500/20"
          >
            <LogOut className="w-3.5 h-3.5" /> Sign Out
          </button>
        </div>
      </div>

      {/* Generate New Access Code Form */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Plus className="w-5 h-5 text-emerald-400" /> Generate New Access Code
        </h2>

        <form onSubmit={handleCreateToken} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-slate-300">Access Code</label>
              <button
                type="button"
                onClick={generateRandomCode}
                className="text-[11px] text-cyan-400 hover:underline"
              >
                Auto-Generate
              </button>
            </div>
            <input
              type="text"
              value={newTokenCode}
              onChange={(e) => setNewTokenCode(e.target.value.toUpperCase())}
              placeholder="e.g. ALGO-TRADER-99"
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono text-xs focus:border-cyan-500 focus:outline-none uppercase"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-300">Trader Label / Name</label>
            <input
              type="text"
              value={newTokenLabel}
              onChange={(e) => setNewTokenLabel(e.target.value)}
              placeholder="e.g. VIP Client 1"
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:border-cyan-500 focus:outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-300">Max Device Uses</label>
            <input
              type="number"
              value={maxUses}
              onChange={(e) => setMaxUses(Number(e.target.value))}
              min="1"
              max="9999"
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono text-xs focus:border-cyan-500 focus:outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-300">Valid For (Days)</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={expiryDays}
                onChange={(e) => setExpiryDays(Number(e.target.value))}
                min="1"
                max="365"
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono text-xs focus:border-cyan-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={creatingToken}
                className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs transition-colors shrink-0 disabled:opacity-50"
              >
                {creatingToken ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Access Codes Table */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Key className="w-5 h-5 text-emerald-400" /> Active Access Tokens ({tokens.length})
          </h2>
          <button
            onClick={fetchTokens}
            className="text-xs text-cyan-400 hover:underline"
          >
            Refresh List
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="text-xs uppercase bg-slate-950/60 text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Code</th>
                <th className="py-3 px-4">Label</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Uses</th>
                <th className="py-3 px-4">Expires</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 font-mono text-xs">
              {tokens.map((t) => (
                <tr key={t.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-3.5 px-4 font-bold text-white flex items-center gap-2">
                    <span className="font-mono text-emerald-400">{t.code}</span>
                    <button
                      onClick={() => copyCode(t.code, t.id)}
                      className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                      title="Copy Code"
                    >
                      {copiedId === t.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </td>
                  <td className="py-3.5 px-4 font-sans text-slate-300">{t.label}</td>
                  <td className="py-3.5 px-4">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      t.is_active
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                    }`}>
                      {t.is_active ? 'ACTIVE' : 'REVOKED'}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">{t.used_count || 0} / {t.max_uses}</td>
                  <td className="py-3.5 px-4 font-sans text-slate-400 text-xs">
                    {t.expires_at ? new Date(t.expires_at).toLocaleDateString() : 'Never'}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <button
                      onClick={() => handleToggleActive(t.id, t.is_active)}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                        t.is_active
                          ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      }`}
                    >
                      {t.is_active ? 'Revoke (Block)' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
