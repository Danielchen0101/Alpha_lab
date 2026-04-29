import requests
import json
import time
import threading

def monitor_logs():
    """监控日志输出"""
    print("等待后端日志输出...")
    time.sleep(1)

def test_scanner_with_monitoring():
    """测试Market Scanner并监控日志"""
    url = "http://127.0.0.1:8889/api/ai/market/scanner"
    
    # 测试数据 - 只扫描1只股票
    data = {
        "symbols": ["AAPL"],
        "maxSymbols": 1
    }
    
    print("=== 开始详细测试Market Scanner ===")
    print(f"时间: {time.strftime('%H:%M:%S')}")
    print(f"扫描股票: {data['symbols']}")
    
    # 启动日志监控线程
    log_thread = threading.Thread(target=monitor_logs)
    log_thread.start()
    
    start_time = time.time()
    
    try:
        print(f"\n发送请求到: {url}")
        response = requests.post(url, json=data, timeout=60)
        end_time = time.time()
        
        elapsed = end_time - start_time
        print(f"\n=== 测试结果 ===")
        print(f"总耗时: {elapsed:.2f}秒")
        print(f"状态码: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"成功: {result.get('success')}")
            print(f"消息: {result.get('message')}")
            
            if result.get('error'):
                print(f"错误: {result.get('error')}")
                print(f"错误类型: {result.get('error_type')}")
                if result.get('wait_seconds'):
                    print(f"等待时间: {result.get('wait_seconds')}秒")
            
            results = result.get('results', [])
            print(f"结果数量: {len(results)}")
            
            if results:
                print("\n=== 扫描结果 ===")
                for i, r in enumerate(results):
                    print(f"{i+1}. {r.get('symbol')}:")
                    print(f"   价格: ${r.get('price')}")
                    print(f"   涨跌幅: {r.get('changePct')}%")
                    print(f"   趋势: {r.get('trendLabel')}")
                    print(f"   新闻情绪: {r.get('newsSentiment')}")
                    print(f"   数据源: {r.get('dataSource')}")
                    
        else:
            print(f"响应内容: {response.text[:500]}")
            
    except requests.exceptions.Timeout:
        print("请求超时（60秒）")
    except Exception as e:
        print(f"请求失败: {str(e)}")
    
    print(f"\n测试结束时间: {time.strftime('%H:%M:%S')}")

if __name__ == "__main__":
    test_scanner_with_monitoring()