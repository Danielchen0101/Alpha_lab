import React, { useId, useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import './SignalEstuaryVisual.css';

export type SignalEstuaryLocale = 'en-US' | 'zh-CN';

export interface SignalEstuaryVisualProps {
  locale?: SignalEstuaryLocale;
  /** Controls how much of the signal paths are revealed, from 0 to 1. */
  progress?: number;
  /** Uses a shallower layout and removes secondary annotations. */
  compact?: boolean;
  className?: string;
}

type SignalKind = 'price' | 'volatility' | 'volume';

interface EstuaryLine {
  d: string;
  kind: SignalKind;
  stroke: string;
  opacity: number;
  width: number;
  highlighted: boolean;
}

const COPY = {
  'en-US': {
    title: 'Market signal estuary',
    description:
      'Thousands of market observations converge into a single risk-aware plan.',
    price: 'Price',
    volatility: 'Volatility',
    volume: 'Volume',
    mode: 'Sample / paper mode',
    confluence: 'Signal confluence / walk-forward window',
    dates: ["MAR '24", "JUL '24", "NOV '24", "JAN '25", "APR '25"],
    stages: ['Observed', 'Shortlisted', 'Validated', 'Risk plan'],
  },
  'zh-CN': {
    title: '市场信号河口',
    description: '数千条市场观测在此收束为一个风险可控的计划。',
    price: '价格',
    volatility: '波动率',
    volume: '成交量',
    mode: '样本 / 模拟模式',
    confluence: '信号汇流 / 前向验证窗口',
    dates: ['2024年3月', '2024年7月', '2024年11月', '2025年1月', '2025年4月'],
    stages: ['已观测', '入围', '已验证', '风险计划'],
  },
} as const;

const TICKER_LINES: Record<number, { symbol: string; color: string }> = {
  3: { symbol: 'SPY', color: '#2d68ad' },
  10: { symbol: 'AAPL', color: '#71886c' },
  16: { symbol: 'MSFT', color: '#5790a0' },
  28: { symbol: 'AMD', color: '#b76b4f' },
  37: { symbol: 'NVDA', color: '#1760ba' },
};

const BASE_STROKES = ['#66716f', '#4f7792', '#7c8477', '#8a786b', '#477f8c'];

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

/**
 * Builds a fixed topographic field. The sine offsets are index-derived, so the
 * river remains identical across renders and server/client hydration.
 */
const buildEstuaryLines = (): EstuaryLine[] =>
  Array.from({ length: 42 }, (_, index) => {
    const endY = 30 + index * 10.55;
    const rootY = 251 + Math.sin(index * 1.73) * 7 + (index - 20.5) * 0.18;
    const bendOne = rootY * 0.66 + endY * 0.34 + Math.sin(index * 0.83) * 15;
    const bendTwo = rootY * 0.34 + endY * 0.66 + Math.cos(index * 1.07) * 14;
    const shore = Math.sin(index * 2.14) * 9;
    const ticker = TICKER_LINES[index];
    const kind: SignalKind = index % 7 === 0 ? 'volume' : index % 4 === 0 ? 'volatility' : 'price';

    return {
      d: [
        `M 286 ${rootY.toFixed(1)}`,
        `C 334 ${(rootY + shore).toFixed(1)}, 382 ${(rootY - shore * 0.4).toFixed(1)}, 432 ${(
          rootY + shore * 0.3
        ).toFixed(1)}`,
        `C 512 ${bendOne.toFixed(1)}, 584 ${bendOne.toFixed(1)}, 662 ${bendTwo.toFixed(1)}`,
        `C 760 ${(bendTwo + shore).toFixed(1)}, 874 ${(endY - shore * 0.5).toFixed(1)}, 1014 ${endY.toFixed(1)}`,
      ].join(' '),
      kind,
      stroke: ticker?.color ?? BASE_STROKES[index % BASE_STROKES.length],
      opacity: ticker ? 0.92 : 0.2 + (index % 5) * 0.045,
      width: ticker ? 1.65 : index % 6 === 0 ? 1.05 : 0.78,
      highlighted: Boolean(ticker),
    };
  });

const ESTUARY_LINES = buildEstuaryLines();

const TICKERS = Object.entries(TICKER_LINES).map(([lineIndex, ticker]) => ({
  ...ticker,
  y: 30 + Number(lineIndex) * 10.55,
}));

const CONTOURS = [
  'M 36 250 C 76 190, 140 171, 201 194 C 250 212, 263 237, 317 251 C 257 267, 241 301, 195 319 C 131 344, 75 312, 36 250 Z',
  'M 74 250 C 105 209, 151 199, 194 214 C 229 226, 252 244, 293 252 C 251 264, 226 285, 191 299 C 143 318, 99 294, 74 250 Z',
  'M 113 250 C 137 225, 169 221, 197 229 C 229 238, 246 249, 276 253 C 246 260, 225 273, 196 282 C 164 292, 132 279, 113 250 Z',
  'M 149 251 C 166 238, 186 237, 204 241 C 227 247, 241 253, 261 254 C 240 259, 224 265, 203 270 C 183 274, 162 266, 149 251 Z',
];

const STAGE_VALUES = ['8,421', '24', '3', '1'];

const SignalEstuaryVisual: React.FC<SignalEstuaryVisualProps> = ({
  locale = 'en-US',
  progress = 1,
  compact = false,
  className = '',
}) => {
  const shouldReduceMotion = useReducedMotion();
  const copy = COPY[locale];
  const reveal = clamp01(progress);
  const generatedId = useId();
  const idPrefix = useMemo(() => `signal-estuary-${generatedId.replace(/:/g, '')}`, [generatedId]);
  const classNames = ['signal-estuary', compact ? 'signal-estuary--compact' : '', className]
    .filter(Boolean)
    .join(' ');

  return (
    <figure className={classNames} aria-labelledby={`${idPrefix}-caption`}>
      <figcaption id={`${idPrefix}-caption`} className="signal-estuary__sr-only">
        {copy.title}. {copy.description}
      </figcaption>

      <div className="signal-estuary__header" aria-hidden="true">
        <div className="signal-estuary__legend">
          <span>
            <i className="signal-estuary__key signal-estuary__key--price" />
            {copy.price}
          </span>
          <span>
            <i className="signal-estuary__key signal-estuary__key--volatility" />
            {copy.volatility}
          </span>
          <span>
            <i className="signal-estuary__key signal-estuary__key--volume" />
            {copy.volume}
          </span>
        </div>
        <span className="signal-estuary__mode">{copy.mode}</span>
      </div>

      <div className="signal-estuary__chart">
        <svg
          className="signal-estuary__svg"
          viewBox="0 0 1080 490"
          preserveAspectRatio="xMidYMid meet"
          aria-hidden="true"
          focusable="false"
        >
          <defs>
            <linearGradient id={`${idPrefix}-wash`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#d7e6df" stopOpacity="0.62" />
              <stop offset="0.46" stopColor="#dbe8df" stopOpacity="0.2" />
              <stop offset="1" stopColor="#f6f0e4" stopOpacity="0" />
            </linearGradient>
            <linearGradient id={`${idPrefix}-river`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#246a9d" stopOpacity="0.54" />
              <stop offset="0.5" stopColor="#729c9c" stopOpacity="0.2" />
              <stop offset="1" stopColor="#e8e0cf" stopOpacity="0" />
            </linearGradient>
            <filter id={`${idPrefix}-soften`} x="-15%" y="-25%" width="130%" height="150%">
              <feGaussianBlur stdDeviation="12" />
            </filter>
          </defs>

          <g className="signal-estuary__terrain">
            <path
              d="M 8 249 C 118 111, 218 175, 308 235 C 407 301, 514 213, 640 158 C 770 101, 882 93, 1048 44 L 1048 0 L 8 0 Z"
              fill={`url(#${idPrefix}-wash)`}
              opacity="0.24"
            />
            <path
              d="M 14 262 C 150 378, 227 313, 313 273 C 397 234, 505 318, 636 360 C 783 407, 911 403, 1055 460 L 1055 490 L 14 490 Z"
              fill={`url(#${idPrefix}-wash)`}
              opacity="0.16"
            />
            <path
              d="M 181 250 C 235 222, 294 219, 360 242 C 421 264, 492 259, 563 240 C 482 281, 403 295, 333 277 C 270 260, 227 267, 181 250 Z"
              fill={`url(#${idPrefix}-river)`}
              filter={`url(#${idPrefix}-soften)`}
            />
            {CONTOURS.map((path, index) => (
              <path key={path} d={path} className={`signal-estuary__contour signal-estuary__contour--${index + 1}`} />
            ))}
          </g>

          <g className="signal-estuary__guides">
            {[82, 166, 250, 334, 418].map((y) => (
              <line key={y} x1="24" y1={y} x2="1040" y2={y} />
            ))}
            {[430, 566, 702, 838, 974].map((x) => (
              <line key={x} x1={x} y1="18" x2={x} y2="465" />
            ))}
          </g>

          <g className="signal-estuary__flow-lines">
            {ESTUARY_LINES.map((line, index) => (
              <motion.path
                key={index}
                d={line.d}
                fill="none"
                stroke={line.stroke}
                strokeWidth={line.width}
                strokeOpacity={line.opacity}
                strokeDasharray={
                  line.kind === 'volatility' ? '5 5' : line.kind === 'volume' ? '1.5 5.5' : undefined
                }
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
                initial={shouldReduceMotion ? false : { pathLength: 0, opacity: 0 }}
                animate={{ pathLength: reveal, opacity: 1 }}
                whileHover={shouldReduceMotion ? undefined : { strokeOpacity: line.highlighted ? 1 : 0.62 }}
                transition={{
                  pathLength: {
                    duration: shouldReduceMotion ? 0 : 0.78,
                    delay: shouldReduceMotion ? 0 : (index % 9) * 0.018,
                    ease: [0.33, 1, 0.68, 1],
                  },
                  opacity: { duration: shouldReduceMotion ? 0 : 0.25 },
                }}
              />
            ))}
          </g>

          <g className="signal-estuary__mouth">
            <circle cx="286" cy="254" r="3" />
            <circle cx="286" cy="254" r="10" />
            <path d="M 235 253 L 276 253" />
          </g>

          <g className="signal-estuary__ticker-labels">
            {TICKERS.map((ticker) => (
              <g key={ticker.symbol} transform={`translate(1014 ${ticker.y})`}>
                <circle r="3.2" fill={ticker.color} />
                <line x1="5" x2="13" stroke={ticker.color} />
                <text x="18" y="4" fill={ticker.color}>
                  {ticker.symbol}
                </text>
              </g>
            ))}
          </g>

          <g className="signal-estuary__axis">
            {[402, 548, 695, 842, 974].map((x, index) => (
              <text key={copy.dates[index]} x={x} y="478">{copy.dates[index]}</text>
            ))}
          </g>

          {!compact && (
            <g className="signal-estuary__annotation">
              <path d="M 303 222 L 326 190 L 444 190" />
              <text x="334" y="181">{copy.confluence.toUpperCase()}</text>
            </g>
          )}
        </svg>
      </div>

      <ol className="signal-estuary__stages" aria-label={copy.description}>
        {STAGE_VALUES.map((value, index) => (
          <li key={value} className={index === STAGE_VALUES.length - 1 ? 'is-final' : ''}>
            <span className="signal-estuary__stage-value">{value}</span>
            <span className="signal-estuary__stage-label">{copy.stages[index]}</span>
            {index < STAGE_VALUES.length - 1 && <i className="signal-estuary__stage-arrow" aria-hidden="true" />}
          </li>
        ))}
      </ol>
    </figure>
  );
};

export default SignalEstuaryVisual;
