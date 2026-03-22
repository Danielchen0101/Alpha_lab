"""
测试SymbolAnalysis页面的API调用次数
"""

import requests
import time
import json
from datetime import datetime

class APICallTracker:
    def __init__(self):
        self.calls = []
        self.external_calls = {
            'finnhub': 0,
            'twelvedata': 0
        }
    
    def track_call(self, endpoint, params=None):
        timestamp = datetime.now().strftime('%H:%M:%S.%f')[:-3]
        call_info = {
            'time': timestamp,
            'endpoint': endpoint,
            'params': params
        }
        self.calls.append(call_info)
        
        print(f"[{timestamp}] {endpoint}")
        if params:
            print(f"     参数: {params}")
    
    def track_external(self, api_name):
        self.external_calls[api_name] += 1
        print(f"     → 外部API: {api_name} (累计: {self.external_calls[api_name]})")
    
    def simulate_symbol_analysis(self):
        """模拟SymbolAnalysis页面加载"""
        print("="*80)
        print("模拟SymbolAnalysis页面加载")
        print("="*80)
        
        base_url = "http://localhost:8889"
        
        # 模拟页面初始加载
        print("\n1. 页面初始加载:")
        
        # 1.1 获取股票数据
        self.track_call('/api/market/stock/AAPL')
        try:
            response = requests.get(f"{base_url}/api/market/stock/AAPL", timeout=5)
            self.track_external('finnhub')
        except Exception as e:
            print(f"     失败: {e}")
        
        # 1.2 获取历史数据 (默认1M)
        self.track_call('/api/market/history/AAPL', {'interval': 'D', 'range': '1month'})
        try:
            response = requests.get(f"{base_url}/api/market/history/AAPL", 
                                   params={'interval': 'D', 'range': '1month'}, 
                                   timeout=5)
            self.track_external('twelvedata')
        except Exception as e:
            print(f"     失败: {e}")
        
        # 模拟React严格模式下的重复调用
        print("\n2. React严格模式可能导致的重复调用:")
        for i in range(2):
            self.track_call(f'/api/market/stock/AAPL_dup{i}')
            self.track_external('finnhub')
            time.sleep(0.1)
        
        # 模拟切换timeframe
        print("\n3. 用户切换timeframe:")
        timeframes = [
            ('3M', {'interval': 'D', 'range': '3month'}),
            ('1W', {'interval': '5', 'range': '1week'}),
            ('1D', {'interval': '5', 'range': '1day'})
        ]
        
        for tf_name, params in timeframes:
            print(f"   切换到 {tf_name}:")
            self.track_call('/api/market/history/AAPL', params)
            self.track_external('twelvedata')
            time.sleep(0.2)
        
        # 模拟组件重新渲染
        print("\n4. 组件重新渲染可能触发的调用:")
        for i in range(2):
            self.track_call(f'/api/market/stock/AAPL_rerender{i}')
            self.track_external('finnhub')
            time.sleep(0.1)
    
    def print_summary(self):
        """打印统计摘要"""
        print("\n" + "="*80)
        print("API调用统计摘要")
        print("="*80)
        
        print(f"\n总API调用次数: {len(self.calls)}")
        
        print("\n调用详情:")
        for i, call in enumerate(self.calls):
            print(f"  {i+1:2d}. {call['time']} - {call['endpoint']}")
            if call['params']:
                print(f"      参数: {call['params']}")
        
        print(f"\n外部API调用统计:")
        for api_name, count in self.external_calls.items():
            print(f"  - {api_name}: {count}次")
        
        total_external = sum(self.external_calls.values())
        print(f"\n总外部API调用次数: {total_external}")
        print(f"Twelve Data credit消耗: {self.external_calls['twelvedata']}")
        print(f"Finnhub credit消耗: {self.external_calls['finnhub']}")
        
        # 分析问题
        print("\n" + "="*80)
        print("问题分析")
        print("="*80)
        
        print(f"""
当前问题:
1. 单次页面加载至少调用 {self.external_calls['finnhub'] + self.external_calls['twelvedata']} 次外部API
2. 切换timeframe会额外消耗Twelve Data credit
3. React严格模式可能导致重复调用
4. 组件重新渲染可能触发不必要的数据获取

优化目标:
将单次页面加载的外部API调用控制在4次以内:
- Finnhub: 1次 (股票数据)
- Twelve Data: 1次 (历史数据)
- 其他: 2次以内 (公司信息、技术指标等)
        """)

def analyze_frontend_patterns():
    """分析前端代码中的调用模式"""
    print("\n" + "="*80)
    print("前端代码分析")
    print("="*80)
    
    try:
        # 读取SymbolAnalysis.tsx
        with open('../frontend/src/pages/SymbolAnalysis.tsx', 'r', encoding='utf-8') as f:
            content = f.read()
        
        # 分析useEffect
        import re
        
        # 查找所有useEffect
        use_effects = re.findall(r'useEffect\(\(\) => \{[\s\S]*?\}, \[.*?\]\)', content)
        print(f"\n找到的useEffect数量: {len(use_effects)}")
        
        # 分析每个useEffect的依赖
        for i, effect in enumerate(use_effects[:5]):  # 只分析前5个
            # 提取依赖数组
            deps_match = re.search(r'\[(.*?)\]\)', effect)
            if deps_match:
                deps = deps_match.group(1).strip()
                print(f"\nuseEffect {i+1}:")
                print(f"  依赖: [{deps}]")
                
                # 检查是否调用API
                if 'loadStockData' in effect or 'getStockData' in effect:
                    print(f"  调用: 股票数据API")
                if 'loadHistoricalPrices' in effect or 'getStockHistory' in effect:
                    print(f"  调用: 历史数据API")
        
        # 查找所有API调用
        api_calls = []
        
        # marketDataService调用
        marketdata_calls = re.findall(r'marketDataService\.(\w+)', content)
        api_calls.extend([f"marketDataService.{call}" for call in marketdata_calls])
        
        # fetch调用
        fetch_calls = re.findall(r'fetch\([^)]+\)', content)
        api_calls.extend(fetch_calls)
        
        print(f"\n找到的API调用模式: {len(api_calls)}")
        
        # 统计调用类型
        call_stats = {}
        for call in api_calls:
            if 'getStockData' in call:
                call_stats['getStockData'] = call_stats.get('getStockData', 0) + 1
            elif 'getStockHistory' in call:
                call_stats['getStockHistory'] = call_stats.get('getStockHistory', 0) + 1
            elif 'fetch' in call:
                call_stats['fetch'] = call_stats.get('fetch', 0) + 1
        
        print("\nAPI调用类型统计:")
        for call_type, count in call_stats.items():
            print(f"  - {call_type}: {count}次")
            
    except Exception as e:
        print(f"分析前端代码时出错: {e}")

def main():
    # 分析前端代码
    analyze_frontend_patterns()
    
    # 启动后端（如果未运行）
    print("\n" + "="*80)
    print("启动后端服务...")
    print("="*80)
    
    # 这里假设后端已经在运行
    tracker = APICallTracker()
    
    # 模拟SymbolAnalysis页面
    tracker.simulate_symbol_analysis()
    
    # 打印统计
    tracker.print_summary()

if __name__ == '__main__':
    main()