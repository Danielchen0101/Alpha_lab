#!/usr/bin/env python3
"""
测试AI调用链路 - 捕获成功和失败样本的完整链路
"""

import requests
import json
import time

BASE_URL = "http://127.0.0.1:8889"

def test_symbol_ai_analysis(symbol, test_name):
    """测试单个symbol的AI分析链路"""
    print(f"\n{'='*80}")
    print(f"测试 {test_name}: {symbol}")
    print(f"{'='*80}")
    
    # 1. 测试前端会发送的请求
    print(f"\n1. 前端发送的request payload:")
    frontend_payload = {
        "symbol": symbol
    }
    print(json.dumps(frontend_payload, indent=4))
    
    # 2. 发送请求到后端
    print(f"\n2. 发送请求到 /ai/analyze/single")
    start_time = time.time()
    
    try:
        response = requests.post(
            f"{BASE_URL}/ai/analyze/single",
            json=frontend_payload,
            timeout=30
        )
        elapsed_ms = (time.time() - start_time) * 1000
        
        print(f"HTTP状态码: {response.status_code}")
        print(f"响应时间: {elapsed_ms:.0f}ms")
        
        if response.status_code == 200:
            data = response.json()
            print(f"\n3. 后端返回的response:")
            print(json.dumps(data, indent=4))
            
            # 分析结果
            print(f"\n4. 结果分析:")
            print(f"   success: {data.get('success')}")
            print(f"   trend: {data.get('trend')}")
            print(f"   overallScore: {data.get('overallScore')}")
            print(f"   confidence: {data.get('confidence')}")
            print(f"   aiReasoning: {'有值' if data.get('aiReasoning') else 'null'}")
            print(f"   volumeStatus: {data.get('volumeStatus')}")
            
            if data.get('success'):
                print(f"   ✅ AI分析成功")
                if data.get('trend') and data.get('overallScore'):
                    print(f"   ✅ 有有效的trend和score")
                else:
                    print(f"   ⚠️  success=true但trend/score为null")
            else:
                print(f"   ❌ AI分析失败: {data.get('message', '未知错误')}")
                
        else:
            print(f"响应文本: {response.text[:500]}")
            
    except requests.exceptions.Timeout:
        print(f"❌ 请求超时 (30秒)")
    except Exception as e:
        print(f"❌ 请求异常: {e}")

def test_multiple_symbols():
    """测试多个symbol"""
    print("AI调用链路测试")
    print("=" * 80)
    
    # 根据截图，选择测试样本
    symbols = [
        ("AMD", "成功样本 (截图显示有AI结果)"),
        ("AAPL", "失败样本1 (截图显示N/A)"),
        ("MSFT", "失败样本2 (截图显示N/A)")
    ]
    
    for symbol, description in symbols:
        test_symbol_ai_analysis(symbol, description)
        time.sleep(1)  # 避免请求太快

def check_backend_logs_instruction():
    """检查后端日志的指令"""
    print(f"\n{'='*80}")
    print("需要查看的后端日志")
    print(f"{'='*80}")
    
    print("运行上述测试后，查看后端控制台应该看到:")
    print("\n对于每个symbol:")
    print("=== AI ANALYZE START AAPL ===")
    print("request.json = {'symbol': 'AAPL'}")
    print("effective ai config = {...}")
    print("stock_data = {...}")
    print("news_data = {...}")
    print("company_info = {...}")
    print("calling provider with payload = {...}")
    print("provider status = 200/400/401/429")
    print("provider body = {...}")
    print("provider elapsed ms = ...")
    print("final trend_analysis = {...}")
    print("=== AI ANALYZE END AAPL ===")
    
    print("\n关键观察点:")
    print("1. effective ai config是否有有效的apiKey?")
    print("2. provider status是什么? (200成功, 401密钥无效, 400请求错误)")
    print("3. provider body包含什么错误信息?")
    print("4. 响应时间是否超时?")
    print("5. final trend_analysis是否有有效的trend/score?")

def main():
    """主函数"""
    print("AI调用链路完整测试")
    print("=" * 80)
    print("注意: 需要重启后端使调试日志生效")
    print("=" * 80)
    
    # 测试多个symbol
    test_multiple_symbols()
    
    # 检查后端日志
    check_backend_logs_instruction()
    
    print(f"\n{'='*80}")
    print("测试总结")
    print(f"{'='*80}")
    print("根据后端日志，我们需要确定:")
    print("1. 成功样本(AMD)和失败样本(AAPL/MSFT)的差异")
    print("2. 失败类型: A/B/C/D")
    print("3. 根本原因: config问题/provider问题/超时问题")

if __name__ == "__main__":
    main()