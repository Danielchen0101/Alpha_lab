"""
测试单个symbol的AI调用链路
模拟前端调用，检查每个阶段的失败情况
"""

import sys
import os
import json
import time
import requests

# 添加当前目录到Python路径
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

def test_single_symbol_ai_flow(symbol):
    """测试单个symbol的完整AI调用链路"""
    print(f"\n{'='*80}")
    print(f"测试单个symbol AI调用链路: {symbol}")
    print(f"{'='*80}")
    
    start_time = time.time()
    stages = {}
    
    try:
        # 1. 调用AI分析接口
        stage_start = time.time()
        print(f"[阶段1] 调用AI分析接口: /ai/analyze/single")
        url = "http://127.0.0.1:8889/ai/analyze/single"
        payload = {"symbol": symbol}
        
        print(f"  请求URL: {url}")
        print(f"  请求数据: {payload}")
        
        response = requests.post(url, json=payload, timeout=60)  # 60秒超时
        stage_time = time.time() - stage_start
        stages['api_call'] = {'time': stage_time, 'status': response.status_code}
        
        print(f"  响应状态码: {response.status_code}")
        print(f"  响应时间: {stage_time:.2f}秒")
        
        if response.status_code != 200:
            print(f"  ❌ API调用失败: HTTP {response.status_code}")
            print(f"  响应内容: {response.text[:500]}")
            return {
                'symbol': symbol,
                'success': False,
                'stage': 'api_call',
                'error': f'HTTP {response.status_code}',
                'response_time': time.time() - start_time
            }
        
        # 2. 解析响应
        stage_start = time.time()
        print(f"\n[阶段2] 解析响应数据")
        try:
            data = response.json()
            stage_time = time.time() - stage_start
            stages['parse_response'] = {'time': stage_time, 'success': True}
            
            print(f"  解析成功: success={data.get('success')}")
            print(f"  解析时间: {stage_time:.2f}秒")
            
        except json.JSONDecodeError as e:
            stage_time = time.time() - stage_start
            stages['parse_response'] = {'time': stage_time, 'success': False, 'error': str(e)}
            
            print(f"  ❌ JSON解析失败: {e}")
            print(f"  原始响应: {response.text[:500]}")
            return {
                'symbol': symbol,
                'success': False,
                'stage': 'parse_response',
                'error': f'JSON解析失败: {str(e)}',
                'raw_response': response.text[:500],
                'response_time': time.time() - start_time
            }
        
        # 3. 检查success字段
        stage_start = time.time()
        print(f"\n[阶段3] 检查响应结构")
        
        if not data.get('success'):
            stage_time = time.time() - stage_start
            stages['check_success'] = {'time': stage_time, 'success': False}
            
            print(f"  ❌ 后端返回success: false")
            print(f"  错误信息: {data.get('error', '无错误信息')}")
            print(f"  完整响应: {json.dumps(data, indent=2)[:1000]}")
            
            return {
                'symbol': symbol,
                'success': False,
                'stage': 'check_success',
                'error': data.get('error', 'success: false'),
                'response_data': data,
                'response_time': time.time() - start_time
            }
        
        stage_time = time.time() - stage_start
        stages['check_success'] = {'time': stage_time, 'success': True}
        print(f"  ✅ 后端返回success: true")
        
        # 4. 检查关键字段
        stage_start = time.time()
        print(f"\n[阶段4] 检查关键字段")
        
        required_fields = ['trendLabel', 'trendScore', 'aiReasoning']
        missing_fields = []
        
        for field in required_fields:
            if field not in data:
                missing_fields.append(field)
        
        if missing_fields:
            stage_time = time.time() - stage_start
            stages['check_fields'] = {'time': stage_time, 'success': False, 'missing': missing_fields}
            
            print(f"  ⚠️  缺少关键字段: {missing_fields}")
            print(f"  现有字段: {list(data.keys())}")
        else:
            stage_time = time.time() - stage_start
            stages['check_fields'] = {'time': stage_time, 'success': True}
            print(f"  ✅ 所有关键字段都存在")
        
        # 5. 检查字段值
        stage_start = time.time()
        print(f"\n[阶段5] 检查字段值")
        
        null_fields = []
        for field in required_fields:
            if data.get(field) is None:
                null_fields.append(field)
        
        if null_fields:
            stage_time = time.time() - stage_start
            stages['check_values'] = {'time': stage_time, 'success': False, 'null_fields': null_fields}
            
            print(f"  ⚠️  关键字段值为null: {null_fields}")
            print(f"  trendLabel: {data.get('trendLabel')}")
            print(f"  trendScore: {data.get('trendScore')}")
            print(f"  aiReasoning: {'有' if data.get('aiReasoning') else '无'}")
        else:
            stage_time = time.time() - stage_start
            stages['check_values'] = {'time': stage_time, 'success': True}
            print(f"  ✅ 所有关键字段都有值")
            print(f"  trendLabel: {data.get('trendLabel')}")
            print(f"  trendScore: {data.get('trendScore')}")
            print(f"  aiReasoning: {data.get('aiReasoning')[:100] if data.get('aiReasoning') else '无'}")
        
        # 6. 总结
        total_time = time.time() - start_time
        print(f"\n[总结] AI调用链路完成")
        print(f"  总耗时: {total_time:.2f}秒")
        print(f"  阶段耗时:")
        for stage_name, stage_info in stages.items():
            print(f"    {stage_name}: {stage_info.get('time', 0):.2f}秒")
        
        has_ai_data = data.get('trendLabel') is not None and data.get('trendScore') is not None
        print(f"  是否有AI数据: {'是' if has_ai_data else '否'}")
        
        return {
            'symbol': symbol,
            'success': True,
            'has_ai_data': has_ai_data,
            'trendLabel': data.get('trendLabel'),
            'trendScore': data.get('trendScore'),
            'aiReasoning': data.get('aiReasoning'),
            'stages': stages,
            'response_time': total_time,
            'response_data': data
        }
        
    except requests.exceptions.Timeout:
        print(f"\n❌ 请求超时 (60秒)")
        return {
            'symbol': symbol,
            'success': False,
            'stage': 'timeout',
            'error': '请求超时 (60秒)',
            'response_time': time.time() - start_time
        }
    except requests.exceptions.ConnectionError:
        print(f"\n❌ 连接失败 - 后端服务可能未运行")
        return {
            'symbol': symbol,
            'success': False,
            'stage': 'connection',
            'error': '连接失败',
            'response_time': time.time() - start_time
        }
    except Exception as e:
        print(f"\n❌ 未知异常: {str(e)}")
        import traceback
        traceback.print_exc()
        return {
            'symbol': symbol,
            'success': False,
            'stage': 'exception',
            'error': str(e),
            'response_time': time.time() - start_time
        }

