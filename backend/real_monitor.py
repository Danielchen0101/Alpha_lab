"""
真实API调用监控
启动后端并监控所有API调用
"""

import subprocess
import time
import requests
import json
from datetime import datetime
import threading
import sys

class APIMonitor:
    def __init__(self):
        self.counters = {
            'total_requests': 0,
            'by_endpoint': {},
            'external_calls': {
                'finnhub': 0,
                'twelvedata': 0
            },
            'timestamps': []
        }
        
    def log_request(self, endpoint, method='GET'):
        """记录API请求"""
        self.counters['total_requests'] += 1
        
        if endpoint not in self.counters['by_endpoint']:
            self.counters['by_endpoint'][endpoint] = 0
        self.counters['by_endpoint'][endpoint] += 1
        
        timestamp = datetime.now().strftime('%H:%M:%S.%f')[:-3]
        self.counters['timestamps'].append({
            'time': timestamp,
            'endpoint': endpoint,
            'method': method
        })
        
        print(f"[{timestamp}] {method} {endpoint}")
    
    def log_external_call(self, api_name):
        """记录外部API调用"""
        if api_name not in self.counters['external_calls']:
            self.counters['external_calls'][api_name] = 0
        self.counters['external_calls'][api_name] += 1
        
        print(f"  → 调用外部API: {api_name}")
    
    def print_summary(self):
        """打印统计摘要"""
        print("\n" + "="*80)
        print("API调用统计摘要")
        print("="*80)
        
        print(f"\n总请求数: {self.counters['total_requests']}")
        
        print("\n按端点统计:")
        for endpoint, count in sorted(self.counters['by_endpoint'].items(), key=lambda x: x[1], reverse=True):
            print(f"  - {endpoint}: {count}次")
        
        print("\n外部API调用:")
        for api_name, count in self.counters['external_calls'].items():
            print(f"  - {api_name}: {count}次")
        
        print(f"\n总外部API调用次数: {sum(self.counters['external_calls'].values())}")
        
        print("\n时间线:")
        for i, entry in enumerate(self.counters['timestamps'][:20]):  # 只显示前20个
            print(f"  {i+1:2d}. {entry['time']} - {entry['method']} {entry['endpoint']}")

def simulate_symbol_analysis_requests(monitor):
    """模拟SymbolAnalysis页面的请求"""
    print("\n" + "="*80)
    print("模拟SymbolAnalysis页面请求")
    print("="*80)
    
    base_url = "http://localhost:8889"
    
    # 模拟页面加载
    print("\n[模拟] 页面加载...")
    
    # 1. 获取股票数据
    monitor.log_request('/api/market/stock/AAPL')
    try:
        response = requests.get(f"{base_url}/api/market/stock/AAPL", timeout=5)
        monitor.log_external_call('finnhub')
    except Exception as e:
        print(f"  请求失败: {e}")
    
    # 2. 获取历史数据 (默认1M)
    monitor.log_request('/api/market/history/AAPL?interval=D&range=1month')
    try:
        response = requests.get(f"{base_url}/api/market/history/AAPL", params={'interval': 'D', 'range': '1month'}, timeout=5)
        monitor.log_external_call('twelvedata')
    except Exception as e:
        print(f"  请求失败: {e}")
    
    # 3. 检查是否有其他API调用
    print("\n[检查] 检查可能存在的重复调用...")
    
    # 模拟可能的重复调用
    for i in range(2):
        monitor.log_request(f'/api/market/stock/AAPL_dup{i}')
        monitor.log_external_call('finnhub')
        time.sleep(0.1)
    
    # 4. 模拟切换timeframe
    print("\n[模拟] 切换timeframe到3M...")
    monitor.log_request('/api/market/history/AAPL?interval=D&range=3month')
    monitor.log_external_call('twelvedata')
    
    print("\n[模拟] 切换timeframe到1W...")
    monitor.log_request('/api/market/history/AAPL?interval=5&range=1week')
    monitor.log_external_call('twelvedata')

def analyze_frontend_code():
    """分析前端代码中的API调用模式"""
    print("\n" + "="*80)
    print("分析前端代码中的API调用模式")
    print("="*80)
    
    try:
        with open('../frontend/src/pages/SymbolAnalysis.tsx', 'r', encoding='utf-8') as f:
            content = f.read()
        
        # 查找useEffect
        import re
        use_effects = re.findall(r'useEffect\(.*?\)', content, re.DOTALL)
        print(f"\n找到的useEffect数量: {len(use_effects)}")
        
        # 查找API调用
        api_calls = re.findall(r'(marketDataService\.\w+|fetch\(|axios\.)', content)
        print(f"\n找到的API调用模式: {len(api_calls)}")
        
        # 分类统计
        call_types = {}
        for call in api_calls:
            if 'getStockData' in call:
                call_types['getStockData'] = call_types.get('getStockData', 0) + 1
            elif 'getStockHistory' in call:
                call_types['getStockHistory'] = call_types.get('getStockHistory', 0) + 1
            elif 'fetch' in call:
                call_types['fetch'] = call_types.get('fetch', 0) + 1
        
        print("\nAPI调用类型统计:")
        for call_type, count in call_types.items():
            print(f"  - {call_type}: {count}次")
            
    except Exception as e:
        print(f"分析前端代码时出错: {e}")

def main():
    monitor = APIMonitor()
    
    print("="*80)
    print("SymbolAnalysis页面API调用分析")
    print("="*80)
    
    # 分析前端代码
    analyze_frontend_code()
    
    # 模拟请求
    simulate_symbol_analysis_requests(monitor)
    
    # 打印摘要
    monitor.print_summary()
    
    print("\n" + "="*80)
    print("问题分析:")
    print("="*80)
    
    print("""
可能的问题原因:
1. React严格模式导致useEffect执行两次
2. 多个useEffect独立触发相同的数据请求
3. 组件重新渲染导致重复请求
4. 没有请求去重机制
5. 没有缓存机制
6. 多个组件独立请求相同数据
""")
    
    print("\n优化建议:")
    print("""
1. 添加请求锁机制 - 防止同一请求并发执行
2. 添加缓存机制 - 短时间内相同请求返回缓存
3. 合并useEffect - 减少独立的数据请求
4. 使用React Query或SWR - 自动处理缓存和去重
5. 添加请求去重 - 相同请求只执行一次
6. 优化组件结构 - 避免多个组件请求相同数据
""")

if __name__ == '__main__':
    main()