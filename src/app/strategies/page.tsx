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
  Target,
  Wallet,
  Power,
  Sliders,
  Sparkles
} from 'lucide-react';

export default function StrategiesPage() {
  // Master Algo Active State
  const [algoActive, setAlgoActive] = useState<boolean>(true);
  const [isTogglingAlgo, setIsTogglingAlgo] = useState(false);

  // Step 1: Broker A, B, or C
  const [selectedBroker, setSelectedBroker] = useState<'DELTA' | 'DHAN' | 'METATRADER'>('DELTA');

  // Step 2: Strategy A, B, or C (Strategy C is the 6 Setups Engine: PDH, PDL, PDC)
  const [selectedStrategy, setSelectedStrategy] = useState<'Strategy A' | 'Strategy B' | 'Strategy C'>('Strategy C');
  
  // Step 3: Multiple Selected Instruments
  const [selectedInstruments, setSelectedInstruments] = useState<string[]>(['BTCUSD', 'ETHUSD', 'SOLUSD', 'XRPUSD']);

  // Step 4: Daily Loss in %
  const [dailyLossPct, setDailyLossPct] = useState<number>(15);

  // Step 5: Per Trade Loss in %
  const [perTradeRiskPct, setPerTradeRiskPct] = useState<number>(5);

  // Step 6: Max 3 Trades a Day
  const [maxTradesPerDay] = useState<number>(3);

  // Step 7: Leverage Mode (Smart Balance Auto-Leverage vs Manual Leverage)
  const [leverageMode, setLeverageMode] = useState<'DYNAMIC' | 'MANUAL'>('DYNAMIC');
  const [manualLeverage, setManualLeverage] = useState<number>(10);

  // State
  const [saving, setSaving] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const brokerInstrumentsMap: Record<'DELTA' | 'DHAN' | 'METATRADER', { id: string; name: string; tag: string }[]> = {
    DELTA: [
      { id: 'BTCUSD', name: 'Bitcoin', tag: 'BTC' },
      { id: 'ETHUSD', name: 'Ethereum', tag: 'ETH' },
      { id: 'SOLUSD', name: 'Solana', tag: 'SOL' },
      { id: 'XRPUSD', name: 'Ripple', tag: 'XRP' },
    ],
    DHAN: [
      { id: 'NIFTY', name: 'Nifty 50 Futures', tag: 'NIFTY' },
      { id: 'BANKNIFTY', name: 'Bank Nifty Futures', tag: 'BNF' },
      { id: 'RELIANCE', name: 'Reliance Industries', tag: 'RELIANCE' },
      { id: 'HDFCBANK', name: 'HDFC Bank Ltd', tag: 'HDFCBANK' },
    ],
    METATRADER: [
      { id: 'EURUSD', name: 'EUR / USD Forex', tag: 'EURUSD' },
      { id: 'GBPUSD', name: 'GBP / USD Forex', tag: 'GBPUSD' },
      { id: 'XAUUSD', name: 'Gold / USD CFD', tag: 'XAUUSD' },
      { id: 'USDJPY', name: 'USD / JPY Forex', tag: 'USDJPY' },
    ],
  };

  useEffect(() => {
    fetchActiveStrategy();
  }, []);

  const fetchActiveStrategy = async () => {
    try {
      const res = await fetch('/api/strategies');
      const data = await res.json();
      if (data.strategy) {
        const s = data.strategy;
        if (s.is_active !== undefined) {
          setAlgoActive(Boolean(s.is_active));
        }
        if (s.broker_name === 'DELTA' || s.broker_name === 'DHAN' || s.broker_name === 'METATRADER') {
          setSelectedBroker(s.broker_name);
        }
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
          setLeverageMode(s.parameters.leverage_mode.toUpperCase() === 'MANUAL' ? 'MANUAL' : 'DYNAMIC');
        }
        if (s.parameters?.leverage) {
          setManualLeverage(Number(s.parameters.leverage) || 10);
        }
      }
    } catch (err) {
      console.error('Failed to load strategy:', err);
    }
  };

  const handleSelectBroker = (brokerKey: 'DELTA' | 'DHAN' | 'METATRADER') => {
    setSelectedBroker(brokerKey);
    const defaults = brokerInstrumentsMap[brokerKey].map((c) => c.id);
    setSelectedInstruments(defaults);
  };

  const handleToggleAlgoSwitch = async () => {
    const nextState = !algoActive;
    setIsTogglingAlgo(true);
    try {
      const res = await fetch('/api/strategies', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: nextState }),
      });
      const data = await res.json();
      if (data.success) {
        setAlgoActive(data.is_active);
      }
    } catch (err) {
      console.error('Failed to toggle algo switch:', err);
    } finally {
      setIsTogglingAlgo(false);
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
    const available = brokerInstrumentsMap[selectedBroker];
    if (selectedInstruments.length === available.length) {
      setSelectedInstruments([available[0].id]);
    } else {
      setSelectedInstruments(available.map((c) => c.id));
    }
  };

  const handleSaveAndActivate = async () => {
    setSaving(true);
    setSuccessMessage(null);

    const symbolsText = selectedInstruments.join(',');
    const brokerNameLabel = selectedBroker === 'DELTA' ? 'Broker A (Delta)' : (selectedBroker === 'DHAN' ? 'Broker B (Dhan)' : 'Broker C (MetaTrader)');

    try {
      const res = await fetch('/api/strategies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: 'master-strategy-active',
          name: selectedStrategy,
          broker_name: selectedBroker,
          symbol: symbolsText,
          symbols: selectedInstruments,
          dailyLossPct,
          perTradeRiskPct,
          maxTradesPerDay: 3,
          leverageMode,
          leverage: manualLeverage,
          is_active: algoActive,
          paper_trading: false,
        }),
      });

      if (res.ok) {
        const levLabel = leverageMode === 'MANUAL' ? `${manualLeverage}x Manual Leverage` : 'Smart Balance Auto-Leverage';
        setSuccessMessage(`Activated: ${selectedStrategy} on ${brokerNameLabel} [${symbolsText}] (${dailyLossPct}% Daily Loss, ${perTradeRiskPct}% Risk/Trade, Max 3 Trades/Day, ${levLabel})`);
        setTimeout(() => setSuccessMessage(null), 5000);
      }
    } catch (err: any) {
      console.error('Failed to save strategy:', err);
    } finally {
      setSaving(false);
    }
  };

  const activeBrokerCoins = brokerInstrumentsMap[selectedBroker];

  return (
    <div className="space-y-6 sm:space-y-8 max-w-3xl">
      {/* Header with Master Algo ON/OFF Switch */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Cpu className="w-6 h-6 text-emerald-400" />
            Strategy & Broker Configuration
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Configure Brokers A/B/C, Strategies A/B/C, smart balance-aware leverage, and risk limits.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto flex-wrap">
          {/* Master Algo ON/OFF Switch */}
          <button
            type="button"
            onClick={handleToggleAlgoSwitch}
            disabled={isTogglingAlgo}
            className={`flex items-center gap-2.5 px-3.5 py-2 rounded-xl border text-xs font-black transition-all shadow-md active:scale-95 disabled:opacity-50 ${
              algoActive
                ? 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border-emerald-500/40 shadow-emerald-500/10'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-400 border-slate-700'
            }`}
            title={algoActive ? 'Click to Pause Algo' : 'Click to Turn Algo ON'}
          >
            <div className={`w-7 h-4 rounded-full transition-colors relative flex items-center p-0.5 ${
              algoActive ? 'bg-emerald-500' : 'bg-slate-600'
            }`}>
              <div className={`w-3 h-3 rounded-full bg-white transition-transform ${
                algoActive ? 'translate-x-3' : 'translate-x-0'
              }`} />
            </div>
            <span>{algoActive ? 'ALGO ON' : 'ALGO PAUSED'}</span>
          </button>

          {/* Live Execution Indicator */}
          <div className="flex items-center gap-2 bg-slate-900 px-3 py-2 rounded-xl border border-slate-800 text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="font-bold text-emerald-400">100% Real Live Trading</span>
          </div>
        </div>
      </div>

      {/* Success Notification */}
      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-2 shadow-lg animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* STEP 1: Select Broker (Broker A, Broker B, Broker C) */}
      <div className="p-5 sm:p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center justify-center text-xs font-bold">1</span>
            <div>
              <h2 className="text-base font-bold text-white">Select Broker (A, B, or C)</h2>
              <p className="text-[11px] text-slate-400">Route strategy execution through your designated broker</p>
            </div>
          </div>
          <span className="text-[10px] font-mono font-bold text-purple-400 bg-purple-500/10 px-2.5 py-1 rounded-lg border border-purple-500/20">
            Active: {selectedBroker}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {([
            { id: 'DELTA' as const, code: 'Broker A', name: 'Delta Exchange', tag: 'Crypto Derivatives (BTC, ETH, SOL, XRP)' },
            { id: 'DHAN' as const, code: 'Broker B', name: 'DhanHQ API', tag: 'Indian Markets (NSE, Nifty, BNF)' },
            { id: 'METATRADER' as const, code: 'Broker C', name: 'MetaTrader 5', tag: 'Forex, Gold CFDs & Bridge' },
          ]).map((b) => {
            const isSelected = selectedBroker === b.id;
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => handleSelectBroker(b.id)}
                className={`p-4 rounded-xl text-left border transition-all flex flex-col justify-between gap-2 ${
                  isSelected
                    ? 'bg-purple-500/20 text-purple-200 border-purple-500 shadow-lg shadow-purple-500/20'
                    : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-[11px] font-black px-2 py-0.5 rounded-full ${
                    isSelected ? 'bg-purple-500/40 text-purple-200' : 'bg-slate-800 text-slate-400'
                  }`}>
                    {b.code}
                  </span>
                  {isSelected && <Check className="w-4 h-4 text-purple-400 stroke-[3]" />}
                </div>
                <div>
                  <div className="font-bold text-sm text-white">{b.name}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">{b.tag}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* STEP 2: Select Strategy (A, B, or C) */}
      <div className="p-5 sm:p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center text-xs font-bold">2</span>
            <div>
              <h2 className="text-base font-bold text-white">Select Strategy (A, B, or C)</h2>
              <p className="text-[11px] text-slate-400">Choose active algo model for execution</p>
            </div>
          </div>
          <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
            Selected: {selectedStrategy}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {([
            { id: 'Strategy A', label: 'Strategy A', tag: 'Slot A: Trend Breakout' },
            { id: 'Strategy B', label: 'Strategy B', tag: 'Slot B: Mean Reversion' },
            { id: 'Strategy C', label: 'Strategy C', tag: '🔥 6 Setups Engine (Active Core)' },
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

      {/* STEP 3: Select Instruments (Multiple Selection Enabled) */}
      <div className="p-5 sm:p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center text-xs font-bold">3</span>
            <div>
              <h2 className="text-base font-bold text-white">Select Instruments ({selectedBroker})</h2>
              <p className="text-[11px] text-slate-400">Multi-select enabled. Algo scans all selected instruments simultaneously.</p>
            </div>
          </div>

          <button
            type="button"
            onClick={toggleSelectAll}
            className="text-xs text-cyan-400 hover:text-cyan-300 px-3 py-1 rounded-lg bg-slate-950 border border-slate-800 font-semibold"
          >
            {selectedInstruments.length === activeBrokerCoins.length ? 'Reset to 1' : `Select All ${activeBrokerCoins.length}`}
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {activeBrokerCoins.map((coin) => {
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
          <span>Active Scanner Targets:</span>
          <span className="font-bold font-mono text-cyan-400">
            {selectedInstruments.join(', ')} ({selectedInstruments.length}/{activeBrokerCoins.length})
          </span>
        </div>
      </div>

      {/* STEP 4 & 5: Daily Loss % and Per-Trade Loss % */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Daily Loss in % */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3 shadow-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center text-xs font-bold">4</span>
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
              <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center text-xs font-bold">5</span>
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

      {/* STEP 6: Max 3 Trades a Day */}
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-2.5">
          <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center text-xs font-bold">6</span>
          <div>
            <span className="text-xs font-bold text-white">Max Trades a Day</span>
            <p className="text-[11px] text-slate-400">Strict ceiling per 24hr cycle (resets 01:00 AM IST daily)</p>
          </div>
        </div>
        <span className="px-3 py-1 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-black text-sm">
          Max 3 Trades
        </span>
      </div>

      {/* STEP 7: Leverage Mode (Smart Balance Auto-Leverage vs Manual Leverage) */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center text-xs font-bold">7</span>
            <div>
              <span className="text-xs font-bold text-white">Leverage Management Engine</span>
              <p className="text-[11px] text-slate-400">Smart balance-aware auto leverage or manual fixed multiplier</p>
            </div>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setLeverageMode('DYNAMIC')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                leverageMode === 'DYNAMIC'
                  ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              Smart Auto (Balance-Aware)
            </button>
            <button
              type="button"
              onClick={() => setLeverageMode('MANUAL')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                leverageMode === 'MANUAL'
                  ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Manual Fixed
            </button>
          </div>
        </div>

        {leverageMode === 'DYNAMIC' ? (
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="text-xs font-bold text-amber-300">Smart Capital & Risk-Aware Auto-Leverage</span>
              </div>
              <span className="px-2.5 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-400 font-mono font-black text-xs border border-emerald-500/30">
                Active Dynamic
              </span>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Algo dynamically adapts leverage on every order based on live account balance and Stop Loss distance:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs font-mono">
              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                <div className="text-slate-400 text-[10px]">CAPITAL &lt; ₹25,000</div>
                <div className="font-bold text-amber-400 mt-0.5">5x – 10x Max</div>
                <div className="text-[10px] text-slate-500">Conservative safety mode</div>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                <div className="text-slate-400 text-[10px]">₹25k – ₹1,00,000</div>
                <div className="font-bold text-cyan-400 mt-0.5">10x – 20x Max</div>
                <div className="text-[10px] text-slate-500">Balanced growth mode</div>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                <div className="text-slate-400 text-[10px]">CAPITAL &gt; ₹1,00,000</div>
                <div className="font-bold text-emerald-400 mt-0.5">25x – 50x Max</div>
                <div className="text-[10px] text-slate-500">Capital-efficient mode</div>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/25 text-[11px] text-amber-300 space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-amber-200">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                <span>Liquidation Distance Protection (Strict Rule)</span>
              </div>
              <p className="text-slate-300 text-[11px] leading-relaxed">
                Liquidation price is mathematically guaranteed to be at least <strong>3.5x further</strong> than your Stop Loss distance. If SL is 2%, max allowed leverage is capped to 14x, preventing liquidation before SL triggers.
              </p>
            </div>
          </div>
        ) : (
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
                {[2, 5, 10, 15, 20, 25, 50, 100].map((lev) => (
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
                max="100"
                step="1"
                value={manualLeverage}
                onChange={(e) => setManualLeverage(Number(e.target.value))}
                className="w-full accent-amber-500 cursor-pointer h-2 bg-slate-800 rounded-lg"
              />
              <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
                <span>1x (Min)</span>
                <span className="text-amber-400 font-semibold">10x Default</span>
                <span>100x (Max)</span>
              </div>
            </div>

            <p className="text-[11px] text-slate-400 bg-slate-950/70 p-3 rounded-xl border border-slate-800/80 leading-relaxed">
              ⚡ Orders will be executed directly with fixed <strong className="text-amber-400 font-bold">{manualLeverage}x</strong> leverage. Margin requirement is calculated on entry size divided by {manualLeverage}.
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
              Save & Activate {selectedStrategy} on {selectedBroker === 'DELTA' ? 'Broker A (Delta)' : (selectedBroker === 'DHAN' ? 'Broker B (Dhan)' : 'Broker C (MetaTrader)')} [{selectedInstruments.join(', ')}]
            </>
          )}
        </button>
      </div>
    </div>
  );
}
