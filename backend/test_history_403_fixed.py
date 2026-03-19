import requests
import json
import time
from datetime import datetime
import sys

# 设置UTF-8编码
sys.stdout.reconfigure(encoding='utf-8')

# Finnhub配置
FINNHUB_API_KEY = 'd6qsdcpr01qgdhqc82hgd6qsdcpr01qgdhqc82i0'
FINNHUB_BASE_URL = 'https://finnhub.io/api/v1'

def test_finnhub_candle_api_directly():
    """直接测试Finnhub candle API，检查403错误"""
    print("=== 直接测试Finnhub candle API ===")
    print("=" * 60)
    
    symbol = "AAPL"
    resolution = "D"  # 日线数据
    end_time = int(time.time())
    start_time = end_time - (30 * 24 * 60 * 60)  # 30天前
    
    url = f"{FINNHUB_BASE_URL}/stock/candle"
    params = {
        'symbol': symbol.upper(),
        'resolution': resolution,
        'from': start_time,
        'to': end_time,
        'token': FINNHUB_API_KEY
    }
    
    print(f"测试参数:")
    print(f"  URL: {url}")
    print(f"  Symbol: {symbol}")
    print(f"  Resolution: {resolution}")
    print(f"  From: {start_time} ({datetime.fromtimestamp(start_time)})")
    print(f"  To: {end_time} ({datetime.fromtimestamp(end_time)})")
    print(f"  Token: {FINNHUB_API_KEY[:8]}...{FINNHUB_API_KEY[-4:]}")
    print()
    
    try:
        response = requests.get(url, params=params, timeout=10)
        
        print(f"响应状态码: {response.status_code}")
        print(f"响应头:")
        for key, value in response.headers.items():
            if key.lower() in ['content-type', 'content-length', 'x-ratelimit-remaining', 'x-ratelimit-used']:
                print(f"  {key}: {value}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"响应状态: {data.get('s', 'unknown')}")
            print(f"数据条数: {len(data.get('t', []))}")
            
            if data.get('s') == 'ok':
                print("✅ Finnhub API调用成功")
            else:
                print(f"⚠️ Finnhub返回错误状态: {data.get('s')}")
                
        elif response.status_code == 403:
            print("❌ Finnhub返回403 Forbidden")
            print(f"响应内容: {response.text}")
            
            # 检查响应内容
            try:
                error_data = response.json()
                print(f"错误JSON: {json.dumps(error_data, indent=2)}")
            except:
                pass
                
        else:
            print(f"响应内容: {response.text}")
            
    except Exception as e:
        print(f"请求异常: {e}")

def test_backend_history_api():
    """测试后端历史数据接口"""
    print("\n=== 测试后端历史数据接口 ===")
    print("=" * 60)
    
    symbol = "AAPL"
    interval = "1day"
    range_param = "1month"
    
    url = f"http://127.0.0.1:8889/api/market/history/{symbol}"
    params = {
        'interval': interval,
        'range': range_param
    }
    
    print(f"测试参数:")
    print(f"  URL: {url}")
    print(f"  Symbol: {symbol}")
    print(f"  Interval: {interval}")
    print(f"  Range: {range_param}")
    print()
    
    try:
        response = requests.get(url, params=params, timeout=15)
        
        print(f"响应状态码: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"数据源: {data.get('dataSource', 'unknown')}")
            print(f"数据条数: {data.get('count', 0)}")
            
            if data.get('error'):
                print(f"错误信息: {data.get('error')}")
                
            print("✅ 后端接口调用成功")
            
        elif response.status_code == 403:
            print("❌ 后端返回403 Forbidden")
            print(f"响应内容: {response.text}")
            
            # 检查响应内容
            try:
                data = json.loads(response.text) if response.text else {}
                print(f"解析后的错误信息: {json.dumps(data, indent=2)}")
            except:
                pass
                
        else:
            print(f"响应内容: {response.text}")
            
    except Exception as e:
        print(f"请求异常: {e}")

def test_finnhub_quote_api():
    """测试Finnhub quote API，确认API密钥有效"""
    print("\n=== 测试Finnhub quote API ===")
    print("=" * 60)
    
    symbol = "AAPL"
    
    url = f"{FINNHUB_BASE_URL}/quote"
    params = {
        'symbol': symbol.upper(),
        'token': FINNHUB_API_KEY
    }
    
    print(f"测试参数:")
    print(f"  URL: {url}")
    print(f"  Symbol: {symbol}")
    print(f"  Token: {FINNHUB_API_KEY[:8]}...{FINNHUB_API_KEY[-4:]}")
    print()
    
    try:
        response = requests.get(url, params=params, timeout=10)
        
        print(f"响应状态码: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"当前价格: {data.get('c')}")
            print(f"涨跌额: {data.get('d')}")
            print(f"涨跌幅: {data.get('dp')}%")
            print("✅ Finnhub quote API调用成功")
            
        elif response.status_code == 403:
            print("❌ Finnhub quote API返回403 Forbidden")
            print(f"响应内容: {response.text}")
            
        else:
            print(f"响应内容: {response.text}")
            
    except Exception as e:
        print(f"请求异常: {e}")

if __name__ == "__main__":
    print("开始测试历史数据接口403错误...")
    print()
    
    # 测试1: 测试quote API确认密钥有效
    test_finnhub_quote_api()
    
    # 测试2: 直接调用Finnhub candle API
    test_finnhub_candle_api_directly()
    
    # 测试3: 测试后端接口
    test_backend_history_api()
    
    print("\n" + "=" * 60)
    print("测试完成")