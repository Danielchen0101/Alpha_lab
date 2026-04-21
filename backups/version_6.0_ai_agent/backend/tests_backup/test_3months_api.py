import sys
sys.path.append('.')
from start_quant_backend import app
import json

# 创建测试客户端
with app.test_client() as client:
    # 测试3 Months历史数据接口
    print('=== 测试 /api/market/history/AAPL?interval=D&range=3month ===')
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
        
        # 显示前3条数据
        print('前3条数据:')
        for i, item in enumerate(data['data'][:3]):
            print(f'  {i+1}. time: {item.get("time")}, timestamp: {item.get("timestamp")}, close: {item.get("close")}')
        
        # 显示最后3条数据
        print('最后3条数据:')
        for i, item in enumerate(data['data'][-3:]):
            idx = len(data['data']) - 3 + i
            print(f'  {idx+1}. time: {item.get("time")}, timestamp: {item.get("timestamp")}, close: {item.get("close")}')
        
        # 计算日期范围
        dates = [item.get('time', '') for item in data['data'] if item.get('time')]
        if dates:
            dates.sort()
            print('\n=== 日期范围 ===')
            print('最早日期:', dates[0])
            print('最晚日期:', dates[-1])
            print('总天数:', len(dates))
    else:
        print('\n数据为空或不存在')