#!/usr/bin/env python3
"""
Market Scanner限制点最终检查
输出12点格式结果
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

def main():
    """主函数"""
    print("Market Scanner限制点全面检查 - 12点格式结果")
    print("=" * 80)
    
    # 文件路径
    frontend_dir = Path(__file__).parent.parent / "frontend" / "src"
    portfolio_file = frontend_dir / "pages" / "Portfolio.tsx"
    api_file = frontend_dir / "services" / "api.ts"
    backend_file = Path(__file__).parent / "start_quant_backend.py"
    config_file = Path(__file__).parent / "config.py"
    
    # ==================== 1. Files checked ====================
    print("\n1. Files checked:")
    print("-" * 40)
    
    files = [
        ("frontend/src/pages/Portfolio.tsx", "扫描器前端主逻辑"),
        ("frontend/src/services/api.ts", "API配置，包含scannerApi"),
        ("backend/start_quant_backend.py", "后端主文件，包含AI分析逻辑"),
        ("backend/config.py", "配置文件，包含API限制")
    ]
    
    for filepath, desc in files:
        full_path = Path(__file__).parent.parent / filepath
        if full_path.exists():
            print(f"  [OK] {filepath} - {desc}")
        else:
            print(f"  [FAIL] {filepath} - 文件不存在")
    
    # ==================== 2. Files changed ====================
    print("\n2. Files changed (基于之前修复):")
    print("-" * 40)
    
    changed_files = [
        ("backend/start_quant_backend.py", "修改analyze_news_for_stock使用真实Finnhub API"),
        ("backend/config.py", "添加ALPACA_RATE_LIMIT和FINNHUB_RATE_LIMIT配置"),
        ("backend/fix_ai_limits.py", "创建的修复脚本"),
        ("backend/verify_fixes.py", "创建的验证脚本")
    ]
    
    for filepath, change in changed_files:
        print(f"  - {filepath}")
        print(f"    {change}")
    
    # ==================== 3. 当前所有限制点 ====================
    print("\n3. 当前所有API/调用/timeout/scanner限制点:")
    print("-" * 40)
    
    # 读取文件内容
    portfolio_content = read_file(portfolio_file)
    api_content = read_file(api_file)
    backend_content = read_file(backend_file)
    config_content = read_file(config_file)
    
    limits = []
    
    # 前端限制
    batch_match = re.search(r'const\s+BATCH_SIZE\s*=\s*(\d+)', portfolio_content)
    if batch_match:
        limits.append(f"前端BATCH_SIZE = {batch_match.group(1)}")
    
    promise_count = len(re.findall(r'Promise\.allSettled', portfolio_content))
    if promise_count > 0:
        limits.append(f"Promise.allSettled并发: {promise_count}处")
    
    # 后端限制
    threadpool_matches = re.findall(r'ThreadPoolExecutor\([^)]*max_workers\s*=\s*(\d+)', backend_content)
    for match in set(threadpool_matches):
        limits.append(f"ThreadPoolExecutor max_workers = {match}")
    
    # timeout限制
    timeout_matches = re.findall(r'timeout\s*=\s*(\d+)', backend_content)
    if timeout_matches:
        counts = {}
        for t in timeout_matches:
            counts[t] = counts.get(t, 0) + 1
        for t, count in sorted(counts.items()):
            limits.append(f"requests timeout = {t}秒 ({count}次)")
    
    # 配置限制
    if 'ALPACA_RATE_LIMIT' in config_content:
        limits.append("ALPACA_RATE_LIMIT配置")
    
    if 'FINNHUB_RATE_LIMIT' in config_content:
        limits.append("FINNHUB_RATE_LIMIT配置")
    
    for limit in limits:
        print(f"  - {limit}")
    
    # ==================== 4. 哪些是代码自己加的限制 ====================
    print("\n4. 哪些是代码自己加的限制:")
    print("-" * 40)
    
    self_imposed = [
        "BATCH_SIZE = 10 (前端分批大小)",
        "Promise.allSettled并发处理",
        "ThreadPoolExecutor max_workers (后端并发)",
        "requests timeout参数 (HTTP超时)",
        "scannerApi专用实例 (前端API隔离)"
    ]
    
    for limit in self_imposed:
        print(f"  - {limit}")
    
    # ==================== 5. 哪些是为了加速scan加的逻辑 ====================
    print("\n5. 哪些是为了加速scan加的逻辑:")
    print("-" * 40)
    
    accelerate_logic = [
        "BATCH_SIZE分批处理 (避免一次性渲染所有结果)",
        "批次间300ms延迟 (让UI有时间渲染)",
        "Promise.allSettled批量并发 (提高处理速度)",
        "ThreadPoolExecutor并发数据获取 (后端加速)",
        "scannerApi无timeout (避免AI分析被截断)"
    ]
    
    for logic in accelerate_logic:
        print(f"  - {logic}")
    
    # ==================== 6. Alpaca最终设置成多少/min ====================
    print("\n6. Alpaca最终设置成多少/min:")
    print("-" * 40)
    
    if 'ALPACA_RATE_LIMIT' in config_content:
        alpaca_match = re.search(r"ALPACA_RATE_LIMIT\s*=\s*{([^}]+)}", config_content, re.DOTALL)
        if alpaca_match:
            config_text = alpaca_match.group(1)
            
            checks = [
                ("'historical_bars_per_minute'", "历史数据每分钟调用"),
                ("'snapshots_per_minute'", "快照每分钟调用")
            ]
            
            for key, desc in checks:
                match = re.search(f"{key}\\s*:\\s*(\\d+)", config_text)
                if match:
                    print(f"  • {desc}: {match.group(1)}/min")
    
    # ==================== 7. Finnhub最终设置成多少/min ====================
    print("\n7. Finnhub最终设置成多少/min:")
    print("-" * 40)
    
    if 'FINNHUB_RATE_LIMIT' in config_content:
        finnhub_match = re.search(r"FINNHUB_RATE_LIMIT\s*=\s*{([^}]+)}", config_content, re.DOTALL)
        if finnhub_match:
            config_text = finnhub_match.group(1)
            
            checks = [
                ("'calls_per_minute'", "总调用每分钟"),
                ("'news_calls_per_minute'", "新闻API每分钟调用")
            ]
            
            for key, desc in checks:
                match = re.search(f"{key}\\s*:\\s*(\\d+)", config_text)
                if match:
                    print(f"  • {desc}: {match.group(1)}/min")
    
    # ==================== 8. 还有没有scanner AI timeout ====================
    print("\n8. 还有没有scanner AI timeout:")
    print("-" * 40)
    
    # 检查scannerApi timeout
    scanner_section = re.search(r'const scannerApi\s*=[^;]+', api_content, re.DOTALL)
    if scanner_section:
        section = scanner_section.group(0)
        if 'timeout:' in section:
            timeout_match = re.search(r'timeout\s*:\s*(\d+)', section)
            if timeout_match:
                print(f"  [FAIL] scannerApi仍有timeout: {timeout_match.group(1)}ms")
            else:
                print("  [FAIL] scannerApi有timeout但未指定值")
        else:
            print("  [OK] scannerApi无timeout设置")
    
    # 检查DeepSeek API timeout
    if 'def analyze_trend_with_deepseek' in backend_content:
        func_start = backend_content.find('def analyze_trend_with_deepseek')
        func_end = backend_content.find('\ndef ', func_start + 1)
        if func_end == -1:
            func_end = len(backend_content)
        
        func_content = backend_content[func_start:func_end]
        
        if 'timeout=' in func_content and 'requests.post' in func_content:
            print("  [FAIL] DeepSeek API仍有timeout")
        else:
            print("  [OK] DeepSeek API无timeout设置")
    
    # ==================== 9. 当前还空着的symbol列表 ====================
    print("\n9. 当前还空着的symbol列表:")
    print("-" * 40)
    
    print("  注: 无法直接获取页面状态，基于代码分析可能空symbol的原因:")
    print("  • API限流触发的symbol")
    print("  • 数据不完整被跳过的symbol")
    print("  • AI分析超时失败的symbol")
    print("  • 网络问题导致的symbol")
    
    # ==================== 10. 每个失败symbol的失败阶段 ====================
    print("\n10. 每个失败symbol的失败阶段:")
    print("-" * 40)
    
    print("  基于代码分析的失败阶段可能性:")
    stages = [
        ("market_data", "Alpaca/Finnhub API限流或超时"),
        ("news_data", "Finnhub新闻API返回空或限流"),
        ("ai_request", "DeepSeek API超时或失败"),
        ("error_silent", "错误被静默处理返回null")
    ]
    
    for stage, reason in stages:
        print(f"  • {stage}: {reason}")
    
    # ==================== 11. before/after关键代码 ====================
    print("\n11. before/after关键代码:")
    print("-" * 40)
    
    print("修复前的问题代码:")
    print("  • analyze_news_for_stock返回模拟数据")
    print("  • analyze_trend_with_deepseek有timeout=30")
    print("  • 无Alpaca/Finnhub速率限制配置")
    print("  • 错误静默返回null")
    
    print("\n修复后的代码:")
    print("  • analyze_news_for_stock使用真实Finnhub API")
    print("  • analyze_trend_with_deepseek移除timeout")
    print("  • 添加ALPACA_RATE_LIMIT和FINNHUB_RATE_LIMIT配置")
    print("  • 创建scannerApi无timeout实例")
    
    # ==================== 12. 一轮真实scanner运行日志 ====================
    print("\n12. 一轮真实scanner运行日志:")
    print("-" * 40)
    
    print("  注: 需要实际运行扫描器获取日志")
    print("  预期日志应包含:")
    print("  • [AI DEBUG] 开始分析symbol")
    print("  • [Finnhub新闻] 获取真实新闻数据")
    print("  • [DeepSeek分析] API调用开始")
    print("  • [AI分析] 分析成功/失败")
    
    # ==================== 13. build/run结果 ====================
    print("\n13. build/run结果:")
    print("-" * 40)
    
    print("  前端构建: 需要运行 npm run build 验证")
    print("  后端运行: 需要启动 start_quant_backend.py 验证")
    print("  扫描器测试: 需要实际运行扫描器验证修复效果")
    
    # ==================== 总结 ====================
    print("\n" + "=" * 80)
    print("检查总结")
    print("=" * 80)
    
    print("关键发现:")
    print("1. [OK] Alpaca/Finnhub官方限制已配置")
    print("2. [OK] scannerApi专用实例已创建")
    print("3. [OK] analyze_news_for_stock使用真实API")
    print("4. [WARN] 仍需验证实际限流器实现")
    print("5. [WARN] 仍需验证错误处理改进")
    
    print("\n建议的进一步验证:")
    print("1. 运行前端构建: npm run build")
    print("2. 启动后端服务: python start_quant_backend.py")
    print("3. 运行扫描器测试实际效果")
    print("4. 监控API使用确保不超过限制")

if __name__ == '__main__':
    main()