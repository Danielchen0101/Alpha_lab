import React, { useState } from 'react';
import { Card, Form, Input, InputNumber, Button, Select, Alert, Row, Col } from 'antd';
import { RocketOutlined } from '@ant-design/icons';
import { backtraderAPI } from '../services/api';

const ParameterOptimization = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const strategyOptions = [
    { value: 'moving_average', label: 'Moving Average Crossover' },
    { value: 'rsi', label: 'RSI Strategy' },
    { value: 'macd', label: 'MACD Strategy' },
    { value: 'bollinger', label: 'Bollinger Bands' },
    { value: 'momentum', label: 'Momentum Strategy' },
  ];

  const selectedStrategy = Form.useWatch('strategy', form) || 'moving_average';

  const renderStrategyParameters = () => {
    console.log('Rendering strategy parameters for:', selectedStrategy);
    
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
    
    // For other strategies, show placeholder
    return (
      <div style={{ padding: '20px', background: '#f0f0f0', borderRadius: '8px', marginBottom: '20px' }}>
        <p>Strategy parameters for {selectedStrategy} will be displayed here.</p>
      </div>
    );
  };

  const handleRunOptimization = async (values) => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    const today = new Date();
    const endDate = today.toISOString().split('T')[0];
    const startDate = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate())
      .toISOString().split('T')[0];

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
        setSuccess('Optimization completed successfully!');
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
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <h1>Parameter Optimization</h1>
      
      <Card style={{ marginBottom: '20px' }}>
        <Form
          form={form}
          layout="vertical"
          onFinish={handleRunOptimization}
          initialValues={{
            symbol: 'AAPL',
            strategy: 'moving_average',
            initial_capital: 100000
          }}
        >
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item label="Symbol" name="symbol" rules={[{ required: true }]}>
                <Input placeholder="e.g., AAPL" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Strategy" name="strategy" rules={[{ required: true }]}>
                <Select options={strategyOptions} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Initial Capital ($)" name="initial_capital" rules={[{ required: true }]}>
                <InputNumber min={1000} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          {/* ONLY ONE CALL to renderStrategyParameters */}
          {