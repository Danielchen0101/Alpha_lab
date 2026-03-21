// 测试实际页面结果的脚本
const puppeteer = require('puppeteer');

async function testActualPage() {
  console.log('=== 开始测试实际页面结果 ===');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    
    // 设置视口大小
    await page.setViewport({ width: 1200, height: 800 });
    
    // 导航到页面
    console.log('导航到 http://localhost:3000/analysis/AAPL...');
    await page.goto('http://localhost:3000/analysis/AAPL', { waitUntil: 'networkidle0', timeout: 30000 });
    
    // 等待页面加载完成
    console.log('等待页面加载...');
    await page.waitForSelector('.ant-tabs-tab', { timeout: 10000 });
    
    // 切换到1 Week标签
    console.log('切换到1 Week标签...');
    await page.click('div[role="tab"]:has-text("1W")');
    
    // 等待图表加载
    console.log('等待图表加载...');
    await page.waitForTimeout(5000);
    
    // 1. 获取页面实际首尾点
    console.log('\n=== 1. 页面实际首尾点 ===');
    
    // 通过控制台获取数据
    const chartData = await page.evaluate(() => {
      // 尝试从React组件状态获取数据
      if (window.chartData && window.chartData.length > 0) {
        return {
          firstPoint: window.chartData[0],
          lastPoint: window.chartData[window.chartData.length - 1],
          count: window.chartData.length
        };
      }
      return null;
    });
    
    if (chartData) {
      console.log(`数据点数: ${chartData.count}`);
      console.log(`第一个点: ${chartData.firstPoint.date} - ${chartData.firstPoint.close}`);
      console.log(`最后一个点: ${chartData.lastPoint.date} - ${chartData.lastPoint.close}`);
    } else {
      console.log('无法直接从页面获取数据，尝试其他方法...');
      
      // 尝试从控制台日志获取
      const logs = await page.evaluate(() => {
        const logEntries = [];
        const originalLog = console.log;
        console.log = function(...args) {
          logEntries.push(args.join(' '));
          originalLog.apply(console, args);
        };
        return logEntries;
      });
      
      // 查找包含数据点的日志
      const dataLogs = logs.filter(log => log.includes('[1 Week]') || log.includes('finalData') || log.includes('UTC -'));
      if (dataLogs.length > 0) {
        console.log('找到相关日志:');
        dataLogs.slice(0, 10).forEach(log => console.log(`  ${log}`));
      }
    }
    
    // 2. 获取X轴标签
    console.log('\n=== 2. 页面实际X轴标签 ===');
    
    // 获取X轴文本
    const xAxisLabels = await page.evaluate(() => {
      const labels = [];
      // 查找所有X轴文本元素
      const elements = document.querySelectorAll('.recharts-xAxis .recharts-cartesian-axis-tick text');
      elements.forEach(el => {
        if (el.textContent) {
          labels.push(el.textContent.trim());
        }
      });
      return labels;
    });
    
    console.log(`X轴标签数量: ${xAxisLabels.length}`);
    console.log('X轴标签列表:');
    xAxisLabels.forEach((label, i) => {
      console.log(`  ${i+1}. ${label}`);
    });
    
    // 3. 截图保存
    console.log('\n=== 3. 截图保存 ===');
    await page.screenshot({ path: 'actual_page_screenshot.png', fullPage: false });
    console.log('截图已保存为 actual_page_screenshot.png');
    
    // 4. 检查周末处理
    console.log('\n=== 4. 周末处理检查 ===');
    
    // 分析X轴标签中的日期
    const weekendCheck = await page.evaluate(() => {
      const datePattern = /(\d{1,2})\/(\d{1,2})/;
      const dates = new Set();
      
      // 查找所有包含日期的文本
      const elements = document.querySelectorAll('text');
      elements.forEach(el => {
        const text = el.textContent;
        const match = text.match(datePattern);
        if (match) {
          const month = parseInt(match[1]);
          const day = parseInt(match[2]);
          dates.add(`${month}/${day}`);
        }
      });
      
      return Array.from(dates).sort();
    });
    
    console.log('页面显示的日期:');
    weekendCheck.forEach(date => console.log(`  ${date}`));
    
    // 检查是否包含周末日期
    const weekendDates = ['3/14', '3/15']; // 周六和周日
    const hasWeekend = weekendDates.some(date => weekendCheck.includes(date));
    console.log(`是否包含周末日期 (3/14, 3/15): ${hasWeekend ? '是' : '否'}`);
    
  } catch (error) {
    console.error('测试过程中出现错误:', error);
  } finally {
    await browser.close();
    console.log('\n=== 测试完成 ===');
  }
}

// 运行测试
testActualPage().catch(console.error);