#!/usr/bin/env python3
"""
Fixed Quant Backend - 修复历史数据403问题
"""

from flask import Flask, jsonify, request
from flask_cors import CORS
import random
import time
import os
import sys
import requests
from datetime import datetime, timedelta
import yfinance as yf

# Finnhub API配置（仅用于实时数据）
FINNHUB_API_KEY = 'd6qsdcpr01qgdhqc82hgd6qsdcpr01qgdhqc82i0'
FINNHUB_BASE_URL = 'https://finnhub.io/api/v1'

app = Flask(__name__)
CORS(app, origins=["http://localhost:3000", "http://localhost:3010"], supports_credentials=True)

# Popular stock symbols for market data
POPULAR_STOCKS = [
    "AAPL", "MSFT", "GOOGL", "AMZN", "TSLA", "NVDA", "META", "JPM", "JNJ", "WMT",
    "V", "PG", "UNH", "HD", "MA", "DIS", "BAC", "ADBE", "NFLX", "CRM"
]

# System startup time for uptime calculation
START_TIME = time.time()

def fetch_real_stock_data(symbol):
    """Fetch real stock data from Finnhub API"""
    try:
        symbol_upper = symbol.upper()
        
        # 1. 获取实时报价数据
        quote_url = f"{FINNHUB_BASE_URL}/quote"
        quote_params = {
            'symbol': symbol_upper,
            'token': FINNHUB_API_KEY
        }
        
        quote_response = requests.get(quote_url, params=quote_params, timeout=10)
        
        if quote_response.status_code != 200:
            print(f"Finnhub quote API错误: {quote_response.status_code}")
            return None
            
        quote_data = quote_response.json()
        
        # 2. 获取公司信息
        profile_url = f"{FINNHUB_BASE_URL}/stock/profile2"
        profile_params = {
            'symbol': symbol_upper,
            'token': FINNHUB_API_KEY
        }
        
        profile_response = requests.get(profile_url, params=profile_params, timeout=10)
        profile_data = profile_response.json() if profile_response.status_code == 200 else {}
        
        # 3. 获取财务指标
        metric_url = f"{FINNHUB_BASE_URL}/stock/metric"
        metric_params = {
            'symbol': symbol_upper,
            'metric': 'all',
            'token': FINNHUB_API_KEY
        }
        
        metric_response = requests.get(metric_url, params=metric_params, timeout=10)
        metric_data = metric_response.json() if metric_response.status_code == 200 else {}
        
        # 提取财务指标
        pe_ratio = None
        dividend_yield = None
        year_high = None
        year_low = None
        
        if metric_data and 'metric' in metric_data:
            metrics = metric_data['metric']
            pe_ratio = metrics.get('peNormalizedAnnual')
            dividend_yield = metrics.get('dividendYieldIndicatedAnnual')
            year_high = metrics.get('52WeekHigh')
            year_low = metrics.get('52WeekLow')
        
        # 构建返回数据
        stock_data = {
            "symbol": symbol_upper,
            "name": profile_data.get('name', symbol_upper),
            "price": quote_data.get('c'),
            "change": quote_data.get('d'),
            "changePercent": quote_data.get('dp'),
            "volume": quote_data.get('v', 0),  # Finnhub quote API不提供成交量
            "marketCap": profile_data.get('marketCapitalization'),
            "sector": profile_data.get('finnhubIndustry'),
            "industry": profile_data.get('finnhubIndustry'),
            "currency": profile_data.get('currency', 'USD'),
            "dayHigh": quote_data.get('h'),
            "dayLow": quote_data.get('l'),
            "previousClose": quote_data.get('pc'),
            "dataSource": "Finnhub",
            "timestamp": datetime.now().isoformat(),
            "peRatio": pe_ratio,
            "dividendYield": dividend_yield,
            "yearHigh": year_high,
            "yearLow": year_low
        }
        
        return stock_data
        
    except Exception as e:
        print(f"获取股票数据时出错 {symbol}: {e}")
        return None

@app.route('/api/market/stocks', methods=['GET'])
def get_market_stocks():
    """获取市场股票数据"""
    try:
        symbols_param = request.args.get('symbols', '')
        
        if symbols_param:
            # 获取指定股票
            symbols = [s.strip().upper() for s in symbols_param.split(',') if s.strip()]
        else:
            # 获取热门股票
            symbols = POPULAR_STOCKS[:15]  # 增加到15个
        
        print(f"获取股票数据: {symbols}")
        
        stocks_data = []
        for symbol in symbols:
            stock_data = fetch_real_stock_data(symbol)
            if stock_data:
                stocks_data.append(stock_data)
        
        return jsonify({
            "stocks": stocks_data,
            "count": len(stocks_data),
            "source": "Finnhub",
            "timestamp": time.time()
        })
        
    except Exception as e:
        print(f"获取市场数据时出错: {e}")
        return jsonify({
            "stocks": [],
            "count": 0,
            "source": "Finnhub (错误)",
            "timestamp": time.time()
        }), 500

