#!/usr/bin/env python3
"""
检查后端 backtest 和 optimization 接口的返回结构
"""

import re

def check_backtest_response_structure():
    """检查 run_backtest 函数的返回结构"""
    print("=" * 80)
    print("检查 Backtest 接口返回结构")
    print("=" * 80)
    
    with open("start_quant_backend.py", "r", encoding="utf-8") as f:
        content = f.read()
    
    # 查找 run_backtest 函数
    pattern = r'def run_backtest\([^)]*\):.*?return jsonify\([^)]+\)'
    match = re.search(pattern, content, re.DOTALL)
    
    if match:
        func_code = match.group(0)
        print("找到 run_backtest 函数")
        
        # 查找返回语句
        return_pattern = r'return jsonify\(([^)]+)\)'
        return_match = re.search(return_pattern, func_code, re.DOTALL)
        
        if return_match:
            return_expr = return_match.group(1)
            print(f"返回表达式 (前200字符): {return_expr[:200]}...")
            
            # 检查是否包含 result 字段
            if '"result"' in return_expr or "'result'" in return_expr:
                print("✅ run_backtest 返回包含 'result' 字段")
            else:
                print("❌ run_backtest 返回不包含 'result' 字段")
                
            # 检查返回结构
            print("\n返回结构分析:")
            if "success" in return_expr:
                print("  - 包含 'success' 字段")
            if "message" in return_expr:
                print("  - 包含 'message' 字段")
            if "backtestId" in return_expr:
                print("  - 包含 'backtestId' 字段")
                
        else:
            print("❌ 未找到 return jsonify 语句")
    else:
        print("❌ 未找到 run_backtest 函数")

def check_optimization_response_structure():
    """检查 run_parameter_optimization 函数的返回结构"""
    print("\n" + "=" * 80)
    print("检查 Optimization 接口返回结构")
    print("=" * 80)
    
    with open("start_quant_backend.py", "r", encoding="utf-8") as f:
        content = f.read()
    
    # 查找 run_parameter_optimization 函数
    pattern = r'def run_parameter_optimization\([^)]*\):.*?return jsonify\([^)]+\)'
    match = re.search(pattern, content, re.DOTALL)
    
    if match:
        func_code = match.group(0)
        print("找到 run_parameter_optimization 函数")
        
        # 查找返回语句
        return_pattern = r'return jsonify\(([^)]+)\)'
        return_match = re.search(return_pattern, func_code, re.DOTALL)
        
        if return_match:
            return_expr = return_match.group(1)
            print(f"返回表达式 (前200字符): {return_expr[:200]}...")
            
            # 检查是否包含 result 字段
            if '"result"' in return_expr or "'result'" in return_expr:
                print("✅ run_parameter_optimization 返回包含 'result' 字段")
            else:
                print("❌ run_parameter_optimization 返回不包含 'result' 字段")
                
            # 检查返回结构
            print("\n返回结构分析:")
            if "success" in return_expr:
                print("  - 包含 'success' 字段")
            if "optimizationId" in return_expr:
                print("  - 包含 'optimizationId' 字段")
            if "results" in return_expr:
                print("  - 包含 'results' 字段")
            if "summary" in return_expr:
                print("  - 包含 'summary' 字段")
                
        else:
            print("❌ 未找到 return jsonify 语句")
    else:
        print("❌ 未找到 run_parameter_optimization 函数")

def check_frontend_expectations():
    """检查前端期望的结构"""
    print("\n" + "=" * 80)
    print("前端期望的结构 (来自 Portfolio.tsx)")
    print("=" * 80)
    
    print("1. Backtest 响应期望:")
    print("   backtestResponse.data?.result")
    print("   backtestResponse.data?.result?.totalReturn")
    print("   backtestResponse.data?.result?.sharpeRatio")
    print("   backtestResponse.data?.result?.maxDrawdown")
    print("   backtestResponse.data?.result?.winRate")
    print()
    
    print("2. Optimization 响应期望:")
    print("   optimizationResponse.data?.result")
    print("   optimizationResponse.data?.result?.bestScore")
    print("   optimizationResponse.data?.result?.bestCombination")
    print("   optimizationResponse.data?.result?.totalCombinations")
    print()
    
    print("3. AI Agent 页面显示逻辑:")
    print("   - 如果 evidence.backtestKeyResults 为 null，显示 'No backtest results'")
    print("   - 如果 evidence.optimizationKeyResults 为 null，显示 'No optimization results'")
    print()
    
    print("4. 问题分析:")
    print("   - 如果后端返回没有 'result' 包装层，那么:")
    print("     backtestResponse.data?.result 为 undefined")
    print("     → evidence.backtestKeyResults 为 null")
    print("     → 显示 'No backtest results'")
    print("   - 同样适用于 optimization")

if __name__ == "__main__":
    check_backtest_response_structure()
    check_optimization_response_structure()
    check_frontend_expectations()
    
    print("\n" + "=" * 80)
    print("修复建议")
    print("=" * 80)
    print("方案A（修改后端）:")
    print("  在 run_backtest() 和 run_parameter_optimization() 函数中，")
    print("  确保返回的数据包含 'result' 字段")
    print()
    print("方案B（修改前端）:")
    print("  在 Portfolio.tsx 中，修改解析逻辑:")
    print("  将: backtestResponse.data?.result")
    print("  改为: backtestResponse.data?.result || backtestResponse.data")
    print("  同样处理 optimizationResponse")
    print()
    print("推荐方案A，因为:")
    print("  1. 保持接口一致性")
    print("  2. 前端代码更清晰")
    print("  3. 符合 REST API 最佳实践")