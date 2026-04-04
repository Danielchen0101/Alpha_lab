// 测试脚本：验证 Sharpe Ratio 计算逻辑
const testPresetData = [
  {
    preset: 'Fast',
    sessions: [
      { returnPct: 5.2 },
      { returnPct: 3.8 },
      { returnPct: 4.7 }
    ]
  },
  {
    preset: 'Medium',
    sessions: [
      { returnPct: 2.1 },
      { returnPct: 1.5 },
      { returnPct: 2.8 }
    ]
  },
  {
    preset: 'Slow',
    sessions: [
      { returnPct: 0.8 },
      { returnPct: -0.5 },
      { returnPct: 1.2 }
    ]
  },
  {
    preset: 'ZeroStdDev',
    sessions: [
      { returnPct: 3.0 },
      { returnPct: 3.0 },
      { returnPct: 3.0 }
    ]
  }
];

// 计算 Sharpe Ratio 的函数
function calculateSharpe(returns) {
  const sessionCount = returns.length;
  if (sessionCount === 0) return 0;
  
  // 计算平均收益率
  const avgReturn = returns.reduce((sum, r) => sum + r, 0) / sessionCount;
  
  // 计算标准差
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / sessionCount;
  const stdDev = Math.sqrt(variance);
  
  // 计算夏普比率（简化版，不考虑无风险利率）
  // 使用小阈值避免除零错误
  const sharpe = stdDev > 0.001 ? avgReturn / stdDev : 0;
  
  return { avgReturn, stdDev, sharpe };
}

// 计算并显示结果
console.log('=== Sharpe Ratio 计算测试 ===\n');

testPresetData.forEach((presetData, index) => {
  const returns = presetData.sessions.map(s => s.returnPct);
  const { avgReturn, stdDev, sharpe } = calculateSharpe(returns);
  
  console.log(`=== ${presetData.preset} Preset ===`);
  console.log(`收益率: ${returns.map(r => r.toFixed(1) + '%').join(', ')}`);
  console.log(`平均收益率: ${avgReturn.toFixed(2)}%`);
  console.log(`标准差: ${stdDev.toFixed(2)}%`);
  console.log(`夏普比率: ${sharpe.toFixed(2)}`);
  
  // 评估夏普比率
  let evaluation = '';
  if (sharpe >= 2) evaluation = '优秀 (≥2)';
  else if (sharpe >= 1) evaluation = '良好 (1-2)';
  else if (sharpe > 0) evaluation = '一般 (0-1)';
  else if (sharpe === 0 && stdDev < 0.001) evaluation = '零波动';
  else evaluation = '负收益';
  
  console.log(`评估: ${evaluation}`);
  console.log('');
});

// 测试排序逻辑
console.log('=== 排序逻辑测试 ===');
const allResults = testPresetData.map(presetData => {
  const returns = presetData.sessions.map(s => s.returnPct);
  const { avgReturn, stdDev, sharpe } = calculateSharpe(returns);
  return {
    preset: presetData.preset,
    avgReturn,
    stdDev,
    sharpe,
    winRate: (returns.filter(r => r > 0).length / returns.length) * 100
  };
});

// 按 Sharpe 降序排序
const sortedBySharpe = [...allResults].sort((a, b) => {
  // 主要按夏普比率降序排序
  if (Math.abs(b.sharpe - a.sharpe) > 0.01) {
    return b.sharpe - a.sharpe;
  }
  // 次要按平均收益率降序排序
  if (Math.abs(b.avgReturn - a.avgReturn) > 0.01) {
    return b.avgReturn - a.avgReturn;
  }
  // 最后按胜率降序排序
  return b.winRate - a.winRate;
});

console.log('按 Sharpe Ratio 排序结果:');
sortedBySharpe.forEach((result, index) => {
  console.log(`${index + 1}. ${result.preset}: Sharpe=${result.sharpe.toFixed(2)}, Return=${result.avgReturn.toFixed(2)}%, WinRate=${result.winRate.toFixed(1)}%`);
});

console.log('\n=== 预期 UI 显示 ===');
console.log('1. Preset Performance Summary 表格将新增 Sharpe 列:');
console.log('   - 显示格式: 1.24, 2.08, 0.75');
console.log('   - 颜色编码: 绿≥2, 橙≥1, 红<1');
console.log('   - Tooltip: "Sharpe Ratio - risk-adjusted return (higher is better)"');
console.log('');
console.log('2. 排序逻辑升级:');
console.log('   从: Avg Return DESC + Win Rate DESC');
console.log('   升级为: Sharpe DESC + Avg Return DESC + Win Rate DESC');
console.log('');
console.log('3. Summary Insights 将显示:');
console.log('   - Risk-Adjusted: Sharpe 指标');
console.log('   - 颜色编码与表格一致');