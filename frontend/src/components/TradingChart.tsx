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
  const prices = data.map(d => d.close).filter(Boolean);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const pricePadding = (maxPrice - minPrice) * 0.1; // 10% padding

  // Find min and max for volume Y-axis scaling
  const volumes = data.map(d => d.volume || 0).filter(Boolean);
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

  // Calculate chart heights with optimized proportions
  const priceChartHeight = (hasVolumeData && showVolume) ? height * 0.65 : height * 0.8;
  const volumeChartHeight = (hasVolumeData && showVolume) ? height * 0.35 : 0;

  // Format date for X-axis - 修复时区问题
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

  // Custom tooltip component with offset to avoid covering data points
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      // Find the data point
      const dataPoint = chartData.find(item => item.date === label);
      if (!dataPoint) return null;

      return (
        <div style={{
          backgroundColor: 'white',
          padding: '12px',
          border: '1px solid #e8e8e8',
          borderRadius: '4px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          transform: 'translate(-50%, -100%)', // Offset to avoid covering data point
          marginTop: '-10px' // Additional offset
        }}>
          <p style={{ margin: 0, fontWeight: 'bold', color: '#333' }}>
            Date: {label}
          </p>
          <p style={{ margin: '4px 0 0 0', color: '#666' }}>
            Close Price: <span style={{ fontWeight: 'bold', color: '#1890ff' }}>
              ${dataPoint.close.toFixed(2)}
            </span>
          </p>
          
          {dataPoint.sma20 !== undefined && (
            <p style={{ margin: '2px 0 0 0', color: '#666' }}>
              SMA 20: <span style={{ fontWeight: 'bold', color: '#52c41a' }}>
                ${dataPoint.sma20.toFixed(2)}
              </span>
            </p>
          )}
          
          {dataPoint.sma50 !== undefined && (
            <p style={{ margin: '2px 0 0 0', color: '#666' }}>
              SMA 50: <span style={{ fontWeight: 'bold', color: '#fa8c16' }}>
                ${dataPoint.sma50.toFixed(2)}
              </span>
            </p>
          )}
          
          {dataPoint.volume !== undefined && dataPoint.volume > 0 && (
            <p style={{ margin: '2px 0 0 0', color: '#666' }}>
              Volume: <span style={{ fontWeight: 'bold' }}>
                {formatVolume(dataPoint.volume)}
              </span>
            </p>
          )}
          
          {dataPoint.signal !== 0 && (
            <p style={{ 
              margin: '4px 0 0 0', 
              fontWeight: 'bold',
              color: dataPoint.signal === 1 ? '#52c41a' : '#f5222d'
            }}>
              Signal: {dataPoint.signal === 1 ? 'BUY' : 'SELL'}
            </p>
          )}
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
        
        {/* Chart Controls - Compact version */}
        <div style={{ 
          display: 'flex',
          alignItems: 'center',
          padding: '4px 8px',
          backgroundColor: '#f8f9fa',
          borderRadius: '6px',
          border: '1px solid #e9ecef',
          fontSize: '12px'
        }}>
          <Space direction="horizontal" size="small">
            <Checkbox 
              checked={showClosePrice} 
              onChange={(e) => setShowClosePrice(e.target.checked)}
              style={{ fontSize: '12px' }}
            >
              Price
            </Checkbox>
            
            {hasSMA20 && (
              <Checkbox 
                checked={showSMA20} 
                onChange={(e) => setShowSMA20(e.target.checked)}
                style={{ fontSize: '12px' }}
              >
                SMA20
              </Checkbox>
            )}
            
            {hasSMA50 && (
              <Checkbox 
                checked={showSMA50} 
                onChange={(e) => setShowSMA50(e.target.checked)}
                style={{ fontSize: '12px' }}
              >
                SMA50
              </Checkbox>
            )}
            
            {hasSignals && (
              <Checkbox 
                checked={showSignals} 
                onChange={(e) => setShowSignals(e.target.checked)}
                style={{ fontSize: '12px' }}
              >
                Signals
              </Checkbox>
            )}
            
            {hasVolumeData && (
              <Checkbox 
                checked={showVolume} 
                onChange={(e) => setShowVolume(e.target.checked)}
                style={{ fontSize: '12px' }}
              >
                Volume
              </Checkbox>
            )}
          </Space>
        </div>
      </div>
      
      {/* Price Chart */}
      <div style={{ 
        height: priceChartHeight, 
        marginBottom: (hasVolumeData && showVolume) ? '32px' : '0'  // Increased spacing
      }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis 
              dataKey="date" 
              tick={{ fontSize: 12 }}
              tickFormatter={formatDate}
            />
            <YAxis 
              domain={[minPrice - pricePadding, maxPrice + pricePadding]}
              tick={{ fontSize: 12 }}
              tickFormatter={(value) => `$${value.toFixed(2)}`}
            />
            <Tooltip 
              content={<CustomTooltip />}
              offset={10} // Add offset to tooltip
            />
            <Legend wrapperStyle={{ paddingTop: '10px' }} />
            
            {/* Price line */}
            {showClosePrice && (
              <Line
                type="monotone"
                dataKey="close"
                stroke="#1890ff"
                strokeWidth={2}
                dot={false}
                name="Close Price"
                activeDot={{ r: 6 }}
              />
            )}
            
            {/* SMA20 line */}
            {showSMA20 && hasSMA20 && (
              <Line
                type="monotone"
                dataKey="sma20"
                stroke="#52c41a"
                strokeWidth={1.5}
                strokeDasharray="5 5"
                dot={false}
                name="SMA 20"
              />
            )}
            
            {/* SMA50 line */}
            {showSMA50 && hasSMA50 && (
              <Line
                type="monotone"
                dataKey="sma50"
                stroke="#fa8c16"
                strokeWidth={1.5}
                strokeDasharray="5 5"
                dot={false}
                name="SMA 50"
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
          height: '120px',  // Reduced height for better hierarchy
          marginBottom: '24px'  // Spacing before parameters
        }}>
          <h5 style={{ marginBottom: '12px', color: '#666', fontSize: '14px' }}>Volume Chart</h5>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 10 }}
                tickFormatter={formatDate}
                interval="preserveStartEnd"
                minTickGap={20}
              />
              <YAxis 
                tick={{ fontSize: 10 }}
                tickFormatter={(value) => {
                  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
                  if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
                  return value;
                }}
              />
              <Tooltip 
                formatter={(value: any) => [formatVolume(value), 'Volume']}
                labelFormatter={(label) => `Date: ${label}`}
                offset={10}
              />
              
              {/* Volume bars with dynamic colors */}
              <Bar
                dataKey="volumeDisplay"
                name="Volume"
                fill="#999"  // Default color
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.volumeColor || '#999'} />
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
