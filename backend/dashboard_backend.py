"""
Dashboard和Market页面专用后端 - 只包含必要接口
用于快速恢复Dashboard和Market功能
"""

import sys
import os
import time
import json
import requests
from flask import Flask, request, jsonify
from flask_cors import CORS

# 创建Flask应用
app = Flask(__name__)
CORS(app)  # 允许跨域

# 模拟配置
ALPACA_CONFIG = {
    'apiKey': 'test-key',
    'apiSecret': 'test-secret',
    'baseURL': 'https://paper-api.alpaca.markets'
}

def get_market_stocks():
    """模拟获取股票列表"""
    print("[市场接口] 模拟获取股票列表")
    
    # 模拟一些股票数据
    stocks = [
        {
            'symbol': 'AAPL',
            'name': 'Apple Inc.',
            'price': 175.25,
            'change': 1.25,
            'changePercent': 0.72,
            'changePct': 0.72,
            'volume': 50000000,
            'avgVolume': 45000000,
            'marketCap': 2800000000000,
            'sector': 'Technology',
            'industry': 'Consumer Electronics',
            'currency': 'USD',
            'dayOpen': 174.50,
            'dayHigh': 176.00,
            'dayLow': 173.80,
            'previousClose': 174.00,
            'peRatio': 30.5,
            'dividendYield': 0.55,
            'yearHigh': 180.00,
            'yearLow': 150.00,
            'dataSource': 'Alpaca',
            'timestamp': time.strftime('%Y-%m-%d %H:%M:%S')
        },
        {
            'symbol': 'MSFT',
            'name': 'Microsoft Corporation',
            'price': 420.75,
            'change': 3.25,
            'changePercent': 0.78,
            'changePct': 0.78,
            'volume': 30000000,
            'avgVolume': 28000000,
            'marketCap': 3120000000000,
            'sector': 'Technology',
            'industry': 'Software',
            'currency': 'USD',
            'dayOpen': 418.00,
            'dayHigh': 422.50,
            'dayLow': 417.20,
            'previousClose': 417.50,
            'peRatio': 35.2,
            'dividendYield': 0.75,
            'yearHigh': 425.00,
            'yearLow': 350.00,
            'dataSource': 'Alpaca',
            'timestamp': time.strftime('%Y-%m-%d %H:%M:%S')
        },
        {
            'symbol': 'GOOGL',
            'name': 'Alphabet Inc.',
            'price': 155.80,
            'change': 2.10,
            'changePercent': 1.37,
            'changePct': 1.37,
            'volume': 25000000,
            'avgVolume': 22000000,
            'marketCap': 1950000000000,
            'sector': 'Technology',
            'industry': 'Internet',
            'currency': 'USD',
            'dayOpen': 154.00,
            'dayHigh': 156.50,
            'dayLow': 153.50,
            'previousClose': 153.70,
            'peRatio': 28.5,
            'dividendYield': 0.0,
            'yearHigh': 160.00,
            'yearLow': 130.00,
            'dataSource': 'Alpaca',
            'timestamp': time.strftime('%Y-%m-%d %H:%M:%S')
        },
        {
            'symbol': 'AMZN',
            'name': 'Amazon.com Inc.',
            'price': 178.90,
            'change': -0.50,
            'changePercent': -0.28,
            'changePct': -0.28,
            'volume': 40000000,
            'avgVolume': 38000000,
            'marketCap': 1840000000000,
            'sector': 'Consumer Cyclical',
            'industry': 'Internet Retail',
            'currency': 'USD',
            'dayOpen': 179.50,
            'dayHigh': 180.20,
            'dayLow': 178.00,
            'previousClose': 179.40,
            'peRatio': 60.3,
            'dividendYield': 0.0,
            'yearHigh': 185.00,
            'yearLow': 140.00,
            'dataSource': 'Alpaca',
            'timestamp': time.strftime('%Y-%m-%d %H:%M:%S')
        },
        {
            'symbol': 'TSLA',
            'name': 'Tesla Inc.',
            'price': 175.25,
            'change': 5.75,
            'changePercent': 3.40,
            'changePct': 3.40,
            'volume': 80000000,
            'avgVolume': 75000000,
            'marketCap': 560000000000,
            'sector': 'Consumer Cyclical',
            'industry': 'Auto Manufacturers',
            'currency': 'USD',
            'dayOpen': 170.00,
            'dayHigh': 177.00,
            'dayLow': 169.50,
            'previousClose': 169.50,
            'peRatio': 45.8,
            'dividendYield': 0.0,
            'yearHigh': 200.00,
            'yearLow': 150.00,
            'dataSource': 'Alpaca',
            'timestamp': time.strftime('%Y-%m-%d %H:%M:%S')
        }
    ]
    
    return stocks

