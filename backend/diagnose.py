"""
诊断问题：为什么只有1个股票
"""

from flask import Flask, request, jsonify
import requests
import time

app = Flask(__name__)

# API配置
FINNHUB_API_KEY = 'd6qsdcpr01qgdhqc82hgd6qsdcpr01qgdhqc82i0'

# 默认股票列表
DEFAULT_SYMBOLS = ['AAPL', 'MSFT', 'GOOGL', 'TSLA', 'NVDA', 'AMZN', 'META', 'JPM', 'JNJ', 'V']

@app.route('/api/market/stocks', methods=['GET'])
def get_market_stocks():
    print("=== /api/market/stocks 被调用 ===")
    
    try:
        # 获取参数
        symbols_param = request.args.get('symbols', '')
        print(f"symbols参数: '{symbols_param}'")
        
        # 确定股票列表
        if symbols_param:
            symbols = [s.strip().upper() for s in symbols_param.split(',') if s.strip()]
            print(f"使用参数symbols: {symbols}")
        else:
            symbols = DEFAULT_SYMBOLS
            print(f"使用默认symbols: {symbols}")
        
        print(f"总共 {len(symbols)} 支股票")
        
        stocks = []
        
        for symbol in symbols:
            print(f"处理股票: {symbol}")
            try:
                # 从Finnhub获取数据
                quote_url = "https://finnhub.io/api/v1/quote"
                params = {
                    'symbol': symbol,
                    'token': FINNHUB_API_KEY
                }
                
                print(f"  Finnhub请求: {symbol}")
                response = requests.get(quote_url, params=params, timeout=3)
                print(f"  Finnhub响应状态: {response.status_code}")
                
                if response.status_code == 200:
                    quote_data = response.json()
                    print(f"  Finnhub数据: {quote_data}")
                    
                    current_price = quote_data.get('c', 0)
                    previous_close = quote_data.get('pc', 0)
                    change = current_price - previous_close
                    change_percent = (change / previous_close * 100) if previous_close > 0 else 0
                    
                    stock_data = {
                        "symbol": symbol,
                        "name": f"{symbol} Inc.",
                        "price": round(float(current_price), 2),
                        "change": round(float(change), 2),
                        "changePercent": round(float(change_percent), 2),
                        "dataSource": "Finnhub"
                    }
                    
                    stocks.append(stock_data)
                    print(f"  ✓ 添加 {symbol}: ${current_price:.2f}")
                else:
                    print(f"  ✗ Finnhub失败: {response.status_code}")
                    stocks.append({
                        "symbol": symbol,
                        "name": f"{symbol} Inc.",
                        "price": 0,
                        "change": 0,
                        "changePercent": 0,
                        "dataSource": "Finnhub (失败)"
                    })
                    
            except Exception as e:
                print(f"  ✗ 异常: {e}")
                stocks.append({
                    "symbol": symbol,
                    "name": f"{symbol} Inc.",
                    "price": 0,
                    "change": 0,
                    "changePercent": 0,
                    "dataSource": "Finnhub (异常)"
                })
        
        print(f"=== 返回 {len(stocks)} 支股票 ===")
        
        response_data = {
            "stocks": stocks,
            "count": len(stocks),
            "dataSource": "Finnhub",
            "timestamp": int(time.time())
        }
        
        return jsonify(response_data), 200
        
    except Exception as e:
        print(f"=== 主函数异常: {e} ===")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    print("诊断版本启动...")
    print("端口: 8890")
    app.run(host='127.0.0.1', port=8890, debug=True, use_reloader=False)