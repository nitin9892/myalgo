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
  Coins,
  ShieldAlert,
  ArrowRight
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
  initialStopLoss?: number;
  trailingMilestone?: number;
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
    timeframe?: string;
    perTradeRiskPct: number;
    overallRiskPct?: number;
    leverage: number;
    autoLeverage?: boolean;
    riskPausedReason?: string | null;
    lastCheckedAt?: string;
  };
  positions: ForwardPosition[];
  closedTrades: ForwardClosedTrade[];
  lastUpdated: string;
}

const AVAILABLE_TIMEFRAMES = [
  { id: '1m', label: '1m', desc: '1-Min Scalp' },
  { id: '3m', label: '3m', desc: '3-Min Momentum' },
  { id: '5m', label: '5m', desc: '5-Min Standard', isRecommended: true },
  { id: '15m', label: '15m', desc: '15-Min Swing' },
  { id: '1h', label: '1h', desc: '1-Hour Macro' },
];

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

  // Configuration Form State (Default 10,000 Virtual Balance as requested)
  const [selectedStrategy, setSelectedStrategy] = useState<'Strategy B' | 'Strategy C' | 'Strategy A'>('Strategy B');
  const [selectedTimeframe, setSelectedTimeframe] = useState<string>('5m');
  const [selectedSymbols, setSelectedSymbols] = useState<string[]>(['BTCUSD', 'ETHUSD', 'SOLUSD', 'XRPUSD']);
  const [capitalInput, setCapitalInput] = useState<number>(10000);
  const [riskPct, setRiskPct] = useState<number>(2);
  const [overallRiskPct, setOverallRiskPct] = useState<number>(10);
  const [manualLeverage, setManualLeverage] = useState<boolean>(false);
  const [customLeverage, setCustomLeverage] = useState<number>(5);
  const [userToken, setUserToken] = useState<string>('');

  const getAuthHeaders = () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('myalgo_access_token') || 'DEFAULT_TRADER' : 'DEFAULT_TRADER';
    return {
      'Content-Type': 'application/json',
      'x-access-token': token,
    };
  };

  useEffect(() => {
    const saved = localStorage.getItem('myalgo_access_token') || 'DEFAULT_TRADER';
    setUserToken(saved.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '_'));
  }, []);

  // Compute Auto Leverage
  const getAutoLeverage = () => {
    let avgSlPct = 0.4; // 0.4% for Strategy B scalping
    if (selectedStrategy === 'Strategy C') avgSlPct = 1.0;
    if (selectedStrategy === 'Strategy A') avgSlPct = 1.2;
    const raw = Math.ceil(riskPct / avgSlPct);
    return Math.min(50, Math.max(1, raw));
  };

  const effectiveLeverage = manualLeverage ? customLeverage : getAutoLeverage();

  // Fetch Forward Test State
  const fetchState = async () => {
    try {
      const res = await fetch('/api/forward-test', {
        headers: getAuthHeaders(),
      });
      const json = await res.json();
      if (json.success && json.state) {
        setData(json.state);
        setStats(json.stats);
        if (json.state.config) {
          setSelectedStrategy(json.state.config.strategy || 'Strategy B');
          if (json.state.config.timeframe) setSelectedTimeframe(json.state.config.timeframe);
          if (json.state.config.symbols?.length) setSelectedSymbols(json.state.config.symbols);
          if (json.state.config.perTradeRiskPct) setRiskPct(json.state.config.perTradeRiskPct);
          if (json.state.config.overallRiskPct) setOverallRiskPct(json.state.config.overallRiskPct);
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
    // Auto sync live forward test cycle every 10 seconds when running
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/forward-test', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ action: 'SYNC_CYCLE' }),
        });
        const json = await res.json();
        if (json.success && json.state) {
          setData(json.state);
          setStats(json.stats);
        }
      } catch {}
    }, 10000);

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
    updateServerConfig(selectedStrategy, updated, riskPct, overallRiskPct, selectedTimeframe);
  };

  const toggleSelectAll = () => {
    const all = AVAILABLE_INSTRUMENTS.map((x) => x.id);
    const updated = selectedSymbols.length === all.length ? ['BTCUSD'] : all;
    setSelectedSymbols(updated);
    updateServerConfig(selectedStrategy, updated, riskPct, overallRiskPct, selectedTimeframe);
  };

  // Push config update to server
  const updateServerConfig = async (strat: string, syms: string[], rTrade: number, rOverall: number, tf: string = selectedTimeframe) => {
    try {
      await fetch('/api/forward-test', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          action: 'UPDATE_CONFIG',
          strategy: strat,
          symbols: syms,
          timeframe: tf,
          perTradeRiskPct: rTrade,
          overallRiskPct: rOverall,
          leverage: effectiveLeverage,
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
        headers: getAuthHeaders(),
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
        headers: getAuthHeaders(),
        body: JSON.stringify({
          action: 'RUN_1DAY_REPLAY',
          strategy: selectedStrategy,
          symbols: selectedSymbols,
          timeframe: selectedTimeframe,
          startingCapital: capitalInput,
          perTradeRiskPct: riskPct,
          overallRiskPct: overallRiskPct,
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
  const handleResetWallet = async (amount: number = capitalInput) => {
    const targetAmt = amount || 10000;
    const confirmed = await showConfirm({
      title: 'Reset Virtual Wallet',
      message: `Reset your virtual wallet balance to ₹${targetAmt.toLocaleString('en-IN')}? All active positions and simulated trade history will be cleared.`,
      type: 'warning',
      confirmText: 'Reset Wallet',
    });
    if (!confirmed) return;

    try {
      const res = await fetch('/api/forward-test', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ action: 'RESET_WALLET', startingBalance: targetAmt }),
      });
      const json = await res.json();
      if (json.success) {
        setData(json.state);
        setStats(json.stats);
        setCapitalInput(targetAmt);
        await showAlert({
          title: 'Virtual Wallet Reset',
          message: `Virtual wallet successfully reset to ₹${targetAmt.toLocaleString('en-IN')}.`,
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
      message: `Square off ${pos.side} ${pos.symbol} at current live market price $${pos.currentPrice.toLocaleString()}?`,
      type: 'danger',
      confirmText: 'Square Off Position',
    });
    if (!confirmed) return;

    try {
      const res = await fetch('/api/forward-test', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ action: 'SQUARE_OFF', positionId: pos.id }),
      });
      const json = await res.json();
      if (json.success) {
        setData(json.state);
        setStats(json.stats);
      }
    } catch (err: any) {
      await showAlert({ title: 'Error', message: err.message, type: 'danger' });
    }
  };

  // Export 1-Day Report to CSV
  const handleExportCSV = () => {
    if (!data?.closedTrades?.length) {
      showAlert({ title: 'No Trades to Export', message: 'There are no closed trades to export.', type: 'info' });
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
    link.setAttribute('download', `forward_test_trades_${userToken || 'trader'}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const isRunning = data?.config.isRunning ?? false;
  const positions = data?.positions || [];
  const closedTrades = data?.closedTrades || [];
  const wallet = data?.wallet || { startingBalance: 10000, balance: 10000, realizedPnl: 0, unrealizedPnl: 0 };
  const riskPausedReason = data?.config?.riskPausedReason;

  return (
    <div className="space-y-6 max-w-6xl pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
              <PlayCircle className="w-6 h-6 text-emerald-400" />
              Forward Testing Engine (Virtual Simulator)
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
            Experience the algo in real-time with virtual money on 100% live institutional market feeds without risking real capital.
          </p>
          <div className="flex items-center gap-2 mt-2.5">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span className="text-slate-400">Isolated Sandbox:</span>
              <span className="font-mono font-bold text-emerald-300">{userToken || 'DEFAULT'}</span>
              <span className="text-[10px] text-emerald-500/80 ml-1">• 100% Private Wallet</span>
            </div>
          </div>
        </div>

        {/* Primary Controls */}
        <div className="flex items-center gap-2.5 flex-wrap self-start sm:self-auto">
          <button
            type="button"
            onClick={handleToggleRunning}
            disabled={syncing}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all shadow-md active:scale-95 disabled:opacity-50 ${
              isRunning
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30'
                : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/20'
            }`}
          >
            {isRunning ? (
              <>
                <PauseCircle className="w-4 h-4" /> Pause Engine
              </>
            ) : (
              <>
                <PlayCircle className="w-4 h-4" /> Start Live Algo
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleRun1DayReplay}
            disabled={replaying}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-bold text-xs shadow-md transition-all active:scale-95 disabled:opacity-50"
            title="Simulate all 288 real market candles of the past 24 hours"
          >
            {replaying ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4 fill-white" />}
            {replaying ? 'Replaying 24h...' : '⚡ Run 24h Replay'}
          </button>

          <button
            type="button"
            onClick={() => handleResetWallet(capitalInput)}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-850 hover:bg-slate-800 text-slate-300 border border-slate-700 font-semibold text-xs transition-all"
            title="Reset wallet to starting balance"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
            Reset
          </button>
        </div>
      </div>

      {/* Capital Protection Alert Notice (If Triggered) */}
      {riskPausedReason && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <span className="font-bold block text-white">CAPITAL PROTECTION CIRCUIT TRIGGERED</span>
              <span className="text-slate-300">{riskPausedReason}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => handleResetWallet(capitalInput)}
            className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs"
          >
            Reset Wallet
          </button>
        </div>
      )}

      {/* LIVE VIRTUAL WALLET METRICS GRID */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 sm:gap-4">
        {/* Virtual Balance */}
        <div className="p-4 sm:p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Virtual Wallet Balance</span>
            <Wallet className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono text-white">
            ₹{wallet.balance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-400 font-mono">
            Started: ₹{wallet.startingBalance.toLocaleString('en-IN')} (
            <span className={stats?.returnPct >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
              {stats?.returnPct >= 0 ? '+' : ''}{stats?.returnPct || 0}%
            </span>)
          </div>
        </div>

        {/* Floating P&L */}
        <div className="p-4 sm:p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Live Floating P&L</span>
            <Clock className="w-4 h-4 text-cyan-400" />
          </div>
          <div className={`text-xl sm:text-2xl font-black font-mono ${
            (wallet.unrealizedPnl || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
          }`}>
            {(wallet.unrealizedPnl || 0) >= 0 ? '+' : ''}₹{(wallet.unrealizedPnl || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-400 font-mono">
            {positions.length} active position{positions.length === 1 ? '' : 's'}
          </div>
        </div>

        {/* Realized P&L */}
        <div className="p-4 sm:p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Realized P&L Today</span>
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
            <span>Simulation Win Rate</span>
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

      {/* 5-STEP INSTITUTIONAL FORWARD TESTING WORKFLOW */}
      <div className="p-5 sm:p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-5 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base font-bold text-white">Forward Testing Configuration Setup</h2>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            Virtual Money • Live Market Tick Execution
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* STEP 1: Select Strategy */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center text-[10px] font-bold">1</span>
              <label className="text-xs font-bold text-slate-200">Select Strategy</label>
            </div>
            <div className="space-y-2">
              {[
                { id: 'Strategy B' as const, label: 'Strategy B: Phantom AI', tag: '⚡ SMC + ICT Scalper (BOS • OB • FVG • 1:3.5 RR)' },
                { id: 'Strategy C' as const, label: 'Strategy C: Daily Breakout', tag: '🔥 6 Core Setups (PDH • PDL • PDC • 1:3 RR)' },
                { id: 'Strategy A' as const, label: 'Strategy A: Trend Momentum', tag: 'VWAP & SuperTrend Momentum Follower' },
              ].map((st) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => {
                    setSelectedStrategy(st.id);
                    updateServerConfig(st.id, selectedSymbols, riskPct, overallRiskPct);
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

            {/* Candle Timeframe Selector */}
            <div className="pt-2 border-t border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-cyan-400" />
                  Candle Timeframe:
                </label>
                <span className="text-[10px] text-cyan-400 font-mono font-bold">
                  {selectedTimeframe === '5m' ? '5m (Standard)' : selectedTimeframe}
                </span>
              </div>
              <div className="grid grid-cols-5 gap-1">
                {AVAILABLE_TIMEFRAMES.map((tf) => {
                  const isSel = selectedTimeframe === tf.id;
                  return (
                    <button
                      key={tf.id}
                      type="button"
                      onClick={() => {
                        setSelectedTimeframe(tf.id);
                        updateServerConfig(selectedStrategy, selectedSymbols, riskPct, overallRiskPct, tf.id);
                      }}
                      className={`py-1.5 rounded-lg text-center border transition-all ${
                        isSel
                          ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 font-bold shadow-sm'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                      }`}
                    >
                      <div className="text-xs font-mono font-bold">{tf.label}</div>
                      <div className={`text-[8px] truncate ${tf.isRecommended ? 'text-emerald-400 font-semibold' : 'text-slate-500'}`}>
                        {tf.isRecommended ? 'Rec' : tf.label}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Universal Trailing SL Badge */}
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-between text-xs">
              <span className="text-[11px] text-emerald-300 font-medium flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                Universal Trailing SL:
              </span>
              <span className="text-[10px] font-mono font-bold text-emerald-400">
                +35% SL @ 100% move
              </span>
            </div>
          </div>

          {/* STEP 2: Select Instrument (Multi-Select) */}
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
                      {isSelected && <Check className="w-3.5 h-3.5 text-cyan-400 stroke-[3]" />}
                    </div>
                    <span className="text-[10px] text-slate-400">{inst.name}</span>
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-slate-500">
              Scanning: {selectedSymbols.length} instrument{selectedSymbols.length === 1 ? '' : 's'} simultaneously.
            </p>
          </div>

          {/* STEPS 3, 4, 5: Capital, Overall Risk, Risk Per Trade & Auto-Leverage */}
          <div className="space-y-3 p-4 rounded-xl bg-slate-950/80 border border-slate-800">
            {/* Virtual Capital */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] text-slate-300 font-semibold flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-full bg-amber-500/20 text-amber-400 text-[9px] font-bold flex items-center justify-center">3</span>
                  Virtual Wallet Capital
                </label>
              </div>
              <div className="relative mb-1.5">
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
                  placeholder="10000"
                />
              </div>
              <div className="grid grid-cols-4 gap-1">
                {[10000, 25000, 50000, 100000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => {
                      setCapitalInput(amt);
                      handleResetWallet(amt);
                    }}
                    className={`py-1 rounded text-[10px] font-mono font-bold border transition-all ${
                      capitalInput === amt
                        ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    {amt === 10000 ? '₹10k (Def)' : amt >= 100000 ? '₹1L' : `₹${amt / 1000}k`}
                  </button>
                ))}
              </div>
            </div>

            {/* Overall Risk (Capital Protection Limit) */}
            <div className="pt-2 border-t border-slate-800">
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] text-slate-300 font-semibold flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-full bg-rose-500/20 text-rose-400 text-[9px] font-bold flex items-center justify-center">4</span>
                  Overall Risk Limit
                </label>
                <span className="text-[10px] text-rose-400 font-mono font-bold">
                  Max Loss: ₹{((capitalInput * overallRiskPct) / 100).toLocaleString('en-IN')} ({overallRiskPct}%)
                </span>
              </div>
              <div className="grid grid-cols-4 gap-1">
                {[5, 10, 15, 20].map((or) => (
                  <button
                    key={or}
                    type="button"
                    onClick={() => {
                      setOverallRiskPct(or);
                      updateServerConfig(selectedStrategy, selectedSymbols, riskPct, or);
                    }}
                    className={`py-1 rounded text-[10px] font-mono font-bold border transition-all ${
                      overallRiskPct === or
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500 font-black'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {or}%
                  </button>
                ))}
              </div>
            </div>

            {/* Risk Per Trade */}
            <div className="pt-2 border-t border-slate-800">
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] text-slate-300 font-semibold flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-full bg-cyan-500/20 text-cyan-400 text-[9px] font-bold flex items-center justify-center">5</span>
                  Risk per Trade
                </label>
                <span className="text-[10px] text-cyan-400 font-mono font-bold">
                  ₹{((capitalInput * riskPct) / 100).toLocaleString('en-IN')} ({riskPct}%)
                </span>
              </div>
              <div className="grid grid-cols-5 gap-1">
                {[0.5, 1, 2, 3, 5].map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => {
                      setRiskPct(p);
                      updateServerConfig(selectedStrategy, selectedSymbols, p, overallRiskPct);
                    }}
                    className={`py-1 rounded text-[10px] font-mono font-bold border transition-all ${
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

            {/* Auto Leverage Calculate */}
            <div className="pt-2 border-t border-slate-800">
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] text-slate-300 font-semibold flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  Leverage (Auto-Calculate)
                </label>
                <button
                  type="button"
                  onClick={() => setManualLeverage(!manualLeverage)}
                  className="text-[10px] text-cyan-400 hover:underline"
                >
                  {manualLeverage ? 'Auto Mode' : 'Override'}
                </button>
              </div>

              {!manualLeverage ? (
                <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-mono font-black text-amber-400">{getAutoLeverage()}x</span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      ({riskPct}% risk ÷ {selectedStrategy === 'Strategy B' ? '0.4%' : '1.0%'} avg SL)
                    </span>
                  </div>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold uppercase">
                    AUTO SAFE
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={1}
                    max={50}
                    value={customLeverage}
                    onChange={(e) => setCustomLeverage(Number(e.target.value))}
                    className="flex-1 accent-amber-500"
                  />
                  <span className="font-mono font-bold text-amber-400 text-xs w-8">{customLeverage}x</span>
                </div>
              )}
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
              The engine is scanning {selectedSymbols.join(', ')} for {selectedStrategy} triggers. You can also click <strong>⚡ Run 24h Replay</strong> above to experience today's trades instantly.
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
              <tbody className="divide-y divide-slate-850">
                {positions.map((pos) => (
                  <tr key={pos.id} className="hover:bg-slate-850/50 transition-colors">
                    <td className="py-3 px-3 font-mono font-bold text-white">{pos.symbol}</td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                        pos.side === 'BUY' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                      }`}>
                        {pos.side}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-medium text-slate-300">{pos.setupName}</td>
                    <td className="py-3 px-3 font-mono text-slate-300">${pos.entryPrice.toLocaleString()}</td>
                    <td className="py-3 px-3 font-mono text-slate-200 font-bold">${pos.currentPrice.toLocaleString()}</td>
                    <td className="py-3 px-3 font-mono">
                      <div className="text-rose-400 font-bold">${pos.stopLoss.toLocaleString()}</div>
                      {pos.trailingMilestone && pos.trailingMilestone > 0 ? (
                        <span className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                          ⚡ +{pos.trailingMilestone * 35}% Trailed
                        </span>
                      ) : (
                        <span className="text-[9px] text-slate-500">Fixed SL</span>
                      )}
                    </td>
                    <td className="py-3 px-3 font-mono text-emerald-400">${pos.takeProfit.toLocaleString()}</td>
                    <td className="py-3 px-3 font-mono font-bold">
                      <span className={pos.unrealizedPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                        {pos.unrealizedPnl >= 0 ? '+' : ''}₹{pos.unrealizedPnl.toFixed(2)} ({pos.unrealizedPnlPct}%)
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleSquareOff(pos)}
                        className="px-2.5 py-1 rounded bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white font-bold text-[10px] transition-all"
                      >
                        Square Off
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* TODAY'S CLOSED TRADES AUDIT LOG */}
      <div className="p-5 sm:p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base font-bold text-white">Closed Trades Audit Log ({closedTrades.length})</h2>
          </div>
          {closedTrades.length > 0 && (
            <button
              type="button"
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" />
              Export CSV
            </button>
          )}
        </div>

        {closedTrades.length === 0 ? (
          <div className="p-8 rounded-xl bg-slate-950/60 border border-slate-800 text-center text-slate-400 text-xs">
            No closed trades yet today. Trades will appear here when Target or Stop Loss is reached.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[10px] font-semibold">
                  <th className="py-3 px-3">Symbol</th>
                  <th className="py-3 px-3">Setup</th>
                  <th className="py-3 px-3">Side</th>
                  <th className="py-3 px-3">Entry</th>
                  <th className="py-3 px-3">Exit</th>
                  <th className="py-3 px-3">P&L (INR)</th>
                  <th className="py-3 px-3">Return</th>
                  <th className="py-3 px-3">Exit Reason</th>
                  <th className="py-3 px-3">Exit Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850">
                {closedTrades.map((tr) => (
                  <tr key={tr.id} className="hover:bg-slate-850/50 transition-colors">
                    <td className="py-3 px-3 font-mono font-bold text-white">{tr.symbol}</td>
                    <td className="py-3 px-3 text-slate-300 font-medium">{tr.setupName}</td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                        tr.side === 'BUY' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                      }`}>
                        {tr.side}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-300">${tr.entryPrice.toLocaleString()}</td>
                    <td className="py-3 px-3 font-mono text-slate-300">${tr.exitPrice.toLocaleString()}</td>
                    <td className={`py-3 px-3 font-mono font-bold ${tr.realizedPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {tr.realizedPnl >= 0 ? '+' : ''}₹{tr.realizedPnl.toFixed(2)}
                    </td>
                    <td className={`py-3 px-3 font-mono font-bold ${tr.pnlPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {tr.pnlPct >= 0 ? '+' : ''}{tr.pnlPct}%
                    </td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                        tr.result === 'WIN' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                      }`}>
                        {tr.exitReason}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono text-[11px] text-slate-400">{tr.exitTime}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
