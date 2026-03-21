// 完整模拟1 Week数据处理
console.log('=== 完整模拟1 Week数据处理 ===\n');

// 模拟从Twelve Data获取的30分钟数据（实际可能的数据）
const mockTwelveData = [];
const now = new Date();

// 生成7天的数据（3/13 - 3/19）
for (let day = 0; day < 7; day++) {
  const date = new Date('2026-03-13T09:30:00.000Z');
  date.setUTCDate(date.getUTCDate() + day);
  
  // 每天的交易时间点
  const times = [
    [9, 30], [10, 0], [10, 30], [11, 0], [11, 30],
    [12, 0], [12, 30], [13, 0], [13, 30], [14, 0],
    [14, 30], [15, 0], [15, 30]
  ];
  
  for (const [hour, minute] of times) {
    const pointDate = new Date(date);
    pointDate.setUTCHours(hour, minute, 0, 0);
    
    // 模拟价格数据
    const basePrice = 245 + Math.random() * 10;
    mockTwelveData.push({
      datetime: `${pointDate.getUTCFullYear()}-${String(pointDate.getUTCMonth() + 1).padStart(2, '0')}-${String(pointDate.getUTCDate()).padStart(2, '0')} ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`,
      open: (basePrice - 0.5).toFixed(2),
      high: (basePrice + 0.3).toFixed(2),
      low: (basePrice - 0.7).toFixed(2),
      close: basePrice.toFixed(2),
      volume: Math.floor(Math.random() * 1000000).toString()
    });
  }
}

console.log('1. Twelve Data原始数据点数:', mockTwelveData.length);
console.log('   前3个点:');
for (let i = 0; i < 3; i++) {
  console.log(`     ${i+1}. ${mockTwelveData[i].datetime}`);
}
console.log('   最后3个点:');
for (let i = mockTwelveData.length - 3; i < mockTwelveData.length; i++) {
  console.log(`     ${i+1}. ${mockTwelveData[i].datetime}`);
}

// 模拟后端处理
const backendProcessed = mockTwelveData.map(item => ({
  time: item.datetime,
  open: Number(item.open),
  high: Number(item.high),
  low: Number(item.low),
  close: Number(item.close),
  volume: Number(item.volume)
}));

console.log('\n2. 后端处理后数据点数:', backendProcessed.length);

// 模拟前端处理（简化版）
console.log('\n3. 模拟前端1 Week处理逻辑:');

// 目标起点：3/13 09:30
const targetStartDate = new Date('2026-03-13T09:30:00.000Z');
console.log('   目标起点:', 
  `${targetStartDate.getUTCMonth() + 1}/${targetStartDate.getUTCDate()} ` +
  `${targetStartDate.getUTCHours()}:${targetStartDate.getUTCMinutes().toString().padStart(2, '0')} UTC`
);

// 过滤交易时间数据
const tradingData = backendProcessed.filter(item => {
  const date = new Date(item.time);
  const hour = date.getUTCHours();
  const minute = date.getUTCMinutes();
  return (minute === 0 || minute === 30) && hour >= 9 && hour <= 15;
});

console.log('   交易时间数据点数:', tradingData.length);

// 构建最终数据（包含16:00）
const finalData = [];
const daysToBuild = 7;

for (let day = 0; day < daysToBuild; day++) {
  const dayDate = new Date(targetStartDate);
  dayDate.setUTCDate(targetStartDate.getUTCDate() + day);
  
  const tradingTimes = [
    [9, 30], [10, 0], [10, 30], [11, 0], [11, 30],
    [12, 0], [12, 30], [13, 0], [13, 30], [14, 0],
    [14, 30], [15, 0], [15, 30], [16, 0]  // 包含16:00
  ];
  
  for (const [hour, minute] of tradingTimes) {
    const pointDate = new Date(dayDate);
    pointDate.setUTCHours(hour, minute, 0, 0);
    
    // 查找数据
    const foundItem = tradingData.find(item => {
      const itemDate = new Date(item.time);
      return itemDate.getTime() === pointDate.getTime();
    });
    
    if (foundItem) {
      finalData.push({
        date: pointDate.toISOString(),
        close: foundItem.close
      });
    } else if (hour === 16 && minute === 0) {
      // 16:00占位点
      const prevPrice = finalData.length > 0 ? finalData[finalData.length - 1].close : 0;
      finalData.push({
        date: pointDate.toISOString(),
        close: prevPrice
      });
    }
  }
}

