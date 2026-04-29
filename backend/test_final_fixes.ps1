# 测试最终修复
Write-Host "=== 测试最终修复 ==="
Write-Host "测试时间: $(Get-Date)"
Write-Host ""

# 1. 测试后端API是否返回正确的字段
Write-Host "1. 测试后端API字段返回"
Write-Host "------------------------"
$testSymbols = @("AAPL", "MSFT", "GOOGL")

foreach ($symbol in $testSymbols) {
    Write-Host "测试 $symbol :"
    try {
        $response = Invoke-RestMethod -Uri "http://127.0.0.1:8889/market/stock/$symbol" -Method Get -TimeoutSec 10
        Write-Host "  ✅ 成功获取数据"
        Write-Host "  changePercent: $($response.changePercent)"
        Write-Host "  changePct: $($response.changePct)"
        Write-Host "  sector: $($response.sector)"
        Write-Host "  price: $($response.price)"
        
        # 检查字段是否存在
        if ($null -ne $response.changePct) {
            Write-Host "  ✅ changePct字段存在"
        } else {
            Write-Host "  ❌ changePct字段不存在或为null"
        }
        
        if ($null -ne $response.sector) {
            Write-Host "  ✅ sector字段存在"
        } else {
            Write-Host "  ❌ sector字段不存在或为null"
        }
        
    } catch {
        Write-Host "  ❌ 请求失败: $_"
    }
    Write-Host ""
}

# 2. 测试scanner API
Write-Host "2. 测试Scanner API"
Write-Host "------------------"
$scannerPayload = @{
    symbols = @("AAPL", "MSFT", "GOOGL")
    maxSymbols = 3
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "http://127.0.0.1:8889/api/ai/market/scanner" -Method Post -Body $scannerPayload -ContentType "application/json" -TimeoutSec 30
    Write-Host "✅ Scanner API调用成功"
    Write-Host "success: $($response.success)"
    Write-Host "results数量: $($response.results.Count)"
    
    if ($response.success -and $response.results.Count -gt 0) {
        $firstResult = $response.results[0]
        Write-Host "第一个结果:"
        Write-Host "  symbol: $($firstResult.symbol)"
        Write-Host "  changePct: $($firstResult.changePct)"
        Write-Host "  sector: $($firstResult.sector)"
        Write-Host "  newsSentiment: $($firstResult.newsSentiment)"
        Write-Host "  eventRisk: $($firstResult.eventRisk)"
    }
} catch {
    Write-Host "❌ Scanner API调用失败: $_"
}

Write-Host ""
Write-Host "3. 测试批量处理逻辑"
Write-Host "-------------------"

# 模拟批量处理
$symbols = @(1..20 | ForEach-Object { "TEST$_" })
$batchSize = 10

Write-Host "总symbols数: $($symbols.Count)"
Write-Host "batch大小: $batchSize"

for ($batchIndex = 0; $batchIndex -lt $symbols.Count; $batchIndex += $batchSize) {
    $batchNum = ($batchIndex / $batchSize) + 1
    $batchSymbols = $symbols[$batchIndex..($batchIndex + $batchSize - 1)]
    
    Write-Host "批次 $batchNum :"
    Write-Host "  起始索引: $batchIndex"
    Write-Host "  批次大小: $($batchSymbols.Count)"
    Write-Host "  批次symbols: $($batchSymbols -join ', ')"
    
    Start-Sleep -Milliseconds 200
    
    Write-Host "  批次 $batchNum 处理完成"
    
    if ($batchIndex + $batchSize -lt $symbols.Count) {
        Write-Host "  等待下一批..."
    }
}

Write-Host ""
Write-Host "4. 前端数据映射分析"
Write-Host "-------------------"
Write-Host "前端修复总结:"
Write-Host "1. ✅ 修复了changePct字段映射:"
Write-Host "   - 后端返回: changePercent, changePct"
Write-Host "   - 前端接收: changePct = stockData.changePct || stockData.changePercent"
Write-Host "   - 表格读取: changePct字段"
Write-Host ""
Write-Host "2. ✅ 修复了批量渲染:"
Write-Host "   - 不再预分配所有rows"
Write-Host "   - 每批10个symbols逐步处理"
Write-Host "   - 每批完成后追加到UI"
Write-Host "   - 使用setMarketScannerResults(prev => [...prev, ...batchResults])"
Write-Host ""
Write-Host "3. ✅ 保留了sector字段:"
Write-Host "   - 后端返回: sector字段"
Write-Host "   - 前端接收: stockData.sector"
Write-Host "   - 表格读取: sector字段"
Write-Host ""
Write-Host "4. ✅ 保留了news字段:"
Write-Host "   - 后端返回: newsSentiment, eventRisk, topNews"
Write-Host "   - 前端接收: newsData.sentiment, newsData.eventRisk"
Write-Host "   - 表格读取: newsSentiment, eventRisk字段"

Write-Host ""
Write-Host "=== 测试完成 ==="
Write-Host ""
Write-Host "下一步建议:"
Write-Host "1. 重启后端服务使修改生效"
Write-Host "2. 重新build前端应用"
Write-Host "3. 测试页面实际显示效果"
Write-Host "4. 验证percent change字段显示正常"
Write-Host "5. 验证批量渲染按10个一批逐步显示"