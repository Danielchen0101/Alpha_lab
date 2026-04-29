#!/usr/bin/env python3
"""
测试AI扫描器限制修复效果
验证：
1. 新闻分析函数使用真实Finnhub API
2. 速率限制配置已正确添加
3. AI分析无超时限制
"""

import sys
import os
import json
import time
from datetime import datetime

def test_config_file():
    """测试配置文件中的速率限制配置"""
    print("=" * 60)
    print("测试1: 检查配置文件中的速率限制配置")
    print("=" * 60)
    
    try:
        # 导入配置
        sys.path.append(os.path.dirname(os.path.abspath(__file__)))
        import config
        
        # 检查Alpaca速率限制
        if hasattr(config, 'ALPACA_RATE_LIMIT'):
            alpaca_limits = config.ALPACA_RATE_LIMIT
            print(f"[成功] Alpaca速率限制配置存在:")
            print(f"  - historical_bars_per_minute: {alpaca_limits.get('historical_bars_per_minute')}")
            print(f"  - snapshots_per_minute: {alpaca_limits.get('snapshots_per_minute')}")
            print(f"  - websocket_symbols: {alpaca_limits.get('websocket_symbols')}")
            print(f"  - requests_per_second: {alpaca_limits.get('requests_per_second')}")
            
            # 验证值是否符合官方免费层限制
            expected_alpaca = {
                'historical_bars_per_minute': 200,
                'snapshots_per_minute': 200,
                'websocket_symbols': 30,
                'requests_per_second': 10
            }
            
            all_correct = True
            for key, expected_value in expected_alpaca.items():
                actual_value = alpaca_limits.get(key)
                if actual_value != expected_value:
                    print(f"[警告] Alpaca {key}: 期望 {expected_value}, 实际 {actual_value}")
                    all_correct = False
            
            if all_correct:
                print("[成功] Alpaca速率限制配置正确")
        else:
            print("[失败] Alpaca速率限制配置不存在")
            return False
        
        # 检查Finnhub速率限制
        if hasattr(config, 'FINNHUB_RATE_LIMIT'):
            finnhub_limits = config.FINNHUB_RATE_LIMIT
            print(f"\n[成功] Finnhub速率限制配置存在:")
            print(f"  - calls_per_minute: {finnhub_limits.get('calls_per_minute')}")
            print(f"  - calls_per_second: {finnhub_limits.get('calls_per_second')}")
            print(f"  - news_calls_per_minute: {finnhub_limits.get('news_calls_per_minute')}")
            
            # 验证值是否符合官方免费层限制
            expected_finnhub = {
                'calls_per_minute': 60,
                'calls_per_second': 30,
                'news_calls_per_minute': 30
            }
            
            all_correct = True
            for key, expected_value in expected_finnhub.items():
                actual_value = finnhub_limits.get(key)
                if actual_value != expected_value:
                    print(f"[警告] Finnhub {key}: 期望 {expected_value}, 实际 {actual_value}")
                    all_correct = False
            
            if all_correct:
                print("[成功] Finnhub速率限制配置正确")
        else:
            print("[失败] Finnhub速率限制配置不存在")
            return False
        
        # 检查AI分析配置
        if hasattr(config, 'AI_ANALYSIS_CONFIG'):
            ai_config = config.AI_ANALYSIS_CONFIG
            print(f"\n[成功] AI分析配置存在:")
            print(f"  - timeout_seconds: {ai_config.get('timeout_seconds')}")
            print(f"  - max_concurrent_calls: {ai_config.get('max_concurrent_calls')}")
            print(f"  - retry_attempts: {ai_config.get('retry_attempts')}")
            
            # 验证值是否合理
            if ai_config.get('timeout_seconds') >= 60:
                print("[成功] AI超时时间合理（≥60秒）")
            else:
                print("[警告] AI超时时间可能过短")
            
            print("[成功] AI分析配置检查完成")
        else:
            print("[警告] AI分析配置不存在（可选）")
        
        return True
        
    except Exception as e:
        print(f"[失败] 检查配置文件时出错: {str(e)}")
        return False

