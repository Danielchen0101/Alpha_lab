#!/usr/bin/env python3
"""
运行全面的Market Scanner限制检查
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

def main():
    """主函数"""
    print("Market Scanner限制点全面检查")
    print("=" * 80)
    
    # 文件路径
    frontend_dir = Path(__file__).parent.parent / "frontend" / "src"
    portfolio_file = frontend_dir / "pages" / "Portfolio.tsx"
    api_file = frontend_dir / "services" / "api.ts"
    backend_file = Path(__file__).parent / "start_quant_backend.py"
    config_file = Path(__file__).parent / "config.py"
    
    # 检查文件是否存在
    files_exist = {
        "Portfolio.tsx": portfolio_file.exists(),
        "api.ts": api_file.exists(),
        "start_quant_backend.py": backend_file.exists(),
        "config.py": config_file.exists()
    }
    
    print("文件检查:")
    for file, exists in files_exist.items():
        status = "✓" if exists else "✗"
        print(f"  {status} {file}")
    
    if not all(files_exist.values()):
        print("\n错误: 部分文件不存在，无法继续检查")
        return
    
    # ==================== 第1步：找出所有限制点 ====================
    print_header("第1步：找出所有限制点")
    
    all_limits = {}
    
    # 1. 前端限制点
    print("1. 前端限制点:")
    portfolio_content = read_file(portfolio_file)
    api_content = read_file(api_file)
    
    # BATCH_SIZE
    batch_match = re.search(r'const\s+BATCH_SIZE\s*=\s*(\d+)', portfolio_content)
    if batch_match:
        print(f"   • BATCH_SIZE = {batch_match.group(1)} (代码自设限制)")
        all_limits["batch_size"] = {"value": batch_match.group(1), "type": "code", "purpose": "分批渲染"}
    
    # Promise.allSettled并发
    promise_count = len(re.findall(r'Promise\.allSettled', portfolio_content))
    if promise_count > 0:
        print(f"   • Promise.allSettled: {promise_count}处 (代码自设并发)")
        all_limits["promise_concurrency"] = {"value": promise_count, "type": "code", "purpose": "批量并发处理"}
    
    # scannerApi专用实例
    if 'scannerApi' in api_content:
        scanner_section = re.search(r'const scannerApi\s*=[^;]+', api_content, re.DOTALL)
        if scanner_section:
            section = scanner_section.group(0)
            if 'timeout:' in section:
                timeout_match = re.search(r'timeout\s*:\s*(\d+)', section)
                if timeout_match:
                    print(f"   • scannerApi timeout = {timeout_match.group(1)}ms (代码自设超时)")
                    all_limits["scanner_timeout"] = {"value": timeout_match.group(1), "type": "code", "purpose": "API调用超时"}
                else:
                    print("   • scannerApi有timeout但未指定值")
            else:
                print("   • scannerApi无timeout设置 (已修复)")
    
    # 2. 后端限制点
    print("\n2. 后端限制点:")
    backend_content = read_file(backend_file)
    
    # ThreadPoolExecutor并发
    threadpool_matches = re.findall(r'ThreadPoolExecutor\([^)]*max_workers\s*=\s*(\d+)', backend_content)
    if threadpool_matches:
        workers = set(threadpool_matches)
        for w in workers:
            print(f"   • ThreadPoolExecutor max_workers = {w} (代码自设并发)")
            all_limits[f"threadpool_workers_{w}"] = {"value": w, "type": "code", "purpose": "线程池并发"}
    
    # requests timeout
    timeout_matches = re.findall(r'timeout\s*=\s*(\d+)', backend_content)
    if timeout_matches:
        timeout_counts = {}
        for t in timeout_matches:
            timeout_counts[t] = timeout_counts.get(t, 0) + 1
        
        for t, count in sorted(timeout_counts.items()):
            print(f"   • requests timeout = {t}秒 (出现{count}次) (代码自设超时)")
            all_limits[f"requests_timeout_{t}s"] = {"value": t, "type": "code", "purpose": "HTTP请求超时"}
    
    # 3. 配置限制点
    print("\n3. 配置限制点:")
    config_content = read_file(config_file)
    
    # Alpaca限制
    alpaca_match = re.search(r'ALPACA_RATE_LIMIT\s*=\s*{([^}]+)}', config_content, re.DOTALL)
    if alpaca_match:
        config_text = alpaca_match.group(1)
        print("   • ALPACA_RATE_LIMIT配置 (官方限制调整)")
        
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
                print(f"     {status} {desc}: {value}")
                all_limits[f"alpaca_{key}"] = {"value": value, "type": "config", "purpose": f"Alpaca {desc}"}
    
    # Finnhub限制
    finnhub_match = re.search(r'FINNHUB_RATE_LIMIT\s*=\s*{([^}]+)}', config_content, re.DOTALL)
    if finnhub_match:
        config_text = finnhub_match.group(1)
        print("   • FINNHUB_RATE_LIMIT配置 (官方限制调整)")
        
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
                print(f"     {status} {desc}: {value}")
                all_limits[f"finnhub_{key}"] = {"value": value, "type": "config", "purpose": f"Finnhub {desc}"}
    
    # ==================== 第2步：检查API限制实现 ====================
    print_header("第2步：检查API限制实现")
    
    print("1. 实际限流器实现检查:")
    
    # 检查是否有实际的限流逻辑
    limiter_patterns = [
        (r'rate.*limit.*implement', "速率限制器实现"),
        (r'class.*RateLimiter', "RateLimiter类"),
        (r'def.*rate_limit', "rate_limit函数"),
        (r'429.*handle|handle.*429', "429错误处理"),
        (r'retry.*after.*429', "429后重试")
    ]
    
    found_limiters = []
    for pattern, desc in limiter_patterns:
        if re.search(pattern, backend_content, re.IGNORECASE):
            found_limiters.append(desc)
    
    if found_limiters:
        print("   • 找到限流器实现:")
        for limiter in found_limiters:
            print(f"     - {limiter}")
    else:
        print("   • 未找到实际的限流器实现")
        print("   • 问题: 配置了限制但没有实际限流逻辑")
    
    print("\n2. 限流配置与实际调用匹配检查:")
    
    # 检查是否有批量调用可能触发限流
    batch_call_patterns = [
        (r'for.*symbol.*in.*symbols', "循环调用多个symbol"),
        (r'ThreadPoolExecutor.*submit', "并发提交任务"),
        (r'batch.*process', "批量处理")
    ]
    
    found_batch = []
    for pattern, desc in batch_call_patterns:
        if re.search(pattern, backend_content, re.IGNORECASE):
            found_batch.append(desc)
    
    if found_batch:
        print("   • 找到批量/并发调用:")
        for batch in found_batch:
            print(f"     - {batch}")
        print("   • 风险: 可能快速触发API限流")
    
    # ==================== 第3步：检查所有timeout ====================
    print_header("第3步：检查所有timeout")
    
    print("1. scanner专用timeout检查:")
    
    # 检查scannerApi timeout
    scanner_section = re.search(r'const scannerApi\s*=[^;]+', api_content, re.DOTALL)
    if scanner_section:
        section = scanner_section.group(0)
        if 'timeout:' in section:
            timeout_match = re.search(r'timeout\s*:\s*(\d+)', section)
            if timeout_match:
                timeout_val = int(timeout_match.group(1))
                if timeout_val > 0:
                    print(f"   • scannerApi timeout = {timeout_val}ms ✗ (应移除)")
                else:
                    print(f"   • scannerApi timeout = {timeout_val}ms ✓ (已修复)")
            else:
                print("   • scannerApi有timeout但未指定值")
        else:
            print("   • scannerApi无timeout设置 ✓ (已修复)")
    
    print("\n2. AI分析timeout检查:")
    
    # 检查DeepSeek API timeout
    if 'def analyze_trend_with_deepseek' in backend_content:
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
                    print(f"   • DeepSeek API timeout = {timeout_match.group(1)}秒 ✗ (应移除)")
                else:
                    print("   • DeepSeek API有timeout但未指定值")
            else:
                print("   • DeepSeek API无timeout设置 ✓ (已修复)")
    
    print("\n3. 其他API timeout统计:")
    
    # 统计所有timeout
    all_timeouts = re.findall(r'timeout\s*=\s*(\d+)', backend_content)
    if all_timeouts:
        counts = {}
        for t in all_timeouts:
            counts[t] = counts.get(t, 0) + 1
        
        print("   后端所有timeout设置:")
        for t, count in sorted(counts.items()):
            print(f"     • {t}秒: {count}次")
    
    # ==================== 第4步：检查加速scan逻辑 ====================
    print_header("第4步：检查加速scan逻辑")
    
    print("1. 跳过AI分析逻辑检查:")
    
    skip_patterns = [
        (r'if not news_data.*return', "新闻数据为空时跳过"),
        (r'if market_data is None.*return', "市场数据为空时跳过"),
        (r'if len\(.*\) == 0.*return', "数据为空时跳过"),
        (r'except.*return.*null', "异常时返回null"),
        (r'except.*return.*{}', "异常时返回空对象")
    ]
    
    found_skips = []
    for pattern, desc in skip_patterns:
        if re.search(pattern, backend_content, re.IGNORECASE):
            found_skips.append(desc)
    
    if found_skips:
        print("   • 找到跳过逻辑 (可能导致空symbol):")
        for skip in found_skips:
            print(f"     - {skip}")
    else:
        print("   • 未找到明显的跳过逻辑")
    
    print("\n2. 模拟/fallback数据检查:")
    
    mock_patterns = [
        (r'newsSource.*["\']Mock["\']', "模拟新闻数据"),
        (r'generate_mock', "生成模拟数据"),
        (r'isMockData.*True', "模拟数据标记"),
        (r'fallback.*scan', "fallback扫描")
    ]
    
    found_mocks = []
    for pattern, desc in mock_patterns:
        if re.search(pattern, backend_content + portfolio_content, re.IGNORECASE):
            found_mocks.append(desc)
    
    if found_mocks:
        print("   • 找到模拟/fallback逻辑:")
        for mock in found_mocks:
            print(f"     - {mock}")
    else:
        print("   • 未找到模拟/fallback逻辑")
    
    print("\n3. 分批和延迟逻辑检查:")
    
    # 检查BATCH_SIZE
    if 'BATCH_SIZE' in portfolio_content:
        print("   • 使用BATCH_SIZE分批处理")
        
        # 检查批次间延迟
        if 'setTimeout.*resolve.*300' in portfolio_content:
            print("   • 批次间有300ms延迟 (UI渲染优化)")
    
    # ==================== 第5步：分析空symbol原因 ====================
    print_header("第5步：分析空symbol原因")
    
    print("基于代码分析的空symbol可能原因:")
    print("-" * 40)
    
    reasons = [
        ("API限流", "高", "Alpaca/Finnhub免费层限制被触发"),
        ("超时中断", "中", "AI分析被timeout截断"),
        ("数据不完整跳过", "中", "缺少某些数据时直接跳过AI分析"),
        ("错误静默处理", "中", "API失败返回null，前端显示N/A"),
        ("并发过高", "中", "Promise.allSettled并发触发provider限流"),
        ("网络问题", "低", "临时网络故障"),
        ("配置错误", "低", "API密钥无效或配置错误")
    ]
    
    for reason, probability, detail in reasons:
        print(f"  • {reason} ({probability}): {detail}")
    
    # ==================== 第6步：最小修复建议 ====================
    print_header("第6步：最小修复建议")
    
    print("建议的最小修复:")
    print("-" * 40)
    
    fixes = []
    
    # 1. 确保scannerApi无timeout
    scanner_section = re.search(r'const scannerApi\s*=[^;]+', api_content, re.DOTALL)
    if scanner_section and 'timeout:' in scanner_section.group(0):
        fixes.append("移除scannerApi的timeout设置")
    
    # 2. 确保DeepSeek API无timeout
    if 'def analyze_trend_with_deepseek' in backend_content:
        func_content = backend_content[backend_content.find('def analyze_trend_with_deepseek'):]
        if 'timeout=' in func_content and 'requests.post' in func_content:
            fixes.append("移除analyze_trend_with_deepseek中的DeepSeek API timeout")
    
    # 3. 添加实际限流器
    if not re.search(r'rate.*limit.*implement|class.*RateLimiter', backend_content, re.IGNORECASE):
        fixes.append("添加实际的API限流器实现")
    
    # 4. 修改跳过逻辑
    skip_pattern = r'if not news_data.*return|if market_data is None.*return'
    if re.search(skip_pattern, backend_content, re.IGNORECASE):
        fixes.append("修改跳过逻辑: 数据不完整时尝试降级分析，而非直接跳过")
    
    # 5. 改进错误处理
    if re.search(r'except.*return.*null|except.*return.*{}', backend_content):
        fixes.append("改进错误处理: 返回包含失败阶段信息的对象，而非null/空对象")
    
    for i, fix in enumerate(fixes, 1):
        print(f"{i}. {fix}")
    
    print("\n修复原则:")
    print("  • 只改scanner直接相关代码")
    print("  • 不改UI")
    print("  • 不改scanner之外的模块")
    print("  • 保持向后兼容")
    
    # ==================== 最终输出 ====================
    print_header("检查完成")
    
    print("关键发现总结:")
    print("-" * 40)
    
    summary = [
        ("配置限制", "Alpaca/Finnhub官方限制已配置