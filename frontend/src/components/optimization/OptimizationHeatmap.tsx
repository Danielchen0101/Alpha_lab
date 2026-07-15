import React from 'react';
import { Tooltip, Typography, Space } from 'antd';
import { useLanguage } from '../../contexts/LanguageContext';

const { Text } = Typography;

export interface OptimizationResult {
  rank: number;
  totalReturn: number | null;
  annualizedReturn?: number | null;
  sharpeRatio: number | null;
  maxDrawdown: number | null;
  trades: number | null;
  winRate?: number | null;
  profitLoss?: number;
  volatility?: number;
  sortinoRatio?: number;
  profitFactor?: number;
  expectancy?: number;
  exposure?: number;
  short_ma?: number;
  long_ma?: number;
  rsi_period?: number;
  oversold?: number;
  overbought?: number;
  fast?: number;
  slow?: number;
  signal?: number;
  period?: number;
  std_dev?: number;
  momentum_period?: number;
  lookback?: number;
  entry_z?: number;
  exit_z?: number;
  status?: string;
  error?: string | null;
  [key: string]: any;
}

interface OptimizationHeatmapProps {
  results: OptimizationResult[];
  strategy?: string;
}

const toFiniteNumber = (value: unknown): number | null => {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
};

const safeToFixed = (value: unknown, digits: number = 2): string => {
  const numericValue = toFiniteNumber(value);
  return numericValue === null ? 'N/A' : numericValue.toFixed(digits);
};

const safePercent = (value: unknown, digits: number = 2): string => {
  const numericValue = toFiniteNumber(value);
  if (numericValue === null) return 'N/A';
  return `${numericValue > 0 ? '+' : ''}${numericValue.toFixed(digits)}%`;
};

const safeDrawdown = (value: unknown, digits: number = 2): string => {
  const numericValue = toFiniteNumber(value);
  if (numericValue === null) return 'N/A';
  const magnitude = Math.abs(numericValue).toFixed(digits);
  return numericValue === 0 ? `${magnitude}%` : `-${magnitude}%`;
};

const isSuccessfulResult = (result: OptimizationResult): boolean => {
  if (!result || result.error) return false;
  const status = String(result.status || '').toLowerCase();
  return !['failed', 'error', 'invalid'].includes(status);
};

const hasFiniteCoreMetrics = (result: OptimizationResult): boolean => (
  isSuccessfulResult(result)
  && ['totalReturn', 'sharpeRatio', 'maxDrawdown'].every(
    (key) => toFiniteNumber(result[key]) !== null,
  )
);

