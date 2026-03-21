"""



最终生产版本 - 明确数据源职责



Finnhub: Dashboard和Market普通数据



Twelve Data: Analyze/Chart图表数据







版本: 修复版v2 - 确保处理所有:00和:30数据



"""







print("================================================")



print("Flask应用启动: final_production.py - 修复版v2")



print("当前文件路径: " + __file__)



print("================================================")







from flask import Flask, request, jsonify



import requests



import time



from datetime import datetime



import traceback







app = Flask(__name__)







# 全局错误处理



@app.errorhandler(Exception)



def handle_exception(e):



    """捕获所有未处理的异常"""



    error_msg = f"[全局错误处理] 捕获异常: {e}"



    traceback_str = traceback.format_exc()



    



    print(error_msg)



    print(f"[全局错误处理] Traceback:")



    print(traceback_str)



    



    # 将错误写入文件



    try:



        with open('backend_errors.log', 'a', encoding='utf-8') as f:



            f.write(f"\n{'='*80}\n")



            f.write(f"时间: {datetime.now().isoformat()}\n")



            f.write(f"异常: {e}\n")



            f.write(f"Traceback:\n{traceback_str}\n")



            f.write(f"{'='*80}\n")



    except:



        pass



    



    return jsonify({



        "error": str(e),



        "traceback": traceback_str,



        "message": "服务器内部错误"



    }), 500







# API配置



TWELVEDATA_API_KEY = '8b847a1ef2aa47a68d3f992bd0275f0c'



FINNHUB_API_KEY = 'd6v2q09r01qig546aus0d6v2q09r01qig546ausg'







# 默认股票列表 - 与前端DEFAULT_SYMBOLS一致



DEFAULT_SYMBOLS = ['AAPL', 'MSFT', 'GOOGL', 'TSLA', 'NVDA', 'AMZN', 'META', 'JPM', 'JNJ', 'V']







# 股票行业数据库



STOCK_SECTORS = {



    'AAPL': 'Technology',



    'MSFT': 'Technology', 



    'GOOGL': 'Technology',



    'TSLA': 'Automotive',



    'NVDA': 'Technology',



    'AMZN': 'Consumer Cyclical',



    'META': 'Technology',



    'JPM': 'Financial Services',



    'JNJ': 'Healthcare',



    'V': 'Financial Services'



}







# 股票名称数据库



STOCK_NAMES = {



    'AAPL': 'Apple Inc',



    'MSFT': 'Microsoft Corp',



    'GOOGL': 'Alphabet Inc',



    'TSLA': 'Tesla Inc',



    'NVDA': 'NVIDIA Corp',



    'AMZN': 'Amazon.com Inc',



    'META': 'Meta Platforms Inc',



    'JPM': 'JPMorgan Chase & Co',



    'JNJ': 'Johnson & Johnson',



    'V': 'Visa Inc'



}







def safe_float(value, default=0):



    """安全转换为float"""



    try:



        return float(value)



    except:



        return float(default)







def safe_int(value, default=0):



    """安全转换为int"""



    try:



        return int(float(value))



    except:



        return int(default)







def calculate_change_percent(current, previous):



    """安全计算涨跌幅"""



    try:



        if previous > 0:



            return (current - previous) / previous * 100



        return 0



    except:



        return 0







def get_finnhub_quote(symbol):



    """从Finnhub获取股票报价"""



    try:



        quote_url = "https://finnhub.io/api/v1/quote"



        params = {



            'symbol': symbol.upper(),



            'token': FINNHUB_API_KEY



        }



        



        print(f"[Finnhub Quote] 开始请求 {symbol}...")



        response = requests.get(quote_url, params=params, timeout=10)  # 增加超时时间



        



        print(f"[Finnhub Quote] {symbol} 响应状态: {response.status_code}")



        if response.status_code == 200:



            data = response.json()



            print(f"[Finnhub Quote] {symbol}: 成功获取数据")



            return data



        else:



            print(f"[Finnhub] {symbol} quote请求失败: {response.status_code}, 响应: {response.text[:100]}")



            return None



    except Exception as e:



        print(f"[Finnhub] {symbol} quote异常: {e}")



        import traceback



        traceback.print_exc()



        return None







