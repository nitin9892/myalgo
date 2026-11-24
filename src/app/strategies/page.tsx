'use client';

import { useState } from 'react';
import { 
  Cpu, 
  Power, 
  ShieldAlert, 
  Settings, 
  Plus, 
  Check, 
  Clock, 
  TrendingUp, 
  Layers, 
  SlidersHorizontal,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

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
  isDetailed?: boolean;
  params?: {
    sl_candle_mode: 'signal_candle' | 'prev_candle';
    max_trades_per_day: number;
    lot_size: number;
    trail_step_points: number;
    trail_amount_points: number;
    session_start: string;
    no_trade_start: string;
    no_trade_end: string;
    square_off_time: string;
    prev_high?: number;
    prev_low?: number;
    prev_close?: number;
  };
}

export default function StrategiesPage() {
  const [strategies, setStrategies] = useState<StrategyItem[]>([
    {
      id: 'strat-pdb-1',
      name: 'Nifty Prev Day Levels Breakout (5m Intraday)',
      broker: 'DHAN',
      symbol: 'NIFTY',
      timeframe: '5m',
      type: 'PREV_DAY_BREAKOUT',
      isActive: true,
      paperTrading: true,
      capital: 50000,
      stopLoss: 0,
      takeProfit: 0,
      description: 'Breaks & closes above/below Prev Day High, Low or Close. 1:3 RR target with 10pt step trailing and 15:30 auto square-off.',
      isDetailed: true,
      params: {
        sl_candle_mode: 'signal_candle',
        max_trades_per_day: 3,
        lot_size: 50,
        trail_step_points: 10,
        trail_amount_points: 3,
        session_start: '09:15',
        no_trade_start: '11:00',
        no_trade_end: '13:00',
        square_off_time: '15:30',
        prev_high: 24250,
        prev_low: 23980,
        prev_close: 24120,
      },
    },
    {
      id: 'strat-delta-1',
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
      id: 'strat-mt5-1',
      name: 'EURUSD Prev Day Breakout (5m)',
      broker: 'METATRADER',
      symbol: 'EURUSD',
      timeframe: '5m',
      type: 'PREV_DAY_BREAKOUT',
      isActive: false,
      paperTrading: true,
      capital: 10000,
      stopLoss: 0,
      takeProfit: 0,
      description: 'Breakout of previous day high/low on EURUSD with 1:3 target and trailing SL sent to MT5 bridge.',
      isDetailed: true,
      params: {
        sl_candle_mode: 'signal_candle',
        max_trades_per_day: 2,
        lot_size: 0.01,
        trail_step_points: 10,
        trail_amount_points: 3,
        session_start: '09:15',
        no_trade_start: '11:00',
        no_trade_end: '13:00',
        square_off_time: '15:30',
      },
    },
  ]);

  const [expandedId, setExpandedId] = useState<string | null>('strat-pdb-1');

  const toggleActive = (id: string) => {
    setStrategies((prev) =>
      prev.map((s) => (s.id === id ? { ...s, isActive: !s.isActive } : s))
    );
  };

  const togglePaper = (id: string) => {
    setStrategies((prev) =>
      prev.map((s) => (s.id === id ? { ...s, paperTrading: !s.paperTrading } : s))
    );
  };

  const updateParam = (id: string, paramKey: string, value: any) => {
    setStrategies((prev) =>
      prev.map((s) => {
        if (s.id === id && s.params) {
          return {
            ...s,
            params: { ...s.params, [paramKey]: value },
          };
        }
        return s;
      })
    );
  };

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Cpu className="w-6 h-6 text-emerald-400" />
            Strategy Management Engine
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Configure intraday breakout rules, time windows, trailing stop loss and multi-broker automated execution.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {strategies.map((strat) => {
          const isExpanded = expandedId === strat.id;
          const p = strat.params;

          return (
            <div
              key={strat.id}
              className={`rounded-2xl border transition-all overflow-hidden ${
                strat.isActive
                  ? 'bg-slate-900 border-slate-700 shadow-xl shadow-emerald-950/20'
                  : 'bg-slate-900/50 border-slate-800 opacity-80'
              }`}
            >
              {/* Header Box */}
              <div className="p-6">
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

                  {/* Top Action Toggles */}
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

                    {strat.isDetailed && (
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : strat.id)}
                        className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white border border-slate-700"
                        title="Configure Strategy Rules"
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    )}
                  </div>
                </div>

                {/* Session & Strategy Rules Highlights */}
                {strat.type === 'PREV_DAY_BREAKOUT' && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-800 font-mono text-xs">
                    <div className="bg-slate-950/50 p-2.5 rounded-xl border border-slate-800">
                      <span className="text-slate-500 block mb-0.5 font-sans">Target Ratio</span>
                      <span className="text-emerald-400 font-bold">1 : 3 Risk-Reward</span>
                    </div>
                    <div className="bg-slate-950/50 p-2.5 rounded-xl border border-slate-800">
                      <span className="text-slate-500 block mb-0.5 font-sans">Step Trailing</span>
                      <span className="text-cyan-400 font-bold">+{p?.trail_amount_points}pts / +{p?.trail_step_points}pts</span>
                    </div>
                    <div className="bg-slate-950/50 p-2.5 rounded-xl border border-slate-800">
                      <span className="text-slate-500 block mb-0.5 font-sans">No Entry Window</span>
                      <span className="text-amber-400 font-bold">{p?.no_trade_start} - {p?.no_trade_end}</span>
                    </div>
                    <div className="bg-slate-950/50 p-2.5 rounded-xl border border-slate-800">
                      <span className="text-slate-500 block mb-0.5 font-sans">Auto Square-Off</span>
                      <span className="text-rose-400 font-bold">{p?.square_off_time} IST</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Collapsible Tuning Panel for Prev Day Breakout */}
              {isExpanded && strat.type === 'PREV_DAY_BREAKOUT' && p && (
                <div className="bg-slate-950/80 p-6 border-t border-slate-800 space-y-5 text-xs">
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                    <h4 className="font-bold text-slate-200 flex items-center gap-2">
                      <SlidersHorizontal className="w-4 h-4 text-emerald-400" />
                      Fine-Tune Breakout & Trailing Parameters
                    </h4>
                    <span className="text-[11px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      Auto-Saved
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {/* SL Candle Mode */}
                    <div className="space-y-1.5">
                      <label className="text-slate-300 font-semibold block">Stop Loss Candle Mode</label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => updateParam(strat.id, 'sl_candle_mode', 'signal_candle')}
                          className={`py-2 px-3 rounded-xl border font-semibold text-center transition-all ${
                            p.sl_candle_mode === 'signal_candle'
                              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50'
                              : 'bg-slate-900 text-slate-400 border-slate-800'
                          }`}
                        >
                          Signal Candle
                        </button>
                        <button
                          type="button"
                          onClick={() => updateParam(strat.id, 'sl_candle_mode', 'prev_candle')}
                          className={`py-2 px-3 rounded-xl border font-semibold text-center transition-all ${
                            p.sl_candle_mode === 'prev_candle'
                              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50'
                              : 'bg-slate-900 text-slate-400 border-slate-800'
                          }`}
                        >
                          Prev Candle
                        </button>
                      </div>
                      <span className="text-[10px] text-slate-500 block">
                        {p.sl_candle_mode === 'signal_candle' ? 'SL at breaking candle extreme' : 'SL at prior candle extreme'}
                      </span>
                    </div>

                    {/* Step Trailing Settings */}
                    <div className="space-y-1.5">
                      <label className="text-slate-300 font-semibold block">Trailing Step & Shift</label>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <input
                            type="number"
                            value={p.trail_step_points}
                            onChange={(e) => updateParam(strat.id, 'trail_step_points', Number(e.target.value))}
                            className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white font-mono"
                          />
                          <span className="text-[10px] text-slate-500">Step (Pts)</span>
                        </div>
                        <div>
                          <input
                            type="number"
                            value={p.trail_amount_points}
                            onChange={(e) => updateParam(strat.id, 'trail_amount_points', Number(e.target.value))}
                            className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white font-mono"
                          />
                          <span className="text-[10px] text-slate-500">Trail By (Pts)</span>
                        </div>
                      </div>
                    </div>

                    {/* Quantity & Max Trades */}
                    <div className="space-y-1.5">
                      <label className="text-slate-300 font-semibold block">Lot Size & Daily Limit</label>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <input
                            type="number"
                            value={p.lot_size}
                            onChange={(e) => updateParam(strat.id, 'lot_size', Number(e.target.value))}
                            className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white font-mono"
                          />
                          <span className="text-[10px] text-slate-500">Position Qty</span>
                        </div>
                        <div>
                          <input
                            type="number"
                            value={p.max_trades_per_day}
                            onChange={(e) => updateParam(strat.id, 'max_trades_per_day', Number(e.target.value))}
                            className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white font-mono"
                          />
                          <span className="text-[10px] text-slate-500">Max Trades/Day</span>
                        </div>
                      </div>
                    </div>

                    {/* Key Levels (Prev High, Low, Close) */}
                    <div className="space-y-1.5 sm:col-span-2 lg:col-span-3 pt-2 border-t border-slate-800/80">
                      <label className="text-slate-300 font-semibold block">Previous Day Key Levels (Reference)</label>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <span className="text-[11px] text-slate-400 block mb-1">Prev High (PDH)</span>
                          <input
                            type="number"
                            value={p.prev_high || ''}
                            onChange={(e) => updateParam(strat.id, 'prev_high', Number(e.target.value))}
                            placeholder="Auto or Manual"
                            className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-emerald-400 font-mono"
                          />
                        </div>
                        <div>
                          <span className="text-[11px] text-slate-400 block mb-1">Prev Low (PDL)</span>
                          <input
                            type="number"
                            value={p.prev_low || ''}
                            onChange={(e) => updateParam(strat.id, 'prev_low', Number(e.target.value))}
                            placeholder="Auto or Manual"
                            className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-rose-400 font-mono"
                          />
                        </div>
                        <div>
                          <span className="text-[11px] text-slate-400 block mb-1">Prev Close (PDC)</span>
                          <input
                            type="number"
                            value={p.prev_close || ''}
                            onChange={(e) => updateParam(strat.id, 'prev_close', Number(e.target.value))}
                            placeholder="Auto or Manual"
                            className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-cyan-400 font-mono"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
