// 测试marketCap计算
const testMarketCapCalculation = () => {
  // 模拟Finnhub返回的数据（百万美元）
  const mockStocks = [
    { symbol: 'AAPL', marketCap: 3732386.24 }, // 3.73万亿
    { symbol: 'MSFT', marketCap: 3000000.00 }, // 3.00万亿
    { symbol: 'GOOGL', marketCap: 2000000.00 }, // 2.00万亿
    { symbol: 'TSLA', marketCap: 800000.00 },   // 0.80万亿
    { symbol: 'NVDA', marketCap: 4420899.00 },  // 4.42万亿
  ];
  
  // 当前计算逻辑
  const stocksWithMarketCap = mockStocks.filter(s => s.marketCap !== null && s.marketCap !== undefined);
  const totalMarketCap = stocksWithMarketCap.reduce((sum, s) => sum + (s.marketCap * 1000000), 0);
  
  console.log('测试marketCap计算:');
  console.log('股票数量:', stocksWithMarketCap.length);
  console.log('总市值（美元）:', totalMarketCap);
  console.log('总市值（万亿）:', totalMarketCap / 1e12);
  
  // 测试格式化函数
  const formatMarketCap = (value) => {
    if (value === null || value === undefined || value === 0) return '--';
    const num = Number(value);
    if (isNaN(num)) return '--';
    
    if (num >= 1e12) {
      const trillions = num / 1e12;
      return `$${trillions.toFixed(trillions >= 100 ? 0 : trillions >= 10 ? 1 : 2)}T`;
    }
    if (num >= 1e9) {
      const billions = num / 1e9;
      return `$${billions.toFixed(billions >= 100 ? 0 : billions >= 10 ? 1 : 2)}B`;
    }
    if (num >= 1e6) {
      const millions = num / 1e6;
      return `$${millions.toFixed(millions >= 100 ? 0 : millions >= 10 ? 1 : 2)}M`;
    }
    return `$${num.toFixed(2)}`;
  };
  
  console.log('格式化总市值:', formatMarketCap(totalMarketCap));
  
  // 测试最大市值股票
  const largest = stocksWithMarketCap.reduce((max, stock) => {
    return stock.marketCap > max.marketCap ? stock : max;
  }, stocksWithMarketCap[0]);
  
  const largestCapValue = largest.marketCap * 1000000;
  console.log('\n最大市值股票:');
  console.log('股票:', largest.symbol);
  console.log('市值（百万美元）:', largest.marketCap);
  console.log('市值（美元）:', largestCapValue);
  console.log('格式化市值:', formatMarketCap(largestCapValue));
};

testMarketCapCalculation();