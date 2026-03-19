import requests
import json

print("=== 测试语义修复后的后端API ===")

# 重启后端
import subprocess
import time
import os

print("重启后端服务...")
os.system("taskkill /F /IM python.exe 2>nul")
os.system("taskkill /F /IM py.exe 2>nul")

# 启动后端
backend_process = subprocess.Popen(
    ["py", "start_backend.py"],
    cwd=r"C:\Users\kexuc\.openclaw\workspace\professional_quant_platform\backend",
    stdout=subprocess.PIPE,
    stderr=subprocess.PIPE,
    creationflags=subprocess.CREATE_NO_WINDOW
)

print("等待后端启动...")
time.sleep(5)

# 测试股票列表API
print("\n1. 测试 /api/market/stocks:")
try:
    response = requests.get("http://127.0.0.1:8889/api/market/stocks", timeout=10)
    print(f"   状态: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print(f"   股票数量: {data.get('count')}")
        print(f"   数据源: {data.get('source')}")
        print(f"   消息: {data.get('message')}")
        
        stocks = data.get('stocks', [])
        if stocks:
            print(f"\n   第一个股票数据 (AAPL):")
            first_stock = stocks[0]
            
            # 分组显示字段
            print(f"\n   [基本信息]:")
            print(f"     symbol: {first_stock.get('symbol')}")
            print(f"     name: {first_stock.get('name')}")
            print(f"     dataSource: {first_stock.get('dataSource')}")
            
            print(f"\n   [价格信息]:")
            print(f"     price: {first_stock.get('price')} (注意: 这是前收盘价)")
            print(f"     priceType: {first_stock.get('priceType')}")
            print(f"     previousClose: {first_stock.get('previousClose')}")
            print(f"     change: {first_stock.get('change')}")
            print(f"     changePercent: {first_stock.get('changePercent')}")
            
            print(f"\n   [数据状态]:")
            print(f"     pricingMode: {first_stock.get('pricingMode')}")
            print(f"     realtimeAvailable: {first_stock.get('realtimeAvailable')}")
            print(f"     changeDataAvailable: {first_stock.get('changeDataAvailable')}")
            
            print(f"\n   [其他数据]:")
            print(f"     volume: {first_stock.get('volume')}")
            print(f"     marketCap: {first_stock.get('marketCap')}")
            print(f"     sector: {first_stock.get('sector')}")
            
            print(f"\n   语义正确性检查:")
            checks = [
                ("price 和 previousClose 应该相同", 
                 first_stock.get('price') == first_stock.get('previousClose')),
                ("change 应该是 null", 
                 first_stock.get('change') is None),
                ("changePercent 应该是 null", 
                 first_stock.get('changePercent') is None),
                ("priceType 应该是 'previous_close'", 
                 first_stock.get('priceType') == 'previous_close'),
                ("realtimeAvailable 应该是 False", 
                 first_stock.get('realtimeAvailable') == False),
                ("sector 应该是 null", 
                 first_stock.get('sector') is None)
            ]
            
            for check_name, check_result in checks:
                status = "✅ 正确" if check_result else "❌ 错误"
                print(f"     {check_name}: {status}")
                
    else:
        print(f"   响应: {response.text[:200]}")
except Exception as e:
    print(f"   错误: {e}")

# 清理
backend_process.terminate()

print("\n=== 测试完成 ===")