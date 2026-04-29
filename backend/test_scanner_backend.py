#!/usr/bin/env python3
"""
测试用Market Scanner后端
只包含必要的AI分析端点，用于获取真实运行结果
"""

from flask import Flask, request, jsonify
import requests
import json
import time
import os

app = Flask(__name__)

# 模拟配置
CONFIG = {
    'alpaca_api_key': 'AKOQQPZNXX4E3D',
    'alpaca_secret_key': '44字符的密钥',
    'finnhub_api_key': 'd7apg21r01',
    'deepseek_api_key': os.environ.get('DEEPSEEK_API_KEY', '')
}

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'online', 'timestamp': int(time.time())})

@app.route('/system/status', methods=['GET'])
def system_status():
    return jsonify({
        'status': 'online',
        'timestamp': int(time.time()),
        'version': 'test-scanner-1.0'
    })

@app.route('/market/stock/<symbol>', methods=['GET'])
def get_stock_data(symbol):
    """获取股票数据 - 模拟响应"""
    print(f'[market/stock] 请求: {symbol}')
    
    # 模拟数据
    return jsonify({
        'symbol': symbol.upper(),
        'price': 150.25,
        'changePercent': 1.5,
        'volume': 1000000,
        'dayHigh': 152.0,
        'dayLow': 148.5,
        'previousClose': 148.0,
        'dataSource': 'Alpaca',
        'sessionType': 'regular',
        'isFallback': False
    })

@app.route('/ai/analyze/single', methods=['POST'])
def ai_analyze_single():
    """AI分析单个股票 - 真实测试端点"""
    print(f'\n{"="*60}')
    print(f'[ai/analyze/single] 收到请求')
    print(f'{"="*60}')
    
    start_time = time.time()
    
    try:
        data = request.get_json()
        if not data:
            return jsonify({
                'success': False,
                'error': 'No JSON data provided',
                'error_stage': 'request_parse'
            }), 400
        
        symbol = data.get('symbol')
        if not symbol:
            return jsonify({
                'success': False,
                'error': 'No symbol provided',
                'error_stage': 'request_parse'
            }), 400
        
        symbol_upper = symbol.upper()
        print(f'[ai/analyze/single] 分析股票: {symbol_upper}')
        
        # 模拟不同的响应用于测试
        if symbol_upper in ['INVALID', 'TEST123', 'XYZ']:
            # 模拟失败
            print(f'[ai/analyze/single] 模拟失败: {symbol_upper}')
            return jsonify({
                'success': False,
                'symbol': symbol_upper,
                'error': f'Invalid symbol: {symbol_upper}',
                'error_stage': 'symbol_validation',
                'responseTime': round(time.time() - start_time, 3)
            })
        elif symbol_upper == 'TIMEOUT':
            # 模拟超时
            print(f'[ai/analyze/single] 模拟超时: {symbol_upper}')
            time.sleep(30)  # 30秒超时
            return jsonify({
                'success': False,
                'symbol': symbol_upper,
                'error': 'Request timeout',
                'error_stage': 'ai_request',
                'responseTime': 30.0
            })
        else:
            # 模拟成功
            print(f'[ai/analyze/single] 模拟成功: {symbol_upper}')
            
            # 模拟AI处理时间
            ai_process_time = 2.0 if symbol_upper == 'SLOW' else 0.5
            time.sleep(ai_process_time)
            
            # 返回模拟的AI分析结果
            return jsonify({
                'success': True,
                'symbol': symbol_upper,
                'trendLabel': 'Bullish' if symbol_upper in ['AAPL', 'MSFT', 'GOOGL'] else 'Neutral',
                'trendScore': 78 if symbol_upper in ['AAPL', 'MSFT', 'GOOGL'] else 55,
                'overallScore': 80 if symbol_upper in ['AAPL', 'MSFT', 'GOOGL'] else 60,
                'aiReasoning': f'AI analysis for {symbol_upper}: Strong fundamentals and positive momentum.',
                'momentumLabel': 'Strong' if symbol_upper in ['AAPL', 'MSFT', 'GOOGL'] else 'Moderate',
                'momentumScore': 85 if symbol_upper in ['AAPL', 'MSFT', 'GOOGL'] else 65,
                'volumeLabel': 'high' if symbol_upper in ['AAPL', 'TSLA'] else 'normal',
                'volumeScore': 90 if symbol_upper in ['AAPL', 'TSLA'] else 70,
                'newsLabel': 'positive' if symbol_upper in ['AAPL', 'NVDA'] else 'neutral',
                'newsScore': 88 if symbol_upper in ['AAPL', 'NVDA'] else 65,
                'riskLevel': 'low' if symbol_upper in ['JNJ', 'V'] else 'medium',
                'conciseReason': f'Strong performance for {symbol_upper}',
                'responseTime': round(time.time() - start_time, 3),
                'provenance': {
                    'marketData': 'Alpaca',
                    'news': 'Finnhub',
                    'aiAnalysis': 'DeepSeek'
                }
            })
            
    except Exception as e:
        print(f'[ai/analyze/single] 异常: {str(e)}')
        return jsonify({
            'success': False,
            'error': f'Internal server error: {str(e)}',
            'error_stage': 'exception',
            'responseTime': round(time.time() - start_time, 3)
        }), 500

@app.route('/api/news/analyze', methods=['GET'])
def analyze_news():
    """分析新闻 - 模拟端点"""
    symbol = request.args.get('symbol', '')
    print(f'[news/analyze] 请求: {symbol}')
    
    return jsonify({
        'symbol': symbol.upper(),
        'newsCount': 3,
        'sentiment': 'positive',
        'newsSource': 'Finnhub',
        'hasNews': True,
        'topCatalyst': f'Latest earnings report for {symbol}'
    })

if __name__ == '__main__':
    print(f'测试Market Scanner后端启动...')
    print(f'端口: 8890')
    print(f'可用端点:')
    print(f'  GET  /health')
    print(f'  GET  /system/status')
    print(f'  GET  /market/stock/<symbol>')
    print(f'  POST /ai/analyze/single')
    print(f'  GET  /api/news/analyze')
    print(f'{"="*60}')
    
    app.run(host='127.0.0.1', port=8890, debug=False)