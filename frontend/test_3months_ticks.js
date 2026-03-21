// 模拟测试get3MonthsTicks函数
const chartData = [
  { date: "2025-12-22T00:00:00.000Z", close: 100 },
  { date: "2025-12-23T00:00:00.000Z", close: 101 },
  { date: "2025-12-24T00:00:00.000Z", close: 102 },
  { date: "2025-12-26T00:00:00.000Z", close: 103 }, // 12/26 (跳过周末)
  { date: "2025-12-29T00:00:00.000Z", close: 104 },
  { date: "2025-12-30T00:00:00.000Z", close: 105 },
  { date: "2025-12-31T00:00:00.000Z", close: 106 },
  { date: "2026-01-02T00:00:00.000Z", close: 107 }, // 1/2 (跳过元旦)
  { date: "2026-01-05T00:00:00.000Z", close: 108 }, // 1/5 (dayDiff=14)
  { date: "2026-01-06T00:00:00.000Z", close: 109 },
  { date: "2026-01-07T00:00:00.000Z", close: 110 },
  { date: "2026-01-08T00:00:00.000Z", close: 111 },
  { date: "2026-01-09T00:00:00.000Z", close: 112 },
  { date: "2026-01-12T00:00:00.000Z", close: 113 },
  { date: "2026-01-13T00:00:00.000Z", close: 114 },
  { date: "2026-01-14T00:00:00.000Z", close: 115 },
  { date: "2026-01-15T00:00:00.000Z", close: 116 },
  { date: "2026-01-16T00:00:00.000Z", close: 117 },
  { date: "2026-01-19T00:00:00.000Z", close: 118 }, // 1/19 (dayDiff=28)
  { date: "2026-01-20T00:00:00.000Z", close: 119 },
  { date: "2026-01-21T00:00:00.000Z", close: 120 },
  { date: "2026-01-22T00:00:00.000Z", close: 121 },
  { date: "2026-01-23T00:00:00.000Z", close: 122 },
  { date: "2026-01-26T00:00:00.000Z", close: 123 },
  { date: "2026-01-27T00:00:00.000Z", close: 124 },
  { date: "2026-01-28T00:00:00.000Z", close: 125 },
  { date: "2026-01-29T00:00:00.000Z", close: 126 },
  { date: "2026-01-30T00:00:00.000Z", close: 127 },
  { date: "2026-02-02T00:00:00.000Z", close: 128 }, // 2/2 (dayDiff=42)
  { date: "2026-02-03T00:00:00.000Z", close: 129 },
  { date: "2026-02-04T00:00:00.000Z", close: 130 },
  { date: "2026-02-05T00:00:00.000Z", close: 131 },
  { date: "2026-02-06T00:00:00.000Z", close: 132 },
  { date: "2026-02-09T00:00:00.000Z", close: 133 },
  { date: "2026-02-10T00:00:00.000Z", close: 134 },
  { date: "2026-02-11T00:00:00.000Z", close: 135 },
  { date: "2026-02-12T00:00:00.000Z", close: 136 },
  { date: "2026-02-13T00:00:00.000Z", close: 137 },
  { date: "2026-02-16T00:00:00.000Z", close: 138 }, // 2/16 (dayDiff=56)
  { date: "2026-02-17T00:00:00.000Z", close: 139 },
  { date: "2026-02-18T00:00:00.000Z", close: 140 },
  { date: "2026-02-19T00:00:00.000Z", close: 141 },
  { date: "2026-02-20T00:00:00.000Z", close: 142 },
  { date: "2026-02-23T00:00:00.000Z", close: 143 },
  { date: "2026-02-24T00:00:00.000Z", close: 144 },
  { date: "2026-02-25T00:00:00.000Z", close: 145 },
  { date: "2026-02-26T00:00:00.000Z", close: 146 },
  { date: "2026-02-27T00:00:00.000Z", close: 147 },
  { date: "2026-03-02T00:00:00.000Z", close: 148 }, // 3/2 (dayDiff=70)
  { date: "2026-03-03T00:00:00.000Z", close: 149 },
  { date: "2026-03-04T00:00:00.000Z", close: 150 },
  { date: "2026-03-05T00:00:00.000Z", close: 151 },
  { date: "2026-03-06T00:00:00.000Z", close: 152 },
  { date: "2026-03-09T00:00:00.000Z", close: 153 },
  { date: "2026-03-10T00:00:00.000Z", close: 154 },
  { date: "2026-03-11T00:00:00.000Z", close: 155 },
  { date: "2026-03-12T00:00:00.000Z", close: 156 },
  { date: "2026-03-13T00:00:00.000Z", close: 157 },
  { date: "2026-03-16T00:00:00.000Z", close: 158 }, // 3/16 (dayDiff=84)
  { date: "2026-03-17T00:00:00.000Z", close: 159 },
  { date: "2026-03-18T00:00:00.000Z", close: 160 },
  { date: "2026-03-19T00:00:00.000Z", close: 161 },
  { date: "2026-03-20T00:00:00.000Z", close: 162 }  // 3/20 (dayDiff=88)
];

