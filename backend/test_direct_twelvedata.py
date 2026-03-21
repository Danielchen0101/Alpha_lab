import requests
import json
from datetime import datetime
import time

print("直接测试Twelve Data数据转换...")
print("="*80)

TWELVEDATA_API_KEY = '8b847a1ef2aa47a68d3f992bd0275f0c'
TWELVEDATA_BASE_URL = 'https://api.twelvedata.com'

# 获取Twelve Data数据
url = f"{TWELVEDATA_BASE_URL}/time_series"
params = {
    'symbol': 'AAPL',
    'interval': '1h',
    'outputsize': 10,  # 只获取10条测试
    'apikey': TWELVEDATA_API_KEY,
    'format': 'JSON'
}

try:
    response = requests.get(url, params=params, timeout=10)
    print(f"状态码: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print(f"原始数据keys: {list(data.keys())}")
        
        if 'values' in data:
            values = data['values']
            print(f"原始数据条数: {len(values)}")
            
            # 测试数据转换
            values_reversed = list(reversed(values))
            print(f"反转后数据条数: {len(values_reversed)}")
            
            formatted_data = []
            for i, item in enumerate(values_reversed):
                print(f"\n第{i+1}条数据:")
                print(f"  原始数据: {item}")
                
                datetime_str = item.get('datetime', '')
                print(f"  时间字符串: {datetime_str}")
                
                timestamp = None
                try:
                    if ' ' in datetime_str:
                        dt = datetime.strptime(datetime_str, '%Y-%m-%d %H:%M:%S')
                    else:
                        dt = datetime.strptime(datetime_str, '%Y-%m-%d')
                    timestamp = int(dt.timestamp())
                    print(f"  解析成功: timestamp={timestamp}")
                except Exception as e:
                    print(f"  解析失败: {e}")
                
                # 测试字段转换
                open_price = float(item.get('open', 0))
                high_price = float(item.get('high', 0))
                low_price = float(item.get('low', 0))
                close_price = float(item.get('close', 0))
                volume_val = item.get('volume', '0')
                
                print(f"  价格字段: open={open_price}, high={high_price}, low={low_price}, close={close_price}")
                print(f"  成交量: {volume_val} (类型: {type(volume_val)})")
                
                try:
                    volume_int = int(float(volume_val))
                    print(f"  成交量转换: {volume_int}")
                except Exception as e:
                    print(f"  成交量转换失败: {e}")
                    volume_int = 0
                
                formatted_data.append({
                    "timestamp": timestamp if timestamp else int(time.time()),
                    "time": datetime.fromtimestamp(timestamp).isoformat() if timestamp else datetime_str,
                    "open": open_price,
                    "high": high_price,
                    "low": low_price,
                    "close": close_price,
                    "volume": volume_int
                })
            
            print(f"\n转换后数据:")
            for i, item in enumerate(formatted_data[:3]):  # 只显示前3条
                print(f"  {i+1}. timestamp={item['timestamp']}, time={item['time']}, close=${item['close']:.2f}")
                
        else:
            print(f"数据结构异常: {data}")
            
    else:
        print(f"HTTP错误: {response.text[:200]}")
        
except Exception as e:
    print(f"请求失败: {e}")
    import traceback
    traceback.print_exc()