import React, { useState, useEffect } from "react";
import { Card, Table, Tag, Empty, Spin, Alert } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useLocation } from "react-router-dom";
import { backtraderAPI } from "../services/api";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ScatterChart, Scatter, ZAxis, Cell,
  LineChart, Line
} from 'recharts';

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
  const config = {
    completed: { color: '#389e0d', bg: '#f6ffed', border: '#b7eb8f' },
    running: { color: '#0050b3', bg: '#e6f7ff', border: '#91d5ff' },
    failed: { color: '#cf1322', bg: '#fff2e8', border: '#ffbb96' },
  }[status];
  
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
      textTransform: 'capitalize',
    }}>
      {status}
    </div>
  );
};

// 优化的WinnerTag组件
const WinnerTag: React.FC<{ position: number }> = ({ position }) => {
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
      Best #{position}
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
  const [backtestResults, setBacktestResults] = useState<RealBacktestResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  
  // 统一的列宽 - 调整以适应更宽页面
  const LABEL_COL_WIDTH = 180;
  const BACKTEST_COL_WIDTH = 180;
  const WINNER_COL_WIDTH = 120;
  
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
          console.log('从路由state获取到backtests:', selectedBacktests);
        }
        // 2. 其次从sessionStorage获取
        else {
          const saved = sessionStorage.getItem('compareBacktests');
          if (saved) {
            selectedBacktests = JSON.parse(saved);
            console.log('从sessionStorage获取到backtests:', selectedBacktests);
          }
        }
        
        // 3. 如果没有传递数据，显示空状态
        if (selectedBacktests.length === 0) {
          console.log('没有传递backtest数据，显示空状态');
          setBacktestResults([]);
          setLoading(false);
          return;
        }
        
        // 4. 确保至少有2个backtest用于对比（如果只有1个，复制一份作为对比）
        let comparisonBacktests = [...selectedBacktests];
        if (comparisonBacktests.length === 1) {
          console.log('只有一个backtest，复制一份用于对比');
          comparisonBacktests = [comparisonBacktests[0], { ...comparisonBacktests[0], backtestId: comparisonBacktests[0].backtestId + '_copy' }];
        }
        
        // 支持任意数量的backtest对比
        console.log(`有${comparisonBacktests.length}个backtest用于对比`);
        
        setBacktestResults(comparisonBacktests);
        console.log('最终用于对比的backtests:', comparisonBacktests);
        
      } catch (err) {
        console.error('加载对比数据失败:', err);
        setError('加载对比数据失败，请返回重新选择backtest');
      } finally {
        setLoading(false);
      }
    };
    
    loadComparisonData();
  }, [location.state]);
  
  // 如果没有数据或正在加载，显示相应状态
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
        <Spin size="large" tip="加载对比数据中..." />
      </div>
    );
  }
  
  if (error) {
    return (
      <div style={{ 
        padding: '20px 32px', 
        maxWidth: '1600px', 
        margin: '0 auto',
        backgroundColor: '#fafafa',
        minHeight: '100vh'
      }}>
        <Alert
          message="对比数据加载失败"
          description={error}
          type="error"
          showIcon
          style={{ marginBottom: '20px' }}
        />
      </div>
    );
  }
  
  if (backtestResults.length === 0) {
    return (
      <div style={{ 
        padding: '20px 32px', 
        maxWidth: '1600px', 
        margin: '0 auto',
        backgroundColor: '#fafafa',
        minHeight: '100vh'
      }}>
        <Card title="策略对比" style={{ marginBottom: '16px' }}>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <div>
                <p>没有找到要对比的backtest数据</p>
                <p>请返回Backtest页面，选择要对比的backtest后点击"Compare"按钮</p>
              </div>
            }
          />
        </Card>
      </div>
    );
  }

  // 动态生成参数对比表格数据
  const generateParameterData = (): ParameterData[] => {
    const parameters = [
      { key: '1', parameter: 'Symbol' },
      { key: '2', parameter: 'Strategy' },
      { key: '3', parameter: 'Period' },
      { key: '4', parameter: 'Initial Capital' },
      { key: '5', parameter: 'Data Source' },
      { key: '6', parameter: 'Data Mode' },
      { key: '7', parameter: 'Created At' },
      { key: '8', parameter: 'Backtest ID' },
      { key: '9', parameter: 'Status' },
    ];

    return parameters.map(param => {
      const row: ParameterData = {
        key: param.key,
        parameter: param.parameter,
      };

      // 为每个backtest添加对应的值
      backtestResults.forEach((backtest, index) => {
        const fieldName = `backtest${index + 1}`;
        
        switch(param.parameter) {
          case 'Symbol':
            row[fieldName] = backtest?.parameters?.symbol || 'N/A';
            break;
          case 'Strategy':
            row[fieldName] = backtest?.parameters?.strategy || 'N/A';
            break;
          case 'Period':
            row[fieldName] = backtest ? `${backtest.parameters.startDate} to ${backtest.parameters.endDate}` : 'N/A';
            break;
          case 'Initial Capital':
            row[fieldName] = backtest ? `$${backtest.parameters.initialCapital.toLocaleString()}` : 'N/A';
            break;
          case 'Data Source':
            row[fieldName] = backtest?.parameters?.dataSource || 'Twelve Data';
            break;
          case 'Data Mode':
            row[fieldName] = backtest?.parameters?.dataMode || 'Live';
            break;
          case 'Created At':
            row[fieldName] = backtest?.timestamp ? new Date(backtest.timestamp).toLocaleDateString() : 'N/A';
            break;
          case 'Backtest ID':
            row[fieldName] = backtest?.backtestId?.substring(0, 8) || 'N/A';
            break;
          case 'Status':
            row[fieldName] = <StatusTag status={backtest?.status as any || 'completed'} />;
            break;
          default:
            row[fieldName] = 'N/A';
        }
      });

      return row;
    });
  };

  const parameterData = generateParameterData();

  // 动态生成性能指标对比表格数据，支持多backtest的winner判定
  const generateMetricData = (): MetricData[] => {
    const metrics = [
      { 
        key: '1', 
        metric: 'Profit / Loss',
        getValue: (backtest: RealBacktestResult | null) => 
          backtest?.results?.profitLoss ? 
            `${backtest.results.profitLoss >= 0 ? '+' : ''}$${Math.abs(backtest.results.profitLoss).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'N/A',
        higherIsBetter: true
      },
      { 
        key: '2', 
        metric: 'Total Return',
        getValue: (backtest: RealBacktestResult | null) => 
          backtest?.results?.totalReturn ? 
            `${backtest.results.totalReturn >= 0 ? '+' : ''}${backtest.results.totalReturn.toFixed(2)}%` : 'N/A',
        higherIsBetter: true
      },
      { 
        key: '3', 
        metric: 'Sharpe Ratio',
        getValue: (backtest: RealBacktestResult | null) => 
          backtest?.results?.sharpeRatio ? backtest.results.sharpeRatio.toFixed(2) : 'N/A',
        higherIsBetter: true
      },
      { 
        key: '4', 
        metric: 'Max Drawdown',
        getValue: (backtest: RealBacktestResult | null) => 
          backtest?.results?.maxDrawdown ? `${backtest.results.maxDrawdown.toFixed(2)}%` : 'N/A',
        higherIsBetter: false
      },
      { 
        key: '5', 
        metric: 'Win Rate',
        getValue: (backtest: RealBacktestResult | null) => 
          backtest?.results?.winRate ? `${backtest.results.winRate.toFixed(1)}%` : 'N/A',
        higherIsBetter: true
      },
      { 
        key: '6', 
        metric: 'Trades',
        getValue: (backtest: RealBacktestResult | null) => 
          backtest?.results?.trades ? backtest.results.trades.toString() : 'N/A',
        higherIsBetter: true
      },
      { 
        key: '7', 
        metric: 'Annualized Return',
        getValue: (backtest: RealBacktestResult | null) => 
          backtest?.results?.annualizedReturn !== undefined ? 
            `${backtest.results.annualizedReturn >= 0 ? '+' : ''}${backtest.results.annualizedReturn.toFixed(2)}%` : 'N/A',
        higherIsBetter: true
      },
      { 
        key: '8', 
        metric: 'Sortino Ratio',
        getValue: (backtest: RealBacktestResult | null) => 
          backtest?.results?.sortinoRatio !== undefined ? backtest.results.sortinoRatio.toFixed(2) : 'N/A',
        higherIsBetter: true
      },
      { 
        key: '9', 
        metric: 'Volatility',
        getValue: (backtest: RealBacktestResult | null) => 
          backtest?.results?.volatility !== undefined ? `${backtest.results.volatility.toFixed(2)}%` : 'N/A',
        higherIsBetter: false
      },
      { 
        key: '10', 
        metric: 'Profit Factor',
        getValue: (backtest: RealBacktestResult | null) => 
          backtest?.results?.profitFactor !== undefined ? backtest.results.profitFactor.toFixed(2) : 'N/A',
        higherIsBetter: true
      },
      { 
        key: '11', 
        metric: 'Exposure',
        getValue: (backtest: RealBacktestResult | null) => 
          backtest?.results?.exposure !== undefined ? `${backtest.results.exposure.toFixed(1)}%` : 'N/A',
        higherIsBetter: true
      },
      { 
        key: '12', 
        metric: 'Expectancy',
        getValue: (backtest: RealBacktestResult | null) => 
          backtest?.results?.expectancy !== undefined ? 
            `${backtest.results.expectancy >= 0 ? '+' : ''}$${Math.abs(backtest.results.expectancy).toFixed(2)}` : 'N/A',
        higherIsBetter: true
      },
      { 
        key: '13', 
        metric: 'Calmar Ratio',
        getValue: (backtest: RealBacktestResult | null) => 
          backtest?.results?.calmarRatio !== undefined ? backtest.results.calmarRatio.toFixed(2) : 'N/A',
        higherIsBetter: true
      },
      { 
        key: '14', 
        metric: 'Avg Return per Trade',
        getValue: (backtest: RealBacktestResult | null) => 
          backtest?.results?.avgReturnPerTrade !== undefined ? 
            `${backtest.results.avgReturnPerTrade >= 0 ? '+' : ''}$${Math.abs(backtest.results.avgReturnPerTrade).toFixed(2)}` : 'N/A',
        higherIsBetter: true
      },
      { 
        key: '15', 
        metric: 'Buy & Hold Return',
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
          switch(metricConfig.metric) {
            case 'Profit / Loss':
              value = backtest?.results?.profitLoss || 0;
              break;
            case 'Total Return':
              value = backtest?.results?.totalReturn || 0;
              break;
            case 'Sharpe Ratio':
              value = backtest?.results?.sharpeRatio || 0;
              break;
            case 'Max Drawdown':
              value = backtest?.results?.maxDrawdown || 0;
              break;
            case 'Win Rate':
              value = backtest?.results?.winRate || 0;
              break;
            case 'Trades':
              value = backtest?.results?.trades || 0;
              break;
            case 'Annualized Return':
              value = backtest?.results?.annualizedReturn || 0;
              break;
            case 'Sortino Ratio':
              value = backtest?.results?.sortinoRatio || 0;
              break;
            case 'Volatility':
              value = backtest?.results?.volatility || 0;
              break;
            case 'Profit Factor':
              value = backtest?.results?.profitFactor || 0;
              break;
            case 'Exposure':
              value = backtest?.results?.exposure || 0;
              break;
            case 'Expectancy':
              value = backtest?.results?.expectancy || 0;
              break;
            case 'Calmar Ratio':
              value = backtest?.results?.calmarRatio || 0;
              break;
            case 'Avg Return per Trade':
              value = backtest?.results?.avgReturnPerTrade || 0;
              break;
            case 'Buy & Hold Return':
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
    const title = `Backtest ${index + 1}`;
    const dataIndex = `backtest${index + 1}`;
    const align = 'left' as const; // 统一左对齐，无论parameter还是metric模式
    const subtitle = backtestResults[index] 
      ? `${backtestResults[index].parameters.symbol} • ${backtestResults[index].parameters.strategy}`
      : 'No data';
    
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
          Winner
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

  // 参数对比表格列定义 - 动态列（无Winner列）
  const parameterColumns: ColumnsType<ParameterData> = [
    {
      title: (
        <CellContainer align="left" header>
          <span style={{ fontWeight: 600, fontSize: '12px' }}>
            Parameter
          </span>
        </CellContainer>
      ),
      dataIndex: 'parameter',
      key: 'parameter',
      width: LABEL_COL_WIDTH,
      align: 'left' as const,
      render: (text: string) => renderLabelCell(text, 'left'),
    },
    // 使用展开运算符 - 动态生成backtest列
    ...backtestResults.map((_, index) => buildBacktestColumn(index, 'parameter')),
  ];

  // 性能指标对比表格列定义 - 动态列（有Winner列）
  const metricColumns: ColumnsType<MetricData> = [
    {
      title: (
        <CellContainer align="left" header>
          <span style={{ fontWeight: 600, fontSize: '12px' }}>
            Performance Metric
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

  // 计算summary数据
  const getUniqueValues = (arr: (string | undefined)[]): string[] => {
    const unique = new Set<string>();
    arr.forEach(item => {
      if (item) unique.add(item);
    });
    return Array.from(unique);
  };

  const summaryData = {
    comparedBacktests: backtestResults.length,
    symbolsCompared: getUniqueValues(backtestResults.map(b => b?.parameters?.symbol)).join(', ') || 'N/A',
    strategiesCompared: getUniqueValues(backtestResults.map(b => b?.parameters?.strategy)).join(', ') || 'N/A',
    bestReturn: backtestResults.length > 0 
      ? Math.max(...backtestResults.map(b => b?.results?.totalReturn || -Infinity))
      : 0,
    lowestDrawdown: backtestResults.length > 0 
      ? Math.min(...backtestResults.map(b => b?.results?.maxDrawdown || Infinity))
      : 0,
    bestSharpe: backtestResults.length > 0 
      ? Math.max(...backtestResults.map(b => b?.results?.sharpeRatio || -Infinity))
      : 0,
  };

  // 准备关键指标条形图数据
  const prepareBarChartData = () => {
    if (backtestResults.length === 0) return [];

    const metrics = [
      { key: 'totalReturn', name: 'Total Return', unit: '%', format: (v: number) => `${v.toFixed(2)}%`, higherIsBetter: true },
      { key: 'sharpeRatio', name: 'Sharpe Ratio', unit: '', format: (v: number) => v.toFixed(2), higherIsBetter: true },
      { key: 'maxDrawdown', name: 'Max Drawdown', unit: '%', format: (v: number) => `${v.toFixed(2)}%`, higherIsBetter: false },
      { key: 'winRate', name: 'Win Rate', unit: '%', format: (v: number) => `${v.toFixed(1)}%`, higherIsBetter: true },
    ];

    return metrics.map(metric => {
      const dataPoint: any = { metric: metric.name };
      
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
        name: `Backtest ${index + 1}`,
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
    
    // 按排序后的日期创建数据点，但equity取值顺序需要反向以保持曲线形状
    console.log('=== 修复：保持日期正序，但equity取值反向以匹配原始曲线 ===');
    console.log('sortedDates长度:', sortedDates.length);
    
    for (let i = 0; i < sortedDates.length; i++) {
      const date = sortedDates[i];
      
      const dataPoint: any = { 
        index: i,
        date: date
      };
      
      backtestResults.forEach((backtest, backtestIndex) => {
        const equityMap = dateToEquityMaps[backtestIndex];
        
        // 关键修复：为了保持原始曲线形状，我们需要反向获取equity值
        // 如果日期是正序排列的，那么equity应该从后往前取
        // 这样左边最早的日期对应原始数组最后的equity值
        // 右边最晚的日期对应原始数组第一个equity值
        // 这保持了原始图表（索引X轴）显示的曲线形状
        
        // 计算反向索引：从最后一个日期开始
        const reverseIndex = sortedDates.length - 1 - i;
        const reverseDate = sortedDates[reverseIndex];
        
        // 使用反向日期获取equity值
        dataPoint[`backtest${backtestIndex + 1}`] = equityMap.get(reverseDate) || null;
        // 保存实际显示的日期（正序）
        dataPoint[`date${backtestIndex + 1}`] = date;
      });
      
      result.push(dataPoint);
    }
    
    // 调试：验证修复后的数据
    if (result.length > 0) {
      console.log('=== 修复后验证 ===');
      console.log('第一个点（图表最左边）:');
      console.log('  date:', result[0].date, '应该是最早日期');
      console.log('  backtest1:', result[0].backtest1, '应该是原始数组最后一个equity值');
      
      console.log('最后一个点（图表最右边）:');
      console.log('  date:', result[result.length - 1].date, '应该是最晚日期');
      console.log('  backtest1:', result[result.length - 1].backtest1, '应该是原始数组第一个equity值');
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
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ 
          fontSize: '28px', 
          fontWeight: 700, 
          color: '#1f1f1f',
          marginBottom: '8px',
          letterSpacing: '-0.5px'
        }}>
          Strategy Comparison
        </h1>
        <p style={{ 
          fontSize: '16px', 
          color: '#595959',
          margin: 0,
          marginBottom: '24px',
          fontWeight: 400,
          lineHeight: 1.5
        }}>
          Compare performance metrics and parameters across multiple backtests
        </p>
        
        {/* Summary Cards */}
        <div style={{
          display: 'flex',
          gap: '20px',
          marginBottom: '32px',
          flexWrap: 'wrap'
        }}>
          <SummaryCard 
            title="Compared Backtests" 
            value={summaryData.comparedBacktests}
            color="#1f1f1f"
          />
          <SummaryCard 
            title="Symbols Compared" 
            value={summaryData.symbolsCompared}
            color="#1f1f1f"
          />
          <SummaryCard 
            title="Strategies Compared" 
            value={summaryData.strategiesCompared}
            color="#1f1f1f"
          />
          <SummaryCard 
            title="Best Return" 
            value={summaryData.bestReturn !== -Infinity ? `${summaryData.bestReturn.toFixed(2)}%` : 'N/A'}
            color={summaryData.bestReturn > 0 ? '#389e0d' : summaryData.bestReturn < 0 ? '#cf1322' : '#595959'}
            unit=""
          />
          <SummaryCard 
            title="Lowest Drawdown" 
            value={summaryData.lowestDrawdown !== Infinity ? `${summaryData.lowestDrawdown.toFixed(2)}%` : 'N/A'}
            color="#cf1322"
            unit=""
          />
          <SummaryCard 
            title="Best Sharpe" 
            value={summaryData.bestSharpe !== -Infinity ? summaryData.bestSharpe.toFixed(2) : 'N/A'}
            color={summaryData.bestSharpe > 1 ? '#389e0d' : summaryData.bestSharpe > 0 ? '#d46b08' : '#cf1322'}
            unit=""
          />
        </div>

        {/* 关键指标对比条形图 */}
        {backtestResults.length > 0 && barChartData.length > 0 && (
          <Card 
            title={
              <div style={{ fontSize: '18px', fontWeight: 700, color: '#1f1f1f' }}>
                Key Metrics Comparison
              </div>
            }
            style={{ 
              marginBottom: '24px',
              borderRadius: '12px',
              border: '1px solid #e8e8e8',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)'
            }}
            bodyStyle={{ padding: '20px' }}
          >
            <div style={{ fontSize: '14px', color: '#595959', marginBottom: '16px', lineHeight: 1.5 }}>
              Compare core performance metrics across all backtests. Higher bars indicate better performance for Return, Sharpe, and Win Rate; lower bars indicate better performance for Drawdown.
            </div>
            <div style={{ height: '400px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={barChartData}
                  margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis 
                    dataKey="metric" 
                    tick={{ fontSize: 12, fill: '#595959' }}
                    axisLine={{ stroke: '#d9d9d9' }}
                    tickLine={{ stroke: '#d9d9d9' }}
                  />
                  <YAxis 
                    tick={{ fontSize: 12, fill: '#595959' }}
                    axisLine={{ stroke: '#d9d9d9' }}
                    tickLine={{ stroke: '#d9d9d9' }}
                  />
                  <Tooltip 
                    formatter={(value: number, name: string) => {
                      const backtestIndex = name.replace('backtest', '');
                      const formattedValue = barChartData.find(d => d.metric === name) ? 
                        barChartData.find(d => d.metric === name)?.[`backtest${backtestIndex}Formatted`] : 
                        `${value}`;
                      return [formattedValue, `Backtest ${backtestIndex}`];
                    }}
                    labelFormatter={(label) => `${label}`}
                    contentStyle={{ 
                      backgroundColor: 'white', 
                      border: '1px solid #d9d9d9',
                      borderRadius: '6px',
                      fontSize: '12px'
                    }}
                  />
                  <Legend 
                    wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}
                    formatter={(value) => {
                      const index = parseInt(value.replace('backtest', '')) - 1;
                      const backtest = backtestResults[index];
                      return backtest ? 
                        `Backtest ${index + 1}: ${backtest.parameters.symbol} • ${backtest.parameters.strategy}` : 
                        value;
                    }}
                  />
                  {backtestResults.map((_, index) => (
                    <Bar 
                      key={`backtest${index + 1}`}
                      dataKey={`backtest${index + 1}`}
                      name={`backtest${index + 1}`}
                      fill={BACKTEST_COLORS[index % BACKTEST_COLORS.length].primary}
                      radius={[2, 2, 0, 0]}
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
                Risk vs Return Analysis
              </div>
            }
            style={{ 
              marginBottom: '24px',
              borderRadius: '12px',
              border: '1px solid #e8e8e8',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)'
            }}
            bodyStyle={{ padding: '20px' }}
          >
            <div style={{ fontSize: '14px', color: '#595959', marginBottom: '16px', lineHeight: 1.5 }}>
              Each point represents a backtest. Points in the top-left quadrant indicate high return with low risk (ideal). Bubble size represents number of trades.
            </div>
            <div style={{ height: '400px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart
                  margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis 
                    type="number" 
                    dataKey="maxDrawdown" 
                    name="Max Drawdown" 
                    unit="%" 
                    tick={{ fontSize: 12, fill: '#595959' }}
                    axisLine={{ stroke: '#d9d9d9' }}
                    tickLine={{ stroke: '#d9d9d9' }}
                    label={{ value: 'Max Drawdown (%)', position: 'insideBottom', offset: -5, fontSize: 12, fill: '#595959' }}
                  />
                  <YAxis 
                    type="number" 
                    dataKey="totalReturn" 
                    name="Total Return" 
                    unit="%" 
                    tick={{ fontSize: 12, fill: '#595959' }}
                    axisLine={{ stroke: '#d9d9d9' }}
                    tickLine={{ stroke: '#d9d9d9' }}
                    label={{ value: 'Total Return (%)', angle: -90, position: 'insideLeft', fontSize: 12, fill: '#595959' }}
                  />
                  <ZAxis type="number" dataKey="trades" range={[50, 400]} />
                  <Tooltip 
                    formatter={(value: number, name: string) => {
                      if (name === 'totalReturn') return [`${value.toFixed(2)}%`, 'Total Return'];
                      if (name === 'maxDrawdown') return [`${value.toFixed(2)}%`, 'Max Drawdown'];
                      if (name === 'sharpeRatio') return [value.toFixed(2), 'Sharpe Ratio'];
                      if (name === 'trades') return [value, 'Trades'];
                      return [value, name];
                    }}
                    labelFormatter={(label, payload) => {
                      if (payload && payload.length > 0) {
                        return payload[0].payload.label;
                      }
                      return label;
                    }}
                    contentStyle={{ 
                      backgroundColor: 'white', 
                      border: '1px solid #d9d9d9',
                      borderRadius: '6px',
                      fontSize: '12px'
                    }}
                  />
                  <Legend 
                    wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}
                  />
                  <Scatter 
                    name="Backtests" 
                    data={scatterChartData} 
                    fill="#8884d8"
                    shape="circle"
                  >
                    {scatterChartData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={entry.color}
                        stroke={entry.color}
                        strokeWidth={1}
                      />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}

        {/* 资金曲线对比图 */}
        {backtestResults.length > 0 && equityCurveData.length > 0 && (
          <Card 
            title={
              <div style={{ fontSize: '18px', fontWeight: 700, color: '#1f1f1f' }}>
                Equity Curve Comparison
              </div>
            }
            style={{ 
              marginBottom: '24px',
              borderRadius: '12px',
              border: '1px solid #e8e8e8',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)'
            }}
            bodyStyle={{ padding: '20px' }}
          >
            <div style={{ fontSize: '14px', color: '#595959', marginBottom: '16px', lineHeight: 1.5 }}>
              Compare equity growth over time across all backtests. All curves are normalized to start at 100 for fair comparison.
            </div>
            <div style={{ height: '400px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={equityCurveData}
                  margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 12, fill: '#595959' }}
                    axisLine={{ stroke: '#d9d9d9' }}
                    tickLine={{ stroke: '#d9d9d9' }}
                    label={{ value: 'Date', position: 'insideBottom', offset: -5, fontSize: 12, fill: '#595959' }}
                  />
                  <YAxis 
                    tick={{ fontSize: 12, fill: '#595959' }}
                    axisLine={{ stroke: '#d9d9d9' }}
                    tickLine={{ stroke: '#d9d9d9' }}
                    label={{ value: 'Equity (Normalized)', angle: -90, position: 'insideLeft', fontSize: 12, fill: '#595959' }}
                  />
                  <Tooltip 
                    formatter={(value: number, name: string) => {
                      if (name === 'benchmark') {
                        return [`$${value.toFixed(2)}`, 'Benchmark (Buy & Hold)'];
                      }
                      const backtestIndex = name.replace('backtest', '');
                      return [`$${value.toFixed(2)}`, `Backtest ${backtestIndex}`];
                    }}
                    labelFormatter={(label) => {
                      return `Date: ${label}`;
                    }}
                    contentStyle={{ 
                      backgroundColor: 'white', 
                      border: '1px solid #d9d9d9',
                      borderRadius: '6px',
                      fontSize: '12px'
                    }}
                  />
                  <Legend 
                    wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}
                    formatter={(value) => {
                      if (value === 'benchmark') {
                        return 'Benchmark (Buy & Hold)';
                      }
                      const index = parseInt(value.replace('backtest', '')) - 1;
                      const backtest = backtestResults[index];
                      return backtest ? 
                        `Backtest ${index + 1}: ${backtest.parameters.symbol} • ${backtest.parameters.strategy}` : 
                        value;
                    }}
                  />
                  {backtestResults.map((_, index) => (
                    <Line 
                      key={`backtest${index + 1}`}
                      type="monotone"
                      dataKey={`backtest${index + 1}`}
                      name={`backtest${index + 1}`}
                      stroke={BACKTEST_COLORS[index % BACKTEST_COLORS.length].primary}
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 6 }}
                      connectNulls
                    />
                  ))}
                  {/* Benchmark (Buy & Hold) 曲线 */}
                  <Line 
                    type="monotone"
                    dataKey="benchmark"
                    stroke="#999999"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={false}
                    name="Benchmark (Buy & Hold)"
                    activeDot={{ r: 6 }}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}
      </div>
      
      {/* 参数对比表格 - 4列 */}
      <Card 
        title={
          <div style={{ fontSize: '18px', fontWeight: 700, color: '#1f1f1f' }}>
            Parameter Comparison
          </div>
        }
        extra={
          <div style={{ 
            fontSize: '13px', 
            color: '#595959',
            fontWeight: 500
          }}>
            {backtestResults.length} backtest{backtestResults.length !== 1 ? 's' : ''} compared
          </div>
        }
        style={{ 
          marginBottom: '24px',
          borderRadius: '12px',
          border: '1px solid #e8e8e8',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)'
        }}
        bodyStyle={{ padding: '20px' }}
      >
        <Table<ParameterData>
          columns={parameterColumns}
          dataSource={parameterData}
          pagination={false}
          size="middle"
          bordered={false}
          tableLayout="fixed"
          scroll={{ x: LABEL_COL_WIDTH + (BACKTEST_COL_WIDTH * backtestResults.length) }}
          rowClassName={(record, index) => index % 2 === 0 ? "parameter-row-even" : "parameter-row-odd"}
          style={{ fontSize: "14px" }}
        />
      </Card>

      {/* 性能指标对比表格 - 4列 */}
      <Card 
        title={
          <div style={{ fontSize: '18px', fontWeight: 700, color: '#1f1f1f' }}>
            Performance Metrics Comparison
          </div>
        }
        extra={
          <div style={{ 
            display: 'flex',
            alignItems: 'center',
            gap: '20px',
            fontSize: '13px',
            color: '#404040',
            fontWeight: 600
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#389e0d' }}></div>
              <span>Positive</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#cf1322' }}></div>
              <span>Negative</span>
            </div>
          </div>
        }
        style={{ 
          marginBottom: '24px',
          borderRadius: '12px',
          border: '1px solid #e8e8e8',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)'
        }}
        bodyStyle={{ padding: '20px' }}
      >
        <Table<MetricData>
          columns={metricColumns}
          dataSource={metricData}
          pagination={false}
          size="middle"
          bordered={false}
          tableLayout="fixed"
          scroll={{ x: tableWidth }}
          rowClassName={(record, index) => index % 2 === 0 ? "metric-row-even" : "metric-row-odd"}
          style={{ fontSize: "14px" }}
        />
        <div style={{ 
          marginTop: '16px', 
          fontSize: '13px', 
          color: '#595959',
          padding: '12px 16px',
          backgroundColor: '#fafafa',
          borderRadius: '8px',
          border: '1px solid #e8e8e8'
        }}>
          <div style={{ fontWeight: 700, marginBottom: '10px', color: '#1f1f1f', fontSize: '14px' }}>Interpretation Guide:</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', lineHeight: 1.6 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#389e0d', marginTop: '3px', flexShrink: 0 }}></div>
              <span><strong>Higher is better:</strong> Return, Sharpe, Sortino, Calmar, Win Rate, Profit Factor, Expectancy</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#cf1322', marginTop: '3px', flexShrink: 0 }}></div>
              <span><strong>Lower is better:</strong> Drawdown, Volatility</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#8c8c8c', marginTop: '3px', flexShrink: 0 }}></div>
              <span><strong>Neutral:</strong> Trades, Exposure (depends on strategy)</span>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default StrategyComparison;