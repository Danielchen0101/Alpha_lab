@echo off
echo ================================================
echo 启动量化交易平台 - 专业版
echo ================================================
echo.

REM 设置工作目录
cd /d "%~dp0"

REM 检查Python是否安装
python --version >nul 2>&1
if errorlevel 1 (
    echo [错误] Python未安装或未添加到PATH
    echo 请安装Python并确保在PATH中
    pause
    exit /b 1
)

REM 检查Node.js是否安装
node --version >nul 2>&1
if errorlevel 1 (
    echo [错误] Node.js未安装或未添加到PATH
    echo 请安装Node.js并确保在PATH中
    pause
    exit /b 1
)

REM 检查npm是否安装
npm --version >nul 2>&1
if errorlevel 1 (
    echo [错误] npm未安装或未添加到PATH
    echo 请安装npm并确保在PATH中
    pause
    exit /b 1
)

echo [1/3] 检查依赖...
echo.

REM 检查前端依赖
if not exist "frontend\node_modules\" (
    echo [前端] 安装依赖...
    cd frontend
    call npm install
    cd ..
) else (
    echo [前端] 依赖已安装
)

REM 检查Python依赖
echo [后端] 检查Python依赖...
python -c "import flask" >nul 2>&1
if errorlevel 1 (
    echo [后端] 安装Flask...
    pip install flask
) else (
    echo [后端] Flask已安装
)

python -c "import requests" >nul 2>&1
if errorlevel 1 (
    echo [后端] 安装requests...
    pip install requests
) else (
    echo [后端] requests已安装
)

echo.
echo [2/3] 启动后端服务...
echo.

REM 检查py命令（Windows Python启动器）
py --version >nul 2>&1
if errorlevel 1 (
    echo [警告] py命令未找到，尝试使用python
    python --version >nul 2>&1
    if errorlevel 1 (
        echo [错误] py和python都未找到
        echo 请安装Python并确保在PATH中
        pause
        exit /b 1
    ) else (
        set PYTHON_CMD=python
        echo [信息] 使用python命令
    )
) else (
    set PYTHON_CMD=py
    echo [信息] 使用py命令
)

REM 启动后端服务（在后台）
start "量化平台后端" cmd /k "cd /d %~dp0backend && %PYTHON_CMD% start_quant_backend.py"
timeout /t 3 /nobreak >nul

echo [后端] 服务启动中... (端口: 8889)
echo.

echo [3/3] 启动前端服务...
echo.

REM 启动前端服务（在后台）
start "量化平台前端" cmd /k "cd /d %~dp0frontend && npm start"
timeout /t 5 /nobreak >nul

echo ================================================
echo 启动完成！
echo.
echo 访问地址:
echo 前端: http://localhost:3000
echo 后端: http://localhost:8889
echo.
echo 后端API示例:
echo   - 市场数据: http://localhost:8889/market/stock/AAPL
echo   - 回测历史: http://localhost:8889/api/backtest/history
echo   - 运行回测: http://localhost:8889/backtest/run
echo.
echo 按任意键打开浏览器访问前端...
echo ================================================
pause >nul

REM 打开浏览器
start http://localhost:3000

echo.
echo 要停止服务，请关闭打开的两个命令行窗口。
echo.
pause