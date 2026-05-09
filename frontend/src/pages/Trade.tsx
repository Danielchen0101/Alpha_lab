import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Typography, Button, Divider, Table, Tag, Row, Col, Statistic,
  Select, message, Tooltip, Empty, Modal, Alert, Spin
} from 'antd';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import {
  RobotOutlined, ReloadOutlined, PlusOutlined, DeleteOutlined,
  EyeOutlined, ThunderboltOutlined, ClockCircleOutlined, CheckCircleOutlined,
  ShoppingCartOutlined, SwapOutlined, StopOutlined, SafetyOutlined,
  ArrowUpOutlined, ArrowDownOutlined
} from '@ant-design/icons';
import { aiAgentWatchlistAPI, tradingAccountAPI } from '../services/api';
import OrderModal from '../components/OrderModal';
import { useLanguage } from '../contexts/LanguageContext';

const { Title, Text } = Typography;
const { Option } = Select;

const Trade: React.FC = () => {
  const { t } = useLanguage();

  // Account Snapshot 状态
  const [accountSnapshot, setAccountSnapshot] = useState({
    cash: 0, equity: 0, buyingPower: 0, portfolioValue: 0, 
    positionsCount: 0, openOrdersCount: 0, accountNumber: '', status: ''
  });
  
  // Alpaca 数据状态
  const [alpacaPositions, setAlpacaPositions] = useState<any[]>([]);
  const [alpacaOrders, setAlpacaOrders] = useState<any[]>([]);
  const [alpacaOrdersHistory, setAlpacaOrdersHistory] = useState<any[]>([]);
  const [portfolioHistory, setPortfolioHistory] = useState<any[]>([]);
  const [portfolioRange, setPortfolioRange] = useState<string>('1D');
  const [portfolioChange, setPortfolioChange] = useState({ value: 0, percent: 0 });
  const [portfolioError, setPortfolioError] = useState<string | null>(null);

  // 时间戳规范化函数
  const normalizeTimestamp = (timestamp: number | string): number | null => {
    const n = Number(timestamp);
    if (!Number.isFinite(n)) return null;
    return n < 1e12 ? n * 1000 : n;
  };

  // 处理投资组合时间范围变化
  const handlePortfolioRangeChange = async (range: string) => {
    setPortfolioRange(range);
    setPortfolioError(null);
    try {
      const response = await tradingAccountAPI.getPortfolioHistory(tradeMode, range);
      const resBody = response.data;
      if (resBody && typeof resBody === 'object' && resBody.success) {
        const raw = resBody.data || [];
        const normalizedData = raw
          .map((item: any) => {
            let timestamp = item.timestamp;
            if (typeof timestamp === 'number' && timestamp < 1e12) timestamp = timestamp * 1000;
            return { timestamp, equity: Number(item.equity || 0) };
          })
          .filter((item: any) => item.timestamp && Number.isFinite(item.equity));
        setPortfolioHistory(normalizedData);
        if (normalizedData.length >= 2) {
          const first = normalizedData[0]?.equity || 0;
          const last = normalizedData[normalizedData.length - 1]?.equity || 0;
          setPortfolioChange({ value: last - first, percent: first !== 0 ? ((last - first) / first) * 100 : 0 });
        } else {
          setPortfolioChange({ value: 0, percent: 0 });
        }
      } else {
        setPortfolioHistory([]);
        setPortfolioChange({ value: 0, percent: 0 });
        const errMsg = (resBody as any)?.message || resBody?.error || 'Unknown error';
        if ((resBody as any)?.reason === 'config_required' || errMsg?.includes('not configured')) {
          setPortfolioError(t.trade.credentialsNotConfigured.replace('{mode}', tradeMode === 'paper' ? t.trade.paperLabel : t.trade.liveLabel));
        } else {
          setPortfolioError(errMsg);
        }
      }
    } catch (error: any) {
      console.error('Portfolio history fetch failed:', error);
      setPortfolioHistory([]);
      setPortfolioChange({ value: 0, percent: 0 });
      setPortfolioError(error?.message || 'Network error');
    }
  };

  // 加载状态
  const [loadingData, setLoadingData] = useState({
    account: false,
    positions: false,
    orders: false,
    history: false,
    portfolio: false
  });

  // Order Modal 状态
  const [orderModalVisible, setOrderModalVisible] = useState(false);
  const [orderModalPreset, setOrderModalPreset] = useState<{
    symbol?: string;
    side?: 'buy' | 'sell';
    qty?: number;
    limitPrice?: number;
    takeProfitPrice?: number;
    stopLossPrice?: number;
  }>({});
  const [tradeMode, setTradeMode] = useState<'paper' | 'real'>('paper');

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
      message.error(t.trade.removeFailed + ': ' + (e?.message || 'Error'));
    }
  };

  // 切换 Trade Mode
  const handleTradeModeChange = async (mode: 'paper' | 'real') => {
    setTradeMode(mode);
    await refreshAllAlpacaData(mode);
  };

  // Cancel open order
  const handleCancelOrder = async (orderId: string, symbol: string) => {
    const modeLabel = tradeMode === 'real' ? 'LIVE' : 'Paper';
    Modal.confirm({
      title: t.trade.cancelOrderTitle.replace('{symbol}', symbol),
      content: tradeMode === 'real'
        ? t.trade.cancelOrderLiveDesc
        : t.trade.cancelOrderPaperDesc.replace('{mode}', modeLabel),
      okText: tradeMode === 'real' ? t.trade.cancelLiveOrder : t.trade.cancelOrder,
      okButtonProps: { danger: true },
      cancelText: t.trade.keepOrder,
      onOk: async () => {
        try {
          const res = await tradingAccountAPI.cancelOrder(orderId, tradeMode);
          if (res.data.success) {
            message.success(t.trade.orderCancelled);
            await refreshAllAlpacaData();
          } else {
            message.error(res.data.error || t.trade.cancelFailed);
          }
        } catch (e: any) {
          message.error(e?.response?.data?.error || e?.message || t.trade.cancelFailed);
        }
      },
    });
  };

  // 统一刷新所有 Alpaca 数据（按当前 tradeMode）
  const refreshAllAlpacaData = useCallback(async (mode?: string) => {
    const m = mode || tradeMode;
    try {
      setLoadingData({ account: true, positions: true, orders: true, history: true, portfolio: true });
      setPortfolioError(null);

      const [accountRes, positionsRes, ordersRes, historyRes, portfolioRes] = await Promise.allSettled([
        tradingAccountAPI.getAccount(m as 'paper' | 'real'),
        tradingAccountAPI.getPositions(m as 'paper' | 'real'),
        tradingAccountAPI.getOrders(m as 'paper' | 'real', 'open'),
        tradingAccountAPI.getOrders(m as 'paper' | 'real', 'all'),
        tradingAccountAPI.getPortfolioHistory(m as 'paper' | 'real', portfolioRange),
      ]);

      // Account — flat response, no .data wrapper
      if (accountRes.status === 'fulfilled' && accountRes.value.data.success) {
        const d = accountRes.value.data;
        setAccountSnapshot({
          cash: d.cash || 0, equity: d.equity || 0, buyingPower: d.buyingPower || 0,
          portfolioValue: d.portfolioValue || 0, positionsCount: 0, openOrdersCount: 0,
          accountNumber: d.id || '', status: d.status || '',
        });
      } else {
        const err = accountRes.status === 'rejected' ? accountRes.reason : accountRes.value.data.error;
        console.error(`[${m}] Account fetch failed:`, err);
      }

      // Positions — response.data.positions (camelCase normalized by backend)
      if (positionsRes.status === 'fulfilled' && positionsRes.value.data.success) {
        const positions = (positionsRes.value.data.positions || []).map((p: any) => ({
          ...p,
          todayPlPercent: p.todayPlPercent ?? p.unrealizedPLPercent ?? 0,
          todayPlValue: p.todayPlValue ?? 0,
          totalPlPercent: p.unrealizedPLPercent ?? 0,
          totalPlValue: p.unrealizedPL ?? 0,
        }));
        setAlpacaPositions(positions);
        setAccountSnapshot(prev => ({ ...prev, positionsCount: positions.length }));
      } else {
        setAlpacaPositions([]);
      }

      // Open Orders — response.data.orders
      if (ordersRes.status === 'fulfilled' && ordersRes.value.data.success) {
        const orders = (ordersRes.value.data.orders || []).map((o: any) => ({
          id: o.id, symbol: o.symbol, qty: o.qty, side: o.side, type: o.type,
          limitPrice: o.limit_price, stopPrice: o.stop_price,
          status: o.status, createdAt: o.created_at, timeInForce: o.time_in_force,
        }));
        setAlpacaOrders(orders);
        setAccountSnapshot(prev => ({ ...prev, openOrdersCount: orders.length }));
      } else {
        setAlpacaOrders([]);
      }

      // Order History — same endpoint, status=all
      if (historyRes.status === 'fulfilled' && historyRes.value.data.success) {
        const history = (historyRes.value.data.orders || []).map((o: any) => ({
          id: o.id, symbol: o.symbol, qty: o.qty, side: o.side, type: o.type,
          status: o.status, filledAvgPrice: o.filled_avg_price, filledQty: o.filled_qty,
          submittedAt: o.created_at, timeInForce: o.time_in_force,
        }));
        setAlpacaOrdersHistory(history);
      } else {
        setAlpacaOrdersHistory([]);
      }

      // Portfolio History
      if (portfolioRes.status === 'fulfilled') {
        const resBody = portfolioRes.value?.data;
        if (resBody && typeof resBody === 'object' && resBody.success) {
          const raw = resBody.data || [];
          const normalized = raw
            .map((item: any) => {
              let ts = item.timestamp;
              if (typeof ts === 'number' && ts < 1e12) ts = ts * 1000;
              return { timestamp: ts, equity: Number(item.equity || 0) };
            })
            .filter((item: any) => item.timestamp && Number.isFinite(item.equity));
          setPortfolioHistory(normalized);
          setPortfolioError(null);
          if (normalized.length >= 2) {
            const first = normalized[0].equity;
            const last = normalized[normalized.length - 1].equity;
            setPortfolioChange({ value: last - first, percent: first !== 0 ? ((last - first) / first) * 100 : 0 });
          } else {
            setPortfolioChange({ value: 0, percent: 0 });
          }
        } else {
          // Backend returned success=false or malformed response
          const errMsg = (resBody as any)?.message || resBody?.error || (resBody as any)?.reason || 'Unknown error from portfolio history endpoint';
          setPortfolioHistory([]);
          setPortfolioChange({ value: 0, percent: 0 });
          if ((resBody as any)?.reason === 'config_required' || errMsg?.includes('not configured')) {
            setPortfolioError(t.trade.credentialsNotConfigured.replace('{mode}', m === 'paper' ? t.trade.paperLabel : t.trade.liveLabel));
          } else {
            setPortfolioError(errMsg);
          }
        }
      } else {
        // HTTP-level failure (network error, timeout, etc.)
        const reason = portfolioRes.reason;
        setPortfolioHistory([]);
        setPortfolioChange({ value: 0, percent: 0 });
        setPortfolioError(reason?.message || 'Failed to reach portfolio history endpoint');
      }
    } catch (error) {
      console.error('Failed to refresh Alpaca data:', error);
      message.error(t.trade.refreshFailed);
    } finally {
      setLoadingData({ account: false, positions: false, orders: false, history: false, portfolio: false });
    }
  }, [tradeMode, portfolioRange]);

  useEffect(() => {
    refreshAllAlpacaData();
    loadWatchlist();
  }, [refreshAllAlpacaData]);

  // Order Modal helpers
  const openOrderModal = (preset?: typeof orderModalPreset) => {
    setOrderModalPreset(preset || {});
    setOrderModalVisible(true);
  };

  const handleOrderSuccess = async () => {
    message.success(t.trade.orderPlaced);
    await refreshAllAlpacaData();
  };

  // 持仓表格列定义 - 与Alpaca页面一致
  const positionsColumns = [
    { title: t.trade.colAsset, dataIndex: 'symbol', key: 'symbol' },
    { title: t.trade.colPrice, dataIndex: 'currentPrice', key: 'currentPrice', render: (price: any) => {
      const num = Number(price);
      return Number.isFinite(num) ? `$${num.toFixed(2)}` : '-';
    }},
    { title: t.trade.colQty, dataIndex: 'qty', key: 'qty', render: (qty: any) => {
      const num = Number(qty);
      return Number.isFinite(num) ? num.toFixed(2) : '-';
    }},
    { title: t.trade.colSide, dataIndex: 'side', key: 'side', render: (side: string) => (
      <Tag color={side === 'long' ? 'green' : 'red'}>{side.toUpperCase()}</Tag>
    )},
    { title: t.trade.colMarketValue, dataIndex: 'marketValue', key: 'marketValue', render: (value: any) => {
      const num = Number(value);
      return Number.isFinite(num) ? `$${num.toFixed(2)}` : '-';
    }},
    { title: t.trade.colAvgEntry, dataIndex: 'avgEntryPrice', key: 'avgEntryPrice', render: (price: any) => {
      const num = Number(price);
      return Number.isFinite(num) ? `$${num.toFixed(2)}` : '-';
    }},
    { title: t.trade.colCostBasis, dataIndex: 'costBasis', key: 'costBasis', render: (value: any) => {
      const num = Number(value);
      return Number.isFinite(num) ? `$${num.toFixed(2)}` : '-';
    }},
    { title: t.trade.colTodayPLPct, dataIndex: 'todayPlPercent', key: 'todayPlPercent', render: (percent: any) => {
      const num = Number(percent);
      return Number.isFinite(num) ? (
        <span style={{ color: num >= 0 ? '#3f8600' : '#cf1322' }}>
          {num >= 0 ? '+' : ''}{num.toFixed(2)}%
        </span>
      ) : '-';
    }},
    { title: t.trade.colTodayPL, dataIndex: 'todayPlValue', key: 'todayPlValue', render: (value: any) => {
      const num = Number(value);
      return Number.isFinite(num) ? (
        <span style={{ color: num >= 0 ? '#3f8600' : '#cf1322' }}>
          {num >= 0 ? '+' : ''}${num.toFixed(2)}
        </span>
      ) : '-';
    }},
    { title: t.trade.colTotalPLPct, dataIndex: 'totalPlPercent', key: 'totalPlPercent', render: (percent: any) => {
      const num = Number(percent);
      return Number.isFinite(num) ? (
        <span style={{ color: num >= 0 ? '#3f8600' : '#cf1322' }}>
          {num >= 0 ? '+' : ''}{num.toFixed(2)}%
        </span>
      ) : '-';
    }},
    { title: t.trade.colTotalPL, dataIndex: 'totalPlValue', key: 'totalPlValue', render: (value: any) => {
      const num = Number(value);
      return Number.isFinite(num) ? (
        <span style={{ color: num >= 0 ? '#3f8600' : '#cf1322' }}>
          {num >= 0 ? '+' : ''}${num.toFixed(2)}
        </span>
      ) : '-';
    }},
    { title: '', key: 'action', width: 80, render: (_: any, record: any) => (
      <Button
        size="small"
        danger
        icon={<SwapOutlined />}
        onClick={() => openOrderModal({
          symbol: record.symbol,
          side: 'sell',
          qty: Number(record.qty) || undefined,
        })}
      >
        {t.trade.sell}
      </Button>
    )}
  ];

  // 未平仓订单表格列定义
  const openOrdersColumns = [
    { title: t.trade.colSymbol, dataIndex: 'symbol', key: 'symbol', render: (v: string) => <span style={{ fontWeight: 700 }}>{v}</span> },
    { title: t.trade.colSide, dataIndex: 'side', key: 'side', render: (side: string) => (
      <Tag color={side === 'buy' ? 'green' : 'red'}>{side.toUpperCase()}</Tag>
    )},
    { title: t.trade.colQty, dataIndex: 'qty', key: 'qty' },
    { title: t.trade.colType, dataIndex: 'type', key: 'type' },
    { title: t.trade.colLimitPrice, dataIndex: 'limitPrice', key: 'limitPrice', render: (price: any) => {
      const num = Number(price);
      return Number.isFinite(num) ? `$${num.toFixed(2)}` : '-';
    }},
    { title: t.trade.colStopPrice, dataIndex: 'stopPrice', key: 'stopPrice', render: (price: any) => {
      const num = Number(price);
      return Number.isFinite(num) ? `$${num.toFixed(2)}` : '-';
    }},
    { title: t.trade.colTIF, dataIndex: 'timeInForce', key: 'tif', render: (v: string) => (v || '').toUpperCase() },
    { title: t.trade.statusLabel, dataIndex: 'status', key: 'status', render: (status: string) => (
      <Tag color={status === 'filled' ? 'green' : status === 'canceled' ? 'red' : 'blue'}>
        {status.toUpperCase()}
      </Tag>
    )},
    { title: t.trade.colCreated, dataIndex: 'createdAt', key: 'createdAt', render: (time: string) => {
      if (!time) return 'N/A';
      const date = new Date(time);
      return date.toLocaleString('en-US', { timeZone: 'America/New_York' });
    }},
    { title: '', key: 'action', width: 80, render: (_: any, record: any) => (
      <Button size="small" danger icon={<StopOutlined />} onClick={() => handleCancelOrder(record.id, record.symbol)}>
        {t.trade.cancel}
      </Button>
    )},
  ];

  // 订单历史表格列定义 - 与Alpaca页面一致
  const orderHistoryColumns = [
    { title: t.trade.colTime, dataIndex: 'submittedAt', key: 'submittedAt', render: (time: string) => {
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
        return t.trade.invalidDate;
      }
    }},
    { title: t.trade.colSymbol, dataIndex: 'symbol', key: 'symbol' },
    { title: t.trade.colSide, dataIndex: 'side', key: 'side', render: (side: string) => (
      <Tag color={side === 'buy' ? 'green' : 'red'}>{side.toUpperCase()}</Tag>
    )},
    { title: t.trade.colQty, dataIndex: 'qty', key: 'qty', render: (qty: any) => {
      const num = Number(qty);
      return Number.isFinite(num) ? num.toString() : '-';
    }},
    { title: t.trade.colType, dataIndex: 'type', key: 'type' },
    { title: t.trade.statusLabel, dataIndex: 'status', key: 'status', render: (status: string) => {
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
    { title: t.trade.colAvgFillPrice, dataIndex: 'filledAvgPrice', key: 'filledAvgPrice', render: (price: any) => {
      const num = Number(price);
      return Number.isFinite(num) ? `$${num.toFixed(2)}` : '-';
    }},
    { title: t.trade.colFilledQty, dataIndex: 'filledQty', key: 'filledQty', render: (qty: any) => {
      const num = Number(qty);
      return Number.isFinite(num) ? num.toString() : '-';
    }}
  ];

  return (
    <div>
      {/* 页面标题 + Trade Mode */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
              <div style={{ 
                width: 40, height: 40, borderRadius: 10, 
                background: 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)', 
                color: '#fff', display: 'flex', alignItems: 'center', 
                justifyContent: 'center', fontSize: 20,
                boxShadow: '0 4px 10px rgba(24, 144, 255, 0.2)'
              }}>
                <RobotOutlined />
              </div>
              <Title level={2} style={{ margin: 0, fontWeight: 800, color: '#111827', letterSpacing: '-0.5px' }}>{t.trade.title}</Title>
            </div>
            <Text type="secondary" style={{ fontSize: 14, fontWeight: 500, color: '#6b7280' }}>{t.trade.subtitle}</Text>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', background: '#f3f4f6', padding: '4px', borderRadius: 8, border: '1px solid #e5e7eb' }}>
              <div 
                onClick={() => handleTradeModeChange('paper')}
                style={{ 
                  padding: '6px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', borderRadius: 6,
                  transition: 'all 0.2s', color: tradeMode === 'paper' ? '#096dd9' : '#6b7280',
                  background: tradeMode === 'paper' ? '#fff' : 'transparent',
                  boxShadow: tradeMode === 'paper' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                }}
              >
                {t.trade.paperTrading}
              </div>
              <div 
                onClick={() => handleTradeModeChange('real')}
                style={{ 
                  padding: '6px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', borderRadius: 6,
                  transition: 'all 0.2s', color: tradeMode === 'real' ? '#dc2626' : '#6b7280',
                  background: tradeMode === 'real' ? '#fff' : 'transparent',
                  boxShadow: tradeMode === 'real' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                }}
              >
                {t.trade.liveTrading}
              </div>
            </div>
            <Button
              size="middle"
              icon={<ReloadOutlined />}
              onClick={() => refreshAllAlpacaData()}
              loading={loadingData.account || loadingData.positions || loadingData.orders || loadingData.portfolio}
              style={{ borderRadius: 8, height: 34, fontWeight: 600, color: '#4b5563', border: '1px solid #e5e7eb' }}
            >
              {t.trade.refreshData}
            </Button>
          </div>
        </div>
      </div>

      {tradeMode === 'real' && (
        <Alert
          message={t.trade.realModeTitle}
          description={t.trade.realModeDesc}
          type="error"
          showIcon
          icon={<SafetyOutlined />}
          style={{ marginBottom: 24, borderRadius: 10, border: '1px solid #ffa39e' }}
        />
      )}

      {/* AI Entry Watchlist */}
      <div style={{ marginBottom: 24 }}>
        <Card
          className="premium-card"
          title={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ 
                  width: 34, height: 34, borderRadius: 8, 
                  background: 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)', 
                  color: '#fff', display: 'flex', alignItems: 'center', 
                  justifyContent: 'center', fontSize: 18,
                  boxShadow: '0 2px 8px rgba(24, 144, 255, 0.2)'
                }}>
                  <EyeOutlined />
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#111827', lineHeight: 1.2 }}>{t.trade.watchlistTitle}</div>
                  <div style={{ fontSize: 10, color: '#8c8c8c', fontWeight: 500 }}>{t.trade.watchlistSubtitle}</div>
                </div>
                <Tag color="blue" bordered={false} style={{ fontSize: 10, fontWeight: 800, borderRadius: 6, marginLeft: 4 }}>{watchlistItems.length}</Tag>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Tag color="blue" bordered={false} style={{ fontSize: 9, margin: 0, fontWeight: 700, borderRadius: 4 }}>ALPACA REAL-TIME</Tag>
                <Divider type="vertical" style={{ height: 20 }} />
                <Button 
                  size="middle" 
                  icon={<ReloadOutlined spin={watchlistLoading} />} 
                  onClick={loadWatchlist} 
                  loading={watchlistLoading} 
                  style={{ borderRadius: 8, height: 32, fontSize: 12, fontWeight: 600, color: '#6b7280', border: '1px solid #e5e7eb' }}
                >
                  {t.trade.refresh}
                </Button>
              </div>
            </div>
          }
        >
          {watchlistItems.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                <div style={{ padding: '20px 0' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#4b5563' }}>{t.trade.noWatchlist}</div>
                  <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>{t.trade.noWatchlistDesc}</div>
                </div>
              }
            />
          ) : (
            <>
              {/* Summary stats strip */}
              <div style={{ 
                display: 'flex', gap: 12, marginBottom: 16, padding: '12px', 
                background: '#f8fafc', borderRadius: 10, border: '1px solid #f1f5f9' 
              }}>
                {[
                  { label: t.trade.statActive, value: watchlistItems.filter(w => w.status === 'ACTIVE').length, color: '#1890ff', icon: <EyeOutlined /> },
                  { label: t.trade.statReadySoon, value: watchlistItems.filter(w => w.finalAction === 'BUY_READY' || (w.riskGateStatus === 'PASS' && w.dataQuality === 'GOOD')).length, color: '#10b981', icon: <ThunderboltOutlined /> },
                  { label: t.trade.statReview, value: watchlistItems.filter(w => w.riskGateStatus === 'REVIEW' || w.finalAction === 'WAIT_FOR_ENTRY').length, color: '#d97706', icon: <ClockCircleOutlined /> },
                  { label: t.trade.statArchived, value: watchlistItems.filter(w => w.status !== 'ACTIVE').length, color: '#6b7280', icon: <CheckCircleOutlined /> }
                ].map((stat, idx) => (
                  <React.Fragment key={stat.label}>
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ color: stat.color, fontSize: 14 }}>{stat.icon}</div>
                      <div>
                        <div style={{ fontSize: 9, color: '#8c8c8c', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>{stat.label}</div>
                        <div style={{ fontSize: 15, fontWeight: 800, color: stat.color, lineHeight: 1.1 }}>{stat.value}</div>
                      </div>
                    </div>
                    {idx < 3 && <Divider type="vertical" style={{ height: 24, margin: 0, borderColor: '#e2e8f0' }} />}
                  </React.Fragment>
                ))}
              </div>

              {/* Table */}
              <div className="watchlist-table-container">
                <style>{`
                  .watchlist-table .ant-table-thead > tr > th { background: #f9fafb !important; padding: 12px 8px !important; border-bottom: 1px solid #f0f0f0 !important; }
                  .watchlist-table .ant-table-thead > tr > th:first-child,
                  .watchlist-table .ant-table-tbody > tr > td:first-child { padding-left: 24px !important; }
                  .watchlist-row > td { border-bottom: 1px solid #f0f0f0 !important; }
                  .watchlist-row:hover > td { background-color: #f0f7ff !important; }
                `}</style>
                <Table
                  className="watchlist-table"
                  dataSource={watchlistItems}
                  rowKey="id"
                  size="small"
                  pagination={watchlistItems.length > 10 ? { pageSize: 10, size: 'small' } : false}
                  loading={watchlistLoading}
                  scroll={{ x: 1200 }}
                  rowClassName="watchlist-row"
                  columns={[
                    { title: <span style={{ fontWeight: 700, color: '#6b7280', fontSize: 10, textTransform: 'uppercase' }}>{t.trade.colSymbol}</span>,
                      dataIndex: 'symbol', key: 'symbol', width: 90, fixed: 'left' as const,
                      render: (text: string) => <span style={{ fontWeight: 800, fontSize: 14, color: '#111827' }}>{text}</span> },
                    { title: <span style={{ fontWeight: 700, color: '#6b7280', fontSize: 10, textTransform: 'uppercase' }}>{t.trade.colSetup}</span>,
                      dataIndex: 'setupType', key: 'setup', width: 120,
                      render: (v: string) => {
                        const c: Record<string, string> = { 'Pullback Entry': 'gold', 'Breakout Entry': 'purple', 'Range Support Entry': 'green', 'Watch Only': 'blue' };
                        return <Tag color={c[v] || 'default'} style={{ fontSize: 9, fontWeight: 700, borderRadius: 4 }}>{v?.toUpperCase() || '—'}</Tag>;
                      }},
                    { title: <span style={{ fontWeight: 700, color: '#6b7280', fontSize: 10, textTransform: 'uppercase' }}>{t.trade.colAI}</span>,
                      dataIndex: 'aiDecision', key: 'aiDecision', width: 75,
                      render: (d: string) => {
                        const c = d === 'BUY' ? 'green' : d === 'WATCH' ? 'gold' : 'red';
                        return <Tag color={c} bordered={false} style={{ fontSize: 9, fontWeight: 800, borderRadius: 4, width: '100%', textAlign: 'center' }}>{d || '—'}</Tag>;
                      }},
                    { title: <span style={{ fontWeight: 700, color: '#6b7280', fontSize: 10, textTransform: 'uppercase' }}>{t.trade.colCnf}</span>,
                      dataIndex: 'confidence', key: 'confidence', width: 60,
                      render: (v: number) => <span style={{ fontSize: 12, fontWeight: 700, color: v >= 80 ? '#10b981' : '#1890ff' }}>{v != null ? `${v}%` : '—'}</span> },
                    { title: <span style={{ fontWeight: 700, color: '#6b7280', fontSize: 10, textTransform: 'uppercase' }}>{t.trade.colEntryZone}</span>,
                      key: 'entryZone', width: 140,
                      render: (_: any, r: any) => r.entryZoneLow != null ? <span style={{ fontSize: 12, color: '#374151', fontWeight: 600 }}>${r.entryZoneLow?.toFixed(2)} – ${r.entryZoneHigh?.toFixed(2)}</span> : <span style={{ color: '#d1d5db' }}>—</span> },
                    { title: <span style={{ fontWeight: 700, color: '#6b7280', fontSize: 10, textTransform: 'uppercase' }}>{t.trade.colStop}</span>,
                      dataIndex: 'stopLoss', key: 'stop', width: 85,
                      render: (v: number) => v != null ? <span style={{ fontSize: 12, color: '#ef4444', fontWeight: 700 }}>${v.toFixed(2)}</span> : '—' },
                    { title: <span style={{ fontWeight: 700, color: '#6b7280', fontSize: 10, textTransform: 'uppercase' }}>{t.trade.colTarget}</span>,
                      dataIndex: 'takeProfit1', key: 'tp1', width: 85,
                      render: (v: number) => v != null ? <span style={{ fontSize: 12, color: '#10b981', fontWeight: 700 }}>${v.toFixed(2)}</span> : '—' },
                    { title: <span style={{ fontWeight: 700, color: '#6b7280', fontSize: 10, textTransform: 'uppercase' }}>{t.trade.colRR}</span>,
                      dataIndex: 'riskReward', key: 'rr', width: 65,
                      render: (v: number) => v != null ? <span style={{ fontSize: 12, fontWeight: 700, color: v >= 2 ? '#10b981' : '#6b7280' }}>{v.toFixed(1)}:1</span> : '—' },
                    { title: <span style={{ fontWeight: 700, color: '#6b7280', fontSize: 10, textTransform: 'uppercase' }}>{t.trade.colGate}</span>,
                      dataIndex: 'riskGateStatus', key: 'gate', width: 80,
                      render: (s: string) => {
                        const c = s === 'PASS' ? 'green' : s === 'REVIEW' ? 'gold' : 'red';
                        return s ? <Tag color={c} bordered={false} style={{ fontSize: 9, fontWeight: 800, borderRadius: 4 }}>{s}</Tag> : '—';
                      }},
                    { title: <span style={{ fontWeight: 700, color: '#6b7280', fontSize: 10, textTransform: 'uppercase' }}>{t.trade.colFinal}</span>,
                      dataIndex: 'finalAction', key: 'final', width: 110,
                      render: (a: string) => {
                        const labels: Record<string, string> = { 'BUY_READY': t.trade.finalBuyReady, 'WAIT_FOR_ENTRY': t.trade.finalWaitEntry, 'SKIP': t.trade.finalSkip, 'BLOCKED_BY_RISK': t.trade.finalBlocked };
                        const c = a === 'BUY_READY' ? 'green' : a === 'WAIT_FOR_ENTRY' ? 'gold' : 'red';
                        return <Tag color={c} style={{ fontSize: 9, fontWeight: 700, borderRadius: 4 }}>{labels[a]?.toUpperCase() || a || '—'}</Tag>;
                      }},
                    { title: <span style={{ fontWeight: 700, color: '#6b7280', fontSize: 10, textTransform: 'uppercase' }}>{t.trade.colNextStep}</span>, 
                      dataIndex: 'nextStep', key: 'nextStep', width: 200, ellipsis: true,
                      render: (t: string) => (
                        <Tooltip title={t}>
                          <span style={{ fontSize: 11, color: '#6b7280', fontWeight: 500 }}>{t || '—'}</span>
                        </Tooltip>
                      )},
                    {
                      title: '', key: 'actions', width: 110, fixed: 'right' as const,
                      render: (_: any, r: any) => (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <Tooltip title={t.trade.buy}>
                            <Button size="small" type="primary" icon={<ShoppingCartOutlined style={{ fontSize: 13 }} />} onClick={() => openOrderModal({
                              symbol: r.symbol,
                              side: 'buy' as const,
                              limitPrice: r.entryZoneLow || undefined,
                              takeProfitPrice: r.takeProfit1 || undefined,
                              stopLossPrice: r.stopLoss || undefined,
                            })} style={{ padding: 0, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8 }} />
                          </Tooltip>
                          <Tooltip title={t.trade.remove}>
                            <Button size="small" type="text" danger icon={<DeleteOutlined style={{ fontSize: 15 }} />} onClick={() => removeWatchlistItem(r.id)} style={{ padding: 0, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, background: '#fef2f2' }} />
                          </Tooltip>
                        </div>
                      ),
                    },
                  ]}
                />
              </div>
            </>
          )}
        </Card>
      </div>

      <Divider />

      {/* Account Snapshot */}
      <div style={{ marginBottom: 24 }}>
        <Title level={4}>{t.trade.accountSnapshot}</Title>
        <Card
          size="small"
          title={t.trade.accountSnapshot}
          style={{ marginTop: '16px' }}
          extra={
            <Button
              type="primary"
              size="small"
              icon={<PlusOutlined />}
              onClick={() => openOrderModal()}
            >
              {t.trade.newOrder}
            </Button>
          }
        >
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12} lg={6}>
              <Statistic title={t.trade.cash} value={accountSnapshot.cash} prefix="$" />
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Statistic title={t.trade.equity} value={accountSnapshot.equity} prefix="$" />
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Statistic title={t.trade.buyingPower} value={accountSnapshot.buyingPower} prefix="$" />
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Statistic title={t.trade.portfolioValue} value={accountSnapshot.portfolioValue} prefix="$" />
            </Col>
          </Row>
          <div style={{ marginTop: '16px' }}>
            <Text type="secondary">
              {t.trade.accountLabel}: {accountSnapshot.accountNumber} | {t.trade.statusLabel}: {accountSnapshot.status} |
              {t.trade.positionsLabel}: {accountSnapshot.positionsCount} | {t.trade.openOrdersLabel}: {accountSnapshot.openOrdersCount}
            </Text>
          </div>
        </Card>
      </div>
      
      {/* Portfolio Performance */}
      <div style={{ marginBottom: 24 }}>
        <Card className="premium-card" bodyStyle={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <div>
              <Title level={4} style={{ margin: 0 }}>{t.trade.portfolioPerformance}</Title>
            </div>
            <div>
              <Select 
                value={portfolioRange} 
                onChange={handlePortfolioRangeChange} 
                style={{ width: 120 }}
                size="middle"
              >
                <Option value="1D">{t.trade.range1Day}</Option>
                <Option value="1W">{t.trade.range1Week}</Option>
                <Option value="1M">{t.trade.range1Month}</Option>
                <Option value="3M">{t.trade.range3Months}</Option>
                <Option value="1Y">{t.trade.range1Year}</Option>
                <Option value="All">{t.trade.rangeAll}</Option>
              </Select>
            </div>
          </div>

          {portfolioError ? (
            <Empty 
              image={Empty.PRESENTED_IMAGE_SIMPLE} 
              description={
                <div style={{ padding: '20px 0' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#ef4444' }}>{t.trade.portfolioUnavailable}</div>
                  <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>{t.trade.portfolioUnavailableDesc}</div>
                  <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 8 }}>{portfolioError}</div>
                </div>
              }
            />
          ) : portfolioHistory.length === 0 && !loadingData.portfolio ? (
            <Empty 
              image={Empty.PRESENTED_IMAGE_SIMPLE} 
              description={
                <div style={{ padding: '20px 0' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#4b5563' }}>{t.trade.noPortfolioHistory}</div>
                  <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>{t.trade.noPortfolioHistoryDesc}</div>
                </div>
              }
            />
          ) : portfolioHistory.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0' }}>
              <Spin size="large" />
              <div style={{ marginTop: 16, color: '#8c8c8c' }}>{t.trade.loadingPortfolio}</div>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: 12, color: '#8c8c8c', fontWeight: 600, textTransform: 'uppercase' }}>{t.trade.periodChange}</span>
                  <span style={{ 
                    fontSize: 24, 
                    fontWeight: 800, 
                    color: portfolioChange.value >= 0 ? '#10b981' : '#ef4444',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    lineHeight: 1
                  }}>
                    {portfolioChange.value >= 0 ? <ArrowUpOutlined style={{ fontSize: 20 }} /> : <ArrowDownOutlined style={{ fontSize: 20 }} />}
                    ${Math.abs(Number(portfolioChange.value || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} 
                    <span style={{ fontSize: 16, fontWeight: 600, opacity: 0.9 }}>
                      ({portfolioChange.value >= 0 ? '+' : ''}{Number(portfolioChange.percent || 0).toFixed(2)}%)
                    </span>
                  </span>
                </div>
              </div>

              <div style={{ height: 300, width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={portfolioHistory} margin={{ top: 5, right: 0, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                    <XAxis 
                      dataKey="timestamp" 
                      type="number"
                      scale="time"
                      domain={['dataMin', 'dataMax']}
                      tick={{ fill: '#8c8c8c', fontSize: 11 }}
                      tickLine={false}
                      axisLine={{ stroke: '#e8e8e8' }}
                      dy={10}
                      tickFormatter={(timestamp) => {
                        const ts = normalizeTimestamp(timestamp);
                        if (!ts) return '';
                        
                        const date = new Date(ts);
                        if (portfolioRange === '1D') {
                          return date.toLocaleTimeString('en-US', { 
                            timeZone: 'America/New_York',
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: false
                          });
                        } else if (portfolioRange === '1W') {
                          return date.toLocaleString('en-US', { 
                            timeZone: 'America/New_York',
                            month: 'numeric',
                            day: 'numeric',
                            hour: '2-digit',
                            hour12: false
                          });
                        } else {
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
                      tick={{ fill: '#8c8c8c', fontSize: 11, fontWeight: 500 }}
                      tickLine={false}
                      axisLine={false}
                      dx={-10}
                      tickFormatter={(value) => {
                         if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
                         if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
                         return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                      }}
                    />
                    <RechartsTooltip
                      contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', padding: '12px' }}
                      itemStyle={{ color: '#111827', fontWeight: 700 }}
                      labelStyle={{ color: '#6b7280', fontSize: 12, marginBottom: 4 }}
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
                      formatter={(value) => [`$${Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, t.trade.portfolioValueLabel]}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="equity" 
                      stroke="#1890ff" 
                      strokeWidth={3}
                      dot={false}
                      activeDot={{ r: 6, strokeWidth: 0, fill: '#1890ff' }}
                      name="Portfolio Value"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </Card>
      </div>

      {/* Positions */}
      <div style={{ marginBottom: 24 }}>
        <Card 
          title={<span style={{ fontSize: 16, fontWeight: 800 }}>{t.trade.positions}</span>}
          loading={loadingData.positions}
          className="premium-card"
          bodyStyle={{ padding: 0 }}
        >
          <style>{`
            .trade-table .ant-table-thead > tr > th { background: #f9fafb !important; padding: 12px 16px !important; border-bottom: 1px solid #f0f0f0 !important; }
            .trade-table .ant-table-thead > tr > th:first-child,
            .trade-table .ant-table-tbody > tr > td:first-child { padding-left: 24px !important; }
            .trade-row > td { border-bottom: 1px solid #f0f0f0 !important; }
            .trade-row:hover > td { background-color: #f8fafc !important; }
          `}</style>
          {alpacaPositions.length === 0 ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<span style={{ color: '#8c8c8c' }}>{t.trade.noPositions}</span>} style={{ padding: '30px 0' }} />
          ) : (
            <Table 
              className="trade-table"
              columns={positionsColumns} 
              dataSource={alpacaPositions} 
              rowKey="symbol"
              size="middle"
              pagination={alpacaPositions.length > 10 ? { pageSize: 10, size: 'small' } : false}
              scroll={{ x: 900 }}
              rowClassName="trade-row"
            />
          )}
        </Card>
      </div>
      
      {/* Open Orders */}
      <div style={{ marginBottom: 24 }}>
        <Card 
          title={<span style={{ fontSize: 16, fontWeight: 800 }}>{t.trade.openOrders}</span>}
          loading={loadingData.orders}
          className="premium-card"
          bodyStyle={{ padding: 0 }}
        >
          {alpacaOrders.length === 0 ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<span style={{ color: '#8c8c8c' }}>{t.trade.noOpenOrders}</span>} style={{ padding: '30px 0' }} />
          ) : (
            <Table 
              className="trade-table"
              columns={openOrdersColumns} 
              dataSource={alpacaOrders} 
              rowKey="id"
              size="middle"
              pagination={alpacaOrders.length > 5 ? { pageSize: 5, size: 'small' } : false}
              scroll={{ x: 900 }}
              rowClassName="trade-row"
            />
          )}
        </Card>
      </div>
      
      {/* Order History */}
      <div style={{ marginBottom: 24 }}>
        <Card 
          title={<span style={{ fontSize: 16, fontWeight: 800 }}>{t.trade.orderHistory}</span>}
          loading={loadingData.history}
          className="premium-card"
          bodyStyle={{ padding: 0 }}
        >
          {alpacaOrdersHistory.length === 0 ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<span style={{ color: '#8c8c8c' }}>{t.trade.noOrderHistory}</span>} style={{ padding: '30px 0' }} />
          ) : (
            <Table 
              className="trade-table"
              columns={orderHistoryColumns} 
              dataSource={alpacaOrdersHistory} 
              rowKey="id"
              size="middle"
              pagination={alpacaOrdersHistory.length > 10 ? { pageSize: 10, size: 'small' } : false}
              scroll={{ x: 900 }}
              rowClassName="trade-row"
            />
          )}
        </Card>
      </div>
      
      {/* Order Modal */}
      <OrderModal
        visible={orderModalVisible}
        onClose={() => setOrderModalVisible(false)}
        onSuccess={handleOrderSuccess}
        tradeMode={tradeMode}
        preset={orderModalPreset}
      />
    </div>
  );
};

export default Trade;