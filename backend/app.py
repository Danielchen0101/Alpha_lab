#!/usr/bin/env python3
"""
专业量化交易平台后端 - 重构版本
使用新的服务架构：Polygon.io + Alpaca Markets
"""

import os
import sys
import json
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from functools import wraps

# Flask核心
from flask import Flask, request, jsonify, make_response
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_jwt_extended import (
    JWTManager, create_access_token, jwt_required,
    get_jwt_identity, get_jwt
)

# 导入服务
from services import polygon_service, alpaca_service, service_manager
from finnhub_service import finnhub_service
from config import DEFAULT_SYMBOLS, DATA_SOURCE, TIMEFRAME_MAP

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('logs/backend.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# 创建Flask应用
app = Flask(__name__)

# 配置
app.config.update(
    SECRET_KEY=os.getenv('SECRET_KEY', 'dev-secret-key-change-in-production'),
    JWT_SECRET_KEY=os.getenv('JWT_SECRET_KEY', 'jwt-secret-key-change-in-production'),
    JWT_ACCESS_TOKEN_EXPIRES=timedelta(hours=24),
    SQLALCHEMY_DATABASE_URI=os.getenv('DATABASE_URL', 'sqlite:///quant.db'),
    SQLALCHEMY_TRACK_MODIFICATIONS=False,
    CORS_ORIGINS=['http://localhost:3000']
)

# 初始化扩展
CORS(app, origins=app.config['CORS_ORIGINS'])
jwt = JWTManager(app)
db = SQLAlchemy(app)
migrate = Migrate(app, db)

# ========== 数据库模型 ==========

class User(db.Model):
    """用户模型"""
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(200), nullable=False)
    role = db.Column(db.String(20), default='user')  # admin, trader, viewer
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    last_login = db.Column(db.DateTime)
    is_active = db.Column(db.Boolean, default=True)
    
    # 关系
    portfolios = db.relationship('Portfolio', backref='owner', lazy=True)
    strategies = db.relationship('Strategy', backref='creator', lazy=True)
    orders = db.relationship('Order', backref='user', lazy=True)

class Portfolio(db.Model):
    """投资组合模型"""
    __tablename__ = 'portfolios'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    initial_capital = db.Column(db.Float, default=100000.0)
    current_value = db.Column(db.Float, default=100000.0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # 关系
    holdings = db.relationship('Holding', backref='portfolio', lazy=True)
    transactions = db.relationship('Transaction', backref='portfolio', lazy=True)

class Strategy(db.Model):
    """交易策略模型"""
    __tablename__ = 'strategies'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text)
    strategy_type = db.Column(db.String(50))  # trend, mean_reversion, momentum, etc.
    parameters = db.Column(db.JSON)  # 策略参数
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    is_public = db.Column(db.Boolean, default=False)
    performance_metrics = db.Column(db.JSON)  # 回测性能指标
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class Order(db.Model):
    """订单模型"""
    __tablename__ = 'orders'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    symbol = db.Column(db.String(20), nullable=False)
    order_type = db.Column(db.String(20))  # market, limit, stop
    side = db.Column(db.String(10))  # buy, sell
    quantity = db.Column(db.Float)
    price = db.Column(db.Float)
    status = db.Column(db.String(20), default='pending')  # pending, filled, cancelled
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    filled_at = db.Column(db.DateTime)

class Holding(db.Model):
    """持仓模型"""
    __tablename__ = 'holdings'
    
    id = db.Column(db.Integer, primary_key=True)
    portfolio_id = db.Column(db.Integer, db.ForeignKey('portfolios.id'), nullable=False)
    symbol = db.Column(db.String(20), nullable=False)
    quantity = db.Column(db.Float, default=0.0)
    average_price = db.Column(db.Float)
    current_price = db.Column(db.Float)
    market_value = db.Column(db.Float)
    unrealized_pnl = db.Column(db.Float)

