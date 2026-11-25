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
  PowerOff,
  Coins,
  Settings
} from 'lucide-react';

interface BrokerConfig {
  id: 'DHAN' | 'DELTA' | 'METATRADER';
  name: string;
  title: string;
  badge: string;
  defaultSymbol: string;
  defaultQty: number;
  cryptoSymbols?: string[];
  docsUrl: string;
  fields: { key: string; label: string; placeholder: string; isSecret?: boolean }[];
  note?: string;
}

export default function BrokersPage() {
  const [testingBroker, setTestingBroker] = useState<string | null>(null);
  const [firingOrder, setFiringOrder] = useState<string | null>(null);
  const [showEditCredentials, setShowEditCredentials] = useState(false);
  const [selectedCryptoSymbol, setSelectedCryptoSymbol] = useState<'BTCUSD' | 'ETHUSD' | 'SOLUSD' | 'XRPUSD'>('BTCUSD');

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

  // Periodic live balance auto-sync for connected broker
  useEffect(() => {
    const autoSyncInterval = setInterval(async () => {
      try {
        const savedCreds = localStorage.getItem('myalgo_broker_creds');
        const savedStatus = localStorage.getItem('myalgo_broker_status');
        if (!savedCreds || !savedStatus) return;

        const creds = JSON.parse(savedCreds);
        const statusObj = JSON.parse(savedStatus);

        const connectedId = Object.keys(statusObj).find((id) => statusObj[id]?.success);
        if (connectedId && creds[connectedId]) {
          const res = await fetch('/api/brokers/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ broker: connectedId, credentials: creds[connectedId] }),
          });
          const data = await res.json();
          if (data.success) {
            setTestStatus((prev) => {
              const updated = {
                ...prev,
                [connectedId]: {
                  ...prev[connectedId],
                  success: true,
                  balance: data.balance,
                  currency: data.currency,
                  balanceDisplay: data.balanceDisplay,
                  accountStatus: 'CONNECTED',
                },
              };
              try {
                localStorage.setItem('myalgo_broker_status', JSON.stringify(updated));
              } catch {}
              return updated;
            });
          }
        }
      } catch {}
    }, 12000);

    return () => clearInterval(autoSyncInterval);
  }, []);

  const brokers: BrokerConfig[] = [
    {
      id: 'DELTA',
      name: 'Delta Exchange (Crypto Derivatives)',
      title: 'Direct Crypto Futures with HMAC Signing (BTC, ETH, SOL, XRP)',
      badge: 'BTC • ETH • SOL • XRP',
      defaultSymbol: 'BTCUSD',
      defaultQty: 1,
      cryptoSymbols: ['BTCUSD', 'ETHUSD', 'SOLUSD', 'XRPUSD'],
      docsUrl: 'https://docs.delta.exchange',
      fields: [
        { key: 'apiKey', label: 'Delta API Key', placeholder: 'delta_api_key_...' },
        { key: 'apiSecret', label: 'Delta API Secret', placeholder: 'delta_secret_...', isSecret: true },
      ],
      note: 'Delta Settings > API Keys: Permissions must have "Read" & "Trade" enabled.',
    },
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
      const res = await fetch('/api/brokers/sync', {
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
    if (!confirm(`Disconnect ${brokerId}? All brokers will be displayed again.`)) {
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

  const fireDirectOrder = async (broker: BrokerConfig, customSymbol?: string) => {
    const symbolToTrade = customSymbol || selectedCryptoSymbol || broker.defaultSymbol;
    const modeText = isLiveMoney ? 'REAL MONEY' : 'PAPER TRADING';
    if (!confirm(`Place ${modeText} BUY order on ${broker.name} for 1 ${symbolToTrade} with 100x Leverage?`)) {
      return;
    }

    setFiringOrder(broker.id);
    try {
      const res = await fetch('/api/orders/direct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          broker: broker.id,
          symbol: symbolToTrade,
          side: 'BUY',
          quantity: 1,
          isPaper: !isLiveMoney,
          leverage: 100,
          credentials: credentials[broker.id],
        }),
      });
      const data = await res.json();
      setOrderStatus((prev) => ({
        ...prev,
        [broker.id]: { success: data.success, message: data.message || (data.success ? `100x Test Order placed for ${symbolToTrade}!` : 'Order Failed') },
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
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Wallet className="w-6 h-6 text-emerald-400" />
            Broker Integration
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Connect your broker account. Once connected, your active broker displays green and is ready for trading.
          </p>
        </div>

        {/* Live Money vs Paper Toggle */}
        <div className="flex items-center gap-3 bg-slate-900 p-2 rounded-xl border border-slate-800 shrink-0 self-start sm:self-auto">
          <span className="text-xs font-semibold text-slate-300">Execution:</span>
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

      {/* Render Brokers */}
      <div className="space-y-6">
        {displayedBrokers.map((broker) => {
          const status = testStatus[broker.id];
          const orderStat = orderStatus[broker.id];
          const isConnected = !!status?.success;

          // -------------------------------------------------------------
          // CONNECTED STATE: Clean, green, no noise
          // "brker connected hone ke baad udhr green dikhaye bus udhr wo khtm hogya"
          // -------------------------------------------------------------
          if (isConnected) {
            return (
              <div key={broker.id} className="p-6 rounded-2xl bg-gradient-to-br from-slate-900 via-emerald-950/20 to-slate-900 border-2 border-emerald-500/60 shadow-2xl space-y-6">
                {/* Header Row: Name & Large Green Connected Badge */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
                      <Wallet className="w-6 h-6" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-white">{broker.name}</h2>
                      <span className="text-xs text-slate-400">{broker.badge}</span>
                    </div>
                  </div>

                  {/* Clean Green Status Badge & Actions */}
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 text-xs sm:text-sm font-black shadow-lg shadow-emerald-500/20">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                      CONNECTED (LIVE)
                    </div>

                    <button
                      onClick={() => testConnection(broker.id)}
                      disabled={testingBroker === broker.id}
                      className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-emerald-400 px-3 py-2 rounded-lg bg-slate-800/80 hover:bg-slate-800 border border-slate-700 transition-all disabled:opacity-50"
                      title="Auto-syncs every 12s. Click to refresh live balance now."
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${testingBroker === broker.id ? 'animate-spin text-emerald-400' : 'text-slate-400'}`} />
                      <span>{testingBroker === broker.id ? 'Syncing...' : 'Sync Balance'}</span>
                    </button>

                    <button
                      onClick={() => handleDisconnectBroker(broker.id)}
                      className="text-xs text-slate-400 hover:text-rose-400 px-3 py-2 rounded-lg bg-slate-800/80 border border-slate-700 transition-colors"
                      title="Disconnect broker"
                    >
                      Disconnect
                    </button>
                  </div>
                </div>

                {/* Balance & Crypto Execution Section */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Verified Balance */}
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                    <span className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
                      Live Account Balance (INR)
                    </span>
                    <div className="text-2xl font-black text-emerald-400 font-mono">
                      {status.balanceDisplay ? (
                        status.balanceDisplay.toUpperCase().includes('REF') || (status.balanceDisplay.toUpperCase().includes('USD') && !status.balanceDisplay.toUpperCase().includes('INR'))
                          ? `₹${(parseFloat(status.balanceDisplay.match(/[\d,.]+/)?.[0]?.replace(/,/g, '') || '0') * 85).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} INR`
                          : status.balanceDisplay
                      ) : (status.balance !== undefined ? `₹${Number(status.balance).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${status.currency || 'INR'}` : '₹0.00 INR')}
                    </div>
                    <span className="text-[11px] text-emerald-400/80 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      Live balance auto-syncing every 12s (INR)
                    </span>
                  </div>

                  {/* Quick Test Fire for BTC, ETH, SOL, XRP */}
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
                        ⚡ Punch Min Lot Test Order (100x Leverage)
                      </span>
                      <span className="text-[10px] text-purple-400 font-mono font-bold bg-purple-500/20 px-2 py-0.5 rounded border border-purple-500/30">
                        100x Leverage
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Click below to punch a live minimum lot size test order with <strong className="text-purple-400">100x Leverage</strong> to verify order matching with {broker.name}:
                    </p>
                    <div className="flex items-center gap-2 pt-1">
                      {(['BTCUSD', 'ETHUSD', 'SOLUSD', 'XRPUSD'] as const).map((sym) => (
                        <button
                          key={sym}
                          onClick={() => fireDirectOrder(broker, sym)}
                          disabled={firingOrder === broker.id}
                          className={`flex-1 py-2 px-1 text-xs font-bold rounded-lg transition-all shadow ${
                            isLiveMoney
                              ? 'bg-rose-500 hover:bg-rose-600 text-white'
                              : 'bg-emerald-500 hover:bg-emerald-600 text-slate-950'
                          } disabled:opacity-50 text-center`}
                        >
                          {sym.replace('USD', '')}
                        </button>
                      ))}
                    </div>
                    <span className="text-[10px] text-slate-500 block">
                      Tap any symbol above to punch a 1-lot market test order.
                    </span>
                  </div>
                </div>

                {/* Order Result if fired */}
                {orderStat && (
                  <div className={`p-3 rounded-xl border text-xs font-semibold ${
                    orderStat.success
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                  }`}>
                    Result: {orderStat.message}
                  </div>
                )}
              </div>
            );
          }

          // -------------------------------------------------------------
          // NOT CONNECTED STATE: Form to input API Keys & Test
          // -------------------------------------------------------------
          return (
            <div key={broker.id} className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-bold text-white">{broker.name}</h2>
                    <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                      {broker.badge}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-800/80 text-slate-400 border border-slate-700/60">
                      NOT CONNECTED
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">{broker.title}</p>
                </div>

                <a
                  href={broker.docsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:underline"
                >
                  API Docs <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              {/* Special Region selector for Delta */}
              {broker.id === 'DELTA' && (
                <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <span className="text-slate-300 font-semibold">Account Region:</span>
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

              {/* Input fields */}
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

              {broker.note && (
                <p className="text-[11px] text-slate-400 flex items-start gap-1.5 bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/60">
                  <HelpCircle className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                  <span>{broker.note}</span>
                </p>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-800/80">
                <button
                  onClick={() => testConnection(broker.id)}
                  disabled={testingBroker === broker.id}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 text-xs font-bold transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${testingBroker === broker.id ? 'animate-spin' : ''}`} />
                  {testingBroker === broker.id ? 'Connecting to Broker...' : 'Connect & Verify Account'}
                </button>

                {status && !status.success && (
                  <div className="text-xs text-rose-400 flex items-center gap-1.5">
                    <XCircle className="w-4 h-4 shrink-0" />
                    <span>{status.message}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
