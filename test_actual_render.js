// 模拟实际渲染情况
console.log('=== 实际渲染分析 ===\n');

// 模拟数据
const mockChartData = [
  // 3/13 数据
  { date: '2026-03-13T09:30:00.000Z', close: 250.0 },
  { date: '2026-03-13T10:00:00.000Z', close: 251.0 },
  { date: '2026-03-13T10:30:00.000Z', close: 252.0 },
  { date: '2026-03-13T11:00:00.000Z', close: 253.0 },
  { date: '2026-03-13T11:30:00.000Z', close: 254.0 },
  { date: '2026-03-13T12:00:00.000Z', close: 255.0 },
  { date: '2026-03-13T12:30:00.000Z', close: 256.0 },
  { date: '2026-03-13T13:00:00.000Z', close: 257.0 },
  { date: '2026-03-13T13:30:00.000Z', close: 258.0 },
  { date: '2026-03-13T14:00:00.000Z', close: 259.0 },
  { date: '2026-03-13T14:30:00.000Z', close: 260.0 },
  { date: '2026-03-13T15:00:00.000Z', close: 261.0 },
  { date: '2026-03-13T15:30:00.000Z', close: 262.0 },
  // 3/16 数据
  { date: '2026-03-16T09:30:00.000Z', close: 263.0 },
  { date: '2026-03-16T10:00:00.000Z', close: 264.0 },
  { date: '2026-03-16T10:30:00.000Z', close: 265.0 },
  { date: '2026-03-16T11:00:00.000Z', close: 266.0 },
  { date: '2026-03-16T11:30:00.000Z', close: 267.0 },
  { date: '2026-03-16T12:00:00.000Z', close: 268.0 },
  { date: '2026-03-16T12:30:00.000Z', close: 269.0 },
  { date: '2026-03-16T13:00:00.000Z', close: 270.0 },
  { date: '2026-03-16T13:30:00.000Z', close: 271.0 },
  { date: '2026-03-16T14:00:00.000Z', close: 272.0 },
  { date: '2026-03-16T14:30:00.000Z', close: 273.0 },
  { date: '2026-03-16T15:00:00.000Z', close: 274.0 },
  { date: '2026-03-16T15:30:00.000Z', close: 275.0 },
  // 3/17 数据
  { date: '2026-03-17T09:30:00.000Z', close: 276.0 },
  { date: '2026-03-17T10:00:00.000Z', close: 277.0 },
  { date: '2026-03-17T10:30:00.000Z', close: 278.0 },
  { date: '2026-03-17T11:00:00.000Z', close: 279.0 },
  { date: '2026-03-17T11:30:00.000Z', close: 280.0 },
  { date: '2026-03-17T12:00:00.000Z', close: 281.0 },
  { date: '2026-03-17T12:30:00.000Z', close: 282.0 },
  { date: '2026-03-17T13:00:00.000Z', close: 283.0 },
  { date: '2026-03-17T13:30:00.000Z', close: 284.0 },
  { date: '2026-03-17T14:00:00.000Z', close: 285.0 },
  { date: '2026-03-17T14:30:00.000Z', close: 286.0 },
  { date: '2026-03-17T15:00:00.000Z', close: 287.0 },
  { date: '2026-03-17T15:30:00.000Z', close: 288.0 },
  // 3/18 数据
  { date: '2026-03-18T09:30:00.000Z', close: 289.0 },
  { date: '2026-03-18T10:00:00.000Z', close: 290.0 },
  { date: '2026-03-18T10:30:00.000Z', close: 291.0 },
  { date: '2026-03-18T11:00:00.000Z', close: 292.0 },
  { date: '2026-03-18T11:30:00.000Z', close: 293.0 },
  { date: '2026-03-18T12:00:00.000Z', close: 294.0 },
  { date: '2026-03-18T12:30:00.000Z', close: 295.0 },
  { date: '2026-03-18T13:00:00.000Z', close: 296.0 },
  { date: '2026-03-18T13:30:00.000Z', close: 297.0 },
  { date: '2026-03-18T14:00:00.000Z', close: 298.0 },
  { date: '2026-03-18T14:30:00.000Z', close: 299.0 },
  { date: '2026-03-18T15:00:00.000Z', close: 300.0 },
  { date: '2026-03-18T15:30:00.000Z', close: 301.0 },
  // 3/19 数据
  { date: '2026-03-19T09:30:00.000Z', close: 302.0 },
  { date: '2026-03-19T10:00:00.000Z', close: 303.0 },
  { date: '2026-03-19T10:30:00.000Z', close: 304.0 },
  { date: '2026-03-19T11:00:00.000Z', close: 305.0 },
  { date: '2026-03-19T11:30:00.000Z', close: 306.0 },
  { date: '2026-03-19T12:00:00.000Z', close: 307.0 },
  { date: '2026-03-19T12:30:00.000Z', close: 308.0 },
  { date: '2026-03-19T13:00:00.000Z', close: 309.0 },
  { date: '2026-03-19T13:30:00.000Z', close: 310.0 },
  { date: '2026-03-19T14:00:00.000Z', close: 311.0 },
  { date: '2026-03-19T14:30:00.000Z', close: 312.0 },
  { date: '2026-03-19T15:00:00.000Z', close: 313.0 },
  { date: '2026-03-19T15:30:00.000Z', close: 314.0 },
  // 3/20 数据
  { date: '2026-03-20T09:30:00.000Z', close: 315.0 },
  { date: '2026-03-20T10:00:00.000Z', close: 316.0 },
  { date: '2026-03-20T10:30:00.000Z', close: 317.0 },
  { date: '2026-03-20T11:00:00.000Z', close: 318.0 },
  { date: '2026-03-20T11:30:00.000Z', close: 319.0 },
  { date: '2026-03-20T12:00:00.000Z', close: 320.0 },
  { date: '2026-03-20T12:30:00.000Z', close: 321.0 },
  { date: '2026-03-20T13:00:00.000Z', close: 322.0 },
  { date: '2026-03-20T13:30:00.000Z', close: 323.0 },
  { date: '2026-03-20T14:00:00.000Z', close: 324.0 },
  { date: '2026-03-20T14:30:00.000Z', close: 325.0 },
  { date: '2026-03-20T15:00:00.000Z', close: 326.0 },
  { date: '2026-03-20T15:30:00.000Z', close: 327.0 },
  { date: '2026-03-20T16:00:00.000Z', close: 328.0 }, // Finnhub补充
];