const OptimizationHeatmap: React.FC<OptimizationHeatmapProps> = ({ results, strategy = 'moving_average' }) => {
  const { t } = useLanguage();
  const shouldShowHeatmap = () => strategy === 'moving_average' || strategy === 'bollinger';

  if (!shouldShowHeatmap()) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', background: 'var(--app-card-bg-soft)', borderRadius: '12px', border: '1px dashed var(--app-border-soft)' }}>
        <div style={{ fontSize: '16px', fontWeight: '700', color: 'var(--app-text-strong)', marginBottom: '12px' }}>{t.optimization.heatmapUnavailable}</div>
        <div style={{ fontSize: '14px', color: 'var(--app-text-muted)', maxWidth: '400px', margin: '0 auto' }}>
          {t.optimization.heatmapUnavailableDesc}
        </div>
      </div>
    );
  }

  const getAxisConfig = () => {
    if (strategy === 'bollinger') {
      return { xField: 'period', yField: 'std_dev', xLabel: t.optimization.labelPeriod, yLabel: t.optimization.labelStdDev, xFormatter: (v: number) => v.toString(), yFormatter: (v: number) => safeToFixed(v, 1) };
    }
    return { xField: 'short_ma', yField: 'long_ma', xLabel: t.optimization.labelShortMa, yLabel: t.optimization.labelLongMa, xFormatter: (v: number) => v.toString(), yFormatter: (v: number) => v.toString() };
  };

  const axisConfig = getAxisConfig();
  const xSet = new Set<number>();
  const ySet = new Set<number>();
  results.forEach(r => {
    const xValue = toFiniteNumber(r[axisConfig.xField]);
    const yValue = toFiniteNumber(r[axisConfig.yField]);
    if (xValue !== null) xSet.add(xValue);
    if (yValue !== null) ySet.add(yValue);
  });
  const xValues = Array.from(xSet).sort((a, b) => a - b);
  const yValues = Array.from(ySet).sort((a, b) => a - b);

  const resultMap = new Map<string, OptimizationResult>();
  results.forEach(r => {
    const xValue = toFiniteNumber(r[axisConfig.xField]);
    const yValue = toFiniteNumber(r[axisConfig.yField]);
    if (xValue !== null && yValue !== null) resultMap.set(`${xValue}_${yValue}`, r);
  });

  const sharpeValues = results
    .filter(hasFiniteCoreMetrics)
    .map(r => toFiniteNumber(r.sharpeRatio))
    .filter((value): value is number => value !== null);
  const minSharpe = sharpeValues.length > 0 ? Math.min(...sharpeValues) : null;
  const maxSharpe = sharpeValues.length > 0 ? Math.max(...sharpeValues) : null;
  const sharpeRange = minSharpe !== null && maxSharpe !== null ? maxSharpe - minSharpe : null;

  const getColor = (sharpe: unknown) => {
    const numericSharpe = toFiniteNumber(sharpe);
    if (numericSharpe === null || minSharpe === null || sharpeRange === null || sharpeRange === 0) {
      return 'var(--app-card-bg-soft)';
    }
    const normalized = (numericSharpe - minSharpe) / sharpeRange;
    if (normalized < 0.45) {
      const ratio = normalized / 0.45;
      return `color-mix(in srgb, var(--op-red, #ef4444) ${Math.round(10 + 30 * (1 - ratio))}%, transparent)`;
    } else if (normalized < 0.55) {
      return 'color-mix(in srgb, var(--app-text-muted) 10%, transparent)';
    } else {
      const ratio = (normalized - 0.55) / 0.45;
      return `color-mix(in srgb, var(--op-green, #22c55e) ${Math.round(10 + 30 * ratio)}%, transparent)`;
    }
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <style>{`
        .heatmap-professional-tooltip .ant-tooltip-inner {
          background-color: var(--app-card-bg) !important;
          color: var(--app-text-strong) !important;
          border: 1px solid var(--app-border-soft) !important;
          box-shadow: 0 12px 28px rgba(0, 0, 0, 0.3) !important;
          border-radius: 12px !important;
          padding: 12px !important;
        }
        .heatmap-professional-tooltip .ant-tooltip-arrow::before {
          background-color: var(--app-card-bg) !important;
        }
      `}</style>
      <div style={{ display: 'grid', gridTemplateColumns: `90px repeat(${xValues.length}, 1fr)`, gap: '2px' }}>
        <div style={{ padding: '8px', background: 'var(--app-table-header-bg)', borderBottom: '1px solid var(--app-border-soft)', borderRight: '1px solid var(--app-border-soft)', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
          <Text strong style={{ fontSize: '9px', color: 'var(--app-text-muted)', textAlign: 'center' }}>{axisConfig.yLabel.toUpperCase()} (Y) ↓</Text>
          <Text strong style={{ fontSize: '9px', color: 'var(--app-text-muted)', textAlign: 'center' }}>{axisConfig.xLabel.toUpperCase()} (X) →</Text>
        </div>
        {xValues.map(x => (
          <div key={x} style={{ padding: '8px', textAlign: 'center', background: 'var(--app-table-header-bg)', borderBottom: '1px solid var(--app-border-soft)' }}>
            <Text strong style={{ fontSize: '11px', color: 'var(--app-text-muted)' }}>{axisConfig.xFormatter(x)}</Text>
          </div>
        ))}
        {yValues.map(y => (
          <React.Fragment key={y}>
            <div style={{ padding: '8px', textAlign: 'center', background: 'var(--app-table-header-bg)', borderRight: '1px solid var(--app-border-soft)' }}>
              <Text strong style={{ fontSize: '11px', color: 'var(--app-text-muted)' }}>{axisConfig.yFormatter(y)}</Text>
            </div>
            {xValues.map(x => {
              const res = resultMap.get(`${x}_${y}`);
              const isUsable = Boolean(res && hasFiniteCoreMetrics(res));
              return (
                <Tooltip
                  key={`${x}_${y}`}
                  color="var(--app-card-bg)"
                  overlayClassName="heatmap-professional-tooltip"
                  title={res ? (
                  <div style={{ padding: '0' }}>
                    <Text strong style={{ display: 'block', marginBottom: '10px', color: 'var(--app-text-strong)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.6px' }}>{t.optimization.configDetails}</Text>
                    <Space direction="vertical" size={6} style={{ width: '100%' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '32px' }}>
                        <Text style={{ fontSize: '12px', color: 'var(--app-text-muted)', fontWeight: 500 }}>{t.optimization.labelSharpeRatio}</Text>
                        <Text strong style={{ color: 'var(--app-text-strong)' }}>{safeToFixed(isUsable ? res.sharpeRatio : null)}</Text>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Text style={{ fontSize: '12px', color: 'var(--app-text-muted)', fontWeight: 500 }}>{t.optimization.labelTotalReturn}</Text>
                        <Text strong style={{ color: toFiniteNumber(isUsable ? res.totalReturn : null) === null ? 'var(--app-text-muted)' : (res.totalReturn as number) >= 0 ? 'var(--op-green, #10b981)' : 'var(--op-red, #ef4444)' }}>
                          {safePercent(isUsable ? res.totalReturn : null)}
                        </Text>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Text style={{ fontSize: '12px', color: 'var(--app-text-muted)', fontWeight: 500 }}>{t.optimization.labelMaxDrawdown}</Text>
                        <Text strong style={{ color: toFiniteNumber(isUsable ? res.maxDrawdown : null) === null ? 'var(--app-text-muted)' : 'var(--op-red, #ef4444)' }}>
                          {safeDrawdown(isUsable ? res.maxDrawdown : null)}
                        </Text>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Text style={{ fontSize: '12px', color: 'var(--app-text-muted)', fontWeight: 500 }}>{t.optimization.labelWinRate}</Text>
                        <Text strong style={{ color: 'var(--app-text-strong)' }}>
                          {toFiniteNumber(isUsable ? res.winRate : null) === null ? 'N/A' : `${safeToFixed(res.winRate, 1)}%`}
                        </Text>
                      </div>
                    </Space>
                  </div>                ) : null}>
                  <div style={{
                    height: '38px',
                    background: isUsable ? getColor(res?.sharpeRatio) : 'var(--app-card-bg)',
                    borderRadius: '2px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: isUsable ? 'pointer' : 'default',
                    transition: 'all 0.15s ease'
                  }} className="heatmap-cell"
                  onMouseEnter={e => { if(isUsable) { e.currentTarget.style.transform = 'scale(1.15)'; e.currentTarget.style.zIndex = '10'; e.currentTarget.style.boxShadow = '0 8px 16px rgba(0,0,0,0.12)'; e.currentTarget.style.borderRadius = '4px'; } }}
                  onMouseLeave={e => { if(isUsable) { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.zIndex = '1'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderRadius = '2px'; } }}
                  >
                    {res && <Text style={{ fontSize: '10px', fontWeight: 800, color: isUsable ? 'var(--app-text-strong)' : 'var(--app-text-muted)' }}>{safeToFixed(isUsable ? res.sharpeRatio : null, 1)}</Text>}
                  </div>
                </Tooltip>
              );
            })}
          </React.Fragment>
        ))}
      </div>

      <div style={{ marginTop: '28px', padding: '14px 20px', background: 'var(--app-card-bg-soft)', borderRadius: '12px', border: '1px solid var(--app-border-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '28px' }}>
        <Text style={{ fontSize: '10px', fontWeight: 800, color: 'var(--app-text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>{t.optimization.heatmapTitle}:</Text>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '10px', height: '10px', background: 'color-mix(in srgb, var(--op-red, #ef4444) 24%, transparent)', borderRadius: '2px' }} />
          <Text style={{ fontSize: '11px', color: 'var(--app-text-muted)', fontWeight: 500 }}>{t.optimization.heatmapLowPerf}</Text>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '10px', height: '10px', background: 'color-mix(in srgb, var(--app-text-muted) 12%, transparent)', borderRadius: '2px' }} />
          <Text style={{ fontSize: '11px', color: 'var(--app-text-muted)', fontWeight: 500 }}>{t.optimization.heatmapNeutral}</Text>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '10px', height: '10px', background: 'color-mix(in srgb, var(--op-green, #22c55e) 24%, transparent)', borderRadius: '2px', border: '1px solid color-mix(in srgb, var(--op-green, #10b981) 24%, transparent)' }} />
          <Text style={{ fontSize: '11px', color: 'var(--app-text-muted)', fontWeight: 500 }}>{t.optimization.heatmapOptimal}</Text>
        </div>
      </div>
    </div>
  );
};

export default OptimizationHeatmap;
