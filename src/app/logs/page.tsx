'use client';

import { useState, useEffect } from 'react';
import { 
  Terminal, 
  RefreshCw, 
  Filter, 
  CheckCircle2, 
  AlertTriangle, 
  Info, 
  Zap, 
  Trash2, 
  Search 
} from 'lucide-react';

interface LogEntry {
  id: string;
  timestamp: string;
  level: string;
  source: string;
  message: string;
  metadata?: any;
}

export default function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [lastRefreshed, setLastRefreshed] = useState<string>('');

  const fetchLogs = async () => {
    try {
      const url = selectedLevel === 'ALL' 
        ? '/api/logs?limit=60' 
        : `/api/logs?level=${selectedLevel}&limit=60`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.success && data.logs) {
        setLogs(data.logs);
      }
      setLastRefreshed(new Date().toLocaleTimeString());
    } catch (err) {
      console.error('Failed to fetch logs:', err);
    }
  };

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 3500);
    return () => clearInterval(interval);
  }, [selectedLevel]);

  const handleManualRefresh = async () => {
    setLoading(true);
    await fetchLogs();
    setLoading(false);
  };

  const handleClearLogs = async () => {
    if (!confirm('Are you sure you want to clear the audit logs?')) return;
    try {
      await fetch('/api/logs', { method: 'DELETE' });
      setLogs([]);
    } catch (err) {
      console.error('Failed to clear logs:', err);
    }
  };

  // Filter logs by search keyword
  const filteredLogs = logs.filter((log) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      log.message?.toLowerCase().includes(term) ||
      log.source?.toLowerCase().includes(term) ||
      log.level?.toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Terminal className="w-6 h-6 text-emerald-400" />
            Live Execution & Audit Logs
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Real-time audit log of 5m candle breakouts, broker orders, trailing updates, and risk actions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleManualRefresh}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={handleClearLogs}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-semibold border border-rose-500/30 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800 text-xs">
        {/* Level Filter Tabs */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-slate-400 font-semibold mr-1 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5 text-cyan-400" /> Filter:
          </span>
          {['ALL', 'TRADE_SIGNAL', 'INFO', 'WARN', 'ERROR'].map((lvl) => (
            <button
              key={lvl}
              onClick={() => setSelectedLevel(lvl)}
              className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                selectedLevel === lvl
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700/60'
              }`}
            >
              {lvl === 'TRADE_SIGNAL' ? '⚡ Signals' : lvl}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative min-w-[200px]">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search symbol, source, or text..."
            className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 placeholder-slate-500 text-xs focus:outline-none focus:border-emerald-500"
          />
        </div>
      </div>

      {/* Terminal Display Container */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden font-mono text-xs shadow-2xl">
        <div className="bg-slate-950 px-4 py-3 border-b border-slate-800 flex items-center justify-between text-slate-400">
          <span className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
            Streaming live audit logs ({filteredLogs.length} events)
          </span>
          <span className="text-[11px] text-slate-500">Auto-refresh active ({lastRefreshed})</span>
        </div>

        <div className="divide-y divide-slate-800/80 max-h-[550px] overflow-y-auto">
          {filteredLogs.length === 0 ? (
            <div className="p-12 text-center text-slate-500 font-sans">
              <Terminal className="w-8 h-8 mx-auto mb-2 opacity-40 text-slate-400" />
              <p>No audit logs found for the selected filter.</p>
              <p className="text-xs text-slate-600 mt-1">Logs will appear automatically as trade cycles and broker orders run.</p>
            </div>
          ) : (
            filteredLogs.map((log) => {
              const isTrade = log.level === 'TRADE_SIGNAL';
              const isWarn = log.level === 'WARN' || log.level === 'WARNING';
              const isErr = log.level === 'ERROR';

              const formattedTime = log.timestamp 
                ? new Date(log.timestamp).toLocaleTimeString() 
                : 'Now';

              return (
                <div key={log.id} className="py-2.5 px-4 flex flex-col sm:flex-row sm:items-start gap-3 hover:bg-slate-800/40 transition-colors">
                  <span className="text-slate-500 shrink-0 font-medium">{formattedTime}</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                    isTrade 
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' 
                      : isErr
                      ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                      : isWarn
                      ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                      : 'bg-slate-800 text-slate-300 border border-slate-700/60'
                  }`}>
                    {log.level}
                  </span>
                  <span className="text-cyan-400 shrink-0 font-semibold">{log.source}</span>
                  <span className="text-slate-200 break-words flex-1">{log.message}</span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
