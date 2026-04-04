# Alpaca Paper Trading 真实验证指南

## 当前状态分析

### 1. 代码架构 ✅ 已完成
- 双模式架构：LOCAL 和 ALPACA_PAPER
- 统一的 broker 接口：`IBrokerService`
- 正确的 Alpaca API 配置：
  - Base URL: `https://paper-api.alpaca.markets`
  - 认证头：`APCA-API-KEY-ID` 和 `APCA-API-SECRET-KEY`
  - 使用官方 v2 API 端点

### 2. 环境变量配置 ⚠️ 需要用户配置
当前 `.env.local` 文件：
```bash
# 默认使用本地模式
REACT_APP_BROKER_MODE=LOCAL

# Alpaca Paper Trading API 配置（需要时启用）
# REACT_APP_APCA_API_KEY_ID=your_paper_api_key_id_here
# REACT_APP_APCA_API_SECRET_KEY=your_paper_api_secret_key_here
# REACT_APP_APCA_API_BASE_URL=https://paper-api.alpaca.markets
```

### 3. 安全风险 ⚠️ 需要注意
- **前端直连**：API 密钥会暴露在客户端
- **CORS 限制**：Alpaca API 可能限制跨域请求
- **建议方案**：通过后端代理转发请求

## 真实验证步骤

### 步骤 1：获取 Alpaca Paper 凭证
1. 访问：https://app.alpaca.markets/paper/dashboard/overview
2. 注册/登录 Alpaca Paper 账户
3. 在 Dashboard 中找到 API Keys
4. 生成或复制：
   - API Key ID
   - Secret Key

### 步骤 2：配置环境变量
编辑 `frontend/.env.local` 文件：
```bash
# 切换到 Alpaca Paper 模式
REACT_APP_BROKER_MODE=ALPACA_PAPER

# 配置真实的 Alpaca Paper 凭证
REACT_APP_APCA_API_KEY_ID=your_real_paper_api_key_id
REACT_APP_APCA_API_SECRET_KEY=your_real_paper_api_secret_key
REACT_APP_APCA_API_BASE_URL=https://paper-api.alpaca.markets
```

### 步骤 3：重启开发服务器
```bash
cd frontend
npm start
```

### 步骤 4：在浏览器中测试
1. 访问：http://localhost:3000/portfolio
2. 找到 "Broker Mode Test" 面板
3. 确认当前模式显示 "ALPACA PAPER MODE"
4. 依次点击测试按钮：
   - "Test Get Account"
   - "Test Get Positions"
   - "Test Get Orders"

## 预期结果

### 成功情况 ✅
如果配置正确，应该看到：

#### 1. `getAccount()` 成功返回
```json
{
  "id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "account_number": "PAPER-XXXXXX",
  "status": "ACTIVE",
  "currency": "USD",
  "cash": 100000.00,
  "portfolio_value": 100000.00,
  "buying_power": 100000.00,
  "equity": 100000.00,
  "last_equity": 100000.00,
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-01T00:00:00Z"
}
```

#### 2. `getPositions()` 成功返回
```json
[
  {
    "asset_id": "b0b6dd9d-8b9b-48a9-ba46-b9d54906e415",
    "symbol": "AAPL",
    "exchange": "NASDAQ",
    "asset_class": "us_equity",
    "avg_entry_price": 175.50,
    "qty": 10,
    "side": "long",
    "market_value": 1760.00,
    "cost_basis": 1755.00,
    "unrealized_pl": 5.00,
    "unrealized_plpc": 0.28,
    "current_price": 176.00,
    "lastday_price": 175.00,
    "change_today": 0.57
  }
]
```

#### 3. `getOrders()` 成功返回
```json
[
  {
    "id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "client_order_id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z",
    "submitted_at": "2024-01-01T00:00:00Z",
    "filled_at": null,
    "expired_at": null,
    "canceled_at": null,
    "failed_at": null,
    "replaced_at": null,
    "replaced_by": null,
    "replaces": null,
    "asset_id": "b0b6dd9d-8b9b-48a9-ba46-b9d54906e415",
    "symbol": "AAPL",
    "asset_class": "us_equity",
    "qty": 10,
    "filled_qty": 0,
    "filled_avg_price": null,
    "order_type": "market",
    "type": "market",
    "side": "buy",
    "time_in_force": "day",
    "limit_price": null,
    "stop_price": null,
    "status": "new",
    "extended_hours": false,
    "legs": null,
    "trail_percent": null,
    "trail_price": null,
    "hwm": null
  }
]
```

### 失败情况 ❌

#### 1. 401/403 认证失败
**表现**：请求返回 401 或 403 状态码
**原因**：
- API 密钥错误
- 密钥已失效
- 账户被禁用

**解决方案**：
- 检查密钥是否正确
- 重新生成密钥
- 确认账户状态

#### 2. CORS 错误
**表现**：浏览器控制台显示 CORS 错误
**原因**：Alpaca API 限制跨域请求
**解决方案**：
- 通过后端代理转发请求
- 配置 CORS 代理服务器

#### 3. 网络错误
**表现**：网络连接失败
**原因**：
- 网络问题
- Alpaca API 服务不可用
**解决方案**：
- 检查网络连接
- 等待服务恢复

#### 4. 环境变量未读取
**表现**：`Alpaca API credentials are not configured` 错误
**原因**：环境变量未正确加载
**解决方案**：
- 确认 `.env.local` 文件存在
- 重启开发服务器
- 检查变量名是否正确

## 验证结论

### 当前验证状态
- **代码架构**：✅ 已完成
- **API 配置**：✅ 正确
- **环境变量**：⚠️ 需要用户配置
- **真实连接**：❌ 待测试（需要真实凭证）

### 是否可以进入 placeOrder()
**条件**：需要先完成以下验证：

1. ✅ `getAccount()` 能成功读取账户信息
2. ✅ `getPositions()` 能成功读取持仓
3. ✅ `getOrders()` 能成功读取订单
4. ✅ 确认 CORS 问题已解决（或通过代理）

**建议**：
1. 先配置真实 Alpaca Paper 凭证
2. 验证只读接口能正常工作
3. 如果遇到 CORS 问题，先实现后端代理
4. 然后才能安全地接入 `placeOrder()`

## 下一步行动

### 立即行动
1. 获取 Alpaca Paper 凭证
2. 配置到 `.env.local`
3. 测试真实连接

### 备用方案（如果遇到 CORS）
1. 创建后端代理服务
2. 修改前端调用后端代理
3. 后端代理转发到 Alpaca API

### 长期建议
1. 实现完整的后端代理
2. 添加 API 密钥轮换机制
3. 实现请求限流和错误处理
4. 添加监控和日志

---

**总结**：Alpaca Paper Trading 只读接口的代码架构已经完成，但需要配置真实凭证并进行真实验证。验证通过后，可以安全地进入 `placeOrder()` 的实现。