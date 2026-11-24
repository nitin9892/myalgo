'use client';

import { useState, useEffect } from 'react';
import { 
  Cpu, 
  Power, 
  ShieldAlert, 
  Settings, 
  Check, 
  Clock, 
  TrendingUp, 
  Layers, 
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  Save,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  Info
} from 'lucide-react';

export default function StrategiesPage() {
  const [isActive, setIsActive] = useState(true);
  const [paperTrading, setPaperTrading] = useState(true);
  const [broker, setBroker] = useState<'DHAN' | 'DELTA' | 'METATRADER'>('DELTA');
  const [symbol, setSymbol] = useState('BTCUSD');
  
  // Strategy Parameters
  const [slCandleMode, setSlCandleMode] = useState<'signal_candle' | 'prev_candle'>('signal_candle');
  const [maxTradesPerDay, setMaxTradesPerDay] = useState(3);
  const [lotSize, setLotSize] = useState(1);
  const [trailStepPoints, setTrailStepPoints] = useState(10);
  const [trailAmountPoints, setTrailAmountPoints] = useState(3);
  const [sessionStart, setSessionStart] = useState('00:00');
  const [noTradeStart, setNoTradeStart] = useState('00:00');
  const [noTradeEnd, setNoTradeEnd] = useState('00:00');
  const [squareOffTime, setSquareOffTime] = useState('23:59');
  const [prevHigh, setPrevHigh] = useState<number>(96500);
  const [prevLow, setPrevLow] = useState<number>(93200);
  const [prevClose, setPrevClose] = useState<number>(95100);

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    fetchStrategySettings();
  }, []);

  const fetchStrategySettings = async () => {
    try {
      const res = await fetch('/api/strategies');
      const data = await res.json();
      if (data.strategy) {
        const s = data.strategy;
        setIsActive(s.is_active ?? true);
        setPaperTrading(s.paper_trading ?? true);
        if (s.broker_name) setBroker(s.broker_name);
        if (s.symbol) setSymbol(s.symbol);

        const p = s.parameters || s.params || {};
        if (p.sl_candle_mode) setSlCandleMode(p.sl_candle_mode);
        if (p.max_trades_per_day) setMaxTradesPerDay(p.max_trades_per_day);
        if (p.lot_size) setLotSize(p.lot_size);
        if (p.trail_step_points) setTrailStepPoints(p.trail_step_points);
        if (p.trail_amount_points) setTrailAmountPoints(p.trail_amount_points);
        if (p.session_start) setSessionStart(p.session_start);
        if (p.no_trade_start) setNoTradeStart(p.no_trade_start);
        if (p.no_trade_end) setNoTradeEnd(p.no_trade_end);
        if (p.square_off_time) setSquareOffTime(p.square_off_time);
        if (p.prev_high) setPrevHigh(p.prev_high);
        if (p.prev_low) setPrevLow(p.prev_low);
        if (p.prev_close) setPrevClose(p.prev_close);
      }
    } catch (err) {
      console.error('Failed to load strategy:', err);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveSuccess(false);
    try {
      const payload = {
        id: 'master-5m-breakout',
        name: '5m Previous Day Levels Breakout Engine',
        broker_name: broker,
        symbol: symbol.toUpperCase(),
        timeframe: '5m',
        is_active: isActive,
        paper_trading: paperTrading,
        params: {
          sl_candle_mode: slCandleMode,
          max_trades_per_day: Number(maxTradesPerDay),
          lot_size: Number(lotSize),
          trail_step_points: Number(trailStepPoints),
          trail_amount_points: Number(trailAmountPoints),
          session_start: sessionStart,
          no_trade_start: noTradeStart,
          no_trade_end: noTradeEnd,
          square_off_time: squareOffTime,
          prev_high: Number(prevHigh),
          prev_low: Number(prevLow),
          prev_close: Number(prevClose),
        },
      };

      const res = await fetch('/api/strategies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (err: any) {
      alert(`Save failed: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Cpu className="w-6 h-6 text-emerald-400" />
            Master Strategy Engine
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-semibold">
              Single Core Active
            </span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            5-Minute Previous Day High/Low/Close Breakout with 1:3 RR and Step Trailing.
          </p>
        </div>

        {/* Master Power Toggle */}
        <div className="flex items-center gap-3 bg-slate-900 p-2 rounded-xl border border-slate-800">
          <span className="text-xs font-semibold text-slate-300">Strategy Status:</span>
          <button
            onClick={() => setIsActive(!isActive)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              isActive
                ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <Power className="w-3.5 h-3.5" />
            {isActive ? '🟢 RUNNING' : '⚪ PAUSED'}
          </button>
        </div>
      </div>

      {/* Primary Configuration Card */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-400" />
              5m Previous Day Breakout Setup
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Automated signal detection on 5-minute candle close beyond PDH, PDL, or PDC.
            </p>
          </div>

          {/* Mode Switcher */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPaperTrading(true)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-all ${
                paperTrading
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                  : 'bg-slate-800 text-slate-400 border-slate-700/60'
              }`}
            >
              🟢 Paper Trading
            </button>
            <button
              onClick={() => setPaperTrading(false)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-all ${
                !paperTrading
                  ? 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                  : 'bg-slate-800 text-slate-400 border-slate-700/60'
              }`}
            >
              🔴 Live Money
            </button>
          </div>
        </div>

        {/* Target Broker & Symbol Selection */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300">Target Execution Broker</label>
            <select
              value={broker}
              onChange={(e) => setBroker(e.target.value as any)}
              className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-emerald-500 font-semibold"
            >
              <option value="DELTA">Delta Exchange (Crypto Derivatives - BTC / ETH / XRP)</option>
              <option value="DHAN">DhanHQ (Indian Equities & F&O - NIFTY / BANKNIFTY)</option>
              <option value="METATRADER">MetaTrader 5 (Forex IPC Bridge - EURUSD / XAUUSD)</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-slate-300">Crypto Instrument</label>
              <span className="text-[11px] text-slate-500">Quick Select:</span>
            </div>
            
            <div className="flex items-center gap-1.5 mb-1.5">
              {(['BTCUSD', 'ETHUSD', 'XRPUSD'] as const).map((sym) => (
                <button
                  key={sym}
                  type="button"
                  onClick={() => setSymbol(sym)}
                  className={`flex-1 py-1 rounded-lg text-xs font-bold transition-all border ${
                    symbol === sym
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                  }`}
                >
                  {sym.replace('USD', '')}
                </button>
              ))}
            </div>

            <input
              type="text"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              placeholder="e.g. BTCUSD, ETHUSD, XRPUSD"
              className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-white font-mono focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        {/* Core Strategy Rules Explanation Banner */}
        <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-2 text-xs text-slate-300">
          <span className="font-semibold text-emerald-400 flex items-center gap-1.5">
            <Info className="w-4 h-4 text-emerald-400" /> Decoded Execution Logic:
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-400 font-mono">
            <div>• <span className="text-emerald-400">LONG (BUY):</span> 5m GREEN candle breaks & closes beyond level &rarr; Entry at High</div>
            <div>• <span className="text-rose-400">SHORT (SELL):</span> 5m RED candle breaks & closes beyond level &rarr; Entry at Low</div>
            <div>• <span className="text-cyan-400">Target (TP):</span> Initial SL Points × 3 (1:3 Risk to Reward)</div>
            <div>• <span className="text-amber-400">Step Trailing:</span> +3 pts SL & TP for every +10 pts favorable move</div>
          </div>
        </div>

        {/* Stop Loss & Trailing Configuration */}
        <div className="space-y-3 pt-2">
          <h3 className="text-xs font-bold text-slate-300 tracking-wider uppercase">Stop-Loss & Trailing Settings</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs text-slate-400">Stop-Loss Candle Mode</label>
              <select
                value={slCandleMode}
                onChange={(e) => setSlCandleMode(e.target.value as any)}
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-emerald-500"
              >
                <option value="signal_candle">Signal Candle (Breakout Candle)</option>
                <option value="prev_candle">Previous Candle (Prior to Breakout)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-slate-400">Trail Step Points (+Move)</label>
              <input
                type="number"
                value={trailStepPoints}
                onChange={(e) => setTrailStepPoints(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-200 font-mono focus:outline-none focus:border-emerald-500"
              />
              <span className="text-[10px] text-slate-500">Milestone step (Default: 10 pts)</span>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-slate-400">Trail Amount Points (+Lock)</label>
              <input
                type="number"
                value={trailAmountPoints}
                onChange={(e) => setTrailAmountPoints(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-200 font-mono focus:outline-none focus:border-emerald-500"
              />
              <span className="text-[10px] text-slate-500">Trailed points (Default: 3 pts)</span>
            </div>
          </div>
        </div>

        {/* Session & Time Windows */}
        <div className="space-y-3 pt-2">
          <h3 className="text-xs font-bold text-slate-300 tracking-wider uppercase">Trading Time Windows</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs text-slate-400">Session Start</label>
              <input
                type="text"
                value={sessionStart}
                onChange={(e) => setSessionStart(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-200 font-mono text-center focus:outline-none focus:border-emerald-500"
              />
              <span className="text-[10px] text-slate-500">No entry before</span>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-slate-400">No-Trade Start</label>
              <input
                type="text"
                value={noTradeStart}
                onChange={(e) => setNoTradeStart(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-amber-400 font-mono text-center focus:outline-none focus:border-amber-500"
              />
              <span className="text-[10px] text-slate-500">Block entry</span>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-slate-400">No-Trade End</label>
              <input
                type="text"
                value={noTradeEnd}
                onChange={(e) => setNoTradeEnd(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-amber-400 font-mono text-center focus:outline-none focus:border-amber-500"
              />
              <span className="text-[10px] text-slate-500">Resume entry</span>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-slate-400">Force Square-Off</label>
              <input
                type="text"
                value={squareOffTime}
                onChange={(e) => setSquareOffTime(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-rose-400 font-mono text-center focus:outline-none focus:border-rose-500"
              />
              <span className="text-[10px] text-slate-500">Auto exit all</span>
            </div>
          </div>
        </div>

        {/* Previous Day Levels (PDH, PDL, PDC) */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-300 tracking-wider uppercase">Key Levels (Previous Day OHLC)</h3>
            <span className="text-[11px] text-slate-500">Auto-detected from candles or manual override</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs text-slate-400">Prev Day High (PDH)</label>
              <input
                type="number"
                value={prevHigh}
                onChange={(e) => setPrevHigh(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-emerald-400 font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-slate-400">Prev Day Low (PDL)</label>
              <input
                type="number"
                value={prevLow}
                onChange={(e) => setPrevLow(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-rose-400 font-mono focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-slate-400">Prev Day Close (PDC)</label>
              <input
                type="number"
                value={prevClose}
                onChange={(e) => setPrevClose(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-cyan-400 font-mono focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div>
            {saveSuccess && (
              <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1.5">
                <Check className="w-4 h-4" /> Strategy Settings Saved Successfully!
              </span>
            )}
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Strategy Configuration'}
          </button>
        </div>
      </div>
    </div>
  );
}