class Transaction(db.Model):
    """交易记录模型"""
    __tablename__ = 'transactions'
    
    id = db.Column(db.Integer, primary_key=True)
    portfolio_id = db.Column(db.Integer, db.ForeignKey('portfolios.id'), nullable=False)
    symbol = db.Column(db.String(20), nullable=False)
    transaction_type = db.Column(db.String(10))  # buy, sell
    quantity = db.Column(db.Float)
    price = db.Column(db.Float)
    commission = db.Column(db.Float, default=0.0)
    total_amount = db.Column(db.Float)
    transaction_date = db.Column(db.DateTime, default=datetime.utcnow)
    notes = db.Column(db.Text)

class Watchlist(db.Model):
    """观察列表模型"""
    __tablename__ = 'watchlists'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    symbols = db.Column(db.JSON)  # 股票符号列表
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

# ========== 辅助函数 ==========

def safe_number(value, default=0):
    """安全转换数字"""
    try:
        if value is None:
            return default
        return float(value)
    except (ValueError, TypeError):
        return default

def format_currency(value):
    """格式化货币显示"""
    if value is None:
        return "--"
    
    try:
        value = float(value)
        if value >= 1_000_000_000_000:
            return f"${value/1_000_000_000_000:.2f}T"
        elif value >= 1_000_000_000:
            return f"${value/1_000_000_000:.2f}B"
        elif value >= 1_000_000:
            return f"${value/1_000_000:.2f}M"
        elif value >= 1_000:
            return f"${value/1_000:.2f}K"
        else:
            return f"${value:.2f}"
    except:
        return "--"

# ========== 系统API ==========

@app.route('/api/health', methods=['GET'])
def health_check():
    """系统健康检查"""
    try:
        # 检查服务健康状态
        services_health = service_manager.health_check()
        
        return jsonify({
            "status": "healthy",
            "services": services_health,
            "timestamp": datetime.utcnow().isoformat(),
            "version": "2.0.0"
        }), 200
    except Exception as e:
        logger.error(f"健康检查失败: {e}")
        return jsonify({
            "status": "unhealthy",
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat()
        }), 500

@app.route('/api/system/status', methods=['GET'])
def system_status():
    """系统状态"""
    return jsonify({
        "status": "running",
        "environment": os.getenv('FLASK_ENV', 'development'),
        "database": "connected" if db.engine else "disconnected",
        "services": {
            "market_data": "Polygon.io",
            "trading": "Alpaca Markets"
        },
        "timestamp": datetime.utcnow().isoformat()
    }), 200

# ========== 市场数据API (Polygon.io) ==========

@app.route('/api/market/health', methods=['GET'])
def market_health():
    """市场数据健康检查"""
    return jsonify({
        "status": "healthy",
        "service": "Polygon.io Market Data",
        "timestamp": datetime.utcnow().isoformat()
    }), 200

