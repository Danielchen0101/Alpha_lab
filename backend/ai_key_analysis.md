# AI Key 来源分析报告

## 当前AI key实际来源完整链路

### 1. 前端AI Configuration页面保存位置
**保存到后端接口，不是localStorage或state**

前端代码 (`frontend/src/services/aiTradingService.ts`):
```typescript
async saveProviderConfig(config: AIProviderConfig): Promise<AIProviderConfigResponse> {
  try {
    console.log('saveProviderConfig 调用，参数:', config);
    const response = await api.post('/ai/provider/config', config);  // ← 发送到后端
    console.log('Save provider config response:', response.data);
    return {
      success: response.data.success,
      message: response.data.message,
      config: config
    };
  } catch (error) {
    console.error('保存AI配置失败:', error);
    return {
      success: false,
      message: '保存AI配置失败',
      config: config
    };
  }
}
```

### 2. 前端发起scanner/AI analyze请求时key传递
**没有传递用户key，使用后端保存的状态**

前端扫描器代码 (`frontend/src/pages/Portfolio.tsx`):
```typescript
// 调用AI分析时，只传递symbol，不传递API key
const response = await scannerApi.post('/ai/analyze/single', {
  symbol: symbol
});
```

### 3. 后端DeepSeek key最终读取来源
**从`ai_provider_config_state`读取，该状态有多个来源**

后端代码 (`backend/start_quant_backend.py`):

#### 初始硬编码值 (第181-188行):
```python
ai_provider_config_state = {
    'provider': 'DeepSeek',
    'apiKey': 'sk-83365246617844178bf8d1e121b7279f',  # 硬编码API密钥用于测试
    'baseURL': 'https://api.deepseek.com',
    'model': 'deepseek-chat'
}
```

#### 从配置文件加载 (第217-239行):
```python
def load_ai_config_from_file():
    """从文件加载AI配置"""
    try:
        if os.path.exists(AI_CONFIG_FILE):
            with open(AI_CONFIG_FILE, 'r', encoding='utf-8') as f:
                saved_config = json.load(f)
            
            # 更新内存状态
            for key in ['provider', 'apiKey', 'baseURL', 'baseUrl', 'model']:
                if key in saved_config:
                    ai_provider_config_state[key] = saved_config[key]
```

#### 从用户POST请求更新 (第4715-4731行):
```python
# POST 方法 - 保存配置
if 'provider' in data:
    ai_provider_config_state['provider'] = data['provider']
if 'apiKey' in data:
    ai_provider_config_state['apiKey'] = data['apiKey']  # ← 用户输入的key
if 'baseUrl' in data:
    ai_provider_config_state['baseURL'] = data['baseUrl']
if 'model' in data:
    ai_provider_config_state['model'] = data['model']
```

#### AI分析时读取key (第7132行):
```python
# 检查是否有有效的 API 密钥
api_key = ai_provider_config_state.get('apiKey', '')
```

### 4. 当前优先级顺序
**实际执行顺序:**

1. **启动时**: 加载硬编码值 `sk-83365246617844178bf8d1e121b7279f`
2. **启动后**: 尝试从`ai_provider_config.json`文件加载，覆盖硬编码值
3. **用户配置后**: 通过`/api/ai/provider/config` POST请求更新内存状态
4. **AI调用时**: 从`ai_provider_config_state`读取当前值

**问题**: 如果用户从未保存过配置，或者配置文件不存在，则使用硬编码的无效key。

### 5. 明确回答用户问题

#### Q: 现在到底是不是还在用内置key？
**A: 是的，在以下情况使用内置key:**
1. 后端首次启动时（硬编码值）
2. 用户从未在AI Configuration页面保存过配置时
3. `ai_provider_config.json`文件不存在或读取失败时

#### Q: 用户在AI Configuration输入的key现在到底有没有真正参与AI调用？
**A: 有参与，但存在优先级问题:**
1. **用户保存后**: 参与AI调用（覆盖硬编码值）
2. **用户未保存**: 不参与，使用硬编码值
3. **后端重启后**: 如果配置文件存在，使用配置文件中的值；否则回退到硬编码值

### 6. 关键发现

#### 硬编码fallback逻辑 (第4681-4686行):
```python
# 返回硬编码的配置，确保API密钥不为空
config_to_return = dict(ai_provider_config_state)
if not config_to_return.get('apiKey'):
    config_to_return['apiKey'] = 'sk-83365246617844178bf8d1e121b7279f'  # ← 硬编码fallback
```

#### GET请求时返回硬编码key (第4680-4690行):
即使内存中没有apiKey，GET `/api/ai/provider/config`也会返回硬编码值，给前端造成"有配置"的假象。

#### 真正的AI调用key来源 (第7132行):
```python
api_key = ai_provider_config_state.get('apiKey', '')  # ← 可能为空字符串
```

## 总结

**当前系统的问题:**
1. **硬编码无效key作为默认值**
2. **GET配置接口伪装有key**（返回硬编码值）
3. **用户不配置也能"正常工作"**（使用无效key，返回401）
4. **错误处理不透明**（401错误被静默处理）

**需要修复的方向:**
1. 移除所有硬编码API key
2. 强制要求用户配置
3. 明确返回配置缺失错误
4. 禁止使用默认/fallback key