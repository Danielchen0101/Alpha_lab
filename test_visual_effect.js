// 测试4个图表的视觉效果
console.log("=== 4个图表视觉效果分析 ===");

// 1. 模拟29天数据
const data = [];
for (let i = 0; i < 29; i++) {
  const date = new Date('2025-02-01');
  date.setDate(date.getDate() + i);
  
  data.push({
    date: date.toISOString().split('T')[0],
    equity: 100000 + i * 172.41,
    drawdown: -Math.random() * 5,
    close: 150 + Math.random() * 10,
    volume: 1000000 + Math.random() * 4000000
  });
}

console.log("\n1. 数据基础信息:");
console.log(`   - 总数据条数: ${data.length}`);
console.log(`   - 日期范围: ${data[0].date} 到 ${data[data.length-1].date}`);

console.log("\n2. 4个图表的配置对比:");

// Equity Curve配置
console.log("\n   [Equity Curve]:");
console.log(`     - 图表类型: Area`);
console.log(`     - dot配置: { r: 2, strokeWidth: 1, stroke: '#3f8600', fill: 'white' }`);
console.log(`     - 视觉效果: 显示小点 (r=2)`);
console.log(`     - 数据密度: 29个点，点间距小`);

// Drawdown Chart配置
console.log("\n   [Drawdown Chart]:");
console.log(`     - 图表类型: Area`);
console.log(`     - dot配置: { r: 1.5, display: 'none' }`);
console.log(`     - 视觉效果: 点被隐藏 (display: 'none')`);
console.log(`     - 数据密度: 29个点，但看不到点`);

// Price Chart配置
console.log("\n   [Price Chart]:");
console.log(`     - 图表类型: Line`);
console.log(`     - dot配置: false`);
console.log(`     - 视觉效果: 不显示点`);
console.log(`     - 数据密度: 29个点，只有连续线`);

// Volume Chart配置
console.log("\n   [Volume Chart]:");
console.log(`     - 图表类型: Bar`);
console.log(`     - 视觉效果: 每个数据点一个柱子`);
console.log(`     - 数据密度: 29个柱子，清晰可见`);

console.log("\n3. 关键发现:");
console.log(`   ✅ 所有图表都有29个数据点`);
console.log(`   ✅ X轴标签显示规则已统一 (5个标签)`);
console.log(`   ❌ 点的显示方式不一致:`);
console.log(`      - Equity Curve: 显示小点 (r=2)`);
console.log(`      - Drawdown Chart: 点被隐藏 (display: 'none')`);
console.log(`      - Price Chart: 不显示点 (dot=false)`);
console.log(`      - Volume Chart: 显示柱子`);

console.log("\n4. 视觉效果分析:");
console.log(`   a) Equity Curve:`);
console.log(`      - 有29个小点，但点很小 (r=2)`);
console.log(`      - 在屏幕上可能看不清楚`);
console.log(`      - 密集的小点可能看起来像连续线`);

console.log(`   b) Drawdown Chart:`);
console.log(`      - 点被完全隐藏 (display: 'none')`);
console.log(`      - 只有连续线，看不到点`);
console.log(`      - 看起来像平滑曲线`);

console.log(`   c) Price Chart:`);
console.log(`      - 不显示点 (dot=false)`);
console.log(`      - 只有连续线`);
console.log(`      - 看起来像平滑曲线`);

console.log(`   d) Volume Chart:`);
console.log(`      - 每个数据点一个柱子`);
console.log(`      - 柱子清晰可见`);
console.log(`      - 看起来像每天都有数据`);

console.log("\n5. 问题根源:");
console.log(`   - 不是数据条数不一致 (都是29条)`);
console.log(`   - 不是X轴标签不一致 (都是5个标签)`);
console.log(`   - 是点的显示方式不一致:`);
console.log(`     1. Equity Curve: 小点 (可能看不清)`);
console.log(`     2. Drawdown Chart: 点被隐藏`);
console.log(`     3. Price Chart: 点被禁用`);
console.log(`     4. Volume Chart: 柱子 (最明显)`);

console.log("\n6. 用户感知:");
console.log(`   - Volume Chart: 明显看到29个柱子 (每天都有)`);
console.log(`   - Equity Curve: 可能看到小点，也可能看不清`);
console.log(`   - Drawdown Chart: 看不到点，只有线`);
console.log(`   - Price Chart: 看不到点，只有线`);
console.log(`   - 结果: 感觉Volume Chart是每天都有，其他图不是`);

console.log("\n7. 解决方案:");
console.log(`   a) 统一显示点的大小和可见性`);
console.log(`   b) 或者统一隐藏所有点，只显示线`);
console.log(`   c) 或者让所有图表都显示清晰可见的点`);

console.log("\n8. 建议修复:");
console.log(`   - 修改Drawdown Chart: 移除 display: 'none'`);
console.log(`   - 修改Price Chart: 设置 dot={true} 或 dot={{ r: 2 }}`);
console.log(`   - 或者修改Equity Chart: 增大点的大小 (r: 3)`);
console.log(`   - 确保所有图表显示相同大小的点`);