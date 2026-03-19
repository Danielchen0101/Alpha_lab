#!/usr/bin/env python3
"""
Fixed Quant Backend - 淇鍘嗗彶鏁版嵁403闂
"""

from flask import Flask, jsonify, request
from flask_cors import CORS
import random
import time
import os
import sys
import requests
from datetime import datetime, timedelta

# Finnhub API閰嶇疆锛堜粎鐢ㄤ簬瀹炴椂鏁版嵁锛?FINNHUB_API_KEY = 'd6qsdcpr01qgdhqc82hgd6qsdcpr01qgdhqc82i0'
FINNHUB_BASE_URL = 'https://finnhub.io/api/v1'

app = Flask(__name__)
CORS(app, origins=["http://localhost:3000", "http://localhost:3010"], supports_credentials=True)

# Candidate stock pool for dynamic selection
# 鍊欓€夎偂绁ㄦ睜锛岀敤浜庡姩鎬佺瓫閫?Dashboard 鏄剧ず鐨?5鏀偂绁?CANDIDATE_STOCKS = [
    # 绉戞妧鑲?(蹇呴』鍖呭惈: AAPL, NVDA)
    "AAPL",    # Apple - 蹇呴』鍖呭惈
    "MSFT",    # Microsoft
    "GOOGL",   # Alphabet (Google)
    "AMZN",    # Amazon
    "NVDA",    # NVIDIA - 蹇呴』鍖呭惈
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
    
    # 鐢靛姩姹借溅/鏂拌兘婧?(蹇呴』鍖呭惈: TSLA)
    "TSLA",    # Tesla - 蹇呴』鍖呭惈
    "RIVN",    # Rivian
    "LCID",    # Lucid
    "NIO",     # NIO
    "LI",      # Li Auto
    "XPEV",    # XPeng
    
    # 閲戣瀺鑲?    "JPM",     # JPMorgan Chase
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
    
    # 鍖荤枟/鍖昏嵂
    "JNJ",     # Johnson & Johnson
    "UNH",     # UnitedHealth
    "PFE",     # Pfizer
    "MRK",     # Merck
    "ABBV",    # AbbVie
    "LLY",     # Eli Lilly
    "TMO",     # Thermo Fisher
    "DHR",     # Danaher
    
    # 娑堣垂鍝?闆跺敭
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
    
    # 宸ヤ笟/鑳芥簮
    "CAT",     # Caterpillar
    "BA",      # Boeing
    "HON",     # Honeywell
    "GE",      # General Electric
    "MMM",     # 3M
    "XOM",     # Exxon Mobil
    "CVX",     # Chevron
    "COP",     # ConocoPhillips
    
    # 閫氫俊/濯掍綋
    "T",       # AT&T
    "VZ",      # Verizon
    "CMCSA",   # Comcast
    "DIS",     # Disney
    "NFLX",    # Netflix
    "PARA",    # Paramount
    "WBD",     # Warner Bros Discovery
    
    # 鍏朵粬
    "SPG",     # Simon Property Group
    "PLD",     # Prologis
    "AMT",     # American Tower
]

# 蹇呴』鍖呭惈鐨勮偂绁?(寮哄埗鍖呭惈)
MUST_HAVE_STOCKS = ["AAPL", "TSLA", "NVDA"]