# Profile数据内存缓存



_profile_cache = {}



_PROFILE_CACHE_TTL = 24 * 60 * 60  # 24小时缓存







def get_finnhub_profile(symbol):



    """从Finnhub获取股票profile信息（包含market cap）- 简化日志版本"""



    now = time.time()



    



    # 检查缓存



    if symbol in _profile_cache:



        cached_data, timestamp = _profile_cache[symbol]



        if now - timestamp < _PROFILE_CACHE_TTL:



            return cached_data  # 静默返回缓存



    



    # 缓存未命中，请求API



    try:



        profile_url = "https://finnhub.io/api/v1/stock/profile2"



        params = {



            'symbol': symbol.upper(),



            'token': FINNHUB_API_KEY



        }



        



        response = requests.get(profile_url, params=params, timeout=5)



        



        if response.status_code == 200:



            data = response.json()



            # 更新缓存



            _profile_cache[symbol] = (data, now)



            return data



        else:



            # 只记录错误



            print(f"[Finnhub Error] {symbol} profile请求失败: {response.status_code}")



            return None



    except Exception as e:



        print(f"[Finnhub Error] {symbol} profile异常: {e}")



        return None







def get_finnhub_profiles_concurrent(symbols):



    """并发获取多个股票的profile数据 - 简化日志版本"""



    from concurrent.futures import ThreadPoolExecutor, as_completed



    



    if not symbols:



        return {}



    



    profiles = {}



    



    with ThreadPoolExecutor(max_workers=5) as executor:



        # 提交所有任务



        future_to_symbol = {



            executor.submit(get_finnhub_profile, symbol): symbol 



            for symbol in symbols



        }



        



        # 收集结果



        for future in as_completed(future_to_symbol):



            symbol = future_to_symbol[future]



            try:



                profile_data = future.result(timeout=6)



                if profile_data:



                    profiles[symbol] = profile_data



            except Exception as e:



                # 只记录错误



                print(f"[Profile Concurrent Error] {symbol} 获取失败: {e}")



    



    return profiles







