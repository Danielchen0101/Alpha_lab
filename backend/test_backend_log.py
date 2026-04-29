#!/usr/bin/env python3
"""
测试后端日志输出
通过监控后端标准输出来查看AI分析过程
"""

import subprocess
import time
import sys

def monitor_backend_output():
    """监控后端输出"""
    print("启动后端监控...")
    
    # 尝试连接到现有后端进程的输出
    try:
        # 使用subprocess运行一个简单的curl命令来触发AI分析
        print("触发AI分析请求...")
        
        cmd = [
            'curl', '-X', 'POST',
            'http://127.0.0.1:8889/ai/analyze/single',
            '-H', 'Content-Type: application/json',
            '-d', '{"symbol": "AAPL"}',
            '--max-time', '30'
        ]
        
        process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            encoding='utf-8'
        )
        
        stdout, stderr = process.communicate(timeout=35)
        
        print("="*60)
        print("标准输出:")
        print(stdout[:1000])
        
        print("\n" + "="*60)
        print("标准错误:")
        print(stderr[:1000])
        
    except subprocess.TimeoutExpired:
        print("请求超时")
        process.kill()
    except Exception as e:
        print(f"错误: {str(e)}")

def check_backend_process():
    """检查后端进程"""
    print("检查后端进程...")
    
    try:
        # 检查进程是否存在
        result = subprocess.run(
            ['tasklist', '/FI', 'PID eq 56316'],
            capture_output=True,
            text=True,
            encoding='gbk'
        )
        
        if 'python.exe' in result.stdout:
            print("后端进程运行中 (PID: 56316)")
            
            # 检查进程命令行
            result2 = subprocess.run(
                ['wmic', 'process', 'where', 'ProcessId=56316', 'get', 'CommandLine'],
                capture_output=True,
                text=True,
                encoding='gbk'
            )
            
            print("命令行:")
            print(result2.stdout)
        else:
            print("后端进程不存在")
            
    except Exception as e:
        print(f"检查进程错误: {str(e)}")

def main():
    """主函数"""
    print("后端监控测试")
    print("="*60)
    
    check_backend_process()
    print("\n" + "="*60)
    monitor_backend_output()

if __name__ == '__main__':
    main()