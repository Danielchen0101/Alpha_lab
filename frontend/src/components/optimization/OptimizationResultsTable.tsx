import React from 'react';
import { Table, Tag, Typography } from 'antd';
import { TrophyOutlined, CrownOutlined } from '@ant-design/icons';
import { OptimizationResult } from './OptimizationHeatmap';
import { useLanguage } from '../../contexts/LanguageContext';

const { Text } = Typography;

interface OptimizationResultsTableProps {
  results: OptimizationResult[];
  strategy?: string;
}

const OptimizationResultsTable: React.FC<OptimizationResultsTableProps> = ({ results, strategy = 'moving_average' }) => {
  const { t } = useLanguage();
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
          { title: t.optimization.labelRsiPeriod, dataIndex: 'rsi_period', key: 'rsi_period', width: 110, align: 'center', render: (v: number) => <Tag color="blue" style={commonStyle}>{v}</Tag> },
          { title: t.optimization.labelOversold, dataIndex: 'oversold', key: 'oversold', width: 100, align: 'center', render: (v: number) => <Tag color="orange" style={commonStyle}>{v}</Tag> },
          { title: t.optimization.labelOverbought, dataIndex: 'overbought', key: 'overbought', width: 110, align: 'center', render: (v: number) => <Tag color="red" style={commonStyle}>{v}</Tag> }
        ];
      case 'macd':
        return [
          { title: t.optimization.labelFastMa, dataIndex: 'fast', key: 'fast', width: 100, align: 'center', render: (v: number) => <Tag color="blue" style={commonStyle}>{v}</Tag> },
          { title: t.optimization.labelSlowMa, dataIndex: 'slow', key: 'slow', width: 100, align: 'center', render: (v: number) => <Tag color="green" style={commonStyle}>{v}</Tag> },
          { title: t.optimization.labelSignalMa, dataIndex: 'signal', key: 'signal', width: 90, align: 'center', render: (v: number) => <Tag color="purple" style={commonStyle}>{v}</Tag> }
        ];
      case 'bollinger':
        return [
          { title: t.optimization.labelPeriod, dataIndex: 'period', key: 'period', width: 90, align: 'center', render: (v: number) => <Tag color="blue" style={commonStyle}>{v}</Tag> },
          { title: t.optimization.labelStdDev, dataIndex: 'std_dev', key: 'std_dev', width: 90, align: 'center', render: (v: number) => <Tag color="cyan" style={commonStyle}>{safeToFixed(v, 1)}</Tag> }
        ];
      case 'momentum':
        return [
          { title: t.optimization.labelMomentumPeriod, dataIndex: 'momentum_period', key: 'momentum_period', width: 130, align: 'center', render: (v: number) => <Tag color="blue" style={commonStyle}>{v}</Tag> }
        ];
      default:
        return [
          { title: t.optimization.labelShortMa, dataIndex: 'short_ma', key: 'short_ma', width: 100, align: 'center', render: (v: number) => <Tag color="blue" style={commonStyle}>{v}</Tag> },
          { title: t.optimization.labelLongMa, dataIndex: 'long_ma', key: 'long_ma', width: 100, align: 'center', render: (v: number) => <Tag color="green" style={commonStyle}>{v}</Tag> }
        ];
    }
  };

  const columns: any[] = [
    {
      title: t.optimization.colRank,
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
      title: t.optimization.colTotalReturn,
      dataIndex: 'totalReturn',
      key: 'totalReturn',
      width: 140,
      align: 'right',
      sorter: (a: OptimizationResult, b: OptimizationResult) => a.totalReturn - b.totalReturn,
      render: (v: number) => <Text strong style={{ color: v >= 0 ? '#3f8600' : '#cf1322', fontSize: '14px' }}>{safePercent(v)}</Text>,
    },
    {
      title: t.optimization.colSharpe,
      dataIndex: 'sharpeRatio',
      key: 'sharpeRatio',
      width: 100,
      align: 'right',
      sorter: (a: OptimizationResult, b: OptimizationResult) => a.sharpeRatio - b.sharpeRatio,
      render: (v: number) => <Text strong style={{ color: v >= 1 ? '#3f8600' : v >= 0 ? '#fa8c16' : '#cf1322' }}>{safeToFixed(v, 2)}</Text>,
    },
    {
      title: t.optimization.colMaxDD,
      dataIndex: 'maxDrawdown',
      key: 'maxDrawdown',
      width: 110,
      align: 'right',
      sorter: (a: OptimizationResult, b: OptimizationResult) => a.maxDrawdown - b.maxDrawdown,
      render: (v: number) => <Text strong style={{ color: v > -15 ? '#3f8600' : v > -30 ? '#fa8c16' : '#cf1322' }}>{safeToFixed(v, 1)}%</Text>,
    },
    {
      title: t.optimization.colWinRate,
      dataIndex: 'winRate',
      key: 'winRate',
      width: 110,
      align: 'right',
      sorter: (a: OptimizationResult, b: OptimizationResult) => (a.winRate || 0) - (b.winRate || 0),
      render: (v: number) => <Text strong>{v ? `${v.toFixed(1)}%` : '—'}</Text>,
    },
    {
      title: t.optimization.colTrades,
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
        .optimization-table-container .ant-table {
          background: transparent !important;
        }
        .optimization-table-container .ant-table-thead > tr > th { 
          background: var(--app-table-header-bg) !important; 
          font-weight: 800 !important; 
          text-transform: uppercase !important; 
          font-size: 10.5px !important; 
          letter-spacing: 0.8px !important; 
          color: var(--app-text-muted) !important; 
          border-bottom: 1px solid var(--app-border-soft) !important;
          padding: 16px 8px !important;
        }
        .optimization-table-container .ant-table-tbody > tr > td {
          padding: 14px 8px !important;
          border-bottom: 1px solid var(--app-border-soft) !important;
          color: var(--app-text) !important;
        }
        .optimization-table-container .ant-table-tbody > tr:hover > td { 
          background: var(--app-card-bg-soft) !important; 
        }
        .top-rank-row { 
          background: rgba(250, 173, 20, 0.02); 
        }
        .top-rank-row td { 
          border-bottom: 1px solid rgba(250, 173, 20, 0.1) !important; 
        }
        .optimization-table-container .ant-pagination {
          padding: 16px 24px !important;
          margin: 0 !important;
          border-top: 1px solid var(--app-border-soft);
        }
      `}</style>
      <Table
        columns={columns}
        dataSource={results}
        rowKey={(r, i) => `${r.rank}-${i}`}
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
          showTotal: (total: number, range: [number, number]) => (
            <Text style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600 }}>
              {t.optimization.resultsRange.replace('{from}', String(range[0])).replace('{to}', String(range[1])).replace('{total}', String(total)).toUpperCase()}
            </Text>
          ),
        }}
        size="small"
        scroll={{ x: 1000 }}
        rowClassName={(record: OptimizationResult) => record.rank === 1 ? 'top-rank-row' : ''}
      />
    </div>
  );
};

export default OptimizationResultsTable;
