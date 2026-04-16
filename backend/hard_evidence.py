#!/usr/bin/env python3
"""
获取硬证据：直接调用API获取原始响应
"""

import sys
import os
import json
import time
import requests
from datetime import datetime

def get_raw_ai_response(symbol):
    """获取symbol的原始AI分析响应"""
    print(f"\n获取 {symbol} 的原始AI分析响应...")
    
    base_url = "http://localhost:8889"
    
    try:
        # 直接调用AI分析API
        response = requests.post(
            f"{base_url}/ai/analyze/single",
            json={"symbol": symbol},
            timeout=30
        )
        
        print(f"状态码: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            
            # 提取关键证据字段
            evidence = {
                'symbol': symbol,
                'success': data.get('success'),
                'analysisSource': data.get('analysisSource', 'unknown'),
                'provenance': data.get('provenance', 'unknown'),
                'trend': data.get('trend'),
                'overallScore': data.get('overallScore'),
                'confidence': data.get('confidence'),
                'volumeStatus': data.get('volumeStatus'),
                'aiReasoning': data.get('aiReasoning', '')[:200] + '...' if data.get('aiReasoning') else None,
                'conciseReasoning': data.get('conciseReasoning', '')[:200] + '...' if data.get('conciseReasoning') else None,
                'error': data.get('error'),
                'timestamp': data.get('timestamp'),
                'hasDeepSeekCall': 'deepseek' in str(data.get('analysisSource', '')).lower() or 'deepseek' in str(data.get('provenance', '')).lower(),
                'hasLocalFallback': 'local' in str(data.get('analysisSource', '')).lower() or 'local' in str(data.get('provenance', '')).lower()
            }
            
            print(f"成功: {evidence['success']}")
            print(f"分析来源: {evidence['analysisSource']}")
            print(f"Provenance: {evidence['provenance']}")
            print(f"趋势: {evidence['trend']}")
            print(f"分数: {evidence['overallScore']}")
            print(f"置信度: {evidence['confidence']}")
            
            if evidence['success']:
                if evidence['hasDeepSeekCall']:
                    print(f"[证据] 来自 DeepSeek AI 分析")
                elif evidence['hasLocalFallback']:
                    print(f"[证据] 来自本地规则 (fallback)")
                else:
                    print(f"[证据] 来源未知")
            else:
                print(f"[证据] AI分析失败")
                print(f"错误: {evidence['error']}")
            
            return evidence
        else:
            print(f"API错误: {response.text[:200]}")
            return {
                'symbol': symbol,
                'api_error': True,
                'status_code': response.status_code,
                'error': response.text[:200]
            }
            
    except Exception as e:
        print(f"[错误] 异常: {str(e)}")
        return {
            'symbol': symbol,
            'exception': True,
            'error': str(e)
        }

def check_backend_direct_logs():
    """直接检查后端控制台输出"""
    print(f"\n{'='*60}")
    print("检查后端实时日志")
    print(f"{'='*60}")
    
    # 尝试从后端进程获取最新日志
    try:
        # 发送一个测试请求触发日志
        test_response = requests.post(
            "http://localhost:8889/ai/analyze/single",
            json={"symbol": "TEST"},
            timeout=5
        )
        print(f"测试请求状态码: {test_response.status_code}")
    except:
        print("无法发送测试请求")
    
    print("\n[提示] 需要查看后端控制台的真实日志输出")
    print("请检查运行后端的终端窗口，查找以下关键词:")
    print("  - 'analyze_trend_with_deepseek'")
    print("  - 'DeepSeek API调用'")
    print("  - 'analysisSource'")
    print("  - 'fallback' 或 '本地分析'")

def main():
    """主函数"""
    print("硬证据获取脚本")
    print(f"开始时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # 检查后端是否运行
    try:
        response = requests.get("http://localhost:8889/api/status", timeout=5)
        if response.status_code == 200:
            print("[状态] 后端服务正常运行")
        else:
            print(f"[错误] 后端服务返回错误: {response.status_code}")
            return
    except Exception as e:
        print(f"[错误] 无法连接到后端服务: {str(e)}")
        return
    
    # A. 获取成功样本的Provenance证据
    print(f"\n{'#'*60}")
    print("A. 成功样本的Provenance证据")
    print(f"{'#'*60}")
    
    success_symbols = ['AAPL', 'MSFT', 'AMZN']
    success_evidence = {}
    
    for symbol in success_symbols:
        print(f"\n{'='*40}")
        print(f"证据A1: {symbol}")
        print(f"{'='*40}")
        evidence = get_raw_ai_response(symbol)
        success_evidence[symbol] = evidence
        
        # 添加延迟
        if symbol != success_symbols[-1]:
            print(f"\n等待3秒...")
            time.sleep(3)
    
    # B. 获取TSLA失败链路证据
    print(f"\n{'#'*60}")
    print("B. TSLA失败链路证据")
    print(f"{'#'*60}")
    
    print(f"\n{'='*40}")
    print(f"证据B1: TSLA")
    print(f"{'='*40}")
    tsla_evidence = get_raw_ai_response('TSLA')
    
    # C. Universe大小和分页证据
    print(f"\n{'#'*60}")
    print("C. Universe大小和分页证据")
    print(f"{'#'*60}")
    
    # 从代码中获取universe
    universe = [
        'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'TSLA', 'NVDA', 'AMD', 'AVGO', 'INTC',
        'JPM', 'XOM', 'WMT', 'HD', 'JNJ', 'PG', 'KO', 'PEP', 'V', 'MA'
    ]
    
    print(f"\n证据C1: Universe大小")
    print(f"  总数: {len(universe)} 个symbols")
    print(f"  列表: {universe}")
    
    print(f"\n证据C2: 分页状态")
    print(f"  1. 页面显示10行 → 需要验证是否分页")
    print(f"  2. Universe有{len(universe)}个 → 应该处理{len(universe)}个")
    print(f"  3. 需要用户验证:")
    print(f"     a. 检查页面summary中的'scanned count'")
    print(f"     b. 点击第2页查看是否有数据")
    print(f"     c. 如果第2页有数据 → 是分页显示")
    print(f"     d. 如果summary显示20 → 扫描完成")
    
    # 检查后端日志
    check_backend_direct_logs()
    
    # 证据总结
    print(f"\n{'#'*60}")
    print("硬证据总结")
    print(f"{'#'*60}")
    
    print(f"\nA. 成功样本Provenance:")
    deepseek_count = 0
    local_count = 0
    unknown_count = 0
    
    for symbol, evidence in success_evidence.items():
        if evidence.get('success'):
            source = evidence.get('analysisSource', 'unknown')
            if 'deepseek' in str(source).lower():
                deepseek_count += 1
                print(f"  {symbol}: [DeepSeek] analysisSource='{source}'")
            elif 'local' in str(source).lower():
                local_count += 1
                print(f"  {symbol}: [本地规则] analysisSource='{source}'")
            else:
                unknown_count += 1
                print(f"  {symbol}: [未知] analysisSource='{source}'")
        else:
            print(f"  {symbol}: [失败] {evidence.get('error')}")
    
    print(f"\nB. TSLA失败证据:")
    if tsla_evidence.get('success'):
        source = tsla_evidence.get('analysisSource', 'unknown')
        print(f"  TSLA: [成功] analysisSource='{source}'")
        print(f"  趋势: {tsla_evidence.get('trend')}")
        print(f"  分数: {tsla_evidence.get('overallScore')}")
    else:
        print(f"  TSLA: [失败]")
        print(f"  错误: {tsla_evidence.get('error')}")
        print(f"  分析来源: {tsla_evidence.get('analysisSource', 'unknown')}")
    
    print(f"\nC. Universe和分页证据:")
    print(f"  Universe大小: {len(universe)}个symbols")
    print(f"  需要用户验证分页状态")
    
    # 基于证据的结论
    print(f"\n{'#'*60}")
    print("基于硬证据的结论")
    print(f"{'#'*60}")
    
    print(f"\n1. 成功样本来源:")
    if deepseek_count > 0:
        print(f"   ✅ 有证据显示来自DeepSeek (analysisSource字段)")
    elif local_count > 0:
        print(f"   ⚠️ 来自本地规则 (fallback)")
    else:
        print(f"   ❓ 来源未知，需要更多证据")
    
    print(f"\n2. TSLA失败原因:")
    if not tsla_evidence.get('success'):
        print(f"   ❌ AI分析失败")
        print(f"   错误信息: {tsla_evidence.get('error', '未知错误')}")
        print(f"   需要后端日志查看具体provider错误")
    else:
        print(f"   ✅ TSLA分析成功")
        print(f"   来源: {tsla_evidence.get('analysisSource')}")
    
    print(f"\n3. 扫描和分页状态:")
    print(f"   📊 Universe: {len(universe)}个symbols")
    print(f"   📄 页面显示10行 → 需要验证:")
    print(f"      a. 检查第2页数据")
    print(f"      b. 检查summary统计")
    
    print(f"\n4. 需要进一步验证:")
    print(f"   🔍 查看后端控制台的真实日志")
    print(f"   📱 检查页面第2页和summary")
    print(f"   📝 记录具体的错误信息")
    
    # 保存所有证据
    output_file = "hard_evidence.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        all_evidence = {
            'timestamp': datetime.now().isoformat(),
            'success_symbols': success_evidence,
            'tsla_evidence': tsla_evidence,
            'universe': {
                'size': len(universe),
                'symbols': universe
            },
            'conclusions': {
                'deepseek_evidence_found': deepseek_count > 0,
                'local_fallback_evidence_found': local_count > 0,
                'tsla_failed': not tsla_evidence.get('success', False),
                'needs_pagination_verification': True,
                'needs_backend_logs': True
            }
        }
        json.dump(all_evidence, f, indent=2, ensure_ascii=False)
    
    print(f"\n所有硬证据已保存到: {output_file}")
    print(f"\n下一步:")
    print(f"  1. 查看 {output_file} 中的原始响应数据")
    print(f"  2. 检查后端控制台日志")
    print(f"  3. 验证页面分页状态")

if __name__ == "__main__":
    main()