"""
修复版本：让Polygon真正工作
只修改市场数据相关函数，保持其他函数不变
"""

import os
import json
import logging
from datetime import datetime, timedelta
from flask import Flask, request, jsonify
from flask_cors import CORS
import requests

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# 创建Flask应用
app = Flask(__name__)
CORS(app)

# Polygon API配置（保留但不使用）
POLYGON_API_KEY = "Pb17vE12y3eH4ixU_P3or5W89TfFbN7E"
POLYGON_BASE_URL = "https://api.polygon.io"

class PolygonService:
    """简单的Polygon服务"""
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

# 创建Polygon服务实例（保留但不使用）
polygon_service = PolygonService()

# 导入Finnhub服务
try:
    from finnhub_service import finnhub_service
    FINNHUB_AVAILABLE = True
    logger.info("✅ FinnhubService 初始化成功")
except ImportError as e:
    logger.warning(f"⚠️ 无法导入FinnhubService: {e}")
    FINNHUB_AVAILABLE = False
    finnhub_service = None

@app.route('/api/health', methods=['GET'])
def health_check():
    """健康检查"""
    return jsonify({
        "status": "healthy",
        "service": "quant-backend",
        "timestamp": datetime.now().isoformat(),
        "polygon_available": True
    })

@app.route('/api/market/stock/<symbol>', methods=['GET'])
def get_stock_detail(symbol):
    """获取单个股票详细信息 - 优先使用 Finnhub API"""
    try:
        symbol = symbol.upper()
        logger.info(f"获取股票详情: {symbol}")
        
        # 优先使用Finnhub
        if FINNHUB_AVAILABLE and finnhub_service:
            logger.info(f"使用Finnhub获取{symbol}数据")
            stock_data = finnhub_service.get_stock_data(symbol)
            
            if "error" in stock_data:
                logger.error(f"从Finnhub获取{symbol}数据失败: {stock_data['error']}")
                # Fallback到Polygon
                logger.warning(f"Finnhub失败，回退到Polygon获取{symbol}")
            else:
                logger.info(f"✅ 从Finnhub获取{symbol}数据成功: ${stock_data.get('price')}")
                return jsonify(stock_data)
        
        # Fallback: 使用Polygon（保留原有逻辑）
        logger.warning(f"使用Polygon获取{symbol}数据")
        
        # 1. 获取股票基本信息
        ticker_details = polygon_service.make_request(
            f"/v3/reference/tickers/{symbol}"
        )
        
        if "error" in ticker_details:
            logger.error(f"获取股票详情失败: {ticker_details['error']}")
            return jsonify({
                "symbol": symbol,
                "error": ticker_details["error"],
                "dataSource": "Polygon.io (failed)"
            }), 500
        
        # 2. 获取前收盘价数据（免费API可用）
        previous_close = polygon_service.make_request(
            f"/v2/aggs/ticker/{symbol}/prev"
        )
        
        # 解析数据
        ticker_info = ticker_details.get("results", {})
        prev_results = previous_close.get("results", [{}])[0] if previous_close.get("results") else {}
        
        # 获取前收盘价数据
        prev_close = prev_results.get("c")  # 前收盘价
        
        # 方案2：保留price字段但明确标识
        price = prev_close  # 注意：这是前收盘价，不是当前价格
        
        # 构建响应
        result = {
            "symbol": symbol,
            "name": ticker_info.get("name"),
            "price": price,  # 前收盘价（不是实时价格）
            "priceType": "previous_close",  # 明确标识价格类型
            "change": None,  # 无法计算涨跌额
            "changePercent": None,  # 无法计算涨跌幅
            "dayHigh": prev_results.get("h"),  # 前一日最高价
            "dayLow": prev_results.get("l"),   # 前一日最低价
            "previousClose": prev_close,  # 前收盘价
            "marketCap": ticker_info.get("market_cap"),
            "sector": None,  # Polygon免费API不提供sector字段
            "industry": None,  # Polygon免费API不提供industry字段
            "currency": ticker_info.get("currency_name"),
            "volume": prev_results.get("v"),
            "dataSource": "Polygon.io (Free Plan)",
            "pricingMode": "previous_close_only",  # 价格模式
            "realtimeAvailable": False,  # 实时数据不可用
            "changeDataAvailable": False,  # 涨跌幅数据不可用
            "timestamp": datetime.now().isoformat()
        }
        
        logger.info(f"✅ 从Polygon.io获取{symbol}数据成功: ${price}")
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"获取股票详情失败 {symbol}: {e}")
        return jsonify({
            "symbol": symbol.upper() if 'symbol' in locals() else 'UNKNOWN',
            "error": str(e),
            "dataSource": "Finnhub (error)"
        }), 500

