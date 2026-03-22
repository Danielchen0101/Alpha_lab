"""
监控API调用次数脚本
用于统计SymbolAnalysis页面刷新时的API调用次数
"""

import json
import time
from datetime import datetime

# 全局计数器
api_call_count = {
    'frontend_to_backend': 0,
    'backend_to_external': {
        'finnhub': 0,
        'twelvedata': 0,
        'other': 0
    },
    'by_type': {
        'quote': 0,
        'history': 0,
        'profile': 0,
        'technical': 0,
        'other': 0
    }
}

# 模拟后端API调用监控
def monitor_backend_api(endpoint, params=None):
    """监控后端API调用"""
    api_call_count['frontend_to_backend'] += 1
    
    # 根据endpoint类型分类
    if 'quote' in endpoint:
        api_call_count['by_type']['quote'] += 1
    elif 'history' in endpoint:
        api_call_count['by_type']['history'] += 1
    elif 'profile' in endpoint or 'company' in endpoint:
        api_call_count['by_type']['profile'] += 1
    elif 'technical' in endpoint or 'indicator' in endpoint:
        api_call_count['by_type']['technical'] += 1
    else:
        api_call_count['by_type']['other'] += 1
    
    print(f"[后端监控] 前端调用后端API: {endpoint}")
    if params:
        print(f"[后端监控] 参数: {params}")
    
    # 模拟外部API调用
    if 'history' in endpoint:
        # 历史数据调用Twelve Data
        api_call_count['backend_to_external']['twelvedata'] += 1
        print(f"[后端监控] → 调用外部API: Twelve Data (credit消耗: 1)")
    elif 'stock' in endpoint and 'quote' not in endpoint:
        # 股票数据调用Finnhub
        api_call_count['backend_to_external']['finnhub'] += 1
        print(f"[后端监控] → 调用外部API: Finnhub (credit消耗: 1)")
    else:
        api_call_count['backend_to_external']['other'] += 1

def simulate_symbol_analysis_refresh():
    """模拟SymbolAnalysis页面刷新"""
    print("=" * 80)
    print("模拟SymbolAnalysis页面刷新 - API调用分析")
    print("=" * 80)
    
    # 重置计数器
    global api_call_count
    api_call_count = {
        'frontend_to_backend': 0,
        'backend_to_external': {
            'finnhub': 0,
            'twelvedata': 0,
            'other': 0
        },
        'by_type': {
            'quote': 0,
            'history': 0,
            'profile': 0,
            'technical': 0,
            'other': 0
        }
    }
    
    # 模拟页面加载时的API调用
    print("\n[模拟] 页面加载...")
    
    # 1. 加载股票数据 (getStockData)
    monitor_backend_api('/api/market/stock/AAPL')
    
    # 2. 加载历史价格数据 (getStockHistory)
    monitor_backend_api('/api/market/history/AAPL', {'interval': 'D', 'range': '1month'})
    
    # 3. 加载公司信息 (如果有)
    monitor_backend_api('/api/stock/profile/AAPL')
    
    # 4. 加载实时报价 (如果有单独调用)
    monitor_backend_api('/api/stock/quote/AAPL')
    
    # 5. 加载技术指标 (RSI等)
    monitor_backend_api('/api/technical/indicators/AAPL', {'indicator': 'RSI'})
    
    # 6. 可能还有其他组件调用
    monitor_backend_api('/api/market/sentiment/AAPL')
    
    print("\n" + "=" * 80)
    print("API调用统计结果:")
    print("=" * 80)
    
    print(f"\n1. 前端到后端调用次数: {api_call_count['frontend_to_backend']}")
    print(f"2. 后端到外部API调用次数: {api_call_count['backend_to_external']}")
    
    print(f"\n3. 按类型分类:")
    for api_type, count in api_call_count['by_type'].items():
        print(f"   - {api_type}: {count}次")
    
    total_external = sum(api_call_count['backend_to_external'].values())
    print(f"\n4. 总外部API调用次数: {total_external}")
    print(f"5. 预计Twelve Data credit消耗: {api_call_count['backend_to_external']['twelvedata']}")
    print(f"6. 预计Finnhub credit消耗: {api_call_count['backend_to_external']['finnhub']}")
    
    return api_call_count

def analyze_real_backend_logs():
    """分析真实后端日志"""
    print("\n" + "=" * 80)
    print("分析真实后端日志中的API调用模式")
    print("=" * 80)
    
    # 从start_quant_backend.py中分析API路由
    import re
    
    with open('start_quant_backend.py', 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 查找所有路由定义
    routes = re.findall(r'@app\.route\([\'"]([^\'"]+)[\'"]', content)
    
    print(f"\n发现的路由数量: {len(routes)}")
    print("\n相关路由:")
    for route in routes:
        if 'api' in route or 'stock' in route or 'market' in route:
            print(f"  - {route}")
    
    # 分析外部API调用
    print("\n外部API调用分析:")
    twelvedata_calls = content.count('TWELVEDATA_API_KEY')
    finnhub_calls = content.count('FINNHUB_API_KEY')
    
    print(f"  - Twelve Data API调用点: {twelvedata_calls}")
    print(f"  - Finnhub API调用点: {finnhub_calls}")

if __name__ == '__main__':
    # 模拟分析
    simulate_symbol_analysis_refresh()
    
    # 分析真实后端
    analyze_real_backend_logs()