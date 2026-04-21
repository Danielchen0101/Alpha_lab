"""
干净的AI调用链测试后端 - 只包含必要的AI分析接口
用于诊断单个symbol失败链
"""

import sys
import os
import time
import json
import requests
from flask import Flask, request, jsonify

# 创建Flask应用
app = Flask(__name__)

# 模拟配置
ai_provider_config_state = {
    'apiKey': 'sk-test-key-123456',  # 测试用假key
    'model': 'deepseek-chat',
    'baseURL': 'https://api.deepseek.com'
}

def analyze_trend_with_deepseek(symbol, stock_data, news_data, profile_data, technical_indicators=None, structured_news=None):
    """模拟的DeepSeek分析函数 - 用于测试调用链"""
    print(f"\n[AI分析函数] 开始分析 {symbol}")
    print(f"[AI分析函数] 股票数据: {bool(stock_data)}")
    print(f"[AI分析函数] 新闻数据: {bool(news_data)}")
    print(f"[AI分析函数] 公司数据: {bool(profile_data)}")
    
    try:
        # 模拟API调用
        api_key = ai_provider_config_state.get('apiKey', '')
        
        if not api_key:
            print(f"[AI分析函数] API密钥为空，返回null")
            return {
                'trendLabel': None,
                'trendScore': None,
                'trendConfidence': None,
                'scannerReason': 'API密钥为空',
                'aiReasoning': None
            }
        
        # 模拟真实API调用（会失败，因为使用假key）
        print(f"[AI分析函数] 模拟调用DeepSeek API...")
        
        # 这里应该调用真实API，但为了测试，我们模拟失败
        # 模拟HTTP 401错误（无效API密钥）
        print(f"[AI分析函数] 模拟API调用失败: HTTP 401")
        
        return {
            'trendLabel': None,
            'trendScore': None,
            'trendConfidence': None,
            'scannerReason': 'API调用失败: HTTP 401 - 无效API密钥',
            'trendScoreDetail': None,
            'momentumScore': None,
            'volumeScore': None,
            'volatilityScore': None,
            'structureScore': None,
            'newsScore': None,
            'aiReasoning': 'DeepSeek API调用失败: HTTP 401 - 无效API密钥',
            'api_error': True,
            'http_status': 401,
            'error_message': 'Invalid API key'
        }
        
    except Exception as e:
        print(f"[AI分析函数] 异常: {str(e)}")
        return {
            'trendLabel': None,
            'trendScore': None,
            'trendConfidence': None,
            'scannerReason': f'分析异常: {str(e)}',
            'aiReasoning': None
        }

