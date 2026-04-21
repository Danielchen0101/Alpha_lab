#!/usr/bin/env python3
"""
修复版后端 - 只包含核心接口
"""
from flask import Flask, request, jsonify
from flask_cors import CORS
import time
import requests
import json

app = Flask(__name__)
CORS(app)

# AI Provider 配置状态
ai_provider_config_state = {
    'apiKey': '',
    'baseURL': 'https://api.deepseek.com',
    'model': 'deepseek-chat'
}

# Alpaca 配置状态
alpaca_config_state = {
    'paper_api_key': 'PKFQZZXERLVJLJHODHPPEB52RD',
    'paper_api_secret': '5odo2jBF7YFLa7DAvss3hV7WVXE789ktTor7zMyPewxa',
    'live_api_key': '',
    'live_api_secret': '',
    'environment': 'paper'
}

# ==================== 核心接口 ====================

@app.route('/api/status', methods=['GET'])
def get_status():
    return jsonify({
        'status': 'online',
        'timestamp': int(time.time()),
        'version': '1.0.0-fixed'
    })

@app.route('/api/ai/alpaca/account', methods=['GET'])
def ai_alpaca_account():
    print('=== AI Alpaca 账户请求 ===')
    return jsonify({
        'success': True,
        'data': {
            'accountNumber': 'PA3YPSJY0D4E',
            'status': 'ACTIVE',
            'cash': 100000.0,
            'equity': 100000.0,
            'isMockData': True,
            'message': 'Alpaca API 测试数据'
        }
    })

@app.route('/api/ai/trade/status', methods=['GET'])
def ai_trade_status():
    print('=== AI Trade Status 请求 ===')
    return jsonify({
        'success': True,
        'state': {
            'auto_mode': False,
            'paper_only': True,
            'human_confirm_required': True,
            'ai_status': 'idle'
        }
    })

@app.route('/api/ai/trade/preview', methods=['POST'])
def ai_trade_preview():
    print('=== AI Trade Preview 请求 ===')
    data = request.get_json()
    symbol = data.get('symbol', 'AAPL')
    
    return jsonify({
        'success': True,
        'decision': {
            'action': 'HOLD',
            'symbol': symbol,
            'qty': 0,
            'confidence': 0.5,
            'reason': 'AI 分析完成',
            'executable': False
        },
        'validation': {
            'is_valid': True,
            'message': 'AI 分析完成'
        }
    })

@app.route('/api/ai/provider/test', methods=['POST'])
def ai_provider_test():
    print('=== AI Provider Test 请求 ===')
    data = request.get_json()
    api_key = data.get('apiKey', '')
    
    return jsonify({
        'success': True,
        'valid': False,
        'message': 'API 测试完成（模拟）'
    })

@app.route('/api/ai/chat', methods=['POST'])
def ai_chat():
    print('=== AI Chat 请求 ===')
    data = request.get_json()
    message = data.get('message', '')
    
    return jsonify({
        'success': True,
        'response': f'收到: {message}\n（当前为模拟回复）',
        'isMockResponse': True
    })

# ==================== 启动 ====================
if __name__ == '__main__':
    print("================================================================================")
    print("修复版后端启动")
    print("端口: 8889")
    print("包含接口:")
    print("  1. GET /api/status - 系统状态")
    print("  2. GET /api/ai/alpaca/account - AI Alpaca 账户")
    print("  3. GET /api/ai/trade/status - AI 交易状态")
    print("  4. POST /api/ai/trade/preview - AI 交易预览")
    print("  5. POST /api/ai/provider/test - AI Provider 测试")
    print("  6. POST /api/ai/chat - AI 聊天")
    print("================================================================================")
    
    app.run(host='127.0.0.1', port=8891, debug=True)