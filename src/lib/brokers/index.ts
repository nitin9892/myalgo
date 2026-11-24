import { IBrokerAdapter, BrokerType } from './types';
import { DhanAdapter } from './dhan';
import { DeltaAdapter } from './delta';
import { MetaTraderAdapter } from './metatrader';

export function getBrokerAdapter(type: BrokerType, credentials?: any): IBrokerAdapter {
  switch (type) {
    case 'DHAN':
      return new DhanAdapter(credentials?.clientId, credentials?.accessToken);
    case 'DELTA':
      return new DeltaAdapter(credentials?.apiKey, credentials?.apiSecret);
    case 'METATRADER':
      return new MetaTraderAdapter(credentials?.bridgeSecret);
    default:
      throw new Error(`Unsupported broker type: ${type}`);
  }
}
