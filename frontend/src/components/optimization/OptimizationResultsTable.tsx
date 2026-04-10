import React from 'react';
import { Table, Tag } from 'antd';
import { OptimizationResult } from './OptimizationHeatmap';

interface OptimizationResultsTableProps {
  results: OptimizationResult[];
  strategy?: string;
}

const OptimizationResultsTable: React.FC<OptimizationResultsTableProps> = ({ results, strategy = 'moving_average' }) => {
  // Safe formatting functions
  const safeToFixed = (value: any, digits: number = 2): string => {
    if (value === null || value === undefined || Number.isNaN(Number(value))) {
      return 'N/A';
    }
    return Number(value).toFixed(digits);
  };

  const safePercent = (value: any): string => {
    if (value === null || value === undefined || Number.isNaN(Number(value))) {
      return "N/A";
    }
    if (value === 0) return "0.00%";
    const sign = value > 0 ? "+" : "-";
    return `${sign}${Math.abs(value).toFixed(2)}%`;
  };

  // Helper function to format percentages (deprecated, use safePercent instead)
  const formatPercent = (value: number): string => {
  if (value === undefined || value === null || isNaN(value)) {
    return "N/A";
  }
  if (value === 0) return "0.00%";
  const sign = value > 0 ? "+" : "-";
  return `${sign}${Math.abs(value).toFixed(2)}%`;
};

  // Get parameter columns based on strategy
  const getParameterColumns = () => {
    switch (strategy) {
      case 'rsi':
        return [
          {
            title: 'RSI Period',
            dataIndex: 'rsi_period',
            key: 'rsi_period',
            width: 90,
            render: (value: number) => (
              <Tag color="blue" style={{ fontWeight: 'bold' }}>
                {value}
              </Tag>
            ),
          },
          {
            title: 'Oversold',
            dataIndex: 'oversold',
            key: 'oversold',
            width: 90,
            render: (value: number) => (
              <Tag color="orange" style={{ fontWeight: 'bold' }}>
                {value}
              </Tag>
            ),
          },
          {
            title: 'Overbought',
            dataIndex: 'overbought',
            key: 'overbought',
            width: 90,
            render: (value: number) => (
              <Tag color="red" style={{ fontWeight: 'bold' }}>
                {value}
              </Tag>
            ),
          },
        ];
      case 'macd':
        return [
          {
            title: 'Fast MA',
            dataIndex: 'fast',
            key: 'fast',
            width: 90,
            render: (value: number) => (
              <Tag color="blue" style={{ fontWeight: 'bold' }}>
                {value}
              </Tag>
            ),
          },
          {
            title: 'Slow MA',
            dataIndex: 'slow',
            key: 'slow',
            width: 90,
            render: (value: number) => (
              <Tag color="green" style={{ fontWeight: 'bold' }}>
                {value}
              </Tag>
            ),
          },
          {
            title: 'Signal MA',
            dataIndex: 'signal',
            key: 'signal',
            width: 90,
            render: (value: number) => (
              <Tag color="purple" style={{ fontWeight: 'bold' }}>
                {value}
              </Tag>
            ),
          },
        ];
      case 'bollinger':
        return [
          {
            title: 'Period',
            dataIndex: 'period',
            key: 'period',
            width: 90,
            render: (value: number) => (
              <Tag color="blue" style={{ fontWeight: 'bold' }}>
                {value}
              </Tag>
            ),
          },
          {
            title: 'Std Dev',
            dataIndex: 'std_dev',
            key: 'std_dev',
            width: 90,
            render: (value: number) => (
              <Tag color="cyan" style={{ fontWeight: 'bold' }}>
                {safeToFixed(value, 1)}
              </Tag>
            ),
          },
        ];
      case 'momentum':
        return [
          {
            title: 'Momentum Period',
            dataIndex: 'momentum_period',
            key: 'momentum_period',
            width: 110,
            render: (value: number) => (
              <Tag color="blue" style={{ fontWeight: 'bold' }}>
                {value}
              </Tag>
            ),
          },
        ];
      default: // moving_average
        return [
          {
            title: 'Short MA',
            dataIndex: 'short_ma',
            key: 'short_ma',
            width: 90,
            render: (value: number) => (
              <Tag color="blue" style={{ fontWeight: 'bold' }}>
                {value}
              </Tag>
            ),
          },
          {
            title: 'Long MA',
            dataIndex: 'long_ma',
            key: 'long_ma',
            width: 90,
            render: (value: number) => (
              <Tag color="green" style={{ fontWeight: 'bold' }}>
                {value}
              </Tag>
            ),
          },
        ];
    }
  };

  const columns = [
    {
      title: 'Rank',
      dataIndex: 'rank',
      key: 'rank',
      width: 80,
      render: (rank: number) => (
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          fontWeight: 'bold',
          fontSize: rank === 1 ? '16px' : '14px',
          color: rank === 1 ? '#ffd700' : rank === 2 ? '#c0c0c0' : rank === 3 ? '#cd7f32' : '#666'
        }}>
          {rank}
        </div>
      ),
    },
    ...getParameterColumns(),
    {
      title: 'Total Return',
      dataIndex: 'totalReturn',
      key: 'totalReturn',
      width: 120,
      defaultSortOrder: 'descend' as const,
      sorter: (a: OptimizationResult, b: OptimizationResult) => a.totalReturn - b.totalReturn,
      render: (value: number) => {
        const color = value >= 0 ? '#3f8600' : '#cf1322';
        return (
          <span style={{ color, fontWeight: 'bold', fontSize: '14px' }}>
            {formatPercent(value)}
          </span>
        );
      },
    },
    {
      title: 'Annualized',
      dataIndex: 'annualizedReturn',
      key: 'annualizedReturn',
      width: 120,
      sorter: (a: OptimizationResult, b: OptimizationResult) => a.annualizedReturn - b.annualizedReturn,
      render: (value: number) => {
        const color = value >= 0 ? '#3f8600' : '#cf1322';
        return (
          <span style={{ color, fontWeight: 'bold' }}>
            {formatPercent(value)}
          </span>
        );
      },
    },
    {
      title: 'Sharpe',
      dataIndex: 'sharpeRatio',
      key: 'sharpeRatio',
      width: 90,
      sorter: (a: OptimizationResult, b: OptimizationResult) => a.sharpeRatio - b.sharpeRatio,
      render: (value: number) => {
        const color = value >= 1 ? '#3f8600' : value >= 0 ? '#fa8c16' : '#cf1322';
        return (
          <span style={{ color, fontWeight: 'bold' }}>
            {safeToFixed(value, 2)}
          </span>
        );
      },
    },
    {
      title: 'Max DD',
      dataIndex: 'maxDrawdown',
      key: 'maxDrawdown',
      width: 90,
      sorter: (a: OptimizationResult, b: OptimizationResult) => a.maxDrawdown - b.maxDrawdown,
      render: (value: number) => {
        let color = '#cf1322'; // 默认红色
        if (value > -20) {
          color = '#3f8600'; // 绿色
        } else if (value >= -40) {
          color = '#fa8c16'; // 橙色
        }
        return (
          <span style={{ color, fontWeight: 'bold' }}>
            {safeToFixed(value, 1)}%
          </span>
        );
      },
    },
    {
      title: 'Trades',
      dataIndex: 'trades',
      key: 'trades',
      width: 80,
      sorter: (a: OptimizationResult, b: OptimizationResult) => a.trades - b.trades,
      render: (value: number) => (
        <span style={{ fontWeight: 'bold' }}>
          {Math.round(value)}
        </span>
      ),
    },
  ];

  return (
    <Table
      columns={columns}
      dataSource={results}
      pagination={{
        pageSize: 10,
        showSizeChanger: true,
        showQuickJumper: true,
        showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} combinations`,
        style: { marginBottom: 0 }
      }}
      size="middle"
      scroll={{ x: 800 }}
      bordered
      rowClassName={(record, index) => 
        index === 0 ? 'top-rank-row' : index === 1 ? 'second-rank-row' : index === 2 ? 'third-rank-row' : ''
      }
      style={{
        borderRadius: '8px',
        overflow: 'hidden'
      }}
    />
  );
};

export default OptimizationResultsTable;
