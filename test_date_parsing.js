// 测试日期解析问题
console.log("=== 测试日期解析 ===");

// 1 Week数据的time字段格式
const timeField = '2026-02-17 15:30:00';

// 当前代码的转换方式
const timeStr1 = timeField.includes(' ') ? timeField : `${timeField}T00:00:00Z`;
console.log(`1. 当前转换: "${timeField}" -> "${timeStr1}"`);

try {
  const date1 = new Date(timeStr1);
  console.log(`   结果: ${date1.toISOString()} (有效: ${!isNaN(date1.getTime())})`);
} catch (e) {
  console.log(`   错误: ${e.message}`);
}

// 正确的转换方式
const timeStr2 = timeField.replace(' ', 'T') + 'Z';
console.log(`\n2. 正确转换: "${timeField}" -> "${timeStr2}"`);

try {
  const date2 = new Date(timeStr2);
  console.log(`   结果: ${date2.toISOString()} (有效: ${!isNaN(date2.getTime())})`);
} catch (e) {
  console.log(`   错误: ${e.message}`);
}

// 测试另一个格式
const timeField2 = '2026-02-17';
const timeStr3 = timeField2.includes(' ') ? timeField2 : `${timeField2}T00:00:00Z`;
console.log(`\n3. 日线数据转换: "${timeField2}" -> "${timeStr3}"`);

try {
  const date3 = new Date(timeStr3);
  console.log(`   结果: ${date3.toISOString()} (有效: ${!isNaN(date3.getTime())})`);
} catch (e) {
  console.log(`   错误: ${e.message}`);
}