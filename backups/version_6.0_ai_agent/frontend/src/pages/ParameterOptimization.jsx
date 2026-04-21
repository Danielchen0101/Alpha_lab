import React, { useState, useEffect } from 'react';
import { Card, Form, Input, InputNumber, Button, Select, Alert, Row, Col } from 'antd';
import { RocketOutlined } from '@ant-design/icons';
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
        newValues.shortMaEnd = 25;  // Fixed: 25 < 50
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
        newValues.rsiPeriodEnd = 30;
        newValues.rsiPeriodStep = 2;
        newValues.oversoldStart = 20;
        newValues.oversoldEnd = 40;
        newValues.oversoldStep = 5;
        newValues.overboughtStart = 60;
        newValues.overboughtEnd = 80;
        newValues.overboughtStep = 5;
      } else if (selectedStrategy === 'macd') {
        newValues.fastStart = 5;
        newValues.fastEnd = 15;
        newValues.fastStep = 2;
        newValues.slowStart = 20;
        newValues.slowEnd = 30;
        newValues.slowStep = 2;
        newValues.signalStart = 5;
        newValues.signalEnd = 10;
        newValues.signalStep = 1;
      } else if (selectedStrategy === 'bollinger') {
        newValues.periodStart = 10;
        newValues.periodEnd = 30;
        newValues.periodStep = 5;
        newValues.stdDevStart = 1.5;
        newValues.stdDevEnd = 3.0;
        newValues.stdDevStep = 0.5;
      }
      
      // Update form values
      form.setFieldsValue(newValues);
    };
    
    resetFormForStrategy();
  }, [selectedStrategy, form]);

  const renderStrategyParameters = () => {
    if (selectedStrategy === 'moving_average') {
      return (
        <div style={{ marginBottom: '20px' }}>
          <h4>Short MA Parameters</h4>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item label="Start" name="shortMaStart" initialValue={5}>
                <InputNumber min={1} max={200} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="End" name="shortMaEnd" initialValue={25}>
                <InputNumber min={1} max={200} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Step" name="shortMaStep" initialValue={5}>
                <InputNumber min={1} max={50} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          
          <h4>Long MA Parameters</h4>
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
      );
    } else if (selectedStrategy === 'momentum') {
      return (
        <div style={{ marginBottom: '20px' }}>
          <h4>Momentum Period Parameters</h4>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item label="Start" name="momentumPeriodStart" initialValue={5}>
                <InputNumber min={1} max={50} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="End" name="momentumPeriodEnd" initialValue={30}>
                <InputNumber min={1} max={100} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Step" name="momentumPeriodStep" initialValue={5}>
                <InputNumber min={1} max={20} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
        </div>
      );
    } else if (selectedStrategy === 'rsi') {
      return (
        <div style={{ marginBottom: '20px' }}>
          <h4>RSI Period Parameters</h4>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item label="Start" name="rsiPeriodStart" initialValue={10}>
                <InputNumber min={5} max={50} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="End" name="rsiPeriodEnd" initialValue={30}>
                <InputNumber min={5} max={100} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Step" name="rsiPeriodStep" initialValue={2}>
                <InputNumber min={1} max={10} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          
          <h4>Oversold Level Parameters</h4>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item label="Start" name="oversoldStart" initialValue={20}>
                <InputNumber min={10} max={40} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="End" name="oversoldEnd" initialValue={40}>
                <InputNumber min={10} max={50} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Step" name="oversoldStep" initialValue={5}>
                <InputNumber min={1} max={10} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          
          <h4>Overbought Level Parameters</h4>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item label="Start" name="overboughtStart" initialValue={60}>
                <InputNumber min={50} max={80} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="End" name="overboughtEnd" initialValue={80}>
                <InputNumber min={50} max={90} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Step" name="overboughtStep" initialValue={5}>
                <InputNumber min={1} max={10} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
        </div>
      );
    } else if (selectedStrategy === 'macd') {
      return (
        <div style={{ marginBottom: '20px' }}>
          <h4>Fast EMA Parameters</h4>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item label="Start" name="fastStart" initialValue={5}>
                <InputNumber min={5} max={20} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="End" name="fastEnd" initialValue={15}>
                <InputNumber min={5} max={30} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Step" name="fastStep" initialValue={2}>
                <InputNumber min={1} max={10} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          
          <h4>Slow EMA Parameters</h4>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item label="Start" name="slowStart" initialValue={20}>
                <InputNumber min={10} max={40} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="End" name="slowEnd" initialValue={30}>
                <InputNumber min={10} max={50} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Step" name="slowStep" initialValue={2}>
                <InputNumber min={1} max={10} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          
          <h4>Signal EMA Parameters</h4>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item label="Start" name="signalStart" initialValue={5}>
                <InputNumber min={3} max={15} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="End" name="signalEnd" initialValue={10}>
                <InputNumber min={3} max={20} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Step" name="signalStep" initialValue={1}>
                <InputNumber min={1} max={5} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
        </div>
      );
    } else if (selectedStrategy === 'bollinger') {
      return (
        <div style={{ marginBottom: '20px' }}>
          <h4>Period Parameters</h4>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item label="Start" name="periodStart" initialValue={10}>
                <InputNumber min={5} max={30} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="End" name="periodEnd" initialValue={30}>
                <InputNumber min={5} max={50} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Step" name="periodStep" initialValue={5}>
                <InputNumber min={1} max={10} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          
          <h4>Std Dev Parameters</h4>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item label="Start" name="stdDevStart" initialValue={1.5}>
                <InputNumber min={1.0} max={3.0} step={0.1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="End" name="stdDevEnd" initialValue={3.0}>
                <InputNumber min={1.0} max={5.0} step={0.1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Step" name="stdDevStep" initialValue={0.5}>
                <InputNumber min={0.1} max={1.0} step={0.1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
        </div>
      );
    }
    
    return (
      <div style={{ padding: '20px', background: '#f0f0f0', borderRadius: '8px', marginBottom: '20px' }}>
        <p>Strategy parameters for {selectedStrategy} will be displayed here.</p>
        <p><em>Note: Full parameter panels for all strategies are implemented in the backend.</em></p>
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
      
      // Additional validation: short range should be less than long range
      if (!validationError && values.shortMaEnd >= values.longMaStart) {
        validationError = 'Short MA range should be less than Long MA range for meaningful crossover';
      }
    } else if (values.strategy === 'rsi') {
      const rsiError = validateRange(values.rsiPeriodStart, values.rsiPeriodEnd, values.rsiPeriodStep, 'RSI Period');
      const oversoldError = validateRange(values.oversoldStart, values.oversoldEnd, values.oversoldStep, 'Oversold');
      const overboughtError = validateRange(values.overboughtStart, values.overboughtEnd, values.overboughtStep, 'Overbought');
      validationError = rsiError || oversoldError || overboughtError;
      
      // Additional validation: oversold < overbought
      if (!validationError && values.oversoldEnd >= values.overboughtStart) {
        validationError = 'Oversold levels must be less than Overbought levels';
      }
    } else if (values.strategy === 'macd') {
      const fastError = validateRange(values.fastStart, values.fastEnd, values.fastStep, 'Fast EMA');
      const slowError = validateRange(values.slowStart, values.slowEnd, values.slowStep, 'Slow EMA');
      const signalError = validateRange(values.signalStart, values.signalEnd, values.signalStep, 'Signal EMA');
      validationError = fastError || slowError || signalError;
      
      // Additional validation: fast < slow
      if (!validationError && values.fastEnd >= values.slowStart) {
        validationError = 'Fast EMA must be less than Slow EMA';
      }
    } else if (values.strategy === 'bollinger') {
      const periodError = validateRange(values.periodStart, values.periodEnd, values.periodStep, 'Period');
      const stdDevError = validateRange(values.stdDevStart, values.stdDevEnd, values.stdDevStep, 'Std Dev');
      validationError = periodError || stdDevError;
      
      // Additional validation: std dev > 0
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

    // Create parameters based on strategy - match backend expected format
    let payload = {
      symbol: values.symbol,
      strategy: values.strategy,
      startDate: startDate,
      endDate: endDate,
      initialCapital: values.initial_capital
    };

    // Add strategy-specific parameters in backend expected format
    if (values.strategy === 'moving_average') {
      payload.shortMaRange = {
        start: values.shortMaStart || 5,
        end: values.shortMaEnd || 50,
        step: values.shortMaStep || 5
      };
      payload.longMaRange = {
        start: values.longMaStart || 50,
        end: values.longMaEnd || 200,
        step: values.longMaStep || 25
      };
    } else if (values.strategy === 'rsi') {
      payload.rsiPeriodRange = {
        start: values.rsiPeriodStart || 10,
        end: values.rsiPeriodEnd || 30,
        step: values.rsiPeriodStep || 2
      };
      payload.oversoldRange = {
        start: values.oversoldStart || 20,
        end: values.oversoldEnd || 40,
        step: values.oversoldStep || 5
      };
      payload.overboughtRange = {
        start: values.overboughtStart || 60,
        end: values.overboughtEnd || 80,
        step: values.overboughtStep || 5
      };
    } else if (values.strategy === 'macd') {
      payload.fastRange = {
        start: values.fastStart || 5,
        end: values.fastEnd || 15,
        step: values.fastStep || 2
      };
      payload.slowRange = {
        start: values.slowStart || 20,
        end: values.slowEnd || 30,
        step: values.slowStep || 2
      };
      payload.signalRange = {
        start: values.signalStart || 5,
        end: values.signalEnd || 10,
        step: values.signalStep || 1
      };
    } else if (values.strategy === 'bollinger') {
      payload.periodRange = {
        start: values.periodStart || 10,
        end: values.periodEnd || 30,
        step: values.periodStep || 5
      };
      payload.stdDevRange = {
        start: values.stdDevStart || 1.5,
        end: values.stdDevEnd || 3.0,
        step: values.stdDevStep || 0.5
      };
    } else if (values.strategy === 'momentum') {
      payload.momentumPeriodRange = {
        start: values.momentumPeriodStart || 5,
        end: values.momentumPeriodEnd || 30,
        step: values.momentumPeriodStep || 5
      };
    } else {
      // Default to MA parameters for unknown strategies
      payload.shortMaRange = {
        start: 5,
        end: 50,
        step: 5
      };
      payload.longMaRange = {
        start: 50,
        end: 200,
        step: 25
      };
    }

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

  return (
    <div style={{ padding: '20px', maxWidth: '1500px', margin: '0 auto' }}>
      <h1>Parameter Optimization</h1>
      
      <Card style={{ marginBottom: '20px' }}>
        <Form
          form={form}
          layout="vertical"
          onFinish={handleRunOptimization}
          initialValues={{
            symbol: 'AAPL',
            strategy: 'moving_average',
            period: '1y',
            initial_capital: 100000,
            // MA strategy default values (legal)
            shortMaStart: 5,
            shortMaEnd: 25,  // Fixed: 25 < 50
            shortMaStep: 5,
            longMaStart: 50,
            longMaEnd: 200,
            longMaStep: 25
          }}
        >
          <Row gutter={16}>
            <Col span={6}>
              <Form.Item label="Symbol" name="symbol" rules={[{ required: true }]}>
                <Input placeholder="e.g., AAPL" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="Strategy" name="strategy" rules={[{ required: true }]}>
                <Select options={strategyOptions} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="Period" name="period" rules={[{ required: true }]}>
                <Select>
                  <Select.Option value="3m">3 Months</Select.Option>
                  <Select.Option value="6m">6 Months</Select.Option>
                  <Select.Option value="1y">1 Year</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="Initial Capital ($)" name="initial_capital" rules={[{ required: true }]}>
                <InputNumber min={1000} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          {renderStrategyParameters()}

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} icon={<RocketOutlined />}>
              Run Optimization
            </Button>
          </Form.Item>
        </Form>
      </Card>

      {success && (
        <Alert message="Success" description={success} type="success" showIcon style={{ marginBottom: '20px' }} />
      )}

      {error && (
        <Alert message="Error" description={error} type="error" showIcon style={{ marginBottom: '20px' }} />
      )}

      {/* Optimization Results */}
      {optimizationResults.length > 0 && (
        <>
          {/* Best Combination Summary */}
          <Card style={{ marginBottom: '20px' }}>
            <OptimizationSummary
              results={optimizationResults}
              totalCombinations={stats.totalCombinations}
              validCombinations={stats.validCombinations}
              strategy={selectedStrategy}
            />
          </Card>

          {/* Optimization Results Table */}
          <Card
            style={{ marginBottom: '20px' }}
            title="Optimization Results"
          >
            <OptimizationResultsTable results={optimizationResults} strategy={selectedStrategy} />
          </Card>

          {/* Heatmap Visualization */}
          <Card
            style={{ marginBottom: '20px' }}
            title="Parameter Heatmap"
          >
            <OptimizationHeatmap results={optimizationResults} strategy={selectedStrategy} />
          </Card>
        </>
      )}
    </div>
  );
};

export default ParameterOptimization;