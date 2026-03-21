// 直接测试API和前端逻辑
const fetch = require('node-fetch');

async function testDirect() {
  console.log('=== 直接测试API和前端逻辑 ===\n');
  
  // 1. 测试后端API
  console.log('1. 测试后端API返回的数据:');
  try {
    const response = await fetch('http://localhost:8890/api/market/history/AAPL?range=1week&interval=30min');
    const data = await response.json();
    
    console.log(`  状态码: ${response.status}`);
    console.log(`  dataSource: ${data.dataSource}`);
    console.log(`  note: ${data.note}`);
    console.log(`  count: ${data.count}`);
    
    if (data.data && data.data.length > 0) {
      const firstPoint = data.data[0];
      const lastPoint = data.data[data.data.length - 1];
      
      console.log(`  第一个点: ${firstPoint.time} - ${firstPoint.close}`);
      console.log(`  最后一个点: ${lastPoint.time} - ${lastPoint.close}`);
      
      // 分析分钟分布
      const minuteCounts = {};
      data.data.forEach(item => {
        const timeStr = item.time;
        if (timeStr && timeStr.includes(':')) {
          const timePart = timeStr.includes(' ') ? timeStr.split(' ')[1] : timeStr;
          const minute = timePart.split(':')[1];
          minuteCounts[minute] = (minuteCounts[minute] || 0) + 1;
        }
      });
      
      console.log(`  分钟分布:`, minuteCounts);
      console.log(`  有:00数据: ${'00' in minuteCounts}`);
      console.log(`  有:30数据: ${'30' in minuteCounts}`);
      
      // 打印前10个点
      console.log('\n  前10个点:');
      for (let i = 0; i < Math.min(10, data.data.length); i++) {
        console.log(`    ${i+1}. ${data.data[i].time}`);
      }
      
      // 打印后10个点
      console.log('\n  后10个点:');
      const startIdx = Math.max(0, data.data.length - 10);
      for (let i = startIdx; i < data.data.length; i++) {
        console.log(`    ${i+1}. ${data.data[i].time}`);
      }
    }
  } catch (error) {
    console.log(`  后端API测试失败: ${error.message}`);
  }
  
  console.log('\n2. 模拟前端处理逻辑:');
  
  // 模拟前端处理逻辑
  const simulateFrontendProcessing = (apiData) => {
    if (!apiData.data || apiData.data.length === 0) {
      return null;
    }
    
    console.log('  a. 后端返回原始数据点数:', apiData.data.length);
    
    // 反转数据（后端返回的是倒序）
    const reversedData = [...apiData.data].reverse();
    
    // 目标：从3/13 09:30开始，到今天16:00结束
    const targetStartDate = new Date('2026-03-13T09:30:00.000Z');
    const today = new Date();
    const targetEndDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 16, 0, 0, 0);
    
    console.log(`  b. 目标时间范围: ${targetStartDate.toISOString()} 到 ${targetEndDate.toISOString()}`);
    
    // 过滤出目标时间范围内的数据
    const filteredData = reversedData.filter(item => {
      const date = new Date(item.time.replace(' ', 'T') + 'Z');
      return date >= targetStartDate && date <= targetEndDate;
    });
    
    console.log(`  c. 过滤后数据点数: ${filteredData.length}`);
    
    // 按时间排序
    filteredData.sort((a, b) => {
      const dateA = new Date(a.time.replace(' ', 'T') + 'Z');
      const dateB = new Date(b.time.replace(' ', 'T') + 'Z');
      return dateA.getTime() - dateB.getTime();
    });
    
    // 检查是否缺少今天的16:00
    const todayDate = new Date();
    todayDate.setUTCHours(16, 0, 0, 0);
    const today1600Str = todayDate.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '');
    
    const hasToday1600 = filteredData.some(item => {
      const itemTime = item.time;
      return itemTime === today1600Str;
    });
    
    console.log(`  d. 是否有今天16:00: ${hasToday1600}`);
    
    if (!hasToday1600) {
      console.log('  e. 需要补充Finnhub收盘价');
      // 这里模拟Finnhub补充
      const finnhubPrice = 250.50; // 模拟价格
      filteredData.push({
        time: today1600Str,
        open: finnhubPrice,
        high: finnhubPrice,
        low: finnhubPrice,
        close: finnhubPrice,
        volume: 1000
      });
      
      // 重新排序
      filteredData.sort((a, b) => {
        const dateA = new Date(a.time.replace(' ', 'T') + 'Z');
        const dateB = new Date(b.time.replace(' ', 'T') + 'Z');
        return dateA.getTime() - dateB.getTime();
      });
    }
    
    return filteredData;
  };
  
  // 获取API数据并模拟处理
  try {
    const response = await fetch('http://localhost:8890/api/market/history/AAPL?range=1week&interval=30min');
    const apiData = await response.json();
    
    const processedData = simulateFrontendProcessing(apiData);
    
    if (processedData && processedData.length > 0) {
      console.log(`\n  f. 最终处理数据点数: ${processedData.length}`);
      console.log(`  g. 第一个点: ${processedData[0].time}`);
      console.log(`  h. 最后一个点: ${processedData[processedData.length - 1].time}`);
      
      // 检查数据顺序
      console.log('\n  i. 检查数据顺序 (前14个点，应该是一天的完整序列):');
      for (let i = 0; i < Math.min(14, processedData.length); i++) {
        console.log(`    ${i+1}. ${processedData[i].time}`);
      }
      
      // 生成X轴ticks
      console.log('\n3. 模拟X轴ticks生成:');
      const get1WeekTicks = (chartData) => {
        const ticks = [];
        const pointsPerDay = 14; // 09:30-16:00，每30分钟，共14个点
        
        for (let day = 0; day < 7; day++) {
          const dayStartIndex = day * pointsPerDay;
          
          if (dayStartIndex >= chartData.length) break;
          
          // 添加09:30
          if (dayStartIndex < chartData.length) {
            ticks.push(chartData[dayStartIndex].time);
          }
          
          // 添加12:00
          const noonIndex = dayStartIndex + 5;
          if (noonIndex < chartData.length) {
            ticks.push(chartData[noonIndex].time);
          }
          
          // 添加16:00
          const closeIndex = dayStartIndex + 13;
          if (closeIndex < chartData.length) {
            ticks.push(chartData[closeIndex].time);
          }
        }
        
        return ticks;
      };
      
      const ticks = get1WeekTicks(processedData);
      console.log(`  X轴ticks数量: ${ticks.length}`);
      console.log('  X轴ticks列表:');
      ticks.forEach((tick, i) => {
        console.log(`    ${i+1}. ${tick}`);
      });
      
      // 检查周末处理
      console.log('\n4. 周末处理分析:');
      const dates = new Set();
      processedData.forEach(item => {
        const dateStr = item.time.split(' ')[0];
        dates.add(dateStr);
      });
      
      console.log('  数据中包含的日期:');
      Array.from(dates).sort().forEach(date => {
        console.log(`    ${date}`);
      });
      
      const weekendDates = ['2026-03-14', '2026-03-15'];
      const hasWeekendData = weekendDates.some(date => dates.has(date));
      console.log(`  是否包含周末数据: ${hasWeekendData ? '是' : '否'}`);
      
      if (!hasWeekendData) {
        console.log('  说明: 周末数据已被过滤，图表不会显示周末的交易点');
      }
    }
  } catch (error) {
    console.log(`  模拟测试失败: ${error.message}`);
  }
  
  console.log('\n=== 测试完成 ===');
}

// 运行测试
testDirect().catch(console.error);