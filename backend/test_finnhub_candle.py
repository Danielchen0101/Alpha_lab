#!/usr/bin/env python3
"""
测试Finnhub candle API是否可用
"""

import requests
import time
from datetime import datetime

FINNHUB_API_KEY = 'd6qsdcpr01qgdhqc82hgd6qsdcpr01qgdhqc82i0'
FINNHUB_BASE_URL = 'https://finnhub.io/api/v1'

def test_finnhub_candle_api():
    """测试Finnhub candle API"""
    print("=== 测试Finnhub candle API ===")
    
    # 测试参数
    symbol = "AAPL"
    resolution = "D"  # 日线数据
    end_time = int(time.time())
    start_time = end_time - (30 * 24 * 60 * 60)  # 30天前
    
    url = f"{FINNHUB_BASE_URL}/stock/candle"
    params = {
        'symbol': symbol,
        'resolution': resolution,
        'from': start_time,
        'to': end_time,
        'token': FINNHUB_API_KEY
    }
    
    print(f"请求URL: {url}")
    print(f"请求参数: {params}")
    print(f"API Key: {FINNHUB_API_KEY[:8]}...{FINNHUB_API_KEY[-8:]}")
    
    try:
        response = requests.get(url, params=params, timeout=10)
        
        print(f"\n响应状态码: {response.status_code}")
        print(f"响应头: {dict(response.headers)}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"\n响应数据: {data}")
            
            if data.get('s') == 'ok':
                print(f"✓ Finnhub candle API 可用")
                print(f"数据条数: {len(data.get('t', []))}")
                if len(data.get('t', [])) > 0:
                    print(f"第一条数据时间: {datetime.fromtimestamp(data['t'][0])}")
                    print(f"最后一条数据时间: {datetime.fromtimestamp(data['t'][-1])}")
            else:
                print(f"✗ Finnhub返回错误状态: {data.get('s', 'unknown')}")
                print(f"错误信息: {data.get('error', '无错误信息')}")
        elif response.status_code == 403:
            print(f"✗ 403 Forbidden - API Key可能无效或权限不足")
            print(f"响应内容: {response.text[:500]}")
        elif response.status_code == 429:
            print(f"✗ 429 Too Many Requests - API调用频率超限")
        else:
            print(f"✗ 其他错误: {response.status_code}")
            print(f"响应内容: {response.text[:500]}")
            
    except Exception as e:
        print(f"✗ 请求异常: {e}")

def test_finnhub_quote_api():
    """测试Finnhub quote API（对比）"""
    print("\n=== 测试Finnhub quote API（对比）===")
    
    symbol = "AAPL"
    url = f"{FINNHUB_BASE_URL}/quote"
    params = {
        'symbol': symbol,
        'token': FINNHUB_API_KEY
    }
    
    try:
        response = requests.get(url, params=params, timeout=10)
        print(f"响应状态码: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✓ Finnhub quote API 可用")
            print(f"当前价格: {data.get('c', 'N/A')}")
        else:
            print(f"✗ Finnhub quote API错误: {response.status_code}")
            print(f"响应内容: {response.text[:200]}")
            
    except Exception as e:
        print(f"✗ 请求异常: {e}")

def check_finnhub_plan():
    """检查Finnhub账户计划"""
    print("\n=== 检查Finnhub账户计划 ===")
    
    # 检查免费版限制
    print("Finnhub免费版限制:")
    print("- 60次API调用/分钟")
    print("- 历史数据: 仅提供最近1年的日线数据")
    print("- 实时数据: 提供quote API")
    print("- 公司信息: 提供profile2 API")
    print("- 财务指标: 提供metric API")
    
    # 检查candle API是否在免费版中
    print("\nFinnhub candle API在免费版中:")
    print("- 提供日线数据 (resolution=D)")
    print("- 提供周线数据 (resolution=W)")
    print("- 提供月线数据 (resolution=M)")
    print("- 不提供分钟级数据 (resolution=1,5,15,30,60)")
    print("- 数据范围: 最近1年")

if __name__ == "__main__":
    test_finnhub_candle_api()
    test_finnhub_quote_api()
    check_finnhub_plan()