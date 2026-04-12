#!/usr/bin/env python3
"""
测试 AI Agent 页面的数据流
"""

import json
import requests
import time

def test_ai_agent_flow():
    """测试 AI Agent 页面的完整数据流"""
    
    print("=" * 80)
    print("AI Agent 页面数据流测试")
    print("=" * 80)
    
    base_url = "http://127.0.0.1:8892"
    
    # 1. 测试 backtest API
    print("\n1. 测试 Backtest API")
    print("-" * 40)
    
    backtest_payload = {
        "strategy": "moving_average",
        "startDate": "2025-04-01",
        "endDate": "2026-04-10",
        "initialCapital": 10000,
        "symbols": ["AAPL"],
        "dataMode": "real",
        "parameters": {
            "shortMaPeriod": 20,
            "longMaPeriod": 50
        }
    }
    
    print(f"Backtest URL: POST {base_url}/api/backtest/run")
    print(f"Backtest Payload:")
    print(json.dumps(backtest_payload, indent=2))
    
    try:
        backtest_response = requests.post(
            f"{base_url}/api/backtest/run",
            json=backtest_payload,
            timeout=60
        )
        
        print(f"Backtest 状态码: {backtest_response.status_code}")
        
        if backtest_response.status_code == 200:
            backtest_data = backtest_response.json()
            print(f"Backtest 成功: {backtest_data.get('success', False)}")
            
            if backtest_data.get('success', False):
                result = backtest_data.get('result', {})
                print(f"Backtest 结果结构:")
                print(f"  - 是否有result字段: {'result' in backtest_data}")
                print(f"  - result类型: {type(result)}")
                print(f"  - result字段: {list(result.keys()) if isinstance(result, dict) else 'N/A'}")
                
                # 检查关键字段
                if isinstance(result, dict):
                    print(f"  - totalReturn: {result.get('totalReturn', 'N/A')}")
                    print(f"  - sharpeRatio: {result.get('sharpeRatio', 'N/A')}")
                    print(f"  - maxDrawdown: {result.get('maxDrawdown', 'N/A')}")
                    print(f"  - winRate: {result.get('winRate', 'N/A')}")
            else:
                print(f"Backtest 失败: {backtest_data.get('error', 'Unknown error')}")
        else:
            print(f"Backtest 请求失败: {backtest_response.text[:500]}")
            
    except Exception as e:
        print(f"Backtest 测试异常: {str(e)}")
    
    # 2. 测试 optimization API
    print("\n2. 测试 Optimization API")
    print("-" * 40)
    
    optimization_payload = {
        "symbol": "AAPL",
        "strategy": "moving_average",
        "startDate": "2025-04-01",
        "endDate": "2026-04-10",
        "initialCapital": 10000,
        "shortMaRange": {"start": 5, "end": 25, "step": 5},
        "longMaRange": {"start": 50, "end": 200, "step": 25}
    }
    
    print(f"Optimization URL: POST {base_url}/api/backtest/optimize")
    print(f"Optimization Payload:")
    print(json.dumps(optimization_payload, indent=2))
    
    try:
        optimization_response = requests.post(
            f"{base_url}/api/backtest/optimize",
            json=optimization_payload,
            timeout=120
        )
        
        print(f"Optimization 状态码: {optimization_response.status_code}")
        
        if optimization_response.status_code == 200:
            optimization_data = optimization_response.json()
            print(f"Optimization 成功: {optimization_data.get('success', False)}")
            
            if optimization_data.get('success', False):
                result = optimization_data.get('result', {})
                print(f"Optimization 结果结构:")
                print(f"  - 是否有result字段: {'result' in optimization_data}")
                print(f"  - result类型: {type(result)}")
                print(f"  - result字段: {list(result.keys()) if isinstance(result, dict) else 'N/A'}")
                
                # 检查关键字段
                if isinstance(result, dict):
                    print(f"  - bestScore: {result.get('bestScore', 'N/A')}")
                    print(f"  - bestCombination: {result.get('bestCombination', 'N/A')}")
                    print(f"  - totalCombinations: {result.get('totalCombinations', 'N/A')}")
                    print(f"  - results长度: {len(result.get('results', []))}")
            else:
                print(f"Optimization 失败: {optimization_data.get('error', 'Unknown error')}")
        else:
            print(f"Optimization 请求失败: {optimization_response.text[:500]}")
            
    except Exception as e:
        print(f"Optimization 测试异常: {str(e)}")
    
    # 3. 测试 AI Agent 分析接口
    print("\n3. 测试 AI Agent 分析接口")
    print("-" * 40)
    
    # 模拟前端发送的上下文
    ai_context = {
        "symbol": "AAPL",
        "marketData": {
            "price": 175.25,
            "changePercent": 1.5,
            "volume": 5000000,
            "dayHigh": 176.50,
            "dayLow": 174.00
        },
        "backtestResult": {
            "totalReturn": 12.5,
            "sharpeRatio": 1.2,
            "maxDrawdown": -8.5,
            "winRate": 55.0
        },
        "optimizationResult": {
            "bestScore": 0.85,
            "bestCombination": {"shortMaPeriod": 15, "longMaPeriod": 50},
            "totalCombinations": 35
        }
    }
    
    ai_payload = {
        "symbol": "AAPL",
        "context": ai_context
    }
    
    print(f"AI Analysis URL: POST {base_url}/api/ai/trade/analyze-with-context")
    print(f"AI Analysis Payload:")
    print(json.dumps(ai_payload, indent=2))
    
    try:
        ai_response = requests.post(
            f"{base_url}/api/ai/trade/analyze-with-context",
            json=ai_payload,
            timeout=30
        )
        
        print(f"AI Analysis 状态码: {ai_response.status_code}")
        
        if ai_response.status_code == 200:
            ai_data = ai_response.json()
            print(f"AI Analysis 成功: {ai_data.get('success', False)}")
            
            if ai_data.get('success', False):
                decision = ai_data.get('decision', {})
                print(f"AI Decision 结构:")
                print(f"  - action: {decision.get('action', 'N/A')}")
                print(f"  - confidence: {decision.get('confidence', 'N/A')}")
                print(f"  - reason: {decision.get('reason', 'N/A')[:100]}...")
                print(f"  - 完整字段: {list(decision.keys())}")
            else:
                print(f"AI Analysis 失败: {ai_data.get('error', 'Unknown error')}")
        else:
            print(f"AI Analysis 请求失败: {ai_response.text[:500]}")
            
    except Exception as e:
        print(f"AI Analysis 测试异常: {str(e)}")
    
    # 4. 分析问题根因
    print("\n4. 问题根因分析")
    print("-" * 40)
    
    print("基于代码分析，AI Agent 页面显示 'No ... results' 的可能原因:")
    print("1. 前端发送的 backtestResult/optimizationResult 结构不正确")
    print("2. 后端返回的 result 字段嵌套层级不对")
    print("3. 前端读取的字段路径错误")
    print("4. 数据源不匹配（symbol/strategy/date range不一致）")
    
    print("\n需要检查的关键点:")
    print("1. 前端发送的 context 中 backtestResult 和 optimizationResult 的实际结构")
    print("2. 后端 /api/backtest/run 和 /api/backtest/optimize 返回的实际结构")
    print("3. 前端 Portfolio.tsx 中如何构建 aiContext")
    print("4. 前端如何从 backtestResponse 和 optimizationResponse 中提取 result")
    
    print("\n" + "=" * 80)
    print("测试完成")
    print("=" * 80)

if __name__ == "__main__":
    test_ai_agent_flow()