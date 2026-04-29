#!/usr/bin/env python3
"""
Market Scanner限制点全面检查
按照6个步骤进行系统化检查
"""

import os
import re
from pathlib import Path

def read_file(filepath):
    """读取文件内容"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            return f.read()
    except:
        try:
            with open(filepath, 'r', encoding='gbk') as f:
                return f.read()
        except:
            return ""

def print_header(title):
    """打印标题"""
    print("\n" + "=" * 80)
    print(title)
    print("=" * 80)

def step1_find_limits():
    """第1步：找出所有限制点"""
    print_header("第1步：找出所有限制点")
    
    # 文件路径
    frontend_dir = Path(__file__).parent.parent / "frontend" / "src"
    portfolio_file = frontend_dir / "pages" / "Portfolio.tsx"
    api_file = frontend_dir / "services" / "api.ts"
    backend_file = Path(__file__).parent / "start_quant_backend.py"
    config_file = Path(__file__).parent / "config.py"
    
    limits = {}
    
    # 检查前端Portfolio.tsx
    print("1. 前端Portfolio.tsx检查:")
    portfolio_content = read_file(portfolio_file)
    
    # BATCH_SIZE
    batch_match = re.search(r'const\s+BATCH_SIZE\s*=\s*(\d+)', portfolio_content)
    if batch_match:
        print(f"   • BATCH_SIZE = {batch_match.group(1)}")
        limits["batch_size"] = batch_match.group(1)
    
    # Promise并发
    promise_all = len(re.findall(r'Promise\.allSettled', portfolio_content))
    if promise_all > 0:
        print(f"   • Promise.allSettled: {promise_all}处")
        limits["promise_all"] = promise_all
    
    # setTimeout
    timeouts = len(re.findall(r'setTimeout', portfolio_content))
    if timeouts > 0:
        print(f"   • setTimeout: {timeouts}处")
        limits["setTimeout"] = timeouts
    
    # fallback逻辑
    if 'fallbackMarketScan' in portfolio_content:
        print("   • fallbackMarketScan函数")
        limits["fallback"] = True
    
    # 检查前端api.ts
    print("\n2. 前端api.ts检查:")
    api_content = read_file(api_file)
    
    # scannerApi
    if 'scannerApi' in api_content:
        print("   • scannerApi专用实例")
        limits["scanner_api"] = True
        
        # 检查timeout
        scanner_section = re.search(r'const scannerApi\s*=[^;]+', api_content, re.DOTALL)
        if scanner_section:
            section = scanner_section.group(0)
            if 'timeout:' in section:
                timeout_match = re.search(r'timeout\s*:\s*(\d+)', section)
                if timeout_match:
                    print(f"   • scannerApi timeout = {timeout_match.group(1)}ms")
                    limits["scanner_timeout"] = timeout_match.group(1)
                else:
                    print("   • scannerApi有timeout但未指定值")
            else:
                print("   • scannerApi无timeout设置")
    
    # 检查后端
    print("\n3. 后端start_quant_backend.py检查:")
    backend_content = read_file(backend_file)
    
    # ThreadPoolExecutor
    threadpool_matches = re.findall(r'ThreadPoolExecutor\([^)]*max_workers\s*=\s*(\d+)', backend_content)
    if threadpool_matches:
        workers = set(threadpool_matches)
        print(f"   • ThreadPoolExecutor max_workers: {', '.join(workers)}")
        limits["threadpool_workers"] = list(workers)
    
    # requests timeout
    timeout_matches = re.findall(r'timeout\s*=\s*(\d+)', backend_content)
    if timeout_matches:
        timeout_counts = {}
        for t in timeout_matches:
            timeout_counts[t] = timeout_counts.get(t, 0) + 1
        
        print("   • requests timeout设置:")
        for t, count in sorted(timeout_counts.items()):
            print(f"     - {t}秒: {count}次")
        limits["requests_timeout"] = timeout_counts
    
    # 检查配置文件
    print("\n4. 配置文件config.py检查:")
    config_content = read_file(config_file)
    
    # 速率限制配置
    if 'ALPACA_RATE_LIMIT' in config_content:
        print("   • ALPACA_RATE_LIMIT配置存在")
        limits["alpaca_config"] = True
        
        # 提取配置值
        alpaca_match = re.search(r"ALPACA_RATE_LIMIT\s*=\s*{([^}]+)}", config_content, re.DOTALL)
        if alpaca_match:
            config_text = alpaca_match.group(1)
            historical = re.search(r"'historical_bars_per_minute'\s*:\s*(\d+)", config_text)
            if historical:
                print(f"     - historical_bars_per_minute: {historical.group(1)}")
    
    if 'FINNHUB_RATE_LIMIT' in config_content:
        print("   • FINNHUB_RATE_LIMIT配置存在")
        limits["finnhub_config"] = True
    
    return limits

def step2_check_api_limits():
    """第2步：检查API限制实现"""
    print_header("第2步：检查API限制实现")
    
    config_file = Path(__file__).parent / "config.py"
    config_content = read_file(config_file)
    
    print("1. Alpaca限制检查:")
    alpaca_match = re.search(r'ALPACA_RATE_LIMIT\s*=\s*{([^}]+)}', config_content, re.DOTALL)
    if alpaca_match:
        config_text = alpaca_match.group(1)
        
        # 检查各个配置项
        checks = [
            ("'historical_bars_per_minute'", 200, "历史数据每分钟调用"),
            ("'snapshots_per_minute'", 200, "快照每分钟调用"),
            ("'websocket_symbols'", 30, "WebSocket符号数"),
            ("'requests_per_second'", 10, "每秒请求数")
        ]
        
        for key, expected, desc in checks:
            match = re.search(f"{key}\\s*:\\s*(\\d+)", config_text)
            if match:
                value = int(match.group(1))
                status = "✓" if value == expected else "✗"
                print(f"   {status} {desc}: {value} (期望: {expected})")
            else:
                print(f"   ✗ {desc}: 未配置")
    else:
        print("   ✗ 未找到ALPACA_RATE_LIMIT配置")
    
    print("\n2. Finnhub限制检查:")
    finnhub_match = re.search(r'FINNHUB_RATE_LIMIT\s*=\s*{([^}]+)}', config_content, re.DOTALL)
    if finnhub_match:
        config_text = finnhub_match.group(1)
        
        checks = [
            ("'calls_per_minute'", 60, "每分钟调用"),
            ("'calls_per_second'", 30, "每秒调用(硬上限)"),
            ("'news_calls_per_minute'", 30, "新闻API每分钟调用")
        ]
        
        for key, expected, desc in checks:
            match = re.search(f"{key}\\s*:\\s*(\\d+)", config_text)
            if match:
                value = int(match.group(1))
                status = "✓" if value == expected else "✗"
                print(f"   {status} {desc}: {value} (期望: {expected})")
            else:
                print(f"   ✗ {desc}: 未配置")
    else:
        print("   ✗ 未找到FINNHUB_RATE_LIMIT配置")
    
    print("\n3. 实际限流器实现检查:")
    backend_file = Path(__file__).parent / "start_quant_backend.py"
    backend_content = read_file(backend_file)
    
    # 检查是否有实际的限流逻辑
    limiter_patterns = [
        (r'rate.*limit', "速率限制器"),
        (r'sleep.*\\d+', "sleep延迟"),
        (r'backoff', "退避算法"),
        (r'429.*retry', "429错误重试")
    ]
    
    found = False
    for pattern, desc in limiter_patterns:
        if re.search(pattern, backend_content, re.IGNORECASE):
            print(f"   • 找到: {desc}")
            found = True
    
    if not found:
        print("   • 未找到实际的限流器实现")

def step3_check_timeouts():
    """第3步：检查所有timeout"""
    print_header("第3步：检查所有timeout")
    
    # 检查前端
    frontend_dir = Path(__file__).parent.parent / "frontend" / "src"
    api_file = frontend_dir / "services" / "api.ts"
    api_content = read_file(api_file)
    
    print("1. 前端timeout检查:")
    
    # scannerApi timeout
    scanner_section = re.search(r'const scannerApi\s*=[^;]+', api_content, re.DOTALL)
    if scanner_section:
        section = scanner_section.group(0)
        if 'timeout:' in section:
            timeout_match = re.search(r'timeout\s*:\s*(\d+)', section)
            if timeout_match:
                print(f"   • scannerApi timeout = {timeout_match.group(1)}ms")
            else:
                print("   • scannerApi有timeout但未指定值")
        else:
            print("   • scannerApi无timeout设置 ✓")
    
    # 主api timeout
    api_section = re.search(r'const api\s*=\s*axios\.create\([^}]+\)', api_content, re.DOTALL)
    if api_section:
        section = api_section.group(0)
        if 'timeout:' in section:
            timeout_match = re.search(r'timeout\s*:\s*(\d+)', section)
            if timeout_match:
                print(f"   • 主api timeout = {timeout_match.group(1)}ms")
    
    # 检查后端
    print("\n2. 后端timeout检查:")
    backend_file = Path(__file__).parent / "start_quant_backend.py"
    backend_content = read_file(backend_file)
    
    # DeepSeek API timeout
    if 'def analyze_trend_with_deepseek' in backend_content:
        # 查找函数
        func_start = backend_content.find('def analyze_trend_with_deepseek')
        func_end = backend_content.find('\ndef ', func_start + 1)
        if func_end == -1:
            func_end = len(backend_content)
        
        func_content = backend_content[func_start:func_end]
        
        # 检查requests.post调用
        post_calls = re.findall(r'requests\.post\([^)]+\)', func_content)
        for call in post_calls:
            if 'timeout=' in call:
                timeout_match = re.search(r'timeout\s*=\s*(\d+)', call)
                if timeout_match:
                    print(f"   • DeepSeek API timeout = {timeout_match.group(1)}秒 ✗")
                else:
                    print("   • DeepSeek API有timeout但未指定值")
            else:
                print("   • DeepSeek API无timeout设置 ✓")
    
    # Alpaca API timeout统计
    print("\n3. Alpaca API timeout统计:")
    alpaca_timeouts = re.findall(r'requests\.get\([^)]*alpaca[^)]*timeout\s*=\s*(\d+)', backend_content, re.IGNORECASE)
    if alpaca_timeouts:
        counts = {}
        for t in alpaca_timeouts:
            counts[t] = counts.get(t, 0) + 1
        
        for t, count in sorted(counts.items()):
            print(f"   • timeout={t}秒: {count}次")
    else:
        print("   • 未找到Alpaca API timeout设置")
    
    # Finnhub API timeout统计
    print("\n4. Finnhub API timeout统计:")
    finnhub_timeouts = re.findall(r'requests\.get\([^)]*finnhub[^)]*timeout\s*=\s*(\d+)', backend_content, re.IGNORECASE)
    if finnhub_timeouts:
        counts = {}
        for t in finnhub_timeouts:
            counts[t] = counts.get(t, 0) + 1
        
        for t, count in sorted(counts.items()):
            print(f"   • timeout={t}秒: {count}次")
    else:
        print("   • 未找到Finnhub API timeout设置")

def step4_check_accelerate_logic():
    """第4步：检查加速scan逻辑"""
    print_header("第4步：检查加速scan逻辑")
    
    frontend_dir = Path(__file__).parent.parent / "frontend" / "src"
    portfolio_file = frontend_dir / "pages" / "Portfolio.tsx"
    portfolio_content = read_file(portfolio_file)
    
    backend_file = Path(__file__).parent / "start_quant_backend.py"
    backend_content = read_file(backend_file)
    
    print("1. 跳过逻辑检查:")
    
    # 检查是否有跳过AI分析的逻辑
    skip_patterns = [
        (r'news_data\s*is\s*None.*return', "新闻数据为空时返回"),
        (r'market_data\s*is\s*None.*return', "市场数据为空时返回"),
        (r'len\(.*\)\s*==\s*0.*return', "数据长度为0时返回"),
        (r'if not.*news.*return', "没有新闻时返回"),
        (r'if not.*data.*return', "没有数据时返回")
    ]
    
    found_skips = []
    for pattern, desc in skip_patterns:
        if re.search(pattern, backend_content, re.IGNORECASE):
            found_skips.append(desc)
    
    if found_skips:
        print("   • 找到跳过逻辑:")
        for skip in found_skips:
            print(f"     - {skip}")
    else:
        print("   • 未找到明显的跳过逻辑")
    
    print("\n2. 模拟/fallback数据检查:")
    
    # 检查模拟数据
    mock_patterns = [
        (r'Mock|mock', "模拟数据"),
        (r'generate_mock', "生成模拟数据"),
        (r'fallback.*data', "fallback数据"),
        (r'simulated.*data', "模拟数据")
    ]
    
    found_mocks = []
    for pattern, desc in mock_patterns:
        if re.search(pattern, backend_content, re.IGNORECASE):
            found_mocks.append(desc)
    
    if found_mocks:
        print("   • 找到模拟/fallback数据:")
        for mock in found_mocks:
            print(f"     - {mock}")
    else:
        print("   • 未找到模拟/fallback数据")
    
    print("\n3. 分批处理检查:")
    
    # 检查BATCH_SIZE
    if 'BATCH_SIZE' in portfolio_content:
        print("   • 使用BATCH_SIZE分批处理")
        
        # 检查批次间延迟
        if 'setTimeout.*resolve.*300' in portfolio_content:
            print("   • 批次间有300ms延迟")
    
    print("\n4. 错误静默处理检查:")
    
    # 检查是否静默返回null
    silent_patterns = [
        (r'return\s+null', "返回null"),
        (r'return\s+{}', "返回空对象"),
        (r'catch.*{.*return', "catch块中返回"),
        (r'except.*{.*return', "except块中返回")
    ]
    
    found_silent = []
    for pattern, desc in silent_patterns:
        if re.search(pattern, backend_content):
            found_silent.append(desc)
    
    if found_silent:
        print("   • 找到静默错误处理:")
        for silent in found_silent:
            print(f"     - {silent}")
    else:
        print("   • 未找到明显的静默错误处理")

def step5_analyze_empty_symbols():
    """第5步：分析空symbol原因"""
    print_header("第5步：分析空symbol原因")
    
    print("基于代码分析的失败阶段可能性:")
    print("-" * 40)
    
    stages = [
        ("market_data", "Alpaca/Finnhub市场数据获取", "高 - API限流或超时"),
        ("history_data", "历史数据获取", "中 - 数据不足或API失败"),
        ("company_info", "公司信息获取", "中 - Finnhub API可能失败"),
        ("news_data", "新闻数据获取", "高 - Finnhub新闻API限流"),
        ("prompt_build", "AI提示构建", "低 - 本地处理通常稳定"),
        ("ai_request", "AI API请求", "中 - DeepSeek API可能超时"),
        ("ai_response", "AI响应接收", "低 - 网络问题"),
        ("ai_parse", "AI结果解析", "低 - JSON解析通常稳定"),
        ("frontend_mapping", "前端数据映射", "低 - 类型转换问题"),
        ("frontend_render", "前端渲染", "低 - React渲染问题")
    ]
    
    for stage, desc, risk in stages:
        print(f