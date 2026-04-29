import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Button, Tabs, Table, Tag, Space, Spin, Empty, Alert, message, Radio } from 'antd';
import { LineChartOutlined, BarChartOutlined, PlayCircleOutlined, ReloadOutlined, ArrowUpOutlined, ArrowDownOutlined, ArrowLeftOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area, BarChart, Bar, ComposedChart, ReferenceLine, ReferenceDot, ReferenceArea } from 'recharts';
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

// ========== 专业X轴标签生成函数（新方案） ==========

// 1. 1 Day: 生成30分钟间隔的时间标签 (09:30 - 16:00)
const getProfessional1DayTicks = (chartData: ChartDataPoint[]): string[] => {
  if (!chartData || chartData.length === 0) {
    return [];
  }
  
  console.log('[专业X轴] 1 Day: 生成时间标签 (04:00-15:30)');
  
  const ticks: string[] = [];
  const firstDate = new Date(chartData[0].date);
  const year = firstDate.getUTCFullYear();
  const month = firstDate.getUTCMonth();
  const day = firstDate.getUTCDate();
  
  // 定义时间点 (04:00 - 15:30)，包含盘前时间，删除16:00
  // 稀疏显示以避免标签重叠：04:00, 06:00, 08:00, 09:00, 09:30, 然后每小时一次
  const timePoints = [
    '04:00', '06:00', '08:00', '09:00', '09:30', // 盘前和开盘时间
    '10:30', '11:30', '12:30', '13:30', '14:30', '15:30' // 交易时间
  ];
  
  // 生成所有时间点的UTC时间
  timePoints.forEach(timeStr => {
    const [hour, minute] = timeStr.split(':').map(Number);
    // 纽约时间(EDT)转UTC时间: EDT = UTC-4, 所以UTC = EDT+4
    const utcHour = (hour + 4) % 24;
    const utcDate = new Date(Date.UTC(year, month, day, utcHour, minute, 0));
    ticks.push(utcDate.toISOString());
  });
  
  console.log(`[专业X轴] 1 Day: 生成${ticks.length}个时间标签`);
  console.log(`[专业X轴] 1 Day: 时间标签列表: ${timePoints.join(', ')}`);
  return ticks;
};

