"""
Alpaca Markets API 服务 - 交易执行层
"""

import requests
import logging
from datetime import datetime
from typing import Dict, List, Optional, Any

logger = logging.getLogger(__name__)

class AlpacaService:
    """Alpaca Markets API 服务类 - 交易执行层"""
    
    def __init__(self):
        # Alpaca Paper Trading API 配置
        self.api_key = "PK47HFNRVYZ7XZLLLYUULBIY4R"
        self.api_secret = "6CgiJaMDvref9uoHRUph8qMyBKJyHbRxPrGHgKYq2T5g"
        self.base_url = "https://paper-api.alpaca.markets/v2"
        self.data_source = "Alpaca Markets (Paper Trading)"
        
        self.headers = {
            "APCA-API-KEY-ID": self.api_key,
            "APCA-API-SECRET-KEY": self.api_secret
        }
        
        logger.info("✅ AlpacaService 初始化成功 (Paper Trading)")
    
    def _make_request(self, method: str, endpoint: str, params: Dict = None, data: Dict = None) -> Dict:
        """发送请求到 Alpaca API"""
        try:
            url = f"{self.base_url}{endpoint}"
            
            logger.info(f"请求 Alpaca API: {method} {endpoint}")
            
            if method.upper() == "GET":
                response = requests.get(url, headers=self.headers, params=params, timeout=10)
            elif method.upper() == "POST":
                response = requests.post(url, headers=self.headers, json=data, params=params, timeout=10)
            elif method.upper() == "DELETE":
                response = requests.delete(url, headers=self.headers, params=params, timeout=10)
            else:
                return {"error": f"不支持的HTTP方法: {method}"}
            
            if response.status_code in [200, 201]:
                data = response.json()
                logger.info(f"Alpaca API 响应成功: {endpoint}")
                return data
            else:
                logger.error(f"Alpaca API 错误: {response.status_code} - {response.text}")
                return {"error": f"API错误: {response.status_code}", "details": response.text}
                
        except Exception as e:
            logger.error(f"Alpaca API 请求异常: {e}")
            return {"error": f"请求异常: {str(e)}"}
    
    # ========== 账户相关 ==========
    
    def get_account(self) -> Dict:
        """获取账户信息"""
        return self._make_request("GET", "/account")
    
    def get_account_activities(self, activity_type: str = None, date: str = None) -> List[Dict]:
        """获取账户活动"""
        params = {}
        if activity_type:
            params["activity_type"] = activity_type
        if date:
            params["date"] = date
            
        result = self._make_request("GET", "/account/activities", params=params)
        return result if isinstance(result, list) else []
    
    # ========== 持仓相关 ==========
    
    def get_positions(self) -> List[Dict]:
        """获取所有持仓"""
        result = self._make_request("GET", "/positions")
        return result if isinstance(result, list) else []
    
    def get_position(self, symbol: str) -> Dict:
        """获取单个持仓"""
        return self._make_request("GET", f"/positions/{symbol.upper()}")
    
    def close_position(self, symbol: str) -> Dict:
        """平仓"""
        return self._make_request("DELETE", f"/positions/{symbol.upper()}")
    
    def close_all_positions(self) -> List[Dict]:
        """平掉所有持仓"""
        return self._make_request("DELETE", "/positions")
    
    # ========== 订单相关 ==========
    
    def get_orders(self, status: str = None, limit: int = 100) -> List[Dict]:
        """获取订单列表"""
        params = {"limit": limit}
        if status:
            params["status"] = status
            
        result = self._make_request("GET", "/orders", params=params)
        return result if isinstance(result, list) else []
    
    def get_order(self, order_id: str) -> Dict:
        """获取单个订单"""
        return self._make_request("GET", f"/orders/{order_id}")
    
    def submit_order(self, order_data: Dict) -> Dict:
        """提交新订单"""
        required_fields = ["symbol", "qty", "side", "type", "time_in_force"]
        for field in required_fields:
            if field not in order_data:
                return {"error": f"缺少必要字段: {field}"}
        
        # 确保symbol大写
        order_data["symbol"] = order_data["symbol"].upper()
        
        return self._make_request("POST", "/orders", data=order_data)
    
    def cancel_order(self, order_id: str) -> Dict:
        """取消订单"""
        return self._make_request("DELETE", f"/orders/{order_id}")
    
    def cancel_all_orders(self) -> List[Dict]:
        """取消所有订单"""
        return self._make_request("DELETE", "/orders")
    
    # ========== 资产相关 ==========
    
    def get_assets(self, status: str = "active", asset_class: str = "us_equity") -> List[Dict]:
        """获取可交易资产"""
        params = {"status": status, "asset_class": asset_class}
        result = self._make_request("GET", "/assets", params=params)
        return result if isinstance(result, list) else []
    
    def get_asset(self, symbol: str) -> Dict:
        """获取单个资产信息"""
        return self._make_request("GET", f"/assets/{symbol.upper()}")
    
    # ========== 市场数据相关 ==========
    # 注意：Alpaca也有市场数据，但我们使用Polygon作为主要市场数据源
    # 这里只提供必要的交易执行相关数据
    
    def get_last_trade(self, symbol: str) -> Dict:
        """获取最新交易数据（用于订单执行）"""
        return self._make_request("GET", f"/last/stocks/{symbol.upper()}")
    
    def get_last_quote(self, symbol: str) -> Dict:
        """获取最新报价（用于订单执行）"""
        return self._make_request("GET", f"/last_quote/stocks/{symbol.upper()}")
    
    # ========== 辅助方法 ==========
    
    def format_account_summary(self, account_data: Dict) -> Dict:
        """格式化账户摘要信息"""
        if "error" in account_data:
            return account_data
            
        return {
            "account_number": account_data.get("account_number"),
            "status": account_data.get("status"),
            "currency": account_data.get("currency"),
            "cash": float(account_data.get("cash", 0)),
            "portfolio_value": float(account_data.get("portfolio_value", 0)),
            "buying_power": float(account_data.get("buying_power", 0)),
            "daytrade_count": account_data.get("daytrade_count"),
            "equity": float(account_data.get("equity", 0)),
            "last_equity": float(account_data.get("last_equity", 0)),
            "long_market_value": float(account_data.get("long_market_value", 0)),
            "short_market_value": float(account_data.get("short_market_value", 0)),
            "initial_margin": float(account_data.get("initial_margin", 0)),
            "maintenance_margin": float(account_data.get("maintenance_margin", 0)),
            "data_source": self.data_source,
            "timestamp": datetime.now().isoformat()
        }
    
    def format_position(self, position_data: Dict) -> Dict:
        """格式化持仓信息"""
        if "error" in position_data:
            return position_data
            
        return {
            "symbol": position_data.get("symbol"),
            "qty": float(position_data.get("qty", 0)),
            "avg_entry_price": float(position_data.get("avg_entry_price", 0)),
            "market_value": float(position_data.get("market_value", 0)),
            "cost_basis": float(position_data.get("cost_basis", 0)),
            "unrealized_pl": float(position_data.get("unrealized_pl", 0)),
            "unrealized_plpc": float(position_data.get("unrealized_plpc", 0)),
            "current_price": float(position_data.get("current_price", 0)),
            "lastday_price": float(position_data.get("lastday_price", 0)),
            "change_today": float(position_data.get("change_today", 0)),
            "data_source": self.data_source
        }
    
    def format_order(self, order_data: Dict) -> Dict:
        """格式化订单信息"""
        if "error" in order_data:
            return order_data
            
        return {
            "order_id": order_data.get("id"),
            "client_order_id": order_data.get("client_order_id"),
            "symbol": order_data.get("symbol"),
            "qty": float(order_data.get("qty", 0)),
            "filled_qty": float(order_data.get("filled_qty", 0)),
            "side": order_data.get("side"),
            "type": order_data.get("type"),
            "time_in_force": order_data.get("time_in_force"),
            "status": order_data.get("status"),
            "limit_price": float(order_data.get("limit_price", 0)) if order_data.get("limit_price") else None,
            "stop_price": float(order_data.get("stop_price", 0)) if order_data.get("stop_price") else None,
            "filled_avg_price": float(order_data.get("filled_avg_price", 0)) if order_data.get("filled_avg_price") else None,
            "created_at": order_data.get("created_at"),
            "updated_at": order_data.get("updated_at"),
            "data_source": self.data_source
        }