def get_finnhub_stock_data(symbol):



    """从Finnhub获取完整的股票数据（结合quote和profile）"""



    quote_data = get_finnhub_quote(symbol)



    profile_data = get_finnhub_profile(symbol)



    



    if quote_data:



        current_price = safe_float(quote_data.get('c', 0))



        previous_close = safe_float(quote_data.get('pc', 0))



        change = current_price - previous_close



        change_percent = calculate_change_percent(current_price, previous_close)



        



        # 计算market cap：优先使用profile中的marketCapitalization，否则用price * shares



        market_cap = 0



        if profile_data:



            # profile中的marketCapitalization是以百万为单位（例如3655016.56 = 3.655万亿美元）



            profile_market_cap = safe_float(profile_data.get('marketCapitalization', 0))



            if profile_market_cap > 0:



                market_cap = profile_market_cap * 1_000_000  # 转换为实际美元



                print(f"[Market Cap] {symbol}: 使用profile数据 {profile_market_cap}M → ${market_cap:,.0f}")



            else:



                # 备选方案：price * shares outstanding



                shares_outstanding = safe_float(profile_data.get('shareOutstanding', 0))



                if shares_outstanding > 0 and current_price > 0:



                    market_cap = current_price * shares_outstanding



                    print(f"[Market Cap] {symbol}: 计算值 ${current_price} × {shares_outstanding:,} shares = ${market_cap:,.0f}")



        



        # 使用profile中的公司名称（如果可用），否则使用本地数据库



        company_name = None



        if profile_data and profile_data.get('name'):



            company_name = profile_data.get('name')



        else:



            company_name = STOCK_NAMES.get(symbol.upper(), f"{symbol.upper()} Inc.")



        



        # 使用profile中的行业（如果可用），否则使用本地数据库



        industry = None



        if profile_data and profile_data.get('finnhubIndustry'):



            industry = profile_data.get('finnhubIndustry')



        else:



            industry = STOCK_SECTORS.get(symbol.upper(), "Technology")



        



        return {



            "symbol": symbol.upper(),



            "name": company_name,



            "price": round(current_price, 2),



            "change": round(change, 2),



            "changePercent": round(change_percent, 2),



            "open": round(safe_float(quote_data.get('o', 0)), 2),



            "dayHigh": round(safe_float(quote_data.get('h', 0)), 2),



            "dayLow": round(safe_float(quote_data.get('l', 0)), 2),



            "volume": safe_int(quote_data.get('v', 0)),



            "marketCap": market_cap,  # ✅ 现在有真实的market cap值



            "currency": "USD",



            "exchange": "NASDAQ",



            "industry": industry,



            "dataSource": "Finnhub (quote + profile)"



        }



    else:



        # 降级数据



        return {



            "symbol": symbol.upper(),



            "name": STOCK_NAMES.get(symbol.upper(), f"{symbol.upper()} Inc."),



            "price": 0,



            "change": 0,



            "changePercent": 0,



            "open": 0,



            "dayHigh": 0,



            "dayLow": 0,



            "volume": 0,



            "marketCap": 0,



            "currency": "USD",



            "exchange": "NASDAQ",



            "industry": STOCK_SECTORS.get(symbol.upper(), "Technology"),



            "dataSource": "Finnhub (获取失败，使用降级数据)"



        }







