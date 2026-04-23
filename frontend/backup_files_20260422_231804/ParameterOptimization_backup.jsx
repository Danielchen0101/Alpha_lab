import React, { useState } from 'react';
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
    }
    
    return (
      <div style={{ padding: '20px', background: '#f0f0f0', borderRadius: '8px', marginBottom: '20px' }}>
        <p>Strategy parameters for {selectedStrategy} will be displayed here.</p>
        <p><em>Note: Full parameter panels for all strategies are implemented in the backend.</em></p>
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
            initial_capital: 100000
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
            />
          </Card>

          {/* Optimization Results Table */}
          <Card
            style={{ marginBottom: '20px' }}
            title="Optimization Results"
          >
            <OptimizationResultsTable results={optimizationResults} />
          </Card>

          {/* Heatmap Visualization */}
          <Card
            style={{ marginBottom: '20px' }}
            title="Parameter Heatmap"
          >
            <OptimizationHeatmap results={optimizationResults} />
          </Card>
        </>
      )}
    </div>
  );
};

export default ParameterOptimization;