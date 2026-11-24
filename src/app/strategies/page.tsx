'use client';

import { useState, useEffect } from 'react';
import { 
  Cpu, 
  Check, 
  Zap, 
  Coins, 
  Percent, 
  ShieldAlert, 
  Layers, 
  CheckCircle2, 
  ShieldCheck,
  TrendingDown,
  Gauge
} from 'lucide-react';

export default function StrategiesPage() {
  // Step 1: Strategy A, B, or C
  const [selectedStrategy, setSelectedStrategy] = useState<'Strategy A' | 'Strategy B' | 'Strategy C'>('Strategy A');
  
  // Step 2: Selected Instruments (BTC, ETH, SOL, XRP)
  const [selectedInstrument, setSelectedInstrument] = useState<'BTCUSD' | 'ETHUSD' | 'SOLUSD' | 'XRPUSD'>('BTCUSD');

  // Step 3: Daily Loss in %
  const [dailyLossPct, setDailyLossPct] = useState<number>(15);

  // Step 4: Per Trade Loss in %
  const [perTradeRiskPct, setPerTradeRiskPct] = useState<number>(5);

  // Step 5: Max 3 Trades a Day
  const [maxTradesPerDay] = useState<number>(3);

  // State
  const [paperTrading, setPaperTrading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchActiveStrategy();
  }, []);

  const fetchActiveStrategy = async () => {
    try {
      const res = await fetch('/api/strategies');
      const data = await res.json();
      if (data.strategy) {
        const s = data.strategy;
        if (s.name === 'Strategy A' || s.name === 'Strategy B' || s.name === 'Strategy C') {
          setSelectedStrategy(s.name);
        }
        if (s.symbol && ['BTCUSD', 'ETHUSD', 'SOLUSD', 'XRPUSD'].includes(s.symbol.toUpperCase())) {
          setSelectedInstrument(s.symbol.toUpperCase() as any);
        }
        if (s.parameters?.daily_loss_pct) setDailyLossPct(s.parameters.daily_loss_pct);
        if (s.parameters?.per_trade_risk_pct) setPerTradeRiskPct(s.parameters.per_trade_risk_pct);
        setPaperTrading(s.paper_trading ?? true);
      }
    } catch (err) {
      console.error('Failed to load strategy:', err);
    }
  };

  const handleSaveAndActivate = async () => {
    setSaving(true);
    setSuccessMessage(null);

    try {
      const res = await fetch('/api/strategies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: 'master-crypto-active',
          name: selectedStrategy,
          broker_name: 'DELTA',
          symbol: selectedInstrument,
          dailyLossPct,
          perTradeRiskPct,
          maxTradesPerDay: 3,
          leverageMode: 'MEDIUM',
          is_active: true,
          paper_trading: paperTrading,
        }),
      });

      if (res.ok) {
        setSuccessMessage(`Activated: ${selectedStrategy} on ${selectedInstrument.replace('USD', '')} (${dailyLossPct}% Daily Loss, ${perTradeRiskPct}% Risk/Trade, Max 3 Trades/Day, Medium Leverage)`);
        setTimeout(() => setSuccessMessage(null), 4000);
      }
    } catch (err: any) {
      console.error('Failed to save strategy:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8 max-w-3xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Cpu className="w-6 h-6 text-emerald-400" />
            Strategy Setup
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Choose strategy, target instrument, and risk limits in a simple sequential setup.
          </p>
        </div>

        {/* Paper vs Live Toggle */}
        <button
          onClick={() => setPaperTrading(!paperTrading)}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all border self-start sm:self-auto ${
            paperTrading
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
              : 'bg-rose-500 text-white shadow-lg shadow-rose-500/30'
          }`}
        >
          {paperTrading ? '🟢 PAPER TRADING' : '🔴 REAL MONEY LIVE'}
        </button>
      </div>

      {/* Success Notification */}
      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-2 shadow-lg">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* STEP 1: Select Strategy (A, B, or C) */}
      <div className="p-5 sm:p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 shadow-xl">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center text-xs font-bold">1</span>
          <h2 className="text-base font-bold text-white">Select Strategy</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {(['Strategy A', 'Strategy B', 'Strategy C'] as const).map((strat) => {
            const isSelected = selectedStrategy === strat;
            return (
              <button
                key={strat}
                type="button"
                onClick={() => setSelectedStrategy(strat)}
                className={`p-4 rounded-xl text-center border font-bold text-sm transition-all flex flex-col items-center justify-center gap-2 ${
                  isSelected
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500 shadow-lg shadow-emerald-500/20'
                    : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span>{strat}</span>
                  {isSelected && <Check className="w-4 h-4 text-emerald-400 stroke-[3]" />}
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                  isSelected ? 'bg-emerald-500/30 text-emerald-200' : 'bg-slate-900 text-slate-500'
                }`}>
                  {isSelected ? 'Selected' : 'Click to select'}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* STEP 2: Select Instruments (BTC, ETH, SOL, XRP) */}
      <div className="p-5 sm:p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 shadow-xl">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center text-xs font-bold">2</span>
          <h2 className="text-base font-bold text-white">Select Instrument</h2>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {([
            { id: 'BTCUSD', name: 'BTC (Bitcoin)' },
            { id: 'ETHUSD', name: 'ETH (Ethereum)' },
            { id: 'SOLUSD', name: 'SOL (Solana)' },
            { id: 'XRPUSD', name: 'XRP (Ripple)' },
          ] as const).map((coin) => {
            const isSelected = selectedInstrument === coin.id;
            return (
              <button
                key={coin.id}
                type="button"
                onClick={() => setSelectedInstrument(coin.id)}
                className={`p-3.5 rounded-xl text-center border font-bold text-sm transition-all flex flex-col items-center justify-center gap-1 ${
                  isSelected
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500 shadow-lg shadow-cyan-500/20'
                    : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Coins className={`w-4 h-4 ${isSelected ? 'text-cyan-400' : 'text-slate-500'}`} />
                  <span>{coin.id.replace('USD', '')}</span>
                  {isSelected && <Check className="w-3.5 h-3.5 text-cyan-400 stroke-[3]" />}
                </div>
                <span className="text-[10px] text-slate-400">{coin.name.split(' ')[1]?.replace(/[()]/g, '')}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* STEP 3 & 4: Daily Loss % and Per-Trade Loss % */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Daily Loss in % */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3 shadow-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center text-xs font-bold">3</span>
              <label className="text-xs font-bold text-slate-200">Daily Loss in %</label>
            </div>
            <span className="text-lg font-black font-mono text-rose-400">{dailyLossPct}%</span>
          </div>

          <input
            type="range"
            min="5"
            max="30"
            step="1"
            value={dailyLossPct}
            onChange={(e) => setDailyLossPct(Number(e.target.value))}
            className="w-full accent-rose-500 cursor-pointer h-2 bg-slate-800 rounded-lg"
          />

          <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
            <span>5%</span>
            <span className="text-rose-400 font-semibold">15% Default</span>
            <span>30%</span>
          </div>
        </div>

        {/* Per Trade Loss in % */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3 shadow-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center text-xs font-bold">4</span>
              <label className="text-xs font-bold text-slate-200">Per Trade Loss in %</label>
            </div>
            <span className="text-lg font-black font-mono text-cyan-400">{perTradeRiskPct}%</span>
          </div>

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
            <span className="text-cyan-400 font-semibold">5% Default</span>
            <span>15%</span>
          </div>
        </div>
      </div>

      {/* STEP 5 & 6: Max 3 Trades a Day & Medium Leverage */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Max 3 Trades a Day */}
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between shadow-md">
          <div className="flex items-center gap-2.5">
            <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center text-xs font-bold">5</span>
            <div>
              <span className="text-xs font-bold text-white">Max Trades a Day</span>
              <p className="text-[11px] text-slate-400">Strict ceiling per 24hr cycle</p>
            </div>
          </div>
          <span className="px-3 py-1 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-black text-sm">
            Max 3 Trades
          </span>
        </div>

        {/* Dynamic Medium Leverage */}
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between shadow-md">
          <div className="flex items-center gap-2.5">
            <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center text-xs font-bold">6</span>
            <div>
              <span className="text-xs font-bold text-white">Dynamic Leverage</span>
              <p className="text-[11px] text-slate-400">Calculated on Entry & Stop Loss</p>
            </div>
          </div>
          <span className="px-3 py-1 rounded-lg bg-amber-500/15 text-amber-400 border border-amber-500/30 font-black text-xs">
            Medium Mode (5x-10x)
          </span>
        </div>
      </div>

      {/* Activate & Save Button */}
      <div className="pt-2">
        <button
          onClick={handleSaveAndActivate}
          disabled={saving}
          className="w-full py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-sm transition-all shadow-xl shadow-emerald-500/25 flex items-center justify-center gap-2 disabled:opacity-50 active:scale-98"
        >
          {saving ? (
            'Activating...'
          ) : (
            <>
              <Check className="w-5 h-5 text-slate-950 stroke-[3]" />
              Save & Activate {selectedStrategy} on {selectedInstrument.replace('USD', '')}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
