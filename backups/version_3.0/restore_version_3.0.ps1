# Restore Version 3.0 Backup
# This script restores the project to Version 3.0 state
# Version 3.0 includes: Alpaca Paper Trading enhancements + Navigation/Routing updates

Write-Host "=== Restoring Version 3.0 ===" -ForegroundColor Green
Write-Host "Version 3.0 Features:" -ForegroundColor Cyan
Write-Host "1. Alpaca Paper Trading UI optimizations" -ForegroundColor Yellow
Write-Host "2. Navigation menu restructuring" -ForegroundColor Yellow
Write-Host "3. Portfolio → Local Paper Trading rename" -ForegroundColor Yellow
Write-Host "4. New Portfolio tab creation" -ForegroundColor Yellow
Write-Host "5. Experiment Ranking removal" -ForegroundColor Yellow

# Check if we're in the right directory
$currentDir = Get-Location
Write-Host "Current directory: $currentDir" -ForegroundColor Gray

# Ask for confirmation
$confirm = Read-Host "Are you sure you want to restore Version 3.0? This will overwrite current files. (y/N)"
if ($confirm -ne 'y' -and $confirm -ne 'Y') {
    Write-Host "Restore cancelled." -ForegroundColor Red
    exit 1
}

# Restore backend files
Write-Host "Restoring backend files..." -ForegroundColor Cyan
if (Test-Path "backend") {
    Remove-Item -Path "backend" -Recurse -Force
}
Copy-Item -Path ".\backups\version_3.0\backend" -Destination "backend" -Recurse -Force
Write-Host "✓ Backend restored" -ForegroundColor Green

# Restore frontend source files
Write-Host "Restoring frontend source files..." -ForegroundColor Cyan
if (Test-Path "frontend\src") {
    Remove-Item -Path "frontend\src" -Recurse -Force
}
Copy-Item -Path ".\backups\version_3.0\frontend\src" -Destination "frontend\src" -Recurse -Force
Write-Host "✓ Frontend source restored" -ForegroundColor Green

# Restore configuration files
Write-Host "Restoring configuration files..." -ForegroundColor Cyan
Copy-Item -Path ".\backups\version_3.0\.env" -Destination ".env" -Force -ErrorAction SilentlyContinue
Copy-Item -Path ".\backups\version_3.0\.env.example" -Destination ".env.example" -Force -ErrorAction SilentlyContinue
Copy-Item -Path ".\backups\version_3.0\package.json" -Destination "package.json" -Force -ErrorAction SilentlyContinue
Copy-Item -Path ".\backups\version_3.0\package-lock.json" -Destination "package-lock.json" -Force -ErrorAction SilentlyContinue
Write-Host "✓ Configuration files restored" -ForegroundColor Green

# Summary
Write-Host "`n=== Restore Complete ===" -ForegroundColor Green
Write-Host "Version 3.0 has been successfully restored." -ForegroundColor White
Write-Host "`nChanges made:" -ForegroundColor Cyan
Write-Host "1. Backend: Alpaca API integration with proper error handling" -ForegroundColor Gray
Write-Host "2. Frontend Navigation:" -ForegroundColor Gray
Write-Host "   - Experiment Ranking removed" -ForegroundColor Gray
Write-Host "   - Portfolio → Local Paper Trading" -ForegroundColor Gray
Write-Host "   - New Portfolio tab added" -ForegroundColor Gray
Write-Host "   - Menu order: Strategy Ranking → Local Paper Trading → Alpaca Paper Trading → Analytics → Portfolio" -ForegroundColor Gray
Write-Host "3. Alpaca Paper Trading UI enhancements:" -ForegroundColor Gray
Write-Host "   - Field linkage and validation" -ForegroundColor Gray
Write-Host "   - Buying power and position display" -ForegroundColor Gray
Write-Host "   - Non-trading hours notice" -ForegroundColor Gray
Write-Host "   - Improved error handling" -ForegroundColor Gray
Write-Host "   - Cancel button loading states" -ForegroundColor Gray

Write-Host "`nNext steps:" -ForegroundColor Yellow
Write-Host "1. Run 'npm install' in the frontend directory" -ForegroundColor White
Write-Host "2. Start backend: 'cd backend && py start_quant_backend.py'" -ForegroundColor White
Write-Host "3. Start frontend: 'cd frontend && npm start'" -ForegroundColor White

Write-Host "`nTo verify the restore:" -ForegroundColor Cyan
Write-Host "- Check navigation menu order" -ForegroundColor Gray
Write-Host "- Open Local Paper Trading page" -ForegroundColor Gray
Write-Host "- Open new Portfolio page" -ForegroundColor Gray
Write-Host "- Test Alpaca Paper Trading order flow" -ForegroundColor Gray