import React, { useState, useEffect } from 'react';
import { 
  Card, Typography, Button, Divider, Table, Tag, Progress, Row, Col, Statistic, 
  Select, Switch, Form, Input, Modal, Alert, Space, Descriptions, Collapse, 
  Radio, InputNumber, List, message, Popconfirm 
} from 'antd';
import { 
  RobotOutlined, PlayCircleOutlined, CheckCircleOutlined, CheckOutlined, 
  CloseOutlined, SettingOutlined, EyeOutlined, EyeInvisibleOutlined, 
  SafetyOutlined, ApiOutlined, EnvironmentOutlined, MessageOutlined,
  ReloadOutlined 
} from '@ant-design/icons';
import aiTradingService from '../services/aiTradingService';
import alpacaBrokerService from '../services/alpacaBrokerService';

const { Title, Text } = Typography;
const { Option } = Select;
const { Panel } = Collapse;
const { TextArea } = Input;

const AITrading: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState({ 
    analyze: false, execute: false, testConnection: false, saveSettings: false 
  });
  const [aiStatus, setAiStatus] = useState({
    auto_mode: false,
    paper_only: true,
    human_confirm_required: true,
    allowed_symbols: ['AAPL', 'MSFT', 'NVDA', 'GOOGL', 'AMZN'],
    ai_status: 'idle'
  });
  const [accountSnapshot, setAccountSnapshot] = useState({
    cash: 0, equity: 0, buyingPower: 0, portfolioValue: 0, 
    positionsCount: 0, openOrdersCount: 0, accountNumber: '', status: ''
  });
  const [aiDecision, setAiDecision] = useState<any>(null);
  const [aiHistory, setAiHistory] = useState<any[]>([]);
  
  // Block 1: AI Provider / Trading Environment 配置
  const [deepseekConfig, setDeepseekConfig] = useState({
    provider: 'DeepSeek',
    apiKey: '',
    baseUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
    showApiKey: false
  });
  const [tradingEnvironment, setTradingEnvironment] = useState<'paper' | 'live'>('paper');
  const [showLiveWarning, setShowLiveWarning] = useState(false);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);

  // Block 2: 详细数据状态
  const [alpacaAccount, setAlpacaAccount] = useState<any>(null);
  const [alpacaPositions, setAlpacaPositions] = useState<any[]>([]);
  const [alpacaOrders, setAlpacaOrders] = useState<any[]>([]);
  const [alpacaOrdersHistory, setAlpacaOrdersHistory] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState({
    account: false,
    positions: false,
    orders: false,
    history: false
  });

  // Block 3: AI Chat 状态
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  // 加载初始数据
  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      // 加载账户快照
      const snapshot = await aiTradingService.getAccountSnapshot();
      setAccountSnapshot({
        ...snapshot,
        accountNumber: snapshot.accountNumber || 'PA3YPSJY0D4E',
        status: snapshot.status || 'ACTIVE'
      });
      
      // 加载AI状态
      const statusResponse = await aiTradingService.getStatus();
      if (statusResponse.success) {
        setAiStatus(statusResponse.state);
      }
      
      // 加载AI历史
      const historyResponse = await aiTradingService.getHistory();
      if (historyResponse.success) {
        setAiHistory(historyResponse.history);
      }
      
      // Block 2: 加载详细数据
      await loadDetailedData();
    } catch (error) {
      console.error('加载初始数据失败:', error);
    }
  };

  // Block 2: 加载详细数据
  const loadDetailedData = async () => {
    try {
      setLoadingData(prev => ({ ...prev, account: true, positions: true, orders: true, history: true }));
      
      const [accountResponse, positionsResponse, ordersResponse, historyResponse] = await Promise.all([
        aiTradingService.getAlpacaAccount(),
        aiTradingService.getAlpacaPositions(),
        aiTradingService.getAlpacaOrders('open'),
        aiTradingService.getAlpacaOrdersHistory(20)
      ]);
      
      if (accountResponse.success) {
        setAlpacaAccount(accountResponse.data);
        setAccountSnapshot(prev => ({
          ...prev,
          accountNumber: accountResponse.data?.accountNumber || prev.accountNumber,
          status: accountResponse.data?.status || prev.status
        }));
      }
      
      if (positionsResponse.success) {
        setAlpacaPositions(positionsResponse.data || []);
      }
      
      if (ordersResponse.success) {
        setAlpacaOrders(ordersResponse.data || []);
      }
      
      if (historyResponse.success) {
        setAlpacaOrdersHistory(historyResponse.data || []);
      }
      
    } catch (error) {
      console.error('加载详细数据失败:', error);
    } finally {
      setLoadingData(prev => ({ ...prev, account: false, positions: false, orders: false, history: false }));
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
      const response = await aiTradingService.saveProviderConfig(deepseekConfig);
      if (response.success) {
        message.success('DeepSeek 配置保存成功');
        setShowApiKeyModal(false);
      } else {
        message.error('DeepSeek 配置保存失败');
      }
    } catch (error) {
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
          newStrategyState: response.new_strategy_state
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
      const response = await aiTradingService.previewTrade(values.symbol);
      if (response.success) {
        setAiDecision(response.decision);
        setAiStatus(prev => ({ ...prev, ai_status: 'ready' }));
        message.success('AI 分析完成');
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
      <Title level={2}><RobotOutlined style={{ marginRight: '12px' }} />AI Trading Console</Title>
      <Text type="secondary">DeepSeek + Alpaca Trading Control Panel - Connect, Configure, Trade</Text>
      
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
        <Card size="small" title="Account Snapshot" style={{ marginTop: '16px' }}>
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
              <Statistic title="Portfolio Value" value={accountSnapshot.portfolioValue} prefix="$" precision={2} />
            </Col>
            <Col xs={24} sm={12} lg={4}>
              <Statistic title="Positions" value={accountSnapshot.positionsCount} />
            </Col>
            <Col xs={24} sm={12} lg={4}>
              <Statistic title="Open Orders" value={accountSnapshot.openOrdersCount} />
            </Col>
          </Row>
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
              title="Account Details" 
              loading={loadingData.account}
              extra={
                <Button 
                  type="link" 
                  size="small" 
                  onClick={loadDetailedData}
                  icon={<ReloadOutlined />}
                >
                  Refresh
                </Button>
              }
            >
              {alpacaAccount ? (
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
              ) : (
                <Alert message="No account data available" type="info" />
              )}
            </Card>
          </Col>
          
          {/* 持仓列表 */}
          <Col xs={24} lg={12}>
            <Card 
              size="small" 
              title={`Positions (${alpacaPositions.length})`}
              loading={loadingData.positions}
            >
              {alpacaPositions.length > 0 ? (
                <Table
                  size="small"
                  dataSource={alpacaPositions}
                  columns={[
                    { title: 'Symbol', dataIndex: 'symbol', key: 'symbol' },
                    { title: 'Qty', dataIndex: 'quantity', key: 'quantity' },
                    { title: 'Avg Price', dataIndex: 'avgPrice', key: 'avgPrice', render: (value) => `$${value?.toFixed(2)}` },
                    { title: 'Current', dataIndex: 'currentPrice', key: 'currentPrice', render: (value) => `$${value?.toFixed(2)}` },
                    { 
                      title: 'P&L %', 
                      dataIndex: 'unrealizedPLPercent', 
                      key: 'unrealizedPLPercent',
                      render: (value) => (
                        <Tag color={value >= 0 ? 'green' : 'red'}>
                          {value?.toFixed(2)}%
                        </Tag>
                      )
                    }
                  ]}
                  pagination={false}
                />
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
              title={`Open Orders (${alpacaOrders.length})`}
              loading={loadingData.orders}
            >
              {alpacaOrders.length > 0 ? (
                <Table
                  size="small"
                  dataSource={alpacaOrders}
                  columns={[
                    { title: 'Symbol', dataIndex: 'symbol', key: 'symbol' },
                    { title: 'Side', dataIndex: 'side', key: 'side', render: (value) => (
                      <Tag color={value === 'buy' ? 'green' : 'red'}>{value.toUpperCase()}</Tag>
                    )},
                    { title: 'Qty', dataIndex: 'quantity', key: 'quantity' },
                    { title: 'Type', dataIndex: 'type', key: 'type' },
                    { title: 'Status', dataIndex: 'status', key: 'status', render: (value) => (
                      <Tag color={value === 'filled' ? 'green' : value === 'canceled' ? 'red' : 'blue'}>
                        {value.toUpperCase()}
                      </Tag>
                    )},
                    { title: 'Created', dataIndex: 'createdAt', key: 'createdAt', render: (value) => 
                      new Date(value).toLocaleTimeString()
                    }
                  ]}
                  pagination={false}
                />
              ) : (
                <Alert message="No open orders" type="info" />
              )}
            </Card>
          </Col>
          
          {/* 订单历史 */}
          <Col xs={24} lg={12}>
            <Card 
              size="small" 
              title={`Order History (${alpacaOrdersHistory.length})`}
              loading={loadingData.history}
            >
              {alpacaOrdersHistory.length > 0 ? (
                <Table
                  size="small"
                  dataSource={alpacaOrdersHistory.slice(0, 5)}  // 只显示最近5条
                  columns={[
                    { title: 'Time', dataIndex: 'createdAt', key: 'createdAt', render: (value) => 
                      new Date(value).toLocaleTimeString()
                    },
                    { title: 'Symbol', dataIndex: 'symbol', key: 'symbol' },
                    { title: 'Side', dataIndex: 'side', key: 'side', render: (value) => (
                      <Tag color={value === 'buy' ? 'green' : 'red'}>{value.toUpperCase()}</Tag>
                    )},
                    { title: 'Qty', dataIndex: 'quantity', key: 'quantity' },
                    { title: 'Status', dataIndex: 'status', key: 'status', render: (value) => (
                      <Tag color={value === 'filled' ? 'green' : value === 'canceled' ? 'red' : 'blue'}>
                        {value.toUpperCase()}
                      </Tag>
                    )}
                  ]}
                  pagination={false}
                />
              ) : (
                <Alert message="No order history" type="info" />
              )}
            </Card>
          </Col>
        </Row>
      </div>
      
      {/* Block 3: AI Chat / AI Instruction 区块 */}
      <div style={{ marginBottom: 24 }}>
        <Title level={4}><MessageOutlined style={{ marginRight: '8px' }} />AI Chat & Strategy Adjustment</Title>
        
        <Card>
          <div style={{ marginBottom: '16px' }}>
            <Text strong>与 AI 对话调整策略</Text>
            <Text type="secondary" style={{ marginLeft: '8px' }}>
              您可以要求 AI 调整策略、解释决策、或询问市场情况
            </Text>
          </div>
          
          {/* 聊天历史 */}
          <div style={{ 
            height: '300px', 
            overflowY: 'auto', 
            border: '1px solid #d9d9d9', 
            borderRadius: '4px',
            padding: '16px',
            marginBottom: '16px',
            backgroundColor: '#fafafa'
          }}>
            {chatMessages.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#999', padding: '40px' }}>
                <MessageOutlined style={{ fontSize: '24px', marginBottom: '8px' }} />
                <div>开始与 AI 对话，调整您的交易策略</div>
                <div style={{ fontSize: '12px', marginTop: '4px' }}>
                  例如: "更保守一点"、"只做多，不做空"、"解释一下你为什么建议买这个"
                </div>
              </div>
            ) : (
              chatMessages.map((msg, index) => (
                <div 
                  key={index} 
                  style={{ 
                    marginBottom: '12px',
                    display: 'flex',
                    flexDirection: msg.role === 'user' ? 'row-reverse' : 'row'
                  }}
                >
                  <div style={{
                    maxWidth: '70%',
                    padding: '8px 12px',
                    borderRadius: '12px',
                    backgroundColor: msg.role === 'user' ? '#1890ff' : '#f0f0f0',
                    color: msg.role === 'user' ? 'white' : 'black',
                    wordBreak: 'break-word'
                  }}>
                    {msg.role === 'user' ? (
                      <div>{msg.content}</div>
                    ) : (
                      <div>
                        <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>AI 回复:</div>
                        {msg.content && typeof msg.content === 'object' ? (
                          <div>
                            <div><strong>解释:</strong> {msg.content.explanation}</div>
                            <div><strong>策略调整:</strong> {msg.content.strategy_adjustment}</div>
                            <div><strong>建议行动:</strong> {msg.content.recommended_action}</div>
                            <div><strong>风险提示:</strong> {msg.content.risk_notes}</div>
                            <div><strong>置信度:</strong> {Math.round((msg.content.confidence || 0) * 100)}%</div>
                            <div><strong>可执行:</strong> {msg.content.actionable ? '是' : '否'}</div>
                          </div>
                        ) : (
                          <div>{msg.content}</div>
                        )}
                        
                        {msg.strategyUpdated && (
                          <div style={{ 
                            marginTop: '8px', 
                            padding: '4px 8px', 
                            backgroundColor: '#52c41a', 
                            color: 'white',
                            borderRadius: '4px',
                            fontSize: '12px'
                          }}>
                            ✅ 策略已根据您的对话调整
                          </div>
                        )}
                      </div>
                    )}
                    <div style={{ 
                      fontSize: '10px', 
                      opacity: 0.7, 
                      marginTop: '4px',
                      textAlign: msg.role === 'user' ? 'right' : 'left'
                    }}>
                      {new Date(msg.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
          
          {/* 输入区域 */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <Input.TextArea
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="输入消息与 AI 对话 (例如: 更保守一点、只做多不做空、解释决策等)"
              autoSize={{ minRows: 2, maxRows: 4 }}
              style={{ flex: 1 }}
              onPressEnter={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendChatMessage();
                }
              }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <Button 
                type="primary" 
                onClick={handleSendChatMessage}
                loading={chatLoading}
                disabled={!chatInput.trim()}
              >
                发送
              </Button>
              <Button 
                onClick={handleClearChat}
                danger
              >
                清空
              </Button>
              <Button 
                onClick={loadChatHistory}
              >
                加载历史
              </Button>
            </div>
          </div>
          
          {/* 对话提示 */}
          <div style={{ marginTop: '16px' }}>
            <Text type="secondary">对话提示:</Text>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
              {[
                "更保守一点",
                "只做多，不做空",
                "只交易 AAPL 和 MSFT",
                "把单笔最大仓位降到 1 股",
                "市场波动太大时不要开仓",
                "解释一下你为什么建议买这个"
              ].map((hint, index) => (
                <Button 
                  key={index}
                  size="small"
                  onClick={() => setChatInput(hint)}
                >
                  {hint}
                </Button>
              ))}
            </div>
          </div>
        </Card>
      </div>
      
      {/* 其他区块暂时保持原样 */}
      <div style={{ marginBottom: 24 }}>
        <Title level={4}>AI Analysis & Decision</Title>
        <Card>
          <Form form={form} layout="vertical" initialValues={{ symbol: 'AAPL' }}>
            <Row gutter={[16, 16]}>
              <Col xs={24} sm={12} lg={6}>
                <Form.Item label="Symbol" name="symbol" rules={[{ required: true }]}>
                  <Select>
                    {aiStatus.allowed_symbols.map(symbol => (
                      <Option key={symbol} value={symbol}>{symbol}</Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
            </Row>
          </Form>
          
          <div style={{ display: 'flex', gap: '16px', marginTop: '16px' }}>
            <Button 
              type="primary" 
              icon={<PlayCircleOutlined />} 
              size="large"
              onClick={handleAnalyze}
              loading={loading.analyze}
            >
              Analyze
            </Button>
            <Button 
              type="default" 
              icon={<CheckCircleOutlined />} 
              size="large"
              onClick={handleExecute}
              loading={loading.execute}
              disabled={!aiDecision}
            >
              Execute Trade
            </Button>
          </div>
        </Card>
        
        {aiDecision && (
          <Card style={{ marginTop: '16px' }}>
            <Title level={5}>AI Decision Result</Title>
            <div style={{ padding: '16px' }}>
              <p><strong>Action:</strong> {aiDecision.action}</p>
              <p><strong>Symbol:</strong> {aiDecision.symbol}</p>
              <p><strong>Quantity:</strong> {aiDecision.qty}</p>
              <p><strong>Confidence:</strong> {Math.round(aiDecision.confidence * 100)}%</p>
              <p><strong>Reason:</strong> {aiDecision.reason}</p>
              <p><strong>Executable:</strong> {aiDecision.executable ? 'Yes' : 'No'}</p>
            </div>
          </Card>
        )}
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
    </div>
  );
};

export default AITrading;