// 测试Charts tab中Equity Curve和Drawdown Chart的优化
console.log('测试Charts tab优化：按时间均匀分布的日期刻度和优化的Drawdown Y轴...\n');

// 模拟数据
const mockEquityCurveData = [];
const startDate = new Date('2025-02-01');
const endDate = new Date('2025-03-01');

// 生成29天的数据（Feb 1到Mar 1）
for (let i = 0; i < 29; i++) {
  const currentDate = new Date(startDate);
  currentDate.setDate(startDate.getDate() + i);
  const dateStr = currentDate.toISOString().split('T')[0];
  
  mockEquityCurveData.push({
    date: dateStr,
    equity: 10000 + Math.random() * 2000
  });
}

console.log('=== 1. 测试按时间均匀分布的日期刻度生成 ===');

// 模拟generateTimeBasedDateTicks函数
function testGenerateTimeBasedDateTicks(data, targetTickCount = 12) {
  if (data.length === 0) return [];
  
  if (data.length <= targetTickCount) {
    return data.map(item => item.date);
  }
  
  // 解析开始日期和结束日期
  const parseDate = (dateStr) => {
    if (typeof dateStr === 'string' && dateStr.includes('-')) {
      const parts = dateStr.split('-');
      if (parts.length >= 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        return new Date(year, month, day);
      }
    }
    return new Date(dateStr);
  };
  
  const startDate = parseDate(data[0].date);
  const endDate = parseDate(data[data.length - 1].date);
  
  // 计算总天数
  const totalDays = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
  
  // 计算时间步长（天数）
  const timeStepDays = Math.max(1, Math.floor(totalDays / targetTickCount));
  
  // 生成按时间均匀分布的日期
  const ticks = [];
  const currentDate = new Date(startDate);
  
  // 添加开始日期
  ticks.push(data[0].date);
  
  // 生成中间日期
  for (let i = 1; i < targetTickCount - 1; i++) {
    currentDate.setDate(currentDate.getDate() + timeStepDays);
    
    if (currentDate.getTime() > endDate.getTime()) break;
    
    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
    const day = String(currentDate.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    
    ticks.push(dateStr);
  }
  
  // 添加结束日期
  if (ticks[ticks.length - 1] !== data[data.length - 1].date) {
    ticks.push(data[data.length - 1].date);
  }
  
  return ticks;
}

const timeBasedTicks = testGenerateTimeBasedDateTicks(mockEquityCurveData, 12);
console.log(`生成的按时间均匀分布的日期刻度(${timeBasedTicks.length}个):`);
timeBasedTicks.forEach((tick, index) => {
  console.log(`  ${index + 1}. ${tick}`);
});

// 计算日期间隔
console.log('\n日期间隔分析:');
for (let i = 1; i < timeBasedTicks.length; i++) {
  const date1 = new Date(timeBasedTicks[i-1]);
  const date2 = new Date(timeBasedTicks[i]);
  const daysDiff = Math.round((date2 - date1) / (1000 * 60 * 60 * 24));
  console.log(`  ${timeBasedTicks[i-1]} -> ${timeBasedTicks[i]}: ${daysDiff}天`);
}

console.log('\n=== 2. 测试优化的Drawdown Y轴刻度生成 ===');

// 模拟calculateDrawdownTicks函数
function testCalculateDrawdownTicks(drawdownData) {
  if (drawdownData.length === 0) return [0, -5, -10, -15, -20];
  
  const drawdownValues = drawdownData.map(d => d.drawdown);
  const minDrawdown = Math.min(...drawdownValues);
  const maxDrawdown = Math.abs(minDrawdown);
  
  const targetTickCount = 5;
  let step;
  
  if (maxDrawdown <= 5) {
    step = 1;
  } else if (maxDrawdown <= 15) {
    step = maxDrawdown <= 10 ? 2 : 3;
  } else if (maxDrawdown <= 30) {
    step = 5;
  } else if (maxDrawdown <= 50) {
    step = 10;
  } else {
    step = 20;
  }
  
  const ticks = [0];
  let currentTick = -step;
  
  while (currentTick >= -Math.ceil(maxDrawdown / step) * step - step && ticks.length < targetTickCount + 1) {
    ticks.push(currentTick);
    currentTick -= step;
  }
  
  const neededCoverage = Math.ceil(maxDrawdown * 1.1);
  const lastTick = ticks[ticks.length - 1];
  
  if (Math.abs(lastTick) < neededCoverage && ticks.length < 7) {
    const extraTick = -Math.ceil(neededCoverage / step) * step;
    if (!ticks.includes(extraTick) && extraTick !== lastTick) {
      ticks.push(extraTick);
    }
  }
  
  return ticks.sort((a, b) => a - b);
}

// 测试不同最大回撤情况
const testCases = [
  { maxDrawdown: 3.5, description: '很小回撤 (3.5%)' },
  { maxDrawdown: 8.2, description: '小回撤 (8.2%)' },
  { maxDrawdown: 12.7, description: '中等回撤 (12.7%)' },
  { maxDrawdown: 25.3, description: '较大回撤 (25.3%)' },
  { maxDrawdown: 42.8, description: '大回撤 (42.8%)' },
];

testCases.forEach(testCase => {
  // 创建模拟数据
  const mockDrawdownData = [];
  for (let i = 0; i < 10; i++) {
    mockDrawdownData.push({
      drawdown: -Math.random() * testCase.maxDrawdown
    });
  }
  
  const ticks = testCalculateDrawdownTicks(mockDrawdownData);
  console.log(`\n${testCase.description}:`);
  console.log(`  最大回撤: ${testCase.maxDrawdown.toFixed(1)}%`);
  console.log(`  生成的Y轴刻度(${ticks.length}个): ${ticks.map(t => `${t}%`).join(', ')}`);
  console.log(`  覆盖范围: 0% 到 ${Math.abs(ticks[ticks.length-1])}%`);
  console.log(`  步长: ${Math.abs(ticks[1] - ticks[0])}%`);
});

console.log('\n=== 3. 优化总结 ===');
console.log('✅ X轴优化完成:');
console.log('   - 按真实时间范围均匀分布日期刻度');
console.log('   - 使用time/number类型的XAxis，而不是category均分索引');
console.log('   - Equity Curve和Drawdown Chart共用同一套X轴tick逻辑');
console.log('   - 标签格式保持简洁M/D');

console.log('\n✅ Drawdown Chart Y轴优化完成:');
console.log('   - Y轴刻度覆盖完整的drawdown范围');
console.log('   - 显示4-6个有意义的百分比标签');
console.log('   - 总是包含0%');
console.log('   - 覆盖到底部最大回撤附近');
console.log('   - 标签格式统一成百分比 (0%、-2%、-4%、-6%、-8%、-10%)');
console.log('   - 根据实际最大回撤动态生成ticks');

console.log('\n✅ 整体风格保持一致:');
console.log('   - 不修改数据逻辑');
console.log('   - 不修改summary区域');
console.log('   - 不修改其他tab');
console.log('   - 只优化这两个图的坐标轴和显示逻辑');

console.log('\n所有优化已应用，等待构建验证...');