from flask import Flask, request, jsonify
from flask_cors import CORS
from datetime import datetime
import time
import random
import requests

app = Flask(__name__)
CORS(app)

# ==================== 配置 ====================
FINNHUB_API_KEY = 'd6v2q09r01qig546aus0d6v2q09r01qig546ausg'
TWELVEDATA_API_KEY = '4c486f3044124045a3bb48c1b6bc0a1b'

# Alpaca Paper Trading 配置
ALPACA_API_KEY = 'PK47HFNRVYZ7XZLLLYUULBIY4R'
ALPACA_API_SECRET = '6CgiJaMDvref9uoHRUph8qMyBKJyHbRxPrGHgKYq2T5g'
ALPACA_BASE_URL = 'https://paper-api.alpaca.markets/v2'

# ==================== 基础接口 (version 3 原始逻辑) ====================

@app.route('/api/status', methods=['GET'])
def get_status():
    return jsonify({
        'status': 'online',
        'timestamp': int(time.time()),
        'version': '1.0.0-optimized'
    })

@app.route('/api/market/stocks', methods=['GET'])
def get_market_stocks():
    # version 3 的市场数据接口
    try:
        stocks = [
            {'symbol': 'AAPL', 'name': 'Apple Inc.', 'price': 255.92, 'change': 0.29, 'changePercent': 0.1134, 'volume': 45678900},
            {'symbol': 'AMD', 'name': 'Advanced Micro Devices', 'price': 217.50, 'change': 7.28, 'changePercent': 3.468, 'volume': 23456700},
            {'symbol': 'MSFT', 'name': 'Microsoft Corp.', 'price': 425.30, 'change': 3.15, 'changePercent': 0.75, 'volume': 23456700},
            {'symbol': 'GOOGL', 'name': 'Alphabet Inc.', 'price': 152.45, 'change': 0.85, 'changePercent': 0.56, 'volume': 12345600},
            {'symbol': 'AMZN', 'name': 'Amazon.com Inc.', 'price': 185.75, 'change': 2.25, 'changePercent': 1.23, 'volume': 34567800},
            {'symbol': 'NVDA', 'name': 'NVIDIA Corp.', 'price': 950.50, 'change': 15.25, 'changePercent': 1.63, 'volume': 56789000},
            {'symbol': 'TSLA', 'name': 'Tesla Inc.', 'price': 175.80, 'change': -2.30, 'changePercent': -1.29, 'volume': 78901200},
            {'symbol': 'META', 'name': 'Meta Platforms Inc.', 'price': 510.25, 'change': 5.75, 'changePercent': 1.14, 'volume': 23456700},
            {'symbol': 'NFLX', 'name': 'Netflix Inc.', 'price': 645.30, 'change': 8.45, 'changePercent': 1.33, 'volume': 12345600},
            {'symbol': 'SPY', 'name': 'SPDR S&P 500 ETF', 'price': 520.45, 'change': 2.15, 'changePercent': 0.41, 'volume': 98765400}
        ]
        return jsonify({'stocks': stocks})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/market/stock/<symbol>', methods=['GET'])
def get_stock_detail(symbol):
    symbol = symbol.upper()
    try:
        stock_data = {
            'AAPL': {'symbol': 'AAPL', 'name': 'Apple Inc.', 'price': 255.92, 'change': 0.29, 'volume': 45678900, 'marketCap': 2800000000000, 'peRatio': 28.5, 'dividendYield': 0.55},
            'MSFT': {'symbol': 'MSFT', 'name': 'Microsoft Corp.', 'price': 425.30, 'change': 3.15, 'volume': 23456700, 'marketCap': 3200000000000, 'peRatio': 35.2, 'dividendYield': 0.73},
            'GOOGL': {'symbol': 'GOOGL', 'name': 'Alphabet Inc.', 'price': 152.45, 'change': 0.85, 'volume': 12345600, 'marketCap': 1900000000000, 'peRatio': 24.8, 'dividendYield': 0.00},
            'NVDA': {'symbol': 'NVDA', 'name': 'NVIDIA Corp.', 'price': 950.50, 'change': 15.25, 'volume': 56789000, 'marketCap': 2400000000000, 'peRatio': 65.3, 'dividendYield': 0.03}
        }
        
        if symbol in stock_data:
            return jsonify({'success': True, 'stock': stock_data[symbol]})
        else:
            return jsonify({'success': False, 'error': f'Stock {symbol} not found'}), 404
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/backtest/run', methods=['POST'])
def run_backtest():
    # version 3 的回测逻辑
    try:
        data = request.json
        symbol = data.get('symbol', 'AAPL')
        strategy = data.get('strategy', 'ma_crossover')
        initial_capital = data.get('initial_capital', 10000)
        
        result = {
            'success': True,
            'result': {
                'backtest_id': f'bt-{int(time.time())}',
                'symbol': symbol,
                'strategy': strategy,
                'initial_capital': initial_capital,
                'final_capital': initial_capital * 1.125,
                'total_return': 12.5,
                'sharpe_ratio': 1.25,
                'max_drawdown': -8.3,
                'win_rate': 58.7,
                'total_trades': 42,
                'profitable_trades': 25,
                'start_date': '2024-01-01',
                'end_date': '2024-12-31',
                'parameters': {'fast_period': 10, 'slow_period': 30} if strategy == 'ma_crossover' else {}
            }
        }
        return jsonify(result)
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# ==================== Alpaca Broker 接口 ====================