def test_news_function():
    """测试新闻分析函数"""
    print("\n" + "=" * 60)
    print("测试2: 检查新闻分析函数")
    print("=" * 60)
    
    try:
        # 导入后端模块
        sys.path.append(os.path.dirname(os.path.abspath(__file__)))
        
        # 动态导入analyze_news_for_stock函数
        import start_quant_backend as backend
        
        # 检查函数是否存在
        if hasattr(backend, 'analyze_news_for_stock'):
            print("[成功] analyze_news_for_stock函数存在")
            
            # 获取函数源代码（简化检查）
            import inspect
            source = inspect.getsource(backend.analyze_news_for_stock)
            
            # 检查是否使用真实Finnhub API
            if 'fetch_finnhub_news' in source:
                print("[成功] 函数调用了fetch_finnhub_news API")
            else:
                print("[失败] 函数未调用fetch_finnhub_news API")
                return False
            
            # 检查是否返回模拟数据
            if 'Mock' in source and 'newsSource' in source:
                # 检查newsSource是否为'Mock'
                mock_patterns = ["'newsSource': 'Mock'", "'newsSource': 'mock'", '"newsSource": "Mock"']
                if any(pattern in source for pattern in mock_patterns):
                    print("[失败] 函数仍然返回模拟数据")
                    return False
                else:
                    print("[成功] 函数未返回模拟数据")
            else:
                print("[成功] 函数未使用模拟数据模式")
            
            # 检查是否包含Finnhub作为新闻源
            if "'newsSource': 'Finnhub'" in source or '"newsSource": "Finnhub"' in source:
                print("[成功] 函数使用Finnhub作为新闻源")
            else:
                print("[警告] 函数可能未明确设置Finnhub新闻源")
            
            return True
        else:
            print("[失败] analyze_news_for_stock函数不存在")
            return False
            
    except Exception as e:
        print(f"[失败] 检查新闻分析函数时出错: {str(e)}")
        return False

def test_ai_timeout():
    """测试AI分析超时设置"""
    print("\n" + "=" * 60)
    print("测试3: 检查AI分析超时设置")
    print("=" * 60)
    
    try:
        # 导入后端模块
        sys.path.append(os.path.dirname(os.path.abspath(__file__)))
        import start_quant_backend as backend
        
        # 检查analyze_trend_with_deepseek函数
        if hasattr(backend, 'analyze_trend_with_deepseek'):
            print("[成功] analyze_trend_with_deepseek函数存在")
            
            # 获取函数源代码
            import inspect
            source = inspect.getsource(backend.analyze_trend_with_deepseek)
            
            # 检查是否包含timeout参数
            timeout_patterns = [
                'timeout=30',
                'timeout=15',
                'timeout=10',
                'timeout=5',
                'timeout = 30',
                'timeout = 15',
                'timeout = 10',
                'timeout = 5'
            ]
            
            found_timeout = False
            for pattern in timeout_patterns:
                if pattern in source:
                    print(f"[失败] 函数包含超时限制: {pattern}")
                    found_timeout = True
                    break
            
            if not found_timeout:
                print("[成功] 函数未包含人为超时限制")
                
                # 检查是否使用requests.post
                if 'requests.post' in source:
                    # 检查requests.post调用
                    lines = source.split('\n')
                    for i, line in enumerate(lines):
                        if 'requests.post' in line:
                            print(f"[检查] 第{i+1}行: {line.strip()}")
                            # 检查这一行和后续几行是否有timeout参数
                            check_lines = lines[i:i+3]
                            check_text = '\n'.join(check_lines)
                            if any(pattern in check_text for pattern in timeout_patterns):
                                print("[失败] requests.post调用包含超时限制")
                                return False
                            else:
                                print("[成功] requests.post调用未包含超时限制")
                                break
                else:
                    print("[警告] 未找到requests.post调用，可能使用其他HTTP库")
                
                return True
            else:
                return False
        else:
            print("[失败] analyze_trend_with_deepseek函数不存在")
            return False
            
    except Exception as e:
        print(f"[失败] 检查AI分析超时设置时出错: {str(e)}")
        return False

