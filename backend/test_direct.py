#!/usr/bin/env python3
"""
直接测试代码逻辑
"""

# 模拟请求环境
class MockRequest:
    def __init__(self):
        self.args = {'dashboard': 'true'}

# 导入并测试
import start_quant_backend

# 创建模拟请求
request = MockRequest()

# 测试get_market_stocks函数逻辑
print("测试get_market_stocks函数逻辑")
print("=" * 60)

# 模拟函数调用
symbols_param = ''
dashboard = request.args.get('dashboard', 'false').lower() == 'true'

if symbols_param:
    symbols = [s.strip().upper() for s in symbols_param.split(',') if s.strip()]
else:
    symbols = start_quant_backend.POPULAR_STOCKS[:12]

print(f"symbols_param: '{symbols_param}'")
print(f"dashboard: {dashboard}")
print(f"symbols数量: {len(symbols)}")
print(f"symbols列表: {symbols}")

# 验证
if len(symbols) == 12:
    print("\n✅ 代码逻辑正确: 默认返回12支股票")
    print(f"   前12支股票: {symbols}")
elif len(symbols) == 8:
    print("\n❌ 代码逻辑错误: 仍然返回8支股票")
    print(f"   检查POPULAR_STOCKS[:12]的值: {start_quant_backend.POPULAR_STOCKS[:12]}")
else:
    print(f"\n⚠️  异常: 返回{symbols}支股票")