@echo off
echo ============================================
echo 恢复 Version 3.0 备份
echo ============================================
echo.

echo 警告：此操作将覆盖当前文件！
echo 请确保你已经备份了当前状态。
echo.
pause

echo.
echo 1. 恢复后端代码...
xcopy backend ..\..\backend /E /I /Y
if %ERRORLEVEL% NEQ 0 (
    echo 错误：恢复后端失败
    pause
    exit /b 1
)

echo.
echo 2. 恢复前端源代码...
xcopy frontend\src ..\..\frontend\src /E /I /Y
if %ERRORLEVEL% NEQ 0 (
    echo 错误：恢复前端失败
    pause
    exit /b 1
)

echo.
echo 3. 恢复配置文件...
copy .env ..\..\.env /Y
copy .env.example ..\..\.env.example /Y
copy package.json ..\..\package.json /Y
copy package-lock.json ..\..\package-lock.json /Y

echo.
echo 4. 恢复完成！
echo.
echo 请运行以下命令：
echo   cd ..\..\frontend
echo   npm install
echo   npm start
echo.
echo 后端启动：
echo   cd ..\..\backend
echo   py start_quant_backend.py
echo.
pause