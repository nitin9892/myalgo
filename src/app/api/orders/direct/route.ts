import { NextResponse } from 'next/server';
import { getBrokerAdapter } from '@/lib/brokers';
import { BrokerType, OrderRequest } from '@/lib/brokers/types';
import { getAdminSupabase } from '@/lib/supabase';
import { getRiskConfiguration } from '@/lib/risk/engine';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { broker, symbol, side, quantity, isPaper = false, leverage = 100, credentials } = await request.json();

    if (!broker || !symbol || !side || !quantity) {
      return NextResponse.json({ success: false, message: 'Missing order parameters' }, { status: 400 });
    }

    // KILL SWITCH PROTECTION CHECK
    const riskConfig = await getRiskConfiguration();
    if (riskConfig.killSwitchActive) {
      return NextResponse.json({
        success: false,
        message: `🚨 ORDER REJECTED: Kill Switch is ACTIVE (${riskConfig.killSwitchReason || 'Emergency circuit breaker tripped'}). Reset Kill Switch in Risk & Capital before trading.`
      }, { status: 403 });
    }

    const appliedLeverage = Number(leverage || 100);

    let cleanSymbol = String(symbol || 'BTCUSD').toUpperCase().trim();
    if (cleanSymbol === 'ETH' || cleanSymbol === 'ETHUSDT') cleanSymbol = 'ETHUSD';
    else if (cleanSymbol === 'SOL' || cleanSymbol === 'SOLUSDT' || cleanSymbol === 'SPL' || cleanSymbol === 'SPLUSD') cleanSymbol = 'SOLUSD';
    else if (cleanSymbol === 'XRP' || cleanSymbol === 'XRPUSDT') cleanSymbol = 'XRPUSD';
    else if (cleanSymbol === 'BTC' || cleanSymbol === 'BTCUSDT') cleanSymbol = 'BTCUSD';

    const adapter = getBrokerAdapter(broker as BrokerType, credentials);
    const orderRequest: OrderRequest = {
      symbol: cleanSymbol,
      side: side.toUpperCase() as 'BUY' | 'SELL',
      quantity: Number(quantity),
      orderType: 'MARKET',
      paperTrade: false,
      leverage: appliedLeverage,
    };

    const result = await adapter.placeOrder(orderRequest);
    const supabase = getAdminSupabase();

    if (result.success) {
      await supabase.from('trades').insert({
        broker_name: broker,
        symbol: orderRequest.symbol,
        side: orderRequest.side,
        quantity: orderRequest.quantity,
        entry_price: result.price || 0,
        status: 'OPEN',
        paper_trade: false,
        broker_order_id: result.orderId,
        notes: `LIVE Money Execution | Test Order (${appliedLeverage}x Leverage)`,
      });

      await supabase.from('system_logs').insert({
        level: 'TRADE_SIGNAL',
        source: `DIRECT_${broker}`,
        message: `Direct Test Order: ${side} ${quantity} ${symbol} (${appliedLeverage}x Leverage, LIVE MONEY)`,
        metadata: { result, leverage: appliedLeverage },
      });
    }

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
