# Version 3.0 恢复说明

## 备份时间
2026-04-05 15:08 EDT

## 备份内容
此版本包含了以下修改：
1. 删除了 `Experiment Ranking` 页面
2. 将旧 `Portfolio` 页面重命名为 `Local Paper Trading`
3. 调整了左侧导航菜单顺序
4. 新增了新的 `Portfolio` 页面

## 文件结构
```
backups/version_3.0/
├── backend/                    # 后端代码
├── frontend/src/              # 前端源代码
├── .env                       # 环境变量
├── .env.example              # 环境变量示例
├── package.json              # 项目依赖
├── package-lock.json         # 依赖锁文件
└── RESTORE_INSTRUCTIONS.md   # 本文件
```

## 恢复步骤

### 1. 恢复后端
```bash
# 删除当前 backend 目录
rm -rf professional_quant_platform/backend

# 恢复备份的 backend
xcopy backups\version_3.0\backend professional_quant_platform\backend /E /I
```

### 2. 恢复前端源代码
```bash
# 删除当前 frontend/src 目录
rm -rf professional_quant_platform/frontend/src

# 恢复备份的 frontend/src
xcopy backups\version_3.0\frontend\src professional_quant_platform\frontend\src /E /I
```

### 3. 恢复配置文件
```bash
copy backups\version_3.0\.env professional_quant_platform\
copy backups\version_3.0\.env.example professional_quant_platform\
copy backups\version_3.0\package.json professional_quant_platform\
copy backups\version_3.0\package-lock.json professional_quant_platform\
```

### 4. 重新安装依赖
```bash
cd professional_quant_platform/frontend
npm install
```

### 5. 启动项目
```bash
# 启动后端
cd professional_quant_platform/backend
py start_quant_backend.py

# 启动前端（另一个终端）
cd professional_quant_platform/frontend
npm start
```

## 版本特性

### 导航菜单顺序
1. Dashboard
2. Market
3. Watchlist
4. Backtest
5. Parameter Optimization
6. Strategy Comparison
7. Strategy Ranking
8. Local Paper Trading
9. Alpaca Paper Trading
10. Analytics
11. Portfolio

### 路由变化
- `/experiment-ranking` - 已删除
- `/portfolio` - 新的 Portfolio 页面
- `/local-paper-trading` - 旧的 Portfolio 页面（重命名）

### 页面变化
1. **Local Paper Trading** (`/local-paper-trading`)
   - 原 Portfolio 页面
   - 本地模拟交易功能
   - 策略信号和手动订单

2. **Portfolio** (`/portfolio`)
   - 新的投资组合页面
   - 资产分配和绩效概览
   - 持仓列表

## 注意事项
1. 恢复前请确保备份当前状态
2. 恢复后可能需要重新配置环境变量
3. 如果遇到依赖问题，请删除 `node_modules` 后重新安装

## 版本标记
此版本标记为 **Version 3.0**，代表导航/路由重构后的稳定版本。