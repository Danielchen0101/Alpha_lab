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

const toFiniteNumber = (value: unknown): number | null => {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
};

const isSuccessfulResult = (result: OptimizationResult): boolean => {
  if (!result || result.error) return false;
  const status = String(result.status || '').toLowerCase();
  return !['failed', 'error', 'invalid'].includes(status);
};

const isRankableResult = (result: OptimizationResult): boolean => (
  isSuccessfulResult(result)
  && ['totalReturn', 'sharpeRatio', 'maxDrawdown'].every(
    (key) => toFiniteNumber(result[key]) !== null,
  )
);

const compareFinite = (left: unknown, right: unknown): number => {
  const leftValue = toFiniteNumber(left);
  const rightValue = toFiniteNumber(right);
  if (leftValue === null && rightValue === null) return 0;
  if (leftValue === null) return 1;
  if (rightValue === null) return -1;
  return leftValue - rightValue;
};

const compareFiniteMagnitude = (left: unknown, right: unknown): number => {
  const leftValue = toFiniteNumber(left);
  const rightValue = toFiniteNumber(right);
  if (leftValue === null && rightValue === null) return 0;
  if (leftValue === null) return 1;
  if (rightValue === null) return -1;
  return Math.abs(leftValue) - Math.abs(rightValue);
};

