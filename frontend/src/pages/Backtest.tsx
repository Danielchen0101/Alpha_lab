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

const { Title, Text } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;

interface BacktestConfig {
  symbol: string;
  strategy: string;
  startDate: string;
  endDate: string;
  initialCapital: number;
}

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

  // 生成唯一的请求ID
  const generateRequestId = () => {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  // 清理所有状态 - 切换股票时调用
  const clearAllStates = () => {
    setBacktestResult(null);
    setError('');
    setLoading(false);
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
      const period = startDate && endDate ? `${startDate} to ${endDate}` : '';

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
        message.error('Please fill in strategy and symbol before saving');
        return;
      }

      const strategyName = prompt('Enter a name for this strategy:');
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
      message.success(`Strategy "${strategyName}" saved successfully!`);
    } catch (err) {
      console.error('Failed to save strategy:', err);
      message.error('Failed to save strategy');
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
      message.success(`Strategy "${strategy.name}" loaded successfully!`);
    } catch (err) {
      console.error('Failed to load strategy:', err);
      message.error('Failed to load strategy');
    }
  };

  // 删除策略
  const deleteStrategy = (id: string) => {
    try {
      const updatedStrategies = savedStrategies.filter(s => s.id !== id);
      setSavedStrategies(updatedStrategies);
      localStorage.setItem('quant_saved_strategies', JSON.stringify(updatedStrategies));
      message.success('Strategy deleted successfully!');
    } catch (err) {
      console.error('Failed to delete strategy:', err);
      message.error('Failed to delete strategy');
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
            message.success('Backtest completed successfully!');
          } else if (result.status === 'failed') {
            message.error('Backtest failed. Please check parameters and try again.');
          } else if (result.status) {
            message.info(`Backtest status: ${result.status}`);
          } else {
            message.success('Backtest completed!');
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
          setError('Backtest started but results not available immediately. Please try again.');
          message.error('Backtest response incomplete');
          setLoading(false);
        } else {
          setBacktestResult(null);
          setError('Failed to start backtest: Invalid response format');
          message.error('Failed to start backtest');
          setLoading(false);
        }
      } else {
        setBacktestResult(null);
        setError('Failed to start backtest: No response data');
        message.error('Failed to start backtest');
        setLoading(false);
      }
    } catch (err: any) {
      // 检查请求是否已被取消
      if (requestIdRef.current !== requestId) {
        console.log(`回测请求 ${requestId} 已被取消，忽略错误`);
        return;
      }

      setBacktestResult(null);
      setError(`Error running backtest: ${err.message || 'Unknown error'}`);
      message.error('Failed to run backtest');
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
        message.success('Backtest results loaded');
      }
    } catch (err) {
      console.error('Error loading backtest:', err);
      message.error('Failed to load backtest results');
    }
  };

  // 查看历史回测结果
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
            period: foundRecord.startDate && foundRecord.endDate ? `${foundRecord.startDate} to ${foundRecord.endDate}` : 'Unknown',
            initialCapital: foundRecord.initialCapital || 100000,
            startDate: foundRecord.startDate || '',
            endDate: foundRecord.endDate || '',
            // 保留其他参数
            dataMode: (foundRecord.parameters as any)?.dataMode || 'real',
            dataModeDisplay: (foundRecord.parameters as any)?.dataModeDisplay || 'Real Data',
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

        message.success(`Loaded backtest: ${foundRecord.symbol} - ${foundRecord.strategy}`);
      } else {
        // 如果没有找到，尝试从后端API加载
        if (record.backtestId && !record.backtestId.startsWith('local_')) {
          loadBacktestResult(record.backtestId);
        } else {
          message.warning('Backtest data not found in local storage');
        }
      }
    } catch (err) {
      console.error('Error viewing backtest:', err);
      message.error('Failed to load backtest results');
    }
  };

  const strategyOptions = [
    { value: 'moving_average', label: 'Moving Average Crossover' },
    { value: 'rsi', label: 'RSI Strategy' },
    { value: 'macd', label: 'MACD Strategy' },
    { value: 'bollinger', label: 'Bollinger Bands' },
    { value: 'momentum', label: 'Momentum Strategy' },
  ];

  const resultColumns = [
    {
      title: 'Metric',
      dataIndex: 'metric',
      key: 'metric',
      width: 150,
    },
    {
      title: 'Value',
      dataIndex: 'value',
      key: 'value',
      render: (value: any, record: any) => {
        // Handle non-numeric values for specific metrics
        if (record.metric === 'Strategy' || record.metric === 'Data Mode' || record.metric === 'Data Source' || record.metric === 'Status') {
          if (record.metric === 'Status') {
            const statusColors: Record<string, string> = {
              'running': 'blue',
              'completed': 'green',
              'failed': 'red'
            };
            const statusValue = value || 'unknown';
            return <Tag color={statusColors[statusValue] || 'default'}>{statusValue}</Tag>;
          } else {
            // Strategy, Data Mode, Data Source
            return <span style={{ fontWeight: 'bold' }}>{value || 'Unknown'}</span>;
          }
        }

        // For numeric metrics, use safeNumber
        const safeValue = safeNumber(value);

        if (record.metric === 'Profit / Loss') {
          // Profit/Loss 是金额，使用货币格式
          const color = safeValue >= 0 ? '#3f8600' : '#cf1322';
          const formatted = formatCurrency(safeValue);
          return <span style={{ color, fontWeight: 'bold' }}>{formatted}</span>;
        } else if (record.metric.includes('Return')) {
          // Return 类指标使用百分比格式
          const color = safeValue >= 0 ? '#3f8600' : '#cf1322';
          const prefix = record.metric.includes('$') ? '' : (safeValue >= 0 ? '+' : '');
          const suffix = record.metric.includes('$') ? '' : '%';
          return <span style={{ color, fontWeight: 'bold' }}>{prefix}{safeToFixed(safeValue, 2)}{suffix}</span>;
        } else if (record.metric === 'Expectancy') {
          const color = safeValue >= 0 ? '#3f8600' : '#cf1322';
          const prefix = safeValue >= 0 ? '+$' : '-$';
          const absValue = Math.abs(safeValue);
          return <span style={{ color, fontWeight: 'bold' }}>{prefix}{safeToFixed(absValue, 2)}</span>;
        } else if (record.metric === 'Volatility') {
          const color = safeValue < 20 ? '#3f8600' : safeValue < 40 ? '#faad14' : '#cf1322';
          return <span style={{ color, fontWeight: 'bold' }}>{safeToFixed(safeValue, 2)}%</span>;
        } else if (record.metric === 'Exposure') {
          const color = safeValue > 80 ? '#3f8600' : safeValue > 50 ? '#faad14' : '#cf1322';
          return <span style={{ color, fontWeight: 'bold' }}>{safeToFixed(safeValue, 1)}%</span>;
        } else if (record.metric === 'Sharpe Ratio' || record.metric === 'Calmar Ratio' || record.metric === 'Sortino Ratio' || record.metric === 'Profit Factor') {
          const color = safeValue >= 1 ? '#3f8600' : safeValue >= 0 ? '#faad14' : '#cf1322';
          return <span style={{ color, fontWeight: 'bold' }}>{safeToFixed(safeValue, 2)}</span>;
        } else if (record.metric === 'Max Drawdown') {
          return <span style={{ color: '#cf1322', fontWeight: 'bold' }}>{safeToFixed(safeValue, 2)}%</span>;
        } else if (record.metric === 'Win Rate') {
          const color = safeValue >= 60 ? '#3f8600' : safeValue >= 40 ? '#faad14' : '#cf1322';
          return <span style={{ color, fontWeight: 'bold' }}>{safeToFixed(safeValue, 1)}%</span>;
        } else if (record.metric === 'Trades') {
          return <span style={{ fontWeight: 'bold' }}>{Math.round(safeValue)}</span>;
        }
        return safeToFixed(safeValue, 2);
      },
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
    },
  ];

  const historyColumns = [
    {
      title: 'Select',
      key: 'selection',
      width: 60,
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
      title: 'Symbol',
      dataIndex: 'symbol',
      key: 'symbol',
      width: 90,
      render: (symbol: string) => <strong style={{ fontSize: '13px' }}>{symbol || 'N/A'}</strong>,
    },
    {
      title: 'Strategy',
      dataIndex: 'strategy',
      key: 'strategy',
      width: 120,
      render: (strategy: string) => {
        const strategyNames: Record<string, string> = {
          'moving_average': 'MA Crossover',
          'rsi': 'RSI',
          'macd': 'MACD',
          'bollinger': 'Bollinger Bands',
          'momentum': 'Momentum'
        };
        const displayName = strategyNames[strategy] || strategy || 'N/A';
        return <span style={{ fontSize: '12px' }}>{displayName}</span>;
      },
    },
    {
      title: 'Period',
      dataIndex: 'startDate',
      key: 'period',
      width: 130,
      render: (startDate: string, record: BacktestHistoryItem) => {
        if (!startDate || !record.endDate) return <span style={{ color: '#999', fontSize: '11px' }}>N/A</span>;
        try {
          const start = new Date(startDate);
          const end = new Date(record.endDate);
          const startStr = `${start.getMonth() + 1}/${start.getDate()}`;
          const endStr = `${end.getMonth() + 1}/${end.getDate()}`;
          return <span style={{ fontSize: '11px' }}>{startStr} - {endStr}</span>;
        } catch {
          return <span style={{ color: '#999', fontSize: '11px' }}>Invalid</span>;
        }
      },
    },
    {
      title: 'Return',
      dataIndex: 'totalReturn',
      key: 'totalReturn',
      width: 90,
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
      title: 'Sharpe',
      dataIndex: 'sharpeRatio',
      key: 'sharpeRatio',
      width: 80,
      render: (value: number) => {
        const safeValue = safeNumber(value);
        if (safeValue === null || safeValue === undefined) return <span style={{ color: '#999' }}>--</span>;
        const color = safeValue >= 1 ? '#3f8600' : safeValue >= 0 ? '#faad14' : '#cf1322';
        return <span style={{ color, fontSize: '12px' }}>{safeToFixed(safeValue, 2)}</span>;
      },
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => {
        const statusColors: Record<string, string> = {
          'running': 'blue',
          'completed': 'green',
          'failed': 'red'
        };
        const displayStatus = status || 'unknown';
        return <Tag 
          color={statusColors[displayStatus] || 'default'} 
          style={{ fontSize: '11px', padding: '1px 6px' }}
        >
          {displayStatus}
        </Tag>;
      },
    },
    {
      title: 'Date',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 100,
      render: (date: string) => {
        if (!date) return <span style={{ color: '#999', fontSize: '11px' }}>N/A</span>;
        try {
          const d = new Date(date);
          return <span style={{ fontSize: '11px' }}>
            {d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>;
        } catch {
          return <span style={{ color: '#999', fontSize: '11px' }}>Invalid</span>;
        }
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 120,
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
            View
          </Button>
          <Button
            type="link"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => {
              Modal.confirm({
                title: 'Delete Backtest',
                content: 'Are you sure you want to delete this backtest?',
                okText: 'Delete',
                okType: 'danger',
                cancelText: 'Cancel',
                onOk: async () => {
                  const success = deleteLocalBacktestHistory(record.backtestId);
                  if (success) {
                    message.success('Backtest deleted successfully');
                  } else {
                    message.error('Failed to delete backtest');
                  }
                },
              });
            }}
            style={{ fontSize: '11px', padding: '0 4px' }}
          >
            Delete
          </Button>
        </Space>
      ),
    },
  ];

  // Strategy name mapping
  const strategyNames: Record<string, string> = {
    'moving_average': 'Moving Average Crossover',
    'rsi': 'RSI Strategy',
    'macd': 'MACD Strategy',
    'bollinger': 'Bollinger Bands',
    'momentum': 'Momentum Strategy'
  };

  // 计算持仓天数函数
  const calculateHoldingDays = (entryDate: string, exitDate: string): number => {
    if (!entryDate || !exitDate) return 1;

    try {
      const entry = parseDateSafe(entryDate);
      const exit = parseDateSafe(exitDate);

      if (!entry || !exit) return 1;

      const timeDiff = exit.getTime() - entry.getTime();
      return Math.max(1, Math.floor(timeDiff / (1000 * 60 * 60 * 24)));
    } catch (error) {
      return 1;
    }
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

  const calculateUnifiedStats = () => {
    if (!backtestResult?.results) {
      return {
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        totalPnl: 0,
        avgPnl: 0,
        winRate: 0,
        totalReturn: 0,
        profitFactor: 0,
        grossProfit: 0,
        grossLoss: 0,
        avgWin: 0,
        avgLoss: 0,
        expectancy: 0,
        annualizedReturn: 0,
        sharpeRatio: 0,
        sortinoRatio: 0,
        initialCapital: 100000,
        isRealData: false
      };
    }

    const initialCapital = safeNumber(backtestResult.parameters?.initialCapital) || 100000;
    const results = backtestResult.results;
    
    return {
      totalTrades: results.trades || 0,
      winningTrades: 0,
      losingTrades: 0,
      totalPnl: results.profitLoss || 0,
      avgPnl: results.avgReturnPerTrade || 0,
      winRate: results.winRate || 0,
      totalReturn: results.totalReturn || 0,
      profitFactor: results.profitFactor,
      grossProfit: 0,
      grossLoss: 0,
      avgWin: results.avgWin || 0,
      avgLoss: results.avgLoss || 0,
      expectancy: results.expectancy || 0,
      annualizedReturn: results.annualizedReturn || 0,
      sharpeRatio: results.sharpeRatio || 0,
      sortinoRatio: results.sortinoRatio || 0,
      maxDrawdown: results.maxDrawdown || 0,
      calmarRatio: results.calmarRatio || 0,
      volatility: results.volatility || 0,
      exposure: results.exposure || 0,
      initialCapital,
      isRealData: true
    };
  };

  const unifiedStats = calculateUnifiedStats();

  const resultData = backtestResult ? [
    { key: 'strategy', metric: 'Strategy', value: strategyNames[backtestResult.parameters?.strategy] || backtestResult.parameters?.strategy || 'Unknown', description: 'Strategy used for backtest' },
    { key: 'dataMode', metric: 'Data Mode', value: backtestResult.parameters?.dataModeDisplay || 'Real Data', description: 'Data mode used for backtest' },
    { key: 'dataSource', metric: 'Data Source', value: backtestResult.parameters?.dataSource || 'Financial APIs', description: 'Source of data used for backtest' },
    { key: 'status', metric: 'Status', value: backtestResult.success ? 'Completed' : 'Failed', description: 'Current backtest status' },
    { key: 'totalReturn', metric: 'Total Return', value: safeToFixed(backtestResult.results?.totalReturn || 0, 2), description: 'Total return over the period' },
    { key: 'annualizedReturn', metric: 'Annualized Return', value: safeToFixed(backtestResult.results?.annualizedReturn || 0, 2), description: 'Annualized return (CAGR)' },
    { key: 'profitLoss', metric: 'Profit / Loss', value: formatMoney(backtestResult.results?.profitLoss || 0), description: `Profit/Loss amount` },
    { key: 'sharpeRatio', metric: 'Sharpe Ratio', value: safeToFixed(backtestResult.results?.sharpeRatio || 0, 2), description: 'Annualized Sharpe ratio' },
    { key: 'calmarRatio', metric: 'Calmar Ratio', value: safeNumber(backtestResult.results?.calmarRatio || 0), description: 'Return vs max drawdown' },
    { key: 'maxDrawdown', metric: 'Max Drawdown', value: safeNumber(backtestResult.results?.maxDrawdown || 0), description: 'Maximum loss from a peak' },
    { key: 'winRate', metric: 'Win Rate', value: safeToFixed(backtestResult.results?.winRate || 0, 1), description: 'Percentage of winning trades' },
    { key: 'trades', metric: 'Trades', value: backtestResult.results?.trades || 0, description: 'Total number of trades executed' },
    { key: 'avgReturnPerTrade', metric: 'Avg P&L per Trade', value: formatMoney(backtestResult.results?.avgReturnPerTrade || 0), description: 'Average profit/loss per trade' },
    { key: 'volatility', metric: 'Volatility', value: safeNumber(backtestResult.results?.volatility || 0), description: 'Daily volatility' },
    { key: 'sortinoRatio', metric: 'Sortino Ratio', value: safeToFixed(backtestResult.results?.sortinoRatio || 0, 2), description: 'Annualized Sortino ratio' },
    { key: 'profitFactor', metric: 'Profit Factor', value: backtestResult.results?.profitFactor === null || backtestResult.results?.profitFactor === undefined ? 'N/A' : safeToFixed(backtestResult.results.profitFactor, 2), description: 'Gross profit divided by gross loss' },
    { key: 'expectancy', metric: 'Expectancy', value: formatMoney(backtestResult.results?.expectancy || 0), description: 'Expected return per trade' },
    { key: 'exposure', metric: 'Avg Equity Ratio', value: safeNumber(backtestResult.results?.exposure || 0), description: 'Average equity as percentage of initial capital' },
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
    <div className="backtest-page-container" style={{ padding: '0 8px 40px 8px' }}>
      <style>{`
        .backtest-page-container { animation: fadeIn 0.5s ease-out; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .premium-card { border-radius: 12px !important; border: 1px solid #f0f0f0 !important; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03) !important; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important; }
        .premium-card:hover { box-shadow: 0 8px 24px rgba(0, 0, 0, 0.06) !important; transform: translateY(-2px) !important; }
        .section-header { display: flex; align-items: center; gap: 10px; margin-bottom: 20px; }
        .section-title { font-size: 18px; font-weight: 700; color: #1a1a1a; margin: 0; }
        .performance-strip { display: flex; gap: 12px; margin-bottom: 24px; overflow-x: auto; padding: 4px 0 12px 0; }
        .stat-metric-card { flex: 1; min-width: 140px; background: #fff; padding: 16px; border-radius: 10px; border: 1px solid #f0f0f0; box-shadow: 0 2px 8px rgba(0,0,0,0.02); transition: all 0.2s ease; }
        .stat-metric-card:hover { border-color: #1890ff; box-shadow: 0 4px 12px rgba(24,144,255,0.1); }
        .stat-metric-label { font-size: 11px; color: #8c8c8c; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; margin-bottom: 4px; display: block; }
        .stat-metric-value { font-size: 20px; font-weight: 800; color: #262626; line-height: 1.2; }
        .info-strip { background: linear-gradient(90deg, #f6ffed 0%, #ffffff 100%); border: 1px solid #b7eb8f; border-radius: 8px; padding: 16px 20px; margin-bottom: 24px; }
        .blueprint-module { background: #fafafa; border-radius: 8px; padding: 16px; border: 1px solid #f0f0f0; height: 100%; }
        .blueprint-label { font-size: 11px; color: #8c8c8c; font-weight: 600; margin-bottom: 8px; text-transform: uppercase; }
        .blueprint-value { font-size: 14px; font-weight: 700; color: #262626; }
        .chart-container-premium { background: #fff; border-radius: 12px; border: 1px solid #f0f0f0; padding: 20px; margin-bottom: 24px; }
        .recent-backtest-row:hover { background-color: #f0f7ff !important; cursor: pointer; }
        .primary-cta-button { height: 44px; font-weight: 700; letter-spacing: 0.5px; border-radius: 8px; box-shadow: 0 4px 10px rgba(24, 144, 255, 0.2); }
      `}</style>

      {/* ── Page Header ── */}
      <div style={{ marginBottom: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
            <div style={{ width: 40, height: 40, borderRadius: '10px', background: 'linear-gradient(135deg, #1890ff 0%, #003a8c 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 22, boxShadow: '0 4px 12px rgba(24, 144, 255, 0.3)' }}>
              <LineChartOutlined />
            </div>
            <Title level={1} style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: '-0.5px', color: '#1a1a1a' }}>Strategy Backtest</Title>
          </div>
          <Text type="secondary" style={{ fontSize: 15, marginLeft: 52 }}>Validate your trading ideas against historical market data with professional-grade analysis.</Text>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
           <Badge status="processing" text={<Text strong style={{ color: '#1890ff', fontSize: 12 }}>ENGINE READY</Text>} />
        </div>
      </div>

      {error && (
        <Alert message="System Notification" description={error} type="error" showIcon style={{ marginBottom: 24, borderRadius: 10 }} closable onClose={() => setError('')} />
      )}

      <Row gutter={[24, 24]}>
        <Col span={16}>
          <Card className="premium-card" title={<span style={{ fontWeight: 700 }}>Backtest Configuration</span>}>
            <Form form={form} layout="vertical" onFinish={handleRunBacktest}>
              <Row gutter={20}>
                <Col span={10}>
                  <Form.Item label={<Text strong>Stock Symbol / Portfolio</Text>} name="symbol" rules={[{ required: true, message: 'Please enter stock symbol' }]} help="Input ticker(s) or company name">
                    <Input placeholder="e.g. AAPL, MSFT, TSLA" size="large" style={{ borderRadius: '8px' }} prefix={<LineChartOutlined style={{ color: '#bfbfbf' }} />} onChange={(e) => parseSymbols(e.target.value)} />
                  </Form.Item>
                </Col>
                <Col span={14}>
                  <Form.Item label={<Text strong>Strategy Model</Text>} name="strategy" rules={[{ required: true, message: 'Please select a strategy' }]}>
                    <Select 
                      size="large" 
                      style={{ borderRadius: '8px' }} 
                      placeholder="Choose execution strategy" 
                      onChange={(value) => {
                        setSelectedStrategy(value);
                        // 当切换策略时，自动填入默认推荐参数
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
                <div style={{ marginBottom: '20px', padding: '12px 16px', background: 'rgba(24, 144, 255, 0.05)', border: '1px solid #91d5ff', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Tag color="blue" style={{ borderRadius: 4, fontWeight: 700 }}>PORTFOLIO ACTIVE</Tag>
                  <Text style={{ fontSize: 13, color: '#0050b3' }}>Multi-stock mode: <strong>{portfolioSymbols.length}</strong> symbols loaded for simulation.</Text>
                </div>
              )}

              <div style={{ marginBottom: '24px', padding: '20px', background: '#fafafa', borderRadius: '12px', border: '1px solid #f0f0f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, textTransform: 'uppercase', color: '#595959', letterSpacing: '0.5px' }}>Execution Parameters</h4>
                  <Badge status="success" text={<Text type="secondary" style={{ fontSize: 12 }}>Real Market Data</Text>} />
                </div>

                {selectedStrategy === 'moving_average' && (
                  <Row gutter={16}>
                    <Col span={12}><Form.Item label="Short MA Period" name="shortMaPeriod" extra="Default: 20"><InputNumber min={1} max={200} size="large" style={{ width: '100%', borderRadius: 8 }} /></Form.Item></Col>
                    <Col span={12}><Form.Item label="Long MA Period" name="longMaPeriod" extra="Default: 50"><InputNumber min={1} max={200} size="large" style={{ width: '100%', borderRadius: 8 }} /></Form.Item></Col>
                  </Row>
                )}
                {selectedStrategy === 'rsi' && (
                  <Row gutter={16}>
                    <Col span={8}><Form.Item label="RSI Period" name="rsiPeriod" extra="Default: 14"><InputNumber min={1} max={50} size="large" style={{ width: '100%', borderRadius: 8 }} /></Form.Item></Col>
                    <Col span={8}><Form.Item label="Oversold" name="rsiOversold" extra="Default: 30"><InputNumber min={1} max={100} size="large" style={{ width: '100%', borderRadius: 8 }} /></Form.Item></Col>
                    <Col span={8}><Form.Item label="Overbought" name="rsiOverbought" extra="Default: 70"><InputNumber min={1} max={100} size="large" style={{ width: '100%', borderRadius: 8 }} /></Form.Item></Col>
                  </Row>
                )}
                {selectedStrategy === 'macd' && (
                  <Row gutter={16}>
                    <Col span={8}><Form.Item label="Fast EMA" name="macdFast" extra="Default: 12"><InputNumber min={1} max={50} size="large" style={{ width: '100%', borderRadius: 8 }} /></Form.Item></Col>
                    <Col span={8}><Form.Item label="Slow EMA" name="macdSlow" extra="Default: 26"><InputNumber min={1} max={50} size="large" style={{ width: '100%', borderRadius: 8 }} /></Form.Item></Col>
                    <Col span={8}><Form.Item label="Signal" name="macdSignal" extra="Default: 9"><InputNumber min={1} max={50} size="large" style={{ width: '100%', borderRadius: 8 }} /></Form.Item></Col>
                  </Row>
                )}
                {selectedStrategy === 'bollinger' && (
                  <Row gutter={16}>
                    <Col span={12}><Form.Item label="Period" name="bollingerPeriod" extra="Default: 20"><InputNumber min={5} max={100} size="large" style={{ width: '100%', borderRadius: 8 }} /></Form.Item></Col>
                    <Col span={12}><Form.Item label="Std Dev" name="bollingerStdDev" extra="Default: 2"><InputNumber min={1} max={5} step={0.1} size="large" style={{ width: '100%', borderRadius: 8 }} /></Form.Item></Col>
                  </Row>
                )}
                {selectedStrategy === 'momentum' && (
                  <Col span={12}>
                    <Form.Item label="Momentum Period" name="momentumPeriod" extra="Default: 20"><InputNumber min={1} max={50} size="large" style={{ width: '100%', borderRadius: 8 }} /></Form.Item>
                  </Col>
                )}
              </div>

              <Row gutter={20}>
                <Col span={12}>
                  <Form.Item label={<Text strong>Simulation Window</Text>} name="dateRange" rules={[{ required: true }]}>
                    <RangePicker size="large" style={{ width: '100%', borderRadius: 8 }} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label={<Text strong>Initial Liquidity ($)</Text>} name="initialCapital" rules={[{ required: true }]}>
                    <InputNumber min={1000} size="large" style={{ width: '100%', borderRadius: 8 }} formatter={v => `$ ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} />
                  </Form.Item>
                </Col>
              </Row>

              <div style={{ marginTop: 12 }}>
                <Button type="primary" htmlType="submit" size="large" loading={loading} icon={<PlayCircleOutlined />} className="primary-cta-button" style={{ width: '100%', marginBottom: 16 }} disabled={loading}>
                  {loading ? 'Executing Simulation...' : 'Execute Backtest'}
                </Button>
                <Row gutter={12}>
                  <Col span={8}><Button block size="large" icon={<SaveOutlined />} onClick={saveCurrentStrategy} style={{ borderRadius: 8 }}>Save Plan</Button></Col>
                  <Col span={8}><Button block size="large" icon={<FolderOpenOutlined />} onClick={() => setShowSavedStrategies(!showSavedStrategies)} style={{ borderRadius: 8 }}>{showSavedStrategies ? 'Hide Plans' : 'Saved Plans'}</Button></Col>
                  <Col span={8}><Button block size="large" type="dashed" icon={<PlayCircleOutlined />} onClick={() => {
                    const formValues = form.getFieldsValue();
                    if (formValues.strategy === 'moving_average') {
                      const backtestParams = { strategy: 'MA_CROSSOVER', symbol: formValues.symbol, shortMaPeriod: formValues.shortMaPeriod || 20, longMaPeriod: formValues.longMaPeriod || 50, timestamp: new Date().toISOString() };
                      localStorage.setItem('quant_last_backtest_params', JSON.stringify(backtestParams));
                      message.success('Strategy staged for Paper Trading');
                    } else { message.info('Stage support currently limited to MA Crossover'); }
                  }} style={{ borderRadius: 8 }}>Stage for Paper</Button></Col>
                </Row>
              </div>
            </Form>
          </Card>

          {showSavedStrategies && (
            <Card className="premium-card" title={<span style={{ fontWeight: 700 }}>Strategy Library</span>} style={{ marginTop: 24 }}>
              {savedStrategies.length === 0 ? (
                <Empty description="No saved strategy plans found." image={Empty.PRESENTED_IMAGE_SIMPLE} />
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {savedStrategies.map((strategy) => (
                    <Card key={strategy.id} size="small" className="premium-card" style={{ border: '1px solid #f0f0f0' }}
                      title={<Text strong>{strategy.name}</Text>}
                      extra={
                        <Space>
                          <Button type="link" size="small" onClick={() => loadStrategy(strategy)}>Load</Button>
                          <Button type="link" size="small" danger onClick={() => deleteStrategy(strategy.id)}>Delete</Button>
                        </Space>
                      }
                    >
                      <div style={{ fontSize: '11px', color: '#8c8c8c' }}>
                        <div><strong>Symbol:</strong> {strategy.config.symbol}</div>
                        <div><strong>Strategy:</strong> {strategy.config.strategy}</div>
                        <div><strong>Created:</strong> {new Date(strategy.createdTime).toLocaleDateString()}</div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </Card>
          )}
        </Col>

        <Col span={8}>
          <Card className="premium-card" title={<span style={{ fontWeight: 700 }}><HistoryOutlined style={{ marginRight: 8 }} />Recent Sessions</span>} extra={<Button type="text" icon={<ReloadOutlined />} onClick={fetchBacktestHistory} loading={historyLoading} size="small" />}>
            {historyLoading ? <div style={{ textAlign: 'center', padding: '40px' }}><Spin /></div> : backtestHistory.length > 0 ? (
              <Table columns={historyColumns} dataSource={backtestHistory} rowKey="backtestId" pagination={{ pageSize: 6, simple: true }} size="small" rowClassName={() => 'recent-backtest-row'} />
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No previous sessions found." />
            )}
          </Card>
          <Card className="premium-card" title={<span style={{ fontWeight: 700 }}>Quick Insights</span>} style={{ marginTop: 24 }}>
            <Space direction="vertical" style={{ width: '100%' }} size={10}>
              <Button block onClick={() => navigate('/market')} icon={<LineChartOutlined />}>Explore Top Symbols</Button>
              <Button block onClick={() => { form.setFieldsValue({ symbol: 'MSFT', strategy: 'rsi', initialCapital: 100000, dateRange: defaultDateRange() }); message.info('Microsoft RSI session loaded'); }}>Load MSFT Blueprint</Button>
              <Button block onClick={() => { form.setFieldsValue({ symbol: 'TSLA', strategy: 'momentum', initialCapital: 100000, dateRange: defaultDateRange() }); message.info('Tesla Momentum session loaded'); }}>Load TSLA Blueprint</Button>
            </Space>
          </Card>
        </Col>
      </Row>

      {backtestResult && (
        <div ref={resultsRef} style={{ marginTop: 40 }}>
          <div className="section-header">
            <CheckCircleOutlined style={{ fontSize: 24, color: '#52c41a' }} />
            <h2 className="section-title">Backtest Report</h2>
            <Tag color="success" style={{ borderRadius: 10, fontWeight: 700, fontSize: 10 }}>VERIFIED</Tag>
          </div>

          <div className="performance-strip">
            {[
              { label: 'Total Return', value: `${(backtestResult.results?.totalReturn || 0) >= 0 ? '+' : ''}${safeToFixed(backtestResult.results?.totalReturn, 2)}%`, color: (backtestResult.results?.totalReturn || 0) >= 0 ? '#52c41a' : '#ff4d4f' },
              { label: 'Sharpe Ratio', value: safeToFixed(backtestResult.results?.sharpeRatio, 2), color: (backtestResult.results?.sharpeRatio || 0) >= 1 ? '#52c41a' : '#faad14' },
              { label: 'Max Drawdown', value: `${safeToFixed(backtestResult.results?.maxDrawdown, 2)}%`, color: '#ff4d4f' },
              { label: 'Win Rate', value: `${safeToFixed(backtestResult.results?.winRate, 1)}%`, color: (backtestResult.results?.winRate || 0) >= 50 ? '#52c41a' : '#faad14' },
              { label: 'Total Trades', value: backtestResult.results?.trades || 0, color: '#262626' },
              { label: 'Net Profit', value: formatCurrency(backtestResult.results?.profitLoss || 0), color: (backtestResult.results?.profitLoss || 0) >= 0 ? '#52c41a' : '#ff4d4f' }
            ].map(m => (
              <div key={m.label} className="stat-metric-card">
                <span className="stat-metric-label">{m.label}</span>
                <div className="stat-metric-value" style={{ color: m.color }}>{m.value}</div>
              </div>
            ))}
          </div>

          <Card className="premium-card" bodyStyle={{ padding: '0 24px 24px 24px' }}>
            <Tabs defaultActiveKey="results" style={{ marginTop: 8 }} items={[
              {
                key: 'results', label: 'Overview', children: (
                  <div style={{ paddingTop: 16 }}>
                    <div className="info-strip">
                      <Row gutter={[24, 16]}>
                        <Col span={6}><div className="blueprint-label">Strategy Module</div><div className="blueprint-value">{backtestResult.parameters.strategy}</div></Col>
                        <Col span={6}><div className="blueprint-label">Instrument</div><div className="blueprint-value">{backtestResult.parameters.symbol || backtestResult.parameters.symbols?.[0] || 'N/A'}</div></Col>
                        <Col span={6}><div className="blueprint-label">Initial Equity</div><div className="blueprint-value" style={{ color: '#1890ff' }}>${backtestResult.parameters.initialCapital?.toLocaleString()}</div></Col>
                        <Col span={6}><div className="blueprint-label">Simulation Period</div><div className="blueprint-value">{backtestResult.parameters.period}</div></Col>
                      </Row>
                    </div>
                    <h4 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, color: '#595959' }}>Performance Breakdown</h4>
                    <Table columns={resultColumns} dataSource={resultData} pagination={false} size="middle" style={{ border: '1px solid #f0f0f0', borderRadius: 8, overflow: 'hidden' }} />
                  </div>
                )
              },
              {
                key: 'charts', label: 'Analytics Charts', children: (
                  <div style={{ paddingTop: 20 }}>
                    <div className="chart-container-premium">
                      <h4 style={{ fontWeight: 700, marginBottom: 20 }}>Equity Growth Curve</h4>
                      <div style={{ height: '380px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={equityCurveData}>
                            <defs><linearGradient id="colorEquity" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#52c41a" stopOpacity={0.15}/><stop offset="95%" stopColor="#52c41a" stopOpacity={0}/></linearGradient></defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                            <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#8c8c8c' }} tickFormatter={(val) => formatDateForChartWithYear(val, getStartYear(equityCurveData))} axisLine={false} tickLine={false} ticks={generateUniformDateTicks(equityCurveData, 10)} />
                            <YAxis 
                              tick={{ fontSize: 11, fill: '#8c8c8c' }} 
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
                              formatter={(value: any) => [`$${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 'Portfolio Value']}
                              labelFormatter={(label) => `Date: ${formatDateToYYYYMMDD(label)}`}
                              contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} 
                            />
                            <Area type="monotone" dataKey="equity" stroke="#52c41a" strokeWidth={2.5} fillOpacity={1} fill="url(#colorEquity)" activeDot={{ r: 5, strokeWidth: 0 }} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                    <div className="chart-container-premium">
                      <h4 style={{ fontWeight: 700, marginBottom: 20 }}>Drawdown Analysis</h4>
                      <div style={{ height: '280px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={drawdownData.map(d => ({...d, drawdown: -Math.abs(d.drawdown)}))}>
                            <defs><linearGradient id="colorDrawdown" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#ff4d4f" stopOpacity={0.15}/><stop offset="95%" stopColor="#ff4d4f" stopOpacity={0}/></linearGradient></defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                            <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#8c8c8c' }} tickFormatter={(val) => formatDateForChartWithYear(val, getStartYear(drawdownData))} axisLine={false} tickLine={false} ticks={generateUniformDateTicks(drawdownData, 10)} />
                            <YAxis 
                              tick={{ fontSize: 11, fill: '#8c8c8c' }} 
                              axisLine={false} 
                              tickLine={false} 
                              tickFormatter={(val) => `${val.toFixed(1)}%`} 
                            />
                            <Tooltip 
                              formatter={(value: any) => [`${Number(value).toFixed(2)}%`, 'Drawdown']}
                              labelFormatter={(label) => `Date: ${formatDateToYYYYMMDD(label)}`}
                              contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} 
                            />
                            <Area type="monotone" dataKey="drawdown" stroke="#ff4d4f" strokeWidth={2} fillOpacity={1} fill="url(#colorDrawdown)" activeDot={{ r: 4 }} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                    {(!backtestResult?.parameters?.symbols || backtestResult.parameters.symbols.length <= 1) ? (
                      <div className="chart-container-premium"><h4 style={{ fontWeight: 700, marginBottom: 20 }}>Detailed Trading Signals</h4><TradingChart data={backtestResult.results.chartData || []} height={420} /></div>
                    ) : <Empty description="Detailed Price Charts not available for Portfolio Mode." style={{ padding: '60px 0' }} />}

                  </div>
                )
              },
              {
                key: 'trades', label: 'Trade Log', children: (
                  <div style={{ paddingTop: 16 }}>
                    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 24, marginBottom: 24 }}>
                      <Row gutter={32}>
                        <Col span={6}><Statistic title={<Text type="secondary" style={{ fontSize: 12, fontWeight: 600 }}>WINNING TRADES</Text>} value={backtestResult.results.tradesList?.filter(t => t.pnl > 0).length || 0} valueStyle={{ color: '#52c41a', fontWeight: 800 }} suffix={<span style={{ fontSize: 14, color: '#8c8c8c' }}>/ {backtestResult.results.tradesList?.length || 0}</span>} /></Col>
                        <Col span={6}><Statistic title={<Text type="secondary" style={{ fontSize: 12, fontWeight: 600 }}>PROFIT FACTOR</Text>} value={backtestResult.results.profitFactor || '—'} precision={2} valueStyle={{ fontWeight: 800 }} /></Col>
                        <Col span={6}><Statistic title={<Text type="secondary" style={{ fontSize: 12, fontWeight: 600 }}>AVG PROFIT</Text>} value={backtestResult.results.avgWin || 0} precision={0} prefix="$" valueStyle={{ color: '#52c41a', fontWeight: 800 }} /></Col>
                        <Col span={6}><Statistic title={<Text type="secondary" style={{ fontSize: 12, fontWeight: 600 }}>AVG LOSS</Text>} value={backtestResult.results.avgLoss || 0} precision={0} prefix="$" valueStyle={{ color: '#ff4d4f', fontWeight: 800 }} /></Col>
                      </Row>
                    </div>
                    <Table
                      columns={[
                        { title: 'Entry Date', dataIndex: 'entryDate', key: 'entryDate', render: d => <Text strong style={{ fontSize: 13 }}>{formatDateToYYYYMMDD(d)}</Text> },
                        { title: 'Symbol', dataIndex: 'symbol', key: 'symbol', render: s => <Tag color="blue" style={{ fontWeight: 700 }}>{s}</Tag> },
                        { title: 'Action', dataIndex: 'action', key: 'action', render: a => <Tag color={a === 'BUY' ? 'green' : 'red'}>{a}</Tag> },
                        { title: 'Entry Price', dataIndex: 'entryPrice', key: 'entryPrice', render: p => <Text strong>${p.toFixed(2)}</Text>, align: 'right' },
                        { title: 'Exit Price', dataIndex: 'exitPrice', key: 'exitPrice', render: p => <Text>${p?.toFixed(2) || '—'}</Text>, align: 'right' },
                        { title: 'P&L ($)', dataIndex: 'pnl', key: 'pnl', render: p => <Text strong style={{ color: p >= 0 ? '#52c41a' : '#ff4d4f' }}>{p >= 0 ? '+' : ''}{p.toFixed(2)}</Text>, align: 'right' },
                        { title: 'Return', dataIndex: 'returnPct', key: 'returnPct', render: r => <Tag color={r >= 0 ? 'green' : 'red'}>{r >= 0 ? '+' : ''}{r.toFixed(2)}%</Tag>, align: 'right' },
                      ]}
                      dataSource={backtestResult.results.tradesList || []}
                      rowKey={(record, index) => `${record.entryDate}-${index}`}
                      pagination={{ pageSize: 15 }}
                      size="middle"
                    />
                  </div>
                )
              },
              {
                key: 'parameters', label: 'Strategy Blueprint', children: (
                  <div style={{ paddingTop: 20 }}>
                    <Row gutter={[24, 24]}>
                      <Col span={12}>
                        <div className="blueprint-module">
                          <div className="blueprint-label">Core Strategy Information</div>
                          <Space direction="vertical" size={12} style={{ width: '100%', marginTop: 8 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}><Text type="secondary">Model Name</Text><Text strong>{backtestResult.parameters.strategy}</Text></div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}><Text type="secondary">Data Provider</Text><Text strong>{backtestResult.parameters.dataSource || 'Alpaca'}</Text></div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}><Text type="secondary">Engine Version</Text><Tag color="blue" style={{ margin: 0 }}>V2.4 PRO</Tag></div>
                          </Space>
                        </div>
                      </Col>
                      <Col span={12}>
                        <div className="blueprint-module">
                          <div className="blueprint-label">Applied Parameters</div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 8 }}>
                            {Object.entries(backtestResult.parameters.parameters || {}).map(([k, v]) => (
                              <div key={k} style={{ background: '#fff', padding: '10px 12px', borderRadius: 6, border: '1px solid #eef2f6' }}>
                                <div style={{ fontSize: 10, color: '#8c8c8c', textTransform: 'uppercase' }}>{k.replace(/([A-Z])/g, ' $1')}</div>
                                <div style={{ fontSize: 14, fontWeight: 700 }}>{String(v)}</div>
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
