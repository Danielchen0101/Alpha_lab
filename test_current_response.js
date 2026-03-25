// 模拟当前页面显示的后端响应
// 基于页面显示值反推后端返回的数据

const currentPageDisplay = {
  totalReturn: 15.50,
  profitLoss: 15500, // $15.50K
  trades: 1,
  avgReturnPerTrade: 0.00,
  winRate: 0.0,
  profitFactor: 99.00,
  expectancy: 0.00,
  maxDrawdown: -9.30,
  calmarRatio: 1.12,
  annualizedReturn: 10.50 // 根据Calmar Ratio反推: 1.12 * 9.30 = 10.416 ≈ 10.50
};

console.log("=== 当前页面显示值 ===");
console.log(JSON.stringify(currentPageDisplay, null, 2));

console.log("\n=== 反推的后端响应结构 ===");
const inferredBackendResponse = {
  results: {
    totalReturn: 15.50,
    annualizedReturn: 10.50,
    profitLoss: 15500,
    trades: 1,
    avgReturnPerTrade: 0.00,
    winRate: 0.0,
    profitFactor: 99.00,
    expectancy: 0.00,
    maxDrawdown: -9.30,
    calmarRatio: 1.12
  }
};

console.log(JSON.stringify(inferredBackendResponse, null, 2));

console.log("\n=== 问题分析 ===");

// 问题1: Avg P&L per Trade 应该是 15500，不是 0.00
if (inferredBackendResponse.results.trades === 1) {
  const expectedAvg = inferredBackendResponse.results.profitLoss / inferredBackendResponse.results.trades;
  console.log(`1. Avg P&L per Trade 错误: 显示 ${inferredBackendResponse.results.avgReturnPerTrade}, 应为 ${expectedAvg}`);
}

// 问题2: Win Rate 0.0% 但 Profit Factor 99.00 矛盾
if (inferredBackendResponse.results.winRate === 0 && inferredBackendResponse.results.profitFactor > 1) {
  console.log(`2. Win Rate 和 Profit Factor 矛盾: Win Rate=${inferredBackendResponse.results.winRate}%, Profit Factor=${inferredBackendResponse.results.profitFactor}`);
}

// 问题3: Expectancy 0.00% 不合理
if (inferredBackendResponse.results.profitLoss > 0 && inferredBackendResponse.results.expectancy === 0) {
  console.log(`3. Expectancy 错误: 有盈利但 Expectancy=0%`);
}

// 问题4: Calmar Ratio 计算验证
const calculatedCalmar = inferredBackendResponse.results.annualizedReturn / Math.abs(inferredBackendResponse.results.maxDrawdown);
if (Math.abs(inferredBackendResponse.results.calmarRatio - calculatedCalmar) > 0.01) {
  console.log(`4. Calmar Ratio 计算错误: 显示 ${inferredBackendResponse.results.calmarRatio}, 计算应为 ${calculatedCalmar.toFixed(2)}`);
}

console.log("\n=== 修正后的合理值 ===");
const correctedResponse = {
  results: {
    totalReturn: 15.50,
    annualizedReturn: 10.50,
    profitLoss: 15500,
    trades: 1,
    avgReturnPerTrade: 15500.00, // 修正: 15500 / 1
    winRate: 100.0, // 修正: 1笔交易且盈利，胜率应为100%
    profitFactor: 99.00, // 保持，但应显示为"∞"或特殊值
    expectancy: 15.50, // 修正: 每笔交易预期收益15.50%
    maxDrawdown: -9.30,
    calmarRatio: 1.13 // 修正: 10.50 / 9.30 = 1.129 ≈ 1.13
  }
};

console.log(JSON.stringify(correctedResponse, null, 2));

console.log("\n=== 前端绑定检查 ===");
console.log("前端绑定字段:");
console.log("- trades: backtestResult.results?.trades");
console.log("- avgReturnPerTrade: backtestResult.results?.avgReturnPerTrade");
console.log("- winRate: backtestResult.results?.winRate");
console.log("- profitFactor: backtestResult.results?.profitFactor");
console.log("- expectancy: backtestResult.results?.expectancy");
console.log("- calmarRatio: backtestResult.results?.calmarRatio");

console.log("\n=== 结论 ===");
console.log("问题根源: 后端返回了错误的值，特别是:");
console.log("1. avgReturnPerTrade 应为 15500.00，但返回了 0.00");
console.log("2. winRate 应为 100.0%，但返回了 0.0%");
console.log("3. expectancy 应为 15.50%，但返回了 0.00%");
console.log("4. profitFactor 99.00 虽然显示，但逻辑不合理");