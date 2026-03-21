"""
替换get_twelvedata_history函数为修复版本
"""

import requests
from datetime import datetime
import time

def fixed_get_twelvedata_history(symbol, interval, range_param):
    """修复的Twelve Data获取函数"""
    try:
        # Twelve Data参数映射
        interval_map = {
            '30': '30min',
            '60': '1h',
            'D': '1day'
        }
        
        # 直接使用传入的interval参数（如果已经在映射中）
        if interval in interval_map:
            twelvedata_interval = interval_map[interval]
        else:
            # 否则使用默认映射
            if interval == '30min':
                twelvedata_interval = '30min'
            elif interval == '1h':
                twelvedata_interval = '1h'
            elif interval == '1day':
                twelvedata_interval = '1day'
            else:
                twelvedata_interval = '1h'  # 默认
        
        outputsize_map = {
            '1day': 48,
            '1week': 300,  # 增加数量
            '1month': 30,
            '3month': 90,
            '1year': 365
        }
        
        # 对于1 Year和3 Months，使用日线数据和时间范围限制
        if range_param == '1year':
            twelvedata_interval = '1day'
            outputsize = 400  # 请求稍多一点数据，确保覆盖一年
            
            # 计算时间范围：从去年的今天减一天开始，到明天结束
            from datetime import datetime, timedelta
            end_date = datetime.now() + timedelta(days=1)  # 到明天，确保覆盖今天
            start_date = datetime.now() - timedelta(days=366)  # 去年的今天减一天
            
            # 格式化日期为YYYY-MM-DD
            start_str = start_date.strftime('%Y-%m-%d')
            end_str = end_date.strftime('%Y-%m-%d')
            
            print(f"[Twelve Data Fixed] 1 Year时间范围: {start_str} 到 {end_str} (缓冲范围)")
        elif range_param == '1month':
            twelvedata_interval = '1day'
            outputsize = 40  # 请求稍多一点数据
            start_str = None
            end_str = None
        elif range_param == '3month':
            twelvedata_interval = '1day'
            outputsize = 100  # 请求稍多一点数据
            start_str = None
            end_str = None
        elif range_param == '1week':
            # 使用30分钟数据
            twelvedata_interval = '30min'
            outputsize = 300  # 请求大量数据
            start_str = None
            end_str = None
            
            print(f"[Twelve Data Fixed] 1 Week：使用30分钟数据，请求{outputsize}个点")
        else:
            twelvedata_interval = interval_map.get(interval, '1h')
            outputsize = outputsize_map.get(range_param, 100)
            start_str = None
            end_str = None
        
        # 请求Twelve Data
        url = "https://api.twelvedata.com/time_series"
        params = {
            'symbol': symbol.upper(),
            'interval': twelvedata_interval,
            'outputsize': outputsize,
            'apikey': '8b847a1ef2aa47a68d3f992bd0275f0c',
            'format': 'JSON'
        }
        
        # 添加时间范围参数（如果指定了）
        if start_str and end_str:
            params['start_date'] = start_str
            params['end_date'] = end_str
        
        print(f"[Twelve Data Fixed] 请求URL: {url}")
        print(f"[Twelve Data Fixed] 请求参数: {params}")
        
        response = requests.get(url, params=params, timeout=15)
        print(f"[Twelve Data Fixed] 响应状态码: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            
            if 'values' in data:
                values = data['values']
                print(f"[Twelve Data Fixed] 原始数据点数: {len(values)}")
                
                # 分析原始数据分钟分布
                minute_counts = {}
                for item in values[:50]:  # 只分析前50个
                    datetime_str = item.get('datetime', '')
                    if ':' in datetime_str:
                        time_part = datetime_str.split(' ')[1] if ' ' in datetime_str else datetime_str
                        minute = time_part.split(':')[1]
                        minute_counts[minute] = minute_counts.get(minute, 0) + 1
                
                print(f"[Twelve Data Fixed] 原始数据分钟分布: {minute_counts}")
                
                # 简化处理：确保处理所有数据点
                formatted_data = []
                success_count = 0
                error_count = 0
                
                for i, item in enumerate(values):
                    try:
                        datetime_str = item.get('datetime', '')
                        
                        # 简化时间戳解析
                        timestamp = int(time.time())
                        if datetime_str and ' ' in datetime_str:
                            try:
                                dt = datetime.strptime(datetime_str, '%Y-%m-%d %H:%M:%S')
                                timestamp = int(dt.timestamp())
                            except:
                                pass
                        
                        # 简化数值转换
                        def safe_convert(value, default=0, type_func=float):
                            try:
                                if value is None or value == '':
                                    return default
                                return type_func(value)
                            except:
                                return default
                        
                        formatted_data.append({
                            "timestamp": timestamp,
                            "time": datetime_str,
                            "open": safe_convert(item.get('open'), 0, float),
                            "high": safe_convert(item.get('high'), 0, float),
                            "low": safe_convert(item.get('low'), 0, float),
                            "close": safe_convert(item.get('close'), 0, float),
                            "volume": safe_convert(item.get('volume'), 0, int)
                        })
                        success_count += 1
                    except Exception as e:
                        error_count += 1
                        if error_count <= 3:
                            print(f"[Twelve Data Fixed] 处理第 {i+1} 个数据点失败: {e}")
                        continue
                
                print(f"[Twelve Data Fixed] 处理结果: 成功 {success_count}, 失败 {error_count}")
                
                # 反转数据顺序（最新的在最后）
                formatted_data = list(reversed(formatted_data))
                
                # 处理后的数据调试
                print(f"[Twelve Data Fixed] 处理后数据点数: {len(formatted_data)}")
                
                if formatted_data:
                    # 分析处理后的分钟分布
                    processed_minute_counts = {}
                    for item in formatted_data[:100]:  # 只分析前100个
                        time_str = item.get('time', '')
                        if ':' in time_str:
                            time_part = time_str.split(' ')[1] if ' ' in time_str else time_str
                            minute = time_part.split(':')[1]
                            processed_minute_counts[minute] = processed_minute_counts.get(minute, 0) + 1
                    
                    print(f"[Twelve Data Fixed] 处理后分钟分布: {processed_minute_counts}")
                    
                    # 打印前10个点
                    print(f"[Twelve Data Fixed] 处理后前10个点:")
                    for i, item in enumerate(formatted_data[:10]):
                        print(f"  {i+1}. {item.get('time')}")
                
                return formatted_data, True, f"Twelve Data {range_param}图表数据 (修复版)"
            else:
                return [], False, "Twelve Data (数据结构错误)"
        else:
            return [], False, f"Twelve Data (HTTP {response.status_code})"
            
    except Exception as e:
        return [], False, f"Twelve Data (异常: {str(e)[:100]})"

# 测试修复版本
if __name__ == "__main__":
    print("=== 测试修复版本 ===")
    data, success, note = fixed_get_twelvedata_history('AAPL', '30min', '1week')
    print(f"\n结果: 成功={success}, 说明={note}")
    print(f"返回数据点数: {len(data)}")
    
    if data:
        # 分析分钟分布
        minute_counts = {}
        for item in data[:50]:
            time_str = item.get('time', '')
            if ':' in time_str:
                time_part = time_str.split(' ')[1] if ' ' in time_str else time_str
                minute = time_part.split(':')[1]
                minute_counts[minute] = minute_counts.get(minute, 0) + 1
        
        print(f"分钟分布: {minute_counts}")
        print(f"有:00数据: {'00' in minute_counts}")
        print(f"有:30数据: {'30' in minute_counts}")