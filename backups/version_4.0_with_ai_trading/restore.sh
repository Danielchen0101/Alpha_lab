#!/bin/bash
# Version 4.0 With AI Trading - 恢复脚本
# 用法: ./restore.sh [full|backend|frontend]

set -e

VERSION_DIR="version_4.0_with_ai_trading"
PROJECT_ROOT="../../"

echo "=== Version 4.0 With AI Trading 恢复脚本 ==="
echo "版本: 4.0 (包含 AI Trading 功能)"
echo "创建时间: 2026-04-05"
echo ""

if [ "$1" == "full" ] || [ "$1" == "" ]; then
    echo "执行完整项目恢复..."
    
    # 备份当前文件
    echo "1. 备份当前文件..."
    timestamp=$(date +"%Y%m%d_%H%M%S")
    mkdir -p "${PROJECT_ROOT}/backups/before_restore_${timestamp}"
    cp "${PROJECT_ROOT}/backend/start_quant_backend.py" "${PROJECT_ROOT}/backups/before_restore_${timestamp}/" 2>/dev/null || true
    
    # 恢复后端
    echo "2. 恢复后端文件..."
    cp "backend/start_quant_backend.py" "${PROJECT_ROOT}/backend/"
    
    # 恢复前端
    echo "3. 恢复前端文件..."
    cp "frontend/package.json" "${PROJECT_ROOT}/frontend/"
    cp "frontend/tsconfig.json" "${PROJECT_ROOT}/frontend/"
    cp "frontend/src/App.tsx" "${PROJECT_ROOT}/frontend/src/"
    cp "frontend/src/components/NavigationMenu.tsx" "${PROJECT_ROOT}/frontend/src/components/"
    cp "frontend/src/pages/AITrading.tsx" "${PROJECT_ROOT}/frontend/src/pages/"
    cp "frontend/src/services/aiTradingService.ts" "${PROJECT_ROOT}/frontend/src/services/"
    cp "frontend/src/services/api.ts" "${PROJECT_ROOT}/frontend/src/services/"
    
    echo "✅ 完整项目恢复完成!"
    echo "备份保存在: backups/before_restore_${timestamp}"
    
elif [ "$1" == "backend" ]; then
    echo "仅恢复后端..."
    
    # 备份当前后端
    timestamp=$(date +"%Y%m%d_%H%M%S")
    cp "${PROJECT_ROOT}/backend/start_quant_backend.py" "${PROJECT_ROOT}/backend/start_quant_backend_backup_${timestamp}.py"
    
    # 恢复后端
    cp "backend/start_quant_backend.py" "${PROJECT_ROOT}/backend/"
    
    echo "✅ 后端恢复完成!"
    echo "原文件备份为: backend/start_quant_backend_backup_${timestamp}.py"
    
elif [ "$1" == "frontend" ]; then
    echo "仅恢复前端..."
    
    # 恢复前端文件
    cp "frontend/package.json" "${PROJECT_ROOT}/frontend/"
    cp "frontend/tsconfig.json" "${PROJECT_ROOT}/frontend/"
    cp "frontend/src/App.tsx" "${PROJECT_ROOT}/frontend/src/"
    cp "frontend/src/components/NavigationMenu.tsx" "${PROJECT_ROOT}/frontend/src/components/"
    cp "frontend/src/pages/AITrading.tsx" "${PROJECT_ROOT}/frontend/src/pages/"
    cp "frontend/src/services/aiTradingService.ts" "${PROJECT_ROOT}/frontend/src/services/"
    cp "frontend/src/services/api.ts" "${PROJECT_ROOT}/frontend/src/services/"
    
    echo "✅ 前端恢复完成!"
    
else
    echo "用法: $0 [full|backend|frontend]"
    echo "  full     - 恢复完整项目 (默认)"
    echo "  backend  - 仅恢复后端"
    echo "  frontend - 仅恢复前端"
    exit 1
fi

echo ""
echo "=== 启动命令 ==="
echo "后端: cd ${PROJECT_ROOT}/backend && py -u start_quant_backend.py"
echo "前端: cd ${PROJECT_ROOT}/frontend && npm start"
echo ""
echo "=== 验证步骤 ==="
echo "1. 启动后端，确认输出包含 '优化版后端启动'"
echo "2. 测试接口: curl http://127.0.0.1:8889/api/status"
echo "3. 测试AI接口: curl -X POST http://127.0.0.1:8889/api/ai/provider/config -H 'Content-Type: application/json' -d '{\"apiKey\":\"test\"}'"
echo "4. 启动前端，访问 http://localhost:3000/ai-trading"