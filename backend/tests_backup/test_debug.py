import sys
sys.path.append('.')
from start_quant_backend import app

# 创建测试客户端
with app.test_client() as client:
    print('=== 测试Flask应用路由 ===')
    
    # 测试路由
    response = client.get('/api/market/history/AAPL?interval=D&range=3month')
    print(f'Status Code: {response.status_code}')
    print(f'Response: {response.get_json()}')