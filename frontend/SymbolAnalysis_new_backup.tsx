import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Button, Tabs, Table, Tag, Space, Spin, Empty, Alert, message, Radio } from 'antd';
import { LineChartOutlined, BarChartOutlined, PlayCircleOutlined, ReloadOutlined, ArrowUpOutlined, ArrowDownOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area, BarChart, Bar, ComposedChart } from 'recharts';
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
    annualizedReturn: number;
  };
  strategy: string;
  startDate: string;
  endDate: string;
  initialCapital: number;
}

const SymbolAnalysis: React.FC = () => {
  const { symbol } = useParams<{ symbol: string }>();
  const navigate = useNavigate();
  
  const [stockData, setStockData] = useState<StockData | null>(null);
  const [historicalData, setHistoricalData] = useState<HistoricalDataPoint[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [chartLoading, setChartLoading] = useState<boolean>(false);
  const [selectedTimeframe, setSelectedTimeframe] = useState<string>('1M');
  const [dataSource, setDataSource] = useState<string>('Polygon.io');
  const [stockDataError, setStockDataError] = useState<string | null>(null);
  const [historicalDataError, setHistoricalDataError] = useState<string | null>(null);
  const [backtestHistory, setBacktestHistory] = useState<BacktestHistoryItem[]>([]);
  const [backtestLoading, setBacktestLoading] = useState<boolean>(false);

  // 加载股票数据
  const loadStockData = async () => {
    if (!symbol) return;
    
    try {
      setLoading(true);
      setStockDataError(null);
      const data = await marketDataService.getStockData(symbol);
      
      setStockData(data);
      setDataSource(data.dataSource || 'Polygon.io');
      message.success(`Loaded ${symbol} data from ${data.dataSource || 'Polygon.io'}`);
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
      
      console.log(`Loading historical data for ${symbol}, timeframe: ${selectedTimeframe}`);
      const response = await marketDataService.getStockHistory(symbol, selectedTimeframe);
      
      console.log(`Historical data loaded:`, {
        symbol: response.symbol,
        count: response.count,
        dataSource: response.dataSource,
        firstPoint: response.data[0],
        lastPoint: response.data[response.data.length - 1]
      });
      
      setHistoricalData(response.data);
      setDataSource(response.dataSource || 'Polygon.io');
      
      // 转换为图表数据格式
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
                date: dateFromTime.toLocaleDateString('en-US', { 
                  month: 'short', 
                  day: 'numeric'
                }),
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
          date: date.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric'
          }),
          open: Number(item.open) || 0,
          high: Number(item.high) || 0,
          low: Number(item.low) || 0,
          close: Number(item.close) || 0,
          volume: Number(item.volume) || 0
        };
      }).filter(Boolean);

      // 计算技术指标
      const closePrices = formattedData.map(d => d.close);
      const sma20 = calculateSMA(closePrices, 20);
      const sma50 = calculateSMA(closePrices, 50);
      const rsi = calculateRSI(closePrices, 14);
      
      const enhancedData = formattedData.map((d, i) => ({
        ...d,
        sma20: sma20[i] !== undefined ? sma20[i] : undefined,
        sma50: sma50[i] !== undefined ? sma50[i] : undefined,
        rsi: rsi[i] !== undefined ? rsi[i] : undefined
      }));
      
      setChartData(enhancedData);
      message.success(`Loaded ${enhancedData.length} data points for ${symbol}`);
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
    
    try {
      setBacktestLoading(true);
      // 模拟数据 - 实际项目中应该调用API
      const mockBacktests: BacktestHistoryItem[] = [
        {
          backtestId: 'bt_001',
          status: 'completed',
          strategy: 'Moving Average Crossover',
          startDate: '2025-01-01',
          endDate: '2025-12-31',
          initialCapital: 100000,
          results: {
            totalReturn: 15.2,
            sharpeRatio: 1.45,
            maxDrawdown: -12.3,
            winRate: 58.7,
            trades: 24,
            annualizedReturn: 16.8
          }
        },
        {
          backtestId: 'bt_002',
          status: 'completed',
          strategy: 'RSI Strategy',
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

  // 计算Y轴范围
  const getYAxisDomain = () => {
    if (chartData.length === 0) return [0, 100];
    
    const prices = chartData.flatMap(d => [d.open, d.high, d.low, d.close]);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    
    // 5% 缓冲空间
    return [minPrice * 0.95, maxPrice * 1.05];
  };

  // 渲染价格图表
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
    
    return (
      <ResponsiveContainer width="100%" height={500}>
        <ComposedChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis 
            dataKey="date" 
            tick={{ fontSize: 12, fill: '#595959' }}
            axisLine={{ stroke: '#d9d9d9' }}
          />
          <YAxis 
            domain={getYAxisDomain()} 
            tick={{ fontSize: 12, fill: '#595959' }}
            axisLine={{ stroke: '#d9d9d9' }}
          />
          <YAxis 
            yAxisId="right" 
            orientation="right" 
            tick={{ fontSize: 12, fill: '#595959' }}
            axisLine={{ stroke: '#d9d9d9' }}
          />
          <Tooltip 
            contentStyle={{ 
              fontSize: '12px',
              borderRadius: '6px',
              border: '1px solid #e8e8e8',
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              padding: '12px'
            }}
            formatter={(value, name, props) => {
              if (name === 'volume') {
                return [value.toLocaleString(), 'Volume'];
              }
              return [`$${Number(value).toFixed(2)}`, name];
            }}
            labelFormatter={(label) => `Date: ${label}`}
            content={({ active, payload, label }) => {
              if (!active || !payload || payload.length === 0) return null;
              
              const data = payload[0].payload;
              const isUp = data.close >= data.open;
              const changeColor = isUp ? '#52c41a' : '#ff4d4f';
              
              return (
                <div style={{ 
                  backgroundColor: 'white',
                  border: '1px solid #e8e8e8',
                  borderRadius: '6px',
                  padding: '12px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                }}>
                  <div style={{ fontWeight: '600', marginBottom: '8px', color: '#1f1f1f' }}>
                    {label}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                    <div style={{ color: '#595959' }}>Open:</div>
                    <div style={{ fontWeight: '500', textAlign: 'right' }}>${data.open.toFixed(2)}</div>
                    
                    <div style={{ color: '#595959' }}>High:</div>
                    <div style={{ fontWeight: '500', textAlign: 'right' }}>${data.high.toFixed(2)}</div>
                    
                    <div style={{ color: '#595959' }}>Low:</div>
                    <div style={{ fontWeight: '500', textAlign: 'right' }}>${data.low.toFixed(2)}</div>
                    
                    <div style={{ color: '#595959' }}>Close:</div>
                    <div style={{ fontWeight: '500', textAlign: 'right', color: changeColor }}>
                      ${data.close.toFixed(2)}
                    </div>
                    
                    <div style={{ color: '#595959' }}>Volume:</div>
                    <div style={{ fontWeight: '500', textAlign: 'right' }}>
                      {data.volume.toLocaleString()}
                    </div>
                    
                    {data.sma20 !== undefined && !isNaN(data.sma20) && (
                      <>
                        <div style={{ color: '#595959' }}>SMA 20:</div>
                        <div style={{ fontWeight: '500', textAlign: 'right', color: '#1890ff' }}>
                          ${data.sma20.toFixed(2)}
                        </div>
                      </>
                    )}
                    
                    {data.sma50 !== undefined && !isNaN(data.sma50) && (
                      <>
                        <div style={{ color: '#595959' }}>SMA 50:</div>
                        <div style={{ fontWeight: '500', textAlign: 'right', color: '#ff7300' }}>
                          ${data.sma50.toFixed(2)}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            }}
          />
          <Legend 
            wrapperStyle={{ 
              fontSize: '12px',
              color: '#595959',
              paddingTop: '8px'
            }}
          />
          {/* 成交量柱状图 - 放在底部，使用辅助Y轴 */}
          <Bar 
            dataKey="volume" 
            fill="#8884d8" 
            yAxisId="right" 
            opacity={0.3}
            name="Volume"
          />
          {/* 收盘价线 - 主要价格趋势 */}
          <Line 
            type="monotone" 
            dataKey="close" 
            stroke="#1890ff" 
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
            name="Close"
          />
          {/* 移动平均线 - 只在数据完整时显示 */}
          {chartData.some(d => d.sma20 !== undefined && !isNaN(d.sma20)) && (
            <Line 
              type="monotone" 
              dataKey="sma20" 
              stroke="#1890ff" 
              strokeWidth={1.5}
              dot={false}
              name="SMA 20"
            />
          )}
          {chartData.some(d => d.sma50 !== undefined && !isNaN(d.sma50)) && (
            <Line 
              type="monotone" 
              dataKey="sma50" 
              stroke="#ff7300" 
              strokeWidth={1.5}
              dot={false}
              name="SMA 50"
            />
          )}
        </ComposedChart>
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
