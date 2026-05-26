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
    <div className="inner-param-card">
      <div className="inner-param-title">
        <SettingOutlined style={{ color: '#722ed1', fontSize: 14 }} />
        <span>{title}</span>
      </div>
      <Row gutter={14}>
        <Col xs={24} sm={8}>
          <Form.Item label={<Text style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8' }}>{t.optimization.start.toUpperCase()}</Text>} name={`${namePrefix}Start`}>
            <InputNumber min={0.1} max={500} className="optimize-form-input" style={{ width: '100%' }} />
          </Form.Item>
        </Col>
        <Col xs={24} sm={8}>
          <Form.Item label={<Text style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8' }}>{t.optimization.end.toUpperCase()}</Text>} name={`${namePrefix}End`}>
            <InputNumber min={0.1} max={500} className="optimize-form-input" style={{ width: '100%' }} />
          </Form.Item>
        </Col>
        <Col xs={24} sm={8}>
          <Form.Item label={<Text style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8' }}>{t.optimization.step.toUpperCase()}</Text>} name={`${namePrefix}Step`}>
            <InputNumber min={0.1} max={100} className="optimize-form-input" style={{ width: '100%' }} />
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
    <div className="optimize-page-shell">
      <style>{`
        .optimize-page-shell {
          max-width: 1400px;
          margin: 0 auto;
          padding: clamp(16px, 1.8vw, 28px);
          animation: fadeIn 0.5s ease-out;
        }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        
        .premium-card { 
          border-radius: 18px !important; 
          border: 1px solid rgba(15, 23, 42, 0.08) !important; 
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.02) !important; 
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important; 
          background: #fff !important;
          overflow: hidden;
        }
        .premium-card:hover { 
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.04) !important; 
        }
        .premium-card .ant-card-head {
          padding: 0 24px !important;
          border-bottom: 1px solid rgba(15, 23, 42, 0.06) !important;
          min-height: 56px !important;
        }
        .premium-card .ant-card-head-title {
          padding: 16px 0 !important;
          font-weight: 800 !important;
          font-size: 16px !important;
          color: #0f172a !important;
        }
        .premium-card .ant-card-body {
          padding: 24px !important;
        }

        .config-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 20px;
        }
        @media (max-width: 1200px) {
          .config-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 640px) {
          .config-grid { grid-template-columns: 1fr; }
        }

        .param-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
          gap: 20px;
          margin-bottom: 24px;
        }
        @media (max-width: 1100px) {
          .param-grid { grid-template-columns: 1fr; }
        }

        .inner-param-card {
          background: #f8fafc;
          padding: 20px;
          border-radius: 16px;
          border: 1px solid rgba(15, 23, 42, 0.06);
          height: 100%;
          transition: border-color 0.2s ease;
        }
        .inner-param-card:hover {
          border-color: rgba(114, 46, 209, 0.2);
        }
        .inner-param-title {
          font-size: 12px;
          font-weight: 800;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.8px;
          margin-bottom: 18px;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .optimize-form-input { 
          height: 42px !important; 
          border-radius: 10px !important; 
          border-color: #e2e8f0 !important; 
        }
        .optimize-form-label { font-size: 13.5px; font-weight: 600; color: #475569; }

        .primary-cta-button { 
          height: 46px; 
          font-weight: 700; 
          border-radius: 14px; 
          box-shadow: 0 4px 14px rgba(114, 46, 209, 0.2); 
          transition: all 0.3s; 
          font-size: 15.5px;
          padding: 0 40px;
        }
        .primary-cta-button:hover:not(:disabled) { 
          transform: translateY(-1px); 
          box-shadow: 0 6px 20px rgba(114, 46, 209, 0.3); 
        }
        @keyframes subtlePulse { 0% { opacity: 0.8; transform: scale(1); } 50% { opacity: 1; transform: scale(1.01); } 100% { opacity: 0.8; transform: scale(1); } }
        .running-pulse { animation: subtlePulse 2s infinite ease-in-out; }

        .status-badge {
          background: #fff;
          padding: 8px 16px;
          border-radius: 12px;
          border: 1px solid rgba(15, 23, 42, 0.06);
          display: flex;
          align-items: center;
          gap: 10px;
        }
      `}</style>

      {/* ── Page Header ── */}
      <div style={{ marginBottom: 36, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 44, height: 44, borderRadius: '12px', background: 'linear-gradient(135deg, #722ed1 0%, #391085 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 22, boxShadow: '0 4px 12px rgba(114, 46, 209, 0.25)' }}>
            <ExperimentOutlined />
          </div>
          <div>
            <Title level={1} style={{ margin: 0, fontSize: 'clamp(24px, 2.2vw, 32px)', fontWeight: 800, letterSpacing: '-0.02em', color: '#0f172a' }}>{t.optimization.title}</Title>
            <Text style={{ fontSize: 14.5, color: '#64748b' }}>{t.optimization.subtitle}</Text>
          </div>
        </div>
        <div className="status-badge">
           <Badge status="processing" color="#722ed1" text={<Text strong style={{ color: '#722ed1', fontSize: 12, letterSpacing: '0.6px' }}>{t.optimization.optimizationReady.toUpperCase()}</Text>} />
        </div>
      </div>

      <Row gutter={[24, 24]}>
        <Col span={24}>
          <Card 
            className="premium-card" 
            title={<Space><SettingOutlined style={{ color: '#722ed1' }} /><span>{t.optimization.engineConfiguration}</span></Space>}
          >
            <Form
              form={form}
              layout="vertical"
              onFinish={handleRunOptimization}
              requiredMark={false}
              initialValues={{
                symbol: 'AAPL',
                strategy: 'moving_average',
                period: '1y',
                initial_capital: 100000,
                shortMaStart: 5, shortMaEnd: 25, shortMaStep: 5,
                longMaStart: 50, longMaEnd: 200, longMaStep: 25
              }}
            >
              <div className="config-grid">
                <Form.Item label={<span className="optimize-form-label">{t.optimization.stockSymbol}</span>} name="symbol" rules={[{ required: true }]}>
                  <Input prefix={<LineChartOutlined style={{ color: '#94a3b8' }} />} placeholder="e.g. AAPL" className="optimize-form-input" />
                </Form.Item>
                
                <Form.Item label={<span className="optimize-form-label">{t.optimization.strategyModel}</span>} name="strategy" rules={[{ required: true }]}>
                  <Select options={strategyOptions} className="optimize-form-input" />
                </Form.Item>
                
                <Form.Item label={<span className="optimize-form-label">{t.optimization.lookbackPeriod}</span>} name="period" rules={[{ required: true }]}>
                  <Select className="optimize-form-input">
                    <Select.Option value="3m">{t.optimization.threeMonthsData}</Select.Option>
                    <Select.Option value="6m">{t.optimization.sixMonthsData}</Select.Option>
                    <Select.Option value="1y">{t.optimization.oneYearData}</Select.Option>
                  </Select>
                </Form.Item>
                
                <Form.Item label={<span className="optimize-form-label">{t.optimization.initialLiquidity}</span>} name="initial_capital" rules={[{ required: true }]}>
                  <InputNumber min={1000} className="optimize-form-input" style={{ width: '100%' }} formatter={v => `$ ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} />
                </Form.Item>
              </div>

              <div style={{ marginTop: 24, marginBottom: 20 }}>
                <Text strong style={{ fontSize: '15px', color: '#0f172a', display: 'block', marginBottom: 20 }}>{t.optimization.parameterSearchSpace}</Text>
                <div className="param-grid">
                  {selectedStrategy === 'moving_average' && (
                    <>
                      {renderParameterRange(t.optimization.shortMaParameters, 'shortMa')}
                      {renderParameterRange(t.optimization.longMaParameters, 'longMa')}
                    </>
                  )}
                  {selectedStrategy === 'momentum' && (
                    renderParameterRange(t.optimization.momentumPeriodBlock, 'momentumPeriod')
                  )}
                  {selectedStrategy === 'rsi' && (
                    <>
                      {renderParameterRange(t.optimization.rsiPeriodBlock, 'rsiPeriod')}
                      {renderParameterRange(t.optimization.oversoldLevelBlock, 'oversold')}
                      {renderParameterRange(t.optimization.overboughtLevelBlock, 'overbought')}
                    </>
                  )}
                  {selectedStrategy === 'macd' && (
                    <>
                      {renderParameterRange(t.optimization.fastEmaBlock, 'fast')}
                      {renderParameterRange(t.optimization.slowEmaBlock, 'slow')}
                      {renderParameterRange(t.optimization.signalEmaBlock, 'signal')}
                    </>
                  )}
                  {selectedStrategy === 'bollinger' && (
                    <>
                      {renderParameterRange(t.optimization.periodBlock, 'period')}
                      {renderParameterRange(t.optimization.stdDevBlock, 'stdDev')}
                    </>
                  )}
                  {selectedStrategy === 'mean_reversion' && (
                    <>
                      {renderParameterRange(t.optimization.lookbackBlock, 'lookback')}
                      {renderParameterRange(t.optimization.entryZScoreBlock, 'entryZ')}
                      {renderParameterRange(t.optimization.exitZScoreBlock, 'exitZ')}
                    </>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'center', marginTop: 12 }}>
                <Button 
                  type="primary" 
                  htmlType="submit" 
                  loading={loading} 
                  icon={<RocketOutlined />} 
                  className={`primary-cta-button ${loading ? 'running-pulse' : ''}`}
                  style={{ background: 'linear-gradient(90deg, #722ed1 0%, #1890ff 100%)', border: 'none' }}
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
              message={<Text strong style={{ color: '#10b981' }}>{t.optimization.optimizationSuccess}</Text>} 
              description={success} 
              type="success" 
              showIcon 
              icon={<CheckCircleOutlined />}
              style={{ borderRadius: '16px', border: 'none', background: '#f0fdf4', padding: '16px 20px' }} 
            />
          </Col>
        )}

        {error && (
          <Col span={24}>
            <Alert 
              message={<Text strong style={{ color: '#ef4444' }}>{t.optimization.configurationError}</Text>} 
              description={error} 
              type="error" 
              showIcon 
              icon={<WarningOutlined />}
              style={{ borderRadius: '16px', border: 'none', background: '#fef2f2', padding: '16px 20px' }} 
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
              <Card className="premium-card" title={<Space><ExperimentOutlined style={{ color: '#722ed1' }} /><span>{t.optimization.performanceHeatmap}</span></Space>}>
                <div style={{ padding: '8px 0' }}>
                  <OptimizationHeatmap results={optimizationResults} strategy={selectedStrategy} />
                </div>
              </Card>
            </Col>

            <Col span={24}>
              <Card className="premium-card" title={<Space><LineChartOutlined style={{ color: '#1890ff' }} /><span>{t.optimization.detailedResultMatrix}</span></Space>}>
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