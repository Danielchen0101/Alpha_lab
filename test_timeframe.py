#!/usr/bin/env python3
"""
测试timeframe切换的数据流
"""

import requests
import json

BASE_URL = "http://localhost:5000"

def test_timeframe(symbol="AAPL", timeframe="1M"):
    """测试特定timeframe的数据获取"""
    
    # 前端timeframe配置映射
    timeframe_configs = {
        "1D": {"interval": "5min", "range": "1day"},
        "1W": {"interval": "1day", "range": "1week"},
        "1M": {"interval": "1day", "range": "1month"},
        "3M": {"interval": "1day", "range": "3month"},
        "1Y": {"interval": "1day", "range": "1year"}
    }
    
    config = timeframe_configs.get(timeframe, timeframe_configs["1M"])
    
    print(f"\n{'='*60}")
    print(f"测试 timeframe: {timeframe}")
    print(f"{'='*60}")
    
    # 1. 前端请求参数
    print(f"\n1. 前端请求参数:")
    print(f"   - symbol: {symbol}")
    print(f"   - timeframe: {timeframe}")
    print(f"   - interval: {config['interval']}")
    print(f"   - range: {config['range']}")
    
    # 2. 发送请求
    url = f"{BASE_URL}/api/market/history/{symbol}"
    params = {
        "interval": config["interval"],
        "range": config["range"]
    }
    
    print(f"\n2. 发送请求:")
    print(f"   - URL: {url}")
    print(f"   - Params: {params}")
    
    try:
        response = requests.get(url, params=params, timeout=10)
        print(f"   - 状态码: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            
            # 3. 后端返回数据
            print(f"\n3. 后端返回数据:")
            print(f"   - 数据源: {data.get('dataSource', data.get('source', 'Unknown'))}")
            print(f"   - 数据条数: {data.get('count', len(data.get('data', [])))}")
            
            if "data" in data and len(data["data"]) > 0:
                data_list = data["data"]
                first = data_list[0]
                last = data_list[-1]
                
                print(f"   - 第一根bar:")
                print(f"     - 时间: {first.get('time', 'N/A')}")
                print(f"     - OHLC: {first.get('open', 'N/A')}/{first.get('high', 'N/A')}/{first.get('low', 'N/A')}/{first.get('close', 'N/A')}")
                print(f"     - 成交量: {first.get('volume', 'N/A')}")
                
                print(f"   - 最后一根bar:")
                print(f"     - 时间: {last.get('time', 'N/A')}")
                print(f"     - OHLC: {last.get('open', 'N/A')}/{last.get('high', 'N/A')}/{last.get('low', 'N/A')}/{last.get('close', 'N/A')}")
                print(f"     - 成交量: {last.get('volume', 'N/A')}")
                
                # 计算时间跨度
                if "timestamp" in first and "timestamp" in last:
                    days_diff = (last["timestamp"] - first["timestamp"]) / (24 * 60 * 60)
                    print(f"   - 时间跨度: {days_diff:.1f} 天")
                else:
                    print(f"   - 时间跨度: 无法计算 (缺少时间戳)")
                    
            else:
                print(f"   - 错误: {data.get('error', '无数据返回')}")
                
        else:
            print(f"   - 错误: HTTP {response.status_code}")
            print(f"   - 响应: {response.text[:200]}")
            
    except requests.exceptions.RequestException as e:
        print(f"   - 请求异常: {e}")
    except Exception as e:
        print(f"   - 其他异常: {e}")

def main():
    """主测试函数"""
    print("测试timeframe切换数据流")
    print("="*60)
    
    # 测试所有timeframe
    timeframes = ["1D", "1W", "1M", "3M", "1Y"]
    
    for tf in timeframes:
        test_timeframe("AAPL", tf)
    
    print(f"\n{'='*60}")
    print("测试完成")
    print("="*60)

if __name__ == "__main__":
    main()