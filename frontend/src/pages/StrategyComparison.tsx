import React, { useState, useEffect, useMemo } from "react";
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

const { Title, Text } = Typography;

// 定义数据类型
interface ParameterData {
  key: string;
  parameter: string;
  [key: string]: any; // 动态backtest字段
}

interface MetricData {
  key: string;
  metric: string;
  [key: string]: any; // 动态backtest字段和winner字段
}

// Backtest识别色常量 - 支持多个backtest
const BACKTEST_COLORS = [
  {
    primary: '#1890ff',      // 蓝色系 - Backtest 1
    light: '#eff6ff',        // 极浅蓝
    border: '#bfdbfe',       // 边框蓝
    text: '#1e40af',         // 深蓝文字
    bg: '#eff6ff',           // 背景极浅蓝
  },
  {
    primary: '#722ed1',      // 紫色系 - Backtest 2
    light: '#f5f3ff',        // 极浅紫
    border: '#ddd6fe',       // 边框紫
    text: '#5b21b6',         // 深紫文字
    bg: '#f5f3ff',           // 背景极浅紫
  },
  {
    primary: '#10b981',      // 绿色系 - Backtest 3
    light: '#ecfdf5',        // 极浅绿
    border: '#a7f3d0',       // 边框绿
    text: '#065f46',         // 深绿文字
    bg: '#ecfdf5',           // 背景极浅绿
  },
  {
    primary: '#f59e0b',      // 橙色系 - Backtest 4
    light: '#fffbeb',        // 极浅橙
    border: '#fde68a',       // 边框橙
    text: '#92400e',         // 深橙文字
    bg: '#fffbeb',           // 背景极浅橙
  },
  {
    primary: '#ef4444',      // 红色系 - Backtest 5
    light: '#fef2f2',        // 极浅红
    border: '#fecaca',       // 边框红
    text: '#991b1b',         // 深红文字
    bg: '#fef2f2',           // 背景极浅红
  },
  {
    primary: '#06b6d4',      // 青色系 - Backtest 6
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
    initialCapital: number;
    [key: string]: any;
  };
  results: {
    profitLoss: number;
    totalReturn: number;
    sharpeRatio: number;
    maxDrawdown: number;
    winRate: number;
    trades: number;
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
  timestamp: string;
  status: string;
}

// 统一的单元格容器 - 所有表格使用同一套padding系统
const CellContainer: React.FC<{
  children: React.ReactNode;
  align?: 'left' | 'center' | 'right';
  header?: boolean;
}> = ({ children, align = 'left', header = false }) => {
  const textAlign = align === 'left' ? 'left' : align === 'center' ? 'center' : 'right';
  const padding = header ? '14px 12px' : '12px 12px';
  const backgroundColor = header ? '#f8fafc' : 'transparent';
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
      color: header ? '#94a3b8' : '#0f172a',
      borderBottom: header ? '1px solid rgba(15, 23, 42, 0.06)' : 'none',
    }}>
      {children}
    </div>
  );
};

// ========== 统一的公共renderer函数 ==========

// 1. 统一的标签列renderer（Parameter / Performance Metric）
const renderLabelCell = (text: string, align: 'left' | 'center' | 'right' = 'left') => (
  <CellContainer align={align}>
    <span style={{ fontWeight: 700, color: '#475569' }}>
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
            color: colors.text
          }}>
            {title.toUpperCase()}
          </div>
          <div style={{ 
            fontSize: '10px', 
            fontWeight: 600, 
            color: colors.text,
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
        <span style={{ color: '#334155', fontWeight: 500 }}>
          {value}
        </span>
      </CellContainer>
    );
  } else {
    // 数值列模式
    const isPositive = typeof value === 'string' && (value.startsWith('+') || (!value.startsWith('-') && value.includes('%') && parseFloat(value) > 0));
    const isNegative = typeof value === 'string' && (value.startsWith('-') || (value.includes('%') && parseFloat(value) < 0));
    const color = isPositive ? '#10b981' : isNegative ? '#ef4444' : '#0f172a';
    
    return (
      <CellContainer align="left">
        <span style={{ 
          color, 
          fontWeight: 700, 
          fontVariantNumeric: 'tabular-nums'
        }}>
          {value}
        </span>
      </CellContainer>
    );
  }
};

