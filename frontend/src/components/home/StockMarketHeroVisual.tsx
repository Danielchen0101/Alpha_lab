import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircleOutlined, LoadingOutlined, ArrowUpOutlined, ArrowDownOutlined, ThunderboltOutlined, LineChartOutlined, BarChartOutlined, SafetyCertificateOutlined } from '@ant-design/icons';

const tickers = [
  { sym: 'NVDA', p: '1,037.89', c: '+3.42%', up: true, path: 'M0 16 Q10 10 20 12 T40 2' },
  { sym: 'TSLA', p: '172.34', c: '-1.18%', up: false, path: 'M0 2 Q10 8 20 6 T40 16' },
  { sym: 'AAPL', p: '195.42', c: '+1.27%', up: true, path: 'M0 12 Q10 14 20 8 T40 4' },
  { sym: 'MSFT', p: '430.16', c: '+0.88%', up: true, path: 'M0 14 Q10 10 20 12 T40 6' },
  { sym: 'AMD', p: '164.21', c: '+2.14%', up: true, path: 'M0 16 Q10 8 20 10 T40 2' },
];

const TopTickerCard = ({ symbol, price, change, up, delay, path }: any) => (
  <motion.div
    initial={{ opacity: 0, y: 15 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, delay, ease: "easeOut" }}
    className="top-ticker-card"
  >
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
      <span style={{ fontWeight: 800, color: '#f8fafc', fontSize: '11px' }}>{symbol}</span>
      <span style={{ color: up ? '#10b981' : '#ef4444', fontSize: '10px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 2 }}>
        {up ? <ArrowUpOutlined /> : <ArrowDownOutlined />} {change}
      </span>
    </div>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
      <span style={{ fontSize: '14px', fontWeight: 700, color: '#e2e8f0' }}>{price}</span>
      <svg width="30" height="12" viewBox="0 0 40 16">
        <path d={path} fill="none" stroke={up ? '#10b981' : '#ef4444'} strokeWidth="1.5" />
      </svg>
    </div>
  </motion.div>
);

const SignalRow = ({ sym, signal, score, type }: any) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontWeight: 700, color: '#f8fafc', fontSize: 12, width: 44 }}>{sym}</span>
      <span style={{ fontSize: 11, color: '#94a3b8' }}>{type}</span>
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: signal === 'BUY' ? '#10b981' : signal === 'WATCH' ? '#f59e0b' : '#ef4444' }}>{signal}</span>
      <span style={{ fontSize: 12, color: '#e2e8f0', background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: 4, whiteSpace: 'nowrap' }}>{score}</span>
    </div>
  </div>
);

const SectorRow = ({ name, perf, up }: any) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
    <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>{name}</span>
    <span style={{ fontSize: 12, fontWeight: 700, color: up ? '#10b981' : '#ef4444' }}>{perf}</span>
  </div>
);

const TradeRow = ({ sym, side, size, price, time }: any) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: side === 'BUY' ? '#10b981' : '#ef4444', background: side === 'BUY' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', padding: '2px 6px', borderRadius: 4 }}>{side}</span>
      <span style={{ fontWeight: 700, color: '#f8fafc', fontSize: 13 }}>{sym}</span>
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <span style={{ fontSize: 12, color: '#cbd5e1' }}>{size}</span>
      <span style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0', width: 60, textAlign: 'right' }}>{price}</span>
      <span style={{ fontSize: 11, color: '#64748b' }}>{time}</span>
    </div>
  </div>
);

