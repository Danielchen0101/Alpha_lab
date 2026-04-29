#!/usr/bin/env node
/**
 * 测试NVDA错误捕获
 * 模拟前端扫描过程，捕获确切错误
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:8889';

async function testNVDAError() {
  console.log('=== 开始测试NVDA错误捕获 ===\n');
  
  // 测试NVDA的各个API端点
  const endpoints = [
    { name: 'AI分析', url: '/ai/analyze/single', method: 'POST', data: { symbol: 'NVDA' } },
    { name: '股票数据', url: '/api/stock/NVDA', method: 'GET' },
    { name: '新闻数据', url: '/api/news/NVDA', method: 'GET' }
  ];
  
  for (const endpoint of endpoints) {
    console.log(`测试 ${endpoint.name}...`);
    try {
      const response = await axios({
        method: endpoint.method,
        url: BASE_URL + endpoint.url,
        data: endpoint.data,
        timeout: 30000
      });
      
      console.log(`✅ ${endpoint.name} 成功`);
      console.log(`   状态码: ${response.status}`);
      console.log(`   成功: ${response.data?.success || 'N/A'}`);
      console.log(`   趋势: ${response.data?.trend || 'N/A'}`);
      console.log(`   响应时间: ${response.data?.responseTime || 'N/A'}ms\n`);
      
    } catch (error) {
      console.error(`❌ ${endpoint.name} 失败`);
      console.error(`   错误消息: ${error.message}`);
      console.error(`   状态码: ${error.response?.status || 'N/A'}`);
      console.error(`   状态文本: ${error.response?.statusText || 'N/A'}`);
      console.error(`   错误数据: ${JSON.stringify(error.response?.data || {}, null, 2)}`);
      console.error(`   错误堆栈: ${error.stack}\n`);
      
      // 如果是Axios错误，打印更多信息
      if (error.isAxiosError) {
        console.error('   Axios错误详情:');
        console.error(`   请求URL: ${error.config?.url}`);
        console.error(`   请求方法: ${error.config?.method}`);
        console.error(`   请求数据: ${JSON.stringify(error.config?.data || {}, null, 2)}`);
      }
    }
  }
  
  // 测试批次处理
  console.log('=== 测试批次处理 ===\n');
  const testSymbols = ['AAPL', 'MSFT', 'NVDA', 'AMD', 'INTC'];
  
  const batchPromises = testSymbols.map(async (symbol, index) => {
    console.log(`开始处理 ${symbol} (${index + 1}/${testSymbols.length})...`);
    
    try {
      const startTime = Date.now();
      const response = await axios.post(
        BASE_URL + '/ai/analyze/single',
        { symbol },
        { timeout: 30000 }
      );
      
      const duration = Date.now() - startTime;
      console.log(`✅ ${symbol} 处理成功`);
      console.log(`   耗时: ${duration}ms`);
      console.log(`   趋势: ${response.data.trend}`);
      console.log(`   分数: ${response.data.overallScore}`);
      console.log(`   来源: ${response.data.provenance?.aiAnalysis || 'N/A'}\n`);
      
      return { symbol, success: true, data: response.data };
      
    } catch (error) {
      console.error(`❌ ${symbol} 处理失败`);
      console.error(`   错误: ${error.message}`);
      console.error(`   堆栈: ${error.stack}\n`);
      
      return { symbol, success: false, error: error.message };
    }
  });
  
  console.log('等待所有promises完成...\n');
  try {
    const results = await Promise.allSettled(batchPromises);
    
    console.log('=== 批次处理结果 ===\n');
    const fulfilled = results.filter(r => r.status === 'fulfilled').length;
    const rejected = results.filter(r => r.status === 'rejected').length;
    
    console.log(`总promises: ${results.length}`);
    console.log(`fulfilled: ${fulfilled}`);
    console.log(`rejected: ${rejected}\n`);
    
    // 检查是否有promise在allSettled级别被reject
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.error(`⚠️ Promise ${index} (${testSymbols[index]}) 在allSettled级别被reject:`);
        console.error(`   原因: ${result.reason?.message || 'Unknown'}`);
        console.error(`   堆栈: ${result.reason?.stack}\n`);
      }
    });
    
    // 检查fulfilled的结果
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        const value = result.value;
        console.log(`${value.symbol}: ${value.success ? '✅ 成功' : '❌ 失败'}`);
        if (!value.success) {
          console.log(`   错误: ${value.error}`);
        }
      }
    });
    
  } catch (error) {
    console.error('=== Promise.allSettled 本身失败 ===');
    console.error('这表示有同步错误或在promise创建时抛出错误');
    console.error(`错误: ${error.message}`);
    console.error(`堆栈: ${error.stack}\n`);
  }
  
  console.log('=== 测试完成 ===');
}

// 运行测试
testNVDAError().catch(error => {
  console.error('测试运行失败:', error);
  process.exit(1);
});