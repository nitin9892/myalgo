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
  ShieldCheck,
  ShieldAlert,
  Wallet,
  Clock,
  XOctagon,
  AlertOctagon,
  ArrowRight,
  Send,
  X,
  Check,
  Power,
  Rocket,
  Activity,
  Key,
  Coins
} from 'lucide-react';
import Link from 'next/link';
import { useModal } from '@/context/ModalContext';

function formatDisplayBalance(brokerData: any): string {
  if (!brokerData) return 'Connected (Live)';
  const raw = brokerData.balanceDisplay || '';
  if (!raw) {
    if (brokerData.balance !== undefined) {
      return `₹${Number(brokerData.balance).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${brokerData.currency || 'INR'}`;
    }
    return 'Connected (Live)';
  }
  // Convert any existing REF_USD or USD display into INR (Delta India fixed conversion: 1 REF_USD = ₹85)
  if (raw.toUpperCase().includes('REF') || (raw.toUpperCase().includes('USD') && !raw.toUpperCase().includes('INR'))) {
    const match = raw.match(/[\d,.]+/);
    if (match) {
      const num = parseFloat(match[0].replace(/,/g, ''));
      if (!isNaN(num)) {
        const inrVal = num * 85;
        return `₹${inrVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} INR`;
      }
    }
  }
  return raw;
}

