#!/usr/bin/env python3
"""
专业量化交易平台后端 - 重构版本
市场数据: Polygon.io
交易执行: Alpaca Markets
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

# 量化分析库
import pandas as pd
import numpy as np

# 环境配置
from dotenv import load_dotenv
load_dotenv()

# 导入服务
from polygon_service import polygon_service
from alpaca_service import alpaca_service
from config import DEFAULT_SYMBOLS, DATA_SOURCE

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
    """获取股票市场数据 - 使用 Polygon.io"""
    try:
        symbols = request.args.get('symbols', ','.join(DEFAULT_SYMBOLS)).split(',')
        
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
            "dataSource": DATA_SOURCE["market_data"]
        }), 200
        
    except Exception as e:
        logger.error(f"获取股票数据失败: {e}")
        return jsonify({
            "error": "获取市场数据失败",
            "dataSource": DATA_SOURCE["market_data"]
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
    """获取股票历史价格数据 - 使用 Polygon.io"""
    try:
        interval = request.args.get('interval', '1day')
        range_param = request.args.get('range', '1month')
        
        # 映射时间框架
        timeframe_map = {
            '5min': '1D',
            '1day': '1M',
            '1week': '1W',
            '1month': '1M',
            '3month': '3M',
            '1year': '1Y'
        }
        
        polygon_timeframe = timeframe_map.get(range_param, '1M')
        
        # 获取聚合数据
        aggregates = polygon_service.get_aggregates(symbol, polygon_timeframe)
        
        # 格式化数据
        historical_data = polygon_service.format_historical_data(symbol, aggregates, range_param)
        
        if "error" in historical_data:
            return jsonify(historical_data), 400
        
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
        
        # 使用 Polygon 的 tickers 端点搜索
        endpoint = "/v3/reference/tickers"
        params = {
            "search": query,
            "market": "stocks",
            "active": "true",
            "limit": limit
        }
        
        response = polygon_service._make_request(endpoint, params)
        
        results = response.get("results", [])
        
        formatted_results = []
        for item in results:
            formatted_results.append({
                "symbol": item.get("ticker", ""),
                "name": item.get("name", ""),
                "market": item.get("market", ""),
                "locale": item.get("locale", ""),
                "currency": item.get("currency_name", "USD"),
                "dataSource": DATA_SOURCE["market_data"]
            })
        
        return jsonify({
            "results": formatted_results,
            "count": len(formatted_results),
            "dataSource": DATA_SOURCE["market_data"]
        }), 200
        
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
        
        # 下订单
        order_result = alpaca_service.place_order(
            symbol=symbol,
            qty=qty,
            side=side,
            order_type=order_type,
            time_in_force=time_in_force,
            limit_price=limit_price,
            stop_price=stop_price
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

# ========== 系统API ==========

@app.route('/api/health', methods=['GET'])
def health_check():
    """系统健康检查"""
    return jsonify({
        "status": "healthy",
        "services": {
            "market_data": "Polygon.io",
            "trading": "Alpaca Markets"
        },
        "timestamp": datetime.utcnow().isoformat(),
        "version": "2.0.0"
    }), 200

@app.route('/api/system/status', methods=['GET'])
def system_status():
    """系统状态"""
    return jsonify({
        "status": "running",
        "environment": os.getenv('FLASK_ENV', 'development'),
        "database": "connected" if db.engine else "disconnected",
        "services": {
            "market_data": "Polygon.io - Active",
            "trading": "Alpaca Markets - Active"
        },
        "timestamp": datetime.utcnow().isoformat()
    }), 200

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