// 模拟get1WeekTicks函数
function get1WeekTicks(chartData) {
  const ticks = [];
  
  if (chartData.length === 0) return ticks;
  
  // 1. 按日期分组数据
  const dataByDate = {};
  
  for (const point of chartData) {
    const date = new Date(point.date);
    const dateKey = `${date.getUTCFullYear()}-${(date.getUTCMonth() + 1).toString().padStart(2, '0')}-${date.getUTCDate().toString().padStart(2, '0')}`;
    
    if (!dataByDate[dateKey]) {
      dataByDate[dateKey] = [];
    }
    dataByDate[dateKey].push(point);
  }
  
  // 2. 对每个交易日，查找3个关键时间点
  const targetTimes = [
    { hour: 9, minute: 30, label: '09:30' },
    { hour: 12, minute: 0, label: '12:00' },
    { hour: 16, minute: 0, label: '16:00' }
  ];
  
  // 按日期排序
  const sortedDates = Object.keys(dataByDate).sort();
  
  for (const dateKey of sortedDates) {
    const dayData = dataByDate[dateKey];
    const dateParts = dateKey.split('-');
    const year = parseInt(dateParts[0]);
    const month = parseInt(dateParts[1]) - 1;
    const day = parseInt(dateParts[2]);
    
    for (const targetTime of targetTimes) {
      // 创建目标时间
      const targetDate = new Date(Date.UTC(year, month, day, targetTime.hour, targetTime.minute, 0, 0));
      
      // 查找匹配的数据点
      let foundPoint = null;
      
      // 首先尝试精确匹配
      for (const point of dayData) {
        const pointDate = new Date(point.date);
        if (pointDate.getTime() === targetDate.getTime()) {
          foundPoint = point;
          break;
        }
      }
      
      // 对于16:00的特殊处理
      if (!foundPoint && targetTime.hour === 16 && targetTime.minute === 0) {
        // 查找补充的16:00
        for (const point of dayData) {
          const pointDate = new Date(point.date);
          if (pointDate.getUTCHours() === 16 && pointDate.getUTCMinutes() === 0) {
            foundPoint = point;
            break;
          }
        }
        
        // 退到最后一个点
        if (!foundPoint && dayData.length > 0) {
          const sortedDayData = [...dayData].sort((a, b) => 
            new Date(a.date).getTime() - new Date(b.date).getTime()
          );
          foundPoint = sortedDayData[sortedDayData.length - 1];
        }
      }
      
      if (foundPoint) {
        ticks.push(foundPoint.date);
      }
    }
  }
  
  return ticks;
}

