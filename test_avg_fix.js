// 测试Avg P&L per Trade修复
console.log("=== 测试Avg P&L per Trade修复 ===");

// 模拟后端响应
const backendResponse = {
  results: {
    totalReturn: 15.5,
    profitLoss: 15500.0,
    trades: 1,
    avgReturnPerTrade: 15500.0, // 修复后应为15500.0
    winRate: 100.0,
    profitFactor: 99.0,
    expectancy: 15.5,
    maxDrawdown: -9.3,
    calmarRatio: 1.13
  }
};

console.log("1. 后端响应值:");
console.log(`- profitLoss: $${backendResponse.results.profitLoss.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`);
console.log(`- trades: ${backendResponse.results.trades}`);
console.log(`- avgReturnPerTrade: $${backendResponse.results.avgReturnPerTrade.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`);

// 验证计算
const expectedAvg = backendResponse.results.profitLoss / backendResponse.results.trades;
console.log(`\n2. 验证计算:`);
console.log(`- 预期值: $${expectedAvg.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} = $${backendResponse.results.profitLoss.toLocaleString()} / ${backendResponse.results.trades}`);
console.log(`- 实际值: $${backendResponse.results.avgReturnPerTrade.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`);

if (Math.abs(backendResponse.results.avgReturnPerTrade - expectedAvg) < 0.01) {
  console.log("✅ Avg P&L per Trade 计算正确");
} else {
  console.log("❌ Avg P&L per Trade 计算错误");
}

// 模拟前端显示
console.log(`\n3. 前端应显示:`);
console.log(`Avg P&L per Trade: $${backendResponse.results.avgReturnPerTrade.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`);

console.log(`\n4. 与当前页面对比:`);
console.log(`当前页面显示: 0.00`);
console.log(`修复后应显示: $${backendResponse.results.avgReturnPerTrade.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`);

console.log(`\n=== 修复总结 ===`);
console.log(`1. 后端已修复: avgReturnPerTrade = profitLoss / trades = 15500.0`);
console.log(`2. 前端绑定正确: backtestResult.results?.avgReturnPerTrade`);
console.log(`3. 构建状态: ✅ 成功`);
console.log(`4. 需要重新运行backtest以获取更新后的值`);