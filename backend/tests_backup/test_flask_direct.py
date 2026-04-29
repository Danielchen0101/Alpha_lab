import sys
sys.path.append('.')
from start_quant_backend import app

# 创建测试客户端
with app.test_client() as client:
    # 测试3 Months历史数据接口
    print('=== 直接测试Flask应用 ===')
    response = client.get('/api/market/history/AAPL?interval=D&range=3month')
    print('Status Code:', response.status_code)
    
    data = response.get_json()
    print('\n=== 接口返回结果 ===')
    print('success:', data.get('success'))
    print('count:', data.get('count'))
    print('dataSource:', data.get('dataSource'))
    print('note:', data.get('note'))
    
    if data.get('data') and len(data['data']) > 0:
        print('\n=== 数据样本 ===')
        print('数据条数:', len(data['data']))
        print('第一条数据:', data['data'][0])
    else:
        print('\n数据为空或不存在')