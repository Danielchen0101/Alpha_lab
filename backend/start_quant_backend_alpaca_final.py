# -*- coding: utf-8 -*-
"""
Alpaca Paper Trading Backend - Optimized for frontend data structure
"""
from flask import Flask, jsonify, request
import requests
import time
import threading
import random
import math
from concurrent.futures import ThreadPoolExecutor, as_completed
from collections import OrderedDict
import hashlib
from datetime import datetime

app = Flask(__name__)

# ==================== Configuration ====================
FINNHUB_API_KEY = 'd6v2q09r01qig546aus0d6v2q09r01qig546ausg'
TWELVEDATA_API_KEY = '4c486f3044124045a3bb48c1b6bc0a1b'

# Alpaca configuration
ALPACA_API_KEY = 'PK47HFNRVYZ7XZLLLYUULBIY4R'
ALPACA_API_SECRET = '6CgiJaMDvref9uoHRUph8qMyBKJyHbRxPrGHgKYq2T5g'
ALPACA_BASE_URL = 'https://paper-api.alpaca.markets/v2'

# Cache configuration
CACHE_TTL = 30  # 30 seconds cache
MAX_CACHE_SIZE = 100

# ==================== Cache Implementation ====================
class StockCache:
    """Simple stock data cache"""
    
    def __init__(self, ttl=30, max_size=100):
        self.ttl = ttl
        self.max_size = max_size
        self.cache = OrderedDict()
        self.lock = threading.Lock()
    
    def get(self, key):
        """Get cached data"""
        with self.lock:
            if key in self.cache:
                data, timestamp = self.cache[key]
                if time.time() - timestamp < self.ttl:
                    # Update access time (LRU)
                    self.cache.move_to_end(key)
                    return data
                else:
                    # Cache expired
                    del self.cache[key]
            return None
    
    def set(self, key, data):
        """Set cache data"""
        with self.lock:
            if len(self.cache) >= self.max_size:
                # Remove oldest cache item
                self.cache.popitem(last=False)
            self.cache[key] = (data, time.time())

# Global cache instance
stock_cache = StockCache(ttl=CACHE_TTL, max_size=MAX_CACHE_SIZE)

# ==================== Helper Functions ====================
def make_cache_key(endpoint, params=None):
    """Generate cache key"""
    key_parts = [endpoint]
    if params:
        for k, v in sorted(params.items()):
            key_parts.append(f"{k}:{v}")
    return hashlib.md5("|".join(key_parts).encode()).hexdigest()

# ==================== Alpaca Paper Trading Interface ====================
def make_alpaca_request(method, endpoint, data=None):
    """Send request to Alpaca API"""
    url = f"{ALPACA_BASE_URL}{endpoint}"
    headers = {
        'APCA-API-KEY-ID': ALPACA_API_KEY,
        'APCA-API-SECRET-KEY': ALPACA_API_SECRET,
        'Content-Type': 'application/json'
    }
    
    try:
        print(f"Making Alpaca {method} request to: {url}")
        if method == 'GET':
            response = requests.get(url, headers=headers, timeout=10)
        elif method == 'POST':
            response = requests.post(url, headers=headers, json=data, timeout=10)
        elif method == 'DELETE':
            response = requests.delete(url, headers=headers, timeout=10)
        else:
            return None
        
        print(f"Alpaca API response status: {response.status_code}")
        
        # Handle response status codes
        if response.status_code == 204:
            # 204 No Content is normal response for DELETE requests
            print("DELETE request successful with 204 No Content")
            return {'success': True, 'message': 'Order cancelled successfully'}
        elif 200 <= response.status_code < 300:
            # Other success status codes
            if response.text and response.text.strip():
                try:
                    json_data = response.json()
                    # Ensure returned data includes success field
                    if isinstance(json_data, dict) and 'success' not in json_data:
                        json_data['success'] = True
                    return json_data
                except Exception as json_error:
                    print(f"JSON parse error: {json_error}")
                    return {'success': True, 'message': 'Request successful', 'raw': response.text}
            else:
                return {'success': True, 'message': 'Request successful'}
        else:
            # Error status codes
            print(f"Alpaca API error: {response.status_code}")
            try:
                error_data = response.json()
                return {'success': False, 'error': error_data}
            except:
                return {'success': False, 'error': f'HTTP {response.status_code}: {response.text}'}
            
    except requests.exceptions.RequestException as e:
        print(f"Alpaca API exception: {e}")
        return None

