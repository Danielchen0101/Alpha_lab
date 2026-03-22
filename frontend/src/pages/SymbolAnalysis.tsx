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

// 1 Week专用：简化版 - 显示更多标签，只显示日期
const get1WeekSimpleTicks = (chartData: ChartDataPoint[]): string[] => {
  const ticks: string[] = [];
  
  if (chartData.length === 0) return ticks;
  
  console.log('[1 Week] ====== get1WeekSimpleTicks 开始（简化版） ======');
  console.log('[1 Week] 输入chartData点数:', chartData.length);
  
  // 1. 按时间排序数据
  const sortedData = [...chartData].sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  
  if (sortedData.length === 0) return ticks;
  
  // 2. 简化：每4个数据点显示一个标签（避免太密集）
  const interval = Math.max(1, Math.floor(sortedData.length / 10)); // 目标显示约10个标签
  
  for (let i = 0; i < sortedData.length; i += interval) {
    ticks.push(sortedData[i].date);
  }
  
  // 3. 确保包含最后一个数据点
  if (!ticks.includes(sortedData[sortedData.length - 1].date)) {
    ticks.push(sortedData[sortedData.length - 1].date);
  }
  
  console.log(`[1 Week] 简化版生成 ${ticks.length} 个标签`);
  console.log(`[1 Week] 标签间隔: 每 ${interval} 个数据点显示一个标签`);
  
  return ticks;
};

// 1 Week专用：生成关键时间点标签（9:30和12:30优先）
const get1WeekKeyTimeTicks = (chartData: ChartDataPoint[]): string[] => {
  const ticks: string[] = [];
  
  if (chartData.length === 0) return ticks;
  
  console.log('[1 Week] ====== get1WeekKeyTimeTicks 开始（关键时间点版） ======');
  console.log('[1 Week] 输入chartData点数:', chartData.length);
  
  // 1. 按时间排序数据
  const sortedData = [...chartData].sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  
  if (sortedData.length === 0) return ticks;
  
  // 2. 定义关键时间点（纽约时间）：9:30和12:30优先
  const keyTimes = [
    { hour: 9, minute: 30 },  // 9:30 - 开盘后第一个小时
    { hour: 12, minute: 30 }, // 12:30 - 中午
    { hour: 15, minute: 30 }  // 15:30 - 收盘前最后一个完整小时
  ];
  
  // 3. 收集所有交易日
  const tradingDays = new Set<string>();
  const dayTicks: Record<string, string[]> = {};
  
  sortedData.forEach(point => {
    const date = new Date(point.date);
    
    // 使用纽约时间
    const nyFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric'
    });
    
    const dayKey = nyFormatter.format(date);
    tradingDays.add(dayKey);
    
    if (!dayTicks[dayKey]) {
      dayTicks[dayKey] = [];
    }
    
    // 检查是否是关键时间点
    const timeFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      hour: 'numeric',
      minute: 'numeric',
      hour12: false
    });
    
    const timeStr = timeFormatter.format(date);
    const [hourStr, minuteStr] = timeStr.split(':');
    const hour = parseInt(hourStr);
    const minute = parseInt(minuteStr);
    
    // 如果是关键时间点，添加到该日的候选列表
    const isKeyTime = keyTimes.some(kt => 
      Math.abs(hour - kt.hour) <= 0 && Math.abs(minute - kt.minute) <= 5
    );
    
    if (isKeyTime) {
      dayTicks[dayKey].push(point.date);
    }
  });
  
  console.log(`[1 Week] 交易日数量: ${tradingDays.size}`);
  
  // 4. 为每个交易日选择关键时间点
  Array.from(tradingDays).sort().forEach(dayKey => {
    const dayPoints = dayTicks[dayKey] || [];
    
    if (dayPoints.length > 0) {
      // 优先选择9:30和12:30
      const preferredPoints = dayPoints.filter(point => {
        const date = new Date(point);
        const timeFormatter = new Intl.DateTimeFormat('en-US', {
          timeZone: 'America/New_York',
          hour: 'numeric',
          minute: 'numeric',
          hour12: false
        });
        
        const timeStr = timeFormatter.format(date);
        return timeStr === '09:30' || timeStr === '12:30';
      });
      
      // 如果有9:30或12:30，使用它们
      if (preferredPoints.length > 0) {
        // 最多选择2个点：9:30和12:30
        const selected = preferredPoints.slice(0, 2);
        selected.forEach(point => {
          if (!ticks.includes(point)) {
            ticks.push(point);
          }
        });
      } else {
        // 如果没有9:30或12:30，选择第一个关键时间点
        if (dayPoints[0] && !ticks.includes(dayPoints[0])) {
          ticks.push(dayPoints[0]);
        }
      }
    } else {
      // 如果没有关键时间点，选择该日的第一个数据点
      const firstPointOfDay = sortedData.find(point => {
        const date = new Date(point.date);
        const nyFormatter = new Intl.DateTimeFormat('en-US', {
          timeZone: 'America/New_York',
          year: 'numeric',
          month: 'numeric',
          day: 'numeric'
        });
        return nyFormatter.format(date) === dayKey;
      });
      
      if (firstPointOfDay && !ticks.includes(firstPointOfDay.date)) {
        ticks.push(firstPointOfDay.date);
      }
    }
  });
  
  // 5. 确保标签数量合理（8-12个）
  if (ticks.length > 12) {
    // 抽样减少标签数量
    const sampledTicks = [];
    const sampleInterval = Math.ceil(ticks.length / 10);
    for (let i = 0; i < ticks.length; i += sampleInterval) {
      sampledTicks.push(ticks[i]);
    }
    ticks.length = 0;
    ticks.push(...sampledTicks);
  }
  
  // 6. 确保包含第一个和最后一个数据点
  const firstDate = sortedData[0].date;
  const lastDate = sortedData[sortedData.length - 1].date;
  
  if (!ticks.includes(firstDate)) {
    ticks.unshift(firstDate);
  }
  
  if (!ticks.includes(lastDate)) {
    ticks.push(lastDate);
  }
  
  // 7. 按时间排序
  ticks.sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
  
  console.log(`[1 Week] 关键时间点版生成 ${ticks.length} 个标签`);
  
  // 8. 打印标签详情
  console.log('[1 Week] 标签详情:');
  ticks.forEach((tick, index) => {
    const date = new Date(tick);
    const nyFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      hour12: false
    });
    console.log(`  ${index + 1}. ${nyFormatter.format(date)}`);
  });
  
  return ticks;
};

