'use client';

import { useState, useEffect } from 'react';
import { 
  PlayCircle, 
  PauseCircle, 
  RotateCcw, 
  Download, 
  RefreshCw, 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Cpu, 
  Zap, 
  Layers, 
  Sliders, 
  Sparkles, 
  ArrowUpRight, 
  ArrowDownRight,
  Clock,
  Check,
  ShieldCheck,
  Coins
} from 'lucide-react';
import { useModal } from '@/context/ModalContext';

interface ForwardPosition {
  id: string;
  symbol: string;
  strategy: string;
  setupName: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  stopLoss: number;
  takeProfit: number;
  unrealizedPnl: number;
  unrealizedPnlPct: number;
  entryTime: string;
}

interface ForwardClosedTrade {
  id: string;
  symbol: string;
  strategy: string;
  setupName: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  entryPrice: number;
  exitPrice: number;
  realizedPnl: number;
  pnlPct: number;
  result: 'WIN' | 'LOSS';
  exitReason: string;
  entryTime: string;
  exitTime: string;
  durationMinutes: number;
}

interface ForwardState {
  wallet: {
    startingBalance: number;
    balance: number;
    currency: string;
    realizedPnl: number;
    unrealizedPnl: number;
  };
  config: {
    isRunning: boolean;
    strategy: 'Strategy C' | 'Strategy B' | 'Strategy A';
    symbols: string[];
    perTradeRiskPct: number;
    leverage: number;
    lastCheckedAt?: string;
  };
  positions: ForwardPosition[];
  closedTrades: ForwardClosedTrade[];
  lastUpdated: string;
}

const AVAILABLE_INSTRUMENTS = [
  { id: 'BTCUSD', name: 'Bitcoin', tag: 'BTC / USD' },
  { id: 'ETHUSD', name: 'Ethereum', tag: 'ETH / USD' },
  { id: 'SOLUSD', name: 'Solana', tag: 'SOL / USD' },
  { id: 'XRPUSD', name: 'Ripple', tag: 'XRP / USD' },
];

