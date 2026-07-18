import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Card, Table, Empty, Spin, Alert, Button, Typography, Space, Tag, message, Divider } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useLocation, useNavigate } from "react-router-dom";
import { 
  HistoryOutlined, 
  LeftOutlined, SwapOutlined, ReloadOutlined, 
  BarChartOutlined, LineChartOutlined, TrophyOutlined
} from "@ant-design/icons";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ScatterChart, Scatter, ZAxis, Cell,
  LineChart, Line
} from 'recharts';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { backtraderAPI } from '../services/api';
import './StrategyComparison.css';

const { Title, Text } = Typography;

// ========== Null-safe Formatting Helpers ==========

function safeNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function formatNumber(value: unknown, digits = 2, fallback = '—') {
  const n = safeNumber(value);
  return n === null ? fallback : n.toFixed(digits);
}

function formatPercent(value: unknown, digits = 2, fallback = '—') {
  const n = safeNumber(value);
  if (n === null) return fallback;
  return `${n >= 0 ? '+' : ''}${n.toFixed(digits)}%`;
}

function formatDrawdown(value: unknown, digits = 2, fallback = '—') {
  const n = safeNumber(value);
  if (n === null) return fallback;
  const magnitude = Math.abs(n).toFixed(digits);
  return n === 0 ? `${magnitude}%` : `-${magnitude}%`;
}

