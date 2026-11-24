import { NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase';
import { getBrokerAdapter } from '@/lib/brokers';
import { BrokerType, OrderRequest } from '@/lib/brokers/types';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const supabase = getAdminSupabase();

    // Fetch open positions
    const { data: openTrades, error: openErr } = await supabase
      .from('trades')
      .select('*')
      .eq('status', 'OPEN')
      .order('timestamp', { ascending: false });

    if (openErr) {
      console.error('Error fetching open trades:', openErr);
    }

    // Fetch recent closed trades
    const { data: closedTrades, error: closedErr } = await supabase
      .from('trades')
      .select('*')
      .eq('status', 'CLOSED')
      .order('timestamp', { ascending: false })
      .limit(20);

    if (closedErr) {
      console.error('Error fetching closed trades:', closedErr);
    }

    // Calculate Today Realized P&L & Win Rate
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { data: todayTrades } = await supabase
      .from('trades')
      .select('pnl, status')
      .gte('timestamp', todayStart.toISOString())
      .eq('status', 'CLOSED');

    let todayPnl = 0;
    let winningTrades = 0;
    let totalClosed = (todayTrades || []).length;

    (todayTrades || []).forEach((t: any) => {
      const pnl = Number(t.pnl || 0);
      todayPnl += pnl;
      if (pnl > 0) winningTrades++;
    });

    const winRate = totalClosed > 0 ? Number(((winningTrades / totalClosed) * 100).toFixed(1)) : 0;

    return NextResponse.json({
      success: true,
      openPositions: openTrades || [],
      recentTrades: closedTrades || [],
      stats: {
        todayPnl,
        winRate,
        totalClosedToday: totalClosed,
        openCount: (openTrades || []).length,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { action, tradeId, broker, symbol, side, quantity, exitPrice, credentials } = await request.json();

    if (action === 'SQUARE_OFF') {
      const supabase = getAdminSupabase();
      
      // Determine reverse side for square-off
      const reverseSide = side?.toUpperCase() === 'BUY' ? 'SELL' : 'BUY';

      // If credentials provided, execute real square-off with broker
      let brokerOrderResult: any = { success: true, message: 'Simulated Square-off' };
      if (broker && credentials) {
        try {
          const adapter = getBrokerAdapter(broker as BrokerType, credentials);
          const orderReq: OrderRequest = {
            symbol: symbol || 'UNKNOWN',
            side: reverseSide as 'BUY' | 'SELL',
            quantity: Number(quantity) || 1,
            orderType: 'MARKET',
            paperTrade: false,
          };
          brokerOrderResult = await adapter.placeOrder(orderReq);
        } catch (brokerErr: any) {
          console.warn('Broker square-off warning:', brokerErr.message);
        }
      }

      // Update trade in database
      const finalExitPrice = exitPrice || brokerOrderResult.price || 0;
      
      if (tradeId) {
        await supabase
          .from('trades')
          .update({
            status: 'CLOSED',
            exit_price: finalExitPrice,
            notes: `Manual Square-Off by User (${brokerOrderResult.status || 'CLOSED'})`,
          })
          .eq('id', tradeId);
      }

      // Log the square-off event
      await supabase.from('system_logs').insert({
        level: 'TRADE_SIGNAL',
        source: `MANUAL_SQUARE_OFF_${broker || 'UNKNOWN'}`,
        message: `Square-Off: Closed position ${side} ${quantity} ${symbol} @ ${finalExitPrice}`,
        metadata: { tradeId, brokerOrderResult },
      });

      return NextResponse.json({
        success: true,
        message: `Position for ${symbol} successfully squared off!`,
        result: brokerOrderResult,
      });
    }

    return NextResponse.json({ success: false, message: 'Invalid action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
