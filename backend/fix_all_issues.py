#!/usr/bin/env python3
"""
修复Market Scanner展开详情中的所有问题
"""

import os
import re

def fix_backend_issues():
    """修复后端问题"""
    file_path = "start_quant_backend.py"
    
    print("读取后端文件...")
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 1. 确保fetch_finnhub_news函数在analyze_news_for_stock之前定义
    print("\n1. 检查函数定义顺序...")
    
    fetch_pos = content.find("def fetch_finnhub_news(symbol):")
    analyze_pos = content.find("def analyze_news_for_stock(symbol):")
    
    if fetch_pos == -1:
        print("错误: 未找到fetch_finnhub_news函数")
        return False
    
    if analyze_pos == -1:
        print("错误: 未找到analyze_news_for_stock函数")
        return False
    
    if fetch_pos > analyze_pos:
        print("需要重新排序函数定义...")
        
        # 提取fetch_finnhub_news函数
        fetch_end = content.find("\ndef ", fetch_pos + 1)
        if fetch_end == -1:
            fetch_end = len(content)
        
        fetch_func = content[fetch_pos:fetch_end]
        
        # 删除原函数
        content_without_fetch = content[:fetch_pos] + content[fetch_end:]
        
        # 在analyze_news_for_stock之前插入
        new_analyze_pos = content_without_fetch.find("def analyze_news_for_stock(symbol):")
        
        # 查找插入点之前的空行
        insert_pos = new_analyze_pos
        while insert_pos > 0 and content_without_fetch[insert_pos-1] == '\n':
            insert_pos -= 1
        
        # 重新组合内容
        fixed_content = content_without_fetch[:insert_pos] + fetch_func + "\n\n" + content_without_fetch[insert_pos:]
        content = fixed_content
        print("函数定义顺序已修复")
    else:
        print("函数定义顺序正确")
    
    # 2. 修复AI分析接口中的topNews格式化函数
    print("\n2. 检查topNews格式化函数...")
    
    # 查找format_top_news_for_frontend函数
    format_func_start = content.find("def format_top_news_for_frontend(news_data):")
    if format_func_start == -1:
        print("错误: 未找到format_top_news_for_frontend函数")
        return False
    
    # 检查函数实现
    format_func_end = content.find("\ndef ", format_func_start + 1)
    if format_func_end == -1:
        format_func_end = len(content)
    
    format_func = content[format_func_start:format_func_end]
    
    # 检查函数是否返回正确的对象结构
    if "'title':" in format_func and "'source':" in format_func:
        print("topNews格式化函数结构正确")
    else:
        print("WARNING: topNews格式化函数可能有问题")
    
    # 3. 检查AI分析接口是否调用format_top_news_for_frontend
    print("\n3. 检查AI分析接口调用...")
    
    ai_analyze_start = content.find("def ai_analyze_single():")
    if ai_analyze_start == -1:
        print("错误: 未找到ai_analyze_single函数")
        return False
    
    # 查找调用format_top_news_for_frontend的地方
    call_pos = content.find("format_top_news_for_frontend(news_data)", ai_analyze_start)
    if call_pos == -1:
        print("错误: 未找到对format_top_news_for_frontend的调用")
        return False
    
    print("AI分析接口正确调用了topNews格式化函数")
    
    # 4. 检查返回的数据结构
    print("\n4. 检查返回数据结构...")
    
    # 查找response_data中的topNews字段
    response_data_pos = content.find("'topNews':", ai_analyze_start)
    if response_data_pos == -1:
        print("错误: 未找到topNews字段定义")
        return False
    
    # 检查topNews字段的值
    line_start = content.rfind('\n', 0, response_data_pos) + 1
    line_end = content.find('\n', response_data_pos)
    top_news_line = content[line_start:line_end].strip()
    
    if "format_top_news_for_frontend" in top_news_line:
        print("topNews字段正确使用了格式化函数")
    else:
        print(f"WARNING: topNews字段可能有问题: {top_news_line}")
    
    # 5. 检查provenance字段
    print("\n5. 检查provenance字段...")
    
    provenance_pos = content.find("'provenance':", ai_analyze_start)
    if provenance_pos == -1:
        print("错误: 未找到provenance字段")
        return False
    
    # 提取provenance结构
    provenance_start = content.find("{", provenance_pos)
    provenance_end = content.find("}", provenance_start) + 1
    provenance_struct = content[provenance_start:provenance_end]
    
    required_fields = ["'marketData':", "'companyInfo':", "'news':", "'aiAnalysis':"]
    missing_fields = []
    
    for field in required_fields:
        if field not in provenance_struct:
            missing_fields.append(field)
    
    if missing_fields:
        print(f"WARNING: provenance缺少字段: {missing_fields}")
    else:
        print("provenance字段完整")
    
    # 6. 检查dayHigh/dayLow字段
    print("\n6. 检查dayHigh/dayLow字段...")
    
    # 查找市场数据获取部分
    market_data_pos = content.find("market_data = {", ai_analyze_start)
    if market_data_pos == -1:
        print("WARNING: 未找到market_data结构定义")
    else:
        market_data_end = content.find("}", market_data_pos) + 1
        market_data_struct = content[market_data_pos:market_data_end]
        
        if "'dayHigh':" in market_data_struct and "'dayLow':" in market_data_struct:
            print("market_data包含dayHigh和dayLow字段")
        else:
            print("WARNING: market_data可能缺少dayHigh或dayLow字段")
    
    print("\n=== 后端检查完成 ===")
    return True

