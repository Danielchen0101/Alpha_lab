import requests
import json

print("测试Twelve Data图表数据源后端...")
print("="*80)

# 测试1: 图表历史数据 (Twelve Data)
print("1. 测试图表历史数据 (Twelve Data负责):")

test_cases = [
    {'interval': '60', 'range': '1week', 'desc': '1周小时图表数据'},
    {'interval': '30', 'range': '1day', 'desc': '1天30分钟图表数据'},
    {'interval': 'D', 'range': '1month', 'desc': '1月日线图表数据'},
    {'interval': 'D', 'range': '3month', 'desc': '3月日线图表数据'},
    {'interval': 'D', 'range': '1year', 'desc': '1年日线图表数据'},
]

for test in test_cases:
    print(f"\n  {test['desc']}:")
    
    url = 'http://127.0.0.1:8890/api/market/history/AAPL'
    params = {
        'interval': test['interval'],
        'range': test['range']
    }
    
    try:
        response = requests.get(url, params=params, timeout=10)
        print(f"    状态码: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"    数据源: {data.get('dataSource')}")
            print(f"    备注: {data.get('note')}")
            print(f"    数据条数: {data.get('count')}")
            
            points = data.get('data', [])
            if points:
                print(f"    第一条数据 (最早):")
                first = points[0]
                print(f"      时间戳: {first.get('timestamp')}")
                print(f"      时间: {first.get('time')}")
                print(f"      价格: O=${first.get('open', 0):.2f}, C=${first.get('close', 0):.2f}")
                
                print(f"    最后一条数据 (最新):")
                last = points[-1]
                print(f"      时间戳: {last.get('timestamp')}")
                print(f"      时间: {last.get('time')}")
                print(f"      价格: O=${last.get('open', 0):.2f}, C=${last.get('close', 0):.2f}")
                
                # 检查数据源标识
                data_source = data.get('dataSource', '')
                if 'Twelve Data' in data_source:
                    print(f"    ✓ 数据源正确标识为Twelve Data")
                else:
                    print(f"    ⚠️ 数据源标识不正确: {data_source}")
            else:
                print(f"    ⚠️ 无数据")
        else:
            print(f"    错误: {response.text[:200]}")
            
    except Exception as e:
        print(f"    请求失败: {e}")

print()
print("="*80)
print("2. 测试股票详情数据 (Finnhub负责):")

url = 'http://127.0.0.1:8890/api/market/stock/AAPL'
try:
    response = requests.get(url, timeout=5)
    print(f"  状态码: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print(f"  数据源: {data.get('dataSource')}")
        print(f"  股票: {data.get('symbol')}")
        print(f"  名称: {data.get('name')}")
        print(f"  当前价格: ${data.get('price', 0):.2f}")
        print(f"  涨跌: ${data.get('change', 0):.2f} ({data.get('changePercent', 0):.2f}%)")
        print(f"  今日开盘: ${data.get('open', 0):.2f}")
        print(f"  今日最高: ${data.get('dayHigh', 0):.2f}")
        print(f"  今日最低: ${data.get('dayLow', 0):.2f}")
        print(f"  市值: ${data.get('marketCap', 0):,.0f}")
        
        # 检查数据源标识
        data_source = data.get('dataSource', '')
        if 'Finnhub' in data_source:
            print(f"  ✓ 数据源正确标识为Finnhub")
        else:
            print(f"  ⚠️ 数据源标识不正确: {data_source}")
    else:
        print(f"  错误: {response.text[:200]}")
        
except Exception as e:
    print(f"  请求失败: {e}")

print()
print("="*80)
print("3. 测试市场股票列表 (Finnhub负责):")

url = 'http://127.0.0.1:8890/api/market/stocks'
try:
    response = requests.get(url, timeout=5)
    print(f"  状态码: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print(f"  数据源: {data.get('dataSource')}")
        print(f"  股票数量: {data.get('count')}")
        
        stocks = data.get('stocks', [])
        if stocks:
            print(f"  前3支股票:")
            for i, stock in enumerate(stocks[:3]):
                print(f"    {i+1}. {stock.get('symbol')}: ${stock.get('price', 0):.2f} ({stock.get('changePercent', 0):.2f}%)")
        
        # 检查数据源标识
        data_source = data.get('dataSource', '')
        if 'Finnhub' in data_source:
            print(f"  ✓ 数据源正确标识为Finnhub")
        else:
            print(f"  ⚠️ 数据源标识不正确: {data_source}")
    else:
        print(f"  错误: {response.text[:200]}")
        
except Exception as e:
    print(f"  请求失败: {e}")

print()
print("="*80)
print("4. 测试系统状态:")

url = 'http://127.0.0.1:8890/api/status'
try:
    response = requests.get(url, timeout=5)
    print(f"  状态码: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print(f"  状态: {data.get('status')}")
        print(f"  数据源配置:")
        data_sources = data.get('dataSources', {})
        print(f"    图表数据: {data_sources.get('chartData')}")
        print(f"    股票数据: {data_sources.get('stockData')}")
        
        if data_sources.get('chartData') == 'Twelve Data' and data_sources.get('stockData') == 'Finnhub':
            print(f"  ✓ 数据源配置正确")
        else:
            print(f"  ⚠️ 数据源配置不正确")
    else:
        print(f"  错误: {response.text[:200]}")
        
except Exception as e:
    print(f"  请求失败: {e}")

print()
print("="*80)
print("总结:")
print("1. 图表数据源: Twelve Data (负责所有图表/历史数据)")
print("2. 普通展示数据源: Finnhub (负责股票详情/列表)")
print("3. 数据源标识: 前后端统一显示正确的数据源名称")
print("4. 字段转换: Twelve Data返回的数据已转换为统一格式")