@app.route('/api/market/stocks', methods=['GET'])
def get_stocks():
    """获取股票市场数据 - 支持Polygon.io和Finnhub两种数据源"""
    try:
        symbols = request.args.get('symbols', ','.join(DEFAULT_SYMBOLS)).split(',')
        dashboard = request.args.get('dashboard', 'false').lower() == 'true'
        
        # 如果是Dashboard请求，使用Finnhub服务（并发处理）
        if dashboard:
            logger.info(f"Dashboard请求: {len(symbols)}只股票，使用Finnhub服务")
            
            # 使用Finnhub服务获取数据（并发处理）
            result = finnhub_service.get_multiple_stocks(symbols, use_cache=True, lightweight=True)
            
            # 转换数据结构以兼容前端
            stocks = []
            for stock in result.get('stocks', []):
                # 构建兼容前端的数据结构
                formatted_stock = {
                    "symbol": stock.get("symbol"),
                    "name": stock.get("name"),
                    "price": stock.get("price"),
                    "change": stock.get("change"),
                    "changePercent": stock.get("changePercent"),
                    "volume": stock.get("volume"),
                    "marketCap": stock.get("marketCap"),
                    "sector": stock.get("sector"),
                    "industry": stock.get("industry"),
                    "currency": stock.get("currency", "USD"),
                    "dayHigh": stock.get("dayHigh"),
                    "dayLow": stock.get("dayLow"),
                    "previousClose": stock.get("previousClose"),
                    "peRatio": stock.get("peRatio"),
                    "dividendYield": stock.get("dividendYield"),
                    "yearHigh": stock.get("yearHigh"),
                    "yearLow": stock.get("yearLow"),
                    "dataSource": stock.get("dataSource", "Finnhub"),
                    "timestamp": stock.get("timestamp")
                }
                
                # 如果有错误，添加错误信息
                if "error" in stock:
                    formatted_stock["error"] = stock.get("error")
                
                stocks.append(formatted_stock)
            
            response_data = {
                "timestamp": datetime.utcnow().isoformat(),
                "count": len(stocks),
                "stocks": stocks,
                "dataSource": "Finnhub",
                "success": True
            }
            
            # 如果有错误信息，添加到响应中
            if result.get('errors'):
                response_data["errors"] = result.get('errors')
            
            if result.get('rate_limited'):
                response_data["rate_limited"] = True
                response_data["rate_limited_symbols"] = result.get('rate_limited_symbols', [])
            
            return jsonify(response_data), 200
        
        # 非Dashboard请求，使用Polygon.io服务（保持原有逻辑）
        else:
            logger.info(f"普通市场数据请求: {len(symbols)}只股票，使用Polygon.io服务")
            
            stocks = []
            
            for symbol in symbols:
                try:
                    # 获取股票详情
                    details = polygon_service.get_ticker_details(symbol)
                    # 获取前一日收盘数据
                    prev_close = polygon_service.get_previous_close(symbol)
                    
                    # 格式化数据
                    stock_data = polygon_service.format_stock_data(symbol, details, prev_close)
                    
                    if "error" not in stock_data:
                        stocks.append(stock_data)
                    else:
                        # 添加基本数据
                        stocks.append({
                            "symbol": symbol.upper(),
                            "name": None,
                            "price": None,
                            "change": None,
                            "changePercent": None,
                            "volume": None,
                            "marketCap": None,
                            "sector": None,
                            "dataSource": DATA_SOURCE["market_data"],
                            "error": stock_data.get("error", "Unknown error")
                        })
                        
                except Exception as e:
                    logger.warning(f"获取股票 {symbol} 数据失败: {e}")
                    stocks.append({
                        "symbol": symbol.upper(),
                        "name": None,
                        "price": None,
                        "change": None,
                        "changePercent": None,
                        "volume": None,
                        "marketCap": None,
                        "sector": None,
                        "dataSource": DATA_SOURCE["market_data"],
                        "error": str(e)
                    })
            
            return jsonify({
                "timestamp": datetime.utcnow().isoformat(),
                "count": len(stocks),
                "stocks": stocks,
                "dataSource": DATA_SOURCE["market_data"],
                "success": True
            }), 200
        
    except Exception as e:
        logger.error(f"获取股票数据失败: {e}")
        return jsonify({
            "error": "获取市场数据失败",
            "dataSource": "Unknown",
            "success": False
        }), 500

@app.route('/api/market/stock/<symbol>', methods=['GET'])
def get_stock_detail(symbol):
    """获取单个股票详细信息 - 使用 Polygon.io"""
    try:
        # 获取股票详情
        details = polygon_service.get_ticker_details(symbol)
        # 获取前一日收盘数据
        prev_close = polygon_service.get_previous_close(symbol)
        
        # 格式化数据
        stock_data = polygon_service.format_stock_data(symbol, details, prev_close)
        
        if "error" in stock_data:
            return jsonify(stock_data), 400
        
        return jsonify(stock_data), 200
        
    except Exception as e:
        logger.error(f"获取股票详情失败 {symbol}: {e}")
        return jsonify({
            "symbol": symbol.upper(),
            "error": f"获取股票详情失败: {str(e)}",
            "dataSource": DATA_SOURCE["market_data"]
        }), 500

