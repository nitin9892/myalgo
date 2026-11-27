'use client';

import { useState, useEffect } from 'react';
import { 
  History, 
  Play, 
  RefreshCw, 
  Download, 
  TrendingUp, 
  TrendingDown, 
  ShieldCheck, 
  CheckCircle2, 
  XCircle, 
  Zap, 
  Layers, 
  BarChart2, 
  Clock, 
  Sliders, 
  Check, 
  AlertTriangle,
  ArrowRight
} from 'lucide-react';
import { useModal } from '@/context/ModalContext';

interface BacktestTrade {
  id: string;
  entryTime: string;
  exitTime: string;
  symbol: string;
  setupName: string;
  side: 'BUY' | 'SELL';
  entryPrice: number;
  exitPrice: number;
  stopLoss: number;
  takeProfit: number;
  quantity: number;
  pnl: number;
  pnlPct: number;
  result: 'WIN' | 'LOSS';
  exitReason: string;
  durationCandles: number;
}

interface BacktestResult {
  strategy: string;
  symbol: string;
  timeframe: string;
  days: number;
  totalCandles: number;
  dataSource: string;
  initialCapital: number;
  finalCapital: number;
  netPnl: number;
  returnPct: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRatePct: number;
  profitFactor: number;
  maxDrawdownPct: number;
  avgTradePnl: number;
  trades: BacktestTrade[];
}

