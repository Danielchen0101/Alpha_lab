#!/usr/bin/env python3
"""
修复损坏的后端文件 - 手动修复版本
"""

import os
import sys

# 读取原始文件的前9267行（损坏前的部分）
print("读取原始文件...")
with open('start_quant_backend_original.py', 'rb') as f:
    content = f.read()

# 找到损坏开始位置
# 我们知道第9267行开始损坏
lines = content.split(b'\n')

# 获取前9266行（0-indexed: 0-9265）
good_lines = lines[:9266]

# 解码好的部分
good_content = b'\n'.join(good_lines)
try:
    good_text = good_content.decode('utf-8')
except:
    # 如果UTF-8失败，尝试latin-1
    good_text = good_content.decode('latin-1', errors='ignore')

print(f"保留前 {len(good_lines)} 行有效代码")

# 创建修复的fetch_finnhub_news函数
# 基于常见的Finnhub新闻API代码模式
repaired_function = '''
def fetch_finnhub_news(symbol):
    """从Finnhub获取股票新闻"""
    try:
        print(f'[Finnhub新闻] 获取 {symbol} 新闻')
        
        # 检查API密钥
        if not FINNHUB_API_KEY:
            print(f'[Finnhub新闻] Finnhub API密钥未配置')
            return None
        
        # 调用Finnhub News API
        import requests
        from datetime import datetime, timedelta
        
        # 设置时间范围（最近7天）
        to_date = datetime.utcnow()
        from_date = to_date - timedelta(days=7)
        
        # 格式化日期
        from_str = from_date.strftime('%Y-%m-%d')
        to_str = to_date.strftime('%Y-%m-%d')
        
        # 构建API URL
        url = f'{FINNHUB_BASE_URL}/company-news'
        params = {
            'symbol': symbol,
            'from': from_str,
            'to': to_str,
            'token': FINNHUB_API_KEY
        }
        
        print(f'[Finnhub新闻] 请求URL: {url}')
        print(f'[Finnhub新闻] 参数: {params}')
        
        # 发送请求
        response = requests.get(url, params=params, timeout=10)
        
        if response.status_code == 200:
            news_data = response.json()
            print(f'[Finnhub新闻] 获取到 {len(news_data)} 条新闻')
            return news_data
        else:
            print(f'[Finnhub新闻] API请求失败: {response.status_code}')
            print(f'[Finnhub新闻] 响应: {response.text[:200]}')
            return None
            
    except Exception as e:
        print(f'[Finnhub新闻] 获取新闻时出错: {str(e)}')
        return None

# 主程序入口
if __name__ == '__main__':
    print("================================================================================")
    print("修复版后端启动")
    print("端口: 8889")
    print("================================================================================")
    
    print("\\n启动服务器...")
    app.run(host='127.0.0.1', port=8889, debug=True, use_reloader=False)
'''

# 组合修复后的文件
repaired_content = good_text + repaired_function

# 写入修复后的文件
with open('start_quant_backend_repaired.py', 'w', encoding='utf-8') as f:
    f.write(repaired_content)

print(f"修复完成！")
print(f"原始文件大小: {len(content)} 字节")
print(f"修复后文件大小: {len(repaired_content)} 字节")
print(f"修复后文件已保存为: start_quant_backend_repaired.py")

# 检查语法
print("\\n检查语法...")
import subprocess
result = subprocess.run(['python', '-m', 'py_compile', 'start_quant_backend_repaired.py'], 
                       capture_output=True, text=True)

if result.returncode == 0:
    print("语法检查: 通过")
else:
    print("语法检查: 失败")
    print(f"错误信息: {result.stderr}")