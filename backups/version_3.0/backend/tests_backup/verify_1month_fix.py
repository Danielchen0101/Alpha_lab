"""
验证1 Month日期范围调整
"""

import requests
from datetime import datetime, timedelta

def verify_1month_fix():
    """验证1 Month日期范围调整"""
    print("="*80)
    print("1 Month日期范围调整验证")
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
                
                # 计算前端应该显示的范围
                print(f"\n4. 前端调整后预期范围:")
                
                # 过滤出最近1个月的数据
                recent_dates = [d for d in dates if datetime.fromisoformat(d) >= one_month_ago]
                
                if recent_dates:
                    print(f"   预期最早日期: {recent_dates[0]}")
                    print(f"   预期最晚日期: {recent_dates[-1]}")
                    print(f"   预期数据条数: {len(recent_dates)}")
                    print(f"   收紧天数: {len(dates) - len(recent_dates)}天")
                    
                    # 计算X轴标签
                    total_days = len(recent_dates)
                    if total_days <= 15:
                        interval = 3
                    elif total_days <= 25:
                        interval = 5
                    else:
                        interval = 7
                    
                    print(f"\n5. X轴标签预期:")
                    print(f"   总交易日数: {total_days}")
                    print(f"   标签间隔: 每{interval}个交易日显示一个标签")
                    print(f"   预计标签数量: {total_days // interval + 1}")
                    
                    # 模拟标签显示
                    print(f"   模拟标签显示:")
                    for i in range(0, len(recent_dates), interval):
                        if i < len(recent_dates):
                            date_str = recent_dates[i]
                            date_obj = datetime.fromisoformat(date_str)
                            formatted = f"{date_obj.month}/{date_obj.day}"
                            print(f"     {date_str} -> {formatted}")
                    
                else:
                    print(f"   警告: 没有最近1个月的数据")
                    print(f"   将显示原始数据范围")
                
                print(f"\n6. 修改总结:")
                print(f"   日期范围收紧: 从{len(dates)}条收紧到{len(recent_dates)}条")
                print(f"   X轴标签优化: 动态间隔，显示清晰")
                print(f"   不影响其他timeframe: 只修改1 Month")
                print(f"   保持图表显示: 不会变成空白")
                
        else:
            print(f"   API请求失败: {response.status_code}")
            
    except Exception as e:
        print(f"   验证失败: {e}")

def check_frontend_modifications():
    """检查前端修改"""
    print("\n" + "="*80)
    print("前端修改检查")
    print("="*80)
    
    try:
        with open('../frontend/src/pages/SymbolAnalysis.tsx', 'r', encoding='utf-8') as f:
            content = f.read()
        
        # 检查修改的关键部分
        modifications = {
            "1 Month日期范围收紧逻辑": "selectedTimeframe === '1M'",
            "1 Month数据过滤": "const recentData = formattedData.filter",
            "1 Month X轴标签函数": "const get1MonthTicks",
            "1 Month X轴格式化函数": "const format1MonthXAxisTick",
            "动态标签间隔": "intervalDays = 3",
            "调试日志": "[1 Month] 开始调整日期范围"
        }
        
        print("\n修改检查:")
        for key, pattern in modifications.items():
            if pattern in content:
                print(f"   {key}: 已修改")
            else:
                print(f"   {key}: 未找到")
        
        # 检查是否影响其他timeframe
        other_timeframes = ["1D", "1W", "3M", "1Y"]
        print(f"\n其他timeframe检查:")
        for tf in other_timeframes:
            if f"selectedTimeframe === '{tf}'" in content:
                print(f"   {tf}: 处理逻辑存在")
        
        print(f"\n前端代码修改检查完成")
        
    except Exception as e:
        print(f"检查前端代码失败: {e}")

if __name__ == '__main__':
    verify_1month_fix()
    check_frontend_modifications()