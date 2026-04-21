#!/usr/bin/env python3
"""
测试最终修复效果
"""

import requests
import json
import time

def test_single_symbol(symbol="AAPL"):
    """测试单个symbol的AI分析"""
    print(f"\n测试symbol: {symbol}")
    print("="*60)
    
    url = "http://127.0.0.1:8889/ai/analyze/single"
    payload = {
        "symbol": symbol
    }
    
    try:
        start_time = time.time()
        response = requests.post(url, json=payload, timeout=30)
        response_time = time.time() - start_time
        
        print(f"响应时间: {response_time:.2f}秒")
        print(f"状态码: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"成功: {data.get('success')}")
            
            if data.get('success'):
                print(f"AI分析来源: {data.get('provenance', {}).get('aiAnalysis')}")
                print(f"是否降级: {data.get('fallback', False)}")
                print(f"趋势标签: {data.get('trend')}")
                print(f"总体分数: {data.get('overallScore')}")
                print(f"AI推理: {data.get('aiReasoning', '')[:100]}...")
                
                # 检查数据源
                provenance = data.get('provenance', {})
                print(f"市场数据源: {provenance.get('marketData')}")
                print(f"新闻数据源: {provenance.get('news')}")
                print(f"公司信息源: {provenance.get('companyInfo')}")
                
                # 检查是否有AI数据
                if data.get('hasAiData', True) == False:
                    print("警告: 标记为没有AI数据")
                if data.get('fallback', False):
                    print("信息: 使用本地规则降级分析")
                    
            else:
                print(f"错误: {data.get('error')}")
                print(f"失败阶段: {data.get('stage')}")
                print(f"提供商: {data.get('provider')}")
                
        else:
            print(f"HTTP错误: {response.status_code}")
            print(f"响应: {response.text[:200]}")
            
    except requests.exceptions.Timeout:
        print("请求超时 (30秒)")
    except Exception as e:
        print(f"异常: {str(e)}")

def test_deepseek_config():
    """测试DeepSeek配置"""
    print("\n测试DeepSeek配置")
    print("="*60)
    
    # 检查配置文件
    try:
        with open('ai_provider_config.json', 'r', encoding='utf-8') as f:
            config = json.load(f)
        
        print(f"配置文件中的API密钥: {config.get('apiKey', '')[:10]}... (长度: {len(config.get('apiKey', ''))})")
        print(f"Provider: {config.get('provider')}")
        print(f"Base URL: {config.get('baseURL')}")
        print(f"Model: {config.get('model')}")
        
        # 测试API密钥
        import requests
        headers = {
            'Authorization': f'Bearer {config.get("apiKey")}',
            'Content-Type': 'application/json'
        }
        
        test_payload = {
            'model': config.get('model', 'deepseek-chat'),
            'messages': [{'role': 'user', 'content': 'Test'}],
            'max_tokens': 10
        }
        
        test_response = requests.post(
            f'{config.get("baseURL")}/chat/completions',
            headers=headers,
            json=test_payload,
            timeout=10
        )
        
        print(f"DeepSeek API测试状态码: {test_response.status_code}")
        if test_response.status_code == 200:
            print("DeepSeek API密钥有效")
        else:
            print(f"DeepSeek API密钥无效: {test_response.status_code}")
            
    except Exception as e:
        print(f"配置测试异常: {str(e)}")

def test_news_source():
    """测试新闻数据源"""
    print("\n测试新闻数据源")
    print("="*60)
    
    # 检查analyze_news_for_stock函数
    try:
        with open('start_quant_backend_fixed.py', 'r', encoding='utf-8') as f:
            content = f.read()
        
        # 查找函数定义
        import re
        pattern = r'def analyze_news_for_stock\(symbol\):(.*?)def '
        match = re.search(pattern, content, re.DOTALL)
        
        if match:
            func_content = match.group(1)
            if 'Mock' in func_content:
                print("警告: 函数中仍然包含'Mock'关键字")
            if 'finnhub' in func_content.lower():
                print("良好: 函数中包含'finnhub'关键字")
            if 'fetch_finnhub_news' in func_content:
                print("良好: 函数调用fetch_finnhub_news")
            else:
                print("警告: 函数没有调用fetch_finnhub_news")
        else:
            print("错误: 未找到analyze_news_for_stock函数")
            
    except Exception as e:
        print(f"新闻源测试异常: {str(e)}")

def main():
    """主函数"""
    print("Market Scanner修复验证测试")
    print("="*60)
    
    # 1. 测试DeepSeek配置
    test_deepseek_config()
    
    # 2. 测试新闻数据源
    test_news_source()
    
    # 3. 测试AI分析接口
    print("\n测试AI分析接口")
    print("="*60)
    
    symbols = ["AAPL", "MSFT", "TSLA"]
    for symbol in symbols:
        test_single_symbol(symbol)
    
    print("\n" + "="*60)
    print("测试完成")
    print("="*60)
    
    print("\n预期结果:")
    print("1. DeepSeek API密钥应使用配置文件中的有效密钥")
    print("2. 新闻数据应来自真实Finnhub API，非模拟数据")
    print("3. AI分析失败时应明确标记失败或使用降级方案")
    print("4. 不应返回success:true但AI字段全为null")

if __name__ == '__main__':
    main()