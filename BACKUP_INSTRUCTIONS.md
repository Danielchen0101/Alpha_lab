# 项目备份说明
## 专业量化平台 - 备份与恢复指南

**最后更新**: 2026-03-22 22:21 EDT

---

## 📦 备份文件列表

### 1. 主要备份文件
| 文件 | 大小 | 描述 |
|------|------|------|
| `backup.md` | 6.7KB | 项目概述、结构、状态总结 |
| `backup_code.md` | 14.8KB | 关键代码完整备份 |
| `BACKUP_INSTRUCTIONS.md` | 本文件 | 备份与恢复指南 |

### 2. 关键源文件位置
| 路径 | 重要性 | 最后修改 |
|------|--------|----------|
| `backend/start_quant_backend.py` | 🔴 关键 | 2026-03-22 17:29 |
| `frontend/src/pages/SymbolAnalysis.tsx` | 🔴 关键 | 2026-03-22 22:16 |
| `frontend/src/services/marketDataService.ts` | 🟡 重要 | 2026-03-22 19:42 |
| `frontend/build/` | 🟢 可重建 | 2026-03-22 22:16 |

### 3. 配置文件
| 文件 | 用途 |
|------|------|
| `.env` | 后端环境变量 |
| `frontend/.env` | 前端环境变量 |
| `package.json` | 项目配置 |
| `frontend/package.json` | 前端依赖 |

---

## 🔄 备份策略

### 每日备份 (建议)
1. **代码备份**: 复制整个项目目录
2. **数据库备份**: 备份 `backend/instance/quant.db`
3. **构建输出备份**: 备份 `frontend/build/`
4. **日志备份**: 备份 `backend/logs/`

### 版本控制 (推荐)
```bash
# 初始化Git仓库
git init
git add .
git commit -m "初始提交 - 专业量化平台 v1.0.0"

# 创建GitHub远程仓库
git remote add origin https://github.com/yourusername/professional-quant-platform.git
git push -u origin main
```

### 手动备份命令
```bash
# 创建完整备份
tar -czf quant-platform-backup-$(date +%Y%m%d).tar.gz professional_quant_platform/

# 仅备份关键文件
tar -czf quant-platform-essential-$(date +%Y%m%d).tar.gz \
  professional_quant_platform/backend/ \
  professional_quant_platform/frontend/src/ \
  professional_quant_platform/*.env \
  professional_quant_platform/*.json \
  professional_quant_platform/*.md
```

---

## 🚀 快速恢复指南

### 场景1: 完全丢失，从备份恢复
```bash
# 1. 创建项目目录
mkdir professional_quant_platform
cd professional_quant_platform

# 2. 恢复后端
mkdir -p backend
# 从 backup_code.md 复制 start_quant_backend.py 内容
# 从 backup_code.md 复制 config.py 内容

# 3. 恢复前端
mkdir -p frontend/src
# 从 backup_code.md 复制 SymbolAnalysis.tsx 内容到 frontend/src/pages/
# 从 backup_code.md 复制 marketDataService.ts 内容到 frontend/src/services/

# 4. 恢复配置文件
# 从 backup_code.md 复制 .env 内容
# 从 backup_code.md 复制 package.json 内容

# 5. 安装依赖
cd frontend && npm install
cd ../backend
pip install flask flask-cors python-dotenv requests

# 6. 启动项目
# 终端1: cd backend && python start_quant_backend.py
# 终端2: cd frontend && npm start
```

### 场景2: 部分文件损坏
```bash
# 1. 识别损坏文件
# 检查以下关键文件:
# - backend/start_quant_backend.py
# - frontend/src/pages/SymbolAnalysis.tsx
# - frontend/src/services/marketDataService.ts

# 2. 从备份恢复单个文件
# 从 backup_code.md 复制对应内容到损坏文件

# 3. 验证修复
cd frontend && npm run build  # 检查TypeScript错误
cd ../backend && python start_quant_backend.py  # 检查Python错误
```

### 场景3: 依赖问题
```bash
# 前端依赖问题
cd frontend
rm -rf node_modules package-lock.json
npm cache clean --force
npm install

# 后端依赖问题
cd backend
pip install --upgrade pip
pip install -r requirements.txt  # 或手动安装:
pip install flask flask-cors python-dotenv requests
```

---

## 🛡️ 数据备份

### 数据库备份
```bash
# SQLite数据库备份
cp backend/instance/quant.db backend/instance/quant.db.backup.$(date +%Y%m%d)

# 数据库导出为SQL
sqlite3 backend/instance/quant.db .dump > quant_backup_$(date +%Y%m%d).sql
```

### 缓存数据备份
```bash
# 备份内存缓存状态 (如果重要)
# 注意: 内存缓存是临时的，通常不需要备份
```

### 日志备份
```bash
# 备份日志文件
cp backend/logs/backend.log backend/logs/backend.log.backup.$(date +%Y%m%d)
```

---

## 🔧 故障排除

### 常见问题1: 前端构建失败
```bash
# 错误: TypeScript编译错误
cd frontend
npm run build 2>&1 | grep -A5 -B5 "error"

# 解决方案:
# 1. 检查 SymbolAnalysis.tsx 中的JSX语法
# 2. 检查所有标签是否正确闭合
# 3. 检查TypeScript类型定义
```

### 常见问题2: 后端启动失败
```bash
# 错误: Python导入错误
cd backend
python start_quant_backend.py

# 解决方案:
# 1. 检查依赖是否安装: pip list | grep flask
# 2. 检查环境变量: echo $TWELVEDATA_API_KEY
# 3. 检查端口占用: netstat -an | grep 5000
```

