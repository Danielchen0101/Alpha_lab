# AlphaLab 本地快速启动

这份指南对应当前 v3 工作区。项目没有内置管理员或测试账户；本地登录使用你在 Supabase 中创建的账户。

## 1. 环境要求

- Node.js 20 或更高版本
- Python 3.11 或更高版本
- 一个 Supabase 项目
- Git

## 2. 获取项目

```bash
git clone https://github.com/Danielchen0101/Alpha_lab.git
cd Alpha_lab
```

## 3. 初始化 Supabase

在 Supabase SQL Editor 中按顺序执行：

1. `backend/supabase_schema.sql`
2. `backend/supabase_operations_store.sql`
3. `backend/supabase_security_hardening.sql`

第三份脚本会让浏览器账户只保留 owner-scoped 读取权限；所有写操作都经由后端验证。

## 4. 配置环境变量

```bash
cp frontend/.env.example frontend/.env
cp backend/.env.example backend/.env
```

至少填写：

### `frontend/.env`

```dotenv
REACT_APP_API_BASE_URL=http://127.0.0.1:8889/api
REACT_APP_SUPABASE_URL=https://<project-ref>.supabase.co
REACT_APP_SUPABASE_ANON_KEY=<browser-safe-anon-or-publishable-key>
```

### `backend/.env`

```dotenv
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<server-only-service-role-key>
FERNET_KEY=<stable-fernet-key>
APP_SECRET_KEY=<stable-random-application-secret>
FRONTEND_ORIGIN=http://127.0.0.1:3000
FLASK_ENV=development
```

`SUPABASE_SERVICE_ROLE_KEY`、`FERNET_KEY` 和 `APP_SECRET_KEY` 只能放在后端，不能使用 `REACT_APP_` 前缀。

## 5. 启动后端

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python start_quant_backend.py
```

Windows PowerShell 激活虚拟环境：

```powershell
.venv\Scripts\Activate.ps1
```

后端默认地址：`http://127.0.0.1:8889`。

## 6. 启动前端

另开一个终端：

```bash
cd /path/to/Alpha_lab/frontend
npm ci
npm start
```

前端默认地址：`http://127.0.0.1:3000`。

## 7. 验证

```bash
curl http://127.0.0.1:8889/api/health
```

然后在浏览器完成以下检查：

1. 打开 `/signup` 创建账户，或打开 `/signin` 登录已有账户。
2. 登录后进入 Settings，检查 Supabase、Alpaca 和所需数据源状态。
3. 先保持 Paper Mode，运行一次小规模 Market Scanner。
4. 检查 Research Pipeline、Activity、Portfolio 和 Safety Center 是否能读取状态。
5. 只有在真实凭据、MFA、风险限制和保护单全部确认后，才考虑 Live Mode。

## 8. 发布前验证

```bash
cd frontend
npm test -- --watchAll=false --runInBand
npx tsc --noEmit
npx eslint src --ext .js,.jsx,.ts,.tsx --max-warnings=0
npm run build
npm run test:e2e

cd ../backend
.venv/bin/python -m pytest -q
```

部署、Render、Cloudflare Pages 和生产安全检查见 [DEPLOYMENT.md](../DEPLOYMENT.md)。常见故障见 [FIX_GUIDE.md](FIX_GUIDE.md)。
