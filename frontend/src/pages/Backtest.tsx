import React, { useState, useEffect, useRef } from 'react';
import { Card, Form, Input, InputNumber, Button, Select, DatePicker, Row, Col, Statistic, Table, Tag, Alert, Space, message, Empty, Spin, Tabs, Checkbox, Modal, Typography, Badge } from 'antd';
import { PlayCircleOutlined, HistoryOutlined, LineChartOutlined, ReloadOutlined, EyeOutlined, SaveOutlined, FolderOpenOutlined, DeleteOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { useLocation, useNavigate } from 'react-router-dom';
import { backtraderAPI } from '../services/api';
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

const { Title, Text } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;

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
  status: 'running' | 'completed' | 'failed';
  success?: boolean; // 添加success字段
  results: {
    totalReturn: number;
    sharpeRatio: number;
    maxDrawdown: number;
    winRate: number;
    trades: number;
    annualizedReturn: number;
    profitLoss?: number;
    calmarRatio: number;
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
  status: 'running' | 'completed' | 'failed';
  results?: {
    totalReturn: number;
    sharpeRatio: number;
    maxDrawdown: number;
    winRate: number;
    trades: number;
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

const Backtest: React.FC = () => {
  const { t, language } = useLanguage();
  const [form] = Form.useForm();
  const location = useLocation();
  const navigate = useNavigate();
  const resultsRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [backtestResult, setBacktestResult] = useState<BacktestResult | null>(null);
  const [backtestHistory, setBacktestHistory] = useState<BacktestHistoryItem[]>([]);
  const [error, setError] = useState<string>('');
  const [historyLoading, setHistoryLoading] = useState(true);
  const [selectedBacktests, setSelectedBacktests] = useState<string[]>([]);
  const [selectedStrategy, setSelectedStrategy] = useState<string>('moving_average');
  const [savedStrategies, setSavedStrategies] = useState<any[]>([]);
  const [showSavedStrategies, setShowSavedStrategies] = useState(false);
  const [portfolioSymbols, setPortfolioSymbols] = useState<string[]>([]);

  // 策略默认参数配置
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
  };

  // 请求ID管理，防止竞争条件
  const requestIdRef = useRef<string>('');

  // 设置默认日期范围（最近1年）使用 dayjs
  const defaultDateRange = () => {
    const end = dayjs();
    const start = dayjs().subtract(1, 'year');
    return [start, end];
  };

  // 从URL参数或location state获取symbol
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const symbolFromUrl = searchParams.get('symbol');

    if (symbolFromUrl) {
      form.setFieldsValue({
        symbol: symbolFromUrl.toUpperCase(),
        strategy: 'moving_average',
        dateRange: defaultDateRange(),
        initialCapital: 100000,
        ...strategyDefaults.moving_average
      });
      setSelectedStrategy('moving_average');
    }

    // 从location state获取symbol（从Market页面跳转时）
    if (location.state && location.state.symbol) {
      const strategy = location.state.strategy || 'moving_average';
      const formValues: any = {
        symbol: location.state.symbol.toUpperCase(),
        strategy: strategy,
        dateRange: defaultDateRange(),
        initialCapital: location.state.initialCapital || 100000,
        ...(strategyDefaults[strategy] || {})
      };
      
      // 如果是从Optimization页面跳转，设置最佳参数
      if (location.state.fromOptimization && location.state.parameters) {
        if (strategy === 'moving_average') {
          formValues.shortMaPeriod = location.state.parameters.shortMaPeriod;
          formValues.longMaPeriod = location.state.parameters.longMaPeriod;
        }
      }
      
      form.setFieldsValue(formValues);
      setSelectedStrategy(strategy);
    } else if (!symbolFromUrl) {
      // 设置默认值
      form.setFieldsValue({
        dateRange: defaultDateRange(),
        initialCapital: 100000,
        strategy: 'moving_average',
        ...strategyDefaults.moving_average
      });
      setSelectedStrategy('moving_average');
    }

    // 加载回测历史
    fetchBacktestHistory();
  }, [location, form]);

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
        status: (targetBacktest.status || 'completed') as any,
        success: targetBacktest.status === 'completed' || targetBacktest.success === true,
        results: {
          totalReturn: safeNumber(historyResults.totalReturn || targetBacktest.totalReturn),
          sharpeRatio: safeNumber(historyResults.sharpeRatio || targetBacktest.sharpeRatio),
          maxDrawdown: safeNumber(historyResults.maxDrawdown || targetBacktest.maxDrawdown),
          winRate: safeNumber(historyResults.winRate || targetBacktest.winRate),
          trades: safeNumber(historyResults.trades || targetBacktest.trades),
          annualizedReturn: safeNumber(historyResults.annualizedReturn || targetBacktest.annualizedReturn),
          profitLoss: safeNumber(historyResults.profitLoss || targetBacktest.profitLoss),
          chartData: historyResults.chartData || [],
          equityCurve: historyResults.equityCurve || [],
          tradesList: historyResults.tradesList || [],
          volatility: historyResults.volatility || 0,
          sortinoRatio: historyResults.sortinoRatio || 0,
          profitFactor: historyResults.profitFactor || 0,
          calmarRatio: historyResults.calmarRatio || 0,
        },
        parameters: targetBacktest.parameters || {
          strategy: targetBacktest.strategy || 'Unknown',
          symbols: targetBacktest.symbol ? [targetBacktest.symbol] : ['Unknown'],
          period: targetBacktest.period || '',
          initialCapital: targetBacktest.initialCapital || 100000,
          startDate: targetBacktest.startDate || '',
          endDate: targetBacktest.endDate || '',
        },
        createdAt: targetBacktest.createdAt
      };

      setBacktestResult(backtestResult);
      
      // 填充表单参数
      const strategy = backtestResult.parameters.strategy || 'moving_average';
      form.setFieldsValue({
        ...(backtestResult.parameters || {}),
        symbol: (backtestResult.parameters.symbols?.[0] || backtestResult.parameters.symbol || '').toUpperCase(),
        strategy: strategy,
        initialCapital: backtestResult.parameters.initialCapital || 100000,
      });
      setSelectedStrategy(strategy);

      // 滚动到结果区域
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 300);
    } else if (targetBacktestId) {
      console.log('Received selectedBacktestId from navigation state:', targetBacktestId);
      // 如果只有 ID，尝试加载
      const localHistory = loadLocalBacktestHistory();
      const found = localHistory.find(item => item.backtestId === targetBacktestId);
      if (found) {
        handleViewBacktest(found);
      } else {
        loadBacktestResult(targetBacktestId);
      }
    }
  }, [location.state]);

  // 生成唯一的请求ID
  const generateRequestId = () => {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  const safeToFixed = (value: unknown, decimals: number = 2): string => {
    // 先尝试转换为数字
    const numValue = safeNumber(value);
    if (!isNaN(numValue)) {
      return numValue.toFixed(decimals);
    }
    return '0.00';
  };

  const safeNumber = (value: unknown): number => {
    if (typeof value === 'number' && !isNaN(value)) {
      return value;
    }
    if (typeof value === 'string') {
      // 尝试从字符串中提取数值
      // 移除货币符号、百分号、逗号等
      const numericStr = value.replace(/[$,%]/g, '').replace(/,/g, '');
      const parsed = parseFloat(numericStr);
      if (!isNaN(parsed)) {
        return parsed;
      }
    }
    return 0;
  };

  const formatCurrency = (value: number): string => {
    const safeValue = safeNumber(value);
    const absValue = Math.abs(safeValue);
    const prefix = safeValue >= 0 ? '+$' : '-$';

    if (absValue >= 1e9) {
      return `${prefix}${safeToFixed(absValue / 1e9, 2)}B`;
    } else if (absValue >= 1e6) {
      return `${prefix}${safeToFixed(absValue / 1e6, 2)}M`;
    } else if (absValue >= 1e3) {
      return `${prefix}${safeToFixed(absValue / 1e3, 2)}K`;
    }
    return `${prefix}${safeToFixed(absValue, 2)}`;
  };

  // 专门用于格式化金额，统一正负号格式：+$123.45 或 -$123.45
  const formatMoney = (value: number): string => {
    const safeValue = safeNumber(value);
    const absValue = Math.abs(safeValue);
    const prefix = safeValue >= 0 ? '+$' : '-$';
    return `${prefix}${safeToFixed(absValue, 2)}`;
  };

  // 从本地存储加载回测历史，并清理旧脏数据
  const loadLocalBacktestHistory = (): BacktestHistoryItem[] => {
    try {
      const saved = localStorage.getItem('quant_backtest_history');
      if (saved) {
        const history = JSON.parse(saved);
        
        // 清理旧脏数据：过滤掉无效记录并修复字段
        const cleanedHistory = history
          .filter((item: BacktestHistoryItem) => {
            // 过滤掉没有backtestId的记录
            if (!item.backtestId || item.backtestId.trim() === '') {
              console.log('Filtered out record without backtestId:', item);
              return false;
            }
            return true;
          })
          .map((item: BacktestHistoryItem) => {
            // 修复symbol字段：将'Unknown'或空值改为'N/A'
            if (!item.symbol || item.symbol === 'Unknown' || item.symbol.trim() === '') {
              return { ...item, symbol: 'N/A' };
            }
            
            // 修复strategy字段：将'Unknown'或空值改为'N/A'
            if (!item.strategy || item.strategy === 'Unknown' || item.strategy.trim() === '') {
              return { ...item, strategy: 'N/A' };
            }
            
            // 确保status字段有效
            if (!item.status || !['running', 'completed', 'failed'].includes(item.status)) {
              return { ...item, status: 'completed' as const };
            }
            
            return item;
          });
        
        // 如果清理后的历史记录与原始不同，保存清理后的版本
        if (cleanedHistory.length !== history.length) {
          console.log(`Cleaned backtest history: removed ${history.length - cleanedHistory.length} invalid records`);
          saveLocalBacktestHistory(cleanedHistory);
        }
        
        return cleanedHistory;
      }
    } catch (err) {
      console.error('Failed to load local backtest history:', err);
    }
    return [];
  };

  // 保存回测历史到本地存储
  const saveLocalBacktestHistory = (history: BacktestHistoryItem[]) => {
    try {
      // 只保存最近20条记录，避免localStorage过大
      const limitedHistory = history.slice(0, 20);
      localStorage.setItem('quant_backtest_history', JSON.stringify(limitedHistory));
    } catch (err) {
      console.error('Failed to save local backtest history:', err);
    }
  };

  // 删除本地回测历史记录
  const deleteLocalBacktestHistory = (backtestId: string) => {
    try {
      const currentHistory = loadLocalBacktestHistory();
      const updatedHistory = currentHistory.filter(item => item.backtestId !== backtestId);
      saveLocalBacktestHistory(updatedHistory);
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
      const currentHistory = loadLocalBacktestHistory();

      // 创建历史记录项
      const symbol = backtestResult.parameters?.symbols?.[0] || 'Unknown';
      const strategy = backtestResult.parameters?.strategy || 'Unknown';
      const startDate = backtestResult.parameters?.startDate || '';
      const endDate = backtestResult.parameters?.endDate || '';

      const historyItem: BacktestHistoryItem = {
        backtestId: backtestResult.backtestId || `local_${Date.now()}`,
        status: backtestResult.success ? 'completed' : 'failed',
        results: backtestResult.results,
        parameters: backtestResult.parameters,
        createdAt: new Date().toISOString(),
        // 平铺字段用于表格显示
        symbol: symbol,
        strategy: strategy,
        startDate: startDate,
        endDate: endDate,
        initialCapital: safeNumber(backtestResult.parameters?.initialCapital),
        totalReturn: safeNumber(backtestResult.results?.totalReturn),
        sharpeRatio: safeNumber(backtestResult.results?.sharpeRatio),
        maxDrawdown: safeNumber(backtestResult.results?.maxDrawdown),
        winRate: safeNumber(backtestResult.results?.winRate),
        trades: safeNumber(backtestResult.results?.trades),
        annualizedReturn: safeNumber(backtestResult.results?.annualizedReturn),
        profitLoss: safeNumber(backtestResult.results?.profitLoss),
      };

      // 添加到历史记录开头（最新在最前面）
      const updatedHistory = [historyItem, ...currentHistory];

      // 保存到本地存储
      saveLocalBacktestHistory(updatedHistory);

      // 更新状态
      setBacktestHistory(updatedHistory);

      console.log('Added backtest to history:', historyItem);
      return historyItem;
    } catch (err) {
      console.error('Failed to add backtest to history:', err);
      return null;
    }
  };

  const fetchBacktestHistory = async () => {
    try {
      setHistoryLoading(true);

      // 首先从本地存储加载历史记录
      const localHistory = loadLocalBacktestHistory();
      let combinedHistory = [...localHistory];

      // 然后尝试从后端API获取历史记录
      try {
        const response = await backtraderAPI.getBacktestHistory();
        if (response.data && response.data.history && Array.isArray(response.data.history)) {
          // 转换后端数据为前端需要的平铺结构
          const apiHistoryData = response.data.history.map((item: any) => {
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
              // 平铺字段用于表格显示
              symbol: symbol,
              strategy: strategy,
              startDate: startDate,
              endDate: endDate,
              initialCapital: safeNumber(item.parameters?.initialCapital),
              totalReturn: safeNumber(item.results?.totalReturn),
              sharpeRatio: safeNumber(item.results?.sharpeRatio),
              maxDrawdown: safeNumber(item.results?.maxDrawdown),
              winRate: safeNumber(item.results?.winRate),
              trades: safeNumber(item.results?.trades),
              annualizedReturn: safeNumber(item.results?.annualizedReturn),
              profitLoss: safeNumber(item.results?.profitLoss),
            };
          });

          // 合并本地和后端历史记录，去重（基于backtestId）
          const apiHistoryMap = new Map();
          apiHistoryData.forEach((item: any) => {
            if (item.backtestId) {
              apiHistoryMap.set(item.backtestId, item);
            }
          });

          // 添加本地历史记录中不存在的后端记录
          localHistory.forEach(item => {
            if (item.backtestId && !apiHistoryMap.has(item.backtestId)) {
              apiHistoryMap.set(item.backtestId, item);
            }
          });

          combinedHistory = Array.from(apiHistoryMap.values());

          // 按创建时间排序（最新的在最前面）
          combinedHistory.sort((a, b) => {
            const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return dateB - dateA;
          });
        }
      } catch (apiErr) {
        console.warn('Failed to fetch backtest history from API, using local storage only:', apiErr);
        // API失败时只使用本地存储
      }

      setBacktestHistory(combinedHistory);

    } catch (err) {
      console.error('Failed to fetch backtest history:', err);
      // 如果出错，使用本地存储
      const localHistory = loadLocalBacktestHistory();
      setBacktestHistory(localHistory);
    } finally {
      setHistoryLoading(false);
    }
  };

  // 加载已保存的策略
  useEffect(() => {
    const loadSavedStrategies = () => {
      try {
        const saved = localStorage.getItem('quant_saved_strategies');
        if (saved) {
          setSavedStrategies(JSON.parse(saved));
        }
      } catch (err) {
        console.error('Failed to load saved strategies:', err);
      }
    };
    loadSavedStrategies();
  }, []);

  // 保存策略到localStorage
  const saveCurrentStrategy = () => {
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
      setSavedStrategies(updatedStrategies);
      localStorage.setItem('quant_saved_strategies', JSON.stringify(updatedStrategies));
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
      message.success(language === 'zh-CN' ? `策略 "${strategy.name}" 加载成功！` : `Strategy "${strategy.name}" loaded successfully!`);
    } catch (err) {
      console.error('Failed to load strategy:', err);
      message.error(language === 'zh-CN' ? '加载策略失败' : 'Failed to load strategy');
    }
  };

  // 删除策略
  const deleteStrategy = (id: string) => {
    try {
      const updatedStrategies = savedStrategies.filter(s => s.id !== id);
      setSavedStrategies(updatedStrategies);
      localStorage.setItem('quant_saved_strategies', JSON.stringify(updatedStrategies));
      message.success(language === 'zh-CN' ? '策略已删除！' : 'Strategy deleted successfully!');
    } catch (err) {
      console.error('Failed to delete strategy:', err);
      message.error(language === 'zh-CN' ? '删除策略失败' : 'Failed to delete strategy');
    }
  };

  // 解析 symbol 并更新 portfolio 状态
  const parseSymbols = (symbolInput: string) => {
    // 清理输入：去除前后空格，处理空输入
    const cleanedInput = symbolInput.trim();
    if (!cleanedInput) {
      setPortfolioSymbols([]);
      return [];
    }

    // 分割多个symbol（支持逗号分隔）
    const symbols = cleanedInput
      .split(',')
      .map((s: string) => s.trim())
      .filter(Boolean);

    setPortfolioSymbols(symbols);
    return symbols;
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
        setError('请输入股票代码或公司名');
        setLoading(false);
        return;
      }

      // 解析多个 symbol，支持逗号分隔
      const symbols = parseSymbols(cleanedSymbolInput);

      // 检查解析结果
      console.log('Parsed symbols:', symbols);

      if (symbols.length === 0) {
        setError('请输入有效的股票代码或公司名');
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
          const mergedResult = {
            ...result.result,
            success: result.success !== undefined ? result.success : (result.status === 'completed')
          };
          setBacktestResult(mergedResult);
          setLoading(false);

          // 如果有status字段，根据状态显示相应消息
          if (result.status === 'completed') {
            message.success(t.backtest.backtestCompleted);
          } else if (result.status === 'failed') {
            message.error(language === 'zh-CN' ? '回测失败，请检查参数后重试。' : 'Backtest failed. Please check parameters and try again.');
          } else if (result.status) {
            message.info(language === 'zh-CN' ? `回测状态：${result.status}` : `Backtest status: ${result.status}`);
          } else {
            message.success(t.backtest.backtestCompleted);
          }

          // 滚动到结果区域
          setTimeout(() => {
            resultsRef.current?.scrollIntoView({ behavior: 'smooth' });
          }, 100);

          // 保存到历史记录
          if (mergedResult) {
            addToBacktestHistory(mergedResult);
          }

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
      setError(language === 'zh-CN' ? `回测运行错误：${err.message || '未知错误'}` : `Error running backtest: ${err.message || 'Unknown error'}`);
      message.error(language === 'zh-CN' ? '回测运行失败' : 'Failed to run backtest');
      console.error('Backtest error:', err);
      setLoading(false);
    }
  };

  const loadBacktestResult = async (backtestId: string) => {
    try {
      const response = await backtraderAPI.getBacktestResults(backtestId);
      if (response.data) {
        // 合并result和success字段
        const mergedResult = {
          ...response.data.result,
          success: response.data.success !== undefined ? response.data.success : true
        };
        setBacktestResult(mergedResult);
        // 滚动到结果区域
        setTimeout(() => {
          resultsRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
        message.success(language === 'zh-CN' ? '回测结果已加载' : 'Backtest results loaded');
      }
    } catch (err) {
      console.error('Error loading backtest:', err);
      message.error(language === 'zh-CN' ? '加载回测结果失败' : 'Failed to load backtest results');
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

  const handleViewBacktest = (record: BacktestHistoryItem) => {
    try {
      console.log('Viewing backtest:', record.backtestId);

      // 从历史记录中查找完整结果
      const currentHistory = loadLocalBacktestHistory();
      const foundRecord = currentHistory.find(item => item.backtestId === record.backtestId);

      if (foundRecord) {
        // 从历史记录中提取完整的results数据
        const historyResults = foundRecord.results || {};
        
        // 创建完整的BacktestResult对象，使用历史记录中的真实数据
        const backtestResult: BacktestResult = {
          backtestId: foundRecord.backtestId,
          status: foundRecord.status as 'running' | 'completed' | 'failed',
          success: foundRecord.status === 'completed',
          results: {
            // 使用历史记录中的真实数据，而不是硬编码的0
            totalReturn: (historyResults as any).totalReturn || foundRecord.totalReturn || 0,
            sharpeRatio: (historyResults as any).sharpeRatio || foundRecord.sharpeRatio || 0,
            maxDrawdown: (historyResults as any).maxDrawdown || foundRecord.maxDrawdown || 0,
            winRate: (historyResults as any).winRate || foundRecord.winRate || 0,
            trades: (historyResults as any).trades || foundRecord.trades || 0,
            annualizedReturn: (historyResults as any).annualizedReturn || foundRecord.annualizedReturn || 0,
            profitLoss: (historyResults as any).profitLoss || foundRecord.profitLoss || 0,
            // 从历史记录中提取完整的图表和交易数据
            chartData: (historyResults as any).chartData || [],
            equityCurve: (historyResults as any).equityCurve || [],
            tradesList: (historyResults as any).tradesList || [],
            // 其他指标，如果有的话
            volatility: (historyResults as any).volatility || 0,
            sortinoRatio: (historyResults as any).sortinoRatio || 0,
            profitFactor: (historyResults as any).profitFactor || 0,
            expectancy: (historyResults as any).expectancy || 0,
            exposure: (historyResults as any).exposure || 0,
            calmarRatio: (historyResults as any).calmarRatio || 0,
            avgReturnPerTrade: (historyResults as any).avgReturnPerTrade || 0,
            avgWin: (historyResults as any).avgWin || 0,
            avgLoss: (historyResults as any).avgLoss || 0
          },
          parameters: foundRecord.parameters || {
            strategy: foundRecord.strategy || 'Unknown',
            symbols: foundRecord.symbol ? [foundRecord.symbol] : ['Unknown'],
            period: foundRecord.startDate && foundRecord.endDate ? `${foundRecord.startDate} ${language === 'zh-CN' ? '至' : 'to'} ${foundRecord.endDate}` : (language === 'zh-CN' ? '未知' : 'Unknown'),
            initialCapital: foundRecord.initialCapital || 100000,
            startDate: foundRecord.startDate || '',
            endDate: foundRecord.endDate || '',
            // 保留其他参数
            dataMode: (foundRecord.parameters as any)?.dataMode || 'real',
            dataModeDisplay: (foundRecord.parameters as any)?.dataModeDisplay || t.backtest.realData,
            dataSource: (foundRecord.parameters as any)?.dataSource || 'Alpaca'
          },
          createdAt: foundRecord.createdAt
        };

        // 设置回测结果
        setBacktestResult(backtestResult);

        // 滚动到结果区域
        setTimeout(() => {
          resultsRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);

        message.success(language === 'zh-CN' ? `已加载回测：${foundRecord.symbol} - ${foundRecord.strategy}` : `Loaded backtest: ${foundRecord.symbol} - ${foundRecord.strategy}`);
      } else {
        // 如果没有找到，尝试从后端API加载
        if (record.backtestId && !record.backtestId.startsWith('local_')) {
          loadBacktestResult(record.backtestId);
        } else {
          message.warning(language === 'zh-CN' ? '本地存储中未找到回测数据' : 'Backtest data not found in local storage');
        }
      }
    } catch (err) {
      console.error('Error viewing backtest:', err);
      message.error(language === 'zh-CN' ? '加载回测结果失败' : 'Failed to load backtest results');
    }
  };

  const strategyOptions = [
    { value: 'moving_average', label: t.backtest.strategyMovingAverage },
    { value: 'rsi', label: t.backtest.strategyRsi },
    { value: 'macd', label: t.backtest.strategyMacd },
    { value: 'bollinger', label: t.backtest.strategyBollinger },
    { value: 'momentum', label: t.backtest.strategyMomentum },
    { value: 'mean_reversion', label: t.backtest.strategyMeanReversion },
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

        if (record.key === 'profitLoss') {
          // Profit/Loss 是金额，使用货币格式
          const color = safeValue >= 0 ? '#3f8600' : '#cf1322';
          const formatted = formatCurrency(safeValue);
          return <span style={{ color, fontWeight: 'bold' }}>{formatted}</span>;
        } else if (record.key === 'totalReturn' || record.key === 'annualizedReturn') {
          // Return 类指标使用百分比格式
          const color = safeValue >= 0 ? '#3f8600' : '#cf1322';
          const prefix = safeValue >= 0 ? '+' : '';
          return <span style={{ color, fontWeight: 'bold' }}>{prefix}{safeToFixed(safeValue, 2)}%</span>;
        } else if (record.key === 'expectancy') {
          const color = safeValue >= 0 ? '#3f8600' : '#cf1322';
          const prefix = safeValue >= 0 ? '+$' : '-$';
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
          return <span style={{ color: '#cf1322', fontWeight: 'bold' }}>{safeToFixed(safeValue, 2)}%</span>;
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
          'moving_average': t.backtest.strategyMovingAverage,
          'rsi': t.backtest.strategyRsi,
          'macd': t.backtest.strategyMacd,
          'bollinger': t.backtest.strategyBollinger,
          'momentum': t.backtest.strategyMomentum,
          'mean_reversion': t.backtest.strategyMeanReversion
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
        const color = safeValue >= 0 ? '#3f8600' : '#cf1322';
        return <span style={{ color, fontWeight: 'bold', fontSize: '12px' }}>
          {safeValue >= 0 ? '+' : ''}{safeToFixed(safeValue, 2)}%
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
            onClick={() => handleViewBacktest(record)}
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
    'moving_average': t.backtest.strategyMovingAverage,
    'rsi': t.backtest.strategyRsi,
    'macd': t.backtest.strategyMacd,
    'bollinger': t.backtest.strategyBollinger,
    'momentum': t.backtest.strategyMomentum,
    'mean_reversion': t.backtest.strategyMeanReversion
  };

  // Strategy name mapping for blueprint display (shorter names)
  const strategyNameBlueprint: Record<string, string> = {
    'moving_average': t.backtest.strategyNameMovingAverage,
    'rsi': t.backtest.strategyNameRsi,
    'macd': t.backtest.strategyNameMacd,
    'bollinger': t.backtest.strategyNameBollinger,
    'momentum': t.backtest.strategyNameMomentum,
    'mean_reversion': t.backtest.strategyNameMeanReversion
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
  };


  // 生成权益曲线数据
  const generateEquityCurveData = () => {
    if (backtestResult?.results?.equityCurve && backtestResult.results.equityCurve.length > 0) {
      const rawData = backtestResult.results.equityCurve;
      const sortedByDate = sortByDateAsc(rawData);
      
      const firstEquity = sortedByDate[0]?.equity || 0;
      const lastEquity = sortedByDate[sortedByDate.length - 1]?.equity || 0;
      const totalReturn = backtestResult.results.totalReturn || 0;
      
      const needsFix = 
        (totalReturn > 0 && firstEquity > lastEquity) || 
        (totalReturn < 0 && firstEquity < lastEquity);
      
      if (needsFix) {
        const equities = sortedByDate.map(item => item.equity);
        const reversedEquities = [...equities].reverse();
        return sortedByDate.map((item, index) => ({
          date: item.date,
          equity: reversedEquities[index]
        }));
      }
      return sortedByDate;
    }
    return [];
  };

  const equityCurveData = sortByDateAsc(generateEquityCurveData());

  const resultData = backtestResult ? [
    { key: 'strategy', metric: t.backtest.strategyLabel, value: strategyNames[backtestResult.parameters?.strategy] || backtestResult.parameters?.strategy || t.backtest.unknown, description: t.backtest.descStrategy },
    { key: 'dataMode', metric: t.backtest.dataMode, value: backtestResult.parameters?.dataModeDisplay || t.backtest.realData, description: t.backtest.descDataMode },
    { key: 'dataSource', metric: t.backtest.dataSource, value: backtestResult.parameters?.dataSource || t.backtest.financialApis, description: t.backtest.descDataSource },
    { key: 'status', metric: t.backtest.statusLabel, value: backtestResult.success ? t.backtest.completed : t.backtest.failed, description: t.backtest.descStatus },
    { key: 'totalReturn', metric: t.backtest.totalReturnLabel, value: safeToFixed(backtestResult.results?.totalReturn || 0, 2), description: t.backtest.descTotalReturn },
    { key: 'annualizedReturn', metric: t.backtest.annualizedReturn, value: safeToFixed(backtestResult.results?.annualizedReturn || 0, 2), description: t.backtest.descAnnualizedReturn },
    { key: 'profitLoss', metric: t.backtest.profitLoss, value: formatMoney(backtestResult.results?.profitLoss || 0), description: t.backtest.descProfitLoss },
    { key: 'sharpeRatio', metric: t.backtest.sharpeRatioLabel, value: safeToFixed(backtestResult.results?.sharpeRatio || 0, 2), description: t.backtest.descSharpeRatio },
    { key: 'calmarRatio', metric: t.backtest.calmarRatio, value: safeNumber(backtestResult.results?.calmarRatio || 0), description: t.backtest.descCalmarRatio },
    { key: 'maxDrawdown', metric: t.backtest.maxDrawdownLabel, value: safeNumber(backtestResult.results?.maxDrawdown || 0), description: t.backtest.descMaxDrawdown },
    { key: 'winRate', metric: t.backtest.winRateLabel, value: safeToFixed(backtestResult.results?.winRate || 0, 1), description: t.backtest.descWinRate },
    { key: 'trades', metric: t.backtest.totalTrades, value: backtestResult.results?.trades || 0, description: t.backtest.descTrades },
    { key: 'avgReturnPerTrade', metric: t.backtest.avgPnlPerTrade, value: formatMoney(backtestResult.results?.avgReturnPerTrade || 0), description: t.backtest.descAvgPnl },
    { key: 'volatility', metric: t.backtest.volatility, value: safeNumber(backtestResult.results?.volatility || 0), description: t.backtest.descVolatility },
    { key: 'sortinoRatio', metric: t.backtest.sortinoRatio, value: safeToFixed(backtestResult.results?.sortinoRatio || 0, 2), description: t.backtest.descSortinoRatio },
    { key: 'profitFactor', metric: t.backtest.profitFactor, value: backtestResult.results?.profitFactor === null || backtestResult.results?.profitFactor === undefined ? t.common.na : safeToFixed(backtestResult.results.profitFactor, 2), description: t.backtest.descProfitFactor },
    { key: 'expectancy', metric: t.backtest.expectancy, value: formatMoney(backtestResult.results?.expectancy || 0), description: t.backtest.descExpectancy },
    { key: 'exposure', metric: t.backtest.avgEquityRatio, value: safeNumber(backtestResult.results?.exposure || 0), description: t.backtest.descExposure },
  ] : [];
  
  const calculateDrawdownFromEquity = (equityData: Array<{date: string, equity: number}>) => {
    const drawdownData: Array<{date: string, drawdown: number, equity: number, peak: number}> = [];
    let peak = equityData.length > 0 ? equityData[0].equity : 0;
    
    for (let i = 0; i < equityData.length; i++) {
      const currentEquity = equityData[i].equity;
      peak = Math.max(peak, currentEquity);
      const drawdown = peak > 0 ? ((peak - currentEquity) / peak) * 100 : 0;
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

  return (
    <div className="backtest-page-shell">
      <style>{`
        .backtest-page-shell {
          max-width: 1600px;
          margin: 0 auto;
        }
        .backtest-main-layout {
          display: grid;
          grid-template-columns: minmax(0, 1.45fr) minmax(420px, 520px);
          gap: 20px;
          align-items: start;
        }
        @media (max-width: 1250px) {
          .backtest-main-layout {
            grid-template-columns: 1fr;
          }
        }
        .premium-card { 
          border-radius: 16px !important; 
          border: 1px solid rgba(15, 23, 24, 0.08) !important; 
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.02) !important; 
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important; 
          background: #fff !important;
          overflow: hidden;
        }
        .premium-card:hover { 
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.04) !important; 
          transform: translateY(-1px) !important; 
          border-color: rgba(24, 144, 255, 0.15) !important;
        }
        .config-card .ant-card-body {
          padding: 20px 22px !important;
        }
        .side-panel-card .ant-card-head {
          padding: 0 16px !important;
          min-height: 48px !important;
        }
        .side-panel-card .ant-card-head-title {
          padding: 12px 0 !important;
        }
        .section-header { display: flex; align-items: center; gap: 10px; margin-bottom: 20px; }
        .section-title { font-size: 18px; font-weight: 700; color: #0f172a; margin: 0; }
        .performance-strip { display: flex; gap: 12px; margin-bottom: 24px; overflow-x: auto; padding: 4px 0 12px 0; }
        .stat-metric-card { 
          flex: 1; 
          min-width: 140px; 
          background: #fff; 
          padding: 16px 18px; 
          border-radius: 14px; 
          border: 1px solid rgba(15, 23, 24, 0.08); 
          box-shadow: 0 2px 6px rgba(0,0,0,0.01); 
          transition: all 0.2s ease; 
        }
        .stat-metric-card:hover { border-color: #1890ff; box-shadow: 0 4px 12px rgba(24,144,255,0.08); }
        .stat-metric-label { font-size: 10.5px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.8px; font-weight: 700; margin-bottom: 4px; display: block; }
        .stat-metric-value { font-size: 22px; font-weight: 800; color: #0f172a; line-height: 1.1; }
        .info-strip { 
          background: linear-gradient(90deg, #f8fafc 0%, #ffffff 100%); 
          border: 1px solid rgba(15, 23, 24, 0.06); 
          border-radius: 12px; 
          padding: 16px 20px; 
          margin-bottom: 24px; 
        }
        .blueprint-module { background: #f8fafc; border-radius: 12px; padding: 18px; border: 1px solid rgba(15, 23, 24, 0.06); height: 100%; }
        .blueprint-label { font-size: 10.5px; color: #94a3b8; font-weight: 700; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px; }
        .blueprint-value { font-size: 14px; font-weight: 700; color: #0f172a; }
        .chart-container-premium { background: #fff; border-radius: 16px; border: 1px solid rgba(15, 23, 24, 0.08); padding: 20px; margin-bottom: 24px; }
        .recent-backtest-row:hover { background-color: rgba(24, 144, 255, 0.02) !important; cursor: pointer; }
        .recent-backtest-row.selected-row { background-color: #eff6ff !important; }
        
        .backtest-form-input { height: 40px !important; border-radius: 10px !important; border-color: #e2e8f0 !important; }
        .backtest-form-label { font-size: 13.5px; font-weight: 600; color: #475569; }
        .execution-inner-panel {
          background: #f8fafc;
          border: 1px solid rgba(15, 23, 24, 0.06);
          border-radius: 14px;
          padding: 16px;
          margin-bottom: 24px;
        }
        .primary-cta-button { 
          height: 42px; 
          font-weight: 700; 
          border-radius: 12px; 
          box-shadow: 0 4px 12px rgba(24, 144, 255, 0.15); 
          font-size: 15px;
        }
        .secondary-action-btn {
          height: 40px !important;
          border-radius: 10px !important;
          font-weight: 600 !important;
          font-size: 13.5px !important;
        }
        .history-table-container {
          width: 100%;
          overflow-x: auto;
        }
        .history-table .ant-table-thead > tr > th {
          background: #f1f5f9 !important;
          font-size: 11px !important;
          text-transform: uppercase !important;
          letter-spacing: 0.5px !important;
          color: #64748b !important;
          font-weight: 700 !important;
          padding: 12px 8px !important;
          white-space: nowrap;
        }
        .history-table .ant-table-tbody > tr > td {
          padding: 12px 8px !important;
          height: 58px;
        }
        .history-table .ant-pagination {
          padding: 12px 14px !important;
          margin: 0 !important;
          border-top: 1px solid rgba(15, 23, 24, 0.06);
        }
        /* Custom scrollbar for the table */
        .history-table-container::-webkit-scrollbar {
          height: 6px;
        }
        .history-table-container::-webkit-scrollbar-track {
          background: #f1f5f9;
        }
        .history-table-container::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 3px;
        }
        .history-table-container::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
      `}</style>

      {/* ── Page Header ── */}
      <div style={{ marginBottom: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 44, height: 44, borderRadius: '12px', background: 'linear-gradient(135deg, #1890ff 0%, #003a8c 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 22, boxShadow: '0 4px 12px rgba(24, 144, 255, 0.25)' }}>
            <LineChartOutlined />
          </div>
          <div>
            <Title level={1} style={{ margin: 0, fontSize: 'clamp(24px, 2.2vw, 30px)', fontWeight: 800, letterSpacing: '-0.02em', color: '#0f172a' }}>{t.backtest.title}</Title>
            <Text style={{ fontSize: 14, color: '#64748b' }}>{t.backtest.subtitleForm}</Text>
          </div>
        </div>
        <div style={{ background: '#fff', padding: '8px 16px', borderRadius: '12px', border: '1px solid rgba(15, 23, 24, 0.06)' }}>
           <Badge status="processing" text={<Text strong style={{ color: '#1890ff', fontSize: 12, letterSpacing: '0.5px' }}>{t.backtest.engineReady.toUpperCase()}</Text>} />
        </div>
      </div>

      {error && (
        <Alert message={t.backtest.systemNotification} description={error} type="error" showIcon style={{ marginBottom: 24, borderRadius: 12 }} closable onClose={() => setError('')} />
      )}

      <div className="backtest-main-layout">
        <div className="backtest-left-panel">
          <Card className="premium-card config-card" title={<span style={{ fontWeight: 800, fontSize: 16, color: '#0f172a' }}>{t.backtest.configuration}</span>}>
            <Form form={form} layout="vertical" onFinish={handleRunBacktest} requiredMark={false}>
              <Row gutter={18}>
                <Col span={10}>
                  <Form.Item label={<span className="backtest-form-label">{t.backtest.stockSymbol}</span>} name="symbol" rules={[{ required: true, message: t.backtest.stockSymbolRequired }]} help={<span style={{ fontSize: 11, color: '#94a3b8' }}>{t.backtest.stockSymbolHelp}</span>}>
                    <Input placeholder={t.backtest.stockSymbolPlaceholder} className="backtest-form-input" prefix={<LineChartOutlined style={{ color: '#94a3b8' }} />} onChange={(e) => parseSymbols(e.target.value)} />
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
                <div style={{ marginBottom: '20px', padding: '10px 14px', background: 'rgba(24, 144, 255, 0.04)', border: '1px solid #bae7ff', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Tag color="blue" style={{ borderRadius: 4, fontWeight: 700, fontSize: 10 }}>{t.backtest.portfolioActive}</Tag>
                  <Text style={{ fontSize: 12.5, color: '#0050b3', fontWeight: 500 }}>{t.backtest.portfolioMode.replace('{count}', String(portfolioSymbols.length))}</Text>
                </div>
              )}

              <div className="execution-inner-panel">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h4 style={{ margin: 0, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '1px' }}>{t.backtest.executionParams}</h4>
                  <Badge status="success" text={<Text style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>{t.backtest.realMarketData}</Text>} />
                </div>

                {selectedStrategy === 'moving_average' && (
                  <Row gutter={16}>
                    <Col span={12}><Form.Item label={<span style={{ fontSize: 12 }}>{t.backtest.shortMaPeriod}</span>} name="shortMaPeriod" extra={<span style={{ fontSize: 10, color: '#94a3b8' }}>{t.backtest.defaultLabel.replace('{value}', '20')}</span>}><InputNumber min={1} max={200} className="backtest-form-input" style={{ width: '100%' }} /></Form.Item></Col>
                    <Col span={12}><Form.Item label={<span style={{ fontSize: 12 }}>{t.backtest.longMaPeriod}</span>} name="longMaPeriod" extra={<span style={{ fontSize: 10, color: '#94a3b8' }}>{t.backtest.defaultLabel.replace('{value}', '50')}</span>}><InputNumber min={1} max={200} className="backtest-form-input" style={{ width: '100%' }} /></Form.Item></Col>
                  </Row>
                )}
                {selectedStrategy === 'rsi' && (
                  <Row gutter={16}>
                    <Col span={8}><Form.Item label={<span style={{ fontSize: 12 }}>{t.backtest.rsiPeriod}</span>} name="rsiPeriod" extra={<span style={{ fontSize: 10 }}>{t.backtest.defaultLabel.replace('{value}', '14')}</span>}><InputNumber min={1} max={50} className="backtest-form-input" style={{ width: '100%' }} /></Form.Item></Col>
                    <Col span={8}><Form.Item label={<span style={{ fontSize: 12 }}>{t.backtest.oversold}</span>} name="rsiOversold" extra={<span style={{ fontSize: 10 }}>{t.backtest.defaultLabel.replace('{value}', '30')}</span>}><InputNumber min={1} max={100} className="backtest-form-input" style={{ width: '100%' }} /></Form.Item></Col>
                    <Col span={8}><Form.Item label={<span style={{ fontSize: 12 }}>{t.backtest.overbought}</span>} name="rsiOverbought" extra={<span style={{ fontSize: 10 }}>{t.backtest.defaultLabel.replace('{value}', '70')}</span>}><InputNumber min={1} max={100} className="backtest-form-input" style={{ width: '100%' }} /></Form.Item></Col>
                  </Row>
                )}
                {selectedStrategy === 'macd' && (
                  <Row gutter={16}>
                    <Col span={8}><Form.Item label={<span style={{ fontSize: 12 }}>{t.backtest.fastEma}</span>} name="macdFast" extra={<span style={{ fontSize: 10 }}>{t.backtest.defaultLabel.replace('{value}', '12')}</span>}><InputNumber min={1} max={50} className="backtest-form-input" style={{ width: '100%' }} /></Form.Item></Col>
                    <Col span={8}><Form.Item label={<span style={{ fontSize: 12 }}>{t.backtest.slowEma}</span>} name="macdSlow" extra={<span style={{ fontSize: 10 }}>{t.backtest.defaultLabel.replace('{value}', '26')}</span>}><InputNumber min={1} max={50} className="backtest-form-input" style={{ width: '100%' }} /></Form.Item></Col>
                    <Col span={8}><Form.Item label={<span style={{ fontSize: 12 }}>{t.backtest.signal}</span>} name="macdSignal" extra={<span style={{ fontSize: 10 }}>{t.backtest.defaultLabel.replace('{value}', '9')}</span>}><InputNumber min={1} max={50} className="backtest-form-input" style={{ width: '100%' }} /></Form.Item></Col>
                  </Row>
                )}
                {selectedStrategy === 'bollinger' && (
                  <Row gutter={16}>
                    <Col span={12}><Form.Item label={<span style={{ fontSize: 12 }}>{t.backtest.periodLabel}</span>} name="bollingerPeriod" extra={<span style={{ fontSize: 10 }}>{t.backtest.defaultLabel.replace('{value}', '20')}</span>}><InputNumber min={5} max={100} className="backtest-form-input" style={{ width: '100%' }} /></Form.Item></Col>
                    <Col span={12}><Form.Item label={<span style={{ fontSize: 12 }}>{t.backtest.stdDev}</span>} name="bollingerStdDev" extra={<span style={{ fontSize: 10 }}>{t.backtest.defaultLabel.replace('{value}', '2')}</span>}><InputNumber min={1} max={5} step={0.1} className="backtest-form-input" style={{ width: '100%' }} /></Form.Item></Col>
                  </Row>
                )}
                {selectedStrategy === 'momentum' && (
                  <Col span={12}>
                    <Form.Item label={<span style={{ fontSize: 12 }}>{t.backtest.momentumPeriod}</span>} name="momentumPeriod" extra={<span style={{ fontSize: 10 }}>{t.backtest.defaultLabel.replace('{value}', '20')}</span>}><InputNumber min={1} max={50} className="backtest-form-input" style={{ width: '100%' }} /></Form.Item>
                  </Col>
                )}
                {selectedStrategy === 'mean_reversion' && (
                  <Row gutter={12}>
                    <Col span={8}><Form.Item label={<span style={{ fontSize: 12 }}>{t.backtest.lookbackPeriod}</span>} name="lookbackPeriod" extra={<span style={{ fontSize: 9 }}>{t.backtest.defaultLabel.replace('{value}', '20')}</span>}><InputNumber min={5} max={100} className="backtest-form-input" style={{ width: '100%' }} /></Form.Item></Col>
                    <Col span={8}><Form.Item label={<span style={{ fontSize: 12 }}>Z-Score Entry</span>} name="entryZScore" extra={<span style={{ fontSize: 9 }}>{t.backtest.defaultLabel.replace('{value}', '-2.0')}</span>}><InputNumber step={0.1} min={-5} max={0} className="backtest-form-input" style={{ width: '100%' }} /></Form.Item></Col>
                    <Col span={8}><Form.Item label={<span style={{ fontSize: 12 }}>Stop Loss %</span>} name="stopLossPct" extra={<span style={{ fontSize: 9 }}>{t.backtest.defaultLabel.replace('{value}', '6')}</span>}><InputNumber min={1} max={20} step={0.5} className="backtest-form-input" style={{ width: '100%' }} /></Form.Item></Col>
                  </Row>
                )}
              </div>

              <Row gutter={20}>
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

              <div style={{ marginTop: 12 }}>
                <Button type="primary" htmlType="submit" size="large" loading={loading} icon={<PlayCircleOutlined />} className="primary-cta-button" style={{ width: '100%', marginBottom: 14 }} disabled={loading}>
                  {loading ? t.backtest.executingSimulation : t.backtest.executeBacktest}
                </Button>
                <div style={{ display: 'flex', gap: 12 }}>
                  <Button style={{ flex: 1 }} className="secondary-action-btn" icon={<SaveOutlined />} onClick={saveCurrentStrategy}>{t.backtest.savePlan}</Button>
                  <Button style={{ flex: 1 }} className="secondary-action-btn" icon={<FolderOpenOutlined />} onClick={() => setShowSavedStrategies(!showSavedStrategies)}>{showSavedStrategies ? t.backtest.hidePlans : t.backtest.savedPlans}</Button>
                  <Button style={{ flex: 1 }} className="secondary-action-btn" type="dashed" icon={<PlayCircleOutlined />} onClick={() => {
                    const formValues = form.getFieldsValue();
                    if (formValues.strategy === 'moving_average') {
                      const backtestParams = { strategy: 'MA_CROSSOVER', symbol: formValues.symbol, shortMaPeriod: formValues.shortMaPeriod || 20, longMaPeriod: formValues.longMaPeriod || 50, timestamp: new Date().toISOString() };
                      localStorage.setItem('quant_last_backtest_params', JSON.stringify(backtestParams));
                      message.success(t.backtest.strategyStaged);
                    } else { message.info(t.backtest.stageLimited); }
                  }}>{t.backtest.stageForPaper}</Button>
                </div>
              </div>
            </Form>
          </Card>

          {showSavedStrategies && (
            <Card className="premium-card" title={<span style={{ fontWeight: 800, fontSize: 15 }}>{t.backtest.strategyLibrary}</span>} style={{ marginTop: 24 }}>
              {savedStrategies.length === 0 ? (
                <Empty description={t.backtest.noSavedPlans} image={Empty.PRESENTED_IMAGE_SIMPLE} />
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {savedStrategies.map((strategy) => (
                    <Card key={strategy.id} size="small" className="premium-card" style={{ border: '1px solid rgba(15,23,24,0.06)' }}
                      title={<Text strong style={{ fontSize: 13.5 }}>{strategy.name}</Text>}
                      extra={
                        <Space>
                          <Button type="link" size="small" onClick={() => loadStrategy(strategy)} style={{ fontSize: 12 }}>{t.backtest.load}</Button>
                          <Button type="link" size="small" danger onClick={() => deleteStrategy(strategy.id)} style={{ fontSize: 12 }}>{t.backtest.delete}</Button>
                        </Space>
                      }
                    >
                      <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}><strong>{t.backtest.symbolLabel}:</strong> <span style={{ color: '#475569' }}>{strategy.config.symbol}</span></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}><strong>{t.backtest.strategyLabelShort}:</strong> <span style={{ color: '#475569' }}>{strategyNames[strategy.config.strategy] || strategy.config.strategy}</span></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}><strong>{t.backtest.createdLabel}:</strong> <span style={{ color: '#475569' }}>{new Date(strategy.createdTime).toLocaleDateString()}</span></div>
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
            title={<span style={{ fontWeight: 800, fontSize: 15, color: '#0f172a' }}><HistoryOutlined style={{ marginRight: 8, color: '#3b82f6' }} />{t.backtest.recentSessions}</span>} 
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
            {historyLoading ? <div style={{ textAlign: 'center', padding: '40px' }}><Spin /></div> : backtestHistory.length > 0 ? (
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
              <div style={{ padding: '40px 0' }}><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t.backtest.noPreviousSessions} /></div>
            )}
          </Card>
          <Card className="premium-card" title={<span style={{ fontWeight: 800, fontSize: 15, color: '#0f172a' }}>{t.backtest.quickInsights}</span>} style={{ marginTop: 20 }} bodyStyle={{ padding: 18 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Button block className="secondary-action-btn" onClick={() => navigate('/market')} icon={<LineChartOutlined />}>{t.backtest.exploreTopSymbols}</Button>
              <Button block className="secondary-action-btn" onClick={() => { form.setFieldsValue({ symbol: 'MSFT', strategy: 'rsi', initialCapital: 100000, dateRange: defaultDateRange() }); message.info(t.backtest.msftLoaded); }}>{t.backtest.loadMsftBlueprint}</Button>
              <Button block className="secondary-action-btn" onClick={() => { form.setFieldsValue({ symbol: 'TSLA', strategy: 'momentum', initialCapital: 100000, dateRange: defaultDateRange() }); message.info(t.backtest.tslaLoaded); }}>{t.backtest.loadTslaBlueprint}</Button>
            </div>
          </Card>
        </div>
      </div>

      {backtestResult && (
        <div ref={resultsRef} style={{ marginTop: 40 }}>
          <div className="section-header">
            <CheckCircleOutlined style={{ fontSize: 24, color: '#10b981' }} />
            <h2 className="section-title" style={{ fontSize: 22 }}>{t.backtest.backtestReport}</h2>
            <Tag color="success" style={{ borderRadius: 8, fontWeight: 700, fontSize: 10, padding: '1px 8px', border: 'none', background: '#f0fdf4', color: '#10b981' }}>{t.backtest.verified.toUpperCase()}</Tag>
          </div>

          <div className="performance-strip">
            {[
              { label: t.backtest.totalReturnLabel, value: `${(backtestResult.results?.totalReturn || 0) >= 0 ? '+' : ''}${safeToFixed(backtestResult.results?.totalReturn, 2)}%`, color: (backtestResult.results?.totalReturn || 0) >= 0 ? '#10b981' : '#ef4444' },
              { label: t.backtest.sharpeRatioLabel, value: safeToFixed(backtestResult.results?.sharpeRatio, 2), color: (backtestResult.results?.sharpeRatio || 0) >= 1 ? '#10b981' : '#f59e0b' },
              { label: t.backtest.maxDrawdownLabel, value: `${safeToFixed(backtestResult.results?.maxDrawdown, 2)}%`, color: '#ef4444' },
              { label: t.backtest.winRateLabel, value: `${safeToFixed(backtestResult.results?.winRate, 1)}%`, color: (backtestResult.results?.winRate || 0) >= 50 ? '#10b981' : '#f59e0b' },
              { label: t.backtest.totalTrades, value: backtestResult.results?.trades || 0, color: '#0f172a' },
              { label: t.backtest.netProfit, value: formatCurrency(backtestResult.results?.profitLoss || 0), color: (backtestResult.results?.profitLoss || 0) >= 0 ? '#10b981' : '#ef4444' }
            ].map(m => (
              <div key={m.label} className="stat-metric-card">
                <span className="stat-metric-label">{m.label}</span>
                <div className="stat-metric-value" style={{ color: m.color }}>{m.value}</div>
              </div>
            ))}
          </div>

          <Card className="premium-card" bodyStyle={{ padding: '8px 24px 24px 24px' }}>
            <Tabs defaultActiveKey="results" items={[
              {
                key: 'results', label: <span style={{ fontWeight: 700 }}>{t.backtest.overview}</span>, children: (
                  <div style={{ paddingTop: 8 }}>
                    <div className="info-strip">
                      <Row gutter={[24, 16]}>
                        <Col xs={12} sm={6}><div className="blueprint-label">{t.backtest.strategyModule}</div><div className="blueprint-value">{strategyNames[backtestResult.parameters.strategy] || backtestResult.parameters.strategy}</div></Col>
                        <Col xs={12} sm={6}><div className="blueprint-label">{t.backtest.instrument}</div><div className="blueprint-value">{backtestResult.parameters.symbol || backtestResult.parameters.symbols?.[0] || 'N/A'}</div></Col>
                        <Col xs={12} sm={6}><div className="blueprint-label">{t.backtest.initialEquity}</div><div className="blueprint-value" style={{ color: '#1890ff' }}>${backtestResult.parameters.initialCapital?.toLocaleString()}</div></Col>
                        <Col xs={12} sm={6}><div className="blueprint-label">{t.backtest.simulationPeriod}</div><div className="blueprint-value" style={{ fontSize: 12.5 }}>{backtestResult.parameters.period}</div></Col>
                      </Row>
                    </div>
                    <h4 style={{ fontSize: 14, fontWeight: 800, marginBottom: 16, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t.backtest.performanceBreakdown}</h4>
                    <Table columns={resultColumns} dataSource={resultData} pagination={false} size="middle" style={{ border: '1px solid rgba(15, 23, 24, 0.08)', borderRadius: 12, overflow: 'hidden' }} />
                  </div>
                )
              },
              {
                key: 'charts', label: <span style={{ fontWeight: 700 }}>{t.backtest.analyticsCharts}</span>, children: (
                  <div style={{ paddingTop: 12 }}>
                    <div className="chart-container-premium">
                      <h4 style={{ fontWeight: 800, fontSize: 15, marginBottom: 20, color: '#0f172a' }}>{t.backtest.equityGrowthCurve}</h4>
                      <div style={{ height: '360px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={equityCurveData}>
                            <defs><linearGradient id="colorEquity" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.12}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/></linearGradient></defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                            <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 500 }} tickFormatter={(val) => formatDateForChartWithYear(val, getStartYear(equityCurveData))} axisLine={false} tickLine={false} ticks={generateUniformDateTicks(equityCurveData, 10)} />
                            <YAxis 
                              tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 500 }} 
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
                              contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 8px 24px rgba(0,0,0,0.1)' }} 
                            />
                            <Area type="monotone" dataKey="equity" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorEquity)" activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                    <div className="chart-container-premium">
                      <h4 style={{ fontWeight: 800, fontSize: 15, marginBottom: 20, color: '#0f172a' }}>{t.backtest.drawdownAnalysis}</h4>
                      <div style={{ height: '260px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={drawdownData.map(d => ({...d, drawdown: -Math.abs(d.drawdown)}))}>
                            <defs><linearGradient id="colorDrawdown" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#ef4444" stopOpacity={0.12}/><stop offset="95%" stopColor="#ef4444" stopOpacity={0}/></linearGradient></defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                            <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 500 }} tickFormatter={(val) => formatDateForChartWithYear(val, getStartYear(drawdownData))} axisLine={false} tickLine={false} ticks={generateUniformDateTicks(drawdownData, 10)} />
                            <YAxis 
                              tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 500 }} 
                              axisLine={false} 
                              tickLine={false} 
                              tickFormatter={(val) => `${val.toFixed(1)}%`} 
                            />
                            <Tooltip 
                              formatter={(value: any) => [`${Number(value).toFixed(2)}%`, t.backtest.drawdownLabel]}
                              labelFormatter={(label) => `${t.backtest.dateLabel}: ${formatDateToYYYYMMDD(label)}`}
                              contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 8px 24px rgba(0,0,0,0.1)' }} 
                            />
                            <Area type="monotone" dataKey="drawdown" stroke="#ef4444" strokeWidth={2} fillOpacity={1} fill="url(#colorDrawdown)" activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff' }} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                    {(!backtestResult?.parameters?.symbols || backtestResult.parameters.symbols.length <= 1) ? (
                      <div className="chart-container-premium"><h4 style={{ fontWeight: 800, fontSize: 15, marginBottom: 20, color: '#0f172a' }}>{t.backtest.detailedTradingSignals}</h4><TradingChart data={backtestResult.results.chartData || []} height={380} /></div>
                    ) : <Empty description={t.backtest.portfolioNotAvailable} style={{ padding: '60px 0' }} />}

                  </div>
                )
              },
              {
                key: 'trades', label: <span style={{ fontWeight: 700 }}>{t.backtest.tradeLog}</span>, children: (
                  <div style={{ paddingTop: 8 }}>
                    <div style={{ background: '#f8fafc', border: '1px solid rgba(15, 23, 24, 0.08)', borderRadius: 14, padding: 20, marginBottom: 24 }}>
                      <Row gutter={24}>
                        <Col span={6}><Statistic title={<Text style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>{t.backtest.winningTrades}</Text>} value={backtestResult.results.tradesList?.filter(t => t.pnl > 0).length || 0} valueStyle={{ color: '#10b981', fontWeight: 800, fontSize: 24 }} suffix={<span style={{ fontSize: 14, color: '#94a3b8', fontWeight: 500 }}>/ {backtestResult.results.tradesList?.length || 0}</span>} /></Col>
                        <Col span={6}><Statistic title={<Text style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>{t.backtest.profitFactorLabel}</Text>} value={backtestResult.results.profitFactor || '—'} precision={2} valueStyle={{ fontWeight: 800, fontSize: 24, color: '#0f172a' }} /></Col>
                        <Col span={6}><Statistic title={<Text style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>{t.backtest.avgProfit}</Text>} value={backtestResult.results.avgWin || 0} precision={0} prefix="$" valueStyle={{ color: '#10b981', fontWeight: 800, fontSize: 24 }} /></Col>
                        <Col span={6}><Statistic title={<Text style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>{t.backtest.avgLoss}</Text>} value={backtestResult.results.avgLoss || 0} precision={0} prefix="$" valueStyle={{ color: '#ef4444', fontWeight: 800, fontSize: 24 }} /></Col>
                      </Row>
                    </div>
                    <Table
                      className="history-table"
                      columns={[
                        { title: t.backtest.entryDate, dataIndex: 'entryDate', key: 'entryDate', render: d => <Text strong style={{ fontSize: 13, color: '#0f172a' }}>{formatDateToYYYYMMDD(d)}</Text> },
                        { title: t.backtest.symbolCol, dataIndex: 'symbol', key: 'symbol', render: s => <Tag color="blue" style={{ fontWeight: 700, borderRadius: 6, border: 'none', background: '#eff6ff', color: '#3b82f6' }}>{s}</Tag> },
                        { title: t.backtest.action, dataIndex: 'action', key: 'action', render: a => <Tag color={a === 'BUY' ? 'green' : 'red'} style={{ borderRadius: 6, fontWeight: 700 }}>{a}</Tag> },
                        { title: t.backtest.entryPrice, dataIndex: 'entryPrice', key: 'entryPrice', render: p => <Text strong style={{ color: '#1e293b' }}>${p.toFixed(2)}</Text>, align: 'right' },
                        { title: t.backtest.exitPrice, dataIndex: 'exitPrice', key: 'exitPrice', render: p => <Text style={{ color: '#64748b' }}>${p?.toFixed(2) || '—'}</Text>, align: 'right' },
                        { title: t.backtest.pnlDollar, dataIndex: 'pnl', key: 'pnl', render: p => <Text strong style={{ color: p >= 0 ? '#10b981' : '#ef4444' }}>{p >= 0 ? '+' : ''}{p.toFixed(2)}</Text>, align: 'right' },
                        { title: t.backtest.returnLabel, dataIndex: 'returnPct', key: 'returnPct', render: r => <div style={{ background: r >= 0 ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)', color: r >= 0 ? '#10b981' : '#ef4444', padding: '2px 8px', borderRadius: 6, fontWeight: 800, fontSize: 12, display: 'inline-block' }}>{r >= 0 ? '+' : ''}{r.toFixed(2)}%</div>, align: 'right' },
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
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}><Text style={{ color: '#64748b', fontWeight: 500 }}>{t.backtest.modelName}</Text><Text strong>{strategyNameBlueprint[backtestResult.parameters.strategy] || backtestResult.parameters.strategy}</Text></div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}><Text style={{ color: '#64748b', fontWeight: 500 }}>{t.backtest.dataProvider}</Text><Text strong>{backtestResult.parameters.dataSource || 'Alpaca'}{backtestResult.parameters.dataSource?.includes('1Day') ? '' : ` (${t.backtest.dataBars1Day})`}</Text></div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}><Text style={{ color: '#64748b', fontWeight: 500 }}>{t.backtest.engineVersion}</Text><Tag color="blue" style={{ margin: 0, borderRadius: 6, fontWeight: 700 }}>V2.5 PRO</Tag></div>
                          </div>
                        </div>
                      </Col>
                      <Col xs={24} md={14}>
                        <div className="blueprint-module">
                          <div className="blueprint-label">{t.backtest.appliedParameters}</div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12, marginTop: 12 }}>
                            {Object.entries(backtestResult.parameters.parameters || {}).map(([k, v]) => (
                              <div key={k} style={{ background: '#fff', padding: '12px 14px', borderRadius: 10, border: '1px solid rgba(15, 23, 24, 0.06)' }}>
                                <div style={{ fontSize: 9.5, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.3px', marginBottom: 4 }}>{paramKeyNames[k] || k.replace(/([A-Z])/g, ' $1')}</div>
                                <div style={{ fontSize: 14.5, fontWeight: 800, color: '#1e293b' }}>{typeof v === 'boolean' ? (v ? 'YES' : 'NO') : String(v)}</div>
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
