#!/usr/bin/env python3
"""
调试代码状态
"""

import start_quant_backend

# 检查POPULAR_STOCKS
print(f"POPULAR_STOCKS长度: {len(start_quant_backend.POPULAR_STOCKS)}")
print(f"POPULAR_STOCKS前12个: {start_quant_backend.POPULAR_STOCKS[:12]}")

# 检查get_market_stocks函数
import inspect
source = inspect.getsource(start_quant_backend.get_market_stocks)
lines = source.split('\n')

# 查找symbols = POPULAR_STOCKS[:12]这一行
for i, line in enumerate(lines):
    if 'POPULAR_STOCKS[:12]' in line:
        print(f"\n找到代码行 {i+1}: {line.strip()}")
        # 显示上下文
        for j in range(max(0, i-2), min(len(lines), i+3)):
            print(f"{j+1:3d}: {lines[j]}")
        break
else:
    print("\n未找到POPULAR_STOCKS[:12]代码")
    
# 检查是否有其他限制
print("\n检查其他可能限制股票数量的代码:")
for i, line in enumerate(lines):
    if '8' in line and ('symbols' in line.lower() or 'pop' in line.lower()):
        print(f"行 {i+1}: {line.strip()}")