import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button, Spin, Empty, Alert, message, Radio } from 'antd';
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
import { useLanguage } from '../contexts/LanguageContext';
import { backtestForSymbolPath } from '../routes/marketRoutes';
import './SymbolAnalysisEditorial.css';

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
  const zh = language === 'zh-CN';
  const stateCopy = React.useMemo(() => zh ? ({
    unknownError: '未知错误', stockLoadError: '无法加载标的行情', stockToast: '行情加载失败',
    barsUnavailable: '该周期暂无 K 线，已切换到', showingInstead: '数据。', noBars: '所有可用周期均暂无历史 K 线。',
    authRequired: '登录状态已失效，请重新登录。', rateLimited: '行情接口请求频率受限，请稍后重试。', chartLoadError: '图表加载失败',
    historyToast: '历史行情加载失败', chartUnavailable: '暂无图表数据', noBarsFor: '未返回历史 K 线：', retry: '重新加载',
    rsiUnavailable: '暂无用于 RSI 的行情数据', rsiInsufficient: '数据不足，无法计算 RSI（14）',
    price: '价格', change: '涨跌幅',
    stockErrorTitle: '无法加载标的行情', stockErrorLead: '未能加载以下标的的数据：', possibleCauses: '可能原因：',
    backend: '行情服务暂时不可用', apiKey: '数据连接未完成或已失效', network: '网络连接异常', symbolMissing: '标的代码不存在或暂不支持',
    retryLead: '请检查连接状态后重试。', noData: '未找到数据：',
  }) : ({
    unknownError: 'Unknown error', stockLoadError: 'Failed to load stock data', stockToast: 'Market data load failed',
    barsUnavailable: 'bars are unavailable. Showing', showingInstead: 'data instead.', noBars: 'No historical bars are available for any timeframe.',
    authRequired: 'Your session has expired. Please sign in again.', rateLimited: 'Market data is rate limited. Please try again later.', chartLoadError: 'Error loading chart',
    historyToast: 'Historical data load failed', chartUnavailable: 'Chart data unavailable', noBarsFor: 'No historical bars were returned for', retry: 'Retry loading data',
    rsiUnavailable: 'Market data unavailable for RSI', rsiInsufficient: 'Insufficient data to calculate RSI (14)',
    price: 'Price', change: 'Change',
    stockErrorTitle: 'Unable to load market data', stockErrorLead: 'Could not load data for:', possibleCauses: 'Possible causes:',
    backend: 'The market-data service is temporarily unavailable', apiKey: 'The data connection is incomplete or expired', network: 'There is a network connection issue', symbolMissing: 'The symbol does not exist or is not supported',
    retryLead: 'Check the connection status and try again.', noData: 'No data found for',
  }), [zh]);

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
  const stockRequestIdRef = useRef(0);
  const historyRequestIdRef = useRef(0);
  const performanceRequestIdRef = useRef(0);

  // Message deduplication key
  const HISTORY_ERROR_KEY = 'historical_data_error';

  // 加载股票数据
  const loadStockData = useCallback(async () => {
    if (!symbol) return;

    const requestId = ++stockRequestIdRef.current;

    try {
      setLoading(true);
      setStockDataError(null);
      const data = await marketDataService.getStockData(symbol);

      if (requestId !== stockRequestIdRef.current) return;

      setStockData(data);
      setDataSource(data.dataSource || 'Finnhub');
      // No success message needed for every load, keep it clean
    } catch (error: any) {
      if (requestId !== stockRequestIdRef.current) return;
      console.error('Failed to fetch stock data:', error);
      const errorMsg = zh
        ? stateCopy.stockLoadError
        : (error.message || stateCopy.unknownError);
      setStockDataError(errorMsg);
      message.error({ content: `${stateCopy.stockToast}: ${symbol}`, key: 'stock_data_error' });
    } finally {
      if (requestId === stockRequestIdRef.current) setLoading(false);
    }
  }, [symbol, stateCopy.stockLoadError, stateCopy.stockToast, stateCopy.unknownError, zh]);

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

    const requestId = ++historyRequestIdRef.current;
    const isCurrentRequest = () => requestId === historyRequestIdRef.current;

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

      if (!isCurrentRequest()) return;

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
          setFallbackTimeframeNotice(zh
            ? `${requestedLabel} ${stateCopy.barsUnavailable} ${displayedLabel} ${stateCopy.showingInstead}`
            : `${requestedLabel} ${stateCopy.barsUnavailable} ${displayedLabel} ${stateCopy.showingInstead}`);
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
          if (!isCurrentRequest()) return;
          if (fbResponse.data && fbResponse.data.length > 0) {
            // Fallback succeeded
            const fbLabel = TIMEFRAMES[fbTimeframe]?.label || fbTimeframe;
            setFallbackTimeframeNotice(`${selectedTimeframe} ${stateCopy.barsUnavailable} ${fbLabel} ${stateCopy.showingInstead}`);
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
      setHistoricalDataError(stateCopy.noBars);

    } catch (error: any) {
      if (!isCurrentRequest()) return;
      console.error('Failed to fetch historical data:', error);
      const errorMsg = error.message || stateCopy.unknownError;

      if (errorMsg.includes('auth_required')) {
        setHistoricalErrorType('auth_required');
        setHistoricalDataError(stateCopy.authRequired);
      } else if (errorMsg.includes('rate_limited')) {
        setHistoricalErrorType('rate_limited');
        setHistoricalDataError(stateCopy.rateLimited);
      } else {
        setHistoricalErrorType('api_error');
        setHistoricalDataError(
          zh ? stateCopy.chartLoadError : `${stateCopy.chartLoadError}: ${errorMsg}`,
        );
        message.error({
          content: stateCopy.historyToast,
          key: HISTORY_ERROR_KEY
        });
      }

      setHistoricalData([]);
      setChartData([]);
    } finally {
      if (isCurrentRequest()) setChartLoading(false);
    }
  }, [symbol, selectedTimeframe, HISTORY_ERROR_KEY, processHistoricalResponse, stateCopy, zh]);

  // Load 1Y data for computing Recent Performance returns
  const loadPerformanceData = useCallback(async () => {
    if (!symbol) return;
    const requestId = ++performanceRequestIdRef.current;
    try {
      const response = await marketDataService.getStockHistory(symbol, '1Y');
      if (requestId !== performanceRequestIdRef.current) return;
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
      if (requestId !== performanceRequestIdRef.current) return;
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
      <div className="sa-chart-tooltip">
        <div className="sa-chart-tooltip__date">
          {isDaily || isWeekly ? formatAsNewYorkTime(date, true) : date.toLocaleDateString()}
        </div>
        
        {isRSI ? (
          <div className="sa-chart-tooltip__row">
            <span>RSI (14):</span>
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
          <div className="sa-chart-tooltip__body">
            <div className="sa-chart-tooltip__row">
            <span>{stateCopy.price}:</span>
              <span style={{ fontWeight: '700', color: '#1677ff', fontSize: '14px' }}>
                ${data.close.toFixed(2)}
              </span>
            </div>
            {!isDaily && (
              <div className="sa-chart-tooltip__ohlc">
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: "var(--app-text-muted)" }}>O:</span><span>{data.open.toFixed(2)}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: "var(--app-text-muted)" }}>H:</span><span style={{ color: '#10b981' }}>{data.high.toFixed(2)}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: "var(--app-text-muted)" }}>L:</span><span style={{ color: '#ef4444' }}>{data.low.toFixed(2)}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: "var(--app-text-muted)" }}>V:</span><span>{data.volume > 1e6 ? (data.volume/1e6).toFixed(1)+'M' : (data.volume/1e3).toFixed(0)+'K'}</span></div>
              </div>
            )}
            {stockData?.previousClose && (
              <div className="sa-chart-tooltip__row sa-chart-tooltip__change">
                <span>{stateCopy.change}:</span>
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
      <div className="sa-chart-state">
        <InfoCircleOutlined />
        <strong>{stateCopy.chartUnavailable}</strong>
        <span>
          {stateCopy.noBarsFor} {symbol} · {timeframeLabels[selectedTimeframe] || selectedTimeframe}
        </span>
        <Button 
          icon={<ReloadOutlined />} 
          onClick={loadHistoricalPrices} 
        >
          {stateCopy.retry}
        </Button>
      </div>
    );

    const yDomain = getYAxisDomain();
    
    return (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid 
            strokeDasharray="3 3" 
            stroke="var(--app-border-soft)" 
            vertical={false} 
            strokeOpacity={1} 
          />
          <XAxis 
            dataKey="date" 
            tick={{ fontSize: 12, fill: "var(--sa-muted)", fontWeight: 500 }}
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
            tick={{ fontSize: 12, fill: "var(--sa-muted)", fontWeight: 500 }}
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
                fontSize: 12,
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
          <Empty description={<span style={{color: "var(--app-text-muted)"}}>{stateCopy.rsiUnavailable}</span>} image={Empty.PRESENTED_IMAGE_SIMPLE} />
        </div>
      );
    }
    
    if (!hasValidRSIData) {
      return (
        <div style={{ padding: '60px 0', textAlign: 'center', background: "var(--app-card-bg-soft)", borderRadius: '12px' }}>
          <Empty description={<span style={{color: "var(--app-text-muted)"}}>{stateCopy.rsiInsufficient}</span>} image={Empty.PRESENTED_IMAGE_SIMPLE} />
        </div>
      );
    }

    const rsiData = chartData.filter(d => d.rsi !== undefined && !isNaN(d.rsi));
    
    return (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rsiData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid 
            strokeDasharray="3 3" 
            stroke="var(--app-border-soft)" 
            vertical={false} 
            strokeOpacity={1} 
          />
          
          <XAxis 
            dataKey="date" 
            tick={{ fontSize: 12, fill: "var(--sa-muted)", fontWeight: 500 }}
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
            tick={{ fontSize: 12, fill: "var(--sa-muted)", fontWeight: 600 }}
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
            label={{ value: 'OB', position: 'insideTopRight', fill: '#a74730', fontSize: 12, fontWeight: 700 }}
          />
          <ReferenceLine 
            y={30} 
            stroke="#10b981" 
            strokeDasharray="4 2" 
            strokeOpacity={0.6} 
            label={{ value: 'OS', position: 'insideBottomRight', fill: '#345d3d', fontSize: 12, fontWeight: 700 }}
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
          
        </LineChart>
      </ResponsiveContainer>
    );
  };


  // Symbol snapshot and performance share a lifecycle, while chart history has
  // its own effect below. Keeping them separate prevents the initial history
  // request from being fired twice.
  useEffect(() => {
    if (symbol) {
      setStockData(null);
      setStockDataError(null);
      setPerformanceData({ oneMonth: null, threeMonth: null, ytd: null });
      loadStockData();
      loadPerformanceData();
    }

    return () => {
      stockRequestIdRef.current += 1;
      performanceRequestIdRef.current += 1;
    };
  }, [symbol, loadStockData, loadPerformanceData]);

  // Symbol or timeframe changes refresh only the chart request.
  useEffect(() => {
    if (symbol) {
      loadHistoricalPrices();
    }

    return () => {
      historyRequestIdRef.current += 1;
    };
  }, [symbol, selectedTimeframe, loadHistoricalPrices]);

  // 只在初次加载（stockData还没拿到）时显示全页 spinner
  if (loading && !stockData) {
    return (
      <div className="symbol-analysis-page editorial-symbol-analysis sa-page-state">
        <div className="sa-state-card">
          <Spin size="large" />
          <strong>{language === 'zh-CN' ? `正在载入 ${symbol} 的研究数据…` : `Loading ${symbol} research data…`}</strong>
        </div>
      </div>
    );
  }

  if (!stockData) {
    return (
      <div className="symbol-analysis-page editorial-symbol-analysis sa-page-state">
        {stockDataError ? (
          <div className="sa-state-card">
            <Alert
              message={stateCopy.stockErrorTitle}
              description={
                <div>
                  <p>{stateCopy.stockErrorLead} <strong>{symbol}</strong> · {stockDataError}</p>
                  <p>{stateCopy.possibleCauses}</p>
                  <ul>
                    <li>{stateCopy.backend}</li>
                    <li>{stateCopy.apiKey}</li>
                    <li>{stateCopy.network}</li>
                    <li>{stateCopy.symbolMissing}</li>
                  </ul>
                  <p>{stateCopy.retryLead}</p>
                </div>
              }
              type="error"
              showIcon
            />
          </div>
        ) : (
          <div className="sa-state-card"><Empty description={`${stateCopy.noData} ${symbol}`} image={Empty.PRESENTED_IMAGE_SIMPLE} /></div>
        )}
      </div>
    );
  }

  const copy = zh ? {
    dossier: '标的研究档案', snapshot: '实时行情快照', refresh: '刷新数据',
    chart: '价格与趋势', chartNote: '真实行情、移动均线与交易区间', delayed: '行情数据可能存在延迟',
    last: '最新收盘', daily: '当日涨跌', period: '区间涨跌', structure: '市场结构',
    factorNote: '基于当前行情与可用历史数据', range: '52 周区间位置',
    indicators: '技术指标', indicatorNote: '动量与均线分开呈现，减少图表噪声',
    levels: '历史观察水平', levelsNote: '直接取自可用历史 K 线，不构成交易建议。',
    recent: '近期窗口', broad: '扩展窗口', reference: '风险参考',
    current: '当前参考价', observedLow: '近期低点', observedHigh: '近期高点',
    company: '公司概览', companyNote: '基础分类与估值字段',
    performanceNote: '基于可用历史收盘价计算', points: '数据点',
    loading: '正在同步价格历史…', unavailable: '暂无可用价格历史', retry: '重试',
    source: '数据源', low: '低点', high: '高点', insufficient: '数据不足',
  } : {
    dossier: 'Symbol research dossier', snapshot: 'Live quote snapshot', refresh: 'Refresh data',
    chart: 'Price & trend', chartNote: 'Real market data, moving averages, and trading range', delayed: 'Market data may be delayed',
    last: 'Last close', daily: 'Daily move', period: 'Period move', structure: 'Market structure',
    factorNote: 'From the current quote and available price history', range: '52-week range position',
    indicators: 'Technical indicators', indicatorNote: 'Momentum and moving averages separated to reduce chart noise',
    levels: 'Observed price levels', levelsNote: 'Taken directly from available historical bars; not trade advice.',
    recent: 'Recent window', broad: 'Broader window', reference: 'Risk reference',
    current: 'Current reference', observedLow: 'Recent low', observedHigh: 'Recent high',
    company: 'Company profile', companyNote: 'Classification and valuation fields',
    performanceNote: 'Calculated from available historical closes', points: 'Data points',
    loading: 'Synchronizing price history…', unavailable: 'Price history unavailable', retry: 'Retry',
    source: 'Data source', low: 'Low', high: 'High', insufficient: 'Insufficient data',
  };

  const price = (value: number | null | undefined) =>
    value === null || value === undefined || !Number.isFinite(value) ? '—' : '$' + safeToFixed(value, 2);
  const compact = (value: number | null | undefined, currency = false) => {
    if (value === null || value === undefined || !Number.isFinite(value)) return '—';
    const prefix = currency ? '$' : '';
    if (Math.abs(value) >= 1e12) return prefix + (value / 1e12).toFixed(2) + 'T';
    if (Math.abs(value) >= 1e9) return prefix + (value / 1e9).toFixed(2) + 'B';
    if (Math.abs(value) >= 1e6) return prefix + (value / 1e6).toFixed(2) + 'M';
    if (Math.abs(value) >= 1e3) return prefix + (value / 1e3).toFixed(1) + 'K';
    return prefix + value.toLocaleString();
  };
  const move = (value: number | null | undefined) =>
    value === null || value === undefined || !Number.isFinite(value) ? '—' : (value >= 0 ? '+' : '') + value.toFixed(2) + '%';
  const tone = (value: number | null | undefined) =>
    value !== null && value !== undefined && value < 0 ? 'is-negative' : 'is-positive';
  const meter = (value: number | null, min = 0, max = 100): React.CSSProperties => ({
    '--sa-fill': (value === null ? 0 : Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100))) + '%',
  } as React.CSSProperties);

  const latest = chartData[chartData.length - 1];
  const first = chartData[0];
  const validRsi = chartData.filter(item => item.rsi !== undefined && Number.isFinite(item.rsi));
  const rsi = validRsi.length ? validRsi[validRsi.length - 1].rsi! : null;
  const sma20 = latest?.sma20 ?? null;
  const sma50 = latest?.sma50 ?? null;
  const periodMove = first && latest && first.close > 0 ? ((latest.close - first.close) / first.close) * 100 : null;
  const vs20 = stockData.price !== null && sma20 ? ((stockData.price - sma20) / sma20) * 100 : null;
  const vs50 = stockData.price !== null && sma50 ? ((stockData.price - sma50) / sma50) * 100 : null;
  const maSpread = sma20 && sma50 ? ((sma20 - sma50) / sma50) * 100 : null;
  const range = calculateRangePosition(stockData.price, stockData.yearHigh, stockData.yearLow);
  const recent = chartData.slice(-20);
  const broad = chartData.slice(-40);
  const recentLow = recent.length ? Math.min(...recent.map(item => item.low)) : null;
  const recentHigh = recent.length ? Math.max(...recent.map(item => item.high)) : null;
  const broadLow = broad.length ? Math.min(...broad.map(item => item.low)) : null;
  const broadHigh = broad.length ? Math.max(...broad.map(item => item.high)) : null;
  const risk = stockData.price !== null && recentLow !== null ? stockData.price - recentLow : null;
  const reward = stockData.price !== null && recentHigh !== null ? recentHigh - stockData.price : null;
  const ratio = risk !== null && reward !== null && risk > 0 && reward >= 0 ? reward / risk : null;

  let trendScore = 0;
  let trendInputs = 0;
  const score = (condition: boolean) => { trendScore += condition ? 1 : -1; trendInputs += 1; };
  if (stockData.price !== null && sma20 !== null) score(stockData.price >= sma20);
  if (stockData.price !== null && sma50 !== null) score(stockData.price >= sma50);
  if (sma20 !== null && sma50 !== null) score(sma20 >= sma50);
  if (rsi !== null && (rsi > 55 || rsi < 45)) score(rsi > 55);
  const trend = trendInputs < 2 ? { label: t.analysis.analyzing, tone: 'neutral' }
    : trendScore >= 2 ? { label: t.analysis.strongBullish, tone: 'positive' }
    : trendScore > 0 ? { label: t.analysis.bullish, tone: 'positive' }
    : trendScore <= -2 ? { label: t.analysis.strongBearish, tone: 'negative' }
    : trendScore < 0 ? { label: t.analysis.bearish, tone: 'negative' }
    : { label: t.analysis.neutral, tone: 'neutral' };
  const rsiState = rsi === null ? t.analysis.noRSIData : rsi >= 70 ? t.analysis.overbought
    : rsi <= 30 ? t.analysis.oversold : rsi > 55 ? t.analysis.bullish
    : rsi < 45 ? t.analysis.bearish : t.analysis.neutral;
  const ratioState = ratio === null ? copy.insufficient : ratio >= 2 ? t.analysis.excellentSetup
    : ratio >= 1.5 ? t.analysis.goodSetup : ratio >= 1 ? t.analysis.fairSetup : t.analysis.poorSetup;
  const maInsight = !sma20 || !sma50 || stockData.price === null ? t.analysis.maInsufficient
    : [stockData.price >= sma20 ? t.analysis.maAbove20 : t.analysis.maBelow20, sma20 >= sma50 ? t.analysis.ma20Above50 : ''].filter(Boolean).join(' ');

  const metrics = [
    [t.analysis.dayHigh, price(stockData.dayHigh)], [t.analysis.dayLow, price(stockData.dayLow)],
    [t.analysis.prevClose, price(stockData.previousClose)], [t.analysis.marketCap, compact(stockData.marketCap, true)],
    [t.analysis.yearHigh, price(stockData.yearHigh)], [t.analysis.yearLow, price(stockData.yearLow)],
    [t.analysis.volume, compact(stockData.volume)], [t.analysis.rangePosition, range.label],
  ];
  const company = [
    [t.analysis.sector, stockData.sector ? translateSector(stockData.sector) : 'N/A'],
    [t.analysis.industry, stockData.industry ? translateSector(stockData.industry) : 'N/A'],
    [t.analysis.peRatio, stockData.peRatio ? safeToFixed(stockData.peRatio, 2) : 'N/A'],
    [t.analysis.divYield, stockData.dividendYield ? safeToFixed(stockData.dividendYield, 2) + '%' : 'N/A'],
  ];
  const performance = [
    [t.analysis.monthReturn, formatReturn(performanceData.oneMonth)],
    [t.analysis.threeMonthReturn, formatReturn(performanceData.threeMonth)],
    [t.analysis.yearToDate, formatReturn(performanceData.ytd)],
  ] as const;

  return (
    <div className="symbol-analysis-page editorial-symbol-analysis">
      <main className="sa-canvas">
        {(historicalDataError || fallbackTimeframeNotice) && (
          <Alert
            className="sa-alert"
            message={fallbackTimeframeNotice
              ? (zh ? '已使用备用周期' : 'Fallback timeframe in use')
              : historicalErrorType === 'auth_required'
                ? (zh ? '需要重新登录' : 'Authentication Required')
                : historicalErrorType === 'rate_limited'
                  ? (zh ? '行情接口请求频率受限' : 'Market Data Rate Limited')
                  : (zh ? '暂无历史行情' : 'No Historical Bars Available')}
            description={fallbackTimeframeNotice || historicalDataError}
            type={historicalErrorType === 'auth_required' ? 'error' : 'warning'}
            showIcon
            closable
            onClose={() => { setHistoricalDataError(null); setFallbackTimeframeNotice(null); }}
            action={<Button size="small" onClick={loadHistoricalPrices}>{copy.retry}</Button>}
          />
        )}

        <header className="sa-symbol-header">
          <div className="sa-symbol-identity">
            <div className="sa-symbol-mark">{symbol?.substring(0, 1).toUpperCase()}</div>
            <div>
              <p className="sa-kicker">{copy.dossier} · {dataSource}</p>
              <div className="sa-title"><h1>{symbol?.toUpperCase()}</h1><span>{stockData.name || symbol}</span></div>
              <div className="sa-quote">
                <strong>{price(stockData.price)}</strong>
                {stockData.change !== null && stockData.changePercent !== null && (
                  <span className={'sa-move ' + tone(stockData.change)}>
                    {stockData.change >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
                    {price(Math.abs(stockData.change))} ({move(stockData.changePercent)})
                  </span>
                )}
                <small>{copy.snapshot}</small>
              </div>
            </div>
          </div>
          <div className="sa-actions">
            <Button icon={<ReloadOutlined spin={loading || chartLoading} />} disabled={loading || chartLoading}
              onClick={() => { loadStockData(); loadHistoricalPrices(); loadPerformanceData(); }}>{copy.refresh}</Button>
            <Button type="primary" icon={<PlayCircleOutlined />}
              onClick={() => navigate(backtestForSymbolPath(symbol))}>{t.analysis.runBacktest}</Button>
          </div>
        </header>

        <section className="sa-stat-ledger">
          {metrics.map(([label, value]) => <article key={label}><span>{label}</span><strong>{value}</strong></article>)}
        </section>

        <section className="sa-workbench">
          <article className="sa-panel sa-price-panel">
            <div className="sa-panel-heading">
              <div><p className="sa-kicker">{copy.chart}</p><h2>{t.analysis.priceAnalysis}</h2><p>{copy.chartNote}</p></div>
              <span className="sa-data-note">{copy.delayed}</span>
            </div>
            <div className="sa-chart-toolbar">
              <div className="sa-chart-metrics">
                <div><span>{copy.last}</span><strong>{latest ? price(latest.close) : '—'}</strong></div>
                <div><span>{copy.daily}</span><strong className={tone(stockData.changePercent)}>{move(stockData.changePercent)}</strong></div>
                <div><span>{copy.period}</span><strong className={tone(periodMove)}>{move(periodMove)}</strong></div>
              </div>
              <Radio.Group className="sa-timeframe" value={selectedTimeframe} onChange={event => setSelectedTimeframe(event.target.value)}>
                {Object.keys(TIMEFRAMES).map(tf => <Radio.Button key={tf} value={tf}>{tf}</Radio.Button>)}
              </Radio.Group>
            </div>
            <div className="sa-chart-stage">
              {chartLoading ? <div className="sa-chart-state"><Spin /><span>{copy.loading}</span></div>
                : chartData.length ? renderPriceChart()
                : <div className="sa-chart-state"><InfoCircleOutlined /><strong>{copy.unavailable}</strong><Button onClick={loadHistoricalPrices}>{copy.retry}</Button></div>}
            </div>
            <div className="sa-chart-foot">
              <span>{timeframeLabels[selectedTimeframe] || selectedTimeframe}</span><span>{copy.points}: <strong>{chartData.length}</strong></span>
            </div>
          </article>

          <aside className="sa-structure">
            <div className="sa-dark-heading"><p><BarChartOutlined /> {copy.structure}</p><span>{selectedTimeframe}</span></div>
            <div className={'sa-verdict is-' + trend.tone}>
              <small>{t.analysis.trendBias}</small><strong>{trend.label}</strong><p>{copy.factorNote}</p>
            </div>
            <div className="sa-factors">
              <article><div><span>{t.analysis.momentumRSI}</span><strong>{rsi === null ? '—' : rsi.toFixed(1)}</strong></div><div className="sa-meter" style={meter(rsi)}><i /></div><small>{rsiState}</small></article>
              <article><div><span>{t.analysis.priceVsSMA20}</span><strong className={tone(vs20)}>{move(vs20)}</strong></div><div className="sa-meter" style={meter(vs20, -10, 10)}><i /></div><small>SMA 20 {price(sma20)}</small></article>
              <article><div><span>{t.analysis.sma20VsSMA50}</span><strong className={tone(maSpread)}>{move(maSpread)}</strong></div><div className="sa-meter" style={meter(maSpread, -10, 10)}><i /></div><small>SMA 50 {price(sma50)}</small></article>
            </div>
            <div className="sa-range">
              <div><span>{copy.range}</span><strong>{range.percentage === null ? '—' : range.percentage.toFixed(0) + '%'}</strong></div>
              <div className="sa-meter" style={meter(range.percentage)}><i /></div>
              <p><small>{copy.low} {price(stockData.yearLow)}</small><small>{copy.high} {price(stockData.yearHigh)}</small></p>
            </div>
          </aside>
        </section>

        <section className="sa-indicator-grid">
          <article className="sa-panel">
            <div className="sa-panel-heading">
              <div><p className="sa-kicker"><RadarChartOutlined /> {copy.indicators}</p><h2>{t.analysis.relativeStrength}</h2><p>{copy.indicatorNote}</p></div>
              <div className="sa-reading"><span className="sa-reading-label"><i aria-hidden="true" />RSI 14</span><strong>{rsi === null ? '—' : rsi.toFixed(1)}</strong><small>{rsiState}</small></div>
            </div>
            <div className="sa-rsi-stage">{renderRSIChart()}</div>
          </article>
          <article className="sa-panel">
            <div className="sa-panel-heading"><div><p className="sa-kicker"><LineChartOutlined /> {t.analysis.movingAverages}</p><h2>{t.analysis.movingAverages}</h2></div></div>
            <div className="sa-ma-ledger">
              <div><span>{t.analysis.currentPrice}</span><strong>{price(stockData.price)}</strong></div>
              <div><span>SMA 20</span><strong>{price(sma20)}</strong><small className={tone(vs20)}>{move(vs20)}</small></div>
              <div><span>SMA 50</span><strong>{price(sma50)}</strong><small className={tone(vs50)}>{move(vs50)}</small></div>
            </div>
            <div className="sa-insight"><InfoCircleOutlined /><div><strong>{t.analysis.analysisInsights}</strong><p>{maInsight}</p></div></div>
          </article>
        </section>

        <section className="sa-panel sa-levels">
          <div className="sa-panel-heading"><div><p className="sa-kicker"><LineChartOutlined /> {t.analysis.tradeSetupReference}</p><h2>{copy.levels}</h2><p>{copy.levelsNote}</p></div></div>
          <div className="sa-level-grid">
            <article><span>{t.analysis.supportLevels}</span><div><small>S1 · {copy.recent}</small><strong>{price(recentLow)}</strong></div><div><small>S2 · {copy.broad}</small><strong>{price(broadLow)}</strong></div></article>
            <article><span>{t.analysis.resistanceLevels}</span><div><small>R1 · {copy.recent}</small><strong>{price(recentHigh)}</strong></div><div><small>R2 · {copy.broad}</small><strong>{price(broadHigh)}</strong></div></article>
            <article><span>{copy.reference}</span><div><small>{copy.current}</small><strong>{price(stockData.price)}</strong></div><div><small>{copy.observedLow}</small><strong className="is-negative">{price(recentLow)}</strong></div><div><small>{copy.observedHigh}</small><strong className="is-positive">{price(recentHigh)}</strong></div></article>
            <article className="sa-ratio"><span>{t.analysis.riskRewardRatio}</span><strong>{ratio === null ? '—' : ratio.toFixed(2) + ':1'}</strong><small>{ratioState}</small></article>
          </div>
        </section>

        <section className="sa-profile-grid">
          <article className="sa-panel"><div className="sa-panel-heading"><div><p className="sa-kicker">{copy.company}</p><h2>{t.analysis.companyInsights}</h2><p>{copy.companyNote}</p></div></div>
            <div className="sa-company">{company.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
          </article>
          <article className="sa-panel"><div className="sa-panel-heading"><div><p className="sa-kicker">{t.analysis.recentPerformance}</p><h2>{t.analysis.recentPerformance}</h2><p>{copy.performanceNote}</p></div></div>
            <div className="sa-performance">{performance.map(([label, data]) => <div key={label}><span>{label}</span><strong className={data.text.startsWith('-') ? 'is-negative' : data.text === 'N/A' ? '' : 'is-positive'}>{data.text}</strong></div>)}</div>
          </article>
        </section>

        <footer className="sa-footer"><span>{copy.source}: <strong>{dataSource}</strong></span><i /><span>{t.analysis.dataUpdated} {stockData.timestamp ? new Date(stockData.timestamp).toLocaleString() : 'N/A'}</span></footer>
      </main>
    </div>
  );
};

export default SymbolAnalysis;