@app.route('/ai/analyze/single', methods=['POST'])
def ai_analyze_single():
    """AI分析接口 - 用于测试单个symbol失败链"""
    print(f"\n{'='*60}")
    print(f"[AI分析接口] 收到请求")
    
    start_time = time.time()
    
    try:
        # 1. 获取请求数据
        data = request.get_json()
        print(f"[AI分析接口] 请求数据: {data}")
        
        if not data:
            print(f"[AI分析接口] 错误: 无JSON数据")
            return jsonify({
                'success': False,
                'error': 'No JSON data provided',
                'timestamp': int(time.time()),
                'stage': 'request_parsing'
            }), 400
        
        symbol = data.get('symbol')
        if not symbol:
            print(f"[AI分析接口] 错误: 无symbol参数")
            return jsonify({
                'success': False,
                'error': 'Symbol is required',
                'timestamp': int(time.time()),
                'stage': 'request_validation'
            }), 400
        
        symbol_upper = symbol.upper()
        print(f"[AI分析接口] 分析股票: {symbol_upper}")
        
        # 2. 模拟获取市场数据
        print(f"[AI分析接口] 阶段1: 获取市场数据")
        market_data = {
            'price': 150.25,
            'changePercent': 1.5,
            'volume': 1000000,
            'dayHigh': 152.00,
            'dayLow': 149.50,
            'previousClose': 148.00
        }
        
        # 3. 模拟获取公司信息
        print(f"[AI分析接口] 阶段2: 获取公司信息")
        company_info = {
            'name': f'{symbol_upper} Inc.',
            'finnhubSector': 'Technology',
            'finnhubIndustry': 'Software'
        }
        
        # 4. 模拟获取新闻数据
        print(f"[AI分析接口] 阶段3: 获取新闻数据")
        news_data = {
            'sentiment': 'Positive',
            'eventRisk': 'Low',
            'topCatalyst': 'Strong earnings report',
            'newsCount': 3,
            'hasNews': True
        }
        
        # 5. 调用AI分析
        print(f"[AI分析接口] 阶段4: 调用AI分析")
        ai_start_time = time.time()
        ai_result = analyze_trend_with_deepseek(
            symbol_upper, 
            market_data, 
            news_data, 
            company_info
        )
        ai_elapsed = time.time() - ai_start_time
        
        print(f"[AI分析接口] AI分析完成，耗时: {ai_elapsed:.2f}秒")
        print(f"[AI分析接口] AI结果: trendLabel={ai_result.get('trendLabel')}")
        
        # 6. 构建响应
        response_data = {
            'success': True,
            'symbol': symbol_upper,
            'trendLabel': ai_result.get('trendLabel'),
            'trendScore': ai_result.get('trendScore'),
            'trendConfidence': ai_result.get('trendConfidence'),
            'scannerReason': ai_result.get('scannerReason'),
            'aiReasoning': ai_result.get('aiReasoning'),
            'momentumScore': ai_result.get('momentumScore'),
            'volumeScore': ai_result.get('volumeScore'),
            'volatilityScore': ai_result.get('volatilityScore'),
            'structureScore': ai_result.get('structureScore'),
            'newsScore': ai_result.get('newsScore'),
            'overallScore': ai_result.get('overallScore'),
            'confidence': ai_result.get('confidence'),
            'volumeStatus': ai_result.get('volumeStatus'),
            'eventRisk': ai_result.get('eventRisk'),
            'conciseReasoning': ai_result.get('conciseReasoning'),
            'detailedReasoning': ai_result.get('detailedReasoning'),
            'companyName': company_info.get('name'),
            'sector': company_info.get('finnhubSector'),
            'newsSentiment': news_data.get('sentiment'),
            'topNews': news_data.get('topCatalyst'),
            'timestamp': int(time.time()),
            'responseTime': round(time.time() - start_time, 3),
            'aiResponseTime': round(ai_elapsed, 3),
            'message': 'AI analysis completed',
            'hasAiData': ai_result.get('trendLabel') is not None,
            'api_error': ai_result.get('api_error', False),
            'http_status': ai_result.get('http_status')
        }
        
        print(f"[AI分析接口] 返回响应: success={response_data['success']}, hasAiData={response_data['hasAiData']}")
        print(f"{'='*60}")
        
        return jsonify(response_data)
        
    except Exception as e:
        print(f"[AI分析接口] 异常: {str(e)}")
        import traceback
        traceback.print_exc()
        
        return jsonify({
            'success': False,
            'error': f'AI分析过程异常: {str(e)}',
            'error_type': type(e).__name__,
            'timestamp': int(time.time()),
            'responseTime': round(time.time() - start_time, 3),
            'stage': 'general_exception'
        }), 500

@app.route('/health', methods=['GET'])
def health():
    """健康检查接口"""
    return jsonify({
        'status': 'ok',
        'service': 'clean_backend_test',
        'timestamp': int(time.time())
    })

if __name__ == '__main__':
    print("启动干净的AI调用链测试后端...")
    print("端口: 8890")
    print("接口:")
    print("  - POST /ai/analyze/single - AI分析接口")
    print("  - GET /health - 健康检查")
    print("\n等待请求...")
    
    app.run(host='127.0.0.1', port=8890, debug=False)