import re

# 读取文件
with open('src/pages/Market.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 要替换的旧函数
old_function = r'const searchStockBySymbol = async \(symbol: string\) => \{[\s\S]*?\n  \};'

# 新的函数实现
new_function = '''  const searchStockBySymbol = async (symbol: string) => {
    // 检查是否已经是有效的股票 symbol（全大写字母，长度 1-5）
    const isValidSymbol = /^[A-Z]{1,5}$/.test(symbol);
    if (!isValidSymbol) {
      message.warning(\`无效的股票代码: \${symbol}，请输入1-5个大写字母\`);
      return false;
    }
    
    // 检查是否已经在 stocks 列表中
    const existingStock = stocks.find(s => s.symbol.toUpperCase() === symbol.toUpperCase());
    if (existingStock) {
      message.info(\`\${symbol} 已在股票列表中\`);
      return true;
    }
    
    try {
      setSearching(true);
      console.log(\`正在搜索股票: \${symbol}\`);
      
      // 使用 Polygon API 搜索股票
      const searchResponse = await polygonApi.searchStocks(symbol, 10);
      
      if (searchResponse.data && searchResponse.data.tickers) {
        const tickers = searchResponse.data.tickers;
        
        // 查找精确匹配的股票
        const exactMatch = tickers.find((ticker: any) => 
          ticker.symbol.toUpperCase() === symbol.toUpperCase()
        );
        
        if (exactMatch) {
          // 获取该股票的详细信息
          const stockResponse = await polygonApi.getStockData(symbol);
          
          if (stockResponse.data && !stockResponse.data.error) {
            const stockData = stockResponse.data as Stock;
            
            // 添加到 stocks 列表
            setStocks(prev => [...prev, stockData]);
            message.success(\`已添加 \${symbol} (\${stockData.name || '未命名'}) 到市场数据\`);
            return true;
          } else {
            message.warning(\`找到股票 \${symbol} 但无法获取详细信息\`);
            return false;
          }
        } else {
          // 显示搜索结果供用户选择
          if (tickers.length > 0) {
            const suggestions = tickers.map((t: any) => \`\${t.symbol} - \${t.name}\`).join(', ');
            message.info(\`未找到精确匹配，相关结果: \${suggestions}\`);
          } else {
            message.warning(\`未找到股票: \${symbol}\`);
          }
          return false;
        }
      } else {
        message.warning(\`未找到股票: \${symbol}\`);
        return false;
      }
    } catch (error: any) {
      console.error(\`搜索股票 \${symbol} 失败:\`, error);
      const errorMessage = error.response?.data?.error || error.message || '未知错误';
      message.error(\`搜索失败: \${errorMessage}\`);
      return false;
    } finally {
      setSearching(false);
    }
  };'''

# 替换函数
new_content = re.sub(old_function, new_function, content, flags=re.DOTALL)

# 写回文件
with open('src/pages/Market.tsx', 'w', encoding='utf-8') as f:
    f.write(new_content)

print("✅ 已更新 searchStockBySymbol 函数")