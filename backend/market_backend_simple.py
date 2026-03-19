"""
最小化市场数据后端 - 只负责市场数据层
"""

import os
import json
import logging
from datetime import datetime, timedelta
from flask import Flask, request, jsonify
from flask_cors import CORS

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# 创建Flask应用
app = Flask(__name__)
CORS(app)

# Polygon API配置
POLYGON_API_KEY = "Pb17vE12y3eH4ixU_P3or5W89TfFbN7E"
POLYGON_BASE_URL = "https://api.polygon.io"

# 简单Polygon客户端
import requests

class SimplePolygonClient:
    def __init__(self):
        self.api_key = POLYGON_API_KEY
        self.base_url = POLYGON_BASE_URL
    
    def make_request(self, endpoint, params=None):
        """发送请求到Polygon API"""
        try:
            url = f"{self.base_url}{endpoint}"
            if params is None:
                params = {}
            params["apiKey"] = self.api_key
            
            logger.info(f"请求Polygon API: {endpoint}")
            response = requests.get(url, params=params, timeout=10)
            
            if response.status_code == 200:
                return response.json()
            else:
                logger.error(f"Polygon API错误: {response.status_code}")
                return {"error": f"API错误: {response.status_code}"}
        except Exception as e:
            logger.error(f"Polygon API请求异常: {e}")
            return {"error": f"请求异常: {str(e)}"}

# 创建客户端实例
polygon_client = SimplePolygonClient()

@app.route('/api/health', methods=['GET'])
def health_check():
    """健康检查"""
    return jsonify({
        "status": "healthy",
        "service": "market-data-backend",
        "timestamp": datetime.now().isoformat(),
        "polygon_available": True
    })

@app.route('/api/market/stock/<symbol>', methods=['GET'])
def get_stock_detail(symbol):
    """获取单个股票详细信息"""
    try:
        # 1. 获取股票基本信息
        ticker_details = polygon_client.make_request(
            f"/v3/reference/tickers/{symbol.upper()}"
        )
        
        if "error" in ticker_details:
            logger.error(f"获取股票详情失败: {ticker_details['error']}")
            return jsonify({
                "symbol": symbol.upper(),
                "error": ticker_details["error"],
                "dataSource": "Polygon.io (failed)"
            }), 500
        
        # 2. 获取最新聚合数据
        today = datetime.now().strftime("%Y-%m-%d")
        yesterday = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
        
        aggregates = polygon_client.make_request(
            f"/v2/aggs/ticker/{symbol.upper()}/range/1/day/{yesterday}/{today}"
        )
        
        # 3. 获取上一个交易日数据
        previous_close = polygon_client.make_request(
            f"/v2/aggs/ticker/{symbol.upper()}/prev"
        )
        
        # 构建响应
        result = {
            "symbol": symbol.upper(),
            "name": ticker_details.get("results", {}).get("name") if ticker_details.get("results") else None,
            "price": aggregates.get("results", [{}])[0].get("c") if aggregates.get("results") else None,
            "change": aggregates.get("results", [{}])[0].get("c") - previous_close.get("results", [{}])[0].get("c") if aggregates.get("results") and previous_close.get("results") else None,
            "changePercent": None,  # 需要计算
            "dayHigh": aggregates.get("results", [{}])[0].get("h") if aggregates.get("results") else None,
            "dayLow": aggregates.get("results", [{}])[0].get("l") if aggregates.get("results") else None,
            "previousClose": previous_close.get("results", [{}])[0].get("c") if previous_close.get("results") else None,
            "marketCap": ticker_details.get("results", {}).get("market_cap") if ticker_details.get("results") else None,
            "sector": ticker_details.get("results", {}).get("sector") if ticker_details.get("results") else None,
            "industry": ticker_details.get("results", {}).get("industry") if ticker_details.get("results") else None,
            "currency": ticker_details.get("results", {}).get("currency_name") if ticker_details.get("results") else None,
            "volume": aggregates.get("results", [{}])[0].get("v") if aggregates.get("results") else None,
            "dataSource": "Polygon.io",
            "timestamp": datetime.now().isoformat()
        }
        
        # 计算涨跌幅
        if result["price"] and result["previousClose"]:
            result["changePercent"] = ((result["price"] - result["previousClose"]) / result["previousClose"]) * 100
        
        logger.info(f"✅ 从Polygon.io获取{symbol}数据成功")
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"获取股票详情失败 {symbol}: {e}")
        return jsonify({
            "symbol": symbol.upper(),
            "error": str(e),
            "dataSource": "Polygon.io (error)"
        }), 500

