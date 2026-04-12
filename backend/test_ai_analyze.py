#!/usr/bin/env python3
"""
测试 AI Agent 页面的 /api/ai/analyze 接口
验证后端返回的结构是否与前端期望匹配
"""

import requests
import json
import sys

def test_ai_analyze():
    """测试 /api/ai/analyze 接口"""
    url = "http://localhost:5000/api/ai/analyze"
    
    # 测试数据
    payload = {
        "symbol": "AAPL"
    }
    
    print("=" * 80)
    print("测试 AI Agent 分析接口")
    print("=" * 80)
    print(f"URL: {url}")
    print(f"Payload: {json.dumps(payload, indent=2)}")
    print()
    
    try:
        # 发送请求
        response = requests.post(url, json=payload, timeout=10)
        
        print(f"状态码: {response.status_code}")
        print(f"响应头: {dict(response.headers)}")
        print()
        
        if response.status_code == 200:
            data = response.json()
            print("响应 JSON 结构:")
            print(json.dumps(data, indent=2))
            print()
            
            # 分析结构
            print("=" * 80)
            print("结构分析:")
            print("=" * 80)
            
            # 检查是否有 result 包装层
            if "result" in data:
                print("✅ 后端返回了 'result' 包装层")
                result = data["result"]
                
                # 检查 result 内部结构
                if "backtest" in result:
                    print("✅ result.backtest 存在")
                    backtest = result["backtest"]
                    print(f"  backtest 类型: {type(backtest)}")
                    print(f"  backtest 内容: {json.dumps(backtest, indent=2) if isinstance(backtest, dict) else backtest}")
                else:
                    print("❌ result.backtest 不存在")
                    print(f"  result 的键: {list(result.keys())}")
                
                if "optimization" in result:
                    print("✅ result.optimization 存在")
                    optimization = result["optimization"]
                    print(f"  optimization 类型: {type(optimization)}")
                    print(f"  optimization 内容: {json.dumps(optimization, indent=2) if isinstance(optimization, dict) else optimization}")
                else:
                    print("❌ result.optimization 不存在")
                    print(f"  result 的键: {list(result.keys())}")
            else:
                print("❌ 后端没有返回 'result' 包装层")
                print(f"  直接返回的键: {list(data.keys())}")
                
                # 检查是否有直接的 backtest 和 optimization
                if "backtest" in data:
                    print("⚠️  后端直接返回了 'backtest'（没有 result 包装）")
                    backtest = data["backtest"]
                    print(f"  backtest 类型: {type(backtest)}")
                    print(f"  backtest 内容: {json.dumps(backtest, indent=2) if isinstance(backtest, dict) else backtest}")
                else:
                    print("❌ 后端也没有直接返回 'backtest'")
                
                if "optimization" in data:
                    print("⚠️  后端直接返回了 'optimization'（没有 result 包装）")
                    optimization = data["optimization"]
                    print(f"  optimization 类型: {type(optimization)}")
                    print(f"  optimization 内容: {json.dumps(optimization, indent=2) if isinstance(optimization, dict) else optimization}")
                else:
                    print("❌ 后端也没有直接返回 'optimization'")
            
            # 检查前端期望的结构
            print()
            print("=" * 80)
            print("前端期望的结构:")
            print("=" * 80)
            print("期望: {")
            print('  "result": {')
            print('    "backtest": {...},')
            print('    "optimization": {...}')
            print("  }")
            print("}")
            print()
            
            # 建议修复方案
            print("=" * 80)
            print("修复建议:")
            print("=" * 80)
            if "result" not in data:
                print("方案A（修改后端）:")
                print("  在 analyze_with_ai() 函数中，将返回结果包装在 'result' 字段中")
                print("  例如: return jsonify({'result': {'backtest': backtest_result, 'optimization': optimization_result}})")
                print()
                print("方案B（修改前端）:")
                print("  在 Portfolio.tsx 中，修改解析逻辑:")
                print("  将: const backtestResult = response.result.backtest;")
                print("  改为: const backtestResult = response.backtest || response.result?.backtest;")
                print("  同样处理 optimization")
            else:
                print("✅ 后端结构正确，问题可能在前端解析逻辑")
                
        else:
            print(f"❌ 请求失败: {response.status_code}")
            print(f"响应内容: {response.text}")
            
    except requests.exceptions.ConnectionError:
        print("❌ 无法连接到后端服务器")
        print("请确保后端服务正在运行: python start_quant_backend.py")
    except requests.exceptions.Timeout:
        print("❌ 请求超时")
    except Exception as e:
        print(f"❌ 发生错误: {type(e).__name__}: {str(e)}")

def test_backend_ai_analyze_function():
    """直接检查后端 analyze_with_ai 函数的返回结构"""
    print("\n" + "=" * 80)
    print("检查后端 analyze_with_ai 函数")
    print("=" * 80)
    
    try:
        # 读取后端代码
        with open("start_quant_backend.py", "r", encoding="utf-8") as f:
            content = f.read()
        
        # 查找 analyze_with_ai 函数
        import re
        pattern = r'def analyze_with_ai\([^)]*\):.*?return jsonify\([^)]+\)'
        match = re.search(pattern, content, re.DOTALL)
        
        if match:
            func_code = match.group(0)
            print("找到 analyze_with_ai 函数:")
            print("-" * 40)
            print(func_code[:500] + "..." if len(func_code) > 500 else func_code)
            print("-" * 40)
            
            # 检查返回语句
            return_pattern = r'return jsonify\(([^)]+)\)'
            return_match = re.search(return_pattern, func_code, re.DOTALL)
            
            if return_match:
                return_expr = return_match.group(1)
                print(f"返回表达式: {return_expr[:200]}...")
                
                # 检查是否包含 result 包装
                if "result" in return_expr:
                    print("✅ 函数返回包含 'result' 包装")
                else:
                    print("❌ 函数返回不包含 'result' 包装")
                    
                    # 检查是否直接返回 backtest 和 optimization
                    if "backtest" in return_expr and "optimization" in return_expr:
                        print("⚠️  函数直接返回 backtest 和 optimization（没有 result 包装）")
                    else:
                        print("❌ 函数也没有直接返回 backtest 和 optimization")
        else:
            print("❌ 未找到 analyze_with_ai 函数")
            
    except FileNotFoundError:
        print("❌ 找不到 start_quant_backend.py 文件")
    except Exception as e:
        print(f"❌ 发生错误: {type(e).__name__}: {str(e)}")

if __name__ == "__main__":
    print("AI Agent 页面问题诊断工具")
    print("=" * 80)
    
    # 测试接口
    test_ai_analyze()
    
    # 检查后端代码
    test_backend_ai_analyze_function()
    
    print("\n" + "=" * 80)
    print("诊断完成")
    print("=" * 80)