@app.route('/api/market/history/<symbol>', methods=['GET'])
def get_stock_history(symbol):
    """获取股票历史价格数据 - 使用 Finnhub API"""
    try:
        symbol = symbol.upper()
        
        # 获取查询参数（前端传递的是Finnhub标准的resolution）
        resolution = request.args.get('interval', 'D')  # Finnhub标准：1, 5, 15, 30, 60, D, W, M
        range_param = request.args.get('range', '1month')
        
        logger.info(f"获取Finnhub历史数据: {symbol}, resolution={resolution}, range={range_param}")
        
        # 优先使用Finnhub
        if not FINNHUB_AVAILABLE or not finnhub_service:
            logger.error("Finnhub服务不可用")
            return jsonify({
                "symbol": symbol,
                "error": "Finnhub服务不可用",
                "source": "Finnhub (unavailable)"
            }), 503
        
        # 智能时间范围计算（考虑交易日和实际需求）
        to_time = int(datetime.now().timestamp())
        
        # 根据range_param和resolution计算from_time
        if range_param == '1day':
            # 对于1天视图，特殊处理
            if resolution in ['1', '5', '15', '30', '60']:  # 分钟级数据
                # 获取过去3个交易日的数据，确保有足够的日内数据
                # 计算最近一个交易日的开盘时间（美东时间9:30）
                now = datetime.now()
                
                # 如果是周末，调整到最近的周五
                if now.weekday() >= 5:  # 5=周六, 6=周日
                    # 回退到周五
                    days_to_subtract = now.weekday() - 4  # 周六减1天，周日减2天
                    last_trading_day = now - timedelta(days=days_to_subtract)
                else:
                    last_trading_day = now
                
                # 设置交易时间为美东时间9:30-16:00
                # 简单处理：获取过去3天数据
                from_time = to_time - (3 * 24 * 60 * 60)
                logger.info(f"1day日内图: 获取过去3天数据，确保有完整的交易日")
            else:
                # 日线或以上粒度
                from_time = to_time - (24 * 60 * 60)
        elif range_param == '1week':
            from_time = to_time - (7 * 24 * 60 * 60)
        elif range_param == '1month':
            from_time = to_time - (30 * 24 * 60 * 60)
        elif range_param == '3month':
            from_time = to_time - (90 * 24 * 60 * 60)
        elif range_param == '1year':
            from_time = to_time - (365 * 24 * 60 * 60)
        else:
            from_time = to_time - (30 * 24 * 60 * 60)  # 默认1个月
        
        logger.info(f"时间范围计算: range={range_param}, resolution={resolution}, from={from_time}({datetime.fromtimestamp(from_time)}), to={to_time}({datetime.fromtimestamp(to_time)})")
        
        logger.info(f"请求Finnhub candle数据: {symbol}, resolution={resolution}, from={from_time}({datetime.fromtimestamp(from_time)}) to={to_time}({datetime.fromtimestamp(to_time)})")
        
        # 调用Finnhub candle API（带fallback机制）
        logger.info(f"调用Finnhub API: symbol={symbol}, resolution={resolution}, from={from_time}({datetime.fromtimestamp(from_time)}), to={to_time}({datetime.fromtimestamp(to_time)})")
        candle_data = finnhub_service.get_stock_candle(symbol, resolution, from_time, to_time)
        
        # 检查是否需要fallback（特别是对于1day日内图）
        need_fallback = False
        fallback_resolution = None
        
        if "error" in candle_data:
            logger.error(f"从Finnhub获取历史数据失败: {candle_data['error']}")
            need_fallback = True
        elif candle_data.get('s') != 'ok':
            error_msg = candle_data.get('s', 'unknown error')
            logger.error(f"Finnhub candle API返回错误状态: {error_msg}")
            need_fallback = True
        elif range_param == '1day' and resolution in ['1', '5', '15', '30', '60']:
            # 检查是否返回了足够的数据点
            timestamps = candle_data.get('t', [])
            if len(timestamps) <= 2:
                logger.warning(f"1day日内图数据不足: 只返回{len(timestamps)}个数据点，尝试fallback")
                need_fallback = True
        
        # Fallback机制：如果60分钟数据不可用，尝试30分钟，然后15分钟
        if need_fallback and range_param == '1day':
            fallback_sequence = ['60', '30', '15', '5', '1']
            current_index = fallback_sequence.index(resolution) if resolution in fallback_sequence else 0
            
            for i in range(current_index + 1, len(fallback_sequence)):
                fallback_resolution = fallback_sequence[i]
                logger.info(f"尝试fallback resolution: {fallback_resolution}")
                
                # 重新调用API
                candle_data = finnhub_service.get_stock_candle(symbol, fallback_resolution, from_time, to_time)
                
                if "error" not in candle_data and candle_data.get('s') == 'ok':
                    timestamps = candle_data.get('t', [])
                    if len(timestamps) > 2:
                        logger.info(f"✅ Fallback成功: 使用{fallback_resolution}获取了{len(timestamps)}个数据点")
                        resolution = fallback_resolution  # 更新使用的resolution
                        break
                    else:
                        logger.warning(f"Fallback {fallback_resolution}仍然数据不足: {len(timestamps)}个点")
                else:
                    logger.warning(f"Fallback {fallback_resolution}失败: {candle_data.get('s', 'error')}")
        
        # 最终检查 - 只接受真实的Finnhub candle数据
        if "error" in candle_data:
            error_msg = candle_data.get('error', 'unknown error')
            logger.error(f"从Finnhub获取历史数据失败: {error_msg}")
            return jsonify({
                "symbol": symbol,
                "error": error_msg,
                "source": "Finnhub (failed)"
            }), 500
        
        if candle_data.get('s') != 'ok':
            error_msg = candle_data.get('s', 'unknown error')
            logger.error(f"Finnhub candle API返回错误状态: {error_msg}")
            logger.error(f"Finnhub返回数据详情: {candle_data}")
            return jsonify({
                "symbol": symbol,
                "error": f"Finnhub API错误: {error_msg}",
                "source": "Finnhub (api error)"
            }), 500
        
        # 调试日志：查看实际返回的数据
        timestamps = candle_data.get('t', [])
        opens = candle_data.get('o', [])
        closes = candle_data.get('c', [])
        
        logger.info(f"Finnhub返回数据统计: {len(timestamps)}个时间戳, {len(opens)}个开盘价, {len(closes)}个收盘价")
        
        if len(timestamps) > 0:
            logger.info(f"第一个时间戳: {timestamps[0]} ({datetime.fromtimestamp(timestamps[0])})")
            logger.info(f"最后一个时间戳: {timestamps[-1]} ({datetime.fromtimestamp(timestamps[-1])})")
            logger.info(f"时间范围: {datetime.fromtimestamp(timestamps[0])} 到 {datetime.fromtimestamp(timestamps[-1])}")
        
        if len(timestamps) <= 1:
            logger.warning(f"⚠️ 警告: 只返回了{len(timestamps)}个数据点")
            logger.warning(f"请求参数: resolution={resolution}, from={from_time}, to={to_time}")
            logger.warning(f"当前时间: {datetime.now()}")
            logger.warning(f"Finnhub返回状态: {candle_data.get('s')}")
            # 仍然返回真实数据，即使只有1个点
            logger.warning(f"返回真实的Finnhub数据（{len(timestamps)}个点）")
        
        # 调试日志：查看实际返回的数据
        timestamps = candle_data.get('t', [])
        opens = candle_data.get('o', [])
        closes = candle_data.get('c', [])
        
        logger.info(f"Finnhub返回数据统计: {len(timestamps)}个时间戳, {len(opens)}个开盘价, {len(closes)}个收盘价")
        
        if len(timestamps) > 0:
            logger.info(f"第一个时间戳: {timestamps[0]} ({datetime.fromtimestamp(timestamps[0])})")
            logger.info(f"最后一个时间戳: {timestamps[-1]} ({datetime.fromtimestamp(timestamps[-1])})")
            logger.info(f"时间范围: {datetime.fromtimestamp(timestamps[0])} 到 {datetime.fromtimestamp(timestamps[-1])}")
        
        if len(timestamps) <= 1:
            logger.warning(f"⚠️ 警告: 只返回了{len(timestamps)}个数据点，可能有问题")
            logger.warning(f"请求参数: resolution={resolution}, from={from_time}, to={to_time}")
            logger.warning(f"当前时间: {datetime.now()}")
            logger.warning(f"Finnhub返回状态: {candle_data.get('s')}")
            logger.warning(f"完整返回: {candle_data}")
        
        # 转换数据格式（Finnhub返回格式）
        formatted_data = []
        timestamps = candle_data.get('t', [])
        opens = candle_data.get('o', [])
        highs = candle_data.get('h', [])
        lows = candle_data.get('l', [])
        closes = candle_data.get('c', [])
        volumes = candle_data.get('v', [])
        
        for i in range(len(timestamps)):
            formatted_data.append({
                "timestamp": timestamps[i],
                "time": timestamps[i] * 1000,  # 转换为毫秒
                "open": opens[i] if i < len(opens) else None,
                "high": highs[i] if i < len(highs) else None,
                "low": lows[i] if i < len(lows) else None,
                "close": closes[i] if i < len(closes) else None,
                "volume": volumes[i] if i < len(volumes) else None
            })
        
        result = {
            "symbol": symbol,
            "interval": resolution,  # Finnhub标准resolution
            "range": range_param,
            "data": formatted_data,
            "count": len(formatted_data),
            "source": "Finnhub",
            "message": f"Historical data from Finnhub (resolution: {resolution})"
        }
        
        logger.info(f"✅ 从Finnhub获取{symbol}历史数据成功: {len(formatted_data)}个数据点，resolution={resolution}")
        return jsonify(result), 200
        
    except Exception as e:
        logger.error(f"获取历史数据失败 {symbol}: {e}")
        return jsonify({
            "symbol": symbol.upper() if 'symbol' in locals() else 'UNKNOWN',
            "error": str(e),
            "source": "Finnhub (error)"
        }), 500

