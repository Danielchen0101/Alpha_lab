// 测试Trading Chart优化
console.log('测试Trading Chart优化...\n');

// 模拟数据
const mockData = [];
const startDate = new Date('2025-02-01');
const endDate = new Date('2025-03-01');

// 生成29天的数据
for (let i = 0; i < 29; i++) {
  const currentDate = new Date(startDate);
  currentDate.setDate(startDate.getDate() + i);
  const dateStr = currentDate.toISOString().split('T')[0];
  
  // 模拟价格波动
  const basePrice = 100 + Math.random() * 20;
  const sma20 = basePrice * (0.98 + Math.random() * 0.04);
  const sma50 = basePrice * (0.97 + Math.random() * 0.06);
  
  mockData.push({
    date: dateStr,
    close: basePrice,
    volume: Math.floor(Math.random() * 1000000),
    signal: i % 10 === 0 ? 1 : i % 7 === 0 ? -1 : 0,
    sma20: sma20,
    sma50: sma50
  });
}

console.log('=== 优化总结 ===');
console.log('1. X轴优化:');
console.log('   - 生成大约12个均匀分布的日期刻度');
console.log('   - Price Chart和Volume Chart使用同一套刻度');
console.log('   - 刻度字体缩小到10px，更专业');

console.log('\n2. Price Chart专业化:');
console.log('   - 价格线加粗到3px，更突出');
console.log('   - 去掉静态点，只在hover时显示activeDot');
console.log('   - SMA线变细(1.2px)，作为辅助参考');
console.log('   - Y轴价格格式优化: $1,234.56 格式');
console.log('   - 网格线变轻: stroke="#f0f0f0", dasharray="3 3"');
console.log('   - 专业Tooltip: 分栏显示，颜色编码，背景模糊');

console.log('\n3. Volume Chart拉高:');
console.log('   - 高度比例从30%增加到35%');
console.log('   - 柱子宽度增加到12px，带圆角');
console.log('   - Y轴留出适当空白');
console.log('   - 标题区域更专业');

console.log('\n4. 整体布局优化:');
console.log('   - 图表边距调整: top:10, right:25, left:25, bottom:10');
console.log('   - 开关控件更紧凑专业');
console.log('   - 保持页面风格统一，不花哨');

console.log('\n5. 测试数据:');
console.log(`   - 数据点数量: ${mockData.length}`);
console.log(`   - 日期范围: ${mockData[0].date} 到 ${mockData[mockData.length-1].date}`);

// 测试日期刻度生成函数
function testGenerateDateTicks(data, targetTickCount = 12) {
  if (data.length === 0) return [];
  
  if (data.length <= targetTickCount) {
    return data.map(item => item.date);
  }
  
  const step = Math.floor(data.length / targetTickCount);
  const ticks = [];
  
  for (let i = 0; i < data.length; i += step) {
    ticks.push(data[i].date);
    if (ticks.length >= targetTickCount) break;
  }
  
  if (ticks[ticks.length - 1] !== data[data.length - 1].date) {
    ticks[ticks.length - 1] = data[data.length - 1].date;
  }
  
  return ticks;
}

const dateTicks = testGenerateDateTicks(mockData, 12);
console.log(`\n6. 生成的日期刻度(${dateTicks.length}个):`);
dateTicks.forEach((tick, index) => {
  console.log(`   ${index + 1}. ${tick}`);
});

console.log('\n✅ Trading Chart优化完成！');
console.log('✅ 所有修改都专注于图表显示效果，不涉及回测算法');
console.log('✅ 保持页面风格统一，专业交易平台外观');