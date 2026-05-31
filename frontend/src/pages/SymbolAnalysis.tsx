import React, { useState, useEffect, useCallback } from 'react';
import { Card, Row, Col, Button, Tabs, Spin, Empty, Alert, message, Radio, Typography, Tag } from 'antd';
import { LineChartOutlined, BarChartOutlined, PlayCircleOutlined, ReloadOutlined, ArrowUpOutlined, ArrowDownOutlined, InfoCircleOutlined, RadarChartOutlined } from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine, ReferenceArea } from 'recharts';
import marketDataService, {
  StockData,
  HistoricalDataPoint,
  TIMEFRAMES,
  safeToFixed,
  calculateSMA,
  calculateRSI
} from '../services/marketDataService';
import DataSourceBadge from '../components/DataSourceBadge';
import { useLanguage } from '../contexts/LanguageContext';

const { TabPane } = Tabs;
const { Title, Text } = Typography;

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

// ========== 专业X轴标签生成函数（新方案） ==========

// 1. 1 Day: 生成30分钟间隔的时间标签 (09:30 - 16:00)
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
  const { t, language, translateSector } = useLanguage();

  // Timeframe label translation mapping
  const timeframeLabels: Record<string, string> = {
    '1D': t.analysis.tf1Day,
    '1W': t.analysis.tf1Week,
    '1M': t.analysis.tf1Month,
    '3M': t.analysis.tf3Months,
    '1Y': t.analysis.tf1Year,
  };
  
  // 获取Finnhub收盘价的函数
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
      label = language === 'zh-CN' ? t.analysis.near52WHigh : 'Near 52W High';
      description = language === 'zh-CN' ? '接近52周高点交易' : 'Trading near 52-week high';
    } else if (percentage >= 60) {
      label = language === 'zh-CN' ? t.analysis.upperRange : 'Upper range';
      description = language === 'zh-CN' ? '在上区间交易' : 'Trading in upper range';
    } else if (percentage >= 40) {
      label = language === 'zh-CN' ? t.analysis.midRange : 'Mid-range';
      description = language === 'zh-CN' ? '在中间区间交易' : 'Trading in mid-range';
    } else if (percentage >= 20) {
      label = language === 'zh-CN' ? t.analysis.lowerRange : 'Lower range';
      description = language === 'zh-CN' ? '在下区间交易' : 'Trading in lower range';
    } else {
      label = language === 'zh-CN' ? t.analysis.near52WLow : 'Near 52W Low';
      description = language === 'zh-CN' ? '接近52周低点交易' : 'Trading near 52-week low';
    }

    return {
      percentage,
      label,
      description
    };
  };

  const [loading, setLoading] = useState(true);

  // 计算纽约时间与UTC的偏移（小时），自动处理夏令时
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

  const [stockData, setStockData] = useState<StockData | null>(null);
  const [stockDataError, setStockDataError] = useState<string | null>(null);
  const [historicalDataError, setHistoricalDataError] = useState<string | null>(null);
  const [fallbackTimeframeNotice, setFallbackTimeframeNotice] = useState<string | null>(null);
  const [historicalErrorType, setHistoricalErrorType] = useState<string | null>(null);

  // 图表相关状态 - 默认显示1 Day图表
  const [selectedTimeframe, setSelectedTimeframe] = useState<string>('1D');
  const [, setHistoricalData] = useState<HistoricalDataPoint[]>([]);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [chartLoading, setChartLoading] = useState(false);
  const [dataSource, setDataSource] = useState<string>('Loading');
  const [performanceData, setPerformanceData] = useState<{ oneMonth: number | null; threeMonth: number | null; ytd: number | null }>({ oneMonth: null, threeMonth: null, ytd: null });

  // Message deduplication key
  const HISTORY_ERROR_KEY = 'historical_data_error';

  // 加载股票数据
  const loadStockData = useCallback(async () => {
    if (!symbol) return;

    try {
      setLoading(true);
      setStockDataError(null);
      const data = await marketDataService.getStockData(symbol);

      setStockData(data);
      setDataSource(data.dataSource || 'Finnhub');
      // No success message needed for every load, keep it clean
    } catch (error: any) {
      console.error('Failed to fetch stock data:', error);
      const errorMsg = error.message || 'Unknown error';
      setStockDataError(`Failed to load stock data: ${errorMsg}`);
      message.error({ content: `Failed to load ${symbol} data: ${errorMsg}`, key: 'stock_data_error' });
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  // Helper: process historical data response into chart data
  const processHistoricalResponse = useCallback((response: any, timeframe: string) => {
    const formattedData = response.data.map((item: any) => {
      let date: Date;
      if (item.time) {
        try {
          let timeStr = item.time;
          if (timeStr.endsWith('Z')) {
            date = new Date(timeStr);
          } else if (timeStr.includes(' ')) {
            timeStr = timeStr.replace(' ', 'T') + 'Z';
            date = new Date(timeStr);
          } else {
            timeStr = timeStr + 'T00:00:00Z';
            date = new Date(timeStr);
          }
          if (!isNaN(date.getTime())) {
            return {
              date: date.toISOString(),
              open: Number(item.open) || 0,
              high: Number(item.high) || 0,
              low: Number(item.low) || 0,
              close: Number(item.close) || 0,
              volume: Number(item.volume) || 0
            };
          }
        } catch (e) {
          console.error('Failed to parse time field:', item.time, e);
        }
      }
      const timestampMs = item.timestamp * 1000;
      date = new Date(timestampMs);
      if (isNaN(date.getTime())) return null;
      return {
        date: date.toISOString(),
        open: Number(item.open) || 0,
        high: Number(item.high) || 0,
        low: Number(item.low) || 0,
        close: Number(item.close) || 0,
        volume: Number(item.volume) || 0
      };
    }).filter((item: any) => item !== null);

    let chartDataToSet = formattedData;
    chartDataToSet = [...chartDataToSet].sort((a: any, b: any) =>
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    if (timeframe === '3M') {
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setDate(threeMonthsAgo.getDate() - 90);
      chartDataToSet = chartDataToSet.filter((item: any) => new Date(item.date) >= threeMonthsAgo);
    } else if (timeframe === '1M') {
      const oneMonthAgo = new Date();
      oneMonthAgo.setDate(oneMonthAgo.getDate() - 30);
      chartDataToSet = chartDataToSet.filter((item: any) => new Date(item.date) >= oneMonthAgo);
    } else if (timeframe === '1W') {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      chartDataToSet = chartDataToSet.filter((item: any) => new Date(item.date) >= oneWeekAgo);
    }

    const closePrices = chartDataToSet.map((d: any) => d.close);
    const sma20 = calculateSMA(closePrices, 20);
    const sma50 = calculateSMA(closePrices, 50);
    let rsi = calculateRSI(closePrices, 14);

    if (timeframe === '1M' && formattedData.length > chartDataToSet.length) {
      const fullClosePrices = formattedData.map((d: any) => d.close);
      const fullRSI = calculateRSI(fullClosePrices, 14);
      rsi = fullRSI.slice(fullRSI.length - chartDataToSet.length);
    }

    return chartDataToSet.map((item: any, index: number) => ({
      ...item,
      sma20: !isNaN(sma20[index]) ? sma20[index] : undefined,
      sma50: !isNaN(sma50[index]) ? sma50[index] : undefined,
      rsi: !isNaN(rsi[index]) ? rsi[index] : undefined
    }));
  }, []);

  // 加载历史价格数据 (with timeframe fallback)
  const loadHistoricalPrices = useCallback(async () => {
    if (!symbol) return;

    // Fallback timeframes to try when the selected one has no bars
    const FALLBACK_TIMEFRAMES: Record<string, string[]> = {
      '1D': ['1W', '1M'],
      '1W': ['1M', '3M'],
      '1M': ['3M', '1Y'],
      '3M': ['1Y', '1M'],
      '1Y': ['3M', '1M'],
    };

    try {
      setChartLoading(true);
      setHistoricalDataError(null);
      setHistoricalErrorType(null);
      setFallbackTimeframeNotice(null);
      setHistoricalData([]);
      setChartData([]);

      console.log(`[${selectedTimeframe}] Requesting historical bars for ${symbol}...`);

      const response = await marketDataService.getStockHistory(symbol, selectedTimeframe);

      // Success: data returned
      if (response.data && response.data.length > 0) {
        setHistoricalData(response.data);
        setDataSource(response.dataSource || 'Alpaca');
        // Use backend fallback info if available
        if (response.fallbackUsed && response.displayedTimeframe) {
          const reqTf = response.requestedTimeframe || selectedTimeframe;
          const dispTf = response.displayedTimeframe;
          const requestedLabel = TIMEFRAMES[reqTf]?.label || reqTf;
          const displayedLabel = TIMEFRAMES[dispTf]?.label || dispTf;
          setFallbackTimeframeNotice(`${requestedLabel} bars unavailable. Showing ${displayedLabel} data instead.`);
          const finalChartData = processHistoricalResponse(response, dispTf);
          setChartData(finalChartData);
        } else {
          setFallbackTimeframeNotice(null);
          const finalChartData = processHistoricalResponse(response, selectedTimeframe);
          setChartData(finalChartData);
        }
        setChartLoading(false);
        return;
      }

      // No bars returned — try fallback timeframes
      console.log(`[${selectedTimeframe}] No bars for ${symbol}, trying fallback timeframes...`);
      const fallbacks = FALLBACK_TIMEFRAMES[selectedTimeframe] || ['1M', '3M'];

      for (const fbTimeframe of fallbacks) {
        console.log(`[Fallback] Trying ${fbTimeframe} for ${symbol}...`);
        try {
          const fbResponse = await marketDataService.getStockHistory(symbol, fbTimeframe);
          if (fbResponse.data && fbResponse.data.length > 0) {
            // Fallback succeeded
            const fbLabel = TIMEFRAMES[fbTimeframe]?.label || fbTimeframe;
            setFallbackTimeframeNotice(`${selectedTimeframe} bars unavailable. Showing ${fbLabel} data instead.`);
            setHistoricalData(fbResponse.data);
            setDataSource(fbResponse.dataSource || 'Alpaca');
            const finalChartData = processHistoricalResponse(fbResponse, fbTimeframe);
            setChartData(finalChartData);
            setChartLoading(false);
            return;
          }
        } catch (fbErr) {
          console.log(`[Fallback] ${fbTimeframe} also failed:`, fbErr);
        }
      }

      // All fallbacks failed — show compact fallback
      setHistoricalData([]);
      setChartData([]);
      setDataSource(response.dataSource || 'Alpaca');
      setHistoricalErrorType(response.errorType || 'no_bars');
      setHistoricalDataError('No historical bars available for any timeframe.');

    } catch (error: any) {
      console.error('Failed to fetch historical data:', error);
      const errorMsg = error.message || 'Unknown error';

      if (errorMsg.includes('auth_required')) {
        setHistoricalErrorType('auth_required');
        setHistoricalDataError('Authentication required. Please sign in again.');
      } else if (errorMsg.includes('rate_limited')) {
        setHistoricalErrorType('rate_limited');
        setHistoricalDataError('Rate limited. Please try again later.');
      } else {
        setHistoricalErrorType('api_error');
        setHistoricalDataError(`Error loading chart: ${errorMsg}`);
        message.error({
          content: `Failed to load historical data: ${errorMsg}`,
          key: HISTORY_ERROR_KEY
        });
      }

      setHistoricalData([]);
      setChartData([]);
    } finally {
      setChartLoading(false);
    }
  }, [symbol, selectedTimeframe, HISTORY_ERROR_KEY, processHistoricalResponse]);

  // Load 1Y data for computing Recent Performance returns
  const loadPerformanceData = useCallback(async () => {
    if (!symbol) return;
    try {
      const response = await marketDataService.getStockHistory(symbol, '1Y');
      if (response.data && response.data.length > 0) {
        const sorted = [...response.data].sort((a: any, b: any) =>
          new Date(a.time || a.timestamp * 1000).getTime() - new Date(b.time || b.timestamp * 1000).getTime()
        );
        const getClose = (pt: any) => Number(pt.close) || 0;
        const now = new Date();
        const latestClose = getClose(sorted[sorted.length - 1]);

        // 1 Month Return
        const oneMonthAgo = new Date(now);
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
        const oneMonthBar = sorted.filter((d: any) => new Date(d.time || d.timestamp * 1000) <= oneMonthAgo).pop();
        const oneMonthReturn = oneMonthBar && latestClose > 0 ? ((latestClose - getClose(oneMonthBar)) / getClose(oneMonthBar)) * 100 : null;

        // 3 Month Return
        const threeMonthAgo = new Date(now);
        threeMonthAgo.setMonth(threeMonthAgo.getMonth() - 3);
        const threeMonthBar = sorted.filter((d: any) => new Date(d.time || d.timestamp * 1000) <= threeMonthAgo).pop();
        const threeMonthReturn = threeMonthBar && latestClose > 0 ? ((latestClose - getClose(threeMonthBar)) / getClose(threeMonthBar)) * 100 : null;

        // Year to Date Return
        const ytdStart = new Date(now.getFullYear(), 0, 1);
        const ytdBar = sorted.filter((d: any) => new Date(d.time || d.timestamp * 1000) < ytdStart).pop()
          || sorted.find((d: any) => new Date(d.time || d.timestamp * 1000) >= ytdStart);
        const ytdReturn = ytdBar && latestClose > 0 ? ((latestClose - getClose(ytdBar)) / getClose(ytdBar)) * 100 : null;

        setPerformanceData({ oneMonth: oneMonthReturn, threeMonth: threeMonthReturn, ytd: ytdReturn });
      }
    } catch (err) {
      console.error('Failed to load performance data:', err);
    }
  }, [symbol]);

  // Helper to format return percentage
  const formatReturn = (value: number | null): { text: string; color: string } => {
    if (value === null) return { text: 'N/A', color: "var(--app-text-muted)" };
    const sign = value >= 0 ? '+' : '';
    return { text: `${sign}${value.toFixed(1)}%`, color: value >= 0 ? '#10b981' : '#ef4444' };
  };


  // 格式化X轴标签 - 按照专业方案重新设计
  const formatXAxisTick = (value: string) => {
    if (!value) return '';
    try {
      const date = new Date(value);
      if (isNaN(date.getTime())) return '';
      
      switch (selectedTimeframe) {
        case '1D':
          const utcHour = date.getUTCHours();
          const minute = date.getUTCMinutes();
          const nyHour = (utcHour - 4 + 24) % 24;
          return `${String(nyHour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
        case '1W':
          return `${date.getUTCMonth() + 1}/${date.getUTCDate()}`;
        case '1M':
        case '3M':
        case '1Y':
          return `${date.getUTCMonth() + 1}/${date.getUTCDate()}`;
        default:
          return '';
      }
    } catch (e) {
      return '';
    }
  };

  // 自定义Tooltip组件 - 支持价格图和RSI图
  const CustomTooltip = ({ active, payload, label, isRSI }: any) => {
    if (!active || !payload || payload.length === 0) return null;

    const data = payload[0].payload;
    let date: Date;
    try {
      date = data.date ? new Date(data.date) : (label ? new Date(label) : new Date());
      if (isNaN(date.getTime())) date = new Date();
    } catch (e) {
      date = new Date();
    }
    
    const isDaily = selectedTimeframe === '1D';
    const isWeekly = selectedTimeframe === '1W';
    
    return (
      <div style={{
        backgroundColor: 'var(--app-card-bg)',
        border: "1px solid var(--app-border)",
        borderRadius: '8px',
        padding: '12px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
        minWidth: '200px',
        fontSize: '12px',
        backdropFilter: 'blur(4px)'
      }}>
        <div style={{
          fontWeight: '700',
          marginBottom: '8px',
          color: "var(--app-text-strong)",
          borderBottom: "1px solid var(--app-border-soft)",
          paddingBottom: '6px',
        }}>
          {isDaily || isWeekly ? formatAsNewYorkTime(date, true) : date.toLocaleDateString()}
        </div>
        
        {isRSI ? (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: "var(--app-text-muted)" }}>RSI (14):</span>
            <span style={{ 
              fontWeight: '700', 
              fontSize: '14px',
              color: data.rsi >= 70 ? '#ef4444' : data.rsi <= 30 ? '#10b981' : '#722ed1'
            }}>
              {data.rsi?.toFixed(2)}
              {data.rsi >= 70 ? ' (OB)' : data.rsi <= 30 ? ' (OS)' : ''}
            </span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: "var(--app-text-muted)" }}>Price:</span>
              <span style={{ fontWeight: '700', color: '#1677ff', fontSize: '14px' }}>
                ${data.close.toFixed(2)}
              </span>
            </div>
            {!isDaily && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', opacity: 0.8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: "var(--app-text-muted)" }}>O:</span><span>{data.open.toFixed(2)}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: "var(--app-text-muted)" }}>H:</span><span style={{ color: '#10b981' }}>{data.high.toFixed(2)}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: "var(--app-text-muted)" }}>L:</span><span style={{ color: '#ef4444' }}>{data.low.toFixed(2)}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: "var(--app-text-muted)" }}>V:</span><span>{data.volume > 1e6 ? (data.volume/1e6).toFixed(1)+'M' : (data.volume/1e3).toFixed(0)+'K'}</span></div>
              </div>
            )}
            {stockData?.previousClose && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', paddingTop: '4px', borderTop: "1px solid var(--app-border-soft)" }}>
                <span style={{ color: "var(--app-text-muted)" }}>Change:</span>
                <span style={{ fontWeight: '600', color: data.close >= stockData.previousClose ? '#10b981' : '#ef4444' }}>
                  {((data.close - stockData.previousClose) / stockData.previousClose * 100).toFixed(2)}%
                </span>
              </div>
            )}
            {data.sma20 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: "var(--app-text-muted)" }}>SMA20:</span><span style={{ color: '#10b981', fontWeight: '500' }}>${data.sma20.toFixed(2)}</span></div>}
            {data.sma50 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: "var(--app-text-muted)" }}>SMA50:</span><span style={{ color: '#f59e0b', fontWeight: '500' }}>${data.sma50.toFixed(2)}</span></div>}
          </div>
        )}
      </div>
    );
  };

  // 计算Y轴缩放函数
  const getYAxisDomain = () => {
    if (chartData.length === 0) return [0, 100];
    const validPrices = chartData.flatMap(d => [d.open, d.high, d.low, d.close])
      .filter(price => price !== null && price !== undefined && !isNaN(price) && price > 0);
    if (validPrices.length === 0) return [0, 100];
    const minPrice = Math.min(...validPrices);
    const maxPrice = Math.max(...validPrices);
    const priceRange = maxPrice - minPrice;
    if (priceRange < 0.01) return [minPrice - 0.01, maxPrice + 0.01];
    let bufferRatio = 0.02;
    switch (selectedTimeframe) {
      case '1D': bufferRatio = 0.01; break;
      case '1W': bufferRatio = 0.015; break;
      case '1M': bufferRatio = 0.02; break;
      case '3M': bufferRatio = 0.025; break;
      case '1Y': bufferRatio = 0.03; break;
    }
    const buffer = priceRange * bufferRatio;
    return [minPrice - buffer, maxPrice + buffer];
  };

  // 渲染价格图表
  const renderPriceChart = () => {
    if (chartLoading) return (
      <div style={{ textAlign: 'center', padding: '120px 0', background: "var(--app-card-bg-soft)", borderRadius: '16px' }}>
        <Spin size="large" tip={<span style={{marginTop: '12px', color: "var(--app-text-muted)", fontWeight: 500}}>{t.analysis.chartDataUnavailable}...</span>} />
      </div>
    );

    if (chartData.length === 0) return (
      <div style={{ padding: '40px 32px', background: "var(--app-card-bg-soft)", borderRadius: '16px', border: "1px solid var(--app-border)", textAlign: 'center' }}>
        <div style={{ marginBottom: 20 }}>
          <InfoCircleOutlined style={{ color: "var(--app-text-muted)", fontSize: '32px' }} />
        </div>
        <Title level={4} style={{ color: "var(--app-text-strong)", marginBottom: 8 }}>Chart data unavailable</Title>
        <Text style={{ color: "var(--app-text-muted)", display: 'block', marginBottom: 24 }}>
          No historical bars were returned for {symbol} in the {selectedTimeframe} timeframe.
        </Text>
        <Button 
          type="primary" 
          icon={<ReloadOutlined />} 
          onClick={loadHistoricalPrices} 
          style={{ borderRadius: '8px', fontWeight: 600 }}
        >
          Retry Loading Data
        </Button>
      </div>
    );

    const yDomain = getYAxisDomain();
    
    return (
      <ResponsiveContainer width="100%" height={selectedTimeframe === '1Y' ? 550 : 500}>
        <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid 
            strokeDasharray="3 3" 
            stroke="var(--app-border-soft)" 
            vertical={false} 
            strokeOpacity={1} 
          />
          <XAxis 
            dataKey="date" 
            tick={{ fontSize: 11, fill: "var(--app-text-muted)", fontWeight: 500 }} 
            axisLine={{ stroke: "var(--app-border-soft)" }} 
            tickLine={false} 
            height={40} 
            tickFormatter={formatXAxisTick} 
            ticks={
              selectedTimeframe === '1D' ? getAdaptive1DayTicks(chartData) : 
              selectedTimeframe === '1W' ? getProfessional1WeekTicks(chartData) : 
              selectedTimeframe === '3M' ? getProfessional3MonthsTicks(chartData) : 
              selectedTimeframe === '1Y' ? getProfessional1YearTicks(chartData) : 
              undefined
            } 
            minTickGap={30}
          />
          <YAxis 
            domain={yDomain} 
            orientation="right" 
            tick={{ fontSize: 11, fill: "var(--app-text-muted)", fontWeight: 500 }} 
            axisLine={false} 
            tickLine={false} 
            width={65} 
            tickFormatter={(v) => `$${v.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`} 
          />
          <Tooltip 
            content={<CustomTooltip />} 
            cursor={{ stroke: '#3b82f6', strokeWidth: 1.5, strokeDasharray: '4 4', strokeOpacity: 0.6 }} 
          />
          
          <Line 
            type="monotone" 
            dataKey="close" 
            stroke="#2563eb" 
            strokeWidth={2.5} 
            dot={false} 
            activeDot={{ r: 6, strokeWidth: 0, fill: '#2563eb' }} 
            name="Price" 
            connectNulls={true} 
            animationDuration={1000}
          />
          
          {chartData.some(d => d.sma20) && (
            <Line 
              type="monotone" 
              dataKey="sma20" 
              stroke="#10b981" 
              strokeWidth={1.5} 
              strokeDasharray="5 3" 
              strokeOpacity={0.7} 
              dot={false} 
              name="SMA 20" 
              connectNulls={true} 
            />
          )}
          
          {chartData.some(d => d.sma50) && (
            <Line 
              type="monotone" 
              dataKey="sma50" 
              stroke="#f59e0b" 
              strokeWidth={1.5} 
              strokeDasharray="5 3" 
              strokeOpacity={0.7} 
              dot={false} 
              name="SMA 50" 
              connectNulls={true} 
            />
          )}
          
          {stockData?.previousClose && (
            <ReferenceLine 
              y={stockData.previousClose} 
              stroke="#94a3b8" 
              strokeWidth={1} 
              strokeDasharray="3 3" 
              label={{ 
                value: 'PREV CLOSE', 
                position: 'left', 
                fill: "var(--app-text-muted)", 
                fontSize: 10, 
                fontWeight: 700, 
                offset: 10,
                fontFamily: "'Inter', sans-serif"
              }} 
            />
          )}
          
          <Legend 
            verticalAlign="top" 
            align="right" 
            height={40} 
            iconType="circle" 
            iconSize={8} 
            wrapperStyle={{ paddingBottom: '20px', fontSize: '12px', fontWeight: 500, color: "var(--app-text-muted)" }}
          />
        </LineChart>
      </ResponsiveContainer>
    );
  };

  // 渲染RSI图表 - 专业金融软件风格
  const renderRSIChart = () => {
    const hasValidRSIData = chartData.some(d => d.rsi !== undefined && !isNaN(d.rsi));
    
    if (chartData.length === 0) {
      return (
        <div style={{ padding: '60px 0', textAlign: 'center', background: "var(--app-card-bg-soft)", borderRadius: '12px' }}>
          <Empty description={<span style={{color: "var(--app-text-muted)"}}>Market data unavailable for RSI</span>} image={Empty.PRESENTED_IMAGE_SIMPLE} />
        </div>
      );
    }
    
    if (!hasValidRSIData) {
      return (
        <div style={{ padding: '60px 0', textAlign: 'center', background: "var(--app-card-bg-soft)", borderRadius: '12px' }}>
          <Empty description={<span style={{color: "var(--app-text-muted)"}}>Insufficient data to calculate RSI (14)</span>} image={Empty.PRESENTED_IMAGE_SIMPLE} />
        </div>
      );
    }

    const rsiData = chartData.filter(d => d.rsi !== undefined && !isNaN(d.rsi));
    
    return (
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={rsiData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid 
            strokeDasharray="3 3" 
            stroke="var(--app-border-soft)" 
            vertical={false} 
            strokeOpacity={1} 
          />
          
          <XAxis 
            dataKey="date" 
            tick={{ fontSize: 10, fill: "var(--app-text-muted)", fontWeight: 500 }} 
            axisLine={{ stroke: "var(--app-border-soft)" }} 
            tickLine={false} 
            height={40} 
            tickFormatter={formatXAxisTick}
            ticks={
              selectedTimeframe === '1D' ? getAdaptive1DayTicks(chartData) :
              selectedTimeframe === '1W' ? getProfessional1WeekTicks(chartData) :
              selectedTimeframe === '3M' ? getProfessional3MonthsTicks(chartData) :
              selectedTimeframe === '1Y' ? getProfessional1YearTicks(chartData) :
              undefined
            }
            minTickGap={30}
          />
          
          <YAxis 
            domain={[0, 100]} 
            orientation="right" 
            tick={{ fontSize: 10, fill: "var(--app-text-muted)", fontWeight: 600 }} 
            axisLine={false} 
            tickLine={false} 
            width={40} 
            ticks={[0, 30, 50, 70, 100]} 
          />
          
          <Tooltip 
            content={<CustomTooltip isRSI />} 
            cursor={{ stroke: '#8b5cf6', strokeWidth: 1.5, strokeDasharray: '4 4', strokeOpacity: 0.6 }} 
          />
          
          <ReferenceLine 
            y={70} 
            stroke="#ef4444" 
            strokeDasharray="4 2" 
            strokeOpacity={0.6} 
            label={{ value: 'OB', position: 'insideTopRight', fill: '#ef4444', fontSize: 10, fontWeight: 700 }} 
          />
          <ReferenceLine 
            y={30} 
            stroke="#10b981" 
            strokeDasharray="4 2" 
            strokeOpacity={0.6} 
            label={{ value: 'OS', position: 'insideBottomRight', fill: '#10b981', fontSize: 10, fontWeight: 700 }} 
          />
          <ReferenceLine 
            y={50} 
            stroke="#94a3b8" 
            strokeDasharray="5 5" 
            strokeOpacity={0.4} 
          />
          
          <ReferenceArea y1={70} y2={100} fill="rgba(239,68,68,0.10)" fillOpacity={1} />
          <ReferenceArea y1={0} y2={30} fill="rgba(34,197,94,0.10)" fillOpacity={1} />
          
          <Line 
            type="monotone" 
            dataKey="rsi" 
            stroke="#8b5cf6" 
            strokeWidth={2} 
            dot={false} 
            activeDot={{ r: 5, strokeWidth: 0, fill: '#8b5cf6' }} 
            name="RSI (14)" 
            connectNulls={true} 
            animationDuration={1000}
          />
          
          <Legend 
            verticalAlign="bottom" 
            align="center" 
            height={36} 
            iconType="circle" 
            iconSize={6} 
            wrapperStyle={{ paddingTop: '10px', fontSize: '11px', fontWeight: 500, color: "var(--app-text-muted)" }}
          />
        </LineChart>
      </ResponsiveContainer>
    );
  };


  // 初始加载：只在 symbol 变化时加载全部数据
  useEffect(() => {
    if (symbol) {
      loadStockData();
      loadHistoricalPrices();
      loadPerformanceData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol]);

  // Timeframe 切换：只刷新 chart，不重载 snapshot/backtest
  useEffect(() => {
    if (symbol) {
      loadHistoricalPrices();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTimeframe]);

  // 只在初次加载（stockData还没拿到）时显示全页 spinner
  if (loading && !stockData) {
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

  return (
    <div className="analysis-page-shell">
      <style>{`
        .analysis-page-shell {
          width: 100%;
          max-width: 1380px;
          margin: 0 auto;
          padding: clamp(16px, 1.8vw, 28px);
          animation: fadeIn 0.5s ease-out;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .premium-card {
          border-radius: 16px !important;
          border: 1px solid var(--app-border-soft) !important;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.02) !important;
          background: var(--app-card-bg) !important;
          overflow: hidden;
        }
        .metric-card-hover:hover {
          transform: translateY(-1.5px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.04) !important;
          border-color: #3b82f6 !important;
        }
        .signal-card-hover:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(0,0,0,0.06) !important;
          border-color: #d1d5db !important;
        }
        .ant-radio-button-wrapper {
          height: 34px !important;
          line-height: 32px !important;
          padding: 0 12px !important;
          font-size: 13px !important;
          border-radius: 6px !important;
        }
        .ant-radio-button-wrapper {
          background-color: var(--app-card-bg-soft);
          color: var(--app-text);
          border-color: var(--app-border-soft);
        }
        .ant-radio-button-wrapper:hover {
          color: var(--app-blue-text, #3b82f6);
        }
        .ant-radio-button-wrapper-checked {
          background-color: var(--app-blue-bg, #2563eb) !important;
          color: #fff !important;
          border-color: var(--app-blue-border, #2563eb) !important;
        }
      `}</style>
      
      {/* Historical Data Warning Alert */}
      {historicalDataError && stockData && (
        <Alert
          message={
            historicalErrorType === 'config_required' ? 'Alpaca API Key Required' :
            historicalErrorType === 'auth_required' ? 'Authentication Required' :
            historicalErrorType === 'rate_limited' ? 'API Rate Limited' :
            'No Historical Bars Available'
          }
          description={
            <span style={{ fontSize: 13 }}>
              {fallbackTimeframeNotice
                ? <>Showing <strong>{fallbackTimeframeNotice}</strong> data — shorter timeframes unavailable.</>
                : historicalErrorType === 'config_required' ? 'Configure Alpaca API keys in Settings to load chart data.' :
                  historicalErrorType === 'rate_limited' ? 'Alpaca rate limit hit. Retry in a moment.' :
                  <>No bars returned for <strong>{selectedTimeframe}</strong>. Snapshot metrics still available below.</>
              }
            </span>
          }
          type={historicalErrorType === 'config_required' || historicalErrorType === 'auth_required' ? 'error' : 'warning'}
          showIcon
          closable
          onClose={() => setHistoricalDataError(null)}
          style={{ marginBottom: '16px', borderRadius: '12px' }}
          action={
            <Button size="small" type="default" ghost onClick={loadHistoricalPrices}>
              Retry
            </Button>
          }
        />
      )}

      {/* ── 头部信息 (Professional Premium Header) ── */}
      <div style={{ 
        marginBottom: 24, 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        borderBottom: "1px solid var(--app-border-soft)", 
        paddingBottom: 20,
        paddingTop: 4
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ 
            width: 56, height: 56, borderRadius: 14, 
            background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)', 
            color: '#fff', display: 'flex', alignItems: 'center', 
            justifyContent: 'center', fontSize: 24, fontWeight: 800,
            boxShadow: '0 4px 10px rgba(59, 130, 246, 0.2)'
          }}>
            {symbol?.substring(0, 1)}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <span style={{ fontSize: 28, fontWeight: 800, color: "var(--app-text-strong)", lineHeight: 1.1, letterSpacing: '-0.02em' }}>{symbol}</span>
              <span style={{ fontSize: 16, fontWeight: 500, color: "var(--app-text-muted)" }}>{stockData.name || 'Company Name'}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 6 }}>
              <span style={{ fontSize: 24, fontWeight: 700, color: "var(--app-text-strong)", lineHeight: 1 }}>${safeToFixed(stockData.price, 2)}</span>
              {stockData.change !== null && stockData.change !== undefined && stockData.changePercent !== null && stockData.changePercent !== undefined && (
                <div style={{ 
                  fontSize: 14, 
                  fontWeight: 600, 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 3,
                  color: stockData.change >= 0 ? '#10b981' : '#ef4444',
                  backgroundColor: stockData.change >= 0 ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                  padding: '2px 8px',
                  borderRadius: '6px'
                }}>
                  {stockData.change >= 0 ? <ArrowUpOutlined style={{ fontSize: 12 }} /> : <ArrowDownOutlined style={{ fontSize: 12 }} />}
                  <span>${Math.abs(stockData.change).toFixed(2)}</span>
                  <span style={{ opacity: 0.9 }}>({stockData.change >= 0 ? '+' : ''}{safeToFixed(stockData.changePercent, 2)}%)</span>
                </div>
              )}
            </div>
          </div>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Button
            size="middle"
            icon={<ReloadOutlined />}
            onClick={() => {
              loadStockData();
              loadHistoricalPrices();
            }}
            style={{ 
              borderRadius: 8, 
              fontWeight: 600, 
              color: "var(--app-text-muted)", 
              height: '38px'
            }}
          >
            Refresh
          </Button>
          <Button
            type="primary"
            size="middle"
            icon={<PlayCircleOutlined />}
            onClick={() => navigate('/backtest')}
            style={{ 
              borderRadius: 8, 
              fontWeight: 700, 
              height: '38px',
              background: '#2563eb',
              border: 'none',
              boxShadow: '0 2px 4px rgba(37, 99, 235, 0.1)'
            }}
          >
            {t.analysis.runBacktest}
          </Button>
        </div>
      </div>

      {/* ── Metric Cards (Compact Dashboard Style) ── */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', 
        gap: 12, 
        marginBottom: 24 
      }}>
        {[
          { label: t.analysis.dayHigh, value: stockData.dayHigh ? `$${safeToFixed(stockData.dayHigh, 2)}` : '—' },
          { label: t.analysis.dayLow, value: stockData.dayLow ? `$${safeToFixed(stockData.dayLow, 2)}` : '—' },
          { label: t.analysis.prevClose, value: stockData.previousClose ? `$${safeToFixed(stockData.previousClose, 2)}` : '—' },
          { label: t.analysis.marketCap, value: stockData.marketCap ? (stockData.marketCap >= 1e12 ? `$${(stockData.marketCap / 1e12).toFixed(2)}T` : stockData.marketCap >= 1e9 ? `$${(stockData.marketCap / 1e9).toFixed(2)}B` : stockData.marketCap >= 1e6 ? `$${(stockData.marketCap / 1e6).toFixed(2)}M` : `$${stockData.marketCap.toLocaleString()}`) : '—' },
          { label: t.analysis.yearHigh, value: stockData.yearHigh ? `$${safeToFixed(stockData.yearHigh, 2)}` : '—' },
          { label: t.analysis.yearLow, value: stockData.yearLow ? `$${safeToFixed(stockData.yearLow, 2)}` : '—' },
          { label: t.analysis.volume, value: stockData.volume ? `${(stockData.volume / 1000000).toFixed(2)}M` : '—' },
          {
            label: t.analysis.rangePosition,
            value: (() => {
              const pos = calculateRangePosition(stockData.price, stockData.yearHigh, stockData.yearLow);
              return pos.label;
            })(),
            color: (() => {
              const pct = calculateRangePosition(stockData.price, stockData.yearHigh, stockData.yearLow).percentage;
              if (pct === null) return 'var(--app-text-strong)';
              if (pct >= 80) return '#10b981';
              if (pct <= 20) return '#ef4444';
              return 'var(--app-text-strong)';
            })()
          },
        ].map((m, idx) => (
          <div 
            key={idx}
            className="premium-card metric-card-hover"
            style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '82px' }}
          >
            <div style={{ fontSize: 10.5, color: "var(--app-text-muted)", fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
              {m.label}
            </div>
            <div style={{ fontSize: 17, fontWeight: 700, color: m.color || 'var(--app-text-strong)', lineHeight: 1.1 }}>
              {m.value}
            </div>
          </div>
        ))}
      </div>

      {/* 图表区域 - 强化 */}

      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col span={24}>
          <Card 
            className="premium-card chart-container-card"
            bodyStyle={{ padding: '16px 20px' }}
          >
            <div className="chart-header-row" style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: '18px', fontWeight: '800', color: "var(--app-text-strong)" }}>{t.analysis.priceAnalysis}</span>
                <Tag style={{ borderRadius: 6, fontSize: 10, background: "var(--app-card-bg-soft)", color: "var(--app-text-muted)", border: "1px solid var(--app-border-soft)", margin: 0 }}>
                  Market data delayed by 15 min
                </Tag>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                {chartData.length >= 2 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {(() => {
                      const lastCloseVal = chartData[chartData.length - 1].close;
                      const firstCloseVal = chartData[0].close;
                      let dailyChg = stockData.changePercent || 0;
                      let periodChg = firstCloseVal > 0 ? ((lastCloseVal - firstCloseVal) / firstCloseVal) * 100 : 0;

                      const MetricChip = ({ label, value, color }: { label: string, value: string, color?: string }) => (
                        <div style={{ 
                          padding: '4px 10px', 
                          background: "var(--app-card-bg-soft)", 
                          border: '1px solid rgba(15, 23, 42, 0.08)', 
                          borderRadius: '10px',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          minWidth: '82px'
                        }}>
                          <span style={{ fontSize: '9px', color: "var(--app-text-muted)", fontWeight: 700, textTransform: 'uppercase', lineHeight: 1.2 }}>{label}</span>
                          <span style={{ fontSize: '14px', fontWeight: 800, color: color || 'var(--app-text-strong)', lineHeight: 1.2 }}>{value}</span>
                        </div>
                      );

                      return (
                        <>
                          <MetricChip label="Last Close" value={`$${lastCloseVal.toFixed(2)}`} />
                          <MetricChip 
                            label="Daily Chg" 
                            value={`${dailyChg >= 0 ? '+' : ''}${dailyChg.toFixed(2)}%`} 
                            color={dailyChg >= 0 ? '#10b981' : '#ef4444'} 
                          />
                          <MetricChip 
                            label="Period Chg" 
                            value={`${periodChg >= 0 ? '+' : ''}${periodChg.toFixed(2)}%`} 
                            color={periodChg >= 0 ? '#10b981' : '#ef4444'} 
                          />
                        </>
                      );
                    })()}
                  </div>
                )}

                <div style={{ width: 1, height: 24, background: "var(--app-border-soft)", margin: '0 4px' }} />

                <Radio.Group 
                  value={selectedTimeframe} 
                  onChange={(e) => setSelectedTimeframe(e.target.value)}
                  size="small"
                >
                  {Object.keys(TIMEFRAMES).map(tf => (
                    <Radio.Button key={tf} value={tf} style={{ height: 34, lineHeight: '32px', padding: '0 12px', fontSize: '13px', fontWeight: 600 }}>{tf}</Radio.Button>
                  ))}
                </Radio.Group>
              </div>
            </div>

            <div style={{ width: '100%', height: 'calc(100% - 60px)', minHeight: 340 }}>
              {chartLoading ? (
                <div style={{ height: 340, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Spin tip="Loading chart data..." />
                </div>
              ) : chartData.length === 0 ? (
                <div style={{ height: 340, display: 'flex', alignItems: 'center', justifyContent: 'center', background: "var(--app-card-bg-soft)", borderRadius: 12 }}>
                  <Empty description="No price history data available" />
                </div>
              ) : (
                renderPriceChart()
              )}
            </div>
          </Card>
        </Col>
      </Row>

      {/* Signal Summary - 信号摘要 (Refined Premium Version) */}
      <Row gutter={[16, 16]} style={{ marginBottom: '32px' }}>
        <Col span={24}>
          <Card
            bordered={false}
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <BarChartOutlined style={{ color: '#3b82f6', fontSize: '20px' }} />
                <span style={{ fontSize: '20px', fontWeight: '700', color: "var(--app-text-strong)" }}>
                  {t.analysis.technicalSignalSummary}
                </span>
              </div>
            }
            style={{
              borderRadius: '24px',
              border: "1px solid var(--app-border-soft)",
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)',
              overflow: 'hidden'
            }}
            bodyStyle={{ padding: '32px' }}
          >
            <Row gutter={[24, 24]}>
              {/* Trend Bias */}
              <Col xs={24} sm={12} md={8}>
                <div 
                  className="signal-card-hover"
                  style={{
                    padding: '24px',
                    border: "1px solid var(--app-border-soft)",
                    borderRadius: '20px',
                    background: "var(--app-card-bg-soft)",
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between'
                  }}
                >
                  <div>
                    <div style={{
                      fontSize: '13px',
                      color: "var(--app-text-muted)",
                      fontWeight: '700',
                      marginBottom: '16px',
                      display: 'flex',
                      alignItems: 'center',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}>
                      <LineChartOutlined style={{ marginRight: '10px', fontSize: '14px', color: '#3b82f6' }} />
                      {t.analysis.trendBias}
                    </div>
                    <div style={{ fontSize: '24px', fontWeight: '800', marginBottom: '8px' }}>
                      {(() => {
                        const hasEnoughData = chartData.length >= 20;
                        if (!stockData.price || !hasEnoughData) return <span style={{ color: "var(--app-text-muted)" }}>{t.analysis.analyzing}</span>;
                        
                        const currentPrice = stockData.price;
                        const lastChartData = chartData[chartData.length - 1];
                        const sma20 = lastChartData?.sma20;
                        const sma50 = lastChartData?.sma50;
                        const rsi = lastChartData?.rsi;
                        
                        let bullishScore = 0;
                        let bearishScore = 0;
                        
                        if (sma20) {
                          if (currentPrice > sma20) bullishScore += 1;
                          else bearishScore += 1;
                        }
                        if (sma50) {
                          if (currentPrice > sma50) bullishScore += 1;
                          else bearishScore += 1;
                        }
                        if (sma20 && sma50) {
                          if (sma20 > sma50) bullishScore += 1;
                          else bearishScore += 1;
                        }
                        if (rsi) {
                          if (rsi > 70) bearishScore += 1;
                          else if (rsi < 30) bullishScore += 1;
                          else if (rsi > 50) bullishScore += 0.5;
                          else bearishScore += 0.5;
                        }
                        
                        const scoreDiff = bullishScore - bearishScore;
                        if (scoreDiff > 1.5) return <span style={{ color: '#10b981' }}><ArrowUpOutlined /> {t.analysis.strongBullish}</span>;
                        if (scoreDiff > 0.5) return <span style={{ color: '#10b981', opacity: 0.8 }}><ArrowUpOutlined /> {t.analysis.bullish}</span>;
                        if (scoreDiff < -1.5) return <span style={{ color: '#ef4444' }}><ArrowDownOutlined /> {t.analysis.strongBearish}</span>;
                        if (scoreDiff < -0.5) return <span style={{ color: '#ef4444', opacity: 0.8 }}><ArrowDownOutlined /> {t.analysis.bearish}</span>;
                        return <span style={{ color: "var(--app-text-muted)" }}>{t.analysis.neutral}</span>;
                      })()}
                    </div>
                  </div>
                  <div style={{ fontSize: '12px', color: "var(--app-text-muted)", lineHeight: '1.6', fontWeight: 500 }}>
                    {t.analysis.trendDescription.replace('{count}', String(chartData.length))}
                  </div>
                </div>
              </Col>

              {/* RSI State */}
              <Col xs={24} sm={12} md={8}>
                <div 
                  className="signal-card-hover"
                  style={{
                    padding: '24px',
                    border: "1px solid var(--app-border-soft)",
                    borderRadius: '20px',
                    background: "var(--app-card-bg-soft)",
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between'
                  }}
                >
                  <div>
                    <div style={{
                      fontSize: '13px',
                      color: "var(--app-text-muted)",
                      fontWeight: '700',
                      marginBottom: '16px',
                      display: 'flex',
                      alignItems: 'center',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}>
                      <BarChartOutlined style={{ marginRight: '10px', fontSize: '14px', color: '#8b5cf6' }} />
                      {t.analysis.momentumRSI}
                    </div>
                    <div style={{ fontSize: '24px', fontWeight: '800', marginBottom: '8px' }}>
                      {(() => {
                        const validRSI = chartData.filter(d => d.rsi !== undefined && !isNaN(d.rsi));
                        if (validRSI.length === 0) return <span style={{ color: "var(--app-text-muted)" }}>{t.analysis.noRSIData}</span>;
                        const latestRSI = validRSI[validRSI.length - 1].rsi!;
                        if (latestRSI >= 70) return <span style={{ color: '#ef4444' }}>{t.analysis.overbought}</span>;
                        if (latestRSI <= 30) return <span style={{ color: '#10b981' }}>{t.analysis.oversold}</span>;
                        if (latestRSI > 55) return <span style={{ color: '#10b981', opacity: 0.8 }}>{t.analysis.bullish}</span>;
                        if (latestRSI < 45) return <span style={{ color: '#ef4444', opacity: 0.8 }}>{t.analysis.bearish}</span>;
                        return <span style={{ color: "var(--app-text-muted)" }}>{t.analysis.neutral}</span>;
                      })()}
                    </div>
                  </div>
                  <div style={{ fontSize: '12px', color: "var(--app-text-muted)", lineHeight: '1.6', fontWeight: 500 }}>
                    {t.analysis.rsiDescription.replace('{value}', chartData[chartData.length - 1]?.rsi?.toFixed(2) || '—')}
                  </div>
                </div>
              </Col>

              {/* 52W Position */}
              <Col xs={24} sm={12} md={8}>
                <div 
                  className="signal-card-hover"
                  style={{
                    padding: '24px',
                    border: "1px solid var(--app-border-soft)",
                    borderRadius: '20px',
                    background: "var(--app-card-bg-soft)",
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between'
                  }}
                >
                  <div>
                    <div style={{
                      fontSize: '13px',
                      color: "var(--app-text-muted)",
                      fontWeight: '700',
                      marginBottom: '16px',
                      display: 'flex',
                      alignItems: 'center',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}>
                      <InfoCircleOutlined style={{ marginRight: '10px', fontSize: '14px', color: '#f59e0b' }} />
                      {t.analysis.rangePosition}
                    </div>
                    <div style={{ fontSize: '24px', fontWeight: '800', marginBottom: '8px' }}>
                      {(() => {
                        const pos = calculateRangePosition(stockData.price, stockData.yearHigh, stockData.yearLow);
                        let color = '#64748b';
                        if (pos.percentage !== null) {
                          if (pos.percentage >= 80) color = '#10b981';
                          else if (pos.percentage >= 60) color = '#34d399';
                          else if (pos.percentage <= 20) color = '#ef4444';
                          else if (pos.percentage <= 40) color = '#f87171';
                        }
                        return <span style={{ color }}>{pos.label}</span>;
                      })()}
                    </div>
                  </div>
                  <div style={{ fontSize: '12px', color: "var(--app-text-muted)", lineHeight: '1.6', fontWeight: 500 }}>
                    {t.analysis.rangeDescription.replace('{high}', `$${(stockData.yearHigh || 0).toFixed(2)}`).replace('{low}', `$${(stockData.yearLow || 0).toFixed(2)}`)}
                  </div>
                </div>
              </Col>
            </Row>

            <Row gutter={[24, 24]} style={{ marginTop: '24px' }}>
              {[
                {
                  label: t.analysis.priceVsSMA20,
                  value: (() => {
                    const last = chartData[chartData.length-1];
                    if (!last?.sma20 || !stockData.price) return '—';
                    const diff = ((stockData.price - last.sma20) / last.sma20) * 100;
                    return `${diff > 0 ? '+' : ''}${diff.toFixed(2)}%`;
                  })(),
                  status: (() => {
                    const last = chartData[chartData.length-1];
                    if (!last?.sma20 || !stockData.price) return 'neutral';
                    return stockData.price > last.sma20 ? 'bullish' : 'bearish';
                  })()
                },
                {
                  label: t.analysis.priceVsSMA50,
                  value: (() => {
                    const last = chartData[chartData.length-1];
                    if (!last?.sma50 || !stockData.price) return '—';
                    const diff = ((stockData.price - last.sma50) / last.sma50) * 100;
                    return `${diff > 0 ? '+' : ''}${diff.toFixed(2)}%`;
                  })(),
                  status: (() => {
                    const last = chartData[chartData.length-1];
                    if (!last?.sma50 || !stockData.price) return 'neutral';
                    return stockData.price > last.sma50 ? 'bullish' : 'bearish';
                  })()
                },
                {
                  label: t.analysis.sma20VsSMA50,
                  value: (() => {
                    const last = chartData[chartData.length-1];
                    if (!last?.sma20 || !last?.sma50) return '—';
                    const diff = ((last.sma20 - last.sma50) / last.sma50) * 100;
                    return `${diff > 0 ? '+' : ''}${diff.toFixed(2)}%`;
                  })(),
                  status: (() => {
                    const last = chartData[chartData.length-1];
                    if (!last?.sma20 || !last?.sma50) return 'neutral';
                    return last.sma20 > last.sma50 ? 'bullish' : 'bearish';
                  })()
                },
                {
                  label: t.analysis.volumeTrend,
                  value: (() => {
                    if (chartData.length < 10) return '—';
                    const recent = chartData.slice(-5).reduce((a, b) => a + b.volume, 0) / 5;
                    const prev = chartData.slice(-10, -5).reduce((a, b) => a + b.volume, 0) / 5;
                    if (prev === 0) return 'N/A';
                    const diff = ((recent - prev) / prev) * 100;
                    return `${diff > 0 ? '+' : ''}${diff.toFixed(0)}%`;
                  })(),
                  status: 'neutral'
                }
              ].map((item, idx) => (
                <Col xs={12} md={6} key={idx}>
                  <div style={{
                    padding: '16px 20px',
                    borderRadius: '16px',
                    background: "var(--app-card-bg)",
                    border: "1px solid var(--app-border-soft)",
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                  }}>
                    <span style={{ fontSize: '11px', color: "var(--app-text-muted)", fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.025em' }}>{item.label}</span>
                    <span style={{ 
                      fontSize: '18px', 
                      fontWeight: '800', 
                      color: item.status === 'bullish' ? '#10b981' : item.status === 'bearish' ? '#ef4444' : 'var(--app-text-strong)'
                    }}>
                      {item.value}
                    </span>
                  </div>
                </Col>
              ))}
            </Row>
          </Card>
        </Col>
      </Row>

              {/* Trade Setup Analysis - 交易设置分析 (Premium Refinement) */}
      <Row gutter={[16, 16]} style={{ marginBottom: '32px' }}>
        <Col span={24}>
          <Card
            bordered={false}
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <LineChartOutlined style={{ color: '#10b981', fontSize: '20px' }} />
                <span style={{ fontSize: '20px', fontWeight: '700', color: "var(--app-text-strong)" }}>
                  {t.analysis.tradeSetupReference}
                </span>
              </div>
            }
            style={{
              borderRadius: '24px',
              border: "1px solid var(--app-border-soft)",
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)'
            }}
            bodyStyle={{ padding: '32px' }}
          >
            <Row gutter={[24, 24]}>
              {/* Support / Resistance */}
              <Col xs={24} md={8}>
                <div style={{
                  padding: '24px',
                  borderRadius: '20px',
                  background: "var(--app-card-bg-soft)",
                  border: "1px solid var(--app-border-soft)",
                  height: '100%'
                }}>
                  <div style={{ fontSize: '13px', color: "var(--app-text-muted)", fontWeight: '700', marginBottom: '20px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {t.analysis.supportResistance}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div>
                      <div style={{ fontSize: '11px', color: "var(--app-text-muted)", fontWeight: 600, marginBottom: '6px' }}>{t.analysis.supportLevels}</div>
                      {(() => {
                        const hasEnoughData = chartData.length >= 20;
                        if (!stockData.price || !hasEnoughData) return <div style={{ color: "var(--app-text-muted)" }}>{t.analysis.analyzing}</div>;
                        const dataToUse = chartData.slice(-40);
                        const recentLows = dataToUse.map(d => d.low);
                        const minLow = Math.min(...recentLows);
                        return (
                          <div style={{ display: 'flex', gap: '12px' }}>
                            <Tag style={{ borderRadius: "6px", fontWeight: 700, margin: 0, background: "rgba(34,197,94,0.14)", color: "#4ade80", border: "none" }}>S1: ${(minLow * 0.99).toFixed(2)}</Tag>
                            <Tag style={{ borderRadius: "6px", fontWeight: 700, margin: 0, background: "rgba(34,197,94,0.14)", color: "#4ade80", border: "none", opacity: 0.7 }}>S2: ${(minLow * 0.97).toFixed(2)}</Tag>
                          </div>
                        );
                      })()}
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', color: "var(--app-text-muted)", fontWeight: 600, marginBottom: '6px' }}>{t.analysis.resistanceLevels}</div>
                      {(() => {
                        const hasEnoughData = chartData.length >= 20;
                        if (!stockData.price || !hasEnoughData) return <div style={{ color: "var(--app-text-muted)" }}>{t.analysis.analyzing}</div>;
                        const dataToUse = chartData.slice(-40);
                        const recentHighs = dataToUse.map(d => d.high);
                        const maxHigh = Math.max(...recentHighs);
                        return (
                          <div style={{ display: 'flex', gap: '12px' }}>
                            <Tag style={{ borderRadius: "6px", fontWeight: 700, margin: 0, background: "rgba(239,68,68,0.14)", color: "#f87171", border: "none" }}>R1: ${(maxHigh * 1.01).toFixed(2)}</Tag>
                            <Tag style={{ borderRadius: "6px", fontWeight: 700, margin: 0, background: "rgba(239,68,68,0.14)", color: "#f87171", border: "none", opacity: 0.7 }}>R2: ${(maxHigh * 1.03).toFixed(2)}</Tag>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              </Col>

              {/* Reference Levels */}
              <Col xs={24} md={8}>
                <div style={{
                  padding: '24px',
                  borderRadius: '20px',
                  background: "var(--app-card-bg-soft)",
                  border: "1px solid var(--app-border-soft)",
                  height: '100%'
                }}>
                  <div style={{ fontSize: '13px', color: "var(--app-text-muted)", fontWeight: '700', marginBottom: '20px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {t.analysis.riskManagement}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '13px', color: "var(--app-text-muted)", fontWeight: 500 }}>{t.analysis.entryTarget}</span>
                      <span style={{ fontSize: '16px', fontWeight: '700', color: '#3b82f6' }}>${((stockData.price || 0) * 0.995).toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '13px', color: "var(--app-text-muted)", fontWeight: 500 }}>{t.analysis.stopLoss}</span>
                      <span style={{ fontSize: '16px', fontWeight: '700', color: '#ef4444' }}>
                        {(() => {
                          const dataToUse = chartData.slice(-20);
                          if (dataToUse.length === 0) return '—';
                          return `$${(Math.min(...dataToUse.map(d => d.low)) * 0.98).toFixed(2)}`;
                        })()}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '13px', color: "var(--app-text-muted)", fontWeight: 500 }}>{t.analysis.takeProfit}</span>
                      <span style={{ fontSize: '16px', fontWeight: '700', color: '#10b981' }}>
                        {(() => {
                          const dataToUse = chartData.slice(-20);
                          if (dataToUse.length === 0) return '—';
                          return `$${(Math.max(...dataToUse.map(d => d.high)) * 1.05).toFixed(2)}`;
                        })()}
                      </span>
                    </div>
                  </div>
                </div>
              </Col>

              {/* R/R Ratio */}
              <Col xs={24} md={8}>
                <div style={{
                  padding: '24px',
                  borderRadius: '20px',
                  background: "var(--app-card-bg-soft)",
                  border: "1px solid var(--app-border-soft)",
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '12px', color: "var(--app-blue-text, #3b82f6)", fontWeight: '700', marginBottom: '8px', textTransform: 'uppercase' }}>
                    {t.analysis.riskRewardRatio}
                  </div>
                  <div style={{ fontSize: '42px', fontWeight: '900', color: "var(--app-text-strong)", lineHeight: 1 }}>
                    {(() => {
                      if (!stockData.price || chartData.length < 10) return '—';
                      const dataToUse = chartData.slice(-10);
                      const stop = Math.min(...dataToUse.map(d => d.low)) * 0.98;
                      const target = Math.max(...chartData.slice(-20).map(d => d.high)) * 1.05;
                      const entry = stockData.price * 0.995;
                      const risk = entry - stop;
                      const reward = target - entry;
                      if (risk <= 0) return 'Invalid';
                      const ratio = reward / risk;
                      return `${ratio.toFixed(1)}:1`;
                    })()}
                  </div>
                  <div style={{ 
                    marginTop: '12px', 
                    fontSize: '13px', 
                    fontWeight: '600',
                    color: (() => {
                      const dataToUse = chartData.slice(-10);
                      const stop = Math.min(...dataToUse.map(d => d.low)) * 0.98;
                      const target = Math.max(...chartData.slice(-20).map(d => d.high)) * 1.05;
                      const entry = (stockData.price || 0) * 0.995;
                      const ratio = (target - entry) / (entry - stop);
                      return ratio >= 2 ? '#059669' : ratio >= 1 ? '#d97706' : '#dc2626';
                    })()
                  }}>
                    {(() => {
                      const dataToUse = chartData.slice(-10);
                      const stop = Math.min(...dataToUse.map(d => d.low)) * 0.98;
                      const target = Math.max(...chartData.slice(-20).map(d => d.high)) * 1.05;
                      const entry = (stockData.price || 0) * 0.995;
                      const ratio = (target - entry) / (entry - stop);
                      if (ratio >= 2) return t.analysis.excellentSetup;
                      if (ratio >= 1.5) return t.analysis.goodSetup;
                      if (ratio >= 1) return t.analysis.fairSetup;
                      return t.analysis.poorSetup;
                    })()}
                  </div>
                </div>
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>

      {/* 技术指标 - 更充实 (Premium Tabs) */}
      <Row gutter={[16, 16]} style={{ marginBottom: '32px' }}>
        <Col span={24}>
          <Card
            bordered={false}
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <RadarChartOutlined style={{ color: '#8b5cf6', fontSize: '20px' }} />
                <span style={{ fontSize: '20px', fontWeight: '700', color: "var(--app-text-strong)" }}>
                  {t.analysis.technicalIndicators}
                </span>
              </div>
            }
            style={{
              borderRadius: '24px',
              border: "1px solid var(--app-border-soft)",
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)',
              overflow: 'hidden'
            }}
            bodyStyle={{ padding: '0' }}
          >
            <Tabs
              defaultActiveKey="rsi"
              size="large"
              style={{ padding: '0 32px' }}
              tabBarStyle={{
                marginBottom: 0,
                borderBottom: "1px solid var(--app-border-soft)"
              }}
            >
              <TabPane
                tab={
                  <span style={{ fontSize: '15px', fontWeight: '600' }}>
                    {t.analysis.relativeStrength}
                  </span>
                }
                key="rsi"
              >
                <div style={{ padding: '32px 0' }}>
                  {renderRSIChart()}
                </div>
              </TabPane>
              <TabPane
                tab={
                  <span style={{ fontSize: '15px', fontWeight: '600' }}>
                    {t.analysis.movingAverages}
                  </span>
                }
                key="ma"
              >
                <div style={{ padding: '32px 0' }}>
                  <Row gutter={[24, 24]}>
                    {[
                      { label: t.analysis.currentPrice, value: `$${safeToFixed(stockData.price, 2)}`, color: '#3b82f6', bg: "var(--app-card-bg-soft)" },
                      { 
                        label: 'SMA 20', 
                        value: chartData[chartData.length - 1]?.sma20 ? `$${safeToFixed(chartData[chartData.length - 1].sma20, 2)}` : 'N/A',
                        color: '#10b981', bg: "var(--app-card-bg-soft)"
                      },
                      { 
                        label: 'SMA 50', 
                        value: chartData[chartData.length - 1]?.sma50 ? `$${safeToFixed(chartData[chartData.length - 1].sma50, 2)}` : 'N/A',
                        color: '#f59e0b', bg: "var(--app-card-bg-soft)"
                      },
                    ].map((item, idx) => (
                      <Col xs={24} md={8} key={idx}>
                        <div style={{
                          padding: '24px',
                          borderRadius: '20px',
                          background: item.bg,
                          textAlign: 'center',
                          border: '1px solid transparent',
                          transition: 'all 0.2s ease'
                        }}>
                          <div style={{ fontSize: '12px', color: "var(--app-text-muted)", fontWeight: '700', marginBottom: '8px', textTransform: 'uppercase' }}>{item.label}</div>
                          <div style={{ fontSize: '32px', fontWeight: '900', color: item.color, lineHeight: 1 }}>{item.value}</div>
                        </div>
                      </Col>
                    ))}
                  </Row>
                  
                  <div style={{ marginTop: '24px', padding: '20px', background: "var(--app-card-bg-soft)", borderRadius: '16px', border: "1px solid var(--app-border-soft)" }}>
                    <div style={{ fontSize: '14px', fontWeight: '700', color: "var(--app-text-strong)", marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <InfoCircleOutlined style={{ color: '#3b82f6' }} />
                      {t.analysis.analysisInsights}
                    </div>
                    <div style={{ fontSize: '13px', color: "var(--app-text-muted)", lineHeight: '1.6' }}>
                      {(() => {
                        const last = chartData[chartData.length - 1];
                        if (!last?.sma20 || !last?.sma50) return t.analysis.maInsufficient;
                        const price = stockData.price || 0;
                        let insights = [];
                        if (price > last.sma20) insights.push(t.analysis.maAbove20);
                        else insights.push(t.analysis.maBelow20);
                        if (last.sma20 > last.sma50) insights.push(t.analysis.ma20Above50);
                        return insights.join(' ');
                      })()}
                    </div>
                  </div>
                </div>
              </TabPane>
            </Tabs>
          </Card>
        </Col>
      </Row>

      {/* 底部信息 (Company Info & History) */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card
            bordered={false}
            title={<span style={{ fontSize: '18px', fontWeight: '700' }}>{t.analysis.companyInsights}</span>}
            style={{ borderRadius: '24px', border: "1px solid var(--app-border-soft)", height: '100%' }}
            bodyStyle={{ padding: '24px' }}
          >
            <Row gutter={[24, 24]}>
              {[
                { label: t.analysis.sector, value: stockData.sector ? translateSector(stockData.sector) : 'N/A' },
                { label: t.analysis.industry, value: stockData.industry ? translateSector(stockData.industry) : 'N/A' },
                { label: t.analysis.peRatio, value: stockData.peRatio ? safeToFixed(stockData.peRatio, 2) : 'N/A' },
                { label: t.analysis.divYield, value: stockData.dividendYield ? `${safeToFixed(stockData.dividendYield, 2)}%` : 'N/A' },
              ].map((item, idx) => (
                <Col span={12} key={idx}>
                  <div style={{ fontSize: '12px', color: "var(--app-text-muted)", fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>{item.label}</div>
                  <div style={{ fontSize: '16px', fontWeight: '700', color: "var(--app-text-strong)" }}>{item.value}</div>
                </Col>
              ))}
            </Row>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card
            bordered={false}
            title={<span style={{ fontSize: '18px', fontWeight: '700' }}>{t.analysis.recentPerformance}</span>}
            style={{ borderRadius: '24px', border: "1px solid var(--app-border-soft)", height: '100%' }}
            bodyStyle={{ padding: '24px' }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {[
                { label: t.analysis.monthReturn, data: formatReturn(performanceData.oneMonth) },
                { label: t.analysis.threeMonthReturn, data: formatReturn(performanceData.threeMonth) },
                { label: t.analysis.yearToDate, data: formatReturn(performanceData.ytd) },
              ].map((item, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: "var(--app-card-bg-soft)", borderRadius: '12px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 500, color: "var(--app-text-muted)" }}>{item.label}</span>
                  <span style={{ fontSize: '16px', fontWeight: '700', color: item.data.color }}>{item.data.text}</span>
                </div>
              ))}
            </div>
          </Card>
        </Col>
      </Row>
      {/* 数据源信息 */}
      <Row style={{ marginTop: '32px', paddingTop: '16px', borderTop: "1px solid var(--app-border-soft)" }}>
        <Col span={24}>
          <div style={{ fontSize: '12px', color: "var(--app-text-muted)", textAlign: 'left', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <DataSourceBadge source={dataSource} />
            <span>•</span>
            <span>{t.analysis.dataUpdated} {stockData.timestamp ? new Date(stockData.timestamp).toLocaleString() : 'N/A'}</span>
          </div>
        </Col>
      </Row>
    </div>
  );
};

export default SymbolAnalysis;