import React from 'react';
import { Card, Row, Col } from 'antd';
import { OptimizationResult } from './OptimizationHeatmap';

interface OptimizationSummaryProps {
  results: OptimizationResult[];
  totalCombinations?: number;
  validCombinations?: number;
  strategy?: string;
}

const OptimizationSummary: React.FC<OptimizationSummaryProps> = ({ 
  results, 
  totalCombinations, 
  validCombinations,
  strategy = 'moving_average'
}) => {
  // Calculate statistics
  const stats = {
    totalCombinations: totalCombinations || results.length,
    validCombinations: validCombinations || results.length,
    bestReturn: results.length > 0 ? Math.max(...results.map(r => r.totalReturn)) : 0,
    worstReturn: results.length > 0 ? Math.min(...results.map(r => r.totalReturn)) : 0,
    avgReturn: results.length > 0 ? results.reduce((sum, r) => sum + r.totalReturn, 0) / results.length : 0,
    bestSharpeRatio: results.length > 0 ? Math.max(...results.map(r => r.sharpeRatio)) : 0,
    bestMaxDrawdown: results.length > 0 ? Math.min(...results.map(r => r.maxDrawdown)) : 0, // Most negative is best
    bestCombinationBySharpe: results.length > 0 ? 
      results.reduce((best, current) => 
        (current.sharpeRatio > best.sharpeRatio) ? current : best
      ) : null,
    bestCombinationByReturn: results.length > 0 ? 
      results.reduce((best, current) => 
        (current.totalReturn > best.totalReturn) ? current : best
      ) : null
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

  // Get parameter display configuration based on strategy
  const getStrategyConfig = () => {
    switch (strategy) {
      case 'rsi':
        return {
          param1: { key: 'rsi_period', label: 'RSI Period' },
          param2: { key: 'oversold', label: 'Oversold' },
          param3: { key: 'overbought', label: 'Overbought' },
          pairLabel: 'RSI Parameters',
          hasThirdParam: true,
          isSingleParam: false
        };
      case 'macd':
        return {
          param1: { key: 'fast', label: 'Fast MA' },
          param2: { key: 'slow', label: 'Slow MA' },
          param3: { key: 'signal', label: 'Signal MA' },
          pairLabel: 'MACD Parameters',
          hasThirdParam: true,
          isSingleParam: false
        };
      case 'bollinger':
        return {
          param1: { key: 'period', label: 'Period' },
          param2: { key: 'std_dev', label: 'Std Dev' },
          pairLabel: 'Bollinger Parameters',
          hasThirdParam: false,
          isSingleParam: false
        };
      case 'momentum':
        return {
          param1: { key: 'momentum_period', label: 'Momentum Period' },
          param2: null, // Momentum has only one parameter
          pairLabel: 'Momentum Parameter',
          hasThirdParam: false,
          isSingleParam: true // Flag for single parameter strategies
        };
      default: // moving_average
        return {
          param1: { key: 'short_ma', label: 'Short MA' },
          param2: { key: 'long_ma', label: 'Long MA' },
          pairLabel: 'MA Pair',
          hasThirdParam: false,
          isSingleParam: false
        };
    }
  };

  const strategyConfig = getStrategyConfig();

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ 
        marginBottom: '24px', 
        fontSize: '18px', 
        fontWeight: '600',
        color: '#1f1f1f',
        display: 'flex',
        alignItems: 'center'
      }}>
        <div style={{
          width: '4px',
          height: '20px',
          background: '#722ed1',
          borderRadius: '2px',
          marginRight: '12px'
        }} />
        Optimization Summary
      </div>
      
      {/* Basic Statistics Row */}
      <Row gutter={[24, 24]} style={{ marginBottom: '32px' }}>
        <Col span={4}>
          <div style={{ 
            textAlign: 'center',
            padding: '16px',
            background: '#f0f9ff',
            borderRadius: '8px',
            border: '1px solid #e6f4ff'
          }}>
            <div style={{ fontSize: '28px', fontWeight: '600', color: '#1890ff', marginBottom: '8px' }}>
              {stats.totalCombinations}
            </div>
            <div style={{ fontSize: '14px', fontWeight: '500', color: '#262626' }}>
              Total Combinations
            </div>
          </div>
        </Col>
        <Col span={4}>
          <div style={{ 
            textAlign: 'center',
            padding: '16px',
            background: '#f6ffed',
            borderRadius: '8px',
            border: '1px solid #d9f7be'
          }}>
            <div style={{ fontSize: '28px', fontWeight: '600', color: '#52c41a', marginBottom: '8px' }}>
              {stats.validCombinations}
            </div>
            <div style={{ fontSize: '14px', fontWeight: '500', color: '#262626' }}>
              Valid Results
            </div>
          </div>
        </Col>
        <Col span={4}>
          <div style={{ 
            textAlign: 'center',
            padding: '16px',
            background: '#f6ffed',
            borderRadius: '8px',
            border: '1px solid #d9f7be'
          }}>
            <div style={{ fontSize: '28px', fontWeight: '600', color: '#3f8600', marginBottom: '8px' }}>
              {safePercent(stats.bestReturn)}
            </div>
            <div style={{ fontSize: '14px', fontWeight: '500', color: '#262626' }}>
              Best Return
            </div>
          </div>
        </Col>
        <Col span={4}>
          <div style={{ 
            textAlign: 'center',
            padding: '16px',
            background: '#fff2f0',
            borderRadius: '8px',
            border: '1px solid #ffccc7'
          }}>
            <div style={{ fontSize: '28px', fontWeight: '600', color: '#cf1322', marginBottom: '8px' }}>
              {safePercent(stats.worstReturn)}
            </div>
            <div style={{ fontSize: '14px', fontWeight: '500', color: '#262626' }}>
              Worst Return
            </div>
          </div>
        </Col>
        <Col span={4}>
          <div style={{ 
            textAlign: 'center',
            padding: '16px',
            background: '#fff7e6',
            borderRadius: '8px',
            border: '1px solid #ffd591'
          }}>
            <div style={{ fontSize: '28px', fontWeight: '600', color: '#fa8c16', marginBottom: '8px' }}>
              {safePercent(stats.avgReturn)}
            </div>
            <div style={{ fontSize: '14px', fontWeight: '500', color: '#262626' }}>
              Average Return
            </div>
          </div>
        </Col>
        <Col span={4}>
          <div style={{ 
            textAlign: 'center',
            padding: '16px',
            background: '#f9f0ff',
            borderRadius: '8px',
            border: '1px solid #d3adf7'
          }}>
            <div style={{ fontSize: '28px', fontWeight: '600', color: '#722ed1', marginBottom: '8px' }}>
              {safeToFixed(stats.bestSharpeRatio, 2)}
            </div>
            <div style={{ fontSize: '14px', fontWeight: '500', color: '#262626' }}>
              Best Sharpe
            </div>
          </div>
        </Col>
      </Row>
      
      {/* Best Combination Details */}
      {stats.bestCombinationBySharpe && (
        <div style={{ 
          background: 'linear-gradient(135deg, #f6ffed 0%, #e6ffd9 100%)', 
          border: '1px solid #b7eb8f', 
          borderRadius: '12px', 
          padding: '24px',
          marginTop: '16px'
        }}>
          <div style={{ 
            fontSize: '16px', 
            fontWeight: '600', 
            color: '#389e0d', 
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center'
          }}>
            <span style={{ marginRight: '8px' }}>🏆</span>
            Best Combination (by Sharpe Ratio)
          </div>
          <Row gutter={[24, 16]}>
            <Col span={strategyConfig.isSingleParam ? 6 : (strategyConfig.hasThirdParam ? 3 : 4)}>
              <div style={{ 
                textAlign: 'center',
                padding: '12px',
                background: 'white',
                borderRadius: '8px',
                border: '1px solid #e8e8e8'
              }}>
                <div style={{ fontSize: '20px', fontWeight: '600', color: '#1890ff', marginBottom: '4px' }}>
                  {safeToFixed(stats.bestCombinationBySharpe[strategyConfig.param1.key], 0)}
                </div>
                <div style={{ fontSize: '12px', fontWeight: '500', color: '#262626' }}>
                  {strategyConfig.param1.label}
                </div>
              </div>
            </Col>
            {!strategyConfig.isSingleParam && strategyConfig.param2 && (
              <Col span={strategyConfig.hasThirdParam ? 3 : 4}>
                <div style={{ 
                  textAlign: 'center',
                  padding: '12px',
                  background: 'white',
                  borderRadius: '8px',
                  border: '1px solid #e8e8e8'
                }}>
                  <div style={{ fontSize: '20px', fontWeight: '600', color: '#1890ff', marginBottom: '4px' }}>
                    {safeToFixed(stats.bestCombinationBySharpe[strategyConfig.param2.key], 0)}
                  </div>
                  <div style={{ fontSize: '12px', fontWeight: '500', color: '#262626' }}>
                    {strategyConfig.param2.label}
                  </div>
                </div>
              </Col>
            )}
            {strategyConfig.hasThirdParam && strategyConfig.param3 && (
              <Col span={3}>
                <div style={{ 
                  textAlign: 'center',
                  padding: '12px',
                  background: 'white',
                  borderRadius: '8px',
                  border: '1px solid #e8e8e8'
                }}>
                  <div style={{ fontSize: '20px', fontWeight: '600', color: '#1890ff', marginBottom: '4px' }}>
                    {safeToFixed(stats.bestCombinationBySharpe[strategyConfig.param3.key], 0)}
                  </div>
                  <div style={{ fontSize: '12px', fontWeight: '500', color: '#262626' }}>
                    {strategyConfig.param3.label}
                  </div>
                </div>
              </Col>
            )}
            <Col span={strategyConfig.hasThirdParam ? 3 : 4}>
              <div style={{ 
                textAlign: 'center',
                padding: '12px',
                background: 'white',
                borderRadius: '8px',
                border: '1px solid #e8e8e8'
              }}>
                <div style={{ fontSize: '20px', fontWeight: '600', color: '#722ed1', marginBottom: '4px' }}>
                  {safeToFixed(stats.bestCombinationBySharpe?.sharpeRatio, 2)}
                </div>
                <div style={{ fontSize: '12px', fontWeight: '500', color: '#262626' }}>
                  Sharpe Ratio
                </div>
              </div>
            </Col>
            <Col span={4}>
              <div style={{ 
                textAlign: 'center',
                padding: '12px',
                background: 'white',
                borderRadius: '8px',
                border: '1px solid #e8e8e8'
              }}>
                <div style={{ fontSize: '20px', fontWeight: '600', color: '#3f8600', marginBottom: '4px' }}>
                  {safePercent(stats.bestCombinationBySharpe?.totalReturn)}
                </div>
                <div style={{ fontSize: '12px', fontWeight: '500', color: '#262626' }}>
                  Total Return
                </div>
              </div>
            </Col>
            <Col span={4}>
              <div style={{ 
                textAlign: 'center',
                padding: '12px',
                background: 'white',
                borderRadius: '8px',
                border: '1px solid #e8e8e8'
              }}>
                <div style={{ fontSize: '20px', fontWeight: '600', color: '#cf1322', marginBottom: '4px' }}>
                  {safeToFixed(stats.bestCombinationBySharpe?.maxDrawdown, 2)}%
                </div>
                <div style={{ fontSize: '12px', fontWeight: '500', color: '#262626' }}>
                  Max Drawdown
                </div>
              </div>
            </Col>
            <Col span={4}>
              <div style={{ 
                textAlign: 'center',
                padding: '12px',
                background: 'white',
                borderRadius: '8px',
                border: '1px solid #e8e8e8'
              }}>
                <div style={{ fontSize: '20px', fontWeight: '600', color: '#fa8c16', marginBottom: '4px' }}>
                  {safeToFixed(stats.bestCombinationBySharpe?.winRate, 1)}%
                </div>
                <div style={{ fontSize: '12px', fontWeight: '500', color: '#262626' }}>
                  Win Rate
                </div>
              </div>
            </Col>
          </Row>
        </div>
      )}
      
      {/* Best by Return (alternative) */}
      {stats.bestCombinationByReturn && stats.bestCombinationByReturn !== stats.bestCombinationBySharpe && (
        <div style={{ 
          background: 'linear-gradient(135deg, #fff7e6 0%, #ffe7ba 100%)', 
          border: '1px solid #ffd591', 
          borderRadius: '12px', 
          padding: '24px',
          marginTop: '16px'
        }}>
          <div style={{ 
            fontSize: '16px', 
            fontWeight: '600', 
            color: '#d46b08', 
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center'
          }}>
            <span style={{ marginRight: '8px' }}>📈</span>
            Best Combination (by Total Return)
          </div>
          <Row gutter={[24, 16]}>
            <Col span={3}>
              <div style={{ 
                textAlign: 'center',
                padding: '12px',
                background: 'white',
                borderRadius: '8px',
                border: '1px solid #e8e8e8'
              }}>
                <div style={{ fontSize: '18px', fontWeight: '600', color: '#1890ff', marginBottom: '4px' }}>
                  {strategyConfig.isSingleParam ? (
                    <>{safeToFixed(stats.bestCombinationByReturn[strategyConfig.param1.key], 0)}</>
                  ) : strategyConfig.hasThirdParam && strategyConfig.param3 ? (
                    <>
                      {safeToFixed(stats.bestCombinationByReturn[strategyConfig.param1.key], 0)}/
                      {safeToFixed(stats.bestCombinationByReturn[strategyConfig.param2.key], 0)}/
                      {safeToFixed(stats.bestCombinationByReturn[strategyConfig.param3.key], 0)}
                    </>
                  ) : strategyConfig.param2 ? (
                    <>
                      {safeToFixed(stats.bestCombinationByReturn[strategyConfig.param1.key], 0)}/
                      {safeToFixed(stats.bestCombinationByReturn[strategyConfig.param2.key], 0)}
                    </>
                  ) : (
                    <>{safeToFixed(stats.bestCombinationByReturn[strategyConfig.param1.key], 0)}</>
                  )}
                </div>
                <div style={{ fontSize: '12px', fontWeight: '500', color: '#262626' }}>
                  {strategyConfig.pairLabel}
                </div>
              </div>
            </Col>
            <Col span={3}>
              <div style={{ 
                textAlign: 'center',
                padding: '12px',
                background: 'white',
                borderRadius: '8px',
                border: '1px solid #e8e8e8'
              }}>
                <div style={{ fontSize: '18px', fontWeight: '600', color: '#3f8600', marginBottom: '4px' }}>
                  {safePercent(stats.bestCombinationByReturn?.totalReturn)}
                </div>
                <div style={{ fontSize: '12px', fontWeight: '500', color: '#262626' }}>
                  Return
                </div>
              </div>
            </Col>
            <Col span={3}>
              <div style={{ 
                textAlign: 'center',
                padding: '12px',
                background: 'white',
                borderRadius: '8px',
                border: '1px solid #e8e8e8'
              }}>
                <div style={{ fontSize: '18px', fontWeight: '600', color: '#722ed1', marginBottom: '4px' }}>
                  {safeToFixed(stats.bestCombinationByReturn?.sharpeRatio, 2)}
                </div>
                <div style={{ fontSize: '12px', fontWeight: '500', color: '#262626' }}>
                  Sharpe
                </div>
              </div>
            </Col>
            <Col span={3}>
              <div style={{ 
                textAlign: 'center',
                padding: '12px',
                background: 'white',
                borderRadius: '8px',
                border: '1px solid #e8e8e8'
              }}>
                <div style={{ fontSize: '18px', fontWeight: '600', color: '#cf1322', marginBottom: '4px' }}>
                  {safeToFixed(stats.bestCombinationByReturn?.maxDrawdown, 2)}%
                </div>
                <div style={{ fontSize: '12px', fontWeight: '500', color: '#262626' }}>
                  Max DD
                </div>
              </div>
            </Col>
          </Row>
        </div>
      )}
    </div>
  );
};

export default OptimizationSummary;