@app.route('/api/market/stocks', methods=['GET'])
def get_stocks():
    """获取股票市场数据 - 优先使用 Finnhub API"""
    try:
        # 获取查询参数 - 默认15支主要股票
        symbols = request.args.get('symbols', 'AAPL,MSFT,GOOGL,TSLA,NVDA,AMZN,META,JPM,JNJ,V,WMT,PG,UNH,HD,MA')
        symbol_list = [s.strip().upper() for s in symbols.split(',')]
        
        # 检查是否为Dashboard请求（通过referer或参数）
        is_dashboard = request.args.get('dashboard', 'false').lower() == 'true' or \
                      request.referrer and 'dashboard' in request.referrer.lower()
        
        logger.info(f"获取股票列表: {symbol_list} (dashboard={is_dashboard})")
        
        # 优先使用Finnhub
        if FINNHUB_AVAILABLE and finnhub_service:
            logger.info(f"使用Finnhub获取{len(symbol_list)}只股票数据 (dashboard={is_dashboard})")
            
            # Dashboard使用轻量级模式，其他页面使用完整模式
            result = finnhub_service.get_multiple_stocks(
                symbol_list, 
                lightweight=is_dashboard
            )
            
            # 确保返回格式兼容
            response_data = {
                "count": result.get("count", 0),
                "source": result.get("dataSource", "Finnhub"),
                "stocks": result.get("stocks", []),
                "message": "Market data from Finnhub",
                "timestamp": result.get("timestamp", datetime.now().isoformat())
            }
            
            if result.get("errors"):
                response_data["warnings"] = result["errors"]
                logger.warning(f"获取股票数据完成，但有警告: {result['errors']}")
            
            logger.info(f"✅ 从Finnhub获取{response_data['count']}只股票数据成功 (dashboard={is_dashboard})")
            return jsonify(response_data), 200
        
        # Fallback: 使用Polygon（保留原有逻辑）
        logger.warning("Finnhub不可用，回退到Polygon")
        stocks = []
        for symbol in symbol_list:
            try:
                # 1. 获取股票基本信息
                ticker_details = polygon_service.make_request(
                    f"/v3/reference/tickers/{symbol}"
                )
                
                # 2. 获取前收盘价数据（这是免费API可用的）
                previous_close = polygon_service.make_request(
                    f"/v2/aggs/ticker/{symbol}/prev"
                )
                
                if "error" not in ticker_details and previous_close and previous_close.get("results"):
                    ticker_info = ticker_details.get("results", {})
                    prev_results = previous_close.get("results", [{}])[0]
                    
                    # 获取前收盘价数据
                    prev_close = prev_results.get("c")  # 前收盘价
                    
                    # 方案2：保留price字段但明确标识
                    price = prev_close  # 注意：这是前收盘价，不是当前价格
                    
                    stock_data = {
                        "symbol": symbol,
                        "name": ticker_info.get("name"),
                        "price": price,  # 前收盘价（不是实时价格）
                        "priceType": "previous_close",  # 明确标识价格类型
                        "change": None,  # 无法计算涨跌额
                        "changePercent": None,  # 无法计算涨跌幅
                        "previousClose": prev_close,  # 前收盘价
                        "volume": prev_results.get("v"),
                        "marketCap": ticker_info.get("market_cap"),
                        "sector": None,  # Polygon免费API不提供sector字段
                        "dataSource": "Polygon.io (Free Plan)",
                        "pricingMode": "previous_close_only",  # 价格模式
                        "realtimeAvailable": False,  # 实时数据不可用
                        "changeDataAvailable": False  # 涨跌幅数据不可用
                    }
                    stocks.append(stock_data)
                    
            except Exception as e:
                logger.warning(f"获取股票{symbol}数据失败: {e}")
                continue
        
        result = {
            "count": len(stocks),
            "source": "Polygon.io (Free Plan)",
            "stocks": stocks,
            "message": f"Market data from Polygon.io Free Plan - Real-time prices require upgrade"
        }
        
        logger.info(f"✅ 从Polygon.io免费计划获取{len(stocks)}只股票数据成功")
        return jsonify(result), 200
        
    except Exception as e:
        logger.error(f"获取股票列表失败: {e}")
        return jsonify({
            "error": str(e),
            "source": "Finnhub (error)"
        }), 500