# 绉戞妧鑲″畾涔?(鐢ㄤ簬璁＄畻绉戞妧鑲″崰姣?
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
        
        # 1. 鑾峰彇瀹炴椂鎶ヤ环鏁版嵁
        quote_url = f"{FINNHUB_BASE_URL}/quote"
        quote_params = {
            'symbol': symbol_upper,
            'token': FINNHUB_API_KEY
        }
        
        quote_response = requests.get(quote_url, params=quote_params, timeout=10)
        
        if quote_response.status_code != 200:
            print(f"Finnhub quote API閿欒: {quote_response.status_code}")
            return None
            
        quote_data = quote_response.json()
        
        # 璇︾粏璋冭瘯锛氭墦鍗癋innhub API杩斿洖鐨勬墍鏈夊瓧娈?        print(f"[DEBUG] Finnhub quote API 鎵€鏈夊瓧娈?({symbol_upper}):")
        for key, value in quote_data.items():
            print(f"  {key}: {value}")
        
        # 鐗瑰埆妫€鏌/l瀛楁
        print(f"[DEBUG] 鐗瑰埆妫€鏌?- h瀛楁: {quote_data.get('h')}, l瀛楁: {quote_data.get('l')}")
        
        # 2. 鑾峰彇鍏徃淇℃伅
        profile_url = f"{FINNHUB_BASE_URL}/stock/profile2"
        profile_params = {
            'symbol': symbol_upper,
            'token': FINNHUB_API_KEY
        }
        
        profile_response = requests.get(profile_url, params=profile_params, timeout=10)
        profile_data = profile_response.json() if profile_response.status_code == 200 else {}
        
        # 3. 鑾峰彇璐㈠姟鎸囨爣
        metric_url = f"{FINNHUB_BASE_URL}/stock/metric"
        metric_params = {
            'symbol': symbol_upper,
            'metric': 'all',
            'token': FINNHUB_API_KEY
        }
        
        metric_response = requests.get(metric_url, params=metric_params, timeout=10)
        metric_data = metric_response.json() if metric_response.status_code == 200 else {}
        
        # 鎻愬彇璐㈠姟鎸囨爣
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
        
        # 鏋勫缓杩斿洖鏁版嵁
        # 鏅鸿兘妫€娴媘arket cap
        market_cap = None
        if market_cap_raw:
            # 鏅鸿兘妫€娴嬶細妫€鏌arketCap鍘熷鍊兼槸鍚﹀湪鍚堢悊鑼冨洿鍐?            # 姝ｅ父USD鑲＄エ鐨刴arketCapitalization搴旇鍦?,000鍒?0,000,000涔嬮棿
            is_reasonable_usd = (
                currency == 'USD' and 
                1000 <= market_cap_raw <= 10_000_000
            )
            
            if is_reasonable_usd:
                # 姝ｅ父USD鑲＄エ锛氱櫨涓囩編鍏?鈫?缇庡厓
                market_cap = market_cap_raw * 1000000
                print(f"[姝ｅ父杞崲] {symbol_upper}: {market_cap_raw:.2f} 鈫?{market_cap}")
            else:
                # 寮傚父鎯呭喌锛氬崟浣嶄笉鏄庣‘銆侀潪USD璐у竵銆佹垨鍊煎紓甯?                market_cap = None
                reason = []
                if currency != 'USD':
                    reason.append(f"currency={currency}")
                if market_cap_raw < 1000:
                    reason.append(f"鍊艰繃灏?{market_cap_raw:.2f})")
                if market_cap_raw > 10_000_000:
                    reason.append(f"鍊艰繃澶?{market_cap_raw:.2f})")
                
                print(f"[璺宠繃杞崲] {symbol_upper}: {', '.join(reason)}")
        
        # 璋冭瘯锛氭鏌ayHigh/dayLow瀛楁鍊?        day_high_value = quote_data.get('h')
        day_low_value = quote_data.get('l')
        print(f"[DEBUG] {symbol_upper} - dayHigh: {day_high_value}, dayLow: {day_low_value}")
        
        # 寮哄埗纭繚dayHigh/dayLow瀛楁鏈夊€硷紙鍗充娇涓篘one涔熻鍖呭惈锛?        if day_high_value is None:
            print(f"[WARNING] {symbol_upper} - dayHigh is None, using price as fallback")
            day_high_value = quote_data.get('c')  # 浣跨敤褰撳墠浠锋牸浣滀负fallback
        
        if day_low_value is None:
            print(f"[WARNING] {symbol_upper} - dayLow is None, using price as fallback")
            day_low_value = quote_data.get('c')  # 浣跨敤褰撳墠浠锋牸浣滀负fallback
        
        stock_data = {
            "symbol": symbol_upper,
            "name": profile_data.get('name', symbol_upper),
            "price": quote_data.get('c'),
            "change": quote_data.get('d'),
            "changePercent": quote_data.get('dp'),
            "volume": quote_data.get('v', 0),  # Finnhub quote API涓嶆彁渚涙垚浜ら噺
            
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
        
        # 鐗规畩澶勭悊market cap锛堟櫤鑳芥娴嬪崟浣嶏級
        market_cap_raw = profile_data.get('marketCapitalization')
        currency = stock_data.get('currency', 'USD')
        
        if market_cap_raw:
            # 鏅鸿兘妫€娴嬶細妫€鏌arketCap鍘熷鍊兼槸鍚﹀湪鍚堢悊鑼冨洿鍐?            # 姝ｅ父USD鑲＄エ鐨刴arketCapitalization搴旇鍦?,000鍒?0,000,000涔嬮棿
            is_reasonable_usd = (
                currency == 'USD' and 
                1000 <= market_cap_raw <= 10_000_000
            )
            
            if is_reasonable_usd:
                # 姝ｅ父USD鑲＄エ锛氱櫨涓囩編鍏?鈫?缇庡厓
                stock_data['marketCap'] = market_cap_raw * 1000000
                print(f"[姝ｅ父杞崲] {symbol_upper}: {market_cap_raw} 鈫?{stock_data['marketCap']}")
            else:
                # 寮傚父鎯呭喌锛氬崟浣嶄笉鏄庣‘銆侀潪USD璐у竵銆佹垨鍊煎紓甯?                stock_data['marketCap'] = None
                reason = []
                if currency != 'USD':
                    reason.append(f"currency={currency}")
                if market_cap_raw < 1000:
                    reason.append(f"鍊艰繃灏?{market_cap_raw})")
                if market_cap_raw > 10_000_000:
                    reason.append(f"鍊艰繃澶?{market_cap_raw})")
                
                print(f"[璺宠繃杞崲] {symbol_upper}: {', '.join(reason)}")
        
        return stock_data
        
    except Exception as e:
        print(f"鑾峰彇鑲＄エ鏁版嵁鏃跺嚭閿?{symbol}: {e}")
        return None

# 瀵煎叆骞跺彂鍜岀紦瀛樼浉鍏冲簱
import concurrent.futures
import threading

# 缂撳瓨閰嶇疆
dashboard_cache = {}
cache_lock = threading.Lock()
CACHE_TTL = 60  # 60绉掔紦瀛?
# 鍚姩鏃舵竻闄ゆ棫缂撳瓨锛岀‘淇濇柊閰嶇疆鐢熸晥
print(f"[鍚姩] 娓呴櫎鏃х紦瀛橈紝搴旂敤鏂伴厤缃? 鍔ㄦ€佺瓫閫?5鏀偂绁?)
print(f"[鍚姩] 鍊欓€夎偂绁ㄦ睜澶у皬: {len(CANDIDATE_STOCKS)}鏀?)
print(f"[鍚姩] 蹇呴』鍖呭惈: {MUST_HAVE_STOCKS}")
with cache_lock:
    dashboard_cache.clear()

def fetch_stock_data_lightweight(symbol):
    """杞婚噺绾ц幏鍙栬偂绁ㄦ暟鎹紙鍙幏鍙栨牳蹇冨瓧娈碉紝鐢ㄤ簬Dashboard锛?""
    start_time = time.time()
    symbol_upper = symbol.upper()
    
    print(f"  [Dashboard] 寮€濮嬭幏鍙?{symbol_upper}")
    
    try:
        # 1. 鑾峰彇瀹炴椂鎶ヤ环鏁版嵁锛堟牳蹇冿級
        quote_start = time.time()
        quote_url = f"{FINNHUB_BASE_URL}/quote"
        quote_params = {'symbol': symbol_upper, 'token': FINNHUB_API_KEY}
        quote_response = requests.get(quote_url, params=quote_params, timeout=5)
        quote_elapsed = time.time() - quote_start
        
        if quote_response.status_code != 200:
            print(f"  [閿欒] {symbol_upper} quote API澶辫触: {quote_response.status_code}")
            return None
        
        quote_data = quote_response.json()
        print(f"  [瀹屾垚] {symbol_upper} quote: {quote_elapsed:.2f}绉?)
        
        # 璋冭瘯锛氭鏌uote_data涓殑h/l瀛楁
        print(f"  [DEBUG] {symbol_upper} quote_data keys: {list(quote_data.keys())}")
        print(f"  [DEBUG] {symbol_upper} h瀛楁: {quote_data.get('h')}, l瀛楁: {quote_data.get('l')}")
        
        # 2. 鑾峰彇鍏徃绠€浠嬶紙鐢ㄤ簬marketCap鍜宻ector锛?        profile_start = time.time()
        profile_url = f"{FINNHUB_BASE_URL}/stock/profile2"
        profile_params = {'symbol': symbol_upper, 'token': FINNHUB_API_KEY}
        profile_response = requests.get(profile_url, params=profile_params, timeout=5)
        profile_elapsed = time.time() - profile_start
        
        if profile_response.status_code != 200:
            print(f"  [璀﹀憡] {symbol_upper} profile API澶辫触锛屼娇鐢ㄩ粯璁ゅ€?)
            profile_data = {}
        else:
            profile_data = profile_response.json()
        
        print(f"  [瀹屾垚] {symbol_upper} profile: {profile_elapsed:.2f}绉?)
        
        # 鎻愬彇鏍稿績瀛楁
        price = quote_data.get('c')
        change = quote_data.get('d')
        change_percent = quote_data.get('dp')
        previous_close = quote_data.get('pc')
        
        # 璁＄畻娑ㄨ穼骞咃紙濡傛灉API娌℃湁鎻愪緵锛?        if price is not None and previous_close is not None and previous_close != 0:
            if change is None:
                change = price - previous_close
            if change_percent is None:
                change_percent = (change / previous_close) * 100
        
        # 澶勭悊marketCap锛堟櫤鑳芥娴嬪崟浣嶏紝閬垮厤涓€鍒€鍒囪浆鎹級
        market_cap_raw = profile_data.get('marketCapitalization')
        currency = profile_data.get('currency', 'USD')
        
        market_cap = None
        if market_cap_raw:
            # 鏅鸿兘妫€娴嬶細妫€鏌arketCap鍘熷鍊兼槸鍚﹀湪鍚堢悊鑼冨洿鍐?            # 姝ｅ父USD鑲＄エ鐨刴arketCapitalization搴旇鍦?,000鍒?0,000,000涔嬮棿
            # 杩欏搴?B鍒?0T甯傚€硷紙鐧句竾缇庡厓鍗曚綅锛?            is_reasonable_usd = (
                currency == 'USD' and 
                1000 <= market_cap_raw <= 10_000_000
            )
            
            if is_reasonable_usd:
                # 姝ｅ父USD鑲＄エ锛氱櫨涓囩編鍏?鈫?缇庡厓
                market_cap = market_cap_raw * 1000000
                print(f"[姝ｅ父杞崲] {symbol_upper}: {market_cap_raw:.2f} 鈫?{market_cap}")
            else:
                # 寮傚父鎯呭喌锛氬崟浣嶄笉鏄庣‘銆侀潪USD璐у竵銆佹垨鍊煎紓甯?                market_cap = None
                reason = []
                if currency != 'USD':
                    reason.append(f"currency={currency}")
                if market_cap_raw < 1000:
                    reason.append(f"鍊艰繃灏?{market_cap_raw:.2f})")
                if market_cap_raw > 10_000_000:
                    reason.append(f"鍊艰繃澶?{market_cap_raw:.2f})")
                
                print(f"[璺宠繃杞崲] {symbol_upper}: {', '.join(reason)}")
        
        # 鏋勫缓杩斿洖鏁版嵁锛堝彧鍖呭惈Dashboard闇€瑕佺殑鏍稿績瀛楁锛?        # 纭繚dayHigh鍜宒ayLow瀛楁鎬绘槸琚缃?        day_high = quote_data.get('h')
        day_low = quote_data.get('l')
        
        print(f"  [DEBUG] 璁剧疆dayHigh: {day_high}, dayLow: {day_low}")
        
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
        print(f"  [瀹屾垚] {symbol_upper} 鎬昏: {total_elapsed:.2f}绉?)
        
        return stock_data
        
    except Exception as e:
        print(f"  [寮傚父] 鑾峰彇 {symbol_upper} 鏁版嵁澶辫触: {str(e)}")
        return None

def get_dashboard_stocks_concurrent(symbols):
    """骞跺彂鑾峰彇Dashboard鑲＄エ鏁版嵁锛堝甫缂撳瓨锛?""
    # 妫€鏌ョ紦瀛?    cache_key = f"dashboard:{','.join(sorted(symbols))}"
    
    # 寮哄埗娓呴櫎鎵€鏈夌紦瀛橈紝纭繚淇鐢熸晥
    print(f"[缂撳瓨娓呯悊] 寮哄埗娓呴櫎鎵€鏈夌紦瀛橈紝纭繚market cap淇鐢熸晥")
    with cache_lock:
        dashboard_cache.clear()
        print(f"[缂撳瓨娓呯悊] 宸叉竻闄ゆ墍鏈夌紦瀛?)
    
    with cache_lock:
        if cache_key in dashboard_cache:
            cache_data, cache_time = dashboard_cache[cache_key]
            if time.time() - cache_time < CACHE_TTL:
                print(f"[缂撳瓨鍛戒腑] Dashboard鏁版嵁 ({len(symbols)}鏀偂绁?")
                return cache_data
    
    print(f"[寮€濮媇 骞跺彂鑾峰彇Dashboard鏁版嵁 ({len(symbols)}鏀偂绁?")
    print(f"[璋冭瘯] 浼犲叆鐨剆ymbols: {symbols}")
    start_time = time.time()
    
    stocks_data = []
    errors = []
    
    # 浣跨敤绾跨▼姹犲苟鍙戣幏鍙?    max_workers = min(4, len(symbols))  # 闄愬埗骞跺彂鏁帮紝閬垮厤瑙﹀彂閫熺巼闄愬埗
    
    print(f"[骞跺彂] 浣跨敤 {max_workers} 涓嚎绋?)
    
    with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
        # 鎻愪氦鎵€鏈変换鍔?        future_to_symbol = {
            executor.submit(fetch_stock_data_lightweight, symbol): symbol 
            for symbol in symbols
        }
        
        # 鏀堕泦缁撴灉
        for future in concurrent.futures.as_completed(future_to_symbol):
            symbol = future_to_symbol[future]
            try:
                stock_data = future.result(timeout=8)  # 姣忓彧鑲＄エ鏈€澶?绉?                
                if stock_data:
                    stocks_data.append(stock_data)
                else:
                    errors.append(f"{symbol}: 鑾峰彇鏁版嵁澶辫触")
                    
            except concurrent.futures.TimeoutError:
                errors.append(f"{symbol}: 璇锋眰瓒呮椂锛?绉掞級")
                print(f"  [瓒呮椂] {symbol}")
            except Exception as e:
                errors.append(f"{symbol}: {str(e)}")
                print(f"  [寮傚父] {symbol}: {str(e)}")
    
    total_elapsed = time.time() - start_time
    print(f"[瀹屾垚] Dashboard鑾峰彇瀹屾垚: {len(stocks_data)}鎴愬姛, {len(errors)}澶辫触, 鑰楁椂{total_elapsed:.2f}绉?)
    
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
    
    # 缂撳瓨缁撴灉
    with cache_lock:
        dashboard_cache[cache_key] = (result, time.time())
        print(f"[缂撳瓨] 缂撳瓨Dashboard鏁版嵁 ({len(symbols)}鏀偂绁?")
    
    return result

@app.route('/api/market/stocks', methods=['GET'])
def select_dashboard_stocks():
    """
    鍔ㄦ€佺瓫閫塂ashboard鏄剧ず鐨?5鏀偂绁?    鐩爣锛?鏀笂娑紝7鏀笅璺岋紝1鏀帴杩戝钩鐩?    蹇呴』鍖呭惈锛欰APL, TSLA, NVDA
    灏介噺淇濊瘉绉戞妧鑲″崰姣旀洿楂?    """
    print(f"[鍔ㄦ€佺瓫閫塢 寮€濮嬩粠鍊欓€夋睜绛涢€?5鏀偂绁?)
    print(f"[鍔ㄦ€佺瓫閫塢 鍊欓€夋睜澶у皬: {len(CANDIDATE_STOCKS)}鏀?)
    print(f"[鍔ㄦ€佺瓫閫塢 蹇呴』鍖呭惈: {MUST_HAVE_STOCKS}")
    
    # 浠庡€欓€夋睜涓幏鍙栨暟鎹紙闄愬埗鏁伴噺浠ラ伩鍏岮PI闄愬埗锛?    # 鍏堣幏鍙栧墠30鏀€欓€夎偂绁ㄧ殑鏁版嵁
    sample_size = min(30, len(CANDIDATE_STOCKS))
    sample_stocks = CANDIDATE_STOCKS[:sample_size]
    
    print(f"[鍔ㄦ€佺瓫閫塢 鑾峰彇{sample_size}鏀€欓€夎偂绁ㄦ暟鎹?..")
    result = get_dashboard_stocks_concurrent(sample_stocks)
    
    if not result.get('success', False):
        print(f"[鍔ㄦ€佺瓫閫塢 鑾峰彇鍊欓€夋暟鎹け璐ワ紝浣跨敤澶囩敤鏂规")
        # 澶囩敤鏂规锛氫娇鐢ㄥ繀椤诲寘鍚殑鑲＄エ + 鍏朵粬鑲＄エ
        backup_stocks = MUST_HAVE_STOCKS + CANDIDATE_STOCKS[3:18]  # 3涓繀椤?+ 12涓叾浠?        return backup_stocks
    
    stocks = result.get('stocks', [])
    print(f"[鍔ㄦ€佺瓫閫塢 鎴愬姛鑾峰彇{len(stocks)}鏀€欓€夎偂绁ㄦ暟鎹?)
    
    # 鍒嗙被鑲＄エ
    gainers = []
    losers = []
    neutral = []
    
    for stock in stocks:
        change_percent = stock.get('changePercent', 0)
        
        if change_percent > 0.1:  # 涓婃定瓒呰繃0.1%
            gainers.append(stock)
        elif change_percent < -0.1:  # 涓嬭穼瓒呰繃0.1%
            losers.append(stock)
        else:  # 骞崇洏
            neutral.append(stock)
    
    print(f"[鍔ㄦ€佺瓫閫塢 鍒嗙被缁撴灉: {len(gainers)}娑? {len(losers)}璺? {len(neutral)}骞?)
    
    # 纭繚蹇呴』鍖呭惈鐨勮偂绁ㄥ湪缁撴灉涓?    final_stocks = []
    must_have_added = []
    
    for must_symbol in MUST_HAVE_STOCKS:
        found = False
        # 鍦ㄦ墍鏈夊垎绫讳腑鏌ユ壘
        for category in [gainers, losers, neutral]:
            for stock in category:
                if stock.get('symbol') == must_symbol:
                    final_stocks.append(stock)
                    category.remove(stock)  # 浠庡師鍒嗙被绉婚櫎
                    must_have_added.append(must_symbol)
                    found = True
                    break
            if found:
                break
        
        if not found:
            print(f"[鍔ㄦ€佺瓫閫塢 璀﹀憡: 蹇呴』鍖呭惈鐨勮偂绁?{must_symbol} 涓嶅湪鍊欓€夋暟鎹腑")
    
    print(f"[鍔ㄦ€佺瓫閫塢 宸叉坊鍔犲繀椤诲寘鍚殑鑲＄エ: {must_have_added}")
    
    # 鐩爣锛?娑?璺?骞?    target_gainers = 7
    target_losers = 7
    target_neutral = 1
    
    # 璋冩暣鐩爣锛堣€冭檻宸叉坊鍔犵殑蹇呴』鍖呭惈鑲＄エ锛?    # 缁熻宸叉坊鍔犵殑鑲＄エ灞炰簬鍝釜鍒嗙被
    added_gainers = len([s for s in final_stocks if s.get('changePercent', 0) > 0.1])
    added_losers = len([s for s in final_stocks if s.get('changePercent', 0) < -0.1])
    added_neutral = len([s for s in final_stocks if -0.1 <= s.get('changePercent', 0) <= 0.1])
    
    remaining_gainers_needed = max(0, target_gainers - added_gainers)
    remaining_losers_needed = max(0, target_losers - added_losers)
    remaining_neutral_needed = max(0, target_neutral - added_neutral)
    
    print(f"[鍔ㄦ€佺瓫閫塢 鍓╀綑闇€瑕? {remaining_gainers_needed}娑? {remaining_losers_needed}璺? {remaining_neutral_needed}骞?)
    
    # 浠庡悇鍒嗙被涓坊鍔犺偂绁紝浼樺厛閫夋嫨绉戞妧鑲?    def add_stocks_from_category(category, count_needed, category_name):
        added = []
        # 浼樺厛閫夋嫨绉戞妧鑲?        tech_stocks = [s for s in category if s.get('symbol') in TECH_STOCKS]
        non_tech_stocks = [s for s in category if s.get('symbol') not in TECH_STOCKS]
        
        # 鍏堟坊鍔犵鎶€鑲?        for stock in tech_stocks[:count_needed]:
            final_stocks.append(stock)
            added.append(stock.get('symbol'))
            # 浠庡師鍒嗙被涓Щ闄わ紝閬垮厤閲嶅
            if stock in category:
                category.remove(stock)
            count_needed -= 1
        
        # 濡傛灉杩橀渶瑕佹洿澶氾紝娣诲姞闈炵鎶€鑲?        if count_needed > 0:
            for stock in non_tech_stocks[:count_needed]:
                final_stocks.append(stock)
                added.append(stock.get('symbol'))
                # 浠庡師鍒嗙被涓Щ闄わ紝閬垮厤閲嶅
                if stock in category:
                    category.remove(stock)
        
        return added
    
    # 娣诲姞涓婃定鑲＄エ
    if remaining_gainers_needed > 0 and gainers:
        # 鎸夋定璺屽箙鎺掑簭锛堜粠楂樺埌浣庯級
        gainers.sort(key=lambda x: x.get('changePercent', 0), reverse=True)
        added = add_stocks_from_category(gainers, remaining_gainers_needed, "涓婃定")
        print(f"[鍔ㄦ€佺瓫閫塢 娣诲姞涓婃定鑲＄エ: {added}")
    
    # 娣诲姞涓嬭穼鑲＄エ
    if remaining_losers_needed > 0 and losers:
        # 鎸夋定璺屽箙鎺掑簭锛堜粠浣庡埌楂橈紝鍗充笅璺屾渶澶氱殑鍦ㄥ墠锛?        losers.sort(key=lambda x: x.get('changePercent', 0))
        added = add_stocks_from_category(losers, remaining_losers_needed, "涓嬭穼")
        print(f"[鍔ㄦ€佺瓫閫塢 娣诲姞涓嬭穼鑲＄エ: {added}")
    
    # 娣诲姞骞崇洏鑲＄エ
    if remaining_neutral_needed > 0 and neutral:
        # 鎸夋帴杩?鐨勭▼搴︽帓搴?        neutral.sort(key=lambda x: abs(x.get('changePercent', 0)))
        added = add_stocks_from_category(neutral, remaining_neutral_needed, "骞崇洏")
        print(f"[鍔ㄦ€佺瓫閫塢 娣诲姞骞崇洏鑲＄エ: {added}")
    
    # 濡傛灉杩樹笉澶?5鏀紝浠庡墿浣欒偂绁ㄤ腑琛ュ厖
    if len(final_stocks) < 15:
        remaining_needed = 15 - len(final_stocks)
        print(f"[鍔ㄦ€佺瓫閫塢 杩橀渶瑕亄remaining_needed}鏀偂绁紝浠庡墿浣欏€欓€夋睜琛ュ厖")
        
        # 鏀堕泦鎵€鏈夋湭浣跨敤鐨勮偂绁?        all_remaining = gainers + losers + neutral
        # 浼樺厛閫夋嫨绉戞妧鑲?        all_remaining.sort(key=lambda x: 0 if x.get('symbol') in TECH_STOCKS else 1)
        
        for stock in all_remaining[:remaining_needed]:
            final_stocks.append(stock)
    
    # 纭繚姝ｅソ15鏀?    final_stocks = final_stocks[:15]
    
    # 缁熻缁撴灉
    final_gainers = len([s for s in final_stocks if s.get('changePercent', 0) > 0.1])
    final_losers = len([s for s in final_stocks if s.get('changePercent', 0) < -0.1])
    final_neutral = len([s for s in final_stocks if -0.1 <= s.get('changePercent', 0) <= 0.1])
    
    final_tech = len([s for s in final_stocks if s.get('symbol') in TECH_STOCKS])
    tech_percentage = (final_tech / len(final_stocks)) * 100 if final_stocks else 0
    
    print(f"[鍔ㄦ€佺瓫閫塢 鏈€缁堢粨鏋? {len(final_stocks)}鏀偂绁?)
    print(f"[鍔ㄦ€佺瓫閫塢 娑ㄨ穼鍒嗗竷: {final_gainers}娑? {final_losers}璺? {final_neutral}骞?)
    print(f"[鍔ㄦ€佺瓫閫塢 绉戞妧鑲? {final_tech}鏀?({tech_percentage:.1f}%)")
    print(f"[鍔ㄦ€佺瓫閫塢 鑲＄エ鍒楄〃: {[s.get('symbol') for s in final_stocks]}")
    

    
    # 杩斿洖鏍煎紡涓巊et_dashboard_stocks_concurrent涓€鑷?    return {
        "stocks": final_stocks,
        "count": len(final_stocks),
        "source": "Finnhub (鍔ㄦ€佺瓫閫?",
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

@app.route('/api/market/stock/<symbol>', methods=['GET'])
def get_stock_data(symbol):
    """鑾峰彇鍗曚釜鑲＄エ鏁版嵁"""
    try:
        stock_data = fetch_real_stock_data(symbol)
        
        if stock_data:
            return jsonify(stock_data)
        else:
            return jsonify({
                "symbol": symbol.upper(),
                "error": "鏃犳硶鑾峰彇鑲＄エ鏁版嵁",
                "dataSource": "Finnhub (閿欒)"
            }), 404
            
    except Exception as e:
        print(f"鑾峰彇鑲＄エ鏁版嵁鏃跺嚭閿?{symbol}: {e}")
        return jsonify({
            "symbol": symbol.upper(),
            "error": f"鏈嶅姟鍣ㄩ敊璇? {str(e)}",
            "dataSource": "鏈嶅姟鍣ㄩ敊璇?
        }), 500

@app.route('/api/market/stocks', methods=['GET'])
def select_dashboard_stocks():
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

@app.route('/api/debug/symbols', methods=['GET'])
def debug_symbols():
    """璋冭瘯绔偣锛氭鏌ュ綋鍓峴ymbols閰嶇疆"""
    return jsonify({
        "POPULAR_STOCKS": POPULAR_STOCKS,
        "POPULAR_STOCKS[:12]": POPULAR_STOCKS[:12],
        "POPULAR_STOCKS[:8]": POPULAR_STOCKS[:8],
        "timestamp": time.time()
    })

@app.route('/api/market/history/<symbol>', methods=['GET'])
def get_stock_history(symbol):
    """鑾峰彇鑲＄エ鍘嗗彶浠锋牸鏁版嵁 - 浣跨敤 Finnhub 浣滀负鏁版嵁婧?""
    try:
        # 鑾峰彇鏌ヨ鍙傛暟
        interval = request.args.get('interval', '1day')
        range_param = request.args.get('range', '1month')
        
        print(f"=== Finnhub鍘嗗彶鏁版嵁璇锋眰 ===")
        print(f"鑲＄エ: {symbol}, interval={interval}, range={range_param}")
        
        # 鏄犲皠鍒癋innhub鍙傛暟
        # Finnhub鏀寔鐨勫垎杈ㄧ巼: 1, 5, 15, 30, 60, D, W, M
        interval_map = {
            '5min': '5',
            '1day': 'D'
        }
        
        # 鏄犲皠鏃堕棿鑼冨洿鍒板紑濮嬫椂闂存埑
        range_to_days = {
            '1day': 1,
            '1week': 7,
            '1month': 30,
            '3month': 90,
            '1year': 365
        }
        
        finnhub_resolution = interval_map.get(interval, 'D')
        days_back = range_to_days.get(range_param, 30)
        
        # 璁＄畻鏃堕棿鎴?        to_timestamp = int(time.time())
        from_timestamp = to_timestamp - (days_back * 24 * 60 * 60)
        
        print(f"Finnhub鍙傛暟: resolution={finnhub_resolution}, from={from_timestamp}, to={to_timestamp}")
        
        try:
            # 浣跨敤Finnhub鑾峰彇鍘嗗彶鏁版嵁
            url = f"{FINNHUB_BASE_URL}/stock/candle"
            params = {
                'symbol': symbol.upper(),
                'resolution': finnhub_resolution,
                'from': from_timestamp,
                'to': to_timestamp,
                'token': FINNHUB_API_KEY
            }
            
            response = requests.get(url, params=params, timeout=10)
            
            if response.status_code != 200:
                print(f"Finnhub鍘嗗彶鏁版嵁API閿欒: {response.status_code}")
                return jsonify({
                    "symbol": symbol.upper(),
                    "error": f"Finnhub API閿欒: {response.status_code}",
                    "dataSource": "Finnhub (API閿欒)",
                    "data": [],
                    "interval": interval,
                    "range": range_param
                }), response.status_code
            
            data = response.json()
            
            if data.get('s') != 'ok':
                print(f"Finnhub杩斿洖閿欒鐘舵€? {data.get('s')}")
                return jsonify({
                    "symbol": symbol.upper(),
                    "error": f"Finnhub鏁版嵁閿欒: {data.get('s')}",
                    "dataSource": "Finnhub (鏁版嵁閿欒)",
                    "data": [],
                    "interval": interval,
                    "range": range_param
                }), 404
            
            # 鏍煎紡鍖栨暟鎹?            formatted_data = []
            timestamps = data.get('t', [])
            opens = data.get('o', [])
            highs = data.get('h', [])
            lows = data.get('l', [])
            closes = data.get('c', [])
            volumes = data.get('v', [])
            
            for i in range(len(timestamps)):
                formatted_data.append({
                    "timestamp": timestamps[i],
                    "time": datetime.fromtimestamp(timestamps[i]).isoformat(),
                    "open": float(opens[i]) if i < len(opens) else 0,
                    "high": float(highs[i]) if i < len(highs) else 0,
                    "low": float(lows[i]) if i < len(lows) else 0,
                    "close": float(closes[i]) if i < len(closes) else 0,
                    "volume": int(volumes[i]) if i < len(volumes) else 0
                })
            
            print(f"Finnhub杩斿洖鏁版嵁鏉℃暟: {len(formatted_data)}")
            
            return jsonify({
                "symbol": symbol.upper(),
                "interval": interval,
                "range": range_param,
                "data": formatted_data,
                "count": len(formatted_data),
                "dataSource": "Finnhub",
                "timestamp": time.time()
            })
                
        except Exception as e:
            print(f"Finnhub API璋冪敤寮傚父: {e}")
            return jsonify({
                "symbol": symbol.upper(),
                "error": f"Finnhub API寮傚父: {str(e)}",
                "dataSource": "Finnhub (寮傚父)",
                "data": [],
                "interval": interval,
                "range": range_param
            }), 500
        
    except Exception as e:
        print(f"鑾峰彇鍘嗗彶鏁版嵁鏃跺嚭閿? {e}")
        return jsonify({
            "symbol": symbol.upper(),
            "error": f"鏈嶅姟鍣ㄩ敊璇? {str(e)}",
            "dataSource": "鏈嶅姟鍣ㄩ敊璇?,
            "data": [],
            "interval": interval,
            "range": range_param
        }), 500

@app.route('/api/market/search', methods=['GET'])
def search_stocks():
    """鎼滅储鑲＄エ"""
    try:
        query = request.args.get('q', '').strip().upper()
        
        if not query:
            return jsonify({
                "results": [],
                "count": 0,
                "source": "Finnhub (鏃犳煡璇?",
                "timestamp": time.time()
            })
        
        # 绠€鍗曡繃婊ょ儹闂ㄨ偂绁?        results = []
        for symbol in POPULAR_STOCKS:
            if query in symbol or query in symbol.lower():
                results.append({
                    "symbol": symbol,
                    "name": symbol,
                    "exchange": "NASDAQ/NYSE",
                    "currency": "USD"
                })
        
        return jsonify({
            "results": results[:10],  # 闄愬埗10涓粨鏋?            "count": len(results),
            "source": "Finnhub",
            "timestamp": time.time()
        })
        
    except Exception as e:
        print(f"鎼滅储鑲＄エ鏃跺嚭閿? {e}")
        return jsonify({
            "results": [],
            "count": 0,
            "source": "Finnhub (閿欒)",
            "timestamp": time.time()
        }), 500

@app.route('/api/status', methods=['GET'])
def get_status():
    """鑾峰彇绯荤粺鐘舵€?""
    uptime = time.time() - START_TIME
    
    return jsonify({
        "status": "online",
        "uptime": uptime,
        "timestamp": time.time(),
        "apis": {
            "finnhub": "active (real-time and historical data)",
            "alpaca": "not configured"
        }
    })

if __name__ == '__main__':
    print("Starting Quant Backend Server...")
    print("APIs:")
    print("  - Finnhub: Real-time and historical stock data")
    print("  - Port: 8889")
    
    app.run(host='127.0.0.1', port=8889, debug=False)