// 1 Week专用：生成每天3个标签的ticks数组 (09:30, 12:00, 16:00)
const get1WeekTicks = (chartData: ChartDataPoint[], getNewYorkTimeComponents: (date: Date) => { hour: number, minute: number }): string[] => {
  const ticks: string[] = [];
  
  if (chartData.length === 0) return ticks;
  
  console.log('[1 Week] ====== get1WeekTicks 开始（关键时间点版） ======');
  console.log('[1 Week] 输入chartData点数:', chartData.length);
  
  // 1. 按时间排序数据
  const sortedData = [...chartData].sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  
  if (sortedData.length === 0) return ticks;
  
  // 2. 获取第一个数据点的时间
  const firstDate = new Date(sortedData[0].date);
  console.log(`[1 Week] 第一个数据点: ${firstDate.toISOString()} -> ${firstDate.getUTCMonth() + 1}/${firstDate.getUTCDate()} ${firstDate.getUTCHours()}:${firstDate.getUTCMinutes().toString().padStart(2, '0')}`);
  
  // 3. 定义关键时间点：9:30, 12:30, 15:30
  const keyTimes = [
    { hour: 9, minute: 30 },  // 9:30
    { hour: 12, minute: 30 }, // 12:30
    { hour: 15, minute: 30 }  // 15:30
  ];
  
  // 4. 收集所有交易日
  const tradingDays = new Set<string>();
  sortedData.forEach(point => {
    const date = new Date(point.date);
    const dayKey = `${date.getUTCFullYear()}-${date.getUTCMonth() + 1}-${date.getUTCDate()}`;
    tradingDays.add(dayKey);
  });
  
  console.log(`[1 Week] 交易日数量: ${tradingDays.size}`);
  
  // 5. 直接筛选数据点：找出纽约时间为09:30, 12:30, 15:30的点
  console.log(`[1 Week] 直接筛选数据点，查找纽约时间09:30, 12:30, 15:30`);
  
  // 定义关键时间点（只显示这三个）
  const targetTimes = [
    { hour: 9, minute: 30 },  // 09:30
    { hour: 12, minute: 30 }, // 12:30
    { hour: 15, minute: 30 }  // 15:30
  ];
  
  // 特别排除16:00，即使它存在也不作为X轴标签
  const excludeTimes = [
    { hour: 16, minute: 0 }  // 16:00
  ];
  
  // 按交易日分组，确保每个交易日最多3个标签
  const dayGroups: Record<string, Array<{date: string, nyTime: {hour: number, minute: number}}>> = {};
  
  // 先按交易日分组
  sortedData.forEach(point => {
    const pointDate = new Date(point.date);
    const nyTime = getNewYorkTimeComponents(pointDate);
    
    // 创建交易日键（纽约时间）
    const nyFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric'
    });
    const dayKey = nyFormatter.format(pointDate);
    
    if (!dayGroups[dayKey]) {
      dayGroups[dayKey] = [];
    }
    dayGroups[dayKey].push({date: point.date, nyTime});
  });
  
  // 为每个交易日选择最多3个关键时间点
  Object.keys(dayGroups).forEach(dayKey => {
    const points = dayGroups[dayKey];
    console.log(`[1 Week] 交易日 ${dayKey}: ${points.length}个数据点`);
    
    // 找出09:30, 12:30, 15:30的点
    targetTimes.forEach(targetTime => {
      const matchingPoint = points.find(p => 
        p.nyTime.hour === targetTime.hour && p.nyTime.minute === targetTime.minute
      );
      
      if (matchingPoint) {
        // 检查是否已添加（避免重复）
        if (!ticks.includes(matchingPoint.date)) {
          ticks.push(matchingPoint.date);
          console.log(`[1 Week] 找到关键时间点: ${matchingPoint.date} -> 纽约${targetTime.hour.toString().padStart(2, '0')}:${targetTime.minute.toString().padStart(2, '0')}`);
        }
      } else {
        console.log(`[1 Week] 交易日 ${dayKey} 缺少 ${targetTime.hour.toString().padStart(2, '0')}:${targetTime.minute.toString().padStart(2, '0')}`);
      }
    });
    
    // 检查是否有16:00点（但不作为标签）
    const has1600 = points.some(p => p.nyTime.hour === 16 && p.nyTime.minute === 0);
    if (has1600) {
      console.log(`[1 Week] 交易日 ${dayKey} 有16:00数据点（不作为X轴标签）`);
    }
  });
  
  // 如果找到的标签太少，添加第一个和最后一个数据点作为fallback
  if (ticks.length < 3 && sortedData.length > 0) {
    if (!ticks.includes(sortedData[0].date)) {
      ticks.push(sortedData[0].date);
      const firstNyTime = getNewYorkTimeComponents(new Date(sortedData[0].date));
      console.log(`[1 Week] 添加第一个数据点作为fallback: 纽约${firstNyTime.hour.toString().padStart(2, '0')}:${firstNyTime.minute.toString().padStart(2, '0')}`);
    }
    
    if (!ticks.includes(sortedData[sortedData.length - 1].date)) {
      ticks.push(sortedData[sortedData.length - 1].date);
      const lastNyTime = getNewYorkTimeComponents(new Date(sortedData[sortedData.length - 1].date));
      console.log(`[1 Week] 添加最后一个数据点作为fallback: 纽约${lastNyTime.hour.toString().padStart(2, '0')}:${lastNyTime.minute.toString().padStart(2, '0')}`);
    }
  }
  
  // 6. 确保按时间排序
  ticks.sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
  
  console.log('[1 Week] 生成的ticks数量:', ticks.length);
  console.log('[1 Week] === get1WeekTicks 完整输出 ===');
  for (let i = 0; i < ticks.length; i++) {
    const date = new Date(ticks[i]);
    console.log(`  ${i+1}: ${date.toISOString()} -> ${date.getUTCMonth() + 1}/${date.getUTCDate()} ${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}`);
  }
  
  // 7. 确保至少有一个tick（使用第一个数据点）
  if (ticks.length === 0 && sortedData.length > 0) {
    ticks.push(sortedData[0].date);
    console.log(`[1 Week] 无ticks，添加第一个数据点作为默认`);
  }
  
  console.log('[1 Week] ====== get1WeekTicks 结束（关键时间点版） ======');
  return ticks;
};