console.log('\n4. finalData 结果:');
console.log('   总点数:', finalData.length, '(预期: 7天 × 14点 = 98点)');
console.log('   第一个点:');
if (finalData.length > 0) {
  const firstDate = new Date(finalData[0].date);
  console.log(`     ${firstDate.getUTCMonth() + 1}/${firstDate.getUTCDate()} ${firstDate.getUTCHours()}:${firstDate.getUTCMinutes().toString().padStart(2, '0')} UTC`);
}
console.log('   最后一个点:');
if (finalData.length > 0) {
  const lastDate = new Date(finalData[finalData.length - 1].date);
  console.log(`     ${lastDate.getUTCMonth() + 1}/${lastDate.getUTCDate()} ${lastDate.getUTCHours()}:${lastDate.getUTCMinutes().toString().padStart(2, '0')} UTC`);
}

console.log('\n5. 前10个点:');
for (let i = 0; i < Math.min(10, finalData.length); i++) {
  const date = new Date(finalData[i].date);
  console.log(`   ${i+1}. ${date.getUTCMonth() + 1}/${date.getUTCDate()} ${date.getUTCHours()}:${date.getUTCMinutes().toString().padStart(2, '0')} - ${finalData[i].close}`);
}

console.log('\n6. 后10个点:');
for (let i = Math.max(0, finalData.length - 10); i < finalData.length; i++) {
  const date = new Date(finalData[i].date);
  console.log(`   ${i+1}. ${date.getUTCMonth() + 1}/${date.getUTCDate()} ${date.getUTCHours()}:${date.getUTCMinutes().toString().padStart(2, '0')} - ${finalData[i].close}`);
}

// 模拟 get1WeekTicks
console.log('\n7. get1WeekTicks 输出:');
const pointsPerDay = 14;
const ticks = [];

for (let day = 0; day < 7; day++) {
  const dayStartIndex = day * pointsPerDay;
  if (dayStartIndex >= finalData.length) break;
  
  // 09:30
  ticks.push(finalData[dayStartIndex].date);
  
  // 12:00
  const noonIndex = dayStartIndex + 5;
  if (noonIndex < finalData.length) {
    ticks.push(finalData[noonIndex].date);
  }
  
  // 16:00
  const closeIndex = dayStartIndex + 13;
  if (closeIndex < finalData.length) {
    ticks.push(finalData[closeIndex].date);
  }
}

console.log('   ticks数量:', ticks.length, '(预期: 7天 × 3 = 21)');
console.log('   ticks内容:');
for (let i = 0; i < ticks.length; i++) {
  const date = new Date(ticks[i]);
  console.log(`   ${i+1}. ${date.getUTCMonth() + 1}/${date.getUTCDate()} ${date.getUTCHours()}:${date.getUTCMinutes().toString().padStart(2, '0')}`);
}

console.log('\n=== 总结 ===');
console.log('1. 第一个点:', finalData.length > 0 ? 
  `${new Date(finalData[0].date).getUTCMonth() + 1}/${new Date(finalData[0].date).getUTCDate()} ${new Date(finalData[0].date).getUTCHours()}:${new Date(finalData[0].date).getUTCMinutes().toString().padStart(2, '0')}` : '无数据');
console.log('2. 最后一个点:', finalData.length > 0 ? 
  `${new Date(finalData[finalData.length - 1].date).getUTCMonth() + 1}/${new Date(finalData[finalData.length - 1].date).getUTCDate()} ${new Date(finalData[finalData.length - 1].date).getUTCHours()}:${new Date(finalData[finalData.length - 1].date).getUTCMinutes().toString().padStart(2, '0')}` : '无数据');
console.log('3. 总点数:', finalData.length, finalData.length === 98 ? '✓ 正确' : '✗ 错误');
console.log('4. X轴标签:', ticks.length, '个', ticks.length === 21 ? '✓ 正确' : '✗ 错误');