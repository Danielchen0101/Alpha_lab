#!/usr/bin/env python3
"""
测试不同股票的Backtest结果是否不同
对比NVDA、AAPL、WMT、HD四个股票
"""

import requests
import json
import time

def test_backtest_differences():
    """测试不同股票的backtest结果差异"""
    
    symbols = ['NVDA', 'AAPL', 'WMT', 'HD']
    results = {}
    
    print("=" * 80)
    print("测试不同股票的Backtest结果差异")
    print("=" * 80)
    
    for symbol in symbols:
        print(f"\n=== 测试股票 {symbol} ===")
        
        # 构建backtest配置
        today = time.strftime('%Y-%m-%d')
        one_year_ago = time.strftime('%Y-%m-%d', time.localtime(time.time() - 365*24*60*60))
        
        backtest_config = {
            "strategy": "moving_average",
            "startDate": one_year_ago,
            "endDate": today,
            "initialCapital": 10000,
            "symbols": [symbol],
            "dataMode": "real",
            "parameters": {
                "shortMaPeriod": 20,
                "longMaPeriod": 50
            }
        }
        
        url = "http://127.0.0.1:8892/api/backtest/run"
        
        try:
            start_time = time.time()
            response = requests.post(url, json=backtest_config, timeout=30)
            elapsed = time.time() - start_time
            
            print(f"响应时间: {elapsed:.2f}秒")
            print(f"状态码: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                print(f"Success: {data.get('success')}")
                
                result = data.get('result', {})
                results_data = result.get('results', {})
                
                # 提取关键指标
                total_return = results_data.get('totalReturn')
                sharpe_ratio = results_data.get('sharpeRatio')
                max_drawdown = results_data.get('maxDrawdown')
                backtest_id = result.get('backtestId')
                
                print(f"Backtest ID: {backtest_id}")
                print(f"Total Return: {total_return}%")
                print(f"Sharpe Ratio: {sharpe_ratio}")
                print(f"Max Drawdown: {max_drawdown}%")
                
                # 保存结果
                results[symbol] = {
                    'totalReturn': total_return,
                    'sharpeRatio': sharpe_ratio,
                    'maxDrawdown': max_drawdown,
                    'backtestId': backtest_id,
                    'success': data.get('success')
                }
                
                # 打印原始响应结构
                print(f"结果结构 keys: {list(results_data.keys())}")
                
            else:
                print(f"错误响应: {response.text[:500]}")
                results[symbol] = {'error': f"HTTP {response.status_code}"}
                
        except Exception as e:
            print(f"异常: {e}")
            results[symbol] = {'error': str(e)}
    
    # 对比结果
    print("\n" + "=" * 80)
    print("结果对比")
    print("=" * 80)
    
    if all('totalReturn' in r for r in results.values()):
        # 检查是否所有值都相同
        total_returns = [r['totalReturn'] for r in results.values()]
        sharpe_ratios = [r['sharpeRatio'] for r in results.values()]
        max_drawdowns = [r['maxDrawdown'] for r in results.values()]
        
        print(f"\nTotal Return 值: {total_returns}")
        print(f"Sharpe Ratio 值: {sharpe_ratios}")
        print(f"Max Drawdown 值: {max_drawdowns}")
        
        # 检查唯一性
        unique_returns = len(set(total_returns))
        unique_sharpes = len(set(sharpe_ratios))
        unique_drawdowns = len(set(max_drawdowns))
        
        print(f"\n唯一性分析:")
        print(f"- Total Return: {unique_returns} 个唯一值 (共 {len(total_returns)} 个)")
        print(f"- Sharpe Ratio: {unique_sharpes} 个唯一值 (共 {len(sharpe_ratios)} 个)")
        print(f"- Max Drawdown: {unique_drawdowns} 个唯一值 (共 {len(max_drawdowns)} 个)")
        
        if unique_returns == 1:
            print("⚠️  警告: 所有股票的 Total Return 值相同!")
        if unique_sharpes == 1:
            print("⚠️  警告: 所有股票的 Sharpe Ratio 值相同!")
        if unique_drawdowns == 1:
            print("⚠️  警告: 所有股票的 Max Drawdown 值相同!")
        
        # 打印详细对比
        print(f"\n详细对比:")
        for symbol in symbols:
            r = results[symbol]
            print(f"{symbol}: Return={r['totalReturn']}%, Sharpe={r['sharpeRatio']}, DD={r['maxDrawdown']}%")
    else:
        print("部分股票测试失败:")
        for symbol in symbols:
            if 'error' in results[symbol]:
                print(f"{symbol}: {results[symbol]['error']}")
            elif 'totalReturn' not in results[symbol]:
                print(f"{symbol}: 数据不完整")
    
    return results

def test_frontend_data_chain():
    """模拟前端数据链，检查每一层的数据"""
    
    print("\n" + "=" * 80)
    print("模拟前端数据链分析")
    print("=" * 80)
    
    # 模拟前端处理流程
    symbols = ['NVDA', 'AAPL', 'WMT', 'HD']
    
    for symbol in symbols:
        print(f"\n=== 模拟前端处理: {symbol} ===")
        
        # 模拟backtest请求
        today = time.strftime('%Y-%m-%d')
        one_year_ago = time.strftime('%Y-%m-%d', time.localtime(time.time() - 365*24*60*60))
        
        backtest_config = {
            "strategy": "moving_average",
            "startDate": one_year_ago,
            "endDate": today,
            "initialCapital": 10000,
            "symbols": [symbol],
            "dataMode": "real",
            "parameters": {
                "shortMaPeriod": 20,
                "longMaPeriod": 50
            }
        }
        
        url = "http://127.0.0.1:8892/api/backtest/run"
        
        try:
            response = requests.post(url, json=backtest_config, timeout=30)
            
            if response.status_code == 200:
                data = response.json()
                
                # A. 后端原始响应
                print(f"A. 后端原始响应:")
                print(f"   success: {data.get('success')}")
                result = data.get('result', {})
                results_data = result.get('results', {})
                print(f"   totalReturn: {results_data.get('totalReturn')}")
                print(f"   sharpeRatio: {results_data.get('sharpeRatio')}")
                print(f"   maxDrawdown: {results_data.get('maxDrawdown')}")
                
                # B. 模拟前端构建 evidenceSummary
                backtestKeyResults = None
                if data.get('result'):
                    backtestKeyResults = {
                        'totalReturn': results_data.get('totalReturn'),
                        'sharpeRatio': results_data.get('sharpeRatio'),
                        'maxDrawdown': results_data.get('maxDrawdown'),
                        'winRate': results_data.get('winRate')
                    }
                
                print(f"B. 前端构建 evidenceSummary:")
                print(f"   backtestKeyResults: {backtestKeyResults}")
                
                # C. 模拟前端构建 recommendation
                evidenceSummary = {
                    'marketData': None,
                    'backtestKeyResults': backtestKeyResults,
                    'optimizationKeyResults': None,
                    'aiReasoning': 'Test'
                }
                
                # 注意：这里模拟前端的引用问题
                # 如果直接引用 results_data，可能会导致对象引用共享
                evidenceFull = json.dumps(evidenceSummary)
                
                print(f"C. 前端构建 evidenceFull (JSON):")
                print(f"   evidenceFull length: {len(evidenceFull)} chars")
                
                # D. 模拟前端解析 evidenceFull
                parsed_evidence = json.loads(evidenceFull)
                print(f"D. 前端解析 evidenceFull:")
                print(f"   parsed backtestKeyResults: {parsed_evidence.get('backtestKeyResults')}")
                
                # 检查对象ID（Python中）
                print(f"   对象引用检查:")
                print(f"   - results_data id: {id(results_data)}")
                print(f"   - backtestKeyResults id: {id(backtestKeyResults) if backtestKeyResults else 'None'}")
                print(f"   - parsed_evidence id: {id(parsed_evidence)}")
                
            else:
                print(f"请求失败: {response.status_code}")
                
        except Exception as e:
            print(f"异常: {e}")

if __name__ == "__main__":
    print("开始测试不同股票的Backtest结果差异")
    print("确保后端服务正在运行 (端口 8892)")
    
    # 测试后端结果差异
    backtest_results = test_backtest_differences()
    
    # 模拟前端数据链
    test_frontend_data_chain()
    
    print("\n" + "=" * 80)
    print("测试完成")
    print("=" * 80)