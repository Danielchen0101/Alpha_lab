"""
Finnhub数据服务
提供与当前前端StockData接口兼容的数据结构
包含缓存和限流保护
"""

import requests
import logging
import time
from datetime import datetime, timedelta
from threading import Lock

logger = logging.getLogger(__name__)

class FinnhubService:
    """Finnhub数据服务（带缓存和限流）"""
    
    def __init__(self):
        self.api_key = "d6qsdcpr01qgdhqc82hgd6qsdcpr01qgdhqc82i0"
        self.base_url = "https://finnhub.io/api/v1"
        
        # 缓存配置
        self.cache = {}
        self.cache_ttl = 60  # 缓存60秒
        self.cache_lock = Lock()
        
        # 限流配置
        self.rate_limit = 60  # 免费版60次/分钟
        self.request_timestamps = []
        self.rate_lock = Lock()
        
        # 错误处理
        self.last_429_time = 0
        self.cooldown_429 = 60  # 429错误后冷却60秒
        
    def _check_rate_limit(self):
        """检查速率限制"""
        with self.rate_lock:
            now = time.time()
            # 移除60秒前的请求记录
            self.request_timestamps = [t for t in self.request_timestamps if now - t < 60]
            
            # 检查是否超过限制
            if len(self.request_timestamps) >= self.rate_limit:
                wait_time = 60 - (now - self.request_timestamps[0])
                logger.warning(f"速率限制达到，需要等待 {wait_time:.1f} 秒")
                return False, wait_time
            
            # 检查429冷却
            if now - self.last_429_time < self.cooldown_429:
                wait_time = self.cooldown_429 - (now - self.last_429_time)
                logger.warning(f"429错误冷却中，需要等待 {wait_time:.1f} 秒")
                return False, wait_time
            
            return True, 0
    
    def _record_request(self):
        """记录请求时间"""
        with self.rate_lock:
            self.request_timestamps.append(time.time())
    
    def _handle_api_error(self, status_code, response_text):
        """处理API错误"""
        if status_code == 429:
            self.last_429_time = time.time()
            logger.error(f"Finnhub API速率限制 (429): {response_text}")
            return {"error": "API速率限制，请稍后重试", "status": 429}
        elif status_code == 403:
            logger.error(f"Finnhub API权限错误 (403): {response_text}")
            return {"error": "API权限错误", "status": 403}
        elif status_code == 401:
            logger.error(f"Finnhub API认证错误 (401): {response_text}")
            return {"error": "API认证错误", "status": 401}
        else:
            logger.error(f"Finnhub API错误 ({status_code}): {response_text}")
            return {"error": f"API错误: {status_code}", "status": status_code}
    
    def make_request(self, endpoint, params=None, use_cache=True):
        """发送请求到Finnhub API（带缓存和限流）"""
        try:
            # 检查速率限制
            can_request, wait_time = self._check_rate_limit()
            if not can_request:
                return {"error": f"速率限制，请等待 {wait_time:.1f} 秒后重试", "status": "rate_limited"}
            
            url = f"{self.base_url}{endpoint}"
            if params is None:
                params = {}
            params["token"] = self.api_key
            
            # 生成缓存键
            cache_key = f"{endpoint}:{str(sorted(params.items()))}"
            
            # 检查缓存
            if use_cache:
                with self.cache_lock:
                    if cache_key in self.cache:
                        cache_data, cache_time = self.cache[cache_key]
                        if time.time() - cache_time < self.cache_ttl:
                            logger.debug(f"使用缓存: {endpoint}")
                            return cache_data
            
            logger.info(f"请求Finnhub API: {endpoint}")
            response = requests.get(url, params=params, timeout=10)
            
            # 记录请求
            self._record_request()
            
            if response.status_code == 200:
                data = response.json()
                
                # 缓存成功响应
                if use_cache:
                    with self.cache_lock:
                        self.cache[cache_key] = (data, time.time())
                
                return data
            else:
                error_result = self._handle_api_error(response.status_code, response.text[:200])
                return error_result
                
        except requests.exceptions.Timeout:
            logger.error(f"Finnhub API请求超时: {endpoint}")
            return {"error": "请求超时", "status": "timeout"}
        except Exception as e:
            logger.error(f"Finnhub API请求异常: {e}")
            return {"error": f"请求异常: {str(e)}", "status": "exception"}
    
    def get_stock_quote(self, symbol):
        """获取股票实时报价"""
        return self.make_request(f"/quote", {"symbol": symbol})
    
    def get_stock_profile(self, symbol):
        """获取股票公司简介"""
        return self.make_request(f"/stock/profile2", {"symbol": symbol})
    
    def get_stock_metric(self, symbol):
        """获取股票财务指标"""
        return self.make_request(f"/stock/metric", {
            "symbol": symbol,
            "metric": "all"
        })
    
    def get_stock_candle(self, symbol, resolution, from_time, to_time):
        """获取股票K线数据"""
        return self.make_request(f"/stock/candle", {
            "symbol": symbol,
            "resolution": resolution,
            "from": from_time,
            "to": to_time
        })
    
    def get_stock_basic_financials(self, symbol):
        """获取股票基本财务数据"""
        return self.make_request(f"/stock/metric", {
            "symbol": symbol,
            "metric": "all"
        })
    
    def clear_cache(self):
        """清理缓存"""
        with self.cache_lock:
            self.cache.clear()
            logger.info("Finnhub缓存已清理")
    
    def get_stock_data(self, symbol, use_cache=True, lightweight=False):
        """获取完整的股票数据（兼容前端StockData接口）
        
        Args:
            symbol: 股票代码
            use_cache: 是否使用缓存
            lightweight: 轻量级模式，只获取必要数据（用于Dashboard）
        """
        try:
            symbol = symbol.upper()
            
            # 检查缓存
            cache_key = f"stock_data:{symbol}:{lightweight}"
            if use_cache:
                with self.cache_lock:
                    if cache_key in self.cache:
                        cache_data, cache_time = self.cache[cache_key]
                        if time.time() - cache_time < self.cache_ttl:
                            logger.debug(f"使用股票数据缓存: {symbol} (lightweight={lightweight})")
                            return cache_data
            
            logger.info(f"获取Finnhub股票数据: {symbol} (lightweight={lightweight})")
            
            # 顺序获取数据（避免线程并发导致速率限制）
            quote_data = self.get_stock_quote(symbol)
            
            # 检查quote错误
            if "error" in quote_data:
                error_msg = quote_data.get("error", "未知错误")
                status = quote_data.get("status")
                
                # 如果是速率限制错误，返回特定错误
                if status == 429 or "rate" in error_msg.lower():
                    return {
                        "symbol": symbol,
                        "error": "数据暂时不可用（API速率限制）",
                        "dataSource": "Finnhub (rate limited)",
                        "status": "rate_limited"
                    }
                
                logger.error(f"获取{symbol}报价失败: {error_msg}")
                return {"error": f"获取报价失败: {error_msg}", "symbol": symbol, "dataSource": "Finnhub (error)"}
            
            # 轻量级模式：只获取必要数据
            if lightweight:
                # 轻量级模式也需要marketCap，所以获取profile
                profile_data = self.get_stock_profile(symbol)
                metric_data = None
            else:
                # 完整模式：获取所有数据
                profile_data = self.get_stock_profile(symbol)
                metric_data = self.get_stock_metric(symbol)
            
            # 提取关键字段
            price = quote_data.get("c")  # 当前价格
            previous_close = quote_data.get("pc")  # 前收盘价
            change = quote_data.get("d")  # 涨跌额
            change_percent = quote_data.get("dp")  # 涨跌幅百分比
            
            # 计算涨跌幅（如果API没有提供）
            if price is not None and previous_close is not None and previous_close != 0:
                if change is None:
                    change = price - previous_close
                if change_percent is None:
                    change_percent = (change / previous_close) * 100
            
            # 提取财务指标
            metric_info = metric_data.get("metric", {}) if metric_data else {}
            
            # 构建兼容前端的数据结构
            # 注意：Finnhub的marketCapitalization单位是百万美元，需要转换
            market_cap_raw = profile_data.get("marketCapitalization") if isinstance(profile_data, dict) else None
            market_cap = market_cap_raw * 1000000 if market_cap_raw else None
            
            # 调试日志：检查marketCap计算
            logger.debug(f"{symbol} marketCap计算: raw={market_cap_raw}, converted={market_cap}, lightweight={lightweight}")
            
            stock_data = {
                "symbol": symbol,
                "name": profile_data.get("name") if isinstance(profile_data, dict) else None,
                "price": price,  # 当前价格（不是前收盘价）
                "change": change,  # 真实涨跌额
                "changePercent": change_percent,  # 真实涨跌幅
                "previousClose": previous_close,  # 前收盘价
                "volume": quote_data.get("v"),  # 当前成交量
                "dayHigh": quote_data.get("h"),  # 当日最高
                "dayLow": quote_data.get("l"),   # 当日最低
                "marketCap": market_cap,  # 已转换为美元
                "sector": profile_data.get("finnhubIndustry") if isinstance(profile_data, dict) else None,
                "industry": profile_data.get("finnhubIndustry") if isinstance(profile_data, dict) else None,
                "currency": profile_data.get("currency", "USD") if isinstance(profile_data, dict) else "USD",
                "peRatio": metric_info.get("peNormalizedAnnual") if isinstance(metric_info, dict) else None,
                "dividendYield": metric_info.get("dividendYieldIndicatedAnnual") if isinstance(metric_info, dict) else None,
                "yearHigh": metric_info.get("52WeekHigh") if isinstance(metric_info, dict) else None,
                "yearLow": metric_info.get("52WeekLow") if isinstance(metric_info, dict) else None,
                "dataSource": "Finnhub",  # 统一使用"Finnhub"
                "timestamp": datetime.now().isoformat()
            }
            
            # 缓存结果
            if use_cache:
                with self.cache_lock:
                    self.cache[cache_key] = (stock_data, time.time())
            
            logger.info(f"✅ 从Finnhub获取{symbol}数据成功: ${price}")
            return stock_data
            
        except Exception as e:
            logger.error(f"获取Finnhub股票数据失败 {symbol}: {e}")
            return {"error": str(e), "symbol": symbol, "dataSource": "Finnhub (error)"}
    
    def get_multiple_stocks(self, symbols, use_cache=True, lightweight=False):
        """批量获取多个股票数据（带缓存和错误处理）
        
        Args:
            symbols: 股票代码列表
            use_cache: 是否使用缓存
            lightweight: 轻量级模式，只获取必要数据（用于Dashboard）
        """
        import concurrent.futures
        import threading
        
        stocks = []
        errors = []
        rate_limited_symbols = []
        
        # 检查Dashboard缓存（整个股票列表的缓存）
        cache_suffix = ":lightweight" if lightweight else ":full"
        if use_cache:
            cache_key = f"dashboard_stocks:{','.join(sorted(symbols))}{cache_suffix}"
            with self.cache_lock:
                if cache_key in self.cache:
                    cache_data, cache_time = self.cache[cache_key]
                    if time.time() - cache_time < self.cache_ttl:
                        logger.info(f"使用Dashboard缓存: {len(symbols)}只股票 (lightweight={lightweight})")
                        return cache_data
        
        logger.info(f"批量获取{len(symbols)}只股票数据 (lightweight={lightweight})")
        start_time = time.time()
        
        # 使用线程池并发获取股票数据
        max_workers = min(5, len(symbols))  # 限制并发数，避免触发速率限制
        with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
            # 提交所有任务
            future_to_symbol = {
                executor.submit(self.get_stock_data, symbol, use_cache=use_cache, lightweight=lightweight): symbol 
                for symbol in symbols
            }
            
            # 收集结果
            for future in concurrent.futures.as_completed(future_to_symbol):
                symbol = future_to_symbol[future]
                try:
                    stock_data = future.result(timeout=10)  # 每只股票最多10秒
                    
                    if "error" in stock_data:
                        error_msg = stock_data.get("error", "未知错误")
                        
                        # 特殊处理速率限制错误
                        if stock_data.get("status") == "rate_limited":
                            rate_limited_symbols.append(symbol)
                            errors.append(f"{symbol}: 数据暂时不可用（API速率限制）")
                        else:
                            errors.append(f"{symbol}: {error_msg}")
                    else:
                        stocks.append(stock_data)
                        
                except concurrent.futures.TimeoutError:
                    errors.append(f"{symbol}: 请求超时（10秒）")
                    logger.warning(f"获取{symbol}数据超时")
                except Exception as e:
                    errors.append(f"{symbol}: {str(e)}")
                    logger.error(f"获取{symbol}数据异常: {str(e)}")
        
        elapsed_time = time.time() - start_time
        logger.info(f"批量获取完成: {len(stocks)}成功, {len(errors)}失败, 耗时{elapsed_time:.2f}秒 (lightweight={lightweight})")
        
        result = {
            "count": len(stocks),
            "stocks": stocks,
            "errors": errors if errors else None,
            "dataSource": "Finnhub",
            "timestamp": datetime.now().isoformat()
        }
        
        # 如果有速率限制错误，添加警告
        if rate_limited_symbols:
            result["rate_limited"] = True
            result["rate_limited_symbols"] = rate_limited_symbols
            logger.warning(f"批量获取中部分股票受速率限制: {rate_limited_symbols}")
        
        if errors and not rate_limited_symbols:
            logger.warning(f"批量获取股票数据完成，但有错误: {errors}")
        
        # 缓存Dashboard结果
        if use_cache and stocks:  # 只有成功获取数据时才缓存
            with self.cache_lock:
                self.cache[cache_key] = (result, time.time())
                logger.debug(f"缓存Dashboard数据: {len(symbols)}只股票 (lightweight={lightweight})")
        
        return result


# 创建全局实例
finnhub_service = FinnhubService()

if __name__ == "__main__":
    # 测试代码
    import json
    
    print("测试Finnhub服务...")
    
    # 测试单个股票
    print("\n1. 测试获取AAPL数据:")
    aapl_data = finnhub_service.get_stock_data("AAPL")
    print(json.dumps(aapl_data, indent=2))
    
    # 测试批量获取
    print("\n2. 测试批量获取数据:")
    batch_data = finnhub_service.get_multiple_stocks(["AAPL", "MSFT", "GOOGL"])
    print(f"成功获取: {batch_data['count']} 只股票")
    if batch_data['stocks']:
        print(f"第一只股票: {batch_data['stocks'][0]['symbol']} - ${batch_data['stocks'][0]['price']}")