@app.route('/api/market/history/<symbol>', methods=['GET'])
def get_stock_history(symbol):
    """获取股票历史价格数据"""
    try:
        # 获取查询参数
        interval = request.args.get('interval', '1day')
        range_param = request.args.get('range', '1month')
        
        # 转换时间范围
        timeframe_map = {
            '1D': ('5', 'minute', 1),
            '1W': ('1', 'day', 7),
            '1M': ('1', 'day', 30),
            '3M': ('1', 'day', 90),
            '1Y': ('1', 'day', 365)
        }
        
        if range_param in timeframe_map:
            multiplier, timespan, days = timeframe_map[range_param]
        else:
            multiplier, timespan, days = ('1', 'day', 30)
        
        # 计算日期范围
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days)
        
        # 获取历史数据
        historical_data = polygon_client.make_request(
            f"/v2/aggs/ticker/{symbol.upper()}/range/{multiplier}/{timespan}/{start_date.strftime('%Y-%m-%d')}/{end_date.strftime('%Y-%m-%d')}"
        )
        
        if "error" in historical_data:
            logger.error(f"获取历史数据失败: {historical_data['error']}")
            return jsonify({
                "symbol": symbol.upper(),
                "error": historical_data["error"],
                "source": "Polygon.io (failed)"
            }), 500
        
        # 转换数据格式
        formatted_data = []
        for item in historical_data.get("results", []):
            formatted_data.append({
                "timestamp": item.get("t") // 1000 if item.get("t") else None,
                "time": item.get("t"),
                "open": item.get("o"),
                "high": item.get("h"),
                "low": item.get("l"),
                "close": item.get("c"),
                "volume": item.get("v")
            })
        
        result = {
            "symbol": symbol.upper(),
            "interval": f"{multiplier}{timespan}",
            "range": range_param,
            "data": formatted_data,
            "count": len(formatted_data),
            "source": "Polygon.io",
            "message": f"Historical data from Polygon.io"
        }
        
        logger.info(f"✅ 从Polygon.io获取{symbol}历史数据成功: {len(formatted_data)}个数据点")
        return jsonify(result), 200
        
    except Exception as e:
        logger.error(f"获取历史数据失败 {symbol}: {e}")
        return jsonify({
            "symbol": symbol.upper(),
            "error": str(e),
            "source": "Polygon.io (error)"
        }), 500

@app.route('/api/market/stocks', methods=['GET'])
def get_stocks():
    """获取股票市场数据"""
    try:
        # 获取查询参数
        symbols = request.args.get('symbols', 'AAPL,MSFT,GOOGL,TSLA,NVDA')
        symbol_list = [s.strip().upper() for s in symbols.split(',')]
        
        stocks = []
        for symbol in symbol_list:
            try:
                # 获取股票数据
                ticker_details = polygon_client.make_request(
                    f"/v3/reference/tickers/{symbol}"
                )
                
                # 获取最新价格
                today = datetime.now().strftime("%Y-%m-%d")
                yesterday = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
                
                aggregates = polygon_client.make_request(
                    f"/v2/aggs/ticker/{symbol}/range/1/day/{yesterday}/{today}"
                )
                
                if "error" not in ticker_details and aggregates and aggregates.get("results"):
                    # 获取聚合数据
                    agg_results = aggregates.get("results", [])
                    if agg_results:
                        stock_data = {
                            "symbol": symbol,
                            "name": ticker_details.get("results", {}).get("name") if ticker_details.get("results") else None,
                            "price": agg_results[0].get("c"),
                            "volume": agg_results[0].get("v"),
                            "marketCap": ticker_details.get("results", {}).get("market_cap") if ticker_details.get("results") else None,
                            "sector": ticker_details.get("results", {}).get("sector") if ticker_details.get("results") else None,
                            "dataSource": "Polygon.io"
                        }
                        stocks.append(stock_data)
                    else:
                        logger.warning(f"股票{symbol}没有聚合数据")
                else:
                    logger.warning(f"股票{symbol}数据不完整")
                    
            except Exception as e:
                logger.warning(f"获取股票{symbol}数据失败: {e}")
                continue
        
        result = {
            "count": len(stocks),
            "source": "Polygon.io",
            "stocks": stocks,
            "message": f"Market data from Polygon.io"
        }
        
        logger.info(f"✅ 从Polygon.io获取{len(stocks)}只股票数据成功")
        return jsonify(result), 200
        
    except Exception as e:
        logger.error(f"获取股票列表失败: {e}")
        return jsonify({
            "error": str(e),
            "source": "Polygon.io (error)"
        }), 500

if __name__ == '__main__':
    port = 8890  # 使用不同端口避免冲突
    logger.info(f"启动市场数据后端服务...")
    logger.info(f"地址: http://127.0.0.1:{port}")
    logger.info(f"API端点:")
    logger.info(f"  GET /api/health")
    logger.info(f"  GET /api/market/stock/<symbol>")
    logger.info(f"  GET /api/market/history/<symbol>")
    logger.info(f"  GET /api/market/stocks")
    
    app.run(host='127.0.0.1', port=port, debug=False, use_reloader=False)