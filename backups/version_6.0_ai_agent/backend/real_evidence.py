#!/usr/bin/env python3
"""
收集真实运行证据
"""

import json
import requests
import time
import sys

def run_real_optimization():
    """运行真实优化并收集证据"""
    
    print("=" * 80)
    print("收集真实运行证据")
    print("=" * 80)
    
    # 固定测试配置
    payload = {
        "symbol": "AAPL",
        "strategy": "moving_average",
        "startDate": "2025-04-01",
        "endDate": "2026-04-10",
        "initialCapital": 100000,
        "shortMaRange": {"start": 5, "end": 25, "step": 5},
        "longMaRange": {"start": 50, "end": 200, "step": 25}
    }
    
    base_url = "http://127.0.0.1:8892"
    
    print(f"\n1. 真实请求信息")
    print("-" * 40)
    print(f"Request URL: POST {base_url}/api/backtest/optimize")
    print(f"Request Payload:")
    print(json.dumps(payload, indent=2, ensure_ascii=False))
    
    try:
        # 发送优化请求
        print(f"\n发送请求...")
        start_time = time.time()
        response = requests.post(
            f"{base_url}/api/backtest/optimize",
            json=payload,
            timeout=120  # 2分钟超时
        )
        elapsed = time.time() - start_time
        
        print(f"响应时间: {elapsed:.2f}秒")
        print(f"状态码: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            
            print(f"\n2. 响应数据")
            print("-" * 40)
            print(f"成功: {data.get('success', False)}")
            print(f"优化ID: {data.get('optimizationId', 'None')}")
            
            if data.get('success', False):
                # 3. 检查参数
                parameters = data.get('parameters', {})
                print(f"\n3. 参数信息")
                print("-" * 40)
                print(f"数据源: {parameters.get('dataSource', 'Not specified')}")
                print(f"历史数据点: {parameters.get('historicalDataPoints', 0)}")
                print(f"符号: {parameters.get('symbol', 'N/A')}")
                print(f"策略: {parameters.get('strategy', 'N/A')}")
                
                # 4. 检查结果
                results = data.get('results', [])
                print(f"\n4. 结果信息")
                print("-" * 40)
                print(f"结果数量: {len(results)}")
                
                if results:
                    # 5. Results 第一名真实 JSON
                    print(f"\n5. Results 第一名真实 JSON")
                    print("-" * 40)
                    first_result = results[0]
                    print(json.dumps(first_result, indent=2, ensure_ascii=False))
                    
                    # 6. 检查数据源
                    print(f"\n6. 数据源验证")
                    print("-" * 40)
                    all_sources = []
                    for i, result in enumerate(results):
                        source = result.get('dataSource', 'Unknown')
                        all_sources.append(source)
                        if i < 3:  # 只显示前3个
                            print(f"结果 {i+1}: {source}")
                    
                    unique_sources = set(all_sources)
                    if len(unique_sources) == 1:
                        source = list(unique_sources)[0]
                        print(f"\n所有结果使用相同数据源: {source}")
                        if 'Alpaca' in source:
                            print("✅ 数据源是Alpaca")
                            if 'feed=' in source:
                                print(f"✅ 包含feed信息")
                        else:
                            print("❌ 数据源不是Alpaca")
                    else:
                        print(f"\n❌ 数据源不一致: {unique_sources}")
                    
                    # 7. 随机抽2组验证
                    print(f"\n7. 随机抽2组验证")
                    print("-" * 40)
                    import random
                    if len(results) >= 3:
                        samples = random.sample(results[1:], min(2, len(results)-1))
                        
                        for i, sample in enumerate(samples):
                            short_ma = sample.get('short_ma', sample.get('parameters', {}).get('shortMaPeriod', 'N/A'))
                            long_ma = sample.get('long_ma', sample.get('parameters', {}).get('longMaPeriod', 'N/A'))
                            sharpe = sample.get('sharpeRatio', 'N/A')
                            data_source = sample.get('dataSource', 'N/A')
                            
                            print(f"\n样本 {i+1}: Short={short_ma}, Long={long_ma}")
                            print(f"  Sharpe: {sharpe}")
                            print(f"  Data Source: {data_source}")
                            
                            # 验证数据源
                            if 'Alpaca' in str(data_source):
                                print(f"  ✅ 数据源是Alpaca")
                            else:
                                print(f"  ❌ 数据源不是Alpaca")
                    
                    # 8. 验证没有模拟数据
                    print(f"\n8. 模拟数据验证")
                    print("-" * 40)
                    has_simulated = any('SIMULATED' in str(r.get('dataSource', '')) for r in results)
                    has_mock = any('mock' in str(r.get('dataSource', '')).lower() for r in results)
                    
                    if not has_simulated and not has_mock:
                        print("✅ 没有发现模拟数据")
                    else:
                        print("❌ 发现模拟数据")
                        
                else:
                    print(f"\n❌ 没有优化结果")
                    
            else:
                error_msg = data.get('error', 'Unknown error')
                print(f"\n❌ 优化失败: {error_msg}")
                
        else:
            print(f"\n❌ 请求失败: {response.status_code}")
            print(f"响应内容 (前1000字符):")
            print(response.text[:1000])
            
    except requests.exceptions.Timeout:
        print(f"\n❌ 请求超时 (120秒)")
    except requests.exceptions.ConnectionError:
        print(f"\n❌ 连接错误 - 确保后端服务正在运行")
    except Exception as e:
        print(f"\n❌ 异常: {str(e)}")
        import traceback
        traceback.print_exc()
    
    print(f"\n" + "=" * 80)
    print("证据收集完成")
    print("=" * 80)

def test_direct_alpaca():
    """直接测试Alpaca API"""
    print(f"\n" + "=" * 80)
    print("直接测试Alpaca API")
    print("=" * 80)
    
    try:
        import datetime
        import pytz
        
        # Alpaca配置
        ALPACA_API_KEY = "PKFQZZXERLVJLJHODHPPEB52RD"
        ALPACA_SECRET_KEY = "5odo2jBF7YFLa7DAvss3hV7WVXE789ktTor7zMyPewxa"
        ALPACA_BASE_URL = "https://data.alpaca.markets/v2"
        
        symbol = "AAPL"
        timeframe = "1Day"
        
        # 计算日期范围
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
            'limit': 100,
            'adjustment': 'raw',
            'feed': 'sip',
            'sort': 'asc',
            'start': start_date_utc.strftime('%Y-%m-%dT%H:%M:%SZ'),
            'end': end_date_utc.strftime('%Y-%m-%dT%H:%M:%SZ')
        }
        
        print(f"URL: {url}")
        print(f"Params: {json.dumps(params_sip, indent=2)}")
        
        try:
            response_sip = requests.get(url, headers=headers, params=params_sip, timeout=30)
            print(f"Status: {response_sip.status_code}")
            if response_sip.status_code == 200:
                data_sip = response_sip.json()
                bars_sip = data_sip.get('bars', [])
                print(f"sip返回 {len(bars_sip)} 条bars数据")
                if bars_sip:
                    print(f"第一条bar: {bars_sip[0]}")
            else:
                print(f"Body: {response_sip.text[:500]}")
        except Exception as e:
            print(f"sip请求异常: {str(e)}")
        
        # 测试iex feed
        print(f"\n测试iex feed:")
        params_iex = params_sip.copy()
        params_iex['feed'] = 'iex'
        
        print(f"URL: {url}")
        print(f"Params: {json.dumps(params_iex, indent=2)}")
        
        try:
            response_iex = requests.get(url, headers=headers, params=params_iex, timeout=30)
            print(f"Status: {response_iex.status_code}")
            if response_iex.status_code == 200:
                data_iex = response_iex.json()
                bars_iex = data_iex.get('bars', [])
                print(f"iex返回 {len(bars_iex)} 条bars数据")
                if bars_iex:
                    print(f"第一条bar: {bars_iex[0]}")
            else:
                print(f"Body: {response_iex.text[:500]}")
        except Exception as e:
            print(f"iex请求异常: {str(e)}")
            
    except Exception as e:
        print(f"❌ 异常: {str(e)}")

if __name__ == "__main__":
    print("真实运行证据收集")
    
    # 先测试直接Alpaca API
    test_direct_alpaca()
    
    # 然后运行优化测试
    run_real_optimization()