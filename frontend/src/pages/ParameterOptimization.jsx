import React, { useState, useEffect } from 'react';
import { Card, Form, Input, InputNumber, Button, Select, Alert, Row, Col, Typography, Space, Badge, Divider } from 'antd';
import { RocketOutlined, SettingOutlined, SearchOutlined, LineChartOutlined, ExperimentOutlined, CheckCircleOutlined, WarningOutlined } from '@ant-design/icons';
import { backtraderAPI } from '../services/api';
import OptimizationHeatmap, { OptimizationResult } from '../components/optimization/OptimizationHeatmap';
import OptimizationSummary from '../components/optimization/OptimizationSummary';
import OptimizationResultsTable from '../components/optimization/OptimizationResultsTable';

const { Title, Text } = Typography;

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

  // Reset form fields when strategy changes
  useEffect(() => {
    if (!form) return;

    // Clear any previous errors
    setError(null);
    
    // Reset form fields based on selected strategy
    const resetFormForStrategy = () => {
      const currentValues = form.getFieldsValue();
      const newValues = { ...currentValues };
      
      // Clear all strategy-specific parameters
      const strategyFields = [
        'shortMaStart', 'shortMaEnd', 'shortMaStep',
        'longMaStart', 'longMaEnd', 'longMaStep',
        'momentumPeriodStart', 'momentumPeriodEnd', 'momentumPeriodStep',
        'rsiPeriodStart', 'rsiPeriodEnd', 'rsiPeriodStep',
        'oversoldStart', 'oversoldEnd', 'oversoldStep',
        'overboughtStart', 'overboughtEnd', 'overboughtStep',
        'fastStart', 'fastEnd', 'fastStep',
        'slowStart', 'slowEnd', 'slowStep',
        'signalStart', 'signalEnd', 'signalStep',
        'periodStart', 'periodEnd', 'periodStep',
        'stdDevStart', 'stdDevEnd', 'stdDevStep'
      ];
      
      // Remove all strategy fields
      strategyFields.forEach(field => {
        delete newValues[field];
      });
      
      // Set default values based on strategy
      if (selectedStrategy === 'moving_average') {
        newValues.shortMaStart = 5;
        newValues.shortMaEnd = 25;
        newValues.shortMaStep = 5;
        newValues.longMaStart = 50;
        newValues.longMaEnd = 200;
        newValues.longMaStep = 25;
      } else if (selectedStrategy === 'momentum') {
        newValues.momentumPeriodStart = 5;
        newValues.momentumPeriodEnd = 30;
        newValues.momentumPeriodStep = 5;
      } else if (selectedStrategy === 'rsi') {
        newValues.rsiPeriodStart = 10;
        newValues.rsiPeriodEnd = 20;
        newValues.rsiPeriodStep = 5;
        newValues.oversoldStart = 25;
        newValues.oversoldEnd = 35;
        newValues.oversoldStep = 5;
        newValues.overboughtStart = 65;
        newValues.overboughtEnd = 75;
        newValues.overboughtStep = 5;
      } else if (selectedStrategy === 'macd') {
        newValues.fastStart = 8;
        newValues.fastEnd = 12;
        newValues.fastStep = 2;
        newValues.slowStart = 20;
        newValues.slowEnd = 30;
        newValues.slowStep = 5;
        newValues.signalStart = 7;
        newValues.signalEnd = 11;
        newValues.signalStep = 2;
      } else if (selectedStrategy === 'bollinger') {
        newValues.periodStart = 10;
        newValues.periodEnd = 30;
        newValues.periodStep = 5;
        newValues.stdDevStart = 1.5;
        newValues.stdDevEnd = 2.5;
        newValues.stdDevStep = 0.5;
      }
      
      // Update form values
      form.setFieldsValue(newValues);
    };
    
    resetFormForStrategy();
  }, [selectedStrategy, form]);

  const renderParameterRange = (title, namePrefix) => (
    <div style={{ 
      background: '#f8f9fa', 
      padding: '16px', 
      borderRadius: '10px', 
      border: '1px solid #eef2f6',
      height: '100%'
    }}>
      <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <SettingOutlined style={{ color: '#1890ff' }} />
        <Text strong style={{ fontSize: '13px', color: '#595959', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{title}</Text>
      </div>
      <Row gutter={12}>
        <Col span={8}>
          <Form.Item label={<Text type="secondary" style={{ fontSize: '12px' }}>Start</Text>} name={`${namePrefix}Start`}>
            <InputNumber min={0.1} max={500} style={{ width: '100%', borderRadius: '6px' }} />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item label={<Text type="secondary" style={{ fontSize: '12px' }}>End</Text>} name={`${namePrefix}End`}>
            <InputNumber min={0.1} max={500} style={{ width: '100%', borderRadius: '6px' }} />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item label={<Text type="secondary" style={{ fontSize: '12px' }}>Step</Text>} name={`${namePrefix}Step`}>
            <InputNumber min={0.1} max={100} style={{ width: '100%', borderRadius: '6px' }} />
          </Form.Item>
        </Col>
      </Row>
    </div>
  );

  const renderStrategyParameters = () => {
    if (selectedStrategy === 'moving_average') {
      return (
        <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
          <Col span={12}>{renderParameterRange('Short MA Parameters', 'shortMa')}</Col>
          <Col span={12}>{renderParameterRange('Long MA Parameters', 'longMa')}</Col>
        </Row>
      );
    } else if (selectedStrategy === 'momentum') {
      return (
        <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
          <Col span={12}>{renderParameterRange('Momentum Period', 'momentumPeriod')}</Col>
        </Row>
      );
    } else if (selectedStrategy === 'rsi') {
      return (
        <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
          <Col span={8}>{renderParameterRange('RSI Period', 'rsiPeriod')}</Col>
          <Col span={8}>{renderParameterRange('Oversold Level', 'oversold')}</Col>
          <Col span={8}>{renderParameterRange('Overbought Level', 'overbought')}</Col>
        </Row>
      );
    } else if (selectedStrategy === 'macd') {
      return (
        <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
          <Col span={8}>{renderParameterRange('Fast EMA', 'fast')}</Col>
          <Col span={8}>{renderParameterRange('Slow EMA', 'slow')}</Col>
          <Col span={8}>{renderParameterRange('Signal EMA', 'signal')}</Col>
        </Row>
      );
    } else if (selectedStrategy === 'bollinger') {
      return (
        <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
          <Col span={12}>{renderParameterRange('Period Parameters', 'period')}</Col>
          <Col span={12}>{renderParameterRange('Std Dev Parameters', 'stdDev')}</Col>
        </Row>
      );
    }
    
    return (
      <div style={{ padding: '30px', background: '#f8f9fa', borderRadius: '12px', marginBottom: '24px', textAlign: 'center', border: '1px dashed #d9d9d9' }}>
        <Text type="secondary">Strategy parameters for {selectedStrategy} configuration will be displayed here.</Text>
      </div>
    );
  };

  const handleRunOptimization = async (values) => {
    // Validate parameters
    let validationError = null;
    
    // Common validation
    const validateRange = (start, end, step, fieldName) => {
      if (start > end) {
        return `${fieldName}: Start (${start}) must be less than or equal to End (${end})`;
      }
      if (step <= 0) {
        return `${fieldName}: Step (${step}) must be greater than 0`;
      }
      return null;
    };
    
    // Strategy-specific validation
    if (values.strategy === 'moving_average') {
      const shortError = validateRange(values.shortMaStart, values.shortMaEnd, values.shortMaStep, 'Short MA');
      const longError = validateRange(values.longMaStart, values.longMaEnd, values.longMaStep, 'Long MA');
      validationError = shortError || longError;
      if (!validationError && values.shortMaEnd >= values.longMaStart) {
        validationError = 'Short MA range should be less than Long MA range for meaningful crossover';
      }
    } else if (values.strategy === 'rsi') {
      const rsiError = validateRange(values.rsiPeriodStart, values.rsiPeriodEnd, values.rsiPeriodStep, 'RSI Period');
      const oversoldError = validateRange(values.oversoldStart, values.oversoldEnd, values.oversoldStep, 'Oversold');
      const overboughtError = validateRange(values.overboughtStart, values.overboughtEnd, values.overboughtStep, 'Overbought');
      validationError = rsiError || oversoldError || overboughtError;
      if (!validationError && values.oversoldEnd >= values.overboughtStart) {
        validationError = 'Oversold levels must be less than Overbought levels';
      }
    } else if (values.strategy === 'macd') {
      const fastError = validateRange(values.fastStart, values.fastEnd, values.fastStep, 'Fast EMA');
      const slowError = validateRange(values.slowStart, values.slowEnd, values.slowStep, 'Slow EMA');
      const signalError = validateRange(values.signalStart, values.signalEnd, values.signalStep, 'Signal EMA');
      validationError = fastError || slowError || signalError;
      if (!validationError && values.fastEnd >= values.slowStart) {
        validationError = 'Fast EMA must be less than Slow EMA';
      }
    } else if (values.strategy === 'bollinger') {
      const periodError = validateRange(values.periodStart, values.periodEnd, values.periodStep, 'Period');
      const stdDevError = validateRange(values.stdDevStart, values.stdDevEnd, values.stdDevStep, 'Std Dev');
      validationError = periodError || stdDevError;
      if (!validationError && values.stdDevStart <= 0) {
        validationError = 'Std Dev must be greater than 0';
      }
    } else if (values.strategy === 'momentum') {
      validationError = validateRange(values.momentumPeriodStart, values.momentumPeriodEnd, values.momentumPeriodStep, 'Momentum Period');
    }
    
    if (validationError) {
      setError(validationError);
      setLoading(false);
      return;
    }
    
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
        startDate = new Date(today.getFullYear(), today.getMonth() - 3, today.getDate()).toISOString().split('T')[0];
        break;
      case '6m':
        startDate = new Date(today.getFullYear(), today.getMonth() - 6, today.getDate()).toISOString().split('T')[0];
        break;
      case '1y':
        startDate = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate()).toISOString().split('T')[0];
        break;
      default:
        startDate = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate()).toISOString().split('T')[0];
    }

    // Create parameters based on strategy
    let payload = {
      symbol: values.symbol,
      strategy: values.strategy,
      startDate: startDate,
      endDate: endDate,
      initialCapital: values.initial_capital
    };

    if (values.strategy === 'moving_average') {
      payload.shortMaRange = { start: values.shortMaStart, end: values.shortMaEnd, step: values.shortMaStep };
      payload.longMaRange = { start: values.longMaStart, end: values.longMaEnd, step: values.longMaStep };
    } else if (values.strategy === 'rsi') {
      payload.rsiPeriodRange = { start: values.rsiPeriodStart, end: values.rsiPeriodEnd, step: values.rsiPeriodStep };
      payload.oversoldRange = { start: values.oversoldStart, end: values.oversoldEnd, step: values.oversoldStep };
      payload.overboughtRange = { start: values.overboughtStart, end: values.overboughtEnd, step: values.overboughtStep };
    } else if (values.strategy === 'macd') {
      payload.fastRange = { start: values.fastStart, end: values.fastEnd, step: values.fastStep };
      payload.slowRange = { start: values.slowStart, end: values.slowEnd, step: values.slowStep };
      payload.signalRange = { start: values.signalStart, end: values.signalEnd, step: values.signalStep };
    } else if (values.strategy === 'bollinger') {
      payload.periodRange = { start: values.periodStart, end: values.periodEnd, step: values.periodStep };
      payload.stdDevRange = { start: values.stdDevStart, end: values.stdDevEnd, step: values.stdDevStep };
    } else if (values.strategy === 'momentum') {
      payload.momentumPeriodRange = { start: values.momentumPeriodStart, end: values.momentumPeriodEnd, step: values.momentumPeriodStep };
    }

    try {
      const response = await backtraderAPI.runParameterOptimization(payload);
      if (response.data && response.data.success) {
        const result = response.data.result || {};
        setOptimizationResults(result.results || []);
        if (result.summary) {
          setStats({
            totalCombinations: result.summary.totalCombinations || 0,
            validCombinations: result.summary.validCombinations || 0,
            bestReturn: result.summary.bestTotalReturn || 0,
            worstReturn: result.summary.worstTotalReturn || 0,
            avgReturn: result.summary.avgTotalReturn || 0,
            bestSharpeRatio: result.summary.bestSharpeRatio || 0
          });
        }
        setSuccess(`Optimization completed! Found ${result.results?.length || 0} valid combinations.`);
      } else {
        setError(response.data?.result?.error || response.data?.error || 'Optimization failed');
      }
    } catch (err) {
      const errorData = err.response?.data;
      setError(errorData?.result?.error || errorData?.error || err.message || 'Failed to run optimization');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '0 8px 40px 8px', maxWidth: '1600px', margin: '0 auto', animation: 'fadeIn 0.5s ease-out' }}>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .premium-card { border-radius: 12px !important; border: 1px solid #f0f0f0 !important; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03) !important; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important; }
        .premium-card:hover { box-shadow: 0 8px 24px rgba(0, 0, 0, 0.06) !important; }
        .primary-cta-button { height: 48px; font-weight: 700; letter-spacing: 0.5px; border-radius: 10px; box-shadow: 0 4px 14px rgba(24, 144, 255, 0.25); transition: all 0.3s; }
        .primary-cta-button:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(24, 144, 255, 0.35); }
        @keyframes subtlePulse { 0% { opacity: 0.8; transform: scale(1); } 50% { opacity: 1; transform: scale(1.02); } 100% { opacity: 0.8; transform: scale(1); } }
        .running-pulse { animation: subtlePulse 2s infinite ease-in-out; }
      `}</style>

      {/* ── Page Header ── */}
      <div style={{ marginBottom: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
            <div style={{ width: 42, height: 42, borderRadius: '12px', background: 'linear-gradient(135deg, #722ed1 0%, #391085 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 24, boxShadow: '0 4px 12px rgba(114, 46, 209, 0.3)' }}>
              <ExperimentOutlined />
            </div>
            <Title level={1} style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: '-0.5px', color: '#1a1a1a' }}>Parameter Optimization</Title>
          </div>
          <Text type="secondary" style={{ fontSize: 15, marginLeft: 54 }}>Search parameter ranges and identify robust strategy configurations for maximum performance.</Text>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <Badge status="processing" color="#722ed1" text={<Text strong style={{ color: '#722ed1', fontSize: 12, letterSpacing: '0.5px' }}>OPTIMIZATION READY</Text>} />
        </div>
      </div>

      <Row gutter={[24, 24]}>
        <Col span={24}>
          <Card className="premium-card" title={<Space><SearchOutlined style={{ color: '#722ed1' }} /><span style={{ fontWeight: 700 }}>Engine Configuration</span></Space>}>
            <Form
              form={form}
              layout="vertical"
              onFinish={handleRunOptimization}
              initialValues={{
                symbol: 'AAPL',
                strategy: 'moving_average',
                period: '1y',
                initial_capital: 100000,
                shortMaStart: 5, shortMaEnd: 25, shortMaStep: 5,
                longMaStart: 50, longMaEnd: 200, longMaStep: 25
              }}
            >
              <Row gutter={24}>
                <Col span={6}>
                  <Form.Item label={<Text strong>Stock Symbol</Text>} name="symbol" rules={[{ required: true }]}>
                    <Input prefix={<LineChartOutlined style={{ color: '#bfbfbf' }} />} placeholder="e.g. AAPL" size="large" style={{ borderRadius: '8px' }} />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item label={<Text strong>Strategy Model</Text>} name="strategy" rules={[{ required: true }]}>
                    <Select options={strategyOptions} size="large" style={{ borderRadius: '8px' }} />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item label={<Text strong>Lookback Period</Text>} name="period" rules={[{ required: true }]}>
                    <Select size="large" style={{ borderRadius: '8px' }}>
                      <Select.Option value="3m">3 Months Data</Select.Option>
                      <Select.Option value="6m">6 Months Data</Select.Option>
                      <Select.Option value="1y">1 Year Data</Select.Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item label={<Text strong>Initial Liquidity ($)</Text>} name="initial_capital" rules={[{ required: true }]}>
                    <InputNumber min={1000} size="large" style={{ width: '100%', borderRadius: '8px' }} formatter={v => `$ ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} />
                  </Form.Item>
                </Col>
              </Row>

              <Divider style={{ margin: '12px 0 24px 0' }} />
              
              <div style={{ marginBottom: 16 }}>
                <Text strong style={{ fontSize: '15px', color: '#1f1f1f', display: 'block', marginBottom: 20 }}>Parameter Search Space</Text>
                {renderStrategyParameters()}
              </div>

              <div style={{ display: 'flex', justifyContent: 'center', marginTop: 32 }}>
                <Button 
                  type="primary" 
                  htmlType="submit" 
                  loading={loading} 
                  icon={<RocketOutlined />} 
                  className={`primary-cta-button ${loading ? 'running-pulse' : ''}`}
                  style={{ width: '100%', maxWidth: '400px', background: 'linear-gradient(90deg, #722ed1 0%, #1890ff 100%)', border: 'none' }}
                >
                  {loading ? 'RUNNING GENETIC SEARCH...' : 'RUN OPTIMIZATION'}
                </Button>
              </div>
            </Form>
          </Card>
        </Col>

        {success && (
          <Col span={24}>
            <Alert 
              message={<Text strong style={{ color: '#389e0d' }}>Optimization Success</Text>} 
              description={success} 
              type="success" 
              showIcon 
              icon={<CheckCircleOutlined />}
              style={{ borderRadius: '12px', border: '1px solid #b7eb8f', background: '#f6ffed' }} 
            />
          </Col>
        )}

        {error && (
          <Col span={24}>
            <Alert 
              message={<Text strong style={{ color: '#cf1322' }}>Configuration Error</Text>} 
              description={error} 
              type="error" 
              showIcon 
              icon={<WarningOutlined />}
              style={{ borderRadius: '12px', border: '1px solid #ffa39e', background: '#fff1f0' }} 
            />
          </Col>
        )}

        {optimizationResults.length > 0 && (
          <>
            <Col span={24}>
              <OptimizationSummary
                results={optimizationResults}
                totalCombinations={stats.totalCombinations}
                validCombinations={stats.validCombinations}
                strategy={selectedStrategy}
              />
            </Col>

            <Col span={24}>
              <Card className="premium-card" title={<Space><ExperimentOutlined style={{ color: '#722ed1' }} /><span style={{ fontWeight: 700 }}>Performance Heatmap</span></Space>}>
                <div style={{ padding: '20px 0' }}>
                  <OptimizationHeatmap results={optimizationResults} strategy={selectedStrategy} />
                </div>
              </Card>
            </Col>

            <Col span={24}>
              <Card className="premium-card" title={<Space><LineChartOutlined style={{ color: '#1890ff' }} /><span style={{ fontWeight: 700 }}>Detailed Result Matrix</span></Space>}>
                <OptimizationResultsTable results={optimizationResults} strategy={selectedStrategy} />
              </Card>
            </Col>
          </>
        )}
      </Row>
    </div>
  );
};

export default ParameterOptimization;