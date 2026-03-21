// 调试XAxis显示问题
const fs = require('fs');
const path = require('path');

console.log('=== 分析XAxis配置问题 ===\n');

// 读取SymbolAnalysis.tsx文件
const filePath = path.join(__dirname, 'frontend/src/pages/SymbolAnalysis.tsx');
const content = fs.readFileSync(filePath, 'utf8');

// 1. 查找XAxis配置
console.log('1. XAxis配置分析:');
const xAxisMatch = content.match(/<XAxis[\s\S]*?\/>/g);
if (xAxisMatch) {
  console.log(`找到 ${xAxisMatch.length} 个XAxis组件`);
  
  // 查找主图表的XAxis
  const mainXAxis = xAxisMatch.find(x => x.includes('dataKey="date"') && x.includes('tickFormatter={formatXAxisTick}'));
  if (mainXAxis) {
    console.log('\n主图表XAxis配置:');
    
    // 提取关键属性
    const props = {
      interval: extractProp(mainXAxis, 'interval'),
      minTickGap: extractProp(mainXAxis, 'minTickGap'),
      ticks: extractProp(mainXAxis, 'ticks'),
      height: extractProp(mainXAxis, 'height')
    };
    
    console.log('  interval:', props.interval);
    console.log('  minTickGap:', props.minTickGap);
    console.log('  height:', props.height);
    console.log('  ticks:', props.ticks ? '动态生成' : '未设置');
    
    // 分析interval配置
    if (props.interval && props.interval.includes('selectedTimeframe === \'1W\' ? 0')) {
      console.log('  ✅ 1 Week的interval=0，应该显示所有ticks');
    } else {
      console.log('  ⚠️ interval配置可能有问题');
    }
    
    // 分析minTickGap
    if (props.minTickGap && props.minTickGap.includes('selectedTimeframe === \'1W\' ? 60')) {
      console.log('  ⚠️ 1 Week的minTickGap=60，可能太宽导致标签被省略');
      console.log('     建议改为更小的值，如20或30');
    }
  }
}

// 2. 查找get1WeekTicks函数
console.log('\n2. get1WeekTicks函数分析:');
const get1WeekTicksMatch = content.match(/const get1WeekTicks[\s\S]*?\n};/);
if (get1WeekTicksMatch) {
  console.log('找到get1WeekTicks函数');
  
  // 检查函数逻辑
  const funcContent = get1WeekTicksMatch[0];
  
  // 检查是否按日期分组
  if (funcContent.includes('dataByDate')) {
    console.log('  ✅ 使用按日期分组逻辑');
  } else {
    console.log('  ⚠️ 可能还在使用固定索引逻辑');
  }
  
  // 检查目标时间点
  if (funcContent.includes('targetTimes') && funcContent.includes('09:30') && funcContent.includes('12:00') && funcContent.includes('16:00')) {
    console.log('  ✅ 目标时间点正确: 09:30, 12:00, 16:00');
  }
}

// 3. 查找formatXAxisTick函数中的1 Week处理
console.log('\n3. formatXAxisTick函数分析:');
const formatFuncMatch = content.match(/const formatXAxisTick[\s\S]*?} catch \(e\)/);
if (formatFuncMatch) {
  const formatContent = formatFuncMatch[0];
  
  // 查找1 Week的处理逻辑
  const weekMatch = formatContent.match(/selectedTimeframe === '1W'[\s\S]*?return[^;]+;/);
  if (weekMatch) {
    console.log('1 Week格式化逻辑:');
    console.log('  ' + weekMatch[0].replace(/\n/g, '\n  '));
    
    // 检查格式
    if (weekMatch[0].includes('month\\/day')) {
      console.log('  ✅ 格式: 月/日 小时:分钟');
    }
  }
}

// 4. 建议修复
console.log('\n4. 问题诊断和建议修复:');
console.log('问题1: minTickGap=60 太宽');
console.log('  修复: 将 minTickGap 改为 20 或 30');
console.log('\n问题2: 需要确保ticks正确生成');
console.log('  修复: 在XAxis前添加调试日志，验证ticks数组');
console.log('\n问题3: 需要验证formatXAxisTick是否正确格式化');
console.log('  修复: 在formatXAxisTick中添加1 Week的调试日志');

// 辅助函数：提取属性值
function extractProp(jsx, propName) {
  const regex = new RegExp(`${propName}=\\{([^}]+)\\}`);
  const match = jsx.match(regex);
  return match ? match[1] : null;
}

console.log('\n=== 分析完成 ===');