const SymbolAnalysis: React.FC = () => {
  const { symbol } = useParams<{ symbol: string }>();
  const navigate = useNavigate();
  
  // 获取Finnhub收盘价的函数
  const fetchFinnhubClosingPrice = async (): Promise<number | null> => {
    if (!symbol) return null;
    
    try {
      console.log(`[Finnhub] 尝试获取 ${symbol} 的收盘价`);
      
      // 调用后端API获取Finnhub数据 - 使用实际存在的接口 /api/market/stock/<symbol>
      const response = await fetch(`/api/market/stock/${symbol}`);
      if (!response.ok) {
        console.error(`[Finnhub] API请求失败: ${response.status}`);
        return null;
      }
      
      const data = await response.json();
      console.log(`[Finnhub] 收到数据:`, data);
      
      // 后端返回的字段是 price (当前价格)
      const closingPrice = data.price || data.c || data.pc || data.close;
      if (closingPrice) {
        console.log(`[Finnhub] 获取到收盘价: ${closingPrice}`);
        return Number(closingPrice);
      } else {
        console.error(`[Finnhub] 没有找到收盘价字段，数据:`, data);
        return null;
      }
    } catch (error) {
      console.error(`[Finnhub] 获取收盘价失败:`, error);
      return null;
    }
  };

  const [loading, setLoading] = useState(true);

  // 计算纽约时间与UTC的偏移（小时），自动处理夏令时
  const getNewYorkUTCOffset = (date: Date) => {
    // 使用Intl.DateTimeFormat获取时区偏移
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      timeZoneName: 'short'
    });
    
    const parts = formatter.formatToParts(date);
    const timeZoneName = parts.find(p => p.type === 'timeZoneName')?.value || '';
    
    // EST = UTC-5, EDT = UTC-4
    if (timeZoneName.includes('EDT')) {
      return -4; // 夏令时
    } else {
      return -5; // 标准时间
    }
  };

  // 格式化时间为纽约时间（只用于显示，不修改Date对象）
  const formatAsNewYorkTime = (date: Date, includeDate: boolean = true) => {
    if (!includeDate) {
      // 只显示时间：时:分
      const timeFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        hour: 'numeric',
        minute: 'numeric',
        hour12: false
      });
      
      const timeParts = timeFormatter.formatToParts(date);
      const hour = timeParts.find(p => p.type === 'hour')?.value || '';
      const minute = timeParts.find(p => p.type === 'minute')?.value || '';
      
      return `${hour}:${minute}`;
    }
    
    // 显示日期和时间：年/月/日 时:分（无逗号）
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      hour12: false
    });
    
    // 获取格式化部分
    const parts = formatter.formatToParts(date);
    
    // 提取需要的部分
    const year = parts.find(p => p.type === 'year')?.value || '';
    const month = parts.find(p => p.type === 'month')?.value || '';
    const day = parts.find(p => p.type === 'day')?.value || '';
    const hour = parts.find(p => p.type === 'hour')?.value || '';
    const minute = parts.find(p => p.type === 'minute')?.value || '';
    
    // 组合成年/月/日 时:分格式（无逗号）
    return `${year}/${month}/${day} ${hour}:${minute}`;
  };

  // 获取纽约时间的各个组件（用于比较和筛选）
  const getNewYorkTimeComponents = (date: Date) => {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      hour: 'numeric',
      minute: 'numeric',
      hour12: false
    });
    
    const parts = formatter.formatToParts(date);
    const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0');
    const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0');
    
    return { hour, minute };
  };

  // 调试函数：检查1 Week数据时间点
  const debug1WeekData = (chartData: ChartDataPoint[]) => {
    console.log('[1 Week 调试] === 开始分析数据时间点 ===');
    
    // 按日期分组
    const dateGroups: Record<string, Array<{time: string, date: Date}>> = {};
    
    chartData.forEach((point, index) => {
      const date = new Date(point.date);
      const nyTime = getNewYorkTimeComponents(date);
      const nyDateStr = formatAsNewYorkTime(date, true);
      const dateKey = nyDateStr.split(',')[0]; // 提取日期部分
      const timeStr = `${nyTime.hour.toString().padStart(2, '0')}:${nyTime.minute.toString().padStart(2, '0')}`;
      
      if (!dateGroups[dateKey]) {
        dateGroups[dateKey] = [];
      }
      dateGroups[dateKey].push({time: timeStr, date: date});
    });
    
    // 输出每个日期的数据点
    Object.keys(dateGroups).forEach(dateKey => {
      const points = dateGroups[dateKey];
      console.log(`  ${dateKey}: ${points.length}个点`);
      
      // 检查关键时间点
      const keyTimes = ['09:30', '12:30', '15:30'];
      keyTimes.forEach(keyTime => {
        const hasKeyTime = points.some(p => p.time === keyTime);
        console.log(`    ${hasKeyTime ? '✅' : '❌'} ${keyTime}`);
      });
      
      // 显示所有时间点
      console.log(`    时间点: ${points.map(p => p.time).join(', ')}`);
    });
    
    console.log('[1 Week 调试] === 分析完成 ===');
  };
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
      console.log('4. 原始数据条数:', response.data?.length || 0);
      
      if (response.data && response.data.length > 0) {
        const firstBar = response.data[0];
        const lastBar = response.data[response.data.length - 1];
        console.log('5. 最早日期:', firstBar.time || new Date(firstBar.timestamp * 1000).toISOString());
        console.log('6. 最晚日期:', lastBar.time || new Date(lastBar.timestamp * 1000).toISOString());
        console.log('7. 第一根bar时间:', new Date(firstBar.timestamp * 1000).toISOString(), {
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

      // === 前端接收到的原始响应 ===
      console.log('=== 前端接收到的原始响应 ===');
      console.log('1. 完整响应结构:', response);
      console.log('2. 数据源:', response.dataSource);
      console.log('3. 数据条数:', response.count);
      console.log('4. 警告信息:', (response as any).warning || '无');
      console.log('5. 是否模拟数据:', (response as any).isSimulated || false);
      console.log('6. 是否真实数据:', (response as any).isRealData || false);
      console.log('7. 错误信息:', (response as any).error || '无');
      
      // 检查是否没有数据
      if (!response.data || response.data.length === 0) {
        console.log('8. 后端返回空数据，显示"No historical data available"');
        setHistoricalData([]);
        setChartData([]);
        setDataSource(response.dataSource || '数据不可用');
        setChartLoading(false);
        return; // 直接返回，不继续处理
      }
      
      const closes = response.data.map((item: HistoricalDataPoint) => item.close);
      console.log('8. 价格统计:');
      console.log('   - 最低价:', Math.min(...closes));
      console.log('   - 最高价:', Math.max(...closes));
      console.log('   - 最后收盘价:', closes[closes.length - 1]);
      console.log('   - 前5个close:', closes.slice(0, 5));
      console.log('   - 后5个close:', closes.slice(-5));
      
      setHistoricalData(response.data);
      setDataSource(response.dataSource || 'Finnhub');

      // 保存原始历史数据
      setHistoricalData(response.data);
      
      // 调试：记录原始数据信息
      console.log(`[Analyze] ====== 原始数据信息 ======`);
      console.log(`[Analyze] 后端返回条数: ${response.data?.length || 0}`);
      console.log(`[Analyze] 数据源: ${response.dataSource || '未知'}`);
      console.log(`[Analyze] 当前timeframe: ${selectedTimeframe}`);
      
      if (response.data && response.data.length > 0) {
        // 显示前3个和后3个数据点
        console.log(`[Analyze] 前3个数据点:`);
        response.data.slice(0, 3).forEach((item, index) => {
          console.log(`  ${index+1}. time: "${item.time}", timestamp: ${item.timestamp}`);
        });
        
        console.log(`[Analyze] 后3个数据点:`);
        response.data.slice(-3).forEach((item, index) => {
          const pos = response.data.length - 3 + index;
          console.log(`  ${pos+1}. time: "${item.time}", timestamp: ${item.timestamp}`);
        });
        
        // 计算日期范围
        const dates = response.data.map(item => item.time || new Date(item.timestamp * 1000).toISOString().split('T')[0]);
        dates.sort();
        console.log(`[Analyze] 最早日期: ${dates[0]}`);
        console.log(`[Analyze] 最晚日期: ${dates[dates.length - 1]}`);
      } else {
        console.log(`[Analyze] ⚠️ 警告: 后端返回空数据`);
      }
      
      // 转换为图表数据格式 - 修复：优先使用time字段，避免错误的时间戳
      console.log(`[Analyze] ====== 开始数据转换 ======`);
      const formattedData = response.data.map((item: HistoricalDataPoint, index) => {
        let date: Date;
        
        // 优先使用time字段（包含正确的日期字符串）
        if (item.time) {
          try {
            // time字段格式如 "2025-11-07" (日线) 或 "2025-11-07 00:00:00" (分钟线)
            // Twelve Data API返回的是纽约时间（exchange_timezone: America/New_York）
            // 正确转换为ISO格式: 空格替换为T，不添加Z后缀（表示无时区信息）
            let timeStr;
            if (item.time.includes(' ')) {
              // 分钟线格式: "2026-02-17 15:30:00" -> "2026-02-17T15:30:00"
              // 不添加Z后缀，让JavaScript按本地时间解析
              timeStr = item.time.replace(' ', 'T');
            } else {
              // 日线格式: "2026-02-17" -> "2026-02-17T00:00:00"
              timeStr = item.time + 'T00:00:00';
            }
            
            date = new Date(timeStr);
            
            if (!isNaN(date.getTime())) {
              // 成功解析time字段
              console.log(`[Analyze] 转换 ${index+1}: 使用time字段 "${item.time}" -> ${date.toISOString()}`);
              return {
                date: date.toISOString(), // 使用ISO字符串
                open: Number(item.open) || 0,
                high: Number(item.high) || 0,
                low: Number(item.low) || 0,
                close: Number(item.close) || 0,
                volume: Number(item.volume) || 0
              };
            } else {
              console.error(`[Analyze] 警告: 无效日期 "${item.time}" -> "${timeStr}"`);
            }
          } catch (e) {
            console.error('Failed to parse time field:', item.time, e);
          }
        }
        
        // 回退到使用timestamp（但可能有问题）
        const timestampMs = item.timestamp * 1000;
        date = new Date(timestampMs);
        
        if (isNaN(date.getTime())) {
          console.error('Invalid date from timestamp:', item.timestamp, item.time);
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

      // 调试：记录转换后的数据
      console.log(`[Analyze] ====== 数据转换结果 ======`);
      console.log(`[Analyze] 原始数据条数: ${response.data?.length || 0}`);
      console.log(`[Analyze] 转换后图表数据条数: ${formattedData.length}`);
      console.log(`[Analyze] historicalData条数: ${response.data?.length || 0}`);
      
      // 3 Months特殊处理：如果转换后为空，尝试简单转换
      if (selectedTimeframe === '3M' && formattedData.length === 0 && response.data && response.data.length > 0) {
        console.log(`[Analyze] ⚠️ 3 Months数据转换失败，尝试简单转换`);
        
        // 简单转换：只使用close价格，日期使用索引
        const simpleFormattedData = response.data.map((item: HistoricalDataPoint, index) => {
          const date = new Date();
          date.setDate(date.getDate() - (response.data.length - index - 1));
          
          return {
            date: date.toISOString(),
            open: Number(item.open) || 0,
            high: Number(item.high) || 0,
            low: Number(item.low) || 0,
            close: Number(item.close) || 0,
            volume: Number(item.volume) || 0
          } as ChartDataPoint;
        });
        
        console.log(`[Analyze] 简单转换后条数: ${simpleFormattedData.length}`);
        formattedData.push(...simpleFormattedData);
      }
      
      // 1 Week特殊处理：如果转换后为空，尝试简单转换
      if (selectedTimeframe === '1W' && formattedData.length === 0 && response.data && response.data.length > 0) {
        console.log(`[Analyze] ⚠️ 1 Week数据转换失败，尝试简单转换`);
        
        // 简单转换：使用timestamp字段
        const simpleFormattedData = response.data.map((item: HistoricalDataPoint, index) => {
          let date: Date;
          
          // 优先使用timestamp
          if (item.timestamp) {
            date = new Date(item.timestamp * 1000);
          } else {
            // 回退：按索引偏移
            date = new Date();
            date.setDate(date.getDate() - (response.data.length - index - 1));
          }
          
          return {
            date: date.toISOString(),
            open: Number(item.open) || 0,
            high: Number(item.high) || 0,
            low: Number(item.low) || 0,
            close: Number(item.close) || 0,
            volume: Number(item.volume) || 0
          } as ChartDataPoint;
        });
        
        console.log(`[Analyze] 1 Week简单转换后条数: ${simpleFormattedData.length}`);
        formattedData.push(...simpleFormattedData);
      }
      
      if (formattedData.length > 0) {
        console.log(`[Analyze] 转换后前3个数据点:`);
        formattedData.slice(0, 3).forEach((item, index) => {
          console.log(`  ${index+1}. date: ${item.date}, close: ${item.close}`);
        });
        
        console.log(`[Analyze] 转换后后3个数据点:`);
        formattedData.slice(-3).forEach((item, index) => {
          const pos = formattedData.length - 3 + index;
          console.log(`  ${pos+1}. date: ${item.date}, close: ${item.close}`);
        });
      } else {
        console.log(`[Analyze] ⚠️ 警告: 数据转换后为空`);
        
        // 调试转换失败的原因
        if (response.data && response.data.length > 0) {
          console.log(`[Analyze] 调试转换失败:`);
          response.data.slice(0, 3).forEach((item, index) => {
            console.log(`  原始数据 ${index+1}:`, {
              time: item.time,
              timestamp: item.timestamp,
              open: item.open,
              close: item.close
            });
          });
        }
      }

      // 根据timeframe处理数据
      let chartDataToSet = formattedData;
      
      if (selectedTimeframe === '3M') {
        // === 3 Months 专用：调整日期范围，收紧到最近3个月 ===
        console.log(`[3 Months] ====== 开始调整日期范围 ======`);
        console.log(`[3 Months] 1. 原始formattedData条数: ${formattedData.length}`);
        
        if (formattedData.length > 0) {
          // 计算最近3个月的日期（90天前）
          const today = new Date();
          const threeMonthsAgo = new Date(today);
          threeMonthsAgo.setDate(today.getDate() - 90);
          
          console.log(`[3 Months] 2. 今天: ${today.toISOString().split('T')[0]}`);
          console.log(`[3 Months] 3. 3个月前: ${threeMonthsAgo.toISOString().split('T')[0]}`);
          
          // 过滤出最近3个月的数据
          const recentData = formattedData.filter(item => {
            const itemDate = new Date(item.date);
            return itemDate >= threeMonthsAgo;
          });
          
          console.log(`[3 Months] 4. 过滤后数据条数: ${recentData.length}`);
          
          if (recentData.length > 0) {
            // 使用过滤后的数据
            chartDataToSet = recentData;
            
            const firstDate = new Date(chartDataToSet[0].date);
            const lastDate = new Date(chartDataToSet[chartDataToSet.length - 1].date);
            
            console.log(`[3 Months] 5. 调整后数据范围: ${firstDate.toISOString().split('T')[0]} 到 ${lastDate.toISOString().split('T')[0]}`);
            console.log(`[3 Months] 6. 总天数: ${chartDataToSet.length}个交易日`);
            console.log(`[3 Months] 7. 收紧天数: ${formattedData.length - recentData.length}天`);
          } else {
            // 如果没有最近3个月的数据，使用原始数据但显示警告
            console.log(`[3 Months] ⚠️ 警告: 没有最近3个月的数据，使用原始数据`);
            chartDataToSet = formattedData;
          }
        } else {
          console.log(`[3 Months] ⚠️ 警告: formattedData为空，图表将显示"No historical data available"`);
        }
        console.log(`[3 Months] ====== 日期范围调整完成 ======`);
      } else if (selectedTimeframe === '1M') {
        // === 1 Month 专用：调整日期范围，收紧到最近1个月 ===
        console.log(`[1 Month] ====== 开始调整日期范围 ======`);
        console.log(`[1 Month] 1. 原始formattedData条数: ${formattedData.length}`);
        
        if (formattedData.length > 0) {
          // 计算最近1个月的日期（30天前）
          const today = new Date();
          const oneMonthAgo = new Date(today);
          oneMonthAgo.setDate(today.getDate() - 30);
          
          console.log(`[1 Month] 2. 今天: ${today.toISOString().split('T')[0]}`);
          console.log(`[1 Month] 3. 1个月前: ${oneMonthAgo.toISOString().split('T')[0]}`);
          
          // 过滤出最近1个月的数据
          const recentData = formattedData.filter(item => {
            const itemDate = new Date(item.date);
            return itemDate >= oneMonthAgo;
          });
          
          console.log(`[1 Month] 4. 过滤后数据条数: ${recentData.length}`);
          
          if (recentData.length > 0) {
            // 使用过滤后的数据
            chartDataToSet = recentData;
            
            const firstDate = new Date(chartDataToSet[0].date);
            const lastDate = new Date(chartDataToSet[chartDataToSet.length - 1].date);
            
            console.log(`[1 Month] 5. 调整后数据范围: ${firstDate.toISOString().split('T')[0]} 到 ${lastDate.toISOString().split('T')[0]}`);
            console.log(`[1 Month] 6. 总天数: ${chartDataToSet.length}个交易日`);
            console.log(`[1 Month] 7. 收紧天数: ${formattedData.length - recentData.length}天`);
          } else {
            // 如果没有最近1个月的数据，使用原始数据但显示警告
            console.log(`[1 Month] ⚠️ 警告: 没有最近1个月的数据，使用原始数据`);
            chartDataToSet = formattedData;
          }
        } else {
          console.log(`[1 Month] ⚠️ 警告: formattedData为空，图表将显示"No historical data available"`);
        }
        console.log(`[1 Month] ====== 日期范围调整完成 ======`);
      } else if (selectedTimeframe === '1W') {
        // === 1 Week 专用：简化处理，先确保图表显示 ===
        console.log('[1 Week] ====== 简化处理1 Week数据 ======');
        console.log('[1 Week] 后端返回原始数据点数:', formattedData.length);
        
        if (formattedData.length > 0) {
          // 1. 确保数据按时间正序排序（最早在前，最新在后）
          const sortedData = [...formattedData].sort((a, b) => {
            return new Date(a.date).getTime() - new Date(b.date).getTime();
          });
          
          console.log('[1 Week] 数据已按时间正序排序（最早在前，最新在后）');
          
          // 2. 定义目标开始日期：2026年3月13日 00:00:00 UTC
          const targetStartDate = new Date('2026-03-13T00:00:00Z');
          
          // 3. 过滤数据：只保留从3月13日开始的数据
          const filteredData = sortedData.filter(item => {
            const itemDate = new Date(item.date);
            return itemDate >= targetStartDate;
          });
          
          // 4. 如果过滤后数据为空，使用原始数据（避免空白图表）
          if (filteredData.length > 0) {
            chartDataToSet = filteredData;
            console.log('[1 Week] 使用过滤后的数据（从3月13日开始）');
          } else {
            chartDataToSet = sortedData;
            console.log('[1 Week] ⚠️ 没有3月13日之后的数据，使用所有数据');
          }
          
          console.log('[1 Week] 最终数据点数:', chartDataToSet.length);
          
          if (chartDataToSet.length > 0) {
            const firstDate = new Date(chartDataToSet[0].date);
            const lastDate = new Date(chartDataToSet[chartDataToSet.length - 1].date);
            
            // 使用纽约时间显示
            const nyFormatter = new Intl.DateTimeFormat('en-US', {
              timeZone: 'America/New_York',
              month: 'numeric',
              day: 'numeric',
              hour: 'numeric',
              minute: 'numeric',
              hour12: false
            });
            
            const firstDateNY = nyFormatter.format(firstDate);
            const lastDateNY = nyFormatter.format(lastDate);
            
            console.log('[1 Week] 数据范围（纽约时间）:', 
              `${firstDateNY} - ${lastDateNY}`
            );
            
            // 检查是否包含3月13日
            const hasMarch13 = chartDataToSet.some(item => {
              const d = new Date(item.date);
              const nyDate = nyFormatter.format(d);
              return nyDate.includes('3/13');
            });
            
            console.log('[1 Week] 是否包含3月13日数据:', hasMarch13);
            
            // 验证数据顺序
            console.log('[1 Week] 验证数据顺序:');
            console.log('  第一个点（应该是最早）:', firstDateNY);
            console.log('  最后一个点（应该是最新）:', lastDateNY);
            
            // 检查时间戳顺序
            const timestamps = chartDataToSet.map(item => new Date(item.date).getTime());
            const isAscending = timestamps.every((timestamp, i, arr) => 
              i === 0 || timestamp >= arr[i - 1]
            );
            console.log('[1 Week] 数据是否正序（升序）:', isAscending);
          }
        } else {
          // 如果formattedData为空，使用原始数据简单转换
          console.log('[1 Week] ⚠️ formattedData为空，使用原始数据');
          chartDataToSet = formattedData; // 可能为空，但至少不会报错
        }
        

      }

      // 设置图表数据
      console.log(`Formatted chart data:`, chartDataToSet.length, 'points');
      
      // 调试日志：图表最终数据
      console.log('=== 图表最终数据 ===');
      console.log('1. chartData.length:', chartDataToSet.length);
      if (chartDataToSet.length > 0) {
        console.log('2. 第一条数据:', {
          date: chartDataToSet[0].date,
          open: chartDataToSet[0].open,
          close: chartDataToSet[0].close,
          volume: chartDataToSet[0].volume
        });
        console.log('3. 最后一条数据:', {
          date: chartDataToSet[chartDataToSet.length - 1].date,
          open: chartDataToSet[chartDataToSet.length - 1].open,
          close: chartDataToSet[chartDataToSet.length - 1].close,
          volume: chartDataToSet[chartDataToSet.length - 1].volume
        });
        console.log('4. 数据时间范围:', {
          firstDate: chartDataToSet[0].date,
          lastDate: chartDataToSet[chartDataToSet.length - 1].date,
          totalBars: chartDataToSet.length
        });
      }

      // 计算技术指标 - 使用所有有效的close值
      const closePrices = chartDataToSet.map(d => d.close);
      
      // 计算移动平均线（基于close价格）
      const sma20 = calculateSMA(closePrices, 20);
      const sma50 = calculateSMA(closePrices, 50);
      const ema12 = calculateEMA(closePrices, 12);
      const ema26 = calculateEMA(closePrices, 26);
      const rsi = calculateRSI(closePrices, 14);

      // 添加技术指标到图表数据
      const chartDataWithIndicators = chartDataToSet.map((item, index) => ({
        ...item,
        sma20: !isNaN(sma20[index]) ? sma20[index] : undefined,
        sma50: !isNaN(sma50[index]) ? sma50[index] : undefined,
        ema12: !isNaN(ema12[index]) ? ema12[index] : undefined,
        ema26: !isNaN(ema26[index]) ? ema26[index] : undefined,
        rsi: !isNaN(rsi[index]) ? rsi[index] : undefined
      }));

      // === 最终传给图表的数据 ===
      console.log('=== 最终传给图表的数据 ===');
      console.log('1. chartData长度:', chartDataWithIndicators.length);
      if (chartDataWithIndicators.length > 0) {
        const chartCloses = chartDataWithIndicators.map(d => d.close);
        console.log('2. 图表价格统计:');
        console.log('   - 最低价:', Math.min(...chartCloses));
        console.log('   - 最高价:', Math.max(...chartCloses));
        console.log('   - 最后收盘价:', chartCloses[chartCloses.length - 1]);
        console.log('3. 前5个数据点:');
        console.log(chartDataWithIndicators.slice(0, 5).map(d => ({
          date: d.date,
          close: d.close,
          sma20: d.sma20,
          sma50: d.sma50
        })));
        console.log('4. 后5个数据点:');
        console.log(chartDataWithIndicators.slice(-5).map(d => ({
          date: d.date,
          close: d.close,
          sma20: d.sma20,
          sma50: d.sma50
        })));
      }
      
      console.log(`[Analyze] 设置chartData: ${chartDataWithIndicators.length}条数据`);
      if (chartDataWithIndicators.length === 0) {
        console.log(`[Analyze] ⚠️ 警告: chartDataWithIndicators为空，图表将显示"No historical data available"`);
      }
      
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
    
    // === 1 Year 专用：分析月份节点 ===
    // === 1 Year 专用：分析月份节点 ===
    const analyzeYearlyMonths = (): {
      monthPoints: Array<{ date: string; month: number; monthNumber: number; day: number }>;
      monthLabels: Record<string, string>;
    } => {
      if (selectedTimeframe !== '1Y' || chartData.length === 0) {
        return { monthPoints: [], monthLabels: {} };
      }
      
      const monthPoints: Array<{
        date: string;
        month: number;
        monthNumber: number;
        day: number;
      }> = [];
      const monthLabels: Record<string, string> = {};
      let currentMonth = -1;
      
      // 找出每个月的第一个数据点
      for (let i = 0; i < chartData.length; i++) {
        const dataPoint = chartData[i];
        try {
          const date = new Date(dataPoint.date);
          const month = date.getUTCMonth(); // 0-11 (UTC)
          const day = date.getUTCDate(); // 1-31 (UTC)
          
          // 如果是新的月份，记录这个点
          if (month !== currentMonth) {
            monthPoints.push({
              date: dataPoint.date,
              month: month,
              monthNumber: month + 1, // 1-12
              day: day
            });
            
            // 记录月份标签（基于日期字符串）
            // 第一个月份点显示真实日期（M/D），其他月份点显示M/1
            if (monthPoints.length === 1) {
              // 第一个点：显示真实日期
              monthLabels[dataPoint.date] = `${month + 1}/${day}`;
            } else {
              // 其他月份点：显示M/1格式
              monthLabels[dataPoint.date] = `${month + 1}/1`;
            }
            currentMonth = month;
          }
        } catch (e) {
          console.error('Error analyzing month point:', e);
        }
      }
      
      // 确保至少有首尾两个点
      if (monthPoints.length === 0 && chartData.length > 0) {
        const firstDate = new Date(chartData[0].date);
        const lastDate = new Date(chartData[chartData.length - 1].date);
        
        monthPoints.push({
          date: chartData[0].date,
          month: firstDate.getUTCMonth(),  // 改为UTC
          monthNumber: firstDate.getUTCMonth() + 1,  // 改为UTC
          day: firstDate.getUTCDate()  // 改为UTC
        });
        
        monthPoints.push({
          date: chartData[chartData.length - 1].date,
          month: lastDate.getUTCMonth(),  // 改为UTC
          monthNumber: lastDate.getUTCMonth() + 1,  // 改为UTC
          day: lastDate.getUTCDate()  // 改为UTC
        });
        
        // 第一个点显示真实日期（M/D格式），不是M/1
        monthLabels[chartData[0].date] = `${firstDate.getUTCMonth() + 1}/${firstDate.getUTCDate()}`;
        // 最后一个点也显示真实日期
        monthLabels[chartData[chartData.length - 1].date] = `${lastDate.getUTCMonth() + 1}/${lastDate.getUTCDate()}`;
      }
      
      return { monthPoints, monthLabels };
    };
    
    const { monthPoints, monthLabels } = analyzeYearlyMonths();
    
    // === 1 Year 专用：X轴格式化 ===
    const formatYearlyXAxisTick = (value: string, index: number) => {
      if (selectedTimeframe !== '1Y') return '';
      
      // 使用预先计算的月份标签（基于日期字符串）
      if (monthLabels[value] !== undefined) {
        return monthLabels[value];
      }
      
      return '';
    };
    
    // === 3 Months 专用：生成每14天一个的ticks数组 ===
    const get3MonthsTicks = (chartData: ChartDataPoint[]): string[] => {
      if (selectedTimeframe !== '3M' || !chartData || chartData.length === 0) {
        return [];
      }
      
      const ticks: string[] = [];
      
      try {
        // 获取数据范围
        const firstDate = new Date(chartData[0].date);
        const lastDate = new Date(chartData[chartData.length - 1].date);
        const totalDays = Math.round((lastDate.getTime() - firstDate.getTime()) / (24 * 60 * 60 * 1000));
        
        console.log(`[3 Months] 数据范围: ${firstDate.toISOString().split('T')[0]} 到 ${lastDate.toISOString().split('T')[0]}`);
        console.log(`[3 Months] 总天数: ${totalDays}天, 数据点数: ${chartData.length}`);
        
        // 规则1: 第一个点总是显示标签
        ticks.push(chartData[0].date);
        console.log(`[3 Months] 添加第一个点: ${firstDate.toISOString().split('T')[0]}`);
        
        // 根据总天数动态决定标签间隔
        let intervalDays;
        if (totalDays <= 60) {
          intervalDays = 10; // 小于60天，每10天一个标签
        } else if (totalDays <= 90) {
          intervalDays = 15; // 60-90天，每15天一个标签
        } else {
          intervalDays = 20; // 超过90天，每20天一个标签
        }
        
        console.log(`[3 Months] 使用标签间隔: ${intervalDays}天`);
        
        // 计算预期的间隔日期
        const expectedDayDiffs = [];
        for (let day = intervalDays; day < totalDays; day += intervalDays) {
          expectedDayDiffs.push(day);
        }
        
        console.log(`[3 Months] 预期的间隔日期: ${expectedDayDiffs.join(', ')}天`);
        
        // 为每个预期的间隔找到最接近的交易日
        for (const expectedDayDiff of expectedDayDiffs) {
          // 计算目标日期
          const targetDate = new Date(firstDate.getTime() + expectedDayDiff * 24 * 60 * 60 * 1000);
          const targetDateStr = targetDate.toISOString().split('T')[0];
          
          // 在chartData中查找最接近的日期
          let closestDate = null;
          let closestDiff = Infinity;
          
          for (let i = 0; i < chartData.length; i++) {
            const currentDate = new Date(chartData[i].date);
            const diff = Math.abs(currentDate.getTime() - targetDate.getTime());
            
            if (diff < closestDiff) {
              closestDiff = diff;
              closestDate = chartData[i].date;
            }
          }
          
          // 如果找到接近的日期（在5天内），并且还没有添加过
          if (closestDate && closestDiff <= 5 * 24 * 60 * 60 * 1000 && !ticks.includes(closestDate)) {
            ticks.push(closestDate);
            const d = new Date(closestDate);
            console.log(`[3 Months] 添加第${expectedDayDiff}天附近点: ${d.toISOString().split('T')[0]} (目标: ${targetDateStr})`);
          }
        }
        
        // 规则3: 最后一个点也显示标签（如果还没显示过）
        const lastDateStr = chartData[chartData.length - 1].date;
        if (!ticks.includes(lastDateStr)) {
          ticks.push(lastDateStr);
          console.log(`[3 Months] 添加最后一个点: ${lastDate.toISOString().split('T')[0]}`);
        }
        
        // 确保ticks按日期排序
        ticks.sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
        
        // 如果标签太少，添加中间点
        if (ticks.length < 4 && chartData.length > 10) {
          const middleIndex = Math.floor(chartData.length / 2);
          const middleDate = chartData[middleIndex].date;
          if (!ticks.includes(middleDate)) {
            ticks.push(middleDate);
            const d = new Date(middleDate);
            console.log(`[3 Months] 添加中间点: ${d.toISOString().split('T')[0]}`);
            ticks.sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
          }
        }
        
        // 移除可能的重复项
        const uniqueTicks = Array.from(new Set(ticks));
        
        console.log(`[3 Months] 生成 ${uniqueTicks.length} 个ticks:`, uniqueTicks.map(t => {
          const d = new Date(t);
          return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
        }));
        
        return uniqueTicks;
      } catch (e) {
        console.error('Error generating 3 Months ticks:', e);
        return [];
      }
    };
    
    // === 3 Months 专用：X轴格式化（显示月/日格式） ===
    const format3MonthsXAxisTick = (value: string) => {
      if (selectedTimeframe !== '3M') return '';
      
      try {
        const date = new Date(value);
        const month = date.getUTCMonth() + 1;
        const day = date.getUTCDate();
        
        // 使用两位数字格式，确保所有标签长度一致
        // 例如: 03/20 而不是 3/20，01/05 而不是 1/5
        const monthStr = month.toString().padStart(2, '0');
        const dayStr = day.toString().padStart(2, '0');
        const formatted = `${monthStr}/${dayStr}`;
        
        // 简洁调试：只记录格式化结果
        console.log(`[3 Months X轴标签] ${value} -> ${formatted}`);
        
        return formatted;  // 格式: 月/日 (两位数字)
      } catch (e) {
        console.error('Error formatting 3 Months date:', e, value);
        return '';
      }
    };
    
    // === 1 Month 专用：生成ticks数组（首点 + 每7天 + 尾点） ===
    const get1MonthTicks = (chartData: ChartDataPoint[]): string[] => {
      if (selectedTimeframe !== '1M' || !chartData || chartData.length === 0) {
        return [];
      }
      
      const ticks: string[] = [];
      
      try {
        // 获取第一个数据点的日期
        const firstDate = new Date(chartData[0].date);
        const firstDateStr = chartData[0].date;
        
        // 规则1: 第一个点总是显示标签
        ticks.push(firstDateStr);
        console.log(`[1 Month] 添加第一个点: ${firstDateStr}`);
        
        // 计算总天数跨度
        const lastDate = new Date(chartData[chartData.length - 1].date);
        const totalTimeDiff = lastDate.getTime() - firstDate.getTime();
        const totalDayDiff = Math.floor(totalTimeDiff / (1000 * 60 * 60 * 24));
        
        console.log(`[1 Month] 总天数跨度: ${totalDayDiff}天`);
        console.log(`[1 Month] 数据条数: ${chartData.length}个交易日`);
        
        // 动态决定标签间隔 - 调整为更密的标签
        let intervalDays;
        if (chartData.length <= 10) {
          intervalDays = 2; // 少于10个交易日，每2天一个标签
        } else if (chartData.length <= 20) {
          intervalDays = 3; // 10-20个交易日，每3天一个标签
        } else if (chartData.length <= 30) {
          intervalDays = 4; // 20-30个交易日，每4天一个标签
        } else {
          intervalDays = 5; // 多于30个交易日，每5天一个标签
        }
        
        console.log(`[1 Month] 使用标签间隔: 每${intervalDays}天一个标签（调整为更密标签）`);
        
        // 找出每intervalDays天的点
        for (let i = 1; i < chartData.length; i++) {
          const currentDate = new Date(chartData[i].date);
          const timeDiff = currentDate.getTime() - firstDate.getTime();
          const dayDiff = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
          
          // 规则2: 每intervalDays天显示一个标签
          if (dayDiff % intervalDays === 0 && dayDiff > 0) {
            if (!ticks.includes(chartData[i].date)) {
              ticks.push(chartData[i].date);
              console.log(`[1 Month] 添加第${dayDiff}天点: ${chartData[i].date}`);
            }
          }
        }
        
        // 规则3: 最后一个点也显示标签（如果还没显示过）
        const lastDateStr = chartData[chartData.length - 1].date;
        if (!ticks.includes(lastDateStr)) {
          ticks.push(lastDateStr);
          console.log(`[1 Month] 添加最后一个点: ${lastDateStr}`);
        }
        
        // 如果标签太少（少于3个），添加中间点
        if (ticks.length < 3 && chartData.length > 5) {
          const middleIndex = Math.floor(chartData.length / 2);
          const middleDate = chartData[middleIndex].date;
          if (!ticks.includes(middleDate)) {
            ticks.push(middleDate);
            const d = new Date(middleDate);
            console.log(`[1 Month] 添加中间点: ${d.toISOString().split('T')[0]}`);
          }
        }
        
        // 确保ticks按日期排序
        ticks.sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
        
        // 移除可能的重复项
        const uniqueTicks = Array.from(new Set(ticks));
        
        console.log(`[1 Month] 生成 ${uniqueTicks.length} 个ticks:`, uniqueTicks.map(t => {
          const d = new Date(t);
          return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
        }));
        
        return uniqueTicks;
      } catch (e) {
        console.error('Error generating 1 Month ticks:', e);
        return [];
      }
    };
    
    // === 1 Month 专用：X轴格式化（显示月/日格式） ===
    const format1MonthXAxisTick = (value: string) => {
      if (selectedTimeframe !== '1M') return '';
      
      try {
        const date = new Date(value);
        const month = date.getUTCMonth() + 1;
        const day = date.getUTCDate();
        
        // 使用月/日格式（例如：2/23）
        // 注意：月份和日期不需要补零，保持自然格式
        const formatted = `${month}/${day}`;
        
        // 简洁调试
        console.log(`[1 Month X轴标签] ${value} -> ${formatted}`);
        
        return formatted;  // 格式: 月/日
      } catch (e) {
        console.error('Error formatting 1 Month date:', e, value);
        return '';
      }
    };
    
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
          // 1 Day: 显示具体时间 (HH:MM)
          // 30分钟粒度，显示每个数据点的时间
          // 使用UTC方法避免时区问题
          const hour = date.getUTCHours();     // 改为UTC
          const minute = date.getUTCMinutes(); // 改为UTC
          
          // 显示格式: 09:30, 10:00, 10:30, 11:00, ...
          return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
        } else if (selectedTimeframe === '1W') {
          // === 1 WEEK X-AXIS：显示月/日 时:分，重点显示9:30和12:30 ===
          // 使用纽约时间显示，移除逗号
          
          // 使用Intl.DateTimeFormat获取各个部分，然后重新组合移除逗号
          const nyFormatter = new Intl.DateTimeFormat('en-US', {
            timeZone: 'America/New_York',
            month: 'numeric',
            day: 'numeric',
            hour: 'numeric',
            minute: 'numeric',
            hour12: false
          });
          
          // 获取格式化部分
          const parts = nyFormatter.formatToParts(date);
          
          // 提取需要的部分
          const month = parts.find(p => p.type === 'month')?.value || '';
          const day = parts.find(p => p.type === 'day')?.value || '';
          const hour = parts.find(p => p.type === 'hour')?.value || '';
          const minute = parts.find(p => p.type === 'minute')?.value || '';
          
          // 组合成无逗号格式：月/日 时:分
          const formatted = `${month}/${day} ${hour}:${minute}`;
          console.log(`[1 Week X轴标签] ${value} -> 无逗号格式: ${formatted}`);
          
          return formatted;
        } else {
          // 其他timeframe: 显示日期 (MM/DD)
          // 根据数据点密度决定显示哪些标签
          
          if (selectedTimeframe === '1Y') {
            // 1 Year: 使用专门的分析函数（已修复为UTC）
            return formatYearlyXAxisTick(value, index);
          }
          
          // 对于其他timeframe，使用UTC方法避免时区问题
          const month = date.getUTCMonth() + 1;  // 改为UTC
          const day = date.getUTCDate();         // 改为UTC
          const dateStr = `${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}`;
          
          if (selectedTimeframe === '1M') {
            // 1 Month: 使用专门的格式化函数（每7天显示一个标签）
            return format1MonthXAxisTick(value);
          } else if (selectedTimeframe === '3M') {
            // 3 Months: 使用专门的格式化函数
            return format3MonthsXAxisTick(value);
          } else {
            // 其他未处理的timeframe（不应该出现）
            return `${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}`;
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
      const isWeekly = selectedTimeframe === '1W';
      
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
            {isDaily || isWeekly
              ? formatAsNewYorkTime(date, true) // 移除(NY)标记
              : selectedTimeframe === '1Y' || selectedTimeframe === '3M' || selectedTimeframe === '1M'
                ? `${date.getUTCFullYear()}/${date.getUTCMonth() + 1}/${date.getUTCDate()}`
                : `${date.getUTCMonth() + 1}/${date.getUTCDate()}`
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

    // 调试：验证1 Week的数据和ticks
    if (selectedTimeframe === '1W' && chartData.length > 0) {
      console.log('[1 Week 页面调试] ======');
      console.log('[1 Week 页面调试] chartData点数:', chartData.length);
      console.log('[1 Week 页面调试] 第一个点:', {
        date: chartData[0].date,
        time: new Date(chartData[0].date).toISOString(),
        close: chartData[0].close
      });
      console.log('[1 Week 页面调试] 最后一个点:', {
        date: chartData[chartData.length - 1].date,
        time: new Date(chartData[chartData.length - 1].date).toISOString(),
        close: chartData[chartData.length - 1].close
      });
      
      // 生成并验证ticks
      const weekTicks = get1WeekTicks(chartData, getNewYorkTimeComponents);
      console.log('[1 Week 页面调试] get1WeekTicks返回ticks数量:', weekTicks.length);
      console.log('[1 Week 页面调试] ticks列表:');
      for (let i = 0; i < weekTicks.length; i++) {
        const date = new Date(weekTicks[i]);
        console.log(`  ${i+1}. ${date.getUTCMonth() + 1}/${date.getUTCDate()} ${date.getUTCHours()}:${date.getUTCMinutes().toString().padStart(2, '0')}`);
      }
      
      // 调试：检查chartData中的时间点（使用纽约时间）
      debug1WeekData(chartData);
    }

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

          {/* X轴 - 根据timeframe格式化，改进显示 */}
          <XAxis
            dataKey="date"
            tick={{
              fontSize: selectedTimeframe === '1W' ? 12 : 11, // 1 Week字体调整为12（3小时间隔版）
              fill: '#333'
            }}
            axisLine={{ stroke: '#bfbfbf' }}
            tickLine={selectedTimeframe === '1Y' ? 
              { 
                stroke: '#d9d9d9', // 很轻的灰色
                strokeWidth: 0.5    // 更细的线
              } : 
              { stroke: '#bfbfbf' }
            } // 1 Year显示很轻的竖线
            height={selectedTimeframe === '1W' ? 60 : 40} // 1 Week增加高度，确保显示所有标签
            tickFormatter={formatXAxisTick}
            // 强制显示所有传入的ticks
            interval={0} // 总是显示所有ticks，不自动省略
            // 传入明确的ticks数组
            ticks={
              selectedTimeframe === '1W' ? get1WeekKeyTimeTicks(chartData) :
              selectedTimeframe === '1M' ? get1MonthTicks(chartData) :
              selectedTimeframe === '3M' ? get3MonthsTicks(chartData) :
              selectedTimeframe === '1Y' ? monthPoints.map(p => p.date) :
              undefined
            }
            minTickGap={selectedTimeframe === '1W' ? 20 : selectedTimeframe === '1M' ? 10 : 0} // 1 Week增加最小间隙，避免标签重叠；1 Month稍微增加间隙
            tickMargin={selectedTimeframe === '1W' ? 10 : selectedTimeframe === '1M' ? 8 : 5} // 1 Week增加标签边距；1 Month稍微增加边距
            // 为1 Week增加更多padding，避免标签被裁切
            padding={
              selectedTimeframe === '1W' ? { left: 20, right: 35 } : // 增加右边padding，让最右边标签有更多空间
              selectedTimeframe === '1M' ? { left: 0, right: 30 } :
              selectedTimeframe === '3M' ? { left: 0, right: 30 } :
              undefined
            }
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
          
          {/* === 1 Year 专用：月度分隔竖线 === */}
          {selectedTimeframe === '1Y' && monthPoints.length > 0 && monthPoints.map((point, i) => {
            // 跳过第一个点（已经在最左边）
            if (i === 0) return null;
            
            return (
              <ReferenceLine
                key={`month-line-${i}`}
                x={point.date}
                stroke="#e8e8e8"
                strokeWidth={1}
                strokeDasharray="3 3"
              />
            );
          })}
          
          {/* 当前价格标记（最后一个点） */}
          {chartData.length > 0 && selectedTimeframe !== '1W' && (
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
      console.log(`[SymbolAnalysis] timeframe切换: ${selectedTimeframe}, 重新加载数据`);
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
    
    // 注意：后端返回的marketCap已经是实际美元值，不需要再乘以1000000
    // 之前的注释有误：Finnhub API返回的是实际美元值，不是百万为单位
    const actualValue = num; // 直接使用原始值
    
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
                {chartData.length > 0 && chartData.length >= 2 && (() => {
                  const firstClose = chartData[0].close;
                  const lastClose = chartData[chartData.length - 1].close;
                  const currentPrice = lastClose; // 始终使用图表最后一个点的价格
                  
                  if (firstClose > 0 && lastClose > 0) {
                    const change = lastClose - firstClose;
                    const changePercent = (change / firstClose) * 100;
                    const isPositive = change >= 0;
                    
                    return (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '20px', // 增加间距以容纳标签
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
                
                {/* 1 Week数据源提示 */}
                {selectedTimeframe === '1W' && (
                  <div style={{
                    fontSize: '10px',
                    color: '#8c8c8c',
                    backgroundColor: 'rgba(24, 144, 255, 0.08)',
                    padding: '2px 6px',
                    borderRadius: '3px',
                    border: '1px solid rgba(24, 144, 255, 0.2)',
                    marginLeft: '8px',
                    fontFamily: "'SF Mono', Monaco, 'Courier New', monospace"
                  }}>
                    <span style={{ color: '#1890ff' }}>ⓘ</span> 含今日实验数据
                  </div>
                )}
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