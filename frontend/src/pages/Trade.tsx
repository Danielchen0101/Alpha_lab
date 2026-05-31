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
import { useTradeMode } from '../contexts/TradeModeContext';

const { Title, Text } = Typography;
const { Option } = Select;

const Trade: React.FC = () => {
  const { t } = useLanguage();
  const { tradeMode } = useTradeMode();

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

  // 处理投资组合时间范围变化 — 只切换 range，由 refreshAllAlpacaData 统一拉取数据
  const handlePortfolioRangeChange = (range: string) => {
    setPortfolioRange(range);
    setPortfolioError(null);
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
  // Refresh data when trade mode changes
  useEffect(() => {
    refreshAllAlpacaData(tradeMode);
  }, [tradeMode]); // eslint-disable-line react-hooks/exhaustive-deps

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
  }, [tradeMode, portfolioRange, t.trade.credentialsNotConfigured, t.trade.liveLabel, t.trade.paperLabel, t.trade.refreshFailed]);

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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
              <div style={{ 
                width: 40, height: 40, borderRadius: 10, 
                background: 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)', 
                color: '#fff', display: 'flex', alignItems: 'center', 
                justifyContent: 'center', fontSize: 20,
                boxShadow: 'var(--app-shadow-sm)'
              }}>
                <RobotOutlined />
              </div>
              <Title level={2} style={{ margin: 0, fontWeight: 800, color: 'var(--app-text-strong)', letterSpacing: '-0.5px' }}>{t.trade.title}</Title>
            </div>
            <Text style={{ fontSize: 14, fontWeight: 500, color: 'var(--app-text-muted)' }}>{t.trade.subtitle}</Text>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Tag color={tradeMode === 'paper' ? 'blue' : 'error'} bordered={false} style={{ 
              fontSize: 11, 
              fontWeight: 700, 
              borderRadius: 4, 
              margin: 0, 
              padding: '4px 12px',
              backgroundColor: tradeMode === 'paper' ? 'rgba(59, 130, 246, 0.12)' : 'rgba(239, 68, 68, 0.12)',
              border: `1px solid ${tradeMode === 'paper' ? 'rgba(59, 130, 246, 0.25)' : 'rgba(239, 68, 68, 0.25)'}`,
              color: tradeMode === 'paper' ? '#60a5fa' : '#ef4444'
            }}>
              {tradeMode === 'paper' ? t.trade.paperTrading : t.trade.liveTrading}
            </Tag>
            <Button
              size="middle"
              icon={<ReloadOutlined />}
              onClick={() => refreshAllAlpacaData()}
              loading={loadingData.account || loadingData.positions || loadingData.orders || loadingData.portfolio}
              style={{ 
                borderRadius: 8, 
                height: 34, 
                fontWeight: 600, 
                color: 'var(--app-text)', 
                background: 'var(--app-card-bg-soft)',
                border: '1px solid var(--app-border)' 
              }}
            >
              {t.trade.refreshData}
            </Button>
          </div>
        </div>
      </div>

      {tradeMode === 'real' && (
        <Alert
          message={<span style={{ fontWeight: 700 }}>{t.trade.realModeTitle}</span>}
          description={t.trade.realModeDesc}
          type="error"
          showIcon
          icon={<SafetyOutlined />}
          style={{ marginBottom: 24, borderRadius: 10, border: '1px solid #ef4444', background: 'rgba(239, 68, 68, 0.05)' }}
        />
      )}

      {/* AI Entry Watchlist */}
      <div style={{ marginBottom: 24 }}>
        <Card
          className="premium-card"
          style={{ background: 'var(--app-card-bg)', border: '1px solid var(--app-border-soft)', boxShadow: 'var(--app-shadow)' }}
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
                  <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--app-text-strong)', lineHeight: 1.2 }}>{t.trade.watchlistTitle}</div>
                  <div style={{ fontSize: 10, color: 'var(--app-text-muted)', fontWeight: 500 }}>{t.trade.watchlistSubtitle}</div>
                </div>
                <Tag color="blue" bordered={false} style={{ fontSize: 10, fontWeight: 800, borderRadius: 6, marginLeft: 4 }}>{watchlistItems.length}</Tag>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Tag color="blue" bordered={false} style={{ fontSize: 9, margin: 0, fontWeight: 700, borderRadius: 4 }}>ALPACA REAL-TIME</Tag>
                <Divider type="vertical" style={{ height: 20, borderColor: 'var(--app-border-soft)' }} />
                <Button 
                  size="middle" 
                  icon={<ReloadOutlined spin={watchlistLoading} />} 
                  onClick={loadWatchlist} 
                  loading={watchlistLoading} 
                  style={{ 
                    borderRadius: 8, 
                    height: 32, 
                    fontSize: 12, 
                    fontWeight: 600, 
                    color: 'var(--app-text-muted)', 
                    background: 'var(--app-card-bg-soft)',
                    border: '1px solid var(--app-border)' 
                  }}
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
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--app-text-strong)' }}>{t.trade.noWatchlist}</div>
                  <div style={{ fontSize: 12, color: 'var(--app-text-muted)', marginTop: 4 }}>{t.trade.noWatchlistDesc}</div>
                </div>
              }
            />
          ) : (
            <>
              {/* Summary stats strip */}
              <div style={{ 
                display: 'flex', gap: 12, marginBottom: 16, padding: '12px', 
                background: 'var(--app-card-bg-soft)', borderRadius: 10, border: '1px solid var(--app-border-soft)' 
              }}>
                {[
                  { label: t.trade.statActive, value: watchlistItems.filter(w => w.status === 'ACTIVE').length, color: 'var(--app-blue-text)', icon: <EyeOutlined /> },
                  { label: t.trade.statReadySoon, value: watchlistItems.filter(w => w.finalAction === 'BUY_READY' || (w.riskGateStatus === 'PASS' && w.dataQuality === 'GOOD')).length, color: '#4ade80', icon: <ThunderboltOutlined /> },
                  { label: t.trade.statReview, value: watchlistItems.filter(w => w.riskGateStatus === 'REVIEW' || w.finalAction === 'WAIT_FOR_ENTRY').length, color: '#fbbf24', icon: <ClockCircleOutlined /> },
                  { label: t.trade.statArchived, value: watchlistItems.filter(w => w.status !== 'ACTIVE').length, color: 'var(--app-text-muted)', icon: <CheckCircleOutlined /> }
                ].map((stat, idx) => (
                  <React.Fragment key={stat.label}>
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ color: stat.color, fontSize: 14 }}>{stat.icon}</div>
                      <div>
                        <div style={{ fontSize: 9, color: 'var(--app-text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>{stat.label}</div>
                        <div style={{ fontSize: 15, fontWeight: 800, color: stat.color, lineHeight: 1.1 }}>{stat.value}</div>
                      </div>
                    </div>
                    {idx < 3 && <Divider type="vertical" style={{ height: 24, margin: 0, borderColor: 'var(--app-border-soft)' }} />}
                  </React.Fragment>
                ))}
              </div>

              {/* Table */}
              <div className="watchlist-table-container">
                <style>{`
                  .watchlist-table .ant-table-thead > tr > th { 
                    background: var(--app-table-header-bg) !important; 
                    padding: 12px 8px !important; 
                    border-bottom: 1px solid var(--app-border-soft) !important; 
                    color: var(--app-text-muted) !important;
                  }
                  .watchlist-table .ant-table-thead > tr > th:first-child,
                  .watchlist-table .ant-table-tbody > tr > td:first-child { padding-left: 24px !important; }
                  .watchlist-row > td { border-bottom: 1px solid var(--app-border-soft) !important; background: var(--app-card-bg) !important; }
                  .watchlist-row:hover > td { background-color: var(--app-card-bg-soft) !important; }
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
                    { title: <span style={{ fontWeight: 700, color: 'var(--app-text-muted)', fontSize: 10, textTransform: 'uppercase' }}>{t.trade.colSymbol}</span>,
                      dataIndex: 'symbol', key: 'symbol', width: 90, fixed: 'left' as const,
                      render: (text: string) => <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--app-text-strong)' }}>{text}</span> },
                    { title: <span style={{ fontWeight: 700, color: 'var(--app-text-muted)', fontSize: 10, textTransform: 'uppercase' }}>{t.trade.colSetup}</span>,
                      dataIndex: 'setupType', key: 'setup', width: 120,
                      render: (v: string) => {
                        const c: Record<string, string> = { 'Pullback Entry': 'gold', 'Breakout Entry': 'purple', 'Range Support Entry': 'green', 'Watch Only': 'blue' };
                        return <Tag color={c[v] || 'default'} style={{ fontSize: 9, fontWeight: 700, borderRadius: 4 }}>{v?.toUpperCase() || '—'}</Tag>;
                      }},
                    { title: <span style={{ fontWeight: 700, color: 'var(--app-text-muted)', fontSize: 10, textTransform: 'uppercase' }}>{t.trade.colAI}</span>,
                      dataIndex: 'aiDecision', key: 'aiDecision', width: 75,
                      render: (d: string) => {
                        const c = d === 'BUY' ? 'green' : d === 'WATCH' ? 'gold' : 'red';
                        return <Tag color={c} bordered={false} style={{ fontSize: 9, fontWeight: 800, borderRadius: 4, width: '100%', textAlign: 'center' }}>{d || '—'}</Tag>;
                      }},
                    { title: <span style={{ fontWeight: 700, color: 'var(--app-text-muted)', fontSize: 10, textTransform: 'uppercase' }}>{t.trade.colCnf}</span>,
                      dataIndex: 'confidence', key: 'confidence', width: 60,
                      render: (v: number) => <span style={{ fontSize: 12, fontWeight: 700, color: v >= 80 ? '#4ade80' : 'var(--app-blue-text)' }}>{v != null ? `${v}%` : '—'}</span> },
                    { title: <span style={{ fontWeight: 700, color: 'var(--app-text-muted)', fontSize: 10, textTransform: 'uppercase' }}>{t.trade.colEntryZone}</span>,
                      key: 'entryZone', width: 140,
                      render: (_: any, r: any) => r.entryZoneLow != null ? <span style={{ fontSize: 12, color: 'var(--app-text)', fontWeight: 600 }}>${r.entryZoneLow?.toFixed(2)} – ${r.entryZoneHigh?.toFixed(2)}</span> : <span style={{ color: 'var(--app-text-muted)' }}>—</span> },
                    { title: <span style={{ fontWeight: 700, color: 'var(--app-text-muted)', fontSize: 10, textTransform: 'uppercase' }}>{t.trade.colStop}</span>,
                      dataIndex: 'stopLoss', key: 'stop', width: 85,
                      render: (v: number) => v != null ? <span style={{ fontSize: 12, color: '#ef4444', fontWeight: 700 }}>${v.toFixed(2)}</span> : '—' },
                    { title: <span style={{ fontWeight: 700, color: 'var(--app-text-muted)', fontSize: 10, textTransform: 'uppercase' }}>{t.trade.colTarget}</span>,
                      dataIndex: 'takeProfit1', key: 'tp1', width: 85,
                      render: (v: number) => v != null ? <span style={{ fontSize: 12, color: '#4ade80', fontWeight: 700 }}>${v.toFixed(2)}</span> : '—' },
                    { title: <span style={{ fontWeight: 700, color: 'var(--app-text-muted)', fontSize: 10, textTransform: 'uppercase' }}>{t.trade.colRR}</span>,
                      dataIndex: 'riskReward', key: 'rr', width: 65,
                      render: (v: number) => v != null ? <span style={{ fontSize: 12, fontWeight: 700, color: v >= 2 ? '#4ade80' : 'var(--app-text-muted)' }}>{v.toFixed(1)}:1</span> : '—' },
                    { title: <span style={{ fontWeight: 700, color: 'var(--app-text-muted)', fontSize: 10, textTransform: 'uppercase' }}>{t.trade.colGate}</span>,
                      dataIndex: 'riskGateStatus', key: 'gate', width: 80,
                      render: (s: string) => {
                        const c = s === 'PASS' ? 'green' : s === 'REVIEW' ? 'gold' : 'red';
                        return s ? <Tag color={c} bordered={false} style={{ fontSize: 9, fontWeight: 800, borderRadius: 4 }}>{s}</Tag> : '—';
                      }},
                    { title: <span style={{ fontWeight: 700, color: 'var(--app-text-muted)', fontSize: 10, textTransform: 'uppercase' }}>{t.trade.colFinal}</span>,
                      dataIndex: 'finalAction', key: 'final', width: 110,
                      render: (a: string) => {
                        const labels: Record<string, string> = { 'BUY_READY': t.trade.finalBuyReady, 'WAIT_FOR_ENTRY': t.trade.finalWaitEntry, 'SKIP': t.trade.finalSkip, 'BLOCKED_BY_RISK': t.trade.finalBlocked };
                        const c = a === 'BUY_READY' ? 'green' : a === 'WAIT_FOR_ENTRY' ? 'gold' : 'red';
                        return <Tag color={c} style={{ fontSize: 9, fontWeight: 700, borderRadius: 4 }}>{labels[a]?.toUpperCase() || a || '—'}</Tag>;
                      }},
                    { title: <span style={{ fontWeight: 700, color: 'var(--app-text-muted)', fontSize: 10, textTransform: 'uppercase' }}>{t.trade.colNextStep}</span>, 
                      dataIndex: 'nextStep', key: 'nextStep', width: 200, ellipsis: true,
                      render: (t: string) => (
                        <Tooltip title={t}>
                          <span style={{ fontSize: 11, color: 'var(--app-text-muted)', fontWeight: 500 }}>{t || '—'}</span>
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
                            <Button size="small" type="text" danger icon={<DeleteOutlined style={{ fontSize: 15 }} />} onClick={() => removeWatchlistItem(r.id)} style={{ 
                              padding: 0, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, 
                              background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)' 
                            }} />
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

      <Divider style={{ borderColor: 'var(--app-border-soft)' }} />

      {/* Account Snapshot */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Title level={4} style={{ margin: 0, color: 'var(--app-text-strong)' }}>{t.trade.accountSnapshot}</Title>
          <Button
            type="primary"
            size="middle"
            icon={<PlusOutlined />}
            onClick={() => openOrderModal()}
            style={{ borderRadius: 8, height: 36, fontWeight: 700, boxShadow: '0 4px 12px rgba(24, 144, 255, 0.2)' }}
          >
            {t.trade.newOrder}
          </Button>
        </div>
        
        <Card
          size="small"
          style={{ background: 'var(--app-card-bg)', border: '1px solid var(--app-border-soft)', boxShadow: 'var(--app-shadow)' }}
          bodyStyle={{ padding: '24px' }}
        >
          <Row gutter={[24, 24]}>
            <Col xs={24} sm={12} lg={6}>
              <div style={{ background: 'var(--app-card-bg-soft)', padding: '16px', borderRadius: 10, border: '1px solid var(--app-border-soft)' }}>
                <Statistic 
                  title={<span style={{ color: 'var(--app-text-muted)', fontSize: 12, textTransform: 'uppercase', fontWeight: 600 }}>{t.trade.cash}</span>} 
                  value={accountSnapshot.cash} 
                  prefix="$" 
                  valueStyle={{ color: 'var(--app-text-strong)', fontWeight: 800 }}
                />
              </div>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <div style={{ background: 'var(--app-card-bg-soft)', padding: '16px', borderRadius: 10, border: '1px solid var(--app-border-soft)' }}>
                <Statistic 
                  title={<span style={{ color: 'var(--app-text-muted)', fontSize: 12, textTransform: 'uppercase', fontWeight: 600 }}>{t.trade.equity}</span>} 
                  value={accountSnapshot.equity} 
                  prefix="$" 
                  valueStyle={{ color: 'var(--app-blue-text)', fontWeight: 800 }}
                />
              </div>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <div style={{ background: 'var(--app-card-bg-soft)', padding: '16px', borderRadius: 10, border: '1px solid var(--app-border-soft)' }}>
                <Statistic 
                  title={<span style={{ color: 'var(--app-text-muted)', fontSize: 12, textTransform: 'uppercase', fontWeight: 600 }}>{t.trade.buyingPower}</span>} 
                  value={accountSnapshot.buyingPower} 
                  prefix="$" 
                  valueStyle={{ color: '#fbbf24', fontWeight: 800 }}
                />
              </div>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <div style={{ background: 'var(--app-card-bg-soft)', padding: '16px', borderRadius: 10, border: '1px solid var(--app-border-soft)' }}>
                <Statistic 
                  title={<span style={{ color: 'var(--app-text-muted)', fontSize: 12, textTransform: 'uppercase', fontWeight: 600 }}>{t.trade.portfolioValue}</span>} 
                  value={accountSnapshot.portfolioValue} 
                  prefix="$" 
                  valueStyle={{ color: 'var(--app-text-strong)', fontWeight: 800 }}
                />
              </div>
            </Col>
          </Row>
          <div style={{ 
            marginTop: '20px', 
            padding: '12px 16px', 
            background: 'var(--app-input-bg)', 
            borderRadius: 8, 
            border: '1px solid var(--app-border-soft)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', gap: 16 }}>
              <Text style={{ color: 'var(--app-text-muted)', fontSize: 12 }}>
                <strong style={{ color: 'var(--app-text)' }}>{t.trade.accountLabel}:</strong> {accountSnapshot.accountNumber}
              </Text>
              <Text style={{ color: 'var(--app-text-muted)', fontSize: 12 }}>
                <strong style={{ color: 'var(--app-text)' }}>{t.trade.statusLabel}:</strong> 
                <Tag color="success" style={{ marginLeft: 6, fontWeight: 700, borderRadius: 4 }}>{accountSnapshot.status || 'ACTIVE'}</Tag>
              </Text>
            </div>
            <div style={{ display: 'flex', gap: 16 }}>
              <Text style={{ color: 'var(--app-text-muted)', fontSize: 12 }}>
                <strong style={{ color: 'var(--app-text)' }}>{t.trade.positionsLabel}:</strong> {accountSnapshot.positionsCount}
              </Text>
              <Text style={{ color: 'var(--app-text-muted)', fontSize: 12 }}>
                <strong style={{ color: 'var(--app-text)' }}>{t.trade.openOrdersLabel}:</strong> {accountSnapshot.openOrdersCount}
              </Text>
            </div>
          </div>
        </Card>
      </div>
      
      {/* Portfolio Performance */}
      <div style={{ marginBottom: 24 }}>
        <Card 
          className="premium-card" 
          style={{ background: 'var(--app-card-bg)', border: '1px solid var(--app-border-soft)', boxShadow: 'var(--app-shadow)' }}
          bodyStyle={{ padding: '24px' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <Title level={4} style={{ margin: 0, color: 'var(--app-text-strong)' }}>{t.trade.portfolioPerformance}</Title>
            </div>
            <div>
              <Select 
                value={portfolioRange} 
                onChange={handlePortfolioRangeChange} 
                style={{ width: 120 }}
                size="middle"
                dropdownStyle={{ background: 'var(--app-card-bg)' }}
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
                  <div style={{ fontSize: 12, color: 'var(--app-text-muted)', marginTop: 4 }}>{t.trade.portfolioUnavailableDesc}</div>
                  <div style={{ fontSize: 11, color: 'var(--app-text-muted)', marginTop: 8, opacity: 0.8 }}>{portfolioError}</div>
                </div>
              }
            />
          ) : portfolioHistory.length === 0 && !loadingData.portfolio ? (
            <Empty 
              image={Empty.PRESENTED_IMAGE_SIMPLE} 
              description={
                <div style={{ padding: '20px 0' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--app-text-strong)' }}>{t.trade.noPortfolioHistory}</div>
                  <div style={{ fontSize: 12, color: 'var(--app-text-muted)', marginTop: 4 }}>{t.trade.noPortfolioHistoryDesc}</div>
                </div>
              }
            />
          ) : portfolioHistory.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0' }}>
              <Spin size="large" indicator={<ReloadOutlined spin style={{ fontSize: 24, color: 'var(--app-blue-text)' }} />} />
              <div style={{ marginTop: 16, color: 'var(--app-text-muted)' }}>{t.trade.loadingPortfolio}</div>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: 12, color: 'var(--app-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t.trade.periodChange}</span>
                  <span style={{ 
                    fontSize: 24, 
                    fontWeight: 800, 
                    color: portfolioChange.value >= 0 ? '#4ade80' : '#ef4444',
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

              <div style={{ height: 300, width: '100%', marginTop: '10px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={portfolioHistory} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.12)" vertical={false} />
                    <XAxis 
                      dataKey="timestamp" 
                      type="number"
                      scale="time"
                      domain={['dataMin', 'dataMax']}
                      tick={{ fill: 'var(--app-text-muted)', fontSize: 11 }}
                      tickLine={false}
                      axisLine={{ stroke: 'var(--app-border-soft)' }}
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
                      hide={false}
                      orientation="right"
                      domain={['auto', 'auto']}
                      tick={{ fill: 'var(--app-text-muted)', fontSize: 11, fontWeight: 500 }}
                      tickLine={false}
                      axisLine={false}
                      dx={10}
                      tickFormatter={(value) => {
                         if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
                         if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
                         return `$${Math.round(value)}`;
                      }}
                    />
                    <RechartsTooltip
                      contentStyle={{ 
                        backgroundColor: 'var(--app-card-bg)', 
                        borderRadius: 12, 
                        border: '1px solid var(--app-border)', 
                        boxShadow: 'var(--app-shadow)', 
                        padding: '12px' 
                      }}
                      itemStyle={{ color: 'var(--app-text-strong)', fontWeight: 700 }}
                      labelStyle={{ color: 'var(--app-text-muted)', fontSize: 12, marginBottom: 4 }}
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
                      stroke="var(--app-blue-text)" 
                      strokeWidth={3}
                      dot={false}
                      activeDot={{ r: 6, strokeWidth: 0, fill: 'var(--app-blue-text)' }}
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
          title={<span style={{ fontSize: 16, fontWeight: 800, color: 'var(--app-text-strong)' }}>{t.trade.positions}</span>}
          loading={loadingData.positions}
          className="premium-card"
          style={{ background: 'var(--app-card-bg)', border: '1px solid var(--app-border-soft)', boxShadow: 'var(--app-shadow)' }}
          bodyStyle={{ padding: 0 }}
        >
          {alpacaPositions.length === 0 ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<span style={{ color: 'var(--app-text-muted)' }}>{t.trade.noPositions}</span>} style={{ padding: '30px 0' }} />
          ) : (
            <Table 
              className="trade-table"
              columns={positionsColumns} 
              dataSource={alpacaPositions} 
              rowKey="symbol"
              size="middle"
              pagination={alpacaPositions.length > 10 ? { pageSize: 10, size: 'small' } : false}
              scroll={{ x: 1000 }}
              rowClassName="trade-row"
            />
          )}
        </Card>
      </div>
      
      {/* Open Orders */}
      <div style={{ marginBottom: 24 }}>
        <Card 
          title={<span style={{ fontSize: 16, fontWeight: 800, color: 'var(--app-text-strong)' }}>{t.trade.openOrders}</span>}
          loading={loadingData.orders}
          className="premium-card"
          style={{ background: 'var(--app-card-bg)', border: '1px solid var(--app-border-soft)', boxShadow: 'var(--app-shadow)' }}
          bodyStyle={{ padding: 0 }}
        >
          {alpacaOrders.length === 0 ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<span style={{ color: 'var(--app-text-muted)' }}>{t.trade.noOpenOrders}</span>} style={{ padding: '30px 0' }} />
          ) : (
            <Table 
              className="trade-table"
              columns={openOrdersColumns} 
              dataSource={alpacaOrders} 
              rowKey="id"
              size="middle"
              pagination={alpacaOrders.length > 5 ? { pageSize: 5, size: 'small' } : false}
              scroll={{ x: 1000 }}
              rowClassName="trade-row"
            />
          )}
        </Card>
      </div>
      
      {/* Order History */}
      <div style={{ marginBottom: 24 }}>
        <Card 
          title={<span style={{ fontSize: 16, fontWeight: 800, color: 'var(--app-text-strong)' }}>{t.trade.orderHistory}</span>}
          loading={loadingData.history}
          className="premium-card"
          style={{ background: 'var(--app-card-bg)', border: '1px solid var(--app-border-soft)', boxShadow: 'var(--app-shadow)' }}
          bodyStyle={{ padding: 0 }}
        >
          {alpacaOrdersHistory.length === 0 ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<span style={{ color: 'var(--app-text-muted)' }}>{t.trade.noOrderHistory}</span>} style={{ padding: '30px 0' }} />
          ) : (
            <Table 
              className="trade-table"
              columns={orderHistoryColumns} 
              dataSource={alpacaOrdersHistory} 
              rowKey="id"
              size="middle"
              pagination={alpacaOrdersHistory.length > 10 ? { pageSize: 10, size: 'small' } : false}
              scroll={{ x: 1000 }}
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
        preset={orderModalPreset}
      />
    </div>
  );
};

export default Trade;