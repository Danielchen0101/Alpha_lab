/**
 * 测试 Polygon API 连接
 */

const axios = require('axios');

// Polygon API 配置
const POLYGON_API_KEY = 'Pb17vE12y3eH4ixU_P3or5W89TfFbN7E';
const POLYGON_BASE_URL = 'https://api.polygon.io';

async function testPolygonAPI() {
  console.log('🚀 测试 Polygon.io API 连接');
  console.log('='.repeat(50));
  
  try {
    // 测试 1: 获取股票详情 (AAPL)
    console.log('\n1. 测试获取股票详情 (AAPL):');
    const detailsResponse = await axios.get(`${POLYGON_BASE_URL}/v3/reference/tickers/AAPL`, {
      params: {
        apiKey: POLYGON_API_KEY
      }
    });
    
    if (detailsResponse.data && detailsResponse.data.results) {
      const ticker = detailsResponse.data.results;
      console.log('   ✅ 成功');
      console.log(`   公司名称: ${ticker.name}`);
      console.log(`   行业: ${ticker.sic_description || 'N/A'}`);
      console.log(`   市值: ${ticker.market_cap ? `$${ticker.market_cap.toLocaleString()}` : 'N/A'}`);
    } else {
      console.log('   ❌ 失败 - 无数据返回');
    }
    
  } catch (error) {
    console.log('   ❌ 失败:', error.message);
    if (error.response) {
      console.log('   状态码:', error.response.status);
      console.log('   错误数据:', error.response.data);
    }
  }
  
  try {
    // 测试 2: 获取前一日收盘数据
    console.log('\n2. 测试获取前一日收盘数据 (AAPL):');
    const prevCloseResponse = await axios.get(`${POLYGON_BASE_URL}/v2/aggs/ticker/AAPL/prev`, {
      params: {
        apiKey: POLYGON_API_KEY
      }
    });
    
    if (prevCloseResponse.data && prevCloseResponse.data.results) {
      const result = prevCloseResponse.data.results[0];
      console.log('   ✅ 成功');
      console.log(`   收盘价: $${result.c}`);
      console.log(`   涨跌: $${result.d}`);
      console.log(`   涨跌幅: ${result.dp}%`);
    } else {
      console.log('   ❌ 失败 - 无数据返回');
    }
    
  } catch (error) {
    console.log('   ❌ 失败:', error.message);
    if (error.response) {
      console.log('   状态码:', error.response.status);
      console.log('   错误数据:', error.response.data);
    }
  }
  
  try {
    // 测试 3: 搜索股票
    console.log('\n3. 测试搜索股票 (AAPL):');
    const searchResponse = await axios.get(`${POLYGON_BASE_URL}/v3/reference/tickers`, {
      params: {
        apiKey: POLYGON_API_KEY,
        search: 'AAPL',
        limit: 5
      }
    });
    
    if (searchResponse.data && searchResponse.data.results) {
      console.log('   ✅ 成功');
      console.log(`   结果数量: ${searchResponse.data.results.length}`);
      searchResponse.data.results.forEach((ticker, i) => {
        console.log(`   ${i+1}. ${ticker.ticker} - ${ticker.name}`);
      });
    } else {
      console.log('   ❌ 失败 - 无数据返回');
    }
    
  } catch (error) {
    console.log('   ❌ 失败:', error.message);
    if (error.response) {
      console.log('   状态码:', error.response.status);
      console.log('   错误数据:', error.response.data);
    }
  }
  
  try {
    // 测试 4: 获取聚合数据 (历史数据)
    console.log('\n4. 测试获取历史数据 (AAPL, 1个月):');
    const fromDate = new Date();
    fromDate.setMonth(fromDate.getMonth() - 1);
    const toDate = new Date();
    
    const aggregatesResponse = await axios.get(`${POLYGON_BASE_URL}/v2/aggs/ticker/AAPL/range/1/day/${fromDate.toISOString().split('T')[0]}/${toDate.toISOString().split('T')[0]}`, {
      params: {
        apiKey: POLYGON_API_KEY,
        adjusted: true,
        sort: 'asc'
      }
    });
    
    if (aggregatesResponse.data && aggregatesResponse.data.results) {
      console.log('   ✅ 成功');
      console.log(`   数据点数: ${aggregatesResponse.data.results.length}`);
      if (aggregatesResponse.data.results.length > 0) {
        const first = aggregatesResponse.data.results[0];
        console.log(`   第一个数据点:`);
        console.log(`     时间: ${new Date(first.t).toLocaleDateString()}`);
        console.log(`     开盘: $${first.o}`);
        console.log(`     最高: $${first.h}`);
        console.log(`     最低: $${first.l}`);
        console.log(`     收盘: $${first.c}`);
        console.log(`     成交量: ${first.v.toLocaleString()}`);
      }
    } else {
      console.log('   ❌ 失败 - 无数据返回');
    }
    
  } catch (error) {
    console.log('   ❌ 失败:', error.message);
    if (error.response) {
      console.log('   状态码:', error.response.status);
      console.log('   错误数据:', error.response.data);
    }
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('✅ Polygon API 测试完成');
}

// 运行测试
testPolygonAPI().catch(console.error);