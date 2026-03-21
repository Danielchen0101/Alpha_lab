// 基于真实Twelve Data响应的分析
console.log('=== 基于真实Twelve Data响应的分析 ===\n');

// 真实Twelve Data响应数据（35个点）
const realTwelveData = [
  { time: '2026-03-13 09:30:00' },
  { time: '2026-03-13 10:30:00' },
  { time: '2026-03-13 11:30:00' },
  { time: '2026-03-13 12:30:00' },
  { time: '2026-03-13 13:30:00' },
  { time: '2026-03-13 14:30:00' },
  { time: '2026-03-13 15:30:00' },
  { time: '2026-03-16 09:30:00' },
  { time: '2026-03-16 10:30:00' },
  { time: '2026-03-16 11:30:00' },
  { time: '2026-03-16 12:30:00' },
  { time: '2026-03-16 13:30:00' },
  { time: '2026-03-16 14:30:00' },
  { time: '2026-03-16 15:30:00' },
  { time: '2026-03-17 09:30:00' },
  { time: '2026-03-17 10:30:00' },
  { time: '2026-03-17 11:30:00' },
  { time: '2026-03-17 12:30:00' },
  { time: '2026-03-17 13:30:00' },
  { time: '2026-03-17 14:30:00' },
  { time: '2026-03-17 15:30:00' },
  { time: '2026-03-18 09:30:00' },
  { time: '2026-03-18 10:30:00' },
  { time: '2026-03-18 11:30:00' },
  { time: '2026-03-18 12:30:00' },
  { time: '2026-03-18 13:30:00' },
  { time: '2026-03-18 14:30:00' },
  { time: '2026-03-18 15:30:00' },
  { time: '2026-03-19 09:30:00' },
  { time: '2026-03-19 10:30:00' },
  { time: '2026-03-19 11:30:00' },
  { time: '2026-03-19 12:30:00' },
  { time: '2026-03-19 13:30:00' },
  { time: '2026-03-19 14:30:00' },
  { time: '2026-03-19 15:30:00' }
];

console.log('1. Twelve Data原始数据分析:');
console.log('   总点数:', realTwelveData.length);
console.log('   时间范围:', realTwelveData[0].time, '到', realTwelveData[realTwelveData.length - 1].time);

// 分析时间模式
const timePatterns = {};
realTwelveData.forEach(item => {
  const time = item.time.split(' ')[1]; // 获取HH:MM:SS部分
  timePatterns[time] = (timePatterns[time] || 0) + 1;
});

console.log('   时间模式:');
Object.keys(timePatterns).sort().forEach(time => {
  console.log(`     ${time}: ${timePatterns[time]}次`);
});

// 分析日期分布
const dateDistribution = {};
realTwelveData.forEach(item => {
  const date = item.time.split(' ')[0]; // 获取YYYY-MM-DD部分
  dateDistribution[date] = (dateDistribution[date] || 0) + 1;
});

console.log('   日期分布:');
Object.keys(dateDistribution).sort().forEach(date => {
  console.log(`     ${date}: ${dateDistribution[date]}个点`);
});

// 模拟前端formattedData
console.log('\n2. 模拟前端formattedData:');
const formattedData = realTwelveData.map(item => {
  const date = new Date(item.time.replace(' ', 'T') + 'Z'); // 转换为UTC
  return {
    date: date.toISOString(),
    close: 250 + Math.random() * 10 // 模拟价格
  };
});

console.log('   formattedData点数:', formattedData.length);
console.log('   formattedData前5个点:');
for (let i = 0; i < Math.min(5, formattedData.length); i++) {
  const date = new Date(formattedData[i].date);
  console.log(`     ${i+1}. ${date.getUTCMonth() + 1}/${date.getUTCDate()} ${date.getUTCHours()}:${date.getUTCMinutes().toString().padStart(2, '0')} UTC`);
}

// 模拟前端1 Week处理逻辑
console.log('\n3. 模拟前端1 Week处理逻辑:');

// 目标起点：3/13 09:30
const targetStartDate = new Date('2026-03-13T09:30:00.000Z');
console.log('   目标起点:', 
  `${targetStartDate.getUTCMonth() + 1}/${targetStartDate.getUTCDate()} ` +
  `${targetStartDate.getUTCHours()}:${targetStartDate.getUTCMinutes().toString().padStart(2, '0')} UTC`
);