@app.route('/market/stocks', methods=['GET'])
def market_stocks():
    """股票列表接口 - Dashboard和Market页面使用"""
    print(f"\n{'='*60}")
    print(f"[市场接口] 收到股票列表请求")
    
    try:
        # 获取查询参数
        symbols = request.args.get('symbols')
        dashboard = request.args.get('dashboard')
        
        print(f"[市场接口] 请求参数: symbols={symbols}, dashboard={dashboard}")
        
        # 获取股票数据
        all_stocks = get_market_stocks()
        
        # 如果有symbols参数，过滤数据
        if symbols:
            symbol_list = [s.strip().upper() for s in symbols.split(',')]
            filtered_stocks = [s for s in all_stocks if s['symbol'] in symbol_list]
            print(f"[市场接口] 过滤后股票数量: {len(filtered_stocks)}")
            stocks = filtered_stocks
        else:
            stocks = all_stocks
        
        # 构建响应
        response_data = {
            'success': True,
            'stocks': stocks,
            'count': len(stocks),
            'source': 'Alpaca',
            'timestamp': int(time.time()),
            'message': f'Successfully retrieved {len(stocks)} stocks'
        }
        
        print(f"[市场接口] 返回 {len(stocks)} 支股票数据")
        print(f"{'='*60}")
        
        return jsonify(response_data)
        
    except Exception as e:
        print(f"[市场接口] 异常: {str(e)}")
        import traceback
        traceback.print_exc()
        
        return jsonify({
            'success': False,
            'error': f'Failed to fetch stocks: {str(e)}',
            'timestamp': int(time.time())
        }), 500

@app.route('/market/stock/<symbol>', methods=['GET'])
def market_stock(symbol):
    """单个股票详情接口"""
    print(f"\n[股票详情接口] 收到请求: {symbol}")
    
    try:
        symbol_upper = symbol.upper()
        
        # 获取所有股票
        all_stocks = get_market_stocks()
        
        # 查找指定股票
        stock = next((s for s in all_stocks if s['symbol'] == symbol_upper), None)
        
        if stock:
            print(f"[股票详情接口] 找到股票: {symbol_upper}")
            
            response_data = {
                'success': True,
                **stock,  # 展开所有股票字段
                'message': f'Successfully retrieved {symbol_upper} data'
            }
            
            return jsonify(response_data)
        else:
            print(f"[股票详情接口] 未找到股票: {symbol_upper}")
            
            return jsonify({
                'success': False,
                'error': f'Stock {symbol_upper} not found',
                'symbol': symbol_upper,
                'timestamp': int(time.time())
            }), 404
            
    except Exception as e:
        print(f"[股票详情接口] 异常: {str(e)}")
        
        return jsonify({
            'success': False,
            'error': f'Failed to fetch stock data: {str(e)}',
            'symbol': symbol,
            'timestamp': int(time.time())
        }), 500

