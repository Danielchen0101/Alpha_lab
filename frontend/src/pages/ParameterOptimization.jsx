import React, { useState, useEffect } from 'react';
import { Form, Input, InputNumber, Button, Select, Alert } from 'antd';
import {
  AimOutlined,
  BarChartOutlined,
  CheckCircleOutlined,
  DatabaseOutlined,
  ExperimentOutlined,
  LineChartOutlined,
  LoadingOutlined,
  RocketOutlined,
  SettingOutlined,
  ThunderboltOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { backtraderAPI } from '../services/api';
import OptimizationHeatmap from '../components/optimization/OptimizationHeatmap';
import OptimizationSummary from '../components/optimization/OptimizationSummary';
import OptimizationResultsTable from '../components/optimization/OptimizationResultsTable';
import { useLanguage } from '../contexts/LanguageContext';
import './ParameterOptimizationEditorial.css';

const MAX_OPTIMIZATION_COMBINATIONS = 500;

const optimizationErrorDetail = (value) => {
  if (typeof value === 'string') return value.trim();
  if (!value || typeof value !== 'object') return '';
  return optimizationErrorDetail(
    value.response?.data?.detail
    ?? value.response?.data?.error
    ?? value.response?.data?.message
    ?? value.result?.error
    ?? value.detail
    ?? value.error
    ?? value.message,
  );
};

const optimizationErrorCategory = (value) => {
  const status = Number(value?.response?.status ?? value?.statusCode ?? value?.status);
  const detail = optimizationErrorDetail(value).toLowerCase();
  if (status === 401 || status === 403 || /session|unauthori[sz]ed|forbidden|auth(?:entication)?|token|sign[ -]?in|login/.test(detail)) return 'session';
  if (status === 429 || /rate.?limit|too many requests|quota/.test(detail)) return 'rateLimit';
  if (status === 408 || /timeout|timed out|deadline|aborted/.test(detail)) return 'timeout';
  if (/network|offline|connection (?:refused|reset)|econn|fetch failed|failed to fetch|dns/.test(detail)) return 'network';
  if (status === 400 || status === 404 || status === 409 || status === 422 || /config|credential|api.?key|not configured|missing|required|invalid|parameter|symbol|data window/.test(detail)) return 'configuration';
  return 'generic';
};

const formatOptimizationError = (value, isZh, fallback) => {
  const category = optimizationErrorCategory(value);
  const messages = isZh ? {
    session: '登录会话已失效，请重新登录后再运行优化。',
    configuration: '参数范围、标的或数据窗口无效，请检查优化设置。',
    rateLimit: '数据服务请求过于频繁，请稍等片刻后重试。',
    timeout: '参数优化等待超时，请缩小参数网格或稍后重试。',
    network: '暂时无法连接优化服务，请检查网络和后台状态。',
    generic: fallback || '参数优化暂时无法完成，请稍后重试。',
  } : {
    session: 'Your session is no longer valid. Sign in again, then rerun the optimization.',
    configuration: 'The parameter ranges, symbol, or data window is invalid.',
    rateLimit: 'The data service is rate limiting requests. Wait a moment, then retry.',
    timeout: 'The optimization timed out. Reduce the parameter grid or try again shortly.',
    network: 'The optimization service could not be reached. Check the network and backend status.',
    generic: fallback || 'The optimization could not be completed. Try again shortly.',
  };
  const message = messages[category];
  const detail = optimizationErrorDetail(value);
  return {
    category,
    message: isZh || !detail || detail === message || detail === fallback ? message : `${message} Detail: ${detail}`,
  };
};

const STRATEGY_RANGE_PREFIXES = {
  moving_average: ['shortMa', 'longMa'],
  rsi: ['rsiPeriod', 'oversold', 'overbought'],
  macd: ['fast', 'slow', 'signal'],
  bollinger: ['period', 'stdDev'],
  momentum: ['momentumPeriod'],
  mean_reversion: ['lookback', 'entryZ', 'exitZ'],
};

const toFiniteNumber = (value) => {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
};

const isSuccessfulResult = (result) => {
  if (!result || result.error) return false;
  const status = String(result.status || '').toLowerCase();
  return !['failed', 'error', 'invalid'].includes(status);
};

const hasFiniteCoreMetrics = (result) => (
  isSuccessfulResult(result)
  && ['totalReturn', 'sharpeRatio', 'maxDrawdown'].every((key) => toFiniteNumber(result[key]) !== null)
);

const getCombinationCount = (values, strategy) => {
  const prefixes = STRATEGY_RANGE_PREFIXES[strategy] || [];
  if (prefixes.length === 0) return null;

  let total = 1;
  for (const prefix of prefixes) {
    const start = toFiniteNumber(values?.[`${prefix}Start`]);
    const end = toFiniteNumber(values?.[`${prefix}End`]);
    const step = toFiniteNumber(values?.[`${prefix}Step`]);
    if (start === null || end === null || step === null || step <= 0 || end < start) return null;

    const count = Math.floor(((end - start) / step) + 1e-9) + 1;
    if (!Number.isSafeInteger(count) || count <= 0) return null;
    total *= count;
    if (!Number.isSafeInteger(total)) return null;
  }

  return total;
};

const ParameterOptimization = () => {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const isZh = language === 'zh-CN';
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [errorCategory, setErrorCategory] = useState('configuration');
  const [success, setSuccess] = useState(null);
  const [hasRun, setHasRun] = useState(false);
  const [optimizationResults, setOptimizationResults] = useState([]);
  const [stats, setStats] = useState({
    totalCombinations: null,
    validCombinations: null,
    bestReturn: null,
    worstReturn: null,
    avgReturn: null,
    bestSharpeRatio: null
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
  const watchedValues = Form.useWatch([], form) || {};

  // Reset form fields when strategy changes
  useEffect(() => {
    if (!form) return;

    // Clear any previous errors
    setError(null);
    setSuccess(null);
    setHasRun(false);
    setOptimizationResults([]);
    setStats({
      totalCombinations: null,
      validCombinations: null,
      bestReturn: null,
      worstReturn: null,
      avgReturn: null,
      bestSharpeRatio: null,
    });

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

  const getRangeRules = (title, fieldLabel, isStep = false) => ([
    {
      required: true,
      message: isZh
        ? `${title}的${fieldLabel}为必填项`
        : `${title} ${fieldLabel.toLowerCase()} is required.`,
    },
    {
      validator: (_, value) => {
        if (value === null || value === undefined || value === '') return Promise.resolve();
        const numericValue = toFiniteNumber(value);
        if (numericValue === null) {
          return Promise.reject(new Error(isZh
            ? `${title}的${fieldLabel}必须是有限数值`
            : `${title} ${fieldLabel.toLowerCase()} must be a finite number.`));
        }
        if (isStep && numericValue <= 0) {
          return Promise.reject(new Error(
            t.optimization.validationStep
              .replace('{field}', title)
              .replace('{step}', String(value)),
          ));
        }
        return Promise.resolve();
      },
    },
  ]);

  const renderParameterRange = (title, namePrefix) => {
    const supportsDecimals = ['stdDev', 'entryZ', 'exitZ'].includes(namePrefix);
    const allowsNegative = ['entryZ', 'exitZ'].includes(namePrefix);
    const inputProps = {
      min: allowsNegative ? -10 : supportsDecimals ? 0.1 : 1,
      max: 500,
      precision: supportsDecimals ? 2 : 0,
      step: supportsDecimals ? 0.1 : 1,
      className: 'op-control',
    };

    return (
      <div className="op-range-card">
        <div className="op-range-card__heading">
          <SettingOutlined aria-hidden="true" />
          <span>{title}</span>
        </div>
        <div className="op-range-card__grid">
          <Form.Item
            label={t.optimization.start}
            name={`${namePrefix}Start`}
            rules={getRangeRules(title, t.optimization.start)}
          >
            <InputNumber {...inputProps} />
          </Form.Item>
          <Form.Item
            label={t.optimization.end}
            name={`${namePrefix}End`}
            rules={getRangeRules(title, t.optimization.end)}
          >
            <InputNumber {...inputProps} />
          </Form.Item>
          <Form.Item
            label={t.optimization.step}
            name={`${namePrefix}Step`}
            rules={getRangeRules(title, t.optimization.step, true)}
          >
            <InputNumber {...inputProps} min={supportsDecimals ? 0.01 : 1} max={100} />
          </Form.Item>
        </div>
      </div>
    );
  };

  const renderStrategyParameters = () => {
    if (selectedStrategy === 'moving_average') {
      return (
        <div className="op-parameter-grid">
          {renderParameterRange(t.optimization.shortMaParameters, 'shortMa')}
          {renderParameterRange(t.optimization.longMaParameters, 'longMa')}
        </div>
      );
    } else if (selectedStrategy === 'momentum') {
      return (
        <div className="op-parameter-grid op-parameter-grid--single">
          {renderParameterRange(t.optimization.momentumPeriodBlock, 'momentumPeriod')}
        </div>
      );
    } else if (selectedStrategy === 'rsi') {
      return (
        <div className="op-parameter-grid op-parameter-grid--three">
          {renderParameterRange(t.optimization.rsiPeriodBlock, 'rsiPeriod')}
          {renderParameterRange(t.optimization.oversoldLevelBlock, 'oversold')}
          {renderParameterRange(t.optimization.overboughtLevelBlock, 'overbought')}
        </div>
      );
    } else if (selectedStrategy === 'macd') {
      return (
        <div className="op-parameter-grid op-parameter-grid--three">
          {renderParameterRange(t.optimization.fastEmaBlock, 'fast')}
          {renderParameterRange(t.optimization.slowEmaBlock, 'slow')}
          {renderParameterRange(t.optimization.signalEmaBlock, 'signal')}
        </div>
      );
    } else if (selectedStrategy === 'bollinger') {
      return (
        <div className="op-parameter-grid">
          {renderParameterRange(t.optimization.periodBlock, 'period')}
          {renderParameterRange(t.optimization.stdDevBlock, 'stdDev')}
        </div>
      );
    } else if (selectedStrategy === 'mean_reversion') {
      return (
        <div className="op-parameter-grid op-parameter-grid--three">
          {renderParameterRange(t.optimization.lookbackBlock, 'lookback')}
          {renderParameterRange(t.optimization.entryZScoreBlock, 'entryZ')}
          {renderParameterRange(t.optimization.exitZScoreBlock, 'exitZ')}
        </div>
      );
    }

    return (
      <div className="op-parameter-fallback">
        {t.optimization.strategyParamFallback.replace('{strategy}', selectedStrategy)}
      </div>
    );
  };

  const handleRunOptimization = async (values) => {
    // Validate parameters
    let validationError = null;

    // Common validation
    const validateRange = (start, end, step, fieldName) => {
      const numericStart = toFiniteNumber(start);
      const numericEnd = toFiniteNumber(end);
      const numericStep = toFiniteNumber(step);
      if (numericStart === null || numericEnd === null || numericStep === null) {
        return isZh
          ? `${fieldName}的起始值、结束值和步长必须填写有限数值`
          : `${fieldName} start, end, and step must all be finite numbers.`;
      }
      if (numericStart > numericEnd) {
        return t.optimization.validationStartEnd
          .replace('{field}', fieldName)
          .replace('{start}', String(start))
          .replace('{end}', String(end));
      }
      if (numericStep <= 0) {
        return t.optimization.validationStep
          .replace('{field}', fieldName)
          .replace('{step}', String(step));
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
    } else if (values.strategy === 'mean_reversion') {
      const lookbackError = validateRange(values.lookbackStart, values.lookbackEnd, values.lookbackStep, t.optimization.lookbackBlock);
      const entryError = validateRange(values.entryZStart, values.entryZEnd, values.entryZStep, t.optimization.entryZScoreBlock);
      const exitError = validateRange(values.exitZStart, values.exitZEnd, values.exitZStep, t.optimization.exitZScoreBlock);
      validationError = lookbackError || entryError || exitError;
    }

    const submittedInitialCapital = toFiniteNumber(values.initial_capital);
    if (!validationError && (submittedInitialCapital === null || submittedInitialCapital < 1000)) {
      validationError = isZh
        ? '初始资金必须是不少于 1,000 的有限数值'
        : 'Initial capital must be a finite value of at least 1,000.';
    }

    const submittedCombinationCount = getCombinationCount(values, values.strategy);
    if (!validationError && submittedCombinationCount === null) {
      validationError = isZh
        ? '请填写完整且有效的参数范围。'
        : 'Complete every parameter range with valid finite values.';
    } else if (!validationError && submittedCombinationCount > MAX_OPTIMIZATION_COMBINATIONS) {
      validationError = isZh
        ? `参数网格包含 ${submittedCombinationCount.toLocaleString()} 个组合，超过 ${MAX_OPTIMIZATION_COMBINATIONS.toLocaleString()} 个的安全上限。请缩小范围或增大步长。`
        : `The parameter grid contains ${submittedCombinationCount.toLocaleString()} combinations, above the safety limit of ${MAX_OPTIMIZATION_COMBINATIONS.toLocaleString()}. Narrow the ranges or increase the steps.`;
    }

    if (validationError) {
      setErrorCategory('configuration');
      setError(validationError);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);
    setOptimizationResults([]);
    setStats({
      totalCombinations: submittedCombinationCount,
      validCombinations: null,
      bestReturn: null,
      worstReturn: null,
      avgReturn: null,
      bestSharpeRatio: null,
    });
    setHasRun(true);

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
      initialCapital: submittedInitialCapital
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
      // Keep the server's additional mean-reversion dimensions fixed so the
      // submitted grid matches the combination count shown in this UI.
      payload.stopLossRange = { start: 0.06, end: 0.06, step: 0.01 };
      payload.takeProfitRange = { start: 0.08, end: 0.08, step: 0.01 };
      payload.oversoldRange = { start: 30, end: 30, step: 1 };
    }

    try {
      const response = await backtraderAPI.runParameterOptimization(payload);
      const responseSucceeded = response.data?.success === true
        || (response.data?.success === undefined && Boolean(response.data?.result));
      if (responseSucceeded) {
        const result = response.data.result || {};
        const receivedResults = Array.isArray(result.results) ? result.results : [];
        const validResults = receivedResults.filter(hasFiniteCoreMetrics);
        const returns = validResults.map((item) => toFiniteNumber(item.totalReturn));
        const sharpes = validResults.map((item) => toFiniteNumber(item.sharpeRatio));
        const totalCombinations = toFiniteNumber(result.summary?.totalCombinations);

        setOptimizationResults(receivedResults);
        setStats({
          totalCombinations: totalCombinations ?? submittedCombinationCount,
          validCombinations: validResults.length,
          bestReturn: returns.length > 0 ? Math.max(...returns) : null,
          worstReturn: returns.length > 0 ? Math.min(...returns) : null,
          avgReturn: returns.length > 0
            ? returns.reduce((sum, value) => sum + value, 0) / returns.length
            : null,
          bestSharpeRatio: sharpes.length > 0 ? Math.max(...sharpes) : null,
        });
        setSuccess(validResults.length > 0
          ? t.optimization.optimizationCompletedMsg.replace('{count}', String(validResults.length))
          : null);
      } else {
        const localizedError = formatOptimizationError(response.data, isZh, t.optimization.optimizationFailed);
        setErrorCategory(localizedError.category);
        setError(localizedError.message);
      }
    } catch (err) {
      const localizedError = formatOptimizationError(err, isZh, t.optimization.failedToRun);
      setErrorCategory(localizedError.category);
      setError(localizedError.message);
    } finally {
      setLoading(false);
    }
  };

  const estimatedCombinations = getCombinationCount(watchedValues, selectedStrategy);
  const gridIsTooLarge = estimatedCombinations !== null
    && estimatedCombinations > MAX_OPTIMIZATION_COMBINATIONS;
  const validOptimizationResults = optimizationResults.filter(hasFiniteCoreMetrics);
  const resultReturns = validOptimizationResults
    .map((result) => toFiniteNumber(result.totalReturn))
    .filter((value) => value !== null);
  const resultSharpes = validOptimizationResults
    .map((result) => toFiniteNumber(result.sharpeRatio))
    .filter((value) => value !== null);
  const resultMetrics = hasRun ? {
    valid: stats.validCombinations ?? validOptimizationResults.length,
    bestReturn: resultReturns.length > 0 ? Math.max(...resultReturns) : null,
    averageReturn: resultReturns.length > 0
      ? resultReturns.reduce((sum, value) => sum + value, 0) / resultReturns.length
      : null,
    bestSharpe: resultSharpes.length > 0 ? Math.max(...resultSharpes) : null,
  } : null;
  const bestOptimizationResult = validOptimizationResults.reduce((best, result) => {
    if (!best) return result;
    return toFiniteNumber(result.sharpeRatio) > toFiniteNumber(best.sharpeRatio) ? result : best;
  }, null);

  const strategyLabel = strategyOptions.find((option) => option.value === selectedStrategy)?.label || selectedStrategy;
  const status = loading ? 'running' : error ? 'error' : success ? 'complete' : 'ready';
  const statusLabel = {
    ready: t.optimization.optimizationReady,
    running: t.optimization.optimizationRunning,
    complete: t.optimization.optimizationCompleted,
    error: t.optimization.optimizationFailed,
  }[status];
  const formatPercent = (value) => {
    const numericValue = toFiniteNumber(value);
    return numericValue === null
      ? '—'
      : `${numericValue > 0 ? '+' : ''}${numericValue.toFixed(2)}%`;
  };

  const handleBacktestBestSetup = () => {
    if (!bestOptimizationResult || selectedStrategy !== 'moving_average') return;
    navigate('/backtest', {
      state: {
        fromOptimization: true,
        symbol: (watchedValues.symbol || 'AAPL').toUpperCase(),
        strategy: selectedStrategy,
        initialCapital: watchedValues.initial_capital || 100000,
        parameters: {
          shortMaPeriod: bestOptimizationResult.short_ma,
          longMaPeriod: bestOptimizationResult.long_ma,
        },
      },
    });
  };

  return (
    <div className="optimization-editorial">
      <header className="op-hero">
        <div>
          <span className="op-kicker"><ExperimentOutlined aria-hidden="true" /> {isZh ? '策略实验室 · 02' : 'STRATEGY LAB · 02'}</span>
          <h1>{t.optimization.title}</h1>
          <p>{t.optimization.subtitle}</p>
          <div className="op-hero-meta">
            <span><i className="is-live" />{isZh ? '历史市场数据' : 'HISTORICAL MARKET DATA'}</span>
            <span>{isZh ? '目标：风险调整后收益' : 'OBJECTIVE: RISK-ADJUSTED RETURN'}</span>
          </div>
        </div>
        <div className={`op-status op-status--${status}`} role="status" aria-live="polite">
          {loading ? <LoadingOutlined spin aria-hidden="true" /> : <i />}
          <span>{statusLabel}</span>
        </div>
      </header>

      <section className="op-metric-ledger" aria-label={isZh ? '优化指标' : 'Optimization metrics'}>
        <article>
          <span>{isZh ? '搜索网格' : 'SEARCH GRID'}</span>
          <strong>{estimatedCombinations === null ? '—' : estimatedCombinations.toLocaleString()}</strong>
          <small>{isZh ? '预估参数组合' : 'estimated combinations'}</small>
        </article>
        <article>
          <span>{t.optimization.validCombinations}</span>
          <strong>{resultMetrics ? resultMetrics.valid.toLocaleString() : '—'}</strong>
          <small>{isZh ? '通过计算的组合' : 'completed calculations'}</small>
        </article>
        <article>
          <span>{t.optimization.bestReturn}</span>
          <strong className={resultMetrics && resultMetrics.bestReturn !== null
            ? (resultMetrics.bestReturn >= 0 ? 'is-positive' : 'is-negative')
            : undefined}
          >
            {resultMetrics ? formatPercent(resultMetrics.bestReturn) : '—'}
          </strong>
          <small>{isZh ? '当前结果集' : 'current result set'}</small>
        </article>
        <article>
          <span>{t.optimization.averageReturn}</span>
          <strong>{resultMetrics ? formatPercent(resultMetrics.averageReturn) : '—'}</strong>
          <small>{isZh ? '所有有效组合' : 'all valid combinations'}</small>
        </article>
        <article>
          <span>{t.optimization.bestSharpeCard}</span>
          <strong>{resultMetrics && resultMetrics.bestSharpe !== null ? resultMetrics.bestSharpe.toFixed(2) : '—'}</strong>
          <small>{isZh ? '主要排序目标' : 'primary ranking objective'}</small>
        </article>
      </section>

      <section className="op-workbench">
        <div className="op-section-heading">
          <div>
            <span>{isZh ? '01 / 搜索约束' : '01 / SEARCH MANDATE'}</span>
            <h2>{t.optimization.engineConfiguration}</h2>
          </div>
          <p>{isZh ? '定义研究范围、参数边界与资金假设。所有组合均使用同一数据窗口进行比较。' : 'Define the research universe, parameter bounds, and capital assumptions. Every combination is evaluated on the same data window.'}</p>
        </div>

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
          <div className="op-config-grid">
            <Form.Item label={t.optimization.stockSymbol} name="symbol" rules={[{ required: true }]}>
              <Input prefix={<LineChartOutlined aria-hidden="true" />} placeholder={isZh ? '例如 AAPL' : 'e.g. AAPL'} className="op-control" />
            </Form.Item>
            <Form.Item label={t.optimization.strategyModel} name="strategy" rules={[{ required: true }]}>
              <Select options={strategyOptions} className="op-control" />
            </Form.Item>
            <Form.Item label={t.optimization.lookbackPeriod} name="period" rules={[{ required: true }]}>
              <Select className="op-control">
                <Select.Option value="3m">{t.optimization.threeMonthsData}</Select.Option>
                <Select.Option value="6m">{t.optimization.sixMonthsData}</Select.Option>
                <Select.Option value="1y">{t.optimization.oneYearData}</Select.Option>
              </Select>
            </Form.Item>
            <Form.Item
              label={t.optimization.initialLiquidity}
              name="initial_capital"
              rules={[
                { required: true },
                {
                  validator: (_, value) => {
                    const numericValue = toFiniteNumber(value);
                    if (numericValue !== null && numericValue >= 1000) return Promise.resolve();
                    return Promise.reject(new Error(isZh
                      ? '初始资金必须是不少于 1,000 的有限数值'
                      : 'Initial capital must be a finite value of at least 1,000.'));
                  },
                },
              ]}
            >
              <InputNumber
                min={1000}
                className="op-control"
                formatter={(value) => `$ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              />
            </Form.Item>
          </div>

          <div className="op-workbench-body">
            <div className="op-parameter-pane">
              <div className="op-subheading">
                <span>{isZh ? '参数范围' : 'PARAMETER RANGES'}</span>
                <h3>{t.optimization.parameterSearchSpace}</h3>
              </div>
              {renderStrategyParameters()}
            </div>

            <aside className="op-protocol">
              <div className="op-protocol__heading">
                <AimOutlined aria-hidden="true" />
                <span>{isZh ? '优化协议' : 'OPTIMIZATION PROTOCOL'}</span>
              </div>
              <dl>
                <div><dt>{t.optimization.symbol}</dt><dd>{watchedValues.symbol || 'AAPL'}</dd></div>
                <div><dt>{t.optimization.strategy}</dt><dd>{strategyLabel}</dd></div>
                <div><dt>{t.optimization.period}</dt><dd>{(watchedValues.period || '1y').toUpperCase()}</dd></div>
                <div><dt>{isZh ? '组合规模' : 'GRID SIZE'}</dt><dd>{estimatedCombinations === null ? '—' : estimatedCombinations.toLocaleString()}</dd></div>
              </dl>
              <div className="op-objective-note">
                <BarChartOutlined aria-hidden="true" />
                <p><strong>{isZh ? '排名目标' : 'RANKING OBJECTIVE'}</strong>{isZh ? '结果按夏普比率评估，同时保留收益率、最大回撤、胜率与交易次数。' : 'Results are ranked by Sharpe ratio while retaining return, drawdown, win rate, and trade count.'}</p>
              </div>
            </aside>
          </div>

          <div className="op-run-band">
            <div>
              <span>{isZh ? '准备运行' : 'READY TO RUN'}</span>
              <p className={gridIsTooLarge ? 'is-error' : undefined}>
                {gridIsTooLarge
                  ? (isZh
                    ? `当前包含 ${estimatedCombinations.toLocaleString()} 个组合；安全上限为 ${MAX_OPTIMIZATION_COMBINATIONS.toLocaleString()}。请缩小范围或增大步长。`
                    : `This grid contains ${estimatedCombinations.toLocaleString()} combinations; the safety limit is ${MAX_OPTIMIZATION_COMBINATIONS.toLocaleString()}. Narrow the ranges or increase the steps.`)
                  : estimatedCombinations
                    ? (isZh
                      ? `将评估约 ${estimatedCombinations.toLocaleString()} 个参数组合。`
                      : `Approximately ${estimatedCombinations.toLocaleString()} parameter combinations will be evaluated.`)
                    : (isZh
                      ? '请完成参数范围配置。'
                      : 'Complete the parameter ranges to calculate the search grid.')}
              </p>
            </div>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              disabled={estimatedCombinations === null || gridIsTooLarge}
              icon={<RocketOutlined />}
              className="op-run-button"
            >
              {loading ? t.optimization.runningGeneticSearch : t.optimization.runOptimization}
            </Button>
          </div>
        </Form>
      </section>

      {loading && (
        <section className="op-progress-panel" aria-live="polite">
          <div className="op-progress-panel__top">
            <div>
              <span>{isZh ? '02 / 运行中' : '02 / OPTIMIZATION RUN'}</span>
              <h2>{t.optimization.optimizationRunning}</h2>
            </div>
            <LoadingOutlined spin aria-hidden="true" />
          </div>
          <div className="op-progress-track"><i /></div>
          <div className="op-progress-stages">
            <span className="is-active"><b>01</b>{isZh ? '生成参数网格' : 'Build parameter grid'}</span>
            <span className="is-active"><b>02</b>{isZh ? '执行历史模拟' : 'Run historical trials'}</span>
            <span><b>03</b>{isZh ? '稳健性排序' : 'Rank robust results'}</span>
          </div>
        </section>
      )}

      {success && (
        <Alert
          className="op-alert op-alert--success"
          message={t.optimization.optimizationSuccess}
          description={success}
          type="success"
          showIcon
          icon={<CheckCircleOutlined />}
        />
      )}

      {error && (
        <Alert
          className="op-alert op-alert--error"
          message={({
            session: isZh ? '会话已失效' : 'Session expired',
            configuration: t.optimization.configurationError,
            rateLimit: isZh ? '请求过于频繁' : 'Rate limit reached',
            timeout: isZh ? '优化等待超时' : 'Optimization timed out',
            network: isZh ? '服务连接失败' : 'Service unavailable',
            generic: isZh ? '优化运行失败' : 'Optimization failed',
          })[errorCategory]}
          description={error}
          type="error"
          showIcon
          icon={<WarningOutlined />}
        />
      )}

      {!loading && !error && !hasRun && optimizationResults.length === 0 && (
        <section className="op-empty-state">
          <div className="op-empty-state__mark"><DatabaseOutlined aria-hidden="true" /></div>
          <span>{isZh ? '02 / 结果工作台' : '02 / RESULTS DESK'}</span>
          <h2>{t.optimization.noResults}</h2>
          <p>{isZh ? '运行一次参数优化后，这里会显示稳健性摘要、绩效热力图和完整结果矩阵。' : 'Run an optimization to populate the robustness summary, performance heatmap, and complete result matrix.'}</p>
        </section>
      )}

      {!loading && !error && hasRun && optimizationResults.length === 0 && (
        <section className="op-empty-state">
          <div className="op-empty-state__mark"><DatabaseOutlined aria-hidden="true" /></div>
          <span>{isZh ? '02 / 结果工作台' : '02 / RESULTS DESK'}</span>
          <h2>{t.optimization.noResults}</h2>
          <p>{isZh
            ? '本次优化已完成，但没有返回可展示的试验结果。请调整参数范围或数据窗口后重试。'
            : 'The run completed without any displayable trials. Adjust the parameter ranges or data window and try again.'}</p>
        </section>
      )}

      {!loading && !error && hasRun && optimizationResults.length > 0 && validOptimizationResults.length === 0 && (
        <section className="op-empty-state">
          <div className="op-empty-state__mark"><WarningOutlined aria-hidden="true" /></div>
          <span>{isZh ? '02 / 结果工作台' : '02 / RESULTS DESK'}</span>
          <h2>{isZh ? '没有有效的试验结果' : 'No valid trials were returned'}</h2>
          <p>{isZh
            ? '服务返回了试验记录，但这些记录缺少完整绩效指标或标记为失败。请调整参数范围、标的或数据窗口后重试。'
            : 'The service returned trial records, but they were failed or missing complete performance metrics. Adjust the ranges, symbol, or data window and try again.'}</p>
        </section>
      )}

      {optimizationResults.length > 0 && validOptimizationResults.length > 0 && (
        <section className="op-results">
          <div className="op-section-heading op-section-heading--results">
            <div>
              <span>{isZh ? '02 / 稳健性结果' : '02 / ROBUSTNESS RESULTS'}</span>
              <h2>{t.optimization.optimizationResults}</h2>
            </div>
            <div className="op-results-intro">
              <p>{isZh ? '先查看最优组合与总体分布，再下钻到参数交互和每一次试验。' : 'Review the leading configuration and distribution first, then inspect parameter interactions and every trial.'}</p>
              {selectedStrategy === 'moving_average' && bestOptimizationResult && (
                <Button className="op-backtest-button" onClick={handleBacktestBestSetup}>
                  {isZh ? '使用最佳参数回测' : 'Backtest best setup'}
                </Button>
              )}
            </div>
          </div>

          <div className="op-summary-shell">
            <OptimizationSummary
              results={optimizationResults}
              totalCombinations={stats.totalCombinations}
              validCombinations={stats.validCombinations}
              strategy={selectedStrategy}
            />
          </div>

          <section className="op-result-panel">
            <header>
              <div><ExperimentOutlined aria-hidden="true" /><span>{isZh ? '03 / 参数地形' : '03 / PARAMETER SURFACE'}</span></div>
              <h3>{t.optimization.performanceHeatmap}</h3>
            </header>
            <div className="op-result-panel__body op-heatmap-shell">
              <OptimizationHeatmap results={optimizationResults} strategy={selectedStrategy} />
            </div>
          </section>

          <section className="op-result-panel">
            <header>
              <div><ThunderboltOutlined aria-hidden="true" /><span>{isZh ? '04 / 全部试验' : '04 / ALL TRIALS'}</span></div>
              <h3>{t.optimization.detailedResultMatrix}</h3>
            </header>
            <div className="op-result-panel__body op-table-shell">
              <OptimizationResultsTable results={optimizationResults} strategy={selectedStrategy} />
            </div>
          </section>
        </section>
      )}
    </div>
  );
};

export default ParameterOptimization;
