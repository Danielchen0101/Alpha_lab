"""
Polygon.io API 服务 - 专门负责市场数据
"""

import requests
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from ..config import (
    POLYGON_API_KEY, POLYGON_BASE_URL, POLYGON_ENDPOINTS, 
    TIMEFRAME_MAP, DATA_SOURCE, REQUEST_TIMEOUT
)

logger = logging.getLogger(__name__)

class PolygonService:
    """Polygon.io API 服务类 - 专门处理市场数据"""
    
    def __init__(self):
        self.api_key = POLYGON_API_KEY
        self.base_url = POLYGON_BASE_URL
        self.data_source = DATA_SOURCE["market_data"]
        
        if not self.api_key:
            raise ValueError("POLYGON_API_KEY 未配置")
        
        logger.info(f"初始化 PolygonService，数据源: {self.data_source}")
    
    def _make_request(self, endpoint: str, params: Dict = None) -> Dict:
        """发送请求到 Polygon API"""
        try:
            url = f"{self.base_url}{endpoint}"
            
            # 添加API密钥
            if params is None:
                params = {}
            params["apiKey"] = self.api_key
            
            logger.debug(f"请求 Polygon API: {url}")
            response = requests.get(url, params=params, timeout=REQUEST_TIMEOUT)
            
            if response.status_code == 200:
                data = response.json()
                logger.debug(f"Polygon API 响应成功: {endpoint}")
                return data
            else:
                logger.error(f"Polygon API 错误: {response.status_code} - {response.text}")
                return {
                    "error": f"API错误: {response.status_code}",
                    "status_code": response.status_code,
                    "details": response.text[:200] if response.text else ""
                }
                
        except requests.exceptions.Timeout:
            logger.error(f"Polygon API 请求超时: {endpoint}")
            return {"error": "请求超时", "timeout": True}
        except Exception as e:
            logger.error(f"Polygon API 请求异常: {e}")
            return {"error": f"请求异常: {str(e)}"}
    
    # ========== 股票基本信息 ==========
    
    def get_ticker_details(self, symbol: str) -> Dict:
        """获取股票详细信息"""
        endpoint = POLYGON_ENDPOINTS["ticker_details"].format(ticker=symbol.upper())
        return self._make_request(endpoint)
    
    def get_tickers(self, market: str = "stocks", active: bool = True, 
                   limit: int = 50, sort: str = "ticker") -> Dict:
        """获取股票列表"""
        endpoint = POLYGON_ENDPOINTS["tickers"]
        params = {
            "market": market,
            "active": "true" if active else "false",
            "sort": sort,
            "order": "asc",
            "limit": limit
        }
        return self._make_request(endpoint, params)
    
    def search_tickers(self, query: str, limit: int = 20) -> Dict:
        """搜索股票"""
        endpoint = POLYGON_ENDPOINTS["tickers"]
        params = {
            "search": query,
            "market": "stocks",
            "active": "true",
            "limit": limit
        }
        return self._make_request(endpoint, params)
    
    # ========== 价格数据 ==========
    
    def get_previous_close(self, symbol: str) -> Dict:
        """获取前一日收盘价"""
        endpoint = POLYGON_ENDPOINTS["previous_close"].format(ticker=symbol.upper())
        return self._make_request(endpoint)
    
    def get_daily_open_close(self, symbol: str, date: str = None) -> Dict:
        """获取日开盘收盘数据"""
        if date is None:
            date = datetime.now().strftime("%Y-%m-%d")
        
        endpoint = POLYGON_ENDPOINTS["daily_open_close"].format(
            ticker=symbol.upper(),
            date=date
        )
        return self._make_request(endpoint)
    
    def get_aggregates(self, symbol: str, timeframe: str = "1M") -> Dict:
        """获取聚合数据（历史价格）"""
        # 解析时间框架
        if timeframe not in TIMEFRAME_MAP:
            timeframe = "1M"
        
        config = TIMEFRAME_MAP[timeframe]
        multiplier = config["multiplier"]
        timespan = config["timespan"]
        limit = config["limit"]
        
        # 计算日期范围
        end_date = datetime.now()
        start_date = end_date - timedelta(days=limit * 2)  # 确保有足够数据
        
        from_date = start_date.strftime("%Y-%m-%d")
        to_date = end_date.strftime("%Y-%m-%d")
        
        endpoint = POLYGON_ENDPOINTS["aggregates"].format(
            ticker=symbol.upper(),
            multiplier=multiplier,
            timespan=timespan,
            from_=from_date,
            to=to_date
        )
        
        params = {
            "adjusted": "true",
            "sort": "asc",
            "limit": limit
        }
        
        logger.info(f"调用Polygon aggregates API: {symbol}, timeframe={timeframe}")
        logger.info(f"  - multiplier={multiplier}, timespan={timespan}, limit={limit}")
        logger.info(f"  - 日期范围: {from_date} 到 {to_date}")
        logger.info(f"  - endpoint: {endpoint}")
        
        result = self._make_request(endpoint, params)
        
        # 记录结果
        if "error" in result:
            logger.error(f"Polygon aggregates API 失败: {result['error']}")
        elif "results" in result:
            logger.info(f"Polygon aggregates API 成功: 返回 {len(result.get('results', []))} 条数据")
        else:
            logger.warning(f"Polygon aggregates API 返回意外格式: {result.keys()}")
        
        return result
    
    def get_grouped_daily(self, date: str = None) -> Dict:
        """获取分组日数据"""
        if date is None:
            date = datetime.now().strftime("%Y-%m-%d")
        
        endpoint = POLYGON_ENDPOINTS["grouped_daily"].format(date=date)
        return self._make_request(endpoint)
    
    # ========== 技术指标 ==========
    
    def get_sma(self, symbol: str, window: int = 20, timespan: str = "day") -> Dict:
        """获取简单移动平均线"""
        endpoint = POLYGON_ENDPOINTS["sma"].format(ticker=symbol.upper())
        params = {
            "timespan": timespan,
            "window": window,
            "series_type": "close"
        }
        return self._make_request(endpoint, params)
    
    def get_ema(self, symbol: str, window: int = 20, timespan: str = "day") -> Dict:
        """获取指数移动平均线"""
        endpoint = POLYGON_ENDPOINTS["ema"].format(ticker=symbol.upper())
        params = {
            "timespan": timespan,
            "window": window,
            "series_type": "close"
        }
        return self._make_request(endpoint, params)
    
    def get_macd(self, symbol: str, short_window: int = 12, long_window: int = 26, 
                signal_window: int = 9, timespan: str = "day") -> Dict:
        """获取MACD指标"""
        endpoint = POLYGON_ENDPOINTS["macd"].format(ticker=symbol.upper())
        params = {
            "timespan": timespan,
            "short_window": short_window,
            "long_window": long_window,
            "signal_window": signal_window,
            "series_type": "close"
        }
        return self._make_request(endpoint, params)
    
    def get_rsi(self, symbol: str, window: int = 14, timespan: str = "day") -> Dict:
        """获取RSI指标"""
        endpoint = POLYGON_ENDPOINTS["rsi"].format(ticker=symbol.upper())
        params = {
            "timespan": timespan,
            "window": window,
            "series_type": "close"
        }
        return self._make_request(endpoint, params)
    
    # ========== 数据格式化 ==========
    
    def format_stock_data(self, symbol: str, details: Dict, prev_close: Dict) -> Dict:
        """格式化股票数据为前端所需格式"""
        try:
            # 从详情中提取信息
            ticker_info = details.get("results", {})
            
            # 从前一日收盘数据中提取价格信息
            prev_results = prev_close.get("results", [])
            prev_data = prev_results[0] if prev_results else {}
            
            # 构建响应
            stock_data = {
                "symbol": symbol.upper(),
                "name": ticker_info.get("name", ""),
                "price": prev_data.get("c", 0),  # 收盘价
                "change": prev_data.get("c", 0) - prev_data.get("o", 0),  # 涨跌
                "changePercent": ((prev_data.get("c", 0) - prev_data.get("o", 0)) / prev_data.get("o", 1) * 100) if prev_data.get("o", 0) != 0 else 0,
                "dayHigh": prev_data.get("h", 0),
                "dayLow": prev_data.get("l", 0),
                "previousClose": prev_data.get("c", 0),
                "volume": prev_data.get("v", 0),
                "marketCap": ticker_info.get("market_cap", 0),
                "sector": ticker_info.get("sic_description", ""),
                "industry": ticker_info.get("industry", ""),
                "currency": ticker_info.get("currency_name", "USD"),
                "dataSource": self.data_source,
                "timestamp": datetime.now().isoformat()
            }
            
            return stock_data
            
        except Exception as e:
            logger.error(f"格式化股票数据失败 {symbol}: {e}")
            return {
                "symbol": symbol.upper(),
                "error": f"数据格式化失败: {str(e)}",
                "dataSource": self.data_source
            }
    
    def format_historical_data(self, symbol: str, aggregates: Dict, timeframe: str) -> Dict:
        """格式化历史数据为前端所需格式"""
        try:
            results = aggregates.get("results", [])
            
            formatted_data = {
                "symbol": symbol.upper(),
                "interval": timeframe,
                "count": len(results),
                "data": [],
                "source": self.data_source,
                "message": f"Historical data from {self.data_source}"
            }
            
            for item in results:
                timestamp = item.get("t", 0) / 1000  # Polygon 返回毫秒时间戳
                formatted_data["data"].append({
                    "timestamp": int(timestamp),
                    "time": datetime.fromtimestamp(timestamp).isoformat(),
                    "open": item.get("o", 0),
                    "high": item.get("h", 0),
                    "low": item.get("l", 0),
                    "close": item.get("c", 0),
                    "volume": item.get("v", 0)
                })
            
            return formatted_data
            
        except Exception as e:
            logger.error(f"格式化历史数据失败 {symbol}: {e}")
            return {
                "symbol": symbol.upper(),
                "error": f"历史数据格式化失败: {str(e)}",
                "source": self.data_source,
                "data": []
            }
    
    def format_ticker_list(self, tickers_data: Dict) -> Dict:
        """格式化股票列表数据"""
        try:
            results = tickers_data.get("results", [])
            
            formatted_tickers = []
            for ticker in results:
                formatted_tickers.append({
                    "symbol": ticker.get("ticker", ""),
                    "name": ticker.get("name", ""),
                    "market": ticker.get("market", ""),
                    "locale": ticker.get("locale", ""),
                    "currency": ticker.get("currency_name", "USD"),
                    "active": ticker.get("active", False),
                    "dataSource": self.data_source
                })
            
            return {
                "tickers": formatted_tickers,
                "count": len(formatted_tickers),
                "dataSource": self.data_source
            }
            
        except Exception as e:
            logger.error(f"格式化股票列表失败: {e}")
            return {
                "error": f"股票列表格式化失败: {str(e)}",
                "dataSource": self.data_source
            }


# 创建全局实例
polygon_service = PolygonService()