@app.route('/api/market/history/<symbol>', methods=['GET'])
def get_stock_history(symbol):
    """获取股票历史价格数据 - 使用 Polygon.io aggregates API 获取完整OHLCV数据"""
    try:
        interval = request.args.get('interval', '1day')
        range_param = request.args.get('range', '1month')
        
        # 调试日志：前端请求参数
        print(f"\n=== 后端接收请求 ===")
        print(f"1. 股票代码: {symbol}")
        print(f"2. 前端参数: interval={interval}, range={range_param}")
        
        # 根据前端传递的interval和range参数，映射到正确的Polygon timeframe
        # 前端timeframe配置：
        # 1D: interval='5min', range='1day'
        # 1W: interval='1day', range='1week'
        # 1M: interval='1day', range='1month'
        # 3M: interval='1day', range='3month'
        # 1Y: interval='1day', range='1year'
        
        # 映射到Polygon timeframe
        timeframe_map = {
            ('5min', '1day'): '1D',
            ('1day', '1week'): '1W',
            ('1day', '1month'): '1M',
            ('1day', '3month'): '3M',
            ('1day', '1year'): '1Y'
        }
        
        polygon_timeframe = timeframe_map.get((interval, range_param), '1M')
        print(f"3. 映射到Polygon timeframe: {polygon_timeframe}")
        
        # 获取聚合数据（完整OHLCV）
        print(f"4. 调用Polygon API获取数据...")
        aggregates = polygon_service.get_aggregates(symbol, polygon_timeframe)
        
        # 调试日志：Polygon返回数据
        print(f"5. Polygon API返回:")
        
        # 检查Polygon API是否返回错误
        if "error" in aggregates:
            print(f"   - Polygon API错误: {aggregates['error']}")
            # 返回明确的错误信息
            return jsonify({
                "symbol": symbol.upper(),
                "error": f"Polygon API错误: {aggregates['error']}",
                "dataSource": "Polygon.io (API调用失败)",
                "data": [],
                "interval": interval,
                "range": range_param
            }), 400
        
        if aggregates and 'results' in aggregates:
            results = aggregates.get("results", [])
            print(f"   - 数据条数: {len(results)}")
            if len(results) > 0:
                first = results[0]
                last = results[-1]
                print(f"   - 第一根bar时间: {datetime.fromtimestamp(first['t']/1000).isoformat() if 't' in first else 'N/A'}")
                print(f"   - 最后一根bar时间: {datetime.fromtimestamp(last['t']/1000).isoformat() if 't' in last else 'N/A'}")
                print(f"   - 时间跨度: {(last['t'] - first['t'])/(1000*60*60*24):.1f} 天" if 't' in first and 't' in last else 'N/A')
                
                # 检查数据量是否符合预期
                expected_count = TIMEFRAME_MAP[polygon_timeframe]["limit"] if polygon_timeframe in TIMEFRAME_MAP else 20
                if len(results) < expected_count * 0.5:  # 如果数据量不足预期的一半
                    print(f"   - 警告: 数据量不足，预期{expected_count}条，实际{len(results)}条")
        else:
            print(f"   - 无数据返回")
            # 返回明确的错误信息
            return jsonify({
                "symbol": symbol.upper(),
                "error": "Polygon API返回空数据",
                "dataSource": "Polygon.io (无数据)",
                "data": [],
                "interval": interval,
                "range": range_param
            }), 400
        
        # 格式化数据
        historical_data = polygon_service.format_historical_data(symbol, aggregates, polygon_timeframe)
        
        # 调试日志：格式化后数据
        print(f"6. 格式化后数据:")
        if historical_data and 'data' in historical_data:
            data = historical_data.get('data', [])
            print(f"   - 数据条数: {len(data)}")
            if len(data) > 0:
                first_data = data[0]
                last_data = data[-1]
                print(f"   - 第一根bar: time={first_data.get('time', 'N/A')}, open={first_data.get('open', 'N/A')}, close={first_data.get('close', 'N/A')}")
                print(f"   - 最后一根bar: time={last_data.get('time', 'N/A')}, open={last_data.get('open', 'N/A')}, close={last_data.get('close', 'N/A')}")
        
        if "error" in historical_data:
            print(f"7. 返回错误: {historical_data['error']}")
            return jsonify(historical_data), 400
        
        print(f"7. 返回成功，数据条数: {len(historical_data.get('data', []))}")
        return jsonify(historical_data), 200
        
    except Exception as e:
        logger.error(f"获取历史数据失败 {symbol}: {e}")
        return jsonify({
            "symbol": symbol.upper(),
            "error": f"获取历史数据失败: {str(e)}",
            "dataSource": DATA_SOURCE["market_data"],
            "data": []
        }), 500

