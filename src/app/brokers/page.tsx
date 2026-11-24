'use client';

import { useState } from 'react';
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
  Send
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
}

export default function BrokersPage() {
  const [testingBroker, setTestingBroker] = useState<string | null>(null);
  const [firingOrder, setFiringOrder] = useState<string | null>(null);
  const [testStatus, setTestStatus] = useState<Record<string, { success: boolean; message: string }>>({});
  const [orderStatus, setOrderStatus] = useState<Record<string, { success: boolean; message: string }>>({});

  // Credentials state
  const [credentials, setCredentials] = useState<Record<string, Record<string, string>>>({
    DHAN: { clientId: '', accessToken: '' },
    DELTA: { apiKey: '', apiSecret: '' },
    METATRADER: { bridgeSecret: 'mt5_bridge_secret_key_2026', metaApiToken: '', metaApiAccountId: '' },
  });

  const [isLiveMoney, setIsLiveMoney] = useState(false);

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
    },
  ];

  const updateCred = (brokerId: string, key: string, value: string) => {
    setCredentials((prev) => ({
      ...prev,
      [brokerId]: { ...prev[brokerId], [key]: value },
    }));
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
      setTestStatus((prev) => ({
        ...prev,
        [brokerId]: { success: data.success, message: data.message },
      }));
    } catch (err: any) {
      setTestStatus((prev) => ({
        ...prev,
        [brokerId]: { success: false, message: err.message },
      }));
    } finally {
      setTestingBroker(null);
    }
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
            Connect live API accounts for Dhan, Delta Exchange, and MetaTrader 5 with real-time execution.
          </p>
        </div>

        {/* Live Money vs Paper Toggle */}
        <div className="flex items-center gap-3 bg-slate-900 p-2 rounded-xl border border-slate-800">
          <span className="text-xs font-semibold text-slate-300">Execution Mode:</span>
          <button
            onClick={() => setIsLiveMoney(!isLiveMoney)}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
              isLiveMoney
                ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/30'
                : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
            }`}
          >
            {isLiveMoney ? '🔴 REAL MONEY LIVE' : '🟢 PAPER TRADING (Safe)'}
          </button>
        </div>
      </div>

      {/* Broker Cards */}
      <div className="space-y-6">
        {brokers.map((broker) => {
          const status = testStatus[broker.id];
          const orderStat = orderStatus[broker.id];
          return (
            <div key={broker.id} className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-white">{broker.name}</h2>
                    <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                      {broker.badge}
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

              {/* Form Input Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                {broker.fields.map((field) => (
                  <div key={field.key} className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-300">{field.label}</label>
                    <input
                      type={field.isSecret ? 'password' : 'text'}
                      value={credentials[broker.id]?.[field.key] || ''}
                      onChange={(e) => updateCred(broker.id, field.key, e.target.value)}
                      placeholder={field.placeholder}
                      className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500 font-mono"
                    />
                  </div>
                ))}
              </div>

              {/* Action Buttons & Status */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-800/80">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => testConnection(broker.id)}
                    disabled={testingBroker === broker.id}
                    className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${testingBroker === broker.id ? 'animate-spin' : ''}`} />
                    {testingBroker === broker.id ? 'Testing...' : 'Test Connection'}
                  </button>

                  <button
                    onClick={() => fireDirectOrder(broker)}
                    disabled={firingOrder === broker.id}
                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all shadow-md ${
                      isLiveMoney
                        ? 'bg-rose-500 hover:bg-rose-600 text-white'
                        : 'bg-emerald-500 hover:bg-emerald-600 text-slate-950'
                    }`}
                  >
                    <Zap className="w-3.5 h-3.5 fill-current" />
                    {firingOrder === broker.id ? 'Punching...' : `Fire Test Order (${broker.defaultSymbol})`}
                  </button>
                </div>

                <div className="space-y-1 text-right">
                  {status && (
                    <div className={`text-xs flex items-center justify-end gap-1.5 ${status.success ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {status.success ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <XCircle className="w-4 h-4 shrink-0" />}
                      <span>{status.message}</span>
                    </div>
                  )}
                  {orderStat && (
                    <div className={`text-xs font-semibold flex items-center justify-end gap-1.5 ${orderStat.success ? 'text-emerald-300' : 'text-rose-400'}`}>
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
