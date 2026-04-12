# 验证备份完整性脚本

Write-Host "=== Version 6.0 AI Agent 版备份验证 ===" -ForegroundColor Cyan
Write-Host "验证时间: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Yellow
Write-Host ""

$backupRoot = "."

# 检查关键文件和目录
$requiredItems = @(
    @{Path = "backend"; Type = "Directory"; Critical = $true},
    @{Path = "frontend"; Type = "Directory"; Critical = $true},
    @{Path = "backend\start_quant_backend.py"; Type = "File"; Critical = $true},
    @{Path = "restore.ps1"; Type = "File"; Critical = $true},
    @{Path = "README.md"; Type = "File"; Critical = $false},
    @{Path = ".env"; Type = "File"; Critical = $false},
    @{Path = "package.json"; Type = "File"; Critical = $false}
)

Write-Host "检查备份完整性..." -ForegroundColor Green
$allPassed = $true

foreach ($item in $requiredItems) {
    $fullPath = Join-Path $backupRoot $item.Path
    
    if ($item.Type -eq "Directory") {
        if (Test-Path $fullPath -PathType Container) {
            Write-Host "  ✅ 目录存在: $($item.Path)" -ForegroundColor Green
        } else {
            Write-Host "  ❌ 目录缺失: $($item.Path)" -ForegroundColor Red
            if ($item.Critical) { $allPassed = $false }
        }
    } elseif ($item.Type -eq "File") {
        if (Test-Path $fullPath -PathType Leaf) {
            $fileSize = (Get-Item $fullPath).Length
            Write-Host "  ✅ 文件存在: $($item.Path) ($($fileSize) bytes)" -ForegroundColor Green
        } else {
            Write-Host "  ❌ 文件缺失: $($item.Path)" -ForegroundColor Red
            if ($item.Critical) { $allPassed = $false }
        }
    }
}

# 检查修复的关键函数是否存在
Write-Host "`n检查关键修复内容..." -ForegroundColor Green

$backendFile = Join-Path $backupRoot "backend\start_quant_backend.py"
if (Test-Path $backendFile) {
    $content = Get-Content $backendFile -Raw
    
    $checks = @(
        @{Name = "fetch_alpaca_bars 函数"; Pattern = "def fetch_alpaca_bars"},
        @{Name = "1D 交易日判断逻辑"; Pattern = "if range_param == '1D'"},
        @{Name = "交易日判断代码"; Pattern = "weekday = now_eastern.weekday"},
        @{Name = "非交易日回退逻辑"; Pattern = "if not is_trading_day"},
        @{Name = "回退到交易日"; Pattern = "回退到交易日"},
        @{Name = "过滤逻辑更新"; Pattern = "过滤掉非交易日数据点"}
    )
    
    foreach ($check in $checks) {
        if ($content -match $check.Pattern) {
            Write-Host "  ✅ $($check.Name)" -ForegroundColor Green
        } else {
            Write-Host "  ⚠️  $($check.Name) - 可能未包含修复" -ForegroundColor Yellow
        }
    }
    
    # 检查文件大小
    $fileSize = (Get-Item $backendFile).Length
    Write-Host "`n后端文件信息:" -ForegroundColor Cyan
    Write-Host "  文件大小: $($fileSize) bytes" -ForegroundColor Gray
    Write-Host "  行数估计: $($content.Split("`n").Count) 行" -ForegroundColor Gray
}

# 检查前端修复
$marketDataService = Join-Path $backupRoot "frontend\src\services\marketDataService.ts"
if (Test-Path $marketDataService) {
    $content = Get-Content $marketDataService -Raw
    if ($content -match "data\.dataSource") {
        Write-Host "  ✅ 前端错误消息修复 (Alpaca 数据源)" -ForegroundColor Green
    } else {
        Write-Host "  ⚠️  前端错误消息可能未修复" -ForegroundColor Yellow
    }
}

# 总结
Write-Host "`n=== 验证结果 ===" -ForegroundColor Cyan
if ($allPassed) {
    Write-Host "✅ 备份完整性验证通过!" -ForegroundColor Green
    Write-Host "备份包含所有关键文件，可以用于恢复。" -ForegroundColor Gray
} else {
    Write-Host "⚠️  备份完整性验证失败!" -ForegroundColor Red
    Write-Host "部分关键文件缺失，恢复可能不完整。" -ForegroundColor Gray
}

Write-Host "`n=== 恢复说明 ===" -ForegroundColor Cyan
Write-Host "要使用此备份恢复项目，请运行:" -ForegroundColor Yellow
Write-Host "  .\restore.ps1 -Type full" -ForegroundColor White
Write-Host "`n查看详细说明:" -ForegroundColor Yellow
Write-Host "  Get-Content README.md" -ForegroundColor White

Write-Host "`n=== 备份验证完成 ===" -ForegroundColor Green