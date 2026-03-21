@echo off
echo 🔧 启动量化平台后端API服务...
echo.

cd /d "%~dp0..\backend"
echo 当前目录: %cd%
echo.

echo 检查Python环境...
python --version
if errorlevel 1 (
    echo ❌ Python未安装或不在PATH中！
    pause
    exit /b 1
)

echo.
echo 启动Flask后端API (端口: 8889)...
echo ========================================

REM 启动主后端文件
echo 启动 start_quant_backend.py (主后端)...
python start_quant_backend.py

if errorlevel 1 (
    echo ❌ 主后端启动失败！
    echo 请检查:
    echo 1. 依赖是否安装: pip install -r requirements.txt
    echo 2. 端口是否被占用: netstat -ano | findstr :8889
    echo 3. Python是否正常工作
    pause
) else (
    echo ✅ 后端服务已启动
    echo 访问地址: http://localhost:8889
    echo API状态: http://localhost:8889/api/status
)