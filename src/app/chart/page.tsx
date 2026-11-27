'use client';

import { LiveChartViewer } from '@/components/LiveChartViewer';
import { BarChart2, ShieldCheck, Zap } from 'lucide-react';
import { useState, useEffect } from 'react';

export default function ChartPage() {
  const [userToken, setUserToken] = useState<string>('');

  useEffect(() => {
    const saved = localStorage.getItem('myalgo_access_token') || 'DEFAULT_TRADER';
    setUserToken(saved.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '_'));
  }, []);

  return (
    <div className="space-y-6 max-w-7xl pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
              <BarChart2 className="w-6 h-6 text-cyan-400" />
              Live Delta Terminal Chart & Bot Vision
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
              REAL-TIME CANDLES & SMC OVERLAY
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Watch exactly what your bot is seeing: Order Blocks (OB), Fair Value Gaps (FVG), PDH/PDL levels, and active live executions.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span className="text-slate-400">Live Session:</span>
            <span className="font-mono font-bold text-cyan-300">{userToken || 'ACTIVE'}</span>
          </div>
        </div>
      </div>

      {/* Main Chart Viewer Component */}
      <LiveChartViewer initialSymbol="BTCUSD" />
    </div>
  );
}
