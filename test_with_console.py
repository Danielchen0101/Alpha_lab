#!/usr/bin/env python3
"""
测试API调用并查看控制台输出
"""

import subprocess
import time
import requests
import json
import sys
import os

def test_with_console():
    """测试API调用"""
    print("Testing API Call with Console Output")
    print("=" * 80)
    
    # 启动后端进程
    backend_dir = os.path.join(os.path.dirname(__file__), 'backend')
    backend_script = os.path.join(backend_dir, 'start_quant_backend.py')
    
    print(f"Starting backend...")
    print(f"Backend script: {backend_script}")
    
    # 在单独的进程中启动后端
    proc = subprocess.Popen(
        [sys.executable, backend_script],
        cwd=backend_dir,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
        universal_newlines=True
    )
    
    # 等待后端启动
    print("Waiting for backend to start...")
    time.sleep(5)
    
    base_url = "http://127.0.0.1:8889"
    symbol = "AAPL"
    
    try:
        # 1. 首先配置AI
        print(f"\n1. Configuring AI...")
        ai_config = {
            "provider": "DeepSeek",
            "apiKey": "sk-83365246617844178bf8d1e121b7279f",
            "baseUrl": "https://api.deepseek.com",
            "model": "deepseek-chat"
        }
        
        response = requests.post(
            f"{base_url}/api/ai/provider/config",
            json=ai_config,
            timeout=10
        )
        
        print(f"AI config status: {response.status_code}")
        if response.status_code == 200:
            print(f"AI config response: {response.json()}")
        
        # 2. 测试AI分析
        print(f"\n2. Testing AI analysis for {symbol}...")
        
        response = requests.post(
            f"{base_url}/api/ai/analyze/single",
            json={"symbol": symbol},
            timeout=15
        )
        
        print(f"AI analysis status: {response.status_code}")
        if response.status_code == 200:
            result = response.json()
            print(f"\nAI Analysis Result:")
            print(f"  Trend: {result.get('trend')}")
            print(f"  Overall Score: {result.get('overallScore')}")
            print(f"  Confidence: {result.get('confidence')}")
            
            ai_reasoning = result.get('aiReasoning', '')
            if ai_reasoning:
                print(f"\nAI Reasoning (first 300 chars):")
                print(f"{ai_reasoning[:300]}...")
                
                if '$0.00' in ai_reasoning:
                    print("\n❌ PROBLEM: AI still sees $0.00!")
                elif '259' in ai_reasoning:
                    print("\n✅ SUCCESS: AI sees real price data!")
        
        # 3. 读取一些控制台输出
        print(f"\n3. Reading backend console output...")
        time.sleep(2)
        
        # 尝试读取一些输出
        try:
            # 非阻塞读取
            import select
            if select.select([proc.stdout], [], [], 0.5)[0]:
                output = proc.stdout.read(1000)
                if output:
                    print("Backend output (first 1000 chars):")
                    print(output[:1000])
        except:
            pass
            
    except Exception as e:
        print(f"Error: {e}")
    finally:
        # 清理
        print("\nCleaning up...")
        proc.terminate()
        proc.wait()
    
    print("\n" + "=" * 80)
    print("Test Complete")

if __name__ == "__main__":
    test_with_console()