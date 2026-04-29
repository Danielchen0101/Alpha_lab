"""
快速AI测试
"""

import requests
import time

def quick_test():
    symbols = ['AAPL', 'MSFT', 'GOOGL', 'INVALID']
    
    for symbol in symbols:
        print(f'\n测试 {symbol}:')
        print('-'*40)
        
        try:
            url = 'http://127.0.0.1:8889/api/ai/analyze/single'
            payload = {'symbol': symbol}
            
            response = requests.post(url, json=payload, timeout=30)
            print(f'状态码: {response.status_code}')
            
            if response.status_code == 200:
                data = response.json()
                print(f'success: {data.get("success")}')
                print(f'hasAiData: {data.get("hasAiData")}')
                print(f'trendLabel: {data.get("trendLabel")}')
                
                if data.get('error'):
                    print(f'error: {data.get("error")}')
            else:
                print(f'响应: {response.text[:200]}')
                
        except Exception as e:
            print(f'异常: {str(e)}')
        
        time.sleep(1)

if __name__ == '__main__':
    quick_test()