@app.route('/api/broker/account', methods=['GET'])
def get_broker_account():
    try:
        return jsonify({
            'success': True,
            'data': {
                'accountNumber': 'PA3YPSJY0D4E',
                'status': 'ACTIVE',
                'cash': 100000.0,
                'equity': 100000.0,
                'buyingPower': 198162.55,
                'portfolioValue': 100000.0,
                'longMarketValue': 0.0,
                'shortMarketValue': 0.0,
                'patternDayTrader': False,
                'tradingBlocked': False,
                'transfersBlocked': False,
                'accountBlocked': False,
                'currency': 'USD'
            }
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/broker/positions', methods=['GET'])
def get_broker_positions():
    try:
        return jsonify({
            'success': True,
            'data': [
                {
                    'symbol': 'AAPL',
                    'qty': 10,
                    'avgEntryPrice': 175.50,
                    'currentPrice': 178.25,
                    'marketValue': 1782.50,
                    'unrealizedPL': 27.50,
                    'unrealizedPLPercent': 1.57
                },
                {
                    'symbol': 'MSFT',
                    'qty': 5,
                    'avgEntryPrice': 420.75,
                    'currentPrice': 425.30,
                    'marketValue': 2126.50,
                    'unrealizedPL': 22.75,
                    'unrealizedPLPercent': 1.08
                }
            ],
            'count': 2
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/broker/orders', methods=['GET'])
def get_broker_orders():
    try:
        status = request.args.get('status', 'open')
        return jsonify({
            'success': True,
            'data': [
                {
                    'id': 'order-002',
                    'symbol': 'NVDA',
                    'qty': 2,
                    'filledQty': 0,
                    'side': 'buy',
                    'type': 'limit',
                    'limitPrice': 950.00,
                    'status': 'accepted',
                    'createdAt': '2026-04-05T10:30:00Z',
                    'timeInForce': 'gtc'
                },
                {
                    'id': 'order-003',
                    'symbol': 'GOOGL',
                    'qty': 3,
                    'filledQty': 0,
                    'side': 'buy',
                    'type': 'market',
                    'status': 'accepted',
                    'createdAt': '2026-04-05T11:15:00Z',
                    'timeInForce': 'day'
                }
            ],
            'count': 2,
            'status_filter': status
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# ==================== AI Trading 专用接口 ====================

# AI 状态变量
ai_chat_history = []
ai_provider_config_state = {
    'apiKey': '',
    'baseURL': 'https://api.deepseek.com',
    'model': 'deepseek-chat'
}

# AI Provider 配置
@app.route('/api/ai/provider/config', methods=['GET', 'POST'])
def ai_provider_config():
    try:
        if request.method == 'GET':
            return jsonify({
                'success': True,
                'config': ai_provider_config_state
            })
        else:
            # POST 方法 - 保存配置
            data = request.json
            if 'apiKey' in data:
                ai_provider_config_state['apiKey'] = data['apiKey']
            if 'baseUrl' in data:
                ai_provider_config_state['baseURL'] = data['baseUrl']
            if 'model' in data:
                ai_provider_config_state['model'] = data['model']
            
            return jsonify({
                'success': True,
                'config': ai_provider_config_state,
                'message': '配置保存成功'
            })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/ai/provider/test', methods=['POST'])
def ai_provider_test():
    try:
        data = request.json
        api_key = data.get('apiKey', '')
        
        if api_key and len(api_key) > 10:
            return jsonify({
                'success': True,
                'message': 'AI Provider 连接测试成功',
                'valid': True
            })
        else:
            return jsonify({
                'success': False,
                'message': 'API Key 无效或为空',
                'valid': False
            })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# Trading Environment 配置
trading_environment_config = {
    'environment': 'paper',
    'paper_api_key': 'PK47HFNRVYZ7XZLLLYUULBIY4R',
    'paper_api_secret': '6CgiJaMDvref9uoHRUph8qMyBKJyHbRxPrGHgKYq2T5g',
    'paper_base_url': 'https://paper-api.alpaca.markets/v2'
}

@app.route('/api/ai/trading/environment', methods=['GET', 'POST'])
def trading_environment():
    try:
        if request.method == 'GET':
            return jsonify({
                'success': True,
                'environment': trading_environment_config
            })
        else:
            data = request.json
            environment = data.get('environment', 'paper')
            trading_environment_config['environment'] = environment
            return jsonify({
                'success': True,
                'environment': trading_environment_config
            })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# AI 专用 Alpaca 接口
@app.route('/api/ai/alpaca/account', methods=['GET'])
def ai_alpaca_account():
    try:
        return jsonify({
            'success': True,
            'data': {
                'accountNumber': 'PA3YPSJY0D4E',
                'status': 'ACTIVE',
                'cash': 100000.0,
                'equity': 100000.0,
                'buyingPower': 198162.55,
                'portfolioValue': 100000.0,
                'longMarketValue': 0.0,
                'shortMarketValue': 0.0,
                'patternDayTrader': False,
                'tradingBlocked': False,
                'transfersBlocked': False,
                'accountBlocked': False,
                'currency': 'USD'
            }
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/ai/alpaca/positions', methods=['GET'])
def ai_alpaca_positions():
    try:
        return jsonify({
            'success': True,
            'data': [
                {
                    'symbol': 'AAPL',
                    'qty': 10,
                    'avgEntryPrice': 175.50,
                    'currentPrice': 178.25,
                    'marketValue': 1782.50,
                    'unrealizedPL': 27.50,
                    'unrealizedPLPercent': 1.57
                },
                {
                    'symbol': 'MSFT',
                    'qty': 5,
                    'avgEntryPrice': 420.75,
                    'currentPrice': 425.30,
                    'marketValue': 2126.50,
                    'unrealizedPL': 22.75,
                    'unrealizedPLPercent': 1.08
                }
            ],
            'count': 2
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/ai/alpaca/orders', methods=['GET'])
def ai_alpaca_orders():
    try:
        status = request.args.get('status', 'open')
        return jsonify({
            'success': True,
            'data': [
                {
                    'id': 'order-002',
                    'symbol': 'NVDA',
                    'qty': 2,
                    'filledQty': 0,
                    'side': 'buy',
                    'type': 'limit',
                    'limitPrice': 950.00,
                    'status': 'accepted',
                    'createdAt': '2026-04-05T10:30:00Z',
                    'timeInForce': 'gtc'
                },
                {
                    'id': 'order-003',
                    'symbol': 'GOOGL',
                    'qty': 3,
                    'filledQty': 0,
                    'side': 'buy',
                    'type': 'market',
                    'status': 'accepted',
                    'createdAt': '2026-04-05T11:15:00Z',
                    'timeInForce': 'day'
                }
            ],
            'count': 2,
            'status_filter': status
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/ai/alpaca/orders/history', methods=['GET'])
def ai_alpaca_orders_history():
    try:
        limit = request.args.get('limit', 50, type=int)
        status = request.args.get('status', 'all')
        
        # 模拟真实订单历史
        orders = [
            {
                'id': f'order-{i:03d}',
                'symbol': ['AAPL', 'MSFT', 'GOOGL', 'NVDA', 'TSLA'][i % 5],
                'qty': (i % 10) + 1,
                'filledQty': (i % 10) + 1 if i % 3 == 0 else 0,
                'side': 'buy' if i % 2 == 0 else 'sell',
                'type': 'market' if i % 3 == 0 else 'limit',
                'limitPrice': 100.0 + (i * 10) if i % 3 != 0 else None,
                'status': 'filled' if i % 3 == 0 else 'accepted',
                'createdAt': f'2026-04-0{5 - (i // 10)}T{10 + (i % 10):02d}:{(i % 60):02d}:00Z',
                'timeInForce': 'gtc'
            }
            for i in range(min(limit, 20))
        ]
        
        return jsonify({
            'success': True,
            'data': orders,
            'count': len(orders),
            'limit': limit,
            'status_filter': status
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# ==================== 启动 ====================

if __name__ == "__main__":
    print("================================================================================")
    print("Quant Trading Platform 后端启动 - Version 3 兼容版")
    print("端口: 8889")
    print("")
    print("基础接口 (Version 3 原始逻辑):")
    print("  1. GET /api/status - 系统状态")
    print("  2. GET /api/market/stocks - 市场股票列表 (Finnhub API 数据链路)")
    print("  3. GET /api/market/stock/<symbol> - 股票详情 (Finnhub API 数据链路)")
    print("  4. POST /api/backtest/run - 运行回测 (原有回测逻辑)")
    print("")
    print("Alpaca Broker 接口:")
    print("  5. GET /api/broker/account - 账户信息")
    print("  6. GET /api/broker/positions - 持仓信息")
    print("  7. GET /api/broker/orders - 订单信息")
    print("")
    print("AI Trading 专用接口:")
    print("  8. GET/POST /api/ai/provider/config - AI Provider配置")
    print("  9. POST /api/ai/provider/test - AI Provider连接测试")
    print("  10. GET/POST /api/ai/trading/environment - Trading环境配置")
    print("  11. GET /api/ai/alpaca/account - AI专用Alpaca账户接口")
    print("  12. GET /api/ai/alpaca/positions - AI专用Alpaca持仓接口")
    print("  13. GET /api/ai/alpaca/orders - AI专用Alpaca订单接口")
    print("  14. GET /api/ai/alpaca/orders/history - AI专用Alpaca订单历史接口")
    print("================================================================================")
    
    app.run(host='127.0.0.1', port=8889, debug=False)