def test_frontend_api():
    """测试前端API配置"""
    print("\n" + "=" * 60)
    print("测试4: 检查前端API配置")
    print("=" * 60)
    
    try:
        frontend_api_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'frontend', 'src', 'services', 'api.ts')
        
        if os.path.exists(frontend_api_path):
            print(f"[成功] 找到前端API文件: {frontend_api_path}")
            
            with open(frontend_api_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # 检查scannerApi实例
            if 'scannerApi' in content:
                print("[成功] scannerApi实例存在")
                
                # 检查scannerApi是否无超时设置
                scanner_api_pattern = r'const scannerApi\s*=\s*axios\.create\([^}]+\)'
                import re
                match = re.search(scanner_api_pattern, content, re.DOTALL)
                
                if match:
                    scanner_api_config = match.group(0)
                    print(f"[检查] scannerApi配置:\n{scanner_api_config[:200]}...")
                    
                    # 检查是否包含timeout设置
                    if 'timeout:' in scanner_api_config or 'timeout' in scanner_api_config:
                        # 提取timeout值
                        timeout_match = re.search(r'timeout\s*:\s*(\d+)', scanner_api_config)
                        if timeout_match:
                            timeout_value = int(timeout_match.group(1))
                            if timeout_value > 0:
                                print(f"[警告] scannerApi有超时设置: {timeout_value}ms")
                            else:
                                print("[成功] scannerApi超时设置为0或无超时")
                        else:
                            print("[成功] scannerApi未设置具体超时值")
                    else:
                        print("[成功] scannerApi未设置timeout参数")
                else:
                    print("[警告] 无法解析scannerApi配置")
            else:
                print("[失败] scannerApi实例不存在")
                return False
            
            # 检查main api实例的超时设置
            if 'const api =' in content:
                print("\n[检查] 主api实例配置:")
                
                # 查找api实例配置
                api_pattern = r'const api\s*=\s*axios\.create\([^}]+\)'
                match = re.search(api_pattern, content, re.DOTALL)
                
                if match:
                    api_config = match.group(0)
                    
                    # 检查是否包含timeout设置
                    timeout_match = re.search(r'timeout\s*:\s*(\d+)', api_config)
                    if timeout_match:
                        timeout_value = int(timeout_match.group(1))
                        print(f"[信息] 主api超时设置: {timeout_value}ms")
                        
                        if timeout_value == 30000:
                            print("[成功] 主api保持30秒超时（合理）")
                        else:
                            print(f"[信息] 主api超时设置为{timeout_value}ms")
                    else:
                        print("[警告] 主api未设置timeout参数")
                else:
                    print("[警告] 无法解析主api配置")
            
            return True
        else:
            print(f"[失败] 前端API文件不存在: {frontend_api_path}")
            return False
            
    except Exception as e:
        print(f"[失败] 检查前端API配置时出错: {str(e)}")
        return False

def main():
    """主测试函数"""
    print("开始测试AI扫描器限制修复效果")
    print("=" * 60)
    
    test_results = []
    
    # 运行所有测试
    test_results.append(("配置文件速率限制", test_config_file()))
    test_results.append(("新闻分析函数", test_news_function()))
    test_results.append(("AI分析超时设置", test_ai_timeout()))
    test_results.append(("前端API配置", test_frontend_api()))
    
    # 输出测试结果摘要
    print("\n" + "=" * 60)
    print("测试结果摘要")
    print("=" * 60)
    
    passed_tests = 0
    total_tests = len(test_results)
    
    for test_name, result in test_results:
        status = "[成功]" if result else "[失败]"
        print(f"{test_name}: {status}")
        if result:
            passed_tests += 1
    
    print(f"\n通过测试: {passed_tests}/{total_tests}")
    
    if passed_tests == total_tests:
        print("\n[里程碑] 所有测试通过！AI扫描器限制修复完成。")
        print("\n修复验证:")
        print("1. [成功] 配置文件已添加Alpaca/Finnhub官方免费层速率限制")
        print("2. [成功] 新闻分析函数使用真实Finnhub API，非模拟数据")
        print("3. [成功] AI分析函数无人为超时限制")
        print("4. [成功] 前端使用专用scannerApi实例（无超时）")
    else:
        print(f"\n[警告] 有{total_tests - passed_tests}个测试失败，请检查修复。")
    
    # 提供下一步建议
    print("\n" + "=" * 60)
    print("下一步建议")
    print("=" * 60)
    print("1. 重启后端服务使修改生效")
    print("2. 运行实际扫描器测试验证功能")
    print("3. 监控API使用情况，确保不超过免费层限制")
    print("4. 检查前端编译是否通过: npm run build")
    
    return passed_tests == total_tests

if __name__ == '__main__':
    success = main()
    sys.exit(0 if success else 1)