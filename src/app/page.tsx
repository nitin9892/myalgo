'use client';

import { useState, useEffect } from 'react';
import { 
  Play, 
  TrendingUp, 
  TrendingDown, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowUpRight, 
  ArrowDownRight,
  RefreshCw,
  Zap,
  Sliders,
  DollarSign
} from 'lucide-react';
import Link from 'next/link';

export default function DashboardPage() {
  const [isRunningCycle, setIsRunningCycle] = useState(false);
  const [cycleResult, setCycleResult] = useState<any>(null);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  // Sample or Supabase live state
  const [stats, setStats] = useState({
    todayPnl: 14250.00,
    winRate: 68.4,
    totalTrades: 38,
    activeStrategies: 2,
    totalStrategies: 3,
  });

  const [activePositions, setActivePositions] = useState([
    {
      id: 'pos-1',
      symbol: 'NIFTY 24200 CE',
      broker: 'DHAN',
      side: 'BUY',
      quantity: 50,
      entryPrice: 145.20,
      currentPrice: 172.80,
      pnl: 1380.00,
      pnlPct: 19.0,
      paperTrade: true,
    },
    {
      id: 'pos-2',
      symbol: 'BTCUSD PERP',
      broker: 'DELTA',
      side: 'BUY',
      quantity: 0.25,
      entryPrice: 94850.00,
      currentPrice: 95400.00,
      pnl: 137.50,
      pnlPct: 0.58,
      paperTrade: true,
    },
  ]);

  const [recentTrades, setRecentTrades] = useState([
    {
      id: 'tr-1',
      symbol: 'EURUSD',
      broker: 'METATRADER',
      side: 'SELL',
      quantity: 0.1,
      entry: 1.0890,
      exit: 1.0850,
      pnl: 40.00,
      status: 'CLOSED',
      time: '10 mins ago',
      notes: 'RSI Overbought Reversal',
    },
    {
      id: 'tr-2',
      symbol: 'NIFTY FUT',
      broker: 'DHAN',
      side: 'BUY',
      quantity: 25,
      entry: 24100.00,
      exit: 24220.00,
      pnl: 3000.00,
      status: 'CLOSED',
      time: '1 hour ago',
      notes: '9/21 EMA Bullish Cross',
    },
    {
      id: 'tr-3',
      symbol: 'ETHUSD PERP',
      broker: 'DELTA',
      side: 'SELL',
      quantity: 1.5,
      entry: 3380.00,
      exit: 3410.00,
      pnl: -45.00,
      status: 'CLOSED',
      time: '2 hours ago',
      notes: 'Supertrend Stop Loss Hit',
    },
  ]);

  useEffect(() => {
    setLastUpdated(new Date().toLocaleTimeString());
  }, []);

  // Trigger one trade cycle manually
  const triggerCycleNow = async () => {
    setIsRunningCycle(true);
    try {
      const res = await fetch('/api/cron/trade-cycle');
      const data = await res.json();
      setCycleResult(data);
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (err: any) {
      setCycleResult({ error: err.message });
    } finally {
      setIsRunningCycle(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Top Banner / Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            Algo Trading Control Center
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
              Live Ready
            </span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Multi-broker automated execution for <span className="text-slate-200 font-medium">Dhan</span>, <span className="text-slate-200 font-medium">Delta Exchange</span> & <span className="text-slate-200 font-medium">MetaTrader</span>.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={triggerCycleNow}
            disabled={isRunningCycle}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-semibold text-sm transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50"
          >
            <Play className={`w-4 h-4 fill-slate-950 ${isRunningCycle ? 'animate-spin' : ''}`} />
            {isRunningCycle ? 'Checking Signals...' : 'Run Trade Cycle Now'}
          </button>
          <div className="text-xs text-slate-500 flex items-center gap-1">
            <RefreshCw className="w-3 h-3" /> Updated {lastUpdated}
          </div>
        </div>
      </div>

      {/* Cycle Result Alert if manually fired */}
      {cycleResult && (
        <div className="p-4 rounded-xl bg-slate-900 border border-emerald-500/30 text-xs text-slate-300">
          <p className="font-semibold text-emerald-400 mb-1 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" /> Cycle Completed at {cycleResult.timestamp || 'Now'}
          </p>
          <div className="font-mono bg-slate-950 p-2.5 rounded border border-slate-800 text-slate-300 space-y-1">
            {cycleResult.result?.logs?.map((l: string, i: number) => (
              <div key={i}>{l}</div>
            )) || <div>{JSON.stringify(cycleResult)}</div>}
          </div>
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Card 1: Today P&L */}
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800/80 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Today's Realized P&L</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-400 font-mono">
              +₹{stats.todayPnl.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
            <span className="text-emerald-400 font-medium">+14.2%</span> vs yesterday
          </p>
        </div>

        {/* Card 2: Active Strategies */}
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800/80 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Active Strategies</span>
            <Zap className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white font-mono">
              {stats.activeStrategies} <span className="text-sm text-slate-400 font-normal">/ {stats.totalStrategies}</span>
            </span>
          </div>
          <Link href="/strategies" className="text-xs text-cyan-400 hover:underline mt-2 inline-block">
            Manage strategies &rarr;
          </Link>
        </div>

        {/* Card 3: Win Rate */}
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800/80 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Win Rate</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white font-mono">{stats.winRate}%</span>
          </div>
          <p className="text-xs text-slate-400 mt-2">
            Across {stats.totalTrades} closed trades
          </p>
        </div>

        {/* Card 4: Execution Engine Mode */}
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800/80 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Trading Mode</span>
            <Sliders className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-lg font-bold text-amber-300">Paper Trading</span>
          </div>
          <p className="text-xs text-slate-400 mt-2">
            Simulated money (Zero capital risk)
          </p>
        </div>
      </div>

      {/* Active Live Positions */}
      <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
            Open Positions ({activePositions.length})
          </h2>
          <span className="text-xs text-slate-400">Auto-managed by strategy stop loss & targets</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="text-xs uppercase bg-slate-950/60 text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Symbol</th>
                <th className="py-3 px-4">Broker</th>
                <th className="py-3 px-4">Side</th>
                <th className="py-3 px-4">Quantity</th>
                <th className="py-3 px-4">Entry Price</th>
                <th className="py-3 px-4">Current Price</th>
                <th className="py-3 px-4 text-right">Unrealized P&L</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 font-mono">
              {activePositions.map((pos) => {
                const isProfitable = pos.pnl >= 0;
                return (
                  <tr key={pos.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-4 font-sans font-semibold text-white flex items-center gap-2">
                      {pos.symbol}
                      {pos.paperTrade && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-sans">
                          PAPER
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-xs font-sans">
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                        {pos.broker}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`inline-flex items-center gap-1 text-xs font-semibold ${
                        pos.side === 'BUY' ? 'text-emerald-400' : 'text-rose-400'
                      }`}>
                        {pos.side === 'BUY' ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                        {pos.side}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">{pos.quantity}</td>
                    <td className="py-3.5 px-4">{pos.entryPrice}</td>
                    <td className="py-3.5 px-4">{pos.currentPrice}</td>
                    <td className={`py-3.5 px-4 text-right font-bold ${
                      isProfitable ? 'text-emerald-400' : 'text-rose-400'
                    }`}>
                      {isProfitable ? '+' : ''}{pos.pnl} ({isProfitable ? '+' : ''}{pos.pnlPct}%)
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Completed Trades */}
      <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800">
        <h2 className="text-lg font-semibold text-white mb-4">Recent Executed Trades</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="text-xs uppercase bg-slate-950/60 text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Symbol</th>
                <th className="py-3 px-4">Broker</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Qty</th>
                <th className="py-3 px-4">Entry / Exit</th>
                <th className="py-3 px-4">Strategy Reason</th>
                <th className="py-3 px-4 text-right">Realized P&L</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 font-mono">
              {recentTrades.map((tr) => (
                <tr key={tr.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-3 px-4 font-sans font-medium text-white">{tr.symbol}</td>
                  <td className="py-3 px-4 text-xs font-sans">
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                      {tr.broker}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`text-xs font-semibold ${tr.side === 'BUY' ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {tr.side}
                    </span>
                  </td>
                  <td className="py-3 px-4">{tr.quantity}</td>
                  <td className="py-3 px-4 text-xs">
                    {tr.entry} &rarr; {tr.exit}
                  </td>
                  <td className="py-3 px-4 text-xs font-sans text-slate-400">{tr.notes}</td>
                  <td className={`py-3 px-4 text-right font-bold ${tr.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {tr.pnl >= 0 ? `+${tr.pnl}` : tr.pnl}
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