### 常见问题3: API连接失败
```bash
# 错误: Twelve Data API无法连接
# 解决方案:
# 1. 检查网络连接
# 2. 验证API密钥
# 3. 检查API限制 (免费版有调用限制)
```

### 常见问题4: 图表显示异常
```bash
# 错误: 图表数据不正确
# 解决方案:
# 1. 检查 marketDataService.ts 中的时间范围配置
# 2. 检查 RSI/SMA 计算逻辑
# 3. 检查数据格式化函数
```

---

## 📈 监控与维护

### 日常检查清单
- [ ] 后端服务运行正常 (`http://localhost:5000/api/health`)
- [ ] 前端构建无错误 (`npm run build`)
- [ ] API密钥有效 (Twelve Data账户)
- [ ] 数据库文件大小正常 (`quant.db` < 100MB)
- [ ] 日志文件无异常错误

### 性能监控
```bash
# 检查内存使用
ps aux | grep -E "(python|node)" | grep -v grep

# 检查磁盘空间
df -h .

# 检查日志增长
du -sh backend/logs/
```

### 安全维护
1. **API密钥轮换**: 每3个月更新一次API密钥
2. **依赖更新**: 每月检查并更新npm/pip包
3. **漏洞扫描**: 使用 `npm audit` 和 `pip-audit`
4. **访问控制**: 限制后端API访问IP

---

## 🎯 备份验证

### 验证步骤
1. **代码完整性验证**
   ```bash
   # 检查关键文件是否存在
   ls -la backend/start_quant_backend.py
   ls -la frontend/src/pages/SymbolAnalysis.tsx
   ls -la frontend/src/services/marketDataService.ts
   ```

2. **构建验证**
   ```bash
   cd frontend
   npm run build
   # 应该输出 "Compiled successfully"
   ```

3. **功能验证**
   ```bash
   # 启动后端
   cd backend && python start_quant_backend.py &
   
   # 测试API端点
   curl http://localhost:5000/api/health
   curl http://localhost:5000/api/stock/AAPL/price
   ```

4. **数据验证**
   ```bash
   # 检查数据库
   sqlite3 backend/instance/quant.db "SELECT COUNT(*) FROM price_cache;"
   
   # 检查构建输出
   ls -la frontend/build/static/js/main.*.js
   ```

### 恢复测试 (每季度)
1. 在新目录中测试从备份恢复
2. 验证所有功能正常工作
3. 记录恢复时间和问题
4. 更新备份流程

---

## 📋 备份时间表

### 自动备份 (建议配置)
```bash
# 每日备份脚本 (backup_daily.sh)
#!/bin/bash
BACKUP_DIR="/backup/quant-platform"
DATE=$(date +%Y%m%d)

# 创建备份
tar -czf $BACKUP_DIR/full-$DATE.tar.gz /path/to/professional_quant_platform

# 保留最近7天备份
find $BACKUP_DIR -name "full-*.tar.gz" -mtime +7 -delete

echo "备份完成: $BACKUP_DIR/full-$DATE.tar.gz"
```

### 手动备份时机
1. **重大功能发布前**
2. **依赖更新后**
3. **API密钥变更前**
4. **系统迁移前**
5. **季度末**

### 备份存储
- **本地存储**: 外部硬盘、NAS
- **云存储**: Google Drive, Dropbox, AWS S3
- **版本控制**: GitHub, GitLab, Bitbucket
- **异地备份**: 不同物理位置的备份

---

## 🆘 紧急恢复

### 紧急联系人
- **开发团队**: [团队联系方式]
- **API提供商**: Twelve Data支持
- **托管服务商**: [如果有]

### 紧急恢复流程
1. **评估损坏程度**
2. **确定恢复点** (最近可用备份)
3. **执行恢复操作**
4. **验证恢复结果**
5. **记录事故报告**

### 最小恢复时间目标 (RTO)
- **关键功能**: 2小时内恢复
- **完整功能**: 24小时内恢复

### 最小恢复点目标 (RPO)
- **数据丢失**: 不超过24小时
- **配置丢失**: 不超过7天

---

## 📚 文档更新

### 备份文档更新规则
1. **每次重大变更后**更新备份说明
2. **每月检查**备份流程有效性
3. **每季度测试**恢复流程
4. **每年审查**备份策略

### 文档版本控制
```
BACKUP_INSTRUCTIONS.md
├── v1.0.0 (2026-03-22) - 初始版本
├── v1.1.0 (2026-04-22) - 添加自动备份脚本
└── v1.2.0 (2026-06-22) - 添加云存储说明
```

---

## ✅ 备份完成确认

### 当前备份状态
- [x] **代码备份完成**: `backup.md`, `backup_code.md`
- [x] **配置备份完成**: 环境变量、包配置
- [x] **文档备份完成**: 恢复指南、说明文档
- [x] **构建输出备份**: `frontend/build/`
- [ ] **数据库备份**: 需要手动执行 (建议)
- [ ] **日志备份**: 需要手动执行 (可选)

### 下一步行动
1. **立即执行**: 数据库备份 `cp backend/instance/quant.db quant.db.backup`
2. **今日内完成**: 上传备份到云存储
3. **本周内完成**: 测试恢复流程
4. **本月内完成**: 设置自动备份

### 备份验证命令
```bash
# 验证备份完整性
md5sum backup.md backup_code.md BACKUP_INSTRUCTIONS.md

# 验证关键文件
grep -c "Signal Summary" backup_code.md  # 应该找到
grep -c "start_quant_backend" backup_code.md  # 应该找到
grep -c "calculateRSI" backup_code.md  # 应该找到
```

---

**最后更新**: 2026-03-22 22:21 EDT  
**备份状态**: ✅ 主要备份完成  
**恢复就绪**: 🟡 需要数据库备份  
**建议**: 立即执行数据库备份，并测试恢复流程