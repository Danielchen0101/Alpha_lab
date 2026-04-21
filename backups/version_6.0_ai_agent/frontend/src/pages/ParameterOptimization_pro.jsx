import React, { useState, useMemo } from 'react';
import { Card, Form, Input, InputNumber, Button, Select, Alert, Row, Col, Statistic, Tag, Divider, Typography } from 'antd';
import { RocketOutlined, LineChartOutlined, TrophyOutlined, BarChartOutlined, ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';
import { backtraderAPI } from '../services/api';
import OptimizationHeatmap, { OptimizationResult } from '../components/optimization/OptimizationHeatmap';
import OptimizationSummary from '../components/optimization/OptimizationSummary';
import OptimizationResultsTable from '../components/optimization/OptimizationResultsTable';

const { Title, Text, Paragraph } = Typography;

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

  // 获取策略配置
  const getStrategyConfig = (strategy) => {
    const configs = {
      moving_average: {
        name: 'Moving Average Crossover',
        paramNames: ['Short MA', 'Long MA'],
        paramKeys: ['short_ma', 'long_ma'],
        dimensions: 2,
        description: 'Optimize short and long moving average periods for crossover signals'
      },
      rsi: {
        name: 'RSI Strategy',
        paramNames: ['RSI Period', 'Oversold', 'Overbought'],
        paramKeys: ['period', 'oversold', 'overbought'],
        dimensions: 3,
        description: 'Optimize RSI period and overbought/oversold threshold levels'
      },
      macd: {
        name: 'MACD Strategy',
        paramNames: ['Fast EMA', 'Slow EMA', 'Signal'],
        paramKeys: ['fast', 'slow', 'signal'],
        dimensions: 3,
        description: 'Optimize MACD fast, slow EMA periods and signal line'
      },
      bollinger: {
        name: 'Bollinger Bands',
        paramNames: ['Period', 'Std Dev'],
        paramKeys: ['period', 'std_dev'],
        dimensions: 2,
        description: 'Optimize moving average period and standard deviation multiplier'
      },
      momentum: {
        name: 'Momentum Strategy',
        paramNames: ['Momentum Period'],
        paramKeys: ['period'],
        dimensions: 1,
        description: 'Optimize lookback period for momentum calculation'
      }
    };
    
    return configs[strategy] || configs.moving_average;
  };

  const currentStrategyConfig = getStrategyConfig(selectedStrategy);

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

  const combinationsPreview = calculateCombinationsPreview();

  const renderStrategyParameters = () => {
    if (selectedStrategy === 'moving_average') {
      return (
        <div style={{ marginBottom: '24px' }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            marginBottom: '20px',
            padding: '16px',
            background: 'linear-gradient(135deg, #f0f9ff 0%, #e6f4ff 100%)',
            borderRadius: '10px',
            borderLeft: '5px solid #1890ff'
          }}>
            <LineChartOutlined style={{ marginRight: '16px', color: '#1890ff', fontSize: '22px' }} />
            <div>
              <div style={{ fontSize: '17px', fontWeight: '600', color: '#1f1f1f' }}>
                {currentStrategyConfig.name} Parameters
              </div>
              <div style={{ fontSize: '14px', color: '#595959', marginTop: '6px' }}>
                {currentStrategyConfig.description}
              </div>
            </div>
          </div>
          
          <Row gutter={[24, 20]}>
            <Col span={24}>
              <Card 
                size="small"
                style={{ 
                  border: '1px solid #e6f4ff',
                  borderRadius: '8px',
                  boxShadow: '0 1px 3px rgba(24, 144, 255, 0.1)'
                }}
                bodyStyle={{ padding: '20px' }}
              >
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  marginBottom: '16px',
                  paddingBottom: '12px',
                  borderBottom: '1px solid #f0f0f0'
                }}>
                  <div style={{ 
                    width: '4px', 
                    height: '18px', 
                    background: '#1890ff', 
                    borderRadius: '2px', 
                    marginRight: '12px' 
                  }} />
                  <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '600', color: '#262626' }}>
                    Short Moving Average
                  </h4>
                </div>
                <Row gutter={20}>
                  <Col span={8}>
                    <Form.Item 
                      label={<span style={{ fontWeight: '500' }}>Start</span>} 
                      name="shortMaStart" 
                      initialValue={5}
                      tooltip="Minimum short MA period"
                    >
                      <InputNumber 
                        min={1} 
                        max={200} 
                        style={{ width: '100%' }} 
                        size="middle"
                      />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item 
                      label={<span style={{ fontWeight: '500' }}>End</span>} 
                      name="shortMaEnd" 
                      initialValue={50}
                      tooltip="Maximum short MA period"
                    >
                      <InputNumber 
                        min={1} 
                        max={200} 
                        style={{ width: '100%' }} 
                        size="middle"
                      />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item 
                      label={<span style={{ fontWeight: '500' }}>Step</span>} 
                      name="shortMaStep" 
                      initialValue={5}
                      tooltip="Increment step between values"
                    >
                      <InputNumber 
                        min={1} 
                        max={50} 
                        style={{ width: '100%' }} 
                        size="middle"
                      />
                    </Form.Item>
                  </Col>
                </Row>
              </Card>
            </Col>
            
            <Col span={24}>
              <Card 
                size="small"
                style={{ 
                  border: '1px solid #d9f7be',
                  borderRadius: '8px',
                  boxShadow: '0 1px 3px rgba(82, 196, 26, 0.1)'
                }}
                bodyStyle={{ padding: '20px' }}
              >
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  marginBottom: '16px',
                  paddingBottom: '12px',
                  borderBottom: '1px solid #f0f0f0'
                }}>
                  <div style={{ 
                    width: '4px', 
                    height: '18px', 
                    background: '#52c41a', 
                    borderRadius: '2px', 
                    marginRight: '12px' 
                  }} />
                  <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '600', color: '#262626' }}>
                    Long Moving Average
                  </h4>
                </div>
                <Row gutter={20}>
                  <Col span={8}>
                    <Form.Item 
                      label={<span style={{ fontWeight: '500' }}>Start</span>} 
                      name="longMaStart" 
                      initialValue={50}
                      tooltip="Minimum long MA period"
                    >
                      <InputNumber 
                        min={1} 
                        max={300} 
                        style={{ width: '100%' }} 
                        size="middle"
                      />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item 
                      label={<span style={{ fontWeight: '500' }}>End</span>} 
                      name="longMaEnd" 
                      initialValue={200}
                      tooltip="Maximum long MA period"
                    >
                      <InputNumber 
                        min={1} 
                        max={300} 
                        style={{ width: '100%' }} 
                        size="middle"
                      />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item 
                      label={<span style={{ fontWeight: '500' }}>Step</span>} 
                      name="longMaStep" 
                      initialValue={25}
                      tooltip="Increment step between values"
                    >
                      <InputNumber 
                        min={1} 
                        max={100} 
                        style={{ width: '100%' }} 
                        size="middle"
                      />
                    </Form.Item>
                  </Col>
                </Row>
              </Card>
            </Col>
          </Row>
        </div>
      );
    }
    
    // 其他策略的占位符
    return (
      <div style={{ 
        marginBottom: '24px',
        padding: '32px',
        background: 'linear-gradient(135deg, #fafafa 0%, #f5f5f5 100%)',
        borderRadius: '10px',
        border: '1px dashed #d9d9d9',
        textAlign: 'center'
      }}>
        <LineChartOutlined style={{ fontSize: '36px', color: '#bfbfbf', marginBottom: '16px' }} />
        <div style={{ fontSize: '18px', fontWeight: '500', color: '#595959', marginBottom: '8px' }}>
          {currentStrategyConfig.name} Parameter Optimization
        </div>
        <div style={{ fontSize: '14px', color: '#8c8c8c', maxWidth: '600px', margin: '0 auto 16px auto' }}>
          Full parameter optimization for {currentStrategyConfig.name.toLowerCase()} is fully implemented in the backend.
          The system will test all combinations of the following parameters:
        </div>
        <div style={{ 
          display: 'inline-flex', 
          flexWrap: 'wrap', 
          gap: '8px', 
          justifyContent: 'center',
          marginBottom: '20px'
        }}>
          {currentStrategyConfig.paramNames.map((param, index) => (
            <Tag 
              key={index}
              color={index === 0 ? 'blue' : index === 1 ? 'green' : index === 2 ? 'orange' : 'purple'}
              style={{ fontSize: '13px', fontWeight: '500', padding: '4px 12px' }}
            >
              {param}
            </Tag>
          ))}
        </div>
        <div style={{ fontSize: '13px', color: '#bfbfbf', fontStyle: 'italic' }}>
          Switch to "Moving Average Crossover" for interactive parameter tuning in this interface.
        </div>
      </div>
    );
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
        
        setSuccess(`Optimization completed successfully! Found ${response.data.results?.length || 0} valid parameter combinations.`);
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

  // 渲染最佳组合卡片
  const renderBestCombinationCard = (title, result, icon, color) => {
    if (!result) return null;
    
    return (
      <Card
        style={{
          height: '100%',
          border: `1px solid ${color}20`,
          borderRadius: '10px',
          boxShadow: `0 2px 8px ${color}10`
        }}
        bodyStyle={{ padding: '20px' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '8px',
            background: `${color}10`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: '12px'
          }}>
            {icon}
          </div>
          <div>
            <div style={{ fontSize: '16px', fontWeight: '600', color: '#1f1f1f' }}>
              {title}
            </div>
            <div style={{ fontSize: '13px', color: '#8c8c8c' }}>
              {currentStrategyConfig.name}
            </div>
          </div>
        </div>
        
        <Divider style={{ margin: '16px 0' }} />
        
        {/* 参数 */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '14px', fontWeight: '500', color: '#595959', marginBottom: '8px' }}>
            Optimal Parameters
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {currentStrategyConfig.paramNames.map((paramName