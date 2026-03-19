#!/usr/bin/env python3
"""
检查当前Dashboard的sector分布
"""

import requests
import json
from collections import Counter

def check_sectors():
    """检查sector分布"""
    print("检查当前Dashboard的sector分布")
    print("=" * 60)
    
    base_url = "http://127.0.0.1:8889/api"
    
    try:
        # 获取Dashboard数据
        response = requests.get(f"{base_url}/market/stocks?dashboard=true", timeout=15)
        
        if response.status_code == 200:
            data = response.json()
            stocks = data.get('stocks', [])
            
            # 统计sector
            sectors = []
            for stock in stocks:
                sector = stock.get('sector')
                if sector:
                    sectors.append(sector)
                else:
                    sectors.append('Unknown')
            
            sector_counter = Counter(sectors)
            
            print(f"  股票总数: {len(stocks)}支")
            print(f"  Sector数量: {len(sector_counter)}个")
            
            print(f"\n  Sector分布:")
            for sector, count in sector_counter.most_common():
                percentage = (count / len(stocks)) * 100
                print(f"    {sector}: {count}支 ({percentage:.1f}%)")
            
            # 分析可能的问题
            print(f"\n  颜色映射分析:")
            
            # 模拟前端getSectorColor函数
            def get_sector_color(sector_name):
                lower_name = sector_name.lower()
                
                if lower_name.includes('tech') or lower_name.includes('information'):
                    return '#1890ff'  # Technology
                if lower_name.includes('financ') or lower_name.includes('bank'):
                    return '#52c41a'  # Financial Services
                if lower_name.includes('communicat') or lower_name.includes('media'):
                    return '#722ed1'  # Communication Services
                if lower_name.includes('health') or lower_name.includes('medical'):
                    return '#eb2f96'  # Healthcare
                if lower_name.includes('energy') or lower_name.includes('oil') or lower_name.includes('gas'):
                    return '#fa8c16'  # Energy
                if lower_name.includes('consumer') or lower_name.includes('retail'):
                    return '#13c2c2'  # Consumer
                if lower_name.includes('industri') or lower_name.includes('manufactur'):
                    return '#2f54eb'  # Industrials
                if lower_name.includes('real') or lower_name.includes('estate'):
                    return '#fa541c'  # Real Estate
                if lower_name.includes('utilit'):
                    return '#a0d911'  # Utilities
                if lower_name.includes('material'):
                    return '#531dab'  # Materials
                
                # 默认颜色
                default_colors = ['#1890ff', '#52c41a', '#722ed1', '#eb2f96', '#fa8c16', 
                                 '#13c2c2', '#2f54eb', '#fa541c', '#a0d911', '#531dab']
                hash_val = sum(ord(char) for char in sector_name)
                return default_colors[hash_val % len(default_colors)]
            
            # 检查颜色分配
            color_map = {}
            for sector in sector_counter.keys():
                # 简化模拟
                if 'tech' in sector.lower():
                    color = '#1890ff'
                elif 'semi' in sector.lower():
                    color = '#1890ff'  # 可能和Technology同色
                elif 'bank' in sector.lower():
                    color = '#52c41a'
                elif 'financial' in sector.lower():
                    color = '#52c41a'  # 可能和Banking同色
                elif 'auto' in sector.lower():
                    color = default_colors[hash(sector) % len(default_colors)]  # 随机
                else:
                    color = default_colors[hash(sector) % len(default_colors)]
                
                color_map[sector] = color
            
            # 检查颜色重复
            color_to_sectors = {}
            for sector, color in color_map.items():
                if color not in color_to_sectors:
                    color_to_sectors[color] = []
                color_to_sectors[color].append(sector)
            
            print(f"\n  颜色重复检查:")
            for color, sectors_list in color_to_sectors.items():
                if len(sectors_list) > 1:
                    print(f"    ⚠️ 颜色 {color} 被多个sector使用: {', '.join(sectors_list)}")
                else:
                    print(f"    ✅ 颜色 {color} 唯一分配给: {sectors_list[0]}")
            
            # 建议的sector列表
            print(f"\n  建议优先分配颜色的sector:")
            priority_sectors = ['Technology', 'Semiconductors', 'Banking', 'Automobiles', 
                              'Financial Services', 'Retail', 'Media', 'Healthcare']
            
            for sector in priority_sectors:
                if any(s.lower() == sector.lower() for s in sector_counter.keys()):
                    print(f"    • {sector} (当前存在)")
                else:
                    print(f"    • {sector} (可能不存在)")
            
        else:
            print(f"  请求失败: {response.status_code}")
            
    except Exception as e:
        print(f"  检查异常: {str(e)}")
    
    print(f"\n" + "=" * 60)

if __name__ == "__main__":
    check_sectors()