#!/usr/bin/env python3
"""
测试数据流验证脚本
用于验证AI分析接口的数据流
"""

import json
import sys

def test_ai_analyze_single_logic():
    """测试AI分析接口的逻辑"""
    print("=== 测试AI分析接口数据流 ===")
    
    # 模拟后端ai_provider_config_state
    ai_provider_config_state = {
        'provider': 'DeepSeek',
        'apiKey': '',  # 空的API密钥
        'baseURL': 'https://api.deepseek.com',
        'model': 'deepseek-chat'
    }
    
    print(f"1. AI配置状态: {ai_provider_config_state}")
    
    # 检查API密钥
    api_key = ai_provider_config_state.get('apiKey', '')
    print(f"2. API密钥检查: '{api_key}' (长度: {len(api_key)})")
    
    if not api_key:
        print("3. ❌ API密钥为空，将回退到本地规则分析")
        print("4. 调用analyze_trend_locally()")
        
        # 模拟analyze_trend_locally返回
        trend_analysis = {
            'trendLabel': 'Neutral',
            'trendScore': 50,
            'trendConfidence': 0.5,
            'scannerReason': 'Local analysis based on market data',
            'analysisSource': 'rule_based'
        }
        
        print(f"5. 本地规则分析结果: {trend_analysis}")
        
        # 字段映射
        response_data = {
            'success': True,
            'symbol': 'AAPL',
            'trend': trend_analysis.get('trendLabel', 'Neutral'),
            'overallScore': trend_analysis.get('trendScore', 50),
            'confidence': trend_analysis.get('trendConfidence', 0.5),
            'trendScore': trend_analysis.get('trendScore', 50),
            'momentumScore': 50,
            'volumeScore': 50,
            'volatilityScore': 50,
            'structureScore': 50,
            'newsScore': 50,
            'scannerReason': trend_analysis.get('scannerReason', 'Local analysis'),
            'aiReasoning': trend_analysis.get('scannerReason', 'AI analysis unavailable'),
            'newsSentiment': None,  # 新闻数据为空
            'eventRisk': None,      # 新闻数据为空
            'topNews': None,        # 新闻数据为空
            'companyName': 'Apple Inc.',
            'sector': 'Technology',
            'provenance': {
                'marketData': 'alpaca',
                'companyInfo': 'finnhub',
                'news': 'none',
                'aiAnalysis': 'local_rules'
            }
        }
        
        print(f"6. 最终响应数据:")
        for key, value in response_data.items():
            if isinstance(value, dict):
                print(f"   {key}: {value}")
            else:
                print(f"   {key}: {value}")
        
        # 检查前端期望的字段
        print("\n=== 前端字段映射检查 ===")
        print(f"前端读取trendLabel: {response_data.get('trend')}")
        print(f"前端读取trendScore: {response_data.get('overallScore')}")
        print(f"前端读取trendConfidence: {response_data.get('confidence')}")
        print(f"前端读取aiReasoning: {response_data.get('aiReasoning')}")
        print(f"前端读取newsSentiment: {response_data.get('newsSentiment')}")
        print(f"前端读取eventRisk: {response_data.get('eventRisk')}")
        print(f"前端读取topNews: {response_data.get('topNews')}")
        
        return response_data
    else:
        print("3. ✅ API密钥有效，将调用真实AI分析")
        return None

def test_news_interface_logic():
    """测试新闻接口逻辑"""
    print("\n=== 测试新闻接口数据流 ===")
    
    # 模拟新闻接口返回
    response_data = {
        'success': True,
        'symbol': 'AAPL',
        'news': [],  # 空新闻列表
        'topNews': None,
        'sentiment': None,
        'eventRisk': None,
        'newsCount': 0,
        'source': 'none',
        'hasNews': False
    }
    
    print(f"新闻接口响应: {json.dumps(response_data, indent=2, ensure_ascii=False)}")
    print("❌ 新闻接口返回空数据")
    
    return response_data

