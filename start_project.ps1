# 启动量化交易平台 - 专业版
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "启动量化交易平台 - 专业版" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# 设置工作目录
Set-Location $PSScriptRoot

# 检查Python是否安装
try {
    $pythonVersion = python --version 2>&1
    Write-Host "[Python] $pythonVersion" -ForegroundColor Green
} catch {
    Write-Host "[错误] Python未安装或未添加到PATH" -ForegroundColor Red
    Write-Host "请安装Python并确保在PATH中"
    pause
    exit 1
}

# 检查Node.js是否安装
try {
    $nodeVersion = node --version
    Write-Host "[Node.js] $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "[错误] Node.js未安装或未添加到PATH" -ForegroundColor Red
    Write-Host "请安装Node.js并确保在PATH中"
    pause
    exit 1
}

# 检查npm是否安装
try {
    $npmVersion = npm --version
    Write-Host "[npm] $npmVersion" -ForegroundColor Green
} catch {
    Write-Host "[错误] npm未安装或未添加到PATH" -ForegroundColor Red
    Write-Host "请安装npm并确保在PATH中"
    pause
    exit 1
}

Write-Host ""
Write-Host "[1/3] 检查依赖..." -ForegroundColor Yellow
Write-Host ""

# 检查前端依赖
if (-not (Test-Path "frontend\node_modules")) {
    Write-Host "[前端] 安装依赖..." -ForegroundColor Yellow
    Set-Location "frontend"
    npm install
    Set-Location ".."
} else {
    Write-Host "[前端] 依赖已安装" -ForegroundColor Green
}

# 检查Python依赖
Write-Host "[后端] 检查Python依赖..." -ForegroundColor Yellow

try {
    python -c "import flask" 2>$null
    Write-Host "[后端] Flask已安装" -ForegroundColor Green
} catch {
    Write-Host "[后端] 安装Flask..." -ForegroundColor Yellow
    pip install flask
}

try {
    python -c "import requests" 2>$null
    Write-Host "[后端] requests已安装" -ForegroundColor Green
} catch {
    Write-Host "[后端] 安装requests..." -ForegroundColor Yellow
    pip install requests
}

Write-Host ""
Write-Host "[2/3] 启动后端服务..." -ForegroundColor Yellow
Write-Host ""

# 启动后端服务
$backendJob = Start-Job -Name "Backend" -ScriptBlock {
    Set-Location $using:PSScriptRoot
    Set-Location "backend"
    python start_quant_backend.py
}

Start-Sleep -Seconds 3
Write-Host "[后端] 服务启动中... (端口: 8889)" -ForegroundColor Green
Write-Host ""

Write-Host "[3/3] 启动前端服务..." -ForegroundColor Yellow
Write-Host ""

# 启动前端服务
$frontendJob = Start-Job -Name "Frontend" -ScriptBlock {
    Set-Location $using:PSScriptRoot
    Set-Location "frontend"
    npm start
}

Start-Sleep -Seconds 5

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "启动完成！" -ForegroundColor Green
Write-Host ""
Write-Host "访问地址:" -ForegroundColor Yellow
Write-Host "前端: http://localhost:3000" -ForegroundColor White
Write-Host "后端: http://localhost:8889" -ForegroundColor White
Write-Host ""
Write-Host "后端API示例:" -ForegroundColor Yellow
Write-Host "  - 市场数据: http://localhost:8889/market/stock/AAPL" -ForegroundColor Gray
Write-Host "  - 回测历史: http://localhost:8889/api/backtest/history" -ForegroundColor Gray
Write-Host "  - 运行回测: http://localhost:8889/backtest/run" -ForegroundColor Gray
Write-Host ""
Write-Host "按任意键打开浏览器访问前端..." -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
pause

# 打开浏览器
Start-Process "http://localhost:3000"

Write-Host ""
Write-Host "服务状态:" -ForegroundColor Yellow
Write-Host "后端: $(if ($backendJob.State -eq 'Running') { '运行中' } else { '已停止' })" -ForegroundColor $(if ($backendJob.State -eq 'Running') { 'Green' } else { 'Red' })
Write-Host "前端: $(if ($frontendJob.State -eq 'Running') { '运行中' } else { '已停止' })" -ForegroundColor $(if ($frontendJob.State -eq 'Running') { 'Green' } else { 'Red' })
Write-Host ""
Write-Host "要停止服务，请按 Ctrl+C 或关闭此窗口。" -ForegroundColor Yellow
Write-Host ""

# 保持脚本运行，显示日志
try {
    while ($true) {
        # 显示后端日志
        $backendOutput = Receive-Job -Job $backendJob -Keep
        if ($backendOutput) {
            Write-Host "[后端] $backendOutput" -ForegroundColor Magenta
        }
        
        # 显示前端日志
        $frontendOutput = Receive-Job -Job $frontendJob -Keep
        if ($frontendOutput) {
            Write-Host "[前端] $frontendOutput" -ForegroundColor Blue
        }
        
        Start-Sleep -Seconds 1
    }
} finally {
    # 清理作业
    Stop-Job -Job $backendJob, $frontendJob
    Remove-Job -Job $backendJob, $frontendJob
}