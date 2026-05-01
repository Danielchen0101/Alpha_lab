import React from 'react';
import { Table, Tag, Typography } from 'antd';
import { TrophyOutlined, CrownOutlined } from '@ant-design/icons';
import { OptimizationResult } from './OptimizationHeatmap';

const { Text } = Typography;

interface OptimizationResultsTableProps {
  results: OptimizationResult[];
  strategy?: string;
}

const OptimizationResultsTable: React.FC<OptimizationResultsTableProps> = ({ results, strategy = 'moving_average' }) => {
  // Safe formatting functions
  const safeToFixed = (value: any, digits: number = 2): string => {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return 'N/A';
    return Number(value).toFixed(digits);
  };

  const safePercent = (value: any): string => {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return "N/A";
    const prefix = value > 0 ? "+" : "";
    return `${prefix}${value.toFixed(2)}%`;
  };

  // Get parameter columns based on strategy
  const getParameterColumns = () => {
    const commonStyle = { fontWeight: 700, borderRadius: '4px' };
    switch (strategy) {
      case 'rsi':
        return [
          { title: 'RSI Period', dataIndex: 'rsi_period', key: 'rsi_period', width: 110, align: 'center', render: (v: number) => <Tag color="blue" style={commonStyle}>{v}</Tag> },
          { title: 'Oversold', dataIndex: 'oversold', key: 'oversold', width: 100, align: 'center', render: (v: number) => <Tag color="orange" style={commonStyle}>{v}</Tag> },
          { title: 'Overbought', dataIndex: 'overbought', key: 'overbought', width: 110, align: 'center', render: (v: number) => <Tag color="red" style={commonStyle}>{v}</Tag> }
        ];
      case 'macd':
        return [
          { title: 'Fast EMA', dataIndex: 'fast', key: 'fast', width: 100, align: 'center', render: (v: number) => <Tag color="blue" style={commonStyle}>{v}</Tag> },
          { title: 'Slow EMA', dataIndex: 'slow', key: 'slow', width: 100, align: 'center', render: (v: number) => <Tag color="green" style={commonStyle}>{v}</Tag> },
          { title: 'Signal', dataIndex: 'signal', key: 'signal', width: 90, align: 'center', render: (v: number) => <Tag color="purple" style={commonStyle}>{v}</Tag> }
        ];
      case 'bollinger':
        return [
          { title: 'Period', dataIndex: 'period', key: 'period', width: 90, align: 'center', render: (v: number) => <Tag color="blue" style={commonStyle}>{v}</Tag> },
          { title: 'Std Dev', dataIndex: 'std_dev', key: 'std_dev', width: 90, align: 'center', render: (v: number) => <Tag color="cyan" style={commonStyle}>{safeToFixed(v, 1)}</Tag> }
        ];
      case 'momentum':
        return [
          { title: 'Period', dataIndex: 'momentum_period', key: 'momentum_period', width: 130, align: 'center', render: (v: number) => <Tag color="blue" style={commonStyle}>{v}</Tag> }
        ];
      default:
        return [
          { title: 'Short MA', dataIndex: 'short_ma', key: 'short_ma', width: 100, align: 'center', render: (v: number) => <Tag color="blue" style={commonStyle}>{v}</Tag> },
          { title: 'Long MA', dataIndex: 'long_ma', key: 'long_ma', width: 100, align: 'center', render: (v: number) => <Tag color="green" style={commonStyle}>{v}</Tag> }
        ];
    }
  };

  const columns: any[] = [
    {
      title: 'Rank',
      dataIndex: 'rank',
      key: 'rank',
      width: 90,
      align: 'center',
      sorter: (a: OptimizationResult, b: OptimizationResult) => a.rank - b.rank,
      render: (rank: number) => (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
          {rank === 1 ? <CrownOutlined style={{ color: '#faad14' }} /> : rank <= 3 ? <TrophyOutlined style={{ color: rank === 2 ? '#bfbfbf' : '#d48011', fontSize: '12px' }} /> : null}
          <Text strong style={{ fontSize: rank === 1 ? '16px' : '14px', color: rank === 1 ? '#faad14' : '#595959' }}>{rank}</Text>
        </div>
      ),
    },
    ...getParameterColumns(),
    {
      title: 'Total Return',
      dataIndex: 'totalReturn',
      key: 'totalReturn',
      width: 140,
      align: 'right',
      sorter: (a: OptimizationResult, b: OptimizationResult) => a.totalReturn - b.totalReturn,
      render: (v: number) => <Text strong style={{ color: v >= 0 ? '#3f8600' : '#cf1322', fontSize: '14px' }}>{safePercent(v)}</Text>,
    },
    {
      title: 'Sharpe',
      dataIndex: 'sharpeRatio',
      key: 'sharpeRatio',
      width: 100,
      align: 'right',
      sorter: (a: OptimizationResult, b: OptimizationResult) => a.sharpeRatio - b.sharpeRatio,
      render: (v: number) => <Text strong style={{ color: v >= 1 ? '#3f8600' : v >= 0 ? '#fa8c16' : '#cf1322' }}>{safeToFixed(v, 2)}</Text>,
    },
    {
      title: 'Max DD',
      dataIndex: 'maxDrawdown',
      key: 'maxDrawdown',
      width: 110,
      align: 'right',
      sorter: (a: OptimizationResult, b: OptimizationResult) => a.maxDrawdown - b.maxDrawdown,
      render: (v: number) => <Text strong style={{ color: v > -15 ? '#3f8600' : v > -30 ? '#fa8c16' : '#cf1322' }}>{safeToFixed(v, 1)}%</Text>,
    },
    {
      title: 'Win Rate',
      dataIndex: 'winRate',
      key: 'winRate',
      width: 110,
      align: 'right',
      sorter: (a: OptimizationResult, b: OptimizationResult) => (a.winRate || 0) - (b.winRate || 0),
      render: (v: number) => <Text strong>{v ? `${v.toFixed(1)}%` : '—'}</Text>,
    },
    {
      title: 'Trades',
      dataIndex: 'trades',
      key: 'trades',
      width: 100,
      align: 'right',
      sorter: (a: OptimizationResult, b: OptimizationResult) => a.trades - b.trades,
      render: (v: number) => <Text style={{ color: '#8c8c8c' }}>{Math.round(v)}</Text>,
    },
  ];

  return (
    <div className="optimization-table-container">
      <style>{`
        .optimization-table-container .ant-table-thead > tr > th { background: #fafafa; font-weight: 700; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px; color: #8c8c8c; border-bottom: 2px solid #f0f0f0; }
        .optimization-table-container .ant-table-tbody > tr:hover > td { background: #f0f7ff !important; }
        .top-rank-row { background: #fffdf6; }
        .top-rank-row td { border-bottom: 1px solid #fff1b8 !important; }
      `}</style>
      <Table
        columns={columns}
        dataSource={results}
        rowKey={(r, i) => `${r.rank}-${i}`}
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
          showTotal: (total: number, range: [number, number]) => <Text type="secondary" style={{ fontSize: '12px' }}>{range[0]}-{range[1]} of {total} results</Text>,
          style: { marginTop: '20px' }
        }}
        size="middle"
        scroll={{ x: 1000 }}
        rowClassName={(record: OptimizationResult) => record.rank === 1 ? 'top-rank-row' : ''}
        style={{ background: '#fff' }}
      />
    </div>
  );
};

export default OptimizationResultsTable;
