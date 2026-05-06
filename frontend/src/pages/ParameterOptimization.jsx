import React, { useState, useEffect } from 'react';
import { Card, Form, Input, InputNumber, Button, Select, Alert, Row, Col, Typography, Space, Badge, Divider } from 'antd';
import { RocketOutlined, SettingOutlined, SearchOutlined, LineChartOutlined, ExperimentOutlined, CheckCircleOutlined, WarningOutlined } from '@ant-design/icons';
import { backtraderAPI } from '../services/api';
import OptimizationHeatmap from '../components/optimization/OptimizationHeatmap';
import OptimizationSummary from '../components/optimization/OptimizationSummary';
import OptimizationResultsTable from '../components/optimization/OptimizationResultsTable';
import { useLanguage } from '../contexts/LanguageContext';

const { Title, Text } = Typography;

const ParameterOptimization = () => {
  const [form] = Form.useForm();
  const { t } = useLanguage();
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
    { value: 'moving_average', label: t.optimization.strategyMovingAverageCrossover },
    { value: 'rsi', label: t.optimization.strategyRsiStrategy },
    { value: 'macd', label: t.optimization.strategyMacdStrategy },
    { value: 'bollinger', label: t.optimization.strategyBollingerBands },
    { value: 'momentum', label: t.optimization.strategyMomentumStrategy },
    { value: 'mean_reversion', label: t.optimization.strategyMeanReversionLabel },
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
        'stdDevStart', 'stdDevEnd', 'stdDevStep',
        'lookbackStart', 'lookbackEnd', 'lookbackStep',
        'entryZStart', 'entryZEnd', 'entryZStep',
        'exitZStart', 'exitZEnd', 'exitZStep'
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
      } else if (selectedStrategy === 'mean_reversion') {
        newValues.lookbackStart = 15;
        newValues.lookbackEnd = 30;
        newValues.lookbackStep = 5;
        newValues.entryZStart = -2.5;
        newValues.entryZEnd = -1.5;
        newValues.entryZStep = 0.5;
        newValues.exitZStart = -0.5;
        newValues.exitZEnd = 0.5;
        newValues.exitZStep = 0.5;
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
          <Form.Item label={<Text type="secondary" style={{ fontSize: '12px' }}>{t.optimization.start}</Text>} name={`${namePrefix}Start`}>
            <InputNumber min={0.1} max={500} style={{ width: '100%', borderRadius: '6px' }} />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item label={<Text type="secondary" style={{ fontSize: '12px' }}>{t.optimization.end}</Text>} name={`${namePrefix}End`}>
            <InputNumber min={0.1} max={500} style={{ width: '100%', borderRadius: '6px' }} />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item label={<Text type="secondary" style={{ fontSize: '12px' }}>{t.optimization.step}</Text>} name={`${namePrefix}Step`}>
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
          <Col span={12}>{renderParameterRange(t.optimization.shortMaParameters, 'shortMa')}</Col>
          <Col span={12}>{renderParameterRange(t.optimization.longMaParameters, 'longMa')}</Col>
        </Row>
      );
    } else if (selectedStrategy === 'momentum') {
      return (
        <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
          <Col span={12}>{renderParameterRange(t.optimization.momentumPeriodBlock, 'momentumPeriod')}</Col>
        </Row>
      );
    } else if (selectedStrategy === 'rsi') {
      return (
        <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
          <Col span={8}>{renderParameterRange(t.optimization.rsiPeriodBlock, 'rsiPeriod')}</Col>
          <Col span={8}>{renderParameterRange(t.optimization.oversoldLevelBlock, 'oversold')}</Col>
          <Col span={8}>{renderParameterRange(t.optimization.overboughtLevelBlock, 'overbought')}</Col>
        </Row>
      );
    } else if (selectedStrategy === 'macd') {
      return (
        <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
          <Col span={8}>{renderParameterRange(t.optimization.fastEmaBlock, 'fast')}</Col>
          <Col span={8}>{renderParameterRange(t.optimization.slowEmaBlock, 'slow')}</Col>
          <Col span={8}>{renderParameterRange(t.optimization.signalEmaBlock, 'signal')}</Col>
        </Row>
      );
    } else if (selectedStrategy === 'bollinger') {
      return (
        <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
          <Col span={12}>{renderParameterRange(t.optimization.periodBlock, 'period')}</Col>
          <Col span={12}>{renderParameterRange(t.optimization.stdDevBlock, 'stdDev')}</Col>
        </Row>
      );
    } else if (selectedStrategy === 'mean_reversion') {
      return (
        <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
          <Col span={8}>{renderParameterRange(t.optimization.lookbackBlock, 'lookback')}</Col>
          <Col span={8}>{renderParameterRange(t.optimization.entryZScoreBlock, 'entryZ')}</Col>
          <Col span={8}>{renderParameterRange(t.optimization.exitZScoreBlock, 'exitZ')}</Col>
        </Row>
      );
    }
    
    return (
      <div style={{ padding: '30px', background: '#f8f9fa', borderRadius: '12px', marginBottom: '24px', textAlign: 'center', border: '1px dashed #d9d9d9' }}>
        <Text type="secondary">{t.optimization.strategyParamFallback.replace('{strategy}', selectedStrategy)}</Text>
      </div>
    );
  };

  const handleRunOptimization = async (values) => {
    // Validate parameters
    let validationError = null;
    
    // Common validation
    const validateRange = (start, end, step, fieldName) => {
      if (start > end) {
        return t.optimization.validationStartEnd.replace('{field}', fieldName).replace('{start}', start).replace('{end}', end);
      }
      if (step <= 0) {
        return t.optimization.validationStep.replace('{field}', fieldName).replace('{step}', step);
      }
      return null;
    };
    
    // Strategy-specific validation
    if (values.strategy === 'moving_average') {
      const shortError = validateRange(values.shortMaStart, values.shortMaEnd, values.shortMaStep, t.optimization.labelShortMa);
      const longError = validateRange(values.longMaStart, values.longMaEnd, values.longMaStep, t.optimization.labelLongMa);
      validationError = shortError || longError;
      if (!validationError && values.shortMaEnd >= values.longMaStart) {
        validationError = t.optimization.validationShortMaLongMa;
      }
    } else if (values.strategy === 'rsi') {
      const rsiError = validateRange(values.rsiPeriodStart, values.rsiPeriodEnd, values.rsiPeriodStep, t.optimization.labelRsiPeriod);
      const oversoldError = validateRange(values.oversoldStart, values.oversoldEnd, values.oversoldStep, t.optimization.labelOversold);
      const overboughtError = validateRange(values.overboughtStart, values.overboughtEnd, values.overboughtStep, t.optimization.labelOverbought);
      validationError = rsiError || oversoldError || overboughtError;
      if (!validationError && values.oversoldEnd >= values.overboughtStart) {
        validationError = t.optimization.validationOversoldOverbought;
      }
    } else if (values.strategy === 'macd') {
      const fastError = validateRange(values.fastStart, values.fastEnd, values.fastStep, t.optimization.labelFastMa);
      const slowError = validateRange(values.slowStart, values.slowEnd, values.slowStep, t.optimization.labelSlowMa);
      const signalError = validateRange(values.signalStart, values.signalEnd, values.signalStep, t.optimization.labelSignalMa);
      validationError = fastError || slowError || signalError;
      if (!validationError && values.fastEnd >= values.slowStart) {
        validationError = t.optimization.validationFastSlow;
      }
    } else if (values.strategy === 'bollinger') {
      const periodError = validateRange(values.periodStart, values.periodEnd, values.periodStep, t.optimization.labelPeriod);
      const stdDevError = validateRange(values.stdDevStart, values.stdDevEnd, values.stdDevStep, t.optimization.labelStdDev);
      validationError = periodError || stdDevError;
      if (!validationError && values.stdDevStart <= 0) {
        validationError = t.optimization.validationStdDev;
      }
    } else if (values.strategy === 'momentum') {
      validationError = validateRange(values.momentumPeriodStart, values.momentumPeriodEnd, values.momentumPeriodStep, t.optimization.labelMomentumPeriod);
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
    } else if (values.strategy === 'mean_reversion') {
      payload.lookbackRange = { start: values.lookbackStart, end: values.lookbackEnd, step: values.lookbackStep };
      payload.entryZScoreRange = { start: values.entryZStart, end: values.entryZEnd, step: values.entryZStep };
      payload.exitZScoreRange = { start: values.exitZStart, end: values.exitZEnd, step: values.exitZStep };
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
        setSuccess(t.optimization.optimizationCompletedMsg.replace('{count}', result.results?.length || 0));
      } else {
        setError(response.data?.result?.error || response.data?.error || t.optimization.optimizationFailed);
      }
    } catch (err) {
      const errorData = err.response?.data;
      setError(errorData?.result?.error || errorData?.error || err.message || t.optimization.failedToRun);
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
            <Title level={1} style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: '-0.5px', color: '#1a1a1a' }}>{t.optimization.title}</Title>
          </div>
          <Text type="secondary" style={{ fontSize: 15, marginLeft: 54 }}>{t.optimization.subtitle}</Text>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <Badge status="processing" color="#722ed1" text={<Text strong style={{ color: '#722ed1', fontSize: 12, letterSpacing: '0.5px' }}>{t.optimization.optimizationReady}</Text>} />
        </div>
      </div>

      <Row gutter={[24, 24]}>
        <Col span={24}>
          <Card className="premium-card" title={<Space><SearchOutlined style={{ color: '#722ed1' }} /><span style={{ fontWeight: 700 }}>{t.optimization.engineConfiguration}</span></Space>}>
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
                  <Form.Item label={<Text strong>{t.optimization.stockSymbol}</Text>} name="symbol" rules={[{ required: true }]}>
                    <Input prefix={<LineChartOutlined style={{ color: '#bfbfbf' }} />} placeholder={t.backtest.stockSymbolPlaceholder} size="large" style={{ borderRadius: '8px' }} />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item label={<Text strong>{t.optimization.strategyModel}</Text>} name="strategy" rules={[{ required: true }]}>
                    <Select options={strategyOptions} size="large" style={{ borderRadius: '8px' }} />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item label={<Text strong>{t.optimization.lookbackPeriod}</Text>} name="period" rules={[{ required: true }]}>
                    <Select size="large" style={{ borderRadius: '8px' }}>
                      <Select.Option value="3m">{t.optimization.threeMonthsData}</Select.Option>
                      <Select.Option value="6m">{t.optimization.sixMonthsData}</Select.Option>
                      <Select.Option value="1y">{t.optimization.oneYearData}</Select.Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item label={<Text strong>{t.optimization.initialLiquidity}</Text>} name="initial_capital" rules={[{ required: true }]}>
                    <InputNumber min={1000} size="large" style={{ width: '100%', borderRadius: '8px' }} formatter={v => `$ ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} />
                  </Form.Item>
                </Col>
              </Row>

              <Divider style={{ margin: '12px 0 24px 0' }} />
              
              <div style={{ marginBottom: 16 }}>
                <Text strong style={{ fontSize: '15px', color: '#1f1f1f', display: 'block', marginBottom: 20 }}>{t.optimization.parameterSearchSpace}</Text>
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
                  {loading ? t.optimization.runningGeneticSearch : t.optimization.runOptimization}
                </Button>
              </div>
            </Form>
          </Card>
        </Col>

        {success && (
          <Col span={24}>
            <Alert 
              message={<Text strong style={{ color: '#389e0d' }}>{t.optimization.optimizationSuccess}</Text>} 
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
              message={<Text strong style={{ color: '#cf1322' }}>{t.optimization.configurationError}</Text>} 
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
              <Card className="premium-card" title={<Space><ExperimentOutlined style={{ color: '#722ed1' }} /><span style={{ fontWeight: 700 }}>{t.optimization.performanceHeatmap}</span></Space>}>
                <div style={{ padding: '20px 0' }}>
                  <OptimizationHeatmap results={optimizationResults} strategy={selectedStrategy} />
                </div>
              </Card>
            </Col>

            <Col span={24}>
              <Card className="premium-card" title={<Space><LineChartOutlined style={{ color: '#1890ff' }} /><span style={{ fontWeight: 700 }}>{t.optimization.detailedResultMatrix}</span></Space>}>
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