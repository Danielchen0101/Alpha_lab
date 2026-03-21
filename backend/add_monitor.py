"""
在Twelve Data API调用处添加监控
"""

import re

with open('start_quant_backend.py', 'r', encoding='utf-8') as f:
    content = f.read()

# 在Twelve Data API调用前添加监控
# 查找 response = requests.get(url, params=params, timeout=15) 在特定上下文中
pattern = r'(response = requests\.get\(url, params=params, timeout=15\))'

def add_monitor(match):
    return '        # 记录外部API调用\n        api_monitor.log_external_call(\'twelvedata\')\n        \n' + match.group(1)

# 只在get_twelvedata_history函数中添加
# 先找到函数开始
func_start = content.find('def get_twelvedata_history')
if func_start != -1:
    # 找到函数结束（下一个def或文件结束）
    func_end = content.find('\ndef ', func_start + 1)
    if func_end == -1:
        func_end = len(content)
    
    func_content = content[func_start:func_end]
    
    # 在函数内添加监控
    modified_func = re.sub(pattern, add_monitor, func_content)
    
    # 替换原函数
    content = content[:func_start] + modified_func + content[func_end:]

# 保存文件
with open('start_quant_backend.py', 'w', encoding='utf-8') as f:
    f.write(content)

print("已添加Twelve Data API监控")