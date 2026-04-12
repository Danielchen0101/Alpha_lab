#!/usr/bin/env python3
"""
测试Alpaca 403修复
"""

import json
import requests
import time

def test_alpaca_feed_fallback():
    """测试Alpaca feed fallback逻辑"""
    
    # 测试配置
    payload = {
        "symbol": "AAPL",
        "strategy": "moving_average",
        "startDate": "2025-04-01",  # 1年前
        "endDate": "2026-04-10",    # 今天
        "initialCapital": 100000,
        "shortMaRange": {"start": 5, "end": 15, "step": 5},
        "longMaRange": {"start": 20, "end": 40, "step": 10}
    }
    
    base_url = "http://127.0.0.1:8889"
    
    print(f"\n{'='*60}")
    print(f"测试: Alpaca 403修复和feed fallback")
    print(f"{'='*60}")
    
    try:
        # 发送优化请求
        start_time = time.time()
        response = requests.post(
            f"{base_url}/api/backtest/optimize",
            json=payload,
            timeout=60
        )
        elapsed = time.time() - start_time
        
        print(f"响应时间: {elapsed:.2f}秒")
        print(f"状态码: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            
            print(f"成功: {data.get('success', False)}")
            print(f"错误信息: {data.get('error', 'None')}")
            
            if data.get('success', False):
                # 检查参数
                parameters = data.get('parameters', {})
                print(f"数据源: {parameters.get('dataSource', 'Not specified')}")
                print(f"历史数据点: {parameters.get('historicalDataPoints', 0)}")
                
                # 检查结果
                results = data.get('results', [])
                print(f"结果数量: {len(results)}")
                
                if results:
                    # 检查第一个结果的数据源
                    first_result = results[0]
                    data_source = first_result.get('dataSource', 'Unknown')
                    print(f"第一个结果的数据源: {data_source}")
                    
                    # 检查是否包含feed信息
                    if 'feed=' in data_source:
                        print(f"✅ 使用Alpaca feed fallback: {data_source}")
                    elif 'Alpaca' in data_source:
                        print(f"✅ 使用Alpaca数据源: {data_source}")
                    else:
                        print(f"⚠️  未知数据源: {data_source}")
                    
                    # 打印前3个结果
                    print(f"\n前3个结果:")
                    for i, result in enumerate(results[:3]):
                        params = result.get('parameters', {})
                        short_ma = params.get('shortMaPeriod', params.get('short_ma', 'N/A'))
                        long_ma = params.get('longMaPeriod', params.get('long_ma', 'N/A'))
                        
                        print(f"  {i+1}. Rank {result.get('rank', 'N/A')}: "
                              f"MA({short_ma},{long_ma}) | "
                              f"Return={result.get('totalReturn', 0):.2f}% | "
                              f"Sharpe={result.get('sharpeRatio', 0):.3f} | "
                              f"DD={result.get('maxDrawdown', 0):.2f}%")
                
                # 验证数据源
                data_source = parameters.get('dataSource', '')
                if 'Alpaca' in data_source:
                    print(f"\n✅ 验证通过: 数据源是Alpaca")
                    
                    # 检查是否使用了feed fallback
                    if 'feed=' in data_source:
                        print(f"✅ 使用了feed fallback机制")
                    else:
                        print(f"⚠️  没有feed信息，可能使用默认sip")
                        
                else:
                    print(f"\n❌ 验证失败: 数据源不是Alpaca ({data_source})")
                    
            else:
                error_msg = data.get('error', 'Unknown error')
                print(f"\n❌ 优化失败: {error_msg}")
                
                # 检查错误信息
                if 'Alpaca historical bars unavailable' in error_msg:
                    print(f"❌ Alpaca数据获取失败")
                elif '403' in error_msg:
                    print(f"❌ Alpaca 403错误")
                elif 'sip和iex都失败' in error_msg:
                    print(f"❌ Alpaca sip和iex都失败")
                    
        else:
            print(f"❌ 请求失败: {response.status_code}")
            print(f"响应内容: {response.text[:500]}")
            
    except requests.exceptions.Timeout:
        print(f"❌ 请求超时 (60秒)")
    except requests.exceptions.ConnectionError:
        print(f"❌ 连接错误 - 确保后端服务正在运行")
    except Exception as e:
        print(f"❌ 异常: {str(e)}")
    
    print(f"\n{'='*60}")
    print("测试完成")
    print(f"{'='*60}")

def test_direct_alpaca_api():
    """直接测试Alpaca API"""
    print(f"\n{'='*60}")
    print(f"测试: 直接Alpaca API调用")
    print(f"{'='*60}")
    
    try:
        import os
        import datetime
        import pytz
        
        # 模拟Alpaca配置
        ALPACA_API_KEY = "PKFQZZXERLVJLJHODHPPEB52RD"
        ALPACA_SECRET_KEY = "5odo2jBF7YFLa7DAvss3hV7WVXE789ktTor7zMyPewxa"
        ALPACA_BASE_URL = "https://data.alpaca.markets/v2"
        
        symbol = "AAPL"
        timeframe = "1Day"
        
        # 计算日期范围（1年）
        eastern = pytz.timezone('America/New_York')
        end_date = datetime.datetime.now(eastern)
        start_date = end_date - datetime.timedelta(days=365)
        
        start_date_eastern = eastern.localize(start_date.replace(hour=9, minute=30, second=0))
        end_date_eastern = eastern.localize(end_date.replace(hour=16, minute=0, second=0))
        
        utc = pytz.UTC
        start_date_utc = start_date_eastern.astimezone(utc)
        end_date_utc = end_date_eastern.astimezone(utc)
        
        headers = {
            'APCA-API-KEY-ID': ALPACA_API_KEY,
            'APCA-API-SECRET-KEY': ALPACA_SECRET_KEY
        }
        
        url = f'{ALPACA_BASE_URL}/stocks/{symbol}/bars'
        
        # 测试sip feed
        print(f"\n测试sip feed:")
        params_sip = {
            'timeframe': timeframe,
            'limit': 1000,
            'adjustment': 'raw',
            'feed': 'sip',
            'sort': 'asc',
            'start': start_date_utc.strftime('%Y-%m-%dT%H:%M:%SZ'),
            'end': end_date_utc.strftime('%Y-%m-%dT%H:%M:%SZ')
        }
        
        print(f"URL: {url}")
        print(f"Params: {params_sip}")
        print(f"Key: {ALPACA_API_KEY[:6]}...{ALPACA_API_KEY[-4:]}")
        
        response_sip = requests.get(url, headers=headers, params=params_sip, timeout=30)
        print(f"Status: {response_sip.status_code}")
        print(f"Body (前500字符): {response_sip.text[:500]}")
        
        # 测试iex feed
        print(f"\n测试iex feed:")
        params_iex = params_sip.copy()
        params_iex['feed'] = 'iex'
        
        response_iex = requests.get(url, headers=headers, params=params_iex, timeout=30)
        print(f"Status: {response_iex.status_code}")
        print(f"Body (前500字符): {response_iex.text[:500]}")
        
        # 分析结果
        print(f"\n分析:")
        if response_sip.status_code == 200:
            data_sip = response_sip.json()
            bars_sip = data_sip.get('bars', [])
            print(f"sip返回 {len(bars_sip)} 条bars数据")
        else:
            print(f"sip失败: {response_sip.status_code}")
            
        if response_iex.status_code == 200:
            data_iex = response_iex.json()
            bars_iex = data_iex.get('bars', [])
            print(f"iex返回 {len(bars_iex)} 条bars数据")
        else:
            print(f"iex失败: {response_iex.status_code}")
            
    except Exception as e:
        print(f"❌ 异常: {str(e)}")

if __name__ == "__main__":
    print("Alpaca 403修复测试")
    print("确保后端服务正在运行 (python start_quant_backend.py)")
    
    # 先测试直接API调用
    test_direct_alpaca_api()
    
    # 然后测试优化API
    test_alpaca_feed_fallback()