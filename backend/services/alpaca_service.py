"""
Alpaca Markets API 服务 - 专门负责交易功能
"""

import requests
import logging
from datetime import datetime
from typing import Dict, List, Optional, Any
from ..config import (
    ALPACA_API_KEY, ALPACA_API_SECRET, ALPACA_BASE_URL, 
    ALPACA_ENDPOINTS, DATA_SOURCE, REQUEST_TIMEOUT
)

logger = logging.getLogger(__name__)

class AlpacaService:
    """Alpaca Markets API 服务类 - 专门处理交易功能"""
    
    def __init__(self, paper_trading: bool = True):
        self.api_key = ALPACA_API_KEY
        self.api_secret = ALPACA_API_SECRET
        self.base_url = ALPACA_BASE_URL
        self.data_source = DATA_SOURCE["trading"]
        self.paper_trading = paper_trading
        
        if not self.api_key:
            raise ValueError("ALPACA_API_KEY 未配置")
        if not self.api_secret:
            raise ValueError("ALPACA_API_SECRET 未配置")
        
        self.headers = {
            "APCA-API-KEY-ID": self.api_key,
            "APCA-API-SECRET-KEY": self.api_secret
        }
        
        logger.info(f"初始化 AlpacaService，数据源: {self.data_source}，模拟交易: {self.paper_trading}")
    
    def _make_request(self, method: str, endpoint: str, params: Dict = None, data: Dict = None) -> Dict:
        """发送请求到 Alpaca API"""
        try:
            url = f"{self.base_url}{endpoint}"
            
            logger.debug(f"请求 Alpaca API: {method} {url}")
            
            if method.upper() == "GET":
                response = requests.get(url, headers=self.headers, params=params, timeout=REQUEST_TIMEOUT)
            elif method.upper() == "POST":
                response = requests.post(url, headers=self.headers, json=data, params=params, timeout=REQUEST_TIMEOUT)
            elif method.upper() == "PUT":
                response = requests.put(url, headers=self.headers, json=data, params=params, timeout=REQUEST_TIMEOUT)
            elif method.upper() == "DELETE":
                response = requests.delete(url, headers=self.headers, params=params, timeout=REQUEST_TIMEOUT)
            else:
                return {"error": f"不支持的HTTP方法: {method}"}
            
            if response.status_code == 200:
                data = response.json()
                logger.debug(f"Alpaca API 响应成功: {endpoint}")
                return data
            else:
                logger.error(f"Alpaca API 错误: {response.status_code} - {response.text}")
                return {
                    "error": f"API错误: {response.status_code}",
                    "status_code": response.status_code,
                    "details": response.text[:200] if response.text else ""
                }
                
        except requests.exceptions.Timeout:
            logger.error(f"Alpaca API 请求超时: {endpoint}")
            return {"error": "请求超时", "timeout": True}
        except Exception as e:
            logger.error(f"Alpaca API 请求异常: {e}")
            return {"error": f"请求异常: {str(e)}"}
    
    # ========== 账户管理 ==========
    
    def get_account(self) -> Dict:
        """获取账户信息"""
        endpoint = ALPACA_ENDPOINTS["account"]
        return self._make_request("GET", endpoint)
    
    def get_account_config(self) -> Dict:
        """获取账户配置"""
        endpoint = ALPACA_ENDPOINTS["account_config"]
        return self._make_request("GET", endpoint)
    
    def update_account_config(self, config: Dict) -> Dict:
        """更新账户配置"""
        endpoint = ALPACA_ENDPOINTS["account_config"]
        return self._make_request("PUT", endpoint, data=config)
    
    def get_account_activities(self, activity_type: str = None, date: str = None, 
                              direction: str = "desc") -> Dict:
        """获取账户活动"""
        endpoint = ALPACA_ENDPOINTS["account_activities"]
        params = {"direction": direction}
        
        if activity_type:
            params["activity_type"] = activity_type
        
        if date:
            params["date"] = date
        
        return self._make_request("GET", endpoint, params)
    
    # ========== 订单管理 ==========
    
    def get_orders(self, status: str = "all", limit: int = 100, 
                  after: str = None, until: str = None, direction: str = "desc") -> Dict:
        """获取订单列表"""
        endpoint = ALPACA_ENDPOINTS["orders"]
        params = {
            "status": status,
            "limit": limit,
            "direction": direction
        }
        
        if after:
            params["after"] = after
        
        if until:
            params["until"] = until
        
        return self._make_request("GET", endpoint, params)
    
    def get_order(self, order_id: str) -> Dict:
        """获取特定订单"""
        endpoint = ALPACA_ENDPOINTS["order"].format(order_id=order_id)
        return self._make_request("GET", endpoint)
    
    def get_order_by_client_id(self, client_order_id: str) -> Dict:
        """通过客户端订单ID获取订单"""
        endpoint = ALPACA_ENDPOINTS["order_by_client"]
        params = {"client_order_id": client_order_id}
        return self._make_request("GET", endpoint, params)
    
    def place_order(self, symbol: str, qty: float, side: str, 
                   order_type: str = "market", time_in_force: str = "day",
                   limit_price: float = None, stop_price: float = None,
                   client_order_id: str = None) -> Dict:
        """下订单"""
        endpoint = ALPACA_ENDPOINTS["orders"]
        
        order_data = {
            "symbol": symbol.upper(),
            "qty": str(qty),
            "side": side.lower(),
            "type": order_type.lower(),
            "time_in_force": time_in_force.lower()
        }
        
        if limit_price is not None:
            order_data["limit_price"] = str(limit_price)
        
        if stop_price is not None:
            order_data["stop_price"] = str(stop_price)
        
        if client_order_id:
            order_data["client_order_id"] = client_order_id
        
        return self._make_request("POST", endpoint, data=order_data)
    
    def cancel_order(self, order_id: str) -> Dict:
        """取消订单"""
        endpoint = ALPACA_ENDPOINTS["order"].format(order_id=order_id)
        return self._make_request("DELETE", endpoint)
    
    def cancel_all_orders(self) -> Dict:
        """取消所有订单"""
        endpoint = ALPACA_ENDPOINTS["orders"]
        return self._make_request("DELETE", endpoint)
    
    # ========== 持仓管理 ==========
    
    def get_positions(self) -> Dict:
        """获取所有持仓"""
        endpoint = ALPACA_ENDPOINTS["positions"]
        return self._make_request("GET", endpoint)
    
    def get_position(self, symbol: str) -> Dict:
        """获取特定持仓"""
        endpoint = ALPACA_ENDPOINTS["position"].format(symbol_or_asset_id=symbol.upper())
        return self._make_request("GET", endpoint)
    
    def close_position(self, symbol: str, qty: float = None) -> Dict:
        """平仓"""
        endpoint = ALPACA_ENDPOINTS["position"].format(symbol_or_asset_id=symbol.upper())
        
        if qty is not None:
            params = {"qty": str(qty)}
            return self._make_request("DELETE", endpoint, params=params)
        else:
            return self._make_request("DELETE", endpoint)
    
    def close_all_positions(self) -> Dict:
        """平掉所有持仓"""
        endpoint = ALPACA_ENDPOINTS["positions"]
        return self._make_request("DELETE", endpoint)
    
    # ========== 资产管理 ==========
    
    def get_assets(self, status: str = "active", asset_class: str = "us_equity") -> Dict:
        """获取资产列表"""
        endpoint = ALPACA_ENDPOINTS["assets"]
        params = {
            "status": status,
            "asset_class": asset_class
        }
        return self._make_request("GET", endpoint, params)
    
    def get_asset(self, symbol: str) -> Dict:
        """获取特定资产信息"""
        endpoint = ALPACA_ENDPOINTS["asset"].format(symbol_or_asset_id=symbol.upper())
        return self._make_request("GET", endpoint)
    
    # ========== 数据格式化 ==========
    
    def format_account_data(self, account_data: Dict) -> Dict:
        """格式化账户数据"""
        try:
            return {
                "account_number": account_data.get("id", ""),
                "status": account_data.get("status", ""),
                "currency": account_data.get("currency", "USD"),
                "buying_power": float(account_data.get("buying_power", 0)),
                "cash": float(account_data.get("cash", 0)),
                "portfolio_value": float(account_data.get("portfolio_value", 0)),
                "equity": float(account_data.get("equity", 0)),
                "last_equity": float(account_data.get("last_equity", 0)),
                "long_market_value": float(account_data.get("long_market_value", 0)),
                "short_market_value": float(account_data.get("short_market_value", 0)),
                "initial_margin": float(account_data.get("initial_margin", 0)),
                "maintenance_margin": float(account_data.get("maintenance_margin", 0)),
                "daytrade_count": account_data.get("daytrade_count", 0),
                "dataSource": self.data_source,
                "paper_trading": self.paper_trading,
                "timestamp": datetime.now().isoformat()
            }
        except Exception as e:
            logger.error(f"格式化账户数据失败: {e}")
            return {
                "error": f"账户数据格式化失败: {str(e)}",
                "dataSource": self.data_source
            }
    
    def format_position_data(self, positions: List[Dict]) -> Dict:
        """格式化持仓数据"""
        try:
            formatted_positions = []
            total_market_value = 0
            total_unrealized_pl = 0
            
            for position in positions:
                market_value = float(position.get("market_value", 0))
                unrealized_pl = float(position.get("unrealized_pl", 0))
                
                formatted_positions.append({
                    "symbol": position.get("symbol", ""),
                    "qty": float(position.get("qty", 0)),
                    "avg_entry_price": float(position.get("avg_entry_price", 0)),
                    "current_price": float(position.get("current_price", 0)),
                    "market_value": market_value,
                    "unrealized_pl": unrealized_pl,
                    "unrealized_plpc": float(position.get("unrealized_plpc", 0)),
                    "side": position.get("side", "long"),
                    "dataSource": self.data_source
                })
                
                total_market_value += market_value
                total_unrealized_pl += unrealized_pl
            
            return {
                "positions": formatted_positions,
                "total_market_value": total_market_value,
                "total_unrealized_pl": total_unrealized_pl,
                "count": len(formatted_positions),
                "dataSource": self.data_source,
                "paper_trading": self.paper_trading,
                "timestamp": datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"格式化持仓数据失败: {e}")
            return {
                "error": f"持仓数据格式化失败: {str(e)}",
                "dataSource": self.data_source
            }
    
    def format_order_data(self, orders: List[Dict]) -> Dict:
        """格式化订单数据"""
        try:
            formatted_orders = []
            
            for order in orders:
                formatted_orders.append({
                    "order_id": order.get("id", ""),
                    "client_order_id": order.get("client_order_id", ""),
                    "symbol": order.get("symbol", ""),
                    "qty": float(order.get("qty", 0)),
                    "filled_qty": float(order.get("filled_qty", 0)),
                    "side": order.get("side", ""),
                    "type": order.get("type", ""),
                    "time_in_force": order.get("time_in_force", ""),
                    "status": order.get("status", ""),
                    "submitted_at": order.get("submitted_at", ""),
                    "filled_at": order.get("filled_at", ""),
                    "limit_price": float(order.get("limit_price", 0)) if order.get("limit_price") else None,
                    "stop_price": float(order.get("stop_price", 0)) if order.get("stop_price") else None,
                    "filled_avg_price": float(order.get("filled_avg_price", 0)) if order.get("filled_avg_price") else None,
                    "dataSource": self.data_source
                })
            
            return {
                "orders": formatted_orders,
                "count": len(formatted_orders),
                "dataSource": self.data_source,
                "paper_trading": self.paper_trading,
                "timestamp": datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"格式化订单数据失败: {e}")
            return {
                "error": f"订单数据格式化失败: {str(e)}",
                "dataSource": self.data_source
            }
    
    def format_asset_data(self, assets: List[Dict]) -> Dict:
        """格式化资产数据"""
        try:
            formatted_assets = []
            
            for asset in assets:
                formatted_assets.append({
                    "symbol": asset.get("symbol", ""),
                    "name": asset.get("name", ""),
                    "exchange": asset.get("exchange", ""),
                    "class": asset.get("class", ""),
                    "status": asset.get("status", ""),
                    "tradable": asset.get("tradable", False),
                    "marginable": asset.get("marginable", False),
                    "shortable": asset.get("shortable", False),
                    "easy_to_borrow": asset.get("easy_to_borrow", False),
                    "dataSource": self.data_source
                })
            
            return {
                "assets": formatted_assets,
                "count": len(formatted_assets),
                "dataSource": self.data_source,
                "timestamp": datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"格式化资产数据失败: {e}")
            return {
                "error": f"资产数据格式化失败: {str(e)}",
                "dataSource": self.data_source
            }


# 创建全局实例（默认使用模拟交易）
alpaca_service = AlpacaService(paper_trading=True)