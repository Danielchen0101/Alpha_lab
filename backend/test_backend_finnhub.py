import requests
import json

print("测试后端Finnhub集成...")

# 重启后端
import os
os.system("taskkill /F /IM python.exe 2>nul")

# 启动后端
import subprocess
import time

print("启动后端...")
proc = subprocess.Popen(["py", "quant_backend.py"], 
                       stdout=subprocess.PIPE, 
                       stderr=subprocess.PIPE,
                       creationflags=subprocess.CREATE_NO_WINDOW)

time.sleep(5)

try:
    # 测试 /api/market/stocks
    print("\n1. 测试 /api/market/stocks (使用Finnhub):")
    response = requests.get("http://127.0.0.1:8889/api/market/stocks", timeout=10)
    
    if response.status_code == 200:
        data = response.json()
        print(f"   状态: {response.status_code}")
        print(f"   数据源: {data.get('source')}")
        print(f"   股票数量: {data.get('count')}")
        
        stocks = data.get('stocks', [])
        if stocks:
            first_stock = stocks[0]
            print(f"\n   第一个股票数据:")
            print(f"     symbol: {first_stock.get('symbol')}")
            print(f"     name: {first_stock.get('name')}")
            print(f"     price: {first_stock.get('price')}")
            print(f"     change: {first_stock.get('change')}")
            print(f"     changePercent: {first_stock.get('changePercent')}")
            print(f"     previousClose: {first_stock.get('previousClose')}")
            print(f"     volume: {first_stock.get('volume')}")
            print(f"     marketCap: {first_stock.get('marketCap')}")
            print(f"     sector: {first_stock.get('sector')}")
            print(f"     dataSource: {first_stock.get('dataSource')}")
            
            # 检查关键字段
            print(f"\n   Dashboard需求检查:")
            checks = [
                ("实时价格", first_stock.get('price') is not None),
                ("涨跌幅", first_stock.get('changePercent') is not None),
                ("成交量", first_stock.get('volume') is not None),
                ("市值", first_stock.get('marketCap') is not None),
                ("行业", first_stock.get('sector') is not None),
                ("数据源是Finnhub", "finnhub" in first_stock.get('dataSource', '').lower())
            ]
            
            for check_name, check_result in checks:
                status = "PASS" if check_result else "FAIL"
                print(f"     {check_name}: {status}")
    else:
        print(f"   错误: {response.status_code}")
        print(f"   响应: {response.text[:200]}")
        
except Exception as e:
    print(f"   测试失败: {e}")

finally:
    # 清理
    proc.terminate()
    print("\n测试完成")