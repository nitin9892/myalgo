'use client';

import { useState, useEffect, useRef } from 'react';
import { 
  Eye, 
  Activity, 
  RefreshCw, 
  Maximize2, 
  Layers, 
  Zap, 
  Sliders, 
  Check, 
  TrendingUp, 
  TrendingDown, 
  ShieldCheck,
  Target,
  Sparkles,
  BarChart2
} from 'lucide-react';

interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface OrderBlock {
  candleIndex: number;
  type: 'BULLISH' | 'BEARISH';
  high: number;
  low: number;
  mitigated: boolean;
  formedAt: number;
}

interface FairValueGap {
  startIndex: number;
  type: 'BULLISH' | 'BEARISH';
  top: number;
  bottom: number;
  mitigated: boolean;
}

interface KeyLevels {
  pdh: number;
  pdl: number;
  pdc: number;
}

interface ActiveTrade {
  id: string;
  side: 'BUY' | 'SELL';
  entryPrice: number;
  currentPrice: number;
  stopLoss: number;
  takeProfit: number;
  unrealizedPnl: number;
  unrealizedPnlPct: number;
  setupName: string;
}

interface LiveChartViewerProps {
  initialSymbol?: string;
  className?: string;
}

export function LiveChartViewer({ initialSymbol = 'BTCUSD', className = '' }: LiveChartViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // View & Filter States
  const [mode, setMode] = useState<'BOT_VISION' | 'TRADINGVIEW'>('BOT_VISION');
  const [symbol, setSymbol] = useState<string>(initialSymbol.toUpperCase().replace('/', ''));
  const [timeframe, setTimeframe] = useState<'1m' | '5m' | '15m' | '1h'>('5m');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Toggles for Markings
  const [showOrderBlocks, setShowOrderBlocks] = useState(true);
  const [showFvgs, setShowFvgs] = useState(true);
  const [showKeyLevels, setShowKeyLevels] = useState(true);
  const [showBotTrades, setShowBotTrades] = useState(true);

  // Data from API
  const [candles, setCandles] = useState<Candle[]>([]);
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [orderBlocks, setOrderBlocks] = useState<OrderBlock[]>([]);
  const [fvgs, setFvgs] = useState<FairValueGap[]>([]);
  const [keyLevels, setKeyLevels] = useState<KeyLevels | null>(null);
  const [activeTrade, setActiveTrade] = useState<ActiveTrade | null>(null);
  const [aiContext, setAiContext] = useState<string>('');
  const [dataSource, setDataSource] = useState<string>('Delta Exchange India');
  const [hoveredCandle, setHoveredCandle] = useState<Candle | null>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);

  // Fetch Chart Data
  const fetchChartData = async (isSilent = false) => {
    if (!isSilent) setRefreshing(true);
    try {
      const res = await fetch(`/api/chart?symbol=${symbol}&timeframe=${timeframe}`);
      const data = await res.json();
      if (data.success) {
        setCandles(data.candles || []);
        setCurrentPrice(data.currentPrice || 0);
        setOrderBlocks(data.orderBlocks || []);
        setFvgs(data.fvgs || []);
        setKeyLevels(data.keyLevels || null);
        setActiveTrade(data.activeTrade || null);
        setAiContext(data.aiContext || '');
        if (data.dataSource) setDataSource(data.dataSource);
      }
    } catch (err) {
      console.warn('Live chart fetch error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchChartData();
    // Auto-refresh real market ticks every 5 seconds
    const interval = setInterval(() => {
      fetchChartData(true);
    }, 5000);
    return () => clearInterval(interval);
  }, [symbol, timeframe]);

  // Render Canvas Chart with AI Bot Markings
  useEffect(() => {
    if (mode !== 'BOT_VISION') return;
    const canvas = canvasRef.current;
    if (!canvas || candles.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle HiDPI Displays (Retina)
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;

    // Padding
    const padTop = 35;
    const padBottom = 30;
    const padRight = 75; // for price axis
    const padLeft = 15;

    const plotWidth = width - padLeft - padRight;
    const plotHeight = height - padTop - padBottom;

    // 1. Compute Min & Max Price across visible candles & levels
    let minPrice = Math.min(...candles.map((c) => c.low));
    let maxPrice = Math.max(...candles.map((c) => c.high));

    if (showKeyLevels && keyLevels) {
      if (keyLevels.pdh > 0) maxPrice = Math.max(maxPrice, keyLevels.pdh);
      if (keyLevels.pdl > 0) minPrice = Math.min(minPrice, keyLevels.pdl);
    }

    if (showBotTrades && activeTrade) {
      if (activeTrade.takeProfit > 0) maxPrice = Math.max(maxPrice, activeTrade.takeProfit);
      if (activeTrade.stopLoss > 0) minPrice = Math.min(minPrice, activeTrade.stopLoss);
    }

    // Add 5% headroom top and bottom
    const priceRange = maxPrice - minPrice || 1;
    const headroom = priceRange * 0.06;
    const chartMin = minPrice - headroom;
    const chartMax = maxPrice + headroom;
    const totalRange = chartMax - chartMin;

    const priceToY = (price: number) => {
      return padTop + plotHeight * (1 - (price - chartMin) / totalRange);
    };

    // Clear Canvas
    ctx.clearRect(0, 0, width, height);

    // 2. Draw Grid Lines & Price Axis
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(51, 65, 85, 0.25)';
    ctx.fillStyle = '#64748b';
    ctx.font = '10px monospace';
    ctx.textAlign = 'left';

    const gridSteps = 6;
    for (let i = 0; i <= gridSteps; i++) {
      const p = chartMin + (totalRange / gridSteps) * i;
      const y = priceToY(p);

      // Horizontal grid line
      ctx.beginPath();
      ctx.moveTo(padLeft, y);
      ctx.lineTo(width - padRight, y);
      ctx.stroke();

      // Price label on right axis
      ctx.fillText(`$${p.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`, width - padRight + 8, y + 3);
    }

    // Candle geometry
    const n = candles.length;
    const candleSpacing = plotWidth / n;
    const candleWidth = Math.max(2, candleSpacing * 0.7);

    // 3. Draw Fair Value Gaps (FVG) Behind Candles
    if (showFvgs && fvgs.length > 0) {
      for (const fvg of fvgs) {
        const topY = priceToY(fvg.top);
        const bottomY = priceToY(fvg.bottom);
        const boxHeight = Math.abs(bottomY - topY);
        const startX = padLeft + (fvg.startIndex / n) * plotWidth;

        ctx.fillStyle = fvg.type === 'BULLISH' ? 'rgba(245, 158, 11, 0.12)' : 'rgba(244, 63, 94, 0.12)';
        ctx.fillRect(startX, Math.min(topY, bottomY), width - padRight - startX, boxHeight);

        // FVG Border
        ctx.strokeStyle = fvg.type === 'BULLISH' ? 'rgba(245, 158, 11, 0.35)' : 'rgba(244, 63, 94, 0.35)';
        ctx.setLineDash([3, 3]);
        ctx.strokeRect(startX, Math.min(topY, bottomY), width - padRight - startX, boxHeight);
        ctx.setLineDash([]);

        // Label
        ctx.fillStyle = fvg.type === 'BULLISH' ? '#fbbf24' : '#fb7185';
        ctx.font = '9px monospace';
        ctx.fillText(`FVG ${fvg.type}`, startX + 4, Math.min(topY, bottomY) + 11);
      }
    }

    // 4. Draw Order Blocks (OB) Zones
    if (showOrderBlocks && orderBlocks.length > 0) {
      for (const ob of orderBlocks) {
        const topY = priceToY(ob.high);
        const bottomY = priceToY(ob.low);
        const boxHeight = Math.max(3, Math.abs(bottomY - topY));
        const startX = padLeft + (ob.candleIndex / n) * plotWidth;

        if (ob.type === 'BULLISH') {
          ctx.fillStyle = 'rgba(16, 185, 129, 0.16)';
          ctx.fillRect(startX, Math.min(topY, bottomY), width - padRight - startX, boxHeight);
          ctx.strokeStyle = 'rgba(16, 185, 129, 0.6)';
          ctx.lineWidth = 1.2;
          ctx.strokeRect(startX, Math.min(topY, bottomY), width - padRight - startX, boxHeight);

          ctx.fillStyle = '#34d399';
          ctx.font = 'bold 9px monospace';
          ctx.fillText(`+OB (Bullish Block)`, startX + 5, Math.min(topY, bottomY) + 12);
        } else {
          ctx.fillStyle = 'rgba(244, 63, 94, 0.16)';
          ctx.fillRect(startX, Math.min(topY, bottomY), width - padRight - startX, boxHeight);
          ctx.strokeStyle = 'rgba(244, 63, 94, 0.6)';
          ctx.lineWidth = 1.2;
          ctx.strokeRect(startX, Math.min(topY, bottomY), width - padRight - startX, boxHeight);

          ctx.fillStyle = '#f43f5e';
          ctx.font = 'bold 9px monospace';
          ctx.fillText(`-OB (Bearish Block)`, startX + 5, Math.min(topY, bottomY) + 12);
        }
      }
    }

    // 5. Draw Key Institutional Levels (PDH, PDL, PDC)
    if (showKeyLevels && keyLevels) {
      ctx.setLineDash([4, 4]);

      // PDH (Cyan Line)
      if (keyLevels.pdh > 0) {
        const pdhY = priceToY(keyLevels.pdh);
        ctx.strokeStyle = '#06b6d4';
        ctx.beginPath();
        ctx.moveTo(padLeft, pdhY);
        ctx.lineTo(width - padRight, pdhY);
        ctx.stroke();

        ctx.fillStyle = '#06b6d4';
        ctx.font = 'bold 9px monospace';
        ctx.fillText(`PDH $${keyLevels.pdh.toLocaleString()}`, width - padRight - 110, pdhY - 4);
      }

      // PDL (Amber Line)
      if (keyLevels.pdl > 0) {
        const pdlY = priceToY(keyLevels.pdl);
        ctx.strokeStyle = '#f59e0b';
        ctx.beginPath();
        ctx.moveTo(padLeft, pdlY);
        ctx.lineTo(width - padRight, pdlY);
        ctx.stroke();

        ctx.fillStyle = '#f59e0b';
        ctx.font = 'bold 9px monospace';
        ctx.fillText(`PDL $${keyLevels.pdl.toLocaleString()}`, width - padRight - 110, pdlY - 4);
      }

      // PDC (Slate Line)
      if (keyLevels.pdc > 0) {
        const pdcY = priceToY(keyLevels.pdc);
        ctx.strokeStyle = '#94a3b8';
        ctx.beginPath();
        ctx.moveTo(padLeft, pdcY);
        ctx.lineTo(width - padRight, pdcY);
        ctx.stroke();

        ctx.fillStyle = '#94a3b8';
        ctx.font = '9px monospace';
        ctx.fillText(`PDC $${keyLevels.pdc.toLocaleString()}`, width - padRight - 110, pdcY - 4);
      }

      ctx.setLineDash([]);
    }

    // 6. Draw Candlesticks
    candles.forEach((c, idx) => {
      const isBullish = c.close >= c.open;
      const x = padLeft + idx * candleSpacing + candleSpacing / 2;
      const openY = priceToY(c.open);
      const closeY = priceToY(c.close);
      const highY = priceToY(c.high);
      const lowY = priceToY(c.low);

      const color = isBullish ? '#10b981' : '#f43f5e';
      ctx.strokeStyle = color;
      ctx.fillStyle = color;

      // Wick
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, highY);
      ctx.lineTo(x, lowY);
      ctx.stroke();

      // Body
      const bodyTop = Math.min(openY, closeY);
      const bodyHeight = Math.max(2, Math.abs(closeY - openY));
      ctx.fillRect(x - candleWidth / 2, bodyTop, candleWidth, bodyHeight);
    });

    // 7. Draw Active Bot Trade Overlay (Entry, Stop Loss, Target)
    if (showBotTrades && activeTrade) {
      const entryY = priceToY(activeTrade.entryPrice);
      const slY = priceToY(activeTrade.stopLoss);
      const tpY = priceToY(activeTrade.takeProfit);

      // Entry Line (Solid Blue/Cyan)
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(padLeft, entryY);
      ctx.lineTo(width - padRight, entryY);
      ctx.stroke();

      // Entry Pill
      ctx.fillStyle = '#0284c7';
      ctx.fillRect(width - padRight - 150, entryY - 9, 140, 18);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px monospace';
      ctx.fillText(`▶ ${activeTrade.side} @ $${activeTrade.entryPrice}`, width - padRight - 145, entryY + 4);

      // Stop Loss Line (Red Dashed)
      ctx.strokeStyle = '#f43f5e';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(padLeft, slY);
      ctx.lineTo(width - padRight, slY);
      ctx.stroke();

      ctx.fillStyle = '#e11d48';
      ctx.fillRect(width - padRight - 120, slY - 8, 110, 16);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 9px monospace';
      ctx.fillText(`SL: $${activeTrade.stopLoss}`, width - padRight - 115, slY + 4);

      // Take Profit Line (Green Dashed)
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(padLeft, tpY);
      ctx.lineTo(width - padRight, tpY);
      ctx.stroke();

      ctx.fillStyle = '#059669';
      ctx.fillRect(width - padRight - 150, tpY - 8, 140, 16);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 9px monospace';
      ctx.fillText(`TP: $${activeTrade.takeProfit} (1:3.5 RR)`, width - padRight - 145, tpY + 4);

      ctx.setLineDash([]);
    }

    // 8. Live Real-Time Price Line & Pulsing Dot
    if (currentPrice > 0) {
      const liveY = priceToY(currentPrice);

      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(padLeft, liveY);
      ctx.lineTo(width - padRight, liveY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Pulsing Circle at right edge
      ctx.fillStyle = '#06b6d4';
      ctx.beginPath();
      ctx.arc(width - padRight - 4, liveY, 3.5, 0, Math.PI * 2);
      ctx.fill();

      // Current Price Tag on right axis
      ctx.fillStyle = '#0891b2';
      ctx.fillRect(width - padRight, liveY - 10, padRight - 2, 20);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px monospace';
      ctx.fillText(`$${currentPrice.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`, width - padRight + 6, liveY + 4);
    }

    // 9. Crosshair Tooltip
    if (hoverPos && hoveredCandle) {
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.5)';
      ctx.setLineDash([3, 3]);
      ctx.lineWidth = 1;

      // Vertical crosshair
      ctx.beginPath();
      ctx.moveTo(hoverPos.x, padTop);
      ctx.lineTo(hoverPos.x, height - padBottom);
      ctx.stroke();

      // Horizontal crosshair
      ctx.beginPath();
      ctx.moveTo(padLeft, hoverPos.y);
      ctx.lineTo(width - padRight, hoverPos.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }, [candles, currentPrice, orderBlocks, fvgs, keyLevels, activeTrade, showOrderBlocks, showFvgs, showKeyLevels, showBotTrades, hoverPos, hoveredCandle, mode]);

  // Handle Mouse Move for Crosshair
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || candles.length === 0) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const padLeft = 15;
    const padRight = 75;
    const plotWidth = rect.width - padLeft - padRight;

    if (x >= padLeft && x <= rect.width - padRight) {
      const relX = x - padLeft;
      const index = Math.floor((relX / plotWidth) * candles.length);
      const clamped = Math.max(0, Math.min(candles.length - 1, index));
      setHoveredCandle(candles[clamped]);
      setHoverPos({ x, y });
    } else {
      setHoveredCandle(null);
      setHoverPos(null);
    }
  };

  const handleMouseLeave = () => {
    setHoveredCandle(null);
    setHoverPos(null);
  };

  // Map symbol to TradingView symbol
  const getTradingViewSymbol = () => {
    const s = symbol.replace('USD', '').replace('USDT', '');
    return `BINANCE:${s}USDT`;
  };

  return (
    <div className={`p-4 sm:p-6 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-2xl backdrop-blur-xl space-y-4 ${className}`}>
      {/* Top Header Ribbon */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-3 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <h2 className="text-base sm:text-lg font-bold text-white tracking-wide flex items-center gap-2">
              <Eye className="w-5 h-5 text-cyan-400" />
              Live Bot Vision & Delta Chart
            </h2>
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] font-mono font-bold">
              {dataSource}
            </span>
            {activeTrade && (
              <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-[10px] font-mono font-bold animate-pulse">
                🎯 {activeTrade.side} ACTIVE ({activeTrade.unrealizedPnlPct}%)
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Real-time visualization of live market candles with automatic SMC/ICT structure, Order Blocks, FVGs, and bot execution markers.
          </p>
        </div>

        {/* View Mode Toggle & Quick Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Mode Switcher */}
          <div className="flex items-center p-1 rounded-xl bg-slate-950 border border-slate-800 text-xs">
            <button
              type="button"
              onClick={() => setMode('BOT_VISION')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                mode === 'BOT_VISION'
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 shadow-md font-black'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              Bot Vision (AI Markings)
            </button>
            <button
              type="button"
              onClick={() => setMode('TRADINGVIEW')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                mode === 'TRADINGVIEW'
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-slate-950 shadow-md font-black'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <BarChart2 className="w-3.5 h-3.5" />
              TradingView Pro
            </button>
          </div>

          <button
            type="button"
            onClick={() => fetchChartData()}
            disabled={refreshing}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all border border-slate-700"
            title="Refresh Live Market Data"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Control Bar: Instrument Selector, Timeframes, and Marking Layer Toggles */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs bg-slate-950/80 p-2.5 rounded-2xl border border-slate-800">
        {/* Left: Coin Selectors */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {[
            { id: 'BTCUSD', label: 'BTC/USD' },
            { id: 'ETHUSD', label: 'ETH/USD' },
            { id: 'SOLUSD', label: 'SOL/USD' },
            { id: 'XRPUSD', label: 'XRP/USD' },
          ].map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setSymbol(c.id)}
              className={`px-3 py-1.5 rounded-xl font-mono font-bold text-xs transition-all border ${
                symbol === c.id
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500 shadow-sm'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700'
              }`}
            >
              {c.label}
            </button>
          ))}

          <div className="h-4 w-px bg-slate-800 mx-1 hidden sm:block" />

          {/* Timeframes */}
          {(['1m', '5m', '15m', '1h'] as const).map((tf) => (
            <button
              key={tf}
              type="button"
              onClick={() => setTimeframe(tf)}
              className={`px-2.5 py-1 rounded-lg font-mono text-[11px] font-bold border ${
                timeframe === tf
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700'
              }`}
            >
              {tf}
            </button>
          ))}
        </div>

        {/* Right: Layer Toggles (Only relevant in Bot Vision mode) */}
        {mode === 'BOT_VISION' && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => setShowOrderBlocks(!showOrderBlocks)}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all ${
                showOrderBlocks
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                  : 'bg-slate-900 text-slate-500 border-slate-800'
              }`}
            >
              ✓ Order Blocks
            </button>
            <button
              type="button"
              onClick={() => setShowFvgs(!showFvgs)}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all ${
                showFvgs
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                  : 'bg-slate-900 text-slate-500 border-slate-800'
              }`}
            >
              ✓ FVGs
            </button>
            <button
              type="button"
              onClick={() => setShowKeyLevels(!showKeyLevels)}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all ${
                showKeyLevels
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50'
                  : 'bg-slate-900 text-slate-500 border-slate-800'
              }`}
            >
              ✓ PDH/PDL
            </button>
            <button
              type="button"
              onClick={() => setShowBotTrades(!showBotTrades)}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all ${
                showBotTrades
                  ? 'bg-blue-500/20 text-blue-300 border-blue-500/50'
                  : 'bg-slate-900 text-slate-500 border-slate-800'
              }`}
            >
              ✓ Bot Targets
            </button>
          </div>
        )}
      </div>

      {/* Candlestick OHLC Header Bar (When Hovered) */}
      {hoveredCandle && (
        <div className="flex items-center gap-3 text-xs font-mono px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 overflow-x-auto">
          <span className="text-white font-bold">{new Date(hoveredCandle.timestamp).toLocaleTimeString()}</span>
          <span>O: <strong className="text-white">${hoveredCandle.open}</strong></span>
          <span>H: <strong className="text-emerald-400">${hoveredCandle.high}</strong></span>
          <span>L: <strong className="text-rose-400">${hoveredCandle.low}</strong></span>
          <span>C: <strong className={hoveredCandle.close >= hoveredCandle.open ? 'text-emerald-400' : 'text-rose-400'}>${hoveredCandle.close}</strong></span>
          <span>Vol: <strong className="text-slate-300">{hoveredCandle.volume.toFixed(1)}</strong></span>
        </div>
      )}

      {/* Main Chart Canvas Area */}
      <div ref={containerRef} className="relative w-full h-[430px] rounded-2xl bg-slate-950 border border-slate-850 overflow-hidden shadow-inner">
        {mode === 'BOT_VISION' ? (
          <>
            <canvas
              ref={canvasRef}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
              className="w-full h-full cursor-crosshair block"
            />
            {loading && (
              <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center gap-2 text-cyan-400 text-xs">
                <RefreshCw className="w-6 h-6 animate-spin" />
                <span>Streaming Live Candles from Delta Exchange...</span>
              </div>
            )}
          </>
        ) : (
          <iframe
            key={`${symbol}-${timeframe}`}
            src={`https://s.tradingview.com/widgetembed/?frameElementId=tradingview_widget&symbol=${getTradingViewSymbol()}&interval=${timeframe === '1m' ? '1' : timeframe === '15m' ? '15' : timeframe === '1h' ? '60' : '5'}&hidesidetoolbar=0&symboledit=1&saveimage=1&toolbarbg=0f172a&theme=dark&style=1&timezone=Asia%2FKolkata&withdateranges=1&studies=[]&show_popup_button=1`}
            className="w-full h-full border-0"
            title="TradingView Real-Time Chart"
          />
        )}
      </div>

      {/* Bottom Live AI Intelligence Bar */}
      <div className="p-3.5 rounded-2xl bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border border-slate-800 flex items-center justify-between gap-3 text-xs shadow-md">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/15 flex items-center justify-center text-emerald-400 shrink-0">
            <Zap className="w-4 h-4 animate-pulse" />
          </div>
          <div className="min-w-0">
            <span className="font-bold text-white text-[11px] block">AI BOT TELEMETRY & PATTERN SCANNER:</span>
            <span className="text-slate-400 font-mono text-[11px] truncate block">
              {aiContext || 'Scanning candles for SMC Liquidity Sweeps, Fair Value Gaps and Order Blocks...'}
            </span>
          </div>
        </div>

        <div className="shrink-0 flex items-center gap-2">
          <span className="text-[10px] font-mono font-bold text-cyan-400 px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/20">
            1:3.5 RR RATIO
          </span>
        </div>
      </div>
    </div>
  );
}
