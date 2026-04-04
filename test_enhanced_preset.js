// 测试脚本：验证增强的 Preset Performance Summary
const testSessionHistory = [
  {
    sessionId: 'session-1',
    symbol: 'AAPL',
    preset: 'Fast',
    results: {
      returnPct: 5.2,
      trades: 12,
      totalSlippage: 15.5,
      totalCommission: 10.0,
      durationMinutes: 45
    },
    createdAt: '2026-04-03T10:00:00Z'
  },
  {
    sessionId: 'session-2',
    symbol: 'MSFT',
    preset: 'Fast',
    results: {
      returnPct: 3.8,
      trades: 8,
      totalSlippage: 12.3,
      totalCommission: 8.0,
      durationMinutes: 38
    },
    createdAt: '2026-04-03T11:00:00Z'
  },
  {
    sessionId: 'session-3',
    symbol: 'GOOGL',
    preset: 'Fast',
    results: {
      returnPct: 4.7,
      trades: 10,
      totalSlippage: 14.2,
      totalCommission: 9.0,
      durationMinutes: 42
    },
    createdAt: '2026-04-03T12:00:00Z'
  },
  {
    sessionId: 'session-4',
    symbol: 'AMZN',
    preset: 'Medium',
    results: {
      returnPct: 2.1,
      trades: 6,
      totalSlippage: 8.7,
      totalCommission: 6.0,
      durationMinutes: 52
    },
    createdAt: '2026-04-03T13:00:00Z'
  },
  {
    sessionId: 'session-5',
    symbol: 'TSLA',
    preset: 'Medium',
    results: {
      returnPct: 1.5,
      trades: 5,
      totalSlippage: 7.2,
      totalCommission: 5.0,
      durationMinutes: 48
    },
    createdAt: '2026-04-03T14:00:00Z'
  },
  {
    sessionId: 'session-6',
    symbol: 'NVDA',
    preset: 'Medium',
    results: {
      returnPct: 2.8,
      trades: 7,
      totalSlippage: 9.5,
      totalCommission: 7.0,
      durationMinutes: 55
    },
    createdAt: '2026-04-03T15:00:00Z'
  },
  {
    sessionId: 'session-7',
    symbol: 'META',
    preset: 'Slow',
    results: {
      returnPct: 0.8,
      trades: 3,
      totalSlippage: 4.5,
      totalCommission: 3.0,
      durationMinutes: 65
    },
    createdAt: '2026-04-03T16:00:00Z'
  },
  {
    sessionId: 'session-8',
    symbol: 'NFLX',
    preset: 'Slow',
    results: {
      returnPct: -0.5,
      trades: 4,
      totalSlippage: 5.8,
      totalCommission: 4.0,
      durationMinutes: 72
    },
    createdAt: '2026-04-03T17:00:00Z'
  },
  {
    sessionId: 'session-9',
    preset: 'Slow',
    symbol: 'INTC',
    results: {
      returnPct: 1.2,
      trades: 5,
      totalSlippage: 6.3,
      totalCommission: 5.0,
      durationMinutes: 60
    },
    createdAt: '2026-04-03T18:00:00Z'
  }
];

