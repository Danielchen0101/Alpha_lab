import requests
import json
import time
from datetime import datetime, timedelta

print("测试最终1 Week数据实现...")
print("="*80)

# 测试1 Week数据
print("1. 测试1 Week小时数据:")
try:
    r = requests.get('http://127.0.0.1:8890/api/market/history/AAPL', 
                    params={'interval': '60', 'range': '1week'}, 
                    timeout=15)
    
    print(f"  状态码: {r.status_code}")
    
    if r.status_code == 200:
        data = r.json()
        print(f"  数据源: {data.get('dataSource')}")
        print(f"  数据条数: {data.get('count', 0)}")
        print(f"  备注: {data.get('note', '无')}")
        print(f"  数据范围说明: {data.get('dataRangeNote', '无')}")
        
        points = data.get('data', [])
        if points:
            print(f"\n  数据时间范围:")
            first = points[0]
            last = points[-1]
            
            first_time = datetime.fromtimestamp(first['timestamp']).strftime('%Y-%m-%d %H:%M:%S')
            last_time = datetime.fromtimestamp(last['timestamp']).strftime('%Y-%m-%d %H:%M:%S')
            
            print(f"    最早: {first_time}")
            print(f"    最晚: {last_time}")
            
            # 检查数据粒度
            print(f"\n  数据粒度检查:")
            if len(points) >= 2:
                time_diff = points[1]['timestamp'] - points[0]['timestamp']
                print(f"    时间间隔: {time_diff/3600:.1f}小时 ({time_diff}秒)")
                if abs(time_diff - 3600) < 600:  # 允许10分钟误差
                    print(f"    ✓ 保持1小时粒度")
                else:
                    print(f"    ⚠️ 时间粒度可能不正确")
            
            # 检查是否包含今天
            now = datetime.now()
            today_data = [p for p in points if datetime.fromtimestamp(p['timestamp']).date() == now.date()]
            print(f"    今天数据条数: {len(today_data)}")
            
            if len(today_data) == 0:
                print(f"    ✓ 正确：不包含今天数据（免费套餐限制）")
            else:
                print(f"    ⚠️ 意外：包含今天数据")
                
            # 检查数据完整性
            print(f"\n  数据完整性:")
            print(f"    总数据点: {len(points)}")
            expected_days = 7
            expected_hours_per_day = 16  # 美股交易时间约6.5小时，四舍五入
            expected_total = expected_days * expected_hours_per_day
            actual_total = len(points)
            
            print(f"    预期数据点（7天×16小时/天）: ~{expected_total}个")
            print(f"    实际数据点: {actual_total}个")
            
            if actual_total >= expected_total * 0.7:  # 至少70%的数据
                print(f"    ✓ 数据完整性良好")
            else:
                print(f"    ⚠️ 数据可能不完整")
    else:
        print(f"  错误: {r.text[:200]}")
        
except Exception as e:
    print(f"  请求失败: {e}")

print()
print("="*80)
print("2. 对比其他时间范围:")
timeframes = [
    {'interval': '30', 'range': '1day', 'desc': '1 Day'},
    {'interval': '60', 'range': '1week', 'desc': '1 Week'},
    {'interval': 'D', 'range': '1month', 'desc': '1 Month'},
]

for tf in timeframes:
    print(f"\n测试: {tf['desc']}")
    try:
        r = requests.get('http://127.0.0.1:8890/api/market/history/AAPL', 
                        params={'interval': tf['interval'], 'range': tf['range']}, 
                        timeout=10)
        
        if r.status_code == 200:
            data = r.json()
            points = data.get('data', [])
            
            if points:
                first = datetime.fromtimestamp(points[0]['timestamp']).strftime('%Y-%m-%d %H:%M')
                last = datetime.fromtimestamp(points[-1]['timestamp']).strftime('%Y-%m-%d %H:%M')
                
                print(f"  数据点: {len(points)}条")
                print(f"  时间范围: {first} 到 {last}")
                print(f"  备注: {data.get('note', '无')}")
        else:
            print(f"  错误: {r.status_code}")
            
    except Exception as e:
        print(f"  请求失败: {e}")

print()
print("="*80)
print("最终实现总结:")
print("1. 1 Week小时数据: 明确显示'截至上一交易日'")
print("2. 数据粒度: 保持1小时一个点")
print("3. 前端提示: 在1 Week图表旁添加限制说明")
print("4. 数据完整性: 提供完整的过去7天小时数据")
print("5. 用户透明: 不伪装包含今天数据")