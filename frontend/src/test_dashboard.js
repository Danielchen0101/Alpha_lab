// 模拟测试Dashboard数据获取
const mockResponse = {
  data: {
    stocks: [
      {
        symbol: "AAPL",
        name: "Apple Inc",
        price: 254.23,
        change: 1.41,
        changePercent: 0.56,
        high: 255.13,
        low: 252.18,
        prevClose: 252.82,
        marketCap: 3732386.2,
        sector: "Technology",
        currency: "USD",
        dataSource: "Finnhub",
        timestamp: 1773795781.4623272,
        volume: 0
      }
    ],
    count: 1,
    source: "Finnhub",
    timestamp: 1773795788.655722
  }
};

// 模拟前端解析逻辑
function parseStocks(response) {
  if (response.data && response.data.stocks) {
    const stocks = response.data.stocks.map((stock) => ({
      ...stock,
      // 映射字段名
      dayHigh: stock.high !== undefined ? stock.high : null,
      dayLow: stock.low !== undefined ? stock.low : null,
      previousClose: stock.prevClose !== undefined ? stock.prevClose : null,
      dataSource: stock.dataSource || response.data.source || 'Finnhub',
      timestamp: new Date().toISOString(),
    }));
    
    return stocks;
  }
  
  return [];
}

// 测试
console.log("=== 测试Dashboard数据解析 ===");
console.log("1. 原始响应结构:");
console.log(JSON.stringify(mockResponse.data, null, 2));

console.log("\n2. 解析后的股票数据:");
const parsedStocks = parseStocks(mockResponse);
console.log(JSON.stringify(parsedStocks, null, 2));

console.log("\n3. 字段映射检查:");
const stock = parsedStocks[0];
console.log(`- symbol: ${stock.symbol} (期望: AAPL)`);
console.log(`- price: ${stock.price} (期望: 254.23)`);
console.log(`- changePercent: ${stock.changePercent} (期望: 0.56)`);
console.log(`- dayHigh: ${stock.dayHigh} (原始: high=${mockResponse.data.stocks[0].high}, 期望: 255.13)`);
console.log(`- dayLow: ${stock.dayLow} (原始: low=${mockResponse.data.stocks[0].low}, 期望: 252.18)`);
console.log(`- previousClose: ${stock.previousClose} (原始: prevClose=${mockResponse.data.stocks[0].prevClose}, 期望: 252.82)`);
console.log(`- marketCap: ${stock.marketCap} (期望: 3732386.2)`);
console.log(`- dataSource: ${stock.dataSource} (期望: Finnhub)`);

console.log("\n4. getChangePercent函数测试:");
function getChangePercent(stock) {
  if (stock.changePercent !== null && stock.changePercent !== undefined) return stock.changePercent;
  if (stock.price !== null && stock.previousClose !== null && stock.previousClose !== 0) return ((stock.price - stock.previousClose) / stock.previousClose) * 100;
  if (stock.change !== null && stock.previousClose !== null && stock.previousClose !== 0) return (stock.change / stock.previousClose) * 100;
  return null;
}

const changePercent = getChangePercent(stock);
console.log(`计算出的changePercent: ${changePercent}% (期望: 0.56%)`);