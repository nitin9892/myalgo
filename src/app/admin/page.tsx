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
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Play,
  BarChart3,
  Activity,
  Clock,
  Layers,
  RefreshCw,
  Zap
} from 'lucide-react';
import Link from 'next/link';
import { useModal } from '@/context/ModalContext';

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
  const { showAlert } = useModal();
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [passcode, setPasscode] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);

  // Token Management State
  const [tokens, setTokens] = useState<TokenItem[]>([]);
  const [loadingTokens, setLoadingTokens] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Active Admin Tab State
  const [activeTab, setActiveTab] = useState<'TOKENS' | 'BACKTEST'>('TOKENS');

  // Real Market Backtest State (Admin Exclusive)
  const [btStrategy, setBtStrategy] = useState<'Strategy A' | 'Strategy B' | 'Strategy C'>('Strategy C');
  const [btSymbol, setBtSymbol] = useState('BTCUSD');
  const [btTimeframe, setBtTimeframe] = useState<'5m' | '15m' | '1h'>('5m');
  const [btDays, setBtDays] = useState(7);
  const [btCapital, setBtCapital] = useState(100000);
  const [btRiskPct, setBtRiskPct] = useState(5);
  const [btLeverage, setBtLeverage] = useState(10);
  const [btTrailing, setBtTrailing] = useState(true);
  const [runningBacktest, setRunningBacktest] = useState(false);
  const [backtestResult, setBacktestResult] = useState<any | null>(null);
  const [backtestError, setBacktestError] = useState<string | null>(null);

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
      document.cookie = `myalgo_admin_session=${encodeURIComponent(savedAdmin)}; Path=/; Max-Age=604800;`;
      fetchTokens(savedAdmin);
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
        document.cookie = `myalgo_admin_session=${encodeURIComponent(adminEmail.trim())}; Path=/; Max-Age=604800;`;
        setIsAdminLoggedIn(true);
        fetchTokens(adminEmail.trim());
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

  const fetchTokens = async (overrideEmail?: string) => {
    setLoadingTokens(true);
    const emailToUse = overrideEmail || adminEmail || localStorage.getItem('myalgo_admin_email') || '';
    try {
      const res = await fetch('/api/admin/tokens', {
        headers: {
          'x-admin-email': emailToUse,
        },
      });
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
    const emailToUse = adminEmail || localStorage.getItem('myalgo_admin_email') || '';
    try {
      const res = await fetch('/api/admin/tokens', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-admin-email': emailToUse,
        },
        body: JSON.stringify({
          code: newTokenCode,
          label: newTokenLabel || 'Trader Access',
          max_uses: maxUses,
          expires_in_days: expiryDays,
          adminEmail: emailToUse,
        }),
      });
      const data = await res.json();
      if (data.success) {
        await showAlert({
          title: 'Access Code Generated',
          message: `Access code [${newTokenCode}] generated successfully!`,
          type: 'success',
        });
        setNewTokenCode('');
        setNewTokenLabel('');
        fetchTokens(emailToUse);
      } else {
        await showAlert({
          title: 'Token Generation Failed',
          message: data.error || 'Failed to create token',
          type: 'danger',
        });
      }
    } catch (err: any) {
      await showAlert({
        title: 'Error',
        message: err.message,
        type: 'danger',
      });
    } finally {
      setCreatingToken(false);
    }
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    const emailToUse = adminEmail || localStorage.getItem('myalgo_admin_email') || '';
    try {
      const res = await fetch('/api/admin/tokens', {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'x-admin-email': emailToUse,
        },
        body: JSON.stringify({ id, is_active: !currentStatus, adminEmail: emailToUse }),
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

  const handleRunBacktest = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setRunningBacktest(true);
    setBacktestError(null);
    const emailToUse = adminEmail || localStorage.getItem('myalgo_admin_email') || '';

    try {
      const res = await fetch('/api/admin/backtest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-email': emailToUse,
        },
        body: JSON.stringify({
          strategy: btStrategy,
          symbol: btSymbol,
          timeframe: btTimeframe,
          days: btDays,
          initialCapital: btCapital,
          perTradeRiskPct: btRiskPct,
          leverage: btLeverage,
          trailingEnabled: btTrailing,
          adminEmail: emailToUse,
        }),
      });

      const data = await res.json();
      if (data.success && data.results) {
        setBacktestResult(data.results);
      } else {
        setBacktestError(data.error || 'Backtest failed to execute');
      }
    } catch (err: any) {
      setBacktestError(err.message || 'Network error running backtest');
    } finally {
      setRunningBacktest(false);
    }
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
            <h1 className="text-2xl font-bold text-white">Master Admin Portal</h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Logged in as <span className="text-cyan-400 font-semibold">{adminEmail}</span>. Full authority over trader access codes and real market backtesting.
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

      {/* Admin Feature Navigation Tabs */}
      <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
        <button
          type="button"
          onClick={() => setActiveTab('TOKENS')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'TOKENS'
              ? 'bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/20 font-black'
              : 'text-slate-400 hover:text-white hover:bg-slate-900 border border-slate-800'
          }`}
        >
          <Key className="w-4 h-4" />
          <span>Access Code Command Center</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('BACKTEST')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'BACKTEST'
              ? 'bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-950 shadow-lg shadow-emerald-500/20 font-black'
              : 'text-slate-400 hover:text-white hover:bg-slate-900 border border-slate-800'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>Real Market Backtesting</span>
          <span className="text-[10px] bg-slate-950/80 px-2 py-0.5 rounded text-emerald-400 border border-emerald-500/30 font-mono font-bold">
            Admin Only
          </span>
        </button>
      </div>

      {/* TAB 1: ACCESS CODES MANAGER */}
      {activeTab === 'TOKENS' && (
        <div className="space-y-8">
          {/* Generate New Access Code Form */}
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 shadow-xl">
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
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Key className="w-5 h-5 text-emerald-400" /> Active Access Tokens ({tokens.length})
              </h2>
              <button
                onClick={() => fetchTokens()}
                className="text-xs text-cyan-400 hover:underline flex items-center gap-1"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Refresh List
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
      )}

      {/* TAB 2: REAL MARKET DATA BACKTESTING (ADMIN EXCLUSIVE) */}
      {activeTab === 'BACKTEST' && (
        <div className="space-y-6">
          {/* Backtest Configuration Card */}
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-6 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-cyan-500 flex items-center justify-center text-slate-950 font-bold shadow-lg shadow-emerald-500/20">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    Real Market Data Backtesting Engine
                  </h2>
                  <p className="text-xs text-slate-400">
                    Simulate Strategy C (6 Setups: PDH • PDL • PDC • 1:3 RR) on 100% real historical candles.
                  </p>
                </div>
              </div>

              <span className="px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-bold text-xs flex items-center gap-1.5 self-start sm:self-auto">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                Direct Live Feed
              </span>
            </div>

            <form onSubmit={handleRunBacktest} className="space-y-5">
              {/* Step 1: Select Strategy */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center text-[10px] font-bold">1</span>
                  <label className="text-xs font-bold text-slate-200">Select Strategy</label>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {[
                    { id: 'Strategy C' as const, label: 'Strategy C', desc: '🔥 6 Core Setups (PDH • PDL • PDC • 1:3 RR)' },
                    { id: 'Strategy B' as const, label: 'Strategy B', desc: '⚡ Phantom AI (SMC + ICT Scalper: BOS • OB • FVG • 1:4 RR)' },
                    { id: 'Strategy A' as const, label: 'Strategy A', desc: 'Slot A: Trend Momentum Breakout' },
                  ].map((st) => (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => setBtStrategy(st.id)}
                      className={`p-3 rounded-xl text-left border transition-all ${
                        btStrategy === st.id
                          ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-lg shadow-emerald-500/20'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm text-white">{st.label}</span>
                        {btStrategy === st.id && <Check className="w-4 h-4 text-emerald-400 stroke-[3]" />}
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1">{st.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Step 2: Select Timeframe */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center text-[10px] font-bold">2</span>
                  <label className="text-xs font-bold text-slate-200">Select Time Frame</label>
                </div>
                <div className="grid grid-cols-3 gap-2.5">
                  {[
                    { tf: '5m' as const, label: '5 Minute (5m)', tag: 'Intraday Core Scalp' },
                    { tf: '15m' as const, label: '15 Minute (15m)', tag: 'Swing Momentum' },
                    { tf: '1h' as const, label: '1 Hour (1h)', tag: 'Higher Trend' },
                  ].map((t) => (
                    <button
                      key={t.tf}
                      type="button"
                      onClick={() => setBtTimeframe(t.tf)}
                      className={`p-3 rounded-xl text-center border font-bold text-xs transition-all flex flex-col items-center justify-center gap-1 ${
                        btTimeframe === t.tf
                          ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 shadow-lg shadow-cyan-500/20'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <span className="font-mono text-sm text-white">{t.label}</span>
                      <span className="text-[10px] text-cyan-400">{t.tag}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Step 3: Select Pairs */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center text-[10px] font-bold">3</span>
                    <label className="text-xs font-bold text-slate-200">Select Pair / Coin</label>
                  </div>
                  <span className="text-xs text-amber-400 font-mono font-bold">Active: {btSymbol}</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {[
                    { id: 'BTCUSD', name: 'Bitcoin', tag: 'BTC / USD' },
                    { id: 'ETHUSD', name: 'Ethereum', tag: 'ETH / USD' },
                    { id: 'SOLUSD', name: 'Solana', tag: 'SOL / USD' },
                    { id: 'XRPUSD', name: 'Ripple', tag: 'XRP / USD' },
                  ].map((coin) => (
                    <button
                      key={coin.id}
                      type="button"
                      onClick={() => setBtSymbol(coin.id)}
                      className={`p-3.5 rounded-xl border text-center transition-all flex flex-col items-center justify-center gap-1 ${
                        btSymbol === coin.id
                          ? 'bg-amber-500/20 border-amber-500 text-amber-300 shadow-lg shadow-amber-500/20'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <span className="font-mono text-base font-bold text-white">{coin.tag}</span>
                      <span className="text-[10px] text-slate-400">{coin.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Lookback Period */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-300">Lookback Window</label>
                  <span className="text-xs text-slate-400 font-mono">Simulating over past {btDays} Days Real Feeds</span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {[3, 7, 14, 30].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setBtDays(d)}
                      className={`py-2 rounded-xl text-xs font-mono font-bold border transition-all ${
                        btDays === d
                          ? 'bg-slate-200 text-slate-950 border-white font-black shadow-md'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {d} Days
                    </button>
                  ))}
                </div>
              </div>

              {/* Step 4: Capital & Risk Management */}
              <div className="space-y-4 pt-1 p-4 rounded-xl bg-slate-950/70 border border-slate-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center text-[10px] font-bold">4</span>
                    <label className="text-xs font-bold text-slate-200">Capital & Risk Management</label>
                  </div>
                  <span className="text-[11px] text-emerald-400 font-mono font-bold">
                    Risk per trade: ₹{((btCapital * btRiskPct) / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })} ({btRiskPct}%)
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Initial Capital Amount */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-semibold text-slate-300">
                        Initial Capital / Balance (₹ INR)
                      </label>
                      <span className="text-[10px] text-slate-400 font-mono">
                        ₹{btCapital.toLocaleString('en-IN')}
                      </span>
                    </div>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">₹</span>
                      <input
                        type="number"
                        min={1000}
                        max={10000000}
                        step={5000}
                        value={btCapital}
                        onChange={(e) => setBtCapital(Math.max(1000, Number(e.target.value) || 1000))}
                        className="w-full pl-8 pr-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
                        placeholder="100000"
                      />
                    </div>
                    {/* Quick Presets */}
                    <div className="flex items-center gap-1.5 pt-1 flex-wrap">
                      {[
                        { label: '₹25K', val: 25000 },
                        { label: '₹50K', val: 50000 },
                        { label: '₹1 Lakh', val: 100000 },
                        { label: '₹2.5 Lakh', val: 250000 },
                        { label: '₹5 Lakh', val: 500000 },
                      ].map((preset) => (
                        <button
                          key={preset.val}
                          type="button"
                          onClick={() => setBtCapital(preset.val)}
                          className={`px-2 py-1 rounded-lg text-[10px] font-mono font-bold border transition-all ${
                            btCapital === preset.val
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500'
                              : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Risk per Trade (%) */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-semibold text-slate-300">
                        Risk per Trade (%)
                      </label>
                      <span className="text-[10px] text-cyan-400 font-mono font-bold">
                        {btRiskPct}% of capital
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-1.5">
                      {[1, 2, 3, 5].map((pct) => (
                        <button
                          key={pct}
                          type="button"
                          onClick={() => setBtRiskPct(pct)}
                          className={`py-2 rounded-xl text-xs font-mono font-bold border text-center transition-all ${
                            btRiskPct === pct
                              ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500 font-black'
                              : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          {pct}%
                        </button>
                      ))}
                    </div>
                    <p className="text-[10px] text-slate-400 leading-tight pt-1">
                      Dynamic sizing: Quantity is automatically calculated based on exact Stop Loss distance.
                    </p>
                  </div>
                </div>
              </div>

              {/* Action Button: One-Click Instant Backtest */}
              <button
                type="submit"
                disabled={runningBacktest}
                className="w-full py-4 rounded-xl bg-gradient-to-r from-emerald-500 via-cyan-500 to-emerald-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 font-black text-sm transition-all shadow-xl shadow-emerald-500/25 flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.99]"
              >
                {runningBacktest ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin text-slate-950" />
                    <span>Evaluating {btStrategy} on {btSymbol} ({btTimeframe})...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-5 h-5 fill-slate-950" />
                    <span>Run Backtest: {btStrategy} • {btTimeframe} • {btSymbol} ({btDays} Days)</span>
                  </>
                )}
              </button>
            </form>

            {backtestError && (
              <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{backtestError}</span>
              </div>
            )}
          </div>

          {/* Backtest Results Display */}
          {backtestResult && (
            <div className="space-y-6">
              {/* Feed Header */}
              <div className="p-4 rounded-xl bg-slate-900 border border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span className="font-semibold text-white">
                    {backtestResult.strategy || 'Strategy C'} Verified on {backtestResult.totalCandles} Real {backtestResult.timeframe || '5m'} Candles
                  </span>
                  <span className="text-slate-400">({backtestResult.dataSource})</span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-cyan-400 font-mono font-bold bg-cyan-500/10 px-2.5 py-1 rounded-lg border border-cyan-500/20">
                    Capital: ₹{backtestResult.initialCapital.toLocaleString('en-IN')} → ₹{backtestResult.finalCapital.toLocaleString('en-IN')}
                  </span>
                  <span className="text-emerald-400 font-mono font-bold bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                    {backtestResult.days} Days • {backtestResult.symbol} • {backtestResult.timeframe || '5m'}
                  </span>
                </div>
              </div>

              {/* 4 KPI Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Net P&L */}
                <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
                  <span className="text-xs text-slate-400 font-semibold uppercase">Net Realized P&L</span>
                  <div className={`text-2xl font-black font-mono ${
                    backtestResult.netPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}>
                    {backtestResult.netPnl >= 0 ? '+' : ''}₹{backtestResult.netPnl.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <span className={`text-xs font-bold font-mono ${
                    backtestResult.returnPct >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}>
                    {backtestResult.returnPct >= 0 ? '+' : ''}{backtestResult.returnPct}% Return
                  </span>
                </div>

                {/* Win Rate */}
                <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
                  <span className="text-xs text-slate-400 font-semibold uppercase">Win Rate</span>
                  <div className="text-2xl font-black font-mono text-cyan-400">
                    {backtestResult.winRatePct}%
                  </div>
                  <span className="text-xs text-slate-400 font-mono">
                    {backtestResult.winningTrades} Wins / {backtestResult.losingTrades} Losses
                  </span>
                </div>

                {/* Profit Factor */}
                <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
                  <span className="text-xs text-slate-400 font-semibold uppercase">Profit Factor</span>
                  <div className="text-2xl font-black font-mono text-amber-400">
                    {backtestResult.profitFactor}x
                  </div>
                  <span className="text-xs text-slate-400 font-mono">
                    Gross Win/Loss Ratio
                  </span>
                </div>

                {/* Max Drawdown */}
                <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
                  <span className="text-xs text-slate-400 font-semibold uppercase">Max Drawdown</span>
                  <div className="text-2xl font-black font-mono text-rose-400">
                    {backtestResult.maxDrawdownPct}%
                  </div>
                  <span className="text-xs text-slate-400 font-mono">
                    Strict Capital Preservation
                  </span>
                </div>
              </div>

              {/* Trade Log Table */}
              <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 shadow-xl">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-emerald-400" />
                    Simulated Trades History ({backtestResult.totalTrades} Trades)
                  </h3>
                  <span className="text-xs text-slate-400 font-mono">
                    Final Capital: ₹{backtestResult.finalCapital.toLocaleString('en-IN')}
                  </span>
                </div>

                {backtestResult.trades.length === 0 ? (
                  <p className="text-xs text-slate-400 py-6 text-center">
                    No trade signals triggered during this lookback window with the 6 setups filter.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-300">
                      <thead className="text-xs uppercase bg-slate-950/60 text-slate-400 border-b border-slate-800">
                        <tr>
                          <th className="py-3 px-3">Trade</th>
                          <th className="py-3 px-3">Setup Name</th>
                          <th className="py-3 px-3">Side</th>
                          <th className="py-3 px-3">Entry &rarr; Exit</th>
                          <th className="py-3 px-3">SL &bull; TP</th>
                          <th className="py-3 px-3">Reason</th>
                          <th className="py-3 px-3 text-right">P&L (INR)</th>
                          <th className="py-3 px-3 text-center">Result</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800 font-mono text-xs">
                        {backtestResult.trades.map((tr: any) => (
                          <tr key={tr.id} className="hover:bg-slate-800/40 transition-colors">
                            <td className="py-3 px-3 font-bold text-white">
                              {tr.id}
                              <span className="block text-[10px] text-slate-500 font-normal">{tr.entryTime}</span>
                            </td>
                            <td className="py-3 px-3 font-sans text-xs text-slate-200">
                              {tr.setupName}
                            </td>
                            <td className="py-3 px-3">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                tr.side === 'BUY' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                              }`}>
                                {tr.side}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-slate-300">
                              {tr.entryPrice} &rarr; {tr.exitPrice}
                            </td>
                            <td className="py-3 px-3 text-slate-400 text-[11px]">
                              SL: {tr.stopLoss} | TP: {tr.takeProfit}
                            </td>
                            <td className="py-3 px-3 text-slate-400 text-[11px]">
                              {tr.exitReason}
                            </td>
                            <td className={`py-3 px-3 text-right font-bold ${
                              tr.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                            }`}>
                              {tr.pnl >= 0 ? '+' : ''}₹{tr.pnl.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="py-3 px-3 text-center">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                                tr.result === 'WIN'
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                  : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                              }`}>
                                {tr.result}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