function formatCurrency(value: unknown, fallback = '—') {
  const n = safeNumber(value);
  if (n === null) return fallback;
  return `${n >= 0 ? '+' : ''}$${Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function compareNullableAscending(left: unknown, right: unknown): number {
  const leftValue = safeNumber(left);
  const rightValue = safeNumber(right);
  if (leftValue === null && rightValue === null) return 0;
  if (leftValue === null) return 1;
  if (rightValue === null) return -1;
  return leftValue - rightValue;
}

function compareNullableDescending(left: unknown, right: unknown): number {
  const leftValue = safeNumber(left);
  const rightValue = safeNumber(right);
  if (leftValue === null && rightValue === null) return 0;
  if (leftValue === null) return 1;
  if (rightValue === null) return -1;
  return rightValue - leftValue;
}

function timestampToMilliseconds(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const numeric = typeof value === 'number' || /^\d+$/.test(String(value)) ? Number(value) : null;
  const milliseconds = numeric === null
    ? new Date(String(value)).getTime()
    : (numeric < 1_000_000_000_000 ? numeric * 1000 : numeric);
  return Number.isFinite(milliseconds) ? milliseconds : null;
}

// 定义数据类型
interface MetricData {
  key: string;
  metric: string;
  [key: string]: any; // 动态backtest字段和winner字段
}

// Backtest识别色常量 - 支持多个backtest
const BACKTEST_COLORS = [
  {
    primary: '#d6a45f',      // 黄铜 - Backtest 1
    light: '#eff6ff',        // 极浅蓝
    border: '#bfdbfe',       // 边框蓝
    text: '#1e40af',         // 深蓝文字
    bg: '#eff6ff',           // 背景极浅蓝
  },
  {
    primary: '#765884',      // 石板紫 - Backtest 2
    light: '#f5f3ff',        // 极浅紫
    border: '#ddd6fe',       // 边框紫
    text: '#5b21b6',         // 深紫文字
    bg: '#f5f3ff',           // 背景极浅紫
  },
  {
    primary: '#4f7654',      // 研究绿 - Backtest 3
    light: '#ecfdf5',        // 极浅绿
    border: '#a7f3d0',       // 边框绿
    text: '#065f46',         // 深绿文字
    bg: '#ecfdf5',           // 背景极浅绿
  },
  {
    primary: '#a96d36',      // 氧化棕 - Backtest 4
    light: '#fffbeb',        // 极浅橙
    border: '#fde68a',       // 边框橙
    text: '#92400e',         // 深橙文字
    bg: '#fffbeb',           // 背景极浅橙
  },
  {
    primary: '#a74730',      // 风险红 - Backtest 5
    light: '#fef2f2',        // 极浅红
    border: '#fecaca',       // 边框红
    text: '#991b1b',         // 深红文字
    bg: '#fef2f2',           // 背景极浅红
  },
  {
    primary: '#397b82',      // 青灰 - Backtest 6
    light: '#ecfeff',        // 极浅青
    border: '#a5f3fc',       // 边框青
    text: '#155e75',         // 深青文字
    bg: '#ecfeff',           // 背景极浅青
  },
];

// 真实的backtest结果接口
interface RealBacktestResult {
  backtestId: string;
  parameters: {
    symbol: string;
    strategy: string;
    startDate: string;
    endDate: string;
    initialCapital?: number;
    [key: string]: any;
  };
  results: {
    profitLoss?: number;
    totalReturn?: number;
    sharpeRatio?: number;
    maxDrawdown?: number;
    winRate?: number;
    trades?: number;
    equityCurve: Array<{ date: string; equity: number }>;
    tradeLog: Array<any>;
    annualizedReturn?: number;
    sortinoRatio?: number;
    volatility?: number;
    profitFactor?: number;
    exposure?: number;
    expectancy?: number;
    calmarRatio?: number;
    avgReturnPerTrade?: number;
    buyHoldReturn?: number;
  };
  timestamp?: string;
  status: string;
}

const normalizeBacktestRecord = (item: any): RealBacktestResult => {
  const sourceParameters = item?.parameters || {};
  const sourceResults = item?.results || {};
  const rawStatus = String(item?.status || '').toLowerCase();
  const normalizedStatus = ['completed', 'running', 'failed', 'unknown'].includes(rawStatus)
    ? rawStatus
    : 'unknown';
  const numericResult = (topLevelKey: string, resultKey = topLevelKey): number | undefined => {
    const value = safeNumber(sourceResults?.[resultKey] ?? item?.[topLevelKey]);
    return value === null ? undefined : value;
  };

  return {
    ...item,
    backtestId: String(item?.backtestId || item?.id || ''),
    parameters: {
      ...sourceParameters,
      symbol: item?.symbol || sourceParameters.symbol || sourceParameters.symbols?.[0] || '',
      strategy: item?.strategy || sourceParameters.strategy || '',
      startDate: item?.startDate || sourceParameters.startDate || '',
      endDate: item?.endDate || sourceParameters.endDate || '',
      initialCapital: safeNumber(item?.initialCapital ?? sourceParameters.initialCapital) ?? undefined,
    },
    results: {
      ...sourceResults,
      profitLoss: numericResult('profitLoss'),
      totalReturn: numericResult('totalReturn'),
      sharpeRatio: numericResult('sharpeRatio'),
      maxDrawdown: numericResult('maxDrawdown'),
      winRate: numericResult('winRate'),
      trades: numericResult('trades'),
      annualizedReturn: numericResult('annualizedReturn'),
      sortinoRatio: numericResult('sortinoRatio'),
      volatility: numericResult('volatility'),
      profitFactor: numericResult('profitFactor'),
      exposure: numericResult('exposure'),
      expectancy: numericResult('expectancy'),
      calmarRatio: numericResult('calmarRatio'),
      avgReturnPerTrade: numericResult('avgReturnPerTrade'),
      buyHoldReturn: numericResult('buyHoldReturn'),
      equityCurve: Array.isArray(sourceResults.equityCurve) ? sourceResults.equityCurve : [],
      tradeLog: Array.isArray(sourceResults.tradeLog) ? sourceResults.tradeLog : [],
    },
    timestamp: item?.timestamp || item?.createdAt || '',
    status: normalizedStatus,
  };
};

const hasComparableEvidence = (record: RealBacktestResult): boolean => {
  if (!['completed', 'unknown'].includes(record.status)) return false;
  return [
    record.results?.totalReturn,
    record.results?.profitLoss,
    record.results?.sharpeRatio,
    record.results?.maxDrawdown,
    record.results?.winRate,
    record.results?.trades,
  ].some(value => safeNumber(value) !== null)
    || Boolean(record.results?.equityCurve?.length);
};

// 统一的单元格容器 - 所有表格使用同一套padding系统
const CellContainer: React.FC<{
  children: React.ReactNode;
  align?: 'left' | 'center' | 'right';
  header?: boolean;
}> = ({ children, align = 'left', header = false }) => {
  const textAlign = align === 'left' ? 'left' : align === 'center' ? 'center' : 'right';
  const padding = header ? '14px 12px' : '12px 12px';
  const backgroundColor = header ? 'var(--app-table-header-bg)' : 'transparent';
  const fontWeight = header ? 800 : 'normal';
  
  return (
    <div style={{
      textAlign,
      padding,
      width: '100%',
      boxSizing: 'border-box' as const,
      backgroundColor,
      fontWeight,
      fontSize: header ? '11px' : '13.5px',
      textTransform: header ? 'uppercase' : 'none',
      letterSpacing: header ? '0.8px' : 'normal',
      color: header ? 'var(--app-text-muted)' : 'var(--app-text-strong)',
      borderBottom: header ? '1px solid var(--app-border-soft)' : 'none',
    }}>
      {children}
    </div>
  );
};

// ========== 统一的公共renderer函数 ==========

// 1. 统一的标签列renderer（Parameter / Performance Metric）
const renderLabelCell = (text: string, align: 'left' | 'center' | 'right' = 'left') => (
  <CellContainer align={align}>
    <span style={{ fontWeight: 700, color: 'var(--app-text-muted)' }}>
      {text}
    </span>
  </CellContainer>
);

// 2. 统一的Backtest表头renderer
const renderBacktestHeader = (
  title: string, 
  subtitle: string, 
  align: 'left' | 'right' = 'left',
  backtestIndex: number = 1
) => {
  const colors = BACKTEST_COLORS[(backtestIndex - 1) % BACKTEST_COLORS.length];
  
  return (
    <CellContainer align={align} header>
      <div style={{ 
        display: 'flex', 
        alignItems: 'center',
        gap: '10px'
      }}>
        <div style={{
          width: '3px',
          height: '18px',
          backgroundColor: colors.primary,
          borderRadius: '2px',
          flexShrink: 0
        }}></div>
        <div style={{ textAlign: 'left' }}>
          <div style={{ 
            fontWeight: 800, 
            fontSize: '11px',
            color: colors.primary
          }}>
            {title.toUpperCase()}
          </div>
          <div style={{ 
            fontSize: '10px', 
            fontWeight: 600, 
            color: 'var(--app-text-muted)',
            marginTop: '2px',
            opacity: 0.8,
            whiteSpace: 'nowrap'
          }}>
            {subtitle}
          </div>
        </div>
      </div>
    </CellContainer>
  );
};

// 3. 统一的Backtest数据单元格renderer
const renderBacktestCell = (
  value: any, 
  mode: 'parameter' | 'metric',
  align: 'left' | 'right' = 'left'
) => {
  if (mode === 'parameter') {
    return (
      <CellContainer align="left">
        <span style={{ color: 'var(--app-text)', fontWeight: 500 }}>
          {value === null || value === undefined || value === '' ? '—' : value}
        </span>
      </CellContainer>
    );
  } else {
    // 数值列模式
    const displayValue = value === null || value === undefined || value === '' ? '—' : value;
    const isPositive = typeof value === 'string' && (value.startsWith('+') || (!value.startsWith('-') && value.includes('%') && parseFloat(value) > 0));
    const isNegative = typeof value === 'string' && (value.startsWith('-') || (value.includes('%') && parseFloat(value) < 0));
    
    let color = 'var(--app-text-strong)';
    if (isPositive) color = '#10b981';
    if (isNegative) color = '#ef4444';
    
    return (
      <CellContainer align="left">
        <span style={{ 
          color, 
          fontWeight: 700, 
          fontVariantNumeric: 'tabular-nums'
        }}>
          {displayValue}
        </span>
      </CellContainer>
    );
  }
};

// 优化的Tag组件
const StatusTag: React.FC<{ status: 'completed' | 'running' | 'failed' | 'unknown' }> = ({ status }) => {
  const { t } = useLanguage();
  const config = {
    completed: { color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)', border: 'rgba(16, 185, 129, 0.2)' },
    running: { color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)', border: 'rgba(59, 130, 246, 0.2)' },
    failed: { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)', border: 'rgba(239, 68, 68, 0.2)' },
    unknown: { color: 'var(--app-text-muted)', bg: 'var(--app-card-bg-soft)', border: 'var(--app-border-soft)' },
  }[status];

  const statusText = {
    completed: t.comparison.statusCompleted,
    running: t.comparison.statusRunning,
    failed: t.comparison.statusFailed,
    unknown: t.comparison.noData,
  }[status] || status;

  return (
    <Tag style={{
      margin: 0,
      borderRadius: '20px',
      fontSize: '11px',
      fontWeight: 700,
      backgroundColor: config.bg,
      color: config.color,
      border: `1px solid ${config.border}`,
      padding: '0 10px',
      height: '22px',
      display: 'inline-flex',
      alignItems: 'center'
    }}>
      {statusText.toUpperCase()}
    </Tag>
  );
};

// 优化的WinnerTag组件
const WinnerTag: React.FC<{ position: number }> = ({ position }) => {
  const { t } = useLanguage();
  const colors = BACKTEST_COLORS[(position - 1) % BACKTEST_COLORS.length];

  return (
    <Tag style={{
      margin: 0,
      borderRadius: '20px',
      fontSize: '11px',
      fontWeight: 800,
      backgroundColor: colors.primary + '1a', // 10% opacity
      color: colors.primary,
      border: `1px solid ${colors.primary}40`, // 25% opacity
      padding: '0 10px',
      height: '24px',
      display: 'inline-flex',
      alignItems: 'center'
    }}>
      <TrophyOutlined style={{ marginRight: 6 }} />
      {t.comparison.bestPosition.replace('{position}', String(position)).toUpperCase()}
    </Tag>
  );
};

// Summary Card组件
const SummaryCard: React.FC<{
  title: string;
  value: string | number;
  color?: string;
  unit?: string;
}> = ({ title, value, color = 'var(--app-text-strong)', unit = '' }) => {
  return (
    <div style={{
      backgroundColor: 'var(--app-card-bg)',
      border: '1px solid var(--app-border-soft)',
      borderRadius: '16px',
      padding: '18px 20px',
      boxShadow: 'var(--app-card-shadow)',
      minWidth: '180px',
      flex: 1,
      transition: 'all 0.3s ease',
    }} className="summary-card-hover">
      <div style={{
        fontSize: '10.5px',
        color: 'var(--app-text-muted)',
        fontWeight: 800,
        marginBottom: '10px',
        textTransform: 'uppercase',
        letterSpacing: '0.8px',
      }}>
        {title}
      </div>
      <div style={{
        fontSize: '22px',
        fontWeight: 800,
        color: color,
        lineHeight: 1.1,
      }}>
        {value}
        {unit && <span style={{ fontSize: '13px', color: 'var(--app-text-muted)', marginLeft: '6px', fontWeight: 600 }}>{unit}</span>}
      </div>
    </div>
  );
};

const StrategyComparison: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [backtestResults, setBacktestResults] = useState<RealBacktestResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const { t, language } = useLanguage();

  // History Selector state
  const [history, setHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyIssue, setHistoryIssue] = useState<'fallback' | 'local' | 'unavailable' | null>(null);
  const [selectedHistoryKeys, setSelectedHistoryKeys] = useState<string[]>([]);
  const [showSelector, setShowSelector] = useState(false);
  const [hasPreviousComparison, setHasPreviousComparison] = useState(false);

  // 统一的列宽 - 调整以适应更宽页面
  const LABEL_COL_WIDTH = 180;
  const BACKTEST_COL_WIDTH = 220;
  const WINNER_COL_WIDTH = 150;

  // Merge canonical server history with the local cache so direct entry remains useful.
  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    setHistoryIssue(null);
    let localRecords: RealBacktestResult[] = [];
    let localUnavailable = false;

    try {
      const saved = user?.id
        ? localStorage.getItem(`quant_backtest_history:${user.id}`)
        : null;
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) localRecords = parsed.map(normalizeBacktestRecord);
        else localUnavailable = true;
      }
    } catch (err) {
      localUnavailable = true;
      console.error('Failed to load local backtest history:', err);
    }

    let apiRecords: RealBacktestResult[] = [];
    let apiUnavailable = false;
    try {
      const response = await backtraderAPI.getBacktestHistory();
      if (!Array.isArray(response.data?.history)) throw new Error('Invalid backtest history response');
      apiRecords = response.data.history.map(normalizeBacktestRecord);
    } catch (err) {
      apiUnavailable = true;
      console.warn('Failed to load backtest history from the service:', err);
    }

    const merged = new Map<string, RealBacktestResult>();
    localRecords.forEach(record => { if (record.backtestId) merged.set(record.backtestId, record); });
    apiRecords.forEach(record => { if (record.backtestId) merged.set(record.backtestId, record); });
    const selectableRecords = Array.from(merged.values())
      .filter(hasComparableEvidence)
      .sort((left, right) => {
        const leftTime = new Date(left.timestamp || '').getTime();
        const rightTime = new Date(right.timestamp || '').getTime();
        return (Number.isFinite(rightTime) ? rightTime : 0) - (Number.isFinite(leftTime) ? leftTime : 0);
      });

    setHistory(selectableRecords);
    setSelectedHistoryKeys(current => current.filter(key => merged.has(key)));
    if (apiUnavailable) setHistoryIssue(selectableRecords.length > 0 ? 'fallback' : 'unavailable');
    else if (localUnavailable) setHistoryIssue('local');
    setHistoryLoading(false);
  }, [user?.id]);

  // 从路由state或sessionStorage获取选中的backtests
  const routeSelectedBacktests = location.state?.selectedBacktests;
  useEffect(() => {
    const loadComparisonData = async () => {
      setLoading(true);
      setError('');

      try {
        let selectedBacktests: RealBacktestResult[] = [];

        // 1. 优先从路由state获取
        if (Array.isArray(routeSelectedBacktests)) {
          selectedBacktests = routeSelectedBacktests.map(normalizeBacktestRecord);
        }
        // 2. 其次从sessionStorage获取
        else {
          const saved = sessionStorage.getItem('compareBacktests');
          if (saved) {
            const parsed = JSON.parse(saved);
            selectedBacktests = Array.isArray(parsed) ? parsed.map(normalizeBacktestRecord) : [];
          }
        }

        selectedBacktests = Array.from(new Map(
          selectedBacktests
            .filter(backtest => backtest.backtestId)
            .map(backtest => [backtest.backtestId, backtest]),
        ).values()).filter(hasComparableEvidence);

        // 3. 如果没有传递数据或只有1个，显示历史选择器
        if (selectedBacktests.length < 2) {
          setBacktestResults([]);
          setShowSelector(true);
          setHasPreviousComparison(false);
          await loadHistory();
          return;
        }

        setBacktestResults(selectedBacktests);
        setShowSelector(false);
        setHasPreviousComparison(true);
        // 同步选中键值
        setSelectedHistoryKeys(selectedBacktests.map(b => b.backtestId));
      } catch (err) {
        console.error('加载对比数据出错:', err);
        setBacktestResults([]);
        setShowSelector(true);
        setHasPreviousComparison(false);
        setError('comparison_load_failed');
        await loadHistory();
      } finally {
        setLoading(false);
      }
    };

    void loadComparisonData();
  }, [loadHistory, routeSelectedBacktests]);

  const handleCompareSelected = () => {
    if (selectedHistoryKeys.length < 2) {
      message.warning(t.comparison.pleaseSelectAtLeast2);
      return;
    }

    const selectedResults = history
      .filter(item => selectedHistoryKeys.includes(item.backtestId))
      .map(normalizeBacktestRecord);

    if (selectedResults.length < 2) {
      message.warning(t.comparison.pleaseSelectAtLeast2);
      return;
    }

    try {
      sessionStorage.setItem('compareBacktests', JSON.stringify(selectedResults));
    } catch (storageError) {
      console.warn('Unable to persist the selected comparison:', storageError);
    }
    setBacktestResults(selectedResults);
    setShowSelector(false);
    setHasPreviousComparison(true);
    setError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  
  // 计算汇总指标
  const summaryMetrics = useMemo(() => {
    if (backtestResults.length === 0) return null;

    const bestBy = (key: keyof RealBacktestResult['results'], lowestMagnitude = false): RealBacktestResult | null => {
      const candidates = backtestResults
        .map(record => ({ record, value: safeNumber(record.results?.[key]) }))
        .filter((candidate): candidate is { record: RealBacktestResult; value: number } => candidate.value !== null);
      if (candidates.length === 0) return null;
      return candidates.reduce((best, candidate) => {
        const bestValue = lowestMagnitude ? Math.abs(best.value) : best.value;
        const candidateValue = lowestMagnitude ? Math.abs(candidate.value) : candidate.value;
        return lowestMagnitude
          ? (candidateValue < bestValue ? candidate : best)
          : (candidateValue > bestValue ? candidate : best);
      }).record;
    };

    return {
      bestReturn: bestBy('totalReturn'),
      bestSharpe: bestBy('sharpeRatio'),
      lowestDD: bestBy('maxDrawdown', true),
      bestWinRate: bestBy('winRate'),
      bestProfitFactor: bestBy('profitFactor'),
    };
  }, [backtestResults]);

  // 动态生成指标数据
  const generateMetricData = (): MetricData[] => {
    const metrics = [
      {
        key: '1',
        metric: t.comparison.metricProfitLoss,
        getValue: (backtest: RealBacktestResult | null) => formatCurrency(backtest?.results?.profitLoss, 'N/A'),
        higherIsBetter: true
      },
      { 
        key: '2',
        metric: t.comparison.metricTotalReturn,
        getValue: (backtest: RealBacktestResult | null) => formatPercent(backtest?.results?.totalReturn, 2, 'N/A'),
        higherIsBetter: true
      },
      { 
        key: '3',
        metric: t.comparison.metricSharpeRatio,
        getValue: (backtest: RealBacktestResult | null) => formatNumber(backtest?.results?.sharpeRatio, 2, 'N/A'),
        higherIsBetter: true
      },
      { 
        key: '4',
        metric: t.comparison.metricMaxDrawdown,
        getValue: (backtest: RealBacktestResult | null) => formatDrawdown(backtest?.results?.maxDrawdown, 2, 'N/A'),
        higherIsBetter: false
      },
      { 
        key: '5',
        metric: t.comparison.metricWinRate,
        getValue: (backtest: RealBacktestResult | null) => formatPercent(backtest?.results?.winRate, 1, 'N/A'),
        higherIsBetter: true
      },
      { 
        key: '6',
        metric: t.comparison.metricTrades,
        getValue: (backtest: RealBacktestResult | null) => {
          const val = safeNumber(backtest?.results?.trades);
          return val !== null ? val.toString() : 'N/A';
        },
        higherIsBetter: true
      },
      { 
        key: '7',
        metric: t.comparison.metricAnnualizedReturn,
        getValue: (backtest: RealBacktestResult | null) => formatPercent(backtest?.results?.annualizedReturn, 2, 'N/A'),
        higherIsBetter: true
      },
      { 
        key: '10',
        metric: t.comparison.metricProfitFactor,
        getValue: (backtest: RealBacktestResult | null) => formatNumber(backtest?.results?.profitFactor, 2, 'N/A'),
        higherIsBetter: true
      },
      { 
        key: '15',
        metric: t.comparison.metricBuyHoldReturn,
        getValue: (backtest: RealBacktestResult | null) => formatPercent(backtest?.results?.buyHoldReturn, 2, 'N/A'),
        higherIsBetter: true
      },
    ];

    return metrics.map(metricConfig => {
      const row: MetricData = {
        key: metricConfig.key,
        metric: metricConfig.metric,
      };

      backtestResults.forEach((backtest, index) => {
        const fieldName = `backtest${index + 1}`;
        row[fieldName] = metricConfig.getValue(backtest);
      });

      if (backtestResults.length > 0) {
        let bestIndex = 0;
        let bestValue = metricConfig.higherIsBetter ? -Infinity : Infinity;
        
        backtestResults.forEach((backtest, index) => {
          let value: number | null = null;
          switch(metricConfig.key) {
            case '1': value = safeNumber(backtest?.results?.profitLoss); break;
            case '2': value = safeNumber(backtest?.results?.totalReturn); break;
            case '3': value = safeNumber(backtest?.results?.sharpeRatio); break;
            case '4': {
              const drawdown = safeNumber(backtest?.results?.maxDrawdown);
              value = drawdown === null ? null : Math.abs(drawdown);
              break;
            }
            case '5': value = safeNumber(backtest?.results?.winRate); break;
            case '6': value = safeNumber(backtest?.results?.trades); break;
            case '7': value = safeNumber(backtest?.results?.annualizedReturn); break;
            case '10': value = safeNumber(backtest?.results?.profitFactor); break;
            case '15': value = safeNumber(backtest?.results?.buyHoldReturn); break;
          }
          
          if (value !== null) {
            if (metricConfig.higherIsBetter) { if (value > bestValue) { bestValue = value; bestIndex = index; } }
            else { if (value < bestValue) { bestValue = value; bestIndex = index; } }
          }
        });
        
        if (bestValue !== -Infinity && bestValue !== Infinity) {
          row.winner = <WinnerTag position={bestIndex + 1} />;
        }
      }
      return row;
    });
  };

  const metricData = generateMetricData();

  // 构建列
  const buildBacktestColumn = (index: number, mode: 'parameter' | 'metric') => {
    const title = t.comparison.backtestN.replace('{index}', String(index + 1));
    const dataIndex = `backtest${index + 1}`;
    const subtitle = backtestResults[index]
      ? `${backtestResults[index].parameters.symbol} • ${(t.strategies as Record<string, string>)[backtestResults[index].parameters.strategy] || backtestResults[index].parameters.strategy}`
      : t.comparison.noData;
    
    return {
      title: renderBacktestHeader(title, subtitle, 'left', index + 1),
      dataIndex,
      key: dataIndex,
      width: BACKTEST_COL_WIDTH,
      render: (value: any) => renderBacktestCell(value, mode, 'left'),
    };
  };

  const metricColumns: ColumnsType<MetricData> = [
    {
      title: <CellContainer align="left" header><span>{t.comparison.performanceMetric}</span></CellContainer>,
      dataIndex: 'metric',
      key: 'metric',
      width: LABEL_COL_WIDTH,
      render: (text: string) => renderLabelCell(text, 'left'),
    },
    ...backtestResults.map((_, index) => buildBacktestColumn(index, 'metric')),
    {
      title: <CellContainer align="center" header><span>{t.comparison.winner}</span></CellContainer>,
      dataIndex: 'winner',
      key: 'winner',
      width: WINNER_COL_WIDTH,
      align: 'center' as const,
      render: (winner: React.ReactNode) => <CellContainer align="center">{winner}</CellContainer>,
    },
  ];

  // 准备图表数据
  const barChartData = useMemo(() => {
    if (backtestResults.length === 0) return [];
    const metrics = [
      { key: 'totalReturn', name: t.comparison.chartTotalReturn },
      { key: 'sharpeRatio', name: t.comparison.chartSharpeRatio },
      { key: 'maxDrawdown', name: t.comparison.chartMaxDrawdown },
      { key: 'winRate', name: t.comparison.chartWinRate },
    ];
    return metrics.map(metric => {
      const dataPoint: any = { metric: metric.name, metricKey: metric.key };
      backtestResults.forEach((backtest, index) => {
        const value = safeNumber(backtest?.results?.[metric.key as keyof typeof backtest.results]);
        dataPoint[`backtest${index + 1}`] = metric.key === 'maxDrawdown' && value !== null
          ? -Math.abs(value)
          : value;
      });
      return dataPoint;
    });
  }, [backtestResults, t]);

  const riskRewardData = useMemo(() => backtestResults.flatMap((backtest, index) => {
    const totalReturn = safeNumber(backtest.results?.totalReturn);
    const maxDrawdown = safeNumber(backtest.results?.maxDrawdown);
    const trades = safeNumber(backtest.results?.trades);
    if (totalReturn === null || maxDrawdown === null || trades === null) return [];
    return [{
      name: `B${index + 1}`,
      totalReturn,
      maxDrawdown: Math.abs(maxDrawdown),
      trades,
      fill: BACKTEST_COLORS[index % BACKTEST_COLORS.length].primary,
    }];
  }), [backtestResults]);

  const hasBarChartData = useMemo(() => barChartData.some(dataPoint => (
    backtestResults.some((_backtest, index) => safeNumber(dataPoint[`backtest${index + 1}`]) !== null)
  )), [backtestResults, barChartData]);

  // 处理 Equity Curve
  const formatUnixTimestamp = (timestamp: any) => {
    if (timestamp === null || timestamp === undefined || timestamp === '') return '—';
    try {
      const milliseconds = timestampToMilliseconds(timestamp);
      if (milliseconds === null) return String(timestamp);
      const date = new Date(milliseconds);
      return date.toLocaleDateString(language === 'zh-CN' ? 'zh-CN' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch (e) { return String(timestamp); }
  };

  const equityCurveData = useMemo(() => {
    if (backtestResults.length === 0) return [];
    const dateToEquityMaps = backtestResults.map(backtest => {
      const map = new Map<unknown, number>();
      (backtest?.results?.equityCurve || []).forEach(point => {
        const equity = safeNumber(point.equity);
        if (point.date !== null && point.date !== undefined && point.date !== '' && equity !== null) map.set(point.date, equity);
      });
      return map;
    });
    const allDatesSet = new Set<unknown>();
    dateToEquityMaps.forEach(map => map.forEach((_equity, date) => allDatesSet.add(date)));
    const sortedDates = Array.from(allDatesSet).sort((left, right) => {
      const leftTime = timestampToMilliseconds(left);
      const rightTime = timestampToMilliseconds(right);
      if (leftTime === null && rightTime === null) return String(left).localeCompare(String(right));
      if (leftTime === null) return 1;
      if (rightTime === null) return -1;
      return leftTime - rightTime;
    });
    
    return sortedDates.map((date: any) => {
      const dataPoint: any = { date: formatUnixTimestamp(date) };
      backtestResults.forEach((_, idx) => dataPoint[`backtest${idx + 1}`] = dateToEquityMaps[idx].get(date) ?? null);
      return dataPoint;
    });
  }, [backtestResults, language]); // eslint-disable-line react-hooks/exhaustive-deps

  const editorialCopy = language === 'zh-CN'
    ? {
        selectorKicker: '01 / 证据集',
        dashboardKicker: '02 / 多策略对照',
        sessionLedger: '回测会话证据摘要',
        analysisKicker: '03 / 证据视图',
        analysisTitle: '收益、风险与稳定性的交叉验证',
        analysisNote: '所有图表仅使用已选回测会话中的持久化结果。',
        historyFallback: '回测服务暂时不可用，当前显示本地保存的历史。',
        historyUnavailable: '无法连接回测服务，且本地没有可用记录。',
        localFallback: '本地历史无法读取，当前显示回测服务返回的记录。',
        localUnavailable: '本地历史无法读取，回测服务也没有返回可用记录。',
        retry: '重试',
        noRiskReward: '已选会话缺少收益、回撤或交易次数，无法生成风险收益图。',
        comparisonLoadError: '无法加载已保存的对比数据，请重新选择回测会话。',
      }
    : {
        selectorKicker: '01 / EVIDENCE SET',
        dashboardKicker: '02 / MULTI-STRATEGY REVIEW',
        sessionLedger: 'Selected backtest sessions',
        analysisKicker: '03 / EVIDENCE VIEWS',
        analysisTitle: 'Compare return, risk, and path stability.',
        analysisNote: 'Charts use the saved results from the sessions you selected.',
        historyFallback: 'The backtest service is unavailable. Showing locally saved history.',
        historyUnavailable: 'The backtest service is unavailable and no local records were found.',
        localFallback: 'Local history could not be read. Showing records returned by the backtest service.',
        localUnavailable: 'Local history could not be read and the backtest service returned no usable records.',
        retry: 'Retry',
        noRiskReward: 'The selected sessions do not include return, drawdown, and trade-count data required for this chart.',
        comparisonLoadError: 'The saved comparison could not be loaded. Select the backtest sessions again.',
      };
  const unknownStrategy = language === 'zh-CN' ? '未知策略' : 'Unknown strategy';

  return (
    <div className="strategy-comparison-shell">
      {loading ? (
        <div className="strategy-lab-loading">
          <Spin size="large" />
          <Text style={{ marginTop: 20, color: 'var(--app-text-muted)', fontWeight: 600 }}>{t.comparison.initializingEngine}</Text>
        </div>
      ) : showSelector ? (
        <>
          <div className="header-section strategy-lab-hero">
            <div className="strategy-lab-hero-copy">
              <span className="strategy-lab-kicker"><SwapOutlined />{editorialCopy.selectorKicker}</span>
              <Title level={1}>{t.comparison.selectSessionsTitle}</Title>
              <Text>{t.comparison.selectSessionsSubtitle}</Text>
            </div>
            <Space className="strategy-lab-actions" wrap>
              {hasPreviousComparison && (
                <Button className="action-btn" type="primary" ghost icon={<HistoryOutlined />} onClick={() => setShowSelector(false)}>{t.comparison.backToComparison}</Button>
              )}
              <Button className="action-btn" icon={<ReloadOutlined />} onClick={() => void loadHistory()} loading={historyLoading}>{t.comparison.refreshHistory}</Button>
              <Button className="action-btn" icon={<LeftOutlined />} onClick={() => navigate('/backtest')}>{t.comparison.backToBacktest}</Button>
            </Space>
          </div>

          {historyIssue && (
            <Alert
              message={historyIssue === 'fallback'
                ? editorialCopy.historyFallback
                : historyIssue === 'local'
                  ? (history.length > 0 ? editorialCopy.localFallback : editorialCopy.localUnavailable)
                  : editorialCopy.historyUnavailable}
              type={(historyIssue === 'fallback' || historyIssue === 'local') && history.length > 0 ? 'warning' : 'error'}
              showIcon
              action={<Button size="small" onClick={() => void loadHistory()} loading={historyLoading}>{editorialCopy.retry}</Button>}
              style={{ marginBottom: 16 }}
            />
          )}

          <Card className="premium-card comparison-selector-card" bodyStyle={{ padding: 0 }} loading={historyLoading}>
            {history.length > 0 ? (
              <>
                <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--app-border-soft)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Space size={12}>
                    <div className="selection-badge">{t.comparison.sessionsSelected.replace('{count}', String(selectedHistoryKeys.length))}</div>
                    {selectedHistoryKeys.length < 2 && <div className="warning-pill"><HistoryOutlined />{t.comparison.selectAtLeast2}</div>}
                  </Space>
                </div>
                <div style={{ width: '100%', overflowX: 'auto' }}>
                  <Table 
                    className="professional-table"
                    dataSource={history}
                    rowKey="backtestId"
                    pagination={{ pageSize: 10, showSizeChanger: true, style: { padding: '16px 24px' } }}
                    rowSelection={{ columnWidth: 52, selectedRowKeys: selectedHistoryKeys, onChange: (keys) => setSelectedHistoryKeys(keys as string[]) }}
                    columns={[
                      {
                        title: t.comparison.colSymbol, dataIndex: 'symbol', key: 'symbol', width: 140,
                        render: (s, r) => {
                          const symbol = s || r.parameters?.symbol || r.parameters?.symbols?.[0];
                          return (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--app-card-bg-soft)', border: '1px solid var(--app-border-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: 'var(--app-text-muted)', fontSize: 10 }}>{symbol?.substring(0, 2) || '?'}</div>
                            <Text strong style={{ fontSize: 14, color: 'var(--app-text-strong)' }}>{symbol || '—'}</Text>
                          </div>
                          );
                        }
                      },
                      {
                        title: t.comparison.colStrategy, dataIndex: 'strategy', key: 'strategy', width: 150,
                        render: (s, record) => { const strategy = s || record.parameters?.strategy; return <Tag className="strategy-pill" color="blue">{(t.strategies as Record<string, string>)[strategy] || strategy || unknownStrategy}</Tag>; }
                      },
                      {
                        title: t.comparison.colReturn, dataIndex: 'totalReturn', key: 'totalReturn', width: 110, align: 'right',
                        sorter: (a, b) => compareNullableAscending(a.results?.totalReturn, b.results?.totalReturn),
                        render: (r, record) => {
                          const val = r ?? record.results?.totalReturn;
                          const number = safeNumber(val);
                          return <Text strong style={{ color: number === null ? 'var(--app-text-muted)' : number >= 0 ? '#10b981' : '#ef4444', fontSize: 13.5 }}>{formatPercent(number)}</Text>;
                        }
                      },
                      {
                        title: t.comparison.colSharpe, dataIndex: 'sharpeRatio', key: 'sharpeRatio', width: 100, align: 'right',
                        sorter: (a, b) => compareNullableAscending(a.results?.sharpeRatio, b.results?.sharpeRatio),
                        render: (s, record) => {
                          const val = s ?? record.results?.sharpeRatio;
                          return <Text style={{ fontSize: 13.5, color: 'var(--app-text-strong)', fontWeight: 700 }}>{formatNumber(val)}</Text>;
                        }
                      },
                      {
                        title: t.comparison.colMaxDD, dataIndex: 'maxDrawdown', key: 'maxDrawdown', width: 110, align: 'right',
                        sorter: (a, b) => compareNullableAscending(a.results?.maxDrawdown, b.results?.maxDrawdown),
                        render: (d, record) => {
                          const val = d ?? record.results?.maxDrawdown;
                          const n = safeNumber(val);
                          return <Text style={{ color: '#ef4444', fontWeight: 700, fontSize: 13.5 }}>{n !== null ? `-${Math.abs(n).toFixed(2)}%` : '—'}</Text>;
                        }
                      },
                      {
                        title: t.comparison.colDate, dataIndex: 'createdAt', key: 'createdAt', width: 120, align: 'right',
                        render: (d, record) => {
                          const date = d || record.timestamp;
                          const milliseconds = timestampToMilliseconds(date);
                          return milliseconds !== null ? <Text style={{ fontSize: 12.5, color: 'var(--app-text-muted)' }}>{new Date(milliseconds).toLocaleDateString(language === 'zh-CN' ? 'zh-CN' : 'en-US')}</Text> : <Text type="secondary">—</Text>;
                        }
                      }
                    ]}
                  />
                </div>
                <div style={{ padding: '32px 0 48px 0', textAlign: 'center', borderTop: '1px solid var(--app-border-soft)' }}>
                  <Button type="primary" size="large" icon={<SwapOutlined />} disabled={selectedHistoryKeys.length < 2} onClick={handleCompareSelected} className="primary-cta-button">
                    {t.comparison.generateComparison.replace('{count}', String(selectedHistoryKeys.length))}
                  </Button>
                </div>
              </>
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<div style={{ padding: '80px 0' }}><p style={{ fontSize: 18, color: 'var(--app-text-muted)', fontWeight: 600 }}>{t.comparison.noHistoryAvailable}</p><Button type="primary" size="large" onClick={() => navigate('/backtest')} className="primary-cta-button">{t.comparison.goToBacktest}</Button></div>} />
            )}
          </Card>
        </>
      ) : (
        <>
          <div className="header-section strategy-lab-hero">
            <div className="strategy-lab-hero-copy">
              <span className="strategy-lab-kicker"><BarChartOutlined />{editorialCopy.dashboardKicker}</span>
              <Title level={1}>{t.comparison.dashboardTitle}</Title>
              <Text>{t.comparison.dashboardSubtitle}</Text>
              <div className="strategy-lab-meta">
                <span><i />{backtestResults.length} {t.comparison.sessionsSelected.replace('{count}', '').trim()}</span>
                <span>{editorialCopy.sessionLedger}</span>
              </div>
            </div>
            <Space className="strategy-lab-actions" wrap>
              <Button className="action-btn" icon={<SwapOutlined />} onClick={() => { setShowSelector(true); void loadHistory(); }}>{t.comparison.changeSelection}</Button>
              <Button className="action-btn" icon={<LeftOutlined />} onClick={() => navigate('/backtest')}>{t.comparison.backToBacktest}</Button>
            </Space>
          </div>

          <div className="comparison-summary-ledger">
            <SummaryCard title={t.comparison.bestReturn} value={formatPercent(summaryMetrics?.bestReturn?.results?.totalReturn)} unit={summaryMetrics?.bestReturn?.parameters?.symbol || ''} color="var(--app-positive)" />
            <SummaryCard title={t.comparison.bestSharpe} value={formatNumber(summaryMetrics?.bestSharpe?.results?.sharpeRatio)} unit={summaryMetrics?.bestSharpe?.parameters?.symbol || ''} color="var(--app-accent-secondary)" />
            <SummaryCard title={t.comparison.lowestDrawdown} value={formatDrawdown(summaryMetrics?.lowestDD?.results?.maxDrawdown)} unit={summaryMetrics?.lowestDD?.parameters?.symbol || ''} color="#ef4444" />
            <SummaryCard title={t.comparison.highestWinRate} value={formatPercent(summaryMetrics?.bestWinRate?.results?.winRate, 1)} unit={summaryMetrics?.bestWinRate?.parameters?.symbol || ''} color="#f59e0b" />
            <SummaryCard title={t.comparison.bestProfitFactor} value={formatNumber(summaryMetrics?.bestProfitFactor?.results?.profitFactor)} unit={summaryMetrics?.bestProfitFactor?.parameters?.symbol || ''} color="#722ed1" />
          </div>

          <div className="comparison-session-grid">
            {backtestResults.map((b, idx) => {
              const colors = BACKTEST_COLORS[idx % BACKTEST_COLORS.length];
              return (
                <Card key={b.backtestId} size="small" className="premium-card comparison-session-card" style={{ borderTop: `3px solid ${colors.primary}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, padding: '4px 8px' }}>
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--app-text-strong)' }}>{b.parameters.symbol || '—'}</div>
                      <Text style={{ fontSize: 12, color: 'var(--app-text-muted)', fontWeight: 600 }}>{(t.strategies as Record<string, string>)[b.parameters.strategy] || b.parameters.strategy || unknownStrategy}</Text>
                    </div>
                    <Tag color={colors.primary + '1a'} style={{ color: colors.primary, border: 'none', fontWeight: 800, margin: 0, borderRadius: 6 }}>{t.comparison.sessionPrefix.replace('{index}', String(idx + 1)).toUpperCase()}</Tag>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px', padding: '0 8px' }}>
                    <div><Text style={{ fontSize: '9.5px', color: 'var(--app-text-muted)', fontWeight: 800, textTransform: 'uppercase', display: 'block' }}>{t.comparison.returnLabel}</Text><Text style={{ fontSize: 16, fontWeight: 800, color: safeNumber(b.results?.totalReturn) === null ? 'var(--app-text-muted)' : (safeNumber(b.results?.totalReturn) as number) >= 0 ? '#10b981' : '#ef4444' }}>{formatPercent(b.results?.totalReturn)}</Text></div>
                    <div><Text style={{ fontSize: '9.5px', color: 'var(--app-text-muted)', fontWeight: 800, textTransform: 'uppercase', display: 'block' }}>{t.comparison.sharpeLabel}</Text><Text style={{ fontSize: 16, fontWeight: 800, color: 'var(--app-text-strong)' }}>{formatNumber(b.results?.sharpeRatio)}</Text></div>
                    <div><Text style={{ fontSize: '9.5px', color: 'var(--app-text-muted)', fontWeight: 800, textTransform: 'uppercase', display: 'block' }}>{t.comparison.maxDDLabel}</Text><Text style={{ fontSize: 16, fontWeight: 800, color: safeNumber(b.results?.maxDrawdown) === null ? 'var(--app-text-muted)' : '#ef4444' }}>{formatDrawdown(b.results?.maxDrawdown)}</Text></div>
                    <div><Text style={{ fontSize: '9.5px', color: 'var(--app-text-muted)', fontWeight: 800, textTransform: 'uppercase', display: 'block' }}>{t.comparison.winRateLabel}</Text><Text style={{ fontSize: 16, fontWeight: 800, color: 'var(--app-text-strong)' }}>{formatPercent(b.results?.winRate, 1)}</Text></div>
                  </div>
                  <Divider style={{ margin: '16px 0', borderColor: 'var(--app-border-soft)' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 8px 8px 8px' }}>
                    <Text style={{ fontSize: 11, color: 'var(--app-text-muted)', fontWeight: 600 }}>{b.parameters.startDate || '—'} – {b.parameters.endDate || '—'}</Text>
                    <StatusTag status={b.status === 'completed' || b.status === 'running' || b.status === 'failed' ? b.status : 'unknown'} />
                  </div>
                </Card>
              );
            })}
          </div>

          <Card title={<span style={{ fontWeight: 800, color: 'var(--app-text-strong)' }}>{t.comparison.sessionRankingTitle}</span>} className="premium-card comparison-ranking-card" style={{ marginBottom: 32 }} bodyStyle={{ padding: 0 }}>
            <Table
              className="professional-table"
              dataSource={[...backtestResults].sort((a, b) => compareNullableDescending(a.results?.totalReturn, b.results?.totalReturn))}
              rowKey="backtestId"
              pagination={false}
              columns={[
                { title: t.ranking.colRank, key: 'rank', width: 80, align: 'center', render: (_, __, i) => <div style={{ width: 28, height: 28, borderRadius: '50%', background: i === 0 ? '#fbbf24' : i === 1 ? '#cbd5e1' : i === 2 ? '#d97706' : 'var(--app-card-bg-soft)', border: i >= 3 ? '1px solid var(--app-border-soft)' : 'none', color: i < 3 ? '#fff' : 'var(--app-text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13, margin: '0 auto' }}>{i + 1}</div> },
                { title: t.comparison.colSymbol, dataIndex: ['parameters', 'symbol'], key: 'symbol', render: (s) => <Tag color="blue" style={{ fontWeight: 800, borderRadius: 6 }}>{s || '—'}</Tag> },
                { title: t.comparison.colStrategy, dataIndex: ['parameters', 'strategy'], key: 'strategy', render: (s) => <Text style={{ color: 'var(--app-text-muted)', fontWeight: 600 }}>{(t.strategies as Record<string, string>)[s] || s || unknownStrategy}</Text> },
                { title: t.comparison.colReturn, dataIndex: ['results', 'totalReturn'], key: 'totalReturn', align: 'right', render: (v) => { const number = safeNumber(v); return <Text strong style={{ color: number === null ? 'var(--app-text-muted)' : number >= 0 ? '#10b981' : '#ef4444' }}>{formatPercent(number)}</Text>; } },
                { title: t.comparison.colSharpe, dataIndex: ['results', 'sharpeRatio'], key: 'sharpeRatio', align: 'right', render: (v) => <Text style={{ fontWeight: 700, color: 'var(--app-text-strong)' }}>{formatNumber(v)}</Text> },
                { title: t.comparison.colMaxDD, dataIndex: ['results', 'maxDrawdown'], key: 'maxDrawdown', align: 'right', render: (v) => <Text style={{ color: safeNumber(v) === null ? 'var(--app-text-muted)' : '#ef4444', fontWeight: 700 }}>{formatDrawdown(v)}</Text> },
                { title: t.comparison.colWinRate, dataIndex: ['results', 'winRate'], key: 'winRate', align: 'right', render: (v) => <Text style={{ fontWeight: 600, color: 'var(--app-text-strong)' }}>{formatPercent(v, 1)}</Text> },
                { title: t.comparison.metricTrades, dataIndex: ['results', 'trades'], key: 'trades', align: 'right', render: (v) => { const number = safeNumber(v); return <Tag style={{ borderRadius: 6, fontWeight: 700, background: 'var(--app-card-bg-soft)', color: 'var(--app-text)', border: '1px solid var(--app-border-soft)' }}>{number === null ? '—' : number.toLocaleString()}</Tag>; } }
              ]}
            />
          </Card>

          <section className="comparison-evidence-board">
            <header className="comparison-evidence-heading">
              <div><span>{editorialCopy.analysisKicker}</span><h2>{editorialCopy.analysisTitle}</h2></div>
              <p>{editorialCopy.analysisNote}</p>
            </header>
            <div className="comparison-analysis-grid">
              <Card title={<Space><BarChartOutlined /><span style={{ fontWeight: 800, color: 'var(--app-text-strong)' }}>{t.comparison.performanceMetricsViz}</span></Space>} className="premium-card comparison-analysis-card">
                <div className="comparison-analysis-chart">
                  {hasBarChartData ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={barChartData} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--app-border-soft)" />
                        <XAxis dataKey="metric" tick={{ fontSize: 11, fontWeight: 600, fill: 'var(--app-text-muted)' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: 'var(--app-text-muted)' }} axisLine={false} tickLine={false} />
                        <Tooltip cursor={{ fill: 'var(--app-card-bg-soft)' }} contentStyle={{ backgroundColor: 'var(--app-card-bg)', borderRadius: 2, border: '1px solid var(--app-border-soft)', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', color: 'var(--app-text)' }} itemStyle={{ color: 'var(--app-text)' }} />
                        <Legend iconType="circle" wrapperStyle={{ paddingTop: 20, fontSize: 12, color: 'var(--app-text-muted)' }} />
                        {backtestResults.map((_, i) => <Bar key={`b${i + 1}`} dataKey={`backtest${i + 1}`} name={t.comparison.sessionN.replace('{index}', String(i + 1))} fill={BACKTEST_COLORS[i % BACKTEST_COLORS.length].primary} radius={[2, 2, 0, 0]} barSize={24} />)}
                      </BarChart>
                    </ResponsiveContainer>
                  ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t.comparison.noData} />}
                </div>
              </Card>
              <Card title={<Space><LineChartOutlined /><span style={{ fontWeight: 800, color: 'var(--app-text-strong)' }}>{t.comparison.riskRewardQuadrant}</span></Space>} className="premium-card comparison-analysis-card">
                <div className="comparison-analysis-chart">
                  {riskRewardData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--app-border-soft)" />
                        <XAxis type="number" dataKey="maxDrawdown" name={t.comparison.colMaxDD} unit="%" label={{ value: t.comparison.riskLabel, position: 'insideBottom', offset: -10, fontSize: 11, fill: 'var(--app-text-muted)', fontWeight: 700 }} tick={{ fontSize: 10, fill: 'var(--app-text-muted)' }} />
                        <YAxis type="number" dataKey="totalReturn" name={t.comparison.colReturn} unit="%" label={{ value: t.comparison.rewardLabel, angle: -90, position: 'insideLeft', fontSize: 11, fill: 'var(--app-text-muted)', fontWeight: 700 }} tick={{ fontSize: 10, fill: 'var(--app-text-muted)' }} />
                        <ZAxis type="number" dataKey="trades" range={[100, 500]} />
                        <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ backgroundColor: 'var(--app-card-bg)', borderRadius: 2, border: '1px solid var(--app-border-soft)', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', color: 'var(--app-text)' }} itemStyle={{ color: 'var(--app-text)' }} />
                        <Scatter name={t.comparison.strategiesLabel} data={riskRewardData}>{riskRewardData.map((point, index) => <Cell key={`${point.name}-${index}`} fill={point.fill} />)}</Scatter>
                      </ScatterChart>
                    </ResponsiveContainer>
                  ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={editorialCopy.noRiskReward} />}
                </div>
              </Card>
            </div>
          </section>

          <Card title={<Space><LineChartOutlined style={{ color: 'var(--app-accent)' }} /><span style={{ fontWeight: 800, color: 'var(--app-text-strong)' }}>{t.comparison.relativeEquityGrowth}</span></Space>} className="premium-card comparison-equity-card" style={{ marginBottom: 32 }}>
            {equityCurveData.length > 0 ? (
              <div className="comparison-equity-chart"><ResponsiveContainer width="100%" height="100%"><LineChart data={equityCurveData} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--app-border-soft)" /><XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--app-text-muted)' }} axisLine={false} tickLine={false} /><YAxis tick={{ fontSize: 10, fill: 'var(--app-text-muted)' }} axisLine={false} tickLine={false} domain={['auto', 'auto']} /><Tooltip contentStyle={{ backgroundColor: 'var(--app-card-bg)', borderRadius: 2, border: '1px solid var(--app-border-soft)', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', color: 'var(--app-text)' }} itemStyle={{ color: 'var(--app-text)' }} formatter={(v: number) => [`$${v.toLocaleString()}`]} /><Legend iconType="circle" wrapperStyle={{ paddingTop: 24, fontSize: 12, color: 'var(--app-text-muted)' }} />{backtestResults.map((b, i) => <Line key={b.backtestId} type="monotone" dataKey={`backtest${i+1}`} name={`${b.parameters.symbol || '—'} (${(t.strategies as Record<string, string>)[b.parameters.strategy] || b.parameters.strategy || '—'})`} stroke={BACKTEST_COLORS[i % BACKTEST_COLORS.length].primary} strokeWidth={2.5} dot={false} connectNulls activeDot={{ r: 5, strokeWidth: 0 }} />)}</LineChart></ResponsiveContainer></div>
            ) : <Empty description={<span style={{ color: 'var(--app-text-muted)' }}>{t.comparison.noEquityCurveDetailed}</span>} />}
          </Card>
          
          <Card title={<span style={{ fontWeight: 800, color: 'var(--app-text-strong)' }}>{t.comparison.detailedMetricMatrix}</span>} className="premium-card comparison-matrix-card" bodyStyle={{ padding: 24 }}>
            <Table<MetricData> columns={metricColumns} dataSource={metricData} pagination={false} size="small" bordered={false} scroll={{ x: backtestResults.length * 220 + 330 }} />
          </Card>
        </>
      )}

      {error && (
        <div style={{ marginTop: 24 }}>
          <Alert message={<span style={{ fontWeight: 700 }}>{t.comparison.dataAnalysisError}</span>} description={<span style={{ color: 'var(--app-text)' }}>{error === 'comparison_load_failed' ? editorialCopy.comparisonLoadError : error}</span>} type="error" showIcon style={{ borderRadius: 16, background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)' }} action={<Space direction="vertical"><Button type="primary" onClick={() => { setShowSelector(true); void loadHistory(); }} style={{ borderRadius: 8 }}>{t.comparison.returnToSelection}</Button></Space>} />
        </div>
      )}
    </div>
  );
};

export default StrategyComparison;
