import React, { useState, useEffect } from 'react';
import {
  Card, Typography, Button, Divider, Table, Tag, Row, Col, Statistic,
  Select, Descriptions, Empty
} from 'antd';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { PieChartOutlined, ReloadOutlined } from '@ant-design/icons';
import aiTradingService from '../services/aiTradingService';

const { Title, Text } = Typography;
const { Option } = Select;

const Portfolio: React.FC = () => {
  const [accountSnapshot, setAccountSnapshot] = useState({
    cash: 0, equity: 0, buyingPower: 0, portfolioValue: 0,
    positionsCount: 0, openOrdersCount: 0, accountNumber: '', status: ''
  });
  const [alpacaAccount, setAlpacaAccount] = useState<any>(null);
  const [alpacaPositions, setAlpacaPositions] = useState<any[]>([]);
  const [portfolioHistory, setPortfolioHistory] = useState<any[]>([]);
  const [portfolioRange, setPortfolioRange] = useState<string>('1M');
  const [portfolioChange, setPortfolioChange] = useState({ value: 0, percent: 0 });
  const [loading, setLoading] = useState(false);

  const normalizeTimestamp = (timestamp: number | string): number | null => {
    const n = Number(timestamp);
    if (!Number.isFinite(n)) return null;
    return n < 1e12 ? n * 1000 : n;
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [snapshot, account, positions, histRes] = await Promise.allSettled([
        aiTradingService.getAccountSnapshot(),
        aiTradingService.getAlpacaAccount(),
        aiTradingService.getAlpacaPositions(),
        aiTradingService.getPortfolioHistory(portfolioRange),
      ]);

      if (snapshot.status === 'fulfilled') {
        setAccountSnapshot({
          ...snapshot.value,
          accountNumber: snapshot.value.accountNumber || '',
          status: snapshot.value.status || 'ACTIVE'
        });
      }
      if (account.status === 'fulfilled') setAlpacaAccount(account.value);
      if (positions.status === 'fulfilled') setAlpacaPositions(Array.isArray(positions.value) ? positions.value : []);

      if (histRes.status === 'fulfilled' && histRes.value.success && histRes.value.data) {
        const data = histRes.value.data;
        setPortfolioHistory(data);
        if (data.length >= 2) {
          const first = data[0]?.equity || 0;
          const last = data[data.length - 1]?.equity || 0;
          setPortfolioChange({
            value: last - first,
            percent: first !== 0 ? ((last - first) / first) * 100 : 0
          });
        }
      }
    } catch (e) {
      console.error('Failed to load portfolio data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handlePortfolioRangeChange = async (range: string) => {
    setPortfolioRange(range);
    try {
      const response = await aiTradingService.getPortfolioHistory(range);
      if (response.success && response.data) {
        setPortfolioHistory(response.data);
        if (response.data.length >= 2) {
          const first = response.data[0]?.equity || 0;
          const last = response.data[response.data.length - 1]?.equity || 0;
          setPortfolioChange({
            value: last - first,
            percent: first !== 0 ? ((last - first) / first) * 100 : 0
          });
        }
      }
    } catch (e) {
      console.error('Failed to load portfolio history:', e);
    }
  };

  const positionsColumns = [
    { title: 'Asset', dataIndex: 'symbol', key: 'symbol', render: (t: string) => <span style={{ fontWeight: 700 }}>{t}</span> },
    { title: 'Price', dataIndex: 'currentPrice', key: 'currentPrice', render: (v: any) => { const n = Number(v); return Number.isFinite(n) ? `$${n.toFixed(2)}` : '-'; }},
    { title: 'Qty', dataIndex: 'qty', key: 'qty', render: (v: any) => { const n = Number(v); return Number.isFinite(n) ? n.toFixed(2) : '-'; }},
    { title: 'Side', dataIndex: 'side', key: 'side', render: (s: string) => <Tag color={s === 'long' ? 'green' : 'red'}>{(s || '').toUpperCase()}</Tag> },
    { title: 'Market Value', dataIndex: 'marketValue', key: 'marketValue', render: (v: any) => { const n = Number(v); return Number.isFinite(n) ? `$${n.toFixed(2)}` : '-'; }},
    { title: 'Avg Entry', dataIndex: 'avgEntryPrice', key: 'avgEntry', render: (v: any) => { const n = Number(v); return Number.isFinite(n) ? `$${n.toFixed(2)}` : '-'; }},
    { title: 'P/L ($)', dataIndex: 'totalPlValue', key: 'pl', render: (v: any) => { const n = Number(v); return Number.isFinite(n) ? <span style={{ color: n >= 0 ? '#3f8600' : '#cf1322', fontWeight: 600 }}>{n >= 0 ? '+' : ''}${n.toFixed(2)}</span> : '-'; }},
    { title: 'P/L (%)', dataIndex: 'totalPlPercent', key: 'plpct', render: (v: any) => { const n = Number(v); return Number.isFinite(n) ? <span style={{ color: n >= 0 ? '#3f8600' : '#cf1322', fontWeight: 600 }}>{n >= 0 ? '+' : ''}{n.toFixed(2)}%</span> : '-'; }},
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <Title level={2}><PieChartOutlined style={{ marginRight: 12 }} />Portfolio</Title>
          <Text type="secondary">Account overview, positions, and performance</Text>
        </div>
        <Button type="primary" icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
          Refresh
        </Button>
      </div>

      <Divider />

      {/* Account Snapshot */}
      <div style={{ marginBottom: 24 }}>
        <Title level={4}>Account Snapshot</Title>
        <Card size="small" style={{ marginTop: 16 }}>
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12} lg={6}>
              <Statistic title="Cash" value={accountSnapshot.cash} prefix="$" precision={2} />
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Statistic title="Equity" value={accountSnapshot.equity} prefix="$" precision={2} />
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Statistic title="Buying Power" value={accountSnapshot.buyingPower} prefix="$" precision={2} />
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Statistic title="Portfolio Value" value={accountSnapshot.portfolioValue} prefix="$" precision={2} />
            </Col>
          </Row>
          <div style={{ marginTop: 16 }}>
            <Text type="secondary">
              Account: {accountSnapshot.accountNumber || 'N/A'} | Status: {accountSnapshot.status || 'N/A'} |
              Positions: {accountSnapshot.positionsCount} | Open Orders: {accountSnapshot.openOrdersCount}
            </Text>
          </div>
        </Card>
      </div>

      {/* Portfolio Performance */}
      <div style={{ marginBottom: 24 }}>
        <Title level={4}>Portfolio Performance</Title>
        <Card>
          {portfolioHistory.length === 0 ? (
            <Empty description="No portfolio history available" />
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Select value={portfolioRange} onChange={handlePortfolioRangeChange} style={{ width: 120 }}>
                  <Option value="1D">1 Day</Option>
                  <Option value="1W">1 Week</Option>
                  <Option value="1M">1 Month</Option>
                  <Option value="1Y">1 Year</Option>
                  <Option value="All">All</Option>
                </Select>
                <Text strong style={{ fontSize: 16 }}>
                  Change:
                  <span style={{ color: portfolioChange.value >= 0 ? '#3f8600' : '#cf1322', marginLeft: 8 }}>
                    {portfolioChange.value >= 0 ? '+' : ''}${Number(portfolioChange.value || 0).toFixed(2)} ({Number(portfolioChange.percent || 0).toFixed(2)}%)
                  </span>
                </Text>
              </div>
              <div style={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={portfolioHistory}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="timestamp"
                      type="number"
                      scale="time"
                      domain={['dataMin', 'dataMax']}
                      tickFormatter={(timestamp) => {
                        const ts = normalizeTimestamp(timestamp);
                        if (!ts) return '';
                        const date = new Date(ts);
                        if (portfolioRange === '1D') {
                          return date.toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hour12: false });
                        }
                        return date.toLocaleDateString('en-US', { timeZone: 'America/New_York', month: 'numeric', day: 'numeric' });
                      }}
                    />
                    <YAxis
                      tickFormatter={(v) => `$${Number(v).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
                    />
                    <RechartsTooltip
                      labelFormatter={(timestamp) => {
                        const ts = normalizeTimestamp(timestamp);
                        return ts ? new Date(ts).toLocaleString('en-US', { timeZone: 'America/New_York', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
                      }}
                      formatter={(value: any) => [`$${Number(value || 0).toFixed(2)}`, 'Portfolio Value']}
                    />
                    <Line type="monotone" dataKey="equity" stroke="#1890ff" strokeWidth={2} dot={false} name="Portfolio Value" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </Card>
      </div>

      {/* Alpaca Account Details */}
      {alpacaAccount && (
        <div style={{ marginBottom: 24 }}>
          <Title level={4}>Account Details</Title>
          <Card>
            <Descriptions column={{ xs: 1, sm: 2, lg: 3 }} size="small">
              <Descriptions.Item label="Account ID">{alpacaAccount.accountNumber || alpacaAccount.account_number || alpacaAccount.id || 'N/A'}</Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag color={alpacaAccount.status === 'ACTIVE' ? 'green' : 'red'}>{alpacaAccount.status || 'N/A'}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Currency">{alpacaAccount.currency || 'USD'}</Descriptions.Item>
              <Descriptions.Item label="Cash">${Number(alpacaAccount?.cash || 0).toFixed(2)}</Descriptions.Item>
              <Descriptions.Item label="Portfolio Value">${Number(alpacaAccount?.portfolioValue || alpacaAccount?.portfolio_value || alpacaAccount?.equity || 0).toFixed(2)}</Descriptions.Item>
              <Descriptions.Item label="Buying Power">${Number(alpacaAccount?.buyingPower || alpacaAccount?.buying_power || 0).toFixed(2)}</Descriptions.Item>
            </Descriptions>
          </Card>
        </div>
      )}

      {/* Positions */}
      <div style={{ marginBottom: 24 }}>
        <Title level={4}>Positions</Title>
        <Card>
          {alpacaPositions.length === 0 ? (
            <Empty description="No open positions" />
          ) : (
            <Table
              columns={positionsColumns}
              dataSource={alpacaPositions}
              rowKey="symbol"
              size="small"
              pagination={{ pageSize: 20 }}
            />
          )}
        </Card>
      </div>
    </div>
  );
};

export default Portfolio;
