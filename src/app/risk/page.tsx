'use client';

import { useState, useEffect } from 'react';
import { 
  ShieldAlert, 
  Wallet, 
  Percent, 
  AlertOctagon, 
  RefreshCw, 
  CheckCircle2, 
  Power, 
  Calculator, 
  Sliders, 
  Lock,
  ArrowRight,
  ShieldCheck,
  Zap,
  TrendingDown,
  Coins
} from 'lucide-react';

export default function RiskManagementPage() {
  const [walletBalance, setWalletBalance] = useState<number>(100000);
  // Defaulting to user's exact requirements: 15% Daily Loss, 5% Per-Trade Risk
  const [maxDailyLossPct, setMaxDailyLossPct] = useState<number>(15.0);
  const [perTradeRiskPct, setPerTradeRiskPct] = useState<number>(5.0);
  const [maxOpenTrades, setMaxOpenTrades] = useState<number>(2);

  const [killSwitchActive, setKillSwitchActive] = useState<boolean>(false);
  const [killSwitchReason, setKillSwitchReason] = useState<string | null>(null);
  const [todayNetPnl, setTodayNetPnl] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  // Crypto Simulator State (BTC, ETH, SOL, XRP)
  const [simSymbol, setSimSymbol] = useState<'BTCUSD' | 'ETHUSD' | 'SOLUSD' | 'XRPUSD'>('BTCUSD');
  const [simSlPoints, setSimSlPoints] = useState<number>(150);

  useEffect(() => {
    fetchRiskSettings();
  }, []);

  const fetchRiskSettings = async () => {
    setLoading(true);
    try {
      // 1. Check local storage first
      const localKill = localStorage.getItem('myalgo_kill_switch');
      if (localKill) {
        try {
          const parsed = JSON.parse(localKill);
          if (parsed.active) {
            setKillSwitchActive(true);
            setKillSwitchReason(parsed.reason || 'Kill Switch is engaged');
          }
        } catch {}
      }

      const res = await fetch('/api/risk');
      const data = await res.json();
      if (data.config) {
        setWalletBalance(data.config.walletBalance || 100000);
        setMaxDailyLossPct(data.config.maxDailyLossPct || 15.0);
        setPerTradeRiskPct(data.config.perTradeRiskPct || 5.0);
        setMaxOpenTrades(data.config.maxOpenTrades || 2);
        
        const isServerActive = !!(data.isKillSwitchActive || data.config.killSwitchActive);
        if (isServerActive) {
          setKillSwitchActive(true);
          setKillSwitchReason(data.killSwitchReason || data.config.killSwitchReason || 'Emergency circuit breaker active');
          localStorage.setItem('myalgo_kill_switch', JSON.stringify({ active: true, reason: data.killSwitchReason }));
        }

        setTodayNetPnl(data.todayNetPnl || 0);

        // Auto-sync live wallet balance from connected broker
        try {
          const savedStatus = localStorage.getItem('myalgo_broker_status');
          if (savedStatus) {
            const parsed = JSON.parse(savedStatus);
            const liveBal = parsed.DELTA?.balance || parsed.DHAN?.balance;
            if (liveBal && liveBal > 0) {
              setWalletBalance(liveBal);
            }
          }
        } catch {}
      }
    } catch (err) {
      console.error('Failed to load risk settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/risk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletBalance,
          maxDailyLossPct,
          perTradeRiskPct,
          maxOpenTrades,
        }),
      });
      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2500);
      }
    } catch (err) {
      alert('Error saving settings');
    } finally {
      setSaving(false);
    }
  };

  const handleTriggerKillSwitch = async () => {
    if (!confirm('EMERGENCY KILL SWITCH: This will immediately close ALL open trades and block any new entries. Confirm?')) {
      return;
    }

    const reason = 'Manual emergency kill switch triggered by user';
    try {
      localStorage.setItem('myalgo_kill_switch', JSON.stringify({ active: true, reason, timestamp: Date.now() }));
    } catch {}

    setKillSwitchActive(true);
    setKillSwitchReason(reason);

    try {
      await fetch('/api/risk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ triggerEmergencyKill: true }),
      });
      alert('🚨 Kill Switch Activated! All positions squared off & trading halted.');
    } catch (err) {
      console.error('Failed to trigger kill switch on server:', err);
    }
  };

  const handleResetKillSwitch = async () => {
    if (!confirm('Reset and Disarm Kill Switch? Normal automated trading will resume.')) {
      return;
    }

    try {
      localStorage.removeItem('myalgo_kill_switch');
    } catch {}

    setKillSwitchActive(false);
    setKillSwitchReason(null);

    try {
      await fetch('/api/risk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resetKillSwitch: true }),
      });
      alert('Kill Switch Disarmed and Reset. Normal trading resumed.');
    } catch (err) {
      console.error('Failed to reset kill switch on server:', err);
    }
  };

  // Calculations
  const maxDailyLossAmount = (walletBalance * (maxDailyLossPct / 100));
  const perTradeRiskAmount = (walletBalance * (perTradeRiskPct / 100));

  // Dynamic lot size for crypto (BTC, ETH, XRP)
  const simRawQty = Math.max(1, Math.floor(perTradeRiskAmount / Math.max(0.1, simSlPoints)));
  let simCalculatedQty = simRawQty;

  return (
    <div className="space-y-6 sm:space-y-8 max-w-4xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-emerald-400" />
            Risk & Capital Management
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            2 Core Protection Rules: Overall Daily Loss limit & Per-Trade Risk allocation.
          </p>
        </div>

        <button
          onClick={handleSaveSettings}
          disabled={saving}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50"
        >
          {saveSuccess ? (
            <>
              <CheckCircle2 className="w-4 h-4 text-slate-950" /> Settings Saved!
            </>
          ) : (
            <>
              <SaveIcon className="w-4 h-4" /> Save Risk Rules
            </>
          )}
        </button>
      </div>

      {/* KILL SWITCH BANNER */}
      {killSwitchActive ? (
        <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-r from-rose-950/90 via-slate-950 to-rose-950/90 border-2 border-rose-500 text-rose-200 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertOctagon className="w-8 h-8 text-rose-400 shrink-0 mt-0.5 animate-bounce" />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-white tracking-wide">🚨 KILL SWITCH ENGAGED — TRADING FROZEN</h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-rose-500 text-white animate-pulse">
                  HALTED
                </span>
              </div>
              <p className="text-xs text-rose-300 mt-1">
                {killSwitchReason || 'Emergency circuit breaker active. All orders are blocked and open positions squared off.'}
              </p>
            </div>
          </div>
          <button
            onClick={handleResetKillSwitch}
            className="w-full md:w-auto px-5 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-black shadow-lg shadow-rose-500/30 shrink-0 transition-all text-center"
          >
            DISARM & RESET KILL SWITCH
          </button>
        </div>
      ) : (
        <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-emerald-400 animate-ping shrink-0"></div>
            <div>
              <span className="text-xs font-bold text-emerald-400 tracking-wide uppercase flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" /> Kill Switch Armed & Monitoring
              </span>
              <p className="text-xs text-slate-400 mt-0.5">
                Overall Daily Loss ceiling: <strong className="text-rose-400">{maxDailyLossPct}%</strong> (-₹{maxDailyLossAmount.toLocaleString()}) • Risk/Trade: <strong className="text-cyan-400">{perTradeRiskPct}%</strong> (₹{perTradeRiskAmount.toLocaleString()}).
              </p>
            </div>
          </div>
          <button
            onClick={handleTriggerKillSwitch}
            className="w-full sm:w-auto px-4 py-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-bold transition-all shrink-0 text-center"
          >
            🚨 Emergency Trip Kill Switch
          </button>
        </div>
      )}

      {/* The 2 Core Rules Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {/* Rule 1: Overall Daily Loss */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
              <TrendingDown className="w-4 h-4" /> Rule 1: Overall Daily Loss
            </span>
            <span className="text-xl font-black font-mono text-rose-400">{maxDailyLossPct}%</span>
          </div>

          <div>
            <div className="text-2xl font-black font-mono text-white">
              -₹{maxDailyLossAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              If cumulative loss today reaches {maxDailyLossPct}%, trading halts automatically.
            </p>
          </div>

          {/* Slider */}
          <div className="space-y-2 pt-2">
            <input
              type="range"
              min="5"
              max="30"
              step="1"
              value={maxDailyLossPct}
              onChange={(e) => setMaxDailyLossPct(Number(e.target.value))}
              className="w-full accent-rose-500 cursor-pointer h-2 bg-slate-800 rounded-lg"
            />
            <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
              <span>5%</span>
              <span className="text-rose-400 font-bold">15% (Recommended)</span>
              <span>30%</span>
            </div>
          </div>
        </div>

        {/* Rule 2: Per-Trade Risk */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
              <Percent className="w-4 h-4" /> Rule 2: Per-Trade Risk
            </span>
            <span className="text-xl font-black font-mono text-cyan-400">{perTradeRiskPct}%</span>
          </div>

          <div>
            <div className="text-2xl font-black font-mono text-white">
              ₹{perTradeRiskAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Every single executed order will strictly risk at most {perTradeRiskPct}% of capital.
            </p>
          </div>

          {/* Slider */}
          <div className="space-y-2 pt-2">
            <input
              type="range"
              min="1"
              max="15"
              step="0.5"
              value={perTradeRiskPct}
              onChange={(e) => setPerTradeRiskPct(Number(e.target.value))}
              className="w-full accent-cyan-500 cursor-pointer h-2 bg-slate-800 rounded-lg"
            />
            <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
              <span>1%</span>
              <span className="text-cyan-400 font-bold">5% (Recommended)</span>
              <span>15%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Wallet Capital Input */}
      <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Wallet className="w-5 h-5 text-emerald-400 shrink-0" />
          <div>
            <span className="text-xs font-bold text-white uppercase tracking-wider">Trading Capital Base</span>
            <p className="text-xs text-slate-400">Reference balance for 15% daily loss and 5% per-trade calculations</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-slate-400 font-mono">₹</span>
          <input
            type="number"
            value={walletBalance}
            onChange={(e) => setWalletBalance(Number(e.target.value))}
            className="w-36 px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono text-sm focus:border-emerald-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Crypto Instruments Dynamic Lot Sizer Simulator (BTC, ETH, XRP) */}
      <div className="p-5 sm:p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
            <Coins className="w-5 h-5 text-amber-400" />
            Crypto Position Sizing Simulator
          </h2>
          <span className="text-xs text-slate-400">Supported: BTC • ETH • SOL • XRP</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Crypto Instrument</label>
            <select
              value={simSymbol}
              onChange={(e: any) => setSimSymbol(e.target.value)}
              className="w-full px-3 py-2.5 sm:py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm sm:text-xs font-semibold"
            >
              <option value="BTCUSD">BTCUSD (Bitcoin)</option>
              <option value="ETHUSD">ETHUSD (Ethereum)</option>
              <option value="SOLUSD">SOLUSD (Solana)</option>
              <option value="XRPUSD">XRPUSD (Ripple)</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Stop-Loss Distance (Points)</label>
            <input
              type="number"
              value={simSlPoints}
              onChange={(e) => setSimSlPoints(Number(e.target.value))}
              min="0.1"
              max="5000"
              step="1"
              className="w-full px-3 py-2.5 sm:py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono text-sm sm:text-xs"
            />
          </div>

          <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 flex flex-col justify-center">
            <span className="text-[11px] text-slate-400">Calculated Dynamic Size:</span>
            <div className="text-lg font-black font-mono text-emerald-400">
              {simCalculatedQty} Contracts
            </div>
            <span className="text-[10px] text-slate-500">
              At 5% risk: max loss ₹{perTradeRiskAmount.toLocaleString()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function SaveIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/>
      <path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7"/>
      <path d="M7 3v4a1 1 0 0 0 1 1h7"/>
    </svg>
  );
}
