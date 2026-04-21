import React, { useState, useMemo } from 'react';
import { Card, Form, Input, InputNumber, Button, Select, Alert, Row, Col, Statistic, Tag, Divider } from 'antd';
import { RocketOutlined, LineChartOutlined, TrophyOutlined, BarChartOutlined } from '@ant-design/icons';
import { backtraderAPI } from '../services/api';
import OptimizationHeatmap, { OptimizationResult } from '../components/optimization/OptimizationHeatmap';
import OptimizationSummary from '../components/optimization/OptimizationSummary';
import OptimizationResultsTable from '../components/optimization/OptimizationResultsTable';

const ParameterOptimization = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [optimizationResults, setOptimizationResults] = useState([]);
  const [stats, setStats] = useState({
    totalCombinations: 0,
    validCombinations: 0,
    bestReturn: 0,
    worstReturn: 0,
    avgReturn: 0,
    bestSharpeRatio: 0
  });

  const strategyOptions = [
    { value: 'moving_average', label: 'Moving Average Crossover' },
    { value: 'rsi', label: 'RSI Strategy' },
    { value: 'macd', label: 'MACD Strategy' },
    { value: 'bollinger', label: 'Bollinger Bands' },
    { value: 'momentum', label: 'Momentum Strategy' },
  ];

  const selectedStrategy = Form.useWatch('strategy', form) || 'moving_average';

  // 计算组合数量预览
  const calculateCombinationsPreview = () => {
    const values = form.getFieldsValue();
    let combinations = 0;
    
    if (selectedStrategy === 'moving_average') {
      const shortSteps = Math.floor(((values.shortMaEnd || 50) - (values.shortMaStart || 5)) / (values.shortMaStep || 5)) + 1;
      const longSteps = Math.floor(((values.longMaEnd || 200) - (values.longMaStart || 50)) / (values.longMaStep || 25)) + 1;
      combinations = shortSteps * longSteps;
    }
    
    return combinations;
  };

  // 获取策略参数配置
  const getStrategyConfig = (strategy) => {
    const configs = {
      moving_average: {
        name: 'Moving Average Crossover',
        paramNames: ['Short MA', 'Long MA'],
        paramKeys: ['short_ma', 'long_ma'],
        dimensions: 2,
        description: 'Optimize short and long moving average periods'
      },
      rsi: {
        name: 'RSI Strategy',
        paramNames: ['RSI Period', 'Oversold', 'Overbought'],
        paramKeys: ['period', 'oversold', 'overbought'],
        dimensions: 3,
        description: 'Optimize RSI period and overbought/oversold levels'
      },
      macd: {
        name: 'MACD Strategy',
        paramNames: ['Fast EMA', 'Slow EMA', 'Signal'],
        paramKeys: ['fast', 'slow', 'signal'],
        dimensions: 3,
        description: 'Optimize MACD fast, slow and signal periods'
      },
      bollinger: {
        name: 'Bollinger Bands',
        paramNames: ['Period', 'Std Dev'],
        paramKeys: ['period', 'std_dev'],
        dimensions: 2,
        description: 'Optimize Bollinger period and standard deviation'
      },
      momentum: {
        name: 'Momentum Strategy',
        paramNames: ['Momentum Period'],
        paramKeys: ['period'],
        dimensions: 1,
        description: 'Optimize momentum period'
      }
    };
    
    return configs[strategy] || configs.moving_average;
  };

  const currentStrategyConfig = getStrategyConfig(selectedStrategy);

  const renderStrategyParameters = () => {
    const config = currentStrategyConfig;
    
    switch (selectedStrategy) {
      case 'moving_average':
        return (
          <div style={{ marginBottom: '24px' }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              marginBottom: '16px',
              padding: '12px 16px',
              background: '#f0f9ff',
              borderRadius: '8px',
              borderLeft: '4px solid #1890ff'
            }}>
              <LineChartOutlined style={{ marginRight: '12px', color: '#1890ff', fontSize: '18px' }} />
              <div>
                <div style={{ fontSize: '16px', fontWeight: '600', color: '#1f1f1f' }}>
                  {config.name} Parameters
                </div>
                <div style={{ fontSize: '14px', color: '#595959', marginTop: '4px' }}>
                  {config.description}
                </div>
              </div>
            </div>
            
            <Row gutter={[24, 16]}>
              <Col span={24}>
                <div style={{ 
                  padding: '16px', 
                  background: '#fafafa', 
                  borderRadius: '8px',
                  marginBottom: '16px'
                }}>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: '15px', fontWeight: '600', color: '#262626' }}>
                    Short Moving Average
                  </h4>
                  <Row gutter={16}>
                    <Col span={8}>
                      <Form.Item label="Start" name="shortMaStart" initialValue={5}>
                        <InputNumber min={1} max={200} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item label="End" name="shortMaEnd" initialValue={50}>
                        <InputNumber min={1} max={200} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item label="Step" name="shortMaStep" initialValue={5}>
                        <InputNumber min={1} max={50} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                  </Row>
                </div>
              </Col>
              
              <Col span={24}>
                <div style={{ 
                  padding: '16px', 
                  background: '#fafafa', 
                  borderRadius: '8px'
                }}>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: '15px', fontWeight: '600', color: '#262626' }}>
                    Long Moving Average
                  </h4>
                  <Row gutter={16}>
                    <Col span={8}>
                      <Form.Item label="Start" name="longMaStart" initialValue={50}>
                        <InputNumber min={1} max={300} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item label="End" name="longMaEnd" initialValue={200}>
                        <InputNumber min={1} max={300} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item label="Step" name="longMaStep" initialValue={25}>
                        <InputNumber min={1} max={100} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                  </Row>
                </div>
              </Col>
            </Row>
          </div>
        );
      
      default:
        return (
          <div style={{ 
            marginBottom: '24px',
            padding: '24px',
            background: '#fafafa',
            borderRadius: '8px',
            border: '1px dashed #d9d9d9',
            textAlign: 'center'
          }}>
            <LineChartOutlined style={{ fontSize: '32px', color: '#bfbfbf', marginBottom: '12px' }} />
            <div style={{ fontSize: '16px', fontWeight: '500', color: '#595959', marginBottom: '8px' }}>
              {config.name} Parameter Optimization
            </div>
            <div style={{ fontSize: '14px', color: '#8c8c8c' }}>
              Full parameter optimization for {config.name.toLowerCase()} is available in the backend.
              <div style={{ marginTop: '8px', fontStyle: 'italic' }}>
                Parameters: {config.paramNames.join(', ')}
              </div>
            </div>
          </div>
        );
    }
  };

  const handleRunOptimization = async (values) => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    setOptimizationResults([]);

    // Convert period to startDate/endDate
    let startDate, endDate;
    const today = new Date();
    endDate = today.toISOString().split('T')[0];

    switch (values.period) {
      case '3m':
        startDate = new Date(today.getFullYear(), today.getMonth() - 3, today.getDate())
          .toISOString().split('T')[0];
        break;
      case '6m':
        startDate = new Date(today.getFullYear(), today.getMonth() - 6, today.getDate())
          .toISOString().split('T')[0];
        break;
      case '1y':
        startDate = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate())
          .toISOString().split('T')[0];
        break;
      default:
        startDate = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate())
          .toISOString().split('T')[0];
    }

    const payload = {
      symbol: values.symbol,
      strategy: values.strategy,
      parameters: {
        short_ma: {
          min: values.shortMaStart || 5,
          max: values.shortMaEnd || 50,
          step: values.shortMaStep || 5
        },
        long_ma: {
          min: values.longMaStart || 50,
          max: values.longMaEnd || 200,
          step: values.longMaStep || 25
        }
      },
      start_date: startDate,
      end_date: endDate,
      initial_capital: values.initial_capital
    };

    try {
      const response = await backtraderAPI.runParameterOptimization(payload);
      
      if (response.data && response.data.success) {
        // Save optimization results
        setOptimizationResults(response.data.results || []);
        
        // Save stats
        if (response.data.summary) {
          setStats({
            totalCombinations: response.data.summary.totalCombinations || 0,
            validCombinations: response.data.summary.validCombinations || 0,
            bestReturn: response.data.summary.bestTotalReturn || 0,
            worstReturn: response.data.summary.worstTotalReturn || 0,
            avgReturn: response.data.summary.avgTotalReturn || 0,
            bestSharpeRatio: response.data.summary.bestSharpeRatio || 0
          });
        }
        
        setSuccess(`Optimization completed! Found ${response.data.results?.length || 0} valid combinations.`);
      } else {
        setError(response.data?.error || 'Optimization failed');
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to run optimization');
    } finally {
      setLoading(false);
    }
  };

  // 计算最佳组合
  const bestCombinations = useMemo(() => {
    if (optimizationResults.length === 0) return { bySharpe: null, byReturn: null };
    
    const bySharpe = optimizationResults.reduce((best, current) => 
      (current.sharpeRatio > best.sharpeRatio) ? current : best
    );
    
    const byReturn = optimizationResults.reduce((best, current) => 
      (current.totalReturn > best.totalReturn) ? current : best
    );
    
    return { bySharpe, byReturn };
  }, [optimizationResults]);

  // 格式化百分比
  const formatPercent = (value) => {
    if (value === undefined || value === null || isNaN(value)) {
      return "N/A";
    }
    if (value === 0) return "0.00%";
    const sign = value > 0 ? "+" : "-";
    return `${sign}${Math.abs(value).toFixed(2)}%`;
  };

  const combinationsPreview = calculateCombinationsPreview();

  return (
    <div style={{ padding: '24px', maxWidth: '1600px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
          <LineChartOutlined style={{ marginRight: '16px', color: '#1890ff', fontSize: '28px' }} />
          <h1 style={{ margin: 0, fontSize: '28px', fontWeight: '600', color: '#1f1f1f' }}>
            Parameter Optimization
          </h1>
        </div>
        <p style={{ margin: 0, fontSize: '16px', color: '#595959', maxWidth: '800px' }}>
          Optimize strategy parameters to find the best combination. Results are ranked by Sharpe ratio.
          {combinationsPreview > 0 && ` Will test approximately ${combinationsPreview} parameter combinations.`}
        </p>
      </div>

      {/* Optimization Form */}
      <Card
        style={{
          marginBottom: '32px',
          borderRadius: '12px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
          border: '1px solid #f0f0f0'
        }}
        bodyStyle={{ padding: '24px' }}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleRunOptimization}
          initialValues={{
            symbol: 'AAPL',
            strategy: 'moving_average',
            period: '1y',
            initial_capital: 100000
          }}
        >
          {/* Basic Parameters */}
          <div style={{ marginBottom: '24px' }}>
            <div style={{ 
              fontSize: '16px', 
              fontWeight: '600', 
              color: '#1f1f1f',
              marginBottom: '16px',
              paddingBottom: '12px',
              borderBottom: '1px solid #f0f0f0'
            }}>
              Basic Parameters
            </div>
            <Row gutter={[24, 16]}>
              <Col xs={24} sm={12} md={6}>
                <Form.Item label="Symbol" name="symbol" rules={[{ required: true }]}>
                  <Input placeholder="e.g., AAPL" size="large" />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12} md={6}>
                <Form.Item label="Strategy" name="strategy" rules={[{ required: true }]}>
                  <Select size="large">
                    <Select.Option value="moving_average">Moving Average</Select.Option>
                    <Select.Option value="rsi">RSI</Select.Option>
                    <Select.Option value="bollinger">Bollinger Bands</Select.Option>
                  </Select>
                </Form.Item>
              </Col>
            </Row>
          </div>
        </Form>
      </Card>
    </div>
  );
};

export default ParameterOptimizationOptimized;
