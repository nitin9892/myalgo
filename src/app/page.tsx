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
  DollarSign,
  ShieldCheck,
  ShieldAlert,
  Wallet,
  Clock,
  XOctagon,
  ArrowRight
} from 'lucide-react';
import Link from 'next/link';

export default function DashboardPage() {
  const [isRunningCycle, setIsRunningCycle] = useState(false);
  const [cycleResult, setCycleResult] = useState<any>(null);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [squaringOffId, setSquaringOffId] = useState<string | null>(null);

  // Live Stats State
  const [stats, setStats] = useState({
    todayPnl: 0,
    winRate: 0,
    totalClosedToday: 0,
    openCount: 0,
    activeStrategies: 1,
    totalStrategies: 1,
  });

  const [activePositions, setActivePositions] = useState<any[]>([]);
  const [recentTrades, setRecentTrades] = useState<any[]>([]);
  const [killSwitchActive, setKillSwitchActive] = useState(false);
  const [killSwitchReason, setKillSwitchReason] = useState<string | null>(null);
  const [connectedBrokers, setConnectedBrokers] = useState<Record<string, any>>({});

  const fetchDashboardData = async () => {
    try {
      // 1. Check local storage for kill switch
      const localKill = localStorage.getItem('myalgo_kill_switch');
      if (localKill) {
        try {
          const parsed = JSON.parse(localKill);
          if (parsed.active) {
            setKillSwitchActive(true);
            setKillSwitchReason(parsed.reason || 'Emergency Kill Switch engaged');
          }
        } catch {}
      }

      // 2. Fetch live trades & stats
      const tradesRes = await fetch('/api/trades');
      const tradesData = await tradesRes.json();
      if (tradesData.success) {
        setActivePositions(tradesData.openPositions || []);
        setRecentTrades(tradesData.recentTrades || []);
        if (tradesData.stats) {
          setStats((prev) => ({
            ...prev,
            todayPnl: tradesData.stats.todayPnl,
            winRate: tradesData.stats.winRate,
            totalClosedToday: tradesData.stats.totalClosedToday,
            openCount: tradesData.stats.openCount,
          }));
        }
      }

      // 3. Fetch risk & kill switch status from API
      const riskRes = await fetch('/api/risk');
      const riskData = await riskRes.json();
      if (riskData) {
        const isServerActive = !!(riskData.isKillSwitchActive || riskData.config?.killSwitchActive);
        if (isServerActive) {
          setKillSwitchActive(true);
          setKillSwitchReason(riskData.killSwitchReason || 'Emergency Kill Switch engaged');
        } else if (!localKill) {
          setKillSwitchActive(false);
          setKillSwitchReason(null);
        }
      }

      // 4. Read connected brokers from localStorage
      const savedBrokerStatus = localStorage.getItem('myalgo_broker_status');
      if (savedBrokerStatus) {
        setConnectedBrokers(JSON.parse(savedBrokerStatus));
      }

      setLastUpdated(new Date().toLocaleTimeString());
    } catch (err) {
      console.error('Failed to sync dashboard data:', err);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 4000);
    return () => clearInterval(interval);
  }, []);

  // Trigger one trade cycle manually
  const triggerCycleNow = async () => {
    setIsRunningCycle(true);
    try {
      const res = await fetch('/api/cron/trade-cycle');
      const data = await res.json();
      setCycleResult(data);
      await fetchDashboardData();
    } catch (err: any) {
      setCycleResult({ error: err.message });
    } finally {
      setIsRunningCycle(false);
    }
  };

  // Emergency Square Off single position
  const handleSquareOff = async (pos: any) => {
    if (!confirm(`Are you sure you want to Square Off position ${pos.side} ${pos.quantity} ${pos.symbol}?`)) {
      return;
    }

    setSquaringOffId(pos.id);
    try {
      const savedCreds = localStorage.getItem('myalgo_broker_creds');
      const creds = savedCreds ? JSON.parse(savedCreds) : {};

      const res = await fetch('/api/trades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'SQUARE_OFF',
          tradeId: pos.id,
          broker: pos.broker_name || pos.broker,
          symbol: pos.symbol,
          side: pos.side,
          quantity: pos.quantity,
          exitPrice: pos.current_price || pos.entry_price || 0,
          credentials: creds[pos.broker_name || pos.broker],
        }),
      });

      const data = await res.json();
      alert(data.message || 'Position squared off!');
      await fetchDashboardData();
    } catch (err: any) {
      alert(`Square-off failed: ${err.message}`);
    } finally {
      setSquaringOffId(null);
    }
  };

  // Find active single broker
  const connectedEntry = Object.entries(connectedBrokers).find(([_, stat]) => stat?.success);
  const activeBrokerId = connectedEntry ? connectedEntry[0] : null;
  const activeBrokerData = connectedEntry ? connectedEntry[1] : null;

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Top Banner / Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 sm:pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              Algo Control Center
            </h1>
            <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Live Ready
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            5m candle breakout engine with 1:3 RR targets, step trailing, and capital protection.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
          <button
            onClick={triggerCycleNow}
            disabled={isRunningCycle}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs sm:text-sm transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 active:scale-95"
          >
            <Play className={`w-4 h-4 fill-slate-950 ${isRunningCycle ? 'animate-spin' : ''}`} />
            {isRunningCycle ? 'Evaluating 5m Feeds...' : 'Run Trade Cycle'}
          </button>
          <div className="text-[11px] text-slate-500 flex items-center justify-center gap-1">
            <RefreshCw className="w-3 h-3" /> Sync {lastUpdated || 'Live'}
          </div>
        </div>
      </div>

      {/* Connected Broker Live Ribbon */}
      <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs shadow-md">
        <div className="flex items-center gap-2">
          <Wallet className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="font-semibold text-slate-300">Active Broker:</span>
          {activeBrokerId ? (
            <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 font-bold flex items-center gap-1.5 shadow-sm shadow-emerald-500/20">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              {activeBrokerId}: {activeBrokerData?.balanceDisplay || 'Connected (Live)'}
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 border border-slate-700 font-medium">
              No Broker Connected
            </span>
          )}
        </div>

        <Link 
          href="/brokers" 
          className="text-cyan-400 hover:underline font-semibold flex items-center gap-1 text-xs self-start sm:self-auto"
        >
          {activeBrokerId ? 'Manage / Switch Broker' : 'Connect Broker'} &rarr;
        </Link>
      </div>

      {/* Kill Switch Triggered Alert Banner */}
      {killSwitchActive && (
        <div className="p-4 rounded-xl bg-gradient-to-r from-rose-950/90 via-slate-950 to-rose-950/90 border border-rose-500/60 text-rose-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg shadow-rose-950/50">
          <div className="flex items-start sm:items-center gap-3">
            <XOctagon className="w-6 h-6 text-rose-400 shrink-0 animate-bounce mt-0.5 sm:mt-0" />
            <div>
              <p className="font-black text-sm text-white tracking-wide">🚨 EMERGENCY KILL SWITCH ENGAGED</p>
              <p className="text-xs text-rose-300 mt-0.5">{killSwitchReason || 'Max Daily Loss limit breached. All automated trading halted.'}</p>
            </div>
          </div>
          <Link href="/risk" className="w-full sm:w-auto text-center px-4 py-2 rounded-lg bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs transition-colors shadow shrink-0">
            Disarm Kill Switch
          </Link>
        </div>
      )}

      {/* Cycle Result Alert if manually fired */}
      {cycleResult && (
        <div className="p-4 rounded-xl bg-slate-900 border border-emerald-500/30 text-xs text-slate-300">
          <p className="font-semibold text-emerald-400 mb-1 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" /> Cycle Completed at {cycleResult.timestamp || 'Now'}
          </p>
          <div className="font-mono bg-slate-950 p-2.5 rounded border border-slate-800 text-slate-300 space-y-1 overflow-x-auto text-[11px]">
            {cycleResult.result?.logs?.map((l: string, i: number) => (
              <div key={i}>{l}</div>
            )) || <div>{JSON.stringify(cycleResult)}</div>}
          </div>
        </div>
      )}

      {/* Metric Cards - 2 cols on mobile, 4 on desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
        {/* Card 1: Today Realized P&L */}
        <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/80 border border-slate-800/80 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 text-[11px] sm:text-xs font-medium">
            <span>Today's Realized P&L</span>
            {stats.todayPnl >= 0 ? (
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
            )}
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className={`text-lg sm:text-2xl font-bold font-mono ${stats.todayPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {stats.todayPnl >= 0 ? '+' : ''}₹{stats.todayPnl.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <p className="text-[10px] sm:text-xs text-slate-400 mt-1.5">
            {stats.totalClosedToday} closed trades
          </p>
        </div>

        {/* Card 2: Master Strategy */}
        <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/80 border border-slate-800/80 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-[11px] sm:text-xs font-medium">
            <span>Master Strategy</span>
            <Zap className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xs sm:text-base font-bold text-white font-mono flex items-center gap-1.5 truncate">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0"></span>
              5m Breakout
            </span>
          </div>
          <Link href="/strategies" className="text-[10px] sm:text-xs text-emerald-400 hover:underline mt-1.5 inline-block font-semibold">
            Settings &rarr;
          </Link>
        </div>

        {/* Card 3: Win Rate */}
        <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/80 border border-slate-800/80 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-[11px] sm:text-xs font-medium">
            <span>Win Rate</span>
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-lg sm:text-2xl font-bold text-white font-mono">{stats.winRate}%</span>
          </div>
          <p className="text-[10px] sm:text-xs text-slate-400 mt-1.5">
            Daily ratio
          </p>
        </div>

        {/* Card 4: Capital Protection */}
        <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/80 border border-slate-800/80 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-[11px] sm:text-xs font-medium">
            <span>Capital Protection</span>
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className={`text-xs sm:text-lg font-bold ${killSwitchActive ? 'text-rose-400' : 'text-emerald-400'}`}>
              {killSwitchActive ? 'HALTED' : 'ARMED'}
            </span>
          </div>
          <Link href="/risk" className="text-[10px] sm:text-xs text-emerald-400 hover:underline mt-1.5 inline-block font-semibold">
            Risk & SL &rarr;
          </Link>
        </div>
      </div>

      {/* Active Live Positions */}
      <div className="p-4 sm:p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 mb-4">
          <h2 className="text-base sm:text-lg font-semibold text-white flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
            Open Positions ({activePositions.length})
          </h2>
          <span className="text-xs text-slate-400">1:3 RR targets & 10pt step trailing active</span>
        </div>

        {activePositions.length === 0 ? (
          <div className="py-10 text-center text-slate-500 text-xs font-sans">
            <Zap className="w-8 h-8 mx-auto mb-2 opacity-30 text-emerald-400" />
            <p className="text-sm font-semibold text-slate-400">No active positions open right now.</p>
            <p className="mt-1">Waiting for fresh 5m candle breakout signals (09:15 - 15:30).</p>
          </div>
        ) : (
          <>
            {/* Mobile View: Clean Touch-Friendly Cards */}
            <div className="grid grid-cols-1 gap-3 md:hidden">
              {activePositions.map((pos) => {
                const entry = Number(pos.entry_price || pos.entryPrice || 0);
                const curr = Number(pos.current_price || pos.currentPrice || entry);
                const pnl = Number(pos.pnl || (pos.side === 'BUY' ? (curr - entry) * pos.quantity : (entry - curr) * pos.quantity));
                const isProfitable = pnl >= 0;

                return (
                  <div key={pos.id} className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3 shadow-md">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-white text-base font-mono">{pos.symbol}</span>
                        {pos.paper_trade ? (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30 font-bold">
                            PAPER
                          </span>
                        ) : (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-bold">
                            LIVE
                          </span>
                        )}
                        <span className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                          {pos.broker_name || pos.broker}
                        </span>
                      </div>
                      <span className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-lg ${
                        pos.side === 'BUY' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'
                      }`}>
                        {pos.side === 'BUY' ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                        {pos.side}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-xs pt-2 border-t border-slate-900">
                      <div>
                        <span className="text-slate-500 text-[10px] block">Qty</span>
                        <span className="font-mono text-slate-200 font-bold">{pos.quantity}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 text-[10px] block">Entry Price</span>
                        <span className="font-mono text-slate-200">{entry}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 text-[10px] block">Current</span>
                        <span className="font-mono text-slate-200">{curr}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2.5 border-t border-slate-800/80">
                      <div>
                        <span className="text-slate-500 text-[10px] block">Unrealized P&L</span>
                        <span className={`font-mono font-black text-lg ${isProfitable ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {isProfitable ? '+' : ''}{pnl.toFixed(2)}
                        </span>
                      </div>

                      <button
                        onClick={() => handleSquareOff(pos)}
                        disabled={squaringOffId === pos.id}
                        className="px-4 py-2 text-xs font-bold rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 border border-rose-500/40 transition-all disabled:opacity-50"
                      >
                        {squaringOffId === pos.id ? 'Exiting...' : 'Square Off'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
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
                    <th className="py-3 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 font-mono">
                  {activePositions.map((pos) => {
                    const entry = Number(pos.entry_price || pos.entryPrice || 0);
                    const curr = Number(pos.current_price || pos.currentPrice || entry);
                    const pnl = Number(pos.pnl || (pos.side === 'BUY' ? (curr - entry) * pos.quantity : (entry - curr) * pos.quantity));
                    const isProfitable = pnl >= 0;

                    return (
                      <tr key={pos.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3.5 px-4 font-sans font-semibold text-white flex items-center gap-2">
                          {pos.symbol}
                          {pos.paper_trade && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-sans font-bold">
                              PAPER
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-xs font-sans">
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                            {pos.broker_name || pos.broker}
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
                        <td className="py-3.5 px-4">{entry}</td>
                        <td className="py-3.5 px-4">{curr}</td>
                        <td className={`py-3.5 px-4 text-right font-bold ${
                          isProfitable ? 'text-emerald-400' : 'text-rose-400'
                        }`}>
                          {isProfitable ? '+' : ''}{pnl.toFixed(2)}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <button
                            onClick={() => handleSquareOff(pos)}
                            disabled={squaringOffId === pos.id}
                            className="px-2.5 py-1 text-xs font-bold rounded-lg bg-rose-500/15 hover:bg-rose-500/30 text-rose-400 border border-rose-500/30 transition-all disabled:opacity-50"
                          >
                            {squaringOffId === pos.id ? 'Exiting...' : 'Square Off'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Recent Completed Trades */}
      <div className="p-4 sm:p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl">
        <h2 className="text-base sm:text-lg font-semibold text-white mb-4">Recent Executed Trades</h2>

        {recentTrades.length === 0 ? (
          <div className="py-8 text-center text-slate-500 text-xs font-sans">
            No recent closed trades yet. Closed trades will show here automatically.
          </div>
        ) : (
          <>
            {/* Mobile Trade Cards */}
            <div className="grid grid-cols-1 gap-2.5 md:hidden">
              {recentTrades.map((tr) => (
                <div key={tr.id} className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white font-mono">{tr.symbol}</span>
                    <span className={`font-bold font-mono text-sm ${Number(tr.pnl || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {Number(tr.pnl || 0) >= 0 ? `+${tr.pnl}` : tr.pnl}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-400 text-[11px]">
                    <span className="flex items-center gap-1.5">
                      <span className={`px-1.5 py-0.5 rounded font-bold ${tr.side === 'BUY' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                        {tr.side}
                      </span>
                      <span>Qty: {tr.quantity}</span>
                    </span>
                    <span>{tr.entry_price || tr.entry} &rarr; {tr.exit_price || tr.exit || '-'}</span>
                  </div>
                  <p className="text-[10px] text-slate-500 truncate">{tr.notes || 'Target Hit'}</p>
                </div>
              ))}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
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
                          {tr.broker_name || tr.broker}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`text-xs font-semibold ${tr.side === 'BUY' ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {tr.side}
                        </span>
                      </td>
                      <td className="py-3 px-4">{tr.quantity}</td>
                      <td className="py-3 px-4 text-xs">
                        {tr.entry_price || tr.entry} &rarr; {tr.exit_price || tr.exit || '-'}
                      </td>
                      <td className="py-3 px-4 text-xs font-sans text-slate-400">{tr.notes || 'Target Hit'}</td>
                      <td className={`py-3 px-4 text-right font-bold ${Number(tr.pnl || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {Number(tr.pnl || 0) >= 0 ? `+${tr.pnl}` : tr.pnl}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
