#!/usr/bin/env python3
"""
测试TSLA为什么失败
"""

import sys
import os
import json
import time
import requests
from datetime import datetime

# 添加当前目录到路径
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

def test_tsla_analysis():
    """测试TSLA的AI分析"""
    print("="*60)
    print("测试TSLA AI分析失败原因")
    print(f"时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("="*60)
    
    base_url = "http://localhost:8889"
    
    # 1. 测试股票数据API
    print("\n1. 测试TSLA股票数据API...")
    try:
        response = requests.get(f"{base_url}/market/stock/TSLA", timeout=10)
        print(f"   状态码: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"   成功: {data.get('success', False)}")
            print(f"   价格: {data.get('price')}")
            print(f"   涨跌幅: {data.get('changePercent')}")
            print(f"   成交量: {data.get('volume')}")
            print(f"   数据源: {data.get('dataSource')}")
        else:
            print(f"   错误: {response.text[:200]}")
    except Exception as e:
        print(f"   异常: {str(e)}")
    
    # 2. 测试新闻API
    print("\n2. 测试TSLA新闻API...")
    try:
        response = requests.get(f"{base_url}/market/news/TSLA", timeout=10)
        print(f"   状态码: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"   成功: {data.get('success', False)}")
            print(f"   情感: {data.get('sentiment')}")
            print(f"   事件风险: {data.get('eventRisk')}")
            print(f"   新闻数量: {data.get('newsCount', 0)}")
            print(f"   有新闻: {data.get('hasNews', False)}")
        else:
            print(f"   错误: {response.text[:200]}")
    except Exception as e:
        print(f"   异常: {str(e)}")
    
    # 3. 测试AI分析API
    print("\n3. 测试TSLA AI分析API...")
    try:
        start_time = time.time()
        response = requests.post(
            f"{base_url}/ai/analyze/single",
            json={"symbol": "TSLA"},
            timeout=30
        )
        response_time = time.time() - start_time
        
        print(f"   状态码: {response.status_code}")
        print(f"   响应时间: {response_time:.2f}s")
        
        if response.status_code == 200:
            data = response.json()
            print(f"   成功: {data.get('success', False)}")
            print(f"   趋势标签: {data.get('trend')}")
            print(f"   总体分数: {data.get('overallScore')}")
            print(f"   置信度: {data.get('confidence')}")
            print(f"   成交量状态: {data.get('volumeStatus')}")
            print(f"   简洁推理: {data.get('conciseReasoning')}")
            print(f"   详细推理: {data.get('detailedReasoning')}")
            print(f"   AI推理: {data.get('aiReasoning')}")
            print(f"   新闻情感: {data.get('newsSentiment')}")
            print(f"   事件风险: {data.get('eventRisk')}")
            
            # 检查是否返回null数据
            if data.get('success') is False:
                print(f"   ⚠️ AI分析返回success: false")
                print(f"   错误信息: {data.get('error')}")
            elif data.get('trend') is None:
                print(f"   ⚠️ AI分析返回null趋势标签")
            else:
                print(f"   ✅ AI分析成功")
        else:
            print(f"   错误: {response.text[:200]}")
    except requests.exceptions.Timeout:
        print(f"   ❌ 请求超时 (30秒)")
    except Exception as e:
        print(f"   异常: {str(e)}")
    
    # 4. 对比测试成功的symbol (AAPL)
    print("\n" + "="*60)
    print("对比测试: AAPL (应该成功)")
    print("="*60)
    
    print("\n4. 测试AAPL AI分析API...")
    try:
        start_time = time.time()
        response = requests.post(
            f"{base_url}/ai/analyze/single",
            json={"symbol": "AAPL"},
            timeout=30
        )
        response_time = time.time() - start_time
        
        print(f"   状态码: {response.status_code}")
        print(f"   响应时间: {response_time:.2f}s")
        
        if response.status_code == 200:
            data = response.json()
            print(f"   成功: {data.get('success', False)}")
            print(f"   趋势标签: {data.get('trend')}")
            print(f"   总体分数: {data.get('overallScore')}")
            print(f"   置信度: {data.get('confidence')}")
            
            if data.get('success') is False:
                print(f"   ⚠️ AAPL也返回success: false")
                print(f"   错误信息: {data.get('error')}")
            elif data.get('trend') is None:
                print(f"   ⚠️ AAPL也返回null趋势标签")
            else:
                print(f"   ✅ AAPL AI分析成功")
        else:
            print(f"   错误: {response.text[:200]}")
    except Exception as e:
        print(f"   异常: {str(e)}")
    
    # 5. 检查后端日志
    print("\n" + "="*60)
    print("检查后端日志中的错误")
    print("="*60)
    
    log_file = "quant_backend.log"
    if os.path.exists(log_file):
        print(f"\n检查日志文件: {log_file}")
        try:
            with open(log_file, 'r', encoding='utf-8') as f:
                lines = f.readlines()
                tsla_errors = [line for line in lines[-50:] if 'TSLA' in line.upper() and ('ERROR' in line or 'FAIL' in line or 'EXCEPTION' in line)]
                if tsla_errors:
                    print(f"找到TSLA相关错误:")
                    for error in tsla_errors[-10:]:
                        print(f"  {error.strip()}")
                else:
                    print(f"未找到TSLA相关错误")
        except Exception as e:
            print(f"读取日志文件失败: {str(e)}")
    else:
        print(f"日志文件不存在: {log_file}")

def main():
    """主函数"""
    print("TSLA失败原因分析脚本")
    print(f"开始时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # 检查后端是否运行
    try:
        response = requests.get("http://localhost:8889/api/status", timeout=5)
        if response.status_code == 200:
            print("[SUCCESS] 后端服务正常运行")
            test_tsla_analysis()
        else:
            print(f"[ERROR] 后端服务返回错误: {response.status_code}")
    except requests.exceptions.ConnectionError:
        print("[ERROR] 无法连接到后端服务 (http://localhost:8889)")
        print("请确保后端服务正在运行")
    except Exception as e:
        print(f"[ERROR] 检查后端服务时发生异常: {str(e)}")

if __name__ == "__main__":
    main()