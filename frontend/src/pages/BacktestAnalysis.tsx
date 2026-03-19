import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Tag, Alert, Button, Space, Spin, Empty, message } from 'antd';
import { LineChartOutlined, BarChartOutlined, ReloadOutlined, ArrowUpOutlined, ArrowDownOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { backtraderAPI } from '../services/api';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, ReferenceLine } from 'recharts';

interface BacktestResult {
  backtestId: string;
  status: 'running' | 'completed' | 'failed';
  results?: {
    totalReturn: number;
    sharpeRatio: number;
    maxDrawdown: number;
    winRate: number;
    trades: number;
    annualizedReturn?: number;
    profitLoss?: number;
    equityCurve?: Array<{ date: string; equity: number }>;  // 权益曲线数据
    drawdownCurve?: Array<{ date: string; drawdown: number }>;  // 回撤曲线数据
    tradesList?: Array<{  // 交易列表
      entryDate: string;
      exitDate?: string;
      entryPrice: number;
      exitPrice?: number;
      pnl: number;
      returnPct: number;
      holdingDays?: number;
      position?: number;
      symbol?: string;
    }>;
    benchmarkReturn?: number;  // 基准回报
    benchmarkCurve?: Array<{ date: string; value: number }>;  // 基准曲线
  };
  parameters?: {
    strategy: string;
    symbols: string[];
    period: string;
    initialCapital: number;
  };
  createdAt?: string;
  symbol?: string;
  strategy?: string;
  startDate?: string;
  endDate?: string;
  initialCapital?: number;
  totalReturn?: number;
  sharpeRatio?: number;
  maxDrawdown?: number;
  winRate?: number;
  trades?: number;
}