// 优化的Tag组件
const StatusTag: React.FC<{ status: 'completed' | 'running' | 'failed' }> = ({ status }) => {
  const { t } = useLanguage();
  const config = {
    completed: { color: '#10b981', bg: '#ecfdf5', border: 'rgba(16, 185, 129, 0.1)' },
    running: { color: '#3b82f6', bg: '#eff6ff', border: 'rgba(59, 130, 246, 0.1)' },
    failed: { color: '#ef4444', bg: '#fef2f2', border: 'rgba(239, 68, 68, 0.1)' },
  }[status];

  const statusText = {
    completed: t.comparison.statusCompleted,
    running: t.comparison.statusRunning,
    failed: t.comparison.statusFailed,
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
      backgroundColor: colors.light,
      color: colors.text,
      border: `1px solid ${colors.border}`,
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
}> = ({ title, value, color = '#0f172a', unit = '' }) => {
  return (
    <div style={{
      backgroundColor: '#ffffff',
      border: '1px solid rgba(15, 23, 42, 0.08)',
      borderRadius: '16px',
      padding: '18px 20px',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.02)',
      minWidth: '180px',
      flex: 1,
      transition: 'all 0.3s ease',
    }} className="summary-card-hover">
      <div style={{
        fontSize: '10.5px',
        color: '#94a3b8',
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
        {unit && <span style={{ fontSize: '13px', color: '#94a3b8', marginLeft: '6px', fontWeight: 600 }}>{unit}</span>}
      </div>
    </div>
  );
};

const StrategyComparison: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [backtestResults, setBacktestResults] = useState<RealBacktestResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const { t, language } = useLanguage();

  // History Selector state
  const [history, setHistory] = useState<any[]>([]);
  const [selectedHistoryKeys, setSelectedHistoryKeys] = useState<string[]>([]);
  const [showSelector, setShowSelector] = useState(false);
  const [hasPreviousComparison, setHasPreviousComparison] = useState(false);

  // 统一的列宽 - 调整以适应更宽页面
  const LABEL_COL_WIDTH = 180;
  const BACKTEST_COL_WIDTH = 220;
  const WINNER_COL_WIDTH = 150;

  // 加载回测历史用于选择器
  const loadHistoryFromStorage = () => {
    try {
      const saved = localStorage.getItem('quant_backtest_history');
      if (saved) {
        const parsed = JSON.parse(saved);
        // 只显示已完成的回测
        const completed = parsed.filter((h: any) => h.status === 'completed' || h.status === 'unknown' || (h.results && h.results.totalReturn !== undefined));
        setHistory(completed);
      }
    } catch (err) {
      console.error('Failed to load local backtest history:', err);
    }
  };

  // 从路由state或sessionStorage获取选中的backtests
  useEffect(() => {
    const loadComparisonData = async () => {
      setLoading(true);
      setError('');

      try {
        let selectedBacktests: RealBacktestResult[] = [];

        // 1. 优先从路由state获取
        if (location.state?.selectedBacktests) {
          selectedBacktests = location.state.selectedBacktests;
        }
        // 2. 其次从sessionStorage获取
        else {
          const saved = sessionStorage.getItem('compareBacktests');
          if (saved) {
            selectedBacktests = JSON.parse(saved);
          }
        }

        // 3. 如果没有传递数据或只有1个，显示历史选择器
        if (selectedBacktests.length < 2) {
          setBacktestResults([]);
          setShowSelector(true);
          setHasPreviousComparison(false);
          loadHistoryFromStorage();
          setLoading(false);
          return;
        }

        setBacktestResults(selectedBacktests);
        setShowSelector(false);
        setHasPreviousComparison(true);
        // 同步选中键值
        setSelectedHistoryKeys(selectedBacktests.map(b => b.backtestId));
      } catch (err: any) {
        console.error('加载对比数据出错:', err);
        setError(`Failed to load comparison data: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };

    loadComparisonData();
  }, [location]);

  const handleCompareSelected = () => {
    if (selectedHistoryKeys.length < 2) {
      message.warning(t.comparison.pleaseSelectAtLeast2);
      return;
    }

    const selectedResults = history
      .filter(item => selectedHistoryKeys.includes(item.backtestId))
      .map(item => ({
        ...item,
        parameters: {
          ...item.parameters,
          symbol: item.symbol || (item.parameters && item.parameters.symbols ? item.parameters.symbols[0] : (item.parameters && item.parameters.symbol ? item.parameters.symbol : 'N/A')),
          strategy: item.strategy || (item.parameters ? item.parameters.strategy : 'Unknown'),
          startDate: item.startDate || (item.parameters ? item.parameters.startDate : ''),
          endDate: item.endDate || (item.parameters ? item.parameters.endDate : ''),
          initialCapital: item.initialCapital || (item.parameters ? item.parameters.initialCapital : 100000),
        }
      }));

    sessionStorage.setItem('compareBacktests', JSON.stringify(selectedResults));
    setBacktestResults(selectedResults);
    setShowSelector(false);
    setHasPreviousComparison(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  
  // 计算汇总指标
  const summaryMetrics = useMemo(() => {
    if (backtestResults.length === 0) return null;

    return {
      bestReturn: [...backtestResults].sort((a, b) => (b.results?.totalReturn || 0) - (a.results?.totalReturn || 0))[0],
      bestSharpe: [...backtestResults].sort((a, b) => (b.results?.sharpeRatio || 0) - (a.results?.sharpeRatio || 0))[0],
      lowestDD: [...backtestResults].sort((a, b) => (a.results?.maxDrawdown || 0) - (b.results?.maxDrawdown || 0))[0],
      mostTrades: [...backtestResults].sort((a, b) => (b.results?.trades || 0) - (a.results?.trades || 0))[0],
      bestWinRate: [...backtestResults].sort((a, b) => (b.results?.winRate || 0) - (a.results?.winRate || 0))[0],
      bestProfitFactor: [...backtestResults].sort((a, b) => (b.results?.profitFactor || 0) - (a.results?.profitFactor || 0))[0],
    };
  }, [backtestResults]);

  // 渲染函数 - 获取策略参数
  const getStrategyParameters = (backtest: RealBacktestResult | null) => {
    if (!backtest?.parameters) return 'N/A';
    
    const params = backtest.parameters;
    const strategy = params.strategy || '';
    
    switch(strategy) {
      case 'moving_average':
        return `MA(${params.short_ma || params.shortMaPeriod || 'N/A'}, ${params.long_ma || params.longMaPeriod || 'N/A'})`;
      case 'rsi':
        return `RSI(${params.rsi_period || params.rsiPeriod || 'N/A'}, ${params.oversold || params.rsiOversold || 'N/A'}-${params.overbought || params.rsiOverbought || 'N/A'})`;
      case 'macd':
        return `MACD(${params.fast || params.macdFast || 'N/A'}, ${params.slow || params.macdSlow || 'N/A'}, ${params.signal || params.macdSignal || 'N/A'})`;
      case 'bollinger':
        return `BB(${params.period || params.bollingerPeriod || 'N/A'}, ${params.std_dev || params.bollingerStdDev || 'N/A'})`;
      case 'momentum':
        return `MOM(${params.momentum_period || params.momentumPeriod || 'N/A'})`;
      default:
        return 'N/A';
    }
  };

  // 动态生成指标数据
  const generateMetricData = (): MetricData[] => {
    const metrics = [
      {
        key: '1',
        metric: t.comparison.metricProfitLoss,
        getValue: (backtest: RealBacktestResult | null) => 
          backtest?.results?.profitLoss ? 
            `${backtest.results.profitLoss >= 0 ? '+' : ''}$${Math.abs(backtest.results.profitLoss).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'N/A',
        higherIsBetter: true
      },
      { 
        key: '2',
        metric: t.comparison.metricTotalReturn,
        getValue: (backtest: RealBacktestResult | null) => 
          backtest?.results?.totalReturn ? 
            `${backtest.results.totalReturn >= 0 ? '+' : ''}${backtest.results.totalReturn.toFixed(2)}%` : 'N/A',
        higherIsBetter: true
      },
      { 
        key: '3',
        metric: t.comparison.metricSharpeRatio,
        getValue: (backtest: RealBacktestResult | null) => 
          backtest?.results?.sharpeRatio ? backtest.results.sharpeRatio.toFixed(2) : 'N/A',
        higherIsBetter: true
      },
      { 
        key: '4',
        metric: t.comparison.metricMaxDrawdown,
        getValue: (backtest: RealBacktestResult | null) => 
          backtest?.results?.maxDrawdown ? `${backtest.results.maxDrawdown.toFixed(2)}%` : 'N/A',
        higherIsBetter: false
      },
      { 
        key: '5',
        metric: t.comparison.metricWinRate,
        getValue: (backtest: RealBacktestResult | null) => 
          backtest?.results?.winRate ? `${backtest.results.winRate.toFixed(1)}%` : 'N/A',
        higherIsBetter: true
      },
      { 
        key: '6',
        metric: t.comparison.metricTrades,
        getValue: (backtest: RealBacktestResult | null) => 
          backtest?.results?.trades ? backtest.results.trades.toString() : 'N/A',
        higherIsBetter: true
      },
      { 
        key: '7',
        metric: t.comparison.metricAnnualizedReturn,
        getValue: (backtest: RealBacktestResult | null) => 
          backtest?.results?.annualizedReturn !== undefined ? 
            `${backtest.results.annualizedReturn >= 0 ? '+' : ''}${backtest.results.annualizedReturn.toFixed(2)}%` : 'N/A',
        higherIsBetter: true
      },
      { 
        key: '10',
        metric: t.comparison.metricProfitFactor,
        getValue: (backtest: RealBacktestResult | null) => 
          backtest?.results?.profitFactor !== undefined ? backtest.results.profitFactor.toFixed(2) : 'N/A',
        higherIsBetter: true
      },
      { 
        key: '15',
        metric: t.comparison.metricBuyHoldReturn,
        getValue: (backtest: RealBacktestResult | null) => 
          backtest?.results?.buyHoldReturn !== undefined ? 
            `${backtest.results.buyHoldReturn >= 0 ? '+' : ''}${backtest.results.buyHoldReturn.toFixed(2)}%` : 'N/A',
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
            case '1': value = backtest?.results?.profitLoss || 0; break;
            case '2': value = backtest?.results?.totalReturn || 0; break;
            case '3': value = backtest?.results?.sharpeRatio || 0; break;
            case '4': value = backtest?.results?.maxDrawdown || 0; break;
            case '5': value = backtest?.results?.winRate || 0; break;
            case '6': value = backtest?.results?.trades || 0; break;
            case '7': value = backtest?.results?.annualizedReturn || 0; break;
            case '10': value = backtest?.results?.profitFactor || 0; break;
            case '15': value = backtest?.results?.buyHoldReturn || 0; break;
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
      { key: 'totalReturn', name: t.comparison.chartTotalReturn, format: (v: number) => `${v.toFixed(2)}%` },
      { key: 'sharpeRatio', name: t.comparison.chartSharpeRatio, format: (v: number) => v.toFixed(2) },
      { key: 'maxDrawdown', name: t.comparison.chartMaxDrawdown, format: (v: number) => `${v.toFixed(2)}%` },
      { key: 'winRate', name: t.comparison.chartWinRate, format: (v: number) => `${v.toFixed(1)}%` },
    ];
    return metrics.map(metric => {
      const dataPoint: any = { metric: metric.name, metricKey: metric.key };
      backtestResults.forEach((backtest, index) => {
        const value = backtest?.results?.[metric.key as keyof typeof backtest.results] as number | undefined;
        dataPoint[`backtest${index + 1}`] = value !== undefined ? value : null;
      });
      return dataPoint;
    });
  }, [backtestResults, t]);

  // 处理 Equity Curve
  const formatUnixTimestamp = (timestamp: any) => {
    if (!timestamp) return 'N/A';
    try {
      const ts = typeof timestamp === 'string' ? parseInt(timestamp, 10) : timestamp;
      const date = new Date(ts * 1000);
      return date.toLocaleDateString(language === 'zh-CN' ? 'zh-CN' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch (e) { return String(timestamp); }
  };

  const equityCurveData = useMemo(() => {
    if (backtestResults.length === 0) return [];
    const dateToEquityMaps = backtestResults.map(backtest => {
      const map = new Map();
      (backtest?.results?.equityCurve || []).forEach(point => map.set(point.date, point.equity));
      return map;
    });
    const allDatesSet = new Set();
    backtestResults.forEach(backtest => (backtest?.results?.equityCurve || []).forEach(p => allDatesSet.add(p.date)));
    const sortedDates = Array.from(allDatesSet).sort((a: any, b: any) => new Date(a).getTime() - new Date(b).getTime());
    
    return sortedDates.map((date: any, i) => {
      const dataPoint: any = { date: formatUnixTimestamp(date) };
      backtestResults.forEach((_, idx) => dataPoint[`backtest${idx + 1}`] = dateToEquityMaps[idx].get(date) || null);
      return dataPoint;
    });
  }, [backtestResults, language]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="strategy-comparison-shell">
      <style>{`
        .strategy-comparison-shell {
          max-width: 1400px;
          margin: 0 auto;
          padding: clamp(16px, 1.8vw, 28px);
          animation: fadeIn 0.5s ease-out;
          background: #f7f9fc;
          min-height: 100vh;
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
          transform: translateY(-1px) !important;
        }
        
        .header-section {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 32px;
          gap: 20px;
        }
        @media (max-width: 991px) { .header-section { flex-direction: column; align-items: flex-start; } }

        .action-btn {
          height: 38px !important;
          border-radius: 10px !important;
          font-size: 13.5px !important;
          font-weight: 600 !important;
          display: inline-flex !important;
          align-items: center !important;
          gap: 6px !important;
        }

        .summary-card-hover:hover {
          transform: translateY(-3px);
          box-shadow: 0 6px 16px rgba(0,0,0,0.06) !important;
          border-color: rgba(59, 130, 246, 0.2) !important;
        }

        .selection-badge {
          display: inline-flex;
          align-items: center;
          padding: 6px 12px;
          border-radius: 20px;
          font-size: 12.5px;
          font-weight: 700;
          background: #eff6ff;
          color: #3b82f6;
          border: 1px solid rgba(59, 130, 246, 0.1);
        }
        
        .warning-pill {
          display: inline-flex;
          align-items: center;
          padding: 6px 12px;
          border-radius: 20px;
          font-size: 12.5px;
          font-weight: 600;
          background: #fffbeb;
          color: #d97706;
          border: 1px solid rgba(217, 119, 6, 0.1);
          gap: 6px;
        }

        .professional-table .ant-table-thead > tr > th {
          background: #f8fafc !important;
          font-size: 11px !important;
          text-transform: uppercase !important;
          letter-spacing: 0.8px !important;
          color: #94a3b8 !important;
          font-weight: 800 !important;
          padding: 16px 12px !important;
          border-bottom: 1px solid rgba(15, 23, 42, 0.06) !important;
        }
        
        .professional-table .ant-table-tbody > tr > td { padding: 12px !important; height: 60px; border-bottom: 1px solid rgba(15, 23, 42, 0.04) !important; }
        .professional-table .ant-table-tbody > tr:hover > td { background: #f8fbff !important; }

        .primary-cta-button { 
          height: 48px; font-weight: 700; border-radius: 14px; 
          box-shadow: 0 4px 14px rgba(59, 130, 246, 0.2); 
          transition: all 0.3s; font-size: 16px; padding: 0 48px;
        }
        .primary-cta-button:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(59, 130, 246, 0.3); }

        .strategy-pill { height: 24px; padding: 0 10px; border-radius: 12px; font-size: 11px; font-weight: 700; display: inline-flex; align-items: center; border: none; }
      `}</style>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
          <Spin size="large" />
          <Text style={{ marginTop: 20, color: '#94a3b8', fontWeight: 600 }}>{t.comparison.initializingEngine}</Text>
        </div>
      ) : showSelector ? (
        <>
          <div className="header-section">
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
              <Button className="action-btn" icon={<LeftOutlined />} onClick={() => navigate('/backtest')}>{t.comparison.backToBacktest}</Button>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: '10px', background: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 20 }}>
                    <SwapOutlined />
                  </div>
                  <Title level={1} style={{ margin: 0, fontSize: 'clamp(24px, 2.2vw, 32px)', fontWeight: 800, color: '#0f172a' }}>{t.comparison.selectSessionsTitle}</Title>
                </div>
                <Text style={{ fontSize: 14.5, color: '#64748b', marginLeft: 52 }}>{t.comparison.selectSessionsSubtitle}</Text>
              </div>
            </div>
            <Space>
              {hasPreviousComparison && (
                <Button className="action-btn" type="primary" ghost icon={<HistoryOutlined />} onClick={() => setShowSelector(false)}>{t.comparison.backToComparison}</Button>
              )}
              <Button className="action-btn" icon={<ReloadOutlined />} onClick={loadHistoryFromStorage}>{t.comparison.refreshHistory}</Button>
            </Space>
          </div>

          <Card className="premium-card" bodyStyle={{ padding: 0 }}>
            {history.length > 0 ? (
              <>
                <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(15, 23, 42, 0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
                        render: (s, r) => (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{ width: 32, height: 32, borderRadius: 8, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#64748b', fontSize: 10 }}>{s?.substring(0, 2) || 'N/A'}</div>
                            <Text strong style={{ fontSize: 14, color: '#0f172a' }}>{s || (r.parameters?.symbols?.[0] || 'N/A')}</Text>
                          </div>
                        )
                      },
                      {
                        title: t.comparison.colStrategy, dataIndex: 'strategy', key: 'strategy', width: 150,
                        render: (s) => <Tag className="strategy-pill" color="blue">{(t.strategies as Record<string, string>)[s] || s}</Tag>
                      },
                      {
                        title: t.comparison.colReturn, dataIndex: 'totalReturn', key: 'totalReturn', width: 110, align: 'right',
                        sorter: (a, b) => (a.results?.totalReturn || 0) - (b.results?.totalReturn || 0),
                        render: (r, record) => {
                          const val = r ?? record.results?.totalReturn;
                          return val !== undefined ? <Text strong style={{ color: val >= 0 ? '#10b981' : '#ef4444', fontSize: 13.5 }}>{val >= 0 ? '+' : ''}{val.toFixed(2)}%</Text> : <Text type="secondary">—</Text>;
                        }
                      },
                      {
                        title: t.comparison.colSharpe, dataIndex: 'sharpeRatio', key: 'sharpeRatio', width: 100, align: 'right',
                        sorter: (a, b) => (a.results?.sharpeRatio || 0) - (b.results?.sharpeRatio || 0),
                        render: (s, record) => {
                          const val = s ?? record.results?.sharpeRatio;
                          return val !== undefined ? <Text style={{ fontSize: 13.5, color: '#0f172a', fontWeight: 700 }}>{val.toFixed(2)}</Text> : <Text type="secondary">—</Text>;
                        }
                      },
                      {
                        title: t.comparison.colMaxDD, dataIndex: 'maxDrawdown', key: 'maxDrawdown', width: 110, align: 'right',
                        sorter: (a, b) => (a.results?.maxDrawdown || 0) - (b.results?.maxDrawdown || 0),
                        render: (d, record) => {
                          const val = d ?? record.results?.maxDrawdown;
                          return val !== undefined ? <Text style={{ color: '#ef4444', fontWeight: 700, fontSize: 13.5 }}>-{Math.abs(val).toFixed(2)}%</Text> : <Text type="secondary">—</Text>;
                        }
                      },
                      {
                        title: t.comparison.colDate, dataIndex: 'createdAt', key: 'createdAt', width: 120, align: 'right',
                        render: (d, record) => {
                          const date = d || record.timestamp;
                          return date ? <Text style={{ fontSize: 12.5, color: '#64748b' }}>{new Date(date).toLocaleDateString()}</Text> : <Text type="secondary">—</Text>;
                        }
                      }
                    ]}
                  />
                </div>
                <div style={{ padding: '32px 0 48px 0', textAlign: 'center', borderTop: '1px solid rgba(15, 23, 42, 0.06)' }}>
                  <Button type="primary" size="large" icon={<SwapOutlined />} disabled={selectedHistoryKeys.length < 2} onClick={handleCompareSelected} className="primary-cta-button">
                    {t.comparison.generateComparison.replace('{count}', String(selectedHistoryKeys.length))}
                  </Button>
                </div>
              </>
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<div style={{ padding: '80px 0' }}><p style={{ fontSize: 18, color: '#64748b', fontWeight: 600 }}>{t.comparison.noHistoryAvailable}</p><Button type="primary" size="large" onClick={() => navigate('/backtest')} className="primary-cta-button">{t.comparison.goToBacktest}</Button></div>} />
            )}
          </Card>
        </>
      ) : (
        <>
          <div className="header-section">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: '10px', background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 20 }}>
                  <BarChartOutlined />
                </div>
                <Title level={1} style={{ margin: 0, fontSize: 'clamp(24px, 2.2vw, 32px)', fontWeight: 800, color: '#0f172a' }}>{t.comparison.dashboardTitle}</Title>
              </div>
              <Text style={{ fontSize: 15, color: '#64748b', marginLeft: 52 }}>{t.comparison.dashboardSubtitle}</Text>
            </div>
            <Space>
              <Button className="action-btn" icon={<SwapOutlined />} onClick={() => { setShowSelector(true); loadHistoryFromStorage(); }}>{t.comparison.changeSelection}</Button>
              <Button className="action-btn" icon={<LeftOutlined />} onClick={() => navigate('/backtest')}>{t.comparison.backToBacktest}</Button>
            </Space>
          </div>

          <div style={{ display: 'flex', gap: '20px', marginBottom: '32px', flexWrap: 'wrap' }}>
            <SummaryCard title={t.comparison.bestReturn} value={`${summaryMetrics?.bestReturn?.results?.totalReturn?.toFixed(2) || '0.00'}%`} unit={summaryMetrics?.bestReturn?.parameters?.symbol || ''} color="#10b981" />
            <SummaryCard title={t.comparison.bestSharpe} value={summaryMetrics?.bestSharpe?.results?.sharpeRatio?.toFixed(2) || '0.00'} unit={summaryMetrics?.bestSharpe?.parameters?.symbol || ''} color="#3b82f6" />
            <SummaryCard title={t.comparison.lowestDrawdown} value={`-${Math.abs(summaryMetrics?.lowestDD?.results?.maxDrawdown || 0)?.toFixed(2) || '0.00'}%`} unit={summaryMetrics?.lowestDD?.parameters?.symbol || ''} color="#ef4444" />
            <SummaryCard title={t.comparison.highestWinRate} value={`${summaryMetrics?.bestWinRate?.results?.winRate?.toFixed(1) || '0.0'}%`} unit={summaryMetrics?.bestWinRate?.parameters?.symbol || ''} color="#f59e0b" />
            <SummaryCard title={t.comparison.bestProfitFactor} value={summaryMetrics?.bestProfitFactor?.results?.profitFactor?.toFixed(2) || '0.00'} unit={summaryMetrics?.bestProfitFactor?.parameters?.symbol || ''} color="#722ed1" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20, marginBottom: 32 }}>
            {backtestResults.map((b, idx) => {
              const colors = BACKTEST_COLORS[idx % BACKTEST_COLORS.length];
              return (
                <Card key={b.backtestId} size="small" className="premium-card" style={{ borderTop: `4px solid ${colors.primary}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, padding: '4px 8px' }}>
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>{b.parameters.symbol}</div>
                      <Text style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>{(t.strategies as Record<string, string>)[b.parameters.strategy] || b.parameters.strategy}</Text>
                    </div>
                    <Tag color={colors.light} style={{ color: colors.text, border: 'none', fontWeight: 800, margin: 0, borderRadius: 6 }}>{t.comparison.sessionPrefix.replace('{index}', String(idx + 1)).toUpperCase()}</Tag>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px', padding: '0 8px' }}>
                    <div><Text style={{ fontSize: '9.5px', color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase', display: 'block' }}>{t.comparison.returnLabel}</Text><Text style={{ fontSize: 16, fontWeight: 800, color: (b.results?.totalReturn || 0) >= 0 ? '#10b981' : '#ef4444' }}>{(b.results?.totalReturn || 0) >= 0 ? '+' : ''}{b.results?.totalReturn?.toFixed(2)}%</Text></div>
                    <div><Text style={{ fontSize: '9.5px', color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase', display: 'block' }}>{t.comparison.sharpeLabel}</Text><Text style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>{b.results?.sharpeRatio?.toFixed(2) || '—'}</Text></div>
                    <div><Text style={{ fontSize: '9.5px', color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase', display: 'block' }}>{t.comparison.maxDDLabel}</Text><Text style={{ fontSize: 16, fontWeight: 800, color: '#ef4444' }}>-{Math.abs(b.results?.maxDrawdown || 0).toFixed(2)}%</Text></div>
                    <div><Text style={{ fontSize: '9.5px', color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase', display: 'block' }}>{t.comparison.winRateLabel}</Text><Text style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>{b.results?.winRate?.toFixed(1)}%</Text></div>
                  </div>
                  <Divider style={{ margin: '16px 0' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 8px 8px 8px' }}>
                    <Text style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>{b.parameters.startDate} – {b.parameters.endDate}</Text>
                    <StatusTag status={b.status as any || 'completed'} />
                  </div>
                </Card>
              );
            })}
          </div>

          <Card title={<span style={{ fontWeight: 800, color: '#0f172a' }}>{t.comparison.sessionRankingTitle}</span>} className="premium-card" style={{ marginBottom: 32 }} bodyStyle={{ padding: 0 }}>
            <Table
              className="professional-table"
              dataSource={[...backtestResults].sort((a, b) => (b.results?.totalReturn || 0) - (a.results?.totalReturn || 0))}
              rowKey="backtestId"
              pagination={false}
              columns={[
                { title: t.ranking.colRank, key: 'rank', width: 80, align: 'center', render: (_, __, i) => <div style={{ width: 28, height: 28, borderRadius: '50%', background: i === 0 ? '#fbbf24' : i === 1 ? '#cbd5e1' : i === 2 ? '#d97706' : '#f1f5f9', color: i < 3 ? '#fff' : '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13, margin: '0 auto' }}>{i + 1}</div> },
                { title: t.comparison.colSymbol, dataIndex: ['parameters', 'symbol'], key: 'symbol', render: (s) => <Tag color="blue" style={{ fontWeight: 800, borderRadius: 6 }}>{s}</Tag> },
                { title: t.comparison.colStrategy, dataIndex: ['parameters', 'strategy'], key: 'strategy', render: (s) => <Text style={{ color: '#475569', fontWeight: 600 }}>{(t.strategies as Record<string, string>)[s] || s}</Text> },
                { title: t.comparison.colReturn, dataIndex: ['results', 'totalReturn'], key: 'totalReturn', align: 'right', render: (v) => <Text strong style={{ color: v >= 0 ? '#10b981' : '#ef4444' }}>{v >= 0 ? '+' : ''}{v?.toFixed(2)}%</Text> },
                { title: t.comparison.colSharpe, dataIndex: ['results', 'sharpeRatio'], key: 'sharpeRatio', align: 'right', render: (v) => <Text style={{ fontWeight: 700 }}>{v?.toFixed(2) || '—'}</Text> },
                { title: t.comparison.colMaxDD, dataIndex: ['results', 'maxDrawdown'], key: 'maxDrawdown', align: 'right', render: (v) => <Text style={{ color: '#ef4444', fontWeight: 700 }}>-{Math.abs(v || 0).toFixed(2)}%</Text> },
                { title: t.comparison.colWinRate, dataIndex: ['results', 'winRate'], key: 'winRate', align: 'right', render: (v) => <Text style={{ fontWeight: 600 }}>{v ? `${v.toFixed(1)}%` : '—'}</Text> },
                { title: t.comparison.metricTrades, dataIndex: ['results', 'trades'], key: 'trades', align: 'right', render: (v) => <Tag style={{ borderRadius: 6, fontWeight: 700 }}>{v || 0}</Tag> }
              ]}
            />
          </Card>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))', gap: 24, marginBottom: 32 }}>
            <Card title={<Space><BarChartOutlined style={{ color: '#3b82f6' }} /><span style={{ fontWeight: 800 }}>{t.comparison.performanceMetricsViz}</span></Space>} className="premium-card">
              <div style={{ height: 350 }}><ResponsiveContainer width="100%" height="100%"><BarChart data={barChartData} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" /><XAxis dataKey="metric" tick={{ fontSize: 11, fontWeight: 600, fill: '#94a3b8' }} axisLine={false} tickLine={false} /><YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} /><Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }} /><Legend iconType="circle" wrapperStyle={{ paddingTop: 20, fontSize: 12 }} />{backtestResults.map((_, i) => <Bar key={`b${i+1}`} dataKey={`backtest${i+1}`} name={t.comparison.sessionN.replace('{index}', String(i+1))} fill={BACKTEST_COLORS[i % BACKTEST_COLORS.length].primary} radius={[4, 4, 0, 0]} barSize={24} />)}</BarChart></ResponsiveContainer></div>
            </Card>
            <Card title={<Space><LineChartOutlined style={{ color: '#10b981' }} /><span style={{ fontWeight: 800 }}>{t.comparison.riskRewardQuadrant}</span></Space>} className="premium-card">
              <div style={{ height: 350 }}><ResponsiveContainer width="100%" height="100%"><ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}><CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" /><XAxis type="number" dataKey="maxDrawdown" name="Max DD" unit="%" label={{ value: t.comparison.riskLabel, position: 'insideBottom', offset: -10, fontSize: 11, fill: '#94a3b8', fontWeight: 700 }} tick={{ fontSize: 10, fill: '#94a3b8' }} /><YAxis type="number" dataKey="totalReturn" name="Return" unit="%" label={{ value: t.comparison.rewardLabel, angle: -90, position: 'insideLeft', fontSize: 11, fill: '#94a3b8', fontWeight: 700 }} tick={{ fontSize: 10, fill: '#94a3b8' }} /><ZAxis type="number" dataKey="trades" range={[100, 500]} /><Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }} /><Scatter name={t.comparison.strategiesLabel} data={backtestResults.map((b, i) => ({ name: `B${i+1}`, totalReturn: b.results?.totalReturn || 0, maxDrawdown: Math.abs(b.results?.maxDrawdown || 0), trades: b.results?.trades || 0, color: BACKTEST_COLORS[i % BACKTEST_COLORS.length].primary }))}>{backtestResults.map((_, i) => <Cell key={`c${i}`} fill={BACKTEST_COLORS[i % BACKTEST_COLORS.length].primary} />)}</Scatter></ScatterChart></ResponsiveContainer></div>
            </Card>
          </div>

          <Card title={<Space><LineChartOutlined style={{ color: '#6366f1' }} /><span style={{ fontWeight: 800 }}>{t.comparison.relativeEquityGrowth}</span></Space>} className="premium-card" style={{ marginBottom: 32 }}>
            {equityCurveData.length > 0 ? (
              <div style={{ height: 400 }}><ResponsiveContainer width="100%" height="100%"><LineChart data={equityCurveData} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" /><XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} /><YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} domain={['auto', 'auto']} /><Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }} formatter={(v: number) => [`$${v.toLocaleString()}`]} /><Legend iconType="circle" wrapperStyle={{ paddingTop: 24, fontSize: 12 }} />{backtestResults.map((b, i) => <Line key={b.backtestId} type="monotone" dataKey={`backtest${i+1}`} name={`${b.parameters.symbol} (${(t.strategies as Record<string, string>)[b.parameters.strategy] || b.parameters.strategy})`} stroke={BACKTEST_COLORS[i % BACKTEST_COLORS.length].primary} strokeWidth={3} dot={false} activeDot={{ r: 6, strokeWidth: 0 }} />)}</LineChart></ResponsiveContainer></div>
            ) : <Empty description={t.comparison.noEquityCurveDetailed} />}
          </Card>
          
          <Card title={<span style={{ fontWeight: 800 }}>{t.comparison.detailedMetricMatrix}</span>} className="premium-card" bodyStyle={{ padding: 24 }}>
            <Table<MetricData> columns={metricColumns} dataSource={metricData} pagination={false} size="small" bordered={false} scroll={{ x: backtestResults.length * 220 + 330 }} />
          </Card>
        </>
      )}

      {error && (
        <div style={{ marginTop: 24 }}>
          <Alert message={<span style={{ fontWeight: 700 }}>{t.comparison.dataAnalysisError}</span>} description={error} type="error" showIcon style={{ borderRadius: 16 }} action={<Space direction="vertical"><Button type="primary" onClick={() => setShowSelector(true)} style={{ borderRadius: 8 }}>{t.comparison.returnToSelection}</Button></Space>} />
        </div>
      )}
    </div>
  );
};

export default StrategyComparison;