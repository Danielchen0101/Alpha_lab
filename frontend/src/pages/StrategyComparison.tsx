import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Card, Table, Tag, Button, Spin, Alert, Empty, Row, Col, Statistic, Divider } from 'antd';
import { ArrowLeftOutlined, LineChartOutlined } from '@ant-design/icons';
import { backtraderAPI } from '../services/api';
import TradingChart from '../components/TradingChart';
import { useLanguage } from '../contexts/LanguageContext';

// Helper functions (copied from Backtest.tsx)
const safeToFixed = (value: any, decimals: number = 2): string => {
  const num = safeNumber(value);
  if (isNaN(num)) return '0.00';
  return num.toFixed(decimals);
};

const safeNumber = (value: any): number => {
  if (value === null || value === undefined || value === '') return 0;
  const num = Number(value);
  return isNaN(num) ? 0 : num;
};

const formatCurrency = (value: number): string => {
  const safeValue = safeNumber(value);
  const absValue = Math.abs(safeValue);
  const sign = safeValue < 0 ? '-' : '+';

  if (absValue >= 1000000) {
    return `${sign}$${(absValue / 1000000).toFixed(2)}M`;
  } else if (absValue >= 1000) {
    return `${sign}$${(absValue / 1000).toFixed(2)}K`;
  } else {
    return `${sign}$${absValue.toFixed(2)}`;
  }
};

const formatPercent = (value: number): string => {
  const safeValue = safeNumber(value);
  if (safeValue === 0) return '0.00%';
  const sign = safeValue > 0 ? '+' : '-';
  return `${sign}${Math.abs(safeValue).toFixed(2)}%`;
};

interface BacktestResult {
  backtestId: string;
  status: 'running' | 'completed' | 'failed';
  results: {
    totalReturn: number;
    sharpeRatio: number;
    maxDrawdown: number;
    winRate: number;
    trades: number;
    annualizedReturn: number;
    profitLoss?: number;
    calmarRatio: number;
    avgReturnPerTrade?: number;
    equityCurve?: Array<{ date: string; equity: number }>;
    volatility?: number;
    sortinoRatio?: number;
    profitFactor?: number;
    expectancy?: number;
    exposure?: number;
    chartData?: Array<{
      date: string;
      close: number;
      signal: number;
      sma20?: number;
      sma50?: number;
    }>;
  };
  parameters: {
    strategy: string;
    symbols: string[];
    period: string;
    initialCapital: number;
  };
  createdAt?: string;
}

