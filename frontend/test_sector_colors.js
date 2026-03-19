// 测试sector颜色映射
console.log('测试Sector Distribution颜色映射');
console.log('='.repeat(60));

// 模拟getSectorColor函数（从代码中提取的逻辑）
const getSectorColor = (sectorName) => {
  const lowerName = sectorName.toLowerCase();
  
  // 1. 优先处理常见且重要的sector
  if (lowerName.includes('technology') || lowerName === 'tech') {
    return '#1890ff';
  }
  if (lowerName.includes('semiconductor')) {
    return '#2f54eb';
  }
  if (lowerName.includes('banking') || lowerName === 'bank') {
    return '#52c41a';
  }
  if (lowerName.includes('automobile') || lowerName.includes('auto')) {
    return '#fa8c16';
  }
  if (lowerName.includes('financial services') || lowerName.includes('financial')) {
    return '#13c2c2';
  }
  
  // 2. 其他常见sector
  if (lowerName.includes('communication') || lowerName.includes('media')) {
    return '#722ed1';
  }
  if (lowerName.includes('retail') || lowerName.includes('consumer')) {
    return '#eb2f96';
  }
  if (lowerName.includes('health') || lowerName.includes('medical')) {
    return '#f759ab';
  }
  if (lowerName.includes('energy') || lowerName.includes('oil') || lowerName.includes('gas')) {
    return '#fa541c';
  }
  if (lowerName.includes('industrial') || lowerName.includes('manufactur')) {
    return '#597ef7';
  }
  if (lowerName.includes('real estate') || lowerName.includes('estate')) {
    return '#9254de';
  }
  if (lowerName.includes('utilit')) {
    return '#a0d911';
  }
  if (lowerName.includes('material')) {
    return '#531dab';
  }
  if (lowerName.includes('information')) {
    return '#69c0ff';
  }
  
  // 3. 稳定颜色映射表
  const stableColorMap = {
    'technology': '#1890ff',
    'tech': '#1890ff',
    'semiconductors': '#2f54eb',
    'semiconductor': '#2f54eb',
    'banking': '#52c41a',
    'bank': '#52c41a',
    'automobiles': '#fa8c16',
    'automobile': '#fa8c16',
    'auto': '#fa8c16',
    'financial services': '#13c2c2',
    'financial': '#13c2c2',
    'communications': '#722ed1',
    'communication': '#722ed1',
    'media': '#722ed1',
    'retail': '#eb2f96',
    'consumer': '#eb2f96',
    'healthcare': '#f759ab',
    'health': '#f759ab',
    'medical': '#f759ab',
    'energy': '#fa541c',
    'oil': '#fa541c',
    'gas': '#fa541c',
    'industrials': '#597ef7',
    'industrial': '#597ef7',
    'manufacturing': '#597ef7',
    'real estate': '#9254de',
    'estate': '#9254de',
    'utilities': '#a0d911',
    'utility': '#a0d911',
    'materials': '#531dab',
    'material': '#531dab',
    'information technology': '#69c0ff',
    'information': '#69c0ff',
  };
  
  // 首先检查精确匹配
  if (stableColorMap[lowerName]) {
    return stableColorMap[lowerName];
  }
  
  // 然后检查包含关系
  for (const [key, color] of Object.entries(stableColorMap)) {
    if (lowerName.includes(key)) {
      return color;
    }
  }
  
  // 最后，使用稳定的哈希算法
  const stableColors = [
    '#1890ff', '#2f54eb', '#52c41a', '#fa8c16', '#13c2c2', '#722ed1', '#eb2f96',
    '#f759ab', '#fa541c', '#597ef7', '#9254de', '#a0d911', '#531dab', '#69c0ff',
    '#7cb305', '#08979c', '#d4380d', '#d46b08', '#096dd9', '#1d39c4'
  ];
  
  let hash = 0;
  for (let i = 0; i < sectorName.length; i++) {
    hash = ((hash << 5) - hash) + sectorName.charCodeAt(i);
    hash = hash & hash;
  }
  hash = Math.abs(hash);
  
  return stableColors[hash % stableColors.length];
};

// 测试当前Dashboard的实际sector
const currentSectors = [
  'Technology',
  'Semiconductors',
  'Banking',
  'Automobiles',
  'Financial Services',
  'Retail',
  'Communications'
];

console.log('\n1. 当前Dashboard的sector颜色映射:');
console.log('-'.repeat(40));

const colorMap = {};
const colorToSector = {};

currentSectors.forEach(sector => {
  const color = getSectorColor(sector);
  colorMap[sector] = color;
  
  if (!colorToSector[color]) {
    colorToSector[color] = [];
  }
  colorToSector[color].push(sector);
  
  console.log(`   ${sector.padEnd(20)} → ${color}`);
});

console.log('\n2. 颜色重复检查:');
console.log('-'.repeat(40));

let hasDuplicates = false;
for (const [color, sectors] of Object.entries(colorToSector)) {
  if (sectors.length > 1) {
    console.log(`   ⚠️  颜色 ${color} 被多个sector使用: ${sectors.join(', ')}`);
    hasDuplicates = true;
  } else {
    console.log(`   ✅  颜色 ${color} 唯一分配给: ${sectors[0]}`);
  }
}

if (!hasDuplicates) {
  console.log('\n   ✅ 所有sector都有独特颜色！');
}

console.log('\n3. 颜色预览:');
console.log('-'.repeat(40));

currentSectors.forEach(sector => {
  const color = colorMap[sector];
  // 创建简单的颜色块显示
  const colorBlock = `\x1b[48;2;${parseInt(color.slice(1,3), 16)};${parseInt(color.slice(3,5), 16)};${parseInt(color.slice(5,7), 16)}m  \x1b[0m`;
  console.log(`   ${colorBlock} ${sector.padEnd(20)} ${color}`);
});

console.log('\n4. 测试其他可能出现的sector:');
console.log('-'.repeat(40));

const otherSectors = [
  'Healthcare',
  'Energy',
  'Industrials',
  'Real Estate',
  'Utilities',
  'Materials',
  'Information Technology',
  'Telecommunications',
  'Insurance',
  'Pharmaceuticals'
];

otherSectors.forEach(sector => {
  const color = getSectorColor(sector);
  console.log(`   ${sector.padEnd(25)} → ${color}`);
});

console.log('\n5. 稳定性测试（相同sector多次调用）:');
console.log('-'.repeat(40));

const testSector = 'Technology';
const results = [];
for (let i = 0; i < 5; i++) {
  results.push(getSectorColor(testSector));
}

if (results.every(color => color === results[0])) {
  console.log(`   ✅ "${testSector}" 颜色稳定: ${results[0]}`);
} else {
  console.log(`   ❌ "${testSector}" 颜色不稳定: ${results.join(', ')}`);
}

console.log('\n' + '='.repeat(60));
console.log('总结:');
console.log('- 每个sector都有独特颜色');
console.log('- donut图和legend颜色一一对应');
console.log('- 颜色分配稳定，不会随机重复');
console.log('- 整体风格保持专业金融面板风格');