def get_finnhub_stock_data_batch(symbols):



    """批量获取股票数据 - 优化性能"""



    if not symbols:



        return []



    



    print(f"[Finnhub] 批量获取 {len(symbols)} 支股票数据")



    



    # 批量获取quote数据



    quotes = {}



    try:



        symbols_str = ','.join(symbols)



        url = f"{FINNHUB_BASE_URL}/quote"



        params = {'symbol': symbols_str, 'token': FINNHUB_API_KEY}



        



        response = requests.get(url, params=params, timeout=15)



        response.raise_for_status()



        



        data = response.json()



        



        # 处理批量返回的数据



        if isinstance(data, list):



            # 如果是数组，每个元素对应一个股票



            for i, quote_data in enumerate(data):



                if i < len(symbols):



                    quotes[symbols[i]] = quote_data



        elif isinstance(data, dict):



            # 如果是字典，可能只返回一个股票的数据



            if len(symbols) == 1:



                quotes[symbols[0]] = data



            else:



                print(f"[Finnhub] 批量API返回字典格式，但请求了多个股票")



    except Exception as e:



        print(f"[Finnhub] 批量获取quote失败: {e}")



    



    # 并发获取profile数据



    profiles = get_finnhub_profiles_concurrent(symbols)



    



    # 处理每个股票的数据



    stocks = []



    for symbol in symbols:



        try:



            quote_data = quotes.get(symbol)



            if not quote_data:



                # 如果没有批量数据，回退到单股票获取



                quote_data = get_finnhub_quote(symbol)



            



            profile_data = profiles.get(symbol)



            



            if quote_data:



                current_price = safe_float(quote_data.get('c', 0))



                previous_close = safe_float(quote_data.get('pc', 0))



                change = current_price - previous_close



                change_percent = calculate_change_percent(current_price, previous_close)



                



                # 计算market cap



                market_cap = 0



                if profile_data:



                    profile_market_cap = safe_float(profile_data.get('marketCapitalization', 0))



                    if profile_market_cap > 0:



                        market_cap = profile_market_cap * 1_000_000



                



                # 获取公司名称和行业



                company_name = None



                if profile_data and profile_data.get('name'):



                    company_name = profile_data.get('name')



                else:



                    company_name = STOCK_NAMES.get(symbol.upper(), f"{symbol.upper()} Inc.")



                



                industry = None



                if profile_data and profile_data.get('finnhubIndustry'):



                    industry = profile_data.get('finnhubIndustry')



                else:



                    industry = STOCK_SECTORS.get(symbol.upper(), "Technology")



                



                stocks.append({



                    "symbol": symbol.upper(),



                    "name": company_name,



                    "price": round(current_price, 2),



                    "change": round(change, 2),



                    "changePercent": round(change_percent, 2),



                    "open": round(safe_float(quote_data.get('o', 0)), 2),



                    "dayHigh": round(safe_float(quote_data.get('h', 0)), 2),



                    "dayLow": round(safe_float(quote_data.get('l', 0)), 2),



                    "volume": safe_int(quote_data.get('v', 0)),



                    "marketCap": market_cap,



                    "currency": "USD",



                    "exchange": "NASDAQ",



                    "industry": industry,



                    "dataSource": "Finnhub (批量quote + 并发profile)"



                })



            else:



                # 降级数据



                stocks.append({



                    "symbol": symbol.upper(),



                    "name": STOCK_NAMES.get(symbol.upper(), f"{symbol.upper()} Inc."),



                    "price": 0,



                    "change": 0,



                    "changePercent": 0,



                    "open": 0,



                    "dayHigh": 0,



                    "dayLow": 0,



                    "volume": 0,



                    "marketCap": 0,



                    "currency": "USD",



                    "exchange": "NASDAQ",



                    "industry": STOCK_SECTORS.get(symbol.upper(), "Technology"),



                    "dataSource": "Finnhub (获取失败)"



                })



                



        except Exception as e:



            print(f"[Finnhub] 处理 {symbol} 数据失败: {e}")



            # 添加降级数据



            stocks.append({



                "symbol": symbol.upper(),



                "name": STOCK_NAMES.get(symbol.upper(), f"{symbol.upper()} Inc."),



                "price": 0,



                "change": 0,



                "changePercent": 0,



                "open": 0,



                "dayHigh": 0,



                "dayLow": 0,



                "volume": 0,



                "marketCap": 0,



                "currency": "USD",



                "exchange": "NASDAQ",



                "industry": STOCK_SECTORS.get(symbol.upper(), "Technology"),



                "dataSource": "Finnhub (异常)"



            })



    



    print(f"[Finnhub] 批量处理完成，返回 {len(stocks)} 支股票")



    return stocks







# 全局调用计数器



_twelvedata_call_count = 0







