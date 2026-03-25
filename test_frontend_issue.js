// 测试前端TradingChart组件的数据处理问题
console.log("=== 测试前端TradingChart组件的数据处理 ===");

// 模拟后端返回的数据
const mockData = [
  { date: "2025-02-01", close: 150.0, signal: 0, volume: 1000000 },
  { date: "2025-02-02", close: 151.0, signal: 1, volume: 2000000 },
  { date: "2025-02-03", close: 149.5, signal: -1, volume: 1500000 }
];

console.log("1. 原始数据:");
console.log(mockData);
console.log(`数据条数: ${mockData.length}`);
console.log("");

// 模拟TradingChart组件的数据处理
console.log("2. 模拟TradingChart组件的数据处理:");

// 问题1: prices数组过滤
const prices = mockData.map(d => d.close).filter(Boolean);
console.log(`prices数组: ${prices}`);
console.log(`prices长度: ${prices.length}`);
console.log(`minPrice: ${Math.min(...prices)}`);
console.log(`maxPrice: ${Math.max(...prices)}`);
console.log("");

// 问题2: volumes数组过滤 - 这里有问题！
const volumes = mockData.map(d => d.volume || 0).filter(Boolean);
console.log(`volumes数组 (使用filter(Boolean)): ${volumes}`);
console.log(`volumes长度: ${volumes.length}`);
console.log(`注意: volume=0会被过滤掉!`);
console.log(`maxVolume: ${volumes.length > 0 ? Math.max(...volumes) : 0}`);
console.log("");

// 正确的volumes过滤方式
const volumesCorrect = mockData.map(d => d.volume || 0).filter(v => v !== undefined && v !== null);
console.log(`volumes数组 (正确方式): ${volumesCorrect}`);
console.log(`volumes长度: ${volumesCorrect.length}`);
console.log(`maxVolume: ${volumesCorrect.length > 0 ? Math.max(...volumesCorrect) : 0}`);
console.log("");

// 问题3: 检查hasVolumeData
const hasVolumeData = mockData.some(d => d.volume !== undefined && d.volume > 0);
console.log(`hasVolumeData: ${hasVolumeData}`);
console.log("");

// 问题4: 检查hasSMA20/hasSMA50
const hasSMA20 = mockData.some(d => d.sma20 !== undefined);
const hasSMA50 = mockData.some(d => d.sma50 !== undefined);
console.log(`hasSMA20: ${hasSMA20} (数据中没有sma20字段)`);
console.log(`hasSMA50: ${hasSMA50} (数据中没有sma50字段)`);
console.log("");

// 问题5: 检查chartData准备
const chartData = mockData.map((item, index) => {
  let volumeColor = '#cccccc';
  if (item.volume !== undefined && item.volume > 0) {
    if (index === 0) {
      volumeColor = '#cccccc';
    } else {
      const currentClose = item.close;
      const prevClose = mockData[index - 1].close;
      volumeColor = currentClose >= prevClose ? '#95de64' : '#ff7875';
    }
  }
  
  return {
    ...item,
    buySignal: item.signal === 1 ? item.close : null,
    sellSignal: item.signal === -1 ? item.close : null,
    volumeColor,
    volumeDisplay: item.volume || 0,
  };
});

console.log("3. 处理后的chartData:");
console.log(chartData);
console.log("");

// 测试实际场景 - 如果volume都是0会怎样？
console.log("4. 测试volume=0的场景:");
const zeroVolumeData = [
  { date: "2025-02-01", close: 150.0, signal: 0, volume: 0 },
  { date: "2025-02-02", close: 151.0, signal: 1, volume: 0 },
  { date: "2025-02-03", close: 149.5, signal: -1, volume: 0 }
];

const zeroVolumes = zeroVolumeData.map(d => d.volume || 0).filter(Boolean);
console.log(`zeroVolumes数组: ${zeroVolumes}`);
console.log(`zeroVolumes长度: ${zeroVolumes.length}`);
console.log(`maxVolume: ${zeroVolumes.length > 0 ? Math.max(...zeroVolumes) : 0}`);
console.log(`hasVolumeData: ${zeroVolumeData.some(d => d.volume !== undefined && d.volume > 0)}`);
console.log("");

// 测试实际场景 - 如果数据只有1条会怎样？
console.log("5. 测试只有1条数据的场景:");
const singleData = [{ date: "2025-02-01", close: 150.0, signal: 0, volume: 1000000 }];

const singlePrices = singleData.map(d => d.close).filter(Boolean);
const singleVolumes = singleData.map(d => d.volume || 0).filter(Boolean);
console.log(`singlePrices: ${singlePrices}`);
console.log(`singleVolumes: ${singleVolumes}`);
console.log(`minPrice/maxPrice: ${Math.min(...singlePrices)} / ${Math.max(...singlePrices)}`);
console.log(`maxVolume: ${singleVolumes.length > 0 ? Math.max(...singleVolumes) : 0}`);
console.log("");

console.log("=== 问题分析 ===");
console.log("1. volumes数组过滤问题:");
console.log("   - filter(Boolean)会把volume=0过滤掉");
console.log("   - 这会导致maxVolume=0，进而导致volume chart不显示");
console.log("");
console.log("2. 如果数据只有1条:");
console.log("   - 价格图表可能还能显示");
console.log("   - 但volume chart可能有问题");
console.log("");
console.log("3. 可能的解决方案:");
console.log("   - 修改volumes过滤逻辑: .filter(v => v !== undefined && v !== null)");
console.log("   - 或者: .filter(v => typeof v === 'number')");
console.log("   - 确保处理volume=0的情况");