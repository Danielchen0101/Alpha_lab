import React, { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Scatter, BarChart, Bar, ResponsiveContainer, Cell } from 'recharts';
import { Checkbox, Space, Card, Row, Col } from 'antd';
import { 
  parseDateSafe, 
  formatDateForChart, 
  formatDateToYYYYMMDD, 
  filterValidDates, 
  sortByDateAsc,
  getTooltipDate,
  debugDates 
} from '../utils/dateUtils';

interface ChartDataItem {
  date: string;
  close: number;
  volume?: number;  // Volume for volume chart (optional)
  signal: number;   // 1: buy, -1: sell, 0: no signal
  sma20?: number;
  sma50?: number;
}

interface TradingChartProps {
  data: ChartDataItem[];
  height?: number;
  parameters?: {
    strategy?: string;
    symbol?: string;
    period?: string;
    initialCapital?: number;
  };
}

const TradingChart: React.FC<TradingChartProps> = ({ data, height = 500, parameters }) => {
  // 调试：记录组件接收到的数据
  console.log('🔍 [TradingChart] 组件入口 - 接收数据:', {
    dataExists: !!data,
    dataLength: data?.length,
    dataFirstItem: data?.[0],
    dataFirstItemKeys: data?.[0] ? Object.keys(data[0]) : null,
    dataType: typeof data,
    isArray: Array.isArray(data),
    parameters: parameters
  });

  // State for chart controls
  const [showClosePrice, setShowClosePrice] = useState(true);
  const [showSMA20, setShowSMA20] = useState(true);
  const [showSMA50, setShowSMA50] = useState(true);
  const [showSignals, setShowSignals] = useState(true);
  const [showVolume, setShowVolume] = useState(true);

  if (!data || data.length === 0) {
    console.log('🔍 [TradingChart] 数据为空，显示空状态:', { 
      data, 
      length: data?.length,
      dataType: typeof data,
      isArray: Array.isArray(data)
    });
    return (
      <div style={{ 
        height, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        border: '1px solid #e8e8e8',
        borderRadius: '8px',
        backgroundColor: '#fafafa'
      }}>
        <div style={{ color: '#999', fontSize: '16px' }}>No chart data available</div>
      </div>
    );
  }

  // Prepare data for Recharts with volume color calculation
  const chartData = data.map((item, index) => {
    // Calculate volume color based on price movement - Softer colors
    let volumeColor = '#cccccc'; // Softer default gray
    if (item.volume !== undefined && item.volume > 0) {
      if (index === 0) {
        // First day, no previous close to compare
        volumeColor = '#cccccc';
      } else {
        const currentClose = item.close;
        const prevClose = data[index - 1].close;
        // Softer green and red for volume
        volumeColor = currentClose >= prevClose ? '#95de64' : '#ff7875';
      }
    }

    // Enhanced signal data with tooltip text
    const signalType = item.signal === 1 ? 'BUY' : item.signal === -1 ? 'SELL' : item.signal === -2 ? 'FORCED LIQUIDATION' : null;
    const signalColor = item.signal === 1 ? '#52c41a' : item.signal === -1 ? '#f5222d' : item.signal === -2 ? '#fa8c16' : null;

    return {
      ...item,
      // Enhanced signal data
      buySignal: item.signal === 1 ? item.close : null,
      sellSignal: item.signal === -1 ? item.close : null,
      forcedLiquidationSignal: item.signal === -2 ? item.close : null,
      signalType,
      signalColor,
      // Add volume color for styling
      volumeColor,
      // For volume chart, we need a separate value for display
      volumeDisplay: item.volume || 0,
    };
  });

  // Find min and max for better Y-axis scaling (price chart)
  // 修复：不过滤Boolean，而是过滤有效的数值，并处理空数组和相等的情况

  
  // 验证和过滤数据
  const validData = filterValidDates(data);
  const sortedData = sortByDateAsc(validData);
  
  // 调试：打印日期信息
  debugDates(data, 'TradingChart原始数据');
  debugDates(sortedData, 'TradingChart处理后的数据');
  
  // 调试：检查volume字段
  console.log('=== TradingChart Volume 字段检查 ===');
  console.log(`原始数据长度: ${data.length}`);
  console.log(`处理后数据长度: ${sortedData.length}`);
  
  // 检查前5个点的volume
  console.log('前5个点的volume字段:');
  data.slice(0, 5).forEach((item, index) => {
    console.log(`  [${index}] date: ${item.date}, volume: ${item.volume}, volume类型: ${typeof item.volume}, volume存在: ${'volume' in item}`);
  });
  
  // 检查后5个点的volume
  if (data.length > 5) {
    console.log('后5个点的volume字段:');
    data.slice(-5).forEach((item, index) => {
      const actualIndex = data.length - 5 + index;
      console.log(`  [${actualIndex}] date: ${item.date}, volume: ${item.volume}, volume类型: ${typeof item.volume}, volume存在: ${'volume' in item}`);
    });
  }
  
  // 统计有volume字段的数据点
  const hasVolumeCount = data.filter(d => 'volume' in d).length;
  const hasValidVolumeCount = data.filter(d => d.volume !== undefined && d.volume !== null && d.volume > 0).length;
  console.log(`有volume字段的数据点: ${hasVolumeCount}/${data.length}`);
  console.log(`有有效volume值(>0)的数据点: ${hasValidVolumeCount}/${data.length}`);
  
  // 创建统一的排序数据，包含所有需要的字段
  // 1. 先排序原始数据
  const sortedDataWithVolume = sortByDateAsc(data);
  
  // 2. 为排序后的数据添加volumeDisplay字段
  const unifiedChartData = sortedDataWithVolume.map((item, index) => {
    // Calculate volume color based on price movement
    let volumeColor = '#cccccc';
    if (item.volume !== undefined && item.volume > 0) {
      if (index === 0) {
        volumeColor = '#cccccc';
      } else {
        const currentClose = item.close;
        const prevClose = sortedDataWithVolume[index - 1].close;
        volumeColor = currentClose >= prevClose ? '#95de64' : '#ff7875';
      }
    }

    // Enhanced signal data
    const signalType = item.signal === 1 ? 'BUY' : item.signal === -1 ? 'SELL' : null;
    const signalColor = item.signal === 1 ? '#52c41a' : '#f5222d';

    return {
      ...item,
      buySignal: item.signal === 1 ? item.close : null,
      sellSignal: item.signal === -1 ? item.close : null,
      signalType,
      signalColor,
      volumeColor,
      volumeDisplay: item.volume || 0,
    };
  });
  
  // 使用统一的数据
  const processedChartData = unifiedChartData;
  
  // 重新计算基于处理后的数据
  const prices = processedChartData.map(d => d.close).filter(price => typeof price === 'number' && !isNaN(price));
  
  let minPrice, maxPrice, pricePadding;
  
  if (prices.length === 0) {
    // 如果没有有效数据，使用默认范围
    minPrice = 0;
    maxPrice = 100;
    pricePadding = 10;
  } else {
    minPrice = Math.min(...prices);
    maxPrice = Math.max(...prices);
    
    // 如果minPrice和maxPrice相等，添加基于价格的padding
    if (minPrice === maxPrice) {
      pricePadding = Math.abs(minPrice) * 0.15; // 使用价格的15%作为padding，让图表更舒展
    } else {
      pricePadding = (maxPrice - minPrice) * 0.15; // 15% padding，增加上下空白
    }
  }

  // Find min and max for volume Y-axis scaling
  const volumes = processedChartData.map(d => d.volume || 0).filter(volume => typeof volume === 'number' && !isNaN(volume));
  const maxVolume = volumes.length > 0 ? Math.max(...volumes) : 0;
  const volumePadding = maxVolume * 0.1; // 10% padding

  // Check if we have data to decide what to show
  const hasVolumeData = processedChartData.some(d => d.volume !== undefined && d.volume > 0);
  const hasSMA20 = processedChartData.some(d => d.sma20 !== undefined);
  const hasSMA50 = processedChartData.some(d => d.sma50 !== undefined);
  const hasSignals = processedChartData.some(d => d.signal !== 0);
  
  // Debug: Check signal data
  const buySignals = processedChartData.filter(d => d.signal === 1);
  const sellSignals = processedChartData.filter(d => d.signal === -1);
  console.log(`TradingChart Debug: 原始数据点: ${data.length}, 有效数据点: ${processedChartData.length}`);
  console.log(`TradingChart Debug: Buy signals: ${buySignals.length}`);
  console.log(`TradingChart Debug: Sell signals: ${sellSignals.length}`);
  console.log(`TradingChart Debug: Has signals: ${hasSignals}`);
  
  // 添加价格计算调试
  console.log(`TradingChart Debug: Price calculation:`);
  console.log(`  prices array length: ${prices.length}`);
  console.log(`  minPrice: ${minPrice}`);
  console.log(`  maxPrice: ${maxPrice}`);
  console.log(`  pricePadding: ${pricePadding}`);
  console.log(`  Y-axis domain: [${minPrice - pricePadding}, ${maxPrice + pricePadding}]`);
  
  // 添加volume计算调试
  console.log(`TradingChart Debug: Volume calculation:`);
  console.log(`  volumes array length: ${volumes.length}`);
  console.log(`  maxVolume: ${maxVolume}`);
  console.log(`  volumePadding: ${volumePadding}`);
  
  // 检查前几条数据
  if (data.length > 0) {
    console.log(`TradingChart Debug: First data item:`, data[0]);
    if (data.length > 1) {
      console.log(`TradingChart Debug: Second data item:`, data[1]);
    }
    console.log(`TradingChart Debug: Last data item:`, data[data.length - 1]);
  }

  // Calculate chart heights with explicit pixel values - 显著增加Volume Chart高度
  const priceChartHeight = (hasVolumeData && showVolume) ? 350 : 450; // Price Chart稍微减少：350px（有Volume时）或450px（无Volume时）
  const volumeChartHeight = (hasVolumeData && showVolume) ? 280 : 0; // Volume Chart显著增加：280px，确保真正展开

  // Format date for X-axis - 使用统一的日期格式化函数
  const formatDate = (dateStr: string) => {
    return formatDateForChart(dateStr);
  };

  // 生成每月一个自然代表日的日期刻度，确保2月日期点更自然
  const generateDateTicks = (data: ChartDataItem[], targetTickCount: number = 13): string[] => {
    if (data.length === 0) return [];
    
    // 如果数据点很少，返回所有日期
    if (data.length <= 8) {
      return data.map(item => item.date);
    }
    
    // 按月份分组数据，选择每月最接近15号的日期作为代表
    const monthMap = new Map<string, Array<{date: string, day: number}>>();
    
    data.forEach(item => {
      const dateObj = parseDateSafe(item.date);
      if (!dateObj) return;
      
      const year = dateObj.getFullYear();
      const month = dateObj.getMonth(); // 0-11
      const day = dateObj.getDate();
      const key = `${year}-${month.toString().padStart(2, '0')}`;
      
      if (!monthMap.has(key)) {
        monthMap.set(key, []);
      }
      monthMap.get(key)!.push({date: item.date, day});
    });
    
    // 按时间顺序排序月份
    const monthKeys = Array.from(monthMap.keys()).sort();
    
    const ticks: string[] = [];
    
    // 总是包含第一个日期
    if (data.length > 0) {
      ticks.push(data[0].date);
    }
    
    // 为每个月份选择一个代表日期（尽量选择月中日期）
    for (const monthKey of monthKeys) {
      // 跳过第一个月（已包含第一个日期）
      if (ticks.length > 0) {
        const firstDate = parseDateSafe(ticks[0]);
        if (firstDate) {
          const firstYear = firstDate.getFullYear();
          const firstMonth = firstDate.getMonth();
          const currentDate = parseDateSafe(monthKey + '-01');
          
          if (currentDate && firstYear === currentDate.getFullYear() && firstMonth === currentDate.getMonth()) {
            continue;
          }
        }
      }
      
      const monthData = monthMap.get(monthKey)!;
      
      // 选择最接近15号的日期作为代表
      let bestDate = monthData[0].date;
      let bestDistance = Math.abs(monthData[0].day - 15);
      
      for (const item of monthData) {
        const distance = Math.abs(item.day - 15);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestDate = item.date;
        }
      }
      
      ticks.push(bestDate);
    }
    
    // 总是包含最后一个日期
    if (data.length > 0) {
      const lastDate = data[data.length - 1].date;
      if (ticks.length === 0 || ticks[ticks.length - 1] !== lastDate) {
        ticks.push(lastDate);
      }
    }
    
    // 如果ticks数量太多，进行适当修剪（但确保包含首尾和重要月份）
    if (ticks.length > targetTickCount) {
      const importantTicks = new Set<string>();
      
      // 总是包含第一个和最后一个
      importantTicks.add(ticks[0]);
      importantTicks.add(ticks[ticks.length - 1]);
      
      // 特别确保包含2月和5月日期
      const importantMonths = [1, 4]; // 2月(1)和5月(4)
      const importantMonthTicks = ticks.filter(date => {
        try {
          const dateObj = new Date(date);
          return importantMonths.includes(dateObj.getMonth());
        } catch {
          return false;
        }
      });
      
      importantMonthTicks.forEach(tick => importantTicks.add(tick));
      
      // 均匀选择其他月份的日期
      const otherTicks = ticks.filter(tick => !importantTicks.has(tick));
      const otherStep = Math.max(1, Math.floor(otherTicks.length / (targetTickCount - importantTicks.size)));
      
      for (let i = 0; i < otherTicks.length; i += otherStep) {
        importantTicks.add(otherTicks[i]);
        if (importantTicks.size >= targetTickCount) break;
      }
      
      // 特别检查：如果5月仍然没有包含，强制添加一个5月日期
      const hasMay = Array.from(importantTicks).some(date => {
        try {
          return new Date(date).getMonth() === 4; // 5月
        } catch {
          return false;
        }
      });
      
      if (!hasMay) {
        // 查找所有5月日期
        const mayDates: string[] = [];
        data.forEach(item => {
          try {
            const dateObj = new Date(item.date);
            if (dateObj.getMonth() === 4) { // 5月
              mayDates.push(item.date);
            }
          } catch {
            // 忽略解析错误
          }
        });
        
        if (mayDates.length > 0) {
          // 选择最接近5月15号的日期
          let bestMayDate = mayDates[0];
          let bestMayDistance = 31;
          
          mayDates.forEach(date => {
            try {
              const day = new Date(date).getDate();
              const distance = Math.abs(day - 15);
              if (distance < bestMayDistance) {
                bestMayDistance = distance;
                bestMayDate = date;
              }
            } catch {
              // 忽略解析错误
            }
          });
          
          // 找到插入位置（按时间顺序）
          const insertIndex = Array.from(importantTicks).findIndex(tick => {
            try {
              return new Date(tick) > new Date(bestMayDate);
            } catch {
              return false;
            }
          });
          
          if (insertIndex !== -1) {
            const ticksArray = Array.from(importantTicks);
            ticksArray.splice(insertIndex, 0, bestMayDate);
            return ticksArray.sort((a, b) => {
              try {
                return new Date(a).getTime() - new Date(b).getTime();
              } catch {
                return 0;
              }
            });
          }
        }
      }
      
      return Array.from(importantTicks).sort((a, b) => {
        try {
          return new Date(a).getTime() - new Date(b).getTime();
        } catch {
          return 0;
        }
      });
    }
    
    // 即使ticks数量不多，也检查5月是否包含
    const hasMay = ticks.some(date => {
      try {
        return new Date(date).getMonth() === 4; // 5月
      } catch {
        return false;
      }
    });
    
    if (!hasMay) {
      // 查找所有5月日期
      const mayDates: string[] = [];
      data.forEach(item => {
        try {
          const dateObj = new Date(item.date);
          if (dateObj.getMonth() === 4) { // 5月
            mayDates.push(item.date);
          }
        } catch {
          // 忽略解析错误
        }
      });
      
      if (mayDates.length > 0) {
        // 选择最接近5月15号的日期
        let bestMayDate = mayDates[0];
        let bestMayDistance = 31;
        
        mayDates.forEach(date => {
          try {
            const day = new Date(date).getDate();
            const distance = Math.abs(day - 15);
            if (distance < bestMayDistance) {
              bestMayDistance = distance;
              bestMayDate = date;
            }
          } catch {
            // 忽略解析错误
          }
        });
        
        // 找到插入位置（按时间顺序）
        const insertIndex = ticks.findIndex(tick => {
          try {
            return new Date(tick) > new Date(bestMayDate);
          } catch {
            return false;
          }
        });
        
        if (insertIndex !== -1) {
          ticks.splice(insertIndex, 0, bestMayDate);
        } else if (ticks.length < targetTickCount + 2) {
          // 如果找不到合适位置，添加到倒数第二位置（最后一个日期之前）
          ticks.splice(ticks.length - 1, 0, bestMayDate);
        }
      }
    }
    
    return ticks;
  };

  // 获取统一的日期刻度
  const dateTicks = generateDateTicks(processedChartData, 12);
  
  // 智能X轴刻度格式化 - 只显示在刻度数组中的日期
  const smartTickFormatter = (value: string) => {
    // 如果这个日期在刻度数组中，显示它
    if (dateTicks.includes(value)) {
      return formatDate(value);
    }
    return '';
  };

  // 专业交易图表Tooltip
  const ProfessionalTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      // 使用统一的tooltip日期获取函数
      const displayDate = getTooltipDate(payload, label);
      
      // Find the data point
      const dataPoint = processedChartData.find(item => item.date === label);
      if (!dataPoint) return null;

      return (
        <div style={{
          backgroundColor: 'rgba(255, 255, 255, 0.98)',
          padding: '14px',
          border: '1px solid #e8e8e8',
          borderRadius: '8px',
          boxShadow: '0 6px 16px rgba(0,0,0,0.12)',
          backdropFilter: 'blur(8px)',
          minWidth: '220px',
          transform: 'translate(-50%, -100%)',
          marginTop: '-10px',
          borderTop: '3px solid #1890ff'
        }}>
          {/* 标题区域 - 更紧凑 */}
          <div style={{ 
            marginBottom: '14px'
          }}>
            <div style={{ 
              fontSize: '14px', // 增大字号
              fontWeight: '700', 
              color: '#333',
              marginBottom: '3px',
              letterSpacing: '0.4px'
            }}>
              {displayDate}
            </div>
            <div style={{ 
              fontSize: '11px', // 增大字号
              color: '#8c8c8c',
              display: 'flex',
              alignItems: 'center',
              textTransform: 'uppercase',
              letterSpacing: '0.6px'
            }}>
              <span style={{
                display: 'inline-block',
                width: '6px',
                height: '6px',
                backgroundColor: '#1890ff',
                borderRadius: '50%',
                marginRight: '6px'
              }}></span>
              TRADING DATA
            </div>
          </div>
          
          {/* 价格信息 - 更紧凑专业 */}
          <div style={{ marginBottom: '12px' }}>
            <div style={{ 
              fontSize: '11px', 
              color: '#595959',
              marginBottom: '6px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingBottom: '4px',
              borderBottom: '1px solid #f0f0f0'
            }}>
              <span style={{ fontWeight: '600' }}>PRICE</span>
              <span style={{ 
                fontWeight: '700', 
                color: '#1890ff',
                fontSize: '13px'
              }}>
                {dataPoint.close !== null && dataPoint.close !== undefined ? 
                  `$${Number(dataPoint.close).toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  })}` : '--'
                }
              </span>
            </div>
            
            {dataPoint.sma20 !== undefined && dataPoint.sma20 !== null && (
              <div style={{ 
                fontSize: '10px', 
                color: '#8c8c8c',
                marginBottom: '4px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span style={{ color: '#52c41a', fontWeight: '500' }}>SMA 20</span>
                <span style={{ fontWeight: '600', color: '#333' }}>
                  ${Number(dataPoint.sma20).toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  })}
                </span>
              </div>
            )}
            
            {dataPoint.sma50 !== undefined && dataPoint.sma50 !== null && (
              <div style={{ 
                fontSize: '10px', 
                color: '#8c8c8c',
                marginBottom: '4px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span style={{ color: '#fa8c16', fontWeight: '500' }}>SMA 50</span>
                <span style={{ fontWeight: '600', color: '#333' }}>
                  ${Number(dataPoint.sma50).toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  })}
                </span>
              </div>
            )}
          </div>
          
          {/* 交易量和信号 - 更紧凑 */}
          <div>
            {dataPoint.volume !== undefined && dataPoint.volume > 0 && (
              <div style={{ 
                fontSize: '10px', 
                color: '#8c8c8c',
                marginBottom: '8px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '6px 8px',
                backgroundColor: '#fafafa',
                borderRadius: '4px',
                border: '1px solid #f0f0f0'
              }}>
                <span style={{ fontWeight: '500' }}>VOLUME</span>
                <span style={{ fontWeight: '700', color: '#333' }}>
                  {formatVolume(dataPoint.volume)}
                </span>
              </div>
            )}
            
            {dataPoint.signal !== 0 && (
              <div style={{ 
                padding: '8px 10px',
                backgroundColor: dataPoint.signal === 1 ? 'rgba(82, 196, 26, 0.12)' : 'rgba(245, 34, 45, 0.12)',
                borderRadius: '6px',
                border: `2px solid ${dataPoint.signal === 1 ? 'rgba(82, 196, 26, 0.4)' : 'rgba(245, 34, 45, 0.4)'}`,
                marginTop: '8px'
              }}>
                <div style={{ 
                  fontSize: '11px', 
                  fontWeight: '700',
                  color: dataPoint.signal === 1 ? '#52c41a' : '#f5222d',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  letterSpacing: '0.5px'
                }}>
                  <span style={{
                    display: 'inline-block',
                    width: '8px',
                    height: '8px',
                    backgroundColor: dataPoint.signal === 1 ? '#52c41a' : '#f5222d',
                    borderRadius: '50%',
                    marginRight: '8px',
                    boxShadow: `0 0 8px ${dataPoint.signal === 1 ? 'rgba(82, 196, 26, 0.6)' : 'rgba(245, 34, 45, 0.6)'}`
                  }}></span>
                  {dataPoint.signal === 1 ? 'BUY SIGNAL' : 'SELL SIGNAL'}
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  // Format volume for display
  const formatVolume = (volume: number): string => {
    if (volume >= 1000000) {
      return `${(volume / 1000000).toFixed(1)}M`;
    } else if (volume >= 1000) {
      return `${(volume / 1000).toFixed(0)}K`;
    }
    return volume.toString();
  };

  // Volume Chart Tooltip - 使用统一的日期格式化
  const VolumeTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      // 使用统一的tooltip日期获取函数
      const displayDate = getTooltipDate(payload, label);
      
      // Find the data point
      const dataPoint = processedChartData.find(item => item.date === label);
      if (!dataPoint) return null;

      const isUp = dataPoint.volumeColor === '#95de64';
      const direction = isUp ? 'Up' : 'Down';
      const directionColor = isUp ? '#52c41a' : '#f5222d';

      return (
        <div style={{
          backgroundColor: 'rgba(255, 255, 255, 0.98)',
          padding: '14px',
          border: '1px solid #e8e8e8',
          borderRadius: '8px',
          boxShadow: '0 6px 16px rgba(0,0,0,0.12)',
          backdropFilter: 'blur(8px)',
          minWidth: '200px',
          transform: 'translate(-50%, -100%)',
          marginTop: '-10px',
          borderTop: `3px solid ${directionColor}`
        }}>
          {/* 标题区域 */}
          <div style={{ 
            marginBottom: '14px'
          }}>
            <div style={{ 
              fontSize: '14px',
              fontWeight: '700', 
              color: '#333',
              marginBottom: '3px',
              letterSpacing: '0.4px'
            }}>
              {displayDate}
            </div>
            <div style={{ 
              fontSize: '11px',
              color: '#8c8c8c',
              display: 'flex',
              alignItems: 'center',
              textTransform: 'uppercase',
              letterSpacing: '0.6px'
            }}>
              <span style={{
                display: 'inline-block',
                width: '6px',
                height: '6px',
                backgroundColor: directionColor,
                borderRadius: '50%',
                marginRight: '6px'
              }}></span>
              VOLUME DATA
            </div>
          </div>
          
          {/* 交易量信息 */}
          <div style={{ 
            fontSize: '11px', 
            color: '#595959',
            marginBottom: '6px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingBottom: '4px',
            borderBottom: '1px solid #f0f0f0'
          }}>
            <span style={{ fontWeight: '600' }}>VOLUME</span>
            <span style={{ 
              fontWeight: '700', 
              color: '#1890ff',
              fontSize: '13px'
            }}>
              {formatVolume(dataPoint.volume || 0)}
            </span>
          </div>
          
          {/* 价格方向指示器 */}
          <div style={{ 
            padding: '8px 10px',
            backgroundColor: isUp ? 'rgba(82, 196, 26, 0.12)' : 'rgba(245, 34, 45, 0.12)',
            borderRadius: '6px',
            border: `2px solid ${isUp ? 'rgba(82, 196, 26, 0.4)' : 'rgba(245, 34, 45, 0.4)'}`,
            marginTop: '8px'
          }}>
            <div style={{ 
              fontSize: '11px', 
              fontWeight: '700',
              color: directionColor,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              letterSpacing: '0.5px'
            }}>
              <span style={{
                display: 'inline-block',
                width: '8px',
                height: '8px',
                backgroundColor: directionColor,
                borderRadius: '50%',
                marginRight: '8px',
                boxShadow: `0 0 8px ${isUp ? 'rgba(82, 196, 26, 0.6)' : 'rgba(245, 34, 45, 0.6)'}`
              }}></span>
              {isUp ? 'PRICE UP' : 'PRICE DOWN'}
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  // Format currency
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  // Custom shape for buy signals - More prominent with larger size and B letter
  const BuySignalShape = (props: any) => {
    const { cx, cy } = props;
    const size = 16; // Increased size
    return (
      <g style={{ pointerEvents: 'all' }}>
        <circle 
          cx={cx} 
          cy={cy} 
          r={size}
          fill="#52c41a" 
          stroke="white" 
          strokeWidth={3}
          opacity={1}
          filter="drop-shadow(0px 3px 6px rgba(82, 196, 26, 0.4))"
        />
        {/* Large B letter */}
        <text
          x={cx}
          y={cy}
          dy={5}
          textAnchor="middle"
          fill="white"
          fontSize={14}
          fontWeight="bold"
          style={{ pointerEvents: 'none' }}
        >
          B
        </text>
        {/* Green glow effect */}
        <circle 
          cx={cx} 
          cy={cy} 
          r={size + 3}
          fill="none"
          stroke="#52c41a"
          strokeWidth={1}
          opacity={0.3}
        />
      </g>
    );
  };

  // Custom shape for sell signals - More prominent with larger size and S letter
  const SellSignalShape = (props: any) => {
    const { cx, cy } = props;
    const size = 16; // Increased size
    return (
      <g style={{ pointerEvents: 'all' }}>
        <circle 
          cx={cx} 
          cy={cy} 
          r={size}
          fill="#f5222d" 
          stroke="white" 
          strokeWidth={3}
          opacity={1}
          filter="drop-shadow(0px 3px 6px rgba(245, 34, 45, 0.4))"
        />
        {/* Large S letter */}
        <text
          x={cx}
          y={cy}
          dy={5}
          textAnchor="middle"
          fill="white"
          fontSize={14}
          fontWeight="bold"
          style={{ pointerEvents: 'none' }}
        >
          S
        </text>
        {/* Red glow effect */}
        <circle 
          cx={cx} 
          cy={cy} 
          r={size + 3}
          fill="none"
          stroke="#f5222d"
          strokeWidth={1}
          opacity={0.3}
        />
      </g>
    );
  };

  return (
    <div style={{ 
      border: '1px solid #e8e8e8', 
      borderRadius: '8px', 
      padding: '32px', // 进一步增加内边距
      backgroundColor: '#fff',
      minHeight: Math.max(height, 700), // 显著增加外层容器高度，至少700px
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Header with Chart Controls - Optimized position */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '24px', // 增加间距：24px
        padding: '0 4px' // 减少内边距，让标题更靠近边缘
      }}>
        <h4 style={{ margin: 0, color: '#333', fontSize: '18px', fontWeight: '600' }}>Price Chart with Trading Signals</h4>
        
        {/* Chart Controls - 更紧凑利落的专业交易平台风格 */}
        <div style={{ 
          display: 'flex',
          alignItems: 'center',
          padding: '6px 14px',
          backgroundColor: '#f8f9fa',
          borderRadius: '8px',
          border: '1px solid #e9ecef',
          fontSize: '11px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
        }}>
          <Space direction="horizontal" size={10}>
            <Checkbox 
              checked={showClosePrice} 
              onChange={(e) => setShowClosePrice(e.target.checked)}
              style={{ fontSize: '11px', marginRight: '0', padding: '0' }}
            >
              <span style={{ color: '#1890ff', fontWeight: '700', letterSpacing: '0.5px' }}>PRICE</span>
            </Checkbox>
            
            <div style={{ width: '1px', height: '12px', backgroundColor: '#dee2e6', margin: '0 2px' }}></div>
            
            {hasSMA20 && (
              <Checkbox 
                checked={showSMA20} 
                onChange={(e) => setShowSMA20(e.target.checked)}
                style={{ fontSize: '9px', marginRight: '0', padding: '0' }}
              >
                <span style={{ color: '#52c41a', opacity: 0.9, fontWeight: '500' }}>SMA20</span>
              </Checkbox>
            )}
            
            {hasSMA50 && (
              <Checkbox 
                checked={showSMA50} 
                onChange={(e) => setShowSMA50(e.target.checked)}
                style={{ fontSize: '9px', marginRight: '0', padding: '0' }}
              >
                <span style={{ color: '#fa8c16', opacity: 0.9, fontWeight: '500' }}>SMA50</span>
              </Checkbox>
            )}
            
            <div style={{ width: '1px', height: '12px', backgroundColor: '#dee2e6', margin: '0 2px' }}></div>
            
            {hasSignals && (
              <Checkbox 
                checked={showSignals} 
                onChange={(e) => setShowSignals(e.target.checked)}
                style={{ fontSize: '9px', marginRight: '0', padding: '0' }}
              >
                <span style={{ color: '#666', opacity: 0.9, fontWeight: '500' }}>SIGNALS</span>
              </Checkbox>
            )}
            
            {hasVolumeData && (
              <>
                <div style={{ width: '1px', height: '12px', backgroundColor: '#dee2e6', margin: '0 2px' }}></div>
                <Checkbox 
                  checked={showVolume} 
                  onChange={(e) => setShowVolume(e.target.checked)}
                  style={{ fontSize: '9px', padding: '0' }}
                >
                  <span style={{ color: '#666', opacity: 0.9, fontWeight: '500' }}>VOLUME</span>
                </Checkbox>
              </>
            )}
          </Space>
        </div>
      </div>
      
      {/* Price Chart */}
      <div style={{ 
        height: priceChartHeight, 
        marginBottom: (hasVolumeData && showVolume) ? '20px' : '0',  // 减少间距：20px，让两个图更紧凑
        flex: '0 0 auto'  // 固定高度，不自动扩展
      }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={processedChartData}
            margin={{ top: 10, right: 25, left: 25, bottom: 10 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f8f8f8" vertical={false} />
            <XAxis 
              dataKey="date" 
              tick={{ fontSize: 11, fill: '#666' }} // 增大字号
              tickFormatter={smartTickFormatter}
              axisLine={{ stroke: '#d9d9d9' }}
              tickLine={{ stroke: '#d9d9d9' }}
              height={38}
              // 使用统一的日期刻度
              ticks={dateTicks}
            />
            <YAxis 
              domain={[minPrice - pricePadding, maxPrice + pricePadding]}
              tick={{ fontSize: 11, fill: '#666' }} // 增大字号
              tickFormatter={(value) => {
                const val = Number(value);
                if (isNaN(val)) return '$0.00';
                // Professional prices format: integer part comma separated, two decimals
                return `$${val.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2
                })}`;
              }}
              axisLine={{ stroke: '#d9d9d9' }}
              tickLine={{ stroke: '#d9d9d9' }}
              width={70}
              // 给价格留出更多空白，看起来更专业
              padding={{ top: 22, bottom: 22 }}
            />
            <Tooltip 
              content={<ProfessionalTooltip />}
              offset={12}
              cursor={{ stroke: '#d9d9d9', strokeWidth: 1, strokeDasharray: '3 3' }}
            />
            <Legend 
              wrapperStyle={{ 
                paddingTop: '3px', 
                paddingBottom: '3px',
                fontSize: '10px',
                marginTop: '-4px' // 更靠近图表
              }}
              iconSize={8}
              iconType="plainline"
            />
            
            {/* Price line - 更突出，专业交易图表风格 */}
            {showClosePrice && (
              <Line
                type="monotone"
                dataKey="close"
                stroke="#1890ff"
                strokeWidth={3.5} // 增加线条宽度，更突出
                dot={false} // 去掉静态点，只在hover时显示
                name="Price"
                activeDot={{ 
                  r: 7, // 增加hover点大小
                  stroke: '#1890ff', 
                  strokeWidth: 2, 
                  fill: 'white',
                  strokeOpacity: 0.8
                }}
                connectNulls={true}
              />
            )}
            
            {/* SMA20 line - 辅助线，更弱化 */}
            {showSMA20 && hasSMA20 && (
              <Line
                type="monotone"
                dataKey="sma20"
                stroke="#52c41a"
                strokeWidth={1.0} // 减少线条宽度
                strokeDasharray="3 3"
                dot={false}
                name="SMA 20"
                connectNulls={true}
                opacity={0.8} // 增加透明度，更弱化
              />
            )}
            
            {/* SMA50 line - 辅助线，更弱化 */}
            {showSMA50 && hasSMA50 && (
              <Line
                type="monotone"
                dataKey="sma50"
                stroke="#fa8c16"
                strokeWidth={1.0} // 减少线条宽度
                strokeDasharray="3 3"
                dot={false}
                name="SMA 50"
                connectNulls={true}
                opacity={0.8} // 增加透明度，更弱化
              />
            )}
            
            {/* Buy signals - Rendered last to ensure they're on top */}
            {showSignals && hasSignals && (
              <Scatter
                dataKey="buySignal"
                fill="#52c41a"
                shape={BuySignalShape}
                name="Buy Signal"
              />
            )}
            
            {/* Sell signals - Rendered last to ensure they're on top */}
            {showSignals && hasSignals && (
              <Scatter
                dataKey="sellSignal"
                fill="#f5222d"
                shape={SellSignalShape}
                name="Sell Signal"
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Volume Chart (only if we have volume data and it's enabled) */}
      {hasVolumeData && showVolume && (
        <div style={{ 
          height: volumeChartHeight,
          marginTop: '0',  // 去掉顶部间距，因为Price Chart已经有底部间距
          marginBottom: '20px', // 稍微减少底部间距：20px，让整体更紧凑
          flex: '0 0 auto'  // 固定高度，不自动扩展
        }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: '12px',
            padding: '8px 14px',
            backgroundColor: '#f8f9fa',
            borderRadius: '8px',
            border: '1px solid #e9ecef',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{
                width: '14px',
                height: '14px',
                backgroundColor: '#95de64',
                marginRight: '12px',
                borderRadius: '4px',
                boxShadow: '0 2px 6px rgba(0,0,0,0.12)'
              }}></div>
              <div>
                <h5 style={{ 
                  margin: 0, 
                  color: '#495057', 
                  fontSize: '14px', // 增大字号
                  fontWeight: '700',
                  letterSpacing: '0.6px',
                  textTransform: 'uppercase',
                  marginBottom: '3px'
                }}>VOLUME CHART</h5>
                <div style={{ 
                  fontSize: '11px', // 增大字号
                  color: '#6c757d',
                  fontWeight: '500',
                  letterSpacing: '0.3px'
                }}>Trading Volume • Green=Up, Red=Down</div>
              </div>
            </div>
            <div style={{ 
              fontSize: '11px', // 增大字号
              color: '#495057',
              fontWeight: '600',
              padding: '5px 12px',
              backgroundColor: 'white',
              borderRadius: '6px',
              border: '1px solid #dee2e6',
              boxShadow: '0 2px 4px rgba(0,0,0,0.08)'
            }}>
              VOLUME
            </div>
          </div>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={processedChartData}
              margin={{ top: 8, right: 30, left: 30, bottom: 15 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f8f8f8" vertical={false} />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 10, fill: '#666' }} // 增大字号
                tickFormatter={smartTickFormatter}
                axisLine={{ stroke: '#d9d9d9' }}
                tickLine={{ stroke: '#d9d9d9' }}
                height={28}
                // 使用统一的日期刻度
                ticks={dateTicks}
              />
              <YAxis 
                tick={{ fontSize: 10, fill: '#666' }} // 增大字号
                tickFormatter={(value) => {
                  const val = Number(value);
                  if (isNaN(val)) return '0';
                  if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
                  if (val >= 1000) return `${(val / 1000).toFixed(0)}K`;
                  return val.toFixed(0);
                }}
                axisLine={{ stroke: '#d9d9d9' }}
                tickLine={{ stroke: '#d9d9d9' }}
                width={55} // 增加宽度，避免标签被裁剪
                // 给Volume Chart的Y轴也留出适当空白
                padding={{ top: 18, bottom: 18 }} // 增加padding
              />
              <Tooltip 
                content={<VolumeTooltip />}
                offset={12}
                cursor={{ 
                  stroke: '#1890ff', 
                  strokeWidth: 1, 
                  strokeDasharray: '3 3',
                  opacity: 0.6
                }}
              />
              
              {/* Volume bars with dynamic colors - 更专业明显的柱子 */}
              <Bar
                dataKey="volumeDisplay"
                name="Volume"
                fill="#999"  // Default color
                barSize={14} // 减少柱子宽度，避免太挤
                radius={[3, 3, 0, 0]} // 减少圆角
              >
                {processedChartData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    className="volume-bar-cell"
                    fill={entry.volumeColor || '#999'}
                    stroke={entry.volumeColor || '#999'}
                    strokeWidth={0.8} // 减少边框宽度
                    style={{
                      transition: 'all 0.2s ease',
                      cursor: 'pointer'
                    }}
                    onMouseEnter={(e) => {
                      const target = e.target as HTMLElement;
                      target.style.opacity = '0.6';
                      target.style.strokeWidth = '2';
                      target.style.filter = 'brightness(1.1)';
                    }}
                    onMouseLeave={(e) => {
                      const target = e.target as HTMLElement;
                      target.style.opacity = '1';
                      target.style.strokeWidth = '0.8';
                      target.style.filter = 'brightness(1)';
                    }}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}



      {/* Parameters Section - Professional card layout */}
      {parameters && (
        <div style={{ 
          marginTop: '24px',
          padding: '20px',
          backgroundColor: '#f8f9fa',
          borderRadius: '8px',
          border: '1px solid #e9ecef'
        }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: '16px',
            paddingBottom: '12px',
            borderBottom: '1px solid #dee2e6'
          }}>
            <h5 style={{ margin: 0, color: '#495057', fontSize: '15px', fontWeight: '600' }}>Backtest Parameters</h5>
            <span style={{ 
              fontSize: '12px', 
              color: '#6c757d', 
              backgroundColor: '#e9ecef',
              padding: '4px 8px',
              borderRadius: '4px'
            }}>
              Configuration
            </span>
          </div>
          
          <Row gutter={[16, 16]}>
            {parameters.strategy && (
              <Col xs={24} sm={12} md={6} lg={6}>
                <div style={{ 
                  padding: '16px',
                  backgroundColor: 'white',
                  borderRadius: '6px',
                  border: '1px solid #dee2e6',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                  transition: 'all 0.2s ease'
                }}>
                  <div style={{ 
                    fontSize: '11px', 
                    color: '#868e96', 
                    marginBottom: '6px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    fontWeight: '500'
                  }}>Strategy</div>
                  <div style={{ 
                    fontSize: '15px', 
                    fontWeight: '600', 
                    color: '#212529',
                    display: 'flex',
                    alignItems: 'center'
                  }}>
                    <span style={{
                      display: 'inline-block',
                      width: '8px',
                      height: '8px',
                      backgroundColor: '#1890ff',
                      borderRadius: '50%',
                      marginRight: '8px'
                    }}></span>
                    {parameters.strategy.replace('_', ' ').toUpperCase()}
                  </div>
                </div>
              </Col>
            )}
            {parameters.symbol && (
              <Col xs={24} sm={12} md={6} lg={6}>
                <div style={{ 
                  padding: '16px',
                  backgroundColor: 'white',
                  borderRadius: '6px',
                  border: '1px solid #dee2e6',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                  transition: 'all 0.2s ease'
                }}>
                  <div style={{ 
                    fontSize: '11px', 
                    color: '#868e96', 
                    marginBottom: '6px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    fontWeight: '500'
                  }}>Symbol</div>
                  <div style={{ 
                    fontSize: '15px', 
                    fontWeight: '600', 
                    color: '#212529',
                    display: 'flex',
                    alignItems: 'center'
                  }}>
                    <span style={{
                      display: 'inline-block',
                      width: '8px',
                      height: '8px',
                      backgroundColor: '#52c41a',
                      borderRadius: '50%',
                      marginRight: '8px'
                    }}></span>
                    {parameters.symbol}
                  </div>
                </div>
              </Col>
            )}
            {parameters.period && (
              <Col xs={24} sm={12} md={6} lg={6}>
                <div style={{ 
                  padding: '16px',
                  backgroundColor: 'white',
                  borderRadius: '6px',
                  border: '1px solid #dee2e6',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                  transition: 'all 0.2s ease'
                }}>
                  <div style={{ 
                    fontSize: '11px', 
                    color: '#868e96', 
                    marginBottom: '6px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    fontWeight: '500'
                  }}>Period</div>
                  <div style={{ 
                    fontSize: '15px', 
                    fontWeight: '600', 
                    color: '#212529',
                    display: 'flex',
                    alignItems: 'center'
                  }}>
                    <span style={{
                      display: 'inline-block',
                      width: '8px',
                      height: '8px',
                      backgroundColor: '#fa8c16',
                      borderRadius: '50%',
                      marginRight: '8px'
                    }}></span>
                    {parameters.period}
                  </div>
                </div>
              </Col>
            )}
            {parameters.initialCapital && (
              <Col xs={24} sm={12} md={6} lg={6}>
                <div style={{ 
                  padding: '16px',
                  backgroundColor: 'white',
                  borderRadius: '6px',
                  border: '1px solid #dee2e6',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                  transition: 'all 0.2s ease'
                }}>
                  <div style={{ 
                    fontSize: '11px', 
                    color: '#868e96', 
                    marginBottom: '6px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    fontWeight: '500'
                  }}>Initial Capital</div>
                  <div style={{ 
                    fontSize: '15px', 
                    fontWeight: '600', 
                    color: '#212529',
                    display: 'flex',
                    alignItems: 'center'
                  }}>
                    <span style={{
                      display: 'inline-block',
                      width: '8px',
                      height: '8px',
                      backgroundColor: '#722ed1',
                      borderRadius: '50%',
                      marginRight: '8px'
                    }}></span>
                    {formatCurrency(parameters.initialCapital)}
                  </div>
                </div>
              </Col>
            )}
          </Row>
        </div>
      )}
    </div>
  );
};

export default TradingChart;