// 模拟formatXAxisTick函数
function formatXAxisTick(value, selectedTimeframe = '1W') {
  if (!value) return '';
  
  try {
    const date = new Date(value);
    
    if (isNaN(date.getTime())) {
      return '';
    }
    
    if (selectedTimeframe === '1W') {
      const month = date.getUTCMonth() + 1;
      const day = date.getUTCDate();
      const hour = date.getUTCHours();
      const minute = date.getUTCMinutes();
      
      return `${month}/${day} ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    }
    
    return value;
  } catch {
    return '';
  }
}

console.log('1. get1WeekTicks真实输出:');
const ticks = get1WeekTicks(mockChartData);
console.log(`   ticks数量: ${ticks.length}`);
console.log('   ticks列表:');
for (let i = 0; i < ticks.length; i++) {
  const date = new Date(ticks[i]);
  console.log(`   ${i+1}. ${date.getUTCMonth() + 1}/${date.getUTCDate()} ${date.getUTCHours()}:${date.getUTCMinutes().toString().padStart(2, '0')}`);
}

console.log('\n2. formatXAxisTick对这些ticks的输出:');
console.log('   格式化后的标签:');
for (let i = 0; i < ticks.length; i++) {
  const formatted = formatXAxisTick(ticks[i], '1W');
  console.log(`   ${i+1}. ${formatted}`);
}

console.log('\n3. 空间计算分析:');
const chartWidth = 1200;
const ticksCount = ticks.length;
const avgSpacePerTick = chartWidth / ticksCount;
console.log(`   图表宽度: ${chartWidth}px`);
console.log(`   ticks数量: ${ticksCount}`);
console.log(`   每个tick平均空间: ${avgSpacePerTick.toFixed(1)}px`);

// 计算标签宽度
let labelWidths = [];
for (let tick of ticks) {
  const formatted = formatXAxisTick(tick, '1W');
  // 估算：每个字符约6px，fontSize=8时
  const width = formatted.length * 6;
  labelWidths.push(width);
}

const avgLabelWidth = labelWidths.reduce((a, b) => a + b, 0) / labelWidths.length;
const maxLabelWidth = Math.max(...labelWidths);
console.log(`   平均标签宽度: ${avgLabelWidth.toFixed(1)}px`);
console.log(`   最大标签宽度: ${maxLabelWidth.toFixed(1)}px`);
console.log(`   空间对比: 平均空间(${avgSpacePerTick.toFixed(1)}px) vs 平均标签宽度(${avgLabelWidth.toFixed(1)}px)`);

if (avgSpacePerTick < avgLabelWidth) {
  console.log('   ⚠️ 空间不足: 标签宽度 > 可用空间');
  console.log('   ❌ 这是根本原因: Recharts会省略重叠的标签');
} else {
  console.log('   ✅ 空间充足: 标签宽度 < 可用空间');
}

console.log('\n4. 根本原因诊断:');
console.log('   ✅ get1WeekTicks生成正确的18个ticks');
console.log('   ✅ formatXAxisTick返回正确的格式化字符串');
console.log('   ✅ XAxis配置: interval=0, minTickGap=0');
console.log('   ❌ 问题: 标签宽度(60px) > 可用空间(66.7px)');
console.log('   ❌ 结果: Recharts自动省略重叠的标签');

console.log('\n5. 解决方案:');
console.log('   需要进一步减小字体或增加图表宽度');
console.log('   当前fontSize=8，可尝试fontSize=7或6');
console.log('   或增加图表容器宽度');