def get_twelvedata_history(symbol, interval, range_param):



    """从Twelve Data获取图表历史数据 - 修复版（确保处理所有:00和:30数据）"""



    global _twelvedata_call_count



    _twelvedata_call_count += 1



    call_id = _twelvedata_call_count



    



    # 写入文件记录调用



    import os



    log_file = "function_calls.log"



    with open(log_file, 'a', encoding='utf-8') as f:



        f.write(f"[{call_id}] get_twelvedata_history被调用: symbol={symbol}, interval={interval}, range={range_param} - 修复版v2\n")



    



    print(f"[函数入口 #{call_id}] get_twelvedata_history被调用: symbol={symbol}, interval={interval}, range={range_param} - 修复版v2")



    try:



        # Twelve Data参数映射



        interval_map = {



            '30': '30min',



            '60': '1h',



            'D': '1day'



        }



        



        # 直接使用传入的interval参数（如果已经在映射中）



        if interval in interval_map:



            twelvedata_interval = interval_map[interval]



        else:



            # 否则使用默认映射



            if interval == '30min':



                twelvedata_interval = '30min'



            elif interval == '1h':



                twelvedata_interval = '1h'



            elif interval == '1day':



                twelvedata_interval = '1day'



            else:



                twelvedata_interval = '1h'  # 默认



        



        # 修改outputsize_map，增加1 Week的数据量



        outputsize_map = {



            '1day': 48,



            '1week': 300,  # 增加：从168增加到300，确保获取完整数据



            '1month': 30,



            '3month': 90,



            '1year': 365



        }



        



        # 对于1 Year和3 Months，使用日线数据和时间范围限制



        if range_param == '1year':



            twelvedata_interval = '1day'



            outputsize = 400  # 请求稍多一点数据，确保覆盖一年



            



            # 计算时间范围：从去年的今天减一天开始，到明天结束



            from datetime import datetime, timedelta



            end_date = datetime.now() + timedelta(days=1)  # 到明天，确保覆盖今天



            start_date = datetime.now() - timedelta(days=366)  # 去年的今天减一天



            



            # 格式化日期为YYYY-MM-DD



            start_str = start_date.strftime('%Y-%m-%d')



            end_str = end_date.strftime('%Y-%m-%d')



            



            print(f"[Twelve Data] 1 Year时间范围: {start_str} 到 {end_str} (缓冲范围)")



        elif range_param == '1month':



            twelvedata_interval = '1day'



            outputsize = 40  # 请求稍多一点数据



            start_str = None



            end_str = None



        elif range_param == '3month':



            twelvedata_interval = '1day'



            outputsize = 100  # 请求稍多一点数据



            start_str = None



            end_str = None



        elif range_param == '1week':



            # 使用30分钟数据



            twelvedata_interval = '30min'



            outputsize = 300  # 请求大量数据，确保获取完整30分钟序列



            start_str = None



            end_str = None



            



            print(f"[Twelve Data] 1 Week：使用30分钟数据，请求{outputsize}个点（修复版）")



            print(f"[Twelve Data] 目标：获取完整的:00和:30数据序列")



        else:



            twelvedata_interval = interval_map.get(interval, '1h')



            outputsize = outputsize_map.get(range_param, 100)



            start_str = None



            end_str = None



        



        # 请求Twelve Data



        url = "https://api.twelvedata.com/time_series"



        params = {



            'symbol': symbol.upper(),



            'interval': twelvedata_interval,



            'outputsize': outputsize,



            'apikey': TWELVEDATA_API_KEY,



            'format': 'JSON'



        }



        



        # 添加时间范围参数（如果指定了）



        if start_str and end_str:



            params['start_date'] = start_str



            params['end_date'] = end_str



        



        print(f"[Twelve Data] 请求参数: {params}")



        



        try:



            response = requests.get(url, params=params, timeout=15)



            print(f"[Twelve Data] 响应状态码: {response.status_code}")



            print(f"[Twelve Data] 响应URL: {response.url}")



        except Exception as e:



            print(f"[Twelve Data] 请求异常: {e}")



            return [], False, f"Twelve Data (请求异常: {str(e)[:100]})"



        



        if response.status_code == 200:



            data = response.json()



            



            # 调试：打印API返回的原始数据结构



            print(f"[Twelve Data] 原始响应JSON keys: {list(data.keys())}")



            print(f"[Twelve Data] 响应状态: {data.get('status', 'unknown')}")



            if 'values' in data:



                values = data['values']



                print(f"[Twelve Data] 原始数据点数: {len(values)} (请求: {outputsize})")



                # 打印前3个原始数据点



                for i, item in enumerate(values[:3]):



                    print(f"[Twelve Data] 原始数据点 {i}: {item}")



            else:



                print(f"[Twelve Data] 错误: 响应中没有'values'字段")



                print(f"[Twelve Data] 完整响应: {data}")



                



                # 分析原始数据分钟分布



                minute_counts = {}



                for item in values[:50]:  # 只分析前50个用于调试



                    datetime_str = item.get('datetime', '')



                    if ':' in datetime_str:



                        time_part = datetime_str.split(' ')[1] if ' ' in datetime_str else datetime_str



                        minute = time_part.split(':')[1]



                        minute_counts[minute] = minute_counts.get(minute, 0) + 1



                



                print(f"[Twelve Data] 原始数据分钟分布: {minute_counts}")



                print(f"[Twelve Data] 包含:00数据: {'00' in minute_counts}")



                print(f"[Twelve Data] 包含:30数据: {'30' in minute_counts}")



                



                # 修复版：简化处理，确保处理所有数据点



                formatted_data = []



                success_count = 0



                error_count = 0



                



                for i, item in enumerate(values):



                    try:



                        datetime_str = item.get('datetime', '')



                        



                        # 正确解析时间戳 - 简化版（直接解析为UTC）



                        timestamp = 0



                        if datetime_str:



                            try:



                                # 直接解析为UTC时间戳



                                # Twelve Data返回的时间字符串已经是UTC格式



                                dt = datetime.strptime(datetime_str, '%Y-%m-%d %H:%M:%S')



                                # 转换为时间戳（假设是UTC时间）



                                timestamp = int(dt.timestamp())



                                



                                # 调试日志



                                if i < 3:  # 只打印前3个



                                    print(f"[Twelve Data] 解析时间 {i}: {datetime_str} -> dt={dt}, timestamp={timestamp}")



                            except Exception as e:



                                print(f"[Twelve Data] 时间解析失败: {datetime_str}, 错误: {e}")



                                # 使用当前时间作为后备



                                timestamp = int(time.time())



                        else:



                            # 如果没有时间字符串，使用当前时间



                            timestamp = int(time.time())



                        



                        # 简化数值转换函数



                        def safe_convert(value, default=0, type_func=float):



                            try:



                                if value is None or value == '':



                                    return default



                                return type_func(value)



                            except:



                                return default



                        



                        formatted_data.append({



                            "timestamp": timestamp,



                            "time": datetime_str,



                            "open": safe_convert(item.get('open'), 0, float),



                            "high": safe_convert(item.get('high'), 0, float),



                            "low": safe_convert(item.get('low'), 0, float),



                            "close": safe_convert(item.get('close'), 0, float),



                            "volume": safe_convert(item.get('volume'), 0, int)



                        })



                        success_count += 1



                    except Exception as e:



                        error_count += 1



                        if error_count <= 3:



                            print(f"[Twelve Data] 处理第 {i+1} 个数据点失败: {e}")



                        continue



                



                print(f"[Twelve Data] 处理结果: 成功 {success_count}, 失败 {error_count}")



                



                # 反转数据顺序（最新的在最后）



                formatted_data = list(reversed(formatted_data))



                



                # 处理后的数据调试



                print(f"[Twelve Data] 处理后数据点数: {len(formatted_data)}")



                



                if formatted_data:
                    # 分析处理后的分钟分布
                    processed_minute_counts = {}

                    for item in formatted_data[:100]:  # 只分析前100个
                        time_str = item.get('time', '')
                        if ':' in time_str:
                            time_part = time_str.split(' ')[1] if ' ' in time_str else time_str
                            minute = time_part.split(':')[1]
                            processed_minute_counts[minute] = processed_minute_counts.get(minute, 0) + 1

                    print(f"[Twelve Data] 处理后分钟分布: {processed_minute_counts}")

                    # 打印前10个点
                    print(f"[Twelve Data] 处理后前10个点:")
                    for i, item in enumerate(formatted_data[:10]):
                        print(f"  {i+1}. {item.get('time')}")

                    return formatted_data, True, f"Twelve Data {range_param}图表数据（修复版）"
                else:
                    return [], False, "Twelve Data (数据结构错误)"



        else:



            return [], False, f"Twelve Data (HTTP {response.status_code})"



            



    except Exception as e:



        return [], False, f"Twelve Data (异常: {str(e)[:100]})"







