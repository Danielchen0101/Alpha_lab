#!/usr/bin/env python3
"""
直接测试Polygon API调用
"""

import os
import sys
import requests
from datetime import datetime, timedelta

# 添加项目路径
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from config import POLYGON_API_KEY, POLYGON_BASE_URL, TIMEFRAME_MAP

def test_polygon_api():
    """直接测试Polygon API"""
    
    print("=== 测试Polygon API ===")
    print(f"1. API密钥: {'已设置' if POLYGON_API_KEY else '未设置'}")
    if POLYGON_API_KEY:
        print(f"   - 密钥前10位: {POLYGON_API_KEY[:10]}...")
    print(f"2. 基础URL: {POLYGON_BASE_URL}")
    
    if not POLYGON_API_KEY:
        print("错误: POLYGON_API_KEY 未配置")
        return
    
    # 测试1D timeframe
    symbol = "AAPL"
    timeframe = "1D"
    
    print(f"\n3. 测试timeframe: {timeframe}")
    config = TIMEFRAME_MAP.get(timeframe, TIMEFRAME_MAP["1M"])
    print(f"   - 配置: {config}")
    
    multiplier = config["multiplier"]
    timespan = config["timespan"]
    limit = config["limit"]
    
    # 计算日期范围
    end_date = datetime.now()
    start_date = end_date - timedelta(days=limit * 2)
    
    from_date = start_date.strftime("%Y-%m-%d")
    to_date = end_date.strftime("%Y-%m-%d")
    
    print(f"   - 日期范围: {from_date} 到 {to_date}")
    print(f"   - 期望数据点: {limit}")
    
    # 构建URL
    endpoint = f"/v2/aggs/ticker/{symbol.upper()}/range/{multiplier}/{timespan}/{from_date}/{to_date}"
    url = f"{POLYGON_BASE_URL}{endpoint}"
    
    params = {
        "apiKey": POLYGON_API_KEY,
        "adjusted": "true",
        "sort": "asc",
        "limit": limit
    }
    
    print(f"\n4. 发送请求:")
    print(f"   - URL: {url}")
    print(f"   - 参数: {params}")
    
    try:
        response = requests.get(url, params=params, timeout=10)
        print(f"\n5. 响应:")
        print(f"   - 状态码: {response.status_code}")
        print(f"   - 内容类型: {response.headers.get('content-type', 'unknown')}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"   - 请求状态: {data.get('status', 'unknown')}")
            print(f"   - 股票代码: {data.get('ticker', 'unknown')}")
            print(f"   - 查询计数: {data.get('queryCount', 0)}")
            print(f"   - 结果计数: {data.get('resultsCount', 0)}")
            
            if 'results' in data and data['results']:
                results = data['results']
                print(f"   - 实际数据条数: {len(results)}")
                
                if len(results) > 0:
                    first = results[0]
                    last = results[-1]
                    print(f"   - 第一根bar:")
                    print(f"     - 时间戳: {first.get('t', 'N/A')}")
                    print(f"     - 时间: {datetime.fromtimestamp(first['t']/1000).isoformat() if 't' in first else 'N/A'}")
                    print(f"     - OHLC: {first.get('o', 'N/A')}/{first.get('h', 'N/A')}/{first.get('l', 'N/A')}/{first.get('c', 'N/A')}")
                    print(f"     - 成交量: {first.get('v', 'N/A')}")
                    
                    print(f"   - 最后一根bar:")
                    print(f"     - 时间戳: {last.get('t', 'N/A')}")
                    print(f"     - 时间: {datetime.fromtimestamp(last['t']/1000).isoformat() if 't' in last else 'N/A'}")
                    print(f"     - OHLC: {last.get('o', 'N/A')}/{last.get('h', 'N/A')}/{last.get('l', 'N/A')}/{last.get('c', 'N/A')}")
                    print(f"     - 成交量: {last.get('v', 'N/A')}")
            else:
                print(f"   - 错误信息: {data.get('error', '无数据')}")
                if 'message' in data:
                    print(f"   - 消息: {data['message']}")
                    
        else:
            print(f"   - 响应文本: {response.text[:200]}")
            
    except requests.exceptions.Timeout:
        print(f"   - 错误: 请求超时")
    except requests.exceptions.RequestException as e:
        print(f"   - 错误: {e}")
    except Exception as e:
        print(f"   - 异常: {e}")

def test_all_timeframes():
    """测试所有timeframe"""
    print("\n=== 测试所有timeframe ===")
    
    timeframes = ["1D", "1W", "1M", "3M", "1Y"]
    
    for tf in timeframes:
        print(f"\n--- {tf} ---")
        config = TIMEFRAME_MAP.get(tf, TIMEFRAME_MAP["1M"])
        print(f"配置: {config}")
        
        # 简单测试配置是否正确
        if tf == "1D":
            if config["timespan"] != "minute":
                print(f"错误: 1D的timespan应该是'minute', 实际是'{config['timespan']}'")
        else:
            if config["timespan"] != "day":
                print(f"错误: {tf}的timespan应该是'day', 实际是'{config['timespan']}'")

if __name__ == "__main__":
    test_polygon_api()
    test_all_timeframes()