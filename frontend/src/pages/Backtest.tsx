import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, Form, Input, InputNumber, Button, Select, DatePicker, Row, Col, Statistic, Table, Tag, Alert, Space, message, Empty, Spin, Tabs, Checkbox, Modal, Typography, Badge } from 'antd';
import { PlayCircleOutlined, HistoryOutlined, LineChartOutlined, ReloadOutlined, EyeOutlined, SaveOutlined, FolderOpenOutlined, DeleteOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { useLocation, useNavigate } from 'react-router-dom';
import { backtraderAPI } from '../services/api';
import { isOperationsArtifactConflict, operationsArtifactsAPI } from '../services/operationsArtifactsService';
import dayjs from 'dayjs';

import TradingChart from '../components/TradingChart';
import DataSourceBadge from '../components/DataSourceBadge';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import {
  parseDateSafe,
  formatDateForChartWithYear,
  formatDateToYYYYMMDD,
  filterValidDates,
  sortByDateAsc
} from '../utils/dateUtils';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import './BacktestEditorial.css';

const { Title, Text } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;

const SAVED_STRATEGIES_KEY_PREFIX = 'quant_saved_strategies';
const BACKTEST_HISTORY_KEY_PREFIX = 'quant_backtest_history';
const LAST_BACKTEST_PARAMS_KEY_PREFIX = 'quant_last_backtest_params';
const savedStrategiesStorageKey = (userId: string): string => `${SAVED_STRATEGIES_KEY_PREFIX}:${userId}`;
const backtestHistoryKey = (userId: string): string => `${BACKTEST_HISTORY_KEY_PREFIX}:${userId}`;
const lastBacktestParamsKey = (userId: string): string => `${LAST_BACKTEST_PARAMS_KEY_PREFIX}:${userId}`;

interface BacktestFormValues {
  symbol: string;
  strategy: string;
  dateRange: [dayjs.Dayjs, dayjs.Dayjs];
  initialCapital: number;
  dataMode: string;
  shortMaPeriod?: number;
  longMaPeriod?: number;
  rsiPeriod?: number;
  rsiOversold?: number;
  rsiOverbought?: number;
  macdFast?: number;
  macdSlow?: number;
  macdSignal?: number;
  bollingerPeriod?: number;
  bollingerStdDev?: number;
  momentumPeriod?: number;
}

// 交易项类型定义
interface TradeItem {
  tradeId?: number;
  entryDate: string;
  exitDate?: string;
  entryPrice: number;
  exitPrice?: number;
  pnl: number;
  returnPct: number;
  holdingPeriod?: number;
  holdingDays?: number;
  position?: number; // 1 = BUY, -1 = SELL
  action?: string; // 'BUY' or 'SELL'
  quantity?: number;
  symbol?: string;
}

interface BacktestResult {
  backtestId: string;
  status: 'running' | 'completed' | 'failed' | 'unknown';
  success?: boolean; // 添加success字段
  results: {
    totalReturn?: number;
    sharpeRatio?: number;
    maxDrawdown?: number;
    winRate?: number;
    trades?: number;
    annualizedReturn?: number;
    profitLoss?: number;
    calmarRatio?: number;
    avgReturnPerTrade?: number;
    equityCurve?: Array<{ date: string; equity: number }>;
    volatility?: number;
    sortinoRatio?: number;
    profitFactor?: number;
    expectancy?: number;
    exposure?: number;
    chartData?: Array<{
      date: string;
      close: number;
      signal: number;
      sma20?: number;
      sma50?: number;
      volume?: number;
    }>;
    // 后端返回的额外交易统计字段
    avgWin?: number;
    avgLoss?: number;
    // 交易列表（新增）
    tradesList?: TradeItem[];
  };
  parameters: {
    strategy: string;
    symbols: string[];
    symbol?: string; // 兼容单股票模式
    period: string;
    initialCapital: number;
    // 数据模式参数
    dataMode?: string;
    dataModeDisplay?: string;
    dataSource?: string;
    // 策略特定参数
    shortMaPeriod?: number;
    longMaPeriod?: number;
    rsiPeriod?: number;
    rsiOversold?: number;
    rsiOverbought?: number;
    macdFast?: number;
    macdSlow?: number;
    macdSignal?: number;
    // 策略参数对象
    parameters?: Record<string, any>;
    // 日期参数
    startDate?: string;
    endDate?: string;
  };
  createdAt?: string;
  drawdownCurve?: Array<{ date: string; drawdown: number }>;
}

interface BacktestHistoryItem {
  backtestId: string;
  status: 'running' | 'completed' | 'failed' | 'unknown';
  results?: {
    totalReturn?: number;
    sharpeRatio?: number;
    maxDrawdown?: number;
    winRate?: number;
    trades?: number;
    annualizedReturn?: number;
    profitLoss?: number;
    // 图表数据（历史记录可能包含）
    chartData?: Array<{
      date: string;
      close: number;
      signal: number;
      sma20?: number;
      sma50?: number;
      volume?: number;
    }>;
    // 完整的回测结果数据
    equityCurve?: Array<{ date: string; equity: number }>;
    tradesList?: TradeItem[];
    volatility?: number;
    sortinoRatio?: number;
    profitFactor?: number;
    expectancy?: number;
    exposure?: number;
    calmarRatio?: number;
    avgReturnPerTrade?: number;
    avgWin?: number;
    avgLoss?: number;
  };
  parameters?: {
    strategy: string;
    symbols: string[];
    period: string;
    initialCapital: number;
    // 数据模式参数
    dataMode?: string;
    dataModeDisplay?: string;
    dataSource?: string;
    // 原始参数
    startDate?: string;
    endDate?: string;
    [key: string]: any; // 允许其他策略特定参数
  };
  createdAt?: string;
  symbol?: string;
  strategy?: string;
  startDate?: string;
  endDate?: string;
  initialCapital?: number;
  totalReturn?: number;
  sharpeRatio?: number;
  maxDrawdown?: number;
  winRate?: number;
  trades?: number;
  annualizedReturn?: number;
  profitLoss?: number;
}

const strategyDefaults: Record<string, any> = {
  moving_average: {
    shortMaPeriod: 20,
    longMaPeriod: 50,
  },
  rsi: {
    rsiPeriod: 14,
    rsiOversold: 30,
    rsiOverbought: 70,
  },
  macd: {
    macdFast: 12,
    macdSlow: 26,
    macdSignal: 9,
  },
  bollinger: {
    bollingerPeriod: 20,
    bollingerStdDev: 2,
  },
  momentum: {
    momentumPeriod: 20,
  },
  mean_reversion: {
    lookbackPeriod: 20,
    entryZScore: -2.0,
    exitZScore: 0.0,
    stopLossPct: 6,
    takeProfitPct: 8,
    rsiPeriod: 14,
    oversoldLevel: 30,
    enableTrendFilter: true,
    trendMaPeriod: 100,
  },
  buy_hold: {},
  donchian_breakout: {
    entryPeriod: 20,
    exitPeriod: 10,
    atrPeriod: 20,
    atrStopMultiple: 2.0,
  },
  keltner_breakout: {
    emaPeriod: 20,
    atrPeriod: 20,
    atrMultiplier: 2.0,
  },
  supertrend: {
    atrPeriod: 10,
    multiplier: 3.0,
  },
  stochastic: {
    kPeriod: 14,
    dPeriod: 3,
    oversold: 20,
    overbought: 80,
  },
  adx_trend: {
    adxPeriod: 14,
    adxThreshold: 25,
    fastEmaPeriod: 20,
    slowEmaPeriod: 50,
  },
};

const defaultDateRange = (): [dayjs.Dayjs, dayjs.Dayjs] => {
  const end = dayjs();
  const start = dayjs().subtract(1, 'year');
  return [start, end];
};

const safeNumber = (value: unknown): number | null => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string' || !value.trim()) return null;
  const numericStr = value.trim().replace(/[$,%]/g, '').replace(/,/g, '');
  const parsed = Number(numericStr);
  return Number.isFinite(parsed) ? parsed : null;
};

const hasDisplayableBacktestResults = (results?: BacktestResult['results']): boolean => {
  if (!results) return false;
  const hasMetric = [
    results.totalReturn,
    results.sharpeRatio,
    results.maxDrawdown,
    results.winRate,
    results.trades,
    results.profitLoss,
  ].some((value) => safeNumber(value) !== null);
  return hasMetric
    || Boolean(results.equityCurve?.length)
    || Boolean(results.chartData?.length)
    || Boolean(results.tradesList?.length);
};

const splitSymbols = (value: unknown): string[] => typeof value === 'string'
  ? value.split(',').map(symbol => symbol.trim().toUpperCase()).filter(Boolean)
  : [];

const RESULT_TAB_KEYS = ['results', 'charts', 'trades', 'parameters'] as const;

type BacktestErrorCategory = 'session' | 'configuration' | 'rateLimit' | 'timeout' | 'network' | 'generic';

const backtestErrorDetail = (value: unknown): string => {
  if (typeof value === 'string') return value.trim();
  if (!value || typeof value !== 'object') return '';
  const record = value as Record<string, any>;
  return backtestErrorDetail(
    record.response?.data?.detail
    ?? record.response?.data?.error
    ?? record.response?.data?.message
    ?? record.result?.error
    ?? record.detail
    ?? record.error
    ?? record.message,
  );
};

const backtestErrorCategory = (value: unknown): BacktestErrorCategory => {
  const record = value && typeof value === 'object' ? value as Record<string, any> : {};
  const status = Number(record.response?.status ?? record.statusCode ?? record.status);
  const detail = backtestErrorDetail(value).toLowerCase();
  if (status === 401 || status === 403 || /session|unauthori[sz]ed|forbidden|auth(?:entication)?|token|sign[ -]?in|login/.test(detail)) return 'session';
  if (status === 429 || /rate.?limit|too many requests|quota/.test(detail)) return 'rateLimit';
  if (status === 408 || /timeout|timed out|deadline|aborted/.test(detail)) return 'timeout';
  if (/network|offline|connection (?:refused|reset)|econn|fetch failed|failed to fetch|dns/.test(detail)) return 'network';
  if (status === 400 || status === 404 || status === 409 || status === 422 || /config|credential|api.?key|not configured|missing|required|invalid|parameter|symbol|date range|data window|insufficient data/.test(detail)) return 'configuration';
  return 'generic';
};

const formatBacktestError = (
  value: unknown,
  language: string,
  fallback?: string,
): string => {
  const isZh = language === 'zh-CN';
  const copy = isZh ? {
    session: '登录会话已失效，请重新登录后再运行回测。',
    configuration: '回测参数、标的或数据窗口无效，请检查研究设定。',
    rateLimit: '数据服务请求过于频繁，请稍等片刻后重试。',
    timeout: '回测等待超时，请缩小数据窗口或稍后重试。',
    network: '暂时无法连接回测服务，请检查网络和后台状态。',
    generic: fallback || '回测暂时无法完成，请稍后重试。',
    detail: '详情',
  } : {
    session: 'Your session is no longer valid. Sign in again, then rerun the backtest.',
    configuration: 'The symbol, parameters, or data window is invalid for this backtest.',
    rateLimit: 'The data service is rate limiting requests. Wait a moment, then retry.',
    timeout: 'The backtest timed out. Reduce the data window or try again shortly.',
    network: 'The backtest service could not be reached. Check the network and backend status.',
    generic: fallback || 'The backtest could not be completed. Try again shortly.',
    detail: 'Detail',
  };
  const friendly = copy[backtestErrorCategory(value)];
  const detail = backtestErrorDetail(value);
  if (isZh || !detail || detail === friendly || detail === fallback) return friendly;
  return `${friendly} ${copy.detail}: ${detail}`;
};

const saveLocalBacktestHistory = (storageKey: string, history: BacktestHistoryItem[]) => {
  if (!storageKey) return;
  try {
    const limitedHistory = history.slice(0, 20);
    localStorage.setItem(storageKey, JSON.stringify(limitedHistory));
  } catch (err) {
    console.error('Failed to save local backtest history:', err);
  }
};

const loadLocalBacktestHistory = (storageKey: string): BacktestHistoryItem[] => {
  if (!storageKey) return [];
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      const history = JSON.parse(saved);

      const cleanedHistory = history
        .filter((item: BacktestHistoryItem) => {
          if (!item.backtestId || item.backtestId.trim() === '') {
            console.log('Filtered out record without backtestId:', item);
            return false;
          }
          return true;
        })
        .map((item: BacktestHistoryItem) => {
          const normalizedItem: BacktestHistoryItem = { ...item };
          if (!item.symbol || item.symbol === 'Unknown' || item.symbol.trim() === '') {
            normalizedItem.symbol = 'N/A';
          }
          if (!item.strategy || item.strategy === 'Unknown' || item.strategy.trim() === '') {
            normalizedItem.strategy = 'N/A';
          }
          if (!item.status || !['running', 'completed', 'failed', 'unknown'].includes(item.status)) {
            normalizedItem.status = 'unknown';
          }
          return normalizedItem;
        });

      if (cleanedHistory.length !== history.length) {
        console.log(`Cleaned backtest history: removed ${history.length - cleanedHistory.length} invalid records`);
        saveLocalBacktestHistory(storageKey, cleanedHistory);
      }

      return cleanedHistory;
    }
  } catch (err) {
    console.error('Failed to load local backtest history:', err);
  }
  return [];
};