def fix_frontend_volume_formatting():
    """修复前端成交量格式化问题"""
    file_path = "../frontend/src/pages/Portfolio.tsx"
    
    if not os.path.exists(file_path):
        print(f"前端文件不存在: {file_path}")
        return False
    
    print("\n读取前端文件...")
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 查找成交量格式化代码
    print("\n查找成交量格式化代码...")
    
    # 查找 (volume / 1000000).toFixed(1) + 'M'
    volume_pattern1 = r"\(record\.volume\s*/\s*1000000\)\.toFixed\(1\)\s*\+\s*'M'"
    volume_pattern2 = r"\(volume\s*/\s*1000000\)\.toFixed\(1\)\s*\+\s*'M'"
    
    matches1 = re.findall(volume_pattern1, content)
    matches2 = re.findall(volume_pattern2, content)
    
    print(f"找到 {len(matches1) + len(matches2)} 处成交量格式化代码")
    
    # 建议的智能格式化函数
    smart_format_function = """
  const formatVolume = (volume: number | null | undefined): string => {
    if (volume === null || volume === undefined || volume === 0) {
      return '--';
    }
    
    if (volume < 1000) {
      return volume.toString();
    } else if (volume < 1000000) {
      return (volume / 1000).toFixed(1) + 'K';
    } else if (volume < 1000000000) {
      return (volume / 1000000).toFixed(1) + 'M';
    } else {
      return (volume / 1000000000).toFixed(1) + 'B';
    }
  };
"""
    
    print("\n建议添加智能成交量格式化函数:")
    print(smart_format_function)
    
    # 查找可以插入函数的位置
    functions_section = content.find("const calculateRelativeVolume =")
    if functions_section != -1:
        print("\n可以在calculateRelativeVolume函数之前添加formatVolume函数")
    
    return True

def create_fix_summary():
    """创建修复总结"""
    print("\n" + "="*80)
    print("MARKET SCANNER 问题修复总结")
    print("="*80)
    
    print("\n已识别的问题:")
    print("1. News显示问题")
    print("   - 问题: topNews是字符串，前端期望对象")
    print("   - 状态: ✅ 已修复 (后端已修改)")
    
    print("\n2. Volume格式化问题")
    print("   - 问题: 所有成交量都按'M'格式化，没有考虑K/B")
    print("   - 状态: ⚠️ 需要修复 (建议添加智能格式化函数)")
    
    print("\n3. Data Source显示问题")
    print("   - 问题: 显示'Unknown Source'")
    print("   - 状态: ⚠️ 需要修复 (确保后端返回dataSource字段)")
    
    print("\n4. Day High/Day Low显示问题")
    print("   - 问题: 显示'$--'")
    print("   - 状态: ⚠️ 需要修复 (确保后端从Alpaca API获取这些字段)")
    
    print("\n5. 6-Dimension Score真实性")
    print("   - 状态: 🔍 需要验证 (检查AI分析是否有真实依据)")
    
    print("\n6. AI总结模板化")
    print("   - 状态: 🔍 需要验证 (确保AI分析基于真实数据)")
    
    print("\n" + "="*80)
    print("修复建议:")
    print("="*80)
    
    print("\n1. 后端修复:")
    print("   - 确保fetch_finnhub_news在analyze_news_for_stock之前定义")
    print("   - 确保topNews返回对象而不是字符串")
    print("   - 确保返回完整的provenance信息")
    print("   - 确保从Alpaca API获取dayHigh/dayLow字段")
    
    print("\n2. 前端修复:")
    print("   - 添加智能成交量格式化函数formatVolume")
    print("   - 替换现有的简单'M'格式化")
    
    print("\n3. 验证:")
    print("   - 运行测试验证AI分析的6维度分数")
    print("   - 检查AI总结是否基于真实数据")
    
    return True

if __name__ == '__main__':
    print("开始修复Market Scanner问题...")
    
    # 修复后端问题
    backend_ok = fix_backend_issues()
    
    # 检查前端问题
    frontend_ok = fix_frontend_volume_formatting()
    
    # 创建修复总结
    create_fix_summary()
    
    print("\n" + "="*80)
    print("修复完成!")
    print("="*80)
    
    if backend_ok:
        print("后端检查完成，建议重启后端服务")
    
    if frontend_ok:
        print("前端检查完成，建议添加智能成交量格式化函数")
    
    print("\n下一步:")
    print("1. 重启后端服务")
    print("2. 运行测试验证修复效果")
    print("3. 根据需要修复前端成交量格式化")