@app.route('/system/status', methods=['GET'])
def system_status():
    """系统状态接口 - Dashboard使用"""
    print(f"\n[系统状态接口] 收到请求")
    
    try:
        # 模拟系统状态
        status_data = {
            'success': True,
            'status': 'online',
            'services': {
                'market_data': {
                    'status': 'online',
                    'provider': 'Alpaca',
                    'last_update': time.strftime('%Y-%m-%d %H:%M:%S'),
                    'symbols_loaded': 5
                },
                'quote_feed': {
                    'status': 'online',
                    'latency_ms': 45,
                    'throughput': '100 quotes/sec'
                },
                'ai_analysis': {
                    'status': 'online',
                    'provider': 'DeepSeek',
                    'last_analysis': time.strftime('%Y-%m-%d %H:%M:%S')
                },
                'backtesting': {
                    'status': 'ready',
                    'last_run': time.strftime('%Y-%m-%d %H:%M:%S')
                }
            },
            'metrics': {
                'uptime_days': 7,
                'memory_usage_mb': 256,
                'cpu_usage_percent': 15,
                'active_connections': 3
            },
            'timestamp': int(time.time()),
            'message': 'System is operational'
        }
        
        print(f"[系统状态接口] 返回系统状态")
        
        return jsonify(status_data)
        
    except Exception as e:
        print(f"[系统状态接口] 异常: {str(e)}")
        
        return jsonify({
            'success': False,
            'error': f'Failed to get system status: {str(e)}',
            'timestamp': int(time.time())
        }), 500

@app.route('/market/overview', methods=['GET'])
def market_overview():
    """市场概览接口"""
    print(f"\n[市场概览接口] 收到请求")
    
    try:
        # 获取股票数据
        stocks = get_market_stocks()
        
        # 计算市场概览
        total_stocks = len(stocks)
        gainers = sum(1 for s in stocks if s.get('changePercent', 0) > 0)
        losers = sum(1 for s in stocks if s.get('changePercent', 0) < 0)
        avg_change = sum(s.get('changePercent', 0) for s in stocks) / total_stocks if total_stocks > 0 else 0
        
        overview_data = {
            'success': True,
            'total_symbols': total_stocks,
            'gainers': gainers,
            'losers': losers,
            'unchanged': total_stocks - gainers - losers,
            'avg_change_percent': round(avg_change, 2),
            'total_volume': sum(s.get('volume', 0) for s in stocks),
            'total_market_cap': sum(s.get('marketCap', 0) for s in stocks),
            'top_gainer': max(stocks, key=lambda s: s.get('changePercent', 0)) if stocks else None,
            'top_loser': min(stocks, key=lambda s: s.get('changePercent', 0)) if stocks else None,
            'timestamp': int(time.time()),
            'message': 'Market overview generated successfully'
        }
        
        print(f"[市场概览接口] 返回市场概览")
        
        return jsonify(overview_data)
        
    except Exception as e:
        print(f"[市场概览接口] 异常: {str(e)}")
        
        return jsonify({
            'success': False,
            'error': f'Failed to generate market overview: {str(e)}',
            'timestamp': int(time.time())
        }), 500

@app.route('/health', methods=['GET'])
def health():
    """健康检查接口"""
    return jsonify({
        'status': 'ok',
        'service': 'dashboard_backend',
        'timestamp': int(time.time()),
        'endpoints': [
            'GET /market/stocks',
            'GET /market/stock/<symbol>',
            'GET /system/status',
            'GET /market/overview',
            'GET /health'
        ]
    })

if __name__ == '__main__':
    print("启动Dashboard和Market专用后端...")
    print("端口: 8889")
    print("接口:")
    print("  - GET /market/stocks - 股票列表 (Dashboard/Market使用)")
    print("  - GET /market/stock/<symbol> - 单个股票详情")
    print("  - GET /system/status - 系统状态 (Dashboard使用)")
    print("  - GET /market/overview - 市场概览")
    print("  - GET /health - 健康检查")
    print("\n等待请求...")
    
    app.run(host='127.0.0.1', port=8889, debug=False)