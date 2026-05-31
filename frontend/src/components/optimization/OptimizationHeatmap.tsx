import React from 'react';
import { Tooltip, Typography, Space } from 'antd';
import { useLanguage } from '../../contexts/LanguageContext';

const { Text } = Typography;

export interface OptimizationResult {
  rank: number;
  totalReturn: number;
  annualizedReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  trades: number;
  winRate?: number;
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
  [key: string]: any;
}

interface OptimizationHeatmapProps {
  results: OptimizationResult[];
  strategy?: string;
}

const OptimizationHeatmap: React.FC<OptimizationHeatmapProps> = ({ results, strategy = 'moving_average' }) => {
  const { t } = useLanguage();
  const shouldShowHeatmap = () => strategy === 'moving_average' || strategy === 'bollinger';

  if (!shouldShowHeatmap()) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', background: '#f8f9fa', borderRadius: '12px', border: '1px dashed #d9d9d9' }}>
        <div style={{ fontSize: '16px', fontWeight: '700', color: '#595959', marginBottom: '12px' }}>{t.optimization.heatmapUnavailable}</div>
        <div style={{ fontSize: '14px', color: '#8c8c8c', maxWidth: '400px', margin: '0 auto' }}>
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
    if (r[axisConfig.xField] !== undefined) xSet.add(r[axisConfig.xField]);
    if (r[axisConfig.yField] !== undefined) ySet.add(r[axisConfig.yField]);
  });
  const xValues = Array.from(xSet).sort((a, b) => a - b);
  const yValues = Array.from(ySet).sort((a, b) => a - b);

  const resultMap = new Map<string, OptimizationResult>();
  results.forEach(r => resultMap.set(`${r[axisConfig.xField]}_${r[axisConfig.yField]}`, r));

  const sharpeValues = results.map(r => r.sharpeRatio);
  const minSharpe = Math.min(...sharpeValues);
  const maxSharpe = Math.max(...sharpeValues);
  const sharpeRange = maxSharpe - minSharpe;

  const getColor = (sharpe: number) => {
    if (sharpeRange === 0) return 'var(--app-card-bg-soft)';
    const normalized = (sharpe - minSharpe) / sharpeRange;
    // Professional color scale: Muted Red -> Slate -> Professional Green
    if (normalized < 0.45) {
      const ratio = normalized / 0.45;
      // Dark mode compatible red: rgba(239, 68, 68, opacity)
      return `rgba(239, 68, 68, ${0.1 + 0.3 * (1 - ratio)})`; 
    } else if (normalized < 0.55) {
      return 'rgba(148, 163, 184, 0.10)'; // Neutral Slate
    } else {
      const ratio = (normalized - 0.55) / 0.45;
      // Dark mode compatible green: rgba(34, 197, 94, opacity)
      return `rgba(34, 197, 94, ${0.1 + 0.3 * ratio})`;
    }
  };

  const safeToFixed = (v: any, d: number = 2) => (v === null || v === undefined || isNaN(v)) ? 'N/A' : Number(v).toFixed(d);

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
                        <Text strong style={{ color: 'var(--app-text-strong)' }}>{safeToFixed(res.sharpeRatio)}</Text>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Text style={{ fontSize: '12px', color: 'var(--app-text-muted)', fontWeight: 500 }}>{t.optimization.labelTotalReturn}</Text>
                        <Text strong style={{ color: res.totalReturn >= 0 ? '#10b981' : '#ef4444' }}>{(res.totalReturn >= 0 ? '+' : '') + (res.totalReturn).toFixed(2)}%</Text>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Text style={{ fontSize: '12px', color: 'var(--app-text-muted)', fontWeight: 500 }}>{t.optimization.labelMaxDrawdown}</Text>
                        <Text strong style={{ color: '#ef4444' }}>{safeToFixed(res.maxDrawdown)}%</Text>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Text style={{ fontSize: '12px', color: 'var(--app-text-muted)', fontWeight: 500 }}>{t.optimization.labelWinRate}</Text>
                        <Text strong style={{ color: 'var(--app-text-strong)' }}>{safeToFixed(res.winRate, 1)}%</Text>
                      </div>
                    </Space>
                  </div>                ) : null}>
                  <div style={{ 
                    height: '38px', 
                    background: res ? getColor(res.sharpeRatio) : 'var(--app-card-bg)', 
                    borderRadius: '2px', 
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: res ? 'pointer' : 'default',
                    transition: 'all 0.15s ease'
                  }} className="heatmap-cell"
                  onMouseEnter={e => { if(res) { e.currentTarget.style.transform = 'scale(1.15)'; e.currentTarget.style.zIndex = '10'; e.currentTarget.style.boxShadow = '0 8px 16px rgba(0,0,0,0.12)'; e.currentTarget.style.borderRadius = '4px'; } }}
                  onMouseLeave={e => { if(res) { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.zIndex = '1'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderRadius = '2px'; } }}
                  >
                    {res && <Text style={{ fontSize: '10px', fontWeight: 800, color: 'var(--app-text-strong)' }}>{safeToFixed(res.sharpeRatio, 1)}</Text>}
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
          <div style={{ width: '10px', height: '10px', background: 'rgba(239, 68, 68, 0.2)', borderRadius: '2px' }} />
          <Text style={{ fontSize: '11px', color: 'var(--app-text-muted)', fontWeight: 500 }}>{t.optimization.heatmapLowPerf}</Text>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '10px', height: '10px', background: 'rgba(148, 163, 184, 0.1)', borderRadius: '2px' }} />
          <Text style={{ fontSize: '11px', color: 'var(--app-text-muted)', fontWeight: 500 }}>{t.optimization.heatmapNeutral}</Text>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '10px', height: '10px', background: 'rgba(34, 197, 94, 0.2)', borderRadius: '2px', border: '1px solid rgba(16, 185, 129, 0.2)' }} />
          <Text style={{ fontSize: '11px', color: 'var(--app-text-muted)', fontWeight: 500 }}>{t.optimization.heatmapOptimal}</Text>
        </div>
      </div>
    </div>
  );
};

export default OptimizationHeatmap;
