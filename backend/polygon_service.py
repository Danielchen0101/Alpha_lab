"""
Polygon.io API 服务 - 市场数据提供
"""

import requests
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
# 尝试从config导入，如果失败则使用默认值
try:
    from config import POLYGON_API_KEY, POLYGON_BASE_URL, POLYGON_ENDPOINTS, TIMEFRAME_MAP, DATA_SOURCE
except ImportError:
    # 使用默认值
    POLYGON_API_KEY = "Pb17vE12y3eH4ixU_P3or5W89TfFbN7E"
    POLYGON_BASE_URL = "https://api.polygon.io"
    POLYGON_ENDPOINTS = {
        "ticker_details": "/v3/reference/tickers/{ticker}",
        "aggregates": "/v2/aggs/ticker/{ticker}/range/{multiplier}/{timespan}/{from_date}/{to_date}",
        "previous_close": "/v2/aggs/ticker/{ticker}/prev",
        "ticker_types": "/v3/reference/tickers/types"
    }
    TIMEFRAME_MAP = {
        "1D": ("5", "minute"),
        "1W": ("1", "day"),
        "1M": ("1", "day"),
        "3M": ("1", "day"),
        "1Y": ("1", "day")
    }
    DATA_SOURCE = {
        "market_data": "Polygon.io",
        "trading": "Alpaca"
    }

logger = logging.getLogger(__name__)

class PolygonService:
    """Polygon.io API 服务类"""
    
    def __init__(self):
        self.api_key = POLYGON_API_KEY
        self.base_url = POLYGON_BASE_URL
        self.data_source = DATA_SOURCE["market_data"]
        
    def _make_request(self, endpoint: str, params: Dict = None) -> Dict:
        """发送请求到 Polygon API"""
        try:
            url = f"{self.base_url}{endpoint}"
            
            # 添加API密钥
            if params is None:
                params = {}
            params["apiKey"] = self.api_key
            
            logger.info(f"请求 Polygon API: {url}")
            response = requests.get(url, params=params, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                logger.info(f"Polygon API 响应成功: {endpoint}")
                return data
            else:
                logger.error(f"Polygon API 错误: {response.status_code} - {response.text}")
                return {"error": f"API错误: {response.status_code}"}
                
        except Exception as e:
            logger.error(f"Polygon API 请求异常: {e}")
            return {"error": f"请求异常: {str(e)}"}
    
    def get_ticker_details(self, symbol: str) -> Dict:
        """获取股票详细信息"""
        endpoint = POLYGON_ENDPOINTS["ticker_details"].format(ticker=symbol.upper())
        return self._make_request(endpoint)
    
    def get_previous_close(self, symbol: str) -> Dict:
        """获取前一日收盘价"""
        endpoint = POLYGON_ENDPOINTS["previous_close"].format(ticker=symbol.upper())
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
        
        return self._make_request(endpoint, params)
    
    def get_stock_list(self, limit: int = 50) -> Dict:
        """获取股票列表"""
        endpoint = POLYGON_ENDPOINTS["tickers"]
        params = {
            "market": "stocks",
            "active": "true",
            "sort": "ticker",
            "order": "asc",
            "limit": limit
        }
        return self._make_request(endpoint, params)
    
    def get_grouped_daily(self, date: str = None) -> Dict:
        """获取分组日数据"""
        if date is None:
            date = datetime.now().strftime("%Y-%m-%d")
        
        endpoint = POLYGON_ENDPOINTS["grouped_daily"].format(date=date)
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
    
    def get_technical_indicator(self, symbol: str, indicator: str = "sma", params: Dict = None) -> Dict:
        """获取技术指标"""
        if indicator not in ["sma", "ema", "macd", "rsi"]:
            indicator = "sma"
        
        endpoint = POLYGON_ENDPOINTS[indicator].format(ticker=symbol.upper())
        
        if params is None:
            params = {
                "timespan": "day",
                "window": 20,
                "series_type": "close"
            }
        
        return self._make_request(endpoint, params)
    
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


# 创建全局实例
polygon_service = PolygonService()