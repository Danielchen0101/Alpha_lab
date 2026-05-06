import React, { useState, useEffect, useMemo } from "react";
import { Card, Table, Empty, Spin, Alert, Button, Typography, Space, Tag, message, Divider } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useLocation, useNavigate } from "react-router-dom";
import { 
  HistoryOutlined, 
  LeftOutlined, SwapOutlined, ReloadOutlined
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
    light: '#e6f7ff',        // 浅蓝
    border: '#91d5ff',       // 边框蓝
    text: '#0050b3',         // 深蓝文字
    bg: '#f0f9ff',           // 背景浅蓝
  },
  {
    primary: '#722ed1',      // 紫色系 - Backtest 2
    light: '#f9f0ff',        // 浅紫
    border: '#d3adf7',       // 边框紫
    text: '#531dab',         // 深紫文字
    bg: '#f9f0ff',           // 背景浅紫
  },
  {
    primary: '#52c41a',      // 绿色系 - Backtest 3
    light: '#f6ffed',        // 浅绿
    border: '#b7eb8f',       // 边框绿
    text: '#389e0d',         // 深绿文字
    bg: '#f6ffed',           // 背景浅绿
  },
  {
    primary: '#fa8c16',      // 橙色系 - Backtest 4
    light: '#fff7e6',        // 浅橙
    border: '#ffd591',       // 边框橙
    text: '#d46b08',         // 深橙文字
    bg: '#fff7e6',           // 背景浅橙
  },
  {
    primary: '#f5222d',      // 红色系 - Backtest 5
    light: '#fff1f0',        // 浅红
    border: '#ffa39e',       // 边框红
    text: '#cf1322',         // 深红文字
    bg: '#fff1f0',           // 背景浅红
  },
  {
    primary: '#13c2c2',      // 青色系 - Backtest 6
    light: '#e6fffb',        // 浅青
    border: '#87e8de',       // 边框青
    text: '#08979c',         // 深青文字
    bg: '#e6fffb',           // 背景浅青
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
  const padding = header ? '12px 16px' : '10px 16px';
  const backgroundColor = header ? '#fafafa' : 'transparent';
  const fontWeight = header ? 700 : 'normal';
  
  return (
    <div style={{
      textAlign,
      padding,
      width: '100%',
      boxSizing: 'border-box' as const,
      backgroundColor,
      fontWeight,
      fontSize: '14px',
      color: '#1f1f1f',
      borderBottom: header ? '1px solid #f0f0f0' : 'none',
    }}>
      {children}
    </div>
  );
};

// ========== 统一的公共renderer函数 ==========

// 1. 统一的标签列renderer（Parameter / Performance Metric）
const renderLabelCell = (text: string, align: 'left' | 'center' | 'right' = 'left') => (
  <CellContainer align={align}>
    <span style={{ fontWeight: 600, fontSize: '13px', color: '#1a1a1a' }}>
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
        gap: '8px'
      }}>
        <div style={{
          width: '4px',
          height: '20px',
          backgroundColor: colors.primary,
          borderRadius: '2px',
          flexShrink: 0
        }}></div>
        <div>
          <div style={{ 
            fontWeight: 700, 
            fontSize: '14px',
            color: colors.text
          }}>
            {title}
          </div>
          <div style={{ 
            fontSize: '13px', 
            fontWeight: 500, 
            color: colors.text,
            marginTop: '6px',
            opacity: 0.9,
            lineHeight: 1.4
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
        <span style={{ fontSize: '14px', color: '#1f1f1f', fontWeight: 500 }}>
          {value}
        </span>
      </CellContainer>
    );
  } else {
    // 数值列模式 - 现在也使用左对齐
    const isPositive = typeof value === 'string' && (value.startsWith('+') || (!value.startsWith('-') && !value.includes('%')));
    const isNegative = typeof value === 'string' && value.startsWith('-');
    const color = isPositive ? '#389e0d' : isNegative ? '#cf1322' : '#1f1f1f';
    
    return (
      <CellContainer align="left">
        <span style={{ 
          color, 
          fontWeight: 600, 
          fontSize: '14px',
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
    completed: { color: '#389e0d', bg: '#f6ffed', border: '#b7eb8f' },
    running: { color: '#0050b3', bg: '#e6f7ff', border: '#91d5ff' },
    failed: { color: '#cf1322', bg: '#fff2e8', border: '#ffbb96' },
  }[status];

  const statusText = {
    completed: t.comparison.statusCompleted,
    running: t.comparison.statusRunning,
    failed: t.comparison.statusFailed,
  }[status] || status;

  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '4px 12px',
      borderRadius: '12px',
      fontSize: '13px',
      fontWeight: 600,
      backgroundColor: config.bg,
      color: config.color,
      border: `1px solid ${config.border}`,
      height: '26px',
      minWidth: '90px',
    }}>
      {statusText}
    </div>
  );
};

// 优化的WinnerTag组件
const WinnerTag: React.FC<{ position: number }> = ({ position }) => {
  const { t } = useLanguage();
  const colors = BACKTEST_COLORS[(position - 1) % BACKTEST_COLORS.length];

  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '4px 12px',
      borderRadius: '12px',
      fontSize: '13px',
      fontWeight: 700,
      backgroundColor: colors.light,
      color: colors.text,
      border: `1px solid ${colors.border}`,
      height: '26px',
      minWidth: '40px',
    }}>
      {t.comparison.bestPosition.replace('{position}', String(position))}
    </div>
  );
};

