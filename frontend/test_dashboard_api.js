// 测试Dashboard API
const testDashboard = async () => {
  console.log('测试Dashboard API...');
  
  try {
    // 测试后端API
    const backendResponse = await fetch('http://127.0.0.1:8889/api/market/stocks?dashboard=true');
    const backendData = await backendResponse.json();
    
    console.log('后端API响应:');
    console.log(`  股票数量: ${backendData.count}`);
    console.log(`  是否成功: ${backendData.success}`);
    console.log(`  耗时: ${backendData.elapsed}秒`);
    
    // 显示股票列表
    const symbols = backendData.stocks.map(s => s.symbol);
    console.log(`  股票列表 (${symbols.length}支): ${symbols.join(', ')}`);
    
    // 计算最大涨跌幅
    let largestMove = null;
    backendData.stocks.forEach(stock => {
      const changePercent = stock.changePercent || 0;
      if (!largestMove || Math.abs(changePercent) > Math.abs(largestMove.changePercent)) {
        largestMove = {
          symbol: stock.symbol,
          changePercent: changePercent
        };
      }
    });
    
    if (largestMove) {
      console.log(`\n最大涨跌幅股票:`);
      console.log(`  股票代码: ${largestMove.symbol}`);
      console.log(`  涨跌幅: ${largestMove.changePercent > 0 ? '+' : ''}${largestMove.changePercent.toFixed(2)}%`);
      console.log(`  颜色: ${largestMove.changePercent > 0 ? '绿色 (#52c41a)' : largestMove.changePercent < 0 ? '红色 (#ff4d4f)' : '灰色 (#595959)'}`);
    }
    
    // 验证
    console.log('\n验证结果:');
    if (backendData.count === 12) {
      console.log('  ✅ Dashboard默认股票数: 12支 (已修改成功)');
    } else {
      console.log(`  ❌ Dashboard默认股票数: ${backendData.count}支 (应为12支)`);
    }
    
    if (largestMove) {
      console.log(`  ✅ Largest Move计算: ${largestMove.symbol} ${largestMove.changePercent > 0 ? '+' : ''}${largestMove.changePercent.toFixed(2)}%`);
    } else {
      console.log('  ❌ Largest Move计算: 失败');
    }
    
  } catch (error) {
    console.error('测试失败:', error);
  }
};

// 运行测试
testDashboard();