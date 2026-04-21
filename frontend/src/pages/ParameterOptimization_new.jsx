import React, { useState } from 'react';
import { Form, Input, Button, Card, Row, Col, InputNumber, Select, message } from 'antd';
import { optimizationService } from '../../services/api';

const { Option } = Select;

const ParameterOptimizationNew = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [strategy, setStrategy] = useState('moving_average');

  const handleRunOptimization = async (values) => {
    setLoading(true);
    try {
      const response = await optimizationService.runOptimization(values);
      if (response.success) {
        message.success('Optimization completed successfully');
        // TODO: Display results
      } else {
        message.error(response.message || 'Optimization failed');
      }
    } catch (error) {
      message.error('Error running optimization');
      console.error('Optimization error:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderStrategyParameters = (strategy, form) => {
    switch (strategy) {
      case 'moving_average':
        return (
          <Row gutter={16} style={{ marginTop: '16px' }}>
            <Col span={8}>
              <Form.Item label="Short Window" name="short_window" rules={[{ required: true }]}>
                <InputNumber min={1} max={50} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Long Window" name="long_window" rules={[{ required: true }]}>
                <InputNumber min={10} max={200} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
        );
      case 'rsi':
        return (
          <Row gutter={16} style={{ marginTop: '16px' }}>
            <Col span={8}>
              <Form.Item label="RSI Period" name="rsi_period" rules={[{ required: true }]}>
                <InputNumber min={2} max={30} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Oversold Level" name="oversold" rules={[{ required: true }]}>
                <InputNumber min={0} max={50} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Overbought Level" name="overbought" rules={[{ required: true }]}>
                <InputNumber min={50} max={100} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
        );
      default:
        return null;
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
                <Select onChange={(value) => setStrategy(value)}>
                  <Option value="moving_average">Moving Average Crossover</Option>
                  <Option value="rsi">RSI</Option>
                  <Option value="bollinger">Bollinger Bands</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Initial Capital ($)" name="initial_capital" rules={[{ required: true }]}>
                <InputNumber min={1000} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          {/* ONLY ONE CALL to renderStrategyParameters */}
          {renderStrategyParameters(strategy, form)}

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading}>
              Run Optimization
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default ParameterOptimizationNew;