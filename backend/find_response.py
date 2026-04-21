#!/usr/bin/env python3
"""
查找ai_analyze_single函数的返回结构
"""

import re

def find_ai_response():
    """查找AI分析函数的返回结构"""
    with open('start_quant_backend_fixed.py', 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 查找ai_analyze_single函数
    pattern = r'def ai_analyze_single\(\):(.*?)def '
    match = re.search(pattern, content, re.DOTALL)
    
    if match:
        func_content = match.group(1)
        
        # 查找所有return jsonify语句
        returns = re.findall(r'return jsonify\(\{.*?\}\)', func_content, re.DOTALL)
        
        print(f"找到 {len(returns)} 个返回语句:")
        for i, ret in enumerate(returns):
            print(f"\n=== 返回语句 {i+1} ===")
            print(ret[:500])  # 只打印前500字符
            
            # 检查是否包含success: true
            if "'success': True" in ret or '"success": True' in ret:
                print("  包含: success: True")
                
            # 检查AI字段是否为null
            if "'trendLabel': None" in ret or '"trendLabel": null' in ret:
                print("  包含: trendLabel: null")
                
            if "'overallScore': None" in ret or '"overallScore": null' in ret:
                print("  包含: overallScore: null")
                
            if "'aiReasoning': None" in ret or '"aiReasoning": null' in ret:
                print("  包含: aiReasoning: null")
    else:
        print("未找到ai_analyze_single函数")

if __name__ == '__main__':
    find_ai_response()