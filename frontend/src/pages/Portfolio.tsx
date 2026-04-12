import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Card, Typography, Space, Statistic, Row, Col, 
  Button, Divider, Table, Tag, Select, Form, Input, 
  message, Progress, Empty, Badge, Alert, Tooltip, Collapse
} from 'antd';
import { 
  DollarOutlined, LineChartOutlined, PieChartOutlined, BarChartOutlined,
  SettingOutlined, PlayCircleOutlined, PauseCircleOutlined, 
  ThunderboltOutlined, CheckCircleOutlined, ClockCircleOutlined,
  RobotOutlined, CloseCircleOutlined, ExclamationCircleOutlined,
  ArrowUpOutlined, ArrowDownOutlined, MinusOutlined,
  SortDescendingOutlined, SortAscendingOutlined,
  CaretDownOutlined, CaretRightOutlined
} from '@ant-design/icons';
import aiTradingService, { AIProviderConfig } from '../services/aiTradingService';
import { backtraderAPI, marketAPI } from '../services/api';
import marketDataService from '../services/marketDataService';
import alpacaBrokerService, { AlpacaAccount, AlpacaPosition, AlpacaOrder } from '../services/alpacaBrokerService';

const { Title, Text } = Typography;
const { Option } = Select;

const Portfolio: React.FC = () => {
  // AI Agent 状态 - Step 2: 只做 UI，不接真实逻辑
  const [aiConfig, setAiConfig] = useState({
    apiKey: '',
    baseUrl: 'https://api.deepseek.com',
    model: 'deepseek-chat',
    provider: 'DeepSeek'
  });
  
  const [scanInterval, setScanInterval] = useState<string>('5');
  // Step 5 修复：拆分为两个独立的状态
  const [isAutoScanEnabled, setIsAutoScanEnabled] = useState(false); // 自动扫描模式是否开启
  const isAutoScanEnabledRef = useRef(isAutoScanEnabled); // Ref to track latest value for timeout callbacks
  
  // Update ref when state changes
  useEffect(() => {
    isAutoScanEnabledRef.current = isAutoScanEnabled;
  }, [isAutoScanEnabled]);
  
  const [isScanInProgress, setIsScanInProgress] = useState(false);   // 当前是否正在执行一次扫描
  const [scanStatus, setScanStatus] = useState({
    status: 'stopped' as 'stopped' | 'running' | 'scheduled' | 'paused',
    lastRun: null as string | null,
    nextRun: null as string | null,
    progress: 0
  });
  
  const [aiRecommendations, setAiRecommendations] = useState<any[]>([]);
  const [scanErrors, setScanErrors] = useState<Array<{symbol: string, error: string, step: string}>>([]);
  const [aiConfigForm] = Form.useForm();
  const [testingConnection, setTestingConnection] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  
  // Alpaca Paper Trading 真实账户状态
  const [alpacaAccount, setAlpacaAccount] = useState<AlpacaAccount | null>(null);
  const [alpacaPositions, setAlpacaPositions] = useState<AlpacaPosition[]>([]);
  const [alpacaOrders, setAlpacaOrders] = useState<any[]>([]);
  const [isLoadingAccount, setIsLoadingAccount] = useState(false);
  const [accountLoadError, setAccountLoadError] = useState<string | null>(null);
  
  // Market Scanner 状态
  const [marketScannerStatus, setMarketScannerStatus] = useState({
    status: 'stopped' as 'stopped' | 'running' | 'scheduled' | 'rate_limited' | 'waiting_to_resume',
    lastScanTime: null as string | null,
    nextScanTime: null as string | null,
    progress: 0,
    totalSymbols: 0,
    scannedSymbols: 0, // 已扫描的股票数量
    rateLimitInfo: null as { 
      waitSeconds: number, 
      resumeTime: string, 
      scannedSymbols: string[], // 已扫描的股票symbol列表
      remainingSymbols: string[] // 剩余的股票symbol列表
    } | null
  });
  const [marketScannerResults, setMarketScannerResults] = useState<any[]>([]);
  const [marketScannerSummary, setMarketScannerSummary] = useState({
    universeScanned: 0,
    bullishCount: 0,
    bearishCount: 0,
    neutralCount: 0,
    strongTrendCount: 0,
    newsRiskCount: 0,
    lastScanTime: null as string | null
  });
  const [marketScannerFilters, setMarketScannerFilters] = useState({
    trendFilter: 'all' as 'all' | 'bullish' | 'bearish' | 'neutral' | 'strong',
    sortBy: 'trendScore' as 'trendScore' | 'volume' | 'changePct' | 'newsSentiment',
    sortOrder: 'desc' as 'asc' | 'desc'
  });
  const [marketScannerAutoEnabled, setMarketScannerAutoEnabled] = useState(false);
  const marketScannerTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [expandedScannerRows, setExpandedScannerRows] = useState<Set<string>>(new Set());
  
  // Step 5: 自动扫描定时器
  const autoScanTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 处理Market Scanner行的展开/收起
  const handleScannerRowExpand = (symbol: string) => {
    const newExpanded = new Set(expandedScannerRows);
    if (newExpanded.has(symbol)) {
      newExpanded.delete(symbol);
    } else {
      newExpanded.add(symbol);
    }
    setExpandedScannerRows(newExpanded);
  };

  // 渲染Market Scanner行的展开详情
  const renderScannerRowDetail = (record: any) => {
    const isAI = record.analysisSource === 'deepseek';
    const isRuleBased = record.analysisSource === 'rule_based';
    const sectorSource = record.sectorSource || 'unknown';
    
    // Sector来源描述
    const sectorSourceMap: Record<string, string> = {
      'finnhub_profile': 'Finnhub Profile (官方数据)',
      'profile': 'Company Profile (官方数据)',
      'inferred': '系统推断 (基于股票特征和新闻)',
      'deepseek_inferred': 'DeepSeek AI推断',
      'unknown': '来源未知',
      'error': '数据获取错误'
    };
    
    // 数据来源描述
    const dataSource = record.dataSource || 'unknown';
    const dataSourceMap: Record<string, string> = {
      'Alpaca': 'Alpaca API (实时市场数据)',
      'Finnhub': 'Finnhub API (市场数据)',
      'Alpaca+Finnhub (volume)': 'Alpaca API + Finnhub Volume',
      'Failed': '数据获取失败',
      'unknown': '未知来源'
    };
    
    return (
      <div style={{ 
        padding: '16px 24px', 
        background: '#fafafa',
        borderRadius: '8px',
        border: '1px solid #e8e8e8',
        margin: '8px 0'
      }}>
        {/* 标题 */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: '16px'
        }}>
          <div style={{ fontSize: '16px', fontWeight: '600', color: '#1f1f1f' }}>
            📊 {record.symbol} - 扫描详情
          </div>
          <div style={{ fontSize: '12px', color: '#666' }}>
            {new Date(record.timestamp * 1000).toLocaleString()}
          </div>
        </div>
        
        {/* 四列布局 */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: '1fr 1fr', 
          gap: '20px',
          marginBottom: '20px'
        }}>
          {/* 左列: Scanner Reasoning 和 News Detail */}
          <div>
            {/* A. Scanner Reasoning */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: '#1f1f1f' }}>
                A. Scanner Reasoning
              </div>
              <div style={{ 
                background: '#fff', 
                padding: '12px', 
                borderRadius: '6px',
                border: '1px solid #f0f0f0',
                fontSize: '13px',
                lineHeight: 1.5,
                color: '#333'
              }}>
                {record.scannerReason || 'No analysis available'}
              </div>
              <div style={{ marginTop: '8px', fontSize: '12px', color: '#666' }}>
                <span style={{ 
                  display: 'inline-block',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  backgroundColor: isAI ? '#1890ff15' : (isRuleBased ? '#faad1415' : '#f0f0f0'),
                  color: isAI ? '#1890ff' : (isRuleBased ? '#fa8c16' : '#8c8c8c'),
                  fontWeight: '600'
                }}>
                  {isAI ? '🤖 AI Analysis' : (isRuleBased ? '⚙️ Rule-Based Analysis' : 'Unknown Analysis Source')}
                </span>
                <span style={{ marginLeft: '12px', color: '#8c8c8c' }}>
                  Confidence: {(record.trendConfidence * 100).toFixed(0)}%
                </span>
              </div>
            </div>
            
            {/* B. News Detail */}
            <div>
              <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: '#1f1f1f' }}>
                B. News Detail
              </div>
              <div style={{ 
                background: '#fff', 
                padding: '12px', 
                borderRadius: '6px',
                border: '1px solid #f0f0f0',
                fontSize: '13px'
              }}>
                <div style={{ marginBottom: '8px' }}>
                  <span style={{ fontWeight: '600', color: '#333' }}>Top Catalyst:</span>
                  <span style={{ marginLeft: '8px', color: '#555' }}>{record.topCatalyst || 'No recent catalyst'}</span>
                </div>
                <div style={{ marginBottom: '8px' }}>
                  <span style={{ fontWeight: '600', color: '#333' }}>News Sentiment:</span>
                  <span style={{ 
                    marginLeft: '8px',
                    display: 'inline-block',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    backgroundColor: record.newsSentiment === 'Positive' ? '#52c41a15' : 
                                    record.newsSentiment === 'Negative' ? '#ff4d4f15' : 
                                    record.newsSentiment === 'No recent news' ? '#d9d9d915' :
                                    '#faad1415',
                    color: record.newsSentiment === 'Positive' ? '#52c41a' : 
                           record.newsSentiment === 'Negative' ? '#ff4d4f' : 
                           record.newsSentiment === 'No recent news' ? '#8c8c8c' :
                           '#faad14',
                    fontWeight: '600'
                  }}>
                    {record.newsSentiment || 'No recent news'}
                  </span>
                </div>
                <div>
                  <span style={{ fontWeight: '600', color: '#333' }}>Event Risk:</span>
                  <span style={{ 
                    marginLeft: '8px',
                    display: 'inline-block',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    backgroundColor: record.eventRisk === 'High' ? '#ff4d4f15' : 
                                    record.eventRisk === 'Medium' ? '#faad1415' : 
                                    '#52c41a15',
                    color: record.eventRisk === 'High' ? '#ff4d4f' : 
                           record.eventRisk === 'Medium' ? '#fa8c16' : 
                           '#52c41a',
                    fontWeight: '600'
                  }}>
                    {record.eventRisk || 'Low'}
                  </span>
                </div>
              </div>
            </div>
          </div>
          
          {/* 右列: Scanner Inputs 和 Data Provenance */}
          <div>
            {/* C. Scanner Inputs / Parameters */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: '#1f1f1f' }}>
                C. Scanner Inputs / Parameters
              </div>
              <div style={{ 
                background: '#fff', 
                padding: '12px', 
                borderRadius: '6px',
                border: '1px solid #f0f0f0',
                fontSize: '13px'
              }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <div style={{ fontSize: '11px', color: '#666', marginBottom: '2px' }}>Current Price</div>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: '#1f1f1f' }}>
                      ${record.price ? record.price.toFixed(2) : '0.00'}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: '#666', marginBottom: '2px' }}>Change %</div>
                    <div style={{ 
                      fontSize: '14px', 
                      fontWeight: '600',
                      color: record.changePct > 0 ? '#52c41a' : 
                             record.changePct < 0 ? '#ff4d4f' : '#8c8c8c'
                    }}>
                      {record.changePct ? record.changePct.toFixed(2) + '%' : '0.00%'}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: '#666', marginBottom: '2px' }}>Volume</div>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: '#1f1f1f' }}>
                      {record.hasValidVolume ? (record.volume / 1000000).toFixed(1) + 'M' : 'N/A'}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: '#666', marginBottom: '2px' }}>Relative Volume</div>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: '#1f1f1f' }}>
                      {record.relativeVolume || 'Normal'}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: '#666', marginBottom: '2px' }}>Trend Score</div>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: '#1f1f1f' }}>
                      {record.trendScore ? record.trendScore.toFixed(0) + '/100' : 'N/A'}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: '#666', marginBottom: '2px' }}>Trend Confidence</div>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: '#1f1f1f' }}>
                      {(record.trendConfidence * 100).toFixed(0)}%
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* D. Data Provenance */}
            <div>
              <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: '#1f1f1f' }}>
                D. Data Provenance
              </div>
              <div style={{ 
                background: '#fff', 
                padding: '12px', 
                borderRadius: '6px',
                border: '1px solid #f0f0f0',
                fontSize: '13px'
              }}>
                {/* 细粒度的数据来源信息 */}
                <div style={{ marginBottom: '6px' }}>
                  <span style={{ fontWeight: '600', color: '#333', width: '120px', display: 'inline-block' }}>Price Source:</span>
                  <span style={{ color: '#555' }}>
                    {record.priceSource || record.dataProvenance?.priceSource || 'Unknown'}
                  </span>
                </div>
                <div style={{ marginBottom: '6px' }}>
                  <span style={{ fontWeight: '600', color: '#333', width: '120px', display: 'inline-block' }}>Change Source:</span>
                  <span style={{ color: '#555' }}>
                    {record.dataProvenance?.changeSource || 'Unknown'}
                  </span>
                </div>
                <div style={{ marginBottom: '6px' }}>
                  <span style={{ fontWeight: '600', color: '#333', width: '120px', display: 'inline-block' }}>Volume Source:</span>
                  <span style={{ color: '#555' }}>
                    {record.volumeSource || record.dataProvenance?.volumeSource || 'Unknown'}
                    {!record.hasValidVolume && <span style={{ marginLeft: '6px', color: '#ff4d4f', fontSize: '11px' }}>(No volume data)</span>}
                  </span>
                </div>
                <div style={{ marginBottom: '6px' }}>
                  <span style={{ fontWeight: '600', color: '#333', width: '120px', display: 'inline-block' }}>Company Name Source:</span>
                  <span style={{ color: '#555' }}>
                    {record.dataProvenance?.companyNameSource || 'Unknown'}
                  </span>
                </div>
                <div style={{ marginBottom: '6px' }}>
                  <span style={{ fontWeight: '600', color: '#333', width: '120px', display: 'inline-block' }}>Sector Source:</span>
                  <span style={{ color: '#555' }}>
                    {record.sectorSource || record.dataProvenance?.sectorSource || 'unknown'}
                    {record.sector === 'Unknown' && <span style={{ marginLeft: '6px', color: '#ff4d4f', fontSize: '11px' }}>(Unknown sector)</span>}
                  </span>
                </div>
                <div style={{ marginBottom: '6px' }}>
                  <span style={{ fontWeight: '600', color: '#333', width: '120px', display: 'inline-block' }}>News Source:</span>
                  <span style={{ color: '#555' }}>
                    {record.dataProvenance?.newsSource || 'Finnhub'}
                    {!record.hasNews && record.newsSentiment === 'No recent news' && <span style={{ marginLeft: '6px', color: '#faad14', fontSize: '11px' }}>(No recent news)</span>}
                  </span>
                </div>
                <div style={{ marginBottom: '6px' }}>
                  <span style={{ fontWeight: '600', color: '#333', width: '120px', display: 'inline-block' }}>Analysis Source:</span>
                  <span style={{ color: '#555' }}>
                    {record.analysisSource || record.dataProvenance?.analysisSource || 'Unknown'}
                  </span>
                </div>
                <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #f0f0f0' }}>
                  <span style={{ fontWeight: '600', color: '#333' }}>Primary Data Source:</span>
                  <span style={{ marginLeft: '8px', color: '#555' }}>
                    {dataSourceMap[dataSource] || dataSource}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* 底部总结 */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between',
          padding: '12px',
          background: '#fff',
          borderRadius: '6px',
          border: '1px solid #f0f0f0',
          fontSize: '12px',
          color: '#666'
        }}>
          <div>
            <span style={{ fontWeight: '600', color: '#333' }}>Trend:</span>
            <span style={{ 
              marginLeft: '8px',
              display: 'inline-block',
              padding: '2px 8px',
              borderRadius: '4px',
              backgroundColor: getTrendColor(record.trendLabel),
              color: '#fff',
              fontWeight: '600'
            }}>
              {record.trendLabel || 'Neutral'}
            </span>
          </div>
          <div>
            <span style={{ fontWeight: '600', color: '#333' }}>Analysis Time:</span>
            <span style={{ marginLeft: '8px' }}>{new Date(record.timestamp * 1000).toLocaleTimeString()}</span>
          </div>
          <div>
            <span style={{ fontWeight: '600', color: '#333' }}>Last Updated:</span>
            <span style={{ marginLeft: '8px' }}>{new Date().toLocaleDateString()}</span>
          </div>
        </div>
      </div>
    );
  };


  // 过滤和排序后的市场扫描结果
  const filteredAndSortedScannerResults = useMemo(() => {
    if (!marketScannerResults || marketScannerResults.length === 0) {
      return [];
    }

    let filteredResults = [...marketScannerResults];
    
    // 应用趋势过滤
    const { trendFilter } = marketScannerFilters;
    if (trendFilter !== 'all') {
      filteredResults = filteredResults.filter(item => {
        const label = item.trendLabel || '';
        switch (trendFilter) {
          case 'bullish':
            return label.includes('Bullish');
          case 'bearish':
            return label.includes('Bearish');
          case 'neutral':
            return label === 'Neutral';
          case 'strong':
            return label.includes('Strong');
          default:
            return true;
        }
      });
    }
    
    // 应用排序
    const { sortBy, sortOrder } = marketScannerFilters;
    filteredResults.sort((a, b) => {
      let aValue: any = 0;
      let bValue: any = 0;
      
      switch (sortBy) {
        case 'trendScore':
          aValue = a.trendScore || 0;
          bValue = b.trendScore || 0;
          break;
        case 'volume':
          aValue = a.volume || 0;
          bValue = b.volume || 0;
          break;
        case 'changePct':
          aValue = a.changePct || 0;
          bValue = b.changePct || 0;
          break;
        case 'newsSentiment':
          // 新闻情绪排序：Positive > Mixed > Negative
          const sentimentOrder = { 'Positive': 3, 'Mixed': 2, 'Negative': 1, '': 0 };
          aValue = sentimentOrder[a.newsSentiment as keyof typeof sentimentOrder] || 0;
          bValue = sentimentOrder[b.newsSentiment as keyof typeof sentimentOrder] || 0;
          break;
        default:
          aValue = 0;
          bValue = 0;
      }
      
      // 应用排序顺序
      if (sortOrder === 'desc') {
        return bValue - aValue;
      } else {
        return aValue - bValue;
      }
    });
    
    return filteredResults;
  }, [marketScannerResults, marketScannerFilters]);

  // Step 3: 加载 AI 配置（接入真实配置系统）
  useEffect(() => {
    loadAiConfig();
  }, []);

  // Step 5: 组件卸载时清理定时器
  useEffect(() => {
    return () => {
      clearAutoScanTimer();
    };
  }, []);

  const loadAiConfig = async () => {
    try {
      const response = await aiTradingService.getProviderConfig();
      
      if (response.success && response.config) {
        const config = response.config;
        
        // 设置表单值
        aiConfigForm.setFieldsValue({
          provider: config.provider || 'DeepSeek',
          model: config.model || 'deepseek-chat',
          apiKey: config.apiKey || '',
          baseUrl: config.baseUrl || 'https://api.deepseek.com'
        });
        
        // 更新本地状态
        setAiConfig({
          provider: config.provider || 'DeepSeek',
          model: config.model || 'deepseek-chat',
          apiKey: config.apiKey || '',
          baseUrl: config.baseUrl || 'https://api.deepseek.com'
        });
      } else {
        console.warn('AI 配置加载失败或为空，使用默认值');
        // 使用默认值
        aiConfigForm.setFieldsValue({
          provider: 'DeepSeek',
          model: 'deepseek-chat',
          apiKey: '',
          baseUrl: 'https://api.deepseek.com'
        });
      }
    } catch (error) {
      console.error('加载 AI 配置失败:', error);
      message.error('加载 AI 配置失败');
      // 使用默认值
      aiConfigForm.setFieldsValue({
        provider: 'DeepSeek',
        model: 'deepseek-chat',
        apiKey: '',
        baseUrl: 'https://api.deepseek.com'
      });
    }
  };

  // 加载 Alpaca Paper Trading 真实账户数据
  const loadAlpacaAccount = async () => {
    setIsLoadingAccount(true);
    setAccountLoadError(null);
    try {
      console.log('开始加载 Alpaca Paper Trading 账户数据...');
      
      // 获取账户信息 - 直接使用导入的alpacaBrokerService实例
      const account = await alpacaBrokerService.getAccount();
      setAlpacaAccount(account);
      console.log('Alpaca 账户数据加载成功:', account);
      
      // 获取持仓信息
      let positions: AlpacaPosition[] = [];
      try {
        positions = await alpacaBrokerService.getPositions();
        setAlpacaPositions(positions);
        console.log(`Alpaca 持仓数据加载成功: ${positions.length} 个持仓`);
      } catch (positionsError) {
        console.warn('获取持仓数据失败:', positionsError);
        setAlpacaPositions([]);
      }
      
      // 获取订单信息
      let orders: AlpacaOrder[] = [];
      try {
        orders = await alpacaBrokerService.getOrders();
        setAlpacaOrders(orders);
        console.log(`Alpaca 订单数据加载成功: ${orders.length} 个订单`);
      } catch (ordersError) {
        console.warn('获取订单数据失败:', ordersError);
        setAlpacaOrders([]);
      }
      
      return {
        account,
        positions,
        orders
      };
    } catch (error: any) {
      console.error('加载 Alpaca 账户数据失败:', error);
      const errorMessage = error.response?.data?.error?.message || error.message || '未知错误';
      setAccountLoadError(errorMessage);
      message.error(`Alpaca 账户数据加载失败: ${errorMessage}`);
      
      // 返回null表示失败
      return null;
    } finally {
      setIsLoadingAccount(false);
    }
  };

  // Step 3: AI 配置保存（接入真实配置系统）
  const handleSaveAiConfig = async (values: any) => {
    setSavingConfig(true);
    try {
      // 构建符合 AIProviderConfig 接口的配置对象
      const config: AIProviderConfig = {
        provider: values.provider || 'DeepSeek',
        model: values.model || 'deepseek-chat',
        apiKey: values.apiKey || '',
        baseUrl: values.baseUrl || 'https://api.deepseek.com'
      };
      
      // 调用真实保存接口
      const response = await aiTradingService.saveProviderConfig(config);
      
      if (response.success) {
        message.success('AI 配置保存成功');
        
        // 更新本地状态
        setAiConfig(config);
        
        // 重新加载配置以确保与后端同步
        await loadAiConfig();
      } else {
        message.error('AI 配置保存失败');
        console.error('保存配置失败，响应:', response);
      }
    } catch (error: any) {
      console.error('保存 AI 配置失败:', error);
      message.error(`保存 AI 配置失败: ${error.message || '未知错误'}`);
    } finally {
      setSavingConfig(false);
    }
  };

  // Step 3: 测试 AI 连接（接入真实测试系统）
  const handleTestConnection = async () => {
    setTestingConnection(true);
    try {
      // 获取当前表单值
      const values = await aiConfigForm.validateFields();
      
      // 构建符合 AIProviderConfig 接口的配置对象
      const config: AIProviderConfig = {
        provider: values.provider || 'DeepSeek',
        model: values.model || 'deepseek-chat',
        apiKey: values.apiKey || '',
        baseUrl: values.baseUrl || 'https://api.deepseek.com'
      };
      
      // 调用真实测试接口
      const response = await aiTradingService.testProviderConnection(config);
      
      if (response.success && response.valid) {
        message.success(`AI 连接测试成功: ${response.message || '连接正常'}`);
      } else {
        message.error(`AI 连接测试失败: ${response.message || '连接失败'}`);
        console.error('连接测试失败，响应:', response);
      }
    } catch (error: any) {
      console.error('测试 AI 连接失败:', error);
      message.error(`测试 AI 连接失败: ${error.message || '未知错误'}`);
    } finally {
      setTestingConnection(false);
    }
  };

  // Market Scanner 函数
  const runMarketScanner = async (): Promise<void> => {
    setMarketScannerStatus(prev => ({ ...prev, status: 'running', progress: 0 }));
    setMarketScannerResults([]);
    
    try {
      console.log('开始市场扫描（使用真实后端API）...');
      
      // 1. 获取可交易股票列表（实用版全美股universe）
      const tradingSymbols = await getTradingUniverse();
      
      if (!tradingSymbols || tradingSymbols.length === 0) {
        console.warn('没有获取到可交易股票列表，使用默认股票池');
        // 使用默认股票池作为后备
        const defaultSymbols = [
          'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META',
          'TSLA', 'NVDA', 'AMD', 'AVGO', 'INTC',
          'JPM', 'XOM', 'WMT', 'HD', 'JNJ',
          'PG', 'KO', 'PEP', 'V', 'MA'
        ];
        await runRealMarketScan(defaultSymbols);
      } else {
        // 限制扫描数量，避免太重
        const symbolsToScan = tradingSymbols.slice(0, 50);
        await runRealMarketScan(symbolsToScan);
      }
      
    } catch (error: unknown) {
      console.error('市场扫描失败:', error);
      setMarketScannerStatus(prev => ({ ...prev, status: 'stopped' }));
      message.error('市场扫描失败');
    }
  };

  const runRealMarketScan = async (symbols: string[]): Promise<void> => {
    try {
      console.log(`调用后端市场扫描API，扫描 ${symbols.length} 只股票`);
      
      // 检查是否有恢复信息
      const resumeInfo = marketScannerStatus.rateLimitInfo ? {
        scanned_symbols: marketScannerStatus.rateLimitInfo.scannedSymbols || [],
        remaining_symbols: marketScannerStatus.rateLimitInfo.remainingSymbols || []
      } : null;
      
      // 调用新的后端市场扫描API
      const response = await fetch('/api/ai/market/scanner', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          symbols: symbols,
          maxSymbols: 50,
          resumeInfo: resumeInfo
        })
      });
      
      if (!response.ok) {
        // 检查是否是速率限制错误 (429)
        if (response.status === 429) {
          const errorData = await response.json().catch(() => ({}));
          handleRateLimitError({
            error: 'rate_limited',
            wait_seconds: 60,
            scanned_results: [],
            scanned_count: 0,
            scanned_symbols: symbols.slice(0, Math.floor(symbols.length / 2)), // 假设扫描了一半
            remaining_symbols: symbols.slice(Math.floor(symbols.length / 2)),
            message: 'Alpaca API速率限制 (429)'
          });
          return;
        }
        throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // 检查是否为速率限制错误
      if (data.error === 'rate_limited' || data.error_type === 'alpaca_rate_limit') {
        console.log('收到速率限制错误，处理恢复逻辑...');
        handleRateLimitError(data);
        return;
      }
      
      if (!data.success) {
        throw new Error(data.message || '市场扫描API返回失败');
      }
      
      // 处理结果
      const results = data.results || [];
      const summary = data.summary || {};
      
      console.log(`市场扫描完成，获取到 ${results.length} 个结果`);
      
      // 更新结果和摘要
      setMarketScannerResults(results);
      setMarketScannerSummary({
        universeScanned: summary.universeScanned || results.length,
        bullishCount: summary.bullishCount || 0,
        bearishCount: summary.bearishCount || 0,
        neutralCount: summary.neutralCount || 0,
        strongTrendCount: summary.strongTrendCount || 0,
        newsRiskCount: summary.newsRiskCount || 0,
        lastScanTime: new Date().toISOString()
      });
      
      // 更新状态 - 清除速率限制信息
      const now = new Date().toISOString();
      setMarketScannerStatus(prev => ({ 
        ...prev, 
        status: 'stopped', 
        lastScanTime: now,
        totalSymbols: symbols.length,
        scannedSymbols: results.length,
        progress: 100,
        rateLimitInfo: null  // 清除速率限制信息
      }));
      
      console.log('市场扫描完成（使用真实后端API）');
      message.success(`市场扫描完成，分析了 ${results.length} 只股票`);
      
    } catch (error: unknown) {
      console.error('真实市场扫描失败:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      message.error(`市场扫描失败: ${errorMessage}`);
      
      // 作为后备，使用本地模拟扫描
      console.log('回退到本地模拟扫描...');
      await scanSymbols(symbols.slice(0, 20));
    }
  };

  // 处理速率限制错误的辅助函数
  const handleRateLimitError = (errorData: any) => {
    console.log('处理速率限制错误:', errorData);
    
    const waitSeconds = errorData.wait_seconds || 60;
    const scannedResults = errorData.scanned_results || [];
    const scannedCount = errorData.scanned_count || scannedResults.length;
    const scannedSymbols = errorData.scanned_symbols || [];
    const remainingSymbols = errorData.remaining_symbols || [];
    const resumeAfter = errorData.resume_after || Date.now() + (waitSeconds * 1000);
    
    // 如果有部分扫描结果，更新结果
    if (scannedResults.length > 0) {
      setMarketScannerResults(prev => [...prev, ...scannedResults]);
      
      // 更新摘要
      const bullishCount = scannedResults.filter((r: any) => 'Bullish' in (r.trendLabel || '')).length;
      const bearishCount = scannedResults.filter((r: any) => 'Bearish' in (r.trendLabel || '')).length;
      const neutralCount = scannedResults.filter((r: any) => (r.trendLabel || '') === 'Neutral').length;
      
      setMarketScannerSummary(prev => ({
        ...prev,
        universeScanned: prev.universeScanned + scannedResults.length,
        bullishCount: prev.bullishCount + bullishCount,
        bearishCount: prev.bearishCount + bearishCount,
        neutralCount: prev.neutralCount + neutralCount,
        lastScanTime: new Date().toISOString()
      }));
    }
    
    // 更新状态为速率限制
    setMarketScannerStatus(prev => ({
      ...prev,
      status: 'rate_limited',
      scannedSymbols: prev.scannedSymbols + scannedCount,
      progress: scannedCount > 0 ? Math.min(95, Math.round((scannedCount / (scannedCount + remainingSymbols.length)) * 100)) : prev.progress,
      rateLimitInfo: {
        waitSeconds,
        resumeTime: new Date(resumeAfter).toISOString(),
        scannedSymbols: scannedSymbols,
        remainingSymbols: remainingSymbols
      }
    }));
    
    // 显示消息
    message.warning(`Alpaca API速率限制，等待 ${waitSeconds} 秒后继续剩余 ${remainingSymbols.length} 只股票`);
    
    // 设置定时器恢复扫描
    setTimeout(() => {
      console.log('速率限制等待结束，恢复扫描剩余股票...');
      if (remainingSymbols.length > 0) {
        setMarketScannerStatus(prev => ({ ...prev, status: 'waiting_to_resume' }));
        message.info(`恢复扫描剩余 ${remainingSymbols.length} 只股票`);
        // 稍后调用恢复扫描（避免状态更新竞争）
        setTimeout(() => {
          runRealMarketScan(remainingSymbols);
        }, 1000);
      } else {
        setMarketScannerStatus(prev => ({ ...prev, status: 'stopped', rateLimitInfo: null }));
      }
    }, waitSeconds * 1000);
  };

  const getTradingUniverse = async (): Promise<string[]> => {
    try {
      // 这里应该调用后端API获取Alpaca可交易股票列表
      // 暂时返回一个实用股票列表
      return [
        'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META',
        'TSLA', 'NVDA', 'AMD', 'AVGO', 'INTC',
        'JPM', 'XOM', 'WMT', 'HD', 'JNJ',
        'PG', 'KO', 'PEP', 'V', 'MA',
        'BAC', 'C', 'GS', 'JPM', 'WFC',
        'XOM', 'CVX', 'COP', 'SLB', 'EOG',
        'WMT', 'TGT', 'COST', 'HD', 'LOW',
        'JNJ', 'PFE', 'MRK', 'ABT', 'UNH',
        'PG', 'KO', 'PEP', 'CL', 'PM',
        'DIS', 'NFLX', 'CMCSA', 'T', 'VZ'
      ];
    } catch (error: unknown) {
      console.error('获取交易股票列表失败:', error);
      return [];
    }
  };

  const scanSymbols = async (symbols: string[]): Promise<void> => {
    const totalSymbols = symbols.length;
    setMarketScannerStatus(prev => ({ ...prev, totalSymbols, scannedSymbols: 0 }));
    
    const results: any[] = [];
    
    for (let i = 0; i < symbols.length; i++) {
      const symbol = symbols[i];
      
      try {
        // 更新进度
        setMarketScannerStatus(prev => ({ ...prev, scannedSymbols: i + 1, progress: Math.round(((i + 1) / totalSymbols) * 100) }));
        
        // 获取股票数据
        const stockData = await marketDataService.getStockData(symbol);
        
        // 获取新闻数据（如果有）
        const newsData = await getStockNews(symbol);
        
        // 计算趋势分数和标签
        const trendAnalysis = await analyzeTrend(symbol, stockData, newsData);
        
        // 添加到结果
        results.push({
          symbol,
          trendLabel: trendAnalysis.trendLabel,
          trendScore: trendAnalysis.trendScore,
          trendConfidence: trendAnalysis.trendConfidence,
          price: stockData.price || 0,
          changePct: stockData.changePercent || 0,
          volume: stockData.volume || 0,
          relativeVolume: calculateRelativeVolume(stockData.volume, symbol),
          newsSentiment: newsData.sentiment,
          eventRisk: newsData.eventRisk,
          sector: stockData.sector || 'Unknown',
          scannerReason: trendAnalysis.scannerReason,
          timestamp: new Date().toISOString()
        });
        
        console.log(`扫描 ${symbol}: ${trendAnalysis.trendLabel} (${trendAnalysis.trendScore})`);
        
      } catch (error: unknown) {
        console.error(`扫描 ${symbol} 失败:`, error);
        // 继续扫描下一个
      }
      
      // 小延迟避免请求过快
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // 更新结果和摘要
    setMarketScannerResults(results);
    updateScannerSummary(results);
  };

  const getStockNews = async (symbol: string): Promise<any> => {
    try {
      // 这里应该调用新闻API
      // 暂时返回模拟数据
      const sentiments = ['Positive', 'Mixed', 'Negative'];
      const risks = ['Low', 'Medium', 'High'];
      
      return {
        sentiment: sentiments[Math.floor(Math.random() * sentiments.length)],
        eventRisk: risks[Math.floor(Math.random() * risks.length)],
        topCatalyst: 'No strong recent news context'
      };
    } catch (error) {
      console.error(`获取 ${symbol} 新闻失败:`, error);
      return {
        sentiment: 'Mixed',
        eventRisk: 'Low',
        topCatalyst: 'No news data available'
      };
    }
  };

  const analyzeTrend = async (symbol: string, stockData: any, newsData: any): Promise<any> => {
    // 这里实现真正的趋势分析逻辑
    // 基于价格、成交量、新闻等计算趋势
    
    // 模拟趋势分数计算
    const baseScore = 50 + (Math.random() * 50 - 25); // 50 ± 25
    const newsBonus = newsData.sentiment === 'Positive' ? 15 : newsData.sentiment === 'Negative' ? -15 : 0;
    const volumeBonus = (stockData.volume || 0) > 10000000 ? 10 : 0;
    
    const trendScore = Math.max(0, Math.min(100, baseScore + newsBonus + volumeBonus));
    const trendConfidence = 0.5 + (Math.random() * 0.5); // 0.5-1.0
    
    const trendLabel = getTrendLabel(trendScore);
    const scannerReason = generateScannerReason(symbol, trendScore, newsData, stockData);
    
    return {
      trendLabel,
      trendScore,
      trendConfidence,
      scannerReason
    };
  };

  const calculateRelativeVolume = (volume: number | null, symbol: string): string => {
    // 这里应该计算相对于平均成交量的比例
    // 暂时返回模拟值
    const levels = ['Low', 'Normal', 'High', 'Very High'];
    return levels[Math.floor(Math.random() * levels.length)];
  };

  const getTrendLabel = (score: number): string => {
    if (score >= 80) return 'Strong Bullish';
    if (score >= 60) return 'Bullish';
    if (score >= 40) return 'Neutral';
    if (score >= 20) return 'Bearish';
    return 'Strong Bearish';
  };

  const getTrendColor = (label: string): string => {
    switch (label) {
      case 'Strong Bullish': return '#52c41a';
      case 'Bullish': return '#73d13d';
      case 'Neutral': return '#faad14';
      case 'Bearish': return '#ff7875';
      case 'Strong Bearish': return '#ff4d4f';
      default: return '#8c8c8c';
    }
  };

  const generateScannerReason = (symbol: string, score: number, newsData: any, stockData: any): string => {
    const reasons = [
      `Price above key moving averages with positive momentum`,
      `Strong volume participation supports current trend`,
      `Mixed technical signals with no clear direction`,
      `Negative news pressure outweighs technical strength`,
      `Breakout above resistance level with confirmation`,
      `Consolidation pattern forming, awaiting catalyst`
    ];
    return reasons[Math.floor(Math.random() * reasons.length)];
  };

  const updateScannerSummary = (results: any[]): void => {
    const bullishCount = results.filter(r => r.trendLabel.includes('Bullish')).length;
    const bearishCount = results.filter(r => r.trendLabel.includes('Bearish')).length;
    const neutralCount = results.filter(r => r.trendLabel === 'Neutral').length;
    const strongTrendCount = results.filter(r => r.trendLabel.includes('Strong')).length;
    const newsRiskCount = results.filter(r => r.eventRisk === 'High').length;
    
    setMarketScannerSummary({
      universeScanned: results.length,
      bullishCount,
      bearishCount,
      neutralCount,
      strongTrendCount,
      newsRiskCount,
      lastScanTime: new Date().toISOString()
    });
  };

  const clearMarketScannerTimer = (): void => {
    if (marketScannerTimerRef.current) {
      clearTimeout(marketScannerTimerRef.current);
      marketScannerTimerRef.current = null;
    }
  };

  const handleStartMarketScannerAuto = (): void => {
    setMarketScannerAutoEnabled(true);
    runMarketScanner();
    
    // 设置30分钟自动扫描
    marketScannerTimerRef.current = setTimeout(() => {
      if (marketScannerAutoEnabled) {
        runMarketScanner();
      }
    }, 30 * 60 * 1000);
  };

  const handleStopMarketScannerAuto = (): void => {
    setMarketScannerAutoEnabled(false);
    clearMarketScannerTimer();
  };

  const handleRunMarketScannerNow = (): void => {
    if (marketScannerStatus.status === 'running') {
      message.warning('扫描正在进行中');
      return;
    }
    runMarketScanner();
  };

  const handleSymbolClick = (symbol: string): void => {
    // 将选中的symbol添加到AI Recommendations扫描
    message.info(`已将 ${symbol} 添加到分析队列`);
    // 这里可以实现将symbol添加到AI分析队列的逻辑
  };

  // Step 4: 获取候选股票符号 - 扩展股票池：科技股 + 非科技股
  const getCandidateSymbols = async (): Promise<{symbols: string[], source: string, scanType: string}> => {
    try {
      console.log('开始扩展股票池扫描...');
      
      // 1. 扩展股票池：科技股 + 非科技股
      // 科技股列表（主要科技股）
      const techStocks = [
        'NVDA', 'AAPL', 'MSFT', 'AMD', 'AVGO',
        'META', 'AMZN', 'GOOGL', 'TSLA', 'INTC'
      ];
      
      // 非科技股列表（不同板块）
      const nonTechStocks = [
        'WMT', 'HD', 'JPM', 'XOM', 'UNH',
        'COST', 'KO', 'CAT', 'JNJ', 'PG'
      ];
      
      // 合并所有股票
      const allCandidates = [...techStocks, ...nonTechStocks];
      
      console.log(`扩展股票池: ${techStocks.length}只科技股 + ${nonTechStocks.length}只非科技股 = ${allCandidates.length}只股票`);
      console.log(`科技股: ${techStocks.slice(0, 5).join(', ')}${techStocks.length > 5 ? '...' : ''}`);
      console.log(`非科技股: ${nonTechStocks.slice(0, 5).join(', ')}${nonTechStocks.length > 5 ? '...' : ''}`);
      
      // 2. 验证股票数据可用性（可选步骤）
      // 注意：这里我们假设所有股票都有数据，实际扫描时会验证
      
      // 3. 返回所有候选股票
      // 在实际应用中，可以限制每次扫描的数量，但为了演示目的，我们返回所有
      // 实际扫描时会为每个symbol执行完整的分析流程
      const symbolsToScan = allCandidates.slice(0, 12); // 限制最多扫描12只股票以保持性能
      
      console.log(`扩展股票池扫描完成，将扫描 ${symbolsToScan.length} 只股票: ${symbolsToScan.join(', ')}`);
      
      return { 
        symbols: symbolsToScan, 
        source: 'expanded_universe', 
        scanType: 'expanded_tech_nontech'
      };
      
    } catch (error: any) {
      console.error('扩展股票池扫描失败:', error);
      // 如果扩展扫描失败，回退到原始的市场扫描逻辑
      console.log('尝试回退到原始市场扫描逻辑...');
      return await fallbackMarketScan();
    }
  };
  
  // 回退函数：原始市场扫描逻辑
  const fallbackMarketScan = async (): Promise<{symbols: string[], source: string, scanType: string}> => {
    try {
      console.log('开始回退市场扫描...');
      
      const response = await marketAPI.getStocks();
      
      if (!response.data || !response.data.stocks || !Array.isArray(response.data.stocks)) {
        throw new Error('市场数据源返回的股票列表为空或格式不正确');
      }
      
      const allStocks = response.data.stocks;
      
      // 简单的股票选择：取前5只有数据的股票
      const validStocks = allStocks.filter((stock: any) => 
        stock.symbol && stock.changePercent !== null && stock.price !== null
      ).slice(0, 5);
      
      if (validStocks.length === 0) {
        throw new Error('没有找到有效的股票数据');
      }
      
      const symbols = validStocks.map((stock: any) => stock.symbol);
      console.log(`回退市场扫描完成: ${symbols.join(', ')}`);
      
      return { 
        symbols, 
        source: 'fallback_market_scan', 
        scanType: 'market_all' 
      };
    } catch (fallbackError: any) {
      console.error('回退市场扫描失败:', fallbackError);
      // 如果回退也失败，返回一个最小的默认列表
      const defaultSymbols = ['NVDA', 'AAPL', 'WMT', 'JPM'];
      console.log(`使用默认股票列表: ${defaultSymbols.join(', ')}`);
      return { 
        symbols: defaultSymbols, 
        source: 'default_list', 
        scanType: 'default' 
      };
    }
  };

  // Step 2: 扫描控制函数（只做 UI，不接真实逻辑）
  // Step 5: 清理定时器
  const clearAutoScanTimer = () => {
    if (autoScanTimerRef.current) {
      clearTimeout(autoScanTimerRef.current);
      autoScanTimerRef.current = null;
    }
  };

  // Step 5: 计算下一次运行时间
  const calculateNextRunTime = (): string => {
    const intervalMinutes = parseInt(scanInterval);
    const nextRunTime = new Date(Date.now() + intervalMinutes * 60 * 1000);
    return nextRunTime.toISOString();
  };

  // Step 5: 安排下一次自动扫描
  const scheduleNextAutoScan = () => {
    // 只在自动扫描启用时安排下一次 - 使用 ref 获取最新值
    if (!isAutoScanEnabledRef.current) {
      console.log('自动扫描未启用，不安排下一次扫描');
      return;
    }
    
    clearAutoScanTimer(); // 先清理旧的定时器
    
    const intervalMinutes = parseInt(scanInterval);
    const intervalMs = intervalMinutes * 60 * 1000;
    
    console.log(`安排下一次自动扫描，间隔 ${intervalMinutes} 分钟`);
    
    autoScanTimerRef.current = setTimeout(async () => {
      try {
        console.log(`自动扫描定时器触发，间隔 ${intervalMinutes} 分钟`);
        
        // 执行扫描
        await runAiScanOnce(true);
      } catch (error) {
        console.error('自动扫描执行失败:', error);
      } finally {
        // 无论扫描是否成功或跳过，如果自动扫描仍然启用，都安排下一次
        if (isAutoScanEnabledRef.current) {
          scheduleNextAutoScan();
        }
      }
    }, intervalMs);
    
    // 更新下一次运行时间
    const nextRun = calculateNextRunTime();
    setScanStatus(prev => ({ 
      ...prev, 
      status: 'scheduled',
      nextRun 
    }));
  };

  // Step 5: 启动自动扫描
  const handleStartAutoScan = () => {
    // 防止重复启动 - 检查是否已启用自动扫描
    if (isAutoScanEnabled) {
      message.warning('自动扫描已在运行中');
      return;
    }
    
    // 清理旧的定时器
    clearAutoScanTimer();
    
    // 启用自动扫描模式
    setIsAutoScanEnabled(true);
    isAutoScanEnabledRef.current = true; // 同步更新ref
    
    // 更新状态为 scheduled（等待第一次扫描）
    setScanStatus(prev => ({
      ...prev,
      status: 'scheduled',
      nextRun: calculateNextRunTime(),
      progress: 0
    }));
    
    message.success(`已启动自动扫描，间隔 ${scanInterval} 分钟`);
    
    // 立即执行第一次扫描，扫描完成后会自动安排下一次
    runAiScanOnce(true);
  };

  // Step 5: 停止自动扫描
  const handleStopAutoScan = () => {
    // 禁用自动扫描模式
    setIsAutoScanEnabled(false);
    isAutoScanEnabledRef.current = false; // 同步更新ref
    
    // 清理定时器
    clearAutoScanTimer();
    
    // 更新状态
    // 注意：不改变 isScanInProgress，让当前扫描正常完成
    setScanStatus(prev => ({
      ...prev,
      status: 'stopped',
      nextRun: null,
      // 保持 progress 不变，如果正在扫描中
    }));
    
    message.success('已停止自动扫描');
  };

  // Step 5: 统一的扫描入口函数
  const runAiScanOnce = async (isAutoScan: boolean = false): Promise<void> => {
    try {
      // 防止重复扫描 - 使用 isScanInProgress
      if (isScanInProgress) {
        console.log('扫描已在运行中，跳过本次扫描');
        if (!isAutoScan) {
          message.warning('扫描已在运行中，请等待完成');
        }
        // 对于自动扫描，返回一个标志表示扫描被跳过
        // 这样 scheduleNextAutoScan 的 finally 块仍然会安排下一次扫描
        return;
      }

      // 更新状态为运行中 - 只设置扫描进度状态
      setIsScanInProgress(true);
      setScanStatus(prev => ({
        ...prev,
        status: 'running',
        progress: 0
      }));
      
      // 清空之前的错误和推荐
      setScanErrors([]);
      if (!isAutoScan) {
        setAiRecommendations([]); // 手动扫描时清空之前的推荐
      }
      
      if (!isAutoScan) {
        message.info('开始 AI 扫描...');
      }
      
      // ========== 第一步：加载 Alpaca Paper Trading 真实账户数据 ==========
      console.log('开始加载 Alpaca Paper Trading 账户数据...');
      let accountData = null;
      try {
        accountData = await loadAlpacaAccount();
        if (!accountData) {
          throw new Error('无法加载 Alpaca 账户数据');
        }
        console.log('Alpaca 账户数据加载成功，开始扫描...');
      } catch (accountError: any) {
        console.error('加载 Alpaca 账户数据失败:', accountError);
        if (!isAutoScan) {
          message.error(`Alpaca 账户数据加载失败: ${accountError.message || '未知错误'}`);
        }
        setIsScanInProgress(false);
        setScanStatus(prev => ({ ...prev, status: 'stopped', progress: 0 }));
        return;
      }
      
      // 从账户数据中提取关键信息
      const { account, positions } = accountData;
      const buyingPower = account?.buyingPower || 0;
      const portfolioValue = account?.portfolioValue || 0;
      const isTradingBlocked = account?.tradingBlocked || false;
      
      if (isTradingBlocked) {
        console.warn('Alpaca 账户交易被阻止，无法执行交易');
        if (!isAutoScan) {
          message.warning('Alpaca 账户交易被阻止，只能进行模拟分析');
        }
      }
      
      // 构建账户上下文用于AI分析
      const accountContext = {
        cash: account?.cash || 0,
        equity: account?.equity || 0,
        buyingPower,
        portfolioValue,
        tradingBlocked: isTradingBlocked,
        positions: positions || [],
        positionsCount: positions?.length || 0
      };
      
      // 1. 获取候选股票
      let candidateSymbols: string[] = [];
      let candidateSymbolsSource = 'unknown';
      let candidateScanType = 'unknown';
      try {
        const candidateResult = await getCandidateSymbols();
        candidateSymbols = candidateResult.symbols;
        candidateSymbolsSource = candidateResult.source;
        candidateScanType = candidateResult.scanType;
      } catch (symbolError: any) {
        if (!isAutoScan) {
          message.error(`获取候选股票失败: ${symbolError.message}`);
        }
        setIsScanInProgress(false);
        setScanStatus(prev => ({ ...prev, status: 'stopped', progress: 0 }));
        return;
      }
      
      if (candidateSymbols.length === 0) {
        if (!isAutoScan) {
          message.warning('没有找到候选股票，请先添加股票到 watchlist 或确保市场数据源可用');
        }
        setIsScanInProgress(false);
        setScanStatus(prev => ({ ...prev, status: 'stopped', progress: 0 }));
        return;
      }
      
      console.log(`开始扫描 ${candidateSymbols.length} 个股票:`, candidateSymbols);
      
      const recommendations = [];
      const failedSymbols: Array<{symbol: string, error: string, step: string}> = [];
      const totalSymbols = candidateSymbols.length;
      
      for (let i = 0; i < totalSymbols; i++) {
        const symbol = candidateSymbols[i];
        
        try {
          // 更新进度
          const progress = Math.round(((i + 1) / totalSymbols) * 100);
          setScanStatus(prev => ({ ...prev, progress }));
          
          console.log(`正在分析股票 ${i + 1}/${totalSymbols}: ${symbol}`);
          
          // 跟踪每个步骤的状态
          let marketSuccess = false;
          let backtestSuccess = false;
          let optimizationSuccess = false;
          let aiSuccess = false;
          
          // 2. 获取市场数据
          let marketData: any = null;
          try {
            marketData = await marketDataService.getStockData(symbol);
            console.log(`股票 ${symbol} 市场数据获取成功:`, { 
              price: marketData.price,
              changePercent: marketData.changePercent 
            });
            marketSuccess = true;
          } catch (marketError: any) {
            console.error(`股票 ${symbol} 市场数据获取失败:`, marketError);
            failedSymbols.push({
              symbol,
              error: marketError.message || 'Market data fetch failed',
              step: 'Market data'
            });
            continue; // 跳过这个股票，继续下一个
          }
          
          // 3. 运行回测（使用最简单的 moving_average 策略）
          // 获取本地日期，确保不超过今天
          const getLocalDateString = (date: Date): string => {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
          };
          
          const today = new Date();
          const oneYearAgo = new Date(today);
          oneYearAgo.setFullYear(today.getFullYear() - 1);
          
          const backtestConfig = {
            symbol: symbol, // 关键修复：使用'symbol'而不是'symbols'数组
            strategy: 'moving_average',
            startDate: getLocalDateString(oneYearAgo), // 1年前（本地日期）
            endDate: getLocalDateString(today), // 今天（本地日期）
            initialCapital: 10000,
            dataMode: 'real', // 固定使用真实数据
            parameters: {
              shortMaPeriod: 20,
              longMaPeriod: 50
            }
          };
          
          // ========== DEBUG: AI Agent发起backtest前 ==========
          console.log(`=== DEBUG Layer A: AI Agent发起backtest前 (${symbol}) ===`);
          console.log(`recommendation symbol: ${symbol}`);
          console.log(`backtestConfig.symbol: ${backtestConfig.symbol}`);
          console.log(`strategy: ${backtestConfig.strategy}`);
          console.log(`date range: ${backtestConfig.startDate} to ${backtestConfig.endDate}`);
          console.log(`backtestConfig: ${JSON.stringify(backtestConfig)}`);
          // ========== END DEBUG ==========
          
          let backtestResponse: any;
          try {
            backtestResponse = await backtraderAPI.runBacktest(backtestConfig);
            console.log(`股票 ${symbol} 回测响应:`, {
              success: backtestResponse.data?.success,
              hasResult: !!backtestResponse.data?.result,
              resultKeys: backtestResponse.data?.result ? Object.keys(backtestResponse.data.result) : []
            });
            // 检查backtest是否真正成功
            if (backtestResponse.data?.success && backtestResponse.data?.result) {
              backtestSuccess = true;
            }
          } catch (backtestError: any) {
            console.error(`股票 ${symbol} 回测失败:`, backtestError);
            failedSymbols.push({
              symbol,
              error: backtestError.message || 'Backtest failed',
              step: 'Backtest'
            });
            continue; // 跳过这个股票，继续下一个
          }
          
          // 4. 运行参数优化
          const optimizationConfig = {
            symbol: symbol,
            strategy: 'moving_average',
            startDate: backtestConfig.startDate,
            endDate: backtestConfig.endDate,
            initialCapital: backtestConfig.initialCapital,
            parameters: {
              shortMaPeriod: { min: 5, max: 30, step: 5 },
              longMaPeriod: { min: 30, max: 100, step: 10 }
            }
          };
          
          let optimizationResponse: any;
          try {
            optimizationResponse = await backtraderAPI.runParameterOptimization(optimizationConfig);
            console.log(`股票 ${symbol} 参数优化响应:`, {
              success: optimizationResponse.data?.success,
              hasResult: !!optimizationResponse.data?.result,
              resultKeys: optimizationResponse.data?.result ? Object.keys(optimizationResponse.data.result) : []
            });
            // 检查optimization是否真正成功
            if (optimizationResponse.data?.success && optimizationResponse.data?.result) {
              optimizationSuccess = true;
            }
          } catch (optimizationError: any) {
            console.error(`股票 ${symbol} 参数优化失败:`, optimizationError);
            failedSymbols.push({
              symbol,
              error: optimizationError.message || 'Parameter optimization failed',
              step: 'Parameter optimization'
            });
            // 不跳过，继续处理，但使用空的optimization结果
            optimizationResponse = { data: { success: false, result: null } };
          }
          
          // ========== DEBUG: 打印每个symbol的原始backtest值 ==========
          console.log(`=== DEBUG: ${symbol} 原始backtest值 ===`);
          console.log('backtestResponse.data:', JSON.stringify(backtestResponse.data, null, 2));
          if (backtestResponse.data?.result) {
            const result = backtestResponse.data.result;
            console.log(`symbol: ${symbol}`);
            console.log(`backtestId: ${result.backtestId || 'N/A'}`);
            console.log(`totalReturn: ${result.results?.totalReturn || result.totalReturn || 'N/A'}`);
            console.log(`sharpeRatio: ${result.results?.sharpeRatio || result.sharpeRatio || 'N/A'}`);
            console.log(`maxDrawdown: ${result.results?.maxDrawdown || result.maxDrawdown || 'N/A'}`);
            console.log(`---`);
          }
          // ========== END DEBUG ==========
          
          // 5. 准备 AI 分析上下文 - 包含真实 Alpaca 账户数据
          // 检查当前symbol是否已有持仓
          const existingPosition = positions?.find((p: any) => p.symbol === symbol);
          const currentSymbolPosition = existingPosition ? {
            symbol: existingPosition.symbol,
            qty: existingPosition.quantity || 0,
            avgPrice: existingPosition.avgPrice || 0,
            marketValue: existingPosition.marketValue || 0,
            unrealizedPL: existingPosition.unrealizedPL || 0,
            unrealizedPLPercent: existingPosition.unrealizedPLPercent || 0
          } : null;
          
          const aiContext = {
            symbol: symbol,
            marketData: {
              price: marketData.price,
              changePercent: marketData.changePercent,
              volume: marketData.volume,
              dayHigh: marketData.dayHigh,
              dayLow: marketData.dayLow
            },
            backtestResult: backtestResponse.data?.result || {},
            optimizationResult: optimizationResponse.data?.result || {},
            accountSnapshot: {
              cash: account?.cash || 0,
              equity: account?.equity || 0,
              buyingPower: account?.buyingPower || 0,
              portfolioValue: account?.portfolioValue || 0,
              tradingBlocked: account?.tradingBlocked || false,
              positionsCount: positions?.length || 0,
              openOrdersCount: alpacaOrders?.length || 0
            },
            positions: positions?.map((p: any) => ({
              symbol: p.symbol,
              qty: p.quantity || 0,
              avgPrice: p.avgPrice || 0,
              marketValue: p.marketValue || 0
            })) || [],
            currentPosition: currentSymbolPosition,
            tradingEnvironment: 'paper' // 固定为paper trading环境
          };
          
          console.log(`AI Context for ${symbol}:`, {
            hasAccountData: !!account,
            buyingPower: account?.buyingPower,
            hasPosition: !!currentSymbolPosition,
            positionQty: currentSymbolPosition?.qty
          });
          
          // 6. 调用 AI 分析
          const aiResponse = await aiTradingService.previewTradeWithContext(symbol, aiContext);
          console.log(`股票 ${symbol} AI 分析响应:`, {
            success: aiResponse.success,
            hasDecision: !!aiResponse.decision,
            decision: aiResponse.decision,
            validation: aiResponse.validation,
            responseStructure: Object.keys(aiResponse)
          });
          
          // 检查AI分析是否成功
          if (aiResponse.success && aiResponse.decision) {
            aiSuccess = true;
          }
          
          // 7. 构建推荐结果（无论成功还是失败都添加）
          let recommendation;
          
          // 基础字段
          const baseFields = {
            symbol: symbol,
            generatedTime: new Date().toISOString(),
            strategyUsed: 'moving_average',
            symbolsSource: candidateSymbolsSource,
            scanType: candidateScanType,
            backtestRange: `${backtestConfig.startDate} → ${backtestConfig.endDate}`,
            optimizationRange: `${optimizationConfig.startDate} → ${optimizationConfig.endDate}`
          };
          
          if (aiResponse.success && aiResponse.decision) {
            const decision = aiResponse.decision;
            
            // ========== DEBUG: 构建证据摘要前的值 ==========
            console.log(`=== DEBUG: ${symbol} evidenceSummary构建 ===`);
            console.log('backtestResponse.data?.result:', backtestResponse.data?.result);
            if (backtestResponse.data?.result) {
              const result = backtestResponse.data.result;
              console.log(`backtestKeyResults源值:`);
              console.log(`  totalReturn: ${result.results?.totalReturn || result.totalReturn}`);
              console.log(`  sharpeRatio: ${result.results?.sharpeRatio || result.sharpeRatio}`);
              console.log(`  maxDrawdown: ${result.results?.maxDrawdown || result.maxDrawdown}`);
            }
            // ========== END DEBUG ==========
            
            // 构建证据摘要
            // 注意: backtest 返回结构为 {success: true, result: {results: {totalReturn, sharpeRatio, maxDrawdown, ...}, ...}}
            // optimization 返回结构为 {success: true, result: {summary: {bestScore, bestCombination, totalCombinations, ...}, ...}}
            const evidenceSummary = {
              marketData: marketData ? {
                price: marketData.price,
                changePercent: marketData.changePercent,
                volume: marketData.volume
              } : null,
              backtestKeyResults: backtestResponse.data?.result ? {
                totalReturn: backtestResponse.data.result.results?.totalReturn || backtestResponse.data.result.totalReturn,
                sharpeRatio: backtestResponse.data.result.results?.sharpeRatio || backtestResponse.data.result.sharpeRatio,
                maxDrawdown: backtestResponse.data.result.results?.maxDrawdown || backtestResponse.data.result.maxDrawdown,
                winRate: backtestResponse.data.result.results?.winRate || backtestResponse.data.result.winRate
              } : null,
              optimizationKeyResults: optimizationResponse.data?.result ? {
                bestScore: optimizationResponse.data.result.summary?.bestScore || optimizationResponse.data.result.bestScore,
                bestCombination: optimizationResponse.data.result.summary?.bestCombination || optimizationResponse.data.result.bestCombination,
                totalCombinations: optimizationResponse.data.result.summary?.totalCombinations || optimizationResponse.data.result.totalCombinations
              } : null,
              aiReasoning: decision.reason || 'Standard moving average crossover analysis'
            };
            
            // ========== DEBUG: 构建证据摘要后的值 ==========
            console.log(`=== DEBUG: ${symbol} evidenceSummary构建完成 ===`);
            console.log('evidenceSummary.backtestKeyResults:', evidenceSummary.backtestKeyResults);
            console.log('evidenceFull JSON:', JSON.stringify(evidenceSummary));
            // ========== END DEBUG ==========
            
            // 构建更详细的后测摘要
            const backtestDetailedSummary = backtestResponse.data?.result ? 
              `Return: ${(backtestResponse.data.result.results?.totalReturn || backtestResponse.data.result.totalReturn)?.toFixed(2) || 'N/A'}% | ` +
              `Sharpe: ${(backtestResponse.data.result.results?.sharpeRatio || backtestResponse.data.result.sharpeRatio)?.toFixed(2) || 'N/A'} | ` +
              `Drawdown: ${(backtestResponse.data.result.results?.maxDrawdown || backtestResponse.data.result.maxDrawdown)?.toFixed(2) || 'N/A'}%` :
              'Backtest unavailable';
            
            // 构建更详细的优化摘要
            const optimizationDetailedSummary = optimizationResponse.data?.success === false 
              ? 'Optimization unavailable (404)' 
              : optimizationResponse.data?.result?.summary?.bestCombination || optimizationResponse.data?.result?.bestCombination
                ? `Best: ${JSON.stringify(optimizationResponse.data.result.summary?.bestCombination || optimizationResponse.data.result.bestCombination)} | ` +
                  `Score: ${(optimizationResponse.data.result.summary?.bestScore || optimizationResponse.data.result.bestScore)?.toFixed(4) || 'N/A'}` 
                : 'Optimization completed';
            
            // 生成简洁的 reason 总结（一句话）
            const generateReasonSummary = () => {
              const action = decision.action;
              const displayAction = action === 'SKIP' ? 'HOLD' : action;
              const confidence = decision.confidence || 0.5;
              const recommendedQty = decision.recommendedQty || decision.positionSize || decision.qty || 0;
              
              // 根据 backtest 结果生成简洁信号
              let backtestSignal = '';
              const backtestReturn = backtestResponse.data?.result?.results?.totalReturn !== undefined 
                ? backtestResponse.data.result.results.totalReturn 
                : backtestResponse.data?.result?.totalReturn;
              if (backtestReturn !== undefined) {
                const returnVal = backtestReturn;
                if (returnVal > 10) backtestSignal = 'strong positive backtest';
                else if (returnVal > 5) backtestSignal = 'positive backtest';
                else if (returnVal < -5) backtestSignal = 'negative backtest';
                else if (returnVal < -10) backtestSignal = 'strong negative backtest';
                else backtestSignal = 'neutral backtest';
              } else {
                backtestSignal = 'no backtest data';
              }
              
              // 根据市场数据生成简洁趋势
              let marketTrend = '';
              if (marketData?.changePercent !== undefined) {
                const change = marketData.changePercent;
                if (change > 3) marketTrend = 'bullish trend';
                else if (change > 1) marketTrend = 'slightly bullish';
                else if (change < -3) marketTrend = 'bearish trend';
                else if (change < -1) marketTrend = 'slightly bearish';
                else marketTrend = 'neutral trend';
              } else {
                marketTrend = 'no market data';
              }
              
              // 根据置信度生成简洁描述
              let confidenceDesc = '';
              if (confidence >= 0.8) confidenceDesc = 'high confidence';
              else if (confidence >= 0.6) confidenceDesc = 'medium confidence';
              else confidenceDesc = 'low confidence';
              
              // 生成一句话总结，包含推荐数量
              if (displayAction === 'BUY' && recommendedQty > 0) {
                return `BUY ${recommendedQty} shares: ${marketTrend}, ${backtestSignal}, ${confidenceDesc}.`;
              } else if (displayAction === 'SELL' && recommendedQty > 0) {
                return `SELL ${recommendedQty} shares: ${marketTrend}, ${backtestSignal}, ${confidenceDesc}.`;
              } else if (displayAction === 'HOLD') {
                return `HOLD: ${marketTrend}, ${backtestSignal}, ${confidenceDesc}.`;
              } else if (displayAction === 'ERROR') {
                return `ERROR: ${decision.reason || 'AI analysis failed'}`;
              } else {
                return `${displayAction}: ${marketTrend}, ${backtestSignal}, ${confidenceDesc}.`;
              }
            };
            
            // 生成详细的 evidence 摘要
            const generateEvidenceSummary = () => {
              const parts = [];
              
              // 市场数据证据
              if (marketData?.changePercent !== undefined) {
                const changeText = marketData.changePercent >= 0 ? `up ${marketData.changePercent.toFixed(2)}%` : `down ${Math.abs(marketData.changePercent).toFixed(2)}%`;
                parts.push(`Market: ${changeText} at $${marketData.price?.toFixed(2) || 'N/A'}`);
              }
              
              // 回测证据
              const backtestReturn = backtestResponse.data?.result?.results?.totalReturn !== undefined 
                ? backtestResponse.data.result.results.totalReturn 
                : backtestResponse.data?.result?.totalReturn;
              const backtestSharpe = backtestResponse.data?.result?.results?.sharpeRatio !== undefined 
                ? backtestResponse.data.result.results.sharpeRatio 
                : backtestResponse.data?.result?.sharpeRatio;
              if (backtestReturn !== undefined) {
                parts.push(`Backtest: ${backtestReturn.toFixed(2)}% return, Sharpe ${backtestSharpe?.toFixed(2) || 'N/A'}`);
              }
              
              // 优化证据
              const optimizationScore = optimizationResponse.data?.result?.summary?.bestScore !== undefined 
                ? optimizationResponse.data.result.summary.bestScore 
                : optimizationResponse.data?.result?.bestScore;
              if (optimizationScore !== undefined) {
                parts.push(`Optimization: best score ${optimizationScore.toFixed(4)}`);
              }
              
              // AI 推理证据
              if (decision.reason) {
                const shortReason = decision.reason.length > 100 
                  ? decision.reason.substring(0, 100) + '...' 
                  : decision.reason;
                parts.push(`AI: ${shortReason}`);
              }
              
              return parts.join(' | ');
            };
            
            // 从decision中获取推荐数量，优先使用recommendedQty，然后是positionSize
            const recommendedQty = decision.recommendedQty || decision.positionSize || decision.qty || 0;
            const displayAction = decision.action === 'SKIP' ? 'HOLD' : decision.action;
            
            // 计算综合状态
            let overallStatus = 'error'; // 默认错误
            if (!marketSuccess || !backtestSuccess || !aiSuccess) {
              // 核心步骤失败
              overallStatus = 'error';
            } else if (!optimizationSuccess) {
              // 核心步骤成功但optimization失败
              overallStatus = 'partial';
            } else {
              // 全部成功
              overallStatus = 'success';
            }
            
            recommendation = {
              ...baseFields,
              recommendation: displayAction,
              confidence: decision.confidence || 0.5,
              reason: generateReasonSummary(), // 简洁总结版
              reasonFull: decision.reasoningFull || decision.reason || 'AI analysis completed', // 完整版
              evidenceSummary: generateEvidenceSummary(), // 证据摘要
              evidenceFull: JSON.stringify(evidenceSummary), // 完整证据
              backtestSummary: backtestDetailedSummary,
              optimizationSummary: optimizationDetailedSummary,
              recommendedQty: recommendedQty,
              positionSize: recommendedQty,
              status: overallStatus
            };
            
            console.log(`股票 ${symbol} 分析完成: ${decision.action} (状态: ${overallStatus}, 置信度: ${decision.confidence})`);
          } else {
            console.warn(`股票 ${symbol} AI 分析失败:`, aiResponse);
            
            // 计算失败时的状态：如果核心步骤失败，则为error；如果只有优化失败，则为partial
            let overallStatus = 'error'; // 默认错误
            if (marketSuccess && backtestSuccess && aiSuccess) {
              // AI分析成功，但可能其他步骤失败
              if (!optimizationSuccess) {
                overallStatus = 'partial';
              } else {
                // 所有核心步骤都成功，但AI分析返回失败
                overallStatus = 'error';
              }
            } else if (marketSuccess && backtestSuccess && !aiSuccess) {
              // 市场数据和回测成功，但AI失败
              overallStatus = 'error';
            } else {
              // 核心步骤失败
              overallStatus = 'error';
            }
            
            // 即使失败，也添加一条错误推荐行
            recommendation = {
              ...baseFields,
              recommendation: 'ERROR',
              confidence: 0,
              reason: aiResponse.validation?.message || 'AI analysis failed',
              reasonFull: aiResponse.validation?.message || 'AI analysis failed',
              evidenceSummary: `Analysis failed: ${aiResponse.validation?.message || 'AI analysis failed'}`,
              evidenceFull: JSON.stringify({
                error: aiResponse.validation?.message || 'AI analysis failed',
                step: 'AI analysis'
              }),
              backtestSummary: backtestSuccess ? 'Completed' : 'Failed',
              optimizationSummary: optimizationSuccess ? 'Completed' : 'Failed',
              status: overallStatus
            };
            
            // 记录失败原因
            failedSymbols.push({
              symbol,
              error: aiResponse.validation?.message || 'AI analysis failed',
              step: 'AI analysis'
            });
          }
          
          recommendations.push(recommendation);
          
        } catch (symbolError: any) {
          console.error(`处理股票 ${symbol} 时出错:`, symbolError);
          // 继续处理下一个股票
        }
      }
      
      // 8. 更新推荐结果和错误信息
      setAiRecommendations(recommendations);
      setScanErrors(failedSymbols);
      
      // 9. 更新扫描状态
      const now = new Date().toISOString();
      
      // 根据自动扫描模式决定状态
      let nextStatus: 'stopped' | 'scheduled' = 'stopped';
      let nextNextRun: string | null = null;
      
      if (isAutoScan && isAutoScanEnabledRef.current) {
        // 自动扫描模式下，扫描完成后状态为 scheduled
        nextStatus = 'scheduled';
        nextNextRun = calculateNextRunTime();
      }
      
      setScanStatus({
        status: nextStatus,
        lastRun: now,
        nextRun: nextNextRun,
        progress: 0
      });
      setIsScanInProgress(false); // 扫描完成，清除进行中状态
      
      // 显示扫描结果摘要
      if (!isAutoScan) {
        if (recommendations.length > 0) {
          message.success(`AI 扫描完成，生成 ${recommendations.length} 个推荐`);
          if (failedSymbols.length > 0) {
            message.warning(`${failedSymbols.length} 个股票分析失败，请查看错误详情`);
          }
        } else if (failedSymbols.length > 0) {
          message.error(`所有 ${failedSymbols.length} 个股票分析失败，请检查配置或网络连接`);
        } else {
          message.warning('AI 扫描完成，但未生成任何推荐');
        }
      }
      
      // 如果是自动扫描且自动扫描模式仍然启用，安排下一次 (try block)
      if (isAutoScan && isAutoScanEnabledRef.current) {
        scheduleNextAutoScan();
      }
      
      if (!isAutoScan) {
        if (recommendations.length > 0) {
          message.success(`AI 扫描完成，生成 ${recommendations.length} 个推荐`);
        } else {
          message.warning('AI 扫描完成，但未生成任何推荐');
        }
      }
      
      return;
      
    } catch (error: any) {
      console.error('AI 扫描失败:', error);
      if (!isAutoScan) {
        message.error(`AI 扫描失败: ${error.message || '未知错误'}`);
      }
      
      // 重置状态
      setIsScanInProgress(false);
      
      // 根据自动扫描模式决定状态
      let nextStatus: 'stopped' | 'scheduled' = 'stopped';
      let nextNextRun: string | null = null;
      
      if (isAutoScan && isAutoScanEnabledRef.current) {
        nextStatus = 'scheduled';
        nextNextRun = calculateNextRunTime();
      }
      
      setScanStatus(prev => ({ 
        ...prev, 
        status: nextStatus, 
        nextRun: nextNextRun,
        progress: 0 
      }));
      
      // 如果是自动扫描且自动扫描模式仍然启用，安排下一次 (catch block)
      if (isAutoScan && isAutoScanEnabledRef.current) {
        scheduleNextAutoScan();
      }
    }
  };

  // Step 4: 执行单次 AI 扫描（现在调用统一的扫描函数）
  const handleRunNow = async () => {
    await runAiScanOnce(false);
  };

  return (
    <div>
      <Title level={2}><RobotOutlined style={{ marginRight: '12px' }} />AI Agent</Title>
      <Text type="secondary">AI-powered stock recommendations and trading automation</Text>
      
      <Divider />
      
      {/* ==================== AI Stock Recommendation Agent ==================== */}
      <div style={{ marginBottom: 24 }}>
        <Title level={3}>
          <ThunderboltOutlined style={{ marginRight: '8px' }} />
          AI Stock Recommendation Agent
        </Title>
        <Text type="secondary">Configure AI provider, set up automatic scanning, and view AI-generated stock recommendations</Text>
      </div>
      
      {/* 1. AI Configuration */}
      <div style={{ marginBottom: 24 }}>
        <Title level={4}>
          <SettingOutlined style={{ marginRight: '8px' }} />
          AI Configuration
        </Title>
        <Card>
          <Form
            form={aiConfigForm}
            layout="vertical"
            onFinish={handleSaveAiConfig}
            initialValues={aiConfig}
          >
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="provider"
                  label="AI Provider"
                  rules={[{ required: true, message: 'Please select AI provider' }]}
                >
                  <Select placeholder="Select AI provider">
                    <Option value="DeepSeek">DeepSeek</Option>
                    <Option value="OpenAI">OpenAI</Option>
                    <Option value="Anthropic">Anthropic</Option>
                    <Option value="Google">Google Gemini</Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="model"
                  label="Model"
                  rules={[{ required: true, message: 'Please enter model name' }]}
                >
                  <Input placeholder="e.g., deepseek-chat, gpt-4-turbo" />
                </Form.Item>
              </Col>
            </Row>
            
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="apiKey"
                  label="API Key"
                  rules={[{ required: true, message: 'Please enter API key' }]}
                >
                  <Input.Password 
                    placeholder="Enter your API key" 
                    visibilityToggle={true}
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="baseUrl"
                  label="Base URL"
                  rules={[{ required: true, message: 'Please enter base URL' }]}
                >
                  <Input placeholder="e.g., https://api.deepseek.com" />
                </Form.Item>
              </Col>
            </Row>
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <Button 
                onClick={handleTestConnection}
                loading={testingConnection}
                icon={<CheckCircleOutlined />}
              >
                Test Connection
              </Button>
              <Button 
                type="primary" 
                htmlType="submit"
                loading={savingConfig}
                icon={<SettingOutlined />}
              >
                Save Settings
              </Button>
            </div>
          </Form>
        </Card>
      </div>
      

      
      {/* 2. Market Scanner */}
      <div style={{ marginBottom: 24 }}>
        <Title level={4}>
          <LineChartOutlined style={{ marginRight: '8px' }} />
          Market Scanner
        </Title>
        <Card>
          <Row gutter={16} align="middle" style={{ marginBottom: 16 }}>
            <Col span={8}>
              <div style={{ marginBottom: '8px' }}>
                <Text strong>Scanner Interval:</Text>
              </div>
              <Select 
                value="30" 
                style={{ width: '100%' }}
                disabled={marketScannerAutoEnabled}
              >
                <Option value="30">30 minutes</Option>
                <Option value="60">60 minutes</Option>
                <Option value="120">120 minutes</Option>
              </Select>
            </Col>
            
            <Col span={16}>
              <Space size="middle">
                <Button
                  type="primary"
                  icon={<PlayCircleOutlined />}
                  onClick={handleStartMarketScannerAuto}
                  disabled={marketScannerAutoEnabled}
                >
                  Start Auto Scanner
                </Button>
                
                <Button
                  danger
                  icon={<PauseCircleOutlined />}
                  onClick={handleStopMarketScannerAuto}
                  disabled={!marketScannerAutoEnabled}
                >
                  Stop Auto Scanner
                </Button>
                
                <Button
                  icon={<ThunderboltOutlined />}
                  onClick={handleRunMarketScannerNow}
                  loading={marketScannerStatus.status === 'running'}
                >
                  Run Scanner Now
                </Button>
              </Space>
            </Col>
          </Row>
          
          <Divider style={{ margin: '16px 0' }} />
          
          {/* Scanner Status Display */}
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={6}>
              <div style={{ marginBottom: '8px' }}>
                <Text strong>Status:</Text>
              </div>
              <Badge 
                status={
                  marketScannerStatus.status === 'running' ? 'processing' :
                  marketScannerStatus.status === 'rate_limited' ? 'warning' :
                  marketScannerStatus.status === 'waiting_to_resume' ? 'processing' : 'default'
                } 
                text={
                  <Text strong style={{ 
                    color: 
                      marketScannerStatus.status === 'running' ? '#52c41a' :
                      marketScannerStatus.status === 'rate_limited' ? '#faad14' :
                      marketScannerStatus.status === 'waiting_to_resume' ? '#1890ff' : '#8c8c8c'
                  }}>
                    {
                      marketScannerStatus.status === 'running' ? 'SCANNING' :
                      marketScannerStatus.status === 'rate_limited' ? 'RATE LIMITED' :
                      marketScannerStatus.status === 'waiting_to_resume' ? 'RESUMING' : 'STOPPED'
                    }
                  </Text>
                }
              />
            </Col>
            
            <Col span={6}>
              <div style={{ marginBottom: '8px' }}>
                <Text strong>Last Scan:</Text>
              </div>
              <Text type="secondary">
                {marketScannerStatus.lastScanTime 
                  ? new Date(marketScannerStatus.lastScanTime).toLocaleString() 
                  : 'Never'}
              </Text>
            </Col>
            
            <Col span={6}>
              <div style={{ marginBottom: '8px' }}>
                <Text strong>Next Scan:</Text>
              </div>
              <Text type="secondary">
                {marketScannerStatus.nextScanTime 
                  ? new Date(marketScannerStatus.nextScanTime).toLocaleString() 
                  : 'Not scheduled'}
              </Text>
            </Col>
            
            <Col span={6}>
              <div style={{ marginBottom: '8px' }}>
                <Text strong>Progress:</Text>
              </div>
              <Text type="secondary">
                {marketScannerStatus.status === 'running' 
                  ? `${marketScannerStatus.scannedSymbols}/${marketScannerStatus.totalSymbols} symbols` 
                  : 'Idle'}
              </Text>
            </Col>
          </Row>
          
          {marketScannerStatus.status === 'running' && (
            <div style={{ marginBottom: '16px' }}>
              <Progress 
                percent={marketScannerStatus.progress} 
                size="small" 
                status="active"
                format={() => `Scanning... ${marketScannerStatus.progress}%`}
              />
            </div>
          )}
          
          {marketScannerStatus.status === 'rate_limited' && marketScannerStatus.rateLimitInfo && (
            <div style={{ marginBottom: '16px', padding: '12px', backgroundColor: '#fffbe6', border: '1px solid #ffe58f', borderRadius: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                <ExclamationCircleOutlined style={{ color: '#faad14', marginRight: '8px' }} />
                <Text strong style={{ color: '#d48806' }}>Alpaca API Rate Limit Reached</Text>
              </div>
              <Text type="secondary" style={{ fontSize: '13px', display: 'block', marginBottom: '8px' }}>
                已扫描 {marketScannerStatus.scannedSymbols} 只股票，剩余 {marketScannerStatus.rateLimitInfo.remainingSymbols?.length || 0} 只。
                等待 {marketScannerStatus.rateLimitInfo.waitSeconds || 60} 秒后自动恢复...
              </Text>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <ClockCircleOutlined style={{ color: '#8c8c8c', marginRight: '8px', fontSize: '12px' }} />
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  恢复时间: {new Date(marketScannerStatus.rateLimitInfo.resumeTime).toLocaleTimeString()}
                </Text>
              </div>
            </div>
          )}
          
          {marketScannerStatus.status === 'waiting_to_resume' && (
            <div style={{ marginBottom: '16px', padding: '12px', backgroundColor: '#e6f7ff', border: '1px solid #91d5ff', borderRadius: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <ClockCircleOutlined style={{ color: '#1890ff', marginRight: '8px' }} />
                <Text strong style={{ color: '#0050b3' }}>准备恢复扫描...</Text>
              </div>
              <Text type="secondary" style={{ fontSize: '13px', marginTop: '4px' }}>
                正在恢复扫描剩余股票，请稍候...
              </Text>
            </div>
          )}
          
          {/* Scanner Summary */}
          {marketScannerSummary.universeScanned > 0 && (
            <Card 
              size="small" 
              style={{ 
                marginBottom: 20, 
                border: '1px solid #e8e8e8',
                borderRadius: '8px',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
                background: 'linear-gradient(to bottom, #ffffff, #fafafa)'
              }}
              bodyStyle={{ padding: '20px' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <BarChartOutlined style={{ color: '#1890ff', fontSize: '18px' }} />
                    <Text strong style={{ fontSize: '18px', color: '#1f1f1f' }}>Market Scan Summary</Text>
                  </div>
                  <div style={{ fontSize: '12px', color: '#8c8c8c', marginTop: 2 }}>
                    Last scan: {marketScannerSummary.lastScanTime 
                      ? new Date(marketScannerSummary.lastScanTime).toLocaleString() 
                      : 'Not scanned'}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <Tag color="blue" style={{ fontWeight: '600', fontSize: '11px', padding: '2px 8px' }}>FULL MARKET SCAN</Tag>
                  <div style={{ fontSize: '11px', color: '#8c8c8c', marginTop: 4 }}>
                    {marketScannerSummary.universeScanned} symbols
                  </div>
                </div>
              </div>
              
              <Divider style={{ margin: '16px 0', borderColor: '#f0f0f0' }} />
              
              <Row gutter={[20, 16]}>
                <Col span={4}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '24px', fontWeight: '700', color: '#1890ff', marginBottom: 4 }}>
                      {marketScannerSummary.universeScanned}
                    </div>
                    <div style={{ fontSize: '11px', color: '#595959', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Universe
                    </div>
                  </div>
                </Col>
                <Col span={4}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '24px', fontWeight: '700', color: '#52c41a', marginBottom: 4 }}>
                      {marketScannerSummary.bullishCount}
                    </div>
                    <div style={{ fontSize: '11px', color: '#595959', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Bullish
                    </div>
                    <div style={{ fontSize: '10px', color: '#8c8c8c', marginTop: 2 }}>
                      {marketScannerSummary.universeScanned > 0 ? `${((marketScannerSummary.bullishCount / marketScannerSummary.universeScanned) * 100).toFixed(1)}%` : '0%'}
                    </div>
                  </div>
                </Col>
                <Col span={4}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '24px', fontWeight: '700', color: '#ff4d4f', marginBottom: 4 }}>
                      {marketScannerSummary.bearishCount}
                    </div>
                    <div style={{ fontSize: '11px', color: '#595959', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Bearish
                    </div>
                    <div style={{ fontSize: '10px', color: '#8c8c8c', marginTop: 2 }}>
                      {marketScannerSummary.universeScanned > 0 ? `${((marketScannerSummary.bearishCount / marketScannerSummary.universeScanned) * 100).toFixed(1)}%` : '0%'}
                    </div>
                  </div>
                </Col>
                <Col span={4}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '24px', fontWeight: '700', color: '#faad14', marginBottom: 4 }}>
                      {marketScannerSummary.neutralCount}
                    </div>
                    <div style={{ fontSize: '11px', color: '#595959', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Neutral
                    </div>
                    <div style={{ fontSize: '10px', color: '#8c8c8c', marginTop: 2 }}>
                      {marketScannerSummary.universeScanned > 0 ? `${((marketScannerSummary.neutralCount / marketScannerSummary.universeScanned) * 100).toFixed(1)}%` : '0%'}
                    </div>
                  </div>
                </Col>
                <Col span={4}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '24px', fontWeight: '700', color: '#722ed1', marginBottom: 4 }}>
                      {marketScannerSummary.strongTrendCount}
                    </div>
                    <div style={{ fontSize: '11px', color: '#595959', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Strong Trend
                    </div>
                    <div style={{ fontSize: '10px', color: '#8c8c8c', marginTop: 2 }}>
                      {marketScannerSummary.strongTrendCount > 0 ? 'Active' : 'None'}
                    </div>
                  </div>
                </Col>
                <Col span={4}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '24px', fontWeight: '700', color: '#fa8c16', marginBottom: 4 }}>
                      {marketScannerSummary.newsRiskCount}
                    </div>
                    <div style={{ fontSize: '11px', color: '#595959', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      News Risk
                    </div>
                    <div style={{ fontSize: '10px', color: '#8c8c8c', marginTop: 2 }}>
                      {marketScannerSummary.newsRiskCount > 0 ? 'High Risk' : 'Low Risk'}
                    </div>
                  </div>
                </Col>
              </Row>
            </Card>
          )}
          
          {/* Scanner Results Table */}
          {marketScannerResults.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <Text strong style={{ fontSize: '14px' }}>Top Market Trends ({filteredAndSortedScannerResults.length} symbols)</Text>
                <Space size="small">
                  <Select 
                    value={marketScannerFilters.trendFilter}
                    onChange={(value) => setMarketScannerFilters(prev => ({ ...prev, trendFilter: value }))}
                    style={{ width: 120 }}
                    size="small"
                  >
                    <Option value="all">All Trends</Option>
                    <Option value="bullish">Bullish</Option>
                    <Option value="bearish">Bearish</Option>
                    <Option value="neutral">Neutral</Option>
                    <Option value="strong">Strong Trends</Option>
                  </Select>
                  
                  <Select 
                    value={marketScannerFilters.sortBy}
                    onChange={(value) => setMarketScannerFilters(prev => ({ ...prev, sortBy: value }))}
                    style={{ width: 140 }}
                    size="small"
                  >
                    <Option value="trendScore">Trend Score</Option>
                    <Option value="volume">Volume</Option>
                    <Option value="changePct">Change %</Option>
                    <Option value="newsSentiment">News Sentiment</Option>
                  </Select>
                  
                  <Button 
                    size="small" 
                    icon={marketScannerFilters.sortOrder === 'desc' ? <SortDescendingOutlined /> : <SortAscendingOutlined />}
                    onClick={() => setMarketScannerFilters(prev => ({ ...prev, sortOrder: prev.sortOrder === 'desc' ? 'asc' : 'desc' }))}
                  />
                </Space>
              </div>
              
              <Table 
                columns={[
                  { 
                    title: 'Symbol', 
                    dataIndex: 'symbol', 
                    key: 'symbol',
                    width: 120,
                    render: (symbol: string, record: any) => {
                      const isExpanded = expandedScannerRows.has(symbol);
                      return (
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                          <Button
                            type="text"
                            size="small"
                            onClick={() => handleScannerRowExpand(symbol)}
                            style={{ 
                              padding: '0 4px', 
                              minWidth: '24px',
                              height: '24px',
                              fontSize: '10px',
                              color: isExpanded ? '#1890ff' : '#8c8c8c'
                            }}
                            icon={isExpanded ? <CaretDownOutlined /> : <CaretRightOutlined />}
                          />
                          <div>
                            <Button 
                              type="link" 
                              onClick={() => handleSymbolClick(symbol)}
                              style={{ padding: 0, fontWeight: 'bold', fontSize: '12px' }}
                            >
                              {symbol}
                            </Button>
                            <div style={{ 
                              fontSize: '10px', 
                              color: '#666', 
                              marginTop: 2,
                              lineHeight: 1.2,
                              maxWidth: '90px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}>
                              {record.companyName || 'Loading...'}
                            </div>
                          </div>
                        </div>
                      );
                    }
                  },
                  { 
                    title: 'Trend', 
                    dataIndex: 'trendLabel', 
                    key: 'trendLabel',
                    width: 120,
                    render: (label: string, record: any) => {
                      const color = getTrendColor(label);
                      return (
                        <div style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: '10px',
                          backgroundColor: `${color}15`,
                          border: `1px solid ${color}`,
                          color: color,
                          fontWeight: '600',
                          fontSize: '11px',
                          textAlign: 'center'
                        }}>
                          {label}
                        </div>
                      );
                    }
                  },
                  { 
                    title: 'Score', 
                    dataIndex: 'trendScore', 
                    key: 'trendScore',
                    width: 80,
                    render: (score: number, record: any) => (
                      <div style={{ textAlign: 'center' }}>
                        <Text strong style={{ fontSize: '12px' }}>{score.toFixed(0)}</Text>
                        <div style={{ fontSize: '10px', color: '#666' }}>
                          {record.trendConfidence ? `${(record.trendConfidence * 100).toFixed(0)}%` : 'N/A'}
                        </div>
                      </div>
                    )
                  },
                  { 
                    title: 'Price', 
                    dataIndex: 'price', 
                    key: 'price',
                    width: 90,
                    render: (price: number, record: any) => (
                      <div>
                        <Text strong style={{ fontSize: '12px' }}>
                          ${price?.toFixed(2) || 'N/A'}
                        </Text>
                        <div style={{ 
                          fontSize: '10px', 
                          color: record.changePct >= 0 ? '#52c41a' : '#ff4d4f'
                        }}>
                          {record.changePct?.toFixed(2) || '0.00'}%
                        </div>
                      </div>
                    )
                  },
                  { 
                    title: 'Volume', 
                    dataIndex: 'volume', 
                    key: 'volume',
                    width: 100,
                    render: (volume: number, record: any) => (
                      <div>
                        <div style={{ fontSize: '11px' }}>
                          {volume ? (volume / 1000000).toFixed(1) + 'M' : 'N/A'}
                        </div>
                        <div style={{ fontSize: '10px', color: '#666' }}>
                          {record.relativeVolume || 'Normal'}
                        </div>
                      </div>
                    )
                  },
                  { 
                    title: 'News', 
                    dataIndex: 'newsSentiment', 
                    key: 'newsSentiment',
                    width: 90,
                    render: (sentiment: string, record: any) => {
                      let color = '#8c8c8c';
                      if (sentiment === 'Positive') color = '#52c41a';
                      if (sentiment === 'Negative') color = '#ff4d4f';
                      if (sentiment === 'Mixed') color = '#faad14';
                      
                      return (
                        <div style={{ textAlign: 'center' }}>
                          <div style={{
                            display: 'inline-block',
                            padding: '2px 6px',
                            borderRadius: '6px',
                            backgroundColor: `${color}15`,
                            color: color,
                            fontSize: '10px',
                            fontWeight: '500'
                          }}>
                            {sentiment}
                          </div>
                          <div style={{ fontSize: '9px', color: '#666', marginTop: 2 }}>
                            Risk: {record.eventRisk || 'Low'}
                          </div>
                        </div>
                      );
                    }
                  },
                  { 
                    title: 'Sector', 
                    dataIndex: 'sector', 
                    key: 'sector',
                    width: 120,
                    render: (sector: string, record: any) => {
                      const sectorSource = record.sectorSource || 'unknown';
                      let sourceBadge = null;
                      let sourceColor = '#8c8c8c';
                      
                      if (sectorSource === 'finnhub_profile' || sectorSource === 'profile') {
                        sourceBadge = 'Official';
                        sourceColor = '#52c41a';
                      } else if (sectorSource === 'inferred') {
                        sourceBadge = 'Inferred';
                        sourceColor = '#faad14';
                      } else if (sectorSource === 'deepseek_inferred') {
                        sourceBadge = 'AI-Inferred';
                        sourceColor = '#1890ff';
                      } else if (sectorSource === 'error') {
                        sourceBadge = 'Error';
                        sourceColor = '#ff4d4f';
                      }
                      
                      return (
                        <div>
                          <div style={{ 
                            fontSize: '11px',
                            color: '#1f1f1f',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            fontWeight: sector !== 'Unknown' ? '500' : 'normal'
                          }}>
                            {sector !== 'Unknown' ? sector : 'Unknown'}
                          </div>
                          {sourceBadge && sector !== 'Unknown' && (
                            <div style={{ 
                              fontSize: '9px', 
                              color: sourceColor,
                              marginTop: 2,
                              fontWeight: '600'
                            }}>
                              {sourceBadge}
                            </div>
                          )}
                        </div>
                      );
                    }
                  },
                  { 
                    title: 'Scanner Reason', 
                    dataIndex: 'scannerReason', 
                    key: 'scannerReason',
                    width: 220,
                    render: (reason: string, record: any) => {
                      const isAI = record.analysisSource === 'deepseek';
                      const isRuleBased = record.analysisSource === 'rule_based';
                      return (
                        <div>
                          <div style={{ 
                            fontSize: '10px', 
                            marginBottom: 2,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4
                          }}>
                            {isAI && (
                              <span style={{
                                display: 'inline-block',
                                padding: '1px 4px',
                                borderRadius: '3px',
                                backgroundColor: '#1890ff15',
                                color: '#1890ff',
                                fontSize: '9px',
                                fontWeight: '600',
                                border: '1px solid #1890ff30'
                              }}>
                                🤖 AI
                              </span>
                            )}
                            {isRuleBased && (
                              <span style={{
                                display: 'inline-block',
                                padding: '1px 4px',
                                borderRadius: '3px',
                                backgroundColor: '#faad1415',
                                color: '#fa8c16',
                                fontSize: '9px',
                                fontWeight: '600',
                                border: '1px solid #faad1430'
                              }}>
                                ⚙️ Rule
                              </span>
                            )}
                            {!isAI && !isRuleBased && (
                              <span style={{
                                display: 'inline-block',
                                padding: '1px 4px',
                                borderRadius: '3px',
                                backgroundColor: '#f0f0f0',
                                color: '#8c8c8c',
                                fontSize: '9px',
                                fontWeight: '600'
                              }}>
                                Source Unknown
                              </span>
                            )}
                          </div>
                          <div style={{ 
                            fontSize: '11px', 
                            lineHeight: 1.3,
                            maxHeight: '2.6em',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            color: '#1f1f1f'
                          }}>
                            {reason}
                          </div>
                        </div>
                      );
                    }
                  }
                ]}
                dataSource={filteredAndSortedScannerResults}
                expandable={{
                  expandedRowKeys: Array.from(expandedScannerRows),
                  onExpand: (expanded, record) => handleScannerRowExpand(record.symbol),
                  expandedRowRender: renderScannerRowDetail
                }}
                rowKey="symbol"
                size="small"
                pagination={{ pageSize: 10, size: 'small' }}
                scroll={{ x: 800 }}
              />
            </div>
          )}
          
          {marketScannerResults.length === 0 && marketScannerStatus.status !== 'running' && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
              <LineChartOutlined style={{ fontSize: '48px', marginBottom: 16 }} />
              <div style={{ fontSize: '14px' }}>No market scan results yet</div>
              <div style={{ fontSize: '12px', marginTop: 8 }}>
                Click "Run Scanner Now" to start scanning the market
              </div>
            </div>
          )}
        </Card>
      </div>
      
      {/* 3. AI Recommendations */}
      <div style={{ marginBottom: 24 }}>
        <Title level={4}>
          <RobotOutlined style={{ marginRight: '8px' }} />
          AI Recommendations
        </Title>
        
        {/* Scan Control - Now part of AI Recommendations */}
        <div style={{ marginBottom: 24 }}>
          <Title level={4}>
            <ClockCircleOutlined style={{ marginRight: '8px' }} />
            Scan Control
          </Title>
          <Card>
            <Row gutter={16} align="middle">
              <Col span={6}>
                <div style={{ marginBottom: '8px' }}>
                  <Text strong>Scan Interval:</Text>
                </div>
                <Select 
                  value={scanInterval} 
                  onChange={setScanInterval}
                  style={{ width: '100%' }}
                  disabled={isAutoScanEnabled}
                >
                  <Option value="5">5 minutes</Option>
                  <Option value="15">15 minutes</Option>
                </Select>
              </Col>
              
              <Col span={18}>
                <Space size="middle">
                  <Button
                    type="primary"
                    icon={<PlayCircleOutlined />}
                    onClick={handleStartAutoScan}
                    disabled={isAutoScanEnabled}
                  >
                    Start Auto Scan
                  </Button>
                  
                  <Button
                    danger
                    icon={<PauseCircleOutlined />}
                    onClick={handleStopAutoScan}
                    disabled={!isAutoScanEnabled}
                  >
                    Stop Auto Scan
                  </Button>
                  
                  <Button
                    icon={<ThunderboltOutlined />}
                    onClick={handleRunNow}
                  >
                    Run Now
                  </Button>
                </Space>
              </Col>
            </Row>
            
            <Divider style={{ margin: '16px 0' }} />
            
            {/* Status Display */}
            <Row gutter={16}>
              <Col span={8}>
                <div style={{ marginBottom: '8px' }}>
                  <Text strong>Status:</Text>
                </div>
                <Badge 
                  status={scanStatus.status === 'running' ? 'processing' : 'default'} 
                  text={
                    <Text strong style={{ 
                      color: scanStatus.status === 'running' ? '#52c41a' : '#8c8c8c' 
                    }}>
                      {scanStatus.status === 'running' ? 'RUNNING' : 'STOPPED'}
                    </Text>
                  }
                />
              </Col>
              
              <Col span={8}>
                <div style={{ marginBottom: '8px' }}>
                  <Text strong>Last Run:</Text>
                </div>
                <Text type="secondary">
                  {scanStatus.lastRun 
                    ? new Date(scanStatus.lastRun).toLocaleString() 
                    : 'Never'}
                </Text>
              </Col>
              
              <Col span={8}>
                <div style={{ marginBottom: '8px' }}>
                  <Text strong>Next Run:</Text>
                </div>
                <Text type="secondary">
                  {scanStatus.nextRun 
                    ? new Date(scanStatus.nextRun).toLocaleString() 
                    : 'Not scheduled'}
                </Text>
              </Col>
            </Row>
            
            {isScanInProgress && (
              <div style={{ marginTop: '16px' }}>
                <Progress 
                  percent={scanStatus.progress} 
                  size="small" 
                  status="active"
                  format={() => `Scanning in progress...`}
                />
              </div>
            )}
          </Card>
        </div>

        <Card>
          {/* 错误显示区域 */}
          {scanErrors.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <Alert
                message={`${scanErrors.length} 个股票分析失败`}
                description={
                  <div>
                    <div style={{ marginBottom: 8 }}>
                      <Text type="secondary">失败详情：</Text>
                    </div>
                    <div style={{ maxHeight: 150, overflowY: 'auto' }}>
                      {scanErrors.map((error, index) => (
                        <div key={index} style={{ marginBottom: 4, fontSize: '12px' }}>
                          <Text type="danger">{error.symbol}</Text>
                          <Text type="secondary"> - {error.step}: {error.error}</Text>
                        </div>
                      ))}
                    </div>
                  </div>
                }
                type="warning"
                showIcon
                closable
                onClose={() => setScanErrors([])}
              />
            </div>
          )}
          
          {aiRecommendations.length > 0 ? (
            <>
              {/* 专业简洁版 Summary */}
              <Card 
                size="small" 
                style={{ 
                  marginBottom: 16, 
                  border: '1px solid #f0f0f0',
                  boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.03)'
                }}
                bodyStyle={{ padding: '16px' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div>
                    <Text strong style={{ fontSize: '16px' }}>Scan Summary</Text>
                    <div style={{ fontSize: '12px', color: '#666', marginTop: 2 }}>
                      {new Date().toLocaleString()} • {
                        aiRecommendations[0]?.backtestRange?.split('→')[0]?.trim() || 'N/A'
                      } → {
                        aiRecommendations[0]?.backtestRange?.split('→')[1]?.trim() || 'N/A'
                      }
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Tag color="blue">{aiRecommendations[0]?.strategyUsed || 'moving_average'}</Tag>
                    <Tag color={
                      aiRecommendations[0]?.symbolsSource === 'tech_market_scan' ? 'purple' :
                      aiRecommendations[0]?.symbolsSource === 'market_scan' ? 'orange' :
                      aiRecommendations[0]?.symbolsSource === 'watchlist' ? 'green' : 'default'
                    }>
                      {aiRecommendations[0]?.symbolsSource === 'tech_market_scan' ? 'Tech Market Scan' :
                       aiRecommendations[0]?.symbolsSource === 'market_scan' ? 'Market Scan' :
                       aiRecommendations[0]?.symbolsSource === 'watchlist' ? 'Watchlist' : 'Unknown'}
                    </Tag>
                    {aiRecommendations[0]?.scanType && (
                      <Tag color="cyan">
                        {aiRecommendations[0]?.scanType === 'tech_market_scan' ? 'Top Tech Stocks' :
                         aiRecommendations[0]?.scanType === 'market_all' ? 'Market All' :
                         aiRecommendations[0]?.scanType}
                      </Tag>
                    )}
                  </div>
                </div>
                
                <Divider style={{ margin: '12px 0' }} />
                
                <Row gutter={[16, 16]}>
                  <Col span={4}>
                    <Statistic
                      title="Total Symbols"
                      value={aiRecommendations.length}
                      valueStyle={{ color: '#1890ff', fontSize: '24px', fontWeight: 'bold' }}
                      prefix={<BarChartOutlined />}
                      suffix=""
                    />
                  </Col>
                  <Col span={4}>
                    <Statistic
                      title="Successful"
                      value={aiRecommendations.filter(r => r.status === 'success').length}
                      valueStyle={{ color: '#52c41a', fontSize: '24px', fontWeight: 'bold' }}
                      prefix={<CheckCircleOutlined />}
                      suffix=""
                    />
                  </Col>
                  <Col span={4}>
                    <Statistic
                      title="Failed"
                      value={aiRecommendations.filter(r => r.status === 'error').length}
                      valueStyle={{ color: '#ff4d4f', fontSize: '24px', fontWeight: 'bold' }}
                      prefix={<CloseCircleOutlined />}
                      suffix=""
                    />
                  </Col>
                  <Col span={4}>
                    <Statistic
                      title="Partial Success"
                      value={aiRecommendations.filter(r => r.status === 'partial').length}
                      valueStyle={{ color: '#faad14', fontSize: '24px', fontWeight: 'bold' }}
                      prefix={<ExclamationCircleOutlined />}
                      suffix=""
                    />
                  </Col>
                  <Col span={4}>
                    <Statistic
                      title="Hold Recommendations"
                      value={aiRecommendations.filter(r => r.recommendation === 'HOLD').length}
                      valueStyle={{ color: '#fa8c16', fontSize: '24px', fontWeight: 'bold' }}
                      prefix={<PauseCircleOutlined />}
                      suffix=""
                    />
                  </Col>
                  <Col span={4}>
                    <Statistic
                      title="Avg Confidence"
                      value={aiRecommendations.length > 0 ? 
                        (aiRecommendations.reduce((sum, r) => sum + (r.confidence || 0), 0) / aiRecommendations.length * 100).toFixed(1) : 0}
                      valueStyle={{ color: '#722ed1', fontSize: '24px', fontWeight: 'bold' }}
                      prefix={<LineChartOutlined />}
                      suffix="%"
                    />
                  </Col>
                </Row>
              </Card>

              {/* 专业表格 */}
              <Table 
                columns={[
                  { 
                    title: 'Symbol', 
                    dataIndex: 'symbol', 
                    key: 'symbol',
                    width: 100,
                    render: (symbol: string, record: any) => (
                      <div>
                        <Text strong>{symbol}</Text>
                        <div style={{ fontSize: '11px', color: '#666', marginTop: 2 }}>
                          {record.strategyUsed || 'MA'}
                        </div>
                      </div>
                    )
                  },
                  { 
                    title: 'Action', 
                    dataIndex: 'recommendation', 
                    key: 'recommendation',
                    width: 110,
                    render: (rec: string) => {
                      // 将SKIP映射为HOLD进行显示
                      const displayRec = rec === 'SKIP' ? 'HOLD' : rec;
                      
                      let backgroundColor = '';
                      let borderColor = '';
                      let textColor = '';
                      let fontWeight = '600';
                      
                      if (displayRec === 'BUY') {
                        backgroundColor = '#f6ffed';
                        borderColor = '#b7eb8f';
                        textColor = '#52c41a';
                      } else if (displayRec === 'SELL') {
                        backgroundColor = '#fff2f0';
                        borderColor = '#ffccc7';
                        textColor = '#ff4d4f';
                      } else if (displayRec === 'HOLD') {
                        backgroundColor = '#fffbe6';
                        borderColor = '#ffe58f';
                        textColor = '#faad14';
                      } else if (displayRec === 'ERROR') {
                        backgroundColor = '#fff1f0';
                        borderColor = '#ffa39e';
                        textColor = '#cf1322';
                      } else {
                        backgroundColor = '#fafafa';
                        borderColor = '#d9d9d9';
                        textColor = '#666';
                      }
                      
                      return (
                        <div style={{
                          display: 'inline-block',
                          padding: '4px 12px',
                          borderRadius: '12px',
                          backgroundColor,
                          border: `1px solid ${borderColor}`,
                          color: textColor,
                          fontWeight,
                          fontSize: '12px',
                          textAlign: 'center',
                          minWidth: '70px',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                        }}>
                          {displayRec}
                        </div>
                      );
                    }
                  },
                  { 
                    title: 'Qty', 
                    dataIndex: 'recommendedQty', 
                    key: 'recommendedQty',
                    width: 100,
                    render: (qty: number, record: any) => {
                      const recommendedQty = record.recommendedQty || record.positionSize || 0;
                      const action = record.recommendation;
                      const displayAction = action === 'SKIP' ? 'HOLD' : action;
                      
                      let backgroundColor = '';
                      let borderColor = '';
                      let textColor = '';
                      let fontWeight = '600';
                      let displayText = '-';
                      let suffix = '';
                      
                      if (displayAction === 'BUY' && recommendedQty > 0) {
                        backgroundColor = '#f6ffed';
                        borderColor = '#b7eb8f';
                        textColor = '#52c41a';
                        displayText = `${recommendedQty}`;
                        suffix = ' ↗';
                      } else if (displayAction === 'SELL' && recommendedQty > 0) {
                        backgroundColor = '#fff2f0';
                        borderColor = '#ffccc7';
                        textColor = '#ff4d4f';
                        displayText = `${recommendedQty}`;
                        suffix = ' ↘';
                      } else if (displayAction === 'HOLD') {
                        backgroundColor = '#fffbe6';
                        borderColor = '#ffe58f';
                        textColor = '#faad14';
                        displayText = '0';
                        suffix = '';
                      } else if (displayAction === 'ERROR') {
                        backgroundColor = '#fff1f0';
                        borderColor = '#ffa39e';
                        textColor = '#cf1322';
                        displayText = 'Error';
                        suffix = '';
                      } else {
                        backgroundColor = '#fafafa';
                        borderColor = '#d9d9d9';
                        textColor = '#666';
                        displayText = '0';
                        suffix = '';
                      }
                      
                      return (
                        <div style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '4px 8px',
                          borderRadius: '10px',
                          backgroundColor,
                          border: `1px solid ${borderColor}`,
                          color: textColor,
                          fontWeight,
                          fontSize: '12px',
                          minWidth: '60px',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                          gap: '4px'
                        }}>
                          <span>{displayText}</span>
                          {suffix && <span style={{ fontSize: '10px' }}>{suffix}</span>}
                        </div>
                      );
                    }
                  },
                  { 
                    title: 'Confidence', 
                    dataIndex: 'confidence', 
                    key: 'confidence',
                    width: 130,
                    render: (conf: number) => {
                      const percent = Math.round(conf * 100);
                      let strokeColor = '#ff4d4f';
                      let bgColor = '#fff2f0';
                      
                      if (percent >= 80) {
                        strokeColor = '#52c41a';
                        bgColor = '#f6ffed';
                      } else if (percent >= 60) {
                        strokeColor = '#faad14';
                        bgColor = '#fffbe6';
                      }
                      
                      return (
                        <div style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: 8,
                          padding: '4px 8px',
                          backgroundColor: bgColor,
                          borderRadius: '8px',
                          border: '1px solid #f0f0f0'
                        }}>
                          <Progress 
                            percent={percent} 
                            size="small" 
                            style={{ width: 60, margin: 0 }}
                            strokeColor={strokeColor}
                            showInfo={false}
                          />
                          <Text style={{ 
                            fontSize: '12px', 
                            fontWeight: 'bold', 
                            minWidth: 30,
                            color: strokeColor
                          }}>
                            {percent}%
                          </Text>
                        </div>
                      );
                    }
                  },
                  { 
                    title: 'AI Reasoning', 
                    dataIndex: 'reason', 
                    key: 'reason',
                    width: 240,
                    render: (reason: string, record: any) => {
                      const fullReason = record.reasonFull || 'No detailed reasoning available';
                      const isError = reason.includes('ERROR');
                      const bgColor = isError ? '#fff1f0' : '#fafafa';
                      const borderColor = isError ? '#ffa39e' : '#f0f0f0';
                      
                      return (
                        <Tooltip 
                          title={
                            <div style={{ maxWidth: 500 }}>
                              <div style={{ fontWeight: 'bold', marginBottom: 8 }}>Full AI Analysis</div>
                              <div style={{ 
                                fontSize: '12px', 
                                lineHeight: 1.5,
                                whiteSpace: 'pre-wrap',
                                maxHeight: '300px',
                                overflowY: 'auto',
                                padding: '8px',
                                backgroundColor: '#fff',
                                borderRadius: '4px',
                                border: '1px solid #d9d9d9'
                              }}>
                                {fullReason}
                              </div>
                            </div>
                          }
                          placement="left"
                        >
                          <div 
                            style={{ 
                              maxHeight: '2.6em',
                              lineHeight: '1.3em',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              cursor: 'pointer',
                              fontSize: '12px',
                              fontStyle: isError ? 'italic' : 'normal',
                              color: isError ? '#cf1322' : '#333',
                              padding: '6px 8px',
                              backgroundColor: bgColor,
                              borderRadius: '6px',
                              border: `1px solid ${borderColor}`,
                              transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = isError ? '#ffeae8' : '#f5f5f5';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = bgColor;
                            }}
                          >
                            {reason}
                          </div>
                        </Tooltip>
                      );
                    }
                  },
                  { 
                    title: 'Backtest', 
                    dataIndex: 'backtestSummary', 
                    key: 'backtestSummary',
                    width: 150,
                    render: (summary: string, record: any) => {
                      // ========== DEBUG: Backtest列渲染 ==========
                      console.log(`=== DEBUG: Backtest列渲染 for ${record.symbol} ===`);
                      console.log('summary:', summary);
                      console.log('record.symbol:', record.symbol);
                      console.log('record.backtestSummary:', record.backtestSummary);
                      
                      // 尝试解析evidenceFull查看实际值
                      if (record.evidenceFull) {
                        try {
                          const evidence = JSON.parse(record.evidenceFull);
                          console.log(`evidence.backtestKeyResults for ${record.symbol}:`, evidence.backtestKeyResults);
                          if (evidence.backtestKeyResults) {
                            console.log(`  totalReturn: ${evidence.backtestKeyResults.totalReturn}`);
                            console.log(`  sharpeRatio: ${evidence.backtestKeyResults.sharpeRatio}`);
                            console.log(`  maxDrawdown: ${evidence.backtestKeyResults.maxDrawdown}`);
                          }
                        } catch (e) {
                          console.warn(`解析evidenceFull失败 for ${record.symbol}:`, e);
                        }
                      }
                      // ========== END DEBUG ==========
                      
                      const displayText = summary.includes('unavailable') || summary.includes('Failed') 
                        ? 'Unavailable' 
                        : summary.split('|')[0]?.trim() || summary;
                      
                      return (
                        <Tooltip title={
                          <div>
                            <div><strong>Range:</strong> {record.backtestRange || 'N/A'}</div>
                            <div><strong>Summary:</strong> {summary}</div>
                          </div>
                        }>
                          <div style={{ 
                            fontSize: '12px',
                            whiteSpace: 'nowrap', 
                            overflow: 'hidden', 
                            textOverflow: 'ellipsis',
                            cursor: 'pointer'
                          }}>
                            {displayText}
                          </div>
                        </Tooltip>
                      );
                    }
                  },
                  { 
                    title: 'Optimization', 
                    dataIndex: 'optimizationSummary', 
                    key: 'optimizationSummary',
                    width: 150,
                    render: (summary: string, record: any) => {
                      const displayText = summary.includes('unavailable') || summary.includes('Failed') 
                        ? 'Unavailable' 
                        : summary.split('|')[0]?.trim() || summary;
                      
                      return (
                        <Tooltip title={
                          <div>
                            <div><strong>Range:</strong> {record.optimizationRange || record.backtestRange || 'N/A'}</div>
                            <div><strong>Summary:</strong> {summary}</div>
                          </div>
                        }>
                          <div style={{ 
                            fontSize: '12px',
                            whiteSpace: 'nowrap', 
                            overflow: 'hidden', 
                            textOverflow: 'ellipsis',
                            cursor: 'pointer'
                          }}>
                            {displayText}
                          </div>
                        </Tooltip>
                      );
                    }
                  },
                  { 
                    title: 'Time', 
                    dataIndex: 'generatedTime', 
                    key: 'generatedTime',
                    width: 100,
                    render: (time: string) => (
                      <div style={{ fontSize: '11px' }}>
                        <div>{time ? new Date(time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}</div>
                        <div style={{ color: '#666' }}>
                          {time ? new Date(time).toLocaleDateString([], { month: 'short', day: 'numeric' }) : ''}
                        </div>
                      </div>
                    )
                  }
                ]}
                dataSource={aiRecommendations}
                rowKey="symbol"
                size="small"
                pagination={{ pageSize: 10 }}
                expandable={{
                  expandedRowRender: (record: any) => {
                    // ========== DEBUG: 展开行渲染 ==========
                    console.log(`=== DEBUG: expandedRowRender for ${record.symbol} ===`);
                    console.log('record:', { 
                      symbol: record.symbol,
                      evidenceFull: record.evidenceFull ? 'exists' : 'null',
                      backtestSummary: record.backtestSummary
                    });
                    // ========== END DEBUG ==========
                    
                    let evidence: any = {};
                    try {
                      evidence = record.evidenceFull ? JSON.parse(record.evidenceFull) : {};
                      
                      // ========== DEBUG: 解析后的evidence ==========
                      console.log(`=== DEBUG: ${record.symbol} 解析后的evidence ===`);
                      console.log('evidence:', evidence);
                      if (evidence.backtestKeyResults) {
                        console.log('backtestKeyResults:', evidence.backtestKeyResults);
                        console.log(`totalReturn: ${evidence.backtestKeyResults.totalReturn}`);
                        console.log(`sharpeRatio: ${evidence.backtestKeyResults.sharpeRatio}`);
                        console.log(`maxDrawdown: ${evidence.backtestKeyResults.maxDrawdown}`);
                      }
                      // ========== END DEBUG ==========
                    } catch (e) {
                      console.warn('Failed to parse evidenceFull:', e);
                    }
                    
                    return (
                      <div style={{ padding: 20, background: '#fafafa', borderRadius: 4 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                          <div>
                            <Text strong style={{ fontSize: '16px' }}>Detailed Analysis: {record.symbol}</Text>
                            <div style={{ fontSize: '12px', color: '#666', marginTop: 4 }}>
                              {record.strategyUsed || 'moving_average'} • {record.scanType === 'tech_market_scan' ? 'Tech Market Scan' : 'Market Scan'} • {record.backtestRange || 'N/A'}
                            </div>
                          </div>
                          <div>
                            <Tag color={
                              record.recommendation === 'BUY' ? 'green' : 
                              record.recommendation === 'SELL' ? 'red' : 
                              record.recommendation === 'ERROR' ? 'red' :
                              'gold'
                            } style={{ fontSize: '14px', padding: '4px 12px' }}>
                              {record.recommendation} ({(record.confidence * 100).toFixed(0)}%)
                            </Tag>
                          </div>
                        </div>
                        
                        <Row gutter={24}>
                          {/* AI Analysis */}
                          <Col span={24} style={{ marginBottom: 16 }}>
                            <Card 
                              size="small" 
                              title={
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <span>AI Analysis</span>
                                  <div style={{ 
                                    padding: '2px 8px', 
                                    borderRadius: '4px',
                                    backgroundColor: 
                                      record.recommendation === 'BUY' ? '#f6ffed' : 
                                      record.recommendation === 'SELL' ? '#fff2f0' : 
                                      record.recommendation === 'HOLD' ? '#fffbe6' : '#fff1f0',
                                    border: `1px solid ${
                                      record.recommendation === 'BUY' ? '#b7eb8f' : 
                                      record.recommendation === 'SELL' ? '#ffccc7' : 
                                      record.recommendation === 'HOLD' ? '#ffe58f' : '#ffa39e'
                                    }`,
                                    color: 
                                      record.recommendation === 'BUY' ? '#52c41a' : 
                                      record.recommendation === 'SELL' ? '#ff4d4f' : 
                                      record.recommendation === 'HOLD' ? '#faad14' : '#cf1322',
                                    fontSize: '11px',
                                    fontWeight: 'bold'
                                  }}>
                                    Final Action: {record.recommendation}
                                  </div>
                                </div>
                              } 
                              style={{ background: 'white', border: '1px solid #f0f0f0' }}
                            >
                              <div style={{ padding: 16 }}>
                                <div style={{ 
                                  fontSize: '13px', 
                                  lineHeight: 1.6,
                                  whiteSpace: 'pre-wrap',
                                  fontFamily: 'monospace',
                                  backgroundColor: '#fafafa',
                                  padding: '12px',
                                  borderRadius: '6px',
                                  border: '1px solid #f0f0f0',
                                  maxHeight: '300px',
                                  overflowY: 'auto'
                                }}>
                                  {record.reasonFull || record.reason || 'No AI reasoning provided'}
                                </div>
                                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px dashed #f0f0f0' }}>
                                  <Row gutter={16}>
                                    <Col span={8}>
                                      <div style={{ fontSize: '11px', color: '#666' }}>Confidence</div>
                                      <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#1890ff' }}>
                                        {(record.confidence * 100).toFixed(1)}%
                                      </div>
                                    </Col>
                                    <Col span={8}>
                                      <div style={{ fontSize: '11px', color: '#666' }}>Recommended Qty</div>
                                      <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#52c41a' }}>
                                        {record.recommendedQty || record.positionSize || 0}
                                      </div>
                                    </Col>
                                    <Col span={8}>
                                      <div style={{ fontSize: '11px', color: '#666' }}>Generated</div>
                                      <div style={{ fontSize: '12px', color: '#999' }}>
                                        {record.generatedTime ? new Date(record.generatedTime).toLocaleString() : 'N/A'}
                                      </div>
                                    </Col>
                                  </Row>
                                </div>
                              </div>
                            </Card>
                          </Col>
                          
                          {/* 市场数据 */}
                          <Col span={8}>
                            <Card size="small" title="Market Snapshot" style={{ height: '100%' }}>
                              {evidence.marketData ? (
                                <div style={{ padding: 12 }}>
                                  <div style={{ marginBottom: 8 }}>
                                    <div style={{ fontSize: '11px', color: '#666' }}>Price</div>
                                    <div style={{ fontSize: '16px', fontWeight: 'bold' }}>
                                      ${evidence.marketData.price?.toFixed(2) || 'N/A'}
                                    </div>
                                  </div>
                                  <div style={{ marginBottom: 8 }}>
                                    <div style={{ fontSize: '11px', color: '#666' }}>Change</div>
                                    <div style={{ 
                                      fontSize: '14px', 
                                      fontWeight: 'bold',
                                      color: evidence.marketData.changePercent >= 0 ? '#52c41a' : '#ff4d4f'
                                    }}>
                                      {evidence.marketData.changePercent?.toFixed(2) || 'N/A'}%
                                    </div>
                                  </div>
                                  <div>
                                    <div style={{ fontSize: '11px', color: '#666' }}>Volume</div>
                                    <div style={{ fontSize: '12px' }}>
                                      {evidence.marketData.volume?.toLocaleString() || 'N/A'}
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <div style={{ padding: 12, color: '#999', textAlign: 'center' }}>
                                  No market data available
                                </div>
                              )}
                            </Card>
                          </Col>
                          
                          {/* 回测结果 */}
                          <Col span={8}>
                            <Card size="small" title="Backtest Results" style={{ height: '100%' }}>
                              {evidence.backtestKeyResults ? (
                                <div style={{ padding: 12 }}>
                                  <div style={{ marginBottom: 8 }}>
                                    <div style={{ fontSize: '11px', color: '#666' }}>Total Return</div>
                                    <div style={{ 
                                      fontSize: '16px', 
                                      fontWeight: 'bold',
                                      color: evidence.backtestKeyResults.totalReturn >= 0 ? '#52c41a' : '#ff4d4f'
                                    }}>
                                      {evidence.backtestKeyResults.totalReturn?.toFixed(2) || 'N/A'}%
                                    </div>
                                  </div>
                                  <div style={{ marginBottom: 8 }}>
                                    <div style={{ fontSize: '11px', color: '#666' }}>Sharpe Ratio</div>
                                    <div style={{ fontSize: '14px', fontWeight: 'bold' }}>
                                      {evidence.backtestKeyResults.sharpeRatio?.toFixed(2) || 'N/A'}
                                    </div>
                                  </div>
                                  <div>
                                    <div style={{ fontSize: '11px', color: '#666' }}>Max Drawdown</div>
                                    <div style={{ fontSize: '12px' }}>
                                      {evidence.backtestKeyResults.maxDrawdown?.toFixed(2) || 'N/A'}%
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <div style={{ padding: 12, color: '#999', textAlign: 'center' }}>
                                  No backtest results
                                </div>
                              )}
                            </Card>
                          </Col>
                          
                          {/* 优化结果 */}
                          <Col span={8}>
                            <Card size="small" title="Optimization Results" style={{ height: '100%' }}>
                              {evidence.optimizationKeyResults ? (
                                <div style={{ padding: 12 }}>
                                  <div style={{ marginBottom: 8 }}>
                                    <div style={{ fontSize: '11px', color: '#666' }}>Best Score</div>
                                    <div style={{ fontSize: '16px', fontWeight: 'bold' }}>
                                      {evidence.optimizationKeyResults.bestScore?.toFixed(4) || 'N/A'}
                                    </div>
                                  </div>
                                  <div style={{ marginBottom: 8 }}>
                                    <div style={{ fontSize: '11px', color: '#666' }}>Best Parameters</div>
                                    <div style={{ fontSize: '12px', fontFamily: 'monospace' }}>
                                      {JSON.stringify(evidence.optimizationKeyResults.bestCombination) || 'N/A'}
                                    </div>
                                  </div>
                                  <div>
                                    <div style={{ fontSize: '11px', color: '#666' }}>Total Combinations</div>
                                    <div style={{ fontSize: '12px' }}>
                                      {evidence.optimizationKeyResults.totalCombinations || 'N/A'}
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <div style={{ padding: 12, color: '#999', textAlign: 'center' }}>
                                  No optimization results
                                </div>
                              )}
                            </Card>
                          </Col>
                        </Row>
                        
                        {/* 证据摘要 */}


                      </div>
                    );
                  },
                  rowExpandable: (record: any) => true,
                  expandIcon: ({ expanded, onExpand, record }: any) => (
                    <Button 
                      type="link" 
                      size="small"
                      onClick={(e) => onExpand(record, e)}
                      style={{ padding: '0 4px' }}
                    >
                      {expanded ? '▲ Hide Details' : '▼ Show Details'}
                    </Button>
                  )
                }}
              />
            </>
          ) : (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                <div>
                  <Text type="secondary">No recommendations yet</Text>
                  <div style={{ marginTop: '8px' }}>
                    <Text type="secondary">
                      Click "Run Now" to generate AI recommendations based on your watchlist
                    </Text>
                  </div>
                </div>
              }
            />
          )}
        </Card>
      </div>
    </div>
  );
};

export default Portfolio;