// 模拟get3MonthsTicks函数
function get3MonthsTicks(chartData) {
  if (!chartData || chartData.length === 0) {
    return [];
  }
  
  const ticks = [];
  
  try {
    // 获取第一个数据点的日期
    const firstDate = new Date(chartData[0].date);
    
    // 规则1: 第一个点总是显示标签
    ticks.push(chartData[0].date);
    
    // 遍历所有数据点，找出每14天的点
    for (let i = 1; i < chartData.length; i++) {
      const currentDate = new Date(chartData[i].date);
      const timeDiff = currentDate.getTime() - firstDate.getTime();
      const dayDiff = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
      
      // 规则2: 每14天显示一个标签
      if (dayDiff % 14 === 0 && dayDiff > 0) {
        ticks.push(chartData[i].date);
      }
    }
    
    // 规则3: 最后一个点也显示标签（如果还没显示过）
    const lastDate = new Date(chartData[chartData.length - 1].date);
    const lastTimeDiff = lastDate.getTime() - firstDate.getTime();
    const lastDayDiff = Math.floor(lastTimeDiff / (1000 * 60 * 60 * 24));
    
    if (lastDayDiff % 14 !== 0 && !ticks.includes(chartData[chartData.length - 1].date)) {
      ticks.push(chartData[chartData.length - 1].date);
    }
    
    // 格式化显示
    const formattedTicks = ticks.map(t => {
      const d = new Date(t);
      return {
        date: t,
        formatted: `${d.getUTCMonth() + 1}/${d.getUTCDate()}`,
        dayDiff: Math.floor((new Date(t).getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24))
      };
    });
    
    console.log(`[3 Months] 生成 ${ticks.length} 个ticks:`);
    formattedTicks.forEach(t => {
      console.log(`  ${t.formatted} (dayDiff=${t.dayDiff})`);
    });
    
    return ticks;
  } catch (e) {
    console.error('Error generating 3 Months ticks:', e);
    return [];
  }
}

// 测试
console.log("=== 测试get3MonthsTicks函数 ===");
const ticks = get3MonthsTicks(chartData);

// 检查排序
console.log("\n=== 检查排序 ===");
const sortedTicks = [...ticks].sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
const isSorted = JSON.stringify(ticks) === JSON.stringify(sortedTicks);
console.log(`ticks是否已排序: ${isSorted}`);

if (!isSorted) {
  console.log("排序后的ticks:");
  sortedTicks.forEach(t => {
    const d = new Date(t);
    console.log(`  ${d.getUTCMonth() + 1}/${d.getUTCDate()}`);
  });
}

// 检查重复
console.log("\n=== 检查重复 ===");
const uniqueTicks = [...new Set(ticks)];
if (uniqueTicks.length !== ticks.length) {
  console.log(`发现重复: ${ticks.length - uniqueTicks.length} 个重复项`);
}

// 预期的标签序列
console.log("\n=== 预期的标签序列 ===");
const expectedLabels = ["12/22", "1/5", "1/19", "2/2", "2/16", "3/2", "3/16", "3/20"];
console.log("预期:", expectedLabels.join(", "));

const actualLabels = ticks.map(t => {
  const d = new Date(t);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
});
console.log("实际:", actualLabels.join(", "));

// 比较
if (JSON.stringify(expectedLabels) === JSON.stringify(actualLabels)) {
  console.log("✅ 标签序列正确！");
} else {
  console.log("❌ 标签序列不正确！");
  console.log("差异:");
  expectedLabels.forEach((expected, i) => {
    const actual = actualLabels[i] || "(缺失)";
    if (expected !== actual) {
      console.log(`  位置 ${i}: 预期 ${expected}, 实际 ${actual}`);
    }
  });
}