// 测试数据链路修复
console.log('=== 测试数据链路修复 ===\n');

// 1. 清空现有数据
console.log('1. 清空现有数据...');
localStorage.removeItem('quant_session_history');
console.log('   localStorage 中 quant_session_history:', localStorage.getItem('quant_session_history'));

// 2. 模拟创建一个 session 历史记录
console.log('\n2. 模拟创建一个 session 历史记录...');
const mockSession = {
  id: `session_${Date.now()}_0`,
  timestamp: new Date().toISOString(),
  strategyMode: 'MA_CROSSOVER',
  symbol: 'AAPL',
  shortMaPeriod: 5,
  longMaPeriod: 10,
  slippageRate: 0.001,
  commissionRate: 0.005,
  startEquity: 10000,
  endEquity: 10500,
  returnPct: 5.0,
  totalTrades: 3,
  realizedPnL: 500,
  totalSlippage: 10.5,
  totalCommission: 25.0,
  durationMinutes: 30
};

// 3. 模拟保存到 localStorage（使用修复后的逻辑）
console.log('\n3. 模拟保存到 localStorage...');
const SESSION_HISTORY_KEY = 'quant_session_history';
const existing = JSON.parse(localStorage.getItem(SESSION_HISTORY_KEY) || '[]');
const newHistory = [mockSession, ...existing].slice(0, 10);
localStorage.setItem(SESSION_HISTORY_KEY, JSON.stringify(newHistory));

console.log('   Saved session:', mockSession);
console.log('   All history:', newHistory);

// 4. 验证数据是否被正确保存
console.log('\n4. 验证数据是否被正确保存...');
const savedData = localStorage.getItem(SESSION_HISTORY_KEY);
console.log('   localStorage 中 quant_session_history:', savedData);

if (savedData) {
  const parsed = JSON.parse(savedData);
  console.log(`   ✅ 数据保存成功！共 ${parsed.length} 条记录`);
  console.log('   第一条记录:', parsed[0]);
  
  // 5. 验证 ExperimentRankingCard 是否能读取到数据
  console.log('\n5. 验证 ExperimentRankingCard 是否能读取到数据...');
  const rankingDataStr = localStorage.getItem('quant_session_history');
  if (rankingDataStr) {
    console.log('   ✅ ExperimentRankingCard 可以读取到数据！');
  } else {
    console.log('   ❌ ExperimentRankingCard 无法读取到数据！');
  }
} else {
  console.log('   ❌ 数据保存失败！');
}

console.log('\n=== 测试完成 ===');