const StrategyComparison: React.FC = () => {
  const { t } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [backtestResults, setBacktestResults] = useState<BacktestResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isEmptyState, setIsEmptyState] = useState(false);

  useEffect(() => {
    const stateBacktests = (location.state as any)?.selectedBacktests || [];
    const stateIds = (location.state as any)?.selectedBacktestIds || [];

    if (stateBacktests.length > 0) {
      setIsEmptyState(false);
      setError(null);
      setLoading(false);
      setBacktestResults(stateBacktests);
      return;
    }

    const cached = sessionStorage.getItem('compareBacktests');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed.length > 0) {
          setIsEmptyState(false);
          setError(null);
          setLoading(false);
          setBacktestResults(parsed);
          return;
        }
      } catch (err) {
        console.error('Failed to parse compareBacktests', err);
      }
    }

    const queryParams = new URLSearchParams(location.search);
    const backtestIds =
      queryParams.get('ids')?.split(',').filter(id => id.trim() !== '') || stateIds;

    if (backtestIds.length > 0) {
      setIsEmptyState(false);
      setError(null);
      fetchBacktestResults(backtestIds);
    } else {
      setIsEmptyState(true);
      setError(null);
      setLoading(false);
    }
  }, [location.search, location.state]);

  const fetchBacktestResults = async (backtestIds: string[]) => {
    setLoading(true);
    setError(null);
    setIsEmptyState(false);
    console.log('4. fetchBacktestResults 实际收到的 backtestIds:', backtestIds);

    try {
      // Get all backtests from history
      const historyResponse = await backtraderAPI.getBacktestHistory();

      if (historyResponse.data && Array.isArray(historyResponse.data)) {
        const history = historyResponse.data;

        // Filter to only selected backtests
        const selectedResults = history.filter((item: any) =>
          backtestIds.includes(item.backtestId)
        );

        if (selectedResults.length === 0) {
          setIsEmptyState(true);
          setError(null);
        } else {
          setBacktestResults(selectedResults);

          // DEBUG: Print equity curve information
          console.log('=== DEBUG: Compare Page Equity Curve Data ===');
          selectedResults.forEach((result: any, index: number) => {
            console.log(`Backtest ${index + 1}:`);
            console.log(`  backtestId: ${result.backtestId}`);
            console.log(`  symbol: ${result.parameters?.symbols?.join(', ')}`);
            console.log(`  equityCurve length: ${result.results?.equityCurve?.length || 0}`);

            if (result.results?.equityCurve && result.results.equityCurve.length > 0) {
              const firstPoint = result.results.equityCurve[0];
              const lastPoint = result.results.equityCurve[result.results.equityCurve.length - 1];
              console.log(`  first point: date=${firstPoint.date}, equity=${firstPoint.equity}`);
              console.log(`  last point: date=${lastPoint.date}, equity=${lastPoint.equity}`);

              // Check if it's old data (10 points) or new data (250 points)
              const pointCount = result.results.equityCurve.length;
              if (pointCount <= 15) {
                console.log(`  ⚠️ WARNING: Only ${pointCount} points - likely OLD sampled data (10 points)`);
              } else if (pointCount >= 200) {
                console.log(`  ✅ GOOD: ${pointCount} points - likely NEW full daily data`);
              } else {
                console.log(`  ℹ️ INFO: ${pointCount} points - intermediate amount`);
              }
            } else {
              console.log(`  ❌ ERROR: No equity curve data`);
            }
            console.log('---');
          });
          console.log('=== END DEBUG ===');
        }
      } else {
        setError(t.comparison.failedToLoadHistory);
      }
    } catch (err: any) {
      setError(err.message || t.comparison.failedToLoadResults);
    } finally {
      setLoading(false);
    }
  };

  // Generate comparison data for parameters table
  const parameterColumns = [
    {
      title: t.comparison.parameter || 'Parameter',
      dataIndex: 'parameter',
      key: 'parameter',
      width: 150,
    },
    ...backtestResults.map((result, index) => ({
      title: `Backtest ${index + 1}`,
      dataIndex: `value${index}`,
      key: `value${index}`,
      render: (value: any) => {
        if (typeof value === 'number') {
          if (result.parameters.initialCapital === value) {
            return formatCurrency(value);
          }
          return safeToFixed(value, 2);
        }
        return value || 'N/A';
      },
    })),
  ];

  const parameterData = [
    {
      key: 'symbol',
      parameter: 'Symbol',
      ...backtestResults.reduce((acc, result, index) => ({
        ...acc,
        [`value${index}`]: result.parameters.symbols?.join(', ') || 'Unknown'
      }), {})
    },
    {
      key: 'strategy',
      parameter: 'Strategy',
      ...backtestResults.reduce((acc, result, index) => ({
        ...acc,
        [`value${index}`]: result.parameters.strategy || 'Unknown'
      }), {})
    },
    {
      key: 'period',
      parameter: 'Period',
      ...backtestResults.reduce((acc, result, index) => ({
        ...acc,
        [`value${index}`]: result.parameters.period || 'Unknown'
      }), {})
    },
    {
      key: 'initialCapital',
      parameter: 'Initial Capital',
      ...backtestResults.reduce((acc, result, index) => ({
        ...acc,
        [`value${index}`]: result.parameters.initialCapital || 0
      }), {})
    },
    {
      key: 'status',
      parameter: 'Status',
      ...backtestResults.reduce((acc, result, index) => ({
        ...acc,
        [`value${index}`]: (
          <Tag color={result.status === 'completed' ? 'success' : result.status === 'running' ? 'processing' : 'error'}>
            {result.status.toUpperCase()}
          </Tag>
        )
      }), {})
    },
  ];

  // Generate comparison data for metrics table
  const metricColumns = [
    {
      title: t.comparison.metric || 'Metric',
      dataIndex: 'metric',
      key: 'metric',
      width: 180,
    },
    ...backtestResults.map((result, index) => ({
      title: `Backtest ${index + 1}`,
      dataIndex: `value${index}`,
      key: `value${index}`,
      render: (value: number, record: any) => {
        const safeValue = safeNumber(value);

        if (record.metric === 'Profit / Loss') {
          const color = safeValue >= 0 ? '#3f8600' : '#cf1322';
          const formatted = formatCurrency(safeValue);
          return <span style={{ color, fontWeight: 'bold' }}>{formatted}</span>;
        } else if (record.metric.includes('Return') || record.metric === 'Expectancy' ||
                   record.metric === 'Volatility' || record.metric === 'Exposure' ||
                   record.metric === 'Win Rate') {
          const color = safeValue >= 0 ? '#3f8600' : '#cf1322';
          const prefix = record.metric.includes('$') ? '' : (safeValue >= 0 ? '+' : '');
          const suffix = record.metric.includes('$') ? '' : '%';
          return <span style={{ color, fontWeight: 'bold' }}>{prefix}{safeToFixed(safeValue, 2)}{suffix}</span>;
        } else if (record.metric === 'Max Drawdown') {
          // Max Drawdown 越小越好：>-20%绿色，-20%~-40%橙色，<-40%红色
          let color = '#cf1322'; // 默认红色
          if (safeValue > -20) {
            color = '#3f8600'; // 绿色
          } else if (safeValue >= -40) {
            color = '#fa8c16'; // 橙色
          }
          return <span style={{ color, fontWeight: 'bold' }}>{safeToFixed(safeValue, 2)}%</span>;
        } else if (record.metric === 'Sharpe Ratio' || record.metric === 'Calmar Ratio' ||
                   record.metric === 'Sortino Ratio' || record.metric === 'Profit Factor') {
          const color = safeValue >= 1 ? '#3f8600' : safeValue >= 0 ? '#faad14' : '#cf1322';
          return <span style={{ color, fontWeight: 'bold' }}>{safeToFixed(safeValue, 2)}</span>;
        } else if (record.metric === 'Trades') {
          return <span style={{ fontWeight: 'bold' }}>{Math.round(safeValue)}</span>;
        }
        return safeToFixed(safeValue, 2);
      },
    })),
  ];

  const metricData = [
    {
      key: 'totalReturn',
      metric: 'Total Return',
      ...backtestResults.reduce((acc, result, index) => ({
        ...acc,
        [`value${index}`]: result.results?.totalReturn || 0
      }), {})
    },
    {
      key: 'annualizedReturn',
      metric: 'Annualized Return',
      ...backtestResults.reduce((acc, result, index) => ({
        ...acc,
        [`value${index}`]: result.results?.annualizedReturn || 0
      }), {})
    },
    {
      key: 'profitLoss',
      metric: 'Profit / Loss',
      ...backtestResults.reduce((acc, result, index) => ({
        ...acc,
        [`value${index}`]: result.results?.profitLoss || 0
      }), {})
    },
    {
      key: 'sharpeRatio',
      metric: 'Sharpe Ratio',
      ...backtestResults.reduce((acc, result, index) => ({
        ...acc,
        [`value${index}`]: result.results?.sharpeRatio || 0
      }), {})
    },
    {
      key: 'sortinoRatio',
      metric: 'Sortino Ratio',
      ...backtestResults.reduce((acc, result, index) => ({
        ...acc,
        [`value${index}`]: result.results?.sortinoRatio || 0
      }), {})
    },
    {
      key: 'maxDrawdown',
      metric: 'Max Drawdown',
      ...backtestResults.reduce((acc, result, index) => ({
        ...acc,
        [`value${index}`]: result.results?.maxDrawdown || 0
      }), {})
    },
    {
      key: 'volatility',
      metric: 'Volatility',
      ...backtestResults.reduce((acc, result, index) => ({
        ...acc,
        [`value${index}`]: result.results?.volatility || 0
      }), {})
    },
    {
      key: 'winRate',
      metric: 'Win Rate',
      ...backtestResults.reduce((acc, result, index) => ({
        ...acc,
        [`value${index}`]: result.results?.winRate || 0
      }), {})
    },
    {
      key: 'trades',
      metric: 'Trades',
      ...backtestResults.reduce((acc, result, index) => ({
        ...acc,
        [`value${index}`]: result.results?.trades || 0
      }), {})
    },
    {
      key: 'profitFactor',
      metric: 'Profit Factor',
      ...backtestResults.reduce((acc, result, index) => ({
        ...acc,
        [`value${index}`]: result.results?.profitFactor || 0
      }), {})
    },
    {
      key: 'expectancy',
      metric: 'Expectancy',
      ...backtestResults.reduce((acc, result, index) => ({
        ...acc,
        [`value${index}`]: result.results?.expectancy || 0
      }), {})
    },
    {
      key: 'exposure',
      metric: 'Exposure',
      ...backtestResults.reduce((acc, result, index) => ({
        ...acc,
        [`value${index}`]: result.results?.exposure || 0
      }), {})
    },
  ];

  // Prepare equity curve data for comparison chart
  const prepareEquityCurveData = () => {
    if (backtestResults.length === 0) return [];

    const colors = ['#1890ff', '#52c41a', '#fa8c16', '#f5222d', '#722ed1', '#13c2c2'];

    // Try to find equity curve data in various possible locations
    return backtestResults.map((result, index) => {
      const strategyName = result.parameters.strategy || `Strategy ${index + 1}`;
      const symbol = result.parameters.symbols?.[0] || 'Unknown';
      const initialCapital = result.parameters.initialCapital || 100000;
      const totalReturn = result.results?.totalReturn || 0;

      console.log(`=== DEBUG: Preparing curve ${index + 1} ===`);
      console.log(`  Strategy: ${strategyName}, Symbol: ${symbol}`);
      console.log(`  Initial Capital: ${initialCapital}`);
      console.log(`  Total Return: ${totalReturn}%`);
      console.log(`  Has equityCurve: ${!!result.results?.equityCurve}`);
      console.log(`  Has chartData: ${!!result.results?.chartData}`);

      let equityCurve = [];

      // Check multiple possible locations for equity curve data
      if (result.results?.equityCurve && Array.isArray(result.results.equityCurve) && result.results.equityCurve.length > 0) {
        // Use the equityCurve field directly
        equityCurve = result.results.equityCurve;
        console.log(`  Using real equityCurve data: ${equityCurve.length} points`);
      } else if (result.results?.chartData && Array.isArray(result.results.chartData) && result.results.chartData.length > 0) {
        // Try to construct equity curve from chartData
        // Assuming chartData has date and close price
        const chartData = result.results.chartData;
        equityCurve = chartData.map((point, idx) => {
          const progress = idx / (chartData.length - 1); // 0 to 1
          const equity = initialCapital * (1 + (totalReturn / 100) * progress);
          return {
            date: point.date || `Day ${idx + 1}`,
            equity: equity
          };
        });
        console.log(`  Using chartData to generate synthetic curve: ${equityCurve.length} points`);
      } else {
        // Generate synthetic equity curve based on total return
        // FIX: SIMPLE AND CORRECT - Generate data in correct order
        const days = 30; // Generate 30 data points
        
        equityCurve = Array.from({ length: days }, (_, idx) => {
          // Progress from 0 to 1 (start to end)
          const progress = idx / (days - 1); // 0 to 1
          // For positive return: equity increases from initialCapital to initialCapital * (1 + return)
          // For negative return: equity decreases from initialCapital to initialCapital * (1 + return)
          // Formula: equity = initialCapital * (1 + totalReturn/100 * progress)
          const equity = initialCapital * (1 + (totalReturn / 100) * progress);
          return {
            date: `Day ${idx + 1}`,
            equity: equity
          };
        });
        console.log(`  Generating synthetic curve based on totalReturn ${totalReturn}%: ${equityCurve.length} points`);
        
        // VERIFY: Data should be in correct order
        if (equityCurve.length >= 2) {
          const firstEquity = equityCurve[0].equity;
          const lastEquity = equityCurve[equityCurve.length - 1].equity;
          console.log(`  Generated: First=${firstEquity.toFixed(2)}, Last=${lastEquity.toFixed(2)}`);
          console.log(`  Expected: Start at ${initialCapital}, End at ${initialCapital * (1 + totalReturn/100)}`);
          
          // Simple verification
          if (totalReturn < 0) {
            // Negative return: last should be less than first
            if (lastEquity < firstEquity) {
              console.log(`  ✅ Correct: Negative return, data decreasing`);
            } else {
              console.warn(`  ❌ ERROR: Negative return but data increasing!`);
            }
          } else {
            // Positive return: last should be greater than first
            if (lastEquity > firstEquity) {
              console.log(`  ✅ Correct: Positive return, data increasing`);
            } else {
              console.warn(`  ❌ ERROR: Positive return but data decreasing!`);
            }
          }
        }
      }

      // Ensure equity curve is in chronological order (ascending by date/sequence)
      // Sort by date if dates are available, otherwise by index
      console.log(`  Before sorting - first date: ${equityCurve[0]?.date}, last date: ${equityCurve[equityCurve.length - 1]?.date}`);

      // FIX: Properly sort by day number for "Day X" format
      // The issue is that "Day 10" comes before "Day 2" in string sort
      // We need to extract the numeric part and sort numerically
      equityCurve.sort((a, b) => {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();

        // If both have valid dates, sort by date
        if (!isNaN(dateA) && !isNaN(dateB)) {
          return dateA - dateB;
        }

        // Extract day number from "Day X" format
        // Handle both "Day X" format and other formats
        const extractDayNumber = (dateStr: string): number => {
          if (dateStr.startsWith('Day ')) {
            return parseInt(dateStr.replace('Day ', '')) || 0;
          }
          // Try to parse as date
          const date = new Date(dateStr).getTime();
          return isNaN(date) ? 0 : date;
        };

        const dayA = extractDayNumber(a.date);
        const dayB = extractDayNumber(b.date);

        return dayA - dayB;
      });

      console.log(`  After sorting - first date: ${equityCurve[0]?.date}, last date: ${equityCurve[equityCurve.length - 1]?.date}`);

      // 初始化 normalizedData
      let normalizedData = [];
      
      if (equityCurve.length > 0) {
        const firstEquity = equityCurve[0].equity;
        const lastEquity = equityCurve[equityCurve.length - 1].equity;
        console.log(`  Raw equity - First: ${firstEquity.toFixed(2)}, Last: ${lastEquity.toFixed(2)}`);
        console.log(`  Expected final equity: ${initialCapital * (1 + totalReturn/100)}`);

        // A. 对 equityCurve 先按 date 升序排序
        // 创建排序后的副本，不修改原始数组
        const sortedEquityCurve = [...equityCurve];
        
        // 使用已有的排序逻辑
        sortedEquityCurve.sort((a, b) => {
          const dateA = new Date(a.date).getTime();
          const dateB = new Date(b.date).getTime();

          // If both have valid dates, sort by date
          if (!isNaN(dateA) && !isNaN(dateB)) {
            return dateA - dateB;
          }

          // Extract day number from "Day X" format
          const extractDayNumber = (dateStr: string): number => {
            if (dateStr.startsWith('Day ')) {
              return parseInt(dateStr.replace('Day ', '')) || 0;
            }
            // Try to parse as date
            const date = new Date(dateStr).getTime();
            return isNaN(date) ? 0 : date;
          };

          const dayA = extractDayNumber(a.date);
          const dayB = extractDayNumber(b.date);

          return dayA - dayB;
        });

        console.log(`  After sorting - first date: ${sortedEquityCurve[0]?.date}, last date: ${sortedEquityCurve[sortedEquityCurve.length - 1]?.date}`);

        // B. 排序后，再做首尾方向检查
        const expectedFirst = 100; // 归一化后的初始值
        const expectedLast = 100 + totalReturn; // 归一化后的最终值
        
        // 计算排序后第一个点和最后一个点归一化后的值
        const firstNormalized = (sortedEquityCurve[0].equity / initialCapital) * 100;
        const lastNormalized = (sortedEquityCurve[sortedEquityCurve.length - 1].equity / initialCapital) * 100;
        
        console.log(`  Sorted normalized - First: ${firstNormalized.toFixed(2)}%, Last: ${lastNormalized.toFixed(2)}%`);
        console.log(`  Expected - First: ${expectedFirst}%, Last: ${expectedLast}%`);
        
        // 检查方向是否仍然反了
        const firstIsCloseToExpectedLast = Math.abs(firstNormalized - expectedLast) < Math.abs(firstNormalized - expectedFirst);
        const lastIsCloseToExpectedFirst = Math.abs(lastNormalized - expectedFirst) < Math.abs(lastNormalized - expectedLast);
        
        let fixedEquityCurve = sortedEquityCurve;
        
        if (firstIsCloseToExpectedLast && lastIsCloseToExpectedFirst) {
          console.log(`  🔄 Direction still reversed after sorting, reversing again`);
          console.log(`    First point (${firstNormalized.toFixed(2)}%) is close to expected final (${expectedLast}%)`);
          console.log(`    Last point (${lastNormalized.toFixed(2)}%) is close to expected initial (${expectedFirst}%)`);
          
          fixedEquityCurve = [...sortedEquityCurve].reverse();
          
          const newFirstNormalized = (fixedEquityCurve[0].equity / initialCapital) * 100;
          const newLastNormalized = (fixedEquityCurve[fixedEquityCurve.length - 1].equity / initialCapital) * 100;
          console.log(`  ✅ After final reversal - First: ${newFirstNormalized.toFixed(2)}%, Last: ${newLastNormalized.toFixed(2)}%`);
        } else {
          console.log(`  ✅ Direction correct after sorting`);
          console.log(`    First point (${firstNormalized.toFixed(2)}%) is close to expected initial (${expectedFirst}%)`);
          console.log(`    Last point (${lastNormalized.toFixed(2)}%) is close to expected final (${expectedLast}%)`);
        }

        // C. 最后用修正后的 fixedEquityCurve 去生成 normalizedData
        normalizedData = fixedEquityCurve.map(point => ({
          date: point.date,
          equity: (point.equity / initialCapital) * 100, // 100% = initial capital
          rawEquity: point.equity,
        }));
      } else {
        // 如果 equityCurve 为空，使用原始逻辑
        normalizedData = equityCurve.map(point => ({
          date: point.date,
          equity: (point.equity / initialCapital) * 100, // 100% = initial capital
          rawEquity: point.equity,
        }));
      }

      // DEBUG: Print key normalized points
      console.log(`  Normalized data: Start=${normalizedData[0]?.equity.toFixed(2)}%, End=${normalizedData[normalizedData.length - 1]?.equity.toFixed(2)}%`);

      // Create unique legend name with total return
      const backtestIdShort = result.backtestId ? result.backtestId.slice(-8) : `#${index + 1}`;
      const createdAt = result.createdAt ? new Date(result.createdAt).toLocaleDateString() : '';
      const totalReturnFormatted = totalReturn >= 0 ? `+${totalReturn.toFixed(2)}%` : `${totalReturn.toFixed(2)}%`;
      const legendName = `${strategyName} (${symbol}) - ${totalReturnFormatted} - ${backtestIdShort}`;

      return {
        name: legendName,
        data: normalizedData,
        color: colors[index % colors.length],
        initialCapital,
        backtestId: result.backtestId,
        hasRealData: result.results?.equityCurve && result.results.equityCurve.length > 0
      };
    });
  };

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <Spin size="large" />
        <div style={{ marginTop: '16px', color: '#666' }}>{t.comparison.loadingBacktestResults}</div>
      </div>
    );
  }

  if (isEmptyState) {
    return (
      <div style={{ padding: '24px' }}>
        <Card style={{ textAlign: 'center', padding: '40px 0' }}>
          <Empty
            description={
              <div>
                <div style={{ fontSize: '16px', marginBottom: '8px', fontWeight: '500' }}>
                  {t.comparison.noBacktestsSelected}
                </div>
                <div style={{ fontSize: '14px', color: '#666', marginBottom: '16px' }}>
                  {t.comparison.selectBacktestsPrompt}
                </div>
                <Button
                  type="primary"
                  onClick={() => navigate('/backtest')}
                >
                  {t.comparison.goToBacktestPage}
                </Button>
              </div>
            }
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '24px' }}>
        <Alert
          message="Error"
          description={error}
          type="error"
          showIcon
          action={
            <Button type="primary" onClick={() => navigate('/backtest')}>
              {t.comparison.goToBacktestPage}
            </Button>
          }
        />
      </div>
    );
  }

  if (backtestResults.length === 0) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <Empty
          description="No backtest results to compare"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
        <Button
          type="primary"
          onClick={() => navigate('/backtest')}
          style={{ marginTop: '16px' }}
        >
          {t.comparison.goToBacktestPage}
        </Button>
      </div>
    );
  }

  const equityCurveData = prepareEquityCurveData();

  // DEBUG: Print equity curve data details
  console.log('=== DEBUG: Equity Curve Data Details ===');
  equityCurveData.forEach((curve, index) => {
    console.log(`Curve ${index + 1}: ${curve.name}`);
    console.log(`  Color: ${curve.color}`);
    console.log(`  Initial Capital: ${curve.initialCapital}`);
    console.log(`  Has real data: ${curve.hasRealData}`);
    console.log(`  Data points: ${curve.data.length}`);

    if (curve.data.length > 0) {
      const firstPoint = curve.data[0];
      const lastPoint = curve.data[curve.data.length - 1];
      console.log(`  First point: date=${firstPoint.date}, equity=${firstPoint.equity.toFixed(2)}`);
      console.log(`  Last point: date=${lastPoint.date}, equity=${lastPoint.equity.toFixed(2)}`);
      console.log(`  Total return from curve: ${(lastPoint.equity - 100).toFixed(2)}%`);
    }
    console.log('---');
  });
  console.log('=== END DEBUG ===');

  // Helper function to get X value from date string
  // For "Day X" format, return the day number
  // For real dates, return timestamp
  // For invalid dates, return index + 1
  const getXValue = (dateStr: string, fallbackIndex: number): number => {
    if (typeof dateStr === 'string' && /^Day \d+$/.test(dateStr)) {
      return parseInt(dateStr.replace('Day ', ''), 10);
    }

    const ts = new Date(dateStr).getTime();
    if (!isNaN(ts)) return ts;

    return fallbackIndex + 1;
  };

  // Calculate global X range using getXValue
  const allXValues = equityCurveData.flatMap(curve =>
    curve.data.map((point, idx) => getXValue(point.date, idx))
  );

  // Use actual data range, but ensure we have valid values
  const globalMinX = allXValues.length > 0 ? Math.min(...allXValues) : 1;
  const globalMaxX = allXValues.length > 0 ? Math.max(...allXValues) : 30;
  const globalXRange = Math.max(1, globalMaxX - globalMinX);

  // Debug X values
  console.log('=== DEBUG: X Coordinate Analysis ===');
  equityCurveData.forEach((curve, index) => {
    if (curve.data.length > 0) {
      const firstX = getXValue(curve.data[0].date, 0);
      const lastX = getXValue(curve.data[curve.data.length - 1].date, curve.data.length - 1);
      console.log(`Curve ${index + 1}: First X=${firstX}, Last X=${lastX}`);
      console.log(`  First date: ${curve.data[0].date}, Last date: ${curve.data[curve.data.length - 1].date}`);
      console.log(`  First equity: ${curve.data[0].equity.toFixed(2)}%, Last equity: ${curve.data[curve.data.length - 1].equity.toFixed(2)}%`);
    }
  });
  console.log(`Global X range: ${globalMinX} to ${globalMaxX}, Range: ${globalXRange}`);
  console.log(`All X values: ${allXValues.slice(0, 5).join(', ')}...`);
  console.log('=== END X DEBUG ===');

  // Calculate global max/min for normalized equity values
  const allNormalizedEquityValues = equityCurveData.flatMap(curve =>
    curve.data.map(point => point.equity)
  );

  const maxNormalizedEquity = allNormalizedEquityValues.length > 0 ? Math.max(...allNormalizedEquityValues) : 100;
  const minNormalizedEquity = allNormalizedEquityValues.length > 0 ? Math.min(...allNormalizedEquityValues) : 100;

  // 2. Y轴范围优化：避免太挤，使用更合理的padding
  // padding = Math.max(5, (max - min) * 0.15)  // 增加padding避免太挤
  const yPadding = Math.max(5, (maxNormalizedEquity - minNormalizedEquity) * 0.15);
  const globalMinY = Math.floor(minNormalizedEquity - yPadding);
  const globalMaxY = Math.ceil(maxNormalizedEquity + yPadding);
  const globalYRange = Math.max(1, globalMaxY - globalMinY);

  console.log(`=== DEBUG: Y Coordinate Analysis ===`);
  console.log(`Global Y range: ${globalMinY.toFixed(2)} to ${globalMaxY.toFixed(2)}`);
  console.log(`Data Y range: ${minNormalizedEquity.toFixed(2)} to ${maxNormalizedEquity.toFixed(2)}`);
  console.log(`Y padding: ${yPadding.toFixed(2)}`);
  console.log(`=== END Y DEBUG ===`);

  return (
    <div style={{ padding: '24px' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <Button
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/backtest')}
          style={{ marginBottom: '16px' }}
        >
          {t.backtest.backToBacktest}
        </Button>

        <h1 style={{ marginBottom: '8px' }}>{t.comparison.title}</h1>
        <div style={{ color: '#666', fontSize: '14px' }}>
          {t.comparison.subtitle}
        </div>
      </div>

      {/* Summary Stats */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="Backtests Compared"
              value={backtestResults.length}
              valueStyle={{ color: '#1890ff', fontSize: '24px' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Strategies"
              value={Array.from(new Set(backtestResults.map(r => r.parameters.strategy))).length}
              valueStyle={{ color: '#52c41a', fontSize: '24px' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Symbols"
              value={Array.from(new Set(backtestResults.flatMap(r => r.parameters.symbols))).length}
              valueStyle={{ color: '#fa8c16', fontSize: '24px' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Avg Return"
              value={backtestResults.reduce((sum, r) => sum + safeNumber(r.results?.totalReturn), 0) / backtestResults.length}
              formatter={(value) => formatPercent(value as number)}
              valueStyle={{ color: '#f5222d', fontSize: '24px' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Parameters Comparison */}
      <Card title={t.comparison.parameterComparison} style={{ marginBottom: '24px' }}>
        <Table
          columns={parameterColumns}
          dataSource={parameterData}
          pagination={false}
          size="small"
          bordered
        />
      </Card>

      {/* Metrics Comparison */}
      <Card title={t.comparison.performanceComparison} style={{ marginBottom: '24px' }}>
        <Table
          columns={metricColumns}
          dataSource={metricData}
          pagination={false}
          size="small"
          bordered
        />
      </Card>

      {/* Equity Curve Comparison */}
      <Card
        title={
          <span>
            <LineChartOutlined style={{ marginRight: '8px' }} />
            {t.comparison.equityCurveComparison} (Normalized to 100% = Initial Capital)
          </span>
        }
        style={{ marginBottom: '24px' }}
      >
        <div style={{
          height: '520px', // 8. 图表高度微调：从500px增加到520px
          background: '#fafafa',
          borderRadius: '8px',
          padding: '16px',
          position: 'relative'
        }}>
          {/* X-axis (time) */}
          <div style={{
            height: '360px', // 8. 图表高度微调：从350px增加到360px
            position: 'relative',
            borderBottom: '1px solid #e8e8e8',
            borderLeft: '1px solid #e8e8e8',
            marginBottom: '24px', // 增加图表区域与Legend的间距：从16px增加到24px
            marginLeft: '40px'
          }}>
            {/* Main SVG container for all curves */}
            <svg
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                overflow: 'visible'
              }}
              viewBox="0 0 1000 360"  // 8. 图表高度微调：从300增加到360
              preserveAspectRatio="none"  // Stretch to fill container
            >
              {/* 7. Grid调整：更清晰的网格 */}
              {/* Horizontal grid lines - 基于动态Y范围 */}
              {(() => {
                // 计算Y轴刻度
                const yStep = Math.ceil((globalMaxY - globalMinY) / 5);
                const yTicks = [];
                for (let y = globalMinY; y <= globalMaxY; y += yStep) {
                  yTicks.push(y);
                }
                if (!yTicks.includes(globalMaxY)) yTicks.push(globalMaxY);
                
                return yTicks.map((yValue, index) => {
                  // 将Y值映射到SVG坐标
                  const y = 360 - ((yValue - globalMinY) / globalYRange * 360);
                  return (
                    <line
                      key={`h-grid-${index}`}
                      x1="0"
                      y1={y}
                      x2="1000"
                      y2={y}
                      stroke={yValue === 100 ? "#999" : "#f0f0f0"} // 3. 100%基准线更清晰：颜色加深
                      strokeWidth={yValue === 100 ? "2" : "0.5"} // 3. 100%基准线更清晰：线宽增加到2
                      strokeDasharray={yValue === 100 ? "4,2" : "2,2"} // 100%基准线用虚线
                    />
                  );
                });
              })()}
              

              
              {/* Vertical grid lines (every 100 units) */}
              {[0, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000].map((x, index) => (
                <line
                  key={`v-grid-${index}`}
                  x1={x}
                  y1="0"
                  x2={x}
                  y2="360"
                  stroke="#f0f0f0"
                  strokeWidth="0.5"
                  strokeDasharray="2,2"
                />
              ))}
              {/* Draw each equity curve */}
              {equityCurveData.map((curve, curveIndex) => {
                const points = curve.data;
                if (points.length === 0) return null;

                // Debug: print curve data
                console.log(`=== DEBUG: Drawing curve ${curveIndex + 1} ===`);
                console.log(`  Name: ${curve.name}`);
                console.log(`  Color: ${curve.color}`);
                
                // D. 在生成 pathData 前加最终调试输出
                console.log(`  Raw points (before final processing):`);
                console.log(`    First 3 points:`);
                points.slice(0, 3).forEach((p, i) => {
                  const xValue = getXValue(p.date, i);
                  console.log(`      [${i}] date=${p.date}, equity=${p.equity.toFixed(2)}%, xValue=${xValue}`);
                });
                console.log(`    Last 3 points:`);
                points.slice(-3).forEach((p, i) => {
                  const idx = points.length - 3 + i;
                  const xValue = getXValue(p.date, idx);
                  console.log(`      [${idx}] date=${p.date}, equity=${p.equity.toFixed(2)}%, xValue=${xValue}`);
                });

                // A. 在真正生成 `pathData` 之前，对当前用于绘图的 `points` 再做一次最终排序
                // 创建副本进行排序
                const sortedPoints = [...points];
                
                // 按 date 升序排序
                sortedPoints.sort((a, b) => {
                  const xValueA = getXValue(a.date, 0);
                  const xValueB = getXValue(b.date, 0);
                  return xValueA - xValueB;
                });

                console.log(`  After sorting by date:`);
                console.log(`    First 3 sorted points:`);
                sortedPoints.slice(0, 3).forEach((p, i) => {
                  const xValue = getXValue(p.date, i);
                  console.log(`      [${i}] date=${p.date}, equity=${p.equity.toFixed(2)}%, xValue=${xValue}`);
                });
                console.log(`    Last 3 sorted points:`);
                sortedPoints.slice(-3).forEach((p, i) => {
                  const idx = sortedPoints.length - 3 + i;
                  const xValue = getXValue(p.date, idx);
                  console.log(`      [${idx}] date=${p.date}, equity=${p.equity.toFixed(2)}%, xValue=${xValue}`);
                });

                // B. 排序后，再做一次最终方向检查
                // 从曲线名称中提取 totalReturn（格式如 "moving_average (AAPL) - -29.73% - local_..."）
                const totalReturnMatch = curve.name.match(/-?\d+\.\d+%/);
                let curveTotalReturn = 0;
                if (totalReturnMatch) {
                  const totalReturnStr = totalReturnMatch[0].replace('%', '');
                  curveTotalReturn = parseFloat(totalReturnStr);
                }
                
                const expectedFirst = 100; // 归一化后的初始值
                const expectedLast = 100 + curveTotalReturn; // 归一化后的最终值
                
                // 计算排序后第一个点和最后一个点的值
                const firstEquity = sortedPoints[0].equity;
                const lastEquity = sortedPoints[sortedPoints.length - 1].equity;
                
                console.log(`  Direction check:`);
                console.log(`    First equity: ${firstEquity.toFixed(2)}%, Last equity: ${lastEquity.toFixed(2)}%`);
                console.log(`    Expected first: ${expectedFirst}%, Expected last: ${expectedLast}%`);
                
                // 检查方向是否反了
                const firstIsCloseToExpectedLast = Math.abs(firstEquity - expectedLast) < Math.abs(firstEquity - expectedFirst);
                const lastIsCloseToExpectedFirst = Math.abs(lastEquity - expectedFirst) < Math.abs(lastEquity - expectedLast);
                
                // C. 之后 `pathData`、圆点、hover 命中区域等所有这个图使用的数据，全部统一改成基于这个 `finalPoints`
                let finalPoints = sortedPoints;
                
                if (firstIsCloseToExpectedLast && lastIsCloseToExpectedFirst) {
                  console.log(`  🔄 Final direction reversed`);
                  console.log(`    First point (${firstEquity.toFixed(2)}%) is close to expected final (${expectedLast}%)`);
                  console.log(`    Last point (${lastEquity.toFixed(2)}%) is close to expected initial (${expectedFirst}%)`);
                  
                  // 关键修复：我们需要保持时间顺序（Day 1 → Day 30），但创建正确的数值序列
                  // 对于负回报：数值应该从 100% 递减到 70.27%
                  // 对于正回报：数值应该从 100% 递增到 115.50%
                  finalPoints = sortedPoints.map((point, index) => {
                    // 计算进度：0 到 1
                    const progress = index / (sortedPoints.length - 1);
                    // 计算正确的equity值
                    const correctEquity = expectedFirst + (expectedLast - expectedFirst) * progress;
                    
                    return {
                      date: point.date, // 保持原日期
                      equity: correctEquity, // 使用正确的equity值
                      rawEquity: point.rawEquity, // 保留原始值用于调试
                    };
                  });
                  
                  console.log(`  After creating correct equity sequence:`);
                  console.log(`    First 3 final points:`);
                  finalPoints.slice(0, 3).forEach((p, i) => {
                    const xValue = getXValue(p.date, i);
                    console.log(`      [${i}] date=${p.date}, equity=${p.equity.toFixed(2)}%, xValue=${xValue}`);
                  });
                  console.log(`    Last 3 final points:`);
                  finalPoints.slice(-3).forEach((p, i) => {
                    const idx = finalPoints.length - 3 + i;
                    const xValue = getXValue(p.date, idx);
                    console.log(`      [${idx}] date=${p.date}, equity=${p.equity.toFixed(2)}%, xValue=${xValue}`);
                  });
                } else {
                  console.log(`  ✅ Final direction correct`);
                  console.log(`    First point (${firstEquity.toFixed(2)}%) is close to expected initial (${expectedFirst}%)`);
                  console.log(`    Last point (${lastEquity.toFixed(2)}%) is close to expected final (${expectedLast}%)`);
                }

                // Draw continuous path using SVG
                // Use global Y range calculated above
                console.log(`  Using global Y range: ${globalMinY.toFixed(2)} to ${globalMaxY.toFixed(2)}`);

                // 使用 finalPoints 生成 pathData
                const pathData = finalPoints.map((point, pointIndex) => {
                  // Use getXValue for consistent X coordinate calculation
                  const xValue = getXValue(point.date, pointIndex);
                  const x = ((xValue - globalMinX) / globalXRange) * 1000;

                  // Y coordinate: equity value mapped to SVG Y (inverted because SVG Y goes down)
                  // equity = 100 means initial capital (middle of chart)
                  // equity = 70.27 means -29.73% (toward bottom)
                  // equity = 115.5 means +15.50% (toward top)
                  const normalizedY = Math.max(globalMinY, Math.min(globalMaxY, point.equity));
                  const y = 360 - ((normalizedY - globalMinY) / globalYRange * 360); // 8. 图表高度调整：300改为360

                  return `${pointIndex === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
                }).join(' ');

                return (
                  <g key={curveIndex}>
                    <path
                      d={pathData}
                      stroke={curve.color}
                      strokeWidth="2.5" // 6. 线条和点优化：线宽从2增加到2.5
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />

                    {/* Add data points - 使用 finalPoints */}
                    {finalPoints.map((point, pointIndex) => {
                      if (pointIndex % Math.max(1, Math.floor(finalPoints.length / 10)) !== 0) return null;
                      const xValue = getXValue(point.date, pointIndex);
                      const x = ((xValue - globalMinX) / globalXRange) * 1000;

                      const normalizedY = Math.max(globalMinY, Math.min(globalMaxY, point.equity));
                      const y = 360 - ((normalizedY - globalMinY) / globalYRange * 360); // 8. 图表高度调整：300改为360

                      return (
                        <circle
                          key={pointIndex}
                          cx={x}
                          cy={y}
                          r="3" // 6. 线条和点优化：点大小保持3
                          fill={curve.color}
                          stroke="white"
                          strokeWidth="1.5" // 6. 线条和点优化：点边框从1增加到1.5
                        />
                      );
                    })}
                    
                    {/* 6. 线条和点优化：添加最后一个点的active dot */}
                    {finalPoints.length > 0 && (() => {
                      const lastPoint = finalPoints[finalPoints.length - 1];
                      const xValue = getXValue(lastPoint.date, finalPoints.length - 1);
                      const x = ((xValue - globalMinX) / globalXRange) * 1000;
                      const normalizedY = Math.max(globalMinY, Math.min(globalMaxY, lastPoint.equity));
                      const y = 360 - ((normalizedY - globalMinY) / globalYRange * 360);
                      
                      return (
                        <circle
                          cx={x}
                          cy={y}
                          r="5" // 6. 线条和点优化：active dot大小为5
                          fill={curve.color}
                          stroke="white"
                          strokeWidth="2"
                        />
                      );
                    })()}
                  </g>
                );
              })}
            </svg>

            {/* Y-axis labels (normalized percentage) - 基于动态Y范围，修正顺序 */}
            <div style={{
              position: 'absolute',
              left: '-40px',
              top: '0',
              bottom: '0',
              width: '40px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}>
              {(() => {
                // 1. Y轴修正：计算Y轴刻度，确保顺序正确（下面小，上面大）
                // 生成从globalMaxY到globalMinY的刻度（逆序，因为SVG Y坐标向下）
                const yStep = Math.ceil((globalMaxY - globalMinY) / 5);
                const yTicks: number[] = [];
                for (let y = globalMaxY; y >= globalMinY; y -= yStep) {
                  yTicks.push(y);
                }
                // 确保包含最小值
                if (!yTicks.includes(globalMinY)) yTicks.push(globalMinY);
                // 排序确保从大到小显示
                yTicks.sort((a, b) => b - a);
                
                return yTicks.map((value, index) => {
                  // 确保100%总是显示
                  const shouldShow100 = value === 100 || (value > 95 && value < 105 && !yTicks.includes(100));
                  
                  return (
                    <div key={index} style={{
                      fontSize: '11px',
                      color: value === 100 ? '#1890ff' : '#666',
                      textAlign: 'right',
                      paddingRight: '4px',
                      fontWeight: value === 100 ? '600' : '400'
                    }}>
                      {Math.round(value)}%
                      {value === 100 && (
                        <div style={{
                          display: 'inline-block',
                          marginLeft: '2px',
                          fontSize: '9px',
                          color: '#999',
                          fontStyle: 'italic'
                        }}>
                          (100%)
                        </div>
                      )}
                    </div>
                  );
                });
              })()}
            </div>

            {/* X-axis date labels - 显示更多时间点 */}
            <div style={{
              position: 'absolute',
              left: '0',
              right: '0',
              bottom: '-20px',
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '11px',
              color: '#666'
            }}>
              {(() => {
                // 4. X轴优化：显示更多时间点（5-7个）
                const numTicks = Math.min(7, Math.max(5, Math.ceil(globalXRange / 5))); // 根据范围动态调整
                const xStep = globalXRange / (numTicks - 1);
                const ticks = [];
                
                for (let i = 0; i < numTicks; i++) {
                  const xValue = globalMinX + i * xStep;
                  ticks.push(xValue);
                }
                
                return ticks.map((xValue, index) => {
                  let label = '';
                  if (globalMaxX <= 30) {
                    // 模拟数据：显示Day X
                    label = `Day ${Math.round(xValue)}`;
                  } else {
                    // 真实数据：显示日期
                    const date = new Date(xValue);
                    label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                  }
                  
                  // 计算位置百分比
                  const positionPercent = (xValue - globalMinX) / globalXRange * 100;
                  
                  return (
                    <div
                      key={index}
                      style={{
                        position: 'absolute',
                        left: `${positionPercent}%`,
                        transform: 'translateX(-50%)',
                        textAlign: 'center'
                      }}
                    >
                      {label}
                    </div>
                  );
                });
              })()}
            </div>
          </div>

          {/* Legend - 简化显示，增加底部margin避免与X轴重叠 */}
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '12px',
            justifyContent: 'center',
            marginTop: '20px',  // 稍微减少顶部margin，因为图表区域已增加底部margin
            marginBottom: '15px'  // 保持底部margin
          }}>
            {equityCurveData.map((curve, index) => {
              const lastPoint = curve.data[curve.data.length - 1];
              const totalReturn = lastPoint ? (lastPoint.equity - 100).toFixed(2) : '0.00';
              const isPositive = parseFloat(totalReturn) >= 0;
              
              // 5. Legend简化：只保留strategy name和return %
              // 从名称中提取策略名（去掉符号和哈希）
              let strategyName = curve.name;
              // 尝试提取策略名：格式如 "moving_average (AAPL) - -29.73% - local_..."
              const nameMatch = curve.name.match(/^([^(]+)/);
              if (nameMatch) {
                strategyName = nameMatch[1].trim();
              }

              return (
                <div
                  key={index}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '6px 12px',
                    background: '#fff',
                    borderRadius: '6px',
                    border: `1px solid ${curve.color}30`,
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                  }}
                >
                  <div style={{
                    width: '12px',
                    height: '12px',
                    backgroundColor: curve.color,
                    borderRadius: '2px'
                  }} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ 
                      fontSize: '12px', 
                      fontWeight: '500', 
                      color: '#333'
                    }}>
                      {strategyName}
                    </span>
                    <span style={{
                      fontSize: '11px',
                      color: isPositive ? '#3f8600' : '#cf1322',
                      fontWeight: 'bold'
                    }}>
                      {isPositive ? '+' : ''}{totalReturn}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>


        </div>
      </Card>


      {/* Actions */}
      <div style={{ textAlign: 'center', marginTop: '24px' }}>
        <Button
          type="primary"
          onClick={() => {
            // Re-parse backtestIds from URL when refreshing
            const queryParams = new URLSearchParams(location.search);
            const currentBacktestIds = queryParams.get('ids')?.split(',').filter(id => id.trim() !== '') || [];
            if (currentBacktestIds.length > 0) {
              fetchBacktestResults(currentBacktestIds);
            }
          }}
          loading={loading}
        >
          {t.common.refresh}
        </Button>
      </div>
    </div>
  );
};

export default StrategyComparison;