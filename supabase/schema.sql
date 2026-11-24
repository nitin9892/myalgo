-- ==============================================================================
-- MyAlgo Trading Platform: Supabase Database Schema
-- Run this script in your Supabase SQL Editor
-- ==============================================================================

-- 1. Enable UUID Extension
create extension if not exists "uuid-ossp";

-- 2. Broker Accounts Table (Dhan, Delta Exchange, MetaTrader)
create table if not exists public.broker_accounts (
    id uuid primary key default uuid_generate_v4(),
    broker_name text not null check (broker_name in ('DHAN', 'DELTA', 'METATRADER')),
    account_label text not null,
    is_active boolean default true,
    is_live boolean default false, -- false = paper trading, true = real money
    api_key text,
    api_secret text,
    client_id text,
    access_token text,
    server_details jsonb default '{}'::jsonb, -- e.g. MT5 server / account id
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);

-- 3. Strategies Table
create table if not exists public.strategies (
    id uuid primary key default uuid_generate_v4(),
    name text not null,
    broker_name text not null check (broker_name in ('DHAN', 'DELTA', 'METATRADER')),
    symbol text not null, -- e.g. "NIFTY", "BTCUSD", "EURUSD"
    timeframe text not null default '1m', -- '1m', '5m', '15m', '1h'
    strategy_type text not null check (strategy_type in ('EMA_CROSSOVER', 'RSI_REVERSAL', 'SUPERTREND', 'CUSTOM_WEBHOOK')),
    is_active boolean default false,
    paper_trading boolean default true,
    capital_allocation numeric default 50000,
    risk_percentage numeric default 1.0, -- risk 1% per trade
    stop_loss_pct numeric default 0.5,
    take_profit_pct numeric default 1.0,
    parameters jsonb default '{"fast_ema": 9, "slow_ema": 21}'::jsonb,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);

-- 4. Trades Table (Executed orders and live positions)
create table if not exists public.trades (
    id uuid primary key default uuid_generate_v4(),
    strategy_id uuid references public.strategies(id) on delete set null,
    broker_name text not null,
    symbol text not null,
    side text not null check (side in ('BUY', 'SELL')),
    order_type text default 'MARKET',
    quantity numeric not null,
    entry_price numeric not null,
    exit_price numeric,
    stop_loss numeric,
    take_profit numeric,
    pnl numeric default 0,
    pnl_percentage numeric default 0,
    status text not null check (status in ('OPEN', 'CLOSED', 'CANCELLED', 'REJECTED')),
    paper_trade boolean default true,
    broker_order_id text,
    entry_time timestamp with time zone default now(),
    exit_time timestamp with time zone,
    notes text
);

-- 5. System Execution Logs
create table if not exists public.system_logs (
    id uuid primary key default uuid_generate_v4(),
    timestamp timestamp with time zone default now(),
    level text not null check (level in ('INFO', 'WARN', 'ERROR', 'TRADE_SIGNAL')),
    source text not null, -- e.g. "CRON_EXECUTOR", "DHAN_ADAPTER", "DELTA_ADAPTER"
    message text not null,
    metadata jsonb default '{}'::jsonb
);

-- 6. Insert Default Strategies and Demo Accounts
insert into public.broker_accounts (broker_name, account_label, is_active, is_live)
values 
    ('DHAN', 'DhanHQ Indian Markets', true, false),
    ('DELTA', 'Delta Exchange Crypto', true, false),
    ('METATRADER', 'MetaTrader MT5 Terminal', true, false)
on conflict do nothing;

insert into public.strategies (name, broker_name, symbol, timeframe, strategy_type, is_active, paper_trading, parameters)
values
    ('Nifty 9/21 EMA Cross', 'DHAN', 'NIFTY', '5m', 'EMA_CROSSOVER', true, true, '{"fast_ema": 9, "slow_ema": 21}'),
    ('BTC Delta Supertrend', 'DELTA', 'BTCUSD', '1m', 'SUPERTREND', true, true, '{"period": 10, "multiplier": 3}'),
    ('EURUSD Scalper', 'METATRADER', 'EURUSD', '5m', 'RSI_REVERSAL', false, true, '{"period": 14, "oversold": 30, "overbought": 70}')
on conflict do nothing;

insert into public.system_logs (level, source, message, metadata)
values ('INFO', 'DATABASE_INIT', 'Supabase trading schema successfully initialized', '{"status": "ready"}'::jsonb);
