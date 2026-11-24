import { NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase';
import { getBrokerAdapter } from '@/lib/brokers';
import { BrokerType, OrderRequest } from '@/lib/brokers/types';

export const dynamic = 'force-dynamic';

// Webhook for manual trading or TradingView alert triggers
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { broker = 'DHAN', symbol, side, quantity, price, stopLoss, takeProfit, paperTrade = true, secret } = body;

    const expectedSecret = process.env.MT_BRIDGE_SECRET || process.env.CRON_SECRET;
    if (expectedSecret && secret !== expectedSecret) {
      return NextResponse.json({ error: 'Unauthorized webhook secret' }, { status: 401 });
    }

    if (!symbol || !side || !quantity) {
      return NextResponse.json({ error: 'Missing required fields: symbol, side, quantity' }, { status: 400 });
    }

    const adapter = getBrokerAdapter(broker as BrokerType);
    const orderRequest: OrderRequest = {
      symbol,
      side: side.toUpperCase() as 'BUY' | 'SELL',
      quantity: Number(quantity),
      orderType: price ? 'LIMIT' : 'MARKET',
      price: price ? Number(price) : undefined,
      stopLoss: stopLoss ? Number(stopLoss) : undefined,
      takeProfit: takeProfit ? Number(takeProfit) : undefined,
      paperTrade,
    };

    const orderResult = await adapter.placeOrder(orderRequest);
    const supabase = getAdminSupabase();

    if (orderResult.success) {
      await supabase.from('trades').insert({
        broker_name: broker,
        symbol,
        side: orderRequest.side,
        quantity: orderRequest.quantity,
        entry_price: orderResult.price || 0,
        stop_loss: stopLoss,
        take_profit: takeProfit,
        status: 'OPEN',
        paper_trade: paperTrade,
        broker_order_id: orderResult.orderId,
        notes: 'Executed via Webhook',
      });

      await supabase.from('system_logs').insert({
        level: 'TRADE_SIGNAL',
        source: 'WEBHOOK_ENDPOINT',
        message: `Webhook placed ${side} ${quantity} ${symbol} on ${broker}`,
        metadata: { orderResult },
      });
    }

    return NextResponse.json({ success: true, orderResult });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
