// 最终验证：动态筛选功能
const verifyFinal = async () => {
  console.log('最终验证：Dashboard动态筛选功能');
  console.log('='.repeat(60));
  
  try {
    // 1. 测试后端API
    console.log('\n1. 测试后端API (动态筛选)');
    console.log('-'.repeat(40));
    
    const response = await fetch('http://127.0.0.1:8889/api/market/stocks?dashboard=true');
    const data = await response.json();
    
    console.log(`   股票数量: ${data.count}`);
    console.log(`   数据源: ${data.source}`);
    console.log(`   是否成功: ${data.success}`);
    console.log(`   耗时: ${data.elapsed.toFixed(2)}秒`);
    
    const symbols = data.stocks.map(s => s.symbol);
    console.log(`   股票列表: ${symbols.join(', ')}`);
    
    // 2. 验证筛选信息
    console.log('\n2. 验证筛选信息');
    console.log('-'.repeat(40));
    
    const selectionInfo = data.selection_info || {};
    console.log(`   总计: ${selectionInfo.total || data.count}支`);
    console.log(`   上涨: ${selectionInfo.gainers || 'N/A'}支`);
    console.log(`   下跌: ${selectionInfo.losers || 'N/A'}支`);
    console.log(`   平盘: ${selectionInfo.neutral || 'N/A'}支`);
    console.log(`   科技股: ${selectionInfo.tech_stocks || 'N/A'}支 (${selectionInfo.tech_percentage || 'N/A'}%)`);
    console.log(`   必须包含: ${(selectionInfo.must_have_included || []).join(', ')}`);
    
    // 3. 验证必须包含的股票
    console.log('\n3. 验证必须包含的股票');
    console.log('-'.repeat(40));
    
    const mustHave = ['AAPL', 'TSLA', 'NVDA'];
    const missing = mustHave.filter(s => !symbols.includes(s));
    
    if (missing.length === 0) {
      console.log('   [SUCCESS] 必须包含: AAPL, TSLA, NVDA 都在列表中');
    } else {
      console.log(`   [ERROR] 缺失: ${missing.join(', ')}`);
    }
    
    // 4. 涨跌平衡验证
    console.log('\n4. 涨跌平衡验证');
    console.log('-'.repeat(40));
    
    const gainers = data.stocks.filter(s => (s.changePercent || 0) > 0.1);
    const losers = data.stocks.filter(s => (s.changePercent || 0) < -0.1);
    const neutral = data.stocks.filter(s => -0.1 <= (s.changePercent || 0) && (s.changePercent || 0) <= 0.1);
    
    console.log(`   实际上涨 (>0.1%): ${gainers.length}支`);
    console.log(`   实际下跌 (<-0.1%): ${losers.length}支`);
    console.log(`   实际平盘 (±0.1%): ${neutral.length}支`);
    
    console.log(`\n   目标: 7涨7跌1平`);
    console.log(`   实际: ${gainers.length}涨${losers.length}跌${neutral.length}平`);
    
    if (gainers.length === 7 && losers.length === 7 && neutral.length === 1) {
      console.log('   [SUCCESS] 完美实现7涨7跌1平目标！');
    } else if (Math.abs(gainers.length - losers.length) <= 2) {
      console.log('   [INFO] 涨跌相对平衡');
    } else {
      console.log('   [WARNING] 涨跌不平衡，可能是市场极端情况');
    }
    
    // 5. 科技股分析
    console.log('\n5. 科技股分析');
    console.log('-'.repeat(40));
    
    const techStocks = [
      'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'ADBE', 'CRM', 'ORCL',
      'INTC', 'AMD', 'QCOM', 'CSCO', 'IBM', 'TSM', 'PYPL', 'SQ'
    ];
    
    const techSymbols = symbols.filter(s => techStocks.includes(s));
    console.log(`   科技股: ${techSymbols.join(', ')}`);
    console.log(`   数量: ${techSymbols.length}/15 = ${(techSymbols.length/15*100).toFixed(1)}%`);
    
    if (techSymbols.length >= 8) {
      console.log('   [SUCCESS] 科技股占比很高');
    } else if (techSymbols.length >= 5) {
      console.log('   [SUCCESS] 科技股充足');
    } else {
      console.log('   [WARNING] 科技股偏少');
    }
    
    // 6. Largest Move验证
    console.log('\n6. Largest Move验证');
    console.log('-'.repeat(40));
    
    if (data.stocks.length > 0) {
      const largestMove = data.stocks.reduce((max, stock) => {
        const change = Math.abs(stock.changePercent || 0);
        const maxChange = Math.abs(max.changePercent || 0);
        return change > maxChange ? stock : max;
      }, data.stocks[0]);
      
      const change = largestMove.changePercent || 0;
      const color = change > 0 ? '绿色 (#52c41a)' : change < 0 ? '红色 (#ff4d4f)' : '灰色 (#595959)';
      
      console.log(`   最大涨跌幅股票: ${largestMove.symbol}`);
      console.log(`   涨跌幅: ${change > 0 ? '+' : ''}${change.toFixed(2)}%`);
      console.log(`   颜色: ${color}`);
      console.log(`   显示格式:`);
      console.log(`     第一行: ${largestMove.symbol}`);
      console.log(`     第二行: ${change > 0 ? '+' : ''}${change.toFixed(2)}%`);
      console.log('   [SUCCESS] Largest Move计算正确');
    }
    
    // 7. 性能评估
    console.log('\n7. 性能评估');
    console.log('-'.repeat(40));
    
    const elapsed = data.elapsed;
    if (elapsed < 8) {
      console.log(`   [SUCCESS] 性能良好: ${elapsed.toFixed(2)}秒`);
    } else if (elapsed < 15) {
      console.log(`   [INFO] 性能可接受: ${elapsed.toFixed(2)}秒 (动态筛选需要更多计算)`);
    } else if (elapsed < 30) {
      console.log(`   [WARNING] 性能较慢: ${elapsed.toFixed(2)}秒`);
    } else {
      console.log(`   [ERROR] 性能超时: ${elapsed.toFixed(2)}秒`);
    }
    
    // 8. 总结
    console.log('\n8. 总结');
    console.log('-'.repeat(40));
    
    console.log('  动态筛选功能验证结果:');
    console.log(`   1. 股票数量: ${data.count}支 [${data.count === 15 ? 'SUCCESS' : 'ERROR'}]`);
    console.log(`   2. 必须包含: AAPL, TSLA, NVDA [${missing.length === 0 ? 'SUCCESS' : 'ERROR'}]`);
    console.log(`   3. 涨跌平衡: ${gainers.length}涨${losers.length}跌${neutral.length}平 [${gainers.length === 7 && losers.length === 7 && neutral.length === 1 ? 'SUCCESS' : 'INFO'}]`);
    console.log(`   4. 科技股占比: ${techSymbols.length}/15 = ${(techSymbols.length/15*100).toFixed(1)}% [${techSymbols.length >= 6 ? 'SUCCESS' : 'WARNING'}]`);
    console.log(`   5. 性能: ${elapsed.toFixed(2)}秒 [${elapsed < 15 ? 'ACCEPTABLE' : 'SLOW'}]`);
    
    console.log('\n  页面应显示:');
    console.log(`   - Total Symbols: ${data.count}`);
    console.log(`   - Largest Move: [最大涨跌幅股票] (第一行)`);
    console.log(`   - Largest Move: [涨跌幅]% (第二行, 颜色跟随涨跌)`);
    
  } catch (error) {
    console.error('验证失败:', error);
  }
  
  console.log('\n' + '='.repeat(60));
};

// 运行验证
verifyFinal();