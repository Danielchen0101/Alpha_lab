// 模拟前端数据流测试
console.log("模拟前端图表数据流测试");
console.log("=" .repeat(60));

// 模拟后端返回的数据结构
const mockApiResponse = {
  symbol: "AAPL",
  interval: "1day",
  range: "1month",
  count: 21,
  source: "yahoo_real",
  message: "Real historical data from yahoo_real",
  data: [
    {
      close: 261.7300109863281,
      high: 275.7200012207031,
      low: 260.17999267578125,
      open: 275.5899963378906,
      time: "2026-02-12T00:00:00-05:00",
      timestamp: 1770872400,
      volume: 81077200
    },
    {
      close: 255.77999877929688,
      high: 262.2300109863281,
      low: 255.4499969482422,
      open: 262.010009765625,
      time: "2026-02-13T00:00:00-05:00",
      timestamp: 1770958800,
      volume: 56290700
    }
  ]
};

console.log("1. 后端 API 响应:");
console.log(JSON.stringify(mockApiResponse, null, 2));

console.log("\n2. 前端数据转换逻辑:");
console.log("原始代码:");
console.log(`
const formattedData = response.data.map((item: any) => ({
  date: new Date(item.timestamp).toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    ...(selectedTimeframe === '1D' ? { hour: '2-digit', minute: '2-digit' } : {})
  }),
  open: item.open,
  high: item.high,
  low: item.low,
  close: item.close,
  volume: item.volume
}));
`);

// 模拟转换
const selectedTimeframe = '1M';
const formattedData = mockApiResponse.data.map((item) => ({
  date: new Date(item.timestamp * 1000).toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    ...(selectedTimeframe === '1D' ? { hour: '2-digit', minute: '2-digit' } : {})
  }),
  open: item.open,
  high: item.high,
  low: item.low,
  close: item.close,
  volume: item.volume
}));

console.log("\n3. 转换后的数据:");
console.log(JSON.stringify(formattedData, null, 2));

console.log("\n4. 问题分析:");
console.log("a) 时间戳转换问题:");
console.log("   - 后端 timestamp: 1770872400 (秒)");
console.log("   - new Date(timestamp * 1000):", new Date(1770872400 * 1000));
console.log("   - 转换后 date:", formattedData[0].date);

console.log("\nb) 图表组件期望的字段:");
console.log("   - 蜡烛图需要: date, open, high, low, close, volume");
console.log("   - 当前有: date, open, high, low, close, volume ✓");

console.log("\nc) 图表渲染条件:");
console.log("   - historicalData.length > 0:", formattedData.length > 0);
console.log("   - 如果为 true，应显示图表");
console.log("   - 如果为 false，显示 'No historical data available'");

console.log("\n5. 潜在问题:");
console.log("a) 时间戳单位错误:");
console.log("   - 后端可能返回毫秒，但前端按秒处理");
console.log("   - 检查: new Date(1770872400) vs new Date(1770872400 * 1000)");

console.log("\nb) 日期格式问题:");
console.log("   - toLocaleDateString 可能返回空字符串");
console.log("   - 时区问题可能导致无效日期");

console.log("\nc) 数据验证:");
console.log("   - 检查 open/high/low/close 是否为有效数字");
console.log("   - 检查 volume 是否为有效数字");

console.log("\n6. 修复建议:");
console.log("a) 添加数据验证:");
console.log(`
const formattedData = response.data.map((item: any) => {
  const date = new Date(item.timestamp * 1000);
  if (isNaN(date.getTime())) {
    console.error('Invalid date:', item.timestamp, item.time);
    return null;
  }
  
  return {
    date: date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric'
    }),
    open: Number(item.open) || 0,
    high: Number(item.high) || 0,
    low: Number(item.low) || 0,
    close: Number(item.close) || 0,
    volume: Number(item.volume) || 0
  };
}).filter(item => item !== null);
`);

console.log("\nb) 添加调试日志:");
console.log(`
console.log('API Response:', response);
console.log('Data points:', response.data?.length);
console.log('First data point:', response.data?.[0]);
console.log('Formatted data:', formattedData);
`);

console.log("\n7. 测试转换:");
const testTimestamp = 1770872400;
const date1 = new Date(testTimestamp); // 错误：按毫秒处理
const date2 = new Date(testTimestamp * 1000); // 正确：秒转毫秒

console.log("timestamp:", testTimestamp);
console.log("new Date(timestamp):", date1, "(可能错误)");
console.log("new Date(timestamp * 1000):", date2, "(正确)");
console.log("date1.toLocaleDateString():", date1.toLocaleDateString());
console.log("date2.toLocaleDateString():", date2.toLocaleDateString());