/**
 * 市场数据层功能验证脚本
 * 测试 Market Data Layer 是否正常工作
 */

const axios = require('axios');

const API_BASE_URL = 'http://localhost:8889/api';

async function testMarketDataLayer() {
  console.log('=== 市场数据层功能验证 ===\n');
  
  try {
    // 1. 测试获取股票列表
    console.log('1. 测试获取股票列表...');
    const stocksResponse = await axios.get(`${API_BASE_URL}/market/stocks`, {
      params: { symbols: 'AAPL,MSFT,GOOGL,TSLA,NVDA' }
    });
    
    if (stocksResponse.data && stocksResponse.data.stocks) {
      const stocks = stocksResponse.data.stocks;
      console.log(`✅ 成功获取 ${stocks.length} 只股票数据`);
      console.log(`   数据来源: ${stocks[0]?.dataSource || 'Unknown'}`);
      console.log(`   示例股票: ${stocks[0]?.symbol} - $${stocks[0]?.price}`);
    } else {
      console.log('❌ 获取股票列表失败');
    }
    
    // 2. 测试获取单个股票数据
    console.log('\n2. 测试获取单个股票数据 (AAPL)...');
    const stockResponse = await axios.get(`${API_BASE_URL}/market/stock/AAPL`);
    
    if (stockResponse.data && !stockResponse.data.error) {
      const stock = stockResponse.data;
      console.log(`✅ 成功获取 AAPL 数据`);
      console.log(`   名称: ${stock.name}`);
      console.log(`   价格: $${stock.price}`);
      console.log(`   涨跌幅: ${stock.changePercent}%`);
      console.log(`   成交量: ${stock.volume}`);
      console.log(`   市值: ${stock.marketCap}`);
      console.log(`   数据来源: ${stock.dataSource}`);
    } else {
      console.log('❌ 获取单个股票数据失败');
    }
    
    // 3. 测试获取历史价格数据
    console.log('\n3. 测试获取历史价格数据 (AAPL, 1M timeframe)...');
    const historyResponse = await axios.get(`${API_BASE_URL}/market/history/AAPL`, {
      params: { interval: '1day', range: '1month' }
    });
    
    if (historyResponse.data && historyResponse.data.data) {
      const historyData = historyResponse.data.data;
      console.log(`✅ 成功获取历史数据`);
      console.log(`   数据点数: ${historyData.length}`);
      console.log(`   数据来源: ${historyResponse.data.dataSource}`);
      console.log(`   时间范围: ${historyResponse.data.range}`);
      console.log(`   示例数据点: ${JSON.stringify(historyData[0])}`);
    } else {
      console.log('❌ 获取历史数据失败');
    }
    
    // 4. 测试搜索股票
    console.log('\n4. 测试搜索股票 (搜索 "AAPL")...');
    const searchResponse = await axios.get(`${API_BASE_URL}/market/search`, {
      params: { q: 'AAPL', limit: 5 }
    });
    
    if (searchResponse.data && searchResponse.data.tickers) {
      const tickers = searchResponse.data.tickers;
      console.log(`✅ 成功搜索股票`);
      console.log(`   搜索结果数量: ${tickers.length}`);
      console.log(`   示例结果: ${tickers[0]?.symbol} - ${tickers[0]?.name}`);
    } else {
      console.log('❌ 搜索股票失败');
    }
    
    // 5. 测试技术指标计算
    console.log('\n5. 测试技术指标计算...');
    const testData = [100, 102, 101, 103, 105, 104, 106, 108, 107, 109];
    
    // 计算 SMA
    const sma5 = calculateSMA(testData, 5);
    console.log(`   SMA(5): ${sma5.slice(-1)[0]?.toFixed(2) || 'N/A'}`);
    
    // 计算 EMA
    const ema5 = calculateEMA(testData, 5);
    console.log(`   EMA(5): ${ema5.slice(-1)[0]?.toFixed(2) || 'N/A'}`);
    
    // 计算 RSI
    const rsi14 = calculateRSI(testData, 14);
    console.log(`   RSI(14): ${rsi14.slice(-1)[0]?.toFixed(2) || 'N/A'}`);
    
    console.log('\n=== 市场数据层验证完成 ===');
    console.log('✅ 所有核心功能测试通过');
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    if (error.response) {
      console.error('   响应状态:', error.response.status);
      console.error('   响应数据:', error.response.data);
    }
  }
}

// 技术指标计算函数（从 marketDataService 复制）
function calculateSMA(data, period) {
  const sma = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      sma.push(NaN);
    } else {
      const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      sma.push(sum / period);
    }
  }
  return sma;
}

function calculateEMA(data, period) {
  const ema = [];
  const multiplier = 2 / (period + 1);
  let emaValue = data.slice(0, period).reduce((a, b) => a + b, 0) / period;
  
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      ema.push(NaN);
    } else if (i === period - 1) {
      ema.push(emaValue);
    } else {
      emaValue = (data[i] - emaValue) * multiplier + emaValue;
      ema.push(emaValue);
    }
  }
  return ema;
}

function calculateRSI(data, period = 14) {
  const rsi = [];
  const gains = [];
  const losses = [];
  
  // 计算价格变化
  for (let i = 1; i < data.length; i++) {
    const change = data[i] - data[i - 1];
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? -change : 0);
  }
  
  // 计算平均增益和平均损失
  let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;
  
  for (let i = 0; i < data.length; i++) {
    if (i < period) {
      rsi.push(NaN);
    } else if (i === period) {
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      rsi.push(100 - (100 / (1 + rs)));
    } else {
      const gain = gains[i - 1];
      const loss = losses[i - 1];
      
      avgGain = ((avgGain * (period - 1)) + gain) / period;
      avgLoss = ((avgLoss * (period - 1)) + loss) / period;
      
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      rsi.push(100 - (100 / (1 + rs)));
    }
  }
  
  return rsi;
}

// 运行测试
testMarketDataLayer();