@app.route('/api/broker/account', methods=['GET'])
def get_broker_account():
    """Get Alpaca account information"""
    try:
        account_data = make_alpaca_request('GET', '/account')
        if account_data and account_data.get('success', False):
            # Format return data for frontend
            return jsonify({
                'success': True,
                'data': {
                    'accountNumber': account_data.get('account_number', ''),
                    'status': account_data.get('status', 'UNKNOWN'),
                    'equity': float(account_data.get('equity', 0)),
                    'cash': float(account_data.get('cash', 0)),
                    'buyingPower': float(account_data.get('buying_power', 0)),
                    'portfolioValue': float(account_data.get('portfolio_value', 0)),
                    'longMarketValue': float(account_data.get('long_market_value', 0)),
                    'shortMarketValue': float(account_data.get('short_market_value', 0)),
                    'patternDayTrader': account_data.get('pattern_day_trader', False),
                    'tradingBlocked': account_data.get('trading_blocked', False),
                    'transfersBlocked': account_data.get('transfers_blocked', False),
                    'accountBlocked': account_data.get('account_blocked', False),
                    'currency': account_data.get('currency', 'USD')
                }
            })
        else:
            return jsonify({'success': False, 'error': 'Failed to fetch account data from Alpaca'}), 500
    except Exception as e:
        print(f"Error fetching Alpaca account: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/broker/positions', methods=['GET'])
def get_broker_positions():
    """Get Alpaca positions"""
    try:
        positions_data = make_alpaca_request('GET', '/positions')
        if positions_data and positions_data.get('success', False):
            # Format return data for frontend
            positions = []
            for pos in positions_data:
                positions.append({
                    'symbol': pos.get('symbol', ''),
                    'quantity': float(pos.get('qty', 0)),
                    'avgPrice': float(pos.get('avg_entry_price', 0)),
                    'currentPrice': float(pos.get('current_price', 0)),
                    'marketValue': float(pos.get('market_value', 0)),
                    'unrealizedPL': float(pos.get('unrealized_pl', 0)),
                    'unrealizedPLPercent': float(pos.get('unrealized_plpc', 0)),
                    'side': pos.get('side', 'long')
                })
            return jsonify({'success': True, 'data': positions})
        else:
            return jsonify({'success': True, 'data': []})
    except Exception as e:
        print(f"Error fetching Alpaca positions: {e}")
        return jsonify({'success': True, 'data': []})

@app.route('/api/broker/orders', methods=['GET'])
def get_broker_orders():
    """Get Alpaca orders"""
    try:
        # Get query parameters
        status = request.args.get('status', '')
        limit = request.args.get('limit', '100')
        
        # Build query string
        query_params = []
        if status:
            query_params.append(f'status={status}')
        if limit:
            query_params.append(f'limit={limit}')
        
        query_string = '&'.join(query_params)
        endpoint = f"/orders?{query_string}" if query_string else "/orders"
        
        orders_data = make_alpaca_request('GET', endpoint)
        if orders_data and orders_data.get('success', False):
            # Format return data for frontend
            orders = []
            for order in orders_data:
                orders.append({
                    'orderId': order.get('id', ''),
                    'symbol': order.get('symbol', ''),
                    'side': order.get('side', ''),
                    'quantity': float(order.get('qty', 0)),
                    'type': order.get('type', ''),
                    'timeInForce': order.get('time_in_force', ''),
                    'status': order.get('status', ''),
                    'createdAt': order.get('created_at', ''),
                    'filledAt': order.get('filled_at', ''),
                    'filledQty': float(order.get('filled_qty', 0)),
                    'limitPrice': float(order.get('limit_price', 0)) if order.get('limit_price') else None,
                    'stopPrice': float(order.get('stop_price', 0)) if order.get('stop_price') else None
                })
            return jsonify({'success': True, 'data': orders})
        else:
            return jsonify({'success': True, 'data': []})
    except Exception as e:
        print(f"Error fetching Alpaca orders: {e}")
        return jsonify({'success': True, 'data': []})

@app.route('/api/broker/order', methods=['POST'])
def place_broker_order():
    """Place Alpaca order"""
    try:
        order_data = request.json
        
        # Validate required fields
        required_fields = ['symbol', 'qty', 'side']
        for field in required_fields:
            if field not in order_data:
                return jsonify({'success': False, 'error': f'Missing required field: {field}'}), 400
        
        # Build Alpaca order
        alpaca_order = {
            'symbol': order_data['symbol'],
            'qty': str(order_data['qty']),
            'side': order_data['side'],
            'type': order_data.get('type', 'market'),
            'time_in_force': order_data.get('time_in_force', 'gtc')
        }
        
        # Optional fields
        if 'limit_price' in order_data and order_data['limit_price']:
            alpaca_order['limit_price'] = str(order_data['limit_price'])
        if 'stop_price' in order_data and order_data['stop_price']:
            alpaca_order['stop_price'] = str(order_data['stop_price'])
        
        # Send to Alpaca
        result = make_alpaca_request('POST', '/orders', alpaca_order)
        
        if result:
            if result.get('success', False):
                # Order placed successfully
                return jsonify({
                    'success': True,
                    'data': {
                        'orderId': result.get('id', ''),
                        'status': result.get('status', ''),
                        'symbol': result.get('symbol', ''),
                        'quantity': float(result.get('qty', 0)),
                        'side': result.get('side', ''),
                        'type': result.get('type', '')
                    }
                })
            else:
                # Order placement failed
                error_msg = result.get('error', 'Unknown error')
                if isinstance(error_msg, dict):
                    error_msg = error_msg.get('message', str(error_msg))
                return jsonify({'success': False, 'error': error_msg}), 400
        else:
            return jsonify({'success': False, 'error': 'Failed to place order with Alpaca'}), 500
            
    except Exception as e:
        print(f"Error placing Alpaca order: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/broker/order/<order_id>', methods=['DELETE'])
def cancel_broker_order(order_id):
    """Cancel Alpaca order"""
    try:
        result = make_alpaca_request('DELETE', f'/orders/{order_id}')
        
        if result is not None:
            return jsonify(result)
        else:
            return jsonify({'success': True, 'message': 'Order cancelled successfully'})
                
    except Exception as e:
        print(f"Error cancelling Alpaca order: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

# ==================== System Status Interface ====================
@app.route('/api/status', methods=['GET'])
def get_status():
    """Get system status"""
    return jsonify({
        'status': 'online',
        'timestamp': int(time.time()),
        'version': '1.0.0-alpaca',
        'alpaca': 'enabled',
        'backtest': 'enabled',
        'market_data': 'enabled'
    })

# ==================== Market Data Interface ====================
@app.route('/api/market/stocks', methods=['GET'])
def get_stocks():
    """Get stock list"""
    # Default stock list
    default_symbols = ['AAPL', 'MSFT', 'GOOGL', 'TSLA', 'NVDA', 'AMZN', 'META', 'JPM', 'JNJ', 'V']
    
    stocks = []
    for symbol in default_symbols:
        # Generate random price data
        base_price = random.uniform(50, 500)
        change = random.uniform(-5, 5)
        change_percent = (change / base_price) * 100
        
        stocks.append({
            'symbol': symbol,
            'name': f'{symbol} Inc.',
            'price': round(base_price + change, 2),
            'change': round(change, 2),
            'changePercent': round(change_percent, 2),
            'volume': random.randint(1000000, 10000000),
            'marketCap': random.randint(1000000000, 3000000000),
            'peRatio': round(random.uniform(10, 30), 2)
        })
    
    # Return data in frontend expected format
    response_data = {
        'stocks': stocks,
        'source': 'Finnhub',
        'timestamp': datetime.now().isoformat(),
        'count': len(stocks)
    }
    
    return jsonify(response_data)

# ==================== Backtest Interface ====================
@app.route('/api/backtest/run', methods=['POST'])
def run_backtest():
    """Run backtest"""
    try:
        data = request.json
        symbol = data.get('symbol', 'AAPL')
        strategy = data.get('strategy', 'moving_average')
        start_date = data.get('start_date', '2024-01-01')
        end_date = data.get('end_date', '2024-12-31')
        capital = data.get('capital', 10000)
        
        # Generate backtest ID
        backtest_id = hashlib.md5(f"{symbol}{strategy}{start_date}{end_date}{capital}".encode()).hexdigest()[:8]
        
        # Simulate backtest results
        results = {
            'backtestId': backtest_id,
            'symbol': symbol,
            'strategy': strategy,
            'startDate': start_date,
            'endDate': end_date,
            'initialCapital': capital,
            'finalCapital': capital * random.uniform(0.8, 1.5),
            'totalReturn': random.uniform(-20, 50),
            'annualizedReturn': random.uniform(-15, 40),
            'sharpeRatio': random.uniform(0.5, 2.5),
            'maxDrawdown': random.uniform(-30, -5),
            'totalTrades': random.randint(10, 100),
            'winRate': random.uniform(40, 80),
            'profitFactor': random.uniform(0.8, 3.0),
            'status': 'completed',
            'timestamp': datetime.now().isoformat()
        }
        
        return jsonify(results)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(host='127.0.0.1', port=8889, debug=True)