@app.route('/api/market/stock/<symbol>', methods=['GET'])
def get_stock_data(symbol):
    """获取单个股票数据"""
    try:
        stock_data = fetch_real_stock_data(symbol)
        
        if stock_data:
            return jsonify(stock_data)
        else:
            return jsonify({
                "symbol": symbol.upper(),
                "error": "无法获取股票数据",
                "dataSource": "Finnhub (错误)"
            }), 404
            
    except Exception as e:
        print(f"获取股票数据时出错 {symbol}: {e}")
        return jsonify({
            "symbol": symbol.upper(),
            "error": f"服务器错误: {str(e)}",
            "dataSource": "服务器错误"
        }), 500

@app.route('/api/market/history/<symbol>', methods=['GET'])
def get_stock_history(symbol):
    """获取股票历史价格数据 - 使用 Yahoo Finance 作为数据源"""
    try:
        # 获取查询参数
        interval = request.args.get('interval', '1day')
        range_param = request.args.get('range', '1month')
        
        print(f"=== Yahoo Finance历史数据请求 ===")
        print(f"股票: {symbol}, interval={interval}, range={range_param}")
        
        # 映射到Yahoo Finance参数
        period_map = {
            '1day': '1d',
            '1week': '5d',
            '1month': '1mo',
            '3month': '3mo',
            '1year': '1y'
        }
        
        interval_map = {
            '5min': '5m',
            '1day': '1d'
        }
        
        period = period_map.get(range_param, '1mo')
        yf_interval = interval_map.get(interval, '1d')
        
        print(f"Yahoo Finance参数: period={period}, interval={yf_interval}")
        
        try:
            # 使用Yahoo Finance获取历史数据
            ticker = yf.Ticker(symbol.upper())
            
            # 下载历史数据
            hist = ticker.history(period=period, interval=yf_interval)
            
            print(f"Yahoo Finance返回数据形状: {hist.shape}")
            
            if hist.empty:
                print(f"Yahoo Finance返回空数据")
                return jsonify({
                    "symbol": symbol.upper(),
                    "error": "Yahoo Finance返回空数据",
                    "dataSource": "Yahoo Finance (空数据)",
                    "data": [],
                    "interval": interval,
                    "range": range_param
                }), 404
            
            # 格式化数据
            formatted_data = []
            for idx, row in hist.iterrows():
                # 将pandas Timestamp转换为datetime
                timestamp = int(idx.timestamp())
                
                formatted_data.append({
                    "timestamp": timestamp,
                    "time": idx.isoformat(),
                    "open": float(row['Open']) if 'Open' in row else 0,
                    "high": float(row['High']) if 'High' in row else 0,
                    "low": float(row['Low']) if 'Low' in row else 0,
                    "close": float(row['Close']) if 'Close' in row else 0,
                    "volume": int(row['Volume']) if 'Volume' in row else 0
                })
            
            print(f"格式化后数据条数: {len(formatted_data)}")
            
            return jsonify({
                "symbol": symbol.upper(),
                "interval": interval,
                "range": range_param,
                "data": formatted_data,
                "count": len(formatted_data),
                "dataSource": "Yahoo Finance",
                "timestamp": time.time()
            })
                
        except Exception as e:
            print(f"Yahoo Finance API调用异常: {e}")
            return jsonify({
                "symbol": symbol.upper(),
                "error": f"Yahoo Finance API异常: {str(e)}",
                "dataSource": "Yahoo Finance (异常)",
                "data": [],
                "interval": interval,
                "range": range_param
            }), 500
        
    except Exception as e:
        print(f"获取历史数据时出错: {e}")
        return jsonify({
            "symbol": symbol.upper(),
            "error": f"服务器错误: {str(e)}",
            "dataSource": "服务器错误",
            "data": [],
            "interval": interval,
            "range": range_param
        }), 500

@app.route('/api/market/search', methods=['GET'])
def search_stocks():
    """搜索股票"""
    try:
        query = request.args.get('q', '').strip().upper()
        
        if not query:
            return jsonify({
                "results": [],
                "count": 0,
                "source": "Finnhub (无查询)",
                "timestamp": time.time()
            })
        
        # 简单过滤热门股票
        results = []
        for symbol in POPULAR_STOCKS:
            if query in symbol or query in symbol.lower():
                results.append({
                    "symbol": symbol,
                    "name": symbol,
                    "exchange": "NASDAQ/NYSE",
                    "currency": "USD"
                })
        
        return jsonify({
            "results": results[:10],  # 限制10个结果
            "count": len(results),
            "source": "Finnhub",
            "timestamp": time.time()
        })
        
    except Exception as e:
        print(f"搜索股票时出错: {e}")
        return jsonify({
            "results": [],
            "count": 0,
            "source": "Finnhub (错误)",
            "timestamp": time.time()
        }), 500

@app.route('/api/status', methods=['GET'])
def get_status():
    """获取系统状态"""
    uptime = time.time() - START_TIME
    
    return jsonify({
        "status": "online",
        "uptime": uptime,
        "timestamp": time.time(),
        "apis": {
            "finnhub": "active (real-time data)",
            "yahoo_finance": "active (historical data)",
            "alpaca": "not configured"
        }
    })

if __name__ == '__main__':
    print("Starting Quant Backend Server...")
    print("APIs:")
    print("  - Finnhub: Real-time stock data")
    print("  - Yahoo Finance: Historical price data")
    print("  - Port: 8889")
    
    app.run(host='127.0.0.1', port=8889, debug=False)