// 测试价格计算问题
console.log("=== 测试价格计算问题 ===");

// 测试场景1: 正常数据
const normalData = [
  { date: "2025-02-01", close: 150.0, volume: 1000000 },
  { date: "2025-02-02", close: 151.0, volume: 2000000 },
  { date: "2025-02-03", close: 149.5, volume: 1500000 }
];

console.log("1. 正常数据测试:");
const normalPrices = normalData.map(d => d.close).filter(Boolean);
console.log(`   prices数组: ${normalPrices}`);
console.log(`   minPrice: ${Math.min(...normalPrices)}`);
console.log(`   maxPrice: ${Math.max(...normalPrices)}`);
console.log(`   pricePadding: ${(Math.max(...normalPrices) - Math.min(...normalPrices)) * 0.1}`);
console.log("");

// 测试场景2: close=0的数据
const zeroCloseData = [
  { date: "2025-02-01", close: 0, volume: 1000000 },
  { date: "2025-02-02", close: 0, volume: 2000000 },
  { date: "2025-02-03", close: 0, volume: 1500000 }
];

console.log("2. close=0的数据测试:");
const zeroPrices = zeroCloseData.map(d => d.close).filter(Boolean);
console.log(`   prices数组: ${zeroPrices} (filter(Boolean)会过滤掉0!)`);
console.log(`   prices长度: ${zeroPrices.length}`);
console.log(`   minPrice (Math.min(...[])): ${Math.min(...zeroPrices)}`);
console.log(`   maxPrice (Math.max(...[])): ${Math.max(...zeroPrices)}`);
console.log(`   pricePadding: ${(Math.max(...zeroPrices) - Math.min(...zeroPrices)) * 0.1}`);
console.log("");

// 测试场景3: 混合数据（有些close是0）
const mixedData = [
  { date: "2025-02-01", close: 150.0, volume: 1000000 },
  { date: "2025-02-02", close: 0, volume: 2000000 }, // close=0
  { date: "2025-02-03", close: 149.5, volume: 1500000 }
];

console.log("3. 混合数据测试:");
const mixedPrices = mixedData.map(d => d.close).filter(Boolean);
console.log(`   prices数组: ${mixedPrices} (close=0被过滤掉了)`);
console.log(`   prices长度: ${mixedPrices.length}`);
console.log(`   minPrice: ${Math.min(...mixedPrices)}`);
console.log(`   maxPrice: ${Math.max(...mixedPrices)}`);
console.log("");

// 测试场景4: 只有1条数据
const singleData = [
  { date: "2025-02-01", close: 150.0, volume: 1000000 }
];

console.log("4. 只有1条数据测试:");
const singlePrices = singleData.map(d => d.close).filter(Boolean);
console.log(`   prices数组: ${singlePrices}`);
console.log(`   minPrice: ${Math.min(...singlePrices)}`);
console.log(`   maxPrice: ${Math.max(...singlePrices)}`);
console.log(`   pricePadding: ${(Math.max(...singlePrices) - Math.min(...singlePrices)) * 0.1}`);
console.log(`   Y轴domain: [${Math.min(...singlePrices) - (Math.max(...singlePrices) - Math.min(...singlePrices)) * 0.1}, ${Math.max(...singlePrices) + (Math.max(...singlePrices) - Math.min(...singlePrices)) * 0.1}]`);
console.log("  注意: minPrice和maxPrice相等，pricePadding=0，domain=[150,150]");
console.log("");

// 测试场景5: 修复后的计算方式
console.log("5. 修复后的计算方式测试:");

function calculatePriceRange(data) {
  // 不过滤Boolean，而是过滤有效的数值
  const prices = data.map(d => d.close).filter(price => typeof price === 'number' && !isNaN(price));
  
  if (prices.length === 0) {
    // 如果没有有效数据，返回默认范围
    return { minPrice: 0, maxPrice: 100, pricePadding: 10 };
  }
  
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  
  // 如果minPrice和maxPrice相等，添加一个小的padding
  let pricePadding;
  if (minPrice === maxPrice) {
    pricePadding = minPrice * 0.1; // 使用价格的10%作为padding
  } else {
    pricePadding = (maxPrice - minPrice) * 0.1;
  }
  
  return { minPrice, maxPrice, pricePadding };
}

// 测试各种场景
const testScenarios = [
  { name: "正常数据", data: normalData },
  { name: "close=0数据", data: zeroCloseData },
  { name: "混合数据", data: mixedData },
  { name: "单条数据", data: singleData }
];

testScenarios.forEach(scenario => {
  const result = calculatePriceRange(scenario.data);
  console.log(`  ${scenario.name}:`);
  console.log(`    minPrice: ${result.minPrice}`);
  console.log(`    maxPrice: ${result.maxPrice}`);
  console.log(`    pricePadding: ${result.pricePadding}`);
  console.log(`    Y轴domain: [${result.minPrice - result.pricePadding}, ${result.maxPrice + result.pricePadding}]`);
});

console.log("\n=== 问题分析 ===");
console.log("原代码的问题:");
console.log("1. filter(Boolean)会过滤掉close=0的数据");
console.log("2. 如果所有close都是0，prices数组为空");
console.log("3. Math.min(...[])返回Infinity，Math.max(...[])返回-Infinity");
console.log("4. 导致pricePadding计算错误，Y轴domain无效");
console.log("5. 如果只有1条数据，minPrice=maxPrice，pricePadding=0，domain范围为零");
console.log("");
console.log("解决方案:");
console.log("1. 修改过滤逻辑: .filter(price => typeof price === 'number' && !isNaN(price))");
console.log("2. 处理空数组情况，返回默认范围");
console.log("3. 处理minPrice=maxPrice的情况，添加基于价格的padding");