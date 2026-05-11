// Paper Trading Engine - 本地模拟交易引擎
// 不依赖任何外部API，纯本地计算

// 风险控制常量
const RISK_COOLDOWN_SECONDS = 30; // 同一symbol交易冷却时间
const RISK_MAX_POSITION_PERCENT = 0.3; // 单只股票最大仓位百分比 (30%)
const RISK_MAX_DAILY_LOSS_PERCENT = -5; // 最大单日亏损百分比 (-5%)
const RISK_MIN_CASH_PERCENT = 0.1; // 最低现金保留百分比 (10%)

// 类型定义
export type Position = {
  symbol: string;
  sector: string;
  shares: number;
  avgPrice: number;
  currentPrice: number;
};

export type Trade = {
  id: number;
  action: 'BUY' | 'SELL';
  symbol: string;
  shares: number;
  price: number; // 实际成交价（含滑点）
  date: string;
  source: 'DEMO_BUTTON' | 'MANUAL_ORDER' | 'STRATEGY_SIGNAL';
  // 新增字段：交易成本明细
  marketPrice?: number; // 市场价（不含滑点）
  slippageAmount?: number; // 滑点金额
  commission?: number; // 手续费金额
  totalCost?: number; // 总成本（BUY）或总收入（SELL）
};

export type TradeOrder = {
  action: 'BUY' | 'SELL';
  symbol: string;
  price: number;
  shares: number;
};

export type StrategySignal = {
  symbol: string;
  action: 'BUY' | 'SELL';
  shares: number;
};

export type PortfolioState = {
  cash: number;
  positions: Position[];
  trades: Trade[];
};

export type EquityHistory = {
  time: string;
  equity: number;
  cash: number;
  marketValue: number;
};

export type PaperTradingConfig = {
  selectedSymbol: string;
  sharesPerTrade: number;
  mode: 'DEMO_STRATEGY' | 'RANDOM_SIGNAL' | 'SMA_STRATEGY' | 'MA_CROSSOVER';
  status: 'STOPPED' | 'RUNNING';
  intervalSeconds: number;
  // MA Crossover策略参数（与Backtest保持一致）
  shortMaPeriod?: number;
  longMaPeriod?: number;
  // 滑点模拟参数
  slippageRate?: number; // 百分比，例如0.001表示0.1%
  // 手续费模拟参数
  commission?: number; // 每笔交易固定手续费，单位：美元
};

export type PriceHistory = {
  symbol: string;
  prices: number[];
  timestamps: string[];
};

export type ExecuteTradeResult = {
  success: boolean;
  portfolio: PortfolioState;
  error?: string;
};

// 已知股票行业映射
const KNOWN_STOCKS: Record<string, string> = {
  'AAPL': 'Technology',
  'TSLA': 'Automotive',
  'NVDA': 'Technology',
  'GOOGL': 'Technology',
  'JPM': 'Financial',
  'MSFT': 'Technology',
  'AMZN': 'Consumer',
  'META': 'Technology',
  'NFLX': 'Consumer',
  'V': 'Financial',
};

