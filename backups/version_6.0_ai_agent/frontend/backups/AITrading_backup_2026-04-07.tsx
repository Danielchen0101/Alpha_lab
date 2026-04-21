import React, { useState, useEffect } from 'react';
import {
  Card, Typography, Button, Divider, Table, Tag, Progress, Row, Col, Statistic,
  Select, Switch, Form, Input, Modal, Alert, Space, Descriptions, Collapse,
  Radio, InputNumber, List, message, Popconfirm, Segmented
} from 'antd';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import {
  RobotOutlined, SettingOutlined, EyeOutlined, EyeInvisibleOutlined,
  SafetyOutlined, ReloadOutlined, PlusOutlined
} from '@ant-design/icons';
import aiTradingService from '../services/aiTradingService';
import alpacaBrokerService from '../services/alpacaBrokerService';

const { Title, Text } = Typography;
const { Option } = Select;
const { Panel } = Collapse;
const { TextArea } = Input;

const AITrading: React.FC = () => {
  const [accountSnapshot, setAccountSnapshot] = useState({
    cash: 0, equity: 0, buyingPower: 0, portfolioValue: 0,
    positionsCount: 0, openOrdersCount: 0, accountNumber: '', status: ''
  });

  const [tradingEnvironment, setTradingEnvironment] = useState<'paper' | 'live'>('paper');
  const [showLiveWarning, setShowLiveWarning] = useState(false);

  // Alpaca 数据状态
  const [alpacaAccount, setAlpacaAccount] = useState<any>(null);
  const [alpacaPositions, setAlpacaPositions] = useState<any[]>([]);
  const [alpacaOrders, setAlpacaOrders] = useState<any[]>([]);
  const [alpacaOrdersHistory, setAlpacaOrdersHistory] = useState<any[]>([]);
  const [portfolioHistory, setPortfolioHistory] = useState<any[]>([]);
  const [portfolioRange, setPortfolioRange] = useState<string>('1D');
  const [portfolioChange, setPortfolioChange] = useState({ value: 0, percent: 0 });
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

  // 加载初始数据
  useEffect(() => {
    loadInitialData();
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



      // Block 2: 使用统一刷新函数加载详细数据
      await refreshAllAlpacaData();

      console.log('初始数据加载完成');
    } catch (error) {
      console.error('加载初始数据失败:', error);
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

  // Block 2: 统一刷新所有 Alpaca 数据
  const refreshAllAlpacaData = async () => {
    console.log('开始统一刷新所有 Alpaca 数据...');
    setLoadingData(prev => ({ ...prev, account: true, positions: true, orders: true, history: true, portfolio: true }));

    try {
      // 并行请求所有 Alpaca 数据
      const [
        accountResponse,
        positionsResponse,
        ordersResponse,
        historyResponse,
        snapshotResponse,
        portfolioResponse
      ] = await Promise.allSettled([
        aiTradingService.getAlpacaAccount(),
        aiTradingService.getAlpacaPositions(),
        aiTradingService.getAlpacaOrders('open'),
        aiTradingService.getAlpacaOrdersHistory(100),  // 增加到100条历史订单
        aiTradingService.getAccountSnapshot(),
        aiTradingService.getPortfolioHistory(portfolioRange)
      ]);

      console.log('统一刷新完成，处理响应...');

      // 处理账户数据
      if (accountResponse.status === 'fulfilled' && accountResponse.value?.success) {
        const accountData = accountResponse.value.data;
        setAlpacaAccount(accountData);
        console.log('账户数据更新成功:', accountData?.accountNumber);
      } else {
        console.error('账户数据获取失败:', accountResponse.status === 'rejected' ? accountResponse.reason : '响应不成功');
      }

      // 处理持仓数据
      if (positionsResponse.status === 'fulfilled' && positionsResponse.value?.success) {
        const positionsData = positionsResponse.value.data || [];
        setAlpacaPositions(positionsData);
        console.log('持仓数据更新成功:', positionsData.length, '个持仓');
      } else {
        console.error('持仓数据获取失败:', positionsResponse.status === 'rejected' ? positionsResponse.reason : '响应不成功');
      }

      // 处理订单数据
      if (ordersResponse.status === 'fulfilled' && ordersResponse.value?.success) {
        const ordersData = ordersResponse.value.data || [];
        setAlpacaOrders(ordersData);
        console.log('订单数据更新成功:', ordersData.length, '个订单');
      } else {
        console.error('订单数据获取失败:', ordersResponse.status === 'rejected' ? ordersResponse.reason : '响应不成功');
      }

      // 处理历史订单数据
      if (historyResponse.status === 'fulfilled' && historyResponse.value?.success) {
        const historyData = historyResponse.value.data || [];
        setAlpacaOrdersHistory(historyData);
        console.log('历史订单数据更新成功:', historyData.length, '个历史订单');
      } else {
        console.error('历史订单数据获取失败:', historyResponse.status === 'rejected' ? historyResponse.reason : '响应不成功');
      }

      // 处理账户快照
      if (snapshotResponse.status === 'fulfilled') {
        const snapshot = snapshotResponse.value;
        setAccountSnapshot(prev => ({
          ...prev,
          cash: snapshot.cash || 0,
          equity: snapshot.equity || 0,
          buyingPower: snapshot.buyingPower || 0,
          portfolioValue: snapshot.portfolioValue || 0,
          positionsCount: snapshot.positionsCount || 0,
          openOrdersCount: snapshot.openOrdersCount || 0,
          accountNumber: snapshot.accountNumber || prev.accountNumber,
          status: snapshot.status || prev.status
        }));
        console.log('账户快照更新成功');
      } else {
        console.error('账户快照获取失败:', snapshotResponse.status === 'rejected' ? snapshotResponse.reason : '响应不成功');
      }

      // 处理portfolio历史数据
      if (portfolioResponse.status === 'fulfilled' && portfolioResponse.value?.success) {
        const portfolioData = portfolioResponse.value.data || [];
        setPortfolioHistory(portfolioData);
        console.log('Portfolio历史数据更新成功:', portfolioData.length, '个数据点');

        // 使用后端提供的total_change和total_change_pct（如果可用）
        // 否则基于图表数据的第一点和最后一点计算
        if (portfolioResponse.value?.total_change !== undefined && portfolioResponse.value?.total_change_pct !== undefined) {
          // 使用后端计算的值
          setPortfolioChange({
            value: portfolioResponse.value.total_change,
            percent: portfolioResponse.value.total_change_pct
          });
          console.log('使用后端计算的Portfolio变化:', {
            total_change: portfolioResponse.value.total_change,
            total_change_pct: portfolioResponse.value.total_change_pct
          });
        } else if (portfolioData.length >= 2) {
          // 过滤掉无效的数据点
          const validData = portfolioData.filter((item: any) => {
            const value = item?.value;
            const timestamp = item?.timestamp;

            // 检查value是否有效
            if (typeof value !== 'number' || isNaN(value)) {
              return false;
            }

            // 检查timestamp是否有效
            if (!timestamp) {
              return false;
            }

            // 处理Unix时间戳（秒）或ISO字符串
            let date: Date;
            if (typeof timestamp === 'number' && timestamp > 1000000000) {
              // Unix时间戳（秒）
              date = new Date(timestamp * 1000);
            } else if (typeof timestamp === 'string') {
              // ISO字符串
              date = new Date(timestamp);
            } else {
              return false;
            }

            return !isNaN(date.getTime());
          });

          if (validData.length >= 2) {
            const firstValue = validData[0]?.value || 0;
            const lastValue = validData[validData.length - 1]?.value || 0;
            const changeValue = lastValue - firstValue;
            const changePercent = firstValue > 0 ? (changeValue / firstValue) * 100 : 0;

            setPortfolioChange({
              value: changeValue,
              percent: changePercent
            });
            console.log('前端计算的Portfolio变化:', {
              firstValue,
              lastValue,
              changeValue,
              changePercent,
              dataPoints: validData.length
            });
          } else {
            console.warn('有效数据点不足，无法计算变化');
            setPortfolioChange({ value: 0, percent: 0 });
          }
        } else {
          setPortfolioChange({ value: 0, percent: 0 });
        }
      } else {
        console.error('Portfolio历史数据获取失败:', portfolioResponse.status === 'rejected' ? portfolioResponse.reason : '响应不成功');
      }

      message.success('Alpaca 数据刷新完成');
    } catch (error) {
      console.error('统一刷新 Alpaca 数据时发生错误:', error);
      message.error('刷新数据失败');
    } finally {
      setLoadingData(prev => ({ ...prev, account: false, positions: false, orders: false, history: false, portfolio: false }));
    }
  };

  // Block 2: 加载详细数据（兼容旧代码）
  const loadDetailedData = async () => {
    console.log('使用 loadDetailedData（旧方法），建议使用 refreshAllAlpacaData');
    await refreshAllAlpacaData();
  };

  // 刷新portfolio数据（切换时间范围时调用）
  const refreshPortfolioData = async (range: string) => {
    console.log('刷新portfolio数据，范围:', range);
    setPortfolioRange(range);
    setLoadingData(prev => ({ ...prev, portfolio: true }));

    try {
      const response = await aiTradingService.getPortfolioHistory(range);
      if (response.success && response.data) {
        const portfolioData = response.data || [];
        setPortfolioHistory(portfolioData);
        console.log('Portfolio数据更新成功:', portfolioData.length, '个数据点');

        // 使用后端提供的total_change和total_change_pct（如果可用）
        // 否则基于图表数据的第一点和最后一点计算
        if (response.total_change !== undefined && response.total_change_pct !== undefined) {
          // 使用后端计算的值
          setPortfolioChange({
            value: response.total_change,
            percent: response.total_change_pct
          });
          console.log('使用后端计算的Portfolio变化:', {
            total_change: response.total_change,
            total_change_pct: response.total_change_pct
          });
        } else if (portfolioData.length >= 2) {
          // 过滤掉无效的数据点
          const validData = portfolioData.filter((item: any) => {
            const value = item?.value;
            const timestamp = item?.timestamp;

            // 检查value是否有效
            if (typeof value !== 'number' || isNaN(value)) {
              return false;
            }

            // 检查timestamp是否有效
            if (!timestamp) {
              return false;
            }

            // 处理Unix时间戳（秒）或ISO字符串
            let date: Date;
            if (typeof timestamp === 'number' && timestamp > 1000000000) {
              // Unix时间戳（秒）
              date = new Date(timestamp * 1000);
            } else if (typeof timestamp === 'string') {
              // ISO字符串
              date = new Date(timestamp);
            } else {
              return false;
            }

            return !isNaN(date.getTime());
          });

          if (validData.length >= 2) {
            const firstValue = validData[0]?.value || 0;
            const lastValue = validData[validData.length - 1]?.value || 0;
            const changeValue = lastValue - firstValue;
            const changePercent = firstValue > 0 ? (changeValue / firstValue) * 100 : 0;

            setPortfolioChange({
              value: changeValue,
              percent: changePercent
            });
            console.log('前端计算的Portfolio变化:', {
              firstValue,
              lastValue,
              changeValue,
              changePercent,
              dataPoints: validData.length
            });
          } else {
            console.warn('有效数据点不足，无法计算变化');
            setPortfolioChange({ value: 0, percent: 0 });
          }
        } else {
          setPortfolioChange({ value: 0, percent: 0 });
        }
      }
    } catch (error) {
      console.error('刷新portfolio数据失败:', error);
    } finally {
      setLoadingData(prev => ({ ...prev, portfolio: false }));
    }
  };

  // Block 1: DeepSeek 配置相关函数
  const handleTestConnection = async () => {
    if (!deepseekConfig.apiKey) {
      message.error('请输入 DeepSeek API Key');
      return;
    }

    setLoading(prev => ({ ...prev, testConnection: true }));

    try {
      const response = await aiTradingService.testProviderConnection(deepseekConfig);
      if (response.success && response.valid) {
        message.success('DeepSeek 连接测试成功: ' + response.message);
      } else {
        message.error('DeepSeek 连接测试失败: ' + response.message);
      }
    } catch (error) {
      message.error('DeepSeek 连接测试失败');
    } finally {
      setLoading(prev => ({ ...prev, testConnection: false }));
    }
  };

  const handleSaveSettings = async () => {
    if (!deepseekConfig.apiKey) {
      message.error('请输入 DeepSeek API Key');
      return;
    }

    setLoading(prev => ({ ...prev, saveSettings: true }));

    try {
      const result = await aiTradingService.saveProviderConfig(deepseekConfig);

      if (result?.success === true) {
        message.success('DeepSeek 配置保存成功');
        setShowApiKeyModal(false);

        // 如果需要刷新配置，单独处理，不要覆盖保存成功状态
        try {
          // 可以在这里刷新配置，但不要影响保存成功的提示
          console.log('保存成功，可以刷新配置');
        } catch (e) {
          console.warn('刷新配置失败，但不影响保存成功状态', e);
        }
      } else {
        message.error('DeepSeek 配置保存失败');
      }
    } catch (error) {
      console.error('保存配置异常:', error);
      message.error('DeepSeek 配置保存失败');
    } finally {
      setLoading(prev => ({ ...prev, saveSettings: false }));
    }
  };

  const handleEnvironmentChange = async (env: 'paper' | 'live') => {
    if (env === 'live') {
      setShowLiveWarning(true);
    } else {
      try {
        const response = await aiTradingService.setTradingEnvironment({
          environment: env
        });
        if (response.success) {
          setTradingEnvironment(env);
          message.info('已切换到 Paper Trading 环境');
          // 切换环境后刷新所有数据
          setTimeout(() => {
            refreshAllAlpacaData();
          }, 500);
        } else {
          message.error('环境切换失败');
        }
      } catch (error) {
        message.error('环境切换失败');
      }
    }
  };

  const confirmLiveSwitch = async () => {
    try {
      const response = await aiTradingService.setTradingEnvironment({
        environment: 'live'
      });
      if (response.success) {
        setTradingEnvironment('live');
        setShowLiveWarning(false);
        message.warning('已切换到 Live Trading 环境，请谨慎操作！');
        // 切换环境后刷新所有数据
        setTimeout(() => {
          refreshAllAlpacaData();
        }, 500);
      } else {
        message.error('切换到 Live Trading 失败');
      }
    } catch (error) {
      message.error('切换到 Live Trading 失败');
    }
  };

  // Block 3: AI Chat 函数
  const handleSendChatMessage = async () => {
    if (!chatInput.trim()) {
      message.warning('请输入消息');
      return;
    }

    const values = await form.validateFields();
    const symbol = values.symbol;

    setChatLoading(true);

    try {
      // 添加用户消息
      const userMessage = {
        role: 'user',
        content: chatInput,
        timestamp: new Date().toISOString()
      };

      setChatMessages(prev => [...prev, userMessage]);

      // 发送到后端
      const response = await aiTradingService.sendChatMessage(
        chatInput,
        symbol,
        chatMessages.map(msg => ({ role: msg.role, content: msg.content }))
      );

      if (response.success) {
        // 添加 AI 回复
        const aiMessage = {
          role: 'ai',
          content: response.response,
          timestamp: response.timestamp,
          strategyUpdated: response.strategy_updated,
          newStrategyState: response.new_strategy_state,
          isMockResponse: response.isMockResponse || false
        };

        setChatMessages(prev => [...prev, aiMessage]);

        // 如果策略有更新，更新状态
        if (response.strategy_updated && response.new_strategy_state) {
          setAiStatus(prev => ({
            ...prev,
            current_strategy_mode: response.new_strategy_state.current_strategy_mode,
            trading_bias: response.new_strategy_state.trading_bias,
            holding_horizon: response.new_strategy_state.holding_horizon
          }));
          message.success('AI 策略已根据您的对话调整');
        }

        // 清空输入框
        setChatInput('');
      } else {
        message.error('发送消息失败: ' + response.error);
      }
    } catch (error) {
      console.error('发送聊天消息失败:', error);
      message.error('发送消息失败');
    } finally {
      setChatLoading(false);
    }
  };

  const handleClearChat = async () => {
    try {
      const values = await form.validateFields();
      const symbol = values.symbol;

      const response = await aiTradingService.clearChatHistory(symbol);
      if (response.success) {
        setChatMessages([]);
        message.success(response.message);
      } else {
        message.error('清空聊天记录失败');
      }
    } catch (error) {
      message.error('清空聊天记录失败');
    }
  };

  const loadChatHistory = async () => {
    try {
      const values = await form.validateFields();
      const symbol = values.symbol;

      const response = await aiTradingService.getChatHistory(50, symbol);
      if (response.success) {
        const formattedMessages = response.history.map((item: any) => [
          {
            role: 'user',
            content: item.user_message,
            timestamp: item.timestamp
          },
          {
            role: 'ai',
            content: item.ai_response,
            timestamp: item.timestamp,
            strategyUpdated: item.strategy_adjustments !== null
          }
        ]).flat();

        setChatMessages(formattedMessages);
      }
    } catch (error) {
      console.error('加载聊天历史失败:', error);
    }
  };

  const handleAnalyze = async () => {
    const values = await form.validateFields();
    setLoading(prev => ({ ...prev, analyze: true }));

    try {
      // 收集上半部分的真实数据作为上下文
      const analysisContext = {
        // 1. 账户快照
        accountSnapshot: {
          cash: accountSnapshot.cash,
          equity: accountSnapshot.equity,
          buyingPower: accountSnapshot.buyingPower,
          portfolioValue: accountSnapshot.portfolioValue,
          positionsCount: accountSnapshot.positionsCount,
          openOrdersCount: accountSnapshot.openOrdersCount,
          accountNumber: accountSnapshot.accountNumber,
          status: accountSnapshot.status
        },

        // 2. 账户详情
        accountDetails: alpacaAccount,

        // 3. 当前持仓
        positions: alpacaPositions,

        // 4. 未平仓订单
        openOrders: alpacaOrders,

        // 5. 订单历史
        orderHistory: alpacaOrdersHistory.slice(0, 10), // 最近10条

        // 6. 投资组合表现
        portfolioPerformance: {
          history: portfolioHistory.slice(-20), // 最近20个数据点
          currentRange: portfolioRange,
          change: portfolioChange
        },

        // 7. 用户选择的股票代码
        symbol: values.symbol,

        // 8. 交易环境
        tradingEnvironment: tradingEnvironment,

        // 9. AI状态
        aiStatus: aiStatus
      };

      console.log('发送给AI的上下文数据:', analysisContext);

      // 调用AI分析，传入完整的上下文
      const response = await aiTradingService.previewTradeWithContext(values.symbol, analysisContext);

      if (response.success) {
        setAiDecision(response.decision);
        setAiStatus(prev => ({ ...prev, ai_status: 'ready' }));
        message.success('AI 分析完成 - 基于完整交易上下文');
      } else {
        message.error('AI 分析失败: ' + response.validation.message);
      }
    } catch (error) {
      message.error('AI 分析请求失败');
    } finally {
      setLoading(prev => ({ ...prev, analyze: false }));
    }
  };

  const handleExecute = async () => {
    if (!aiDecision) return;

    setLoading(prev => ({ ...prev, execute: true }));

    setTimeout(() => {
      setAiStatus(prev => ({ ...prev, ai_status: 'executed' }));
      setLoading(prev => ({ ...prev, execute: false }));
    }, 1000);
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'BUY': return 'green';
      case 'SELL': return 'red';
      case 'HOLD': return 'blue';
      default: return 'default';
    }
  };

  const historyColumns = [
    { title: 'Time', dataIndex: 'timestamp', key: 'timestamp', render: (text: string) => new Date(text).toLocaleTimeString() },
    { title: 'Symbol', dataIndex: 'symbol', key: 'symbol' },
    { title: 'Action', dataIndex: 'action', key: 'action', render: (action: string) => <Tag color={getActionColor(action)}>{action}</Tag> },
    { title: 'Qty', dataIndex: 'qty', key: 'qty' },
    { title: 'Confidence', dataIndex: 'confidence', key: 'confidence', render: (confidence: number) => <Progress percent={confidence} size="small" /> },
    { title: 'Risk', dataIndex: 'executable', key: 'executable', render: (executable: boolean) => (
      <Tag color={executable ? 'green' : 'red'}>{executable ? 'Passed' : 'Blocked'}</Tag>
    )},
    { title: 'Executed', dataIndex: 'executed', key: 'executed', render: (executed: boolean) => (
      executed ? <CheckOutlined style={{ color: '#52c41a' }} /> : <CloseOutlined style={{ color: '#ff4d4f' }} />
    )},
  ];

  return (
    <div>
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
        >
          Refresh All Alpaca Data
        </Button>
      </div>

      <Divider />

      {/* Block 1: AI Provider / Trading Environment 配置区 */}
      <div style={{ marginBottom: 24 }}>
        <Title level={4}><SettingOutlined style={{ marginRight: '8px' }} />AI Provider & Trading Environment</Title>

        <Row gutter={[16, 16]}>
          {/* 当前模式显示 */}
          <Col xs={24} lg={8}>
            <Card size="small" title="Current Status">
              <Descriptions column={1} size="small">
                <Descriptions.Item label="Environment">
                  <Tag color={tradingEnvironment === 'paper' ? 'blue' : 'red'} icon={<EnvironmentOutlined />}>
                    {tradingEnvironment === 'paper' ? 'Paper Trading' : 'LIVE TRADING'}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Provider">
                  <Tag color="purple" icon={<ApiOutlined />}>{deepseekConfig.provider}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Auto Trading">
                  <Tag color={aiStatus.auto_mode ? 'red' : 'default'}>
                    {aiStatus.auto_mode ? 'ON' : 'OFF'}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Human Confirm">
                  <Tag color={aiStatus.human_confirm_required ? 'green' : 'default'}>
                    {aiStatus.human_confirm_required ? 'ON' : 'OFF'}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="AI Status">
                  <Tag color={aiStatus.ai_status === 'ready' ? 'green' : 'default'}>
                    {aiStatus.ai_status.toUpperCase()}
                  </Tag>
                </Descriptions.Item>
              </Descriptions>
            </Card>
          </Col>

          {/* DeepSeek 配置 */}
          <Col xs={24} lg={8}>
            <Card size="small" title="DeepSeek Configuration">
              <Space direction="vertical" style={{ width: '100%' }}>
                <div>
                  <Text strong>API Key:</Text>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                    <Input
                      type={deepseekConfig.showApiKey ? 'text' : 'password'}
                      value={deepseekConfig.apiKey ? '••••••••••••••••' : ''}
                      placeholder="Enter DeepSeek API Key"
                      readOnly
                      style={{ flex: 1 }}
                    />
                    <Button
                      icon={deepseekConfig.showApiKey ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                      onClick={() => setDeepseekConfig(prev => ({ ...prev, showApiKey: !prev.showApiKey }))}
                    />
                    <Button type="primary" onClick={() => setShowApiKeyModal(true)}>
                      Configure
                    </Button>
                  </div>
                </div>

                <div>
                  <Text strong>Base URL:</Text>
                  <Input value={deepseekConfig.baseUrl} readOnly style={{ marginTop: '4px' }} />
                </div>

                <div>
                  <Text strong>Model:</Text>
                  <Input value={deepseekConfig.model} readOnly style={{ marginTop: '4px' }} />
                </div>

                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                  <Button
                    type="default"
                    onClick={handleTestConnection}
                    loading={loading.testConnection}
                    disabled={!deepseekConfig.apiKey}
                  >
                    Test Connection
                  </Button>
                </div>
              </Space>
            </Card>
          </Col>

          {/* Alpaca 环境切换 */}
          <Col xs={24} lg={8}>
            <Card size="small" title="Trading Environment">
              <Space direction="vertical" style={{ width: '100%' }}>
                <Alert
                  message={tradingEnvironment === 'paper' ? 'Paper Trading Mode' : 'LIVE TRADING MODE'}
                  description={tradingEnvironment === 'paper'
                    ? 'All trades are simulated. No real money is at risk.'
                    : '⚠️ REAL MONEY AT RISK! Trades will execute with real funds.'}
                  type={tradingEnvironment === 'paper' ? 'info' : 'warning'}
                  showIcon
                />

                <Radio.Group
                  value={tradingEnvironment}
                  onChange={(e) => handleEnvironmentChange(e.target.value)}
                  style={{ width: '100%' }}
                >
                  <Radio.Button value="paper" style={{ flex: 1, textAlign: 'center' }}>
                    <EnvironmentOutlined /> Paper Trading
                  </Radio.Button>
                  <Radio.Button value="live" style={{ flex: 1, textAlign: 'center' }}>
                    <SafetyOutlined /> Live Trading
                  </Radio.Button>
                </Radio.Group>

                <div style={{ marginTop: '16px' }}>
                  <Text strong>Current Account:</Text>
                  <div style={{ marginTop: '4px' }}>
                    <Text code>{accountSnapshot.accountNumber || 'Not Connected'}</Text>
                    <Tag color={accountSnapshot.status === 'ACTIVE' ? 'green' : 'red'} style={{ marginLeft: '8px' }}>
                      {accountSnapshot.status || 'UNKNOWN'}
                    </Tag>
                  </div>
                </div>
              </Space>
            </Card>
          </Col>
        </Row>

        {/* Account Snapshot */}
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
            <Col xs={24} sm={12} lg={4}>
              <Statistic title="Cash" value={accountSnapshot.cash} prefix="$" precision={2} />
            </Col>
            <Col xs={24} sm={12} lg={4}>
              <Statistic title="Equity" value={accountSnapshot.equity} prefix="$" precision={2} />
            </Col>
            <Col xs={24} sm={12} lg={4}>
              <Statistic title="Buying Power" value={accountSnapshot.buyingPower} prefix="$" precision={2} />
            </Col>
            <Col xs={24} sm={12} lg={4}>
              <div>
                <Statistic
                  title="Portfolio Value"
                  value={accountSnapshot.portfolioValue}
                  prefix="$"
                  precision={2}
                />
                {portfolioHistory.length >= 2 && (
                  <div style={{ marginTop: '4px', fontSize: '12px' }}>
                    <span style={{
                      color: portfolioChange.value >= 0 ? '#52c41a' : '#ff4d4f',
                      fontWeight: 'bold'
                    }}>
                      {portfolioChange.value >= 0 ? '+' : ''}{portfolioChange.value.toFixed(2)}
                      ({portfolioChange.percent >= 0 ? '+' : ''}{portfolioChange.percent.toFixed(2)}%)
                    </span>
                    <span style={{ marginLeft: '8px', color: '#8c8c8c', fontSize: '11px' }}>
                      {portfolioRange}
                    </span>
                  </div>
                )}
              </div>
            </Col>
            <Col xs={24} sm={12} lg={4}>
              <Statistic title="Positions" value={accountSnapshot.positionsCount} />
            </Col>
            <Col xs={24} sm={12} lg={4}>
              <Statistic title="Open Orders" value={accountSnapshot.openOrdersCount} />
            </Col>
          </Row>
        </Card>

        {/* Portfolio Graph */}
        <Card
          size="small"
          title="Portfolio Performance"
          style={{ marginTop: '16px' }}
          extra={
            <Segmented
              size="small"
              value={portfolioRange}
              onChange={refreshPortfolioData}
              options={[
                { label: '1D', value: '1D' },
                { label: '1W', value: '1W' },
                { label: '1M', value: '1M' },
                { label: '1Y', value: '1Y' },
                { label: 'All', value: 'All' }
              ]}
            />
          }
          loading={loadingData.portfolio}
        >
          {portfolioHistory.length > 0 ? (
            <div style={{ height: '300px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={portfolioHistory}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="timestamp"
                    tickFormatter={(value) => {
                      try {
                        // 处理Unix时间戳（秒）或ISO字符串
                        let date: Date;
                        if (typeof value === 'number' && value > 1000000000) {
                          // Unix时间戳（秒）
                          date = new Date(value * 1000);
                        } else if (typeof value === 'string') {
                          // ISO字符串
                          date = new Date(value);
                        } else {
                          return '';
                        }

                        if (isNaN(date.getTime())) {
                          return '';
                        }

                        // 使用美东时间
                        const options: Intl.DateTimeFormatOptions = { timeZone: 'America/New_York' };

                        if (portfolioRange === '1D') {
                          // 1D: 显示小时:分钟
                          return date.toLocaleTimeString('en-US', {
                            ...options,
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: false
                          });
                        } else if (portfolioRange === '1W') {
                          // 1W: 显示月/日 + 小时
                          return date.toLocaleDateString('en-US', {
                            ...options,
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            hour12: false
                          });
                        } else if (portfolioRange === '1M') {
                          // 1M: 显示月/日
                          return date.toLocaleDateString('en-US', {
                            ...options,
                            month: 'short',
                            day: 'numeric'
                          });
                        } else {
                          // 1Y/All: 显示年/月
                          return date.toLocaleDateString('en-US', {
                            ...options,
                            year: 'numeric',
                            month: 'short'
                          });
                        }
                      } catch (error) {
                        console.error('时间格式化错误:', error, value);
                        return '';
                      }
                    }}
                  />
                  <YAxis
                    tickFormatter={(value) => `$${value.toLocaleString()}`}
                    domain={['dataMin - 100', 'dataMax + 100']}
                  />
                  <Tooltip
                    formatter={(value) => [`$${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 'Portfolio Value']}
                    labelFormatter={(label) => {
                      try {
                        // 处理Unix时间戳（秒）或ISO字符串
                        let date: Date;
                        if (typeof label === 'number' && label > 1000000000) {
                          // Unix时间戳（秒）
                          date = new Date(label * 1000);
                        } else if (typeof label === 'string') {
                          // ISO字符串
                          date = new Date(label);
                        } else {
                          return 'Invalid Date';
                        }

                        if (isNaN(date.getTime())) {
                          return 'Invalid Date';
                        }

                        // 使用美东时间显示完整日期时间
                        const timeStr = date.toLocaleString('en-US', {
                          timeZone: 'America/New_York',
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                          hour12: false
                        });

                        // 添加时区信息
                        const timezoneStr = date.toLocaleTimeString('en-US', {
                          timeZone: 'America/New_York',
                          timeZoneName: 'short'
                        }).split(' ')[2] || 'EDT';

                        return `${timeStr} ${timezoneStr}`;
                      } catch (error) {
                        console.error('Tooltip时间格式化错误:', error, label);
                        return 'Invalid Date';
                      }
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke={portfolioChange.value >= 0 ? '#52c41a' : '#ff4d4f'}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 6 }}
                    name="Portfolio Value"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <Alert
              message="No portfolio data"
              description="Portfolio history data is not available. Make sure your Alpaca account is properly configured."
              type="info"
              showIcon
            />
          )}
        </Card>
      </div>

      {/* Block 2: Account / Orders / Positions 详细数据 */}
      <div style={{ marginBottom: 24 }}>
        <Title level={4}><EnvironmentOutlined style={{ marginRight: '8px' }} />Alpaca Account Details</Title>

        <Row gutter={[16, 16]}>
          {/* 账户详情 */}
          <Col xs={24} lg={12}>
            <Card
              size="small"
              title={
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>Account Details</span>
                  {alpacaAccount?.isMockData && (
                    <Tag color="orange" icon={<EnvironmentOutlined />}>
                      模拟数据
                    </Tag>
                  )}
                  {alpacaAccount && !alpacaAccount?.isMockData && (
                    <Tag color="green" icon={<CheckCircleOutlined />}>
                      真实数据
                    </Tag>
                  )}
                </div>
              }
              loading={loadingData.account}
              extra={
                <Button
                  type="link"
                  size="small"
                  onClick={refreshAllAlpacaData}
                  icon={<ReloadOutlined />}
                  loading={loadingData.account || loadingData.positions || loadingData.orders || loadingData.history}
                >
                  Refresh All
                </Button>
              }
            >
              {alpacaAccount ? (
                <>
                  {alpacaAccount.isMockData && (
                    <Alert
                      message="模拟数据"
                      description={alpacaAccount.message || "Alpaca API 密钥未配置或无效，显示模拟数据"}
                      type="warning"
                      showIcon
                      style={{ marginBottom: '16px' }}
                    />
                  )}
                  <Descriptions column={1} size="small">
                    <Descriptions.Item label="Account Number">
                      <Text strong>{alpacaAccount.accountNumber}</Text>
                    </Descriptions.Item>
                    <Descriptions.Item label="Status">
                      <Tag color={alpacaAccount.status === 'ACTIVE' ? 'green' : 'red'}>
                        {alpacaAccount.status}
                      </Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label="Equity">
                      <Text strong>${alpacaAccount.equity?.toFixed(2)}</Text>
                    </Descriptions.Item>
                    <Descriptions.Item label="Cash">
                      ${alpacaAccount.cash?.toFixed(2)}
                    </Descriptions.Item>
                    <Descriptions.Item label="Buying Power">
                      <Text type="success">${alpacaAccount.buyingPower?.toFixed(2)}</Text>
                    </Descriptions.Item>
                    <Descriptions.Item label="Portfolio Value">
                      ${alpacaAccount.portfolioValue?.toFixed(2)}
                    </Descriptions.Item>
                    <Descriptions.Item label="Long Market Value">
                      ${alpacaAccount.longMarketValue?.toFixed(2)}
                    </Descriptions.Item>
                    <Descriptions.Item label="Short Market Value">
                      ${alpacaAccount.shortMarketValue?.toFixed(2)}
                    </Descriptions.Item>
                    <Descriptions.Item label="Pattern Day Trader">
                      <Tag color={alpacaAccount.patternDayTrader ? 'orange' : 'default'}>
                        {alpacaAccount.patternDayTrader ? 'YES' : 'NO'}
                      </Tag>
                    </Descriptions.Item>
                  </Descriptions>
                </>
              ) : (
                <Alert message="No account data available" type="info" />
              )}
            </Card>
          </Col>

          {/* 持仓列表 */}
          <Col xs={24} lg={12}>
            <Card
              size="small"
              title={
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>Positions ({alpacaPositions.length})</span>
                  {alpacaPositions.length > 0 && alpacaPositions[0]?.isMockData && (
                    <Tag color="orange" icon={<EnvironmentOutlined />}>
                      模拟数据
                    </Tag>
                  )}
                  {alpacaPositions.length > 0 && !alpacaPositions[0]?.isMockData && (
                    <Tag color="green" icon={<CheckCircleOutlined />}>
                      真实数据
                    </Tag>
                  )}
                </div>
              }
              loading={loadingData.positions}
            >
              {alpacaPositions.length > 0 ? (
                <>
                  {alpacaPositions[0]?.isMockData && (
                    <Alert
                      message="模拟持仓数据"
                      description="Alpaca API 密钥未配置或无效，显示模拟持仓数据"
                      type="warning"
                      showIcon
                      style={{ marginBottom: '16px' }}
                    />
                  )}
                  <Table
                    size="small"
                    dataSource={alpacaPositions}
                    columns={[
                      {
                        title: 'Asset',
                        dataIndex: 'symbol',
                        key: 'symbol',
                        fixed: 'left',
                        width: 100
                      },
                      {
                        title: 'Price',
                        dataIndex: 'currentPrice',
                        key: 'currentPrice',
                        align: 'right',
                        render: (value) => `$${value?.toFixed(2)}`,
                        width: 90
                      },
                      {
                        title: 'Qty',
                        dataIndex: 'quantity',
                        key: 'quantity',
                        align: 'right',
                        width: 80
                      },
                      {
                        title: 'Side',
                        dataIndex: 'side',
                        key: 'side',
                        width: 70,
                        render: (side) => (
                          <Tag color={side === 'long' ? 'green' : 'red'}>
                            {side?.toUpperCase()}
                          </Tag>
                        )
                      },
                      {
                        title: 'Market Value',
                        dataIndex: 'marketValue',
                        key: 'marketValue',
                        align: 'right',
                        render: (value) => `$${value?.toFixed(2)}`,
                        width: 110
                      },
                      {
                        title: 'Avg Entry',
                        dataIndex: 'avgEntry',
                        key: 'avgEntry',
                        align: 'right',
                        render: (value) => `$${value?.toFixed(2)}`,
                        width: 100
                      },
                      {
                        title: 'Cost Basis',
                        dataIndex: 'costBasis',
                        key: 'costBasis',
                        align: 'right',
                        render: (value) => `$${value?.toFixed(2)}`,
                        width: 110
                      },
                      {
                        title: "Today's P/L (%)",
                        dataIndex: 'todayPlPercent',
                        key: 'todayPlPercent',
                        align: 'right',
                        render: (value) => (
                          <Tag color={value >= 0 ? 'green' : 'red'}>
                            {value?.toFixed(2)}%
                          </Tag>
                        ),
                        width: 120
                      },
                      {
                        title: "Today's P/L ($)",
                        dataIndex: 'todayPlValue',
                        key: 'todayPlValue',
                        align: 'right',
                        render: (value) => {
                          const formattedValue = value >= 0 ? `$${value?.toFixed(2)}` : `-$${Math.abs(value)?.toFixed(2)}`;
                          return (
                            <Tag color={value >= 0 ? 'green' : 'red'}>
                              {formattedValue}
                            </Tag>
                          );
                        },
                        width: 120
                      },
                      {
                        title: 'Total P/L (%)',
                        dataIndex: 'totalPlPercent',
                        key: 'totalPlPercent',
                        align: 'right',
                        render: (value) => (
                          <Tag color={value >= 0 ? 'green' : 'red'}>
                            {value?.toFixed(2)}%
                          </Tag>
                        ),
                        width: 110
                      },
                      {
                        title: 'Total P/L ($)',
                        dataIndex: 'totalPlValue',
                        key: 'totalPlValue',
                        align: 'right',
                        render: (value) => {
                          const formattedValue = value >= 0 ? `$${value?.toFixed(2)}` : `-$${Math.abs(value)?.toFixed(2)}`;
                          return (
                            <Tag color={value >= 0 ? 'green' : 'red'}>
                              {formattedValue}
                            </Tag>
                          );
                        },
                        width: 120
                      }
                    ]}
                    pagination={false}
                    scroll={{ x: 1350 }}
                  />
                </>
              ) : (
                <Alert message="No positions" type="info" />
              )}
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]} style={{ marginTop: '16px' }}>
          {/* 未完成订单 */}
          <Col xs={24} lg={12}>
            <Card
              size="small"
              title={
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Open Orders ({alpacaOrders.length})</span>
                  <Button
                    type="link"
                    size="small"
                    onClick={refreshAllAlpacaData}
                    icon={<ReloadOutlined />}
                    loading={loadingData.orders}
                  >
                    Refresh
                  </Button>
                </div>
              }
              loading={loadingData.orders}
              bodyStyle={{ padding: 0 }}
            >
              {alpacaOrders.length > 0 ? (
                <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                  <Table
                    size="small"
                    dataSource={alpacaOrders}
                    columns={[
                      {
                        title: 'Symbol',
                        dataIndex: 'symbol',
                        key: 'symbol',
                        width: 80
                      },
                      {
                        title: 'Side',
                        dataIndex: 'side',
                        key: 'side',
                        width: 70,
                        render: (value) => (
                          <Tag color={value === 'buy' ? 'green' : 'red'} style={{ margin: 0 }}>
                            {value.toUpperCase()}
                          </Tag>
                        )
                      },
                      {
                        title: 'Qty',
                        dataIndex: 'quantity',
                        key: 'quantity',
                        width: 70,
                        align: 'right' as const,
                        render: (value) => value?.toFixed(0) || '0'
                      },
                      {
                        title: 'Type',
                        dataIndex: 'type',
                        key: 'type',
                        width: 80,
                        render: (value) => value?.toUpperCase() || 'N/A'
                      },
                      {
                        title: 'Status',
                        dataIndex: 'status',
                        key: 'status',
                        width: 100,
                        render: (value) => {
                          let color = 'default';
                          if (value === 'filled') color = 'green';
                          else if (value === 'canceled' || value === 'expired' || value === 'rejected') color = 'red';
                          else if (value === 'new' || value === 'accepted') color = 'blue';
                          else if (value.includes('pending') || value === 'partially_filled') color = 'orange';

                          return (
                            <Tag color={color} style={{ margin: 0 }}>
                              {value?.toUpperCase() || 'N/A'}
                            </Tag>
                          );
                        }
                      },
                      {
                        title: 'Created',
                        dataIndex: 'createdAt',
                        key: 'createdAt',
                        width: 160,
                        render: (value, record: any) => {
                          // 优先使用 submittedAt，如果没有则使用 createdAt
                          const timeValue = record?.submittedAt || value;
                          if (!timeValue) return 'N/A';
                          try {
                            const date = new Date(timeValue);
                            return date.toLocaleString('en-US', {
                              timeZone: 'America/New_York',
                              year: 'numeric',
                              month: '2-digit',
                              day: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                              hour12: false
                            }).replace(',', '');
                          } catch (error) {
                            console.error('时间转换错误:', error, timeValue);
                            return 'N/A';
                          }
                        }
                      },
                      {
                        title: 'Limit',
                        dataIndex: 'limitPrice',
                        key: 'limitPrice',
                        width: 90,
                        align: 'right' as const,
                        render: (value) => value ? `$${parseFloat(value).toFixed(2)}` : '-'
                      }
                    ]}
                    pagination={false}
                    rowKey="id"
                    scroll={{ y: 200 }}
                  />
                </div>
              ) : (
                <Alert
                  message="No open orders"
                  description="No pending orders in your Alpaca account."
                  type="info"
                  style={{ margin: '16px' }}
                />
              )}
            </Card>
          </Col>

          {/* 订单历史 */}
          <Col xs={24} lg={12}>
            <Card
              size="small"
              title={
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Order History ({alpacaOrdersHistory.length})</span>
                  <Button
                    type="link"
                    size="small"
                    onClick={refreshAllAlpacaData}
                    icon={<ReloadOutlined />}
                    loading={loadingData.history}
                  >
                    Refresh
                  </Button>
                </div>
              }
              loading={loadingData.history}
              bodyStyle={{ padding: 0 }}
            >
              {alpacaOrdersHistory.length > 0 ? (
                <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                  <Table
                    size="small"
                    dataSource={alpacaOrdersHistory}
                    columns={[
                      {
                        title: 'Time',
                        dataIndex: 'createdAt',
                        key: 'createdAt',
                        width: 160,
                        render: (value, record: any) => {
                          // 优先使用 submittedAt，如果没有则使用 createdAt
                          const timeValue = record?.submittedAt || value;
                          if (!timeValue) return 'N/A';
                          try {
                            const date = new Date(timeValue);
                            return date.toLocaleString('en-US', {
                              timeZone: 'America/New_York',
                              year: 'numeric',
                              month: '2-digit',
                              day: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                              hour12: false
                            }).replace(',', '');
                          } catch (error) {
                            console.error('时间转换错误:', error, timeValue);
                            return 'N/A';
                          }
                        }
                      },
                      {
                        title: 'Symbol',
                        dataIndex: 'symbol',
                        key: 'symbol',
                        width: 80
                      },
                      {
                        title: 'Side',
                        dataIndex: 'side',
                        key: 'side',
                        width: 70,
                        render: (value) => (
                          <Tag color={value === 'buy' ? 'green' : 'red'} style={{ margin: 0 }}>
                            {value.toUpperCase()}
                          </Tag>
                        )
                      },
                      {
                        title: 'Qty',
                        dataIndex: 'quantity',
                        key: 'quantity',
                        width: 70,
                        align: 'right' as const,
                        render: (value) => value?.toFixed(0) || '0'
                      },
                      {
                        title: 'Type',
                        dataIndex: 'type',
                        key: 'type',
                        width: 80,
                        render: (value) => value?.toUpperCase() || 'N/A'
                      },
                      {
                        title: 'Status',
                        dataIndex: 'status',
                        key: 'status',
                        width: 100,
                        render: (value) => {
                          let color = 'default';
                          if (value === 'filled') color = 'green';
                          else if (value === 'canceled' || value === 'expired' || value === 'rejected') color = 'red';
                          else if (value === 'new' || value === 'accepted') color = 'blue';
                          else if (value.includes('pending') || value === 'partially_filled') color = 'orange';

                          return (
                            <Tag color={color} style={{ margin: 0 }}>
                              {value?.toUpperCase() || 'N/A'}
                            </Tag>
                          );
                        }
                      },
                      {
                        title: 'Avg Price',
                        dataIndex: 'filled_avg_price',
                        key: 'filled_avg_price',
                        width: 90,
                        align: 'right' as const,
                        render: (value) => value ? `$${parseFloat(value).toFixed(2)}` : '-'
                      }
                    ]}
                    pagination={false}
                    rowKey="id"
                    scroll={{ y: 300 }}
                  />
                </div>
              ) : (
                <Alert
                  message="No order history"
                  description="No historical orders found in your Alpaca account."
                  type="info"
                  style={{ margin: '16px' }}
                />
              )}
            </Card>
          </Col>
        </Row>
      </div>





      {/* Block 2: AI Trade History */}
      <div style={{ marginBottom: 24 }}>
        <Title level={4}>AI Trade History</Title>
        <Card>
          <Table columns={historyColumns} dataSource={aiHistory} rowKey="timestamp" size="small" />
        </Card>
      </div>

      {/* Block 3: AI Performance */}
      <div style={{ marginBottom: 24 }}>
        <Title level={4}>AI Performance</Title>
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} lg={6}><Card size="small"><Statistic title="Total Trades" value={15} /></Card></Col>
          <Col xs={24} sm={12} lg={6}><Card size="small"><Statistic title="Win Rate" value="73%" /></Card></Col>
          <Col xs={24} sm={12} lg={6}><Card size="small"><Statistic title="Avg Return" value="+2.4%" /></Card></Col>
          <Col xs={24} sm={12} lg={6}><Card size="small"><Statistic title="Total P&L" value="$1,250" prefix="$" /></Card></Col>
        </Row>
      </div>

      {/* Block 4: AI Settings */}
      <div style={{ marginBottom: 24 }}>
        <Title level={4}>AI Settings</Title>
        <Card>
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12} lg={6}>
              <div>
                <strong>Auto Trading</strong>
                <Switch checked={aiStatus.auto_mode} onChange={(checked) =>
                  setAiStatus(prev => ({ ...prev, auto_mode: checked }))
                } style={{ marginLeft: '8px' }} />
              </div>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <div>
                <strong>Human Confirm</strong>
                <Switch checked={aiStatus.human_confirm_required} onChange={(checked) =>
                  setAiStatus(prev => ({ ...prev, human_confirm_required: checked }))
                } style={{ marginLeft: '8px' }} />
              </div>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <div>
                <strong>Paper Only</strong>
                <Switch checked={aiStatus.paper_only} onChange={(checked) =>
                  setAiStatus(prev => ({ ...prev, paper_only: checked }))
                } style={{ marginLeft: '8px' }} />
              </div>
            </Col>
          </Row>
        </Card>
      </div>

      {/* Modals */}
      <Modal
        title="Configure DeepSeek API"
        open={showApiKeyModal}
        onCancel={() => setShowApiKeyModal(false)}
        footer={[
          <Button key="cancel" onClick={() => setShowApiKeyModal(false)}>
            Cancel
          </Button>,
          <Button
            key="save"
            type="primary"
            onClick={handleSaveSettings}
            loading={loading.saveSettings}
          >
            Save Settings
          </Button>
        ]}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Alert
            message="Security Notice"
            description="Your API key will be stored securely in the backend session. Never share your API key."
            type="warning"
            showIcon
          />

          <div>
            <Text strong>API Key</Text>
            <Input.Password
              value={deepseekConfig.apiKey}
              onChange={(e) => setDeepseekConfig(prev => ({ ...prev, apiKey: e.target.value }))}
              placeholder="sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              style={{ marginTop: '4px' }}
            />
          </div>

          <div>
            <Text strong>Base URL</Text>
            <Input
              value={deepseekConfig.baseUrl}
              onChange={(e) => setDeepseekConfig(prev => ({ ...prev, baseUrl: e.target.value }))}
              style={{ marginTop: '4px' }}
            />
          </div>

          <div>
            <Text strong>Model</Text>
            <Select
              value={deepseekConfig.model}
              onChange={(value) => setDeepseekConfig(prev => ({ ...prev, model: value }))}
              style={{ width: '100%', marginTop: '4px' }}
            >
              <Option value="deepseek-chat">deepseek-chat</Option>
              <Option value="deepseek-coder">deepseek-coder</Option>
            </Select>
          </div>
        </Space>
      </Modal>

      <Modal
        title="⚠️ Switch to Live Trading"
        open={showLiveWarning}
        onCancel={() => setShowLiveWarning(false)}
        footer={[
          <Button key="cancel" onClick={() => setShowLiveWarning(false)}>
            Cancel
          </Button>,
          <Popconfirm
            key="confirm"
            title="Are you sure?"
            description="This will enable REAL MONEY trading. Are you absolutely sure?"
            onConfirm={confirmLiveSwitch}
            okText="Yes, switch to Live"
            cancelText="No, stay in Paper"
            okButtonProps={{ danger: true }}
          >
            <Button type="primary" danger>
              Switch to Live Trading
            </Button>
          </Popconfirm>
        ]}
      >
        <Alert
          message="CRITICAL WARNING"
          description={
            <div>
              <p>You are about to switch from Paper Trading to <strong>LIVE TRADING</strong>.</p>
              <p><strong>This means:</strong></p>
              <ul>
                <li>All trades will use REAL MONEY from your Alpaca account</li>
                <li>Market orders will execute immediately at current prices</li>
                <li>Losses will be REAL and PERMANENT</li>
                <li>AI decisions may result in significant financial loss</li>
              </ul>
              <p>Make sure you understand the risks before proceeding.</p>
            </div>
          }
          type="error"
          showIcon
        />
      </Modal>

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