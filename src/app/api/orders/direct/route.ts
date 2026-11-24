import { NextResponse } from 'next/server';
import { getBrokerAdapter } from '@/lib/brokers';
import { BrokerType, OrderRequest } from '@/lib/brokers/types';
import { getAdminSupabase } from '@/lib/supabase';
import { getRiskConfiguration } from '@/lib/risk/engine';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { broker, symbol, side, quantity, isPaper = false, credentials } = await request.json();

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

    const adapter = getBrokerAdapter(broker as BrokerType, credentials);
    const orderRequest: OrderRequest = {
      symbol: symbol.toUpperCase(),
      side: side.toUpperCase() as 'BUY' | 'SELL',
      quantity: Number(quantity),
      orderType: 'MARKET',
      paperTrade: isPaper,
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
        paper_trade: isPaper,
        broker_order_id: result.orderId,
        notes: isPaper ? 'Manual Paper Execution' : 'Manual LIVE Money Execution',
      });

      await supabase.from('system_logs').insert({
        level: 'TRADE_SIGNAL',
        source: `DIRECT_${broker}`,
        message: `Direct Order: ${side} ${quantity} ${symbol} (${isPaper ? 'PAPER' : 'LIVE MONEY'})`,
        metadata: { result },
      });
    }

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
