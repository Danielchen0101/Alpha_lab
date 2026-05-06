import React, { useState, useEffect, useMemo } from 'react';
import { 
  Table, Card, Spin, Alert, Empty, Tag, Row, Col,
  Statistic, Input, Select, Space, Button, Badge, Typography
} from 'antd';
import { 
  TrophyOutlined,
  SearchOutlined,
  ReloadOutlined,
  ArrowUpOutlined,
  ThunderboltOutlined,
  LineChartOutlined,
  SafetyCertificateOutlined,
  PieChartOutlined,
  HistoryOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { backtraderAPI } from '../services/api';
import { useLanguage } from '../contexts/LanguageContext';

const { Title, Text } = Typography;
const { Option } = Select;

// Helper functions
const safeNumber = (value: any): number => {
  if (value === null || value === undefined || value === '') return 0;
  const num = Number(value);
  return isNaN(num) ? 0 : num;
};

const safeToFixed = (value: any, decimals: number = 2): string => {
  const safeValue = safeNumber(value);
  return safeValue.toFixed(decimals);
};

const formatPercent = (value: number): string => {
  const safeValue = safeNumber(value);
  const sign = safeValue >= 0 ? '+' : '';
  return `${sign}${safeToFixed(safeValue, 2)}%`;
};

interface RankingItem {
  key: string;
  backtestId: string;
  symbol: string;
  strategy: string;
  totalReturn: number;
  annualizedReturn: number;
  sharpeRatio: number;
  sortinoRatio: number;
  maxDrawdown: number;
  volatility: number;
  winRate: number;
  profitFactor: number;
  trades: number;
  status: string;
  period: string;
  createdAt: string;
  originalRecord: any;
}

const StrategyRanking: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [rankingData, setRankingData] = useState<RankingItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { t } = useLanguage();

  // Filters and search
  const [searchText, setSearchText] = useState('');
  const [strategyFilter, setStrategyFilter] = useState('All');
  const [sortBy, setSortBy] = useState('totalReturn');
  const [showCompletedOnly, setShowCompletedOnly] = useState(true);

  useEffect(() => {
    fetchRankingData();
  }, []);

  const loadLocalBacktestHistory = (): RankingItem[] => {
    try {
      const saved = localStorage.getItem('quant_backtest_history');
      if (saved) {
        const history = JSON.parse(saved);
        return history.map((item: any, index: number) => ({
          key: item.backtestId || `local-${index}`,
          backtestId: item.backtestId,
          symbol: item.symbol || item.parameters?.symbols?.[0] || 'N/A',
          strategy: item.strategy || item.parameters?.strategy || 'N/A',
          totalReturn: safeNumber(item.totalReturn ?? item.results?.totalReturn),
          annualizedReturn: safeNumber(item.annualizedReturn ?? item.results?.annualizedReturn),
          sharpeRatio: safeNumber(item.sharpeRatio ?? item.results?.sharpeRatio),
          sortinoRatio: safeNumber(item.sortinoRatio ?? item.results?.sortinoRatio),
          maxDrawdown: safeNumber(item.maxDrawdown ?? item.results?.maxDrawdown),
          volatility: safeNumber(item.volatility ?? item.results?.volatility),
          winRate: safeNumber(item.winRate ?? item.results?.winRate),
          profitFactor: safeNumber(item.profitFactor ?? item.results?.profitFactor),
          trades: safeNumber(item.trades ?? item.results?.trades),
          status: item.status || 'completed',
          period: item.period || `${item.startDate || ''} - ${item.endDate || ''}`,
          createdAt: item.createdAt,
          originalRecord: item,
        }));
      }
    } catch (err) {
      console.error('Failed to load local history:', err);
    }
    return [];
  };

  const fetchRankingData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // 1. Get local history first
      const localHistory = loadLocalBacktestHistory();
      let combinedData = [...localHistory];
      
      // 2. Try to get API history
      try {
        const response = await backtraderAPI.getBacktestHistory();
        if (response.data && response.data.history && Array.isArray(response.data.history)) {
          const apiData = response.data.history.map((item: any, index: number) => ({
            key: item.backtestId || `api-${index}`,
            backtestId: item.backtestId,
            symbol: item.parameters?.symbols?.[0] || 'N/A',
            strategy: item.parameters?.strategy || 'N/A',
            totalReturn: safeNumber(item.results?.totalReturn),
            annualizedReturn: safeNumber(item.results?.annualizedReturn),
            sharpeRatio: safeNumber(item.results?.sharpeRatio),
            sortinoRatio: safeNumber(item.results?.sortinoRatio),
            maxDrawdown: safeNumber(item.results?.maxDrawdown),
            volatility: safeNumber(item.results?.volatility),
            winRate: safeNumber(item.results?.winRate),
            profitFactor: safeNumber(item.results?.profitFactor),
            trades: safeNumber(item.results?.trades),
            status: item.status || 'completed',
            period: item.parameters?.period || '',
            createdAt: item.createdAt,
            originalRecord: item,
          }));
          
          // Merge and de-duplicate
          const dataMap = new Map<string, RankingItem>();
          combinedData.forEach((item: RankingItem) => dataMap.set(item.backtestId, item));
          apiData.forEach((item: RankingItem) => dataMap.set(item.backtestId, item));
          combinedData = Array.from(dataMap.values());
        }
      } catch (apiErr) {
        console.warn('API history fetch failed, using local only', apiErr);
      }
      
      setRankingData(combinedData);
    } catch (err: any) {
      setError(err.message || 'Failed to load ranking data');
    } finally {
      setLoading(false);
    }
  };

  // Filter and sort logic
  const filteredAndSortedData = useMemo(() => {
    let data = [...rankingData];
    
    // Status filter
    if (showCompletedOnly) {
      data = data.filter(item => item.status === 'completed');
    }
    
    // Search filter
    if (searchText) {
      const lowerSearch = searchText.toLowerCase();
      data = data.filter((item: RankingItem) => 
        item.symbol.toLowerCase().includes(lowerSearch) || 
        item.strategy.toLowerCase().includes(lowerSearch)
      );
    }
    
    // Strategy filter
    if (strategyFilter !== 'All') {
      data = data.filter((item: RankingItem) => item.strategy === strategyFilter);
    }
    
    // Sort logic: Primary (sortBy), Secondary (Sharpe), Tertiary (MaxDD)
    data.sort((a, b) => {
      let valA = (a as any)[sortBy];
      let valB = (b as any)[sortBy];
      
      // For MaxDrawdown, lower is better (if stored as positive) or higher is better (if stored as negative)
      // Assuming negative as per existing code logic (e.g. -10 > -30)
      if (sortBy === 'maxDrawdown') {
        if (valA !== valB) return valB - valA; // Descending (closer to 0 is better)
      } else {
        if (valA !== valB) return valB - valA; // Descending
      }
      
      // Secondary: Sharpe Ratio
      if (a.sharpeRatio !== b.sharpeRatio) return b.sharpeRatio - a.sharpeRatio;
      
      // Tertiary: Max Drawdown (Desc)
      return b.maxDrawdown - a.maxDrawdown;
    });
    
    return data;
  }, [rankingData, searchText, strategyFilter, sortBy, showCompletedOnly]);

  // Unique strategies for filter
  const strategies = useMemo(() => {
    const s = new Set<string>();
    rankingData.forEach((item: RankingItem) => {
      if (item.strategy && item.strategy !== 'N/A') s.add(item.strategy);
    });
    return Array.from(s).sort();
  }, [rankingData]);

  // Summary statistics
  const summaryStats = useMemo(() => {
    if (filteredAndSortedData.length === 0) return null;
    
    const bestReturn = Math.max(...filteredAndSortedData.map((d: RankingItem) => d.totalReturn));
    const bestSharpe = Math.max(...filteredAndSortedData.map((d: RankingItem) => d.sharpeRatio));
    const lowestDD = Math.max(...filteredAndSortedData.map((d: RankingItem) => d.maxDrawdown)); // Best MaxDD (closest to 0)
    const bestWinRate = Math.max(...filteredAndSortedData.map((d: RankingItem) => d.winRate));
    
    return {
      count: filteredAndSortedData.length,
      bestReturn,
      bestSharpe,
      lowestDD,
      bestWinRate,
      coveredStrategies: strategies.length
    };
  }, [filteredAndSortedData, strategies]);

  const getQualityLabel = (item: RankingItem) => {
    if (item.trades < 3) return { label: t.ranking.qualityLowSample, color: 'default' };
    if (item.totalReturn <= 0 || item.sharpeRatio < 0) return { label: t.ranking.qualityWeak, color: 'error' };
    if (item.maxDrawdown < -25) return { label: t.ranking.qualityHighRisk, color: 'warning' };
    if (item.totalReturn > 15 && item.sharpeRatio > 1.5) return { label: t.ranking.qualityElite, color: 'purple' };
    if (item.totalReturn > 8 && item.sharpeRatio > 1.0) return { label: t.ranking.qualityStrong, color: 'success' };
    if (item.sharpeRatio > 0.8 && item.totalReturn > 0) return { label: t.ranking.qualityStable, color: 'processing' };
    if (item.totalReturn > 10) return { label: t.ranking.qualityHighReturn, color: 'success' };
    return { label: t.ranking.qualityNeutral, color: 'default' };
  };

  const columns = [
    {
      title: t.ranking.colRank,
      key: 'rank',
      width: 70,
      fixed: 'left' as const,
      render: (_: any, __: any, index: number) => {
        let medal = null;
        let color = '#666';
        let fontSize = '14px';
        
        if (index === 0) {
          medal = '🥇';
          color = '#d4b106';
          fontSize = '20px';
        } else if (index === 1) {
          medal = '🥈';
          color = '#8e8e8e';
          fontSize = '18px';
        } else if (index === 2) {
          medal = '🥉';
          color = '#ad6800';
          fontSize = '18px';
        }
        
        return (
          <div style={{ textAlign: 'center', fontWeight: 'bold', color, fontSize }}>
            {medal || index + 1}
          </div>
        );
      },
    },
    {
      title: t.ranking.colSymbolStrategy,
      key: 'info',
      width: 180,
      fixed: 'left' as const,
      render: (_: any, record: RankingItem) => (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <Tag color="blue" style={{ margin: 0, fontWeight: 'bold' }}>{record.symbol}</Tag>
            {getQualityLabel(record).label !== t.ranking.qualityNeutral && (
              <Badge status={getQualityLabel(record).color as any} text={
                <span style={{ fontSize: '11px', color: '#888' }}>{getQualityLabel(record).label}</span>
              } />
            )}
          </div>
          <div style={{ fontSize: '12px', color: '#666', fontWeight: 500 }}>
            {(t.strategies as Record<string, string>)[record.strategy] || record.strategy.replace(/_/g, ' ')}
          </div>
        </div>
      ),
    },
    {
      title: t.ranking.colTotalReturn,
      dataIndex: 'totalReturn',
      key: 'totalReturn',
      width: 120,
      sorter: (a: RankingItem, b: RankingItem) => a.totalReturn - b.totalReturn,
      render: (value: number) => (
        <span style={{ color: value >= 0 ? '#3f8600' : '#cf1322', fontWeight: 'bold' }}>
          {formatPercent(value)}
        </span>
      ),
    },
    {
      title: t.ranking.colSharpe,
      dataIndex: 'sharpeRatio',
      key: 'sharpeRatio',
      width: 100,
      render: (value: number) => {
        const color = value >= 1.5 ? '#722ed1' : value >= 1 ? '#3f8600' : value >= 0 ? '#fa8c16' : '#cf1322';
        return <span style={{ color, fontWeight: 'bold' }}>{safeToFixed(value, 2)}</span>;
      },
    },
    {
      title: t.ranking.colMaxDD,
      dataIndex: 'maxDrawdown',
      key: 'maxDrawdown',
      width: 100,
      render: (value: number) => {
        const color = value > -15 ? '#3f8600' : value > -25 ? '#fa8c16' : '#cf1322';
        return <span style={{ color, fontWeight: 'bold' }}>{safeToFixed(value, 1)}%</span>;
      },
    },
    {
      title: t.ranking.colWinRate,
      dataIndex: 'winRate',
      key: 'winRate',
      width: 100,
      render: (value: number) => (
        <span style={{ fontWeight: '500' }}>{safeToFixed(value, 1)}%</span>
      ),
    },
    {
      title: t.ranking.colProfFactor,
      dataIndex: 'profitFactor',
      key: 'profitFactor',
      width: 110,
      render: (value: number) => (
        <span style={{ fontWeight: '500', color: value >= 1.5 ? '#3f8600' : '#666' }}>
          {safeToFixed(value, 2)}
        </span>
      ),
    },
    {
      title: t.ranking.colTrades,
      dataIndex: 'trades',
      key: 'trades',
      width: 80,
    },
    {
      title: t.ranking.colDate,
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 120,
      render: (date: string) => (
        <span style={{ fontSize: '12px', color: '#999' }}>
          {date ? new Date(date).toLocaleDateString() : 'N/A'}
        </span>
      ),
    },
    {
      title: t.ranking.colStatus,
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => {
        const statusMap: Record<string, string> = {
          completed: t.comparison.statusCompleted,
          failed: t.comparison.statusFailed,
          running: t.comparison.statusRunning,
        };
        let color = 'default';
        if (status === 'completed') color = 'success';
        if (status === 'failed') color = 'error';
        if (status === 'running') color = 'processing';
        return <Tag color={color}>{statusMap[status] || status}</Tag>;
      },
    },
  ];

  if (loading && rankingData.length === 0) {
    return (
      <div style={{ padding: '80px 0', textAlign: 'center' }}>
        <Spin size="large" tip={t.ranking.loadingTip} />
      </div>
    );
  }

  return (
    <div className="ranking-page" style={{ padding: '4px' }}>
      {/* Page Header */}
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <Title level={2} style={{ margin: 0 }}>
            <TrophyOutlined style={{ color: '#faad14', marginRight: '12px' }} />
            {t.ranking.leaderboardTitle}
          </Title>
          <Text type="secondary">
            {t.ranking.leaderboardSubtitle}
          </Text>
        </div>
        <Button 
          type="primary" 
          icon={<ReloadOutlined />} 
          onClick={fetchRankingData}
          loading={loading}
        >
          {t.ranking.refreshData}
        </Button>
      </div>

      {error && <Alert message={error} type="error" showIcon style={{ marginBottom: '24px' }} />}

      {/* Summary Cards */}
      {summaryStats && (
        <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
          <Col xs={12} sm={8} lg={4}>
            <Card className="metric-card" bordered={false} style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
              <Statistic 
                title={<span style={{ fontSize: '12px' }}>{t.ranking.rankedSessions}</span>}
                value={summaryStats.count} 
                prefix={<HistoryOutlined style={{ color: '#1890ff' }} />}
              />
            </Card>
          </Col>
          <Col xs={12} sm={8} lg={4}>
            <Card className="metric-card" bordered={false} style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
              <Statistic 
                title={<span style={{ fontSize: '12px' }}>{t.ranking.bestReturnStat}</span>}
                value={summaryStats.bestReturn} 
                precision={2}
                suffix="%"
                valueStyle={{ color: '#3f8600' }}
                prefix={<ArrowUpOutlined />}
              />
            </Card>
          </Col>
          <Col xs={12} sm={8} lg={4}>
            <Card className="metric-card" bordered={false} style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
              <Statistic 
                title={<span style={{ fontSize: '12px' }}>{t.ranking.topSharpe}</span>}
                value={summaryStats.bestSharpe} 
                precision={2}
                valueStyle={{ color: '#722ed1' }}
                prefix={<ThunderboltOutlined />}
              />
            </Card>
          </Col>
          <Col xs={12} sm={8} lg={4}>
            <Card className="metric-card" bordered={false} style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
              <Statistic 
                title={<span style={{ fontSize: '12px' }}>{t.ranking.bestMaxDD}</span>}
                value={summaryStats.lowestDD} 
                precision={1}
                suffix="%"
                valueStyle={{ color: '#3f8600' }}
                prefix={<SafetyCertificateOutlined />}
              />
            </Card>
          </Col>
          <Col xs={12} sm={8} lg={4}>
            <Card className="metric-card" bordered={false} style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
              <Statistic 
                title={<span style={{ fontSize: '12px' }}>{t.ranking.topWinRate}</span>}
                value={summaryStats.bestWinRate} 
                precision={1}
                suffix="%"
                prefix={<PieChartOutlined style={{ color: '#fa8c16' }} />}
              />
            </Card>
          </Col>
          <Col xs={12} sm={8} lg={4}>
            <Card className="metric-card" bordered={false} style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
              <Statistic 
                title={<span style={{ fontSize: '12px' }}>{t.ranking.strategiesCount}</span>}
                value={summaryStats.coveredStrategies} 
                prefix={<LineChartOutlined style={{ color: '#13c2c2' }} />}
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* Toolbar */}
      <Card style={{ marginBottom: '16px', borderRadius: '8px' }} bodyStyle={{ padding: '12px 24px' }}>
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} md={8}>
            <Input
              placeholder={t.ranking.searchPlaceholder}
              prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              allowClear
            />
          </Col>
          <Col xs={24} md={16}>
            <Space wrap style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Select 
                value={strategyFilter} 
                onChange={setStrategyFilter}
                style={{ width: 160 }}
              >
                <Option value="All">{t.ranking.allStrategies}</Option>
                {strategies.map((s: string) => <Option key={s} value={s}>{(t.strategies as Record<string, string>)[s] || s.replace(/_/g, ' ')}</Option>)}
              </Select>
              
              <Select 
                value={sortBy} 
                onChange={setSortBy}
                style={{ width: 150 }}
              >
                <Option value="totalReturn">{t.ranking.sortByTotalReturn}</Option>
                <Option value="sharpeRatio">{t.ranking.sortBySharpeRatio}</Option>
                <Option value="maxDrawdown">{t.ranking.sortByMaxDrawdown}</Option>
                <Option value="winRate">{t.ranking.sortByWinRate}</Option>
                <Option value="profitFactor">{t.ranking.sortByProfitFactor}</Option>
                <Option value="trades">{t.ranking.sortByTrades}</Option>
              </Select>
              
              <Button 
                type={showCompletedOnly ? "primary" : "default"}
                onClick={() => setShowCompletedOnly(!showCompletedOnly)}
                size="middle"
              >
                {showCompletedOnly ? t.ranking.completedOnly : t.ranking.allStatus}
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Leaderboard Table */}
      <Card bodyStyle={{ padding: 0 }} style={{ borderRadius: '12px', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
        {filteredAndSortedData.length > 0 ? (
          <Table
            columns={columns}
            dataSource={filteredAndSortedData}
            pagination={{
              pageSize: 15,
              showSizeChanger: true,
              showTotal: (total: number) => t.ranking.totalStrategies.replace('{count}', String(total)),
            }}
            rowKey="key"
            size="middle"
            scroll={{ x: 1100 }}
            onRow={(record: RankingItem) => ({
              onClick: () => {
                // Save to sessionStorage as fallback
                sessionStorage.setItem('selectedBacktestForView', JSON.stringify(record.originalRecord));
                navigate('/backtest', { state: { selectedBacktestId: record.backtestId, selectedBacktest: record.originalRecord } });
              },
              style: { cursor: 'pointer' }
            })}
            rowClassName={(record, index) => {
              let className = 'ranking-row';
              if (index === 0) className += ' gold-row';
              if (index === 1) className += ' silver-row';
              if (index === 2) className += ' bronze-row';
              return className;
            }}
          />
        ) : (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <div style={{ textAlign: 'center' }}>
                <Title level={4}>{t.ranking.noRankedStrategies}</Title>
                <Text type="secondary">{t.ranking.runBacktestsFirst}</Text>
                <div style={{ marginTop: '24px' }}>
                  <Button type="primary" size="large" onClick={() => navigate('/backtest')}>
                    {t.ranking.goToBacktest}
                  </Button>
                </div>
              </div>
            }
            style={{ padding: '60px 0' }}
          />
        )}
      </Card>

      <style>{`
        .ranking-row:hover td {
          background-color: #f0f7ff !important;
        }
        .gold-row td {
          background-color: #fffdf0 !important;
        }
        .silver-row td {
          background-color: #f9f9f9 !important;
        }
        .bronze-row td {
          background-color: #fffbf5 !important;
        }
        .metric-card:hover {
          transform: translateY(-2px);
          transition: transform 0.3s;
        }
      `}</style>
    </div>
  );
};

export default StrategyRanking;