@app.route('/api/market/stocks', methods=['GET'])



def get_market_stocks():



    """Market页面和Dashboard股票列表接口 - 使用Finnhub"""



    print(f"[API] /api/market/stocks 被调用 (Finnhub)")



    



    try:



        # 获取参数



        symbols_param = request.args.get('symbols', '')



        dashboard = request.args.get('dashboard', 'false').lower() == 'true'



        



        print(f"[API] 参数: symbols={symbols_param}, dashboard={dashboard}")



        



        # 确定股票列表



        if symbols_param:



            symbols = [s.strip().upper() for s in symbols_param.split(',') if s.strip()]



        else:



            symbols = DEFAULT_SYMBOLS



        



        print(f"[API] 获取 {len(symbols)} 支股票数据")



        



        # 使用批量获取优化性能



        if len(symbols) > 1:



            print(f"[API] 使用批量获取模式")



            stocks = get_finnhub_stock_data_batch(symbols)



        else:



            print(f"[API] 使用单股票获取模式")



            stocks = []



            for symbol in symbols:



                try:



                    print(f"[API] 开始获取 {symbol} 数据...")



                    stock_data = get_finnhub_stock_data(symbol)



                    stocks.append(stock_data)



                    print(f"[API] {symbol}: ${stock_data['price']:.2f} ({stock_data['changePercent']:.2f}%)")



                except Exception as e:



                    print(f"[API] 获取 {symbol} 数据失败: {e}")



                    # 添加降级数据



                    stocks.append({



                        "symbol": symbol.upper(),



                        "name": STOCK_NAMES.get(symbol.upper(), f"{symbol.upper()} Inc."),



                        "price": 0,



                        "change": 0,



                        "changePercent": 0,



                        "open": 0,



                        "dayHigh": 0,



                        "dayLow": 0,



                        "volume": 0,



                        "marketCap": 0,



                        "currency": "USD",



                        "exchange": "NASDAQ",



                        "industry": STOCK_SECTORS.get(symbol.upper(), "Technology"),



                        "dataSource": "降级数据 (Finnhub获取失败)"



                    })



        



        response_data = {



            "stocks": stocks,



            "count": len(stocks),



            "dataSource": "Finnhub (普通展示数据)",



            "timestamp": int(time.time())



        }



        



        print(f"[API] 返回 {len(stocks)} 支股票数据")



        return jsonify(response_data), 200



        



    except Exception as e:



        print(f"[API] 异常: {e}")



        import traceback



        traceback.print_exc()



        return jsonify({



            "stocks": [],



            "count": 0,



            "dataSource": f"Finnhub (错误)",



            "timestamp": int(time.time())



        }), 200