const StockMarketHeroVisual: React.FC = () => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div className="stock-visual-container" style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <style>{`
        .stock-visual-container {
          max-height: calc(100vh - 150px);
          overflow: hidden;
        }
        .glass-panel {
          background: rgba(15, 23, 42, 0.75);
          border: 1px solid rgba(148, 163, 184, 0.1);
          border-radius: 16px;
          padding: 14px;
          transition: transform 220ms ease, border-color 220ms ease, box-shadow 220ms ease;
        }
        .glass-panel:hover {
          border-color: rgba(24, 144, 255, 0.3);
          box-shadow: 0 4px 20px rgba(0,0,0,0.3), 0 0 10px rgba(24, 144, 255, 0.1);
          transform: translateY(-2px);
        }
        
        .top-ticker-card {
          flex: 1;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.04);
          border-radius: 12px;
          padding: 6px 10px;
          transition: transform 220ms ease, border-color 220ms ease, background 220ms ease;
        }
        .top-ticker-card:hover {
          background: rgba(24, 144, 255, 0.04);
          border-color: rgba(24, 144, 255, 0.2);
          transform: translateY(-2px);
        }

        .workflow-step {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.04);
          border-radius: 10px;
          padding: 8px 10px;
          margin-bottom: 6px;
          transition: border-color 220ms ease, background 220ms ease;
        }
        .workflow-step:hover {
          background: rgba(24, 144, 255, 0.04);
          border-color: rgba(24, 144, 255, 0.15);
        }
        .status-chip {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 0.7rem;
          font-weight: 600;
          background: rgba(24, 144, 255, 0.1);
          color: #1890ff;
          border: 1px solid rgba(24, 144, 255, 0.15);
        }
        .status-chip.success {
          background: rgba(34, 197, 94, 0.1);
          color: #4ade80;
          border-color: rgba(34, 197, 94, 0.15);
        }
        .svg-chart-path {
          stroke-dasharray: 1000;
          stroke-dashoffset: 1000;
          animation: drawChart 2.5s ease-out forwards;
        }
        @keyframes drawChart {
          to { stroke-dashoffset: 0; }
        }
        
        .ticker-tape-container {
          width: 100%;
          overflow: hidden;
          background: rgba(2, 6, 17, 0.3);
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.03);
          padding: 6px 0;
          display: flex;
          white-space: nowrap;
          position: relative;
          contain: strict;
        }
        .ticker-tape {
          display: flex;
          gap: 40px;
          animation: slideTicker 60s linear infinite;
          will-change: transform;
        }
        .ticker-tape:hover {
          animation-play-state: paused;
        }
        @keyframes slideTicker {
          0% { transform: translate3d(0, 0, 0); }
          100% { transform: translate3d(-50%, 0, 0); }
        }

        @media (prefers-reduced-motion: reduce) {
          .ticker-tape { animation: none; transform: none; }
          .svg-chart-path { animation: none; stroke-dashoffset: 0; }
          .pulse-indicator { animation: none !important; opacity: 1; }
        }

        @media (max-width: 768px) {
          .stock-visual-container {
            padding: 4px;
            gap: 4px;
          }
          /* Hide non-essential panels to keep it ultra compact */
          .glass-panel:nth-child(n+3) {
            display: none !important;
          }
          /* Hide secondary tickers */
          .top-ticker-card:nth-child(n+2) {
            display: none !important;
          }
          /* Make remaining card fit */
          .top-ticker-card {
            width: 100%;
          }
          .ticker-row {
            gap: 4px;
          }
          .main-chart-area {
            height: 120px;
          }
          /* Hide the execution feed on mobile */
          .glass-panel.live-executions {
            display: none !important;
          }
          /* Hide bottom ticker tape on mobile */
          .ticker-tape-container {
            display: none !important;
          }
        }
      `}</style>
      
      {/* Top Status Bar — inside dashboard frame */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className="pulse-indicator" aria-hidden="true" style={{ width: 6, height: 6 }}></div>
          <span style={{ fontSize: 10, color: '#4ade80', fontWeight: 600, letterSpacing: 0.3 }}>AI PIPELINE ACTIVE</span>
          <span style={{ fontSize: 10, color: '#64748b' }}>|</span>
          <span style={{ fontSize: 10, color: '#94a3b8' }}>Risk Engine Online · 42ms</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ThunderboltOutlined aria-hidden="true" style={{ color: '#4ade80', fontSize: 11 }} />
          <span style={{ fontSize: 10, color: '#4ade80', fontWeight: 700 }}>NVDA</span>
          <span style={{ fontSize: 10, color: '#4ade80', fontWeight: 800, background: 'rgba(16,185,129,0.1)', padding: '2px 6px', borderRadius: 4 }}>BUY</span>
          <span style={{ fontSize: 10, color: '#94a3b8' }}>92.4%</span>
        </div>
      </div>

      {/* Top Ticker Row */}
      <div style={{ display: 'flex', gap: '12px' }}>
        {tickers.slice(0, 5).map((t, i) => (
          <TopTickerCard key={i} symbol={t.sym} price={t.p} change={t.c} up={t.up} delay={i * 0.1} path={t.path} />
        ))}
      </div>

      <div style={{ display: 'flex', gap: '10px', flex: 1 }}>
        {/* Left: AI Orchestrator & Top Signals */}
        <div style={{ flex: 0.9, display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div className="glass-panel" style={{ padding: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
              <span style={{ fontSize: '11px', color: '#94a3b8', letterSpacing: '1px', fontWeight: 600, textTransform: 'uppercase' }}><ThunderboltOutlined aria-hidden="true" /> AI Agent Pipeline</span>
            </div>
            
            <div className="workflow-step">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ color: '#e2e8f0', fontWeight: 600, fontSize: 13 }}>Global Market Scan</span>
                <span className="status-chip success"><CheckCircleOutlined aria-hidden="true" /> Done</span>
              </div>
              <div style={{ fontSize: 11, color: '#64748b' }}>Processed 8,421 Equities</div>
            </div>
            
            <div className="workflow-step">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ color: '#e2e8f0', fontWeight: 600, fontSize: 13 }}>Signal Validation</span>
                <span className="status-chip"><LoadingOutlined aria-hidden="true" style={{ marginRight: 4 }}/> Active</span>
              </div>
              <div style={{ height: 3, background: 'rgba(255,255,255,0.05)', borderRadius: 2, overflow: 'hidden', marginTop: 8 }}>
                <motion.div 
                  initial={{ width: 0 }} animate={{ width: mounted ? '65%' : 0 }} transition={{ duration: 1.5, ease: "easeOut" }}
                  style={{ height: '100%', background: 'linear-gradient(90deg, #1890ff, #60a5fa)', borderRadius: 2 }} 
                />
              </div>
            </div>
          </div>

          <div className="glass-panel" style={{ flex: 1, padding: 10, display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: '11px', color: '#94a3b8', letterSpacing: '1px', fontWeight: 600, textTransform: 'uppercase', marginBottom: 12 }}><BarChartOutlined aria-hidden="true" /> Top Signals</div>
            <SignalRow sym="NVDA" type="Momentum Breakout" signal="BUY" score="92" />
            <SignalRow sym="TSLA" type="Mean Reversion" signal="WATCH" score="64" />
            <SignalRow sym="AAPL" type="Trend Continuation" signal="BUY" score="85" />
            <SignalRow sym="MSFT" type="Earnings Momentum" signal="WATCH" score="72" />
          </div>
        </div>

        {/* Middle: Chart & Portfolio Grid */}
        <div style={{ flex: 1.6, display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div className="glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '10px 14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
              <div>
                <div style={{ fontSize: '11px', color: '#94a3b8', letterSpacing: '1px', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}><LineChartOutlined aria-hidden="true" /> Equity Curve Preview</div>
                <div style={{ color: '#f8fafc', fontSize: 22, fontWeight: 800 }}>$1.24M <span style={{ fontSize: 13, color: '#10b981', fontWeight: 600, marginLeft: 8 }}>+28.4% YTD</span></div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 600, background: 'rgba(24,144,255,0.15)', color: '#60a5fa', padding: '4px 10px', borderRadius: 4 }}>YTD</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', padding: '4px 10px', borderRadius: 4 }}>1M</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', padding: '4px 10px', borderRadius: 4 }}>1W</span>
              </div>
            </div>

            <div className="equity-chart-area" style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', marginTop: 6, minHeight: 90 }}>
              <svg width="100%" height="100%" viewBox="0 0 500 160" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#1890ff" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#1890ff" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {mounted && (
                  <>
                    <path d="M 0 130 C 100 130, 150 80, 250 100 C 350 120, 400 40, 500 20 L 500 160 L 0 160 Z" fill="url(#chartGrad)" />
                    <path className="svg-chart-path" d="M 0 130 C 100 130, 150 80, 250 100 C 350 120, 400 40, 500 20" fill="none" stroke="#1890ff" strokeWidth="2.5" />
                  </>
                )}
              </svg>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '8px' }}>
             <div className="glass-panel" style={{ padding: '6px 8px' }}>
               <div style={{ color: '#64748b', fontSize: 9, textTransform: 'uppercase', marginBottom: 2, fontWeight: 600 }}>Win Rate</div>
               <div style={{ color: '#f8fafc', fontSize: 14, fontWeight: 800 }}>68.2%</div>
             </div>
             <div className="glass-panel" style={{ padding: '6px 8px' }}>
               <div style={{ color: '#64748b', fontSize: 9, textTransform: 'uppercase', marginBottom: 2, fontWeight: 600 }}>Max Drawdown</div>
               <div style={{ color: '#ef4444', fontSize: 14, fontWeight: 800 }}>-4.1%</div>
             </div>
             <div className="glass-panel" style={{ padding: '6px 8px' }}>
               <div style={{ color: '#64748b', fontSize: 9, textTransform: 'uppercase', marginBottom: 2, fontWeight: 600 }}>Risk Exposure</div>
               <div style={{ color: '#f8fafc', fontSize: 14, fontWeight: 800 }}>Low</div>
             </div>
             <div className="glass-panel" style={{ padding: '6px 8px' }}>
               <div style={{ color: '#64748b', fontSize: 9, textTransform: 'uppercase', marginBottom: 2, fontWeight: 600 }}>Sharpe Ratio</div>
               <div style={{ color: '#10b981', fontSize: 14, fontWeight: 800 }}>2.45</div>
             </div>
          </div>
        </div>

        {/* Right: Market Pulse & Sector */}
        <div style={{ flex: 1.2, display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div className="glass-panel" style={{ padding: 12 }}>
             <div style={{ fontSize: '11px', color: '#94a3b8', letterSpacing: '1px', fontWeight: 600, textTransform: 'uppercase', marginBottom: 12 }}><LineChartOutlined aria-hidden="true" /> Market Pulse</div>
             <div style={{ marginBottom: 12 }}>
               <div style={{ color: '#e2e8f0', fontSize: 13, fontWeight: 700, marginBottom: 2 }}>S&P 500</div>
               <div style={{ color: '#10b981', fontSize: 15, fontWeight: 800 }}>5,286.10 <span style={{ fontSize: 11, fontWeight: 600 }}>+0.63%</span></div>
             </div>
             <div style={{ marginBottom: 12 }}>
               <div style={{ color: '#e2e8f0', fontSize: 13, fontWeight: 700, marginBottom: 2 }}>Nasdaq 100</div>
               <div style={{ color: '#10b981', fontSize: 15, fontWeight: 800 }}>18,342.50 <span style={{ fontSize: 11, fontWeight: 600 }}>+1.12%</span></div>
             </div>
             <div>
               <div style={{ color: '#e2e8f0', fontSize: 13, fontWeight: 700, marginBottom: 2 }}>VIX</div>
               <div style={{ color: '#ef4444', fontSize: 15, fontWeight: 800 }}>13.42 <span style={{ fontSize: 11, fontWeight: 600 }}>-2.1%</span></div>
             </div>
          </div>

          <div className="glass-panel" style={{ flex: 1, padding: 10 }}>
             <div style={{ fontSize: '11px', color: '#94a3b8', letterSpacing: '1px', fontWeight: 600, textTransform: 'uppercase', marginBottom: 12 }}><SafetyCertificateOutlined aria-hidden="true" /> Sector Perf</div>
             <SectorRow name="Technology" perf="+2.1%" up={true} />
             <SectorRow name="Communications" perf="+1.4%" up={true} />
             <SectorRow name="Healthcare" perf="-0.8%" up={false} />
             <SectorRow name="Energy" perf="-1.2%" up={false} />
          </div>
        </div>
      </div>
      
      {/* Bottom Wide Panel: Live Executions */}
      <div
        className="glass-panel live-executions"
        style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 4 }}
      >
         <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
           <span style={{ fontSize: '11px', color: '#94a3b8', letterSpacing: '1px', fontWeight: 600, textTransform: 'uppercase' }}>Live Executions Feed</span>
           <span className="status-chip success"><CheckCircleOutlined aria-hidden="true" /> Auto-Routing</span>
         </div>
         <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
            <TradeRow sym="NVDA" side="BUY" size="140 shares" price="$1,037.89" time="12ms ago" />
            <TradeRow sym="TSLA" side="SELL" size="500 shares" price="$172.34" time="1s ago" />
            <TradeRow sym="AMD" side="BUY" size="350 shares" price="$164.21" time="2.4s ago" />
         </div>
      </div>

      {/* Bottom Ticker Tape */}
      <div>
        <div className="ticker-tape-container">
           <div className="ticker-tape">
              {[...tickers, ...tickers, ...tickers].map((t, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: '#94a3b8', fontWeight: 600, fontSize: 11 }}>{t.sym}</span>
                  <span style={{ color: '#f8fafc', fontWeight: 700, fontSize: 11 }}>{t.p}</span>
                  <span style={{ color: t.up ? '#10b981' : '#ef4444', fontWeight: 700, fontSize: 11 }}>{t.c}</span>
                </div>
              ))}
           </div>
        </div>
      </div>

    </div>
  );
};

export default StockMarketHeroVisual;