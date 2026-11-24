'use client';

import { useState } from 'react';
import { Wallet, CheckCircle2, XCircle, RefreshCw, Key, Shield, ExternalLink } from 'lucide-react';

interface BrokerConfig {
  id: string;
  name: string;
  title: string;
  badge: string;
  docsUrl: string;
  fields: { key: string; label: string; placeholder: string; isSecret?: boolean }[];
}

export default function BrokersPage() {
  const [testingBroker, setTestingBroker] = useState<string | null>(null);
  const [testStatus, setTestStatus] = useState<Record<string, { success: boolean; message: string }>>({});

  const brokers: BrokerConfig[] = [
    {
      id: 'DHAN',
      name: 'DhanHQ API',
      title: 'Indian Stock & Derivatives Markets',
      badge: 'NSE / BSE / F&O',
      docsUrl: 'https://dhanhq.co/docs',
      fields: [
        { key: 'clientId', label: 'Dhan Client ID', placeholder: '1100xxxxxx' },
        { key: 'accessToken', label: 'Dhan Access Token / JWT', placeholder: 'eyJhbGciOi...', isSecret: true },
      ],
    },
    {
      id: 'DELTA',
      name: 'Delta Exchange',
      title: 'Crypto Derivatives (Options & Futures)',
      badge: 'BTC / ETH / SOL',
      docsUrl: 'https://docs.delta.exchange',
      fields: [
        { key: 'apiKey', label: 'API Key', placeholder: 'delta_api_key_...' },
        { key: 'apiSecret', label: 'API Secret', placeholder: 'delta_secret_...', isSecret: true },
      ],
    },
    {
      id: 'METATRADER',
      name: 'MetaTrader 5 (MT5)',
      title: 'Forex, Indices & Commodities',
      badge: 'EURUSD / XAUUSD / US30',
      docsUrl: 'https://www.mql5.com/en/docs/python_metatrader5',
      fields: [
        { key: 'bridgeSecret', label: 'Bridge Authentication Secret', placeholder: 'your-mt5-bridge-token', isSecret: true },
      ],
    },
  ];

  const testConnection = async (brokerId: string) => {
    setTestingBroker(brokerId);
    try {
      const res = await fetch('/api/brokers/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ broker: brokerId }),
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

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="pb-6 border-b border-slate-800">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Wallet className="w-6 h-6 text-emerald-400" />
          Broker & API Integrations
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Manage API credentials for Dhan, Delta Exchange, and MetaTrader 5. All keys are encrypted and stored securely.
        </p>
      </div>

      <div className="space-y-6">
        {brokers.map((broker) => {
          const status = testStatus[broker.id];
          return (
            <div key={broker.id} className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
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
                      placeholder={field.placeholder}
                      className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500 font-mono"
                    />
                  </div>
                ))}
              </div>

              {/* Bottom Test Button & Status */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-800/80">
                <button
                  onClick={() => testConnection(broker.id)}
                  disabled={testingBroker === broker.id}
                  className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${testingBroker === broker.id ? 'animate-spin' : ''}`} />
                  {testingBroker === broker.id ? 'Testing...' : 'Test Connection'}
                </button>

                {status && (
                  <div className={`text-xs flex items-center gap-1.5 ${status.success ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {status.success ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
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
