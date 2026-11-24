# 🚀 MyAlgo - Automated Trading Platform

A modern, multi-broker Algorithmic Trading Platform built with **Next.js 14**, **Supabase (PostgreSQL)**, and **Vercel Serverless**, supporting:
1. 🇮🇳 **Dhan (DhanHQ API)** - Indian Stock Market & F&O (Nifty, BankNifty, Equity)
2. 🪙 **Delta Exchange** - Crypto Derivatives (BTC, ETH Options & Futures)
3. 🌐 **MetaTrader 5 (MT5)** - Forex, Indices & Commodities via Local Windows Bridge

---

## 📁 Project Architecture

```
Myalgo/
├── mt5_bridge/
│   └── mt5_runner.py          # Windows MT5 local runner script
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── brokers/test/  # Test API credentials for brokers
│   │   │   ├── cron/          # Vercel Cron route (/api/cron/trade-cycle)
│   │   │   ├── strategies/    # Strategy controls & config
│   │   │   └── webhook/       # External signals / TradingView alerts
│   │   ├── brokers/           # Brokers management UI
│   │   ├── logs/              # Live audit logs UI
│   │   ├── strategies/        # Strategy toggle & risk settings UI
│   │   ├── globals.css        # Custom dark cyber financial styling
│   │   ├── layout.tsx         # Sidebar & navigation layout
│   │   └── page.tsx           # Main Trading Dashboard
│   ├── components/
│   │   └── Sidebar.tsx        # Navigation sidebar
│   └── lib/
│       ├── brokers/           # Dhan, Delta Exchange, MetaTrader adapters
│       ├── strategy/          # Technical indicators & execution engine
│       └── supabase.ts        # Supabase client & admin helper
├── supabase/
│   └── schema.sql             # Complete database schema & tables
├── .env.example               # Environment variables template
├── package.json
└── vercel.json                # Vercel Cron scheduler (Runs every 1 min)
```

---

## ⚡ Quick Start (Local Run)

### 1. Install & Run Dev Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view your dashboard.

---

## 🗄️ Supabase Database Setup

1. Create a free project at [supabase.com](https://supabase.com).
2. Go to the **SQL Editor** tab in your Supabase dashboard.
3. Open `supabase/schema.sql` from this project, paste the content into the SQL editor, and click **Run**.
4. Copy your **Project URL**, **Anon Key**, and **Service Role Key** from **Project Settings > API**.

---

## ☁️ Deploy to Vercel

1. Push your repository to GitHub:
   ```bash
   git add .
   git commit -m "Initial commit of MyAlgo platform"
   git branch -M main
   git remote add origin https://github.com/<your-username>/myalgo.git
   git push -u origin main
   ```
2. In [Vercel](https://vercel.com):
   - Click **Add New Project** and import your `myalgo` repository.
   - Add the environment variables from `.env.example`:
     - `NEXT_PUBLIC_SUPABASE_URL`
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
     - `SUPABASE_SERVICE_ROLE_KEY`
     - `CRON_SECRET`
     - `DHAN_CLIENT_ID` (optional, can also enter in dashboard)
     - `DHAN_ACCESS_TOKEN` (optional)
     - `DELTA_API_KEY` (optional)
     - `DELTA_API_SECRET` (optional)
   - Click **Deploy**!

Vercel will automatically configure the Cron Job specified in `vercel.json` (`/api/cron/trade-cycle`) to evaluate active strategies every minute.

---

## 💻 Running MetaTrader 5 (MT5) Bridge (Optional)

For MetaTrader 5 trades:
1. Ensure MetaTrader 5 desktop terminal is installed and logged in on your Windows PC.
2. Open terminal in `mt5_bridge`:
   ```bash
   cd mt5_bridge
   pip install MetaTrader5 supabase python-dotenv
   python mt5_runner.py
   ```
This listens to signals from your Supabase database and punches orders straight into your MT5 terminal.
