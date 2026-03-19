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

# Candidate stock pool for dynamic selection
# 候选股票池，用于动态筛选 Dashboard 显示的15支股票
CANDIDATE_STOCKS = [
    # 科技股 (必须包含: AAPL, NVDA)
    "AAPL",    # Apple - 必须包含
    "MSFT",    # Microsoft
    "GOOGL",   # Alphabet (Google)
    "AMZN",    # Amazon
    "NVDA",    # NVIDIA - 必须包含
    "META",    # Meta Platforms
    "ADBE",    # Adobe
    "CRM",     # Salesforce
    "ORCL",    # Oracle
    "INTC",    # Intel
    "AMD",     # AMD
    "QCOM",    # Qualcomm
    "CSCO",    # Cisco
    "IBM",     # IBM
    "TSM",     # TSMC
    
    # 电动汽车/新能源 (必须包含: TSLA)
    "TSLA",    # Tesla - 必须包含
    "RIVN",    # Rivian
    "LCID",    # Lucid
    "NIO",     # NIO
    "LI",      # Li Auto
    "XPEV",    # XPeng
    
    # 金融股
    "JPM",     # JPMorgan Chase
    "BAC",     # Bank of America
    "WFC",     # Wells Fargo
    "C",       # Citigroup
    "GS",      # Goldman Sachs
    "MS",      # Morgan Stanley
    "V",       # Visa
    "MA",      # Mastercard
    "AXP",     # American Express
    "PYPL",    # PayPal
    "SQ",      # Block
    
    # 医疗/医药
    "JNJ",     # Johnson & Johnson
    "UNH",     # UnitedHealth
    "PFE",     # Pfizer
    "MRK",     # Merck
    "ABBV",    # AbbVie
    "LLY",     # Eli Lilly
    "TMO",     # Thermo Fisher
    "DHR",     # Danaher
    
    # 消费品/零售
    "WMT",     # Walmart
    "PG",      # Procter & Gamble
    "KO",      # Coca-Cola
    "PEP",     # PepsiCo
    "MCD",     # McDonald's
    "SBUX",    # Starbucks
    "NKE",     # Nike
    "HD",      # Home Depot
    "LOW",     # Lowe's
    "TGT",     # Target
    "COST",    # Costco
    
    # 工业/能源
    "CAT",     # Caterpillar
    "BA",      # Boeing
    "HON",     # Honeywell
    "GE",      # General Electric
    "MMM",     # 3M
    "XOM",     # Exxon Mobil
    "CVX",     # Chevron
    "COP",     # ConocoPhillips
    
    # 通信/媒体
    "T",       # AT&T
    "VZ",      # Verizon
    "CMCSA",   # Comcast
    "DIS",     # Disney
    "NFLX",    # Netflix
    "PARA",    # Paramount
    "WBD",     # Warner Bros Discovery
    
    # 其他
    "SPG",     # Simon Property Group
    "PLD",     # Prologis
    "AMT",     # American Tower
]

# 必须包含的股票 (强制包含)
MUST_HAVE_STOCKS = ["AAPL", "TSLA", "NVDA"]

