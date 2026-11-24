'use client';

import { useState } from 'react';
import { Cpu, Power, ShieldAlert, Settings, Plus, Check } from 'lucide-react';

interface StrategyItem {
  id: string;
  name: string;
  broker: 'DHAN' | 'DELTA' | 'METATRADER';
  symbol: string;
  timeframe: string;
  type: string;
  isActive: boolean;
  paperTrading: boolean;
  capital: number;
  stopLoss: number;
  takeProfit: number;
  description: string;
}

export default function StrategiesPage() {
  const [strategies, setStrategies] = useState<StrategyItem[]>([
    {
      id: '1',
      name: 'Nifty 9/21 EMA Trend Rider',
      broker: 'DHAN',
      symbol: 'NIFTY',
      timeframe: '5m',
      type: 'EMA_CROSSOVER',
      isActive: true,
      paperTrading: true,
      capital: 50000,
      stopLoss: 0.5,
      takeProfit: 1.0,
      description: 'Trades when 9 EMA crosses 21 EMA on 5-min candle. 1:2 Risk-Reward ratio.',
    },
    {
      id: '2',
      name: 'BTC Delta Supertrend Scalper',
      broker: 'DELTA',
      symbol: 'BTCUSD',
      timeframe: '1m',
      type: 'SUPERTREND',
      isActive: true,
      paperTrading: true,
      capital: 25000,
      stopLoss: 0.3,
      takeProfit: 0.8,
      description: 'Scalps Bitcoin futures on Delta Exchange using ATR (10, 3) Supertrend band flips.',
    },
    {
      id: '3',
      name: 'EURUSD RSI Extreme Reversal',
      broker: 'METATRADER',
      symbol: 'EURUSD',
      timeframe: '5m',
      type: 'RSI_REVERSAL',
      isActive: false,
      paperTrading: true,
      capital: 10000,
      stopLoss: 0.4,
      takeProfit: 0.8,
      description: 'Mean reversion strategy buying when RSI < 30 and selling when RSI > 70.',
    },
  ]);

  const toggleActive = async (id: string) => {
    setStrategies((prev) =>
      prev.map((s) => (s.id === id ? { ...s, isActive: !s.isActive } : s))
    );
  };

  const togglePaper = (id: string) => {
    setStrategies((prev) =>
      prev.map((s) => (s.id === id ? { ...s, paperTrading: !s.paperTrading } : s))
    );
  };

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Cpu className="w-6 h-6 text-emerald-400" />
            Strategy Management
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Turn automated trading strategies ON or OFF, adjust risk parameters and switch between Paper and Live mode.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5">
        {strategies.map((strat) => (
          <div
            key={strat.id}
            className={`p-6 rounded-2xl border transition-all ${
              strat.isActive
                ? 'bg-slate-900/90 border-slate-700 shadow-lg shadow-emerald-950/20'
                : 'bg-slate-900/40 border-slate-800 opacity-75'
            }`}
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h3 className="text-lg font-bold text-white">{strat.name}</h3>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                    {strat.broker}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-mono bg-cyan-950/60 text-cyan-400 border border-cyan-800">
                    {strat.symbol} ({strat.timeframe})
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-mono bg-indigo-950/60 text-indigo-400 border border-indigo-800">
                    {strat.type}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-2">{strat.description}</p>
              </div>

              {/* Action Controls */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => togglePaper(strat.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                    strat.paperTrading
                      ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                      : 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                  }`}
                >
                  {strat.paperTrading ? 'Paper Trading' : 'REAL MONEY LIVE'}
                </button>

                <button
                  onClick={() => toggleActive(strat.id)}
                  className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm ${
                    strat.isActive
                      ? 'bg-emerald-500 hover:bg-emerald-600 text-slate-950'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                  }`}
                >
                  <Power className="w-3.5 h-3.5" />
                  {strat.isActive ? 'ACTIVE' : 'PAUSED'}
                </button>
              </div>
            </div>

            {/* Strategy Parameters Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5 pt-4 border-t border-slate-800/80 font-mono text-xs">
              <div className="bg-slate-950/50 p-2.5 rounded-xl border border-slate-800">
                <span className="text-slate-500 block mb-0.5 font-sans">Capital Allotted</span>
                <span className="text-slate-200 font-bold">₹{strat.capital.toLocaleString()}</span>
              </div>
              <div className="bg-slate-950/50 p-2.5 rounded-xl border border-slate-800">
                <span className="text-slate-500 block mb-0.5 font-sans">Stop Loss</span>
                <span className="text-rose-400 font-bold">{strat.stopLoss}%</span>
              </div>
              <div className="bg-slate-950/50 p-2.5 rounded-xl border border-slate-800">
                <span className="text-slate-500 block mb-0.5 font-sans">Take Profit (Target)</span>
                <span className="text-emerald-400 font-bold">{strat.takeProfit}%</span>
              </div>
              <div className="bg-slate-950/50 p-2.5 rounded-xl border border-slate-800">
                <span className="text-slate-500 block mb-0.5 font-sans">Risk / Reward</span>
                <span className="text-cyan-400 font-bold">1 : 2.0</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
