"""
分析1 Month日期范围
"""

import requests
from datetime import datetime, timedelta
import json

def analyze_1month_range():
    """分析1 Month日期范围"""
    print("="*80)
    print("1 Month日期范围分析")
    print("="*80)
    
    base_url = "http://localhost:8889"
    
    try:
        # 获取1 Month数据
        print("\n1. 获取后端1 Month数据...")
        response = requests.get(f"{base_url}/api/market/history/AAPL", 
                               params={'interval': 'D', 'range': '1month'},
                               timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            
            print(f"   数据条数: {data.get('count')}")
            
            if data.get('data') and len(data['data']) > 0:
                # 提取日期并排序
                dates = [item['time'] for item in data['data']]
                dates.sort()
                
                print(f"\n2. 后端原始数据范围:")
                print(f"   最早日期: {dates[0]}")
                print(f"   最晚日期: {dates[-1]}")
                print(f"   总天数跨度: {(datetime.fromisoformat(dates[-1]) - datetime.fromisoformat(dates[0])).days}天")
                print(f"   数据条数: {len(dates)}")
                
                # 计算理论1个月范围
                today = datetime.now()
                one_month_ago = today - timedelta(days=30)
                
                print(f"\n3. 理论1个月范围:")
                print(f"   今天: {today.strftime('%Y-%m-%d')}")
                print(f"   1个月前: {one_month_ago.strftime('%Y-%m-%d')}")
                print(f"   理论天数: 30天")
                
                # 分析数据分布
                print(f"\n4. 数据分布分析:")
                weeks = {}
                for date_str in dates:
                    date = datetime.fromisoformat(date_str)
                    week_key = f"{date.year}-W{date.isocalendar()[1]}"
                    weeks[week_key] = weeks.get(week_key, 0) + 1
                
                for week, count in sorted(weeks.items()):
                    print(f"   {week}: {count}个交易日")
                
                # 建议的显示范围
                print(f"\n5. 当前显示范围分析:")
                print(f"   当前显示: {dates[0]} 到 {dates[-1]} ({len(dates)}个交易日)")
                
                # 建议收紧到最近1个月
                recent_dates = [d for d in dates if datetime.fromisoformat(d) >= one_month_ago]
                if recent_dates:
                    print(f"   建议显示: {recent_dates[0]} 到 {recent_dates[-1]} ({len(recent_dates)}个交易日)")
                    print(f"   收紧天数: {len(dates) - len(recent_dates)}天")
                else:
                    print(f"   警告: 没有最近1个月的数据")
                
                # X轴标签分析
                print(f"\n6. X轴标签分析:")
                total_days = len(dates)
                
                # 当前逻辑：每7天一个标签
                current_interval = 7
                current_labels = total_days // current_interval + 1
                
                print(f"   当前逻辑:")
                print(f"     - 标签间隔: 每{current_interval}天一个标签")
                print(f"     - 预计标签数: {current_labels}")
                
                # 对于收紧后的数据
                if recent_dates:
                    recent_total = len(recent_dates)
                    # 建议：如果数据少于20天，每5天一个标签；否则每7天
                    if recent_total <= 20:
                        suggested_interval = 5
                    else:
                        suggested_interval = 7
                    
                    suggested_labels = recent_total // suggested_interval + 1
                    
                    print(f"   建议调整:")
                    print(f"     - 数据条数: {recent_total}")
                    print(f"     - 建议间隔: 每{suggested_interval}天一个标签")
                    print(f"     - 预计标签数: {suggested_labels}")
                
                print(f"\n7. 问题总结:")
                print(f"   ✅ 后端返回{len(dates)}条数据")
                print(f"   ⚠️ 日期范围偏早: 从{dates[0]}开始，比理论1个月({one_month_ago.strftime('%Y-%m-%d')})早")
                print(f"   ✅ X轴标签逻辑: 每7天一个标签")
                print(f"   🔧 需要调整: 收紧日期范围到最近1个月")
                
        else:
            print(f"   API请求失败: {response.status_code}")
            
    except Exception as e:
        print(f"   分析失败: {e}")

def check_frontend_1month_logic():
    """检查前端1 Month逻辑"""
    print("\n" + "="*80)
    print("前端1 Month逻辑检查")
    print("="*80)
    
    try:
        with open('../frontend/src/pages/SymbolAnalysis.tsx', 'r', encoding='utf-8') as f:
            content = f.read()
        
        # 检查1 Month相关函数
        functions = {
            "get1MonthTicks": "const get1MonthTicks",
            "format1MonthXAxisTick": "const format1MonthXAxisTick",
            "1 Month数据处理": "selectedTimeframe === '1M'"
        }
        
        print("\n函数检查:")
        for func_name, pattern in functions.items():
            if pattern in content:
                print(f"   ✅ {func_name}: 存在")
            else:
                print(f"   ❌ {func_name}: 未找到")
        
        # 检查是否在timeframe处理中有1 Month特殊逻辑
        timeframe_pattern = r"else if \(selectedTimeframe === '1M'\)"
        if timeframe_pattern in content:
            print(f"\n✅ 1 Month有特殊处理逻辑")
        else:
            print(f"\n⚠️ 1 Month没有特殊处理逻辑，使用默认处理")
        
        # 检查X轴标签配置
        xaxis_pattern = r"ticks={[\s\S]*?selectedTimeframe === '1M' \? get1MonthTicks"
        if xaxis_pattern in content:
            print(f"✅ 1 Month使用专门的X轴标签函数")
        else:
            print(f"❌ 1 Month没有专门的X轴标签配置")
        
    except Exception as e:
        print(f"检查前端代码失败: {e}")

if __name__ == '__main__':
    analyze_1month_range()
    check_frontend_1month_logic()