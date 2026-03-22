"""
验证quote接口修复
"""

import requests
import json

def verify_quote_fix():
    """验证quote接口修复"""
    print("="*80)
    print("验证quote接口修复")
    print("="*80)
    
    base_url = "http://localhost:8889"
    symbol = "AAPL"
    
    # 测试修复后的接口
    print("\n1. 测试修复后的接口调用:")
    endpoints = [
        f"/api/market/stock/{symbol}",  # 修复后前端应该调用的接口
        f"/api/stock/quote?symbol={symbol}",  # 原来的错误接口（应该不再调用）
    ]
    
    for endpoint in endpoints:
        print(f"\n测试接口: {endpoint}")
        try:
            response = requests.get(f"{base_url}{endpoint}", timeout=5)
            print(f"  状态码: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                print(f"  接口可用")
                
                # 检查价格字段
                price_fields = ['price', 'c', 'pc', 'close', 'currentPrice']
                found_prices = []
                for field in price_fields:
                    if field in data:
                        found_prices.append(f"{field}: {data[field]}")
                
                if found_prices:
                    print(f"  找到价格字段: {', '.join(found_prices)}")
                else:
                    print(f"  未找到标准价格字段，数据: {json.dumps(data, indent=2)[:200]}")
            else:
                print(f"  响应: {response.text[:200]}")
                
        except Exception as e:
            print(f"  请求失败: {e}")
    
    # 检查前端代码修改
    print("\n" + "="*80)
    print("检查前端代码修改")
    print("="*80)
    
    try:
        with open('../frontend/src/pages/SymbolAnalysis.tsx', 'r', encoding='utf-8') as f:
            content = f.read()
        
        # 检查修改
        old_pattern = "/api/stock/quote?symbol="
        new_pattern = "/api/market/stock/"
        
        if old_pattern in content:
            print(f"  ❌ 前端仍然包含旧接口: {old_pattern}")
        else:
            print(f"  ✅ 前端已移除旧接口")
        
        if new_pattern in content:
            print(f"  ✅ 前端已使用新接口: {new_pattern}")
            
            # 查找具体代码
            lines = content.split('\n')
            for i, line in enumerate(lines):
                if new_pattern in line:
                    print(f"    第{i+1}行: {line.strip()}")
        else:
            print(f"  ❌ 前端未使用新接口")
        
        # 检查字段处理
        price_field_check = "data.price || data.c || data.pc || data.close"
        if price_field_check in content:
            print(f"  ✅ 前端正确处理价格字段: {price_field_check}")
        else:
            print(f"  ❌ 前端价格字段处理可能有问题")
        
    except Exception as e:
        print(f"检查前端代码失败: {e}")
    
    # 模拟1 Week场景
    print("\n" + "="*80)
    print("模拟1 Week补16:00数据场景")
    print("="*80)
    
    print("场景: 1 Week图表需要补充今天16:00收盘价")
    print("步骤:")
    print("  1. 前端调用 fetchFinnhubClosingPrice('AAPL')")
    print("  2. 前端请求 /api/market/stock/AAPL")
    print("  3. 后端返回包含price字段的数据")
    print("  4. 前端提取price字段作为收盘价")
    print("  5. 补充到1 Week数据中")
    
    # 测试实际数据获取
    print("\n实际数据获取测试:")
    try:
        response = requests.get(f"{base_url}/api/market/stock/{symbol}", timeout=5)
        if response.status_code == 200:
            data = response.json()
            price = data.get('price')
            if price:
                print(f"  ✅ 成功获取收盘价: {price}")
                print(f"  ✅ 可用于补充1 Week 16:00数据点")
            else:
                print(f"  ❌ 未找到price字段，数据: {data}")
        else:
            print(f"  ❌ 接口请求失败: {response.status_code}")
    except Exception as e:
        print(f"  ❌ 测试失败: {e}")

if __name__ == '__main__':
    verify_quote_fix()