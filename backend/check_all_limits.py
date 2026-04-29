#!/usr/bin/env python3
"""
全面检查Market Scanner链路中的所有限制点
按照要求的6个步骤进行系统化检查
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

def step1_find_all_limits():
    """第1步：找出所有限制点"""
    print("=" * 80)
    print("第1步：找出所有限制点")
    print("=" * 80)
    
    # 前端文件
    frontend_dir = Path(__file__).parent.parent / "frontend" / "src"
    portfolio_file = frontend_dir / "pages" / "Portfolio.tsx"
    api_file = frontend_dir / "services" / "api.ts"
    
    # 后端文件
    backend_dir = Path(__file__).parent
    backend_file = backend_dir / "start_quant_backend.py"
    config_file = backend_dir / "config.py"
    
    limits_found = {
        "batch_size": [],
        "symbol_limit": [],
        "frontend_concurrency": [],
        "backend_concurrency": [],
        "promise_all": [],
        "threadpool": [],
        "timeout": [],
        "abort_controller": [],
        "promise_race": [],
        "axios_timeout": [],
        "requests_timeout": [],
        "rate_limiter": [],
        "sleep_backoff": [],
        "retry_count": [],
        "error_429": [],
        "skip_ai_on_incomplete_data": [],
        "skip_ai_on_no_news": [],
        "skip_ai_on_insufficient_history": [],
        "accelerate_scan_logic": [],
        "mock_fallback": []
    }
    
    # 检查前端Portfolio.tsx
    print("\n1. 检查前端Portfolio.tsx...")
    content = read_file_content(portfolio_file)
    
    # BATCH_SIZE
    batch_match = re.search(r'const\s+BATCH_SIZE\s*=\s*(\d+)', content)
    if batch_match:
        limits_found["batch_size"].append(f"前端BATCH_SIZE = {batch_match.group(1)} (Portfolio.tsx)")
    
    # Promise.allSettled
    promise_matches = re.findall(r'Promise\.(allSettled|all|race)', content)
    for match in promise_matches:
        limits_found["promise_all"].append(f"Promise.{match} (Portfolio.tsx)")
    
    # timeout
    timeout_matches = re.findall(r'setTimeout|clearTimeout', content)
    if timeout_matches:
        limits_found["timeout"].append(f"setTimeout/clearTimeout (Portfolio.tsx)")
    
    # skip logic
    skip_patterns = [
        (r'fallbackMarketScan', "fallback逻辑"),
        (r'analysisStatus.*===.*["\']failed["\']', "失败状态处理"),
        (r'trendLabel.*null', "null趋势标签")
    ]
    
    for pattern, desc in skip_patterns:
        if re.search(pattern, content):
            limits_found["skip_ai_on_incomplete_data"].append(f"{desc} (Portfolio.tsx)")
    
    # 检查前端api.ts
    print("\n2. 检查前端api.ts...")
    api_content = read_file_content(api_file)
    
    # axios timeout
    timeout_match = re.search(r'timeout\s*:\s*(\d+)', api_content)
    if timeout_match:
        limits_found["axios_timeout"].append(f"axios timeout = {timeout_match.group(1)}ms (api.ts)")
    
    # scannerApi
    if 'scannerApi' in api_content:
        limits_found["accelerate_scan_logic"].append("专用scannerApi实例 (api.ts)")
    
    # 检查后端start_quant_backend.py
    print("\n3. 检查后端start_quant_backend.py...")
    backend_content = read_file_content(backend_file)
    
    # ThreadPoolExecutor
    threadpool_matches = re.findall(r'ThreadPoolExecutor\([^)]*max_workers\s*=\s*(\d+)[^)]*\)', backend_content)
    for match in threadpool_matches:
        limits_found["threadpool"].append(f"ThreadPoolExecutor max_workers = {match} (start_quant_backend.py)")
    
    # requests timeout
    timeout_matches = re.findall(r'timeout\s*=\s*(\d+)', backend_content)
    unique_timeouts = set(timeout_matches)
    for timeout in unique_timeouts:
        count = timeout_matches.count(timeout)
        limits_found["requests_timeout"].append(f"requests timeout = {timeout}秒 (出现{count}次)")
    
    # sleep/backoff
    sleep_matches = re.findall(r'time\.sleep|sleep\(|backoff', backend_content, re.IGNORECASE)
    if sleep_matches:
        limits_found["sleep_backoff"].append("sleep/backoff逻辑 (start_quant_backend.py)")
    
    # retry
    retry_matches = re.findall(r'retry|Retry', backend_content)
    if retry_matches:
        limits_found["retry_count"].append("重试逻辑 (start_quant_backend.py)")
    
    # 429处理
    if '429' in backend_content or 'rate limit' in backend_content.lower():
        limits_found["error_429"].append("429限流处理 (start_quant_backend.py)")
    
    # skip AI逻辑
    skip_patterns_backend = [
        (r'news_data\s*is\s*None', "新闻数据为空时跳过"),
        (r'market_data\s*is\s*None', "市场数据为空时跳过"),
        (r'analyze_news_for_stock', "新闻分析函数"),
        (r'mock|Mock', "模拟数据")
    ]
    
    for pattern, desc in skip_patterns_backend:
        if re.search(pattern, backend_content):
            limits_found["skip_ai_on_incomplete_data"].append(f"{desc} (start_quant_backend.py)")
    
    # 检查配置文件
    print("\n4. 检查配置文件config.py...")
    config_content = read_file_content(config_file)
    
    # rate limiter配置
    if 'ALPACA_RATE_LIMIT' in config_content:
        limits_found["rate_limiter"].append("Alpaca速率限制配置 (config.py)")
    
    if 'FINNHUB_RATE_LIMIT' in config_content:
        limits_found["rate_limiter"].append("Finnhub速率限制配置 (config.py)")
    
    # 输出结果
    print("\n" + "=" * 80)
    print("发现的限制点汇总")
    print("=" * 80)
    
    for category, items in limits_found.items():
        if items:
            print(f"\n{category.upper()}:")
            for item in items:
                print(f"  • {item}")
    
    return limits_found

def step2_check_api_limits():
    """第2步：检查Alpaca/Finnhub调用限制实现"""
    print("\n" + "=" * 80)
    print("第2步：检查Alpaca/Finnhub调用限制实现")
    print("=" * 80)
    
    config_file = Path(__file__).parent / "config.py"
    config_content = read_file_content(config_file)
    
    findings = {
        "alpaca_limiter": {"exists": False, "config": None, "issues": []},
        "finnhub_limiter": {"exists": False, "config": None, "issues": []},
        "implementation": {"alpaca": [], "finnhub": []}
    }
    
    # 检查Alpaca限制配置
    alpaca_match = re.search(r'ALPACA_RATE_LIMIT\s*=\s*({[^}]+})', config_content, re.DOTALL)
    if alpaca_match:
        findings["alpaca_limiter"]["exists"] = True
        findings["alpaca_limiter"]["config"] = alpaca_match.group(1)
        print("[找到] Alpaca速率限制配置")
        
        # 解析配置值
        config_text = alpaca_match.group(1)
        historical_match = re.search(r"'historical_bars_per_minute'\s*:\s*(\d+)", config_text)
        if historical_match:
            value = int(historical_match.group(1))
            if value == 200:
                print(f"  ✓ historical_bars_per_minute = {value} (符合官方200/min)")
            else:
                print(f"  ✗ historical_bars_per_minute = {value} (应为200)")
                findings["alpaca_limiter"]["issues"].append(f"historical_bars_per_minute应为200，实际为{value}")
    
    else:
        print("[未找到] Alpaca速率限制配置")
        findings["alpaca_limiter"]["issues"].append("未配置Alpaca速率限制")
    
    # 检查Finnhub限制配置
    finnhub_match = re.search(r'FINNHUB_RATE_LIMIT\s*=\s*({[^}]+})', config_content, re.DOTALL)
    if finnhub_match:
        findings["finnhub_limiter"]["exists"] = True
        findings["finnhub_limiter"]["config"] = finnhub_match.group(1)
        print("[找到] Finnhub速率限制配置")
        
        # 解析配置值
        config_text = finnhub_match.group(1)
        calls_match = re.search(r"'calls_per_minute'\s*:\s*(\d+)", config_text)
        if calls_match:
            value = int(calls_match.group(1))
            if value == 60:
                print(f"  ✓ calls_per_minute = {value} (符合官方60/min)")
            else:
                print(f"  ✗ calls_per_minute = {value} (应为60)")
                findings["finnhub_limiter"]["issues"].append(f"calls_per_minute应为60，实际为{value}")
    
    else:
        print("[未找到] Finnhub速率限制配置")
        findings["finnhub_limiter"]["issues"].append("未配置Finnhub速率限制")
    
    # 检查后端实现
    backend_file = Path(__file__).parent / "start_quant_backend.py"
    backend_content = read_file_content(backend_file)
    
    # 检查是否有实际的限流器实现
    limiter_patterns = [
        (r'rate.*limit|ratelimit', "通用限流器"),
        (r'429.*retry|retry.*429', "429重试"),
        (r'sleep.*\d+.*requests', "请求间sleep"),
        (r'backoff', "退避算法")
    ]
    
    for pattern, desc in limiter_patterns:
        if re.search(pattern, backend_content, re.IGNORECASE):
            findings["implementation"]["alpaca"].append(desc)
            findings["implementation"]["finnhub"].append(desc)
    
    print("\n实现检查:")
    if findings["implementation"]["alpaca"]:
        print("  ✓ 找到限流实现:", ", ".join(findings["implementation"]["alpaca"]))
    else:
        print("  ✗ 未找到实际的限流器实现")
        findings["alpaca_limiter"]["issues"].append("代码中无实际限流器实现")
        findings["finnhub_limiter"]["issues"].append("代码中无实际限流器实现")
    
    return findings

def step3_check_all_timeouts():
    """第3步：检查所有timeout"""
    print("\n" + "=" * 80)
    print("第3步：检查所有timeout")
    print("=" * 80)
    
    findings = {
        "frontend_scanner_timeout": [],
        "scanner_axios_timeout": [],
        "analyzeTrend_timeout": [],
        "processSingleSymbol_timeout": [],
        "promise_race_timeout": [],
        "abort_controller_timeout": [],
        "backend_deepseek_timeout": [],
        "backend_alpaca_timeout": [],
        "backend_finnhub_timeout": []
    }
    
    # 检查前端
    frontend_dir = Path(__file__).parent.parent / "frontend" / "src"
    portfolio_file = frontend_dir / "pages" / "Portfolio.tsx"
    api_file = frontend_dir / "services" / "api.ts"
    
    portfolio_content = read_file_content(portfolio_file)
    api_content = read_file_content(api_file)
    
    # 1. 前端scanner API timeout
    if 'scannerApi' in api_content:
        scanner_section = re.search(r'const scannerApi\s*=[^;]+', api_content, re.DOTALL)
        if scanner_section:
            section = scanner_section.group(0)
            if 'timeout:' in section:
                timeout_match = re.search(r'timeout\s*:\s*(\d+)', section)
                if timeout_match:
                    findings["scanner_axios_timeout"].append(f"scannerApi timeout = {timeout_match.group(1)}ms")
                else:
                    findings["scanner_axios_timeout"].append("scannerApi有timeout但未指定值")
            else:
                findings["scanner_axios_timeout"].append("scannerApi无timeout设置 ✓")
    
    # 2. analyzeTrend timeout
    analyze_pattern = r'async function analyzeTrend|const analyzeTrend.*=.*async'
    if re.search(analyze_pattern, portfolio_content):
        # 检查函数内是否有timeout逻辑
        func_start = portfolio_content.find('async function analyzeTrend')
        if func_start == -1:
            func_start = portfolio_content.find('const analyzeTrend = async')
        
        if func_start != -1:
            # 简单查找函数内的timeout相关代码
            func_section = portfolio_content[func_start:func_start+2000]
            if 'setTimeout' in func_section or 'AbortController' in func_section:
                findings["analyzeTrend_timeout"].append("analyzeTrend函数内有timeout逻辑")
            else:
                findings["analyzeTrend_timeout"].append("analyzeTrend函数内无timeout逻辑 ✓")
    
    # 3. Promise.race timeout
    if 'Promise.race' in portfolio_content:
        findings["promise_race_timeout"].append("使用Promise.race可能有timeout")
    
    # 4. AbortController
    if 'AbortController' in portfolio_content:
        findings["abort_controller_timeout"].append("使用AbortController可能有timeout")
    
    # 检查后端
    backend_file = Path(__file__).parent / "start_quant_backend.py"
    backend_content = read_file_content(backend_file)
    
    # 5. 后端DeepSeek timeout
    deepseek_pattern = r'def analyze_trend_with_deepseek'
    deepseek_start = backend_content.find('def analyze_trend_with_deepseek')
    if deepseek_start != -1:
        # 查找函数定义结束
        func_end = backend_content.find('\ndef ', deepseek_start + 1)
        if func_end == -1:
            func_end = len(backend_content)
        
        func_section = backend_content[deepseek_start:func_end]
        
        # 检查requests.post调用
        post_matches = re.findall(r'requests\.post\([^)]+\)', func_section)
        for post_call in post_matches:
            if 'timeout=' in post_call:
                timeout_match = re.search(r'timeout\s*=\s*(\d+)', post_call)
                if timeout_match:
                    findings["backend_deepseek_timeout"].append(f"DeepSeek API timeout = {timeout_match.group(1)}秒")
                else:
                    findings["backend_deepseek_timeout"].append("DeepSeek API有timeout但未指定值")
            else:
                findings["backend_deepseek_timeout"].append("DeepSeek API无timeout设置 ✓")
    
    # 6. Alpaca API timeout
    alpaca_timeouts = re.findall(r'requests\.get\([^)]*alpaca[^)]*timeout\s*=\s*(\d+)', backend_content, re.IGNORECASE)
    if alpaca_timeouts:
        unique_timeouts = set(alpaca_timeouts)
        for timeout in unique_timeouts:
            findings["backend_alpaca_timeout"].append(f"Alpaca API timeout = {timeout}秒")
    else:
        findings["backend_alpaca_timeout"].append("未找到Alpaca API timeout设置")
    
    # 7. Finnhub API timeout
    finnhub_timeouts = re.findall(r'requests\.get\([^)]*finnhub[^)]*timeout\s*=\s*(\d+)', backend_content, re.IGNORECASE)
    if finnhub_timeouts:
        unique_timeouts = set(finnhub_timeouts)
        for timeout in unique_timeouts:
            findings["backend_finnhub_timeout"].append(f"Finnhub API timeout = {timeout}秒")
    else:
        # 查找所有包含finnhub的requests调用
        finnhub_calls = re.findall(r'requests\.(?:get|post)\([^)]*finnhub[^)]*\)', backend_content, re.IGNORECASE)
        for call in finnhub_calls:
            if 'timeout=' in call:
                timeout_match = re.search(r'timeout\s*=\s*(\d+)', call)
                if timeout_match:
                    findings["backend_finnhub_timeout"].append(f"Finnhub API timeout = {timeout