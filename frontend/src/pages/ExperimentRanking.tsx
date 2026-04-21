import React, { useState, useEffect } from 'react';
import { Table, Card, Spin, Alert, Empty, Tag, Tooltip } from 'antd';
import { TrophyOutlined, LineChartOutlined, InfoCircleOutlined, ExperimentOutlined } from '@ant-design/icons';

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
  if (safeValue === 0) return '0.00%';
  const sign = safeValue > 0 ? '+' : '-';
  return `${sign}${safeToFixed(Math.abs(safeValue), 2)}%`;
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
  preset: string; // Fast, Medium, Slow 或其他参数组合
  returnPct: number;
  trades: number;
  totalSlippage: number;
  totalCommission: number;
  totalCost: number; // slippage + commission
  durationMinutes: number;
  createdAt: string;
  parameters?: {
    strategy?: string;
    shortMaPeriod?: number;
    longMaPeriod?: number;
    // 其他参数
  };
}

const ExperimentRanking: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [rankingData, setRankingData] = useState<ExperimentRankingItem[]>([]);
  const [presetSummary, setPresetSummary] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchRankingData();
  }, []);

  const fetchRankingData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // 从 localStorage 获取 session history
      const sessionHistoryStr = localStorage.getItem('quant_session_history');
      if (!sessionHistoryStr) {
        setRankingData([]);
        return;
      }
      
      const sessionHistory = JSON.parse(sessionHistoryStr);
      if (!Array.isArray(sessionHistory)) {
        setRankingData([]);
        return;
      }
      
      // 转换数据为 ranking items
      const rankingItems: ExperimentRankingItem[] = sessionHistory
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
            totalSlippage,
            totalCommission,
            totalCost,
            durationMinutes: safeNumber(item.results.durationMinutes || 0),
            createdAt: item.createdAt || new Date().toISOString(),
            parameters: item.parameters || {},
          };
        })
        .sort((a: ExperimentRankingItem, b: ExperimentRankingItem) => b.returnPct - a.returnPct); // 按 returnPct 降序排序
      
      setRankingData(rankingItems);
      
      // 计算 preset 聚合统计
      const presetGroups: Record<string, any> = {};
      
      rankingItems.forEach((item: ExperimentRankingItem) => {
        const preset = item.preset;
        if (!presetGroups[preset]) {
          presetGroups[preset] = {
            preset: preset,
            sessions: [],
            totalReturn: 0,
            totalTrades: 0,
            totalCost: 0,
            bestReturn: -Infinity,
            worstReturn: Infinity,
            positiveSessions: 0
          };
        }
        
        const group = presetGroups[preset];
        group.sessions.push(item);
        group.totalReturn += item.returnPct;
        group.totalTrades += item.trades;
        group.totalCost += item.totalCost;
        
        if (item.returnPct > group.bestReturn) {
          group.bestReturn = item.returnPct;
        }
        
        if (item.returnPct < group.worstReturn) {
          group.worstReturn = item.returnPct;
        }
        
        if (item.returnPct > 0) {
          group.positiveSessions += 1;
        }
      });
      
      // 转换为数组并计算平均值
      const presetSummaryArray = Object.values(presetGroups).map((group: any) => {
        const sessionCount = group.sessions.length;
        
        // 计算标准差、胜率和夏普比率
        let stdDev = 0;
        let winRate = 0;
        let sharpe = 0;
        
        if (sessionCount > 0) {
          // 获取所有收益率
          const returns = group.sessions.map((s: any) => s.returnPct);
          
          // 计算平均收益率
          const avgReturn = group.totalReturn / sessionCount;
          
          // 计算标准差
          const variance = returns.reduce((sum: number, r: number) => sum + Math.pow(r - avgReturn, 2), 0) / sessionCount;
          stdDev = Math.sqrt(variance);
          
          // 计算夏普比率（简化版，不考虑无风险利率）
          // 使用小阈值避免除零错误
          sharpe = stdDev > 0.001 ? avgReturn / stdDev : 0;
          
          // 计算胜率（收益率 > 0 的比例）
          const winCount = returns.filter((r: number) => r > 0).length;
          winRate = (winCount / sessionCount) * 100;
        }
        
        return {
          key: group.preset,
          preset: group.preset,
          sessions: sessionCount,
          avgReturn: sessionCount > 0 ? group.totalReturn / sessionCount : 0,
          avgTrades: sessionCount > 0 ? group.totalTrades / sessionCount : 0,
          avgCost: sessionCount > 0 ? group.totalCost / sessionCount : 0,
          bestReturn: group.bestReturn === -Infinity ? 0 : group.bestReturn,
          worstReturn: group.worstReturn === Infinity ? 0 : group.worstReturn,
          successRate: sessionCount > 0 ? (group.positiveSessions / sessionCount) * 100 : 0,
          stdDev: stdDev,
          winRate: winRate,
          sharpe: sharpe
        };
      }).sort((a: any, b: any) => {
        // 主要按夏普比率降序排序（风险调整后收益）
        if (Math.abs(b.sharpe - a.sharpe) > 0.01) {
          return b.sharpe - a.sharpe;
        }
        // 次要按平均收益率降序排序
        if (Math.abs(b.avgReturn - a.avgReturn) > 0.01) {
          return b.avgReturn - a.avgReturn;
        }
        // 最后按胜率降序排序
        return b.winRate - a.winRate;
      });
      
      setPresetSummary(presetSummaryArray);
      
      // Debug log
      console.log(`Loaded ${rankingItems.length} experiment ranking items`);
      console.log(`Aggregated ${presetSummaryArray.length} preset groups`);
      
      if (rankingItems.length === 0) {
        console.log('No experiment data available for ranking');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load experiment ranking data');
    } finally {
      setLoading(false);
    }
  };

  const columns = [
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
          fontSize: index < 3 ? '16px' : '14px',
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
      width: 100,
      sorter: (a: ExperimentRankingItem, b: ExperimentRankingItem) => a.symbol.localeCompare(b.symbol),
      render: (symbol: string) => (
        <Tag color="blue" style={{ fontWeight: 'bold', fontSize: '14px' }}>
          {symbol}
        </Tag>
      ),
    },
    {
      title: 'Preset',
      dataIndex: 'preset',
      key: 'preset',
      width: 120,
      sorter: (a: ExperimentRankingItem, b: ExperimentRankingItem) => a.preset.localeCompare(b.preset),
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
          <Tooltip title="Total return percentage from the experiment">
            <InfoCircleOutlined style={{ marginLeft: '4px', color: '#666', fontSize: '12px' }} />
          </Tooltip>
        </span>
      ),
      dataIndex: 'returnPct',
      key: 'returnPct',
      width: 120,
      defaultSortOrder: 'descend' as const,
      sorter: (a: ExperimentRankingItem, b: ExperimentRankingItem) => a.returnPct - b.returnPct,
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
      title: (
        <span>
          Trades
          <Tooltip title="Number of trades executed">
            <InfoCircleOutlined style={{ marginLeft: '4px', color: '#666', fontSize: '12px' }} />
          </Tooltip>
        </span>
      ),
      dataIndex: 'trades',
      key: 'trades',
      width: 90,
      sorter: (a: ExperimentRankingItem, b: ExperimentRankingItem) => a.trades - b.trades,
      render: (trades: number) => (
        <span style={{ fontWeight: 'bold' }}>
          {trades}
        </span>
      ),
    },
    {
      title: (
        <span>
          Duration
          <Tooltip title="Experiment duration">
            <InfoCircleOutlined style={{ marginLeft: '4px', color: '#666', fontSize: '12px' }} />
          </Tooltip>
        </span>
      ),
      dataIndex: 'durationMinutes',
      key: 'durationMinutes',
      width: 110,
      sorter: (a: ExperimentRankingItem, b: ExperimentRankingItem) => a.durationMinutes - b.durationMinutes,
      render: (minutes: number) => (
        <span style={{ fontWeight: '500' }}>
          {formatDuration(minutes)}
        </span>
      ),
    },
    {
      title: (
        <span>
          Total Cost
          <Tooltip title="Total execution cost (slippage + commission)">
            <InfoCircleOutlined style={{ marginLeft: '4px', color: '#666', fontSize: '12px' }} />
          </Tooltip>
        </span>
      ),
      dataIndex: 'totalCost',
      key: 'totalCost',
      width: 120,
      sorter: (a: ExperimentRankingItem, b: ExperimentRankingItem) => a.totalCost - b.totalCost,
      render: (cost: number) => {
        const formattedCost = cost.toFixed(2);
        return (
          <span style={{ color: cost > 0 ? '#cf1322' : '#3f8600', fontWeight: 'bold' }}>
            ${formattedCost}
          </span>
        );
      },
    },
    {
      title: (
        <span>
          Cost Details
          <Tooltip title="Breakdown: Slippage + Commission">
            <InfoCircleOutlined style={{ marginLeft: '4px', color: '#666', fontSize: '12px' }} />
          </Tooltip>
        </span>
      ),
      key: 'costDetails',
      width: 180,
      render: (_: any, record: ExperimentRankingItem) => (
        <div style={{ fontSize: '12px', lineHeight: '1.4' }}>
          <div>
            <span style={{ color: '#666' }}>Slippage: </span>
            <span style={{ color: '#fa8c16', fontWeight: '500' }}>
              ${record.totalSlippage.toFixed(2)}
            </span>
          </div>
          <div>
            <span style={{ color: '#666' }}>Commission: </span>
            <span style={{ color: '#722ed1', fontWeight: '500' }}>
              ${record.totalCommission.toFixed(2)}
            </span>
          </div>
        </div>
      ),
    },
  ];

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <Spin size="large" />
        <div style={{ marginTop: '16px', color: '#666' }}>Loading experiment ranking data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '24px' }}>
        <Alert
          message="Error"
          description={error}
          type="error"
          showIcon
        />
      </div>
    );
  }

  return (
    <div style={{ padding: '24px' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ marginBottom: '8px' }}>
          <ExperimentOutlined style={{ marginRight: '12px', color: '#1890ff' }} />
          Experiment Ranking
        </h1>
        <div style={{ color: '#666', fontSize: '14px' }}>
          Performance ranking based on paper trading experiments. Sorted by Sharpe Ratio (risk-adjusted return, highest first).
          {rankingData.length > 0 && (
            <span style={{ marginLeft: '12px', fontWeight: '500' }}>
              Showing {rankingData.length} experiment{rankingData.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* Preset Performance Summary */}
      {presetSummary.length > 0 && (
        <Card 
          title={
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span style={{ marginRight: '8px' }}>📊</span>
              <span>Preset Performance Summary</span>
              <Tooltip title="Average performance by preset type, sorted by Sharpe Ratio (risk-adjusted return, highest first)">
                <InfoCircleOutlined style={{ marginLeft: '8px', color: '#666', fontSize: '14px' }} />
              </Tooltip>
            </div>
          }
          style={{ marginBottom: '24px', backgroundColor: '#fafafa' }}
        >
          <Table
            dataSource={presetSummary}
            pagination={false}
            size="small"
            bordered
            columns={[
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
                title: 'Sessions',
                dataIndex: 'sessions',
                key: 'sessions',
                width: 80,
                align: 'center' as const,
                render: (sessions: number) => (
                  <span style={{ fontWeight: 'bold' }}>{sessions}</span>
                ),
              },
              {
                title: 'Avg Return',
                dataIndex: 'avgReturn',
                key: 'avgReturn',
                width: 100,
                align: 'right' as const,
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
                title: 'Avg Trades',
                dataIndex: 'avgTrades',
                key: 'avgTrades',
                width: 90,
                align: 'right' as const,
                render: (value: number) => (
                  <span style={{ fontWeight: '500' }}>
                    {value.toFixed(1)}
                  </span>
                ),
              },
              {
                title: 'Avg Cost',
                dataIndex: 'avgCost',
                key: 'avgCost',
                width: 90,
                align: 'right' as const,
                render: (value: number) => {
                  const formattedCost = value.toFixed(2);
                  return (
                    <span style={{ color: value > 0 ? '#cf1322' : '#3f8600', fontWeight: '500' }}>
                      ${formattedCost}
                    </span>
                  );
                },
              },
              {
                title: (
                  <span>
                    Std Dev
                    <Tooltip title="Return standard deviation - lower is better (more stable)">
                      <InfoCircleOutlined style={{ marginLeft: '4px', color: '#666', fontSize: '12px' }} />
                    </Tooltip>
                  </span>
                ),
                dataIndex: 'stdDev',
                key: 'stdDev',
                width: 90,
                align: 'right' as const,
                render: (value: number) => {
                  // 标准差越低越好
                  let color = '#cf1322'; // 红色表示高风险
                  if (value < 2) color = '#3f8600'; // 绿色表示低风险
                  else if (value < 5) color = '#fa8c16'; // 橙色表示中等风险
                  
                  return (
                    <span style={{ color, fontWeight: '500' }}>
                      {value.toFixed(2)}%
                    </span>
                  );
                },
              },
              {
                title: (
                  <span>
                    Win Rate
                    <Tooltip title="Percentage of sessions with positive return">
                      <InfoCircleOutlined style={{ marginLeft: '4px', color: '#666', fontSize: '12px' }} />
                    </Tooltip>
                  </span>
                ),
                dataIndex: 'winRate',
                key: 'winRate',
                width: 90,
                align: 'right' as const,
                render: (value: number) => {
                  let color = '#cf1322';
                  if (value >= 70) color = '#3f8600';
                  else if (value >= 50) color = '#fa8c16';
                  
                  return (
                    <span style={{ color, fontWeight: '500' }}>
                      {value.toFixed(1)}%
                    </span>
                  );
                },
              },
              {
                title: (
                  <span>
                    Sharpe
                    <Tooltip title="Sharpe Ratio - risk-adjusted return (higher is better)">
                      <InfoCircleOutlined style={{ marginLeft: '4px', color: '#666', fontSize: '12px' }} />
                    </Tooltip>
                  </span>
                ),
                dataIndex: 'sharpe',
                key: 'sharpe',
                width: 80,
                align: 'right' as const,
                render: (value: number) => {
                  // 夏普比率颜色编码
                  let color = '#cf1322'; // 红色表示差
                  if (value >= 2) color = '#3f8600'; // 绿色表示优秀
                  else if (value >= 1) color = '#fa8c16'; // 橙色表示良好
                  
                  return (
                    <span style={{ color, fontWeight: 'bold' }}>
                      {value.toFixed(2)}
                    </span>
                  );
                },
              },
              {
                title: 'Success Rate',
                dataIndex: 'successRate',
                key: 'successRate',
                width: 100,
                align: 'right' as const,
                render: (value: number) => {
                  let color = '#cf1322';
                  if (value >= 70) color = '#3f8600';
                  else if (value >= 50) color = '#fa8c16';
                  
                  return (
                    <span style={{ color, fontWeight: '500' }}>
                      {value.toFixed(1)}%
                    </span>
                  );
                },
              },
            ]}
          />
          
          {/* Summary Insights */}
          {presetSummary.length > 0 && (
            <div style={{ 
              marginTop: '16px', 
              padding: '12px', 
              backgroundColor: '#f6ffed',
              borderRadius: '4px',
              fontSize: '13px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div>
                  <span style={{ fontWeight: '500', color: '#666' }}>Top Performing Preset: </span>
                  <Tag color="green" style={{ marginLeft: '4px' }}>{presetSummary[0].preset}</Tag>
                  <span style={{ marginLeft: '8px', color: '#666' }}>
                    {presetSummary[0].sessions} session{presetSummary[0].sessions !== 1 ? 's' : ''}
                  </span>
                </div>
                <div>
                  <span style={{ fontWeight: 'bold', color: presetSummary[0].avgReturn >= 0 ? '#3f8600' : '#cf1322' }}>
                    Avg Return: {formatPercent(presetSummary[0].avgReturn)}
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                <div>
                  <span style={{ color: '#666' }}>Risk-Adjusted: </span>
                  <span style={{ 
                    color: presetSummary[0].sharpe >= 2 ? '#3f8600' : 
                           presetSummary[0].sharpe >= 1 ? '#fa8c16' : '#cf1322',
                    fontWeight: '500'
                  }}>
                    Sharpe: {presetSummary[0].sharpe.toFixed(2)}
                  </span>
                </div>
                <div>
                  <span style={{ color: '#666' }}>Stability: </span>
                  <span style={{ 
                    color: presetSummary[0].stdDev < 2 ? '#3f8600' : 
                           presetSummary[0].stdDev < 5 ? '#fa8c16' : '#cf1322',
                    fontWeight: '500'
                  }}>
                    Std Dev: {presetSummary[0].stdDev.toFixed(2)}%
                  </span>
                </div>
                <div>
                  <span style={{ color: '#666' }}>Consistency: </span>
                  <span style={{ 
                    color: presetSummary[0].winRate >= 70 ? '#3f8600' : 
                           presetSummary[0].winRate >= 50 ? '#fa8c16' : '#cf1322',
                    fontWeight: '500'
                  }}>
                    Win Rate: {presetSummary[0].winRate.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Ranking Table */}
      <Card>
        {rankingData.length > 0 ? (
          <Table
            columns={columns}
            dataSource={rankingData}
            pagination={{
              pageSize: 20,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} items`,
            }}
            size="middle"
            scroll={{ x: 1000 }}
            bordered
            rowClassName={(record, index) => 
              index === 0 ? 'top-rank-row' : index === 1 ? 'second-rank-row' : index === 2 ? 'third-rank-row' : ''
            }
          />
        ) : (
          <Empty
            description="No experiment data available for ranking"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            style={{ padding: '40px 0' }}
          />
        )}
      </Card>

      {/* Legend */}
      {rankingData.length > 0 && (
        <Card style={{ marginTop: '24px' }}>
          <div style={{ fontSize: '14px', fontWeight: '500', marginBottom: '12px' }}>
            📊 Color Legend
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', fontSize: '13px', color: '#666' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '12px', height: '12px', backgroundColor: '#3f8600', borderRadius: '2px' }} />
              <span>Positive return / Low cost</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '12px', height: '12px', backgroundColor: '#cf1322', borderRadius: '2px' }} />
              <span>Negative return / High cost</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Tag color="green" style={{ margin: 0 }}>Fast</Tag>
              <span>Fast preset (aggressive)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Tag color="orange" style={{ margin: 0 }}>Medium</Tag>
              <span>Medium preset (balanced)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Tag color="volcano" style={{ margin: 0 }}>Slow</Tag>
              <span>Slow preset (conservative)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '12px', height: '12px', backgroundColor: '#ffd700', borderRadius: '50%' }} />
              <span>🥇 1st place</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '12px', height: '12px', backgroundColor: '#c0c0c0', borderRadius: '50%' }} />
              <span>🥈 2nd place</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '12px', height: '12px', backgroundColor: '#cd7f32', borderRadius: '50%' }} />
              <span>🥉 3rd place</span>
            </div>
          </div>
        </Card>
      )}

      {/* Refresh Button */}
      <div style={{ textAlign: 'center', marginTop: '24px' }}>
        <button
          onClick={fetchRankingData}
          style={{
            padding: '8px 16px',
            background: '#1890ff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500',
          }}
        >
          Refresh Ranking
        </button>
      </div>
    </div>
  );
};

export default ExperimentRanking;