// Summary Card组件
const SummaryCard: React.FC<{
  title: string;
  value: string | number;
  color?: string;
  unit?: string;
}> = ({ title, value, color = '#1f1f1f', unit = '' }) => {
  return (
    <div style={{
      backgroundColor: '#ffffff',
      border: '1px solid #e8e8e8',
      borderRadius: '10px',
      padding: '20px',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
      minWidth: '180px',
      flex: 1,
      transition: 'all 0.2s ease',
    }}>
      <div style={{
        fontSize: '13px',
        color: '#595959',
        fontWeight: 600,
        marginBottom: '12px',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
      }}>
        {title}
      </div>
      <div style={{
        fontSize: '24px',
        fontWeight: 700,
        color: color,
        lineHeight: 1.2,
      }}>
        {value}
        {unit && <span style={{ fontSize: '16px', color: '#8c8c8c', marginLeft: '4px', fontWeight: 500 }}>{unit}</span>}
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
  const { t } = useLanguage();

  // History Selector state
  const [history, setHistory] = useState<any[]>([]);
  const [selectedHistoryKeys, setSelectedHistoryKeys] = useState<string[]>([]);
  const [showSelector, setShowSelector] = useState(false);
  const [hasPreviousComparison, setHasPreviousComparison] = useState(false);

  // 统一的列宽 - 调整以适应更宽页面
  const LABEL_COL_WIDTH = 180;
  const BACKTEST_COL_WIDTH = 220;
  const WINNER_COL_WIDTH = 140;

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

  // 如果正在加载，显示加载状态
  if (loading) {
    return (
      <div style={{ 
        padding: '20px 32px', 
        maxWidth: '1600px', 
        margin: '0 auto', 
        backgroundColor: '#fafafa', 
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{ textAlign: 'center' }}>
          <Spin size="large" />
          <div style={{ marginTop: 16, color: '#8c8c8c', fontSize: 16, fontWeight: 500 }}>{t.comparison.initializingEngine}</div>
        </div>
      </div>
    );
  }

  // 如果没有数据或显示选择器
  if (showSelector) {
    return (
      <div style={{ padding: '24px 32px', maxWidth: '1600px', margin: '0 auto', backgroundColor: '#fafafa', minHeight: '100vh' }}>
        <div style={{ marginBottom: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
               <Button 
                icon={<LeftOutlined />} 
                onClick={() => navigate('/backtest')}
                style={{ borderRadius: 6 }}
              >
                {t.comparison.backToBacktest}
              </Button>
              {hasPreviousComparison && (
                <Button
                  type="primary"
                  ghost
                  icon={<HistoryOutlined />}
                  onClick={() => setShowSelector(false)}
                  style={{ borderRadius: 6 }}
                >
                  {t.comparison.backToComparison}
                </Button>
              )}
            </div>
            <Title level={2} style={{ margin: 0, fontWeight: 800 }}><SwapOutlined style={{ marginRight: 10, color: '#1890ff' }} /> {t.comparison.selectSessionsTitle}</Title>
            <Text type="secondary" style={{ fontSize: 16 }}>{t.comparison.selectSessionsSubtitle}</Text>
          </div>
          <Button icon={<ReloadOutlined />} onClick={loadHistoryFromStorage} size="large" style={{ borderRadius: 8 }}>{t.comparison.refreshHistory}</Button>
        </div>

        <Card 
          className="premium-card" 
          style={{ 
            borderRadius: 16, 
            boxShadow: '0 8px 24px rgba(0,0,0,0.06)',
            border: '1px solid #f0f0f0'
          }}
          bodyStyle={{ padding: 24 }}
        >
          {history.length > 0 ? (
            <>
              <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Space>
                  <Tag color="blue" style={{ fontSize: 13, padding: '4px 12px', borderRadius: 6, fontWeight: 700 }}>
                    {t.comparison.sessionsSelected.replace('{count}', String(selectedHistoryKeys.length))}
                  </Tag>
                  {selectedHistoryKeys.length < 2 && (
                    <Text type="warning" style={{ fontSize: 13, fontWeight: 600 }}>
                      <Alert message={t.comparison.selectAtLeast2} type="warning" showIcon style={{ padding: '4px 12px', borderRadius: 6 }} />
                    </Text>
                  )}
                </Space>
              </div>
              <Table 
                dataSource={history}
                rowKey="backtestId"
                pagination={{ pageSize: 10, showSizeChanger: true }}
                rowSelection={{
                  selectedRowKeys: selectedHistoryKeys,
                  onChange: (keys) => setSelectedHistoryKeys(keys as string[])
                }}
                rowClassName={(record) => selectedHistoryKeys.includes(record.backtestId) ? 'ant-table-row-selected' : ''}
                columns={[
                  {
                    title: t.comparison.colSymbol,
                    dataIndex: 'symbol',
                    key: 'symbol',
                    render: (s, r) => (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 32, height: 32, borderRadius: 6, background: '#f0f2f5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#595959', fontSize: 11 }}>
                          {s?.substring(0, 2) || 'N/A'}
                        </div>
                        <Text strong style={{ fontSize: 14 }}>{s || (r.parameters && r.parameters.symbols ? r.parameters.symbols[0] : 'N/A')}</Text>
                      </div>
                    )
                  },
                  {
                    title: t.comparison.colStrategy,
                    dataIndex: 'strategy',
                    key: 'strategy',
                    render: (s) => {
                      const names: any = { moving_average: t.comparison.strategyNameMaCross, rsi: t.comparison.strategyNameRsiShort, macd: t.comparison.strategyNameMacdShort, bollinger: t.comparison.strategyNameBollingerBands, momentum: t.comparison.strategyNameMomentumShort };
                      return <Tag color="geekblue" style={{ fontWeight: 600 }}>{names[s] || s}</Tag>;
                    }
                  },
                  {
                    title: t.comparison.colReturn,
                    dataIndex: 'totalReturn',
                    key: 'totalReturn',
                    sorter: (a, b) => (a.results?.totalReturn || 0) - (b.results?.totalReturn || 0),
                    render: (r, record) => {
                      const val = r ?? record.results?.totalReturn;
                      if (val === undefined) return '—';
                      return <Text strong style={{ color: val >= 0 ? '#52c41a' : '#f5222d', fontSize: 14 }}>{val >= 0 ? '+' : ''}{val.toFixed(2)}%</Text>;
                    }
                  },
                  {
                    title: t.comparison.colSharpe,
                    dataIndex: 'sharpeRatio',
                    key: 'sharpeRatio',
                    sorter: (a, b) => (a.results?.sharpeRatio || 0) - (b.results?.sharpeRatio || 0),
                    render: (s, record) => (s ?? record.results?.sharpeRatio)?.toFixed(2) || '—' 
                  },
                  {
                    title: t.comparison.colMaxDD,
                    dataIndex: 'maxDrawdown',
                    key: 'maxDrawdown',
                    sorter: (a, b) => (a.results?.maxDrawdown || 0) - (b.results?.maxDrawdown || 0),
                    render: (d, record) => {
                      const val = d ?? record.results?.maxDrawdown;
                      if (val === undefined) return '—';
                      return <Text type="danger" style={{ fontWeight: 600 }}>-{Math.abs(val).toFixed(2)}%</Text>;
                    }
                  },
                  {
                    title: t.comparison.colDate,
                    dataIndex: 'createdAt',
                    key: 'createdAt',
                    render: (d, record) => {
                      const date = d || record.timestamp;
                      return date ? new Date(date).toLocaleDateString() : '—';
                    }
                  }
                ]}
              />
              <div style={{ marginTop: 40, textAlign: 'center' }}>
                <Button 
                  type="primary" 
                  size="large" 
                  icon={<SwapOutlined />} 
                  disabled={selectedHistoryKeys.length < 2}
                  onClick={handleCompareSelected}
                  style={{ 
                    height: 56, 
                    padding: '0 60px', 
                    fontSize: 18, 
                    fontWeight: 700, 
                    borderRadius: 12, 
                    boxShadow: '0 8px 20px rgba(24,144,255,0.3)',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                  }}
                >
                  {t.comparison.generateComparison.replace('{count}', String(selectedHistoryKeys.length))}
                </Button>
              </div>
            </>
          ) : (
            <Empty 
              image={Empty.PRESENTED_IMAGE_SIMPLE} 
              description={
                <div style={{ padding: '60px 0' }}>
                  <p style={{ fontSize: 18, color: '#8c8c8c', fontWeight: 500 }}>{t.comparison.noHistoryAvailable}</p>
                  <p style={{ color: '#bfbfbf', marginBottom: 24 }}>{t.comparison.noHistoryDesc}</p>
                  <Button type="primary" size="large" onClick={() => navigate('/backtest')} style={{ borderRadius: 8, height: 48, padding: '0 32px' }}>
                    {t.comparison.goToBacktest}
                  </Button>
                </div>
              } 
            />
          )}
        </Card>
        <style>{`
          .ant-table-row-selected td { background-color: #e6f7ff !important; }
          .premium-card { transition: transform 0.2s ease; }
          .premium-card:hover { transform: translateY(-2px); }
        `}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ 
        padding: '40px 32px', 
        maxWidth: '1600px', 
        margin: '0 auto', 
        backgroundColor: '#fafafa', 
        minHeight: '100vh'
      }}>
        <Alert
          message={<span style={{ fontWeight: 700 }}>{t.comparison.dataAnalysisError}</span>}
          description={error}
          type="error"
          showIcon
          style={{ borderRadius: 12 }}
          action={
            <Space direction="vertical">
              <Button type="primary" onClick={() => setShowSelector(true)} style={{ borderRadius: 6 }}>
                {t.comparison.returnToSelection}
              </Button>
              <Button onClick={() => navigate('/backtest')} style={{ borderRadius: 6 }}>
                {t.comparison.backToSessions}
              </Button>
            </Space>
          }
        />
      </div>
    );
  }
  // 获取策略特定参数
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

  // 动态生成参数对比表格数据
  const generateParameterData = (): ParameterData[] => {
    const parameters = [
      { key: '1', parameter: t.comparison.paramSymbol },
      { key: '2', parameter: t.comparison.paramStrategy },
      { key: '3', parameter: t.comparison.paramPeriod },
      { key: '4', parameter: t.comparison.paramInitialCapital },
      { key: '5', parameter: t.comparison.paramDataSource },
      { key: '6', parameter: t.comparison.paramDataMode },
      { key: '7', parameter: t.comparison.paramCreatedAt },
      { key: '8', parameter: t.comparison.paramBacktestId },
      { key: '9', parameter: t.comparison.paramStatus },
      { key: '10', parameter: t.comparison.paramStrategyParameters },
    ];

    return parameters.map(param => {
      const row: ParameterData = {
        key: param.key,
        parameter: param.parameter,
      };

      // 为每个backtest添加对应的值
      backtestResults.forEach((backtest, index) => {
        const fieldName = `backtest${index + 1}`;
        
        switch(param.key) {
          case '1': // Symbol
            row[fieldName] = backtest?.parameters?.symbol || 'N/A';
            break;
          case '2': // Strategy
            row[fieldName] = backtest?.parameters?.strategy || 'N/A';
            break;
          case '3': // Period
            row[fieldName] = backtest ? `${backtest.parameters.startDate} to ${backtest.parameters.endDate}` : 'N/A';
            break;
          case '4': // Initial Capital
            row[fieldName] = backtest ? `$${backtest.parameters.initialCapital.toLocaleString()}` : 'N/A';
            break;
          case '5': // Data Source
            row[fieldName] = backtest?.parameters?.dataSource || 'Twelve Data';
            break;
          case '6': // Data Mode
            row[fieldName] = backtest?.parameters?.dataMode || 'Live';
            break;
          case '7': // Created At
            row[fieldName] = backtest?.timestamp ? new Date(backtest.timestamp).toLocaleDateString() : 'N/A';
            break;
          case '8': // Backtest ID
            row[fieldName] = backtest?.backtestId?.substring(0, 8) || 'N/A';
            break;
          case '9': // Status
            row[fieldName] = <StatusTag status={backtest?.status as any || 'completed'} />;
            break;
          case '10': // Strategy Parameters
            row[fieldName] = getStrategyParameters(backtest);
            break;
          default:
            row[fieldName] = 'N/A';
        }
      });

      return row;
    });
  };

  const _parameterData = generateParameterData(); // eslint-disable-line @typescript-eslint/no-unused-vars

  // 动态生成性能指标对比表格数据，支持多backtest的winner判定
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
        key: '8',
        metric: t.comparison.metricSortinoRatio,
        getValue: (backtest: RealBacktestResult | null) => 
          backtest?.results?.sortinoRatio !== undefined ? backtest.results.sortinoRatio.toFixed(2) : 'N/A',
        higherIsBetter: true
      },
      { 
        key: '9',
        metric: t.comparison.metricVolatility,
        getValue: (backtest: RealBacktestResult | null) => 
          backtest?.results?.volatility !== undefined ? `${backtest.results.volatility.toFixed(2)}%` : 'N/A',
        higherIsBetter: false
      },
      { 
        key: '10',
        metric: t.comparison.metricProfitFactor,
        getValue: (backtest: RealBacktestResult | null) => 
          backtest?.results?.profitFactor !== undefined ? backtest.results.profitFactor.toFixed(2) : 'N/A',
        higherIsBetter: true
      },
      { 
        key: '11',
        metric: t.comparison.metricExposure,
        getValue: (backtest: RealBacktestResult | null) => 
          backtest?.results?.exposure !== undefined ? `${backtest.results.exposure.toFixed(1)}%` : 'N/A',
        higherIsBetter: true
      },
      { 
        key: '12',
        metric: t.comparison.metricExpectancy,
        getValue: (backtest: RealBacktestResult | null) => 
          backtest?.results?.expectancy !== undefined ? 
            `${backtest.results.expectancy >= 0 ? '+' : ''}$${Math.abs(backtest.results.expectancy).toFixed(2)}` : 'N/A',
        higherIsBetter: true
      },
      { 
        key: '13',
        metric: t.comparison.metricCalmarRatio,
        getValue: (backtest: RealBacktestResult | null) => 
          backtest?.results?.calmarRatio !== undefined ? backtest.results.calmarRatio.toFixed(2) : 'N/A',
        higherIsBetter: true
      },
      { 
        key: '14',
        metric: t.comparison.metricAvgReturnPerTrade,
        getValue: (backtest: RealBacktestResult | null) => 
          backtest?.results?.avgReturnPerTrade !== undefined ? 
            `${backtest.results.avgReturnPerTrade >= 0 ? '+' : ''}$${Math.abs(backtest.results.avgReturnPerTrade).toFixed(2)}` : 'N/A',
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

      // 为每个backtest添加对应的值
      backtestResults.forEach((backtest, index) => {
        const fieldName = `backtest${index + 1}`;
        row[fieldName] = metricConfig.getValue(backtest);
      });

      // 计算winner（在所有backtest中找出最优者）
      if (backtestResults.length > 0) {
        let bestIndex = 0;
        let bestValue = metricConfig.higherIsBetter ? -Infinity : Infinity;
        
        backtestResults.forEach((backtest, index) => {
          let value: number | null = null;
          
          // 根据指标类型提取数值
          switch(metricConfig.key) {
            case '1': // Profit / Loss
              value = backtest?.results?.profitLoss || 0;
              break;
            case '2': // Total Return
              value = backtest?.results?.totalReturn || 0;
              break;
            case '3': // Sharpe Ratio
              value = backtest?.results?.sharpeRatio || 0;
              break;
            case '4': // Max Drawdown
              value = backtest?.results?.maxDrawdown || 0;
              break;
            case '5': // Win Rate
              value = backtest?.results?.winRate || 0;
              break;
            case '6': // Trades
              value = backtest?.results?.trades || 0;
              break;
            case '7': // Annualized Return
              value = backtest?.results?.annualizedReturn || 0;
              break;
            case '8': // Sortino Ratio
              value = backtest?.results?.sortinoRatio || 0;
              break;
            case '9': // Volatility
              value = backtest?.results?.volatility || 0;
              break;
            case '10': // Profit Factor
              value = backtest?.results?.profitFactor || 0;
              break;
            case '11': // Exposure
              value = backtest?.results?.exposure || 0;
              break;
            case '12': // Expectancy
              value = backtest?.results?.expectancy || 0;
              break;
            case '13': // Calmar Ratio
              value = backtest?.results?.calmarRatio || 0;
              break;
            case '14': // Avg Return per Trade
              value = backtest?.results?.avgReturnPerTrade || 0;
              break;
            case '15': // Buy & Hold Return
              value = backtest?.results?.buyHoldReturn || 0;
              break;
          }
          
          if (value !== null) {
            if (metricConfig.higherIsBetter) {
              if (value > bestValue) {
                bestValue = value;
                bestIndex = index;
              }
            } else {
              if (value < bestValue) {
                bestValue = value;
                bestIndex = index;
              }
            }
          }
        });
        
        // 只有当有有效数据时才显示winner
        if (bestValue !== -Infinity && bestValue !== Infinity) {
          row.winner = <WinnerTag position={bestIndex + 1} />;
        }
      }

      return row;
    });
  };

  const metricData = generateMetricData();

  // 构建Backtest列的函数 - 使用统一的renderer
  const buildBacktestColumn = (index: number, mode: 'parameter' | 'metric') => {
    const title = t.comparison.backtestN.replace('{index}', String(index + 1));
    const dataIndex = `backtest${index + 1}`;
    const align = 'left' as const; // 统一左对齐，无论parameter还是metric模式
    const subtitle = backtestResults[index]
      ? `${backtestResults[index].parameters.symbol} • ${backtestResults[index].parameters.strategy}`
      : t.comparison.noData;
    
    return {
      title: renderBacktestHeader(title, subtitle, align, index + 1),
      dataIndex,
      key: dataIndex,
      width: BACKTEST_COL_WIDTH,
      align,
      render: (value: any) => renderBacktestCell(value, mode, align),
    };
  };

  // 构建Winner列
  const buildEmptyColumn = () => ({
    title: (
      <CellContainer align="center" header>
        <span style={{ fontWeight: 700, fontSize: '14px', color: '#1f1f1f' }}>
          {t.comparison.winner}
        </span>
      </CellContainer>
    ),
    dataIndex: 'winner',
    key: 'winner',
    width: WINNER_COL_WIDTH,
    align: 'center' as const,
    render: (winner: React.ReactNode) => (
      <CellContainer align="center">
        {winner}
      </CellContainer>
    ),
  });



  // 性能指标对比表格列定义 - 动态列（有Winner列）
  const metricColumns: ColumnsType<MetricData> = [
    {
      title: (
        <CellContainer align="left" header>
          <span style={{ fontWeight: 600, fontSize: '12px' }}>
            {t.comparison.performanceMetric}
          </span>
        </CellContainer>
      ),
      dataIndex: 'metric',
      key: 'metric',
      width: LABEL_COL_WIDTH,
      align: 'left' as const,
      render: (text: string) => renderLabelCell(text, 'left'),
    },
    // 使用展开运算符 - 动态生成backtest列
    ...backtestResults.map((_, index) => buildBacktestColumn(index, 'metric')),
    buildEmptyColumn(),
  ];

  // 计算表格总宽度，用于横向滚动
  const calculateTableWidth = () => {
    const labelWidth = LABEL_COL_WIDTH;
    const backtestWidth = BACKTEST_COL_WIDTH * backtestResults.length;
    const winnerWidth = WINNER_COL_WIDTH;
    return labelWidth + backtestWidth + winnerWidth;
  };

  const tableWidth = calculateTableWidth();

  // 准备关键指标条形图数据
  const prepareBarChartData = () => {    if (backtestResults.length === 0) return [];

    const metrics = [
      { key: 'totalReturn', name: t.comparison.chartTotalReturn, unit: '%', format: (v: number) => `${v.toFixed(2)}%`, higherIsBetter: true },
      { key: 'sharpeRatio', name: t.comparison.chartSharpeRatio, unit: '', format: (v: number) => v.toFixed(2), higherIsBetter: true },
      { key: 'maxDrawdown', name: t.comparison.chartMaxDrawdown, unit: '%', format: (v: number) => `${v.toFixed(2)}%`, higherIsBetter: false },
      { key: 'winRate', name: t.comparison.chartWinRate, unit: '%', format: (v: number) => `${v.toFixed(1)}%`, higherIsBetter: true },
    ];

    return metrics.map(metric => {
      const dataPoint: any = { metric: metric.name, metricKey: metric.key };
      
      backtestResults.forEach((backtest, index) => {
        const value = backtest?.results?.[metric.key as keyof typeof backtest.results] as number | undefined;
        dataPoint[`backtest${index + 1}`] = value !== undefined ? value : null;
        dataPoint[`backtest${index + 1}Formatted`] = value !== undefined ? metric.format(value) : 'N/A';
      });
      
      return dataPoint;
    });
  };

  const barChartData = prepareBarChartData();

  // 准备风险收益散点图数据
  const prepareScatterChartData = () => {
    return backtestResults.map((backtest, index) => {
      const totalReturn = backtest?.results?.totalReturn || 0;
      const maxDrawdown = backtest?.results?.maxDrawdown || 0;
      const sharpeRatio = backtest?.results?.sharpeRatio || 0;
      const trades = backtest?.results?.trades || 0;
      
      return {
        id: `backtest${index + 1}`,
        name: t.comparison.backtestN.replace('{index}', String(index + 1)),
        label: `${backtest?.parameters?.symbol || 'N/A'} • ${backtest?.parameters?.strategy || 'N/A'}`,
        totalReturn,
        maxDrawdown: Math.abs(maxDrawdown), // 取绝对值，因为回撤是负数
        sharpeRatio,
        trades,
        color: BACKTEST_COLORS[index % BACKTEST_COLORS.length].primary,
      };
    });
  };

  const scatterChartData = prepareScatterChartData();

  // 准备资金曲线对比数据
  // 格式化Unix时间戳为可读日期
  const formatUnixTimestamp = (timestamp: any) => {
    if (!timestamp) return 'N/A';
    try {
      // 如果timestamp是字符串，尝试转换为数字
      const ts = typeof timestamp === 'string' ? parseInt(timestamp, 10) : timestamp;
      // 如果timestamp是秒，转换为毫秒
      const date = new Date(ts * 1000);
      return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      });
    } catch (e) {
      console.error('Date formatting error:', e, 'timestamp:', timestamp);
      return String(timestamp);
    }
  };



  const prepareEquityCurveData = () => {
    if (backtestResults.length === 0) return [];

    // 找出所有backtest中最长的equityCurve长度
    const maxLength = Math.max(...backtestResults.map(b => b?.results?.equityCurve?.length || 0));
    
    if (maxLength === 0) return [];

    // 获取第一个backtest的日期序列（假设所有backtest的日期序列相同或相似）
    const firstBacktest = backtestResults[0];
    const firstEquityCurve = firstBacktest?.results?.equityCurve || [];
    
    // 调试：详细检查原始equityCurve数据
    console.log('=== DETAILED Original equityCurve data debug ===');
    console.log('First backtest equityCurve length:', firstEquityCurve.length);
    if (firstEquityCurve.length > 0) {
      console.log('First 5 points of original equityCurve:');
      firstEquityCurve.slice(0, 5).forEach((point, idx) => {
        console.log(`  [${idx}] date: ${point.date}, equity: ${point.equity}`);
      });
      
      console.log('Last 5 points of original equityCurve:');
      firstEquityCurve.slice(-5).forEach((point, idx) => {
        const originalIdx = firstEquityCurve.length - 5 + idx;
        console.log(`  [${originalIdx}] date: ${point.date}, equity: ${point.equity}`);
      });
      
      // 检查原始日期顺序
      if (firstEquityCurve.length > 1) {
        const firstDate = firstEquityCurve[0].date;
        const lastDate = firstEquityCurve[firstEquityCurve.length - 1].date;
        console.log('Original date range:', { firstDate, lastDate });
        
        try {
          const firstDateObj = new Date(firstDate);
          const lastDateObj = new Date(lastDate);
          const isAscending = firstDateObj < lastDateObj;
          console.log('Original parsed dates:', { 
            firstDate: firstDateObj.toISOString(), 
            lastDate: lastDateObj.toISOString(),
            isAscending
          });
          
          // 如果日期是倒序的，我们需要反转数据
          if (!isAscending) {
            console.log('WARNING: Dates are in DESCENDING order! Need to fix date mapping.');
          }
        } catch (e) {
          console.log('Original date parsing error:', e);
        }
      }
    }
    
    // 检查日期顺序
    let datesAreDescending = false;
    if (firstEquityCurve.length > 1) {
      try {
        const firstDate = new Date(firstEquityCurve[0].date);
        const lastDate = new Date(firstEquityCurve[firstEquityCurve.length - 1].date);
        datesAreDescending = firstDate > lastDate; // 如果第一个日期晚于最后一个日期，说明是倒序
      } catch (e) {
        console.log('Date comparison error:', e);
      }
    }
    
    console.log('Date order analysis:', { datesAreDescending, firstEquityCurveLength: firstEquityCurve.length });
    
    // 创建一个按索引对齐的数据数组，同时包含日期
    const result = [];
    
    // 方法3：先创建日期到equity的映射，然后按日期排序
    console.log('=== Using method 3: Create date-to-equity mapping ===');
    
    // 为每个backtest创建日期到equity的映射
    const dateToEquityMaps = backtestResults.map(backtest => {
      const map = new Map();
      const equityCurve = backtest?.results?.equityCurve || [];
      equityCurve.forEach(point => {
        map.set(point.date, point.equity);
      });
      return map;
    });
    
    // 收集所有日期并排序
    const allDates = new Set();
    backtestResults.forEach(backtest => {
      const equityCurve = backtest?.results?.equityCurve || [];
      equityCurve.forEach(point => {
        allDates.add(point.date);
      });
    });
    
    // 将日期转换为数组并排序
    const sortedDates = Array.from(allDates).sort((a: unknown, b: unknown) => {
      try {
        return new Date(a as string).getTime() - new Date(b as string).getTime();
      } catch (e) {
        return String(a).localeCompare(String(b));
      }
    });
    
    console.log('Sorted dates (first 5):', sortedDates.slice(0, 5));
    console.log('Sorted dates (last 5):', sortedDates.slice(-5));
    
    console.log('=== 修复：保持日期正序，equity也按正序获取 ===');
    console.log('sortedDates长度:', sortedDates.length);
    
    for (let i = 0; i < sortedDates.length; i++) {
      const date = sortedDates[i];
      
      const dataPoint: any = { 
        index: i,
        // 修复：将Unix时间戳转换为可读日期字符串
        date: formatUnixTimestamp(date)
      };
      
      backtestResults.forEach((backtest, backtestIndex) => {
        const equityMap = dateToEquityMaps[backtestIndex];
        
        // 修复：使用正序日期获取equity值，保持时间顺序
        dataPoint[`backtest${backtestIndex + 1}`] = equityMap.get(date) || null;
        // 保存原始时间戳用于排序
        dataPoint[`timestamp${backtestIndex + 1}`] = date;
      });
      
      result.push(dataPoint);
    }
    
    // 调试：验证修复后的数据
    if (result.length > 0) {
      console.log('=== 修复后验证 ===');
      console.log('第一个点（图表最左边）:');
      console.log('  date:', result[0].date, '应该是最早日期');
      console.log('  backtest1:', result[0].backtest1, '应该对应最早日期的equity值');
      
      console.log('最后一个点（图表最右边）:');
      console.log('  date:', result[result.length - 1].date, '应该是最晚日期');
      console.log('  backtest1:', result[result.length - 1].backtest1, '应该对应最晚日期的equity值');
    }
    
    // 调试：详细检查处理后的数据
    if (result.length > 0) {
      console.log('=== DETAILED Processed equityCurveData debug ===');
      console.log('First 5 processed points:');
      result.slice(0, 5).forEach((point, idx) => {
        console.log(`  [${idx}] index: ${point.index}, date: ${point.date}, backtest1: ${point.backtest1}`);
      });
      
      console.log('Last 5 processed points:');
      result.slice(-5).forEach((point, idx) => {
        const originalIdx = result.length - 5 + idx;
        console.log(`  [${originalIdx}] index: ${point.index}, date: ${point.date}, backtest1: ${point.backtest1}`);
      });
      
      if (result.length > 1) {
        const firstDate = result[0].date;
        const lastDate = result[result.length - 1].date;
        console.log('Processed date range:', { firstDate, lastDate });
        
        try {
          const firstDateObj = new Date(firstDate);
          const lastDateObj = new Date(lastDate);
          console.log('Processed parsed dates:', { 
            firstDate: firstDateObj.toISOString(), 
            lastDate: lastDateObj.toISOString(),
            isAscending: firstDateObj < lastDateObj
          });
          
          // 验证第一个点的数据
          console.log('=== First point verification ===');
          console.log('Leftmost point (index 0):', {
            date: result[0].date,
            backtest1: result[0].backtest1,
            date1: result[0].date1
          });
          
          // 验证最后一个点的数据
          console.log('=== Last point verification ===');
          console.log('Rightmost point (index ' + (result.length - 1) + '):', {
            date: result[result.length - 1].date,
            backtest1: result[result.length - 1].backtest1,
            date1: result[result.length - 1].date1
          });
        } catch (e) {
          console.log('Processed date parsing error:', e);
        }
      }
    }
    
    // 添加Benchmark (Buy & Hold) 曲线
    if (result.length > 0 && backtestResults.length > 0) {
      // 使用第一个回测作为基准
      const firstBacktest = backtestResults[0];
      const initialCapital = firstBacktest.parameters.initialCapital || 100000;
      const buyHoldReturn = firstBacktest.results.buyHoldReturn || 0;
      
      // 计算Benchmark曲线
      // 假设线性增长（简化模型）
      const totalPoints = result.length;
      result.forEach((point, index) => {
        // 计算从开始到当前点的进度比例
        const progressRatio = totalPoints > 1 ? index / (totalPoints - 1) : 0;
        // 计算Benchmark值：初始资本 * (1 + buyHoldReturn * 进度比例)
        const benchmarkValue = initialCapital * (1 + (buyHoldReturn / 100) * progressRatio);
        point.benchmark = Math.round(benchmarkValue * 100) / 100; // 保留两位小数
      });
      
      console.log('=== Benchmark Data Added ===');
      console.log('Initial Capital:', initialCapital);
      console.log('Buy & Hold Return:', buyHoldReturn + '%');
      console.log('First point benchmark:', result[0].benchmark);
      console.log('Last point benchmark:', result[result.length - 1].benchmark);
    }
    
    return result;
  };

  const equityCurveData = prepareEquityCurveData();

  // 调试：打印关键信息
  console.log('=== FINAL Equity Curve Data Summary ===');
  console.log('Total points:', equityCurveData.length);
  if (equityCurveData.length > 0) {
    console.log('Leftmost point (index 0):', {
      date: equityCurveData[0].date,
      backtest1: equityCurveData[0].backtest1,
      date1: equityCurveData[0].date1
    });
    console.log('Rightmost point (index ' + (equityCurveData.length - 1) + '):', {
      date: equityCurveData[equityCurveData.length - 1].date,
      backtest1: equityCurveData[equityCurveData.length - 1].backtest1,
      date1: equityCurveData[equityCurveData.length - 1].date1
    });
    
    // 检查日期顺序
    if (equityCurveData.length > 1) {
      const firstDate = equityCurveData[0].date;
      const lastDate = equityCurveData[equityCurveData.length - 1].date;
      console.log('Final date range:', { firstDate, lastDate });
      
      try {
        const firstDateObj = new Date(firstDate);
        const lastDateObj = new Date(lastDate);
        console.log('Final date order:', { 
          isAscending: firstDateObj < lastDateObj,
          firstDateISO: firstDateObj.toISOString(),
          lastDateISO: lastDateObj.toISOString()
        });
      } catch (e) {
        console.log('Final date parsing error:', e);
      }
    }
  }

  return (
    <div style={{ 
      padding: '24px 32px', 
      maxWidth: '1600px', 
      margin: '0 auto',
      backgroundColor: '#fafafa',
      minHeight: '100vh'
    }}>
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ 
            fontSize: '28px', 
            fontWeight: 700, 
            color: '#1f1f1f',
            marginBottom: '8px',
            letterSpacing: '-0.5px'
          }}>
            {t.comparison.dashboardTitle}
          </h1>
          <p style={{
            fontSize: '16px',
            color: '#595959',
            margin: 0,
            fontWeight: 400,
            lineHeight: 1.5
          }}>
            {t.comparison.dashboardSubtitle}
          </p>
        </div>
        <Space>
          <Button size="large" icon={<SwapOutlined />} onClick={() => { setShowSelector(true); loadHistoryFromStorage(); }} style={{ borderRadius: 8 }}>{t.comparison.changeSelection}</Button>
          <Button size="large" icon={<LeftOutlined />} onClick={() => navigate('/backtest')} style={{ borderRadius: 8 }}>{t.comparison.backToBacktest}</Button>
        </Space>
      </div>
        
      {/* Summary Insights */}
      <div style={{
        display: 'flex',
        gap: '16px',
        marginBottom: '32px',
        flexWrap: 'wrap'
      }}>
        <SummaryCard
          title={t.comparison.bestReturn}
          value={`${summaryMetrics?.bestReturn?.results?.totalReturn?.toFixed(2) || '0.00'}%`}
          unit={summaryMetrics?.bestReturn?.parameters?.symbol || ''}
          color="#52c41a"
        />
        <SummaryCard
          title={t.comparison.bestSharpe}
          value={summaryMetrics?.bestSharpe?.results?.sharpeRatio?.toFixed(2) || '0.00'}
          unit={summaryMetrics?.bestSharpe?.parameters?.symbol || ''}
          color="#1890ff"
        />
        <SummaryCard
          title={t.comparison.lowestDrawdown}
          value={`-${Math.abs(summaryMetrics?.lowestDD?.results?.maxDrawdown || 0)?.toFixed(2) || '0.00'}%`}
          unit={summaryMetrics?.lowestDD?.parameters?.symbol || ''}
          color="#f5222d"
        />
        <SummaryCard
          title={t.comparison.highestWinRate}
          value={`${summaryMetrics?.bestWinRate?.results?.winRate?.toFixed(1) || '0.0'}%`}
          unit={summaryMetrics?.bestWinRate?.parameters?.symbol || ''}
          color="#faad14"
        />
        <SummaryCard
          title={t.comparison.bestProfitFactor}
          value={summaryMetrics?.bestProfitFactor?.results?.profitFactor?.toFixed(2) || '0.00'}
          unit={summaryMetrics?.bestProfitFactor?.parameters?.symbol || ''}
          color="#722ed1"
        />
        <SummaryCard
          title={t.comparison.sessionsCount}
          value={backtestResults.length}
          color="#8c8c8c"
        />
      </div>

      {/* Comparison Grid (Session Cards) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20, marginBottom: 32 }}>
        {backtestResults.map((b, idx) => {
          const colors = BACKTEST_COLORS[idx % BACKTEST_COLORS.length];
          return (
            <Card 
              key={b.backtestId}
              size="small"
              className="premium-card"
              style={{ borderTop: `4px solid ${colors.primary}`, borderRadius: 12 }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#111827' }}>{b.parameters.symbol}</div>
                  <div style={{ fontSize: 12, color: '#8c8c8c', fontWeight: 600 }}>{(t.strategies as Record<string, string>)[b.parameters.strategy] || b.parameters.strategy}</div>
                </div>
                <Tag color={colors.light} style={{ color: colors.text, border: 'none', fontWeight: 700, margin: 0 }}>{t.comparison.sessionPrefix.replace('{index}', String(idx + 1))}</Tag>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px' }}>
                <div>
                  <div style={{ fontSize: 10, color: '#8c8c8c', textTransform: 'uppercase' }}>{t.comparison.returnLabel}</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: (b.results?.totalReturn || 0) >= 0 ? '#52c41a' : '#f5222d' }}>
                    {(b.results?.totalReturn || 0) >= 0 ? '+' : ''}{b.results?.totalReturn?.toFixed(2)}%
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: '#8c8c8c', textTransform: 'uppercase' }}>{t.comparison.sharpeLabel}</div>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>{b.results?.sharpeRatio?.toFixed(2) || '—'}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: '#8c8c8c', textTransform: 'uppercase' }}>{t.comparison.maxDDLabel}</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#f5222d' }}>-{Math.abs(b.results?.maxDrawdown || 0).toFixed(2)}%</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: '#8c8c8c', textTransform: 'uppercase' }}>{t.comparison.winRateLabel}</div>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>{b.results?.winRate?.toFixed(1)}%</div>
                </div>
              </div>
              
              <Divider style={{ margin: '12px 0' }} />
              
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#bfbfbf' }}>
                <span>{b.parameters.startDate} – {b.parameters.endDate}</span>
                <StatusTag status={b.status as any || 'completed'} />
              </div>
            </Card>
          );
        })}
      </div>

      {/* Session Ranking Table */}
      <Card 
        title={
          <div style={{ fontSize: '18px', fontWeight: 700, color: '#1f1f1f' }}>
            {t.comparison.sessionRankingTitle}
          </div>
        }
        style={{ 
          marginBottom: '24px',
          borderRadius: '16px',
          border: '1px solid #e8e8e8',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)'
        }}
        bodyStyle={{ padding: 0 }}
      >
        <Table
          dataSource={[...backtestResults].sort((a, b) => (b.results?.totalReturn || 0) - (a.results?.totalReturn || 0))}
          rowKey="backtestId"
          pagination={false}
          size="middle"
          rowClassName="ranking-row"
          columns={[
            {
              title: t.ranking.colRank,
              key: 'rank',
              width: 70,
              align: 'center',
              render: (_, __, index) => (
                <div style={{ 
                  width: 28, height: 28, borderRadius: '50%', 
                  background: index === 0 ? '#ffd700' : index === 1 ? '#c0c0c0' : index === 2 ? '#cd7f32' : '#f0f2f5',
                  color: index < 3 ? '#fff' : '#8c8c8c',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 800, fontSize: 13, margin: '0 auto'
                }}>
                  {index + 1}
                </div>
              )
            },
            {
              title: t.comparison.colSymbol,
              dataIndex: ['parameters', 'symbol'],
              key: 'symbol',
              render: (s) => <Tag color="blue" style={{ fontWeight: 700 }}>{s}</Tag>
            },
            {
              title: t.comparison.colStrategy,
              dataIndex: ['parameters', 'strategy'],
              key: 'strategy',
              render: (s) => {
                const names: any = { moving_average: t.comparison.strategyShortMaCross, rsi: t.comparison.strategyNameRsiShort, macd: t.comparison.strategyNameMacdShort, bollinger: t.comparison.strategyShortBb, momentum: t.comparison.strategyShortMom };
                return names[s] || s;
              }
            },
            {
              title: t.comparison.colReturn,
              dataIndex: ['results', 'totalReturn'],
              key: 'totalReturn',
              sorter: (a, b) => (a.results?.totalReturn || 0) - (b.results?.totalReturn || 0),
              render: (v) => <Text strong style={{ color: v >= 0 ? '#52c41a' : '#f5222d' }}>{v >= 0 ? '+' : ''}{v?.toFixed(2)}%</Text>
            },
            {
              title: t.comparison.colSharpe,
              dataIndex: ['results', 'sharpeRatio'],
              key: 'sharpeRatio',
              sorter: (a, b) => (a.results?.sharpeRatio || 0) - (b.results?.sharpeRatio || 0),
              render: (v) => v?.toFixed(2) || '—'
            },
            {
              title: t.comparison.colMaxDD,
              dataIndex: ['results', 'maxDrawdown'],
              key: 'maxDrawdown',
              sorter: (a, b) => (a.results?.maxDrawdown || 0) - (b.results?.maxDrawdown || 0),
              render: (v) => <Text type="danger">-{Math.abs(v || 0).toFixed(2)}%</Text>
            },
            {
              title: t.comparison.colWinRate,
              dataIndex: ['results', 'winRate'],
              key: 'winRate',
              render: (v) => v ? `${v.toFixed(1)}%` : '—'
            },
            {
              title: t.comparison.metricProfitFactor,
              dataIndex: ['results', 'profitFactor'],
              key: 'profitFactor',
              render: (v) => v?.toFixed(2) || '—'
            },
            {
              title: t.comparison.metricTrades,
              dataIndex: ['results', 'trades'],
              key: 'trades',
              render: (v) => <Tag color="default">{v || 0}</Tag>
            },
            {
              title: t.comparison.colDate,
              dataIndex: 'timestamp',
              key: 'date',
              render: (t) => t ? new Date(t).toLocaleDateString() : '—'
            },
            {
              title: t.comparison.paramStatus,
              dataIndex: 'status',
              key: 'status',
              render: (s) => <StatusTag status={s as any || 'completed'} />
            }
          ]}
        />
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: 24, marginBottom: 24 }}>
        {/* 关键指标对比条形图 */}
        {backtestResults.length > 0 && barChartData.length > 0 && (
          <Card 
            title={
              <div style={{ fontSize: '18px', fontWeight: 700, color: '#1f1f1f' }}>
                {t.comparison.performanceMetricsViz}
              </div>
            }
            style={{ 
              borderRadius: '16px',
              border: '1px solid #e8e8e8',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)'
            }}
            bodyStyle={{ padding: '20px' }}
          >
            <div style={{ height: '350px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={barChartData}
                  margin={{ top: 10, right: 30, left: 10, bottom: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis 
                    dataKey="metric" 
                    tick={{ fontSize: 12, fill: '#8c8c8c' }}
                    axisLine={{ stroke: '#f0f0f0' }}
                  />
                  <YAxis 
                    tick={{ fontSize: 11, fill: '#8c8c8c' }}
                    axisLine={{ stroke: '#f0f0f0' }}
                  />
                  <Tooltip 
                    cursor={{ fill: '#fafafa' }}
                    formatter={(value: number, name: string) => {
                      const backtestIndex = parseInt(name.replace('backtest', ''));
                      const metricKey = barChartData.find(d => d[`backtest${backtestIndex}`] === value)?.metricKey;
                      let formatted = `${value}`;
                      if (metricKey === 'totalReturn' || metricKey === 'maxDrawdown' || metricKey === 'winRate') {
                        formatted = `${value.toFixed(2)}%`;
                      } else if (metricKey === 'sharpeRatio') {
                        formatted = value.toFixed(2);
                      }
                      return [formatted, t.comparison.sessionN.replace('{index}', String(backtestIndex))];
                    }}
                    contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  />
                  {backtestResults.map((_, index) => (
                    <Bar 
                      key={`backtest${index + 1}`}
                      dataKey={`backtest${index + 1}`}
                      name={`backtest${index + 1}`}
                      fill={BACKTEST_COLORS[index % BACKTEST_COLORS.length].primary}
                      radius={[4, 4, 0, 0]}
                      barSize={20}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}

        {/* 风险收益散点图 */}
        {backtestResults.length > 0 && scatterChartData.length > 0 && (
          <Card 
            title={
              <div style={{ fontSize: '18px', fontWeight: 700, color: '#1f1f1f' }}>
                {t.comparison.riskRewardQuadrant}
              </div>
            }
            style={{ 
              borderRadius: '16px',
              border: '1px solid #e8e8e8',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)'
            }}
            bodyStyle={{ padding: '20px' }}
          >
            <div style={{ height: '350px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis 
                    type="number" dataKey="maxDrawdown" name="Max DD" unit="%" 
                    label={{ value: t.comparison.riskLabel, position: 'insideBottom', offset: -10, fontSize: 12, fill: '#8c8c8c' }}
                    tick={{ fontSize: 11, fill: '#8c8c8c' }}
                  />
                  <YAxis 
                    type="number" dataKey="totalReturn" name="Return" unit="%" 
                    label={{ value: t.comparison.rewardLabel, angle: -90, position: 'insideLeft', fontSize: 12, fill: '#8c8c8c' }}
                    tick={{ fontSize: 11, fill: '#8c8c8c' }}
                  />
                  <ZAxis type="number" dataKey="trades" range={[100, 500]} />
                  <Tooltip 
                    cursor={{ strokeDasharray: '3 3' }}
                    contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                    formatter={(value: any, name: string) => {
                      if (name === 'Return') return [`${value.toFixed(2)}%`, name];
                      if (name === 'Max DD') return [`-${Math.abs(value).toFixed(2)}%`, name];
                      return [value, name];
                    }}
                  />
                  <Scatter name={t.comparison.strategiesLabel} data={scatterChartData}>
                    {scatterChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}
      </div>

      {/* 资金曲线对比图 */}
      {backtestResults.length > 0 && (
        <Card 
          title={
            <div style={{ fontSize: '18px', fontWeight: 700, color: '#1f1f1f' }}>
              {t.comparison.relativeEquityGrowth}
            </div>
          }
          style={{ 
            marginBottom: '24px',
            borderRadius: '16px',
            border: '1px solid #e8e8e8',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)'
          }}
          bodyStyle={{ padding: '20px' }}
        >
          {equityCurveData.length > 0 ? (
            <div style={{ height: '400px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={equityCurveData} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 11, fill: '#8c8c8c' }}
                    axisLine={{ stroke: '#f0f0f0' }}
                  />
                  <YAxis 
                    tick={{ fontSize: 11, fill: '#8c8c8c' }}
                    axisLine={{ stroke: '#f0f0f0' }}
                    domain={['auto', 'auto']}
                  />
                  <Tooltip 
                    contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                    formatter={(value: number, name: string) => [`$${value.toLocaleString()}`, name]}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: 20 }} />
                  {backtestResults.map((b, index) => (
                    <Line 
                      key={b.backtestId}
                      type="monotone"
                      dataKey={`backtest${index + 1}`}
                      name={`${b.parameters.symbol} (${b.parameters.strategy})`}
                      stroke={BACKTEST_COLORS[index % BACKTEST_COLORS.length].primary}
                      strokeWidth={3}
                      dot={false}
                      activeDot={{ r: 6, strokeWidth: 0 }}
                    />
                  ))}
                  <Line 
                    type="monotone" dataKey="benchmark" name={t.comparison.buyHoldBenchmark}
                    stroke="#d9d9d9" strokeWidth={2} strokeDasharray="5 5" dot={false} 
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <Empty description={t.comparison.noEquityCurveDetailed} />
          )}
        </Card>
      )}
      
      {/* 详细指标对比 - 侧重于找Winner */}
      <Card 
        title={
          <div style={{ fontSize: '18px', fontWeight: 700, color: '#1f1f1f' }}>
            {t.comparison.detailedMetricMatrix}
          </div>
        }
        style={{ 
          marginBottom: '24px',
          borderRadius: '16px',
          border: '1px solid #e8e8e8',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)'
        }}
        bodyStyle={{ padding: 24 }}
      >
        <Table<MetricData>
          columns={metricColumns}
          dataSource={metricData}
          pagination={false}
          size="middle"
          bordered={false}
          scroll={{ x: tableWidth }}
          rowClassName={(record, index) => index % 2 === 0 ? "metric-row-even" : "metric-row-odd"}
          style={{ fontSize: "14px" }}
        />
      </Card>

      <style>{`
        .ranking-row:hover { background-color: #f0f7ff !important; cursor: default; }
        .metric-row-even { background-color: #fafafa; }
        .ranking-row .ant-table-cell { border-bottom: 1px solid #f0f0f0 !important; }
        .ant-card-title { border-bottom: none !important; }
      `}</style>
    </div>
  );
};

export default StrategyComparison;