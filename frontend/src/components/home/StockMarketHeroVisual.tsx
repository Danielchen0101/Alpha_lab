import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowUpOutlined, ArrowDownOutlined,
  LineChartOutlined, BarChartOutlined, SafetyCertificateOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { useLanguage } from '../../contexts/LanguageContext';

const tickers = [
  { sym: 'NVDA', p: '1,037.89', c: '+3.42%', up: true, path: 'M0 16 Q10 10 20 12 T40 2' },
  { sym: 'TSLA', p: '172.34', c: '-1.18%', up: false, path: 'M0 2 Q10 8 20 6 T40 16' },
  { sym: 'AAPL', p: '195.42', c: '+1.27%', up: true, path: 'M0 12 Q10 14 20 8 T40 4' },
  { sym: 'MSFT', p: '430.16', c: '+0.88%', up: true, path: 'M0 14 Q10 10 20 12 T40 6' },
  { sym: 'AMD', p: '164.21', c: '+2.14%', up: true, path: 'M0 16 Q10 8 20 10 T40 2' },
];

/* ── Research signal row ── */
const ResearchSignalRow = ({ sym, typeLabel, confidence, status, statusColor, buyLabel, watchLabel }: any) => (
  <div style={{
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,0.03)',
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <span style={{ fontWeight: 800, color: '#f1f5f9', fontSize: 12, width: 44 }}>{sym}</span>
      <span style={{ fontSize: 11, color: '#64748b' }}>{typeLabel}</span>
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <span style={{
        fontSize: 11, fontWeight: 700,
        color: statusColor || '#10b981',
        background: `${statusColor || '#10b981'}15`,
        padding: '3px 10px', borderRadius: 8,
        border: `1px solid ${statusColor || '#10b981'}25`,
      }}>
        {status}
      </span>
      <span style={{ fontSize: 12, color: '#e2e8f0', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>
        {confidence}%
      </span>
    </div>
  </div>
);

/* ── Research feed row ── */
const ResearchFeedRow = ({ sym, signal, time, status }: any) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ fontWeight: 700, color: '#f1f5f9', fontSize: 11 }}>{sym}</span>
      <span style={{ fontSize: 10, color: '#64748b' }}>{signal}</span>
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <span style={{ fontSize: 9, color: '#4ade80', fontWeight: 700, background: 'rgba(16,185,129,0.1)', padding: '2px 8px', borderRadius: 8, border: '1px solid rgba(16,185,129,0.15)' }}>
        {status}
      </span>
      <span style={{ fontSize: 10, color: '#475569', width: 44, textAlign: 'right' }}>{time}</span>
    </div>
  </div>
);

const TopTickerCard = ({ symbol, price, change, up, delay, path }: any) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4, delay, ease: "easeOut" }}
    className="top-ticker-card"
  >
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
      <span style={{ fontWeight: 800, color: '#f1f5f9', fontSize: 11, letterSpacing: '0.02em' }}>{symbol}</span>
      <span style={{ color: up ? '#10b981' : '#ef4444', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 2 }}>
        {up ? <ArrowUpOutlined /> : <ArrowDownOutlined />} {change}
      </span>
    </div>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
      <span style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0' }}>{price}</span>
      <svg width="28" height="10" viewBox="0 0 40 16">
        <path d={path} fill="none" stroke={up ? '#10b981' : '#ef4444'} strokeWidth="1.5" />
      </svg>
    </div>
  </motion.div>
);