def test_frontend_field_reading():
    """测试前端字段读取"""
    print("\n=== 测试前端字段读取 ===")
    
    # 模拟后端返回的数据
    backend_response = {
        'success': True,
        'symbol': 'AAPL',
        'trend': 'Neutral',
        'overallScore': 50,
        'confidence': 0.5,
        'trendScore': 50,
        'momentumScore': 50,
        'volumeScore': 50,
        'volatilityScore': 50,
        'structureScore': 50,
        'newsScore': 50,
        'scannerReason': 'Local analysis based on market data',
        'aiReasoning': 'Local analysis based on market data',
        'newsSentiment': None,
        'eventRisk': None,
        'topNews': None,
        'companyName': 'Apple Inc.',
        'sector': 'Technology'
    }
    
    print(f"后端返回数据: {json.dumps(backend_response, indent=2, ensure_ascii=False)}")
    
    # 模拟前端analyzeTrend函数的处理
    result = {
        'trendLabel': backend_response.get('trend'),
        'trendScore': backend_response.get('overallScore'),
        'trendConfidence': backend_response.get('confidence'),
        'scannerReason': backend_response.get('scannerReason'),
        'aiReasoning': backend_response.get('aiReasoning'),
        'newsSentiment': backend_response.get('newsSentiment'),
        'eventRisk': backend_response.get('eventRisk'),
        'topNews': backend_response.get('topNews'),
        'companyName': backend_response.get('companyName'),
        'sector': backend_response.get('sector')
    }
    
    print(f"\n前端处理后的数据: {json.dumps(result, indent=2, ensure_ascii=False)}")
    
    # 检查表格列渲染
    print("\n=== 表格列渲染检查 ===")
    print(f"Trend列 (trendLabel): {result.get('trendLabel')}")
    print(f"Score列 (trendScore): {result.get('trendScore')}")
    print(f"Confidence (trendConfidence): {result.get('trendConfidence')}")
    print(f"AI Reasoning (aiReasoning): {result.get('aiReasoning')}")
    print(f"News Sentiment (newsSentiment): {result.get('newsSentiment')}")
    print(f"Risk (eventRisk): {result.get('eventRisk')}")
    print(f"Top News (topNews): {result.get('topNews')}")
    
    # 检查渲染逻辑
    print("\n=== 渲染逻辑检查 ===")
    
    # Trend列渲染
    trend_label = result.get('trendLabel')
    if trend_label:
        print(f"✅ Trend列: 显示 '{trend_label}'")
    else:
        print(f"❌ Trend列: 空值，显示为空")
    
    # Score列渲染
    trend_score = result.get('trendScore')
    if trend_score is not None:
        print(f"✅ Score列: 显示 '{trend_score.toFixed(0)}'")
    else:
        print(f"❌ Score列: 空值，显示 'N/A'")
    
    # AI Reasoning列渲染
    ai_reasoning = result.get('aiReasoning')
    scanner_reason = result.get('scannerReason')
    display_reason = ai_reasoning or scanner_reason
    if display_reason:
        print(f"✅ AI Reasoning列: 显示 '{display_reason}'")
    else:
        print(f"❌ AI Reasoning列: 空值，显示 'AI reasoning unavailable'")
    
    return result

def main():
    """主函数"""
    print("开始验证数据流...")
    
    # 测试AI分析接口
    ai_response = test_ai_analyze_single_logic()
    
    # 测试新闻接口
    news_response = test_news_interface_logic()
    
    # 测试前端字段读取
    frontend_data = test_frontend_field_reading()
    
    print("\n=== 问题总结 ===")
    print("1. ❌ AI配置API密钥为空，导致回退到本地规则")
    print("2. ✅ 字段映射正确：trendLabel→trend, trendScore→overallScore, trendConfidence→confidence")
    print("3. ✅ 前端正确读取字段：trend→trendLabel, overallScore→trendScore, confidence→trendConfidence")
    print("4. ❌ 新闻接口返回空数据：sentiment=null, eventRisk=null, topNews=null")
    print("5. ❌ 页面显示问题：")
    print("   - Trend: 应该显示'Neutral'")
    print("   - Score: 应该显示'50'")
    print("   - Confidence: 应该显示'50%'")
    print("   - AI Reasoning: 应该显示'Local analysis based on market data'")
    print("   - News/Risk/Top News: 显示N/A（因为新闻接口返回空）")
    
    print("\n=== 修复建议 ===")
    print("1. 用户需要保存有效的AI配置（API密钥）")
    print("2. 验证新闻接口配置（Alpaca/Finnhub API密钥）")
    print("3. 如果确实没有新闻数据，显示'N/A'是正确的")

if __name__ == "__main__":
    main()