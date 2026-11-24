'use client';

import { useState } from 'react';
import { Terminal, RefreshCw, Filter, CheckCircle2, AlertTriangle, Info, Zap } from 'lucide-react';

export default function LogsPage() {
  const [logs] = useState([
    {
      id: '1',
      time: '08:45:00',
      level: 'TRADE_SIGNAL',
      source: 'ENGINE_DHAN',
      message: '[Nifty 9/21 EMA Cross] Executed BUY 50 NIFTY 24200 CE @ 145.20 (Bullish EMA Crossover)',
    },
    {
      id: '2',
      time: '08:44:00',
      level: 'INFO',
      source: 'CRON_EXECUTOR',
      message: 'Running trade cycle for 3 active strategies. Candlestick feeds synced.',
    },
    {
      id: '3',
      time: '08:30:15',
      level: 'TRADE_SIGNAL',
      source: 'ENGINE_DELTA',
      message: '[BTC Delta Supertrend] Executed BUY 0.25 BTCUSD @ 94850.00 (Supertrend Bullish Flip)',
    },
    {
      id: '4',
      time: '08:15:00',
      level: 'INFO',
      source: 'MT5_LOCAL_BRIDGE',
      message: 'Local MT5 runner heartbeat received. Connection active and listening.',
    },
    {
      id: '5',
      time: '08:00:00',
      level: 'INFO',
      source: 'DATABASE_INIT',
      message: 'Supabase trading schema successfully initialized.',
    },
  ]);

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between pb-6 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Terminal className="w-6 h-6 text-emerald-400" />
            Live Execution Logs
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Real-time audit log of signal calculations, broker API calls, and trade executions.
          </p>
        </div>
      </div>

      <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden font-mono text-xs shadow-2xl">
        <div className="bg-slate-950 px-4 py-3 border-b border-slate-800 flex items-center justify-between text-slate-400">
          <span className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
            Streaming live audit logs
          </span>
          <span className="text-[11px] text-slate-500">Auto-refresh every 3s</span>
        </div>

        <div className="divide-y divide-slate-800/80 p-2">
          {logs.map((log) => {
            const isTrade = log.level === 'TRADE_SIGNAL';
            return (
              <div key={log.id} className="py-2.5 px-3 flex flex-col sm:flex-row sm:items-center gap-3 hover:bg-slate-800/30">
                <span className="text-slate-500 shrink-0">{log.time}</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                  isTrade 
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                    : 'bg-slate-800 text-slate-300'
                }`}>
                  {log.level}
                </span>
                <span className="text-cyan-400 shrink-0 font-semibold">{log.source}</span>
                <span className="text-slate-200">{log.message}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
