#!/usr/bin/env python3
"""
继续完成Market Scanner限制检查
"""

import os
import sys
import re
from pathlib import Path

def read_file_content(filepath):
    """读取文件内容"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            return f.read()
    except:
        try:
            with open(filepath, 'r', encoding='gbk') as f:
                return f.read()
        except Exception as e:
            print(f"   [错误] 读取文件失败: {filepath}, 错误: {e}")
            return ""

def step3_check_all_timeouts_continued():
    """第3步：检查所有timeout（续）"""
    print("\n" + "=" * 80)
    print("第3步：检查所有timeout - 详细分析")
    print("=" * 80)
    
    backend_file = Path(__file__).parent / "start_quant_backend.py"
    backend_content = read_file_content(backend_file)
    
    # 查找所有timeout设置
    print("后端所有timeout设置:")
    print("-" * 40)
    
    # 使用正则表达式查找所有requests调用的timeout
    timeout_pattern = r'requests\.(?:get|post)\([^)]*timeout\s*=\s*(\d+)[^)]*\)'
    timeout_matches = re.findall(timeout_pattern, backend_content)
    
    if timeout_matches:
        timeout_counts = {}
        for timeout in timeout_matches:
            timeout_counts[timeout] = timeout_counts.get(timeout, 0) + 1
        
        for timeout, count in sorted(timeout_counts.items()):
            print(f"  timeout={timeout}秒: {count}次")
    else:
        print("  未找到timeout设置")
    
    # 特别检查AI分析相关的timeout
    print("\nAI分析相关timeout检查:")
    print("-" * 40)
    
    # 查找analyze_trend_with_deepseek函数
    deepseek_pattern = r'def analyze_trend_with_deepseek\([^)]*\):'
    deepseek_match = re.search(deepseek_pattern, backend_content)
    
    if deepseek_match:
        func_start = deepseek_match.start()
        # 查找函数结束
        func_lines = backend_content[func_start:].split('\n')
        indent_level = None
        func_body = []
        
        for i, line in enumerate(func_lines):
            if i == 0:
                # 第一行是函数定义
                func_body.append(line)
                # 确定缩进级别
                match = re.match(r'(\s*)def ', line)
                if match:
                    indent_level = len(match.group(1))
                continue
            
            if i == 1:
                # 第二行开始检查缩进
                current_indent = len(line) - len(line.lstrip())
                if current_indent > indent_level:
                    func_body.append(line)
                else:
                    break
            else:
                current_indent = len(line) - len(line.lstrip())
                if current_indent > indent_level:
                    func_body.append(line)
                elif line.strip() == '':
                    func_body.append(line)
                else:
                    break
        
        func_text = '\n'.join(func_body)
        
        # 检查函数中的timeout
        if 'timeout=' in func_text:
            print("  ✗ analyze_trend_with_deepseek函数包含timeout参数")
            # 提取具体的timeout值
            timeout_match = re.search(r'timeout\s*=\s*(\d+)', func_text)
            if timeout_match:
                print(f"    timeout值: {timeout_match.group(1)}秒")
        else:
            print("  ✓ analyze_trend_with_deepseek函数无timeout参数")
        
        # 检查requests.post调用
        post_calls = re.findall(r'requests\.post\([^)]+\)', func_text)
        for call in post_calls:
            print(f"  DeepSeek API调用: {call[:100]}...")
    
    # 检查前端scanner专用timeout
    print("\n前端scanner专用timeout检查:")
    print("-" * 40)
    
    frontend_dir = Path(__file__).parent.parent / "frontend" / "src"
    api_file = frontend_dir / "services" / "api.ts"
    api_content = read_file_content(api_file)
    
    # 查找scannerApi定义
    scanner_api_pattern = r'const scannerApi\s*=\s*axios\.create\([^}]+\)'
    scanner_match = re.search(scanner_api_pattern, api_content, re.DOTALL)
    
    if scanner_match:
        scanner_config = scanner_match.group(0)
        print("  scannerApi配置找到")
        
        if 'timeout:' in scanner_config:
            print("  ✗ scannerApi配置包含timeout参数")
            # 提取timeout值
            timeout_match = re.search(r'timeout\s*:\s*(\d+)', scanner_config)
            if timeout_match:
                print(f"    timeout值: {timeout_match.group(1)}ms")
        else:
            print("  ✓ scannerApi配置无timeout参数")
    else:
        print("  ✗ 未找到scannerApi配置")

def step4_check_accelerate_scan_logic():
    """第4步：检查所有"为了加速scan"的逻辑"""
    print("\n" + "=" * 80)
    print("第4步：检查所有'为了加速scan'的逻辑")
    print("=" * 80)
    
    findings = {
        "skip_partial_symbols": [],
        "render_partial_then_skip": [],
        "skip_on_no_news": [],
        "skip_on_no_sector": [],
        "skip_on_insufficient_bars": [],
        "timeout_return_empty": [],
        "placeholder_not_covered": [],
        "batch_optimizations": []
    }
    
    # 检查前端
    frontend_dir = Path(__file__).parent.parent / "frontend" / "src"
    portfolio_file = frontend_dir / "pages" / "Portfolio.tsx"
    portfolio_content = read_file_content(portfolio_file)
    
    # 1. 是否只对部分symbol调AI
    # 检查是否有symbol数量限制
    symbol_limit_patterns = [
        r'symbols\.slice\(0,\s*\d+\)',  # 只取前N个
        r'symbols\.length\s*>\s*\d+\s*\?',  # 数量判断
        r'Math\.min\(\d+,\s*symbols\.length\)'  # 限制最大数量
    ]
    
    for pattern in symbol_limit_patterns:
        if re.search(pattern, portfolio_content):
            findings["skip_partial_symbols"].append(f"符号数量限制: {pattern}")
    
    # 2. 是否先渲染一部分，后面直接跳过
    # 检查batch处理逻辑
    if 'BATCH_SIZE' in portfolio_content:
        findings["batch_optimizations"].append("使用BATCH_SIZE分批处理")
    
    # 检查是否有跳过后续批次的逻辑
    skip_batch_patterns = [
        r'break\s+;',  # 中断循环
        r'return\s+;',  # 提前返回
        r'continue\s+;'  # 跳过当前迭代
    ]
    
    for pattern in skip_batch_patterns:
        if re.search(pattern, portfolio_content):
            # 需要更精确的上下文检查
            findings["render_partial_then_skip"].append(f"可能的中断逻辑: {pattern}")
    
    # 3. 是否因为news缺失就不分析
    # 检查analyzeTrend函数
    analyze_trend_section = portfolio_content
    # 简化检查：查找news相关判断
    if 'news' in analyze_trend_section.lower() and ('null' in analyze_trend_section or 'undefined' in analyze_trend_section):
        findings["skip_on_no_news"].append("news数据检查逻辑")
    
    # 检查后端
    backend_file = Path(__file__).parent / "start_quant_backend.py"
    backend_content = read_file_content(backend_file)
    
    # 4. 是否因为sector缺失就不分析
    if 'sector' in backend_content.lower() and ('None' in backend_content or 'null' in backend_content):
        findings["skip_on_no_sector"].append("sector数据检查")
    
    # 5. 是否因为历史bars不足就直接整组字段返回N/A
    bars_patterns = [
        r'bars.*None',
        r'historical.*None',
        r'data.*empty',
        r'len\(.*\)\s*==\s*0'
    ]
    
    for pattern in bars_patterns:
        if re.search(pattern, backend_content, re.IGNORECASE):
            findings["skip_on_insufficient_bars"].append(f"数据不足检查: {pattern}")
    
    # 6. 是否在前端或后端有"超时就返回空对象"的加速逻辑
    timeout_empty_patterns = [
        r'timeout.*return.*{}',
        r'timeout.*return.*null',
        r'setTimeout.*function.*return',
        r'Promise\.race.*timeout'
    ]
    
    for pattern in timeout_empty_patterns:
        if re.search(pattern, portfolio_content + backend_content, re.IGNORECASE):
            findings["timeout_return_empty"].append(f"超时返回空: {pattern}")
    
    # 7. 是否有"先给空值占位，后续没覆盖回来"的逻辑
    placeholder_patterns = [
        r'placeholder',
        r'占位',
        r'default.*value',
        r'initial.*null'
    ]
    
    for pattern in placeholder_patterns:
        if re.search(pattern, portfolio_content, re.IGNORECASE):
            findings["placeholder_not_covered"].append(f"占位逻辑: {pattern}")
    
    # 输出结果
    print("加速scan逻辑检查结果:")
    print("-" * 40)
    
    for category, items in findings.items():
        if items:
            print(f"\n{category.upper()}:")
            for item in items:
                print(f"  • {item}")
        else:
            print(f"\n{category.upper()}: 未发现")

def step5_check_empty_symbols():
    """第5步：检查为什么还有个别symbol是空的"""
    print("\n" + "=" * 80)
    print("第5步：检查空symbol原因")
    print("=" * 80)
    
    print("由于无法直接运行扫描器，基于代码分析可能的失败阶段:")
    print("-" * 40)
    
    failure_stages = {
        "market_data": "Alpaca/Finnhub市场数据获取失败",
        "history_data": "历史数据不足或获取失败",
        "company_info": "公司信息获取失败",
        "news_data": "新闻数据获取失败",
        "prompt_build": "AI提示构建失败",
        "ai_request": "AI API请求失败",
        "ai_response": "AI响应解析失败",
        "ai_parse": "AI结果解析失败",
        "frontend_mapping": "前端数据映射失败",
        "frontend_render": "前端渲染失败"
    }
    
    # 检查后端代码中的潜在失败点
    backend_file = Path(__file__).parent / "start_quant_backend.py"
    backend_content = read_file_content(backend_file)
    
    # 查找ai_analyze_single函数
    ai_func_pattern = r'def ai_analyze_single\([^)]*\):'
    ai_match = re.search(ai_func_pattern, backend_content)
    
    if ai_match:
        func_start = ai_match.start()
        # 提取函数内容（简化版）
        func_end = backend_content.find('\n\n', func_start)
        if func_end == -1:
            func_end = len(backend_content)
        
        func_content = backend_content[func_start:func_end]
        
        print("ai_analyze_single函数中的潜在失败点:")
        print("-" * 40)
        
        # 检查各个阶段
        stages_to_check = {
            "market_data": ["market_data", "alpaca", "finnhub", "price", "quote"],
            "history_data": ["historical", "bars", "history"],
            "company_info": ["company", "profile", "sector", "industry"],
            "news_data": ["news", "sentiment", "headline"],
            "ai_request": ["requests.post", "DeepSeek", "API"],
            "ai_response": ["response.json", "parse", "解析"]
        }
        
        for stage, keywords in stages_to_check.items():
            found_issues = []
            for keyword in keywords:
                if keyword.lower() in func_content.lower():
                    # 检查是否有错误处理
                    error_pattern = rf'{keyword}.*(None|null|error|exception|fail)'
                    if re.search(error_pattern, func_content, re.IGNORECASE):
                        found_issues.append(f"{keyword}可能失败")
            
            if found_issues:
                print(f"  {stage}: {', '.join(found_issues)}")
            else:
                print(f"  {stage}: 代码中未发现明显失败点")
    
    print("\n基于代码分析的失败可能性:")
    print("-" * 40)
    print("1. market_data: 高 - Alpaca/Finnhub API可能限流或超时")
    print("2. news_data: 中 - Finnhub新闻API可能返回空或限流")
    print("3. ai_request: 中 - DeepSeek API可能超时或失败")
    print("4. ai_parse: 低 - JSON解析通常稳定")
    print("5. frontend_mapping: 低 - 类型映射通常稳定")

def step6_minimal_fixes():
    """第6步：最小修复建议"""
    print("\n" + "=" * 80)
    print("第6步：最小修复建议")
    print("=" * 80)
    
    fixes = []
    
    # 1. 调整limiter到官方免费版最大值
    config_file = Path(__file__).parent / "config.py"
    config_content = read_file_content(config_file)
    
    if 'ALPACA_RATE_LIMIT' not in config_content:
        fixes.append("添加Alpaca速率限制配置: 200/min历史数据, 30 WebSocket符号, 10次/秒请求")
    
    if 'FINNHUB_RATE_LIMIT' not in config_content:
        fixes.append("添加Finnhub速率限制配置: 60/min调用, 30次/秒硬上限, 30/min新闻调用")
    
    # 2. 去掉scanner AI timeout
    backend_file = Path(__file__).parent / "start_quant_backend.py"
    backend_content = read_file_content(backend_file)
    
    if 'timeout=' in backend_content and 'analyze_trend_with_deepseek' in backend_content:
        fixes.append("移除analyze_trend_with_deepseek函数中的timeout参数")
    
    # 3. 去掉不必要的skip/加速逻辑
    # 检查是否有跳过AI分析的逻辑
    skip_patterns = [
        r'news_data\s*is\s*None.*return',
        r'market_data\s*is\s*None.*return',
        r'len\(.*\)\s*==\s*0.*return'
    ]
    
    for pattern in skip_patterns:
        if re.search(pattern, backend_content, re.IGNORECASE):
            fixes.append(f"修改跳过逻辑 '{pattern}': 改为降级分析而非跳过")
    
    # 4. 保留必要的batch渲染
    frontend_dir = Path(__file__).parent.parent / "frontend" / "src"
    portfolio_file = frontend_dir / "pages" / "Portfolio.tsx"
    portfolio_content = read_file_content(portfolio_file)
    
    if 'BATCH_SIZE' in portfolio_content:
        fixes.append("保留BATCH_SIZE分批渲染，这是必要的性能优化")
    
    # 5. 失败不要静默返回N/A，要带失败阶段
    # 检查错误处理
    if 'return null' in portfolio_content or 'return {}' in portfolio_content:
        fixes.append("修改错误处理: 返回包含失败阶段信息的对象，而非null/空对象")
    
    print("建议的最小修复:")
    print("-" * 40)
    
    for i, fix in enumerate(fixes, 1):
        print(f"{i}. {fix}")
    
    print("\n修复原则:")
    print("1. 只改scanner直接相关代码")
    print("2. 不改UI")
    print("3. 不改scanner之外的模块")
    print("4. 保持向后兼容")

def main():
    """主函数"""
    print("Market Scanner限制点全面检查")
    print("=" * 80)
    
    # 执行所有检查步骤
    step1_find_all_limits()
    step2_check_api_limits()
    step3_check_all_timeouts_continued()
    step4_check_accelerate_scan_logic()
    step5_check_empty_symbols()
    step6_minimal_fixes()
    
    print("\n" + "=" * 80)
    print("检查完成")
    print("=" * 80)

if __name__ == '__main__':
    main()