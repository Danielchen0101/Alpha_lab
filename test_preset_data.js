// 测试脚本：生成预设性能汇总的测试数据
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
    preset: 'Medium',
    results: {
      returnPct: 2.1,
      trades: 6,
      totalSlippage: 8.7,
      totalCommission: 6.0,
      durationMinutes: 52
    },
    createdAt: '2026-04-03T12:00:00Z'
  },
  {
    sessionId: 'session-4',
    symbol: 'AMZN',
    preset: 'Medium',
    results: {
      returnPct: 1.5,
      trades: 5,
      totalSlippage: 7.2,
      totalCommission: 5.0,
      durationMinutes: 48
    },
    createdAt: '2026-04-03T13:00:00Z'
  },
  {
    sessionId: 'session-5',
    symbol: 'TSLA',
    preset: 'Slow',
    results: {
      returnPct: 0.8,
      trades: 3,
      totalSlippage: 4.5,
      totalCommission: 3.0,
      durationMinutes: 65
    },
    createdAt: '2026-04-03T14:00:00Z'
  },
  {
    sessionId: 'session-6',
    symbol: 'NVDA',
    preset: 'Slow',
    results: {
      returnPct: -0.5,
      trades: 4,
      totalSlippage: 5.8,
      totalCommission: 4.0,
      durationMinutes: 72
    },
    createdAt: '2026-04-03T15:00:00Z'
  },
  {
    sessionId: 'session-7',
    symbol: 'META',
    preset: 'Fast',
    results: {
      returnPct: 4.7,
      trades: 10,
      totalSlippage: 14.2,
      totalCommission: 9.0,
      durationMinutes: 42
    },
    createdAt: '2026-04-03T16:00:00Z'
  },
  {
    sessionId: 'session-8',
    symbol: 'NFLX',
    preset: 'Medium',
    results: {
      returnPct: 2.8,
      trades: 7,
      totalSlippage: 9.5,
      totalCommission: 7.0,
      durationMinutes: 55
    },
    createdAt: '2026-04-03T17:00:00Z'
  }
];

// 计算预设聚合统计
function calculatePresetSummary(sessions) {
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
  
  // 转换为数组并计算平均值
  const presetSummaryArray = Object.values(presetGroups).map(group => {
    const sessionCount = group.sessions.length;
    return {
      key: group.preset,
      preset: group.preset,
      sessions: sessionCount,
      avgReturn: sessionCount > 0 ? group.totalReturn / sessionCount : 0,
      avgTrades: sessionCount > 0 ? group.totalTrades / sessionCount : 0,
      avgCost: sessionCount > 0 ? group.totalCost / sessionCount : 0,
      bestReturn: group.bestReturn === -Infinity ? 0 : group.bestReturn,
      worstReturn: group.worstReturn === Infinity ? 0 : group.worstReturn,
      successRate: sessionCount > 0 ? (group.positiveSessions / sessionCount) * 100 : 0
    };
  }).sort((a, b) => b.avgReturn - a.avgReturn); // 按平均收益率降序排序
  
  return presetSummaryArray;
}

// 计算并显示结果
const presetSummary = calculatePresetSummary(testSessionHistory);

console.log('=== 测试数据：Preset Performance Summary ===\n');
console.log(`总 session 数量: ${testSessionHistory.length}`);
console.log(`预设类型数量: ${presetSummary.length}\n`);

presetSummary.forEach((summary, index) => {
  console.log(`=== ${summary.preset} Preset ===`);
  console.log(`Sessions: ${summary.sessions}`);
  console.log(`Avg Return: ${summary.avgReturn.toFixed(2)}%`);
  console.log(`Avg Trades: ${summary.avgTrades.toFixed(1)}`);
  console.log(`Avg Cost: $${summary.avgCost.toFixed(2)}`);
  console.log(`Best Return: ${summary.bestReturn.toFixed(2)}%`);
  console.log(`Worst Return: ${summary.worstReturn.toFixed(2)}%`);
  console.log(`Success Rate: ${summary.successRate.toFixed(1)}%`);
  console.log('');
});

// 输出到 localStorage 格式
console.log('=== 用于 localStorage 的 JSON 数据 ===');
console.log(JSON.stringify(testSessionHistory, null, 2));

console.log('\n=== 预期 Dashboard 显示 ===');
console.log('1. Preset Performance Summary 区块将显示在 Dashboard 中');
console.log('2. 将显示 Fast, Medium, Slow 三个预设的聚合统计');
console.log('3. 按 Avg Return 降序排序：Fast > Medium > Slow');
console.log('4. 每个预设显示：Sessions, Avg Return, Avg Trades, Avg Cost');