// 计算预设聚合统计（包含标准差和胜率）
function calculateEnhancedPresetSummary(sessions) {
  const presetGroups = {};
  
  sessions.forEach(session => {
    const preset = session.preset;
    if (!presetGroups[preset]) {
      presetGroups[preset] = {
        preset: preset,
        sessions: [],
        totalReturn: 0,
        totalTrades: 0,
        totalCost: 0,
        bestReturn: -Infinity,
        worstReturn: Infinity,
        positiveSessions: 0
      };
    }
    
    const group = presetGroups[preset];
    const totalCost = session.results.totalSlippage + session.results.totalCommission;
    
    group.sessions.push(session);
    group.totalReturn += session.results.returnPct;
    group.totalTrades += session.results.trades;
    group.totalCost += totalCost;
    
    if (session.results.returnPct > group.bestReturn) {
      group.bestReturn = session.results.returnPct;
    }
    
    if (session.results.returnPct < group.worstReturn) {
      group.worstReturn = session.results.returnPct;
    }
    
    if (session.results.returnPct > 0) {
      group.positiveSessions += 1;
    }
  });
  
  // 转换为数组并计算平均值、标准差和胜率
  const presetSummaryArray = Object.values(presetGroups).map(group => {
    const sessionCount = group.sessions.length;
    
    // 计算标准差和胜率
    let stdDev = 0;
    let winRate = 0;
    
    if (sessionCount > 0) {
      // 获取所有收益率
      const returns = group.sessions.map(s => s.results.returnPct);
      
      // 计算平均收益率
      const avgReturn = group.totalReturn / sessionCount;
      
      // 计算标准差
      const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / sessionCount;
      stdDev = Math.sqrt(variance);
      
      // 计算胜率（收益率 > 0 的比例）
      const winCount = returns.filter(r => r > 0).length;
      winRate = (winCount / sessionCount) * 100;
    }
    
    return {
      key: group.preset,
      preset: group.preset,
      sessions: sessionCount,
      avgReturn: sessionCount > 0 ? group.totalReturn / sessionCount : 0,
      avgTrades: sessionCount > 0 ? group.totalTrades / sessionCount : 0,
      avgCost: sessionCount > 0 ? group.totalCost / sessionCount : 0,
      bestReturn: group.bestReturn === -Infinity ? 0 : group.bestReturn,
      worstReturn: group.worstReturn === Infinity ? 0 : group.worstReturn,
      successRate: sessionCount > 0 ? (group.positiveSessions / sessionCount) * 100 : 0,
      stdDev: stdDev,
      winRate: winRate
    };
  }).sort((a, b) => {
    // 主要按平均收益率降序排序，次要按胜率降序排序
    if (Math.abs(b.avgReturn - a.avgReturn) > 0.01) {
      return b.avgReturn - a.avgReturn;
    }
    return b.winRate - a.winRate;
  });
  
  return presetSummaryArray;
}

// 计算并显示结果
const presetSummary = calculateEnhancedPresetSummary(testSessionHistory);

console.log('=== 增强版 Preset Performance Summary 测试 ===\n');
console.log(`总 session 数量: ${testSessionHistory.length}`);
console.log(`预设类型数量: ${presetSummary.length}\n`);

presetSummary.forEach((summary, index) => {
  console.log(`=== ${summary.preset} Preset (排名 ${index + 1}) ===`);
  console.log(`Sessions: ${summary.sessions}`);
  console.log(`Avg Return: ${summary.avgReturn.toFixed(2)}%`);
  console.log(`Std Dev: ${summary.stdDev.toFixed(2)}% (${summary.stdDev < 2 ? '低风险' : summary.stdDev < 5 ? '中风险' : '高风险'})`);
  console.log(`Win Rate: ${summary.winRate.toFixed(1)}% (${summary.winRate >= 70 ? '优秀' : summary.winRate >= 50 ? '良好' : '需改进'})`);
  console.log(`Avg Trades: ${summary.avgTrades.toFixed(1)}`);
  console.log(`Avg Cost: $${summary.avgCost.toFixed(2)}`);
  console.log(`Best Return: ${summary.bestReturn.toFixed(2)}%`);
  console.log(`Worst Return: ${summary.worstReturn.toFixed(2)}%`);
  console.log(`Success Rate: ${summary.successRate.toFixed(1)}%`);
  console.log('');
});

// 显示排序逻辑
console.log('=== 排序逻辑验证 ===');
console.log('主要排序: Avg Return DESC (平均收益率降序)');
console.log('次要排序: Win Rate DESC (胜率降序，当平均收益率接近时)');
console.log('');

// 显示每个 preset 的详细收益率数据
console.log('=== 详细收益率分析 ===');
presetSummary.forEach((summary, index) => {
  const group = testSessionHistory.filter(s => s.preset === summary.preset);
  const returns = group.map(s => s.results.returnPct);
  console.log(`${summary.preset} Preset 收益率: ${returns.map(r => r.toFixed(1) + '%').join(', ')}`);
  console.log(`  范围: ${Math.min(...returns).toFixed(1)}% 到 ${Math.max(...returns).toFixed(1)}%`);
  console.log(`  稳定性: ${summary.stdDev.toFixed(2)}% (标准差)`);
  console.log('');
});

console.log('=== 预期 UI 显示 ===');
console.log('1. Preset Performance Summary 表格将新增两列:');
console.log('   - Std Dev: 显示收益率标准差，颜色编码（绿<2%，橙<5%，红>5%）');
console.log('   - Win Rate: 显示胜率，颜色编码（绿≥70%，橙≥50%，红<50%）');
console.log('');
console.log('2. Summary Insights 将显示:');
console.log('   - Stability: Std Dev 指标');
console.log('   - Consistency: Win Rate 指标');
console.log('');
console.log('3. 排序逻辑升级:');
console.log('   从 Avg Return DESC');
console.log('   升级为 Avg Return DESC + Win Rate DESC（辅助排序）');