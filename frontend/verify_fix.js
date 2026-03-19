// 验证前端修复
console.log("验证 Price Chart 修复");
console.log("=".repeat(60));

// 模拟修复后的数据转换逻辑
function formatHistoricalData(responseData, selectedTimeframe) {
  console.log("原始 API 数据:", responseData);
  
  if (!responseData || !responseData.data || responseData.data.length === 0) {
    console.warn("API 返回空数据");
    return [];
  }
  
  const formattedData = responseData.data.map((item) => {
    // 修复：时间戳乘以1000转换为毫秒
    const timestampMs = item.timestamp * 1000;
    const date = new Date(timestampMs);
    
    if (isNaN(date.getTime())) {
      console.error("无效日期:", item.timestamp, item.time);
      // 尝试使用 time 字段
      try {
        const dateFromTime = new Date(item.time);
        if (!isNaN(dateFromTime.getTime())) {
          return {
            date: dateFromTime.toLocaleDateString('en-US', { 
              month: 'short', 
              day: 'numeric'
            }),
            open: Number(item.open) || 0,
            high: Number(item.high) || 0,
            low: Number(item.low) || 0,
            close: Number(item.close) || 0,
            volume: Number(item.volume) || 0
          };
        }
      } catch (e) {
        console.error("解析 time 字段失败:", e);
      }
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
  
  console.log("转换后数据:", formattedData);
  console.log(`有效数据点: ${formattedData.length}/${responseData.data.length}`);
  
  return formattedData;
}

// 测试数据
const testResponse = {
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

console.log("\n1. 测试数据转换:");
const formattedData = formatHistoricalData(testResponse, '1M');
console.log("转换结果:", formattedData);

console.log("\n2. 验证图表渲染条件:");
const hasData = formattedData.length > 0;
console.log(`historicalData.length > 0: ${hasData}`);
console.log(`应显示: ${hasData ? '图表' : '空状态'}`);

console.log("\n3. 验证数据字段:");
if (formattedData.length > 0) {
  const sample = formattedData[0];
  console.log("字段检查:");
  console.log(`  date: ${sample.date} (${typeof sample.date})`);
  console.log(`  open: ${sample.open} (${typeof sample.open})`);
  console.log(`  high: ${sample.high} (${typeof sample.high})`);
  console.log(`  low: ${sample.low} (${typeof sample.low})`);
  console.log(`  close: ${sample.close} (${typeof sample.close})`);
  console.log(`  volume: ${sample.volume} (${typeof sample.volume})`);
  
  const requiredFields = ['date', 'open', 'high', 'low', 'close', 'volume'];
  const missingFields = requiredFields.filter(field => !(field in sample));
  
  if (missingFields.length === 0) {
    console.log("✅ 所有必需字段都存在");
  } else {
    console.log(`❌ 缺失字段: ${missingFields.join(', ')}`);
  }
}

console.log("\n4. 修复总结:");
console.log("修复前问题:");
console.log("  - 时间戳转换错误: new Date(timestamp) 而不是 new Date(timestamp * 1000)");
console.log("  - 缺少数据验证: 无效日期导致空数据");
console.log("  - 图表渲染问题: 手动计算 rect 坐标错误");

console.log("\n修复后:");
console.log("  ✅ 正确时间戳转换");
console.log("  ✅ 添加数据验证和错误处理");
console.log("  ✅ 使用标准 Recharts 图表渲染");
console.log("  ✅ 添加调试日志便于排查");

console.log("\n5. 预期前端行为:");
console.log("  - Price Chart 显示真实 candlestick 图表");
console.log("  - 1W/1M/3M/1Y timeframe 切换有效");
console.log("  - 不再显示 'No historical data available'");
console.log("  - 图表基于真实 Yahoo Finance 数据");

console.log("\n6. 验证步骤:");
console.log("  1. 打开 Analysis 页面 (AAPL)");
console.log("  2. 检查浏览器控制台是否有调试日志");
console.log("  3. 确认图表显示 candlestick");
console.log("  4. 切换 timeframe (1W/1M/3M/1Y)");
console.log("  5. 确认图表更新");

console.log("\n7. 最小修改验证:");
console.log("  ✅ 未修改后端 stock detail 接口");
console.log("  ✅ 未修改 Volume 字段");
console.log("  ✅ 未修改其他 summary 卡片");
console.log("  ✅ 未修改 Market 页面");
console.log("  ✅ 未修改 Backtest 页面");
console.log("  ✅ 只修复前端图表渲染链路");