"""
简化的后端测试脚本 - 只启动AI分析接口
"""

import sys
import os
import time
import json
from flask import Flask, request, jsonify

# 创建Flask应用
app = Flask(__name__)

# 模拟的AI分析函数
def analyze_trend_with_deepseek(symbol, market_data, news_data, company_info):
    """模拟的AI分析函数"""
    print(f"[AI分析] 分析 {symbol}...")
    
    # 模拟AI分析结果
    return {
        'trendLabel': 'Bullish',
        'trendScore': 75,
        'momentumLabel': 'Strong',
        'momentumScore': 80,
        'volatilityLabel': 'Moderate',
        'volatilityScore': 60,
        'volumeLabel': 'High',
        'volumeScore': 85,
        'structureLabel': 'Consolidating',
        'structureScore': 70,
        'newsLabel': 'Positive',
        'newsScore': 90,
        'riskLevel': 'Low',
        'overallScore': 78,
        'aiReasoning': f'{symbol} shows strong bullish momentum with positive news sentiment.',
        'conciseReason': 'Bullish trend with strong volume and positive news.'
    }

@app.route('/ai/analyze/single', methods=['POST'])
def ai_analyze_single():
    """简化的AI分析接口"""
    print(f"\n{'='*60}")
    print(f"收到AI分析请求")
    
    try:
        data = request.get_json()
        symbol = data.get('symbol') if data else None
        
        if not symbol:
            return jsonify({
                'success': False,
                'error': 'Symbol is required'
            }), 400
        
        symbol_upper = symbol.upper()
        print(f"[AI分析接口] 分析股票: {symbol_upper}")
        
        # 模拟市场数据
        market_data = {
            'price': 150.25,
            'changePercent': 1.5,
            'volume': 1000000,
            'dayHigh': 152.00,
            'dayLow': 149.50,
            'previousClose': 148.00
        }
        
        # 模拟新闻数据
        news_data = {
            'sentiment': 'Positive',
            'eventRisk': 'Low',
            'topCatalyst': 'Strong earnings report'
        }
        
        # 模拟公司信息
        company_info = {
            'name': f'{symbol_upper} Inc.',
            'finnhubIndustry': 'Technology'
        }
        
        # 调用AI分析
        print(f"[AI分析接口] 调用AI分析函数...")
        ai_result = analyze_trend_with_deepseek(symbol_upper, market_data, news_data, company_info)
        
        # 构建响应
        response_data = {
            'success': True,
            'symbol': symbol_upper,
            'trendLabel': ai_result.get('trendLabel'),
            'trendScore': ai_result.get('trendScore'),
            'momentumLabel': ai_result.get('momentumLabel'),
            'momentumScore': ai_result.get('momentumScore'),
            'volatilityLabel': ai_result.get('volatilityLabel'),
            'volatilityScore': ai_result.get('volatilityScore'),
            'volumeLabel': ai_result.get('volumeLabel'),
            'volumeScore': ai_result.get('volumeScore'),
            'structureLabel': ai_result.get('structureLabel'),
            'structureScore': ai_result.get('structureScore'),
            'newsLabel': ai_result.get('newsLabel'),
            'newsScore': ai_result.get('newsScore'),
            'riskLevel': ai_result.get('riskLevel'),
            'overallScore': ai_result.get('overallScore'),
            'aiReasoning': ai_result.get('aiReasoning'),
            'conciseReason': ai_result.get('conciseReason'),
            'newsSentiment': news_data.get('sentiment'),
            'eventRisk': news_data.get('eventRisk'),
            'topNews': news_data.get('topCatalyst'),
            'companyName': company_info.get('name'),
            'sector': company_info.get('finnhubIndustry'),
            'timestamp': int(time.time()),
            'message': 'AI analysis completed successfully'
        }
        
        print(f"[AI分析接口] 返回响应: {json.dumps(response_data, indent=2)}")
        print(f"{'='*60}")
        
        return jsonify(response_data)
        
    except Exception as e:
        print(f"[AI分析接口] 异常: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e),
            'timestamp': int(time.time())
        }), 500

@app.route('/health', methods=['GET'])
def health():
    """健康检查接口"""
    return jsonify({
        'status': 'ok',
        'timestamp': int(time.time())
    })

if __name__ == '__main__':
    print("启动简化后端测试服务...")
    print("端口: 8889")
    print("接口:")
    print("  - POST /ai/analyze/single - AI分析接口")
    print("  - GET /health - 健康检查")
    print("\n等待请求...")
    
    app.run(host='127.0.0.1', port=8889, debug=False)