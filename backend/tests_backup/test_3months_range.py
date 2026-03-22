"""
测试3 Months日期范围
"""

import requests
from datetime import datetime, timedelta

def test_3months_range():
    """测试3 Months日期范围"""
    print("="*80)
    print("3 Months日期范围分析")
    print("="*80)
    
    base_url = "http://localhost:8889"
    
    try:
        # 获取3 Months数据
        response = requests.get(f"{base_url}/api/market/history/AAPL", 
                               params={'interval': 'D', 'range': '3month'},
                               timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            
            print(f"\n后端返回数据:")
            print(f"  数据条数: {data.get('count')}")
            print(f"  数据源: {data.get('dataSource')}")
            print(f"  备注: {data.get('note')}")
            
            if data.get('data') and len(data['data']) > 0:
                dates = [item['time'] for item in data['data']]
                dates.sort()  # 按日期排序
                
                print(f"\n日期范围分析:")
                print(f"  最早日期: {dates[0]}")
                print(f"  最晚日期: {dates[-1]}")
                print(f"  总天数跨度: {(datetime.fromisoformat(dates[-1]) - datetime.fromisoformat(dates[0])).days}天")
                
                # 计算最近3个月的理论范围
                today = datetime.now()
                three_months_ago = today - timedelta(days=90)
                
                print(f"\n理论3个月范围:")
                print(f"  今天: {today.strftime('%Y-%m-%d')}")
                print(f"  3个月前: {three_months_ago.strftime('%Y-%m-%d')}")
                print(f"  理论天数: 90天")
                
                # 分析数据分布
                print(f"\n数据分布分析:")
                months = {}
                for date_str in dates:
                    date = datetime.fromisoformat(date_str)
                    month_key = f"{date.year}-{date.month:02d}"
                    months[month_key] = months.get(month_key, 0) + 1
                
                for month, count in sorted(months.items()):
                    print(f"  {month}: {count}个交易日")
                
                # 建议的显示范围
                print(f"\n建议的显示范围:")
                print(f"  当前显示: {dates[0]} 到 {dates[-1]} ({len(dates)}个交易日)")
                
                # 建议收紧到最近3个月
                recent_dates = [d for d in dates if datetime.fromisoformat(d) >= three_months_ago]
                if recent_dates:
                    print(f"  建议显示: {recent_dates[0]} 到 {recent_dates[-1]} ({len(recent_dates)}个交易日)")
                    print(f"  收紧天数: {len(dates) - len(recent_dates)}天")
                else:
                    print(f"  警告: 没有最近3个月的数据")
                
                # X轴标签建议
                print(f"\nX轴标签建议:")
                total_days = len(dates)
                if total_days <= 60:
                    interval = 10
                elif total_days <= 90:
                    interval = 15
                else:
                    interval = 20
                
                print(f"  总交易日数: {total_days}")
                print(f"  建议标签间隔: 每{interval}个交易日显示一个标签")
                print(f"  预计标签数量: {total_days // interval + 1}")
                
        else:
            print(f"API请求失败: {response.status_code}")
            
    except Exception as e:
        print(f"测试失败: {e}")

def analyze_frontend_3months_logic():
    """分析前端3 Months逻辑"""
    print("\n" + "="*80)
    print("前端3 Months逻辑分析")
    print("="*80)
    
    try:
        with open('../frontend/src/pages/SymbolAnalysis.tsx', 'r', encoding='utf-8') as f:
            content = f.read()
        
        # 查找3 Months相关代码
        import re
        
        # 查找3 Months特殊处理
        three_months_pattern = r"if \(selectedTimeframe === '3M'\) \{[\s\S]*?\}"
        matches = re.findall(three_months_pattern, content)
        
        print(f"\n找到的3 Months特殊处理块: {len(matches)}")
        
        for i, match in enumerate(matches[:2]):  # 只显示前2个
            print(f"\n--- 3 Months处理块 {i+1} ---")
            lines = match.split('\n')
            for line in lines[:15]:  # 只显示前15行
                if line.strip():
                    print(f"  {line}")
        
        # 查找X轴标签配置
        xaxis_pattern = r"ticks\.push[\s\S]*?intervalDays ="
        xaxis_matches = re.findall(xaxis_pattern, content)
        
        if xaxis_matches:
            print(f"\n--- X轴标签配置 ---")
            for match in xaxis_matches[:1]:
                lines = match.split('\n')
                for line in lines:
                    if line.strip():
                        print(f"  {line}")
        
    except Exception as e:
        print(f"分析前端代码失败: {e}")

if __name__ == '__main__':
    test_3months_range()
    analyze_frontend_3months_logic()