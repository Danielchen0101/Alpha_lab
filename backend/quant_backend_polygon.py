"""
quant_backend.py 的 Polygon 集成版本
只修改市场数据相关函数，保持其他函数不变
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# 导入原始文件
from quant_backend import app, logger, jsonify, request

# 尝试导入Polygon服务
try:
    from polygon_service import PolygonService
    POLYGON_AVAILABLE = True
except ImportError as e:
    print(f"Warning: Cannot import PolygonService: {e}")
    POLYGON_AVAILABLE = False
    PolygonService = None

# 创建Polygon服务实例
if POLYGON_AVAILABLE:
    polygon_service = PolygonService()
else:
    polygon_service = None
    print("Warning: PolygonService not available, will use fallback")

@app.route('/api/market/stock/<symbol>', methods=['GET'])
def get_stock_detail_polygon(symbol):
    """获取单个股票详细信息 - 使用 Polygon API"""
    try:
        # 检查Polygon服务是否可用
        if not POLYGON_AVAILABLE or polygon_service is None:
            logger.warning("PolygonService not available, using fallback")
            from quant_backend import get_stock_detail
            return get_stock_detail(symbol)
        
        # 1. 获取股票基本信息
        ticker_details = polygon_service.get_ticker_details(symbol)
        
        if "error" in ticker_details:
            logger.error(f"Polygon API 错误: {ticker_details['error']}")
            # 回退到原始实现
            from quant_backend import get_stock_detail
            return get_stock_detail(symbol)
        
        # 2. 获取股票聚合数据（最新报价）
        aggregates = polygon_service.get_aggregates(symbol, "day", 1, 1)
        
        # 3. 获取上一个交易日数据
        previous_close = polygon_service.get_previous_close(symbol)
        
        # 构建响应数据
        result = {
            "symbol": symbol.upper(),
            "name": ticker_details.get("name"),
            "price": aggregates.get("close") if aggregates else None,
            "change": aggregates.get("change") if aggregates else None,
            "changePercent": aggregates.get("changePercent") if aggregates else None,
            "dayHigh": aggregates.get("high") if aggregates else None,
            "dayLow": aggregates.get("low") if aggregates else None,
            "previousClose": previous_close.get("close") if previous_close else None,
            "marketCap": ticker_details.get("market_cap"),
            "sector": ticker_details.get("sector"),
            "industry": ticker_details.get("industry"),
            "currency": ticker_details.get("currency"),
            "peRatio": ticker_details.get("pe_ratio"),
            "dividendYield": ticker_details.get("dividend_yield"),
            "yearHigh": ticker_details.get("high_52_week"),
            "yearLow": ticker_details.get("low_52_week"),
            "volume": aggregates.get("volume") if aggregates else None,
            "dataSource": "Polygon.io",
            "timestamp": aggregates.get("timestamp") if aggregates else None
        }
        
        logger.info(f"✅ 从 Polygon.io 获取 {symbol} 数据成功")
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"获取股票详情失败 {symbol}: {e}")
        # 回退到原始实现
        from quant_backend import get_stock_detail
        return get_stock_detail(symbol)

@app.route('/api/market/history/<symbol>', methods=['GET'])
def get_stock_history_polygon(symbol):
    """获取股票历史价格数据 - 使用 Polygon API"""
    try:
        # 获取查询参数
        interval = request.args.get('interval', '1day')
        range_param = request.args.get('range', '1month')
        
        # 转换时间范围
        timeframe_map = {
            '1D': ('5min', '1day'),
            '1W': ('1day', '1week'),
            '1M': ('1day', '1month'),
            '3M': ('1day', '3month'),
            '1Y': ('1day', '1year')
        }
        
        # 如果使用简写，转换为Polygon参数
        if range_param in timeframe_map:
            interval, range_param = timeframe_map[range_param]
        
        # 计算天数
        days_map = {
            '1day': 1,
            '1week': 7,
            '1month': 30,
            '3month': 90,
            '1year': 365
        }
        days = days_map.get(range_param, 30)
        
        # 获取历史数据
        historical_data = polygon_service.get_historical_data(symbol, interval, days)
        
        if "error" in historical_data:
            logger.error(f"Polygon API 历史数据错误: {historical_data['error']}")
            # 回退到原始实现
            from quant_backend import get_stock_history
            return get_stock_history(symbol)
        
        # 转换数据格式
        formatted_data = []
        for item in historical_data.get("results", []):
            formatted_data.append({
                "timestamp": item.get("t") // 1000 if item.get("t") else None,  # 毫秒转秒
                "time": item.get("t"),
                "open": item.get("o"),
                "high": item.get("h"),
                "low": item.get("l"),
                "close": item.get("c"),
                "volume": item.get("v")
            })
        
        result = {
            "symbol": symbol.upper(),
            "interval": interval,
            "range": range_param,
            "data": formatted_data,
            "count": len(formatted_data),
            "source": "Polygon.io",
            "message": f"Historical data from Polygon.io"
        }
        
        logger.info(f"✅ 从 Polygon.io 获取 {symbol} 历史数据成功: {len(formatted_data)} 个数据点")
        return jsonify(result), 200
        
    except Exception as e:
        logger.error(f"获取历史数据失败 {symbol}: {e}")
        # 回退到原始实现
        from quant_backend import get_stock_history
        return get_stock_history(symbol)

@app.route('/api/market/stocks', methods=['GET'])
def get_stocks_polygon():
    """获取股票市场数据 - 使用 Polygon API"""
    try:
        # 获取查询参数
        symbols = request.args.get('symbols', 'AAPL,MSFT,GOOGL,TSLA,NVDA,AMZN,META')
        symbol_list = [s.strip().upper() for s in symbols.split(',')]
        
        stocks = []
        for symbol in symbol_list:
            try:
                # 获取股票数据
                ticker_details = polygon_service.get_ticker_details(symbol)
                aggregates = polygon_service.get_aggregates(symbol, "day", 1, 1)
                
                if "error" not in ticker_details and aggregates:
                    stock_data = {
                        "symbol": symbol,
                        "name": ticker_details.get("name"),
                        "price": aggregates.get("close"),
                        "change": aggregates.get("change"),
                        "changePercent": aggregates.get("changePercent"),
                        "volume": aggregates.get("volume"),
                        "marketCap": ticker_details.get("market_cap"),
                        "sector": ticker_details.get("sector"),
                        "industry": ticker_details.get("industry"),
                        "currency": ticker_details.get("currency"),
                        "dataSource": "Polygon.io",
                        "timestamp": aggregates.get("timestamp")
                    }
                    stocks.append(stock_data)
                    
            except Exception as e:
                logger.warning(f"获取股票 {symbol} 数据失败: {e}")
                continue
        
        result = {
            "count": len(stocks),
            "source": "Polygon.io",
            "stocks": stocks,
            "message": f"Market data from Polygon.io"
        }
        
        logger.info(f"✅ 从 Polygon.io 获取 {len(stocks)} 只股票数据成功")
        return jsonify(result), 200
        
    except Exception as e:
        logger.error(f"获取股票列表失败: {e}")
        # 回退到原始实现
        from quant_backend import get_stocks
        return get_stocks()

# 测试函数
if __name__ == "__main__":
    print("=== Testing Polygon Integration ===")
    
    # 测试获取股票详情
    print("\n1. Testing get_stock_detail_polygon('AAPL'):")
    with app.test_request_context():
        result = get_stock_detail_polygon('AAPL')
        print(f"   Result: {result}")
    
    # 测试获取历史数据
    print("\n2. Testing get_stock_history_polygon('AAPL'):")
    with app.test_request_context():
        result = get_stock_history_polygon('AAPL')
        print(f"   Result: {result}")
    
    # 测试获取股票列表
    print("\n3. Testing get_stocks_polygon():")
    with app.test_request_context():
        result = get_stocks_polygon()
        print(f"   Result: {result}")
    
    print("\n=== Testing Complete ===")