# ========== Alpaca 交易执行层 ==========

# 导入Alpaca服务
try:
    from alpaca_service import AlpacaService
    alpaca_service = AlpacaService()
    ALPACA_AVAILABLE = True
    logger.info("✅ AlpacaService 初始化成功")
except ImportError as e:
    logger.warning(f"⚠️ 无法导入AlpacaService: {e}")
    ALPACA_AVAILABLE = False
    alpaca_service = None

@app.route('/api/trading/account', methods=['GET'])
def get_trading_account():
    """获取交易账户信息"""
    if not ALPACA_AVAILABLE or not alpaca_service:
        return jsonify({
            "error": "Alpaca服务不可用",
            "dataSource": "Alpaca Markets (unavailable)"
        }), 503
    
    try:
        account_data = alpaca_service.get_account()
        
        if "error" in account_data:
            logger.error(f"获取账户信息失败: {account_data['error']}")
            return jsonify({
                "error": account_data["error"],
                "dataSource": "Alpaca Markets (failed)"
            }), 500
        
        formatted_account = alpaca_service.format_account_summary(account_data)
        logger.info(f"✅ 获取账户信息成功")
        return jsonify(formatted_account)
        
    except Exception as e:
        logger.error(f"获取账户信息失败: {e}")
        return jsonify({
            "error": str(e),
            "dataSource": "Alpaca Markets (error)"
        }), 500