// 过滤交易时间数据（根据前端代码）
const tradingData = formattedData.filter(item => {
  const date = new Date(item.date);
  const hour = date.getUTCHours();
  const minute = date.getUTCMinutes();
  
  // 前端代码中的过滤条件
  const is30MinInterval = minute === 0 || minute === 30;
  const isTradingHour = (hour >= 9 && hour <= 15) || (hour === 16 && minute === 0);
  
  return is30MinInterval && isTradingHour;
});

console.log('   过滤后tradingData点数:', tradingData.length);
console.log('   过滤条件: is30MinInterval (minute === 0 || minute === 30)');
console.log('            isTradingHour (hour >= 9 && hour <= 15) || (hour === 16 && minute === 0)');

// 检查哪些数据被过滤掉了
console.log('   原始数据分钟分布:');
const minuteCounts = {};
formattedData.forEach(item => {
  const date = new Date(item.date);
  const minute = date.getUTCMinutes();
  minuteCounts[minute] = (minuteCounts[minute] || 0) + 1;
});

Object.keys(minuteCounts).sort((a, b) => a - b).forEach(minute => {
  console.log(`     分钟 ${minute}: ${minuteCounts[minute]}个点`);
});

// 构建finalData（模拟前端逻辑）
console.log('\n4. 模拟finalData构建:');
const finalData = [];
const daysToBuild = 7;

for (let day = 0; day < daysToBuild; day++) {
  const dayDate = new Date(targetStartDate);
  dayDate.setUTCDate(targetStartDate.getUTCDate() + day);
  
  const tradingTimes = [
    [9, 30], [10, 0], [10, 30], [11, 0], [11, 30],
    [12, 0], [12, 30], [13, 0], [13, 30], [14, 0],
    [14, 30], [15, 0], [15, 30], [16, 0]
  ];
  
  for (const [hour, minute] of tradingTimes) {
    const pointDate = new Date(dayDate);
    pointDate.setUTCHours(hour, minute, 0, 0);
    
    // 查找对应的数据
    const foundItem = tradingData.find(item => {
      const itemDate = new Date(item.date);
      return itemDate.getTime() === pointDate.getTime();
    });
    
    if (foundItem) {
      finalData.push(foundItem);
    } else {
      // 占位点
      finalData.push({
        date: pointDate.toISOString(),
        close: 0
      });
    }
  }
}

console.log('   finalData点数:', finalData.length, '(预期: 7天 × 14点 = 98点)');
console.log('   finalData前20个点:');
for (let i = 0; i < Math.min(20, finalData.length); i++) {
  const date = new Date(finalData[i].date);
  console.log(`     ${i+1}. ${date.getUTCMonth() + 1}/${date.getUTCDate()} ${date.getUTCHours()}:${date.getUTCMinutes().toString().padStart(2, '0')} UTC`);
}

// 模拟get1WeekTicks
console.log('\n5. 模拟get1WeekTicks输出:');
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
  console.log(`     ${i+1}. ${date.getUTCMonth() + 1}/${date.getUTCDate()} ${date.getUTCHours()}:${date.getUTCMinutes().toString().padStart(2, '0')} UTC`);
}

console.log('\n=== 问题诊断 ===');

// 诊断为什么从13:30开始
console.log('1. 为什么finalData从13:30开始？');
console.log('   - Twelve Data原始数据只有:30的数据（没有:00）');
console.log('   - 前端过滤条件: is30MinInterval (minute === 0 || minute === 30)');
console.log('   - 但Twelve Data返回的是:30数据，所以minute=30，通过过滤');
console.log('   - 问题：前端构建逻辑假设有:00数据，但实际上没有');

// 诊断为什么只有42个点
console.log('\n2. 为什么只有42个点？');
console.log('   - Twelve Data只有35个原始数据点');
console.log('   - 缺少3/14和3/15的数据（可能是周末）');
console.log('   - 每天只有7个点（09:30, 10:30, 11:30, 12:30, 13:30, 14:30, 15:30）');
console.log('   - 没有:00数据和16:00数据');

console.log('\n=== 真实原因总结 ===');
console.log('1. Twelve Data API问题：');
console.log('   - 30分钟间隔只返回:30数据，没有:00数据');
console.log('   - 数据不连续（缺少某些天）');
console.log('   - 没有16:00收盘价数据');
console.log('');
console.log('2. 前端处理问题：');
console.log('   - 假设Twelve Data会返回完整的:00和:30数据');
console.log('   - 构建逻辑依赖完整的数据集');
console.log('   - 过滤条件与数据源不匹配');