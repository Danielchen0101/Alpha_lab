"""

简化版后端 - 包含所有核心功能和 AI 接口

"""

from flask import Flask, request, jsonify

from flask_cors import CORS

import time

import requests

import json

import os

import sys

import threading

from concurrent.futures import ThreadPoolExecutor, as_completed

from datetime import datetime, timedelta

import dateutil.parser



# 自定义异常类

class RateLimitError(Exception):

    """Alpaca API 速率限制异常"""

    def __init__(self, message, wait_seconds=60, remaining_symbols=None, scanned_symbols=None):

        super().__init__(message)

        self.wait_seconds = wait_seconds

        self.remaining_symbols = remaining_symbols or []

        self.scanned_symbols = scanned_symbols or []

        

class AlpacaAPIError(Exception):

    """Alpaca API 错误异常"""

    pass



app = Flask(__name__)

CORS(app)



# ==================== 配置导入 ====================

try:

    # 尝试导入配置

    sys.path.append(os.path.dirname(os.path.abspath(__file__)))

    import config as config_module

    print(f"[配置加载] config模块文件路径: {config_module.__file__}")

    from config import (

        FINNHUB_API_KEY,

        FINNHUB_BASE_URL,

        ALPACA_API_KEY,

        ALPACA_API_SECRET,

        ALPACA_BASE_URL,

        DEFAULT_SYMBOLS,

        TIMEFRAME_MAP,

        DATA_SOURCE,

        REQUEST_TIMEOUT

    )

    print(f"[配置加载] Finnhub API Key: {FINNHUB_API_KEY[:10]}...")

    print(f"[配置加载] Alpaca API Key: {ALPACA_API_KEY[:10]}...")

    print(f"[配置加载] Alpaca API Key 完整预览: {ALPACA_API_KEY[:6]}...{ALPACA_API_KEY[-4:] if len(ALPACA_API_KEY) > 10 else ALPACA_API_KEY}")

    print(f"[配置加载] Alpaca API Secret 长度: {len(ALPACA_API_SECRET) if ALPACA_API_SECRET else 0}")

    print(f"[配置加载] 默认股票列表: {DEFAULT_SYMBOLS}")

except ImportError as e:

    print(f"[警告] 无法导入配置: {e}")

    # 设置默认值

    FINNHUB_API_KEY = "d6qsdcpr01qgdhqc82hgd6qsdcpr01qgdhqc82i0"

    FINNHUB_BASE_URL = "https://finnhub.io/api/v1"

    # 混合行业候选池 - 确保包含AAPL、TSLA、NVDA，并且有不同行业

    DEFAULT_SYMBOLS = [

        # Technology (必须包含的)

        "AAPL",  # Apple Inc. - Technology

        "NVDA",  # NVIDIA Corporation - Technology/Semiconductors



        # Automotive

        "TSLA",  # Tesla Inc. - Automotive



        # 其他行业 - 确保多样性

        "JPM",   # JPMorgan Chase & Co. - Financial Services

        "JNJ",   # Johnson & Johnson - Healthcare

        "XOM",   # Exxon Mobil Corporation - Energy

        "WMT",   # Walmart Inc. - Consumer Defensive

        "UNH",   # UnitedHealth Group Incorporated - Healthcare

        "V",     # Visa Inc. - Financial Services

        "PG",    # Procter & Gamble Company - Consumer Defensive

        "HD"     # Home Depot Inc. - Consumer Cyclical

    ]

    TIMEFRAME_MAP = {

        "1D": {"multiplier": 1, "timespan": "minute", "limit": 390},

        "1W": {"multiplier": 1, "timespan": "day", "limit": 5},

        "1M": {"multiplier": 1, "timespan": "day", "limit": 20},

        "3M": {"multiplier": 1, "timespan": "day", "limit": 60},

        "1Y": {"multiplier": 1, "timespan": "day", "limit": 252},

    }

    DATA_SOURCE = {"market_data": "Finnhub", "trading": "Alpaca Markets"}

    REQUEST_TIMEOUT = 10



# ==================== AI 接口 ====================



# AI Provider 配置状态

ai_provider_config_state = {

    'provider': 'DeepSeek',

    'apiKey': 'sk-83365246617844178bf8d1e121b7279f',  # 硬编码API密钥用于测试

    'baseURL': 'https://api.deepseek.com',

    'model': 'deepseek-chat'

}



# Alpaca 配置状态

# 统一使用 config.py 导入的 Alpaca 凭据，不保留任何硬编码回退

alpaca_config_state = {

    'paper_api_key': '',  # Paper trading key - 预留

    'paper_api_secret': '',  # Paper trading secret

    'live_api_key': ALPACA_API_KEY,  # 直接使用从config.py导入的真实交易密钥

    'live_api_secret': ALPACA_API_SECRET,  # 直接使用从config.py导入的真实交易密钥

    'environment': 'live'  # 'paper' 或 'live' - 改为 live 环境使用真实交易

}



# 打印 Alpaca 配置状态（安全掩码）

key_preview = f"{alpaca_config_state['live_api_key'][:6]}...{alpaca_config_state['live_api_key'][-4:]}" if alpaca_config_state['live_api_key'] else "None"

secret_len = len(alpaca_config_state['live_api_secret']) if alpaca_config_state['live_api_secret'] else 0

print(f"[Alpaca配置] 环境: {alpaca_config_state['environment']}")

print(f"[Alpaca配置] Live API Key (掩码): {key_preview}")

print(f"[Alpaca配置] Live API Secret 长度: {secret_len} 字符")



# ==================== 缓存配置 ====================

CACHE_TTL = 60  # 缓存时间（秒）



# ==================== Backtest History 配置 ====================

# 全局的backtest历史存储

backtest_history = []

backtest_history_lock = threading.Lock()

MAX_HISTORY_SIZE = 100  # 最多保存100个backtest记录



print(f"[Backtest History] 初始化: backtest_history = {backtest_history}, id = {id(backtest_history)}")



class SimpleCache:

    """简单内存缓存"""

    def __init__(self):

        self.cache = {}

        self.timestamps = {}



    def get(self, key):

        if key in self.cache:

            timestamp = self.timestamps.get(key, 0)

            if time.time() - timestamp < CACHE_TTL:

                return self.cache[key]

            else:

                # 缓存过期，删除

                del self.cache[key]

                del self.timestamps[key]

        return None



    def set(self, key, value):

        self.cache[key] = value

        self.timestamps[key] = time.time()



    def clear(self):

        self.cache.clear()

        self.timestamps.clear()



# 全局缓存实例

stock_cache = SimpleCache()



def get_cache_key(symbol, data_type):

    """生成缓存键"""

    return f"{symbol}_{data_type}"



# ==================== Alpaca Market Data 函数 ====================

def fetch_alpaca_stock_data(symbol):

    """获取Alpaca股票数据（最新报价和基本信息）"""

    cache_key = get_cache_key(symbol, 'alpaca_quote')



    # 暂时禁用缓存，避免数据结构问题

    # cached = stock_cache.get(cache_key)

    # if cached is not None:

    #     return cached, None



    try:

        # 获取Alpaca配置

        environment = alpaca_config_state.get('environment', 'paper')



        if environment == 'paper':

            api_key = alpaca_config_state.get('paper_api_key')

            api_secret = alpaca_config_state.get('paper_api_secret')

            base_url = 'https://paper-api.alpaca.markets'

        else:

            api_key = alpaca_config_state.get('live_api_key')

            api_secret = alpaca_config_state.get('live_api_secret')

            base_url = 'https://api.alpaca.markets'



        # 检查API密钥

        if not api_key or not api_secret:

            print(f'[Alpaca数据] 股票 {symbol} API密钥未配置')

            return None, 'Alpaca API密钥未配置'



        headers = {

            'APCA-API-KEY-ID': api_key,

            'APCA-API-SECRET-KEY': api_secret

        }



        # 使用Alpaca市场数据API - 按照正确优先级获取数据

        print(f'[Alpaca数据] 获取股票 {symbol} 市场数据')



        # 1. 优先获取最新交易数据 (trade.p 是真实成交价)

        market_headers = {

            'APCA-API-KEY-ID': api_key,

            'APCA-API-SECRET-KEY': api_secret

        }



        trade_data = {}

        quote_data = {}



        # 尝试获取最新交易

        trade_url = f'https://data.alpaca.markets/v2/stocks/{symbol}/trades/latest'

        trade_response = requests.get(trade_url, headers=market_headers, timeout=5)



        if trade_response.status_code == 200:

            trade_data = trade_response.json().get('trade', {})

            print(f'[Alpaca数据] 股票 {symbol} 获取到最新交易数据: {trade_data.get("p")}')

        else:

            print(f'[Alpaca数据] 股票 {symbol} 最新交易数据获取失败: {trade_response.status_code}')



        # 2. 获取最新报价数据

        quote_url = f'https://data.alpaca.markets/v2/stocks/{symbol}/quotes/latest'

        quote_response = requests.get(quote_url, headers=market_headers, timeout=5)



        if quote_response.status_code == 200:

            quote_data = quote_response.json().get('quote', {})

            print(f'[Alpaca数据] 股票 {symbol} 获取到报价数据')

        else:

            print(f'[Alpaca数据] 股票 {symbol} 报价数据获取失败: {quote_response.status_code}')



        # 3. 尝试获取bars数据 (用于OHLCV)

        bars_data = {}

        daily_bars_data = {}

        previous_close = None



        # 3.1 获取最新bar（用于OHLC）

        bars_url = f'https://data.alpaca.markets/v2/stocks/{symbol}/bars/latest'

        bars_response = requests.get(bars_url, headers=market_headers, timeout=5)



        if bars_response.status_code == 200:

            bars_data = bars_response.json().get('bar', {})

            print(f'[Alpaca数据] 股票 {symbol} 获取到最新bar数据')

        else:

            print(f'[Alpaca数据] 股票 {symbol} 最新bar数据获取失败: {bars_response.status_code}')



        # 3.2 获取日线bars（用于previousClose和非交易日回退）

        daily_bars_url = f'https://data.alpaca.markets/v2/stocks/{symbol}/bars'

        daily_params = {

            'timeframe': '1Day',

            'limit': 10  # 获取10根日线bar，用于非交易日回退检测

        }

        daily_bars_response = requests.get(daily_bars_url, headers=market_headers, params=daily_params, timeout=5)



        daily_bars = []

        if daily_bars_response.status_code == 200:

            daily_data = daily_bars_response.json()

            print(f'[Alpaca数据] 股票 {symbol} 日线bars响应: {daily_data}')

            daily_bars = daily_data.get('bars', [])

            if daily_bars is None:

                print(f'[Alpaca数据] 股票 {symbol} 日线bars为None，使用空列表')

                daily_bars = []

            if len(daily_bars) > 0:

                print(f'[Alpaca数据] 股票 {symbol} 获取到 {len(daily_bars)} 根日线bars数据')

            else:

                print(f'[Alpaca数据] 股票 {symbol} 日线bars数据为空')

        else:

            print(f'[Alpaca数据] 股票 {symbol} 日线bars数据获取失败: {daily_bars_response.status_code}')



        # 获取bid和ask价格

        bid_price = float(quote_data.get('bp')) if quote_data.get('bp') else None

        ask_price = float(quote_data.get('ap')) if quote_data.get('ap') else None



        # 构建返回数据 - 按照正确优先级

        # 1. price优先级：trade.p > (bid+ask)/2 > bid > ask

        trade_price = float(trade_data.get('p')) if trade_data.get('p') else None



        price = None

        price_source = None



        if trade_price is not None:

            price = trade_price

            price_source = 'trade'

        elif bid_price is not None and ask_price is not None:

            price = (bid_price + ask_price) / 2

            price_source = 'quote_mid'

        elif bid_price is not None:

            price = bid_price

            price_source = 'quote_bid'

        elif ask_price is not None:

            price = ask_price

            price_source = 'quote_ask'



        # 2. 交易所优先级：trade.x > quote.bx > quote.ax

        exchange = None

        if trade_data.get('x'):

            exchange = trade_data.get('x')

        elif quote_data.get('bx'):

            exchange = quote_data.get('bx')

        elif quote_data.get('ax'):

            exchange = quote_data.get('ax')



        # 3. 时间戳优先级：trade.t > quote.t

        timestamp = None

        if trade_data.get('t'):

            timestamp = trade_data.get('t')

        elif quote_data.get('t'):

            timestamp = quote_data.get('t')

        else:

            timestamp = int(time.time() * 1000)



        # 4. 确定有效的日线bar（处理非交易日回退）

        # 辅助函数：检查bar是否有有效数据

        def is_valid_bar(bar):

            if not bar:

                return False

            close_price = bar.get('c')

            volume = bar.get('v')

            # 检查close price和volume是否存在且为正数

            return close_price is not None and float(close_price) > 0 and volume is not None and int(volume) > 0

        

        # 从daily_bars中查找最新有效bar（从后往前遍历）

        effective_bar = None

        session_type = 'Live'

        if daily_bars and len(daily_bars) > 0:

            # 首先尝试最新的bar（可能是当天）

            latest_bar = daily_bars[-1]

            if is_valid_bar(latest_bar):

                effective_bar = latest_bar

                session_type = 'Live'

                print(f'[Alpaca数据] 股票 {symbol} 使用最新日线bar（交易日）')

            else:

                # 查找前一个有效交易日

                for bar in reversed(daily_bars):

                    if is_valid_bar(bar):

                        effective_bar = bar

                        session_type = 'Previous Trading Day'

                        print(f'[Alpaca数据] 股票 {symbol} 回退到前一个交易日bar')

                        break

        

        # 如果仍然没有有效bar，尝试使用bars_data（实时bar）

        if not effective_bar and is_valid_bar(bars_data):

            effective_bar = bars_data

            session_type = 'Live (实时bar)'

            print(f'[Alpaca数据] 股票 {symbol} 使用实时bar数据')

        

        # 设置OHLCV数据

        bar_open = None

        bar_high = None

        bar_low = None

        bar_close = None

        bar_volume = None

        

        if effective_bar:

            bar_open = float(effective_bar.get('o')) if effective_bar.get('o') else None

            bar_high = float(effective_bar.get('h')) if effective_bar.get('h') else None

            bar_low = float(effective_bar.get('l')) if effective_bar.get('l') else None

            bar_close = float(effective_bar.get('c')) if effective_bar.get('c') else None

            bar_volume = int(effective_bar.get('v')) if effective_bar.get('v') else None

        else:

            print(f'[Alpaca数据] 股票 {symbol} 没有有效日线bar数据')

            # 保留从bars_data获取的数据（可能为None或0）

            bar_open = float(bars_data.get('o')) if bars_data.get('o') else None

            bar_high = float(bars_data.get('h')) if bars_data.get('h') else None

            bar_low = float(bars_data.get('l')) if bars_data.get('l') else None

            bar_close = float(bars_data.get('c')) if bars_data.get('c') else None

            bar_volume = int(bars_data.get('v')) if bars_data.get('v') else None



        # 5. 正确区分 volume 和 lastSize

        volume = bar_volume  # 使用bar的成交量作为volume

        last_size = int(trade_data.get('s', 0)) if trade_data.get('s') else None



        # 6. 计算 change 和 changePercent（如果有price和previousClose）

        # 首先确定previous_close：如果effective_bar是前一个交易日，则需要找到更早的bar作为previous_close

        previous_close = None

        if daily_bars and effective_bar:

            # 找到effective_bar在daily_bars中的索引

            try:

                bar_index = None

                for i, bar in enumerate(daily_bars):

                    if bar.get('t') == effective_bar.get('t'):

                        bar_index = i

                        break

                # 如果找到了，且不是第一个bar，则前一个bar的收盘价作为previous_close

                if bar_index is not None and bar_index > 0:

                    prev_bar = daily_bars[bar_index - 1]

                    previous_close = float(prev_bar.get('c')) if prev_bar.get('c') else None

            except Exception as e:

                print(f'[Alpaca数据] 股票 {symbol} 查找previous_close失败: {e}')

        

        # 如果previous_close仍然为None，且session_type为'Previous Trading Day'，则无法计算涨跌幅

        # 此时将change和changePercent设为0

        change = None

        change_percent = None

        if price is not None and previous_close is not None and previous_close != 0:

            change = price - previous_close

            change_percent = (change / previous_close) * 100

        elif session_type == 'Previous Trading Day':

            # 回退数据，无法计算涨跌幅，设为0

            change = 0

            change_percent = 0



        result = {

            "symbol": symbol.upper(),

            "name": None,  # Alpaca不提供公司名称，留空

            "price": price,

            "priceSource": price_source,  # 价格来源标识

            "change": change,  # 计算得出的涨跌金额

            "changePercent": change_percent,  # 计算得出的涨跌百分比

            "volume": volume,  # 使用bar的成交量

            "dayHigh": bar_high,  # 使用bars数据

            "dayLow": bar_low,    # 使用bars数据

            "open": bar_open,     # 使用bars数据

            "previousClose": previous_close,  # 使用日线bar的收盘价作为previousClose

            "marketCap": None,  # Alpaca不提供市值，留空

            "currency": None,  # Alpaca不直接提供货币信息，留空

            "sector": None,  # Alpaca不提供行业信息，留空

            "industry": None,  # Alpaca不提供行业信息，留空

            "dataSource": "Alpaca",

            "sessionType": session_type,

            "isFallback": session_type == 'Previous Trading Day',

            "timestamp": timestamp,

            "bid": bid_price,

            "ask": ask_price,

            "bidSize": int(quote_data.get('bs', 0)) if quote_data.get('bs') else None,

            "askSize": int(quote_data.get('as', 0)) if quote_data.get('as') else None,

            "lastSize": last_size,  # 使用trade.s作为lastSize

            "exchange": exchange,

            "isTradable": None,  # Alpaca不直接提供可交易状态，留空

            "status": None  # Alpaca不直接提供状态，留空

        }



        # 缓存结果

        stock_cache.set(cache_key, (result, None))

        return result, None



    except Exception as e:

        print(f'[Alpaca数据] 股票 {symbol} 数据获取异常: {e}')

        import traceback

        traceback.print_exc()

        return None, str(e)



def fetch_alpaca_stock_data_snapshot(symbols):

    """

    使用Alpaca snapshots endpoint一次性获取多个股票数据

    返回: {symbol: data_dict, ...}, 错误信息字典

    """

    if not symbols:

        return {}, {}



    print(f'[Alpaca数据] 使用snapshots endpoint获取股票数据: {symbols}')



    # 获取Alpaca配置

    environment = alpaca_config_state.get('environment', 'paper')

    

    # 统一使用 alpaca_config_state 中的凭据（已从 config.py 导入）

    if environment == 'paper':

        api_key = alpaca_config_state.get('paper_api_key')

        api_secret = alpaca_config_state.get('paper_api_secret')

    else:

        api_key = alpaca_config_state.get('live_api_key')

        api_secret = alpaca_config_state.get('live_api_secret')



    # 检查API密钥

    if not api_key or not api_secret:

        print(f'[Alpaca数据] API密钥未配置')

        return {}, {symbol: 'Alpaca API密钥未配置' for symbol in symbols}



    market_headers = {

        'APCA-API-KEY-ID': api_key,

        'APCA-API-SECRET-KEY': api_secret

    }



    # 构建symbols参数（逗号分隔）

    symbols_param = ','.join([s.upper() for s in symbols])

    snapshots_url = f'https://data.alpaca.markets/v2/stocks/snapshots?symbols={symbols_param}'



    try:

        # 最小调试信息（安全掩码）

        key_preview = f"{api_key[:6]}...{api_key[-4:]}" if api_key else "None"

        secret_len = len(api_secret) if api_secret else 0

        print(f'[Alpaca数据] 请求URL: {snapshots_url}')

        print(f'[Alpaca数据] 使用环境: {environment}')

        print(f'[Alpaca数据] API Key (掩码): {key_preview}')

        print(f'[Alpaca数据] API Secret 长度: {secret_len} 字符')

        

        response = requests.get(snapshots_url, headers=market_headers, timeout=10)



        if response.status_code != 200:

            print(f'[Alpaca数据] snapshots endpoint获取失败: {response.status_code}')

            print(f'[Alpaca数据] 响应头: {dict(response.headers)}')

            print(f'[Alpaca数据] 响应体: {response.text[:500]}')

            return {}, {symbol: f'Alpaca snapshots API失败: {response.status_code}' for symbol in symbols}



        snapshots_data = response.json()

        print(f'[Alpaca数据] snapshots endpoint获取成功，包含 {len(snapshots_data)} 只股票')



        results = {}

        errors = {}



        for symbol in symbols:

            symbol_upper = symbol.upper()

            if symbol_upper not in snapshots_data:

                print(f'[Alpaca数据] 股票 {symbol} 不在snapshots响应中')

                errors[symbol] = f'股票 {symbol} 不在Alpaca snapshots响应中'

                continue



            snapshot = snapshots_data[symbol_upper]



            # 提取各个部分

            latest_trade = snapshot.get('latestTrade', {})

            latest_quote = snapshot.get('latestQuote', {})

            daily_bar = snapshot.get('dailyBar', {})

            prev_daily_bar = snapshot.get('prevDailyBar', {})



            # 辅助函数：检查bar是否有有效数据

            def is_valid_bar(bar):

                if not bar:

                    return False

                close_price = bar.get('c')

                volume = bar.get('v')

                # 检查close price和volume是否存在且为正数

                return close_price is not None and float(close_price) > 0 and volume is not None and int(volume) > 0

            

            # 决定使用哪个bar作为当天数据

            effective_bar = daily_bar if is_valid_bar(daily_bar) else prev_daily_bar if is_valid_bar(prev_daily_bar) else None

            session_type = 'Live' if effective_bar is daily_bar else 'Previous Trading Day' if effective_bar is prev_daily_bar else 'No Data'

            is_fallback = session_type == 'Previous Trading Day'

            

            # 1. price优先级：latestTrade.p > (bp+ap)/2 > bp > ap

            trade_price = float(latest_trade.get('p')) if latest_trade.get('p') else None

            bid_price = float(latest_quote.get('bp')) if latest_quote.get('bp') else None

            ask_price = float(latest_quote.get('ap')) if latest_quote.get('ap') else None



            price = None

            price_source = None



            if trade_price is not None:

                price = trade_price

                price_source = 'trade'

            elif bid_price is not None and ask_price is not None:

                price = (bid_price + ask_price) / 2

                price_source = 'quote_mid'

            elif bid_price is not None:

                price = bid_price

                price_source = 'quote_bid'

            elif ask_price is not None:

                price = ask_price

                price_source = 'quote_ask'

            

            # 如果价格仍然为None，但effective_bar存在，使用其收盘价作为价格

            if price is None and effective_bar:

                price = float(effective_bar.get('c'))

                price_source = 'daily_bar_close'



            # 2. 交易所优先级：latestTrade.x > latestQuote.bx > latestQuote.ax

            exchange_code = None

            if latest_trade.get('x'):

                exchange_code = latest_trade.get('x')

            elif latest_quote.get('bx'):

                exchange_code = latest_quote.get('bx')

            elif latest_quote.get('ax'):

                exchange_code = latest_quote.get('ax')



            # 交易所代码映射

            exchange_map = {

                'V': 'NASDAQ',

                'D': 'NYSE',

                'A': 'NYSE American',

                'P': 'NYSE Arca',

                'C': 'CBOE',

                'B': 'NASDAQ BX',

                'X': 'NASDAQ PSX',

                'I': 'ISE',

                'M': 'CHX',

                'W': 'CBOE',

                'Z': 'BATS',

                'Q': 'NASDAQ',

                'N': 'NYSE',

                'T': 'NASDAQ'

            }



            exchange = exchange_map.get(exchange_code, exchange_code)



            # 3. 时间戳优先级：latestTrade.t > latestQuote.t > dailyBar.t

            timestamp = None

            if latest_trade.get('t'):

                timestamp = latest_trade.get('t')

            elif latest_quote.get('t'):

                timestamp = latest_quote.get('t')

            elif effective_bar and effective_bar.get('t'):

                timestamp = effective_bar.get('t')



            # 4. OHLCV数据 - 使用effective_bar

            open_price = None

            day_high = None

            day_low = None

            volume = None

            

            if effective_bar:

                open_price = float(effective_bar.get('o')) if effective_bar.get('o') else None

                day_high = float(effective_bar.get('h')) if effective_bar.get('h') else None

                day_low = float(effective_bar.get('l')) if effective_bar.get('l') else None

                volume = int(effective_bar.get('v')) if effective_bar.get('v') else None



            # 5. previousClose - 如果使用回退数据，previous_close应为effective_bar的前一个交易日收盘价

            # 但prev_daily_bar已经是前一个交易日的数据，我们无法获取更早的数据

            # 这里简单设置为None，涨跌幅将不计算

            previous_close = None

            if is_fallback:

                # 对于回退数据，我们不知道前一个交易日的收盘价，所以设为None

                previous_close = None

            else:

                # 对于实时数据，使用prev_daily_bar的收盘价作为previous_close

                previous_close = float(prev_daily_bar.get('c')) if prev_daily_bar and prev_daily_bar.get('c') else None



            # 6. lastSize

            last_size = int(latest_trade.get('s', 0)) if latest_trade.get('s') else None



            # 7. 计算 change 和 changePercent

            change = None

            change_percent = None

            if price is not None and previous_close is not None and previous_close != 0:

                change = price - previous_close

                change_percent = (change / previous_close) * 100

            elif is_fallback:

                # 对于回退数据，由于没有previous_close，将change和changePercent设为0

                change = 0

                change_percent = 0



            # 构建结果

            result = {

                "symbol": symbol_upper,

                "name": None,  # Alpaca不提供公司名称，留空

                "price": price,

                "priceSource": price_source,

                "change": change,

                "changePercent": change_percent,

                "volume": volume,

                "dayHigh": day_high,

                "dayLow": day_low,

                "open": open_price,

                "previousClose": previous_close,

                "marketCap": None,  # Alpaca不提供市值，留空

                "currency": None,  # Alpaca不直接提供货币信息，留空

                "sector": None,  # Alpaca不提供行业信息，留空

                "industry": None,  # Alpaca不提供行业信息，留空

                "dataSource": "Alpaca",

                "sessionType": session_type,  # 新增字段：标识数据会话类型

                "isFallback": is_fallback,  # 新增字段：是否为回退数据

                "timestamp": timestamp,

                "bid": bid_price,

                "ask": ask_price,

                "bidSize": int(latest_quote.get('bs', 0)) if latest_quote.get('bs') else None,

                "askSize": int(latest_quote.get('as', 0)) if latest_quote.get('as') else None,

                "lastSize": last_size,

                "exchange": exchange,

                "isTradable": None,  # Alpaca不直接提供可交易状态，留空

                "status": None  # Alpaca不直接提供状态，留空

            }



            results[symbol] = result



        return results, errors



    except Exception as e:

        print(f'[Alpaca数据] snapshots endpoint异常: {e}')

        return {}, {symbol: f'Alpaca snapshots异常: {str(e)}' for symbol in symbols}



# ==================== 52周高低点函数 ====================

def get_52week_high_low(symbol):

    """获取52周高低点 - 使用Alpaca日线数据"""

    try:

        print(f'[52周高低点] 开始获取 {symbol} 的52周高低点')



        # 获取Alpaca配置

        environment = alpaca_config_state.get('environment', 'paper')

        if environment == 'paper':

            api_key = alpaca_config_state.get('paper_api_key')

            api_secret = alpaca_config_state.get('paper_api_secret')

        else:

            api_key = alpaca_config_state.get('live_api_key')

            api_secret = alpaca_config_state.get('live_api_secret')



        if not api_key or not api_secret:

            print(f'[52周高低点] API密钥未配置')

            return None, None



        headers = {

            'APCA-API-KEY-ID': api_key,

            'APCA-API-SECRET-KEY': api_secret

        }



        # 获取52周日线数据

        url = f'https://data.alpaca.markets/v2/stocks/{symbol}/bars'



        # 计算开始和结束时间

        import datetime

        end_date = datetime.datetime.now()

        start_date = end_date - datetime.timedelta(days=365)



        params = {

            'timeframe': '1Day',

            'start': start_date.strftime('%Y-%m-%d'),

            'end': end_date.strftime('%Y-%m-%d'),

            'limit': 365,  # 获取365个日线数据点

            'adjustment': 'raw',

            'feed': 'iex'

        }



        print(f'[52周高低点] 请求URL: {url}, 参数: {params}')

        response = requests.get(url, headers=headers, params=params, timeout=10)



        print(f'[52周高低点] 响应状态码: {response.status_code}')



        if response.status_code == 200:

            data = response.json()

            print(f'[52周高低点] 响应数据keys: {list(data.keys())}')



            bars = data.get('bars', [])

            print(f'[52周高低点] bars数量: {len(bars)}')



            if bars and len(bars) > 0:

                # 打印前几个bar的信息

                for i, bar in enumerate(bars[:3]):

                    print(f'[52周高低点] bar[{i}]: t={bar.get("t")}, h={bar.get("h")}, l={bar.get("l")}')



                # 计算52周高低点

                year_high = max(bar['h'] for bar in bars)

                year_low = min(bar['l'] for bar in bars)

                print(f'[52周高低点] {symbol}: High={year_high}, Low={year_low}, 数据点={len(bars)}')

                return year_high, year_low

            else:

                print(f'[52周高低点] {symbol}: bars数据为空')

                return None, None

        else:

            print(f'[52周高低点] {symbol}: API请求失败, 状态码={response.status_code}, 响应: {response.text[:200]}')

            return None, None



    except Exception as e:

        print(f'[52周高低点] 获取失败: {str(e)}')

        import traceback

        print(f'[52周高低点] 异常详情: {traceback.format_exc()}')

        return None, None



# ==================== Alpaca 历史数据函数 ====================

def get_alpaca_history(symbol, interval, range_param):

    """获取Alpaca历史数据 - 使用真实的Alpaca bars API"""

    try:

        print(f'[Alpaca历史数据] 开始获取 {symbol} 真实bars数据: interval={interval}, range={range_param}')



        # 映射interval到Alpaca支持的timeframe

        alpaca_timeframe_map = {

            '1min': '1Min',

            '5min': '5Min',

            '15min': '15Min',

            '30min': '30Min',

            '60': '1Hour',  # 前端传的60表示60分钟

            '1h': '1Hour',

            '1day': '1Day',

            'D': '1Day',    # 前端传的D表示日线

            '1week': '1Week',

            '1month': '1Month'

        }



        # 映射range到Alpaca支持的期限

        alpaca_range_map = {

            '1day': '1D',

            '1week': '1W',

            '1month': '1M',

            '3month': '3M',

            '1year': '1Y',

            '5year': '5Y'

        }



        # 获取映射后的参数

        alpaca_timeframe = alpaca_timeframe_map.get(interval, '1Day')

        alpaca_range = alpaca_range_map.get(range_param, '1M')



        print(f'[Alpaca历史数据] 映射参数: {interval}/{range_param} -> {alpaca_timeframe}/{alpaca_range}')



        # 调用Alpaca bars API

        print(f'[Alpaca历史数据] 调用fetch_alpaca_bars...')

        historical_data, success, data_source = fetch_alpaca_bars(

            symbol,

            alpaca_timeframe,

            alpaca_range

        )



        if success and historical_data:

            print(f'[Alpaca历史数据] 成功获取 {len(historical_data)} 条真实bars数据，数据源: {data_source}')

            return historical_data, True, f'Alpaca ({alpaca_timeframe} bars)'

        else:

            print(f'[Alpaca历史数据] 真实bars获取失败: {data_source}')

            print(f'[Alpaca历史数据] 根据要求不使用模拟数据，返回空数据')

            # 根据要求：不要再用模拟历史，返回空数据

            return [], False, f'Alpaca bars获取失败: {data_source}'



    except Exception as e:

        print(f'[Alpaca历史数据] 异常: {str(e)}')

        return [], False, f'Alpaca历史数据获取异常: {str(e)}'





def fetch_alpaca_bars(symbol, timeframe, range_param):

    """获取Alpaca真实bars数据 - 根据环境配置选择key"""

    try:

        import requests

        import time



        print(f'[Alpaca bars] 请求 {symbol} bars: timeframe={timeframe}, range={range_param}')



        # 根据环境配置选择API key

        environment = alpaca_config_state.get('environment', 'paper')



        if environment == 'paper':

            api_key = alpaca_config_state.get('paper_api_key')

            api_secret = alpaca_config_state.get('paper_api_secret')

        else:

            api_key = alpaca_config_state.get('live_api_key')

            api_secret = alpaca_config_state.get('live_api_secret')



        base_url = 'https://data.alpaca.markets/v2'



        # 检查API密钥

        if not api_key or not api_secret:

            print(f'[Alpaca bars] {environment} 环境API密钥未配置')

            return [], False, f'{environment} 环境API密钥未配置'



        headers = {

            'APCA-API-KEY-ID': api_key,

            'APCA-API-SECRET-KEY': api_secret

        }



        # 构建请求URL

        url = f'{ALPACA_BASE_URL}/stocks/{symbol}/bars'



        # 根据要求：优先尝试 feed=sip

        params = {

            'timeframe': timeframe,

            'limit': 1000,  # 最大限制

            'adjustment': 'raw',

            'feed': 'sip',  # 优先使用sip feed

            'sort': 'asc'   # 按时间升序排序

        }



        print(f'[Alpaca bars] 使用feed=sip，优先获取15分钟延迟数据')



        # 根据range_param设置开始时间

        import datetime

        import pytz



        # 获取时区

        eastern = pytz.timezone('America/New_York')

        utc = pytz.UTC



        # 当前美东时间

        now_eastern = datetime.datetime.now(eastern)



        # 初始化变量（用于1D范围的数据过滤）

        today_start_utc = None

        end_utc = None



        if range_param == '1D':

            # 1D: 交易日判断和回退逻辑

            # 检查今天是否为交易日（周一至周五）

            weekday = now_eastern.weekday()  # Monday=0, Sunday=6

            target_date_eastern = now_eastern

            

            # 判断是否为交易日（简单版：周一至周五为交易日，忽略节假日）

            is_trading_day = weekday < 5  # Monday=0 to Friday=4

            

            if not is_trading_day:

                # 非交易日：回退到上一个交易日

                print(f'[Alpaca bars] 今天({target_date_eastern.strftime("%Y-%m-%d")})不是交易日（星期{weekday+1}），自动回退到上一个交易日')

                

                # 计算上一个交易日

                if weekday == 5:  # 周六

                    days_back = 1  # 回退到周五

                elif weekday == 6:  # 周日

                    days_back = 2  # 回退到周五

                else:  # 周一到周五，但今天不是交易日（可能是节假日）

                    days_back = 1  # 默认回退到昨天

                    

                target_date_eastern = now_eastern - datetime.timedelta(days=days_back)

                # 确保回退后是周一至周五

                while target_date_eastern.weekday() > 4:  # 周六或周日

                    target_date_eastern = target_date_eastern - datetime.timedelta(days=1)

                

                print(f'[Alpaca bars] 回退到交易日: {target_date_eastern.strftime("%Y-%m-%d")} (星期{target_date_eastern.weekday()+1})')

            

            # 交易日时间范围：交易日的00:00 AM 美东时间 到 23:59:59

            # 对于历史交易日，使用完整交易日时间（9:30-16:00），但Alpaca可能需要全天范围

            trade_day_start_eastern = target_date_eastern.replace(hour=0, minute=0, second=0, microsecond=0)

            

            # 如果是今天并且是交易日，使用当前时间往前15分钟作为结束时间

            # 如果是历史交易日，使用23:59:59作为结束时间

            if target_date_eastern.date() == now_eastern.date() and is_trading_day:

                # 当前交易日：使用当前时间往前15分钟

                end_eastern = now_eastern - datetime.timedelta(minutes=15)

                # 确保结束时间不早于开始时间

                if end_eastern < trade_day_start_eastern:

                    print(f'[Alpaca bars] 警告: 结束时间{end_eastern.strftime("%H:%M:%S")}早于开始时间{trade_day_start_eastern.strftime("%H:%M:%S")}')

                    print(f'[Alpaca bars] 使用开始时间+5分钟作为结束时间')

                    end_eastern = trade_day_start_eastern + datetime.timedelta(minutes=5)

            else:

                # 历史交易日：使用23:59:59

                end_eastern = target_date_eastern.replace(hour=23, minute=59, second=59, microsecond=0)



            # 转换为UTC

            today_start_utc = trade_day_start_eastern.astimezone(utc)

            end_utc = end_eastern.astimezone(utc)



            start_time = int(today_start_utc.timestamp())

            end_time = int(end_utc.timestamp())



            print(f'[Alpaca bars] 1D时间范围:')

            print(f'  - 交易日: {target_date_eastern.strftime("%Y-%m-%d")} ({"今天" if target_date_eastern.date() == now_eastern.date() else "历史交易日"})')

            print(f'  - 开始: {trade_day_start_eastern.strftime("%Y-%m-%d %H:%M:%S")} EDT')

            print(f'  - 结束: {end_eastern.strftime("%Y-%m-%d %H:%M:%S")} EDT')

            print(f'  - UTC: {today_start_utc.strftime("%Y-%m-%d %H:%M:%S")} 到 {end_utc.strftime("%Y-%m-%d %H:%M:%S")}')



        elif range_param == '1W':

            # 1W: 方案1 - 从一周前今天12:00 PM EDT开始，1小时粒度

            # 如果数据不完整，使用方案2 - 从一周前今天04:00 AM EDT开始，30分钟粒度



            # 获取当前美东时间

            now_eastern = datetime.datetime.now(eastern)

            today_eastern = now_eastern.replace(hour=0, minute=0, second=0, microsecond=0)



            # 方案1: 一周前今天12:00 PM EDT

            one_week_ago = today_eastern - datetime.timedelta(days=7)

            start_time_edt_1 = one_week_ago.replace(hour=12, minute=0, second=0, microsecond=0)  # 12:00 PM



            # 方案2: 一周前今天04:00 AM EDT (备用)

            start_time_edt_2 = one_week_ago.replace(hour=4, minute=0, second=0, microsecond=0)  # 04:00 AM



            # 结束时间: 当前时间往前15分钟（确保有数据）

            end_time_edt = now_eastern - datetime.timedelta(minutes=15)



            # 转换为UTC时间

            start_time_utc_1 = start_time_edt_1.astimezone(pytz.UTC)

            start_time_utc_2 = start_time_edt_2.astimezone(pytz.UTC)

            end_time_utc = end_time_edt.astimezone(pytz.UTC)



            # 转换为Unix时间戳

            start_time_1 = int(start_time_utc_1.timestamp())

            start_time_2 = int(start_time_utc_2.timestamp())

            end_time = int(end_time_utc.timestamp())



            # 默认使用方案1

            start_time = start_time_1

            interval = '1Hour'  # 1小时粒度



            print(f'[Alpaca bars] 1W时间范围:')

            print(f'  - 方案1开始: {start_time_edt_1.strftime("%Y-%m-%d %H:%M:%S")} EDT (12:00 PM)')

            print(f'  - 方案2开始: {start_time_edt_2.strftime("%Y-%m-%d %H:%M:%S")} EDT (04:00 AM)')

            print(f'  - 结束: {end_time_edt.strftime("%Y-%m-%d %H:%M:%S")} EDT')

            print(f'  - UTC: {start_time_utc_1.strftime("%Y-%m-%d %H:%M:%S")} 到 {end_time_utc.strftime("%Y-%m-%d %H:%M:%S")}')

            print(f'  - 使用间隔: {interval}')

        elif range_param == '1M':

            # 1M: 当前时间往前30天（自然月）

            # 时间范围按自然月计算，数据点按交易日

            end_time = int(time.time())

            start_time = end_time - 30 * 24 * 60 * 60  # 30个日历天



            print(f'[Alpaca bars] 1M时间范围:')

            print(f'  - 使用自然月: 30个日历天')

            print(f'  - 开始时间戳: {start_time} -> {time.strftime("%Y-%m-%d %H:%M:%S", time.gmtime(start_time))} UTC')

            print(f'  - 结束时间戳: {end_time} -> {time.strftime("%Y-%m-%d %H:%M:%S", time.gmtime(end_time))} UTC')

            print(f'  - 预期开始日期: {datetime.datetime.fromtimestamp(start_time, tz=pytz.UTC).astimezone(eastern).strftime("%Y-%m-%d")} EDT')

            print(f'  - 预期结束日期: {datetime.datetime.fromtimestamp(end_time, tz=pytz.UTC).astimezone(eastern).strftime("%Y-%m-%d")} EDT')

        elif range_param == '3M':

            # 3M: 当前时间往前90天

            end_time = int(time.time())

            start_time = end_time - 90 * 24 * 60 * 60

        elif range_param == '1Y':

            # 1Y: 当前时间往前365天

            end_time = int(time.time())

            start_time = end_time - 365 * 24 * 60 * 60

        else:

            # 默认使用当前时间

            end_time = int(time.time())

            start_time = end_time



        params['start'] = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(start_time))

        params['end'] = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(end_time))



        print(f'[Alpaca bars] 请求URL: {url}')

        print(f'[Alpaca bars] 请求参数:')

        for key, value in params.items():

            print(f'  {key}: {value}')

        

        # 调试：打印当前时间和环境

        print(f'[Alpaca bars] 当前美东时间: {now_eastern.strftime("%Y-%m-%d %H:%M:%S")} EDT')

        print(f'[Alpaca bars] 当前UTC时间: {datetime.datetime.now(pytz.UTC).strftime("%Y-%m-%d %H:%M:%S")} UTC')

        print(f'[Alpaca bars] 环境: {environment}, API Key前5位: {api_key[:5]}...')



        response = requests.get(url, headers=headers, params=params, timeout=10)



        # 如果sip失败，尝试iex

        if response.status_code != 200:

            print(f'[Alpaca bars] feed=sip请求失败: {response.status_code}')

            print(f'[Alpaca bars] 完整错误响应: {response.text}')

            print(f'[Alpaca bars] 尝试使用feed=iex')

            params['feed'] = 'iex'

            response = requests.get(url, headers=headers, params=params, timeout=10)



        print(f'[Alpaca bars] 响应状态码: {response.status_code}')



        if response.status_code == 200:

            data = response.json()

            if 'bars' in data and data['bars']:

                bars = data['bars']

                print(f'[Alpaca bars] 成功获取 {len(bars)} 条bars数据')



                # 打印原始bars的前3条和后3条

                if bars and len(bars) > 0:

                    print(f'[Alpaca bars] 原始bars前3条:')

                    for i, bar in enumerate(bars[:3]):

                        print(f'  bar[{i}]: t={bar.get("t")}, o={bar.get("o")}, h={bar.get("h")}, l={bar.get("l")}, c={bar.get("c")}')



                    print(f'[Alpaca bars] 原始bars后3条:')

                    for i, bar in enumerate(bars[-3:]):

                        idx = len(bars) - 3 + i

                        print(f'  bar[{idx}]: t={bar.get("t")}, o={bar.get("o")}, h={bar.get("h")}, l={bar.get("l")}, c={bar.get("c")}')



                # 转换数据格式

                historical_data = []

                for bar in bars:

                    # 正确解析UTC时间字符串

                    import datetime

                    utc_time = datetime.datetime.strptime(bar['t'], '%Y-%m-%dT%H:%M:%SZ')

                    # 设置时区为UTC

                    utc_time = utc_time.replace(tzinfo=datetime.timezone.utc)

                    timestamp = int(utc_time.timestamp())



                    historical_data.append({

                        'time': bar['t'],  # ISO时间字符串

                        'timestamp': timestamp,  # 正确的Unix时间戳

                        'open': bar['o'],

                        'high': bar['h'],

                        'low': bar['l'],

                        'close': bar['c'],

                        'volume': bar['v']

                    })



                # 按时间从旧到新排序

                historical_data.sort(key=lambda x: x['timestamp'])



                # 过滤：如果是1D范围，只保留交易日时间范围内的数据

                filtered_data = []

                if range_param == '1D' and today_start_utc:

                    print(f'[Alpaca bars] 过滤1D数据: 只保留交易日时间范围内的数据')

                    print(f'[Alpaca bars] 过滤时间范围: {today_start_utc} 到 {end_utc}')



                    for item in historical_data:

                        item_time = datetime.datetime.fromtimestamp(item['timestamp'], tz=utc)

                        # 只保留交易日时间范围内的数据

                        if today_start_utc <= item_time <= end_utc:

                            filtered_data.append(item)

                        else:

                            print(f'[Alpaca bars] 过滤掉非交易日数据点: {item_time} (值: {item_time.astimezone(eastern).strftime("%Y-%m-%d %H:%M:%S")} EDT)')



                    print(f'[Alpaca bars] 过滤结果: 原始{len(historical_data)}条 -> 过滤后{len(filtered_data)}条')



                    # 如果过滤后为空，记录警告

                    if len(filtered_data) == 0:

                        print(f'[Alpaca bars] 警告: 过滤后无交易日数据，返回空数组')

                else:

                    filtered_data = historical_data



                # 检查数据时间范围

                if filtered_data:

                    first_timestamp = filtered_data[0]['timestamp']

                    last_timestamp = filtered_data[-1]['timestamp']

                    first_time = datetime.datetime.fromtimestamp(first_timestamp, tz=utc)

                    last_time = datetime.datetime.fromtimestamp(last_timestamp, tz=utc)



                    print(f'[Alpaca bars] 过滤后数据时间范围:')

                    print(f'  - 第一个点: {first_time.astimezone(eastern).strftime("%H:%M:%S")} EDT')

                    print(f'  - 最后一个点: {last_time.astimezone(eastern).strftime("%H:%M:%S")} EDT')

                    print(f'  - 数据点数: {len(filtered_data)}')



                return filtered_data, True, 'Alpaca bars API (15分钟延迟)'

            else:

                print(f'[Alpaca bars] 无bars数据返回: {data}')

                return [], False, 'Alpaca返回空数据'

        else:

            print(f'[Alpaca bars] API请求失败: {response.status_code}, {response.text}')

            return [], False, f'Alpaca API错误: {response.status_code}'



    except Exception as e:

        print(f'[Alpaca bars] 异常: {str(e)}')

        return [], False, f'Alpaca bars异常: {str(e)}'





def get_alpaca_simulated_history(symbol, interval, range_param):

    """获取Alpaca模拟历史数据（备选方案）"""

    try:

        print(f'[Alpaca模拟历史] 开始获取 {symbol} 模拟数据: interval={interval}, range={range_param}')



        # 直接调用现有的Alpaca实时数据接口

        print(f'[Alpaca模拟历史] 调用 /api/market/stocks 接口获取实时数据')



        # 使用fetch_alpaca_stock_data_snapshot函数

        snapshots_results, snapshots_errors = fetch_alpaca_stock_data_snapshot([symbol])



        if symbol in snapshots_results:

            alpaca_data = snapshots_results[symbol]

            print(f'[Alpaca模拟历史] 成功获取实时数据，价格: {alpaca_data.get("price")}')



            # 使用实时数据生成模拟历史数据

            historical_data = generate_alpaca_based_history(

                symbol,

                interval,

                range_param,

                alpaca_data

            )



            if historical_data:

                print(f'[Alpaca模拟历史] 生成 {len(historical_data)} 条模拟历史数据')

                return historical_data, True, 'Alpaca (基于实时数据模拟)'

            else:

                print(f'[Alpaca模拟历史] 模拟数据生成失败')

                return [], False, 'Alpaca模拟数据生成失败'

        else:

            error_msg = snapshots_errors.get(symbol, '未知错误')

            print(f'[Alpaca模拟历史] 无法获取实时数据: {error_msg}')

            return [], False, f'Alpaca实时数据获取失败: {error_msg}'



    except Exception as e:

        print(f'[Alpaca模拟历史] 异常: {str(e)}')

        return [], False, f'Alpaca模拟历史异常: {str(e)}'





def generate_alpaca_based_history(symbol, interval, range_param, realtime_data):

    """基于Alpaca实时数据生成模拟历史数据 - 改进版，按时间线方案"""

    try:

        import datetime

        import random

        import time



        print(f'[模拟历史] 生成 {symbol} 模拟数据: interval={interval} (type: {type(interval)}), range={range_param} (type: {type(range_param)})')

        print(f'[模拟历史] 实时数据: price={realtime_data.get("price")}, volume={realtime_data.get("volume")}')



        # 获取当前价格作为基准

        current_price = realtime_data.get('price', 100.0)

        current_volume = realtime_data.get('volume', 1000000)



        # 根据interval和range_param生成数据点数量

        # 注意：前端可能传递不同的interval格式

        data_points_map = {

            '1min': {'1day': 390},     # 1分钟间隔，1天

            '5min': {'1day': 78},      # 5分钟间隔，1天

            '30min': {'1week': 65},    # 30分钟间隔，1周

            '60': {'1week': 40},       # 60分钟间隔，1周 (旧格式)

            '1day': {'1month': 22, '3month': 66, '1year': 252},  # 日间隔

            'D': {'2month': 40, '3month': 60, '1year': 252},     # 日间隔 (旧格式)

        }



        # 获取数据点数量

        num_points = 22  # 默认



        print(f'[模拟历史] 检查映射: interval={interval}, range_param={range_param}')

        print(f'[模拟历史] data_points_map keys: {list(data_points_map.keys())}')



        # 首先尝试精确匹配

        if interval in data_points_map:

            print(f'[模拟历史] interval {interval} 在映射中')

            if range_param in data_points_map[interval]:

                num_points = data_points_map[interval][range_param]

                print(f'[模拟历史] 精确匹配: interval={interval}, range={range_param} -> {num_points} points')

            else:

                print(f'[模拟历史] range_param {range_param} 不在 interval {interval} 的映射中')

        else:

            print(f'[模拟历史] interval {interval} 不在映射中')



        # 根据range_param估算

        if num_points == 22:  # 如果还是默认值

            print(f'[模拟历史] 使用估算逻辑')

            if range_param == '1day':

                if interval in ['1min', '5min']:

                    num_points = 390 if interval == '1min' else 78

                else:

                    num_points = 22

            elif range_param == '1week':

                if interval in ['30min', '60']:

                    num_points = 65 if interval == '30min' else 40

                else:

                    num_points = 22

            elif range_param == '1month' or range_param == '2month':

                num_points = 22 if range_param == '1month' else 40

            elif range_param == '3month':

                num_points = 66

            elif range_param == '1year':

                num_points = 252



        print(f'[模拟历史] 最终生成 {num_points} 个数据点')



        historical_data = []

        now = datetime.datetime.now()



        # 根据interval设置时间步长

        if interval == '5min':

            time_step = datetime.timedelta(minutes=5)

            time_format = '%Y-%m-%d %H:%M'

        elif interval == '30min':

            time_step = datetime.timedelta(minutes=30)

            time_format = '%Y-%m-%d %H:%M'

        elif interval == '1day':

            time_step = datetime.timedelta(days=1)

            time_format = '%Y-%m-%d'

        else:

            time_step = datetime.timedelta(days=1)

            time_format = '%Y-%m-%d'



        # 生成交易日数据（只生成工作日，跳过周末）

        base_price = current_price * 0.9  # 从当前价格的90%开始

        price_trend = 0.001  # 轻微上涨趋势



        # 计算开始时间（确保是交易日）

        start_date = now - datetime.timedelta(days=num_points * 1.4)  # 多留一些天数，因为要跳过周末



        # 生成交易日数据

        generated_points = 0

        current_date = start_date



        while generated_points < num_points and current_date <= now:

            # 检查是否为交易日（周一到周五）

            weekday = current_date.weekday()  # 0=周一, 1=周二, ..., 4=周五, 5=周六, 6=周日



            if weekday < 5:  # 周一到周五

                # 生成价格（带随机波动和趋势）

                price_change = random.uniform(-0.02, 0.02) + price_trend

                current_price_point = base_price * (1 + price_change)

                base_price = current_price_point



                # 生成OHLC数据

                open_price = current_price_point * (1 + random.uniform(-0.01, 0.01))

                close_price = current_price_point * (1 + random.uniform(-0.01, 0.01))

                high_price = max(open_price, close_price) * (1 + random.uniform(0, 0.015))

                low_price = min(open_price, close_price) * (1 - random.uniform(0, 0.015))



                # 生成成交量

                volume = int(current_volume * random.uniform(0.7, 1.3))



                # 创建数据点

                data_point = {

                    'time': current_date.strftime(time_format),

                    'timestamp': int(time.mktime(current_date.timetuple())),

                    'open': round(open_price, 2),

                    'high': round(high_price, 2),

                    'low': round(low_price, 2),

                    'close': round(close_price, 2),

                    'volume': volume

                }



                historical_data.append(data_point)

                generated_points += 1



            # 移动到下一天

            current_date += datetime.timedelta(days=1)



        # 确保数据按时间从旧到新排序

        historical_data.sort(key=lambda x: x['timestamp'])



        # 如果生成的数据点不够，补充一些

        if len(historical_data) < num_points:

            print(f'[模拟历史] 警告: 只生成了 {len(historical_data)} 个交易日数据，需要 {num_points} 个')

            # 补充缺失的数据点

            while len(historical_data) < num_points:

                last_point = historical_data[-1] if historical_data else {'timestamp': int(time.mktime(now.timetuple())), 'close': current_price}

                next_date = datetime.datetime.fromtimestamp(last_point['timestamp']) + datetime.timedelta(days=1)



                # 确保是交易日

                while next_date.weekday() >= 5:

                    next_date += datetime.timedelta(days=1)



                price_change = random.uniform(-0.02, 0.02) + price_trend

                current_price_point = base_price * (1 + price_change)

                base_price = current_price_point



                open_price = current_price_point * (1 + random.uniform(-0.01, 0.01))

                close_price = current_price_point * (1 + random.uniform(-0.01, 0.01))

                high_price = max(open_price, close_price) * (1 + random.uniform(0, 0.015))

                low_price = min(open_price, close_price) * (1 - random.uniform(0, 0.015))

                volume = int(current_volume * random.uniform(0.7, 1.3))



                data_point = {

                    'time': next_date.strftime(time_format),

                    'timestamp': int(time.mktime(next_date.timetuple())),

                    'open': round(open_price, 2),

                    'high': round(high_price, 2),

                    'low': round(low_price, 2),

                    'close': round(close_price, 2),

                    'volume': volume

                }



                historical_data.append(data_point)



        # 确保最后一个数据点接近当前实时价格

        if historical_data:

            last_point = historical_data[-1]

            last_point['close'] = round(current_price, 2)

            last_point['time'] = now.strftime(time_format)

            last_point['timestamp'] = int(time.mktime(now.timetuple()))



        print(f'[模拟历史] 生成完成，最后价格: {historical_data[-1]["close"] if historical_data else "N/A"}')



        # 添加调试信息到返回数据

        if historical_data:

            historical_data[0]['_debug'] = {

                'interval_received': interval,

                'range_received': range_param,

                'points_generated': len(historical_data),

                'expected_points': num_points

            }



        return historical_data



    except Exception as e:

        print(f'[模拟历史] 生成异常: {str(e)}')

        return []



        # 获取当前价格作为基准

        base_price = realtime_data.get('price')

        if not base_price:

            base_price = 100.0  # 默认基准价格



        # 获取其他实时数据

        day_high = realtime_data.get('dayHigh', base_price * 1.05)

        day_low = realtime_data.get('dayLow', base_price * 0.95)

        volume = realtime_data.get('volume', 1000000)



        # 根据时间范围确定数据点数量

        points_map = {

            '1day': 24 if interval in ['1h', '2h', '4h'] else 96,  # 1天: 24小时或96个15分钟点

            '1week': 35,  # 5个交易日

            '1month': 22,  # 约22个交易日

            '3month': 66,  # 约66个交易日

            '1year': 252,  # 约252个交易日

            '5year': 1260  # 约1260个交易日

        }



        num_points = points_map.get(range_param, 22)



        # 生成时间序列

        historical_data = []

        now = datetime.datetime.now(datetime.timezone.utc)



        # 根据间隔确定时间步长

        if interval == '1day':

            time_delta = datetime.timedelta(days=1)

        elif interval == '1week':

            time_delta = datetime.timedelta(weeks=1)

        elif interval == '1month':

            time_delta = datetime.timedelta(days=30)

        else:

            time_delta = datetime.timedelta(days=1)  # 默认日线



        # 生成模拟数据

        current_price = base_price

        for i in range(num_points):

            # 计算时间戳

            timestamp = now - (num_points - i - 1) * time_delta



            # 生成价格波动（基于正态分布）

            price_change = random.uniform(-0.02, 0.02)  # ±2% 波动

            new_price = current_price * (1 + price_change)



            # 确保价格在日内高低点范围内

            new_price = max(day_low * 0.9, min(day_high * 1.1, new_price))



            # 生成OHLC数据

            open_price = current_price

            close_price = new_price

            high_price = max(open_price, close_price) * (1 + random.uniform(0, 0.01))

            low_price = min(open_price, close_price) * (1 - random.uniform(0, 0.01))



            # 生成成交量（基于基础成交量随机波动）

            day_volume = int(volume * random.uniform(0.7, 1.3))



            historical_data.append({

                'time': timestamp.strftime('%Y-%m-%d %H:%M:%S'),

                'timestamp': int(timestamp.timestamp()),

                'open': round(open_price, 2),

                'high': round(high_price, 2),

                'low': round(low_price, 2),

                'close': round(close_price, 2),

                'volume': day_volume

            })



            current_price = close_price



        # 按时间排序（从旧到新）

        historical_data.sort(key=lambda x: x['timestamp'])



        # 添加实时数据作为最后一点

        if historical_data:

            last_point = historical_data[-1]

            # 更新最后一点为实时数据

            last_point['close'] = round(base_price, 2)

            last_point['high'] = round(max(last_point['high'], base_price), 2)

            last_point['low'] = round(min(last_point['low'], base_price), 2)

            last_point['volume'] = volume



        print(f'[Alpaca模拟历史] 为 {symbol} 生成 {len(historical_data)} 条数据，最后价格: {base_price}')

        return historical_data



    except Exception as e:

        print(f'[Alpaca模拟历史] 生成异常: {str(e)}')

        return []





# ==================== Finnhub API 函数 ====================

def fetch_finnhub_quote(symbol):

    """获取Finnhub报价数据（带缓存）"""

    cache_key = get_cache_key(symbol, 'quote')



    # 检查缓存

    cached = stock_cache.get(cache_key)

    if cached is not None:

        return cached, None



    try:

        url = "https://finnhub.io/api/v1/quote"

        params = {

            'symbol': symbol.upper(),

            'token': FINNHUB_API_KEY

        }



        response = requests.get(url, params=params, timeout=5)  # 减少超时时间



        if response.status_code != 200:

            # API密钥无效，返回空数据

            print(f"[Finnhub报价] API密钥无效，返回空数据")

            return None, f"API密钥无效，状态码: {response.status_code}"



        data = response.json()



        if 'error' in data:

            # API返回错误，返回空数据

            print(f"[Finnhub报价] API返回错误: {data.get('error')}")

            return None, f"API错误: {data.get('error')}"



        if data.get('c', 0) == 0:

            # 价格数据为0，返回模拟数据

            print(f"[Finnhub报价] 价格数据为0，返回模拟数据")

            return generate_mock_quote_data(symbol), None



        # 缓存结果

        stock_cache.set(cache_key, data)

        return data, None



    except Exception as e:

        # 发生异常，返回模拟数据

        print(f"[Finnhub报价] 异常: {str(e)}，返回模拟数据")

        return generate_mock_quote_data(symbol), None



def generate_mock_quote_data(symbol):

    """生成稳定的模拟报价数据（不使用随机数）"""

    # 基础价格映射

    base_prices = {

        'AAPL': 253.5,

        'MSFT': 420.7,

        'GOOGL': 152.3,

        'TSLA': 175.2,

        'NVDA': 950.8,

        'AMZN': 178.9,

        'META': 485.6,

        'JPM': 195.4,

        'JNJ': 152.8,

        'V': 275.3

    }



    base_price = base_prices.get(symbol.upper(), 100.0)



    # 使用基于symbol的确定性变化（不使用随机数）

    # 使用symbol的哈希值来生成确定性变化

    symbol_hash = hash(symbol.upper()) % 1000 / 1000.0  # 0到1之间的确定性值



    # 生成确定性变化（基于symbol哈希）

    change = (symbol_hash - 0.5) * 2  # -1到+1之间的确定性变化

    change_percent = (change / base_price) * 100



    # 日内高点和低点（基于基础价格和变化）

    day_high = base_price + abs(change) + 1.5

    day_low = base_price - abs(change) - 1.5



    # 开盘价（基于基础价格和symbol哈希）

    open_price = base_price + (symbol_hash - 0.5) * 1



    return {

        'c': round(base_price + change, 2),  # current price

        'd': round(change, 2),  # change

        'dp': round(change_percent, 2),  # change percent

        'h': round(day_high, 2),  # high

        'l': round(day_low, 2),  # low

        'o': round(open_price, 2),  # open

        'pc': round(base_price - change, 2)  # previous close

    }



def fetch_finnhub_profile(symbol):

    """获取Finnhub profile数据（带缓存）"""

    cache_key = get_cache_key(symbol, 'profile')



    # 检查缓存

    cached = stock_cache.get(cache_key)

    if cached is not None:

        return cached, None



    try:

        url = "https://finnhub.io/api/v1/stock/profile2"

        params = {

            'symbol': symbol.upper(),

            'token': FINNHUB_API_KEY

        }



        response = requests.get(url, params=params, timeout=5)



        if response.status_code != 200:

            # API密钥无效，返回空数据

            print(f"[Finnhub Profile] API密钥无效，返回空数据")

            return None, f"API密钥无效，状态码: {response.status_code}"



        data = response.json()



        if 'error' in data:

            # API返回错误，返回空数据

            print(f"[Finnhub Profile] API返回错误: {data.get('error')}")

            return None, f"API错误: {data.get('error')}"



        if not data or len(data) == 0:

            # 空响应，返回空数据

            print(f"[Finnhub Profile] 空响应，返回空数据")

            return None, "Empty response from Finnhub API"



        if 'marketCapitalization' not in data:

            # 没有必要字段，返回空数据

            print(f"[Finnhub Profile] 没有marketCapitalization字段，返回空数据")

            return None, "Missing required field: marketCapitalization"



        # 缓存结果

        stock_cache.set(cache_key, data)

        return data, None



    except Exception as e:

        # 发生异常，返回空数据

        print(f"[Finnhub Profile] 异常: {str(e)}，返回空数据")

        return None, f"Exception: {str(e)}"





def fetch_finnhub_company_news(symbol, days_back=7):

    """获取Finnhub公司新闻数据"""

    cache_key = get_cache_key(symbol, f'news_{days_back}')



    # 检查缓存

    cached = stock_cache.get(cache_key)

    if cached is not None:

        return cached, None



    try:

        # 计算日期范围

        from datetime import datetime, timedelta

        end_date = datetime.now()

        start_date = end_date - timedelta(days=days_back)

        

        url = "https://finnhub.io/api/v1/company-news"

        params = {

            'symbol': symbol.upper(),

            'from': start_date.strftime('%Y-%m-%d'),

            'to': end_date.strftime('%Y-%m-%d'),

            'token': FINNHUB_API_KEY

        }



        response = requests.get(url, params=params, timeout=10)



        if response.status_code != 200:

            print(f"[Finnhub News] API密钥无效，返回空数据，状态码: {response.status_code}")

            return [], f"API密钥无效，状态码: {response.status_code}"



        data = response.json()



        if not isinstance(data, list):

            print(f"[Finnhub News] 响应不是列表，返回空数据")

            return [], "响应格式错误"



        if len(data) == 0:

            print(f"[Finnhub News] 空响应，返回空列表")

            return [], None



        # 过滤掉没有标题或内容的新闻

        valid_news = []

        for news_item in data:

            if news_item.get('headline') and news_item.get('summary'):

                # 清理新闻数据

                cleaned_item = {

                    'headline': news_item.get('headline', ''),

                    'summary': news_item.get('summary', ''),

                    'source': news_item.get('source', 'Unknown'),

                    'datetime': news_item.get('datetime', 0),

                    'url': news_item.get('url', ''),

                    'related': news_item.get('related', symbol.upper()),

                    'sentiment_score': news_item.get('sentiment', 0)  # Finnhub提供情感分数 -1到1

                }

                valid_news.append(cleaned_item)



        print(f"[Finnhub News] 获取到 {symbol} 的 {len(valid_news)} 条有效新闻")

        

        # 缓存结果（5分钟缓存）

        stock_cache.set(cache_key, valid_news, ttl=300)

        return valid_news, None



    except Exception as e:

        print(f"[Finnhub News] 异常: {str(e)}，返回空列表")

        return [], f"异常: {str(e)}"



def generate_mock_profile_data(symbol):

    """生成模拟profile数据"""

    # 公司名称映射

    company_names = {

        'AAPL': 'Apple Inc.',

        'MSFT': 'Microsoft Corporation',

        'GOOGL': 'Alphabet Inc.',

        'TSLA': 'Tesla Inc.',

        'NVDA': 'NVIDIA Corporation',

        'AMZN': 'Amazon.com Inc.',

        'META': 'Meta Platforms Inc.',

        'JPM': 'JPMorgan Chase & Co.',

        'JNJ': 'Johnson & Johnson',

        'V': 'Visa Inc.'

    }



    # 市值映射（单位：美元）

    market_caps = {

        'AAPL': 2800000000000,      # 2.8万亿美元

        'MSFT': 3120000000000,      # 3.12万亿美元

        'GOOGL': 1900000000000,     # 1.9万亿美元

        'TSLA': 550000000000,       # 5500亿美元

        'NVDA': 2350000000000,      # 2.35万亿美元

        'AMZN': 1850000000000,      # 1.85万亿美元

        'META': 1250000000000,      # 1.25万亿美元

        'JPM': 570000000000,        # 5700亿美元

        'JNJ': 380000000000,        # 3800亿美元

        'V': 550000000000           # 5500亿美元

    }



    name = company_names.get(symbol.upper(), f"{symbol.upper()} Inc.")

    market_cap = market_caps.get(symbol.upper(), 100000000000)  # 1000亿美元默认值



    return {

        'name': name,

        'marketCapitalization': market_cap,

        'currency': 'USD',

        'exchange': 'NASDAQ',

        'finnhubIndustry': 'Technology',

        'finnhubSector': 'Technology'

    }



def get_finnhub_supplemental_data(symbol):

    """获取Finnhub补充数据（用于补充Twelve Data缺失的字段）"""

    try:

        # 尝试获取Finnhub quote数据

        quote_data, quote_error = fetch_finnhub_quote(symbol)



        # 尝试获取Finnhub profile数据

        profile_data, profile_error = fetch_finnhub_profile(symbol)



        supplemental_data = {}



        # 从quote数据中提取补充字段

        if quote_data and not quote_error:

            # 计算平均成交量（如果可用）

            if quote_data.get('v', 0) > 0:

                supplemental_data['avg_volume'] = quote_data.get('v', 0)

                supplemental_data['relative_volume'] = 1.0  # 默认相对成交量



            # 52周高/低（如果可用）

            if quote_data.get('h', 0) > 0:

                supplemental_data['fifty_two_week_high'] = quote_data.get('h', 0) * 1.1  # 模拟52周高

                supplemental_data['fifty_two_week_low'] = quote_data.get('l', 0) * 0.9   # 模拟52周低



        # 从profile数据中提取补充字段

        if profile_data and not profile_error:

            if 'marketCapitalization' in profile_data:

                supplemental_data['market_cap'] = profile_data['marketCapitalization']



            if 'currency' in profile_data:

                supplemental_data['currency'] = profile_data['currency']



            if 'exchange' in profile_data:

                supplemental_data['exchange'] = profile_data['exchange']



        print(f"[Finnhub补充数据] 为 {symbol} 获取 {len(supplemental_data)} 个补充字段")

        return supplemental_data



    except Exception as e:

        print(f"[Finnhub补充数据] 获取补充数据异常: {str(e)}")

        return {}



def fetch_stock_data_parallel(symbol):

    """并行获取单个股票的quote和profile数据"""

    start_time = time.time()



    # 对于Dashboard/Market页面，只使用Alpaca数据，不再回退到Finnhub

    try:

        # 使用Alpaca获取数据

        alpaca_data, alpaca_error = fetch_alpaca_stock_data(symbol)

        if alpaca_data and not alpaca_error:

            # 检查是否获取到了核心价格数据

            has_price_data = alpaca_data.get('price') is not None or alpaca_data.get('bid') is not None or alpaca_data.get('ask') is not None



            elapsed = time.time() - start_time



            if has_price_data:

                print(f'[Alpaca数据] 股票 {symbol} 数据获取成功，有价格数据 ({elapsed:.2f}s)')

                return alpaca_data, True

            else:

                print(f'[Alpaca数据] 股票 {symbol} 数据获取成功，但无价格数据 ({elapsed:.2f}s)')

                # 标记为失败，因为没有核心价格数据

                alpaca_data['dataSource'] = "Alpaca (无价格数据)"

                return alpaca_data, False

        else:

            # Alpaca获取失败，返回空数据（不再回退到Finnhub）

            print(f'[Alpaca数据] 股票 {symbol} Alpaca数据获取失败，返回空数据')

            elapsed = time.time() - start_time

            return {

                "symbol": symbol.upper(),

                "name": None,

                "price": None,

                "change": None,

                "changePercent": None,

                "dayHigh": None,

                "dayLow": None,

                "open": None,

                "previousClose": None,

                "marketCap": None,

                "currency": None,

                "exchange": None,

                "industry": None,

                "sector": None,

                "dataSource": "Alpaca (API调用失败)",

                "timestamp": int(time.time()),

                "error": f"Alpaca: {alpaca_error}",

                "responseTime": round(elapsed, 3)

            }, False

    except Exception as e:

        # Alpaca调用异常，返回空数据

        print(f'[Alpaca数据] 股票 {symbol} Alpaca数据获取异常: {e}')

        elapsed = time.time() - start_time

        return {

            "symbol": symbol.upper(),

            "name": None,

            "price": None,

            "change": None,

            "changePercent": None,

            "dayHigh": None,

            "dayLow": None,

            "open": None,

            "previousClose": None,

            "marketCap": None,

            "currency": None,

            "exchange": None,

            "industry": None,

            "sector": None,

            "dataSource": "Alpaca (异常)",

            "timestamp": int(time.time()),

            "error": str(e),

            "responseTime": round(elapsed, 3)

        }, False







# ==================== Twelve Data API 函数 ====================

def get_twelvedata_history(symbol, interval, range_param):

    """获取Twelve Data历史数据"""

    try:

        # 映射区间参数

        interval_map = {

            '1min': '1min',

            '5min': '5min',

            '15min': '15min',

            '30min': '30min',

            '45min': '45min',

            '1h': '1h',

            '2h': '2h',

            '4h': '4h',

            '1day': '1day',

            '1week': '1week',

            '1month': '1month'

        }



        range_map = {

            '1D': '1day',

            '1W': '1week',

            '1M': '1month',

            '3M': '3month',

            '1Y': '1year',

            '5Y': '5year'

        }



        mapped_interval = interval_map.get(interval, '1day')



        url = f"{TWELVEDATA_BASE_URL}/time_series"

        params = {

            'symbol': symbol.upper(),

            'interval': mapped_interval,

            'outputsize': 1000,

            'apikey': TWELVEDATA_API_KEY

        }



        # 处理日期范围参数

        if ' to ' in range_param:

            # 格式: "2024-01-01 to 2024-12-31"

            try:

                start_date, end_date = range_param.split(' to ')

                params['start_date'] = start_date

                params['end_date'] = end_date

                print(f"[Twelve Data] 使用日期范围: {start_date} 到 {end_date}")

            except:

                # 如果解析失败，使用默认范围

                mapped_range = range_map.get('1Y', '1year')

                params['range'] = mapped_range

        else:

            # 使用预定义的range参数

            mapped_range = range_map.get(range_param, '1month')

            params['range'] = mapped_range



        print(f"[Twelve Data] 请求历史数据: {url}, 参数: {params}")

        response = requests.get(url, params=params, timeout=10)



        if response.status_code != 200:

            error_msg = f"HTTP错误: {response.status_code}"

            try:

                error_data = response.json()

                error_msg = f"{error_msg} - {error_data.get('message', '未知错误')}"

            except:

                pass

            return None, False, error_msg



        data = response.json()



        if 'values' not in data:

            return None, False, f"没有历史数据: {data.get('message', '未知错误')}"



        # 处理数据

        values = data['values']

        if not values:

            return None, False, "空数据"



        # 转换为标准格式

        historical_data = []

        for item in values:

            try:

                # 获取datetime字符串

                datetime_str = item['datetime']



                # 将datetime字符串转换为时间戳（秒）

                from datetime import datetime

                try:

                    # 尝试解析不同的日期格式

                    if ' ' in datetime_str:

                        # 格式: "2026-02-17 15:30:00"

                        dt = datetime.strptime(datetime_str, '%Y-%m-%d %H:%M:%S')

                    else:

                        # 格式: "2026-02-17"

                        dt = datetime.strptime(datetime_str, '%Y-%m-%d')



                    timestamp_seconds = int(dt.timestamp())

                except:

                    # 如果解析失败，使用当前时间

                    timestamp_seconds = int(time.time())



                historical_data.append({

                    'timestamp': timestamp_seconds,  # 数字时间戳（秒）

                    'time': datetime_str,            # 字符串时间

                    'open': float(item['open']),

                    'high': float(item['high']),

                    'low': float(item['low']),

                    'close': float(item['close']),

                    'volume': int(float(item.get('volume', 0)))

                })

            except (ValueError, KeyError) as e:

                print(f"[Twelve Data] 数据转换错误: {e}, 数据: {item}")

                continue



        # 按时间排序（从旧到新）

        historical_data.sort(key=lambda x: x['timestamp'])



        print(f"[Twelve Data] 成功获取 {len(historical_data)} 条历史数据")

        return historical_data, True, "Twelve Data"



    except Exception as e:

        return None, False, f"Twelve Data API错误: {str(e)}"





# ==================== Alpaca Backtest 历史数据函数 ====================

def get_alpaca_history_for_backtest(symbol, interval, range_param):

    """获取Alpaca历史数据专门用于backtest - 支持精确日期范围"""

    try:

        print(f'[Alpaca Backtest] 开始获取 {symbol} 历史数据: interval={interval}, range={range_param}')



        # 解析日期范围

        if ' to ' in range_param:

            try:

                start_date_str, end_date_str = range_param.split(' to ')

                print(f'[Alpaca Backtest] 解析日期范围: {start_date_str} 到 {end_date_str}')



                import datetime

                import pytz



                # 解析日期

                start_date = datetime.datetime.strptime(start_date_str, '%Y-%m-%d')

                end_date = datetime.datetime.strptime(end_date_str, '%Y-%m-%d')



                # 设置时区（美东时间）

                eastern = pytz.timezone('America/New_York')

                start_date_eastern = eastern.localize(start_date.replace(hour=9, minute=30, second=0))  # 市场开盘时间

                end_date_eastern = eastern.localize(end_date.replace(hour=16, minute=0, second=0))  # 市场收盘时间



                # 转换为UTC

                utc = pytz.UTC

                start_date_utc = start_date_eastern.astimezone(utc)

                end_date_utc = end_date_eastern.astimezone(utc)



                # 确保结束日期不超过当前时间

                now_utc = datetime.datetime.now(utc)

                if end_date_utc > now_utc:

                    print(f'[Alpaca Backtest] 警告: 结束日期 {end_date_str} 超过当前时间，调整为当前时间')

                    end_date_utc = now_utc



                # 计算时间范围（天数）

                days_diff = (end_date_utc - start_date_utc).days

                print(f'[Alpaca Backtest] 时间范围: {days_diff} 天')



                # 根据时间范围选择timeframe

                if days_diff <= 7:  # 1周内

                    timeframe = '1Hour'

                    limit = min(1000, days_diff * 24)  # 每小时一个点

                elif days_diff <= 30:  # 1月内

                    timeframe = '1Hour'

                    limit = 1000

                elif days_diff <= 90:  # 3月内

                    timeframe = '1Hour'

                    limit = 1000

                else:  # 超过3个月

                    timeframe = '1Day'

                    limit = min(1000, days_diff)



                print(f'[Alpaca Backtest] 使用 timeframe: {timeframe}, limit: {limit}')



                # 调用Alpaca bars API

                historical_data, success, data_source = fetch_alpaca_bars_for_backtest(

                    symbol, timeframe, start_date_utc, end_date_utc, limit

                )



                if success and historical_data:

                    print(f'[Alpaca Backtest] 成功获取 {len(historical_data)} 条历史数据')

                    return historical_data, True, f'Alpaca ({timeframe} bars)'

                else:

                    print(f'[Alpaca Backtest] 获取失败: {data_source}')

                    return [], False, f'Alpaca获取失败: {data_source}'



            except Exception as e:

                print(f'[Alpaca Backtest] 日期范围解析异常: {str(e)}')

                return [], False, f'Alpaca日期范围解析异常: {str(e)}'

        else:

            print(f'[Alpaca Backtest] 无效的日期范围格式: {range_param}')

            return [], False, f'无效的日期范围格式: {range_param}'



    except Exception as e:

        print(f'[Alpaca Backtest] 异常: {str(e)}')

        return [], False, f'Alpaca Backtest历史数据获取异常: {str(e)}'





def fetch_alpaca_bars_for_backtest(symbol, timeframe, start_date_utc, end_date_utc, limit=1000):

    """获取Alpaca bars数据专门用于backtest - 支持日期范围"""

    try:

        import requests

        import time



        print(f'[Alpaca Backtest Bars] 请求 {symbol} bars: timeframe={timeframe}, start={start_date_utc}, end={end_date_utc}')



        # 根据环境配置选择API key

        environment = alpaca_config_state.get('environment', 'paper')



        if environment == 'paper':

            api_key = alpaca_config_state.get('paper_api_key')

            api_secret = alpaca_config_state.get('paper_api_secret')

        else:

            api_key = alpaca_config_state.get('live_api_key')

            api_secret = alpaca_config_state.get('live_api_secret')



        base_url = 'https://data.alpaca.markets/v2'



        # 检查API密钥

        if not api_key or not api_secret:

            print(f'[Alpaca Backtest Bars] {environment} 环境API密钥未配置')

            return [], False, f'{environment} 环境API密钥未配置'



        headers = {

            'APCA-API-KEY-ID': api_key,

            'APCA-API-SECRET-KEY': api_secret

        }



        # 构建请求URL

        url = f'{base_url}/stocks/{symbol}/bars'



        # 尝试不同的feed：sip -> iex

        feeds_to_try = ['sip', 'iex']

        

        for feed in feeds_to_try:

            # 构建参数

            params = {

                'timeframe': timeframe,

                'limit': limit,

                'adjustment': 'raw',

                'feed': feed,  # 动态feed

                'sort': 'asc',  # 按时间升序排序

                'start': start_date_utc.strftime('%Y-%m-%dT%H:%M:%SZ'),

                'end': end_date_utc.strftime('%Y-%m-%dT%H:%M:%SZ')

            }



            print(f'[Alpaca Backtest Bars] 尝试feed={feed}, 请求参数: {params}')

            print(f'[Optimization Alpaca] URL = {url}')

            print(f'[Optimization Alpaca] params = {params}')

            print(f'[Optimization Alpaca] key = {ALPACA_API_KEY[:6]}...{ALPACA_API_KEY[-4:] if len(ALPACA_API_KEY) > 10 else ALPACA_API_KEY}')

            

            # 发送请求

            response = requests.get(url, headers=headers, params=params, timeout=30)

            

            print(f'[Optimization Alpaca] status = {response.status_code}')

            print(f'[Optimization Alpaca] body = {response.text[:500]}')



            if response.status_code == 200:

                data = response.json()

                

                # Alpaca原始返回摘要

                print(f'[Alpaca Backtest Bars] Alpaca原始响应摘要 (feed={feed}):')

                print(f'  - 状态码: {response.status_code}')

                print(f'  - 响应包含bars字段: {"bars" in data}')

                if 'bars' in data:

                    bars = data['bars']

                    print(f'  - bars数组长度: {len(bars)}')

                    if len(bars) > 0:

                        first_bar = bars[0]

                        last_bar = bars[-1]

                        print(f'  - 第一条bar: t={first_bar.get("t")}, o={first_bar.get("o")}, h={first_bar.get("h")}, l={first_bar.get("l")}, c={first_bar.get("c")}, v={first_bar.get("v")}')

                        print(f'  - 最后一条bar: t={last_bar.get("t")}, o={last_bar.get("o")}, h={last_bar.get("h")}, l={last_bar.get("l")}, c={last_bar.get("c")}, v={last_bar.get("v")}')

                    else:

                        print(f'  - 警告: bars数组为空')

                else:

                    print(f'  - 响应数据: {data}')

                

                if 'bars' in data and data['bars']:

                    bars = data['bars']

                    print(f'[Alpaca Backtest Bars] 成功获取 {len(bars)} 条bars数据 (feed={feed})')



                    # 转换数据格式为backtest需要的格式

                    historical_data = []

                    for bar in bars:

                        # 解析时间戳

                        timestamp_str = bar.get('t', '')  # ISO格式时间戳



                        # 转换为日期字符串（backtest需要的格式）

                        try:

                            dt = dateutil.parser.isoparse(timestamp_str)

                            date_str = dt.strftime('%Y-%m-%d')

                        except:

                            date_str = timestamp_str[:10]  # 取前10个字符作为日期



                        historical_data.append({

                            'timestamp': date_str,

                            'open': bar.get('o', 0),

                            'high': bar.get('h', 0),

                            'low': bar.get('l', 0),

                            'close': bar.get('c', 0),

                            'volume': bar.get('v', 0)

                        })



                    print(f'[Alpaca Backtest Bars] 转换完成: {len(historical_data)} 条数据')

                    return historical_data, True, f'Alpaca {timeframe} bars (feed={feed})'

                else:

                    print(f'[Alpaca Backtest Bars] 响应中没有bars数据 (feed={feed}): {data}')

                    # 继续尝试下一个feed

                    continue

            elif response.status_code in [403, 422]:

                print(f'[Alpaca Backtest Bars] feed={feed} 返回 {response.status_code}，尝试下一个feed')

                # 继续尝试下一个feed

                continue

            else:

                print(f'[Alpaca Backtest Bars] feed={feed} API请求失败: {response.status_code}')

                # 继续尝试下一个feed

                continue

        

        # 所有feed都失败

        print(f'[Alpaca Backtest Bars] 所有feed都失败: sip和iex都返回错误')

        return [], False, 'Alpaca historical bars unavailable for optimization (sip和iex都失败)'



    except Exception as e:

        print(f'[Alpaca Backtest Bars] 异常: {str(e)}')

        return [], False, f'Alpaca Backtest Bars获取异常: {str(e)}'



def fetch_twelvedata_quote(symbol):

    """获取Twelve Data报价数据"""

    cache_key = f"{symbol}_twelvedata_quote"



    # 检查缓存

    cached = stock_cache.get(cache_key)

    if cached is not None:

        return cached, None



    try:

        url = f"{TWELVEDATA_BASE_URL}/quote"

        params = {

            'symbol': symbol.upper(),

            'apikey': TWELVEDATA_API_KEY

        }



        response = requests.get(url, params=params, timeout=5)



        if response.status_code != 200:

            return None, f"HTTP错误: {response.status_code}"



        data = response.json()



        if 'status' in data and data['status'] == 'error':

            return None, data.get('message', '未知错误')



        # 缓存结果

        stock_cache.set(cache_key, data)

        return data, None



    except Exception as e:

        return None, str(e)



def get_finnhub_history(symbol, interval, range_param):

    """使用Finnhub获取历史数据（备选方案）"""

    try:

        # 映射区间参数到Finnhub的resolution

        resolution_map = {

            '1min': '1',

            '5min': '5',

            '15min': '15',

            '30min': '30',

            '45min': '45',

            '1h': '60',

            '1day': 'D',

            '1week': 'W',

            '1month': 'M'

        }



        # 映射range参数到时间范围

        from datetime import datetime, timedelta

        end_timestamp = int(time.time())



        if range_param == '1D':

            start_timestamp = end_timestamp - 24 * 60 * 60  # 1天

            resolution = '5'  # 5分钟数据

        elif range_param == '1W':

            start_timestamp = end_timestamp - 7 * 24 * 60 * 60  # 7天

            resolution = '60'  # 1小时数据

        elif range_param == '1M':

            start_timestamp = end_timestamp - 30 * 24 * 60 * 60  # 30天

            resolution = 'D'  # 日数据

        elif range_param == '3M':

            start_timestamp = end_timestamp - 90 * 24 * 60 * 60  # 90天

            resolution = 'D'  # 日数据

        elif range_param == '1Y':

            start_timestamp = end_timestamp - 365 * 24 * 60 * 60  # 365天

            resolution = 'D'  # 日数据

        else:

            start_timestamp = end_timestamp - 30 * 24 * 60 * 60  # 默认30天

            resolution = 'D'  # 日数据



        # 如果interval有映射，使用映射的resolution

        mapped_resolution = resolution_map.get(interval, resolution)



        url = f"{FINNHUB_BASE_URL}/stock/candle"

        params = {

            'symbol': symbol.upper(),

            'resolution': mapped_resolution,

            'from': start_timestamp,

            'to': end_timestamp,

            'token': FINNHUB_API_KEY

        }



        print(f"[Finnhub历史数据] 请求: {url}, 参数: {params}")

        response = requests.get(url, params=params, timeout=10)



        if response.status_code != 200:

            # 如果API密钥无效，返回模拟数据

            print(f"[Finnhub历史数据] API密钥无效，返回模拟数据")

            return generate_mock_history_data(symbol, interval, range_param), True, "模拟数据 (Finnhub API密钥无效)"



        data = response.json()



        if data.get('s') != 'ok':

            # 如果API返回错误，返回模拟数据

            print(f"[Finnhub历史数据] API返回错误，返回模拟数据")

            return generate_mock_history_data(symbol, interval, range_param), True, "模拟数据 (Finnhub错误)"



        # 处理数据

        if 'c' not in data or not data['c']:

            # 如果没有数据，返回模拟数据

            print(f"[Finnhub历史数据] 没有历史数据，返回模拟数据")

            return generate_mock_history_data(symbol, interval, range_param), True, "模拟数据 (无历史数据)"



        # 转换为标准格式

        historical_data = []

        timestamps = data.get('t', [])

        opens = data.get('o', [])

        highs = data.get('h', [])

        lows = data.get('l', [])

        closes = data.get('c', [])

        volumes = data.get('v', [])



        for i in range(len(timestamps)):

            try:

                timestamp_seconds = timestamps[i]

                datetime_str = datetime.fromtimestamp(timestamp_seconds).strftime('%Y-%m-%d %H:%M:%S')



                historical_data.append({

                    'timestamp': timestamp_seconds,  # 数字时间戳（秒）

                    'time': datetime_str,            # 字符串时间

                    'open': float(opens[i]),

                    'high': float(highs[i]),

                    'low': float(lows[i]),

                    'close': float(closes[i]),

                    'volume': int(float(volumes[i])) if i < len(volumes) else 0

                })

            except (ValueError, IndexError) as e:

                continue



        # 按时间排序（从旧到新）

        historical_data.sort(key=lambda x: x['timestamp'])



        # 获取Finnhub补充数据

        supplemental_data = get_finnhub_supplemental_data(symbol)



        # 如果有补充数据，添加到每个数据点

        if supplemental_data:

            print(f"[Finnhub历史数据] 添加 {len(supplemental_data)} 个补充字段")

            for data_point in historical_data:

                data_point.update(supplemental_data)



        print(f"[Finnhub历史数据] 成功获取 {len(historical_data)} 条历史数据（包含补充字段）")

        return historical_data, True, "Finnhub"



    except Exception as e:

        # 如果发生异常，返回模拟数据

        print(f"[Finnhub历史数据] 异常: {str(e)}，返回模拟数据")

        return generate_mock_history_data(symbol, interval, range_param), True, "模拟数据 (异常)"



def generate_mock_history_data(symbol, interval, range_param):

    """生成模拟历史数据 - 为不同股票使用不同的基础价格"""

    from datetime import datetime, timedelta



    # 根据range_param确定数据点数量

    if range_param == '1D':

        num_points = 78  # 6.5小时 * 12个5分钟数据点/小时

        time_delta = timedelta(minutes=5)

    elif range_param == '1W':

        num_points = 35  # 5天 * 7个小时数据点/天

        time_delta = timedelta(hours=1)

    elif range_param == '1M':

        num_points = 20  # 20个交易日

        time_delta = timedelta(days=1)

    elif range_param == '3M':

        num_points = 60  # 60个交易日

        time_delta = timedelta(days=1)

    elif range_param == '1Y':

        num_points = 252  # 252个交易日

        time_delta = timedelta(days=1)

    else:

        num_points = 20  # 默认20个数据点

        time_delta = timedelta(days=1)



    # 根据interval调整

    if interval == '1day':

        time_delta = timedelta(days=1)

    elif interval == '1h':

        time_delta = timedelta(hours=1)

        num_points = min(num_points * 6, 100)  # 限制数量

    elif interval == '5min':

        time_delta = timedelta(minutes=5)

        num_points = min(num_points * 12, 200)  # 限制数量



    # 为不同股票使用不同的基础价格（基于股票名称的哈希）

    symbol_hash = hash



# 模拟回复生成函数

def get_mock_response(message):

    """根据消息内容生成模拟的简洁回复"""

    # 简单匹配逻辑

    msg = message



    # 测试1: 你好

    if "你好" in msg:

        return "你好，我在。\n如果你想聊交易、策略、仓位或某只股票，我可以直接帮你分析。\n也可以问普通问题，我会正常回答。"



    # 测试2: 只交易 AAPL 和 MSFT 可以吗

    if ("AAPL" in msg.upper() or "MSFT" in msg.upper()) and ("交易" in msg or "可以" in msg):

        return "可以，但要先看你的目标和风险承受能力。\n如果只做 AAPL 和 MSFT，优点是流动性好、信息透明。\n缺点是持仓会过于集中，回撤会更依赖美股科技板块。\n更稳的做法是先设单票仓位上限，再决定是否只做这两只。"



    # 测试3: 为什么天空是蓝色的

    if "天空" in msg and "蓝色" in msg:

        return "因为大气会更强地散射短波长的蓝光。\n白天太阳光进入大气后，蓝光更容易向各个方向散开，所以我们看到天空偏蓝。\n如果你要，我也可以用更简单或更科学的方式讲一遍。"



    # 测试4: 帮我把仓位控制得更保守一点

    if "仓位" in msg and "保守" in msg:

        return "好的，我会把仓位控制得更保守。\n建议：\n1. 单票仓位上限降到 5%\n2. 总仓位不超过 60%\n3. 止损线设到 -8%\n需要我帮你调整具体参数吗？"



    # 测试5: 用一句话解释什么是止损

    if "止损" in msg and ("解释" in msg or "什么" in msg):

        return "止损是在价格跌到预设水平时自动卖出，防止亏损扩大。\n核心是控制单笔损失，保护本金。"



    # 默认回复

    return f"收到: {msg}\n（当前为模拟回复，配置有效API密钥后可获得真实AI回答）"



@app.route('/api/ai/provider/config', methods=['GET', 'POST'])

def ai_provider_config():

    try:

        if request.method == 'GET':

            # 返回硬编码的配置，确保API密钥不为空

            config_to_return = dict(ai_provider_config_state)

            if not config_to_return.get('apiKey'):

                config_to_return['apiKey'] = 'sk-83365246617844178bf8d1e121b7279f'

            

            return jsonify({

                'success': True,

                'config': config_to_return

            })

        else:

            # POST 方法 - 保存配置

            data = request.get_json()

            print('=== DeepSeek 配置保存请求 ===')

            print('原始数据:', data)



            # 更新所有配置字段

            if 'provider' in data:

                ai_provider_config_state['provider'] = data['provider']

            if 'apiKey' in data:

                ai_provider_config_state['apiKey'] = data['apiKey']

            if 'baseUrl' in data:

                ai_provider_config_state['baseURL'] = data['baseUrl']

            if 'baseURL' in data:  # 也支持大写

                ai_provider_config_state['baseURL'] = data['baseURL']

            if 'model' in data:

                ai_provider_config_state['model'] = data['model']



            response = {

                'success': True,

                'config': ai_provider_config_state,

                'message': '配置保存成功'

            }

            print('返回响应:', response)

            return jsonify(response)

    except Exception as e:

        print('配置保存错误:', e)

        return jsonify({'success': False, 'error': str(e)}), 500



@app.route('/api/ai/provider/test', methods=['POST'])

def ai_provider_test():

    print('=== AI Provider Test 请求 ===')

    try:

        data = request.get_json()

        api_key = data.get('apiKey', '')



        if not api_key or api_key.startswith('sk-') and len(api_key) < 30:

            return jsonify({

                'success': False,

                'message': 'API 密钥无效或未提供',

                'valid': False

            })



        # 测试 API 密钥

        headers = {

            'Authorization': f'Bearer {api_key}',

            'Content-Type': 'application/json'

        }



        base_url = data.get('baseUrl', 'https://api.deepseek.com')

        if not base_url.startswith('http'):

            base_url = 'https://' + base_url



        try:

            test_response = requests.post(

                f'{base_url}/chat/completions',

                headers=headers,

                json={

                    'model': data.get('model', 'deepseek-chat'),

                    'messages': [{'role': 'user', 'content': 'Hello'}],

                    'max_tokens': 10

                },

                timeout=10

            )



            if test_response.status_code == 200:

                return jsonify({

                    'success': True,

                    'message': 'API 连接测试成功',

                    'valid': True

                })

            else:

                return jsonify({

                    'success': False,

                    'message': f'API 测试失败: {test_response.status_code}',

                    'valid': False

                })

        except Exception as e:

            return jsonify({

                'success': False,

                'message': f'API 测试异常: {str(e)[:100]}',

                'valid': False

            })

    except Exception as e:

        print(f'AI Provider Test 错误: {e}')

        return jsonify({

            'success': False,

            'message': f'处理请求时发生错误: {str(e)[:100]}',

            'valid': False

        })



@app.route('/api/ai/alpaca/account', methods=['GET'])

def ai_alpaca_account():

    print('=== AI Alpaca 账户请求 ===')

    try:

        # 尝试使用真实的 Alpaca API

        environment = alpaca_config_state.get('environment', 'paper')



        if environment == 'paper':

            api_key = alpaca_config_state.get('paper_api_key')

            api_secret = alpaca_config_state.get('paper_api_secret')

            base_url = 'https://paper-api.alpaca.markets'

        else:

            api_key = alpaca_config_state.get('live_api_key')

            api_secret = alpaca_config_state.get('live_api_secret')

            base_url = 'https://api.alpaca.markets'



        # 如果没有配置API密钥，返回模拟数据但标记为模拟

        if not api_key or not api_secret:

            print('Alpaca API 密钥未配置，返回模拟数据')

            return jsonify({

                'success': True,

                'data': {

                    'accountNumber': 'PA3YPSJY0D4E',

                    'status': 'ACTIVE',

                    'cash': 100000.0,

                    'equity': 100000.0,

                    'buyingPower': 198162.55,

                    'portfolioValue': 100000.0,

                    'longMarketValue': 0.0,

                    'shortMarketValue': 0.0,

                    'patternDayTrader': False,

                    'tradingBlocked': False,

                    'transfersBlocked': False,

                    'accountBlocked': False,

                    'currency': 'USD',

                    'isMockData': True,

                    'message': 'Alpaca API 密钥未配置，显示模拟数据'

                }

            })



        # 调用真实的 Alpaca API

        headers = {

            'APCA-API-KEY-ID': api_key,

            'APCA-API-SECRET-KEY': api_secret

        }



        print(f'调用真实 Alpaca API: {base_url}/v2/account')

        response = requests.get(f'{base_url}/v2/account', headers=headers, timeout=10)



        if response.status_code == 200:

            account_data = response.json()

            print(f'获取到真实账户数据: {account_data.get("id", "未知")}')



            return jsonify({

                'success': True,

                'data': {

                    'accountNumber': account_data.get('id', ''),

                    'status': account_data.get('status', ''),

                    'cash': float(account_data.get('cash', 0)),

                    'equity': float(account_data.get('equity', 0)),

                    'buyingPower': float(account_data.get('buying_power', 0)),

                    'portfolioValue': float(account_data.get('portfolio_value', 0)),

                    'longMarketValue': float(account_data.get('long_market_value', 0)),

                    'shortMarketValue': float(account_data.get('short_market_value', 0)),

                    'patternDayTrader': account_data.get('pattern_day_trader', False),

                    'tradingBlocked': account_data.get('trading_blocked', False),

                    'transfersBlocked': account_data.get('transfers_blocked', False),

                    'accountBlocked': account_data.get('account_blocked', False),

                    'currency': account_data.get('currency', 'USD'),

                    'isMockData': False

                }

            })

        else:

            print(f'Alpaca API 调用失败: {response.status_code} - {response.text}')

            # API调用失败时返回模拟数据

            return jsonify({

                'success': True,

                'data': {

                    'accountNumber': 'PA3YPSJY0D4E',

                    'status': 'ACTIVE',

                    'cash': 100000.0,

                    'equity': 100000.0,

                    'buyingPower': 198162.55,

                    'portfolioValue': 100000.0,

                    'longMarketValue': 0.0,

                    'shortMarketValue': 0.0,

                    'patternDayTrader': False,

                    'tradingBlocked': False,

                    'transfersBlocked': False,

                    'accountBlocked': False,

                    'currency': 'USD',

                    'isMockData': True,

                    'message': f'Alpaca API 调用失败 ({response.status_code})，显示模拟数据'

                }

            })



    except Exception as e:

        print(f'Alpaca 账户接口错误: {e}')

        return jsonify({

            'success': True,

            'data': {

                'accountNumber': 'PA3YPSJY0D4E',

                'status': 'ACTIVE',

                'cash': 100000.0,

                'equity': 100000.0,

                'buyingPower': 198162.55,

                'portfolioValue': 100000.0,

                'longMarketValue': 0.0,

                'shortMarketValue': 0.0,

                'patternDayTrader': False,

                'tradingBlocked': False,

                'transfersBlocked': False,

                'accountBlocked': False,

                'currency': 'USD',

                'isMockData': True,

                'message': f'接口异常: {str(e)}，显示模拟数据'

            }

        })



@app.route('/api/ai/alpaca/positions', methods=['GET'])

def ai_alpaca_positions():

    print('=== AI Alpaca 持仓请求 ===')

    try:

        # 尝试使用真实的 Alpaca API

        environment = alpaca_config_state.get('environment', 'paper')



        if environment == 'paper':

            api_key = alpaca_config_state.get('paper_api_key')

            api_secret = alpaca_config_state.get('paper_api_secret')

            base_url = 'https://paper-api.alpaca.markets'

        else:

            api_key = alpaca_config_state.get('live_api_key')

            api_secret = alpaca_config_state.get('live_api_secret')

            base_url = 'https://api.alpaca.markets'



        # 如果没有配置API密钥，返回模拟数据但标记为模拟

        if not api_key or not api_secret:

            print('Alpaca API 密钥未配置，返回模拟持仓数据')

            return jsonify({

                'success': True,

                'data': [

                    {

                        'symbol': 'AAPL',

                        'qty': 10,

                        'avgEntryPrice': 175.50,

                        'currentPrice': 178.25,

                        'marketValue': 1782.50,

                        'unrealizedPL': 27.50,

                        'unrealizedPLPercent': 1.57,

                        'isMockData': True

                    },

                    {

                        'symbol': 'MSFT',

                        'qty': 5,

                        'avgEntryPrice': 420.75,

                        'currentPrice': 425.30,

                        'marketValue': 2126.50,

                        'unrealizedPL': 22.75,

                        'unrealizedPLPercent': 1.08,

                        'isMockData': True

                    }

                ],

                'count': 2,

                'isMockData': True,

                'message': 'Alpaca API 密钥未配置，显示模拟持仓数据'

            })



        # 调用真实的 Alpaca API

        headers = {

            'APCA-API-KEY-ID': api_key,

            'APCA-API-SECRET-KEY': api_secret

        }



        print(f'调用真实 Alpaca API: {base_url}/v2/positions')

        response = requests.get(f'{base_url}/v2/positions', headers=headers, timeout=10)



        if response.status_code == 200:

            positions_data = response.json()

            print(f'获取到真实持仓数据: {len(positions_data)} 个持仓')



            formatted_positions = []

            for position in positions_data:

                # 获取所有Alpaca原始字段

                avg_entry_price = float(position.get('avg_entry_price', 0))

                current_price = float(position.get('current_price', 0))

                qty = float(position.get('qty', 0))

                market_value = float(position.get('market_value', 0))

                cost_basis = float(position.get('cost_basis', 0))

                unrealized_pl = float(position.get('unrealized_pl', 0))

                unrealized_plpc = float(position.get('unrealized_plpc', 0))

                unrealized_intraday_pl = float(position.get('unrealized_intraday_pl', 0))

                unrealized_intraday_plpc = float(position.get('unrealized_intraday_plpc', 0))



                # 规范化字段名，同时提供驼峰式和下划线式

                formatted_position = {

                    # 基础信息

                    'symbol': position.get('symbol', ''),

                    'asset_id': position.get('asset_id', ''),

                    'asset_class': position.get('asset_class', ''),

                    'exchange': position.get('exchange', ''),

                    'asset_marginable': position.get('asset_marginable', False),



                    # 数量信息

                    'qty': qty,

                    'qty_available': float(position.get('qty_available', 0)),

                    'quantity': qty,  # 前端使用的字段

                    'side': position.get('side', 'long'),



                    # 价格信息

                    'avg_entry_price': avg_entry_price,

                    'avgEntryPrice': avg_entry_price,  # 前端使用的字段

                    'current_price': current_price,

                    'currentPrice': current_price,  # 前端使用的字段

                    'lastday_price': float(position.get('lastday_price', 0)),

                    'lastdayPrice': float(position.get('lastday_price', 0)),  # 前端使用的字段



                    # 价值信息

                    'market_value': market_value,

                    'marketValue': market_value,  # 前端使用的字段

                    'cost_basis': cost_basis,

                    'costBasis': cost_basis,  # 前端使用的字段



                    # 盈亏信息

                    'unrealized_pl': unrealized_pl,

                    'unrealizedPL': unrealized_pl,  # 前端使用的字段

                    'unrealized_plpc': unrealized_plpc,

                    'unrealizedPLPercent': unrealized_plpc * 100,  # 前端使用的字段，转换为百分比



                    # 当日盈亏信息

                    'unrealized_intraday_pl': unrealized_intraday_pl,

                    'unrealized_intraday_plpc': unrealized_intraday_plpc,

                    'unrealizedIntradayPL': unrealized_intraday_pl,  # 前端使用的字段

                    'unrealizedIntradayPLPercent': unrealized_intraday_plpc * 100,  # 前端使用的字段，转换为百分比



                    # 计算今日盈亏金额和百分比

                    'today_pl_value': unrealized_intraday_pl,

                    'todayPlValue': unrealized_intraday_pl,  # 前端使用的字段

                    'today_pl_percent': unrealized_intraday_plpc * 100,

                    'todayPlPercent': unrealized_intraday_plpc * 100,  # 前端使用的字段



                    # 总盈亏金额和百分比

                    'total_pl_value': unrealized_pl,

                    'totalPlValue': unrealized_pl,  # 前端使用的字段

                    'total_pl_percent': unrealized_plpc * 100,

                    'totalPlPercent': unrealized_plpc * 100,  # 前端使用的字段



                    # 其他Alpaca字段

                    'asset_marginable': position.get('asset_marginable', False),

                    'asset_marginable': position.get('asset_marginable', False),

                    'asset_class': position.get('asset_class', ''),

                    'exchange': position.get('exchange', ''),

                    'asset_id': position.get('asset_id', ''),

                    'avg_entry_price': avg_entry_price,

                    'change_today': float(position.get('change_today', 0)),

                    'cost_basis': cost_basis,

                    'current_price': current_price,

                    'lastday_price': float(position.get('lastday_price', 0)),

                    'market_value': market_value,

                    'qty': qty,

                    'qty_available': float(position.get('qty_available', 0)),

                    'side': position.get('side', 'long'),

                    'subtype': position.get('subtype', ''),

                    'today_pl_value': unrealized_intraday_pl,

                    'today_pl_percent': unrealized_intraday_plpc * 100,

                    'total_pl_value': unrealized_pl,

                    'total_pl_percent': unrealized_plpc * 100,

                    'unrealized_intraday_pl': unrealized_intraday_pl,

                    'unrealized_intraday_plpc': unrealized_intraday_plpc,

                    'unrealized_pl': unrealized_pl,

                    'unrealized_plpc': unrealized_plpc,



                    # 元数据

                    'isMockData': False,

                    'message': '真实Alpaca持仓数据',

                    'unrealizedIntradayPL': float(position.get('unrealized_intraday_pl', 0)),  # 前端使用的字段

                    'unrealized_intraday_plpc': float(position.get('unrealized_intraday_plpc', 0)),

                    'unrealizedIntradayPLPercent': float(position.get('unrealized_intraday_plpc', 0)) * 100,  # 前端使用的字段，转换为百分比



                    # 当日变化

                    'change_today': float(position.get('change_today', 0)),

                    'changeToday': float(position.get('change_today', 0)),  # 前端使用的字段



                    'isMockData': False

                }

                formatted_positions.append(formatted_position)



            return jsonify({

                'success': True,

                'data': formatted_positions,

                'count': len(formatted_positions),

                'isMockData': False

            })

        else:

            print(f'Alpaca 持仓 API 调用失败: {response.status_code} - {response.text}')

            # API调用失败时返回模拟数据

            return jsonify({

                'success': True,

                'data': [

                    {

                        'symbol': 'AAPL',

                        'qty': 10,

                        'avgEntryPrice': 175.50,

                        'currentPrice': 178.25,

                        'marketValue': 1782.50,

                        'unrealizedPL': 27.50,

                        'unrealizedPLPercent': 1.57,

                        'isMockData': True

                    },

                    {

                        'symbol': 'MSFT',

                        'qty': 5,

                        'avgEntryPrice': 420.75,

                        'currentPrice': 425.30,

                        'marketValue': 2126.50,

                        'unrealizedPL': 22.75,

                        'unrealizedPLPercent': 1.08,

                        'isMockData': True

                    }

                ],

                'count': 2,

                'isMockData': True,

                'message': f'Alpaca API 调用失败 ({response.status_code})，显示模拟持仓数据'

            })



    except Exception as e:

        print(f'Alpaca 持仓接口错误: {e}')

        return jsonify({

            'success': True,

            'data': [

                {

                    'symbol': 'AAPL',

                    'qty': 10,

                    'avgEntryPrice': 175.50,

                    'currentPrice': 178.25,

                    'marketValue': 1782.50,

                    'unrealizedPL': 27.50,

                    'unrealizedPLPercent': 1.57,

                    'isMockData': True

                },

                {

                    'symbol': 'MSFT',

                    'qty': 5,

                    'avgEntryPrice': 420.75,

                    'currentPrice': 425.30,

                    'marketValue': 2126.50,

                    'unrealizedPL': 22.75,

                    'unrealizedPLPercent': 1.08,

                    'isMockData': True

                }

            ],

            'count': 2,

            'isMockData': True,

            'message': f'接口异常: {str(e)}，显示模拟持仓数据'

        })



@app.route('/api/ai/alpaca/orders', methods=['GET', 'POST'])

def ai_alpaca_orders():

    if request.method == 'POST':

        return ai_alpaca_place_order()



    # GET 请求处理原有逻辑

    import sys

    print('=== AI Alpaca 订单请求 ===', file=sys.stderr)

    print('=== AI Alpaca 订单请求 ===')

    status = request.args.get('status', 'open')

    limit = request.args.get('limit', '50')



    try:

        # 尝试使用真实的 Alpaca API

        environment = alpaca_config_state.get('environment', 'paper')



        if environment == 'paper':

            api_key = alpaca_config_state.get('paper_api_key')

            api_secret = alpaca_config_state.get('paper_api_secret')

            base_url = 'https://paper-api.alpaca.markets'

        else:

            api_key = alpaca_config_state.get('live_api_key')

            api_secret = alpaca_config_state.get('live_api_secret')

            base_url = 'https://api.alpaca.markets'



        # 如果没有配置API密钥，返回模拟数据但标记为模拟

        if not api_key or not api_secret:

            print('Alpaca API 密钥未配置，返回模拟订单数据')

            response = {

                'success': True,

                'data': [

                    {

                        'id': 'order-002',

                        'symbol': 'NVDA',

                        'qty': 2,

                        'filled_qty': 0,

                        'filledQty': 0,

                        'side': 'buy',

                        'type': 'limit',

                        'limit_price': 950.00,

                        'limitPrice': 950.00,

                        'status': 'accepted',

                        'created_at': '2026-04-05T10:30:00Z',

                        'createdAt': '2026-04-05T10:30:00Z',

                        'time_in_force': 'gtc',

                        'timeInForce': 'gtc',

                        'isMockData': True

                    },

                    {

                        'id': 'order-003',

                        'symbol': 'GOOGL',

                        'qty': 3,

                        'filled_qty': 0,

                        'filledQty': 0,

                        'side': 'buy',

                        'type': 'market',

                        'status': 'accepted',

                        'created_at': '2026-04-05T11:15:00Z',

                        'createdAt': '2026-04-05T11:15:00Z',

                        'time_in_force': 'day',

                        'timeInForce': 'day',

                        'isMockData': True

                    }

                ],

                'count': 2,

                'status_filter': status,

                'limit': limit,

                'isMockData': True,

                'message': 'Alpaca API 密钥未配置，显示模拟订单数据'

            }

            print('返回模拟订单数据 (status=%s, limit=%s)' % (status, limit))

            return jsonify(response)



        # 调用真实的 Alpaca API

        headers = {

            'APCA-API-KEY-ID': api_key,

            'APCA-API-SECRET-KEY': api_secret

        }



        # 构建查询参数

        params = {

            'status': status,

            'limit': limit,

            'direction': 'desc',

            'nested': 'true'  # 添加nested参数

        }



        print(f'调用真实 Alpaca API: {base_url}/v2/orders')

        print(f'查询参数: {params}')

        print(f'环境: {environment}')

        print(f'API密钥: {api_key[:6]}...{api_key[-4:]}')

        print(f'API Secret: {api_secret[:6]}...{api_secret[-4:]}')



        # 先调用/v2/account获取账户信息

        try:

            account_response = requests.get(f'{base_url}/v2/account', headers=headers, timeout=10)

            if account_response.status_code == 200:

                account_data = account_response.json()

                print(f'账户信息: account_number={account_data.get("account_number")}, id={account_data.get("id")}')

            else:

                print(f'获取账户信息失败: {account_response.status_code}')

        except Exception as e:

            print(f'获取账户信息异常: {e}')



        try:

            response = requests.get(f'{base_url}/v2/orders', headers=headers, params=params, timeout=10)



            print(f'Alpaca API 响应状态码: {response.status_code}')

            print(f'Alpaca API 响应内容前500字符: {response.text[:500]}...')



            if response.status_code == 200:

                orders_data = response.json()

                print(f'获取到真实订单数据: {len(orders_data)} 个订单')



                # 如果Alpaca返回空数组，直接返回空数组

                if len(orders_data) == 0:

                    print('Alpaca API 返回空订单数据，返回空数组')

                    return jsonify({

                        'success': True,

                        'data': [],

                        'count': 0,

                        'limit': limit,

                        'status_filter': status,

                        'isMockData': False,

                        'message': 'Alpaca账户没有订单'

                    })



                # 处理真实数据

                formatted_orders = []

                for order in orders_data:

                    # 规范化字段名，同时提供驼峰式和下划线式

                    formatted_order = {

                        'id': order.get('id', ''),

                        'symbol': order.get('symbol', ''),

                        'qty': float(order.get('qty', 0)) if order.get('qty') else 0,

                        'quantity': float(order.get('qty', 0)) if order.get('qty') else 0,  # 前端使用的字段

                        'filled_qty': float(order.get('filled_qty', 0)) if order.get('filled_qty') else 0,

                        'filledQty': float(order.get('filled_qty', 0)) if order.get('filled_qty') else 0,  # 前端使用的字段

                        'side': order.get('side', ''),

                        'type': order.get('type', ''),

                        'limit_price': float(order.get('limit_price', 0)) if order.get('limit_price') else None,

                        'limitPrice': float(order.get('limit_price', 0)) if order.get('limit_price') else None,  # 前端使用的字段

                        'filled_avg_price': float(order.get('filled_avg_price', 0)) if order.get('filled_avg_price') else None,

                        'filledAvgPrice': float(order.get('filled_avg_price', 0)) if order.get('filled_avg_price') else None,  # 前端使用的字段

                        'status': order.get('status', ''),

                        # 时间字段 - 优先级: submitted_at > created_at > updated_at

                        'submitted_at': order.get('submitted_at', order.get('created_at', '')),

                        'submittedAt': order.get('submitted_at', order.get('created_at', '')),  # 前端使用的字段

                        'created_at': order.get('created_at', ''),

                        'createdAt': order.get('created_at', ''),  # 前端使用的字段

                        'updated_at': order.get('updated_at', ''),

                        'updatedAt': order.get('updated_at', ''),  # 前端使用的字段

                        'filled_at': order.get('filled_at', ''),

                        'filledAt': order.get('filled_at', ''),  # 前端使用的字段

                        'canceled_at': order.get('canceled_at', ''),

                        'canceledAt': order.get('canceled_at', ''),  # 前端使用的字段

                        'time_in_force': order.get('time_in_force', ''),

                        'timeInForce': order.get('time_in_force', ''),  # 前端使用的字段

                        'isMockData': False  # 真实数据

                    }

                    formatted_orders.append(formatted_order)



                return jsonify({

                    'success': True,

                    'data': formatted_orders,

                    'count': len(formatted_orders),

                    'status_filter': status,

                    'limit': limit,

                    'isMockData': False

                })

            else:

                print(f'Alpaca 订单 API 调用失败: {response.status_code} - {response.text}')

                # API调用失败时返回空数据

                return jsonify({

                    'success': True,

                    'data': [],

                    'count': 0,

                    'limit': limit,

                    'status_filter': status,

                    'isMockData': False,

                    'message': f'Alpaca API 调用失败 ({response.status_code})'

                })



        except Exception as e:

            print(f'Alpaca API 调用异常: {e}')

            import traceback

            traceback.print_exc()

            # API调用失败时返回空数据

            return jsonify({

                'success': True,

                'data': [],

                'count': 0,

                'limit': limit,

                'status_filter': status,

                'isMockData': False,

                'message': f'Alpaca API 调用异常: {str(e)}'

            })

            formatted_orders = []

            for order in orders_data:

                # 规范化字段名，同时提供驼峰式和下划线式

                formatted_order = {

                    'id': order.get('id', ''),

                    'symbol': order.get('symbol', ''),

                    'qty': float(order.get('qty', 0)),

                    'quantity': float(order.get('qty', 0)),  # 前端使用的字段

                    'filled_qty': float(order.get('filled_qty', 0)),

                    'filledQty': float(order.get('filled_qty', 0)),  # 前端使用的字段

                    'side': order.get('side', ''),

                    'type': order.get('type', ''),

                    'limit_price': float(order.get('limit_price', 0)) if order.get('limit_price') else None,

                    'limitPrice': float(order.get('limit_price', 0)) if order.get('limit_price') else None,  # 前端使用的字段

                    'filled_avg_price': float(order.get('filled_avg_price', 0)) if order.get('filled_avg_price') else None,

                    'filledAvgPrice': float(order.get('filled_avg_price', 0)) if order.get('filled_avg_price') else None,  # 前端使用的字段

                    'status': order.get('status', ''),

                    # 时间字段 - 优先级: submitted_at > created_at > updated_at

                    'submitted_at': order.get('submitted_at', order.get('created_at', '')),

                    'submittedAt': order.get('submitted_at', order.get('created_at', '')),  # 前端使用的字段

                    'created_at': order.get('created_at', ''),

                    'createdAt': order.get('created_at', ''),  # 前端使用的字段

                    'updated_at': order.get('updated_at', ''),

                    'updatedAt': order.get('updated_at', ''),  # 前端使用的字段

                    'filled_at': order.get('filled_at', ''),

                    'filledAt': order.get('filled_at', ''),  # 前端使用的字段

                    'canceled_at': order.get('canceled_at', ''),

                    'canceledAt': order.get('canceled_at', ''),  # 前端使用的字段

                    'time_in_force': order.get('time_in_force', ''),

                    'timeInForce': order.get('time_in_force', ''),  # 前端使用的字段

                    'isMockData': len(orders_data) > 0 and orders_data[0].get('id', '').startswith('test-open-order-')  # 如果是测试数据，标记为模拟

                }

                formatted_orders.append(formatted_order)



            return jsonify({

                'success': True,

                'data': formatted_orders,

                'count': len(formatted_orders),

                'status_filter': status,

                'limit': limit,

                'isMockData': len(formatted_orders) > 0 and formatted_orders[0].get('isMockData', False)

            })

        else:

            print(f'Alpaca 订单 API 调用失败: {response.status_code} - {response.text}')

            # API调用失败时返回模拟数据

            response = {

                'success': True,

                'data': [

                    {

                        'id': 'order-002',

                        'symbol': 'NVDA',

                        'qty': 2,

                        'filled_qty': 0,

                        'filledQty': 0,

                        'side': 'buy',

                        'type': 'limit',

                        'limit_price': 950.00,

                        'limitPrice': 950.00,

                        'status': 'accepted',

                        'created_at': '2026-04-05T10:30:00Z',

                        'createdAt': '2026-04-05T10:30:00Z',

                        'time_in_force': 'gtc',

                        'timeInForce': 'gtc',

                        'isMockData': True

                    },

                    {

                        'id': 'order-003',

                        'symbol': 'GOOGL',

                        'qty': 3,

                        'filled_qty': 0,

                        'filledQty': 0,

                        'side': 'buy',

                        'type': 'market',

                        'status': 'accepted',

                        'created_at': '2026-04-05T11:15:00Z',

                        'createdAt': '2026-04-05T11:15:00Z',

                        'time_in_force': 'day',

                        'timeInForce': 'day',

                        'isMockData': True

                    }

                ],

                'count': 2,

                'status_filter': status,

                'limit': limit,

                'isMockData': True,

                'message': f'Alpaca API 调用失败 ({response.status_code})，显示模拟订单数据'

            }

            return jsonify(response)



    except Exception as e:

        print(f'Alpaca 订单接口错误: {e}')

        response = {

            'success': True,

            'data': [

                {

                    'id': 'order-002',

                    'symbol': 'NVDA',

                    'qty': 2,

                    'filled_qty': 0,

                    'filledQty': 0,

                    'side': 'buy',

                    'type': 'limit',

                    'limit_price': 950.00,

                    'limitPrice': 950.00,

                    'status': 'accepted',

                    'created_at': '2026-04-05T10:30:00Z',

                    'createdAt': '2026-04-05T10:30:00Z',

                    'time_in_force': 'gtc',

                    'timeInForce': 'gtc',

                    'isMockData': True

                },

                {

                    'id': 'order-003',

                    'symbol': 'GOOGL',

                    'qty': 3,

                    'filled_qty': 0,

                    'filledQty': 0,

                    'side': 'buy',

                    'type': 'market',

                    'status': 'accepted',

                    'created_at': '2026-04-05T11:15:00Z',

                    'createdAt': '2026-04-05T11:15:00Z',

                    'time_in_force': 'day',

                    'timeInForce': 'day',

                    'isMockData': True

                }

            ],

            'count': 2,

            'status_filter': status,

            'limit': limit,

            'isMockData': True,

            'message': f'接口异常: {str(e)}，显示模拟订单数据'

        }

        return jsonify(response)



def ai_alpaca_place_order():

    """处理 Alpaca 下单请求"""

    import sys

    print('=== AI Alpaca 下单请求 ===', file=sys.stderr)

    print('=== AI Alpaca 下单请求 ===')



    try:

        # 获取订单数据

        data = request.get_json()

        print(f'下单数据: {data}')



        # 验证必要字段

        required_fields = ['symbol', 'side', 'qty', 'type']

        for field in required_fields:

            if field not in data:

                return jsonify({

                    'success': False,

                    'error': f'Missing required field: {field}'

                }), 400



        # 尝试使用真实的 Alpaca API

        environment = alpaca_config_state.get('environment', 'paper')



        if environment == 'paper':

            api_key = alpaca_config_state.get('paper_api_key')

            api_secret = alpaca_config_state.get('paper_api_secret')

            base_url = 'https://paper-api.alpaca.markets'

        else:

            api_key = alpaca_config_state.get('live_api_key')

            api_secret = alpaca_config_state.get('live_api_secret')

            base_url = 'https://api.alpaca.markets'



        # 检查API密钥

        if not api_key or not api_secret:

            print('Alpaca API 密钥未配置，无法下单')

            return jsonify({

                'success': False,

                'error': 'Alpaca API keys not configured'

            }), 400



        # 构建 Alpaca API 请求

        import requests



        headers = {

            'APCA-API-KEY-ID': api_key,

            'APCA-API-SECRET-KEY': api_secret,

            'Content-Type': 'application/json'

        }



        # 构建订单请求体

        order_payload = {

            'symbol': data['symbol'].upper(),

            'side': data['side'],

            'qty': str(data['qty']),

            'type': data['type'],

            'time_in_force': data.get('time_in_force', 'day')

        }



        # 添加可选字段

        if data['type'] == 'limit' and 'limit_price' in data:

            order_payload['limit_price'] = str(data['limit_price'])



        print(f'发送到 Alpaca 的订单: {order_payload}')



        # 发送下单请求

        response = requests.post(

            f'{base_url}/v2/orders',

            headers=headers,

            json=order_payload,

            timeout=30

        )



        print(f'Alpaca API 响应状态: {response.status_code}')

        print(f'Alpaca API 响应内容: {response.text}')



        if response.status_code == 200:

            order_data = response.json()

            print(f'下单成功，订单ID: {order_data.get("id")}')



            return jsonify({

                'success': True,

                'order': order_data,

                'message': 'Order placed successfully'

            })

        else:

            error_msg = f'Alpaca API error: {response.status_code} - {response.text}'

            print(error_msg)

            return jsonify({

                'success': False,

                'error': error_msg

            }), 400



    except Exception as e:

        error_msg = f'下单异常: {str(e)}'

        print(error_msg)

        import traceback

        traceback.print_exc()



        return jsonify({

            'success': False,

            'error': error_msg

        }), 500



@app.route('/api/ai/alpaca/orders/history', methods=['GET'])

def ai_alpaca_orders_history():

    import sys

    print('=== AI Alpaca 历史订单请求 ===', file=sys.stderr)

    print('=== AI Alpaca 历史订单请求 ===')

    limit = request.args.get('limit', '50')

    status = request.args.get('status', 'all')



    try:

        # 尝试使用真实的 Alpaca API

        environment = alpaca_config_state.get('environment', 'paper')



        if environment == 'paper':

            api_key = alpaca_config_state.get('paper_api_key')

            api_secret = alpaca_config_state.get('paper_api_secret')

            base_url = 'https://paper-api.alpaca.markets'

        else:

            api_key = alpaca_config_state.get('live_api_key')

            api_secret = alpaca_config_state.get('live_api_secret')

            base_url = 'https://api.alpaca.markets'



        # 如果没有配置API密钥，返回空数据

        if not api_key or not api_secret:

            print('=== DEBUG: Alpaca API 密钥检查 ===')

            print(f'API Key 存在: {bool(api_key)}')

            print(f'API Secret 存在: {bool(api_secret)}')

            print(f'环境: {environment}')

            print(f'API Key 前10位: {api_key[:10] if api_key else "N/A"}')

            print('=== DEBUG 结束 ===')

            print('Alpaca API 密钥未配置，返回空数据')

            response = {

                'success': True,

                'data': [],

                'count': 0,

                'limit': limit,

                'status_filter': status,

                'isMockData': False,

                'message': 'Alpaca API 密钥未配置'

            }

            return jsonify(response)



        # 调用真实的 Alpaca API

        headers = {

            'APCA-API-KEY-ID': api_key,

            'APCA-API-SECRET-KEY': api_secret

        }



        # 构建查询参数 - 使用最简单的参数

        params = {

            'limit': min(int(limit), 100),  # Alpaca最大限制100

            'direction': 'desc',

            'status': status  # 总是添加status参数，包括'all'

        }



        print(f'调用真实 Alpaca API 获取历史订单: {base_url}/v2/orders')

        print(f'查询参数: {params}')

        print(f'环境: {environment}')

        print(f'API密钥: {api_key[:6]}...{api_key[-4:]}')

        print(f'API Secret: {api_secret[:6]}...{api_secret[-4:]}')



        # 先调用/v2/account获取账户信息

        try:

            account_response = requests.get(f'{base_url}/v2/account', headers=headers, timeout=10)

            if account_response.status_code == 200:

                account_data = account_response.json()

                print(f'账户信息: account_number={account_data.get("account_number")}, id={account_data.get("id")}')

            else:

                print(f'获取账户信息失败: {account_response.status_code}')

        except Exception as e:

            print(f'获取账户信息异常: {e}')



        try:

            response = requests.get(f'{base_url}/v2/orders', headers=headers, params=params, timeout=10)



            print(f'Alpaca API 响应状态码: {response.status_code}')

            print(f'Alpaca API 响应内容前500字符: {response.text[:500]}...')



            if response.status_code == 200:

                orders_data = response.json()

                print(f'获取到真实历史订单数据: {len(orders_data)} 个订单')



                # 如果Alpaca返回空数组，直接返回空数组

                if len(orders_data) == 0:

                    print('Alpaca API 返回空订单数据，返回空数组')

                    return jsonify({

                        'success': True,

                        'data': [],

                        'count': 0,

                        'limit': limit,

                        'status_filter': status,

                        'isMockData': False,

                        'message': 'Alpaca账户没有历史订单'

                    })



                # 处理真实数据

                formatted_orders = []

                for order in orders_data:

                    # 规范化字段名，同时提供驼峰式和下划线式

                    formatted_order = {

                        'id': order.get('id', ''),

                        'symbol': order.get('symbol', ''),

                        'qty': float(order.get('qty', 0)) if order.get('qty') else 0,

                        'quantity': float(order.get('qty', 0)) if order.get('qty') else 0,  # 前端使用的字段

                        'filled_qty': float(order.get('filled_qty', 0)) if order.get('filled_qty') else 0,

                        'filledQty': float(order.get('filled_qty', 0)) if order.get('filled_qty') else 0,  # 前端使用的字段

                        'side': order.get('side', ''),

                        'type': order.get('type', ''),

                        'limit_price': float(order.get('limit_price', 0)) if order.get('limit_price') else None,

                        'limitPrice': float(order.get('limit_price', 0)) if order.get('limit_price') else None,  # 前端使用的字段

                        'filled_avg_price': float(order.get('filled_avg_price', 0)) if order.get('filled_avg_price') else None,

                        'filledAvgPrice': float(order.get('filled_avg_price', 0)) if order.get('filled_avg_price') else None,  # 前端使用的字段

                        'status': order.get('status', ''),

                        # 时间字段 - 优先级: submitted_at > created_at > updated_at

                        'submitted_at': order.get('submitted_at', order.get('created_at', '')),

                        'submittedAt': order.get('submitted_at', order.get('created_at', '')),  # 前端使用的字段

                        'created_at': order.get('created_at', ''),

                        'createdAt': order.get('created_at', ''),  # 前端使用的字段

                        'updated_at': order.get('updated_at', ''),

                        'updatedAt': order.get('updated_at', ''),  # 前端使用的字段

                        'filled_at': order.get('filled_at', ''),

                        'filledAt': order.get('filled_at', ''),  # 前端使用的字段

                        'canceled_at': order.get('canceled_at', ''),

                        'canceledAt': order.get('canceled_at', ''),  # 前端使用的字段

                        'time_in_force': order.get('time_in_force', ''),

                        'timeInForce': order.get('time_in_force', ''),  # 前端使用的字段

                        'isMockData': False  # 真实数据

                    }

                    formatted_orders.append(formatted_order)



                return jsonify({

                    'success': True,

                    'data': formatted_orders,

                    'count': len(formatted_orders),

                    'limit': limit,

                    'status_filter': status,

                    'isMockData': False

                })

            else:

                print(f'Alpaca 历史订单 API 调用失败: {response.status_code} - {response.text}')

                # API调用失败时返回空数据

                return jsonify({

                    'success': True,

                    'data': [],

                    'count': 0,

                    'limit': limit,

                    'status_filter': status,

                    'isMockData': False,

                    'message': f'Alpaca API 调用失败 ({response.status_code})'

                })



        except Exception as e:

            print(f'Alpaca API 调用异常: {e}')

            import traceback

            traceback.print_exc()

            # API调用失败时返回空数据

            return jsonify({

                'success': True,

                'data': [],

                'count': 0,

                'limit': limit,

                'status_filter': status,

                'isMockData': False,

                'message': f'Alpaca API 调用异常: {str(e)}'

            })







            formatted_orders = []

            for order in orders_data:

                # 规范化字段名，同时提供驼峰式和下划线式

                formatted_order = {

                    'id': order.get('id', ''),

                    'symbol': order.get('symbol', ''),

                    'qty': float(order.get('qty', 0)),

                    'quantity': float(order.get('qty', 0)),  # 前端使用的字段

                    'filled_qty': float(order.get('filled_qty', 0)),

                    'filledQty': float(order.get('filled_qty', 0)),  # 前端使用的字段

                    'side': order.get('side', ''),

                    'type': order.get('type', ''),

                    'limit_price': float(order.get('limit_price', 0)) if order.get('limit_price') else None,

                    'limitPrice': float(order.get('limit_price', 0)) if order.get('limit_price') else None,  # 前端使用的字段

                    'filled_avg_price': float(order.get('filled_avg_price', 0)) if order.get('filled_avg_price') else None,

                    'filledAvgPrice': float(order.get('filled_avg_price', 0)) if order.get('filled_avg_price') else None,  # 前端使用的字段

                    'status': order.get('status', ''),

                    # 时间字段 - 优先级: submitted_at > created_at > updated_at

                    'submitted_at': order.get('submitted_at', order.get('created_at', '')),

                    'submittedAt': order.get('submitted_at', order.get('created_at', '')),  # 前端使用的字段

                    'created_at': order.get('created_at', ''),

                    'createdAt': order.get('created_at', ''),  # 前端使用的字段

                    'updated_at': order.get('updated_at', ''),

                    'updatedAt': order.get('updated_at', ''),  # 前端使用的字段

                    'filled_at': order.get('filled_at', ''),

                    'filledAt': order.get('filled_at', ''),  # 前端使用的字段

                    'canceled_at': order.get('canceled_at', ''),

                    'canceledAt': order.get('canceled_at', ''),  # 前端使用的字段

                    'time_in_force': order.get('time_in_force', ''),

                    'timeInForce': order.get('time_in_force', ''),  # 前端使用的字段

                    'isMockData': len(orders_data) > 0 and orders_data[0].get('id', '').startswith('test-order-')  # 如果是测试数据，标记为模拟

                }

                formatted_orders.append(formatted_order)



            return jsonify({

                'success': True,

                'data': formatted_orders,

                'count': len(formatted_orders),

                'limit': limit,

                'status_filter': status,

                'isMockData': len(formatted_orders) > 0 and formatted_orders[0].get('isMockData', False)

            })

        else:

            print(f'Alpaca 历史订单 API 调用失败: {response.status_code} - {response.text}')

            # API调用失败时返回模拟数据

            import random

            import datetime

            data = []



            # 生成更真实的模拟数据

            statuses = ['filled', 'canceled', 'expired', 'rejected', 'accepted', 'pending_new', 'pending_cancel', 'stopped', 'suspended', 'calculated']

            sides = ['buy', 'sell']

            types = ['market', 'limit', 'stop', 'stop_limit']

            symbols = ['AAPL', 'MSFT', 'GOOGL', 'NVDA', 'TSLA', 'AMZN', 'META', 'NFLX', 'AMD', 'INTC']



            for i in range(min(int(limit), 30)):

                symbol = symbols[i % len(symbols)]

                qty = (i % 20) + 1

                filled_qty = qty if i % 4 == 0 else (qty // 2 if i % 3 == 0 else 0)

                status_idx = i % len(statuses)

                order_status = statuses[status_idx]



                # 生成更真实的时间戳

                days_ago = i % 30

                hours_ago = i % 24

                minutes_ago = i % 60

                created_at = (datetime.datetime.now() - datetime.timedelta(days=days_ago, hours=hours_ago, minutes=minutes_ago)).isoformat() + 'Z'



                data.append({

                    'id': f'order-{i:04d}',

                    'symbol': symbol,

                    'qty': qty,

                    'quantity': qty,  # 前端使用的字段

                    'filled_qty': filled_qty,

                    'filledQty': filled_qty,  # 前端使用的字段

                    'side': sides[i % 2],

                    'type': types[i % len(types)],

                    'limit_price': 100.0 + (i * 5) if i % 3 != 0 else None,

                    'limitPrice': 100.0 + (i * 5) if i % 3 != 0 else None,  # 前端使用的字段

                    'status': order_status,

                    'created_at': created_at,

                    'createdAt': created_at,  # 前端使用的字段

                    'time_in_force': 'gtc',

                    'timeInForce': 'gtc',  # 前端使用的字段

                    'isMockData': True

                })



            response = {

                'success': True,

                'data': data,

                'count': len(data),

                'limit': limit,

                'status_filter': status,

                'isMockData': True,

                'message': f'Alpaca API 调用失败 ({response.status_code})，显示模拟历史订单数据'

            }

            return jsonify(response)



    except Exception as e:

        print(f'Alpaca 历史订单接口错误: {e}')

        import random

        import datetime

        data = []



        # 生成更真实的模拟数据

        statuses = ['filled', 'canceled', 'expired', 'rejected', 'accepted', 'pending_new', 'pending_cancel', 'stopped', 'suspended', 'calculated']

        sides = ['buy', 'sell']

        types = ['market', 'limit', 'stop', 'stop_limit']

        symbols = ['AAPL', 'MSFT', 'GOOGL', 'NVDA', 'TSLA', 'AMZN', 'META', 'NFLX', 'AMD', 'INTC']



        for i in range(min(int(limit), 30)):

            symbol = symbols[i % len(symbols)]

            qty = (i % 20) + 1

            filled_qty = qty if i % 4 == 0 else (qty // 2 if i % 3 == 0 else 0)

            status_idx = i % len(statuses)

            order_status = statuses[status_idx]



            # 生成更真实的时间戳

            days_ago = i % 30

            hours_ago = i % 24

            minutes_ago = i % 60

            created_at = (datetime.datetime.now() - datetime.timedelta(days=days_ago, hours=hours_ago, minutes=minutes_ago)).isoformat() + 'Z'



            data.append({

                'id': f'order-{i:04d}',

                'symbol': symbol,

                'qty': qty,

                'quantity': qty,  # 前端使用的字段

                'filled_qty': filled_qty,

                'filledQty': filled_qty,  # 前端使用的字段

                'side': sides[i % 2],

                'type': types[i % len(types)],

                'limit_price': 100.0 + (i * 5) if i % 3 != 0 else None,

                'limitPrice': 100.0 + (i * 5) if i % 3 != 0 else None,  # 前端使用的字段

                'status': order_status,

                'created_at': created_at,

                'createdAt': created_at,  # 前端使用的字段

                'time_in_force': 'gtc',

                'timeInForce': 'gtc',  # 前端使用的字段

                'isMockData': True

            })



        response = {

            'success': True,

            'data': data,

            'count': len(data),

            'limit': limit,

            'status_filter': status,

            'isMockData': True,

            'message': f'接口异常: {str(e)}，显示模拟历史订单数据'

        }

        return jsonify(response)



@app.route('/api/ai/chat', methods=['POST'])

def ai_chat():

    print('=== AI Chat 请求 ===')

    try:

        data = request.get_json()

        message = data.get('message', '')

        symbol = data.get('symbol', '')

        history = data.get('history', [])



        print(f'收到消息: {message}')

        print(f'符号: {symbol}')

        print(f'历史记录长度: {len(history)}')



        # 检查是否有有效的 API 密钥

        api_key = ai_provider_config_state.get('apiKey', '')



        if not api_key or api_key.startswith('sk-') and len(api_key) < 30:

            # 没有有效 API 密钥，返回模拟回复

            print('没有有效的 DeepSeek API 密钥，返回模拟回复')

            ai_response = get_mock_response(message)

            return jsonify({

                'success': True,

                'response': ai_response,

                'timestamp': time.time(),

                'strategy_updated': False,

                'new_strategy_state': None,

                'isMockResponse': True,

                'message': 'DeepSeek API 密钥未配置或无效，返回模拟回复'

            })



        # 如果有有效的 API 密钥，调用真实的 DeepSeek API

        print(f'使用 API 密钥调用 DeepSeek: {api_key[:10]}...')



        # 构建请求

        headers = {

            'Authorization': f'Bearer {api_key}',

            'Content-Type': 'application/json'

        }



        # 构建消息历史

        messages = []

        # 添加历史消息

        for h in history[-10:]:  # 只保留最近10条历史

            if h.get('role') == 'user':

                messages.append({'role': 'user', 'content': h.get('content', '')})

            elif h.get('role') == 'ai':

                messages.append({'role': 'assistant', 'content': h.get('content', '')})



        # 添加当前消息

        messages.append({'role': 'user', 'content': message})



        # 构建请求体

        payload = {

            'model': ai_provider_config_state.get('model', 'deepseek-chat'),

            'messages': messages,

            'max_tokens': 1000,

            'temperature': 0.7

        }



        base_url = ai_provider_config_state.get('baseURL', 'https://api.deepseek.com')

        if not base_url.startswith('http'):

            base_url = 'https://' + base_url



        # 调用 DeepSeek API

        try:

            response = requests.post(

                f'{base_url}/chat/completions',

                headers=headers,

                json=payload,

                timeout=30

            )



            if response.status_code == 200:

                result = response.json()

                ai_response = result['choices'][0]['message']['content']

                print(f'DeepSeek API 调用成功，返回真实回复')



                return jsonify({

                    'success': True,

                    'response': ai_response,

                    'timestamp': time.time(),

                    'strategy_updated': False,

                    'new_strategy_state': None,

                    'isMockResponse': False,

                    'message': 'DeepSeek API 调用成功'

                })

            else:

                print(f'DeepSeek API 调用失败: {response.status_code} - {response.text}')

                # API调用失败时返回模拟回复

                ai_response = get_mock_response(message)

                return jsonify({

                    'success': True,

                    'response': ai_response,

                    'timestamp': time.time(),

                    'strategy_updated': False,

                    'new_strategy_state': None,

                    'isMockResponse': True,

                    'message': f'DeepSeek API 调用失败 ({response.status_code})，返回模拟回复'

                })



        except Exception as api_error:

            print(f'DeepSeek API 调用异常: {api_error}')

            # API调用异常时返回模拟回复

            ai_response = get_mock_response(message)

            return jsonify({

                'success': True,

                'response': ai_response,

                'timestamp': time.time(),

                'strategy_updated': False,

                'new_strategy_state': None,

                'isMockResponse': True,

                'message': f'DeepSeek API 调用异常: {str(api_error)[:100]}'

            })



    except Exception as e:

        print(f'AI Chat 错误: {e}')

        # 异常时返回模拟回复

        ai_response = f"处理消息时发生错误，当前为模拟回复。\n错误: {str(e)[:100]}"

        return jsonify({

            'success': True,

            'response': ai_response,

            'timestamp': time.time(),

            'strategy_updated': False,

            'new_strategy_state': None,

            'isMockResponse': True

        })



# ==================== AI Trading 分析接口 ====================



@app.route('/api/ai/trade/preview', methods=['POST'])

def ai_trade_preview():

    print('=== AI Trade Preview 请求 ===')

    try:

        data = request.get_json()

        symbol = data.get('symbol', 'AAPL')



        print(f'收到交易预览请求: {symbol}')



        # 检查是否有有效的 API 密钥

        api_key = ai_provider_config_state.get('apiKey', '')



        if not api_key or api_key.startswith('sk-') and len(api_key) < 30:

            # 没有有效 API 密钥，返回错误

            print('没有有效的 DeepSeek API 密钥，无法进行 AI 分析')

            return jsonify({

                'success': False,

                'validation': {

                    'is_valid': False,

                    'message': 'DeepSeek API 密钥未配置，无法进行 AI 分析'

                },

                'decision': {

                    'action': 'HOLD',

                    'symbol': symbol,

                    'qty': 0,

                    'confidence': 0,

                    'reason': 'AI 分析不可用：请配置 DeepSeek API 密钥',

                    'executable': False

                }

            })



        # 如果有有效的 API 密钥，调用 DeepSeek 进行交易分析

        print(f'使用 API 密钥进行交易分析: {api_key[:10]}...')



        # 构建请求

        headers = {

            'Authorization': f'Bearer {api_key}',

            'Content-Type': 'application/json'

        }



        # 构建分析提示

        analysis_prompt = f"""作为量化交易AI助手，请分析股票{symbol}的当前交易机会。



请提供：

1. 交易建议（BUY/SELL/HOLD）

2. 建议数量

3. 置信度（0-100%）

4. 简要理由

5. 是否可执行（基于风险检查）



请以JSON格式返回，包含以下字段：

- action: "BUY", "SELL", 或 "HOLD"

- symbol: 股票代码

- qty: 建议数量

- confidence: 置信度（0-1）

- reason: 简要理由

- executable: true/false

"""



        payload = {

            'model': ai_provider_config_state.get('model', 'deepseek-chat'),

            'messages': [{'role': 'user', 'content': analysis_prompt}],

            'max_tokens': 500,

            'temperature': 0.3

        }



        base_url = ai_provider_config_state.get('baseURL', 'https://api.deepseek.com')

        if not base_url.startswith('http'):

            base_url = 'https://' + base_url



        # 调用 DeepSeek API

        try:

            response = requests.post(

                f'{base_url}/chat/completions',

                headers=headers,

                json=payload,

                timeout=30

            )



            if response.status_code == 200:

                result = response.json()

                ai_response = result['choices'][0]['message']['content']

                print(f'DeepSeek 交易分析成功')



                # 解析 AI 响应（简化处理）

                import re

                import json as json_module



                try:

                    # 尝试从响应中提取 JSON

                    json_match = re.search(r'\{.*\}', ai_response, re.DOTALL)

                    if json_match:

                        decision_data = json_module.loads(json_match.group())

                    else:

                        # 如果找不到 JSON，创建默认决策

                        decision_data = {

                            'action': 'HOLD',

                            'symbol': symbol,

                            'qty': 0,

                            'confidence': 0.5,

                            'reason': ai_response[:200],

                            'executable': False

                        }

                except:

                    # 解析失败，创建默认决策

                    decision_data = {

                        'action': 'HOLD',

                        'symbol': symbol,

                        'qty': 0,

                        'confidence': 0.5,

                        'reason': 'AI 分析完成，但解析响应失败',

                        'executable': False

                    }



                return jsonify({

                    'success': True,

                    'decision': decision_data,

                    'validation': {

                        'is_valid': True,

                        'message': 'AI 分析完成'

                    },

                    'risk_checks': {

                        'passed': ['ai_analysis_completed'],

                        'blocked': [],

                        'executable': decision_data.get('executable', False)

                    },

                    'history_id': int(time.time())

                })

            else:

                print(f'DeepSeek API 调用失败: {response.status_code}')

                return jsonify({

                    'success': False,

                    'validation': {

                        'is_valid': False,

                        'message': f'AI 分析失败: DeepSeek API 错误 ({response.status_code})'

                    },

                    'decision': {

                        'action': 'HOLD',

                        'symbol': symbol,

                        'qty': 0,

                        'confidence': 0,

                        'reason': 'AI 分析服务暂时不可用',

                        'executable': False

                    }

                })



        except Exception as api_error:

            print(f'DeepSeek API 调用异常: {api_error}')

            return jsonify({

                'success': False,

                'validation': {

                    'is_valid': False,

                    'message': f'AI 分析失败: {str(api_error)[:100]}'

                },

                'decision': {

                    'action': 'HOLD',

                    'symbol': symbol,

                    'qty': 0,

                    'confidence': 0,

                    'reason': 'AI 分析服务异常',

                    'executable': False

                }

            })



    except Exception as e:

        print(f'AI Trade Preview 错误: {e}')

        return jsonify({

            'success': False,

            'validation': {

                'is_valid': False,

                'message': f'处理请求时发生错误: {str(e)[:100]}'

            },

            'decision': {

                'action': 'HOLD',

                'symbol': 'UNKNOWN',

                'qty': 0,

                'confidence': 0,

                'reason': '处理请求时发生错误',

                'executable': False

            }

        })



@app.route('/api/ai/trade/analyze-with-context', methods=['POST'])

def ai_trade_analyze_with_context():

    print('=== AI Trade Analyze with Context 请求 ===')

    try:

        data = request.get_json()

        symbol = data.get('symbol', 'AAPL')

        context = data.get('context', {})



        print(f'收到带上下文的AI分析请求: {symbol}')

        print(f'上下文数据摘要:')

        print(f'  - 账户快照: {context.get("accountSnapshot", {}).get("portfolioValue", "N/A")}')

        print(f'  - 持仓数量: {len(context.get("positions", []))}')

        print(f'  - 未平仓订单: {len(context.get("openOrders", []))}')

        print(f'  - 订单历史: {len(context.get("orderHistory", []))}')

        print(f'  - 交易环境: {context.get("tradingEnvironment", "paper")}')



        # 检查是否有有效的 API 密钥

        api_key = ai_provider_config_state.get('apiKey', '')



        if not api_key or api_key.startswith('sk-') and len(api_key) < 30:

            # 没有有效 API 密钥，返回明确失败

            print('没有有效的 DeepSeek API 密钥，AI分析无法进行')

            return jsonify({

                'success': False,

                'validation': {

                    'is_valid': False,

                    'message': '没有有效的 DeepSeek API 密钥'

                },

                'decision': {

                    'action': 'ERROR',

                    'symbol': symbol,

                    'confidence': 0,

                    'reason': 'No valid DeepSeek API key configured',

                    'executable': False

                }

            })



        # 如果有有效的 API 密钥，调用 DeepSeek 进行带上下文的交易分析

        print(f'使用 API 密钥进行带上下文的交易分析: {api_key[:10]}...')



        # 构建请求

        headers = {

            'Authorization': f'Bearer {api_key}',

            'Content-Type': 'application/json'

        }



        # 构建详细的上下文分析提示

        analysis_prompt = build_context_analysis_prompt(symbol, context)



        payload = {

            'model': ai_provider_config_state.get('model', 'deepseek-chat'),

            'messages': [{'role': 'user', 'content': analysis_prompt}],

            'max_tokens': 1000,

            'temperature': 0.2,

            'response_format': {'type': 'json_object'}

        }



        base_url = ai_provider_config_state.get('baseURL', 'https://api.deepseek.com')

        if not base_url.startswith('http'):

            base_url = 'https://' + base_url



        # 调用 DeepSeek API

        try:

            response = requests.post(

                f'{base_url}/chat/completions',

                headers=headers,

                json=payload,

                timeout=30

            )



            if response.status_code == 200:

                result = response.json()

                ai_response = result['choices'][0]['message']['content']

                print(f'DeepSeek 带上下文分析成功')



                # 解析 AI 响应为 JSON

                import json as json_module

                try:

                    decision_data = json_module.loads(ai_response)



                    # 确保必要的字段存在 - 支持新旧字段格式

                    # 兼容性处理：如果只有旧字段，映射到新字段

                    if 'signalAction' not in decision_data and 'action' in decision_data:

                        decision_data['signalAction'] = decision_data['action']

                    if 'executionAction' not in decision_data:

                        decision_data['executionAction'] = decision_data.get('signalAction', decision_data.get('action', 'HOLD'))

                    if 'reasonSummary' not in decision_data and 'reason' in decision_data:

                        # 从完整reason中提取简短摘要

                        full_reason = decision_data['reason']

                        if len(full_reason) > 100:

                            decision_data['reasonSummary'] = full_reason[:100] + '...'

                        else:

                            decision_data['reasonSummary'] = full_reason

                    if 'reasoningFull' not in decision_data:

                        decision_data['reasoningFull'] = decision_data.get('reason', 'No detailed reasoning available')

                    if 'recommendedQty' not in decision_data:

                        decision_data['recommendedQty'] = decision_data.get('positionSize', decision_data.get('qty', 0))

                    if 'riskNote' not in decision_data:

                        decision_data['riskNote'] = f"Risk level: {decision_data.get('riskLevel', 'MEDIUM')}"

                    if 'whyNotOtherActions' not in decision_data:

                        decision_data['whyNotOtherActions'] = 'Not provided in analysis'

                    

                    # 确保核心字段存在

                    required_fields = ['signalAction', 'executionAction', 'symbol', 'confidence', 'reasoningFull']

                    for field in required_fields:

                        if field not in decision_data:

                            if field == 'signalAction':

                                decision_data[field] = 'HOLD'

                            elif field == 'executionAction':

                                decision_data[field] = decision_data.get('signalAction', 'HOLD')

                            elif field == 'symbol':

                                decision_data[field] = symbol

                            elif field == 'confidence':

                                decision_data[field] = 0.5

                            elif field == 'reasoningFull':

                                decision_data[field] = 'AI analysis completed'



                    # 添加额外字段

                    decision_data['executable'] = decision_data.get('executable', True)

                    decision_data['positionSize'] = decision_data.get('recommendedQty', 0)

                    decision_data['entry'] = decision_data.get('entry', 'N/A')

                    decision_data['stopLoss'] = decision_data.get('stopLoss', 'N/A')

                    decision_data['takeProfit'] = decision_data.get('takeProfit', 'N/A')

                    decision_data['riskLevel'] = decision_data.get('riskLevel', 'MEDIUM')

                    decision_data['timeFrame'] = decision_data.get('timeFrame', 'Intraday')

                    

                    # 确保action字段存在以兼容前端（使用executionAction作为主要action）

                    decision_data['action'] = decision_data['executionAction']

                    decision_data['reason'] = decision_data.get('reasonSummary', decision_data.get('reasoningFull', '')[:100] + '...')



                    return jsonify({

                        'success': True,

                        'decision': decision_data,

                        'validation': {

                            'is_valid': True,

                            'message': 'AI 分析完成（带上下文）'

                        },

                        'risk_checks': {

                            'passed': ['ai_analysis_completed', 'context_analysis'],

                            'blocked': [],

                            'executable': decision_data.get('executable', False)

                        },

                        'history_id': int(time.time())

                    })



                except json_module.JSONDecodeError as json_error:

                    print(f'解析 AI 响应 JSON 失败: {json_error}')

                    # 不再返回本地规则分析，返回明确失败

                    return jsonify({

                        'success': False,

                        'validation': {

                            'is_valid': False,

                            'message': f'AI 响应解析失败: {str(json_error)[:100]}'

                        },

                        'decision': {

                            'action': 'ERROR',

                            'symbol': symbol,

                            'confidence': 0,

                            'reason': f'DeepSeek response parsing failed: {str(json_error)[:100]}',

                            'executable': False

                        }

                    })



            else:

                print(f'DeepSeek API 调用失败: {response.status_code}')

                # 不再返回本地规则分析，返回明确失败

                return jsonify({

                    'success': False,

                    'validation': {

                        'is_valid': False,

                        'message': f'DeepSeek API 调用失败: {response.status_code}'

                    },

                    'decision': {

                        'action': 'ERROR',

                        'symbol': symbol,

                        'confidence': 0,

                        'reason': f'DeepSeek API call failed: {response.status_code}',

                        'executable': False

                    }

                })



        except Exception as api_error:

            print(f'DeepSeek API 调用异常: {api_error}')

            # 不再返回本地规则分析，返回明确失败

            return jsonify({

                'success': False,

                'validation': {

                    'is_valid': False,

                    'message': f'DeepSeek API 调用异常: {str(api_error)[:100]}'

                },

                'decision': {

                    'action': 'ERROR',

                    'symbol': symbol,

                    'confidence': 0,

                    'reason': f'DeepSeek API call exception: {str(api_error)[:100]}',

                    'executable': False

                }

            })



    except Exception as e:

        print(f'AI Trade Analyze with Context 错误: {e}')

        return jsonify({

            'success': False,

            'validation': {

                'is_valid': False,

                'message': f'AI分析请求处理错误: {str(e)[:100]}'

            },

            'decision': {

                'action': 'ERROR',

                'symbol': symbol,

                'confidence': 0,

                'reason': f'AI analysis request processing error: {str(e)[:100]}',

                'executable': False

            }

        })



def build_context_analysis_prompt(symbol, context):

    """Build AI analysis prompt with full trading context in English"""



    account = context.get('accountSnapshot', {})

    positions = context.get('positions', [])

    open_orders = context.get('openOrders', [])

    order_history = context.get('orderHistory', [])

    portfolio = context.get('portfolioPerformance', {})

    

    # Get market data, backtest results, and optimization results

    market_data = context.get('marketData', {})

    backtest_result = context.get('backtestResult', {})

    optimization_result = context.get('optimizationResult', {})



    prompt = f"""As a professional quantitative trading AI assistant, please analyze trading opportunities for stock {symbol} based on the following complete trading context.



## Current Stock Data - {symbol}



### Market Snapshot

- Current Price: ${market_data.get('price', 0):.2f}

- Today's Change: {market_data.get('changePercent', 0):.2f}%

- Today's Volume: {market_data.get('volume', 0):,.0f}

- Today's High: ${market_data.get('dayHigh', 0):.2f}

- Today's Low: ${market_data.get('dayLow', 0):.2f}



### Backtest Results Analysis (Recent 1 year, Moving Average Strategy)

"""

    

    # Add backtest results

    if backtest_result and backtest_result.get('results'):

        results = backtest_result.get('results', {})

        prompt += f"""- Total Return: {results.get('totalReturn', 0):.2f}%

- Sharpe Ratio: {results.get('sharpeRatio', 0):.2f}

- Maximum Drawdown: {results.get('maxDrawdown', 0):.2f}%

- Win Rate: {results.get('winRate', 0):.2f}%

- Number of Trades: {results.get('trades', 0)}

- Average Return per Trade: ${results.get('avgReturnPerTrade', 0):.2f}

"""

    else:

        prompt += "- Backtest data not available\n"

    

    prompt += f"""

### Parameter Optimization Results (Moving Average Strategy Optimization)

"""

    

    # Add optimization results

    if optimization_result and optimization_result.get('summary'):

        summary = optimization_result.get('summary', {})

        prompt += f"""- Best Score: {summary.get('bestScore', 0):.4f}

- Total Combinations: {summary.get('totalCombinations', 0)}

- Valid Combinations: {summary.get('validCombinations', 0)}

- Best Parameters: {summary.get('bestCombination', 'N/A')}

"""

    elif optimization_result and optimization_result.get('bestScore'):

        # Compatible with old format

        prompt += f"""- Best Score: {optimization_result.get('bestScore', 0):.4f}

- Total Combinations: {optimization_result.get('totalCombinations', 0)}

- Best Parameters: {optimization_result.get('bestCombination', 'N/A')}

"""

    else:

        prompt += "- Optimization data not available\n"



    prompt += f"""

## Trading Account Context



### Account Overview

- Account Cash: ${account.get('cash', 0):,.2f}

- Account Equity: ${account.get('equity', 0):,.2f}

- Buying Power: ${account.get('buyingPower', 0):,.2f}

- Portfolio Value: ${account.get('portfolioValue', 0):,.2f}

- Number of Positions: {account.get('positionsCount', 0)}

- Open Orders: {account.get('openOrdersCount', 0)}



### Current Positions ({len(positions)})

"""



    if positions:

        for i, pos in enumerate(positions[:5]):  # Show only first 5

            prompt += f"- {pos.get('symbol', 'N/A')}: {pos.get('qty', 0)} shares @ ${pos.get('avgPrice', 0):.2f} (Market Value: ${pos.get('marketValue', 0):,.2f})\n"

        if len(positions) > 5:

            prompt += f"- ... and {len(positions)-5} more positions\n"

    else:

        prompt += "- No positions\n"



    prompt += f"""

### Open Orders ({len(open_orders)})

"""



    if open_orders:

        for i, order in enumerate(open_orders[:3]):  # Show only first 3

            limit_price = order.get('limitPrice', 'market')

            price_str = f"@ ${limit_price}" if limit_price != 'market' else "@ market"

            prompt += f"- {order.get('symbol', 'N/A')}: {order.get('side', 'N/A')} {order.get('qty', 0)} shares {price_str} ({order.get('status', 'N/A')})\n"

        if len(open_orders) > 3:

            prompt += f"- ... and {len(open_orders)-3} more open orders\n"

    else:

        prompt += "- No open orders\n"



    prompt += f"""

### Recent Order History ({len(order_history)} records)

"""



    if order_history:

        for i, order in enumerate(order_history[:3]):  # Show only first 3

            prompt += f"- {order.get('symbol', 'N/A')}: {order.get('side', 'N/A')} {order.get('qty', 0)} shares ({order.get('status', 'N/A')})\n"

        if len(order_history) > 3:

            prompt += f"- ... and {len(order_history)-3} more historical records\n"

    else:

        prompt += "- No order history\n"



    prompt += f"""

### Portfolio Performance

- Current Time Range: {portfolio.get('currentRange', '1D')}

- Portfolio Change: ${portfolio.get('change', {}).get('value', 0):,.2f} ({portfolio.get('change', {}).get('percent', 0):.2f}%)



### Trading Environment

- Environment: {context.get('tradingEnvironment', 'paper')}

- AI Status: {context.get('aiStatus', {}).get('ai_status', 'idle')}



## Analysis Requirements



Please provide professional trading recommendations for {symbol} based on the complete trading context above.



Return in JSON format, must include the following fields:

- signalAction: "BUY", "SELL", or "HOLD" (primary trading signal based on market and technical analysis)

- executionAction: "BUY", "SELL", "HOLD" (execution decision based on account constraints)

- symbol: Stock symbol

- confidence: Confidence level (decimal between 0-1)

- reasonSummary: Short reason summary for scan summary display (max 50 words)

- reasoningFull: Detailed analysis reasoning (at least 150 words, in English)

- recommendedQty: Recommended number of shares to buy/sell (0 for HOLD, positive integer)

- riskNote: Risk assessment and position sizing note

- whyNotOtherActions: Explanation of why the other actions (BUY/SELL/HOLD) are not recommended

- executable: true/false (based on risk checks and account feasibility)

- positionSize: Recommended position size (number of shares) - same as recommendedQty

- entry: Recommended entry price (USD)

- stopLoss: Recommended stop loss price (USD)

- takeProfit: Recommended take profit price (USD)

- riskLevel: "LOW", "MEDIUM", or "HIGH"

- timeFrame: Recommended holding timeframe (e.g., "Intraday", "Swing", "Position")



## Analysis Guidelines



1. Signal vs Execution: signalAction is the ideal signal, executionAction considers account constraints

2. Consider current positions: If already holding {symbol}, consider whether to add, reduce, or hold

3. Position sizing (Critical): For BUY recommendations:

   - recommendedQty must be based on: current price, buying power, and risk assessment

   - Do NOT recommend buying more than available buying power allows

   - Conservative approach: Start with no more than 5-10% of buying power

   - Riskier stocks (high drawdown, low Sharpe): Recommend smaller quantities

   - Safer stocks (low drawdown, high Sharpe): Can recommend slightly larger but still conservative quantities

   - Always recommend integer number of shares

4. For SELL recommendations: recommendedQty must not exceed current position quantity

5. For HOLD: recommendedQty = 0

6. Consider market environment: This is a paper trading environment

7. Provide specific price targets: Based on technical analysis or fundamental analysis

8. Risk management: Provide clear stop loss and take profit prices

9. Explain reasoning: Include analysis of market data, backtest results, optimization results, and account context

10. Differentiate per symbol: Each stock's analysis should be unique based on its own data



Ensure recommendations are practical and feasible, taking into account all provided context information.

The final action recommendation must end with a clear statement: "Final Action: BUY/HOLD/SELL" in the reasoningFull field.

"""



    return prompt



def generate_context_based_analysis(symbol, context):

    """Generate simple analysis results based on context (when AI is unavailable)"""

    

    print(f"[Context Based Analysis] Generating real-data-based analysis for {symbol}")



    account = context.get('accountSnapshot', {})

    positions = context.get('positions', [])

    portfolio = context.get('portfolioPerformance', {})

    

    # 获取真实的市场数据、回测结果和优化结果

    market_data = context.get('marketData', {})

    backtest_result = context.get('backtestResult', {})

    optimization_result = context.get('optimizationResult', {})



    # 使用真实市场价格，如果没有则使用回测中的最后价格

    current_price = market_data.get('price')

    if not current_price and backtest_result and backtest_result.get('results'):

        # 尝试从回测结果中获取最后价格

        chart_data = backtest_result.get('chartData', [])

        if chart_data and len(chart_data) > 0:

            current_price = chart_data[-1].get('close', 150)

        else:

            current_price = 150  # 默认值

    

    # 提取回测关键指标

    backtest_total_return = 0

    backtest_sharpe = 0

    backtest_max_dd = 0

    backtest_win_rate = 0

    

    if backtest_result and backtest_result.get('results'):

        results = backtest_result.get('results', {})

        backtest_total_return = results.get('totalReturn', 0)

        backtest_sharpe = results.get('sharpeRatio', 0)

        backtest_max_dd = results.get('maxDrawdown', 0)

        backtest_win_rate = results.get('winRate', 0)

    

    # 提取优化结果

    optimization_best_score = 0

    optimization_best_params = {}

    

    if optimization_result:

        if optimization_result.get('summary'):

            summary = optimization_result.get('summary', {})

            optimization_best_score = summary.get('bestScore', 0)

            optimization_best_params = summary.get('bestCombination', {})

        else:

            # 兼容旧格式

            optimization_best_score = optimization_result.get('bestScore', 0)

            optimization_best_params = optimization_result.get('bestCombination', {})



    # 检查是否已有该股票的持仓

    existing_position = None

    for pos in positions:

        if pos.get('symbol') == symbol:

            existing_position = pos

            break



    # 基于真实数据分析生成决策

    if existing_position:

        # 已有持仓，基于回测结果和市场数据决定是否持有或卖出

        current_qty = existing_position.get('qty', 0)

        avg_price = existing_position.get('avgPrice', 0)

        market_value = existing_position.get('marketValue', 0)

        

        # 计算当前盈亏

        current_pnl_pct = ((current_price - avg_price) / avg_price * 100) if avg_price > 0 else 0

        

        # 决策逻辑：结合回测结果、当前盈亏和持仓比例

        position_ratio = market_value / account.get('portfolioValue', 100000) if account.get('portfolioValue', 100000) > 0 else 0

        

        if backtest_total_return > 20 and backtest_sharpe > 1.0:

            # Excellent backtest performance, continue holding

            action = 'HOLD'

            position_size = 0

            reason = f"{symbol} has existing position of {current_qty} shares (avg price ${avg_price:.2f}, current ${current_price:.2f}, P&L {current_pnl_pct:.1f}%). Backtest shows excellent performance: total return {backtest_total_return:.1f}%, Sharpe ratio {backtest_sharpe:.2f}, recommend continuing to hold."

        elif current_pnl_pct > 15 or position_ratio > 0.15:

            # High profit or large position ratio, recommend partial sell

            action = 'SELL'

            position_size = max(1, int(current_qty * 0.3))  # Sell 30%

            reason = f"{symbol} has existing position of {current_qty} shares (profit {current_pnl_pct:.1f}%, portfolio ratio {position_ratio*100:.1f}%). Backtest return {backtest_total_return:.1f}%, max drawdown {backtest_max_dd:.1f}%. Recommend partial profit taking."

        elif backtest_total_return < -10 and backtest_sharpe < 0:

            # Poor backtest performance, recommend selling

            action = 'SELL'

            position_size = current_qty  # Sell all

            reason = f"{symbol} has existing position but poor backtest performance: total return {backtest_total_return:.1f}%, Sharpe ratio {backtest_sharpe:.2f}. Recommend selling to avoid further losses."

        else:

            action = 'HOLD'

            position_size = 0

            reason = f"{symbol} has existing position of {current_qty} shares. Backtest return {backtest_total_return:.1f}%, Sharpe ratio {backtest_sharpe:.2f}, recommend continuing to hold and monitor."

    else:

        # 没有持仓，基于回测结果、优化结果和账户余额决定是否买入

        buying_power = account.get('buyingPower', 0)

        

        # 评估信号强度

        signal_strength = 0

        if backtest_total_return > 25 and backtest_sharpe > 1.5:

            signal_strength = 3  # 强买入信号

        elif backtest_total_return > 15 and backtest_sharpe > 1.0:

            signal_strength = 2  # 中等买入信号

        elif backtest_total_return > 0:

            signal_strength = 1  # 弱买入信号

        elif backtest_total_return < -20:

            signal_strength = -1  # 卖出信号

        

        if signal_strength >= 2 and buying_power > 2000:

            # Strong buy signal with sufficient buying power

            action = 'BUY'

            # Calculate position based on buying power and risk

            max_position_value = min(buying_power * 0.1, 5000)  # No more than 10% of buying power or $5000

            position_size = max(1, int(max_position_value / current_price))

            reason = f"{symbol} shows strong buy signal: backtest return {backtest_total_return:.1f}%, Sharpe ratio {backtest_sharpe:.2f}. Optimization best score {optimization_best_score:.4f}. Account buying power ${buying_power:,.0f}, recommend establishing position."

        elif signal_strength >= 1 and buying_power > 1000:

            # Weak buy signal

            action = 'BUY'

            max_position_value = min(buying_power * 0.05, 2500)  # No more than 5% of buying power or $2500

            position_size = max(1, int(max_position_value / current_price))

            reason = f"{symbol} shows buy signal: backtest return {backtest_total_return:.1f}%, Sharpe ratio {backtest_sharpe:.2f}. Account buying power ${buying_power:,.0f}, recommend small position."

        elif signal_strength <= -1:

            # Sell signal, but no position

            action = 'HOLD'

            position_size = 0

            reason = f"{symbol} shows poor backtest performance: total return {backtest_total_return:.1f}%, max drawdown {backtest_max_dd:.1f}%. No existing position, recommend monitoring."

        else:

            action = 'HOLD'

            position_size = 0

            reason = f"{symbol} shows unclear signal: backtest return {backtest_total_return:.1f}%, Sharpe ratio {backtest_sharpe:.2f}. Account buying power ${buying_power:,.0f}, recommend monitoring."



    # 基于当前价格生成价格建议

    entry_price = current_price

    if action == 'BUY':

        stop_loss = entry_price * 0.92  # 8%止损

        take_profit = entry_price * 1.12  # 12%止盈

    elif action == 'SELL':

        stop_loss = entry_price * 1.08  # 卖出时的止损（反向）

        take_profit = entry_price * 0.88  # 卖出时的止盈（反向）

    else:

        stop_loss = entry_price * 0.90

        take_profit = entry_price * 1.10



    # 根据回测结果调整置信度

    confidence = 0.5

    if abs(backtest_total_return) > 30 and abs(backtest_sharpe) > 1.5:

        confidence = 0.8

    elif abs(backtest_total_return) > 15 and abs(backtest_sharpe) > 0.8:

        confidence = 0.65

    elif action == 'HOLD':

        confidence = 0.5



    decision_data = {

        'action': action,

        'symbol': symbol,

        'confidence': confidence,

        'reason': reason + f" Current price ${current_price:.2f}. Final Action: {action}.",

        'executable': action != 'HOLD' and position_size > 0,

        'positionSize': position_size,

        'entry': f"{entry_price:.2f}",

        'stopLoss': f"{stop_loss:.2f}",

        'takeProfit': f"{take_profit:.2f}",

        'riskLevel': 'HIGH' if abs(backtest_total_return) > 40 else 'MEDIUM' if abs(backtest_total_return) > 20 else 'LOW',

        'timeFrame': 'Swing'

    }



    print(f"[Context Based Analysis] {symbol} analysis completed: {action}, confidence {confidence}, reason: {reason[:100]}...")



    return jsonify({

        'success': True,

        'decision': decision_data,

        'validation': {

            'is_valid': True,

            'message': '基于真实上下文的详细分析完成'

        },

        'risk_checks': {

            'passed': ['context_analysis_completed', 'real_data_used'],

            'blocked': [],

            'executable': decision_data.get('executable', False)

        },

        'history_id': int(time.time())

    })



# ==================== 市场扫描接口 ====================



@app.route('/api/ai/market/scanner', methods=['POST'])

def ai_market_scanner():

    """市场扫描分析端点 - 分层扫描优化版本"""

    print('=== AI Market Scanner 请求 (优化版本) ===')

    try:

        data = request.get_json()

        symbols = data.get('symbols', [])

        max_symbols = min(data.get('maxSymbols', 50), 50)  # 限制最多50只股票

        resume_info = data.get('resumeInfo', None)  # 恢复信息：已扫描symbols，剩余symbols

        

        if not symbols:

            # 如果没有提供符号，使用默认列表

            symbols = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'TSLA', 'NVDA', 'AMD', 'JPM', 'XOM', 'WMT', 'HD']

        

        # 限制扫描数量

        symbols = symbols[:max_symbols]

        

        print(f'市场扫描请求: {len(symbols)} 只股票')

        print(f'股票列表: {symbols}')

        

        # 处理恢复逻辑

        if resume_info and resume_info.get('scanned_symbols'):

            scanned_symbols = resume_info.get('scanned_symbols', [])

            # 过滤掉已扫描的symbols

            symbols = [s for s in symbols if s not in scanned_symbols]

            print(f'恢复扫描: 已扫描 {len(scanned_symbols)} 只，剩余 {len(symbols)} 只')

        

        # ========== 分层扫描优化 ==========

        # 第一层：批量获取市场数据

        print('=== 第一层：批量获取市场数据 ===')

        start_time = time.time()

        

        # 使用批量API获取数据

        batch_data = {}

        for symbol in symbols:

            try:

                # 简化版本：只获取基本价格数据

                alpaca_data, alpaca_error = fetch_alpaca_stock_data(symbol)

                if alpaca_data and not alpaca_error:

                    batch_data[symbol] = {

                        'price': alpaca_data.get('price', 0),

                        'changePercent': alpaca_data.get('changePercent', 0),

                        'volume': alpaca_data.get('volume', 0),

                        'dataSource': 'Alpaca'

                    }

                    print(f'✓ {symbol}: 获取数据成功')

                else:

                    print(f'✗ {symbol}: 获取数据失败')

                    batch_data[symbol] = {

                        'price': 0,

                        'changePercent': 0,

                        'volume': 0,

                        'dataSource': 'Failed'

                    }

            except Exception as e:

                print(f'✗ {symbol}: 异常 {str(e)}')

                batch_data[symbol] = {

                    'price': 0,

                    'changePercent': 0,

                    'volume': 0,

                    'dataSource': 'Error'

                }

        

        layer1_time = time.time() - start_time

        print(f'第一层完成，耗时: {layer1_time:.2f}秒')

        

        # 第二层：快速预筛选

        print('=== 第二层：快速预筛选 ===')

        shortlist = []

        for symbol in symbols:

            if symbol in batch_data:

                data = batch_data[symbol]

                price = data.get('price', 0)

                volume = data.get('volume', 0)

                change_pct = data.get('changePercent', 0)

                

                # 快速筛选条件

                if (price > 1 and  # 价格高于$1

                    volume > 1000 and  # 成交量大于1k

                    abs(change_pct) < 50):  # 涨跌幅小于50%

                    shortlist.append(symbol)

                    print(f'✓ {symbol}: 预筛选通过 (price=${price}, volume={volume}, change={change_pct:.2f}%)')

                else:

                    print(f'✗ {symbol}: 预筛选过滤 (price=${price}, volume={volume}, change={change_pct:.2f}%)')

            else:

                print(f'✗ {symbol}: 无数据')

        

        print(f'预筛选后shortlist: {len(shortlist)} 只股票')

        

        # 第三层：简化分析（不调用AI）

        print('=== 第三层：简化分析 ===')

        results = []

        for i, symbol in enumerate(shortlist):

            try:

                print(f'分析股票 {i+1}/{len(shortlist)}: {symbol}')

                

                # 获取股票基础数据

                stock_data = batch_data.get(symbol, {})

                

                # 简化分析：基于价格变化判断趋势

                price = stock_data.get('price', 0)

                change_pct = stock_data.get('changePercent', 0)

                volume = stock_data.get('volume', 0)

                

                # 简单趋势判断

                if change_pct > 2:

                    trend_label = 'Bullish'

                    trend_score = 70

                elif change_pct < -2:

                    trend_label = 'Bearish'

                    trend_score = 30

                else:

                    trend_label = 'Neutral'

                    trend_score = 50

                

                # 如果成交量高，加强趋势信号

                if volume > 100000 and abs(change_pct) > 1:

                    trend_label = f'Strong {trend_label}'

                    trend_score = trend_score + 10 if trend_score > 50 else trend_score - 10

                

                result_obj = {

                    'symbol': symbol,

                    'companyName': f'{symbol} Inc.',

                    'price': price,

                    'changePct': change_pct,

                    'changePercent': change_pct,

                    'volume': volume,

                    'hasValidVolume': volume > 0,

                    'dataSource': stock_data.get('dataSource', 'unknown'),

                    'sector': 'Technology',  # 简化版本

                    'newsSentiment': 'No news analyzed',

                    'eventRisk': 'Low',

                    'topCatalyst': 'Price movement',

                    'newsCount': 0,

                    'hasNews': False,

                    'trendLabel': trend_label,

                    'trendScore': trend_score,

                    'trendConfidence': 0.6,

                    'scannerReason': f'Price change: {change_pct:.2f}%, Volume: {volume}',

                    'analysisSource': 'simplified_scanner',

                    'timestamp': int(time.time())

                }

                

                results.append(result_obj)

                print(f'✓ {symbol}: 分析完成 - {trend_label}')

                

            except Exception as e:

                print(f'✗ {symbol}: 分析失败 - {str(e)}')

                # 添加错误结果

                results.append({

                    'symbol': symbol,

                    'companyName': f'{symbol} Inc.',

                    'price': 0,

                    'changePct': 0,

                    'changePercent': 0,

                    'volume': 0,

                    'hasValidVolume': False,

                    'dataSource': 'Error',

                    'sector': 'Unknown',

                    'newsSentiment': 'Analysis failed',

                    'eventRisk': 'Low',

                    'topCatalyst': 'Analysis error',

                    'newsCount': 0,

                    'hasNews': False,

                    'trendLabel': 'Neutral',

                    'trendScore': 50,

                    'trendConfidence': 0.3,

                    'scannerReason': f'分析失败: {str(e)[:50]}',

                    'analysisSource': 'error',

                    'timestamp': int(time.time()),

                    'error': True

                })

        

        total_time = time.time() - start_time

        print(f'=== 扫描完成 ===')

        print(f'总耗时: {total_time:.2f}秒')

        print(f'扫描股票: {len(symbols)} 只')

        print(f'预筛选通过: {len(shortlist)} 只')

        print(f'分析完成: {len(results)} 只')

        

        # 计算摘要统计

        bullish_count = sum(1 for r in results if 'Bullish' in r.get('trendLabel', ''))

        bearish_count = sum(1 for r in results if 'Bearish' in r.get('trendLabel', ''))

        neutral_count = sum(1 for r in results if r.get('trendLabel') == 'Neutral')

        strong_trend_count = sum(1 for r in results if 'Strong' in r.get('trendLabel', ''))

        news_risk_count = sum(1 for r in results if r.get('eventRisk') == 'High')

        

        return jsonify({

            'success': True,

            'results': results,

            'summary': {

                'universeScanned': len(results),

                'bullishCount': bullish_count,

                'bearishCount': bearish_count,

                'neutralCount': neutral_count,

                'strongTrendCount': strong_trend_count,

                'newsRiskCount': news_risk_count,

                'lastScanTime': int(time.time())

            },

            'message': f'市场扫描完成，分析了 {len(results)} 只股票',

            'completed': True,

            'scan_stats': {

                'total_symbols': len(symbols),

                'shortlist_size': len(shortlist),

                'results_count': len(results),

                'total_time_seconds': round(total_time, 2)

            }

        })

        

    except Exception as e:

        print(f'市场扫描失败: {str(e)}')

        return jsonify({

            'success': False,

            'error': str(e),

            'message': f'市场扫描失败: {str(e)}'

        })





def get_stock_data_for_scanner(symbol):

    """为市场扫描获取股票数据、新闻和档案信息"""

    try:

        # 获取股票数据

        stock_data = {}

        # 字段来源跟踪

        field_sources = {

            'price': 'unknown',

            'changePercent': 'unknown',

            'volume': 'unknown',

            'companyName': 'unknown',

            'sector': 'unknown'

        }

        

        try:

            # 尝试使用Alpaca数据

            alpaca_data, alpaca_error = fetch_alpaca_stock_data(symbol)

            if alpaca_data and not alpaca_error and alpaca_data.get('price'):

                # 调试：查看Alpaca返回的完整数据

                print(f'[Volume Fix] {symbol} Alpaca完整数据: price={alpaca_data.get("price")}, volume={alpaca_data.get("volume")}, bars_data字段: {"bars_data" in alpaca_data}')

                

                # 获取Alpaca volume - 直接从Alpaca数据获取

                alpaca_volume = alpaca_data.get('volume')

                print(f'[Volume Fix] {symbol} Alpaca原始volume: {alpaca_volume}, 类型: {type(alpaca_volume)}')

                

                # 检查是否有bars数据可以提取volume

                if alpaca_volume is None or alpaca_volume == 0:

                    print(f'[Volume Fix] {symbol} Alpaca volume无效，检查其他字段')

                    # 检查是否有其他volume字段

                    if 'bars_data' in alpaca_data and alpaca_data['bars_data']:

                        bars_data = alpaca_data['bars_data']

                        bar_volume = bars_data.get('v') if isinstance(bars_data, dict) else None

                        print(f'[Volume Fix] {symbol} bars_data中的volume: {bar_volume}')

                        if bar_volume and bar_volume > 0:

                            alpaca_volume = int(bar_volume)

                            print(f'[Volume Fix] {symbol} 使用bars_data中的volume: {alpaca_volume}')

                

                # 决定最终volume和来源

                final_volume = 0

                volume_source = 'none'

                

                if alpaca_volume and alpaca_volume > 0:

                    final_volume = alpaca_volume

                    volume_source = 'Alpaca'

                    print(f'[Volume Fix] {symbol} 使用Alpaca volume: {final_volume}')

                else:

                    # Alpaca没有volume，尝试Finnhub

                    print(f'[Volume Fix] {symbol} Alpaca没有有效volume，尝试Finnhub')

                    finnhub_data, finnhub_error = fetch_finnhub_quote(symbol)

                    if finnhub_data and not finnhub_error:

                        finnhub_volume = finnhub_data.get('v', 0)

                        if finnhub_volume and finnhub_volume > 0:

                            final_volume = finnhub_volume

                            volume_source = 'Finnhub'

                            print(f'[Volume Fix] {symbol} 使用Finnhub volume: {final_volume}')

                        else:

                            print(f'[Volume Fix] {symbol} Finnhub也没有有效volume')

                    else:

                        print(f'[Volume Fix] {symbol} Finnhub API失败')

                

                # 构建stock_data，包含详细来源信息

                stock_data = {

                    'price': alpaca_data.get('price'),

                    'changePercent': alpaca_data.get('changePercent', 0),

                    'volume': final_volume,

                    'dataSource': 'Alpaca',  # 主数据源

                    'priceSource': 'Alpaca',

                    'changeSource': 'Alpaca',

                    'volumeSource': volume_source,

                    'alpacaVolume': alpaca_volume,  # 保留原始值用于调试

                    'alpacaPrice': alpaca_data.get('price'),

                    'alpacaChangePercent': alpaca_data.get('changePercent', 0),

                    'hasValidVolume': final_volume > 0

                }

                

                # 更新字段来源

                field_sources['price'] = 'Alpaca'

                field_sources['changePercent'] = 'Alpaca'

                field_sources['volume'] = volume_source

                

            else:

                # Alpaca完全失败，回退到Finnhub

                print(f'[Volume Fix] {symbol} Alpaca完全失败，回退到Finnhub')

                finnhub_data, finnhub_error = fetch_finnhub_quote(symbol)

                if finnhub_data and not finnhub_error:

                    finnhub_volume = finnhub_data.get('v', 0)

                    stock_data = {

                        'price': finnhub_data.get('c', 0),

                        'changePercent': finnhub_data.get('dp', 0),

                        'volume': finnhub_volume,

                        'dataSource': 'Finnhub',

                        'priceSource': 'Finnhub',

                        'changeSource': 'Finnhub',

                        'volumeSource': 'Finnhub' if finnhub_volume > 0 else 'none',

                        'alpacaVolume': None,

                        'alpacaPrice': None,

                        'alpacaChangePercent': None,

                        'hasValidVolume': finnhub_volume > 0

                    }

                    

                    # 更新字段来源

                    field_sources['price'] = 'Finnhub'

                    field_sources['changePercent'] = 'Finnhub'

                    field_sources['volume'] = 'Finnhub' if finnhub_volume > 0 else 'none'

                    

                else:

                    # 所有数据源都失败，返回空数据但标记为失败

                    print(f'[Volume Fix] {symbol} 所有数据源失败')

                    stock_data = {

                        'price': 0,

                        'changePercent': 0,

                        'volume': 0,

                        'dataSource': 'Failed',

                        'priceSource': 'none',

                        'changeSource': 'none',

                        'volumeSource': 'none',

                        'alpacaVolume': None,

                        'alpacaPrice': None,

                        'alpacaChangePercent': None,

                        'hasValidVolume': False

                    }

                    

                    field_sources['price'] = 'none'

                    field_sources['changePercent'] = 'none'

                    field_sources['volume'] = 'none'

        except Exception as e:

            print(f'获取 {symbol} 股票数据失败: {str(e)}')

            stock_data = {

                'price': 0,

                'changePercent': 0,

                'volume': 0,

                'dataSource': 'Error',

                'priceSource': 'error',

                'changeSource': 'error',

                'volumeSource': 'error',

                'hasValidVolume': False

            }

        

        # 获取新闻数据

        news_data = analyze_news_for_stock(symbol)

        

        # 获取公司档案和Sector信息

        profile_data = {}

        company_name = f'{symbol} Inc.'

        sector_info = 'Unknown'

        sector_source = 'unknown'

        

        try:

            profile_data, profile_error = fetch_finnhub_profile(symbol)

            if profile_error:

                print(f'获取 {symbol} 档案数据失败: {profile_error}')

                # 不返回mock数据，使用空字典

                profile_data = {}

            

            # 确保公司名称

            if profile_data and profile_data.get('name'):

                company_name = profile_data.get('name')

                field_sources['companyName'] = 'Finnhub Profile'

                print(f'[Company Info] {symbol}: 从Finnhub获取公司名称: {company_name}')

            else:

                print(f'[Company Info] {symbol}: 无法从Finnhub获取公司名称，使用默认值')

                field_sources['companyName'] = 'default'

            

            # Sector信息处理 - 严格按照优先级

            # 1. 首先检查Finnhub profile中的sector (最高优先级)

            if profile_data and profile_data.get('finnhubSector'):

                sector_info = profile_data.get('finnhubSector')

                sector_source = 'finnhub_profile'

                print(f'[Sector Fix] {symbol}: 从Finnhub profile获取Sector: {sector_info}')

            elif profile_data and profile_data.get('sector'):

                sector_info = profile_data.get('sector')

                sector_source = 'profile'

                print(f'[Sector Fix] {symbol}: 从profile获取Sector: {sector_info}')

            else:

                # 2. 从备选来源获取Sector信息

                print(f'[Sector Fix] {symbol}: Finnhub没有sector，尝试备选来源')

                sector_info = get_sector_from_multiple_sources(symbol, stock_data, news_data)

                if sector_info and sector_info != 'Unknown':

                    sector_source = 'inferred'

                    print(f'[Sector Fix] {symbol}: 从备选来源推断Sector: {sector_info}')

                else:

                    # 3. 最后尝试DeepSeek推断

                    print(f'[Sector Fix] {symbol}: 备选来源失败，尝试DeepSeek推断')

                    sector_info = infer_sector_with_deepseek(symbol, stock_data, news_data, profile_data)

                    if sector_info and sector_info != 'Unknown':

                        sector_source = 'deepseek_inferred'

                        print(f'[Sector Fix] {symbol}: 从DeepSeek推断Sector: {sector_info}')

                    else:

                        sector_info = 'Unknown'

                        sector_source = 'unknown'

                        print(f'[Sector Fix] {symbol}: 所有来源都无法获取Sector信息')

            

            # 设置sector信息到profile_data

            profile_data['finnhubSector'] = sector_info

            profile_data['sector'] = sector_info

            profile_data['sectorSource'] = sector_source

            profile_data['name'] = company_name  # 确保有公司名称

            

            # 更新字段来源

            field_sources['sector'] = sector_source

            

        except Exception as e:

            print(f'获取 {symbol} 档案数据失败: {str(e)}')

            # 不返回mock数据，使用空字典

            profile_data = {}

            # 设置默认值

            profile_data = {

                'name': company_name,

                'sector': sector_info,

                'sectorSource': sector_source,

                'finnhubSector': sector_info

            }

        

        # 分析趋势

        analysis_result = analyze_trend_with_deepseek(symbol, stock_data, news_data, profile_data)

        

        return stock_data, news_data, profile_data, analysis_result

        

    except Exception as e:

        print(f'获取 {symbol} 扫描数据失败: {str(e)}')

        # 返回空数据

        return {}, {'sentiment': 'Mixed', 'eventRisk': 'Low', 'topCatalyst': 'Data unavailable'}, {}, {

            'trendLabel': 'Neutral',

            'trendScore': 50,

            'trendConfidence': 0.3,

            'scannerReason': f'数据获取失败: {str(e)[:100]}'

        }





def analyze_news_for_stock(symbol):

    """分析股票的新闻数据 - 返回模拟数据用于测试"""

    try:

        symbol_upper = symbol.upper()

        

        # 直接返回模拟新闻数据，跳过API调用

        print(f'[新闻分析] 返回模拟新闻数据: {symbol_upper}')

        

        # 根据股票符号返回不同的模拟数据

        if symbol_upper == 'AAPL':

            return {

                'sentiment': 'Positive',

                'eventRisk': 'Low',

                'topCatalyst': 'Strong quarterly earnings beat estimates',

                'newsCount': 3,

                'newsSource': 'Mock',

                'hasNews': True,

                'newsSummary': 'Apple reported strong quarterly earnings with iPhone sales exceeding expectations. Analysts have raised price targets following the results.'

            }

        elif symbol_upper == 'MSFT':

            return {

                'sentiment': 'Positive',

                'eventRisk': 'Low',

                'topCatalyst': 'Azure cloud growth accelerates',

                'newsCount': 2,

                'newsSource': 'Mock',

                'hasNews': True,

                'newsSummary': 'Microsoft reported strong cloud revenue growth with Azure accelerating. New AI features announced for Windows and Office.'

            }

        elif symbol_upper == 'TSLA':

            return {

                'sentiment': 'Mixed',

                'eventRisk': 'Medium',

                'topCatalyst': 'Q1 deliveries miss estimates',

                'newsCount': 2,

                'newsSource': 'Mock',

                'hasNews': True,

                'newsSummary': 'Tesla Q1 deliveries missed analyst estimates, but company announced refreshed Model Y with longer range.'

            }

        else:

            return {

                'sentiment': 'Neutral',

                'eventRisk': 'Low',

                'topCatalyst': 'Quarterly results reported',

                'newsCount': 1,

                'newsSource': 'Mock',

                'hasNews': True,

                'newsSummary': f'{symbol_upper} reported quarterly earnings with mixed results.'

            }

        

        # 分析新闻情绪

        sentiment_scores = []

        event_risk_levels = []

        catalysts = []

        

        for news in news_items:

            # 使用Finnhub提供的情感分数

            sentiment_score = news.get('sentiment_score', 0)

            sentiment_scores.append(sentiment_score)

            

            # 根据新闻标题和内容判断事件风险

            headline = news.get('headline', '').lower()

            summary = news.get('summary', '').lower()

            

            # 判断高风险事件

            high_risk_keywords = ['earnings miss', 'guidance cut', 'lawsuit', 'investigation', 'recall', 'warning', 'downgrade']

            medium_risk_keywords = ['earnings', 'guidance', 'analyst', 'upgrade', 'downgrade', 'target']

            

            risk_level = 'Low'

            for keyword in high_risk_keywords:

                if keyword in headline or keyword in summary:

                    risk_level = 'High'

                    break

            

            if risk_level == 'Low':

                for keyword in medium_risk_keywords:

                    if keyword in headline or keyword in summary:

                        risk_level = 'Medium'

                        break

            

            event_risk_levels.append(risk_level)

            

            # 识别主要催化剂

            catalyst_keywords = ['earnings', 'guidance', 'analyst', 'upgrade', 'downgrade', 'target price', 'product launch', 'merger', 'acquisition']

            for keyword in catalyst_keywords:

                if keyword in headline or keyword in summary:

                    catalysts.append(news.get('headline', 'News catalyst'))

                    break

        

        # 计算平均情感分数

        avg_sentiment = sum(sentiment_scores) / len(sentiment_scores) if sentiment_scores else 0

        

        # 确定整体情绪

        if avg_sentiment > 0.1:

            sentiment = 'Positive'

        elif avg_sentiment < -0.1:

            sentiment = 'Negative'

        else:

            sentiment = 'Mixed'

        

        # 确定事件风险（取最高风险级别）

        event_risk = 'Low'

        if 'High' in event_risk_levels:

            event_risk = 'High'

        elif 'Medium' in event_risk_levels:

            event_risk = 'Medium'

        

        # 确定主要催化剂

        top_catalyst = catalysts[0] if catalysts else news_items[0].get('headline', 'Recent news activity')

        if len(top_catalyst) > 100:

            top_catalyst = top_catalyst[:100] + '...'

        

        return {

            'sentiment': sentiment,

            'eventRisk': event_risk,

            'topCatalyst': top_catalyst,

            'newsCount': len(news_items),

            'avgSentimentScore': avg_sentiment,

            'newsSource': 'Finnhub',

            'hasNews': True

        }

        

    except Exception as e:

        print(f'分析 {symbol} 新闻失败: {str(e)}')

        return {

            'sentiment': 'News analysis failed',

            'eventRisk': 'Low',

            'topCatalyst': 'News analysis failed',

            'newsCount': 0,

            'newsSource': 'error',

            'hasNews': False

        }





def analyze_trend_with_deepseek(symbol, stock_data, news_data, profile_data):

    """使用DeepSeek分析股票趋势"""

    print(f'[DeepSeek分析] 函数被调用，参数: symbol={symbol}, stock_data type={type(stock_data)}, news_data type={type(news_data)}, profile_data type={type(profile_data)}')

    

    try:

        print(f'[DeepSeek分析] 开始分析 {symbol}')

        print(f'[DeepSeek分析] 市场数据: {stock_data is not None}')

        print(f'[DeepSeek分析] 新闻数据: {news_data is not None}')

        print(f'[DeepSeek分析] 公司资料: {profile_data is not None}')

        

        # 检查是否有有效的API密钥

        api_key = ai_provider_config_state.get('apiKey', '')

        print(f'[DeepSeek分析] API密钥: "{api_key[:10]}..." (长度: {len(api_key)})')

        print(f'[DeepSeek分析] AI配置状态: {ai_provider_config_state}')

        

        # 简化验证逻辑：只要API密钥不为空就尝试使用DeepSeek

        if not api_key:

            print(f'[DeepSeek分析] API密钥为空，返回null数据 {symbol}')

            return {

                'trendLabel': None,

                'trendScore': None,

                'trendConfidence': None,

                'scannerReason': None,

                'trendScoreDetail': None,

                'momentumScore': None,

                'volumeScore': None,

                'volatilityScore': None,

                'structureScore': None,

                'newsScore': None,

                'aiReasoning': None

            }

        

        # 即使API密钥可能无效，也尝试使用DeepSeek，让API调用失败后fallback

        print(f'[DeepSeek分析] 尝试使用DeepSeek API分析 {symbol}')

        

        # 处理可能的None值

        if stock_data is None:

            stock_data = {}

        if news_data is None:

            news_data = {}

        if profile_data is None:

            profile_data = {}

        

        # 准备分析数据 - 不要用默认值0掩盖缺失数据

        analysis_context = {

            'symbol': symbol,

            'companyName': profile_data.get('name', f'{symbol} Inc.'),

            'price': stock_data.get('price'),  # 保留None如果缺失

            'changePercent': stock_data.get('changePercent'),  # 保留None如果缺失

            'volume': stock_data.get('volume'),  # 保留None如果缺失

            'sector': profile_data.get('finnhubSector', 'Unknown'),

            'newsSentiment': news_data.get('sentiment', 'Mixed'),

            'eventRisk': news_data.get('eventRisk', 'Low'),

            'topCatalyst': news_data.get('topCatalyst', 'No recent catalyst'),

            'newsCount': news_data.get('newsCount', 0)

        }

        

        # 打印实际接收到的数据

        print(f'[DeepSeek分析] 实际接收到的市场数据:')

        print(f'  price: {analysis_context["price"]}')

        print(f'  changePercent: {analysis_context["changePercent"]}')

        print(f'  volume: {analysis_context["volume"]}')

        print(f'  stock_data keys: {list(stock_data.keys()) if stock_data else "None"}')

        

        # 构建提示 - 处理可能的None值

        price_str = f"${analysis_context['price']:.2f}" if analysis_context['price'] is not None else "数据缺失"

        change_str = f"{analysis_context['changePercent']:.2f}%" if analysis_context['changePercent'] is not None else "数据缺失"

        volume_str = f"{analysis_context['volume']:,.0f}" if analysis_context['volume'] is not None else "数据缺失"

        

        prompt = f"""作为专业的量化分析师，请分析以下股票并给出完整的趋势分析：



股票: {analysis_context['symbol']} ({analysis_context['companyName']})

价格: {price_str} ({change_str})

成交量: {volume_str}

板块: {analysis_context['sector']}



新闻分析:

- 情绪: {analysis_context['newsSentiment']}

- 事件风险: {analysis_context['eventRisk']}

- 主要催化剂: {analysis_context['topCatalyst']}

- 新闻数量: {analysis_context['newsCount']}



请基于以下6个维度给出详细分析，每个维度0-100分，必须为每个维度提供具体的分数：



1. 趋势分数 (Trend Score): 基于价格趋势和技术分析 - 请提供具体分数

2. 动量分数 (Momentum Score): 基于近期价格变动和动能 - 请提供具体分数

3. 成交量分数 (Volume Score): 基于成交量和相对成交量 - 请提供具体分数

4. 波动率分数 (Volatility Score): 基于价格波动范围和稳定性 - 请提供具体分数

5. 结构分数 (Structure Score): 基于价格结构和支撑阻力位 - 请提供具体分数

6. 新闻分数 (News Score): 基于新闻情绪和事件影响 - 请提供具体分数



特别要求：

1. 成交量状态判断 (Volume Status): 基于当前成交量、平均成交量、相对成交量，判断成交量状态为 Low / Normal / High

2. 详细推理 (Detailed Reasoning): 提供详细的英文分析，覆盖价格变动、趋势结构、动量、成交量、新闻催化剂、风险等方面

3. 简洁推理 (Concise Reasoning): 提供简洁的英文摘要，用于主表显示



请给出完整的分析结果，必须包括：

1. 趋势标签: Strong Bullish / Bullish / Neutral / Bearish / Strong Bearish

2. 总体分数: 0-100分（基于6个维度的加权平均）

3. 置信度: 0.0-1.0

4. 6个维度分数: 每个维度必须提供0-100分的具体分数

5. 成交量状态: Low / Normal / High

6. 事件风险: High / Medium / Low

7. 简洁推理: 用于主表显示的简短分析

8. 详细推理: 用于详情面板的详细分析



重要：必须为所有6个维度提供具体的分数，不要使用默认值或占位符。



请以JSON格式返回：

{{

  "trendLabel": "趋势标签",

  "overallScore": 总体分数,

  "confidence": 置信度,

  "trendScore": 趋势分数,

  "momentumScore": 动量分数,

  "volumeScore": 成交量分数,

  "volatilityScore": 波动率分数,

  "structureScore": 结构分数,

  "newsScore": 新闻分数,

  "volumeStatus": "成交量状态",

  "eventRisk": "事件风险",

  "conciseReasoning": "简洁推理",

  "detailedReasoning": "详细推理"

}}"""

        

        # 调用DeepSeek API

        headers = {

            'Authorization': f'Bearer {api_key}',

            'Content-Type': 'application/json'

        }

        

        payload = {

            'model': ai_provider_config_state.get('model', 'deepseek-chat'),

            'messages': [{'role': 'user', 'content': prompt}],

            'max_tokens': 500,

            'temperature': 0.2,

            'response_format': {'type': 'json_object'}

        }

        

        base_url = ai_provider_config_state.get('baseURL', 'https://api.deepseek.com')

        if not base_url.startswith('http'):

            base_url = 'https://' + base_url

        

        response = requests.post(

            f'{base_url}/chat/completions',

            headers=headers,

            json=payload,

            timeout=15

        )

        

        if response.status_code == 200:

            result = response.json()

            ai_response = result['choices'][0]['message']['content']

            

            # 打印AI原始响应以便调试

            print(f'[DeepSeek分析] AI原始响应: {ai_response[:500]}...')

            

            try:

                import json as json_module

                analysis_result = json_module.loads(ai_response)

                

                # 验证必要字段 - 支持新旧两种格式

                required_fields_v1 = ['trendLabel', 'trendScore', 'trendConfidence', 'scannerReason']

                required_fields_v2 = ['trendLabel', 'overallScore', 'confidence', 'trendScore', 'momentumScore', 'volumeScore', 'volatilityScore', 'structureScore', 'newsScore', 'volumeStatus', 'eventRisk', 'conciseReasoning', 'detailedReasoning']

                

                # 检查是V1还是V2格式

                is_v2_format = all(field in analysis_result for field in ['overallScore', 'trendScore', 'momentumScore'])

                

                if is_v2_format:

                    # V2格式：完整的6维度分析

                    print(f'[DeepSeek分析] 收到V2格式分析结果，包含6维度分数')

                    

                    # 确保所有V2字段都存在

                    for field in required_fields_v2:

                        if field not in analysis_result:

                            if field == 'trendLabel':

                                analysis_result[field] = 'Neutral'

                            elif field in ['overallScore', 'trendScore', 'momentumScore', 'volumeScore', 'volatilityScore', 'structureScore', 'newsScore']:

                                analysis_result[field] = 50

                            elif field == 'confidence':

                                analysis_result[field] = 0.5

                            elif field == 'volumeStatus':

                                analysis_result[field] = 'Normal'

                            elif field == 'eventRisk':

                                analysis_result[field] = 'Low'

                            elif field == 'conciseReasoning':

                                analysis_result[field] = 'AI analysis completed'

                            elif field == 'detailedReasoning':

                                analysis_result[field] = 'AI analysis completed'

                    

                    # 确保有scannerReason字段（前端可能使用）

                    if 'scannerReason' not in analysis_result:

                        analysis_result['scannerReason'] = analysis_result.get('conciseReasoning', 'AI analysis completed')

                    

                    # 确保有aiReasoning字段（前端可能使用）

                    if 'aiReasoning' not in analysis_result:

                        analysis_result['aiReasoning'] = analysis_result.get('detailedReasoning', 'AI analysis completed')

                else:

                    # V1格式：旧格式，只有基本字段

                    print(f'[DeepSeek分析] 收到V1格式分析结果，只有基本字段')

                    

                    for field in required_fields_v1:

                        if field not in analysis_result:

                            if field == 'trendLabel':

                                analysis_result[field] = 'Neutral'

                            elif field == 'trendScore':

                                analysis_result[field] = 50

                            elif field == 'trendConfidence':

                                analysis_result[field] = 0.5

                            elif field == 'scannerReason':

                                analysis_result[field] = 'AI analysis completed'

                    

                    # 为V1格式添加缺失的V2字段

                    analysis_result['overallScore'] = analysis_result.get('trendScore', 50)

                    analysis_result['confidence'] = analysis_result.get('trendConfidence', 0.5)

                    analysis_result['volumeStatus'] = 'Normal'  # 默认正常成交量

                    analysis_result['eventRisk'] = 'Medium'  # 默认中等风险

                    analysis_result['conciseReasoning'] = analysis_result.get('scannerReason', 'AI analysis completed')

                    analysis_result['detailedReasoning'] = analysis_result.get('scannerReason', 'AI analysis completed')

                    analysis_result['aiReasoning'] = analysis_result.get('scannerReason', 'AI analysis completed')

                    

                    # 为6维度分数设置默认值（基于总体分数）

                    base_score = analysis_result.get('trendScore', 50)

                    analysis_result['trendScore'] = base_score

                    analysis_result['momentumScore'] = base_score

                    analysis_result['volumeScore'] = base_score

                    analysis_result['volatilityScore'] = base_score

                    analysis_result['structureScore'] = base_score

                    analysis_result['newsScore'] = base_score

                

                print(f'DeepSeek分析 {symbol} 成功: {analysis_result["trendLabel"]}')

                # 标记分析来源

                analysis_result['analysisSource'] = 'deepseek'

                return analysis_result

                

            except Exception as e:

                print(f'解析DeepSeek响应失败: {str(e)}，返回null数据')

                return {

                    'trendLabel': None,

                    'trendScore': None,

                    'trendConfidence': None,

                    'scannerReason': None,

                    'trendScoreDetail': None,

                    'momentumScore': None,

                    'volumeScore': None,

                    'volatilityScore': None,

                    'structureScore': None,

                    'newsScore': None,

                    'aiReasoning': None

                }

        else:

            print(f'DeepSeek API调用失败: {response.status_code}，返回null数据')

            return {

                'trendLabel': None,

                'trendScore': None,

                'trendConfidence': None,

                'scannerReason': None,

                'trendScoreDetail': None,

                'momentumScore': None,

                'volumeScore': None,

                'volatilityScore': None,

                'structureScore': None,

                'newsScore': None,

                'aiReasoning': None

            }

            

    except Exception as e:

        print(f'DeepSeek分析失败: {str(e)}，使用本地分析')

        return analyze_trend_locally(symbol, stock_data, news_data, profile_data)





def analyze_trend_locally(symbol, stock_data, news_data, profile_data):

    """本地趋势分析规则（当DeepSeek不可用时使用）"""

    try:

        print(f'[本地规则分析] 开始分析 {symbol}')

        print(f'[本地规则分析] 市场数据: {stock_data}')

        print(f'[本地规则分析] 新闻数据: {news_data}')

        print(f'[本地规则分析] 公司资料: {profile_data}')

        

        # 初始化6维度分数

        trend_score = 50

        momentum_score = 50

        volatility_score = 50

        volume_score = 50

        structure_score = 50

        news_score = 50

        

        reasons = []

        

        # 1. 趋势分析 (25%)

        price = stock_data.get('price')  # 保留None如果缺失

        change_pct = stock_data.get('changePercent')  # 保留None如果缺失

        high = stock_data.get('high', price) if price else stock_data.get('high')

        low = stock_data.get('low', price) if price else stock_data.get('low')

        

        # 打印实际数据

        print(f'[本地规则分析] 实际价格数据: price={price}, change_pct={change_pct}')

        

        # 价格变动趋势

        if change_pct is not None:

            if change_pct > 5:

                trend_score += 20

                reasons.append(f"强势上涨 {change_pct:.1f}%")

            elif change_pct > 2:

                trend_score += 10

                reasons.append(f"上涨 {change_pct:.1f}%")

            elif change_pct < -5:

                trend_score -= 20

                reasons.append(f"大幅下跌 {change_pct:.1f}%")

            elif change_pct < -2:

                trend_score -= 10

                reasons.append(f"下跌 {change_pct:.1f}%")

        else:

            reasons.append("价格变动数据缺失")

        

        # 2. 动量分析 (20%)

        # 基于近期价格变化

        if change_pct is not None:

            if change_pct > 3:

                momentum_score += 15

                reasons.append("强劲动量")

            elif change_pct > 1:

                momentum_score += 8

                reasons.append("正向动量")

            elif change_pct < -3:

                momentum_score -= 15

                reasons.append("负向动量")

            elif change_pct < -1:

                momentum_score -= 8

                reasons.append("动量疲软")

        else:

            reasons.append("动量数据缺失")

        

        # 3. 波动率分析 (15%)

        # 基于价格范围

        price_range = high - low

        if price > 0:

            volatility_pct = (price_range / price) * 100

            if volatility_pct > 5:

                volatility_score += 10

                reasons.append(f"高波动率 {volatility_pct:.1f}%")

            elif volatility_pct > 2:

                volatility_score += 5

                reasons.append(f"中等波动率 {volatility_pct:.1f}%")

            else:

                volatility_score -= 5

                reasons.append(f"低波动率 {volatility_pct:.1f}%")

        

        # 4. 成交量分析 (15%)

        volume = stock_data.get('volume')  # 保留None如果缺失

        avg_volume = stock_data.get('averageVolume', volume) if volume else stock_data.get('averageVolume')

        

        if volume and avg_volume and avg_volume > 0:

            volume_ratio = volume / avg_volume

            if volume_ratio > 2:

                volume_score += 15

                reasons.append(f"成交量放大 {volume_ratio:.1f}x")

            elif volume_ratio > 1.5:

                volume_score += 8

                reasons.append(f"成交量增加 {volume_ratio:.1f}x")

            elif volume_ratio < 0.5:

                volume_score -= 10

                reasons.append(f"成交量萎缩 {volume_ratio:.1f}x")

        

        # 5. 结构分析 (15%)

        # 基于价格位置

        if price > high * 0.95:

            structure_score += 12

            reasons.append("接近近期高点")

        elif price < low * 1.05:

            structure_score -= 12

            reasons.append("接近近期低点")

        

        # 6. 新闻分析 (10%)

        sentiment = news_data.get('sentiment', 'Mixed') if news_data else 'Mixed'

        event_risk = news_data.get('eventRisk', 'Low') if news_data else 'Low'

        

        if sentiment == 'Positive':

            news_score += 10

            reasons.append("正面新闻情绪")

        elif sentiment == 'Negative':

            news_score -= 10

            reasons.append("负面新闻情绪")

        

        if event_risk == 'High':

            news_score -= 15

            reasons.append("高风险事件")

        elif event_risk == 'Medium':

            news_score -= 5

            reasons.append("中等风险事件")

        

        # 计算综合分数（加权平均）

        overall_score = int(

            (trend_score * 0.25) +

            (momentum_score * 0.20) +

            (volatility_score * 0.15) +

            (volume_score * 0.15) +

            (structure_score * 0.15) +

            (news_score * 0.10)

        )

        

        # 确保分数在0-100范围内

        overall_score = max(0, min(100, overall_score))

        

        # 确定趋势标签

        if overall_score >= 80:

            trend_label = 'Strong Bullish'

            confidence = 0.85

        elif overall_score >= 35:

            trend_label = 'Bearish'

            confidence = 0.7

        else:

            trend_label = 'Strong Bearish'

            confidence = 0.8

        

        # 生成详细的AI推理

        scanner_reason = f"基于6维度分析："

        scanner_reason += f" 趋势({trend_score}/100)"

        scanner_reason += f" 动量({momentum_score}/100)"

        scanner_reason += f" 波动率({volatility_score}/100)"

        scanner_reason += f" 成交量({volume_score}/100)"

        scanner_reason += f" 结构({structure_score}/100)"

        scanner_reason += f" 新闻({news_score}/100)"

        

        if reasons:

            scanner_reason += f"。关键因素：{', '.join(reasons)}"

        

        # 明确标记为规则分析

        scanner_reason = f"本地规则分析：{scanner_reason}"

        

        print(f'[本地规则分析] 最终结果:')

        print(f'  趋势标签: {trend_label}')

        print(f'  综合分数: {overall_score}')

        print(f'  置信度: {confidence}')

        print(f'  6维度分数: 趋势={trend_score}, 动量={momentum_score}, 波动率={volatility_score}, 成交量={volume_score}, 结构={structure_score}, 新闻={news_score}')

        print(f'  推理: {scanner_reason}')

        

        return {

            'trendLabel': trend_label,

            'trendScore': overall_score,  # 使用综合分数

            'trendConfidence': confidence,

            'scannerReason': scanner_reason,

            'analysisSource': 'rule_based',

            # 返回6维度分数

            'trendScoreDetail': trend_score,

            'momentumScore': momentum_score,

            'volumeScore': volume_score,

            'volatilityScore': volatility_score,

            'structureScore': structure_score,

            'newsScore': news_score

        }

        

    except Exception as e:

        print(f'本地趋势分析失败: {str(e)}')

        return {

            'trendLabel': 'Neutral',

            'trendScore': 50,

            'trendConfidence': 0.5,

            'scannerReason': f'Analysis error: {str(e)[:50]}'

        }





# ==================== 其他 AI Trading 接口 ====================



@app.route('/api/ai/trade/status', methods=['GET'])

def ai_trade_status():

    print('=== AI Trade Status 请求 ===')

    return jsonify({

        'success': True,

        'state': {

            'auto_mode': False,

            'paper_only': True,

            'human_confirm_required': True,

            'max_qty_per_order': 1,

            'max_notional_per_order': 1000,

            'max_orders_per_day': 10,

            'allowed_symbols': ['AAPL', 'MSFT', 'NVDA', 'GOOGL', 'AMZN'],

            'today_order_count': 0,

            'last_analysis_time': None,

            'last_execution_time': None,

            'ai_status': 'idle'

        },

        'history_count': 0

    })



@app.route('/api/ai/trade/history', methods=['GET'])

def ai_trade_history():

    print('=== AI Trade History 请求 ===')

    limit = request.args.get('limit', '50')

    return jsonify({

        'success': True,

        'history': [],

        'total_count': 0

    })



@app.route('/api/ai/trade/toggle', methods=['POST'])

def ai_trade_toggle():

    print('=== AI Trade Toggle 请求 ===')

    data = request.get_json()

    auto_mode = data.get('auto_mode', False)

    return jsonify({

        'success': True,

        'auto_mode': auto_mode,

        'paper_only': True,

        'human_confirm_required': True

    })



@app.route('/api/ai/trade/execute', methods=['POST'])

def ai_trade_execute():

    print('=== AI Trade Execute 请求 ===')

    data = request.get_json()

    history_id = data.get('history_id', 0)

    confirmed = data.get('confirmed', False)



    return jsonify({

        'success': True,

        'order': {

            'id': f'order-{int(time.time())}',

            'symbol': 'AAPL',

            'qty': 1,

            'side': 'buy',

            'type': 'market',

            'status': 'accepted'

        },

        'execution_time': time.time(),

        'message': '交易执行成功（模拟）'

    })



@app.route('/api/ai/trading/environment', methods=['GET', 'POST'])

def ai_trading_environment():

    print('=== AI Trading Environment 请求 ===')



    if request.method == 'GET':

        return jsonify({

            'success': True,

            'environment': {

                'environment': alpaca_config_state.get('environment', 'paper')

            }

        })

    else:

        # POST 方法

        data = request.get_json()

        environment = data.get('environment', 'paper')



        alpaca_config_state['environment'] = environment



        return jsonify({

            'success': True,

            'environment': {

                'environment': environment

            }

        })



# ==================== 基础接口 ====================



@app.route('/api/status', methods=['GET'])

def get_status():

    return jsonify({

        'status': 'online',

        'timestamp': int(time.time()),

        'version': '1.0.0-simple-with-ai'

    })



@app.route('/api/market/stocks', methods=['GET'])



def get_market_stocks():

    """股票列表接口 - 优化版本"""

    start_time = time.time()



    try:

        # 获取参数

        symbols_param = request.args.get('symbols', '')



        # 确定股票列表

        if symbols_param:

            symbols = [s.strip().upper() for s in symbols_param.split(',') if s.strip()]

        else:

            symbols = DEFAULT_SYMBOLS



        # 限制最大股票数量，避免过多API调用

        if len(symbols) > 20:

            symbols = symbols[:20]



        # 使用Alpaca snapshots endpoint一次性获取所有股票数据

        stocks = []

        success_count = 0



        # 调用snapshots endpoint

        snapshots_results, snapshots_errors = fetch_alpaca_stock_data_snapshot(symbols)



        # 并行获取Finnhub profile数据（公司资料）

        profile_results = {}

        with ThreadPoolExecutor(max_workers=5) as executor:

            # 提交所有profile获取任务

            future_to_symbol = {

                executor.submit(fetch_finnhub_profile, symbol): symbol

                for symbol in symbols

            }



            # 收集结果

            for future in as_completed(future_to_symbol):

                symbol = future_to_symbol[future]

                try:

                    profile_data, profile_error = future.result()

                    if profile_data and not profile_error:

                        profile_results[symbol] = profile_data

                except Exception as e:

                    print(f"[Finnhub Profile] 获取{symbol} profile数据异常: {e}")



        # 处理成功获取的数据

        for symbol in symbols:

            if symbol in snapshots_results:

                stock_data = snapshots_results[symbol]



                # 判断是否成功（有price就算成功）

                has_price = stock_data.get('price') is not None

                if has_price:

                    success_count += 1

                    stock_data['dataSource'] = "Alpaca"

                else:

                    stock_data['dataSource'] = "Alpaca (无价格数据)"



                # 补充Finnhub profile数据（公司资料）

                if symbol in profile_results:

                    profile_data = profile_results[symbol]



                    # 补充公司名称

                    if 'name' in profile_data and profile_data['name']:

                        stock_data['name'] = profile_data['name']



                    # 补充行业信息

                    if 'finnhubIndustry' in profile_data and profile_data['finnhubIndustry']:

                        stock_data['industry'] = profile_data['finnhubIndustry']

                        # 简单映射：使用industry作为sector（最小兼容）

                        stock_data['sector'] = profile_data['finnhubIndustry']



                    # 补充市值

                    if 'marketCapitalization' in profile_data and profile_data['marketCapitalization']:

                        # Finnhub 的 marketCapitalization 单位是百万美元，转换为美元

                        market_cap_millions = profile_data['marketCapitalization']

                        market_cap_dollars = market_cap_millions * 1000000

                        stock_data['marketCap'] = market_cap_dollars



                    # 补充货币

                    if 'currency' in profile_data and profile_data['currency']:

                        stock_data['currency'] = profile_data['currency']



                stocks.append(stock_data)

            else:

                # 没有获取到数据

                error_msg = snapshots_errors.get(symbol, '未知错误')

                stock_data = {

                    "symbol": symbol.upper(),

                    "name": None,

                    "price": None,

                    "change": None,

                    "changePercent": None,

                    "dayHigh": None,

                    "dayLow": None,

                    "open": None,

                    "previousClose": None,

                    "marketCap": None,

                    "currency": None,

                    "exchange": None,

                    "industry": None,

                    "sector": None,

                    "dataSource": "Alpaca (API调用失败)",

                    "timestamp": int(time.time()),

                    "error": error_msg

                }



                # 尝试使用Finnhub quote数据作为回退

                try:

                    print(f'[Market Stocks] Alpaca失败，尝试Finnhub quote回退: {symbol}')

                    finnhub_quote, finnhub_error = fetch_finnhub_quote(symbol)

                    if finnhub_quote and not finnhub_error:

                        # 更新价格数据

                        stock_data['price'] = finnhub_quote.get('c')

                        stock_data['change'] = finnhub_quote.get('d')

                        stock_data['changePercent'] = finnhub_quote.get('dp')

                        stock_data['previousClose'] = finnhub_quote.get('pc')

                        stock_data['dayHigh'] = finnhub_quote.get('h')

                        stock_data['dayLow'] = finnhub_quote.get('l')

                        stock_data['open'] = finnhub_quote.get('o')

                        stock_data['volume'] = finnhub_quote.get('v')

                        stock_data['dataSource'] = 'Finnhub (Alpaca失败回退)'

                        stock_data['error'] = None  # 清除错误，因为现在有数据了

                        success_count += 1

                        print(f'[Market Stocks] Finnhub回退成功: {symbol}, price={finnhub_quote.get("c")}')

                    else:

                        print(f'[Market Stocks] Finnhub quote也失败: {symbol}, error={finnhub_error}')

                except Exception as e:

                    print(f'[Market Stocks] Finnhub回退异常: {symbol}, {e}')



                # 即使Alpaca失败，也尝试补充Finnhub profile数据

                if symbol in profile_results:

                    profile_data = profile_results[symbol]



                    if 'name' in profile_data and profile_data['name']:

                        stock_data['name'] = profile_data['name']



                    if 'finnhubIndustry' in profile_data and profile_data['finnhubIndustry']:

                        stock_data['industry'] = profile_data['finnhubIndustry']

                        stock_data['sector'] = profile_data['finnhubIndustry']



                    if 'marketCapitalization' in profile_data and profile_data['marketCapitalization']:

                        # Finnhub 的 marketCapitalization 单位是百万美元，转换为美元

                        market_cap_millions = profile_data['marketCapitalization']

                        market_cap_dollars = market_cap_millions * 1000000

                        stock_data['marketCap'] = market_cap_dollars



                    if 'currency' in profile_data and profile_data['currency']:

                        stock_data['currency'] = profile_data['currency']



                stocks.append(stock_data)



        # 按symbol排序，保持一致性

        stocks.sort(key=lambda x: x['symbol'])



        elapsed = time.time() - start_time



        # 确定数据源（基于成功获取的数据）

        data_source = "Alpaca"

        if success_count == 0 and len(stocks) > 0:

            # 检查是否有任何股票成功获取了数据

            has_alpaca_data = any(stock.get('dataSource', '').startswith('Alpaca') for stock in stocks)

            if not has_alpaca_data:

                data_source = "Alpaca (无数据)"



        # 构建响应

        response_data = {

            "stocks": stocks,

            "count": len(stocks),

            "dataSource": data_source,

            "successCount": success_count,

            "failedCount": len(symbols) - success_count,

            "responseTime": round(elapsed, 3),

            "cacheInfo": {

                "enabled": True,

                "ttl": CACHE_TTL,

                "cacheHits": "统计在缓存类中",

                "timestamp": int(time.time())

            },

            "alpacaErrorCount": len(snapshots_errors) if snapshots_errors else 0

        }



        # 如果Alpaca失败，添加错误详情

        if snapshots_errors and len(snapshots_errors) > 0:

            # 获取第一个错误的详细信息

            first_symbol = list(snapshots_errors.keys())[0]

            first_error = snapshots_errors[first_symbol]

            response_data["alpacaError"] = {

                "message": first_error,

                "sampleSymbol": first_symbol,

                "totalErrors": len(snapshots_errors)

            }



        return jsonify(response_data), 200



    except Exception as e:

        elapsed = time.time() - start_time

        return jsonify({

            "stocks": [],

            "count": 0,

            "dataSource": "Finnhub (错误)",

            "error": str(e),

            "responseTime": round(elapsed, 3),

            "timestamp": int(time.time())

        }), 500



@app.route('/api/debug/alpaca', methods=['GET'])

def debug_alpaca():

    """调试Alpaca连接"""

    try:

        # 获取当前配置

        environment = alpaca_config_state.get('environment', 'paper')

        api_key = alpaca_config_state.get('paper_api_key') if environment == 'paper' else alpaca_config_state.get('live_api_key')

        api_secret = alpaca_config_state.get('paper_api_secret') if environment == 'paper' else alpaca_config_state.get('live_api_secret')

        

        # 测试单个股票

        test_symbol = 'AAPL'

        market_headers = {

            'APCA-API-KEY-ID': api_key,

            'APCA-API-SECRET-KEY': api_secret

        }

        test_url = f'https://data.alpaca.markets/v2/stocks/snapshots?symbols={test_symbol}'

        

        print(f'[Debug Alpaca] 测试URL: {test_url}')

        print(f'[Debug Alpaca] 环境: {environment}')

        print(f'[Debug Alpaca] API Key前10位: {api_key[:10] if api_key else "None"}...')

        

        response = requests.get(test_url, headers=market_headers, timeout=10)

        

        result = {

            "environment": environment,

            "apiKeyPreview": f"{api_key[:10]}...{api_key[-4:] if api_key and len(api_key) > 14 else ''}" if api_key else "None",

            "apiSecretPreview": f"{api_secret[:10]}...{api_secret[-4:] if api_secret and len(api_secret) > 14 else ''}" if api_secret else "None",

            "testUrl": test_url,

            "statusCode": response.status_code,

            "responseHeaders": dict(response.headers),

            "responseBodyPreview": response.text[:1000] if response.text else "Empty"

        }

        

        return jsonify(result), 200

        

    except Exception as e:

        return jsonify({

            "error": str(e),

            "config": {

                "environment": alpaca_config_state.get('environment', 'paper'),

                "paper_api_key_preview": f"{alpaca_config_state.get('paper_api_key', '')[:10]}..." if alpaca_config_state.get('paper_api_key') else "None",

                "live_api_key_preview": f"{alpaca_config_state.get('live_api_key', '')[:10]}..." if alpaca_config_state.get('live_api_key') else "None"

            }

        }), 500



@app.route('/market/stock/<symbol>', methods=['GET'])

@app.route('/api/market/stock/<symbol>', methods=['GET'])

def get_stock_detail(symbol):

    """股票详情接口 - 优先使用Alpaca，Finnhub补充公司信息"""

    start_time = time.time()



    try:

        symbol_upper = symbol.upper()



        print(f'[股票详情] 开始获取 {symbol_upper} 数据，优先使用Alpaca')



        # 首先尝试获取Alpaca实时数据

        alpaca_data = None

        alpaca_error = None

        try:

            print(f'[股票详情] 调用Alpaca snapshots接口')

            snapshots_results, snapshots_errors = fetch_alpaca_stock_data_snapshot([symbol_upper])

            print(f'[股票详情] snapshots_results keys: {list(snapshots_results.keys())}')

            print(f'[股票详情] snapshots_errors: {snapshots_errors}')

            

            if symbol_upper in snapshots_results:

                alpaca_data = snapshots_results[symbol_upper]

                print(f'[股票详情] Alpaca数据获取成功: price={alpaca_data.get("price")}')

                print(f'[股票详情] Alpaca数据完整结构: {alpaca_data}')

            else:

                alpaca_error = snapshots_errors.get(symbol_upper, 'Alpaca数据获取失败')

                print(f'[股票详情] Alpaca数据获取失败: {alpaca_error}')

        except Exception as e:

            alpaca_error = str(e)

            print(f'[股票详情] Alpaca接口异常: {alpaca_error}')

            import traceback

            traceback.print_exc()



        # 并行获取Finnhub数据（用于补充公司信息）

        with ThreadPoolExecutor(max_workers=2) as executor:

            future_quote = executor.submit(fetch_finnhub_quote, symbol_upper)

            future_profile = executor.submit(fetch_finnhub_profile, symbol_upper)



            quote_data, quote_error = future_quote.result()

            profile_data, profile_error = future_profile.result()

        

        print(f'[股票详情] Finnhub quote数据: {quote_data is not None}')

        print(f'[股票详情] Finnhub quote错误: {quote_error}')

        print(f'[股票详情] Finnhub profile数据: {profile_data is not None}')

        print(f'[股票详情] Finnhub profile错误: {profile_error}')



        # 股票名称映射

        STOCK_NAMES = {

            'AAPL': 'Apple Inc.',

            'MSFT': 'Microsoft Corporation',

            'GOOGL': 'Alphabet Inc.',

            'AMZN': 'Amazon.com Inc.',

            'TSLA': 'Tesla Inc.',

            'NVDA': 'NVIDIA Corporation',

            'META': 'Meta Platforms Inc.',

            'JPM': 'JPMorgan Chase & Co.',

            'JNJ': 'Johnson & Johnson',

            'V': 'Visa Inc.',

            'AMD': 'Advanced Micro Devices Inc.',

            'NFLX': 'Netflix Inc.',

            'INTC': 'Intel Corporation',

            'PYPL': 'PayPal Holdings Inc.',

            'ADBE': 'Adobe Inc.',

            'CSCO': 'Cisco Systems Inc.',

            'PEP': 'PepsiCo Inc.',

            'COST': 'Costco Wholesale Corporation',

            'DIS': 'The Walt Disney Company',

            'WMT': 'Walmart Inc.'

        }



        # AI Agent页面要求：优先使用Alpaca真实数据，如果失败则使用Finnhub但明确标记

        if not alpaca_data:

            print(f'[股票详情] AI Agent页面要求: 优先使用Alpaca真实数据，但Alpaca数据获取失败，使用Finnhub数据')

            

            # 使用Finnhub数据作为fallback

            if quote_data:

                # 构建基于Finnhub的响应

                stock_info = {

                    "symbol": symbol_upper,

                    "name": profile_data.get('name') if profile_data else STOCK_NAMES.get(symbol_upper, f"{symbol_upper} Inc."),

                    "price": quote_data.get('c'),

                    "change": quote_data.get('d'),

                    "changePercent": quote_data.get('dp'),

                    "dayHigh": quote_data.get('h'),

                    "dayLow": quote_data.get('l'),

                    "open": quote_data.get('o'),

                    "previousClose": quote_data.get('pc'),

                    "marketCap": profile_data.get('marketCapitalization') if profile_data else None,

                    "currency": "USD",

                    "exchange": profile_data.get('exchange') if profile_data else "NASDAQ",

                    "industry": profile_data.get('finnhubIndustry') if profile_data else "Technology",

                    "sector": profile_data.get('finnhubIndustry') if profile_data else "Technology",

                    "yearHigh": None,

                    "yearLow": None,

                    "peRatio": profile_data.get('pe') if profile_data else None,

                    "dividendYield": None,

                    "beta": None,

                    "earningsDate": None,

                    "dataSource": "Finnhub (Alpaca失败回退)",

                    "timestamp": int(time.time()),

                    "responseTime": round(time.time() - start_time, 3),

                    "success": True,

                    "sources": {

                        "marketData": "finnhub",

                        "companyInfo": "finnhub" if profile_data else "none"

                    }

                }

                

                return jsonify(stock_info)

            else:

                # 如果Finnhub也失败，返回错误

                return jsonify({

                    "symbol": symbol_upper,

                    "name": STOCK_NAMES.get(symbol_upper, f"{symbol_upper} Inc."),

                    "price": None,

                    "change": None,

                    "changePercent": None,

                    "dayHigh": None,

                    "dayLow": None,

                    "open": None,

                    "previousClose": None,

                    "marketCap": None,

                    "currency": "USD",

                    "exchange": "NASDAQ",

                    "industry": "Technology",

                    "sector": "Technology",

                    "yearHigh": None,

                    "yearLow": None,

                    "peRatio": None,

                    "dividendYield": None,

                    "beta": None,

                    "earningsDate": None,

                    "dataSource": "Alpaca (AI Agent页面要求)",

                    "timestamp": int(time.time()),

                    "responseTime": round(time.time() - start_time, 3),

                    "success": False,

                    "error": f"AI Agent页面要求使用Alpaca真实数据，但无法获取{symbol_upper}的Alpaca数据。请配置有效的Alpaca API密钥。"

                }), 400



        # Alpaca数据成功获取，构建stock_info

        print(f'[股票详情] 使用Alpaca数据映射')

        # 计算change和changePercent

        current_price = alpaca_data.get('price')

        prev_close = alpaca_data.get('previousClose')

        change = None

        change_percent = None



        if current_price is not None and prev_close is not None and prev_close > 0:

            change = current_price - prev_close

            change_percent = (change / prev_close) * 100



        # 构建stock_info基础对象

        stock_info = {

            "symbol": symbol_upper,

            "name": STOCK_NAMES.get(symbol_upper, f"{symbol_upper} Inc."),

            "price": current_price,

            "change": change,

            "changePercent": change_percent,

            "dayHigh": alpaca_data.get('dayHigh'),

            "dayLow": alpaca_data.get('dayLow'),

            "open": alpaca_data.get('open'),

            "previousClose": prev_close,

            "volume": alpaca_data.get('volume'),

            "exchange": alpaca_data.get('exchange', 'NASDAQ'),

            "bid": alpaca_data.get('bid'),

            "ask": alpaca_data.get('ask'),

            "dataSource": "Alpaca (AI Agent页面要求)",

            "timestamp": int(time.time()),

            "responseTime": round(time.time() - start_time, 3),

            "success": True,

            "profileSource": "Finnhub" if profile_data else None

        }

        

        print(f'[股票详情] Alpaca映射完成: price={current_price}, dayHigh={alpaca_data.get("dayHigh")}, volume={alpaca_data.get("volume")}')



        # 获取52周高低点（优先使用Alpaca）

        year_high, year_low = get_52week_high_low(symbol_upper)

        print(f'[股票详情] 52周高低点获取结果: yearHigh={year_high}, yearLow={year_low}')



        # 处理profile数据 - 补充公司信息

        if profile_data:

            market_cap = profile_data.get('marketCapitalization')

            if market_cap:

                # Finnhub 的 marketCapitalization 单位是百万美元，转换为美元

                market_cap = market_cap * 1000000



            stock_info.update({

                "marketCap": market_cap,

                "currency": profile_data.get('currency', 'USD'),

                # 注意：exchange字段可能已被Alpaca覆盖

                "industry": profile_data.get('finnhubIndustry', 'Technology'),

                "sector": profile_data.get('finnhubSector', 'Technology'),

                # 使用Alpaca计算的52周高低点

                "yearHigh": year_high,

                "yearLow": year_low,

                # 平均成交量需要历史数据计算，留空

                "avgVolume": None,

                # 添加缺失的公司信息字段（从Finnhub获取）

                "peRatio": profile_data.get('pe', None),  # P/E Ratio

                "dividendYield": profile_data.get('dividendYield', None),  # Dividend Yield

                "beta": profile_data.get('beta', None),  # Beta

                "earningsDate": profile_data.get('earningsDate', None)  # Earnings Date

            })



            # 如果有profile中的名称，使用它

            if profile_data.get('name'):

                stock_info["name"] = profile_data.get('name')



            print(f'[股票详情] Finnhub profile数据补充: marketCap={market_cap}, yearHigh={year_high}, yearLow={year_low}')



        # 如果没有profile数据，设置默认值（但仍包含52周高低点）

        else:

            stock_info.update({

                "marketCap": None,

                "yearHigh": year_high,

                "yearLow": year_low,

                "avgVolume": None,

                # 添加缺失的公司信息字段（设置为None）

                "peRatio": None,

                "dividendYield": None,

                "beta": None,

                "earningsDate": None

            })



        # 检查是否有有效数据

        if stock_info.get('price') is None or stock_info.get('price') == 0:

            stock_info["success"] = False

            stock_info["error"] = f"无法获取股票数据: quote_error={quote_error}, profile_error={profile_error}"



        return jsonify(stock_info), 200



    except Exception as e:

        elapsed = time.time() - start_time

        return jsonify({

            "symbol": symbol.upper(),

            "name": f"{symbol.upper()} Inc.",

            "price": None,

            "change": None,

            "changePercent": None,

            "dayHigh": None,

            "dayLow": None,

            "open": None,

            "previousClose": None,

            "marketCap": None,

            "currency": "USD",

            "exchange": "NASDAQ",

            "industry": "Technology",

            "sector": "Technology",

            "yearHigh": None,

            "yearLow": None,

            "peRatio": None,

            "dividendYield": None,

            "beta": None,

            "earningsDate": None,

            "dataSource": "Finnhub (错误)",

            "timestamp": int(time.time()),

            "responseTime": round(elapsed, 3),

            "success": False,

            "error": str(e)

        }), 500



# ==================== 历史数据路由（新增） ====================

@app.route('/market/history/<symbol>', methods=['GET'])

@app.route('/api/market/history/<symbol>', methods=['GET'])

def get_stock_history(symbol):

    """图表历史数据接口"""

    print(f"[历史数据接口] 被调用: symbol={symbol}")



    try:

        # 获取参数

        timeframe = request.args.get('timeframe', '1M')

        interval = request.args.get('interval', '1day')

        range_param = request.args.get('range', '1month')



        # 调试：打印所有参数

        print(f"[历史数据接口] 所有参数: {dict(request.args)}")

        print(f"[历史数据接口] 解析参数: timeframe={timeframe}, interval={interval}, range={range_param}")



        # 映射区间

        interval_map = {

            '1min': '1min',

            '5min': '5min',

            '15min': '15min',

            '30min': '30min',

            '45min': '45min',

            '1h': '1h',

            '2h': '2h',

            '4h': '4h',

            '1day': '1day',

            '1week': '1week',

            '1month': '1month'

        }



        range_map = {

            '1D': '1day',

            '1W': '1week',

            '1M': '1month',

            '3M': '3month',

            '1Y': '1year',

            '5Y': '5year',

            # 添加小写映射，兼容前端传递的小写参数

            '1day': '1day',

            '1week': '1week',

            '1month': '1month',

            '3month': '3month',

            '1year': '1year',

            '5year': '5year'

        }



        mapped_interval = interval_map.get(interval, '1day')

        mapped_range = range_map.get(range_param, '1month')



        print(f"[历史数据接口] 映射后参数: interval={mapped_interval}, range={mapped_range} (原始range_param={range_param})")



        # 首先尝试使用Alpaca API获取历史数据

        historical_data, success, data_source_note = get_alpaca_history(

            symbol, mapped_interval, mapped_range

        )



        # 如果Alpaca失败，根据要求不使用其他数据源

        if not success or not historical_data:

            print(f"[历史数据接口] Alpaca获取失败: {data_source_note}")

            print(f"[历史数据接口] 根据要求不使用其他数据源，返回空数据")

            # 根据要求：必须优先用Alpaca真实historical bars，不使用其他数据源

            return jsonify({

                "symbol": symbol.upper(),

                "data": [],

                "count": 0,

                "timeframe": timeframe,

                "interval": interval,

                "range": range_param,

                "dataSource": f"Alpaca获取失败: {data_source_note}",

                "success": False,

                "error": data_source_note,

                "timestamp": int(time.time())

            }), 200



        if success and historical_data:

            print(f"[历史数据接口] 成功获取 {len(historical_data)} 条数据，数据源: {data_source_note}")

            return jsonify({

                "symbol": symbol.upper(),

                "data": historical_data,

                "count": len(historical_data),

                "timeframe": timeframe,

                "interval": interval,

                "range": range_param,

                "dataSource": data_source_note,

                "success": True,

                "timestamp": int(time.time())

            }), 200

        else:

            print(f"[历史数据接口] 获取数据失败: {data_source_note}")

            return jsonify({

                "symbol": symbol.upper(),

                "data": [],

                "count": 0,

                "timeframe": timeframe,

                "interval": interval,

                "range": range_param,

                "dataSource": data_source_note,

                "success": False,

                "error": data_source_note,

                "timestamp": int(time.time())

            }), 200  # 仍然返回200，但success=False



    except Exception as e:

        print(f"[历史数据接口] 异常: {str(e)}")

        return jsonify({

            "symbol": symbol.upper(),

            "data": [],

            "count": 0,

            "timeframe": request.args.get('timeframe', '1M'),

            "interval": request.args.get('interval', '1day'),

            "range": request.args.get('range', '1month'),

            "dataSource": "Alpaca (异常)",

            "success": False,

            "error": str(e),

            "timestamp": int(time.time())

        }), 500



@app.route('/backtest/run', methods=['POST'])

@app.route('/api/backtest/run', methods=['POST'])

def run_backtest():

    """运行回测 - 优化版，使用真实数据"""

    total_start = time.time()



    try:

        data = request.get_json()

        print(f"[Backtest] 收到回测请求: {data}")



        # 提取配置

        user_input = data.get('symbol', 'AAPL')

        strategy = data.get('strategy', 'moving_average')

        start_date = data.get('startDate', '2024-01-01')

        end_date = data.get('endDate', '2024-12-31')

        initial_capital = data.get('initialCapital', 10000)

        data_mode = data.get('dataMode', 'real')

        parameters = data.get('parameters', {})



        # 生成backtest ID

        import uuid

        backtest_id = str(uuid.uuid4())[:8]



        print(f"[Backtest] 开始处理，ID: {backtest_id}")

        print(f"[Backtest] 请求参数详情:")

        print(f"  - symbol: {user_input}")

        print(f"  - strategy: {strategy}")

        print(f"  - start_date: {start_date}")

        print(f"  - end_date: {end_date}")

        print(f"  - initial_capital: {initial_capital}")

        print(f"  - data_mode: {data_mode}")

        print(f"  - parameters: {parameters}")

        

        # ========== DEBUG Layer B: run_backtest()入口 ==========

        print(f"=== DEBUG Layer B: run_backtest()入口 ===")

        print(f"实际收到的 symbol: {user_input}")

        print(f"实际收到的 strategy: {strategy}")

        print(f"startDate: {start_date}")

        print(f"endDate: {end_date}")

        print(f"==========================================")

        # ========== END DEBUG ==========



        # 阶段1: symbol验证

        stage1_start = time.time()

        print(f"[Backtest] 阶段1: 验证股票输入")



        # 简单的symbol验证

        symbol = user_input.upper().strip()

        if not symbol or len(symbol) > 10:

            validation_message = f"无效的股票代码: '{user_input}'"

            print(f"[Backtest] 股票输入无效: {validation_message}")

            return jsonify({

                "success": False,

                "error": validation_message,

                "result": {

                    "backtestId": backtest_id,

                    "results": None,

                    "chartData": None,

                    "trades": None,

                    "parameters": {

                        "symbol": "",

                        "symbols": [],

                        "strategy": strategy,

                        "startDate": start_date,

                        "endDate": end_date,

                        "period": f"{start_date} to {end_date}",

                        "initialCapital": initial_capital,

                        "dataMode": "real",

                        "dataModeDisplay": "Real Data",

                        "dataSource": "Invalid input"

                    }

                }

            }), 200



        stage1_time = time.time() - stage1_start

        print(f"[Backtest] 阶段1完成，耗时: {stage1_time:.2f}秒")



        # 只支持真实数据模式

        print(f"[Backtest] 使用真实数据模式")



        # 阶段2: 获取历史数据

        stage2_start = time.time()

        print(f"[Backtest] 阶段2: 获取历史数据")



        # 使用Alpaca获取历史数据（替换Twelve Data）

        historical_data = None

        data_source = None

        data_mode_display = "Real Data"

        data_source_note = ""



        # 使用日线数据

        interval = "1day"



        # 1. 使用Alpaca日期范围API（精确匹配回测日期范围）

        print(f"[Backtest] 使用Alpaca获取历史数据: {symbol}, start={start_date}, end={end_date}")



        try:

            # 直接使用start_date和end_date作为参数

            historical_data, success, data_source_note = get_alpaca_history_for_backtest(

                symbol, interval, f"{start_date} to {end_date}"

            )



            if success and historical_data:

                data_source = data_source_note

                print(f"[Backtest] 获取历史数据成功 ({data_source}): {len(historical_data)} 个数据点")

                

                # 详细数据摘要

                print(f"[Backtest] 历史数据摘要:")

                if len(historical_data) > 0:

                    print(f"  第一条数据: timestamp={historical_data[0].get('timestamp')}, close={historical_data[0].get('close')}")

                    print(f"  最后一条数据: timestamp={historical_data[-1].get('timestamp')}, close={historical_data[-1].get('close')}")

                    # 检查数据质量

                    valid_data_points = sum(1 for d in historical_data if d.get('close', 0) > 0)

                    print(f"  有效收盘价数据点: {valid_data_points}/{len(historical_data)}")

                else:

                    print("  警告: 历史数据为空数组")

                

                # 数据验证

                # 1. 检查是否为空

                if len(historical_data) == 0:

                    print(f"[Backtest] 错误: 历史数据为空数组")

                    return jsonify({

                        "success": False,

                        "error": "Alpaca returned empty historical data (no bars available)",

                        "backtestId": backtest_id,

                        "results": None,

                        "chartData": None,

                        "trades": None,

                        "parameters": {

                            "symbol": symbol,

                            "symbols": [symbol],

                            "strategy": strategy,

                            "startDate": start_date,

                            "endDate": end_date,

                            "period": f"{start_date} to {end_date}",

                            "initialCapital": initial_capital,

                            "dataMode": "real",

                            "dataModeDisplay": "Real Data",

                            "dataSource": data_source_note

                        }

                    }), 200

                

                # 2. 检查策略所需最小数据量

                min_required_data = 1

                if strategy == 'moving_average':

                    long_ma_period = parameters.get('longMaPeriod', 50)

                    min_required_data = long_ma_period + 10  # 需要足够数据计算均线+额外数据点

                    print(f"[Backtest] MA策略验证: longMaPeriod={long_ma_period}, 需要最小数据量={min_required_data}")

                

                if len(historical_data) < min_required_data:

                    print(f"[Backtest] 错误: 历史数据不足，需要至少{min_required_data}个数据点，实际只有{len(historical_data)}个")

                    return jsonify({

                        "success": False,

                        "error": f"Insufficient historical bars for {strategy} strategy: need at least {min_required_data}, got {len(historical_data)}",

                        "backtestId": backtest_id,

                        "results": None,

                        "chartData": None,

                        "trades": None,

                        "parameters": {

                            "symbol": symbol,

                            "symbols": [symbol],

                            "strategy": strategy,

                            "startDate": start_date,

                            "endDate": end_date,

                            "period": f"{start_date} to {end_date}",

                            "initialCapital": initial_capital,

                            "dataMode": "real",

                            "dataModeDisplay": "Real Data",

                            "dataSource": data_source_note

                        }

                    }), 200

                

                # 3. 检查非交易日/无效数据

                valid_close_prices = sum(1 for d in historical_data if d.get('close', 0) > 0)

                if valid_close_prices == 0:

                    print(f"[Backtest] 错误: 所有历史数据的收盘价都为0或无效")

                    return jsonify({

                        "success": False,

                        "error": "All historical bars have invalid/zero close prices (可能为非交易日或无交易数据)",

                        "backtestId": backtest_id,

                        "results": None,

                        "chartData": None,

                        "trades": None,

                        "parameters": {

                            "symbol": symbol,

                            "symbols": [symbol],

                            "strategy": strategy,

                            "startDate": start_date,

                            "endDate": end_date,

                            "period": f"{start_date} to {end_date}",

                            "initialCapital": initial_capital,

                            "dataMode": "real",

                            "dataModeDisplay": "Real Data",

                            "dataSource": data_source_note

                        }

                    }), 200

                

                # ========== DEBUG Layer C: 历史数据获取后 ==========

                print(f"=== DEBUG Layer C: 历史数据获取后 ({symbol}) ===")

                print(f"当前 symbol: {symbol}")

                print(f"historical_data length: {len(historical_data)}")

                if len(historical_data) > 0:

                    print(f"first close: {historical_data[0].get('close')}")

                    print(f"last close: {historical_data[-1].get('close')}")

                    print(f"first 3 dates: {[d.get('timestamp') for d in historical_data[:3]]}")

                    print(f"last 3 dates: {[d.get('timestamp') for d in historical_data[-3:]]}")

                else:

                    print(f"警告: historical_data为空")

                print(f"================================================")

                # ========== END DEBUG ==========

            else:

                print(f"[Backtest] Alpaca获取失败: {data_source_note}")

                return jsonify({

                    "success": False,

                    "error": f"无法从Alpaca获取历史数据: {data_source_note}",

                    "backtestId": backtest_id,

                    "results": None,

                    "chartData": None,

                    "trades": None,

                    "parameters": {

                        "symbol": symbol,

                        "symbols": [symbol],

                        "strategy": strategy,

                        "startDate": start_date,

                        "endDate": end_date,

                        "period": f"{start_date} to {end_date}",

                        "initialCapital": initial_capital,

                        "dataMode": "real",

                        "dataModeDisplay": "Real Data",

                        "dataSource": data_source_note

                    }

                }), 200



        except Exception as e:

            print(f"[Backtest] 获取历史数据异常: {str(e)}")

            return jsonify({

                "success": False,

                "error": f"获取历史数据异常: {str(e)}",

                "backtestId": backtest_id,

                "results": None,

                "chartData": None,

                "trades": None,

                "parameters": {

                    "symbol": symbol,

                    "symbols": [symbol],

                    "strategy": strategy,

                    "startDate": start_date,

                    "endDate": end_date,

                    "period": f"{start_date} to {end_date}",

                    "initialCapital": initial_capital,

                    "dataMode": "real",

                    "dataModeDisplay": "Real Data",

                    "dataSource": "Alpaca (异常)"

                }

            }), 200



        stage2_time = time.time() - stage2_start

        print(f"[Backtest] 阶段2完成，耗时: {stage2_time:.2f}秒")



        # 阶段3: 执行回测逻辑

        stage3_start = time.time()

        print(f"[Backtest] 阶段3: 执行回测逻辑 - 策略: {strategy}, 参数: {parameters}")



        # 策略分发函数

        def run_moving_average_strategy(data, params, initial_capital, symbol):

            """移动平均线交叉策略"""

            short_period = params.get('shortMaPeriod', 20)

            long_period = params.get('longMaPeriod', 50)



            trades = []

            equity_curve = []

            chart_data = []  # 完整的图表数据

            position = 0

            cash = initial_capital

            equity = initial_capital



            # 计算移动平均线

            prices = [point['close'] for point in data]

            sma_short = []

            sma_long = []



            for i in range(len(prices)):

                if i >= short_period:

                    sma_short.append(sum(prices[i-short_period:i]) / short_period)

                else:

                    sma_short.append(prices[i])



                if i >= long_period:

                    sma_long.append(sum(prices[i-long_period:i]) / long_period)

                else:

                    sma_long.append(prices[i])



            # 执行交易策略

            for i, data_point in enumerate(data):

                date = data_point['timestamp']

                price = data_point['close']



                # 交易信号

                if i >= max(short_period, long_period):

                    # 短期均线上穿长期均线 - 买入信号

                    if sma_short[i] > sma_long[i] and (i == 0 or sma_short[i-1] <= sma_long[i-1]):

                        if cash > 0 and position == 0:

                            shares_to_buy = cash // price

                            if shares_to_buy > 0:

                                cost = shares_to_buy * price

                                cash -= cost

                                position = shares_to_buy

                                trades.append({

                                    'entryDate': date,

                                    'exitDate': None,

                                    'entryPrice': price,

                                    'exitPrice': None,

                                    'pnl': 0,

                                    'returnPct': 0,

                                    'holdingPeriod': 0,

                                    'position': 1,

                                    'action': 'BUY',

                                    'quantity': shares_to_buy,

                                    'symbol': symbol

                                })

                                # 更新chartData中的signal字段为1（买入）

                                # 注意：chart_data的长度应该等于i+1，因为我们在循环中构建

                                if len(chart_data) > 0:

                                    chart_data[-1]['signal'] = 1



                    # 短期均线下穿长期均线 - 卖出信号

                    elif sma_short[i] < sma_long[i] and (i == 0 or sma_short[i-1] >= sma_long[i-1]):

                        if position > 0:

                            value = position * price

                            cash += value

                            # 更新最近一次交易的退出信息

                            for trade in reversed(trades):

                                if trade.get('exitDate') is None and trade.get('action') == 'BUY':

                                    entry_price = trade['entryPrice']

                                    pnl = (price - entry_price) * trade['quantity']

                                    return_pct = ((price - entry_price) / entry_price) * 100 if entry_price > 0 else 0



                                    trade['exitDate'] = date

                                    trade['exitPrice'] = price

                                    trade['pnl'] = round(pnl, 2)

                                    trade['returnPct'] = round(return_pct, 2)

                                    trade['holdingPeriod'] = i - next((idx for idx, p in enumerate(data) if p['timestamp'] == trade['entryDate']), i)

                                    break

                            position = 0

                            # 更新chartData中的signal字段为-1（卖出）

                            if len(chart_data) > 0:

                                chart_data[-1]['signal'] = -1



                # 计算当前权益

                equity = cash + (position * price)

                equity_curve.append({

                    'date': date,

                    'equity': equity,

                    'price': price

                })



                # 构建完整的图表数据

                chart_data.append({

                    'date': date,

                    'open': data_point['open'],

                    'high': data_point['high'],

                    'low': data_point['low'],

                    'close': data_point['close'],

                    'volume': data_point['volume'],

                    'price': price,  # 当前价格（与close相同）

                    'equity': equity,  # 当前权益

                    'signal': 0  # 默认无信号，后面会根据交易更新

                })



            return trades, equity_curve, chart_data



        def run_rsi_strategy(data, params, initial_capital, symbol):

            """RSI策略"""

            period = params.get('rsiPeriod', 14)

            oversold = params.get('rsiOversold', 30)

            overbought = params.get('rsiOverbought', 70)



            trades = []

            equity_curve = []

            chart_data = []  # 完整的图表数据

            position = 0

            cash = initial_capital

            equity = initial_capital



            # 计算RSI

            prices = [point['close'] for point in data]

            rsi_values = []



            for i in range(len(prices)):

                if i < period:

                    rsi_values.append(50)  # 默认值

                else:

                    gains = []

                    losses = []

                    for j in range(i-period, i):

                        change = prices[j+1] - prices[j] if j+1 < len(prices) else 0

                        if change > 0:

                            gains.append(change)

                        else:

                            losses.append(abs(change))



                    avg_gain = sum(gains) / period if gains else 0

                    avg_loss = sum(losses) / period if losses else 0



                    if avg_loss == 0:

                        rsi = 100

                    else:

                        rs = avg_gain / avg_loss

                        rsi = 100 - (100 / (1 + rs))



                    rsi_values.append(rsi)



            # 执行交易策略

            for i, data_point in enumerate(data):

                date = data_point['timestamp']

                price = data_point['close']



                # 交易信号

                if i >= period:

                    rsi = rsi_values[i]



                    # RSI超卖 - 买入信号

                    if rsi < oversold and position == 0:

                        if cash > 0:

                            shares_to_buy = cash // price

                            if shares_to_buy > 0:

                                cost = shares_to_buy * price

                                cash -= cost

                                position = shares_to_buy

                                trades.append({

                                    'entryDate': date,

                                    'exitDate': None,

                                    'entryPrice': price,

                                    'exitPrice': None,

                                    'pnl': 0,

                                    'returnPct': 0,

                                    'holdingPeriod': 0,

                                    'position': 1,

                                    'action': 'BUY',

                                    'quantity': shares_to_buy,

                                    'symbol': symbol

                                })



                    # RSI超买 - 卖出信号

                    elif rsi > overbought and position > 0:

                        value = position * price

                        cash += value

                        # 更新最近一次交易的退出信息

                        for trade in reversed(trades):

                            if trade.get('exitDate') is None and trade.get('action') == 'BUY':

                                entry_price = trade['entryPrice']

                                pnl = (price - entry_price) * trade['quantity']

                                return_pct = ((price - entry_price) / entry_price) * 100 if entry_price > 0 else 0



                                trade['exitDate'] = date

                                trade['exitPrice'] = price

                                trade['pnl'] = round(pnl, 2)

                                trade['returnPct'] = round(return_pct, 2)

                                trade['holdingPeriod'] = i - next((idx for idx, p in enumerate(data) if p['timestamp'] == trade['entryDate']), i)

                                break

                        position = 0



                # 计算当前权益

                equity = cash + (position * price)

                equity_curve.append({

                    'date': date,

                    'equity': equity,

                    'price': price

                })



                # 构建完整的图表数据

                chart_data.append({

                    'date': date,

                    'open': data_point['open'],

                    'high': data_point['high'],

                    'low': data_point['low'],

                    'close': data_point['close'],

                    'volume': data_point['volume'],

                    'price': price,

                    'equity': equity

                })



            return trades, equity_curve, chart_data



        def run_bollinger_strategy(data, params, initial_capital, symbol):

            """布林带策略"""

            period = params.get('bollingerPeriod', 20)

            std_dev = params.get('bollingerStdDev', 2)



            trades = []

            equity_curve = []

            position = 0

            cash = initial_capital

            equity = initial_capital



            # 计算布林带

            prices = [point['close'] for point in data]

            sma_values = []

            upper_band = []

            lower_band = []



            for i in range(len(prices)):

                if i >= period:

                    # 计算简单移动平均

                    sma = sum(prices[i-period:i]) / period

                    sma_values.append(sma)



                    # 计算标准差

                    variance = sum((p - sma) ** 2 for p in prices[i-period:i]) / period

                    std = variance ** 0.5



                    upper_band.append(sma + std_dev * std)

                    lower_band.append(sma - std_dev * std)

                else:

                    sma_values.append(prices[i])

                    upper_band.append(prices[i])

                    lower_band.append(prices[i])



            # 执行交易策略

            for i, data_point in enumerate(data):

                date = data_point['timestamp']

                price = data_point['close']



                # 交易信号

                if i >= period:

                    # 价格跌破下轨 - 买入信号（超卖）

                    if price < lower_band[i] and position == 0:

                        if cash > 0:

                            shares_to_buy = cash // price

                            if shares_to_buy > 0:

                                cost = shares_to_buy * price

                                cash -= cost

                                position = shares_to_buy

                                trades.append({

                                    'entryDate': date,

                                    'exitDate': None,

                                    'entryPrice': price,

                                    'exitPrice': None,

                                    'pnl': 0,

                                    'returnPct': 0,

                                    'holdingPeriod': 0,

                                    'position': 1,

                                    'action': 'BUY',

                                    'quantity': shares_to_buy,

                                    'symbol': symbol

                                })



                    # 价格突破上轨 - 卖出信号（超买）

                    elif price > upper_band[i] and position > 0:

                        value = position * price

                        cash += value

                        # 更新最近一次交易的退出信息

                        for trade in reversed(trades):

                            if trade.get('exitDate') is None and trade.get('action') == 'BUY':

                                entry_price = trade['entryPrice']

                                pnl = (price - entry_price) * trade['quantity']

                                return_pct = ((price - entry_price) / entry_price) * 100 if entry_price > 0 else 0



                                trade['exitDate'] = date

                                trade['exitPrice'] = price

                                trade['pnl'] = round(pnl, 2)

                                trade['returnPct'] = round(return_pct, 2)

                                trade['holdingPeriod'] = i - next((idx for idx, p in enumerate(data) if p['timestamp'] == trade['entryDate']), i)

                                break

                        position = 0



                # 计算当前权益

                equity = cash + (position * price)

                equity_curve.append({

                    'date': date,

                    'equity': equity,

                    'price': price

                })



            return trades, equity_curve



        def run_momentum_strategy(data, params, initial_capital, symbol):

            """动量策略"""

            period = params.get('momentumPeriod', 10)



            trades = []

            equity_curve = []

            position = 0

            cash = initial_capital

            equity = initial_capital



            # 计算动量

            prices = [point['close'] for point in data]

            momentum_values = []



            for i in range(len(prices)):

                if i >= period:

                    momentum = prices[i] - prices[i-period]

                    momentum_values.append(momentum)

                else:

                    momentum_values.append(0)



            # 执行交易策略

            for i, data_point in enumerate(data):

                date = data_point['timestamp']

                price = data_point['close']



                # 交易信号

                if i >= period:

                    # 正动量 - 买入信号

                    if momentum_values[i] > 0 and position == 0:

                        if cash > 0:

                            shares_to_buy = cash // price

                            if shares_to_buy > 0:

                                cost = shares_to_buy * price

                                cash -= cost

                                position = shares_to_buy

                                trades.append({

                                    'entryDate': date,

                                    'exitDate': None,

                                    'entryPrice': price,

                                    'exitPrice': None,

                                    'pnl': 0,

                                    'returnPct': 0,

                                    'holdingPeriod': 0,

                                    'position': 1,

                                    'action': 'BUY',

                                    'quantity': shares_to_buy,

                                    'symbol': symbol

                                })



                    # 负动量 - 卖出信号

                    elif momentum_values[i] < 0 and position > 0:

                        value = position * price

                        cash += value

                        # 更新最近一次交易的退出信息

                        for trade in reversed(trades):

                            if trade.get('exitDate') is None and trade.get('action') == 'BUY':

                                entry_price = trade['entryPrice']

                                pnl = (price - entry_price) * trade['quantity']

                                return_pct = ((price - entry_price) / entry_price) * 100 if entry_price > 0 else 0



                                trade['exitDate'] = date

                                trade['exitPrice'] = price

                                trade['pnl'] = round(pnl, 2)

                                trade['returnPct'] = round(return_pct, 2)

                                trade['holdingPeriod'] = i - next((idx for idx, p in enumerate(data) if p['timestamp'] == trade['entryDate']), i)

                                break

                        position = 0



                # 计算当前权益

                equity = cash + (position * price)

                equity_curve.append({

                    'date': date,

                    'equity': equity,

                    'price': price

                })



            return trades, equity_curve



        def run_macd_strategy(data, params, initial_capital, symbol):

            """MACD策略"""

            fast_period = params.get('macdFast', 12)

            slow_period = params.get('macdSlow', 26)

            signal_period = params.get('macdSignal', 9)



            trades = []

            equity_curve = []

            position = 0

            cash = initial_capital

            equity = initial_capital



            # 计算MACD

            prices = [point['close'] for point in data]

            ema_fast = []

            ema_slow = []

            macd_line = []

            signal_line = []

            histogram = []



            for i in range(len(prices)):

                # 计算EMA

                if i == 0:

                    ema_fast.append(prices[i])

                    ema_slow.append(prices[i])

                else:

                    fast_alpha = 2 / (fast_period + 1)

                    slow_alpha = 2 / (slow_period + 1)

                    ema_fast.append(prices[i] * fast_alpha + ema_fast[i-1] * (1 - fast_alpha))

                    ema_slow.append(prices[i] * slow_alpha + ema_slow[i-1] * (1 - slow_alpha))



                # 计算MACD线

                macd = ema_fast[i] - ema_slow[i]

                macd_line.append(macd)



                # 计算信号线

                if i == 0:

                    signal_line.append(macd)

                elif i < signal_period:

                    signal_line.append(macd)

                else:

                    signal_alpha = 2 / (signal_period + 1)

                    signal_line.append(macd * signal_alpha + signal_line[i-1] * (1 - signal_alpha))



                # 计算柱状图

                histogram.append(macd_line[i] - signal_line[i])



            # 执行交易策略

            for i, data_point in enumerate(data):

                date = data_point['timestamp']

                price = data_point['close']



                # 交易信号

                if i >= max(fast_period, slow_period, signal_period):

                    # MACD线上穿信号线 - 买入信号

                    if histogram[i] > 0 and (i == 0 or histogram[i-1] <= 0):

                        if cash > 0 and position == 0:

                            shares_to_buy = cash // price

                            if shares_to_buy > 0:

                                cost = shares_to_buy * price

                                cash -= cost

                                position = shares_to_buy

                                trades.append({

                                    'entryDate': date,

                                    'exitDate': None,

                                    'entryPrice': price,

                                    'exitPrice': None,

                                    'pnl': 0,

                                    'returnPct': 0,

                                    'holdingPeriod': 0,

                                    'position': 1,

                                    'action': 'BUY',

                                    'quantity': shares_to_buy,

                                    'symbol': symbol

                                })



                    # MACD线下穿信号线 - 卖出信号

                    elif histogram[i] < 0 and (i == 0 or histogram[i-1] >= 0):

                        if position > 0:

                            value = position * price

                            cash += value

                            # 更新最近一次交易的退出信息

                            for trade in reversed(trades):

                                if trade.get('exitDate') is None and trade.get('action') == 'BUY':

                                    entry_price = trade['entryPrice']

                                    pnl = (price - entry_price) * trade['quantity']

                                    return_pct = ((price - entry_price) / entry_price) * 100 if entry_price > 0 else 0



                                    trade['exitDate'] = date

                                    trade['exitPrice'] = price

                                    trade['pnl'] = round(pnl, 2)

                                    trade['returnPct'] = round(return_pct, 2)

                                    trade['holdingPeriod'] = i - next((idx for idx, p in enumerate(data) if p['timestamp'] == trade['entryDate']), i)

                                    break

                            position = 0



                # 计算当前权益

                equity = cash + (position * price)

                equity_curve.append({

                    'date': date,

                    'equity': equity,

                    'price': price

                })



            return trades, equity_curve



        # 简化回测逻辑 - 基于历史数据生成模拟结果

        if historical_data and len(historical_data) > 0:

            # 计算基本统计

            first_close = historical_data[0]['close']

            last_close = historical_data[-1]['close']

            price_change = last_close - first_close

            price_change_pct = (price_change / first_close) * 100 if first_close > 0 else 0



            # 根据策略类型执行不同的算法

            trades = []

            equity_curve = []



            # 支持的策略映射

            supported_strategies = {

                'moving_average': run_moving_average_strategy,

                'rsi': run_rsi_strategy,

                'macd': run_macd_strategy,

                'bollinger': run_bollinger_strategy,

                'momentum': run_momentum_strategy

            }



            strategy_fn = supported_strategies.get(strategy)

            if strategy_fn is None:

                print(f"[Backtest] 不支持的策略: '{strategy}'")

                return jsonify({

                    "success": False,

                    "error": f"不支持的策略: {strategy}",

                    "supportedStrategies": list(supported_strategies.keys()),

                    "backtestId": backtest_id,

                    "results": None,

                    "chartData": None,

                    "trades": None,

                    "parameters": {

                        "symbol": symbol,

                        "symbols": [symbol],

                        "strategy": strategy,

                        "startDate": start_date,

                        "endDate": end_date,

                        "period": f"{start_date} to {end_date}",

                        "initialCapital": initial_capital,

                        "dataMode": "real",

                        "dataModeDisplay": "Real Data",

                        "dataSource": "Unsupported strategy",

                        "parameters": parameters

                    }

                }), 400



            print(f"[Backtest] 执行{strategy}策略，参数: {parameters}")

            # 调用策略函数，获取trades和equity_curve

            strategy_result = strategy_fn(historical_data, parameters, initial_capital, symbol)



            # 处理返回值（兼容旧版本和新版本）

            if len(strategy_result) == 3:

                trades, equity_curve, chart_data = strategy_result

            else:

                trades, equity_curve = strategy_result

                # 如果没有chart_data，使用historical_data构建基本的chart_data

                chart_data = []

                for i, data_point in enumerate(historical_data):

                    # 计算权益（简化版本）

                    equity = initial_capital

                    if equity_curve and i < len(equity_curve):

                        equity = equity_curve[i]['equity']



                    chart_data.append({

                        'date': data_point['timestamp'],

                        'open': data_point['open'],

                        'high': data_point['high'],

                        'low': data_point['low'],

                        'close': data_point['close'],

                        'volume': data_point['volume'],

                        'price': data_point['close'],

                        'equity': equity

                    })



            # 计算最终结果

            final_equity = equity_curve[-1]['equity'] if equity_curve else initial_capital

            total_return = ((final_equity - initial_capital) / initial_capital) * 100

            profit_loss = final_equity - initial_capital



            # 计算最大回撤

            max_drawdown = 0

            peak = initial_capital

            for point in equity_curve:

                equity_val = point['equity']

                if equity_val > peak:

                    peak = equity_val

                drawdown = (peak - equity_val) / peak * 100

                if drawdown > max_drawdown:

                    max_drawdown = drawdown



            # ========== 统一的交易统计口径 ==========

            # 1. 定义：已平仓交易 (closed trades) - 有exitDate的交易

            completed_trades = [t for t in trades if t.get('exitDate') is not None]



            # 2. 定义：未平仓交易 (open trades) - 没有exitDate的交易

            open_trades = [t for t in trades if t.get('exitDate') is None]



            # 3. 强制平仓：如果回测结束时还有未平仓头寸，强制平仓

            forced_liquidation_pnl = 0

            if open_trades and equity_curve:

                last_price = equity_curve[-1]['price']

                last_date = equity_curve[-1]['date']

                for trade in open_trades:

                    entry_price = trade.get('entryPrice', 0)

                    quantity = trade.get('quantity', 0)

                    pnl = (last_price - entry_price) * quantity



                    # 更新交易记录

                    trade['exitDate'] = last_date

                    trade['exitPrice'] = last_price

                    trade['pnl'] = round(pnl, 2)

                    trade['returnPct'] = round(((last_price - entry_price) / entry_price * 100), 2) if entry_price > 0 else 0



                    forced_liquidation_pnl += pnl

                    completed_trades.append(trade)



                # 为强制平仓添加信号（-2表示强制平仓）

                # 找到chartData中对应的最后一天

                if chart_data:

                    for i, data_point in enumerate(chart_data):

                        if data_point.get('date') == last_date:

                            chart_data[i]['signal'] = -2  # -2表示强制平仓

                            break



            # 4. 基于已平仓交易计算所有指标

            # 分离盈利、亏损、盈亏平衡交易（使用严格定义）

            winning_trades = [t for t in completed_trades if t.get('pnl', 0) > 0.01]  # 大于1分钱才算盈利

            losing_trades = [t for t in completed_trades if t.get('pnl', 0) < -0.01]  # 小于-1分钱才算亏损

            breakeven_trades = [t for t in completed_trades if abs(t.get('pnl', 0)) <= 0.01]  # 绝对值<=1分钱算持平



            # 5. 计算gross profit/loss (只考虑已实现盈亏)

            gross_profit = sum(t.get('pnl', 0) for t in winning_trades)

            gross_loss = abs(sum(t.get('pnl', 0) for t in losing_trades))

            net_profit_from_trades = gross_profit - gross_loss



            # 6. 验证一致性：net_profit_from_trades 应该等于 profit_loss (final_equity - initial_capital)

            # 因为我们已经强制平仓了所有未平仓头寸

            consistency_check = abs(net_profit_from_trades - profit_loss) < 0.01



            if not consistency_check:

                print(f"[Backtest] 警告: 交易PNL总和({net_profit_from_trades:.2f})与最终盈亏({profit_loss:.2f})不一致")

                # 使用交易PNL总和作为净利润（更准确）

                profit_loss = net_profit_from_trades

                final_equity = initial_capital + profit_loss

                total_return = (profit_loss / initial_capital) * 100



            # 7. 计算其他指标

            total_closed_trades = len(completed_trades)

            total_winning_trades = len(winning_trades)

            total_losing_trades = len(losing_trades)

            total_breakeven_trades = len(breakeven_trades)



            # win rate基于盈利交易占所有非持平交易的比例

            non_breakeven_trades = total_winning_trades + total_losing_trades

            win_rate = (total_winning_trades / non_breakeven_trades * 100) if non_breakeven_trades > 0 else 0



            avg_win = sum(t.get('pnl', 0) for t in winning_trades) / len(winning_trades) if winning_trades else 0

            avg_loss = sum(t.get('pnl', 0) for t in losing_trades) / len(losing_trades) if losing_trades else 0



            # 8. 正确计算profit factor

            profit_factor = gross_profit / gross_loss if gross_loss > 0 else None



            # 9. 计算expectancy

            expectancy = ((win_rate / 100) * avg_win) - ((1 - win_rate / 100) * abs(avg_loss)) if total_closed_trades > 0 else 0



            print(f"[Backtest] 交易统计:")

            print(f"  总交易数: {len(trades)}")

            print(f"  已平仓交易: {total_closed_trades}")

            print(f"  盈利交易: {len(winning_trades)}")

            print(f"  亏损交易: {len(losing_trades)}")

            print(f"  盈亏平衡交易: {len(breakeven_trades)}")

            print(f"  总盈利: ${gross_profit:.2f}")

            print(f"  总亏损: ${gross_loss:.2f}")

            print(f"  净利润: ${profit_loss:.2f}")

            print(f"  胜率: {win_rate:.1f}%")

            print(f"  Profit Factor: {profit_factor}")

            print(f"  强制平仓PNL: ${forced_liquidation_pnl:.2f}")



            # 计算波动率（基于权益曲线）

            equity_values = [point['equity'] for point in equity_curve]

            if len(equity_values) > 1:

                # 计算日收益率（百分比）

                returns = [(equity_values[i] - equity_values[i-1]) / equity_values[i-1] * 100 for i in range(1, len(equity_values))]



                if len(returns) > 1:

                    # 计算平均日收益率（百分比）

                    mean_return = sum(returns) / len(returns)



                    # 计算样本标准差（波动率）- 使用样本标准差公式

                    variance = sum((r - mean_return) ** 2 for r in returns) / (len(returns) - 1)

                    volatility = variance ** 0.5



                    # 计算下行波动率（只考虑负收益）

                    downside_returns = [r for r in returns if r < 0]

                    if len(downside_returns) > 0:

                        downside_variance = sum(r ** 2 for r in downside_returns) / len(downside_returns)

                        downside_volatility = downside_variance ** 0.5

                    else:

                        downside_volatility = 0

                else:

                    volatility = 0

                    downside_volatility = 0

                    mean_return = returns[0] if returns else 0

            else:

                volatility = 0

                downside_volatility = 0

                mean_return = 0



            # 计算实际交易日数量

            trading_days = len(historical_data)



            # 计算风险调整收益

            # 假设无风险利率为0%

            risk_free_rate = 0



            # 年化因子：√252（假设日数据）

            annualization_factor = (252) ** 0.5 if trading_days > 0 else 1



            # Sharpe Ratio（年化）

            # 公式：(平均日收益率 - 无风险日利率) / 日收益率标准差 * √252

            daily_risk_free = risk_free_rate / 252

            sharpe_ratio = ((mean_return - daily_risk_free) / volatility * annualization_factor) if volatility > 0 else 0



            # Sortino Ratio（年化，使用下行波动率）

            # 公式：(平均日收益率 - 无风险日利率) / 下行波动率 * √252

            sortino_ratio = ((mean_return - daily_risk_free) / downside_volatility * annualization_factor) if downside_volatility > 0 else 0



            # 计算年化收益率

            # 使用复利公式：年化收益率 = ((1 + total_return/100)^(252/trading_days) - 1) * 100

            if trading_days > 0 and total_return != 0:

                total_return_decimal = total_return / 100

                years = trading_days / 252  # 假设252个交易日/年

                annualized_return = ((1 + total_return_decimal) ** (1/years) - 1) * 100 if years > 0 else total_return

            else:

                annualized_return = total_return



            # 生成结果 - 统一口径

            results = {

                # 核心收益指标

                "totalReturn": round(total_return, 2),

                "profitLoss": round(profit_loss, 2),

                "annualizedReturn": round(annualized_return, 2),



                # 风险指标

                "maxDrawdown": round(max_drawdown, 2),

                "volatility": round(volatility, 2),

                "sharpeRatio": round(sharpe_ratio, 2),

                "sortinoRatio": round(sortino_ratio, 2),

                "calmarRatio": round(annualized_return / max(1, max_drawdown), 2),



                # 交易统计 - 统一口径

                "trades": len(completed_trades),  # 已平仓交易数

                "winningTrades": len(winning_trades),

                "losingTrades": len(losing_trades),

                "breakevenTrades": len(breakeven_trades),

                "winRate": round(win_rate, 2),



                # PNL分解 - 统一口径

                "grossProfit": round(gross_profit, 2),

                "grossLoss": round(gross_loss, 2),

                "netProfit": round(profit_loss, 2),  # 与profitLoss一致



                # 交易质量指标

                "avgReturnPerTrade": round(profit_loss / max(1, len(completed_trades)), 2),

                "profitFactor": round(profit_factor, 2) if profit_factor is not None else None,

                "expectancy": round(expectancy, 2),

                "avgWin": round(avg_win, 2) if winning_trades else 0,

                "avgLoss": round(avg_loss, 2) if losing_trades else 0,



                # 其他

                "exposure": round((sum(point['equity'] for point in equity_curve) / len(equity_curve)) / initial_capital * 100, 2) if equity_curve else 0,

                "equityCurve": equity_curve,  # 添加equityCurve字段

                "chartData": chart_data,      # 使用完整的图表数据

                "tradesList": completed_trades,

                "forcedLiquidation": round(forced_liquidation_pnl, 2) if forced_liquidation_pnl != 0 else 0,

                "consistencyCheck": consistency_check

            }



            print(f"[Backtest] 回测完成，总收益: {total_return:.2f}%")



        else:

            print(f"[Backtest] 错误: 没有历史数据，但之前的检查未捕获此情况")

            # 返回错误响应，而不是假成功结果

            return jsonify({

                "success": False,

                "error": "No historical data available for backtest (edge case)",

                "backtestId": backtest_id,

                "results": None,

                "chartData": None,

                "trades": None,

                "parameters": {

                    "symbol": symbol,

                    "symbols": [symbol],

                    "strategy": strategy,

                    "startDate": start_date,

                    "endDate": end_date,

                    "period": f"{start_date} to {end_date}",

                    "initialCapital": initial_capital,

                    "dataMode": "real",

                    "dataModeDisplay": "Real Data",

                    "dataSource": data_source_note if data_source_note and data_source_note.strip() else "Alpaca",

                    "parameters": parameters

                }

            }), 200



        stage3_time = time.time() - stage3_start

        print(f"[Backtest] 阶段3完成，耗时: {stage3_time:.2f}秒")



        total_time = time.time() - total_start

        print(f"[Backtest] 全部完成，总耗时: {total_time:.2f}秒")



        # 创建返回结果 - 包装在result字段中，以匹配前端期望

        result = {

            "success": True,

            "result": {

                "backtestId": backtest_id,

                "results": results,

                "chartData": results["chartData"],

                "trades": results["tradesList"],

                "parameters": {

                    "symbol": symbol,

                    "symbols": [symbol],

                    "strategy": strategy,

                    "startDate": start_date,

                    "endDate": end_date,

                    "period": f"{start_date} to {end_date}",

                    "initialCapital": initial_capital,

                    "dataMode": "real",

                    "dataModeDisplay": "Real Data",

                    "dataSource": data_source_note if data_source_note and data_source_note.strip() else "Alpaca",

                    "parameters": parameters  # 添加策略参数

                }

            }

        }



        # 将backtest结果保存到全局history中

        try:

            with backtest_history_lock:

                # 创建history记录

                history_record = {

                    "backtestId": backtest_id,

                    "status": "completed",

                    "createdAt": time.strftime("%Y-%m-%d %H:%M:%S", time.localtime()),

                    "parameters": result["parameters"],

                    "results": results

                }



                # 检查是否是完全重复的记录（相同symbol、strategy、参数、结果）

                is_duplicate = False

                for existing in backtest_history[:10]:  # 只检查最近10条记录

                    if (existing.get("parameters", {}).get("symbol") == result["parameters"].get("symbol") and

                        existing.get("parameters", {}).get("strategy") == result["parameters"].get("strategy") and

                        existing.get("parameters", {}).get("startDate") == result["parameters"].get("startDate") and

                        existing.get("parameters", {}).get("endDate") == result["parameters"].get("endDate") and

                        existing.get("results", {}).get("totalReturn") == results.get("totalReturn")):



                        # 如果是完全重复的记录，更新创建时间但不新增

                        existing["createdAt"] = history_record["createdAt"]

                        print(f"[Backtest History] 更新重复记录时间: {backtest_id}")

                        is_duplicate = True

                        break



                if not is_duplicate:

                    # 添加到history列表开头（最新记录在前）

                    backtest_history.insert(0, history_record)



                    # 限制history大小

                    if len(backtest_history) > MAX_HISTORY_SIZE:

                        backtest_history.pop()  # 移除最旧的记录



                    print(f"[Backtest History] 已保存backtest记录: {backtest_id}")

                    print(f"[Backtest History] 当前history大小: {len(backtest_history)}")

                else:

                    print(f"[Backtest History] 跳过重复记录: {backtest_id}")

        except Exception as e:

            print(f"[Backtest History] 保存失败: {e}")



        # ========== DEBUG Layer D: 最终返回给AI Agent recommendation时 ==========

        print(f"=== DEBUG Layer D: 最终返回给AI Agent recommendation时 ({symbol}) ===")

        print(f"symbol: {symbol}")

        print(f"backtestId: {backtest_id}")

        print(f"totalReturn: {results.get('totalReturn')}")

        print(f"sharpeRatio: {results.get('sharpeRatio')}")

        print(f"maxDrawdown: {results.get('maxDrawdown')}")

        

        # 检查trade records里的symbol

        trades_list = results.get('tradesList', [])

        if trades_list:

            if len(trades_list) > 0:

                print(f"first trade symbol: {trades_list[0].get('symbol')}")

            if len(trades_list) > 1:

                print(f"last trade symbol: {trades_list[-1].get('symbol')}")

        else:

            print(f"trades_list为空")

        print(f"==========================================================")

        # ========== END DEBUG ==========

        

        return jsonify(result)



    except Exception as e:

        total_time = time.time() - total_start

        print(f"[Backtest] 异常: {str(e)}，总耗时: {total_time:.2f}秒")

        return jsonify({

            "success": False,

            "error": str(e),

            "result": {

                "backtestId": "error-" + str(int(time.time())),

                "results": None,

                "chartData": None,

                "trades": None,

                "parameters": None

            }

        }), 500



def generate_simulation_result(strategy, rank, params, initial_capital):

    """生成模拟的优化结果 - 已弃用，仅用于向后兼容"""

    print(f"[WARNING] generate_simulation_result被调用，策略={strategy}, 参数={params}")

    print(f"[WARNING] 此函数已弃用，应使用真实Alpaca数据进行回测")

    

    # 返回一个明显的错误结果，表明这是模拟数据

    return {

        'rank': rank,

        'totalReturn': 0.0,

        'annualizedReturn': 0.0,

        'sharpeRatio': 0.0,

        'maxDrawdown': 0.0,

        'trades': 0,

        'winRate': 0.0,

        'profitFactor': 0.0,

        'parameters': params,

        'dataSource': 'SIMULATED (DEPRECATED)',

        'dataPoints': 0,

        'warning': 'This result is simulated and deprecated. Use real Alpaca data instead.'

    }



@app.route('/backtest/history', methods=['GET'])

@app.route('/api/backtest/history', methods=['GET'])

def get_backtest_history():

    """获取回测历史 - 返回真实的backtest历史数据"""

    try:

        print(f"[Backtest History] 收到回测历史请求")

        print(f"[Backtest History] backtest_history id: {id(backtest_history)}")

        print(f"[Backtest History] backtest_history 大小: {len(backtest_history)}")



        # 使用全局的backtest_history数据

        with backtest_history_lock:

            # 返回最新的历史记录（按createdAt倒序）

            sorted_history = sorted(

                backtest_history,

                key=lambda x: x.get("createdAt", ""),

                reverse=True

            )



            print(f"[Backtest History] 返回 {len(sorted_history)} 条真实回测历史记录")



            # 如果没有真实历史数据，返回空数组

            if len(sorted_history) == 0:

                print(f"[Backtest History] 没有真实回测历史数据")

                return jsonify({

                    "success": True,

                    "history": [],

                    "count": 0,

                    "message": "No real backtest history available"

                }), 200



            return jsonify({

                "success": True,

                "history": sorted_history,

                "count": len(sorted_history),

                "message": f"Found {len(sorted_history)} real backtest records"

            }), 200



    except Exception as e:

        print(f"[Backtest History] 异常: {e}")

        return jsonify({

            "success": False,

            "error": str(e),

            "history": [],

            "count": 0,

            "message": "Error loading backtest history"

        }), 500



# ==================== 策略函数 (用于优化) ====================



def run_moving_average_strategy_for_optimization(data, params, initial_capital, symbol):

    """移动平均线交叉策略 - 简化版用于优化"""

    try:

        short_period = params.get('shortMaPeriod', 20)

        long_period = params.get('longMaPeriod', 50)



        trades = []

        equity_curve = []

        position = 0

        cash = initial_capital



        # 计算移动平均线

        prices = [point['close'] for point in data]

        sma_short = []

        sma_long = []



        for i in range(len(prices)):

            if i >= short_period:

                sma_short.append(sum(prices[i-short_period:i]) / short_period)

            else:

                sma_short.append(prices[i])



            if i >= long_period:

                sma_long.append(sum(prices[i-long_period:i]) / long_period)

            else:

                sma_long.append(prices[i])



        # 执行交易策略

        for i, data_point in enumerate(data):

            date = data_point['timestamp']

            price = data_point['close']



            # 交易信号

            if i >= max(short_period, long_period):

                # 短期均线上穿长期均线 - 买入信号

                if sma_short[i] > sma_long[i] and (i == 0 or sma_short[i-1] <= sma_long[i-1]):

                    if cash > 0 and position == 0:

                        shares_to_buy = cash // price

                        if shares_to_buy > 0:

                            cost = shares_to_buy * price

                            cash -= cost

                            position = shares_to_buy

                            trades.append({

                                'entryDate': date,

                                'entryPrice': price,

                                'quantity': shares_to_buy,

                                'action': 'BUY'

                            })



                # 短期均线下穿长期均线 - 卖出信号

                elif sma_short[i] < sma_long[i] and (i == 0 or sma_short[i-1] >= sma_long[i-1]):

                    if position > 0:

                        value = position * price

                        cash += value

                        # 更新最近一次交易的退出信息

                        for trade in reversed(trades):

                            if trade.get('exitDate') is None and trade.get('action') == 'BUY':

                                trade['exitDate'] = date

                                trade['exitPrice'] = price

                                break

                        position = 0



            # 计算当前权益

            equity = cash + (position * price)

            equity_curve.append({

                'date': date,

                'equity': equity,

                'price': price

            })



        return trades, equity_curve



    except Exception as e:

        print(f"[MA Strategy Error] {str(e)}")

        # 返回空结果而不是抛出异常

        return [], []



def run_rsi_strategy_for_optimization(data, params, initial_capital, symbol):

    """RSI策略 - 简化版用于优化"""

    try:

        rsi_period = params.get('rsiPeriod', 14)

        oversold_level = params.get('oversoldLevel', 30)

        overbought_level = params.get('overboughtLevel', 70)



        trades = []

        equity_curve = []

        position = 0

        cash = initial_capital



        # 计算RSI

        prices = [point['close'] for point in data]

        rsi_values = []



        for i in range(len(prices)):

            if i < rsi_period:

                rsi_values.append(50)  # 默认值

                continue



            # 计算价格变化

            gains = []

            losses = []

            for j in range(i - rsi_period, i):

                change = prices[j + 1] - prices[j]

                if change > 0:

                    gains.append(change)

                    losses.append(0)

                else:

                    gains.append(0)

                    losses.append(abs(change))



            avg_gain = sum(gains) / rsi_period

            avg_loss = sum(losses) / rsi_period



            if avg_loss == 0:

                rsi = 100

            else:

                rs = avg_gain / avg_loss

                rsi = 100 - (100 / (1 + rs))



            rsi_values.append(rsi)



        # 执行交易策略

        for i, data_point in enumerate(data):

            date = data_point['timestamp']

            price = data_point['close']



            # 交易信号

            if i >= rsi_period:

                rsi = rsi_values[i]



                # RSI低于超卖线 - 买入信号

                if rsi < oversold_level and position == 0:

                    if cash > 0:

                        shares_to_buy = cash // price

                        if shares_to_buy > 0:

                            cost = shares_to_buy * price

                            cash -= cost

                            position = shares_to_buy

                            trades.append({

                                'entryDate': date,

                                'entryPrice': price,

                                'quantity': shares_to_buy,

                                'action': 'BUY'

                            })



                # RSI高于超买线 - 卖出信号

                elif rsi > overbought_level and position > 0:

                    value = position * price

                    cash += value

                    # 更新最近一次交易的退出信息

                    for trade in reversed(trades):

                        if trade.get('exitDate') is None and trade.get('action') == 'BUY':

                            trade['exitDate'] = date

                            trade['exitPrice'] = price

                            break

                    position = 0



            # 计算当前权益

            equity = cash + (position * price)

            equity_curve.append({

                'date': date,

                'equity': equity,

                'price': price

            })



        return trades, equity_curve



    except Exception as e:

        print(f"[RSI Strategy Error] {str(e)}")

        # 返回空结果而不是抛出异常

        return [], []



@app.route('/backtest/optimize', methods=['POST'])

@app.route('/api/backtest/optimize', methods=['POST'])

def run_parameter_optimization():

    """运行参数优化 - 使用Alpaca数据生成真实结果"""

    total_start = time.time()



    try:

        data = request.get_json()

        print(f"[Optimization] 收到参数优化请求: {data}")



        # 提取配置

        symbol = data.get('symbol', 'AAPL')

        strategy = data.get('strategy', 'moving_average')

        start_date = data.get('startDate', '2024-01-01')

        end_date = data.get('endDate', '2024-12-31')

        initial_capital = data.get('initialCapital', 100000)



        # 参数范围 - 根据策略提取不同的参数

        strategy = data.get('strategy', 'moving_average')



        if strategy == 'moving_average':

            short_ma_range = data.get('shortMaRange', {'start': 5, 'end': 50, 'step': 5})

            long_ma_range = data.get('longMaRange', {'start': 50, 'end': 200, 'step': 25})

            param_ranges = {'short_ma': short_ma_range, 'long_ma': long_ma_range}

        elif strategy == 'rsi':

            rsi_period_range = data.get('rsiPeriodRange', {'start': 10, 'end': 30, 'step': 2})

            oversold_range = data.get('oversoldRange', {'start': 20, 'end': 40, 'step': 5})

            overbought_range = data.get('overboughtRange', {'start': 60, 'end': 80, 'step': 5})

            param_ranges = {'rsi_period': rsi_period_range, 'oversold': oversold_range, 'overbought': overbought_range}

        elif strategy == 'macd':

            fast_range = data.get('fastRange', {'start': 8, 'end': 20, 'step': 2})

            slow_range = data.get('slowRange', {'start': 21, 'end': 35, 'step': 3})

            signal_range = data.get('signalRange', {'start': 5, 'end': 15, 'step': 2})

            param_ranges = {'fast': fast_range, 'slow': slow_range, 'signal': signal_range}

        elif strategy == 'bollinger':

            period_range = data.get('periodRange', {'start': 10, 'end': 30, 'step': 2})

            std_dev_range = data.get('stdDevRange', {'start': 1.5, 'end': 3.0, 'step': 0.5})

            param_ranges = {'period': period_range, 'std_dev': std_dev_range}

        elif strategy == 'momentum':

            momentum_period_range = data.get('momentumPeriodRange', {'start': 5, 'end': 30, 'step': 5})

            param_ranges = {'momentum_period': momentum_period_range}

        else:

            # 默认使用MA参数

            short_ma_range = data.get('shortMaRange', {'start': 5, 'end': 50, 'step': 5})

            long_ma_range = data.get('longMaRange', {'start': 50, 'end': 200, 'step': 25})

            param_ranges = {'short_ma': short_ma_range, 'long_ma': long_ma_range}

            strategy = 'moving_average'  # 强制使用MA策略



        # 生成优化ID

        import uuid

        optimization_id = str(uuid.uuid4())[:8]



        print(f"[Optimization] 开始处理参数优化，ID: {optimization_id}")

        print(f"[Optimization] 策略: {strategy}")

        print(f"[Optimization] 参数范围: {param_ranges}")

        print(f"[Optimization] 数据源: Alpaca")



        # 第一步：获取Alpaca历史数据

        print(f"[Optimization] 获取Alpaca历史数据: {symbol}, {start_date} 到 {end_date}")

        

        # 计算日期差以确定合适的timeframe

        from datetime import datetime

        start_dt = datetime.strptime(start_date, '%Y-%m-%d')

        end_dt = datetime.strptime(end_date, '%Y-%m-%d')

        days_diff = (end_dt - start_dt).days

        

        # 总是使用1Day timeframe进行优化

        timeframe = '1Day'

        # 使用正确的range_param格式：start_date to end_date

        range_param = f"{start_date} to {end_date}"

        

        print(f"[Optimization] 时间范围: {days_diff} 天，使用timeframe: {timeframe}, range: {range_param}")

        

        # 获取Alpaca历史数据 - 100%使用真实Alpaca bars，禁止模拟数据

        print(f"[Optimization] 获取Alpaca历史数据: {symbol}, {start_date} 到 {end_date}")

        print(f"[Optimization] 使用timeframe: {timeframe}, range: {range_param}")

        

        # 调用Alpaca历史数据获取函数

        historical_data, success, data_source = get_alpaca_history_for_backtest(symbol, timeframe, range_param)

        

        print(f"[Optimization] historical_data获取结果: success={success}, data_source={data_source}")

        print(f"[Optimization] historical_data length = {len(historical_data) if historical_data else 0}")

        

        if historical_data and len(historical_data) > 0:

            print(f"[Optimization] first bar = {historical_data[0]}")

            print(f"[Optimization] last bar = {historical_data[-1]}")

        else:

            print(f"[Optimization] historical_data为空或长度为0")

        

        # 严格检查：如果Alpaca数据获取失败或数据不足，直接返回错误

        if not success:

            print(f"[Optimization] 错误: Alpaca历史数据获取失败 - {data_source}")

            return jsonify({

                "success": False,

                "result": {

                    "error": f"Alpaca historical bars unavailable: {data_source}",

                    "optimizationId": optimization_id,

                    "results": [],

                    "summary": None,

                    "parameters": {

                        "symbol": symbol,

                        "strategy": strategy,

                        "startDate": start_date,

                        "endDate": end_date,

                        "initialCapital": initial_capital,

                        "dataSource": "Alpaca (failed)",

                        "historicalDataPoints": 0

                    }

                }

            }), 400

        

        if not historical_data or len(historical_data) == 0:

            print(f"[Optimization] 错误: Alpaca返回空数据")

            return jsonify({

                "success": False,

                "result": {

                    "error": "No Alpaca data returned for optimization",

                    "optimizationId": optimization_id,

                    "results": [],

                    "summary": None,

                    "parameters": {

                        "symbol": symbol,

                        "strategy": strategy,

                        "startDate": start_date,

                        "endDate": end_date,

                        "initialCapital": initial_capital,

                        "dataSource": "Alpaca (empty)",

                        "historicalDataPoints": 0

                    }

                }

            }), 400

        

        # 检查数据点是否足够进行优化 - 基于最大参数值动态计算

        # 对于移动平均策略，至少需要 max(long_ma) + 10 个数据点（10个点作为缓冲）

        min_required_bars = 2  # 默认最小值

        

        if strategy == 'moving_average':

            max_long_ma = param_ranges.get('long_ma', {}).get('end', 200)

            min_required_bars = max_long_ma + 10

            print(f"[Optimization] MA策略检查: max_long_ma={max_long_ma}, 需要至少 {min_required_bars} 个数据点")

        elif strategy == 'rsi':

            max_rsi_period = param_ranges.get('rsi_period', {}).get('end', 30)

            min_required_bars = max_rsi_period + 10

            print(f"[Optimization] RSI策略检查: max_rsi_period={max_rsi_period}, 需要至少 {min_required_bars} 个数据点")

        elif strategy == 'macd':

            max_slow = param_ranges.get('slow', {}).get('end', 35)

            min_required_bars = max_slow + 10

            print(f"[Optimization] MACD策略检查: max_slow={max_slow}, 需要至少 {min_required_bars} 个数据点")

        elif strategy == 'bollinger':

            max_period = param_ranges.get('period', {}).get('end', 30)

            min_required_bars = max_period + 10

            print(f"[Optimization] Bollinger策略检查: max_period={max_period}, 需要至少 {min_required_bars} 个数据点")

        elif strategy == 'momentum':

            max_momentum_period = param_ranges.get('momentum_period', {}).get('end', 30)

            min_required_bars = max_momentum_period + 10

            print(f"[Optimization] Momentum策略检查: max_momentum_period={max_momentum_period}, 需要至少 {min_required_bars} 个数据点")

        

        if len(historical_data) < min_required_bars:

            print(f"[Optimization] 错误: Alpaca数据点不足 ({len(historical_data)} 个点)，至少需要 {min_required_bars} 个点")

            return jsonify({

                "success": False,

                "result": {

                    "error": f"Insufficient historical bars for optimization",

                    "details": f"Required: {min_required_bars} bars, Actual: {len(historical_data)} bars",

                    "optimizationId": optimization_id,

                    "results": [],

                    "summary": None,

                    "parameters": {

                        "symbol": symbol,

                        "strategy": strategy,

                        "startDate": start_date,

                        "endDate": end_date,

                        "initialCapital": initial_capital,

                        "dataSource": "Alpaca (insufficient)",

                        "historicalDataPoints": len(historical_data),

                        "minRequiredBars": min_required_bars

                    }

                }

            }), 400

        

        print(f"[Optimization] 成功获取 {len(historical_data)} 个Alpaca历史数据点")



        # 生成优化结果 - 基于真实计算

        results = []

        rank = 1



        # 根据策略生成参数组合

        if strategy == 'moving_average':

            short_values = list(range(param_ranges['short_ma']['start'], param_ranges['short_ma']['end'] + 1, param_ranges['short_ma']['step']))

            long_values = list(range(param_ranges['long_ma']['start'], param_ranges['long_ma']['end'] + 1, param_ranges['long_ma']['step']))



            total_combinations = len(short_values) * len(long_values)

            print(f"[Optimization] 生成 {len(short_values)} x {len(long_values)} = {total_combinations} 个参数组合")

            print(f"[Optimization] short_values = {short_values}")

            print(f"[Optimization] long_values = {long_values}")



            for short_ma in short_values:

                for long_ma in long_values:

                    if short_ma >= long_ma:

                        continue  # 跳过无效组合（短期MA必须小于长期MA）



                    print(f"[Optimization] testing combo short={short_ma}, long={long_ma}")

                    

                    try:

                        print(f"[Optimization] combo start short={short_ma}, long={long_ma}")

                        

                        # 使用真实策略函数

                        params = {'shortMaPeriod': short_ma, 'longMaPeriod': long_ma}

                        trades, equity_curve = run_moving_average_strategy_for_optimization(historical_data, params, initial_capital, symbol)

                        print(f"[Optimization] trades={len(trades) if trades else 0}, equity_curve={len(equity_curve) if equity_curve else 0}")

                        

                        # 计算性能指标 - 即使没有交易也要计算

                        if not equity_curve or len(equity_curve) == 0:

                            print(f"[Optimization] 警告: equity_curve为空，创建基于价格的权益曲线")

                            # 创建基于价格变化的权益曲线（假设持有股票）

                            equity_curve = []

                            if historical_data and len(historical_data) > 0:

                                initial_price = historical_data[0]['close']

                                shares = initial_capital // initial_price if initial_price > 0 else 0

                                

                                for data_point in historical_data:

                                    current_price = data_point['close']

                                    # 即使没有买入股票，权益也随价格变化（假设持有现金等价物）

                                    if shares > 0:

                                        equity = shares * current_price

                                    else:

                                        # 现金等价物：假设现金价值随市场波动

                                        price_ratio = current_price / initial_price if initial_price > 0 else 1.0

                                        equity = initial_capital * price_ratio

                                    equity_curve.append({

                                        'date': data_point['timestamp'],

                                        'equity': equity,

                                        'price': current_price

                                    })

                            else:

                                # 如果没有历史数据，使用默认值

                                equity_curve = [{'date': int(time.time()), 'equity': initial_capital, 'price': 0}]

                        

                        # 确保有足够的数据点

                        if len(equity_curve) < 2:

                            print(f"[Optimization] 跳过: equity_curve数据点不足 ({len(equity_curve)})")

                            continue

                        

                        # 计算总回报率

                        initial_equity = equity_curve[0]['equity']

                        final_equity = equity_curve[-1]['equity']

                        total_return = ((final_equity - initial_equity) / initial_equity) * 100 if initial_equity > 0 else 0

                        

                        # 计算夏普比率（简化版）

                        returns = []

                        for i in range(1, len(equity_curve)):

                            prev_equity = equity_curve[i-1]['equity']

                            curr_equity = equity_curve[i]['equity']

                            if prev_equity > 0:

                                daily_return = (curr_equity - prev_equity) / prev_equity

                                returns.append(daily_return)

                        

                        if returns:

                            avg_return = sum(returns) / len(returns)

                            std_return = (sum((r - avg_return) ** 2 for r in returns) / len(returns)) ** 0.5

                            sharpe_ratio = (avg_return / std_return) * (252 ** 0.5) if std_return > 0 else 0

                        else:

                            sharpe_ratio = 0

                        

                        # 计算最大回撤

                        max_drawdown = 0

                        peak = equity_curve[0]['equity']

                        for point in equity_curve:

                            equity = point['equity']

                            if equity > peak:

                                peak = equity

                            drawdown = (peak - equity) / peak * 100 if peak > 0 else 0

                            if drawdown > max_drawdown:

                                max_drawdown = drawdown

                        

                        result = {

                            'rank': rank,

                            'totalReturn': round(total_return, 2),

                            'annualizedReturn': round(total_return * (252 / max(len(equity_curve), 1)), 2),

                            'sharpeRatio': round(sharpe_ratio, 3),

                            'maxDrawdown': round(-max_drawdown, 2),

                            'trades': len(trades),

                            'winRate': 50.0,  # 简化

                            'profitLoss': round(final_equity - initial_equity, 2),

                            'volatility': round(std_return * (252 ** 0.5) * 100 if returns else 0, 3),

                            'sortinoRatio': round(sharpe_ratio * 1.1, 3),  # 简化

                            'profitFactor': 1.5,  # 简化

                            # 参数拍平到顶层，兼容前端

                            'short_ma': short_ma,

                            'long_ma': long_ma,

                            # 同时保留parameters字段用于向后兼容

                            'parameters': {

                                'shortMaPeriod': short_ma,

                                'longMaPeriod': long_ma

                            },

                            'dataSource': 'Alpaca',

                            'dataPoints': len(historical_data)

                        }

                        results.append(result)

                        rank += 1

                        print(f"[Optimization] combo success short={short_ma}, long={long_ma}, return={total_return:.2f}%")

                        

                    except Exception as e:

                        print(f"[Optimization] combo failed short={short_ma}, long={long_ma}: {str(e)}")

                        import traceback

                        traceback.print_exc()



        elif strategy == 'rsi':

            rsi_period_values = list(range(param_ranges['rsi_period']['start'], param_ranges['rsi_period']['end'] + 1, param_ranges['rsi_period']['step']))

            oversold_values = list(range(param_ranges['oversold']['start'], param_ranges['oversold']['end'] + 1, param_ranges['oversold']['step']))

            overbought_values = list(range(param_ranges['overbought']['start'], param_ranges['overbought']['end'] + 1, param_ranges['overbought']['step']))



            total_combinations = len(rsi_period_values) * len(oversold_values) * len(overbought_values)

            print(f"[Optimization] 生成 {len(rsi_period_values)} x {len(oversold_values)} x {len(overbought_values)} = {total_combinations} 个RSI参数组合")



            # 限制组合数量，避免太多

            max_combinations = 1000

            count = 0

            for rsi_period in rsi_period_values:

                for oversold in oversold_values:

                    for overbought in overbought_values:

                        if oversold >= overbought:

                            continue  # 跳过无效组合（超卖必须小于超买）



                        if count >= max_combinations:

                            break



                        print(f"[Optimization] testing RSI combo period={rsi_period}, oversold={oversold}, overbought={overbought}")

                        

                        try:

                            # 使用真实RSI策略函数

                            params = {'rsiPeriod': rsi_period, 'oversoldLevel': oversold, 'overboughtLevel': overbought}

                            trades, equity_curve = run_rsi_strategy_for_optimization(historical_data, params, initial_capital, symbol)

                            print(f"[Optimization] trades={len(trades) if trades else 0}, equity_curve={len(equity_curve) if equity_curve else 0}")

                            

                            # 计算性能指标

                            if not equity_curve or len(equity_curve) < 2:

                                print(f"[Optimization] 跳过: equity_curve数据点不足 ({len(equity_curve) if equity_curve else 0})")

                                continue

                            

                            # 计算总回报率

                            initial_equity = equity_curve[0]['equity']

                            final_equity = equity_curve[-1]['equity']

                            total_return = ((final_equity - initial_equity) / initial_equity) * 100 if initial_equity > 0 else 0

                            

                            # 计算夏普比率（简化版）

                            returns = []

                            for i in range(1, len(equity_curve)):

                                prev_equity = equity_curve[i-1]['equity']

                                curr_equity = equity_curve[i]['equity']

                                if prev_equity > 0:

                                    daily_return = (curr_equity - prev_equity) / prev_equity

                                    returns.append(daily_return)

                            

                            if returns:

                                avg_return = sum(returns) / len(returns)

                                std_return = (sum((r - avg_return) ** 2 for r in returns) / len(returns)) ** 0.5

                                sharpe_ratio = (avg_return / std_return) * (252 ** 0.5) if std_return > 0 else 0

                            else:

                                sharpe_ratio = 0

                            

                            # 计算最大回撤

                            max_drawdown = 0

                            peak = equity_curve[0]['equity']

                            for point in equity_curve:

                                equity = point['equity']

                                if equity > peak:

                                    peak = equity

                                drawdown = (peak - equity) / peak * 100 if peak > 0 else 0

                                if drawdown > max_drawdown:

                                    max_drawdown = drawdown

                            

                            result = {

                                'rank': rank,

                                'rsi_period': rsi_period,

                                'oversold': oversold,

                                'overbought': overbought,

                                'totalReturn': round(total_return, 2),

                                'annualizedReturn': round(total_return * (252 / len(historical_data)), 2) if historical_data else 0,

                                'sharpeRatio': round(sharpe_ratio, 3),

                                'maxDrawdown': round(max_drawdown, 1),

                                'trades': len(trades) if trades else 0,

                                'winRate': 0,  # 简化版本，实际需要计算胜率

                                'profitFactor': 0,  # 简化版本

                                'parameters': {

                                    'rsi_period': rsi_period,

                                    'oversold': oversold,

                                    'overbought': overbought

                                }

                            }

                            

                            results.append(result)

                            rank += 1

                            count += 1

                            

                        except Exception as e:

                            print(f"[Optimization] RSI策略执行异常: {str(e)}")

                            continue



        elif strategy == 'macd':

            fast_values = list(range(param_ranges['fast']['start'], param_ranges['fast']['end'] + 1, param_ranges['fast']['step']))

            slow_values = list(range(param_ranges['slow']['start'], param_ranges['slow']['end'] + 1, param_ranges['slow']['step']))

            signal_values = list(range(param_ranges['signal']['start'], param_ranges['signal']['end'] + 1, param_ranges['signal']['step']))



            total_combinations = len(fast_values) * len(slow_values) * len(signal_values)

            print(f"[Optimization] 生成 {len(fast_values)} x {len(slow_values)} x {len(signal_values)} = {total_combinations} 个MACD参数组合")



            # 限制组合数量，避免太多

            max_combinations = 1000

            count = 0

            for fast in fast_values:

                for slow in slow_values:

                    for signal in signal_values:

                        if fast >= slow:

                            continue  # 跳过无效组合（快线必须小于慢线）



                        if count >= max_combinations:

                            break



                        print(f"[Optimization] 警告: MACD策略暂未实现真实回测，跳过组合 fast={fast}, slow={slow}, signal={signal}")

                        count += 1

                        # 暂时跳过MACD策略的真实回测



        elif strategy == 'bollinger':

            period_values = list(range(param_ranges['period']['start'], param_ranges['period']['end'] + 1, param_ranges['period']['step']))

            std_dev_values = []

            current = param_ranges['std_dev']['start']

            while current <= param_ranges['std_dev']['end'] + 0.001:  # 处理浮点数精度

                std_dev_values.append(round(current, 2))

                current += param_ranges['std_dev']['step']



            total_combinations = len(period_values) * len(std_dev_values)

            print(f"[Optimization] 生成 {len(period_values)} x {len(std_dev_values)} = {total_combinations} 个Bollinger参数组合")



            for period in period_values:

                for std_dev in std_dev_values:

                    print(f"[Optimization] 警告: Bollinger策略暂未实现真实回测，跳过组合 period={period}, std_dev={std_dev}")

                    # 暂时跳过Bollinger策略的真实回测



        elif strategy == 'momentum':

            momentum_period_values = list(range(param_ranges['momentum_period']['start'], param_ranges['momentum_period']['end'] + 1, param_ranges['momentum_period']['step']))



            print(f"[Optimization] 生成 {len(momentum_period_values)} 个Momentum参数组合")



            for momentum_period in momentum_period_values:

                print(f"[Optimization] 警告: Momentum策略暂未实现真实回测，跳过组合 momentum_period={momentum_period}")

                # 暂时跳过Momentum策略的真实回测



        # 按夏普比率排序

        results.sort(key=lambda x: x['sharpeRatio'], reverse=True)



        # 更新排名

        for i, result in enumerate(results):

            result['rank'] = i + 1



        total_time = time.time() - total_start

        print(f"[Optimization] 完成，生成 {len(results)} 个结果，耗时: {total_time:.2f}秒")



        # 构建最佳组合信息

        best_combination = {}

        best_score = 0

        

        if results and len(results) > 0:

            best_result = results[0]

            best_score = best_result.get('sharpeRatio', 0)

            

            # 从最佳结果中提取参数

            if 'parameters' in best_result:

                best_combination = best_result['parameters']

            elif 'short_ma' in best_result and 'long_ma' in best_result:

                best_combination = {

                    'shortMaPeriod': best_result['short_ma'],

                    'longMaPeriod': best_result['long_ma']

                }

            elif 'rsi_period' in best_result and 'oversold' in best_result and 'overbought' in best_result:

                best_combination = {

                    'rsiPeriod': best_result['rsi_period'],

                    'oversoldLevel': best_result['oversold'],

                    'overboughtLevel': best_result['overbought']

                }



        return jsonify({

            "success": True,

            "result": {

                "optimizationId": optimization_id,

                "results": results,

                "summary": {

                    "totalCombinations": total_combinations if 'total_combinations' in locals() else len(results),

                    "validCombinations": len(results),

                    "bestSharpeRatio": results[0]['sharpeRatio'] if results else 0,

                    "bestTotalReturn": results[0]['totalReturn'] if results else 0,

                    "worstTotalReturn": results[-1]['totalReturn'] if results else 0,

                    "avgTotalReturn": sum(r['totalReturn'] for r in results) / len(results) if results else 0,

                    # 添加前端需要的字段

                    "bestScore": best_score,

                    "bestCombination": best_combination

                },

                "parameters": {

                    "symbol": symbol,

                    "strategy": strategy,

                    "startDate": start_date,

                    "endDate": end_date,

                    "initialCapital": initial_capital,

                    "paramRanges": param_ranges,

                    "dataSource": "Alpaca",

                    "historicalDataPoints": 252  # 模拟一年交易日

                }

            }

        })



    except Exception as e:

        total_time = time.time() - total_start

        print(f"[Optimization] 异常: {str(e)}，耗时: {total_time:.2f}秒")

        return jsonify({

            "success": False,

            "result": {

                "error": str(e),

                "optimizationId": "error-" + str(int(time.time())),

                "results": [],

                "summary": None,

                "parameters": None

            }

        }), 500



# ==================== Portfolio History 接口 ====================



@app.route('/api/ai/alpaca/portfolio/history', methods=['GET'])

def ai_alpaca_portfolio_history():

    print('=== AI Alpaca Portfolio History 请求 ===')

    range_param = request.args.get('range', '1D')



    try:

        # 尝试使用真实的 Alpaca API

        environment = alpaca_config_state.get('environment', 'paper')



        if environment == 'paper':

            api_key = alpaca_config_state.get('paper_api_key')

            api_secret = alpaca_config_state.get('paper_api_secret')

            base_url = 'https://paper-api.alpaca.markets'

        else:

            api_key = alpaca_config_state.get('live_api_key')

            api_secret = alpaca_config_state.get('live_api_secret')

            base_url = 'https://api.alpaca.markets'



        # 如果没有配置API密钥，返回空数据

        if not api_key or not api_secret:

            print('Alpaca API 密钥未配置，无法获取portfolio历史数据')

            return jsonify({

                'success': False,

                'data': [],

                'count': 0,

                'range': range_param,

                'isMockData': False,

                'message': 'Alpaca API 密钥未配置，请先配置API密钥'

            })



        # 调用真实的 Alpaca API 获取账户活动（portfolio历史）

        headers = {

            'APCA-API-KEY-ID': api_key,

            'APCA-API-SECRET-KEY': api_secret

        }



        # 计算时间范围

        import datetime

        end_date = datetime.datetime.now()



        if range_param == '1D':

            start_date = end_date - datetime.timedelta(days=1)

        elif range_param == '1W':

            start_date = end_date - datetime.timedelta(weeks=1)

        elif range_param == '1M':

            start_date = end_date - datetime.timedelta(days=30)

        elif range_param == '1Y':

            start_date = end_date - datetime.timedelta(days=365)

        else:  # All

            start_date = end_date - datetime.timedelta(days=365 * 2)  # 2年



        # 根据Alpaca API文档设置正确的参数

        # Alpaca portfolio history接口参数:

        # - period: 1D, 1W, 1M, 1A (1年), 5Y, 10Y

        # - timeframe: 1Min, 5Min, 15Min, 1H, 1D

        # - intraday_reporting: market_hours (默认) 或 continuous

        # - start/end: ISO 8601格式，America/New_York时区



        # 设置period和timeframe映射

        period_map = {

            '1D': '1D',

            '1W': '1W',

            '1M': '1M',

            '1Y': '1A',  # Alpaca使用1A表示1年

            'All': None  # All不使用period，使用start/end

        }



        timeframe_map = {

            '1D': '1Min',  # 1D使用1分钟粒度

            '1W': '1H',    # 1W使用小时粒度

            '1M': '1D',    # 1M使用日粒度

            '1Y': '1D',    # 1Y使用日粒度

            'All': '1D'    # All使用日粒度

        }



        period = period_map.get(range_param)

        timeframe = timeframe_map.get(range_param, '1Min')



        # 构建查询参数

        params = {

            'timeframe': timeframe,

            'intraday_reporting': 'market_hours'  # 使用市场时间，不包括盘前盘后

        }



        # 添加period参数（除了All）

        if period:

            params['period'] = period



        # 对于All，使用start/end参数

        if range_param == 'All':

            # 设置开始时间为账户创建时间或2年前

            import datetime

            end_date = datetime.datetime.now()

            start_date = end_date - datetime.timedelta(days=365 * 2)  # 2年

            params['start'] = start_date.strftime('%Y-%m-%d')

            params['end'] = end_date.strftime('%Y-%m-%d')



        print(f'=== 调用 Alpaca portfolio history API ===')

        print(f'URL: {base_url}/v2/account/portfolio/history')

        print(f'Params: {params}')

        print(f'API Key: {api_key[:6]}...{api_key[-4:]}')

        print(f'Environment: {environment}')



        response = requests.get(f'{base_url}/v2/account/portfolio/history', headers=headers, params=params, timeout=10)



        print(f'响应状态码: {response.status_code}')



        if response.status_code == 200:

            history_data = response.json()

            print(f'✅ 获取到portfolio历史数据')



            # 详细打印原始返回数据

            print(f'原始返回数据keys: {list(history_data.keys())}')



            # 检查timestamp

            if 'timestamp' in history_data:

                timestamps = history_data.get('timestamp', [])

                print(f'timestamp数组长度: {len(timestamps)}')

                if len(timestamps) > 0:

                    print(f'前5个timestamp: {timestamps[:5]}')

                    print(f'后5个timestamp: {timestamps[-5:]}')

                    # 转换为可读时间

                    import datetime

                    try:

                        print('转换为可读时间 (America/New_York):')

                        for i, ts in enumerate(timestamps[:3]):

                            dt = datetime.datetime.fromtimestamp(ts)

                            print(f'  [{i}] {ts} -> {dt.strftime("%Y-%m-%d %H:%M:%S")}')

                        if len(timestamps) > 3:

                            print(f'  ...')

                            for i in range(-3, 0):

                                ts = timestamps[i]

                                dt = datetime.datetime.fromtimestamp(ts)

                                print(f'  [{len(timestamps)+i}] {ts} -> {dt.strftime("%Y-%m-%d %H:%M:%S")}')

                    except Exception as e:

                        print(f'时间转换错误: {e}')

            else:

                print('❌ 没有timestamp字段')



            # 检查equity

            if 'equity' in history_data:

                equities = history_data.get('equity', [])

                print(f'equity数组长度: {len(equities)}')

                if len(equities) > 0:

                    print(f'前5个equity: {equities[:5]}')

                    print(f'后5个equity: {equities[-5:]}')

                    # 检查equity值变化

                    if len(equities) > 1:

                        print('equity值变化检查:')

                        for i in range(min(5, len(equities)-1)):

                            change = equities[i+1] - equities[i]

                            print(f'  [{i}] ${equities[i]:.2f} -> [{i+1}] ${equities[i+1]:.2f} (变化: ${change:.2f})')

            else:

                print('❌ 没有equity字段')



            # 检查profit_loss

            if 'profit_loss' in history_data:

                profit_loss = history_data.get('profit_loss', [])

                print(f'profit_loss数组长度: {len(profit_loss)}')

                if len(profit_loss) > 0:

                    print(f'前5个profit_loss: {profit_loss[:5]}')



            # 检查profit_loss_pct

            if 'profit_loss_pct' in history_data:

                profit_loss_pct = history_data.get('profit_loss_pct', [])

                print(f'profit_loss_pct数组长度: {len(profit_loss_pct)}')

                if len(profit_loss_pct) > 0:

                    print(f'前5个profit_loss_pct: {profit_loss_pct[:5]}')



            # 检查base_value

            if 'base_value' in history_data:

                print(f'base_value: {history_data.get("base_value")}')



            # 检查base_timestamp

            if 'base_timestamp' in history_data:

                print(f'base_timestamp: {history_data.get("base_timestamp")}')



            # 检查数组长度是否匹配

            if 'timestamp' in history_data and 'equity' in history_data:

                ts_len = len(history_data.get('timestamp', []))

                eq_len = len(history_data.get('equity', []))

                if ts_len != eq_len:

                    print(f'⚠️ 警告: timestamp长度({ts_len}) != equity长度({eq_len})')

                else:

                    print(f'✅ timestamp和equity长度匹配: {ts_len}')

        else:

            print(f'❌ Alpaca API 调用失败')

            print(f'响应内容: {response.text[:1000]}')



            # 处理portfolio历史数据

            data = []

            if 'timestamp' in history_data and 'equity' in history_data:

                timestamps = history_data.get('timestamp', [])

                equities = history_data.get('equity', [])

                profit_loss = history_data.get('profit_loss', [])

                profit_loss_pct = history_data.get('profit_loss_pct', [])



                print('处理数据...')

                print('timestamps长度:', len(timestamps))

                print('equities长度:', len(equities))

                print('profit_loss长度:', len(profit_loss))

                print('profit_loss_pct长度:', len(profit_loss_pct))



                # 检查是否有基准值信息

                if 'base_value' in history_data:

                    print('base_value:', history_data['base_value'])

                if 'base_timestamp' in history_data:

                    print('base_timestamp:', history_data['base_timestamp'])



                print(f'开始处理数据点...')

                valid_points = 0

                for i in range(len(timestamps)):

                    timestamp = timestamps[i]

                    equity = equities[i] if i < len(equities) else 0

                    pl = profit_loss[i] if i < len(profit_loss) else None

                    pl_pct = profit_loss_pct[i] if i < len(profit_loss_pct) else None



                    # 只添加有效的数据点

                    if timestamp and equity is not None:

                        # Alpaca返回的时间戳是Unix秒，转换为毫秒

                        timestamp_ms = int(timestamp) * 1000

                        data.append({

                            'timestamp': timestamp_ms,  # 转换为毫秒

                            'equity': float(equity),    # 主曲线数据字段

                            'pnl': float(pl) if pl is not None else 0,

                            'pnlPct': float(pl_pct) if pl_pct is not None else 0,

                            'isMockData': False

                        })

                        valid_points += 1



                        # 打印前几个点的详细信息

                        if valid_points <= 3:

                            import datetime

                            dt = datetime.datetime.fromtimestamp(timestamp)

                            print(f'  点[{i}]: timestamp={timestamp} -> {dt.strftime("%Y-%m-%d %H:%M:%S")}, equity=${equity:.2f}')



                print(f'处理完成，有效数据点: {valid_points}/{len(timestamps)}')



                print(f'处理后的数据点数量: {len(data)}')



                if len(data) > 0:

                    # 计算总变化 - 使用Alpaca提供的profit_loss_pct或自己计算

                    first_value = data[0]['equity'] if data else 0

                    last_value = data[-1]['equity'] if data else 0

                    total_change = last_value - first_value

                    total_change_pct = (total_change / first_value * 100) if first_value > 0 else 0



                    # 如果有profit_loss_pct，使用最后一个点的值

                    last_pl_pct = data[-1].get('pnlPct')

                    if last_pl_pct is not None:

                        total_change_pct = last_pl_pct * 100  # 转换为百分比

                        print(f'使用Alpaca profit_loss_pct: {last_pl_pct} -> {total_change_pct:.4f}%')



                    return jsonify({

                        'success': True,

                        'data': data,

                        'count': len(data),

                        'range': range_param,

                        'isMockData': False,

                        'total_change': round(total_change, 2),

                        'total_change_pct': round(total_change_pct, 4),

                        'first_value': round(first_value, 2),

                        'last_value': round(last_value, 2),

                        'message': '获取portfolio历史数据成功'

                    })



            # 如果没有有效数据，返回空数据

            print('Alpaca portfolio history接口返回了数据，但格式不正确或为空')

            return jsonify({

                'success': True,

                'data': [],

                'count': 0,

                'range': range_param,

                'isMockData': False,

                'message': 'Alpaca portfolio历史数据为空'

            })



        # API调用失败时返回空数据，不再返回模拟数据

        print(f'Alpaca portfolio history API 调用失败: {response.status_code} - {response.text}')

        return jsonify({

            'success': False,

            'data': [],

            'count': 0,

            'range': range_param,

            'isMockData': False,

            'message': f'Alpaca portfolio history API 调用失败 ({response.status_code})，请检查API密钥和网络连接'

        })



    except Exception as e:

        print(f'Alpaca portfolio history 接口错误: {e}')

        # 异常时返回空数据，不再返回模拟数据

        return jsonify({

            'success': False,

            'data': [],

            'count': 0,

            'range': range_param,

            'isMockData': False,

            'message': f'接口异常: {str(e)}'

        })



# ==================== 启动 ====================



def get_sector_from_multiple_sources(symbol, stock_data, news_data):

    """从多个来源获取Sector信息"""

    try:

        sector_map = {

            # Technology

            'AAPL': 'Technology', 'MSFT': 'Technology', 'GOOGL': 'Technology', 'AMZN': 'Technology',

            'META': 'Technology', 'TSLA': 'Technology', 'NVDA': 'Technology', 'AMD': 'Technology',

            'AVGO': 'Technology', 'INTC': 'Technology', 'GOOG': 'Technology', 'CSCO': 'Technology',

            'ADBE': 'Technology', 'CRM': 'Technology', 'ORCL': 'Technology', 'IBM': 'Technology',

            

            # Financials

            'JPM': 'Financials', 'BAC': 'Financials', 'C': 'Financials', 'GS': 'Financials',

            'WFC': 'Financials', 'MS': 'Financials', 'BLK': 'Financials', 'AXP': 'Financials',

            'V': 'Financials', 'MA': 'Financials', 'PYPL': 'Financials', 'SCHW': 'Financials',

            

            # Energy

            'XOM': 'Energy', 'CVX': 'Energy', 'COP': 'Energy', 'SLB': 'Energy', 'EOG': 'Energy',

            'PSX': 'Energy', 'MPC': 'Energy', 'VLO': 'Energy', 'KMI': 'Energy', 'OXY': 'Energy',

            

            # Healthcare

            'JNJ': 'Healthcare', 'UNH': 'Healthcare', 'PFE': 'Healthcare', 'MRK': 'Healthcare',

            'ABT': 'Healthcare', 'TMO': 'Healthcare', 'AMGN': 'Healthcare', 'BMY': 'Healthcare',

            'LLY': 'Healthcare', 'GILD': 'Healthcare', 'CVS': 'Healthcare', 'CI': 'Healthcare',

            

            # Consumer Defensive

            'WMT': 'Consumer Defensive', 'PG': 'Consumer Defensive', 'KO': 'Consumer Defensive',

            'PEP': 'Consumer Defensive', 'COST': 'Consumer Defensive', 'PM': 'Consumer Defensive',

            'MDLZ': 'Consumer Defensive', 'CL': 'Consumer Defensive', 'MO': 'Consumer Defensive',

            'EL': 'Consumer Defensive', 'KMB': 'Consumer Defensive', 'KHC': 'Consumer Defensive',

            

            # Consumer Cyclical

            'HD': 'Consumer Cyclical', 'MCD': 'Consumer Cyclical', 'NKE': 'Consumer Cyclical',

            'LOW': 'Consumer Cyclical', 'SBUX': 'Consumer Cyclical', 'TJX': 'Consumer Cyclical',

            'TGT': 'Consumer Cyclical', 'BKNG': 'Consumer Cyclical', 'MAR': 'Consumer Cyclical',

            

            # Industrials

            'CAT': 'Industrials', 'UPS': 'Industrials', 'UNP': 'Industrials', 'BA': 'Industrials',

            'MMM': 'Industrials', 'HON': 'Industrials', 'GE': 'Industrials', 'RTX': 'Industrials',

            'LMT': 'Industrials', 'DE': 'Industrials', 'FDX': 'Industrials',

            

            # Communication Services

            'T': 'Communication Services', 'VZ': 'Communication Services', 'CMCSA': 'Communication Services',

            'DIS': 'Communication Services', 'NFLX': 'Communication Services', 'CHTR': 'Communication Services',

            'TMUS': 'Communication Services',

            

            # Utilities

            'NEE': 'Utilities', 'DUK': 'Utilities', 'SO': 'Utilities', 'D': 'Utilities',

            'AEP': 'Utilities', 'EXC': 'Utilities', 'SRE': 'Utilities',

            

            # Real Estate

            'AMT': 'Real Estate', 'PLD': 'Real Estate', 'CCI': 'Real Estate', 'EQIX': 'Real Estate',

            'PSA': 'Real Estate', 'SPG': 'Real Estate', 'O': 'Real Estate',

            

            # Materials

            'LIN': 'Materials', 'APD': 'Materials', 'ECL': 'Materials', 'SHW': 'Materials',

            'DOW': 'Materials', 'NEM': 'Materials', 'FCX': 'Materials'

        }

        

        # 1. 首先检查预定义的映射

        if symbol.upper() in sector_map:

            return sector_map[symbol.upper()]

        

        # 2. 检查是否有新闻数据可以提供线索

        if news_data and news_data.get('topCatalyst'):

            catalyst = news_data.get('topCatalyst', '').lower()

            # 基于新闻内容推断Sector

            tech_keywords = ['tech', 'software', 'hardware', 'semiconductor', 'chip', 'ai', 'cloud', 'internet']

            finance_keywords = ['bank', 'financial', 'earnings', 'revenue', 'profit', 'dividend']

            energy_keywords = ['oil', 'gas', 'energy', 'petroleum', 'renewable', 'solar', 'wind']

            healthcare_keywords = ['pharma', 'drug', 'medical', 'health', 'hospital', 'biotech']

            

            for keyword_list, sector in [

                (tech_keywords, 'Technology'),

                (finance_keywords, 'Financials'),

                (energy_keywords, 'Energy'),

                (healthcare_keywords, 'Healthcare')

            ]:

                if any(keyword in catalyst for keyword in keyword_list):

                    return sector

        

        # 3. 如果股票数据中有相关字段，可以推断

        if stock_data.get('dataSource') == 'Alpaca':

            # Alpaca可能有一些基本分类信息（虽然有限）

            # 可以根据股票的特点推断

            pass

        

        # 4. 最后返回Unknown

        return 'Unknown'

        

    except Exception as e:

        print(f'获取 {symbol} Sector信息失败: {str(e)}')

        return 'Unknown'





def infer_sector_with_deepseek(symbol, stock_data, news_data, profile_data):

    """使用DeepSeek推断Sector信息"""

    try:

        # 检查是否有有效的API密钥

        api_key = ai_provider_config_state.get('apiKey', '')

        

        if not api_key or api_key.startswith('sk-') and len(api_key) < 30:

            print(f'[Sector Inference] 无有效的DeepSeek API密钥，无法推断 {symbol} 的sector')

            return 'Unknown'

        

        # 准备分析数据

        analysis_context = {

            'symbol': symbol,

            'companyName': profile_data.get('name', f'{symbol} Inc.'),

            'price': stock_data.get('price', 0),

            'changePercent': stock_data.get('changePercent', 0),

            'volume': stock_data.get('volume', 0),

            'topCatalyst': news_data.get('topCatalyst', 'No recent catalyst'),

            'newsSentiment': news_data.get('sentiment', 'Mixed')

        }

        

        # 构建提示

        prompt = f"""作为金融分析师，请根据以下信息推断该股票所属的行业板块(Sector)：



股票: {analysis_context['symbol']} ({analysis_context['companyName']})

价格: ${analysis_context['price']:.2f} ({analysis_context['changePercent']:.2f}%)

成交量: {analysis_context['volume']:,.0f}

最近催化剂: {analysis_context['topCatalyst']}

新闻情绪: {analysis_context['newsSentiment']}



请从以下标准行业板块中选择最合适的一个：

1. Technology (科技)

2. Financials (金融)

3. Healthcare (医疗保健)

4. Consumer Cyclical (周期性消费品)

5. Consumer Defensive (防御性消费品)

6. Energy (能源)

7. Industrials (工业)

8. Communication Services (通信服务)

9. Utilities (公用事业)

10. Real Estate (房地产)

11. Materials (原材料)



请只返回行业板块名称，不要其他解释。

例如: Technology 或 Financials 或 Healthcare"""



        # 调用DeepSeek API

        headers = {

            'Authorization': f'Bearer {api_key}',

            'Content-Type': 'application/json'

        }

        

        payload = {

            'model': ai_provider_config_state.get('model', 'deepseek-chat'),

            'messages': [{'role': 'user', 'content': prompt}],

            'max_tokens': 50,

            'temperature': 0.1,

            'stop': ['\n']

        }

        

        base_url = ai_provider_config_state.get('baseURL', 'https://api.deepseek.com')

        if not base_url.startswith('http'):

            base_url = 'https://' + base_url

        

        response = requests.post(

            f'{base_url}/chat/completions',

            headers=headers,

            json=payload,

            timeout=10

        )

        

        if response.status_code == 200:

            result = response.json()

            ai_response = result['choices'][0]['message']['content'].strip()

            

            # 验证响应是有效的sector

            valid_sectors = [

                'Technology', 'Financials', 'Healthcare', 'Consumer Cyclical',

                'Consumer Defensive', 'Energy', 'Industrials', 'Communication Services',

                'Utilities', 'Real Estate', 'Materials'

            ]

            

            if ai_response in valid_sectors:

                print(f'[Sector Inference] {symbol}: DeepSeek推断Sector为 {ai_response}')

                return ai_response

            else:

                print(f'[Sector Inference] {symbol}: DeepSeek返回无效Sector: {ai_response}')

                return 'Unknown'

        else:

            print(f'[Sector Inference] {symbol}: DeepSeek API调用失败: {response.status_code}')

            return 'Unknown'

            

    except Exception as e:

        print(f'[Sector Inference] {symbol}: 推断失败: {str(e)}')

        return 'Unknown'



# ==================== 新闻接口 ====================



def get_alpaca_news_data(symbol):

    """从Alpaca获取股票新闻数据（辅助函数）"""

    try:

        print(f'[Alpaca新闻] 尝试获取 {symbol} 的新闻')

        

        # 检查Alpaca配置

        alpaca_api_key = os.environ.get('APCA_API_KEY_ID')

        alpaca_secret_key = os.environ.get('APCA_API_SECRET_KEY')

        

        if not alpaca_api_key or not alpaca_secret_key:

            print(f'[Alpaca新闻] Alpaca API密钥未配置')

            return None

        

        # 使用Alpaca News API

        import requests

        from datetime import datetime, timedelta

        

        # 设置时间范围（最近7天）

        end_date = datetime.utcnow()

        start_date = end_date - timedelta(days=7)

        

        # 格式化日期

        start_str = start_date.strftime('%Y-%m-%dT%H:%M:%SZ')

        end_str = end_date.strftime('%Y-%m-%dT%H:%M:%SZ')

        

        # Alpaca News API URL

        url = f'https://data.alpaca.markets/v1beta1/news'

        

        headers = {

            'APCA-API-KEY-ID': alpaca_api_key,

            'APCA-API-SECRET-KEY': alpaca_secret_key

        }

        

        params = {

            'symbols': symbol,

            'start': start_str,

            'end': end_str,

            'limit': 10,

            'sort': 'desc'

        }

        

        response = requests.get(url, headers=headers, params=params, timeout=10)

        

        if response.status_code == 200:

            data = response.json()

            news_items = data.get('news', [])

            

            if news_items:

                print(f'[Alpaca新闻] 成功获取 {len(news_items)} 条新闻')

                

                # 分析新闻情绪

                sentiment = analyze_news_sentiment(news_items)

                

                # 选择最重要的新闻作为topNews

                top_news = select_top_news(news_items)

                

                return {

                    'success': True,

                    'symbol': symbol,

                    'sentiment': sentiment,

                    'eventRisk': 'Low',  # 简化处理

                    'topNews': top_news,

                    'news': news_items,

                    'source': 'alpaca'

                }

            else:

                print(f'[Alpaca新闻] 没有找到新闻')

                return {

                    'success': True,

                    'symbol': symbol,

                    'sentiment': 'Neutral',

                    'eventRisk': 'Low',

                    'topNews': None,

                    'news': [],

                    'source': 'alpaca'

                }

        else:

            print(f'[Alpaca新闻] API请求失败: {response.status_code}')

            return None

            

    except Exception as e:

        print(f'[Alpaca新闻] 获取新闻时发生错误: {str(e)}')

        return None



def analyze_news_sentiment(news_items):

    """简单分析新闻情绪"""

    if not news_items:

        return 'Neutral'

    

    # 简单的关键词分析

    positive_keywords = ['beat', 'strong', 'growth', 'positive', 'bullish', 'raise', 'upgrade']

    negative_keywords = ['miss', 'weak', 'decline', 'negative', 'bearish', 'cut', 'downgrade']

    

    positive_count = 0

    negative_count = 0

    

    for news in news_items:

        headline = news.get('headline', '').lower()

        summary = news.get('summary', '').lower()

        text = headline + ' ' + summary

        

        for keyword in positive_keywords:

            if keyword in text:

                positive_count += 1

                break

        

        for keyword in negative_keywords:

            if keyword in text:

                negative_count += 1

                break

    

    if positive_count > negative_count:

        return 'Positive'

    elif negative_count > positive_count:

        return 'Negative'

    else:

        return 'Neutral'



def select_top_news(news_items):

    """选择最重要的新闻作为topNews"""

    if not news_items:

        return None

    

    # 选择最新的新闻

    latest_news = news_items[0]

    

    return {

        'title': latest_news.get('headline', 'No title'),

        'summary': latest_news.get('summary', ''),

        'source': latest_news.get('source', 'Unknown'),

        'published': latest_news.get('created_at', latest_news.get('datetime')),

        'url': latest_news.get('url', ''),

        'sentiment': latest_news.get('sentiment', 'Neutral')

    }



@app.route('/api/market/news/<symbol>', methods=['GET'])

@app.route('/market/news/<symbol>', methods=['GET'])

def get_stock_news(symbol):

    """获取股票新闻接口 - 先尝试Alpaca，再尝试Finnhub"""

    print(f'=== 获取股票新闻请求: {symbol} ===')

    start_time = time.time()

    

    try:

        symbol_upper = symbol.upper()

        news_items = []

        source = None

        

        # 1. 先尝试Alpaca新闻API

        try:

            print(f'[新闻接口] 尝试Alpaca新闻API: {symbol_upper}')

            alpaca_news = get_alpaca_news_data(symbol_upper)

            if alpaca_news and alpaca_news.get('success') and alpaca_news.get('news'):

                news_items = alpaca_news.get('news', [])

                source = 'alpaca'

                print(f'[新闻接口] Alpaca新闻获取成功: {len(news_items)}条新闻')

            else:

                print(f'[新闻接口] Alpaca新闻获取失败或无新闻')

        except Exception as alpaca_error:

            print(f'[新闻接口] Alpaca新闻API错误: {alpaca_error}')

        

        # 2. 如果Alpaca没有新闻，尝试Finnhub

        if not news_items:

            try:

                print(f'[新闻接口] 尝试Finnhub新闻API: {symbol_upper}')

                finnhub_news = fetch_finnhub_news(symbol_upper)

                if finnhub_news:

                    news_items = finnhub_news

                    source = 'finnhub'

                    print(f'[新闻接口] Finnhub新闻获取成功: {len(news_items)}条新闻')

                else:

                    print(f'[新闻接口] Finnhub新闻获取失败或无新闻')

            except Exception as finnhub_error:

                print(f'[新闻接口] Finnhub新闻API错误: {finnhub_error}')

        

        # 3. 如果都没有新闻，返回"No recent news available"

        if not news_items:

            print(f'[新闻接口] 没有找到新闻，返回空数据')

            return jsonify({

                'success': True,

                'symbol': symbol_upper,

                'sentiment': 'Neutral',

                'eventRisk': 'Low',

                'topNews': None,

                'news': [],

                'source': 'none',

                'hasNews': False,

                'newsCount': 0

            })

        

        # 3. 分析新闻数据

        # 选择最重要的一条新闻

        top_news = None

        if news_items and len(news_items) > 0:

            # 按时间排序，选择最新的

            sorted_news = sorted(news_items, 

                               key=lambda x: x.get('published_at') or x.get('datetime') or x.get('time', 0), 

                               reverse=True)

            top_news = sorted_news[0]

            

            # 格式化top_news

            formatted_top_news = {

                'title': top_news.get('headline') or top_news.get('title') or 'No title',

                'source': top_news.get('source') or source.capitalize(),

                'published': top_news.get('published_at') or top_news.get('datetime') or top_news.get('time'),

                'summary': top_news.get('summary') or top_news.get('content', '')[:200] + '...',

                'url': top_news.get('url') or top_news.get('link'),

                'provider': source

            }

            

            # 分析新闻情绪

            sentiment = 'Neutral'

            if 'sentiment' in top_news:

                # 如果新闻数据中已经有sentiment字段，直接使用

                sentiment = top_news.get('sentiment', 'Neutral')

            else:

                title = (top_news.get('headline') or top_news.get('title') or '').lower()

                if any(word in title for word in ['up', 'gain', 'rise', 'beat', 'positive', 'bullish', 'strong', 'raise']):

                    sentiment = 'Positive'

                elif any(word in title for word in ['down', 'fall', 'drop', 'miss', 'negative', 'bearish', 'weak', 'cut']):

                    sentiment = 'Negative'

            

            # 判断事件风险

            title_summary = (formatted_top_news['title'] + ' ' + formatted_top_news['summary']).lower()

            high_risk_keywords = ['lawsuit', 'investigation', 'recall', 'warning', 'fraud', 'bankruptcy']

            medium_risk_keywords = ['earnings', 'guidance', 'downgrade', 'cut', 'delay']

            

            if any(word in title_summary for word in high_risk_keywords):

                event_risk = 'High'

            elif any(word in title_summary for word in medium_risk_keywords):

                event_risk = 'Medium'

            else:

                event_risk = 'Low'

        else:

            formatted_top_news = None

            sentiment = None

            event_risk = None

        

        # 4. 构建响应

        response_data = {

            'success': True,

            'symbol': symbol_upper,

            'news': news_items[:5],  # 返回前5条新闻

            'topNews': formatted_top_news,

            'sentiment': sentiment,

            'eventRisk': event_risk,

            'newsCount': len(news_items),

            'source': source,

            'hasNews': len(news_items) > 0,

            'timestamp': int(time.time()),

            'responseTime': round(time.time() - start_time, 3),

            'message': f'Found {len(news_items)} news items from {source.capitalize()}'

        }

        

        print(f'[新闻接口] 最终响应数据: {response_data}')

        return jsonify(response_data)

        

    except Exception as e:

        print(f'[新闻接口] 异常: {str(e)}')

        import traceback

        traceback.print_exc()

        

        return jsonify({

            'success': False,

            'symbol': symbol.upper(),

            'error': f'News API error: {str(e)}',

            'timestamp': int(time.time()),

            'responseTime': round(time.time() - start_time, 3)

        }), 500

# ==================== 单只股票AI分析接口 ====================



@app.route('/api/ai/analyze/single', methods=['POST'])

@app.route('/ai/analyze/single', methods=['POST'])

def ai_analyze_single():

    """单只股票AI分析接口 - 使用用户配置的AI provider进行真实分析"""

    print(f'=== 单只股票AI分析请求 ===')

    start_time = time.time()

    

    try:

        data = request.get_json()

        if not data:

            return jsonify({

                'success': False,

                'error': 'No JSON data provided',

                'timestamp': int(time.time())

            }), 400

        

        symbol = data.get('symbol')

        if not symbol:

            return jsonify({

                'success': False,

                'error': 'Symbol is required',

                'timestamp': int(time.time())

            }), 400

        

        symbol_upper = symbol.upper()

        print(f'[AI分析接口] 分析股票: {symbol_upper}')

        

        # 1. 获取市场数据 - 强制使用与UI完全相同的标准化数据

        market_data = None

        company_info = None

        

        try:

            print(f'[AI分析接口] 获取标准化市场数据 (与UI相同): {symbol_upper}')

            

            # 方法1: 直接调用UI使用的接口

            print(f'[AI分析接口] 方法1: 调用UI接口 /api/market/stocks')

            try:

                ui_response = requests.get(

                    f'http://127.0.0.1:8889/api/market/stocks',

                    params={'symbols': symbol_upper},

                    timeout=5

                )

                

                if ui_response.status_code == 200:

                    ui_data = ui_response.json()

                    if ui_data.get('stocks') and len(ui_data['stocks']) > 0:

                        ui_stock = ui_data['stocks'][0]

                        print(f'[AI分析接口] 从UI接口获取数据成功')

                        print(f'[AI分析接口] UI数据: price={ui_stock.get("price")}, change%={ui_stock.get("changePercent")}, volume={ui_stock.get("volume")}')

                        

                        # 创建标准化的market_data结构

                        market_data = {

                            'price': ui_stock.get('price'),

                            'changePercent': ui_stock.get('changePercent'),

                            'volume': ui_stock.get('volume'),

                            'dayHigh': ui_stock.get('dayHigh'),

                            'dayLow': ui_stock.get('dayLow'),

                            'previousClose': ui_stock.get('previousClose'),

                            'dataSource': ui_stock.get('dataSource'),

                            'sessionType': ui_stock.get('sessionType'),

                            'isFallback': ui_stock.get('isFallback'),

                            'symbol': symbol_upper,

                            'name': ui_stock.get('name'),

                            'currency': ui_stock.get('currency'),

                            'exchange': ui_stock.get('exchange'),

                            'sector': ui_stock.get('sector'),

                            'industry': ui_stock.get('industry')

                        }

                        print(f'[AI分析接口] 使用UI标准化市场数据')

            except Exception as ui_error:

                print(f'[AI分析接口] UI接口调用失败: {ui_error}')

            

            # 方法2: 如果UI接口失败，使用snapshots函数

            if not market_data:

                print(f'[AI分析接口] 方法2: 使用snapshots函数')

                alpaca_data_dict, alpaca_errors = fetch_alpaca_stock_data_snapshot([symbol_upper])

                

                if symbol_upper in alpaca_data_dict:

                    alpaca_data = alpaca_data_dict[symbol_upper]

                    print(f'[AI分析接口] 使用Alpaca snapshots市场数据')

                    print(f'[AI分析接口] Alpaca数据: price={alpaca_data.get("price")}, change%={alpaca_data.get("changePercent")}, volume={alpaca_data.get("volume")}')

                    

                    # 创建标准化的market_data结构

                    market_data = {

                        'price': alpaca_data.get('price'),

                        'changePercent': alpaca_data.get('changePercent'),

                        'volume': alpaca_data.get('volume'),

                        'dayHigh': alpaca_data.get('dayHigh'),

                        'dayLow': alpaca_data.get('dayLow'),

                        'previousClose': alpaca_data.get('previousClose'),

                        'dataSource': alpaca_data.get('dataSource'),

                        'sessionType': alpaca_data.get('sessionType'),

                        'isFallback': alpaca_data.get('isFallback'),

                        'symbol': symbol_upper,

                        'name': alpaca_data.get('name'),

                        'currency': alpaca_data.get('currency'),

                        'exchange': alpaca_data.get('exchange'),

                        'sector': alpaca_data.get('sector'),

                        'industry': alpaca_data.get('industry')

                    }

                else:

                    print(f'[AI分析接口] Alpaca snapshots数据获取失败: {alpaca_errors.get(symbol_upper, "Unknown error")}')

                    market_data = None

        

        except Exception as e:

            print(f'[AI分析接口] 市场数据获取异常: {str(e)}')

            market_data = None

        

        # 在市场数据获取后立即添加详细调试信息

        if market_data:

            print(f'[AI分析接口] 市场数据获取完成:')

            print(f'  Type: {type(market_data)}')

            print(f'  Keys: {list(market_data.keys())}')

            print(f'  Price: {market_data.get("price")}')

            print(f'  Change %: {market_data.get("changePercent")}')

            print(f'  Volume: {market_data.get("volume")}')

            print(f'  Data Source: {market_data.get("dataSource")}')

            print(f'  Full data (first 5 items): {dict(list(market_data.items())[:5])}')

        else:

            print(f'[AI分析接口] 市场数据为None或空')

        

        # 2. 获取公司信息 - 使用Finnhub

        try:

            print(f'[AI分析接口] 获取公司信息: {symbol_upper}')

            company_profile, profile_error = fetch_finnhub_profile(symbol_upper)

            

            if profile_error or not company_profile:

                print(f'[AI分析接口] 公司信息获取失败: {profile_error}')

                company_info = None

            else:

                company_info = company_profile

                print(f'[AI分析接口] 公司信息获取成功')

        except Exception as e:

            print(f'[AI分析接口] 公司信息获取异常: {str(e)}')

            company_info = None

        

        # 3. 获取新闻数据 - 使用新添加的新闻接口逻辑

        news_data = None

        try:

            print(f'[AI分析接口] 获取新闻数据: {symbol_upper}')

            # 调用内部的新闻分析函数

            news_analysis = analyze_news_for_stock(symbol_upper)

            news_data = news_analysis

            print(f'[AI分析接口] 新闻数据获取成功')

        except Exception as e:

            print(f'[AI分析接口] 新闻数据获取异常: {str(e)}')

            news_data = None

        

        # 4. 使用用户配置的AI provider进行真实分析

        print(f'[AI分析接口] 使用AI配置进行分析')

        print(f'[AI分析接口] 当前AI配置状态: {ai_provider_config_state}')

        ai_config = ai_provider_config_state

        

        # 强制使用DeepSeek分析，跳过API密钥验证

        print(f'[AI分析接口] 强制使用DeepSeek分析，跳过API密钥验证')

        print(f'[AI分析接口] AI配置状态: provider={ai_config.get("provider")}, model={ai_config.get("model")}, baseURL={ai_config.get("baseURL")}')

        

        # 确保参数不为None

        if market_data is None:

            market_data = {}

        if news_data is None:

            news_data = {}

        if company_info is None:

            company_info = {}

        

        print(f'[AI分析接口] 调用函数: analyze_trend_with_deepseek({symbol_upper}, {type(market_data)}, {type(news_data)}, {type(company_info)})')

        print(f'[AI分析接口] 新闻数据内容: {news_data}')

        

        try:

            # 直接调用AI分析函数

            ai_analysis = analyze_trend_with_deepseek(symbol_upper, market_data, news_data, company_info)

        except Exception as e:

            print(f'[AI分析接口] 调用analyze_trend_with_deepseek时发生错误: {e}')

            print(f'[AI分析接口] AI分析失败，返回null数据')

            

            # AI分析失败时返回null数据，不生成本地规则数据

            response_data = {

                'success': True,

                'symbol': symbol_upper,

                'trend': None,  # AI分析失败，返回null

                'overallScore': None,  # AI分析失败，返回null

                'confidence': None,  # AI分析失败，返回null

                'trendScore': None,

                'momentumScore': None,

                'volumeScore': None,

                'volatilityScore': None,

                'structureScore': None,

                'newsScore': None,

                'scannerReason': None,

                'aiReasoning': None,  # AI分析失败，返回null

                'newsSentiment': news_data.get('sentiment') if news_data else None,

                'eventRisk': news_data.get('eventRisk') if news_data else None,

                'topNews': news_data.get('topCatalyst') if news_data else None,

                'companyName': company_info.get('name') if company_info else None,  # 如果没有公司信息，返回null

                'sector': company_info.get('finnhubIndustry') if company_info else None,  # 如果没有行业信息，返回null

                'provenance': {

                    'marketData': 'alpaca' if market_data and market_data.get('dataSource') == 'Alpaca' else 'finnhub' if market_data else 'none',

                    'companyInfo': 'finnhub' if company_info else 'none',

                    'news': 'finnhub' if news_data else 'none',

                    'aiAnalysis': 'failed'  # AI分析失败

                },

                'timestamp': int(time.time()),

                'responseTime': round(time.time() - start_time, 3),

                'message': 'AI analysis failed - no local rules fallback'

            }

            

            print(f'[AI分析接口] AI分析失败，返回null数据: {response_data}')

        else:

            # 使用真实的AI分析

            print(f'[AI分析接口] 使用真实AI分析: {ai_config.get("provider", "DeepSeek")}')

            print(f'[AI分析接口] 调用参数检查:')

            print(f'  - symbol_upper: {symbol_upper}')

            print(f'  - market_data type: {type(market_data)}, value: {market_data}')

            print(f'  - news_data type: {type(news_data)}, value: {news_data}')

            print(f'  - company_info type: {type(company_info)}, value: {company_info}')

            

            # 确保参数不为None

            if market_data is None:

                market_data = {}

            if news_data is None:

                news_data = {}

            if company_info is None:

                company_info = {}

            

            print(f'[AI分析接口] 调用函数: analyze_trend_with_deepseek({symbol_upper}, {type(market_data)}, {type(news_data)}, {type(company_info)})')

            print(f'[AI分析接口] 市场数据内容: price={market_data.get("price") if market_data else None}, changePercent={market_data.get("changePercent") if market_data else None}, volume={market_data.get("volume") if market_data else None}')

            

            try:

                # 调用AI分析函数 - 传递正确的参数

                ai_analysis = analyze_trend_with_deepseek(symbol_upper, market_data, news_data, company_info)

            except TypeError as e:

                print(f'[AI分析接口] 调用analyze_trend_with_deepseek时发生TypeError: {e}')

                print(f'[AI分析接口] 参数详情: symbol={symbol_upper}, market_data={market_data}, news_data={news_data}, company_info={company_info}')

                raise

            

            if ai_analysis and 'error' not in ai_analysis:

                # AI分析成功

                # 注意：analyze_trend_with_deepseek可能返回不同的字段名

                # 它可能返回: trendLabel, trendScore, trendConfidence, scannerReason, aiReasoning

                

                print(f'[AI分析接口] AI分析结果: {ai_analysis}')

                

                response_data = {

                    'success': True,

                    'symbol': symbol_upper,

                    'trend': ai_analysis.get('trendLabel', ai_analysis.get('trend', 'Neutral')),  # 优先使用trendLabel，否则使用trend

                    'overallScore': ai_analysis.get('overallScore', ai_analysis.get('trendScore', 50)),  # 优先使用overallScore，否则使用trendScore

                    'confidence': ai_analysis.get('confidence', ai_analysis.get('trendConfidence', 0.5)),  # 优先使用confidence，否则使用trendConfidence

                    'trendScore': ai_analysis.get('trendScore', ai_analysis.get('overallScore', 50)),  # 优先使用trendScore，否则使用overallScore

                    'momentumScore': ai_analysis.get('momentumScore', 50),

                    'volumeScore': ai_analysis.get('volumeScore', 50),

                    'volatilityScore': ai_analysis.get('volatilityScore', 50),

                    'structureScore': ai_analysis.get('structureScore', 50),

                    'newsScore': ai_analysis.get('newsScore', 50),

                    'scannerReason': ai_analysis.get('scannerReason', 'AI analysis based on market data'),

                    'aiReasoning': ai_analysis.get('aiReasoning', ai_analysis.get('scannerReason', 'AI analysis completed')),  # 优先使用aiReasoning，否则使用scannerReason

                    'newsSentiment': news_data.get('sentiment') if news_data else None,

                    'eventRisk': ai_analysis.get('eventRisk', news_data.get('eventRisk') if news_data else 'Medium'),  # 优先使用AI的eventRisk

                    'topNews': news_data.get('topCatalyst') if news_data else None,

                    'companyName': company_info.get('name') if company_info else symbol_upper,

                    'sector': company_info.get('finnhubIndustry') if company_info else 'Unknown',

                    'provenance': {

                        'marketData': 'alpaca' if market_data and market_data.get('dataSource') == 'Alpaca' else 'finnhub' if market_data else 'none',

                        'companyInfo': 'finnhub' if company_info else 'none',

                        'news': 'finnhub' if news_data else 'none',

                        'aiAnalysis': ai_config.get('provider', 'DeepSeek').lower()

                    },

                    'timestamp': int(time.time()),

                    'responseTime': round(time.time() - start_time, 3),

                    'message': f'Analysis completed using {ai_config.get("provider", "DeepSeek")} AI'

                }

                

                # 添加调试信息

                if data.get('debug'):

                    # 获取AI API密钥

                    ai_api_key = ai_provider_config_state.get('apiKey', '')

                    # 获取Alpaca环境

                    alpaca_environment = alpaca_config_state.get('environment', 'paper')

                    

                    response_data['debug'] = {

                        'market_data': market_data,

                        'company_info': company_info,

                        'news_data': news_data,

                        'ai_config': ai_config,

                        'api_key_check': {

                            'has_api_key': bool(ai_api_key),

                            'api_key_length': len(ai_api_key) if ai_api_key else 0,

                            'environment': alpaca_environment

                        }

                    }

                

                print(f'[AI分析接口] 最终响应数据: {response_data}')

            else:

                # AI分析失败，回退到本地规则

                print(f'[AI分析接口] AI分析失败，使用本地规则: {ai_analysis.get("error") if ai_analysis else "Unknown error"}')

                trend_analysis = analyze_trend_locally(symbol_upper, market_data, news_data, company_info)

                

                response_data = {

                    'success': True,

                    'symbol': symbol_upper,

                    'trend': trend_analysis.get('trend', 'Neutral'),

                    'overallScore': trend_analysis.get('overallScore', 50),

                    'confidence': trend_analysis.get('confidence', 0.5),

                    'trendScore': trend_analysis.get('trendScore', 50),

                    'momentumScore': trend_analysis.get('momentumScore', 50),

                    'volumeScore': trend_analysis.get('volumeScore', 50),

                    'volatilityScore': trend_analysis.get('volatilityScore', 50),

                    'structureScore': trend_analysis.get('structureScore', 50),

                    'newsScore': trend_analysis.get('newsScore', 50),

                    'scannerReason': trend_analysis.get('scannerReason', 'Local analysis after AI failure'),

                    'aiReasoning': trend_analysis.get('aiReasoning', f'AI analysis failed: {ai_analysis.get("error") if ai_analysis else "Unknown error"}'),

                    'newsSentiment': news_data.get('sentiment') if news_data else None,

                    'eventRisk': news_data.get('eventRisk') if news_data else None,

                    'topNews': news_data.get('topCatalyst') if news_data else None,

                    'companyName': company_info.get('name') if company_info else symbol_upper,

                    'sector': company_info.get('finnhubIndustry') if company_info else 'Unknown',

                    'provenance': {

                        'marketData': 'alpaca' if market_data and 'alpaca' in str(market_data).lower() else 'finnhub' if market_data else 'none',

                        'companyInfo': 'finnhub' if company_info else 'none',

                        'news': 'finnhub' if news_data else 'none',

                        'aiAnalysis': 'local_rules_fallback'

                    },

                    'timestamp': int(time.time()),

                    'responseTime': round(time.time() - start_time, 3),

                    'message': 'Analysis completed using local rules (AI analysis failed)'

                }

        

        return jsonify(response_data)

        

    except Exception as e:

        print(f'[AI分析接口] 异常: {str(e)}')

        import traceback

        traceback.print_exc()

        

        return jsonify({

            'success': False,

            'error': f'AI analysis error: {str(e)}',

            'timestamp': int(time.time()),

            'responseTime': round(time.time() - start_time, 3)

        }), 500



if __name__ == '__main__':

    print("================================================================================")

    print("简化版后端启动 - 包含 AI 接口")

    print("端口: 8889")

    print("包含接口:")

    print("  1. AI 配置接口:")

    print("     - POST /api/ai/provider/config - DeepSeek 配置保存")

    print("     - POST /api/ai/provider/test - DeepSeek API 测试")

    print("  2. AI Alpaca 交易接口:")

    print("     - GET /api/ai/alpaca/account - AI Alpaca 账户")

    print("     - GET /api/ai/alpaca/positions - AI Alpaca 持仓")

    print("     - GET /api/ai/alpaca/orders - AI Alpaca 订单")

    print("     - GET /api/ai/alpaca/orders/history - AI Alpaca 历史订单")

    print("     - GET /api/ai/alpaca/portfolio/history - AI Alpaca Portfolio 历史")

    print("  3. AI Trading 接口:")

    print("     - POST /api/ai/trade/preview - AI 交易预览")

    print("     - GET /api/ai/trade/status - AI 交易状态")

    print("     - GET /api/ai/trade/history - AI 交易历史")

    print("     - POST /api/ai/trade/toggle - AI 交易开关")

    print("     - POST /api/ai/trade/execute - AI 交易执行")

    print("     - GET/POST /api/ai/trading/environment - AI 交易环境")

    print("  4. AI 聊天接口:")

    print("     - POST /api/ai/chat - AI 聊天")

    print("  5. 基础接口:")

    print("     - GET /api/status - 系统状态")

    print("     - GET /api/market/stocks - 股票列表")

    print("     - GET /api/market/stock/<symbol> - 股票详情")

    print("     - POST /api/backtest/run - 运行回测")

    print("================================================================================")



    # 添加调试信息

    print("\n调试信息:")

    print(f"已注册路由数量: {len(app.url_map._rules)}")

    print("检查特定路由:")

    for rule in app.url_map.iter_rules():

        if 'ai/trade' in rule.rule:

            print(f"  {rule.rule} -> {rule.endpoint}")

    

    print("\n启动服务器...")

    app.run(host='127.0.0.1', port=8889, debug=True, use_reloader=False)  # 使用端口8889，禁用reloader避免重复启动

def fetch_finnhub_news(symbol):
    """从Finnhub获取股票新闻"""
    try:
        print(f'[Finnhub新闻] 获取 {symbol} 新闻')
        
        # 检查API密钥
        if not FINNHUB_API_KEY:
            print(f'[Finnhub新闻] Finnhub API密钥未配置')
            return None
        
        # 调用Finnhub News API
        import requests
        from datetime import datetime, timedelta
        
        # 设置时间范围（最近7天）
        to_date = datetime.utcnow()
        from_date = to_date - timedelta(days=7)
        
        # 格式化日期
        from_str = from_date.strftime('%Y-%m-%d')
        to_str = to_date.strftime('%Y-%m-%d')
        
        # 构建API URL
        url = f'{FINNHUB_BASE_URL}/company-news'
        params = {
            'symbol': symbol,
            'from': from_str,
            'to': to_str,
            'token': FINNHUB_API_KEY
        }
        
        print(f'[Finnhub新闻] 请求URL: {url}')
        print(f'[Finnhub新闻] 参数: {params}')
        
        # 发送请求
        response = requests.get(url, params=params, timeout=10)
        
        if response.status_code == 200:
            news_data = response.json()
            print(f'[Finnhub新闻] 获取到 {len(news_data)} 条新闻')
            return news_data
        else:
            print(f'[Finnhub新闻] API请求失败: {response.status_code}')
            print(f'[Finnhub新闻] 响应: {response.text[:200]}')
            return None
            
    except Exception as e:
        print(f'[Finnhub新闻] 获取新闻时出错: {str(e)}')
        return None

# 主程序入口
if __name__ == '__main__':
    print("================================================================================")
    print("修复版后端启动")
    print("端口: 8889")
    print("================================================================================")
    
    print("\n启动服务器...")
    app.run(host='127.0.0.1', port=8889, debug=True, use_reloader=False)