@app.route('/api/trading/positions', methods=['GET'])
def get_trading_positions():
    """获取所有持仓"""
    if not ALPACA_AVAILABLE or not alpaca_service:
        return jsonify({
            "error": "Alpaca服务不可用",
            "dataSource": "Alpaca Markets (unavailable)"
        }), 503
    
    try:
        positions = alpaca_service.get_positions()
        
        if isinstance(positions, list):
            formatted_positions = [alpaca_service.format_position(pos) for pos in positions]
            logger.info(f"✅ 获取持仓成功: {len(formatted_positions)}个持仓")
            return jsonify({
                "count": len(formatted_positions),
                "positions": formatted_positions,
                "dataSource": "Alpaca Markets"
            })
        else:
            logger.error(f"获取持仓失败: {positions.get('error', '未知错误')}")
            return jsonify({
                "error": positions.get("error", "获取持仓失败"),
                "dataSource": "Alpaca Markets (failed)"
            }), 500
        
    except Exception as e:
        logger.error(f"获取持仓失败: {e}")
        return jsonify({
            "error": str(e),
            "dataSource": "Alpaca Markets (error)"
        }), 500

@app.route('/api/trading/orders', methods=['GET'])
def get_trading_orders():
    """获取订单列表"""
    if not ALPACA_AVAILABLE or not alpaca_service:
        return jsonify({
            "error": "Alpaca服务不可用",
            "dataSource": "Alpaca Markets (unavailable)"
        }), 503
    
    try:
        status = request.args.get('status', 'open')
        limit = int(request.args.get('limit', 100))
        
        orders = alpaca_service.get_orders(status=status, limit=limit)
        
        if isinstance(orders, list):
            formatted_orders = [alpaca_service.format_order(order) for order in orders]
            logger.info(f"✅ 获取订单成功: {len(formatted_orders)}个订单")
            return jsonify({
                "count": len(formatted_orders),
                "status": status,
                "orders": formatted_orders,
                "dataSource": "Alpaca Markets"
            })
        else:
            logger.error(f"获取订单失败: {orders.get('error', '未知错误')}")
            return jsonify({
                "error": orders.get("error", "获取订单失败"),
                "dataSource": "Alpaca Markets (failed)"
            }), 500
        
    except Exception as e:
        logger.error(f"获取订单失败: {e}")
        return jsonify({
            "error": str(e),
            "dataSource": "Alpaca Markets (error)"
        }), 500

