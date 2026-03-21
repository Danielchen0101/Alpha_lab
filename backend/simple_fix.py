"""
简单修复：确保处理所有数据点
"""

import requests
from datetime import datetime
import time

def simple_get_twelvedata_history(symbol, interval, range_param):
    """简化的Twelve Data获取函数，确保处理所有数据点"""
    try:
        # 总是使用30min
        twelvedata_interval = '30min'
        outputsize = 300
        
        print(f"[Simple Fix] 请求Twelve Data 30min数据，outputsize={outputsize}")
        
        url = "https://api.twelvedata.com/time_series"
        params = {
            'symbol': symbol.upper(),
            'interval': twelvedata_interval,
            'outputsize': outputsize,
            'apikey': '8b847a1ef2aa47a68d3f992bd0275f0c',
            'format': 'JSON'
        }
        
        print(f"[Simple Fix] 请求参数: {params}")
        
        response = requests.get(url, params=params, timeout=15)
        print(f"[Simple Fix] 响应状态码: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            
            if 'values' in data:
                values = data['values']
                print(f"[Simple Fix] Twelve Data返回数据点数: {len(values)}")
                
                # 简单处理：转换所有数据点
                formatted_data = []
                success_count = 0
                error_count = 0
                
                for i, item in enumerate(values):
                    try:
                        datetime_str = item.get('datetime', '')
                        
                        # 简单解析时间戳
                        timestamp = int(time.time())
                        if datetime_str and ' ' in datetime_str:
                            try:
                                dt = datetime.strptime(datetime_str, '%Y-%m-%d %H:%M:%S')
                                timestamp = int(dt.timestamp())
                            except:
                                pass
                        
                        formatted_data.append({
                            "timestamp": timestamp,
                            "time": datetime_str,
                            "open": float(item.get('open', 0) or 0),
                            "high": float(item.get('high', 0) or 0),
                            "low": float(item.get('low', 0) or 0),
                            "close": float(item.get('close', 0) or 0),
                            "volume": int(item.get('volume', '0') or 0)
                        })
                        success_count += 1
                    except Exception as e:
                        error_count += 1
                        if error_count <= 3:
                            print(f"[Simple Fix] 处理第 {i+1} 个点失败: {e}")
                
                print(f"[Simple Fix] 处理结果: 成功 {success_count}, 失败 {error_count}")
                
                # 反转数据（最新的在最后）
                formatted_data = list(reversed(formatted_data))
                
                # 分析结果
                if formatted_data:
                    print(f"[Simple Fix] 处理后数据点数: {len(formatted_data)}")
                    
                    # 分析分钟分布
                    minute_counts = {}
                    for item in formatted_data[:100]:  # 只分析前100个
                        time_str = item.get('time', '')
                        if ':' in time_str:
                            time_part = time_str.split(' ')[1] if ' ' in time_str else time_str
                            minute = time_part.split(':')[1]
                            minute_counts[minute] = minute_counts.get(minute, 0) + 1
                    
                    print(f"[Simple Fix] 处理后分钟分布: {minute_counts}")
                    
                    # 打印前10个点
                    print(f"[Simple Fix] 处理后前10个点:")
                    for i, item in enumerate(formatted_data[:10]):
                        print(f"  {i+1}. {item.get('time')}")
                
                return formatted_data, True, "Simple Fix成功"
            else:
                print(f"[Simple Fix] 响应不包含values字段")
                return [], False, "Twelve Data数据结构错误"
        else:
            print(f"[Simple Fix] 请求失败: {response.status_code}")
            return [], False, f"Twelve Data HTTP {response.status_code}"
            
    except Exception as e:
        print(f"[Simple Fix] 异常: {e}")
        return [], False, f"Twelve Data异常: {str(e)[:100]}"

# 测试
if __name__ == "__main__":
    print("=== 测试简单修复 ===")
    data, success, note = simple_get_twelvedata_history('AAPL', '30min', '1week')
    print(f"\n结果: 成功={success}, 说明={note}")
    print(f"返回数据点数: {len(data)}")