@app.route('/api/market/search', methods=['GET'])
def search_stocks():
    """搜索股票"""
    try:
        query = request.args.get('q', '')
        limit = request.args.get('limit', 10, type=int)
        
        if not query:
            return jsonify({
                "results": [],
                "count": 0,
                "dataSource": DATA_SOURCE["market_data"]
            }), 200
        
        # 使用 Polygon 搜索
        search_result = polygon_service.search_tickers(query, limit)
        
        if "error" in search_result:
            return jsonify({
                "error": search_result.get("error"),
                "dataSource": DATA_SOURCE["market_data"]
            }), 400
        
        formatted_result = polygon_service.format_ticker_list(search_result)
        return jsonify(formatted_result), 200
        
    except Exception as e:
        logger.error(f"搜索股票失败: {e}")
        return jsonify({
            "error": f"搜索失败: {str(e)}",
            "dataSource": DATA_SOURCE["market_data"]
        }), 500

# ========== 交易API (Alpaca Markets) ==========

@app.route('/api/trading/health', methods=['GET'])
@jwt_required()
def trading_health():
    """交易服务健康检查"""
    return jsonify({
        "status": "healthy",
        "service": "Alpaca Markets Trading",
        "timestamp": datetime.utcnow().isoformat()
    }), 200

@app.route('/api/trading/account', methods=['GET'])
@jwt_required()
def get_trading_account():
    """获取交易账户信息"""
    try:
        account_data = alpaca_service.get_account()
        
        if "error" in account_data:
            return jsonify({
                "error": account_data.get("error"),
                "details": account_data.get("details"),
                "dataSource": DATA_SOURCE["trading"]
            }), 400
        
        formatted_data = alpaca_service.format_account_data(account_data)
        return jsonify(formatted_data), 200
        
    except Exception as e:
        logger.error(f"获取交易账户失败: {e}")
        return jsonify({
            "error": f"获取交易账户失败: {str(e)}",
            "dataSource": DATA_SOURCE["trading"]
        }), 500

@app.route('/api/trading/positions', methods=['GET'])
@jwt_required()
def get_trading_positions():
    """获取交易持仓"""
    try:
        positions_data = alpaca_service.get_positions()
        
        if "error" in positions_data:
            return jsonify({
                "error": positions_data.get("error"),
                "details": positions_data.get("details"),
                "dataSource": DATA_SOURCE["trading"]
            }), 400
        
        formatted_data = alpaca_service.format_position_data(positions_data)
        return jsonify(formatted_data), 200
        
    except Exception as e:
        logger.error(f"获取交易持仓失败: {e}")
        return jsonify({
            "error": f"获取交易持仓失败: {str(e)}",
            "dataSource": DATA_SOURCE["trading"]
        }), 500

