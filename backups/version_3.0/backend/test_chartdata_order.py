import json
import sys
sys.path.append('.')
from start_quant_backend import run_simple_backtest

# 模拟historical_data（升序排列）
historical_data = []
# 生成30天的数据
for i in range(30):
    timestamp = 1704153600 + i * 86400  # 从2024-01-02开始
    date_str = f'2024-01-{i+2:02d}' if i+2 <= 31 else f'2024-02-{(i+2)-31:02d}'
    close_price = 185.0 + i * 0.5  # 价格逐渐上涨
    volume = 50000000 + i * 1000000
    historical_data.append({
        'datetime': date_str,
        'timestamp': timestamp,
        'close': close_price,
        'volume': volume
    })

print('原始historical_data顺序（升序）：')
for i, item in enumerate(historical_data):
    print(f'  [{i}] {item["datetime"]}')

# 运行回测
results = run_simple_backtest(historical_data, 'moving_average', 100000, {'shortMaPeriod': 20, 'longMaPeriod': 50})

print('\nchartData顺序：')
chart_data = results.get('chartData', [])
for i, item in enumerate(chart_data[:5]):
    print(f'  [{i}] {item["date"]}')

print('\n最后5个chartData：')
for i, item in enumerate(chart_data[-5:]):
    print(f'  [{len(chart_data) - 5 + i}] {item["date"]}')