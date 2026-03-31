import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Typography, List, Tag, Button, Spin, Alert, Table } from 'antd';
import { LineChartOutlined, ArrowLeftOutlined, ReloadOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { backtraderAPI } from '../services/api';

// 添加一些内联样式
const styles = `
  .highlighted-row {
    background-color: #f0f7ff !important;
    border-left: 3px solid #1677ff !important;
  }
  
  .highlighted-row:hover {
    background-color: #e6f4ff !important;
  }
`;

const { Text, Title } = Typography;

// 类型定义
interface BacktestHistoryItem {
  backtestId: string;
  status: string;
  createdAt: string;
  parameters: {
    symbols: string[];
    strategy: string;
    startDate: string;
    endDate: string;
    initialCapital: number;
  };
  results: {
    totalReturn: number;
    annualizedReturn: number;
    sharpeRatio: number;
    sortinoRatio: number;
    maxDrawdown: number;
    volatility: number;
    winRate: number;
    profitFactor: number;
    trades: number;
    profitLoss: number;
    expectancy?: number;
    exposure?: number;
    equityCurve?: Array<{
      date: string;
      equity: number;
    }>;
  };
}

interface AnalyticsData {
  // KPI指标
  portfolioReturn: number;
  bestSharpe: number;
  worstDrawdown: number;
  avgWinRate: number;
  
  // Performance Summary
  totalBacktests: number;
  avgReturn: number;
  bestStrategy: string;
  bestSymbol: string;
  recentActivity: number;
  
  // Risk Summary
  avgVolatility: number;
  avgExposure: number;
  avgProfitFactor: number;
  avgExpectancy: number;
  
  // 图表数据
  equityTrendData: Array<{ date: string; value: number }>;
  scatterData: Array<{
    id: string;
    strategy: string;
    symbol: string;
    totalReturn: number;
    maxDrawdown: number;
    trades: number;
    sharpeRatio: number;
    winRate: number;
    createdAt: string;
    backtestId: string;
  }>;
  
  // 策略分析
  strategyBreakdown: Array<{
    strategy: string;
    count: number;
    avgReturn: number;
    avgSharpe: number;
    avgWinRate: number;
  }>;
  
  // 标的分布
  symbolDistribution: Array<{
    symbol: string;
    count: number;
    avgReturn: number;
  }>;
  
  // 最近回测
  recentBacktests: Array<{
    date: string;
    symbol: string;
    strategy: string;
    return: number;
    sharpe: number;
    maxDrawdown: number;
    status: string;
  }>;
  
  // 相关性矩阵
  correlationMatrix: {
    labels: string[];
    matrix: number[][];
  };
  
  // 风险暴露
  riskExposure: {
    symbolExposure: Array<{
      symbol: string;
      count: number;
      percentage: number;
    }>;
    strategyExposure: Array<{
      strategy: string;
      count: number;
      percentage: number;
    }>;
  };
  
  // 分散化影响
  diversificationImpact: {
    singleStrategyAvg: {
      return: number;
      sharpe: number;
      maxDrawdown: number;
    };
    portfolio: {
      return: number;
      sharpe: number;
      maxDrawdown: number;
    };
    change: {
      return: string; // "+X%" or "-X%"
      sharpe: string;
      maxDrawdown: string;
    };
    hasEnoughData: boolean;
  };
}

const Analytics: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  
  // 筛选器状态
  const [timeRange, setTimeRange] = useState<string>('all');
  const [selectedSymbol, setSelectedSymbol] = useState<string>('all');
  const [selectedStrategy, setSelectedStrategy] = useState<string>('all');
  const [allBacktests, setAllBacktests] = useState<BacktestHistoryItem[]>([]);
  const [filteredBacktests, setFilteredBacktests] = useState<BacktestHistoryItem[]>([]);
  
  // 可用的筛选选项
  const [availableSymbols, setAvailableSymbols] = useState<string[]>([]);
  const [availableStrategies, setAvailableStrategies] = useState<string[]>([]);
  
  // 高亮状态
  const [highlightedBacktest, setHighlightedBacktest] = useState<string | null>(null);
  
  // 添加样式
  useEffect(() => {
    const styleTag = document.createElement('style');
    styleTag.innerHTML = styles;
    document.head.appendChild(styleTag);
    
    return () => {
      document.head.removeChild(styleTag);
    };
  }, []);

  // 获取并处理数据
  const fetchAnalyticsData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await backtraderAPI.getBacktestHistory();
      
      if (response.data && response.data.history && Array.isArray(response.data.history)) {
        const history = response.data.history as BacktestHistoryItem[];
        
        // 保存所有backtests用于筛选
        setAllBacktests(history);
        
        // 提取可用的筛选选项
        const symbols = Array.from(new Set(
          history
            .filter(item => item.parameters?.symbols?.length > 0)
            .map(item => item.parameters.symbols[0])
            .filter(Boolean)
        )).sort();
        
        const strategies = Array.from(new Set(
          history
            .map(item => item.parameters?.strategy)
            .filter(Boolean)
        )).sort();
        
        setAvailableSymbols(['all', ...symbols]);
        setAvailableStrategies(['all', ...strategies]);
        
        // 应用当前筛选器
        applyFilters(history, timeRange, selectedSymbol, selectedStrategy);
      } else {
        setError('Invalid response format from backtest history API');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  // 应用筛选器
  const applyFilters = (
    backtests: BacktestHistoryItem[],
    timeRangeFilter: string,
    symbolFilter: string,
    strategyFilter: string
  ) => {
    let filtered = backtests.filter(item => 
      item.status === 'completed' && 
      item.results && 
      item.parameters?.symbols?.length > 0
    );

    // 时间范围筛选
    if (timeRangeFilter !== 'all') {
      const now = new Date();
      let cutoffDate = new Date();
      
      switch (timeRangeFilter) {
        case '7d':
          cutoffDate.setDate(now.getDate() - 7);
          break;
        case '30d':
          cutoffDate.setDate(now.getDate() - 30);
          break;
        case '90d':
          cutoffDate.setDate(now.getDate() - 90);
          break;
        default:
          break;
      }
      
      if (timeRangeFilter !== 'all') {
        filtered = filtered.filter(item => {
          const itemDate = new Date(item.createdAt);
          return itemDate >= cutoffDate;
        });
      }
    }

    // Symbol筛选
    if (symbolFilter !== 'all') {
      filtered = filtered.filter(item => 
        item.parameters.symbols[0] === symbolFilter
      );
    }

    // Strategy筛选
    if (strategyFilter !== 'all') {
      filtered = filtered.filter(item => 
        item.parameters.strategy === strategyFilter
      );
    }

    setFilteredBacktests(filtered);

    if (filtered.length === 0) {
      setAnalyticsData(null);
      setError('No completed backtest data available for the selected filters');
      return;
    }

    // 计算KPI指标
    const portfolioReturn = calculateAverage(filtered, 'totalReturn');
    const bestSharpe = Math.max(...filtered.map(item => item.results.sharpeRatio || 0));
    const worstDrawdown = Math.min(...filtered.map(item => item.results.maxDrawdown || 0));
    const avgWinRate = calculateAverage(filtered, 'winRate');

    // Performance Summary
    const totalBacktests = filtered.length;
    const avgReturn = portfolioReturn;
    const bestStrategy = findBestStrategy(filtered);
    const bestSymbol = findBestSymbol(filtered);
    const recentActivity = calculateRecentActivity(filtered);

    // Risk Summary
    const avgVolatility = calculateAverage(filtered, 'volatility');
    const avgExposure = calculateAverage(filtered, 'exposure', 75); // 默认值
    const avgProfitFactor = calculateAverage(filtered, 'profitFactor');
    const avgExpectancy = calculateAverage(filtered, 'expectancy', 0);

    // 图表数据
    const equityTrendData = prepareEquityTrendData(filtered);
    const scatterData = prepareScatterData(filtered);

    // 策略分析
    const strategyBreakdown = prepareStrategyBreakdown(filtered);

    // 标的分布
    const symbolDistribution = prepareSymbolDistribution(filtered);

    // 最近回测
    const recentBacktests = prepareRecentBacktests(filtered);

    // 计算相关性矩阵
    const correlationMatrix = getCorrelationMatrixData(filtered);
    
    // 计算风险暴露
    const riskExposure = calculateRiskExposure(filtered);
    
    // 计算分散化影响
    const diversificationImpact = calculateDiversificationImpact(filtered);

    setAnalyticsData({
      portfolioReturn,
      bestSharpe,
      worstDrawdown,
      avgWinRate,
      totalBacktests,
      avgReturn,
      bestStrategy,
      bestSymbol,
      recentActivity,
      avgVolatility,
      avgExposure,
      avgProfitFactor,
      avgExpectancy,
      equityTrendData,
      scatterData,
      strategyBreakdown,
      symbolDistribution,
      recentBacktests,
      correlationMatrix,
      riskExposure,
      diversificationImpact
    });

    setLastUpdated(new Date().toLocaleTimeString());
  };

  // 处理筛选器变化
  const handleTimeRangeChange = (value: string) => {
    setTimeRange(value);
    applyFilters(allBacktests, value, selectedSymbol, selectedStrategy);
  };

  const handleSymbolChange = (value: string) => {
    setSelectedSymbol(value);
    applyFilters(allBacktests, timeRange, value, selectedStrategy);
  };

  const handleStrategyChange = (value: string) => {
    setSelectedStrategy(value);
    applyFilters(allBacktests, timeRange, selectedSymbol, value);
  };

  // 辅助函数
  const calculateAverage = (data: BacktestHistoryItem[], field: keyof BacktestHistoryItem['results'], defaultValue: number = 0): number => {
    const values = data
      .map(item => item.results[field] as number)
      .filter(value => value !== undefined && value !== null);
    
    if (values.length === 0) return defaultValue;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  };

  const findBestStrategy = (data: BacktestHistoryItem[]): string => {
    const strategyReturns: Record<string, number[]> = {};
    
    data.forEach(item => {
      const strategy = item.parameters.strategy || 'Unknown';
      if (!strategyReturns[strategy]) {
        strategyReturns[strategy] = [];
      }
      strategyReturns[strategy].push(item.results.totalReturn || 0);
    });
    
    let bestStrategy = 'Unknown';
    let highestAvgReturn = -Infinity;
    
    Object.entries(strategyReturns).forEach(([strategy, returns]) => {
      const avgReturn = returns.reduce((sum, val) => sum + val, 0) / returns.length;
      if (avgReturn > highestAvgReturn) {
        highestAvgReturn = avgReturn;
        bestStrategy = strategy;
      }
    });
    
    return bestStrategy;
  };

  const findBestSymbol = (data: BacktestHistoryItem[]): string => {
    const symbolReturns: Record<string, number[]> = {};
    
    data.forEach(item => {
      const symbol = item.parameters.symbols?.[0] || 'Unknown';
      if (!symbolReturns[symbol]) {
        symbolReturns[symbol] = [];
      }
      symbolReturns[symbol].push(item.results.totalReturn || 0);
    });
    
    let bestSymbol = 'Unknown';
    let highestAvgReturn = -Infinity;
    
    Object.entries(symbolReturns).forEach(([symbol, returns]) => {
      const avgReturn = returns.reduce((sum, val) => sum + val, 0) / returns.length;
      if (avgReturn > highestAvgReturn) {
        highestAvgReturn = avgReturn;
        bestSymbol = symbol;
      }
    });
    
    return bestSymbol;
  };

  const calculateRecentActivity = (data: BacktestHistoryItem[]): number => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return data.filter(item => {
      const itemDate = new Date(item.createdAt);
      itemDate.setHours(0, 0, 0, 0);
      return itemDate.getTime() === today.getTime();
    }).length;
  };

  const prepareEquityTrendData = (data: BacktestHistoryItem[]): Array<{ date: string; value: number }> => {
    // 按时间排序
    const sortedData = [...data].sort((a, b) => 
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    
    // 模拟资金曲线：假设初始资金为100,000，每次回测按比例增长
    let cumulativeValue = 100000;
    const result: Array<{ date: string; value: number }> = [];
    
    sortedData.forEach((item, index) => {
      const returnRate = item.results.totalReturn || 0;
      cumulativeValue *= (1 + returnRate / 100);
      
      result.push({
        date: new Date(item.createdAt).toLocaleDateString(),
        value: parseFloat(cumulativeValue.toFixed(2))
      });
    });
    
    return result;
  };

  const prepareScatterData = (data: BacktestHistoryItem[]): Array<{
    id: string;
    strategy: string;
    symbol: string;
    totalReturn: number;
    maxDrawdown: number;
    trades: number;
    sharpeRatio: number;
    winRate: number;
    createdAt: string;
    backtestId: string;
  }> => {
    return data.map(item => ({
      id: item.backtestId,
      strategy: item.parameters.strategy || 'Unknown',
      symbol: item.parameters.symbols?.[0] || 'Unknown',
      totalReturn: item.results.totalReturn || 0,
      maxDrawdown: Math.abs(item.results.maxDrawdown || 0), // 取绝对值
      trades: item.results.trades || 0,
      sharpeRatio: item.results.sharpeRatio || 0,
      winRate: item.results.winRate || 0,
      createdAt: item.createdAt,
      backtestId: item.backtestId
    }));
  };

  const prepareStrategyBreakdown = (data: BacktestHistoryItem[]): Array<{
    strategy: string;
    count: number;
    avgReturn: number;
    avgSharpe: number;
    avgWinRate: number;
  }> => {
    const strategyMap: Record<string, {
      count: number;
      totalReturn: number;
      totalSharpe: number;
      totalWinRate: number;
    }> = {};
    
    data.forEach(item => {
      const strategy = item.parameters.strategy || 'Unknown';
      if (!strategyMap[strategy]) {
        strategyMap[strategy] = {
          count: 0,
          totalReturn: 0,
          totalSharpe: 0,
          totalWinRate: 0
        };
      }
      
      strategyMap[strategy].count++;
      strategyMap[strategy].totalReturn += item.results.totalReturn || 0;
      strategyMap[strategy].totalSharpe += item.results.sharpeRatio || 0;
      strategyMap[strategy].totalWinRate += item.results.winRate || 0;
    });
    
    return Object.entries(strategyMap).map(([strategy, stats]) => ({
      strategy,
      count: stats.count,
      avgReturn: parseFloat((stats.totalReturn / stats.count).toFixed(2)),
      avgSharpe: parseFloat((stats.totalSharpe / stats.count).toFixed(2)),
      avgWinRate: parseFloat((stats.totalWinRate / stats.count).toFixed(1))
    }));
  };

  const prepareSymbolDistribution = (data: BacktestHistoryItem[]): Array<{
    symbol: string;
    count: number;
    avgReturn: number;
  }> => {
    const symbolMap: Record<string, {
      count: number;
      totalReturn: number;
    }> = {};
    
    data.forEach(item => {
      const symbol = item.parameters.symbols?.[0] || 'Unknown';
      if (!symbolMap[symbol]) {
        symbolMap[symbol] = {
          count: 0,
          totalReturn: 0
        };
      }
      
      symbolMap[symbol].count++;
      symbolMap[symbol].totalReturn += item.results.totalReturn || 0;
    });
    
    return Object.entries(symbolMap)
      .map(([symbol, stats]) => ({
        symbol,
        count: stats.count,
        avgReturn: parseFloat((stats.totalReturn / stats.count).toFixed(2))
      }))
      .sort((a, b) => b.count - a.count) // 按数量降序
      .slice(0, 5); // 只取前5个
  };

  const prepareRecentBacktests = (data: BacktestHistoryItem[]): Array<{
    date: string;
    symbol: string;
    strategy: string;
    return: number;
    sharpe: number;
    maxDrawdown: number;
    status: string;
  }> => {
    return [...data]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) // 按时间倒序
      .slice(0, 5) // 只取最近5条
      .map(item => ({
        date: new Date(item.createdAt).toLocaleDateString(),
        symbol: item.parameters.symbols?.[0] || 'Unknown',
        strategy: item.parameters.strategy || 'Unknown',
        return: item.results.totalReturn || 0,
        sharpe: item.results.sharpeRatio || 0,
        maxDrawdown: item.results.maxDrawdown || 0,
        status: item.status
      }));
  };

  // ==================== Correlation Matrix 辅助函数 ====================



  // 计算Pearson相关系数
  const calculatePearsonCorrelation = (series1: number[], series2: number[]): number | null => {
    if (series1.length !== series2.length || series1.length < 3) {
      return null;
    }
    
    const n = series1.length;
    
    // 计算均值
    const mean1 = series1.reduce((sum, val) => sum + val, 0) / n;
    const mean2 = series2.reduce((sum, val) => sum + val, 0) / n;
    
    // 计算协方差和标准差
    let covariance = 0;
    let variance1 = 0;
    let variance2 = 0;
    
    for (let i = 0; i < n; i++) {
      const diff1 = series1[i] - mean1;
      const diff2 = series2[i] - mean2;
      
      covariance += diff1 * diff2;
      variance1 += diff1 * diff1;
      variance2 += diff2 * diff2;
    }
    
    // 计算相关系数
    if (variance1 === 0 || variance2 === 0) {
      return null;
    }
    
    const correlation = covariance / Math.sqrt(variance1 * variance2);
    
    // 处理浮点误差
    return Math.max(-1, Math.min(1, correlation));
  };

  // 对齐多个backtest的收益率序列（仅使用真实的equityCurve数据）
  const alignReturnSeries = (backtests: BacktestHistoryItem[]): Array<{
    id: string;
    label: string;
    returnSeries: number[];
    commonDates: string[];
  }> => {
    // 只处理有equityCurve数据的backtest
    const validBacktests = backtests.filter(bt => 
      bt.results?.equityCurve && 
      Array.isArray(bt.results.equityCurve) && 
      bt.results.equityCurve.length >= 10
    );
    
    if (validBacktests.length < 2) {
      return [];
    }
    
    // 为每个backtest提取收益率序列和日期（仅使用equityCurve）
    const seriesWithDates = validBacktests.map(backtest => {
      const equityCurve = backtest.results.equityCurve!; // 使用非空断言，因为已经过滤过
      const returnSeries: number[] = [];
      const dates: string[] = [];
      
      // 计算收益率序列和对应的日期
      for (let i = 1; i < equityCurve.length; i++) {
        const prevEquity = equityCurve[i-1].equity;
        const currEquity = equityCurve[i].equity;
        if (prevEquity > 0) {
          returnSeries.push((currEquity - prevEquity) / prevEquity);
          dates.push(equityCurve[i].date);
        }
      }
      
      // 如果没有足够的收益率数据，返回null
      if (returnSeries.length < 10) {
        return null;
      }
      
      return {
        id: backtest.backtestId,
        label: `${backtest.parameters.symbols[0]} - ${backtest.parameters.strategy}`,
        returnSeries,
        dates
      };
    }).filter((item): item is NonNullable<typeof item> => item !== null);
    
    if (seriesWithDates.length < 2) {
      return [];
    }
    
    // 找出所有日期
    const allDates = new Set<string>();
    seriesWithDates.forEach(data => {
      data.dates.forEach(date => {
        allDates.add(date);
      });
    });
    
    // 按日期排序
    const sortedDates = Array.from(allDates).sort();
    
    // 对齐收益率序列（按最短序列对齐，简化实现）
    // 找到最短的序列长度
    const minLength = Math.min(...seriesWithDates.map(data => data.returnSeries.length));
    if (minLength < 10) {
      return [];
    }
    
    // 截取所有序列到相同长度（从开头截取）
    const alignedSeries = seriesWithDates.map(data => ({
      id: data.id,
      label: data.label,
      returnSeries: data.returnSeries.slice(0, minLength),
      commonDates: data.dates.slice(0, minLength)
    }));
    
    return alignedSeries;
    
    // 只保留有足够共同数据点的序列
    return alignedSeries.filter(series => series.returnSeries.length >= 3);
  };

  // 计算相关性矩阵
  const calculateCorrelationMatrix = (alignedSeries: Array<{
    id: string;
    label: string;
    returnSeries: number[];
    commonDates: string[];
  }>): {
    labels: string[];
    matrix: number[][];
  } => {
    if (alignedSeries.length < 2) {
      return {
        labels: [],
        matrix: []
      };
    }
    
    const labels = alignedSeries.map(series => series.label);
    const n = alignedSeries.length;
    const matrix: number[][] = [];
    
    // 先初始化所有行
    for (let i = 0; i < n; i++) {
      matrix[i] = new Array(n).fill(NaN);
    }
    
    // 填充矩阵
    for (let i = 0; i < n; i++) {
      // 对角线为1
      matrix[i][i] = 1.0;
      
      // 只计算上三角部分
      for (let j = i + 1; j < n; j++) {
        // 计算相关系数
        const correlation = calculatePearsonCorrelation(
          alignedSeries[i].returnSeries,
          alignedSeries[j].returnSeries
        );
        const value = correlation !== null ? correlation : NaN;
        matrix[i][j] = value;
        matrix[j][i] = value; // 对称矩阵
      }
    }
    
    return {
      labels,
      matrix
    };
  };

  // 获取相关性矩阵数据（仅基于真实的equityCurve数据）
  const getCorrelationMatrixData = (backtests: BacktestHistoryItem[]) => {
    const alignedSeries = alignReturnSeries(backtests);
    if (alignedSeries.length < 2) {
      return {
        labels: [],
        matrix: []
      };
    }
    return calculateCorrelationMatrix(alignedSeries);
  };

  // 根据相关性值获取颜色
  const getCorrelationColor = (value: number): string => {
    if (isNaN(value)) return '#f5f5f5'; // N/A
    
    if (value > 0.7) return '#fff2e8'; // 高正相关 - 淡橙
    if (value > 0.3) return '#fffbe6'; // 中等相关 - 淡黄
    if (value > -0.3) return '#f6ffed'; // 低相关 - 淡绿
    return '#e6f7ff'; // 负相关 - 淡蓝
  };

  // 根据相关性值获取文字颜色
  const getCorrelationTextColor = (value: number): string => {
    if (isNaN(value)) return '#8c8c8c'; // N/A
    
    if (value > 0.7) return '#d46b08'; // 高正相关
    if (value > 0.3) return '#d4b106'; // 中等相关
    if (value > -0.3) return '#389e0d'; // 低相关
    return '#096dd9'; // 负相关
  };

  // ==================== Risk Exposure 辅助函数 ====================

  // 计算风险暴露
  const calculateRiskExposure = (backtests: BacktestHistoryItem[]) => {
    const symbolMap: Record<string, number> = {};
    const strategyMap: Record<string, number> = {};
    const total = backtests.length;
    
    backtests.forEach(backtest => {
      const symbol = backtest.parameters.symbols[0] || 'Unknown';
      const strategy = backtest.parameters.strategy || 'Unknown';
      
      symbolMap[symbol] = (symbolMap[symbol] || 0) + 1;
      strategyMap[strategy] = (strategyMap[strategy] || 0) + 1;
    });
    
    // 转换为数组并计算百分比
    const symbolExposure = Object.entries(symbolMap)
      .map(([symbol, count]) => ({
        symbol,
        count,
        percentage: total > 0 ? (count / total) * 100 : 0
      }))
      .sort((a, b) => b.count - a.count);
    
    const strategyExposure = Object.entries(strategyMap)
      .map(([strategy, count]) => ({
        strategy,
        count,
        percentage: total > 0 ? (count / total) * 100 : 0
      }))
      .sort((a, b) => b.count - a.count);
    
    return {
      symbolExposure,
      strategyExposure
    };
  };

  // ==================== Diversification Impact 辅助函数 ====================

  // ==================== 真实组合计算辅助函数 ====================

  // 从equityCurve计算日收益率序列
  const calculateReturnSeriesFromEquityCurve = (equityCurve: Array<{date: string; equity: number}>): number[] => {
    if (!equityCurve || equityCurve.length < 2) return [];
    
    const returns: number[] = [];
    for (let i = 1; i < equityCurve.length; i++) {
      const prevEquity = equityCurve[i-1].equity;
      const currEquity = equityCurve[i].equity;
      if (prevEquity > 0) {
        returns.push((currEquity - prevEquity) / prevEquity);
      } else {
        returns.push(0);
      }
    }
    return returns;
  };





  // 从收益率序列计算夏普比率（年化，假设252个交易日）
  const calculateSharpeFromReturns = (returns: number[]): number => {
    if (returns.length < 10) return 0;
    
    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);
    
    if (stdDev === 0) return 0;
    
    // 年化夏普比率：日收益率均值 * √252 / 日收益率标准差
    const annualizedSharpe = (mean * Math.sqrt(252)) / stdDev;
    return annualizedSharpe;
  };

  // 从收益率序列计算最大回撤
  const calculateMaxDrawdownFromReturns = (returns: number[]): number => {
    if (returns.length < 10) return 0;
    
    let cumulative = 1.0;
    let peak = 1.0;
    let maxDrawdown = 0;
    
    for (const r of returns) {
      cumulative *= (1 + r);
      if (cumulative > peak) {
        peak = cumulative;
      }
      const drawdown = (peak - cumulative) / peak;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }
    
    return maxDrawdown * 100; // 转换为百分比
  };

  // 从收益率序列计算总回报
  const calculateTotalReturnFromReturns = (returns: number[]): number => {
    if (returns.length < 10) return 0;
    
    let cumulative = 1.0;
    for (const r of returns) {
      cumulative *= (1 + r);
    }
    return (cumulative - 1) * 100; // 转换为百分比
  };

  // ==================== 真实分散化影响计算（equity-based） ====================

  // 计算分散化影响（基于真实equityCurve数据，equity-based方法）
  const calculateDiversificationImpact = (backtests: BacktestHistoryItem[]) => {
    // 检查是否有足够的数据
    const validBacktests = backtests.filter(bt => 
      bt.results?.equityCurve && 
      Array.isArray(bt.results.equityCurve) && 
      bt.results.equityCurve.length >= 10
    );
    
    if (validBacktests.length < 2) {
      return {
        singleStrategyAvg: {
          return: 0,
          sharpe: 0,
          maxDrawdown: 0
        },
        portfolio: {
          return: 0,
          sharpe: 0,
          maxDrawdown: 0
        },
        change: {
          return: "N/A",
          sharpe: "N/A",
          maxDrawdown: "N/A"
        },
        hasEnoughData: false,
        reason: validBacktests.length < 2 ? "至少需要2个有equityCurve数据的backtest" : "equityCurve数据不足"
      };
    }
    
    // 1. 提取所有equityCurve并计算单策略指标
    const allEquityCurves: Array<{date: string; equity: number}>[] = [];
    const singleStrategyMetrics: Array<{return: number; sharpe: number; maxDrawdown: number}> = [];
    
    for (const backtest of validBacktests) {
      const equityCurve = backtest.results.equityCurve!; // 使用非空断言，因为已经过滤过
      
      if (equityCurve.length >= 10) {
        allEquityCurves.push(equityCurve);
        
        // 计算单策略指标（从equityCurve计算）
        const returnSeries = calculateReturnSeriesFromEquityCurve(equityCurve);
        if (returnSeries.length >= 10) {
          singleStrategyMetrics.push({
            return: calculateTotalReturnFromReturns(returnSeries),
            sharpe: calculateSharpeFromReturns(returnSeries),
            maxDrawdown: calculateMaxDrawdownFromReturns(returnSeries)
          });
        }
      }
    }
    
    if (allEquityCurves.length < 2 || singleStrategyMetrics.length < 2) {
      return {
        singleStrategyAvg: {
          return: 0,
          sharpe: 0,
          maxDrawdown: 0
        },
        portfolio: {
          return: 0,
          sharpe: 0,
          maxDrawdown: 0
        },
        change: {
          return: "N/A",
          sharpe: "N/A",
          maxDrawdown: "N/A"
        },
        hasEnoughData: false,
        reason: "有效equityCurve数据不足"
      };
    }
    
    // 2. 提取所有日期并找到共同日期集合
    // 为每个equityCurve创建日期到equity的映射
    const dateToEquityMaps: Map<string, number>[] = allEquityCurves.map(curve => {
      const map = new Map<string, number>();
      curve.forEach(point => {
        map.set(point.date, point.equity);
      });
      return map;
    });
    
    // 找到所有equityCurve都有的共同日期
    const allDates = new Set<string>();
    allEquityCurves[0].forEach(point => allDates.add(point.date));
    
    for (let i = 1; i < allEquityCurves.length; i++) {
      const currentDates = new Set<string>();
      allEquityCurves[i].forEach(point => currentDates.add(point.date));
      
      // 取交集
      const intersection = new Set<string>();
      allDates.forEach(date => {
        if (currentDates.has(date)) {
          intersection.add(date);
        }
      });
      allDates.clear();
      intersection.forEach(date => allDates.add(date));
    }
    
    // 按日期排序
    const commonDates = Array.from(allDates).sort();
    
    if (commonDates.length < 10) {
      return {
        singleStrategyAvg: {
          return: 0,
          sharpe: 0,
          maxDrawdown: 0
        },
        portfolio: {
          return: 0,
          sharpe: 0,
          maxDrawdown: 0
        },
        change: {
          return: "N/A",
          sharpe: "N/A",
          maxDrawdown: "N/A"
        },
        hasEnoughData: false,
        reason: `共同日期不足（${commonDates.length}个），需要至少10个共同日期`
      };
    }
    
    // 3. 计算单策略平均值
    const singleStrategyAvg = {
      return: singleStrategyMetrics.reduce((sum, m) => sum + m.return, 0) / singleStrategyMetrics.length,
      sharpe: singleStrategyMetrics.reduce((sum, m) => sum + m.sharpe, 0) / singleStrategyMetrics.length,
      maxDrawdown: singleStrategyMetrics.reduce((sum, m) => sum + m.maxDrawdown, 0) / singleStrategyMetrics.length
    };
    
    // 4. 构造组合equity（等权重平均，基于共同日期）
    const portfolioEquityCurve: Array<{date: string; equity: number}> = [];
    
    for (const date of commonDates) {
      let sumEquity = 0;
      let validCount = 0;
      
      for (const equityMap of dateToEquityMaps) {
        const equity = equityMap.get(date);
        if (equity !== undefined) {
          sumEquity += equity;
          validCount++;
        }
      }
      
      // 只有所有策略都有该日期的数据时才计算
      if (validCount === dateToEquityMaps.length) {
        const avgEquity = sumEquity / validCount;
        portfolioEquityCurve.push({
          date,
          equity: avgEquity
        });
      }
    }
    
    // 检查组合equityCurve是否有足够的数据点
    if (portfolioEquityCurve.length < 10) {
      return {
        singleStrategyAvg: {
          return: 0,
          sharpe: 0,
          maxDrawdown: 0
        },
        portfolio: {
          return: 0,
          sharpe: 0,
          maxDrawdown: 0
        },
        change: {
          return: "N/A",
          sharpe: "N/A",
          maxDrawdown: "N/A"
        },
        hasEnoughData: false,
        reason: `组合equityCurve数据点不足（${portfolioEquityCurve.length}个），需要至少10个数据点`
      };
    }
    
    // 5. 从组合equityCurve计算指标
    const portfolioReturnSeries = calculateReturnSeriesFromEquityCurve(portfolioEquityCurve);
    const portfolio = {
      return: calculateTotalReturnFromReturns(portfolioReturnSeries),
      sharpe: calculateSharpeFromReturns(portfolioReturnSeries),
      maxDrawdown: calculateMaxDrawdownFromReturns(portfolioReturnSeries)
    };
    
    // 6. 计算变化
    const calculateChange = (portfolioValue: number, singleValue: number, higherIsBetter: boolean = true) => {
      if (Math.abs(singleValue) < 0.001) return "N/A";
      const change = ((portfolioValue - singleValue) / Math.abs(singleValue)) * 100;
      const sign = change >= 0 ? "+" : "";
      return `${sign}${change.toFixed(1)}%`;
    };
    
    const change = {
      return: calculateChange(portfolio.return, singleStrategyAvg.return, true),
      sharpe: calculateChange(portfolio.sharpe, singleStrategyAvg.sharpe, true),
      maxDrawdown: calculateChange(portfolio.maxDrawdown, singleStrategyAvg.maxDrawdown, false) // lower is better
    };
    
    return {
      singleStrategyAvg,
      portfolio,
      change,
      hasEnoughData: true,
      reason: `基于${validBacktests.length}个有效backtest的equityCurve数据计算（equity-based组合）`
    };
  };

  // 初始化加载数据
  useEffect(() => {
    fetchAnalyticsData();
  }, []);

  // 渲染函数
  const renderKPICard = (title: string, value: number | string, color: string, suffix: string = '', description: string) => (
    <Card 
      title={title} 
      size="small"
      style={{ height: '100%' }}
    >
      <div style={{ textAlign: 'center', padding: '16px 0' }}>
        <div style={{ 
          fontSize: '28px', 
          fontWeight: '800', 
          color: color, 
          lineHeight: '1.1',
          marginBottom: '8px'
        }}>
          {typeof value === 'number' ? value.toFixed(2) : value}{suffix}
        </div>
        <div style={{ 
          fontSize: '13px', 
          color: '#595959', 
          fontWeight: '500',
          lineHeight: '1.4'
        }}>
          {description}
        </div>
      </div>
    </Card>
  );

  const renderSummaryItem = (label: string, value: string | number, color?: string, tag?: string) => (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'space-between', 
      alignItems: 'center', 
      padding: '12px 0',
      borderBottom: '1px solid #f0f0f0'
    }}>
      <Text style={{ color: '#595959', fontSize: '14px', fontWeight: '500' }}>{label}</Text>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Text strong style={{ 
          color: color || '#262626',
          fontSize: '16px',
          fontWeight: '600'
        }}>
          {typeof value === 'number' ? value.toFixed(2) : value}
        </Text>
        {tag && (
          <Tag 
            color={
              tag === 'Good' ? 'success' : 
              tag === 'Medium' ? 'warning' : 'error'
            } 
            style={{ fontSize: '11px', padding: '1px 6px' }}
          >
            {tag}
          </Tag>
        )}
      </div>
    </div>
  );

  const getVolatilityTag = (volatility: number): string => {
    if (volatility < 15) return 'Low';
    if (volatility < 25) return 'Medium';
    return 'High';
  };

  const getExposureTag = (exposure: number): string => {
    if (exposure < 60) return 'Low';
    if (exposure < 80) return 'Medium';
    return 'High';
  };

  const getProfitFactorTag = (pf: number): string => {
    if (pf < 1.2) return 'Poor';
    if (pf < 1.5) return 'Fair';
    if (pf < 2.0) return 'Good';
    return 'Excellent';
  };

  // 主渲染
  if (loading) {
    return (
      <div style={{ padding: '48px', textAlign: 'center' }}>
        <Spin size="large" />
        <div style={{ marginTop: '16px', color: '#595959' }}>Loading portfolio analytics...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '24px' }}>
        <Alert
          message="Analytics Error"
          description={error}
          type="error"
          showIcon
          action={
            <Button size="small" onClick={fetchAnalyticsData}>
              Retry
            </Button>
          }
        />
      </div>
    );
  }

  if (!analyticsData) {
    return (
      <div style={{ padding: '48px', textAlign: 'center' }}>
        <div style={{ fontSize: '16px', color: '#595959', marginBottom: '16px' }}>
          No completed backtest data available for analytics
        </div>
        <Button type="primary" onClick={() => navigate('/backtest')}>
          Run Your First Backtest
        </Button>
      </div>
    );
  }

  const {
    portfolioReturn,
    bestSharpe,
    worstDrawdown,
    avgWinRate,
    totalBacktests,
    avgReturn,
    bestStrategy,
    bestSymbol,
    recentActivity,
    avgVolatility,
    avgExposure,
    avgProfitFactor,
    avgExpectancy,
    strategyBreakdown,
    symbolDistribution,
    recentBacktests
  } = analyticsData;

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* 第1层：页面头部 */}
      <div style={{ 
        marginBottom: '32px', 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'flex-start' 
      }}>
        <div>
          <Title level={2} style={{ marginBottom: '8px' }}>
            <LineChartOutlined /> Portfolio Analytics
          </Title>
          <div style={{ color: '#666', fontSize: '16px', maxWidth: '800px' }}>
            Portfolio-level insights based on completed backtests and strategy performance.
            {lastUpdated && (
              <span style={{ marginLeft: '12px', fontSize: '14px', color: '#8c8c8c' }}>
                Last updated: {lastUpdated}
              </span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px', alignItems: 'flex-end' }}>
          {/* 筛选器 */}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {/* 时间范围筛选 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '13px', color: '#595959', fontWeight: '500' }}>Time:</span>
              <div style={{ display: 'flex', gap: '4px' }}>
                {['all', '7d', '30d', '90d'].map((range) => (
                  <button
                    key={range}
                    onClick={() => handleTimeRangeChange(range)}
                    style={{
                      padding: '4px 8px',
                      fontSize: '12px',
                      fontWeight: timeRange === range ? '600' : '400',
                      backgroundColor: timeRange === range ? '#1677ff' : '#f5f5f5',
                      color: timeRange === range ? 'white' : '#595959',
                      border: '1px solid',
                      borderColor: timeRange === range ? '#1677ff' : '#d9d9d9',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      minWidth: '40px'
                    }}
                  >
                    {range === 'all' ? 'All' : range.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Symbol筛选 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '13px', color: '#595959', fontWeight: '500' }}>Symbol:</span>
              <select
                value={selectedSymbol}
                onChange={(e) => handleSymbolChange(e.target.value)}
                style={{
                  padding: '4px 8px',
                  fontSize: '12px',
                  border: '1px solid #d9d9d9',
                  borderRadius: '4px',
                  backgroundColor: 'white',
                  color: '#262626',
                  minWidth: '100px',
                  cursor: 'pointer'
                }}
              >
                {availableSymbols.map((symbol) => (
                  <option key={symbol} value={symbol}>
                    {symbol === 'all' ? 'All Symbols' : symbol}
                  </option>
                ))}
              </select>
            </div>

            {/* Strategy筛选 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '13px', color: '#595959', fontWeight: '500' }}>Strategy:</span>
              <select
                value={selectedStrategy}
                onChange={(e) => handleStrategyChange(e.target.value)}
                style={{
                  padding: '4px 8px',
                  fontSize: '12px',
                  border: '1px solid #d9d9d9',
                  borderRadius: '4px',
                  backgroundColor: 'white',
                  color: '#262626',
                  minWidth: '120px',
                  cursor: 'pointer'
                }}
              >
                {availableStrategies.map((strategy) => (
                  <option key={strategy} value={strategy}>
                    {strategy === 'all' ? 'All Strategies' : strategy}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 操作按钮 */}
          <div style={{ display: 'flex', gap: '12px' }}>
            <Button 
              type="default" 
              icon={<ReloadOutlined />}
              onClick={fetchAnalyticsData}
              loading={loading}
              size="small"
            >
              Refresh
            </Button>
            <Button 
              type="default" 
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate('/')}
              size="small"
            >
              Back to Dashboard
            </Button>
          </div>
        </div>
      </div>

      {/* 第2层：核心KPI总览 */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={24} sm={12} lg={6}>
          {renderKPICard(
            'Portfolio Return',
            portfolioReturn,
            portfolioReturn >= 0 ? '#389e0d' : '#cf1322',
            '%',
            'Average return across all completed backtests'
          )}
        </Col>
        <Col xs={24} sm={12} lg={6}>
          {renderKPICard(
            'Best Sharpe',
            bestSharpe,
            '#096dd9',
            '',
            'Highest Sharpe ratio in backtest history'
          )}
        </Col>
        <Col xs={24} sm={12} lg={6}>
          {renderKPICard(
            'Worst Drawdown',
            worstDrawdown,
            '#cf1322',
            '%',
            'Maximum drawdown across all backtests'
          )}
        </Col>
        <Col xs={24} sm={12} lg={6}>
          {renderKPICard(
            'Win Rate',
            avgWinRate,
            '#d46b08',
            '%',
            'Average win rate across all strategies'
          )}
        </Col>
      </Row>

      {/* 第3层：两个Summary面板 */}
      <Row gutter={[20, 20]} style={{ marginBottom: '24px' }}>
        <Col xs={24} lg={12}>
          <Card 
            title="Performance Summary" 
            size="small"
            style={{ height: '100%' }}
          >
            <div style={{ padding: '8px 0' }}>
              {renderSummaryItem('Total Backtests', totalBacktests, '#096dd9')}
              {renderSummaryItem('Avg Return', `${avgReturn >= 0 ? '+' : ''}${avgReturn.toFixed(2)}%`, avgReturn >= 0 ? '#389e0d' : '#cf1322')}
              {renderSummaryItem('Best Strategy', bestStrategy, '#d46b08')}
              {renderSummaryItem('Best Symbol', bestSymbol, '#722ed1')}
              {renderSummaryItem('Recent Activity', `${recentActivity} today`, '#13c2c2')}
            </div>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card 
            title="Risk Summary" 
            size="small"
            style={{ height: '100%' }}
          >
            <div style={{ padding: '8px 0' }}>
              {renderSummaryItem('Avg Volatility', `${avgVolatility.toFixed(2)}%`, '#262626', getVolatilityTag(avgVolatility))}
              {renderSummaryItem('Avg Exposure', `${avgExposure.toFixed(1)}%`, '#262626', getExposureTag(avgExposure))}
              {renderSummaryItem('Avg Profit Factor', avgProfitFactor.toFixed(2), '#262626', getProfitFactorTag(avgProfitFactor))}
              {renderSummaryItem('Avg Expectancy', `$${avgExpectancy.toFixed(0)}`, '#262626')}
            </div>
          </Card>
        </Col>
      </Row>

      {/* 第4层：Risk Exposure */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={24} lg={12}>
          <Card 
            title="Risk Exposure" 
            size="small"
          >
            <div style={{ padding: '16px' }}>
              <div style={{ fontSize: '14px', color: '#595959', marginBottom: '16px' }}>
                <div>Exposure based on backtest count distribution (not capital-weighted).</div>
                <div style={{ fontSize: '12px', color: '#8c8c8c', marginTop: '4px' }}>
                  Shows concentration risk based on number of backtests per symbol/strategy.
                </div>
              </div>
              
              {analyticsData?.riskExposure ? (
                <div>
                  {/* Symbol Exposure */}
                  <div style={{ marginBottom: '24px' }}>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: '#262626', marginBottom: '12px' }}>
                      Symbol Exposure
                    </div>
                    {analyticsData.riskExposure.symbolExposure.length > 0 ? (
                      analyticsData.riskExposure.symbolExposure.map((item, index) => (
                        <div key={index} style={{ marginBottom: '12px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <span style={{ fontSize: '13px', fontWeight: '500', color: '#262626' }}>
                              {item.symbol}
                            </span>
                            <span style={{ fontSize: '13px', color: '#595959' }}>
                              {item.count} backtests ({item.percentage.toFixed(1)}%)
                            </span>
                          </div>
                          <div style={{ 
                            width: '100%', 
                            height: '8px', 
                            backgroundColor: '#f0f0f0',
                            borderRadius: '4px',
                            overflow: 'hidden'
                          }}>
                            <div style={{ 
                              width: `${item.percentage}%`, 
                              height: '100%', 
                              backgroundColor: '#096dd9',
                              borderRadius: '4px'
                            }}></div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div style={{ textAlign: 'center', padding: '16px', color: '#8c8c8c', fontSize: '13px' }}>
                        No symbol exposure data available
                      </div>
                    )}
                  </div>
                  
                  {/* Strategy Exposure */}
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: '#262626', marginBottom: '12px' }}>
                      Strategy Exposure
                    </div>
                    {analyticsData.riskExposure.strategyExposure.length > 0 ? (
                      analyticsData.riskExposure.strategyExposure.map((item, index) => (
                        <div key={index} style={{ marginBottom: '12px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <span style={{ fontSize: '13px', fontWeight: '500', color: '#262626' }}>
                              {item.strategy}
                            </span>
                            <span style={{ fontSize: '13px', color: '#595959' }}>
                              {item.count} backtests ({item.percentage.toFixed(1)}%)
                            </span>
                          </div>
                          <div style={{ 
                            width: '100%', 
                            height: '8px', 
                            backgroundColor: '#f0f0f0',
                            borderRadius: '4px',
                            overflow: 'hidden'
                          }}>
                            <div style={{ 
                              width: `${item.percentage}%`, 
                              height: '100%', 
                              backgroundColor: '#389e0d',
                              borderRadius: '4px'
                            }}></div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div style={{ textAlign: 'center', padding: '16px', color: '#8c8c8c', fontSize: '13px' }}>
                        No strategy exposure data available
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '32px', color: '#8c8c8c', fontSize: '14px' }}>
                  <div style={{ fontSize: '48px', marginBottom: '16px' }}>📊</div>
                  <div>Risk exposure data not available</div>
                </div>
              )}
            </div>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card 
            title="Diversification Impact" 
            size="small"
          >
            <div style={{ padding: '16px' }}>
              <div style={{ fontSize: '14px', color: '#595959', marginBottom: '16px' }}>
                <div>Portfolio metrics derived from aggregated completed backtests under equal-weight assumption.</div>
                <div style={{ fontSize: '12px', color: '#8c8c8c', marginTop: '4px' }}>
                  Assumes equal-weight allocation and synchronized start across strategies.
                </div>
              </div>
              
              {analyticsData?.diversificationImpact ? (
                analyticsData.diversificationImpact.hasEnoughData ? (
                  <div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
                          <th style={{ padding: '8px', textAlign: 'left', fontWeight: '600', color: '#262626' }}>Metric</th>
                          <th style={{ padding: '8px', textAlign: 'right', fontWeight: '600', color: '#262626' }}>Single Avg</th>
                          <th style={{ padding: '8px', textAlign: 'right', fontWeight: '600', color: '#262626' }}>Portfolio</th>
                          <th style={{ padding: '8px', textAlign: 'right', fontWeight: '600', color: '#262626' }}>Change</th>
                        </tr>
                      </thead>
                      <tbody>
                        {/* Return */}
                        <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
                          <td style={{ padding: '12px 8px', fontWeight: '500', color: '#262626' }}>Return</td>
                          <td style={{ padding: '12px 8px', textAlign: 'right', color: '#262626' }}>
                            {analyticsData.diversificationImpact.singleStrategyAvg.return.toFixed(2)}%
                          </td>
                          <td style={{ padding: '12px 8px', textAlign: 'right', color: '#262626' }}>
                            {analyticsData.diversificationImpact.portfolio.return.toFixed(2)}%
                          </td>
                          <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: '600', 
                            color: analyticsData.diversificationImpact.change.return.includes('+') ? '#389e0d' : 
                                  analyticsData.diversificationImpact.change.return.includes('-') ? '#cf1322' : '#8c8c8c'
                          }}>
                            {analyticsData.diversificationImpact.change.return}
                          </td>
                        </tr>
                        {/* Sharpe */}
                        <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
                          <td style={{ padding: '12px 8px', fontWeight: '500', color: '#262626' }}>Sharpe Ratio</td>
                          <td style={{ padding: '12px 8px', textAlign: 'right', color: '#262626' }}>
                            {analyticsData.diversificationImpact.singleStrategyAvg.sharpe.toFixed(2)}
                          </td>
                          <td style={{ padding: '12px 8px', textAlign: 'right', color: '#262626' }}>
                            {analyticsData.diversificationImpact.portfolio.sharpe.toFixed(2)}
                          </td>
                          <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: '600',
                            color: analyticsData.diversificationImpact.change.sharpe.includes('+') ? '#389e0d' : 
                                  analyticsData.diversificationImpact.change.sharpe.includes('-') ? '#cf1322' : '#8c8c8c'
                          }}>
                            {analyticsData.diversificationImpact.change.sharpe}
                          </td>
                        </tr>
                        {/* Max Drawdown */}
                        <tr>
                          <td style={{ padding: '12px 8px', fontWeight: '500', color: '#262626' }}>Max Drawdown</td>
                          <td style={{ padding: '12px 8px', textAlign: 'right', color: '#262626' }}>
                            {analyticsData.diversificationImpact.singleStrategyAvg.maxDrawdown.toFixed(2)}%
                          </td>
                          <td style={{ padding: '12px 8px', textAlign: 'right', color: '#262626' }}>
                            {analyticsData.diversificationImpact.portfolio.maxDrawdown.toFixed(2)}%
                          </td>
                          <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: '600',
                            color: analyticsData.diversificationImpact.change.maxDrawdown.includes('-') ? '#389e0d' : 
                                  analyticsData.diversificationImpact.change.maxDrawdown.includes('+') ? '#cf1322' : '#8c8c8c'
                          }}>
                            {analyticsData.diversificationImpact.change.maxDrawdown}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                    
                    <div style={{ marginTop: '16px', padding: '12px', backgroundColor: '#f6ffed', borderRadius: '4px', fontSize: '12px', color: '#389e0d' }}>
                      <div style={{ fontWeight: '600', marginBottom: '4px' }}>💡 Diversification Benefit</div>
                      <div>Portfolio metrics are derived from real equity curves of completed backtests.</div>
                      <div style={{ marginTop: '4px' }}>Assumes equal-weight allocation and synchronized start across strategies.</div>
                      <div style={{ marginTop: '4px' }}>Diversification effects are based on actual return correlations.</div>
                    </div>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '32px', color: '#8c8c8c', fontSize: '14px' }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔍</div>
                    <div style={{ marginBottom: '8px' }}>Insufficient data for diversification analysis</div>
                    <div>At least 2 distinct completed backtests are required</div>
                  </div>
                )
              ) : (
                <div style={{ textAlign: 'center', padding: '32px', color: '#8c8c8c', fontSize: '14px' }}>
                  <div style={{ fontSize: '48px', marginBottom: '16px' }}>📊</div>
                  <div>Diversification impact data not available</div>
                </div>
              )}
            </div>
          </Card>
        </Col>
      </Row>

      {/* 第5层：主图表区 */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={24} lg={12}>
          <Card 
            title="Equity Growth Overview" 
            size="small"
          >
            <div style={{ padding: '20px', backgroundColor: '#fafafa', borderRadius: '8px', height: '300px' }}>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center', 
                height: '100%',
                flexDirection: 'column'
              }}>
                <div style={{ fontSize: '16px', color: '#262626', fontWeight: '500', marginBottom: '8px' }}>
                  Aggregated Equity Trend
                </div>
                <div style={{ fontSize: '14px', color: '#595959', marginBottom: '24px', textAlign: 'center', maxWidth: '400px' }}>
                  Derived from completed backtests. Shows cumulative growth assuming sequential execution.
                </div>
                
                {/* 简化的资金曲线示意 */}
                <div style={{ 
                  width: '100%', 
                  height: '150px', 
                  position: 'relative',
                  borderLeft: '1px solid #d9d9d9',
                  borderBottom: '1px solid #d9d9d9',
                  marginBottom: '20px'
                }}>
                  {/* 网格线 */}
                  <div style={{ position: 'absolute', top: '0%', left: '0', right: '0', height: '1px', backgroundColor: '#f0f0f0' }}></div>
                  <div style={{ position: 'absolute', top: '25%', left: '0', right: '0', height: '1px', backgroundColor: '#f0f0f0' }}></div>
                  <div style={{ position: 'absolute', top: '50%', left: '0', right: '0', height: '1px', backgroundColor: '#f0f0f0' }}></div>
                  <div style={{ position: 'absolute', top: '75%', left: '0', right: '0', height: '1px', backgroundColor: '#f0f0f0' }}></div>
                  
                  {/* 资金曲线 */}
                  <div style={{
                    position: 'absolute',
                    bottom: '0',
                    left: '0',
                    right: '0',
                    height: '100%',
                    background: 'linear-gradient(to top, rgba(22, 119, 255, 0.1), transparent)',
                    borderTopLeftRadius: '4px',
                    borderTopRightRadius: '4px'
                  }}></div>
                  
                  {/* 数据点标签 */}
                  <div style={{ position: 'absolute', bottom: '0', left: '10%', transform: 'translateX(-50%)', fontSize: '11px', color: '#595959' }}>
                    Start
                  </div>
                  <div style={{ position: 'absolute', bottom: '0', left: '90%', transform: 'translateX(-50%)', fontSize: '11px', color: '#595959' }}>
                    Current
                  </div>
                  
                  {/* 统计信息 */}
                  <div style={{ 
                    position: 'absolute', 
                    bottom: '-30px', 
                    left: '0', 
                    right: '0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '12px',
                    color: '#595959'
                  }}>
                    <div>
                      <span style={{ fontWeight: '500' }}>Initial:</span> $100,000
                    </div>
                    <div>
                      <span style={{ fontWeight: '500' }}>Current:</span> ${(100000 * (1 + portfolioReturn / 100)).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                    </div>
                    <div style={{ color: portfolioReturn >= 0 ? '#389e0d' : '#cf1322', fontWeight: '600' }}>
                      Return: {portfolioReturn >= 0 ? '+' : ''}{portfolioReturn.toFixed(2)}%
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card 
            title="Return vs Risk Distribution" 
            size="small"
          >
            <div style={{ padding: '20px', backgroundColor: '#fafafa', borderRadius: '8px', height: '300px' }}>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center', 
                height: '100%',
                flexDirection: 'column'
              }}>
                <div style={{ fontSize: '16px', color: '#262626', fontWeight: '500', marginBottom: '8px' }}>
                  Risk-Return Scatter Plot
                </div>
                <div style={{ fontSize: '14px', color: '#595959', marginBottom: '24px', textAlign: 'center', maxWidth: '400px' }}>
                  Each point represents a completed backtest. Size indicates trade count, color indicates strategy.
                </div>
                
                {/* 动态散点图 */}
                <div style={{ 
                  width: '100%', 
                  height: '150px', 
                  position: 'relative',
                  borderLeft: '1px solid #d9d9d9',
                  borderBottom: '1px solid #d9d9d9'
                }}>
                  {/* 坐标轴标签 */}
                  <div style={{ position: 'absolute', bottom: '-20px', left: '0', fontSize: '11px', color: '#595959' }}>
                    Low Risk
                  </div>
                  <div style={{ position: 'absolute', bottom: '-20px', right: '0', fontSize: '11px', color: '#595959' }}>
                    High Risk
                  </div>
                  <div style={{ position: 'absolute', top: '0', left: '-40px', transform: 'rotate(-90deg)', transformOrigin: 'center', fontSize: '11px', color: '#595959' }}>
                    High Return
                  </div>
                  <div style={{ position: 'absolute', bottom: '0', left: '-40px', transform: 'rotate(-90deg)', transformOrigin: 'center', fontSize: '11px', color: '#595959' }}>
                    Low Return
                  </div>
                  
                  {/* 动态散点 */}
                  {analyticsData?.scatterData.map((point, index) => {
                    // 计算位置：X轴（风险）和Y轴（收益）
                    const maxReturn = Math.max(...analyticsData.scatterData.map(p => p.totalReturn));
                    const minReturn = Math.min(...analyticsData.scatterData.map(p => p.totalReturn));
                    const maxRisk = Math.max(...analyticsData.scatterData.map(p => p.maxDrawdown));
                    const minRisk = Math.min(...analyticsData.scatterData.map(p => p.maxDrawdown));
                    
                    // 归一化到0-100%
                    const xPercent = ((point.maxDrawdown - minRisk) / (maxRisk - minRisk || 1)) * 100;
                    const yPercent = 100 - ((point.totalReturn - minReturn) / (maxReturn - minReturn || 1)) * 100;
                    
                    // 点大小基于交易数量
                    const maxTrades = Math.max(...analyticsData.scatterData.map(p => p.trades));
                    const minTrades = Math.min(...analyticsData.scatterData.map(p => p.trades));
                    const size = 8 + ((point.trades - minTrades) / (maxTrades - minTrades || 1)) * 12;
                    
                    // 策略颜色映射
                    const strategyColors: Record<string, string> = {
                      'moving_average': '#1677ff',
                      'rsi': '#389e0d',
                      'macd': '#d46b08',
                      'bollinger_bands': '#722ed1',
                      'Moving Average': '#1677ff',
                      'RSI': '#389e0d',
                      'MACD': '#d46b08',
                      'Bollinger Bands': '#722ed1'
                    };
                    
                    const color = strategyColors[point.strategy] || '#8c8c8c';
                    const isHighlighted = highlightedBacktest === point.id;
                    
                    return (
                      <div
                        key={point.id}
                        style={{
                          position: 'absolute',
                          top: `${yPercent}%`,
                          left: `${xPercent}%`,
                          width: `${size}px`,
                          height: `${size}px`,
                          borderRadius: '50%',
                          backgroundColor: isHighlighted ? color : `${color}80`,
                          border: `2px solid ${color}`,
                          transform: 'translate(-50%, -50%)',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          boxShadow: isHighlighted ? `0 0 0 2px ${color}40` : 'none',
                          zIndex: isHighlighted ? 10 : 1
                        }}
                        onMouseEnter={(e) => {
                          // 显示tooltip
                          const tooltip = document.createElement('div');
                          tooltip.id = `tooltip-${point.id}`;
                          tooltip.style.position = 'absolute';
                          tooltip.style.top = `${e.clientY + 10}px`;
                          tooltip.style.left = `${e.clientX + 10}px`;
                          tooltip.style.backgroundColor = 'white';
                          tooltip.style.border = '1px solid #d9d9d9';
                          tooltip.style.borderRadius = '4px';
                          tooltip.style.padding = '8px 12px';
                          tooltip.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
                          tooltip.style.zIndex = '1000';
                          tooltip.style.minWidth = '200px';
                          tooltip.style.fontSize = '12px';
                          tooltip.style.color = '#262626';
                          
                          tooltip.innerHTML = `
                            <div style="font-weight: 600; margin-bottom: 4px; color: ${color}">${point.strategy} - ${point.symbol}</div>
                            <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
                              <span style="color: #595959">Return:</span>
                              <span style="font-weight: 500; color: ${point.totalReturn >= 0 ? '#389e0d' : '#cf1322'}">
                                ${point.totalReturn >= 0 ? '+' : ''}${point.totalReturn.toFixed(2)}%
                              </span>
                            </div>
                            <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
                              <span style="color: #595959">Max DD:</span>
                              <span style="font-weight: 500; color: #cf1322">${point.maxDrawdown.toFixed(2)}%</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
                              <span style="color: #595959">Sharpe:</span>
                              <span style="font-weight: 500; color: #096dd9">${point.sharpeRatio.toFixed(2)}</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
                              <span style="color: #595959">Win Rate:</span>
                              <span style="font-weight: 500; color: #d46b08">${point.winRate.toFixed(1)}%</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
                              <span style="color: #595959">Trades:</span>
                              <span style="font-weight: 500">${point.trades}</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; margin-top: 4px; padding-top: 4px; border-top: 1px solid #f0f0f0; font-size: 11px; color: #8c8c8c">
                              <span>Created:</span>
                              <span>${new Date(point.createdAt).toLocaleDateString()}</span>
                            </div>
                          `;
                          
                          document.body.appendChild(tooltip);
                        }}
                        onMouseLeave={() => {
                          // 移除tooltip
                          const tooltip = document.getElementById(`tooltip-${point.id}`);
                          if (tooltip) {
                            document.body.removeChild(tooltip);
                          }
                        }}
                        onClick={() => {
                          // 点击联动：高亮对应的backtest
                          setHighlightedBacktest(point.id === highlightedBacktest ? null : point.id);
                          
                          // 滚动到Recent Completed Backtests表格
                          const tableElement = document.getElementById('recent-backtests-table');
                          if (tableElement) {
                            tableElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          }
                        }}
                        title={`Click to highlight ${point.strategy} - ${point.symbol} in table`}
                      />
                    );
                  })}
                  
                  {/* 图例 */}
                  <div style={{
                    position: 'absolute',
                    bottom: '-60px',
                    left: '0',
                    right: '0',
                    display: 'flex',
                    justifyContent: 'center',
                    gap: '16px',
                    fontSize: '11px',
                    color: '#595959'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#1677ff' }}></div>
                      <span>MA</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#389e0d' }}></div>
                      <span>RSI</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#d46b08' }}></div>
                      <span>MACD</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#722ed1' }}></div>
                      <span>BB</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      {/* 第5层：策略分析与分布 */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={24} lg={12}>
          <Card 
            title="Strategy Performance Breakdown" 
            size="small"
          >
            <div style={{ padding: '16px' }}>
              <Table
                dataSource={strategyBreakdown}
                columns={[
                  {
                    title: 'Strategy',
                    dataIndex: 'strategy',
                    key: 'strategy',
                    render: (text) => <Text strong>{text}</Text>
                  },
                  {
                    title: 'Count',
                    dataIndex: 'count',
                    key: 'count',
                    align: 'center',
                    render: (count) => <Tag color="blue">{count}</Tag>
                  },
                  {
                    title: 'Avg Return',
                    dataIndex: 'avgReturn',
                    key: 'avgReturn',
                    align: 'right',
                    render: (value) => (
                      <Text style={{ color: value >= 0 ? '#389e0d' : '#cf1322', fontWeight: '600' }}>
                        {value >= 0 ? '+' : ''}{value}%
                      </Text>
                    )
                  },
                  {
                    title: 'Avg Sharpe',
                    dataIndex: 'avgSharpe',
                    key: 'avgSharpe',
                    align: 'right',
                    render: (value) => (
                      <Text style={{ color: '#096dd9', fontWeight: '600' }}>
                        {value.toFixed(2)}
                      </Text>
                    )
                  },
                  {
                    title: 'Win Rate',
                    dataIndex: 'avgWinRate',
                    key: 'avgWinRate',
                    align: 'right',
                    render: (value) => (
                      <Text style={{ color: '#d46b08', fontWeight: '600' }}>
                        {value}%
                      </Text>
                    )
                  }
                ]}
                pagination={false}
                size="small"
                bordered
              />
            </div>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card 
            title="Top Symbols Distribution" 
            size="small"
          >
            <div style={{ padding: '16px' }}>
              <Table
                dataSource={symbolDistribution}
                columns={[
                  {
                    title: 'Symbol',
                    dataIndex: 'symbol',
                    key: 'symbol',
                    render: (text) => <Text strong>{text}</Text>
                  },
                  {
                    title: 'Backtest Count',
                    dataIndex: 'count',
                    key: 'count',
                    align: 'center',
                    render: (count) => (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ 
                          flex: 1, 
                          height: '8px', 
                          backgroundColor: '#f0f0f0',
                          borderRadius: '4px',
                          overflow: 'hidden'
                        }}>
                          <div style={{ 
                            width: `${(count / totalBacktests) * 100}%`, 
                            height: '100%', 
                            backgroundColor: '#096dd9',
                            borderRadius: '4px'
                          }}></div>
                        </div>
                        <span style={{ minWidth: '20px', textAlign: 'right' }}>{count}</span>
                      </div>
                    )
                  },
                  {
                    title: 'Avg Return',
                    dataIndex: 'avgReturn',
                    key: 'avgReturn',
                    align: 'right',
                    render: (value) => (
                      <Text style={{ color: value >= 0 ? '#389e0d' : '#cf1322', fontWeight: '600' }}>
                        {value >= 0 ? '+' : ''}{value}%
                      </Text>
                    )
                  }
                ]}
                pagination={false}
                size="small"
                bordered
              />
            </div>
          </Card>
        </Col>
      </Row>

      {/* 第6层：Recent Backtests Table */}
      <Row gutter={[16, 16]}>
        <Col xs={24}>
          <Card 
            title="Recent Completed Backtests" 
            size="small"
          >
            <div style={{ padding: '16px' }} id="recent-backtests-table">
              <Table
                dataSource={recentBacktests.map(item => ({
                  ...item,
                  // 添加backtestId用于高亮匹配
                  backtestId: filteredBacktests.find(bt => 
                    bt.parameters.symbols[0] === item.symbol && 
                    bt.parameters.strategy === item.strategy &&
                    Math.abs(bt.results.totalReturn - item.return) < 0.1
                  )?.backtestId || ''
                }))}
                rowClassName={(record) => 
                  record.backtestId === highlightedBacktest ? 'highlighted-row' : ''
                }
                onRow={(record) => ({
                  onClick: () => {
                    setHighlightedBacktest(record.backtestId === highlightedBacktest ? null : record.backtestId);
                  },
                  style: {
                    cursor: 'pointer',
                    backgroundColor: record.backtestId === highlightedBacktest ? '#f0f7ff' : 'transparent',
                    transition: 'background-color 0.2s'
                  }
                })}
                columns={[
                  {
                    title: 'Date',
                    dataIndex: 'date',
                    key: 'date',
                    width: '100px'
                  },
                  {
                    title: 'Symbol',
                    dataIndex: 'symbol',
                    key: 'symbol',
                    width: '100px',
                    render: (text) => <Text strong>{text}</Text>
                  },
                  {
                    title: 'Strategy',
                    dataIndex: 'strategy',
                    key: 'strategy',
                    width: '120px'
                  },
                  {
                    title: 'Return',
                    dataIndex: 'return',
                    key: 'return',
                    align: 'right',
                    width: '100px',
                    render: (value) => (
                      <Text strong style={{ color: value >= 0 ? '#389e0d' : '#cf1322' }}>
                        {value >= 0 ? '+' : ''}{value.toFixed(2)}%
                      </Text>
                    )
                  },
                  {
                    title: 'Sharpe',
                    dataIndex: 'sharpe',
                    key: 'sharpe',
                    align: 'right',
                    width: '80px',
                    render: (value) => (
                      <Text style={{ color: '#096dd9', fontWeight: '500' }}>
                        {value.toFixed(2)}
                      </Text>
                    )
                  },
                  {
                    title: 'Max DD',
                    dataIndex: 'maxDrawdown',
                    key: 'maxDrawdown',
                    align: 'right',
                    width: '100px',
                    render: (value) => (
                      <Text style={{ color: '#cf1322', fontWeight: '500' }}>
                        {value.toFixed(2)}%
                      </Text>
                    )
                  },
                  {
                    title: 'Status',
                    dataIndex: 'status',
                    key: 'status',
                    width: '100px',
                    render: (status) => (
                      <Tag color={status === 'completed' ? 'success' : 'processing'}>
                        {status.toUpperCase()}
                      </Tag>
                    )
                  }
                ]}
                pagination={false}
                size="small"
                bordered
                rowKey="date"
              />
            </div>
          </Card>
        </Col>
      </Row>

      {/* 页脚说明 */}
      <div style={{ 
        marginTop: '32px', 
        padding: '16px', 
        backgroundColor: '#fafafa', 
        borderRadius: '8px',
        fontSize: '13px',
        color: '#595959'
      }}>
        <div style={{ fontWeight: '500', marginBottom: '8px', color: '#262626' }}>
          📊 Analytics Data Source
        </div>
        <div>
          All analytics are derived from completed backtest history. Metrics are calculated by aggregating performance data from all backtests with status "completed". 
          The equity growth overview assumes sequential execution of backtests starting with $100,000 initial capital.
        </div>
      </div>
    </div>
  );
};

export default Analytics;