@app.route('/api/trading/order', methods=['POST'])
def submit_trading_order():
    """提交新订单"""
    if not ALPACA_AVAILABLE or not alpaca_service:
        return jsonify({
            "error": "Alpaca服务不可用",
            "dataSource": "Alpaca Markets (unavailable)"
        }), 503
    
    try:
        order_data = request.get_json()
        
        if not order_data:
            return jsonify({
                "error": "请求体为空",
                "dataSource": "Alpaca Markets"
            }), 400
        
        # 提交订单
        result = alpaca_service.submit_order(order_data)
        
        if "error" in result:
            logger.error(f"提交订单失败: {result['error']}")
            return jsonify({
                "error": result["error"],
                "dataSource": "Alpaca Markets (failed)"
            }), 500
        
        formatted_order = alpaca_service.format_order(result)
        logger.info(f"✅ 提交订单成功: {formatted_order.get('symbol')} {formatted_order.get('side')} {formatted_order.get('qty')}股")
        return jsonify(formatted_order)
        
    except Exception as e:
        logger.error(f"提交订单失败: {e}")
        return jsonify({
            "error": str(e),
            "dataSource": "Alpaca Markets (error)"
        }), 500

@app.route('/api/trading/cancel/<order_id>', methods=['DELETE'])
def cancel_trading_order(order_id):
    """取消订单"""
    if not ALPACA_AVAILABLE or not alpaca_service:
        return jsonify({
            "error": "Alpaca服务不可用",
            "dataSource": "Alpaca Markets (unavailable)"
        }), 503
    
    try:
        result = alpaca_service.cancel_order(order_id)
        
        if "error" in result:
            logger.error(f"取消订单失败: {result['error']}")
            return jsonify({
                "error": result["error"],
                "dataSource": "Alpaca Markets (failed)"
            }), 500
        
        logger.info(f"✅ 取消订单成功: {order_id}")
        return jsonify({
            "order_id": order_id,
            "status": "cancelled",
            "message": "订单已取消",
            "dataSource": "Alpaca Markets"
        })
        
    except Exception as e:
        logger.error(f"取消订单失败: {e}")
        return jsonify({
            "error": str(e),
            "dataSource": "Alpaca Markets (error)"
        }), 500



if __name__ == '__main__':
    port = 8889
    logger.info(f"启动量化平台后端服务...")
    logger.info(f"地址: http://127.0.0.1:{port}")
    logger.info(f"API端点:")
    logger.info(f"  GET /api/health")
    logger.info(f"  GET /api/market/stock/<symbol>")
    logger.info(f"  GET /api/market/history/<symbol>")
    logger.info(f"  GET /api/market/stocks")
    logger.info(f"  GET /api/trading/account")
    logger.info(f"  GET /api/trading/positions")
    logger.info(f"  GET /api/trading/orders")
    logger.info(f"  POST /api/trading/order")
    logger.info(f"  DELETE /api/trading/cancel/<order_id>")
    
    app.run(host='127.0.0.1', port=port, debug=False, use_reloader=False)