// 核心交易执行函数
export const executePaperTrade = (
  portfolio: PortfolioState,
  order: TradeOrder,
  source: 'DEMO_BUTTON' | 'MANUAL_ORDER' | 'STRATEGY_SIGNAL' = 'MANUAL_ORDER',
  slippageRate: number = 0, // 默认无滑点
  commission: number = 0, // 默认无手续费
  sessionStartEquity?: number,
  sessionRealizedPnL?: number
): ExecuteTradeResult => {
  const { action, symbol, price, shares } = order;
  
  // 验证订单
  if (shares <= 0) {
    return {
      success: false,
      portfolio,
      error: 'Invalid order: shares must be greater than 0'
    };
  }
  
  // 应用滑点：BUY时加价，SELL时减价
  let executedPrice = price;
  if (slippageRate > 0) {
    if (action === 'BUY') {
      executedPrice = price * (1 + slippageRate);
    } else if (action === 'SELL') {
      executedPrice = price * (1 - slippageRate);
    }
    // 保留2位小数
    executedPrice = Math.round(executedPrice * 100) / 100;
  }
  
  // 风控检查
  const riskCheck = checkRiskControls(portfolio, order, source, sessionStartEquity, sessionRealizedPnL);
  if (!riskCheck.passed) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[Risk Control] Skipped ${action} ${shares} ${symbol}: ${riskCheck.reason}`);
    }
    return {
      success: false,
      portfolio,
      error: riskCheck.reason || 'Risk control check failed'
    };
  }
  
  if (action === 'BUY') {
    const totalCost = executedPrice * shares + commission;
    
    // 检查现金是否足够
    if (totalCost > portfolio.cash) {
      return {
        success: false,
        portfolio,
        error: `Insufficient cash. Need $${totalCost.toFixed(2)}, but only have $${portfolio.cash.toFixed(2)}`
      };
    }
    
    // 创建新的portfolio副本
    const newPositions = [...portfolio.positions];
    const existingPositionIndex = newPositions.findIndex(p => p.symbol === symbol);
    const newTradeId = portfolio.trades.length > 0 ? Math.max(...portfolio.trades.map(t => t.id)) + 1 : 1;
    
    if (existingPositionIndex >= 0) {
      // 更新现有持仓
      const existing = newPositions[existingPositionIndex];
      const totalShares = existing.shares + shares;
      const newAvgPrice = ((existing.avgPrice * existing.shares) + (executedPrice * shares)) / totalShares;
      
      newPositions[existingPositionIndex] = {
        ...existing,
        shares: totalShares,
        avgPrice: newAvgPrice,
      };
    } else {
      // 添加新持仓
      newPositions.push({
        symbol,
        sector: KNOWN_STOCKS[symbol] || 'Other',
        shares,
        avgPrice: executedPrice,
        currentPrice: executedPrice, // 假设买入时当前价格等于买入价格
      });
    }
    
    // 添加交易记录
    const newTrade: Trade = {
      id: newTradeId,
      action: 'BUY',
      symbol,
      shares,
      price: executedPrice, // 记录实际成交价（含滑点）
      date: new Date().toISOString().split('T')[0], // 今天日期
      source,
      // 记录交易成本明细
      marketPrice: price, // 原始市场价
      slippageAmount: slippageRate > 0 ? executedPrice - price : 0, // 滑点金额
      commission: commission, // 手续费金额
      totalCost: totalCost, // 总成本
    };
    
    const newPortfolio: PortfolioState = {
      cash: portfolio.cash - totalCost,
      positions: newPositions,
      trades: [newTrade, ...portfolio.trades].slice(0, 10), // 只保留最近10条
    };
    
    return {
      success: true,
      portfolio: newPortfolio,
    };
  } 
  else if (action === 'SELL') {
    const existingPositionIndex = portfolio.positions.findIndex(p => p.symbol === symbol);
    
    // 检查是否持有该股票
    if (existingPositionIndex < 0) {
      return {
        success: false,
        portfolio,
        error: `No position found for ${symbol}`
      };
    }
    
    const existingPosition = portfolio.positions[existingPositionIndex];
    
    // 检查持仓是否足够
    if (existingPosition.shares < shares) {
      return {
        success: false,
        portfolio,
        error: `Insufficient shares. Have ${existingPosition.shares} shares of ${symbol}, trying to sell ${shares}`
      };
    }
    
    // 创建新的portfolio副本
    const newPositions = [...portfolio.positions];
    const newTradeId = portfolio.trades.length > 0 ? Math.max(...portfolio.trades.map(t => t.id)) + 1 : 1;
    const totalValue = Math.max(0, executedPrice * shares - commission); // 确保不会变成负数
    
    if (existingPosition.shares === shares) {
      // 全部卖出，移除持仓
      newPositions.splice(existingPositionIndex, 1);
    } else {
      // 部分卖出，更新持仓
      newPositions[existingPositionIndex] = {
        ...existingPosition,
        shares: existingPosition.shares - shares,
      };
    }
    
    // 添加交易记录
    const newTrade: Trade = {
      id: newTradeId,
      action: 'SELL',
      symbol,
      shares,
      price: executedPrice, // 记录实际成交价（含滑点）
      date: new Date().toISOString().split('T')[0], // 今天日期
      source,
      // 记录交易成本明细
      marketPrice: price, // 原始市场价
      slippageAmount: slippageRate > 0 ? price - executedPrice : 0, // 滑点金额（SELL时为负）
      commission: commission, // 手续费金额
      totalCost: totalValue, // 总收入（已扣除手续费）
    };
    
    const newPortfolio: PortfolioState = {
      cash: portfolio.cash + totalValue,
      positions: newPositions,
      trades: [newTrade, ...portfolio.trades].slice(0, 10), // 只保留最近10条
    };
    
    return {
      success: true,
      portfolio: newPortfolio,
    };
  }
  
  return {
    success: false,
    portfolio,
    error: `Invalid order action: ${action}`
  };
};

// 策略信号处理函数
export const handleStrategySignal = (
  portfolio: PortfolioState,
  signal: StrategySignal,
  currentPrice: number,
  slippageRate: number = 0,
  commission: number = 0,
  sessionStartEquity?: number,
  sessionRealizedPnL?: number
): ExecuteTradeResult => {
  const order: TradeOrder = {
    action: signal.action,
    symbol: signal.symbol,
    price: currentPrice,
    shares: signal.shares,
  };
  
  return executePaperTrade(portfolio, order, 'STRATEGY_SIGNAL', slippageRate, commission, sessionStartEquity, sessionRealizedPnL);
};

// 生成随机策略信号
export const generateRandomSignal = (
  symbol: string,
  sharesPerTrade: number
): StrategySignal => {
  const actions: ('BUY' | 'SELL')[] = ['BUY', 'SELL'];
  const randomAction = actions[Math.floor(Math.random() * actions.length)];
  
  return {
    symbol,
    action: randomAction,
    shares: sharesPerTrade,
  };
};

// 计算简单移动平均线 (SMA)
export const calculateSMA = (prices: number[], period: number = 5): number => {
  if (prices.length < period) {
    return prices.length > 0 ? prices.reduce((sum, price) => sum + price, 0) / prices.length : 0;
  }
  
  const recentPrices = prices.slice(-period);
  return recentPrices.reduce((sum, price) => sum + price, 0) / period;
};

// 生成基于SMA的策略信号
export const generateSMASignal = (
  symbol: string,
  sharesPerTrade: number,
  priceHistory: PriceHistory
): StrategySignal | null => {
  const { prices } = priceHistory;
  
  if (prices.length < 2) {
    return null; // 数据不足，不生成信号
  }
  
  const currentPrice = prices[prices.length - 1];
  const sma = calculateSMA(prices, 5); // 5期SMA
  
  // 简单规则：当前价格 > SMA → BUY，当前价格 < SMA → SELL
  if (currentPrice > sma * 1.01) { // 1%阈值避免频繁交易
    return {
      symbol,
      action: 'BUY',
      shares: sharesPerTrade,
    };
  } else if (currentPrice < sma * 0.99) { // 1%阈值避免频繁交易
    return {
      symbol,
      action: 'SELL',
      shares: sharesPerTrade,
    };
  }
  
  return null; // 价格在SMA附近，不交易
};

// 生成基于MA Crossover的策略信号（基于Backtest真实逻辑）
export const generateMACrossoverSignal = (
  symbol: string,
  sharesPerTrade: number,
  priceHistory: PriceHistory,
  shortMaPeriod: number = 5,
  longMaPeriod: number = 10
): StrategySignal | null => {
  const { prices } = priceHistory;
  
  // 需要足够的数据来计算两个均线
  const minDataNeeded = Math.max(shortMaPeriod, longMaPeriod);
  if (prices.length < minDataNeeded) {
    return null; // 数据不足，不生成信号
  }
  
  // 计算当前时刻的均线
  const currentShortMA = calculateSMA(prices, shortMaPeriod);
  const currentLongMA = calculateSMA(prices, longMaPeriod);
  
  // 计算前一个时刻的均线（去掉最后一个价格）
  const previousPrices = prices.slice(0, -1);
  const previousShortMA = calculateSMA(previousPrices, shortMaPeriod);
  const previousLongMA = calculateSMA(previousPrices, longMaPeriod);
  
  // 检查是否有足够的均线数据
  if (previousShortMA === 0 || previousLongMA === 0 || 
      currentShortMA === 0 || currentLongMA === 0) {
    return null;
  }
  
  // 基于Backtest真实逻辑：金叉和死叉检测
  // 金叉：前一天 short_ma <= long_ma 且当前 short_ma > long_ma → BUY
  // 死叉：前一天 short_ma >= long_ma 且当前 short_ma < long_ma → SELL
  
  // 为了避免频繁交易，添加一个小的阈值（0.1%）
  const threshold = 0.001;
  
  // 检查金叉（买入信号）
  if (previousShortMA <= previousLongMA * (1 + threshold) && 
      currentShortMA > currentLongMA * (1 + threshold)) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[MA Crossover] Golden Cross detected for ${symbol}: ` +
                  `prev(${previousShortMA.toFixed(2)} <= ${previousLongMA.toFixed(2)}), ` +
                  `curr(${currentShortMA.toFixed(2)} > ${currentLongMA.toFixed(2)})`);
    }
    return {
      symbol,
      action: 'BUY',
      shares: sharesPerTrade,
    };
  }
  
  // 检查死叉（卖出信号）
  if (previousShortMA >= previousLongMA * (1 - threshold) &&
      currentShortMA < currentLongMA * (1 - threshold)) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[MA Crossover] Death Cross detected for ${symbol}: ` +
                  `prev(${previousShortMA.toFixed(2)} >= ${previousLongMA.toFixed(2)}), ` +
                  `curr(${currentShortMA.toFixed(2)} < ${currentLongMA.toFixed(2)})`);
    }
    return {
      symbol,
      action: 'SELL',
      shares: sharesPerTrade,
    };
  }
  
  return null; // 无交叉信号
};

// 更新价格历史
export const updatePriceHistory = (
  priceHistory: PriceHistory[],
  symbol: string,
  price: number
): PriceHistory[] => {
  const timestamp = new Date().toISOString();
  const existingIndex = priceHistory.findIndex(ph => ph.symbol === symbol);
  
  if (existingIndex >= 0) {
    // 更新现有记录，最多保留50个价格点
    const updated = [...priceHistory];
    updated[existingIndex] = {
      symbol,
      prices: [...updated[existingIndex].prices.slice(-49), price], // 保留最近50个
      timestamps: [...updated[existingIndex].timestamps.slice(-49), timestamp],
    };
    return updated;
  } else {
    // 添加新记录
    return [...priceHistory, {
      symbol,
      prices: [price],
      timestamps: [timestamp],
    }];
  }
};

// 风控检查
export type RiskControlResult = {
  passed: boolean;
  reason?: string;
};

// 交易冷却时间记录
const tradeCooldown = new Map<string, number>();

export const checkRiskControls = (
  portfolio: PortfolioState,
  order: TradeOrder,
  source: 'DEMO_BUTTON' | 'MANUAL_ORDER' | 'STRATEGY_SIGNAL',
  sessionStartEquity?: number,
  sessionRealizedPnL?: number
): RiskControlResult => {
  const { action, symbol, price, shares } = order;
  const totalEquity = portfolio.cash + calculateMarketValue(portfolio.positions);
  
  // 1. 检查单只股票最大仓位不超过 total equity 的 30%
  if (action === 'BUY') {
    // 计算当前该symbol的持仓价值
    const existingPosition = portfolio.positions.find(p => p.symbol === symbol);
    const existingPositionValue = existingPosition ? existingPosition.shares * existingPosition.currentPrice : 0;
    
    // 计算本次买入的价值
    const newPositionValue = price * shares;
    
    // 计算买入后的总持仓价值
    const totalPositionValueAfterBuy = existingPositionValue + newPositionValue;
    const maxPositionValue = totalEquity * RISK_MAX_POSITION_PERCENT;
    
    if (totalPositionValueAfterBuy > maxPositionValue) {
      return {
        passed: false,
        reason: `Position after buy would exceed ${(RISK_MAX_POSITION_PERCENT * 100).toFixed(0)}% of total equity ` +
                `(current: $${existingPositionValue.toFixed(2)}, new: $${newPositionValue.toFixed(2)}, ` +
                `total: $${totalPositionValueAfterBuy.toFixed(2)}, max: $${maxPositionValue.toFixed(2)})`
      };
    }
  }
  
  // 2. 检查cash最低保留10%
  if (action === 'BUY') {
    const orderCost = price * shares;
    const minCash = totalEquity * RISK_MIN_CASH_PERCENT;
    const cashAfterOrder = portfolio.cash - orderCost;
    
    if (cashAfterOrder < minCash) {
      return {
        passed: false,
        reason: `Cash after order ($${cashAfterOrder.toFixed(2)}) would be below ${(RISK_MIN_CASH_PERCENT * 100).toFixed(0)}% minimum ($${minCash.toFixed(2)})`
      };
    }
  }
  
  // 3. 检查同一symbol 30秒内不能重复交易
  const cooldownKey = `${symbol}_${action}`;
  const lastTradeTime = tradeCooldown.get(cooldownKey);
  const currentTime = Date.now();
  
  if (lastTradeTime && (currentTime - lastTradeTime) < RISK_COOLDOWN_SECONDS * 1000) { // 30秒冷却
    return {
      passed: false,
      reason: `Cooldown active for ${symbol} ${action} (${RISK_COOLDOWN_SECONDS} seconds required)`
    };
  }
  
  // 4. 检查最大单日亏损（如果提供了session信息）
  if (sessionStartEquity !== undefined && sessionRealizedPnL !== undefined && sessionStartEquity > 0) {
    const lossPercentage = (sessionRealizedPnL / sessionStartEquity) * 100;
    
    if (lossPercentage < RISK_MAX_DAILY_LOSS_PERCENT) {
      return {
        passed: false,
        reason: `Max daily loss reached (${lossPercentage.toFixed(2)}% < ${RISK_MAX_DAILY_LOSS_PERCENT}%)`
      };
    }
  }
  
  // 5. 对于SELL，检查是否持有该股票
  if (action === 'SELL') {
    const position = portfolio.positions.find(p => p.symbol === symbol);
    if (!position) {
      return {
        passed: false,
        reason: `No position found for ${symbol}`
      };
    }
    
    // 检查持仓是否足够
    if (position.shares < shares) {
      return {
        passed: false,
        reason: `Insufficient shares. Have ${position.shares} shares of ${symbol}, trying to sell ${shares}`
      };
    }
  }
  
  // 所有检查通过，更新冷却时间
  tradeCooldown.set(cooldownKey, currentTime);
  
  return {
    passed: true
  };
};

// 计算市场价值
export const calculateMarketValue = (positions: Position[]): number => {
  return positions.reduce((total, position) => {
    return total + (position.shares * position.currentPrice);
  }, 0);
};

// 计算总资产
export const calculateTotalEquity = (cash: number, marketValue: number): number => {
  return cash + marketValue;
};

// 计算总盈亏
export const calculateTotalPnL = (positions: Position[]): number => {
  return positions.reduce((total, position) => {
    return total + ((position.currentPrice - position.avgPrice) * position.shares);
  }, 0);
};

// 计算盈亏百分比
export const calculatePnLPercentage = (positions: Position[], totalPnL: number): number => {
  const totalCost = positions.reduce((total, position) => {
    return total + (position.avgPrice * position.shares);
  }, 0);
  return totalCost > 0 ? (totalPnL / totalCost) * 100 : 0;
};

// 记录equity历史
export const recordEquityHistory = (
  history: EquityHistory[],
  portfolio: PortfolioState,
  marketValue: number
): EquityHistory[] => {
  const newHistory: EquityHistory = {
    time: new Date().toISOString(),
    equity: portfolio.cash + marketValue,
    cash: portfolio.cash,
    marketValue,
  };
  
  // 保留最近100条记录
  return [newHistory, ...history].slice(0, 100);
};

// 默认配置
export const DEFAULT_PAPER_TRADING_CONFIG: PaperTradingConfig = {
  selectedSymbol: 'AAPL',
  sharesPerTrade: 5,
  mode: 'MA_CROSSOVER', // 默认使用MA Crossover策略
  status: 'STOPPED',
  intervalSeconds: 5,
  // MA Crossover默认参数（与Backtest保持一致）
  shortMaPeriod: 5,
  longMaPeriod: 10,
  // 滑点模拟默认参数（0.10%）
  slippageRate: 0.001, // 0.10%
  // 手续费模拟默认参数（每笔交易$1.00）
  commission: 1.00,
};

// 默认初始portfolio
export const DEFAULT_PORTFOLIO: PortfolioState = {
  cash: 25000,
  positions: [
    { symbol: 'AAPL', sector: 'Technology', shares: 50, avgPrice: 150.25, currentPrice: 172.50 },
    { symbol: 'TSLA', sector: 'Automotive', shares: 25, avgPrice: 210.75, currentPrice: 195.20 },
    { symbol: 'NVDA', sector: 'Technology', shares: 30, avgPrice: 425.60, currentPrice: 512.80 },
    { symbol: 'GOOGL', sector: 'Technology', shares: 15, avgPrice: 142.30, currentPrice: 155.75 },
    { symbol: 'JPM', sector: 'Financial', shares: 40, avgPrice: 145.80, currentPrice: 148.25 },
  ],
  trades: [
    { id: 1, action: 'BUY', symbol: 'AAPL', shares: 10, price: 170.25, date: '2026-03-28', source: 'DEMO_BUTTON' },
    { id: 2, action: 'SELL', symbol: 'TSLA', shares: 5, price: 198.50, date: '2026-03-27', source: 'DEMO_BUTTON' },
    { id: 3, action: 'BUY', symbol: 'NVDA', shares: 8, price: 505.75, date: '2026-03-26', source: 'DEMO_BUTTON' },
    { id: 4, action: 'BUY', symbol: 'GOOGL', shares: 15, price: 152.30, date: '2026-03-25', source: 'DEMO_BUTTON' },
    { id: 5, action: 'SELL', symbol: 'JPM', shares: 10, price: 147.80, date: '2026-03-24', source: 'DEMO_BUTTON' },
  ],
};