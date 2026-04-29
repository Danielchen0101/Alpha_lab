"""
测试AI调用链路 - 模拟scanner运行
"""

import sys
import os
import json
import time

# 添加当前目录到Python路径
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# 导入必要的模块
try:
    import requests
    print("[导入] 成功导入requests模块")
except ImportError as e:
    print(f"[导入] 导入requests模块失败: {e}")
    sys.exit(1)

def test_single_ai_call(symbol):
    """测试单个symbol的AI调用链路"""
    print(f"\n{'='*60}")
    print(f"测试AI调用链路: {symbol}")
    print(f"{'='*60}")
    
    start_time = time.time()
    
    try:
        # 调用AI分析接口
        url = "http://127.0.0.1:8889/ai/analyze/single"
        payload = {"symbol": symbol}
        
        print(f"[请求] 发送请求到: {url}")
        print(f"[请求] 请求数据: {payload}")
        
        response = requests.post(url, json=payload, timeout=30)
        request_time = time.time() - start_time
        
        print(f"[响应] 状态码: {response.status_code}")
        print(f"[响应] 响应时间: {request_time:.2f}秒")
        
        if response.status_code == 200:
            data = response.json()
            print(f"[响应] 成功: {data.get('success')}")
            print(f"[响应] 趋势标签: {data.get('trendLabel')}")
            print(f"[响应] 趋势分数: {data.get('trendScore')}")
            print(f"[响应] AI推理: {'有' if data.get('aiReasoning') else '无'}")
            print(f"[响应] 错误信息: {data.get('error')}")
            
            # 检查是否有真实AI数据
            has_ai_data = data.get('trendLabel') is not None and data.get('trendScore') is not None
            print(f"[结果] 是否有AI数据: {'是' if has_ai_data else '否'}")
            
            return {
                'symbol': symbol,
                'success': data.get('success'),
                'has_ai_data': has_ai_data,
                'trendLabel': data.get('trendLabel'),
                'trendScore': data.get('trendScore'),
                'error': data.get('error'),
                'response_time': request_time
            }
        else:
            print(f"[错误] 请求失败: {response.status_code}")
            print(f"[错误] 响应内容: {response.text[:200]}")
            return {
                'symbol': symbol,
                'success': False,
                'has_ai_data': False,
                'error': f"HTTP {response.status_code}",
                'response_time': request_time
            }
            
    except requests.exceptions.Timeout:
        print(f"[错误] 请求超时 (30秒)")
        return {
            'symbol': symbol,
            'success': False,
            'has_ai_data': False,
            'error': 'Timeout after 30s',
            'response_time': 30
        }
    except requests.exceptions.ConnectionError:
        print(f"[错误] 连接失败 - 后端服务可能未运行")
        return {
            'symbol': symbol,
            'success': False,
            'has_ai_data': False,
            'error': 'Connection failed',
            'response_time': time.time() - start_time
        }
    except Exception as e:
        print(f"[错误] 未知异常: {str(e)}")
        return {
            'symbol': symbol,
            'success': False,
            'has_ai_data': False,
            'error': str(e),
            'response_time': time.time() - start_time
        }

def test_batch_ai_calls(symbols, batch_size=3):
    """测试批量AI调用"""
    print(f"\n{'='*60}")
    print(f"测试批量AI调用: {len(symbols)}个symbols, 每批{batch_size}个")
    print(f"{'='*60}")
    
    results = []
    
    for i in range(0, len(symbols), batch_size):
        batch = symbols[i:i+batch_size]
        print(f"\n[批次] 处理批次 {i//batch_size + 1}: {batch}")
        
        batch_start = time.time()
        batch_results = []
        
        for symbol in batch:
            result = test_single_ai_call(symbol)
            batch_results.append(result)
            
            # 批次内间隔，避免并发过高
            time.sleep(0.5)
        
        batch_time = time.time() - batch_start
        print(f"[批次] 批次完成时间: {batch_time:.2f}秒")
        
        results.extend(batch_results)
        
        # 批次间间隔
        if i + batch_size < len(symbols):
            print(f"[等待] 等待2秒后处理下一批...")
            time.sleep(2)
    
    return results

def analyze_results(results):
    """分析测试结果"""
    print(f"\n{'='*60}")
    print(f"测试结果分析")
    print(f"{'='*60}")
    
    total = len(results)
    success_count = sum(1 for r in results if r.get('success'))
    has_ai_data_count = sum(1 for r in results if r.get('has_ai_data'))
    
    print(f"总测试数: {total}")
    print(f"成功调用数: {success_count} ({success_count/total*100:.1f}%)")
    print(f"有AI数据数: {has_ai_data_count} ({has_ai_data_count/total*100:.1f}%)")
    
    # 分析失败原因
    errors = {}
    for r in results:
        if not r.get('success') or not r.get('has_ai_data'):
            error = r.get('error', 'unknown')
            errors[error] = errors.get(error, 0) + 1
    
    if errors:
        print(f"\n失败原因分析:")
        for error, count in errors.items():
            print(f"  {error}: {count}次")
    
    # 显示有AI数据和无AI数据的symbols
    print(f"\n有AI数据的symbols:")
    for r in results:
        if r.get('has_ai_data'):
            print(f"  {r['symbol']}: {r['trendLabel']} ({r['trendScore']})")
    
    print(f"\n无AI数据的symbols:")
    for r in results:
        if not r.get('has_ai_data'):
            print(f"  {r['symbol']}: 错误={r.get('error', '无错误')}")
    
    # 响应时间分析
    response_times = [r.get('response_time', 0) for r in results]
    if response_times:
        avg_time = sum(response_times) / len(response_times)
        max_time = max(response_times)
        min_time = min(response_times)
        print(f"\n响应时间分析:")
        print(f"  平均: {avg_time:.2f}秒")
        print(f"  最大: {max_time:.2f}秒")
        print(f"  最小: {min_time:.2f}秒")
        
        # 检查超时
        timeout_count = sum(1 for t in response_times if t > 10)
        if timeout_count > 0:
            print(f"  超时(>10秒): {timeout_count}次")

def main():
    """主测试函数"""
    print("开始测试AI调用链路...")
    
    # 测试symbols - 选择一些常见的股票
    test_symbols = [
        'AAPL',  # Apple - 通常有数据
        'MSFT',  # Microsoft - 通常有数据
        'GOOGL', # Google - 通常有数据
        'AMZN',  # Amazon - 通常有数据
        'TSLA',  # Tesla - 通常有数据
        'NVDA',  # NVIDIA - 通常有数据
        'META',  # Meta - 通常有数据
        'JPM',   # JPMorgan - 通常有数据
        'V',     # Visa - 通常有数据
        'WMT',   # Walmart - 通常有数据
        'INVALID', # 无效symbol - 测试错误处理
        'TEST123' # 测试symbol - 可能无数据
    ]
    
    print(f"测试symbols: {test_symbols}")
    
    # 检查后端是否运行
    print("\n检查后端服务状态...")
    try:
        health_response = requests.get("http://127.0.0.1:8889/health", timeout=5)
        if health_response.status_code == 200:
            print(f"后端服务运行正常: {health_response.json()}")
        else:
            print(f"后端服务异常: {health_response.status_code}")
            print("请确保后端服务正在运行 (端口8889)")
            return
    except Exception as e:
        print(f"无法连接到后端服务: {e}")
        print("请启动后端服务: python start_quant_backend_repaired.py")
        return
    
    # 运行测试
    results = test_batch_ai_calls(test_symbols, batch_size=3)
    
    # 分析结果
    analyze_results(results)
    
    print(f"\n测试完成!")

if __name__ == "__main__":
    main()