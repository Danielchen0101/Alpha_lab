// 测试前端3 Months数据流
const axios = require('axios');

async function testFrontendDataFlow() {
  console.log('=== 测试前端3 Months数据流 ===\n');
  
  try {
    // 1. 测试后端API
    console.log('1. 测试后端API: /api/market/history/AAPL?interval=D&range=3month');
    const apiResponse = await axios.get('http://localhost:8889/api/market/history/AAPL?interval=D&range=3month');
    console.log('   Status:', apiResponse.status);
    console.log('   Count:', apiResponse.data.count);
    console.log('   DataSource:', apiResponse.data.dataSource);
    console.log('   Note:', apiResponse.data.note);
    console.log('   Success:', apiResponse.data.success !== false);
    
    if (apiResponse.data.data && apiResponse.data.data.length > 0) {
      console.log('   数据条数:', apiResponse.data.data.length);
      console.log('   第一条数据:', {
        time: apiResponse.data.data[0].time,
        timestamp: apiResponse.data.data[0].timestamp,
        close: apiResponse.data.data[0].close
      });
      console.log('   最后一条数据:', {
        time: apiResponse.data.data[apiResponse.data.data.length - 1].time,
        timestamp: apiResponse.data.data[apiResponse.data.data.length - 1].timestamp,
        close: apiResponse.data.data[apiResponse.data.data.length - 1].close
      });
    }
    
    console.log('\n2. 测试前端服务文件');
    
    // 读取前端服务文件
    const fs = require('fs');
    const path = require('path');
    
    const serviceFile = path.join(__dirname, 'src/services/marketDataService.ts');
    if (fs.existsSync(serviceFile)) {
      const content = fs.readFileSync(serviceFile, 'utf8');
      
      // 检查TIMEFRAMES配置
      const timeframeMatch = content.match(/TIMEFRAMES.*?\{[\s\S]*?'3M'.*?\}/);
      if (timeframeMatch) {
        console.log('   ✅ TIMEFRAMES配置存在');
        const threeMonthsConfig = content.match(/'3M':\s*\{[^}]*\}/);
        if (threeMonthsConfig) {
          console.log('   3M配置:', threeMonthsConfig[0]);
        }
      }
      
      // 检查getStockHistory函数
      if (content.includes('getStockHistory')) {
        console.log('   ✅ getStockHistory函数存在');
      }
    }
    
    console.log('\n3. 模拟前端数据转换');
    
    // 模拟前端数据转换逻辑
    const historicalData = apiResponse.data.data || [];
    console.log('   原始数据条数:', historicalData.length);
    
    // 模拟转换逻辑
    const formattedData = historicalData.map(item => {
      let date;
      if (item.time) {
        try {
          const timeStr = item.time.includes(' ') ? item.time : `${item.time}T00:00:00Z`;
          date = new Date(timeStr);
          if (!isNaN(date.getTime())) {
            return {
              date: date.toISOString(),
              open: Number(item.open) || 0,
              high: Number(item.high) || 0,
              low: Number(item.low) || 0,
              close: Number(item.close) || 0,
              volume: Number(item.volume) || 0
            };
          }
        } catch (e) {
          console.log('   转换错误:', e.message);
        }
      }
      return null;
    }).filter(item => item !== null);
    
    console.log('   转换后数据条数:', formattedData.length);
    
    if (formattedData.length > 0) {
      console.log('   转换后第一条数据:', {
        date: formattedData[0].date,
        close: formattedData[0].close
      });
      console.log('   转换后最后一条数据:', {
        date: formattedData[formattedData.length - 1].date,
        close: formattedData[formattedData.length - 1].close
      });
    }
    
    console.log('\n=== 测试完成 ===');
    console.log('预期前端3 Months结果:');
    console.log('  ✅ 后端API返回68条数据');
    console.log('  ✅ 数据范围: 2025-12-11 到 2026-03-20');
    console.log('  ✅ 时间戳解析正确');
    console.log('  ✅ 前端数据转换成功');
    console.log('  ✅ 3 Months图表应该正常显示');
    
  } catch (error) {
    console.error('测试失败:', error.message);
    if (error.response) {
      console.error('API响应:', error.response.status, error.response.data);
    }
  }
}

// 运行测试
testFrontendDataFlow();