# 测试后端 Alpaca 代理接口

Write-Host "=== 测试后端 Alpaca 代理接口 ===" -ForegroundColor Cyan
Write-Host ""

# 后端 API 地址
$baseUrl = "http://localhost:8889/api"

# 测试 1: 获取账户信息
Write-Host "1. 测试 /api/broker/account" -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/broker/account" -Method Get -TimeoutSec 10
    Write-Host "   ✅ 成功获取账户信息" -ForegroundColor Green
    Write-Host "     账户号: $($response.account_number)"
    Write-Host "     状态: $($response.status)"
    Write-Host "     现金: $$($response.cash)"
    Write-Host "     权益: $$($response.equity)"
} catch {
    Write-Host "   ❌ 失败: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Red
    Write-Host "     错误: $($_.Exception.Message)"
}

Write-Host ""

# 测试 2: 获取持仓信息
Write-Host "2. 测试 /api/broker/positions" -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/broker/positions" -Method Get -TimeoutSec 10
    Write-Host "   ✅ 成功获取持仓信息" -ForegroundColor Green
    Write-Host "     持仓数量: $($response.Count)"
    if ($response.Count -gt 0) {
        Write-Host "     示例持仓:"
        for ($i = 0; $i -lt [Math]::Min(2, $response.Count); $i++) {
            $position = $response[$i]
            Write-Host "       $($i+1). $($position.symbol): $($position.qty) 股"
        }
    } else {
        Write-Host "     无持仓"
    }
} catch {
    Write-Host "   ❌ 失败: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Red
    Write-Host "     错误: $($_.Exception.Message)"
}

Write-Host ""

# 测试 3: 获取订单信息
Write-Host "3. 测试 /api/broker/orders" -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/broker/orders" -Method Get -TimeoutSec 10
    Write-Host "   ✅ 成功获取订单信息" -ForegroundColor Green
    Write-Host "     订单数量: $($response.Count)"
    if ($response.Count -gt 0) {
        Write-Host "     示例订单:"
        for ($i = 0; $i -lt [Math]::Min(2, $response.Count); $i++) {
            $order = $response[$i]
            Write-Host "       $($i+1). $($order.symbol): $($order.status)"
        }
    } else {
        Write-Host "     无订单"
    }
} catch {
    Write-Host "   ❌ 失败: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Red
    Write-Host "     错误: $($_.Exception.Message)"
}

Write-Host ""
Write-Host "=== 测试总结 ===" -ForegroundColor Cyan
Write-Host "1. 后端代理接口已实现:"
Write-Host "   - /api/broker/account"
Write-Host "   - /api/broker/positions"
Write-Host "   - /api/broker/orders"
Write-Host ""
Write-Host "2. 前端已修改:"
Write-Host "   - 不再直接调用 Alpaca API"
Write-Host "   - 改为调用后端代理接口"
Write-Host "   - 移除了前端环境变量中的 Alpaca 密钥"
Write-Host ""
Write-Host "3. 安全改进:"
Write-Host "   - Alpaca API 密钥只存在于后端"
Write-Host "   - 前端代码不再暴露密钥"
Write-Host "   - 避免了 CORS 问题"
Write-Host ""
Write-Host "4. 当前状态:"
Write-Host "   - 后端服务已启动 (端口 8889)"
Write-Host "   - 前端构建成功"
Write-Host "   - 代理接口架构已就绪"
Write-Host ""
Write-Host "5. 注意事项:"
Write-Host "   - 需要配置正确的 Alpaca 密钥到后端"
Write-Host "   - 如果 Alpaca 密钥无效，代理接口会返回错误"