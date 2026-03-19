import re

with open('start_quant_backend.py', 'r', encoding='utf-8') as f:
    content = f.read()

# 修复路由：将get_market_stocks()重命名为select_dashboard_stocks()
pattern = r'@app\.route\("/api/market/stocks", methods=\["GET"\]\)\s*\n\s*def get_market_stocks\(\):'
replacement = '@app.route("/api/market/stocks", methods=["GET"])\ndef select_dashboard_stocks():'

content = re.sub(pattern, replacement, content)

# 删除第660行的get_market_stocks()函数定义
# 首先找到函数定义的位置
lines = content.split('\n')
new_lines = []
skip = False
for i, line in enumerate(lines):
    if i > 500 and line.strip() == 'def get_market_stocks():':
        skip = True
        continue
    if skip and line.strip() and not line.startswith('    '):
        skip = False
    if not skip:
        new_lines.append(line)

content = '\n'.join(new_lines)

with open('start_quant_backend_fixed.py', 'w', encoding='utf-8') as f:
    f.write(content)

print("修复完成！")