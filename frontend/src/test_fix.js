/**
 * 测试修复后的字段映射
 */

// 模拟后端返回数据
const mockBackendResponse = {
  symbol: "AAPL",
  price: 254.23,
  change: 1.41,
  changePercent: 0.5577,
  dayHigh: 255.13,        // 后端返回的正确字段名
  dayLow: 252.18,         // 后端返回的正确字段名
  previousClose: 252.82,  // 后端返回的正确字段名
  dataSource: "Finnhub",
  timestamp: "2026-03-17T23:30:31.860776"
};

// 修复前的映射逻辑（错误）
function oldMapping(stock) {
  return {
    ...stock,
    dayHigh: stock.high !== undefined ? stock.high : null,      // 错误：期望 'high' 字段
    dayLow: stock.low !== undefined ? stock.low : null,         // 错误：期望 'low' 字段
    previousClose: stock.prevClose !== undefined ? stock.prevClose : null, // 错误：期望 'prevClose' 字段
    dataSource: stock.dataSource || 'Finnhub',
    timestamp: new Date().toISOString(),
  };
}

// 修复后的映射逻辑（正确）
function newMapping(stock) {
  return {
    ...stock,
    dayHigh: stock.dayHigh !== undefined ? stock.dayHigh : null,      // 正确：使用 'dayHigh' 字段
    dayLow: stock.dayLow !== undefined ? stock.dayLow : null,         // 正确：使用 'dayLow' 字段
    previousClose: stock.previousClose !== undefined ? stock.previousClose : null, // 正确：使用 'previousClose' 字段
    dataSource: stock.dataSource || 'Finnhub',
    timestamp: new Date().toISOString(),
  };
}

console.log("=== 测试字段映射修复 ===");
console.log("\n1. 后端返回数据:");
console.log(JSON.stringify(mockBackendResponse, null, 2));

console.log("\n2. 修复前的映射结果:");
const oldResult = oldMapping(mockBackendResponse);
console.log("dayHigh:", oldResult.dayHigh, "(应为: 255.13)");
console.log("dayLow:", oldResult.dayLow, "(应为: 252.18)");
console.log("previousClose:", oldResult.previousClose, "(应为: 252.82)");

console.log("\n3. 修复后的映射结果:");
const newResult = newMapping(mockBackendResponse);
console.log("dayHigh:", newResult.dayHigh, "(应为: 255.13)");
console.log("dayLow:", newResult.dayLow, "(应为: 252.18)");
console.log("previousClose:", newResult.previousClose, "(应为: 252.82)");

console.log("\n4. 修复效果:");
console.log("dayHigh: ", oldResult.dayHigh === null ? "❌ 显示 '--'" : "✓ 显示正确值");
console.log("dayLow: ", oldResult.dayLow === null ? "❌ 显示 '--'" : "✓ 显示正确值");
console.log("previousClose: ", oldResult.previousClose === null ? "❌ 显示 '--'" : "✓ 显示正确值");

console.log("\n5. 修复后:");
console.log("dayHigh: ", newResult.dayHigh !== null ? `✓ $${newResult.dayHigh}` : "❌ 显示 '--'");
console.log("dayLow: ", newResult.dayLow !== null ? `✓ $${newResult.dayLow}` : "❌ 显示 '--'");
console.log("previousClose: ", newResult.previousClose !== null ? `✓ $${newResult.previousClose}` : "❌ 显示 '--'");