const OptimizationResultsTable: React.FC<OptimizationResultsTableProps> = ({ results, strategy = 'moving_average' }) => {
  const { t } = useLanguage();
  const safeToFixed = (value: unknown, digits: number = 2): string => {
    const numericValue = toFiniteNumber(value);
    return numericValue === null ? 'N/A' : numericValue.toFixed(digits);
  };

  const safePercent = (value: unknown): string => {
    const numericValue = toFiniteNumber(value);
    if (numericValue === null) return 'N/A';
    const prefix = numericValue > 0 ? '+' : '';
    return `${prefix}${numericValue.toFixed(2)}%`;
  };

  const safeDrawdown = (value: unknown, digits = 1): string => {
    const numericValue = toFiniteNumber(value);
    if (numericValue === null) return 'N/A';
    const magnitude = Math.abs(numericValue).toFixed(digits);
    return numericValue === 0 ? `${magnitude}%` : `-${magnitude}%`;
  };

  const renderParameter = (value: unknown, digits = 0) => safeToFixed(value, digits);

  const rankedResults = results
    .filter(isRankableResult)
    .slice()
    .sort((left, right) => compareFinite(right.sharpeRatio, left.sharpeRatio));
  const displayRanks = new Map<OptimizationResult, number>(
    rankedResults.map((result, index) => [result, index + 1]),
  );

  // Get parameter columns based on strategy
  const getParameterColumns = () => {
    const commonStyle = { fontWeight: 700, borderRadius: '4px' };
    switch (strategy) {
      case 'rsi':
        return [
          { title: t.optimization.labelRsiPeriod, dataIndex: 'rsi_period', key: 'rsi_period', width: 110, align: 'center', render: (v: unknown) => <Tag color="blue" style={commonStyle}>{renderParameter(v)}</Tag> },
          { title: t.optimization.labelOversold, dataIndex: 'oversold', key: 'oversold', width: 100, align: 'center', render: (v: unknown) => <Tag color="orange" style={commonStyle}>{renderParameter(v)}</Tag> },
          { title: t.optimization.labelOverbought, dataIndex: 'overbought', key: 'overbought', width: 110, align: 'center', render: (v: unknown) => <Tag color="red" style={commonStyle}>{renderParameter(v)}</Tag> }
        ];
      case 'macd':
        return [
          { title: t.optimization.labelFastMa, dataIndex: 'fast', key: 'fast', width: 100, align: 'center', render: (v: unknown) => <Tag color="blue" style={commonStyle}>{renderParameter(v)}</Tag> },
          { title: t.optimization.labelSlowMa, dataIndex: 'slow', key: 'slow', width: 100, align: 'center', render: (v: unknown) => <Tag color="green" style={commonStyle}>{renderParameter(v)}</Tag> },
          { title: t.optimization.labelSignalMa, dataIndex: 'signal', key: 'signal', width: 90, align: 'center', render: (v: unknown) => <Tag color="purple" style={commonStyle}>{renderParameter(v)}</Tag> }
        ];
      case 'bollinger':
        return [
          { title: t.optimization.labelPeriod, dataIndex: 'period', key: 'period', width: 90, align: 'center', render: (v: unknown) => <Tag color="blue" style={commonStyle}>{renderParameter(v)}</Tag> },
          { title: t.optimization.labelStdDev, dataIndex: 'std_dev', key: 'std_dev', width: 90, align: 'center', render: (v: unknown) => <Tag color="cyan" style={commonStyle}>{renderParameter(v, 1)}</Tag> }
        ];
      case 'momentum':
        return [
          { title: t.optimization.labelMomentumPeriod, dataIndex: 'momentum_period', key: 'momentum_period', width: 130, align: 'center', render: (v: unknown) => <Tag color="blue" style={commonStyle}>{renderParameter(v)}</Tag> }
        ];
      case 'mean_reversion':
        return [
          { title: t.optimization.lookbackBlock, dataIndex: 'lookback', key: 'lookback', width: 120, align: 'center', render: (v: unknown) => <Tag color="blue" style={commonStyle}>{renderParameter(v)}</Tag> },
          { title: t.optimization.entryZScoreBlock, dataIndex: 'entry_z', key: 'entry_z', width: 120, align: 'center', render: (v: unknown) => <Tag color="orange" style={commonStyle}>{renderParameter(v, 2)}</Tag> },
          { title: t.optimization.exitZScoreBlock, dataIndex: 'exit_z', key: 'exit_z', width: 120, align: 'center', render: (v: unknown) => <Tag color="green" style={commonStyle}>{renderParameter(v, 2)}</Tag> }
        ];
      default:
        return [
          { title: t.optimization.labelShortMa, dataIndex: 'short_ma', key: 'short_ma', width: 100, align: 'center', render: (v: unknown) => <Tag color="blue" style={commonStyle}>{renderParameter(v)}</Tag> },
          { title: t.optimization.labelLongMa, dataIndex: 'long_ma', key: 'long_ma', width: 100, align: 'center', render: (v: unknown) => <Tag color="green" style={commonStyle}>{renderParameter(v)}</Tag> }
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
      sorter: (a: OptimizationResult, b: OptimizationResult) => (
        (displayRanks.get(a) ?? Number.MAX_SAFE_INTEGER)
        - (displayRanks.get(b) ?? Number.MAX_SAFE_INTEGER)
      ),
      render: (_rank: number, record: OptimizationResult) => {
        const rank = displayRanks.get(record);
        return (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
            {rank === 1
              ? <CrownOutlined style={{ color: 'var(--op-gold, var(--op-blue, var(--app-blue-text)))' }} />
              : rank && rank <= 3
                ? <TrophyOutlined style={{ color: rank === 2 ? 'var(--app-text-muted)' : 'var(--op-red, #d48011)', fontSize: '12px' }} />
                : null}
            <Text
              strong
              style={{
                fontSize: rank === 1 ? '16px' : '14px',
                color: rank === 1
                  ? 'var(--op-gold, var(--op-blue, var(--app-blue-text)))'
                  : 'var(--app-text-strong)',
              }}
            >
              {rank ?? '—'}
            </Text>
          </div>
        );
      },
    },
    ...getParameterColumns(),
    {
      title: t.optimization.colTotalReturn,
      dataIndex: 'totalReturn',
      key: 'totalReturn',
      width: 140,
      align: 'right',
      sorter: (a: OptimizationResult, b: OptimizationResult) => compareFinite(
        isSuccessfulResult(a) ? a.totalReturn : null,
        isSuccessfulResult(b) ? b.totalReturn : null,
      ),
      render: (v: unknown, record: OptimizationResult) => {
        const value = toFiniteNumber(isSuccessfulResult(record) ? v : null);
        return <Text strong style={{ color: value === null ? 'var(--app-text-muted)' : value >= 0 ? 'var(--op-green, #3f8600)' : 'var(--op-red, #cf1322)', fontSize: '14px' }}>{safePercent(value)}</Text>;
      },
    },
    {
      title: t.optimization.colSharpe,
      dataIndex: 'sharpeRatio',
      key: 'sharpeRatio',
      width: 100,
      align: 'right',
      sorter: (a: OptimizationResult, b: OptimizationResult) => compareFinite(
        isSuccessfulResult(a) ? a.sharpeRatio : null,
        isSuccessfulResult(b) ? b.sharpeRatio : null,
      ),
      render: (v: unknown, record: OptimizationResult) => {
        const value = toFiniteNumber(isSuccessfulResult(record) ? v : null);
        return <Text strong style={{ color: value === null ? 'var(--app-text-muted)' : value >= 1 ? 'var(--op-green, #3f8600)' : value >= 0 ? 'var(--op-gold, var(--op-blue, var(--app-blue-text)))' : 'var(--op-red, #cf1322)' }}>{safeToFixed(value, 2)}</Text>;
      },
    },
    {
      title: t.optimization.colMaxDD,
      dataIndex: 'maxDrawdown',
      key: 'maxDrawdown',
      width: 110,
      align: 'right',
      sorter: (a: OptimizationResult, b: OptimizationResult) => compareFiniteMagnitude(
        isSuccessfulResult(a) ? a.maxDrawdown : null,
        isSuccessfulResult(b) ? b.maxDrawdown : null,
      ),
      render: (v: unknown, record: OptimizationResult) => {
        const value = toFiniteNumber(isSuccessfulResult(record) ? v : null);
        const magnitude = value === null ? null : Math.abs(value);
        return <Text strong style={{ color: magnitude === null ? 'var(--app-text-muted)' : magnitude < 15 ? 'var(--op-green, #3f8600)' : magnitude < 30 ? 'var(--op-gold, var(--op-blue, var(--app-blue-text)))' : 'var(--op-red, #cf1322)' }}>{safeDrawdown(value)}</Text>;
      },
    },
    {
      title: t.optimization.colWinRate,
      dataIndex: 'winRate',
      key: 'winRate',
      width: 110,
      align: 'right',
      sorter: (a: OptimizationResult, b: OptimizationResult) => compareFinite(
        isSuccessfulResult(a) ? a.winRate : null,
        isSuccessfulResult(b) ? b.winRate : null,
      ),
      render: (v: unknown, record: OptimizationResult) => {
        const value = toFiniteNumber(isSuccessfulResult(record) ? v : null);
        return <Text strong style={{ color: value === null ? 'var(--app-text-muted)' : 'var(--app-text-strong)' }}>{value === null ? 'N/A' : `${value.toFixed(1)}%`}</Text>;
      },
    },
    {
      title: t.optimization.colTrades,
      dataIndex: 'trades',
      key: 'trades',
      width: 100,
      align: 'right',
      sorter: (a: OptimizationResult, b: OptimizationResult) => compareFinite(
        isSuccessfulResult(a) ? a.trades : null,
        isSuccessfulResult(b) ? b.trades : null,
      ),
      render: (v: unknown, record: OptimizationResult) => {
        const value = toFiniteNumber(isSuccessfulResult(record) ? v : null);
        return <Text style={{ color: value === null ? 'var(--app-text-muted)' : 'var(--app-text)' }}>{value === null ? 'N/A' : Math.round(value)}</Text>;
      },
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
          background: color-mix(in srgb, var(--op-gold, var(--op-blue, var(--app-blue-text))) 5%, transparent);
        }
        .top-rank-row td {
          border-bottom: 1px solid color-mix(in srgb, var(--op-gold, var(--op-blue, var(--app-blue-text))) 18%, transparent) !important;
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
            <Text style={{ fontSize: '12px', color: 'var(--app-text-muted)', fontWeight: 600 }}>
              {t.optimization.resultsRange.replace('{from}', String(range[0])).replace('{to}', String(range[1])).replace('{total}', String(total)).toUpperCase()}
            </Text>
          ),
        }}
        size="small"
        scroll={{ x: 1000 }}
        rowClassName={(record: OptimizationResult) => displayRanks.get(record) === 1 ? 'top-rank-row' : ''}
      />
    </div>
  );
};

export default OptimizationResultsTable;
