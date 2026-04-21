# Version 4.0 With AI Trading - PowerShell 恢复脚本
# 用法: .\restore.ps1 [-Type full|backend|frontend]

param(
    [string]$Type = "full"
)

Write-Host "=== Version 4.0 With AI Trading 恢复脚本 ===" -ForegroundColor Cyan
Write-Host "版本: 4.0 (包含 AI Trading 功能)" -ForegroundColor Yellow
Write-Host "创建时间: 2026-04-05" -ForegroundColor Yellow
Write-Host ""

$VersionDir = "version_4.0_with_ai_trading"
$ProjectRoot = "..\..\"

if ($Type -eq "full" -or $Type -eq "") {
    Write-Host "执行完整项目恢复..." -ForegroundColor Green
    
    # 备份当前文件
    Write-Host "1. 备份当前文件..." -ForegroundColor Yellow
    $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
    $backupDir = "$ProjectRoot\backups\before_restore_$timestamp"
    New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
    
    if (Test-Path "$ProjectRoot\backend\start_quant_backend.py") {
        Copy-Item "$ProjectRoot\backend\start_quant_backend.py" -Destination $backupDir
    }
    
    # 恢复后端
    Write-Host "2. 恢复后端文件..." -ForegroundColor Yellow
    Copy-Item "backend\start_quant_backend.py" -Destination "$ProjectRoot\backend\" -Force
    
    # 恢复前端
    Write-Host "3. 恢复前端文件..." -ForegroundColor Yellow
    Copy-Item "frontend\package.json" -Destination "$ProjectRoot\frontend\" -Force
    Copy-Item "frontend\tsconfig.json" -Destination "$ProjectRoot\frontend\" -Force
    Copy-Item "frontend\src\App.tsx" -Destination "$ProjectRoot\frontend\src\" -Force
    Copy-Item "frontend\src\components\NavigationMenu.tsx" -Destination "$ProjectRoot\frontend\src\components\" -Force
    Copy-Item "frontend\src\pages\AITrading.tsx" -Destination "$ProjectRoot\frontend\src\pages\" -Force
    Copy-Item "frontend\src\services\aiTradingService.ts" -Destination "$ProjectRoot\frontend\src\services\" -Force
    Copy-Item "frontend\src\services\api.ts" -Destination "$ProjectRoot\frontend\src\services\" -Force
    
    Write-Host "`n✅ 完整项目恢复完成!" -ForegroundColor Green
    Write-Host "备份保存在: $backupDir" -ForegroundColor Yellow
    
} elseif ($Type -eq "backend") {
    Write-Host "仅恢复后端..." -ForegroundColor Green
    
    # 备份当前后端
    $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
    if (Test-Path "$ProjectRoot\backend\start_quant_backend.py") {
        Copy-Item "$ProjectRoot\backend\start_quant_backend.py" -Destination "$ProjectRoot\backend\start_quant_backend_backup_$timestamp.py"
    }
    
    # 恢复后端
    Copy-Item "backend\start_quant_backend.py" -Destination "$ProjectRoot\backend\" -Force
    
    Write-Host "`n✅ 后端恢复完成!" -ForegroundColor Green
    Write-Host "原文件备份为: $ProjectRoot\backend\start_quant_backend_backup_$timestamp.py" -ForegroundColor Yellow
    
} elseif ($Type -eq "frontend") {
    Write-Host "仅恢复前端..." -ForegroundColor Green
    
    # 恢复前端文件
    Copy-Item "frontend\package.json" -Destination "$ProjectRoot\frontend\" -Force
    Copy-Item "frontend\tsconfig.json" -Destination "$ProjectRoot\frontend\" -Force
    Copy-Item "frontend\src\App.tsx" -Destination "$ProjectRoot\frontend\src\" -Force
    Copy-Item "frontend\src\components\NavigationMenu.tsx" -Destination "$ProjectRoot\frontend\src\components\" -Force
    Copy-Item "frontend\src\pages\AITrading.tsx" -Destination "$ProjectRoot\frontend\src\pages\" -Force
    Copy-Item "frontend\src\services\aiTradingService.ts" -Destination "$ProjectRoot\frontend\src\services\" -Force
    Copy-Item "frontend\src\services\api.ts" -Destination "$ProjectRoot\frontend\src\services\" -Force
    
    Write-Host "`n✅ 前端恢复完成!" -ForegroundColor Green
    
} else {
    Write-Host "用法: .\restore.ps1 [-Type full|backend|frontend]" -ForegroundColor Red
    Write-Host "  full     - 恢复完整项目 (默认)" -ForegroundColor Yellow
    Write-Host "  backend  - 仅恢复后端" -ForegroundColor Yellow
    Write-Host "  frontend - 仅恢复前端" -ForegroundColor Yellow
    exit 1
}

Write-Host "`n=== 启动命令 ===" -ForegroundColor Cyan
Write-Host "后端: cd $ProjectRoot\backend && py -u start_quant_backend.py" -ForegroundColor Yellow
Write-Host "前端: cd $ProjectRoot\frontend && npm start" -ForegroundColor Yellow

Write-Host "`n=== 验证步骤 ===" -ForegroundColor Cyan
Write-Host "1. 启动后端，确认输出包含 '优化版后端启动'" -ForegroundColor Yellow
Write-Host "2. 测试接口: curl http://127.0.0.1:8889/api/status" -ForegroundColor Yellow
Write-Host "3. 测试AI接口: curl -X POST http://127.0.0.1:8889/api/ai/provider/config -H 'Content-Type: application/json' -d '{\"apiKey\":\"test\"}'" -ForegroundColor Yellow
Write-Host "4. 启动前端，访问 http://localhost:3000/ai-trading" -ForegroundColor Yellow

Write-Host "`n=== 恢复完成 ===" -ForegroundColor Green