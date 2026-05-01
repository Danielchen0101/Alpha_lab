import React from 'react';
import { Tooltip, Typography, Space } from 'antd';

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
  const shouldShowHeatmap = () => strategy === 'moving_average' || strategy === 'bollinger';

  if (!shouldShowHeatmap()) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', background: '#f8f9fa', borderRadius: '12px', border: '1px dashed #d9d9d9' }}>
        <div style={{ fontSize: '16px', fontWeight: '700', color: '#595959', marginBottom: '12px' }}>Visualization Unavailable</div>
        <div style={{ fontSize: '14px', color: '#8c8c8c', maxWidth: '400px', margin: '0 auto' }}>
          Heatmap visualization currently supports 2D parameter spaces (e.g., MA Crossover, Bollinger Bands). Multi-dimensional spaces can be analyzed via the Result Matrix.
        </div>
      </div>
    );
  }

  const getAxisConfig = () => {
    if (strategy === 'bollinger') {
      return { xField: 'period', yField: 'std_dev', xLabel: 'Period', yLabel: 'Std Dev', xFormatter: (v: number) => v.toString(), yFormatter: (v: number) => safeToFixed(v, 1) };
    }
    return { xField: 'short_ma', yField: 'long_ma', xLabel: 'Short MA', yLabel: 'Long MA', xFormatter: (v: number) => v.toString(), yFormatter: (v: number) => v.toString() };
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
    if (sharpeRange === 0) return '#f0f0f0';
    const normalized = (sharpe - minSharpe) / sharpeRange;
    // Premium color scale: Muted Red -> Neutral -> Soft Green
    if (normalized < 0.5) {
      const ratio = normalized * 2;
      return `rgb(255, ${Math.round(180 + 75 * ratio)}, ${Math.round(180 + 75 * ratio)})`; // Light Red to Whiteish
    } else {
      const ratio = (normalized - 0.5) * 2;
      return `rgb(${Math.round(255 - 180 * ratio)}, 255, ${Math.round(255 - 180 * ratio)})`; // Whiteish to Soft Green
    }
  };

  const safeToFixed = (v: any, d: number = 2) => (v === null || v === undefined || isNaN(v)) ? 'N/A' : Number(v).toFixed(d);

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      <div style={{ display: 'grid', gridTemplateColumns: `100px repeat(${xValues.length}, 1fr)`, gap: '4px' }}>
        <div style={{ padding: '12px', background: '#fafafa', borderBottom: '2px solid #f0f0f0', borderRight: '2px solid #f0f0f0', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
          <Text strong style={{ fontSize: '10px', color: '#8c8c8c' }}>{axisConfig.yLabel} (Y) ↓</Text>
          <Text strong style={{ fontSize: '10px', color: '#8c8c8c' }}>{axisConfig.xLabel} (X) →</Text>
        </div>
        {xValues.map(x => (
          <div key={x} style={{ padding: '12px', textAlign: 'center', background: '#fafafa', borderBottom: '2px solid #f0f0f0' }}>
            <Text strong style={{ fontSize: '12px', color: '#595959' }}>{axisConfig.xFormatter(x)}</Text>
          </div>
        ))}
        {yValues.map(y => (
          <React.Fragment key={y}>
            <div style={{ padding: '12px', textAlign: 'center', background: '#fafafa', borderRight: '2px solid #f0f0f0' }}>
              <Text strong style={{ fontSize: '12px', color: '#595959' }}>{axisConfig.yFormatter(y)}</Text>
            </div>
            {xValues.map(x => {
              const res = resultMap.get(`${x}_${y}`);
              return (
                <Tooltip key={`${x}_${y}`} title={res ? (
                  <div style={{ padding: '4px' }}>
                    <Text strong style={{ display: 'block', marginBottom: '8px', color: '#40a9ff' }}>Configuration Details</Text>
                    <Space direction="vertical" size={2} style={{ width: '100%' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '24px' }}>
                        <Text style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.75)' }}>Sharpe Ratio</Text>
                        <Text strong style={{ color: '#fff' }}>{safeToFixed(res.sharpeRatio)}</Text>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Text style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.75)' }}>Total Return</Text>
                        <Text strong style={{ color: res.totalReturn >= 0 ? '#73d13d' : '#ff4d4f' }}>{(res.totalReturn).toFixed(2)}%</Text>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Text style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.75)' }}>Max Drawdown</Text>
                        <Text strong style={{ color: '#ff4d4f' }}>{safeToFixed(res.maxDrawdown)}%</Text>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Text style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.75)' }}>Win Rate</Text>
                        <Text strong style={{ color: '#fff' }}>{safeToFixed(res.winRate, 1)}%</Text>
                      </div>
                    </Space>
                  </div>                ) : null}>
                  <div style={{ 
                    height: '40px', 
                    background: res ? getColor(res.sharpeRatio) : '#fdfdfd', 
                    borderRadius: '4px', 
                    border: '1px solid #f0f0f0',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: res ? 'pointer' : 'default',
                    transition: 'all 0.2s'
                  }} className="heatmap-cell"
                  onMouseEnter={e => { if(res) { e.currentTarget.style.transform = 'scale(1.08)'; e.currentTarget.style.zIndex = '2'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'; } }}
                  onMouseLeave={e => { if(res) { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.zIndex = '1'; e.currentTarget.style.boxShadow = 'none'; } }}
                  >
                    {res && <Text style={{ fontSize: '10px', fontWeight: 700, color: '#262626' }}>{safeToFixed(res.sharpeRatio, 1)}</Text>}
                  </div>
                </Tooltip>
              );
            })}
          </React.Fragment>
        ))}
      </div>
      
      <div style={{ marginTop: '24px', padding: '16px', background: '#fafafa', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '24px' }}>
        <Text type="secondary" style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase' }}>Sharpe Sensitivity:</Text>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '12px', height: '12px', background: '#ffb4b4', borderRadius: '2px' }} />
          <Text style={{ fontSize: '11px' }}>Low Performance</Text>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '12px', height: '12px', background: '#f0f0f0', borderRadius: '2px' }} />
          <Text style={{ fontSize: '11px' }}>Neutral</Text>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '12px', height: '12px', background: '#b4ffb4', borderRadius: '2px' }} />
          <Text style={{ fontSize: '11px' }}>Optimal</Text>
        </div>
      </div>
    </div>
  );
};

export default OptimizationHeatmap;
