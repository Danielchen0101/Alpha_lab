import React, { useState, useEffect } from 'react';
import {
  Card, Typography, Button, Divider, Table, Tag, Row, Col, Statistic,
  Select, Form, Input, Modal, Space, Descriptions,
  InputNumber, message, Tooltip
} from 'antd';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import {
  RobotOutlined, ReloadOutlined, PlusOutlined, DeleteOutlined, CheckOutlined
} from '@ant-design/icons';
import aiTradingService from '../services/aiTradingService';
import { aiAgentWatchlistAPI } from '../services/api';

const { Title, Text } = Typography;
const { Option } = Select;

const AI_AGENT_PRIMARY_BTN_STYLE: React.CSSProperties = { 
  borderRadius: '4px', 
  fontWeight: 600, 
  height: '32px', 
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const AI_AGENT_COMPACT_BTN_STYLE: React.CSSProperties = { 
  borderRadius: '4px', 
  fontWeight: 600, 
  height: '24px', 
  fontSize: '11px',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '0 8px'
};

const AITrading: React.FC = () => {
  // Account Snapshot 状态
  const [accountSnapshot, setAccountSnapshot] = useState({
    cash: 0, equity: 0, buyingPower: 0, portfolioValue: 0, 
    positionsCount: 0, openOrdersCount: 0, accountNumber: '', status: ''
  });
  
  // Alpaca 数据状态
  const [alpacaAccount, setAlpacaAccount] = useState<any>(null);
  const [alpacaPositions, setAlpacaPositions] = useState<any[]>([]);
  const [alpacaOrders, setAlpacaOrders] = useState<any[]>([]);
  const [alpacaOrdersHistory, setAlpacaOrdersHistory] = useState<any[]>([]);
  const [portfolioHistory, setPortfolioHistory] = useState<any[]>([]);
  const [portfolioRange, setPortfolioRange] = useState<string>('1D');
  const [portfolioChange, setPortfolioChange] = useState({ value: 0, percent: 0 });

  // 时间戳规范化函数
  const normalizeTimestamp = (timestamp: number | string): number | null => {
    const n = Number(timestamp);
    if (!Number.isFinite(n)) return null;
    return n < 1e12 ? n * 1000 : n;
  };

  // 处理投资组合时间范围变化
  const handlePortfolioRangeChange = async (range: string) => {
    console.log('🔄 handlePortfolioRangeChange called with range:', range);
    setPortfolioRange(range);
    
    try {
      console.log('📡 调用aiTradingService.getPortfolioHistory...');
      const response = await aiTradingService.getPortfolioHistory(range);
      console.log('📡 aiTradingService.getPortfolioHistory 返回:', {
        success: response.success,
        dataLength: response.data?.length,
        responseKeys: Object.keys(response),
        responseDataSample: response.data?.slice(0, 2)
      });
      
      if (response.success && response.data) {
        console.log('✅ 准备设置portfolioHistory，数据长度:', response.data.length);
        console.log('📊 前3个数据点:', response.data.slice(0, 3));
        setPortfolioHistory(response.data);
        
        // 计算变化
        if (response.data.length >= 2) {
          const firstValue = response.data[0]?.equity || 0;
          const lastValue = response.data[response.data.length - 1]?.equity || 0;
          const changeValue = lastValue - firstValue;
          const changePercent = firstValue !== 0 ? (changeValue / firstValue) * 100 : 0;
          
          setPortfolioChange({
            value: changeValue,
            percent: changePercent
          });
        } else {
          setPortfolioChange({
            value: 0,
            percent: 0
          });
        }
      } else {
        console.log('❌ aiTradingService.getPortfolioHistory 返回失败或无数据:', response);
      }
    } catch (error) {
      console.error('获取portfolio历史数据失败:', error);
    }
  };

  // 监控portfolioHistory state变化
  useEffect(() => {
    console.log('📊 portfolioHistory state 更新:', {
      length: portfolioHistory.length,
      firstPoint: portfolioHistory[0],
      lastPoint: portfolioHistory[portfolioHistory.length - 1],
      allPoints: portfolioHistory.slice(0, 3)
    });
  }, [portfolioHistory]);
  
  // 加载状态
  const [loadingData, setLoadingData] = useState({
    account: false,
    positions: false,
    orders: false,
    history: false,
    portfolio: false
  });

  // New Order 状态
  const [newOrderModalVisible, setNewOrderModalVisible] = useState(false);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [orderForm] = Form.useForm();

  // AI Entry Watchlist 状态
  const [watchlistItems, setWatchlistItems] = useState<any[]>([]);
  const [watchlistLoading, setWatchlistLoading] = useState(false);

  const loadWatchlist = async () => {
    setWatchlistLoading(true);
    try {
      const res = await aiAgentWatchlistAPI.list();
      if (res.data.success) {
        setWatchlistItems(res.data.items || []);
      }
    } catch (e) {
      console.error('Failed to load watchlist:', e);
    } finally {
      setWatchlistLoading(false);
    }
  };

  const removeWatchlistItem = async (id: string) => {
    try {
      const res = await aiAgentWatchlistAPI.remove(id);
      if (res.data.success) {
        message.success(res.data.message);
        loadWatchlist();
      }
    } catch (e: any) {
      message.error('Failed to remove: ' + (e?.message || 'Error'));
    }
  };

  const markWatchlistDone = async (id: string) => {
    try {
      await aiAgentWatchlistAPI.updateStatus(id, { status: 'DONE' });
      message.success('Marked as done');
      loadWatchlist();
    } catch (e: any) {
      message.error('Failed to update: ' + (e?.message || 'Error'));
    }
  };

  // 加载初始数据
  useEffect(() => {
    loadInitialData();
    loadWatchlist();
  }, []);

  const loadInitialData = async () => {
    try {
      console.log('开始加载初始数据...');
      
      // 加载账户快照
      const snapshot = await aiTradingService.getAccountSnapshot();
      
      if (snapshot) {
        setAccountSnapshot({
          ...snapshot,
          accountNumber: snapshot.accountNumber || 'PA3YPSJY0D4E',
          status: snapshot.status || 'ACTIVE'
        });
        console.log('账户快照加载成功');
      } else {
        console.error('账户快照加载失败');
      }
      
      // 使用统一刷新函数加载详细数据
      await refreshAllAlpacaData();
      
      console.log('初始数据加载完成');
    } catch (error) {
      console.error('加载初始数据失败:', error);
    }
  };

  // 统一刷新所有 Alpaca 数据
  const refreshAllAlpacaData = async () => {
    try {
      setLoadingData({
        account: true,
        positions: true,
        orders: true,
        history: true,
        portfolio: true
      });

      // 并行加载所有数据
      const [
        accountResponse,
        positionsResponse,
        ordersResponse,
        historyResponse,
        portfolioResponse
      ] = await Promise.allSettled([
        aiTradingService.getAlpacaAccount(),
        aiTradingService.getAlpacaPositions(),
        aiTradingService.getAlpacaOrders('open'),
        aiTradingService.getAlpacaOrdersHistory(50),
        aiTradingService.getPortfolioHistory(portfolioRange)
      ]);

      // 处理账户详情
      if (accountResponse.status === 'fulfilled' && accountResponse.value.success) {
        console.log('📋 Alpaca账户数据:', {
          raw: accountResponse.value,
          data: accountResponse.value.data,
          accountNumber: accountResponse.value.data?.accountNumber,
          id: accountResponse.value.data?.id,
          cash: accountResponse.value.data?.cash,
          equity: accountResponse.value.data?.equity,
          buyingPower: accountResponse.value.data?.buyingPower,
          portfolioValue: accountResponse.value.data?.portfolioValue
        });
        setAlpacaAccount(accountResponse.value.data);
      } else {
        console.log('❌ Alpaca账户数据获取失败:', accountResponse);
      }

      // 处理持仓
      if (positionsResponse.status === 'fulfilled' && positionsResponse.value.success) {
        setAlpacaPositions(positionsResponse.value.data || []);
      }

      // 处理未平仓订单
      if (ordersResponse.status === 'fulfilled' && ordersResponse.value.success) {
        setAlpacaOrders(ordersResponse.value.data || []);
      }

      // 处理订单历史
      if (historyResponse.status === 'fulfilled' && historyResponse.value.success) {
        setAlpacaOrdersHistory(historyResponse.value.data || []);
      }

      // 处理投资组合历史
      if (portfolioResponse.status === 'fulfilled' && portfolioResponse.value.success) {
        const portfolioData = portfolioResponse.value.data || [];
        console.log('🔍 Portfolio历史数据 - 详细检查:', {
          range: portfolioRange,
          响应状态: portfolioResponse.status,
          服务响应: portfolioResponse.value,
          数据长度: portfolioData.length,
          第一个点: portfolioData[0],
          最后一个点: portfolioData[portfolioData.length - 1],
          所有字段: portfolioData[0] ? Object.keys(portfolioData[0]) : '无数据'
        });
        
        // 检查数据点结构
        if (portfolioData.length > 0) {
          const firstPoint = portfolioData[0];
          console.log('🔍 第一个数据点详细结构:', {
            timestamp: firstPoint.timestamp,
            timestamp类型: typeof firstPoint.timestamp,
            equity: firstPoint.equity,
            equity类型: typeof firstPoint.equity,
            value: firstPoint.value,
            pnl: firstPoint.pnl,
            pnlPct: firstPoint.pnlPct,
            isMockData: firstPoint.isMockData
          });
        }
        
        setPortfolioHistory(portfolioData);
        
        // 计算投资组合变化
        if (portfolioData.length >= 2) {
          const firstValue = portfolioData[0]?.equity || 0;
          const lastValue = portfolioData[portfolioData.length - 1]?.equity || 0;
          const changeValue = lastValue - firstValue;
          const changePercent = firstValue !== 0 ? (changeValue / firstValue) * 100 : 0;
          
          console.log('📈 投资组合变化计算:', {
            firstValue,
            lastValue,
            changeValue,
            changePercent,
            数据点数量: portfolioData.length
          });
          
          setPortfolioChange({
            value: changeValue,
            percent: changePercent
          });
        } else if (portfolioData.length === 1) {
          // 只有一个数据点，变化为0
          console.log('⚠️ 只有一个数据点，变化为0');
          setPortfolioChange({
            value: 0,
            percent: 0
          });
        } else {
          console.log('❌ 没有数据点');
          setPortfolioChange({
            value: 0,
            percent: 0
          });
        }
      } else {
        // 使用类型断言处理 PromiseSettledResult
        const rejectedResponse = portfolioResponse as PromiseRejectedResult;
        console.log('❌ Portfolio历史数据获取失败:', {
          状态: portfolioResponse.status,
          原因: rejectedResponse.reason
        });
      }

      console.log('所有 Alpaca 数据刷新完成');
    } catch (error) {
      console.error('刷新 Alpaca 数据失败:', error);
      message.error('刷新数据失败');
    } finally {
      setLoadingData({
        account: false,
        positions: false,
        orders: false,
        history: false,
        portfolio: false
      });
    }
  };

  // New Order 处理函数
  const handlePlaceOrder = async (values: any) => {
    setPlacingOrder(true);
    try {
      console.log('提交订单:', values);
      
      // 构建订单请求
      const orderRequest = {
        symbol: values.symbol.toUpperCase(),
        side: values.side,
        qty: values.qty.toString(),
        type: values.type,
        time_in_force: values.time_in_force,
        ...(values.type === 'limit' && values.limit_price && { limit_price: values.limit_price.toString() })
      };

      console.log('订单请求:', orderRequest);
      
      // 调用后端下单接口
      const response = await aiTradingService.placeAlpacaOrder(orderRequest);
      
      if (response.success) {
        message.success(`Order placed successfully! Order ID: ${response.order?.id || 'N/A'}`);
        
        // 关闭模态框
        setNewOrderModalVisible(false);
        orderForm.resetFields();
        
        // 刷新所有数据
        await refreshAllAlpacaData();
        
        // 刷新账户快照
        const snapshot = await aiTradingService.getAccountSnapshot();
        setAccountSnapshot({
          ...snapshot,
          accountNumber: snapshot.accountNumber || 'PA3YPSJY0D4E',
          status: snapshot.status || 'ACTIVE'
        });
      } else {
        message.error(`Failed to place order: ${response.error || 'Unknown error'}`);
      }
    } catch (error: any) {
      console.error('下单失败:', error);
      message.error(`Order failed: ${error.message || 'Unknown error'}`);
    } finally {
      setPlacingOrder(false);
    }
  };

  // 持仓表格列定义 - 与Alpaca页面一致
  const positionsColumns = [
    { title: 'Asset', dataIndex: 'symbol', key: 'symbol' },
    { title: 'Price', dataIndex: 'currentPrice', key: 'currentPrice', render: (price: any) => {
      const num = Number(price);
      return Number.isFinite(num) ? `$${num.toFixed(2)}` : '-';
    }},
    { title: 'Qty', dataIndex: 'qty', key: 'qty', render: (qty: any) => {
      const num = Number(qty);
      return Number.isFinite(num) ? num.toFixed(2) : '-';
    }},
    { title: 'Side', dataIndex: 'side', key: 'side', render: (side: string) => (
      <Tag color={side === 'long' ? 'green' : 'red'}>{side.toUpperCase()}</Tag>
    )},
    { title: 'Market Value', dataIndex: 'marketValue', key: 'marketValue', render: (value: any) => {
      const num = Number(value);
      return Number.isFinite(num) ? `$${num.toFixed(2)}` : '-';
    }},
    { title: 'Avg Entry', dataIndex: 'avgEntryPrice', key: 'avgEntryPrice', render: (price: any) => {
      const num = Number(price);
      return Number.isFinite(num) ? `$${num.toFixed(2)}` : '-';
    }},
    { title: 'Cost Basis', dataIndex: 'costBasis', key: 'costBasis', render: (value: any) => {
      const num = Number(value);
      return Number.isFinite(num) ? `$${num.toFixed(2)}` : '-';
    }},
    { title: 'Today\'s P/L (%)', dataIndex: 'todayPlPercent', key: 'todayPlPercent', render: (percent: any) => {
      const num = Number(percent);
      return Number.isFinite(num) ? (
        <span style={{ color: num >= 0 ? '#3f8600' : '#cf1322' }}>
          {num >= 0 ? '+' : ''}{num.toFixed(2)}%
        </span>
      ) : '-';
    }},
    { title: 'Today\'s P/L ($)', dataIndex: 'todayPlValue', key: 'todayPlValue', render: (value: any) => {
      const num = Number(value);
      return Number.isFinite(num) ? (
        <span style={{ color: num >= 0 ? '#3f8600' : '#cf1322' }}>
          {num >= 0 ? '+' : ''}${num.toFixed(2)}
        </span>
      ) : '-';
    }},
    { title: 'Total P/L (%)', dataIndex: 'totalPlPercent', key: 'totalPlPercent', render: (percent: any) => {
      const num = Number(percent);
      return Number.isFinite(num) ? (
        <span style={{ color: num >= 0 ? '#3f8600' : '#cf1322' }}>
          {num >= 0 ? '+' : ''}{num.toFixed(2)}%
        </span>
      ) : '-';
    }},
    { title: 'Total P/L ($)', dataIndex: 'totalPlValue', key: 'totalPlValue', render: (value: any) => {
      const num = Number(value);
      return Number.isFinite(num) ? (
        <span style={{ color: num >= 0 ? '#3f8600' : '#cf1322' }}>
          {num >= 0 ? '+' : ''}${num.toFixed(2)}
        </span>
      ) : '-';
    }}
  ];

  // 未平仓订单表格列定义
  const openOrdersColumns = [
    { title: 'Symbol', dataIndex: 'symbol', key: 'symbol' },
    { title: 'Side', dataIndex: 'side', key: 'side', render: (side: string) => (
      <Tag color={side === 'buy' ? 'green' : 'red'}>{side.toUpperCase()}</Tag>
    )},
    { title: 'Qty', dataIndex: 'qty', key: 'qty' },
    { title: 'Type', dataIndex: 'type', key: 'type' },
    { title: 'Limit Price', dataIndex: 'limitPrice', key: 'limitPrice', render: (price: any) => {
      const num = Number(price);
      return Number.isFinite(num) ? `$${num.toFixed(2)}` : 'Market';
    }},
    { title: 'Status', dataIndex: 'status', key: 'status', render: (status: string) => (
      <Tag color={status === 'filled' ? 'green' : status === 'canceled' ? 'red' : 'blue'}>
        {status.toUpperCase()}
      </Tag>
    )},
    { title: 'Created', dataIndex: 'createdAt', key: 'createdAt', render: (time: string) => {
      if (!time) return 'N/A';
      const date = new Date(time);
      return date.toLocaleString('en-US', { timeZone: 'America/New_York' });
    }}
  ];

  // 订单历史表格列定义 - 与Alpaca页面一致
  const orderHistoryColumns = [
    { title: 'Time', dataIndex: 'submittedAt', key: 'submittedAt', render: (time: string) => {
      if (!time) return 'N/A';
      try {
        const date = new Date(time);
        return date.toLocaleString('en-US', { 
          timeZone: 'America/New_York',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        });
      } catch (e) {
        return 'Invalid Date';
      }
    }},
    { title: 'Symbol', dataIndex: 'symbol', key: 'symbol' },
    { title: 'Side', dataIndex: 'side', key: 'side', render: (side: string) => (
      <Tag color={side === 'buy' ? 'green' : 'red'}>{side.toUpperCase()}</Tag>
    )},
    { title: 'Qty', dataIndex: 'qty', key: 'qty', render: (qty: any) => {
      const num = Number(qty);
      return Number.isFinite(num) ? num.toString() : '-';
    }},
    { title: 'Type', dataIndex: 'type', key: 'type' },
    { title: 'Status', dataIndex: 'status', key: 'status', render: (status: string) => {
      const statusColors: Record<string, string> = {
        'filled': 'green',
        'canceled': 'red',
        'accepted': 'blue',
        'new': 'blue',
        'pending_new': 'orange',
        'pending_cancel': 'orange',
        'rejected': 'red',
        'expired': 'gray'
      };
      return (
        <Tag color={statusColors[status] || 'blue'}>
          {status.toUpperCase()}
        </Tag>
      );
    }},
    { title: 'Avg Fill Price', dataIndex: 'filledAvgPrice', key: 'filledAvgPrice', render: (price: any) => {
      const num = Number(price);
      return Number.isFinite(num) ? `$${num.toFixed(2)}` : '-';
    }},
    { title: 'Filled Qty', dataIndex: 'filledQty', key: 'filledQty', render: (qty: any) => {
      const num = Number(qty);
      return Number.isFinite(num) ? num.toString() : '-';
    }}
  ];

  return (
    <div>
      {/* 页面标题 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <Title level={2}><RobotOutlined style={{ marginRight: '12px' }} />Alpaca Trade</Title>
          <Text type="secondary">Monitor account, positions, orders, and place trades</Text>
        </div>
        <Button 
          type="primary" 
          icon={<ReloadOutlined />}
          onClick={refreshAllAlpacaData}
          loading={loadingData.account || loadingData.positions || loadingData.orders || loadingData.history}
          style={AI_AGENT_PRIMARY_BTN_STYLE}
        >
          Refresh All Alpaca Data
        </Button>
      </div>
      
      <Divider />

      {/* AI Entry Watchlist */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div>
            <Title level={4} style={{ margin: 0 }}>AI Entry Watchlist</Title>
            <Text type="secondary">Symbols added from Entry Plan for monitoring</Text>
          </div>
          <Button size="small" icon={<ReloadOutlined />} onClick={loadWatchlist} loading={watchlistLoading} style={AI_AGENT_COMPACT_BTN_STYLE}>Refresh</Button>
        </div>

        {watchlistItems.length === 0 ? (
          <Card size="small">
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <Text type="secondary">No items in watchlist. Use Entry Plan to add candidates.</Text>
            </div>
          </Card>
        ) : (
          <>
            {/* Summary cards */}
            <Row gutter={12} style={{ marginBottom: '12px' }}>
              <Col span={6}>
                <Card size="small" style={{ background: '#f6f8fa' }}>
                  <Statistic title="Active" value={watchlistItems.filter(w => w.status === 'ACTIVE').length} valueStyle={{ fontSize: '20px', color: '#1890ff' }} />
                </Card>
              </Col>
              <Col span={6}>
                <Card size="small" style={{ background: '#f6f8fa' }}>
                  <Statistic title="Ready Soon" value={watchlistItems.filter(w => w.finalAction === 'BUY_READY' || (w.riskGateStatus === 'PASS' && w.dataQuality === 'GOOD')).length} valueStyle={{ fontSize: '20px', color: '#52c41a' }} />
                </Card>
              </Col>
              <Col span={6}>
                <Card size="small" style={{ background: '#f6f8fa' }}>
                  <Statistic title="Review" value={watchlistItems.filter(w => w.riskGateStatus === 'REVIEW' || w.finalAction === 'WAIT_FOR_ENTRY').length} valueStyle={{ fontSize: '20px', color: '#d48806' }} />
                </Card>
              </Col>
              <Col span={6}>
                <Card size="small" style={{ background: '#f6f8fa' }}>
                  <Statistic title="Done / Archived" value={watchlistItems.filter(w => w.status !== 'ACTIVE').length} valueStyle={{ fontSize: '20px', color: '#8c8c8c' }} />
                </Card>
              </Col>
            </Row>

            {/* Table */}
            <Table
              dataSource={watchlistItems}
              rowKey="id"
              size="small"
              pagination={false}
              loading={watchlistLoading}
              scroll={{ x: 1200 }}
              columns={[
                { title: 'Symbol', dataIndex: 'symbol', key: 'symbol', width: 80, fixed: 'left' as const,
                  render: (text: string) => <span style={{ fontWeight: 600, fontSize: '13px' }}>{text}</span> },
                { title: 'Setup', dataIndex: 'setupType', key: 'setup', width: 110,
                  render: (t: string) => {
                    const c: Record<string, string> = { 'Pullback Entry': 'gold', 'Breakout Entry': 'purple', 'Range Support Entry': 'green', 'Watch Only': 'blue' };
                    return <Tag color={c[t] || 'default'} style={{ fontSize: '10px' }}>{t || '—'}</Tag>;
                  }},
                { title: 'AI', dataIndex: 'aiDecision', key: 'aiDecision', width: 65,
                  render: (d: string) => {
                    const c = d === 'BUY' ? 'green' : d === 'WATCH' ? 'gold' : 'red';
                    return <Tag color={c} style={{ fontSize: '10px' }}>{d || '—'}</Tag>;
                  }},
                { title: 'Cnf', dataIndex: 'confidence', key: 'confidence', width: 50,
                  render: (v: number) => <span style={{ fontSize: '11px' }}>{v != null ? `${v}%` : '—'}</span> },
                { title: 'Entry Zone', key: 'entryZone', width: 120,
                  render: (_: any, r: any) => r.entryZoneLow != null ? <span style={{ fontSize: '11px' }}>${r.entryZoneLow?.toFixed(2)} – ${r.entryZoneHigh?.toFixed(2)}</span> : <span style={{ color: '#ccc' }}>—</span> },
                { title: 'Stop', dataIndex: 'stopLoss', key: 'stop', width: 70,
                  render: (v: number) => v != null ? <span style={{ fontSize: '11px', color: '#e84749' }}>${v.toFixed(2)}</span> : '—' },
                { title: 'T1', dataIndex: 'takeProfit1', key: 'tp1', width: 70,
                  render: (v: number) => v != null ? <span style={{ fontSize: '11px', color: '#52c41a' }}>${v.toFixed(2)}</span> : '—' },
                { title: 'R/R', dataIndex: 'riskReward', key: 'rr', width: 55,
                  render: (v: number) => v != null ? <span style={{ fontSize: '11px' }}>{v.toFixed(1)}:1</span> : '—' },
                { title: 'Gate', dataIndex: 'riskGateStatus', key: 'gate', width: 70,
                  render: (s: string) => {
                    const c = s === 'PASS' ? 'green' : s === 'REVIEW' ? 'gold' : 'red';
                    return s ? <Tag color={c} style={{ fontSize: '9px' }}>{s}</Tag> : '—';
                  }},
                { title: 'Final', dataIndex: 'finalAction', key: 'final', width: 100,
                  render: (a: string) => {
                    const labels: Record<string, string> = { 'BUY_READY': 'BUY READY', 'WAIT_FOR_ENTRY': 'WAIT ENTRY', 'SKIP': 'SKIP', 'BLOCKED_BY_RISK': 'BLOCKED' };
                    const c = a === 'BUY_READY' ? 'green' : a === 'WAIT_FOR_ENTRY' ? 'gold' : 'red';
                    return <Tag color={c} style={{ fontSize: '9px' }}>{labels[a] || a || '—'}</Tag>;
                  }},
                { title: 'Next Step', dataIndex: 'nextStep', key: 'nextStep', width: 180, ellipsis: true,
                  render: (t: string) => (
                    <Tooltip title={t}>
                      <span style={{ fontSize: '10px', color: '#555' }}>{t || '—'}</span>
                    </Tooltip>
                  )},
                { title: 'Created', dataIndex: 'createdAt', key: 'created', width: 100,
                  render: (t: string) => {
                    if (!t) return '—';
                    try { return new Date(t).toLocaleDateString(); } catch { return t; }
                  }},
                {
                  title: 'Actions', key: 'actions', width: 90, fixed: 'right' as const,
                  render: (_: any, r: any) => (
                    <Space size="small">
                      <Tooltip title="Mark as Done"><Button size="small" type="text" icon={<CheckOutlined />} onClick={() => markWatchlistDone(r.id)} style={{ color: '#52c41a' }} /></Tooltip>
                      <Tooltip title="Remove"><Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => removeWatchlistItem(r.id)} /></Tooltip>
                    </Space>
                  ),
                },
              ]}
            />
          </>
        )}
      </div>

      <Divider />

      {/* Account Snapshot */}
      <div style={{ marginBottom: 24 }}>
        <Title level={4}>Account Snapshot</Title>
        <Card 
          size="small" 
          title="Account Snapshot" 
          style={{ marginTop: '16px' }}
          extra={
            <Button 
              type="primary" 
              size="small"
              icon={<PlusOutlined />}
              onClick={() => setNewOrderModalVisible(true)}
            >
              New Order
            </Button>
          }
        >
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12} lg={6}>
              <Statistic title="Cash" value={accountSnapshot.cash} prefix="$" />
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Statistic title="Equity" value={accountSnapshot.equity} prefix="$" />
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Statistic title="Buying Power" value={accountSnapshot.buyingPower} prefix="$" />
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Statistic title="Portfolio Value" value={accountSnapshot.portfolioValue} prefix="$" />
            </Col>
          </Row>
          <div style={{ marginTop: '16px' }}>
            <Text type="secondary">
              Account: {accountSnapshot.accountNumber} | Status: {accountSnapshot.status} | 
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
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <Text type="secondary">No portfolio history available</Text>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div>
                  <Select value={portfolioRange} onChange={handlePortfolioRangeChange} style={{ width: 120 }}>
                    <Option value="1D">1 Day</Option>
                    <Option value="1W">1 Week</Option>
                    <Option value="1M">1 Month</Option>
                    <Option value="1Y">1 Year</Option>
                    <Option value="All">All</Option>
                  </Select>
                </div>
                <div>
                  <Text strong style={{ fontSize: '16px', marginRight: '16px' }}>
                    Change: 
                    <span style={{ color: portfolioChange.value >= 0 ? '#3f8600' : '#cf1322', marginLeft: '8px' }}>
                      {portfolioChange.value >= 0 ? '+' : ''}${Number(portfolioChange.value || 0).toFixed(2)} ({Number(portfolioChange.percent || 0).toFixed(2)}%)
                    </span>
                  </Text>
                </div>
              </div>
              
              {/* 临时数据验证显示 */}
              <div style={{ marginBottom: '16px', padding: '12px', backgroundColor: '#f6f6f6', borderRadius: '4px' }}>
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  Data Validation: Points: {portfolioHistory.length} | 
                  First: {portfolioHistory.length > 0 ? new Date(normalizeTimestamp(portfolioHistory[0]?.timestamp) || 0).toLocaleString('en-US', { timeZone: 'America/New_York' }) : 'N/A'} | 
                  Last: {portfolioHistory.length > 0 ? new Date(normalizeTimestamp(portfolioHistory[portfolioHistory.length - 1]?.timestamp) || 0).toLocaleString('en-US', { timeZone: 'America/New_York' }) : 'N/A'} | 
                  First Equity: {portfolioHistory.length > 0 && portfolioHistory[0]?.equity !== undefined ? `$${Number(portfolioHistory[0].equity).toFixed(2)}` : 'N/A'} | 
                  Last Equity: {portfolioHistory.length > 0 && portfolioHistory[portfolioHistory.length - 1]?.equity !== undefined ? `$${Number(portfolioHistory[portfolioHistory.length - 1].equity).toFixed(2)}` : 'N/A'}
                </Text>
              </div>
              
              <div style={{ height: 260 }}>
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
                          // 1D显示小时:分钟
                          return date.toLocaleTimeString('en-US', { 
                            timeZone: 'America/New_York',
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: false
                          });
                        } else if (portfolioRange === '1W') {
                          // 1W显示月/日 小时
                          return date.toLocaleString('en-US', { 
                            timeZone: 'America/New_York',
                            month: 'numeric',
                            day: 'numeric',
                            hour: '2-digit',
                            hour12: false
                          });
                        } else {
                          // 1M/1Y/All显示月/日/年
                          return date.toLocaleString('en-US', { 
                            timeZone: 'America/New_York',
                            month: 'numeric',
                            day: 'numeric',
                            year: '2-digit'
                          });
                        }
                      }}
                    />
                    <YAxis 
                      domain={(() => {
                        const values = portfolioHistory
                          .map(d => Number(d?.equity))
                          .filter(v => Number.isFinite(v));
                        
                        if (values.length === 0) return ['auto', 'auto'] as ['auto', 'auto'];
                        
                        const min = Math.min(...values);
                        const max = Math.max(...values);
                        
                        if (min === max) {
                          return [min - 1, max + 1] as [number, number];
                        } else {
                          const pad = Math.max((max - min) * 0.1, 1);
                          return [min - pad, max + pad] as [number, number];
                        }
                      })()}
                      tickFormatter={(value) => `$${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    />
                    <RechartsTooltip
                      labelFormatter={(timestamp) => {
                        const ts = normalizeTimestamp(timestamp);
                        if (!ts) return 'Invalid Date';
                        
                        const date = new Date(ts);
                        return date.toLocaleString('en-US', { 
                          timeZone: 'America/New_York',
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                          hour12: false
                        });
                      }}
                      formatter={(value) => [`$${Number(value || 0).toFixed(2)}`, 'Portfolio Value']}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="equity" 
                      stroke="#1890ff" 
                      strokeWidth={2}
                      dot={false}
                      name="Portfolio Value"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              
              {/* 临时数据表格验证 */}
              {portfolioHistory.length > 0 && (
                <div style={{ marginTop: '16px' }}>
                  <Text type="secondary" style={{ fontSize: '12px', marginBottom: '8px' }}>Data Sample (first 5 points):</Text>
                  <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f0f0f0' }}>
                        <th style={{ padding: '4px', textAlign: 'left' }}>Index</th>
                        <th style={{ padding: '4px', textAlign: 'left' }}>Timestamp</th>
                        <th style={{ padding: '4px', textAlign: 'left' }}>ET Time</th>
                        <th style={{ padding: '4px', textAlign: 'left' }}>Equity</th>
                      </tr>
                    </thead>
                    <tbody>
                      {portfolioHistory.slice(0, 5).map((point, index) => {
                        const ts = normalizeTimestamp(point?.timestamp);
                        return (
                          <tr key={index} style={{ borderBottom: '1px solid #eee' }}>
                            <td style={{ padding: '4px' }}>{index}</td>
                            <td style={{ padding: '4px' }}>{point?.timestamp || 'N/A'}</td>
                            <td style={{ padding: '4px' }}>
                              {ts ? new Date(ts).toLocaleString('en-US', { 
                                timeZone: 'America/New_York',
                                hour12: false 
                              }) : 'Invalid'}
                            </td>
                            <td style={{ padding: '4px' }}>${point?.equity !== undefined ? Number(point.equity).toFixed(2) : 'N/A'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </Card>
      </div>
      
      {/* Alpaca Account Details */}
      <div style={{ marginBottom: 24 }}>
        <Title level={4}>Alpaca Account Details</Title>
        {alpacaAccount && (
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
        )}
      </div>
      
      {/* Positions */}
      <div style={{ marginBottom: 24 }}>
        <Title level={4}>Positions</Title>
        <Card loading={loadingData.positions}>
          <Table 
            columns={positionsColumns} 
            dataSource={alpacaPositions} 
            rowKey="symbol"
            size="small"
            pagination={{ pageSize: 10 }}
          />
        </Card>
      </div>
      
      {/* Open Orders */}
      <div style={{ marginBottom: 24 }}>
        <Title level={4}>Open Orders</Title>
        <Card loading={loadingData.orders}>
          <Table 
            columns={openOrdersColumns} 
            dataSource={alpacaOrders} 
            rowKey="id"
            size="small"
            pagination={{ pageSize: 5 }}
          />
        </Card>
      </div>
      
      {/* Order History */}
      <div style={{ marginBottom: 24 }}>
        <Title level={4}>Order History</Title>
        <Card loading={loadingData.history}>
          <Table 
            columns={orderHistoryColumns} 
            dataSource={alpacaOrdersHistory} 
            rowKey="id"
            size="small"
            pagination={{ pageSize: 10 }}
          />
        </Card>
      </div>
      
      {/* New Order Modal */}
      <Modal
        title="New Order"
        open={newOrderModalVisible}
        onCancel={() => {
          setNewOrderModalVisible(false);
          orderForm.resetFields();
        }}
        onOk={() => orderForm.submit()}
        confirmLoading={placingOrder}
        width={600}
      >
        <Form
          form={orderForm}
          layout="vertical"
          onFinish={handlePlaceOrder}
          initialValues={{
            side: 'buy',
            type: 'market',
            time_in_force: 'day',
            qty: 1
          }}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="symbol"
                label="Symbol"
                rules={[{ required: true, message: 'Please enter symbol' }]}
              >
                <Input placeholder="e.g., AAPL" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="side"
                label="Side"
                rules={[{ required: true, message: 'Please select side' }]}
              >
                <Select style={{ width: '100%' }}>
                  <Option value="buy">Buy</Option>
                  <Option value="sell">Sell</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="qty"
                label="Quantity"
                rules={[{ required: true, message: 'Please enter quantity' }]}
              >
                <InputNumber 
                  min={1} 
                  style={{ width: '100%' }} 
                  placeholder="e.g., 10" 
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="type"
                label="Order Type"
                rules={[{ required: true, message: 'Please select order type' }]}
              >
                <Select style={{ width: '100%' }}>
                  <Option value="market">Market</Option>
                  <Option value="limit">Limit</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) => prevValues.type !== currentValues.type}
          >
            {({ getFieldValue }) => 
              getFieldValue('type') === 'limit' ? (
                <Form.Item
                  name="limit_price"
                  label="Limit Price"
                  rules={[{ required: true, message: 'Please enter limit price' }]}
                >
                  <InputNumber 
                    min={0.01} 
                    step={0.01} 
                    style={{ width: '100%' }} 
                    placeholder="e.g., 150.50" 
                  />
                </Form.Item>
              ) : null
            }
          </Form.Item>

          <Form.Item
            name="time_in_force"
            label="Time in Force"
            rules={[{ required: true, message: 'Please select time in force' }]}
          >
            <Select style={{ width: '100%' }}>
              <Option value="day">Day</Option>
              <Option value="gtc">Good Till Canceled (GTC)</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default AITrading;