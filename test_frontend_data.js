// 测试前端数据处理
const testData = [
  { date: "2025-02-01", close: 150.17, volume: 4926195, signal: 0 },
  { date: "2025-02-02", close: 150.49, volume: 3018962, signal: 0 },
  { date: "2025-02-03", close: 151.8, volume: 1294517, signal: 0 },
  { date: "2025-02-04", close: 152.65, volume: 4166330, signal: 0 },
  { date: "2025-02-05", close: 150.55, volume: 2791153, signal: 0 },
  { date: "2025-02-06", close: 151.2, volume: 3500000, signal: 0 },
  { date: "2025-02-07", close: 152.1, volume: 2800000, signal: 0 },
  { date: "2025-02-08", close: 153.0, volume: 3200000, signal: 0 },
  { date: "2025-02-09", close: 154.5, volume: 2900000, signal: 0 },
  { date: "2025-02-10", close: 155.0, volume: 3100000, signal: 0 },
  { date: "2025-02-11", close: 156.2, volume: 3300000, signal: 0 },
  { date: "2025-02-12", close: 157.0, volume: 3400000, signal: 0 },
  { date: "2025-02-13", close: 158.0, volume: 3600000, signal: 0 },
  { date: "2025-02-14", close: 159.0, volume: 3700000, signal: 0 },
  { date: "2025-02-15", close: 160.0, volume: 3800000, signal: 0 },
  { date: "2025-02-16", close: 161.0, volume: 3900000, signal: 0 },
  { date: "2025-02-17", close: 162.0, volume: 4000000, signal: 0 },
  { date: "2025-02-18", close: 163.0, volume: 4100000, signal: 0 },
  { date: "2025-02-19", close: 164.0, volume: 4200000, signal: 0 },
  { date: "2025-02-20", close: 165.0, volume: 4300000, signal: 0 },
  { date: "2025-02-21", close: 166.0, volume: 4400000, signal: 0 },
  { date: "2025-02-22", close: 167.0, volume: 4500000, signal: 0 },
  { date: "2025-02-23", close: 168.0, volume: 4600000, signal: 0 },
  { date: "2025-02-24", close: 169.0, volume: 4700000, signal: 0 },
  { date: "2025-02-25", close: 170.0, volume: 4800000, signal: 0 },
  { date: "2025-02-26", close: 171.0, volume: 4900000, signal: 0 },
  { date: "2025-02-27", close: 172.0, volume: 5000000, signal: 0 },
  { date: "2025-02-28", close: 173.0, volume: 5100000, signal: 0 },
  { date: "2025-03-01", close: 174.0, volume: 5200000, signal: 0 }
];

// 模拟前端的formatDate函数
function formatDate(dateStr) {
  try {
    // 手动解析YYYY-MM-DD格式，避免时区偏移
    let month, day;
    
    if (typeof dateStr === 'string' && dateStr.includes('-')) {
      // 如果是YYYY-MM-DD格式，直接解析
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        month = parseInt(parts[1], 10);
        day = parseInt(parts[2], 10);
        return `${month}/${day}`;
      }
    }
    
    // 备用方案：使用Date对象
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  } catch {
    return dateStr;
  }
}

console.log("=== 前端数据处理测试 ===");
console.log(`1. 数据长度: ${testData.length}`);

console.log("\n2. 前5条数据的格式化日期:");
for (let i = 0; i < Math.min(5, testData.length); i++) {
  const item = testData[i];
  const formatted = formatDate(item.date);
  console.log(`   [${i}] 原始: ${item.date} -> 格式化: ${formatted}`);
}

console.log("\n3. 后5条数据的格式化日期:");
for (let i = Math.max(0, testData.length - 5); i < testData.length; i++) {
  const item = testData[i];
  const formatted = formatDate(item.date);
  console.log(`   [${i}] 原始: ${item.date} -> 格式化: ${formatted}`);
}

console.log("\n4. 所有格式化后的唯一日期:");
const formattedDates = testData.map(item => formatDate(item.date));
const uniqueFormattedDates = [...new Set(formattedDates)];
console.log(`   唯一日期数量: ${uniqueFormattedDates.length}`);
console.log(`   前10个唯一日期: ${uniqueFormattedDates.slice(0, 10).join(', ')}`);

console.log("\n5. 检查是否有重复的格式化日期:");
const dateCounts = {};
formattedDates.forEach(date => {
  dateCounts[date] = (dateCounts[date] || 0) + 1;
});

const duplicates = Object.entries(dateCounts).filter(([date, count]) => count > 1);
if (duplicates.length > 0) {
  console.log(`   发现重复的格式化日期:`);
  duplicates.forEach(([date, count]) => {
    console.log(`     ${date}: ${count}次`);
  });
} else {
  console.log(`   没有重复的格式化日期`);
}

console.log("\n6. 模拟X轴刻度显示:");
console.log(`   数据点数量: ${testData.length}`);
console.log(`   如果X轴使用默认间隔，可能只显示部分刻度`);
console.log(`   建议: 在XAxis中添加 interval={0} 显示所有刻度`);