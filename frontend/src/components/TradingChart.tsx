import React, { useMemo, useState } from 'react';
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useLanguage } from '../contexts/LanguageContext';
import './TradingChart.css';

interface ChartDataItem {
  date: string;
  close: number;
  volume?: number;
  signal?: number;
  sma20?: number;
  sma50?: number;
}

interface TradingChartProps {
  data: ChartDataItem[];
  height?: number;
  parameters?: {
    strategy?: string;
    symbol?: string;
    period?: string;
    initialCapital?: number;
  };
}

type SeriesKey = 'sma20' | 'sma50' | 'signals' | 'volume';
const CHART_TIME_ZONE = 'America/New_York';

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

const compactNumber = (value: number, locale: string) => new Intl.NumberFormat(locale, {
  notation: 'compact',
  maximumFractionDigits: 1,
}).format(value);

const parseChartDate = (value: string): Date => {
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  return new Date(dateOnly ? `${value}T12:00:00Z` : value);
};

const TradingChart: React.FC<TradingChartProps> = ({ data, height = 320, parameters }) => {
  const { t, language } = useLanguage();
  const isZh = language === 'zh-CN';
  const locale = isZh ? 'zh-CN' : 'en-US';
  const [visible, setVisible] = useState<Record<SeriesKey, boolean>>({
    sma20: true,
    sma50: true,
    signals: true,
    volume: true,
  });

  const chartData = useMemo(() => [...(Array.isArray(data) ? data : [])]
    .filter(item => item && item.date && finite(Number(item.close)))
    .sort((left, right) => parseChartDate(left.date).getTime() - parseChartDate(right.date).getTime())
    .map((item, index, all) => {
      const close = Number(item.close);
      const previous = index > 0 ? Number(all[index - 1].close) : close;
      return {
        ...item,
        close,
        volume: finite(Number(item.volume)) ? Number(item.volume) : 0,
        buySignal: item.signal === 1 ? close : undefined,
        sellSignal: item.signal === -1 ? close : undefined,
        volumeFill: close >= previous ? 'var(--tc-positive)' : 'var(--tc-negative)',
      };
    }), [data]);

  const summary = useMemo(() => {
    if (!chartData.length) return null;
    const prices = chartData.map(item => item.close).filter(finite);
    const first = prices[0];
    const last = prices[prices.length - 1];
    const change = first ? ((last - first) / first) * 100 : 0;
    return {
      first,
      last,
      change,
      low: Math.min(...prices),
      high: Math.max(...prices),
      buys: chartData.filter(item => item.signal === 1).length,
      sells: chartData.filter(item => item.signal === -1).length,
      hasSma20: chartData.some(item => finite(item.sma20)),
      hasSma50: chartData.some(item => finite(item.sma50)),
      hasVolume: chartData.some(item => finite(item.volume) && item.volume > 0),
    };
  }, [chartData]);

  const formatDate = (value: string) => {
    const date = parseChartDate(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat(locale, {
      timeZone: CHART_TIME_ZONE,
      month: 'short',
      day: 'numeric',
      year: chartData.length > 260 ? '2-digit' : undefined,
    }).format(date);
  };

  const formatTooltipDate = (value: string) => {
    const date = parseChartDate(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat(locale, {
      timeZone: CHART_TIME_ZONE,
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(date);
  };

  const toggleSeries = (key: SeriesKey) => setVisible(current => ({ ...current, [key]: !current[key] }));

  if (!summary) {
    return (
      <div className="trading-chart trading-chart--empty" style={{ minHeight: Math.min(height, 300) }} role="status">
        <div className="trading-chart__empty-mark" aria-hidden="true">⌁</div>
        <strong>{isZh ? '暂无价格信号数据' : 'No price-signal data yet'}</strong>
        <span>{isZh ? '完成回测后将在这里显示价格、均线与交易信号。' : 'Price, moving averages, and trade signals will appear after a completed backtest.'}</span>
      </div>
    );
  }

  const chartHeight = Math.max(210, Math.min(height, 360));
  const priceHeight = visible.volume && summary.hasVolume ? Math.round(chartHeight * 0.72) : chartHeight;
  const volumeHeight = visible.volume && summary.hasVolume ? Math.max(72, chartHeight - priceHeight) : 0;
  const priceDomain: [number, number] = [
    summary.low - Math.max((summary.high - summary.low) * 0.12, summary.low * 0.005),
    summary.high + Math.max((summary.high - summary.low) * 0.12, summary.high * 0.005),
  ];

  const tooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const datum = payload[0]?.payload;
    return (
      <div className="trading-chart__tooltip">
        <span>{formatTooltipDate(label)}</span>
        <strong>${Number(datum?.close || 0).toFixed(2)}</strong>
        <dl>
          {finite(datum?.sma20) && <div><dt>SMA 20</dt><dd>${datum.sma20.toFixed(2)}</dd></div>}
          {finite(datum?.sma50) && <div><dt>SMA 50</dt><dd>${datum.sma50.toFixed(2)}</dd></div>}
          {datum?.volume > 0 && <div><dt>{t.backtest.volume}</dt><dd>{compactNumber(datum.volume, locale)}</dd></div>}
        </dl>
        {datum?.signal === 1 && <em className="is-buy">{t.backtest.buySignal}</em>}
        {datum?.signal === -1 && <em className="is-sell">{t.backtest.sellSignal}</em>}
      </div>
    );
  };

  const controls: Array<{ key: SeriesKey; label: string; color: string; show: boolean }> = [
    { key: 'sma20', label: 'SMA 20', color: '#83a77a', show: summary.hasSma20 },
    { key: 'sma50', label: 'SMA 50', color: '#c38a61', show: summary.hasSma50 },
    { key: 'signals', label: t.backtest.signals, color: '#6f91b8', show: summary.buys + summary.sells > 0 },
    { key: 'volume', label: t.backtest.volume, color: '#718078', show: summary.hasVolume },
  ];

  return (
    <section className="trading-chart" aria-label={t.backtest.priceChartWithSignals}>
      <header className="trading-chart__header">
        <div>
          <span className="trading-chart__eyebrow">{isZh ? '价格与执行信号' : 'PRICE & EXECUTION SIGNALS'}</span>
          <div className="trading-chart__last-line">
            <strong>${summary.last.toFixed(2)}</strong>
            <span className={summary.change >= 0 ? 'is-positive' : 'is-negative'}>
              {summary.change >= 0 ? '+' : ''}{summary.change.toFixed(2)}%
            </span>
          </div>
          <small>{parameters?.symbol || (isZh ? '回测标的' : 'Backtest instrument')} · {chartData.length.toLocaleString(locale)} {isZh ? '个数据点' : 'observations'}</small>
        </div>
        <dl className="trading-chart__range">
          <div><dt>{isZh ? '区间低点' : 'PERIOD LOW'}</dt><dd>${summary.low.toFixed(2)}</dd></div>
          <div><dt>{isZh ? '区间高点' : 'PERIOD HIGH'}</dt><dd>${summary.high.toFixed(2)}</dd></div>
          <div><dt>{isZh ? '买 / 卖' : 'BUY / SELL'}</dt><dd>{summary.buys} / {summary.sells}</dd></div>
        </dl>
      </header>

      <div className="trading-chart__controls" aria-label={isZh ? '图表图层' : 'Chart layers'}>
        <span>{isZh ? '图层' : 'LAYERS'}</span>
        {controls.filter(control => control.show).map(control => (
          <button
            type="button"
            key={control.key}
            className={visible[control.key] ? 'is-active' : ''}
            aria-pressed={visible[control.key]}
            onClick={() => toggleSeries(control.key)}
          >
            <i style={{ background: control.color }} aria-hidden="true" />{control.label}
          </button>
        ))}
      </div>

      <div className="trading-chart__canvas" style={{ height: chartHeight }}>
        <div style={{ height: priceHeight }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 16, right: 18, left: 2, bottom: volumeHeight ? 0 : 8 }}>
              <defs>
                <linearGradient id="tcPriceFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6f91b8" stopOpacity={0.22} />
                  <stop offset="100%" stopColor="#6f91b8" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--tc-grid)" strokeDasharray="2 5" vertical={false} />
              <XAxis dataKey="date" hide={Boolean(volumeHeight)} tickFormatter={formatDate} minTickGap={46} tickLine={false} axisLine={false} tick={{ fill: 'var(--tc-muted)', fontSize: 11 }} />
              <YAxis orientation="right" domain={priceDomain} tickFormatter={value => `$${Number(value).toFixed(0)}`} width={58} tickLine={false} axisLine={false} tick={{ fill: 'var(--tc-muted)', fontSize: 11 }} />
              <Tooltip
                content={tooltip}
                cursor={{ stroke: 'var(--tc-cursor)', strokeWidth: 1 }}
                wrapperStyle={{ outline: 'none', zIndex: 8, pointerEvents: 'none' }}
                allowEscapeViewBox={{ x: true, y: true }}
              />
              <ReferenceLine y={summary.first} stroke="var(--tc-baseline)" strokeDasharray="4 5" />
              <Area type="monotone" dataKey="close" stroke="#77a7e2" strokeWidth={2.2} fill="url(#tcPriceFill)" dot={false} activeDot={{ r: 4, fill: '#77a7e2', stroke: 'var(--tc-panel)', strokeWidth: 2 }} isAnimationActive={false} />
              {summary.hasSma20 && visible.sma20 && <Line type="monotone" dataKey="sma20" stroke="#9ab990" strokeWidth={1.6} dot={false} connectNulls isAnimationActive={false} />}
              {summary.hasSma50 && visible.sma50 && <Line type="monotone" dataKey="sma50" stroke="#d09a6d" strokeWidth={1.6} dot={false} connectNulls isAnimationActive={false} />}
              {visible.signals && <Scatter dataKey="buySignal" fill="#91b987" shape="triangle" />}
              {visible.signals && <Scatter dataKey="sellSignal" fill="#d37c64" shape="diamond" />}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        {Boolean(volumeHeight) && (
          <div className="trading-chart__volume" style={{ height: volumeHeight }}>
            <span>{t.backtest.volume}</span>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 6, right: 76, left: 2, bottom: 4 }}>
                <XAxis dataKey="date" tickFormatter={formatDate} minTickGap={46} tickLine={false} axisLine={false} tick={{ fill: 'var(--tc-muted)', fontSize: 11 }} />
                <YAxis hide domain={[0, 'dataMax']} />
                <Tooltip
                  content={tooltip}
                  cursor={{ fill: 'var(--tc-hover)' }}
                  wrapperStyle={{ outline: 'none', zIndex: 8, pointerEvents: 'none' }}
                  allowEscapeViewBox={{ x: true, y: true }}
                />
                <Bar dataKey="volume" fill="var(--tc-volume)" opacity={0.68} maxBarSize={10} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {parameters && (
        <footer className="trading-chart__parameters">
          {parameters.strategy && <span><small>{isZh ? '策略' : 'STRATEGY'}</small><strong>{parameters.strategy}</strong></span>}
          {parameters.period && <span><small>{isZh ? '周期' : 'PERIOD'}</small><strong>{parameters.period}</strong></span>}
          {finite(parameters.initialCapital) && <span><small>{isZh ? '初始资金' : 'INITIAL CAPITAL'}</small><strong>${parameters.initialCapital.toLocaleString(locale)}</strong></span>}
        </footer>
      )}
    </section>
  );
};

export default TradingChart;