export default function ForwardTestingPage() {
  const { showConfirm, showAlert } = useModal();
  const [data, setData] = useState<ForwardState | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [replaying, setReplaying] = useState(false);

  // Configuration Form State
  const [selectedStrategy, setSelectedStrategy] = useState<'Strategy C' | 'Strategy B' | 'Strategy A'>('Strategy C');
  const [selectedSymbols, setSelectedSymbols] = useState<string[]>(['BTCUSD', 'ETHUSD', 'SOLUSD', 'XRPUSD']);
  const [capitalInput, setCapitalInput] = useState<number>(100000);
  const [riskPct, setRiskPct] = useState<number>(2);

  // Fetch Forward Test State
  const fetchState = async () => {
    try {
      const res = await fetch('/api/forward-test');
      const json = await res.json();
      if (json.success && json.state) {
        setData(json.state);
        setStats(json.stats);
        if (json.state.config) {
          setSelectedStrategy(json.state.config.strategy || 'Strategy C');
          if (json.state.config.symbols?.length) setSelectedSymbols(json.state.config.symbols);
          if (json.state.config.perTradeRiskPct) setRiskPct(json.state.config.perTradeRiskPct);
          if (json.state.wallet?.startingBalance) setCapitalInput(json.state.wallet.startingBalance);
        }
      }
    } catch (err: any) {
      console.error('Failed fetching forward test state:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchState();
    // Auto sync live forward test cycle every 12 seconds when running
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/forward-test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'SYNC_CYCLE' }),
        });
        const json = await res.json();
        if (json.success && json.state) {
          setData(json.state);
          setStats(json.stats);
        }
      } catch {}
    }, 12000);

    return () => clearInterval(interval);
  }, []);

  // Toggle Single Instrument
  const toggleSymbol = (sym: string) => {
    let updated: string[];
    if (selectedSymbols.includes(sym)) {
      if (selectedSymbols.length === 1) return; // Keep at least one
      updated = selectedSymbols.filter((s) => s !== sym);
    } else {
      updated = [...selectedSymbols, sym];
    }
    setSelectedSymbols(updated);
    updateServerConfig(selectedStrategy, updated, riskPct);
  };

  const toggleSelectAll = () => {
    const all = AVAILABLE_INSTRUMENTS.map((x) => x.id);
    const updated = selectedSymbols.length === all.length ? ['BTCUSD'] : all;
    setSelectedSymbols(updated);
    updateServerConfig(selectedStrategy, updated, riskPct);
  };

  // Push config update to server
  const updateServerConfig = async (strat: string, syms: string[], risk: number) => {
    try {
      await fetch('/api/forward-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'UPDATE_CONFIG',
          strategy: strat,
          symbols: syms,
          perTradeRiskPct: risk,
        }),
      });
    } catch {}
  };

  // Start / Pause Forward Test
  const handleToggleRunning = async () => {
    if (!data) return;
    const isCurrentlyRunning = data.config.isRunning;
    const action = isCurrentlyRunning ? 'PAUSE' : 'START';

    setSyncing(true);
    try {
      const res = await fetch('/api/forward-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      if (json.success) {
        setData(json.state);
        setStats(json.stats);
      }
    } finally {
      setSyncing(false);
    }
  };

  // 1-Click Fast 24-Hour Real-Time Replay
  const handleRun1DayReplay = async () => {
    setReplaying(true);
    try {
      const res = await fetch('/api/forward-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'RUN_1DAY_REPLAY',
          strategy: selectedStrategy,
          symbols: selectedSymbols,
          startingCapital: capitalInput,
          perTradeRiskPct: riskPct,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setData(json.state);
        setStats(json.stats);
        await showAlert({
          title: '24-Hour Real-Time Replay Complete',
          message: `Simulated today's live market data across ${selectedSymbols.length} instruments.\nNet P&L: ₹${json.stats?.netRealizedPnl >= 0 ? '+' : ''}${json.stats?.netRealizedPnl} (${json.stats?.totalTrades} Trades executed)`,
          type: 'success',
        });
      }
    } catch (err: any) {
      await showAlert({
        title: 'Replay Failed',
        message: err.message,
        type: 'danger',
      });
    } finally {
      setReplaying(false);
    }
  };

  // Reset Virtual Wallet
  const handleResetWallet = async () => {
    const confirmed = await showConfirm({
      title: 'Reset Virtual Wallet',
      message: `Are you sure you want to reset your virtual wallet balance to ₹${capitalInput.toLocaleString('en-IN')}? All today's active positions and simulated trade history will be reset.`,
      type: 'warning',
      confirmText: 'Reset Wallet',
    });
    if (!confirmed) return;

    try {
      const res = await fetch('/api/forward-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'RESET_WALLET', startingBalance: capitalInput }),
      });
      const json = await res.json();
      if (json.success) {
        setData(json.state);
        setStats(json.stats);
        await showAlert({
          title: 'Virtual Wallet Reset',
          message: `Virtual wallet successfully reset to ₹${capitalInput.toLocaleString('en-IN')}.`,
          type: 'success',
        });
      }
    } catch (err: any) {
      await showAlert({ title: 'Error', message: err.message, type: 'danger' });
    }
  };

  // Square Off a Position
  const handleSquareOff = async (pos: ForwardPosition) => {
    const confirmed = await showConfirm({
      title: 'Square Off Simulated Position',
      message: `Square off ${pos.side} ${pos.quantity} ${pos.symbol} at current live market price ₹${pos.currentPrice.toLocaleString('en-IN')}?`,
      type: 'danger',
      confirmText: 'Square Off Position',
    });
    if (!confirmed) return;

    try {
      const res = await fetch('/api/forward-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'SQUARE_OFF', positionId: pos.id }),
      });
      const json = await res.json();
      if (json.success) {
        setData(json.state);
        setStats(json.stats);
        await showAlert({
          title: 'Position Squared Off',
          message: `Successfully squared off ${pos.symbol}.`,
          type: 'success',
        });
      }
    } catch (err: any) {
      await showAlert({ title: 'Error', message: err.message, type: 'danger' });
    }
  };

  // Export 1-Day Report to CSV
  const handleExportCSV = () => {
    if (!data?.closedTrades?.length) {
      showAlert({ title: 'No Trades to Export', message: 'There are no closed trades in today\'s log to export.', type: 'info' });
      return;
    }

    const headers = ['Trade ID', 'Symbol', 'Strategy', 'Setup', 'Side', 'Qty', 'Entry Price', 'Exit Price', 'P&L (INR)', 'P&L %', 'Result', 'Exit Reason', 'Entry Time', 'Exit Time'];
    const rows = data.closedTrades.map((t) => [
      t.id,
      t.symbol,
      t.strategy,
      `"${t.setupName}"`,
      t.side,
      t.quantity,
      t.entryPrice,
      t.exitPrice,
      t.realizedPnl,
      `${t.pnlPct}%`,
      t.result,
      `"${t.exitReason}"`,
      `"${t.entryTime}"`,
      `"${t.exitTime}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `forward_test_1day_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const isRunning = data?.config.isRunning ?? false;
  const positions = data?.positions || [];
  const closedTrades = data?.closedTrades || [];
  const wallet = data?.wallet || { startingBalance: 100000, balance: 100000, realizedPnl: 0, unrealizedPnl: 0 };

  return (
    <div className="space-y-6 max-w-6xl pb-10">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
              <PlayCircle className="w-6 h-6 text-emerald-400" />
              Forward Testing Engine
            </h1>
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide flex items-center gap-1.5 ${
              isRunning
                ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 animate-pulse'
                : 'bg-slate-800 text-slate-400 border border-slate-700'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isRunning ? 'bg-emerald-400' : 'bg-slate-500'}`} />
              {isRunning ? 'LIVE FORWARD SCANNING' : 'ENGINE PAUSED'}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Simulate real-time trades with a Virtual Wallet on 100% live market feeds (Delta India / Binance Vision).
          </p>
        </div>

        {/* Primary Controls */}
        <div className="flex items-center gap-2.5 flex-wrap self-start sm:self-auto">
          <button
            type="button"
            onClick={handleToggleRunning}
            disabled={syncing}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all shadow-md active:scale-95 disabled:opacity-50 ${
              isRunning
                ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-amber-500/20'
                : 'bg-emerald-500 hover:bg-emerald-600 text-slate-950 shadow-emerald-500/20'
            }`}
          >
            {isRunning ? <PauseCircle className="w-4 h-4" /> : <PlayCircle className="w-4 h-4" />}
            <span>{isRunning ? 'Pause Engine' : 'Start Forward Test'}</span>
          </button>

          <button
            type="button"
            onClick={handleRun1DayReplay}
            disabled={replaying}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs shadow-md shadow-cyan-500/20 active:scale-95 disabled:opacity-50"
            title="Instantly execute full 24-hour live market simulation"
          >
            <Zap className={`w-4 h-4 ${replaying ? 'animate-spin' : ''}`} />
            <span>{replaying ? 'Replaying 24h...' : '⚡ Run 24h Replay'}</span>
          </button>

          <button
            type="button"
            onClick={handleResetWallet}
            className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 hover:text-white transition-all active:scale-95"
            title="Reset Virtual Wallet"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold transition-all active:scale-95"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export CSV</span>
          </button>
        </div>
      </div>

      {/* 4 Virtual Wallet & Daily Performance KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        {/* Virtual Wallet Balance */}
        <div className="p-4 sm:p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Virtual Wallet</span>
            <Wallet className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono text-white">
            ₹{wallet.balance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-400 font-mono flex items-center justify-between pt-0.5">
            <span>Start: ₹{wallet.startingBalance.toLocaleString('en-IN')}</span>
            <span className={wallet.balance >= wallet.startingBalance ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
              {stats?.returnPct >= 0 ? '+' : ''}{stats?.returnPct || 0}%
            </span>
          </div>
        </div>

        {/* Live Unrealized P&L */}
        <div className="p-4 sm:p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Floating / Unrealized P&L</span>
            <Layers className="w-4 h-4 text-cyan-400" />
          </div>
          <div className={`text-xl sm:text-2xl font-black font-mono ${
            wallet.unrealizedPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
          }`}>
            {wallet.unrealizedPnl >= 0 ? '+' : ''}₹{wallet.unrealizedPnl.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-400 font-mono">
            {positions.length} active live position{positions.length === 1 ? '' : 's'}
          </div>
        </div>

        {/* Today's Realized P&L */}
        <div className="p-4 sm:p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Today's Realized P&L</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className={`text-xl sm:text-2xl font-black font-mono ${
            (stats?.netRealizedPnl || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
          }`}>
            {(stats?.netRealizedPnl || 0) >= 0 ? '+' : ''}₹{(stats?.netRealizedPnl || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-400 font-mono">
            {closedTrades.length} trade{closedTrades.length === 1 ? '' : 's'} closed today
          </div>
        </div>

        {/* Win Rate */}
        <div className="p-4 sm:p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Today's Win Rate</span>
            <CheckCircle2 className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono text-cyan-400">
            {stats?.winRatePct || 0}%
          </div>
          <div className="text-[11px] text-slate-400 font-mono">
            {stats?.winningTrades || 0} Wins / {stats?.losingTrades || 0} Losses
          </div>
        </div>
      </div>

      {/* CONFIGURATION BAR: Strategy, Multiple Instruments & Risk */}
      <div className="p-5 sm:p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-5 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base font-bold text-white">Forward Test Strategy & Instrument Setup</h2>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            Simulates simultaneously on all selected coins
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* 1. Strategy Selector */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center text-[10px] font-bold">1</span>
              <label className="text-xs font-bold text-slate-200">Select Strategy</label>
            </div>
            <div className="space-y-2">
              {[
                { id: 'Strategy C' as const, label: 'Strategy C', tag: '🔥 6 Core Setups (PDH • PDL • PDC • 1:3 RR)' },
                { id: 'Strategy B' as const, label: 'Strategy B', tag: '⚡ Phantom AI (SMC + ICT Scalper: BOS • OB • FVG • 1:4 RR)' },
                { id: 'Strategy A' as const, label: 'Strategy A', tag: 'Slot A: Trend Momentum Breakout' },
              ].map((st) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => {
                    setSelectedStrategy(st.id);
                    updateServerConfig(st.id, selectedSymbols, riskPct);
                  }}
                  className={`w-full p-2.5 rounded-xl text-left border transition-all ${
                    selectedStrategy === st.id
                      ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-sm'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-white">{st.label}</span>
                    {selectedStrategy === st.id && <Check className="w-3.5 h-3.5 text-emerald-400 stroke-[3]" />}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5">{st.tag}</p>
                </button>
              ))}
            </div>
          </div>

          {/* 2. Multiple Instrument Multi-Selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center text-[10px] font-bold">2</span>
                <label className="text-xs font-bold text-slate-200">Select Instruments (Multi-Select)</label>
              </div>
              <button
                type="button"
                onClick={toggleSelectAll}
                className="text-[10px] text-cyan-400 font-semibold hover:underline"
              >
                {selectedSymbols.length === AVAILABLE_INSTRUMENTS.length ? 'Reset to 1' : 'Select All'}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {AVAILABLE_INSTRUMENTS.map((inst) => {
                const isSelected = selectedSymbols.includes(inst.id);
                return (
                  <button
                    key={inst.id}
                    type="button"
                    onClick={() => toggleSymbol(inst.id)}
                    className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center justify-center gap-0.5 ${
                      isSelected
                        ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 shadow-sm'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-xs font-bold text-white">{inst.tag}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                    </div>
                    <span className="text-[10px] text-slate-400">{inst.name}</span>
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-slate-500">
              Active: {selectedSymbols.length} instrument{selectedSymbols.length === 1 ? '' : 's'} simultaneously scanned.
            </p>
          </div>

          {/* 3. Virtual Capital & Risk per Trade */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center text-[10px] font-bold">3</span>
              <label className="text-xs font-bold text-slate-200">Virtual Wallet & Risk</label>
            </div>

            <div className="space-y-3 p-3 bg-slate-950/80 rounded-xl border border-slate-800 text-xs">
              <div>
                <label className="text-[11px] text-slate-300 font-semibold block mb-1">
                  Starting Balance (₹ INR)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={capitalInput ? capitalInput.toString() : ''}
                    onChange={(e) => {
                      const clean = e.target.value.replace(/[^0-9]/g, '');
                      setCapitalInput(clean ? Number(clean) : 0);
                    }}
                    className="w-full pl-7 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
                    placeholder="100000"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] text-slate-300 font-semibold">Risk per Trade (%)</label>
                  <span className="text-[10px] text-cyan-400 font-mono font-bold">
                    ₹{((capitalInput * riskPct) / 100).toLocaleString('en-IN')} ({riskPct}%)
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1">
                  {[1, 2, 3, 5].map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => {
                        setRiskPct(p);
                        updateServerConfig(selectedStrategy, selectedSymbols, p);
                      }}
                      className={`py-1 rounded-lg text-[10px] font-mono font-bold border transition-all ${
                        riskPct === p
                          ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500 font-black'
                          : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {p}%
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* LIVE OPEN POSITIONS TABLE */}
      <div className="p-5 sm:p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base font-bold text-white">Live Open Positions ({positions.length})</h2>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            {positions.length > 0 ? 'Updating in real-time' : 'No active open positions'}
          </span>
        </div>

        {positions.length === 0 ? (
          <div className="p-8 rounded-xl bg-slate-950/60 border border-slate-800 text-center space-y-2">
            <Coins className="w-8 h-8 text-slate-600 mx-auto" />
            <p className="text-xs text-slate-400 font-medium">No open simulated positions currently active.</p>
            <p className="text-[11px] text-slate-500">
              The engine is scanning {selectedSymbols.join(', ')} for {selectedStrategy} triggers. You can also click <strong>⚡ Run 24h Replay</strong> above to simulate today's trades instantly.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[10px] font-semibold">
                  <th className="py-3 px-3">Symbol</th>
                  <th className="py-3 px-3">Side</th>
                  <th className="py-3 px-3">Setup</th>
                  <th className="py-3 px-3">Entry Price</th>
                  <th className="py-3 px-3">Live Price</th>
                  <th className="py-3 px-3">Stop Loss</th>
                  <th className="py-3 px-3">Target</th>
                  <th className="py-3 px-3">Floating P&L</th>
                  <th className="py-3 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {positions.map((pos) => {
                  const isBuy = pos.side === 'BUY';
                  const isProfit = pos.unrealizedPnl >= 0;
                  return (
                    <tr key={pos.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-3 font-bold text-white">{pos.symbol}</td>
                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          isBuy ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                        }`}>
                          {pos.side} ({pos.quantity})
                        </span>
                      </td>
                      <td className="py-3 px-3 font-sans text-slate-300 text-[11px] max-w-[180px] truncate" title={pos.setupName}>
                        {pos.setupName}
                      </td>
                      <td className="py-3 px-3 text-slate-300">₹{pos.entryPrice.toLocaleString('en-IN')}</td>
                      <td className="py-3 px-3 text-white font-bold">₹{pos.currentPrice.toLocaleString('en-IN')}</td>
                      <td className="py-3 px-3 text-rose-400">₹{pos.stopLoss.toLocaleString('en-IN')}</td>
                      <td className="py-3 px-3 text-emerald-400">₹{pos.takeProfit.toLocaleString('en-IN')}</td>
                      <td className={`py-3 px-3 font-bold ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {isProfit ? '+' : ''}₹{pos.unrealizedPnl.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({isProfit ? '+' : ''}{pos.unrealizedPnlPct}%)
                      </td>
                      <td className="py-3 px-3 text-right font-sans">
                        <button
                          type="button"
                          onClick={() => handleSquareOff(pos)}
                          className="px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-[11px] font-bold transition-all active:scale-95"
                        >
                          Square Off
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* TODAY'S 1-DAY PERFORMANCE & CLOSED TRADES LOG */}
      <div className="p-5 sm:p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-cyan-400" />
            <h2 className="text-base font-bold text-white">Today's Real-Time Closed Trades Log ({closedTrades.length})</h2>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            1-Day Performance Audit • Real Market Feeds
          </span>
        </div>

        {closedTrades.length === 0 ? (
          <div className="p-8 rounded-xl bg-slate-950/60 border border-slate-800 text-center space-y-2">
            <CheckCircle2 className="w-8 h-8 text-slate-600 mx-auto" />
            <p className="text-xs text-slate-400 font-medium">No completed trades yet today.</p>
            <p className="text-[11px] text-slate-500">
              When trades hit Stop Loss or 1:3.5 Target, they will appear here with full execution analytics.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[450px] overflow-y-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 bg-slate-900 border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[10px] font-semibold">
                <tr>
                  <th className="py-3 px-3">Exit Time</th>
                  <th className="py-3 px-3">Symbol</th>
                  <th className="py-3 px-3">Side</th>
                  <th className="py-3 px-3">Setup</th>
                  <th className="py-3 px-3">Entry &rarr; Exit</th>
                  <th className="py-3 px-3">P&L (INR)</th>
                  <th className="py-3 px-3">Result</th>
                  <th className="py-3 px-3">Exit Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {closedTrades.map((t) => {
                  const isWin = t.result === 'WIN';
                  return (
                    <tr key={t.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-3 text-[11px] text-slate-400 font-sans">{t.exitTime}</td>
                      <td className="py-3 px-3 font-bold text-white">{t.symbol}</td>
                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          t.side === 'BUY' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                        }`}>
                          {t.side}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-sans text-slate-300 text-[11px] max-w-[160px] truncate" title={t.setupName}>
                        {t.setupName}
                      </td>
                      <td className="py-3 px-3 text-slate-300 text-[11px]">
                        ₹{t.entryPrice.toLocaleString('en-IN')} &rarr; ₹{t.exitPrice.toLocaleString('en-IN')}
                      </td>
                      <td className={`py-3 px-3 font-bold ${isWin ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {isWin ? '+' : ''}₹{t.realizedPnl.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({isWin ? '+' : ''}{t.pnlPct}%)
                      </td>
                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          isWin ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        }`}>
                          {t.result}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-sans text-[11px] text-slate-400">{t.exitReason}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
