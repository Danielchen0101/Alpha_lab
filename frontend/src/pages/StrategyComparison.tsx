import React, { useState, useEffect } from "react";
import { Card, Table, Tag, Empty, Spin, Alert } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useLocation } from "react-router-dom";
import { backtraderAPI } from "../services/api";

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