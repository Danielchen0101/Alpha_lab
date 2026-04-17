#!/usr/bin/env python3
"""
简单测试后端 - 验证修复效果
"""

from flask import Flask, request, jsonify
import json
import os
import time
import requests

app = Flask(__name__)

# 从配置文件加载AI配置
def load_ai_config():
    config_file = 'ai_provider_config.json'
    if os.path.exists(config_file):
        try:
            with open(config_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        except:
            pass
    return {'provider': 'DeepSeek', 'apiKey': '', 'baseURL': 'https://api.deepseek.com', 'model': 'deepseek-chat'}

ai_config = load_ai_config()

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok', 'timestamp': int(time.time())})

@app.route('/ai/analyze/single', methods=['POST'])
def ai_analyze_single():
    start_time = time.time()
    
    try:
        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'error': 'No data'}), 400
        
        symbol = data.get('symbol', 'AAPL').upper()
        print(f'\n[测试后端] AI分析请求: {symbol}')
        
        # 1. 检查AI配置
        api_key = ai_config.get('apiKey', '')
        print(f'[测试后端] API密钥: {api_key[:10]}... (长度: {len(api_key)})')
        
        if not api_key:
            return jsonify({
                'success': False,
                'error': 'API key not configured',
                'stage': 'config',
                'provider': ai_config.get('provider', 'DeepSeek')
            }), 400
        
        # 2. 测试DeepSeek API
        headers = {'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'}
        payload = {
            'model': ai_config.get('model', 'deepseek-chat'),
            'messages': [{'role': 'user', 'content': 'Test connection'}],
            'max_tokens': 10
        }
        
        try:
            response = requests.post(
                f"{ai_config.get('baseURL', 'https://api.deepseek.com')}/chat/completions",
                headers=headers,
                json=payload,
                timeout=10
            )
            
            print(f'[测试后端] DeepSeek API响应: {response.status_code}')
            
            if response.status_code == 200:
                # API密钥有效，返回模拟的成功响应
                return jsonify({
                    'success': True,
                    'symbol': symbol,
                    'trend': 'Bullish',
                    'overallScore': 75,
                    'aiReasoning': 'AI analysis successful with valid API key',
                    'provenance': {
                        'marketData': 'simulated',
                        'news': 'simulated',
                        'companyInfo': 'simulated',
                        'aiAnalysis': 'deepseek'
                    },
                    'hasAiData': True,
                    'timestamp': int(time.time()),
                    'responseTime': round(time.time() - start_time, 3),
                    'message': 'AI analysis successful'
                })
            elif response.status_code == 401:
                # API密钥无效
                return jsonify({
                    'success': False,
                    'error': 'DeepSeek API returned 401 Unauthorized',
                    'stage': 'ai_request',
                    'provider': 'DeepSeek',
                    'symbol': symbol,
                    'timestamp': int(time.time()),
                    'responseTime': round(time.time() - start_time, 3),
                    'message': 'API key invalid or expired'
                }), 401
            else:
                # 其他错误
                return jsonify({
                    'success': False,
                    'error': f'DeepSeek API error: {response.status_code}',
                    'stage': 'ai_request',
                    'provider': 'DeepSeek',
                    'symbol': symbol,
                    'timestamp': int(time.time()),
                    'responseTime': round(time.time() - start_time, 3)
                }), response.status_code
                
        except requests.exceptions.Timeout:
            return jsonify({
                'success': False,
                'error': 'DeepSeek API timeout',
                'stage': 'ai_request',
                'provider': 'DeepSeek',
                'symbol': symbol,
                'timestamp': int(time.time()),
                'responseTime': round(time.time() - start_time, 3)
            }), 408
        except Exception as e:
            return jsonify({
                'success': False,
                'error': f'DeepSeek API exception: {str(e)}',
                'stage': 'ai_request',
                'provider': 'DeepSeek',
                'symbol': symbol,
                'timestamp': int(time.time()),
                'responseTime': round(time.time() - start_time, 3)
            }), 500
            
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'Server error: {str(e)}',
            'timestamp': int(time.time())
        }), 500

if __name__ == '__main__':
    print("="*60)
    print("简单测试后端启动")
    print("端口: 8889")
    print("端点: /health, /ai/analyze/single")
    print("="*60)
    
    # 显示当前配置
    print(f"\n当前AI配置:")
    print(f"  Provider: {ai_config.get('provider')}")
    print(f"  API密钥: {ai_config.get('apiKey', '')[:10]}... (长度: {len(ai_config.get('apiKey', ''))})")
    print(f"  Base URL: {ai_config.get('baseURL')}")
    print(f"  Model: {ai_config.get('model')}")
    
    app.run(host='127.0.0.1', port=8889, debug=False, use_reloader=False)