# 科技股定义 (用于计算科技股占比)
TECH_STOCKS = [
    "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "ADBE", "CRM", "ORCL",
    "INTC", "AMD", "QCOM", "CSCO", "IBM", "TSM", "PYPL", "SQ"
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
        
        # 详细调试：打印Finnhub API返回的所有字段
        print(f"[DEBUG] Finnhub quote API 所有字段 ({symbol_upper}):")
        for key, value in quote_data.items():
            print(f"  {key}: {value}")
        
        # 特别检查h/l字段
        print(f"[DEBUG] 特别检查 - h字段: {quote_data.get('h')}, l字段: {quote_data.get('l')}")
        
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
        # 智能检测market cap
        market_cap = None
        if market_cap_raw:
            # 智能检测：检查marketCap原始值是否在合理范围内
            # 正常USD股票的marketCapitalization应该在1,000到10,000,000之间
            is_reasonable_usd = (
                currency == 'USD' and 
                1000 <= market_cap_raw <= 10_000_000
            )
            
            if is_reasonable_usd:
                # 正常USD股票：百万美元 → 美元
                market_cap = market_cap_raw * 1000000
                print(f"[正常转换] {symbol_upper}: {market_cap_raw:.2f} → {market_cap}")
            else:
                # 异常情况：单位不明确、非USD货币、或值异常
                market_cap = None
                reason = []
                if currency != 'USD':
                    reason.append(f"currency={currency}")
                if market_cap_raw < 1000:
                    reason.append(f"值过小({market_cap_raw:.2f})")
                if market_cap_raw > 10_000_000:
                    reason.append(f"值过大({market_cap_raw:.2f})")
                
                print(f"[跳过转换] {symbol_upper}: {', '.join(reason)}")
        
        # 调试：检查dayHigh/dayLow字段值
        day_high_value = quote_data.get('h')
        day_low_value = quote_data.get('l')
        print(f"[DEBUG] {symbol_upper} - dayHigh: {day_high_value}, dayLow: {day_low_value}")
        
        # 强制确保dayHigh/dayLow字段有值（即使为None也要包含）
        if day_high_value is None:
            print(f"[WARNING] {symbol_upper} - dayHigh is None, using price as fallback")
            day_high_value = quote_data.get('c')  # 使用当前价格作为fallback
        
        if day_low_value is None:
            print(f"[WARNING] {symbol_upper} - dayLow is None, using price as fallback")
            day_low_value = quote_data.get('c')  # 使用当前价格作为fallback
        
        stock_data = {
            "symbol": symbol_upper,
            "name": profile_data.get('name', symbol_upper),
            "price": quote_data.get('c'),
            "change": quote_data.get('d'),
            "changePercent": quote_data.get('dp'),
            "volume": quote_data.get('v', 0),  # Finnhub quote API不提供成交量
            
            "marketCap": market_cap,
            "currency": profile_data.get('currency', 'USD'),
            
            "sector": profile_data.get('finnhubIndustry'),
            "industry": profile_data.get('finnhubIndustry'),
            "dayHigh": day_high_value,
            "dayLow": day_low_value,
            "previousClose": quote_data.get('pc'),
            "dataSource": "Finnhub",
            "timestamp": datetime.now().isoformat(),
            "peRatio": pe_ratio,
            "dividendYield": dividend_yield,
            "yearHigh": year_high,
            "yearLow": year_low
        }
        
        # 特殊处理market cap（智能检测单位）
        market_cap_raw = profile_data.get('marketCapitalization')
        currency = stock_data.get('currency', 'USD')
        
        if market_cap_raw:
            # 智能检测：检查marketCap原始值是否在合理范围内
            # 正常USD股票的marketCapitalization应该在1,000到10,000,000之间
            is_reasonable_usd = (
                currency == 'USD' and 
                1000 <= market_cap_raw <= 10_000_000
            )
            
            if is_reasonable_usd:
                # 正常USD股票：百万美元 → 美元
                stock_data['marketCap'] = market_cap_raw * 1000000
                print(f"[正常转换] {symbol_upper}: {market_cap_raw} → {stock_data['marketCap']}")
            else:
                # 异常情况：单位不明确、非USD货币、或值异常
                stock_data['marketCap'] = None
                reason = []
                if currency != 'USD':
                    reason.append(f"currency={currency}")
                if market_cap_raw < 1000:
                    reason.append(f"值过小({market_cap_raw})")
                if market_cap_raw > 10_000_000:
                    reason.append(f"值过大({market_cap_raw})")
                
                print(f"[跳过转换] {symbol_upper}: {', '.join(reason)}")
        
        return stock_data
        
    except Exception as e:
        print(f"获取股票数据时出错 {symbol}: {e}")
        return None

# 导入并发和缓存相关库
import concurrent.futures
import threading

# 缓存配置
dashboard_cache = {}
cache_lock = threading.Lock()
CACHE_TTL = 60  # 60秒缓存

# 启动时清除旧缓存，确保新配置生效
print(f"[启动] 清除旧缓存，应用新配置: 动态筛选15支股票")
print(f"[启动] 候选股票池大小: {len(CANDIDATE_STOCKS)}支")
print(f"[启动] 必须包含: {MUST_HAVE_STOCKS}")
with cache_lock:
    dashboard_cache.clear()

def fetch_stock_data_lightweight(symbol):
    """轻量级获取股票数据（只获取核心字段，用于Dashboard）"""
    start_time = time.time()
    symbol_upper = symbol.upper()
    
    print(f"  [Dashboard] 开始获取 {symbol_upper}")
    
    try:
        # 1. 获取实时报价数据（核心）
        quote_start = time.time()
        quote_url = f"{FINNHUB_BASE_URL}/quote"
        quote_params = {'symbol': symbol_upper, 'token': FINNHUB_API_KEY}
        quote_response = requests.get(quote_url, params=quote_params, timeout=5)
        quote_elapsed = time.time() - quote_start
        
        if quote_response.status_code != 200:
            print(f"  [错误] {symbol_upper} quote API失败: {quote_response.status_code}")
            return None
        
        quote_data = quote_response.json()
        print(f"  [完成] {symbol_upper} quote: {quote_elapsed:.2f}秒")
        
        # 调试：检查quote_data中的h/l字段
        print(f"  [DEBUG] {symbol_upper} quote_data keys: {list(quote_data.keys())}")
        print(f"  [DEBUG] {symbol_upper} h字段: {quote_data.get('h')}, l字段: {quote_data.get('l')}")
        
        # 2. 获取公司简介（用于marketCap和sector）
        profile_start = time.time()
        profile_url = f"{FINNHUB_BASE_URL}/stock/profile2"
        profile_params = {'symbol': symbol_upper, 'token': FINNHUB_API_KEY}
        profile_response = requests.get(profile_url, params=profile_params, timeout=5)
        profile_elapsed = time.time() - profile_start
        
        if profile_response.status_code != 200:
            print(f"  [警告] {symbol_upper} profile API失败，使用默认值")
            profile_data = {}
        else:
            profile_data = profile_response.json()
        
        print(f"  [完成] {symbol_upper} profile: {profile_elapsed:.2f}秒")
        
        # 提取核心字段
        price = quote_data.get('c')
        change = quote_data.get('d')
        change_percent = quote_data.get('dp')
        previous_close = quote_data.get('pc')
        
        # 计算涨跌幅（如果API没有提供）
        if price is not None and previous_close is not None and previous_close != 0:
            if change is None:
                change = price - previous_close
            if change_percent is None:
                change_percent = (change / previous_close) * 100
        
        # 处理marketCap（智能检测单位，避免一刀切转换）
        market_cap_raw = profile_data.get('marketCapitalization')
        currency = profile_data.get('currency', 'USD')
        
        market_cap = None
        if market_cap_raw:
            # 智能检测：检查marketCap原始值是否在合理范围内
            # 正常USD股票的marketCapitalization应该在1,000到10,000,000之间
            # 这对应1B到10T市值（百万美元单位）
            is_reasonable_usd = (
                currency == 'USD' and 
                1000 <= market_cap_raw <= 10_000_000
            )
            
            if is_reasonable_usd:
                # 正常USD股票：百万美元 → 美元
                market_cap = market_cap_raw * 1000000
                print(f"[正常转换] {symbol_upper}: {market_cap_raw:.2f} → {market_cap}")
            else:
                # 异常情况：单位不明确、非USD货币、或值异常
                market_cap = None
                reason = []
                if currency != 'USD':
                    reason.append(f"currency={currency}")
                if market_cap_raw < 1000:
                    reason.append(f"值过小({market_cap_raw:.2f})")
                if market_cap_raw > 10_000_000:
                    reason.append(f"值过大({market_cap_raw:.2f})")
                
                print(f"[跳过转换] {symbol_upper}: {', '.join(reason)}")
        
        # 构建返回数据（只包含Dashboard需要的核心字段）
        # 确保dayHigh和dayLow字段总是被设置
        day_high = quote_data.get('h')
        day_low = quote_data.get('l')
        
        print(f"  [DEBUG] 设置dayHigh: {day_high}, dayLow: {day_low}")
        
        stock_data = {
            "symbol": symbol_upper,
            "name": profile_data.get('name', symbol_upper),
            "price": price,
            "change": change,
            "changePercent": change_percent,
            "marketCap": market_cap,
            "sector": profile_data.get('finnhubIndustry'),
            "dayHigh": day_high,
            "dayLow": day_low,
            "dataSource": "Finnhub",
            "timestamp": datetime.now().isoformat()
        }
        
        total_elapsed = time.time() - start_time
        print(f"  [完成] {symbol_upper} 总计: {total_elapsed:.2f}秒")
        
        return stock_data
        
    except Exception as e:
        print(f"  [异常] 获取 {symbol_upper} 数据失败: {str(e)}")
        return None

def get_dashboard_stocks_concurrent(symbols):
    """并发获取Dashboard股票数据（带缓存）"""
    # 检查缓存
    cache_key = f"dashboard:{','.join(sorted(symbols))}"
    
    # 强制清除所有缓存，确保修复生效
    print(f"[缓存清理] 强制清除所有缓存，确保market cap修复生效")
    with cache_lock:
        dashboard_cache.clear()
        print(f"[缓存清理] 已清除所有缓存")
    
    with cache_lock:
        if cache_key in dashboard_cache:
            cache_data, cache_time = dashboard_cache[cache_key]
            if time.time() - cache_time < CACHE_TTL:
                print(f"[缓存命中] Dashboard数据 ({len(symbols)}支股票)")
                return cache_data
    
    print(f"[开始] 并发获取Dashboard数据 ({len(symbols)}支股票)")
    print(f"[调试] 传入的symbols: {symbols}")
    start_time = time.time()
    
    stocks_data = []
    errors = []
    
    # 使用线程池并发获取
    max_workers = min(4, len(symbols))  # 限制并发数，避免触发速率限制
    
    print(f"[并发] 使用 {max_workers} 个线程")
    
    with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
        # 提交所有任务
        future_to_symbol = {
            executor.submit(fetch_stock_data_lightweight, symbol): symbol 
            for symbol in symbols
        }
        
        # 收集结果
        for future in concurrent.futures.as_completed(future_to_symbol):
            symbol = future_to_symbol[future]
            try:
                stock_data = future.result(timeout=8)  # 每只股票最多8秒
                
                if stock_data:
                    stocks_data.append(stock_data)
                else:
                    errors.append(f"{symbol}: 获取数据失败")
                    
            except concurrent.futures.TimeoutError:
                errors.append(f"{symbol}: 请求超时（8秒）")
                print(f"  [超时] {symbol}")
            except Exception as e:
                errors.append(f"{symbol}: {str(e)}")
                print(f"  [异常] {symbol}: {str(e)}")
    
    total_elapsed = time.time() - start_time
    print(f"[完成] Dashboard获取完成: {len(stocks_data)}成功, {len(errors)}失败, 耗时{total_elapsed:.2f}秒")
    
    result = {
        "stocks": stocks_data,
        "count": len(stocks_data),
        "source": "Finnhub",
        "timestamp": time.time(),
        "success": True,
        "elapsed": total_elapsed
    }
    
    if errors:
        result["errors"] = errors
        result["success"] = False if len(errors) > len(symbols) // 2 else True
    
    # 缓存结果
    with cache_lock:
        dashboard_cache[cache_key] = (result, time.time())
        print(f"[缓存] 缓存Dashboard数据 ({len(symbols)}支股票)")
    
    return result

@app.route('/api/market/stocks', methods=['GET'])
def select_dashboard_stocks():
    """
    动态筛选Dashboard显示的15支股票
    目标：7支上涨，7支下跌，1支接近平盘
    必须包含：AAPL, TSLA, NVDA
    尽量保证科技股占比更高
    """
    print(f"[动态筛选] 开始从候选池筛选15支股票")
    print(f"[动态筛选] 候选池大小: {len(CANDIDATE_STOCKS)}支")
    print(f"[动态筛选] 必须包含: {MUST_HAVE_STOCKS}")
    
    # 从候选池中获取数据（限制数量以避免API限制）
    # 先获取前30支候选股票的数据
    sample_size = min(30, len(CANDIDATE_STOCKS))
    sample_stocks = CANDIDATE_STOCKS[:sample_size]
    
    print(f"[动态筛选] 获取{sample_size}支候选股票数据...")
    result = get_dashboard_stocks_concurrent(sample_stocks)
    
    if not result.get('success', False):
        print(f"[动态筛选] 获取候选数据失败，使用备用方案")
        # 备用方案：使用必须包含的股票 + 其他股票
        backup_stocks = MUST_HAVE_STOCKS + CANDIDATE_STOCKS[3:18]  # 3个必须 + 12个其他
        return backup_stocks
    
    stocks = result.get('stocks', [])
    print(f"[动态筛选] 成功获取{len(stocks)}支候选股票数据")
    
    # 分类股票
    gainers = []
    losers = []
    neutral = []
    
    for stock in stocks:
        change_percent = stock.get('changePercent', 0)
        
        if change_percent > 0.1:  # 上涨超过0.1%
            gainers.append(stock)
        elif change_percent < -0.1:  # 下跌超过0.1%
            losers.append(stock)
        else:  # 平盘
            neutral.append(stock)
    
    print(f"[动态筛选] 分类结果: {len(gainers)}涨, {len(losers)}跌, {len(neutral)}平")
    
    # 确保必须包含的股票在结果中
    final_stocks = []
    must_have_added = []
    
    for must_symbol in MUST_HAVE_STOCKS:
        found = False
        # 在所有分类中查找
        for category in [gainers, losers, neutral]:
            for stock in category:
                if stock.get('symbol') == must_symbol:
                    final_stocks.append(stock)
                    category.remove(stock)  # 从原分类移除
                    must_have_added.append(must_symbol)
                    found = True
                    break
            if found:
                break
        
        if not found:
            print(f"[动态筛选] 警告: 必须包含的股票 {must_symbol} 不在候选数据中")
    
    print(f"[动态筛选] 已添加必须包含的股票: {must_have_added}")
    
    # 目标：7涨7跌1平
    target_gainers = 7
    target_losers = 7
    target_neutral = 1
    
    # 调整目标（考虑已添加的必须包含股票）
    # 统计已添加的股票属于哪个分类
    added_gainers = len([s for s in final_stocks if s.get('changePercent', 0) > 0.1])
    added_losers = len([s for s in final_stocks if s.get('changePercent', 0) < -0.1])
    added_neutral = len([s for s in final_stocks if -0.1 <= s.get('changePercent', 0) <= 0.1])
    
    remaining_gainers_needed = max(0, target_gainers - added_gainers)
    remaining_losers_needed = max(0, target_losers - added_losers)
    remaining_neutral_needed = max(0, target_neutral - added_neutral)
    
    print(f"[动态筛选] 剩余需要: {remaining_gainers_needed}涨, {remaining_losers_needed}跌, {remaining_neutral_needed}平")
    
    # 从各分类中添加股票，优先选择科技股
    def add_stocks_from_category(category, count_needed, category_name):
        added = []
        # 优先选择科技股
        tech_stocks = [s for s in category if s.get('symbol') in TECH_STOCKS]
        non_tech_stocks = [s for s in category if s.get('symbol') not in TECH_STOCKS]
        
        # 先添加科技股
        for stock in tech_stocks[:count_needed]:
            final_stocks.append(stock)
            added.append(stock.get('symbol'))
            # 从原分类中移除，避免重复
            if stock in category:
                category.remove(stock)
            count_needed -= 1
        
        # 如果还需要更多，添加非科技股
        if count_needed > 0:
            for stock in non_tech_stocks[:count_needed]:
                final_stocks.append(stock)
                added.append(stock.get('symbol'))
                # 从原分类中移除，避免重复
                if stock in category:
                    category.remove(stock)
        
        return added
    
    # 添加上涨股票
    if remaining_gainers_needed > 0 and gainers:
        # 按涨跌幅排序（从高到低）
        gainers.sort(key=lambda x: x.get('changePercent', 0), reverse=True)
        added = add_stocks_from_category(gainers, remaining_gainers_needed, "上涨")
        print(f"[动态筛选] 添加上涨股票: {added}")
    
    # 添加下跌股票
    if remaining_losers_needed > 0 and losers:
        # 按涨跌幅排序（从低到高，即下跌最多的在前）
        losers.sort(key=lambda x: x.get('changePercent', 0))
        added = add_stocks_from_category(losers, remaining_losers_needed, "下跌")
        print(f"[动态筛选] 添加下跌股票: {added}")
    
    # 添加平盘股票
    if remaining_neutral_needed > 0 and neutral:
        # 按接近0的程度排序
        neutral.sort(key=lambda x: abs(x.get('changePercent', 0)))
        added = add_stocks_from_category(neutral, remaining_neutral_needed, "平盘")
        print(f"[动态筛选] 添加平盘股票: {added}")
    
    # 如果还不够15支，从剩余股票中补充
    if len(final_stocks) < 15:
        remaining_needed = 15 - len(final_stocks)
        print(f"[动态筛选] 还需要{remaining_needed}支股票，从剩余候选池补充")
        
        # 收集所有未使用的股票
        all_remaining = gainers + losers + neutral
        # 优先选择科技股
        all_remaining.sort(key=lambda x: 0 if x.get('symbol') in TECH_STOCKS else 1)
        
        for stock in all_remaining[:remaining_needed]:
            final_stocks.append(stock)
    
    # 确保正好15支
    final_stocks = final_stocks[:15]
    
    # 统计结果
    final_gainers = len([s for s in final_stocks if s.get('changePercent', 0) > 0.1])
    final_losers = len([s for s in final_stocks if s.get('changePercent', 0) < -0.1])
    final_neutral = len([s for s in final_stocks if -0.1 <= s.get('changePercent', 0) <= 0.1])
    
    final_tech = len([s for s in final_stocks if s.get('symbol') in TECH_STOCKS])
    tech_percentage = (final_tech / len(final_stocks)) * 100 if final_stocks else 0
    
    print(f"[动态筛选] 最终结果: {len(final_stocks)}支股票")
    print(f"[动态筛选] 涨跌分布: {final_gainers}涨, {final_losers}跌, {final_neutral}平")
    print(f"[动态筛选] 科技股: {final_tech}支 ({tech_percentage:.1f}%)")
    print(f"[动态筛选] 股票列表: {[s.get('symbol') for s in final_stocks]}")
    

    
    # 返回格式与get_dashboard_stocks_concurrent一致
    return {
        "stocks": final_stocks,
        "count": len(final_stocks),
        "source": "Finnhub (动态筛选)",
        "timestamp": time.time(),
        "success": True,
        "elapsed": result.get('elapsed', 0),
        "selection_info": {
            "total": len(final_stocks),
            "gainers": final_gainers,
            "losers": final_losers,
            "neutral": final_neutral,
            "tech_stocks": final_tech,
            "tech_percentage": tech_percentage,
            "must_have_included": must_have_added
        }
    }

def get_market_stocks():
    """获取市场股票数据（优化版）"""
    try:
        symbols_param = request.args.get('symbols', '')
        dashboard = request.args.get('dashboard', 'false').lower() == 'true'
        
        if symbols_param:
            # 获取指定股票
            symbols = [s.strip().upper() for s in symbols_param.split(',') if s.strip()]
            print(f"[请求] 获取指定股票数据: {len(symbols)}支, dashboard={dashboard}")
        else:
            # 没有指定symbols
            if dashboard:
                # Dashboard请求：使用动态筛选
                print(f"[请求] Dashboard动态筛选15支股票")
                result = select_dashboard_stocks()
                return jsonify(result)
            else:
                # 普通请求：使用固定列表
                symbols = CANDIDATE_STOCKS[:15]  # 使用候选池前15支
                print(f"[请求] 普通请求使用固定列表: {len(symbols)}支")
        
        # 如果有指定symbols或普通请求，使用原有逻辑
        # Dashboard请求使用优化版本（并发+缓存+轻量级）
        if dashboard:
            result = get_dashboard_stocks_concurrent(symbols)
            return jsonify(result)
        else:
            # 普通请求（保持原有逻辑，串行但完整数据）
            print(f"[普通请求] 串行获取完整数据")
            stocks_data = []
            start_time = time.time()
            
            for symbol in symbols:
                symbol_start = time.time()
                stock_data = fetch_real_stock_data(symbol)
                symbol_elapsed = time.time() - symbol_start
                
                if stock_data:
                    stocks_data.append(stock_data)
                    print(f"  [完成] {symbol}: {symbol_elapsed:.2f}秒")
                else:
                    print(f"  [失败] {symbol}: {symbol_elapsed:.2f}秒")
            
            total_elapsed = time.time() - start_time
            print(f"[完成] 普通请求总计: {total_elapsed:.2f}秒")
            
            return jsonify({
                "stocks": stocks_data,
                "count": len(stocks_data),
                "source": "Finnhub",
                "timestamp": time.time(),
                "success": True,
                "elapsed": total_elapsed
            })
        
    except Exception as e:
        print(f"[错误] 获取市场数据时出错: {e}")
        return jsonify({
            "stocks": [],
            "count": 0,
            "source": "Finnhub (错误)",
            "timestamp": time.time(),
            "success": False,
            "error": str(e)
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

@app.route('/api/debug/symbols', methods=['GET'])
def debug_symbols():
    """调试端点：检查当前symbols配置"""
    return jsonify({
        "POPULAR_STOCKS": POPULAR_STOCKS,
        "POPULAR_STOCKS[:12]": POPULAR_STOCKS[:12],
        "POPULAR_STOCKS[:8]": POPULAR_STOCKS[:8],
        "timestamp": time.time()
    })

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