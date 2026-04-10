import React from 'react';
import { Tooltip } from 'antd';

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
  // Strategy-specific parameters
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
  // Index signature for dynamic access
  [key: string]: any;
}

interface OptimizationHeatmapProps {
  results: OptimizationResult[];
  strategy?: string;
}

const OptimizationHeatmap: React.FC<OptimizationHeatmapProps> = ({ results, strategy = 'moving_average' }) => {
  // Check if heatmap should be shown for this strategy
  const shouldShowHeatmap = () => {
    // Only show heatmap for 2D parameter strategies
    return strategy === 'moving_average' || strategy === 'bollinger';
  };

  if (!shouldShowHeatmap()) {
    return (
      <div style={{ 
        padding: '40px', 
        textAlign: 'center',
        background: '#fafafa',
        borderRadius: '8px',
        border: '1px solid #e8e8e8'
      }}>
        <div style={{ fontSize: '16px', fontWeight: '600', color: '#666', marginBottom: '12px' }}>
          {strategy === 'rsi' ? 'RSI Optimization (3 Parameters)' : 
           strategy === 'macd' ? 'MACD Optimization (3 Parameters)' :
           strategy === 'momentum' ? 'Momentum Optimization (1 Parameter)' : 'Parameter Optimization'}
        </div>
        <div style={{ fontSize: '14px', color: '#999', marginBottom: '20px' }}>
          {strategy === 'rsi' ? 'RSI has 3 parameters (period, oversold, overbought). Heatmap visualization is not available for 3D parameter spaces.' :
           strategy === 'macd' ? 'MACD has 3 parameters (fast, slow, signal). Heatmap visualization is not available for 3D parameter spaces.' :
           strategy === 'momentum' ? 'Momentum has 1 parameter. Heatmap visualization requires at least 2 parameters.' :
           'Heatmap visualization is not available for this strategy.'}
        </div>
        <div style={{ fontSize: '13px', color: '#888', fontStyle: 'italic' }}>
          Please refer to the optimization results table for detailed parameter performance.
        </div>
      </div>
    );
  }

  // Get axis configuration based on strategy
  const getAxisConfig = () => {
    if (strategy === 'bollinger') {
      return {
        xField: 'period',
        yField: 'std_dev',
        xLabel: 'Period',
        yLabel: 'Std Dev',
        xFormatter: (val: number) => val.toString(),
        yFormatter: (val: number) => safeToFixed(val, 1)
      };
    } else {
      // Default: moving_average
      return {
        xField: 'short_ma',
        yField: 'long_ma',
        xLabel: 'Short MA',
        yLabel: 'Long MA',
        xFormatter: (val: number) => val.toString(),
        yFormatter: (val: number) => val.toString()
      };
    }
  };

  const axisConfig = getAxisConfig();

  // Get unique x and y values
  const xSet = new Set<number>();
  const ySet = new Set<number>();
  results.forEach((r: OptimizationResult) => {
    const xVal = r[axisConfig.xField];
    const yVal = r[axisConfig.yField];
    if (xVal !== undefined) xSet.add(xVal);
    if (yVal !== undefined) ySet.add(yVal);
  });
  const xValues = Array.from(xSet).sort((a, b) => a - b);
  const yValues = Array.from(ySet).sort((a, b) => a - b);

  // Create a map for quick lookup
  const resultMap = new Map<string, OptimizationResult>();
  results.forEach((result: OptimizationResult) => {
    const xVal = result[axisConfig.xField];
    const yVal = result[axisConfig.yField];
    if (xVal !== undefined && yVal !== undefined) {
      resultMap.set(`${xVal}_${yVal}`, result);
    }
  });

  // Calculate Sharpe Ratio range for color scaling
  const sharpeValues = results.map((r: OptimizationResult) => r.sharpeRatio);
  const minSharpe = Math.min(...sharpeValues);
  const maxSharpe = Math.max(...sharpeValues);
  const sharpeRange = maxSharpe - minSharpe;

  // Function to get color based on Sharpe Ratio
  const getColor = (sharpe: number) => {
    if (sharpeRange === 0) return '#d9d9d9'; // Gray if all values are the same
    
    const normalized = (sharpe - minSharpe) / sharpeRange;
    
    // Color gradient: red (low) -> yellow (medium) -> green (high)
    if (normalized < 0.5) {
      // Red to Yellow
      const r = 255;
      const g = Math.round(255 * (normalized * 2));
      return `rgb(${r}, ${g}, 0)`;
    } else {
      // Yellow to Green
      const r = Math.round(255 * (1 - (normalized - 0.5) * 2));
      const g = 255;
      return `rgb(${r}, ${g}, 0)`;
    }
  };

  // Safe formatting functions
  const safeToFixed = (value: any, digits: number = 2): string => {
    if (value === null || value === undefined || Number.isNaN(Number(value))) {
      return 'N/A';
    }
    return Number(value).toFixed(digits);
  };

  const safePercent = (value: any): string => {
    if (value === null || value === undefined || Number.isNaN(Number(value))) {
      return "N/A";
    }
    if (value === 0) return "0.00%";
    const sign = value > 0 ? "+" : "-";
    return `${sign}${Math.abs(value).toFixed(2)}%`;
  };

  // Helper function to format percentages (deprecated, use safePercent instead)
  const formatPercent = (value: number): string => {
  if (value === undefined || value === null || isNaN(value)) {
    return "N/A";
  }
  if (value === 0) return "0.00%";
  const sign = value > 0 ? "+" : "-";
  return `${sign}${Math.abs(value).toFixed(2)}%`;
};

  return (
    <div style={{ 
      display: 'grid',
      gridTemplateColumns: `auto repeat(${xValues.length}, 1fr)`,
      gap: '4px',
      fontSize: '12px',
      maxWidth: '800px',
      margin: '0 auto'
    }}>
      {/* Top-left empty cell */}
      <div style={{ 
        padding: '12px',
        textAlign: 'center',
        fontWeight: '600',
        background: '#fafafa',
        fontSize: '11px',
        color: '#333',
        borderRight: '2px solid #1890ff',
        borderBottom: '2px solid #1890ff'
      }}>
        <div>{axisConfig.xLabel}</div>
        <div style={{ fontSize: '10px', color: '#666', marginTop: '2px' }}>X-axis</div>
      </div>
      
      {/* X-axis headers (x values) */}
      {xValues.map(xVal => (
        <div key={`header-${xVal}`} style={{ 
          padding: '12px',
          textAlign: 'center',
          fontWeight: '600',
          background: '#fafafa',
          borderBottom: '2px solid #1890ff',
          fontSize: '12px',
          color: '#333'
        }}>
          {axisConfig.xFormatter(xVal)}
        </div>
      ))}
      
      {/* Heatmap rows */}
      {yValues.map(yVal => (
        <React.Fragment key={`row-${yVal}`}>
          {/* Y-axis header (y value) */}
          <div style={{ 
            padding: '12px',
            textAlign: 'center',
            fontWeight: '600',
            background: '#fafafa',
            borderRight: '2px solid #1890ff',
            fontSize: '12px',
            color: '#333'
          }}>
            <div>{axisConfig.yFormatter(yVal)}</div>
            <div style={{ fontSize: '10px', color: '#666', marginTop: '2px' }}>Y-axis</div>
          </div>
          
          {/* Heatmap cells */}
          {xValues.map(xVal => {
            const result = resultMap.get(`${xVal}_${yVal}`);
            const hasResult = !!result;
            const sharpe = hasResult ? result.sharpeRatio : 0;
            
            return (
              <Tooltip
                key={`cell-${xVal}-${yVal}`}
                title={hasResult ? (
                  <div style={{ fontSize: '13px', color: '#000', padding: '4px 0', minWidth: '220px' }}>
                    <div style={{ marginBottom: '8px', fontWeight: '600', fontSize: '14px', color: '#1890ff', borderBottom: '1px solid #f0f0f0', paddingBottom: '4px' }}>
                      {strategy === 'bollinger' ? `Bollinger: ${xVal} / ${axisConfig.yFormatter(yVal)}` : `MA Pair: ${xVal} / ${yVal}`}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', color: '#666' }}>Sharpe Ratio:</span>
                        <span style={{ 
                          color: sharpe >= 0 ? '#3f8600' : '#cf1322', 
                          fontWeight: '600',
                          fontSize: '13px'
                        }}>
                          {safeToFixed(sharpe, 2)}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', color: '#666' }}>Total Return:</span>
                        <span style={{ 
                          color: result.totalReturn >= 0 ? '#3f8600' : '#cf1322', 
                          fontWeight: '600',
                          fontSize: '13px'
                        }}>
                          {formatPercent(result.totalReturn)}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', color: '#666' }}>Max Drawdown:</span>
                        <span style={{ 
                          color: '#cf1322', 
                          fontWeight: '600',
                          fontSize: '13px'
                        }}>
                          {safeToFixed(result.maxDrawdown, 2)}%
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', color: '#666' }}>Trades:</span>
                        <span style={{ 
                          fontWeight: '600',
                          fontSize: '13px',
                          color: '#1890ff'
                        }}>
                          {result.trades}
                        </span>
                      </div>
                      {result.winRate !== undefined && result.winRate !== null && !isNaN(result.winRate) && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '12px', color: '#666' }}>Win Rate:</span>
                          <span style={{ 
                            color: result.winRate >= 60 ? '#3f8600' : result.winRate >= 40 ? '#fa8c16' : '#cf1322',
                            fontWeight: '600',
                            fontSize: '13px'
                          }}>
                            {safeToFixed(result.winRate, 1)}%
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div style={{ color: '#000', fontSize: '13px', padding: '8px' }}>
                    <div style={{ fontWeight: '600', marginBottom: '4px' }}>No Data</div>
                    <div style={{ fontSize: '12px', color: '#666' }}>
                      {strategy === 'bollinger' ? `${axisConfig.xLabel}: ${xVal}, ${axisConfig.yLabel}: ${axisConfig.yFormatter(yVal)}` : `${axisConfig.xLabel}: ${xVal}, ${axisConfig.yLabel}: ${yVal}`}
                    </div>
                  </div>
                )}
                placement="top"
                color="white"
                overlayStyle={{ 
                  maxWidth: '260px',
                  boxShadow: '0 3px 6px -4px rgba(0, 0, 0, 0.12), 0 6px 16px 0 rgba(0, 0, 0, 0.08), 0 9px 28px 8px rgba(0, 0, 0, 0.05)',
                  borderRadius: '6px'
                }}
              >
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    background: hasResult ? getColor(sharpe) : '#f5f5f5',
                    border: '1px solid #e8e8e8',
                    borderRadius: '4px',
                    cursor: hasResult ? 'pointer' : 'default',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'transform 0.2s',
                    fontSize: '10px',
                    fontWeight: 'bold'
                  }}
                  onMouseEnter={(e) => {
                    if (hasResult) {
                      e.currentTarget.style.transform = 'scale(1.1)';
                      e.currentTarget.style.zIndex = '1';
                      e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (hasResult) {
                      e.currentTarget.style.transform = 'scale(1)';
                      e.currentTarget.style.zIndex = '0';
                      e.currentTarget.style.boxShadow = 'none';
                    }
                  }}
                >
                  {hasResult && (
                    <span style={{
                      color: sharpe >= 0 ? '#000' : '#fff',
                      fontWeight: 'bold',
                      fontSize: '9px'
                    }}>
                      {safeToFixed(sharpe, 1)}
                    </span>
                  )}
                </div>
              </Tooltip>
            );
          })}
        </React.Fragment>
      ))}
      
      {/* Color legend */}
      <div style={{ 
        gridColumn: `1 / span ${xValues.length + 1}`,
        marginTop: '16px',
        paddingTop: '16px',
        borderTop: '1px solid #e8e8e8'
      }}>
        <div style={{ fontSize: '11px', color: '#666', marginBottom: '8px' }}>
          Sharpe Ratio Color Legend:
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ width: '12px', height: '12px', background: 'rgb(255, 0, 0)', marginRight: '4px' }}></div>
            <span>Low ({safeToFixed(minSharpe, 2)})</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ width: '12px', height: '12px', background: 'rgb(255, 255, 0)', marginRight: '4px' }}></div>
            <span>Medium</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ width: '12px', height: '12px', background: 'rgb(0, 255, 0)', marginRight: '4px' }}></div>
            <span>High ({safeToFixed(maxSharpe, 2)})</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ width: '12px', height: '12px', background: '#f5f5f5', border: '1px solid #e8e8e8', marginRight: '4px' }}></div>
            <span>No Data</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OptimizationHeatmap;
