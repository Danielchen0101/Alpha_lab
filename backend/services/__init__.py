"""
服务管理器 - 统一管理所有外部 API 服务
"""

import logging
from .polygon_service import PolygonService, polygon_service
from .alpaca_service import AlpacaService, alpaca_service

logger = logging.getLogger(__name__)

class ServiceManager:
    """服务管理器 - 统一管理所有外部 API 服务"""
    
    def __init__(self):
        self.polygon = None
        self.alpaca = None
        self._initialized = False
    
    def initialize(self):
        """初始化所有服务"""
        try:
            # 初始化 Polygon 服务
            self.polygon = PolygonService()
            logger.info("PolygonService 初始化成功")
            
            # 初始化 Alpaca 服务
            self.alpaca = AlpacaService(paper_trading=True)
            logger.info("AlpacaService 初始化成功")
            
            self._initialized = True
            logger.info("ServiceManager 初始化完成")
            
        except Exception as e:
            logger.error(f"服务初始化失败: {e}")
            raise
    
    def get_polygon(self) -> PolygonService:
        """获取 Polygon 服务"""
        if not self._initialized:
            self.initialize()
        return self.polygon
    
    def get_alpaca(self) -> AlpacaService:
        """获取 Alpaca 服务"""
        if not self._initialized:
            self.initialize()
        return self.alpaca
    
    def health_check(self) -> Dict:
        """健康检查"""
        health_status = {
            "polygon": {"status": "unknown", "error": None},
            "alpaca": {"status": "unknown", "error": None},
            "overall": "unknown"
        }
        
        try:
            # 检查 Polygon 服务
            if self.polygon:
                test_result = self.polygon.get_previous_close("AAPL")
                if "error" in test_result:
                    health_status["polygon"] = {"status": "unhealthy", "error": test_result.get("error")}
                else:
                    health_status["polygon"] = {"status": "healthy", "error": None}
            
            # 检查 Alpaca 服务
            if self.alpaca:
                test_result = self.alpaca.get_account()
                if "error" in test_result:
                    health_status["alpaca"] = {"status": "unhealthy", "error": test_result.get("error")}
                else:
                    health_status["alpaca"] = {"status": "healthy", "error": None}
            
            # 计算整体状态
            all_healthy = all(
                service["status"] == "healthy" 
                for service in [health_status["polygon"], health_status["alpaca"]]
            )
            
            health_status["overall"] = "healthy" if all_healthy else "unhealthy"
            
        except Exception as e:
            logger.error(f"健康检查失败: {e}")
            health_status["overall"] = "error"
        
        return health_status


# 创建全局服务管理器实例
service_manager = ServiceManager()

# 导出服务实例
__all__ = [
    'PolygonService',
    'AlpacaService',
    'polygon_service',
    'alpaca_service',
    'service_manager'
]