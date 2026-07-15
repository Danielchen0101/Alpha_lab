import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Row, Col, Card, Spin, Alert, Button, Space, Empty,
  Typography, Statistic
} from 'antd';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  AreaChart, Area, ReferenceLine
} from 'recharts';
import {
  ReloadOutlined, ArrowLeftOutlined, LineChartOutlined
} from '@ant-design/icons';

const { Title, Text } = Typography;

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || '/api';

interface BacktestData {
  name?: string;
  results?: {
    equityCurve?: Array<{ date: string; equity: number }>;
    totalReturn?: number;
    maxDrawdown?: number;
    sharpeRatio?: number;
    tradesList?: Array<{ pnl: number }>;
    trades?: number;
  };
  totalReturn?: number;
  maxDrawdown?: number;
  sharpeRatio?: number;
}

const BacktestAnalysis = () => {
  const { backtestId } = useParams();
  const navigate = useNavigate();
  const [backtestData, setBacktestData] = useState<BacktestData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Generate evenly distributed date ticks for X-axis
  // Generate date ticks by month anchors - guarantees all months are displayed
  const generateDateTicks = (data: Array<{ date: string }>) => {
    if (!data || data.length === 0) {
      return [];
    }
    
    const dates = data.map(item => new Date(item.date));
    const startDate = dates[0];
    const endDate = dates[dates.length - 1];
    const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    
    // For very short periods (< 30 days), use simple approach
    if (totalDays <= 30) {
      const ticks: string[] = [];
      ticks.push(data[0].date);
      
      if (data.length > 2) {
        // Add middle point for short periods
        const midIndex = Math.floor(data.length / 2);
        ticks.push(data[midIndex].date);
      }
      
      if (data.length > 1) {
        ticks.push(data[data.length - 1].date);
      }
      
      return ticks;
    }
    
    // For longer periods, use month-based anchoring
    // Group data points by month-year
    const monthMap = new Map<string, Array<{date: string, dayOfMonth: number}>>();
    
    data.forEach((item) => {
      const date = new Date(item.date);
      const year = date.getFullYear();
      const month = date.getMonth(); // 0-11
      const key = `${year}-${month.toString().padStart(2, '0')}`;
      const dayOfMonth = date.getDate();
      
      if (!monthMap.has(key)) {
        monthMap.set(key, []);
      }
      monthMap.get(key)!.push({date: item.date, dayOfMonth});
    });
    
    // Sort month keys chronologically
    const monthKeys = Array.from(monthMap.keys()).sort();
    
    const ticks: string[] = [];
    
    // Always include start date
    ticks.push(data[0].date);
    
    // For each month (except first and last), select a representative point
    for (let i = 0; i < monthKeys.length; i++) {
      const monthKey = monthKeys[i];
      
      // Skip first and last months (handled separately)
      if (i === 0 || i === monthKeys.length - 1) continue;
      
      const monthData = monthMap.get(monthKey)!;
      
      // Find the point closest to the 15th of the month
      let bestPoint = monthData[0];
      let bestDistance = Math.abs(bestPoint.dayOfMonth - 15);
      
      for (const point of monthData) {
        const distance = Math.abs(point.dayOfMonth - 15);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestPoint = point;
        }
      }
      
      ticks.push(bestPoint.date);
    }
    
    // Always include end date
    ticks.push(data[data.length - 1].date);
    
    // Debug: log what we're generating
    console.log('Generated date ticks:', ticks.map(t => new Date(t).toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    })));
    
    return ticks;
  };

  const fetchBacktestData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/backtest/${backtestId}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch backtest data: ${response.statusText}`);
      }
      const data = await response.json();
      setBacktestData(data);
    } catch (err) {
      setError((err as Error).message || 'Failed to load backtest data');
      console.error('Error fetching backtest data:', err);
    } finally {
      setLoading(false);
    }
  }, [backtestId]);

  useEffect(() => {
    if (backtestId) {
      fetchBacktestData();
    } else {
      setError('No backtest ID provided');
      setLoading(false);
    }
  }, [backtestId, fetchBacktestData]);

  const safeToFixed = (value: number, decimals: number) => {
    if (value === null || value === undefined || isNaN(value)) return '0.00';
    return value.toFixed(decimals);
  };

  const getEquityRange = () => {
    if (!backtestData?.results?.equityCurve || backtestData.results.equityCurve.length === 0) {
      return { min: 0, max: 100 };
    }
    const values = backtestData.results.equityCurve.map(d => d.equity);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const padding = (max - min) * 0.05;
    return {
      min: Math.max(0, min - padding),
      max: max + padding
    };
  };

  const getDrawdownData = () => {
    if (!backtestData?.results?.equityCurve || backtestData.results.equityCurve.length === 0) {
      return [];
    }
    const equityCurve = backtestData.results.equityCurve;
    let runningMax = equityCurve[0].equity;
    return equityCurve.map(point => {
      runningMax = Math.max(runningMax, point.equity);
      const drawdown = ((point.equity / runningMax) - 1) * 100;
      return {
        date: point.date,
        drawdown: drawdown
      };
    });
  };

  const getDrawdownYAxisRange = () => {
    const drawdownData = getDrawdownData();
    if (drawdownData.length === 0) return [-10, 0];
    const values = drawdownData.map(d => d.drawdown);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const padding = Math.abs(max - min) * 0.1;
    return [min - padding, 0];
  };

  const getAbsoluteDrawdown = (drawdown: number | undefined) => {
    return Math.abs(drawdown || 0);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
        <Spin size="large" tip="Loading backtest analysis..." />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '24px' }}>
        <Alert
          message="Error Loading Backtest Data"
          description={error}
          type="error"
          showIcon
          action={
            <Space>
              <Button size="small" onClick={fetchBacktestData} icon={<ReloadOutlined />}>
                Retry
              </Button>
              <Button size="small" type="primary" onClick={() => navigate('/backtest')}>
                Go to Backtest Page
              </Button>
            </Space>
          }
        />
      </div>
    );
  }

  if (!backtestData) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description="No backtest data available"
      >
        <Space>
          <Button onClick={fetchBacktestData} icon={<ReloadOutlined />}>
            Retry
          </Button>
          <Button type="primary" onClick={() => navigate('/backtest')}>
            Go to Backtest Page
          </Button>
        </Space>
      </Empty>
    );
  }

  return (
    <div style={{ padding: '24px' }}>
      {/* Header */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={24}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <Button
                icon={<ArrowLeftOutlined />}
                onClick={() => navigate('/backtest')}
                style={{ marginRight: 16 }}
              >
                Back to Backtests
              </Button>
              <Title level={3} style={{ margin: 0, display: 'inline-block' }}>
                Backtest Analysis: {backtestData.name || backtestId}
              </Title>
              <Text type="secondary" style={{ marginLeft: 16 }}>
                ID: {backtestId}
              </Text>
            </div>
          </div>
        </Col>
      </Row>

      {/* Summary Stats */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="Total Return"
              value={safeToFixed(backtestData.results?.totalReturn || backtestData.totalReturn || 0, 2)}
              suffix="%"
              valueStyle={{
                color: (backtestData.results?.totalReturn || backtestData.totalReturn || 0) >= 0 ? '#3f8600' : '#cf1322'
              }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="Max Drawdown"
              value={safeToFixed(getAbsoluteDrawdown(backtestData.results?.maxDrawdown || backtestData.maxDrawdown), 2)}
              suffix="%"
              valueStyle={{ color: '#cf1322' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Equity Curve */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={24}>
          <Card title="Equity Curve" size="small" style={{ marginTop: '8px' }}>
            {backtestData.results?.equityCurve && backtestData.results.equityCurve.length > 0 ? (
              <div style={{ height: '320px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={backtestData.results.equityCurve}
                    margin={{ top: 25, right: 20, left: 20, bottom: 25 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 10 }}
                      ticks={generateDateTicks(backtestData.results.equityCurve)}
                      tickFormatter={(value) => {
                        const date = new Date(value);
                        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                      }}
                      interval={0}
                      minTickGap={5}
                      tickMargin={8}
                      allowDuplicatedCategory={false}
                    />
                    <YAxis 
                      tick={{ fontSize: 11 }}
                      domain={[getEquityRange().min, getEquityRange().max]}
                      tickFormatter={(value) => {
                        const val = Number(value);
                        if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
                        if (val >= 1000) return `$${(val / 1000).toFixed(1)}K`;
                        return `$${val.toFixed(0)}`;
                      }}
                    />
                    <Tooltip 
                      formatter={(value: any, name: string) => {
                        if (name === 'Portfolio Value') {
                          return [`$${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, name];
                        }
                        return [value, name];
                      }}
                      labelFormatter={(label) => `Date: ${new Date(label).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}`}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="equity"
                      name="Portfolio Value"
                      stroke="#1890ff"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 6, stroke: '#1890ff', strokeWidth: 2, fill: '#fff' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div style={{ 
                height: '250px', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                backgroundColor: '#fafafa',
                borderRadius: '4px'
              }}>
                <div style={{ textAlign: 'center', color: '#666' }}>
                  <LineChartOutlined style={{ fontSize: '48px', marginBottom: '16px', color: '#d9d9d9' }} />
                  <div style={{ fontSize: '16px', fontWeight: '500', marginBottom: '8px' }}>
                    No equity curve data available yet
                  </div>
                  <div style={{ fontSize: '14px', marginTop: '8px', color: '#8c8c8c' }}>
                    Equity curve data will be available when the backtest completes
                  </div>
                </div>
              </div>
            )}
          </Card>
        </Col>
      </Row>
      
      {/* Drawdown Curve */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={24}>
          <Card title="Drawdown Curve" size="small" style={{ marginTop: '24px' }}>
            {getDrawdownData().length > 0 ? (
              <div style={{ height: '270px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={getDrawdownData()}
                    margin={{ top: 25, right: 20, left: 20, bottom: 25 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 10 }}
                      ticks={generateDateTicks(getDrawdownData())}
                      tickFormatter={(value) => {
                        const date = new Date(value);
                        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                      }}
                      interval={0}
                      minTickGap={5}
                      tickMargin={8}
                      allowDuplicatedCategory={false}
                    />
                    <YAxis 
                      tick={{ fontSize: 11 }}
                      tickFormatter={(value) => `${Number(value).toFixed(1)}%`}
                      domain={getDrawdownYAxisRange()}
                    />
                    <Tooltip 
                      formatter={(value: any) => [`${Number(value).toFixed(2)}%`, 'Drawdown']}
                      labelFormatter={(label) => `Date: ${new Date(label).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}`}
                    />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="drawdown"
                      name="Drawdown"
                      stroke="#ff4d4f"
                      fill="#ffccc7"
                      fillOpacity={0.6}
                      strokeWidth={1.5}
                      activeDot={{ r: 4, stroke: '#ff4d4f', strokeWidth: 1, fill: '#fff' }}
                    />
                    
                    {/* Mark maximum drawdown point */}
                    <ReferenceLine
                      y={-getAbsoluteDrawdown(backtestData?.results?.maxDrawdown || backtestData?.maxDrawdown)}
                      stroke="#722ed1"
                      strokeWidth={1.5}
                      strokeDasharray="3 3"
                      label={{
                        value: `Max: ${safeToFixed(getAbsoluteDrawdown(backtestData?.results?.maxDrawdown || backtestData?.maxDrawdown), 2)}%`,
                        position: 'insideBottomRight',
                        fill: '#722ed1',
                        fontSize: 10,
                        fontWeight: 'bold'
                      }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div style={{ 
                height: '250px', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                backgroundColor: '#fafafa',
                borderRadius: '4px'
              }}>
                <div style={{ textAlign: 'center', color: '#666' }}>
                  <LineChartOutlined style={{ fontSize: '48px', marginBottom: '16px', color: '#d9d9d9' }} />
                  <div style={{ fontSize: '16px', fontWeight: '500', marginBottom: '8px' }}>
                    No drawdown data available
                  </div>
                  <div style={{ fontSize: '14px', marginTop: '8px', color: '#8c8c8c' }}>
                    Drawdown analysis requires equity curve data
                  </div>
                </div>
              </div>
            )}
          </Card>
        </Col>
      </Row>
      
      {/* Action buttons */}
      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        <Col span={24}>
          <Card size="small">
            <Space>
              <Button 
                icon={<ReloadOutlined />}
                onClick={fetchBacktestData}
                loading={loading}
              >
                Refresh Analysis
              </Button>
              <Button 
                type="primary"
                onClick={() => navigate('/backtest')}
              >
                Run New Backtest
              </Button>
            </Space>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default BacktestAnalysis;