export default function DashboardPage() {
  const { showConfirm, showAlert } = useModal();
  const [isRunningCycle, setIsRunningCycle] = useState(false);
  const [cycleResult, setCycleResult] = useState<any>(null);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [squaringOffId, setSquaringOffId] = useState<string | null>(null);

  // Live Stats State (100% Real from Supabase & Broker)
  const [stats, setStats] = useState({
    todayPnl: 0,
    winRate: 0,
    totalClosedToday: 0,
    openCount: 0,
  });

  const [activeStrategyInfo, setActiveStrategyInfo] = useState<{ name: string; symbols: string[] }>({
    name: 'Strategy C',
    symbols: ['BTC', 'ETH', 'SOL', 'XRP'],
  });

  const [activePositions, setActivePositions] = useState<any[]>([]);
  const [recentTrades, setRecentTrades] = useState<any[]>([]);
  const [killSwitchActive, setKillSwitchActive] = useState(false);
  const [killSwitchReason, setKillSwitchReason] = useState<string | null>(null);
  const [connectedBrokers, setConnectedBrokers] = useState<Record<string, any>>({});
  const [isSyncingBalance, setIsSyncingBalance] = useState(false);
  const [lastBalanceSyncTime, setLastBalanceSyncTime] = useState<string>('');

  // Master Algo ON / OFF Switch State
  const [algoActive, setAlgoActive] = useState<boolean>(true);
  const [isTogglingAlgo, setIsTogglingAlgo] = useState(false);

  // 4-Step Launch & Workflow Wizard State
  const [selectedBroker, setSelectedBroker] = useState<'DELTA' | 'DHAN' | 'METATRADER'>('DELTA');
  const [selectedStrategy, setSelectedStrategy] = useState<'Strategy B' | 'Strategy C' | 'Strategy A'>('Strategy B');
  const [selectedSymbols, setSelectedSymbols] = useState<string[]>(['BTC', 'ETH', 'SOL', 'XRP']);
  const [allocatedCapital, setAllocatedCapital] = useState<number>(100000);
  const [riskPerTrade, setRiskPerTrade] = useState<number>(2);
  const [selectedLeverage, setSelectedLeverage] = useState<number>(10);
  const [maxTradesDay, setMaxTradesDay] = useState<number>(3);
  const [maxDrawdownPct, setMaxDrawdownPct] = useState<number>(5);
  const [isLaunchingAlgo, setIsLaunchingAlgo] = useState(false);
  const [showQuickConnectBroker, setShowQuickConnectBroker] = useState(false);

  // Quick credentials input for modal
  const [quickCreds, setQuickCreds] = useState<Record<string, string>>({
    clientId: '',
    accessToken: '',
    apiKey: '',
    apiSecret: '',
  });
  const [connectingBroker, setConnectingBroker] = useState(false);

  // Live real-time balance auto-sync from broker API
  const syncLiveBrokerBalance = async () => {
    try {
      const savedCreds = localStorage.getItem('myalgo_broker_creds');
      const savedStatus = localStorage.getItem('myalgo_broker_status');
      if (!savedCreds || !savedStatus) return;

      const creds = JSON.parse(savedCreds);
      const statusObj = JSON.parse(savedStatus);

      // Find active/connected broker
      const activeEntry = Object.entries(statusObj).find(([_, stat]: [string, any]) => stat?.success);
      if (!activeEntry) return;

      const [activeBroker] = activeEntry;
      const brokerCreds = creds[activeBroker];
      if (!brokerCreds) return;

      setIsSyncingBalance(true);
      const res = await fetch('/api/brokers/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ broker: activeBroker, credentials: brokerCreds }),
      });

      const data = await res.json();
      if (data.success) {
        const updatedStatus = {
          ...statusObj,
          [activeBroker]: {
            ...statusObj[activeBroker],
            success: true,
            balance: data.balance,
            currency: data.currency,
            balanceDisplay: data.balanceDisplay,
            accountStatus: 'CONNECTED',
            lastSynced: data.syncedAt,
          },
        };
        localStorage.setItem('myalgo_broker_status', JSON.stringify(updatedStatus));
        setConnectedBrokers(updatedStatus);
        setLastBalanceSyncTime(new Date().toLocaleTimeString());
      }
    } catch (e) {
      console.warn('Auto balance sync error:', e);
    } finally {
      setIsSyncingBalance(false);
    }
  };

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

      // 2. Fetch live trades & stats from database
      const tradesRes = await fetch('/api/trades');
      const tradesData = await tradesRes.json();
      if (tradesData.success) {
        setActivePositions(tradesData.openPositions || []);
        setRecentTrades(tradesData.recentTrades || []);
        if (tradesData.stats) {
          setStats({
            todayPnl: tradesData.stats.todayPnl,
            winRate: tradesData.stats.winRate,
            totalClosedToday: tradesData.stats.totalClosedToday,
            openCount: tradesData.stats.openCount,
          });
        }
      }

      // 3. Fetch active strategy info & master algo switch state
      const stratRes = await fetch('/api/strategies');
      const stratData = await stratRes.json();
      if (stratData.success && stratData.strategy) {
        const s = stratData.strategy;
        if (s.is_active !== undefined) {
          setAlgoActive(Boolean(s.is_active));
        }
        const syms = s.parameters?.symbols 
          ? s.parameters.symbols.map((x: string) => x.replace('USD', '')) 
          : (s.symbol ? s.symbol.split(',').map((x: string) => x.trim().replace('USD', '')) : ['BTC', 'ETH', 'SOL', 'XRP']);
        setActiveStrategyInfo({
          name: s.name || 'Strategy C',
          symbols: syms,
        });
      }

      // 4. Fetch risk & kill switch status from API
      const riskRes = await fetch('/api/risk');
      const riskData = await riskRes.json();
      if (riskData) {
        const isServerActive = !!(riskData.isKillSwitchActive || riskData.config?.killSwitchActive);
        if (isServerActive) {
          setKillSwitchActive(true);
          setKillSwitchReason(riskData.killSwitchReason || 'Emergency Kill Switch engaged');
        } else {
          // If server disarmed kill switch (e.g. 01:00 AM IST cycle reset), clear local daily-loss flag
          if (localKill) {
            try {
              const parsed = JSON.parse(localKill);
              if (parsed.reason?.toLowerCase().includes('daily loss')) {
                localStorage.removeItem('myalgo_kill_switch');
              }
            } catch {}
          }
          const freshLocal = localStorage.getItem('myalgo_kill_switch');
          if (!freshLocal) {
            setKillSwitchActive(false);
            setKillSwitchReason(null);
          }
        }
      }

      // 5. Read connected brokers from localStorage
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
    syncLiveBrokerBalance();

    const interval = setInterval(fetchDashboardData, 4000);
    // Background live broker balance auto-sync every 12 seconds
    const balanceInterval = setInterval(syncLiveBrokerBalance, 12000);

    return () => {
      clearInterval(interval);
      clearInterval(balanceInterval);
    };
  }, []);

  // Trigger one trade cycle manually
  const triggerCycleNow = async () => {
    setIsRunningCycle(true);
    try {
      const res = await fetch('/api/cron/trade-cycle');
      const data = await res.json();
      setCycleResult(data);
      await fetchDashboardData();
      await syncLiveBrokerBalance();
    } catch (err: any) {
      setCycleResult({ error: err.message });
    } finally {
      setIsRunningCycle(false);
    }
  };

  // Master Algo ON / OFF Switch Handler
  const handleToggleAlgoSwitch = async () => {
    const nextState = !algoActive;
    setIsTogglingAlgo(true);
    try {
      const res = await fetch('/api/strategies', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: nextState }),
      });
      const data = await res.json();
      if (data.success) {
        setAlgoActive(data.is_active);
      }
      await fetchDashboardData();
    } catch (err) {
      console.error('Failed to toggle master algo switch:', err);
    } finally {
      setIsTogglingAlgo(false);
    }
  };

  // Emergency Kill Switch trigger from Dashboard
  const handleTriggerKillSwitch = async () => {
    const confirmed = await showConfirm({
      title: 'EMERGENCY KILL SWITCH',
      message: 'Immediately close all open trades, square off all positions across all brokers, and freeze trading engine?',
      type: 'danger',
      confirmText: 'TRIGGER KILL SWITCH',
    });
    if (!confirmed) return;

    const reason = 'Manual emergency kill switch triggered from Dashboard';
    try {
      localStorage.setItem('myalgo_kill_switch', JSON.stringify({ active: true, reason, timestamp: Date.now() }));
    } catch {}
    setKillSwitchActive(true);
    setKillSwitchReason(reason);
    try {
      await fetch('/api/risk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ triggerEmergencyKill: true }),
      });
      await showAlert({
        title: 'Kill Switch Activated',
        message: 'All positions squared off & trading halted immediately.',
        type: 'danger',
      });
      await fetchDashboardData();
    } catch {}
  };

  // Emergency Kill Switch reset from Dashboard
  const handleResetKillSwitch = async () => {
    const confirmed = await showConfirm({
      title: 'Disarm Kill Switch',
      message: 'Are you sure you want to disarm the Kill Switch and resume normal trading?',
      type: 'warning',
      confirmText: 'Disarm Kill Switch',
    });
    if (!confirmed) return;

    try {
      localStorage.removeItem('myalgo_kill_switch');
    } catch {}
    setKillSwitchActive(false);
    setKillSwitchReason(null);
    try {
      await fetch('/api/risk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resetKillSwitch: true }),
      });
      await showAlert({
        title: 'Kill Switch Disarmed',
        message: 'Normal algorithmic trading has been resumed.',
        type: 'success',
      });
      await fetchDashboardData();
    } catch {}
  };

  // Emergency Square Off single position
  const handleSquareOff = async (pos: any) => {
    const confirmed = await showConfirm({
      title: 'Confirm Square Off',
      message: `Are you sure you want to Square Off position ${pos.side} ${pos.quantity} ${pos.symbol}?`,
      type: 'danger',
      confirmText: 'Square Off Position',
    });
    if (!confirmed) return;

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
      await showAlert({
        title: data.success ? 'Position Squared Off' : 'Notice',
        message: data.message || 'Position squared off!',
        type: data.success ? 'success' : 'warning',
      });
      await fetchDashboardData();
      await syncLiveBrokerBalance();
    } catch (err: any) {
      await showAlert({
        title: 'Square-off Failed',
        message: `Square-off failed: ${err.message}`,
        type: 'danger',
      });
    } finally {
      setSquaringOffId(null);
    }
  };

  // Find active single broker
  const connectedEntry = Object.entries(connectedBrokers).find(([_, stat]) => stat?.success);
  const activeBrokerId = connectedEntry ? connectedEntry[0] : null;
  const activeBrokerData = connectedEntry ? connectedEntry[1] : null;

  const handleLaunchAlgo = async () => {
    const savedStatus = localStorage.getItem('myalgo_broker_status');
    const statusObj = savedStatus ? JSON.parse(savedStatus) : {};
    const isConnected = !!statusObj[selectedBroker]?.success;

    if (!isConnected) {
      const confirmOpen = await showConfirm({
        title: `${selectedBroker} Broker Not Connected`,
        message: `${selectedBroker} credentials need to be verified before running live trades. Would you like to enter credentials and connect now?`,
        type: 'warning',
        confirmText: 'Connect Now',
      });
      if (confirmOpen) {
        setShowQuickConnectBroker(true);
      }
      return;
    }

    setIsLaunchingAlgo(true);
    try {
      await fetch('/api/risk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          maxDailyLossPct: maxDrawdownPct,
          perTradeRiskPct: riskPerTrade,
          maxOpenTrades: maxTradesDay,
          leverage: selectedLeverage,
          autoSyncWallet: true,
        }),
      });

      await fetch('/api/strategies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: selectedStrategy,
          broker_name: selectedBroker,
          symbols: selectedSymbols.map((s) => (selectedBroker === 'DELTA' ? `${s}USD` : s)),
          risk_reward_ratio: selectedStrategy === 'Strategy B' ? 4 : 3,
          max_trades_per_day: maxTradesDay,
          is_active: true,
        }),
      });

      setAlgoActive(true);
      await triggerCycleNow();

      await showAlert({
        title: 'Algo Successfully Launched! 🚀',
        message: `Algo engine is now LIVE and actively scanning ${selectedSymbols.join(', ')} with ${selectedStrategy} on ${selectedBroker}.\nRisk: ${riskPerTrade}% per trade • Leverage: ${selectedLeverage}x • Max Trades: ${maxTradesDay}/day.`,
        type: 'success',
      });
    } catch (err: any) {
      await showAlert({ title: 'Launch Failed', message: err.message, type: 'danger' });
    } finally {
      setIsLaunchingAlgo(false);
    }
  };

  const handleQuickConnect = async () => {
    setConnectingBroker(true);
    try {
      const credsToSend = selectedBroker === 'DHAN'
        ? { clientId: quickCreds.clientId, accessToken: quickCreds.accessToken }
        : { apiKey: quickCreds.apiKey, apiSecret: quickCreds.apiSecret, region: 'INDIA' };

      const res = await fetch('/api/brokers/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ broker: selectedBroker, credentials: credsToSend }),
      });
      const data = await res.json();
      if (data.success) {
        const savedCreds = localStorage.getItem('myalgo_broker_creds');
        const credsObj = savedCreds ? JSON.parse(savedCreds) : {};
        credsObj[selectedBroker] = credsToSend;
        localStorage.setItem('myalgo_broker_creds', JSON.stringify(credsObj));

        const savedStatus = localStorage.getItem('myalgo_broker_status');
        const statusObj = savedStatus ? JSON.parse(savedStatus) : {};
        statusObj[selectedBroker] = {
          success: true,
          balance: data.balance,
          currency: data.currency,
          balanceDisplay: data.balanceDisplay,
          accountStatus: 'CONNECTED',
          lastSynced: data.syncedAt,
        };
        localStorage.setItem('myalgo_broker_status', JSON.stringify(statusObj));
        setConnectedBrokers(statusObj);
        setShowQuickConnectBroker(false);

        await showAlert({
          title: `${selectedBroker} Connected!`,
          message: data.message || `Successfully connected to ${selectedBroker}! Available margin: ${data.balanceDisplay || data.balance}`,
          type: 'success',
        });
      } else {
        await showAlert({
          title: 'Connection Failed',
          message: data.message || 'Could not authenticate with broker. Check credentials.',
          type: 'danger',
        });
      }
    } catch (err: any) {
      await showAlert({ title: 'Error', message: err.message, type: 'danger' });
    } finally {
      setConnectingBroker(false);
    }
  };

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
              Live Real Metrics
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Real-time execution dashboard for {activeStrategyInfo.name} on [{activeStrategyInfo.symbols.join(', ')}] • Daily cycle resets at 01:00 AM IST.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
          {/* Master Algo ON/OFF Switch */}
          <button
            onClick={handleToggleAlgoSwitch}
            disabled={isTogglingAlgo}
            className={`flex items-center justify-between sm:justify-center gap-2.5 px-4 py-2.5 rounded-xl border text-xs font-black transition-all shadow-md active:scale-95 disabled:opacity-50 ${
              algoActive
                ? 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border-emerald-500/40 shadow-emerald-500/10'
                : 'bg-slate-800/90 hover:bg-slate-800 text-slate-400 border-slate-700'
            }`}
            title={algoActive ? 'Click to Pause Algo (Master Switch)' : 'Click to Turn Algo ON (Master Switch)'}
          >
            <div className={`w-8 h-4.5 rounded-full transition-colors relative flex items-center p-0.5 ${
              algoActive ? 'bg-emerald-500' : 'bg-slate-600'
            }`}>
              <div className={`w-3.5 h-3.5 rounded-full bg-white transition-transform ${
                algoActive ? 'translate-x-3.5' : 'translate-x-0'
              }`} />
            </div>
            <span className="flex items-center gap-1.5">
              {algoActive ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span>ALGO ON</span>
                </>
              ) : (
                <>
                  <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                  <span className="text-amber-400">ALGO PAUSED</span>
                </>
              )}
            </span>
          </button>

          {/* Direct Kill Switch Button in Header */}
          <button
            onClick={killSwitchActive ? handleResetKillSwitch : handleTriggerKillSwitch}
            className={`flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
              killSwitchActive
                ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/30 animate-pulse'
                : 'bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 border border-rose-500/30'
            }`}
          >
            <AlertOctagon className="w-4 h-4" />
            {killSwitchActive ? 'Disarm Kill Switch' : 'Kill Switch'}
          </button>

          <div className="text-[11px] text-slate-500 flex items-center justify-center gap-1">
            <RefreshCw className="w-3 h-3" /> Sync {lastUpdated || 'Live'}
          </div>
        </div>
      </div>

      {/* Connected Broker Live Ribbon */}
      <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs shadow-md">
        <div className="flex items-center gap-2 flex-wrap">
          <Wallet className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="font-semibold text-slate-300">Active Broker:</span>
          {activeBrokerId ? (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 font-bold flex items-center gap-1.5 shadow-sm shadow-emerald-500/20">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                {activeBrokerId}: {formatDisplayBalance(activeBrokerData)}
              </span>
              <button
                onClick={syncLiveBrokerBalance}
                disabled={isSyncingBalance}
                title="Auto-syncs real live balance from broker every 12s. Click to sync now."
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700/80 text-slate-300 hover:text-emerald-400 text-[11px] font-semibold border border-slate-700 transition-all active:scale-95 disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${isSyncingBalance ? 'animate-spin text-emerald-400' : 'text-slate-400'}`} />
                <span>{isSyncingBalance ? 'Syncing...' : 'Auto-Sync'}</span>
                {lastBalanceSyncTime && !isSyncingBalance && (
                  <span className="text-[10px] text-slate-500 font-mono hidden md:inline">({lastBalanceSyncTime})</span>
                )}
              </button>
            </div>
          ) : (
            <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 border border-slate-700 font-medium">
              No Broker Connected
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Link 
            href="/brokers" 
            className="text-cyan-400 hover:underline font-semibold flex items-center gap-1 text-xs"
          >
            {activeBrokerId ? 'Manage / Switch' : 'Connect Broker'} &rarr;
          </Link>
        </div>
      </div>

      {/* 🚀 4-STEP ALGO LAUNCH & CONTROL STATION (SaaS / Client Rental Workflow) */}
      <div className="p-5 sm:p-6 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-2xl backdrop-blur-xl relative overflow-hidden space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800/80">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-500 to-emerald-400 flex items-center justify-center text-slate-950 font-black shadow-md shadow-emerald-500/20">
                <Rocket className="w-4 h-4" />
              </div>
              <h2 className="text-lg font-bold text-white tracking-wide">
                Algo Setup & Launch Station
              </h2>
              {algoActive ? (
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[10px] font-black flex items-center gap-1.5 animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  LIVE RUNNING
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[10px] font-bold">
                  READY TO LAUNCH
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Select Broker &rarr; Choose Strategy &rarr; Set Risk Rules &rarr; Hit Launch to start live autonomous algorithmic execution.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {algoActive && (
              <button
                type="button"
                onClick={triggerCycleNow}
                disabled={isRunningCycle}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold border border-slate-700 transition-all active:scale-95 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRunningCycle ? 'animate-spin text-emerald-400' : ''}`} />
                <span>{isRunningCycle ? 'Scanning...' : 'Scan Market Now'}</span>
              </button>
            )}
          </div>
        </div>

        {/* 3 Step Setup Columns */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* STEP 1: Select Broker */}
          <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800/90 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-cyan-500 text-slate-950 text-[10px] flex items-center justify-center font-bold">1</span>
                Select Broker
              </span>
              {connectedBrokers[selectedBroker]?.success ? (
                <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Live Connected
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowQuickConnectBroker(true)}
                  className="text-[10px] text-cyan-400 hover:underline font-bold"
                >
                  + Connect Keys
                </button>
              )}
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              {[
                { id: 'DELTA', name: 'Delta India', tag: 'Crypto' },
                { id: 'DHAN', name: 'DhanHQ', tag: 'NSE / F&O' },
                { id: 'METATRADER', name: 'MetaTrader', tag: 'Forex' },
              ].map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => {
                    setSelectedBroker(b.id as any);
                    if (b.id === 'DHAN') {
                      setSelectedSymbols(['NIFTY', 'BANKNIFTY', 'RELIANCE', 'TATAMOTORS']);
                    } else if (b.id === 'DELTA') {
                      setSelectedSymbols(['BTC', 'ETH', 'SOL', 'XRP']);
                    } else {
                      setSelectedSymbols(['EURUSD', 'XAUUSD', 'US30']);
                    }
                  }}
                  className={`p-2.5 rounded-xl text-center border transition-all ${
                    selectedBroker === b.id
                      ? 'bg-cyan-500/15 border-cyan-500/50 text-cyan-300 font-bold shadow-md shadow-cyan-500/10'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <div className="text-xs font-bold truncate">{b.name}</div>
                  <div className="text-[9px] text-slate-500 uppercase mt-0.5">{b.tag}</div>
                </button>
              ))}
            </div>

            {/* Quick Balance indicator for selected broker */}
            <div className="pt-2 border-t border-slate-900 flex items-center justify-between text-xs">
              <span className="text-slate-500 text-[11px]">Live Margin:</span>
              <span className="font-mono font-bold text-slate-200">
                {connectedBrokers[selectedBroker]?.success
                  ? (connectedBrokers[selectedBroker]?.balanceDisplay || `₹${connectedBrokers[selectedBroker]?.balance} INR`)
                  : (
                    <button
                      type="button"
                      onClick={() => setShowQuickConnectBroker(true)}
                      className="text-amber-400 font-sans text-[11px] hover:underline"
                    >
                      Connect {selectedBroker} &rarr;
                    </button>
                  )}
              </span>
            </div>
          </div>

          {/* STEP 2: Select Strategy */}
          <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800/90 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-emerald-500 text-slate-950 text-[10px] flex items-center justify-center font-bold">2</span>
                Select Strategy
              </span>
              <span className="text-[10px] text-emerald-400 font-mono font-bold">
                {selectedStrategy === 'Strategy B' ? '1:4 RR' : '1:3 RR'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              {[
                { id: 'Strategy B', name: 'Strategy B: Phantom AI', desc: 'SMC + ICT Scalper (1:4 RR)' },
                { id: 'Strategy C', name: 'Strategy C: 6 Setups', desc: 'PDH / PDL Breakouts (1:3 RR)' },
              ].map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSelectedStrategy(s.id as any)}
                  className={`p-2.5 rounded-xl text-left border transition-all ${
                    selectedStrategy === s.id
                      ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-300 font-bold shadow-md shadow-emerald-500/10'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <div className="text-xs font-bold truncate">{s.name}</div>
                  <div className="text-[9px] text-slate-500 mt-0.5 truncate">{s.desc}</div>
                </button>
              ))}
            </div>

            {/* Symbols toggle */}
            <div className="pt-2 border-t border-slate-900 space-y-1">
              <span className="text-slate-500 text-[10px] block">Trading Pairs / Instruments:</span>
              <div className="flex items-center gap-1.5 flex-wrap">
                {(selectedBroker === 'DHAN'
                  ? ['NIFTY', 'BANKNIFTY', 'RELIANCE', 'HDFCBANK', 'TATAMOTORS', 'INFY']
                  : selectedBroker === 'DELTA'
                  ? ['BTC', 'ETH', 'SOL', 'XRP']
                  : ['EURUSD', 'XAUUSD', 'US30']
                ).map((sym) => {
                  const isSelected = selectedSymbols.includes(sym);
                  return (
                    <button
                      key={sym}
                      type="button"
                      onClick={() => {
                        if (isSelected && selectedSymbols.length > 1) {
                          setSelectedSymbols(selectedSymbols.filter((x) => x !== sym));
                        } else if (!isSelected) {
                          setSelectedSymbols([...selectedSymbols, sym]);
                        }
                      }}
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold transition-all ${
                        isSelected
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                          : 'bg-slate-900 text-slate-500 border border-slate-800 hover:text-slate-300'
                      }`}
                    >
                      {sym}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* STEP 3: Risk Parameters */}
          <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800/90 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-amber-500 text-slate-950 text-[10px] flex items-center justify-center font-bold">3</span>
                Risk & Position Sizing
              </span>
              <span className="text-[10px] text-slate-400">Institutional Circuit</span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <label className="text-[10px] text-slate-500 block mb-1">Risk / Trade</label>
                <select
                  value={riskPerTrade}
                  onChange={(e) => setRiskPerTrade(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-white font-mono text-xs font-bold outline-none"
                >
                  <option value={1}>1.0%</option>
                  <option value={2}>2.0% (Rec)</option>
                  <option value={3}>3.0%</option>
                  <option value={5}>5.0%</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] text-slate-500 block mb-1">Max Trades</label>
                <select
                  value={maxTradesDay}
                  onChange={(e) => setMaxTradesDay(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-white font-mono text-xs font-bold outline-none"
                >
                  <option value={1}>1 Trade</option>
                  <option value={2}>2 Trades</option>
                  <option value={3}>3 Trades (Rec)</option>
                  <option value={5}>5 Trades</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] text-slate-500 block mb-1">Leverage</label>
                <select
                  value={selectedLeverage}
                  onChange={(e) => setSelectedLeverage(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-white font-mono text-xs font-bold outline-none"
                >
                  <option value={5}>5x</option>
                  <option value={10}>10x</option>
                  <option value={20}>20x</option>
                </select>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-900 flex items-center justify-between text-xs">
              <span className="text-slate-500 text-[11px]">Daily Drawdown Freeze:</span>
              <span className="font-mono font-bold text-rose-400">-{maxDrawdownPct}% Hard Stop</span>
            </div>
          </div>
        </div>

        {/* STEP 4: BIG PRO LAUNCH BUTTON OR LIVE ACTIVE RADAR */}
        <div className="pt-1">
          {algoActive ? (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/70 via-slate-900 to-cyan-950/70 border border-emerald-500/40 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center text-emerald-400 shrink-0">
                  <Activity className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black text-white tracking-wide flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping shrink-0" />
                      ALGO IS LIVE & AUTONOMOUSLY TRADING
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Scanning {selectedSymbols.join(', ')} with {selectedStrategy} on {selectedBroker} ({riskPerTrade}% risk • Max {maxTradesDay} trades/day).
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                <button
                  type="button"
                  onClick={handleToggleAlgoSwitch}
                  disabled={isTogglingAlgo}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-xs border border-amber-500/30 transition-all active:scale-95 flex items-center gap-1.5"
                >
                  <Power className="w-4 h-4" /> Pause Algo
                </button>

                <button
                  type="button"
                  onClick={handleTriggerKillSwitch}
                  className="px-4 py-2.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 font-bold text-xs border border-rose-500/40 transition-all active:scale-95 flex items-center gap-1.5"
                >
                  <AlertOctagon className="w-4 h-4" /> Kill Switch
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleLaunchAlgo}
              disabled={isLaunchingAlgo}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500 hover:from-emerald-400 hover:via-teal-300 hover:to-cyan-400 text-slate-950 font-black text-sm sm:text-base tracking-wide transition-all shadow-xl shadow-emerald-500/25 active:scale-[0.99] flex items-center justify-center gap-3 disabled:opacity-50"
            >
              <Rocket className={`w-5 h-5 ${isLaunchingAlgo ? 'animate-bounce' : ''}`} />
              <span>
                {isLaunchingAlgo ? 'LAUNCHING LIVE ALGO ENGINE...' : '🚀 LAUNCH LIVE ALGO ENGINE (Start Auto-Trading)'}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Quick Connect Broker Modal */}
      {showQuickConnectBroker && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Key className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base font-bold text-white">Connect {selectedBroker} Credentials</h3>
              </div>
              <button
                onClick={() => setShowQuickConnectBroker(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              {selectedBroker === 'DHAN' ? (
                <>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-300">Dhan Client ID (10 Digits)</label>
                    <input
                      type="text"
                      value={quickCreds.clientId}
                      onChange={(e) => setQuickCreds({ ...quickCreds, clientId: e.target.value })}
                      placeholder="e.g. 1000123456"
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono text-xs focus:border-cyan-500 outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-300">24-Hour Access Token (JWT)</label>
                    <input
                      type="password"
                      value={quickCreds.accessToken}
                      onChange={(e) => setQuickCreds({ ...quickCreds, accessToken: e.target.value })}
                      placeholder="eyJhbGciOi..."
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono text-xs focus:border-cyan-500 outline-none"
                    />
                    <p className="text-[10px] text-slate-500">
                      Generated from Dhan Web &gt; My Profile &gt; DhanHQ Trading APIs.
                    </p>
                  </div>
                </>
              ) : selectedBroker === 'DELTA' ? (
                <>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-300">Delta API Key</label>
                    <input
                      type="text"
                      value={quickCreds.apiKey}
                      onChange={(e) => setQuickCreds({ ...quickCreds, apiKey: e.target.value })}
                      placeholder="delta_api_key_..."
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono text-xs focus:border-cyan-500 outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-300">Delta API Secret</label>
                    <input
                      type="password"
                      value={quickCreds.apiSecret}
                      onChange={(e) => setQuickCreds({ ...quickCreds, apiSecret: e.target.value })}
                      placeholder="delta_secret_..."
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono text-xs focus:border-cyan-500 outline-none"
                    />
                  </div>
                </>
              ) : (
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">MT5 Bridge Secret</label>
                  <input
                    type="password"
                    defaultValue="mt5_bridge_secret_key_2026"
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono text-xs focus:border-cyan-500 outline-none"
                  />
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={handleQuickConnect}
                disabled={connectingBroker}
                className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs transition-all shadow-md active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {connectingBroker ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Verifying...
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" /> Verify & Connect Live
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => setShowQuickConnectBroker(false)}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Kill Switch Triggered Alert Banner (Direct Disarm on Dashboard) */}
      {killSwitchActive && (
        <div className="p-4 rounded-xl bg-gradient-to-r from-rose-950/90 via-slate-950 to-rose-950/90 border border-rose-500/60 text-rose-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg shadow-rose-950/50">
          <div className="flex items-start sm:items-center gap-3">
            <XOctagon className="w-6 h-6 text-rose-400 shrink-0 animate-bounce mt-0.5 sm:mt-0" />
            <div>
              <p className="font-black text-sm text-white tracking-wide">🚨 EMERGENCY KILL SWITCH ENGAGED</p>
              <p className="text-xs text-rose-300 mt-0.5">{killSwitchReason || 'Circuit breaker active. All orders blocked and trading frozen.'}</p>
            </div>
          </div>
          <button
            onClick={handleResetKillSwitch}
            className="w-full sm:w-auto text-center px-4 py-2 rounded-lg bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs transition-colors shadow shrink-0"
          >
            Disarm Kill Switch
          </button>
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

      {/* 4 Metric Cards - 100% Real Live Verified Data */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
        {/* Card 1: Today Realized P&L in USDT */}
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
              {stats.todayPnl >= 0 ? '+' : ''}{stats.todayPnl.toFixed(2)} USDT
            </span>
          </div>
          <p className="text-[10px] sm:text-xs text-slate-400 mt-1.5 flex items-center gap-1">
            <span>{stats.totalClosedToday} closed trades</span>
            <span className="text-slate-500">•</span>
            <span className="text-emerald-400/90 font-medium">01:00 AM IST Reset</span>
          </p>
        </div>

        {/* Card 2: Active Strategy & Scanning Coins */}
        <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/80 border border-slate-800/80 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-[11px] sm:text-xs font-medium">
            <span>Active Strategy</span>
            <Zap className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xs sm:text-base font-bold text-white font-mono flex items-center gap-1.5 truncate">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0"></span>
              {activeStrategyInfo.name}
            </span>
          </div>
          <Link href="/strategies" className="text-[10px] text-cyan-400 hover:underline mt-1.5 inline-block font-semibold truncate max-w-full">
            Scanning: {activeStrategyInfo.symbols.join(', ')} &rarr;
          </Link>
          <p className="text-[10px] text-emerald-400/90 font-medium mt-0.5 truncate">
            {activeStrategyInfo.name === 'Strategy B'
              ? '⚡ Phantom AI (SMC + ICT Scalper: BOS • OB • FVG) • 1:4 RR'
              : '🔥 6 Setups Engine (PDH • PDL • PDC) • 1:3 RR'}
          </p>
        </div>

        {/* Card 3: Win Rate (Real calculation) */}
        <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/80 border border-slate-800/80 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-[11px] sm:text-xs font-medium">
            <span>Win Rate</span>
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-lg sm:text-2xl font-bold text-white font-mono">
              {stats.totalClosedToday > 0 ? `${stats.winRate}%` : '0%'}
            </span>
          </div>
          <p className="text-[10px] sm:text-xs text-slate-400 mt-1.5 flex items-center gap-1">
            <span>{stats.totalClosedToday} trades</span>
            <span className="text-slate-500">•</span>
            <span className="text-slate-400">01:00 AM IST cycle</span>
          </p>
        </div>

        {/* Card 4: Emergency Kill Switch (Direct Control Shifted Here) */}
        <div className={`p-4 sm:p-5 rounded-2xl border shadow-sm transition-all flex flex-col justify-between ${
          killSwitchActive
            ? 'bg-rose-950/80 border-rose-500 shadow-rose-950/40'
            : 'bg-slate-900/80 border-slate-800/80'
        }`}>
          <div>
            <div className="flex items-center justify-between text-slate-400 text-[11px] sm:text-xs font-medium">
              <span>Kill Switch</span>
              <AlertOctagon className={`w-3.5 h-3.5 ${killSwitchActive ? 'text-rose-400 animate-bounce' : 'text-emerald-400'}`} />
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className={`text-xs sm:text-base font-bold font-mono ${killSwitchActive ? 'text-rose-400' : 'text-emerald-400'}`}>
                {killSwitchActive ? 'TRIPPED (HALT)' : 'ARMED & SAFE'}
              </span>
            </div>
          </div>
          <button
            onClick={killSwitchActive ? handleResetKillSwitch : handleTriggerKillSwitch}
            className={`mt-2 w-full py-1.5 rounded-lg text-[10px] font-bold transition-all text-center ${
              killSwitchActive
                ? 'bg-rose-500 hover:bg-rose-600 text-white shadow'
                : 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30'
            }`}
          >
            {killSwitchActive ? 'Disarm Kill Switch' : '🚨 Trip Kill Switch'}
          </button>
        </div>
      </div>

      {/* Active Live Positions (Real Supabase Rows) */}
      <div className="p-4 sm:p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 mb-4">
          <h2 className="text-base sm:text-lg font-semibold text-white flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
            Open Positions ({activePositions.length})
          </h2>
          <span className="text-xs text-slate-400">Real-time live positions</span>
        </div>

        {activePositions.length === 0 ? (
          <div className="py-10 text-center text-slate-500 text-xs font-sans">
            <Zap className="w-8 h-8 mx-auto mb-2 opacity-30 text-emerald-400" />
            <p className="text-sm font-semibold text-slate-400">No open positions right now.</p>
            <p className="mt-1 text-slate-500">Scanning {activeStrategyInfo.symbols.join(', ')} for breakout signals.</p>
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
                          {isProfitable ? '+' : ''}{pnl.toFixed(2)} USDT
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
                        <td className="py-3.5 px-4 font-sans font-semibold text-white">
                          {pos.symbol}
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
                          {isProfitable ? '+' : ''}{pnl.toFixed(2)} USDT
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

      {/* Recent Completed Trades (Real Supabase Rows) */}
      <div className="p-4 sm:p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl">
        <h2 className="text-base sm:text-lg font-semibold text-white mb-4">Recent Executed Trades</h2>

        {recentTrades.length === 0 ? (
          <div className="py-8 text-center text-slate-500 text-xs font-sans">
            No recent closed trades yet today. Real closed trades will display here automatically.
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
                      {Number(tr.pnl || 0) >= 0 ? `+${tr.pnl}` : tr.pnl} USDT
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
                        {Number(tr.pnl || 0) >= 0 ? `+${tr.pnl}` : tr.pnl} USDT
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