# 测试函数
if __name__ == "__main__":
    print("=== 测试 AlpacaService ===")
    
    service = AlpacaService()
    
    # 测试账户信息
    print("\n1. 测试账户信息:")
    account = service.get_account()
    if "error" in account:
        print(f"   错误: {account['error']}")
    else:
        print(f"   账户状态: {account.get('status')}")
        print(f"   现金: ${account.get('cash')}")
        print(f"   投资组合价值: ${account.get('portfolio_value')}")
    
    # 测试持仓
    print("\n2. 测试持仓:")
    positions = service.get_positions()
    if isinstance(positions, list):
        print(f"   持仓数量: {len(positions)}")
        for pos in positions[:3]:  # 显示前3个
            print(f"   - {pos.get('symbol')}: {pos.get('qty')}股")
    else:
        print(f"   错误: {positions.get('error', '未知错误')}")
    
    # 测试订单
    print("\n3. 测试订单:")
    orders = service.get_orders(status="open", limit=5)
    if isinstance(orders, list):
        print(f"   订单数量: {len(orders)}")
        for order in orders[:3]:
            print(f"   - {order.get('symbol')}: {order.get('side')} {order.get('qty')}股")
    else:
        print(f"   错误: {orders.get('error', '未知错误')}")
    
    print("\n=== 测试完成 ===")