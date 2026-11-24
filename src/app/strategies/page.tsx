'use client';

import { useState, useEffect } from 'react';
import { 
  Cpu, 
  Check, 
  Zap, 
  TrendingUp, 
  BarChart3, 
  Layers, 
  ShieldCheck,
  CheckCircle2,
  RefreshCw
} from 'lucide-react';

interface StrategyOption {
  id: string;
  name: string;
  badge: string;
  description: string;
}

const STRATEGIES_LIST: StrategyOption[] = [
  {
    id: 'master-5m-breakout',
    name: '5m Previous Day Breakout Engine',
    badge: 'Core Master Strategy',
    description: 'Auto-entry on 5-minute candle close beyond PDH/PDL with 1:3 RR target and dynamic step trailing.',
  },
  {
    id: 'master-5m-momentum',
    name: '5m Trend Momentum Rider',
    badge: 'Trend Following',
    description: 'Rides strong crypto impulse moves on high volume with trailing stop protection.',
  },
  {
    id: 'master-crypto-volatility',
    name: 'Crypto Volatility Breakout Engine',
    badge: 'High Volatility',
    description: 'Optimized for BTC, ETH, SOL, and XRP rapid expansion moves and fast profit capture.',
  },
  {
    id: 'master-mean-reversion',
    name: 'Mean Reversion & Liquidity Sweep',
    badge: 'Reversal Setup',
    description: 'Fades false breakouts after liquidity grabs at key support and resistance zones.',
  },
];

export default function StrategiesPage() {
  const [selectedStrategyId, setSelectedStrategyId] = useState<string>('master-5m-breakout');
  const [symbol, setSymbol] = useState<'BTCUSD' | 'ETHUSD' | 'SOLUSD' | 'XRPUSD'>('BTCUSD');
  const [paperTrading, setPaperTrading] = useState<boolean>(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchActiveStrategy();
  }, []);

  const fetchActiveStrategy = async () => {
    try {
      const res = await fetch('/api/strategies');
      const data = await res.json();
      if (data.strategy) {
        if (data.strategy.id) setSelectedStrategyId(data.strategy.id);
        if (data.strategy.symbol) {
          const sym = data.strategy.symbol.toUpperCase();
          if (['BTCUSD', 'ETHUSD', 'SOLUSD', 'XRPUSD'].includes(sym)) {
            setSymbol(sym as any);
          }
        }
        setPaperTrading(data.strategy.paper_trading ?? true);
      }
    } catch (err) {
      console.error('Failed to load strategy:', err);
    }
  };

  const handleSelectStrategy = async (strategy: StrategyOption) => {
    setSavingId(strategy.id);
    setSelectedStrategyId(strategy.id);

    try {
      const res = await fetch('/api/strategies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: strategy.id,
          name: strategy.name,
          broker_name: 'DELTA',
          symbol: symbol,
          timeframe: '5m',
          is_active: true,
          paper_trading: paperTrading,
          params: {
            sl_candle_mode: 'signal_candle',
            max_trades_per_day: 3,
            lot_size: 1,
            trail_step_points: 10,
            trail_amount_points: 3,
          },
        }),
      });

      if (res.ok) {
        setSuccessMessage(`Activated: ${strategy.name}`);
        setTimeout(() => setSuccessMessage(null), 3000);
      }
    } catch (err: any) {
      console.error('Failed to select strategy:', err);
    } finally {
      setSavingId(null);
    }
  };

  const handleSelectCoin = async (newSymbol: 'BTCUSD' | 'ETHUSD' | 'SOLUSD' | 'XRPUSD') => {
    setSymbol(newSymbol);
    const activeStrat = STRATEGIES_LIST.find((s) => s.id === selectedStrategyId) || STRATEGIES_LIST[0];
    try {
      await fetch('/api/strategies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: activeStrat.id,
          name: activeStrat.name,
          broker_name: 'DELTA',
          symbol: newSymbol,
          is_active: true,
          paper_trading: paperTrading,
        }),
      });
    } catch {}
  };

  const handleTogglePaper = async () => {
    const nextMode = !paperTrading;
    setPaperTrading(nextMode);
    const activeStrat = STRATEGIES_LIST.find((s) => s.id === selectedStrategyId) || STRATEGIES_LIST[0];
    try {
      await fetch('/api/strategies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: activeStrat.id,
          name: activeStrat.name,
          broker_name: 'DELTA',
          symbol: symbol,
          is_active: true,
          paper_trading: nextMode,
        }),
      });
    } catch {}
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Cpu className="w-6 h-6 text-emerald-400" />
            Select Trading Strategy
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Choose your automated strategy below. Only one master strategy runs at a time.
          </p>
        </div>

        {/* Paper vs Live Mode */}
        <button
          onClick={handleTogglePaper}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all border self-start sm:self-auto ${
            paperTrading
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
              : 'bg-rose-500 text-white shadow-lg shadow-rose-500/30'
          }`}
        >
          {paperTrading ? '🟢 PAPER TRADING' : '🔴 REAL MONEY LIVE'}
        </button>
      </div>

      {/* Target Crypto Selector: BTC, ETH, SOL, XRP */}
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
          <span className="text-xs font-bold text-white uppercase tracking-wider">
            Target Crypto Instrument:
          </span>
        </div>

        <div className="flex items-center gap-2">
          {(['BTCUSD', 'ETHUSD', 'SOLUSD', 'XRPUSD'] as const).map((sym) => {
            const isSelected = symbol === sym;
            return (
              <button
                key={sym}
                onClick={() => handleSelectCoin(sym)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                  isSelected
                    ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-md shadow-emerald-500/20'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                }`}
              >
                {sym.replace('USD', '')}
              </button>
            );
          })}
        </div>
      </div>

      {/* Success Banner */}
      {successMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Strategy Cards List: Only Strategy Name & Select Button */}
      <div className="space-y-4">
        {STRATEGIES_LIST.map((strat) => {
          const isSelected = selectedStrategyId === strat.id;

          return (
            <div
              key={strat.id}
              className={`p-5 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl ${
                isSelected
                  ? 'bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-900 border-emerald-500/60 shadow-emerald-950/20'
                  : 'bg-slate-900 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base sm:text-lg font-bold text-white">{strat.name}</h2>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                    isSelected
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}>
                    {strat.badge}
                  </span>
                </div>
                <p className="text-xs text-slate-400">{strat.description}</p>
              </div>

              {/* Only Select Button */}
              <button
                onClick={() => handleSelectStrategy(strat)}
                disabled={savingId === strat.id}
                className={`w-full sm:w-auto px-6 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center justify-center gap-2 ${
                  isSelected
                    ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20 cursor-default'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 active:scale-95'
                }`}
              >
                {isSelected ? (
                  <>
                    <Check className="w-4 h-4 text-slate-950 stroke-[3]" />
                    Active Strategy
                  </>
                ) : (
                  <>
                    {savingId === strat.id ? 'Selecting...' : 'Select Strategy'}
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