@app.route('/api/market/stock/<symbol>', methods=['GET'])



def get_stock_detail(symbol):



    """单股详情接口 - 使用Finnhub"""



    print(f"[API] /api/market/stock/{symbol} 被调用 (Finnhub)")



    



    try:



        stock_data = get_finnhub_stock_data(symbol)



        print(f"[API] 返回 {symbol} 详情")



        return jsonify(stock_data), 200



            



    except Exception as e:



        print(f"[API] 异常: {e}")



        return jsonify({



            "symbol": symbol.upper(),



            "name": f"{symbol.upper()} Inc.",



            "price": 0,



            "change": 0,



            "changePercent": 0,



            "dataSource": "Finnhub (异常)"



        }), 200







@app.route('/api/market/history/<symbol>', methods=['GET'])



def get_stock_history(symbol):



    """图表历史数据接口 - 使用Twelve Data"""



    print(f"\n{'='*80}")



    print(f"[API ROUTE] /api/market/history/{symbol} 被调用")



    



    try:



        interval = request.args.get('interval', '60')



        range_param = request.args.get('range', '1week')



        



        print(f"[API ROUTE] 实际收到参数: symbol={symbol}, interval={interval}, range={range_param}")



        print(f"[API ROUTE] 完整URL: {request.url}")



        



        # 从Twelve Data获取图表数据



        print(f"[API ROUTE] 调用get_twelvedata_history函数...")



        historical_data, success, data_source_note = get_twelvedata_history(symbol, interval, range_param)



        



        print(f"[API ROUTE] 函数返回结果:")



        print(f"  success: {success}")



        print(f"  note: '{data_source_note}'")



        print(f"  数据点数: {len(historical_data)}")



        



        if historical_data:



            # 分析分钟分布



            minute_counts = {}



            for item in historical_data:



                time_str = item.get('time', '')



                if ':' in time_str:



                    time_part = time_str.split(' ')[1] if ' ' in time_str else time_str



                    minute = time_part.split(':')[1]



                    minute_counts[minute] = minute_counts.get(minute, 0) + 1



            



            print(f"[API ROUTE] 分钟分布: {minute_counts}")



            print(f"[API ROUTE] 有:00数据: {'00' in minute_counts}")



            print(f"[API ROUTE] 有:30数据: {'30' in minute_counts}")



            



            # 打印前10个点



            print(f"[API ROUTE] 前10个datetime:")



            for i, item in enumerate(historical_data[:10]):



                print(f"  {i+1}. {item.get('time')}")



            



            # 打印后10个点



            if len(historical_data) > 10:



                print(f"[API ROUTE] 后10个datetime:")



                start_idx = max(0, len(historical_data) - 10)



                for i, item in enumerate(historical_data[start_idx:]):



                    print(f"  {start_idx + i + 1}. {item.get('time')}")



        



        # 在return之前打印最终要返回的数据



        print(f"\n[API ROUTE] 准备返回的响应:")



        print(f"  dataSource: 'Twelve Data (图表数据)'")



        print(f"  note: '{data_source_note}'")



        print(f"  count: {len(historical_data)}")



        



        if success and historical_data:



            response_data = {



                "data": historical_data,



                "count": len(historical_data),



                "dataSource": "Twelve Data (图表数据)",



                "note": data_source_note,



                "timestamp": int(time.time())



            }



            print(f"[API ROUTE] 返回 {len(historical_data)} 条图表数据")



            print(f"{'='*80}\n")



            return jsonify(response_data), 200



        else:



            response_data = {



                "data": [],



                "count": 0,



                "dataSource": "Twelve Data (图表数据获取失败)",



                "note": "无法获取图表数据",



                "warning": data_source_note,



                "timestamp": int(time.time())



            }



            print(f"[API ROUTE] 图表数据获取失败")



            print(f"{'='*80}\n")



            return jsonify(response_data), 200



            



    except Exception as e:



        print(f"[API ROUTE] 异常: {e}")



        import traceback



        traceback.print_exc()



        print(f"{'='*80}\n")



        return jsonify({



            "data": [],



            "count": 0,



            "dataSource": "Twelve Data (异常)",



            "note": "无法获取图表数据",



            "timestamp": int(time.time())



        }), 200







@app.route('/api/status', methods=['GET'])



def get_status():



    """系统状态接口"""



    return jsonify({



        "status": "online",



        "timestamp": int(time.time()),



        "dataSources": {



            "dashboardData": "Finnhub",



            "marketData": "Finnhub", 



            "chartData": "Twelve Data"



        },



        "version": "1.0.0"



    }), 200







if __name__ == '__main__':



    print("=" * 80)



    print("最终生产版本后端启动")



    print("数据源职责明确:")



    print("  - Dashboard 和 Market 普通数据: Finnhub")



    print("  - Analyze/Chart 图表数据: Twelve Data")



    print(f"端口: 8889")



    print("=" * 80)



    



    app.run(host='127.0.0.1', port=8889, debug=False, use_reloader=False)