const Backtest: React.FC = () => {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const accountHistoryKey = user?.id ? backtestHistoryKey(user.id) : '';
  const accountLastParamsKey = user?.id ? lastBacktestParamsKey(user.id) : '';
  const [form] = Form.useForm();
  const location = useLocation();
  const navigate = useNavigate();
  const resultsRef = useRef<HTMLDivElement>(null);
  const localizedCopyRef = useRef({ language, realData: t.backtest.realData });
  localizedCopyRef.current = { language, realData: t.backtest.realData };
  const [loading, setLoading] = useState(false);
  const [backtestResult, setBacktestResult] = useState<BacktestResult | null>(null);
  const [backtestHistory, setBacktestHistory] = useState<BacktestHistoryItem[]>([]);
  const [error, setError] = useState<string>('');
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string>('');
  const [selectedBacktests, setSelectedBacktests] = useState<string[]>([]);
  const [selectedStrategy, setSelectedStrategy] = useState<string>('moving_average');
  const [savedStrategies, setSavedStrategies] = useState<any[]>([]);
  const savedStrategiesVersionRef = useRef<number | undefined>(undefined);
  const savedStrategiesMutationRef = useRef<Promise<void>>(Promise.resolve());
  const [showSavedStrategies, setShowSavedStrategies] = useState(false);
  const [portfolioSymbols, setPortfolioSymbols] = useState<string[]>([]);
  const queryParams = new URLSearchParams(location.search);
  const symbolFromUrl = queryParams.get('symbol');
  const requestedResultTab = queryParams.get('tab');
  const activeResultTab = RESULT_TAB_KEYS.includes(requestedResultTab as typeof RESULT_TAB_KEYS[number])
    ? requestedResultTab as typeof RESULT_TAB_KEYS[number]
    : 'results';
  const navigationState = location.state as any;
  const navigationSymbol = navigationState?.symbol;
  const navigationStrategy = navigationState?.strategy;
  const navigationInitialCapital = navigationState?.initialCapital;
  const navigationFromOptimization = navigationState?.fromOptimization;
  const navigationParameters = navigationState?.parameters;

  // 请求ID管理，防止竞争条件
  const requestIdRef = useRef<string>('');

  const fetchBacktestHistory = useCallback(async () => {
    try {
      setHistoryLoading(true);
      setHistoryError('');

      const localHistory = loadLocalBacktestHistory(accountHistoryKey);
      let combinedHistory = [...localHistory];

      try {
        const response = await backtraderAPI.getBacktestHistory();
        const apiHistory = response.data?.history;
        if (Array.isArray(apiHistory)) {
          const apiHistoryData = apiHistory.map((item: any) => {
            const symbol = item.parameters?.symbols?.[0] || 'Unknown';
            const strategy = item.parameters?.strategy || 'Unknown';
            const period = item.parameters?.period || '';
            const [startDate, endDate] = period.split(' to ') || ['', ''];

            return {
              backtestId: item.backtestId || '',
              status: item.status || 'unknown',
              results: item.results,
              parameters: item.parameters,
              createdAt: item.createdAt,
              symbol,
              strategy,
              startDate,
              endDate,
              initialCapital: safeNumber(item.parameters?.initialCapital) ?? undefined,
              totalReturn: safeNumber(item.results?.totalReturn) ?? undefined,
              sharpeRatio: safeNumber(item.results?.sharpeRatio) ?? undefined,
              maxDrawdown: safeNumber(item.results?.maxDrawdown) ?? undefined,
              winRate: safeNumber(item.results?.winRate) ?? undefined,
              trades: safeNumber(item.results?.trades) ?? undefined,
              annualizedReturn: safeNumber(item.results?.annualizedReturn) ?? undefined,
              profitLoss: safeNumber(item.results?.profitLoss) ?? undefined,
            };
          });

          const apiHistoryMap = new Map();
          apiHistoryData.forEach((item: any) => {
            if (item.backtestId) {
              apiHistoryMap.set(item.backtestId, item);
            }
          });

          localHistory.forEach(item => {
            if (item.backtestId && !apiHistoryMap.has(item.backtestId)) {
              apiHistoryMap.set(item.backtestId, item);
            }
          });

          combinedHistory = Array.from(apiHistoryMap.values());
          combinedHistory.sort((a, b) => {
            const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return dateB - dateA;
          });
        } else {
          throw new Error('Invalid backtest history response');
        }
      } catch (apiErr) {
        console.warn('Failed to fetch backtest history from API, using local storage only:', apiErr);
        if (localHistory.length === 0) {
          setHistoryError(formatBacktestError(
            apiErr,
            localizedCopyRef.current.language,
            localizedCopyRef.current.language === 'zh-CN'
              ? '历史会话同步失败，请稍后重试。'
              : 'Could not synchronize backtest history. Please try again.',
          ));
        }
      }

      setBacktestHistory(combinedHistory);
    } catch (err) {
      console.error('Failed to fetch backtest history:', err);
      setBacktestHistory(loadLocalBacktestHistory(accountHistoryKey));
      setHistoryError(formatBacktestError(
        err,
        localizedCopyRef.current.language,
        localizedCopyRef.current.language === 'zh-CN'
          ? '历史会话载入失败，请稍后重试。'
          : 'Could not load backtest history. Please try again.',
      ));
    } finally {
      setHistoryLoading(false);
    }
  }, [accountHistoryKey]);

  const loadBacktestResult = useCallback(async (backtestId: string) => {
    try {
      const response = await backtraderAPI.getBacktestResults(backtestId);
      if (response.data) {
        const responseStatus = response.data.result?.status || response.data.status;
        const responseSuccess = response.data.success === true
          ? true
          : response.data.success === false
            ? false
          : responseStatus
            ? responseStatus === 'completed'
            : undefined;
        const mergedResult = {
          ...response.data.result,
          success: responseSuccess,
        };
        if (responseSuccess === false || responseStatus === 'failed') {
          setBacktestResult(null);
          setError(localizedCopyRef.current.language === 'zh-CN'
            ? '这次回测未成功完成，无法生成验证报告。'
            : 'This backtest did not complete successfully, so no validation report is available.');
          message.error(localizedCopyRef.current.language === 'zh-CN' ? '回测未完成' : 'Backtest not completed');
          return;
        }
        if (!hasDisplayableBacktestResults(mergedResult.results)) {
          setBacktestResult(null);
          setError(localizedCopyRef.current.language === 'zh-CN'
            ? '服务返回了回测会话，但没有可展示的绩效、曲线或交易记录。'
            : 'The service returned a backtest session without displayable metrics, curves, or trades.');
          return;
        }
        setError('');
        setBacktestResult(mergedResult);
        setTimeout(() => {
          resultsRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
        message.success(localizedCopyRef.current.language === 'zh-CN' ? '回测结果已加载' : 'Backtest results loaded');
      }
    } catch (err) {
      console.error('Error loading backtest:', err);
      setBacktestResult(null);
      setError(formatBacktestError(
        err,
        localizedCopyRef.current.language,
        localizedCopyRef.current.language === 'zh-CN'
          ? '无法载入该回测会话，请稍后重试。'
          : 'The backtest session could not be loaded. Please try again.',
      ));
      message.error(localizedCopyRef.current.language === 'zh-CN' ? '加载回测结果失败' : 'Failed to load backtest results');
    }
  }, []);

  const handleViewBacktest = useCallback((record: BacktestHistoryItem) => {
    try {
      console.log('Viewing backtest:', record.backtestId);

      const currentHistory = loadLocalBacktestHistory(accountHistoryKey);
      const foundRecord = currentHistory.find(item => item.backtestId === record.backtestId);

      if (foundRecord) {
        const historyResults = foundRecord.results || {};
        const result: BacktestResult = {
          backtestId: foundRecord.backtestId,
          status: foundRecord.status,
          success: foundRecord.status === 'completed'
            ? true
            : foundRecord.status === 'failed'
              ? false
              : undefined,
          results: {
            totalReturn: safeNumber((historyResults as any).totalReturn ?? foundRecord.totalReturn) ?? undefined,
            sharpeRatio: safeNumber((historyResults as any).sharpeRatio ?? foundRecord.sharpeRatio) ?? undefined,
            maxDrawdown: safeNumber((historyResults as any).maxDrawdown ?? foundRecord.maxDrawdown) ?? undefined,
            winRate: safeNumber((historyResults as any).winRate ?? foundRecord.winRate) ?? undefined,
            trades: safeNumber((historyResults as any).trades ?? foundRecord.trades) ?? undefined,
            annualizedReturn: safeNumber((historyResults as any).annualizedReturn ?? foundRecord.annualizedReturn) ?? undefined,
            profitLoss: safeNumber((historyResults as any).profitLoss ?? foundRecord.profitLoss) ?? undefined,
            chartData: (historyResults as any).chartData || [],
            equityCurve: (historyResults as any).equityCurve || [],
            tradesList: (historyResults as any).tradesList || [],
            volatility: safeNumber((historyResults as any).volatility) ?? undefined,
            sortinoRatio: safeNumber((historyResults as any).sortinoRatio) ?? undefined,
            profitFactor: safeNumber((historyResults as any).profitFactor) ?? undefined,
            expectancy: safeNumber((historyResults as any).expectancy) ?? undefined,
            exposure: safeNumber((historyResults as any).exposure) ?? undefined,
            calmarRatio: safeNumber((historyResults as any).calmarRatio) ?? undefined,
            avgReturnPerTrade: safeNumber((historyResults as any).avgReturnPerTrade) ?? undefined,
            avgWin: safeNumber((historyResults as any).avgWin) ?? undefined,
            avgLoss: safeNumber((historyResults as any).avgLoss) ?? undefined
          },
          parameters: foundRecord.parameters || {
            strategy: foundRecord.strategy || '',
            symbols: foundRecord.symbol ? [foundRecord.symbol] : [],
            period: foundRecord.startDate && foundRecord.endDate ? `${foundRecord.startDate} ${localizedCopyRef.current.language === 'zh-CN' ? '至' : 'to'} ${foundRecord.endDate}` : (localizedCopyRef.current.language === 'zh-CN' ? '未知' : 'Unknown'),
            initialCapital: safeNumber(foundRecord.initialCapital) ?? Number.NaN,
            startDate: foundRecord.startDate || '',
            endDate: foundRecord.endDate || '',
            dataMode: (foundRecord.parameters as any)?.dataMode || '',
            dataModeDisplay: (foundRecord.parameters as any)?.dataModeDisplay || '',
            dataSource: (foundRecord.parameters as any)?.dataSource || '',
          },
          createdAt: foundRecord.createdAt
        };

        if (result.status === 'running') {
          setBacktestResult(null);
          setError(localizedCopyRef.current.language === 'zh-CN'
            ? '该历史会话仍在运行，完成后才会生成验证报告。'
            : 'This historical session is still running. A validation report will be available after completion.');
          return;
        }
        if (result.success === false) {
          setBacktestResult(null);
          setError(localizedCopyRef.current.language === 'zh-CN'
            ? '该历史会话标记为失败，没有可验证的结果报告。'
            : 'This historical session is marked as failed and has no verified report.');
          message.error(localizedCopyRef.current.language === 'zh-CN' ? '该历史回测未完成' : 'Historical backtest not completed');
          return;
        }
        if (!hasDisplayableBacktestResults(result.results)) {
          setBacktestResult(null);
          setError(localizedCopyRef.current.language === 'zh-CN'
            ? '该历史会话没有可展示的绩效、曲线或交易记录。'
            : 'This historical session has no displayable metrics, curves, or trades.');
          return;
        }
        setError('');
        setBacktestResult(result);
        setTimeout(() => {
          resultsRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
        message.success(localizedCopyRef.current.language === 'zh-CN' ? `已加载回测：${foundRecord.symbol} - ${foundRecord.strategy}` : `Loaded backtest: ${foundRecord.symbol} - ${foundRecord.strategy}`);
      } else if (record.backtestId && !record.backtestId.startsWith('local_')) {
        loadBacktestResult(record.backtestId);
      } else {
        message.warning(localizedCopyRef.current.language === 'zh-CN' ? '本地存储中未找到回测数据' : 'Backtest data not found in local storage');
      }
    } catch (err) {
      console.error('Error viewing backtest:', err);
      setBacktestResult(null);
      setError(formatBacktestError(
        err,
        localizedCopyRef.current.language,
        localizedCopyRef.current.language === 'zh-CN'
          ? '无法载入该历史会话，请稍后重试。'
          : 'The historical session could not be loaded. Please try again.',
      ));
      message.error(localizedCopyRef.current.language === 'zh-CN' ? '加载回测结果失败' : 'Failed to load backtest results');
    }
  }, [accountHistoryKey, loadBacktestResult]);

  // 从URL参数或location state获取symbol
  useEffect(() => {
    if (symbolFromUrl) {
      const normalizedSymbol = symbolFromUrl.toUpperCase();
      form.setFieldsValue({
        symbol: normalizedSymbol,
        strategy: 'moving_average',
        dateRange: defaultDateRange(),
        initialCapital: 100000,
        ...strategyDefaults.moving_average
      });
      setSelectedStrategy('moving_average');
      setPortfolioSymbols(splitSymbols(normalizedSymbol));
    }

    // 从location state获取symbol（从Market页面跳转时）
    if (navigationSymbol) {
      const strategy = navigationStrategy || 'moving_average';
      const normalizedSymbol = String(navigationSymbol).toUpperCase();
      const formValues: any = {
        symbol: normalizedSymbol,
        strategy: strategy,
        dateRange: defaultDateRange(),
        initialCapital: navigationInitialCapital || 100000,
        ...(strategyDefaults[strategy] || {})
      };
      
      // 如果是从Optimization页面跳转，设置最佳参数
      if (navigationFromOptimization && navigationParameters) {
        if (strategy === 'moving_average') {
          formValues.shortMaPeriod = navigationParameters.shortMaPeriod;
          formValues.longMaPeriod = navigationParameters.longMaPeriod;
        }
      }
      
      form.setFieldsValue(formValues);
      setSelectedStrategy(strategy);
      setPortfolioSymbols(splitSymbols(normalizedSymbol));
    } else if (!symbolFromUrl) {
      // 设置默认值
      form.setFieldsValue({
        dateRange: defaultDateRange(),
        initialCapital: 100000,
        strategy: 'moving_average',
        ...strategyDefaults.moving_average
      });
      setSelectedStrategy('moving_average');
      setPortfolioSymbols([]);
    }
  }, [form, navigationFromOptimization, navigationInitialCapital, navigationParameters, navigationStrategy, navigationSymbol, symbolFromUrl]);

  useEffect(() => {
    void fetchBacktestHistory();
  }, [fetchBacktestHistory]);

  // 处理从 Strategy Ranking 或其他页面传递过来的 backtestId 或 selectedBacktest
  useEffect(() => {
    let targetBacktest: any = null;
    let targetBacktestId: string | null = null;

    if (location.state) {
      targetBacktest = location.state.selectedBacktest;
      targetBacktestId = location.state.selectedBacktestId;
    }

    // Fallback to sessionStorage
    if (!targetBacktest) {
      const saved = sessionStorage.getItem('selectedBacktestForView');
      if (saved) {
        try {
          targetBacktest = JSON.parse(saved);
          console.log('Using sessionStorage fallback for backtest:', targetBacktest);
          // Clear it after use to avoid persistent showing on every visit to Backtest page
          sessionStorage.removeItem('selectedBacktestForView');
        } catch (e) {
          console.error('Failed to parse selectedBacktestForView from sessionStorage', e);
        }
      }
    }
    
    if (targetBacktest) {
      console.log('Received backtest record for view:', targetBacktest);
      
      // 如果有完整的 selectedBacktest，直接构造 BacktestResult 并显示
      const historyResults = targetBacktest.results || {};
      const backtestResult: BacktestResult = {
        backtestId: targetBacktest.backtestId,
        status: (targetBacktest.status || 'unknown') as BacktestResult['status'],
        success: targetBacktest.status === 'failed' || targetBacktest.success === false
          ? false
          : targetBacktest.status === 'completed' || targetBacktest.success === true
            ? true
            : undefined,
        results: {
          totalReturn: safeNumber(historyResults.totalReturn ?? targetBacktest.totalReturn) ?? undefined,
          sharpeRatio: safeNumber(historyResults.sharpeRatio ?? targetBacktest.sharpeRatio) ?? undefined,
          maxDrawdown: safeNumber(historyResults.maxDrawdown ?? targetBacktest.maxDrawdown) ?? undefined,
          winRate: safeNumber(historyResults.winRate ?? targetBacktest.winRate) ?? undefined,
          trades: safeNumber(historyResults.trades ?? targetBacktest.trades) ?? undefined,
          annualizedReturn: safeNumber(historyResults.annualizedReturn ?? targetBacktest.annualizedReturn) ?? undefined,
          profitLoss: safeNumber(historyResults.profitLoss ?? targetBacktest.profitLoss) ?? undefined,
          chartData: historyResults.chartData || [],
          equityCurve: historyResults.equityCurve || [],
          tradesList: historyResults.tradesList || [],
          volatility: safeNumber(historyResults.volatility) ?? undefined,
          sortinoRatio: safeNumber(historyResults.sortinoRatio) ?? undefined,
          profitFactor: safeNumber(historyResults.profitFactor) ?? undefined,
          calmarRatio: safeNumber(historyResults.calmarRatio) ?? undefined,
        },
        parameters: targetBacktest.parameters || {
          strategy: targetBacktest.strategy || '',
          symbols: targetBacktest.symbol ? [targetBacktest.symbol] : [],
          period: targetBacktest.period || '',
          initialCapital: safeNumber(targetBacktest.initialCapital) ?? Number.NaN,
          startDate: targetBacktest.startDate || '',
          endDate: targetBacktest.endDate || '',
        },
        createdAt: targetBacktest.createdAt
      };

      if (backtestResult.status === 'running') {
        setBacktestResult(null);
        setError(localizedCopyRef.current.language === 'zh-CN'
          ? '该历史会话仍在运行，完成后才会生成验证报告。'
          : 'This historical session is still running. A validation report will be available after completion.');
      } else if (backtestResult.success === false) {
        setBacktestResult(null);
        setError(localizedCopyRef.current.language === 'zh-CN'
          ? '该历史会话标记为失败，没有可验证的结果报告。'
          : 'This historical session is marked as failed and has no verified report.');
      } else if (!hasDisplayableBacktestResults(backtestResult.results)) {
        setBacktestResult(null);
        setError(localizedCopyRef.current.language === 'zh-CN'
          ? '该历史会话没有可展示的绩效、曲线或交易记录。'
          : 'This historical session has no displayable metrics, curves, or trades.');
      } else {
        setError('');
        setBacktestResult(backtestResult);
      }
      
      // 填充表单参数
      const strategy = backtestResult.parameters.strategy || 'moving_average';
      form.setFieldsValue({
        ...(backtestResult.parameters || {}),
        symbol: (backtestResult.parameters.symbols?.[0] || backtestResult.parameters.symbol || '').toUpperCase(),
        strategy: strategy,
        initialCapital: backtestResult.parameters.initialCapital || 100000,
      });
      setSelectedStrategy(strategy);
      setPortfolioSymbols(backtestResult.parameters.symbols?.length
        ? backtestResult.parameters.symbols.map(symbol => String(symbol).toUpperCase())
        : splitSymbols(backtestResult.parameters.symbol));

      // 滚动到结果区域
      if (
        backtestResult.status !== 'running'
        && backtestResult.success !== false
        && hasDisplayableBacktestResults(backtestResult.results)
      ) {
        setTimeout(() => {
          resultsRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 300);
      }
    } else if (targetBacktestId) {
      console.log('Received selectedBacktestId from navigation state:', targetBacktestId);
      // 如果只有 ID，尝试加载
      const localHistory = loadLocalBacktestHistory(accountHistoryKey);
      const found = localHistory.find(item => item.backtestId === targetBacktestId);
      if (found) {
        handleViewBacktest(found);
      } else {
        loadBacktestResult(targetBacktestId);
      }
    }
  }, [accountHistoryKey, form, handleViewBacktest, loadBacktestResult, location.state]);

  // 生成唯一的请求ID
  const generateRequestId = () => {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  const safeToFixed = (value: unknown, decimals: number = 2): string => {
    const numValue = safeNumber(value);
    return numValue === null ? t.common.na : numValue.toFixed(decimals);
  };

  const formatDrawdown = (value: unknown, decimals: number = 2): string => {
    const numericValue = safeNumber(value);
    if (numericValue === null) return t.common.na;
    const magnitude = Math.abs(numericValue).toFixed(decimals);
    return numericValue === 0 ? `${magnitude}%` : `-${magnitude}%`;
  };

  const formatCurrency = (value: unknown): string => {
    const safeValue = safeNumber(value);
    if (safeValue === null) return t.common.na;
    const absValue = Math.abs(safeValue);
    const prefix = safeValue > 0 ? '+$' : safeValue < 0 ? '-$' : '$';

    if (absValue >= 1e9) {
      return `${prefix}${safeToFixed(absValue / 1e9, 2)}B`;
    } else if (absValue >= 1e6) {
      return `${prefix}${safeToFixed(absValue / 1e6, 2)}M`;
    } else if (absValue >= 1e3) {
      return `${prefix}${safeToFixed(absValue / 1e3, 2)}K`;
    }
    return `${prefix}${safeToFixed(absValue, 2)}`;
  };

  // 删除本地回测历史记录
  const deleteLocalBacktestHistory = (backtestId: string) => {
    try {
      const currentHistory = loadLocalBacktestHistory(accountHistoryKey);
      const updatedHistory = currentHistory.filter(item => item.backtestId !== backtestId);
      saveLocalBacktestHistory(accountHistoryKey, updatedHistory);
      setBacktestHistory(updatedHistory);
      
      // 如果删除的是当前选中的backtest，清空选中状态
      if (selectedBacktests.includes(backtestId)) {
        setSelectedBacktests(selectedBacktests.filter(id => id !== backtestId));
      }
      
      // 如果删除的是当前查看的backtest，清空结果
      if (backtestResult?.backtestId === backtestId) {
        setBacktestResult(null);
      }
      
      return true;
    } catch (err) {
      console.error('Failed to delete local backtest history:', err);
      return false;
    }
  };

  // 添加回测结果到历史记录
  const addToBacktestHistory = (backtestResult: BacktestResult) => {
    try {
      const currentHistory = loadLocalBacktestHistory(accountHistoryKey);

      // 创建历史记录项
      const symbol = backtestResult.parameters?.symbols?.[0] || 'N/A';
      const strategy = backtestResult.parameters?.strategy || 'N/A';
      const startDate = backtestResult.parameters?.startDate || '';
      const endDate = backtestResult.parameters?.endDate || '';

      const historyItem: BacktestHistoryItem = {
        backtestId: backtestResult.backtestId || `local_${Date.now()}`,
        status: backtestResult.success === true
          ? 'completed'
          : backtestResult.success === false
            ? 'failed'
            : backtestResult.status || 'unknown',
        results: backtestResult.results,
        parameters: backtestResult.parameters,
        createdAt: new Date().toISOString(),
        // 平铺字段用于表格显示
        symbol: symbol,
        strategy: strategy,
        startDate: startDate,
        endDate: endDate,
        initialCapital: safeNumber(backtestResult.parameters?.initialCapital) ?? undefined,
        totalReturn: safeNumber(backtestResult.results?.totalReturn) ?? undefined,
        sharpeRatio: safeNumber(backtestResult.results?.sharpeRatio) ?? undefined,
        maxDrawdown: safeNumber(backtestResult.results?.maxDrawdown) ?? undefined,
        winRate: safeNumber(backtestResult.results?.winRate) ?? undefined,
        trades: safeNumber(backtestResult.results?.trades) ?? undefined,
        annualizedReturn: safeNumber(backtestResult.results?.annualizedReturn) ?? undefined,
        profitLoss: safeNumber(backtestResult.results?.profitLoss) ?? undefined,
      };

      // 添加到历史记录开头（最新在最前面）
      const updatedHistory = [historyItem, ...currentHistory];

      // 保存到本地存储
      saveLocalBacktestHistory(accountHistoryKey, updatedHistory);

      // 更新状态
      setBacktestHistory(updatedHistory);

      console.log('Added backtest to history:', historyItem);
      return historyItem;
    } catch (err) {
      console.error('Failed to add backtest to history:', err);
      return null;
    }
  };

  const persistSavedStrategies = useCallback((strategies: any[]): Promise<void> => {
    if (!user?.id) return Promise.reject(new Error('No authenticated account'));
    const storageKey = savedStrategiesStorageKey(user.id);
    const mutate = async () => {
      try {
        const artifact = await operationsArtifactsAPI.put(
          'strategy-blueprints',
          'saved',
          { strategies },
          savedStrategiesVersionRef.current,
        );
        if (artifact) savedStrategiesVersionRef.current = artifact.version;
        localStorage.setItem(storageKey, JSON.stringify(strategies));
      } catch (err) {
        if (isOperationsArtifactConflict(err)) {
          const latest = await operationsArtifactsAPI.get<{ strategies?: any[] }>('strategy-blueprints', 'saved');
          savedStrategiesVersionRef.current = latest?.version;
          throw new Error('Saved plans changed in another tab or device. Reload the page before trying again.');
        }
        throw err;
      }
    };
    const queued = savedStrategiesMutationRef.current.then(mutate);
    savedStrategiesMutationRef.current = queued.catch(() => undefined);
    return queued;
  }, [user?.id]);

  // 加载已保存的策略。服务端副本优先；浏览器缓存保留为离线回退。
  useEffect(() => {
    if (!user?.id) {
      savedStrategiesVersionRef.current = undefined;
      savedStrategiesMutationRef.current = Promise.resolve();
      setSavedStrategies([]);
      return undefined;
    }

    let active = true;
    const loadSavedStrategies = async () => {
      const storageKey = savedStrategiesStorageKey(user.id);
      let localStrategies: any[] = [];
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) localStrategies = parsed;
        }
      } catch (err) {
        console.error('Failed to load saved strategies:', err);
      }
      try {
        const artifact = await operationsArtifactsAPI.get<{ strategies?: any[] }>('strategy-blueprints', 'saved');
        if (!active) return;
        if (artifact) savedStrategiesVersionRef.current = artifact.version;
        const remote = artifact?.payload?.strategies;
        const resolved = Array.isArray(remote) ? remote : localStrategies;
        setSavedStrategies(resolved);
        localStorage.setItem(storageKey, JSON.stringify(resolved));
        if (!artifact && localStrategies.length > 0) await persistSavedStrategies(localStrategies);
      } catch (err) {
        if (active) setSavedStrategies(localStrategies);
        console.warn('Saved strategies are using this device cache:', err);
      }
    };
    void loadSavedStrategies();
    return () => { active = false; };
  }, [persistSavedStrategies, user?.id]);

  // 保存策略到localStorage
  const saveCurrentStrategy = async () => {
    try {
      const formValues = form.getFieldsValue();
      if (!formValues.strategy || !formValues.symbol) {
        message.error(language === 'zh-CN' ? '请先填写策略和代码再保存' : 'Please fill in strategy and symbol before saving');
        return;
      }

      const strategyName = prompt(language === 'zh-CN' ? '请输入策略名称：' : 'Enter a name for this strategy:');
      if (!strategyName) return;

      const newStrategy = {
        id: Date.now().toString(),
        name: strategyName,
        strategyType: formValues.strategy,
        createdTime: new Date().toISOString(),
        config: {
          strategy: formValues.strategy,
          symbol: formValues.symbol,
          dateRange: formValues.dateRange,
          initialCapital: formValues.initialCapital,
          // 根据策略类型保存对应的参数
          ...(formValues.strategy === 'moving_average' && {
            shortMaPeriod: formValues.shortMaPeriod,
            longMaPeriod: formValues.longMaPeriod
          }),
          ...(formValues.strategy === 'rsi' && {
            rsiPeriod: formValues.rsiPeriod,
            rsiOversold: formValues.rsiOversold,
            rsiOverbought: formValues.rsiOverbought
          }),
          ...(formValues.strategy === 'macd' && {
            macdFast: formValues.macdFast,
            macdSlow: formValues.macdSlow,
            macdSignal: formValues.macdSignal
          })
        }
      };

      const updatedStrategies = [...savedStrategies, newStrategy];
      await persistSavedStrategies(updatedStrategies);
      setSavedStrategies(updatedStrategies);
      message.success(language === 'zh-CN' ? `策略 "${strategyName}" 保存成功！` : `Strategy "${strategyName}" saved successfully!`);
    } catch (err) {
      console.error('Failed to save strategy:', err);
      message.error(language === 'zh-CN' ? '保存策略失败' : 'Failed to save strategy');
    }
  };

  // 加载策略到表单
  const loadStrategy = (strategy: any) => {
    try {
      const config = strategy.config;
      form.setFieldsValue({
        strategy: config.strategy,
        symbol: config.symbol,
        dateRange: config.dateRange,
        initialCapital: config.initialCapital,
        ...(config.strategy === 'moving_average' && {
          shortMaPeriod: config.shortMaPeriod,
          longMaPeriod: config.longMaPeriod
        }),
        ...(config.strategy === 'rsi' && {
          rsiPeriod: config.rsiPeriod,
          rsiOversold: config.rsiOversold,
          rsiOverbought: config.rsiOverbought
        }),
        ...(config.strategy === 'macd' && {
          macdFast: config.macdFast,
          macdSlow: config.macdSlow,
          macdSignal: config.macdSignal
        })
      });
      setSelectedStrategy(config.strategy || 'moving_average');
      setPortfolioSymbols(splitSymbols(config.symbol));
      message.success(language === 'zh-CN' ? `策略 "${strategy.name}" 加载成功！` : `Strategy "${strategy.name}" loaded successfully!`);
    } catch (err) {
      console.error('Failed to load strategy:', err);
      message.error(language === 'zh-CN' ? '加载策略失败' : 'Failed to load strategy');
    }
  };

  // 删除策略
  const deleteStrategy = async (id: string) => {
    try {
      const updatedStrategies = savedStrategies.filter(s => s.id !== id);
      await persistSavedStrategies(updatedStrategies);
      setSavedStrategies(updatedStrategies);
      message.success(language === 'zh-CN' ? '策略已删除！' : 'Strategy deleted successfully!');
    } catch (err) {
      console.error('Failed to delete strategy:', err);
      message.error(language === 'zh-CN' ? '删除策略失败' : 'Failed to delete strategy');
    }
  };

  // 解析 symbol 并更新 portfolio 状态
  const parseSymbols = (symbolInput: string) => {
    const symbols = splitSymbols(symbolInput);
    setPortfolioSymbols(symbols);
    return symbols;
  };

  const loadQuickBlueprint = (symbol: string, strategy: 'rsi' | 'momentum') => {
    form.setFieldsValue({
      symbol,
      strategy,
      initialCapital: 100000,
      dateRange: defaultDateRange(),
      ...strategyDefaults[strategy],
    });
    setSelectedStrategy(strategy);
    setPortfolioSymbols([symbol]);
    message.info(strategy === 'rsi' ? t.backtest.msftLoaded : t.backtest.tslaLoaded);
  };

  const handleRunBacktest = async (values: BacktestFormValues) => {
    // 生成请求ID
    const requestId = generateRequestId();
    requestIdRef.current = requestId;

    // 清理状态
    setBacktestResult(null);
    setError('');
    setLoading(true);

    try {
      // 清理symbol输入
      const cleanedSymbolInput = values.symbol.trim();
      if (!cleanedSymbolInput) {
        setError(language === 'zh-CN' ? '请输入股票代码或公司名。' : 'Enter a stock symbol or company name.');
        setLoading(false);
        return;
      }

      // 解析多个 symbol，支持逗号分隔
      const symbols = parseSymbols(cleanedSymbolInput);

      // 检查解析结果
      console.log('Parsed symbols:', symbols);

      if (symbols.length === 0) {
        setError(language === 'zh-CN' ? '请输入有效的股票代码或公司名。' : 'Enter a valid stock symbol or company name.');
        setLoading(false);
        return;
      }

      // 保持向后兼容：如果只有一个symbol，使用原来的逻辑
      const symbol = symbols.length === 1 ? symbols[0] : symbols.join(',');
      const strategy = values.strategy;

      // 构建基础配置 - 升级为 symbols 数组，同时保留 symbol 字段向后兼容
      const config: any = {
        strategy: strategy,
        startDate: values.dateRange[0].format('YYYY-MM-DD'),
        endDate: values.dateRange[1].format('YYYY-MM-DD'),
        initialCapital: values.initialCapital,
        symbols: symbols, // 新增：发送 symbols 数组
        dataMode: 'real', // 固定使用真实数据
      };

      // 保持向后兼容：如果只有一个 symbol，同时设置 symbol 字段
      if (symbols.length === 1) {
        config.symbol = symbols[0]; // 单股票模式保留 symbol 字段
      } else {
        config.symbol = symbol; // 多股票模式：symbol 字段为逗号分隔的字符串
      }

      // 根据策略类型添加对应的参数
      if (strategy === 'moving_average') {
        config.parameters = {
          shortMaPeriod: values.shortMaPeriod || 20,
          longMaPeriod: values.longMaPeriod || 50,
        };
      } else if (strategy === 'rsi') {
        // RSI 策略参数（预留结构，后端暂未实现）
        config.parameters = {
          rsiPeriod: values.rsiPeriod || 14,
          rsiOversold: values.rsiOversold || 30,
          rsiOverbought: values.rsiOverbought || 70,
        };
      } else if (strategy === 'macd') {
        // MACD 策略参数（预留结构，后端暂未实现）
        config.parameters = {
          macdFast: values.macdFast || 12,
          macdSlow: values.macdSlow || 26,
          macdSignal: values.macdSignal || 9,
        };
      } else if (strategy === 'bollinger') {
        // Bollinger Bands 策略参数
        config.parameters = {
          bollingerPeriod: (values as any).bollingerPeriod || 20,
          bollingerStdDev: (values as any).bollingerStdDev || 2,
        };
      } else if (strategy === 'momentum') {
        // Momentum 策略参数
        config.parameters = {
          momentumPeriod: (values as any).momentumPeriod || 10,
        };
      } else if (strategy === 'mean_reversion') {
        config.parameters = {
          lookbackPeriod: (values as any).lookbackPeriod || 20,
          entryZScore: (values as any).entryZScore ?? -2.0,
          exitZScore: (values as any).exitZScore ?? 0.0,
          stopLossPct: ((values as any).stopLossPct || 6) / 100,
          takeProfitPct: ((values as any).takeProfitPct || 8) / 100,
          rsiPeriod: (values as any).rsiPeriod || 14,
          oversoldLevel: (values as any).oversoldLevel || 30,
          enableTrendFilter: (values as any).enableTrendFilter !== false,
          trendMaPeriod: (values as any).trendMaPeriod || 100,
        };
      } else if (strategy === 'donchian_breakout') {
        config.parameters = {
          entryPeriod: (values as any).entryPeriod || 20,
          exitPeriod: (values as any).exitPeriod || 10,
          atrPeriod: (values as any).atrPeriod || 20,
          atrStopMultiple: (values as any).atrStopMultiple || 2.0,
        };
      } else if (strategy === 'keltner_breakout') {
        config.parameters = {
          emaPeriod: (values as any).emaPeriod || 20,
          atrPeriod: (values as any).atrPeriod || 20,
          atrMultiplier: (values as any).atrMultiplier || 2.0,
        };
      } else if (strategy === 'supertrend') {
        config.parameters = {
          atrPeriod: (values as any).atrPeriod || 10,
          multiplier: (values as any).multiplier || 3.0,
        };
      } else if (strategy === 'stochastic') {
        config.parameters = {
          kPeriod: (values as any).kPeriod || 14,
          dPeriod: (values as any).dPeriod || 3,
          oversold: (values as any).oversold || 20,
          overbought: (values as any).overbought || 80,
        };
      } else if (strategy === 'adx_trend') {
        config.parameters = {
          adxPeriod: (values as any).adxPeriod || 14,
          adxThreshold: (values as any).adxThreshold || 25,
          fastEmaPeriod: (values as any).fastEmaPeriod || 20,
          slowEmaPeriod: (values as any).slowEmaPeriod || 50,
        };
      } else {
        // 其他策略暂时不传参数
        config.parameters = {};
      }

      console.log('Running backtest with config:', config);

      const response = await backtraderAPI.runBacktest(config);

      // 检查请求是否已被取消
      if (requestIdRef.current !== requestId) {
        console.log(`回测请求 ${requestId} 已被取消`);
        return;
      }

      let result = response.data;

      if (result) {
        // 检查后端是否同步返回完整结果（主要检查result.results字段）
        if (result.result?.results) {
          // 后端已同步返回完整结果，直接使用
          // 合并result.result和success/status字段
          const resolvedSuccess = result.success === true
            ? true
            : result.success === false
              ? false
            : result.status
              ? result.status === 'completed'
              : undefined;
          const mergedResult = {
            ...result.result,
            success: resolvedSuccess,
          };
          const runFailed = mergedResult.success === false
            || result.status === 'failed'
            || mergedResult.status === 'failed';
          const hasResults = hasDisplayableBacktestResults(mergedResult.results);
          if (runFailed || !hasResults) {
            setBacktestResult(null);
            const fallback = runFailed
              ? (language === 'zh-CN'
                ? '回测失败，请检查参数与数据窗口后重试。'
                : 'The backtest failed. Review the parameters and data window, then try again.')
              : (language === 'zh-CN'
                ? '回测已结束，但没有返回可展示的绩效、曲线或交易记录。'
                : 'The backtest finished without displayable metrics, curves, or trades.');
            setError(formatBacktestError(result.result?.error || result.error, language, fallback));
          } else {
            setBacktestResult(mergedResult);
          }
          setLoading(false);

          // Only report success when the run is both successful and contains
          // usable output. A nominal "completed" status with an empty/failed
          // payload is not a successful backtest.
          if (!runFailed && hasResults && result.status === 'completed') {
            message.success(t.backtest.backtestCompleted);
          } else if (runFailed || !hasResults || result.status === 'failed') {
            message.error(language === 'zh-CN' ? '回测失败，请检查参数后重试。' : 'Backtest failed. Please check parameters and try again.');
          } else if (result.status) {
            message.info(language === 'zh-CN' ? `回测状态：${result.status}` : `Backtest status: ${result.status}`);
          } else {
            message.info(language === 'zh-CN' ? '回测结果已返回，完成状态未提供。' : 'Backtest results returned without a completion status.');
          }

          // 滚动到结果区域
          if (!runFailed && hasResults) {
            setTimeout(() => {
              resultsRef.current?.scrollIntoView({ behavior: 'smooth' });
            }, 100);
          }

          // Never persist an empty or failed payload as a completed historical
          // report. Doing so would make later views look successfully verified.
          if (!runFailed && hasResults) addToBacktestHistory(mergedResult);

          // 刷新历史记录
          fetchBacktestHistory();
        } else if (result.backtestId) {
          // 兼容旧版本
          setBacktestResult(null);
          setError(language === 'zh-CN' ? '回测已启动但结果暂不可用，请稍后重试。' : 'Backtest started but results not available immediately. Please try again.');
          message.error(language === 'zh-CN' ? '回测响应不完整' : 'Backtest response incomplete');
          setLoading(false);
        } else {
          setBacktestResult(null);
          setError(language === 'zh-CN' ? '启动回测失败：响应格式无效' : 'Failed to start backtest: Invalid response format');
          message.error(t.backtest.backtestFailed);
          setLoading(false);
        }
      } else {
        setBacktestResult(null);
        setError(language === 'zh-CN' ? '启动回测失败：无响应数据' : 'Failed to start backtest: No response data');
        message.error(t.backtest.backtestFailed);
        setLoading(false);
      }
    } catch (err: any) {
      // 检查请求是否已被取消
      if (requestIdRef.current !== requestId) {
        console.log(`回测请求 ${requestId} 已被取消，忽略错误`);
        return;
      }

      setBacktestResult(null);
      setError(formatBacktestError(
        err,
        language,
        language === 'zh-CN' ? '回测运行失败，请稍后重试。' : 'The backtest run failed. Try again shortly.',
      ));
      message.error(language === 'zh-CN' ? '回测运行失败' : 'Failed to run backtest');
      console.error('Backtest error:', err);
      setLoading(false);
    }
  };

  // 查看历史回测结果
  const handleCompareSelected = () => {
    if (selectedBacktests.length < 2) {
      message.warning(language === 'zh-CN' ? '请至少选择 2 个回测会话进行对比。' : 'Please select at least 2 backtest sessions to compare.');
      return;
    }
    
    const backtestsToCompare = backtestHistory
      .filter(item => selectedBacktests.includes(item.backtestId))
      .map(item => ({
        ...item,
        parameters: {
          ...item.parameters,
          symbol: item.symbol || (item.parameters && item.parameters.symbols ? item.parameters.symbols[0] : 'N/A'),
          strategy: item.strategy || (item.parameters ? item.parameters.strategy : 'Unknown'),
          startDate: item.startDate || (item.parameters ? item.parameters.startDate : ''),
          endDate: item.endDate || (item.parameters ? item.parameters.endDate : ''),
          initialCapital: item.initialCapital || (item.parameters ? item.parameters.initialCapital : 100000),
        }
      }));
    
    // Save to sessionStorage as fallback
    sessionStorage.setItem('compareBacktests', JSON.stringify(backtestsToCompare));
    
    navigate('/compare', { state: { selectedBacktests: backtestsToCompare } });
  };

  const strategyOptions = [
    { value: 'buy_hold', label: t.backtest.strategyBuyHold },
    { value: 'moving_average', label: t.backtest.strategyMovingAverage },
    { value: 'rsi', label: t.backtest.strategyRsi },
    { value: 'macd', label: t.backtest.strategyMacd },
    { value: 'bollinger', label: t.backtest.strategyBollinger },
    { value: 'momentum', label: t.backtest.strategyMomentum },
    { value: 'mean_reversion', label: t.backtest.strategyMeanReversion },
    { value: 'donchian_breakout', label: t.backtest.strategyDonchianBreakout },
    { value: 'keltner_breakout', label: t.backtest.strategyKeltnerBreakout },
    { value: 'supertrend', label: t.backtest.strategySupertrend },
    { value: 'stochastic', label: t.backtest.strategyStochastic },
    { value: 'adx_trend', label: t.backtest.strategyAdxTrend },
  ];

  const resultColumns = [
    {
      title: language === 'zh-CN' ? '指标' : 'Metric',
      dataIndex: 'metric',
      key: 'metric',
      width: 150,
    },
    {
      title: language === 'zh-CN' ? '数值' : 'Value',
      dataIndex: 'value',
      key: 'value',
      render: (value: any, record: any) => {
        // Handle non-numeric values for specific metrics
        if (record.key === 'strategy' || record.key === 'dataMode' || record.key === 'dataSource' || record.key === 'status') {
          if (record.key === 'status') {
            const statusColors: Record<string, string> = {
              'running': 'blue',
              'completed': 'green',
              'failed': 'red'
            };
            const statusLabels: Record<string, string> = {
              'running': t.backtest.running,
              'completed': t.backtest.completed,
              'failed': t.backtest.failed,
              'unknown': t.backtest.unknown
            };
            const statusValue = value || 'unknown';
            return <Tag color={statusColors[statusValue] || 'default'}>{statusLabels[statusValue] || statusValue}</Tag>;
          } else {
            // Strategy, Data Mode, Data Source
            return <span style={{ fontWeight: 'bold' }}>{value || (language === 'zh-CN' ? '未知' : 'Unknown')}</span>;
          }
        }

        // For numeric metrics, use safeNumber
        const safeValue = safeNumber(value);
        if (safeValue === null) {
          return <span style={{ color: 'var(--app-text-muted)' }}>{t.common.na}</span>;
        }

        if (record.key === 'profitLoss') {
          // Profit/Loss 是金额，使用货币格式
          const color = safeValue > 0 ? '#3f8600' : safeValue < 0 ? '#cf1322' : 'var(--bt-ink)';
          const formatted = formatCurrency(safeValue);
          return <span style={{ color, fontWeight: 'bold' }}>{formatted}</span>;
        } else if (record.key === 'totalReturn' || record.key === 'annualizedReturn') {
          // Return 类指标使用百分比格式
          const color = safeValue > 0 ? '#3f8600' : safeValue < 0 ? '#cf1322' : 'var(--bt-ink)';
          const prefix = safeValue > 0 ? '+' : '';
          return <span style={{ color, fontWeight: 'bold' }}>{prefix}{safeToFixed(safeValue, 2)}%</span>;
        } else if (record.key === 'expectancy') {
          const color = safeValue > 0 ? '#3f8600' : safeValue < 0 ? '#cf1322' : 'var(--bt-ink)';
          const prefix = safeValue > 0 ? '+$' : safeValue < 0 ? '-$' : '$';
          const absValue = Math.abs(safeValue);
          return <span style={{ color, fontWeight: 'bold' }}>{prefix}{safeToFixed(absValue, 2)}</span>;
        } else if (record.key === 'volatility') {
          const color = safeValue < 20 ? '#3f8600' : safeValue < 40 ? '#faad14' : '#cf1322';
          return <span style={{ color, fontWeight: 'bold' }}>{safeToFixed(safeValue, 2)}%</span>;
        } else if (record.key === 'exposure') {
          const color = safeValue > 80 ? '#3f8600' : safeValue > 50 ? '#faad14' : '#cf1322';
          return <span style={{ color, fontWeight: 'bold' }}>{safeToFixed(safeValue, 1)}%</span>;
        } else if (record.key === 'sharpeRatio' || record.key === 'calmarRatio' || record.key === 'sortinoRatio' || record.key === 'profitFactor') {
          const color = safeValue >= 1 ? '#3f8600' : safeValue >= 0 ? '#faad14' : '#cf1322';
          return <span style={{ color, fontWeight: 'bold' }}>{safeToFixed(safeValue, 2)}</span>;
        } else if (record.key === 'maxDrawdown') {
          return <span style={{ color: Math.abs(safeValue) > 0 ? '#cf1322' : 'var(--bt-ink)', fontWeight: 'bold' }}>{formatDrawdown(safeValue, 2)}</span>;
        } else if (record.key === 'winRate') {
          const color = safeValue >= 60 ? '#3f8600' : safeValue >= 40 ? '#faad14' : '#cf1322';
          return <span style={{ color, fontWeight: 'bold' }}>{safeToFixed(safeValue, 1)}%</span>;
        } else if (record.key === 'trades') {
          return <span style={{ fontWeight: 'bold' }}>{Math.round(safeValue)}</span>;
        }
        return safeToFixed(safeValue, 2);
      },
    },
    {
      title: language === 'zh-CN' ? '说明' : 'Description',
      dataIndex: 'description',
      key: 'description',
    },
  ];

  const historyColumns = [
    {
      title: t.backtest.select,
      key: 'selection',
      width: 52,
      render: (_: any, record: BacktestHistoryItem) => (
        <Checkbox
          checked={selectedBacktests.includes(record.backtestId)}
          onChange={(e) => {
            if (e.target.checked) {
              setSelectedBacktests([...selectedBacktests, record.backtestId]);
            } else {
              setSelectedBacktests(selectedBacktests.filter(id => id !== record.backtestId));
            }
          }}
        />
      ),
    },
    {
      title: t.backtest.symbolCol,
      dataIndex: 'symbol',
      key: 'symbol',
      width: 80,
      render: (symbol: string) => <strong style={{ fontSize: '13px' }}>{symbol || 'N/A'}</strong>,
    },
    {
      title: t.backtest.strategyCol,
      dataIndex: 'strategy',
      key: 'strategy',
      width: 130,
      render: (strategy: string) => {
        const strategyNames: Record<string, string> = {
          'buy_hold': t.backtest.strategyBuyHold,
          'moving_average': t.backtest.strategyMovingAverage,
          'rsi': t.backtest.strategyRsi,
          'macd': t.backtest.strategyMacd,
          'bollinger': t.backtest.strategyBollinger,
          'momentum': t.backtest.strategyMomentum,
          'mean_reversion': t.backtest.strategyMeanReversion,
          'donchian_breakout': t.backtest.strategyDonchianBreakout,
          'keltner_breakout': t.backtest.strategyKeltnerBreakout,
          'supertrend': t.backtest.strategySupertrend,
          'stochastic': t.backtest.strategyStochastic,
          'adx_trend': t.backtest.strategyAdxTrend,
        };
        const displayName = strategyNames[strategy] || strategy || 'N/A';
        return <span style={{ fontSize: '12px' }}>{displayName}</span>;
      },
    },
    {
      title: t.backtest.periodCol,
      dataIndex: 'startDate',
      key: 'period',
      width: 100,
      render: (startDate: string, record: BacktestHistoryItem) => {
        if (!startDate || !record.endDate) return <span style={{ color: '#999', fontSize: '11px' }}>{t.common.na}</span>;
        try {
          const start = new Date(startDate);
          const end = new Date(record.endDate);
          const startStr = `${start.getMonth() + 1}/${start.getDate()}`;
          const endStr = `${end.getMonth() + 1}/${end.getDate()}`;
          return <span style={{ fontSize: '11px' }}>{startStr} - {endStr}</span>;
        } catch {
          return <span style={{ color: '#999', fontSize: '11px' }}>{language === 'zh-CN' ? '无效' : 'Invalid'}</span>;
        }
      },
    },
    {
      title: t.backtest.returnCol,
      dataIndex: 'totalReturn',
      key: 'totalReturn',
      width: 90,
      align: 'right' as const,
      render: (value: number) => {
        const safeValue = safeNumber(value);
        if (safeValue === null || safeValue === undefined) return <span style={{ color: '#999' }}>--</span>;
        const color = safeValue > 0 ? '#3f8600' : safeValue < 0 ? '#cf1322' : 'var(--bt-ink)';
        return <span style={{ color, fontWeight: 'bold', fontSize: '12px' }}>
          {safeValue > 0 ? '+' : ''}{safeToFixed(safeValue, 2)}%
        </span>;
      },
    },
    {
      title: t.backtest.sharpeCol,
      dataIndex: 'sharpeRatio',
      key: 'sharpeRatio',
      width: 80,
      align: 'right' as const,
      render: (value: number) => {
        const safeValue = safeNumber(value);
        if (safeValue === null || safeValue === undefined) return <span style={{ color: '#999' }}>--</span>;
        const color = safeValue >= 1 ? '#3f8600' : safeValue >= 0 ? '#faad14' : '#cf1322';
        return <span style={{ color, fontSize: '12px' }}>{safeToFixed(safeValue, 2)}</span>;
      },
    },
    {
      title: t.backtest.statusCol,
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (status: string) => {
        const statusColors: Record<string, string> = {
          'running': 'blue',
          'completed': 'green',
          'failed': 'red'
        };
        const statusLabels: Record<string, string> = {
          'running': t.backtest.running,
          'completed': t.backtest.completed,
          'failed': t.backtest.failed,
          'unknown': t.backtest.unknown
        };
        const displayStatus = status || 'unknown';
        return <Tag
          color={statusColors[displayStatus] || 'default'}
          style={{ fontSize: '11px', padding: '1px 6px' }}
        >
          {statusLabels[displayStatus] || displayStatus}
        </Tag>;
      },
    },
    {
      title: language === 'zh-CN' ? '日期' : 'Date',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 90,
      render: (date: string) => {
        if (!date) return <span style={{ color: '#999', fontSize: '11px' }}>{t.common.na}</span>;
        try {
          const d = new Date(date);
          return <span style={{ fontSize: '11px' }}>
            {d.toLocaleDateString(language === 'zh-CN' ? 'zh-CN' : 'en-US', { month: 'short', day: 'numeric' })}
          </span>;
        } catch {
          return <span style={{ color: '#999', fontSize: '11px' }}>{language === 'zh-CN' ? '无效' : 'Invalid'}</span>;
        }
      },
    },
    {
      title: t.backtest.actionsCol,
      key: 'actions',
      width: 110,
      render: (_: any, record: BacktestHistoryItem) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/backtest/${encodeURIComponent(record.backtestId)}?tab=overview`)}
            disabled={!record.backtestId}
            style={{ fontSize: '11px', padding: '0 4px' }}
          >
            {language === 'zh-CN' ? '查看' : 'View'}
          </Button>
          <Button
            type="link"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => {
              Modal.confirm({
                title: t.backtest.deleteBacktest,
                content: language === 'zh-CN' ? '确定要删除此回测吗？' : 'Are you sure you want to delete this backtest?',
                okText: t.backtest.delete,
                okType: 'danger',
                cancelText: t.common.cancel,
                onOk: async () => {
                  const success = deleteLocalBacktestHistory(record.backtestId);
                  if (success) {
                    message.success(t.backtest.backtestDeleted);
                  } else {
                    message.error(t.backtest.backtestDeleteFailed);
                  }
                },
              });
            }}
            style={{ fontSize: '11px', padding: '0 4px' }}
          >
            {t.backtest.delete}
          </Button>
        </Space>
      ),
    },
  ];

  // Strategy name mapping
  const strategyNames: Record<string, string> = {
    'buy_hold': t.backtest.strategyBuyHold,
    'moving_average': t.backtest.strategyMovingAverage,
    'rsi': t.backtest.strategyRsi,
    'macd': t.backtest.strategyMacd,
    'bollinger': t.backtest.strategyBollinger,
    'momentum': t.backtest.strategyMomentum,
    'mean_reversion': t.backtest.strategyMeanReversion,
    'donchian_breakout': t.backtest.strategyDonchianBreakout,
    'keltner_breakout': t.backtest.strategyKeltnerBreakout,
    'supertrend': t.backtest.strategySupertrend,
    'stochastic': t.backtest.strategyStochastic,
    'adx_trend': t.backtest.strategyAdxTrend
  };

  // Strategy name mapping for blueprint display (shorter names)
  const strategyNameBlueprint: Record<string, string> = {
    'buy_hold': t.backtest.strategyNameBuyHold,
    'moving_average': t.backtest.strategyNameMovingAverage,
    'rsi': t.backtest.strategyNameRsi,
    'macd': t.backtest.strategyNameMacd,
    'bollinger': t.backtest.strategyNameBollinger,
    'momentum': t.backtest.strategyNameMomentum,
    'mean_reversion': t.backtest.strategyNameMeanReversion,
    'donchian_breakout': t.backtest.strategyNameDonchianBreakout,
    'keltner_breakout': t.backtest.strategyNameKeltnerBreakout,
    'supertrend': t.backtest.strategyNameSupertrend,
    'stochastic': t.backtest.strategyNameStochastic,
    'adx_trend': t.backtest.strategyNameAdxTrend
  };

  // Parameter key mapping for blueprint display
  const paramKeyNames: Record<string, string> = {
    'shortMaPeriod': t.backtest.paramShortMaPeriod,
    'longMaPeriod': t.backtest.paramLongMaPeriod,
    'rsiPeriod': t.backtest.paramRsiPeriod,
    'rsiOversold': t.backtest.paramRsiOversold,
    'rsiOverbought': t.backtest.paramRsiOverbought,
    'macdFast': t.backtest.paramMacdFast,
    'macdSlow': t.backtest.paramMacdSlow,
    'macdSignal': t.backtest.paramMacdSignal,
    'bollingerPeriod': t.backtest.paramBollingerPeriod,
    'bollingerStdDev': t.backtest.paramBollingerStdDev,
    'momentumPeriod': t.backtest.paramMomentumPeriod,
    'lookbackPeriod': t.backtest.paramLookbackPeriod,
    'entryZScore': t.backtest.paramEntryZScore,
    'exitZScore': t.backtest.paramExitZScore,
    'stopLossPct': t.backtest.paramStopLossPct,
    'takeProfitPct': t.backtest.paramTakeProfitPct,
    'oversoldLevel': t.backtest.paramOversoldLevel,
    'trendMaPeriod': t.backtest.paramTrendMaPeriod,
    'enableTrendFilter': t.backtest.paramTrendFilter,
    'entryPeriod': t.backtest.paramEntryPeriod,
    'exitPeriod': t.backtest.paramExitPeriod,
    'atrPeriod': t.backtest.paramAtrPeriod,
    'atrStopMultiple': t.backtest.paramAtrStopMultiple,
    'emaPeriod': t.backtest.paramEmaPeriod,
    'atrMultiplier': t.backtest.paramAtrMultiplier,
    'multiplier': t.backtest.paramMultiplier,
    'kPeriod': t.backtest.paramKPeriod,
    'dPeriod': t.backtest.paramDPeriod,
    'oversold': t.backtest.paramOversold,
    'overbought': t.backtest.paramOverbought,
    'adxPeriod': t.backtest.paramAdxPeriod,
    'adxThreshold': t.backtest.paramAdxThreshold,
    'fastEmaPeriod': t.backtest.paramFastEmaPeriod,
    'slowEmaPeriod': t.backtest.paramSlowEmaPeriod,
  };


  // 生成权益曲线数据
  const generateEquityCurveData = () => {
    if (backtestResult?.results?.equityCurve && backtestResult.results.equityCurve.length > 0) {
      const validData = backtestResult.results.equityCurve.flatMap((item) => {
        const equity = safeNumber(item?.equity);
        const date = typeof item?.date === 'string' ? item.date.trim() : '';
        return equity !== null && date && parseDateSafe(date) ? [{ date, equity }] : [];
      });
      return sortByDateAsc(validData);
    }
    return [];
  };

  const equityCurveData = generateEquityCurveData();

  const resultData = backtestResult ? [
    { key: 'strategy', metric: t.backtest.strategyLabel, value: strategyNames[backtestResult.parameters?.strategy] || backtestResult.parameters?.strategy || t.backtest.unknown, description: t.backtest.descStrategy },
    {
      key: 'dataMode',
      metric: t.backtest.dataMode,
      value: backtestResult.parameters?.dataModeDisplay
        || (backtestResult.parameters?.dataMode === 'real'
          ? (language === 'zh-CN' ? '历史市场数据' : 'Historical market data')
          : backtestResult.parameters?.dataMode)
        || t.common.na,
      description: t.backtest.descDataMode,
    },
    { key: 'dataSource', metric: t.backtest.dataSource, value: backtestResult.parameters?.dataSource || t.common.na, description: t.backtest.descDataSource },
    { key: 'status', metric: t.backtest.statusLabel, value: backtestResult.success === true ? t.backtest.completed : backtestResult.success === false ? t.backtest.failed : t.common.na, description: t.backtest.descStatus },
    { key: 'totalReturn', metric: t.backtest.totalReturnLabel, value: backtestResult.results?.totalReturn, description: t.backtest.descTotalReturn },
    { key: 'annualizedReturn', metric: t.backtest.annualizedReturn, value: backtestResult.results?.annualizedReturn, description: t.backtest.descAnnualizedReturn },
    { key: 'profitLoss', metric: t.backtest.profitLoss, value: backtestResult.results?.profitLoss, description: t.backtest.descProfitLoss },
    { key: 'sharpeRatio', metric: t.backtest.sharpeRatioLabel, value: backtestResult.results?.sharpeRatio, description: t.backtest.descSharpeRatio },
    { key: 'calmarRatio', metric: t.backtest.calmarRatio, value: backtestResult.results?.calmarRatio, description: t.backtest.descCalmarRatio },
    { key: 'maxDrawdown', metric: t.backtest.maxDrawdownLabel, value: backtestResult.results?.maxDrawdown, description: t.backtest.descMaxDrawdown },
    { key: 'winRate', metric: t.backtest.winRateLabel, value: backtestResult.results?.winRate, description: t.backtest.descWinRate },
    { key: 'trades', metric: t.backtest.totalTrades, value: backtestResult.results?.trades, description: t.backtest.descTrades },
    { key: 'avgReturnPerTrade', metric: t.backtest.avgPnlPerTrade, value: backtestResult.results?.avgReturnPerTrade, description: t.backtest.descAvgPnl },
    { key: 'volatility', metric: t.backtest.volatility, value: backtestResult.results?.volatility, description: t.backtest.descVolatility },
    { key: 'sortinoRatio', metric: t.backtest.sortinoRatio, value: backtestResult.results?.sortinoRatio, description: t.backtest.descSortinoRatio },
    { key: 'profitFactor', metric: t.backtest.profitFactor, value: backtestResult.results?.profitFactor, description: t.backtest.descProfitFactor },
    { key: 'expectancy', metric: t.backtest.expectancy, value: backtestResult.results?.expectancy, description: t.backtest.descExpectancy },
    { key: 'exposure', metric: t.backtest.avgEquityRatio, value: backtestResult.results?.exposure, description: t.backtest.descExposure },
  ] : [];
  
  const calculateDrawdownFromEquity = (equityData: Array<{date: string, equity: number}>) => {
    const drawdownData: Array<{date: string, drawdown: number, equity: number, peak: number}> = [];
    let peak = equityData.length > 0 ? equityData[0].equity : null;
    
    for (let i = 0; i < equityData.length; i++) {
      const currentEquity = equityData[i].equity;
      peak = peak === null ? currentEquity : Math.max(peak, currentEquity);
      if (peak <= 0) continue;
      const drawdown = ((peak - currentEquity) / peak) * 100;
      drawdownData.push({ date: equityData[i].date, drawdown: drawdown, equity: currentEquity, peak: peak });
    }
    return drawdownData;
  };
  
  const drawdownData = calculateDrawdownFromEquity(equityCurveData);

  const getStartYear = (data: Array<{date: string}>): number | undefined => {
    if (data.length === 0) return undefined;
    const validData = sortByDateAsc(filterValidDates(data));
    if (validData.length === 0) return undefined;
    const firstDate = parseDateSafe(validData[0].date);
    return firstDate ? firstDate.getFullYear() : undefined;
  };

  const generateUniformDateTicks = (data: Array<{date: string}>, targetTickCount: number = 12): string[] => {
    if (data.length === 0) return [];
    const validData = sortByDateAsc(filterValidDates(data));
    if (validData.length === 0) return [];
    if (validData.length <= targetTickCount) return validData.map(item => item.date);

    const step = Math.max(1, Math.floor(validData.length / targetTickCount));
    const ticks: string[] = [];
    ticks.push(validData[0].date);
    for (let i = step; i < validData.length - step; i += step) {
      if (ticks.length >= targetTickCount - 1) break;
      ticks.push(validData[i].date);
    }
    if (ticks[ticks.length - 1] !== validData[validData.length - 1].date) {
      ticks.push(validData[validData.length - 1].date);
    }
    const sortedTicks = sortByDateAsc(ticks.map(date => ({date})));
    return sortedTicks.map(item => item.date);
  };

  const formatResultMetric = (value: unknown, decimals: number, suffix = '') => {
    const numericValue = safeNumber(value);
    if (numericValue === null) return t.common.na;
    return `${numericValue > 0 && suffix === '%' ? '+' : ''}${numericValue.toFixed(decimals)}${suffix}`;
  };

  const resultMetricColor = (value: unknown, positiveThreshold = 0) => {
    const numericValue = safeNumber(value);
    if (numericValue === null || numericValue === 0) return 'var(--bt-ink)';
    return numericValue > positiveThreshold ? '#10b981' : '#ef4444';
  };

  const handleResultTabChange = (tab: string) => {
    const nextSearchParams = new URLSearchParams(location.search);
    nextSearchParams.set('tab', tab);
    navigate(
      { pathname: location.pathname, search: `?${nextSearchParams.toString()}` },
      { state: location.state },
    );
  };

  const tradesListValue = backtestResult?.results?.tradesList;
  const tradeList = Array.isArray(tradesListValue) ? tradesListValue : null;
  const sharpeSummaryValue = safeNumber(backtestResult?.results?.sharpeRatio);
  const maxDrawdownSummaryValue = safeNumber(backtestResult?.results?.maxDrawdown);
  const winRateSummaryValue = safeNumber(backtestResult?.results?.winRate);
  const profitFactorValue = safeNumber(backtestResult?.results?.profitFactor);
  const avgWinValue = safeNumber(backtestResult?.results?.avgWin);
  const avgLossValue = safeNumber(backtestResult?.results?.avgLoss);

  return (
    <div className="backtest-page-shell backtest-editorial" aria-busy={loading}>
      {/* ── Page Header ── */}
      <section className="bt-hero" aria-labelledby="backtest-page-title">
        <div className="bt-hero__copy">
          <span className="bt-kicker">
            <LineChartOutlined />
            {language === 'zh-CN' ? '01 / 历史验证台' : '01 / HISTORICAL VALIDATION DESK'}
          </span>
          <Title id="backtest-page-title" level={1}>{t.backtest.title}</Title>
          <Text>{t.backtest.subtitleForm}</Text>
          <div className="bt-hero__meta">
            <span><i className={loading ? 'is-running' : 'is-ready'} />{loading ? t.backtest.executingSimulation : t.backtest.engineReady}</span>
            <span>{language === 'zh-CN' ? `${backtestHistory.length} 个历史会话` : `${backtestHistory.length} HISTORICAL SESSIONS`}</span>
            <span>{language === 'zh-CN' ? `${savedStrategies.length} 个已存方案` : `${savedStrategies.length} SAVED PLANS`}</span>
          </div>
        </div>
        <aside className="bt-hero__instrument" aria-label={language === 'zh-CN' ? '当前研究方案' : 'Current research mandate'}>
          <span>{language === 'zh-CN' ? '当前模型' : 'CURRENT MODEL'}</span>
          <strong>{strategyNames[selectedStrategy] || selectedStrategy}</strong>
          <small>{portfolioSymbols.length > 1
            ? (language === 'zh-CN' ? `${portfolioSymbols.length} 个标的组合` : `${portfolioSymbols.length} INSTRUMENT PORTFOLIO`)
            : (language === 'zh-CN' ? '单一标的研究' : 'SINGLE-INSTRUMENT STUDY')}
          </small>
        </aside>
      </section>

      {error && (
        <Alert className="bt-error-alert" message={t.backtest.systemNotification} description={error} type="error" showIcon closable onClose={() => setError('')} />
      )}

      {loading && (
        <div className="bt-run-progress" role="status" aria-live="polite">
          <div className="bt-run-progress__copy">
            <Spin size="small" />
            <span>{t.backtest.executingSimulation}</span>
          </div>
          <div className="bt-run-progress__track" aria-hidden="true"><i /></div>
        </div>
      )}

      <div className="backtest-main-layout">
        <div className="backtest-left-panel">
          <Card
            className="premium-card config-card"
            title={(
              <div className="bt-card-heading">
                <span>{language === 'zh-CN' ? '01 / 研究设定' : '01 / RESEARCH MANDATE'}</span>
                <strong>{t.backtest.configuration}</strong>
              </div>
            )}
          >
            <Form form={form} layout="vertical" onFinish={handleRunBacktest} requiredMark={false}>
              <Row gutter={18} className="bt-primary-fields">
                <Col span={10}>
                  <Form.Item label={<span className="backtest-form-label">{t.backtest.stockSymbol}</span>} name="symbol" rules={[{ required: true, message: t.backtest.stockSymbolRequired }]} help={<span style={{ fontSize: 11, color: 'var(--app-text-muted)' }}>{t.backtest.stockSymbolHelp}</span>}>
                    <Input placeholder={t.backtest.stockSymbolPlaceholder} className="backtest-form-input" prefix={<LineChartOutlined style={{ color: 'var(--app-text-muted)' }} />} onChange={(e) => parseSymbols(e.target.value)} />
                  </Form.Item>
                </Col>
                <Col span={14}>
                  <Form.Item label={<span className="backtest-form-label">{t.backtest.strategyModel}</span>} name="strategy" rules={[{ required: true, message: t.backtest.strategyModelRequired }]}>
                    <Select
                      className="backtest-form-input"
                      style={{ width: '100%' }}
                      placeholder={t.backtest.chooseStrategy} 
                      onChange={(value) => {
                        setSelectedStrategy(value);
                        if (strategyDefaults[value]) {
                          form.setFieldsValue(strategyDefaults[value]);
                        }
                      }}
                    >
                      {strategyOptions.map(option => <Option key={option.value} value={option.value}>{option.label}</Option>)}
                    </Select>
                  </Form.Item>
                </Col>
              </Row>

              {portfolioSymbols.length > 1 && (
                <div className="bt-portfolio-notice">
                  <Tag color="blue" style={{ borderRadius: 4, fontWeight: 700, fontSize: 10 }}>{t.backtest.portfolioActive}</Tag>
                  <Text style={{ fontSize: 12.5, color: 'var(--app-blue-text)', fontWeight: 500 }}>{t.backtest.portfolioMode.replace('{count}', String(portfolioSymbols.length))}</Text>
                </div>
              )}

              <div className="execution-inner-panel">
                <div className="bt-execution-heading">
                  <h4 style={{ margin: 0, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: 'var(--app-text-muted)', letterSpacing: '1px' }}>{t.backtest.executionParams}</h4>
                  <Badge status="default" text={<Text style={{ fontSize: 11, color: 'var(--app-text-muted)', fontWeight: 600 }}>{language === 'zh-CN' ? '历史市场数据' : 'Historical market data'}</Text>} />
                </div>

                {selectedStrategy === 'moving_average' && (
                  <Row gutter={16}>
                    <Col span={12}><Form.Item label={<span style={{ fontSize: 12, color: 'var(--app-text)' }}>{t.backtest.shortMaPeriod}</span>} name="shortMaPeriod" extra={<span style={{ fontSize: 10, color: 'var(--app-text-muted)' }}>{t.backtest.defaultLabel.replace('{value}', '20')}</span>}><InputNumber min={1} max={200} className="backtest-form-input" style={{ width: '100%' }} /></Form.Item></Col>
                    <Col span={12}><Form.Item label={<span style={{ fontSize: 12, color: 'var(--app-text)' }}>{t.backtest.longMaPeriod}</span>} name="longMaPeriod" extra={<span style={{ fontSize: 10, color: 'var(--app-text-muted)' }}>{t.backtest.defaultLabel.replace('{value}', '50')}</span>}><InputNumber min={1} max={200} className="backtest-form-input" style={{ width: '100%' }} /></Form.Item></Col>
                  </Row>
                )}
                {selectedStrategy === 'rsi' && (
                  <Row gutter={16}>
                    <Col span={8}><Form.Item label={<span style={{ fontSize: 12, color: 'var(--app-text)' }}>{t.backtest.rsiPeriod}</span>} name="rsiPeriod" extra={<span style={{ fontSize: 10, color: 'var(--app-text-muted)' }}>{t.backtest.defaultLabel.replace('{value}', '14')}</span>}><InputNumber min={1} max={50} className="backtest-form-input" style={{ width: '100%' }} /></Form.Item></Col>
                    <Col span={8}><Form.Item label={<span style={{ fontSize: 12, color: 'var(--app-text)' }}>{t.backtest.oversold}</span>} name="rsiOversold" extra={<span style={{ fontSize: 10, color: 'var(--app-text-muted)' }}>{t.backtest.defaultLabel.replace('{value}', '30')}</span>}><InputNumber min={1} max={100} className="backtest-form-input" style={{ width: '100%' }} /></Form.Item></Col>
                    <Col span={8}><Form.Item label={<span style={{ fontSize: 12, color: 'var(--app-text)' }}>{t.backtest.overbought}</span>} name="rsiOverbought" extra={<span style={{ fontSize: 10, color: 'var(--app-text-muted)' }}>{t.backtest.defaultLabel.replace('{value}', '70')}</span>}><InputNumber min={1} max={100} className="backtest-form-input" style={{ width: '100%' }} /></Form.Item></Col>
                  </Row>
                )}
                {selectedStrategy === 'macd' && (
                  <Row gutter={16}>
                    <Col span={8}><Form.Item label={<span style={{ fontSize: 12, color: 'var(--app-text)' }}>{t.backtest.fastEma}</span>} name="macdFast" extra={<span style={{ fontSize: 10, color: 'var(--app-text-muted)' }}>{t.backtest.defaultLabel.replace('{value}', '12')}</span>}><InputNumber min={1} max={50} className="backtest-form-input" style={{ width: '100%' }} /></Form.Item></Col>
                    <Col span={8}><Form.Item label={<span style={{ fontSize: 12, color: 'var(--app-text)' }}>{t.backtest.slowEma}</span>} name="macdSlow" extra={<span style={{ fontSize: 10, color: 'var(--app-text-muted)' }}>{t.backtest.defaultLabel.replace('{value}', '26')}</span>}><InputNumber min={1} max={50} className="backtest-form-input" style={{ width: '100%' }} /></Form.Item></Col>
                    <Col span={8}><Form.Item label={<span style={{ fontSize: 12, color: 'var(--app-text)' }}>{t.backtest.signal}</span>} name="macdSignal" extra={<span style={{ fontSize: 10, color: 'var(--app-text-muted)' }}>{t.backtest.defaultLabel.replace('{value}', '9')}</span>}><InputNumber min={1} max={50} className="backtest-form-input" style={{ width: '100%' }} /></Form.Item></Col>
                  </Row>
                )}
                {selectedStrategy === 'bollinger' && (
                  <Row gutter={16}>
                    <Col span={12}><Form.Item label={<span style={{ fontSize: 12, color: 'var(--app-text)' }}>{t.backtest.periodLabel}</span>} name="bollingerPeriod" extra={<span style={{ fontSize: 10, color: 'var(--app-text-muted)' }}>{t.backtest.defaultLabel.replace('{value}', '20')}</span>}><InputNumber min={5} max={100} className="backtest-form-input" style={{ width: '100%' }} /></Form.Item></Col>
                    <Col span={12}><Form.Item label={<span style={{ fontSize: 12, color: 'var(--app-text)' }}>{t.backtest.stdDev}</span>} name="bollingerStdDev" extra={<span style={{ fontSize: 10, color: 'var(--app-text-muted)' }}>{t.backtest.defaultLabel.replace('{value}', '2')}</span>}><InputNumber min={1} max={5} step={0.1} className="backtest-form-input" style={{ width: '100%' }} /></Form.Item></Col>
                  </Row>
                )}
                {selectedStrategy === 'momentum' && (
                  <Col span={12}>
                    <Form.Item label={<span style={{ fontSize: 12, color: 'var(--app-text)' }}>{t.backtest.momentumPeriod}</span>} name="momentumPeriod" extra={<span style={{ fontSize: 10, color: 'var(--app-text-muted)' }}>{t.backtest.defaultLabel.replace('{value}', '20')}</span>}><InputNumber min={1} max={50} className="backtest-form-input" style={{ width: '100%' }} /></Form.Item>
                  </Col>
                )}
                {selectedStrategy === 'mean_reversion' && (
                  <Row gutter={12}>
                    <Col span={8}><Form.Item label={<span style={{ fontSize: 12, color: 'var(--app-text)' }}>{t.backtest.lookbackPeriod}</span>} name="lookbackPeriod" extra={<span style={{ fontSize: 9, color: 'var(--app-text-muted)' }}>{t.backtest.defaultLabel.replace('{value}', '20')}</span>}><InputNumber min={5} max={100} className="backtest-form-input" style={{ width: '100%' }} /></Form.Item></Col>
                    <Col span={8}><Form.Item label={<span style={{ fontSize: 12, color: 'var(--app-text)' }}>{t.backtest.paramEntryZScore}</span>} name="entryZScore" extra={<span style={{ fontSize: 9, color: 'var(--app-text-muted)' }}>{t.backtest.defaultLabel.replace('{value}', '-2.0')}</span>}><InputNumber step={0.1} min={-5} max={0} className="backtest-form-input" style={{ width: '100%' }} /></Form.Item></Col>
                    <Col span={8}><Form.Item label={<span style={{ fontSize: 12, color: 'var(--app-text)' }}>{t.backtest.paramStopLossPct}</span>} name="stopLossPct" extra={<span style={{ fontSize: 9, color: 'var(--app-text-muted)' }}>{t.backtest.defaultLabel.replace('{value}', '6')}</span>}><InputNumber min={1} max={20} step={0.5} className="backtest-form-input" style={{ width: '100%' }} /></Form.Item></Col>
                  </Row>
                )}
                {selectedStrategy === 'buy_hold' && (
                  <div style={{ fontSize: 12, color: 'var(--app-text-muted)', lineHeight: 1.6 }}>
                    {t.backtest.buyHoldDescription}
                  </div>
                )}
                {selectedStrategy === 'donchian_breakout' && (
                  <Row gutter={12}>
                    <Col span={6}><Form.Item label={<span style={{ fontSize: 12, color: 'var(--app-text)' }}>{t.backtest.entryPeriod}</span>} name="entryPeriod" extra={<span style={{ fontSize: 9, color: 'var(--app-text-muted)' }}>{t.backtest.defaultLabel.replace('{value}', '20')}</span>}><InputNumber min={5} max={120} className="backtest-form-input" style={{ width: '100%' }} /></Form.Item></Col>
                    <Col span={6}><Form.Item label={<span style={{ fontSize: 12, color: 'var(--app-text)' }}>{t.backtest.exitPeriod}</span>} name="exitPeriod" extra={<span style={{ fontSize: 9, color: 'var(--app-text-muted)' }}>{t.backtest.defaultLabel.replace('{value}', '10')}</span>}><InputNumber min={3} max={80} className="backtest-form-input" style={{ width: '100%' }} /></Form.Item></Col>
                    <Col span={6}><Form.Item label={<span style={{ fontSize: 12, color: 'var(--app-text)' }}>{t.backtest.atrPeriod}</span>} name="atrPeriod" extra={<span style={{ fontSize: 9, color: 'var(--app-text-muted)' }}>{t.backtest.defaultLabel.replace('{value}', '20')}</span>}><InputNumber min={5} max={60} className="backtest-form-input" style={{ width: '100%' }} /></Form.Item></Col>
                    <Col span={6}><Form.Item label={<span style={{ fontSize: 12, color: 'var(--app-text)' }}>{t.backtest.atrStopMultiple}</span>} name="atrStopMultiple" extra={<span style={{ fontSize: 9, color: 'var(--app-text-muted)' }}>{t.backtest.defaultLabel.replace('{value}', '2.0')}</span>}><InputNumber min={0.5} max={6} step={0.1} className="backtest-form-input" style={{ width: '100%' }} /></Form.Item></Col>
                  </Row>
                )}
                {selectedStrategy === 'keltner_breakout' && (
                  <Row gutter={12}>
                    <Col span={8}><Form.Item label={<span style={{ fontSize: 12, color: 'var(--app-text)' }}>{t.backtest.emaPeriod}</span>} name="emaPeriod" extra={<span style={{ fontSize: 9, color: 'var(--app-text-muted)' }}>{t.backtest.defaultLabel.replace('{value}', '20')}</span>}><InputNumber min={5} max={120} className="backtest-form-input" style={{ width: '100%' }} /></Form.Item></Col>
                    <Col span={8}><Form.Item label={<span style={{ fontSize: 12, color: 'var(--app-text)' }}>{t.backtest.atrPeriod}</span>} name="atrPeriod" extra={<span style={{ fontSize: 9, color: 'var(--app-text-muted)' }}>{t.backtest.defaultLabel.replace('{value}', '20')}</span>}><InputNumber min={5} max={60} className="backtest-form-input" style={{ width: '100%' }} /></Form.Item></Col>
                    <Col span={8}><Form.Item label={<span style={{ fontSize: 12, color: 'var(--app-text)' }}>{t.backtest.atrMultiplier}</span>} name="atrMultiplier" extra={<span style={{ fontSize: 9, color: 'var(--app-text-muted)' }}>{t.backtest.defaultLabel.replace('{value}', '2.0')}</span>}><InputNumber min={0.5} max={6} step={0.1} className="backtest-form-input" style={{ width: '100%' }} /></Form.Item></Col>
                  </Row>
                )}
                {selectedStrategy === 'supertrend' && (
                  <Row gutter={12}>
                    <Col span={12}><Form.Item label={<span style={{ fontSize: 12, color: 'var(--app-text)' }}>{t.backtest.atrPeriod}</span>} name="atrPeriod" extra={<span style={{ fontSize: 9, color: 'var(--app-text-muted)' }}>{t.backtest.defaultLabel.replace('{value}', '10')}</span>}><InputNumber min={5} max={60} className="backtest-form-input" style={{ width: '100%' }} /></Form.Item></Col>
                    <Col span={12}><Form.Item label={<span style={{ fontSize: 12, color: 'var(--app-text)' }}>{t.backtest.multiplier}</span>} name="multiplier" extra={<span style={{ fontSize: 9, color: 'var(--app-text-muted)' }}>{t.backtest.defaultLabel.replace('{value}', '3.0')}</span>}><InputNumber min={1} max={8} step={0.1} className="backtest-form-input" style={{ width: '100%' }} /></Form.Item></Col>
                  </Row>
                )}
                {selectedStrategy === 'stochastic' && (
                  <Row gutter={12}>
                    <Col span={6}><Form.Item label={<span style={{ fontSize: 12, color: 'var(--app-text)' }}>{t.backtest.kPeriod}</span>} name="kPeriod" extra={<span style={{ fontSize: 9, color: 'var(--app-text-muted)' }}>{t.backtest.defaultLabel.replace('{value}', '14')}</span>}><InputNumber min={5} max={60} className="backtest-form-input" style={{ width: '100%' }} /></Form.Item></Col>
                    <Col span={6}><Form.Item label={<span style={{ fontSize: 12, color: 'var(--app-text)' }}>{t.backtest.dPeriod}</span>} name="dPeriod" extra={<span style={{ fontSize: 9, color: 'var(--app-text-muted)' }}>{t.backtest.defaultLabel.replace('{value}', '3')}</span>}><InputNumber min={1} max={20} className="backtest-form-input" style={{ width: '100%' }} /></Form.Item></Col>
                    <Col span={6}><Form.Item label={<span style={{ fontSize: 12, color: 'var(--app-text)' }}>{t.backtest.oversold}</span>} name="oversold" extra={<span style={{ fontSize: 9, color: 'var(--app-text-muted)' }}>{t.backtest.defaultLabel.replace('{value}', '20')}</span>}><InputNumber min={1} max={50} className="backtest-form-input" style={{ width: '100%' }} /></Form.Item></Col>
                    <Col span={6}><Form.Item label={<span style={{ fontSize: 12, color: 'var(--app-text)' }}>{t.backtest.overbought}</span>} name="overbought" extra={<span style={{ fontSize: 9, color: 'var(--app-text-muted)' }}>{t.backtest.defaultLabel.replace('{value}', '80')}</span>}><InputNumber min={50} max={99} className="backtest-form-input" style={{ width: '100%' }} /></Form.Item></Col>
                  </Row>
                )}
                {selectedStrategy === 'adx_trend' && (
                  <Row gutter={12}>
                    <Col span={6}><Form.Item label={<span style={{ fontSize: 12, color: 'var(--app-text)' }}>{t.backtest.adxPeriod}</span>} name="adxPeriod" extra={<span style={{ fontSize: 9, color: 'var(--app-text-muted)' }}>{t.backtest.defaultLabel.replace('{value}', '14')}</span>}><InputNumber min={5} max={60} className="backtest-form-input" style={{ width: '100%' }} /></Form.Item></Col>
                    <Col span={6}><Form.Item label={<span style={{ fontSize: 12, color: 'var(--app-text)' }}>{t.backtest.adxThreshold}</span>} name="adxThreshold" extra={<span style={{ fontSize: 9, color: 'var(--app-text-muted)' }}>{t.backtest.defaultLabel.replace('{value}', '25')}</span>}><InputNumber min={5} max={60} className="backtest-form-input" style={{ width: '100%' }} /></Form.Item></Col>
                    <Col span={6}><Form.Item label={<span style={{ fontSize: 12, color: 'var(--app-text)' }}>{t.backtest.fastEmaPeriod}</span>} name="fastEmaPeriod" extra={<span style={{ fontSize: 9, color: 'var(--app-text-muted)' }}>{t.backtest.defaultLabel.replace('{value}', '20')}</span>}><InputNumber min={3} max={120} className="backtest-form-input" style={{ width: '100%' }} /></Form.Item></Col>
                    <Col span={6}><Form.Item label={<span style={{ fontSize: 12, color: 'var(--app-text)' }}>{t.backtest.slowEmaPeriod}</span>} name="slowEmaPeriod" extra={<span style={{ fontSize: 9, color: 'var(--app-text-muted)' }}>{t.backtest.defaultLabel.replace('{value}', '50')}</span>}><InputNumber min={10} max={220} className="backtest-form-input" style={{ width: '100%' }} /></Form.Item></Col>
                  </Row>
                )}
              </div>

              <Row gutter={20} className="bt-simulation-fields">
                <Col span={14}>
                  <Form.Item label={<span className="backtest-form-label">{t.backtest.simulationWindow}</span>} name="dateRange" rules={[{ required: true }]}>
                    <RangePicker className="backtest-form-input" style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={10}>
                  <Form.Item label={<span className="backtest-form-label">{t.backtest.initialLiquidity}</span>} name="initialCapital" rules={[{ required: true }]}>
                    <InputNumber min={1000} className="backtest-form-input" style={{ width: '100%' }} formatter={v => `$ ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} />
                  </Form.Item>
                </Col>
              </Row>

              <div className="bt-form-actions">
                <Button type="primary" htmlType="submit" size="large" loading={loading} icon={<PlayCircleOutlined />} className="primary-cta-button" style={{ width: '100%', marginBottom: 14 }} disabled={loading}>
                  {loading ? t.backtest.executingSimulation : t.backtest.executeBacktest}
                </Button>
                <div className="bt-secondary-actions">
                  <Button style={{ flex: 1 }} className="secondary-action-btn" icon={<SaveOutlined />} onClick={saveCurrentStrategy}>{t.backtest.savePlan}</Button>
                  <Button style={{ flex: 1 }} className="secondary-action-btn" icon={<FolderOpenOutlined />} onClick={() => setShowSavedStrategies(!showSavedStrategies)}>{showSavedStrategies ? t.backtest.hidePlans : t.backtest.savedPlans}</Button>
                  <Button style={{ flex: 1 }} className="secondary-action-btn" type="dashed" icon={<PlayCircleOutlined />} onClick={() => {
                    const formValues = form.getFieldsValue();
                    if (formValues.strategy === 'moving_average') {
                      const backtestParams = { strategy: 'MA_CROSSOVER', symbol: formValues.symbol, shortMaPeriod: formValues.shortMaPeriod || 20, longMaPeriod: formValues.longMaPeriod || 50, timestamp: new Date().toISOString() };
                      if (accountLastParamsKey) localStorage.setItem(accountLastParamsKey, JSON.stringify(backtestParams));
                      message.success(t.backtest.strategyStaged);
                    } else { message.info(t.backtest.stageLimited); }
                  }}>{t.backtest.stageForPaper}</Button>
                </div>
              </div>
            </Form>
          </Card>

          {showSavedStrategies && (
            <Card
              className="premium-card bt-saved-plans"
              title={(
                <div className="bt-card-heading bt-card-heading--compact">
                  <span>{language === 'zh-CN' ? '已保存' : 'SAVED RESEARCH'}</span>
                  <strong>{t.backtest.strategyLibrary}</strong>
                </div>
              )}
            >
              {savedStrategies.length === 0 ? (
                <Empty description={t.backtest.noSavedPlans} image={Empty.PRESENTED_IMAGE_SIMPLE} />
              ) : (
                <div className="bt-saved-plan-grid">
                  {savedStrategies.map((strategy) => (
                    <Card key={strategy.id} size="small" className="premium-card" style={{ border: '1px solid var(--app-border-soft)' }}
                      title={<Text strong style={{ fontSize: 13.5, color: 'var(--app-text-strong)' }}>{strategy.name}</Text>}
                      extra={
                        <Space>
                          <Button type="link" size="small" onClick={() => loadStrategy(strategy)} style={{ fontSize: 12 }}>{t.backtest.load}</Button>
                          <Button type="link" size="small" danger onClick={() => deleteStrategy(strategy.id)} style={{ fontSize: 12 }}>{t.backtest.delete}</Button>
                        </Space>
                      }
                    >
                      <div style={{ fontSize: '11px', color: 'var(--app-text-muted)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}><strong>{t.backtest.symbolLabel}:</strong> <span style={{ color: 'var(--app-text)' }}>{strategy.config.symbol}</span></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}><strong>{t.backtest.strategyLabelShort}:</strong> <span style={{ color: 'var(--app-text)' }}>{strategyNames[strategy.config.strategy] || strategy.config.strategy}</span></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}><strong>{t.backtest.createdLabel}:</strong> <span style={{ color: 'var(--app-text)' }}>{new Date(strategy.createdTime).toLocaleDateString()}</span></div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </Card>
          )}
        </div>

        <div className="backtest-right-panel">
          <Card 
            className="premium-card side-panel-card" 
            title={(
              <div className="bt-card-heading bt-card-heading--compact">
                <span>{language === 'zh-CN' ? '02 / 会话账本' : '02 / SESSION LEDGER'}</span>
                <strong><HistoryOutlined />{t.backtest.recentSessions}</strong>
              </div>
            )}
            bodyStyle={{ padding: '0' }}
            extra={
              <Space>
                {selectedBacktests.length >= 2 && (
                  <Button 
                    type="primary" 
                    size="small" 
                    icon={<LineChartOutlined />} 
                    onClick={handleCompareSelected}
                    style={{ borderRadius: 6, height: 26, fontSize: '11px', fontWeight: 700 }}
                  >
                    {t.backtest.compareCount.replace('{count}', String(selectedBacktests.length))}
                  </Button>
                )}
                <Button type="text" icon={<ReloadOutlined style={{ fontSize: 12 }} />} onClick={fetchBacktestHistory} loading={historyLoading} size="small" />
              </Space>
            }
          >
            {historyLoading ? <div className="bt-loading-state"><Spin /><span>{language === 'zh-CN' ? '正在同步历史会话…' : 'Synchronizing session ledger…'}</span></div> : historyError ? (
              <Alert
                type="error"
                showIcon
                message={historyError}
                action={<Button size="small" onClick={() => void fetchBacktestHistory()}>{language === 'zh-CN' ? '重试' : 'Retry'}</Button>}
                style={{ margin: 16 }}
              />
            ) : backtestHistory.length > 0 ? (
              <div className="history-table-container">
                <Table 
                  className="history-table"
                  columns={historyColumns} 
                  dataSource={backtestHistory} 
                  rowKey="backtestId" 
                  pagination={{ pageSize: 7, simple: true }} 
                  size="small" 
                  scroll={{ x: 'max-content' }}
                  rowClassName={(record) => selectedBacktests.includes(record.backtestId) ? 'recent-backtest-row selected-row' : 'recent-backtest-row'}
                />
              </div>
            ) : (
              <div className="bt-empty-state"><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t.backtest.noPreviousSessions} /></div>
            )}
          </Card>
          <Card
            className="premium-card bt-quick-insights"
            title={(
              <div className="bt-card-heading bt-card-heading--compact">
                <span>{language === 'zh-CN' ? '03 / 研究捷径' : '03 / RESEARCH SHORTCUTS'}</span>
                <strong>{t.backtest.quickInsights}</strong>
              </div>
            )}
            bodyStyle={{ padding: 18 }}
          >
            <div className="bt-quick-actions">
              <Button block className="secondary-action-btn" onClick={() => navigate('/market')} icon={<LineChartOutlined />}>{t.backtest.exploreTopSymbols}</Button>
              <Button block className="secondary-action-btn" onClick={() => loadQuickBlueprint('MSFT', 'rsi')}>{t.backtest.loadMsftBlueprint}</Button>
              <Button block className="secondary-action-btn" onClick={() => loadQuickBlueprint('TSLA', 'momentum')}>{t.backtest.loadTslaBlueprint}</Button>
            </div>
          </Card>
        </div>
      </div>

      {backtestResult && backtestResult.success !== false && (
        <div ref={resultsRef} className="bt-results" id="backtest-report">
          <div className="section-header bt-report-heading">
            <span className="bt-report-index">{language === 'zh-CN' ? '04 / 验证结果' : '04 / VALIDATION REPORT'}</span>
            {backtestResult.success === true
              ? <CheckCircleOutlined style={{ fontSize: 24, color: '#10b981' }} />
              : <LineChartOutlined style={{ fontSize: 24, color: 'var(--bt-blue)' }} />}
            <h2 className="section-title" style={{ fontSize: 22 }}>{t.backtest.backtestReport}</h2>
            <Tag
              color={backtestResult.success === true ? 'success' : 'default'}
              style={{
                borderRadius: 2,
                fontWeight: 700,
                fontSize: 10,
                padding: '1px 8px',
                background: backtestResult.success === true ? 'var(--app-blue-bg)' : 'var(--bt-surface-deep)',
                color: backtestResult.success === true ? '#10b981' : 'var(--bt-muted)',
              }}
            >
              {backtestResult.success === true
                ? t.backtest.verified.toUpperCase()
                : (language === 'zh-CN' ? '结果可用' : 'RESULT AVAILABLE')}
            </Tag>
          </div>

          <div className="performance-strip">
            {[
              { label: t.backtest.totalReturnLabel, value: formatResultMetric(backtestResult.results?.totalReturn, 2, '%'), color: resultMetricColor(backtestResult.results?.totalReturn) },
              { label: t.backtest.sharpeRatioLabel, value: formatResultMetric(backtestResult.results?.sharpeRatio, 2), color: sharpeSummaryValue === null ? 'var(--bt-ink)' : sharpeSummaryValue >= 1 ? '#10b981' : '#f59e0b' },
              { label: t.backtest.maxDrawdownLabel, value: formatDrawdown(backtestResult.results?.maxDrawdown, 2), color: maxDrawdownSummaryValue === null ? 'var(--bt-ink)' : '#ef4444' },
              { label: t.backtest.winRateLabel, value: formatResultMetric(backtestResult.results?.winRate, 1, '%'), color: winRateSummaryValue === null ? 'var(--bt-ink)' : winRateSummaryValue >= 50 ? '#10b981' : '#f59e0b' },
              { label: t.backtest.totalTrades, value: safeNumber(backtestResult.results?.trades) ?? t.common.na, color: 'var(--app-text-strong)' },
              { label: t.backtest.netProfit, value: formatCurrency(backtestResult.results?.profitLoss), color: resultMetricColor(backtestResult.results?.profitLoss) }
            ].map(m => (
              <div key={m.label} className="stat-metric-card">
                <span className="stat-metric-label">{m.label}</span>
                <div className="stat-metric-value" style={{ color: m.color }}>{m.value}</div>
              </div>
            ))}
          </div>

          <Card className="premium-card backtest-report-card" bodyStyle={{ padding: '8px 24px 24px 24px' }}>
            <Tabs activeKey={activeResultTab} onChange={handleResultTabChange} items={[
              {
                key: 'results', label: <span style={{ fontWeight: 700 }}>{t.backtest.overview}</span>, children: (
                  <div style={{ paddingTop: 8 }}>
                    <div className="info-strip">
                      <Row gutter={[24, 16]}>
                        <Col xs={12} sm={6}><div className="blueprint-label">{t.backtest.strategyModule}</div><div className="blueprint-value">{strategyNames[backtestResult.parameters.strategy] || backtestResult.parameters.strategy}</div></Col>
                        <Col xs={12} sm={6}><div className="blueprint-label">{t.backtest.instrument}</div><div className="blueprint-value">{backtestResult.parameters.symbol || backtestResult.parameters.symbols?.[0] || 'N/A'}</div></Col>
                        <Col xs={12} sm={6}><div className="blueprint-label">{t.backtest.initialEquity}</div><div className="blueprint-value">{safeNumber(backtestResult.parameters.initialCapital) === null ? t.common.na : `$${Number(backtestResult.parameters.initialCapital).toLocaleString()}`}</div></Col>
                        <Col xs={12} sm={6}><div className="blueprint-label">{t.backtest.simulationPeriod}</div><div className="blueprint-value" style={{ fontSize: 12.5 }}>{backtestResult.parameters.period || t.common.na}</div></Col>
                      </Row>
                    </div>
                    <h4 style={{ fontSize: 14, fontWeight: 800, marginBottom: 16, color: 'var(--app-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t.backtest.performanceBreakdown}</h4>
                    <Table columns={resultColumns} dataSource={resultData} pagination={false} size="middle" style={{ border: '1px solid var(--app-border-soft)', borderRadius: 12, overflow: 'hidden' }} />
                  </div>
                )
              },
              {
                key: 'charts', label: <span style={{ fontWeight: 700 }}>{t.backtest.analyticsCharts}</span>, children: (
                  <div style={{ paddingTop: 12 }}>
                    <div className="chart-container-premium">
                      <h4 style={{ fontWeight: 800, fontSize: 15, marginBottom: 20, color: 'var(--app-text-strong)' }}>{t.backtest.equityGrowthCurve}</h4>
                      {equityCurveData.length > 0 ? <div style={{ height: '360px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={equityCurveData}>
                            <defs><linearGradient id="colorEquity" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.12}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/></linearGradient></defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--app-border-soft)" vertical={false} />
                            <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--app-text-muted)', fontWeight: 500 }} tickFormatter={(val) => formatDateForChartWithYear(val, getStartYear(equityCurveData))} axisLine={false} tickLine={false} ticks={generateUniformDateTicks(equityCurveData, 10)} />
                            <YAxis 
                              tick={{ fontSize: 10, fill: 'var(--app-text-muted)', fontWeight: 500 }} 
                              axisLine={false} 
                              tickLine={false} 
                              tickFormatter={(val) => {
                                if (val >= 1000000) return `$${(val/1000000).toFixed(1)}M`;
                                if (val >= 1000) return `$${(val/1000).toFixed(1)}K`;
                                return `$${val.toFixed(0)}`;
                              }} 
                              domain={['auto', 'auto']} 
                            />
                            <Tooltip 
                              formatter={(value: any) => [`$${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, t.backtest.portfolioValue]}
                              labelFormatter={(label) => `${t.backtest.dateLabel}: ${formatDateToYYYYMMDD(label)}`}
                              contentStyle={{ backgroundColor: 'var(--app-card-bg)', borderRadius: 12, border: '1px solid var(--app-border-soft)', boxShadow: '0 8px 24px rgba(0,0,0,0.1)', color: 'var(--app-text)' }} 
                              itemStyle={{ color: 'var(--app-text)' }}
                            />
                            <Area type="monotone" dataKey="equity" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorEquity)" activeDot={{ r: 5, strokeWidth: 2, stroke: 'var(--app-card-bg)' }} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div> : <div className="bt-chart-empty"><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={language === 'zh-CN' ? '该回测暂无权益曲线数据' : 'No equity curve data for this backtest'} /></div>}
                    </div>
                    <div className="chart-container-premium">
                      <h4 style={{ fontWeight: 800, fontSize: 15, marginBottom: 20, color: 'var(--app-text-strong)' }}>{t.backtest.drawdownAnalysis}</h4>
                      {drawdownData.length > 0 ? <div style={{ height: '260px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={drawdownData.map(d => ({...d, drawdown: -Math.abs(d.drawdown)}))}>
                            <defs><linearGradient id="colorDrawdown" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#ef4444" stopOpacity={0.12}/><stop offset="95%" stopColor="#ef4444" stopOpacity={0}/></linearGradient></defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--app-border-soft)" vertical={false} />
                            <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--app-text-muted)', fontWeight: 500 }} tickFormatter={(val) => formatDateForChartWithYear(val, getStartYear(drawdownData))} axisLine={false} tickLine={false} ticks={generateUniformDateTicks(drawdownData, 10)} />
                            <YAxis 
                              tick={{ fontSize: 10, fill: 'var(--app-text-muted)', fontWeight: 500 }} 
                              axisLine={false} 
                              tickLine={false} 
                              tickFormatter={(val) => `${val.toFixed(1)}%`} 
                            />
                            <Tooltip 
                              formatter={(value: any) => [`${Number(value).toFixed(2)}%`, t.backtest.drawdownLabel]}
                              labelFormatter={(label) => `${t.backtest.dateLabel}: ${formatDateToYYYYMMDD(label)}`}
                              contentStyle={{ backgroundColor: 'var(--app-card-bg)', borderRadius: 12, border: '1px solid var(--app-border-soft)', boxShadow: '0 8px 24px rgba(0,0,0,0.1)', color: 'var(--app-text)' }} 
                              itemStyle={{ color: 'var(--app-text)' }}
                            />
                            <Area type="monotone" dataKey="drawdown" stroke="#ef4444" strokeWidth={2} fillOpacity={1} fill="url(#colorDrawdown)" activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--app-card-bg)' }} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div> : <div className="bt-chart-empty bt-chart-empty--compact"><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={language === 'zh-CN' ? '该回测暂无回撤数据' : 'No drawdown series for this backtest'} /></div>}
                    </div>
                    {(!backtestResult?.parameters?.symbols || backtestResult.parameters.symbols.length <= 1) ? (
                      <div className="chart-container-premium">
                        <h4 style={{ fontWeight: 800, fontSize: 15, marginBottom: 20, color: 'var(--app-text-strong)' }}>{t.backtest.detailedTradingSignals}</h4>
                        {(backtestResult.results.chartData?.length || 0) > 0
                          ? <TradingChart data={backtestResult.results.chartData || []} height={380} />
                          : <div className="bt-chart-empty"><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={language === 'zh-CN' ? '该回测暂无价格信号数据' : 'No price-signal series for this backtest'} /></div>}
                      </div>
                    ) : <Empty description={t.backtest.portfolioNotAvailable} style={{ padding: '60px 0' }} />}

                  </div>
                )
              },
              {
                key: 'trades', label: <span style={{ fontWeight: 700 }}>{t.backtest.tradeLog}</span>, children: (
                  <div style={{ paddingTop: 8 }}>
                    <div className="bt-trade-stats">
                      <Row gutter={24}>
                        <Col span={6}><Statistic title={<Text style={{ fontSize: 11, fontWeight: 700, color: 'var(--app-text-muted)', textTransform: 'uppercase' }}>{t.backtest.winningTrades}</Text>} value={tradeList ? tradeList.filter((trade) => {
                          const pnl = safeNumber(trade.pnl);
                          return pnl !== null && pnl > 0;
                        }).length : t.common.na} valueStyle={{ color: '#10b981', fontWeight: 800, fontSize: 24 }} suffix={tradeList ? <span style={{ fontSize: 14, color: 'var(--app-text-muted)', fontWeight: 500 }}>/ {tradeList.length}</span> : undefined} /></Col>
                        <Col span={6}><Statistic title={<Text style={{ fontSize: 11, fontWeight: 700, color: 'var(--app-text-muted)', textTransform: 'uppercase' }}>{t.backtest.profitFactorLabel}</Text>} value={profitFactorValue ?? '—'} precision={profitFactorValue === null ? undefined : 2} valueStyle={{ fontWeight: 800, fontSize: 24, color: 'var(--app-text-strong)' }} /></Col>
                        <Col span={6}><Statistic title={<Text style={{ fontSize: 11, fontWeight: 700, color: 'var(--app-text-muted)', textTransform: 'uppercase' }}>{t.backtest.avgProfit}</Text>} value={avgWinValue ?? '—'} precision={avgWinValue === null ? undefined : 0} prefix={avgWinValue === null ? undefined : '$'} valueStyle={{ color: '#10b981', fontWeight: 800, fontSize: 24 }} /></Col>
                        <Col span={6}><Statistic title={<Text style={{ fontSize: 11, fontWeight: 700, color: 'var(--app-text-muted)', textTransform: 'uppercase' }}>{t.backtest.avgLoss}</Text>} value={avgLossValue ?? '—'} precision={avgLossValue === null ? undefined : 0} prefix={avgLossValue === null ? undefined : '$'} valueStyle={{ color: '#ef4444', fontWeight: 800, fontSize: 24 }} /></Col>
                      </Row>
                    </div>
                    <Table
                      className="history-table"
                      columns={[
                        { title: t.backtest.entryDate, dataIndex: 'entryDate', key: 'entryDate', render: d => <Text strong style={{ fontSize: 13, color: 'var(--app-text-strong)' }}>{formatDateToYYYYMMDD(d)}</Text> },
                        { title: t.backtest.symbolCol, dataIndex: 'symbol', key: 'symbol', render: s => <Tag color="blue" style={{ fontWeight: 700, borderRadius: 6, border: 'none', background: 'var(--app-blue-bg)', color: 'var(--app-blue-text)' }}>{s}</Tag> },
                        { title: t.backtest.action, dataIndex: 'action', key: 'action', render: a => <Tag color={a === 'BUY' ? 'green' : 'red'} style={{ borderRadius: 6, fontWeight: 700 }}>{a}</Tag> },
                        { title: t.backtest.entryPrice, dataIndex: 'entryPrice', key: 'entryPrice', render: p => { const value = safeNumber(p); return <Text strong style={{ color: value === null ? 'var(--app-text-muted)' : 'var(--app-text-strong)' }}>{value === null ? t.common.na : `$${value.toFixed(2)}`}</Text>; }, align: 'right' },
                        { title: t.backtest.exitPrice, dataIndex: 'exitPrice', key: 'exitPrice', render: p => { const value = safeNumber(p); return <Text style={{ color: 'var(--app-text-muted)' }}>{value === null ? t.common.na : `$${value.toFixed(2)}`}</Text>; }, align: 'right' },
                        { title: t.backtest.pnlDollar, dataIndex: 'pnl', key: 'pnl', render: p => { const value = safeNumber(p); return <Text strong style={{ color: value === null ? 'var(--app-text-muted)' : value > 0 ? '#10b981' : value < 0 ? '#ef4444' : 'var(--bt-ink)' }}>{value === null ? t.common.na : `${value > 0 ? '+$' : value < 0 ? '-$' : '$'}${Math.abs(value).toFixed(2)}`}</Text>; }, align: 'right' },
                        { title: t.backtest.returnLabel, dataIndex: 'returnPct', key: 'returnPct', render: r => { const value = safeNumber(r); return <div style={{ background: value !== null && value > 0 ? 'rgba(16, 185, 129, 0.08)' : value !== null && value < 0 ? 'rgba(239, 68, 68, 0.08)' : 'transparent', color: value === null ? 'var(--app-text-muted)' : value > 0 ? '#10b981' : value < 0 ? '#ef4444' : 'var(--bt-ink)', padding: '2px 8px', borderRadius: 6, fontWeight: 800, fontSize: 12, display: 'inline-block' }}>{value === null ? t.common.na : `${value > 0 ? '+' : ''}${value.toFixed(2)}%`}</div>; }, align: 'right' },
                      ]}
                      dataSource={backtestResult.results.tradesList || []}
                      rowKey={(record, index) => `${record.entryDate}-${index}`}
                      pagination={{ pageSize: 12, simple: true }}
                      size="middle"
                    />
                  </div>
                )
              },
              {
                key: 'parameters', label: <span style={{ fontWeight: 700 }}>{t.backtest.strategyBlueprint}</span>, children: (
                  <div style={{ paddingTop: 12 }}>
                    <Row gutter={[24, 24]}>
                      <Col xs={24} md={10}>
                        <div className="blueprint-module">
                          <div className="blueprint-label">{t.backtest.coreStrategyInfo}</div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 12 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}><Text style={{ color: 'var(--app-text-muted)', fontWeight: 500 }}>{t.backtest.modelName}</Text><Text strong style={{ color: 'var(--app-text-strong)' }}>{strategyNameBlueprint[backtestResult.parameters.strategy] || backtestResult.parameters.strategy}</Text></div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 18 }}><Text style={{ color: 'var(--app-text-muted)', fontWeight: 500 }}>{t.backtest.dataProvider}</Text><Text strong style={{ color: 'var(--app-text-strong)', textAlign: 'right' }}>{backtestResult.parameters.dataSource || t.common.na}</Text></div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 18 }}><Text style={{ color: 'var(--app-text-muted)', fontWeight: 500 }}>{t.backtest.engineVersion}</Text><Text strong style={{ color: 'var(--app-text-strong)' }}>{(backtestResult as BacktestResult & { engineVersion?: string }).engineVersion || t.common.na}</Text></div>
                          </div>
                        </div>
                      </Col>
                      <Col xs={24} md={14}>
                        <div className="blueprint-module">
                          <div className="blueprint-label">{t.backtest.appliedParameters}</div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12, marginTop: 12 }}>
                            {Object.entries(backtestResult.parameters.parameters || {}).map(([k, v]) => (
                              <div key={k} style={{ background: 'var(--app-card-bg)', padding: '12px 14px', borderRadius: 10, border: '1px solid var(--app-border-soft)' }}>
                                <div style={{ fontSize: 9.5, color: 'var(--app-text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.3px', marginBottom: 4 }}>{paramKeyNames[k] || k.replace(/([A-Z])/g, ' $1')}</div>
                                <div style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--app-text-strong)' }}>{typeof v === 'boolean' ? (v ? 'YES' : 'NO') : String(v)}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </Col>
                    </Row>
                  </div>
                )
              }
            ]} />
          </Card>
        </div>
      )}

      <DataSourceBadge source="Alpaca" position="bottom-left" compact={true} />
    </div>
  );
};

export default Backtest;
