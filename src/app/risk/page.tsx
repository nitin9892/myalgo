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
  ArrowRight
} from 'lucide-react';

export default function RiskManagementPage() {
  const [walletBalance, setWalletBalance] = useState<number>(100000);
  const [maxDailyLossPct, setMaxDailyLossPct] = useState<number>(3.0);
  const [perTradeRiskPct, setPerTradeRiskPct] = useState<number>(1.0);
  const [maxOpenTrades, setMaxOpenTrades] = useState<number>(2);

  const [killSwitchActive, setKillSwitchActive] = useState<boolean>(false);
  const [killSwitchReason, setKillSwitchReason] = useState<string | null>(null);
  const [todayNetPnl, setTodayNetPnl] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  // Simulator State
  const [simSymbol, setSimSymbol] = useState<'NIFTY' | 'BANKNIFTY' | 'BTCUSD' | 'EURUSD'>('NIFTY');
  const [simSlPoints, setSimSlPoints] = useState<number>(20);

  useEffect(() => {
    fetchRiskSettings();
  }, []);

  const fetchRiskSettings = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/risk');
      const data = await res.json();
      if (data.config) {
        setWalletBalance(data.config.walletBalance || 100000);
        setMaxDailyLossPct(data.config.maxDailyLossPct || 3.0);
        setPerTradeRiskPct(data.config.perTradeRiskPct || 1.0);
        setMaxOpenTrades(data.config.maxOpenTrades || 2);
        setKillSwitchActive(data.isKillSwitchActive || false);
        setKillSwitchReason(data.killSwitchReason || null);
        setTodayNetPnl(data.todayNetPnl || 0);

        // Auto-sync live wallet balance from connected broker if available
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
    try {
      const res = await fetch('/api/risk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ triggerEmergencyKill: true }),
      });
      if (res.ok) {
        setKillSwitchActive(true);
        setKillSwitchReason('Manual emergency kill switch triggered by user');
        alert('🚨 Kill Switch Activated! All positions squared off.');
      }
    } catch (err) {
      alert('Failed to trigger kill switch');
    }
  };

  const handleResetKillSwitch = async () => {
    try {
      const res = await fetch('/api/risk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resetKillSwitch: true }),
      });
      if (res.ok) {
        setKillSwitchActive(false);
        setKillSwitchReason(null);
        alert('Kill Switch Reset and Disarmed. Normal trading resumed.');
      }
    } catch (err) {
      alert('Failed to reset kill switch');
    }
  };

  // Calculations
  const maxDailyLossAmount = (walletBalance * (maxDailyLossPct / 100));
  const perTradeRiskAmount = (walletBalance * (perTradeRiskPct / 100));

  // Simulator dynamic lot size
  const simRawQty = Math.floor(perTradeRiskAmount / Math.max(1, simSlPoints));
  let simCalculatedQty = simRawQty;
  if (simSymbol === 'NIFTY') simCalculatedQty = Math.max(25, Math.floor(simRawQty / 25) * 25);
  else if (simSymbol === 'BANKNIFTY') simCalculatedQty = Math.max(15, Math.floor(simRawQty / 15) * 15);
  else if (simSymbol === 'BTCUSD') simCalculatedQty = Math.max(1, Math.min(20, simRawQty));
  else if (simSymbol === 'EURUSD') simCalculatedQty = 0.01;

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-rose-400" />
            Risk Management & Kill Switch
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Automated capital protection: Dynamic lot sizing from SL distance, % risk controls, and automated Kill Switch.
          </p>
        </div>

        <button
          onClick={handleSaveSettings}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50"
        >
          {saveSuccess ? (
            <>
              <CheckCircle2 className="w-4 h-4 text-slate-950" /> Settings Saved!
            </>
          ) : (
            <>
              <SaveIcon className="w-4 h-4" /> Save Risk Settings
            </>
          )}
        </button>
      </div>

      {/* KILL SWITCH BANNER */}
      {killSwitchActive ? (
        <div className="p-6 rounded-2xl bg-rose-950/80 border-2 border-rose-500 text-rose-200 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 animate-pulse">
          <div className="flex items-start gap-3">
            <AlertOctagon className="w-8 h-8 text-rose-400 shrink-0 mt-1" />
            <div>
              <h2 className="text-lg font-black text-white tracking-wide">🚨 KILL SWITCH ACTIVE — TRADING FROZEN</h2>
              <p className="text-xs text-rose-300 mt-1">
                {killSwitchReason || 'Daily loss limit reached. All positions force closed. No new trades allowed today.'}
              </p>
            </div>
          </div>
          <button
            onClick={handleResetKillSwitch}
            className="px-4 py-2 rounded-xl bg-slate-950 border border-rose-500/50 hover:bg-slate-900 text-white text-xs font-bold shrink-0"
          >
            Disarm / Reset Kill Switch
          </button>
        </div>
      ) : (
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-emerald-400 animate-ping"></div>
            <div>
              <span className="text-xs font-bold text-emerald-400 tracking-wide uppercase">Kill Switch Armed & Active</span>
              <p className="text-xs text-slate-400">Monitoring real-time P&L. If daily loss exceeds {maxDailyLossPct}%, trading stops instantly.</p>
            </div>
          </div>
          <button
            onClick={handleTriggerKillSwitch}
            className="px-3.5 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-bold transition-all"
          >
            Emergency Trip Kill Switch
          </button>
        </div>
      )}

      {/* Top Cards: Wallet & Daily Limit */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs font-medium text-slate-400">
            <span>Trading Wallet Balance</span>
            <Wallet className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-white">
              ₹{walletBalance.toLocaleString('en-IN')}
            </span>
          </div>
          <span className="text-[11px] text-emerald-400 block">Auto-synced with connected broker</span>
        </div>

        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs font-medium text-slate-400">
            <span>Max Daily Loss Limit</span>
            <span className="text-xs font-mono font-bold text-rose-400">{maxDailyLossPct}%</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-rose-400">
              -₹{maxDailyLossAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </span>
          </div>
          <span className="text-[11px] text-slate-500 block">Circuit breaker trips when hit</span>
        </div>

        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs font-medium text-slate-400">
            <span>Per Trade Risk Limit</span>
            <span className="text-xs font-mono font-bold text-cyan-400">{perTradeRiskPct}%</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-cyan-400">
              ₹{perTradeRiskAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </span>
          </div>
          <span className="text-[11px] text-slate-500 block">Fixed risk per executed order</span>
        </div>
      </div>

      {/* Core Risk Sliders & Parameters */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-6">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Sliders className="w-5 h-5 text-emerald-400" /> Capital & Risk Controls
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Daily Max Loss Slider */}
          <div className="p-5 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-200">Max Daily Loss Limit (%)</label>
              <span className="text-sm font-bold font-mono text-rose-400">{maxDailyLossPct}%</span>
            </div>
            <input
              type="range"
              min="1.0"
              max="10.0"
              step="0.5"
              value={maxDailyLossPct}
              onChange={(e) => setMaxDailyLossPct(Number(e.target.value))}
              className="w-full accent-rose-500 cursor-pointer"
            />
            <div className="flex items-center justify-between text-[11px] text-slate-500">
              <span>Conservative (1%)</span>
              <span>Moderate (3%)</span>
              <span>Aggressive (10%)</span>
            </div>
            <p className="text-[11px] text-slate-400 pt-1 border-t border-slate-800/80">
              If your cumulative daily loss reaches <strong className="text-rose-400">-₹{maxDailyLossAmount.toLocaleString()}</strong>, the Kill Switch will auto-halt all trading.
            </p>
          </div>

          {/* Per Trade Risk Slider */}
          <div className="p-5 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-200">Per-Trade Risk Allocation (%)</label>
              <span className="text-sm font-bold font-mono text-cyan-400">{perTradeRiskPct}%</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="5.0"
              step="0.25"
              value={perTradeRiskPct}
              onChange={(e) => setPerTradeRiskPct(Number(e.target.value))}
              className="w-full accent-cyan-500 cursor-pointer"
            />
            <div className="flex items-center justify-between text-[11px] text-slate-500">
              <span>Safe (0.5%)</span>
              <span>Standard (1.0%)</span>
              <span>High (5.0%)</span>
            </div>
            <p className="text-[11px] text-slate-400 pt-1 border-t border-slate-800/80">
              Every trade will risk at most <strong className="text-cyan-400">₹{perTradeRiskAmount.toLocaleString()}</strong>. Lot size is calculated automatically from SL distance.
            </p>
          </div>

          {/* Custom Wallet Balance Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Wallet Capital Base (₹)</label>
            <input
              type="number"
              value={walletBalance}
              onChange={(e) => setWalletBalance(Number(e.target.value))}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono text-xs focus:border-emerald-500 focus:outline-none"
            />
            <span className="text-[11px] text-slate-500">Used as reference base for % calculations</span>
          </div>

          {/* Max Open Trades */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Max Concurrent Open Trades</label>
            <input
              type="number"
              min="1"
              max="5"
              value={maxOpenTrades}
              onChange={(e) => setMaxOpenTrades(Number(e.target.value))}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono text-xs focus:border-emerald-500 focus:outline-none"
            />
            <span className="text-[11px] text-slate-500">Limits over-exposure across multiple strategies</span>
          </div>
        </div>
      </div>

      {/* Dynamic Lot Sizer Simulator */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Calculator className="w-5 h-5 text-cyan-400" />
          Dynamic Position Sizing Simulator
        </h2>
        <p className="text-xs text-slate-400">
          See how your lot size will be dynamically calculated when a trade signal is detected:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Instrument</label>
            <select
              value={simSymbol}
              onChange={(e: any) => setSimSymbol(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs"
            >
              <option value="NIFTY">NIFTY (Lot: 25)</option>
              <option value="BANKNIFTY">BANKNIFTY (Lot: 15)</option>
              <option value="BTCUSD">BTCUSD (Delta Crypto)</option>
              <option value="EURUSD">EURUSD (MetaTrader 5)</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">SL Distance (Points)</label>
            <input
              type="number"
              value={simSlPoints}
              onChange={(e) => setSimSlPoints(Number(e.target.value))}
              min="1"
              max="500"
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono text-xs"
            />
          </div>

          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex flex-col justify-center">
            <span className="text-[11px] text-slate-400">Auto-Calculated Position:</span>
            <div className="text-base font-bold font-mono text-emerald-400">
              {simCalculatedQty} {simSymbol === 'EURUSD' ? 'Lots' : 'Qty'}
            </div>
            <span className="text-[10px] text-slate-500">
              Total Risk: ₹{(simCalculatedQty * simSlPoints).toLocaleString()} ({(perTradeRiskPct)}% of wallet)
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
