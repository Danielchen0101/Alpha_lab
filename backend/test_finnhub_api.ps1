# 测试Finnhub API接口
Write-Host "=== 测试Finnhub历史数据接口 ===" -ForegroundColor Cyan

# 检查后端是否在运行
$port = 8889
$connection = Test-NetConnection -ComputerName localhost -Port $port -InformationLevel Quiet

if (-not $connection) {
    Write-Host "后端服务未运行，尝试启动..." -ForegroundColor Yellow
    
    # 检查是否有Python
    $pythonPath = Get-Command python -ErrorAction SilentlyContinue
    if (-not $pythonPath) {
        Write-Host "错误: 未找到Python，无法启动后端服务" -ForegroundColor Red
        exit 1
    }
    
    # 启动后端服务
    Write-Host "启动后端服务..." -ForegroundColor Green
    $backendProcess = Start-Process -FilePath "python" -ArgumentList "start_quant_backend.py" -WorkingDirectory $PWD -PassThru -WindowStyle Hidden
    
    # 等待服务启动
    Write-Host "等待服务启动..." -ForegroundColor Yellow
    Start-Sleep -Seconds 5
    
    # 再次检查
    $connection = Test-NetConnection -ComputerName localhost -Port $port -InformationLevel Quiet
    if (-not $connection) {
        Write-Host "错误: 后端服务启动失败" -ForegroundColor Red
        exit 1
    }
}

Write-Host "后端服务正在运行，开始测试..." -ForegroundColor Green

# 测试函数
function Test-Timeframe {
    param(
        [string]$timeframe,
        [string]$interval,
        [string]$range
    )
    
    Write-Host "`n=== 测试 $timeframe ===" -ForegroundColor Magenta
    Write-Host "请求参数: interval=$interval, range=$range"
    
    $url = "http://localhost:8889/api/market/history/AAPL?interval=$interval&range=$range"
    Write-Host "请求URL: $url"
    
    try {
        $response = Invoke-RestMethod -Uri $url -Method Get -ErrorAction Stop
        
        Write-Host "响应结果:" -ForegroundColor Green
        Write-Host "  - dataSource: $($response.dataSource)"
        Write-Host "  - count: $($response.count)"
        Write-Host "  - interval: $($response.interval)"
        Write-Host "  - range: $($response.range)"
        
        if ($response.count -gt 0) {
            $first = $response.data[0]
            $last = $response.data[-1]
            
            Write-Host "  - 第一条数据:" -ForegroundColor Cyan
            Write-Host "    - time: $($first.time)"
            Write-Host "    - open: $($first.open)"
            Write-Host "    - close: $($first.close)"
            Write-Host "    - volume: $($first.volume)"
            
            Write-Host "  - 最后一条数据:" -ForegroundColor Cyan
            Write-Host "    - time: $($last.time)"
            Write-Host "    - open: $($last.open)"
            Write-Host "    - close: $($last.close)"
            Write-Host "    - volume: $($last.volume)"
            
            # 计算时间跨度
            try {
                $firstTime = [datetime]::Parse($first.time)
                $lastTime = [datetime]::Parse($last.time)
                $timeSpan = $lastTime - $firstTime
                Write-Host "  - 时间跨度: $($timeSpan.Days)天 $($timeSpan.Hours)小时 $($timeSpan.Minutes)分钟" -ForegroundColor Yellow
            } catch {
                Write-Host "  - 时间跨度: 无法计算" -ForegroundColor Yellow
            }
        } else {
            Write-Host "  - 警告: 无数据返回" -ForegroundColor Red
        }
        
        if ($response.error) {
            Write-Host "  - 错误: $($response.error)" -ForegroundColor Red
        }
        
    } catch {
        Write-Host "  - API调用失败: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# 测试所有timeframe
Test-Timeframe -timeframe "1 Day" -interval "5min" -range "1day"
Test-Timeframe -timeframe "1 Week" -interval "1day" -range "1week"
Test-Timeframe -timeframe "1 Month" -interval "1day" -range "1month"
Test-Timeframe -timeframe "3 Months" -interval "1day" -range "3month"
Test-Timeframe -timeframe "1 Year" -interval "1day" -range "1year"

Write-Host "`n=== 测试完成 ===" -ForegroundColor Cyan