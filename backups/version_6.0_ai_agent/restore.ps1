# Version 6.0 AI Agent 版 - PowerShell 恢复脚本
# 用法: .\restore.ps1 [-Type full|backend|frontend|files]

param(
    [string]$Type = "full"
)

Write-Host "=== Version 6.0 AI Agent 版 恢复脚本 ===" -ForegroundColor Cyan
Write-Host "版本: 6.0 (包含修复的 Alpaca 1D 图表，非交易日自动回退到上一个交易日)" -ForegroundColor Yellow
Write-Host "创建时间: 2026-04-11" -ForegroundColor Yellow
Write-Host "修复内容:"
Write-Host "  1. 修复 Market -> Analyze 页面 1D 图表在非交易日显示空数据问题" -ForegroundColor Green
Write-Host "  2. 添加交易日判断逻辑（周一至周五为交易日）" -ForegroundColor Green
Write-Host "  3. 非交易日自动回退到上一个交易日显示图表" -ForegroundColor Green
Write-Host "  4. 继续使用 Alpaca 真实 bars 数据，不使用 mock 数据" -ForegroundColor Green
Write-Host ""

$VersionDir = "version_6.0_ai_agent"
$ProjectRoot = "..\..\"

if ($Type -eq "full" -or $Type -eq "") {
    Write-Host "执行完整项目恢复（覆盖所有文件）..." -ForegroundColor Green
    
    # 备份当前整个项目
    Write-Host "1. 备份当前项目..." -ForegroundColor Yellow
    $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
    $backupDir = "$ProjectRoot\backups\before_restore_$timestamp"
    New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
    
    # 备份关键文件
    Write-Host "  备份 backend 目录..." -ForegroundColor Gray
    if (Test-Path "$ProjectRoot\backend") {
        Copy-Item "$ProjectRoot\backend" -Destination "$backupDir\" -Recurse -Force
    }
    
    Write-Host "  备份 frontend 目录..." -ForegroundColor Gray
    if (Test-Path "$ProjectRoot\frontend") {
        Copy-Item "$ProjectRoot\frontend" -Destination "$backupDir\" -Recurse -Force
    }
    
    Write-Host "  备份配置文件..." -ForegroundColor Gray
    $configFiles = @(".env", ".env.example", "package.json", "package-lock.json", ".gitignore", "README.md")
    foreach ($file in $configFiles) {
        if (Test-Path "$ProjectRoot\$file") {
            Copy-Item "$ProjectRoot\$file" -Destination "$backupDir\" -Force
        }
    }
    
    # 恢复整个项目
    Write-Host "2. 恢复后端文件..." -ForegroundColor Yellow
    if (Test-Path "backend") {
        Remove-Item "$ProjectRoot\backend" -Recurse -Force -ErrorAction SilentlyContinue
        Copy-Item "backend" -Destination "$ProjectRoot\" -Recurse -Force
    }
    
    Write-Host "3. 恢复前端文件..." -ForegroundColor Yellow
    if (Test-Path "frontend") {
        Remove-Item "$ProjectRoot\frontend" -Recurse -Force -ErrorAction SilentlyContinue
        Copy-Item "frontend" -Destination "$ProjectRoot\" -Recurse -Force
    }
    
    Write-Host "4. 恢复配置文件..." -ForegroundColor Yellow
    $configFiles = @(".env", ".env.example", "package.json", "package-lock.json", ".gitignore", "README.md", "start_project.bat", "start_project.ps1")
    foreach ($file in $configFiles) {
        if (Test-Path $file) {
            Copy-Item $file -Destination "$ProjectRoot\" -Force
        }
    }
    
    Write-Host "`n✅ 完整项目恢复完成!" -ForegroundColor Green
    Write-Host "当前项目已备份到: $backupDir" -ForegroundColor Yellow
    
} elseif ($Type -eq "backend") {
    Write-Host "仅恢复后端..." -ForegroundColor Green
    
    # 备份当前后端
    $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
    if (Test-Path "$ProjectRoot\backend") {
        $backupDir = "$ProjectRoot\backups\backend_backup_$timestamp"
        New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
        Copy-Item "$ProjectRoot\backend" -Destination $backupDir -Recurse -Force
    }
    
    # 恢复后端
    Remove-Item "$ProjectRoot\backend" -Recurse -Force -ErrorAction SilentlyContinue
    Copy-Item "backend" -Destination "$ProjectRoot\" -Recurse -Force
    
    Write-Host "`n✅ 后端恢复完成!" -ForegroundColor Green
    Write-Host "原后端已备份到: $backupDir" -ForegroundColor Yellow
    
} elseif ($Type -eq "frontend") {
    Write-Host "仅恢复前端..." -ForegroundColor Green
    
    # 备份当前前端
    $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
    if (Test-Path "$ProjectRoot\frontend") {
        $backupDir = "$ProjectRoot\backups\frontend_backup_$timestamp"
        New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
        Copy-Item "$ProjectRoot\frontend" -Destination $backupDir -Recurse -Force
    }
    
    # 恢复前端
    Remove-Item "$ProjectRoot\frontend" -Recurse -Force -ErrorAction SilentlyContinue
    Copy-Item "frontend" -Destination "$ProjectRoot\" -Recurse -Force
    
    Write-Host "`n✅ 前端恢复完成!" -ForegroundColor Green
    Write-Host "原前端已备份到: $backupDir" -ForegroundColor Yellow
    
} elseif ($Type -eq "files") {
    Write-Host "仅恢复关键文件（不删除目录）..." -ForegroundColor Green
    
    # 备份当前文件
    $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
    $backupDir = "$ProjectRoot\backups\files_backup_$timestamp"
    New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
    
    # 恢复关键后端文件
    Write-Host "1. 恢复后端关键文件..." -ForegroundColor Yellow
    $backendFiles = Get-ChildItem "backend" -Recurse -File | Where-Object { $_.Name -like "*.py" -or $_.Name -like "*.txt" }
    foreach ($file in $backendFiles) {
        $relativePath = $file.FullName.Replace((Get-Location).Path + "\backend\", "")
        $destPath = "$ProjectRoot\backend\$relativePath"
        $backupPath = "$backupDir\backend\$relativePath"
        
        # 备份原文件
        if (Test-Path $destPath) {
            New-Item -ItemType Directory -Path (Split-Path $backupPath -Parent) -Force | Out-Null
            Copy-Item $destPath -Destination $backupPath -Force
        }
        
        # 恢复文件
        New-Item -ItemType Directory -Path (Split-Path $destPath -Parent) -Force | Out-Null
        Copy-Item $file.FullName -Destination $destPath -Force
    }
    
    # 恢复关键前端文件
    Write-Host "2. 恢复前端关键文件..." -ForegroundColor Yellow
    $frontendFiles = Get-ChildItem "frontend" -Recurse -File | Where-Object { $_.Name -like "*.tsx" -or $_.Name -like "*.ts" -or $_.Name -like "*.js" -or $_.Name -like "*.json" -and $_.Name -notlike "package-lock.json" }
    foreach ($file in $frontendFiles) {
        $relativePath = $file.FullName.Replace((Get-Location).Path + "\frontend\", "")
        $destPath = "$ProjectRoot\frontend\$relativePath"
        $backupPath = "$backupDir\frontend\$relativePath"
        
        # 备份原文件
        if (Test-Path $destPath) {
            New-Item -ItemType Directory -Path (Split-Path $backupPath -Parent) -Force | Out-Null
            Copy-Item $destPath -Destination $backupPath -Force
        }
        
        # 恢复文件
        New-Item -ItemType Directory -Path (Split-Path $destPath -Parent) -Force | Out-Null
        Copy-Item $file.FullName -Destination $destPath -Force
    }
    
    Write-Host "`n✅ 关键文件恢复完成!" -ForegroundColor Green
    Write-Host "原文件已备份到: $backupDir" -ForegroundColor Yellow
    
} else {
    Write-Host "用法: .\restore.ps1 [-Type full|backend|frontend|files]" -ForegroundColor Red
    Write-Host "  full     - 恢复完整项目（覆盖所有目录）" -ForegroundColor Yellow
    Write-Host "  backend  - 仅恢复后端目录" -ForegroundColor Yellow
    Write-Host "  frontend - 仅恢复前端目录" -ForegroundColor Yellow
    Write-Host "  files    - 仅恢复关键文件（不删除整个目录）" -ForegroundColor Yellow
    exit 1
}

Write-Host "`n=== 启动命令 ===" -ForegroundColor Cyan
Write-Host "后端: cd $ProjectRoot\backend && py -u start_quant_backend.py" -ForegroundColor Yellow
Write-Host "前端: cd $ProjectRoot\frontend && npm start" -ForegroundColor Yellow

Write-Host "`n=== 验证步骤 ===" -ForegroundColor Cyan
Write-Host "1. 启动后端，确认端口 8889 监听正常" -ForegroundColor Yellow
Write-Host "2. 测试 Analyze 页面: http://localhost:3000/market/analyze/AAPL" -ForegroundColor Yellow
Write-Host "3. 验证 1D 图表在非交易日（周末）显示上一个交易日数据" -ForegroundColor Yellow
Write-Host "4. 验证错误消息显示正确的数据源（Alpaca）而非 Finnhub" -ForegroundColor Yellow

Write-Host "`n=== 修复说明 ===" -ForegroundColor Cyan
Write-Host "主要修复文件: backend/start_quant_backend.py" -ForegroundColor Yellow
Write-Host "修复函数: fetch_alpaca_bars()" -ForegroundColor Yellow
Write-Host "修复内容:" -ForegroundColor Yellow
Write-Host "  1. 添加交易日判断逻辑（第692-752行）" -ForegroundColor Gray
Write-Host "  2. 非交易日自动回退到上一个交易日（第705-725行）" -ForegroundColor Gray
Write-Host "  3. 更新数据过滤逻辑（第850-880行）" -ForegroundColor Gray
Write-Host "  4. 时间范围计算优化" -ForegroundColor Gray

Write-Host "`n=== 恢复完成 ===" -ForegroundColor Green