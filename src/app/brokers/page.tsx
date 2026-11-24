'use client';

import { useState, useEffect } from 'react';
import { 
  Wallet, 
  CheckCircle2, 
  XCircle, 
  RefreshCw, 
  Key, 
  Shield, 
  ExternalLink,
  Zap,
  Check,
  AlertTriangle,
  Send,
  HelpCircle,
  ArrowRightLeft,
  PowerOff
} from 'lucide-react';

interface BrokerConfig {
  id: 'DHAN' | 'DELTA' | 'METATRADER';
  name: string;
  title: string;
  badge: string;
  defaultSymbol: string;
  defaultQty: number;
  docsUrl: string;
  fields: { key: string; label: string; placeholder: string; isSecret?: boolean }[];
  note?: string;
}

export default function BrokersPage() {
  const [testingBroker, setTestingBroker] = useState<string | null>(null);
  const [firingOrder, setFiringOrder] = useState<string | null>(null);
  const [testStatus, setTestStatus] = useState<Record<string, {
    success: boolean;
    message: string;
    balance?: number;
    currency?: string;
    balanceDisplay?: string;
    accountStatus?: string;
  }>>({});
  const [orderStatus, setOrderStatus] = useState<Record<string, { success: boolean; message: string }>>({});

  // Credentials state
  const [credentials, setCredentials] = useState<Record<string, Record<string, string>>>({
    DHAN: { clientId: '', accessToken: '' },
    DELTA: { apiKey: '', apiSecret: '', region: 'INDIA' },
    METATRADER: { bridgeSecret: 'mt5_bridge_secret_key_2026', metaApiToken: '', metaApiAccountId: '' },
  });

  const [isLiveMoney, setIsLiveMoney] = useState(false);

  useEffect(() => {
    try {
      const savedCreds = localStorage.getItem('myalgo_broker_creds');
      if (savedCreds) {
        setCredentials((prev) => ({ ...prev, ...JSON.parse(savedCreds) }));
      }
      const savedStatus = localStorage.getItem('myalgo_broker_status');
      if (savedStatus) {
        setTestStatus(JSON.parse(savedStatus));
      }
    } catch {}
  }, []);

  const brokers: BrokerConfig[] = [
    {
      id: 'DHAN',
      name: 'DhanHQ API (Indian Markets)',
      title: 'NSE / BSE Equity & F&O Execution',
      badge: 'NSE / NIFTY / BANKNIFTY',
      defaultSymbol: 'IDEA',
      defaultQty: 1,
      docsUrl: 'https://dhanhq.co/docs',
      fields: [
        { key: 'clientId', label: 'Dhan Client ID (10 digits)', placeholder: '1000xxxxxx' },
        { key: 'accessToken', label: 'Dhan 24hr Access Token (JWT)', placeholder: 'eyJhbGciOi...', isSecret: true },
      ],
      note: 'Generate a 24-hour Access Token from Dhan Web > My Profile > DhanHQ Trading APIs.',
    },
    {
      id: 'DELTA',
      name: 'Delta Exchange (Crypto Derivatives)',
      title: 'Crypto Futures & Options with HMAC Signing',
      badge: 'BTC / ETH / SOL',
      defaultSymbol: 'BTCUSD',
      defaultQty: 1,
      docsUrl: 'https://docs.delta.exchange',
      fields: [
        { key: 'apiKey', label: 'Delta API Key', placeholder: 'delta_api_key_...' },
        { key: 'apiSecret', label: 'Delta API Secret', placeholder: 'delta_secret_...', isSecret: true },
      ],
      note: 'Important: In Delta Settings > API Keys, make sure Permissions have "Read" and "Trade" checked, and IP restriction includes Render IP or is disabled.',
    },
    {
      id: 'METATRADER',
      name: 'MetaTrader 5 (MT5 Bridge & Cloud)',
      title: 'Direct IPC Execution (<50ms) or Cloud REST API',
      badge: 'EURUSD / XAUUSD / US30',
      defaultSymbol: 'EURUSD',
      defaultQty: 0.01,
      docsUrl: 'https://www.mql5.com/en/docs/python_metatrader5',
      fields: [
        { key: 'bridgeSecret', label: 'Local Bridge Secret Token', placeholder: 'mt5_bridge_secret_key_2026', isSecret: true },
        { key: 'metaApiToken', label: 'MetaApi Cloud Token (Optional for 100% cloud)', placeholder: 'metaapi-token-optional', isSecret: true },
      ],
      note: 'Run "python mt5_bridge/mt5_runner.py" on Windows PC for instant local terminal execution.',
    },
  ];

  const updateCred = (brokerId: string, key: string, value: string) => {
    setCredentials((prev) => {
      const updated = {
        ...prev,
        [brokerId]: { ...prev[brokerId], [key]: value },
      };
      try {
        localStorage.setItem('myalgo_broker_creds', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const testConnection = async (brokerId: string) => {
    setTestingBroker(brokerId);
    try {
      const res = await fetch('/api/brokers/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ broker: brokerId, credentials: credentials[brokerId] }),
      });
      const data = await res.json();
      setTestStatus((prev) => {
        const updated = {
          ...prev,
          [brokerId]: {
            success: data.success,
            message: data.message,
            balance: data.balance,
            currency: data.currency,
            balanceDisplay: data.balanceDisplay,
            accountStatus: data.success ? 'CONNECTED' : 'DISCONNECTED',
          },
        };
        try {
          localStorage.setItem('myalgo_broker_status', JSON.stringify(updated));
        } catch {}
        return updated;
      });
    } catch (err: any) {
      setTestStatus((prev) => ({
        ...prev,
        [brokerId]: { success: false, message: err.message },
      }));
    } finally {
      setTestingBroker(null);
    }
  };

  const handleDisconnectBroker = (brokerId: string) => {
    if (!confirm(`Are you sure you want to disconnect ${brokerId}? This will reveal all brokers so you can choose another.`)) {
      return;
    }

    setTestStatus((prev) => {
      const updated = { ...prev };
      delete updated[brokerId];
      try {
        localStorage.setItem('myalgo_broker_status', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const fireDirectOrder = async (broker: BrokerConfig) => {
    const modeText = isLiveMoney ? 'REAL MONEY' : 'PAPER TRADING';
    if (!confirm(`Confirm placing a ${modeText} BUY order on ${broker.name} for ${broker.defaultQty} ${broker.defaultSymbol}?`)) {
      return;
    }

    setFiringOrder(broker.id);
    try {
      const res = await fetch('/api/orders/direct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          broker: broker.id,
          symbol: broker.defaultSymbol,
          side: 'BUY',
          quantity: broker.defaultQty,
          isPaper: !isLiveMoney,
          credentials: credentials[broker.id],
        }),
      });
      const data = await res.json();
      setOrderStatus((prev) => ({
        ...prev,
        [broker.id]: { success: data.success, message: data.message || (data.success ? 'Order Executed Successfully!' : 'Order Failed') },
      }));
    } catch (err: any) {
      setOrderStatus((prev) => ({
        ...prev,
        [broker.id]: { success: false, message: err.message },
      }));
    } finally {
      setFiringOrder(null);
    }
  };

  // Check if any broker is actively connected
  const connectedBroker = brokers.find((b) => testStatus[b.id]?.success);
  const displayedBrokers = connectedBroker ? [connectedBroker] : brokers;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Wallet className="w-6 h-6 text-emerald-400" />
            Live Broker Integrations
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Connect your primary trading broker. Only one active broker is maintained at a time for focused execution.
          </p>
        </div>

        {/* Live Money vs Paper Toggle */}
        <div className="flex items-center gap-3 bg-slate-900 p-2 rounded-xl border border-slate-800 shrink-0 self-start sm:self-auto">
          <span className="text-xs font-semibold text-slate-300">Mode:</span>
          <button
            onClick={() => setIsLiveMoney(!isLiveMoney)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              isLiveMoney
                ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/30'
                : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
            }`}
          >
            {isLiveMoney ? '🔴 REAL MONEY LIVE' : '🟢 PAPER TRADING'}
          </button>
        </div>
      </div>

      {/* Active Broker Single Notice & Switch Control */}
      {connectedBroker ? (
        <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-900 border border-emerald-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse shrink-0"></span>
            <div>
              <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                Active Connected Broker (1 / 1)
              </p>
              <p className="text-sm font-bold text-white mt-0.5">
                {connectedBroker.name} is connected. Other brokers are hidden to keep execution single-stream.
              </p>
            </div>
          </div>
          <button
            onClick={() => handleDisconnectBroker(connectedBroker.id)}
            className="w-full sm:w-auto px-4 py-2 text-xs font-bold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center justify-center gap-2 transition-all shrink-0"
          >
            <ArrowRightLeft className="w-3.5 h-3.5 text-cyan-400" />
            Switch / Disconnect Broker
          </button>
        </div>
      ) : (
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-400 flex items-center gap-3">
          <HelpCircle className="w-4 h-4 text-cyan-400 shrink-0" />
          <span>
            Select and test one broker below to connect. Once connected, only that broker will be active and the other two will be hidden automatically.
          </span>
        </div>
      )}

      {/* Broker Cards */}
      <div className="space-y-6">
        {displayedBrokers.map((broker) => {
          const status = testStatus[broker.id];
          const orderStat = orderStatus[broker.id];
          const isConnected = !!status?.success;

          return (
            <div key={broker.id} className="p-5 sm:p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base sm:text-lg font-bold text-white">{broker.name}</h2>
                    <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                      {broker.badge}
                    </span>
                    {isConnected ? (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center gap-1.5 shadow-sm shadow-emerald-500/20">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                        CONNECTED (LIVE)
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-800/80 text-slate-400 border border-slate-700/60">
                        NOT CONNECTED
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-1">{broker.title}</p>
                </div>

                <div className="flex items-center gap-3 self-start sm:self-auto">
                  {isConnected && (
                    <button
                      onClick={() => handleDisconnectBroker(broker.id)}
                      className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 font-semibold"
                      title="Disconnect broker"
                    >
                      <PowerOff className="w-3.5 h-3.5" /> Disconnect
                    </button>
                  )}
                  <a
                    href={broker.docsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:underline"
                  >
                    Docs <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>

              {/* Live Connected Wallet Balance Banner */}
              {isConnected && (
                <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-950 border border-emerald-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                      <Wallet className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
                        Live Verified Account Balance
                      </span>
                      <div className="text-xl font-black text-emerald-400 font-mono tracking-tight flex items-center gap-2">
                        <span>{status.balanceDisplay || (status.balance !== undefined ? `${status.balance} ${status.currency || ''}` : '0.00 USDT')}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-3 py-1 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-semibold flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      Live Execution Ready
                    </span>
                  </div>
                </div>
              )}

              {/* Special Region selector for Delta */}
              {broker.id === 'DELTA' && (
                <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <span className="text-slate-300 font-semibold flex items-center gap-1.5">
                    <GlobeIcon className="w-4 h-4 text-cyan-400" /> Account Region:
                  </span>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => updateCred('DELTA', 'region', 'INDIA')}
                      className={`px-3 py-1.5 rounded-lg border font-semibold transition-all ${
                        credentials.DELTA?.region !== 'GLOBAL'
                          ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50'
                          : 'bg-slate-900 text-slate-400 border-slate-800'
                      }`}
                    >
                      Delta India (india.delta.exchange)
                    </button>
                    <button
                      type="button"
                      onClick={() => updateCred('DELTA', 'region', 'GLOBAL')}
                      className={`px-3 py-1.5 rounded-lg border font-semibold transition-all ${
                        credentials.DELTA?.region === 'GLOBAL'
                          ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50'
                          : 'bg-slate-900 text-slate-400 border-slate-800'
                      }`}
                    >
                      Delta Global (delta.exchange)
                    </button>
                  </div>
                </div>
              )}

              {/* Form Input Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                {broker.fields.map((field) => (
                  <div key={field.key} className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-300">{field.label}</label>
                    <input
                      type={field.isSecret ? 'password' : 'text'}
                      value={credentials[broker.id]?.[field.key] || ''}
                      onChange={(e) => updateCred(broker.id, field.key, e.target.value)}
                      placeholder={field.placeholder}
                      className="w-full px-3.5 py-2.5 sm:py-2 text-sm sm:text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500 font-mono"
                    />
                  </div>
                ))}
              </div>

              {/* Helpful Hint */}
              {broker.note && (
                <p className="text-[11px] text-slate-400 flex items-start gap-1.5 bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/60">
                  <HelpCircle className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                  <span>{broker.note}</span>
                </p>
              )}

              {/* Action Buttons & Status */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-800/80">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <button
                    onClick={() => testConnection(broker.id)}
                    disabled={testingBroker === broker.id}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 sm:py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${testingBroker === broker.id ? 'animate-spin' : ''}`} />
                    {testingBroker === broker.id ? 'Testing Auth...' : 'Test Connection'}
                  </button>

                  <button
                    onClick={() => fireDirectOrder(broker)}
                    disabled={firingOrder === broker.id}
                    className={`flex items-center justify-center gap-1.5 px-4 py-2.5 sm:py-2 rounded-lg text-xs font-bold transition-all shadow-md ${
                      isLiveMoney
                        ? 'bg-rose-500 hover:bg-rose-600 text-white'
                        : 'bg-emerald-500 hover:bg-emerald-600 text-slate-950'
                    }`}
                  >
                    <Zap className="w-3.5 h-3.5 fill-current" />
                    {firingOrder === broker.id ? 'Punching...' : `Fire Test Order (${broker.defaultSymbol})`}
                  </button>
                </div>

                <div className="space-y-1 text-left sm:text-right max-w-md">
                  {status && (
                    <div className={`text-xs flex items-start sm:justify-end gap-1.5 ${status.success ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {status.success ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /> : <XCircle className="w-4 h-4 shrink-0 mt-0.5" />}
                      <span>{status.message}</span>
                    </div>
                  )}
                  {orderStat && (
                    <div className={`text-xs font-semibold flex items-center sm:justify-end gap-1.5 ${orderStat.success ? 'text-emerald-300' : 'text-rose-400'}`}>
                      <span>Result: {orderStat.message}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GlobeIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10"/>
      <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/>
      <path d="M2 12h20"/>
    </svg>
  );
}
