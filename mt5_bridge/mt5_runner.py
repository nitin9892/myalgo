"""
==============================================================================
MYALGO - METATRADER 5 PRODUCTION AUTOMATION BRIDGE (WINDOWS)
==============================================================================
Connects directly to your local MetaTrader 5 desktop terminal via official IPC.
Listens to trading signals queued in Supabase and punches real trades in MT5 in <50ms.

Installation:
  pip install MetaTrader5 supabase python-dotenv

Usage:
  python mt5_runner.py               # Starts live listener daemon
  python mt5_runner.py --test-order  # Places an instant 0.01 test trade on EURUSD
==============================================================================
"""

import os
import sys
import time
import json
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

try:
    import MetaTrader5 as mt5
    MT5_AVAILABLE = True
except ImportError:
    MT5_AVAILABLE = False
    print("[WARNING] 'MetaTrader5' python library not found. Run: pip install MetaTrader5")

try:
    from supabase import create_client
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY) if (SUPABASE_URL and SUPABASE_KEY) else None
except Exception as e:
    supabase = None
    print(f"[WARNING] Supabase client init warning: {e}")

def init_mt5():
    if not MT5_AVAILABLE:
        print("[STATUS] Running in Simulated MT5 mode.")
        return False
    
    if not mt5.initialize():
        print(f"[ERROR] MT5 initialize() failed! Error code: {mt5.last_error()}")
        print(">> Please make sure MetaTrader 5 Desktop Terminal is installed and running.")
        return False

    account_info = mt5.account_info()
    if account_info:
        print("=" * 60)
        print("          METATRADER 5 TERMINAL CONNECTED           ")
        print("=" * 60)
        print(f" Account Login : {account_info.login}")
        print(f" Broker Server : {account_info.server}")
        print(f" Currency      : {account_info.currency}")
        print(f" Balance       : {account_info.balance:.2f} {account_info.currency}")
        print(f" Equity        : {account_info.equity:.2f} {account_info.currency}")
        print("=" * 60)
        return True
    else:
        print("[WARNING] MT5 initialized but no active trading account logged in.")
        return False

def send_heartbeat():
    if not supabase:
        return
    try:
        acc_data = {}
        if MT5_AVAILABLE and mt5.account_info():
            acc = mt5.account_info()
            acc_data = {
                "login": acc.login,
                "server": acc.server,
                "balance": acc.balance,
                "equity": acc.equity,
                "currency": acc.currency
            }
        
        supabase.table("system_logs").insert({
            "level": "INFO",
            "source": "MT5_LOCAL_BRIDGE",
            "message": f"MT5 Runner Online - Active Account: {acc_data.get('login', 'Simulated')}",
            "metadata": {"status": "ONLINE", "account": acc_data}
        }).execute()
    except Exception as e:
        print(f"[HEARTBEAT ERROR] {e}")

def get_filling_mode(symbol):
    if not MT5_AVAILABLE:
        return 0
    sym_info = mt5.symbol_info(symbol)
    if not sym_info:
        return mt5.ORDER_FILLING_IOC
    filling = sym_info.filling_mode
    if filling & 2:
        return mt5.ORDER_FILLING_IOC
    elif filling & 1:
        return mt5.ORDER_FILLING_FOK
    return mt5.ORDER_FILLING_RETURN

def execute_mt5_live_order(order_data):
    symbol = order_data.get("symbol", "EURUSD").upper()
    side = order_data.get("side", "BUY").upper()
    volume = float(order_data.get("quantity", 0.01))
    sl = order_data.get("stopLoss")
    tp = order_data.get("takeProfit")

    print(f"\n[EXECUTION REQUEST] Placing {side} {volume} lot on {symbol}...")

    if not MT5_AVAILABLE or not mt5.terminal_info():
        print(f"[SIMULATED FILL] {side} {volume} {symbol} successfully simulated (Local MT5 Terminal not open).")
        return {"status": "SIMULATED", "order": 12345678}

    # Ensure symbol is selected in Market Watch
    if not mt5.symbol_select(symbol, True):
        print(f"[ERROR] Failed to select symbol {symbol} in Market Watch.")
        return {"status": "FAILED", "error": f"Symbol {symbol} not found"}

    tick = mt5.symbol_info_tick(symbol)
    if not tick:
        print(f"[ERROR] Could not fetch live tick for {symbol}")
        return {"status": "FAILED", "error": f"No tick for {symbol}"}

    price = tick.ask if side == "BUY" else tick.bid
    order_type = mt5.ORDER_TYPE_BUY if side == "BUY" else mt5.ORDER_TYPE_SELL
    filling_mode = get_filling_mode(symbol)

    request = {
        "action": mt5.TRADE_ACTION_DEAL,
        "symbol": symbol,
        "volume": volume,
        "type": order_type,
        "price": price,
        "sl": float(sl) if sl else 0.0,
        "tp": float(tp) if tp else 0.0,
        "deviation": 20,
        "magic": 989200,
        "comment": "MyAlgo Live Execution",
        "type_time": mt5.ORDER_TIME_GTC,
        "type_filling": filling_mode,
    }

    result = mt5.order_send(request)
    if result.retcode != mt5.TRADE_RETCODE_DONE:
        print(f"[ORDER FAILED] MT5 Retcode: {result.retcode} | Comment: {result.comment}")
        return {"status": "FAILED", "retcode": result.retcode, "comment": result.comment}

    print(f"[SUCCESS] Order Executed! Ticket #{result.order} @ {result.price}")
    return {"status": "FILLED", "order": result.order, "price": result.price}

def main():
    if "--test-order" in sys.argv:
        print("Placing single test trade of 0.01 lot EURUSD...")
        init_mt5()
        res = execute_mt5_live_order({"symbol": "EURUSD", "side": "BUY", "quantity": 0.01})
        print("Result:", res)
        return

    print("Starting MyAlgo MetaTrader 5 Bridge Daemon...")
    init_mt5()
    send_heartbeat()

    last_heartbeat = time.time()
    processed_orders = set()

    print("[LISTENING] Watching for live signals from MyAlgo Vercel Engine...")

    while True:
        try:
            # Heartbeat every 90 seconds
            if time.time() - last_heartbeat > 90:
                send_heartbeat()
                last_heartbeat = time.time()

            # Poll signals from Supabase
            if supabase:
                res = supabase.table("system_logs") \
                    .select("*") \
                    .eq("source", "METATRADER_BRIDGE") \
                    .order("timestamp", desc=True) \
                    .limit(5) \
                    .execute()

                for row in res.data:
                    order_id = row.get("id")
                    meta = row.get("metadata", {})
                    if order_id not in processed_orders and meta.get("status") == "PENDING_BRIDGE_EXECUTION":
                        print(f"\n>> LIVE SIGNAL RECEIVED: {row.get('message')}")
                        exec_result = execute_mt5_live_order(meta)
                        processed_orders.add(order_id)

                        # Update status in Supabase
                        supabase.table("system_logs").insert({
                            "level": "INFO",
                            "source": "MT5_EXECUTION_REPORT",
                            "message": f"MT5 Result for {meta.get('symbol')}: {exec_result.get('status')}",
                            "metadata": exec_result
                        }).execute()

            time.sleep(2)
        except KeyboardInterrupt:
            print("\nShutting down MT5 bridge...")
            break
        except Exception as e:
            print(f"[POLL ERROR] {e}")
            time.sleep(4)

    if MT5_AVAILABLE:
        mt5.shutdown()

if __name__ == "__main__":
    main()