def test_multiple_symbols(symbols):
    """测试多个symbols"""
    print(f"\n{'='*80}")
    print(f"测试多个symbols AI调用链路")
    print(f"symbols: {symbols}")
    print(f"{'='*80}")
    
    results = []
    
    for symbol in symbols:
        result = test_single_symbol_ai_flow(symbol)
        results.append(result)
        
        # 等待1秒，避免并发过高
        time.sleep(1)
    
    # 分析结果
    print(f"\n{'='*80}")
    print(f"测试结果分析")
    print(f"{'='*80}")
    
    total = len(results)
    success_count = sum(1 for r in results if r.get('success'))
    has_ai_data_count = sum(1 for r in results if r.get('has_ai_data'))
    
    print(f"总测试数: {total}")
    print(f"成功调用数: {success_count} ({success_count/total*100:.1f}%)")
    print(f"有AI数据数: {has_ai_data_count} ({has_ai_data_count/total*100:.1f}%)")
    
    # 失败分析
    failures = [r for r in results if not r.get('success') or not r.get('has_ai_data')]
    if failures:
        print(f"\n失败详情:")
        for r in failures:
            print(f"  {r['symbol']}:")
            print(f"    成功: {r.get('success')}")
            print(f"    有AI数据: {r.get('has_ai_data')}")
            print(f"    失败阶段: {r.get('stage')}")
            print(f"    错误: {r.get('error', '无错误信息')}")
    
    # 成功但有null字段
    success_with_null = [r for r in results if r.get('success') and not r.get('has_ai_data')]
    if success_with_null:
        print(f"\n成功但无AI数据:")
        for r in success_with_null:
            print(f"  {r['symbol']}: trendLabel={r.get('trendLabel')}, trendScore={r.get('trendScore')}")
    
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
    
    return results

def main():
    """主测试函数"""
    print("开始测试单个symbol AI调用链路...")
    
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
    
    # 运行测试
    results = test_multiple_symbols(test_symbols)
    
    print(f"\n测试完成!")

if __name__ == "__main__":
    main()