@app.route('/api/trading/orders', methods=['GET'])
@jwt_required()
def get_trading_orders():
    """获取交易订单"""
    try:
        status = request.args.get('status', 'all')
        limit = request.args.get('limit', 100, type=int)
        
        orders_data = alpaca_service.get_orders(status=status, limit=limit)
        
        if "error" in orders_data:
            return jsonify({
                "error": orders_data.get("error"),
                "details": orders_data.get("details"),
                "dataSource": DATA_SOURCE["trading"]
            }), 400
        
        formatted_data = alpaca_service.format_order_data(orders_data)
        return jsonify(formatted_data), 200
        
    except Exception as e:
        logger.error(f"获取交易订单失败: {e}")
        return jsonify({
            "error": f"获取交易订单失败: {str(e)}",
            "dataSource": DATA_SOURCE["trading"]
        }), 500

@app.route('/api/trading/order', methods=['POST'])
@jwt_required()
def place_trading_order():
    """下交易订单"""
    try:
        data = request.get_json()
        
        required_fields = ['symbol', 'qty', 'side']
        for field in required_fields:
            if field not in data:
                return jsonify({
                    "error": f"缺少必要字段: {field}",
                    "dataSource": DATA_SOURCE["trading"]
                }), 400
        
        symbol = data['symbol']
        qty = float(data['qty'])
        side = data['side']
        order_type = data.get('type', 'market')
        time_in_force = data.get('time_in_force', 'day')
        limit_price = data.get('limit_price')
        stop_price = data.get('stop_price')
        client_order_id = data.get('client_order_id')
        
        # 下订单
        order_result = alpaca_service.place_order(
            symbol=symbol,
            qty=qty,
            side=side,
            order_type=order_type,
            time_in_force=time_in_force,
            limit_price=limit_price,
            stop_price=stop_price,
            client_order_id=client_order_id
        )
        
        if "error" in order_result:
            return jsonify({
                "error": order_result.get("error"),
                "details": order_result.get("details"),
                "dataSource": DATA_SOURCE["trading"]
            }), 400
        
        return jsonify({
            "success": True,
            "order": order_result,
            "message": "订单已提交",
            "dataSource": DATA_SOURCE["trading"]
        }), 200
        
    except Exception as e:
        logger.error(f"下订单失败: {e}")
        return jsonify({
            "error": f"下订单失败: {str(e)}",
            "dataSource": DATA_SOURCE["trading"]
        }), 500

@app.route('/api/trading/order/<order_id>', methods=['DELETE'])
@jwt_required()
def cancel_trading_order(order_id):
    """取消交易订单"""
    try:
        cancel_result = alpaca_service.cancel_order(order_id)
        
        if "error" in cancel_result:
            return jsonify({
                "error": cancel_result.get("error"),
                "details": cancel_result.get("details"),
                "dataSource": DATA_SOURCE["trading"]
            }), 400
        
        return jsonify({
            "success": True,
            "message": "订单已取消",
            "dataSource": DATA_SOURCE["trading"]
        }), 200
        
    except Exception as e:
        logger.error(f"取消订单失败: {e}")
        return jsonify({
            "error": f"取消订单失败: {str(e)}",
            "dataSource": DATA_SOURCE["trading"]
        }), 500

@app.route('/api/trading/assets', methods=['GET'])
@jwt_required()
def get_trading_assets():
    """获取可交易资产"""
    try:
        status = request.args.get('status', 'active')
        asset_class = request.args.get('asset_class', 'us_equity')
        
        assets_data = alpaca_service.get_assets(status=status, asset_class=asset_class)
        
        if "error" in assets_data:
            return jsonify({
                "error": assets_data.get("error"),
                "details": assets_data.get("details"),
                "dataSource": DATA_SOURCE["trading"]
            }), 400
        
        formatted_data = alpaca_service.format_asset_data(assets_data)
        return jsonify(formatted_data), 200
        
    except Exception as e:
        logger.error(f"获取资产列表失败: {e}")
        return jsonify({
            "error": f"获取资产列表失败: {str(e)}",
            "dataSource": DATA_SOURCE["trading"]
        }), 500

# ========== 认证API ==========

