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
    switch (selectedStrategy) {
      case 'moving_average':
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
      
      case 'rsi':
        return (
          <div style={{ marginBottom: '20px' }}>
            <h4>RSI Parameters</h4>
            <Row gutter={16}>
              <Col span={8}>
                <Form.Item label="Period Start" name="rsiPeriodStart" initialValue={10}>
                  <InputNumber min={5} max={50} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label="Period End" name="rsiPeriodEnd" initialValue={30}>
                  <InputNumber min={5} max={50} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label="Period Step" name="rsiPeriodStep" initialValue={5}>
                  <InputNumber min={1} max={20} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>
            
            <h4>Oversold Level</h4>
            <Row gutter={16}>
              <Col span={8}>
                <Form.Item label="Min" name="oversoldMin" initialValue={20}>
                  <InputNumber min={10} max={40} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label="Max" name="oversoldMax" initialValue={40}>
                  <InputNumber min={10} max={40} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label="Step" name="oversoldStep" initialValue={5}>
                  <InputNumber min={1} max={10} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>
            
            <h4>Overbought Level</h4>
            <Row gutter={16}>
              <Col span={8}>
                <Form.Item label="Min" name="overboughtMin" initialValue={60}>
                  <InputNumber min={50} max={90} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label="Max" name="overboughtMax" initialValue={80}>
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
      
      case 'macd':
        return (
          <div style={{ marginBottom: '20px' }}>
            <h4>MACD Fast EMA</h4>
            <Row gutter={16}>
              <Col span={8}>
                <Form.Item label="Start" name="fastStart" initialValue={8}>
                  <InputNumber min={5} max={20} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label="End" name="fastEnd" initialValue={16}>
                  <InputNumber min={5} max={20} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label="Step" name="fastStep" initialValue={2}>
                  <InputNumber min={1} max={5} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>
            
            <h4>MACD Slow EMA</h4>
            <Row gutter={16}>
              <Col span={8}>
                <Form.Item label="Start" name="slowStart" initialValue={20}>
                  <InputNumber min={15} max={35} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label="End" name="slowEnd" initialValue={30}>
                  <InputNumber min={15} max={35} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label="Step" name="slowStep" initialValue={2}>
                  <InputNumber min={1} max={5} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>
            
            <h4>MACD Signal</h4>
            <Row gutter={16}>
              <Col span={8}>
                <Form.Item label="Start" name="signalStart" initialValue={6}>
                  <InputNumber min={5} max={15} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label="End" name="signalEnd" initialValue={12}>
                  <InputNumber min={5} max={15} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label="Step" name="signalStep" initialValue={2}>
                  <InputNumber min={1} max={5} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>
          </div>
        );
      
      case 'bollinger':
        return (
          <div style={{ marginBottom: '20px' }}>
            <h4>Bollinger Period</h4>
            <Row gutter={16}>
              <Col span={8}>
                <Form.Item label="Start" name="bbPeriodStart" initialValue={10}>
                  <InputNumber min={5} max={50} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label="End" name="bbPeriodEnd" initialValue={30}>
                  <InputNumber min={5} max={50} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label="Step" name="bbPeriodStep" initialValue={5}>
                  <InputNumber min={1} max={20} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>
            
            <h4>Standard Deviation</h4>
            <Row gutter={16}>
              <Col span={8}>
                <Form.Item label="Min" name="stdDevMin" initialValue={1.5}>
                  <InputNumber min={1.0} max={3.0} step={0.1} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label="Max" name="stdDevMax" initialValue={2.5}>
                  <InputNumber min={1.0} max={3.0} step={0.1} style={{ width: '100%' }} />
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
      
      case 'momentum':
        return (
          <div style={{ marginBottom: '20px' }}>
            <h4>Momentum Period</h4>
            <Row gutter={16}>
              <Col span={8}>
                <Form.Item label="Start" name="momentumPeriodStart" initialValue={5}>
                  <InputNumber min={3} max={50} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label="End" name="momentumPeriodEnd" initialValue={30}>
                  <InputNumber min={3} max={50} style={{ width: '100%' }} />
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
      
      default:
        return null;
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

    // Build parameters based on strategy
    let parameters = {};
    const strategy = values.strategy;

    if (strategy === 'moving_average') {
      parameters = {
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
      };
    } else if (strategy === 'rsi') {
      parameters = {
        period: {
          min: values.rsiPeriodStart || 10,
          max: values.rsiPeriodEnd || 30,
          step: values.rsiPeriodStep || 5
        },
        oversold: {
          min: values.oversoldMin || 20,
          max: values.oversoldMax || 40,
          step: values.oversoldStep || 5
        },
        overbought: {
          min: values.overboughtMin || 60,
          max: values.overboughtMax || 80,
          step: values.overboughtStep || 5
        }
      };
    } else if (strategy === 'macd') {
      parameters = {
        fast: {
          min: values.fastStart || 8,
          max: values.fastEnd || 16,
          step: values.fastStep || 2
        },
        slow: {
          min: values.slowStart || 20,
          max: values.slowEnd || 30,
          step: values.slowStep || 2
        },
        signal: {
          min: values.signalStart || 6,
          max: values.signalEnd || 12,
          step: values.signalStep || 2
        }
      };
    } else if (strategy === 'bollinger') {
      parameters = {
        period: {
          min: values.bbPeriodStart || 10,
          max: values.bbPeriodEnd || 30,
          step: values.bbPeriodStep || 5
        },
        std_dev: {
          min: values.stdDevMin || 1.5,
          max: values.stdDevMax || 2.5,
          step: values.stdDevStep || 0.5
        }
      };
    } else if (strategy === 'momentum') {
      parameters = {
        period: {
          min: values.momentumPeriodStart || 5,
          max: values.momentumPeriodEnd || 30,
          step: values.momentumPeriodStep || 5
        }
      };
    }

    const payload = {
      symbol: values.symbol,
      strategy: strategy,
      parameters: parameters,
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
              <Form.Item label="Symbol" name="symbol" rules={[{ required: true, message: 'Please input symbol' }]}>
                <Input placeholder="e.g. AAPL" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Card>
    </div>
  );
};

export default ParameterOptimizationComplete;
