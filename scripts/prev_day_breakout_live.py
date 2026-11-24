"""
==============================================================================
MYALGO - PREV DAY LEVELS BREAKOUT & 1:3 TRAILING STRATEGY (PYTHON LIVE RUNNER)
==============================================================================
Decoded Rules:
- Timeframe: 5-minute candles
- Key Levels: Previous Day High (PDH), Previous Day Low (PDL), Previous Day Close (PDC)
- Time Rules (IST):
  * No entries before 09:15
  * No-entry block window: 11:00 to 13:00 (active trades still managed)
  * Force square-off: 15:30 IST
- Entry:
  * Green candle (Close > Open) breaks & closes beyond level -> BUY @ Candle High
  * Red candle (Close < Open) breaks & closes beyond level -> SELL @ Candle Low
- Stop Loss:
  * 'signal_candle': Low of green candle (for Buy) / High of red candle (for Sell)
  * 'prev_candle': Low of prior candle (for Buy) / High of prior candle (for Sell)
- Target: 1:3 Risk-Reward (initial_sl_points * 3)
- Trailing: Every +10 pts favorable move -> Trail SL +3 pts & Trail Target +3 pts
==============================================================================
"""

import time
import datetime
import math

class PrevDayBreakoutStrategy:
    def __init__(
        self,
        symbol="NIFTY",
        prev_high=24250.0,
        prev_low=23980.0,
        prev_close=24120.0,
        sl_candle_mode="signal_candle",  # 'signal_candle' or 'prev_candle'
        lot_size=50,
        max_trades_per_day=3,
        trail_step_points=10.0,
        trail_amount_points=3.0,
        session_start="09:15",
        no_trade_start="11:00",
        no_trade_end="13:00",
        square_off_time="15:30"
    ):
        self.symbol = symbol
        self.prev_high = prev_high
        self.prev_low = prev_low
        self.prev_close = prev_close
        self.sl_candle_mode = sl_candle_mode
        self.lot_size = lot_size
        self.max_trades_per_day = max_trades_per_day
        self.trail_step_points = trail_step_points
        self.trail_amount_points = trail_amount_points

        self.session_start = session_start
        self.no_trade_start = no_trade_start
        self.no_trade_end = no_trade_end
        self.square_off_time = square_off_time

        # State tracking
        self.today_trade_count = 0
        self.active_position = None
        self.last_traded_setup = None

    def _get_current_time_minutes(self):
        now = datetime.datetime.now()
        return now.hour * 60 + now.minute

    def _parse_time_minutes(self, time_str):
        h, m = map(int, time_str.split(":"))
        return h * 60 + m

    def check_time_window(self):
        current_min = self._get_current_time_minutes()
        start_min = self._parse_time_minutes(self.session_start)
        block_start_min = self._parse_time_minutes(self.no_trade_start)
        block_end_min = self._parse_time_minutes(self.no_trade_end)
        sq_off_min = self._parse_time_minutes(self.square_off_time)

        is_before_open = current_min < start_min
        is_blocked = block_start_min <= current_min < block_end_min
        is_sq_off = current_min >= sq_off_min
        can_enter = not is_before_open and not is_blocked and not is_sq_off

        return {
            "can_enter": can_enter,
            "is_blocked": is_blocked,
            "is_square_off": is_sq_off,
            "status": "FORCE_SQUARE_OFF" if is_sq_off else ("ENTRY_BLOCKED" if is_blocked else "TRADING_ACTIVE")
        }

    def on_tick(self, current_price):
        """Called every tick/price update to evaluate trailing & exits"""
        if not self.active_position:
            return None

        pos = self.active_position
        time_check = self.check_time_window()

        # 1. Force Square-Off at 15:30
        if time_check["is_square_off"]:
            return self.close_position(current_price, "TIME_EXIT_1530")

        # 2. Check Stop-Loss Hit
        if pos["side"] == "BUY" and current_price <= pos["current_sl"]:
            return self.close_position(pos["current_sl"], "SL_HIT")
        if pos["side"] == "SELL" and current_price >= pos["current_sl"]:
            return self.close_position(pos["current_sl"], "SL_HIT")

        # 3. Check Target Hit
        if pos["side"] == "BUY" and current_price >= pos["current_target"]:
            return self.close_position(pos["current_target"], "TARGET_HIT")
        if pos["side"] == "SELL" and current_price <= pos["current_target"]:
            return self.close_position(pos["current_target"], "TARGET_HIT")

        # 4. Step Trailing SL & Target
        favorable_points = (current_price - pos["entry_price"]) if pos["side"] == "BUY" else (pos["entry_price"] - current_price)
        if favorable_points > 0:
            milestones = int(favorable_points // self.trail_step_points)
            if milestones > pos["milestones"]:
                diff = milestones - pos["milestones"]
                shift = diff * self.trail_amount_points
                pos["milestones"] = milestones

                if pos["side"] == "BUY":
                    pos["current_sl"] += shift
                    pos["current_target"] += shift
                else:
                    pos["current_sl"] -= shift
                    pos["current_target"] -= shift

                print(f"[TRAILING] Milestone #{milestones} hit (+{favorable_points:.1f} pts) -> Trailed SL to {pos['current_sl']:.2f}, Target to {pos['current_target']:.2f}")

        return None

    def on_candle_close_5m(self, prev_candle, signal_candle):
        """
        Called on 5m candle close:
        prev_candle: {'open', 'high', 'low', 'close'}
        signal_candle: {'open', 'high', 'low', 'close'}
        """
        if self.active_position:
            return None  # Manage existing position

        time_check = self.check_time_window()
        if not time_check["can_enter"]:
            print(f"[INFO] Entries blocked by time window: {time_check['status']}")
            return None

        if self.today_trade_count >= self.max_trades_per_day:
            print(f"[LIMIT] Daily trade count limit reached: {self.today_trade_count}/{self.max_trades_per_day}")
            return None

        levels = [
            ("PREV_HIGH", self.prev_high),
            ("PREV_LOW", self.prev_low),
            ("PREV_CLOSE", self.prev_close)
        ]

        is_green = signal_candle["close"] > signal_candle["open"]
        is_red = signal_candle["close"] < signal_candle["open"]

        # BUY SETUP: Green candle breaks & closes above a key level
        if is_green:
            for name, lvl in levels:
                if prev_candle["close"] <= lvl and signal_candle["close"] > lvl:
                    entry_price = signal_candle["high"]
                    initial_sl = prev_candle["low"] if self.sl_candle_mode == "prev_candle" else signal_candle["low"]
                    sl_points = max(1.0, entry_price - initial_sl)
                    target_points = sl_points * 3.0  # 1:3 RR
                    target_price = entry_price + target_points

                    return self.open_position("BUY", entry_price, initial_sl, target_price, sl_points, target_points, f"Green candle break above {name} ({lvl})")

        # SELL SETUP: Red candle breaks & closes below a key level
        if is_red:
            for name, lvl in levels:
                if prev_candle["close"] >= lvl and signal_candle["close"] < lvl:
                    entry_price = signal_candle["low"]
                    initial_sl = prev_candle["high"] if self.sl_candle_mode == "prev_candle" else signal_candle["high"]
                    sl_points = max(1.0, initial_sl - entry_price)
                    target_points = sl_points * 3.0  # 1:3 RR
                    target_price = entry_price - target_points

                    return self.open_position("SELL", entry_price, initial_sl, target_price, sl_points, target_points, f"Red candle break below {name} ({lvl})")

        return None

    def open_position(self, side, entry_price, sl, target, sl_points, target_points, reason):
        self.active_position = {
            "side": side,
            "entry_price": entry_price,
            "initial_sl": sl,
            "current_sl": sl,
            "initial_target": target,
            "current_target": target,
            "sl_points": sl_points,
            "target_points": target_points,
            "milestones": 0,
            "entry_time": datetime.datetime.now().strftime("%H:%M:%S")
        }
        self.today_trade_count += 1
        print("=" * 60)
        print(f"[ENTRY TRIGGERED] {side} {self.lot_size} {self.symbol} @ {entry_price:.2f}")
        print(f"Reason: {reason}")
        print(f"Initial SL: {sl:.2f} ({sl_points:.1f} pts) | 1:3 Target: {target:.2f} ({target_points:.1f} pts)")
        print("=" * 60)
        return self.active_position

    def close_position(self, exit_price, reason):
        pos = self.active_position
        is_buy = pos["side"] == "BUY"
        pnl = (exit_price - pos["entry_price"]) * self.lot_size if is_buy else (pos["entry_price"] - exit_price) * self.lot_size
        pnl_pct = (pnl / (pos["entry_price"] * self.lot_size)) * 100

        print("=" * 60)
        print(f"[POSITION CLOSED] Reason: {reason} @ {exit_price:.2f}")
        print(f"Side: {pos['side']} | Realized P&L: ₹{pnl:.2f} ({pnl_pct:.2f}%)")
        print("=" * 60)

        closed_pos = {**pos, "exit_price": exit_price, "reason": reason, "pnl": pnl}
        self.active_position = None
        return closed_pos

# Example Demonstration
if __name__ == "__main__":
    strategy = PrevDayBreakoutStrategy(
        symbol="NIFTY",
        prev_high=24200.0,
        prev_low=23950.0,
        prev_close=24100.0,
        sl_candle_mode="signal_candle",
        trail_step_points=10.0,
        trail_amount_points=3.0
    )

    print("Strategy initialized successfully. Ready for live tick and 5m candle feeds.")