@app.route('/api/auth/login', methods=['POST'])
def login():
    """用户登录"""
    try:
        data = request.get_json()
        
        # 简化认证逻辑（实际项目应使用密码哈希）
        username = data.get('username')
        password = data.get('password')
        
        if not username or not password:
            return jsonify({"error": "用户名和密码必填"}), 400
        
        # 查找用户
        user = User.query.filter_by(username=username).first()
        
        if not user:
            # 创建测试用户（仅开发环境）
            if os.getenv('FLASK_ENV') == 'development':
                user = User(
                    username=username,
                    email=f"{username}@quantplatform.com",
                    password_hash=password,  # 实际应哈希
                    role='trader'
                )
                db.session.add(user)
                db.session.commit()
            else:
                return jsonify({"error": "用户不存在"}), 401
        
        # 简化密码验证
        if user.password_hash != password:
            return jsonify({"error": "密码错误"}), 401
        
        # 更新最后登录时间
        user.last_login = datetime.utcnow()
        db.session.commit()
        
        # 创建JWT令牌
        access_token = create_access_token(identity=str(user.id))
        
        return jsonify({
            "access_token": access_token,
            "user": {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "role": user.role
            }
        }), 200
        
    except Exception as e:
        logger.error(f"登录失败: {e}")
        return jsonify({"error": "登录失败"}), 500

@app.route('/api/auth/register', methods=['POST'])
def register():
    """用户注册"""
    try:
        data = request.get_json()
        
        username = data.get('username')
        email = data.get('email')
        password = data.get('password')
        
        if not username or not email or not password:
            return jsonify({"error": "所有字段必填"}), 400
        
        # 检查用户是否已存在
        if User.query.filter_by(username=username).first():
            return jsonify({"error": "用户名已存在"}), 400
        
        if User.query.filter_by(email=email).first():
            return jsonify({"error": "邮箱已存在"}), 400
        
        # 创建用户
        user = User(
            username=username,
            email=email,
            password_hash=password,  # 实际应哈希
            role='trader'
        )
        
        db.session.add(user)
        db.session.commit()
        
        # 创建JWT令牌
        access_token = create_access_token(identity=str(user.id))
        
        return jsonify({
            "access_token": access_token,
            "user": {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "role": user.role
            }
        }), 201
        
    except Exception as e:
        logger.error(f"注册失败: {e}")
        return jsonify({"error": "注册失败"}), 500

# ========== 错误处理 ==========

@app.errorhandler(404)
def not_found(error):
    return jsonify({"error": "资源未找到"}), 404

@app.errorhandler(500)
def internal_error(error):
    logger.error(f"服务器内部错误: {error}")
    return jsonify({"error": "服务器内部错误"}), 500

# ========== 应用启动 ==========

if __name__ == '__main__':
    # 创建数据库表
    with app.app_context():
        db.create_all()
        logger.info("数据库表创建完成")
    
    # 添加默认用户（仅开发环境）
    if os.getenv('FLASK_ENV') == 'development':
        with app.app_context():
            if not User.query.filter_by(username='admin').first():
                admin = User(
                    username='admin',
                    email='admin@quantplatform.com',
                    password_hash='admin123',  # 实际应该哈希
                    role='admin'
                )
                db.session.add(admin)
                db.session.commit()
                logger.info("创建默认管理员用户")
    
    # 初始化服务
    try:
        service_manager.initialize()
        logger.info("服务初始化成功")
    except Exception as e:
        logger.error(f"服务初始化失败: {e}")
    
    # 启动Flask应用
    port = int(os.getenv('PORT', 8889))
    host = os.getenv('HOST', '0.0.0.0')
    
    logger.info(f"启动量化平台后端服务 (重构版本)...")
    logger.info(f"环境: {os.getenv('FLASK_ENV', 'development')}")
    logger.info(f"地址: http://{host}:{port}")
    logger.info(f"市场数据: Polygon.io")
    logger.info(f"交易执行: Alpaca Markets")
    logger.info(f"API文档: http://{host}:{port}/api/health")
    
    app.run(host=host, port=port, debug=False, use_reloader=False)