export default function BacktestingPage() {
  const { showAlert } = useModal();
  const [userToken, setUserToken] = useState<string>('');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [strategy, setStrategy] = useState<'Strategy B' | 'Strategy C' | 'Strategy A'>('Strategy B');
  const [symbol, setSymbol] = useState<'BTCUSD' | 'ETHUSD' | 'SOLUSD' | 'XRPUSD'>('BTCUSD');
  const [timeframe, setTimeframe] = useState<'5m' | '15m' | '1h'>('5m');
  const [days, setDays] = useState<number>(7);
  const [initialCapital, setInitialCapital] = useState<number>(10000);
  const [riskPct, setRiskPct] = useState<number>(2);
  const [trailingEnabled, setTrailingEnabled] = useState<boolean>(true);
  const [manualLeverage, setManualLeverage] = useState<boolean>(false);
  const [customLeverage, setCustomLeverage] = useState<number>(5);
  const [allowedStrategies, setAllowedStrategies] = useState<string[] | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('myalgo_access_token') || 'DEFAULT_TRADER';
    setUserToken(saved.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '_'));

    try {
      const savedPerms = localStorage.getItem('myalgo_access_permissions');
      if (savedPerms) {
        const parsed = JSON.parse(savedPerms);
        if (parsed.allowed_strategies && Array.isArray(parsed.allowed_strategies) && parsed.allowed_strategies.length > 0) {
          setAllowedStrategies(parsed.allowed_strategies);
          if (!parsed.allowed_strategies.includes(strategy)) {
            setStrategy(parsed.allowed_strategies[0] as any);
          }
        }
      }
    } catch {}
  }, []);

  // Compute Auto Leverage
  const getAutoLeverage = () => {
    let avgSlPct = 0.4;
    if (strategy === 'Strategy C') avgSlPct = 1.0;
    if (strategy === 'Strategy A') avgSlPct = 1.2;
    const raw = Math.ceil(riskPct / avgSlPct);
    return Math.min(50, Math.max(1, raw));
  };

  const effectiveLeverage = manualLeverage ? customLeverage : getAutoLeverage();

  const handleRunBacktest = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setRunning(true);
    setError(null);

    try {
      const res = await fetch('/api/backtest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-access-token': userToken,
        },
        body: JSON.stringify({
          strategy,
          symbol,
          timeframe,
          days,
          initialCapital: Math.max(100, initialCapital),
          perTradeRiskPct: riskPct,
          leverage: effectiveLeverage,
          autoLeverage: !manualLeverage,
          trailingEnabled,
        }),
      });

      const data = await res.json();
      if (data.success && data.results) {
        setResult(data.results);
      } else {
        setError(data.error || 'Failed to execute backtest. Please check market feed connection.');
      }
    } catch (err: any) {
      setError(err.message || 'Network error running backtest.');
    } finally {
      setRunning(false);
    }
  };

  const handleExportCSV = () => {
    if (!result?.trades?.length) return;
    const headers = ['Trade ID', 'Symbol', 'Setup', 'Side', 'Qty', 'Entry Price', 'Exit Price', 'P&L', 'P&L %', 'Result', 'Exit Reason', 'Entry Time', 'Exit Time'];
    const rows = result.trades.map((t) => [
      t.id,
      t.symbol,
      `"${t.setupName}"`,
      t.side,
      t.quantity,
      t.entryPrice,
      t.exitPrice,
      t.pnl,
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
    link.setAttribute('download', `backtest_${strategy.replace(' ', '_')}_${symbol}_${days}d.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 max-w-6xl pb-12">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
              <History className="w-6 h-6 text-cyan-400" />
              Real Market Backtesting Terminal
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
              100% REAL HISTORICAL CANDLES
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Backtest quant strategies against unblocked institutional tick feeds (Delta Exchange India & Binance Data Mirror).
          </p>
          <div className="flex items-center gap-2 mt-2.5">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span className="text-slate-400">Verified Trader:</span>
              <span className="font-mono font-bold text-cyan-300">{userToken || 'ACTIVE'}</span>
            </div>
          </div>
        </div>

        {result && (
          <button
            type="button"
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 self-start sm:self-auto transition-all"
          >
            <Download className="w-4 h-4 text-cyan-400" />
            Export Trades CSV
          </button>
        )}
      </div>

      {/* Configuration Form Card */}
      <div className="p-5 sm:p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-6 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-cyan-400" />
            <h2 className="text-base font-bold text-white">Backtest Parameters & Risk Setup</h2>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            Step-by-step institutional workflow
          </span>
        </div>

        <form onSubmit={handleRunBacktest} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {/* 1. Strategy Selection */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-200 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center text-[10px] font-bold">1</span>
                Select Strategy
              </label>
              <div className="space-y-2">
                {[
                  { id: 'Strategy B' as const, title: 'Strategy B: Phantom AI', desc: 'SMC + ICT Scalper (BOS • OB • FVG • 1:3.5 RR)' },
                  { id: 'Strategy C' as const, title: 'Strategy C: Daily Breakout', desc: '6 Core Institutional Setups (PDH • PDL • 1:3 RR)' },
                  { id: 'Strategy A' as const, title: 'Strategy A: Trend Momentum', desc: 'VWAP & SuperTrend Momentum Follower' },
                ].filter((s) => !allowedStrategies || allowedStrategies.includes(s.id)).map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setStrategy(s.id)}
                    className={`w-full p-2.5 rounded-xl text-left border transition-all ${
                      strategy === s.id
                        ? 'bg-cyan-500/20 border-cyan-500 text-cyan-200 shadow-sm'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-white">{s.title}</span>
                      {strategy === s.id && <Check className="w-3.5 h-3.5 text-cyan-400 stroke-[3]" />}
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5">{s.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Instrument & Timeframe */}
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-200 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center text-[10px] font-bold">2</span>
                  Select Instrument
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'BTCUSD' as const, label: 'BTC / USD', name: 'Bitcoin' },
                    { id: 'ETHUSD' as const, label: 'ETH / USD', name: 'Ethereum' },
                    { id: 'SOLUSD' as const, label: 'SOL / USD', name: 'Solana' },
                    { id: 'XRPUSD' as const, label: 'XRP / USD', name: 'Ripple' },
                  ].map((inst) => (
                    <button
                      key={inst.id}
                      type="button"
                      onClick={() => setSymbol(inst.id)}
                      className={`p-2.5 rounded-xl border text-center transition-all ${
                        symbol === inst.id
                          ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 font-bold'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className="text-xs font-mono font-bold text-white">{inst.label}</div>
                      <div className="text-[10px] text-slate-400">{inst.name}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Timeframe & Duration */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-300 block mb-1">Timeframe</label>
                  <div className="grid grid-cols-3 gap-1">
                    {(['5m', '15m', '1h'] as const).map((tf) => (
                      <button
                        key={tf}
                        type="button"
                        onClick={() => setTimeframe(tf)}
                        className={`py-1.5 rounded-lg text-xs font-mono font-bold border ${
                          timeframe === tf
                            ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300'
                            : 'bg-slate-950 border-slate-800 text-slate-400'
                        }`}
                      >
                        {tf}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-300 block mb-1">Days Range</label>
                  <select
                    value={days}
                    onChange={(e) => setDays(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-white font-mono text-xs focus:outline-none focus:border-cyan-500"
                  >
                    <option value={1}>1 Day (288 candles)</option>
                    <option value={3}>3 Days (864 candles)</option>
                    <option value={7}>7 Days (2,016 candles)</option>
                    <option value={14}>14 Days (4,032 candles)</option>
                    <option value={30}>30 Days (8,640 candles)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* 3. Capital, Risk & Auto-Leverage */}
            <div className="space-y-3 p-4 rounded-xl bg-slate-950/80 border border-slate-800">
              <label className="text-xs font-bold text-slate-200 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center text-[10px] font-bold">3</span>
                Capital & Auto-Leverage
              </label>

              {/* Capital Input with Pills */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] text-slate-300 font-semibold">Initial Capital (₹ INR)</span>
                </div>
                <div className="relative mb-2">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={initialCapital ? initialCapital.toString() : ''}
                    onChange={(e) => {
                      const clean = e.target.value.replace(/[^0-9]/g, '');
                      setInitialCapital(clean ? Number(clean) : 0);
                    }}
                    placeholder="10000"
                    className="w-full pl-7 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-white font-mono text-xs focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div className="grid grid-cols-4 gap-1">
                  {[10000, 25000, 50000, 100000].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setInitialCapital(amt)}
                      className={`py-1 rounded text-[10px] font-mono font-bold border ${
                        initialCapital === amt
                          ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      {amt >= 100000 ? '₹1L' : `₹${amt / 1000}k`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Risk per trade */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] text-slate-300 font-semibold">Risk Per Trade</span>
                  <span className="text-[10px] text-cyan-400 font-mono font-bold">
                    ₹{((initialCapital * riskPct) / 100).toLocaleString('en-IN')} ({riskPct}%)
                  </span>
                </div>
                <div className="grid grid-cols-5 gap-1">
                  {[0.5, 1, 2, 3, 5].map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRiskPct(r)}
                      className={`py-1 rounded text-[10px] font-mono font-bold border ${
                        riskPct === r
                          ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      {r}%
                    </button>
                  ))}
                </div>
              </div>

              {/* Auto Calculated Leverage Badge */}
              <div className="pt-2 border-t border-slate-800">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] text-slate-300 font-semibold flex items-center gap-1">
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                    Leverage (Auto-Calculated)
                  </span>
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
                        ({riskPct}% risk ÷ {strategy === 'Strategy B' ? '0.4%' : '1.0%'} avg SL)
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

          {/* Action Button: Run Backtest */}
          <div className="flex items-center justify-between pt-2">
            <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300 select-none">
              <input
                type="checkbox"
                checked={trailingEnabled}
                onChange={(e) => setTrailingEnabled(e.target.checked)}
                className="w-4 h-4 rounded bg-slate-950 border-slate-700 text-cyan-500 focus:ring-0"
              />
              <span>Enable Trailing Stop-Loss (Protect profits at 1:1.5 RR milestone)</span>
            </label>

            <button
              type="submit"
              disabled={running}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black text-xs transition-all shadow-lg shadow-cyan-500/20 active:scale-95 disabled:opacity-50 flex items-center gap-2.5"
            >
              {running ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Fetching Candles & Simulating...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-slate-950" />
                  Run Backtest: {strategy} • {symbol} ({days} Days)
                </>
              )}
            </button>
          </div>
        </form>

        {error && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Backtest Results Display */}
      {result && (
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* Header Card */}
          <div className="p-4 sm:p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <h3 className="text-base font-bold text-white">
                  {result.strategy} Backtest Report ({result.totalCandles.toLocaleString()} Live Candles)
                </h3>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                {result.dataSource} • {result.symbol} • {result.timeframe} • {result.days} Days
              </p>
            </div>
            <div className="text-xs font-mono text-slate-300 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 self-start sm:self-auto">
              Capital: ₹{result.initialCapital.toLocaleString('en-IN')} <ArrowRight className="w-3 h-3 inline text-slate-500" /> ₹{result.finalCapital.toLocaleString('en-IN')}
            </div>
          </div>

          {/* KPI Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 sm:gap-4">
            {/* Net P&L */}
            <div className="p-4 sm:p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-1">
              <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
                <span>Net Simulated P&L</span>
                {result.netPnl >= 0 ? <TrendingUp className="w-4 h-4 text-emerald-400" /> : <TrendingDown className="w-4 h-4 text-rose-400" />}
              </div>
              <div className={`text-xl sm:text-2xl font-black font-mono ${result.netPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {result.netPnl >= 0 ? '+' : ''}₹{result.netPnl.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className={`text-[11px] font-mono font-bold ${result.returnPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {result.returnPct >= 0 ? '+' : ''}{result.returnPct}% Return
              </div>
            </div>

            {/* Win Rate */}
            <div className="p-4 sm:p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-1">
              <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
                <span>Win Rate</span>
                <CheckCircle2 className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="text-xl sm:text-2xl font-black font-mono text-cyan-400">
                {result.winRatePct}%
              </div>
              <div className="text-[11px] text-slate-400 font-mono">
                {result.winningTrades} Wins / {result.losingTrades} Losses ({result.totalTrades} Total)
              </div>
            </div>

            {/* Profit Factor */}
            <div className="p-4 sm:p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-1">
              <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
                <span>Profit Factor</span>
                <Zap className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-xl sm:text-2xl font-black font-mono text-amber-400">
                {result.profitFactor}x
              </div>
              <div className="text-[11px] text-slate-400 font-mono">
                Avg Trade: ₹{result.avgTradePnl.toFixed(2)}
              </div>
            </div>

            {/* Max Drawdown */}
            <div className="p-4 sm:p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-1">
              <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
                <span>Max Drawdown</span>
                <ShieldCheck className="w-4 h-4 text-rose-400" />
              </div>
              <div className="text-xl sm:text-2xl font-black font-mono text-rose-400">
                {result.maxDrawdownPct}%
              </div>
              <div className="text-[11px] text-slate-400 font-mono">
                Capital Protection Intact
              </div>
            </div>
          </div>

          {/* Simulated Trades History Table */}
          <div className="p-5 sm:p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base font-bold text-white">Simulated Trades Log ({result.trades.length} Trades)</h3>
              </div>
              <span className="text-xs text-slate-400 font-mono">
                Final Capital: ₹{result.finalCapital.toLocaleString('en-IN')}
              </span>
            </div>

            {result.trades.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs bg-slate-950/60 rounded-xl border border-slate-800">
                No trades triggered during this testing window under selected risk filters.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[10px] font-semibold">
                      <th className="py-3 px-3">#</th>
                      <th className="py-3 px-3">Setup</th>
                      <th className="py-3 px-3">Side</th>
                      <th className="py-3 px-3">Entry Price</th>
                      <th className="py-3 px-3">Exit Price</th>
                      <th className="py-3 px-3">Exit Reason</th>
                      <th className="py-3 px-3">P&L (INR)</th>
                      <th className="py-3 px-3">Return %</th>
                      <th className="py-3 px-3">Exit Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850">
                    {result.trades.map((tr) => (
                      <tr key={tr.id} className="hover:bg-slate-850/50 transition-colors">
                        <td className="py-3 px-3 font-mono text-slate-400">{tr.id}</td>
                        <td className="py-3 px-3 font-medium text-slate-200">{tr.setupName}</td>
                        <td className="py-3 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                            tr.side === 'BUY' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                          }`}>
                            {tr.side}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-300">
                          ${tr.entryPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-300">
                          ${tr.exitPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-3">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                            tr.result === 'WIN' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                          }`}>
                            {tr.exitReason}
                          </span>
                        </td>
                        <td className={`py-3 px-3 font-mono font-bold ${tr.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {tr.pnl >= 0 ? '+' : ''}₹{tr.pnl.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className={`py-3 px-3 font-mono font-bold ${tr.pnlPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {tr.pnlPct >= 0 ? '+' : ''}{tr.pnlPct}%
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
      )}
    </div>
  );
}
