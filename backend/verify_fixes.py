#!/usr/bin/env python3
"""
验证AI扫描器限制修复
简化版本，避免编码问题
"""

import sys
import os

def verify_fixes():
    """验证所有修复"""
    print("验证AI扫描器限制修复")
    print("=" * 60)
    
    all_passed = True
    
    # 1. 验证配置文件
    print("\n1. 验证配置文件速率限制...")
    try:
        sys.path.append(os.path.dirname(os.path.abspath(__file__)))
        import config
        
        # 检查Alpaca限制
        if hasattr(config, 'ALPACA_RATE_LIMIT'):
            alpaca = config.ALPACA_RATE_LIMIT
            print(f"   Alpaca限制: {alpaca}")
            if alpaca.get('historical_bars_per_minute') == 200:
                print("   [OK] Alpaca历史数据限制正确")
            else:
                print("   [FAIL] Alpaca历史数据限制不正确")
                all_passed = False
        else:
            print("   [FAIL] Alpaca限制配置不存在")
            all_passed = False
        
        # 检查Finnhub限制
        if hasattr(config, 'FINNHUB_RATE_LIMIT'):
            finnhub = config.FINNHUB_RATE_LIMIT
            print(f"   Finnhub限制: {finnhub}")
            if finnhub.get('calls_per_minute') == 60:
                print("   [OK] Finnhub调用限制正确")
            else:
                print("   [FAIL] Finnhub调用限制不正确")
                all_passed = False
        else:
            print("   [FAIL] Finnhub限制配置不存在")
            all_passed = False
            
    except Exception as e:
        print(f"   [FAIL] 导入配置失败: {e}")
        all_passed = False
    
    # 2. 验证新闻分析函数
    print("\n2. 验证新闻分析函数...")
    try:
        import start_quant_backend as backend
        
        if hasattr(backend, 'analyze_news_for_stock'):
            # 检查函数文档字符串
            import inspect
            doc = inspect.getdoc(backend.analyze_news_for_stock)
            if doc and '真实Finnhub API' in doc:
                print("   [OK] 新闻分析函数使用真实Finnhub API")
            else:
                print("   [WARN] 新闻分析函数文档未明确说明使用真实API")
            
            # 检查函数源代码
            source = inspect.getsource(backend.analyze_news_for_stock)
            if 'fetch_finnhub_news' in source:
                print("   [OK] 函数调用fetch_finnhub_news API")
            else:
                print("   [FAIL] 函数未调用fetch_finnhub_news API")
                all_passed = False
                
            if "'newsSource': 'Mock'" in source or '"newsSource": "Mock"' in source:
                print("   [FAIL] 函数仍然返回模拟数据")
                all_passed = False
            else:
                print("   [OK] 函数未返回模拟数据")
        else:
            print("   [FAIL] analyze_news_for_stock函数不存在")
            all_passed = False
            
    except Exception as e:
        print(f"   [FAIL] 检查新闻分析函数失败: {e}")
        all_passed = False
    
    # 3. 验证AI分析超时
    print("\n3. 验证AI分析超时设置...")
    try:
        import start_quant_backend as backend
        
        if hasattr(backend, 'analyze_trend_with_deepseek'):
            import inspect
            source = inspect.getsource(backend.analyze_trend_with_deepseek)
            
            # 检查是否有人为超时限制
            timeout_patterns = ['timeout=30', 'timeout=15', 'timeout=10', 'timeout=5']
            has_timeout = any(pattern in source for pattern in timeout_patterns)
            
            if has_timeout:
                print("   [FAIL] AI分析函数包含人为超时限制")
                all_passed = False
            else:
                print("   [OK] AI分析函数无人为超时限制")
        else:
            print("   [FAIL] analyze_trend_with_deepseek函数不存在")
            all_passed = False
            
    except Exception as e:
        print(f"   [FAIL] 检查AI分析超时失败: {e}")
        all_passed = False
    
    # 4. 验证前端API配置
    print("\n4. 验证前端API配置...")
    try:
        frontend_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'frontend', 'src', 'services', 'api.ts')
        
        if os.path.exists(frontend_path):
            with open(frontend_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            if 'scannerApi' in content:
                print("   [OK] scannerApi实例存在")
                
                # 简单检查是否包含timeout设置
                if 'timeout:' in content and 'scannerApi' in content:
                    # 提取scannerApi部分的timeout值
                    import re
                    scanner_section = re.search(r'const scannerApi\s*=[^;]+', content, re.DOTALL)
                    if scanner_section:
                        section = scanner_section.group(0)
                        if 'timeout:' in section:
                            timeout_match = re.search(r'timeout\s*:\s*(\d+)', section)
                            if timeout_match:
                                timeout_val = int(timeout_match.group(1))
                                if timeout_val > 0:
                                    print(f"   [WARN] scannerApi有超时设置: {timeout_val}ms")
                                else:
                                    print("   [OK] scannerApi超时设置为0")
                            else:
                                print("   [OK] scannerApi未设置具体超时值")
                        else:
                            print("   [OK] scannerApi未设置timeout参数")
                    else:
                        print("   [WARN] 无法解析scannerApi配置")
                else:
                    print("   [OK] scannerApi可能无超时设置")
            else:
                print("   [FAIL] scannerApi实例不存在")
                all_passed = False
        else:
            print(f"   [FAIL] 前端API文件不存在: {frontend_path}")
            all_passed = False
            
    except Exception as e:
        print(f"   [FAIL] 检查前端API配置失败: {e}")
        all_passed = False
    
    # 输出总结
    print("\n" + "=" * 60)
    print("验证结果总结")
    print("=" * 60)
    
    if all_passed:
        print("[SUCCESS] 所有验证通过！AI扫描器限制修复完成。")
        print("\n修复内容:")
        print("1. Alpaca/Finnhub官方免费层速率限制已配置")
        print("2. 新闻分析使用真实Finnhub API，非模拟数据")
        print("3. AI分析无人为超时限制")
        print("4. 前端使用专用scannerApi实例")
    else:
        print("[FAILURE] 部分验证失败，请检查修复。")
    
    return all_passed

if __name__ == '__main__':
    success = verify_fixes()
    sys.exit(0 if success else 1)