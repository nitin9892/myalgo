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
  Gauge,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  Target
} from 'lucide-react';

export default function StrategiesPage() {
  // Step 1: Strategy A, B, or C (Strategy C is the 6 Setups Engine: PDH, PDL, PDC)
  const [selectedStrategy, setSelectedStrategy] = useState<'Strategy A' | 'Strategy B' | 'Strategy C'>('Strategy C');
  
  // Step 2: Multiple Selected Instruments (BTC, ETH, SOL, XRP)
  const [selectedInstruments, setSelectedInstruments] = useState<string[]>(['BTCUSD', 'ETHUSD', 'SOLUSD', 'XRPUSD']);

  // Step 3: Daily Loss in %
  const [dailyLossPct, setDailyLossPct] = useState<number>(15);

  // Step 4: Per Trade Loss in %
  const [perTradeRiskPct, setPerTradeRiskPct] = useState<number>(5);

  // Step 5: Max 3 Trades a Day
  const [maxTradesPerDay] = useState<number>(3);

  // Step 6: Leverage Mode & Manual Leverage
  const [leverageMode, setLeverageMode] = useState<'MANUAL' | 'DYNAMIC'>('MANUAL');
  const [manualLeverage, setManualLeverage] = useState<number>(10);

  // State
  const [saving, setSaving] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const availableCoins = [
    { id: 'BTCUSD', name: 'Bitcoin', tag: 'BTC' },
    { id: 'ETHUSD', name: 'Ethereum', tag: 'ETH' },
    { id: 'SOLUSD', name: 'Solana', tag: 'SOL' },
    { id: 'XRPUSD', name: 'Ripple', tag: 'XRP' },
  ] as const;

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
        if (s.parameters?.symbols && Array.isArray(s.parameters.symbols) && s.parameters.symbols.length > 0) {
          setSelectedInstruments(s.parameters.symbols);
        } else if (s.symbol) {
          const parsed = s.symbol.split(',').map((x: string) => x.trim().toUpperCase()).filter(Boolean);
          if (parsed.length > 0) setSelectedInstruments(parsed);
        }
        if (s.parameters?.daily_loss_pct) setDailyLossPct(s.parameters.daily_loss_pct);
        if (s.parameters?.per_trade_risk_pct) setPerTradeRiskPct(s.parameters.per_trade_risk_pct);
        if (s.parameters?.leverage_mode) {
          setLeverageMode(s.parameters.leverage_mode.toUpperCase() === 'DYNAMIC' ? 'DYNAMIC' : 'MANUAL');
        }
        if (s.parameters?.leverage) {
          setManualLeverage(Number(s.parameters.leverage) || 10);
        }
      }
    } catch (err) {
      console.error('Failed to load strategy:', err);
    }
  };

  const toggleInstrument = (coinId: string) => {
    setSelectedInstruments((prev) => {
      if (prev.includes(coinId)) {
        if (prev.length === 1) return prev; // Keep at least one selected
        return prev.filter((id) => id !== coinId);
      } else {
        return [...prev, coinId];
      }
    });
  };

  const toggleSelectAll = () => {
    if (selectedInstruments.length === 4) {
      setSelectedInstruments(['BTCUSD']);
    } else {
      setSelectedInstruments(['BTCUSD', 'ETHUSD', 'SOLUSD', 'XRPUSD']);
    }
  };

  const handleSaveAndActivate = async () => {
    setSaving(true);
    setSuccessMessage(null);

    const symbolsText = selectedInstruments.join(',');
    const coinTags = selectedInstruments.map((s) => s.replace('USD', '')).join(', ');

    try {
      const res = await fetch('/api/strategies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: 'master-crypto-active',
          name: selectedStrategy,
          broker_name: 'DELTA',
          symbol: symbolsText,
          symbols: selectedInstruments,
          dailyLossPct,
          perTradeRiskPct,
          maxTradesPerDay: 3,
          leverageMode,
          leverage: manualLeverage,
          is_active: true,
          paper_trading: false,
        }),
      });

      if (res.ok) {
        const levLabel = leverageMode === 'MANUAL' ? `${manualLeverage}x Manual Leverage` : 'Dynamic Medium Leverage (5x-10x)';
        setSuccessMessage(`Activated: ${selectedStrategy} on [${coinTags}] (${dailyLossPct}% Daily Loss, ${perTradeRiskPct}% Risk/Trade, Max 3 Trades/Day, ${levLabel})`);
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
            Choose strategy, target instruments (multi-select enabled), and risk limits.
          </p>
        </div>

        {/* Live Execution Indicator */}
        <div className="flex items-center gap-2 bg-slate-900 px-3.5 py-2 rounded-xl border border-slate-800 self-start sm:self-auto text-xs">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span className="font-bold text-emerald-400">100% Real Live Trading</span>
        </div>
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
          {([
            { id: 'Strategy A', label: 'Strategy A', tag: 'Slot A (Pending)' },
            { id: 'Strategy B', label: 'Strategy B', tag: 'Slot B (Pending)' },
            { id: 'Strategy C', label: 'Strategy C', tag: '🔥 6 Setups Engine (Active)' },
          ] as const).map((strat) => {
            const isSelected = selectedStrategy === strat.id;
            return (
              <button
                key={strat.id}
                type="button"
                onClick={() => setSelectedStrategy(strat.id)}
                className={`p-4 rounded-xl text-center border font-bold text-sm transition-all flex flex-col items-center justify-center gap-1.5 ${
                  isSelected
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500 shadow-lg shadow-emerald-500/20'
                    : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span>{strat.label}</span>
                  {isSelected && <Check className="w-4 h-4 text-emerald-400 stroke-[3]" />}
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                  isSelected ? 'bg-emerald-500/30 text-emerald-200' : 'bg-slate-900 text-slate-500'
                }`}>
                  {strat.tag}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* STEP 2: Select Instruments (Multiple Selection Enabled) */}
      <div className="p-5 sm:p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center text-xs font-bold">2</span>
            <div>
              <h2 className="text-base font-bold text-white">Select Instruments (Multiple)</h2>
              <p className="text-[11px] text-slate-400">Tap to toggle any coin. Strategy will scan all selected coins.</p>
            </div>
          </div>

          <button
            type="button"
            onClick={toggleSelectAll}
            className="text-xs text-cyan-400 hover:text-cyan-300 px-3 py-1 rounded-lg bg-slate-950 border border-slate-800 font-semibold"
          >
            {selectedInstruments.length === 4 ? 'Reset to 1' : 'Select All 4'}
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {availableCoins.map((coin) => {
            const isSelected = selectedInstruments.includes(coin.id);
            return (
              <button
                key={coin.id}
                type="button"
                onClick={() => toggleInstrument(coin.id)}
                className={`p-3.5 rounded-xl text-center border font-bold text-sm transition-all flex flex-col items-center justify-center gap-1.5 ${
                  isSelected
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500 shadow-lg shadow-cyan-500/20'
                    : 'bg-slate-950 text-slate-400 border-slate-800/80 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Coins className={`w-4 h-4 ${isSelected ? 'text-cyan-400' : 'text-slate-500'}`} />
                  <span>{coin.tag}</span>
                  {isSelected && <Check className="w-3.5 h-3.5 text-cyan-400 stroke-[3]" />}
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                  isSelected ? 'bg-cyan-500/30 text-cyan-200' : 'bg-slate-900 text-slate-500'
                }`}>
                  {isSelected ? '✓ Active' : '+ Tap to add'}
                </span>
              </button>
            );
          })}
        </div>

        <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
          <span>Active Scanner Instruments:</span>
          <span className="font-bold font-mono text-cyan-400">
            {selectedInstruments.map((s) => s.replace('USD', '')).join(', ')} ({selectedInstruments.length}/4)
          </span>
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

      {/* STEP 5: Max 3 Trades a Day */}
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-2.5">
          <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center text-xs font-bold">5</span>
          <div>
            <span className="text-xs font-bold text-white">Max Trades a Day</span>
            <p className="text-[11px] text-slate-400">Strict ceiling per 24hr cycle (resets 01:00 AM IST)</p>
          </div>
        </div>
        <span className="px-3 py-1 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-black text-sm">
          Max 3 Trades
        </span>
      </div>

      {/* STEP 6: Leverage Mode (Manual Leverage Option vs Dynamic Medium) */}
      <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4 shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center text-xs font-bold">6</span>
            <div>
              <span className="text-xs font-bold text-white">Leverage Mode & Multiplier</span>
              <p className="text-[11px] text-slate-400">Choose custom manual leverage or auto dynamic medium mode</p>
            </div>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setLeverageMode('MANUAL')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                leverageMode === 'MANUAL'
                  ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Manual Leverage
            </button>
            <button
              type="button"
              onClick={() => setLeverageMode('DYNAMIC')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                leverageMode === 'DYNAMIC'
                  ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Dynamic Medium (5x-10x)
            </button>
          </div>
        </div>

        {leverageMode === 'MANUAL' ? (
          <div className="space-y-3.5 pt-3 border-t border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300">Selected Manual Leverage:</span>
              <span className="text-lg font-black font-mono text-amber-400 bg-amber-500/15 border border-amber-500/30 px-3.5 py-1 rounded-xl shadow-sm">
                {manualLeverage}x
              </span>
            </div>

            {/* Quick Preset Buttons */}
            <div>
              <label className="text-[11px] text-slate-400 mb-1.5 block font-medium">Quick Select Presets:</label>
              <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                {[2, 3, 5, 10, 15, 20, 25, 50].map((lev) => (
                  <button
                    key={lev}
                    type="button"
                    onClick={() => setManualLeverage(lev)}
                    className={`py-2 rounded-lg text-xs font-bold border transition-all ${
                      manualLeverage === lev
                        ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-lg shadow-amber-500/20 font-black scale-105'
                        : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700 hover:text-white'
                    }`}
                  >
                    {lev}x
                  </button>
                ))}
              </div>
            </div>

            {/* Precision Slider */}
            <div className="space-y-1.5 pt-1">
              <input
                type="range"
                min="1"
                max="50"
                step="1"
                value={manualLeverage}
                onChange={(e) => setManualLeverage(Number(e.target.value))}
                className="w-full accent-amber-500 cursor-pointer h-2 bg-slate-800 rounded-lg"
              />
              <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
                <span>1x (Min)</span>
                <span className="text-amber-400 font-semibold">10x Default</span>
                <span>50x (Max)</span>
              </div>
            </div>

            <p className="text-[11px] text-slate-400 bg-slate-950/70 p-3 rounded-xl border border-slate-800/80 leading-relaxed">
              ⚡ Orders will be executed directly with fixed <strong className="text-amber-400 font-bold">{manualLeverage}x</strong> leverage. Margin requirement is calculated on entry size divided by {manualLeverage}.
            </p>
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-300">Dynamic Medium Leverage Engine</span>
              <span className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-400 font-black text-xs border border-amber-500/30">
                5x – 10x Auto Scaled
              </span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Leverage is dynamically calculated on every trade based on entry price and distance to signal candle stop loss. Tighter stops get up to 10x leverage; wider stops are auto-reduced to 5x-3x to strictly safeguard capital.
            </p>
          </div>
        )}
      </div>

      {/* 6 Core Setups Rule Matrix (PDH, PDL, PDC) */}
      <div className="p-5 sm:p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base font-bold text-white">6 Core Setups Engine (PDH • PDL • PDC)</h2>
          </div>
          <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
            1:3 Target Ratio
          </span>
        </div>

        <p className="text-xs text-slate-400 leading-relaxed">
          Strategy evaluates 6 core setups based on Yesterday High (PDH), Low (PDL), and Close (PDC). Entry triggers when the next candle breaks the signal candle high/low. Stop Loss is set at the opposite end of the signal candle.
        </p>

        {/* Setups Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800 text-[11px]">
              <tr>
                <th className="py-2.5 px-3">Key Level</th>
                <th className="py-2.5 px-3">BUY Setup (1:3 RR)</th>
                <th className="py-2.5 px-3">SELL Setup (1:3 RR)</th>
                <th className="py-2.5 px-3">Stop Loss Rule</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 font-mono">
              <tr className="hover:bg-slate-800/30 transition-colors">
                <td className="py-2.5 px-3 font-sans font-bold text-slate-200 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  Yesterday High (PDH)
                </td>
                <td className="py-2.5 px-3 text-emerald-400 font-bold">
                  Setup 1: PDH Breakout BUY
                </td>
                <td className="py-2.5 px-3 text-rose-400 font-bold">
                  Setup 2: PDH Breakdown SELL
                </td>
                <td className="py-2.5 px-3 text-slate-400 font-sans text-[11px]">
                  Signal Candle Opposite End
                </td>
              </tr>
              <tr className="hover:bg-slate-800/30 transition-colors">
                <td className="py-2.5 px-3 font-sans font-bold text-slate-200 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
                  Yesterday Low (PDL)
                </td>
                <td className="py-2.5 px-3 text-emerald-400 font-bold">
                  Setup 3: PDL Breakout BUY
                </td>
                <td className="py-2.5 px-3 text-rose-400 font-bold">
                  Setup 4: PDL Breakdown SELL
                </td>
                <td className="py-2.5 px-3 text-slate-400 font-sans text-[11px]">
                  Signal Candle Opposite End
                </td>
              </tr>
              <tr className="hover:bg-slate-800/30 transition-colors bg-emerald-500/5">
                <td className="py-2.5 px-3 font-sans font-bold text-slate-200 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                  Yesterday Close (PDC)
                </td>
                <td className="py-2.5 px-3 text-emerald-400 font-bold">
                  Setup 5: PDC Breakout BUY
                </td>
                <td className="py-2.5 px-3 text-rose-400 font-bold">
                  Setup 6: PDC Breakdown SELL
                </td>
                <td className="py-2.5 px-3 text-slate-400 font-sans text-[11px]">
                  Signal Candle Opposite End
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Rule Highlight Pill */}
        <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px]">
          <span className="text-slate-300 font-medium flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span><strong>Target Formula:</strong> Entry ± (3 × SL Points) [Strict 1:3 RR]</span>
          </span>
          <span className="text-amber-400/90 font-medium">
            Next candle confirmation required
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
              Save & Activate {selectedStrategy} on [{selectedInstruments.map((s) => s.replace('USD', '')).join(', ')}]
            </>
          )}
        </button>
      </div>
    </div>
  );
}
