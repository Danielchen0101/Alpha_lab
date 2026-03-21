// 验证两层交错显示修复
const fs = require('fs');
const path = require('path');

console.log('=== 两层交错显示修复验证 ===\n');

// 读取SymbolAnalysis.tsx文件
const filePath = path.join(__dirname, 'frontend/src/pages/SymbolAnalysis.tsx');
const content = fs.readFileSync(filePath, 'utf8');

// 1. 修改前真实XAxis代码块
console.log('1. 修改前真实XAxis代码块:');
console.log('```jsx');
console.log('<XAxis');
console.log('  dataKey="date"');
console.log('  tick={{');
console.log('    fontSize: selectedTimeframe === \'1W\' ? 6 : 11,');
console.log('    fill: \'#333\'');
console.log('  }}');
console.log('  height={selectedTimeframe === \'1W\' ? 60 : 40}');
console.log('  tickFormatter={formatXAxisTick}');
console.log('  interval={0}');
console.log('  ticks={');
console.log('    selectedTimeframe === \'1W\' ? get1WeekTicks(chartData) :');
console.log('    selectedTimeframe === \'1M\' ? get1MonthTicks(chartData) :');
console.log('    selectedTimeframe === \'3M\' ? get3MonthsTicks(chartData) :');
console.log('    selectedTimeframe === \'1Y\' ? monthPoints.map(p => p.date) :');
console.log('    undefined');
console.log('  }');
console.log('  minTickGap={0}');
console.log('  padding={');
console.log('    selectedTimeframe === \'1W\' ? { left: 15, right: 15 } :');
console.log('    selectedTimeframe === \'1M\' ? { left: 0, right: 30 } :');
console.log('    selectedTimeframe === \'3M