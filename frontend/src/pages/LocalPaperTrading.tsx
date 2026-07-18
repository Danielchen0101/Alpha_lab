import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Card, Row, Col, Statistic, Table, Typography, Progress, Tag, Button, message, Popconfirm, InputNumber, Select, Radio } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined, PieChartOutlined, DollarOutlined, WalletOutlined, LineChartOutlined, PlusOutlined, MinusOutlined, ReloadOutlined, PlayCircleOutlined, PauseCircleOutlined, FolderOpenOutlined } from '@ant-design/icons';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import {
  executePaperTrade,
  handleStrategySignal,
  generateRandomSignal,
  generateSMASignal,
  generateMACrossoverSignal,
  updatePriceHistory,
  calculateMarketValue,
  calculateTotalEquity,
  calculateTotalPnL,
  calculatePnLPercentage,
  recordEquityHistory,
  DEFAULT_PAPER_TRADING_CONFIG,
  DEFAULT_PORTFOLIO,
  type PortfolioState,
  type Trade,
  type TradeOrder,
  type StrategySignal,
  type PaperTradingConfig,
  type EquityHistory,
  type PriceHistory,
} from '../utils/paperTradingEngine';
import { useAuth } from '../contexts/AuthContext';

const { Title, Text } = Typography;

const LocalPaperTrading: React.FC = () => {
  const { user } = useAuth();
  const sessionHistoryStorageKey = user?.id ? `paper_trading_session_history:${user.id}` : '';
  const lastBacktestResultStorageKey = user?.id ? `quant_last_backtest_result:${user.id}` : '';
  // 初始状态
  const [portfolio, setPortfolio] = useState<PortfolioState>(DEFAULT_PORTFOLIO);

  // Manual Order 表单状态
  const [manualOrder, setManualOrder] = useState({
    symbol: 'AAPL',
    shares: 1,
    action: 'BUY' as 'BUY' | 'SELL',
  });

  // 价格模拟控制状态
  const [priceSimulationPaused, setPriceSimulationPaused] = useState(false);

  // Paper Trading 控制状态
  const [paperTradingConfig, setPaperTradingConfig] = useState<PaperTradingConfig>(DEFAULT_PAPER_TRADING_CONFIG);
  // 策略状态反馈
  const [strategyStatus, setStrategyStatus] = useState<string>('Ready');
  // Paper Trading Session 状态
  const [paperTradingSession, setPaperTradingSession] = useState<{
    isActive: boolean;
    startTime: string | null;
    endTime: string | null;
    startEquity: number;
    endEquity: number;
    totalTrades: number;
    realizedPnL: number;
    tradesDuringSession: Trade[];
  }>({
    isActive: false,
    startTime: null,
    endTime: null,
    startEquity: 0,
    endEquity: 0,
    totalTrades: 0,
    realizedPnL: 0,
    tradesDuringSession: [],
  });

  // Batch Experiment 状态
  const [batchRunning, setBatchRunning] = useState<boolean>(false);
  const [currentBatchIndex, setCurrentBatchIndex] = useState<number>(-1);
  const [batchStatus, setBatchStatus] = useState<string>('');

  // Batch 稳定性管理
  const batchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedBatchIndexRef = useRef<number | null>(null);
  const presetSequence = useRef([
    { name: 'Fast', short: 5, long: 10 },
    { name: 'Medium', short: 10, long: 20 },
    { name: 'Slow', short: 20, long: 50 },
  ]);

  // 清理定时器
  const clearBatchTimer = () => {
    if (batchTimerRef.current) {
      clearTimeout(batchTimerRef.current);
      batchTimerRef.current = null;
    }
  };

  // Session History 状态
  type SessionHistoryItem = {
    id: string;
    timestamp: string;
    strategyMode: string;
    symbol: string;
    shortMaPeriod?: number;
    longMaPeriod?: number;
    slippageRate?: number;
    commissionRate?: number;
    startEquity: number;
    endEquity: number;
    returnPct: number;
    totalTrades: number;
    realizedPnL: number;
    totalSlippage: number;
    totalCommission: number;
    durationMinutes: number;
  };

  const [sessionHistory, setSessionHistory] = useState<SessionHistoryItem[]>(() => {
    // 从localStorage加载历史记录
    try {
      const saved = sessionHistoryStorageKey ? localStorage.getItem(sessionHistoryStorageKey) : null;
      return saved ? JSON.parse(saved) : [];
    } catch (error) {
      console.error('Failed to load session history:', error);
      return [];
    }
  });

  useEffect(() => {
    if (!sessionHistoryStorageKey) {
      setSessionHistory([]);
      return;
    }
    try {
      const saved = localStorage.getItem(sessionHistoryStorageKey);
      setSessionHistory(saved ? JSON.parse(saved) : []);
    } catch {
      setSessionHistory([]);
    }
  }, [sessionHistoryStorageKey]);

  // Equity History 状态
  const [equityHistory, setEquityHistory] = useState<EquityHistory[]>([]);

  // 价格历史状态
  const [priceHistory, setPriceHistory] = useState<PriceHistory[]>([]);

  // 最新价格映射（统一的价格源）
  const [latestPrices, setLatestPrices] = useState<Record<string, number>>({});

  // 统一的辅助函数：获取symbol的最新价格
  const getLatestPrice = (symbol: string): number | null => {
    // 1. 首先从最新价格映射中查找
    if (latestPrices[symbol] !== undefined) {
      return latestPrices[symbol];
    }
    
    // 2. 从当前持仓中查找
    const position = portfolio.positions.find(p => p.symbol === symbol);
    if (position) {
      return position.currentPrice;
    }
    
    // 3. 从价格历史中查找最新价格
    const symbolPriceHistory = priceHistory.find(ph => ph.symbol === symbol);
    if (symbolPriceHistory && symbolPriceHistory.prices.length > 0) {
      return symbolPriceHistory.prices[symbolPriceHistory.prices.length - 1];
    }
    
    // 4. 如果都没有，返回null（调用方需要处理这种情况）
    return null;
  };

  // 价格自动更新效果
  useEffect(() => {
    const intervalId = setInterval(() => {
      // 如果价格模拟暂停，跳过更新
      if (priceSimulationPaused) {
        return;
      }

      // 生成随机价格波动（±1%以内）
      const updatePrice = (oldPrice: number) => {
        // 生成 -0.01 到 0.01 之间的随机波动
        const randomChange = (Math.random() * 0.02) - 0.01; // -0.01 到 0.01
        const newPrice = oldPrice * (1 + randomChange);
        // 保留2位小数
        return Math.round(newPrice * 100) / 100;
      };

      // 更新所有持仓的当前价格
      setPortfolio(prev => {
        const updatedPositions = prev.positions.map(position => ({
          ...position,
          currentPrice: updatePrice(position.currentPrice)
        }));

        // 调试输出
        console.log('[Price Update]');
        prev.positions.forEach((position, index) => {
          const oldPrice = position.currentPrice;
          const newPrice = updatedPositions[index].currentPrice;
          const change = ((newPrice - oldPrice) / oldPrice * 100).toFixed(2);
          console.log(`${position.symbol}: ${oldPrice.toFixed(2)} → ${newPrice.toFixed(2)} (${change}%)`);
        });

        const updatedPortfolio = {
          ...prev,
          positions: updatedPositions
        };

        // 记录equity history
        const marketValue = calculateMarketValue(updatedPositions);
        setEquityHistory(prevHistory => recordEquityHistory(prevHistory, updatedPortfolio, marketValue));

        // 更新最新价格映射
        setLatestPrices((currentPrices) => {
          const nextPrices = { ...currentPrices };
          updatedPositions.forEach(position => {
            nextPrices[position.symbol] = position.currentPrice;
          });
          return nextPrices;
        });

        return updatedPortfolio;
      });
    }, 2000); // 每2秒更新一次

    // 清理函数
    return () => clearInterval(intervalId);
  }, [priceSimulationPaused]); // 依赖priceSimulationPaused状态

  // 计算市场价值
  const marketValue = useMemo(() => {
    return calculateMarketValue(portfolio.positions);
  }, [portfolio.positions]);

  // 计算总资产
  const totalEquity = useMemo(() => {
    return calculateTotalEquity(portfolio.cash, marketValue);
  }, [portfolio.cash, marketValue]);

  // 计算总盈亏
  const totalPnL = useMemo(() => {
    return calculateTotalPnL(portfolio.positions);
  }, [portfolio.positions]);

  // 计算盈亏百分比
  const pnlPercentage = useMemo(() => {
    return calculatePnLPercentage(portfolio.positions, totalPnL);
  }, [portfolio.positions, totalPnL]);

  // ========== Batch Runner 稳定性重构 ==========

  // 保存 session 到 history（防重复保存）
  const saveSessionToHistory = useCallback((sessionSnapshot: typeof paperTradingSession, endEquity: number, endTime: string) => {
    if (!sessionSnapshot.startTime || sessionSnapshot.totalTrades === 0) {
      return false;
    }

    // 检查是否已经保存过（通过 startTime 判断）
    if (savedBatchIndexRef.current === currentBatchIndex) {
      console.log('Batch preset already saved:', currentBatchIndex);
      return false;
    }

    const totalSlippage = sessionSnapshot.tradesDuringSession.reduce(
      (sum, trade) => sum + Math.abs(trade.slippageAmount || 0),
      0
    );
    
    const totalCommission = sessionSnapshot.tradesDuringSession.reduce(
      (sum, trade) => sum + Math.abs(trade.commission || 0),
      0
    );
    
    const returnPct = sessionSnapshot.startEquity > 0 
      ? ((endEquity - sessionSnapshot.startEquity) / sessionSnapshot.startEquity) * 100 
      : 0;
    
    const startTime = new Date(sessionSnapshot.startTime);
    const endTimeDate = new Date(endTime);
    const durationMs = endTimeDate.getTime() - startTime.getTime();
    const durationMinutes = Math.round(durationMs / (1000 * 60));
    
    const historyItem: SessionHistoryItem = {
      id: `session_${Date.now()}_${currentBatchIndex}`,
      timestamp: endTime,
      strategyMode: paperTradingConfig.mode,
      symbol: paperTradingConfig.selectedSymbol,
      shortMaPeriod: paperTradingConfig.shortMaPeriod,
      longMaPeriod: paperTradingConfig.longMaPeriod,
      slippageRate: paperTradingConfig.slippageRate,
      commissionRate: paperTradingConfig.commission,
      startEquity: sessionSnapshot.startEquity,
      endEquity: endEquity,
      returnPct: returnPct,
      totalTrades: sessionSnapshot.totalTrades,
      realizedPnL: sessionSnapshot.realizedPnL,
      totalSlippage: totalSlippage,
      totalCommission: totalCommission,
      durationMinutes: durationMinutes,
    };
    
    setSessionHistory(prev => {
      const newHistory = [historyItem, ...prev];
      const limitedHistory = newHistory.slice(0, 10);
      if (sessionHistoryStorageKey) localStorage.setItem(sessionHistoryStorageKey, JSON.stringify(limitedHistory));
      return limitedHistory;
    });

    // 标记为已保存
    savedBatchIndexRef.current = currentBatchIndex;
    return true;
  }, [currentBatchIndex, paperTradingConfig, sessionHistoryStorageKey]);

  // 启动单个 preset
  const startBatchPreset = useCallback((index: number) => {
    if (index < 0 || index >= presetSequence.current.length) {
      return false;
    }

    const preset = presetSequence.current[index];
    
    // 清理旧定时器
    clearBatchTimer();
    
    // 应用 preset 参数
    setPaperTradingConfig(prev => ({
      ...prev,
      shortMaPeriod: preset.short,
      longMaPeriod: preset.long,
      status: 'RUNNING'
    }));

    // 初始化新的 session
    setPaperTradingSession({
      isActive: true,
      startTime: new Date().toISOString(),
      endTime: null,
      startEquity: totalEquity,
      endEquity: 0,
      totalTrades: 0,
      realizedPnL: 0,
      tradesDuringSession: [],
    });

    setBatchStatus(`Running: ${preset.name} (${index + 1}/${presetSequence.current.length})`);
    setStrategyStatus(`Batch: ${preset.name} started`);
    message.info(`Batch: ${preset.name} started (${preset.short}/${preset.long})`);
    
    return true;
  }, [totalEquity]);

  // 停止并保存当前 preset
  const stopAndSaveBatchPreset = useCallback((index: number) => {
    if (index < 0 || index >= presetSequence.current.length) {
      return false;
    }

    const preset = presetSequence.current[index];
    
    // 停止 paper trading
    setPaperTradingConfig(prev => ({
      ...prev,
      status: 'STOPPED'
    }));

    // 结束 session
    const endTime = new Date().toISOString();
    setPaperTradingSession(prev => ({
      ...prev,
      isActive: false,
      endTime: endTime,
      endEquity: totalEquity,
    }));

    // 保存到 history（防重复）
    const saved = saveSessionToHistory(paperTradingSession, totalEquity, endTime);
    
    setStrategyStatus(`Batch: ${preset.name} completed`);
    message.info(`Batch: ${preset.name} completed (${index + 1}/${presetSequence.current.length})${saved ? ' - saved to history' : ''}`);
    
    return true;
  }, [totalEquity, paperTradingSession, saveSessionToHistory]);

  // 切换到下一组 preset
  const moveToNextPreset = useCallback(() => {
    const nextIndex = currentBatchIndex + 1;
    
    if (nextIndex >= presetSequence.current.length) {
      // 所有 preset 完成
      setBatchRunning(false);
      setCurrentBatchIndex(-1);
      setBatchStatus('Batch completed!');
      savedBatchIndexRef.current = null;
      message.success('Batch experiment completed');
      return;
    }

    // 设置下一组 preset
    setCurrentBatchIndex(nextIndex);
  }, [currentBatchIndex]);

  // Batch 自动切换逻辑 - 简化稳定版
  useEffect(() => {
    if (!batchRunning || currentBatchIndex < 0) {
      return;
    }

    // 如果已经完成所有 preset
    if (currentBatchIndex >= presetSequence.current.length) {
      setBatchRunning(false);
      setCurrentBatchIndex(-1);
      setBatchStatus('Batch completed!');
      savedBatchIndexRef.current = null;
      message.success('Batch experiment completed');
      return;
    }

    // 如果 paper trading 正在运行，设置定时器自动停止
    if (paperTradingConfig.status === 'RUNNING') {
      // 清理旧的定时器
      clearBatchTimer();

      // 设置新的定时器（30秒后停止）
      batchTimerRef.current = setTimeout(() => {
        stopAndSaveBatchPreset(currentBatchIndex);
        
        // 等待1秒后切换到下一组
        setTimeout(() => {
          moveToNextPreset();
        }, 1000);
      }, 30000);

      return () => {
        clearBatchTimer();
      };
    } else {
      // 如果 paper trading 停止，启动当前 preset
      startBatchPreset(currentBatchIndex);
    }
  }, [batchRunning, currentBatchIndex, paperTradingConfig.status, startBatchPreset, stopAndSaveBatchPreset, moveToNextPreset]);

  // 组件卸载时清理定时器
  useEffect(() => {
    return () => {
      clearBatchTimer();
    };
  }, []);

  // 计算session持续时间
  const sessionDuration = useMemo(() => {
    if (!paperTradingSession.startTime) return 'N/A';
    
    const start = new Date(paperTradingSession.startTime);
    const end = paperTradingSession.endTime ? new Date(paperTradingSession.endTime) : new Date();
    const durationMs = end.getTime() - start.getTime();
    
    if (durationMs < 0) return 'N/A';
    
    const seconds = Math.floor(durationMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }, [paperTradingSession.startTime, paperTradingSession.endTime]);

  // 计算session期间的总盈亏
  const sessionTotalPnL = useMemo(() => {
    if (!paperTradingSession.startEquity) return 0;
    const endEquity = paperTradingSession.endEquity || totalEquity;
    return endEquity - paperTradingSession.startEquity;
  }, [paperTradingSession.startEquity, paperTradingSession.endEquity, totalEquity]);

  // 计算session期间的未实现盈亏
  const sessionUnrealizedPnL = useMemo(() => {
    return sessionTotalPnL - paperTradingSession.realizedPnL;
  }, [sessionTotalPnL, paperTradingSession.realizedPnL]);

  // 计算行业分配
  const allocationData = useMemo(() => {
    const sectorMap: Record<string, { value: number, color: string }> = {};
    
    // 行业颜色映射
    const sectorColors: Record<string, string> = {
      'Technology': '#1890ff',
      'Financial': '#52c41a',
      'Automotive': '#faad14',
      'Healthcare': '#f5222d',
      'Consumer': '#722ed1',
      'Cash': '#8c8c8c',
    };
    
    // 计算每个行业的市值
    portfolio.positions.forEach(position => {
      const sectorValue = position.shares * position.currentPrice;
      if (!sectorMap[position.sector]) {
        sectorMap[position.sector] = { value: 0, color: sectorColors[position.sector] || '#8c8c8c' };
      }
      sectorMap[position.sector].value += sectorValue;
    });
    
    // 添加现金
    sectorMap['Cash'] = { value: portfolio.cash, color: '#8c8c8c' };
    
    // 转换为数组并计算百分比
    const totalValue = marketValue + portfolio.cash;
    return Object.entries(sectorMap).map(([sector, data]) => ({
      sector,
      value: totalValue > 0 ? (data.value / totalValue) * 100 : 0,
      color: data.color,
    }));
  }, [portfolio.positions, portfolio.cash, marketValue]);

  // 统一的交易执行函数（使用Paper Trading Engine）
  const executeTrade = (order: TradeOrder, source: 'DEMO_BUTTON' | 'MANUAL_ORDER' | 'STRATEGY_SIGNAL' = 'MANUAL_ORDER'): boolean => {
    const slippageRate = paperTradingConfig.slippageRate || 0;
    const commission = paperTradingConfig.commission || 0;
    const result = executePaperTrade(portfolio, order, source, slippageRate, commission);
    
    if (result.success) {
      setPortfolio(result.portfolio);
      
      // 记录equity history
      const marketValue = calculateMarketValue(result.portfolio.positions);
      setEquityHistory(prev => recordEquityHistory(prev, result.portfolio, marketValue));
      
      // 如果Paper Trading正在运行，更新session数据
      if (paperTradingConfig.status === 'RUNNING') {
        // 获取新添加的交易（第一个，因为trades数组是[newTrade, ...prev.trades]）
        const newTrade = result.portfolio.trades[0];
        
        // 计算已实现盈亏（仅对SELL交易）
        let realizedPnLChange = 0;
        if (newTrade.action === 'SELL') {
          // 查找该symbol的持仓成本（使用交易前的portfolio状态）
          const position = portfolio.positions.find(p => p.symbol === newTrade.symbol);
          if (position) {
            // 已实现盈亏 = (卖出总收入 - 买入总成本)
            // 卖出总收入 = (卖出价 * 卖出股数) - 手续费
            // 买入总成本 = 平均成本 * 卖出股数
            // 注意：position.avgPrice已经包含了买入时的滑点和手续费
            // newTrade.price是卖出时的executedPrice（已包含滑点）
            // newTrade.commission是卖出时的手续费
            const sellRevenue = newTrade.price * newTrade.shares;
            const buyCost = position.avgPrice * newTrade.shares;
            const sellCommission = newTrade.commission || 0;
            
            // 已实现盈亏 = 卖出总收入 - 卖出手续费 - 买入总成本
            realizedPnLChange = (sellRevenue - sellCommission) - buyCost;
          }
        }
        
        // 更新session
        setPaperTradingSession(prev => ({
          ...prev,
          totalTrades: prev.totalTrades + 1,
          realizedPnL: prev.realizedPnL + realizedPnLChange,
          tradesDuringSession: [...prev.tradesDuringSession, newTrade],
        }));
      }
      
      // 显示成功消息
      const actionText = order.action === 'BUY' ? 'Bought' : 'Sold';
      message.success(`${actionText} ${order.shares} shares of ${order.symbol} at $${order.price.toFixed(2)}`);
      return true;
    } else {
      message.error(result.error || 'Trade execution failed');
      return false;
    }
  };

  // 处理策略信号
  const handleStrategySignalWrapper = (signal: StrategySignal) => {
    const currentPrice = getLatestPrice(signal.symbol);
    
    // 如果没有价格数据，跳过执行
    if (currentPrice === null) {
      const statusMsg = `[Strategy] Skipped ${signal.action} ${signal.shares} ${signal.symbol}: No price data available`;
      console.log(statusMsg);
      setStrategyStatus(statusMsg);
      return;
    }
    
    const slippageRate = paperTradingConfig.slippageRate || 0;
    const commission = paperTradingConfig.commission || 0;
    const result = handleStrategySignal(
      portfolio, 
      signal, 
      currentPrice, 
      slippageRate, 
      commission,
      paperTradingSession.startEquity,
      paperTradingSession.realizedPnL
    );
    
    if (result.success) {
      setPortfolio(result.portfolio);
      
      // 记录equity history
      const marketValue = calculateMarketValue(result.portfolio.positions);
      setEquityHistory(prev => recordEquityHistory(prev, result.portfolio, marketValue));
      
      const successMsg = `Strategy signal executed: ${signal.action} ${signal.shares} ${signal.symbol}`;
      message.success(successMsg);
      setStrategyStatus(successMsg);
    } else {
      const errorMsg = result.error || 'Strategy signal execution failed';
      message.error(errorMsg);
      setStrategyStatus(`Risk control blocked: ${errorMsg}`);
    }
  };

  // 开始/停止Paper Trading
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    
    if (paperTradingConfig.status === 'RUNNING') {
      intervalId = setInterval(() => {
        const symbol = paperTradingConfig.selectedSymbol;
        const sharesPerTrade = paperTradingConfig.sharesPerTrade;
        
        let signal: StrategySignal | null = null;
        
        // 根据策略模式生成信号
        if (paperTradingConfig.mode === 'RANDOM_SIGNAL') {
          signal = generateRandomSignal(symbol, sharesPerTrade);
          if (signal) {
            setStrategyStatus(`Random signal generated: ${signal.action} ${signal.shares} ${signal.symbol}`);
          }
        } else if (paperTradingConfig.mode === 'SMA_STRATEGY') {
          // 获取当前价格（使用统一的价格源）
          const currentPrice = getLatestPrice(symbol);
          
          // 如果没有价格数据，跳过
          if (currentPrice === null) {
            const statusMsg = `[SMA Strategy] Skipped ${symbol}: No price data available`;
            console.log(statusMsg);
            setStrategyStatus(statusMsg);
            return;
          }
          
          // 1. 先基于当前状态计算新的价格历史
          const updatedPriceHistory = updatePriceHistory(priceHistory, symbol, currentPrice);
          
          // 2. 从更新后的历史中获取当前symbol的价格历史
          const symbolPriceHistory = updatedPriceHistory.find(ph => ph.symbol === symbol);
          
          // 3. 如果数据足够，生成SMA信号
          let smaSignal: StrategySignal | null = null;
          if (symbolPriceHistory && symbolPriceHistory.prices.length >= 5) {
            smaSignal = generateSMASignal(symbol, sharesPerTrade, symbolPriceHistory);
          }
          
          // 4. 更新价格历史状态
          setPriceHistory(updatedPriceHistory);
          
          // 5. 如果有信号，执行交易
          if (smaSignal) {
            setStrategyStatus(`SMA signal: ${smaSignal.action} ${smaSignal.shares} ${smaSignal.symbol}`);
            handleStrategySignalWrapper(smaSignal);
          } else {
            setStrategyStatus('SMA Strategy: No signal generated (price near SMA)');
          }
        } else if (paperTradingConfig.mode === 'MA_CROSSOVER') {
          // 获取当前价格（使用统一的价格源）
          const currentPrice = getLatestPrice(symbol);
          
          // 如果没有价格数据，跳过
          if (currentPrice === null) {
            const statusMsg = `[MA Crossover] Skipped ${symbol}: No price data available`;
            console.log(statusMsg);
            setStrategyStatus(statusMsg);
            return;
          }
          
          // 1. 先基于当前状态计算新的价格历史
          const updatedPriceHistory = updatePriceHistory(priceHistory, symbol, currentPrice);
          
          // 2. 从更新后的历史中获取当前symbol的价格历史
          const symbolPriceHistory = updatedPriceHistory.find(ph => ph.symbol === symbol);
          
          // 3. 如果数据足够，生成MA Crossover信号
          let maCrossoverSignal: StrategySignal | null = null;
          let statusMsg = '';
          
          if (symbolPriceHistory) {
            const dataPoints = symbolPriceHistory.prices.length;
            const minDataNeeded = Math.max(paperTradingConfig.shortMaPeriod || 5, paperTradingConfig.longMaPeriod || 10);
            
            if (dataPoints < minDataNeeded) {
              statusMsg = `Waiting for enough price history (${dataPoints}/${minDataNeeded} points)`;
            } else {
              maCrossoverSignal = generateMACrossoverSignal(
                symbol, 
                sharesPerTrade, 
                symbolPriceHistory,
                paperTradingConfig.shortMaPeriod || 5,
                paperTradingConfig.longMaPeriod || 10
              );
              
              if (maCrossoverSignal) {
                statusMsg = `MA Crossover: ${maCrossoverSignal.action === 'BUY' ? 'Golden Cross' : 'Death Cross'} detected`;
              } else {
                statusMsg = 'MA Crossover: No crossover detected';
              }
            }
          } else {
            statusMsg = 'No price history available for symbol';
          }
          
          // 4. 更新价格历史状态
          setPriceHistory(updatedPriceHistory);
          
          // 5. 更新策略状态
          setStrategyStatus(statusMsg);
          
          // 6. 如果有信号，执行交易
          if (maCrossoverSignal) {
            handleStrategySignalWrapper(maCrossoverSignal);
          }
        }
      }, paperTradingConfig.intervalSeconds * 1000);
    }
    
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
    // The timer is rebuilt from the persisted configuration and position set.
    // Price history and signal handlers are read inside the scheduled cycle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paperTradingConfig, portfolio.positions]);

  const positionsColumns = [
    {
      title: 'Symbol',
      dataIndex: 'symbol',
      key: 'symbol',
      align: 'left' as const,
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: 'Sector',
      dataIndex: 'sector',
      key: 'sector',
      align: 'left' as const,
      render: (text: string) => <Tag color="blue">{text}</Tag>,
    },
    {
      title: 'Shares',
      dataIndex: 'shares',
      key: 'shares',
      align: 'center' as const,
    },
    {
      title: 'Avg Price',
      dataIndex: 'avgPrice',
      key: 'avgPrice',
      align: 'right' as const,
      render: (value: number) => `$${value.toFixed(2)}`,
    },
    {
      title: 'Current Price',
      dataIndex: 'currentPrice',
      key: 'currentPrice',
      align: 'right' as const,
      render: (value: number) => `$${value.toFixed(2)}`,
    },
    {
      title: 'Market Value',
      dataIndex: 'marketValue',
      key: 'marketValue',
      align: 'right' as const,
      render: (value: number) => `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    },
    {
      title: 'P&L',
      dataIndex: 'pnl',
      key: 'pnl',
      align: 'right' as const,
      render: (value: number, record: any) => (
        <Text style={{ color: value >= 0 ? '#3f8600' : '#cf1322' }}>
          {value >= 0 ? '+' : ''}${value.toFixed(2)} ({record.pnlPercentage >= 0 ? '+' : ''}{record.pnlPercentage.toFixed(1)}%)
        </Text>
      ),
    },
  ];

  const tradesColumns = [
    {
      title: 'Action',
      dataIndex: 'action',
      key: 'action',
      width: 80,
      render: (text: string, record: any) => (
        <Tag 
          color={text === 'BUY' ? 'success' : 'error'}
          style={{ 
            fontWeight: 'bold',
            minWidth: '60px',
            textAlign: 'center'
          }}
        >
          {text}
        </Tag>
      ),
    },
    {
      title: 'Symbol',
      dataIndex: 'symbol',
      key: 'symbol',
      width: 80,
    },
    {
      title: 'Shares',
      dataIndex: 'shares',
      key: 'shares',
      align: 'right' as const,
      width: 70,
    },
    {
      title: 'Market Price',
      dataIndex: 'marketPrice',
      key: 'marketPrice',
      align: 'right' as const,
      width: 100,
      render: (value: number | undefined) => 
        value ? `$${value.toFixed(2)}` : '—',
    },
    {
      title: 'Executed Price',
      dataIndex: 'price',
      key: 'price',
      align: 'right' as const,
      width: 110,
      render: (value: number, record: any) => {
        const hasSlippage = record.slippageAmount && Math.abs(record.slippageAmount) > 0.001;
        return (
          <div>
            <div style={{ fontWeight: 'bold' }}>${value.toFixed(2)}</div>
            {hasSlippage && (
              <div style={{ fontSize: '10px', color: record.slippageAmount > 0 ? '#cf1322' : '#3f8600' }}>
                {record.slippageAmount > 0 ? '+' : ''}{record.slippageAmount.toFixed(2)}
              </div>
            )}
          </div>
        );
      },
    },
    {
      title: 'Commission',
      dataIndex: 'commission',
      key: 'commission',
      align: 'right' as const,
      width: 90,
      render: (value: number | undefined) => 
        value !== undefined ? `$${value.toFixed(2)}` : '—',
    },
    {
      title: 'Total',
      dataIndex: 'totalCost',
      key: 'totalCost',
      align: 'right' as const,
      width: 100,
      render: (value: number, record: any) => {
        if (value === undefined || value === null) {
          return <Text type="secondary">—</Text>;
        }
        const isBuy = record.action === 'BUY';
        return (
          <div>
            <div style={{ fontWeight: 'bold' }}>${value.toFixed(2)}</div>
            <div style={{ fontSize: '10px', color: isBuy ? '#cf1322' : '#3f8600' }}>
              {isBuy ? 'Cost' : 'Revenue'}
            </div>
          </div>
        );
      },
    },
    {
      title: 'Date',
      dataIndex: 'date',
      key: 'date',
      width: 100,
    },
    {
      title: 'Source',
      dataIndex: 'source',
      key: 'source',
      width: 120,
      render: (text: 'DEMO_BUTTON' | 'MANUAL_ORDER' | 'STRATEGY_SIGNAL') => {
        const sourceConfig = {
          'DEMO_BUTTON': { color: 'blue', label: 'Demo Button' },
          'MANUAL_ORDER': { color: 'purple', label: 'Manual Order' },
          'STRATEGY_SIGNAL': { color: 'green', label: 'Strategy Signal' },
        };
        
        const config = sourceConfig[text] || { color: 'default', label: text };
        
        return (
          <Tag 
            color={config.color}
            style={{ 
              fontWeight: 'bold',
              fontSize: '11px'
            }}
          >
            {config.label}
          </Tag>
        );
      },
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      {/* 页面标题 */}
      <div style={{ marginBottom: '24px' }}>
        <Title level={2}>
          <PieChartOutlined style={{ marginRight: '12px' }} />
          Local Paper Trading
        </Title>
        <Text type="secondary">Paper trading simulation with local strategies and manual orders</Text>
      </div>

      {/* Summary Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Total Equity"
              value={totalEquity}
              prefix={<DollarOutlined />}
              valueStyle={{ color: '#1890ff' }}
              formatter={(value) => `$${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            />
            <Text type="secondary">Total account value</Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Cash"
              value={portfolio.cash}
              prefix={<WalletOutlined />}
              valueStyle={{ color: '#52c41a' }}
              formatter={(value) => `$${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            />
            <Text type="secondary">Available for trading</Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Market Value"
              value={marketValue}
              prefix={<LineChartOutlined />}
              valueStyle={{ color: '#faad14' }}
              formatter={(value) => `$${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            />
            <Text type="secondary">Current positions value</Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Total P&L"
              value={totalPnL}
              prefix={totalPnL >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
              valueStyle={{ color: totalPnL >= 0 ? '#3f8600' : '#cf1322' }}
              suffix={` (${totalPnL >= 0 ? '+' : ''}${pnlPercentage.toFixed(2)}%)`}
              formatter={(value) => `$${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            />
            <Text type="secondary">Total profit & loss</Text>
          </Card>
        </Col>
      </Row>

      {/* Equity Curve Chart */}
      {equityHistory.length > 0 && (() => {
        // 只取最近50个数据点
        const recentHistory = equityHistory.slice(0, 50);
        const chartData = recentHistory.slice().reverse(); // 反转数据，让最新的在右边
        
        // 计算Y轴动态范围
        const equityValues = recentHistory.map(h => h.equity);
        const minEquity = Math.min(...equityValues);
        const maxEquity = Math.max(...equityValues);
        const range = maxEquity - minEquity;
        const padding = range * 0.1; // 10%的padding
        
        // 计算统计信息
        const latestEquity = recentHistory[0]?.equity || 0;
        const highEquity = maxEquity;
        const lowEquity = minEquity;
        
        return (
          <Card style={{ marginBottom: '24px' }}>
            <Title level={4}>Equity Curve</Title>
            <Text type="secondary" style={{ display: 'block', marginBottom: '16px' }}>
              Portfolio value over time (last {recentHistory.length} data points)
            </Text>
            <div style={{ width: '100%', height: '300px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={chartData}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis 
                    dataKey="time" 
                    tickFormatter={(value) => {
                      // 格式化时间显示，只显示时分秒
                      const date = new Date(value);
                      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                    }}
                    stroke="#666"
                  />
                  <YAxis 
                    stroke="#666"
                    domain={[minEquity - padding, maxEquity + padding]}
                    tickFormatter={(value) => `$${value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
                  />
                  <Tooltip 
                    formatter={(value: number) => [`$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 'Equity']}
                    labelFormatter={(label) => {
                      const date = new Date(label);
                      return date.toLocaleString([], { 
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                      });
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="equity"
                    stroke="#1890ff"
                    strokeWidth={2}
                    dot={{ r: 2 }}
                    activeDot={{ 
                      r: 6,
                      fill: '#ff4d4f',
                      stroke: '#ff4d4f',
                      strokeWidth: 2
                    }}
                    name="Portfolio Equity"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div style={{ marginTop: '16px', fontSize: '12px', color: '#8c8c8c' }}>
              <Text type="secondary">
                <strong>Latest:</strong> ${latestEquity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} | 
                <strong> High:</strong> ${highEquity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} | 
                <strong> Low:</strong> ${lowEquity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} | 
                <strong> Range:</strong> ${range.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Text>
            </div>
          </Card>
        );
      })()}

      {/* Demo Actions */}
      <Card style={{ marginBottom: '24px', backgroundColor: '#f6ffed' }}>
        <Title level={4}>Demo Actions</Title>
        <Text type="secondary" style={{ display: 'block', marginBottom: '16px' }}>
          Test portfolio interactions: buttons update cash, positions, and trades in real-time. 
          This is a demo only - no real trading occurs.
        </Text>
        <Row gutter={[8, 8]}>
          <Col>
            <Button 
              type="primary" 
              icon={<PlusOutlined />}
              onClick={() => executeTrade({ action: 'BUY', symbol: 'AAPL', price: 172.50, shares: 5 }, 'DEMO_BUTTON')}
            >
              Buy AAPL 5
            </Button>
          </Col>
          <Col>
            <Button 
              type="default" 
              icon={<MinusOutlined />}
              onClick={() => executeTrade({ action: 'SELL', symbol: 'AAPL', price: 172.50, shares: 2 }, 'DEMO_BUTTON')}
            >
              Sell AAPL 2
            </Button>
          </Col>
          <Col>
            <Button 
              type="primary" 
              icon={<PlusOutlined />}
              onClick={() => executeTrade({ action: 'BUY', symbol: 'NVDA', price: 512.80, shares: 3 }, 'DEMO_BUTTON')}
            >
              Buy NVDA 3
            </Button>
          </Col>
          <Col>
            <Button 
              type="default" 
              icon={<MinusOutlined />}
              onClick={() => executeTrade({ action: 'SELL', symbol: 'TSLA', price: 195.20, shares: 1 }, 'DEMO_BUTTON')}
            >
              Sell TSLA 1
            </Button>
          </Col>
          <Col>
            <Button 
              type="primary" 
              icon={<PlusOutlined />}
              onClick={() => executeTrade({ action: 'BUY', symbol: 'MSFT', price: 415.25, shares: 10 }, 'DEMO_BUTTON')}
            >
              Buy MSFT 10
            </Button>
          </Col>
          <Col>
            <Button 
              type="default" 
              danger
              onClick={() => {
                const totalCost = 415.25 * 100;
                if (totalCost > portfolio.cash) {
                  message.error(`Test: Cannot buy 100 MSFT - need $${totalCost.toFixed(2)}, have $${portfolio.cash.toFixed(2)}`);
                } else {
                  message.info(`Test: Would buy 100 MSFT for $${totalCost.toFixed(2)} (cash sufficient)`);
                }
              }}
            >
              Test Cash Limit
            </Button>
          </Col>
          <Col>
            <Popconfirm
              title="Reset demo portfolio?"
              description="This will restore all values to initial demo state."
              onConfirm={() => {
                setPortfolio(DEFAULT_PORTFOLIO);
                // 同时重置Manual Order表单
                setManualOrder({
                  symbol: 'AAPL',
                  shares: 1,
                  action: 'BUY',
                });
                // 重置Paper Trading配置
                setPaperTradingConfig(DEFAULT_PAPER_TRADING_CONFIG);
                // 清空equity history
                setEquityHistory([]);
                message.success('Portfolio reset to initial demo state');
              }}
              okText="Reset"
              cancelText="Cancel"
            >
              <Button 
                type="default" 
                icon={<ReloadOutlined />}
              >
                Reset Demo
              </Button>
            </Popconfirm>
          </Col>
        </Row>
      </Card>

      {/* Manual Order Panel */}
      <Card style={{ marginBottom: '24px', backgroundColor: '#f0f5ff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <Title level={4}>Manual Order</Title>
          <Button 
            type={priceSimulationPaused ? 'primary' : 'default'}
            size="small"
            onClick={() => setPriceSimulationPaused(!priceSimulationPaused)}
          >
            {priceSimulationPaused ? '▶ Resume Price Simulation' : '⏸ Pause Price Simulation'}
          </Button>
        </div>
        <Text type="secondary" style={{ display: 'block', marginBottom: '8px' }}>
          Place custom buy/sell orders. <Tag color="blue" style={{ fontSize: '12px' }}>Live Simulated Price</Tag>
          {priceSimulationPaused && <Tag color="orange" style={{ fontSize: '12px', marginLeft: '8px' }}>Paused</Tag>}
        </Text>
        <Text type="secondary" style={{ display: 'block', marginBottom: '16px', fontSize: '12px' }}>
          Prices update automatically every 2 seconds. {priceSimulationPaused ? '(Currently paused)' : ''}
        </Text>
        
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={8}>
            <div style={{ marginBottom: '8px' }}>
              <Text strong>Symbol</Text>
            </div>
            <Select
              style={{ width: '100%' }}
              placeholder="Select stock"
              value={manualOrder.symbol}
              onChange={(value) => {
                setManualOrder(prev => ({
                  ...prev,
                  symbol: value
                }));
              }}
            >
              <Select.Option value="AAPL">AAPL (Apple)</Select.Option>
              <Select.Option value="TSLA">TSLA (Tesla)</Select.Option>
              <Select.Option value="NVDA">NVDA (Nvidia)</Select.Option>
              <Select.Option value="GOOGL">GOOGL (Google)</Select.Option>
              <Select.Option value="JPM">JPM (JPMorgan)</Select.Option>
              <Select.Option value="MSFT">MSFT (Microsoft)</Select.Option>
            </Select>
          </Col>
          
          <Col xs={24} sm={8}>
            <div style={{ marginBottom: '8px' }}>
              <Text strong>Shares</Text>
            </div>
            <InputNumber
              min={1}
              style={{ width: '100%' }}
              placeholder="Enter shares"
              value={manualOrder.shares}
              onChange={(value) => {
                if (value !== null && value > 0) {
                  setManualOrder(prev => ({
                    ...prev,
                    shares: value
                  }));
                }
              }}
            />
          </Col>
          
          <Col xs={24} sm={8}>
            <div style={{ marginBottom: '8px' }}>
              <Text strong>Action</Text>
            </div>
            <Radio.Group 
              style={{ width: '100%' }}
              value={manualOrder.action}
              onChange={(e) => {
                setManualOrder(prev => ({
                  ...prev,
                  action: e.target.value
                }));
              }}
            >
              <Radio.Button value="BUY" style={{ width: '50%', textAlign: 'center' }}>BUY</Radio.Button>
              <Radio.Button value="SELL" style={{ width: '50%', textAlign: 'center' }}>SELL</Radio.Button>
            </Radio.Group>
          </Col>
        </Row>
        
        {/* 价格信息显示 */}
        <Row style={{ marginTop: '16px', marginBottom: '8px' }}>
          <Col span={24}>
            <div style={{ 
              backgroundColor: '#fafafa', 
              padding: '12px', 
              borderRadius: '4px',
              border: '1px solid #f0f0f0'
            }}>
              {/* 第一行：价格和成本信息 */}
              <Row gutter={[8, 8]} style={{ marginBottom: '12px' }}>
                <Col span={12}>
                  <Text type="secondary">Current Price:</Text>
                  <div>
                    <Text strong style={{ fontSize: '16px' }}>
                      {(() => {
                        const currentPrice = getLatestPrice(manualOrder.symbol);
                        return currentPrice === null ? 'N/A' : `$${currentPrice.toFixed(2)}`;
                      })()}
                    </Text>
                  </div>
                </Col>
                <Col span={12}>
                  <Text type="secondary">Estimated {manualOrder.action === 'BUY' ? 'Cost' : 'Proceeds'}:</Text>
                  <div>
                    <Text strong style={{ 
                      fontSize: '16px',
                      color: manualOrder.action === 'BUY' ? '#cf1322' : '#3f8600'
                    }}>
                      {(() => {
                        const currentPrice = getLatestPrice(manualOrder.symbol);
                        return currentPrice === null ? 'N/A' : `$${(currentPrice * manualOrder.shares).toFixed(2)}`;
                      })()}
                    </Text>
                  </div>
                </Col>
              </Row>
              
              {/* 第二行：持仓和现金信息 */}
              <Row gutter={[8, 8]}>
                <Col span={12}>
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    {(() => {
                      const position = portfolio.positions.find(p => p.symbol === manualOrder.symbol);
                      if (position) {
                        return `Available to Sell: ${position.shares} shares`;
                      } else {
                        return 'No current position';
                      }
                    })()}
                  </Text>
                </Col>
                <Col span={12}>
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    {(() => {
                      const currentPrice = getLatestPrice(manualOrder.symbol);
                      if (currentPrice === null) {
                        return 'Price data not available';
                      }
                      const orderValue = currentPrice * manualOrder.shares;
                      const cashAfterOrder = manualOrder.action === 'BUY' 
                        ? portfolio.cash - orderValue
                        : portfolio.cash + orderValue;
                      
                      return `Cash ${manualOrder.action === 'BUY' ? 'After Order' : 'After Sell'}: $${cashAfterOrder.toFixed(2)}`;
                    })()}
                  </Text>
                </Col>
              </Row>
              
              {/* 第三行：SELL超量提示 */}
              {manualOrder.action === 'SELL' && (() => {
                const position = portfolio.positions.find(p => p.symbol === manualOrder.symbol);
                if (position && manualOrder.shares > position.shares) {
                  return (
                    <Row style={{ marginTop: '8px' }}>
                      <Col span={24}>
                        <Text type="danger" style={{ fontSize: '12px', fontWeight: 'bold' }}>
                          ⚠️ Exceeds available position (have {position.shares} shares)
                        </Text>
                      </Col>
                    </Row>
                  );
                }
                return null;
              })()}
            </div>
          </Col>
        </Row>
        
        <Row style={{ marginTop: '8px' }}>
          <Col span={24}>
            <Button 
              type="primary" 
              size="large"
              style={{ width: '100%' }}
              disabled={(() => {
                if (!manualOrder.symbol || manualOrder.shares <= 0) {
                  return true;
                }
                
                // 检查是否有价格数据
                const currentPrice = getLatestPrice(manualOrder.symbol);
                if (currentPrice === null) {
                  return true;
                }
                
                // SELL时检查是否超持仓
                if (manualOrder.action === 'SELL') {
                  const position = portfolio.positions.find(p => p.symbol === manualOrder.symbol);
                  if (!position || manualOrder.shares > position.shares) {
                    return true;
                  }
                }
                
                return false;
              })()}
              onClick={() => {
                // 获取当前价格（使用统一的价格源）
                const currentPrice = getLatestPrice(manualOrder.symbol);
                
                // 这里currentPrice不会为null，因为按钮已经做了检查
                // 但为了类型安全，还是加上检查
                if (currentPrice === null) {
                  message.error('Price data not available');
                  return;
                }
                
                // 执行交易
                const success = executeTrade({
                  action: manualOrder.action,
                  symbol: manualOrder.symbol,
                  price: currentPrice,
                  shares: manualOrder.shares,
                }, 'MANUAL_ORDER');
                
                if (success) {
                  // 下单成功后，重置shares为1，保持其他字段不变
                  setManualOrder(prev => ({
                    ...prev,
                    shares: 1
                  }));
                }
              }}
            >
              Place Order
            </Button>
          </Col>
        </Row>
        
        <Row style={{ marginTop: '8px' }}>
          <Col span={24}>
            <Text type="secondary" style={{ fontSize: '12px' }}>
              Note: Orders use current market price. Cash and position validation applied.
            </Text>
          </Col>
        </Row>
      </Card>

      {/* Paper Trading Control Panel */}
      <Card style={{ marginBottom: '24px', backgroundColor: '#f6ffed' }}>
        <Title level={4}>Paper Trading Control Panel</Title>
        <Text type="secondary" style={{ display: 'block', marginBottom: '16px' }}>
          Start automated paper trading with random signals. This is a local simulation - no real trading occurs.
        </Text>
        
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={8}>
            <div style={{ marginBottom: '8px' }}>
              <Text strong>Selected Symbol</Text>
            </div>
            <Select
              style={{ width: '100%' }}
              value={paperTradingConfig.selectedSymbol}
              onChange={(value) => {
                setPaperTradingConfig(prev => ({
                  ...prev,
                  selectedSymbol: value
                }));
              }}
              disabled={paperTradingConfig.status === 'RUNNING'}
            >
              <Select.Option value="AAPL">AAPL (Apple)</Select.Option>
              <Select.Option value="TSLA">TSLA (Tesla)</Select.Option>
              <Select.Option value="NVDA">NVDA (Nvidia)</Select.Option>
              <Select.Option value="GOOGL">GOOGL (Google)</Select.Option>
              <Select.Option value="JPM">JPM (JPMorgan)</Select.Option>
              <Select.Option value="MSFT">MSFT (Microsoft)</Select.Option>
            </Select>
          </Col>
          
          <Col xs={24} sm={8}>
            <div style={{ marginBottom: '8px' }}>
              <Text strong>Shares Per Trade</Text>
            </div>
            <InputNumber
              min={1}
              max={100}
              style={{ width: '100%' }}
              value={paperTradingConfig.sharesPerTrade}
              onChange={(value) => {
                if (value !== null && value > 0) {
                  setPaperTradingConfig(prev => ({
                    ...prev,
                    sharesPerTrade: value
                  }));
                }
              }}
              disabled={paperTradingConfig.status === 'RUNNING'}
            />
          </Col>
          
          <Col xs={24} sm={8}>
            <div style={{ marginBottom: '8px' }}>
              <Text strong>Interval (seconds)</Text>
            </div>
            <InputNumber
              min={1}
              max={60}
              style={{ width: '100%' }}
              value={paperTradingConfig.intervalSeconds}
              onChange={(value) => {
                if (value !== null && value >= 1) {
                  setPaperTradingConfig(prev => ({
                    ...prev,
                    intervalSeconds: value
                  }));
                }
              }}
              disabled={paperTradingConfig.status === 'RUNNING'}
            />
          </Col>
        </Row>
        
        <Row gutter={[16, 16]} style={{ marginTop: '16px' }}>
          <Col xs={24} sm={8}>
            <div style={{ marginBottom: '8px' }}>
              <Text strong>Slippage (%)</Text>
              <Text type="secondary" style={{ fontSize: '12px', marginLeft: '8px' }}>
                (默认: 0.10)
              </Text>
            </div>
            <InputNumber
              min={0}
              max={5}
              step={0.01}
              style={{ width: '100%' }}
              value={paperTradingConfig.slippageRate ? paperTradingConfig.slippageRate * 100 : 0.10}
              onChange={(value) => {
                if (value !== null && value >= 0) {
                  setPaperTradingConfig(prev => ({
                    ...prev,
                    slippageRate: value / 100 // 转换为小数
                  }));
                }
              }}
              disabled={paperTradingConfig.status === 'RUNNING'}
              formatter={(value) => `${value}%`}
              parser={(value) => parseFloat(value!.replace('%', '')) || 0}
            />
          </Col>
          <Col xs={24} sm={8}>
            <div style={{ marginBottom: '8px' }}>
              <Text strong>Commission ($)</Text>
              <Text type="secondary" style={{ fontSize: '12px', marginLeft: '8px' }}>
                (默认: 1.00)
              </Text>
            </div>
            <InputNumber
              min={0}
              max={20}
              step={0.01}
              style={{ width: '100%' }}
              value={paperTradingConfig.commission || 1.00}
              onChange={(value) => {
                if (value !== null && value >= 0) {
                  setPaperTradingConfig(prev => ({
                    ...prev,
                    commission: value
                  }));
                }
              }}
              disabled={paperTradingConfig.status === 'RUNNING'}
              formatter={(value) => `$${value}`}
              parser={(value) => parseFloat(value!.replace('$', '')) || 0}
            />
          </Col>
          <Col xs={24} sm={8}>
            <div style={{ 
              backgroundColor: '#f0f5ff', 
              padding: '8px 12px', 
              borderRadius: '4px',
              border: '1px solid #d6e4ff',
              fontSize: '12px',
              marginTop: '28px'
            }}>
              <Text type="secondary">
                <strong>交易成本模拟:</strong> 滑点 + 手续费。例如$1.00手续费时，BUY成本增加$1.00，SELL收入减少$1.00
              </Text>
            </div>
          </Col>
        </Row>
        
        <Row gutter={[16, 16]} style={{ marginTop: '16px' }}>
          <Col xs={24} sm={12}>
            <div style={{ marginBottom: '8px' }}>
              <Text strong>Mode / Strategy</Text>
            </div>
            <Select
              style={{ width: '100%' }}
              value={paperTradingConfig.mode}
              onChange={(value) => {
                setPaperTradingConfig(prev => ({
                  ...prev,
                  mode: value as 'DEMO_STRATEGY' | 'RANDOM_SIGNAL' | 'SMA_STRATEGY' | 'MA_CROSSOVER'
                }));
              }}
              disabled={paperTradingConfig.status === 'RUNNING'}
            >
              <Select.Option value="RANDOM_SIGNAL">Random Signal</Select.Option>
              <Select.Option value="SMA_STRATEGY">SMA Strategy (5-period)</Select.Option>
              <Select.Option value="MA_CROSSOVER">MA Crossover Strategy</Select.Option>
              <Select.Option value="DEMO_STRATEGY">Demo Strategy</Select.Option>
            </Select>
          </Col>
          
          <Col xs={24} sm={12}>
            <div style={{ marginBottom: '8px' }}>
              <Text strong>Status</Text>
            </div>
            <div style={{ 
              padding: '8px 12px', 
              backgroundColor: paperTradingConfig.status === 'RUNNING' ? '#f6ffed' : '#fff2f0',
              border: `1px solid ${paperTradingConfig.status === 'RUNNING' ? '#b7eb8f' : '#ffccc7'}`,
              borderRadius: '4px',
              textAlign: 'center'
            }}>
              <Text strong style={{ 
                color: paperTradingConfig.status === 'RUNNING' ? '#52c41a' : '#ff4d4f'
              }}>
                {paperTradingConfig.status === 'RUNNING' ? 'RUNNING' : 'STOPPED'}
              </Text>
            </div>
          </Col>
        </Row>
        
        {/* MA Crossover参数（仅在MA_CROSSOVER模式下显示） */}
        {paperTradingConfig.mode === 'MA_CROSSOVER' && (
          <>
            {/* MA Crossover Presets */}
            <Row gutter={[8, 8]} style={{ marginTop: '16px' }}>
              <Col span={24}>
                <div style={{ marginBottom: '8px' }}>
                  <Text strong>MA Crossover Presets</Text>
                  <Text type="secondary" style={{ fontSize: '12px', marginLeft: '8px' }}>
                    (快速切换常用参数组合)
                  </Text>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  <Button
                    size="small"
                    type={paperTradingConfig.shortMaPeriod === 5 && paperTradingConfig.longMaPeriod === 10 ? 'primary' : 'default'}
                    onClick={() => {
                      setPaperTradingConfig(prev => ({
                        ...prev,
                        shortMaPeriod: 5,
                        longMaPeriod: 10
                      }));
                      message.info('Fast preset applied: Short 5 / Long 10');
                    }}
                    disabled={paperTradingConfig.status === 'RUNNING'}
                  >
                    Fast: 5/10
                  </Button>
                  <Button
                    size="small"
                    type={paperTradingConfig.shortMaPeriod === 10 && paperTradingConfig.longMaPeriod === 20 ? 'primary' : 'default'}
                    onClick={() => {
                      setPaperTradingConfig(prev => ({
                        ...prev,
                        shortMaPeriod: 10,
                        longMaPeriod: 20
                      }));
                      message.info('Medium preset applied: Short 10 / Long 20');
                    }}
                    disabled={paperTradingConfig.status === 'RUNNING'}
                  >
                    Medium: 10/20
                  </Button>
                  <Button
                    size="small"
                    type={paperTradingConfig.shortMaPeriod === 20 && paperTradingConfig.longMaPeriod === 50 ? 'primary' : 'default'}
                    onClick={() => {
                      setPaperTradingConfig(prev => ({
                        ...prev,
                        shortMaPeriod: 20,
                        longMaPeriod: 50
                      }));
                      message.info('Slow preset applied: Short 20 / Long 50');
                    }}
                    disabled={paperTradingConfig.status === 'RUNNING'}
                  >
                    Slow: 20/50
                  </Button>
                  <Button
                    size="small"
                    type={
                      !(paperTradingConfig.shortMaPeriod === 5 && paperTradingConfig.longMaPeriod === 10) &&
                      !(paperTradingConfig.shortMaPeriod === 10 && paperTradingConfig.longMaPeriod === 20) &&
                      !(paperTradingConfig.shortMaPeriod === 20 && paperTradingConfig.longMaPeriod === 50)
                        ? 'primary'
                        : 'default'
                    }
                    onClick={() => {
                      // Custom 按钮点击时不清除参数，只是标记为自定义
                      message.info('Using custom parameters');
                    }}
                    disabled={paperTradingConfig.status === 'RUNNING'}
                  >
                    Custom
                  </Button>
                </div>
                <div style={{ marginTop: '8px' }}>
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    Current: {(() => {
                      const short = paperTradingConfig.shortMaPeriod || 5;
                      const long = paperTradingConfig.longMaPeriod || 10;
                      
                      if (short === 5 && long === 10) return 'Fast (5/10)';
                      if (short === 10 && long === 20) return 'Medium (10/20)';
                      if (short === 20 && long === 50) return 'Slow (20/50)';
                      return `Custom (${short}/${long})`;
                    })()}
                  </Text>
                </div>
              </Col>
            </Row>
            
            {/* Batch Experiment Runner */}
            <Row gutter={[8, 8]} style={{ marginTop: '16px' }}>
              <Col span={24}>
                <div style={{ marginBottom: '8px' }}>
                  <Text strong>Batch Experiment Runner</Text>
                  <Text type="secondary" style={{ fontSize: '12px', marginLeft: '8px' }}>
                    (自动顺序测试所有预设)
                  </Text>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                  <Button
                    size="small"
                    type="primary"
                    icon={<PlayCircleOutlined />}
                    onClick={() => {
                      // 检查是否已经在运行
                      if (paperTradingConfig.status === 'RUNNING') {
                        message.warning('Please stop current paper trading first');
                        return;
                      }
                      
                      // 清理定时器和保存标记
                      clearBatchTimer();
                      savedBatchIndexRef.current = null;
                      
                      // 设置 batch 状态
                      setBatchRunning(true);
                      setCurrentBatchIndex(0);
                      setBatchStatus('Starting batch experiment...');
                      message.info('Batch experiment started');
                    }}
                    disabled={paperTradingConfig.status === 'RUNNING' || batchRunning}
                  >
                    Run Preset Sequence
                  </Button>
                  
                  <Button
                    size="small"
                    type="default"
                    danger
                    onClick={() => {
                      // 清理定时器
                      clearBatchTimer();
                      
                      // 停止当前 paper trading（如果正在运行）
                      if (paperTradingConfig.status === 'RUNNING') {
                        setPaperTradingConfig(prev => ({
                          ...prev,
                          status: 'STOPPED'
                        }));
                      }
                      
                      // 重置 batch 状态
                      setBatchRunning(false);
                      setCurrentBatchIndex(-1);
                      setBatchStatus('');
                      savedBatchIndexRef.current = null;
                      message.info('Batch experiment cancelled');
                    }}
                    disabled={!batchRunning}
                  >
                    Cancel Batch
                  </Button>
                  
                  {batchRunning && (
                    <div style={{ marginLeft: '8px' }}>
                      <Text type="secondary" style={{ fontSize: '12px' }}>
                        {batchStatus}
                      </Text>
                    </div>
                  )}
                </div>
              </Col>
            </Row>
            
            {/* MA Crossover 参数输入 */}
            <Row gutter={[16, 16]} style={{ marginTop: '16px' }}>
              <Col xs={24} sm={12}>
                <div style={{ marginBottom: '8px' }}>
                  <Text strong>Short MA Period</Text>
                  <Text type="secondary" style={{ fontSize: '12px', marginLeft: '8px' }}>
                    (默认: 5)
                  </Text>
                </div>
                <InputNumber
                  min={2}
                  max={50}
                  style={{ width: '100%' }}
                  value={paperTradingConfig.shortMaPeriod || 5}
                  onChange={(value) => {
                    if (value !== null && value >= 2) {
                      // 确保short < long
                      const longPeriod = paperTradingConfig.longMaPeriod || 10;
                      if (value < longPeriod) {
                        setPaperTradingConfig(prev => ({
                          ...prev,
                          shortMaPeriod: value
                        }));
                      } else {
                        // 如果short >= long，自动调整long为short+1
                        setPaperTradingConfig(prev => ({
                          ...prev,
                          shortMaPeriod: value,
                          longMaPeriod: value + 1
                        }));
                        message.warning(`Long MA Period adjusted to ${value + 1} (must be > Short MA Period)`);
                      }
                    }
                  }}
                  disabled={paperTradingConfig.status === 'RUNNING'}
                />
              </Col>
              <Col xs={24} sm={12}>
                <div style={{ marginBottom: '8px' }}>
                  <Text strong>Long MA Period</Text>
                  <Text type="secondary" style={{ fontSize: '12px', marginLeft: '8px' }}>
                    (默认: 10)
                  </Text>
                </div>
                <InputNumber
                  min={3}
                  max={100}
                  style={{ width: '100%' }}
                  value={paperTradingConfig.longMaPeriod || 10}
                  onChange={(value) => {
                    if (value !== null && value >= 3) {
                      // 确保long > short
                      const shortPeriod = paperTradingConfig.shortMaPeriod || 5;
                      if (value > shortPeriod) {
                        setPaperTradingConfig(prev => ({
                          ...prev,
                          longMaPeriod: value
                        }));
                      } else {
                        // 如果long <= short，自动调整short为long-1
                        setPaperTradingConfig(prev => ({
                          ...prev,
                          longMaPeriod: value,
                          shortMaPeriod: Math.max(2, value - 1)
                        }));
                        message.warning(`Short MA Period adjusted to ${Math.max(2, value - 1)} (must be < Long MA Period)`);
                      }
                    }
                  }}
                  disabled={paperTradingConfig.status === 'RUNNING'}
                />
              </Col>
            </Row>
          </>
        )}
        
        <Row gutter={[16, 16]} style={{ marginTop: '24px' }}>
          <Col xs={24} sm={8}>
            <Button 
              type="default"
              icon={<FolderOpenOutlined />}
              style={{ width: '100%' }}
              onClick={() => {
                // 加载Backtest参数
                try {
                  const savedParams = user?.id
                    ? localStorage.getItem(`quant_last_backtest_params:${user.id}`)
                    : null;
                  if (!savedParams) {
                    message.info('No backtest parameters found. Run a backtest first.');
                    return;
                  }
                  
                  const params = JSON.parse(savedParams);
                  if (params.strategy !== 'MA_CROSSOVER') {
                    message.info('Only MA Crossover parameters can be loaded');
                    return;
                  }
                  
                  // 更新Paper Trading配置
                  setPaperTradingConfig(prev => ({
                    ...prev,
                    mode: 'MA_CROSSOVER',
                    selectedSymbol: params.symbol || prev.selectedSymbol,
                    shortMaPeriod: params.shortMaPeriod || 20,
                    longMaPeriod: params.longMaPeriod || 50
                  }));
                  
                  const statusMsg = `Loaded from Backtest: Short ${params.shortMaPeriod || 20} / Long ${params.longMaPeriod || 50}`;
                  setStrategyStatus(statusMsg);
                  message.success(statusMsg);
                } catch (error) {
                  console.error('Failed to load backtest parameters:', error);
                  message.error('Failed to load backtest parameters');
                }
              }}
              disabled={paperTradingConfig.status === 'RUNNING'}
            >
              Load From Backtest
            </Button>
          </Col>
          
          <Col xs={24} sm={8}>
            <Button 
              type="primary"
              icon={<PlayCircleOutlined />}
              style={{ width: '100%' }}
              onClick={() => {
                // 对于MA Crossover策略，检查参数有效性
                if (paperTradingConfig.mode === 'MA_CROSSOVER') {
                  const shortPeriod = paperTradingConfig.shortMaPeriod || 5;
                  const longPeriod = paperTradingConfig.longMaPeriod || 10;
                  
                  if (shortPeriod >= longPeriod) {
                    message.error('Short MA Period must be less than Long MA Period');
                    return;
                  }
                }
                
                setPaperTradingConfig(prev => ({
                  ...prev,
                  status: 'RUNNING'
                }));
                
                // 初始化Paper Trading Session
                setPaperTradingSession({
                  isActive: true,
                  startTime: new Date().toISOString(),
                  endTime: null,
                  startEquity: totalEquity,
                  endEquity: 0,
                  totalTrades: 0,
                  realizedPnL: 0,
                  tradesDuringSession: [],
                });
                
                setStrategyStatus('Paper trading started');
                message.success('Paper trading started');
              }}
              disabled={paperTradingConfig.status === 'RUNNING'}
            >
              Start Paper Trading
            </Button>
          </Col>
          
          <Col xs={24} sm={8}>
            <Button 
              type="default"
              danger
              icon={<PauseCircleOutlined />}
              style={{ width: '100%' }}
              onClick={() => {
                setPaperTradingConfig(prev => ({
                  ...prev,
                  status: 'STOPPED'
                }));
                
                // 结束Paper Trading Session
                const endTime = new Date().toISOString();
                setPaperTradingSession(prev => ({
                  ...prev,
                  isActive: false,
                  endTime: endTime,
                  endEquity: totalEquity,
                }));
                
                // 保存到 Session History（如果session有实际交易）
                if (paperTradingSession.totalTrades > 0 && paperTradingSession.startTime) {
                  // 计算总滑点和手续费
                  const totalSlippage = paperTradingSession.tradesDuringSession.reduce(
                    (sum, trade) => sum + Math.abs(trade.slippageAmount || 0),
                    0
                  );
                  
                  const totalCommission = paperTradingSession.tradesDuringSession.reduce(
                    (sum, trade) => sum + Math.abs(trade.commission || 0),
                    0
                  );
                  
                  // 计算回报率
                  const returnPct = paperTradingSession.startEquity > 0 
                    ? ((totalEquity - paperTradingSession.startEquity) / paperTradingSession.startEquity) * 100 
                    : 0;
                  
                  // 计算持续时间（分钟）
                  const startTime = new Date(paperTradingSession.startTime);
                  const endTimeDate = new Date(endTime);
                  const durationMs = endTimeDate.getTime() - startTime.getTime();
                  const durationMinutes = Math.round(durationMs / (1000 * 60));
                  
                  // 创建历史记录
                  const historyItem: SessionHistoryItem = {
                    id: `session_${Date.now()}`,
                    timestamp: endTime,
                    strategyMode: paperTradingConfig.mode,
                    symbol: paperTradingConfig.selectedSymbol,
                    shortMaPeriod: paperTradingConfig.shortMaPeriod,
                    longMaPeriod: paperTradingConfig.longMaPeriod,
                    slippageRate: paperTradingConfig.slippageRate,
                    commissionRate: paperTradingConfig.commission,
                    startEquity: paperTradingSession.startEquity,
                    endEquity: totalEquity,
                    returnPct: returnPct,
                    totalTrades: paperTradingSession.totalTrades,
                    realizedPnL: paperTradingSession.realizedPnL,
                    totalSlippage: totalSlippage,
                    totalCommission: totalCommission,
                    durationMinutes: durationMinutes,
                  };
                  
                  // 添加到历史记录（最多保留最近10条）
                  setSessionHistory(prev => {
                    const newHistory = [historyItem, ...prev].slice(0, 10);
                    // 保存到localStorage
                    try {
                      if (sessionHistoryStorageKey) localStorage.setItem(sessionHistoryStorageKey, JSON.stringify(newHistory));
                    } catch (error) {
                      console.error('Failed to save session history:', error);
                    }
                    return newHistory;
                  });
                  
                  message.success(`Paper trading stopped. Session saved to history (${paperTradingSession.totalTrades} trades)`);
                } else {
                  message.info('Paper trading stopped (no trades in this session)');
                }
              }}
              disabled={paperTradingConfig.status === 'STOPPED'}
            >
              Stop Paper Trading
            </Button>
          </Col>
        </Row>
        
        {/* 策略状态反馈 */}
        <Row style={{ marginTop: '16px' }}>
          <Col span={24}>
            <div style={{ 
              backgroundColor: '#e6f7ff', 
              padding: '12px', 
              borderRadius: '4px',
              border: '1px solid #91d5ff',
              minHeight: '40px'
            }}>
              <Text type="secondary" style={{ fontSize: '12px' }}>
                <strong>Strategy Status:</strong> {strategyStatus}
              </Text>
            </div>
          </Col>
        </Row>
        
        {/* 交易成本应用提示 */}
        <Row style={{ marginTop: '8px' }}>
          <Col span={24}>
            <div style={{ 
              backgroundColor: '#fff7e6', 
              padding: '8px 12px', 
              borderRadius: '4px',
              border: '1px solid #ffd591',
              fontSize: '12px'
            }}>
              <Text type="secondary">
                <strong>交易成本模拟:</strong> 
                {paperTradingConfig.slippageRate && paperTradingConfig.slippageRate > 0 ? (
                  <span> 滑点 {(paperTradingConfig.slippageRate * 100).toFixed(2)}%</span>
                ) : null}
                {paperTradingConfig.commission && paperTradingConfig.commission > 0 ? (
                  <span> • 手续费 ${paperTradingConfig.commission.toFixed(2)}/笔</span>
                ) : null}
                {(!paperTradingConfig.slippageRate || paperTradingConfig.slippageRate === 0) && 
                 (!paperTradingConfig.commission || paperTradingConfig.commission === 0) ? (
                  <span> 无交易成本</span>
                ) : null}
              </Text>
            </div>
          </Col>
        </Row>
        
        {/* Backtest参数加载提示 */}
        <Row style={{ marginTop: '8px' }}>
          <Col span={24}>
            <div style={{ 
              backgroundColor: '#f6ffed', 
              padding: '8px 12px', 
              borderRadius: '4px',
              border: '1px solid #b7eb8f',
              fontSize: '12px'
            }}>
              <Text type="secondary">
                <strong>Tip:</strong> Run a backtest first, then click "Load From Backtest" to use the same parameters for paper trading.
              </Text>
            </div>
          </Col>
        </Row>
        
        {/* Risk Settings 显示 */}
        <Row style={{ marginTop: '16px' }}>
          <Col span={24}>
            <div style={{ 
              backgroundColor: '#fff7e6', 
              padding: '12px', 
              borderRadius: '4px',
              border: '1px solid #ffd591',
              fontSize: '12px'
            }}>
              <div style={{ marginBottom: '4px' }}>
                <Text strong>Current Risk Settings:</Text>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '8px' }}>
                <div>
                  <Text type="secondary" style={{ fontSize: '11px' }}>Max Position Size:</Text>
                  <div style={{ fontSize: '13px', fontWeight: '500' }}>30% per symbol</div>
                </div>
                <div>
                  <Text type="secondary" style={{ fontSize: '11px' }}>Max Daily Loss:</Text>
                  <div style={{ fontSize: '13px', fontWeight: '500' }}>5% stop</div>
                </div>
                <div>
                  <Text type="secondary" style={{ fontSize: '11px' }}>Cooldown:</Text>
                  <div style={{ fontSize: '13px', fontWeight: '500' }}>30 seconds</div>
                </div>
                <div>
                  <Text type="secondary" style={{ fontSize: '11px' }}>Min Cash Reserve:</Text>
                  <div style={{ fontSize: '13px', fontWeight: '500' }}>10%</div>
                </div>
              </div>
              <div style={{ marginTop: '8px', fontSize: '11px', color: '#8c8c8c' }}>
                <Text type="secondary">These rules help prevent over-trading and excessive risk.</Text>
              </div>
            </div>
          </Col>
        </Row>
      </Card>
        
      {/* Paper Trading Session Summary */}
      <Card 
          title="Paper Trading Session Summary" 
          style={{ marginTop: '24px', backgroundColor: '#fafafa' }}
          extra={
            <Button 
              type="link" 
              size="small"
              onClick={() => {
                // 重置session
                setPaperTradingSession({
                  isActive: false,
                  startTime: null,
                  endTime: null,
                  startEquity: 0,
                  endEquity: 0,
                  totalTrades: 0,
                  realizedPnL: 0,
                  tradesDuringSession: [],
                });
                message.info('Session summary reset');
              }}
            >
              Reset Session
            </Button>
          }
        >
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12} lg={6}>
              <Statistic
                title="Session Status"
                value={paperTradingSession.isActive ? 'Running' : 'Stopped'}
                valueStyle={{ 
                  color: paperTradingSession.isActive ? '#52c41a' : '#ff4d4f',
                  fontWeight: 'bold'
                }}
              />
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Statistic
                title="Duration"
                value={sessionDuration}
                valueStyle={{ color: '#1890ff' }}
              />
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Statistic
                title="Total Trades"
                value={paperTradingSession.totalTrades}
                valueStyle={{ color: '#faad14' }}
              />
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Statistic
                title="Start Equity"
                value={paperTradingSession.startEquity || 0}
                prefix={<DollarOutlined />}
                valueStyle={{ color: '#8c8c8c' }}
                formatter={(value) => `$${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              />
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Statistic
                title="Current Equity"
                value={totalEquity}
                prefix={<DollarOutlined />}
                valueStyle={{ color: '#1890ff' }}
                formatter={(value) => `$${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              />
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Statistic
                title="End Equity"
                value={paperTradingSession.isActive ? '—' : (paperTradingSession.endEquity || 0)}
                prefix={!paperTradingSession.isActive && <DollarOutlined />}
                valueStyle={{ 
                  color: paperTradingSession.isActive ? '#8c8c8c' : '#8c8c8c',
                  fontStyle: paperTradingSession.isActive ? 'italic' : 'normal'
                }}
                formatter={(value) => {
                  if (paperTradingSession.isActive) {
                    return '—';
                  }
                  return `$${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                }}
              />
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Statistic
                title="Realized P&L"
                value={paperTradingSession.realizedPnL}
                prefix={paperTradingSession.realizedPnL >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
                valueStyle={{ color: paperTradingSession.realizedPnL >= 0 ? '#3f8600' : '#cf1322' }}
                formatter={(value) => `$${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              />
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Statistic
                title="Unrealized P&L"
                value={sessionUnrealizedPnL}
                prefix={sessionUnrealizedPnL >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
                valueStyle={{ color: sessionUnrealizedPnL >= 0 ? '#3f8600' : '#cf1322' }}
                formatter={(value) => `$${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              />
            </Col>
          </Row>
          <Row style={{ marginTop: '16px' }}>
            <Col span={24}>
              <Text type="secondary" style={{ fontSize: '12px' }}>
                <strong>Session Info:</strong> Started {paperTradingSession.startTime ? new Date(paperTradingSession.startTime).toLocaleString() : 'N/A'}
                {paperTradingSession.endTime && ` • Ended ${new Date(paperTradingSession.endTime).toLocaleString()}`}
              </Text>
            </Col>
          </Row>
        </Card>
        
        {/* Backtest vs Paper Trading Comparison */}
        <Card 
          title="Backtest vs Paper Trading Comparison" 
          style={{ marginTop: '24px', backgroundColor: '#fafafa' }}
        >
          {(() => {
            // 从localStorage获取backtest结果
            try {
              const backtestResultStr = lastBacktestResultStorageKey
                ? localStorage.getItem(lastBacktestResultStorageKey)
                : null;
              if (!backtestResultStr) {
                return (
                  <div style={{ textAlign: 'center', padding: '20px' }}>
                    <Text type="secondary">No backtest data available. Run a backtest first to see comparison.</Text>
                  </div>
                );
              }
              
              const backtestResult = JSON.parse(backtestResultStr);
              const backtestReturn = backtestResult.results?.totalReturn || 0;
              const backtestTrades = backtestResult.results?.trades || 0;
              
              // 计算Paper Trading回报（优先使用endEquity，如果session已结束）
              const paperTradingEquity = paperTradingSession.isActive 
                ? totalEquity 
                : (paperTradingSession.endEquity > 0 ? paperTradingSession.endEquity : totalEquity);
              
              const paperTradingReturn = paperTradingSession.startEquity > 0 
                ? ((paperTradingEquity - paperTradingSession.startEquity) / paperTradingSession.startEquity) * 100
                : 0;
              
              // 计算差异
              const returnDifference = paperTradingReturn - backtestReturn;
              const tradesDifference = paperTradingSession.totalTrades - backtestTrades;
              
              // 偏差分析计算
              const totalSlippage = paperTradingSession.tradesDuringSession.reduce(
                (sum, trade) => sum + Math.abs(trade.slippageAmount || 0),
                0
              );
              
              const totalCommission = paperTradingSession.tradesDuringSession.reduce(
                (sum, trade) => sum + Math.abs(trade.commission || 0),
                0
              );
              
              const executionGap = backtestReturn - paperTradingReturn;
              
              // 计算影响百分比
              const slippageImpactPct = paperTradingSession.startEquity > 0
                ? (totalSlippage / paperTradingSession.startEquity) * 100
                : 0;
              
              const commissionImpactPct = paperTradingSession.startEquity > 0
                ? (totalCommission / paperTradingSession.startEquity) * 100
                : 0;
              
              const otherGap = executionGap - slippageImpactPct - commissionImpactPct;
              
              // 打log验证数据
              console.log('[Gap Analysis]', {
                totalSlippage,
                totalCommission,
                executionGap,
                backtestReturn,
                paperTradingReturn,
                tradesCount: paperTradingSession.tradesDuringSession.length,
                slippageAmounts: paperTradingSession.tradesDuringSession.map(t => t.slippageAmount),
                slippageImpactPct,
                commissionImpactPct,
                otherGap
              });
              
              return (
                <div>
                  <Row gutter={[16, 16]}>
                    {/* Return 对比区块 */}
                    <Col xs={24} sm={12} lg={8}>
                      <Statistic
                        title="Return"
                        value={backtestReturn}
                        valueStyle={{ 
                          color: backtestReturn >= 0 ? '#3f8600' : '#cf1322',
                          fontWeight: 'bold'
                        }}
                        formatter={(value) => `${backtestReturn >= 0 ? '+' : ''}${Number(value).toFixed(2)}%`}
                      />
                      <div style={{ marginTop: '4px' }}>
                        <Text type="secondary" style={{ fontSize: '12px' }}>
                          Backtest
                        </Text>
                      </div>
                    </Col>
                    <Col xs={24} sm={12} lg={8}>
                      <Statistic
                        title="Return"
                        value={paperTradingReturn}
                        valueStyle={{ 
                          color: paperTradingReturn >= 0 ? '#3f8600' : '#cf1322',
                          fontWeight: 'bold'
                        }}
                        formatter={(value) => `${paperTradingReturn >= 0 ? '+' : ''}${Number(value).toFixed(2)}%`}
                      />
                      <div style={{ marginTop: '4px' }}>
                        <Text type="secondary" style={{ fontSize: '12px' }}>
                          Paper Trading
                        </Text>
                      </div>
                    </Col>
                    <Col xs={24} sm={12} lg={8}>
                      <Statistic
                        title="Difference"
                        value={returnDifference}
                        valueStyle={{ 
                          color: returnDifference >= 0 ? '#3f8600' : '#cf1322',
                          fontWeight: 'bold'
                        }}
                        formatter={(value) => `${returnDifference >= 0 ? '+' : ''}${Number(value).toFixed(2)}%`}
                      />
                      <div style={{ marginTop: '4px' }}>
                        <Text type="secondary" style={{ fontSize: '12px' }}>
                          {returnDifference >= 0 ? 'Paper trading outperforms' : 'Paper trading underperforms'}
                        </Text>
                      </div>
                    </Col>
                    
                    {/* Trades 对比区块 */}
                    <Col xs={24} sm={12} lg={8}>
                      <Statistic
                        title="Trades"
                        value={backtestTrades}
                        valueStyle={{ color: '#1890ff', fontWeight: 'bold' }}
                      />
                      <div style={{ marginTop: '4px' }}>
                        <Text type="secondary" style={{ fontSize: '12px' }}>
                          Backtest
                        </Text>
                      </div>
                    </Col>
                    <Col xs={24} sm={12} lg={8}>
                      <Statistic
                        title="Trades"
                        value={paperTradingSession.totalTrades}
                        valueStyle={{ color: '#1890ff', fontWeight: 'bold' }}
                      />
                      <div style={{ marginTop: '4px' }}>
                        <Text type="secondary" style={{ fontSize: '12px' }}>
                          Paper Trading
                        </Text>
                      </div>
                    </Col>
                    <Col xs={24} sm={12} lg={8}>
                      <Statistic
                        title="Difference"
                        value={tradesDifference}
                        valueStyle={{ 
                          color: tradesDifference >= 0 ? '#3f8600' : '#cf1322',
                          fontWeight: 'bold'
                        }}
                        formatter={(value) => `${tradesDifference >= 0 ? '+' : ''}${Number(value)}`}
                      />
                      <div style={{ marginTop: '4px' }}>
                        <Text type="secondary" style={{ fontSize: '12px' }}>
                          {tradesDifference >= 0 ? 'More trades' : 'Fewer trades'}
                        </Text>
                      </div>
                    </Col>
                  </Row>

                  {/* Gap Analysis */}
                  <div style={{ marginTop: 12, fontSize: '12px', color: '#666' }}>
                    <div><strong>Execution Gap Analysis</strong></div>
                    <div>Slippage: ${totalSlippage.toFixed(2)} ({slippageImpactPct.toFixed(2)}%)</div>
                    <div>Commission: ${totalCommission.toFixed(2)} ({commissionImpactPct.toFixed(2)}%)</div>
                    <div>Gap: {executionGap.toFixed(2)}%</div>
                    <div>Other Gap: {otherGap.toFixed(2)}%</div>
                    <div style={{ marginTop: 8 }}>
                      <strong>
                        {executionGap > 0
                          ? 'Paper trading underperforms backtest'
                          : 'Paper trading outperforms backtest'}
                      </strong>
                    </div>
                    <div style={{ marginTop: 4 }}>
                      <Text type="secondary" style={{ fontSize: '12px' }}>
                        Main difference comes from execution costs and real-time simulation effects.
                      </Text>
                    </div>
                  </div>
                </div>
              );
            } catch (error) {
              console.error('Failed to parse backtest result:', error);
              return (
                <div style={{ textAlign: 'center', padding: '20px' }}>
                  <Text type="secondary" style={{ color: '#cf1322' }}>
                    Error loading backtest data. Please run a new backtest.
                  </Text>
                </div>
              );
            }
          })()}
        </Card>
        
        {/* Session Insights */}
        {sessionHistory.length > 0 && (
          <Card 
            title="Paper Trading Session Insights" 
            style={{ marginTop: '24px', backgroundColor: '#f0f5ff' }}
          >
            {(() => {
              // 计算 insights
              const totalSessions = sessionHistory.length;
              
              // 找到最佳和最差 session
              let bestSession = sessionHistory[0];
              let worstSession = sessionHistory[0];
              let totalReturn = 0;
              let totalCost = 0;
              let totalTrades = 0;
              
              for (const session of sessionHistory) {
                // 更新最佳 session
                if (session.returnPct > bestSession.returnPct) {
                  bestSession = session;
                }
                
                // 更新最差 session
                if (session.returnPct < worstSession.returnPct) {
                  worstSession = session;
                }
                
                // 累加统计
                totalReturn += session.returnPct;
                totalCost += session.totalSlippage + session.totalCommission;
                totalTrades += session.totalTrades;
              }
              
              const avgReturn = totalReturn / totalSessions;
              const avgCost = totalCost / totalSessions;
              const avgTrades = totalTrades / totalSessions;
              
              // 策略名称映射
              const strategyNameMap: Record<string, string> = {
                'DEMO_STRATEGY': 'Demo',
                'RANDOM_SIGNAL': 'Random',
                'SMA_STRATEGY': 'SMA',
                'MA_CROSSOVER': 'MA Cross',
              };
              
              return (
                <div>
                  <Row gutter={[16, 16]}>
                    {/* Best Session */}
                    <Col xs={24} sm={12} lg={6}>
                      <Statistic
                        title="Best Session"
                        value={bestSession.returnPct}
                        valueStyle={{ 
                          color: '#3f8600',
                          fontWeight: 'bold'
                        }}
                        formatter={(value) => `${bestSession.returnPct >= 0 ? '+' : ''}${Number(value).toFixed(2)}%`}
                      />
                      <div style={{ marginTop: '4px' }}>
                        <Text type="secondary" style={{ fontSize: '12px' }}>
                          {strategyNameMap[bestSession.strategyMode] || bestSession.strategyMode} • {bestSession.symbol}
                        </Text>
                      </div>
                    </Col>
                    
                    {/* Worst Session */}
                    <Col xs={24} sm={12} lg={6}>
                      <Statistic
                        title="Worst Session"
                        value={worstSession.returnPct}
                        valueStyle={{ 
                          color: '#cf1322',
                          fontWeight: 'bold'
                        }}
                        formatter={(value) => `${worstSession.returnPct >= 0 ? '+' : ''}${Number(value).toFixed(2)}%`}
                      />
                      <div style={{ marginTop: '4px' }}>
                        <Text type="secondary" style={{ fontSize: '12px' }}>
                          {strategyNameMap[worstSession.strategyMode] || worstSession.strategyMode} • {worstSession.symbol}
                        </Text>
                      </div>
                    </Col>
                    
                    {/* Average Return */}
                    <Col xs={24} sm={12} lg={6}>
                      <Statistic
                        title="Avg Return"
                        value={avgReturn}
                        valueStyle={{ 
                          color: avgReturn >= 0 ? '#3f8600' : '#cf1322',
                          fontWeight: 'bold'
                        }}
                        formatter={(value) => `${avgReturn >= 0 ? '+' : ''}${Number(value).toFixed(2)}%`}
                      />
                      <div style={{ marginTop: '4px' }}>
                        <Text type="secondary" style={{ fontSize: '12px' }}>
                          Across {totalSessions} sessions
                        </Text>
                      </div>
                    </Col>
                    
                    {/* Average Cost */}
                    <Col xs={24} sm={12} lg={6}>
                      <Statistic
                        title="Avg Cost"
                        value={avgCost}
                        valueStyle={{ color: '#8c8c8c', fontWeight: 'bold' }}
                        formatter={(value) => `$${Number(value).toFixed(2)}`}
                      />
                      <div style={{ marginTop: '4px' }}>
                        <Text type="secondary" style={{ fontSize: '12px' }}>
                          {avgTrades.toFixed(1)} trades/session
                        </Text>
                      </div>
                    </Col>
                  </Row>
                  
                  {/* Additional Insights */}
                  <div style={{ marginTop: '16px', padding: '12px', backgroundColor: '#f6ffed', borderRadius: '4px' }}>
                    <div style={{ fontSize: '12px', color: '#666' }}>
                      <div><strong>Key Insights:</strong></div>
                      <div style={{ marginTop: '4px' }}>
                        • Best session used <strong>{strategyNameMap[bestSession.strategyMode] || bestSession.strategyMode}</strong> strategy on <strong>{bestSession.symbol}</strong>
                      </div>
                      <div style={{ marginTop: '2px' }}>
                        • Worst session used <strong>{strategyNameMap[worstSession.strategyMode] || worstSession.strategyMode}</strong> strategy on <strong>{worstSession.symbol}</strong>
                      </div>
                      <div style={{ marginTop: '2px' }}>
                        • Average execution cost is <strong>${avgCost.toFixed(2)}</strong> per session
                      </div>
                      <div style={{ marginTop: '2px' }}>
                        • Average of <strong>{avgTrades.toFixed(1)} trades</strong> per session
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </Card>
        )}
        
        {/* Session History */}
        {sessionHistory.length > 0 && (
          <Card 
            title="Paper Trading Session History" 
            style={{ marginTop: '24px', backgroundColor: '#fafafa' }}
            extra={
              <Button 
                type="link" 
                size="small"
                onClick={() => {
                  if (window.confirm('Clear all session history? This cannot be undone.')) {
                    setSessionHistory([]);
                    if (sessionHistoryStorageKey) localStorage.removeItem(sessionHistoryStorageKey);
                    message.info('Session history cleared');
                  }
                }}
              >
                Clear History
              </Button>
            }
          >
            <Table
              dataSource={sessionHistory}
              pagination={{ pageSize: 5, size: 'small' }}
              size="small"
              columns={[
                {
                  title: 'Time',
                  dataIndex: 'timestamp',
                  key: 'timestamp',
                  width: 120,
                  render: (timestamp: string) => {
                    const date = new Date(timestamp);
                    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  },
                },
                {
                  title: 'Strategy',
                  dataIndex: 'strategyMode',
                  key: 'strategyMode',
                  width: 100,
                  render: (mode: string) => {
                    const modeMap: Record<string, string> = {
                      'DEMO_STRATEGY': 'Demo',
                      'RANDOM_SIGNAL': 'Random',
                      'SMA_STRATEGY': 'SMA',
                      'MA_CROSSOVER': 'MA Cross',
                    };
                    return modeMap[mode] || mode;
                  },
                },
                {
                  title: 'Symbol',
                  dataIndex: 'symbol',
                  key: 'symbol',
                  width: 80,
                },
                {
                  title: 'Return',
                  dataIndex: 'returnPct',
                  key: 'returnPct',
                  align: 'right' as const,
                  width: 90,
                  render: (value: number) => (
                    <Text style={{ 
                      color: value >= 0 ? '#3f8600' : '#cf1322',
                      fontWeight: 'bold'
                    }}>
                      {value >= 0 ? '+' : ''}{value.toFixed(2)}%
                    </Text>
                  ),
                },
                {
                  title: 'Trades',
                  dataIndex: 'totalTrades',
                  key: 'totalTrades',
                  align: 'right' as const,
                  width: 70,
                },
                {
                  title: 'P&L',
                  dataIndex: 'realizedPnL',
                  key: 'realizedPnL',
                  align: 'right' as const,
                  width: 90,
                  render: (value: number) => (
                    <Text style={{ 
                      color: value >= 0 ? '#3f8600' : '#cf1322'
                    }}>
                      ${value.toFixed(2)}
                    </Text>
                  ),
                },
                {
                  title: 'Slippage',
                  dataIndex: 'totalSlippage',
                  key: 'totalSlippage',
                  align: 'right' as const,
                  width: 90,
                  render: (value: number) => `$${value.toFixed(2)}`,
                },
                {
                  title: 'Commission',
                  dataIndex: 'totalCommission',
                  key: 'totalCommission',
                  align: 'right' as const,
                  width: 90,
                  render: (value: number) => `$${value.toFixed(2)}`,
                },
                {
                  title: 'Duration',
                  dataIndex: 'durationMinutes',
                  key: 'durationMinutes',
                  align: 'right' as const,
                  width: 80,
                  render: (minutes: number) => `${minutes}m`,
                },
              ]}
            />
            <div style={{ marginTop: '12px', fontSize: '12px', color: '#666' }}>
              <Text type="secondary">
                Showing {sessionHistory.length} recent sessions. Stop paper trading to save current session to history.
              </Text>
            </div>
          </Card>
        )}
        
        <Row style={{ marginTop: '16px' }}>
          <Col span={24}>
            <div style={{ 
              backgroundColor: '#fafafa', 
              padding: '12px', 
              borderRadius: '4px',
              border: '1px solid #f0f0f0'
            }}>
              <Text type="secondary" style={{ fontSize: '12px' }}>
                <strong>How it works:</strong> When started, the system will generate signals 
                every {paperTradingConfig.intervalSeconds} seconds for {paperTradingConfig.selectedSymbol}. 
                Each trade will be for {paperTradingConfig.sharesPerTrade} shares at the current market price.
              </Text>
            </div>
          </Col>
        </Row>
        
        {/* Strategy Signal Test Buttons */}
        <Row gutter={[8, 8]} style={{ marginTop: '16px' }}>
          <Col>
            <Text strong>Test Strategy Signals:</Text>
          </Col>
          <Col>
            <Button 
              type="primary" 
              size="small"
              onClick={() => {
                const signal: StrategySignal = {
                  symbol: paperTradingConfig.selectedSymbol,
                  action: 'BUY',
                  shares: paperTradingConfig.sharesPerTrade,
                };
                handleStrategySignalWrapper(signal);
              }}
            >
              Trigger BUY Signal
            </Button>
          </Col>
          <Col>
            <Button 
              type="default" 
              size="small"
              onClick={() => {
                const signal: StrategySignal = {
                  symbol: paperTradingConfig.selectedSymbol,
                  action: 'SELL',
                  shares: paperTradingConfig.sharesPerTrade,
                };
                handleStrategySignalWrapper(signal);
              }}
            >
              Trigger SELL Signal
            </Button>
          </Col>
        </Row>
        
        {/* Equity History Info */}
        {equityHistory.length > 0 && (
          <Row style={{ marginTop: '16px' }}>
            <Col span={24}>
              <div style={{ 
                backgroundColor: '#e6f7ff', 
                padding: '12px', 
                borderRadius: '4px',
                border: '1px solid #91d5ff'
              }}>
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  <strong>Equity History:</strong> Recording {equityHistory.length} data points. 
                  Latest equity: ${equityHistory[0]?.equity.toFixed(2)}
                </Text>
              </div>
            </Col>
          </Row>
        )}

      {/* Positions Table and Allocation */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={24} lg={16}>
          <Card
            title="Current Positions"
            extra={<Text type="secondary">{portfolio.positions.length} positions</Text>}
          >
            <Table
              dataSource={portfolio.positions.map((position, index) => ({
                key: (index + 1).toString(),
                ...position,
                marketValue: position.shares * position.currentPrice,
                pnl: (position.currentPrice - position.avgPrice) * position.shares,
                pnlPercentage: position.avgPrice > 0 ? ((position.currentPrice - position.avgPrice) / position.avgPrice) * 100 : 0,
              }))}
              columns={positionsColumns}
              pagination={false}
              size="middle"
            />
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card title="Sector Allocation">
            <div>
              {allocationData.map((item, index) => (
                <div key={index} style={{ marginBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <Text strong>{item.sector}</Text>
                    <Text>{item.value.toFixed(1)}%</Text>
                  </div>
                  <Progress
                    percent={item.value}
                    strokeColor={item.color}
                    showInfo={false}
                    size="small"
                  />
                </div>
              ))}
              <div style={{ marginTop: '24px', padding: '12px', backgroundColor: '#f6ffed', borderRadius: '6px' }}>
                <Text type="secondary">
                  <strong>Note:</strong> This is an interactive demo portfolio. Click the buttons above to test buy/sell functionality. 
                  In a real implementation, this would connect to your brokerage account or trading platform API.
                </Text>
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      {/* Recent Trades */}
      <Row gutter={[16, 16]}>
        <Col xs={24}>
          <Card title="Recent Trades">
            <Table
              dataSource={portfolio.trades}
              columns={tradesColumns}
              pagination={false}
              size="middle"
              expandable={{
                expandedRowRender: (record) => (
                  <div style={{ margin: 0, padding: '12px 24px', backgroundColor: '#fafafa' }}>
                    <div style={{ fontSize: '13px', color: '#666', marginBottom: '8px' }}>
                      <strong>Trade Execution Details</strong>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
                      <div>
                        <div style={{ fontSize: '11px', color: '#999', marginBottom: '2px' }}>Market Price</div>
                        <div style={{ fontSize: '13px' }}>
                          {record.marketPrice ? `$${record.marketPrice.toFixed(2)}` : '—'}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '11px', color: '#999', marginBottom: '2px' }}>Executed Price</div>
                        <div style={{ fontSize: '13px' }}>
                          ${record.price.toFixed(2)}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '11px', color: '#999', marginBottom: '2px' }}>Slippage Amount</div>
                        <div style={{ fontSize: '13px', color: record.slippageAmount && record.slippageAmount > 0 ? '#cf1322' : '#3f8600' }}>
                          {record.slippageAmount ? `$${Math.abs(record.slippageAmount).toFixed(2)}` : '—'}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '11px', color: '#999', marginBottom: '2px' }}>Commission</div>
                        <div style={{ fontSize: '13px' }}>
                          {record.commission ? `$${record.commission.toFixed(2)}` : '—'}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '11px', color: '#999', marginBottom: '2px' }}>Total Cash Impact</div>
                        <div style={{ fontSize: '13px', fontWeight: 'bold', color: record.action === 'BUY' ? '#cf1322' : '#3f8600' }}>
                          {(() => {
                            const shares = record.shares || 0;
                            const executedPrice = record.price || 0;
                            const commission = record.commission || 0;
                            
                            if (record.action === 'BUY') {
                              // BUY: -(executedPrice * shares + commission)
                              const total = -(executedPrice * shares + commission);
                              return `$${total.toFixed(2)}`;
                            } else {
                              // SELL: +(executedPrice * shares - commission)
                              const total = executedPrice * shares - commission;
                              return `$${total.toFixed(2)}`;
                            }
                          })()}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '11px', color: '#999', marginBottom: '2px' }}>Source</div>
                        <div style={{ fontSize: '13px' }}>
                          {record.source === 'DEMO_BUTTON' ? 'Demo Button' : 
                           record.source === 'MANUAL_ORDER' ? 'Manual Order' : 
                           record.source === 'STRATEGY_SIGNAL' ? 'Strategy Signal' : record.source}
                        </div>
                      </div>
                    </div>
                    <div style={{ marginTop: '12px', fontSize: '11px', color: '#999' }}>
                      <Text type="secondary">
                        {record.action === 'BUY' 
                          ? `Bought ${record.shares} shares at $${record.price.toFixed(2)} each` 
                          : `Sold ${record.shares} shares at $${record.price.toFixed(2)} each`}
                      </Text>
                    </div>
                  </div>
                ),
                rowExpandable: (record) => true,
              }}
            />
          </Card>
        </Col>
      </Row>

      {/* Info Box */}
      <Card style={{ marginTop: '24px', backgroundColor: '#f0f5ff' }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} md={8}>
            <div style={{ textAlign: 'center' }}>
              <Title level={4} style={{ color: '#1890ff' }}>Demo Mode</Title>
              <Text>This portfolio shows example data for demonstration purposes.</Text>
            </div>
          </Col>
          <Col xs={24} md={8}>
            <div style={{ textAlign: 'center' }}>
              <Title level={4} style={{ color: '#52c41a' }}>Real Implementation</Title>
              <Text>Connect to brokerage APIs like Interactive Brokers, TD Ameritrade, or Alpaca.</Text>
            </div>
          </Col>
          <Col xs={24} md={8}>
            <div style={{ textAlign: 'center' }}>
              <Title level={4} style={{ color: '#722ed1' }}>Paper Trading</Title>
              <Text>Add paper trading functionality to test strategies without real money.</Text>
            </div>
          </Col>
        </Row>
      </Card>
    </div>
  );
};

export default LocalPaperTrading;
