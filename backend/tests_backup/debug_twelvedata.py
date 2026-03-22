import requests
import json
import time
from datetime import datetime, timedelta

# 模拟后端get_twelvedata_history函数的部分逻辑
TWELVEDATA_API_KEY = '3541c054d16843cb8e4b2ccefa456a01'

def test_backend_logic(symbol='AAPL', interval='D', range_param='1month'):
    """模拟后端处理逻辑"""
    print(f"\n{'='*80}")
    print(f"模拟后端处理: symbol={symbol}, interval={interval}, range={range_param}")
    print(f"API密钥: {TWELVEDATA_API_KEY[:8]}... (长度: {len(TWELVEDATA_API_KEY)})")
    
    # 映射interval
    interval_map = {
        'D': '1day',
        '60': '1h',
        '30': '30min',
        '15': '15min',
        '5': '5min',
        '1': '1min'
    }
    
    twelvedata_interval = interval_map.get(interval, '1day')
    outputsize = 30  # 1个月大约30天
    
    print(f"映射后的interval: {twelvedata_interval}")
    print(f"outputsize: {outputsize}")
    
    # 构建请求参数
    url = "https://api.twelvedata.com/time_series"
    params = {
        'symbol': symbol,
        'interval': twelvedata_interval,
        'outputsize': outputsize,
        'apikey': TWELVEDATA_API_KEY
    }
    
    print(f"\n发送请求到Twelve Data...")
    print(f"URL: {url}")
    print(f"参数: {params}")
    
    try:
        response = requests.get(url, params=params, timeout=15)
        print(f"状态码: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"\nTwelve Data响应:")
            print(f"状态: {data.get('status', 'unknown')}")
            print(f"消息: {data.get('message', 'N/A')}")
            print(f"代码: {data.get('code', 'N/A')}")
            
            # 检查数据字段
            values = None
            if 'values' in data:
                values = data['values']
                print("使用小写'values'字段")
            elif 'Values' in data:
                values = data['Values']
                print("使用大写'Values'字段")
            elif 'data' in data:
                values = data['data']
                print("使用'data'字段")
            elif 'Data' in data:
                values = data['Data']
                print("使用'Data'字段")
            
            if values is not None:
                print(f"原始数据点数: {len(values)}")
                
                # 检查数据格式
                if len(values) > 0:
                    first_item = values[0]
                    print(f"\n第一个数据点结构: {first_item}")
                    print(f"字段名: {list(first_item.keys())}")
                    
                    # 检查是否有必要字段
                    required_fields = ['datetime', 'open', 'high', 'low', 'close', 'volume']
                    missing_fields = [field for field in required_fields if field not in first_item]
                    if missing_fields:
                        print(f"警告: 缺少必要字段: {missing_fields}")
                    else:
                        print("所有必要字段都存在")
                        
                    # 显示前3个数据点
                    print(f"\n前3个数据点:")
                    for i, item in enumerate(values[:3]):
                        print(f"  {i+1}. {item.get('datetime')}: O={item.get('open')}, H={item.get('high')}, L={item.get('low')}, C={item.get('close')}, V={item.get('volume')}")
                else:
                    print("警告: 数据点数组为空")
            else:
                print(f"错误: 没有找到数据字段")
                print(f"完整响应keys: {list(data.keys())}")
                print(f"完整响应: {json.dumps(data, indent=2)[:500]}...")
                
        else:
            print(f"错误: HTTP错误: {response.status_code}")
            print(f"响应: {response.text[:500]}")
            
    except Exception as e:
        print(f"错误: 请求异常: {e}")
        import traceback
        traceback.print_exc()

# 测试不同的参数
test_backend_logic('AAPL', 'D', '1month')
test_backend_logic('AAPL', '60', '1week')
test_backend_logic('AAPL', '30', '1day')