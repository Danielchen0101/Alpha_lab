// 测试formatMarketCap函数
const formatMarketCap = (value) => {
  if (value === null || value === undefined || value === 0) return '--';
  
  const num = Number(value);
  if (isNaN(num)) return '--';
  
  // 万亿 (Trillion) - 1万亿 = 1e12
  if (num >= 1e12) {
    const trillions = num / 1e12;
    // 对于万亿级别，显示1位小数，除非是整数
    return `$${trillions.toFixed(trillions >= 100 ? 0 : trillions >= 10 ? 1 : 2)}T`;
  }
  
  // 十亿 (Billion) - 10亿 = 1e9
  if (num >= 1e9) {
    const billions = num / 1e9;
    // 对于十亿级别，显示1位小数
    return `$${billions.toFixed(billions >= 100 ? 0 : billions >= 10 ? 1 : 2)}B`;
  }
  
  // 百万 (Million) - 1百万 = 1e6
  if (num >= 1e6) {
    const millions = num / 1e6;
    return `$${millions.toFixed(millions >= 10 ? 0 : 1)}M`;
  }
  
  // 千 (Thousand)
  if (num >= 1e3) {
    const thousands = num / 1e3;
    return `$${thousands.toFixed(thousands >= 10 ? 0 : 1)}K`;
  }
  
  // 小于1000
  return `$${num.toFixed(2)}`;
};

// 测试数据
const testValues = [
  24609533907393, // 24.6万亿
  4420899029454,  // 4.42万亿
  3732386240949,  // 3.73万亿
  2965870531968,  // 2.97万亿
  1000000000000,  // 1万亿
  500000000000,   // 5000亿
  1000000000,     // 10亿
  500000000,      // 5亿
  1000000,        // 100万
  500000,         // 50万
  1000,           // 1千
  100,            // 100
];

console.log("测试formatMarketCap函数:");
console.log("=".repeat(50));
testValues.forEach(value => {
  const formatted = formatMarketCap(value);
  console.log(`${value.toLocaleString()} → ${formatted}`);
});

// 特别测试Dashboard中的值
console.log("\nDashboard实际值测试:");
console.log("=".repeat(50));
const dashboardValues = {
  "totalMarketCap": 24609533907393,
  "largestCap": 4420899029454,
  "apple": 3732386240949,
  "microsoft": 2965870531968
};

Object.entries(dashboardValues).forEach(([name, value]) => {
  const formatted = formatMarketCap(value);
  console.log(`${name}: ${value.toLocaleString()} → ${formatted}`);
});