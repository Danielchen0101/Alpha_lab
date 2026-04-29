#!/usr/bin/env python3
"""
检查成功symbol的真实来源
"""

import sys
import os
import json
import time
import requests
from datetime import datetime

def check_symbol_provenance(symbol):
    """检查symbol的分析来源"""
    print(f"\n{'='*60}")
    print(f"检查 {symbol} 的分析来源")
    print(f"{'='*60}")
    
    base_url = "http://localhost:8889"
    
    # 1. 检查股票数据
    print(f"\n1. 股票数据:")
    try:
        response = requests.get(f"{base_url}/market/stock/{symbol}", timeout=10)
        if response.status_code == 200:
            data = response.json()
            print(f"   成功: {data.get('success', False)}")
            print(f"   价格: {data.get('price')}")
            print(f"   涨跌幅: {data.get('changePercent')}")
            print(f"   数据源: {data.get('dataSource')}")
        else:
            print(f"   错误: {response.status_code}")
    except Exception as e:
        print(f"   异常: {str(e)}")
    
    # 2. 检查新闻数据
    print(f"\n2. 新闻数据:")
    try:
        response = requests.get(f"{base_url}/market/news/{symbol}", timeout=10)
        if response.status_code == 200:
            data = response.json()
            print(f"   成功: {data.get('success', False)}")
            print(f"   情感: {data.get('sentiment')}")
            print(f"   事件风险: {data.get('eventRisk')}")
            print(f"   新闻数量: {data.get('newsCount', 0)}")
            print(f"   有新闻: {data.get('hasNews', False)}")
        else:
            print(f"   错误: {response.status_code}")
    except Exception as e:
        print(f"   异常: {str(e)}")
    
    # 3. 检查AI分析（关键！）
    print(f"\n3. AI分析:")
    try:
        start_time = time.time()
        response = requests.post(
            f"{base_url}/ai/analyze/single",
            json={"symbol": symbol},
            timeout=30
        )
        response_time = time.time() - start_time
        
        print(f"   响应时间: {response_time:.2f}s")
        print(f"   状态码: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"   成功: {data.get('success', False)}")
            print(f"   趋势: {data.get('trend')}")
            print(f"   总体分数: {data.get('overallScore')}")
            print(f"   置信度: {data.get('confidence')}")
            print(f"   分析来源: {data.get('analysisSource', 'unknown')}")
            print(f"   成交量状态: {data.get('volumeStatus')}")
            print(f"   简洁推理: {data.get('conciseReasoning')}")
            print(f"   详细推理: {data.get('detailedReasoning')}")
            print(f"   AI推理: {data.get('aiReasoning')}")
            
            # 关键：检查来源
            analysis_source = data.get('analysisSource', 'unknown')
            if analysis_source == 'deepseek':
                print(f"   [来源] DeepSeek AI分析")
            elif analysis_source == 'local':
                print(f"   [来源] 本地规则分析 (fallback)")
            else:
                print(f"   [来源] 未知: {analysis_source}")
            
            # 检查是否返回null数据
            if data.get('success') is False:
                print(f"   [状态] AI分析返回success: false")
                print(f"   错误信息: {data.get('error')}")
            elif data.get('trend') is None:
                print(f"   [状态] AI分析返回null趋势")
            else:
                print(f"   [状态] AI分析成功")
        else:
            print(f"   错误: {response.text[:200]}")
    except requests.exceptions.Timeout:
        print(f"   [错误] 请求超时 (30秒)")
    except Exception as e:
        print(f"   异常: {str(e)}")
    
    return response.json() if response.status_code == 200 else None

def check_backend_logs():
    """检查后端日志中的AI分析记录"""
    print(f"\n{'='*60}")
    print("检查后端日志")
    print(f"{'='*60}")
    
    log_file = "quant_backend.log"
    if os.path.exists(log_file):
        print(f"检查日志文件: {log_file}")
        try:
            with open(log_file, 'r', encoding='utf-8') as f:
                lines = f.readlines()
                
            # 查找AI分析相关的日志
            ai_logs = []
            for line in lines[-200:]:  # 最近200行
                if 'analyze_trend' in line.lower() or 'deepseek' in line.lower():
                    ai_logs.append(line.strip())
            
            if ai_logs:
                print(f"找到AI分析相关日志 ({len(ai_logs)}条):")
                for log in ai_logs[-10:]:  # 显示最近10条
                    print(f"  {log}")
            else:
                print("未找到AI分析相关日志")
                
        except Exception as e:
            print(f"读取日志文件失败: {str(e)}")
    else:
        print(f"日志文件不存在: {log_file}")

def main():
    """主函数"""
    print("成功symbol来源分析脚本")
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
    
    # 测试成功样本
    success_symbols = ['AAPL', 'MSFT', 'AMZN']
    print(f"\n测试成功样本: {success_symbols}")
    
    results = {}
    for symbol in success_symbols:
        result = check_symbol_provenance(symbol)
        results[symbol] = result
        
        # 添加延迟避免速率限制
        if symbol != success_symbols[-1]:
            print(f"\n等待3秒避免速率限制...")
            time.sleep(3)
    
    # 测试失败样本 (TSLA)
    print(f"\n{'#'*60}")
    print("测试失败样本: TSLA")
    print(f"{'#'*60}")
    tsla_result = check_symbol_provenance('TSLA')
    results['TSLA'] = tsla_result
    
    # 分析结果
    print(f"\n{'#'*60}")
    print("分析总结")
    print(f"{'#'*60}")
    
    deepseek_count = 0
    local_count = 0
    failed_count = 0
    
    for symbol, result in results.items():
        if result:
            source = result.get('analysisSource', 'unknown')
            success = result.get('success', False)
            
            if success and source == 'deepseek':
                deepseek_count += 1
                status = "[DeepSeek成功]"
            elif success and source == 'local':
                local_count += 1
                status = "[本地规则成功]"
            elif not success:
                failed_count += 1
                status = "[失败]"
            else:
                status = f"[未知: {source}]"
            
            print(f"  {symbol}: {status}")
        else:
            failed_count += 1
            print(f"  {symbol}: [API调用失败]")
    
    print(f"\n统计:")
    print(f"  总测试: {len(results)}")
    print(f"  DeepSeek成功: {deepseek_count}")
    print(f"  本地规则成功: {local_count}")
    print(f"  失败: {failed_count}")
    
    # 检查后端日志
    check_backend_logs()
    
    # 保存结果
    output_file = "symbol_provenance_analysis.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        output_data = {
            'timestamp': datetime.now().isoformat(),
            'results': results,
            'summary': {
                'total_tested': len(results),
                'deepseek_success': deepseek_count,
                'local_success': local_count,
                'failed': failed_count
            }
        }
        json.dump(output_data, f, indent=2, ensure_ascii=False)
    
    print(f"\n详细结果已保存到: {output_file}")

if __name__ == "__main__":
    main()