import requests
import json
import time

print("测试时间粒度修改...")

# 测试不同时间范围的数据粒度
test_cases = [
    {"timeframe": "1D", "interval": "30", "range": "1day", "desc": "1 Day (30分钟粒度)"},
    {"timeframe": "1W", "interval": "60", "range": "1week", "desc": "1 Week (60分钟粒度)"},
    {"timeframe": "1M", "interval": "D", "range": "1month", "desc": "1 Month (日线粒度)"},
    {"timeframe": "1Y", "interval": "D", "range": "1year", "desc": "1 Year (日线粒度)"},
]

for test in test_cases:
    print(f"\n{'='*60}")
    print(f"测试: {test['desc']}")
    print(f"期望粒度: interval={test['interval']}, range={test['range']}")
    
    try:
        r = requests.get('http://127.0.0.1:8890/api/market/history/AAPL', 
                        params={'interval': test['interval'], 'range': test['range']}, 
                        timeout=15)
        
        print(f"状态码: {r.status_code}")
        
        if r.status_code == 200:
            data = r.json()
            print(f"数据源: {data.get('dataSource')}")
            print(f"数据条数: {data.get('count')}")
            print(f"实际请求参数: interval={data.get('interval')}, range={data.get('range')}")
            
            points = data.get('data', [])
            if points:
                # 检查时间间隔
                if len(points) >= 2:
                    time_diff = points[1]['timestamp'] - points[0]['timestamp']
                    
                    if test['interval'] == '30':
                        # 30分钟粒度：时间差应该在1800秒左右（30分钟）
                        expected_diff = 1800
                        diff_type = "30分钟"
                    elif test['interval'] == '60':
                        # 60分钟粒度：时间差应该在3600秒左右（60分钟）
                        expected_diff = 3600
                        diff_type = "60分钟"
                    else:  # 'D'
                        # 日线粒度：时间差应该在86400秒左右（1天）
                        expected_diff = 86400
                        diff_type = "日线"
                    
                    print(f"时间间隔: {time_diff}秒 (期望: {expected_diff}秒, {diff_type})")
                    
                    if abs(time_diff - expected_diff) < 600:  # 允许10分钟误差
                        print(f"✓ 时间粒度正确 ({diff_type})")
                    else:
                        print(f"⚠️ 时间粒度可能不正确")
                
                # 显示前几个数据点的时间
                print(f"前5个数据点时间:")
                for i, p in enumerate(points[:5]):
                    time_str = time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(p['timestamp']))
                    print(f"  {i+1}. {time_str}: C=${p['close']:.2f}")
                
                # 检查数据点数量是否合理
                if test['timeframe'] == '1D' and test['interval'] == '30':
                    # 1天，30分钟粒度：应该有约14个点（6.5小时交易时间）
                    expected_points = 14
                elif test['timeframe'] == '1W' and test['interval'] == '60':
                    # 1周，60分钟粒度：应该有约40个点（5天×6.5小时）
                    expected_points = 40
                elif test['timeframe'] == '1M' and test['interval'] == 'D':
                    # 1月，日线粒度：应该有约20-22个点
                    expected_points = 22
                elif test['timeframe'] == '1Y' and test['interval'] == 'D':
                    # 1年，日线粒度：应该有约252个点
                    expected_points = 252
                else:
                    expected_points = 0
                
                if expected_points > 0:
                    actual_points = len(points)
                    print(f"数据点数量: {actual_points} (期望: {expected_points})")
                    if abs(actual_points - expected_points) <= expected_points * 0.3:  # 允许30%误差
                        print(f"✓ 数据点数量合理")
                    else:
                        print(f"⚠️ 数据点数量可能异常")
            else:
                print("无数据返回")
        else:
            print(f"错误: {r.status_code}")
            print(f"响应: {r.text[:200]}")
    except Exception as e:
        print(f"请求失败: {e}")

print(f"\n{'='*60}")
print("总结:")
print("1. 1 Day: 应该使用30分钟粒度，显示具体时间 (HH:MM)")
print("2. 1 Week: 应该使用60分钟粒度，显示日期+时间 (MM/DD HH:MM)")
print("3. 1 Month/1 Year: 保持日线粒度，显示日期 (MM/DD)")
print("4. 前端X轴格式化应该根据不同的timeframe显示不同的格式")