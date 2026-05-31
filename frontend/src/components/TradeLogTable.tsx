import React from 'react';
import { Table } from 'antd';
import { formatDateToYYYYMMDD } from '../utils/dateUtils';
import { useLanguage } from '../contexts/LanguageContext';

interface TradeItem {
  entryDate: string;
  exitDate: string;
  entryPrice: number;
  exitPrice: number;
  pnl: number;
  returnPct: number;
  holdingDays: number;
  position: number; // 1 for long, -1 for short
}

interface TradeLogTableProps {
  data: TradeItem[];
}

const TradeLogTable: React.FC<TradeLogTableProps> = ({ data }) => {
  const { t } = useLanguage();

  if (!data || data.length === 0) {
    return (
      <div style={{ 
        textAlign: 'center', 
        padding: '40px', 
        color: 'var(--app-text-muted)',
        background: 'var(--app-card-bg-soft)',
        borderRadius: '8px',
        border: '1px solid var(--app-border-soft)'
      }}>
        {t.backtest.noTradeData}
      </div>
    );
  }

  // Format currency
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  // Format percentage
  const formatPercent = (value: number): string => {
  if (value === undefined || value === null || isNaN(value)) {
    return "N/A";
  }
  if (value === 0) return "0.00%";
  const sign = value > 0 ? "+" : "-";
  return `${sign}${Math.abs(value).toFixed(2)}%`;
};

  // Table columns
  const columns = [
    {
      title: t.backtest.entryDate,
      dataIndex: 'entryDate',
      key: 'entryDate',
      sorter: (a: TradeItem, b: TradeItem) => a.entryDate.localeCompare(b.entryDate),
      defaultSortOrder: 'ascend' as const,
      render: (date: string) => formatDateToYYYYMMDD(date) || date,
    },
    {
      title: t.backtest.exitDate,
      dataIndex: 'exitDate',
      key: 'exitDate',
      render: (date: string) => date ? formatDateToYYYYMMDD(date) : 'N/A',
    },
    {
      title: t.backtest.entryPrice,
      dataIndex: 'entryPrice',
      key: 'entryPrice',
      render: (value: number) => formatCurrency(value),
      align: 'right' as const,
    },
    {
      title: t.backtest.exitPrice,
      dataIndex: 'exitPrice',
      key: 'exitPrice',
      render: (value: number) => formatCurrency(value),
      align: 'right' as const,
    },
    {
      title: t.backtest.pnlLabel,
      dataIndex: 'pnl',
      key: 'pnl',
      render: (value: number) => (
        <span style={{ 
          color: value >= 0 ? '#3f8600' : '#cf1322',
          fontWeight: value >= 0 ? '600' : '500'
        }}>
          {formatCurrency(value)}
        </span>
      ),
      align: 'right' as const,
      sorter: (a: TradeItem, b: TradeItem) => a.pnl - b.pnl,
    },
    {
      title: t.backtest.returnPercent,
      dataIndex: 'returnPct',
      key: 'returnPct',
      render: (value: number) => (
        <span style={{ 
          color: value >= 0 ? '#3f8600' : '#cf1322',
          fontWeight: value >= 0 ? '600' : '500'
        }}>
          {formatPercent(value)}
        </span>
      ),
      align: 'right' as const,
      sorter: (a: TradeItem, b: TradeItem) => a.returnPct - b.returnPct,
    },
    {
      title: t.backtest.holdingDays,
      dataIndex: 'holdingDays',
      key: 'holdingDays',
      align: 'right' as const,
      sorter: (a: TradeItem, b: TradeItem) => a.holdingDays - b.holdingDays,
    },
    {
      title: t.backtest.position,
      dataIndex: 'position',
      key: 'position',
      render: (value: number) => (
        <span style={{
          display: 'inline-block',
          padding: '2px 8px',
          borderRadius: '4px',
          backgroundColor: value === 1 ? '#d9f7be' : '#ffccc7',
          color: value === 1 ? '#135200' : '#820014',
          fontSize: '12px',
          fontWeight: '500'
        }}>
          {value === 1 ? t.backtest.longPosition : t.backtest.shortPosition}
        </span>
      ),
      align: 'center' as const,
    },
  ];

  // Calculate summary statistics
  const totalTrades = data.length;
  const winningTrades = data.filter(trade => trade.pnl > 0).length;
  const losingTrades = data.filter(trade => trade.pnl < 0).length;
  const totalPnL = data.reduce((sum, trade) => sum + trade.pnl, 0);
  const avgReturn = data.reduce((sum, trade) => sum + trade.returnPct, 0) / totalTrades;
  const winRate = (winningTrades / totalTrades) * 100;

  return (
    <div>
      {/* Summary Statistics */}
      <div style={{ 
        marginBottom: '16px',
        padding: '12px 16px',
        backgroundColor: 'var(--app-card-bg-soft)',
        borderRadius: '8px',
        border: '1px solid var(--app-border-soft)',
        fontSize: '13px',
        color: 'var(--app-text)',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
        gap: '12px'
      }}>
        <div>
          <div style={{ fontSize: '11px', color: 'var(--app-text-muted)', marginBottom: '2px' }}>{t.backtest.totalTrades}</div>
          <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--app-text-strong)' }}>{totalTrades}</div>
        </div>
        <div>
          <div style={{ fontSize: '11px', color: 'var(--app-text-muted)', marginBottom: '2px' }}>{t.backtest.winRateLabel}</div>
          <div style={{ fontSize: '14px', fontWeight: '600', color: '#3f8600' }}>{winRate.toFixed(1)}%</div>
        </div>
        <div>
          <div style={{ fontSize: '11px', color: 'var(--app-text-muted)', marginBottom: '2px' }}>{t.backtest.totalPnl}</div>
          <div style={{ 
            fontSize: '14px', 
            fontWeight: '600', 
            color: totalPnL >= 0 ? '#3f8600' : '#cf1322'
          }}>
            {formatCurrency(totalPnL)}
          </div>
        </div>
        <div>
          <div style={{ fontSize: '11px', color: 'var(--app-text-muted)', marginBottom: '2px' }}>{t.backtest.avgReturn}</div>
          <div style={{ 
            fontSize: '14px', 
            fontWeight: '600', 
            color: avgReturn >= 0 ? '#3f8600' : '#cf1322'
          }}>
            {formatPercent(avgReturn)}
          </div>
        </div>
        <div>
          <div style={{ fontSize: '11px', color: 'var(--app-text-muted)', marginBottom: '2px' }}>{t.backtest.winningTradesCount}</div>
          <div style={{ fontSize: '14px', fontWeight: '600', color: '#3f8600' }}>{winningTrades}</div>
        </div>
        <div>
          <div style={{ fontSize: '11px', color: 'var(--app-text-muted)', marginBottom: '2px' }}>{t.backtest.losingTradesCount}</div>
          <div style={{ fontSize: '14px', fontWeight: '600', color: '#cf1322' }}>{losingTrades}</div>
        </div>
      </div>

      {/* Trade Table */}
      <div style={{ 
        border: '1px solid var(--app-border-soft)',
        borderRadius: '8px',
        overflow: 'hidden'
      }}>
        <Table
          columns={columns}
          dataSource={data.map((item, index) => ({ ...item, key: index }))}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            pageSizeOptions: ['10', '20', '50', '100'],
            showTotal: (total, range) => t.backtest.tradeRange
              .replace('{start}', String(range[0]))
              .replace('{end}', String(range[1]))
              .replace('{total}', String(total))
          }}
          size="middle"
          scroll={{ x: 'max-content' }}
          rowClassName={(record) => record.pnl >= 0 ? 'profit-row' : 'loss-row'}
        />
      </div>

      <style>{`
        .profit-row {
          background-color: rgba(24, 144, 255, 0.02);
        }
        .loss-row {
          background-color: rgba(255, 77, 79, 0.02);
        }
        .ant-table-thead > tr > th {
          background-color: var(--app-table-header-bg);
          font-weight: 600;
          color: var(--app-text);
        }
        .ant-table-tbody > tr:hover > td {
          background-color: var(--app-card-bg-soft);
        }
      `}</style>
    </div>
  );
};

export default TradeLogTable;
