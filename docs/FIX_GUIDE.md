# AlphaLab 故障排查指南

先确认你使用的是当前仓库 `Danielchen0101/Alpha_lab`，并已按 [QUICK_START.md](QUICK_START.md) 执行三份 Supabase SQL。

## 1. 前端显示 Backend Connection Error

依次检查：

1. 后端是否正在监听 `127.0.0.1:8889`：

   ```bash
   curl http://127.0.0.1:8889/api/health
   ```

2. `frontend/.env` 是否指向正确地址：

   ```dotenv
   REACT_APP_API_BASE_URL=http://127.0.0.1:8889/api
   ```

3. 修改 `.env` 后必须重启前端开发服务器。
4. 后端 `FRONTEND_ORIGIN` 应与浏览器实际 origin 完全一致；`localhost` 和 `127.0.0.1` 不应混用。
5. 查看启动后端的终端输出，不要只看前端的通用错误提示。

## 2. Supabase 登录跳到 `placeholder.supabase.co`

这是前端构建时没有读到真实 Supabase 配置。填写并重新构建：

```dotenv
REACT_APP_SUPABASE_URL=https://<project-ref>.supabase.co
REACT_APP_SUPABASE_ANON_KEY=<browser-safe-anon-or-publishable-key>
```

本地修改后重启 `npm start`；Cloudflare Pages 修改后需要重新部署。不要把 service-role key 放进前端变量。

## 3. Google 或 GitHub 登录按钮无效

检查 Supabase Dashboard：

- Authentication → Providers 中启用对应 provider，并保存 Client ID/Secret。
- Authentication → URL Configuration 中设置正式站 Site URL，并加入应用实际使用的 `/signin`、`/dashboard`、`/auth/confirmed` 和 `/reset-password` 回调。
- Google/GitHub 服务商后台的 callback 应为 `https://<project-ref>.supabase.co/auth/v1/callback`，不是应用的 `/dashboard`。
- 生产环境必须使用 HTTPS。

若普通邮箱登录可用而 OAuth 不可用，通常是 provider callback 或 Supabase redirect allow list 不一致。

## 4. 登录后设置被重置

Paper/Live Mode、语言、风险档位、持有周期、AI 权限和自动化开关使用账户级持久化。若未恢复：

1. 确认三份 Supabase SQL 已全部应用。
2. 确认后端拥有有效的 `SUPABASE_SERVICE_ROLE_KEY`。
3. 打开 System Health，区分 configured、verified 和 online；仅 configured 不代表数据库写入成功。
4. 检查浏览器是否登录了同一个 Supabase 用户。
5. 若出现 409，表示另一个页面或设备保存了更新版本；刷新后重新选择，不要覆盖较新的状态。

## 5. Market Scanner 很慢、超时或内存上涨

大规模扫描需要下载和计算大量行情。建议：

- 先用较小 Scan Cap 验证连接和筛选条件。
- Render Pro 使用一个 Gunicorn worker、四个线程，并保留当前重任务并发限制。
- 不要增加 web worker；内置 scheduler 和 managed-position guard 需要单一 owner。
- 同一账户不要在多个页面重复启动相同扫描。
- 保留 Supabase 中的结果和摘要，不要在进程内长期缓存完整原始行情。

推荐生产启动命令：

```bash
MALLOC_ARENA_MAX=2 gunicorn start_quant_backend:app \
  --bind 0.0.0.0:$PORT \
  --workers 1 \
  --threads 4 \
  --timeout 900
```

如果 Render 重启或返回 502/503，先查看是否发生 OOM、启动缺少必需变量，或外部行情请求超时。

## 6. Activity 或 Dashboard 刷新 30 秒后超时

- 先访问 `/api/health`，确认不是整个后端离线。
- System Health 中 saved/configured 不能替代实际 verification。
- 检查 Supabase、Alpaca 和行情源最近 24 小时日志。
- 不要通过延长前端超时掩盖后端阻塞；优先缩小查询、使用持久化摘要并限制外部请求。
- 页面会尽量保留最后一次可用数据；刷新失败不应把已有投资组合清空。

## 7. Discord 测试语言不正确

Discord 测试和支持的推荐、买卖、风险、阻断及 pipeline 消息会读取账户保存的语言。

1. 在网站切换语言，等待保存完成。
2. 再点击 Discord test。
3. 若仍不一致，检查 Settings 的语言保存请求是否成功，以及当前页面是否登录同一账户。

外部 provider 返回的自由文本可能保留原始语言，但 AlphaLab 自己生成的通知标题、字段和状态应跟随网站语言。

## 8. Safety Center 无法暂停或恢复新开仓

- 503：durable operations store 不可用；生产环境会 fail closed，不能用本地 JSON 绕过。
- 409：状态版本已经变化；刷新 Safety Center 后重新操作。
- MFA/AAL2 提示：完成 `/mfa` challenge 后再执行高风险设置或真实新开仓。
- 暂停新开仓只阻止新的真实 BUY，并可选取消 AlphaLab 管理的待成交 entry BUY；保护性 SELL、stop 和 OCO 不会被删除。

## 9. 前端依赖或构建失败

在 `frontend` 目录执行：

```bash
npm ci
npx tsc --noEmit
npx eslint src --ext .js,.jsx,.ts,.tsx --max-warnings=0
npm run build
```

不要运行 `npm audit fix --force`。Create React App 的强制建议会安装无效或破坏性的 `react-scripts@0.0.0`。当前 CI 会阻止高危和严重依赖问题；低/中等级的旧构建链提示应通过计划中的构建工具迁移处理。

## 10. 后端依赖或测试失败

在 `backend` 目录重建独立虚拟环境：

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
python -m pytest -q
```

Windows PowerShell 使用 `.venv\Scripts\Activate.ps1`。

## 11. 生产环境启动失败

生产环境必须配置：

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `FERNET_KEY`
- `APP_SECRET_KEY`
- `FRONTEND_ORIGIN` 或精确的 `CORS_ORIGINS`
- `FLASK_ENV=production`

缺少其中的安全关键项时，后端会拒绝以不安全配置启动。不要把开发 fallback 打开来绕过生产校验。

## 12. 提交或发布前

```bash
git diff --check
```

并确认：

- `.env`、构建产物、运行时 JSON 和调试记录没有进入 Git。
- `.gitleaks.toml` 与 CI workflow 一起提交。
- 任何曾经进入 Git 历史的真实密钥都已经先在 provider 端吊销并轮换。
- Cloudflare、Render、Supabase Auth、OAuth、Turnstile 和 SMTP 的外部设置与 [DEPLOYMENT.md](../DEPLOYMENT.md) 一致。

仍无法定位时，请提供：页面 URL、发生时间、HTTP 状态码、后端日志中的 request id，以及是否为 Paper/Live；不要发送密码、API key、token 或完整 Authorization header。