// 1 Day: 自适应整点X轴标签生成函数
const getAdaptive1DayTicks = (chartData: ChartDataPoint[]): string[] => {
  if (!chartData || chartData.length === 0) {
    return [];
  }
  
  console.log('[1D X轴] 基于数据点动态生成整点小时标签');
  
  const ticks: string[] = [];
  
  // 1. 获取数据点的实际时间范围
  const firstDate = new Date(chartData[0].date);
  const lastDate = new Date(chartData[chartData.length - 1].date);
  
  // 转换为美东时间（EDT）
  const firstDateEDT = new Date(firstDate.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const lastDateEDT = new Date(lastDate.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  
  const startHour = firstDateEDT.getHours();
  const startMinute = firstDateEDT.getMinutes();
  const endHour = lastDateEDT.getHours();
  const endMinute = lastDateEDT.getMinutes();
  
  console.log(`[1D X轴] 数据时间范围: ${startHour}:${String(startMinute).padStart(2, '0')} - ${endHour}:${String(endMinute).padStart(2, '0')} EDT`);
  
  // 2. 确定标签范围：从开始时间的整点小时到结束时间的整点小时
  const startHourRounded = Math.floor(startHour);
  const endHourRounded = Math.ceil(endHour);
  
  // 确保在04:00-20:00的交易时间范围内
  const minHour = 4;  // 04:00 EDT
  const maxHour = 20; // 20:00 EDT
  
  const actualStartHour = Math.max(startHourRounded, minHour);
  const actualEndHour = Math.min(endHourRounded, maxHour);
  
  console.log(`[1D X轴] 标签范围: ${actualStartHour}:00 - ${actualEndHour}:00 EDT`);
  
  // 3. 生成整点小时标签
  for (let hour = actualStartHour; hour <= actualEndHour; hour++) {
    // 美东时间(EDT)转UTC时间: EDT = UTC-4, 所以UTC = EDT+4
    const utcHour = (hour + 4) % 24;
    
    // 使用第一个数据点的日期（年、月、日）
    const year = firstDate.getUTCFullYear();
    const month = firstDate.getUTCMonth();
    const day = firstDate.getUTCDate();
    
    const utcDate = new Date(Date.UTC(year, month, day, utcHour, 0, 0));
    ticks.push(utcDate.toISOString());
  }
  
  console.log(`[1D X轴] 生成${ticks.length}个动态整点小时标签: ${Array.from({length: actualEndHour - actualStartHour + 1}, (_, i) => `${actualStartHour + i}:00`).join(', ')}`);
  
  return ticks;
};

// 2. 1 Week: 生成清晰跨天日期标签 - 显示月/日格式
const getProfessional1WeekTicks = (chartData: ChartDataPoint[]): string[] => {
  if (!chartData || chartData.length === 0) {
    return [];
  }
  
  console.log('[1 Week X轴] ====== 生成清晰跨天日期标签 (月/日格式) ======');
  console.log('[1 Week X轴] 输入数据点数量:', chartData.length);
  
  const ticks: string[] = [];
  const seenDays = new Set<string>();
  
  // 1. 按时间排序数据（确保从左到右是旧到新）
  const sortedData = [...chartData].sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  
  // 2. 遍历数据，找到每个交易日的第一个数据点作为日期标签
  sortedData.forEach((point) => {
    const date = new Date(point.date);
    
    // 创建日期键 (YYYY-MM-DD格式)
    const dateKey = date.toISOString().split('T')[0];
    
    // 每个交易日只添加一次日期标签
    if (!seenDays.has(dateKey)) {
      // 使用该交易日的第一个数据点作为标签
      ticks.push(point.date);
      seenDays.add(dateKey);
      
      // 转换为纽约时间显示
      const nyHour = (date.getUTCHours() - 4 + 24) % 24;
      const minute = date.getUTCMinutes();
      const month = date.getUTCMonth() + 1;
      const day = date.getUTCDate();
      
      console.log(`[1 Week X轴] 添加交易日标签: ${month}/${day} (数据点时间: ${nyHour}:${String(minute).padStart(2, '0')})`);
    }
  });
  
  // 3. 如果没有找到足够的点，使用数据中的时间点
  if (ticks.length < 3) {
    console.log(`[1 Week X轴] 标签不足(${ticks.length}个)，使用数据点作为标签`);
    
    // 取开始、中间、结束三个点
    const startIdx = 0;
    const midIdx = Math.floor(sortedData.length / 2);
    const endIdx = sortedData.length - 1;
    
    ticks.length = 0; // 清空数组
    if (startIdx >= 0) ticks.push(sortedData[startIdx].date);
    if (midIdx > startIdx && midIdx < endIdx) ticks.push(sortedData[midIdx].date);
    if (endIdx > startIdx) ticks.push(sortedData[endIdx].date);
  }
  
  // 4. 确保ticks按时间排序（从左到右：旧 -> 新）
  ticks.sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
  
  console.log(`[1 Week X轴] 生成${ticks.length}个日期标签`);
  console.log('[1 Week X轴] 交易日数量:', seenDays.size);
  
  return ticks;
};

// 3. 1 Month: 不再使用自定义ticks，让Recharts自动处理标签显示

// 4. 3 Months: 生成半月节奏日期标签 - 智能选择最接近的1号和15号日期节点
const getProfessional3MonthsTicks = (chartData: ChartDataPoint[]): string[] => {
  if (!chartData || chartData.length === 0) {
    return [];
  }
  
  console.log('[3 Months X轴] ====== 生成半月节奏日期标签 (智能选择最接近的1号和15号) ======');
  console.log('[3 Months X轴] 输入数据点数量:', chartData.length);
  
  // 1. 按时间排序数据（确保从左到右是旧到新）
  const sortedData = [...chartData].sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  
  // 2. 提取所有唯一的日期
  const uniqueDates: {date: Date, dateKey: string, dataPoint: ChartDataPoint}[] = [];
  const seenDays = new Set<string>();
  
  sortedData.forEach((point) => {
    const date = new Date(point.date);
    const dateKey = date.toISOString().split('T')[0];
    
    if (!seenDays.has(dateKey)) {
      uniqueDates.push({
        date,
        dateKey,
        dataPoint: point
      });
      seenDays.add(dateKey);
    }
  });
  
  console.log(`[3 Months X轴] 唯一交易日数量: ${uniqueDates.length}`);
  
  // 3. 智能选择半月节奏日期标签（每月1号和15号，或最接近的日期）
  const ticks: string[] = [];
  const targetDays = [1, 15]; // 目标日期：每月1号和15号
  
  // 获取数据的时间范围
  if (uniqueDates.length > 0) {
    const firstDate = uniqueDates[0].date;
    const lastDate = uniqueDates[uniqueDates.length - 1].date;
    
    const startYear = firstDate.getUTCFullYear();
    const startMonth = firstDate.getUTCMonth();
    const endYear = lastDate.getUTCFullYear();
    const endMonth = lastDate.getUTCMonth();
    
    console.log(`[3 Months X轴] 数据时间范围: ${startYear}/${startMonth + 1} 到 ${endYear}/${endMonth + 1}`);
    
    // 生成目标日期列表（每月1号和15号）
    const targetDateKeys: string[] = [];
    
    let currentYear = startYear;
    let currentMonth = startMonth;
    
    // 生成3个月范围内的所有目标日期
    while (currentYear < endYear || (currentYear === endYear && currentMonth <= endMonth)) {
      for (const day of targetDays) {
        // 创建目标日期
        const targetDate = new Date(Date.UTC(currentYear, currentMonth, day));
        const targetDateKey = targetDate.toISOString().split('T')[0];
        targetDateKeys.push(targetDateKey);
        
        // 如果目标日期在数据时间范围内，尝试找到最接近的交易日
        if (targetDate >= firstDate && targetDate <= lastDate) {
          // 查找最接近目标日期的交易日
          let closestDate = uniqueDates[0];
          let minDiff = Math.abs(targetDate.getTime() - closestDate.date.getTime());
          
          for (const item of uniqueDates) {
            const diff = Math.abs(targetDate.getTime() - item.date.getTime());
            if (diff < minDiff) {
              minDiff = diff;
              closestDate = item;
            }
          }
          
          // 如果最接近的日期在3天范围内，使用它
          if (minDiff <= 3 * 24 * 60 * 60 * 1000) { // 3天内
            const dateKey = closestDate.dateKey;
            if (!ticks.includes(closestDate.dataPoint.date)) {
              ticks.push(closestDate.dataPoint.date);
              console.log(`[3 Months X轴] 添加半月节奏日期: ${dateKey} (目标: ${targetDateKey})`);
            }
          }
        }
      }
      
      // 移动到下一个月
      currentMonth++;
      if (currentMonth > 11) {
        currentMonth = 0;
        currentYear++;
      }
      
      // 限制最多生成6个月的目标日期（3个月数据 + 缓冲）
      const totalMonths = (currentYear - startYear) * 12 + (currentMonth - startMonth);
      if (totalMonths > 6) break;
    }
  }
  
  // 4. 如果没有找到足够的半月节奏日期，使用智能选择的关键日期
  if (ticks.length < 4) {
    console.log(`[3 Months X轴] 半月节奏日期不足(${ticks.length}个)，使用智能选择的关键日期`);
    
    const totalDays = uniqueDates.length;
    
    // 总是包含第一个日期
    if (!ticks.includes(uniqueDates[0].dataPoint.date)) {
      ticks.push(uniqueDates[0].dataPoint.date);
      console.log(`[3 Months X轴] 添加第一个日期: ${uniqueDates[0].dateKey}`);
    }
    
    // 智能选择中间的几个关键日期
    const targetLabelCount = Math.min(8, Math.max(6, Math.floor(totalDays / 4)));
    
    if (targetLabelCount > 2) {
      const interval = Math.floor((totalDays - 2) / (targetLabelCount - 2));
      
      for (let i = 1; i < targetLabelCount - 1; i++) {
        const index = Math.min(i * interval, totalDays - 2);
        if (index > 0 && index < totalDays - 1) {
          if (!ticks.includes(uniqueDates[index].dataPoint.date)) {
            ticks.push(uniqueDates[index].dataPoint.date);
            console.log(`[3 Months X轴] 添加中间日期 ${i}: ${uniqueDates[index].dateKey} (索引: ${index})`);
          }
        }
      }
    }
    
    // 总是包含最后一个日期
    if (!ticks.includes(uniqueDates[totalDays - 1].dataPoint.date)) {
      ticks.push(uniqueDates[totalDays - 1].dataPoint.date);
      console.log(`[3 Months X轴] 添加最后一个日期: ${uniqueDates[totalDays - 1].dateKey}`);
    }
  }
  
  // 5. 确保ticks按时间排序（从左到右：旧 -> 新）
  ticks.sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
  
  console.log(`[3 Months X轴] 生成${ticks.length}个半月节奏日期标签`);
  
  // 6. 打印最终选择的日期
  console.log('[3 Months X轴] 最终选择的日期标签:');
  ticks.forEach((tick, index) => {
    const date = new Date(tick);
    const month = date.getUTCMonth() + 1;
    const day = date.getUTCDate();
    console.log(`  ${index + 1}. ${month}/${day}`);
  });
  
  return ticks;
};

// 5. 1 Year: 生成每月1号数字日期标签 - 智能选择最接近的1号日期节点
const getProfessional1YearTicks = (chartData: ChartDataPoint[]): string[] => {
  if (!chartData || chartData.length === 0) {
    return [];
  }
  
  console.log('[1 Year X轴] ====== 生成每月1号数字日期标签 (智能选择最接近的1号) ======');
  console.log('[1 Year X轴] 输入数据点数量:', chartData.length);
  
  // 1. 按时间排序数据（确保从左到右是旧到新）
  const sortedData = [...chartData].sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  
  // 2. 提取所有唯一的日期
  const uniqueDates: {date: Date, dateKey: string, dataPoint: ChartDataPoint}[] = [];
  const seenDays = new Set<string>();
  
  sortedData.forEach((point) => {
    const date = new Date(point.date);
    const dateKey = date.toISOString().split('T')[0];
    
    if (!seenDays.has(dateKey)) {
      uniqueDates.push({
        date,
        dateKey,
        dataPoint: point
      });
      seenDays.add(dateKey);
    }
  });
  
  console.log(`[1 Year X轴] 唯一交易日数量: ${uniqueDates.length}`);
  
  // 3. 智能选择每月1号日期标签（或最接近的日期）
  const ticks: string[] = [];
  
  // 获取数据的时间范围
  if (uniqueDates.length > 0) {
    const firstDate = uniqueDates[0].date;
    const lastDate = uniqueDates[uniqueDates.length - 1].date;
    
    const startYear = firstDate.getUTCFullYear();
    const startMonth = firstDate.getUTCMonth();
    const endYear = lastDate.getUTCFullYear();
    const endMonth = lastDate.getUTCMonth();
    
    console.log(`[1 Year X轴] 数据时间范围: ${startYear}/${startMonth + 1} 到 ${endYear}/${endMonth + 1}`);
    
    // 生成目标日期列表（每月1号）
    const targetDateKeys: string[] = [];
    
    let currentYear = startYear;
    let currentMonth = startMonth;
    
    // 生成1年范围内的所有目标日期
    const totalMonths = (endYear - startYear) * 12 + (endMonth - startMonth) + 1;
    const monthsToGenerate = Math.min(13, totalMonths + 1); // 最多13个月（1年+1个月缓冲）
    
    for (let i = 0; i < monthsToGenerate; i++) {
      // 创建目标日期（每月1号）
      const targetDate = new Date(Date.UTC(currentYear, currentMonth, 1));
      const targetDateKey = targetDate.toISOString().split('T')[0];
      targetDateKeys.push(targetDateKey);
      
      // 如果目标日期在数据时间范围内，尝试找到最接近的交易日
      if (targetDate >= firstDate && targetDate <= lastDate) {
        // 查找最接近目标日期的交易日
        let closestDate = uniqueDates[0];
        let minDiff = Math.abs(targetDate.getTime() - closestDate.date.getTime());
        
        for (const item of uniqueDates) {
          const diff = Math.abs(targetDate.getTime() - item.date.getTime());
          if (diff < minDiff) {
            minDiff = diff;
            closestDate = item;
          }
        }
        
        // 如果最接近的日期在7天范围内，使用它
        if (minDiff <= 7 * 24 * 60 * 60 * 1000) { // 7天内
          const dateKey = closestDate.dateKey;
          if (!ticks.includes(closestDate.dataPoint.date)) {
            ticks.push(closestDate.dataPoint.date);
            console.log(`[1 Year X轴] 添加每月1号日期: ${dateKey} (目标: ${targetDateKey})`);
          }
        }
      }
      
      // 移动到下一个月
      currentMonth++;
      if (currentMonth > 11) {
        currentMonth = 0;
        currentYear++;
      }
    }
  }
  
  // 4. 如果没有找到足够的每月1号日期，使用智能选择的关键日期
  if (ticks.length < 8) {
    console.log(`[1 Year X轴] 每月1号日期不足(${ticks.length}个)，使用智能选择的关键日期`);
    
    const totalDays = uniqueDates.length;
    
    // 总是包含第一个日期
    if (!ticks.includes(uniqueDates[0].dataPoint.date)) {
      ticks.push(uniqueDates[0].dataPoint.date);
      console.log(`[1 Year X轴] 添加第一个日期: ${uniqueDates[0].dateKey}`);
    }
    
    // 智能选择中间的几个关键日期（每月一个）
    const targetLabelCount = Math.min(12, Math.max(8, Math.floor(totalDays / 20)));
    
    if (targetLabelCount > 2) {
      const interval = Math.floor((totalDays - 2) / (targetLabelCount - 2));
      
      for (let i = 1; i < targetLabelCount - 1; i++) {
        const index = Math.min(i * interval, totalDays - 2);
        if (index > 0 && index < totalDays - 1) {
          if (!ticks.includes(uniqueDates[index].dataPoint.date)) {
            ticks.push(uniqueDates[index].dataPoint.date);
            console.log(`[1 Year X轴] 添加中间日期 ${i}: ${uniqueDates[index].dateKey} (索引: ${index})`);
          }
        }
      }
    }
    
    // 总是包含最后一个日期
    if (!ticks.includes(uniqueDates[totalDays - 1].dataPoint.date)) {
      ticks.push(uniqueDates[totalDays - 1].dataPoint.date);
      console.log(`[1 Year X轴] 添加最后一个日期: ${uniqueDates[totalDays - 1].dateKey}`);
    }
  }
  
  // 5. 确保ticks按时间排序（从左到右：旧 -> 新）
  ticks.sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
  
  console.log(`[1 Year X轴] 生成${ticks.length}个每月1号数字日期标签`);
  
  // 6. 打印最终选择的日期
  console.log('[1 Year X轴] 最终选择的日期标签:');
  ticks.forEach((tick, index) => {
    const date = new Date(tick);
    const month = date.getUTCMonth() + 1;
    const day = date.getUTCDate();
    console.log(`  ${index + 1}. ${month}/${day}`);
  });
  
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

  // 统一的Range Position计算函数
  const calculateRangePosition = (
    currentPrice: number | null,
    yearHigh: number | null | undefined,
    yearLow: number | null | undefined
  ): {
    percentage: number | null;
    label: string;
    description: string;
  } => {
    // 检查所有必需的值
    if (
      currentPrice === null || 
      yearHigh === null || yearHigh === undefined || 
      yearLow === null || yearLow === undefined ||
      yearHigh <= yearLow
    ) {
      return {
        percentage: null,
        label: 'N/A',
        description: 'No data'
      };
    }

    // 计算百分比
    const percentage = ((currentPrice - yearLow) / (yearHigh - yearLow)) * 100;
    
    // 根据百分比确定标签和描述
    let label = '';
    let description = '';
    
    if (percentage >= 80) {
      label = 'Near 52W High';
      description = 'Trading near 52-week high';
    } else if (percentage >= 60) {
      label = 'Upper range';
      description = 'Trading in upper range';
    } else if (percentage >= 40) {
      label = 'Mid-range';
      description = 'Trading in mid-range';
    } else if (percentage >= 20) {
      label = 'Lower range';
      description = 'Trading in lower range';
    } else {
      label = 'Near 52W Low';
      description = 'Trading near 52-week low';
    }

    return {
      percentage,
      label,
      description
    };
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
    
    // 显示日期和时间：月/日 时:分（1 Week专用格式）
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      hour12: false
    });
    
    // 获取格式化部分
    const parts = formatter.formatToParts(date);
    
    // 提取需要的部分
    const month = parts.find(p => p.type === 'month')?.value || '';
    const day = parts.find(p => p.type === 'day')?.value || '';
    const hour = parts.find(p => p.type === 'hour')?.value || '';
    const minute = parts.find(p => p.type === 'minute')?.value || '';
    
    // 组合成月/日 时:分格式（1 Week Tooltip专用）
    return `${month}/${day} ${hour}:${minute}`;
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

  // 图表相关状态 - 默认显示1 Day图表
  const [selectedTimeframe, setSelectedTimeframe] = useState<string>('1D');
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
      
      // 重要：切换timeframe时清空旧数据，防止显示旧图
      // 所有timeframe切换时都清空数据，避免旧图残留
      console.log(`[${selectedTimeframe}图] 切换时间范围，清空旧数据`);
      setHistoricalData([]);
      setChartData([]);
      
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
      
      // 设置历史数据 - 不再进行请求版本检查
      // 因为我们已经通过清空数据来防止旧图残留
      console.log(`[${selectedTimeframe}图] 设置历史数据: ${response.data?.length || 0}条`);
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
            // Alpaca返回的时间格式是ISO字符串（如 "2026-03-20T14:30:00Z"）
            // 如果是模拟数据，可能是 "2026-03-20 06:10:36" 格式
            let timeStr = item.time;
            
            // 检查是否是Alpaca的ISO格式（以Z结尾）
            if (timeStr.endsWith('Z')) {
              // Alpaca ISO格式，直接使用
              date = new Date(timeStr);
            } else if (timeStr.includes(' ')) {
              // 模拟数据格式: "2026-03-20 06:10:36"
              // 转换为ISO格式，假设是UTC时间
              timeStr = timeStr.replace(' ', 'T') + 'Z';
              date = new Date(timeStr);
            } else {
              // 日线格式: "2026-03-20"
              timeStr = timeStr + 'T00:00:00Z';
              date = new Date(timeStr);
            }
            
            if (!isNaN(date.getTime())) {
              // 成功解析time字段
              console.log(`[Analyze] 转换 ${index+1}: 使用time字段 "${item.time}" -> ${date.toISOString()} (数据源: ${response.dataSource})`);
              return {
                date: date.toISOString(), // 使用ISO字符串（UTC时间）
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
      
      // 为1 Day、1 Month、3 Months、1 Year数据添加排序，确保时间顺序：旧 -> 新
      if (selectedTimeframe === '1D' || selectedTimeframe === '1M' || selectedTimeframe === '3M' || selectedTimeframe === '1Y') {
        console.log(`[${selectedTimeframe}] ====== 开始排序数据（确保时间顺序：旧 -> 新） ======`);
        console.log(`[${selectedTimeframe}] 排序前数据条数: ${chartDataToSet.length}`);
        
        if (chartDataToSet.length > 0) {
          // 按时间升序排序（旧 -> 新）
          chartDataToSet = [...chartDataToSet].sort((a, b) => {
            return new Date(a.date).getTime() - new Date(b.date).getTime();
          });
          
          console.log(`[${selectedTimeframe}] 已按时间正序排序（最早在前，最新在后）`);
          
          // 验证排序结果
          if (chartDataToSet.length > 1) {
            const firstDate = new Date(chartDataToSet[0].date);
            const lastDate = new Date(chartDataToSet[chartDataToSet.length - 1].date);
            console.log(`[${selectedTimeframe}] 排序验证:`);
            console.log(`  - 第一个数据点: ${firstDate.toISOString()}`);
            console.log(`  - 最后一个数据点: ${lastDate.toISOString()}`);
            console.log(`  - 顺序: ${firstDate < lastDate ? '✅ 旧 -> 新' : '❌ 新 -> 旧'}`);
            
            // 特别为1 Day显示时间
            if (selectedTimeframe === '1D') {
              const firstHour = firstDate.getUTCHours();
              const firstMinute = firstDate.getUTCMinutes();
              const lastHour = lastDate.getUTCHours();
              const lastMinute = lastDate.getUTCMinutes();
              console.log(`[1 Day] 时间范围: ${firstHour}:${String(firstMinute).padStart(2, '0')} -> ${lastHour}:${String(lastMinute).padStart(2, '0')} (UTC)`);
            }
          }
        }
        console.log(`[${selectedTimeframe}] ====== 数据排序完成 ======`);
      }
      
      if (selectedTimeframe === '3M') {
        // === 3 Months 专用：调整日期范围，收紧到最近3个月 ===
        console.log(`[3 Months] ====== 开始调整日期范围 ======`);
        console.log(`[3 Months] 1. 原始formattedData条数: ${formattedData.length}`);
        
        if (chartDataToSet.length > 0) {
          // 计算最近3个月的日期（90天前）
          const today = new Date();
          const threeMonthsAgo = new Date(today);
          threeMonthsAgo.setDate(today.getDate() - 90);
          
          console.log(`[3 Months] 2. 今天: ${today.toISOString().split('T')[0]}`);
          console.log(`[3 Months] 3. 3个月前: ${threeMonthsAgo.toISOString().split('T')[0]}`);
          
          // 过滤出最近3个月的数据（使用已排序的chartDataToSet）
          const recentData = chartDataToSet.filter(item => {
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
        
        if (chartDataToSet.length > 0) {
          // 计算最近1个月的日期（30天前）
          const today = new Date();
          const oneMonthAgo = new Date(today);
          oneMonthAgo.setDate(today.getDate() - 30);
          
          console.log(`[1 Month] 2. 今天: ${today.toISOString().split('T')[0]}`);
          console.log(`[1 Month] 3. 1个月前: ${oneMonthAgo.toISOString().split('T')[0]}`);
          
          // 过滤出最近1个月的数据（使用已排序的chartDataToSet）
          const recentData = chartDataToSet.filter(item => {
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
        // === 1 Week 专用：确保数据顺序正确（从左到右：旧 -> 新） ===
        console.log('[1 Week] ====== 处理1 Week数据，确保时间顺序正确 ======');
        console.log('[1 Week] 后端返回原始数据点数:', formattedData.length);
        
        // 1. 首先确保formattedData按时间排序（旧 -> 新）
        const sortedFormattedData = [...formattedData].sort((a, b) => 
          new Date(a.date).getTime() - new Date(b.date).getTime()
        );
        
        console.log('[1 Week] 2. 排序后数据点数:', sortedFormattedData.length);
        
        if (sortedFormattedData.length > 0) {
          // 2. 计算最近1周的日期（7天前）
          const today = new Date();
          const oneWeekAgo = new Date(today);
          oneWeekAgo.setDate(today.getDate() - 7);
          
          console.log('[1 Week] 3. 今天:', today.toISOString().split('T')[0]);
          console.log('[1 Week] 4. 1周前:', oneWeekAgo.toISOString().split('T')[0]);
          
          // 3. 过滤出最近1周的数据
          const recentData = sortedFormattedData.filter(item => {
            const itemDate = new Date(item.date);
            return itemDate >= oneWeekAgo;
          });
          
          console.log('[1 Week] 5. 过滤后数据条数:', recentData.length);
          
          if (recentData.length > 0) {
            // 使用过滤后的数据（已经是正确顺序）
            chartDataToSet = recentData;
            
            const firstDate = new Date(chartDataToSet[0].date);
            const lastDate = new Date(chartDataToSet[chartDataToSet.length - 1].date);
            
            console.log('[1 Week] 6. 调整后数据范围:', firstDate.toISOString().split('T')[0], '到', lastDate.toISOString().split('T')[0]);
            console.log('[1 Week] 7. 总天数:', chartDataToSet.length, '个交易日');
            console.log('[1 Week] 8. 收紧天数:', sortedFormattedData.length - recentData.length, '天');
            
            // 调试：打印数据顺序
            console.log('[1 Week] 9. 数据顺序验证:');
            console.log('[1 Week]   第一个点:', firstDate.toISOString(), '->', 
              `${(firstDate.getUTCHours() - 4 + 24) % 24}:${String(firstDate.getUTCMinutes()).padStart(2, '0')}`);
            console.log('[1 Week]   最后一个点:', lastDate.toISOString(), '->', 
              `${(lastDate.getUTCHours() - 4 + 24) % 24}:${String(lastDate.getUTCMinutes()).padStart(2, '0')}`);
          } else {
            // 如果没有最近1周的数据，使用原始数据但显示警告
            console.log('[1 Week] ⚠️ 警告: 没有最近1周的数据，使用原始数据');
            chartDataToSet = sortedFormattedData;
          }
        } else {
          console.log('[1 Week] ⚠️ 警告: formattedData为空，图表将显示"No historical data available"');
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
      // 首先验证数据顺序
      console.log(`[技术指标计算] 开始计算技术指标，数据点数: ${chartDataToSet.length}`);
      
      if (chartDataToSet.length > 1) {
        const firstDate = new Date(chartDataToSet[0].date);
        const lastDate = new Date(chartDataToSet[chartDataToSet.length - 1].date);
        const timeDiff = lastDate.getTime() - firstDate.getTime();
        
        console.log(`[技术指标计算] 数据顺序验证:`);
        console.log(`[技术指标计算]   第一个点: ${firstDate.toISOString()} (索引0)`);
        console.log(`[技术指标计算]   最后一个点: ${lastDate.toISOString()} (索引${chartDataToSet.length - 1})`);
        console.log(`[技术指标计算]   时间差: ${timeDiff}ms (${timeDiff > 0 ? '正确顺序: 旧 -> 新' : '错误顺序: 新 -> 旧'})`);
        
        if (timeDiff < 0) {
          console.warn(`[技术指标计算] ⚠️ 警告: 数据顺序可能错误！最后一个点比第一个点更早`);
        }
      }
      
      const closePrices = chartDataToSet.map(d => d.close);
      
      // 计算移动平均线（基于close价格）
      const sma20 = calculateSMA(closePrices, 20);
      const sma50 = calculateSMA(closePrices, 50);
      const ema12 = calculateEMA(closePrices, 12);
      const ema26 = calculateEMA(closePrices, 26);
      
      // === 特殊处理：1 Month的RSI计算需要更多预热数据 ===
      let rsi: number[];
      if (selectedTimeframe === '1M' && formattedData.length > chartDataToSet.length) {
        console.log(`[1 Month RSI优化] 使用扩展数据计算RSI`);
        console.log(`[1 Month RSI优化] 图表数据: ${chartDataToSet.length}条，完整数据: ${formattedData.length}条`);
        
        // 使用完整的formattedData计算RSI（包含2个月数据）
        const fullClosePrices = formattedData.map(d => d.close);
        const fullRSI = calculateRSI(fullClosePrices, 14);
        
        // 只取最后chartDataToSet.length个RSI值（对应最近1个月）
        const startIndex = fullRSI.length - chartDataToSet.length;
        rsi = fullRSI.slice(startIndex);
        
        console.log(`[1 Month RSI优化] 完整RSI: ${fullRSI.length}个值`);
        console.log(`[1 Month RSI优化] 截取RSI: ${rsi.length}个值（从索引${startIndex}开始）`);
        
        // 验证RSI数据
        const validRSICount = rsi.filter(v => !isNaN(v)).length;
        console.log(`[1 Month RSI优化] 有效RSI值: ${validRSICount}/${rsi.length}`);
      } else {
        // 其他时间范围使用正常计算
        rsi = calculateRSI(closePrices, 14);
      }

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
      
      // 不再添加16:00占位点
      const finalChartData = chartDataWithIndicators;
      
      setChartData(finalChartData);
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

  // === 1 Day 专用：生成清晰的时间轴标签 ===
  const get1DayTicks = (chartData: ChartDataPoint[]): string[] => {
    if (selectedTimeframe !== '1D' || !chartData || chartData.length === 0) {
      return [];
    }
    
    console.log('[1 Day] ====== 生成整点/半点时间标签 ======');
    console.log('[1 Day] 原始数据点数:', chartData.length);
    
    const ticks: string[] = [];
    
    // 1. 获取第一个数据点的日期部分（年、月、日）
    // 注意：chartData[0].date是ISO字符串（UTC时间）
    // 我们需要转换为纽约时间显示
    const firstDate = new Date(chartData[0].date);
    const year = firstDate.getUTCFullYear();
    const month = firstDate.getUTCMonth();
    const day = firstDate.getUTCDate();
    
    // 2. 获取实际交易时间范围（转换为纽约时间）
    const firstPoint = chartData[0];
    const lastPoint = chartData[chartData.length - 1];
    const firstTime = new Date(firstPoint.date);
    const lastTime = new Date(lastPoint.date);
    
    // UTC时间转换为纽约时间（EDT，-4小时）
    const startHourUTC = firstTime.getUTCHours();
    const startMinuteUTC = firstTime.getUTCMinutes();
    const endHourUTC = lastTime.getUTCHours();
    const endMinuteUTC = lastTime.getUTCMinutes();
    
    // 转换为纽约时间（EDT，-4小时）
    const startHour = (startHourUTC - 4 + 24) % 24;
    const startMinute = startMinuteUTC;
    const endHour = (endHourUTC - 4 + 24) % 24;
    const endMinute = endMinuteUTC;
    
    console.log(`[1 Day] 实际交易时间: ${startHour}:${String(startMinute).padStart(2, '0')} - ${endHour}:${String(endMinute).padStart(2, '0')}`);
    
    // 调试：打印前5个和后5个数据点的时间
    console.log('[1 Day] 前5个数据点时间:');
    for (let i = 0; i < Math.min(5, chartData.length); i++) {
      const date = new Date(chartData[i].date);
      console.log(`  ${i+1}. ${date.getUTCHours()}:${String(date.getUTCMinutes()).padStart(2, '0')}`);
    }
    
    console.log('[1 Day] 后5个数据点时间:');
    for (let i = Math.max(0, chartData.length - 5); i < chartData.length; i++) {
      const date = new Date(chartData[i].date);
      console.log(`  ${i+1}. ${date.getUTCHours()}:${String(date.getUTCMinutes()).padStart(2, '0')}`);
    }
    
    // 3. 定义所有可能的整点/半点时间（9:30 到 16:00）
    const allPossibleTimes = [
      '09:30', '10:00', '10:30', '11:00', '11:30',
      '12:00', '12:30', '13:00', '13:30', '14:00',
      '14:30', '15:00', '15:30', '16:00'
    ];
    
    // 4. 强制生成所有30分钟间隔的标签（09:30到16:00）
    // 特别处理：即使数据不到16:00，也要添加16:00作为终点标签
    allPossibleTimes.forEach(timeStr => {
      const [hour, minute] = timeStr.split(':').map(Number);
      const timeInMinutes = hour * 60 + minute;
      const startInMinutes = startHour * 60 + startMinute;
      const endInMinutes = endHour * 60 + endMinute;
      
      // 对于16:00，总是添加它作为终点标签
      const is1600 = hour === 16 && minute === 0;
      
      // 如果这个整点/半点时间在交易时间范围内，或者它是16:00，就添加它
      if (timeInMinutes >= startInMinutes && (timeInMinutes <= endInMinutes || is1600)) {
        // 创建固定时间的日期字符串（纽约时间）
        // 注意：hour和minute是纽约时间，需要转换为UTC
        const utcHour = (hour + 4) % 24; // 纽约时间 -> UTC时间（EDT，+4小时）
        const fixedDate = new Date(Date.UTC(year, month, day, utcHour, minute, 0));
        ticks.push(fixedDate.toISOString());
        
        if (is1600) {
          console.log(`[1 Day] 强制添加终点标签 ${timeStr} (纽约时间) -> ${fixedDate.toISOString()} (UTC)`);
        } else {
          console.log(`[1 Day] 添加整点/半点时间标签 ${timeStr} (纽约时间) -> ${fixedDate.toISOString()} (UTC)`);
        }
      }
    });
    
    // 5. 确保至少有一个标签（如果没有任何整点/半点时间在范围内）
    if (ticks.length === 0) {
      // 添加开始时间（调整到最近的整点/半点）
      let adjustedStartHour = startHour;
      let adjustedStartMinute = startMinute;
      
      if (startMinute < 15) {
        adjustedStartMinute = 0; // 调整到整点
      } else if (startMinute < 45) {
        adjustedStartMinute = 30; // 调整到半点
      } else {
        adjustedStartMinute = 0;
        adjustedStartHour = startHour + 1; // 超过45分，调整到下个整点
      }
      
      // 纽约时间转换为UTC（EDT，+4小时）
      const utcStartHour = (adjustedStartHour + 4) % 24;
      const startDate = new Date(Date.UTC(year, month, day, utcStartHour, adjustedStartMinute, 0));
      ticks.push(startDate.toISOString());
      console.log(`[1 Day] 添加调整后的开始时间: ${adjustedStartHour}:${String(adjustedStartMinute).padStart(2, '0')} (纽约时间) -> ${startDate.toISOString()} (UTC)`);
    }
    
    // 6. 确保最后一个标签是整点/半点（调整结束时间）
    if (ticks.length > 0) {
      const lastTick = new Date(ticks[ticks.length - 1]);
      const lastTickHour = lastTick.getUTCHours();
      const lastTickMinute = lastTick.getUTCMinutes();
      
      // 如果最后一个标签不是实际的结束时间，添加调整后的结束时间
      const actualEndInMinutes = endHour * 60 + endMinute;
      const lastTickInMinutes = lastTickHour * 60 + lastTickMinute;
      
      if (actualEndInMinutes > lastTickInMinutes) {
        // 调整结束时间到最近的整点/半点
        let adjustedEndHour = endHour;
        let adjustedEndMinute = endMinute;
        
        if (endMinute < 15) {
          adjustedEndMinute = 0; // 调整到整点
        } else if (endMinute < 45) {
          adjustedEndMinute = 30; // 调整到半点
        } else {
          adjustedEndMinute = 0;
          adjustedEndHour = endHour + 1; // 超过45分，调整到下个整点
        }
        
        // 纽约时间转换为UTC（EDT，+4小时）
        const utcEndHour = (adjustedEndHour + 4) % 24;
        const endDate = new Date(Date.UTC(year, month, day, utcEndHour, adjustedEndMinute, 0));
        ticks.push(endDate.toISOString());
        console.log(`[1 Day] 添加调整后的结束时间: ${adjustedEndHour}:${String(adjustedEndMinute).padStart(2, '0')} (纽约时间) -> ${endDate.toISOString()} (UTC)`);
      }
    }
    
    // 7. 确保ticks按时间排序
    ticks.sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
    
    console.log('[1 Day] 最终ticks数量:', ticks.length);
    console.log('[1 Day] 最终ticks列表（UTC时间）:', ticks.map(t => {
      const d = new Date(t);
      return `${d.getUTCHours()}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
    }));
    
    // 转换为纽约时间显示
    console.log('[1 Day] 最终ticks列表（纽约时间EDT）:', ticks.map(t => {
      const d = new Date(t);
      const utcHour = d.getUTCHours();
      const minute = d.getUTCMinutes();
      const nyHour = (utcHour - 4 + 24) % 24; // UTC -> EDT
      return `${String(nyHour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    }));
    
    // 检查是否包含16:00
    const has1600 = ticks.some(t => {
      const d = new Date(t);
      const utcHour = d.getUTCHours();
      const minute = d.getUTCMinutes();
      const nyHour = (utcHour - 4 + 24) % 24;
      return nyHour === 16 && minute === 0;
    });
    
    console.log(`[1 Day] 是否包含16:00标签: ${has1600 ? '✅ 是' : '❌ 否'}`);
    console.log('[1 Day] ====== 整点/半点时间标签生成完成 ======');
    
    return ticks;
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

      // 根据时间范围调整缓冲空间
      let bufferRatio = 0.02; // 默认2%
      
      // 不同时间范围使用不同缓冲
      switch (selectedTimeframe) {
        case '1D':
          bufferRatio = 0.01; // Day图：1%缓冲，更紧凑
          break;
        case '1W':
          bufferRatio = 0.015; // Week图：1.5%缓冲
          break;
        case '1M':
          bufferRatio = 0.02; // Month图：2%缓冲
          break;
        case '3M':
          bufferRatio = 0.025; // 3 Months：2.5%缓冲
          break;
        case '1Y':
          bufferRatio = 0.03; // Year图：3%缓冲，留更多空间
          break;
        default:
          bufferRatio = 0.02;
      }
      
      const buffer = priceRange * bufferRatio;
      return [minPrice - buffer, maxPrice + buffer];
    };

    const yDomain = getYAxisDomain();
    // 根据时间范围调整图表高度
    const chartHeight = selectedTimeframe === '1Y' ? 550 : 500; // Year图更高，显示更多细节
    
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
            // 第一个月份点不显示标签（去掉最左边的3/20），其他月份点显示M/1
            if (monthPoints.length === 1) {
              // 第一个点：不显示标签（空字符串）
              monthLabels[dataPoint.date] = '';
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
        
        // 第一个点不显示标签（空字符串）
        monthLabels[chartData[0].date] = '';
        // 最后一个点显示真实日期（M/D格式）
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
    
    // 计算期间变化百分比（Period Change） - 相对于前收盘价
    let periodChange = null;
    let periodChangePercent = null;
    let prevCloseLine = null;
    
    if (chartData.length >= 1 && stockData && stockData.previousClose) {
      const lastClose = chartData[chartData.length - 1].close;
      
      if (stockData.previousClose > 0 && lastClose > 0) {
        // 使用前收盘价作为基准
        periodChange = lastClose - stockData.previousClose;
        periodChangePercent = (periodChange / stockData.previousClose) * 100;
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
    // 按照专业方案重新设计X轴标签
    const formatXAxisTick = (value: string, index: number) => {
      if (!value) return '';
      
      try {
        const date = new Date(value);
        
        if (isNaN(date.getTime())) {
          return '';
        }
        
        // 根据时间范围显示不同的专业格式
        switch (selectedTimeframe) {
          case '1D':
            // 1 Day: 显示整点小时标签 (HH:00)
            // 使用纽约时间（EDT）
            const utcHour = date.getUTCHours();
            const minute = date.getUTCMinutes();
            
            // UTC时间转换为纽约时间（EDT，-4小时）
            const nyHour = (utcHour - 4 + 24) % 24;
            
            // 显示整点小时标签 (如04:00, 05:00, 06:00等)
            return `${String(nyHour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
            
          case '1W':
            // 1 Week: 显示清晰的跨天日期格式 (如: 3/16)
            // 使用纽约时间（EDT）
            const utcHourW = date.getUTCHours();
            const nyHourW = (utcHourW - 4 + 24) % 24;
            const monthW = date.getUTCMonth() + 1; // 月份 (1-12)
            const dayW = date.getUTCDate(); // 日期 (1-31)
            
            // 显示月/日格式，让用户一眼看出是跨多天数据
            return `${monthW}/${dayW}`;
            
          case '1M':
            // 1 Month: 显示日期节点，使用智能选择的日期标签
            const monthM = date.getUTCMonth() + 1;
            const dayM = date.getUTCDate();
            
            // 显示所有传入的ticks（由getProfessional1MonthTicks智能选择）
            return `${monthM}/${dayM}`;
            
          case '3M':
            // 3 Months: 显示半月节奏日期标签
            const month3M = date.getUTCMonth() + 1;
            const day3M = date.getUTCDate();
            
            // 显示所有传入的ticks（由getProfessional3MonthsTicks智能选择）
            return `${month3M}/${day3M}`;
            
          case '1Y':
            // 1 Year: 显示每月1号数字日期标签
            const monthY = date.getUTCMonth() + 1;
            const dayY = date.getUTCDate();
            
            // 显示所有传入的ticks（由getProfessional1YearTicks智能选择）
            return `${monthY}/${dayY}`;
            
          default:
            return '';
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
          border: '1px solid #bfbfbf',
          borderRadius: '6px',
          padding: '14px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          minWidth: '220px',
          maxWidth: '280px',
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          fontSize: '12px',
          backdropFilter: 'blur(4px)'
        }}>
          {/* 标题行 - 时间/日期 */}
          <div style={{
            fontWeight: '600',
            marginBottom: '12px',
            color: '#1f1f1f',
            borderBottom: '1px solid #e8e8e8',
            paddingBottom: '8px',
            fontSize: '12px',
            letterSpacing: '0.3px'
          }}>
            {isDaily || isWeekly
              ? formatAsNewYorkTime(date, true) // 移除(NY)标记
              : selectedTimeframe === '1Y' || selectedTimeframe === '3M' || selectedTimeframe === '1M'
                ? `${date.getUTCFullYear()}/${String(date.getUTCMonth() + 1).padStart(2, '0')}/${String(date.getUTCDate()).padStart(2, '0')}`
                : `${String(date.getUTCMonth() + 1).padStart(2, '0')}/${String(date.getUTCDate()).padStart(2, '0')}`
            }
          </div>
          
          {/* 数据行 - 优化排版 */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            {/* 1 Day: 显示Close和Percent Change */}
            {isDaily ? (
              <>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingBottom: '6px',
                  borderBottom: '1px solid #f5f5f5'
                }}>
                  <span style={{ color: '#595959', fontSize: '11px' }}>Price:</span>
                  <span style={{ 
                    fontWeight: '600', 
                    color: '#1677ff',
                    fontSize: '14px'
                  }}>
                    ${data.close.toFixed(2)}
                  </span>
                </div>
                {/* 计算相对于前收盘价的percent change */}
                {stockData && stockData.previousClose && stockData.previousClose > 0 && (
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <span style={{ color: '#595959', fontSize: '11px' }}>Change:</span>
                    <span style={{ 
                      fontWeight: '600', 
                      fontSize: '12px',
                      color: data.close >= stockData.previousClose ? '#389e0d' : '#cf1322',
                      backgroundColor: data.close >= stockData.previousClose ? 'rgba(56, 158, 13, 0.1)' : 'rgba(207, 19, 34, 0.1)',
                      padding: '2px 6px',
                      borderRadius: '3px'
                    }}>
                      {data.close >= stockData.previousClose ? '▲ ' : '▼ '}
                      {((data.close - stockData.previousClose) / stockData.previousClose * 100).toFixed(2)}%
                    </span>
                  </div>
                )}
              </>
            ) : (
              // 其他timeframe: 显示OHLC和Percent Change
              <>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingBottom: '6px',
                  borderBottom: '1px solid #f5f5f5'
                }}>
                  <span style={{ color: '#595959', fontSize: '11px' }}>Close:</span>
                  <span style={{ 
                    fontWeight: '600', 
                    color: '#1677ff',
                    fontSize: '14px'
                  }}>
                    ${data.close.toFixed(2)}
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#8c8c8c', fontSize: '11px' }}>Open:</span>
                    <span style={{ fontWeight: '500', fontSize: '11px' }}>
                      ${data.open.toFixed(2)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#8c8c8c', fontSize: '11px' }}>High:</span>
                    <span style={{ fontWeight: '500', color: '#389e0d', fontSize: '11px' }}>
                      ${data.high.toFixed(2)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#8c8c8c', fontSize: '11px' }}>Low:</span>
                    <span style={{ fontWeight: '500', color: '#cf1322', fontSize: '11px' }}>
                      ${data.low.toFixed(2)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#8c8c8c', fontSize: '11px' }}>Volume:</span>
                    <span style={{ fontWeight: '500', color: '#595959', fontSize: '11px' }}>
                      {data.volume ? (data.volume >= 1000000 ? `${(data.volume / 1000000).toFixed(1)}M` : 
                        data.volume >= 1000 ? `${(data.volume / 1000).toFixed(0)}K` : data.volume.toFixed(0)) : 'N/A'}
                    </span>
                  </div>
                </div>
                {/* 计算相对于前收盘价的percent change */}
                {stockData && stockData.previousClose && stockData.previousClose > 0 && (
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginTop: '8px',
                    paddingTop: '8px',
                    borderTop: '1px solid #f5f5f5'
                  }}>
                    <span style={{ color: '#595959', fontSize: '11px' }}>Change:</span>
                    <span style={{ 
                      fontWeight: '600', 
                      fontSize: '12px',
                      color: data.close >= stockData.previousClose ? '#389e0d' : '#cf1322',
                      backgroundColor: data.close >= stockData.previousClose ? 'rgba(56, 158, 13, 0.1)' : 'rgba(207, 19, 34, 0.1)',
                      padding: '2px 6px',
                      borderRadius: '3px'
                    }}>
                      {data.close >= stockData.previousClose ? '▲ ' : '▼ '}
                      {((data.close - stockData.previousClose) / stockData.previousClose * 100).toFixed(2)}%
                    </span>
                  </div>
                )}
              </>
            )}
            
            {/* 技术指标：SMA20和SMA50（如果存在） - 优化排版 */}
            {(data.sma20 !== undefined && !isNaN(data.sma20) || data.sma50 !== undefined && !isNaN(data.sma50)) && (
              <div style={{ 
                marginTop: '8px', 
                paddingTop: '8px', 
                borderTop: '1px solid #f0f0f0',
                fontSize: '11px'
              }}>
                <div style={{ fontWeight: '600', color: '#595959', marginBottom: '4px' }}>
                  Technical Indicators
                </div>
                {(data.sma20 !== undefined && !isNaN(data.sma20)) && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                    <span style={{ color: '#595959' }}>SMA 20:</span>
                    <span style={{ fontWeight: '500', color: '#389e0d' }}>
                      ${data.sma20.toFixed(2)}
                    </span>
                  </div>
                )}
                {(data.sma50 !== undefined && !isNaN(data.sma50)) && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#595959' }}>SMA 50:</span>
                    <span style={{ fontWeight: '500', color: '#d46b08' }}>
                      ${data.sma50.toFixed(2)}
                    </span>
                  </div>
                )}
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
          {/* 网格线 - 专业金融图表风格 */}
          <CartesianGrid 
            strokeDasharray="3 3" 
            stroke="#e8e8e8" 
            vertical={selectedTimeframe !== '1D'} // Day图不显示垂直网格线（太密集）
            strokeOpacity={0.3} // 适中透明度
            strokeWidth={0.5}
          />

          {/* X轴 - 根据timeframe格式化，改进显示 */}
          <XAxis
            dataKey="date"
            tick={{
              fontSize: selectedTimeframe === '1W' ? 12 : 11, // 1 Week字体调整为12
              fill: '#262626', // 更深的颜色，更清晰
              fontWeight: selectedTimeframe === '1D' ? '400' : 'normal' // Day图正常字体
            }}
            axisLine={{ stroke: '#bfbfbf', strokeWidth: 1 }}
            tickLine={selectedTimeframe === '1Y' ? 
              { 
                stroke: '#d9d9d9', // 很轻的灰色
                strokeWidth: 0.5    // 更细的线
              } : 
              { stroke: '#bfbfbf', strokeWidth: 1 }
            } // 1 Year显示很轻的竖线
            height={selectedTimeframe === '1W' ? 60 : selectedTimeframe === '1D' ? 50 : 40} // Day图增加高度，确保最后一个标签能显示
            tickFormatter={formatXAxisTick}
            // 根据timeframe设置interval
            interval={
              selectedTimeframe === '1D' ? 0 : // 1 Day: 显示所有ticks
              selectedTimeframe === '1W' ? 0 : // 1 Week: 显示所有ticks
              selectedTimeframe === '1M' ? 'preserveStartEnd' : // 1 Month: 自动间隔，保留首尾
              selectedTimeframe === '3M' ? 0 : // 3 Months: 显示所有ticks
              selectedTimeframe === '1Y' ? 0 : // 1 Year: 显示所有ticks
              0
            }
            // 传入明确的ticks数组（使用专业X轴方案）
            ticks={
              selectedTimeframe === '1D' ? getAdaptive1DayTicks(chartData) :
              selectedTimeframe === '1W' ? (() => {
                console.log('[Price Chart X轴] 调用getProfessional1WeekTicks');
                console.log('[Price Chart X轴] 当前chartData长度:', chartData.length);
                const ticks = getProfessional1WeekTicks(chartData);
                console.log('[Price Chart X轴] 生成的ticks数量:', ticks.length);
                return ticks;
              })() :
              // 1 Month图：不使用自定义ticks，让Recharts自动处理
              // selectedTimeframe === '1M' ? getProfessional1MonthTicks(chartData) :
              selectedTimeframe === '3M' ? getProfessional3MonthsTicks(chartData) :
              selectedTimeframe === '1Y' ? getProfessional1YearTicks(chartData) :
              undefined
            }
            // 为Day图设置domain，确保显示16:00
            domain={
              selectedTimeframe === '1D' ? (() => {
                if (chartData.length === 0) return undefined;
                
                // 获取第一个数据点的时间
                const firstDate = new Date(chartData[0].date);
                const lastDate = new Date(chartData[chartData.length - 1].date);
                
                // 计算16:00的时间（纽约时间EDT）
                const year = firstDate.getUTCFullYear();
                const month = firstDate.getUTCMonth();
                const day = firstDate.getUTCDate();
                
                // 16:00 EDT = 20:00 UTC
                const endTimeUTC = new Date(Date.UTC(year, month, day, 20, 0, 0));
                
                // 确保domain包含16:00
                return [firstDate.getTime(), Math.max(lastDate.getTime(), endTimeUTC.getTime())];
              })() : undefined
            }
            minTickGap={selectedTimeframe === '1W' ? 20 : selectedTimeframe === '1M' ? 10 : 0} // 1 Week增加最小间隙，避免标签重叠；1 Month稍微增加间隙
            tickMargin={selectedTimeframe === '1W' ? 10 : selectedTimeframe === '1M' ? 8 : 5} // 1 Week增加标签边距；1 Month稍微增加边距
            // 为不同timeframe增加padding，避免标签被裁切
            padding={
              selectedTimeframe === '1D' ? { left: 15, right: 45 } : // Day图：右边增加到45px，确保价格标签完整显示
              selectedTimeframe === '1W' ? { left: 20, right: 50 } : // 1 Week：右边增加到50px，确保最右边点和标签完整显示
              selectedTimeframe === '1M' ? { left: 0, right: 40 } : // 1 Month：右边增加到40px
              selectedTimeframe === '3M' ? { left: 0, right: 40 } : // 3 Months：右边增加到40px
              selectedTimeframe === '1Y' ? { left: 0, right: 45 } : // 1 Year：右边增加到45px
              undefined
            }
          />

          {/* Y轴 - 价格坐标（优化刻度） */}
          <YAxis
            domain={yDomain}
            tick={{ 
              fontSize: 11, 
              fill: '#262626', // 更深的颜色
              fontWeight: '400'
            }}
            axisLine={{ stroke: '#bfbfbf', strokeWidth: 1 }}
            tickLine={{ stroke: '#bfbfbf', strokeWidth: 1 }}
            width={70} // 稍宽一点，容纳更长的标签
            tickFormatter={(value) => {
              // 专业金融图表格式
              if (value >= 1000000) {
                return `$${(value / 1000000).toFixed(2)}M`; // 百万格式
              } else if (value >= 1000) {
                return `$${(value / 1000).toFixed(1)}K`; // 千位格式
              } else if (value >= 100) {
                return `$${value.toFixed(0)}`; // 整数
              } else if (value >= 10) {
                return `$${value.toFixed(1)}`; // 1位小数
              } else if (value >= 1) {
                return `$${value.toFixed(2)}`; // 2位小数
              } else {
                return `$${value.toFixed(3)}`; // 3位小数（低价股）
              }
            }}
            tickCount={6} // 6个刻度，更清晰
            allowDecimals={true}
          />

          {/* 金融终端风格Tooltip */}
          <Tooltip
            content={<CustomTooltip />}
            cursor={{ 
              stroke: 'rgba(22, 119, 255, 0.4)', 
              strokeWidth: 1.2, 
              strokeDasharray: '4 4' 
            }} // 更清晰的hover线，与价格线颜色匹配
          />

          {/* 主价格线 - 专业金融图表风格 */}
          <Line
            type="linear"
            dataKey="close"
            stroke="#1677ff" // 更深的蓝色，更专业
            strokeWidth={selectedTimeframe === '1D' ? 2.5 : 2.2} // Day图稍粗
            dot={false}
            activeDot={{ 
              r: 6, 
              strokeWidth: 2,
              stroke: '#fff',
              fill: '#1677ff',
              strokeOpacity: 0.8
            }}
            name="Price"
            connectNulls={true}
            strokeOpacity={0.9}
          />
          
          {/* === 1 Year 专用：月度分隔竖线 === */}
          {selectedTimeframe === '1Y' && monthPoints.length > 0 && monthPoints.map((point, i) => {
            // 跳过第一个点（已经在最左边）
            if (i === 0) return null;
            
            return (
              <ReferenceLine
                key={`month-line-${i}`}
                x={point.date}
                stroke="#d9d9d9"
                strokeWidth={1}
                strokeDasharray="4 4"
                strokeOpacity={0.4}
              />
            );
          })}
          
          {/* 当前价格标记（最后一个点） - 所有时间范围都显示 */}
          {chartData.length > 0 && (
            <ReferenceDot
              x={chartData[chartData.length - 1].date}
              y={chartData[chartData.length - 1].close}
              r={selectedTimeframe === '1W' ? 8 : 7} // 1 Week图点更大
              fill="#1677ff"
              stroke="#fff"
              strokeWidth={selectedTimeframe === '1W' ? 3 : 2.5} // 1 Week图边框更粗
              strokeOpacity={0.9}
              label={{
                value: `$${chartData[chartData.length - 1].close.toFixed(2)}`,
                position: selectedTimeframe === '1W' ? 'insideRight' : 'right',
                fill: '#1677ff',
                fontSize: selectedTimeframe === '1W' ? 11 : 10,
                fontWeight: '600',
                offset: selectedTimeframe === '1W' ? 15 : 8 // 1 Week图偏移更大
              }}
            />
          )}

          {/* Prev Close参考虚线（如果数据存在） */}
          {prevCloseLine && (
            <ReferenceLine
              y={prevCloseLine}
              stroke="#595959"
              strokeWidth={1.2}
              strokeDasharray="4 4"
              strokeOpacity={0.6}
              label={{
                value: `Prev Close: $${prevCloseLine.toFixed(2)}`,
                position: 'right',
                fill: '#595959',
                fontSize: 9,
                fontWeight: '500',
                opacity: 0.8,
                offset: 5
              }}
            />
          )}

          {/* 52周高低点参考线（如果数据存在） */}
          {fiftyTwoWeekHigh && (
            <ReferenceLine
              y={fiftyTwoWeekHigh}
              stroke="#389e0d"
              strokeWidth={1.2}
              strokeDasharray="4 4"
              strokeOpacity={0.6}
              label={{
                value: `High: $${fiftyTwoWeekHigh.toFixed(2)}`,
                position: 'right',
                fill: '#389e0d',
                fontSize: 9,
                fontWeight: '500',
                opacity: 0.8,
                offset: 5
              }}
            />
          )}
          
          {fiftyTwoWeekLow && (
            <ReferenceLine
              y={fiftyTwoWeekLow}
              stroke="#cf1322"
              strokeWidth={1.2}
              strokeDasharray="4 4"
              strokeOpacity={0.6}
              label={{
                value: `Low: $${fiftyTwoWeekLow.toFixed(2)}`,
                position: 'right',
                fill: '#cf1322',
                fontSize: 9,
                fontWeight: '500',
                opacity: 0.8,
                offset: 5
              }}
            />
          )}

          {/* SMA20/SMA50技术指标线 - 优化显示 */}
          {chartData.some(d => d.sma20 !== undefined && !isNaN(d.sma20)) && chartData.length > 20 && (
            <Line
              type="linear"
              dataKey="sma20"
              stroke="#389e0d" // 更深的绿色
              strokeWidth={1.2} // 加粗，更清晰
              strokeDasharray="4 4" // 更清晰的虚线
              strokeOpacity={0.7} // 提高可见度
              dot={false}
              activeDot={{ r: 4, strokeWidth: 1, stroke: '#fff', fill: '#389e0d' }}
              name="SMA 20"
              connectNulls={true}
            />
          )}
          
          {chartData.some(d => d.sma50 !== undefined && !isNaN(d.sma50)) && chartData.length > 50 && (
            <Line
              type="linear"
              dataKey="sma50"
              stroke="#d46b08" // 更深的橙色
              strokeWidth={1.2} // 加粗，更清晰
              strokeDasharray="4 4" // 更清晰的虚线
              strokeOpacity={0.7} // 提高可见度
              dot={false}
              activeDot={{ r: 4, strokeWidth: 1, stroke: '#fff', fill: '#d46b08' }}
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

  // 渲染RSI图表 - 专业金融软件风格
  const renderRSIChart = () => {
    // 检查是否有有效的RSI数据
    // 放宽条件：只要chartData有数据且部分RSI值有效就显示
    const hasValidRSIData = chartData.some(d => d.rsi !== undefined && !isNaN(d.rsi));
    
    if (chartData.length === 0) {
      return (
        <Empty
          description="No historical data available"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      );
    }
    
    if (!hasValidRSIData) {
      return (
        <Empty
          description="Not enough data to calculate RSI"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      );
    }

    // 过滤出有RSI数据的数据点
    const rsiData = chartData.filter(d => d.rsi !== undefined && !isNaN(d.rsi));
    
    console.log(`[RSI同步] 时间范围: ${selectedTimeframe}, 图表数据点: ${chartData.length}, 有效RSI数据点: ${rsiData.length}`);
    
    // 如果有效RSI数据点太少，显示提示
    if (rsiData.length < 5) {
      console.log(`[RSI同步] 警告: RSI数据点不足 (${rsiData.length} < 5)，可能无法显示完整曲线`);
    }
    
    if (rsiData.length > 0) {
      const rsiValues = rsiData.map(d => d.rsi!).filter(v => !isNaN(v));
      if (rsiValues.length > 0) {
        console.log(`[RSI同步] RSI范围: ${Math.min(...rsiValues).toFixed(1)} - ${Math.max(...rsiValues).toFixed(1)}`);
      }
    }

    // 根据时间范围调整图表高度和边距
    const getChartConfig = () => {
      switch (selectedTimeframe) {
        case '1D':
          return { height: 280, margin: { top: 12, right: 16, left: 8, bottom: 24 } };
        case '1W':
          return { height: 280, margin: { top: 12, right: 16, left: 8, bottom: 24 } };
        case '1M':
          return { height: 300, margin: { top: 12, right: 16, left: 8, bottom: 24 } };
        case '3M':
          return { height: 300, margin: { top: 12, right: 16, left: 8, bottom: 24 } };
        case '1Y':
          return { height: 320, margin: { top: 12, right: 16, left: 8, bottom: 24 } };
        default:
          return { height: 300, margin: { top: 12, right: 16, left: 8, bottom: 24 } };
      }
    };

    const chartConfig = getChartConfig();

    return (
      <ResponsiveContainer width="100%" height={chartConfig.height}>
        <LineChart 
          data={rsiData}
          margin={chartConfig.margin}
        >
          {/* 专业网格线 - 水平网格为主 */}
          <CartesianGrid 
            strokeDasharray="3 3" 
            stroke="#e8e8e8" 
            strokeOpacity={0.4}
            vertical={false}
            horizontalFill={['#fafafa', '#f5f5f5']}
          />
          
          {/* X轴 - 使用与主价格图相同的专业X轴方案 */}
          <XAxis 
            dataKey="date" 
            axisLine={{ stroke: '#bfbfbf', strokeWidth: 1 }}
            tickLine={{ stroke: '#bfbfbf' }}
            height={32}
            // 使用与主图相同的ticks数组
            ticks={
              selectedTimeframe === '1D' ? getAdaptive1DayTicks(chartData) :
              selectedTimeframe === '1W' ? (() => {
                console.log('[RSI Chart X轴] 调用getProfessional1WeekTicks');
                console.log('[RSI Chart X轴] 当前chartData长度:', chartData.length);
                const ticks = getProfessional1WeekTicks(chartData);
                console.log('[RSI Chart X轴] 生成的ticks数量:', ticks.length);
                return ticks;
              })() :
              // 1 Month图：不使用自定义ticks，让Recharts自动处理
              // selectedTimeframe === '1M' ? (() => {
              //   console.log('[RSI Chart X轴] 调用getProfessional1MonthTicks');
              //   console.log('[RSI Chart X轴] 当前chartData长度:', chartData.length);
              //   const ticks = getProfessional1MonthTicks(chartData);
              //   console.log('[RSI Chart X轴] 生成的ticks数量:', ticks.length);
              //   return ticks;
              // })() :
              selectedTimeframe === '3M' ? getProfessional3MonthsTicks(chartData) :
              selectedTimeframe === '1Y' ? getProfessional1YearTicks(chartData) :
              undefined
            }
            interval={
              selectedTimeframe === '1D' ? 0 : // 1 Day: 显示所有ticks
              selectedTimeframe === '1W' ? 0 : // 1 Week: 显示所有ticks
              selectedTimeframe === '1M' ? 'preserveStartEnd' : // 1 Month: 自动间隔，保留首尾
              selectedTimeframe === '3M' ? 0 : // 3 Months: 显示所有ticks
              selectedTimeframe === '1Y' ? 0 : // 1 Year: 显示所有ticks
              0
            }
            tickFormatter={(value) => {
              // 使用与主图相同的专业X轴格式化逻辑
              if (!value) return '';
              
              try {
                const date = new Date(value);
                
                if (isNaN(date.getTime())) {
                  return '';
                }
                
                // 根据时间范围显示不同的专业格式
                switch (selectedTimeframe) {
                  case '1D':
                    // 1 Day: 显示每小时时间标签 (HH:30)，与主图保持一致
                    const utcHour = date.getUTCHours();
                    const minute = date.getUTCMinutes();
                    const nyHour = (utcHour - 4 + 24) % 24;
                    
                    // 显示所有我们生成的时间标签（都是30分钟，如09:30, 10:30等）
                    return `${String(nyHour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
                    
                  case '1W':
                    // 1 Week: 显示清晰的跨天日期格式 (如: 3/16)，与主图保持一致
                    const utcHourW = date.getUTCHours();
                    const nyHourW = (utcHourW - 4 + 24) % 24;
                    const monthW = date.getUTCMonth() + 1; // 月份 (1-12)
                    const dayW = date.getUTCDate(); // 日期 (1-31)
                    
                    // 显示月/日格式，让用户一眼看出是跨多天数据
                    return `${monthW}/${dayW}`;
                    
                  case '1M':
                    // 1 Month: 显示日期节点，使用与主图相同的格式化逻辑
                    const monthM = date.getUTCMonth() + 1;
                    const dayM = date.getUTCDate();
                    
                    // 显示所有传入的ticks（由getProfessional1MonthTicks智能选择）
                    return `${monthM}/${dayM}`;
                    
                  case '3M':
                    // 3 Months: 显示半月节奏日期标签
                    const month3M = date.getUTCMonth() + 1;
                    const day3M = date.getUTCDate();
                    
                    // 显示所有传入的ticks（由getProfessional3MonthsTicks智能选择）
                    return `${month3M}/${day3M}`;
                    
                  case '1Y':
                    // 1 Year: 显示每月1号数字日期标签
                    const monthY = date.getUTCMonth() + 1;
                    const dayY = date.getUTCDate();
                    
                    // 显示所有传入的ticks（由getProfessional1YearTicks智能选择）
                    return `${monthY}/${dayY}`;
                    
                  default:
                    return '';
                }
              } catch (e) {
                console.error('Error formatting date in RSI chart:', e, value);
                return '';
              }
            }}
            tick={{ fontSize: 9, fill: '#595959', fontFamily: "'Inter', 'Segoe UI', sans-serif" }}
            minTickGap={25}
          />
          
          {/* Y轴 - 专业RSI刻度，突出关键水平 */}
          <YAxis 
            domain={[0, 100]} 
            axisLine={{ stroke: '#bfbfbf', strokeWidth: 1 }}
            tickLine={{ stroke: '#bfbfbf' }}
            ticks={[0, 30, 50, 70, 100]}
            tick={({ x, y, payload }) => {
              const value = payload.value;
              let fill = '#595959';
              let fontWeight = '400';
              let fontSize = 9;
              
              // 关键水平突出显示
              if (value === 30) {
                fill = '#389e0d'; // 超卖：绿色
                fontWeight = '600';
                fontSize = 10;
              } else if (value === 70) {
                fill = '#cf1322'; // 超买：红色
                fontWeight = '600';
                fontSize = 10;
              } else if (value === 50) {
                fill = '#8c8c8c'; // 中性：灰色
                fontWeight = '500';
                fontSize = 9;
              }
              
              return (
                <text 
                  x={x} 
                  y={y} 
                  dy={4} 
                  textAnchor="end" 
                  fill={fill} 
                  fontSize={fontSize} 
                  fontWeight={fontWeight}
                  fontFamily="'Inter', 'Segoe UI', sans-serif"
                >
                  {value}
                </text>
              );
            }}
            width={36}
          />
          
          {/* Tooltip - 专业简洁 */}
          <Tooltip 
            contentStyle={{
              backgroundColor: 'rgba(255, 255, 255, 0.98)',
              border: '1px solid #d9d9d9',
              borderRadius: '4px',
              padding: '6px 10px',
              fontSize: '10px',
              fontFamily: "'Inter', 'Segoe UI', sans-serif",
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
              backdropFilter: 'blur(4px)'
            }}
            formatter={(value) => {
              const rsiValue = parseFloat(value as string);
              let color = '#595959';
              let status = '';
              
              if (rsiValue >= 70) {
                color = '#cf1322'; // 超买：红色
                status = ' (Overbought)';
              } else if (rsiValue <= 30) {
                color = '#389e0d'; // 超卖：绿色
                status = ' (Oversold)';
              } else if (rsiValue > 50) {
                color = '#722ed1'; // 偏强：紫色
                status = ' (Bullish)';
              } else {
                color = '#722ed1'; // 偏弱：紫色
                status = ' (Bearish)';
              }
              
              return [
                <span style={{ color, fontWeight: '600' }}>
                  {rsiValue.toFixed(1)}{status}
                </span>, 
                'RSI'
              ];
            }}
            labelFormatter={(label) => {
              try {
                const date = new Date(label);
                
                // 使用与主图一致的专业时间格式
                switch (selectedTimeframe) {
                  case '1D':
                    // 1 Day: 显示纽约时间 HH:MM
                    const utcHour = date.getUTCHours();
                    const minute = date.getUTCMinutes();
                    const nyHour = (utcHour - 4 + 24) % 24; // UTC转EDT
                    return `${String(nyHour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
                    
                  case '1W':
                    // 1 Week: 显示纽约时间的日期和时间格式 (如: 3/16 09:30)
                    // 使用统一的纽约时间格式化函数
                    return formatAsNewYorkTime(date, true);
                    
                  case '1M':
                    // 1 Month: 显示日期 MM/DD
                    const monthM = date.getUTCMonth() + 1;
                    const dayM = date.getUTCDate();
                    return `${monthM}/${dayM}`;
                    
                  case '3M':
                    // 3 Months: 显示日期 MM/DD
                    const month3M = date.getUTCMonth() + 1;
                    const day3M = date.getUTCDate();
                    return `${month3M}/${day3M}`;
                    
                  case '1Y':
                    // 1 Year: 显示数字日期 MM/DD
                    const monthY = date.getUTCMonth() + 1;
                    const dayY = date.getUTCDate();
                    return `${monthY}/${dayY}`;
                    
                  default:
                    return label;
                }
              } catch {
                return label;
              }
            }}
            cursor={{ 
              stroke: '#722ed1', 
              strokeWidth: 1, 
              strokeOpacity: 0.2,
              strokeDasharray: "3 3"
            }}
          />
          
          {/* 图例 - 专业简洁 */}
          <Legend 
            wrapperStyle={{
              paddingTop: '6px',
              paddingBottom: '2px',
              fontSize: '9px',
              color: '#595959',
              fontFamily: "'Inter', 'Segoe UI', sans-serif"
            }}
            iconSize={7}
            iconType="plainline"
            align="center"
            verticalAlign="bottom"
            height={28}
          />
          
          {/* RSI主线 - 专业金融图表风格 */}
          <Line 
            type="monotone" 
            dataKey="rsi" 
            stroke="#722ed1" 
            strokeWidth={1.6}
            strokeOpacity={0.95}
            dot={false}
            activeDot={{ 
              r: 5, 
              strokeWidth: 1.5, 
              stroke: '#fff', 
              fill: '#722ed1',
              strokeOpacity: 0.9
            }}
            name="RSI (14)"
            connectNulls={true}
          />
          
          {/* 超买参考线 (70) - 专业虚线 */}
          <Line 
            type="monotone" 
            dataKey={70} 
            stroke="#cf1322" 
            strokeWidth={1}
            strokeDasharray="4 4" 
            strokeOpacity={0.7}
            dot={false}
            name="Overbought (70)"
          />
          
          {/* 中性参考线 (50) - 专业虚线 */}
          <Line 
            type="monotone" 
            dataKey={50} 
            stroke="#8c8c8c" 
            strokeWidth={0.8}
            strokeDasharray="3 3" 
            strokeOpacity={0.5}
            dot={false}
            name="Neutral (50)"
          />
          
          {/* 超卖参考线 (30) - 专业虚线 */}
          <Line 
            type="monotone" 
            dataKey={30} 
            stroke="#389e0d" 
            strokeWidth={1}
            strokeDasharray="4 4" 
            strokeOpacity={0.7}
            dot={false}
            name="Oversold (30)"
          />
          
          {/* 区域着色 - 专业RSI区间背景 */}
          <ReferenceArea 
            y1={70} 
            y2={100} 
            fill="#cf1322" 
            fillOpacity={0.05} 
            stroke="none"
            label={{ 
              value: "Overbought", 
              position: "insideTopRight",
              fill: "#cf1322",
              fontSize: 8,
              fontWeight: 500
            }}
          />
          <ReferenceArea 
            y1={30} 
            y2={70} 
            fill="#722ed1" 
            fillOpacity={0.03} 
            stroke="none"
          />
          <ReferenceArea 
            y1={0} 
            y2={30} 
            fill="#389e0d" 
            fillOpacity={0.05} 
            stroke="none"
            label={{ 
              value: "Oversold", 
              position: "insideBottomRight",
              fill: "#389e0d",
              fontSize: 8,
              fontWeight: 500
            }}
          />
        </LineChart>
      </ResponsiveContainer>
    );
  };


  // 初始化加载数据 + timeframe切换时重新加载
  useEffect(() => {
    if (symbol) {
      loadStockData();
      loadBacktestHistory();
      loadHistoricalPrices();
    }
  }, [symbol, selectedTimeframe]);

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

      {/* 核心指标卡片 - 第一行 */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        {/* Day High */}
        <Col xs={24} sm={12} md={4}>
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

        {/* Day Low */}
        <Col xs={24} sm={12} md={4}>
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

        {/* Prev Close */}
        <Col xs={24} sm={12} md={4}>
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

        {/* Market Cap */}
        <Col xs={24} sm={12} md={4}>
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

        {/* 52W High */}
        <Col xs={24} sm={12} md={4}>
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
                <ArrowUpOutlined style={{ marginRight: '6px', fontSize: '11px', color: '#389e0d' }} />
                52W High
              </div>
              <div style={{
                fontSize: '22px',
                fontWeight: '700',
                color: '#1f1f1f',
                fontFeatureSettings: '"tnum"',
                lineHeight: '1.2'
              }}>
                {(() => {
                  // 优先使用后端返回的yearHigh
                  if (stockData?.yearHigh !== undefined && stockData.yearHigh !== null) {
                    return `$${safeToFixed(stockData.yearHigh, 2)}`;
                  }
                  // 备选：从chartData计算
                  if (chartData.length === 0) return '--';
                  const dataToUse = selectedTimeframe === '1Y' ? chartData : chartData.slice(-252);
                  if (dataToUse.length === 0) return '--';
                  const fiftyTwoWeekHigh = Math.max(...dataToUse.map(d => d.high));
                  return `$${safeToFixed(fiftyTwoWeekHigh, 2)}`;
                })()}
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      {/* 核心指标卡片 - 第二行 */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        {/* 52W Low */}
        <Col xs={24} sm={12} md={4}>
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
                <ArrowDownOutlined style={{ marginRight: '6px', fontSize: '11px', color: '#cf1322' }} />
                52W Low
              </div>
              <div style={{
                fontSize: '22px',
                fontWeight: '700',
                color: '#1f1f1f',
                fontFeatureSettings: '"tnum"',
                lineHeight: '1.2'
              }}>
                {(() => {
                  // 优先使用后端返回的yearLow
                  if (stockData?.yearLow !== undefined && stockData.yearLow !== null) {
                    return `$${safeToFixed(stockData.yearLow, 2)}`;
                  }
                  // 备选：从chartData计算
                  if (chartData.length === 0) return '--';
                  const dataToUse = selectedTimeframe === '1Y' ? chartData : chartData.slice(-252);
                  if (dataToUse.length === 0) return '--';
                  const fiftyTwoWeekLow = Math.min(...dataToUse.map(d => d.low));
                  return `$${safeToFixed(fiftyTwoWeekLow, 2)}`;
                })()}
              </div>
            </div>
          </Card>
        </Col>

        {/* Volume */}
        <Col xs={24} sm={12} md={4}>
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
                <BarChartOutlined style={{ marginRight: '6px', fontSize: '11px', color: '#1890ff' }} />
                Volume
              </div>
              <div style={{
                fontSize: '22px',
                fontWeight: '700',
                color: '#1f1f1f',
                fontFeatureSettings: '"tnum"',
                lineHeight: '1.2'
              }}>
                {(() => {
                  // 优先使用stockData.volume（当日总成交量）
                  if (stockData.volume !== null && stockData.volume !== undefined && stockData.volume > 0) {
                    const volume = stockData.volume;
                    if (volume >= 1000000) {
                      return `${(volume / 1000000).toFixed(1)}M`;
                    } else if (volume >= 1000) {
                      return `${(volume / 1000).toFixed(0)}K`;
                    } else {
                      return volume.toFixed(0);
                    }
                  }
                  
                  // 备选：使用chartData中最后一个数据点的volume
                  if (chartData.length === 0) return '--';
                  const lastData = chartData[chartData.length - 1];
                  if (!lastData || lastData.volume === undefined || lastData.volume === 0) return '--';
                  
                  const volume = lastData.volume;
                  if (volume >= 1000000) {
                    return `${(volume / 1000000).toFixed(1)}M`;
                  } else if (volume >= 1000) {
                    return `${(volume / 1000).toFixed(0)}K`;
                  } else {
                    return volume.toFixed(0);
                  }
                })()}
              </div>
            </div>
          </Card>
        </Col>

        {/* Avg Volume */}
        <Col xs={24} sm={12} md={4}>
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
                <BarChartOutlined style={{ marginRight: '6px', fontSize: '11px', color: '#8c8c8c' }} />
                Avg Volume
              </div>
              <div style={{
                fontSize: '22px',
                fontWeight: '700',
                color: '#8c8c8c',
                fontFeatureSettings: '"tnum"',
                lineHeight: '1.2'
              }}>
                N/A
              </div>
              <div style={{
                fontSize: '9px',
                color: '#bfbfbf',
                fontStyle: 'italic',
                marginTop: '4px'
              }}>
                Not available from current data source
              </div>
            </div>
          </Card>
        </Col>

        {/* 新增：Range Position */}
        <Col xs={24} sm={12} md={4}>
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
                <LineChartOutlined style={{ marginRight: '6px', fontSize: '11px', color: '#fa8c16' }} />
                Range Position
              </div>
              <div style={{
                fontSize: '22px',
                fontWeight: '700',
                fontFeatureSettings: '"tnum"',
                lineHeight: '1.2'
              }}>
                {(() => {
                  // 优先使用后端返回的yearHigh/yearLow
                  const yearHigh = stockData?.yearHigh;
                  const yearLow = stockData?.yearLow;
                  const currentPrice = stockData?.price;
                  
                  // 使用统一的函数计算
                  const rangePosition = calculateRangePosition(currentPrice, yearHigh, yearLow);
                  
                  if (rangePosition.percentage === null) {
                    return '--';
                  }
                  
                  // 根据标签设置颜色
                  let color = '#fa8c16'; // 默认橙色
                  if (rangePosition.label === 'Near 52W High') {
                    color = '#52c41a'; // 绿色
                  } else if (rangePosition.label === 'Near 52W Low') {
                    color = '#ff4d4f'; // 红色
                  } else if (rangePosition.label === 'Upper range') {
                    color = '#73d13d'; // 浅绿色
                  } else if (rangePosition.label === 'Lower range') {
                    color = '#ff7875'; // 浅红色
                  }
                  
                  return (
                    <span style={{ color }}>
                      {rangePosition.label}
                    </span>
                  );
                })()}
              </div>
              <div style={{
                fontSize: '9px',
                color: '#bfbfbf',
                fontStyle: 'italic',
                marginTop: '4px'
              }}>
                {(() => {
                  // 优先使用后端返回的yearHigh/yearLow
                  const yearHigh = stockData?.yearHigh;
                  const yearLow = stockData?.yearLow;
                  const currentPrice = stockData?.price;
                  
                  // 使用统一的函数计算
                  const rangePosition = calculateRangePosition(currentPrice, yearHigh, yearLow);
                  
                  if (rangePosition.percentage === null) {
                    return 'No data';
                  }
                  
                  return `${safeToFixed(rangePosition.percentage, 1)}% of range`;
                })()}
              </div>
            </div>
          </Card>
        </Col>

        {/* Rel Volume */}
        <Col xs={24} sm={12} md={4}>
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
                <BarChartOutlined style={{ marginRight: '6px', fontSize: '11px', color: '#8c8c8c' }} />
                Rel Volume
              </div>
              <div style={{
                fontSize: '22px',
                fontWeight: '700',
                color: '#8c8c8c',
                fontFeatureSettings: '"tnum"',
                lineHeight: '1.2'
              }}>
                N/A
              </div>
              <div style={{
                fontSize: '9px',
                color: '#bfbfbf',
                fontStyle: 'italic',
                marginTop: '4px'
              }}>
                Not available from current data source
              </div>
            </div>
          </Card>
        </Col>
      </Row>


      {/* 图表区域 - 强化 */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col span={24}>
          {/* 图表数据延迟提示 */}
          <div style={{ 
            marginBottom: '8px', 
            fontSize: '12px', 
            color: '#666',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            <InfoCircleOutlined style={{ fontSize: '11px' }} />
            <span>Latest chart data point is delayed by 15 minutes</span>
          </div>
          
          <Card
            title={
              <span style={{ fontSize: '16px', fontWeight: '600', color: '#1f1f1f' }}>
                Price Chart
              </span>
            }
            extra={
              <Space size="small">
                {/* 图表数据统计：基于图表可见数据计算 */}
                {(() => {
                  // 渲染图表统计信息
                  const renderChartStats = () => {
                    if (chartData.length > 0 && chartData.length >= 2) {
                      const firstClose = chartData[0].close;
                      const lastClose = chartData[chartData.length - 1].close;
                      const currentPrice = lastClose; // 图表最后一个数据点的收盘价
                      
                      // 对于1 Day图：直接使用顶部summary的值
                      // 对于其他timeframe：使用图表自身数据计算
                      let change = null;
                      let changePercent = null;
                      let changeIsPositive = false;
                      let periodChange = null;
                      let periodChangePercent = null;
                      let periodChangeIsPositive = false;
                      
                      if (selectedTimeframe === '1D') {
                        // 1 Day图：直接使用顶部summary的值
                        // Change = 顶部summary的change
                        // Period Change = 顶部summary的changePercent
                        if (stockData) {
                          change = stockData.change !== undefined ? stockData.change : null;
                          changePercent = stockData.changePercent !== undefined ? stockData.changePercent : null;
                          changeIsPositive = change !== null ? change >= 0 : false;
                          
                          // Period Change也使用相同的值（与顶部summary一致）
                          periodChange = change;
                          periodChangePercent = changePercent;
                          periodChangeIsPositive = changeIsPositive;
                        }
                      } else if (selectedTimeframe === '1M' || selectedTimeframe === '3M' || selectedTimeframe === '1Y') {
                        // 1M/3M/1Y图：使用图表自身数据计算，但Change和Period Change使用相同逻辑
                        // 对于月线/季线/年线图，Change应该显示整个时间段的变化
                        // 而不是日变化
                        
                        // 计算 Change (基于 firstClose)
                        if (firstClose > 0) {
                          change = lastClose - firstClose;
                          changePercent = (change / firstClose) * 100;
                          changeIsPositive = change >= 0;
                        }
                        
                        // Period Change 与 Change 相同（都是整个时间段的变化）
                        periodChange = change;
                        periodChangePercent = changePercent;
                        periodChangeIsPositive = changeIsPositive;
                      } else {
                        // 其他timeframe（1W）：使用图表自身数据计算
                        // 获取 prevClose：倒数第二个数据点的收盘价
                        const prevClose = chartData.length >= 2 ? chartData[chartData.length - 2].close : null;
                        
                        // 计算 Change (基于 prevClose)
                        if (prevClose && prevClose > 0) {
                          change = lastClose - prevClose;
                          changePercent = (change / prevClose) * 100;
                          changeIsPositive = change >= 0;
                        }
                        
                        // 计算 Period Change (基于 firstClose)
                        if (firstClose > 0) {
                          periodChange = lastClose - firstClose;
                          periodChangePercent = (periodChange / firstClose) * 100;
                          periodChangeIsPositive = periodChange >= 0;
                        }
                      }
                      
                      return (
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '20px', // 增加间距以容纳标签
                          marginRight: '20px',
                          padding: '4px 0',
                          fontFamily: "'SF Mono', Monaco, 'Courier New', monospace"
                        }}>
                          {/* Last Bar Close 组 */}
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                            <div style={{
                              fontSize: '10px',
                              color: '#8c8c8c',
                              fontWeight: '500',
                              marginBottom: '2px',
                              letterSpacing: '0.3px'
                            }}>
                              Last Bar Close
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
                              color: change !== null ? (changeIsPositive ? '#52c41a' : '#ff4d4f') : '#8c8c8c',
                              backgroundColor: change !== null ? (changeIsPositive ? 'rgba(82, 196, 26, 0.05)' : 'rgba(255, 77, 79, 0.05)') : 'transparent',
                              padding: '2px 8px',
                              borderRadius: '3px',
                              minWidth: '55px',
                              textAlign: 'center',
                              border: change !== null ? `1px solid ${changeIsPositive ? 'rgba(82, 196, 26, 0.15)' : 'rgba(255, 77, 79, 0.15)'}` : '1px solid #f0f0f0'
                            }}>
                              {change !== null ? `${changeIsPositive ? '+' : ''}${change.toFixed(2)}` : 'N/A'}
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
                              color: periodChange !== null ? (periodChangeIsPositive ? '#52c41a' : '#ff4d4f') : '#8c8c8c',
                              backgroundColor: periodChange !== null ? (periodChangeIsPositive ? 'rgba(82, 196, 26, 0.05)' : 'rgba(255, 77, 79, 0.05)') : 'transparent',
                              padding: '2px 8px',
                              borderRadius: '3px',
                              minWidth: '65px',
                              textAlign: 'center',
                              border: periodChange !== null ? `1px solid ${periodChangeIsPositive ? 'rgba(82, 196, 26, 0.15)' : 'rgba(255, 77, 79, 0.15)'}` : '1px solid #f0f0f0'
                            }}>
                              {periodChangePercent !== null ? `${periodChangeIsPositive ? '+' : ''}${periodChangePercent.toFixed(2)}%` : 'N/A'}
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  };
                  
                  return renderChartStats();
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

      {/* Signal Summary - 信号摘要 */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col span={24}>
          <Card
            title={
              <span style={{ fontSize: '16px', fontWeight: '600', color: '#1f1f1f' }}>
                Signal Summary
              </span>
            }
            style={{
              border: '1px solid #e8e8e8',
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
            }}
            bodyStyle={{ padding: '20px' }}
          >
            <Row gutter={[24, 16]}>
              {/* Trend Bias */}
              <Col xs={24} sm={12} md={8}>
                <div style={{
                  padding: '16px',
                  border: '1px solid #f0f0f0',
                  borderRadius: '8px',
                  background: '#fafafa'
                }}>
                  <div style={{
                    fontSize: '12px',
                    color: '#595959',
                    fontWeight: '600',
                    marginBottom: '8px',
                    display: 'flex',
                    alignItems: 'center'
                  }}>
                    <LineChartOutlined style={{ marginRight: '8px', fontSize: '12px' }} />
                    Trend Bias
                  </div>
                  <div style={{
                    fontSize: '18px',
                    fontWeight: '700',
                    marginBottom: '4px'
                  }}>
                    {(() => {
                      // 基于Alpaca真实数据的趋势偏差计算
                      // 需要足够的数据进行可靠分析
                      const hasEnoughData = chartData.length >= 20; // 至少20个数据点
                      
                      if (!stockData.price || !hasEnoughData) {
                        return <span style={{ color: '#8c8c8c' }}>Insufficient Data</span>;
                      }
                      
                      // 使用Alpaca数据：当前价格和图表数据
                      const currentPrice = stockData.price; // Alpaca当前最新价
                      const lastChartData = chartData[chartData.length - 1];
                      
                      // 获取技术指标（基于Alpaca历史数据计算）
                      const sma20 = lastChartData?.sma20;
                      const sma50 = lastChartData?.sma50;
                      const rsi = lastChartData?.rsi;
                      
                      // 检查技术指标是否有效（基于Alpaca数据计算）
                      // 放宽条件：允许部分指标缺失，使用降级逻辑
                      const hasBasicData = chartData.length >= 20 && stockData.price;
                      const hasSMA20 = sma20 !== undefined && !isNaN(sma20);
                      const hasSMA50 = sma50 !== undefined && !isNaN(sma50);
                      const hasRSI = rsi !== undefined && !isNaN(rsi);
                      
                      if (!hasBasicData) {
                        return <span style={{ color: '#8c8c8c' }}>Insufficient Data</span>;
                      }
                      
                      // 如果没有RSI，使用SMA-only的趋势判断
                      if (!hasRSI) {
                        // 降级逻辑：只基于SMA判断趋势
                        if (hasSMA20 && hasSMA50) {
                          // 继续下面的趋势分析，但跳过RSI相关部分
                        } else {
                          return <span style={{ color: '#8c8c8c' }}>Need More Data</span>;
                        }
                      }
                      
                      // 基于Alpaca数据的完整趋势分析
                      let bullishScore = 0;
                      let bearishScore = 0;
                      
                      // 1. 价格与移动平均线比较（基于Alpaca数据）
                      if (hasSMA20) {
                        if (currentPrice > sma20!) bullishScore += 1;
                        else if (currentPrice < sma20!) bearishScore += 1;
                      }
                      
                      if (hasSMA50) {
                        if (currentPrice > sma50!) bullishScore += 1;
                        else if (currentPrice < sma50!) bearishScore += 1;
                      }
                      
                      // 2. 移动平均线交叉（基于Alpaca数据）
                      if (hasSMA20 && hasSMA50) {
                        if (sma20! > sma50!) bullishScore += 1;
                        else if (sma20! < sma50!) bearishScore += 1;
                      }
                      
                      // 3. RSI状态（基于Alpaca数据计算）
                      if (hasRSI) {
                        if (rsi > 70) bearishScore += 1; // 超买 - 看跌信号
                        else if (rsi < 30) bullishScore += 1; // 超卖 - 看涨信号
                        else if (rsi > 50) bullishScore += 0.5; // 偏强
                        else bearishScore += 0.5; // 偏弱
                      } else {
                        // 没有RSI时，给予中性评分
                        bullishScore += 0.5;
                        bearishScore += 0.5;
                      }
                      
                      // 4. 52周位置（基于Alpaca的yearHigh/yearLow数据）
                      if (stockData.yearHigh && stockData.yearLow) {
                        const rangePosition = calculateRangePosition(currentPrice, stockData.yearHigh, stockData.yearLow);
                        if (rangePosition.percentage !== null) {
                          if (rangePosition.percentage > 80) bearishScore += 0.5; // 接近52周高点
                          else if (rangePosition.percentage < 20) bullishScore += 0.5; // 接近52周低点
                        }
                      }
                      
                      // 综合判断（基于Alpaca数据）
                      const scoreDifference = bullishScore - bearishScore;
                      
                      if (scoreDifference > 1.5) {
                        return (
                          <span style={{ color: '#52c41a' }}>
                            <ArrowUpOutlined style={{ marginRight: '6px' }} />
                            Strong Bullish
                          </span>
                        );
                      } else if (scoreDifference > 0.5) {
                        return (
                          <span style={{ color: '#52c41a', opacity: 0.8 }}>
                            <ArrowUpOutlined style={{ marginRight: '6px' }} />
                            Bullish
                          </span>
                        );
                      } else if (scoreDifference < -1.5) {
                        return (
                          <span style={{ color: '#ff4d4f' }}>
                            <ArrowDownOutlined style={{ marginRight: '6px' }} />
                            Strong Bearish
                          </span>
                        );
                      } else if (scoreDifference < -0.5) {
                        return (
                          <span style={{ color: '#ff4d4f', opacity: 0.8 }}>
                            <ArrowDownOutlined style={{ marginRight: '6px' }} />
                            Bearish
                          </span>
                        );
                      } else {
                        return (
                          <span style={{ color: '#8c8c8c' }}>
                            Neutral
                          </span>
                        );
                      }
                    })()}
                  </div>
                  <div style={{
                    fontSize: '11px',
                    color: '#8c8c8c',
                    lineHeight: '1.4'
                  }}>
                    {(() => {
                      // 基于Alpaca数据的趋势分析描述 - 统一状态机
                      
                      // 1. 检查基本数据
                      const hasEnoughData = chartData.length >= 20;
                      
                      if (!stockData.price || !hasEnoughData) {
                        return 'Need more Alpaca data for trend analysis';
                      }
                      
                      // 2. 检查技术指标
                      const lastChartData = chartData[chartData.length - 1];
                      const sma20 = lastChartData?.sma20;
                      const sma50 = lastChartData?.sma50;
                      const rsi = lastChartData?.rsi;
                      
                      const hasSMA20 = sma20 !== undefined && !isNaN(sma20);
                      const hasSMA50 = sma50 !== undefined && !isNaN(sma50);
                      const hasRSI = rsi !== undefined && !isNaN(rsi);
                      
                      // 3. 判断状态并返回对应文案
                      if (!hasSMA20 && !hasSMA50 && !hasRSI) {
                        return 'Unable to derive trend from current Alpaca data';
                      }
                      
                      if (hasSMA20 || hasSMA50 || hasRSI) {
                        // 成功状态：根据实际使用的指标返回说明
                        const usedIndicators = [];
                        if (hasSMA20) usedIndicators.push('SMA20');
                        if (hasSMA50) usedIndicators.push('SMA50');
                        if (hasRSI) usedIndicators.push('RSI');
                        
                        return `Macro trend direction based on ${usedIndicators.join(', ')} alignment`;
                      }
                      
                      // 理论上不会走到这里，但保持安全
                      return 'Calculating Alpaca-based indicators...';
                    })()}
                  </div>
                </div>
              </Col>

              {/* RSI State */}
              <Col xs={24} sm={12} md={8}>
                <div style={{
                  padding: '16px',
                  border: '1px solid #f0f0f0',
                  borderRadius: '8px',
                  background: '#fafafa'
                }}>
                  <div style={{
                    fontSize: '12px',
                    color: '#595959',
                    fontWeight: '600',
                    marginBottom: '8px',
                    display: 'flex',
                    alignItems: 'center'
                  }}>
                    <LineChartOutlined style={{ marginRight: '8px', fontSize: '12px' }} />
                    RSI State
                  </div>
                  <div style={{
                    fontSize: '18px',
                    fontWeight: '700',
                    marginBottom: '4px'
                  }}>
                    {(() => {
                      // 基于Alpaca数据的RSI状态分析 - 统一数据源
                      // 与RSI图使用相同的数据过滤逻辑
                      
                      // 1. 获取所有有效RSI数据点（与RSI图相同）
                      const validRSIPoints = chartData.filter(
                        d => d.rsi !== undefined && d.rsi !== null && !isNaN(d.rsi)
                      );
                      
                      // 2. 检查数据是否足够计算RSI(14)
                      const hasEnoughDataForRSI = chartData.length >= 15;
                      
                      if (!hasEnoughDataForRSI) {
                        return <span style={{ color: '#8c8c8c' }}>Insufficient Data</span>;
                      }
                      
                      // 3. 检查是否有有效RSI数据
                      if (validRSIPoints.length === 0) {
                        // 数据足够但没有有效RSI值
                        return <span style={{ color: '#8c8c8c' }}>RSI Calculation Failed</span>;
                      }
                      
                      // 4. 获取最后一个有效RSI点（与RSI图数据源一致）
                      const latestValidRSIPoint = validRSIPoints[validRSIPoints.length - 1];
                      const latestRSI = latestValidRSIPoint?.rsi;
                      
                      // 5. 基于最后一个有效RSI值的状态判断
                      if (latestRSI === undefined || isNaN(latestRSI)) {
                        // 理论上不会走到这里，因为validRSIPoints.length > 0
                        return <span style={{ color: '#8c8c8c' }}>RSI Calculation Failed</span>;
                      }
                      
                      if (latestRSI >= 70) {
                        return (
                          <span style={{ color: '#cf1322' }}>
                            Overbought
                          </span>
                        );
                      } else if (latestRSI <= 30) {
                        return (
                          <span style={{ color: '#389e0d' }}>
                            Oversold
                          </span>
                        );
                      } else if (latestRSI > 55) {
                        return (
                          <span style={{ color: '#52c41a', opacity: 0.8 }}>
                            Bullish
                          </span>
                        );
                      } else if (latestRSI < 45) {
                        return (
                          <span style={{ color: '#ff4d4f', opacity: 0.8 }}>
                            Bearish
                          </span>
                        );
                      } else {
                        return (
                          <span style={{ color: '#8c8c8c' }}>
                            Neutral
                          </span>
                        );
                      }
                    })()}
                  </div>
                  <div style={{
                    fontSize: '11px',
                    color: '#8c8c8c',
                    lineHeight: '1.4'
                  }}>
                    {(() => {
                      // RSI值显示，基于Alpaca数据 - 统一数据源
                      // 与RSI图使用相同的数据过滤逻辑
                      
                      // 1. 获取所有有效RSI数据点（与RSI图相同）
                      const validRSIPoints = chartData.filter(
                        d => d.rsi !== undefined && d.rsi !== null && !isNaN(d.rsi)
                      );
                      
                      // 2. 检查数据是否足够计算RSI(14)
                      const hasEnoughDataForRSI = chartData.length >= 15;
                      
                      if (!hasEnoughDataForRSI) {
                        return 'Need at least 15 Alpaca data points for RSI';
                      }
                      
                      // 3. 检查是否有有效RSI数据
                      if (validRSIPoints.length === 0) {
                        // 数据足够但没有有效RSI值
                        return 'Unable to calculate RSI from current Alpaca data';
                      }
                      
                      // 4. 获取最后一个有效RSI点（与RSI图数据源一致）
                      const latestValidRSIPoint = validRSIPoints[validRSIPoints.length - 1];
                      const latestRSI = latestValidRSIPoint?.rsi;
                      
                      // 5. 成功状态：显示说明
                      return `RSI(14) based on current timeframe close data`;
                    })()}
                  </div>
                </div>
              </Col>

              {/* 52W Position */}
              <Col xs={24} sm={12} md={8}>
                <div style={{
                  padding: '16px',
                  border: '1px solid #f0f0f0',
                  borderRadius: '8px',
                  background: '#fafafa'
                }}>
                  <div style={{
                    fontSize: '12px',
                    color: '#595959',
                    fontWeight: '600',
                    marginBottom: '8px',
                    display: 'flex',
                    alignItems: 'center'
                  }}>
                    <LineChartOutlined style={{ marginRight: '8px', fontSize: '12px' }} />
                    52W Position
                  </div>
                  <div style={{
                    fontSize: '18px',
                    fontWeight: '700',
                    marginBottom: '4px'
                  }}>
                    {(() => {
                      // 基于Alpaca数据的52周位置分析
                      // 需要Alpaca提供的52周高点和低点数据
                      const yearHigh = stockData?.yearHigh; // 应该来自Alpaca
                      const yearLow = stockData?.yearLow;   // 应该来自Alpaca
                      const currentPrice = stockData?.price; // Alpaca当前价
                      
                      // 检查Alpaca数据是否完整
                      if (!currentPrice || !yearHigh || !yearLow) {
                        return <span style={{ color: '#8c8c8c' }}>Alpaca Data Needed</span>;
                      }
                      
                      // 使用统一的函数计算（基于Alpaca数据）
                      const rangePosition = calculateRangePosition(currentPrice, yearHigh, yearLow);
                      
                      if (rangePosition.percentage === null) {
                        return <span style={{ color: '#8c8c8c' }}>Invalid Data</span>;
                      }
                      
                      // 根据标签设置颜色
                      let color = '#fa8c16'; // 默认橙色 - Mid-range
                      if (rangePosition.label === 'Near 52W High') {
                        color = '#52c41a'; // 绿色
                      } else if (rangePosition.label === 'Near 52W Low') {
                        color = '#ff4d4f'; // 红色
                      } else if (rangePosition.label === 'Upper range') {
                        color = '#73d13d'; // 浅绿色
                      } else if (rangePosition.label === 'Lower range') {
                        color = '#ff7875'; // 浅红色
                      }
                      
                      return (
                        <span style={{ color }}>
                          {rangePosition.label}
                        </span>
                      );
                    })()}
                  </div>
                  <div style={{
                    fontSize: '11px',
                    color: '#8c8c8c',
                    lineHeight: '1.4'
                  }}>
                    {(() => {
                      // 基于Alpaca数据的52周位置描述
                      const yearHigh = stockData?.yearHigh;
                      const yearLow = stockData?.yearLow;
                      const currentPrice = stockData?.price;
                      
                      // 检查Alpaca数据
                      if (!currentPrice || !yearHigh || !yearLow) {
                        return 'Requires Alpaca 52W high/low data';
                      }
                      
                      // 使用统一的函数计算
                      const rangePosition = calculateRangePosition(currentPrice, yearHigh, yearLow);
                      
                      if (rangePosition.percentage === null) {
                        return 'Invalid Alpaca data for calculation';
                      }
                      
                      return `Position: ${safeToFixed(rangePosition.percentage, 1)}% (Alpaca 52W: $${safeToFixed(yearLow, 2)}-$${safeToFixed(yearHigh, 2)})`;
                    })()}
                  </div>
                </div>
              </Col>

              {/* Price vs SMA20 */}
              <Col xs={24} sm={12} md={6}>
                <div style={{
                  padding: '16px',
                  border: '1px solid #f0f0f0',
                  borderRadius: '8px',
                  background: '#fafafa'
                }}>
                  <div style={{
                    fontSize: '12px',
                    color: '#595959',
                    fontWeight: '600',
                    marginBottom: '8px'
                  }}>
                    Price vs SMA20
                  </div>
                  <div style={{
                    fontSize: '18px',
                    fontWeight: '700',
                    marginBottom: '4px'
                  }}>
                    {(() => {
                      // 基于Alpaca数据的Price vs SMA20比较
                      // 需要足够的数据计算SMA20
                      const hasEnoughDataForSMA20 = chartData.length >= 20;
                      
                      if (!stockData.price || !hasEnoughDataForSMA20) {
                        return <span style={{ color: '#8c8c8c' }}>Need Data</span>;
                      }
                      
                      const lastChartData = chartData[chartData.length - 1];
                      const currentPrice = stockData.price; // Alpaca当前价
                      const sma20 = lastChartData?.sma20; // 基于Alpaca数据计算的SMA20
                      
                      // 检查SMA20是否基于Alpaca数据有效计算
                      if (sma20 === undefined || isNaN(sma20)) {
                        return <span style={{ color: '#8c8c8c' }}>Calculating...</span>;
                      }
                      
                      // 基于Alpaca数据的比较
                      const diff = currentPrice - sma20;
                      const diffPercent = (diff / sma20) * 100;
                      
                      if (diff > 0) {
                        return (
                          <span style={{ color: '#52c41a' }}>
                            Above (+{safeToFixed(diffPercent, 2)}%)
                          </span>
                        );
                      } else if (diff < 0) {
                        return (
                          <span style={{ color: '#ff4d4f' }}>
                            Below ({safeToFixed(diffPercent, 2)}%)
                          </span>
                        );
                      } else {
                        return (
                          <span style={{ color: '#8c8c8c' }}>
                            Equal
                          </span>
                        );
                      }
                    })()}
                  </div>
                  <div style={{
                    fontSize: '11px',
                    color: '#8c8c8c',
                    lineHeight: '1.4'
                  }}>
                    {(() => {
                      // 基于Alpaca数据的Price vs SMA20信息
                      const hasEnoughDataForSMA20 = chartData.length >= 20;
                      
                      if (!stockData.price || !hasEnoughDataForSMA20) {
                        return 'Need ≥20 Alpaca points for SMA20';
                      }
                      
                      const lastChartData = chartData[chartData.length - 1];
                      const currentPrice = stockData.price;
                      const sma20 = lastChartData?.sma20;
                      
                      if (sma20 === undefined || isNaN(sma20)) {
                        return 'Calculating SMA20 from Alpaca data...';
                      }
                      
                      return `Alpaca: $${safeToFixed(currentPrice, 2)} vs SMA20: $${safeToFixed(sma20, 2)}`;
                    })()}
                  </div>
                </div>
              </Col>

              {/* Price vs SMA50 */}
              <Col xs={24} sm={12} md={6}>
                <div style={{
                  padding: '16px',
                  border: '1px solid #f0f0f0',
                  borderRadius: '8px',
                  background: '#fafafa'
                }}>
                  <div style={{
                    fontSize: '12px',
                    color: '#595959',
                    fontWeight: '600',
                    marginBottom: '8px'
                  }}>
                    Price vs SMA50
                  </div>
                  <div style={{
                    fontSize: '18px',
                    fontWeight: '700',
                    marginBottom: '4px'
                  }}>
                    {(() => {
                      // 基于Alpaca数据的Price vs SMA50比较
                      // 需要足够的数据计算SMA50
                      const hasEnoughDataForSMA50 = chartData.length >= 50;
                      
                      if (!stockData.price || !hasEnoughDataForSMA50) {
                        return <span style={{ color: '#8c8c8c' }}>Need Data</span>;
                      }
                      
                      const lastChartData = chartData[chartData.length - 1];
                      const currentPrice = stockData.price; // Alpaca当前价
                      const sma50 = lastChartData?.sma50; // 基于Alpaca数据计算的SMA50
                      
                      // 检查SMA50是否基于Alpaca数据有效计算
                      if (sma50 === undefined || isNaN(sma50)) {
                        return <span style={{ color: '#8c8c8c' }}>Calculating...</span>;
                      }
                      
                      // 基于Alpaca数据的比较
                      const diff = currentPrice - sma50;
                      const diffPercent = (diff / sma50) * 100;
                      
                      if (diff > 0) {
                        return (
                          <span style={{ color: '#52c41a' }}>
                            Above (+{safeToFixed(diffPercent, 2)}%)
                          </span>
                        );
                      } else if (diff < 0) {
                        return (
                          <span style={{ color: '#ff4d4f' }}>
                            Below ({safeToFixed(diffPercent, 2)}%)
                          </span>
                        );
                      } else {
                        return (
                          <span style={{ color: '#8c8c8c' }}>
                            Equal
                          </span>
                        );
                      }
                    })()}
                  </div>
                  <div style={{
                    fontSize: '11px',
                    color: '#8c8c8c',
                    lineHeight: '1.4'
                  }}>
                    {(() => {
                      // 基于Alpaca数据的Price vs SMA50信息
                      const hasEnoughDataForSMA50 = chartData.length >= 50;
                      
                      if (!stockData.price || !hasEnoughDataForSMA50) {
                        return 'Need ≥50 Alpaca points for SMA50';
                      }
                      
                      const lastChartData = chartData[chartData.length - 1];
                      const currentPrice = stockData.price;
                      const sma50 = lastChartData?.sma50;
                      
                      if (sma50 === undefined || isNaN(sma50)) {
                        return 'Calculating SMA50 from Alpaca data...';
                      }
                      
                      return `Alpaca: $${safeToFixed(currentPrice, 2)} vs SMA50: $${safeToFixed(sma50, 2)}`;
                    })()}
                  </div>
                </div>
              </Col>

              {/* SMA20 vs SMA50 */}
              <Col xs={24} sm={12} md={6}>
                <div style={{
                  padding: '16px',
                  border: '1px solid #f0f0f0',
                  borderRadius: '8px',
                  background: '#fafafa'
                }}>
                  <div style={{
                    fontSize: '12px',
                    color: '#595959',
                    fontWeight: '600',
                    marginBottom: '8px'
                  }}>
                    SMA20 vs SMA50
                  </div>
                  <div style={{
                    fontSize: '18px',
                    fontWeight: '700',
                    marginBottom: '4px'
                  }}>
                    {(() => {
                      // 基于Alpaca数据的SMA20 vs SMA50比较
                      // 需要足够的数据计算两个移动平均线
                      const hasEnoughDataForBoth = chartData.length >= 50; // 需要至少50个点计算SMA50
                      
                      if (!hasEnoughDataForBoth) {
                        return <span style={{ color: '#8c8c8c' }}>Need Data</span>;
                      }
                      
                      const lastChartData = chartData[chartData.length - 1];
                      const sma20 = lastChartData?.sma20; // 基于Alpaca数据计算的SMA20
                      const sma50 = lastChartData?.sma50; // 基于Alpaca数据计算的SMA50
                      
                      // 检查两个移动平均线是否基于Alpaca数据有效计算
                      if (sma20 === undefined || isNaN(sma20) || sma50 === undefined || isNaN(sma50)) {
                        return <span style={{ color: '#8c8c8c' }}>Calculating...</span>;
                      }
                      
                      // 基于Alpaca数据的比较
                      const diff = sma20 - sma50;
                      const diffPercent = (diff / sma50) * 100;
                      
                      if (diff > 0) {
                        return (
                          <span style={{ color: '#52c41a' }}>
                            SMA20 &gt; SMA50
                          </span>
                        );
                      } else if (diff < 0) {
                        return (
                          <span style={{ color: '#ff4d4f' }}>
                            SMA20 &lt; SMA50
                          </span>
                        );
                      } else {
                        return (
                          <span style={{ color: '#8c8c8c' }}>
                            Equal
                          </span>
                        );
                      }
                    })()}
                  </div>
                  <div style={{
                    fontSize: '11px',
                    color: '#8c8c8c',
                    lineHeight: '1.4'
                  }}>
                    {(() => {
                      // 基于Alpaca数据的SMA20 vs SMA50信息
                      const hasEnoughDataForBoth = chartData.length >= 50;
                      
                      if (!hasEnoughDataForBoth) {
                        return 'Need ≥50 Alpaca points for SMA comparison';
                      }
                      
                      const lastChartData = chartData[chartData.length - 1];
                      const sma20 = lastChartData?.sma20;
                      const sma50 = lastChartData?.sma50;
                      
                      if (sma20 === undefined || isNaN(sma20) || sma50 === undefined || isNaN(sma50)) {
                        return 'Calculating MAs from Alpaca data...';
                      }
                      
                      const diff = sma20 - sma50;
                      const diffPercent = (diff / sma50) * 100;
                      
                      return `SMA20: $${safeToFixed(sma20, 2)} | SMA50: $${safeToFixed(sma50, 2)} | Diff: ${safeToFixed(diffPercent, 2)}%`;
                    })()}
                  </div>
                </div>
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>

      {/* Trade Setup - 交易设置 (研究+决策) */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col span={24}>
          <Card
            title={
              <span style={{ fontSize: '16px', fontWeight: '600', color: '#1f1f1f' }}>
                Trade Setup Analysis
              </span>
            }
            style={{
              border: '1px solid #e8e8e8',
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
            }}
            bodyStyle={{ padding: '20px' }}
          >
            <Row gutter={[24, 24]}>
              {/* Support / Resistance - 支撑位/压力位 */}
              <Col xs={24} sm={12} md={6}>
                <div style={{
                  padding: '16px',
                  border: '1px solid #f0f0f0',
                  borderRadius: '8px',
                  background: '#fafafa'
                }}>
                  <div style={{
                    fontSize: '12px',
                    color: '#595959',
                    fontWeight: '600',
                    marginBottom: '12px',
                    display: 'flex',
                    alignItems: 'center'
                  }}>
                    <LineChartOutlined style={{ marginRight: '8px', fontSize: '12px' }} />
                    Support / Resistance
                  </div>
                  
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{
                      fontSize: '11px',
                      color: '#8c8c8c',
                      marginBottom: '4px'
                    }}>
                      Key Support Levels
                    </div>
                    <div style={{
                      fontSize: '14px',
                      fontWeight: '600',
                      color: '#389e0d'
                    }}>
                      {(() => {
                        // 基于Alpaca数据的支撑位计算
                        // 需要足够的Alpaca数据进行分析
                        const hasEnoughData = chartData.length >= 20;
                        
                        if (!stockData.price || !hasEnoughData) {
                          return <div style={{ color: '#8c8c8c' }}>Need Data</div>;
                        }
                        
                        const currentPrice = stockData.price; // Alpaca当前价
                        // 使用Alpaca数据：根据timeframe选择数据范围
                        const dataToUse = selectedTimeframe === '1Y' ? chartData : chartData.slice(-252);
                        
                        if (dataToUse.length < 10) {
                          return <div style={{ color: '#8c8c8c' }}>Insufficient Alpaca Data</div>;
                        }
                        
                        // 基于Alpaca历史数据的支撑位计算
                        // 使用最近20个数据点的低点
                        const recentLows = dataToUse.slice(-20).map(d => d.low);
                        if (recentLows.length === 0) {
                          return <div style={{ color: '#8c8c8c' }}>Calculating...</div>;
                        }
                        
                        const minLow = Math.min(...recentLows);
                        // 基于Alpaca数据的支撑位：近期低点下方1-3%
                        const support1 = minLow * 0.99; // 近期低点下方1%
                        const support2 = minLow * 0.97; // 近期低点下方3%
                        
                        return (
                          <div>
                            <div>S1: ${safeToFixed(support1, 2)}</div>
                            <div>S2: ${safeToFixed(support2, 2)}</div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                  
                  <div>
                    <div style={{
                      fontSize: '11px',
                      color: '#8c8c8c',
                      marginBottom: '4px'
                    }}>
                      Key Resistance Levels
                    </div>
                    <div style={{
                      fontSize: '14px',
                      fontWeight: '600',
                      color: '#cf1322'
                    }}>
                      {(() => {
                        // 基于Alpaca数据的阻力位计算
                        // 需要足够的Alpaca数据进行分析
                        const hasEnoughData = chartData.length >= 20;
                        
                        if (!stockData.price || !hasEnoughData) {
                          return <div style={{ color: '#8c8c8c' }}>Need Data</div>;
                        }
                        
                        const currentPrice = stockData.price; // Alpaca当前价
                        // 使用Alpaca数据：根据timeframe选择数据范围
                        const dataToUse = selectedTimeframe === '1Y' ? chartData : chartData.slice(-252);
                        
                        if (dataToUse.length < 10) {
                          return <div style={{ color: '#8c8c8c' }}>Insufficient Alpaca Data</div>;
                        }
                        
                        // 基于Alpaca历史数据的阻力位计算
                        // 使用最近20个数据点的高点
                        const recentHighs = dataToUse.slice(-20).map(d => d.high);
                        if (recentHighs.length === 0) {
                          return <div style={{ color: '#8c8c8c' }}>Calculating...</div>;
                        }
                        
                        const maxHigh = Math.max(...recentHighs);
                        // 基于Alpaca数据的阻力位：近期高点上方1-3%
                        const resistance1 = maxHigh * 1.01; // 近期高点上方1%
                        const resistance2 = maxHigh * 1.03; // 近期高点上方3%
                        
                        return (
                          <div>
                            <div>R1: ${safeToFixed(resistance1, 2)}</div>
                            <div>R2: ${safeToFixed(resistance2, 2)}</div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                  
                  <div style={{
                    fontSize: '10px',
                    color: '#8c8c8c',
                    marginTop: '12px',
                    fontStyle: 'italic',
                    borderTop: '1px solid #f0f0f0',
                    paddingTop: '8px'
                  }}>
                    {(() => {
                      // 基于Alpaca数据的支撑阻力描述
                      const hasEnoughData = chartData.length >= 20;
                      
                      if (!hasEnoughData) {
                        return 'Based on Alpaca data (need ≥20 points)';
                      }
                      
                      return `Based on Alpaca ${selectedTimeframe} data: recent highs/lows ±1-3%`;
                    })()}
                  </div>
                </div>
              </Col>

              {/* Entry / Stop / Target - 入场/止损/目标 */}
              <Col xs={24} sm={12} md={6}>
                <div style={{
                  padding: '16px',
                  border: '1px solid #f0f0f0',
                  borderRadius: '8px',
                  background: '#fafafa'
                }}>
                  <div style={{
                    fontSize: '12px',
                    color: '#595959',
                    fontWeight: '600',
                    marginBottom: '12px',
                    display: 'flex',
                    alignItems: 'center'
                  }}>
                    <LineChartOutlined style={{ marginRight: '8px', fontSize: '12px' }} />
                    Reference Entry / Stop / Target
                  </div>
                  
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{
                      fontSize: '11px',
                      color: '#8c8c8c',
                      marginBottom: '4px'
                    }}>
                      Entry Price
                    </div>
                    <div style={{
                      fontSize: '16px',
                      fontWeight: '700',
                      color: '#1890ff'
                    }}>
                      {(() => {
                        if (!stockData.price) return 'N/A';
                        
                        const currentPrice = stockData.price;
                        // 基于当前价格给出参考入场点
                        const entryPrice = currentPrice * 0.995; // 当前价格下方0.5%
                        
                        return `$${safeToFixed(entryPrice, 2)}`;
                      })()}
                    </div>
                  </div>
                  
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{
                      fontSize: '11px',
                      color: '#8c8c8c',
                      marginBottom: '4px'
                    }}>
                      Stop Loss
                    </div>
                    <div style={{
                      fontSize: '14px',
                      fontWeight: '600',
                      color: '#cf1322'
                    }}>
                      {(() => {
                        if (!stockData.price || chartData.length === 0) return 'N/A';
                        
                        const currentPrice = stockData.price;
                        const dataToUse = selectedTimeframe === '1Y' ? chartData : chartData.slice(-252);
                        
                        if (dataToUse.length === 0) return 'No data';
                        
                        // 基于近期低点计算止损位
                        const recentLows = dataToUse.slice(-10).map(d => d.low);
                        const stopLoss = Math.min(...recentLows) * 0.98; // 近期低点下方2%
                        
                        return `$${safeToFixed(stopLoss, 2)}`;
                      })()}
                    </div>
                  </div>
                  
                  <div>
                    <div style={{
                      fontSize: '11px',
                      color: '#8c8c8c',
                      marginBottom: '4px'
                    }}>
                      Target Price
                    </div>
                    <div style={{
                      fontSize: '14px',
                      fontWeight: '600',
                      color: '#389e0d'
                    }}>
                      {(() => {
                        if (!stockData.price || chartData.length === 0) return 'N/A';
                        
                        const currentPrice = stockData.price;
                        const dataToUse = selectedTimeframe === '1Y' ? chartData : chartData.slice(-252);
                        
                        if (dataToUse.length === 0) return 'No data';
                        
                        // 基于近期高点计算目标位
                        const recentHighs = dataToUse.slice(-20).map(d => d.high);
                        const targetPrice = Math.max(...recentHighs) * 1.03; // 近期高点上方3%
                        
                        return `$${safeToFixed(targetPrice, 2)}`;
                      })()}
                    </div>
                  </div>
                  
                  <div style={{
                    fontSize: '10px',
                    color: '#8c8c8c',
                    marginTop: '12px',
                    fontStyle: 'italic',
                    borderTop: '1px solid #f0f0f0',
                    paddingTop: '8px'
                  }}>
                    Reference values derived from recent price action - For planning only
                  </div>
                </div>
              </Col>

              {/* Trade Bias / Setup - 交易偏倚/设置 */}
              <Col xs={24} sm={12} md={6}>
                <div style={{
                  padding: '16px',
                  border: '1px solid #f0f0f0',
                  borderRadius: '8px',
                  background: '#fafafa'
                }}>
                  <div style={{
                    fontSize: '12px',
                    color: '#595959',
                    fontWeight: '600',
                    marginBottom: '12px',
                    display: 'flex',
                    alignItems: 'center'
                  }}>
                    <LineChartOutlined style={{ marginRight: '8px', fontSize: '12px' }} />
                    Trade Setup Bias
                  </div>
                  
                  <div style={{
                    fontSize: '18px',
                    fontWeight: '700',
                    marginBottom: '12px',
                    textAlign: 'center'
                  }}>
                    {(() => {
                      if (!stockData.price || chartData.length === 0) return 'N/A';
                      
                      const lastData = chartData[chartData.length - 1];
                      const currentPrice = stockData.price;
                      const sma20 = lastData?.sma20;
                      const sma50 = lastData?.sma50;
                      const rsi = lastData?.rsi;
                      
                      // 收集信号
                      let longSignals = 0;
                      let shortSignals = 0;
                      
                      // 1. Price vs SMA20
                      if (sma20 !== undefined) {
                        if (currentPrice > sma20) longSignals++;
                        else if (currentPrice < sma20) shortSignals++;
                      }
                      
                      // 2. Price vs SMA50
                      if (sma50 !== undefined) {
                        if (currentPrice > sma50) longSignals++;
                        else if (currentPrice < sma50) shortSignals++;
                      }
                      
                      // 3. RSI状态
                      if (rsi !== undefined && !isNaN(rsi)) {
                        if (rsi <= 30) longSignals++; // 超卖 -> 看涨
                        else if (rsi >= 70) shortSignals++; // 超买 -> 看跌
                      }
                      
                      // 4. 52周位置
                      if (chartData.length > 0) {
                        const dataToUse = selectedTimeframe === '1Y' ? chartData : chartData.slice(-252);
                        if (dataToUse.length > 0) {
                          const fiftyTwoWeekHigh = Math.max(...dataToUse.map(d => d.high));
                          const fiftyTwoWeekLow = Math.min(...dataToUse.map(d => d.low));
                          if (fiftyTwoWeekHigh !== fiftyTwoWeekLow) {
                            const rangePosition = ((currentPrice - fiftyTwoWeekLow) / (fiftyTwoWeekHigh - fiftyTwoWeekLow)) * 100;
                            if (rangePosition <= 20) longSignals++; // 接近52周低点 -> 看涨
                            else if (rangePosition >= 80) shortSignals++; // 接近52周高点 -> 看跌
                          }
                        }
                      }
                      
                      // 判断交易设置偏倚
                      if (longSignals > shortSignals + 1) {
                        return (
                          <span style={{ color: '#52c41a' }}>
                            <ArrowUpOutlined style={{ marginRight: '8px' }} />
                            Bullish Setup
                          </span>
                        );
                      } else if (shortSignals > longSignals + 1) {
                        return (
                          <span style={{ color: '#cf1322' }}>
                            <ArrowDownOutlined style={{ marginRight: '8px' }} />
                            Bearish Setup
                          </span>
                        );
                      } else {
                        return (
                          <span style={{ color: '#8c8c8c' }}>
                            Neutral / No Clear Setup
                          </span>
                        );
                      }
                    })()}
                  </div>
                  
                  <div style={{
                    fontSize: '11px',
                    color: '#8c8c8c',
                    marginBottom: '8px'
                  }}>
                    {(() => {
                      if (!stockData.price || chartData.length === 0) return 'No data';
                      
                      const lastData = chartData[chartData.length - 1];
                      const currentPrice = stockData.price;
                      const sma20 = lastData?.sma20;
                      const sma50 = lastData?.sma50;
                      const rsi = lastData?.rsi;
                      
                      let signals = [];
                      
                      if (sma20 !== undefined) {
                        signals.push(`Price ${currentPrice > sma20 ? '>' : '<'} SMA20`);
                      }
                      
                      if (sma50 !== undefined) {
                        signals.push(`Price ${currentPrice > sma50 ? '>' : '<'} SMA50`);
                      }
                      
                      if (rsi !== undefined && !isNaN(rsi)) {
                        if (rsi <= 30) signals.push('RSI Oversold');
                        else if (rsi >= 70) signals.push('RSI Overbought');
                        else signals.push(`RSI ${safeToFixed(rsi, 1)}`);
                      }
                      
                      return signals.join(' • ');
                    })()}
                  </div>
                  
                  <div style={{
                    fontSize: '10px',
                    color: '#8c8c8c',
                    fontStyle: 'italic'
                  }}>
                    Current trade setup assessment based on technical confluence
                  </div>
                </div>
              </Col>

              {/* Risk / Reward - 风险/回报 */}
              <Col xs={24} sm={12} md={6}>
                <div style={{
                  padding: '16px',
                  border: '1px solid #f0f0f0',
                  borderRadius: '8px',
                  background: '#fafafa'
                }}>
                  <div style={{
                    fontSize: '12px',
                    color: '#595959',
                    fontWeight: '600',
                    marginBottom: '12px',
                    display: 'flex',
                    alignItems: 'center'
                  }}>
                    <LineChartOutlined style={{ marginRight: '8px', fontSize: '12px' }} />
                    Risk / Reward
                  </div>
                  
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{
                      fontSize: '11px',
                      color: '#8c8c8c',
                      marginBottom: '4px'
                    }}>
                      Risk per Share
                    </div>
                    <div style={{
                      fontSize: '14px',
                      fontWeight: '600',
                      color: '#cf1322'
                    }}>
                      {(() => {
                        if (!stockData.price || chartData.length === 0) return 'N/A';
                        
                        const currentPrice = stockData.price;
                        const dataToUse = selectedTimeframe === '1Y' ? chartData : chartData.slice(-252);
                        
                        if (dataToUse.length === 0) return 'No data';
                        
                        // 计算风险（入场价-止损价）
                        const recentLows = dataToUse.slice(-10).map(d => d.low);
                        const stopLoss = Math.min(...recentLows) * 0.98;
                        const entryPrice = currentPrice * 0.995;
                        const riskPerShare = entryPrice - stopLoss;
                        
                        return `$${safeToFixed(riskPerShare, 2)}`;
                      })()}
                    </div>
                  </div>
                  
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{
                      fontSize: '11px',
                      color: '#8c8c8c',
                      marginBottom: '4px'
                    }}>
                      Reward per Share
                    </div>
                    <div style={{
                      fontSize: '14px',
                      fontWeight: '600',
                      color: '#389e0d'
                    }}>
                      {(() => {
                        if (!stockData.price || chartData.length === 0) return 'N/A';
                        
                        const currentPrice = stockData.price;
                        const dataToUse = selectedTimeframe === '1Y' ? chartData : chartData.slice(-252);
                        
                        if (dataToUse.length === 0) return 'No data';
                        
                        // 计算回报（目标价-入场价）
                        const recentHighs = dataToUse.slice(-20).map(d => d.high);
                        const targetPrice = Math.max(...recentHighs) * 1.03;
                        const entryPrice = currentPrice * 0.995;
                        const rewardPerShare = targetPrice - entryPrice;
                        
                        return `$${safeToFixed(rewardPerShare, 2)}`;
                      })()}
                    </div>
                  </div>
                  
                  <div>
                    <div style={{
                      fontSize: '11px',
                      color: '#8c8c8c',
                      marginBottom: '4px'
                    }}>
                      Risk/Reward Ratio
                    </div>
                    <div style={{
                      fontSize: '16px',
                      fontWeight: '700',
                      color: (() => {
                        if (!stockData.price || chartData.length === 0) return '#8c8c8c';
                        
                        const currentPrice = stockData.price;
                        const dataToUse = selectedTimeframe === '1Y' ? chartData : chartData.slice(-252);
                        
                        if (dataToUse.length === 0) return '#8c8c8c';
                        
                        // 计算风险回报比
                        const recentLows = dataToUse.slice(-10).map(d => d.low);
                        const recentHighs = dataToUse.slice(-20).map(d => d.high);
                        const stopLoss = Math.min(...recentLows) * 0.98;
                        const targetPrice = Math.max(...recentHighs) * 1.03;
                        const entryPrice = currentPrice * 0.995;
                        
                        const risk = entryPrice - stopLoss;
                        const reward = targetPrice - entryPrice;
                        
                        if (risk <= 0) return '#8c8c8c';
                        
                        const ratio = reward / risk;
                        
                        if (ratio >= 2) return '#52c41a'; // 良好
                        if (ratio >= 1) return '#fa8c16'; // 一般
                        return '#cf1322'; // 较差
                      })()
                    }}>
                      {(() => {
                        if (!stockData.price || chartData.length === 0) return 'N/A';
                        
                        const currentPrice = stockData.price;
                        const dataToUse = selectedTimeframe === '1Y' ? chartData : chartData.slice(-252);
                        
                        if (dataToUse.length === 0) return 'No data';
                        
                        // 计算风险回报比
                        const recentLows = dataToUse.slice(-10).map(d => d.low);
                        const recentHighs = dataToUse.slice(-20).map(d => d.high);
                        const stopLoss = Math.min(...recentLows) * 0.98;
                        const targetPrice = Math.max(...recentHighs) * 1.03;
                        const entryPrice = currentPrice * 0.995;
                        
                        const risk = entryPrice - stopLoss;
                        const reward = targetPrice - entryPrice;
                        
                        if (risk <= 0) return 'Invalid';
                        
                        const ratio = reward / risk;
                        return `${safeToFixed(ratio, 2)}:1`;
                      })()}
                    </div>
                  </div>
                  
                  <div style={{
                    fontSize: '10px',
                    color: '#8c8c8c',
                    marginTop: '12px',
                    fontStyle: 'italic',
                    borderTop: '1px solid #f0f0f0',
                    paddingTop: '8px'
                  }}>
                    Calculated from reference entry/stop/target levels based on support/resistance
                  </div>
                </div>
              </Col>
            </Row>
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
                  {/* 第一行：3张卡片 - Current Price, SMA20, SMA50 */}
                  <Row gutter={[24, 24]}>
                    <Col span={8}>
                      <Card
                        size="small"
                        style={{
                          border: '1px solid #e8e8e8',
                          borderRadius: '8px',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                          textAlign: 'center',
                          background: 'linear-gradient(135deg, #f6ffed 0%, #f0f9ff 100%)'
                        }}
                      >
                        <div style={{ padding: '20px 16px' }}>
                          <div style={{
                            fontSize: '12px',
                            color: '#595959',
                            fontWeight: '600',
                            marginBottom: '8px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px'
                          }}>
                            Current Price
                          </div>
                          <div style={{
                            fontSize: '28px',
                            fontWeight: '700',
                            color: '#1890ff',
                            fontFeatureSettings: '"tnum"',
                            lineHeight: '1.2',
                            marginBottom: '12px'
                          }}>
                            {stockData.price !== null ? `$${safeToFixed(stockData.price, 2)}` : 'N/A'}
                          </div>
                          <div style={{
                            fontSize: '11px',
                            color: '#8c8c8c',
                            lineHeight: '1.4',
                            fontStyle: 'italic'
                          }}>
                            {(() => {
                              // 显示当前价格的数据源
                              if (!stockData.price) return 'No price data';
                              return `Latest price from ${dataSource}`;
                            })()}
                          </div>
                        </div>
                      </Card>
                    </Col>
                    <Col span={8}>
                      <Card
                        size="small"
                        style={{
                          border: '1px solid #e8e8e8',
                          borderRadius: '8px',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                          textAlign: 'center',
                          background: 'linear-gradient(135deg, #f6ffed 0%, #f6ffed 100%)'
                        }}
                      >
                        <div style={{ padding: '20px 16px' }}>
                          <div style={{
                            fontSize: '12px',
                            color: '#595959',
                            fontWeight: '600',
                            marginBottom: '8px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px'
                          }}>
                            SMA 20
                          </div>
                          <div style={{
                            fontSize: '28px',
                            fontWeight: '700',
                            color: '#52c41a',
                            fontFeatureSettings: '"tnum"',
                            lineHeight: '1.2',
                            marginBottom: '12px'
                          }}>
                            {(() => {
                              if (chartData.length === 0) return 'N/A';
                              const lastData = chartData[chartData.length - 1];
                              return lastData?.sma20 !== undefined
                                ? `$${safeToFixed(lastData.sma20, 2)}`
                                : 'N/A';
                            })()}
                          </div>
                          <div style={{
                            fontSize: '11px',
                            color: '#8c8c8c',
                            lineHeight: '1.4',
                            fontStyle: 'italic'
                          }}>
                            {(() => {
                              // 显示SMA20的数据源和计算信息
                              if (chartData.length === 0) return 'No chart data';
                              const lastData = chartData[chartData.length - 1];
                              const hasSMA20 = lastData?.sma20 !== undefined;
                              
                              if (!hasSMA20) {
                                return 'Need ≥20 periods for SMA20';
                              }
                              
                              return `SMA20 (${selectedTimeframe} bars) from ${dataSource}`;
                            })()}
                          </div>
                        </div>
                      </Card>
                    </Col>
                    <Col span={8}>
                      <Card
                        size="small"
                        style={{
                          border: '1px solid #e8e8e8',
                          borderRadius: '8px',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                          textAlign: 'center',
                          background: 'linear-gradient(135deg, #fff2e8 0%, #fff2e8 100%)'
                        }}
                      >
                        <div style={{ padding: '20px 16px' }}>
                          <div style={{
                            fontSize: '12px',
                            color: '#595959',
                            fontWeight: '600',
                            marginBottom: '8px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px'
                          }}>
                            SMA 50
                          </div>
                          <div style={{
                            fontSize: '28px',
                            fontWeight: '700',
                            color: '#fa8c16',
                            fontFeatureSettings: '"tnum"',
                            lineHeight: '1.2',
                            marginBottom: '12px'
                          }}>
                            {(() => {
                              if (chartData.length === 0) return 'N/A';
                              const lastData = chartData[chartData.length - 1];
                              return lastData?.sma50 !== undefined
                                ? `$${safeToFixed(lastData.sma50, 2)}`
                                : 'N/A';
                            })()}
                          </div>
                          <div style={{
                            fontSize: '11px',
                            color: '#8c8c8c',
                            lineHeight: '1.4',
                            fontStyle: 'italic'
                          }}>
                            {(() => {
                              // 显示SMA50的数据源和计算信息
                              if (chartData.length === 0) return 'No chart data';
                              const lastData = chartData[chartData.length - 1];
                              const hasSMA50 = lastData?.sma50 !== undefined;
                              
                              if (!hasSMA50) {
                                return 'Need ≥50 periods for SMA50';
                              }
                              
                              return `SMA50 (${selectedTimeframe} bars) from ${dataSource}`;
                            })()}
                          </div>
                        </div>
                      </Card>
                    </Col>
                  </Row>

                  {/* 第三行：Notes / Data Availability 区块 */}
                  <div style={{ marginTop: '32px' }}>
                    <div style={{
                      fontSize: '16px',
                      fontWeight: '600',
                      color: '#1f1f1f',
                      marginBottom: '16px',
                      paddingBottom: '8px',
                      borderBottom: '1px solid #f0f0f0'
                    }}>
                      Data Status
                    </div>
                    
                    <Card
                      size="small"
                      style={{
                        border: '1px solid #f0f0f0',
                        borderRadius: '6px',
                        background: '#fafafa'
                      }}
                    >
                      <div style={{ padding: '16px' }}>
                        <div style={{
                          fontSize: '13px',
                          color: '#595959',
                          lineHeight: '1.6'
                        }}>
                          {(() => {
                            if (chartData.length === 0) {
                              return (
                                <div>
                                  <div style={{ color: '#ff4d4f', fontWeight: '500', marginBottom: '8px' }}>
                                    ⚠️ No data available
                                  </div>
                                  <div>Load chart data to see moving average analysis.</div>
                                </div>
                              );
                            }
                            
                            const lastData = chartData[chartData.length - 1];
                            const hasSMA20 = lastData?.sma20 !== undefined;
                            const hasSMA50 = lastData?.sma50 !== undefined;
                            
                            if (!hasSMA20 && !hasSMA50) {
                              return (
                                <div>
                                  <div style={{ color: '#ff4d4f', fontWeight: '500', marginBottom: '8px' }}>
                                    ⚠️ Insufficient data for moving averages
                                  </div>
                                  <div>
                                    • SMA20: Need at least 20 periods of data<br />
                                    • SMA50: Need at least 50 periods of data
                                  </div>
                                </div>
                              );
                            } else if (!hasSMA50) {
                              return (
                                <div>
                                  <div style={{ color: '#fa8c16', fontWeight: '500', marginBottom: '8px' }}>
                                    ⚠️ Partial data available
                                  </div>
                                  <div>
                                    • SMA20: ✓ Available ({chartData.length} periods)<br />
                                    • SMA50: Need at least 50 periods (currently {chartData.length})
                                  </div>
                                </div>
                              );
                            } else if (!hasSMA20) {
                              return (
                                <div>
                                  <div style={{ color: '#fa8c16', fontWeight: '500', marginBottom: '8px' }}>
                                    ⚠️ Partial data available
                                  </div>
                                  <div>
                                    • SMA20: Need at least 20 periods (currently {chartData.length})<br />
                                    • SMA50: ✓ Available ({chartData.length} periods)
                                  </div>
                                </div>
                              );
                            } else {
                              return (
                                <div>
                                  <div style={{ color: '#52c41a', fontWeight: '500', marginBottom: '8px' }}>
                                    ✓ All moving averages available
                                  </div>
                                  <div>
                                    • Data Source: {dataSource}<br />
                                    • Timeframe: {selectedTimeframe}<br />
                                    • Total Periods: {chartData.length}<br />
                                    • SMA20: ✓ {chartData.length} periods available<br />
                                    • SMA50: ✓ {chartData.length} periods available<br />
                                    • Calculation: Based on {selectedTimeframe} close prices
                                  </div>
                                </div>
                              );
                            }
                          })()}
                        </div>
                      </div>
                    </Card>
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
                  <div style={{
                    fontSize: '10px',
                    color: '#8c8c8c',
                    fontStyle: 'italic'
                  }}>
                    {(() => {
                      // 显示字段数据源
                      if (dataSource.includes('Alpaca')) {
                        return 'From Finnhub (Alpaca fallback)';
                      }
                      return `From ${dataSource}`;
                    })()}
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
                    {(() => {
                      // 优先使用Alpaca数据，如果Alpaca没有则使用Finnhub fallback
                      if (stockData.peRatio !== undefined && stockData.peRatio !== null) {
                        return safeToFixed(stockData.peRatio, 2);
                      }
                      return 'N/A';
                    })()}
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
                    {(() => {
                      // 优先使用Alpaca数据，如果Alpaca没有则使用Finnhub fallback
                      if (stockData.dividendYield !== undefined && stockData.dividendYield !== null) {
                        return `${safeToFixed(stockData.dividendYield, 2)}%`;
                      }
                      return 'N/A';
                    })()}
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
                    Beta
                  </div>
                  <div style={{
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#1f1f1f',
                    fontFeatureSettings: '"tnum"'
                  }}>
                    {(() => {
                      // 优先使用Alpaca数据，如果Alpaca没有则使用Finnhub fallback
                      if (stockData.beta !== undefined && stockData.beta !== null) {
                        return safeToFixed(stockData.beta, 2);
                      }
                      return 'N/A';
                    })()}
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
                    Earnings Date
                  </div>
                  <div style={{
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#1f1f1f'
                  }}>
                    {(() => {
                      // 优先使用Alpaca数据，如果Alpaca没有则使用Finnhub fallback
                      if (stockData.earningsDate !== undefined && stockData.earningsDate !== null) {
                        return stockData.earningsDate;
                      }
                      return 'N/A';
                    })()}
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

              <Col span={12}>
                <div style={{ marginBottom: '16px' }}>
                  <div style={{
                    fontSize: '12px',
                    color: '#8c8c8c',
                    fontWeight: '500',
                    marginBottom: '4px'
                  }}>
                    52W High
                  </div>
                  <div style={{
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#389e0d',
                    fontFeatureSettings: '"tnum"'
                  }}>
                    {stockData.yearHigh !== undefined && stockData.yearHigh !== null ? `$${safeToFixed(stockData.yearHigh, 2)}` : 'N/A'}
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
            <Empty
              description={
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '14px', color: '#595959', marginBottom: '8px' }}>
                    No backtest history yet
                  </div>
                  <div style={{ fontSize: '12px', color: '#8c8c8c' }}>
                    Run your first backtest to see results here
                  </div>
                </div>
              }
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              style={{ padding: '40px 0' }}
            />
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