"""
MetaTrader 5 Windows Local Bridge Runner
Runs on your Windows machine alongside your MT5 Desktop Terminal.
Listens to Supabase 'system_logs' for TRADE_SIGNAL events and executes them directly in MT5.

Usage:
  pip install MetaTrader5 supabase python-dotenv
  python mt5_runner.py
"""

import os
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
    print("[WARNING] 'MetaTrader5' python package not installed. Running in simulation mode.")

try:
    from supabase import create_client
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY) if (SUPABASE_URL and SUPABASE_KEY) else None
except ImportError:
    supabase = None
    print("[WARNING] 'supabase' package not installed. Run: pip install supabase")

def init_mt5():
    if not MT5_AVAILABLE:
        return False
    if not mt5.initialize():
        print(f"[ERROR] MT5 initialize() failed, error code: {mt5.last_error()}")
        return False
    account_info = mt5.account_info()
    if account_info:
        print(f"[SUCCESS] Connected to MT5 Account: {account_info.login} ({account_info.server})")
        print(f"Balance: {account_info.balance} {account_info.currency} | Equity: {account_info.equity}")
        return True
    return False

def send_heartbeat():
    if not supabase:
        return
    try:
        supabase.table("system_logs").insert({
            "level": "INFO",
            "source": "MT5_LOCAL_BRIDGE",
            "message": "Local MT5 runner heartbeat - Online and ready",
            "metadata": {"status": "ACTIVE", "mt5_initialized": MT5_AVAILABLE}
        }).execute()
    except Exception as e:
        print(f"[ERROR] Heartbeat failed: {e}")

def execute_mt5_order(order_data):
    symbol = order_data.get("symbol", "EURUSD")
    side = order_data.get("side", "BUY")
    volume = float(order_data.get("quantity", 0.01))
    sl = order_data.get("stopLoss")
    tp = order_data.get("takeProfit")

    if not MT5_AVAILABLE:
        print(f"[SIMULATED MT5 EXECUTION] {side} {volume} lot of {symbol} (SL: {sl}, TP: {tp})")
        return {"status": "SIMULATED", "order": 999999}

    order_type = mt5.ORDER_TYPE_BUY if side == "BUY" else mt5.ORDER_TYPE_SELL
    price = mt5.symbol_info_tick(symbol).ask if side == "BUY" else mt5.symbol_info_tick(symbol).bid

    request = {
        "action": mt5.TRADE_ACTION_DEAL,
        "symbol": symbol,
        "volume": volume,
        "type": order_type,
        "price": price,
        "sl": float(sl) if sl else 0.0,
        "tp": float(tp) if tp else 0.0,
        "deviation": 20,
        "magic": 234000,
        "comment": "MyAlgo Auto Execution",
        "type_time": mt5.ORDER_TIME_GTC,
        "type_filling": mt5.ORDER_FILLING_IOC,
    }

    result = mt5.order_send(request)
    if result.retcode != mt5.TRADE_RETCODE_DONE:
        print(f"[ERROR] MT5 Order failed, retcode={result.retcode}")
        return {"status": "FAILED", "retcode": result.retcode}
    
    print(f"[SUCCESS] MT5 Order executed successfully! Ticket #{result.order}")
    return {"status": "FILLED", "order": result.order, "price": result.price}

def main():
    print("=" * 60)
    print("      MYALGO LOCAL METATRADER 5 BRIDGE RUNNER       ")
    print("=" * 60)
    init_mt5()
    send_heartbeat()

    last_heartbeat = time.time()
    processed_orders = set()

    while True:
        try:
            # Heartbeat every 2 minutes
            if time.time() - last_heartbeat > 120:
                send_heartbeat()
                last_heartbeat = time.time()

            # Poll pending signals from Supabase
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
                        print(f"[SIGNAL DETECTED] {row.get('message')}")
                        res = execute_mt5_order(meta)
                        processed_orders.add(order_id)
            
            time.sleep(3)
        except KeyboardInterrupt:
            print("\nShutting down MT5 bridge...")
            break
        except Exception as e:
            print(f"[LOOP ERROR] {e}")
            time.sleep(5)

    if MT5_AVAILABLE:
        mt5.shutdown()

if __name__ == "__main__":
    main()