const BacktestAnalysis: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [backtestData, setBacktestData] = useState<BacktestResult | null>(null);
  
  const backtestId = searchParams.get('backtestId');
  const symbol = searchParams.get('symbol');
  
  const safeToFixed = (value: any, decimals: number = 2): string => {
    if (typeof value === 'number' && !isNaN(value)) {
      return value.toFixed(decimals);
    }
    return '0.00';
  };
  
  const safeNumber = (value: any): number => {
    if (typeof value === 'number' && !isNaN(value)) {
      return value;
    }
    if (typeof value === 'string') {
      const parsed = parseFloat(value);
      return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  };
  
  // 辅助函数：格式化策略名称
  const formatStrategyName = (strategy: string): string => {
    if (!strategy) return 'Unknown';
    
    // 处理 snake_case 转 Title Case
    return strategy
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };
  
  // 辅助函数：格式化货币金额（千分位）
  const formatCurrency = (amount: number): string => {
    const safeAmount = safeNumber(amount);
    return safeAmount.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    });
  };
  
  // 辅助函数：获取 maxDrawdown 的绝对值（统一口径）
  const getAbsoluteDrawdown = (drawdown: any): number => {
    const value = safeNumber(drawdown);
    // 如果值是负数，取绝对值（例如 -15.25 → 15.25）
    // 如果值是正数，直接使用（例如 15.25 → 15.25）
    return Math.abs(value);
  };
  
  // 辅助函数：计算 Drawdown Y 轴范围（优化版）
  const getDrawdownYAxisRange = () => {
    const maxDrawdown = getAbsoluteDrawdown(backtestData?.results?.maxDrawdown || backtestData?.maxDrawdown);
    
    if (maxDrawdown <= 0) {
      return [-20, 0];  // 默认范围
    }
    
    // 计算合理的 Y 轴范围：min = maxDrawdown * 1.2
    const minValue = -Math.max(maxDrawdown * 1.2, maxDrawdown + 5);  // 至少比最大回撤多5%
    const maxValue = 0;
    
    // 确保范围合理：不超过 -30%
    const finalMin = Math.max(minValue, -30);
    
    return [finalMin, maxValue];
  };
  
  // 辅助函数：格式化 winRate（固定两位小数）
  const formatWinRate = (winRate: any): string => {
    const value = safeNumber(winRate);
    return value.toFixed(2);
  };
  
  // 辅助函数：计算交易统计 - 增强版
  const calculateTradeStats = () => {
    const trades = backtestData?.results?.tradesList || [];
    const totalTrades = trades.length;
    
    if (totalTrades === 0) {
      return {
        winTrades: 0,
        lossTrades: 0,
        winRate: 0,
        totalTrades: 0,
        avgWin: 0,
        avgLoss: 0,
        profitFactor: 0,
        avgTrade: 0,
        totalProfit: 0,
        totalLoss: 0
      };
    }
    
    const winTrades = trades.filter(trade => safeNumber(trade.pnl) > 0).length;
    const lossTrades = trades.filter(trade => safeNumber(trade.pnl) < 0).length;
    const winRate = totalTrades > 0 ? (winTrades / totalTrades) * 100 : 0;
    
    const winTradesData = trades.filter(trade => safeNumber(trade.pnl) > 0);
    const lossTradesData = trades.filter(trade => safeNumber(trade.pnl) < 0);
    
    const totalProfit = winTradesData.reduce((sum, trade) => sum + safeNumber(trade.pnl), 0);
    const totalLoss = Math.abs(lossTradesData.reduce((sum, trade) => sum + safeNumber(trade.pnl), 0));
    
    const avgWin = winTradesData.length > 0 ? totalProfit / winTradesData.length : 0;
    const avgLoss = lossTradesData.length > 0 ? totalLoss / lossTradesData.length : 0;
    
    // 计算 Profit Factor: total profit / total loss
    const profitFactor = totalLoss > 0 ? totalProfit / totalLoss : totalProfit > 0 ? 999 : 0;
    
    // 计算 Avg Trade: (total profit - total loss) / total trades
    const avgTrade = totalTrades > 0 ? (totalProfit - totalLoss) / totalTrades : 0;
    
    return {
      winTrades,
      lossTrades,
      winRate,
      totalTrades,
      avgWin,
      avgLoss,
      profitFactor,
      avgTrade,
      totalProfit,
      totalLoss
    };
  };
  
  // 辅助函数：生成交易统计图表数据
  const generateTradeChartData = () => {
    const stats = calculateTradeStats();
    
    return [
      { name: 'Win Trades', value: stats.winTrades, color: '#52c41a' },
      { name: 'Loss Trades', value: stats.lossTrades, color: '#ff4d4f' }
    ];
  };
  
  // 辅助函数：生成基准曲线数据（模拟 SPY Buy & Hold）
  const generateBenchmarkData = () => {
    const equityCurve = backtestData?.results?.equityCurve || [];
    const benchmarkCurve = backtestData?.results?.benchmarkCurve;
    
    if (benchmarkCurve && benchmarkCurve.length > 0) {
      return benchmarkCurve;
    }
    
    // 如果没有基准数据，返回空数组
    return [];
  };
  
  // 辅助函数：从 equity 计算 drawdown
  const calculateDrawdownFromEquity = (equityCurve: Array<{ date: string; equity: number }>) => {
    if (!equityCurve || equityCurve.length === 0) {
      return [];
    }
    
    const drawdownCurve = [];
    let runningMax = equityCurve[0].equity;
    
    for (let i = 0; i < equityCurve.length; i++) {
      const currentEquity = equityCurve[i].equity;
      
      // 更新 running_max
      if (currentEquity > runningMax) {
        runningMax = currentEquity;
      }
      
      // 计算 drawdown: equity / running_max - 1
      const drawdown = runningMax > 0 ? (currentEquity / runningMax - 1) * 100 : 0;
      
      drawdownCurve.push({
        date: equityCurve[i].date,
        drawdown: safeNumber(drawdown)
      });
    }
    
    return drawdownCurve;
  };
  
  // 辅助函数：获取 drawdown 数据（优先使用已有数据，否则从 equity 计算）
  const getDrawdownData = () => {
    if (backtestData?.results?.drawdownCurve && backtestData.results.drawdownCurve.length > 0) {
      return backtestData.results.drawdownCurve;
    }
    
    if (backtestData?.results?.equityCurve && backtestData.results.equityCurve.length > 0) {
      return calculateDrawdownFromEquity(backtestData.results.equityCurve);
    }
    
    return [];
  };
  
  // 辅助函数：计算 equity 的最小值和最大值（用于 Y 轴范围）- 优化版
  const getEquityRange = () => {
    const equityCurve = backtestData?.results?.equityCurve || [];
    
    if (equityCurve.length === 0) {
      return { min: 0, max: 100000 };
    }
    
    const equityValues = equityCurve.map(item => safeNumber(item.equity));
    const minEquity = Math.min(...equityValues);
    const maxEquity = Math.max(...equityValues);
    
    // 优化：使用 3% 的边距，让曲线更清晰
    // min = min(equity) * 0.97
    // max = max(equity) * 1.03
    const minRange = Math.max(0, minEquity * 0.97);  // 确保最小值不为负
    const maxRange = maxEquity * 1.03;
    
    // 如果范围太小，使用固定边距
    const range = maxEquity - minEquity;
    if (range < maxEquity * 0.01) {  // 如果波动小于 1%
      const margin = maxEquity * 0.02;  // 使用 2% 的固定边距
      return {
        min: Math.max(0, minEquity - margin),
        max: maxEquity + margin
      };
    }
    
    return {
      min: minRange,
      max: maxRange
    };
  };
  
  const fetchBacktestData = async () => {
    if (!backtestId) {
      setError('No backtest ID provided');
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      const response = await backtraderAPI.getBacktestResults(backtestId);
      
      if (response.data) {
        setBacktestData(response.data);
        setError('');
      } else {
        setError('No backtest data received');
      }
    } catch (err) {
      console.error('Failed to fetch backtest data:', err);
      setError('Failed to load backtest data');
      message.error('Failed to load backtest data');
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    if (backtestId) {
      fetchBacktestData();
    } else {
      setError('No backtest ID provided');
      setLoading(false);
    }
  }, [backtestId]);
  
  // 如果没有 backtestId，显示错误
  if (!backtestId) {
    return (
      <div>
        <h1 style={{ marginBottom: 24 }}>
          <BarChartOutlined /> Backtest Analysis
        </h1>
        <Alert
          message="Missing Backtest ID"
          description="Please provide a backtest ID to view analysis."
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <Button type="primary" onClick={() => navigate('/backtest')}>
          Go to Backtest Page
        </Button>
      </div>
    );
  }
  
  return (
    <div>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ marginBottom: '8px' }}>
            <BarChartOutlined /> Backtest Analysis
          </h1>
          <div style={{ fontSize: '14px', color: '#666' }}>
            Detailed analysis for the selected backtest
          </div>
        </div>
        <Button 
          type="default" 
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/')}
          style={{ marginTop: '8px' }}
        >
          Back to Dashboard
        </Button>
      </div>
      
      {error && (
        <Alert
          message="Error"
          description={error}
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          closable
          onClose={() => setError('')}
        />
      )}
      
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <Spin size="large" />
          <div style={{ marginTop: '16px', color: '#666' }}>Loading backtest analysis...</div>
        </div>
      ) : backtestData ? (
        <div>
          {/* 基础信息卡 - 优化版 */}
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col span={24}>
              <Card title="Backtest Information" size="small">
                <Row gutter={[16, 16]}>
                  {/* Symbol - 更突出 */}
                  <Col span={4}>
                    <div style={{ marginBottom: '4px' }}>
                      <div style={{ fontSize: '12px', color: '#666', fontWeight: '500', marginBottom: '4px' }}>
                        SYMBOL
                      </div>
                      <div style={{ 
                        fontSize: '24px', 
                        fontWeight: '700',
                        color: '#1890ff',
                        lineHeight: '1.2'
                      }}>
                        {backtestData.symbol || backtestData.parameters?.symbols?.[0] || 'N/A'}
                      </div>
                    </div>
                  </Col>
                  
                  {/* Strategy - 优化：格式化显示 */}
                  <Col span={4}>
                    <div style={{ marginBottom: '4px' }}>
                      <div style={{ fontSize: '12px', color: '#666', fontWeight: '500', marginBottom: '4px' }}>
                        STRATEGY
                      </div>
                      <div style={{ 
                        fontSize: '20px', 
                        fontWeight: '600',
                        color: '#262626',
                        lineHeight: '1.2',
                        wordBreak: 'break-word',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        maxHeight: '48px'
                      }}>
                        {formatStrategyName(backtestData.strategy || backtestData.parameters?.strategy || 'Unknown')}
                      </div>
                    </div>
                  </Col>
                  
                  {/* Period - 更整齐 */}
                  <Col span={5}>
                    <div style={{ marginBottom: '4px' }}>
                      <div style={{ fontSize: '12px', color: '#666', fontWeight: '500', marginBottom: '4px' }}>
                        PERIOD
                      </div>
                      <div style={{ 
                        fontSize: '14px', 
                        fontWeight: '500',
                        color: '#262626',
                        lineHeight: '1.3'
                      }}>
                        {backtestData.startDate && backtestData.endDate 
                          ? `${new Date(backtestData.startDate).toLocaleDateString()} - ${new Date(backtestData.endDate).toLocaleDateString()}`
                          : backtestData.parameters?.period || 'N/A'}
                      </div>
                    </div>
                  </Col>
                  
                  {/* Capital - 优化：千分位格式 */}
                  <Col span={4}>
                    <div style={{ marginBottom: '4px' }}>
                      <div style={{ fontSize: '12px', color: '#666', fontWeight: '500', marginBottom: '4px' }}>
                        CAPITAL
                      </div>
                      <div style={{ 
                        fontSize: '20px', 
                        fontWeight: '700',
                        color: '#262626',
                        lineHeight: '1.2'
                      }}>
                        ${formatCurrency(backtestData.initialCapital || backtestData.parameters?.initialCapital || 0)}
                      </div>
                    </div>
                  </Col>
                  
                  {/* Status Badge - 更像结果状态 */}
                  <Col span={7}>
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      height: '100%'
                    }}>
                      <div style={{ 
                        backgroundColor: backtestData.status === 'completed' ? '#f6ffed' : 
                                        backtestData.status === 'running' ? '#e6f7ff' : '#fff2f0',
                        border: `1px solid ${backtestData.status === 'completed' ? '#b7eb8f' : 
                                          backtestData.status === 'running' ? '#91d5ff' : '#ffccc7'}`,
                        borderRadius: '12px',
                        padding: '4px 12px',
                        display: 'inline-flex',
                        alignItems: 'center'
                      }}>
                        <div style={{ 
                          width: '8px', 
                          height: '8px', 
                          borderRadius: '50%',
                          backgroundColor: backtestData.status === 'completed' ? '#52c41a' : 
                                          backtestData.status === 'running' ? '#1890ff' : '#ff4d4f',
                          marginRight: '6px'
                        }} />
                        <span style={{ 
                          fontSize: '12px', 
                          fontWeight: '600',
                          color: backtestData.status === 'completed' ? '#389e0d' : 
                                 backtestData.status === 'running' ? '#096dd9' : '#cf1322',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px'
                        }}>
                          {backtestData.status}
                        </span>
                      </div>
                    </div>
                  </Col>
                </Row>
                
                {/* 元信息行 - 优化：弱化辅助信息 */}
                <div style={{ 
                  marginTop: '16px', 
                  paddingTop: '12px',
                  borderTop: '1px solid #f5f5f5',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '11px',
                  color: '#bfbfbf'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {backtestData.createdAt && (
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <span style={{ fontWeight: '400', marginRight: '4px', color: '#999' }}>Created:</span>
                        <span style={{ color: '#8c8c8c' }}>
                          {new Date(backtestData.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                    {backtestId && (
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <span style={{ fontWeight: '400', marginRight: '4px', color: '#999' }}>ID:</span>
                        <span style={{ 
                          fontFamily: "'Roboto Mono', monospace",
                          backgroundColor: '#fafafa',
                          padding: '1px 4px',
                          borderRadius: '2px',
                          fontSize: '10px',
                          color: '#8c8c8c',
                          border: '1px solid #f0f0f0'
                        }}>
                          {backtestId.substring(0, 10)}...
                        </span>
                      </div>
                    )}
                  </div>
                  
                  <div style={{ fontSize: '10px', color: '#d9d9d9', fontStyle: 'italic' }}>
                    Backtest Analysis
                  </div>
                </div>
              </Card>
            </Col>
          </Row>
          
          {/* Performance Metrics - 优化版 */}
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col span={24}>
              <Card title="Performance Metrics" size="small">
                <Row gutter={[16, 16]}>
                  {/* Total Return - 最重要指标，更突出 */}
                  <Col span={8}>
                    <div style={{ 
                      backgroundColor: '#fafafa',
                      borderRadius: '8px',
                      padding: '20px',
                      textAlign: 'center',
                      border: `2px solid ${safeNumber(backtestData.results?.totalReturn || backtestData.totalReturn) >= 0 ? '#d9f7be' : '#ffd8bf'}`
                    }}>
                      <div style={{ fontSize: '12px', color: '#666', fontWeight: '600', marginBottom: '8px', letterSpacing: '0.5px' }}>
                        TOTAL RETURN
                      </div>
                      <div style={{ 
                        fontSize: '36px', 
                        fontWeight: '700',
                        color: safeNumber(backtestData.results?.totalReturn || backtestData.totalReturn) >= 0 ? '#389e0d' : '#cf1322',
                        lineHeight: '1.1',
                        marginBottom: '4px'
                      }}>
                        {safeNumber(backtestData.results?.totalReturn || backtestData.totalReturn) >= 0 ? '+' : ''}
                        {safeToFixed(backtestData.results?.totalReturn || backtestData.totalReturn || 0, 2)}%
                      </div>
                      <div style={{ 
                        fontSize: '14px', 
                        color: safeNumber(backtestData.results?.totalReturn || backtestData.totalReturn) >= 0 ? '#389e0d' : '#cf1322',
                        fontWeight: '500',
                        marginBottom: '12px'
                      }}>
                        {safeNumber(backtestData.results?.totalReturn || backtestData.totalReturn) >= 0 ? 'PROFIT' : 'LOSS'}
                      </div>
                      <div style={{ 
                        fontSize: '11px', 
                        color: '#8c8c8c',
                        backgroundColor: '#f0f0f0',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        display: 'inline-block'
                      }}>
                        Overall Performance
                      </div>
                    </div>
                  </Col>
                  
                  {/* 次级指标 - 统一排版 */}
                  <Col span={16}>
                    <Row gutter={[16, 16]} style={{ height: '100%' }}>
                      {/* Sharpe Ratio */}
                      <Col span={8}>
                        <div style={{ 
                          backgroundColor: '#fafafa',
                          borderRadius: '6px',
                          padding: '16px',
                          height: '100%',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between'
                        }}>
                          <div>
                            <div style={{ fontSize: '11px', color: '#666', fontWeight: '600', marginBottom: '4px', letterSpacing: '0.5px' }}>
                              SHARPE RATIO
                            </div>
                            <div style={{ 
                              fontSize: '24px', 
                              fontWeight: '700',
                              color: safeNumber(backtestData.results?.sharpeRatio || backtestData.sharpeRatio) >= 1 ? '#389e0d' : 
                                     safeNumber(backtestData.results?.sharpeRatio || backtestData.sharpeRatio) >= 0 ? '#fa8c16' : '#cf1322',
                              lineHeight: '1.2'
                            }}>
                              {safeToFixed(backtestData.results?.sharpeRatio || backtestData.sharpeRatio || 0, 2)}
                            </div>
                          </div>
                          <div style={{ 
                            fontSize: '11px', 
                            color: '#8c8c8c',
                            marginTop: '8px'
                          }}>
                            Risk-adjusted return
                          </div>
                        </div>
                      </Col>
                      
                      {/* Max Drawdown - 优化：统一口径 */}
                      <Col span={8}>
                        <div style={{ 
                          backgroundColor: '#fafafa',
                          borderRadius: '6px',
                          padding: '16px',
                          height: '100%',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between'
                        }}>
                          <div>
                            <div style={{ fontSize: '11px', color: '#666', fontWeight: '600', marginBottom: '4px', letterSpacing: '0.5px' }}>
                              MAX DRAWDOWN
                            </div>
                            <div style={{ 
                              fontSize: '24px', 
                              fontWeight: '700',
                              color: getAbsoluteDrawdown(backtestData.results?.maxDrawdown || backtestData.maxDrawdown) <= 10 ? '#389e0d' : 
                                     getAbsoluteDrawdown(backtestData.results?.maxDrawdown || backtestData.maxDrawdown) <= 20 ? '#fa8c16' : '#cf1322',
                              lineHeight: '1.2'
                            }}>
                              {safeToFixed(getAbsoluteDrawdown(backtestData.results?.maxDrawdown || backtestData.maxDrawdown), 2)}%
                            </div>
                          </div>
                          <div style={{ 
                            fontSize: '11px', 
                            color: '#8c8c8c',
                            marginTop: '8px'
                          }}>
                            Worst peak-to-trough
                          </div>
                        </div>
                      </Col>
                      
                      {/* Win Rate - 优化：固定两位小数 */}
                      <Col span={8}>
                        <div style={{ 
                          backgroundColor: '#fafafa',
                          borderRadius: '6px',
                          padding: '16px',
                          height: '100%',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between'
                        }}>
                          <div>
                            <div style={{ fontSize: '11px', color: '#666', fontWeight: '600', marginBottom: '4px', letterSpacing: '0.5px' }}>
                              WIN RATE
                            </div>
                            <div style={{ 
                              fontSize: '24px', 
                              fontWeight: '700',
                              color: safeNumber(backtestData.results?.winRate || backtestData.winRate) >= 60 ? '#389e0d' : 
                                     safeNumber(backtestData.results?.winRate || backtestData.winRate) >= 50 ? '#fa8c16' : '#cf1322',
                              lineHeight: '1.2'
                            }}>
                              {safeToFixed(safeNumber(backtestData.results?.winRate || backtestData.winRate), 2)}%
                            </div>
                          </div>
                          <div style={{ 
                            fontSize: '11px', 
                            color: '#8c8c8c',
                            marginTop: '8px'
                          }}>
                            {backtestData.results?.trades || backtestData.trades || 0} trades
                          </div>
                        </div>
                      </Col>
                    </Row>
                  </Col>
                </Row>
                
                {/* 性能指标说明 */}
                <div style={{ 
                  marginTop: '16px',
                  paddingTop: '12px',
                  borderTop: '1px solid #f0f0f0',
                  fontSize: '11px',
                  color: '#8c8c8c',
                  display: 'flex',
                  justifyContent: 'space-between'
                }}>
                  <div>
                    <span style={{ fontWeight: '500', marginRight: '4px' }}>Performance Summary:</span>
                    {safeNumber(backtestData.results?.totalReturn || backtestData.totalReturn) >= 0 ? 'Positive' : 'Negative'} return with 
                    {safeNumber(backtestData.results?.sharpeRatio || backtestData.sharpeRatio) >= 1 ? ' strong' : 
                     safeNumber(backtestData.results?.sharpeRatio || backtestData.sharpeRatio) >= 0 ? ' moderate' : ' weak'} risk-adjusted performance
                  </div>
                  <div style={{ fontStyle: 'italic' }}>
                    Quant Analysis Panel
                  </div>
                </div>
              </Card>
            </Col>
          </Row>
          
          {/* Equity Curve with Benchmark */}
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col span={24}>
              <Card title="Equity Curve" size="small" style={{ marginTop: '8px' }}>
                {backtestData.results?.equityCurve && backtestData.results.equityCurve.length > 0 ? (
                  <div style={{ height: '320px' }}>  {/* 增加高度 */}
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={backtestData.results.equityCurve}
                        margin={{ top: 25, right: 30, left: 25, bottom: 25 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis 
                          dataKey="date" 
                          tick={{ fontSize: 11 }}
                          tickFormatter={(value) => {
                            const date = new Date(value);
                            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                          }}
                        />
                        <YAxis 
                          tick={{ fontSize: 11 }}
                          domain={[getEquityRange().min, getEquityRange().max]}
                          tickFormatter={(value) => {
                            if (value >= 1000000) {
                              return `$${(value / 1000000).toFixed(1)}M`;
                            } else if (value >= 1000) {
                              return `$${(value / 1000).toFixed(1)}K`;
                            }
                            return `$${value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
                          }}
                        />
                        <Tooltip 
                          formatter={(value: number, name: string) => {
                            if (name === 'Portfolio Value' || name === 'Benchmark (SPY)') {
                              return [`$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, name];
                            }
                            return [value, name];
                          }}
                          labelFormatter={(label) => `Date: ${new Date(label).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}`}
                        />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="equity"
                          name="Portfolio Value"
                          stroke="#1890ff"
                          strokeWidth={2}
                          dot={false}
                          activeDot={{ r: 6, stroke: '#1890ff', strokeWidth: 2, fill: '#fff' }}
                        />
                        {/* Benchmark Line - 如果数据可用 */}
                        {generateBenchmarkData().length > 0 && (
                          <Line
                            type="monotone"
                            dataKey="benchmark"
                            name="Benchmark (SPY)"
                            stroke="#ff7f0e"
                            strokeWidth={1.5}
                            strokeDasharray="5 5"
                            dot={false}
                            activeDot={{ r: 4, stroke: '#ff7f0e', strokeWidth: 1, fill: '#fff' }}
                          />
                        )}
                      </LineChart>
                    </ResponsiveContainer>
                    
                    {/* 图表说明 */}
                    <div style={{ 
                      marginTop: '16px',
                      marginBottom: '16px',  // 增加下边距，与下方图表保持间距
                      paddingTop: '16px',
                      borderTop: '1px solid #f0f0f0',
                      fontSize: '11px',
                      color: '#8c8c8c',
                      display: 'flex',
                      justifyContent: 'space-between'
                    }}>
                      <div>
                        <span style={{ fontWeight: '500', marginRight: '4px' }}>Data Points:</span>
                        {backtestData.results.equityCurve.length} points
                      </div>
                      <div>
                        <span style={{ fontWeight: '500', marginRight: '4px' }}>Initial Capital:</span>
                        ${formatCurrency(backtestData.initialCapital || backtestData.parameters?.initialCapital || 0)}
                      </div>
                      <div>
                        <span style={{ fontWeight: '500', marginRight: '4px' }}>Final Return:</span>
                        <span style={{ 
                          color: safeNumber(backtestData.results?.totalReturn || backtestData.totalReturn) >= 0 ? '#389e0d' : '#cf1322',
                          fontWeight: '600'
                        }}>
                          {safeNumber(backtestData.results?.totalReturn || backtestData.totalReturn) >= 0 ? '+' : ''}
                          {safeToFixed(backtestData.results?.totalReturn || backtestData.totalReturn || 0, 2)}%
                        </span>
                        {backtestData.results?.benchmarkReturn !== undefined && (
                          <span style={{ marginLeft: '8px', color: '#8c8c8c' }}>
                            (Benchmark: {safeToFixed(backtestData.results.benchmarkReturn, 2)}%)
                          </span>
                        )}
                      </div>
                    </div>
                    
                    {/* Benchmark 状态 */}
                    {generateBenchmarkData().length === 0 && (
                      <div style={{ 
                        marginTop: '8px',
                        padding: '6px 8px',
                        backgroundColor: '#f6ffed',
                        border: '1px solid #b7eb8f',
                        borderRadius: '4px',
                        fontSize: '10px',
                        color: '#389e0d'
                      }}>
                        <span style={{ fontWeight: '500' }}>Chart Ready:</span> Benchmark comparison feature available (requires benchmark data)
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ 
                    height: '300px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    backgroundColor: '#fafafa',
                    borderRadius: '4px'
                  }}>
                    <div style={{ textAlign: 'center', color: '#666' }}>
                      <LineChartOutlined style={{ fontSize: '48px', marginBottom: '16px', color: '#d9d9d9' }} />
                      <div style={{ fontSize: '16px', fontWeight: '500', marginBottom: '8px' }}>
                        No equity curve data available yet
                      </div>
                      <div style={{ fontSize: '14px', marginTop: '8px', color: '#8c8c8c' }}>
                        Equity curve data will be available when the backtest completes
                      </div>
                      <div style={{ fontSize: '12px', marginTop: '8px', color: '#bfbfbf' }}>
                        Total return: {safeToFixed(backtestData.results?.totalReturn || backtestData.totalReturn || 0, 2)}%
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            </Col>
          </Row>
          
          {/* Drawdown Curve - 自动计算版 */}
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col span={24}>
              <Card title="Drawdown Curve" size="small" style={{ marginTop: '24px' }}>
                {getDrawdownData().length > 0 ? (
                  <div style={{ height: '270px' }}>  {/* 增加高度 */}
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={getDrawdownData()}
                        margin={{ top: 25, right: 30, left: 25, bottom: 25 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis 
                          dataKey="date" 
                          tick={{ fontSize: 11 }}
                          tickFormatter={(value) => {
                            const date = new Date(value);
                            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                          }}
                        />
                        <YAxis 
                          tick={{ fontSize: 11 }}
                          tickFormatter={(value) => `${safeToFixed(value, 1)}%`}
                          domain={getDrawdownYAxisRange()}  // 基于最大回撤计算合理范围
                        />
                        <Tooltip 
                          formatter={(value: number) => [`${safeToFixed(value, 2)}%`, 'Drawdown']}
                          labelFormatter={(label) => `Date: ${new Date(label).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}`}
                        />
                        <Legend />
                        <Area
                          type="monotone"
                          dataKey="drawdown"
                          name="Drawdown"
                          stroke="#ff4d4f"
                          fill="#ffccc7"
                          fillOpacity={0.6}
                          strokeWidth={1.5}
                          activeDot={{ r: 4, stroke: '#ff4d4f', strokeWidth: 1, fill: '#fff' }}
                        />
                        
                        {/* 标记最大回撤点 */}
                        <ReferenceLine
                          y={-getAbsoluteDrawdown(backtestData?.results?.maxDrawdown || backtestData?.maxDrawdown)}
                          stroke="#722ed1"
                          strokeWidth={1.5}
                          strokeDasharray="3 3"
                          label={{
                            value: `Max DD: ${safeToFixed(getAbsoluteDrawdown(backtestData?.results?.maxDrawdown || backtestData?.maxDrawdown), 2)}%`,
                            position: 'insideBottomRight',
                            fill: '#722ed1',
                            fontSize: 10,
                            fontWeight: 'bold'
                          }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                    
                    {/* 图表说明 */}
                    <div style={{ 
                      marginTop: '16px',
                      paddingTop: '16px',
                      borderTop: '1px solid #f0f0f0',
                      fontSize: '11px',
                      color: '#8c8c8c',
                      display: 'flex',
                      justifyContent: 'space-between'
                    }}>
                      <div>
                        <span style={{ fontWeight: '500', marginRight: '4px' }}>Max Drawdown:</span>
                        <span style={{ 
                          color: getAbsoluteDrawdown(backtestData.results?.maxDrawdown || backtestData.maxDrawdown) <= 10 ? '#389e0d' : 
                                 getAbsoluteDrawdown(backtestData.results?.maxDrawdown || backtestData.maxDrawdown) <= 20 ? '#fa8c16' : '#cf1322',
                          fontWeight: '600'
                        }}>
                          {safeToFixed(getAbsoluteDrawdown(backtestData.results?.maxDrawdown || backtestData.maxDrawdown), 2)}%
                        </span>
                      </div>
                      <div>
                        <span style={{ fontWeight: '500', marginRight: '4px' }}>Data Points:</span>
                        {getDrawdownData().length} points
                      </div>
                      <div>
                        <span style={{ fontWeight: '500', marginRight: '4px' }}>Source:</span>
                        <span style={{ 
                          color: backtestData?.results?.drawdownCurve ? '#1890ff' : '#52c41a',
                          fontWeight: '600'
                        }}>
                          {backtestData?.results?.drawdownCurve ? 'Pre-calculated' : 'Calculated from Equity'}
                        </span>
                      </div>
                    </div>
                    
                    {/* 计算说明 */}
                    {!backtestData?.results?.drawdownCurve && (
                      <div style={{ 
                        marginTop: '8px',
                        padding: '6px 8px',
                        backgroundColor: '#f6ffed',
                        border: '1px solid #b7eb8f',
                        borderRadius: '4px',
                        fontSize: '10px',
                        color: '#389e0d'
                      }}>
                        <span style={{ fontWeight: '500' }}>Note:</span> Drawdown calculated from equity curve using formula: drawdown = equity / running_max - 1
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ 
                    height: '250px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    backgroundColor: '#fafafa',
                    borderRadius: '4px'
                  }}>
                    <div style={{ textAlign: 'center', color: '#666' }}>
                      <LineChartOutlined style={{ fontSize: '48px', marginBottom: '16px', color: '#d9d9d9' }} />
                      <div style={{ fontSize: '16px', fontWeight: '500', marginBottom: '8px' }}>
                        No drawdown data available
                      </div>
                      <div style={{ fontSize: '14px', marginTop: '8px', color: '#8c8c8c' }}>
                        Drawdown analysis requires equity curve data
                      </div>
                      <div style={{ fontSize: '12px', marginTop: '8px', color: '#bfbfbf' }}>
                        Max drawdown: {safeToFixed(getAbsoluteDrawdown(backtestData.results?.maxDrawdown || backtestData.maxDrawdown), 2)}%
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            </Col>
          </Row>
          
          {/* Trade Summary - 增强版 */}
          <Row gutter={[16, 16]}>
            <Col span={24}>
              <Card title="Trade Summary" size="small">
                {backtestData.results?.tradesList && backtestData.results.tradesList.length > 0 ? (
                  <div>
                    <Row gutter={[16, 16]}>
                      {/* 统计卡片 */}
                      <Col span={12}>
                        <div style={{ 
                          backgroundColor: '#fafafa',
                          borderRadius: '8px',
                          padding: '16px',
                          height: '200px',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between'
                        }}>
                          <div>
                            <div style={{ fontSize: '12px', color: '#666', fontWeight: '600', marginBottom: '12px', letterSpacing: '0.5px' }}>
                              TRADE STATISTICS
                            </div>
                            
                            <Row gutter={[8, 8]}>
                              <Col span={12}>
                                <div style={{ textAlign: 'center' }}>
                                  <div style={{ fontSize: '32px', fontWeight: '800', color: '#52c41a', lineHeight: '1.1' }}>
                                    {calculateTradeStats().winTrades}
                                  </div>
                                  <div style={{ fontSize: '10px', color: '#8c8c8c', marginTop: '6px', letterSpacing: '0.5px' }}>
                                    WIN TRADES
                                  </div>
                                </div>
                              </Col>
                              <Col span={12}>
                                <div style={{ textAlign: 'center' }}>
                                  <div style={{ fontSize: '32px', fontWeight: '800', color: '#ff4d4f', lineHeight: '1.1' }}>
                                    {calculateTradeStats().lossTrades}
                                  </div>
                                  <div style={{ fontSize: '10px', color: '#8c8c8c', marginTop: '6px', letterSpacing: '0.5px' }}>
                                    LOSS TRADES
                                  </div>
                                </div>
                              </Col>
                            </Row>
                            
                            <div style={{ marginTop: '20px' }}>
                              <div style={{ fontSize: '16px', fontWeight: '600', color: '#262626', marginBottom: '6px' }}>
                                <span style={{ color: '#8c8c8c', fontWeight: '500' }}>WIN RATE</span>
                                <span style={{ 
                                  color: calculateTradeStats().winRate >= 60 ? '#52c41a' : 
                                         calculateTradeStats().winRate >= 50 ? '#faad14' : '#ff4d4f',
                                  fontWeight: '800',
                                  fontSize: '20px',
                                  marginLeft: '8px'
                                }}>
                                  {safeToFixed(calculateTradeStats().winRate, 1)}%
                                </span>
                              </div>
                              <div style={{ fontSize: '11px', color: '#8c8c8c', marginTop: '4px' }}>
                                Total Trades: <span style={{ fontWeight: '600', color: '#262626' }}>{calculateTradeStats().totalTrades}</span>
                              </div>
                            </div>
                          </div>
                          
                          <div style={{ 
                            fontSize: '10px', 
                            color: '#bfbfbf',
                            marginTop: '8px',
                            lineHeight: '1.4'
                          }}>
                            <div>Avg Win: ${safeToFixed(calculateTradeStats().avgWin, 2)} | Avg Loss: ${safeToFixed(calculateTradeStats().avgLoss, 2)}</div>
                            <div>Profit Factor: {calculateTradeStats().profitFactor > 0 ? safeToFixed(calculateTradeStats().profitFactor, 2) : 'N/A'} | Avg Trade: ${safeToFixed(calculateTradeStats().avgTrade, 2)}</div>
                          </div>
                        </div>
                      </Col>
                      
                      {/* 饼图 - 修复甜甜圈图顶部裁切问题 */}
                      <Col span={12}>
                        <div style={{ 
                          backgroundColor: '#fafafa',
                          borderRadius: '8px',
                          padding: '20px 16px 8px 16px',  // 调整padding：增加上边距，减少下边距
                          height: '220px'  // 进一步增加总高度
                        }}>
                          <div style={{ 
                            fontSize: '12px', 
                            color: '#666', 
                            fontWeight: '600', 
                            marginBottom: '16px',  // 增加下边距，为甜甜圈腾出更多空间
                            letterSpacing: '0.5px',
                            textAlign: 'center'
                          }}>
                            TRADE DISTRIBUTION
                          </div>
                          
                          <div style={{ height: '176px' }}>  {/* 增加图表区域高度 */}
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart margin={{ top: 20, right: 0, bottom: 25, left: 0 }}>  {/* 大幅增加上边距，减少下边距 */}
                                <Pie
                                  data={generateTradeChartData()}
                                  cx="50%"
                                  cy="52%"  // 向下移动中心点，确保顶部完整显示
                                  innerRadius={36}  // 稍微减小内半径
                                  outerRadius={56}  // 减小外半径，确保完整显示
                                  paddingAngle={2}
                                  dataKey="value"
                                  labelLine={false}
                                >
                                  {generateTradeChartData().map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                  ))}
                                </Pie>
                                <Tooltip 
                                  formatter={(value: number, name: string) => [`${value} trades`, name]}
                                />
                                <Legend 
                                  verticalAlign="bottom"
                                  height={36}  // 调整图例高度
                                  iconSize={10}  // 增大图标大小
                                  wrapperStyle={{ 
                                    fontSize: '11px',  // 增大字体
                                    paddingTop: '12px',  // 增加图例上边距
                                    fontWeight: '500'
                                  }}
                                  formatter={(value) => <span style={{ fontSize: '11px', fontWeight: '500' }}>{value}</span>}
                                />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      </Col>
                    </Row>
                    
                    {/* 交易摘要 */}
                    <div style={{ 
                      marginTop: '16px',
                      paddingTop: '12px',
                      borderTop: '1px solid #f0f0f0',
                      fontSize: '11px',
                      color: '#8c8c8c'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <div>
                          <span style={{ fontWeight: '500', marginRight: '4px' }}>Trade Analysis:</span>
                          {calculateTradeStats().winRate >= 60 ? 'Strong' : 
                           calculateTradeStats().winRate >= 50 ? 'Moderate' : 'Weak'} performance with {calculateTradeStats().totalTrades} total trades
                        </div>
                        <div>
                          <span style={{ fontWeight: '500', marginRight: '4px' }}>Expectancy:</span>
                          <span style={{ 
                            color: (calculateTradeStats().avgWin * calculateTradeStats().winRate/100 + calculateTradeStats().avgLoss * (100-calculateTradeStats().winRate)/100) >= 0 ? '#52c41a' : '#ff4d4f',
                            fontWeight: '600'
                          }}>
                            ${safeToFixed(calculateTradeStats().avgWin * calculateTradeStats().winRate/100 + calculateTradeStats().avgLoss * (100-calculateTradeStats().winRate)/100, 2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ 
                    height: '200px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    backgroundColor: '#fafafa',
                    borderRadius: '4px'
                  }}>
                    <div style={{ textAlign: 'center', color: '#666' }}>
                      <BarChartOutlined style={{ fontSize: '48px', marginBottom: '16px', color: '#d9d9d9' }} />
                      <div style={{ fontSize: '16px', fontWeight: '500', marginBottom: '8px' }}>
                        No trade data available yet
                      </div>
                      <div style={{ fontSize: '14px', marginTop: '8px', color: '#8c8c8c' }}>
                        Detailed trade analysis requires trade list data
                      </div>
                      <div style={{ fontSize: '12px', marginTop: '8px', color: '#bfbfbf' }}>
                        Total trades: {backtestData.results?.trades || backtestData.trades || 0}
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            </Col>
          </Row>
          
          {/* 操作按钮 */}
          <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
            <Col span={24}>
              <Card size="small">
                <Space>
                  <Button 
                    icon={<ReloadOutlined />}
                    onClick={fetchBacktestData}
                    loading={loading}
                  >
                    Refresh Analysis
                  </Button>
                  <Button 
                    type="primary"
                    onClick={() => navigate('/backtest')}
                  >
                    Run New Backtest
                  </Button>
                  <Button 
                    onClick={() => navigate('/analytics')}
                  >
                    View Global Analytics
                  </Button>
                </Space>
              </Card>
            </Col>
          </Row>
        </div>
      ) : (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="Backtest data not found or failed to load"
        >
          <Space>
            <Button type="primary" onClick={fetchBacktestData}>
              Retry
            </Button>
            <Button onClick={() => navigate('/backtest')}>
              Go to Backtest Page
            </Button>
          </Space>
        </Empty>
      )}
    </div>
  );
};

export default BacktestAnalysis;