const StockMarketHeroVisual: React.FC = () => {
  const { t } = useLanguage();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div className="stock-visual-container" style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <style>{`
        .stock-visual-container {
          max-height: calc(100vh - 150px);
          overflow: hidden;
        }
        .glass-panel {
          background: rgba(12, 20, 38, 0.7);
          border: 1px solid rgba(148, 163, 184, 0.07);
          border-radius: 14px;
          padding: 12px 14px;
          transition: border-color 200ms ease;
        }
        .glass-panel:hover { border-color: rgba(148, 163, 184, 0.15); }

        .top-ticker-card {
          flex: 1;
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.04);
          border-radius: 10px;
          padding: 6px 10px;
          transition: border-color 200ms ease, background 200ms ease;
        }
        .top-ticker-card:hover {
          background: rgba(24,144,255,0.04);
          border-color: rgba(24,144,255,0.15);
        }

        .status-chip {
          display: inline-flex; align-items: center; gap: 4px;
          padding: 2px 8px; border-radius: 10px;
          font-size: 0.65rem; font-weight: 600;
          background: rgba(24,144,255,0.08);
          color: #60a5fa;
          border: 1px solid rgba(24,144,255,0.1);
        }
        .status-chip.success {
          background: rgba(34,197,94,0.08);
          color: #4ade80;
          border-color: rgba(34,197,94,0.1);
        }

        .svg-chart-path {
          stroke-dasharray: 1000; stroke-dashoffset: 1000;
          animation: riDrawChart 2.5s ease-out forwards;
        }
        @keyframes riDrawChart { to { stroke-dashoffset: 0; } }

        @media (max-width: 768px) {
          .stock-visual-container { padding: 4px; gap: 4px; }
          .glass-panel { padding: 8px 10px; }
          .top-ticker-card:nth-child(n+3) { display: none; }
        }
        @media (prefers-reduced-motion: reduce) {
          .svg-chart-path { animation: none; stroke-dashoffset: 0; }
        }
      `}</style>

      {/* ── Top Status Bar ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className="pulse-indicator" style={{
            width: 6, height: 6, borderRadius: '50%',
            background: '#10b981', boxShadow: '0 0 8px rgba(16,185,129,0.6)',
          }}></div>
          <span style={{ fontSize: 10, color: '#4ade80', fontWeight: 700, letterSpacing: '0.05em' }}>
            {t.landing.dashPreviewStatus || 'Research Engine Online'}
          </span>
          <span style={{ color: 'rgba(148,163,184,0.2)', fontSize: 10 }}>|</span>
          <span style={{ fontSize: 9, color: '#64748b', fontWeight: 600 }}>Model: Alpha-V4</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ fontSize: 9, color: '#64748b' }}>
            {t.landing.dashPreviewProcessed || 'Coverage: 8,421 equities'}
          </span>
          <span style={{ fontSize: 9, color: '#60a5fa', fontWeight: 700, background: 'rgba(96,165,250,0.08)', padding: '2px 8px', borderRadius: 8, border: '1px solid rgba(96,165,250,0.12)' }}>
            <SafetyCertificateOutlined style={{ fontSize: 8, marginRight: 3 }} />
            {t.landing.dashPreviewRisk || 'Risk Layer Active'}
          </span>
        </div>
      </div>

      {/* ── Ticker Row ── */}
      <div style={{ display: 'flex', gap: 8 }}>
        {tickers.map((t, i) => (
          <TopTickerCard key={i} symbol={t.sym} price={t.p} change={t.c} up={t.up} delay={i * 0.08} path={t.path} />
        ))}
      </div>

      {/* ── Main Grid: Signal Queue | Equity Curve ── */}
      <div style={{ display: 'flex', gap: 10, flex: 1, minHeight: 0 }}>
        {/* Left: Signal Research Queue */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div className="glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 9, color: '#64748b', letterSpacing: '1.5px', fontWeight: 700, textTransform: 'uppercase', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 5 }}>
              <BarChartOutlined style={{ fontSize: 10 }} /> {t.landing.dashPreviewTopSignals || 'Signal Research Queue'}
            </div>
            <ResearchSignalRow
              sym="NVDA" typeLabel={t.landing.dashPreviewMomentum} confidence="92"
              status={t.landing.dashPreviewStatus2 || 'Backtest Passed'} statusColor="#10b981"
            />
            <ResearchSignalRow
              sym="AAPL" typeLabel={t.landing.dashPreviewTrendContinuation} confidence="85"
              status={t.landing.dashPreviewBuy || 'Validated'} statusColor="#60a5fa"
            />
            <ResearchSignalRow
              sym="MSFT" typeLabel={t.landing.dashPreviewEarningsMomentum} confidence="78"
              status={t.landing.dashPreviewStatus3 || 'Risk Check OK'} statusColor="#10b981"
            />
            <ResearchSignalRow
              sym="TSLA" typeLabel={t.landing.dashPreviewMeanReversion} confidence="64"
              status={t.landing.dashPreviewWatch || 'Watch'} statusColor="#f59e0b"
            />
          </div>
        </div>

        {/* Right: Equity Curve + Risk Framework */}
        <div style={{ flex: 1.3, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 9, color: '#64748b', letterSpacing: '1.5px', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <LineChartOutlined style={{ fontSize: 10 }} /> {t.landing.dashPreviewEquityCurve || 'Equity Curve'}
                </div>
                <div style={{ color: '#f8fafc', fontSize: 20, fontWeight: 800, letterSpacing: '-0.01em' }}>
                  $1.24M <span style={{ fontSize: 12, color: '#10b981', fontWeight: 700, marginLeft: 4 }}>+28.4%</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                {['YTD', '1M', '1W'].map((p, i) => (
                  <span key={p} style={{
                    fontSize: 9, fontWeight: i === 0 ? 700 : 600,
                    background: i === 0 ? 'rgba(24,144,255,0.12)' : 'transparent',
                    color: i === 0 ? '#60a5fa' : '#64748b',
                    padding: '3px 7px', borderRadius: 4,
                  }}>{p}</span>
                ))}
              </div>
            </div>
            <div style={{ flex: 1, position: 'relative', minHeight: 70, marginTop: 4 }}>
              <svg width="100%" height="100%" viewBox="0 0 500 140" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.15" />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {mounted && (
                  <>
                    <path d="M 0 110 C 100 110, 150 60, 250 80 C 350 100, 400 30, 500 15 L 500 140 L 0 140 Z" fill="url(#eqGrad)" />
                    <path className="svg-chart-path" d="M 0 110 C 100 110, 150 60, 250 80 C 350 100, 400 30, 500 15" fill="none" stroke="#3b82f6" strokeWidth="2" />
                  </>
                )}
              </svg>
            </div>
          </div>

          {/* ── Risk Framework mini-panel ── */}
          <div className="glass-panel" style={{ padding: '10px 14px' }}>
            <div style={{ fontSize: 9, color: '#f59e0b', letterSpacing: '1.5px', fontWeight: 700, textTransform: 'uppercase', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 5 }}>
              <SafetyCertificateOutlined style={{ fontSize: 10 }} /> Risk Framework
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8 }}>
              {[
                { label: 'Per-Trade Limit', val: '1.0%', color: '#4ade80' },
                { label: 'Max Drawdown', val: '-4.1%', color: '#ef4444' },
                { label: 'Sharpe Ratio', val: '2.45', color: '#10b981' },
                { label: 'Approval', val: 'Required', color: '#f59e0b' },
              ].map(m => (
                <div key={m.label} style={{ textAlign: 'center' }}>
                  <div style={{ color: '#64748b', fontSize: 8, textTransform: 'uppercase', marginBottom: 4, fontWeight: 700, letterSpacing: '0.05em' }}>{m.label}</div>
                  <div style={{ color: m.color, fontSize: 13, fontWeight: 800 }}>{m.val}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom: Research Feed ── */}
      <div className="glass-panel" style={{ padding: '8px 14px' }}>
        <div style={{ fontSize: 9, color: '#64748b', letterSpacing: '1.5px', fontWeight: 700, textTransform: 'uppercase', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
          <SearchOutlined style={{ fontSize: 9 }} /> {t.landing.dashPreviewLiveFeed || 'Recent Validations'}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          <ResearchFeedRow sym="NVDA" signal="Momentum Breakout" status="Backtest OK" time="12s ago" />
          <ResearchFeedRow sym="AAPL" signal="Trend Continuation" status="Validated" time="28s ago" />
          <ResearchFeedRow sym="MSFT" signal="Earnings Momentum" status="Risk OK" time="45s ago" />
        </div>
      </div>
    </div>
  );
};

export default StockMarketHeroVisual;
