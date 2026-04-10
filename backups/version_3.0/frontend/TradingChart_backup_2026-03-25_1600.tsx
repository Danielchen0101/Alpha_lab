import React, { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Scatter, BarChart, Bar, ResponsiveContainer, Cell } from 'recharts';
import { Checkbox, Space, Card, Row, Col } from 'antd';

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
    const signalType = item.signal === 1 ? 'BUY' : item.signal === -1 ? 'SELL' : null;
    const signalColor = item.signal === 1 ? '#52c41a' : '#f5222d';

    return {
      ...item,
      // Enhanced signal data
      buySignal: item.signal === 1 ? item.close : null,
      sellSignal: item.signal === -1 ? item.close : null,
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
  const prices = data.map(d => d.close).filter(price => typeof price === 'number' && !isNaN(price));
  
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
  // 修复：不过滤Boolean，而是过滤有效的数值
  const volumes = data.map(d => d.volume || 0).filter(volume => typeof volume === 'number' && !isNaN(volume));
  const maxVolume = volumes.length > 0 ? Math.max(...volumes) : 0;
  const volumePadding = maxVolume * 0.1; // 10% padding

  // Check if we have data to decide what to show
  const hasVolumeData = data.some(d => d.volume !== undefined && d.volume > 0);
  const hasSMA20 = data.some(d => d.sma20 !== undefined);
  const hasSMA50 = data.some(d => d.sma50 !== undefined);
  const hasSignals = data.some(d => d.signal !== 0);
  
  // Debug: Check signal data
  const buySignals = data.filter(d => d.signal === 1);
  const sellSignals = data.filter(d => d.signal === -1);
  console.log(`TradingChart Debug: Total data points: ${data.length}`);
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

  // Calculate chart heights with optimized proportions - 显著增加高度，向Equity Curve/Drawdown Chart看齐
  const priceChartHeight = (hasVolumeData && showVolume) ? height * 0.70 : height * 0.85; // Price Chart显著增加高度
  const volumeChartHeight = (hasVolumeData && showVolume) ? height * 0.30 : 0; // Volume Chart保持合理比例

  // Format date for X-axis - 优化版本
  const formatDate = (dateStr: string) => {
    try {
      // 手动解析YYYY-MM-DD格式，避免时区偏移
      let month, day;
      
      if (typeof dateStr === 'string' && dateStr.includes('-')) {
        // 如果是YYYY-MM-DD格式，直接解析
        const parts = dateStr.split('-');
        if (parts.length === 3) {
          month = parseInt(parts[1], 10);
          day = parseInt(parts[2], 10);
          return `${month}/${day}`;
        }
      }
      
      // 备用方案：使用Date对象
      const date = new Date(dateStr);
      return `${date.getMonth() + 1}/${date.getDate()}`;
    } catch {
      return dateStr;
    }
  };

  // 生成大约12个均匀分布的日期刻度，确保2月日期点更完整
  const generateDateTicks = (data: ChartDataItem[], targetTickCount: number = 12): string[] => {
    if (data.length === 0) return [];
    
    // 如果数据点少于目标刻度数，返回所有日期
    if (data.length <= targetTickCount) {
      return data.map(item => item.date);
    }
    
    // 计算步长
    const step = Math.floor(data.length / targetTickCount);
    const ticks: string[] = [];
    
    // 从第一个数据点开始，每隔step个点取一个日期
    for (let i = 0; i < data.length; i += step) {
      ticks.push(data[i].date);
      // 如果已经达到或超过目标刻度数，停止
      if (ticks.length >= targetTickCount) break;
    }
    
    // 确保最后一个日期总是包含在内
    if (ticks[ticks.length - 1] !== data[data.length - 1].date) {
      ticks[ticks.length - 1] = data[data.length - 1].date;
    }
    
    // 特别优化：确保2月有足够的日期点
    // 检查当前ticks中2月的数量
    const februaryTicks = ticks.filter(date => {
      try {
        const dateObj = new Date(date);
        return dateObj.getMonth() === 1; // 1表示2月（0-based）
      } catch {
        return false;
      }
    });
    
    // 如果2月日期点少于2个，尝试添加一个
    if (februaryTicks.length < 2 && data.length > 0) {
      // 找到所有2月的日期
      const allFebruaryDates = data
        .map(item => item.date)
        .filter(date => {
          try {
            const dateObj = new Date(date);
            return dateObj.getMonth() === 1; // 1表示2月
          } catch {
            return false;
          }
        });
      
      // 如果有2月日期，添加一个不在当前ticks中的
      if (allFebruaryDates.length > 0) {
        const newFebruaryDate = allFebruaryDates.find(date => !ticks.includes(date));
        if (newFebruaryDate) {
          // 在适当位置插入（保持时间顺序）
          const insertIndex = ticks.findIndex(tick => {
            try {
              return new Date(tick) > new Date(newFebruaryDate);
            } catch {
              return false;
            }
          });
          
          if (insertIndex !== -1) {
            ticks.splice(insertIndex, 0, newFebruaryDate);
          } else {
            // 如果找不到插入位置，添加到末尾（但确保不超过目标数量）
            if (ticks.length < targetTickCount + 2) { // 允许稍微超过目标数量
              ticks.push(newFebruaryDate);
            }
          }
        }
      }
    }
    
    // 如果ticks数量超过目标太多，稍微修剪一下（但保持2月日期）
    if (ticks.length > targetTickCount + 2) {
      // 保留前targetTickCount个，但确保包含首尾和2月日期
      const importantTicks = new Set<string>();
      
      // 总是包含第一个和最后一个
      importantTicks.add(ticks[0]);
      importantTicks.add(ticks[ticks.length - 1]);
      
      // 包含所有2月日期
      februaryTicks.forEach(tick => importantTicks.add(tick));
      
      // 均匀选择其他日期
      const otherTicks = ticks.filter(tick => !importantTicks.has(tick));
      const otherStep = Math.max(1, Math.floor(otherTicks.length / (targetTickCount - importantTicks.size)));
      
      for (let i = 0; i < otherTicks.length; i += otherStep) {
        importantTicks.add(otherTicks[i]);
        if (importantTicks.size >= targetTickCount) break;
      }
      
      return Array.from(importantTicks).sort((a, b) => {
        try {
          return new Date(a).getTime() - new Date(b).getTime();
        } catch {
          return 0;
        }
      });
    }
    
    return ticks;
  };

  // 获取统一的日期刻度
  const dateTicks = generateDateTicks(data, 12);
  
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
      // Find the data point
      const dataPoint = chartData.find(item => item.date === label);
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
            marginBottom: '12px'
          }}>
            <div style={{ 
              fontSize: '12px', 
              fontWeight: '700', 
              color: '#333',
              marginBottom: '2px',
              letterSpacing: '0.3px'
            }}>
              {label}
            </div>
            <div style={{ 
              fontSize: '10px', 
              color: '#8c8c8c',
              display: 'flex',
              alignItems: 'center',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
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
                ${dataPoint.close.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2
                })}
              </span>
            </div>
            
            {dataPoint.sma20 !== undefined && (
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
                  ${dataPoint.sma20.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  })}
                </span>
              </div>
            )}
            
            {dataPoint.sma50 !== undefined && (
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
                  ${dataPoint.sma50.toLocaleString('en-US', {
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
      padding: '20px',
      backgroundColor: '#fff',
      minHeight: height
    }}>
      {/* Header with Chart Controls - Optimized position */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '20px',
        padding: '0 8px' // Added padding to keep distance from edges
      }}>
        <h4 style={{ margin: 0, color: '#333' }}>Price Chart with Trading Signals</h4>
        
        {/* Chart Controls - 专业交易平台风格 */}
        <div style={{ 
          display: 'flex',
          alignItems: 'center',
          padding: '3px 8px',
          backgroundColor: '#f8f9fa',
          borderRadius: '6px',
          border: '1px solid #e9ecef',
          fontSize: '10px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
        }}>
          <Space direction="horizontal" size={6}>
            <Checkbox 
              checked={showClosePrice} 
              onChange={(e) => setShowClosePrice(e.target.checked)}
              style={{ fontSize: '10px', marginRight: '0' }}
            >
              <span style={{ color: '#1890ff', fontWeight: '600' }}>PRICE</span>
            </Checkbox>
            
            {hasSMA20 && (
              <Checkbox 
                checked={showSMA20} 
                onChange={(e) => setShowSMA20(e.target.checked)}
                style={{ fontSize: '10px', marginRight: '0' }}
              >
                <span style={{ color: '#52c41a', opacity: 0.8 }}>SMA20</span>
              </Checkbox>
            )}
            
            {hasSMA50 && (
              <Checkbox 
                checked={showSMA50} 
                onChange={(e) => setShowSMA50(e.target.checked)}
                style={{ fontSize: '10px', marginRight: '0' }}
              >
                <span style={{ color: '#fa8c16', opacity: 0.8 }}>SMA50</span>
              </Checkbox>
            )}
            
            {hasSignals && (
              <Checkbox 
                checked={showSignals} 
                onChange={(e) => setShowSignals(e.target.checked)}
                style={{ fontSize: '10px', marginRight: '0' }}
              >
                <span style={{ color: '#666', opacity: 0.8 }}>SIGNALS</span>
              </Checkbox>
            )}
            
            {hasVolumeData && (
              <Checkbox 
                checked={showVolume} 
                onChange={(e) => setShowVolume(e.target.checked)}
                style={{ fontSize: '10px' }}
              >
                <span style={{ color: '#666', opacity: 0.8 }}>VOLUME</span>
              </Checkbox>
            )}
          </Space>
        </div>
      </div>
      
      {/* Price Chart */}
      <div style={{ 
        height: priceChartHeight, 
        marginBottom: (hasVolumeData && showVolume) ? '40px' : '0'  // 增加间距，让整体更舒展
      }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 10, right: 25, left: 25, bottom: 10 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f8f8f8" vertical={false} />
            <XAxis 
              dataKey="date" 
              tick={{ fontSize: 10, fill: '#666' }}
              tickFormatter={smartTickFormatter}
              axisLine={{ stroke: '#d9d9d9' }}
              tickLine={{ stroke: '#d9d9d9' }}
              height={35}
              // 使用统一的日期刻度
              ticks={dateTicks}
            />
            <YAxis 
              domain={[minPrice - pricePadding, maxPrice + pricePadding]}
              tick={{ fontSize: 10, fill: '#666' }}
              tickFormatter={(value) => {
                // 专业的价格格式：整数部分逗号分隔，两位小数
                return `$${value.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2
                })}`;
              }}
              axisLine={{ stroke: '#d9d9d9' }}
              tickLine={{ stroke: '#d9d9d9' }}
              width={65}
              // 给价格留出更多空白，看起来更专业
              padding={{ top: 20, bottom: 20 }}
            />
            <Tooltip 
              content={<ProfessionalTooltip />}
              offset={12}
              cursor={{ stroke: '#d9d9d9', strokeWidth: 1, strokeDasharray: '3 3' }}
            />
            <Legend wrapperStyle={{ paddingTop: '10px' }} />
            
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
          marginTop: '15px',  // 减少顶部间距，让两个图更紧凑
          marginBottom: '25px' // 增加底部间距，让整体更平衡
        }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: '8px',
            padding: '0 8px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{
                width: '10px',
                height: '10px',
                backgroundColor: '#95de64',
                marginRight: '8px',
                borderRadius: '2px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
              }}></div>
              <h5 style={{ 
                margin: 0, 
                color: '#595959', 
                fontSize: '11px', 
                fontWeight: '700',
                letterSpacing: '0.8px',
                textTransform: 'uppercase'
              }}>VOLUME CHART</h5>
            </div>
            <span style={{ 
              fontSize: '9px', 
              color: '#8c8c8c',
              backgroundColor: '#f8f9fa',
              padding: '3px 8px',
              borderRadius: '4px',
              border: '1px solid #e9ecef',
              fontWeight: '500',
              letterSpacing: '0.3px'
            }}>Trading Volume</span>
          </div>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 5, right: 25, left: 25, bottom: 10 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f8f8f8" vertical={false} />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 9, fill: '#666' }}
                tickFormatter={smartTickFormatter}
                axisLine={{ stroke: '#d9d9d9' }}
                tickLine={{ stroke: '#d9d9d9' }}
                height={25}
                // 使用统一的日期刻度
                ticks={dateTicks}
              />
              <YAxis 
                tick={{ fontSize: 9, fill: '#666' }}
                tickFormatter={(value) => {
                  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
                  if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
                  return value;
                }}
                axisLine={{ stroke: '#d9d9d9' }}
                tickLine={{ stroke: '#d9d9d9' }}
                width={50} // 增加宽度，避免标签被裁剪
                // 给Volume Chart的Y轴也留出适当空白
                padding={{ top: 15, bottom: 15 }} // 增加padding
              />
              <Tooltip 
                formatter={(value: any) => [formatVolume(value), 'Volume']}
                labelFormatter={(label) => `Date: ${label}`}
                offset={10}
              />
              
              {/* Volume bars with dynamic colors - 更明显的柱子 */}
              <Bar
                dataKey="volumeDisplay"
                name="Volume"
                fill="#999"  // Default color
                barSize={14} // 增加柱子宽度
                radius={[3, 3, 0, 0]} // 增加圆角
              >
                {chartData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.volumeColor || '#999'}
                    stroke={entry.volumeColor || '#999'}
                    strokeWidth={0.8} // 增加边框宽度
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
