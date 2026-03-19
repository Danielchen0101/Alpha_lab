import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Button, Tabs, Table, Tag, Space, Spin, Empty, Alert, message, Radio } from 'antd';
import { LineChartOutlined, BarChartOutlined, PlayCircleOutlined, ReloadOutlined, ArrowUpOutlined, ArrowDownOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area, BarChart, Bar, ComposedChart, ReferenceLine, ReferenceDot } from 'recharts';
import marketDataService, {
  StockData,
  HistoricalDataPoint,
  HistoricalDataResponse,
  TIMEFRAMES,
  formatCurrency,
  formatPercent,
  safeNumber,
  safeToFixed,
  calculateSMA,
  calculateEMA,
  calculateRSI
} from '../services/marketDataService';
import DataSourceBadge from '../components/DataSourceBadge';

const { TabPane } = Tabs;

interface BacktestHistoryItem {
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

// 图表数据点类型（用于Recharts）
interface ChartDataPoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  sma20?: number;
  sma50?: number;
  ema12?: number;
  ema26?: number;
  rsi?: number;
}

const SymbolAnalysis: React.FC = () => {
  const { symbol } = useParams<{ symbol: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [stockData, setStockData] = useState<StockData | null>(null);
  const [backtestHistory, setBacktestHistory] = useState<BacktestHistoryItem[]>([]);
  const [backtestLoading, setBacktestLoading] = useState(false);
  const [stockDataError, setStockDataError] = useState<string | null>(null);
  const [historicalDataError, setHistoricalDataError] = useState<string | null>(null);

  // 图表相关状态
  const [selectedTimeframe, setSelectedTimeframe] = useState<string>('1M');
  const [historicalData, setHistoricalData] = useState<HistoricalDataPoint[]>([]);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [chartLoading, setChartLoading] = useState(false);
  const [dataSource, setDataSource] = useState<string>('Finnhub');

  // 加载股票数据
  const loadStockData = async () => {
    if (!symbol) return;

    try {
      setLoading(true);
      setStockDataError(null);
      const data = await marketDataService.getStockData(symbol);

      setStockData(data);
      setDataSource(data.dataSource || 'Finnhub');
      message.success(`Loaded ${symbol} data from ${data.dataSource || 'Finnhub'}`);
    } catch (error: any) {
      console.error('Failed to fetch stock data:', error);
      const errorMsg = error.message || 'Unknown error';
      setStockDataError(`Failed to load stock data: ${errorMsg}`);
      message.error(`Failed to load ${symbol} data: ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  };

  // 加载历史价格数据
  const loadHistoricalPrices = async () => {
    if (!symbol) return;
    
    try {
      setChartLoading(true);
      setHistoricalDataError(null);
      
      // 调试日志：前端请求参数
      const config = marketDataService.TIMEFRAMES[selectedTimeframe] || marketDataService.TIMEFRAMES['1M'];
      console.log('=== 前端请求调试 ===');
      console.log('1. 当前timeframe:', selectedTimeframe);
      console.log('2. 请求配置:', {
        interval: config.interval,
        range: config.range,
        label: config.label,
        dataPoints: config.dataPoints
      });
      console.log('3. 请求URL:', `/market/history/${symbol}?interval=${config.interval}&range=${config.range}`);
      
      const response = await marketDataService.getStockHistory(symbol, selectedTimeframe);
      
      // 调试日志：后端返回数据
      console.log('=== 后端返回数据 ===');
      console.log('1. timeframe:', selectedTimeframe);
      console.log('2. 返回bars数量:', response.count);
      console.log('3. 数据源:', response.dataSource);
      if (response.data && response.data.length > 0) {
        const firstBar = response.data[0];
        const lastBar = response.data[response.data.length - 1];
        console.log('4. 第一根bar时间:', new Date(firstBar.timestamp * 1000).toISOString(), {
          open: firstBar.open,
          high: firstBar.high,
          low: firstBar.low,
          close: firstBar.close,
          volume: firstBar.volume
        });
        console.log('5. 最后一根bar时间:', new Date(lastBar.timestamp * 1000).toISOString(), {
          open: lastBar.open,
          high: lastBar.high,
          low: lastBar.low,
          close: lastBar.close,
          volume: lastBar.volume
        });
        console.log('6. 时间跨度:', {
          days: (lastBar.timestamp - firstBar.timestamp) / (24 * 60 * 60),
          bars: response.data.length
        });
      } else {
        console.log('4. 无数据返回');
      }

      setHistoricalData(response.data);
      setDataSource(response.dataSource || 'Finnhub');

      // 转换为图表数据格式 - 修复：使用ISO字符串作为日期
      const formattedData = response.data.map((item: HistoricalDataPoint) => {
        // 时间戳转换：后端返回秒，需要乘以1000转为毫秒
        const timestampMs = item.timestamp * 1000;
        const date = new Date(timestampMs);

        if (isNaN(date.getTime())) {
          console.error('Invalid date:', item.timestamp, item.time);
          // 尝试使用 time 字段
          try {
            const dateFromTime = new Date(item.time);
            if (!isNaN(dateFromTime.getTime())) {
              return {
                date: dateFromTime.toISOString(), // 使用ISO字符串
                open: Number(item.open) || 0,
                high: Number(item.high) || 0,
                low: Number(item.low) || 0,
                close: Number(item.close) || 0,
                volume: Number(item.volume) || 0
              };
            }
          } catch (e) {
            console.error('Failed to parse time field:', e);
          }
          return null;
        }

        return {
          date: date.toISOString(), // 使用ISO字符串
          open: Number(item.open) || 0,
          high: Number(item.high) || 0,
          low: Number(item.low) || 0,
          close: Number(item.close) || 0,
          volume: Number(item.volume) || 0
        };
      }).filter((item): item is ChartDataPoint => item !== null);

      console.log(`Formatted chart data:`, formattedData.length, 'points');
      
      // 调试日志：图表最终数据
      console.log('=== 图表最终数据 ===');
      console.log('1. chartData.length:', formattedData.length);
      if (formattedData.length > 0) {
        console.log('2. 第一条数据:', {
          date: formattedData[0].date,
          open: formattedData[0].open,
          close: formattedData[0].close,
          volume: formattedData[0].volume
        });
        console.log('3. 最后一条数据:', {
          date: formattedData[formattedData.length - 1].date,
          open: formattedData[formattedData.length - 1].open,
          close: formattedData[formattedData.length - 1].close,
          volume: formattedData[formattedData.length - 1].volume
        });
        console.log('4. 数据时间范围:', {
          firstDate: formattedData[0].date,
          lastDate: formattedData[formattedData.length - 1].date,
          totalBars: formattedData.length
        });
      }

      // 计算技术指标 - 使用所有有效的close值
      const closePrices = formattedData.map(d => d.close);
      
      // 计算移动平均线（基于close价格）
      const sma20 = calculateSMA(closePrices, 20);
      const sma50 = calculateSMA(closePrices, 50);
      const ema12 = calculateEMA(closePrices, 12);
      const ema26 = calculateEMA(closePrices, 26);
      const rsi = calculateRSI(closePrices, 14);

      // 添加技术指标到图表数据
      const chartDataWithIndicators = formattedData.map((item, index) => ({
        ...item,
        sma20: !isNaN(sma20[index]) ? sma20[index] : undefined,
        sma50: !isNaN(sma50[index]) ? sma50[index] : undefined,
        ema12: !isNaN(ema12[index]) ? ema12[index] : undefined,
        ema26: !isNaN(ema26[index]) ? ema26[index] : undefined,
        rsi: !isNaN(rsi[index]) ? rsi[index] : undefined
      }));

      setChartData(chartDataWithIndicators);
      console.log('=== 数据加载完成 ===');

    } catch (error: any) {
      console.error('Failed to fetch historical data:', error);
      const errorMsg = error.message || 'Unknown error';
      setHistoricalDataError(`Failed to load historical data: ${errorMsg}`);
      message.error(`Failed to load historical data: ${errorMsg}`);
      setHistoricalData([]);
      setChartData([]);
    } finally {
      setChartLoading(false);
    }
  };

  // 加载回测历史
  const loadBacktestHistory = async () => {
    if (!symbol) return;

    setBacktestLoading(true);
    try {
      // 这里应该调用真实的 API
      // const response = await backtraderAPI.getBacktestHistory({ symbol });
      // setBacktestHistory(response.data);

      // 模拟数据
      const mockBacktests: BacktestHistoryItem[] = [
        {
          backtestId: 'bt_001',
          status: 'completed',
          symbol: symbol,
          strategy: 'Moving Average Crossover',
          startDate: '2025-01-01',
          endDate: '2025-12-31',
          initialCapital: 100000,
          results: {
            totalReturn: 18.4,
            sharpeRatio: 1.92,
            maxDrawdown: -12.7,
            winRate: 61.3,
            trades: 24,
            annualizedReturn: 19.8
          }
        },
        {
          backtestId: 'bt_002',
          status: 'completed',
          symbol: symbol,
          strategy: 'RSI Strategy',
          startDate: '2025-03-01',
          endDate: '2025-11-30',
          initialCapital: 100000,
          results: {
            totalReturn: 12.1,
            sharpeRatio: 1.45,
            maxDrawdown: -15.2,
            winRate: 58.7,
            trades: 18,
            annualizedReturn: 14.3
          }
        },
        {
          backtestId: 'bt_003',
          status: 'completed',
          symbol: symbol,
          strategy: 'Bollinger Bands',
          startDate: '2025-06-01',
          endDate: '2025-12-31',
          initialCapital: 100000,
          results: {
            totalReturn: 8.7,
            sharpeRatio: 1.12,
            maxDrawdown: -18.5,
            winRate: 52.4,
            trades: 15,
            annualizedReturn: 10.1
          }
        }
      ];

      setBacktestHistory(mockBacktests);
    } catch (error) {
      console.error('Failed to load backtest history:', error);
      message.error('Failed to load backtest history');
    } finally {
      setBacktestLoading(false);
    }
  };

  // 运行回测
  const handleRunBacktest = () => {
    if (!symbol) return;

    message.info(`Starting backtest for ${symbol}`);
    navigate('/backtest', { state: { presetSymbol: symbol } });
  };

  // 查看回测详情
  const handleViewBacktest = (backtestId: string) => {
    navigate(`/backtest-analysis?backtestId=${backtestId}`);
  };

  // 渲染价格图表 - 改为蜡烛图
  const renderPriceChart = () => {
    if (chartLoading) {
      return (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <Spin size="large" />
          <div style={{ marginTop: '16px' }}>Loading chart data...</div>
        </div>
      );
    }

    if (chartData.length === 0) {
      return (
        <Empty
          description="No historical data available"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      );
    }

    // 计算Y轴缩放函数 - 修复价格显示
    const getYAxisDomain = () => {
      if (chartData.length === 0) return [0, 100];

      // 过滤无效价格
      const validPrices = chartData.flatMap(d => [d.open, d.high, d.low, d.close])
        .filter(price => price !== null && price !== undefined && !isNaN(price) && price > 0);

      if (validPrices.length === 0) return [0, 100];

      const minPrice = Math.min(...validPrices);
      const maxPrice = Math.max(...validPrices);

      // 如果价格范围太小，使用固定缓冲
      const priceRange = maxPrice - minPrice;
      if (priceRange < 0.01) {
        return [minPrice - 0.01, maxPrice + 0.01];
      }

      // 2% 缓冲空间（更紧凑）
      const buffer = priceRange * 0.02;
      return [minPrice - buffer, maxPrice + buffer];
    };

    const yDomain = getYAxisDomain();
    const chartHeight = 500; // 主图表高度
    
    // 计算期间变化百分比（Period Change）
    let periodChange = null;
    let periodChangePercent = null;
    let prevCloseLine = null;
    
    if (chartData.length >= 2 && stockData && stockData.previousClose) {
      const firstClose = chartData[0].close;
      const lastClose = chartData[chartData.length - 1].close;
      
      if (firstClose > 0 && lastClose > 0) {
        periodChange = lastClose - firstClose;
        periodChangePercent = (periodChange / firstClose) * 100;
      }
      
      // Prev Close参考线值
      prevCloseLine = stockData.previousClose;
    }
    
    // 计算52周高低点（从chartData中计算）
    let fiftyTwoWeekHigh = null;
    let fiftyTwoWeekLow = null;
    
    if (chartData.length > 0) {
      // 如果是1 Year视图，使用所有数据
      // 如果是其他视图，使用最近一年的数据（如果足够）
      const dataToUse = selectedTimeframe === '1Y' ? chartData : chartData.slice(-252);
      
      if (dataToUse.length > 0) {
        fiftyTwoWeekHigh = Math.max(...dataToUse.map(d => d.high));
        fiftyTwoWeekLow = Math.min(...dataToUse.map(d => d.low));
      }
    }

    // 格式化X轴标签 - 修复：正确处理时间显示
    const formatXAxisTick = (value: string, index: number) => {
      if (!value) return '';
      
      try {
        const date = new Date(value);
        
        if (isNaN(date.getTime())) {
          return '';
        }
        
        // 根据timeframe显示不同的格式
        if (selectedTimeframe === '1D') {
          // 1 Day: 显示时间 (HH:MM)
          // 对于1天视图，显示小时:分钟
          const hour = date.getHours();
          const minute = date.getMinutes();
          
          // 显示整点时间（如 09:00, 10:00, 11:00）
          // 对于5分钟数据，只显示整点时间，避免拥挤
          if (minute === 0) {
            return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
          }
          return ''; // 非整点不显示标签
        } else {
          // 其他timeframe: 显示日期 (MM/DD)
          // 根据数据点密度决定显示哪些标签
          const month = date.getMonth() + 1;
          const day = date.getDate();
          const dateStr = `${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}`;
          
          if (selectedTimeframe === '1W') {
            // 1 Week: 通常5-7个点，隔一个显示一个日期
            return index % 2 === 0 ? dateStr : '';
          } else if (selectedTimeframe === '1M') {
            // 1 Month: 通常20-22个点，隔一个显示一个日期
            return index % 2 === 0 ? dateStr : '';
          } else if (selectedTimeframe === '3M') {
            // 3 Months: 通常60-66个点，按周显示（每周显示一次）
            // 使用索引确保均匀分布：每5个数据点显示一个（约每周）
            return index % 5 === 0 ? dateStr : '';
          } else {
            // 1 Year: 固定按月显示主刻度
            // 每月只显示一个标签，格式为 MM/YY（如 04/25）
            // 简单规则：每月15日显示标签（月中，确保每月都有交易日）
            const day = date.getDate();
            const yearShort = date.getFullYear().toString().slice(-2);
            
            // 检查是否是每月第一个交易日（日期 <= 5 且月份变化）
            if (day <= 5) {
              // 检查月份是否变化
              try {
                // 如果是第一个数据点，检查是否有前一个月的记录
                if (index === 0) {
                  // 第一个点不显示，从第二个点开始检查月份变化
                  return '';
                }
                
                const prevDate = new Date(chartData[index - 1].date);
                const prevMonth = prevDate.getMonth();
                
                if (date.getMonth() !== prevMonth) {
                  return `${String(month).padStart(2, '0')}/${yearShort}`;
                }
              } catch (e) {
                // 如果解析失败，不显示
              }
            }
            
            return '';
          }
        }
      } catch (e) {
        console.error('Error formatting date:', e, value);
        return '';
      }
    };

    // 自定义Tooltip组件 - 修复：正确处理日期显示
    const CustomTooltip = ({ active, payload, label }: any) => {
      if (!active || !payload || payload.length === 0) {
        return null;
      }

      const data = payload[0].payload;
      // 获取数据点索引
      const dataIndex = chartData.findIndex(d => d.date === data.date);
      
      // 从数据中获取日期，而不是从label参数
      let date: Date;
      try {
        // 尝试从数据中的date字段获取
        if (data.date) {
          date = new Date(data.date);
        } else if (label) {
          date = new Date(label);
        } else {
          date = new Date();
        }
        
        if (isNaN(date.getTime())) {
          date = new Date();
        }
      } catch (e) {
        console.error('Error parsing date in tooltip:', e);
        date = new Date();
      }
      
      // 根据timeframe决定显示内容
      const isDaily = selectedTimeframe === '1D';
      
      return (
        <div style={{
          backgroundColor: 'rgba(255, 255, 255, 0.98)',
          border: '1px solid #d9d9d9',
          borderRadius: '4px',
          padding: '12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          minWidth: '200px',
          fontFamily: "'SF Mono', Monaco, 'Courier New', monospace",
          fontSize: '12px'
        }}>
          {/* 标题行 - 时间/日期 */}
          <div style={{
            fontWeight: '600',
            marginBottom: '10px',
            color: '#1f1f1f',
            borderBottom: '1px solid #f0f0f0',
            paddingBottom: '6px',
            fontSize: '11px'
          }}>
            {isDaily 
              ? `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
              : `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`
            }
          </div>
          
          {/* 数据行 - 金融终端对齐样式 */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '6px'
          }}>
            {/* 1 Day: 显示Close和Percent Change */}
            {isDaily ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#8c8c8c' }}>Close:</span>
                  <span style={{ fontWeight: '500', color: '#1890ff' }}>
                    ${data.close.toFixed(2)}
                  </span>
                </div>
                {/* 如果有前一个数据点，计算percent change */}
                {dataIndex > 0 && chartData[dataIndex - 1] && chartData[dataIndex - 1].close > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#8c8c8c' }}>Change:</span>
                    <span style={{ 
                      fontWeight: '500', 
                      color: data.close >= chartData[dataIndex - 1].close ? '#52c41a' : '#ff4d4f'
                    }}>
                      {data.close >= chartData[dataIndex - 1].close ? '+' : ''}
                      {((data.close - chartData[dataIndex - 1].close) / chartData[dataIndex - 1].close * 100).toFixed(2)}%
                    </span>
                  </div>
                )}
              </>
            ) : (
              // 其他timeframe: 显示OHLC和Percent Change
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#8c8c8c' }}>Open:</span>
                  <span style={{ fontWeight: '500' }}>
                    ${data.open.toFixed(2)}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#8c8c8c' }}>High:</span>
                  <span style={{ fontWeight: '500', color: '#52c41a' }}>
                    ${data.high.toFixed(2)}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#8c8c8c' }}>Low:</span>
                  <span style={{ fontWeight: '500', color: '#ff4d4f' }}>
                    ${data.low.toFixed(2)}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#8c8c8c' }}>Close:</span>
                  <span style={{ fontWeight: '500', color: '#1890ff' }}>
                    ${data.close.toFixed(2)}
                  </span>
                </div>
                {/* 如果有前一个数据点，计算percent change */}
                {dataIndex > 0 && chartData[dataIndex - 1] && chartData[dataIndex - 1].close > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#8c8c8c' }}>Change:</span>
                    <span style={{ 
                      fontWeight: '500', 
                      color: data.close >= chartData[dataIndex - 1].close ? '#52c41a' : '#ff4d4f'
                    }}>
                      {data.close >= chartData[dataIndex - 1].close ? '+' : ''}
                      {((data.close - chartData[dataIndex - 1].close) / chartData[dataIndex - 1].close * 100).toFixed(2)}%
                    </span>
                  </div>
                )}
              </>
            )}
            
            {/* 技术指标：SMA20和SMA50（如果存在） */}
            {(data.sma20 !== undefined && !isNaN(data.sma20)) && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#8c8c8c' }}>SMA20:</span>
                <span style={{ fontWeight: '500', color: '#52c41a' }}>
                  ${data.sma20.toFixed(2)}
                </span>
              </div>
            )}
            
            {(data.sma50 !== undefined && !isNaN(data.sma50)) && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#8c8c8c' }}>SMA50:</span>
                <span style={{ fontWeight: '500', color: '#fa8c16' }}>
                  ${data.sma50.toFixed(2)}
                </span>
              </div>
            )}
          </div>
        </div>
      );
    };

    return (
      <ResponsiveContainer width="100%" height={chartHeight}>
        <LineChart data={chartData}>
          {/* 网格线 - 更淡更专业 */}
          <CartesianGrid 
            strokeDasharray="3 3" 
            stroke="#f0f0f0" 
            vertical={false} // 完全隐藏竖向线
            strokeOpacity={0.2} // 更淡
          />

          {/* X轴 - 优化显示 */}
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: '#666' }} // 更小更淡
            axisLine={{ stroke: '#d9d9d9' }}
            tickLine={false} // 所有timeframe都隐藏小竖线
            height={35} // 适当高度
            tickFormatter={formatXAxisTick}
            interval="preserveStartEnd" // 智能间隔，只保留关键日期
          />

          {/* Y轴 - 价格坐标（优化刻度） */}
          <YAxis
            domain={yDomain}
            tick={{ fontSize: 11, fill: '#333' }}
            axisLine={{ stroke: '#bfbfbf' }}
            tickLine={{ stroke: '#bfbfbf' }}
            width={65}
            tickFormatter={(value) => {
              // 统一格式：根据价格大小决定小数位
              if (value >= 1000) {
                return `$${(value / 1000).toFixed(1)}K`; // 千位格式
              } else if (value >= 100) {
                return `$${value.toFixed(0)}`; // 整数
              } else if (value >= 10) {
                return `$${value.toFixed(1)}`; // 1位小数
              } else {
                return `$${value.toFixed(2)}`; // 2位小数
              }
            }}
            tickCount={5} // 更少的刻度，更整
          />

          {/* 金融终端风格Tooltip */}
          <Tooltip
            content={<CustomTooltip />}
            cursor={{ stroke: 'rgba(24, 144, 255, 0.3)', strokeWidth: 1, strokeDasharray: '3 3' }} // 更淡的hover线
          />

          {/* 主价格线 - 收盘价，改为普通折线，更真实 */}
          <Line
            type="linear" // 改为linear，不是monotone（避免过度平滑）
            dataKey="close"
            stroke="#1890ff"
            strokeWidth={2.2} // 加粗一点，更明显
            dot={false}
            activeDot={{ 
              r: 5, 
              strokeWidth: 2,
              stroke: '#fff',
              fill: '#1890ff'
            }}
            name="Price"
            connectNulls={true}
          />
          
          {/* 当前价格标记（最后一个点） */}
          {chartData.length > 0 && (
            <ReferenceDot
              x={chartData[chartData.length - 1].date}
              y={chartData[chartData.length - 1].close}
              r={6}
              fill="#1890ff"
              stroke="#fff"
              strokeWidth={2}
              label={{
                value: `Current: $${chartData[chartData.length - 1].close.toFixed(2)}`,
                position: 'right',
                fill: '#1890ff',
                fontSize: 9,
                fontWeight: '600'
              }}
            />
          )}

          {/* Prev Close参考虚线（如果数据存在） */}
          {prevCloseLine && (
            <ReferenceLine
              y={prevCloseLine}
              stroke="#8c8c8c"
              strokeWidth={1}
              strokeDasharray="5 5"
              label={{
                value: `Prev Close`,
                position: 'right',
                fill: '#8c8c8c',
                fontSize: 8,
                fontWeight: '400',
                opacity: 0.7
              }}
            />
          )}

          {/* 52周高低点参考线（如果数据存在） */}
          {fiftyTwoWeekHigh && (
            <ReferenceLine
              y={fiftyTwoWeekHigh}
              stroke="#52c41a"
              strokeWidth={1}
              strokeDasharray="3 3"
              strokeOpacity={0.5}
              label={{
                value: `Period High`,
                position: 'right',
                fill: '#52c41a',
                fontSize: 8,
                fontWeight: '400',
                opacity: 0.7
              }}
            />
          )}
          
          {fiftyTwoWeekLow && (
            <ReferenceLine
              y={fiftyTwoWeekLow}
              stroke="#ff4d4f"
              strokeWidth={1}
              strokeDasharray="3 3"
              strokeOpacity={0.5}
              label={{
                value: `Period Low`,
                position: 'right',
                fill: '#ff4d4f',
                fontSize: 8,
                fontWeight: '400',
                opacity: 0.7
              }}
            />
          )}

          {/* 可选：保留SMA20/SMA50，如果数据存在且图表不混乱 */}
          {chartData.some(d => d.sma20 !== undefined && !isNaN(d.sma20)) && chartData.length > 20 && (
            <Line
              type="linear"
              dataKey="sma20"
              stroke="#52c41a"
              strokeWidth={0.8} // 更细
              strokeDasharray="3 3"
              strokeOpacity={0.5} // 更透明
              dot={false}
              name="SMA 20"
              connectNulls={true}
            />
          )}
          
          {chartData.some(d => d.sma50 !== undefined && !isNaN(d.sma50)) && chartData.length > 50 && (
            <Line
              type="linear"
              dataKey="sma50"
              stroke="#fa8c16"
              strokeWidth={0.8} // 更细
              strokeDasharray="3 3"
              strokeOpacity={0.5} // 更透明
              dot={false}
              name="SMA 50"
              connectNulls={true}
            />
          )}

          {/* 智能图例 - 只有多条线时显示 */}
          {chartData.some(d => d.sma20 !== undefined) || chartData.some(d => d.sma50 !== undefined) ? (
            <Legend 
              wrapperStyle={{
                fontSize: '9px', // 更小
                color: '#888', // 更淡
                paddingTop: '6px',
                paddingBottom: '2px',
                display: 'flex',
                justifyContent: 'center',
                gap: '12px'
              }}
              iconSize={5} // 更小
              iconType="plainline"
            />
          ) : null}
        </LineChart>
      </ResponsiveContainer>
    );
  };

  // 渲染RSI图表
  const renderRSIChart = () => {
    if (chartData.length === 0) {
      return (
        <Empty
          description="No RSI data available"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      );
    }

    return (
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis domain={[0, 100]} />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="rsi" stroke="#8884d8" dot={false} />
          <Line type="monotone" dataKey={70} stroke="#ff4d4f" strokeDasharray="5 5" dot={false} />
          <Line type="monotone" dataKey={30} stroke="#52c41a" strokeDasharray="5 5" dot={false} />
        </LineChart>
      </ResponsiveContainer>
    );
  };

  // 初始化加载数据
  useEffect(() => {
    if (symbol) {
      loadStockData();
      loadBacktestHistory();
      loadHistoricalPrices();
    }
  }, [symbol]);

  // 当 timeframe 改变时重新加载历史数据
  useEffect(() => {
    if (symbol) {
      loadHistoricalPrices();
    }
  }, [selectedTimeframe]);

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <Spin size="large" />
        <div style={{ marginTop: '16px' }}>Loading {symbol} analysis data...</div>
      </div>
    );
  }

  if (!stockData) {
    return (
      <div style={{ padding: '24px' }}>
        {stockDataError ? (
          <Card>
            <Alert
              message="Failed to Load Stock Data"
              description={
                <div>
                  <p>Could not load data for {symbol}. Error: {stockDataError}</p>
                  <p>Possible causes:</p>
                  <ul>
                    <li>Backend API is not running</li>
                    <li>API key may be invalid or expired</li>
                    <li>Network connection issue</li>
                    <li>Symbol {symbol} may not exist</li>
                  </ul>
                  <p>Please check the backend server and try again.</p>
                </div>
              }
              type="error"
              showIcon
            />
          </Card>
        ) : (
          <Empty
            description={`No data found for ${symbol}`}
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        )}
      </div>
    );
  }

  const isPositive = safeNumber(stockData.change) > 0;
  const isNegative = safeNumber(stockData.change) < 0;

  // 格式化市值为缩写格式
  const formatMarketCap = (value: number | null | undefined): string => {
    if (value === null || value === undefined || value === 0) return '--';
    
    const num = Number(value);
    if (isNaN(num)) return '--';
    
    // Finnhub返回的marketCap是百万为单位，需要转换为实际美元值
    const actualValue = num * 1000000;
    
    // 万亿 (Trillion)
    if (actualValue >= 1e12) {
      const trillions = actualValue / 1e12;
      return `$${trillions.toFixed(trillions >= 10 ? 0 : 1)}T`;
    }
    
    // 十亿 (Billion)
    if (actualValue >= 1e9) {
      const billions = actualValue / 1e9;
      return `$${billions.toFixed(billions >= 10 ? 0 : 1)}B`;
    }
    
    // 百万 (Million)
    if (actualValue >= 1e6) {
      const millions = actualValue / 1e6;
      return `$${millions.toFixed(millions >= 10 ? 0 : 1)}M`;
    }
    
    // 千 (Thousand)
    if (actualValue >= 1e3) {
      const thousands = actualValue / 1e3;
      return `$${thousands.toFixed(thousands >= 10 ? 0 : 1)}K`;
    }
    
    // 小于1000
    return `$${actualValue.toFixed(2)}`;
  };

  return (
    <div style={{ padding: '16px' }}>
      {/* 头部信息 - 更专业 */}
      <Card
        style={{
          marginBottom: '24px',
          border: '1px solid #e8e8e8',
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
        }}
      >
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} sm={12} md={6}>
            <div>
              <div style={{ fontSize: '28px', fontWeight: '700', color: '#1f1f1f', lineHeight: '1.2' }}>
                {stockData.symbol}
              </div>
              <div style={{
                fontSize: '14px',
                color: '#595959',
                fontWeight: '500',
                marginTop: '4px'
              }}>
                {stockData.name || 'N/A'}
              </div>
            </div>
          </Col>

          <Col xs={24} sm={12} md={6}>
            <div style={{ textAlign: 'center' }}>
              <div style={{
                fontSize: '28px',
                fontWeight: '700',
                color: '#1f1f1f',
                fontFeatureSettings: '"tnum"',
                lineHeight: '1.2'
              }}>
                {stockData.price !== null ? `$${safeToFixed(stockData.price, 2)}` : '--'}
              </div>
              <div style={{
                fontSize: '18px',
                fontWeight: '600',
                color: isPositive ? '#52c41a' : isNegative ? '#ff4d4f' : '#595959',
                marginTop: '4px',
                fontFeatureSettings: '"tnum"'
              }}>
                {isPositive ? '+' : ''}{safeToFixed(stockData.change, 2)}
                {' '}
                ({isPositive ? '+' : ''}{safeToFixed(stockData.changePercent, 2)}%)
              </div>
            </div>
          </Col>

          <Col xs={24} sm={24} md={12}>
            <div style={{ textAlign: 'right' }}>
              <Space size="middle">
                <Button
                  type="primary"
                  icon={<PlayCircleOutlined />}
                  onClick={handleRunBacktest}
                  size="large"
                  style={{
                    height: '40px',
                    padding: '0 20px',
                    fontSize: '15px',
                    fontWeight: '600'
                  }}
                >
                  Run Backtest
                </Button>
                <Button
                  icon={<ReloadOutlined />}
                  onClick={loadStockData}
                  loading={loading}
                  size="large"
                  style={{
                    height: '40px',
                    padding: '0 20px',
                    fontSize: '15px',
                    fontWeight: '500'
                  }}
                >
                  Refresh
                </Button>
              </Space>
            </div>
          </Col>
        </Row>
      </Card>

      {/* 价格信息卡片 - 更专业 */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={24} sm={12} md={6}>
          <Card
            size="small"
            style={{
              border: '1px solid #f0f0f0',
              boxShadow: '0 1px 4px rgba(0,0,0,0.02)'
            }}
          >
            <div style={{ padding: '10px' }}>
              <div style={{
                fontSize: '11px',
                color: '#8c8c8c',
                fontWeight: '500',
                marginBottom: '6px',
                display: 'flex',
                alignItems: 'center'
              }}>
                <ArrowUpOutlined style={{ marginRight: '6px', fontSize: '11px', color: '#52c41a' }} />
                Day High
              </div>
              <div style={{
                fontSize: '22px',
                fontWeight: '700',
                color: '#1f1f1f',
                fontFeatureSettings: '"tnum"',
                lineHeight: '1.2'
              }}>
                {stockData.dayHigh !== null && stockData.dayHigh > 0 ? `$${safeToFixed(stockData.dayHigh, 2)}` : '--'}
              </div>
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card
            size="small"
            style={{
              border: '1px solid #f0f0f0',
              boxShadow: '0 1px 4px rgba(0,0,0,0.02)'
            }}
          >
            <div style={{ padding: '10px' }}>
              <div style={{
                fontSize: '11px',
                color: '#8c8c8c',
                fontWeight: '500',
                marginBottom: '6px',
                display: 'flex',
                alignItems: 'center'
              }}>
                <ArrowDownOutlined style={{ marginRight: '6px', fontSize: '11px', color: '#ff4d4f' }} />
                Day Low
              </div>
              <div style={{
                fontSize: '22px',
                fontWeight: '700',
                color: '#1f1f1f',
                fontFeatureSettings: '"tnum"',
                lineHeight: '1.2'
              }}>
                {stockData.dayLow !== null && stockData.dayLow > 0 ? `$${safeToFixed(stockData.dayLow, 2)}` : '--'}
              </div>
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card
            size="small"
            style={{
              border: '1px solid #f0f0f0',
              boxShadow: '0 1px 4px rgba(0,0,0,0.02)'
            }}
          >
            <div style={{ padding: '10px' }}>
              <div style={{
                fontSize: '11px',
                color: '#8c8c8c',
                fontWeight: '500',
                marginBottom: '6px',
                display: 'flex',
                alignItems: 'center'
              }}>
                <LineChartOutlined style={{ marginRight: '6px', fontSize: '11px', color: '#1890ff' }} />
                Prev Close
              </div>
              <div style={{
                fontSize: '22px',
                fontWeight: '700',
                color: '#1f1f1f',
                fontFeatureSettings: '"tnum"',
                lineHeight: '1.2'
              }}>
                {stockData.previousClose !== null ? `$${safeToFixed(stockData.previousClose, 2)}` : '--'}
              </div>
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card
            size="small"
            style={{
              border: '1px solid #f0f0f0',
              boxShadow: '0 1px 4px rgba(0,0,0,0.02)'
            }}
          >
            <div style={{ padding: '10px' }}>
              <div style={{
                fontSize: '11px',
                color: '#8c8c8c',
                fontWeight: '500',
                marginBottom: '6px'
              }}>
                Market Cap
              </div>
              <div style={{
                fontSize: '22px',
                fontWeight: '700',
                color: '#1f1f1f',
                fontFeatureSettings: '"tnum"',
                lineHeight: '1.2'
              }}>
                {formatMarketCap(stockData.marketCap)}
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      {/* 图表区域 - 强化 */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col span={24}>
          <Card
            title={
              <span style={{ fontSize: '16px', fontWeight: '600', color: '#1f1f1f' }}>
                Price Chart
              </span>
            }
            extra={
              <Space size="small">
                {/* 当前价格、变化值和涨跌幅summary */}
                {chartData.length > 0 && stockData && chartData.length >= 2 && (() => {
                  const firstClose = chartData[0].close;
                  const lastClose = chartData[chartData.length - 1].close;
                  const currentPrice = stockData.price || lastClose;
                  
                  if (firstClose > 0 && lastClose > 0) {
                    const change = lastClose - firstClose;
                    const changePercent = (change / firstClose) * 100;
                    const isPositive = change >= 0;
                    
                    return (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '16px', // 增加间距以容纳标签
                        marginRight: '20px',
                        padding: '4px 0',
                        fontFamily: "'SF Mono', Monaco, 'Courier New', monospace"
                      }}>
                        {/* Price 组 */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                          <div style={{
                            fontSize: '10px',
                            color: '#8c8c8c',
                            fontWeight: '500',
                            marginBottom: '2px',
                            letterSpacing: '0.3px'
                          }}>
                            Price
                          </div>
                          <div style={{
                            fontSize: '15px',
                            fontWeight: '700',
                            color: '#1f1f1f',
                            letterSpacing: '-0.2px'
                          }}>
                            ${currentPrice.toFixed(2)}
                          </div>
                        </div>
                        
                        <div style={{ width: '1px', height: '24px', backgroundColor: '#f0f0f0' }}></div>
                        
                        {/* Change 组 */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                          <div style={{
                            fontSize: '10px',
                            color: '#8c8c8c',
                            fontWeight: '500',
                            marginBottom: '2px',
                            letterSpacing: '0.3px'
                          }}>
                            Change
                          </div>
                          <div style={{
                            fontSize: '13px',
                            fontWeight: '600',
                            color: isPositive ? '#52c41a' : '#ff4d4f',
                            backgroundColor: isPositive ? 'rgba(82, 196, 26, 0.05)' : 'rgba(255, 77, 79, 0.05)',
                            padding: '2px 8px',
                            borderRadius: '3px',
                            minWidth: '55px',
                            textAlign: 'center',
                            border: `1px solid ${isPositive ? 'rgba(82, 196, 26, 0.15)' : 'rgba(255, 77, 79, 0.15)'}`
                          }}>
                            {isPositive ? '+' : ''}{change.toFixed(2)}
                          </div>
                        </div>
                        
                        {/* Period Change 组 */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                          <div style={{
                            fontSize: '10px',
                            color: '#8c8c8c',
                            fontWeight: '500',
                            marginBottom: '2px',
                            letterSpacing: '0.3px'
                          }}>
                            Period Change
                          </div>
                          <div style={{
                            fontSize: '13px',
                            fontWeight: '600',
                            color: isPositive ? '#52c41a' : '#ff4d4f',
                            backgroundColor: isPositive ? 'rgba(82, 196, 26, 0.05)' : 'rgba(255, 77, 79, 0.05)',
                            padding: '2px 8px',
                            borderRadius: '3px',
                            minWidth: '65px',
                            textAlign: 'center',
                            border: `1px solid ${isPositive ? 'rgba(82, 196, 26, 0.15)' : 'rgba(255, 77, 79, 0.15)'}`
                          }}>
                            {isPositive ? '+' : ''}{changePercent.toFixed(2)}%
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}
                
                <Radio.Group
                  value={selectedTimeframe}
                  onChange={(e) => setSelectedTimeframe(e.target.value)}
                  size="small"
                  style={{ marginRight: '8px' }}
                >
                  {Object.entries(TIMEFRAMES).map(([key, config]) => (
                    <Radio.Button
                      key={key}
                      value={key}
                      style={{
                        fontSize: '12px',
                        padding: '4px 8px',
                        height: '28px',
                        lineHeight: '20px'
                      }}
                    >
                      {config.label}
                    </Radio.Button>
                  ))}
                </Radio.Group>
                <DataSourceBadge source={dataSource} />
              </Space>
            }
            style={{
              border: '1px solid #e8e8e8',
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
            }}
            bodyStyle={{ padding: '12px' }}
          >
            {renderPriceChart()}
          </Card>
        </Col>
      </Row>

      {/* 技术指标 - 更充实 */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col span={24}>
          <Card
            title={
              <span style={{ fontSize: '16px', fontWeight: '600', color: '#1f1f1f' }}>
                Technical Indicators
              </span>
            }
            style={{
              border: '1px solid #e8e8e8',
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
            }}
            bodyStyle={{ padding: '0' }}
          >
            <Tabs
              defaultActiveKey="rsi"
              size="middle"
              style={{ padding: '0 16px' }}
              tabBarStyle={{
                marginBottom: 0,
                borderBottom: '1px solid #f0f0f0'
              }}
            >
              <TabPane
                tab={
                  <span style={{ fontSize: '14px', fontWeight: '500' }}>
                    RSI
                  </span>
                }
                key="rsi"
              >
                <div style={{ padding: '16px 0' }}>
                  {renderRSIChart()}
                </div>
              </TabPane>
              <TabPane
                tab={
                  <span style={{ fontSize: '14px', fontWeight: '500' }}>
                    Moving Averages
                  </span>
                }
                key="ma"
              >
                <div style={{ padding: '24px' }}>
                  <Row gutter={[24, 24]}>
                    <Col span={8}>
                      <Card
                        size="small"
                        style={{
                          border: '1px solid #f0f0f0',
                          textAlign: 'center'
                        }}
                      >
                        <div style={{ padding: '16px' }}>
                          <div style={{
                            fontSize: '12px',
                            color: '#8c8c8c',
                            fontWeight: '500',
                            marginBottom: '8px'
                          }}>
                            SMA 20
                          </div>
                          <div style={{
                            fontSize: '24px',
                            fontWeight: '700',
                            color: '#52c41a',
                            fontFeatureSettings: '"tnum"',
                            lineHeight: '1.2'
                          }}>
                            {(() => {
                              if (chartData.length === 0) return '--';
                              const lastData = chartData[chartData.length - 1];
                              return lastData?.sma20 !== undefined
                                ? `$${safeToFixed(lastData.sma20, 2)}`
                                : '--';
                            })()}
                          </div>
                        </div>
                      </Card>
                    </Col>
                    <Col span={8}>
                      <Card
                        size="small"
                        style={{
                          border: '1px solid #f0f0f0',
                          textAlign: 'center'
                        }}
                      >
                        <div style={{ padding: '16px' }}>
                          <div style={{
                            fontSize: '12px',
                            color: '#8c8c8c',
                            fontWeight: '500',
                            marginBottom: '8px'
                          }}>
                            SMA 50
                          </div>
                          <div style={{
                            fontSize: '24px',
                            fontWeight: '700',
                            color: '#ff4d4f',
                            fontFeatureSettings: '"tnum"',
                            lineHeight: '1.2'
                          }}>
                            {(() => {
                              if (chartData.length === 0) return '--';
                              const lastData = chartData[chartData.length - 1];
                              return lastData?.sma50 !== undefined
                                ? `$${safeToFixed(lastData.sma50, 2)}`
                                : '--';
                            })()}
                          </div>
                        </div>
                      </Card>
                    </Col>
                    <Col span={8}>
                      <Card
                        size="small"
                        style={{
                          border: '1px solid #f0f0f0',
                          textAlign: 'center'
                        }}
                      >
                        <div style={{ padding: '16px' }}>
                          <div style={{
                            fontSize: '12px',
                            color: '#8c8c8c',
                            fontWeight: '500',
                            marginBottom: '8px'
                          }}>
                            Current Price
                          </div>
                          <div style={{
                            fontSize: '24px',
                            fontWeight: '700',
                            color: '#1890ff',
                            fontFeatureSettings: '"tnum"',
                            lineHeight: '1.2'
                          }}>
                            {stockData.price !== null ? `$${safeToFixed(stockData.price, 2)}` : '--'}
                          </div>
                        </div>
                      </Card>
                    </Col>
                  </Row>
                  <div style={{ marginTop: '24px', textAlign: 'center' }}>
                    <div style={{
                      fontSize: '13px',
                      color: '#595959',
                      fontWeight: '500'
                    }}>
                      {(() => {
                        if (chartData.length === 0) return 'Insufficient data for trend analysis';
                        const lastData = chartData[chartData.length - 1];
                        if (!lastData || lastData.sma20 === undefined || lastData.sma50 === undefined) return 'Insufficient data for trend analysis';

                        return lastData.sma20 > lastData.sma50 ? (
                          <span style={{ color: '#52c41a' }}>
                            <ArrowUpOutlined /> Bullish: SMA 20 above SMA 50
                          </span>
                        ) : (
                          <span style={{ color: '#ff4d4f' }}>
                            <ArrowDownOutlined /> Bearish: SMA 20 below SMA 50
                          </span>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              </TabPane>
            </Tabs>
          </Card>
        </Col>
      </Row>

      {/* 公司信息和回测历史 - 统一样式 */}
      <Row gutter={[16, 16]}>
        <Col xs={24} md={12}>
          <Card
            title={
              <span style={{ fontSize: '16px', fontWeight: '600', color: '#1f1f1f' }}>
                Company Information
              </span>
            }
            style={{
              border: '1px solid #e8e8e8',
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
              height: '100%'
            }}
            bodyStyle={{ padding: '16px' }}
          >
            <Row gutter={[16, 16]}>
              <Col span={12}>
                <div style={{ marginBottom: '16px' }}>
                  <div style={{
                    fontSize: '12px',
                    color: '#8c8c8c',
                    fontWeight: '500',
                    marginBottom: '4px'
                  }}>
                    Sector
                  </div>
                  <div style={{
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#1f1f1f'
                  }}>
                    {stockData.sector || 'Unknown'}
                  </div>
                </div>
              </Col>

              <Col span={12}>
                <div style={{ marginBottom: '16px' }}>
                  <div style={{
                    fontSize: '12px',
                    color: '#8c8c8c',
                    fontWeight: '500',
                    marginBottom: '4px'
                  }}>
                    Industry
                  </div>
                  <div style={{
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#1f1f1f'
                  }}>
                    {stockData.industry || 'Unknown'}
                  </div>
                </div>
              </Col>

              <Col span={12}>
                <div style={{ marginBottom: '16px' }}>
                  <div style={{
                    fontSize: '12px',
                    color: '#8c8c8c',
                    fontWeight: '500',
                    marginBottom: '4px'
                  }}>
                    P/E Ratio
                  </div>
                  <div style={{
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#1f1f1f',
                    fontFeatureSettings: '"tnum"'
                  }}>
                    {stockData.peRatio !== null ? safeToFixed(stockData.peRatio, 2) : '--'}
                  </div>
                </div>
              </Col>

              <Col span={12}>
                <div style={{ marginBottom: '16px' }}>
                  <div style={{
                    fontSize: '12px',
                    color: '#8c8c8c',
                    fontWeight: '500',
                    marginBottom: '4px'
                  }}>
                    Dividend Yield
                  </div>
                  <div style={{
                    fontSize: '14px',
                    fontWeight: '600',
                    color: stockData.dividendYield && stockData.dividendYield >= 2 ? '#52c41a' : '#1f1f1f',
                    fontFeatureSettings: '"tnum"'
                  }}>
                    {stockData.dividendYield !== null ? `${safeToFixed(stockData.dividendYield, 2)}%` : '--'}
                  </div>
                </div>
              </Col>

              <Col span={12}>
                <div style={{ marginBottom: '16px' }}>
                  <div style={{
                    fontSize: '12px',
                    color: '#8c8c8c',
                    fontWeight: '500',
                    marginBottom: '4px'
                  }}>
                    Currency
                  </div>
                  <div style={{
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#1f1f1f'
                  }}>
                    {stockData.currency || 'USD'}
                  </div>
                </div>
              </Col>

              <Col span={12}>
                <div style={{ marginBottom: '16px' }}>
                  <div style={{
                    fontSize: '12px',
                    color: '#8c8c8c',
                    fontWeight: '500',
                    marginBottom: '4px'
                  }}>
                    Data Source
                  </div>
                  <div style={{
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#1f1f1f'
                  }}>
                    {dataSource}
                  </div>
                </div>
              </Col>
            </Row>
          </Card>
        </Col>

        <Col xs={24} md={12}>
          <Card
            title={
              <span style={{ fontSize: '16px', fontWeight: '600', color: '#1f1f1f' }}>
                Backtest History
              </span>
            }
            extra={
              <Button
                size="middle"
                icon={<PlayCircleOutlined />}
                onClick={handleRunBacktest}
                type="primary"
                style={{
                  fontSize: '13px',
                  height: '32px',
                  padding: '0 12px'
                }}
              >
                New Backtest
            </Button>
          }>
            {backtestLoading ? (
              <div style={{ textAlign: 'center', padding: '20px' }}>
                <Spin size="small" />
              </div>
            ) : backtestHistory.length === 0 ? (
              <Empty
                description="No backtest history"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                style={{ padding: '20px 0' }}
              />
            ) : (
              <Table
                dataSource={backtestHistory}
                rowKey="backtestId"
                size="small"
                pagination={false}
                columns={[
                  {
                    title: 'Strategy',
                    dataIndex: 'strategy',
                    key: 'strategy',
                    width: 150,
                    render: (strategy: string) => (
                      <div style={{ fontSize: '12px' }}>{strategy}</div>
                    ),
                  },
                  {
                    title: 'Return',
                    dataIndex: ['results', 'totalReturn'],
                    key: 'return',
                    width: 80,
                    render: (value: number) => {
                      const isPositive = value > 0;
                      return (
                        <Tag color={isPositive ? 'green' : 'red'}>
                          {isPositive ? '+' : ''}{safeToFixed(value, 1)}%
                        </Tag>
                      );
                    },
                  },
                  {
                    title: 'Sharpe',
                    dataIndex: ['results', 'sharpeRatio'],
                    key: 'sharpe',
                    width: 70,
                    render: (value: number) => safeToFixed(value, 2),
                  },
                  {
                    title: 'Actions',
                    key: 'actions',
                    width: 60,
                    render: (_: any, record: BacktestHistoryItem) => (
                      <Button
                        type="link"
                        size="small"
                        onClick={() => handleViewBacktest(record.backtestId)}
                      >
                        View
                      </Button>
                    ),
                  },
                ]}
              />
            )}
          </Card>
        </Col>
      </Row>

      {/* 数据源信息 */}
      <Row style={{ marginTop: '16px' }}>
        <Col span={24}>
          <div style={{ fontSize: '12px', color: '#666', textAlign: 'left' }}>
            <DataSourceBadge source={dataSource} />
            <span style={{ marginLeft: '8px' }}>
              Data updated: {stockData.timestamp ? new Date(stockData.timestamp).toLocaleString() : 'N/A'}
            </span>
          </div>
        </Col>
      </Row>
    </div>
  );
};

export default SymbolAnalysis;