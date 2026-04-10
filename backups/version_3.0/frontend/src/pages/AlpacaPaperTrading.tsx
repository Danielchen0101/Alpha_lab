import React, { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  Table,
  Button,
  Space,
  message,
  Typography,
  Spin,
  Form,
  Input,
  Select,
  Modal,
  Tag
} from 'antd';
import {
  DollarOutlined,
  StockOutlined,
  OrderedListOutlined,
  ReloadOutlined,
  PlusOutlined,
  CloseOutlined
} from '@ant-design/icons';
import alpacaBrokerService, {
  AlpacaAccount,
  AlpacaPosition,
  AlpacaOrder
} from '../services/alpacaBrokerService';

const { Title, Text } = Typography;
const { Option } = Select;

const AlpacaPaperTrading: React.FC = () => {
  const [account, setAccount] = useState<AlpacaAccount | null>(null);
  const [positions, setPositions] = useState<AlpacaPosition[]>([]);
  const [orders, setOrders] = useState<AlpacaOrder[]>([]);
  const [loading, setLoading] = useState({
    account: false,
    positions: false,
    orders: false,
    all: false
  });
  const [orderModalVisible, setOrderModalVisible] = useState(false);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [form] = Form.useForm();
  
  // 状态追踪
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [pollingActive, setPollingActive] = useState(false);
  const [trackingOrderId, setTrackingOrderId] = useState<string | null>(null);
  const [orderFilter, setOrderFilter] = useState<string>('all'); // 'all', 'open', 'filled', 'canceled'
  
  // 表单状态
  const [currentSymbol, setCurrentSymbol] = useState<string>('');
  const [currentOrderType, setCurrentOrderType] = useState<string>('market');
  const [submittingOrder, setSubmittingOrder] = useState(false); // 防重复提交
  
  // Cancel 按钮 loading 状态
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);

  // 计算筛选后的订单
  const filteredOrders = React.useMemo(() => {
    if (orderFilter === 'all') return orders;
    
    return orders.filter(order => {
      const status = order.status.toLowerCase();
      switch (orderFilter) {
        case 'open':
          return ['accepted', 'new', 'partially_filled'].includes(status);
        case 'filled':
          return status === 'filled';
        case 'canceled':
          return ['canceled', 'rejected', 'expired'].includes(status);
        default:
          return true;
      }
    });
  }, [orders, orderFilter]);

  const loadAccount = async () => {
    setLoading(prev => ({ ...prev, account: true }));
    try {
      const data = await alpacaBrokerService.getAccount();
      setAccount(data);
      setLastRefreshed(new Date()); // 更新最后刷新时间
    } catch (error: any) {
      const errorMsg = error.response?.data?.error?.message || error.message || 'Failed to load account';
      message.error(`Account Error: ${errorMsg}`);
      setAccount(null);
    } finally {
      setLoading(prev => ({ ...prev, account: false }));
    }
  };

  const loadPositions = async () => {
    setLoading(prev => ({ ...prev, positions: true }));
    try {
      const data = await alpacaBrokerService.getPositions();
      setPositions(data);
      setLastRefreshed(new Date()); // 更新最后刷新时间
    } catch (error: any) {
      const errorMsg = error.response?.data?.error?.message || error.message || 'Failed to load positions';
      message.error(`Positions Error: ${errorMsg}`);
      setPositions([]);
    } finally {
      setLoading(prev => ({ ...prev, positions: false }));
    }
  };

  const loadOrders = async () => {
    setLoading(prev => ({ ...prev, orders: true }));
    try {
      const data = await alpacaBrokerService.getOrders();
      setOrders(data);
      setLastRefreshed(new Date()); // 更新最后刷新时间
    } catch (error: any) {
      const errorMsg = error.response?.data?.error?.message || error.message || 'Failed to load orders';
      message.error(`Orders Error: ${errorMsg}`);
      setOrders([]);
    } finally {
      setLoading(prev => ({ ...prev, orders: false }));
    }
  };

  const pollOrderStatus = async (orderId: string) => {
    const maxAttempts = 10; // 最多轮询10次（20秒）
    const interval = 2000; // 每2秒一次
    let attempts = 0;
    
    // 设置轮询状态
    setPollingActive(true);
    setTrackingOrderId(orderId);
    
    const poll = async () => {
      if (attempts >= maxAttempts) {
        console.log(`Polling stopped for order ${orderId} after ${maxAttempts} attempts (${maxAttempts * interval / 1000} seconds)`);
        setPollingActive(false);
        setTrackingOrderId(null);
        return;
      }
      
      attempts++;
      console.log(`轮询订单状态 ${orderId}，尝试次数: ${attempts}/${maxAttempts}`);
      
      try {
        // 并行刷新所有数据
        await Promise.all([
          loadOrders(),
          loadPositions(),
          loadAccount()
        ]);
        
        // 检查订单最新状态（使用当前 orders 状态）
        const currentOrder = orders.find(o => o.orderId === orderId);
        
        if (!currentOrder) {
          console.log(`订单 ${orderId} 在当前订单列表中未找到，继续尝试...`);
          // 订单可能还没出现在列表中，继续尝试
          setTimeout(poll, interval);
          return;
        }
        
        const status = currentOrder.status.toLowerCase();
        const finalStatuses = ['filled', 'canceled', 'rejected', 'expired'];
        
        console.log(`订单 ${orderId} 当前状态: ${status}`);
        
        if (finalStatuses.includes(status)) {
          console.log(`订单 ${orderId} 达到终态: ${status}，停止轮询`);
          
          // 如果是成交状态，额外刷新一次持仓和账户
          if (status === 'filled') {
            console.log(`订单成交，额外刷新持仓和账户数据`);
            await Promise.all([
              loadPositions(),
              loadAccount()
            ]);
          }
          
          // 停止轮询状态
          setPollingActive(false);
          setTrackingOrderId(null);
          return;
        }
        
        // 继续轮询
        console.log(`订单 ${orderId} 未达到终态，${interval/1000}秒后继续轮询`);
        setTimeout(poll, interval);
        
      } catch (error) {
        console.error(`轮询订单 ${orderId} 时出错:`, error);
        // 出错也继续尝试
        setTimeout(poll, interval);
      }
    };
    
    // 开始轮询
    console.log(`开始轮询订单状态 ${orderId}，间隔: ${interval}ms，最大尝试次数: ${maxAttempts}`);
    setTimeout(poll, interval);
  };

  const loadAll = async () => {
    setLoading(prev => ({ ...prev, all: true }));
    try {
      // 并行加载所有数据
      const [accountData, positionsData, ordersData] = await Promise.allSettled([
        alpacaBrokerService.getAccount(),
        alpacaBrokerService.getPositions(),
        alpacaBrokerService.getOrders()
      ]);
      
      // 处理账户数据
      if (accountData.status === 'fulfilled') {
        setAccount(accountData.value);
      } else {
        const error = accountData.reason;
        const errorMsg = error.response?.data?.error?.message || error.message || 'Failed to load account';
        message.error(`Account: ${errorMsg}`);
        setAccount(null);
      }
      
      // 处理持仓数据
      if (positionsData.status === 'fulfilled') {
        setPositions(positionsData.value);
      } else {
        const error = positionsData.reason;
        const errorMsg = error.response?.data?.error?.message || error.message || 'Failed to load positions';
        message.error(`Positions: ${errorMsg}`);
        setPositions([]);
      }
      
      // 处理订单数据
      if (ordersData.status === 'fulfilled') {
        setOrders(ordersData.value);
      } else {
        const error = ordersData.reason;
        const errorMsg = error.response?.data?.error?.message || error.message || 'Failed to load orders';
        message.error(`Orders: ${errorMsg}`);
        setOrders([]);
      }
      
      // 检查是否有成功加载的数据
      const successCount = [accountData, positionsData, ordersData].filter(r => r.status === 'fulfilled').length;
      if (successCount > 0) {
        message.success(`Refreshed ${successCount} of 3 data sources`);
        setLastRefreshed(new Date()); // 更新最后刷新时间
      }
      
    } catch (error: any) {
      const errorMsg = error.response?.data?.error?.message || error.message || 'Failed to refresh data';
      message.error(`Refresh Error: ${errorMsg}`);
    } finally {
      setLoading(prev => ({ ...prev, all: false }));
    }
  };

  const handlePlaceOrder = async (values: any) => {
    // 防重复提交检查
    if (submittingOrder) {
      message.warning('Please wait, order is being submitted...');
      return;
    }
    
    // 表单验证 - Symbol
    const symbol = values.symbol ? values.symbol.trim().toUpperCase() : '';
    if (!symbol) {
      message.error('Please enter a symbol (e.g., AAPL)');
      return;
    }
    
    // 表单验证 - Quantity
    const qty = parseFloat(values.qty);
    if (isNaN(qty)) {
      message.error('Quantity must be a valid number');
      return;
    }
    if (qty <= 0) {
      message.error('Quantity must be greater than 0');
      return;
    }
    if (!Number.isInteger(qty)) {
      message.error('Quantity must be a whole number (integer)');
      return;
    }
    
    // 表单验证 - Sell 订单持仓检查
    if (values.side === 'sell') {
      const position = positions.find(p => p.symbol === symbol);
      if (!position) {
        message.error(`No ${symbol} position found. You can only sell stocks you own.`);
        return;
      }
      if (position.quantity < qty) {
        message.error(`Insufficient ${symbol} position. You have ${position.quantity} shares, trying to sell ${qty}.`);
        return;
      }
    }
    
    // 表单验证 - Order Type 价格校验
    const orderType = values.type || 'market';
    
    if (orderType === 'limit') {
      const limitPrice = parseFloat(values.limit_price);
      if (isNaN(limitPrice) || limitPrice <= 0) {
        message.error('Limit price is required and must be greater than 0 for limit orders');
        return;
      }
    }
    
    if (orderType === 'stop') {
      const stopPrice = parseFloat(values.stop_price);
      if (isNaN(stopPrice) || stopPrice <= 0) {
        message.error('Stop price is required and must be greater than 0 for stop orders');
        return;
      }
    }
    
    if (orderType === 'stop_limit') {
      const limitPrice = parseFloat(values.limit_price);
      const stopPrice = parseFloat(values.stop_price);
      if (isNaN(limitPrice) || limitPrice <= 0) {
        message.error('Limit price is required for stop-limit orders');
        return;
      }
      if (isNaN(stopPrice) || stopPrice <= 0) {
        message.error('Stop price is required for stop-limit orders');
        return;
      }
    }
    
    setPlacingOrder(true);
    setSubmittingOrder(true);
    try {
      const order = await alpacaBrokerService.placeOrder({
        symbol: symbol,
        qty: qty.toString(),
        side: values.side,
        type: orderType,
        time_in_force: values.time_in_force || 'gtc',
        limit_price: values.limit_price,
        stop_price: values.stop_price
      });
      
      // 构建详细的下单成功消息
      const sideText = values.side === 'buy' ? 'BUY' : 'SELL';
      const typeText = orderType.toUpperCase();
      const qtyText = qty.toLocaleString();
      const statusText = order.status.toUpperCase();
      
      let successMessage = `Order submitted: ${symbol} x${qtyText} ${sideText} @ ${typeText}, Status: ${statusText}`;
      
      // 如果是市价单且状态是 accepted，添加非交易时段提示
      if (orderType === 'market' && order.status.toLowerCase() === 'accepted') {
        successMessage += ' (may remain accepted until market opens)';
      }
      
      message.success(successMessage, 8);
      
      setOrderModalVisible(false);
      form.resetFields();
      
      // 立即刷新相关数据
      console.log(`订单下单成功，立即刷新 orders、positions、account`);
      await Promise.all([
        loadOrders(),
        loadPositions(),
        loadAccount()  // 无论买卖都刷新账户
      ]);
      
      // 启动订单状态轮询
      if (order.orderId) {
        console.log(`启动订单状态轮询: ${order.orderId}，状态: ${order.status}`);
        pollOrderStatus(order.orderId);
      }
      
    } catch (error: any) {
      console.error('下单失败:', error);
      
      // 解析错误信息
      let errorMsg = 'Failed to place order';
      let errorDetails = '';
      
      if (error.response) {
        // 后端返回的错误
        const errorData = error.response.data;
        if (errorData && errorData.error) {
          if (typeof errorData.error === 'string') {
            errorMsg = errorData.error;
          } else if (errorData.error.message) {
            errorMsg = errorData.error.message;
            if (errorData.error.code) {
              errorDetails = `Code: ${errorData.error.code}`;
            }
          }
        } else if (error.response.status === 400) {
          errorMsg = 'Invalid order parameters';
        } else if (error.response.status === 403) {
          errorMsg = 'Trading is blocked for this account';
        } else if (error.response.status === 422) {
          errorMsg = 'Order validation failed';
        } else if (error.response.status === 429) {
          errorMsg = 'Rate limit exceeded, please wait before trying again';
        }
      } else if (error.request) {
        // 请求已发送但无响应
        errorMsg = 'No response from server. Please check your connection.';
      } else {
        // 其他错误
        errorMsg = error.message || 'Failed to place order';
      }
      
      // 显示详细的错误信息
      const fullErrorMsg = errorDetails ? `${errorMsg} (${errorDetails})` : errorMsg;
      message.error(`Order Failed: ${fullErrorMsg}`, 6);
      
      // 不要清空表单，让用户可以修正错误
      // 保持弹窗打开，表单数据不变
      
    } finally {
      setPlacingOrder(false);
      setSubmittingOrder(false);
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    const order = orders.find(o => o.orderId === orderId);
    if (!order) {
      message.error('Order not found');
      return;
    }
    
    // 设置 loading 状态
    setCancellingOrderId(orderId);
    
    try {
      const result = await alpacaBrokerService.cancelOrder(orderId);
      if (result.success) {
        message.success(`Order cancelled successfully: ${order.symbol} ${order.side.toUpperCase()} ${order.quantity}`, 3);
        
        // 立即更新本地订单状态
        setOrders(prev => prev.map(o => 
          o.orderId === orderId ? { ...o, status: 'canceled' } : o
        ));
        
        // 立即刷新所有相关数据
        console.log(`订单取消成功，立即刷新 orders、positions、account`);
        await Promise.all([
          loadOrders(),
          loadPositions(),
          loadAccount()
        ]);
      } else {
        message.error(result.message || 'Failed to cancel order');
      }
    } catch (error: any) {
      const errorMsg = error.response?.data?.error?.message || error.message || 'Failed to cancel order';
      message.error(`Cancel Error: ${errorMsg}`);
    } finally {
      setCancellingOrderId(null);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const accountColumns = [
    {
      title: 'Metric',
      dataIndex: 'metric',
      key: 'metric',
    },
    {
      title: 'Value',
      dataIndex: 'value',
      key: 'value',
    },
  ];

  const positionsColumns = [
    {
      title: 'Symbol',
      dataIndex: 'symbol',
      key: 'symbol',
      width: 100,
    },
    {
      title: 'Side',
      dataIndex: 'side',
      key: 'side',
      width: 80,
      render: (side: string) => (
        <Tag color={side === 'long' ? 'green' : 'red'}>
          {side.toUpperCase()}
        </Tag>
      ),
    },
    {
      title: 'Quantity',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 100,
      render: (value: number) => value.toLocaleString(),
    },
    {
      title: 'Avg Price',
      dataIndex: 'avgPrice',
      key: 'avgPrice',
      width: 120,
      render: (value: number) => `$${value.toFixed(2)}`,
    },
    {
      title: 'Current Price',
      dataIndex: 'currentPrice',
      key: 'currentPrice',
      width: 120,
      render: (value: number) => `$${value.toFixed(2)}`,
    },
    {
      title: 'Market Value',
      dataIndex: 'marketValue',
      key: 'marketValue',
      width: 130,
      render: (value: number) => `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    },
    {
      title: 'Unrealized P/L',
      dataIndex: 'unrealizedPL',
      key: 'unrealizedPL',
      width: 130,
      render: (value: number) => (
        <Text strong style={{ color: value >= 0 ? '#3f8600' : '#cf1322' }}>
          ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </Text>
      ),
    },
    {
      title: 'P/L %',
      dataIndex: 'unrealizedPLPercent',
      key: 'unrealizedPLPercent',
      width: 100,
      render: (value: number) => (
        <Text strong style={{ color: value >= 0 ? '#3f8600' : '#cf1322' }}>
          {value.toFixed(2)}%
        </Text>
      ),
    },
  ];

  const ordersColumns = [
    {
      title: 'Order ID',
      dataIndex: 'orderId',
      key: 'orderId',
      width: 180,
      render: (id: string) => <Text code>{id.substring(0, 8)}...</Text>,
    },
    {
      title: 'Symbol',
      dataIndex: 'symbol',
      key: 'symbol',
      width: 100,
    },
    {
      title: 'Side',
      dataIndex: 'side',
      key: 'side',
      width: 80,
      render: (side: string) => (
        <Tag color={side === 'buy' ? 'green' : 'red'}>
          {side.toUpperCase()}
        </Tag>
      ),
    },
    {
      title: 'Quantity',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 100,
      render: (value: number) => value.toLocaleString(),
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      width: 100,
      render: (type: string) => <Tag>{type.toUpperCase()}</Tag>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: string) => {
        let color = 'default';
        let text = status;
        
        switch (status.toLowerCase()) {
          case 'filled':
            color = 'success';
            text = 'FILLED';
            break;
          case 'accepted':
            color = 'processing';
            text = 'ACCEPTED';
            break;
          case 'canceled':
            color = 'default';
            text = 'CANCELED';
            break;
          case 'rejected':
            color = 'error';
            text = 'REJECTED';
            break;
          case 'expired':
            color = 'warning';
            text = 'EXPIRED';
            break;
          default:
            color = 'default';
            text = status.toUpperCase();
        }
        
        return <Tag color={color}>{text}</Tag>;
      },
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (date: string) => {
        if (!date) return '-';
        const d = new Date(date);
        return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      },
    },
    {
      title: 'Filled',
      dataIndex: 'filledQty',
      key: 'filledQty',
      width: 100,
      render: (filledQty: number, record: AlpacaOrder) => {
        if (filledQty === 0) return '-';
        return `${filledQty.toLocaleString()} / ${record.quantity.toLocaleString()}`;
      },
    },
    {
      title: 'Filled At',
      dataIndex: 'filledAt',
      key: 'filledAt',
      width: 180,
      render: (date: string | null) => {
        if (!date) return '-';
        const d = new Date(date);
        return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      },
    },
    {
      title: 'Price',
      key: 'price',
      width: 120,
      render: (_: any, record: AlpacaOrder) => {
        if (record.limitPrice) {
          return `LMT $${record.limitPrice.toFixed(2)}`;
        } else if (record.stopPrice) {
          return `STP $${record.stopPrice.toFixed(2)}`;
        } else {
          return 'MKT';
        }
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 100,
      render: (_: any, record: AlpacaOrder) => {
        const canCancel = ['accepted', 'partially_filled'].includes(record.status.toLowerCase());
        const isCancelling = cancellingOrderId === record.orderId;
        
        return canCancel ? (
          <Button
            size="small"
            danger
            icon={<CloseOutlined />}
            onClick={() => handleCancelOrder(record.orderId)}
            loading={isCancelling}
            disabled={isCancelling}
          >
            {isCancelling ? 'Cancelling...' : 'Cancel'}
          </Button>
        ) : null;
      },
    },
  ];

  const accountData = account ? [
    { key: '1', metric: 'Status', value: account.status },
    { key: '2', metric: 'Account Number', value: account.accountNumber },
    { key: '3', metric: 'Cash', value: `$${account.cash.toFixed(2)}` },
    { key: '4', metric: 'Portfolio Value', value: `$${account.portfolioValue.toFixed(2)}` },
    { key: '5', metric: 'Equity', value: `$${account.equity.toFixed(2)}` },
    { key: '6', metric: 'Buying Power', value: `$${account.buyingPower.toFixed(2)}` },
    { key: '7', metric: 'Long Market Value', value: `$${account.longMarketValue.toFixed(2)}` },
    { key: '8', metric: 'Short Market Value', value: `$${account.shortMarketValue.toFixed(2)}` },
    { key: '9', metric: 'Currency', value: account.currency },
    { key: '10', metric: 'Pattern Day Trader', value: account.patternDayTrader ? 'Yes' : 'No' },
    { key: '11', metric: 'Trading Blocked', value: account.tradingBlocked ? 'Yes' : 'No' },
    { key: '12', metric: 'Account Blocked', value: account.accountBlocked ? 'Yes' : 'No' },
  ] : [];

  return (
    <div style={{ padding: '24px' }}>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col span={24}>
          <Space>
            <Title level={2}>Alpaca Paper Trading</Title>
            <Button
              type="primary"
              icon={<ReloadOutlined />}
              loading={loading.all}
              onClick={loadAll}
            >
              Refresh All
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setOrderModalVisible(true)}
            >
              New Order
            </Button>
          </Space>
        </Col>
      </Row>

      {/* Status Bar */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col span={24}>
          <Card size="small">
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              <Row justify="space-between" align="middle">
                <Col>
                  <Space>
                    <Text type="secondary">
                      Last refreshed: {lastRefreshed ? lastRefreshed.toLocaleTimeString() : 'Never'}
                    </Text>
                    {pollingActive && (
                      <Tag color="processing" icon={<ReloadOutlined spin />}>
                        Polling active...
                      </Tag>
                    )}
                    {!pollingActive && lastRefreshed && (
                      <Tag color="default">Auto refresh stopped</Tag>
                    )}
                  </Space>
                </Col>
                <Col>
                  {trackingOrderId && (
                    <Text type="secondary">
                      Tracking order: <Text code>{trackingOrderId.substring(0, 8)}...</Text>
                    </Text>
                  )}
                </Col>
              </Row>
            </Space>
          </Card>
        </Col>
      </Row>

      {/* Order Status Explanation */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col span={24}>
          <Card size="small" type="inner">
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              <Text strong>Order Status Guide:</Text>
              <Row gutter={[16, 8]}>
                <Col span={6}>
                  <Space>
                    <Tag color="processing">ACCEPTED</Tag>
                    <Text type="secondary">Submitted, not filled yet</Text>
                  </Space>
                </Col>
                <Col span={6}>
                  <Space>
                    <Tag color="success">FILLED</Tag>
                    <Text type="secondary">Order executed</Text>
                  </Space>
                </Col>
                <Col span={6}>
                  <Space>
                    <Tag color="default">CANCELED</Tag>
                    <Text type="secondary">Order canceled</Text>
                  </Space>
                </Col>
                <Col span={6}>
                  <Space>
                    <Tag color="error">REJECTED</Tag>
                    <Text type="secondary">Order rejected</Text>
                  </Space>
                </Col>
              </Row>
              <Row>
                <Col span={24}>
                  <Text type="warning">
                    ⚠️ <Text strong>Note:</Text> During non-trading hours, market orders may remain in <Tag color="processing">ACCEPTED</Tag> status and will not appear in Positions until filled.
                  </Text>
                </Col>
              </Row>
            </Space>
          </Card>
        </Col>
      </Row>

      {/* Account Summary */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={24}>
          <Card
            title={
              <Space>
                <DollarOutlined />
                <span>Account Summary</span>
                <Button
                  size="small"
                  icon={<ReloadOutlined />}
                  loading={loading.account}
                  onClick={loadAccount}
                />
              </Space>
            }
          >
            {loading.account ? (
              <div style={{ textAlign: 'center', padding: '20px' }}>
                <Spin tip="Loading account..." />
              </div>
            ) : account ? (
              <Row gutter={[16, 16]}>
                <Col xs={12} sm={8} md={6} lg={4}>
                  <Statistic
                    title="Cash"
                    value={account.cash}
                    precision={2}
                    prefix="$"
                    valueStyle={{ color: '#3f8600' }}
                  />
                </Col>
                <Col xs={12} sm={8} md={6} lg={4}>
                  <Statistic
                    title="Portfolio Value"
                    value={account.portfolioValue}
                    precision={2}
                    prefix="$"
                  />
                </Col>
                <Col xs={12} sm={8} md={6} lg={4}>
                  <Statistic
                    title="Equity"
                    value={account.equity}
                    precision={2}
                    prefix="$"
                    valueStyle={{ color: account.equity >= 0 ? '#3f8600' : '#cf1322' }}
                  />
                </Col>
                <Col xs={12} sm={8} md={6} lg={4}>
                  <Statistic
                    title="Buying Power"
                    value={account.buyingPower}
                    precision={2}
                    prefix="$"
                    valueStyle={{ color: '#1890ff' }}
                  />
                </Col>
                <Col xs={12} sm={8} md={6} lg={4}>
                  <Statistic
                    title="Long Value"
                    value={account.longMarketValue}
                    precision={2}
                    prefix="$"
                  />
                </Col>
                <Col xs={12} sm={8} md={6} lg={4}>
                  <Statistic
                    title="Short Value"
                    value={account.shortMarketValue}
                    precision={2}
                    prefix="$"
                  />
                </Col>
                <Col span={24}>
                  <div style={{ marginTop: '16px', padding: '8px 0', borderTop: '1px solid #f0f0f0' }}>
                    <Space size="large">
                      <Text>Account: <strong>{account.accountNumber}</strong></Text>
                      <Text>Status: <Tag color={account.status === 'ACTIVE' ? 'success' : 'error'}>{account.status}</Tag></Text>
                      <Text>Currency: <strong>{account.currency}</strong></Text>
                      {account.tradingBlocked && <Tag color="warning">Trading Blocked</Tag>}
                      {account.accountBlocked && <Tag color="error">Account Blocked</Tag>}
                      {account.patternDayTrader && <Tag color="purple">Pattern Day Trader</Tag>}
                    </Space>
                  </div>
                </Col>
              </Row>
            ) : (
              <div style={{ textAlign: 'center', padding: '20px' }}>
                <Text type="secondary">No account data available</Text>
              </div>
            )}
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        {/* Positions */}
        <Col span={12}>
          <Card
            title={
              <Space>
                <StockOutlined />
                <span>Positions ({positions.length})</span>
                <Button
                  size="small"
                  icon={<ReloadOutlined />}
                  loading={loading.positions}
                  onClick={loadPositions}
                />
              </Space>
            }
          >
            <Table
              columns={positionsColumns}
              dataSource={positions}
              rowKey="symbol"
              pagination={false}
              scroll={{ y: 300 }}
              locale={{
                emptyText: (
                  <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                    <StockOutlined style={{ fontSize: '48px', color: '#d9d9d9', marginBottom: '16px' }} />
                    <div style={{ marginBottom: '8px' }}>
                      <Text strong>No positions yet</Text>
                    </div>
                    <Text type="secondary">
                      Filled buy orders will appear here.
                    </Text>
                    {orders.some(o => o.status.toLowerCase() === 'accepted') && (
                      <div style={{ marginTop: '16px' }}>
                        <Text type="warning">
                          ⚠️ You have pending buy orders that are not filled yet.
                        </Text>
                      </div>
                    )}
                  </div>
                )
              }}
            />
          </Card>
        </Col>

        {/* Orders */}
        <Col span={12}>
          <Card
            title={
              <Space>
                <OrderedListOutlined />
                <span>Orders ({filteredOrders.length})</span>
                <Select
                  size="small"
                  value={orderFilter}
                  onChange={setOrderFilter}
                  style={{ width: 100 }}
                >
                  <Select.Option value="all">All</Select.Option>
                  <Select.Option value="open">Open</Select.Option>
                  <Select.Option value="filled">Filled</Select.Option>
                  <Select.Option value="canceled">Canceled</Select.Option>
                </Select>
                <Button
                  size="small"
                  icon={<ReloadOutlined />}
                  loading={loading.orders}
                  onClick={loadOrders}
                />
              </Space>
            }
          >
            <Table
              columns={ordersColumns}
              dataSource={filteredOrders}
              rowKey="id"
              pagination={false}
              scroll={{ y: 300 }}
              locale={{ emptyText: 'No orders' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Order Modal */}
      <Modal
        title="Place New Order"
        open={orderModalVisible}
        onCancel={() => {
          setOrderModalVisible(false);
          form.resetFields();
        }}
        footer={null}
        width={400}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handlePlaceOrder}
          initialValues={{
            side: 'buy',
            type: 'market',
            time_in_force: 'gtc'
          }}
          onValuesChange={(changedValues, allValues) => {
            // 更新 symbol 状态
            if (changedValues.symbol !== undefined) {
              setCurrentSymbol(changedValues.symbol ? changedValues.symbol.trim().toUpperCase() : '');
            }
            
            // 更新 order type 状态，并清理隐藏字段的值
            if (changedValues.type !== undefined) {
              const newType = changedValues.type || 'market';
              setCurrentOrderType(newType);
              
              // 清理隐藏字段的值
              const formValues = form.getFieldsValue();
              const updates: any = {};
              
              if (newType === 'market') {
                // 切换到 market，清理所有价格字段
                if (formValues.limit_price) updates.limit_price = undefined;
                if (formValues.stop_price) updates.stop_price = undefined;
              } else if (newType === 'limit') {
                // 切换到 limit，清理 stop_price
                if (formValues.stop_price) updates.stop_price = undefined;
              } else if (newType === 'stop') {
                // 切换到 stop，清理 limit_price
                if (formValues.limit_price) updates.limit_price = undefined;
              }
              // stop_limit 需要两个字段，不清理
              
              if (Object.keys(updates).length > 0) {
                form.setFieldsValue(updates);
              }
            }
          }}
        >
          <Form.Item
            name="symbol"
            label="Symbol"
            rules={[{ required: true, message: 'Please enter symbol' }]}
          >
            <Input placeholder="e.g., AAPL" />
          </Form.Item>

          <Form.Item
            name="qty"
            label="Quantity"
            rules={[{ required: true, message: 'Please enter quantity' }]}
          >
            <Input placeholder="e.g., 1" />
          </Form.Item>
          
          {/* 上下文信息显示 */}
          <div style={{ marginBottom: '16px', padding: '12px', backgroundColor: '#fafafa', border: '1px solid #d9d9d9', borderRadius: '4px' }}>
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              {/* Buying Power */}
              <div>
                <Text strong>Buying Power: </Text>
                <Text type={account && account.buyingPower > 0 ? 'success' : 'danger'}>
                  ${account ? account.buyingPower.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                </Text>
              </div>
              
              {/* Current Position */}
              {currentSymbol && (
                <div>
                  <Text strong>{currentSymbol} Position: </Text>
                  {(() => {
                    const position = positions.find(p => p.symbol === currentSymbol);
                    if (position) {
                      return (
                        <Text type="success">
                          {position.quantity.toLocaleString()} shares
                          {position.side === 'long' ? ' (Long)' : position.side === 'short' ? ' (Short)' : ''}
                        </Text>
                      );
                    } else {
                      return <Text type="secondary">0 shares</Text>;
                    }
                  })()}
                </div>
              )}
              
              {/* 非交易时段提示 */}
              <div>
                <Text type="warning">
                  ⚠️ Market orders placed outside trading hours may remain <Tag color="processing" style={{ margin: '0 4px' }}>ACCEPTED</Tag> until market opens.
                </Text>
              </div>
              
              {/* 订单类型说明 */}
              <div>
                <Text type="secondary">
                  {currentOrderType === 'market' && 'Market: Executes at best available price'}
                  {currentOrderType === 'limit' && 'Limit: Only executes at specified price or better'}
                  {currentOrderType === 'stop' && 'Stop: Activates when price reaches stop level'}
                  {currentOrderType === 'stop_limit' && 'Stop-Limit: Activates at stop price, executes at limit price'}
                </Text>
              </div>
            </Space>
          </div>

          <Form.Item
            name="side"
            label="Side"
            rules={[{ required: true }]}
          >
            <Select>
              <Option value="buy">Buy</Option>
              <Option value="sell">Sell</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="type"
            label="Order Type"
          >
            <Select>
              <Option value="market">Market</Option>
              <Option value="limit">Limit</Option>
              <Option value="stop">Stop</Option>
              <Option value="stop_limit">Stop Limit</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="time_in_force"
            label="Time in Force"
          >
            <Select>
              <Option value="gtc">Good Till Canceled (GTC)</Option>
              <Option value="day">Day</Option>
              <Option value="ioc">Immediate or Cancel (IOC)</Option>
              <Option value="fok">Fill or Kill (FOK)</Option>
            </Select>
          </Form.Item>

          {/* 根据订单类型动态显示价格字段 */}
          {currentOrderType === 'limit' && (
            <Form.Item
              name="limit_price"
              label="Limit Price"
              rules={[{ required: true, message: 'Limit price is required for limit orders' }]}
            >
              <Input placeholder="e.g., 150.00" />
            </Form.Item>
          )}
          
          {currentOrderType === 'stop' && (
            <Form.Item
              name="stop_price"
              label="Stop Price"
              rules={[{ required: true, message: 'Stop price is required for stop orders' }]}
            >
              <Input placeholder="e.g., 145.00" />
            </Form.Item>
          )}
          
          {currentOrderType === 'stop_limit' && (
            <>
              <Form.Item
                name="stop_price"
                label="Stop Price"
                rules={[{ required: true, message: 'Stop price is required for stop-limit orders' }]}
              >
                <Input placeholder="e.g., 145.00" />
              </Form.Item>
              <Form.Item
                name="limit_price"
                label="Limit Price"
                rules={[{ required: true, message: 'Limit price is required for stop-limit orders' }]}
              >
                <Input placeholder="e.g., 150.00" />
              </Form.Item>
            </>
          )}
          
          {/* Market 订单不显示价格字段，但添加说明 */}
          {currentOrderType === 'market' && (
            <div style={{ marginBottom: '16px', padding: '8px 12px', backgroundColor: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: '4px' }}>
              <Text type="secondary">
                Market orders execute at the best available price. No price fields required.
              </Text>
            </div>
          )}

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={placingOrder}
              disabled={submittingOrder}
              block
              style={{ height: '40px', fontSize: '16px' }}
            >
              {placingOrder ? 'Submitting Order...' : 'Place Order'}
            </Button>
            {placingOrder && (
              <div style={{ textAlign: 'center', marginTop: '8px' }}>
                <Text type="secondary">Please wait while we submit your order...</Text>
              </div>
            )}
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default AlpacaPaperTrading;