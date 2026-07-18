import React, { useState, useEffect, useCallback } from 'react';
import { Card, Table, Tag, Tooltip, Empty, Button } from 'antd';
import { TrophyOutlined, InfoCircleOutlined, ExperimentOutlined, ReloadOutlined } from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';

// Helper functions
const safeNumber = (value: any): number => {
  if (value === null || value === undefined || value === '') return 0;
  const num = Number(value);
  return isNaN(num) ? 0 : num;
};

const formatPercent = (value: number): string => {
  const safeValue = safeNumber(value);
  if (safeValue === 0) return '0.00%';
  const sign = safeValue > 0 ? '+' : '-';
  return `${sign}${Math.abs(safeValue).toFixed(2)}%`;
};

const formatDuration = (minutes: number): string => {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
};

interface ExperimentRankingItem {
  key: string;
  sessionId: string;
  symbol: string;
  preset: string;
  returnPct: number;
  trades: number;
  totalCost: number;
  durationMinutes: number;
  createdAt: string;
}

interface ExperimentRankingCardProps {
  sessionHistory?: any[];
  onRefresh?: () => void;
  compact?: boolean;
}

const ExperimentRankingCard: React.FC<ExperimentRankingCardProps> = ({ 
  sessionHistory, 
  onRefresh,
  compact = false 
}) => {
  const { user } = useAuth();
  const [rankingData, setRankingData] = useState<ExperimentRankingItem[]>([]);

  const updateRankingData = useCallback(() => {
    try {
      // 如果提供了 sessionHistory，使用它
      let historyData = sessionHistory;
      
      // 否则从 localStorage 获取
      if (!historyData) {
        const sessionHistoryStr = user?.id
          ? localStorage.getItem(`paper_trading_session_history:${user.id}`)
          : null;
        if (!sessionHistoryStr) {
          setRankingData([]);
          return;
        }
        historyData = JSON.parse(sessionHistoryStr);
      }
      
      if (!Array.isArray(historyData)) {
        setRankingData([]);
        return;
      }
      
      // 转换数据为 ranking items
      const rankingItems: ExperimentRankingItem[] = historyData
        .filter((item: any) => 
          item.results && 
          item.symbol &&
          item.preset &&
          item.results.returnPct !== undefined
        )
        .map((item: any, index: number) => {
          const totalSlippage = safeNumber(item.results.totalSlippage || 0);
          const totalCommission = safeNumber(item.results.totalCommission || 0);
          const totalCost = totalSlippage + totalCommission;
          
          return {
            key: item.sessionId || `experiment-${index}`,
            sessionId: item.sessionId || `experiment-${index}`,
            symbol: item.symbol || 'Unknown',
            preset: item.preset || 'Unknown',
            returnPct: safeNumber(item.results.returnPct),
            trades: safeNumber(item.results.trades || 0),
            totalCost,
            durationMinutes: safeNumber(item.results.durationMinutes || 0),
            createdAt: item.createdAt || new Date().toISOString(),
          };
        })
        .sort((a: ExperimentRankingItem, b: ExperimentRankingItem) => b.returnPct - a.returnPct)
        .slice(0, compact ? 5 : 10); // 紧凑模式只显示前5个
      
      setRankingData(rankingItems);
    } catch (err) {
      console.error('Failed to update ranking data:', err);
      setRankingData([]);
    }
  }, [compact, sessionHistory, user?.id]);

  useEffect(() => {
    updateRankingData();
  }, [updateRankingData]);

  const handleRefresh = () => {
    updateRankingData();
    if (onRefresh) {
      onRefresh();
    }
  };

  const columns = compact ? [
    {
      title: 'Rank',
      key: 'rank',
      width: 60,
      render: (_: any, __: any, index: number) => (
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          fontWeight: 'bold',
          fontSize: '12px',
          color: index === 0 ? '#ffd700' : index === 1 ? '#c0c0c0' : index === 2 ? '#cd7f32' : '#666'
        }}>
          {index === 0 && <TrophyOutlined style={{ marginRight: '2px', fontSize: '10px' }} />}
          {index + 1}
        </div>
      ),
    },
    {
      title: 'Symbol',
      dataIndex: 'symbol',
      key: 'symbol',
      width: 70,
      render: (symbol: string) => (
        <Tag color="blue" style={{ fontSize: '11px', padding: '1px 4px' }}>
          {symbol}
        </Tag>
      ),
    },
    {
      title: 'Preset',
      dataIndex: 'preset',
      key: 'preset',
      width: 70,
      render: (preset: string) => {
        let color = 'default';
        if (preset === 'Fast') color = 'green';
        else if (preset === 'Medium') color = 'orange';
        else if (preset === 'Slow') color = 'volcano';
        
        return (
          <Tag color={color} style={{ fontSize: '11px', padding: '1px 4px' }}>
            {preset}
          </Tag>
        );
      },
    },
    {
      title: 'Return',
      dataIndex: 'returnPct',
      key: 'returnPct',
      width: 80,
      render: (value: number) => {
        const color = value >= 0 ? '#3f8600' : '#cf1322';
        return (
          <span style={{ color, fontWeight: 'bold', fontSize: '11px' }}>
            {formatPercent(value)}
          </span>
        );
      },
    },
  ] : [
    {
      title: 'Rank',
      key: 'rank',
      width: 80,
      render: (_: any, __: any, index: number) => (
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          fontWeight: 'bold',
          fontSize: index < 3 ? '14px' : '12px',
          color: index === 0 ? '#ffd700' : index === 1 ? '#c0c0c0' : index === 2 ? '#cd7f32' : '#666'
        }}>
          {index === 0 && <TrophyOutlined style={{ marginRight: '4px' }} />}
          {index + 1}
        </div>
      ),
    },
    {
      title: 'Symbol',
      dataIndex: 'symbol',
      key: 'symbol',
      width: 90,
      render: (symbol: string) => (
        <Tag color="blue" style={{ fontWeight: 'bold', fontSize: '12px' }}>
          {symbol}
        </Tag>
      ),
    },
    {
      title: 'Preset',
      dataIndex: 'preset',
      key: 'preset',
      width: 100,
      render: (preset: string) => {
        let color = 'default';
        if (preset === 'Fast') color = 'green';
        else if (preset === 'Medium') color = 'orange';
        else if (preset === 'Slow') color = 'volcano';
        
        return (
          <Tag color={color} style={{ fontWeight: 'bold' }}>
            {preset}
          </Tag>
        );
      },
    },
    {
      title: (
        <span>
          Return
          <Tooltip title="Total return percentage">
            <InfoCircleOutlined style={{ marginLeft: '4px', color: '#666', fontSize: '10px' }} />
          </Tooltip>
        </span>
      ),
      dataIndex: 'returnPct',
      key: 'returnPct',
      width: 100,
      render: (value: number) => {
        const color = value >= 0 ? '#3f8600' : '#cf1322';
        return (
          <span style={{ color, fontWeight: 'bold', fontSize: '12px' }}>
            {formatPercent(value)}
          </span>
        );
      },
    },
    {
      title: 'Trades',
      dataIndex: 'trades',
      key: 'trades',
      width: 80,
      render: (trades: number) => (
        <span style={{ fontWeight: '500' }}>
          {trades}
        </span>
      ),
    },
    {
      title: 'Duration',
      dataIndex: 'durationMinutes',
      key: 'durationMinutes',
      width: 100,
      render: (minutes: number) => (
        <span style={{ fontWeight: '500' }}>
          {formatDuration(minutes)}
        </span>
      ),
    },
  ];

  return (
    <Card
      title={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <ExperimentOutlined style={{ marginRight: '8px', color: '#1890ff' }} />
            <span>Experiment Ranking</span>
            {rankingData.length > 0 && (
              <span style={{ marginLeft: '8px', fontSize: '12px', color: '#666' }}>
                ({rankingData.length} experiments)
              </span>
            )}
          </div>
          <Button
            size="small"
            icon={<ReloadOutlined />}
            onClick={handleRefresh}
            style={{ padding: '0 8px', height: '24px' }}
          >
            Refresh
          </Button>
        </div>
      }
      size="small"
      style={{ marginBottom: '16px' }}
    >
      {rankingData.length > 0 ? (
        <Table
          columns={columns}
          dataSource={rankingData}
          pagination={false}
          size="small"
          scroll={compact ? undefined : { x: 600 }}
          bordered={!compact}
          rowClassName={(record, index) => 
            index === 0 ? 'top-rank-row' : index === 1 ? 'second-rank-row' : index === 2 ? 'third-rank-row' : ''
          }
        />
      ) : (
        <Empty
          description="No experiment data available"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          style={{ padding: '20px 0' }}
        />
      )}
      
      {rankingData.length > 0 && compact && (
        <div style={{ 
          marginTop: '12px', 
          fontSize: '11px', 
          color: '#666',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <Tag color="green" style={{ margin: '0 2px', fontSize: '10px' }}>Fast</Tag>
            <Tag color="orange" style={{ margin: '0 2px', fontSize: '10px' }}>Medium</Tag>
            <Tag color="volcano" style={{ margin: '0 2px', fontSize: '10px' }}>Slow</Tag>
          </div>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ width: '8px', height: '8px', backgroundColor: '#ffd700', borderRadius: '50%', marginRight: '4px' }} />
            <span>🥇</span>
            <div style={{ width: '8px', height: '8px', backgroundColor: '#c0c0c0', borderRadius: '50%', margin: '0 4px 0 8px' }} />
            <span>🥈</span>
            <div style={{ width: '8px', height: '8px', backgroundColor: '#cd7f32', borderRadius: '50%', margin: '0 4px 0 8px' }} />
            <span>🥉</span>
          </div>
        </div>
      )}
    </Card>
  );
};

export default ExperimentRankingCard;
