import React, { useState, useEffect, useRef } from 'react';
import { 
  Card, Typography, Space, Statistic, Row, Col, 
  Button, Divider, Table, Tag, Select, Form, Input, 
  message, Progress, Empty, Badge, Alert, Tooltip, Collapse
} from 'antd';
import { 
  DollarOutlined, LineChartOutlined, PieChartOutlined, BarChartOutlined,
  SettingOutlined, PlayCircleOutlined, PauseCircleOutlined, 
  ThunderboltOutlined, CheckCircleOutlined, ClockCircleOutlined,
  RobotOutlined
} from '@ant-design/icons';
import aiTradingService, { AIProviderConfig } from '../services/aiTradingService';
import { backtraderAPI, marketAPI } from '../services/api';
import marketDataService from '../services/marketDataService';

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
  
  // Step 5: 自动扫描定时器
  const autoScanTimerRef = useRef<NodeJS.Timeout | null>(null);

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

  // Step 4: 获取候选股票符号 - 科技股市场扫描
  const getCandidateSymbols = async (): Promise<{symbols: string[], source: string, scanType: string}> => {
    try {
      console.log('开始科技股市场扫描...');
      
      // 1. 从市场数据源获取股票列表
      const response = await marketAPI.getStocks();
      
      if (!response.data || !response.data.stocks || !Array.isArray(response.data.stocks)) {
        throw new Error('市场数据源返回的股票列表为空或格式不正确');
      }
      
      const allStocks = response.data.stocks;
      console.log(`获取到 ${allStocks.length} 只股票数据`);
      
      // 2. 筛选科技股
      // 科技股筛选关键词（基于 sector 和 industry 字段）
      const techKeywords = [
        'technology', 'tech', 'software', 'semiconductor', 'hardware',
        'internet', 'cloud', 'ai', 'artificial intelligence', 'machine learning',
        'cybersecurity', 'saas', 'platform', 'digital', 'electronics',
        'computer', 'chip', 'semiconductor', 'telecom', 'communication'
      ];
      
      const techStocks = allStocks.filter((stock: any) => {
        if (!stock.sector && !stock.industry) return false;
        
        const sector = (stock.sector || '').toLowerCase();
        const industry = (stock.industry || '').toLowerCase();
        const name = (stock.name || '').toLowerCase();
        const symbol = (stock.symbol || '').toLowerCase();
        
        // 检查是否是科技股
        const isTech = techKeywords.some(keyword => 
          sector.includes(keyword) || 
          industry.includes(keyword) ||
          name.includes(keyword)
        );
        
        // 排除金融、能源、公用事业等非科技行业
        const nonTechKeywords = ['bank', 'financial', 'insurance', 'energy', 'oil', 'gas', 'utility', 'real estate'];
        const isNonTech = nonTechKeywords.some(keyword => 
          sector.includes(keyword) || 
          industry.includes(keyword)
        );
        
        return isTech && !isNonTech && stock.changePercent !== null && stock.price !== null;
      });
      
      console.log(`筛选出 ${techStocks.length} 只科技股`);
      
      if (techStocks.length === 0) {
        // 如果没有明确的科技股，使用所有有价格变动的股票
        const allValidStocks = allStocks.filter((stock: any) => 
          stock.changePercent !== null && stock.price !== null
        );
        
        if (allValidStocks.length === 0) {
          throw new Error('没有找到有效的股票数据');
        }
        
        // 按涨跌幅排序
        const sortedStocks = [...allValidStocks].sort((a, b) => 
          (b.changePercent || 0) - (a.changePercent || 0)
        );
        
        // 取涨幅最大的2只和跌幅最大的2只
        const topGainers = sortedStocks.slice(0, 2);
        const topLosers = sortedStocks.slice(-2).reverse();
        const selectedStocks = [...topGainers, ...topLosers].slice(0, 5);
        
        const symbols = selectedStocks.map(stock => stock.symbol);
        console.log(`使用市场股票（无科技股筛选）: ${symbols.join(', ')}`);
        return { 
          symbols, 
          source: 'market_scan', 
          scanType: 'market_all' 
        };
      }
      
      // 3. 在科技股中筛选
      // 按涨跌幅排序
      const sortedTechStocks = [...techStocks].sort((a, b) => 
        (b.changePercent || 0) - (a.changePercent || 0)
      );
      
      // 取涨幅最大的科技股（top gainers）
      const topTechGainers = sortedTechStocks.slice(0, 2);
      
      // 取跌幅最大的科技股（top losers）
      const topTechLosers = sortedTechStocks.slice(-2).reverse();
      
      // 再取一些中间表现的科技股（selected tech picks）
      const middleIndex = Math.floor(sortedTechStocks.length / 2);
      const selectedTechPicks = sortedTechStocks.slice(middleIndex, middleIndex + 1);
      
      // 合并所有选中的科技股，最多5只
      const selectedStocks = [...topTechGainers, ...topTechLosers, ...selectedTechPicks]
        .filter((stock, index, array) => 
          array.findIndex(s => s.symbol === stock.symbol) === index
        )
        .slice(0, 5);
      
      const symbols = selectedStocks.map(stock => stock.symbol);
      const scanType = selectedStocks.length > 0 ? 'tech_market_scan' : 'market_scan';
      
      console.log(`科技股市场扫描完成: ${symbols.join(', ')}`);
      console.log(`扫描详情: ${topTechGainers.length}只涨幅最大, ${topTechLosers.length}只跌幅最大, ${selectedTechPicks.length}只精选`);
      
      return { 
        symbols, 
        source: 'tech_market_scan', 
        scanType 
      };
      
    } catch (error: any) {
      console.error('科技股市场扫描失败:', error);
      throw new Error(`科技股市场扫描失败: ${error.message || '未知错误'}`);
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
    // 只在自动扫描启用时安排下一次
    if (!isAutoScanEnabled) {
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
        
        // 扫描完成后，如果自动扫描仍然启用，安排下一次
        // 注意：这里不依赖 autoScanTimerRef.current，因为 runAiScanOnce 可能已经清理了它
        if (isAutoScanEnabled) {
          scheduleNextAutoScan();
        }
      } catch (error) {
        console.error('自动扫描执行失败:', error);
        // 即使失败，如果自动扫描仍然启用，也继续安排下一次
        if (isAutoScanEnabled) {
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
    
    // 更新状态为 scheduled（等待第一次扫描）
    setScanStatus(prev => ({
      ...prev,
      status: 'scheduled',
      nextRun: calculateNextRunTime(),
      progress: 0
    }));
    
    message.success(`已启动自动扫描，间隔 ${scanInterval} 分钟`);
    
    // 立即执行第一次扫描
    runAiScanOnce(true);
  };

  // Step 5: 停止自动扫描
  const handleStopAutoScan = () => {
    // 禁用自动扫描模式
    setIsAutoScanEnabled(false);
    
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
          
          // 2. 获取市场数据
          let marketData: any = null;
          try {
            marketData = await marketDataService.getStockData(symbol);
            console.log(`股票 ${symbol} 市场数据获取成功:`, { 
              price: marketData.price,
              changePercent: marketData.changePercent 
            });
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
            strategy: 'moving_average',
            startDate: getLocalDateString(oneYearAgo), // 1年前（本地日期）
            endDate: getLocalDateString(today), // 今天（本地日期）
            initialCapital: 10000,
            symbols: [symbol], // 使用 symbols 数组，保持向后兼容
            dataMode: 'real', // 固定使用真实数据
            parameters: {
              shortMaPeriod: 20,
              longMaPeriod: 50
            }
          };
          
          let backtestResponse: any;
          try {
            backtestResponse = await backtraderAPI.runBacktest(backtestConfig);
            console.log(`股票 ${symbol} 回测响应:`, {
              success: backtestResponse.data?.success,
              hasResult: !!backtestResponse.data?.result,
              resultKeys: backtestResponse.data?.result ? Object.keys(backtestResponse.data.result) : []
            });
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
          
          // 5. 准备 AI 分析上下文
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
            optimizationResult: optimizationResponse.data?.result || {}
          };
          
          // 6. 调用 AI 分析
          const aiResponse = await aiTradingService.previewTradeWithContext(symbol, aiContext);
          console.log(`股票 ${symbol} AI 分析响应:`, {
            success: aiResponse.success,
            hasDecision: !!aiResponse.decision,
            decision: aiResponse.decision,
            validation: aiResponse.validation,
            responseStructure: Object.keys(aiResponse)
          });
          
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
            
            // 构建证据摘要
            const evidenceSummary = {
              marketData: marketData ? {
                price: marketData.price,
                changePercent: marketData.changePercent,
                volume: marketData.volume
              } : null,
              backtestKeyResults: backtestResponse.data?.result ? {
                totalReturn: backtestResponse.data.result.totalReturn,
                sharpeRatio: backtestResponse.data.result.sharpeRatio,
                maxDrawdown: backtestResponse.data.result.maxDrawdown,
                winRate: backtestResponse.data.result.winRate
              } : null,
              optimizationKeyResults: optimizationResponse.data?.result ? {
                bestScore: optimizationResponse.data.result.bestScore,
                bestCombination: optimizationResponse.data.result.bestCombination,
                totalCombinations: optimizationResponse.data.result.totalCombinations
              } : null,
              aiReasoning: decision.reason || 'Standard moving average crossover analysis'
            };
            
            // 构建更详细的后测摘要
            const backtestDetailedSummary = backtestResponse.data?.result ? 
              `Return: ${backtestResponse.data.result.totalReturn?.toFixed(2) || 'N/A'}% | ` +
              `Sharpe: ${backtestResponse.data.result.sharpeRatio?.toFixed(2) || 'N/A'} | ` +
              `Drawdown: ${backtestResponse.data.result.maxDrawdown?.toFixed(2) || 'N/A'}%` :
              'Backtest unavailable';
            
            // 构建更详细的优化摘要
            const optimizationDetailedSummary = optimizationResponse.data?.success === false 
              ? 'Optimization unavailable (404)' 
              : optimizationResponse.data?.result?.bestCombination 
                ? `Best: ${JSON.stringify(optimizationResponse.data.result.bestCombination)} | ` +
                  `Score: ${optimizationResponse.data.result.bestScore?.toFixed(4) || 'N/A'}` 
                : 'Optimization completed';
            
            // 生成简洁的 reason 总结（一句话）
            const generateReasonSummary = () => {
              const action = decision.action;
              const confidence = decision.confidence || 0.5;
              
              // 根据 backtest 结果生成简洁信号
              let backtestSignal = '';
              if (backtestResponse.data?.result?.totalReturn !== undefined) {
                const returnVal = backtestResponse.data.result.totalReturn;
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
              
              // 生成一句话总结
              if (action === 'BUY') {
                return `BUY: ${marketTrend}, ${backtestSignal}, ${confidenceDesc}.`;
              } else if (action === 'SELL') {
                return `SELL: ${marketTrend}, ${backtestSignal}, ${confidenceDesc}.`;
              } else if (action === 'HOLD') {
                return `HOLD: ${marketTrend}, ${backtestSignal}, ${confidenceDesc}.`;
              } else {
                return `${action}: ${marketTrend}, ${backtestSignal}, ${confidenceDesc}.`;
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
              if (backtestResponse.data?.result?.totalReturn !== undefined) {
                parts.push(`Backtest: ${backtestResponse.data.result.totalReturn.toFixed(2)}% return, Sharpe ${backtestResponse.data.result.sharpeRatio?.toFixed(2) || 'N/A'}`);
              }
              
              // 优化证据
              if (optimizationResponse.data?.result?.bestScore !== undefined) {
                parts.push(`Optimization: best score ${optimizationResponse.data.result.bestScore.toFixed(4)}`);
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
            
            recommendation = {
              ...baseFields,
              recommendation: decision.action,
              confidence: decision.confidence || 0.5,
              reason: generateReasonSummary(), // 简洁总结版
              reasonFull: decision.reason || 'AI analysis completed', // 完整版
              evidenceSummary: generateEvidenceSummary(), // 证据摘要
              evidenceFull: JSON.stringify(evidenceSummary), // 完整证据
              backtestSummary: backtestDetailedSummary,
              optimizationSummary: optimizationDetailedSummary,
              status: 'success'
            };
            
            console.log(`股票 ${symbol} 分析完成: ${decision.action} (置信度: ${decision.confidence})`);
          } else {
            console.warn(`股票 ${symbol} AI 分析失败:`, aiResponse);
            
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
              backtestSummary: 'Failed',
              optimizationSummary: 'Failed',
              status: 'error'
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
      
      if (isAutoScan && isAutoScanEnabled) {
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
      
      // 如果是自动扫描且自动扫描模式仍然启用，安排下一次
      if (isAutoScan && isAutoScanEnabled) {
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
      
      if (isAutoScan && isAutoScanEnabled) {
        nextStatus = 'scheduled';
        nextNextRun = calculateNextRunTime();
      }
      
      setScanStatus(prev => ({ 
        ...prev, 
        status: nextStatus, 
        nextRun: nextNextRun,
        progress: 0 
      }));
      
      // 如果是自动扫描且自动扫描模式仍然启用，安排下一次
      if (isAutoScan && isAutoScanEnabled) {
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
      
      {/* 2. Scan Control */}
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
      
      {/* 3. AI Recommendations */}
      <div style={{ marginBottom: 24 }}>
        <Title level={4}>
          <RobotOutlined style={{ marginRight: '8px' }} />
          AI Recommendations
        </Title>
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
                
                <Row gutter={16}>
                  <Col span={6}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1890ff' }}>
                        {aiRecommendations.length}
                      </div>
                      <div style={{ fontSize: '12px', color: '#666', marginTop: 4 }}>
                        Total Symbols
                      </div>
                    </div>
                  </Col>
                  <Col span={6}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#52c41a' }}>
                        {aiRecommendations.filter(r => r.status === 'success').length}
                      </div>
                      <div style={{ fontSize: '12px', color: '#666', marginTop: 4 }}>
                        Successful
                      </div>
                    </div>
                  </Col>
                  <Col span={6}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ff4d4f' }}>
                        {aiRecommendations.filter(r => r.status === 'error').length}
                      </div>
                      <div style={{ fontSize: '12px', color: '#666', marginTop: 4 }}>
                        Failed
                      </div>
                    </div>
                  </Col>
                  <Col span={6}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#fa8c16' }}>
                        {aiRecommendations.filter(r => r.recommendation === 'HOLD').length}
                      </div>
                      <div style={{ fontSize: '12px', color: '#666', marginTop: 4 }}>
                        Hold Recommendations
                      </div>
                    </div>
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
                    width: 100,
                    render: (rec: string) => {
                      let color = 'default';
                      let text = rec;
                      
                      if (rec === 'BUY') {
                        color = 'green';
                      } else if (rec === 'SELL') {
                        color = 'red';
                      } else if (rec === 'HOLD') {
                        color = 'gold';
                      } else if (rec === 'ERROR') {
                        color = 'red';
                        text = 'ERROR';
                      }
                      
                      return (
                        <Tag color={color} style={{ fontWeight: 'bold', minWidth: 60, textAlign: 'center' }}>
                          {text}
                        </Tag>
                      );
                    }
                  },
                  { 
                    title: 'Confidence', 
                    dataIndex: 'confidence', 
                    key: 'confidence',
                    width: 120,
                    render: (conf: number) => {
                      const percent = Math.round(conf * 100);
                      return (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Progress 
                            percent={percent} 
                            size="small" 
                            style={{ width: 60 }}
                            strokeColor={
                              percent >= 80 ? '#52c41a' : 
                              percent >= 60 ? '#faad14' : 
                              '#ff4d4f'
                            }
                            showInfo={false}
                          />
                          <Text style={{ fontSize: '12px', fontWeight: 'bold', minWidth: 30 }}>
                            {percent}%
                          </Text>
                        </div>
                      );
                    }
                  },
                  { 
                    title: 'Reason', 
                    dataIndex: 'reason', 
                    key: 'reason',
                    width: 200,
                    render: (reason: string, record: any) => {
                      const fullReason = record.reasonFull || 'No detailed reasoning available';
                      return (
                        <Tooltip title={
                          <div style={{ maxWidth: 400 }}>
                            <div><strong>Full AI Reasoning:</strong></div>
                            <div style={{ marginTop: 4, fontSize: '12px' }}>{fullReason}</div>
                          </div>
                        }>
                          <div 
                            style={{ 
                              maxHeight: '2.4em',
                              lineHeight: '1.2em',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              cursor: 'pointer',
                              fontSize: '12px',
                              fontStyle: reason.includes('ERROR') ? 'italic' : 'normal',
                              color: reason.includes('ERROR') ? '#ff4d4f' : 'inherit'
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
                    let evidence: any = {};
                    try {
                      evidence = record.evidenceFull ? JSON.parse(record.evidenceFull) : {};
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
                          {/* 完整 Reason */}
                          <Col span={24} style={{ marginBottom: 16 }}>
                            <Card size="small" title="AI Reasoning" style={{ background: 'white' }}>
                              <div style={{ padding: 12 }}>
                                <Text style={{ fontSize: '13px', lineHeight: 1.6 }}>
                                  {record.reasonFull || record.reason || 'No reasoning provided'}
                                </Text>
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