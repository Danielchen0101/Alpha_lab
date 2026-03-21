cd "$PSScriptRoot"
Write-Host "=== 直接运行后端 ==="
$process = Start-Process -FilePath "py" -ArgumentList "start_quant_backend.py" -NoNewWindow -PassThru -RedirectStandardOutput "output.log" -RedirectStandardError "error.log"
Start-Sleep -Seconds 3

Write-Host "=== 测试API ==="
try {
    $response = Invoke-RestMethod -Uri "http://localhost:8889/api/market/history/AAPL?interval=D&range=3month" -TimeoutSec 10
    Write-Host "✅ API测试成功"
    Write-Host "Count: $($response.count)"
    Write-Host "Data length: $($response.data.Length)"
    Write-Host "DataSource: $($response.dataSource)"
    Write-Host "Note: $($response.note)"
    
    if ($response.data -and $response.data.Length -gt 0) {
        Write-Host "First item time: $($response.data[0].time)"
    }
} catch {
    Write-Host "❌ API测试失败: $_"
}

Write-Host "=== 查看输出日志 ==="
if (Test-Path "output.log") {
    Write-Host "输出日志:"
    Get-Content "output.log" -Tail 50
}

Write-Host "=== 查看错误日志 ==="
if (Test-Path "error.log") {
    Write-Host "错误日志:"
    Get-Content "error.log" -Tail 50
}

# 清理
Stop-Process -Id $process.Id -Force 2>$null
Remove-Item "output.log", "error.log" -ErrorAction SilentlyContinue