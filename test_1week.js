// 模拟前端1 Week数据处理逻辑
console.log('=== 模拟1 Week数据处理测试 ===');

// 模拟从后端获取的数据（基于实际API响应）
const mockHistoricalData = [
  // 今天的数据点
  { time: '2026-03-20 15:30:00', open: '248.19', high: '248.20', low: '246.00', close: '248.19', volume: '6366085' },
  { time: '2026-03-20 15:00:00', open: '248.09', high: '249.20', low: '247.59', close: '248.09', volume: '3994932' },
  { time: '2026-03-20 14:30:00', open: '248.29', high: '248.76', low: '247.53', close: '248.04', volume: '3100413' },
  { time: '2026-03-20 14:00:00', open: '248.63', high: '248.79', low: '248.08', close: '248.27', volume: '2570162' },
  { time: '2026-03-20 13:30:00', open: '247.95', high: '249.06', low: '247.86', close: '248.62', volume: '2911321' },
  { time: '2026-03-20 13:00:00', open: '247.81', high: '248.85', low: '247.16', close: '247.99', volume: '6539448' },
  { time: '2026-03-20 12:30:00', open: '248.11', high: '248.76', low: '246.61', close: '247.76', volume: '26285192' },
  // 昨天的数据点
  { time: '2026-03-19 15:30:00', open: '248.44', high: '249.33', low: '248.28', close: '248.91', volume: '18119527' },
  { time: '2026-03-19 15:00:00', open: '248.01', high: '249.59', low: '247.67', close: '248.47', volume: '34262754' },
  { time: '2026-03-19 14:30:00', open: '248.30', high: '248.53', low: '247.67', close: '248.02', volume: '18631502' },
  // 更多数据点...
];

console.log('模拟数据点数:', mockHistoricalData.length);

// 模拟前端的数据处理逻辑
const formattedData = mockHistoricalData.map(item => {
  const date = new Date(item.time);
  return {
    date: date.toISOString(),
    open: Number(item.open) || 0,
    high: Number(item.high) || 0,
    low: Number(item.low) || 0,
    close: Number(item.close) || 0,
    volume: Number(item.volume) || 0
  };
});

console.log('\n=== 模拟1 Week数据处理 ===');
console.log('formattedData 前5个点:');
for (let i = 0; i < Math.min(5, formattedData.length); i++) {
  const item = formattedData[i];
  const date = new Date(item.date);
  console.log(`  ${i+1}. ${date.getUTCMonth() + 1}/${date.getUTCDate()} ${date.getUTCHours()}:${date.getUTCMinutes().toString().padStart(2, '0')} - ${item.close}`);
}

// 模拟 get1WeekTicks 函数
const get1WeekTicks = (chartData) => {
  const ticks = [];
  const pointsPerDay = 14;
  
  for (let day = 0; day < 7; day++) {
    const dayStartIndex = day * pointsPerDay;
    if (dayStartIndex >= chartData.length) break;
    
    // 09:30
    if (dayStartIndex < chartData.length) {
      ticks.push(chartData[dayStartIndex].date);
    }
    
    // 12:00
    const noonIndex = dayStartIndex + 5;
    if (noonIndex < chartData.length) {
      ticks.push(chartData[noonIndex].date);
    }
    
    // 16:00
    const closeIndex = dayStartIndex + 13;
    if (closeIndex < chartData.length) {
      ticks.push(chartData[closeIndex].date);
    }
  }
  
  return ticks;
};

console.log('\n=== 模拟 get1WeekTicks 输出 ===');
const ticks = get1WeekTicks(formattedData);
console.log('ticks 数量:', ticks.length);
console.log('ticks 内容:');
for (let i = 0; i < ticks.length; i++) {
  const date = new Date(ticks[i]);
  console.log(`  ${i+1}. ${date.getUTCMonth() + 1}/${date.getUTCDate()} ${date.getUTCHours()}:${date.getUTCMinutes().toString().padStart(2, '0')}`);
}